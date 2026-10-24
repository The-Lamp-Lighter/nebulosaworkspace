/* ==========================================================================
   Imaginarium — núcleos de ajuste de cor (Imagem › Ajustes)
   Funções puras (data RGBA, w, h, params) que alteram os pixels no lugar.
   Não podem referenciar nada fora desta função: também rodam no Web Worker.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG;
  IMG.kernelParts = IMG.kernelParts || [];

  IMG.kernelParts.push(function adjustPart(K) {
    const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
    const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

    function rgb2hsl(r, g, b, out) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
      }
      out[0] = h; out[1] = s; out[2] = l;
      return out;
    }
    function hue2rgb(p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    function hsl2rgb(h, s, l, out) {
      h = (((h % 360) + 360) % 360) / 360;
      if (s <= 0) { out[0] = out[1] = out[2] = l * 255; return out; }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      out[0] = hue2rgb(p, q, h + 1 / 3) * 255; out[1] = hue2rgb(p, q, h) * 255; out[2] = hue2rgb(p, q, h - 1 / 3) * 255;
      return out;
    }
    K._rgb2hsl = rgb2hsl; K._hsl2rgb = hsl2rgb;
    const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

    /** Aplica três tabelas (r, g, b) de 256 valores. */
    K.lut3 = function (d, w, h, p) {
      const R = p.r, G = p.g || p.r, B = p.b || p.r;
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        d[i] = R[d[i]]; d[i + 1] = G[d[i + 1]]; d[i + 2] = B[d[i + 2]];
      }
    };

    /* ---------- Matiz/Saturação com faixas de cor ---------- */
    function rangeW(hh, r) {
      // r = [a, b, c, d] em graus (podem atravessar 0)
      let a = r[0], b = r[1], c = r[2], e = r[3];
      const norm = (x) => { while (x < a) x += 360; return x; };
      b = norm(b); c = norm(c); e = norm(e);
      let x = norm(hh);
      if (x > e && x - 360 >= a) x -= 360;
      if (x < a || x > e) return 0;
      if (x < b) return (x - a) / Math.max(1e-6, b - a);
      if (x <= c) return 1;
      return (e - x) / Math.max(1e-6, e - c);
    }
    K.hueSat = function (d, w, h, p) {
      const m = p.master || { h: 0, s: 0, l: 0 }, rs = p.ranges || [];
      const t = [0, 0, 0], o = [0, 0, 0];
      const col = p.colorize;
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        rgb2hsl(d[i], d[i + 1], d[i + 2], t);
        let hh = t[0], s = t[1], l = t[2];
        if (col) {
          hh = col.h; s = col.s / 100;
          const L = col.l / 100;
          l = L >= 0 ? l + (1 - l) * L : l * (1 + L);
          hsl2rgb(hh, s, l, o);
          d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
          continue;
        }
        let dh = m.h, ds = m.s / 100, dl = m.l / 100;
        if (s > 0) for (let k = 0; k < rs.length; k++) { const r = rs[k]; if (!r || (!r.h && !r.s && !r.l)) continue; const wt = rangeW(hh, r.range); if (wt > 0) { dh += r.h * wt; ds += (r.s / 100) * wt; dl += (r.l / 100) * wt; } }
        hh += dh;
        if (ds > 1) ds = 1; if (ds < -1) ds = -1;
        s = ds >= 0 ? s + (1 - s) * ds * (s > 0 ? 1 : 0) : s * (1 + ds);
        if (dl > 1) dl = 1; if (dl < -1) dl = -1;
        l = dl >= 0 ? l + (1 - l) * dl : l * (1 + dl);
        hsl2rgb(hh, c01(s), c01(l), o);
        d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
      }
    };

    K.colorBalance = function (d, w, h, p) {
      const R = p.r, G = p.g, B = p.b, keep = p.preserve;
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let nr = R[r], ng = G[g], nb = B[b];
        if (keep) { const dl = lum(r, g, b) - lum(nr, ng, nb); nr += dl; ng += dl; nb += dl; }
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
      }
    };

    K.blackWhite = function (d, w, h, p) {
      const W = p.w; // [vermelhos, amarelos, verdes, cianos, azuis, magentas] em fração
      const tint = p.tint, o = [0, 0, 0];
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let v;
        if (r >= g && g >= b) v = b + (g - b) * W[1] + (r - g) * W[0];
        else if (r >= b && b >= g) v = g + (b - g) * W[5] + (r - b) * W[0];
        else if (g >= r && r >= b) v = b + (r - b) * W[1] + (g - r) * W[2];
        else if (g >= b && b >= r) v = r + (b - r) * W[3] + (g - b) * W[2];
        else if (b >= r && r >= g) v = g + (r - g) * W[5] + (b - r) * W[4];
        else v = r + (g - r) * W[3] + (b - g) * W[4];
        v = cl(v);
        if (tint) { hsl2rgb(tint.h, tint.s / 100, v / 255, o); d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; }
        else d[i] = d[i + 1] = d[i + 2] = v;
      }
    };

    K.photoFilter = function (d, w, h, p) {
      const fr = p.color[0] / 255, fg = p.color[1] / 255, fb = p.color[2] / 255, k = p.density, keep = p.preserve;
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let nr = r + (r * fr - r) * k, ng = g + (g * fg - g) * k, nb = b + (b * fb - b) * k;
        if (keep) { const l0 = lum(r, g, b), l1 = lum(nr, ng, nb); if (l1 > 0.01) { const s = l0 / l1; nr *= s; ng *= s; nb *= s; } else { nr = ng = nb = l0; } }
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
      }
    };

    K.channelMixer = function (d, w, h, p) {
      const M = p.m, mono = p.mono;
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (mono) { const v = r * M[0][0] + g * M[0][1] + b * M[0][2] + M[0][3] * 255; d[i] = d[i + 1] = d[i + 2] = v; continue; }
        d[i] = r * M[0][0] + g * M[0][1] + b * M[0][2] + M[0][3] * 255;
        d[i + 1] = r * M[1][0] + g * M[1][1] + b * M[1][2] + M[1][3] * 255;
        d[i + 2] = r * M[2][0] + g * M[2][1] + b * M[2][2] + M[2][3] * 255;
      }
    };

    /** Tabela 3D (cubo N×N×N, r varia mais rápido), interpolação trilinear. */
    K.colorLookup = function (d, w, h, p) {
      const N = p.size, T = p.table, s = (N - 1) / 255;
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        const fr = d[i] * s, fg = d[i + 1] * s, fb = d[i + 2] * s;
        const r0 = Math.floor(fr), g0 = Math.floor(fg), b0 = Math.floor(fb);
        const r1 = Math.min(N - 1, r0 + 1), g1 = Math.min(N - 1, g0 + 1), b1 = Math.min(N - 1, b0 + 1);
        const tr = fr - r0, tg = fg - g0, tb = fb - b0;
        for (let c = 0; c < 3; c++) {
          const at = (r, g, b) => T[((b * N + g) * N + r) * 3 + c];
          const c00 = at(r0, g0, b0) * (1 - tr) + at(r1, g0, b0) * tr;
          const c10 = at(r0, g1, b0) * (1 - tr) + at(r1, g1, b0) * tr;
          const c01v = at(r0, g0, b1) * (1 - tr) + at(r1, g0, b1) * tr;
          const c11 = at(r0, g1, b1) * (1 - tr) + at(r1, g1, b1) * tr;
          const c0 = c00 * (1 - tg) + c10 * tg, c1 = c01v * (1 - tg) + c11 * tg;
          d[i + c] = (c0 * (1 - tb) + c1 * tb) * 255;
        }
      }
    };

    K.gradientMap = function (d, w, h, p) {
      const T = p.lut;
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        const v = Math.round(lum(d[i], d[i + 1], d[i + 2])) * 4;
        d[i] = T[v]; d[i + 1] = T[v + 1]; d[i + 2] = T[v + 2];
      }
    };

    K.selectiveColor = function (d, w, h, p) {
      const A = p.adj, rel = p.relative; // A[classe] = [c, m, y, k] em -1..1
      const keys = ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas', 'whites', 'neutrals', 'blacks'].filter((k) => A[k] && (A[k][0] || A[k][1] || A[k][2] || A[k][3]));
      if (!keys.length) return;
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), md = r + g + b - mx - mn;
        let cr = r, cg = g, cb = b;
        for (const key of keys) {
          let wt = 0;
          switch (key) {
            case 'reds': if (r === mx && r > mn) wt = mx - md; break;
            case 'yellows': if (b === mn && b < mx) wt = md - mn; break;
            case 'greens': if (g === mx && g > mn) wt = mx - md; break;
            case 'cyans': if (r === mn && r < mx) wt = md - mn; break;
            case 'blues': if (b === mx && b > mn) wt = mx - md; break;
            case 'magentas': if (g === mn && g < mx) wt = md - mn; break;
            case 'whites': wt = mn > 0.5 ? (mn - 0.5) * 2 : 0; break;
            case 'blacks': wt = mx < 0.5 ? (0.5 - mx) * 2 : 0; break;
            case 'neutrals': wt = c01(1 - Math.abs(mx - 0.5) - Math.abs(mn - 0.5)); break;
          }
          if (wt <= 0) continue;
          const a = A[key];
          const adj = (v, amt) => {
            let c = 1 - v;
            c = rel ? c + amt * (amt > 0 ? c : c) : c + amt;
            return 1 - c01(c);
          };
          cr = cr + (adj(cr, a[0]) - cr) * wt; cg = cg + (adj(cg, a[1]) - cg) * wt; cb = cb + (adj(cb, a[2]) - cb) * wt;
          const k = a[3];
          if (k > 0) { const f = 1 - k * wt; cr *= f; cg *= f; cb *= f; }
          else if (k < 0) { const f = -k * wt; cr += (1 - cr) * f; cg += (1 - cg) * f; cb += (1 - cb) * f; }
        }
        d[i] = cr * 255; d[i + 1] = cg * 255; d[i + 2] = cb * 255;
      }
    };

    K.equalize = function (d) {
      const hist = new Float64Array(256);
      let total = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] === 0) continue; hist[d[i]]++; hist[d[i + 1]]++; hist[d[i + 2]]++; total += 3; }
      if (!total) return;
      const lut = new Uint8ClampedArray(256);
      let acc = 0, first = 0;
      for (let v = 0; v < 256; v++) if (hist[v]) { first = hist[v]; break; }
      for (let v = 0; v < 256; v++) { acc += hist[v]; lut[v] = Math.round(((acc - first) / Math.max(1, total - first)) * 255); }
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] === 0) continue; d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
    };

    /** Tom/Contraste/Cor automáticos. p.mode = 'tone' | 'contrast' | 'color' */
    K.autoLevels = function (d, w, h, p) {
      const clip = p.clip == null ? 0.001 : p.clip;
      const H = [new Float64Array(256), new Float64Array(256), new Float64Array(256)];
      let n = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 8) continue; H[0][d[i]]++; H[1][d[i + 1]]++; H[2][d[i + 2]]++; n++; }
      if (!n) return;
      const ends = (hh) => {
        let acc = 0, lo = 0, hi = 255;
        for (let v = 0; v < 256; v++) { acc += hh[v]; if (acc > n * clip) { lo = v; break; } }
        acc = 0;
        for (let v = 255; v >= 0; v--) { acc += hh[v]; if (acc > n * clip) { hi = v; break; } }
        return [lo, Math.max(lo + 1, hi)];
      };
      let E;
      if (p.mode === 'contrast') {
        const all = new Float64Array(256);
        for (let v = 0; v < 256; v++) all[v] = (H[0][v] + H[1][v] + H[2][v]) / 3;
        const e = ends(all); E = [e, e, e];
      } else E = H.map(ends);
      const luts = E.map(([lo, hi]) => { const t = new Uint8ClampedArray(256); for (let v = 0; v < 256; v++) t[v] = ((v - lo) / (hi - lo)) * 255; return t; });
      if (p.mode === 'color') {
        // neutraliza os tons médios: leva a média de cada canal à média geral
        const mean = [0, 0, 0];
        for (let c = 0; c < 3; c++) { let s = 0; for (let v = 0; v < 256; v++) s += luts[c][v] * H[c][v]; mean[c] = s / n; }
        const target = (mean[0] + mean[1] + mean[2]) / 3;
        for (let c = 0; c < 3; c++) {
          const m = Math.min(0.98, Math.max(0.02, mean[c] / 255)), t = Math.min(0.98, Math.max(0.02, target / 255));
          const g = Math.log(t) / Math.log(m);
          for (let v = 0; v < 256; v++) luts[c][v] = Math.pow(luts[c][v] / 255, g) * 255;
        }
      }
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] === 0) continue; d[i] = luts[0][d[i]]; d[i + 1] = luts[1][d[i + 1]]; d[i + 2] = luts[2][d[i + 2]]; }
    };

    /** Luminância desfocada (Float32 0..1). */
    function blurLum(d, w, h, radius) {
      const n = w * h, a = new Float32Array(n), b = new Float32Array(n);
      for (let i = 0; i < n; i++) a[i] = lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) / 255;
      if (radius > 0.3 && K._gaussChannel) K._gaussChannel(a, b, w, h, radius);
      return a;
    }

    K.shadowsHighlights = function (d, w, h, p) {
      const sa = p.shadows || 0, ha = p.highlights || 0;
      const sw = Math.max(0.05, (p.shadowWidth == null ? 50 : p.shadowWidth) / 100), hw = Math.max(0.05, (p.highlightWidth == null ? 50 : p.highlightWidth) / 100);
      const colorCorr = p.color == null ? 0.2 : p.color, mid = p.midtone || 0;
      const B = blurLum(d, w, h, Math.max(0, p.radius == null ? 30 : p.radius) * 0.5);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        if (d[i + 3] === 0) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const L = lum(r, g, b) / 255, Lb = B[j];
        const ms = c01(1 - Lb / sw), mh = c01((Lb - (1 - hw)) / hw);
        let L2 = L;
        if (sa) L2 = L2 + sa * ms * ms * (1 - L2) * Math.min(1, L2 * 4 + 0.4);
        if (ha) L2 = L2 - ha * mh * mh * L2 * 0.9;
        if (mid) L2 = c01(0.5 + (L2 - 0.5) * (1 + mid));
        if (L > 0.001) {
          const k = L2 / L;
          let nr = r * k, ng = g * k, nb = b * k;
          const m = lum(nr, ng, nb), sat = 1 + colorCorr * (ms * sa - mh * ha * 0.5);
          nr = m + (nr - m) * sat; ng = m + (ng - m) * sat; nb = m + (nb - m) * sat;
          d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
        } else { d[i] = d[i + 1] = d[i + 2] = L2 * 255; }
      }
    };

    K.hdrToning = function (d, w, h, p) {
      const st = (p.strength == null ? 50 : p.strength) / 100, ex = Math.pow(2, p.exposure || 0), gam = 1 / Math.max(0.1, p.gamma || 1);
      const det = (p.detail || 0) / 100, vib = (p.vibrance || 0) / 100, sat = (p.saturation || 0) / 100;
      const B = blurLum(d, w, h, Math.max(1, p.radius || 30) * 0.5);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        if (d[i + 3] === 0) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const L = lum(r, g, b) / 255;
        let L2 = L + (L - B[j]) * (st * 2 + det);
        L2 = Math.pow(c01(L2 * ex), gam);
        let nr, ng, nb;
        if (L > 0.001) { const k = L2 / L; nr = r * k; ng = g * k; nb = b * k; } else nr = ng = nb = L2 * 255;
        const m = lum(nr, ng, nb), mx = Math.max(nr, ng, nb), mn = Math.min(nr, ng, nb), s0 = mx ? (mx - mn) / mx : 0;
        const f = Math.max(0, (1 + sat) * (1 + vib * (1 - s0)));
        d[i] = m + (nr - m) * f; d[i + 1] = m + (ng - m) * f; d[i + 2] = m + (nb - m) * f;
      }
    };

    K.replaceColor = function (d, w, h, p) {
      const [tr, tg, tb] = p.color, fz = Math.max(1, p.fuzz || 40) * 1.5;
      const t = [0, 0, 0], o = [0, 0, 0];
      const dh = p.h || 0, ds = (p.s || 0) / 100, dl = (p.l || 0) / 100;
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const dist = Math.sqrt((r - tr) * (r - tr) + (g - tg) * (g - tg) + (b - tb) * (b - tb));
        const wt = c01(1 - dist / fz);
        if (wt <= 0) continue;
        rgb2hsl(r, g, b, t);
        let s = t[1], l = t[2];
        s = ds >= 0 ? s + (1 - s) * ds : s * (1 + ds);
        l = dl >= 0 ? l + (1 - l) * dl : l * (1 + dl);
        hsl2rgb(t[0] + dh, c01(s), c01(l), o);
        d[i] = r + (o[0] - r) * wt; d[i + 1] = g + (o[1] - g) * wt; d[i + 2] = b + (o[2] - b) * wt;
      }
    };

    /** Mapa de seleção por intervalo de cores (para Selecionar › Intervalo de cores): saída no alfa. */
    K.colorRangeMask = function (d, w, h, p) {
      const cols = p.colors, fz = Math.max(1, p.fuzz || 40) * 1.5, mode = p.mode || 'sampled';
      const t = [0, 0, 0];
      for (let i = 0, n = d.length; i < n; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
        let v = 0;
        if (mode === 'sampled') {
          for (let k = 0; k < cols.length; k++) { const c = cols[k]; const dist = Math.sqrt((r - c[0]) * (r - c[0]) + (g - c[1]) * (g - c[1]) + (b - c[2]) * (b - c[2])); const wt = 1 - dist / fz; if (wt > v) v = wt; }
        } else if (mode === 'highlights') { v = (lum(r, g, b) - 170) / 60; }
        else if (mode === 'midtones') { v = 1 - Math.abs(lum(r, g, b) - 128) / 70; }
        else if (mode === 'shadows') { v = (85 - lum(r, g, b)) / 60; }
        else {
          rgb2hsl(r, g, b, t);
          const centers = { reds: 0, yellows: 60, greens: 120, cyans: 180, blues: 240, magentas: 300 };
          let dd = Math.abs(t[0] - centers[mode]); if (dd > 180) dd = 360 - dd;
          v = t[1] < 0.15 ? 0 : 1 - Math.max(0, dd - 15) / 30;
        }
        v = c01(v) * (a / 255);
        if (p.invert) v = 1 - v;
        d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = v * 255;
      }
    };
  });
})();
