/* ==========================================================================
   Imaginarium — núcleos dos filtros (menu Filtro)
   Funções puras (data RGBA, w, h, params) que alteram os pixels no lugar.
   Não podem referenciar nada fora desta função: também rodam no Web Worker.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG;
  IMG.kernelParts = IMG.kernelParts || [];

  IMG.kernelParts.push(function filterPart(K) {
    const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
    const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
    function rng(seed) { seed = seed >>> 0 || 1; return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    K._rng = rng;

    /* ---------- amostragem bilinear (alfa pré-multiplicado) ---------- */
    function sampler(src, w, h, edge) {
      // edge: 'clamp' | 'wrap' | 'transparent'
      const px = (x, y, o) => {
        if (edge === 'wrap') { x = ((x % w) + w) % w; y = ((y % h) + h) % h; }
        else if (x < 0 || y < 0 || x >= w || y >= h) {
          if (edge === 'transparent') { o[0] = o[1] = o[2] = o[3] = 0; return; }
          x = x < 0 ? 0 : x >= w ? w - 1 : x; y = y < 0 ? 0 : y >= h ? h - 1 : y;
        }
        const i = (y * w + x) * 4, a = src[i + 3];
        o[0] = src[i] * a; o[1] = src[i + 1] * a; o[2] = src[i + 2] * a; o[3] = a;
      };
      const p00 = [0, 0, 0, 0], p10 = [0, 0, 0, 0], p01 = [0, 0, 0, 0], p11 = [0, 0, 0, 0];
      return (x, y, out) => {
        x -= 0.5; y -= 0.5;
        const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
        px(x0, y0, p00); px(x0 + 1, y0, p10); px(x0, y0 + 1, p01); px(x0 + 1, y0 + 1, p11);
        for (let c = 0; c < 4; c++) out[c] = (p00[c] * (1 - tx) + p10[c] * tx) * (1 - ty) + (p01[c] * (1 - tx) + p11[c] * tx) * ty;
        return out;
      };
    }
    /** Mapeamento inverso: fn(x, y, out2) dá a origem (sx, sy) de cada pixel de destino. */
    function remap(d, w, h, fn, edge) {
      const src = new Uint8ClampedArray(d), S = sampler(src, w, h, edge || 'clamp');
      const o = [0, 0, 0, 0], q = [0, 0];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (fn(x + 0.5, y + 0.5, q) === false) continue;
        S(q[0], q[1], o);
        const i = (y * w + x) * 4;
        if (o[3] > 0) { d[i] = o[0] / o[3]; d[i + 1] = o[1] / o[3]; d[i + 2] = o[2] / o[3]; } else d[i] = d[i + 1] = d[i + 2] = 0;
        d[i + 3] = o[3];
      }
    }
    K._remap = remap; K._sampler = sampler;

    /* ---------- desfoque com alfa pré-multiplicado, usando funções do núcleo base ---------- */
    const gauss = (d, w, h, r) => K._gaussian(d, w, h, r);

    /* ======================= DESFOQUE ======================= */
    K.average = function (d) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const al = d[i + 3]; r += d[i] * al; g += d[i + 1] * al; b += d[i + 2] * al; a += al; n++; }
      if (!a) return;
      r /= a; g /= a; b /= a;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] === 0) continue; d[i] = r; d[i + 1] = g; d[i + 2] = b; }
    };
    K.blurSimple = function (d, w, h, p) { gauss(d, w, h, p && p.radius ? p.radius : 0.8); };
    K.boxBlur = function (d, w, h, p) {
      const r = Math.max(1, Math.round(p.radius || 1)), n = w * h;
      const al = new Float32Array(n), a = new Float32Array(n), b = new Float32Array(n);
      for (let i = 0; i < n; i++) al[i] = d[i * 4 + 3];
      const alS = al.slice();
      K._boxH(al, b, w, h, r); K._boxV(b, al, w, h, r);
      for (let c = 0; c < 3; c++) {
        for (let i = 0; i < n; i++) a[i] = (d[i * 4 + c] * alS[i]) / 255;
        K._boxH(a, b, w, h, r); K._boxV(b, a, w, h, r);
        for (let i = 0; i < n; i++) { const av = al[i]; d[i * 4 + c] = av > 0.001 ? (a[i] * 255) / av : 0; }
      }
      for (let i = 0; i < n; i++) d[i * 4 + 3] = al[i];
    };
    /** Desfoque de lente: disco (bokeh) com realces especulares. */
    K.lensBlur = function (d, w, h, p) {
      const R = Math.max(1, p.radius || 10), N = Math.min(96, Math.max(16, Math.round(R * 2.5)));
      const thr = p.threshold == null ? 255 : p.threshold, bright = (p.brightness || 0) / 100;
      const src = new Float32Array(d.length);
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3] / 255; let r = d[i], g = d[i + 1], b = d[i + 2];
        if (bright > 0 && lum(r, g, b) >= thr) { const k = 1 + bright * 4; r *= k; g *= k; b *= k; }
        src[i] = r * a; src[i + 1] = g * a; src[i + 2] = b * a; src[i + 3] = a;
      }
      const ox = [], oy = [];
      const blades = p.blades || 0, rot = ((p.rotation || 0) * Math.PI) / 180;
      for (let k = 0; k < N; k++) {
        const t = Math.sqrt((k + 0.5) / N), a = k * 2.39996323 + rot;
        let rr = t * R;
        if (blades >= 3) { const seg = (Math.PI * 2) / blades, aa = ((a - rot) % seg + seg) % seg - seg / 2; rr *= Math.cos(seg / 2) / Math.cos(aa); }
        ox.push(Math.round(Math.cos(a) * rr)); oy.push(Math.round(Math.sin(a) * rr));
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let k = 0; k < N; k++) {
          let sx = x + ox[k], sy = y + oy[k];
          if (sx < 0) sx = 0; else if (sx >= w) sx = w - 1;
          if (sy < 0) sy = 0; else if (sy >= h) sy = h - 1;
          const j = (sy * w + sx) * 4;
          r += src[j]; g += src[j + 1]; b += src[j + 2]; a += src[j + 3];
        }
        const i = (y * w + x) * 4;
        if (a > 0) { d[i] = r / a; d[i + 1] = g / a; d[i + 2] = b / a; }
        d[i + 3] = (a / N) * 255;
      }
      if (p.noise) { const rn = rng(7); for (let i = 0; i < d.length; i += 4) { const v = (rn() - 0.5) * p.noise * 2.55; d[i] += v; d[i + 1] += v; d[i + 2] += v; } }
    };
    K.radialBlur = function (d, w, h, p) {
      const amt = (p.amount || 10) / 100, cx = (p.cx == null ? 0.5 : p.cx) * w, cy = (p.cy == null ? 0.5 : p.cy) * h;
      const S = sampler(new Uint8ClampedArray(d), w, h, 'clamp');
      const N = p.quality === 'draft' ? 12 : p.quality === 'best' ? 48 : 28, o = [0, 0, 0, 0];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        let r = 0, g = 0, b = 0, a = 0;
        if (p.method === 'zoom') {
          for (let k = 0; k < N; k++) { const s = 1 - (k / N) * amt * 0.6; S(cx + dx * s, cy + dy * s, o); r += o[0]; g += o[1]; b += o[2]; a += o[3]; }
        } else {
          const ang = amt * 0.6, rad = Math.hypot(dx, dy), a0 = Math.atan2(dy, dx);
          for (let k = 0; k < N; k++) { const t = a0 + (k / (N - 1) - 0.5) * ang; S(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad, o); r += o[0]; g += o[1]; b += o[2]; a += o[3]; }
        }
        const i = (y * w + x) * 4;
        if (a > 0) { d[i] = r / a; d[i + 1] = g / a; d[i + 2] = b / a; }
        d[i + 3] = a / N;
      }
    };
    /** Desfoque que preserva bordas (bilateral separável): Desfoque inteligente / de superfície. */
    function bilateral(d, w, h, radius, thr, edgeMode) {
      radius = Math.max(1, Math.min(40, Math.round(radius)));
      const src = new Float32Array(d.length);
      for (let i = 0; i < d.length; i++) src[i] = d[i];
      const tmp = new Float32Array(d.length);
      const inv = 1 / Math.max(1, thr * 2.5);
      const pass = (S, T, horiz) => {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const r0 = S[i], g0 = S[i + 1], b0 = S[i + 2];
          let r = 0, g = 0, b = 0, ws = 0;
          for (let k = -radius; k <= radius; k++) {
            let xx = horiz ? x + k : x, yy = horiz ? y : y + k;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = (yy * w + xx) * 4;
            const diff = (Math.abs(S[j] - r0) + Math.abs(S[j + 1] - g0) + Math.abs(S[j + 2] - b0)) / 3;
            let wt = 1 - diff * inv;
            if (wt <= 0) continue;
            wt *= S[j + 3] / 255 + 0.001;
            r += S[j] * wt; g += S[j + 1] * wt; b += S[j + 2] * wt; ws += wt;
          }
          if (ws > 0) { T[i] = r / ws; T[i + 1] = g / ws; T[i + 2] = b / ws; } else { T[i] = r0; T[i + 1] = g0; T[i + 2] = b0; }
          T[i + 3] = S[i + 3];
        }
      };
      pass(src, tmp, true); pass(tmp, src, false);
      if (edgeMode) {
        // modo "somente bordas" / "sobrepor bordas" do Desfoque inteligente
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const e = x > 0 && y > 0 ? Math.abs(src[i] - src[i - 4]) + Math.abs(src[i] - src[i - w * 4]) : 0;
          const edge = e > thr * 0.6;
          if (edgeMode === 'edgeOnly') { d[i] = d[i + 1] = d[i + 2] = edge ? 255 : 0; }
          else { d[i] = edge ? 255 : src[i]; d[i + 1] = edge ? 255 : src[i + 1]; d[i + 2] = edge ? 255 : src[i + 2]; }
        }
        return;
      }
      for (let i = 0; i < d.length; i += 4) { d[i] = src[i]; d[i + 1] = src[i + 1]; d[i + 2] = src[i + 2]; }
    }
    K.smartBlur = function (d, w, h, p) { bilateral(d, w, h, p.radius || 3, p.threshold || 25, p.mode === 'normal' ? null : p.mode); };
    K.surfaceBlur = function (d, w, h, p) { bilateral(d, w, h, p.radius || 5, p.threshold || 15, null); };

    /** Desfoque variável por mapa (Galeria de desfoque). p.map: Float32Array 0..1 (fração do raio). */
    K.variableBlur = function (d, w, h, p) {
      const R = Math.max(0.5, p.radius || 15), map = p.map;
      const levels = [0, R / 6, R / 3, R / 1.6, R].map((r) => { const c = new Uint8ClampedArray(d); if (r > 0.3) gauss(c, w, h, r); return c; });
      const L = levels.length - 1;
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        const t = Math.max(0, Math.min(1, map[j])) * L, k = Math.min(L - 1, Math.floor(t)), f = t - k;
        const A = levels[k], B = levels[k + 1];
        for (let c = 0; c < 4; c++) d[i + c] = A[i + c] + (B[i + c] - A[i + c]) * f;
      }
    };

    /* ======================= DISTORÇÃO ======================= */
    K.pinch = function (d, w, h, p) {
      const amt = -(p.amount || 0) / 100, cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;
      remap(d, w, h, (x, y, q) => {
        const dx = (x - cx) / R, dy = (y - cy) / R, r = Math.hypot(dx, dy);
        if (r >= 1 || r === 0) { q[0] = x; q[1] = y; return; }
        const f = Math.pow(Math.sin((Math.PI / 2) * r), amt < 0 ? -amt * 1.5 + 1 : 1 / (amt * 1.5 + 1));
        const s = amt < 0 ? f / r : f / r;
        q[0] = cx + dx * s * R; q[1] = cy + dy * s * R;
      });
    };
    K.spherize = function (d, w, h, p) {
      const amt = (p.amount || 0) / 100, mode = p.mode || 'normal', cx = w / 2, cy = h / 2;
      const rx = w / 2, ry = h / 2;
      remap(d, w, h, (x, y, q) => {
        let dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (mode === 'horizontal') dy = 0; else if (mode === 'vertical') dx = 0;
        const r = Math.hypot(dx, dy);
        q[0] = x; q[1] = y;
        if (r >= 1 || r === 0) return;
        const r2 = amt >= 0 ? Math.pow(r, 1 + amt * 0.9) * (1 - amt * 0.0) : Math.pow(r, 1 / (1 - amt * 0.9));
        const k = r2 / r;
        if (mode !== 'vertical') q[0] = cx + ((x - cx) / rx) * k * rx;
        if (mode !== 'horizontal') q[1] = cy + ((y - cy) / ry) * k * ry;
      });
    };
    K.twirl = function (d, w, h, p) {
      const ang = ((p.angle || 0) * Math.PI) / 180, cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;
      remap(d, w, h, (x, y, q) => {
        const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
        if (r >= R) { q[0] = x; q[1] = y; return; }
        const t = ang * (1 - r / R), c = Math.cos(t), s = Math.sin(t);
        q[0] = cx + dx * c - dy * s; q[1] = cy + dx * s + dy * c;
      });
    };
    K.ripple = function (d, w, h, p) {
      const amt = (p.amount || 100) / 100, wl = p.size === 'small' ? 6 : p.size === 'large' ? 24 : 12;
      remap(d, w, h, (x, y, q) => { q[0] = x + Math.sin((y / wl) * Math.PI * 2) * amt * 3; q[1] = y + Math.sin((x / wl) * Math.PI * 2) * amt * 3; });
    };
    K.wave = function (d, w, h, p) {
      const n = Math.max(1, Math.min(10, p.generators || 5)), rn = rng(p.seed || 11);
      const gens = [];
      for (let i = 0; i < n; i++) {
        const wl = p.wlMin + rn() * (p.wlMax - p.wlMin), amp = p.ampMin + rn() * (p.ampMax - p.ampMin);
        gens.push({ wl: Math.max(1, wl), amp, ph: rn() * Math.PI * 2, ang: rn() * Math.PI });
      }
      const shape = (t) => { if (p.type === 'triangle') { const f = t / (Math.PI * 2); return 4 * Math.abs(f - Math.floor(f + 0.5)) - 1; } if (p.type === 'square') return Math.sin(t) >= 0 ? 1 : -1; return Math.sin(t); };
      const sx = (p.scaleH == null ? 100 : p.scaleH) / 100, sy = (p.scaleV == null ? 100 : p.scaleV) / 100;
      remap(d, w, h, (x, y, q) => {
        let ox = 0, oy = 0;
        for (const g of gens) { ox += shape((y / g.wl) * Math.PI * 2 + g.ph) * g.amp / n; oy += shape((x / g.wl) * Math.PI * 2 + g.ph + g.ang) * g.amp / n; }
        q[0] = x + ox * sx; q[1] = y + oy * sy;
      }, p.undefined === 'wrap' ? 'wrap' : 'clamp');
    };
    K.zigzag = function (d, w, h, p) {
      const amt = (p.amount || 10) / 100, ridges = Math.max(1, p.ridges || 5), cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;
      remap(d, w, h, (x, y, q) => {
        const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
        if (r >= R || r === 0) { q[0] = x; q[1] = y; return; }
        const off = Math.sin((r / R) * Math.PI * ridges) * amt * 20 * (1 - r / R);
        if (p.style === 'around') { const t = off / Math.max(1, r); const c = Math.cos(t), s = Math.sin(t); q[0] = cx + dx * c - dy * s; q[1] = cy + dx * s + dy * c; }
        else { const k = (r + off) / r; q[0] = cx + dx * k; q[1] = cy + dy * k; }
      });
    };
    K.polar = function (d, w, h, p) {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;
      if (p.mode === 'polarToRect') {
        remap(d, w, h, (x, y, q) => { const a = (x / w) * Math.PI * 2 - Math.PI / 2, r = (1 - y / h) * R; q[0] = cx + Math.cos(a) * r; q[1] = cy + Math.sin(a) * r; });
      } else {
        remap(d, w, h, (x, y, q) => { const dx = x - cx, dy = y - cy; let a = Math.atan2(dy, dx) + Math.PI / 2; if (a < 0) a += Math.PI * 2; q[0] = (a / (Math.PI * 2)) * w; q[1] = h - (Math.hypot(dx, dy) / R) * h; }, 'clamp');
      }
    };
    K.shear = function (d, w, h, p) {
      const lut = p.lut; // deslocamento (−1..1) por linha, 256 posições
      remap(d, w, h, (x, y, q) => { const t = lut[Math.min(255, Math.floor((y / h) * 256))]; q[0] = x - t * w * 0.5; q[1] = y; }, p.undefined === 'wrap' ? 'wrap' : 'clamp');
    };
    K.displace = function (d, w, h, p) {
      const M = p.map, mw = p.mw, mh = p.mh, sx = (p.hScale || 10) / 100 * w * 0.5, sy = (p.vScale || 10) / 100 * h * 0.5;
      remap(d, w, h, (x, y, q) => {
        let mx, my;
        if (p.tile) { mx = Math.floor(x) % mw; my = Math.floor(y) % mh; }
        else { mx = Math.min(mw - 1, Math.floor((x / w) * mw)); my = Math.min(mh - 1, Math.floor((y / h) * mh)); }
        const j = (my * mw + mx) * 4;
        q[0] = x + ((M[j] - 128) / 128) * sx; q[1] = y + ((M[j + 1] - 128) / 128) * sy;
      }, p.wrap ? 'wrap' : 'clamp');
    };
    K.glass = function (d, w, h, p) {
      const dist = p.distortion || 5, sm = p.smoothness || 3, n = w * h;
      const rn = rng(5), f = new Float32Array(n);
      const cell = Math.max(2, sm * 3);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) f[y * w + x] = Math.sin(x / cell * 1.7 + Math.sin(y / cell)) + Math.cos(y / cell * 1.3 + Math.cos(x / cell * 0.7)) + rn() * 0.1;
      remap(d, w, h, (x, y, q) => { const i = Math.min(n - 1, Math.floor(y) * w + Math.floor(x)); const gx = (f[Math.min(n - 1, i + 1)] - f[Math.max(0, i - 1)]), gy = (f[Math.min(n - 1, i + w)] - f[Math.max(0, i - w)]); q[0] = x + gx * dist; q[1] = y + gy * dist; });
    };
    K.oceanRipple = function (d, w, h, p) {
      const size = Math.max(2, p.size || 9), mag = p.magnitude || 9;
      remap(d, w, h, (x, y, q) => { q[0] = x + Math.sin(y / size * 2.1 + Math.cos(x / size * 1.3)) * mag * 0.6; q[1] = y + Math.cos(x / size * 1.9 + Math.sin(y / size * 0.9)) * mag * 0.6; });
    };
    /** Malha de deslocamento genérica (Liquify, Correção de lente, Dobra de perspectiva). p.dx/p.dy: Float32 por pixel. */
    K.displaceField = function (d, w, h, p) {
      const DX = p.dx, DY = p.dy, fw = p.fw || w, fh = p.fh || h;
      const sx = fw / w, sy = fh / h;
      remap(d, w, h, (x, y, q) => {
        const fx = Math.min(fw - 1, Math.floor(x * sx)), fy = Math.min(fh - 1, Math.floor(y * sy)), j = fy * fw + fx;
        q[0] = x + DX[j] / sx; q[1] = y + DY[j] / sy;
      }, p.edge || 'transparent');
    };
    K.lensCorrection = function (d, w, h, p) {
      const k = -(p.distortion || 0) / 100 * 0.5, cx = w / 2, cy = h / 2, R = Math.hypot(cx, cy);
      const ang = ((p.angle || 0) * Math.PI) / 180, sc = 100 / Math.max(1, p.scale || 100);
      const vp = (p.vPersp || 0) / 100, hp = (p.hPersp || 0) / 100;
      const ca = [(p.caRC || 0) / 100, 0, (p.caBY || 0) / 100];
      const src = new Uint8ClampedArray(d), S = sampler(src, w, h, 'transparent'), o = [0, 0, 0, 0];
      const vig = (p.vignette || 0) / 100, mid = (p.vigMid == null ? 50 : p.vigMid) / 100;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let dx = (x + 0.5 - cx) * sc, dy = (y + 0.5 - cy) * sc;
        const c = Math.cos(ang), s = Math.sin(ang);
        let rx = dx * c - dy * s, ry = dx * s + dy * c;
        const pz = 1 + vp * (ry / cy) * 0.5 + hp * (rx / cx) * 0.5;
        rx /= pz; ry /= pz;
        const r = Math.hypot(rx, ry) / R;
        const i = (y * w + x) * 4;
        let ar = 0;
        for (let ch = 0; ch < 3; ch++) {
          const f = 1 + k * r * r + ca[ch] * 0.01 * r;
          S(cx + rx * f, cy + ry * f, o);
          d[i + ch] = o[3] > 0 ? o[ch] / o[3] : 0;
          if (ch === 1) ar = o[3];
        }
        d[i + 3] = ar;
        if (vig) {
          const rr = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / R;
          const t = Math.max(0, (rr - mid * 0.6) / (1 - mid * 0.6));
          const f = 1 + vig * t * t * 1.4;
          d[i] *= f; d[i + 1] *= f; d[i + 2] *= f;
        }
      }
    };

    /* ======================= RUÍDO ======================= */
    K.noise = function (d, w, h, p) {
      const amt = ((p.amount || 0) / 100) * 255, mono = !!p.mono, gaussian = p.dist === 'gaussian';
      const rn = rng(p.seed || 1337);
      const r1 = gaussian ? () => { let u = 0, v = 0; while (u === 0) u = rn(); v = rn(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * 0.5; } : () => rn() - 0.5;
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        if (mono) { const v = r1() * 2 * amt; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
        else { d[i] += r1() * 2 * amt; d[i + 1] += r1() * 2 * amt; d[i + 2] += r1() * 2 * amt; }
      }
    };
    /** Mediana por canal (janela quadrada), com histograma deslizante. */
    function median(d, w, h, r) {
      r = Math.max(1, Math.min(50, Math.round(r)));
      const src = new Uint8ClampedArray(d);
      const hist = new Uint32Array(256 * 3);
      for (let y = 0; y < h; y++) {
        hist.fill(0);
        let cnt = 0;
        const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
        const addCol = (x, s) => { if (x < 0 || x >= w) return; for (let yy = y0; yy <= y1; yy++) { const j = (yy * w + x) * 4; hist[src[j]] += s; hist[256 + src[j + 1]] += s; hist[512 + src[j + 2]] += s; cnt += s; } };
        for (let x = -r; x < r; x++) addCol(x, 1);
        for (let x = 0; x < w; x++) {
          addCol(x + r, 1);
          if (x - r - 1 >= 0) addCol(x - r - 1, -1);
          const half = cnt / 2, i = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) { let acc = 0, v = 0; const base = c * 256; for (; v < 256; v++) { acc += hist[base + v]; if (acc >= half) break; } d[i + c] = v; }
        }
      }
    }
    K.median = function (d, w, h, p) { median(d, w, h, p.radius || 1); };
    K.dustScratches = function (d, w, h, p) {
      const src = new Uint8ClampedArray(d); median(d, w, h, p.radius || 1);
      const thr = p.threshold || 0;
      for (let i = 0; i < d.length; i += 4) { const diff = (Math.abs(d[i] - src[i]) + Math.abs(d[i + 1] - src[i + 1]) + Math.abs(d[i + 2] - src[i + 2])) / 3; if (diff < thr) { d[i] = src[i]; d[i + 1] = src[i + 1]; d[i + 2] = src[i + 2]; } }
    };
    K.despeckle = function (d, w, h) {
      const src = new Uint8ClampedArray(d); median(d, w, h, 1);
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        const e = Math.abs(lum(src[i - 4], src[i - 3], src[i - 2]) - lum(src[i + 4], src[i + 5], src[i + 6])) + Math.abs(lum(src[i - w * 4], src[i - w * 4 + 1], src[i - w * 4 + 2]) - lum(src[i + w * 4], src[i + w * 4 + 1], src[i + w * 4 + 2]));
        if (e > 60) { d[i] = src[i]; d[i + 1] = src[i + 1]; d[i + 2] = src[i + 2]; }
      }
    };
    K.reduceNoise = function (d, w, h, p) {
      const st = (p.strength == null ? 6 : p.strength), keep = (p.preserve == null ? 60 : p.preserve) / 100, col = (p.color == null ? 45 : p.color) / 100, sh = (p.sharpen || 25) / 100;
      const src = new Uint8ClampedArray(d);
      bilateral(d, w, h, 1 + st * 0.6, 4 + st * 5 * (1 - keep * 0.7), null);
      if (col > 0) {
        // desfoca a crominância
        const n = w * h, cb = new Float32Array(n), cr = new Float32Array(n), t = new Float32Array(n);
        for (let i = 0; i < n; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; const Y = lum(r, g, b); cb[i] = b - Y; cr[i] = r - Y; }
        K._gaussChannel(cb, t, w, h, 1 + col * 4); K._gaussChannel(cr, t, w, h, 1 + col * 4);
        for (let i = 0; i < n; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; const Y = lum(r, g, b); const R = Y + cr[i], B = Y + cb[i]; const G = (Y - 0.299 * R - 0.114 * B) / 0.587; d[i * 4] = R; d[i * 4 + 1] = G; d[i * 4 + 2] = B; }
      }
      if (sh > 0) { const bl = new Uint8ClampedArray(d); gauss(bl, w, h, 1); for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = d[i + c] + (d[i + c] - bl[i + c]) * sh; }
      void src;
    };

    /* ======================= PIXELIZAÇÃO ======================= */
    function voronoi(d, w, h, cell, seed, pointillize, bgCol) {
      const src = new Uint8ClampedArray(d), rn = rng(seed || 3);
      const gw = Math.ceil(w / cell) + 1, gh = Math.ceil(h / cell) + 1, P = new Float32Array(gw * gh * 2);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const k = (j * gw + i) * 2; P[k] = (i + rn()) * cell; P[k + 1] = (j + rn()) * cell; }
      const colAt = (x, y) => { const xx = Math.min(w - 1, Math.max(0, Math.floor(x))), yy = Math.min(h - 1, Math.max(0, Math.floor(y))); return (yy * w + xx) * 4; };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const gi = Math.floor(x / cell), gj = Math.floor(y / cell);
        let best = 1e18, bk = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = gi + di, jj = gj + dj; if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
          const k = (jj * gw + ii) * 2, dx = P[k] - x, dy = P[k + 1] - y, dd = dx * dx + dy * dy;
          if (dd < best) { best = dd; bk = k; }
        }
        const i = (y * w + x) * 4;
        if (pointillize && Math.sqrt(best) > cell * 0.45) { d[i] = bgCol[0]; d[i + 1] = bgCol[1]; d[i + 2] = bgCol[2]; d[i + 3] = 255; continue; }
        const j = colAt(P[bk], P[bk + 1]);
        d[i] = src[j]; d[i + 1] = src[j + 1]; d[i + 2] = src[j + 2]; d[i + 3] = src[j + 3];
      }
    }
    K.crystallize = function (d, w, h, p) { voronoi(d, w, h, Math.max(3, p.size || 10), 3, false); };
    K.pointillize = function (d, w, h, p) { voronoi(d, w, h, Math.max(3, p.size || 6), 9, true, p.bg || [255, 255, 255]); };
    K.fragment = function (d, w, h) {
      const src = new Uint8ClampedArray(d), offs = [[-4, -4], [4, -4], [-4, 4], [4, 4]];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4; const acc = [0, 0, 0, 0];
        for (const [ox, oy] of offs) { const xx = Math.min(w - 1, Math.max(0, x + ox)), yy = Math.min(h - 1, Math.max(0, y + oy)), j = (yy * w + xx) * 4; acc[0] += src[j]; acc[1] += src[j + 1]; acc[2] += src[j + 2]; acc[3] += src[j + 3]; }
        d[i] = acc[0] / 4; d[i + 1] = acc[1] / 4; d[i + 2] = acc[2] / 4; d[i + 3] = acc[3] / 4;
      }
    };
    K.facet = function (d, w, h) { median(d, w, h, 2); const src = new Uint8ClampedArray(d); for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = Math.round(src[i + c] / 12) * 12; };
    K.colorHalftone = function (d, w, h, p) {
      const R = Math.max(4, p.radius || 8), angs = [p.a1 == null ? 108 : p.a1, p.a2 == null ? 162 : p.a2, p.a3 == null ? 90 : p.a3].map((a) => (a * Math.PI) / 180);
      const src = new Uint8ClampedArray(d), cell = R * 2;
      for (let c = 0; c < 3; c++) {
        const ca = Math.cos(angs[c]), sa = Math.sin(angs[c]);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const u = x * ca + y * sa, v = -x * sa + y * ca;
          const cu = (Math.floor(u / cell) + 0.5) * cell, cv = (Math.floor(v / cell) + 0.5) * cell;
          const sx = cu * ca - cv * sa, sy = cu * sa + cv * ca;
          const xx = Math.min(w - 1, Math.max(0, Math.round(sx))), yy = Math.min(h - 1, Math.max(0, Math.round(sy)));
          const val = 1 - src[(yy * w + xx) * 4 + c] / 255; // quantidade de tinta (CMY)
          const dist = Math.hypot(u - cu, v - cv) / R;
          const ink = dist < Math.sqrt(val) * 1.41 ? 1 : 0;
          d[(y * w + x) * 4 + c] = 255 * (1 - ink);
        }
      }
    };
    K.mezzotint = function (d, w, h, p) {
      const rn = rng(13), type = p.type || 'fine';
      const dots = { fine: 1, medium: 2, grainy: 1, coarse: 3 }[type];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          let t;
          if (dots) { const cx = Math.floor(x / dots), cy = Math.floor(y / dots); t = ((Math.imul(cx * 73856093 ^ cy * 19349663, 83492791) >>> 0) % 1000) / 1000; if (type === 'grainy') t = rn(); }
          else { const len = type === 'shortLines' ? 4 : type === 'mediumLines' ? 10 : type === 'longLines' ? 24 : 6; t = ((Math.imul(Math.floor(x / len) * 73856093 ^ y * 19349663, 83492791) >>> 0) % 1000) / 1000; }
          d[i + c] = d[i + c] / 255 > t ? 255 : 0;
        }
      }
    };

    /* ======================= ACABAMENTO (RENDER) ======================= */
    function noise2(seed) {
      const perm = new Uint8Array(512), rn = rng(seed);
      for (let i = 0; i < 256; i++) perm[i] = i;
      for (let i = 255; i > 0; i--) { const j = Math.floor(rn() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
      for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
      const grad = (h, x, y) => { const g = h & 7; const u = g < 4 ? x : y, v = g < 4 ? y : x; return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v); };
      const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
      return (x, y) => {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
        const u = fade(x), v = fade(y), a = perm[X] + Y, b = perm[X + 1] + Y;
        const l1 = grad(perm[a], x, y) + u * (grad(perm[b], x - 1, y) - grad(perm[a], x, y));
        const l2 = grad(perm[a + 1], x, y - 1) + u * (grad(perm[b + 1], x - 1, y - 1) - grad(perm[a + 1], x, y - 1));
        return (l1 + v * (l2 - l1)) * 0.25 + 0.5;
      };
    }
    K._noise2 = noise2;
    K.clouds = function (d, w, h, p) {
      const n = noise2(p.seed || 17), fg = p.fg, bg = p.bg, base = Math.max(w, h) / 3;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let v = 0, amp = 0.5, f = 1 / base;
        for (let o = 0; o < 8; o++) { v += n(x * f, y * f) * amp; amp *= 0.5; f *= 2; }
        v = Math.max(0, Math.min(1, (v - 0.5) * 1.6 + 0.5));
        const i = (y * w + x) * 4, s = p.diff ? [d[i], d[i + 1], d[i + 2]] : null;
        const r = bg[0] + (fg[0] - bg[0]) * v, g = bg[1] + (fg[1] - bg[1]) * v, b = bg[2] + (fg[2] - bg[2]) * v;
        if (s) { d[i] = Math.abs(s[0] - r); d[i + 1] = Math.abs(s[1] - g); d[i + 2] = Math.abs(s[2] - b); }
        else { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
      }
    };
    K.fibers = function (d, w, h, p) {
      const n = noise2(p.seed || 23), fg = p.fg, bg = p.bg, varc = (p.variance || 16) / 64, str = (p.strength || 4) / 64;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let v = n(x * varc * 0.3, y * str * 0.02) * 0.7 + n(x * varc, y * str * 0.1) * 0.3;
        v = Math.max(0, Math.min(1, v));
        const i = (y * w + x) * 4;
        d[i] = bg[0] + (fg[0] - bg[0]) * v; d[i + 1] = bg[1] + (fg[1] - bg[1]) * v; d[i + 2] = bg[2] + (fg[2] - bg[2]) * v; d[i + 3] = 255;
      }
    };
    K.lensFlare = function (d, w, h, p) {
      const cx = (p.cx == null ? 0.3 : p.cx) * w, cy = (p.cy == null ? 0.3 : p.cy) * h, br = (p.brightness || 100) / 100;
      const ox = w / 2, oy = h / 2, R = Math.hypot(w, h);
      const rings = [[0, 0.06, [255, 250, 230], 1.0], [0.35, 0.02, [140, 200, 255], 0.35], [0.6, 0.05, [255, 180, 120], 0.25], [0.9, 0.035, [180, 255, 180], 0.3], [1.25, 0.08, [255, 120, 160], 0.2], [1.5, 0.02, [255, 255, 200], 0.4]];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let r = 0, g = 0, b = 0;
        const dd = Math.hypot(x - cx, y - cy) / R;
        const core = Math.exp(-dd * dd * 900) * 1.4 + Math.exp(-dd * 25) * 0.5;
        const streak = Math.exp(-Math.abs(y - cy) / R * 400) * Math.exp(-Math.abs(x - cx) / R * 6) * 0.5;
        r += (core + streak) * 255; g += (core + streak) * 245; b += (core + streak) * 230;
        for (const [t, rad, col, a] of rings) {
          const px = cx + (ox - cx) * t * (p.type === 'prime' ? 1.2 : 1), py = cy + (oy - cy) * t;
          const dr = Math.hypot(x - px, y - py) / R;
          const ring = p.type === '35mm' ? Math.exp(-Math.pow((dr - rad) * 120, 2)) : Math.max(0, 1 - dr / rad) * 0.6 + Math.exp(-Math.pow((dr - rad) * 160, 2)) * 0.4;
          r += col[0] * ring * a; g += col[1] * ring * a; b += col[2] * ring * a;
        }
        d[i] = d[i] + (255 - d[i]) * Math.min(1, (r * br) / 255);
        d[i + 1] = d[i + 1] + (255 - d[i + 1]) * Math.min(1, (g * br) / 255);
        d[i + 2] = d[i + 2] + (255 - d[i + 2]) * Math.min(1, (b * br) / 255);
      }
    };
    K.lighting = function (d, w, h, p) {
      const lx0 = (p.lx == null ? 0.3 : p.lx) * w, ly0 = (p.ly == null ? 0.3 : p.ly) * h;
      const inten = (p.intensity == null ? 35 : p.intensity) / 50, amb = (p.ambience == null ? 8 : p.ambience) / 100, hgt = (p.height || 50) / 25;
      const col = p.color || [255, 255, 255], R = Math.max(w, h) * (p.radius || 60) / 100;
      const src = new Uint8ClampedArray(d), H = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) H[i] = lum(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]) / 255;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let nx = 0, ny = 0;
        if (p.texture) { nx = (H[Math.min(w * h - 1, i + 1)] - H[Math.max(0, i - 1)]) * hgt; ny = (H[Math.min(w * h - 1, i + w)] - H[Math.max(0, i - w)]) * hgt; }
        let lx, ly, lz, att;
        if (p.type === 'infinite') { lx = Math.cos(p.angle || 0.8); ly = Math.sin(p.angle || 0.8); lz = 0.6; att = 1; }
        else { lx = lx0 - x; ly = ly0 - y; lz = R * 0.6; const dist = Math.hypot(lx, ly); att = p.type === 'spot' ? Math.max(0, 1 - dist / R) : Math.max(0, 1 - dist / (R * 1.6)); }
        const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
        const nl = Math.hypot(-nx, -ny, 1);
        const diff = Math.max(0, (-nx * lx - ny * ly + lz) / nl);
        const k = amb + diff * att * inten;
        const j = i * 4;
        d[j] = src[j] * k * col[0] / 255; d[j + 1] = src[j + 1] * k * col[1] / 255; d[j + 2] = src[j + 2] * k * col[2] / 255;
      }
    };

    /* ======================= NITIDEZ ======================= */
    K.sharpen = function (d, w, h, p) {
      const amount = (p.amount == null ? 100 : p.amount) / 100, radius = Math.max(0.1, p.radius || 1), thr = p.threshold || 0;
      const blur = new Uint8ClampedArray(d);
      gauss(blur, w, h, radius);
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        if (thr > 0) { const diff = Math.abs(lum(d[i], d[i + 1], d[i + 2]) - lum(blur[i], blur[i + 1], blur[i + 2])); if (diff < thr) continue; }
        d[i] = d[i] + (d[i] - blur[i]) * amount;
        d[i + 1] = d[i + 1] + (d[i + 1] - blur[i + 1]) * amount;
        d[i + 2] = d[i + 2] + (d[i + 2] - blur[i + 2]) * amount;
      }
    };
    K.smartSharpen = function (d, w, h, p) {
      const amt = (p.amount || 100) / 100, rad = Math.max(0.1, p.radius || 1), nr = (p.reduceNoise || 0) / 100;
      const src = new Uint8ClampedArray(d);
      if (nr > 0) bilateral(src, w, h, 2, 6 + nr * 30, null);
      const blur = new Uint8ClampedArray(src);
      if (p.remove === 'motion') { const ang = ((p.angle || 0) * Math.PI) / 180; const dx = Math.cos(ang), dy = Math.sin(ang); const S = sampler(new Uint8ClampedArray(src), w, h, 'clamp'), o = [0, 0, 0, 0]; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let r = 0, g = 0, b = 0, a = 0; const N = Math.max(2, Math.round(rad * 2)); for (let k = 0; k < N; k++) { const t = (k / (N - 1) - 0.5) * rad * 2; S(x + 0.5 + dx * t, y + 0.5 + dy * t, o); r += o[0]; g += o[1]; b += o[2]; a += o[3]; } const i = (y * w + x) * 4; if (a) { blur[i] = r / a; blur[i + 1] = g / a; blur[i + 2] = b / a; } } }
      else gauss(blur, w, h, p.remove === 'lens' ? rad * 0.7 : rad);
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] === 0) continue; for (let c = 0; c < 3; c++) d[i + c] = src[i + c] + (src[i + c] - blur[i + c]) * amt; }
    };

    /* ======================= ESTILIZAÇÃO ======================= */
    K.solarize = function (d) { for (let i = 0; i < d.length; i += 4) { for (let c = 0; c < 3; c++) if (d[i + c] > 127) d[i + c] = 255 - d[i + c]; } };
    K.diffuse = function (d, w, h, p) {
      const src = new Uint8ClampedArray(d), rn = rng(31), mode = p.mode || 'normal';
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let xx, yy;
        if (mode === 'anisotropic') { const gx = x > 0 && x < w - 1 ? lum(src[(y * w + x + 1) * 4], 0, 0) - lum(src[(y * w + x - 1) * 4], 0, 0) : 0; xx = x + (Math.abs(gx) > 8 ? 0 : Math.round((rn() - 0.5) * 3)); yy = y + Math.round((rn() - 0.5) * 3); }
        else { xx = x + Math.round((rn() - 0.5) * 3); yy = y + Math.round((rn() - 0.5) * 3); }
        xx = Math.min(w - 1, Math.max(0, xx)); yy = Math.min(h - 1, Math.max(0, yy));
        const i = (y * w + x) * 4, j = (yy * w + xx) * 4;
        const take = mode === 'darken' ? lum(src[j], src[j + 1], src[j + 2]) < lum(src[i], src[i + 1], src[i + 2]) : mode === 'lighten' ? lum(src[j], src[j + 1], src[j + 2]) > lum(src[i], src[i + 1], src[i + 2]) : true;
        if (take) { d[i] = src[j]; d[i + 1] = src[j + 1]; d[i + 2] = src[j + 2]; d[i + 3] = src[j + 3]; }
      }
    };
    K.tiles = function (d, w, h, p) {
      const n = Math.max(1, p.count || 10), maxOff = (p.offset || 10) / 100, rn = rng(41);
      const ts = Math.max(2, Math.min(w, h) / n), src = new Uint8ClampedArray(d), fill = p.fillColor || [255, 255, 255];
      for (let i = 0; i < d.length; i += 4) {
        if (p.fill === 'inverse') { d[i] = 255 - src[i]; d[i + 1] = 255 - src[i + 1]; d[i + 2] = 255 - src[i + 2]; }
        else if (p.fill === 'unaltered') { /* mantém */ }
        else { d[i] = fill[0]; d[i + 1] = fill[1]; d[i + 2] = fill[2]; d[i + 3] = 255; }
      }
      for (let ty = 0; ty < h; ty += ts) for (let tx = 0; tx < w; tx += ts) {
        const ox = Math.round((rn() - 0.5) * 2 * maxOff * ts), oy = Math.round((rn() - 0.5) * 2 * maxOff * ts);
        for (let y = Math.floor(ty); y < Math.min(h, ty + ts); y++) for (let x = Math.floor(tx); x < Math.min(w, tx + ts); x++) {
          const X = x + ox, Y = y + oy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const i = (Y * w + X) * 4, j = (y * w + x) * 4;
          d[i] = src[j]; d[i + 1] = src[j + 1]; d[i + 2] = src[j + 2]; d[i + 3] = src[j + 3];
        }
      }
    };
    K.traceContour = function (d, w, h, p) {
      const lv = p.level == null ? 128 : p.level, upper = p.edge !== 'lower', src = new Uint8ClampedArray(d);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const v = src[i + c], r = x + 1 < w ? src[i + 4 + c] : v, b = y + 1 < h ? src[i + w * 4 + c] : v;
          const cross = upper ? (v >= lv) !== (r >= lv) || (v >= lv) !== (b >= lv) : (v < lv) !== (r < lv) || (v < lv) !== (b < lv);
          d[i + c] = cross ? 0 : 255;
        }
      }
    };
    K.wind = function (d, w, h, p) {
      const src = new Uint8ClampedArray(d), rn = rng(53), dir = p.direction === 'left' ? -1 : 1;
      const len = p.method === 'blast' ? 40 : p.method === 'stagger' ? 25 : 18;
      for (let y = 0; y < h; y++) {
        let streak = 0, sr = 0, sg = 0, sb = 0;
        for (let k = 0; k < w; k++) {
          const x = dir > 0 ? k : w - 1 - k, i = (y * w + x) * 4;
          const L = lum(src[i], src[i + 1], src[i + 2]);
          if (L > 160 && rn() < 0.35) { streak = Math.round(len * (0.4 + rn() * 0.6)); sr = src[i]; sg = src[i + 1]; sb = src[i + 2]; }
          if (streak > 0) { const t = streak / len; d[i] = Math.max(d[i], sr * t + d[i] * (1 - t)); d[i + 1] = Math.max(d[i + 1], sg * t + d[i + 1] * (1 - t)); d[i + 2] = Math.max(d[i + 2], sb * t + d[i + 2] * (1 - t)); streak--; }
          if (p.method === 'stagger' && rn() < 0.02) streak = 0;
        }
      }
    };
    K.extrude = function (d, w, h, p) {
      const size = Math.max(2, p.size || 30), depth = (p.depth || 30) / 100, src = new Uint8ClampedArray(d);
      for (let ty = 0; ty < h; ty += size) for (let tx = 0; tx < w; tx += size) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let y = ty; y < Math.min(h, ty + size); y++) for (let x = tx; x < Math.min(w, tx + size); x++) { const i = (y * w + x) * 4; r += src[i]; g += src[i + 1]; b += src[i + 2]; n++; }
        r /= n; g /= n; b /= n;
        const bevel = Math.max(1, Math.round(size * 0.18 * depth * 2));
        for (let y = ty; y < Math.min(h, ty + size); y++) for (let x = tx; x < Math.min(w, tx + size); x++) {
          const i = (y * w + x) * 4, lx = x - tx, ly = y - ty, rx = size - 1 - lx, ry = size - 1 - ly;
          let k = 1;
          if (p.type === 'pyramids') { const m = Math.min(lx, ly, rx, ry); const side = lx === m ? 1.25 : ly === m ? 1.15 : rx === m ? 0.75 : 0.85; k = side; }
          else if (lx < bevel || ly < bevel) k = 1.3; else if (rx < bevel || ry < bevel) k = 0.7;
          d[i] = cl(r * k); d[i + 1] = cl(g * k); d[i + 2] = cl(b * k);
        }
      }
    };
    /** Pintura a óleo (filtro de Kuwahara) com iluminação opcional. */
    K.oilPaint = function (d, w, h, p) {
      const r = Math.max(1, Math.min(10, Math.round(p.stylization || 3))), src = new Uint8ClampedArray(d);
      const n = w * h, L = new Float32Array(n);
      for (let i = 0; i < n; i++) L[i] = lum(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let best = 1e18, br = 0, bg = 0, bb = 0;
        for (let q = 0; q < 4; q++) {
          const x0 = q & 1 ? x : x - r, y0 = q & 2 ? y : y - r;
          let s = 0, s2 = 0, cr = 0, cg = 0, cb = 0, c = 0;
          for (let yy = y0; yy <= y0 + r; yy++) { if (yy < 0 || yy >= h) continue; for (let xx = x0; xx <= x0 + r; xx++) { if (xx < 0 || xx >= w) continue; const j = yy * w + xx, v = L[j]; s += v; s2 += v * v; cr += src[j * 4]; cg += src[j * 4 + 1]; cb += src[j * 4 + 2]; c++; } }
          if (!c) continue;
          const varc = s2 / c - (s / c) * (s / c);
          if (varc < best) { best = varc; br = cr / c; bg = cg / c; bb = cb / c; }
        }
        const i = (y * w + x) * 4; d[i] = br; d[i + 1] = bg; d[i + 2] = bb;
      }
      const shine = (p.shine || 0) / 10;
      if (shine > 0) {
        const ang = ((p.angle == null ? 135 : p.angle) * Math.PI) / 180, lx = Math.cos(ang), ly = -Math.sin(ang);
        const M = new Float32Array(n); for (let i = 0; i < n; i++) M[i] = lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; const gx = M[i + 1] - M[i - 1], gy = M[i + w] - M[i - w]; const s = (gx * lx + gy * ly) * 0.04 * shine; const j = i * 4; d[j] += s * 20; d[j + 1] += s * 20; d[j + 2] += s * 20; }
      }
    };
    K.glowingEdges = function (d, w, h, p) {
      K.edges(d, w, h, { amount: (p.brightness || 6) * 40, invert: false });
      if ((p.smoothness || 5) > 1) gauss(d, w, h, (p.smoothness || 5) * 0.3);
    };

    /* ======================= OUTROS ======================= */
    K.highPass = function (d, w, h, p) {
      const blur = new Uint8ClampedArray(d); gauss(blur, w, h, Math.max(0.1, p.radius || 10));
      for (let i = 0; i < d.length; i += 4) { d[i] = 128 + d[i] - blur[i]; d[i + 1] = 128 + d[i + 1] - blur[i + 1]; d[i + 2] = 128 + d[i + 2] - blur[i + 2]; }
    };
    function morph(d, w, h, r, max, round) {
      r = Math.max(1, Math.round(r));
      const src = new Uint8ClampedArray(d), tmp = new Uint8ClampedArray(d);
      if (!round) {
        const pass = (S, T, horiz) => {
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            for (let c = 0; c < 4; c++) {
              let v = S[i + c];
              for (let k = -r; k <= r; k++) { const xx = horiz ? x + k : x, yy = horiz ? y : y + k; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const u = S[(yy * w + xx) * 4 + c]; if (max ? u > v : u < v) v = u; }
              T[i + c] = v;
            }
          }
        };
        pass(src, tmp, true); pass(tmp, d, false);
        return;
      }
      const offs = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) offs.push(dx, dy);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 4; c++) {
          let v = src[i + c];
          for (let k = 0; k < offs.length; k += 2) { const xx = x + offs[k], yy = y + offs[k + 1]; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const u = src[(yy * w + xx) * 4 + c]; if (max ? u > v : u < v) v = u; }
          d[i + c] = v;
        }
      }
    }
    K.maximum = function (d, w, h, p) { morph(d, w, h, p.radius || 1, true, p.shape === 'round'); };
    K.minimum = function (d, w, h, p) { morph(d, w, h, p.radius || 1, false, p.shape === 'round'); };
    K.offset = function (d, w, h, p) {
      const ox = Math.round(p.x || 0), oy = Math.round(p.y || 0), src = new Uint8ClampedArray(d), mode = p.undefined || 'wrap', bg = p.bg || [255, 255, 255];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let sx = x - ox, sy = y - oy;
        const i = (y * w + x) * 4;
        if (mode === 'wrap') { sx = ((sx % w) + w) % w; sy = ((sy % h) + h) % h; }
        else if (mode === 'repeat') { sx = Math.min(w - 1, Math.max(0, sx)); sy = Math.min(h - 1, Math.max(0, sy)); }
        else if (sx < 0 || sy < 0 || sx >= w || sy >= h) { if (mode === 'background') { d[i] = bg[0]; d[i + 1] = bg[1]; d[i + 2] = bg[2]; d[i + 3] = 255; } else d[i + 3] = 0; continue; }
        const j = (sy * w + sx) * 4;
        d[i] = src[j]; d[i + 1] = src[j + 1]; d[i + 2] = src[j + 2]; d[i + 3] = src[j + 3];
      }
    };
    K.customKernel = function (d, w, h, p) {
      if (!p || !p.m) return;
      const M = p.m, scale = p.scale || 1, off = p.offset || 0, src = new Uint8ClampedArray(d);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0;
        for (let ky = -2; ky <= 2; ky++) for (let kx = -2; kx <= 2; kx++) {
          const k = M[(ky + 2) * 5 + kx + 2]; if (!k) continue;
          const xx = Math.min(w - 1, Math.max(0, x + kx)), yy = Math.min(h - 1, Math.max(0, y + ky)), j = (yy * w + xx) * 4;
          r += src[j] * k; g += src[j + 1] * k; b += src[j + 2] * k;
        }
        const i = (y * w + x) * 4;
        d[i] = r / scale + off; d[i + 1] = g / scale + off; d[i + 2] = b / scale + off;
      }
    };
    K.hsbHsl = function (d, w, h, p) {
      const t = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (p.mode === 'hsb') { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); K._rgb2hsl(r, g, b, t); d[i] = (t[0] / 360) * 255; d[i + 1] = mx ? ((mx - mn) / mx) * 255 : 0; d[i + 2] = mx; }
        else { K._rgb2hsl(r, g, b, t); d[i] = (t[0] / 360) * 255; d[i + 1] = t[1] * 255; d[i + 2] = t[2] * 255; }
      }
    };

    /* ======================= ARTÍSTICO (galeria) ======================= */
    K.cutout = function (d, w, h, p) {
      const lv = Math.max(2, p.levels || 4); median(d, w, h, Math.max(1, Math.round((p.simplicity || 4) / 2)));
      for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = Math.round(Math.round((d[i + c] / 255) * (lv - 1)) * (255 / (lv - 1)));
    };
    K.posterEdges = function (d, w, h, p) {
      const src = new Uint8ClampedArray(d), lv = Math.max(2, p.levels || 2), th = (p.thickness || 2) * 20;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const gx = x > 0 && x < w - 1 ? lum(src[i + 4], src[i + 5], src[i + 6]) - lum(src[i - 4], src[i - 3], src[i - 2]) : 0;
        const gy = y > 0 && y < h - 1 ? lum(src[i + w * 4], src[i + w * 4 + 1], src[i + w * 4 + 2]) - lum(src[i - w * 4], src[i - w * 4 + 1], src[i - w * 4 + 2]) : 0;
        const e = Math.hypot(gx, gy);
        for (let c = 0; c < 3; c++) { let v = Math.round(Math.round((src[i + c] / 255) * (lv + 2)) * (255 / (lv + 2))); if (e > 255 - th) v *= 0.15; d[i + c] = v; }
      }
    };
    K.filmGrain = function (d, w, h, p) {
      const rn = rng(61), g = (p.grain || 4) * 6, hl = (p.highlight || 0) / 20;
      for (let i = 0; i < d.length; i += 4) { const L = lum(d[i], d[i + 1], d[i + 2]) / 255; const n = (rn() - 0.5) * g * (1 - L * 0.6); const k = 1 + hl * L * L; for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * k + n; }
    };
    K.watercolor = function (d, w, h, p) {
      bilateral(d, w, h, 2 + (p.detail || 9) * 0.3, 30, null);
      const src = new Uint8ClampedArray(d), dark = (p.shadow || 1) * 12;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        const e = Math.abs(lum(src[i + 4], src[i + 5], src[i + 6]) - lum(src[i - 4], src[i - 3], src[i - 2])) + Math.abs(lum(src[i + w * 4], src[i + w * 4 + 1], src[i + w * 4 + 2]) - lum(src[i - w * 4], src[i - w * 4 + 1], src[i - w * 4 + 2]));
        const k = Math.max(0.4, 1 - (e * dark) / 2000);
        for (let c = 0; c < 3; c++) d[i + c] = src[i + c] * k;
      }
    };
    K.graphicPen = function (d, w, h, p) {
      const ang = p.direction === 'left' ? -1 : p.direction === 'vertical' ? 2 : p.direction === 'horizontal' ? 0 : 1, rn = rng(71), len = p.length || 15, bal = (p.balance || 50) / 100;
      const src = new Uint8ClampedArray(d);
      for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 255;
      const strokes = Math.round((w * h) / 18);
      for (let s = 0; s < strokes; s++) {
        const x = Math.floor(rn() * w), y = Math.floor(rn() * h), j = (y * w + x) * 4;
        const L = lum(src[j], src[j + 1], src[j + 2]) / 255;
        if (L > bal + rn() * 0.4) continue;
        const dx = ang === 2 ? 0 : 1, dy = ang === 0 ? 0 : ang === 2 ? 1 : ang;
        for (let k = 0; k < len; k++) { const xx = x + Math.round(dx * k * 0.7), yy = y + Math.round(dy * k * 0.7); if (xx < 0 || yy < 0 || xx >= w || yy >= h) break; const q = (yy * w + xx) * 4; d[q] = d[q + 1] = d[q + 2] = 20; }
      }
    };

    /* ======================= CAMERA RAW (básico) ======================= */
    K.cameraRaw = function (d, w, h, p) {
      const temp = (p.temperature || 0) / 100, tint = (p.tint || 0) / 100, ex = Math.pow(2, p.exposure || 0), con = (p.contrast || 0) / 100;
      const hi = (p.highlights || 0) / 100, sh = (p.shadows || 0) / 100, wh = (p.whites || 0) / 100, bl = (p.blacks || 0) / 100;
      const cla = (p.clarity || 0) / 100, deh = (p.dehaze || 0) / 100, vib = (p.vibrance || 0) / 100, sat = (p.saturation || 0) / 100;
      const vig = (p.vignette || 0) / 100, grain = (p.grain || 0);
      let B = null;
      if (cla) { B = new Float32Array(w * h); const t = new Float32Array(w * h); for (let i = 0; i < w * h; i++) B[i] = lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) / 255; K._gaussChannel(B, t, w, h, Math.max(4, Math.min(w, h) / 60)); }
      const rn = rng(77), cx = w / 2, cy = h / 2, R = Math.hypot(cx, cy);
      const tc = (x) => { // curva tonal: exposição, sombras/realces, brancos/pretos, contraste
        let y = x * ex;
        y += sh * 0.45 * (1 - y) * Math.pow(Math.max(0, 1 - y * 1.8), 1.5);
        y += hi * 0.45 * y * Math.pow(Math.max(0, y * 1.8 - 0.8), 1.5);
        y += wh * 0.3 * y * y * y * y;
        y += bl * 0.25 * (1 - y) * (1 - y) * (1 - y) * (1 - y);
        if (con) y = 0.5 + (y - 0.5) * (1 + con);
        return y;
      };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const j = y * w + x, i = j * 4;
        if (d[i + 3] === 0) continue;
        let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        r *= 1 + temp * 0.25; b *= 1 - temp * 0.25; g *= 1 - tint * 0.2; r *= 1 + tint * 0.08; b *= 1 + tint * 0.08;
        const L0 = lum(r, g, b) || 1e-6, L1 = Math.max(0, tc(L0));
        let k = L1 / L0; r *= k; g *= k; b *= k;
        if (cla && B) { const L = lum(r, g, b); const dl = (L - B[j]) * cla * 1.2; r += dl; g += dl; b += dl; }
        if (deh) { const mn = Math.min(r, g, b); r = (r - mn * deh * 0.6) / (1 - deh * 0.3); g = (g - mn * deh * 0.6) / (1 - deh * 0.3); b = (b - mn * deh * 0.6) / (1 - deh * 0.3); }
        const L = lum(r, g, b), mx = Math.max(r, g, b), mn2 = Math.min(r, g, b), s0 = mx > 0 ? (mx - mn2) / mx : 0;
        const f = Math.max(0, (1 + sat) * (1 + vib * (1 - s0) * 1.2));
        r = L + (r - L) * f; g = L + (g - L) * f; b = L + (b - L) * f;
        if (vig) { const rr = Math.hypot(x - cx, y - cy) / R; const v = 1 + vig * rr * rr * 1.5; r *= v; g *= v; b *= v; }
        if (grain) { const n = (rn() - 0.5) * grain / 100; r += n; g += n; b += n; }
        d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = b * 255;
      }
    };
  });
})();
