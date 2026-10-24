/* ==========================================================================
   Imaginarium — motor de pincel, predefinições de pincel, Pincel e Lápis
   Modelo: a pincelada é acumulada em um buffer (fluxo por carimbo) e
   composta sobre a camada com a opacidade e o modo do pincel. A cada quadro
   só a área nova é recomposta.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;

  /* ==================================================================
     Pontas e predefinições
     ================================================================== */
  function rng(seed) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /** Pontas de amostra geradas (escala de cinza no alfa, 128 px). */
  const SAMPLED = {
    spray: ['Spray', (c, s) => { const r = rng(3); for (let i = 0; i < 420; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * s * 0.48; c.globalAlpha = 0.25 + r() * 0.75; c.beginPath(); c.arc(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, 0.6 + r() * 1.6, 0, 7); c.fill(); } }],
    chalk: ['Giz', (c, s) => { const r = rng(5); for (let i = 0; i < 900; i++) { const x = r() * s, y = r() * s; if (Math.hypot(x - s / 2, y - s / 2) > s * 0.46) continue; c.globalAlpha = r() * 0.8; c.fillRect(x, y, 1 + r() * 3, 1 + r() * 2); } }],
    charcoal: ['Carvão', (c, s) => { const r = rng(7); c.translate(s / 2, s / 2); c.rotate(-0.5); for (let i = 0; i < 260; i++) { c.globalAlpha = 0.15 + r() * 0.5; c.fillRect((r() - 0.5) * s * 0.9, (r() - 0.5) * s * 0.35, 2 + r() * 10, 1 + r() * 2); } }],
    square: ['Quadrado', (c, s) => { c.fillRect(s * 0.1, s * 0.1, s * 0.8, s * 0.8); }],
    star: ['Estrela', (c, s) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? s * 0.2 : s * 0.48; c.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); } c.closePath(); c.fill(); }],
    grass: ['Grama', (c, s) => { const r = rng(9); for (let i = 0; i < 24; i++) { const x = s * 0.2 + r() * s * 0.6; c.globalAlpha = 0.5 + r() * 0.5; c.beginPath(); c.moveTo(x - 2, s); c.quadraticCurveTo(x + (r() - 0.5) * 30, s * 0.5, x + (r() - 0.5) * 40, s * (0.05 + r() * 0.3)); c.lineTo(x + 2, s); c.closePath(); c.fill(); } }],
    leaf: ['Folha', (c, s) => { c.beginPath(); c.moveTo(s / 2, s * 0.05); c.quadraticCurveTo(s * 0.95, s * 0.45, s / 2, s * 0.95); c.quadraticCurveTo(s * 0.05, s * 0.45, s / 2, s * 0.05); c.fill(); c.globalCompositeOperation = 'destination-out'; c.lineWidth = 3; c.beginPath(); c.moveTo(s / 2, s * 0.1); c.lineTo(s / 2, s * 0.9); c.stroke(); }],
    splatter: ['Respingo', (c, s) => { const r = rng(13); c.beginPath(); c.arc(s / 2, s / 2, s * 0.22, 0, 7); c.fill(); for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, d = s * (0.22 + r() * 0.25); c.beginPath(); c.arc(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, 1 + r() * s * 0.05, 0, 7); c.fill(); } }],
    texture: ['Textura seca', (c, s) => { const img = c.getImageData(0, 0, s, s), r = rng(17); for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const d = Math.hypot(x - s / 2, y - s / 2) / (s / 2); if (d > 1) continue; const i = (y * s + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = r() > 0.35 ? (1 - d * d) * 255 : 0; } c.putImageData(img, 0, 0); }],
    line: ['Caligrafia', (c, s) => { c.fillRect(s * 0.47, s * 0.05, s * 0.06, s * 0.9); }]
  };
  const Brushes = (IMG.Brushes = {
    tips: {},
    user: [],
    presets: [
      { name: 'Redondo duro 5', tip: 'round', size: 5, hardness: 100 }, { name: 'Redondo duro 13', tip: 'round', size: 13, hardness: 100 }, { name: 'Redondo duro 30', tip: 'round', size: 30, hardness: 100 }, { name: 'Redondo duro 60', tip: 'round', size: 60, hardness: 100 },
      { name: 'Redondo suave 13', tip: 'round', size: 13, hardness: 0 }, { name: 'Redondo suave 30', tip: 'round', size: 30, hardness: 0 }, { name: 'Redondo suave 60', tip: 'round', size: 60, hardness: 0 }, { name: 'Redondo suave 150', tip: 'round', size: 150, hardness: 0 },
      { name: 'Redondo 50% 45', tip: 'round', size: 45, hardness: 50 }
    ].concat(Object.keys(SAMPLED).map((k) => ({ name: SAMPLED[k][0], tip: k, size: 60, hardness: 100, spacing: k === 'spray' || k === 'splatter' || k === 'grass' || k === 'leaf' || k === 'star' ? 40 : 15 }))),
    init() {
      if (this._init) return; this._init = true;
      Object.keys(SAMPLED).forEach((k) => { const s = 128, c = U.createCanvas(s, s), x = c.getContext('2d'); x.fillStyle = '#fff'; x.strokeStyle = '#fff'; SAMPLED[k][1](x, s); this.tips[k] = c; });
      (U.store.get('userBrushes', []) || []).forEach((b) => { if (b.data) { U.loadImage(b.data).then((im) => { const c = U.createCanvas(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); this.tips[b.tip] = c; }).catch(() => {}); this.user.push(b); } });
    },
    all() { this.init(); return this.presets.concat(this.user); },
    /** Define um novo pincel a partir da seleção (ou da imagem inteira). */
    defineFromSelection(doc) {
      this.init();
      const comp = IMG.Engine.composite(doc);
      const b = doc.selection ? doc.selection.bounds : doc.rect;
      const w = Math.min(2500, b.w), h = Math.min(2500, b.h);
      const c = U.createCanvas(w, h), x = c.getContext('2d');
      x.drawImage(comp, -b.x, -b.y);
      if (doc.selection) { x.globalCompositeOperation = 'destination-in'; x.drawImage(doc.selection.canvas, -b.x, -b.y); }
      const img = x.getImageData(0, 0, w, h);
      for (let i = 0; i < img.data.length; i += 4) { const l = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]; const a = (255 - l) * (img.data[i + 3] / 255); img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a; }
      x.putImageData(img, 0, 0);
      const id = U.uid('tip');
      this.tips[id] = c;
      const name = 'Pincel ' + (this.user.length + 1);
      let data = null;
      try { const dc = U.domCanvas(w, h); dc.getContext('2d').drawImage(c, 0, 0); data = dc.toDataURL('image/png'); } catch (e) { /* ignore */ }
      const preset = { name, tip: id, size: Math.max(w, h), hardness: 100, spacing: 25, data };
      this.user.push(preset);
      try { U.store.set('userBrushes', this.user); } catch (e) { /* cota */ }
      bus.emit('brushes:change');
      return preset;
    }
  });

  /* cache de pontas prontas (por tamanho, dureza, cor) */
  const tipCache = new Map();
  function makeTip(size, hardness, color, tipId, aliased) {
    Brushes.init();
    size = Math.max(1, size);
    const q = size < 20 ? Math.round(size * 4) / 4 : Math.round(size);
    const key = (tipId || 'round') + '|' + q + '|' + hardness + '|' + color + '|' + (aliased ? 1 : 0);
    let c = tipCache.get(key);
    if (c) return c;
    if (tipId === 'block') {
      const d = Math.max(1, Math.round(q));
      c = U.createCanvas(d, d);
      const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, d, d);
    } else if (tipId && tipId !== 'round' && Brushes.tips[tipId]) {
      const src = Brushes.tips[tipId];
      const k = q / Math.max(src.width, src.height);
      const w = Math.max(1, Math.round(src.width * k)), h = Math.max(1, Math.round(src.height * k));
      c = U.createCanvas(w + 2, h + 2);
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(src, 1, 1, w, h);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    } else if (aliased) {
      const d = Math.max(1, Math.round(q)), r = d / 2;
      c = U.createCanvas(d, d);
      const x = c.getContext('2d'), img = x.createImageData(d, d), col = U.hexToRgb(color);
      for (let yy = 0; yy < d; yy++) for (let xx = 0; xx < d; xx++) {
        if (d > 2 && (xx + 0.5 - r) * (xx + 0.5 - r) + (yy + 0.5 - r) * (yy + 0.5 - r) > r * r) continue;
        const i = (yy * d + xx) * 4; img.data[i] = col.r; img.data[i + 1] = col.g; img.data[i + 2] = col.b; img.data[i + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    } else {
      const r = q / 2;
      const dim = Math.max(3, Math.ceil(q) + 2 + (Math.ceil(q) % 2 ? 0 : 1));
      const cx = dim / 2;
      c = U.createCanvas(dim, dim);
      const ctx = c.getContext('2d');
      if (q <= 1.5) { ctx.fillStyle = color; ctx.globalAlpha = Math.min(1, q); ctx.fillRect(Math.floor(cx), Math.floor(cx), 1, 1); }
      else if (hardness >= 0.99) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2); ctx.fill(); }
      else {
        const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
        const h = Math.max(0, Math.min(0.98, hardness));
        g.addColorStop(0, U.rgba(color, 1));
        g.addColorStop(h, U.rgba(color, 1));
        const NN = 10;
        for (let i = 1; i <= NN; i++) { const u = i / NN; g.addColorStop(h + (1 - h) * u, U.rgba(color, 0.5 * (1 + Math.cos(Math.PI * u)))); }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, dim, dim);
      }
    }
    if (tipCache.size > 80) tipCache.delete(tipCache.keys().next().value);
    tipCache.set(key, c);
    return c;
  }
  IMG.makeBrushTip = makeTip;

  /* ==================================================================
     Pincelada
     ================================================================== */
  const DYN_DEF = { sizeJitter: 0, minDiameter: 0, angleJitter: 0, roundJitter: 0, minRound: 25, flipX: false, flipY: false, flipXJ: false, flipYJ: false,
    scatter: 0, bothAxes: false, count: 1, countJitter: 0, fgbg: 0, hueJitter: 0, satJitter: 0, briJitter: 0, purity: 0, opacityJitter: 0, flowJitter: 0,
    shape: false, scatterOn: false, colorOn: false, transfer: false };
  IMG.BRUSH_DYN_DEF = DYN_DEF;

  /** Converte uma máscara (branco + alfa) em tons de cinza opacos. */
  function alphaToGray(c) {
    const o = U.createCanvas(c.width, c.height), x = o.getContext('2d');
    const img = c.getContext('2d').getImageData(0, 0, c.width, c.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = d[i + 3]; d[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    return o;
  }
  IMG.alphaToGray = alphaToGray;

  class Stroke {
    /**
     * o: { doc, layer, mode: 'paint'|'erase'|'clone'|'source', color, size, hardness, spacing, flow, opacity,
     *      blend, angle, roundness, tip, aliased, pressureSize, pressureOpacity, dyn, src, off }
     */
    constructor(o) {
      const doc = (this.doc = o.doc), L = (this.layer = o.layer);
      this.mode = o.mode || 'paint';
      this.size = Math.max(1, o.size); this.hardness = o.hardness; this.spacing = Math.max(0.01, o.spacing);
      this.flow = o.flow; this.pressureSize = !!o.pressureSize; this.pressureOpacity = !!o.pressureOpacity;
      this.angle = U.rad(o.angle || 0); this.roundness = U.clamp((o.roundness == null ? 100 : o.roundness) / 100, 0.01, 1);
      this.tipId = o.tip || 'round'; this.aliased = !!o.aliased;
      this.dyn = Object.assign({}, DYN_DEF, o.dyn || {});
      this.rnd = rng((Math.random() * 1e9) | 0);
      this.onMask = !!(doc.editMask && L.mask);
      if (this.onMask) { IMG.Layers.maskEnsureCovers(L.mask, doc.rect); this.surf = L.mask; }
      else { L.ensureCovers(doc.rect); this.surf = L; }
      this.sx = this.surf.x; this.sy = this.surf.y;
      this.base = U.cloneCanvas(this.surf.canvas);
      this.buf = U.createCanvas(doc.width, doc.height);
      this.bctx = this.buf.getContext('2d');
      this.selC = IMG.activeSelection(doc); this.clipTmp = this.selC ? U.createCanvas(doc.width, doc.height) : null;
      this.alpha = o.opacity;
      this.blend = o.blend || 'normal';
      this.op = 'source-over';
      let tipColor = o.color || '#000000';
      this.baseColor = tipColor;
      if (this.onMask) {
        // máscara: a pincelada guarda tons de cinza e é composta em JavaScript
        this.maskGray = true;
        const g = Math.round(U.luma(this.mode === 'erase' ? IMG.app.bg : tipColor) * 255);
        tipColor = U.rgbToHex(g, g, g);
        if (this.mode === 'erase') this.mode = 'paint';
        this.blend = 'normal';
      } else if (this.mode === 'erase' || this.blend === 'clear') { this.op = 'destination-out'; this.blend = 'normal'; }
      else if (this.blend === 'behind') { this.op = 'destination-over'; this.blend = 'normal'; }
      else if (L.lockAlpha) this.op = 'source-atop';
      if (this.mode === 'restore') { this.src = o.src; this.op = 'source-over'; this.blend = 'normal'; this.maskGray = false; tipColor = '#ffffff'; }
      this.colorDyn = this.dyn.colorOn && !this.onMask && this.mode === 'paint';
      this.tipColor = tipColor;
      this.tip = makeTip(this.size, this.hardness, this.colorDyn ? '#ffffff' : tipColor, this.tipId, this.aliased);
      if (this.mode === 'clone' || this.mode === 'source' || this.colorDyn) {
        this.src = o.src; this.off = o.off || { dx: 0, dy: 0 };
        if (this.src && this.maskGray && this.src.isMask) this.src = { canvas: alphaToGray(this.src.canvas), x: this.src.x, y: this.src.y };
        const D = Math.ceil(Math.hypot(this.tip.width, this.tip.height)) + 4;
        this.dab = U.createCanvas(D, D);
        this.dctx = this.dab.getContext('2d');
      }
      this.bbox = null; this.frame = null; this.last = null; this.rem = 0;
    }

    _dabAt(x, y, p) {
      const d = this.dyn, r = this.rnd;
      let s = this.pressureSize ? Math.max(0.05, p) : 1;
      let ang = this.angle, rnd = this.roundness, al = this.flow;
      if (this.pressureOpacity) al *= p;
      if (d.shape) {
        if (d.sizeJitter) s *= Math.max(d.minDiameter / 100, 1 - r() * d.sizeJitter / 100);
        if (d.angleJitter) ang += (r() - 0.5) * 2 * Math.PI * d.angleJitter / 100;
        if (d.roundJitter) rnd *= Math.max(d.minRound / 100, 1 - r() * d.roundJitter / 100);
      }
      if (d.transfer) { if (d.flowJitter) al *= 1 - r() * d.flowJitter / 100; if (d.opacityJitter) al *= 1 - r() * d.opacityJitter / 100; }
      let color = null;
      if (this.colorDyn) {
        let c = U.hexToRgb(this.baseColor);
        if (d.fgbg) { const t = r() * d.fgbg / 100, b2 = U.hexToRgb(IMG.app.bg); c = { r: c.r + (b2.r - c.r) * t, g: c.g + (b2.g - c.g) * t, b: c.b + (b2.b - c.b) * t }; }
        const hsv = U.rgbToHsv(c.r, c.g, c.b);
        if (d.hueJitter) hsv.h += (r() - 0.5) * 2 * 180 * d.hueJitter / 100;
        if (d.satJitter) hsv.s = U.clamp(hsv.s + (r() - 0.5) * 2 * d.satJitter / 100, 0, 1);
        if (d.briJitter) hsv.v = U.clamp(hsv.v + (r() - 0.5) * 2 * d.briJitter / 100, 0, 1);
        if (d.purity) hsv.s = U.clamp(hsv.s + d.purity / 100, 0, 1);
        const o = U.hsvToRgb(hsv.h, hsv.s, hsv.v); color = U.rgbToHex(o.r, o.g, o.b);
      }
      this._dab(x, y, s, ang, rnd, al, color);
    }

    _dab(x, y, s, ang, rnd, al, color) {
      const tw = this.tip.width * s, th = this.tip.height * s, b = this.bctx;
      if (this.aliased) { x = Math.floor(x) + (Math.round(tw) % 2 ? 0.5 : 0); y = Math.floor(y) + (Math.round(th) % 2 ? 0.5 : 0); }
      else if (this.size < 4 && this.hardness > 0.9 && !ang && rnd >= 1) { x = Math.floor(x) + 0.5; y = Math.floor(y) + 0.5; }
      const dy0 = this.dyn;
      const fx = (dy0.flipX ? -1 : 1) * (dy0.shape && dy0.flipXJ && this.rnd() < 0.5 ? -1 : 1), fy = (dy0.flipY ? -1 : 1) * (dy0.shape && dy0.flipYJ && this.rnd() < 0.5 ? -1 : 1);
      b.save();
      b.globalAlpha = Math.max(0, Math.min(1, al));
      b.translate(x, y);
      if (ang) b.rotate(ang);
      if (rnd < 1 || fx < 0 || fy < 0) b.scale(fx, rnd * fy);
      b.imageSmoothingEnabled = !this.aliased;
      if (this.mode === 'clone' || this.mode === 'source' || color) {
        // o carimbo é montado alinhado aos eixos: forma da ponta + conteúdo (cor ou origem)
        b.restore();
        const d = this.dctx, D = this.dab.width, ext = D / 2;
        const ox = Math.floor(x - ext), oy = Math.floor(y - ext);
        d.setTransform(1, 0, 0, 1, 0, 0);
        d.globalCompositeOperation = 'source-over'; d.globalAlpha = 1;
        d.clearRect(0, 0, D, D);
        d.save();
        d.translate(x - ox, y - oy);
        if (ang) d.rotate(ang);
        if (rnd < 1 || fx < 0 || fy < 0) d.scale(fx, rnd * fy);
        d.imageSmoothingEnabled = !this.aliased;
        d.drawImage(this.tip, -tw / 2, -th / 2, tw, th);
        d.restore();
        d.globalCompositeOperation = 'source-in';
        if (color) { d.fillStyle = color; d.fillRect(0, 0, D, D); }
        else if (this.src) d.drawImage(this.src.canvas, this.src.x + this.off.dx - ox, this.src.y + this.off.dy - oy);
        d.globalCompositeOperation = 'source-over';
        b.save();
        b.globalAlpha = Math.max(0, Math.min(1, al));
        b.drawImage(this.dab, ox, oy);
        b.restore();
      } else { b.drawImage(this.tip, -tw / 2, -th / 2, tw, th); b.restore(); }
      const ext = Math.max(tw, th) / 2 + 2;
      const r = { x: x - ext, y: y - ext, w: ext * 2, h: ext * 2 };
      this.bbox = U.rectUnion(this.bbox, r);
      this.frame = U.rectUnion(this.frame, r);
    }

    /** Carimbos (com dispersão) em um ponto da trajetória. */
    _stamp(x, y, p, dirx, diry) {
      const d = this.dyn;
      if (!d.scatterOn || (!d.scatter && d.count <= 1)) { this._dabAt(x, y, p); return; }
      const n = Math.max(1, Math.round(d.count * (1 - this.rnd() * (d.countJitter || 0) / 100)));
      for (let i = 0; i < n; i++) {
        const k = ((this.rnd() - 0.5) * 2 * (d.scatter || 0) / 100) * this.size;
        let ox = -diry * k, oy = dirx * k;
        if (d.bothAxes) { ox = (this.rnd() - 0.5) * 2 * (d.scatter / 100) * this.size; oy = (this.rnd() - 0.5) * 2 * (d.scatter / 100) * this.size; }
        this._dabAt(x + ox, y + oy, p);
      }
    }

    to(x, y, p = 1) {
      if (!this.last) { this._stamp(x, y, p, 1, 0); this.last = { x, y, p }; this.rem = 0; return; }
      const l = this.last, dx = x - l.x, dy = y - l.y, dist = Math.hypot(dx, dy);
      if (dist === 0) return;
      const step = Math.max(this.aliased ? 1 : 0.5, this.size * this.spacing * (this.pressureSize ? Math.max(0.2, p) : 1));
      let d = step - this.rem;
      while (d <= dist) {
        const t = d / dist;
        this._stamp(l.x + dx * t, l.y + dy * t, l.p + (p - l.p) * t, dx / dist, dy / dist);
        d += step;
      }
      this.rem = dist - (d - step);
      this.last = { x, y, p };
    }

    /** Aerógrafo: acumula tinta parado. */
    airbrush() { if (this.last) this._stamp(this.last.x, this.last.y, this.last.p, 1, 0); }

    /** Recompõe a área alterada desde o último quadro: base + pincelada. */
    compose() {
      if (!this.frame) return;
      const doc = this.doc, surf = this.surf;
      const fr = U.rectIntersect(U.rectInt(this.frame), { x: this.sx, y: this.sy, w: surf.canvas.width, h: surf.canvas.height });
      this.frame = null;
      if (!fr) return;
      const t = surf.canvas.getContext('2d');
      let src = this.buf;
      if (this.clipTmp) {
        const c = this.clipTmp.getContext('2d');
        c.save();
        c.beginPath(); c.rect(fr.x, fr.y, fr.w, fr.h); c.clip();
        c.globalCompositeOperation = 'copy'; c.drawImage(this.buf, 0, 0);
        c.globalCompositeOperation = 'destination-in'; c.drawImage(this.selC.canvas, 0, 0);
        c.restore();
        src = this.clipTmp;
      }
      const lx = fr.x - this.sx, ly = fr.y - this.sy;
      if (this.mode === 'restore') {
        // Pincel de histórico / Apagar para o histórico: interpola até os pixels do estado de origem
        const bi = this.base.getContext('2d').getImageData(lx, ly, fr.w, fr.h), bd = bi.data;
        const cd = src.getContext('2d').getImageData(fr.x, fr.y, fr.w, fr.h).data;
        if (!this._rt || this._rt.width < fr.w || this._rt.height < fr.h) this._rt = U.createCanvas(Math.max(fr.w, 64), Math.max(fr.h, 64));
        const rc = this._rt.getContext('2d');
        rc.clearRect(0, 0, fr.w, fr.h);
        if (this.src) rc.drawImage(this.src.canvas, this.src.x - fr.x, this.src.y - fr.y);
        const sd = rc.getImageData(0, 0, fr.w, fr.h).data, k = this.alpha / 255;
        const keepA = this.layer.lockAlpha && !this.onMask;
        for (let i = 0; i < bd.length; i += 4) {
          const c = cd[i + 3]; if (!c) continue;
          const t = c * k, a0 = bd[i + 3], as = this.onMask && (!this.src || this.src.empty) ? 255 : sd[i + 3];
          if (this.onMask) { bd[i + 3] = a0 + (as - a0) * t; continue; }
          const a = keepA ? a0 : a0 + (as - a0) * t;
          if (a <= 0) { bd[i + 3] = 0; continue; }
          if (keepA) { for (let q = 0; q < 3; q++) bd[i + q] = bd[i + q] + (sd[i + q] - bd[i + q]) * t; continue; }
          for (let q = 0; q < 3; q++) bd[i + q] = (bd[i + q] * a0 + (sd[i + q] * as - bd[i + q] * a0) * t) / a;
          bd[i + 3] = a;
        }
        if (this.onMask) for (let i = 0; i < bd.length; i += 4) bd[i] = bd[i + 1] = bd[i + 2] = 255;
        t.putImageData(bi, lx, ly);
        IMG.markDirty(surf, { x: lx, y: ly, w: fr.w, h: fr.h });
        IMG.Effects.invalidate(this.layer);
        IMG.Engine.invalidateLayer(this.layer, fr);
        return;
      }
      if (this.maskGray) {
        // máscara: alfa = alfa + (cinza − alfa) × cobertura × opacidade
        const bi = this.base.getContext('2d').getImageData(lx, ly, fr.w, fr.h), bd = bi.data;
        const sd = src.getContext('2d').getImageData(fr.x, fr.y, fr.w, fr.h).data, k = this.alpha / 255;
        for (let i = 0; i < bd.length; i += 4) {
          const cov = sd[i + 3];
          if (cov) { const a0 = bd[i + 3]; bd[i + 3] = a0 + (sd[i] - a0) * cov * k; }
          bd[i] = bd[i + 1] = bd[i + 2] = 255;
        }
        t.putImageData(bi, lx, ly);
        IMG.markDirty(surf, { x: lx, y: ly, w: fr.w, h: fr.h });
        IMG.Engine.invalidateLayer(this.layer, fr);
        return;
      }
      t.save();
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.beginPath(); t.rect(lx, ly, fr.w, fr.h); t.clip();
      t.globalAlpha = 1; t.globalCompositeOperation = 'copy';
      t.drawImage(this.base, 0, 0);
      const native = IMG.Blend.NATIVE[this.blend];
      if (this.op !== 'source-over' || (native && (this.blend === 'normal' || !this.layer.lockAlpha))) {
        t.globalAlpha = this.alpha;
        t.globalCompositeOperation = this.op !== 'source-over' ? this.op : native;
        t.drawImage(src, -this.sx, -this.sy);
        t.restore();
      } else {
        t.restore();
        // modos calculados em JavaScript (e modos com "preservar transparência")
        const di = t.getImageData(lx, ly, fr.w, fr.h);
        const si = src.getContext('2d').getImageData(fr.x, fr.y, fr.w, fr.h);
        const keep = this.layer.lockAlpha ? new Uint8ClampedArray(di.data) : null;
        IMG.Blend.blendPixels(di.data, si.data, this.blend, this.alpha, null);
        if (keep) for (let i = 3; i < keep.length; i += 4) di.data[i] = keep[i];
        t.putImageData(di, lx, ly);
      }
      IMG.markDirty(surf, { x: lx, y: ly, w: fr.w, h: fr.h });
      IMG.Effects.invalidate(this.layer);
      IMG.Engine.invalidateLayer(this.layer, fr);
    }

    end(name) {
      IMG.Engine.endStrokeCache();
      if (!this.bbox) { this.base = this.buf = null; return false; }
      this.frame = this.bbox;
      this.compose();
      this.base = this.buf = this.clipTmp = null;
      bus.emit('layer:pixels', this.layer);
      IMG.commit(name);
      IMG.lastPixelOp = { layerId: this.layer.id, label: name, onMask: this.onMask };
      return true;
    }
  }
  IMG.Stroke = Stroke;

  /** Reconstrói um canvas a partir de um instantâneo do histórico. */
  function snapCanvas(snap) {
    const c = U.createCanvas(snap.w, snap.h), x = c.getContext('2d');
    for (let ty = 0; ty < snap.rows; ty++) for (let tx = 0; tx < snap.cols; tx++) { const t = snap.tiles[ty * snap.cols + tx]; if (t) x.drawImage(t, tx * 256, ty * 256); }
    return c;
  }
  IMG.snapCanvas = snapCanvas;
  /** Estado de origem do Pincel de histórico (o primeiro estado, se nenhum foi escolhido). */
  IMG.historySourceState = function (doc) {
    const H = doc.history;
    if (doc.histSource && H.states.includes(doc.histSource)) return doc.histSource;
    return H.states[0] || null;
  };
  /** Pixels da camada L (ou da máscara) no estado de origem do histórico: { canvas, x, y } ou null. */
  IMG.historySource = function (doc, L, onMask) {
    const st = IMG.historySourceState(doc);
    if (!st) return null;
    if (st.width !== doc.width || st.height !== doc.height) { IMG.UI.toast('O estado de origem do histórico tem outro tamanho de tela.', 'error'); return null; }
    const n = IMG.findNode(st, L.id);
    if (!n) { IMG.UI.toast('O estado de origem do histórico não contém a camada atual.', 'error'); return null; }
    if (onMask) { if (!n.mask) return { canvas: U.createCanvas(1, 1), x: -10, y: -10, isMask: true, empty: true }; return { canvas: snapCanvas(n.mask.snap), x: n.mask.x, y: n.mask.y, isMask: true }; }
    if (!n.snap) { IMG.UI.toast('A camada de origem do histórico não tem pixels.', 'error'); return null; }
    return { canvas: snapCanvas(n.snap), x: n.x, y: n.y };
  };

  /* ==================================================================
     Pincelada de processamento de pixels (Desfoque, Nitidez, Borrar,
     Subexposição, Superexposição, Esponja, Substituir cor, Borracha de fundo)
     process(data, weights, w, h, info) altera "data" no lugar.
     ================================================================== */
  class PixelStroke {
    /**
     * o: { doc, layer, size, hardness, spacing, pressure, state, grow, pad,
     *      process(data, wts, w, h, info)            — modo acumulativo (altera "data" no lugar)
     *      amount(base, wts, w, h, info) / apply(base, cov, w, h, info) — modo não acumulativo:
     *      a cobertura de cada pixel é o máximo dos carimbos, e o resultado é sempre
     *      recalculado a partir dos pixels originais (como a opacidade de um pincel). }
     */
    constructor(o) {
      const doc = (this.doc = o.doc), L = (this.layer = o.layer);
      this.size = Math.max(1, o.size); this.hardness = o.hardness; this.spacing = Math.max(0.05, o.spacing || 0.25);
      this.pressure = !!o.pressure; this.process = o.process; this.state = o.state || {};
      this.amount = o.amount || null; this.apply = o.apply || null;
      this.pad = o.pad || 0; this.ignoreLock = !!o.ignoreLock;
      this.onMask = !!(doc.editMask && L.mask);
      this.surf = this.onMask ? L.mask : L;
      if (this.onMask) IMG.Layers.maskEnsureCovers(L.mask, doc.rect);
      else if (o.grow !== false) L.ensureCovers(doc.rect);
      const as = IMG.activeSelection(doc); this.selMask = as ? as.canvas : null;
      if (this.apply) {
        this.base = U.cloneCanvas(this.surf.canvas);
        this.cov = new Float32Array(this.surf.canvas.width * this.surf.canvas.height);
      }
      this.bbox = null; this.last = null; this.rem = 0;
    }
    weights(w, h, cx, cy, R) {
      const out = new Float32Array(w * h), hard = this.hardness;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / R;
        if (d >= 1) continue;
        out[y * w + x] = d <= hard ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - hard) / Math.max(0.01, 1 - hard)));
      }
      return out;
    }
    _read(ctx, r) {
      const img = ctx.getImageData(r.x, r.y, r.w, r.h);
      if (this.onMask) { const d = img.data; for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = d[i + 3]; d[i + 3] = 255; } }
      return img;
    }
    _write(img) {
      if (!this.onMask) return img;
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) { d[i + 3] = d[i]; d[i] = d[i + 1] = d[i + 2] = 255; }
      return img;
    }
    _dab(x, y, p) {
      const s = this.pressure ? Math.max(0.1, p) : 1, R = (this.size * s) / 2;
      const surf = this.surf, sx = surf.x, sy = surf.y, P = this.pad;
      const r = U.rectIntersect(U.rectInt({ x: x - R - 1 - sx - P, y: y - R - 1 - sy - P, w: R * 2 + 2 + P * 2, h: R * 2 + 2 + P * 2 }), { x: 0, y: 0, w: surf.canvas.width, h: surf.canvas.height });
      if (!r) return;
      const ctx = surf.canvas.getContext('2d');
      const wts = this.weights(r.w, r.h, x - sx - r.x, y - sy - r.y, R);
      if (this.selMask) {
        const m = U.createCanvas(r.w, r.h), mc = m.getContext('2d');
        mc.drawImage(this.selMask, -(r.x + sx), -(r.y + sy));
        const md = mc.getImageData(0, 0, r.w, r.h).data;
        for (let i = 0; i < wts.length; i++) wts[i] *= md[i * 4 + 3] / 255;
      }
      const info = { x: x - sx - r.x, y: y - sy - r.y, R, p, state: this.state, stroke: this, gx: r.x + sx, gy: r.y + sy, onMask: this.onMask };
      const keepA = !this.onMask && this.layer.lockAlpha && !this.ignoreLock;
      let img;
      if (this.apply) {
        img = this._read(this.base.getContext('2d'), r);
        const amt = this.amount ? this.amount(img.data, wts, r.w, r.h, info) || wts : wts;
        const W = surf.canvas.width, cov = new Float32Array(r.w * r.h);
        for (let yy = 0; yy < r.h; yy++) {
          const row = (r.y + yy) * W + r.x;
          for (let xx = 0; xx < r.w; xx++) { const j = row + xx, a = amt[yy * r.w + xx]; if (a > this.cov[j]) this.cov[j] = a; cov[yy * r.w + xx] = this.cov[j]; }
        }
        const keep = keepA ? new Uint8ClampedArray(img.data) : null;
        this.apply(img.data, cov, r.w, r.h, info);
        if (keep) for (let i = 3; i < keep.length; i += 4) img.data[i] = keep[i];
      } else {
        img = this._read(ctx, r);
        const keep = keepA ? new Uint8ClampedArray(img.data) : null;
        this.process(img.data, wts, r.w, r.h, info);
        if (keep) for (let i = 3; i < keep.length; i += 4) img.data[i] = keep[i];
      }
      ctx.putImageData(this._write(img), r.x, r.y);
      const dr = { x: r.x + sx, y: r.y + sy, w: r.w, h: r.h };
      this.bbox = U.rectUnion(this.bbox, dr);
      IMG.markDirty(surf, r);
      IMG.Effects.invalidate(this.layer);
      IMG.Engine.invalidateLayer(this.layer, dr);
    }
    to(x, y, p = 1) {
      if (!this.last) { this._dab(x, y, p); this.last = { x, y, p }; this.rem = 0; return; }
      const l = this.last, dx = x - l.x, dy = y - l.y, dist = Math.hypot(dx, dy);
      if (dist === 0) return;
      const step = Math.max(1, this.size * this.spacing);
      let d = step - this.rem;
      while (d <= dist) { const t = d / dist; this.state.dir = { x: dx / dist, y: dy / dist }; this._dab(l.x + dx * t, l.y + dy * t, l.p + (p - l.p) * t); d += step; }
      this.rem = dist - (d - step);
      this.last = { x, y, p };
    }
    compose() {}
    airbrush() { if (this.last) this._dab(this.last.x, this.last.y, this.last.p); }
    end(name) {
      this.base = null; this.cov = null;
      if (!this.bbox) return false;
      bus.emit('layer:pixels', this.layer);
      IMG.commit(name);
      IMG.lastPixelOp = { layerId: this.layer.id, label: name, onMask: this.onMask };
      return true;
    }
  }
  IMG.PixelStroke = PixelStroke;

  /* ==================================================================
     Pincelada de máscara (Pincel de recuperação para manchas etc.):
     só desenha a forma em um canvas do documento; a ferramenta decide o que fazer.
     ================================================================== */
  class MaskStroke {
    constructor(o) {
      this.doc = o.doc; this.layer = o.layer;
      this.size = Math.max(1, o.size); this.spacing = Math.max(0.05, o.spacing || 0.15); this.pressure = !!o.pressure;
      this.c = U.createCanvas(o.doc.width, o.doc.height); this.ctx = this.c.getContext('2d');
      this.tip = makeTip(this.size, o.hardness == null ? 1 : o.hardness, '#000000', o.tip, false);
      this.bbox = null; this.last = null; this.rem = 0;
    }
    _dab(x, y, p) {
      const s = this.pressure ? Math.max(0.1, p) : 1, tw = this.tip.width * s, th = this.tip.height * s;
      this.ctx.drawImage(this.tip, x - tw / 2, y - th / 2, tw, th);
      this.bbox = U.rectUnion(this.bbox, { x: x - tw / 2 - 1, y: y - th / 2 - 1, w: tw + 2, h: th + 2 });
    }
    to(x, y, p = 1) {
      if (!this.last) { this._dab(x, y, p); this.last = { x, y, p }; return; }
      const l = this.last, dx = x - l.x, dy = y - l.y, dist = Math.hypot(dx, dy);
      if (dist === 0) return;
      const step = Math.max(1, this.size * this.spacing);
      let d = step - this.rem;
      while (d <= dist) { const t = d / dist; this._dab(l.x + dx * t, l.y + dy * t, l.p + (p - l.p) * t); d += step; }
      this.rem = dist - (d - step);
      this.last = { x, y, p };
    }
    compose() { IMG.Engine.requestRender(); }
    airbrush() {}
    /** Desenha a pincelada (preto translúcido) na sobreposição. */
    draw(ctx, v, alpha) {
      ctx.save(); ctx.globalAlpha = alpha == null ? 0.5 : alpha; ctx.imageSmoothingEnabled = v.zoom < 1;
      ctx.drawImage(this.c, v.x, v.y, this.doc.width * v.zoom, this.doc.height * v.zoom); ctx.restore();
    }
  }
  IMG.MaskStroke = MaskStroke;

  /* ==================================================================
     Interface: seletor de pincel e controles da barra de opções
     ================================================================== */
  function brushPreview(o, w, h) {
    const c = U.domCanvas(w, h), ctx = c.getContext('2d');
    const size = Math.min(h - 4, Math.max(3, o.size));
    const tip = makeTip(size, (o.hardness == null ? 100 : o.hardness) / 100, '#d6d9de', o.tip, false);
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(U.rad(o.angle || 0)); ctx.scale(1, (o.roundness == null ? 100 : o.roundness) / 100);
    ctx.drawImage(tip, -tip.width / 2, -tip.height / 2); ctx.restore();
    return c;
  }
  IMG.brushPreview = brushPreview;

  /** Botão do seletor de pincel (tamanho, dureza, predefinições). */
  /** Conteúdo do seletor de predefinições (tamanho, dureza, pontas). */
  function brushPopContent(toolId, onChange) {
    const T = IMG.Tools, UI = IMG.UI, o = T.o(toolId);
    const box = el('div.brush-pop');
    const sz = UI.slider({ label: 'Tamanho', value: o.size, min: 1, max: 2500, pow: 2.6, unit: 'px', stack: true, onInput: (v) => { T.setOpt(toolId, 'size', v, true); onChange(); } });
    const hd = o.hardness == null ? null : UI.slider({ label: 'Dureza', value: o.hardness, min: 0, max: 100, unit: '%', stack: true, onInput: (v) => { T.setOpt(toolId, 'hardness', v, true); onChange(); } });
    const grid = el('div.brush-grid');
    Brushes.all().forEach((pr) => {
      const cell = el('button.brush-cell' + (o.tip === pr.tip && o.size === pr.size ? '.sel' : ''), { type: 'button', title: pr.name }, brushPreview({ size: Math.min(36, pr.size), hardness: pr.hardness, tip: pr.tip }, 44, 40), el('small', { text: String(pr.size) }));
      cell.addEventListener('click', () => {
        T.setOpt(toolId, 'tip', pr.tip, true); T.setOpt(toolId, 'size', pr.size, true);
        if ('hardness' in o) T.setOpt(toolId, 'hardness', pr.hardness, true);
        if ('spacing' in o && pr.spacing) T.setOpt(toolId, 'spacing', pr.spacing, true);
        grid.querySelectorAll('.sel').forEach((n) => n.classList.remove('sel')); cell.classList.add('sel');
        onChange(); sz.set(pr.size); if (hd) hd.set(pr.hardness);
      });
      cell.addEventListener('dblclick', () => UI.closePopover());
      grid.appendChild(cell);
    });
    box.append(sz.el); if (hd) box.append(hd.el); box.append(grid);
    return box;
  }
  IMG.brushPopContent = brushPopContent;

  /** Botão do seletor de pincel (tamanho, dureza, predefinições). */
  function brushPicker(toolId) {
    const T = IMG.Tools, UI = IMG.UI;
    const o = T.o(toolId);
    const btn = el('button.brush-pick', { type: 'button', title: 'Predefinições do pincel' });
    const paint = () => { U.clear(btn); btn.append(brushPreview(o, 26, 22), el('span', { text: String(Math.round(o.size)) }), IMG.iconEl('chevronDown', 10)); };
    paint();
    btn.addEventListener('click', () => {
      if (UI._pop && UI._pop.anchor === btn) { UI.closePopover(); return; }
      UI.popover(btn, brushPopContent(toolId, paint));
    });
    return btn;
  }
  IMG.brushPicker = brushPicker;

  const BRUSH_MODES = [['normal', 'Normal'], ['dissolve', 'Dissolver'], ['behind', 'Atrás'], ['clear', 'Limpar'], null].concat(IMG.BLEND_LIST.slice(3));
  IMG.BRUSH_MODES = BRUSH_MODES;

  /* ------------------------------------------------------------------
     Fábrica de ferramentas baseadas em pincelada
     cfg: { id, name, icon, mode, kind ('stroke' | 'pixel'), defaults, extraOptions(o),
            color(), begin(ev, tool), prepare(ev, tool, L), process(o, ev, tool), endStroke(s, tool),
            label, aliased, altPick, altHandled, overlay }
     ------------------------------------------------------------------ */
  IMG.makeBrushTool = function (cfg) {
    const tool = {
      id: cfg.id, name: cfg.name, icon: cfg.icon, hint: cfg.hint, noCtrlMove: cfg.noCtrlMove,
      defaults: Object.assign({ size: 30, hardness: 100, spacing: 12, flow: 100, opacity: 100, smoothing: 10, mode: 'normal', angle: 0, roundness: 100, tip: 'round', airbrush: false, pSize: true, pOpacity: false, dyn: Object.assign({}, DYN_DEF) }, cfg.defaults || {}),
      cursor: 'crosshair',
      pos: null, stroke: null, lastEnd: null,

      options() {
        const o = IMG.Tools.o(cfg.id), list = [];
        list.push({ type: 'custom', build: () => brushPicker(cfg.id) });
        if (cfg.showMode !== false && 'mode' in o) list.push({ type: 'select', key: 'mode', label: 'Modo', options: cfg.modes || BRUSH_MODES, width: 130 });
        if (cfg.showOpacity !== false && 'opacity' in o) list.push({ type: 'slider', key: 'opacity', label: cfg.opacityLabel || 'Opacidade', min: 1, max: 100, step: 1, unit: '%' });
        if ('flow' in o && cfg.showFlow !== false) list.push({ type: 'slider', key: 'flow', label: cfg.flowLabel || 'Fluxo', min: 1, max: 100, step: 1, unit: '%' });
        if (cfg.extraOptions) list.push(...cfg.extraOptions(o));
        if (cfg.showSmoothing !== false && 'smoothing' in o) list.push({ type: 'slider', key: 'smoothing', label: 'Suavização', min: 0, max: 100, step: 1, unit: '%' });
        if (cfg.kind !== 'pixel' && cfg.showAirbrush !== false) list.push({ type: 'custom', build: () => IMG.UI.iconBtn('airbrush', 'Aerógrafo: acumula tinta com o botão pressionado', () => { IMG.Tools.setOpt(cfg.id, 'airbrush', !IMG.Tools.o(cfg.id).airbrush); IMG.UI.renderOptions(); }, { active: o.airbrush }) });
        list.push({ type: 'custom', build: () => IMG.UI.iconBtn('pressureSize', 'A pressão da caneta controla o tamanho', () => { IMG.Tools.setOpt(cfg.id, 'pSize', !IMG.Tools.o(cfg.id).pSize); IMG.UI.renderOptions(); }, { active: o.pSize }) });
        if (cfg.kind !== 'pixel') list.push({ type: 'custom', build: () => IMG.UI.iconBtn('pressureOpacity', 'A pressão da caneta controla a opacidade', () => { IMG.Tools.setOpt(cfg.id, 'pOpacity', !IMG.Tools.o(cfg.id).pOpacity); IMG.UI.renderOptions(); }, { active: o.pOpacity }) });
        list.push({ type: 'custom', build: () => IMG.UI.iconBtn('brushSettings', 'Configurações do pincel (painel Pincel)', () => IMG.UI.showPanel('brush')) });
        return list;
      },

      activate() { this.pos = null; },
      /** Clique com o botão direito na tela: seletor de pincel no ponteiro (como no Photoshop/Photopea). */
      context(ev) {
        const UI = IMG.UI, e = ev.e || {};
        const a = el('div', { style: { position: 'fixed', left: (e.clientX || 0) + 'px', top: (e.clientY || 0) + 'px', width: '1px', height: '1px', pointerEvents: 'none' } });
        document.body.appendChild(a);
        UI.popover(a, brushPopContent(cfg.id, () => { const b = document.querySelector('#optionsbar .brush-pick'); if (b) { U.clear(b); b.append(brushPreview(IMG.Tools.o(cfg.id), 26, 22), el('span', { text: String(Math.round(IMG.Tools.o(cfg.id).size)) }), IMG.iconEl('chevronDown', 10)); } IMG.Engine.requestRender(); }), { onClose: () => a.remove() });
      },
      deactivate() { this.pos = null; clearInterval(this._air); },

      down(ev) {
        const doc = IMG.app.doc, o = IMG.Tools.o(cfg.id);
        this.pos = { sx: ev.sx, sy: ev.sy };
        if (cfg.altPick !== false && ev.alt && !cfg.altHandled) { this.picking = true; pickColor(ev); return; }
        let extra = {};
        if (cfg.begin) { extra = cfg.begin(ev, this); if (extra === false) return false; }
        if (this.busy) return false;
        const L = IMG.Layers.paintTarget(doc, cfg.paintOpts);
        if (!L) return false;
        let mode = cfg.mode, color = cfg.color ? cfg.color() : IMG.app.fg;
        if (mode === 'erase' && (L.lockAlpha || L.isBg) && !(doc.editMask && L.mask)) { mode = 'paint'; color = IMG.app.bg; }
        if (cfg.prepare) { const r = cfg.prepare(ev, this, L, extra); if (r === false) return false; Object.assign(extra, r); }
        const hard = (o.hardness == null ? 100 : o.hardness) / 100;
        if (cfg.makeStroke) {
          this.stroke = cfg.makeStroke(Object.assign({ doc, layer: L, size: o.size, hardness: hard, spacing: (o.spacing == null ? 25 : o.spacing) / 100, pressure: ev.pen && o.pSize }, extra), ev, this);
          if (!this.stroke) return false;
        } else if (cfg.kind === 'pixel') {
          const pr = cfg.process(o, ev, this, L);
          if (pr === false) return false;
          this.stroke = new PixelStroke(Object.assign({ doc, layer: L, size: o.size, hardness: hard, spacing: (o.spacing == null ? 25 : o.spacing) / 100, pressure: ev.pen && o.pSize }, typeof pr === 'function' ? { process: pr } : pr, extra));
        } else {
          this.stroke = new Stroke(Object.assign({
            doc, layer: L, mode, color, size: o.size, hardness: hard, spacing: (o.spacing == null ? 12 : o.spacing) / 100,
            flow: (o.flow == null ? 100 : o.flow) / 100, opacity: (o.opacity == null ? 100 : o.opacity) / 100, blend: o.mode || 'normal',
            angle: o.angle, roundness: o.roundness, tip: o.tip, aliased: !!cfg.aliased, pressureSize: ev.pen && o.pSize, pressureOpacity: ev.pen && o.pOpacity, dyn: o.dyn
          }, extra));
        }
        this.sm = { x: ev.x, y: ev.y };
        const key = doc.id;
        if (ev.shift && this.lastEnd && this.lastEnd.doc === key && cfg.mode !== 'clone') {
          this.stroke.to(this.lastEnd.x, this.lastEnd.y, ev.pressure);
          this.stroke.to(ev.x, ev.y, ev.pressure);
        } else this.stroke.to(ev.x, ev.y, ev.pressure);
        this.stroke.compose();
        this.raw = { x: ev.x, y: ev.y, p: ev.pressure };
        clearInterval(this._air);
        if (o.airbrush && cfg.kind !== 'pixel') this._air = setInterval(() => { if (this.stroke) { this.stroke.airbrush(); this.stroke.compose(); } }, 60);
        else if (cfg.repeatDab) this._air = setInterval(() => { if (this.stroke) this.stroke.airbrush(); }, 80);
      },

      move(ev) {
        this.pos = { sx: ev.sx, sy: ev.sy };
        if (this.picking) { pickColor(ev); return; }
        const s = this.stroke;
        if (!s) { if (cfg.drag) cfg.drag(ev, this); IMG.Engine.requestRender(); return; }
        const o = IMG.Tools.o(cfg.id);
        const k = 1 - U.clamp((o.smoothing || 0) / 100, 0, 1) * 0.88;
        const list = ev.e.getCoalescedEvents ? ev.e.getCoalescedEvents() : null;
        const feed = (x, y, p) => {
          this.sm.x += (x - this.sm.x) * k; this.sm.y += (y - this.sm.y) * k;
          s.to(this.sm.x, this.sm.y, p);
          this.raw = { x, y, p };
        };
        if (list && list.length > 1) for (const ce of list) { const q = IMG.Tools.ev(ce); feed(q.x, q.y, q.pressure); }
        else feed(ev.x, ev.y, ev.pressure);
        s.compose();
        IMG.Engine.requestRender();
      },

      up(ev) {
        clearInterval(this._air);
        if (this.picking) { this.picking = false; return; }
        const s = this.stroke;
        this.stroke = null;
        if (cfg.finish) cfg.finish(ev, this, s);
        if (!s) return;
        if (this.raw && (this.sm.x !== this.raw.x || this.sm.y !== this.raw.y)) s.to(this.raw.x, this.raw.y, this.raw.p);
        this.lastEnd = { doc: s.doc.id, x: s.last ? s.last.x : ev.x, y: s.last ? s.last.y : ev.y };
        if (cfg.endStroke) cfg.endStroke(s, this); else s.end(cfg.label || cfg.name);
      },

      hover(ev) {
        this.pos = { sx: ev.sx, sy: ev.sy };
        const o = IMG.Tools.o(cfg.id);
        const ci = cfg.cursorInfo ? cfg.cursorInfo(o, IMG.app.doc.view) : null;
        IMG.Tools.cursor(ev.alt && cfg.altPick !== false && !cfg.altHandled ? 'copy' : ci && ci.square ? 'none' : o.size * IMG.app.doc.view.zoom < 7 ? 'crosshair' : 'none');
        IMG.Engine.requestRender();
      },
      leave() { this.pos = null; IMG.Engine.requestRender(); },

      onKey(e) {
        const T = IMG.Tools, o = T.o(cfg.id);
        const k = e.key;
        if ((k === '[' || k === ']') && !e.shiftKey) {
          const cur = o.size, st = cur < 10 ? 1 : cur < 50 ? 5 : cur < 200 ? 10 : 25;
          T.setOpt(cfg.id, 'size', U.clamp(cur + (k === ']' ? st : -st), 1, 2500));
          IMG.UI.renderOptions();
          return true;
        }
        if ((k === '{' || k === '}' || ((k === '[' || k === ']') && e.shiftKey)) && 'hardness' in o) { const up = k === '}' || k === ']'; T.setOpt(cfg.id, 'hardness', U.clamp(o.hardness + (up ? 25 : -25), 0, 100)); IMG.UI.renderOptions(); return true; }
        const dm = /^(?:Digit|Numpad)([0-9])$/.exec(e.code || ''), dg = dm ? dm[1] : (/^[0-9]$/.test(k) ? k : null);
        if (dg !== null && !e.ctrlKey && !e.altKey && !e.metaKey && 'opacity' in o) {
          const k = dg, now = Date.now(), v = k === '0' ? 100 : +k * 10, key = e.shiftKey && 'flow' in o ? 'flow' : 'opacity';
          if (this._numT && now - this._numT < 600 && this._numK) { T.setOpt(cfg.id, key, U.clamp(+(this._numK + k), 1, 100)); this._numK = null; }
          else { T.setOpt(cfg.id, key, v); this._numK = k; }
          this._numT = now;
          IMG.UI.renderOptions();
          return true;
        }
        return cfg.key2 ? cfg.key2(e, this) : false;
      },

      drawOverlay(ctx, v) {
        if (cfg.overlay) cfg.overlay(ctx, v, this);
        const p = this.pos;
        if (!p) return;
        const o = IMG.Tools.o(cfg.id), ci = cfg.cursorInfo ? cfg.cursorInfo(o, v) : null;
        if (ci && ci.square) {
          const h = ci.size / 2;
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeRect(Math.round(p.sx - h) - 0.5, Math.round(p.sy - h) - 0.5, ci.size + 1, ci.size + 1);
          ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeRect(Math.round(p.sx - h) + 0.5, Math.round(p.sy - h) + 0.5, ci.size - 1, ci.size - 1);
          return;
        }
        const r = (o.size * v.zoom) / 2;
        if (r < 3.5) return;
        ctx.lineWidth = 1;
        const rn = (o.roundness == null ? 100 : o.roundness) / 100, an = U.rad(o.angle || 0);
        const shape = (rr) => { ctx.beginPath(); if (o.tip && o.tip !== 'round') ctx.rect(p.sx - rr, p.sy - rr, rr * 2, rr * 2); else ctx.ellipse(p.sx, p.sy, rr, Math.max(0.5, rr * rn), an, 0, Math.PI * 2); };
        ctx.strokeStyle = 'rgba(0,0,0,.75)'; shape(r + 0.5); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; shape(Math.max(0.5, r - 0.5)); ctx.stroke();
        if (o.hardness != null && o.hardness < 95 && r > 10 && (!o.tip || o.tip === 'round')) {
          ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(255,255,255,.45)';
          shape(r * (o.hardness / 100)); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    };
    return tool;
  };

  function pickColor(ev) {
    const doc = IMG.app.doc;
    if (ev.x < 0 || ev.y < 0 || ev.x >= doc.width || ev.y >= doc.height) return;
    const c = IMG.Engine.sample(doc, ev.x, ev.y, 1);
    if (c) IMG.app.setFg(U.rgbToHex(c.r, c.g, c.b));
  }
  IMG.pickColorAt = pickColor;

  /* ---------- Pincel ---------- */
  IMG.Tools.register(IMG.makeBrushTool({
    id: 'brush', name: 'Pincel', icon: 'brush', mode: 'paint',
    hint: 'Alt: conta-gotas · Shift+clique: linha reta · [ ]: tamanho',
    defaults: { size: 24, hardness: 85, spacing: 12, flow: 100, opacity: 100, smoothing: 15 }
  }));

  /* ---------- Lápis ---------- */
  IMG.Tools.register(IMG.makeBrushTool({
    id: 'pencil', name: 'Lápis', icon: 'pencil', mode: 'paint', aliased: true, showFlow: false,
    hint: 'Traço sem suavização (borda serrilhada) · Alt: conta-gotas',
    defaults: { size: 1, hardness: 100, spacing: 5, opacity: 100, smoothing: 0, autoErase: false },
    extraOptions: () => [{ type: 'check', key: 'autoErase', label: 'Apagamento automático', title: 'Começando sobre a cor do primeiro plano, pinta com a cor de fundo' }],
    color() {
      const o = IMG.Tools.o('pencil'), doc = IMG.app.doc, ev = IMG.Tools.last;
      if (o.autoErase && ev) { const c = IMG.Engine.sample(doc, ev.x, ev.y, 1); if (c && U.rgbToHex(c.r, c.g, c.b) === IMG.app.fg) return IMG.app.bg; }
      return IMG.app.fg;
    }
  }));
})();
