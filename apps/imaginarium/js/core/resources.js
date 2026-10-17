/* ==========================================================================
   Imaginarium — recursos compartilhados: gradientes e padrões
   Gradiente (modelo do Photoshop):
     { name, colors: [{ t: 0..1, c: '#rrggbb' | 'fg' | 'bg' }], alphas: [{ t, a: 0..1 }] }
   Estilos de desenho: linear, radial, angle, reflected, diamond.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus;

  const G = (name, cols, alphas) => ({
    name,
    colors: cols.map((c, i) => (typeof c === 'string' ? { t: i / Math.max(1, cols.length - 1), c } : c)),
    alphas: alphas || [{ t: 0, a: 1 }, { t: 1, a: 1 }]
  });

  const PRESETS = [
    G('Primeiro plano para fundo', ['fg', 'bg']),
    G('Primeiro plano para transparente', ['fg', 'fg'], [{ t: 0, a: 1 }, { t: 1, a: 0 }]),
    G('Preto, branco', ['#000000', '#ffffff']),
    G('Vermelho, verde', ['#ff0000', '#00ff00']),
    G('Violeta, laranja', ['#290a59', '#ff7c00']),
    G('Azul, vermelho, amarelo', ['#0a00b2', '#ff0000', '#fffc00']),
    G('Azul, amarelo, azul', ['#0a0094', '#fffc00', '#0a0094']),
    G('Laranja, amarelo, laranja', ['#ff6e02', '#ffff00', '#ff6d00']),
    G('Violeta, verde, laranja', ['#6f15a3', '#00e600', '#ff7f00']),
    G('Amarelo, violeta, laranja, azul', ['#f9f400', '#6f15a3', '#ff7f00', '#0a1ee6']),
    G('Cobre', ['#97461a', '#fbd8c5', '#6c2e16', '#ef8c5a', '#8b4521']),
    G('Cromado', [{ t: 0, c: '#2c5bc1' }, { t: 0.48, c: '#e3f2ff' }, { t: 0.5, c: '#331d07' }, { t: 0.62, c: '#9b6f3b' }, { t: 1, c: '#ffffff' }]),
    G('Espectro', ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000']),
    G('Arco-íris transparente', ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'], [{ t: 0, a: 0 }, { t: 0.15, a: 1 }, { t: 0.85, a: 1 }, { t: 1, a: 0 }]),
    G('Listras transparentes', ['fg', 'fg'], [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((t, i) => ({ t, a: i % 2 ? 0 : 1 }))),
    G('Espectro Imaginarium', ['#19c6f5', '#4f6bff', '#a244f5', '#f23fb0', '#ff8a2b']),
    G('Entardecer', ['#2b1055', '#d53369', '#fbb040']),
    G('Oceano', ['#031a3a', '#0b63a8', '#6fd6ff']),
    G('Menta', ['#0f3d3e', '#2fa58a', '#d7fbe8'])
  ];

  const Gradients = (IMG.Gradients = {
    presets: PRESETS,
    user: U.store.get('gradients', []),
    all() { return PRESETS.concat(this.user); },
    saveUser() { U.store.set('gradients', this.user); bus.emit('gradients:change'); },
    clone(g) { return JSON.parse(JSON.stringify(g)); },
    def() { return this.clone(PRESETS[0]); },
    bw() { return this.clone(PRESETS[2]); },

    resolve(c) { return c === 'fg' ? IMG.app.fg : c === 'bg' ? IMG.app.bg : c; },

    /** Tabela RGBA de n posições (Uint8ClampedArray n*4). */
    lut(g, n = 256, reverse = false) {
      const out = new Uint8ClampedArray(n * 4);
      const cols = (g.colors && g.colors.length ? g.colors : [{ t: 0, c: '#000' }, { t: 1, c: '#fff' }]).map((s) => ({ t: U.clamp(s.t, 0, 1), rgb: U.hexToRgb(this.resolve(s.c)) })).sort((a, b) => a.t - b.t);
      const als = (g.alphas && g.alphas.length ? g.alphas : [{ t: 0, a: 1 }, { t: 1, a: 1 }]).map((s) => ({ t: U.clamp(s.t, 0, 1), a: U.clamp(s.a, 0, 1) })).sort((a, b) => a.t - b.t);
      const sample = (arr, t, get) => {
        if (t <= arr[0].t) return get(arr[0]);
        const last = arr[arr.length - 1];
        if (t >= last.t) return get(last);
        for (let i = 0; i < arr.length - 1; i++) {
          const a = arr[i], b = arr[i + 1];
          if (t >= a.t && t <= b.t) {
            const k = b.t - a.t < 1e-6 ? 0 : (t - a.t) / (b.t - a.t);
            const va = get(a), vb = get(b);
            return Array.isArray(va) ? va.map((v, j) => v + (vb[j] - v) * k) : va + (vb - va) * k;
          }
        }
        return get(last);
      };
      for (let i = 0; i < n; i++) {
        let t = i / (n - 1);
        if (reverse) t = 1 - t;
        const c = sample(cols, t, (s) => [s.rgb.r, s.rgb.g, s.rgb.b]);
        const a = sample(als, t, (s) => s.a);
        out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = a * 255;
      }
      return out;
    },

    /** Posição t (0..1) de um ponto segundo o estilo. */
    tAt(style, px, py, x0, y0, dx, dy, len2, len, ang) {
      const rx = px - x0, ry = py - y0;
      switch (style) {
        case 'radial': return Math.sqrt(rx * rx + ry * ry) / len;
        case 'angle': {
          let a = Math.atan2(ry, rx) - ang;
          a = -a / (Math.PI * 2);
          return a - Math.floor(a);
        }
        case 'reflected': return Math.abs((rx * dx + ry * dy) / len2);
        case 'diamond': {
          const c = Math.cos(-ang), s = Math.sin(-ang);
          const u = rx * c - ry * s, v = rx * s + ry * c;
          return (Math.abs(u) + Math.abs(v)) / len;
        }
        default: return (rx * dx + ry * dy) / len2;
      }
    },

    /**
     * Desenha o gradiente em um ImageData (substitui os pixels).
     * p0, p1: pontos em coordenadas do ImageData. o: { reverse, dither, style }
     */
    paint(img, g, style, p0, p1, o = {}) {
      const W = img.width, H = img.height, d = img.data;
      const N = 1024, T = this.lut(g, N, !!o.reverse);
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const len2 = Math.max(1e-6, dx * dx + dy * dy), len = Math.sqrt(len2), ang = Math.atan2(dy, dx);
      const dither = o.dither !== false;
      let seed = 1234567;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let t = this.tAt(style, x + 0.5, y + 0.5, p0.x, p0.y, dx, dy, len2, len, ang);
          if (t < 0) t = 0; else if (t > 1) t = 1;
          let k = t * (N - 1);
          if (dither) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; k += (seed / 0x7fffffff - 0.5) * 1.6; }
          let j = Math.round(k); if (j < 0) j = 0; else if (j > N - 1) j = N - 1;
          const i = (y * W + x) * 4, q = j * 4;
          d[i] = T[q]; d[i + 1] = T[q + 1]; d[i + 2] = T[q + 2]; d[i + 3] = T[q + 3];
        }
      }
      return img;
    },

    /** Canvas com o gradiente cobrindo w × h. */
    canvas(g, style, w, h, p0, p1, o) {
      const c = U.createCanvas(w, h), ctx = c.getContext('2d');
      const img = ctx.createImageData(c.width, c.height);
      this.paint(img, g, style, p0, p1, o);
      ctx.putImageData(img, 0, 0);
      return c;
    },

    /** Pontos inicial/final de um gradiente definido por ângulo e escala dentro de um retângulo (como no Photoshop). */
    pointsFor(rect, angleDeg, scale, style, offX = 0, offY = 0) {
      const a = U.rad(angleDeg), cx = rect.x + rect.w / 2 + (offX / 100) * rect.w, cy = rect.y + rect.h / 2 + (offY / 100) * rect.h;
      const k = (scale || 100) / 100;
      const ux = Math.cos(a), uy = -Math.sin(a);
      const half = ((Math.abs(rect.w * ux) + Math.abs(rect.h * uy)) / 2) * k;
      if (style === 'linear') return { p0: { x: cx - ux * half, y: cy - uy * half }, p1: { x: cx + ux * half, y: cy + uy * half } };
      const r = (style === 'radial' || style === 'diamond' ? Math.max(rect.w, rect.h) / 2 : half) * k;
      return { p0: { x: cx, y: cy }, p1: { x: cx + ux * (style === 'angle' || style === 'reflected' ? half : r), y: cy + uy * (style === 'angle' || style === 'reflected' ? half : r) } };
    },

    /** Pequena imagem de pré-visualização (DOM canvas). */
    preview(g, w = 120, h = 16, reverse = false) {
      const c = U.domCanvas(w, h), ctx = c.getContext('2d');
      for (let y = 0; y < h; y += 6) for (let x = 0; x < w; x += 6) { ctx.fillStyle = ((x + y) / 6) % 2 ? '#cfcfcf' : '#ffffff'; ctx.fillRect(x, y, 6, 6); }
      const T = this.lut(g, w, reverse);
      for (let x = 0; x < w; x++) { ctx.fillStyle = 'rgba(' + T[x * 4] + ',' + T[x * 4 + 1] + ',' + T[x * 4 + 2] + ',' + T[x * 4 + 3] / 255 + ')'; ctx.fillRect(x, 0, 1, h); }
      return c;
    }
  });

  /* ==================================================================
     Padrões
     ================================================================== */
  function rng(seed) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const tile = (s, fn) => { const c = U.createCanvas(s, s), x = c.getContext('2d'); fn(x, s); return c; };
  const BUILTIN = [
    ['Xadrez', () => tile(16, (c, s) => { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s); c.fillStyle = '#c8c8c8'; c.fillRect(0, 0, s / 2, s / 2); c.fillRect(s / 2, s / 2, s / 2, s / 2); })],
    ['Listras diagonais', () => tile(16, (c, s) => { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s); c.strokeStyle = '#222'; c.lineWidth = 3; c.beginPath(); for (let k = -s; k <= s * 2; k += 8) { c.moveTo(k, s); c.lineTo(k + s, 0); } c.stroke(); })],
    ['Bolinhas', () => tile(20, (c, s) => { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s); c.fillStyle = '#222'; [[5, 5], [15, 15]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); }); })],
    ['Grade', () => tile(16, (c, s) => { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s); c.fillStyle = '#888'; c.fillRect(0, 0, s, 1); c.fillRect(0, 0, 1, s); })],
    ['Tecido', () => tile(16, (c, s) => { c.fillStyle = '#d9cfbf'; c.fillRect(0, 0, s, s); c.fillStyle = '#a89a83'; for (let y = 0; y < s; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < s; x += 8) c.fillRect(x, y, 4, 2); })],
    ['Tijolos', () => tile(32, (c, s) => { c.fillStyle = '#a5472b'; c.fillRect(0, 0, s, s); c.fillStyle = '#d8d0c4'; c.fillRect(0, 0, s, 2); c.fillRect(0, 16, s, 2); c.fillRect(0, 0, 2, 16); c.fillRect(16, 16, 2, 16); })],
    ['Ruído', () => tile(64, (c, s) => { const img = c.createImageData(s, s), r = rng(5); for (let i = 0; i < img.data.length; i += 4) { const v = 90 + r() * 120; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } c.putImageData(img, 0, 0); })],
    ['Papel', () => tile(64, (c, s) => { const img = c.createImageData(s, s), r = rng(9); for (let i = 0; i < img.data.length; i += 4) { const v = 225 + r() * 30; img.data[i] = v; img.data[i + 1] = v - 3; img.data[i + 2] = v - 10; img.data[i + 3] = 255; } c.putImageData(img, 0, 0); })],
    ['Madeira', () => tile(64, (c, s) => { const img = c.createImageData(s, s); for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const i = (y * s + x) * 4; const v = Math.sin((x + Math.sin(y / 9) * 6) / 3) * 0.5 + 0.5; img.data[i] = 150 + v * 50; img.data[i + 1] = 95 + v * 35; img.data[i + 2] = 50 + v * 20; img.data[i + 3] = 255; } c.putImageData(img, 0, 0); })],
    ['Hexágonos', () => tile(30, (c, s) => { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s); c.strokeStyle = '#333'; c.lineWidth = 1.5; const hx = (cx, cy, r) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.closePath(); c.stroke(); }; hx(7.5, 7.5, 8); hx(22.5, 22.5, 8); })]
  ];

  const Patterns = (IMG.Patterns = {
    list: [],
    _built: false,
    init() {
      if (this._built) return;
      this._built = true;
      BUILTIN.forEach(([name, fn], i) => { try { this.list.push({ id: 'p' + i, name, canvas: fn(), builtin: true }); } catch (e) { console.warn(e); } });
    },
    all() { this.init(); return this.list; },
    get(id) { this.init(); return this.list.find((p) => p.id === id) || this.list[0]; },
    add(canvas, name) {
      this.init();
      const p = { id: U.uid('pat'), name: name || 'Padrão ' + (this.list.length + 1), canvas: U.cloneCanvas(canvas) };
      this.list.push(p);
      bus.emit('patterns:change');
      return p;
    },
    /** Preenche ctx (retângulo w×h a partir de 0,0) com o padrão; (ox, oy) desloca a origem. */
    fill(ctx, id, w, h, scale = 100, ox = 0, oy = 0) {
      const p = this.get(id); if (!p) return;
      let src = p.canvas;
      const k = Math.max(0.01, scale / 100);
      if (Math.abs(k - 1) > 0.001) {
        const c = U.createCanvas(Math.max(1, Math.round(src.width * k)), Math.max(1, Math.round(src.height * k)));
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height); src = c;
      }
      const pat = ctx.createPattern(src, 'repeat');
      ctx.save();
      ctx.translate(ox, oy);
      ctx.fillStyle = pat; ctx.fillRect(-ox, -oy, w, h);
      ctx.restore();
    },
    preview(id, w = 40, h = 40) {
      const c = U.domCanvas(w, h), ctx = c.getContext('2d');
      this.fill(ctx, id, w, h);
      return c;
    }
  });
  void Patterns;
})();
