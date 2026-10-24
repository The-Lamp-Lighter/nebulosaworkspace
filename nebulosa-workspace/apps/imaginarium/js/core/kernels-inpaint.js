/* ==========================================================================
   Imaginarium — preenchimento sensível ao conteúdo (inpainting)
   PatchMatch em pirâmide com reconstrução por votação (EM), no estilo de
   Wexler et al. / Barnes et al. Roda no Web Worker.
   K.inpaint(data, w, h, { mask: Uint8Array (255 = buraco), patch, quality })
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG;
  IMG.kernelParts = IMG.kernelParts || [];

  IMG.kernelParts.push(function inpaintPart(K) {
    function rng(seed) { seed = seed >>> 0 || 1; return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

    /* nível da pirâmide: img Float32 (RGBA, 0..255), hole Uint8 (1 = buraco) */
    function down(L) {
      const w = Math.max(1, L.w >> 1), h = Math.max(1, L.h >> 1);
      const img = new Float32Array(w * h * 4), hole = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0, n = 0, hh = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(L.w - 1, x * 2 + dx), sy = Math.min(L.h - 1, y * 2 + dy), j = sy * L.w + sx;
          if (L.hole[j]) { hh++; continue; }
          r += L.img[j * 4]; g += L.img[j * 4 + 1]; b += L.img[j * 4 + 2]; a += L.img[j * 4 + 3]; n++;
        }
        const i = y * w + x;
        if (hh > 0) hole[i] = 1;
        if (n) { img[i * 4] = r / n; img[i * 4 + 1] = g / n; img[i * 4 + 2] = b / n; img[i * 4 + 3] = a / n; }
      }
      return { w, h, img, hole };
    }

    /** Preenchimento inicial por difusão (média dos vizinhos conhecidos). */
    function diffuse(L) {
      const { w, h, img, hole } = L;
      const known = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) known[i] = hole[i] ? 0 : 1;
      let changed = true, guard = 0;
      while (changed && guard++ < w + h) {
        changed = false;
        const add = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = y * w + x; if (known[i]) continue;
          let r = 0, g = 0, b = 0, a = 0, n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = yy * w + xx; if (!known[j]) continue;
            r += img[j * 4]; g += img[j * 4 + 1]; b += img[j * 4 + 2]; a += img[j * 4 + 3]; n++;
          }
          if (n) add.push(i, r / n, g / n, b / n, a / n);
        }
        for (let k = 0; k < add.length; k += 5) { const i = add[k]; img[i * 4] = add[k + 1]; img[i * 4 + 1] = add[k + 2]; img[i * 4 + 2] = add[k + 3]; img[i * 4 + 3] = add[k + 4]; known[i] = 1; changed = true; }
      }
    }

    function solveLevel(L, iters, R, rnd) {
      const { w, h, img, hole } = L;
      const N = w * h;
      // centros de origem válidos: patch inteiro dentro da imagem e fora do buraco
      const valid = new Uint8Array(N);
      const holeInt = new Int32Array((w + 1) * (h + 1));
      for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += hole[y * w + x]; holeInt[(y + 1) * (w + 1) + x + 1] = holeInt[y * (w + 1) + x + 1] + row; } }
      const holeSum = (x0, y0, x1, y1) => holeInt[(y1 + 1) * (w + 1) + x1 + 1] - holeInt[y0 * (w + 1) + x1 + 1] - holeInt[(y1 + 1) * (w + 1) + x0] + holeInt[y0 * (w + 1) + x0];
      const vlist = [];
      for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) if (holeSum(x - R, y - R, x + R, y + R) === 0) { valid[y * w + x] = 1; vlist.push(y * w + x); }
      if (!vlist.length) return false;
      // centros de destino: pixels cujo patch toca o buraco
      const targets = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - R), y0 = Math.max(0, y - R), x1 = Math.min(w - 1, x + R), y1 = Math.min(h - 1, y + R);
        if (holeSum(x0, y0, x1, y1) > 0) targets.push(y * w + x);
      }
      const nnf = new Int32Array(N).fill(-1), cost = new Float32Array(N);
      const dist = (t, s, best) => {
        const tx = t % w, ty = (t / w) | 0, sx = s % w, sy = (s / w) | 0;
        let sum = 0, n = 0;
        for (let dy = -R; dy <= R; dy++) {
          const yy = ty + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -R; dx <= R; dx++) {
            const xx = tx + dx; if (xx < 0 || xx >= w) continue;
            const a = (yy * w + xx) * 4, b = ((sy + dy) * w + sx + dx) * 4;
            const d0 = img[a] - img[b], d1 = img[a + 1] - img[b + 1], d2 = img[a + 2] - img[b + 2], d3 = (img[a + 3] - img[b + 3]) * 0.5;
            sum += d0 * d0 + d1 * d1 + d2 * d2 + d3 * d3; n++;
            if (sum > best * n * 1.0001 && n > 4) return 1e30;
          }
        }
        return n ? sum / n : 1e30;
      };
      for (const t of targets) { const s = vlist[(rnd() * vlist.length) | 0]; nnf[t] = s; cost[t] = dist(t, s, 1e30); }
      const tryS = (t, s) => {
        if (s < 0 || !valid[s]) return;
        const c = dist(t, s, cost[t]);
        if (c < cost[t]) { cost[t] = c; nnf[t] = s; }
      };
      for (let it = 0; it < iters; it++) {
        // PatchMatch: propagação + busca aleatória
        for (let pass = 0; pass < 2; pass++) {
          const fwd = pass === 0, dir = fwd ? 1 : -1;
          for (let k = 0; k < targets.length; k++) {
            const t = targets[fwd ? k : targets.length - 1 - k];
            const tx = t % w, ty = (t / w) | 0;
            const left = tx - dir >= 0 && tx - dir < w ? t - dir : -1, up = ty - dir >= 0 && ty - dir < h ? t - dir * w : -1;
            if (left >= 0 && nnf[left] >= 0) { const s = nnf[left] + dir; if ((s % w) === ((nnf[left] % w) + dir)) tryS(t, s); }
            if (up >= 0 && nnf[up] >= 0) tryS(t, nnf[up] + dir * w);
            let rad = Math.max(w, h);
            const s0 = nnf[t], sx0 = s0 % w, sy0 = (s0 / w) | 0;
            while (rad >= 1) {
              const sx = Math.round(sx0 + (rnd() * 2 - 1) * rad), sy = Math.round(sy0 + (rnd() * 2 - 1) * rad);
              if (sx >= 0 && sy >= 0 && sx < w && sy < h) tryS(t, sy * w + sx);
              rad *= 0.5;
            }
          }
        }
        // votação: cada pixel do buraco recebe a média ponderada dos patches que o cobrem
        const acc = new Float32Array(N * 5);
        for (const t of targets) {
          const s = nnf[t]; if (s < 0) continue;
          const tx = t % w, ty = (t / w) | 0, sx = s % w, sy = (s / w) | 0;
          const wt = Math.exp(-cost[t] / 2000) + 1e-4;
          for (let dy = -R; dy <= R; dy++) {
            const yy = ty + dy; if (yy < 0 || yy >= h) continue;
            for (let dx = -R; dx <= R; dx++) {
              const xx = tx + dx; if (xx < 0 || xx >= w) continue;
              const q = yy * w + xx; if (!hole[q]) continue;
              const b = ((sy + dy) * w + sx + dx) * 4, o = q * 5;
              acc[o] += img[b] * wt; acc[o + 1] += img[b + 1] * wt; acc[o + 2] += img[b + 2] * wt; acc[o + 3] += img[b + 3] * wt; acc[o + 4] += wt;
            }
          }
        }
        for (let q = 0; q < N; q++) {
          if (!hole[q]) continue;
          const o = q * 5, ws = acc[o + 4]; if (!ws) continue;
          img[q * 4] = acc[o] / ws; img[q * 4 + 1] = acc[o + 1] / ws; img[q * 4 + 2] = acc[o + 2] / ws; img[q * 4 + 3] = acc[o + 3] / ws;
        }
        // atualiza os custos com a imagem reconstruída
        for (const t of targets) if (nnf[t] >= 0) cost[t] = dist(t, nnf[t], 1e30);
      }
      return true;
    }

    K.inpaint = function (d, w, h, p) {
      const mask = p.mask, R = Math.max(2, ((p.patch || 7) / 2) | 0), q = p.quality || 1;
      const rnd = rng(p.seed || 12345);
      const base = { w, h, img: new Float32Array(w * h * 4), hole: new Uint8Array(w * h) };
      let any = false;
      for (let i = 0; i < w * h; i++) { for (let c = 0; c < 4; c++) base.img[i * 4 + c] = d[i * 4 + c]; if (mask[i] > 127) { base.hole[i] = 1; any = true; } }
      if (!any) return;
      const pyr = [base];
      while (pyr.length < 8) {
        const t = pyr[pyr.length - 1];
        if (Math.min(t.w, t.h) < R * 6 + 8) break;
        let hc = 0; for (let i = 0; i < t.hole.length; i++) hc += t.hole[i];
        if (hc < 64) break;
        pyr.push(down(t));
      }
      const top = pyr[pyr.length - 1];
      diffuse(top);
      for (let lv = pyr.length - 1; lv >= 0; lv--) {
        const L = pyr[lv];
        if (lv < pyr.length - 1) {
          // amplia o resultado do nível anterior para dentro do buraco
          const P = pyr[lv + 1];
          for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
            const i = y * L.w + x; if (!L.hole[i]) continue;
            const px = Math.min(P.w - 1, x >> 1), py = Math.min(P.h - 1, y >> 1), j = (py * P.w + px) * 4;
            for (let c = 0; c < 4; c++) L.img[i * 4 + c] = P.img[j + c];
          }
        }
        const iters = Math.max(1, Math.round((lv === pyr.length - 1 ? 6 : lv === 0 ? 2 : 3) * q));
        if (!solveLevel(L, iters, R, rnd)) diffuse(L);
      }
      for (let i = 0; i < w * h; i++) if (base.hole[i]) for (let c = 0; c < 4; c++) d[i * 4 + c] = base.img[i * 4 + c];
    };
  });
})();
