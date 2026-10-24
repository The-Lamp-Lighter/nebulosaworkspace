/* ==========================================================================
   Imaginarium — ferramentas de seleção
   Letreiro retangular/elíptico/linha única/coluna única (M), Laço, Laço
   poligonal, Laço magnético (L), Varinha mágica e Seleção rápida (W).
   Shift = adicionar · Alt = subtrair · Shift+Alt = interseção.
   Arrastar dentro da seleção (modo Nova) move o contorno; setas o deslocam.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus;
  const Sel = IMG.Selection, T = () => IMG.Tools;

  const MODES = [
    { value: 'new', icon: 'selNew', title: 'Nova seleção' },
    { value: 'add', icon: 'selAdd', title: 'Adicionar à seleção (Shift)' },
    { value: 'sub', icon: 'selSub', title: 'Subtrair da seleção (Alt)' },
    { value: 'int', icon: 'selInt', title: 'Interseção com a seleção (Shift+Alt)' },
    { value: 'xor', icon: 'selXor', title: 'Excluir sobreposição (XOR)' }
  ];
  const modeFrom = (ev, def) => (ev.shift && ev.alt ? 'int' : ev.shift ? 'add' : ev.alt ? 'sub' : def);
  IMG.SEL_MODES = MODES;
  IMG.selModeFrom = modeFrom;

  function dashed(ctx, draw) {
    ctx.lineWidth = 1;
    ctx.setLineDash([]); ctx.strokeStyle = '#fff'; ctx.beginPath(); draw(); ctx.stroke();
    ctx.setLineDash([4, 4]); ctx.strokeStyle = '#111'; ctx.beginPath(); draw(); ctx.stroke();
    ctx.setLineDash([]);
  }
  IMG.dashedPath = dashed;
  const refineBtn = { type: 'button', label: 'Refinar borda…', title: 'Selecionar › Refinar borda (Alt+Ctrl+R)', onClick: () => IMG.UI.run('select.refineEdge') };
  const baseOpts = (o, extra) => [{ type: 'seg', key: 'mode', options: MODES }, { type: 'sep' }].concat(extra || []);

  /* ---------- mover o contorno da seleção (comum às ferramentas) ---------- */
  const mover = {
    canStart(doc, ev, o) { return (o.mode || 'new') === 'new' && !ev.shift && !ev.alt && doc.selection && !doc.quickMask && Sel.contains(doc, ev.x, ev.y); },
    start(doc, ev) { const s = doc.selection; return { x: ev.x, y: ev.y, base: U.cloneCanvas(s.canvas), path: s.path, dx: 0, dy: 0 }; },
    move(doc, m, ev) {
      m.dx = Math.round(ev.x - m.x); m.dy = Math.round(ev.y - m.y);
      if (ev.shift) { if (Math.abs(m.dx) > Math.abs(m.dy)) m.dy = 0; else m.dx = 0; }
      const p = new Path2D(); p.addPath(m.path, new DOMMatrix([1, 0, 0, 1, m.dx, m.dy]));
      doc.selection.path = p;
      IMG.Engine.requestRender();
    },
    /** Ao soltar: sem arraste, um clique dentro da seleção a desfaz (como no Photoshop). */
    end(doc, m, onClick) {
      if (!m.dx && !m.dy) {
        if (doc.selection) doc.selection.path = m.path;
        if (onClick) onClick(); else if (Sel.clear(doc)) IMG.commit('Desmarcar');
        return;
      }
      const s = doc.selection, ctx = s.canvas.getContext('2d');
      ctx.clearRect(0, 0, doc.width, doc.height); ctx.drawImage(m.base, m.dx, m.dy);
      IMG.markDirty(s); Sel.update(doc); IMG.commit('Mover seleção');
    },
    nudge(doc, e, combo) {
      if (!doc.selection || !/^(shift\+)?arrow/.test(combo)) return false;
      const n = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
      const s = doc.selection, base = U.cloneCanvas(s.canvas), ctx = s.canvas.getContext('2d');
      ctx.clearRect(0, 0, doc.width, doc.height); ctx.drawImage(base, dx, dy);
      IMG.markDirty(s); Sel.update(doc); IMG.commit('Mover seleção');
      return true;
    },
    hover(doc, ev, o) { T().cursor(this.canStart(doc, ev, o) ? 'move' : 'crosshair'); }
  };
  IMG.selMover = mover;

  /* ==================================================================
     LETREIROS
     ================================================================== */
  function makeMarquee(id, name, icon, kind) {
    return {
      id, name, icon, cursor: 'crosshair',
      defaults: { mode: 'new', feather: 0, antiAlias: true, style: 'normal', fw: 1, fh: 1 },
      hint: 'Shift: quadrado/círculo · Alt: a partir do centro · Espaço: reposicionar durante o arraste',
      options() {
        const o = T().o(id), list = baseOpts(o, [{ type: 'slider', key: 'feather', label: 'Difusão', min: 0, max: 250, step: 1, unit: 'px' }]);
        if (kind === 'ellipse') list.push({ type: 'check', key: 'antiAlias', label: 'Suavização de serrilhado' });
        list.push({ type: 'select', key: 'style', label: 'Estilo', options: [['normal', 'Normal'], ['ratio', 'Proporção fixa'], ['size', 'Tamanho fixo']], width: 130 });
        if (o.style !== 'normal') {
          list.push({ type: 'number', key: 'fw', label: 'L', min: o.style === 'size' ? 1 : 0.01, max: 30000, decimals: o.style === 'ratio' ? 2 : 0, width: 64, unit: o.style === 'size' ? 'px' : '' });
          list.push({ type: 'custom', build: () => IMG.UI.iconBtn('swap', 'Trocar largura e altura', () => { const q = T().o(id), t = q.fw; T().setOpt(id, 'fw', q.fh, true); T().setOpt(id, 'fh', t); }) });
          list.push({ type: 'number', key: 'fh', label: 'A', min: o.style === 'size' ? 1 : 0.01, max: 30000, decimals: o.style === 'ratio' ? 2 : 0, width: 64, unit: o.style === 'size' ? 'px' : '' });
        }
        list.push(refineBtn);
        return list;
      },
      onOption(key) { if (key === 'style') IMG.UI.renderOptions(); },
      down(ev) {
        const doc = IMG.app.doc, o = T().o(id);
        this.mode = modeFrom(ev, o.mode);
        this.shift0 = ev.shift; this.alt0 = ev.alt;
        this.rect = null; this.moving = null; this.spaceLast = null;
        if (mover.canStart(doc, ev, o)) { this.moving = mover.start(doc, ev); return; }
        this.T = ev.ctrl ? { xs: [], ys: [], grid: 0 } : IMG.Snap.collect(doc);
        const p = IMG.Snap.point(doc, ev.x, ev.y, this.T);
        this.start = { x: p.x, y: p.y };
        if (o.style === 'size') { this.rect = { x: Math.round(p.x), y: Math.round(p.y), w: Math.max(1, Math.round(o.fw)), h: Math.max(1, Math.round(o.fh)) }; IMG.Engine.requestRender(); }
      },
      move(ev) {
        const doc = IMG.app.doc, o = T().o(id);
        if (this.moving) { mover.move(doc, this.moving, ev); return; }
        if (!this.start) return;
        if (o.style === 'size') { this.rect = { x: Math.round(ev.x), y: Math.round(ev.y), w: Math.max(1, Math.round(o.fw)), h: Math.max(1, Math.round(o.fh)) }; IMG.Engine.requestRender(); return; }
        // Espaço durante o arraste: reposiciona o letreiro
        if (T().spaceDrag) {
          if (this.spaceLast) { const dx = ev.x - this.spaceLast.x, dy = ev.y - this.spaceLast.y; this.start.x += dx; this.start.y += dy; if (this.rect) { this.rect.x = Math.round(this.rect.x + dx); this.rect.y = Math.round(this.rect.y + dy); } }
          this.spaceLast = { x: ev.x, y: ev.y };
          IMG.Engine.requestRender();
          return;
        }
        this.spaceLast = null;
        const p = IMG.Snap.point(doc, ev.x, ev.y, this.T);
        IMG.Engine.smart = p.lines;
        let x0 = this.start.x, y0 = this.start.y, x1 = p.x, y1 = p.y;
        const square = ev.shift && !this.shift0, center = ev.alt && !this.alt0;
        if (o.style === 'ratio') {
          const rw = Math.max(0.01, o.fw), rh = Math.max(0.01, o.fh);
          const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), k = Math.max(w / rw, h / rh);
          x1 = x0 + Math.sign(x1 - x0 || 1) * rw * k; y1 = y0 + Math.sign(y1 - y0 || 1) * rh * k;
        } else if (square) { const s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); x1 = x0 + Math.sign(x1 - x0 || 1) * s; y1 = y0 + Math.sign(y1 - y0 || 1) * s; }
        if (center) { x0 = 2 * this.start.x - x1; y0 = 2 * this.start.y - y1; }
        if (!ev.shift) this.shift0 = false;
        if (!ev.alt) this.alt0 = false;
        const r = U.rectFromPoints(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1));
        this.rect = r;
        IMG.UI.setHint(r.w + ' × ' + r.h + ' px');
        IMG.Engine.requestRender();
      },
      up() {
        const doc = IMG.app.doc, o = T().o(id);
        IMG.Engine.smart = [];
        IMG.UI.setHint('');
        if (this.moving) { const m = this.moving; this.moving = null; mover.end(doc, m); return; }
        const r = this.rect; this.rect = null; this.start = null;
        if (!r || r.w < 1 || r.h < 1) {
          if (this.mode === 'new' && Sel.clear(doc)) IMG.commit('Desmarcar');
          IMG.Engine.requestRender();
          return;
        }
        Sel.fromPath(doc, (c) => {
          if (kind === 'ellipse') c.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
          else c.rect(r.x, r.y, r.w, r.h);
        }, this.mode, { feather: o.feather, antiAlias: kind === 'ellipse' ? o.antiAlias : true });
        IMG.commit(kind === 'ellipse' ? 'Letreiro elíptico' : 'Letreiro retangular');
      },
      hover(ev) { mover.hover(IMG.app.doc, ev, T().o(id)); },
      onKey(e, combo) { return mover.nudge(IMG.app.doc, e, combo); },
      drawOverlay(ctx, v) {
        const r = this.rect;
        if (!r) return;
        const x = v.x + r.x * v.zoom, y = v.y + r.y * v.zoom, w = r.w * v.zoom, h = r.h * v.zoom;
        dashed(ctx, () => {
          if (kind === 'ellipse') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          else ctx.rect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
        });
      }
    };
  }
  IMG.Tools.register(makeMarquee('marqueeRect', 'Letreiro retangular', 'marqueeRect', 'rect'));
  IMG.Tools.register(makeMarquee('marqueeEllipse', 'Letreiro elíptico', 'marqueeEllipse', 'ellipse'));

  /* ---------- linha única / coluna única ---------- */
  function makeSingle(id, name, icon, row) {
    return {
      id, name, icon, cursor: 'crosshair', defaults: { mode: 'new' },
      hint: row ? 'Clique para selecionar uma linha de 1 pixel' : 'Clique para selecionar uma coluna de 1 pixel',
      options() { return baseOpts(T().o(id), [refineBtn]); },
      down(ev) { this.mode = modeFrom(ev, T().o(id).mode); this.p = { x: Math.floor(ev.x), y: Math.floor(ev.y) }; IMG.Engine.requestRender(); },
      move(ev) { this.p = { x: Math.floor(ev.x), y: Math.floor(ev.y) }; IMG.Engine.requestRender(); },
      up() {
        const doc = IMG.app.doc, p = this.p; this.p = null;
        if (!p) return;
        Sel.fromPath(doc, (c) => (row ? c.rect(0, p.y, doc.width, 1) : c.rect(p.x, 0, 1, doc.height)), this.mode, { antiAlias: false });
        IMG.commit(name);
      },
      onKey(e, combo) { return mover.nudge(IMG.app.doc, e, combo); },
      drawOverlay(ctx, v) {
        const p = this.p, doc = IMG.app.doc; if (!p) return;
        dashed(ctx, () => (row ? ctx.rect(v.x, Math.round(v.y + p.y * v.zoom) + 0.5, doc.width * v.zoom, Math.max(1, v.zoom)) : ctx.rect(Math.round(v.x + p.x * v.zoom) + 0.5, v.y, Math.max(1, v.zoom), doc.height * v.zoom)));
      }
    };
  }
  IMG.Tools.register(makeSingle('marqueeRow', 'Letreiro de linha única', 'marqueeRow', true));
  IMG.Tools.register(makeSingle('marqueeCol', 'Letreiro de coluna única', 'marqueeCol', false));

  /* ==================================================================
     LAÇOS
     ================================================================== */
  function finishPoly(doc, pts, mode, o, label) {
    if (!pts || pts.length < 3) { if (mode === 'new' && Sel.clear(doc)) IMG.commit('Desmarcar'); IMG.Engine.requestRender(); return; }
    Sel.fromPath(doc, (c) => { c.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y); c.closePath(); }, mode, { feather: o.feather, antiAlias: o.antiAlias, rule: 'evenodd' });
    IMG.commit(label);
    IMG.Engine.requestRender();
  }
  const polyDraw = (ctx, v, pts, extra) => {
    if (!pts || !pts.length) return;
    dashed(ctx, () => {
      ctx.moveTo(v.x + pts[0].x * v.zoom, v.y + pts[0].y * v.zoom);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(v.x + pts[i].x * v.zoom, v.y + pts[i].y * v.zoom);
      if (extra) for (const p of extra) ctx.lineTo(v.x + p.x * v.zoom, v.y + p.y * v.zoom);
    });
  };
  const lassoOpts = (id) => () => baseOpts(T().o(id), [
    { type: 'slider', key: 'feather', label: 'Difusão', min: 0, max: 250, step: 1, unit: 'px' },
    { type: 'check', key: 'antiAlias', label: 'Suavização de serrilhado' }
  ]);

  /* ---------- Laço ---------- */
  IMG.Tools.register({
    id: 'lasso', name: 'Laço', icon: 'lasso', cursor: 'crosshair',
    defaults: { mode: 'new', feather: 0, antiAlias: true },
    hint: 'Arraste para desenhar a seleção à mão livre · Alt ao soltar: segmentos retos',
    options() { return lassoOpts('lasso')().concat([refineBtn]); },
    down(ev) {
      const doc = IMG.app.doc, o = T().o('lasso');
      if (this.poly) { this.poly.push({ x: ev.x, y: ev.y }); this.drawing = true; return; }
      this.moving = null;
      if (mover.canStart(doc, ev, o)) { this.moving = mover.start(doc, ev); return; }
      this.mode = modeFrom(ev, o.mode);
      this.pts = [{ x: ev.x, y: ev.y }];
    },
    move(ev) {
      if (this.moving) { mover.move(IMG.app.doc, this.moving, ev); return; }
      const pts = this.poly || this.pts;
      if (!pts) return;
      const l = pts[pts.length - 1];
      if (Math.hypot(ev.x - l.x, ev.y - l.y) * IMG.app.doc.view.zoom < 1.5) return;
      pts.push({ x: ev.x, y: ev.y });
      IMG.Engine.requestRender();
    },
    up(ev) {
      const doc = IMG.app.doc;
      if (this.moving) { const m = this.moving; this.moving = null; mover.end(doc, m); return; }
      // Alt ao soltar: continua com segmentos retos até soltar o Alt
      if (ev && ev.alt && this.pts && this.pts.length > 1 && !this.poly) { this.poly = this.pts; this.pts = null; return; }
      if (this.poly) { if (!ev || !ev.alt) { const p = this.poly; this.poly = null; finishPoly(doc, p, this.mode, T().o('lasso'), 'Laço'); } return; }
      const pts = this.pts; this.pts = null;
      finishPoly(doc, pts, this.mode, T().o('lasso'), 'Laço');
    },
    hover(ev) {
      if (this.poly) { this.hoverPt = { x: ev.x, y: ev.y }; IMG.Engine.requestRender(); return; }
      mover.hover(IMG.app.doc, ev, T().o('lasso'));
    },
    onKeyUp(e) { if (e.key === 'Alt' && this.poly && !T().isDown) { const p = this.poly; this.poly = null; finishPoly(IMG.app.doc, p, this.mode, T().o('lasso'), 'Laço'); } },
    onKey(e, combo) { if (e.key === 'Escape' && (this.pts || this.poly)) { this.pts = this.poly = null; IMG.Engine.requestRender(); return true; } return mover.nudge(IMG.app.doc, e, combo); },
    deactivate() { this.pts = this.poly = null; },
    drawOverlay(ctx, v) { polyDraw(ctx, v, this.poly || this.pts, this.poly && this.hoverPt ? [this.hoverPt] : null); }
  });

  /* ---------- Laço poligonal ---------- */
  IMG.Tools.register({
    id: 'polyLasso', name: 'Laço poligonal', icon: 'polyLasso', cursor: 'crosshair',
    defaults: { mode: 'new', feather: 0, antiAlias: true },
    hint: 'Clique para adicionar pontos · clique no início ou duplo clique para fechar · Backspace remove o último · Shift: 45°',
    options() { return lassoOpts('polyLasso')().concat([refineBtn]); },
    snap(ev) {
      const pts = this.pts; let x = ev.x, y = ev.y;
      if (ev.shift && pts && pts.length) { const l = pts[pts.length - 1], len = Math.hypot(x - l.x, y - l.y), a = Math.round(Math.atan2(y - l.y, x - l.x) / (Math.PI / 4)) * (Math.PI / 4); x = l.x + Math.cos(a) * len; y = l.y + Math.sin(a) * len; }
      return { x, y };
    },
    nearStart(ev) { const p = this.pts && this.pts[0], v = IMG.app.doc.view; return p && this.pts.length > 2 && Math.hypot((ev.x - p.x) * v.zoom, (ev.y - p.y) * v.zoom) < 7; },
    down(ev) {
      const doc = IMG.app.doc, o = T().o('polyLasso');
      if (!this.pts) {
        this.mode = modeFrom(ev, o.mode);
        if (mover.canStart(doc, ev, o)) { this.moving = mover.start(doc, ev); this.pendingPt = { x: ev.x, y: ev.y }; return; }
        this.pts = [{ x: ev.x, y: ev.y }];
        IMG.Engine.requestRender();
        return;
      }
      if (this.nearStart(ev)) { this.close(); return false; }
      this.pts.push(this.snap(ev));
      IMG.Engine.requestRender();
    },
    move(ev) { if (this.moving) mover.move(IMG.app.doc, this.moving, ev); else this.hover(ev); },
    up() { if (this.moving) { const m = this.moving, p = this.pendingPt; this.moving = null; this.pendingPt = null; mover.end(IMG.app.doc, m, () => { this.pts = [p]; IMG.Engine.requestRender(); }); } },
    dblclick() { if (this.pts) { this.pts.pop(); this.close(); } },
    close() { const p = this.pts; this.pts = null; this.cur = null; finishPoly(IMG.app.doc, p, this.mode, T().o('polyLasso'), 'Laço poligonal'); },
    hover(ev) {
      if (!this.pts) { mover.hover(IMG.app.doc, ev, T().o('polyLasso')); return; }
      this.cur = this.snap(ev);
      T().cursor(this.nearStart(ev) ? 'pointer' : 'crosshair');
      IMG.Engine.requestRender();
    },
    onKey(e, combo) {
      if (!this.pts) return mover.nudge(IMG.app.doc, e, combo);
      if (e.key === 'Escape') { this.pts = null; IMG.Engine.requestRender(); return true; }
      if (e.key === 'Backspace' || e.key === 'Delete') { this.pts.pop(); if (!this.pts.length) this.pts = null; IMG.Engine.requestRender(); return true; }
      if (e.key === 'Enter') { this.close(); return true; }
      return false;
    },
    beforeCommand() { if (this.pts) { this.pts = null; } return false; },
    deactivate() { this.pts = null; },
    drawOverlay(ctx, v) {
      if (!this.pts) return;
      polyDraw(ctx, v, this.pts, this.cur ? [this.cur] : null);
      const p = this.pts[0]; ctx.strokeStyle = '#fff'; ctx.strokeRect(Math.round(v.x + p.x * v.zoom) - 3.5, Math.round(v.y + p.y * v.zoom) - 3.5, 7, 7);
    }
  });

  /* ---------- Laço magnético ---------- */
  /** Mapa de bordas (0..1) do documento (luminância, Sobel). */
  function edgeMap(doc, sampleAll) {
    const W = doc.width, H = doc.height;
    const src = sampleAll !== false ? IMG.Engine.composite(doc) : (() => { const c = U.createCanvas(W, H); const L = doc.active; if (L && L.canvas) c.getContext('2d').drawImage(L.canvas, L.x, L.y); return c; })();
    const d = src.getContext('2d').getImageData(0, 0, W, H).data;
    const lum = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * (d[i * 4 + 3] / 255) + (255 - d[i * 4 + 3]) * 0.5;
    const g = new Float32Array(W * H);
    let mx = 1;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = -lum[i - W - 1] - 2 * lum[i - 1] - lum[i + W - 1] + lum[i - W + 1] + 2 * lum[i + 1] + lum[i + W + 1];
      const gy = -lum[i - W - 1] - 2 * lum[i - W] - lum[i - W + 1] + lum[i + W - 1] + 2 * lum[i + W] + lum[i + W + 1];
      const v = Math.sqrt(gx * gx + gy * gy); g[i] = v; if (v > mx) mx = v;
    }
    const k = 1 / Math.min(mx, 400);
    for (let i = 0; i < g.length; i++) g[i] = Math.min(1, g[i] * k);
    return { g, W, H };
  }
  IMG.edgeMap = edgeMap;

  /** Caminho de menor custo (fio inteligente) entre dois pontos dentro de uma janela. */
  function liveWire(E, a, b, contrast) {
    const pad = 16;
    const x0 = Math.max(0, Math.min(a.x, b.x) - pad), y0 = Math.max(0, Math.min(a.y, b.y) - pad);
    const x1 = Math.min(E.W - 1, Math.max(a.x, b.x) + pad), y1 = Math.min(E.H - 1, Math.max(a.y, b.y) + pad);
    const w = x1 - x0 + 1, h = y1 - y0 + 1, n = w * h;
    if (n > 250000) return [a, b];
    const dist = new Float32Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    const thr = contrast / 100 * 0.5;
    const cost = (gx, gy) => { const e = E.g[gy * E.W + gx]; return e < thr ? 1 : 1 - Math.min(0.97, e) + 0.03; };
    const heap = [], push = (i, d) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const s = (a.y - y0) * w + (a.x - x0), t = (b.y - y0) * w + (b.x - x0);
    dist[s] = 0; push(s, 0);
    while (heap.length) {
      const [d, i] = pop();
      if (done[i]) continue; done[i] = 1;
      if (i === t) break;
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx; if (done[j]) continue;
        const nd = d + cost(xx + x0, yy + y0) * (dx && dy ? 1.414 : 1);
        if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push(j, nd); }
      }
    }
    const path = [];
    for (let i = t; i >= 0; i = prev[i]) { path.push({ x: (i % w) + x0 + 0.5, y: ((i / w) | 0) + y0 + 0.5 }); if (i === s) break; }
    return path.reverse();
  }

  IMG.Tools.register({
    id: 'magLasso', name: 'Laço magnético', icon: 'magLasso', cursor: 'crosshair',
    defaults: { mode: 'new', feather: 0, antiAlias: true, width: 10, contrast: 10, frequency: 57 },
    hint: 'Clique e mova ao longo da borda · clique adiciona um ponto · duplo clique/Enter fecha · Backspace desfaz',
    options() {
      return lassoOpts('magLasso')().concat([
        { type: 'number', key: 'width', label: 'Largura', min: 1, max: 256, width: 56, unit: 'px' },
        { type: 'slider', key: 'contrast', label: 'Contraste', min: 1, max: 100, step: 1, unit: '%' },
        { type: 'slider', key: 'frequency', label: 'Frequência', min: 0, max: 100, step: 1 },
        refineBtn
      ]);
    },
    snapEdge(ev) {
      const E = this.E, o = T().o('magLasso'), r = Math.max(1, Math.round(o.width / 2));
      const cx = U.clamp(Math.floor(ev.x), 0, E.W - 1), cy = U.clamp(Math.floor(ev.y), 0, E.H - 1);
      let best = { x: cx, y: cy }, bv = E.g[cy * E.W + cx] - 0.001;
      for (let y = Math.max(0, cy - r); y <= Math.min(E.H - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(E.W - 1, cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        const v = E.g[y * E.W + x] - Math.hypot(x - cx, y - cy) * 0.004; if (v > bv) { bv = v; best = { x, y }; }
      }
      return best;
    },
    down(ev) {
      const doc = IMG.app.doc, o = T().o('magLasso');
      if (!this.pts) {
        this.mode = modeFrom(ev, o.mode);
        if (mover.canStart(doc, ev, o)) { this.moving = mover.start(doc, ev); this.pendingEv = ev; return; }
        this.begin(ev);
        return;
      }
      const v = doc.view, s = this.pts[0];
      if (this.pts.length > 3 && Math.hypot((ev.x - s.x) * v.zoom, (ev.y - s.y) * v.zoom) < 8) { this.close(true); return false; }
      this.commitLive(ev, true);
    },
    begin(ev) {
        this.E = edgeMap(IMG.app.doc);
        const p = this.snapEdge(ev);
        this.anchor = p; this.pts = [{ x: p.x + 0.5, y: p.y + 0.5 }]; this.anchors = [0]; this.live = null;
        IMG.Engine.requestRender();
    },
    commitLive(ev, all) {
      const tgt = this.snapEdge(ev);
      const path = liveWire(this.E, this.anchor, tgt, T().o('magLasso').contrast);
      for (let i = 1; i < path.length; i++) this.pts.push(path[i]);
      this.anchor = tgt; this.anchors.push(this.pts.length - 1); this.live = null;
      void all;
      IMG.Engine.requestRender();
    },
    move(ev) { if (this.moving) mover.move(IMG.app.doc, this.moving, ev); else this.hover(ev); },
    up() { if (this.moving) { const m = this.moving, pe = this.pendingEv; this.moving = null; this.pendingEv = null; mover.end(IMG.app.doc, m, () => this.begin(pe)); } },
    hover(ev) {
      if (!this.pts) { mover.hover(IMG.app.doc, ev, T().o('magLasso')); return; }
      const o = T().o('magLasso');
      const tgt = this.snapEdge(ev);
      let path = liveWire(this.E, this.anchor, tgt, o.contrast);
      // ponto automático conforme a frequência
      const spacing = 12 + (100 - o.frequency) * 1.4;
      let len = 0;
      for (let i = 1; i < path.length; i++) {
        len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
        if (len >= spacing && i < path.length - 1) {
          for (let k = 1; k <= i; k++) this.pts.push(path[k]);
          this.anchor = { x: Math.floor(path[i].x), y: Math.floor(path[i].y) }; this.anchors.push(this.pts.length - 1);
          path = path.slice(i); len = 0; i = 0;
        }
      }
      this.live = path;
      IMG.Engine.requestRender();
    },
    dblclick() { if (this.pts) this.close(false); },
    close(direct) {
      const doc = IMG.app.doc;
      if (!direct && this.anchor && this.pts.length > 2) { const back = liveWire(this.E, this.anchor, { x: Math.floor(this.pts[0].x), y: Math.floor(this.pts[0].y) }, T().o('magLasso').contrast); for (let i = 1; i < back.length; i++) this.pts.push(back[i]); }
      const p = this.pts; this.pts = null; this.live = null; this.E = null;
      finishPoly(doc, p, this.mode, T().o('magLasso'), 'Laço magnético');
    },
    onKey(e, combo) {
      if (!this.pts) return mover.nudge(IMG.app.doc, e, combo);
      if (e.key === 'Escape') { this.pts = null; this.live = null; IMG.Engine.requestRender(); return true; }
      if (e.key === 'Enter') { this.close(false); return true; }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (this.anchors.length > 1) { this.anchors.pop(); const k = this.anchors[this.anchors.length - 1]; this.pts.length = k + 1; const p = this.pts[k]; this.anchor = { x: Math.floor(p.x), y: Math.floor(p.y) }; }
        else { this.pts = null; this.live = null; }
        IMG.Engine.requestRender(); return true;
      }
      return false;
    },
    deactivate() { this.pts = null; this.live = null; this.E = null; },
    drawOverlay(ctx, v) {
      if (!this.pts) return;
      polyDraw(ctx, v, this.pts, this.live);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000';
      for (const k of this.anchors) { const p = this.pts[k]; if (!p) continue; const x = Math.round(v.x + p.x * v.zoom) - 2.5, y = Math.round(v.y + p.y * v.zoom) - 2.5; ctx.fillRect(x, y, 5, 5); ctx.strokeRect(x, y, 5, 5); }
    }
  });

  /* ==================================================================
     VARINHA MÁGICA
     ================================================================== */
  const SAMPLE_SIZES = [[1, 'Amostra de ponto'], [3, 'Média 3 × 3'], [5, 'Média 5 × 5'], [11, 'Média 11 × 11'], [31, 'Média 31 × 31'], [51, 'Média 51 × 51'], [101, 'Média 101 × 101']];
  IMG.Tools.register({
    id: 'wand', name: 'Varinha mágica', icon: 'wand', cursor: 'crosshair',
    defaults: { mode: 'new', tolerance: 32, contiguous: true, sampleAll: false, antiAlias: true, feather: 0, sample: 1 },
    hint: 'Clique para selecionar áreas de cor semelhante',
    options() {
      return baseOpts(T().o('wand'), [
        { type: 'select', key: 'sample', label: 'Tamanho da amostra', numeric: true, options: SAMPLE_SIZES, width: 130 },
        { type: 'slider', key: 'tolerance', label: 'Tolerância', min: 0, max: 255, step: 1 },
        { type: 'check', key: 'antiAlias', label: 'Suavização de serrilhado' },
        { type: 'check', key: 'contiguous', label: 'Contíguo' },
        { type: 'check', key: 'sampleAll', label: 'Usar todas as camadas' },
        refineBtn
      ]);
    },
    down(ev) {
      const doc = IMG.app.doc, o = T().o('wand');
      if (mover.canStart(doc, ev, o)) { this.moving = mover.start(doc, ev); this.pendingEv = ev; return; }
      return this.pick(ev);
    },
    pick(ev) {
      const doc = IMG.app.doc, o = T().o('wand');
      const mode = modeFrom(ev, o.mode);
      const x = Math.floor(ev.x), y = Math.floor(ev.y);
      if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) { if (mode === 'new' && Sel.clear(doc)) IMG.commit('Desmarcar'); return false; }
      const L = doc.active;
      let src;
      if (o.sampleAll || !L || L.type === 'group' || !L.canvas) src = IMG.Engine.composite(doc);
      else { src = Sel.scratch(doc); src.getContext('2d').drawImage(L.canvas, L.x, L.y); }
      const ctx = src.getContext('2d');
      const img = ctx.getImageData(0, 0, doc.width, doc.height), data = img.data;
      if (o.sample > 1) {
        // a cor de referência é a média da amostra: grava-a no pixel clicado de uma cópia
        const c = IMG.avgColorAt ? IMG.avgColorAt(src, x, y, o.sample) : null;
        if (c) { const i = (y * doc.width + x) * 4; data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; }
      }
      const mask = IMG.flood(data, doc.width, doc.height, x, y, o.tolerance, o.contiguous);
      const shape = IMG.maskToCanvas(mask, doc.width, doc.height);
      if (o.antiAlias) IMG.blurCanvas(shape, 0.5);
      if (o.feather > 0) IMG.blurCanvas(shape, o.feather);
      Sel.combine(doc, shape, mode);
      IMG.commit('Varinha mágica');
      return false;
    },
    move(ev) { if (this.moving) mover.move(IMG.app.doc, this.moving, ev); },
    up() { if (this.moving) { const m = this.moving, pe = this.pendingEv; this.moving = null; this.pendingEv = null; mover.end(IMG.app.doc, m, () => this.pick(pe)); } },
    hover(ev) { mover.hover(IMG.app.doc, ev, T().o('wand')); },
    onKey(e, combo) { return mover.nudge(IMG.app.doc, e, combo); }
  });

  /* ==================================================================
     SELEÇÃO RÁPIDA
     A cada carimbo, cresce uma região de cores parecidas com as já
     pinceladas, parando nas bordas fortes da imagem.
     ================================================================== */
  const QS_MODES = MODES.slice(0, 3);
  IMG.Tools.register({
    id: 'quickSel', name: 'Seleção rápida', icon: 'quickSel', cursor: 'crosshair',
    defaults: { mode: 'new', size: 30, sampleAll: false, enhance: true },
    hint: 'Pinte sobre a área: a seleção se expande até as bordas · Alt: subtrair · [ ]: tamanho',
    options() {
      return [{ type: 'seg', key: 'mode', options: QS_MODES }, { type: 'sep' },
        { type: 'slider', key: 'size', label: 'Tamanho', min: 1, max: 500, step: 1, unit: 'px', pow: 2 },
        { type: 'check', key: 'sampleAll', label: 'Usar todas as camadas' },
        { type: 'check', key: 'enhance', label: 'Aprimorar automaticamente' },
        refineBtn];
    },
    down(ev) {
      const doc = IMG.app.doc, o = T().o('quickSel');
      const W = doc.width, H = doc.height;
      // como no Photoshop: depois da primeira pincelada, o modo Nova passa a adicionar
      this.mode = ev.alt || o.mode === 'sub' ? 'sub' : doc.selection ? 'add' : 'new';
      const src = o.sampleAll || !doc.active || !doc.active.canvas ? IMG.Engine.composite(doc) : (() => { const c = U.createCanvas(W, H); c.getContext('2d').drawImage(doc.active.canvas, doc.active.x, doc.active.y); return c; })();
      this.d = src.getContext('2d').getImageData(0, 0, W, H).data;
      this.E = edgeMap(doc, o.sampleAll || !doc.active || !doc.active.canvas);
      this.m = new Uint8Array(W * H);
      this.stats = { n: 0, r: 0, g: 0, b: 0, rr: 0, gg: 0, bb: 0 };
      this.bbox = null;
      this.tint = U.createCanvas(W, H);
      this.last = null;
      this.dab(ev.x, ev.y);
    },
    dab(cx, cy) {
      const doc = IMG.app.doc, o = T().o('quickSel'), W = doc.width, H = doc.height, d = this.d, m = this.m, st = this.stats;
      const R = Math.max(1, o.size / 2), x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H - 1, Math.ceil(cy + R));
      const seeds = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > R * R) continue;
        const p = y * W + x, i = p * 4;
        st.n++; st.r += d[i]; st.g += d[i + 1]; st.b += d[i + 2]; st.rr += d[i] * d[i]; st.gg += d[i + 1] * d[i + 1]; st.bb += d[i + 2] * d[i + 2];
        seeds.push(p);
      }
      if (!seeds.length) return;
      const mr = st.r / st.n, mg = st.g / st.n, mb = st.b / st.n;
      const sdv = Math.sqrt(Math.max(0, st.rr / st.n - mr * mr) + Math.max(0, st.gg / st.n - mg * mg) + Math.max(0, st.bb / st.n - mb * mb));
      const tol = U.clamp(sdv * 2 + 22, 24, 95), tol2 = tol * tol;
      const lim = R * 4 + 20, lx0 = Math.max(0, Math.floor(cx - lim)), lx1 = Math.min(W - 1, Math.ceil(cx + lim)), ly0 = Math.max(0, Math.floor(cy - lim)), ly1 = Math.min(H - 1, Math.ceil(cy + lim));
      const E = this.E.g, stack = [];
      const ww = lx1 - lx0 + 1, seen = new Uint8Array(ww * (ly1 - ly0 + 1));
      const sk = (p) => (((p / W) | 0) - ly0) * ww + (p % W) - lx0;
      for (const p of seeds) { m[p] = 1; stack.push(p); const k = sk(p); if (k >= 0 && k < seen.length) seen[k] = 1; }
      while (stack.length) {
        const p = stack.pop(), x = p % W, y = (p / W) | 0;
        const nb = [x > lx0 ? p - 1 : -1, x < lx1 ? p + 1 : -1, y > ly0 ? p - W : -1, y < ly1 ? p + W : -1];
        for (const q of nb) {
          if (q < 0) continue;
          const kq = sk(q); if (seen[kq]) continue;
          seen[kq] = 1;
          const i = q * 4, dr = d[i] - mr, dg = d[i + 1] - mg, db = d[i + 2] - mb, dd = dr * dr + dg * dg + db * db;
          if (dd > tol2) continue;
          if (E[q] > 0.32 && dd > tol2 * 0.25) continue;
          m[q] = 1; stack.push(q);
        }
      }
      const r = { x: lx0, y: ly0, w: lx1 - lx0 + 1, h: ly1 - ly0 + 1 };
      this.bbox = U.rectUnion(this.bbox, r);
      // atualiza a pré-visualização só na janela alterada
      const tc = this.tint.getContext('2d'), img = tc.createImageData(r.w, r.h);
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (m[(y + r.y) * W + x + r.x]) { const k = (y * r.w + x) * 4; img.data[k] = 77; img.data[k + 1] = 143; img.data[k + 2] = 214; img.data[k + 3] = 255; }
      tc.putImageData(img, r.x, r.y);
      IMG.Engine.requestRender();
    },
    move(ev) {
      this.pos = { sx: ev.sx, sy: ev.sy };
      if (!this.m) return;
      const o = T().o('quickSel'), l = this.last || { x: ev.x, y: ev.y };
      const dist = Math.hypot(ev.x - l.x, ev.y - l.y), step = Math.max(2, o.size / 4);
      if (dist < step && this.last) return;
      const n = Math.max(1, Math.floor(dist / step));
      for (let k = 1; k <= n; k++) this.dab(l.x + (ev.x - l.x) * k / n, l.y + (ev.y - l.y) * k / n);
      this.last = { x: ev.x, y: ev.y };
    },
    up() {
      if (!this.m) return;
      const doc = IMG.app.doc, o = T().o('quickSel');
      const c = IMG.maskToCanvas(this.m, doc.width, doc.height);
      if (o.enhance) { IMG.blurCanvas(c, 1.2); const x = c.getContext('2d'), img = x.getImageData(0, 0, c.width, c.height), dd = img.data; for (let i = 3; i < dd.length; i += 4) dd[i] = U.clamp((dd[i] - 128) * 2 + 128, 0, 255); x.putImageData(img, 0, 0); }
      this.m = null; this.d = null; this.E = null; this.tint = null;
      Sel.combine(doc, c, this.mode);
      IMG.commit('Seleção rápida');
      IMG.Engine.requestRender();
    },
    hover(ev) { this.pos = { sx: ev.sx, sy: ev.sy }; T().cursor('none'); IMG.Engine.requestRender(); },
    leave() { this.pos = null; IMG.Engine.requestRender(); },
    onKey(e, combo) {
      const k = e.key, o = T().o('quickSel');
      if (k === '[' || k === ']') { const st = o.size < 10 ? 1 : o.size < 50 ? 5 : 10; T().setOpt('quickSel', 'size', U.clamp(o.size + (k === ']' ? st : -st), 1, 500)); IMG.UI.renderOptions(); return true; }
      return mover.nudge(IMG.app.doc, e, combo);
    },
    drawOverlay(ctx, v) {
      const doc = IMG.app.doc;
      if (this.tint) { ctx.save(); ctx.globalAlpha = 0.45; ctx.imageSmoothingEnabled = v.zoom < 1; ctx.drawImage(this.tint, v.x, v.y, doc.width * v.zoom, doc.height * v.zoom); ctx.restore(); }
      const p = this.pos; if (!p) return;
      const r = Math.max(2, T().o('quickSel').size * v.zoom / 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.beginPath(); ctx.arc(p.sx, p.sy, r + 0.5, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(p.sx, p.sy, r - 0.5, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.sx - 3, p.sy); ctx.lineTo(p.sx + 3, p.sy); if (this.mode !== 'sub' && !(T().o('quickSel').mode === 'sub')) { ctx.moveTo(p.sx, p.sy - 3); ctx.lineTo(p.sx, p.sy + 3); } ctx.stroke();
    }
  });
  void bus;
})();
