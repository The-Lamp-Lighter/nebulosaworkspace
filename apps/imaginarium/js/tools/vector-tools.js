/* ==========================================================================
   Imaginarium — ferramentas vetoriais
   Formas (U): Retângulo, Elipse, Polígono, Estrela, Linha, Forma personalizada
   Caneta (P): Caneta, Caneta de forma livre, Caneta de curvatura,
               Adicionar/Excluir ponto de ancoragem, Converter ponto
   Seleção (A): Seleção de demarcador, Seleção direta
   Modos: Forma (camada de forma), Demarcador (painel Demarcadores), Pixels.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const Paths = IMG.Paths, Shapes = IMG.Shapes, Layers = IMG.Layers;
  const T = () => IMG.Tools;
  const S = () => Shapes.style;

  /* ==================================================================
     WIDGETS: campo de preenchimento e opções de traçado
     ================================================================== */
  /** Campo "tipo + valor" para preenchimento/traçado. def: {type,...} | null */
  function fillField(def, onChange, o = {}) {
    const UI = IMG.UI;
    let cur = def ? JSON.parse(JSON.stringify(def)) : null;
    const box = el('span.fill-field');
    const types = [['none', 'Nenhum'], ['solid', 'Cor sólida'], ['gradient', 'Gradiente'], ['pattern', 'Padrão']];
    const paint = () => {
      U.clear(box);
      const t = cur ? cur.type : 'none';
      box.appendChild(UI.select(types, t, (v) => {
        if (v === 'none') cur = null;
        else if (v === 'solid') cur = { type: 'solid', color: (cur && cur.color) || IMG.app.fg };
        else if (v === 'gradient') cur = { type: 'gradient', grad: IMG.Gradients.def(), style: 'linear', angle: 90, scale: 100 };
        else cur = { type: 'pattern', id: 'p0', scale: 100 };
        onChange(cur, true); paint();
      }, { keepFocus: true, width: o.width || 96, title: o.title }).el);
      if (!cur) return;
      if (cur.type === 'solid') box.appendChild(UI.colorBtn(cur.color, (hex, fin) => { if (!hex) return; cur.color = hex; onChange(cur, fin); }, { title: o.title }).el);
      else if (cur.type === 'gradient') {
        box.appendChild(IMG.Widgets.gradientBtn(cur.grad, (g, fin) => { cur.grad = g; onChange(cur, fin); }, { width: 70 }).el);
        box.appendChild(UI.num({ value: cur.angle == null ? 90 : cur.angle, min: -180, max: 180, unit: '°', width: 58, onChange: (v) => { cur.angle = v; onChange(cur, true); } }).el);
      } else box.appendChild(IMG.Widgets.patternBtn(cur.id, (v) => { cur.id = v; onChange(cur, true); }).el);
    };
    paint();
    return { el: box, set: (v) => { cur = v ? JSON.parse(JSON.stringify(v)) : null; paint(); } };
  }
  IMG.fillField = fillField;

  const DASHES = [['solid', 'Contínua', null], ['dash', 'Tracejada', [4, 2]], ['dot', 'Pontilhada', [0.01, 2]], ['dashdot', 'Traço-ponto', [4, 2, 0.01, 2]]];
  /** Botão de opções do traçado (alinhamento, extremidades, cantos, tracejado). */
  function strokeOptsBtn(stroke, onChange) {
    const UI = IMG.UI;
    const b = UI.iconBtn('more', 'Opções de traçado', () => {
      const st = stroke;
      const dashSel = UI.select(DASHES.map((d) => [d[0], d[1]]), (DASHES.find((d) => JSON.stringify(d[2]) === JSON.stringify(st.dash)) || DASHES[0])[0], (v) => { st.dash = (DASHES.find((d) => d[0] === v) || DASHES[0])[2]; onChange(st); }, { keepFocus: true, width: 120 });
      const seg = (opts, key) => UI.seg(opts.map(([v, l]) => ({ value: v, label: l })), st[key], (v) => { st[key] = v; onChange(st); }, { labels: true }).el;
      const box = el('div.stroke-pop',
        UI.row('Tipo', dashSel.el),
        UI.row('Alinhar', seg([['inside', 'Dentro'], ['center', 'Centro'], ['outside', 'Fora']], 'align')),
        UI.row('Extremidades', seg([['butt', 'Reta'], ['round', 'Redonda'], ['square', 'Quadrada']], 'cap')),
        UI.row('Cantos', seg([['miter', 'Vivo'], ['round', 'Redondo'], ['bevel', 'Chanfrado']], 'join')));
      UI.popover(b, box);
    });
    return b;
  }

  /** Aplica o estilo de traço/preenchimento atual à camada de forma ativa (quando houver). */
  function applyStyleToActive(key, value, fin) {
    const L = Shapes.current(); if (!L) return;
    const tid = T().activeId || '';
    if (!/^(shape|pen|freePen|curvPen|pathSelect|directSelect)/.test(tid)) return;
    L.shape = Shapes.normalize(L.shape);
    if (key === 'fill') L.shape.fill = value ? JSON.parse(JSON.stringify(value)) : null;
    else if (key === 'stroke') L.shape.stroke = JSON.parse(JSON.stringify(value));
    Shapes.render(L); IMG.Engine.invalidate();
    if (fin) { bus.emit('layer:pixels', L); IMG.commit('Editar forma'); }
  }

  function styleOpts(withMode, extra) {
    const st = S(), list = [];
    if (withMode) list.push({ type: 'select', label: '', value: st.mode, options: withMode === 'pen' ? [['shape', 'Forma'], ['path', 'Demarcador']] : [['shape', 'Forma'], ['path', 'Demarcador'], ['pixels', 'Pixels']], width: 104, onChange: (v) => { st.mode = v; Shapes.saveStyle(); IMG.UI.renderOptions(); } });
    if (st.mode === 'shape' || !withMode) {
      const cur = Shapes.current(), src = cur && /^(shape|pen|freePen|curvPen|pathSelect|directSelect)/.test(T().activeId) ? Shapes.normalize(cur.shape) : null;
      const fillV = src ? src.fill : st.fill, strokeV = src ? src.stroke : st.stroke;
      list.push({ type: 'custom', build: () => el('span.opt-field', el('span.opt-label', { text: 'Preench.' }), fillField(fillV, (v, fin) => { st.fill = v; Shapes.saveStyle(); applyStyleToActive('fill', v, fin); }, { title: 'Preenchimento' }).el) });
      list.push({ type: 'custom', build: () => {
        const sv = JSON.parse(JSON.stringify(strokeV || st.stroke));
        const ch = (fin) => { st.stroke = JSON.parse(JSON.stringify(sv)); Shapes.saveStyle(); applyStyleToActive('stroke', sv, fin); };
        const f = fillField(sv.on ? sv.fill : null, (v, fin) => { sv.on = !!v; if (v) sv.fill = v; ch(fin); }, { title: 'Traçado', width: 96 });
        const w = IMG.UI.num({ value: sv.width, min: 0, max: 500, decimals: 1, unit: 'px', width: 64, onChange: (v) => { sv.width = v; if (v > 0 && !sv.on) { sv.on = true; f.set(sv.fill); } ch(true); } });
        return el('span.opt-field', el('span.opt-label', { text: 'Traçado' }), f.el, w.el, strokeOptsBtn(sv, () => ch(true)));
      } });
    } else if (st.mode === 'pixels') list.push({ type: 'text', text: 'Usa a cor do primeiro plano' });
    if (st.mode !== 'pixels' || !withMode) list.push({ type: 'select', label: '', value: st.op, options: [['new', 'Nova camada'], ['add', 'Combinar formas'], ['sub', 'Subtrair forma da frente'], ['int', 'Fazer interseção'], ['xor', 'Excluir sobreposição']], width: 150, onChange: (v) => { st.op = v; Shapes.saveStyle(); } });
    return list.concat(extra || []);
  }

  /* ==================================================================
     FERRAMENTAS DE FORMA
     ================================================================== */
  const NAMES = { rect: 'Retângulo', ellipse: 'Elipse', polygon: 'Polígono', star: 'Estrela', line: 'Linha', custom: 'Forma' };

  function liveFor(kind, r, d) {
    const st = S();
    if (kind === 'rect') return { kind: 'rect', x: r.x, y: r.y, w: r.w, h: r.h, radii: [st.radius, st.radius, st.radius, st.radius] };
    if (kind === 'ellipse') return { kind: 'ellipse', x: r.x, y: r.y, w: r.w, h: r.h };
    if (kind === 'polygon') return { kind: 'polygon', x: r.x, y: r.y, w: r.w, h: r.h, sides: st.sides, star: st.star, inner: st.inner, smooth: st.smoothCorners };
    if (kind === 'star') return { kind: 'polygon', x: r.x, y: r.y, w: r.w, h: r.h, sides: st.sides < 3 ? 5 : st.sides, star: true, inner: st.inner, smooth: st.smoothCorners };
    if (kind === 'line') return { kind: 'line', x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1, weight: st.weight, arrowStart: st.arrowStart, arrowEnd: st.arrowEnd, arrowW: st.arrowW, arrowL: st.arrowL, arrowC: st.arrowC };
    return null;
  }
  function subsFor(kind, r, d) {
    if (kind === 'custom') return Shapes.customPath(S().custom, r.x, r.y, r.w, r.h).subs;
    const s = { live: liveFor(kind, r, d), path: { subs: [] } };
    Shapes.applyLive(s);
    return s.path.subs;
  }

  /** Cria a forma conforme o modo (forma / demarcador / pixels) e a operação. */
  function placeShape(doc, kind, r, d) {
    const st = S(), subs = subsFor(kind, r, d);
    if (!subs.length) return;
    const op = st.op || 'new';
    if (st.mode === 'pixels') {
      const L = Layers.paintTarget(doc); if (!L) return;
      const c = Paths.fillCanvas({ subs, rule: kind === 'custom' ? 'evenodd' : 'nonzero' }, doc.rect);
      const x = c.getContext('2d'); x.globalCompositeOperation = 'source-in'; x.fillStyle = IMG.app.fg; x.fillRect(0, 0, doc.width, doc.height);
      IMG.paintCanvas(doc, L, c, {});
      IMG.commit(NAMES[kind]);
      return;
    }
    if (st.mode === 'path') {
      const tg = Paths.target(Object.assign(doc, { pathTarget: 'doc' }), true);
      subs.forEach((q, i) => { q.op = op === 'new' ? 'add' : i === 0 ? op : q.op; tg.path.subs.push(q); });
      Paths.changed(doc, tg, NAMES[kind]);
      IMG.UI.showPanel && IMG.UI.panelVisible && IMG.UI.panelVisible('paths');
      return;
    }
    const cur = Shapes.current();
    if (op !== 'new' && cur) {
      const s = cur.shape = Shapes.normalize(cur.shape);
      subs.forEach((q, i) => { q.op = i === 0 ? op : q.op; s.path.subs.push(q); });
      if (s.live) s.live.n = s.live.n || 1;
      Shapes.render(cur); bus.emit('layers:change', doc); IMG.Engine.invalidate();
      IMG.commit(NAMES[kind]);
      return;
    }
    const shape = { path: { subs, rule: kind === 'custom' ? 'evenodd' : 'nonzero' }, fill: st.fill ? JSON.parse(JSON.stringify(st.fill)) : null, stroke: JSON.parse(JSON.stringify(st.stroke)), live: liveFor(kind, r, d) };
    if (kind === 'line') { if (!shape.fill && !shape.stroke.on) shape.fill = { type: 'solid', color: IMG.app.fg }; }
    if (shape.live) shape.live.n = subs.length;
    if (!shape.fill && !shape.stroke.on) shape.fill = { type: 'solid', color: IMG.app.fg };
    Shapes.create(doc, shape, Layers.name(doc, NAMES[kind]));
    doc.pathTarget = 'shape';
    bus.emit('layers:change', doc);
    IMG.commit(NAMES[kind]);
  }

  function sizeDialog(doc, kind, x, y) {
    const UI = IMG.UI;
    let w = 100, h = 100, center = false;
    UI.dialog({ title: 'Criar ' + NAMES[kind].toLowerCase(), width: 320,
      body: [UI.row('Largura', UI.num({ value: 100, min: 1, max: 30000, unit: 'px', width: 90, onInput: (v) => { w = v; } }).el), UI.row('Altura', UI.num({ value: 100, min: kind === 'line' ? 0 : 1, max: 30000, unit: 'px', width: 90, onInput: (v) => { h = v; } }).el), UI.row('', UI.check('A partir do centro', false, (v) => { center = v; }).el)],
      buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
        const r = { x: center ? x - w / 2 : x, y: center ? y - h / 2 : y, w, h };
        placeShape(doc, kind, r, { x0: r.x, y0: r.y + (kind === 'line' ? 0 : h / 2), x1: r.x + w, y1: r.y + (kind === 'line' ? h : h / 2) });
      } }] });
  }

  function makeShapeTool(kind, icon) {
    const id = 'shape' + kind.charAt(0).toUpperCase() + kind.slice(1);
    return {
      id, name: kind === 'custom' ? 'Forma personalizada' : NAMES[kind], icon, cursor: 'crosshair',
      defaults: {},
      hint: kind === 'line' ? 'Arraste para desenhar · Shift: 45° · clique: tamanho exato' : 'Arraste para desenhar · Shift: proporcional · Alt: a partir do centro · Espaço: reposicionar',
      options() {
        const st = S(), set = (k) => (v) => { st[k] = v; Shapes.saveStyle(); IMG.Engine.requestRender(); };
        const extra = [];
        if (kind === 'rect') extra.push({ type: 'number', label: 'Raio', value: st.radius, min: 0, max: 5000, unit: 'px', width: 64, onChange: set('radius') });
        if (kind === 'polygon' || kind === 'star') {
          extra.push({ type: 'number', label: 'Lados', value: st.sides, min: 3, max: 100, width: 52, onChange: set('sides') });
          if (kind === 'polygon') extra.push({ type: 'check', label: 'Estrela', value: st.star, onChange: (v) => { st.star = v; Shapes.saveStyle(); IMG.UI.renderOptions(); } });
          if (kind === 'star' || st.star) extra.push({ type: 'number', label: 'Recuo', value: st.inner, min: 1, max: 99, unit: '%', width: 58, onChange: set('inner') });
          extra.push({ type: 'check', label: 'Cantos suaves', value: st.smoothCorners, onChange: set('smoothCorners') });
        }
        if (kind === 'line') {
          extra.push({ type: 'number', label: 'Espessura', value: st.weight, min: 0.5, max: 1000, decimals: 1, unit: 'px', width: 64, onChange: set('weight') });
          extra.push({ type: 'custom', build: () => IMG.UI.iconBtn('arrowL', 'Pontas de seta', (e) => {
            const UI = IMG.UI, b = e && e.currentTarget;
            const box = el('div.stroke-pop', UI.row('', UI.check('Início', st.arrowStart, (v) => { st.arrowStart = v; Shapes.saveStyle(); }).el, UI.check('Fim', st.arrowEnd, (v) => { st.arrowEnd = v; Shapes.saveStyle(); }).el),
              UI.row('Largura', UI.num({ value: st.arrowW, min: 10, max: 5000, unit: '%', width: 70, onChange: set('arrowW') }).el),
              UI.row('Comprimento', UI.num({ value: st.arrowL, min: 10, max: 5000, unit: '%', width: 70, onChange: set('arrowL') }).el),
              UI.row('Concavidade', UI.num({ value: st.arrowC, min: -50, max: 50, unit: '%', width: 70, onChange: set('arrowC') }).el));
            UI.popover(b || document.querySelector('#optionsbar'), box);
          }) });
        }
        if (kind === 'custom') {
          extra.push({ type: 'custom', build: () => {
            const UI = IMG.UI, btn = el('button.brush-pick', { type: 'button', title: 'Escolher forma' });
            const paint = () => { U.clear(btn); btn.append(Shapes.customPreview(st.custom, 22), IMG.iconEl('chevronDown', 10)); };
            paint();
            btn.addEventListener('click', () => {
              const grid = el('div.brush-grid.shape-grid');
              Shapes.customAll().forEach((c) => { const cell = el('button.brush-cell' + (c.id === st.custom ? '.sel' : ''), { type: 'button', title: c.name }, Shapes.customPreview(c.id, 36)); cell.addEventListener('click', () => { st.custom = c.id; Shapes.saveStyle(); paint(); UI.closePopover(); }); grid.appendChild(cell); });
              UI.popover(btn, el('div.brush-pop', grid));
            });
            return el('span.opt-field', el('span.opt-label', { text: 'Forma' }), btn);
          } });
        }
        return styleOpts('shape', extra);
      },

      geom(ev) {
        const d = this.d;
        let x0 = d.x, y0 = d.y, x1 = ev.x, y1 = ev.y;
        if (kind === 'line') {
          if (ev.shift) { const len = Math.hypot(x1 - x0, y1 - y0), a = Math.round(Math.atan2(y1 - y0, x1 - x0) / (Math.PI / 4)) * (Math.PI / 4); x1 = x0 + Math.cos(a) * len; y1 = y0 + Math.sin(a) * len; }
          else { const p = IMG.Snap.point(IMG.app.doc, x1, y1, d.T); x1 = p.x; y1 = p.y; IMG.Engine.smart = p.lines; }
          return { r: U.rectFromPoints(x0, y0, x1, y1), l: { x0, y0, x1, y1 } };
        }
        if (!ev.shift) { const p = IMG.Snap.point(IMG.app.doc, x1, y1, d.T); x1 = p.x; y1 = p.y; IMG.Engine.smart = p.lines; } else IMG.Engine.smart = [];
        if (ev.shift) { const s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); x1 = x0 + (Math.sign(x1 - x0) || 1) * s; y1 = y0 + (Math.sign(y1 - y0) || 1) * s; }
        if (ev.alt) { x0 = 2 * d.x - x1; y0 = 2 * d.y - y1; }
        const r = U.rectFromPoints(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1));
        return { r, l: null };
      },
      down(ev) {
        const doc = IMG.app.doc;
        const Ts = ev.ctrl ? { xs: [], ys: [], grid: 0 } : IMG.Snap.collect(doc);
        const p = IMG.Snap.point(doc, ev.x, ev.y, Ts);
        this.d = { x: p.x, y: p.y, T: Ts, sx: ev.sx, sy: ev.sy };
        this.g = null; this.spaceLast = null;
      },
      move(ev) {
        if (!this.d) return;
        if (T().spaceDrag) {
          if (this.spaceLast) { this.d.x += ev.x - this.spaceLast.x; this.d.y += ev.y - this.spaceLast.y; }
          this.spaceLast = { x: ev.x, y: ev.y };
        } else this.spaceLast = null;
        this.g = this.geom(ev);
        const r = this.g.r;
        IMG.UI.setHint(kind === 'line' ? Math.round(Math.hypot(this.g.l.x1 - this.g.l.x0, this.g.l.y1 - this.g.l.y0)) + ' px' : r.w + ' × ' + r.h + ' px');
        IMG.Engine.requestRender();
      },
      up(ev) {
        const doc = IMG.app.doc, d = this.d, g = this.g;
        this.d = null; this.g = null;
        IMG.Engine.smart = []; IMG.UI.setHint('');
        IMG.Engine.requestRender();
        if (!d) return;
        if (!g || (Math.hypot(ev.sx - d.sx, ev.sy - d.sy) < 3)) { sizeDialog(doc, kind, d.x, d.y); return; }
        if (kind !== 'line' && (g.r.w < 1 || g.r.h < 1)) return;
        placeShape(doc, kind, g.r, g.l);
      },
      drawOverlay(ctx, v) {
        const doc = IMG.app.doc;
        IMG.drawTargetPath(ctx, v, doc);
        const g = this.g; if (!g) return;
        const subs = subsFor(kind, g.r, g.l || {});
        ctx.save();
        ctx.beginPath(); Paths.trace(ctx, { subs }, new DOMMatrix([v.zoom, 0, 0, v.zoom, v.x, v.y]));
        const st = S();
        if (st.mode === 'shape' && st.fill && st.fill.type === 'solid') { ctx.globalAlpha = 0.6; ctx.fillStyle = st.fill.color; ctx.fill(kind === 'custom' ? 'evenodd' : 'nonzero'); ctx.globalAlpha = 1; }
        ctx.lineWidth = 1; ctx.strokeStyle = '#3d8bff'; ctx.stroke();
        ctx.restore();
      }
    };
  }
  IMG.Tools.register(makeShapeTool('rect', 'shapeRect'));
  IMG.Tools.register(makeShapeTool('ellipse', 'shapeEllipse'));
  IMG.Tools.register(makeShapeTool('polygon', 'shapePolygon'));
  IMG.Tools.register(makeShapeTool('star', 'shapeStar'));
  IMG.Tools.register(makeShapeTool('line', 'shapeLine'));
  IMG.Tools.register(makeShapeTool('custom', 'shapeCustom'));

  /* ==================================================================
     DESENHO DE ÂNCORAS E ALÇAS (comum)
     ================================================================== */
  const VM = (v) => new DOMMatrix([v.zoom, 0, 0, v.zoom, v.x, v.y]);
  const scr = (v, x, y) => ({ x: v.x + x * v.zoom, y: v.y + y * v.zoom });
  function drawAnchors(ctx, v, path, selKeys, showAllHandles) {
    if (!path) return;
    ctx.save();
    ctx.beginPath(); Paths.trace(ctx, path, VM(v));
    ctx.lineWidth = 1; ctx.strokeStyle = '#3d8bff'; ctx.stroke();
    (path.subs || []).forEach((sub, si) => {
      sub.pts.forEach((p, pi) => {
        const sel = selKeys && selKeys.has(si + ':' + pi);
        const nb = selKeys && (selKeys.has(si + ':' + (pi - 1)) || selKeys.has(si + ':' + (pi + 1)) || (sub.closed && (selKeys.has(si + ':' + ((pi + 1) % sub.pts.length)) || selKeys.has(si + ':' + ((pi - 1 + sub.pts.length) % sub.pts.length)))));
        if (sel || nb || showAllHandles) {
          const a = scr(v, p.x, p.y);
          ctx.strokeStyle = 'rgba(61,139,255,.85)'; ctx.fillStyle = '#3d8bff';
          for (const [hx, hy] of [[p.ix, p.iy], [p.ox, p.oy]]) {
            if (Math.abs(hx - p.x) < 1e-6 && Math.abs(hy - p.y) < 1e-6) continue;
            const h = scr(v, hx, hy);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(h.x, h.y); ctx.stroke();
            ctx.beginPath(); ctx.arc(h.x, h.y, 2.6, 0, 7); ctx.fill();
          }
        }
        const a = scr(v, p.x, p.y);
        ctx.fillStyle = sel ? '#3d8bff' : '#fff'; ctx.strokeStyle = '#3d8bff';
        ctx.fillRect(Math.round(a.x) - 3, Math.round(a.y) - 3, 6, 6); ctx.strokeRect(Math.round(a.x) - 3.5, Math.round(a.y) - 3.5, 7, 7);
      });
    });
    ctx.restore();
  }
  IMG.drawPathAnchors = drawAnchors;

  /** Ponto (âncora ou alça) sob o cursor: { si, pi, part: 'a'|'i'|'o' } */
  function hitPoint(path, ev, v, selKeys, handlesAll) {
    if (!path) return null;
    const R = 6;
    let best = null, bd = R + 1;
    (path.subs || []).forEach((sub, si) => sub.pts.forEach((p, pi) => {
      const k = si + ':' + pi;
      const parts = [['a', p.x, p.y]];
      if (handlesAll || (selKeys && (selKeys.has(k) || selKeys.has(si + ':' + (pi - 1)) || selKeys.has(si + ':' + (pi + 1))))) { parts.push(['i', p.ix, p.iy], ['o', p.ox, p.oy]); }
      parts.forEach(([part, x, y]) => {
        if (part !== 'a' && Math.abs(x - p.x) < 1e-6 && Math.abs(y - p.y) < 1e-6) return;
        const d = Math.hypot((x - ev.x) * v.zoom, (y - ev.y) * v.zoom);
        if (d < bd || (d <= bd + 0.5 && part !== 'a')) { bd = d; best = { si, pi, part }; }
      });
    }));
    return best;
  }

  /** Recalcula a alça oposta de um ponto suave (mantém o comprimento da oposta). */
  function mirrorHandle(p, part, keepLen) {
    const hx = part === 'i' ? p.ix : p.ox, hy = part === 'i' ? p.iy : p.oy;
    const dx = hx - p.x, dy = hy - p.y, l = Math.hypot(dx, dy) || 1;
    const ox = part === 'i' ? p.ox : p.ix, oy = part === 'i' ? p.oy : p.iy;
    const ol = keepLen ? Math.hypot(ox - p.x, oy - p.y) : l;
    const nx = p.x - (dx / l) * ol, ny = p.y - (dy / l) * ol;
    if (part === 'i') { p.ox = nx; p.oy = ny; } else { p.ix = nx; p.iy = ny; }
  }

  function killLive(tg) { if (tg && tg.kind === 'shape' && tg.L.shape.live) tg.L.shape.live = null; }

  /* ==================================================================
     SELEÇÃO DIRETA
     ================================================================== */
  const DS = {
    id: 'directSelect', name: 'Seleção direta', icon: 'directSelect', cursor: 'default', noCtrlMove: true,
    defaults: {},
    hint: 'Clique em âncoras, alças ou segmentos e arraste · Shift: adicionar · Alt: alça independente · Delete: excluir pontos',
    sel: new Set(),
    options() { return pathOpts(); },
    activate() { this.sel = new Set(); },
    tg() { return Paths.target(IMG.app.doc); },
    down(ev) {
      const doc = IMG.app.doc, v = doc.view, tg = this.tg();
      this.drag = null;
      if (!tg) { this.marquee = { x0: ev.x, y0: ev.y, x1: ev.x, y1: ev.y, add: ev.shift }; return; }
      const path = tg.path;
      const h = hitPoint(path, ev, v, this.sel, false);
      if (h && h.part !== 'a') {
        killLive(tg);
        this.drag = { type: 'handle', h, orig: Paths.clone(path), x: ev.x, y: ev.y };
        return;
      }
      if (h) {
        const k = h.si + ':' + h.pi;
        if (ev.shift) { if (this.sel.has(k)) this.sel.delete(k); else this.sel.add(k); }
        else if (!this.sel.has(k)) this.sel = new Set([k]);
        if (ev.alt && !ev.shift) { const sub = path.subs[h.si]; this.sel = new Set(sub.pts.map((_, i) => h.si + ':' + i)); }
        this.drag = { type: 'anchors', orig: Paths.clone(path), x: ev.x, y: ev.y };
        IMG.Engine.requestRender();
        return;
      }
      const n = Paths.nearest(path, ev.x, ev.y);
      if (n && n.d * v.zoom <= 5) {
        const sub = path.subs[n.sub], i0 = n.seg, i1 = (n.seg + 1) % sub.pts.length;
        if (!ev.shift) this.sel = new Set();
        killLive(tg);
        this.drag = { type: 'seg', n, si: n.sub, i0, i1, orig: Paths.clone(path), x: ev.x, y: ev.y };
        IMG.Engine.requestRender();
        return;
      }
      if (!ev.shift) this.sel = new Set();
      this.marquee = { x0: ev.x, y0: ev.y, x1: ev.x, y1: ev.y, add: ev.shift };
      IMG.Engine.requestRender();
    },
    move(ev) {
      const doc = IMG.app.doc;
      if (this.marquee) { this.marquee.x1 = ev.x; this.marquee.y1 = ev.y; IMG.Engine.requestRender(); return; }
      const d = this.drag; if (!d) return;
      const tg = this.tg(); if (!tg) return;
      const path = tg.path;
      let dx = ev.x - d.x, dy = ev.y - d.y;
      if (ev.shift && d.type === 'anchors') { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      // restaura e reaplica a partir do original
      path.subs = JSON.parse(JSON.stringify(d.orig.subs));
      if (d.type === 'anchors') {
        if (dx || dy) killLive(tg);
        this.sel.forEach((k) => { const [si, pi] = k.split(':').map(Number); const p = path.subs[si] && path.subs[si].pts[pi]; if (!p) return; p.x += dx; p.y += dy; p.ix += dx; p.iy += dy; p.ox += dx; p.oy += dy; });
      } else if (d.type === 'handle') {
        const p = path.subs[d.h.si].pts[d.h.pi];
        if (d.h.part === 'i') { p.ix += dx; p.iy += dy; } else { p.ox += dx; p.oy += dy; }
        if (ev.alt) p.smooth = false;
        else if (p.smooth) mirrorHandle(p, d.h.part, true);
      } else if (d.type === 'seg') {
        const sub = path.subs[d.si], a = sub.pts[d.i0], b = sub.pts[d.i1], t = d.n.t;
        const w1 = 3 * (1 - t) * (1 - t) * t, w2 = 3 * (1 - t) * t * t, den = w1 * w1 + w2 * w2 || 1;
        if (a.ox === a.x && a.oy === a.y && b.ix === b.x && b.iy === b.y) { a.ox = a.x + (b.x - a.x) / 3; a.oy = a.y + (b.y - a.y) / 3; b.ix = b.x + (a.x - b.x) / 3; b.iy = b.y + (a.y - b.y) / 3; }
        a.ox += dx * w1 / den; a.oy += dy * w1 / den; b.ix += dx * w2 / den; b.iy += dy * w2 / den;
        if (a.smooth) mirrorHandle(a, 'o', true);
        if (b.smooth) mirrorHandle(b, 'i', true);
      }
      d.moved = true;
      if (tg.kind === 'shape') Shapes.render(tg.L); else if (tg.kind === 'vmask') Paths.touch(tg.L.vmask);
      IMG.Engine.invalidate();
    },
    up() {
      const doc = IMG.app.doc;
      if (this.marquee) {
        const m = this.marquee; this.marquee = null;
        const tg = this.tg();
        if (tg) {
          const r = U.rectFromPoints(m.x0, m.y0, m.x1, m.y1);
          if (r.w > 0 || r.h > 0) tg.path.subs.forEach((sub, si) => sub.pts.forEach((p, pi) => { if (U.rectContains(r, p.x, p.y)) this.sel.add(si + ':' + pi); }));
        }
        IMG.Engine.requestRender();
        return;
      }
      const d = this.drag; this.drag = null;
      if (d && d.moved) Paths.changed(doc, this.tg(), 'Editar demarcador');
    },
    hover(ev) {
      const doc = IMG.app.doc, tg = this.tg();
      if (!tg) { T().cursor('default'); return; }
      const h = hitPoint(tg.path, ev, doc.view, this.sel, false);
      T().cursor(h ? 'pointer' : 'default');
    },
    deleteSelected() {
      const doc = IMG.app.doc, tg = this.tg(); if (!tg || !this.sel.size) return false;
      killLive(tg);
      const del = {}; this.sel.forEach((k) => { const [si, pi] = k.split(':').map(Number); (del[si] = del[si] || []).push(pi); });
      tg.path.subs = tg.path.subs.map((sub, si) => { if (!del[si]) return sub; sub.pts = sub.pts.filter((_, i) => !del[si].includes(i)); if (sub.pts.length < 3) sub.closed = sub.closed && sub.pts.length > 2; return sub; }).filter((s) => s.pts.length > 1);
      this.sel = new Set();
      Paths.changed(doc, tg, 'Excluir pontos de ancoragem');
      return true;
    },
    onKey(e) {
      const doc = IMG.app.doc, tg = this.tg();
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel.size) return this.deleteSelected();
      if (/^Arrow/.test(e.key) && tg && this.sel.size) {
        const n = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
        killLive(tg);
        this.sel.forEach((k) => { const [si, pi] = k.split(':').map(Number); const p = tg.path.subs[si] && tg.path.subs[si].pts[pi]; if (p) { p.x += dx; p.y += dy; p.ix += dx; p.iy += dy; p.ox += dx; p.oy += dy; } });
        Paths.changed(doc, tg, 'Mover pontos');
        return true;
      }
      if (e.key === 'Escape') { this.sel = new Set(); IMG.Engine.requestRender(); return true; }
      return false;
    },
    drawOverlay(ctx, v) {
      const tg = this.tg();
      if (tg) drawAnchors(ctx, v, tg.path, this.sel, false);
      const m = this.marquee;
      if (m) { const a = scr(v, Math.min(m.x0, m.x1), Math.min(m.y0, m.y1)); IMG.dashedPath(ctx, () => ctx.rect(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5, Math.abs(m.x1 - m.x0) * v.zoom, Math.abs(m.y1 - m.y0) * v.zoom)); }
    }
  };
  IMG.DirectSelect = DS;

  /* ==================================================================
     SELEÇÃO DE DEMARCADOR
     ================================================================== */
  function pathOpts() {
    const PS = IMG.PathSelect, list = [];
    const tg = Paths.target(IMG.app.doc || null);
    list.push({ type: 'select', label: '', value: 'none', options: [['none', 'Operação…'], ['add', 'Combinar formas'], ['sub', 'Subtrair forma da frente'], ['int', 'Fazer interseção'], ['xor', 'Excluir sobreposição']], width: 150, onChange: (v) => {
      if (v === 'none' || !tg) return;
      const idx = PS.selIdx(tg);
      idx.forEach((k) => { if (tg.path.subs[k]) tg.path.subs[k].op = v; });
      killLive(tg); Paths.changed(IMG.app.doc, tg, 'Operação do demarcador'); IMG.UI.renderOptions();
    } });
    list.push({ type: 'button', label: 'Mesclar componentes', title: 'Combina os componentes selecionados em um único contorno', onClick: () => PS.merge() });
    const al = (icon, title, kind) => ({ type: 'custom', build: () => IMG.UI.iconBtn(icon, title, () => PS.align(kind)) });
    list.push({ type: 'sep' }, al('objLeft', 'Alinhar à esquerda', 'left'), al('objCenterH', 'Centralizar na horizontal', 'hcenter'), al('objRight', 'Alinhar à direita', 'right'), al('objTop', 'Alinhar ao topo', 'top'), al('objCenterV', 'Centralizar na vertical', 'vcenter'), al('objBottom', 'Alinhar à base', 'bottom'));
    if (tg && tg.kind === 'shape') { list.push({ type: 'sep' }); list.push(...styleOpts(null).filter((d) => d.type === 'custom')); }
    return list;
  }

  const PS = (IMG.PathSelect = {
    id: 'pathSelect', name: 'Seleção de demarcador', icon: 'pathSelect', cursor: 'default', noCtrlMove: true,
    defaults: {},
    hint: 'Clique para selecionar componentes do demarcador e arraste para mover · Alt+arrastar: duplicar · Ctrl+T: transformar',
    subs: new Set(),
    options() { return pathOpts(); },
    activate() { this.subs = new Set(); },
    tg() { return Paths.target(IMG.app.doc); },
    selIdx(tg) { return tg ? (this.subs.size ? Array.from(this.subs) : tg.path.subs.map((_, i) => i)) : []; },
    down(ev) {
      const doc = IMG.app.doc, v = doc.view;
      let tg = this.tg();
      // clique em outra camada de forma: seleciona-a
      if ((!tg || tg.kind !== 'shape') || Paths.subAt(tg.path, ev.x, ev.y, 5 / v.zoom) < 0) {
        const hit = Layers.pick(doc, ev.x, ev.y);
        if (hit && hit.type === 'shape' && hit !== doc.active) { Layers.setActive(doc, hit.id); doc.pathTarget = 'shape'; tg = this.tg(); this.subs = new Set(); }
      }
      if (!tg) { this.marquee = { x0: ev.x, y0: ev.y, x1: ev.x, y1: ev.y }; return; }
      const k = Paths.subAt(tg.path, ev.x, ev.y, 5 / v.zoom);
      if (k < 0) { if (!ev.shift) this.subs = new Set(); this.marquee = { x0: ev.x, y0: ev.y, x1: ev.x, y1: ev.y }; IMG.Engine.requestRender(); return; }
      if (ev.shift) { if (this.subs.has(k)) this.subs.delete(k); else this.subs.add(k); }
      else if (!this.subs.has(k)) this.subs = new Set([k]);
      if (ev.alt) {
        killLive(tg);
        const copies = Array.from(this.subs).map((i) => JSON.parse(JSON.stringify(tg.path.subs[i])));
        const start = tg.path.subs.length;
        copies.forEach((c) => tg.path.subs.push(c));
        this.subs = new Set(copies.map((_, i) => start + i));
      }
      this.drag = { orig: Paths.clone(tg.path), x: ev.x, y: ev.y, T: IMG.Snap.collect(doc), b: Paths.bounds(tg.path, Array.from(this.subs)) };
      IMG.Engine.requestRender();
    },
    move(ev) {
      if (this.marquee) { this.marquee.x1 = ev.x; this.marquee.y1 = ev.y; IMG.Engine.requestRender(); return; }
      const d = this.drag; if (!d) return;
      const doc = IMG.app.doc, tg = this.tg(); if (!tg) return;
      let dx = ev.x - d.x, dy = ev.y - d.y;
      if (ev.shift) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      IMG.Engine.smart = [];
      if (d.b && !ev.ctrl) { const sn = IMG.Snap.rect(doc, { x: d.b.x + dx, y: d.b.y + dy, w: d.b.w, h: d.b.h }, d.T); dx += sn.dx; dy += sn.dy; IMG.Engine.smart = sn.lines; }
      tg.path.subs = JSON.parse(JSON.stringify(d.orig.subs));
      Paths.translate(tg.path, dx, dy, Array.from(this.subs));
      if (tg.kind === 'shape') { const lv = tg.L.shape.live; if (lv && this.subs.size === tg.path.subs.length) { /* todos: mantém a forma dinâmica */ } else if (lv) tg.L.shape.live = null; }
      d.moved = true; d.dx = dx; d.dy = dy;
      if (tg.kind === 'shape') {
        const lv = tg.L.shape.live;
        if (lv) { const o = d.origLive || (d.origLive = JSON.parse(JSON.stringify(lv))); if (lv.kind === 'line') { lv.x0 = o.x0 + dx; lv.y0 = o.y0 + dy; lv.x1 = o.x1 + dx; lv.y1 = o.y1 + dy; } else { lv.x = o.x + dx; lv.y = o.y + dy; } }
        Shapes.render(tg.L);
      } else if (tg.kind === 'vmask') Paths.touch(tg.L.vmask);
      IMG.Engine.invalidate();
    },
    up() {
      const doc = IMG.app.doc;
      IMG.Engine.smart = [];
      if (this.marquee) {
        const m = this.marquee; this.marquee = null;
        const tg = this.tg(), r = U.rectFromPoints(m.x0, m.y0, m.x1, m.y1);
        if (tg && (r.w > 1 || r.h > 1)) tg.path.subs.forEach((sub, i) => { const b = Paths.bounds({ subs: [sub] }); if (b && U.rectIntersect(b, r)) this.subs.add(i); });
        IMG.Engine.requestRender();
        return;
      }
      const d = this.drag; this.drag = null;
      if (d && d.moved) Paths.changed(doc, this.tg(), 'Mover demarcador');
    },
    merge() {
      const doc = IMG.app.doc, tg = this.tg(); if (!tg) return;
      const idx = this.selIdx(tg); if (idx.length < 2) return;
      const part = { subs: idx.map((i) => tg.path.subs[i]), rule: tg.path.rule };
      const b = Paths.bounds(part); if (!b) return;
      const R = U.rectInt(U.rectInflate(b, 2));
      const m = Paths.fillCanvas(part, R);
      const tmp = { width: doc.width, height: doc.height, selection: IMG.newSelectionObject(doc.width, doc.height) };
      tmp.selection.canvas.getContext('2d').drawImage(m, R.x, R.y);
      tmp.selection.bounds = R; tmp.rect = doc.rect;
      const merged = Paths.fromSelection(tmp, 1);
      if (!merged) return;
      killLive(tg);
      const keep = tg.path.subs.filter((_, i) => !idx.includes(i));
      tg.path.subs = keep.concat(merged.subs.map((s) => Object.assign(s, { op: 'add' })));
      tg.path.rule = 'evenodd';
      this.subs = new Set();
      Paths.changed(doc, tg, 'Mesclar componentes');
    },
    align(kind) {
      const doc = IMG.app.doc, tg = this.tg(); if (!tg) return;
      const idx = this.selIdx(tg);
      const ref = idx.length > 1 ? Paths.bounds(tg.path, idx) : doc.rect;
      killLive(tg);
      idx.forEach((i) => {
        const b = Paths.bounds(tg.path, [i]); if (!b) return;
        let dx = 0, dy = 0;
        if (kind === 'left') dx = ref.x - b.x; else if (kind === 'right') dx = ref.x + ref.w - (b.x + b.w); else if (kind === 'hcenter') dx = ref.x + ref.w / 2 - (b.x + b.w / 2);
        else if (kind === 'top') dy = ref.y - b.y; else if (kind === 'bottom') dy = ref.y + ref.h - (b.y + b.h); else if (kind === 'vcenter') dy = ref.y + ref.h / 2 - (b.y + b.h / 2);
        Paths.translate(tg.path, dx, dy, [i]);
      });
      Paths.changed(doc, tg, 'Alinhar componentes');
    },
    hover(ev) { const doc = IMG.app.doc, tg = this.tg(); T().cursor(tg && Paths.subAt(tg.path, ev.x, ev.y, 5 / doc.view.zoom) >= 0 ? 'move' : 'default'); },
    onKey(e) {
      const doc = IMG.app.doc, tg = this.tg(); if (!tg) return false;
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.subs.size) {
        killLive(tg);
        tg.path.subs = tg.path.subs.filter((_, i) => !this.subs.has(i)); this.subs = new Set();
        Paths.changed(doc, tg, 'Excluir demarcador'); return true;
      }
      if (/^Arrow/.test(e.key)) {
        const n = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
        const idx = this.selIdx(tg);
        if (tg.kind === 'shape' && idx.length === tg.path.subs.length) Shapes.translate(tg.L.shape, dx, dy); else { killLive(tg); Paths.translate(tg.path, dx, dy, idx); }
        Paths.changed(doc, tg, 'Mover demarcador'); return true;
      }
      if (e.key === 'Escape') { this.subs = new Set(); IMG.Engine.requestRender(); return true; }
      return false;
    },
    drawOverlay(ctx, v) {
      const tg = this.tg();
      if (tg) {
        const keys = new Set(); this.subs.forEach((i) => { const sub = tg.path.subs[i]; if (sub) sub.pts.forEach((_, pi) => keys.add(i + ':' + pi)); });
        drawAnchors(ctx, v, tg.path, keys.size ? keys : null, false);
      }
      const m = this.marquee;
      if (m) { const a = scr(v, Math.min(m.x0, m.x1), Math.min(m.y0, m.y1)); IMG.dashedPath(ctx, () => ctx.rect(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5, Math.abs(m.x1 - m.x0) * v.zoom, Math.abs(m.y1 - m.y0) * v.zoom)); }
    }
  });
  IMG.Tools.register(PS);
  IMG.Tools.register(DS);

  /* ==================================================================
     CANETA
     ================================================================== */
  const near = (v, a, x, y, r = 7) => Math.hypot((a.x - x) * v.zoom, (a.y - y) * v.zoom) <= r;

  /** Inicia um novo componente no alvo adequado ao modo atual. */
  function startSub(doc, x, y) {
    const st = S(), op = st.op || 'new';
    let tg;
    if (st.mode === 'path') { doc.pathTarget = 'doc'; tg = Paths.target(doc, true); }
    else {
      const cur = Shapes.current();
      if (op !== 'new' && cur) { doc.pathTarget = 'shape'; tg = Paths.target(doc); }
      else {
        const shape = { path: Paths.empty(), fill: st.fill ? JSON.parse(JSON.stringify(st.fill)) : null, stroke: JSON.parse(JSON.stringify(st.stroke)), live: null };
        if (!shape.fill && !shape.stroke.on) shape.fill = { type: 'solid', color: IMG.app.fg };
        const L = Shapes.create(doc, shape, Layers.name(doc, 'Forma'));
        doc.pathTarget = 'shape'; bus.emit('layers:change', doc);
        tg = Paths.target(doc);
        void L;
      }
    }
    killLive(tg);
    const sub = { closed: false, op: op === 'new' ? 'add' : op, pts: [Paths.P(x, y)] };
    tg.path.subs.push(sub);
    return { tg, si: tg.path.subs.length - 1 };
  }
  function refreshTarget(doc, tg) { if (tg.kind === 'shape') Shapes.render(tg.L); else if (tg.kind === 'vmask') Paths.touch(tg.L.vmask); IMG.Engine.invalidate(); }

  const Pen = {
    id: 'pen', name: 'Caneta', icon: 'pen', cursor: 'crosshair', noCtrlMove: true,
    defaults: { autoAdd: true, rubber: false },
    hint: 'Clique: ponto · Arraste: curva · Clique no 1º ponto: fechar · Alt: converter · Ctrl: seleção direta · Enter/Esc: concluir',
    options() { return styleOpts('pen', [{ type: 'check', key: 'autoAdd', label: 'Adicionar/excluir automaticamente' }, { type: 'check', key: 'rubber', label: 'Elástico' }]); },
    activate() { this.cur = null; this.drawing = null; },
    deactivate() { this.finish(); },
    beforeCommand(id) {
      if (!this.drawing) return false;
      if (id === 'edit.undo') { const d = this.drawing, tg = Paths.target(IMG.app.doc), sub = tg && tg.path.subs[d.si]; if (sub) { sub.pts.pop(); if (!sub.pts.length) { tg.path.subs.splice(d.si, 1); this.drawing = null; } refreshTarget(IMG.app.doc, tg); } return true; }
      if (/^(view|window|help)\./.test(id)) return false;
      this.finish();
      return false;
    },
    sub() { const d = this.drawing; if (!d) return null; const tg = Paths.target(IMG.app.doc); return tg && tg.path.subs[d.si] ? { tg, sub: tg.path.subs[d.si] } : null; },
    down(ev) {
      const doc = IMG.app.doc, v = doc.view, o = T().o('pen');
      if (ev.ctrl) { this.ds = true; DS.down(ev); return; }
      this.ds = false;
      const cur = this.sub();
      if (cur) {
        const { tg, sub } = cur, first = sub.pts[0];
        if (sub.pts.length > 1 && near(v, first, ev.x, ev.y)) { sub.closed = true; this.dragPt = { tg, p: first, closing: true, sx: ev.x, sy: ev.y }; refreshTarget(doc, tg); return; }
        let x = ev.x, y = ev.y;
        if (ev.shift) { const l = sub.pts[sub.pts.length - 1], len = Math.hypot(x - l.x, y - l.y), a = Math.round(Math.atan2(y - l.y, x - l.x) / (Math.PI / 4)) * (Math.PI / 4); x = l.x + Math.cos(a) * len; y = l.y + Math.sin(a) * len; }
        const p = Paths.P(x, y); sub.pts.push(p);
        this.dragPt = { tg, p, sx: ev.x, sy: ev.y };
        refreshTarget(doc, tg);
        return;
      }
      // sem desenho em andamento: editar o demarcador existente?
      const tg = Paths.target(doc);
      if (tg && tg.path.subs.length) {
        const path = tg.path;
        // retomar um componente aberto pela ponta
        for (let si = 0; si < path.subs.length; si++) {
          const sb = path.subs[si]; if (sb.closed || !sb.pts.length) continue;
          const last = sb.pts[sb.pts.length - 1], first = sb.pts[0];
          if (near(v, last, ev.x, ev.y)) { this.drawing = { si }; IMG.Engine.requestRender(); return false; }
          if (near(v, first, ev.x, ev.y) && sb.pts.length > 1) { sb.pts.reverse().forEach((p) => { const t = [p.ix, p.iy]; p.ix = p.ox; p.iy = p.oy; p.ox = t[0]; p.oy = t[1]; }); this.drawing = { si }; IMG.Engine.requestRender(); return false; }
        }
        const h = hitPoint(path, ev, v, null, false);
        if (h && ev.alt) { const p = path.subs[h.si].pts[h.pi]; p.ix = p.ox = p.x; p.iy = p.oy = p.y; p.smooth = false; killLive(tg); this.dragPt = { tg, p, convert: true, sx: ev.x, sy: ev.y }; refreshTarget(doc, tg); return; }
        if (o.autoAdd && h && h.part === 'a') { const sb = path.subs[h.si]; killLive(tg); sb.pts.splice(h.pi, 1); if (sb.pts.length < 2) path.subs.splice(h.si, 1); Paths.changed(doc, tg, 'Excluir ponto de ancoragem'); return false; }
        const n = Paths.nearest(path, ev.x, ev.y);
        if (o.autoAdd && n && n.d * v.zoom <= 4) { const sb = path.subs[n.sub], a = sb.pts[n.seg], b = sb.pts[(n.seg + 1) % sb.pts.length]; killLive(tg); const np = Paths.splitSeg(a, b, n.t); sb.pts.splice(n.seg + 1, 0, np); Paths.changed(doc, tg, 'Adicionar ponto de ancoragem'); return false; }
      }
      const st = startSub(doc, ev.x, ev.y);
      this.drawing = { si: st.si };
      this.dragPt = { tg: st.tg, p: st.tg.path.subs[st.si].pts[0], sx: ev.x, sy: ev.y };
      refreshTarget(doc, st.tg);
      IMG.UI.renderOptions();
    },
    move(ev) {
      if (this.ds) { DS.move(ev); return; }
      const d = this.dragPt; if (!d) return;
      const p = d.p, v = IMG.app.doc.view;
      if (Math.hypot((ev.x - d.sx) * v.zoom, (ev.y - d.sy) * v.zoom) < 2) return;
      if (d.closing) { p.ix = 2 * p.x - ev.x; p.iy = 2 * p.y - ev.y; if (!ev.alt) { p.ox = ev.x; p.oy = ev.y; } p.smooth = !ev.alt; }
      else { p.ox = ev.x; p.oy = ev.y; if (!ev.alt) { p.ix = 2 * p.x - ev.x; p.iy = 2 * p.y - ev.y; p.smooth = true; } else p.smooth = false; }
      refreshTarget(IMG.app.doc, d.tg);
    },
    up() {
      if (this.ds) { this.ds = false; DS.up(); return; }
      const d = this.dragPt; this.dragPt = null;
      if (!d) return;
      if (d.convert) { Paths.changed(IMG.app.doc, d.tg, 'Converter ponto'); return; }
      if (d.closing) this.finish('Fechar demarcador');
    },
    finish(label) {
      const cur = this.sub();
      this.drawing = null; this.cur = null;
      if (!cur) return;
      const { tg, sub } = cur;
      if (sub.pts.length < 2) tg.path.subs.splice(tg.path.subs.indexOf(sub), 1);
      Paths.changed(IMG.app.doc, tg, label || 'Caneta');
      IMG.UI.renderOptions();
    },
    hover(ev) {
      const doc = IMG.app.doc, v = doc.view, o = T().o('pen');
      this.cur = { x: ev.x, y: ev.y, shift: ev.shift };
      const cur = this.sub();
      let c = 'crosshair';
      if (cur && cur.sub.pts.length > 1 && near(v, cur.sub.pts[0], ev.x, ev.y)) c = 'pointer';
      else if (!cur && o.autoAdd) { const tg = Paths.target(doc); if (tg) { const h = hitPoint(tg.path, ev, v, null, false); if (h) c = 'pointer'; else { const n = Paths.nearest(tg.path, ev.x, ev.y); if (n && n.d * v.zoom <= 4) c = 'copy'; } } }
      T().cursor(c);
      IMG.Engine.requestRender();
    },
    leave() { this.cur = null; IMG.Engine.requestRender(); },
    dblclick() { if (this.drawing) this.finish(); },
    onKey(e) {
      const cur = this.sub();
      if (!cur) return DS.sel && DS.sel.size ? DS.onKey(e) : false;
      if (e.key === 'Enter' || e.key === 'Escape') { this.finish(); return true; }
      if (e.key === 'Backspace' || e.key === 'Delete') { cur.sub.pts.pop(); if (!cur.sub.pts.length) { cur.tg.path.subs.splice(this.drawing.si, 1); this.drawing = null; } refreshTarget(IMG.app.doc, cur.tg); return true; }
      return false;
    },
    drawOverlay(ctx, v) {
      const doc = IMG.app.doc, tg = Paths.target(doc);
      if (tg) drawAnchors(ctx, v, tg.path, this.drawing ? new Set([this.drawing.si + ':' + ((tg.path.subs[this.drawing.si] || { pts: [] }).pts.length - 1)]) : DS.sel, false);
      const cur = this.sub();
      if (cur && this.cur && !this.dragPt && (T().o('pen').rubber || true)) {
        const l = cur.sub.pts[cur.sub.pts.length - 1];
        let x = this.cur.x, y = this.cur.y;
        if (this.cur.shift) { const len = Math.hypot(x - l.x, y - l.y), a = Math.round(Math.atan2(y - l.y, x - l.x) / (Math.PI / 4)) * (Math.PI / 4); x = l.x + Math.cos(a) * len; y = l.y + Math.sin(a) * len; }
        const a = scr(v, l.x, l.y), h = scr(v, l.ox, l.oy), b = scr(v, x, y);
        ctx.save(); ctx.strokeStyle = '#3d8bff'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(h.x, h.y, b.x, b.y, b.x, b.y); ctx.stroke(); ctx.restore();
      }
    }
  };
  IMG.Tools.register(Pen);

  /* ---------- Caneta de forma livre ---------- */
  IMG.Tools.register({
    id: 'freePen', name: 'Caneta de forma livre', icon: 'freePen', cursor: 'crosshair', noCtrlMove: true,
    defaults: { fit: 2, magnetic: false, width: 10, contrast: 10 },
    hint: 'Arraste para desenhar à mão livre · solte perto do início para fechar',
    options() {
      const o = T().o('freePen');
      const ex = [{ type: 'number', key: 'fit', label: 'Ajuste da curva', min: 0.5, max: 10, decimals: 1, unit: 'px', width: 60 }, { type: 'check', key: 'magnetic', label: 'Magnética' }];
      if (o.magnetic) ex.push({ type: 'number', key: 'width', label: 'Largura', min: 1, max: 256, unit: 'px', width: 56 }, { type: 'slider', key: 'contrast', label: 'Contraste', min: 1, max: 100, step: 1, unit: '%' });
      return styleOpts('pen', ex);
    },
    onOption(k) { if (k === 'magnetic') IMG.UI.renderOptions(); },
    snap(x, y) {
      const E = this.E, o = T().o('freePen'); if (!E) return { x, y };
      const r = Math.max(1, Math.round(o.width / 2)), cx = Math.round(x), cy = Math.round(y);
      let best = { x, y }, bv = -1;
      for (let yy = cy - r; yy <= cy + r; yy++) for (let xx = cx - r; xx <= cx + r; xx++) { if (xx < 0 || yy < 0 || xx >= E.W || yy >= E.H) continue; const g = E.g[yy * E.W + xx]; if (g > bv && g >= o.contrast / 200) { bv = g; best = { x: xx + 0.5, y: yy + 0.5 }; } }
      return best;
    },
    down(ev) {
      const o = T().o('freePen');
      this.E = o.magnetic ? IMG.edgeMap(IMG.app.doc) : null;
      this.pts = [this.snap(ev.x, ev.y)];
    },
    move(ev) {
      if (!this.pts) return;
      const l = this.pts[this.pts.length - 1], v = IMG.app.doc.view;
      if (Math.hypot((ev.x - l.x) * v.zoom, (ev.y - l.y) * v.zoom) < 2) return;
      this.pts.push(this.snap(ev.x, ev.y)); IMG.Engine.requestRender();
    },
    up() {
      const doc = IMG.app.doc, pts = this.pts; this.pts = null; this.E = null;
      IMG.Engine.requestRender();
      if (!pts || pts.length < 2) return;
      const o = T().o('freePen'), v = doc.view;
      const closed = pts.length > 4 && near(v, pts[0], pts[pts.length - 1].x, pts[pts.length - 1].y, 9);
      const simp = simplifyOpen(pts, o.fit);
      const st = startSub(doc, simp[0].x, simp[0].y);
      const sub = st.tg.path.subs[st.si];
      sub.pts = closed ? IMG.smoothPolyPts(simp.slice(0, closed && simp.length > 3 ? -1 : undefined), o.fit) : smoothOpen(simp);
      sub.closed = closed;
      Paths.changed(doc, st.tg, 'Caneta de forma livre');
    },
    drawOverlay(ctx, v) {
      const doc = IMG.app.doc, tg = Paths.target(doc);
      if (tg) drawAnchors(ctx, v, tg.path, null, false);
      const p = this.pts; if (!p || p.length < 2) return;
      ctx.save(); ctx.strokeStyle = '#3d8bff'; ctx.lineWidth = 1.2; ctx.beginPath();
      p.forEach((q, i) => { const s = scr(v, q.x, q.y); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); }); ctx.stroke(); ctx.restore();
    }
  });
  function simplifyOpen(pts, eps) {
    const simp = (a) => {
      if (a.length < 3) return a;
      const s = a[0], e = a[a.length - 1], dx = e.x - s.x, dy = e.y - s.y, L = Math.hypot(dx, dy) || 1;
      let idx = -1, md = 0;
      for (let i = 1; i < a.length - 1; i++) { const d = Math.abs((a[i].x - s.x) * dy - (a[i].y - s.y) * dx) / L; if (d > md) { md = d; idx = i; } }
      if (md <= eps) return [s, e];
      return simp(a.slice(0, idx + 1)).slice(0, -1).concat(simp(a.slice(idx)));
    };
    return simp(pts);
  }
  function smoothOpen(poly) {
    const n = poly.length, out = poly.map((p) => Paths.P(p.x, p.y));
    for (let i = 1; i < n - 1; i++) {
      const a = poly[i - 1], p = poly[i], b = poly[i + 1];
      const l1 = Math.hypot(p.x - a.x, p.y - a.y), l2 = Math.hypot(b.x - p.x, b.y - p.y), tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1;
      const cos = ((p.x - a.x) * (b.x - p.x) + (p.y - a.y) * (b.y - p.y)) / ((l1 * l2) || 1);
      if (cos < 0.4) continue;
      out[i].ix = p.x - (tx / tl) * l1 / 3; out[i].iy = p.y - (ty / tl) * l1 / 3; out[i].ox = p.x + (tx / tl) * l2 / 3; out[i].oy = p.y + (ty / tl) * l2 / 3; out[i].smooth = true;
    }
    return out;
  }

  /* ---------- Caneta de curvatura ---------- */
  function curvatureHandles(sub) {
    const n = sub.pts.length;
    sub.pts.forEach((p, i) => {
      if (p.corner) { p.ix = p.ox = p.x; p.iy = p.oy = p.y; p.smooth = false; return; }
      const a = sub.pts[i - 1] || (sub.closed ? sub.pts[n - 1] : null), b = sub.pts[i + 1] || (sub.closed ? sub.pts[0] : null);
      if (!a || !b) { p.ix = p.ox = p.x; p.iy = p.oy = p.y; p.smooth = false; return; }
      const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1, l1 = Math.hypot(p.x - a.x, p.y - a.y), l2 = Math.hypot(b.x - p.x, b.y - p.y);
      p.ix = p.x - (tx / tl) * l1 / 3; p.iy = p.y - (ty / tl) * l1 / 3; p.ox = p.x + (tx / tl) * l2 / 3; p.oy = p.y + (ty / tl) * l2 / 3; p.smooth = true;
    });
  }
  IMG.Tools.register({
    id: 'curvPen', name: 'Caneta de curvatura', icon: 'curvPen', cursor: 'crosshair', noCtrlMove: true,
    defaults: {},
    hint: 'Clique para criar curvas suaves · clique duplo: ponto de canto · clique no 1º ponto: fechar · Enter/Esc: concluir',
    options() { return styleOpts('pen'); },
    deactivate() { this.finish(); },
    cur() { const d = this.drawing; if (!d) return null; const tg = Paths.target(IMG.app.doc); return tg && tg.path.subs[d.si] ? { tg, sub: tg.path.subs[d.si] } : null; },
    down(ev) {
      const doc = IMG.app.doc, v = doc.view, c = this.cur();
      if (c) {
        const { tg, sub } = c;
        const k = sub.pts.findIndex((p) => near(v, p, ev.x, ev.y));
        if (k === 0 && sub.pts.length > 2) { sub.closed = true; curvatureHandles(sub); refreshTarget(doc, tg); this.finish('Caneta de curvatura'); return false; }
        if (k >= 0) { this.drag = { tg, p: sub.pts[k], sub }; return; }
        sub.pts.push(Object.assign(Paths.P(ev.x, ev.y), { corner: false }));
        curvatureHandles(sub); refreshTarget(doc, tg);
        this.drag = { tg, p: sub.pts[sub.pts.length - 1], sub };
        return;
      }
      const st = startSub(doc, ev.x, ev.y);
      this.drawing = { si: st.si };
      this.drag = { tg: st.tg, p: st.tg.path.subs[st.si].pts[0], sub: st.tg.path.subs[st.si] };
      IMG.Engine.requestRender();
    },
    move(ev) { const d = this.drag; if (!d) return; d.p.x = ev.x; d.p.y = ev.y; curvatureHandles(d.sub); d.moved = true; refreshTarget(IMG.app.doc, d.tg); },
    up() { this.drag = null; },
    dblclick(ev) {
      const c = this.cur(); if (!c) return;
      const v = IMG.app.doc.view, k = c.sub.pts.findIndex((p) => near(v, p, ev.x, ev.y));
      if (k >= 0) { c.sub.pts[k].corner = !c.sub.pts[k].corner; curvatureHandles(c.sub); refreshTarget(IMG.app.doc, c.tg); }
    },
    finish(label) {
      const c = this.cur(); this.drawing = null;
      if (!c) return;
      c.sub.pts.forEach((p) => { delete p.corner; });
      if (c.sub.pts.length < 2) c.tg.path.subs.splice(c.tg.path.subs.indexOf(c.sub), 1);
      Paths.changed(IMG.app.doc, c.tg, label || 'Caneta de curvatura');
    },
    hover(ev) { this.hp = { x: ev.x, y: ev.y }; IMG.Engine.requestRender(); },
    onKey(e) {
      const c = this.cur(); if (!c) return false;
      if (e.key === 'Enter' || e.key === 'Escape') { this.finish(); return true; }
      if (e.key === 'Backspace' || e.key === 'Delete') { c.sub.pts.pop(); curvatureHandles(c.sub); if (!c.sub.pts.length) { c.tg.path.subs.splice(this.drawing.si, 1); this.drawing = null; } refreshTarget(IMG.app.doc, c.tg); return true; }
      return false;
    },
    drawOverlay(ctx, v) {
      const doc = IMG.app.doc, tg = Paths.target(doc), c = this.cur();
      if (tg) drawAnchors(ctx, v, tg.path, null, false);
      if (c && this.hp && !this.drag) {
        const sub = { closed: false, pts: c.sub.pts.map((p) => Object.assign({}, p)).concat([Paths.P(this.hp.x, this.hp.y)]) };
        curvatureHandles(sub);
        ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = '#3d8bff'; ctx.beginPath(); Paths.trace(ctx, { subs: [{ closed: false, pts: sub.pts.slice(-3) }] }, VM(v)); ctx.stroke(); ctx.restore();
      }
    }
  });

  /* ---------- Adicionar / Excluir ponto / Converter ponto ---------- */
  IMG.Tools.register({
    id: 'addAnchor', name: 'Adicionar ponto de ancoragem', icon: 'addAnchor', cursor: 'copy', noCtrlMove: true, defaults: {},
    hint: 'Clique em um segmento do demarcador para adicionar um ponto',
    down(ev) {
      const doc = IMG.app.doc, tg = Paths.target(doc); if (!tg) return false;
      const n = Paths.nearest(tg.path, ev.x, ev.y); if (!n || n.d * doc.view.zoom > 6) return false;
      const sb = tg.path.subs[n.sub], a = sb.pts[n.seg], b = sb.pts[(n.seg + 1) % sb.pts.length];
      killLive(tg);
      const np = Paths.splitSeg(a, b, n.t); sb.pts.splice(n.seg + 1, 0, np);
      this.drag = { tg, p: np, x: ev.x, y: ev.y, o: { ...np } };
    },
    move(ev) { const d = this.drag; if (!d) return; const dx = ev.x - d.x, dy = ev.y - d.y; Object.assign(d.p, { x: d.o.x + dx, y: d.o.y + dy, ix: d.o.ix + dx, iy: d.o.iy + dy, ox: d.o.ox + dx, oy: d.o.oy + dy }); refreshTarget(IMG.app.doc, d.tg); },
    up() { const d = this.drag; this.drag = null; if (d) Paths.changed(IMG.app.doc, d.tg, 'Adicionar ponto de ancoragem'); },
    drawOverlay(ctx, v) { const tg = Paths.target(IMG.app.doc); if (tg) drawAnchors(ctx, v, tg.path, null, false); }
  });
  IMG.Tools.register({
    id: 'delAnchor', name: 'Excluir ponto de ancoragem', icon: 'delAnchor', cursor: 'pointer', noCtrlMove: true, defaults: {},
    hint: 'Clique em um ponto de ancoragem para excluí-lo',
    down(ev) {
      const doc = IMG.app.doc, tg = Paths.target(doc); if (!tg) return false;
      const h = hitPoint(tg.path, ev, doc.view, null, false); if (!h || h.part !== 'a') return false;
      killLive(tg);
      const sb = tg.path.subs[h.si]; sb.pts.splice(h.pi, 1); if (sb.pts.length < 2) tg.path.subs.splice(h.si, 1);
      Paths.changed(doc, tg, 'Excluir ponto de ancoragem');
      return false;
    },
    drawOverlay(ctx, v) { const tg = Paths.target(IMG.app.doc); if (tg) drawAnchors(ctx, v, tg.path, null, false); }
  });
  IMG.Tools.register({
    id: 'convertPt', name: 'Converter ponto', icon: 'convertPt', cursor: 'default', noCtrlMove: true, defaults: {},
    hint: 'Clique em um ponto suave para torná-lo canto · arraste a partir de um canto para criar alças · arraste uma alça para movê-la sozinha',
    down(ev) {
      const doc = IMG.app.doc, tg = Paths.target(doc); if (!tg) return false;
      const h = hitPoint(tg.path, ev, doc.view, null, true); if (!h) return false;
      killLive(tg);
      const p = tg.path.subs[h.si].pts[h.pi];
      if (h.part === 'a') { p.ix = p.ox = p.x; p.iy = p.oy = p.y; p.smooth = false; this.drag = { tg, p, part: 'a' }; refreshTarget(doc, tg); return; }
      this.drag = { tg, p, part: h.part };
    },
    move(ev) {
      const d = this.drag; if (!d) return;
      const p = d.p;
      if (d.part === 'a') { p.ox = ev.x; p.oy = ev.y; p.ix = 2 * p.x - ev.x; p.iy = 2 * p.y - ev.y; p.smooth = true; }
      else if (d.part === 'i') { p.ix = ev.x; p.iy = ev.y; p.smooth = false; }
      else { p.ox = ev.x; p.oy = ev.y; p.smooth = false; }
      d.moved = true; refreshTarget(IMG.app.doc, d.tg);
    },
    up() { const d = this.drag; this.drag = null; if (d) Paths.changed(IMG.app.doc, d.tg, 'Converter ponto'); },
    drawOverlay(ctx, v) { const tg = Paths.target(IMG.app.doc); if (tg) drawAnchors(ctx, v, tg.path, null, true); }
  });

  /* ==================================================================
     PROPRIEDADES DA CAMADA DE FORMA
     ================================================================== */
  Shapes.propsUI = function (box, L, doc) {
    const UI = IMG.UI;
    const s = L.shape = Shapes.normalize(L.shape);
    const title = (t) => el('h4.props-title', { text: t });
    const commit = (label, fin = true) => { Shapes.render(L); IMG.Engine.invalidate(); if (fin) { bus.emit('layer:pixels', L); IMG.commit(label); } };
    const lv = s.live;
    box.appendChild(title(lv ? { rect: 'Retângulo', ellipse: 'Elipse', polygon: 'Polígono', line: 'Linha' }[lv.kind] || 'Forma' : 'Forma'));
    const b = Paths.bounds(s.path) || { x: 0, y: 0, w: 0, h: 0 };
    const setBox = (key) => (v) => {
      const cur = Paths.bounds(s.path); if (!cur) return;
      let M = new DOMMatrix();
      if (key === 'x') M = M.translate(v - cur.x, 0); else if (key === 'y') M = M.translate(0, v - cur.y);
      else if (key === 'w' && cur.w > 0) M = M.translate(cur.x, cur.y).scale(Math.max(1, v) / cur.w, 1).translate(-cur.x, -cur.y);
      else if (key === 'h' && cur.h > 0) M = M.translate(cur.x, cur.y).scale(1, Math.max(1, v) / cur.h).translate(-cur.x, -cur.y);
      Shapes.transform(L, M); bus.emit('layer:pixels', L); IMG.commit('Editar forma');
    };
    box.appendChild(UI.row('L / A', UI.num({ value: U.round(b.w, 1), min: 1, max: 30000, decimals: 1, unit: 'px', width: 84, onChange: setBox('w') }).el, UI.num({ value: U.round(b.h, 1), min: 1, max: 30000, decimals: 1, unit: 'px', width: 84, onChange: setBox('h') }).el));
    box.appendChild(UI.row('X / Y', UI.num({ value: U.round(b.x, 1), min: -30000, max: 30000, decimals: 1, unit: 'px', width: 84, onChange: setBox('x') }).el, UI.num({ value: U.round(b.y, 1), min: -30000, max: 30000, decimals: 1, unit: 'px', width: 84, onChange: setBox('y') }).el));
    box.appendChild(UI.row('Preenchimento', fillField(s.fill, (v, fin) => { s.fill = v; commit('Preenchimento da forma', fin); }).el));
    const st = s.stroke = s.stroke || { on: false, fill: { type: 'solid', color: '#000' }, width: 3, align: 'inside', cap: 'butt', join: 'miter', dash: null };
    box.appendChild(UI.row('Traçado', fillField(st.on ? st.fill : null, (v, fin) => { st.on = !!v; if (v) st.fill = v; commit('Traçado da forma', fin); }).el));
    box.appendChild(UI.row('', UI.num({ value: st.width, min: 0, max: 500, decimals: 1, unit: 'px', width: 70, onChange: (v) => { st.width = v; if (v > 0) st.on = true; commit('Traçado da forma'); } }).el, strokeOptsBtn(st, () => commit('Traçado da forma'))));
    if (lv && lv.kind === 'rect') {
      box.appendChild(title('Cantos'));
      const radii = lv.radii || [0, 0, 0, 0];
      let linked = radii.every((r) => r === radii[0]);
      const inputs = [];
      const setR = (i) => (v) => { if (linked) lv.radii = [v, v, v, v]; else { lv.radii = radii.slice(); lv.radii[i] = v; } inputs.forEach((inp, k) => inp.set(lv.radii[k])); commit('Raio dos cantos'); };
      ['↖', '↗', '↘', '↙'].forEach((lab, i) => inputs.push(UI.num({ value: U.round(radii[i] || 0, 1), min: 0, max: 5000, decimals: 1, unit: lab, width: 68, onChange: setR(i) })));
      box.appendChild(el('div.props-grid2', ...inputs.map((x) => x.el)));
      box.appendChild(UI.row('', UI.check('Vincular raios', linked, (v) => { linked = v; }).el));
    }
    if (lv && lv.kind === 'polygon') {
      box.appendChild(UI.slider({ label: 'Lados', value: lv.sides, min: 3, max: 60, step: 1, stack: true, onInput: (v) => { lv.sides = v; commit('', false); }, onChange: (v) => { lv.sides = v; commit('Polígono'); } }).el);
      box.appendChild(UI.row('', UI.check('Estrela', !!lv.star, (v) => { lv.star = v; commit('Polígono'); }).el));
      if (lv.star) box.appendChild(UI.slider({ label: 'Recuo', value: lv.inner == null ? 50 : lv.inner, min: 1, max: 99, step: 1, unit: '%', stack: true, onInput: (v) => { lv.inner = v; commit('', false); }, onChange: (v) => { lv.inner = v; commit('Polígono'); } }).el);
    }
    if (lv && lv.kind === 'line') box.appendChild(UI.row('Espessura', UI.num({ value: lv.weight, min: 0.5, max: 1000, decimals: 1, unit: 'px', width: 80, onChange: (v) => { lv.weight = v; commit('Linha'); } }).el));
    box.appendChild(el('div.props-actions',
      UI.btn('Unir', () => UI.run('shape.unite'), { small: true }), UI.btn('Subtrair', () => UI.run('shape.subtract'), { small: true }),
      UI.btn('Interseção', () => UI.run('shape.intersect'), { small: true }), UI.btn('Excluir', () => UI.run('shape.exclude'), { small: true })));
  };

  /* ---------- integração com Ctrl+T: transformar o demarcador selecionado ---------- */
  IMG.pathTransformTarget = function () {
    const id = T().activeId;
    if (id !== 'pathSelect' && id !== 'directSelect') return null;
    const doc = IMG.app.doc, tg = Paths.target(doc); if (!tg || !tg.path.subs.length) return null;
    let subs;
    if (id === 'pathSelect') subs = PS.subs.size ? Array.from(PS.subs) : tg.path.subs.map((_, i) => i);
    else { const set = new Set(); DS.sel.forEach((k) => set.add(+k.split(':')[0])); subs = set.size ? Array.from(set) : tg.path.subs.map((_, i) => i); }
    if (tg.kind === 'shape' && subs.length === tg.path.subs.length) return null;   // a camada inteira usa a transformação normal
    return { tg, subs };
  };
})();
