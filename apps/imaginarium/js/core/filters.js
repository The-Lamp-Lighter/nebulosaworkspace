/* ==========================================================================
   Imaginarium — filtros e ajustes (processamento de pixels)
   Os núcleos ficam em uma única função autocontida para poderem ser enviados
   a um Web Worker criado por Blob (funciona em file:// sem servidor).
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG;

  /* ------------------------------------------------------------------
     Fábrica de núcleos — NÃO referenciar nada externo aqui dentro.
     Cada núcleo recebe (data: Uint8ClampedArray RGBA, w, h, params)
     e altera os dados no próprio array.
     ------------------------------------------------------------------ */
  IMG.kernelParts = IMG.kernelParts || [];
  IMG.kernelParts.unshift(function basePart(K) {

    function applyLUT(d, lr, lg, lb) {
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        d[i] = lr[d[i]]; d[i + 1] = lg[d[i + 1]]; d[i + 2] = lb[d[i + 2]];
      }
    }
    function makeLUT(fn) {
      const t = new Uint8ClampedArray(256);
      for (let i = 0; i < 256; i++) t[i] = fn(i);
      return t;
    }

    /* ---------- ajustes ---------- */
    K.brightnessContrast = function (d, w, h, p) {
      const b = (p.brightness || 0) * 1.6;
      const c = (p.contrast || 0) * 2.55;
      const f = (259 * (c + 255)) / (255 * (259 - c));
      const t = makeLUT((v) => f * (v - 128) + 128 + b);
      applyLUT(d, t, t, t);
    };

    K.exposure = function (d, w, h, p) {
      const mul = Math.pow(2, p.exposure || 0);
      const off = (p.offset || 0) * 255;
      const g = 1 / Math.max(0.05, p.gamma || 1);
      const t = makeLUT((v) => 255 * Math.pow(Math.max(0, Math.min(1, (v * mul + off) / 255)), g));
      applyLUT(d, t, t, t);
    };

    K.hueSaturation = function (d, w, h, p) {
      const dh = (p.hue || 0) / 360;
      const ds = (p.saturation || 0) / 100;
      const dl = (p.lightness || 0) / 100;
      const hue2rgb = (pp, q, t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return pp + (q - pp) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return pp + (q - pp) * (2 / 3 - t) * 6;
        return pp;
      };
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let hh = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
          const dd = max - min;
          s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
          if (max === r) hh = (g - b) / dd + (g < b ? 6 : 0);
          else if (max === g) hh = (b - r) / dd + 2;
          else hh = (r - g) / dd + 4;
          hh /= 6;
        }
        hh = (hh + dh + 1) % 1;
        s = ds >= 0 ? s + (1 - s) * ds : s * (1 + ds);
        if (ds >= 0 && max === min) s = 0;
        l = dl >= 0 ? l + (1 - l) * dl : l * (1 + dl);
        let rr, gg, bb;
        if (s === 0) { rr = gg = bb = l; }
        else {
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const pp = 2 * l - q;
          rr = hue2rgb(pp, q, hh + 1 / 3); gg = hue2rgb(pp, q, hh); bb = hue2rgb(pp, q, hh - 1 / 3);
        }
        d[i] = rr * 255; d[i + 1] = gg * 255; d[i + 2] = bb * 255;
      }
    };

    K.vibrance = function (d, w, h, p) {
      const amt = (p.vibrance || 0) / 100;
      const satAmt = (p.saturation || 0) / 100;
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const sat = max ? (max - min) / max : 0;
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const f = Math.max(0, (1 + amt * (1 - sat) * 1.4) * (1 + satAmt));
        d[i] = gray + (r - gray) * f; d[i + 1] = gray + (g - gray) * f; d[i + 2] = gray + (b - gray) * f;
      }
    };

    K.temperature = function (d, w, h, p) {
      const t = (p.temperature || 0) / 100, ti = (p.tint || 0) / 100;
      const lr = makeLUT((v) => v * (1 + t * 0.28) + t * 6);
      const lg = makeLUT((v) => v * (1 - ti * 0.22));
      const lb = makeLUT((v) => v * (1 - t * 0.28) - t * 6);
      applyLUT(d, lr, lg, lb);
    };

    K.levels = function (d, w, h, p) {
      const ib = p.inBlack || 0, iw = p.inWhite == null ? 255 : p.inWhite;
      const ob = p.outBlack || 0, ow = p.outWhite == null ? 255 : p.outWhite;
      const g = 1 / Math.max(0.05, p.gamma || 1);
      const range = Math.max(1, iw - ib);
      const t = makeLUT((v) => {
        const x = Math.max(0, Math.min(1, (v - ib) / range));
        return ob + Math.pow(x, g) * (ow - ob);
      });
      applyLUT(d, t, t, t);
    };

    K.curves = function (d, w, h, p) {
      const id = makeLUT((v) => v);
      const m = p.rgb || id;
      const compose = (ch) => { const c = ch || id; return makeLUT((v) => m[c[v]]); };
      applyLUT(d, compose(p.r), compose(p.g), compose(p.b));
    };

    K.invert = function (d) {
      for (let i = 0, n = d.length; i < n; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
    };

    K.grayscale = function (d, w, h, p) {
      const a = p && p.amount != null ? p.amount / 100 : 1;
      for (let i = 0, n = d.length; i < n; i += 4) {
        const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] += (y - d[i]) * a; d[i + 1] += (y - d[i + 1]) * a; d[i + 2] += (y - d[i + 2]) * a;
      }
    };

    K.sepia = function (d, w, h, p) {
      const a = p && p.amount != null ? p.amount / 100 : 1;
      for (let i = 0, n = d.length; i < n; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const nr = 0.393 * r + 0.769 * g + 0.189 * b;
        const ng = 0.349 * r + 0.686 * g + 0.168 * b;
        const nb = 0.272 * r + 0.534 * g + 0.131 * b;
        d[i] = r + (nr - r) * a; d[i + 1] = g + (ng - g) * a; d[i + 2] = b + (nb - b) * a;
      }
    };

    K.posterize = function (d, w, h, p) {
      const lv = Math.max(2, Math.round(p.levels || 4));
      const t = makeLUT((v) => Math.round((Math.floor((v / 256) * lv) / (lv - 1)) * 255));
      applyLUT(d, t, t, t);
    };

    K.threshold = function (d, w, h, p) {
      const lv = p.level == null ? 128 : p.level;
      for (let i = 0, n = d.length; i < n; i += 4) {
        const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = y >= lv ? 255 : 0;
      }
    };

    /* ---------- desfoque gaussiano (3 passagens de box blur, alfa pré-multiplicado) ---------- */
    function boxesForGauss(sigma, n) {
      const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
      let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
      const wu = wl + 2;
      const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
      const sizes = [];
      for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
      return sizes;
    }
    function boxH(s, t, w, h, r) {
      r = Math.min(r, Math.floor((w - 1) / 2));
      if (r < 1) { t.set(s); return; }
      const iarr = 1 / (r + r + 1);
      for (let i = 0; i < h; i++) {
        let ti = i * w, li = ti, ri = ti + r;
        const fv = s[ti], lv = s[ti + w - 1];
        let val = (r + 1) * fv;
        for (let j = 0; j < r; j++) val += s[ti + j];
        for (let j = 0; j <= r; j++) { val += s[ri++] - fv; t[ti++] = val * iarr; }
        for (let j = r + 1; j < w - r; j++) { val += s[ri++] - s[li++]; t[ti++] = val * iarr; }
        for (let j = w - r; j < w; j++) { val += lv - s[li++]; t[ti++] = val * iarr; }
      }
    }
    function boxV(s, t, w, h, r) {
      r = Math.min(r, Math.floor((h - 1) / 2));
      if (r < 1) { t.set(s); return; }
      const iarr = 1 / (r + r + 1);
      for (let i = 0; i < w; i++) {
        let ti = i, li = ti, ri = ti + r * w;
        const fv = s[ti], lv = s[ti + w * (h - 1)];
        let val = (r + 1) * fv;
        for (let j = 0; j < r; j++) val += s[ti + j * w];
        for (let j = 0; j <= r; j++) { val += s[ri] - fv; t[ti] = val * iarr; ri += w; ti += w; }
        for (let j = r + 1; j < h - r; j++) { val += s[ri] - s[li]; t[ti] = val * iarr; li += w; ri += w; ti += w; }
        for (let j = h - r; j < h; j++) { val += lv - s[li]; t[ti] = val * iarr; li += w; ti += w; }
      }
    }
    function gaussChannel(a, b, w, h, sigma) {
      const bx = boxesForGauss(sigma, 3);
      for (let k = 0; k < 3; k++) {
        const r = Math.max(0, (bx[k] - 1) / 2);
        boxH(a, b, w, h, r);
        boxV(b, a, w, h, r);
      }
    }
    function gaussianRGBA(d, w, h, sigma) {
      if (sigma < 0.15) return;
      const n = w * h;
      const al = new Float32Array(n), a = new Float32Array(n), b = new Float32Array(n);
      for (let i = 0; i < n; i++) al[i] = d[i * 4 + 3];
      const alSrc = al.slice();
      gaussChannel(al, b, w, h, sigma);
      for (let c = 0; c < 3; c++) {
        for (let i = 0; i < n; i++) a[i] = (d[i * 4 + c] * alSrc[i]) / 255;
        gaussChannel(a, b, w, h, sigma);
        for (let i = 0; i < n; i++) { const av = al[i]; d[i * 4 + c] = av > 0.001 ? (a[i] * 255) / av : 0; }
      }
      for (let i = 0; i < n; i++) d[i * 4 + 3] = al[i];
    }
    K._gaussian = gaussianRGBA;
    K._applyLUT = applyLUT;
    K._makeLUT = makeLUT;
    K._gaussChannel = gaussChannel;
    K._boxH = boxH; K._boxV = boxV;

    K.gaussianBlur = function (d, w, h, p) { gaussianRGBA(d, w, h, Math.max(0, p.radius || 0)); };

    K.motionBlur = function (d, w, h, p) {
      const dist = Math.max(1, Math.round(p.distance || 10));
      const ang = ((p.angle || 0) * Math.PI) / 180;
      const dx = Math.cos(ang), dy = -Math.sin(ang);
      const steps = Math.min(dist, 96);
      const src = new Uint8ClampedArray(d);
      const half = dist / 2;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let r = 0, g = 0, b = 0, a = 0, cnt = 0;
          for (let s = 0; s <= steps; s++) {
            const t = (s / steps) * dist - half;
            let sx = Math.round(x + dx * t), sy = Math.round(y + dy * t);
            if (sx < 0) sx = 0; else if (sx >= w) sx = w - 1;
            if (sy < 0) sy = 0; else if (sy >= h) sy = h - 1;
            const k = (sy * w + sx) * 4, av = src[k + 3];
            r += src[k] * av; g += src[k + 1] * av; b += src[k + 2] * av; a += av; cnt++;
          }
          const o = (y * w + x) * 4;
          if (a > 0) { d[o] = r / a; d[o + 1] = g / a; d[o + 2] = b / a; } else { d[o] = d[o + 1] = d[o + 2] = 0; }
          d[o + 3] = a / cnt;
        }
      }
    };

    K.sharpen = function (d, w, h, p) {
      const amount = (p.amount == null ? 100 : p.amount) / 100;
      const radius = Math.max(0.3, p.radius || 1);
      const blur = new Uint8ClampedArray(d);
      gaussianRGBA(blur, w, h, radius);
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        d[i] = d[i] + (d[i] - blur[i]) * amount;
        d[i + 1] = d[i + 1] + (d[i + 1] - blur[i + 1]) * amount;
        d[i + 2] = d[i + 2] + (d[i + 2] - blur[i + 2]) * amount;
      }
    };

    K.noise = function (d, w, h, p) {
      const amt = ((p.amount || 0) / 100) * 255;
      const mono = !!p.mono;
      let seed = (p.seed || 1337) >>> 0;
      const rnd = () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      for (let i = 0, n = d.length; i < n; i += 4) {
        if (d[i + 3] === 0) continue;
        if (mono) {
          const v = (rnd() - 0.5) * 2 * amt;
          d[i] += v; d[i + 1] += v; d[i + 2] += v;
        } else {
          d[i] += (rnd() - 0.5) * 2 * amt; d[i + 1] += (rnd() - 0.5) * 2 * amt; d[i + 2] += (rnd() - 0.5) * 2 * amt;
        }
      }
    };

    K.emboss = function (d, w, h, p) {
      const ang = ((p.angle == null ? 135 : p.angle) * Math.PI) / 180;
      const dist = Math.max(1, Math.round(p.height || 2));
      const amount = (p.amount == null ? 100 : p.amount) / 100;
      const ox = Math.round(Math.cos(ang) * dist), oy = Math.round(-Math.sin(ang) * dist);
      const src = new Uint8ClampedArray(d);
      for (let y = 0; y < h; y++) {
        const y1 = Math.min(h - 1, Math.max(0, y + oy)), y2 = Math.min(h - 1, Math.max(0, y - oy));
        for (let x = 0; x < w; x++) {
          const x1 = Math.min(w - 1, Math.max(0, x + ox)), x2 = Math.min(w - 1, Math.max(0, x - ox));
          const a = (y1 * w + x1) * 4, b = (y2 * w + x2) * 4, o = (y * w + x) * 4;
          const la = 0.299 * src[a] + 0.587 * src[a + 1] + 0.114 * src[a + 2];
          const lb = 0.299 * src[b] + 0.587 * src[b + 1] + 0.114 * src[b + 2];
          const v = 128 + (la - lb) * amount;
          d[o] = v; d[o + 1] = v; d[o + 2] = v;
        }
      }
    };

    K.pixelate = function (d, w, h, p) {
      const s = Math.max(2, Math.round(p.size || 8));
      for (let by = 0; by < h; by += s) {
        for (let bx = 0; bx < w; bx += s) {
          let r = 0, g = 0, b = 0, a = 0;
          const x1 = Math.min(w, bx + s), y1 = Math.min(h, by + s);
          for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) {
            const k = (y * w + x) * 4, av = d[k + 3];
            r += d[k] * av; g += d[k + 1] * av; b += d[k + 2] * av; a += av;
          }
          const cnt = (x1 - bx) * (y1 - by);
          const rr = a ? r / a : 0, gg = a ? g / a : 0, bb = a ? b / a : 0, aa = a / cnt;
          for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) {
            const k = (y * w + x) * 4;
            d[k] = rr; d[k + 1] = gg; d[k + 2] = bb; d[k + 3] = aa;
          }
        }
      }
    };

    K.edges = function (d, w, h, p) {
      const src = new Uint8ClampedArray(d);
      const lum = new Float32Array(w * h);
      for (let i = 0, j = 0; i < src.length; i += 4, j++) lum[j] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
      const gain = (p && p.amount != null ? p.amount : 100) / 100;
      const inv = !!(p && p.invert);
      for (let y = 0; y < h; y++) {
        const ym = Math.max(0, y - 1) * w, yc = y * w, yp = Math.min(h - 1, y + 1) * w;
        for (let x = 0; x < w; x++) {
          const xm = Math.max(0, x - 1), xp = Math.min(w - 1, x + 1);
          const gx = -lum[ym + xm] - 2 * lum[yc + xm] - lum[yp + xm] + lum[ym + xp] + 2 * lum[yc + xp] + lum[yp + xp];
          const gy = -lum[ym + xm] - 2 * lum[ym + x] - lum[ym + xp] + lum[yp + xm] + 2 * lum[yp + x] + lum[yp + xp];
          let v = Math.sqrt(gx * gx + gy * gy) * gain;
          if (v > 255) v = 255;
          if (inv) v = 255 - v;
          const o = (yc + x) * 4;
          d[o] = v; d[o + 1] = v; d[o + 2] = v;
        }
      }
    };

    /** Executa um núcleo e mistura com a máscara de seleção (opcional). */
    K.run = function (name, data, w, h, params, mask) {
      const fn = K[name];
      if (!fn) throw new Error('Filtro desconhecido: ' + name);
      if (!mask) { fn(data, w, h, params || {}); return data; }
      const src = new Uint8ClampedArray(data);
      fn(data, w, h, params || {});
      for (let i = 0, j = 0, n = data.length; i < n; i += 4, j++) {
        const m = mask[j];
        if (m === 255) continue;
        if (m === 0) { data[i] = src[i]; data[i + 1] = src[i + 1]; data[i + 2] = src[i + 2]; data[i + 3] = src[i + 3]; continue; }
        const t = m / 255;
        data[i] = src[i] + (data[i] - src[i]) * t;
        data[i + 1] = src[i + 1] + (data[i + 1] - src[i + 1]) * t;
        data[i + 2] = src[i + 2] + (data[i + 2] - src[i + 2]) * t;
        data[i + 3] = src[i + 3] + (data[i + 3] - src[i + 3]) * t;
      }
      return data;
    };
  });

  /* ------------------------------------------------------------------
     Executor: tenta usar um Web Worker (Blob); se indisponível, roda
     de forma síncrona na thread principal.
     ------------------------------------------------------------------ */
  const Filters = (IMG.Filters = {
    _K: null,
    get K() {
      if (!this._K) { const K = {}; IMG.kernelParts.forEach((f) => f(K)); this._K = K; }
      return this._K;
    },
    worker: null,
    workerFailed: false,
    jobs: new Map(),
    seq: 0,

    _ensureWorker() {
      if (this.worker || this.workerFailed) return this.worker;
      try {
        const src =
          'const K = {};\n' + IMG.kernelParts.map((f) => '(' + f.toString() + ')(K);').join('\n') + '\n' +
          'self.onmessage = function (e) {\n' +
          '  const m = e.data;\n' +
          '  try {\n' +
          '    const data = new Uint8ClampedArray(m.buf);\n' +
          '    K.run(m.name, data, m.w, m.h, m.params, m.mask ? new Uint8Array(m.mask) : null);\n' +
          '    self.postMessage({ id: m.id, buf: data.buffer }, [data.buffer]);\n' +
          '  } catch (err) { self.postMessage({ id: m.id, error: String(err && err.message || err) }); }\n' +
          '};';
        const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        const w = new Worker(url);
        w.onmessage = (e) => {
          const job = this.jobs.get(e.data.id);
          if (!job) return;
          this.jobs.delete(e.data.id);
          if (e.data.error) job.reject(new Error(e.data.error));
          else job.resolve(new Uint8ClampedArray(e.data.buf));
        };
        w.onerror = () => {
          this.workerFailed = true; this.worker = null;
          for (const job of this.jobs.values()) job.fallback();
          this.jobs.clear();
        };
        this.worker = w;
      } catch (err) {
        this.workerFailed = true; this.worker = null;
      }
      return this.worker;
    },

    /**
     * Processa uma cópia dos pixels.
     * @param {string} name   nome do núcleo
     * @param {ImageData} src imagem de origem (não é modificada)
     * @param {object} params parâmetros do filtro
     * @param {Uint8Array|null} mask máscara de seleção (1 byte por pixel)
     * @returns {Promise<ImageData>}
     */
    run(name, src, params, mask) {
      const w = src.width, h = src.height;
      const copy = new Uint8ClampedArray(src.data);
      const syncRun = () => {
        this.K.run(name, copy, w, h, params, mask);
        return new ImageData(copy, w, h);
      };
      const worker = w * h > 40000 ? this._ensureWorker() : null;
      if (!worker) {
        return new Promise((res, rej) => { try { res(syncRun()); } catch (err) { rej(err); } });
      }
      return new Promise((resolve, reject) => {
        const id = ++this.seq;
        this.jobs.set(id, {
          resolve: (arr) => resolve(new ImageData(arr, w, h)),
          reject,
          fallback: () => { try { resolve(syncRun()); } catch (err) { reject(err); } }
        });
        const maskBuf = mask ? mask.slice().buffer : null;
        const buf = copy.buffer.slice(0);
        worker.postMessage({ id, name, w, h, params, buf, mask: maskBuf }, maskBuf ? [buf, maskBuf] : [buf]);
      });
    },

    /** Execução síncrona direta sobre um ImageData (altera no lugar). */
    runSync(name, imageData, params, mask) {
      this.K.run(name, imageData.data, imageData.width, imageData.height, params, mask);
      return imageData;
    }
  });
})();
