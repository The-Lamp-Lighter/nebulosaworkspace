/* ==========================================================================
   Imaginarium — grupo do Conta-gotas (I) e grupo do Gradiente (G)
   Conta-gotas, Amostra de cor, Régua, Contagem · Gradiente, Balde de tinta
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus;
  const Layers = IMG.Layers, Sel = IMG.Selection;
  const T = () => IMG.Tools;

  /**
   * Compõe um canvas do tamanho do documento sobre o alvo de pintura
   * (camada ou máscara), respeitando seleção, modo, opacidade e
   * "preservar transparência". Retorna true se algo foi pintado.
   */
  IMG.paintCanvas = function (doc, L, src, o = {}) {
    const onMask = !!(doc.editMask && L.mask);
    let surf;
    if (onMask) { Layers.maskEnsureCovers(L.mask, doc.rect); surf = L.mask; } else { L.ensureCovers(doc.rect); surf = L; }
    Sel.clip(doc, src);
    const op = o.opacity == null ? 1 : o.opacity, mode = o.mode || 'normal';
    const t = surf.canvas.getContext('2d');
    if (onMask) {
      const W = surf.canvas.width, H = surf.canvas.height;
      const md = t.getImageData(0, 0, W, H);
      const sc = U.createCanvas(W, H); sc.getContext('2d').drawImage(src, surf.x, surf.y);
      const sd = sc.getContext('2d').getImageData(0, 0, W, H).data, d = md.data;
      for (let i = 0; i < d.length; i += 4) {
        const sa = sd[i + 3]; if (!sa) continue;
        const g = 0.2126 * sd[i] + 0.7152 * sd[i + 1] + 0.0722 * sd[i + 2];
        d[i + 3] += (g - d[i + 3]) * (sa / 255) * op;
      }
      t.putImageData(md, 0, 0);
    } else if (mode === 'clear') {
      t.save(); t.globalAlpha = op; t.globalCompositeOperation = 'destination-out'; t.drawImage(src, -surf.x, -surf.y); t.restore();
    } else if (mode === 'behind') {
      t.save(); t.globalAlpha = op; t.globalCompositeOperation = 'destination-over'; t.drawImage(src, -surf.x, -surf.y); t.restore();
    } else {
      const keep = L.lockAlpha ? U.cloneCanvas(surf.canvas) : null;
      if (mode === 'normal' && keep) { t.save(); t.globalAlpha = op; t.globalCompositeOperation = 'source-atop'; t.drawImage(src, -surf.x, -surf.y); t.restore(); }
      else {
        IMG.Blend.draw(t, src, -surf.x, -surf.y, mode, op);
        if (keep) { t.save(); t.globalCompositeOperation = 'destination-in'; t.drawImage(keep, 0, 0); t.restore(); }
      }
    }
    IMG.markDirty(surf);
    IMG.Effects.invalidate(L);
    IMG.Engine.invalidate();
    bus.emit('layer:pixels', L);
    return true;
  };

  /* ==================================================================
     CONTA-GOTAS
     ================================================================== */
  const SIZES = [[1, 'Amostra de ponto'], [3, 'Média 3 × 3'], [5, 'Média 5 × 5'], [11, 'Média 11 × 11'], [31, 'Média 31 × 31'], [51, 'Média 51 × 51'], [101, 'Média 101 × 101']];
  const SAMPLES = [['layer', 'Camada atual'], ['below', 'Atual e abaixo'], ['all', 'Todas as camadas'], ['allNoAdj', 'Todas sem ajustes']];

  /** Canvas de amostragem conforme a opção "Amostra". */
  function sampleCanvas(doc, sample) {
    const L = doc.active;
    if (sample === 'layer' && L && L.canvas && L.type !== 'group') { const t = U.createCanvas(doc.width, doc.height); t.getContext('2d').drawImage(L.canvas, L.x, L.y); return t; }
    if (sample === 'below' && L) return IMG.Engine.compositeBelow(doc, L, true);
    if (sample === 'allNoAdj') {
      const hid = []; Layers.walk(doc.layers, (q) => { if (q.type === 'adjust' && !q._hidden) { q._hidden = true; hid.push(q); } });
      try { return IMG.Engine.flatten(doc); } finally { hid.forEach((q) => { q._hidden = false; }); }
    }
    return IMG.Engine.composite(doc);
  }
  /** Cor média (pré-multiplicada) de um quadrado size×size. */
  function avgAt(c, x, y, size) {
    const W = c.width, H = c.height;
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    const half = Math.floor(size / 2);
    const x0 = U.clamp(Math.floor(x) - half, 0, W - 1), y0 = U.clamp(Math.floor(y) - half, 0, H - 1);
    const w = Math.min(size, W - x0), h = Math.min(size, H - y0);
    const d = c.getContext('2d').getImageData(x0, y0, w, h).data;
    let r = 0, g = 0, b = 0, a = 0;
    for (let i = 0; i < d.length; i += 4) { const al = d[i + 3]; r += d[i] * al; g += d[i + 1] * al; b += d[i + 2] * al; a += al; }
    if (!a) return null;
    return { r: Math.round(r / a), g: Math.round(g / a), b: Math.round(b / a), a: a / (d.length / 4) / 255 };
  }
  IMG.sampleCanvas = sampleCanvas;
  IMG.avgColorAt = avgAt;

  IMG.Tools.register({
    id: 'eyedropper', name: 'Conta-gotas', icon: 'eyedropper', cursor: 'crosshair',
    defaults: { sample: 1, source: 'all', ring: true },
    hint: 'Clique: cor do primeiro plano · Alt+clique: cor de fundo',
    options() {
      return [
        { type: 'select', key: 'sample', label: 'Tamanho da amostra', numeric: true, options: SIZES, width: 140 },
        { type: 'select', key: 'source', label: 'Amostra', options: SAMPLES, width: 150 },
        { type: 'check', key: 'ring', label: 'Mostrar anel de amostragem' }
      ];
    },
    pick(ev) {
      const doc = IMG.app.doc, o = T().o('eyedropper');
      if (!this.src) this.src = sampleCanvas(doc, o.source);
      const c = avgAt(this.src, ev.x, ev.y, o.sample);
      this.cur = c ? U.rgbToHex(c.r, c.g, c.b) : null;
      this.pos = { sx: ev.sx, sy: ev.sy };
      if (this.cur) { if (ev.alt) IMG.app.setBg(this.cur); else IMG.app.setFg(this.cur); }
      IMG.Engine.requestRender();
    },
    down(ev) { this.src = null; this.prev = ev.alt ? IMG.app.bg : IMG.app.fg; this.pick(ev); },
    move(ev) { this.pick(ev); },
    up() { this.pos = null; this.src = null; IMG.Engine.requestRender(); },
    drawOverlay(ctx) {
      const p = this.pos, o = T().o('eyedropper');
      if (!p || !this.cur || !o.ring) return;
      ctx.save();
      ctx.lineWidth = 12;
      ctx.strokeStyle = this.cur; ctx.beginPath(); ctx.arc(p.sx, p.sy, 34, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = this.prev || '#808080'; ctx.beginPath(); ctx.arc(p.sx, p.sy, 34, 0, Math.PI); ctx.stroke();
      ctx.lineWidth = 6; ctx.strokeStyle = '#7f7f7f'; ctx.beginPath(); ctx.arc(p.sx, p.sy, 43, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.beginPath(); ctx.arc(p.sx, p.sy, 46.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.sx, p.sy, 27.5, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  });

  /* ---------- Amostra de cor ---------- */
  const near = (v, sx, sy, p, r = 7) => Math.hypot(v.x + p.x * v.zoom - sx, v.y + p.y * v.zoom - sy) <= r;
  IMG.Tools.register({
    id: 'colorSampler', name: 'Amostra de cor', icon: 'colorSampler', cursor: 'crosshair',
    defaults: { sample: 1 },
    hint: 'Clique para fixar até 10 pontos de amostra (valores no painel Informações) · Alt+clique remove',
    options() {
      return [
        { type: 'select', key: 'sample', label: 'Tamanho da amostra', numeric: true, options: SIZES, width: 140 },
        { type: 'button', label: 'Limpar tudo', onClick: () => { const d = IMG.app.doc; if (d) { d.samplers = []; bus.emit('samplers:change', d); IMG.Engine.requestRender(); } } }
      ];
    },
    down(ev) {
      const doc = IMG.app.doc, v = doc.view;
      doc.samplers = doc.samplers || [];
      const hit = doc.samplers.findIndex((p) => near(v, ev.sx, ev.sy, p));
      if (hit >= 0 && ev.alt) { doc.samplers.splice(hit, 1); bus.emit('samplers:change', doc); IMG.Engine.requestRender(); return false; }
      if (hit >= 0) { this.drag = doc.samplers[hit]; return; }
      if (ev.x < 0 || ev.y < 0 || ev.x >= doc.width || ev.y >= doc.height) return false;
      if (doc.samplers.length >= 10) { IMG.UI.toast('São permitidos no máximo 10 pontos de amostra.'); return false; }
      this.drag = { x: Math.floor(ev.x) + 0.5, y: Math.floor(ev.y) + 0.5 };
      doc.samplers.push(this.drag);
      bus.emit('samplers:change', doc);
      IMG.Engine.requestRender();
      IMG.UI.showPanel && IMG.UI.commands['window.info'] && IMG.UI.showPanel('info');
    },
    move(ev) { if (this.drag) { const doc = IMG.app.doc; this.drag.x = U.clamp(Math.floor(ev.x), 0, doc.width - 1) + 0.5; this.drag.y = U.clamp(Math.floor(ev.y), 0, doc.height - 1) + 0.5; bus.emit('samplers:change', doc); IMG.Engine.requestRender(); } },
    up() { this.drag = null; },
    hover(ev) { const doc = IMG.app.doc; T().cursor((doc.samplers || []).some((p) => near(doc.view, ev.sx, ev.sy, p)) ? (ev.alt ? 'not-allowed' : 'move') : 'crosshair'); },
    drawOverlay(ctx, v) {
      const doc = IMG.app.doc;
      if (T().activeId !== 'colorSampler' && !(IMG.app.prefs && IMG.app.prefs.showSamplers)) return;
      (doc.samplers || []).forEach((p, i) => IMG.drawSamplerMark(ctx, v, p, i + 1));
    }
  });
  IMG.drawSamplerMark = function (ctx, v, p, n) {
    const x = Math.round(v.x + p.x * v.zoom) + 0.5, y = Math.round(v.y + p.y * v.zoom) + 0.5;
    const line = (col, w) => {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.moveTo(x - 9, y); ctx.lineTo(x - 2, y); ctx.moveTo(x + 2, y); ctx.lineTo(x + 9, y);
      ctx.moveTo(x, y - 9); ctx.lineTo(x, y - 2); ctx.moveTo(x, y + 2); ctx.lineTo(x, y + 9);
      ctx.stroke();
    };
    line('rgba(0,0,0,.85)', 3); line('#fff', 1);
    ctx.font = 'bold 11px system-ui, sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.fillStyle = '#fff';
    ctx.strokeText(String(n), x + 7, y + 16); ctx.fillText(String(n), x + 7, y + 16);
  };

  /* ---------- Régua ---------- */
  function rulerInfo(r) {
    if (!r) return null;
    const dx = r.x1 - r.x0, dy = r.y1 - r.y0;
    let a = -Math.atan2(dy, dx) * 180 / Math.PI;
    return { x: r.x0, y: r.y0, w: dx, h: dy, a, l: Math.hypot(dx, dy) };
  }
  /** Gira os pixels de uma camada em torno de (cx, cy). */
  IMG.rotateLayerPixels = function (L, deg, cx, cy) {
    if (!L.canvas) return false;
    const a = U.rad(deg), cs = Math.cos(a), sn = Math.sin(a);
    const pts = [[L.x, L.y], [L.x + L.canvas.width, L.y], [L.x, L.y + L.canvas.height], [L.x + L.canvas.width, L.y + L.canvas.height]].map(([x, y]) => [cx + (x - cx) * cs - (y - cy) * sn, cy + (x - cx) * sn + (y - cy) * cs]);
    const bx = Math.floor(Math.min(...pts.map((p) => p[0]))), by = Math.floor(Math.min(...pts.map((p) => p[1])));
    const bw = Math.ceil(Math.max(...pts.map((p) => p[0]))) - bx, bh = Math.ceil(Math.max(...pts.map((p) => p[1]))) - by;
    const c = U.createCanvas(Math.max(1, bw), Math.max(1, bh)), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.translate(-bx, -by); x.translate(cx, cy); x.rotate(a); x.translate(-cx, -cy);
    x.drawImage(L.canvas, L.x, L.y);
    L.setCanvas(c, bx, by);
    if (L.mask && L.mask.linked !== false && L.mask.canvas) {
      const m = L.mask, mc = U.createCanvas(Math.max(1, bw), Math.max(1, bh)), mx = mc.getContext('2d');
      mx.fillStyle = 'rgba(255,255,255,' + ((m.bg == null ? 255 : m.bg) / 255) + ')'; mx.fillRect(0, 0, mc.width, mc.height);
      mx.save(); mx.translate(-bx, -by); mx.translate(cx, cy); mx.rotate(a); mx.translate(-cx, -cy);
      mx.globalCompositeOperation = 'destination-out'; mx.fillStyle = '#000'; mx.fillRect(m.x, m.y, m.canvas.width, m.canvas.height);
      mx.globalCompositeOperation = 'source-over'; mx.drawImage(m.canvas, m.x, m.y); mx.restore();
      m.canvas = mc; m.x = bx; m.y = by; IMG.markDirty(m);
    }
    IMG.markDirty(L);
    IMG.Effects.invalidate(L);
    return true;
  };

  IMG.Tools.register({
    id: 'ruler', name: 'Régua', icon: 'ruler', cursor: 'crosshair',
    defaults: { useScale: false },
    hint: 'Arraste para medir distância e ângulo · arraste uma ponta para ajustar · Shift: 45°',
    options() {
      const doc = IMG.app.doc, i = doc ? rulerInfo(doc.ruler) : null;
      const f = (v, d = 1) => (v == null ? '—' : (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('pt-BR'));
      return [
        { type: 'text', text: 'X: ' + f(i && i.x) + '  Y: ' + f(i && i.y) + '  L: ' + f(i && i.w) + '  A: ' + f(i && i.h) + '  Â: ' + f(i && i.a) + '°  D: ' + f(i && i.l) },
        { type: 'sep' },
        { type: 'button', label: 'Endireitar camada', title: 'Gira a camada ativa para que a linha da régua fique na horizontal', onClick: () => this.straighten() },
        { type: 'button', label: 'Limpar', onClick: () => { const d = IMG.app.doc; if (d) { d.ruler = null; IMG.UI.renderOptions(); IMG.Engine.requestRender(); } } }
      ];
    },
    straighten() {
      const doc = IMG.app.doc, r = doc && doc.ruler;
      if (!r) return;
      const L = doc.active;
      if (!L || L.type !== 'raster') { IMG.UI.toast('Selecione uma camada de pixels.'); return; }
      if (L.isBg) Layers.fromBackground(doc, L);
      let a = rulerInfo(r).a;
      // gira o menor ângulo que deixa a linha na horizontal (ou na vertical)
      if (a > 90) a -= 180; else if (a < -90) a += 180;
      if (Math.abs(a) > 45) a = a > 0 ? a - 90 : a + 90;
      IMG.rotateLayerPixels(L, a, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
      doc.ruler = null;
      bus.emit('layers:change', doc);
      IMG.Engine.invalidate();
      IMG.commit('Endireitar camada');
      IMG.UI.renderOptions();
    },
    down(ev) {
      const doc = IMG.app.doc, v = doc.view, r = doc.ruler;
      if (r && near(v, ev.sx, ev.sy, { x: r.x0, y: r.y0 })) this.end = 0;
      else if (r && near(v, ev.sx, ev.sy, { x: r.x1, y: r.y1 })) this.end = 1;
      else { doc.ruler = { x0: ev.x, y0: ev.y, x1: ev.x, y1: ev.y }; this.end = 1; }
    },
    move(ev) {
      const doc = IMG.app.doc, r = doc.ruler; if (!r || this.end == null) return;
      let x = ev.x, y = ev.y;
      const ox = this.end ? r.x0 : r.x1, oy = this.end ? r.y0 : r.y1;
      if (ev.shift) { const len = Math.hypot(x - ox, y - oy), a = Math.round(Math.atan2(y - oy, x - ox) / (Math.PI / 4)) * (Math.PI / 4); x = ox + Math.cos(a) * len; y = oy + Math.sin(a) * len; }
      if (this.end) { r.x1 = x; r.y1 = y; } else { r.x0 = x; r.y0 = y; }
      IMG.UI.renderOptions();
      IMG.Engine.requestRender();
    },
    up() { this.end = null; IMG.UI.renderOptions(); },
    hover(ev) { const doc = IMG.app.doc, r = doc.ruler; T().cursor(r && (near(doc.view, ev.sx, ev.sy, { x: r.x0, y: r.y0 }) || near(doc.view, ev.sx, ev.sy, { x: r.x1, y: r.y1 })) ? 'move' : 'crosshair'); },
    activate() { IMG.UI.renderOptions(); },
    drawOverlay(ctx, v) {
      const r = IMG.app.doc.ruler; if (!r) return;
      const a = { x: v.x + r.x0 * v.zoom, y: v.y + r.y0 * v.zoom }, b = { x: v.x + r.x1 * v.zoom, y: v.y + r.y1 * v.zoom };
      ctx.save();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      for (const p of [a, b]) { ctx.beginPath(); ctx.moveTo(p.x - 5, p.y); ctx.lineTo(p.x + 5, p.y); ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x, p.y + 5); ctx.stroke(); }
      ctx.restore();
    }
  });

  /* ---------- Contagem ---------- */
  IMG.Tools.register({
    id: 'count', name: 'Contagem', icon: 'count', cursor: 'crosshair',
    defaults: { color: '#00a8ff', marker: 3, label: 12 },
    hint: 'Clique para numerar objetos · arraste um número para movê-lo · Alt+clique remove',
    options() {
      const doc = IMG.app.doc, n = doc && doc.counts ? doc.counts.length : 0;
      return [
        { type: 'text', text: 'Contagem: ' + n },
        { type: 'color', key: 'color', label: 'Cor' },
        { type: 'slider', key: 'marker', label: 'Tamanho do marcador', min: 1, max: 10, step: 1 },
        { type: 'slider', key: 'label', label: 'Tamanho do rótulo', min: 8, max: 72, step: 1 },
        { type: 'button', label: 'Limpar', onClick: () => { const d = IMG.app.doc; if (d) { d.counts = []; IMG.UI.renderOptions(); IMG.Engine.requestRender(); } } }
      ];
    },
    down(ev) {
      const doc = IMG.app.doc, v = doc.view;
      doc.counts = doc.counts || [];
      const hit = doc.counts.findIndex((p) => near(v, ev.sx, ev.sy, p, 9));
      if (hit >= 0 && ev.alt) { doc.counts.splice(hit, 1); IMG.UI.renderOptions(); IMG.Engine.requestRender(); return false; }
      if (hit >= 0) { this.drag = doc.counts[hit]; return; }
      if (ev.x < 0 || ev.y < 0 || ev.x >= doc.width || ev.y >= doc.height) return false;
      doc.counts.push({ x: ev.x, y: ev.y });
      IMG.UI.renderOptions(); IMG.Engine.requestRender();
      return false;
    },
    move(ev) { if (this.drag) { this.drag.x = ev.x; this.drag.y = ev.y; IMG.Engine.requestRender(); } },
    up() { this.drag = null; },
    drawOverlay(ctx, v) {
      const doc = IMG.app.doc, o = T().o('count');
      (doc.counts || []).forEach((p, i) => {
        const x = v.x + p.x * v.zoom, y = v.y + p.y * v.zoom, r = o.marker + 1;
        ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.font = o.label + 'px system-ui, sans-serif'; ctx.fillText(String(i + 1), x + r + 2, y - r - 2);
      });
    }
  });

  /* ==================================================================
     GRADIENTE
     ================================================================== */
  const STYLES = [
    { value: 'linear', title: 'Gradiente linear', icon: 'gradLinear' }, { value: 'radial', title: 'Gradiente radial', icon: 'gradRadial' },
    { value: 'angle', title: 'Gradiente angular', icon: 'gradAngle' }, { value: 'reflected', title: 'Gradiente refletido', icon: 'gradReflected' },
    { value: 'diamond', title: 'Gradiente losango', icon: 'gradDiamond' }
  ];
  const GRAD_MODES = [['normal', 'Normal'], ['dissolve', 'Dissolver'], ['behind', 'Atrás'], ['clear', 'Limpar'], null].concat(IMG.BLEND_LIST.slice(3));

  IMG.Tools.register({
    id: 'gradient', name: 'Gradiente', icon: 'gradient', cursor: 'crosshair',
    defaults: { style: 'linear', grad: IMG.Gradients.def(), mode: 'normal', opacity: 100, reverse: false, dither: true, transparency: true },
    hint: 'Arraste para definir o início e o fim · Shift: ângulos de 45°',
    options() {
      const o = T().o('gradient');
      return [
        { type: 'custom', build: () => IMG.Widgets.gradientBtn(o.grad, (g, fin) => { o.grad = g; if (fin) T().setOpt('gradient', 'grad', g, true); }, { width: 120 }).el },
        { type: 'seg', key: 'style', options: STYLES },
        { type: 'select', key: 'mode', label: 'Modo', options: GRAD_MODES, width: 130 },
        { type: 'slider', key: 'opacity', label: 'Opacidade', min: 1, max: 100, step: 1, unit: '%' },
        { type: 'check', key: 'reverse', label: 'Inverter' },
        { type: 'check', key: 'dither', label: 'Pontilhado' },
        { type: 'check', key: 'transparency', label: 'Transparência' }
      ];
    },
    down(ev) {
      const doc = IMG.app.doc;
      const L = Layers.paintTarget(doc);
      if (!L) return false;
      if (L.type !== 'raster' && !(doc.editMask && L.mask)) { IMG.UI.toast('Selecione uma camada de pixels.'); return false; }
      this.g = { L, p0: { x: ev.x, y: ev.y }, p1: { x: ev.x, y: ev.y } };
    },
    move(ev) {
      const g = this.g; if (!g) return;
      let x = ev.x, y = ev.y;
      if (ev.shift) {
        const dx = x - g.p0.x, dy = y - g.p0.y, len = Math.hypot(dx, dy);
        const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        x = g.p0.x + Math.cos(a) * len; y = g.p0.y + Math.sin(a) * len;
      }
      g.p1 = { x, y };
      IMG.Engine.requestRender();
    },
    up() {
      const g = this.g; this.g = null;
      IMG.Engine.requestRender();
      if (!g || Math.hypot(g.p1.x - g.p0.x, g.p1.y - g.p0.y) < 1) return;
      const doc = IMG.app.doc, o = T().o('gradient');
      const W = doc.width, H = doc.height;
      const img = new ImageData(W, H);
      IMG.Gradients.paint(img, o.grad, o.style, g.p0, g.p1, { reverse: o.reverse, dither: o.dither });
      if (!o.transparency) for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
      const c = U.createCanvas(W, H); c.getContext('2d').putImageData(img, 0, 0);
      IMG.paintCanvas(doc, g.L, c, { mode: o.mode, opacity: o.opacity / 100 });
      IMG.commit('Gradiente');
      IMG.lastPixelOp = { layerId: g.L.id, label: 'Gradiente', onMask: !!(doc.editMask && g.L.mask) };
    },
    drawOverlay(ctx, v) {
      const g = this.g; if (!g) return;
      const a = { x: v.x + g.p0.x * v.zoom, y: v.y + g.p0.y * v.zoom }, b = { x: v.x + g.p1.x * v.zoom, y: v.y + g.p1.y * v.zoom };
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      for (const p of [a, b]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#111'; ctx.stroke(); }
    }
  });

  /* ==================================================================
     BALDE DE TINTA
     ================================================================== */
  IMG.Tools.register({
    id: 'bucket', name: 'Balde de tinta', icon: 'bucket', cursor: 'crosshair',
    defaults: { source: 'fg', pattern: 'p0', mode: 'normal', opacity: 100, tolerance: 32, antiAlias: true, contiguous: true, sampleAll: false },
    hint: 'Clique para preencher áreas de cor semelhante',
    options() {
      const o = T().o('bucket');
      const list = [{ type: 'select', key: 'source', label: 'Preencher', options: [['fg', 'Primeiro plano'], ['pattern', 'Padrão']], width: 120 }];
      if (o.source === 'pattern') list.push({ type: 'custom', build: () => IMG.Widgets.patternBtn(o.pattern, (v) => T().setOpt('bucket', 'pattern', v, true)).el });
      return list.concat([
        { type: 'select', key: 'mode', label: 'Modo', options: GRAD_MODES, width: 130 },
        { type: 'slider', key: 'opacity', label: 'Opacidade', min: 1, max: 100, step: 1, unit: '%' },
        { type: 'slider', key: 'tolerance', label: 'Tolerância', min: 0, max: 255, step: 1 },
        { type: 'check', key: 'antiAlias', label: 'Suavização de serrilhado' },
        { type: 'check', key: 'contiguous', label: 'Contíguo' },
        { type: 'check', key: 'sampleAll', label: 'Todas as camadas' }
      ]);
    },
    onOption(key) { if (key === 'source') IMG.UI.renderOptions(); },
    down(ev) {
      const doc = IMG.app.doc, o = T().o('bucket');
      const x = Math.floor(ev.x), y = Math.floor(ev.y);
      if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return false;
      const L = Layers.paintTarget(doc);
      if (!L) return false;
      if (L.type !== 'raster' && !(doc.editMask && L.mask)) { IMG.UI.toast('Selecione uma camada de pixels.'); return false; }
      if (IMG.activeSelection(doc) && !Sel.contains(doc, x, y)) return false;
      const onMask = !!(doc.editMask && L.mask);
      let src;
      if (o.sampleAll && !onMask) src = IMG.Engine.composite(doc);
      else {
        src = U.createCanvas(doc.width, doc.height);
        if (onMask) { Layers.maskEnsureCovers(L.mask, doc.rect); src.getContext('2d').drawImage(IMG.alphaToGray(L.mask.canvas), L.mask.x, L.mask.y); }
        else if (L.canvas) src.getContext('2d').drawImage(L.canvas, L.x, L.y);
      }
      const data = src.getContext('2d').getImageData(0, 0, doc.width, doc.height).data;
      const mask = IMG.flood(data, doc.width, doc.height, x, y, o.tolerance, o.contiguous);
      const fill = IMG.maskToCanvas(mask, doc.width, doc.height);
      if (o.antiAlias) IMG.blurCanvas(fill, 0.6);
      const fc = fill.getContext('2d');
      fc.globalCompositeOperation = 'source-in';
      if (o.source === 'pattern') IMG.Patterns.fill(fc, o.pattern, doc.width, doc.height);
      else { fc.fillStyle = IMG.app.fg; fc.fillRect(0, 0, doc.width, doc.height); }
      fc.globalCompositeOperation = 'source-over';
      IMG.paintCanvas(doc, L, fill, { mode: o.mode, opacity: o.opacity / 100 });
      IMG.commit('Balde de tinta');
      IMG.lastPixelOp = { layerId: L.id, label: 'Balde de tinta', onMask };
      return false;
    }
  });

  /* compatibilidade com código antigo */
  IMG.gradientStops = function (preset, reverse) {
    const g = IMG.Gradients.def(), lut = IMG.Gradients.lut(g, 2, reverse);
    return [{ t: 0, c: U.rgbToHex(lut[0], lut[1], lut[2]) }, { t: 1, c: U.rgbToHex(lut[4], lut[5], lut[6]) }];
  };
})();
