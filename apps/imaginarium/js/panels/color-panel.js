/* ==========================================================================
   Imaginarium — seletor de cores, painel Cores e painel Amostras
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;

  /* ------------------------------------------------------------------
     Componente: quadrado de saturação/brilho + faixa de matiz + campos
     ------------------------------------------------------------------ */
  /* conversões sRGB ⇄ Lab (D65) e CMYK simples */
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const gam = (v) => U.clamp(Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255), 0, 255);
  const fLab = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fInv = (t) => (t * t * t > 216 / 24389 ? t * t * t : (116 * t - 16) / (24389 / 27));
  U.rgbToLab = (r, g, b) => {
    const R = lin(r), G = lin(g), B = lin(b);
    const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const fx = fLab(x), fy = fLab(y), fz = fLab(z);
    return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  };
  U.labToRgb = (l, a, b) => {
    const fy = (l + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    const x = fInv(fx) * 0.95047, y = fInv(fy), z = fInv(fz) * 1.08883;
    return { r: gam(x * 3.2406 + y * -1.5372 + z * -0.4986), g: gam(x * -0.9689 + y * 1.8758 + z * 0.0415), b: gam(x * 0.0557 + y * -0.204 + z * 1.057) };
  };
  U.rgbToCmyk = (r, g, b) => { const k = 1 - Math.max(r, g, b) / 255; if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 }; const f = (v) => ((1 - v / 255 - k) / (1 - k)) * 100; return { c: f(r), m: f(g), y: f(b), k: k * 100 }; };
  U.cmykToRgb = (c, m, y, k) => ({ r: Math.round(255 * (1 - c / 100) * (1 - k / 100)), g: Math.round(255 * (1 - m / 100) * (1 - k / 100)), b: Math.round(255 * (1 - y / 100) * (1 - k / 100)) });

  class ColorPicker {
    constructor(o = {}) {
      this.onChange = o.onChange || function () {};
      this.hsv = { h: 0, s: 0, v: 0 };
      this.hex = '#000000';
      this.compact = !!o.compact;
      this.sv = U.domCanvas(200, 130); this.sv.className = 'cp-sv';
      this.hue = U.domCanvas(200, 14); this.hue.className = 'cp-hue';
      this.hexIn = el('input.inp.cp-hex', { type: 'text', maxlength: 7, spellcheck: false, 'aria-label': 'Cor em hexadecimal' });
      this.preview = el('span.cp-preview');
      const UI = IMG.UI;
      const ch = (key, label, max) => UI.num({ value: 0, min: 0, max, width: 46, label, onInput: (v) => this._fromField(key, v) });
      this.f = { r: ch('r', 'R', 255), g: ch('g', 'G', 255), b: ch('b', 'B', 255), h: ch('h', 'H', 360), s: ch('s', 'S', 100), v: ch('v', 'B', 100) };
      const lab = (t, c) => el('label.cp-field', el('span', { text: t }), c.el);
      this.full = !!o.full;
      if (this.full) {
        const chs = (key, label, min, max) => UI.num({ value: 0, min, max, width: 46, label, onInput: (v) => this._fromField(key, v) });
        Object.assign(this.f, { L: chs('L', 'L', 0, 100), A: chs('A', 'a', -128, 127), Bl: chs('Bl', 'b', -128, 127), C: chs('C', 'C', 0, 100), M: chs('M', 'M', 0, 100), Y: chs('Y', 'Y', 0, 100), K: chs('K', 'K', 0, 100) });
      }
      this.el = el('div.cp' + (this.compact ? '.compact' : ''),
        this.sv, this.hue,
        el('div.cp-row', this.preview, el('span.cp-hash', { text: '#' }), this.hexIn),
        el('div.cp-grid', lab('H', this.f.h), lab('S', this.f.s), lab('B', this.f.v), lab('R', this.f.r), lab('G', this.f.g), lab('B', this.f.b)),
        this.full ? el('div.cp-grid.cp-grid4', lab('L', this.f.L), lab('a', this.f.A), lab('b', this.f.Bl), el('span'), lab('C', this.f.C), lab('M', this.f.M), lab('Y', this.f.Y), lab('K', this.f.K)) : null);

      this.sv.addEventListener('pointerdown', (e) => {
        const pick = (ev) => {
          const r = this.sv.getBoundingClientRect();
          this.hsv.s = U.clamp((ev.clientX - r.left) / r.width, 0, 1);
          this.hsv.v = 1 - U.clamp((ev.clientY - r.top) / r.height, 0, 1);
          this._emit();
        };
        pick(e); U.drag(e, pick);
      });
      this.hue.addEventListener('pointerdown', (e) => {
        const pick = (ev) => {
          const r = this.hue.getBoundingClientRect();
          this.hsv.h = U.clamp((ev.clientX - r.left) / r.width, 0, 1) * 359.99;
          this._emit();
        };
        pick(e); U.drag(e, pick);
      });
      const hexCommit = () => { const h = U.normHex(this.hexIn.value); if (h) { this.set(h); this.onChange(h); } else this.hexIn.value = this.hex.slice(1); };
      this.hexIn.addEventListener('change', hexCommit);
      this.hexIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); hexCommit(); this.hexIn.blur(); } });
      this.set(o.color || '#000000');
    }

    /** Ajusta os canvases à largura disponível. */
    layout() {
      const w = Math.max(120, Math.floor(this.el.clientWidth || 220));
      const dpr = window.devicePixelRatio || 1;
      // no painel, o quadrado de cor ocupa a altura que sobrar
      const host = this.el.parentElement;
      const h = this.compact ? 132 : U.clamp((host ? host.clientHeight : 300) - 178, 56, 180);
      if (this._w === w && this._h === h) { this.draw(); return; }
      this._w = w; this._h = h;
      this.sv.width = Math.round(w * dpr); this.sv.height = Math.round(h * dpr);
      this.sv.style.width = w + 'px'; this.sv.style.height = h + 'px';
      this.hue.width = Math.round(w * dpr); this.hue.height = Math.round(14 * dpr);
      this.hue.style.width = w + 'px'; this.hue.style.height = '14px';
      this.draw();
    }

    set(hex) {
      hex = U.normHex(hex) || '#000000';
      const c = U.hexToRgb(hex), n = U.rgbToHsv(c.r, c.g, c.b);
      // preserva a matiz quando a cor é cinza, e a saturação quando é preta
      if (n.s === 0 || n.v === 0) n.h = this.hsv.h;
      if (n.v === 0) n.s = this.hsv.s;
      this.hsv = n; this.hex = hex;
      this._sync(); this.draw();
    }

    _emit() {
      const c = U.hsvToRgb(this.hsv.h, this.hsv.s, this.hsv.v);
      this.hex = U.rgbToHex(c.r, c.g, c.b);
      this._sync(); this.draw();
      this.onChange(this.hex);
    }

    _fromField(key, v) {
      if (key === 'r' || key === 'g' || key === 'b') {
        const c = U.hexToRgb(this.hex); c[key] = v;
        const hex = U.rgbToHex(c.r, c.g, c.b);
        this.set(hex); this.onChange(hex);
      } else if (key === 'L' || key === 'A' || key === 'Bl') {
        const q = { L: this.f.L.get ? this.f.L.get() : 0, A: this.f.A.get ? this.f.A.get() : 0, Bl: this.f.Bl.get ? this.f.Bl.get() : 0 }; q[key] = v;
        const c = U.labToRgb(q.L, q.A, q.Bl), hex = U.rgbToHex(c.r, c.g, c.b);
        this._skip = key; this.set(hex); this._skip = null; this.onChange(hex);
      } else if (key === 'C' || key === 'M' || key === 'Y' || key === 'K') {
        const q = {}; ['C', 'M', 'Y', 'K'].forEach((k) => { q[k] = this.f[k].get ? this.f[k].get() : 0; }); q[key] = v;
        const c = U.cmykToRgb(q.C, q.M, q.Y, q.K), hex = U.rgbToHex(c.r, c.g, c.b);
        this._skip = key; this.set(hex); this._skip = null; this.onChange(hex);
      } else {
        if (key === 'h') this.hsv.h = Math.min(359.99, v); else this.hsv[key] = v / 100;
        this._emit();
      }
    }

    _sync() {
      const c = U.hexToRgb(this.hex);
      this.f.r.set(c.r); this.f.g.set(c.g); this.f.b.set(c.b);
      this.f.h.set(Math.round(this.hsv.h)); this.f.s.set(Math.round(this.hsv.s * 100)); this.f.v.set(Math.round(this.hsv.v * 100));
      if (this.full) {
        const l = U.rgbToLab(c.r, c.g, c.b), k = U.rgbToCmyk(c.r, c.g, c.b), sk = this._skip;
        if (sk !== 'L') this.f.L.set(Math.round(l.l)); if (sk !== 'A') this.f.A.set(Math.round(l.a)); if (sk !== 'Bl') this.f.Bl.set(Math.round(l.b));
        if (sk !== 'C') this.f.C.set(Math.round(k.c)); if (sk !== 'M') this.f.M.set(Math.round(k.m)); if (sk !== 'Y') this.f.Y.set(Math.round(k.y)); if (sk !== 'K') this.f.K.set(Math.round(k.k));
      }
      if (document.activeElement !== this.hexIn) this.hexIn.value = this.hex.slice(1);
      this.preview.style.background = this.hex;
    }

    draw() {
      const sv = this.sv, c = sv.getContext('2d'), W = sv.width, H = sv.height;
      const pure = U.hsvToRgb(this.hsv.h, 1, 1);
      c.fillStyle = 'rgb(' + pure.r + ',' + pure.g + ',' + pure.b + ')'; c.fillRect(0, 0, W, H);
      let g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, '#000');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const dpr = W / (parseFloat(sv.style.width) || W);
      const x = this.hsv.s * W, y = (1 - this.hsv.v) * H;
      c.lineWidth = 1.5 * dpr;
      c.strokeStyle = 'rgba(0,0,0,.65)'; c.beginPath(); c.arc(x, y, 6.5 * dpr, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#fff'; c.beginPath(); c.arc(x, y, 5 * dpr, 0, Math.PI * 2); c.stroke();

      const hu = this.hue, hc = hu.getContext('2d'), hw = hu.width, hh = hu.height;
      const hg = hc.createLinearGradient(0, 0, hw, 0);
      ['#f00', '#ff0', '#0f0', '#0ff', '#00f', '#f0f', '#f00'].forEach((col, i) => hg.addColorStop(i / 6, col));
      hc.fillStyle = hg; hc.fillRect(0, 0, hw, hh);
      const hx = (this.hsv.h / 360) * hw;
      hc.fillStyle = '#fff'; hc.fillRect(hx - 2 * dpr, 0, 4 * dpr, hh);
      hc.strokeStyle = 'rgba(0,0,0,.7)'; hc.lineWidth = dpr; hc.strokeRect(hx - 2 * dpr, 0.5, 4 * dpr, hh - 1);
    }
  }
  IMG.ColorPicker = ColorPicker;

  /* ------------------------------------------------------------------
     Painel Cores
     ------------------------------------------------------------------ */
  let picker = null, target = 'fg', colorRoot = null;
  IMG.UI.registerPanel({
    id: 'color', title: 'Cores',
    build(root) {
      colorRoot = root;
      const app = IMG.app;
      picker = new ColorPicker({ color: app.fg, onChange: (hex) => { if (target === 'fg') app.setFg(hex, picker); else app.setBg(hex, picker); } });
      const fg = el('button.ct-sw.ct-fg', { type: 'button', title: 'Editar a cor do primeiro plano' });
      const bg = el('button.ct-sw.ct-bg', { type: 'button', title: 'Editar a cor de fundo' });
      const lbl = el('span.ct-label');
      const upd = () => {
        fg.style.background = app.fg; bg.style.background = app.bg;
        fg.classList.toggle('active', target === 'fg'); bg.classList.toggle('active', target === 'bg');
        lbl.textContent = target === 'fg' ? 'Primeiro plano' : 'Fundo';
      };
      fg.addEventListener('click', () => { target = 'fg'; picker.set(app.fg); upd(); });
      bg.addEventListener('click', () => { target = 'bg'; picker.set(app.bg); upd(); });
      const head = el('div.ct-head', el('div.ct-pair', bg, fg), lbl, el('span.pgroup-fill'),
        IMG.UI.iconBtn('swap', 'Trocar cores (X)', () => app.swapColors()),
        IMG.UI.iconBtn('reset', 'Cores padrão (D)', () => app.resetColors()));
      root.append(head, picker.el);
      bus.on('color:change', (which, src) => { upd(); if (src !== picker) picker.set(target === 'fg' ? app.fg : app.bg); });
      bus.on('dock:resize', () => { if (root.isConnected) picker.layout(); });
      window.addEventListener('resize', () => { if (root.isConnected) picker.layout(); });
      upd();
    },
    onShow() { if (picker) requestAnimationFrame(() => picker.layout()); }
  });
  void colorRoot;

  /* ------------------------------------------------------------------
     Painel Amostras
     ------------------------------------------------------------------ */
  const DEFAULT_SWATCHES = [
    '#000000', '#2b2d31', '#4a4e57', '#6c717a', '#9a9fa8', '#c9ccd1', '#e6e8ec', '#ffffff',
    '#19c6f5', '#2f9bff', '#4f6bff', '#7a4dff', '#a244f5', '#d13fe0', '#f23fb0', '#ff5d8f',
    '#ff3b30', '#ff6a2b', '#ff8a2b', '#ffb020', '#ffd43b', '#c4e538', '#5fd38d', '#12b886',
    '#0b7285', '#1864ab', '#364fc7', '#5f3dc4', '#862e9c', '#a61e4d', '#c92a2a', '#d9480f',
    '#7f5539', '#b08968', '#ddb892', '#f1dcc3', '#ffe8cc', '#d3f9d8', '#d0ebff', '#e5dbff'
  ];
  let swatches = U.store.get('swatches', null) || DEFAULT_SWATCHES.slice();
  const saveSw = () => { U.store.set('swatches', swatches); bus.emit('swatches:change'); };
  IMG.Swatches = { get list() { return swatches; }, set(l) { swatches = l; saveSw(); }, save: saveSw, defaults: DEFAULT_SWATCHES };

  IMG.UI.registerPanel({
    id: 'swatches', title: 'Amostras',
    build(root) {
      const grid = el('div.sw-grid');
      const render = () => {
        U.clear(grid);
        swatches.forEach((hex, i) => {
          const b = el('button.sw', { type: 'button', title: hex.toUpperCase() + ' — clique: primeiro plano · Alt+clique: fundo', style: { background: hex } });
          b.addEventListener('click', (e) => { if (e.altKey) IMG.app.setBg(hex); else IMG.app.setFg(hex); });
          b.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            IMG.UI.contextMenu(e.clientX, e.clientY, [
              { label: 'Usar como primeiro plano', run: () => IMG.app.setFg(hex) },
              { label: 'Usar como fundo', run: () => IMG.app.setBg(hex) }, '-',
              { label: 'Remover amostra', run: () => { swatches.splice(i, 1); saveSw(); } }
            ]);
          });
          grid.appendChild(b);
        });
      };
      const bar = el('div.panel-foot',
        IMG.UI.btn('Adicionar cor atual', () => { const c = IMG.app.fg.toLowerCase(); if (!swatches.includes(c)) { swatches.push(c); saveSw(); } else IMG.UI.toast('Esta cor já está nas amostras.'); }, { small: true, icon: 'plus' }),
        el('span.pgroup-fill'),
        IMG.UI.btn('Restaurar', () => { swatches = DEFAULT_SWATCHES.slice(); saveSw(); }, { small: true }));
      root.append(grid, bar);
      bus.on('swatches:change', render);
      render();
    }
  });
})();
