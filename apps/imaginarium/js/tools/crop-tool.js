/* ==========================================================================
   Imaginarium — ferramentas Recorte, Fatia e Seleção de fatia
   Recorte: arraste as alças para redimensionar, arraste fora da área para
   girar, Ctrl+arraste (ou "Endireitar") para nivelar uma linha.
   Enter aplica, Esc cancela, O alterna a sobreposição, X troca a orientação.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus;

  const RATIOS = [['free', 'Livre'], ['orig', 'Original'], ['custom', 'Proporção…'], ['size', 'L × A (redimensionar)'], null, ['1:1', '1 : 1 (quadrado)'], ['4:3', '4 : 3'], ['3:2', '3 : 2'], ['16:9', '16 : 9'], ['5:4', '5 : 4'], ['7:5', '7 : 5'], ['3:4', '3 : 4'], ['2:3', '2 : 3'], ['9:16', '9 : 16'], ['4:5', '4 : 5']];
  const OVERLAYS = [['none', 'Nenhuma'], ['thirds', 'Regra dos terços'], ['grid', 'Grade'], ['diagonal', 'Diagonal'], ['triangle', 'Triângulo'], ['golden', 'Proporção áurea'], ['spiral', 'Espiral áurea']];
  const HANDLES = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  const ROT_CURSOR = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15a8 8 0 0 0 14 0" stroke="#000" stroke-width="4"/><path d="M5 15a8 8 0 0 0 14 0" stroke="#fff" stroke-width="2"/><path d="M3 12l2 3 3-2M21 12l-2 3-3-2" stroke="#000" stroke-width="4"/><path d="M3 12l2 3 3-2M21 12l-2 3-3-2" stroke="#fff" stroke-width="2"/></g></svg>') + '") 12 12, alias';
  IMG.ROT_CURSOR = ROT_CURSOR;
  const T = () => IMG.Tools;
  const rot = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return { x: x * c - y * s, y: x * s + y * c }; };
  const cursorFor = (ang) => { const a = ((U.deg(ang) % 180) + 180) % 180; return a < 22.5 || a >= 157.5 ? 'ew-resize' : a < 67.5 ? 'nwse-resize' : a < 112.5 ? 'ns-resize' : 'nesw-resize'; };

  /* ==================================================================
     Operação: recortar por uma caixa (possivelmente girada)
     ================================================================== */
  /** Buraco (alfa) das áreas da nova tela que ficaram fora da imagem original. */
  function holeCanvas(doc, M, W0, H0) {
    const c = U.createCanvas(doc.width, doc.height), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, doc.width, doc.height);
    x.globalCompositeOperation = 'destination-out';
    x.setTransform(M.a, M.b, M.c, M.d, M.e, M.f);
    x.fillStyle = '#000'; x.fillRect(1, 1, W0 - 2, H0 - 2);
    return c;
  }
  async function cropBox(doc, box, o = {}) {
    const W0 = doc.width, H0 = doc.height, label = o.label || 'Recortar';
    const NW = Math.max(1, Math.round(box.w)), NH = Math.max(1, Math.round(box.h));
    const a = Math.abs(box.a) < 1e-5 ? 0 : box.a;
    const M = new DOMMatrix().translate(NW / 2, NH / 2).rotate(-U.deg(a)).translate(-box.cx, -box.cy);
    const outside = a !== 0 || box.cx - NW / 2 < -0.5 || box.cy - NH / 2 < -0.5 || box.cx + NW / 2 > W0 + 0.5 || box.cy + NH / 2 > H0 + 0.5;
    IMG._batch = (IMG._batch || 0) + 1;
    try {
      if (!a) IMG.ImageOps.crop(doc, { x: Math.round(box.cx - NW / 2), y: Math.round(box.cy - NH / 2), w: NW, h: NH }, { deletePixels: o.deletePixels, label });
      else IMG.affineDoc(doc, M, NW, NH, { clip: o.deletePixels !== false, noCommit: true, keepGuides: false });
      if (o.contentAware && outside && IMG.Inpaint) {
        let L = null; IMG.Layers.walk(doc.layers, (q) => { if (!L && q.isBg) L = q; });
        if (!L) L = doc.active && doc.active.type === 'raster' ? doc.active : null;
        if (L) {
          const Mf = !a ? new DOMMatrix().translate(-Math.round(box.cx - NW / 2), -Math.round(box.cy - NH / 2)) : M;
          if (!L.isBg) L.ensureCovers(doc.rect);
          await IMG.Inpaint.fillLayer(doc, L, holeCanvas(doc, Mf, W0, H0), { clipSel: false, label: 'Preenchimento sensível ao conteúdo', quality: 1.2 });
        }
      }
      if (o.resample && (o.resample.w !== NW || o.resample.h !== NH)) IMG.ImageOps.resize(doc, o.resample.w, o.resample.h, { label });
    } finally { IMG._batch--; }
    IMG.commit(label);
    IMG.Engine.fit(false);
  }
  IMG.cropBox = cropBox;

  /* ==================================================================
     FERRAMENTA RECORTE
     ================================================================== */
  const tool = {
    id: 'crop', name: 'Recorte', icon: 'crop', group: 'crop', cursor: 'crosshair', noCtrlMove: true,
    defaults: { ratio: 'free', rw: 0, rh: 0, overlay: 'thirds', deletePixels: true, contentAware: false, shield: true },
    hint: 'Enter: aplicar · Esc: cancelar · arraste fora: girar · Ctrl+arraste: endireitar · O: sobreposição · X: orientação',
    box: null, drag: null, straighten: false,

    o() { return T().o('crop'); },
    options() {
      const o = this.o(), b = this.box || { w: 0, h: 0, a: 0 };
      const fixed = o.ratio !== 'free';
      const wv = fixed ? o.rw : Math.round(b.w), hv = fixed ? o.rh : Math.round(b.h);
      const unit = o.ratio === 'size' || !fixed ? 'px' : '';
      return [
        { type: 'select', key: 'ratio', options: RATIOS, width: 150, onChange: (v) => this.pickRatio(v) },
        { type: 'number', label: 'L', value: wv || null, min: 0, max: 30000, decimals: fixed && o.ratio !== 'size' ? 2 : 0, unit, width: 72, onChange: (v) => this.setWH(v, null) },
        { type: 'custom', build: () => IMG.UI.iconBtn('swap', 'Trocar largura e altura (X)', () => this.swap()) },
        { type: 'number', label: 'A', value: hv || null, min: 0, max: 30000, decimals: fixed && o.ratio !== 'size' ? 2 : 0, unit, width: 72, onChange: (v) => this.setWH(null, v) },
        { type: 'button', label: 'Limpar', onClick: () => { T().setOpt('crop', 'ratio', 'free', true); T().setOpt('crop', 'rw', 0, true); T().setOpt('crop', 'rh', 0); IMG.UI.renderOptions(); } },
        { type: 'sep' },
        { type: 'number', label: 'Ângulo', value: U.round(U.deg(b.a || 0), 2), min: -180, max: 180, decimals: 2, unit: '°', width: 70, onChange: (v) => { if (this.box) { this.box.a = U.rad(v); this.touched = true; IMG.Engine.requestRender(); } } },
        { type: 'custom', build: () => { const bt = IMG.UI.iconBtn('ruler', 'Endireitar: desenhe uma linha sobre o horizonte (ou segure Ctrl)', () => { this.straighten = !this.straighten; bt.classList.toggle('active', this.straighten); }); bt.classList.toggle('active', this.straighten); return bt; } },
        { type: 'select', key: 'overlay', label: 'Sobreposição', options: OVERLAYS, width: 140, onChange: () => IMG.Engine.requestRender() },
        { type: 'sep' },
        { type: 'check', key: 'deletePixels', label: 'Excluir pixels cortados', title: 'Desmarque para manter os pixels fora da área (ficam ocultos)' },
        { type: 'check', key: 'contentAware', label: 'Sensível ao conteúdo', title: 'Preenche as áreas vazias criadas ao girar ou ampliar a tela' },
        { type: 'sep' },
        { type: 'button', label: 'Cancelar', onClick: () => this.reset() },
        { type: 'button', label: 'Aplicar', icon: 'check', primary: true, onClick: () => this.apply() }
      ];
    },

    /* ---------- proporção ---------- */
    ratio() {
      const doc = IMG.app.doc, o = this.o();
      if (!doc || o.ratio === 'free') return null;
      if (o.ratio === 'orig') return doc.width / doc.height;
      if (o.ratio === 'custom' || o.ratio === 'size') return o.rw > 0 && o.rh > 0 ? o.rw / o.rh : null;
      const [a, b] = o.ratio.split(':').map(Number);
      return a / b;
    },
    pickRatio(v) {
      const doc = IMG.app.doc;
      if (/^\d+:\d+$/.test(v)) { const [a, b] = v.split(':').map(Number); T().setOpt('crop', 'rw', a, true); T().setOpt('crop', 'rh', b, true); }
      else if (v === 'orig' && doc) { T().setOpt('crop', 'rw', doc.width, true); T().setOpt('crop', 'rh', doc.height, true); }
      else if (v === 'size' && this.box) { T().setOpt('crop', 'rw', Math.round(this.box.w), true); T().setOpt('crop', 'rh', Math.round(this.box.h), true); }
      else if (v === 'custom' && this.box) { const g = (a, b) => (b ? g(b, a % b) : a), w = Math.round(this.box.w), h = Math.round(this.box.h), d = g(w, h) || 1; T().setOpt('crop', 'rw', w / d, true); T().setOpt('crop', 'rh', h / d, true); }
      this.fitRatio();
      IMG.UI.renderOptions();
    },
    setWH(w, h) {
      const o = this.o(), b = this.box;
      if (o.ratio === 'free') { if (!b) return; if (w) b.w = w; if (h) b.h = h; this.touched = true; IMG.Engine.requestRender(); return; }
      if (o.ratio !== 'size' && o.ratio !== 'custom') T().setOpt('crop', 'ratio', 'custom', true);
      if (w != null) T().setOpt('crop', 'rw', w, true);
      if (h != null) T().setOpt('crop', 'rh', h, true);
      this.fitRatio(); IMG.UI.renderOptions();
    },
    swap() {
      const o = this.o();
      if (o.ratio !== 'free') {
        const rw = o.rw, rh = o.rh;
        if (o.ratio !== 'size' && o.ratio !== 'custom' && o.ratio !== 'orig') T().setOpt('crop', 'ratio', 'custom', true);
        if (o.ratio === 'orig') T().setOpt('crop', 'ratio', 'custom', true);
        T().setOpt('crop', 'rw', rh, true); T().setOpt('crop', 'rh', rw, true);
      }
      const b = this.box;
      if (b) { const t = b.w; b.w = b.h; b.h = t; this.touched = true; }
      this.fitRatio(); IMG.UI.renderOptions(); IMG.Engine.requestRender();
    },
    /** Ajusta a caixa atual à proporção escolhida, mantendo o centro e cabendo na caixa anterior. */
    fitRatio() {
      const k = this.ratio(), b = this.box;
      if (!k || !b) return;
      let w = b.w, h = w / k;
      if (h > b.h) { h = b.h; w = h * k; }
      b.w = Math.max(1, w); b.h = Math.max(1, h); this.touched = true;
      IMG.Engine.requestRender();
    },

    reset() {
      const doc = IMG.app.doc;
      this.box = doc ? { cx: doc.width / 2, cy: doc.height / 2, w: doc.width, h: doc.height, a: 0 } : null;
      this.touched = false; this.drag = null;
      IMG.Engine.requestRender(); IMG.UI.renderOptions();
    },
    activate() {
      this.reset();
      if (this.ratio()) this.fitRatio();
      if (!this._bound) {
        this._bound = true;
        const re = () => { if (T().activeId === 'crop' && !this.drag) this.reset(); };
        bus.on('doc:change', re); bus.on('doc:resize', re);
      }
    },
    deactivate() { this.box = null; this.drag = null; this.straighten = false; },

    /* ---------- geometria ---------- */
    corners(b) { return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => { const p = rot((i * b.w) / 2, (j * b.h) / 2, b.a); return { x: b.cx + p.x, y: b.cy + p.y }; }); },
    local(b, x, y) { return rot(x - b.cx, y - b.cy, -b.a); },
    pristine() { const d = IMG.app.doc, b = this.box; return !this.touched && b && !b.a && Math.abs(b.w - d.width) < 0.5 && Math.abs(b.h - d.height) < 0.5; },
    hit(ev) {
      const b = this.box; if (!b) return { type: 'new' };
      const z = IMG.app.doc.view.zoom, tol = 9 / z;
      const l = this.local(b, ev.x, ev.y);
      for (let i = 0; i < 8; i++) {
        const hx = (HANDLES[i][0] * b.w) / 2, hy = (HANDLES[i][1] * b.h) / 2;
        if (Math.abs(l.x - hx) <= tol && Math.abs(l.y - hy) <= tol) return { type: 'handle', i };
      }
      const inside = Math.abs(l.x) <= b.w / 2 && Math.abs(l.y) <= b.h / 2;
      if (inside) return this.pristine() ? { type: 'new' } : { type: 'move' };
      const d = IMG.app.doc;
      // fora da caixa: girar (se a caixa ainda é a imagem inteira e o ponteiro está fora da imagem, também gira)
      if (this.pristine() && ev.x >= 0 && ev.y >= 0 && ev.x <= d.width && ev.y <= d.height) return { type: 'new' };
      return { type: 'rotate' };
    },

    ctrlHandled() { return true; },
    down(ev) {
      if (!this.box) this.reset();
      if (ev.ctrl || this.straighten) { this.drag = { type: 'straighten', x: ev.x, y: ev.y, cx: ev.x, cy: ev.y }; return; }
      const h = this.hit(ev), b = this.box;
      this.drag = { type: h.type, i: h.i, x: ev.x, y: ev.y, b0: Object.assign({}, b), ang0: Math.atan2(ev.y - b.cy, ev.x - b.cx) };
    },
    move(ev) {
      const d = this.drag; if (!d) return;
      const b = this.box, b0 = d.b0, k = this.ratio();
      if (d.type === 'straighten') { d.cx = ev.x; d.cy = ev.y; IMG.UI.setHint('Ângulo: ' + U.round(U.deg(Math.atan2(ev.y - d.y, ev.x - d.x)), 1) + '°'); IMG.Engine.requestRender(); return; }
      this.touched = true;
      if (d.type === 'move') { b.cx = b0.cx + ev.x - d.x; b.cy = b0.cy + ev.y - d.y; if (ev.shift) { if (Math.abs(ev.x - d.x) > Math.abs(ev.y - d.y)) b.cy = b0.cy; else b.cx = b0.cx; } }
      else if (d.type === 'rotate') {
        let a = b0.a + Math.atan2(ev.y - b0.cy, ev.x - b0.cx) - d.ang0;
        if (ev.shift) a = U.rad(Math.round(U.deg(a) / 15) * 15);
        b.a = Math.atan2(Math.sin(a), Math.cos(a));
        IMG.UI.setHint('Ângulo: ' + U.round(U.deg(b.a), 1) + '°');
      } else if (d.type === 'new') {
        let x0 = d.x, y0 = d.y, x1 = ev.x, y1 = ev.y;
        const kk = k || (ev.shift ? 1 : null);
        if (kk) { const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0); if (w / kk > h) y1 = y0 + Math.sign(y1 - y0 || 1) * (w / kk); else x1 = x0 + Math.sign(x1 - x0 || 1) * h * kk; }
        if (ev.alt) { x0 = d.x - (x1 - d.x); y0 = d.y - (y1 - d.y); }
        Object.assign(b, { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: Math.max(1, Math.abs(x1 - x0)), h: Math.max(1, Math.abs(y1 - y0)), a: 0 });
      } else if (d.type === 'handle') {
        const [hx, hy] = HANDLES[d.i], l = this.local(b0, ev.x, ev.y);
        let x0 = -b0.w / 2, x1 = b0.w / 2, y0 = -b0.h / 2, y1 = b0.h / 2;
        if (hx < 0) x0 = Math.min(l.x, x1 - 1); else if (hx > 0) x1 = Math.max(l.x, x0 + 1);
        if (hy < 0) y0 = Math.min(l.y, y1 - 1); else if (hy > 0) y1 = Math.max(l.y, y0 + 1);
        if (ev.alt) { if (hx) { const w = hx < 0 ? -x0 : x1; x0 = -w; x1 = w; } if (hy) { const h = hy < 0 ? -y0 : y1; y0 = -h; y1 = h; } }
        const kk = k || (ev.shift && hx && hy ? b0.w / b0.h : null);
        if (kk) {
          let w = x1 - x0, h = y1 - y0;
          if (hx && hy) { if (w / kk > h) h = w / kk; else w = h * kk; }
          else if (hx) h = w / kk; else w = h * kk;
          if (hx < 0) x0 = x1 - w; else if (hx > 0) x1 = x0 + w; else { const c = (x0 + x1) / 2; x0 = c - w / 2; x1 = c + w / 2; }
          if (hy < 0) y0 = y1 - h; else if (hy > 0) y1 = y0 + h; else { const c = (y0 + y1) / 2; y0 = c - h / 2; y1 = c + h / 2; }
          if (ev.alt) { if (hx) { x0 = -w / 2; x1 = w / 2; } if (hy) { y0 = -h / 2; y1 = h / 2; } }
        }
        const c = rot((x0 + x1) / 2, (y0 + y1) / 2, b0.a);
        Object.assign(b, { cx: b0.cx + c.x, cy: b0.cy + c.y, w: x1 - x0, h: y1 - y0, a: b0.a });
      }
      if (d.type !== 'rotate') IMG.UI.setHint(Math.round(b.w) + ' × ' + Math.round(b.h) + ' px');
      IMG.Engine.requestRender();
    },
    up(ev) {
      const d = this.drag; this.drag = null;
      IMG.UI.setHint('');
      if (d && d.type === 'straighten') {
        const doc = IMG.app.doc, dx = ev.x - d.x, dy = ev.y - d.y;
        if (Math.hypot(dx, dy) * doc.view.zoom > 4) {
          let a = Math.atan2(dy, dx);
          // linha mais vertical que horizontal: nivela na vertical
          if (Math.abs(Math.sin(a)) > Math.abs(Math.cos(a))) a -= Math.sign(a) * Math.PI / 2;
          else if (Math.abs(a) > Math.PI / 2) a -= Math.sign(a) * Math.PI;
          this.straightenTo(a);
        }
        this.straighten = false;
      }
      if (d && d.type === 'new' && this.box.w * IMG.app.doc.view.zoom < 3) this.reset();
      IMG.UI.renderOptions(); IMG.Engine.requestRender();
    },
    /** Gira a caixa para nivelar a linha e a reduz para caber dentro da imagem (sem cantos vazios). */
    straightenTo(a) {
      const doc = IMG.app.doc, W = doc.width, H = doc.height, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
      let w = W, h = H;
      if (!this.o().contentAware) {
        const k = this.ratio() || W / H;
        // maior retângulo de proporção k, girado de a, inscrito em W×H
        const f = Math.min(W / (k * c + s), H / (k * s + c));
        h = f; w = f * k;
      }
      this.box = { cx: W / 2, cy: H / 2, w, h, a };
      this.touched = true;
    },
    hover(ev) {
      if (ev.ctrl || this.straighten) { T().cursor('crosshair'); return; }
      const h = this.hit(ev), b = this.box;
      if (h.type === 'handle') { const [hx, hy] = HANDLES[h.i]; T().cursor(cursorFor(Math.atan2(hy * b.h, hx * b.w) + b.a)); }
      else T().cursor(h.type === 'move' ? 'move' : h.type === 'rotate' ? ROT_CURSOR : 'crosshair');
    },
    dblclick(ev) { const h = this.hit(ev); if (h.type === 'move') this.apply(); },
    onKey(e, combo) {
      if (e.key === 'Enter') { this.apply(); return true; }
      if (e.key === 'Escape') { this.reset(); return true; }
      if (combo === 'o') { const i = OVERLAYS.findIndex((q) => q[0] === this.o().overlay); T().setOpt('crop', 'overlay', OVERLAYS[(i + 1) % OVERLAYS.length][0]); IMG.UI.renderOptions(); IMG.Engine.requestRender(); return true; }
      if (combo === 'shift+o') { IMG.UI.toast('Sobreposição: ' + (OVERLAYS.find((q) => q[0] === this.o().overlay) || ['', ''])[1]); return true; }
      if (combo === 'x' && this.box) { this.swap(); return true; }
      if (combo === 'h') { T().setOpt('crop', 'shield', !this.o().shield); IMG.Engine.requestRender(); return true; }
      const step = e.shiftKey ? 10 : 1;
      if (this.box && !this.pristine() && /^(shift\+)?arrow/.test(combo)) {
        const k = combo.replace('shift+', '');
        if (k === 'arrowleft') this.box.cx -= step; else if (k === 'arrowright') this.box.cx += step; else if (k === 'arrowup') this.box.cy -= step; else if (k === 'arrowdown') this.box.cy += step;
        IMG.Engine.requestRender(); return true;
      }
      return false;
    },

    apply() {
      const doc = IMG.app.doc, b = this.box, o = this.o();
      if (!doc || !b) return;
      if (this.pristine() && o.ratio !== 'size') { IMG.UI.toast('A área de recorte é igual à imagem inteira.'); return; }
      const resample = o.ratio === 'size' && o.rw > 0 && o.rh > 0 ? { w: Math.round(o.rw), h: Math.round(o.rh) } : null;
      const box = Object.assign({}, b);
      if (!box.a) { box.w = Math.round(box.w); box.h = Math.round(box.h); box.cx = Math.round(box.cx - box.w / 2) + box.w / 2; box.cy = Math.round(box.cy - box.h / 2) + box.h / 2; }
      this.box = null;
      cropBox(doc, box, { deletePixels: o.deletePixels, contentAware: o.contentAware, resample, label: 'Recortar' }).then(() => { if (T().activeId === 'crop') this.reset(); });
    },

    /* ---------- desenho ---------- */
    drawOverlay(ctx, v) {
      const b = this.box, z = v.zoom, d = this.drag;
      if (d && d.type === 'straighten') {
        ctx.save(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(v.x + d.x * z, v.y + d.y * z); ctx.lineTo(v.x + d.cx * z, v.y + d.cy * z); ctx.stroke();
        ctx.strokeStyle = '#000'; ctx.lineDashOffset = 4.5; ctx.stroke(); ctx.restore();
      }
      if (!b) return;
      const pts = this.corners(b).map((p) => ({ x: v.x + p.x * z, y: v.y + p.y * z }));
      const o = this.o();
      ctx.save();
      // escudo (área cortada escurecida)
      if (o.shield) {
        ctx.beginPath(); ctx.rect(-20000, -20000, 40000 + v.w, 40000 + v.h);
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
        ctx.fillStyle = 'rgba(10,11,13,.62)'; ctx.fill('evenodd');
      }
      // sobreposição no referencial da caixa
      const cx = v.x + b.cx * z, cy = v.y + b.cy * z, W = b.w * z, H = b.h * z;
      ctx.translate(cx, cy); ctx.rotate(b.a); ctx.translate(-W / 2, -H / 2);
      const ov = d && d.type === 'rotate' ? 'grid' : o.overlay;
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.beginPath();
      const line = (x0, y0, x1, y1) => { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); };
      if (ov === 'thirds') for (let i = 1; i < 3; i++) { line((W * i) / 3, 0, (W * i) / 3, H); line(0, (H * i) / 3, W, (H * i) / 3); }
      else if (ov === 'golden') { const g = 0.381966; [g, 1 - g].forEach((t) => { line(W * t, 0, W * t, H); line(0, H * t, W, H * t); }); }
      else if (ov === 'grid') { const n = Math.max(4, Math.round(Math.max(W, H) / 40)), s = Math.max(W, H) / n; for (let x = s; x < W - 0.5; x += s) line(x, 0, x, H); for (let y = s; y < H - 0.5; y += s) line(0, y, W, y); }
      else if (ov === 'diagonal') { const m = Math.min(W, H); line(0, 0, m, m); line(W, 0, W - m, m); line(0, H, m, H - m); line(W, H, W - m, H - m); }
      else if (ov === 'triangle') {
        line(0, H, W, 0);
        const L2 = W * W + H * H, foot = (px, py) => { const t = (px * W + (py - H) * -H) / L2; return [t * W, H - t * H]; };
        const f1 = foot(0, 0), f2 = foot(W, H); line(0, 0, f1[0], f1[1]); line(W, H, f2[0], f2[1]);
      } else if (ov === 'spiral') {
        // espiral de um retângulo áureo, esticada para a caixa (como no Photoshop)
        const PHI = 1.6180339887, kx = W / PHI, ky = H;
        let x = 0, y = 0, w = PHI, h = 1;
        const P = (px, py) => [px * kx, py * ky];
        const arc = (cx0, cy0, r, a0, a1) => { const n = 16; for (let i = 0; i <= n; i++) { const t = a0 + ((a1 - a0) * i) / n, q = P(cx0 + r * Math.cos(t), cy0 + r * Math.sin(t)); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); } };
        const seg = (x0, y0, x1, y1) => { const a0 = P(x0, y0), a1 = P(x1, y1); line(a0[0], a0[1], a1[0], a1[1]); };
        for (let k = 0; k < 10 && w > 0.002 && h > 0.002; k++) {
          const d = k % 4;
          if (d === 0) { const s2 = h; arc(x + s2, y + s2, s2, Math.PI, 1.5 * Math.PI); seg(x + s2, y, x + s2, y + h); x += s2; w -= s2; }
          else if (d === 1) { const s2 = w; arc(x, y + s2, s2, 1.5 * Math.PI, 2 * Math.PI); seg(x, y + s2, x + w, y + s2); y += s2; h -= s2; }
          else if (d === 2) { const s2 = h; arc(x + w - s2, y, s2, 0, 0.5 * Math.PI); seg(x + w - s2, y, x + w - s2, y + h); w -= s2; }
          else { const s2 = w; arc(x + w, y + h - s2, s2, 0.5 * Math.PI, Math.PI); seg(x, y + h - s2, x + w, y + h - s2); h -= s2; }
        }
      }
      ctx.stroke();
      // contorno e alças
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2c2f35';
      for (const [hx, hy] of HANDLES) {
        const px = (W * (hx + 1)) / 2, py = (H * (hy + 1)) / 2;
        ctx.fillRect(px - 4, py - 4, 8, 8); ctx.strokeRect(px - 4.5, py - 4.5, 9, 9);
      }
      ctx.restore();
    }
  };
  IMG.Tools.register(tool);

  /* ==================================================================
     FATIAS
     ================================================================== */
  const Slices = (IMG.Slices = {
    list(doc) { if (!doc.slices) doc.slices = []; return doc.slices; },
    add(doc, r) {
      const s = { id: U.uid('slice'), name: (doc.name || 'imagem').replace(/\.[^.]+$/, '') + '_' + String(this.list(doc).length + 1).padStart(2, '0'), x: Math.round(r.x), y: Math.round(r.y), w: Math.max(1, Math.round(r.w)), h: Math.max(1, Math.round(r.h)), url: '', alt: '' };
      this.list(doc).push(s); doc.activeSlice = s.id; doc.showSlices = true;
      bus.emit('slices:change', doc); IMG.Engine.requestRender();
      return s;
    },
    find(doc, x, y) { const l = this.list(doc); for (let i = l.length - 1; i >= 0; i--) { const s = l[i]; if (x >= s.x && y >= s.y && x < s.x + s.w && y < s.y + s.h) return s; } return null; },
    /** Fatias automáticas: divide o restante da imagem em retângulos (como no Photoshop). */
    auto(doc) {
      const xs = new Set([0, doc.width]), ys = new Set([0, doc.height]);
      this.list(doc).forEach((s) => { xs.add(U.clamp(s.x, 0, doc.width)); xs.add(U.clamp(s.x + s.w, 0, doc.width)); ys.add(U.clamp(s.y, 0, doc.height)); ys.add(U.clamp(s.y + s.h, 0, doc.height)); });
      const X = [...xs].sort((a, b) => a - b), Y = [...ys].sort((a, b) => a - b), out = [];
      for (let j = 0; j < Y.length - 1; j++) for (let i = 0; i < X.length - 1; i++) {
        const r = { x: X[i], y: Y[j], w: X[i + 1] - X[i], h: Y[j + 1] - Y[j] };
        if (r.w > 0 && r.h > 0 && !this.find(doc, r.x + r.w / 2, r.y + r.h / 2)) out.push(r);
      }
      return out;
    },
    fromGuides(doc) {
      const xs = [0, ...doc.guides.v.filter((g) => g > 0 && g < doc.width), doc.width].sort((a, b) => a - b), ys = [0, ...doc.guides.h.filter((g) => g > 0 && g < doc.height), doc.height].sort((a, b) => a - b);
      doc.slices = [];
      for (let j = 0; j < ys.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) if (xs[i + 1] > xs[i] && ys[j + 1] > ys[j]) this.add(doc, { x: xs[i], y: ys[j], w: xs[i + 1] - xs[i], h: ys[j + 1] - ys[j] });
      IMG.commit('Fatias a partir das guias');
    },
    fromLayer(doc) {
      const b = doc.active && doc.active.contentBounds(); if (!b) return;
      this.add(doc, U.rectIntersect(b, doc.rect) || b); IMG.commit('Nova fatia baseada em camada');
    },
    divide(doc, s, nx, ny) {
      const l = this.list(doc), i = l.indexOf(s); if (i < 0) return;
      l.splice(i, 1);
      for (let j = 0; j < ny; j++) for (let k = 0; k < nx; k++) {
        const x0 = Math.round(s.x + (s.w * k) / nx), x1 = Math.round(s.x + (s.w * (k + 1)) / nx), y0 = Math.round(s.y + (s.h * j) / ny), y1 = Math.round(s.y + (s.h * (j + 1)) / ny);
        this.add(doc, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
      IMG.commit('Dividir fatia');
    },
    /** Exporta cada fatia (do usuário e automáticas) como PNG; várias fatias vão em um .zip. */
    async export(doc, fmt = 'png') {
      const all = this.list(doc).map((s) => ({ name: s.name, r: s })).concat(this.auto(doc).map((r, i) => ({ name: (doc.name || 'imagem').replace(/\.[^.]+$/, '') + '_auto_' + (i + 1), r })));
      if (!this.list(doc).length) { IMG.UI.toast('Crie fatias com a ferramenta Fatia (C).'); return; }
      const comp = IMG.Engine.flatten ? IMG.Engine.flatten(doc) : IMG.Engine.composite(doc);
      const files = [];
      for (const it of all) {
        const r = U.rectIntersect(it.r, doc.rect); if (!r) continue;
        const c = U.createCanvas(r.w, r.h), x = c.getContext('2d');
        if (fmt === 'jpg') { x.fillStyle = '#fff'; x.fillRect(0, 0, r.w, r.h); }
        x.drawImage(comp, -r.x, -r.y);
        const blob = await U.toBlob(c, fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
        files.push({ name: it.name + '.' + fmt, data: blob });
      }
      if (files.length === 1) U.download(files[0].data, files[0].name);
      else if (IMG.Formats && IMG.Formats.zip) U.download(await IMG.Formats.zip(files), (doc.name || 'imagem').replace(/\.[^.]+$/, '') + '_fatias.zip');
      else for (const f of files) U.download(f.data, f.name);
    },
    optionsDialog(doc, s) {
      const UI = IMG.UI, el = U.el;
      const nameIn = el('input.inp', { type: 'text', value: s.name }), urlIn = el('input.inp', { type: 'text', value: s.url || '', placeholder: 'https://' }), altIn = el('input.inp', { type: 'text', value: s.alt || '' });
      let r = { x: s.x, y: s.y, w: s.w, h: s.h };
      const n = (k) => UI.num({ value: r[k], min: k === 'w' || k === 'h' ? 1 : -30000, max: 30000, unit: 'px', width: 80, onInput: (v) => { r[k] = v; } }).el;
      UI.dialog({ title: 'Opções de fatia', width: 380, body: [UI.row('Nome', nameIn), UI.row('URL', urlIn), UI.row('Texto alt.', altIn), el('div.props-grid2', UI.row('X', n('x')), UI.row('Y', n('y')), UI.row('L', n('w')), UI.row('A', n('h')))],
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => { Object.assign(s, r, { name: nameIn.value.trim() || s.name, url: urlIn.value.trim(), alt: altIn.value }); bus.emit('slices:change', doc); IMG.Engine.requestRender(); IMG.commit('Opções de fatia'); } }] });
    },
    draw(ctx, v, doc) {
      if (!doc.showSlices && !['slice', 'sliceSelect'].includes(T().activeId)) return;
      const z = v.zoom, user = this.list(doc);
      if (!user.length && T().activeId !== 'slice') return;
      ctx.save();
      ctx.font = '600 10px system-ui, sans-serif'; ctx.textBaseline = 'top';
      const box = (r, on, autoS, idx) => {
        const x = Math.round(v.x + r.x * z) + 0.5, y = Math.round(v.y + r.y * z) + 0.5, w = Math.round(r.w * z) - 1, h = Math.round(r.h * z) - 1;
        ctx.strokeStyle = autoS ? 'rgba(160,170,185,.7)' : on ? '#f0a020' : '#4d8fd6'; ctx.lineWidth = 1;
        ctx.setLineDash(autoS ? [3, 3] : []); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
        const tag = String(idx).padStart(2, '0');
        const tw = ctx.measureText(tag).width + 18;
        ctx.fillStyle = autoS ? 'rgba(120,128,140,.85)' : on ? '#f0a020' : '#3577c0'; ctx.fillRect(x + 1, y + 1, tw, 14);
        ctx.fillStyle = '#fff'; ctx.fillText(tag, x + 4, y + 3);
        ctx.strokeStyle = '#fff'; ctx.strokeRect(x + tw - 10, y + 4, 7, 7);
        if (!autoS) { ctx.fillStyle = '#fff'; ctx.fillRect(x + tw - 8, y + 6, 3, 3); }
        if (on) { ctx.fillStyle = '#f0a020'; [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]].forEach(([i, j]) => ctx.fillRect(x + w * i - 3, y + h * j - 3, 6, 6)); }
      };
      let k = 1;
      const autos = ['slice', 'sliceSelect'].includes(T().activeId) ? this.auto(doc) : [], all = [];
      // numeração na ordem de leitura (de cima para baixo, da esquerda para a direita)
      user.forEach((s) => all.push({ r: s, user: true })); autos.forEach((r) => all.push({ r, user: false }));
      all.sort((a, b) => a.r.y - b.r.y || a.r.x - b.r.x).forEach((it) => box(it.r, it.user && it.r.id === doc.activeSlice, !it.user, k++));
      ctx.restore();
    }
  });
  // desenha as fatias sobre a vista (depois da ferramenta ativa)
  {
    const E = IMG.Engine, prev = E.drawExtras;
    E.drawExtras = function (ctx, v, doc) { if (prev) prev.call(this, ctx, v, doc); try { Slices.draw(ctx, v, doc); } catch (err) { console.error(err); } };
  }

  const sliceHandle = (doc, s, ev) => {
    const z = doc.view.zoom, tol = 6 / z;
    const P = [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]];
    for (let i = 0; i < 8; i++) if (Math.abs(ev.x - (s.x + s.w * P[i][0])) <= tol && Math.abs(ev.y - (s.y + s.h * P[i][1])) <= tol) return { i, P: P[i] };
    return null;
  };
  IMG.Tools.register({
    id: 'slice', name: 'Fatia', icon: 'slice', group: 'crop', cursor: 'crosshair',
    defaults: { style: 'normal', fw: 64, fh: 64 },
    hint: 'Arraste para criar uma fatia · Shift: quadrada · Alt: a partir do centro',
    options() {
      const o = T().o('slice'), d = IMG.app.doc;
      return [
        { type: 'select', key: 'style', label: 'Estilo', options: [['normal', 'Normal'], ['ratio', 'Proporção fixa'], ['size', 'Tamanho fixo']], width: 130, onChange: () => IMG.UI.renderOptions() },
        o.style !== 'normal' ? { type: 'number', key: 'fw', label: 'L', min: 1, max: 30000, width: 64 } : null,
        o.style !== 'normal' ? { type: 'number', key: 'fh', label: 'A', min: 1, max: 30000, width: 64 } : null,
        { type: 'sep' },
        { type: 'button', label: 'Fatias a partir das guias', onClick: () => d && Slices.fromGuides(d) },
        { type: 'button', label: 'A partir da camada', onClick: () => d && Slices.fromLayer(d) },
        { type: 'button', label: 'Exportar fatias', icon: 'save', onClick: () => d && Slices.export(d) }
      ];
    },
    down(ev) { this.d = { x: ev.x, y: ev.y }; this.r = null; },
    move(ev) {
      if (!this.d) return;
      const o = T().o('slice');
      let x1 = ev.x, y1 = ev.y; const x0 = this.d.x, y0 = this.d.y;
      if (o.style === 'size') { this.r = { x: x0, y: y0, w: o.fw, h: o.fh }; }
      else {
        const k = o.style === 'ratio' ? o.fw / o.fh : ev.shift ? 1 : 0;
        if (k) { const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0); if (w / k > h) y1 = y0 + Math.sign(y1 - y0 || 1) * (w / k); else x1 = x0 + Math.sign(x1 - x0 || 1) * h * k; }
        let r = U.rectFromPoints(x0, y0, x1, y1);
        if (ev.alt) r = { x: x0 - r.w, y: y0 - r.h, w: r.w * 2, h: r.h * 2 };
        this.r = r;
      }
      IMG.UI.setHint(Math.round(this.r.w) + ' × ' + Math.round(this.r.h) + ' px');
      IMG.Engine.requestRender();
    },
    up(ev) {
      const doc = IMG.app.doc, o = T().o('slice');
      let r = this.r; this.d = null; this.r = null; IMG.UI.setHint('');
      if (!r && o.style === 'size') r = { x: ev.x, y: ev.y, w: o.fw, h: o.fh };
      if (!r || r.w < 2 || r.h < 2) { const s = Slices.find(doc, ev.x, ev.y); if (s) { doc.activeSlice = s.id; IMG.Engine.requestRender(); } return; }
      Slices.add(doc, r); IMG.commit('Fatia');
    },
    dblclick(ev) { const d = IMG.app.doc, s = Slices.find(d, ev.x, ev.y); if (s) Slices.optionsDialog(d, s); },
    drawOverlay(ctx, v) {
      const r = this.r; if (!r) return;
      ctx.save(); ctx.strokeStyle = '#f0a020'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.strokeRect(Math.round(v.x + r.x * v.zoom) + 0.5, Math.round(v.y + r.y * v.zoom) + 0.5, Math.round(r.w * v.zoom), Math.round(r.h * v.zoom));
      ctx.restore();
    }
  });

  IMG.Tools.register({
    id: 'sliceSelect', name: 'Seleção de fatia', icon: 'sliceSelect', group: 'crop', cursor: 'default',
    defaults: {},
    hint: 'Clique para selecionar · arraste para mover ou redimensionar · Delete: excluir · duplo clique: opções',
    options() {
      const d = IMG.app.doc, s = d && Slices.list(d).find((q) => q.id === d.activeSlice);
      const run = (fn) => () => { if (d && s) fn(d, s); };
      return [
        { type: 'button', label: 'Trazer para frente', onClick: run((dd, ss) => { const l = Slices.list(dd); l.splice(l.indexOf(ss), 1); l.push(ss); IMG.Engine.requestRender(); IMG.commit('Ordem da fatia'); }) },
        { type: 'button', label: 'Enviar para trás', onClick: run((dd, ss) => { const l = Slices.list(dd); l.splice(l.indexOf(ss), 1); l.unshift(ss); IMG.Engine.requestRender(); IMG.commit('Ordem da fatia'); }) },
        { type: 'sep' },
        { type: 'button', label: 'Dividir…', onClick: run((dd, ss) => { let nx = 2, ny = 1; const UI = IMG.UI; UI.dialog({ title: 'Dividir fatia', width: 300, body: [UI.row('Na horizontal', UI.num({ value: 2, min: 1, max: 100, width: 70, onInput: (v) => { nx = v; } }).el), UI.row('Na vertical', UI.num({ value: 1, min: 1, max: 100, width: 70, onInput: (v) => { ny = v; } }).el)], buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => Slices.divide(dd, ss, nx, ny) }] }); }) },
        { type: 'button', label: 'Opções da fatia…', onClick: run((dd, ss) => Slices.optionsDialog(dd, ss)) },
        { type: 'check', label: 'Mostrar fatias automáticas', value: true, onChange: () => IMG.Engine.requestRender() }
      ];
    },
    down(ev) {
      const doc = IMG.app.doc, cur = Slices.list(doc).find((q) => q.id === doc.activeSlice);
      const h = cur && sliceHandle(doc, cur, ev);
      const s = h ? cur : Slices.find(doc, ev.x, ev.y);
      doc.activeSlice = s ? s.id : null;
      this.d = s && !doc.lockSlices ? { s, h, x: ev.x, y: ev.y, r0: { x: s.x, y: s.y, w: s.w, h: s.h }, moved: false } : null;
      IMG.Engine.requestRender(); IMG.UI.renderOptions();
    },
    move(ev) {
      const d = this.d; if (!d) return;
      const dx = Math.round(ev.x - d.x), dy = Math.round(ev.y - d.y), r0 = d.r0, s = d.s;
      d.moved = true;
      if (!d.h) { s.x = r0.x + dx; s.y = r0.y + dy; }
      else {
        const [i, j] = d.h.P;
        let x0 = r0.x, y0 = r0.y, x1 = r0.x + r0.w, y1 = r0.y + r0.h;
        if (i === 0) x0 += dx; else if (i === 1) x1 += dx;
        if (j === 0) y0 += dy; else if (j === 1) y1 += dy;
        Object.assign(s, U.rectFromPoints(x0, y0, x1, y1)); s.w = Math.max(1, s.w); s.h = Math.max(1, s.h);
      }
      IMG.UI.setHint(s.w + ' × ' + s.h + ' px'); IMG.Engine.requestRender();
    },
    up() { const d = this.d; this.d = null; IMG.UI.setHint(''); if (d && d.moved) IMG.commit('Editar fatia'); },
    hover(ev) {
      const doc = IMG.app.doc, cur = Slices.list(doc).find((q) => q.id === doc.activeSlice), h = cur && sliceHandle(doc, cur, ev);
      T().cursor(h ? (h.P[0] === 0.5 ? 'ns-resize' : h.P[1] === 0.5 ? 'ew-resize' : (h.P[0] === h.P[1] ? 'nwse-resize' : 'nesw-resize')) : Slices.find(doc, ev.x, ev.y) ? 'move' : 'default');
    },
    dblclick(ev) { const d = IMG.app.doc, s = Slices.find(d, ev.x, ev.y); if (s) Slices.optionsDialog(d, s); },
    onKey(e) {
      const doc = IMG.app.doc, s = Slices.list(doc).find((q) => q.id === doc.activeSlice);
      if (!s) return false;
      if (doc.lockSlices) return false;
      if (e.key === 'Delete' || e.key === 'Backspace') { doc.slices = doc.slices.filter((q) => q !== s); doc.activeSlice = null; IMG.Engine.requestRender(); IMG.commit('Excluir fatia'); return true; }
      const st = e.shiftKey ? 10 : 1, k = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
      if (k) { s.x += k[0]; s.y += k[1]; IMG.Engine.requestRender(); IMG.commit('Mover fatia'); return true; }
      return false;
    }
  });

  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, H) => {
    C('view.slices', 'Fatias', () => { const d = H.doc(); d.showSlices = !d.showSlices; IMG.Engine.requestRender(); }, { enabled: H.has, checked: () => !!(H.has() && H.doc().showSlices) });
    C('file.exportSlices', 'Exportar fatias…', () => Slices.export(H.doc()), { enabled: () => !!(H.has() && (H.doc().slices || []).length) });
    C('view.lockSlices', 'Bloquear fatias', () => { const d = H.doc(); d.lockSlices = !d.lockSlices; }, { enabled: H.has, checked: () => !!(H.has() && H.doc().lockSlices) });
    C('view.guidesFromShape', 'Novas guias a partir da forma', () => {
      const d = H.doc(), b = d.selection && d.selection.bounds && !(d.active && d.active.type === 'shape') ? d.selection.bounds : d.active && d.active.contentBounds();
      if (!b) { IMG.UI.toast('Selecione uma camada de forma (ou com conteúdo).'); return; }
      const add = (arr, v) => { if (!arr.some((g) => Math.abs(g - v) < 0.01)) arr.push(v); };
      [b.x, b.x + b.w / 2, b.x + b.w].forEach((v) => add(d.guides.v, U.round(v, 2)));
      [b.y, b.y + b.h / 2, b.y + b.h].forEach((v) => add(d.guides.h, U.round(v, 2)));
      IMG.app.prefs.showGuides = true; IMG.Engine.requestRender(); IMG.commit('Novas guias a partir da forma');
    }, { enabled: () => !!(H.has() && H.doc().active && H.doc().active.type !== 'group') });
    C('view.printSize', 'Tamanho de impressão', () => { const d = H.doc(); IMG.Engine.setZoom(96 / (d.dpi || 72)); }, { enabled: H.has });
    C('view.clearSlices', 'Limpar fatias', () => { const d = H.doc(); d.slices = []; d.activeSlice = null; IMG.Engine.requestRender(); IMG.commit('Excluir fatias'); }, { enabled: () => !!(H.has() && (H.doc().slices || []).length) });
  });
})();
