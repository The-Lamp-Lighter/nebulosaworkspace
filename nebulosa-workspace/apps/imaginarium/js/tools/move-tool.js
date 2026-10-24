/* ==========================================================================
   Imaginarium — ferramenta Mover e Transformação Livre
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus;
  const Layers = IMG.Layers, Sel = IMG.Selection;


  /* ==================================================================
     MOVER
     ================================================================== */
  const commitNudge = U.debounce(() => IMG.commit('Deslocar'), 450);

  /** Exporta a(s) camada(s) selecionada(s), recortada(s) ao conteúdo (botão de download do Photopea). */
  async function quickExport(fmt) {
    const doc = IMG.app.doc; if (!doc) return;
    const sel = Layers.selectedLayers(doc); if (!sel.length) { IMG.UI.toast('Selecione uma camada.'); return; }
    let b = null; sel.forEach((L) => { b = U.rectUnion(b, L.contentBounds()); });
    if (!b || b.w < 1 || b.h < 1) { IMG.UI.toast('A camada está vazia.'); return; }
    const D = new IMG.Doc({ name: sel[sel.length - 1].name, width: Math.ceil(b.w), height: Math.ceil(b.h) });
    D.layers = sel.map((L) => { const C = Layers.clone(L, ''); C.parent = null; C.translate(-b.x, -b.y); return C; });
    try {
      const blob = await IMG.encodeDoc(D, { format: fmt, w: D.width, h: D.height, quality: 92, matte: '#ffffff', alpha: true });
      U.download(blob, U.safeFile(D.name) + '.' + fmt);
    } catch (err) { IMG.UI.fail(err); }
  }

  IMG.Tools.register({
    id: 'move', name: 'Mover', icon: 'move', key: 'v', group: 'move', cursor: 'default',
    defaults: { autoSelect: true, autoTarget: 'layer', showBounds: false, distances: false },
    hint: 'Setas: deslocar 1 px (Shift: 10 px) · Alt+arrastar: duplicar · Ctrl: inverter seleção automática · 0–9: opacidade da camada',
    drag: null,

    options() {
      const align = (kind) => () => IMG.ImageOps.align(kind);
      const ab = (icon, title, kind) => IMG.UI.iconBtn(icon, title, align(kind));
      if (IMG.Skins && IMG.Skins.is('photopea')) {
        const UI = IMG.UI, dist = (k) => () => { const d = IMG.app.doc; if (d && Layers.selectedLayers(d).length > 2) IMG.ImageOps.distribute(k); else UI.toast('Selecione três ou mais camadas para distribuir.'); };
        const db = (icon, title, k) => UI.iconBtn(icon, title, dist(k));
        const more = UI.iconBtn('more', 'Mais opções de alinhamento', (e) => { const r = e.currentTarget.getBoundingClientRect(); UI.contextMenu(r.left, r.bottom + 2, [{ label: 'Distribuir', items: ['layer.dist.top', 'layer.dist.vcenter', 'layer.dist.bottom', '-', 'layer.dist.left', 'layer.dist.hcenter', 'layer.dist.right'] }, '-', 'edit.autoAlign', 'edit.autoBlend']); });
        const save = UI.iconBtn('ppDownload', 'Exportar a camada selecionada', (e) => { const r = e.currentTarget.getBoundingClientRect(); UI.contextMenu(r.left, r.bottom + 2, ['png', 'jpg', 'webp', 'svg'].map((f) => ({ label: 'Exportar como ' + f.toUpperCase(), run: () => quickExport(f) }))); });
        save.classList.add('pp-boxbtn');
        return [
          { type: 'check', key: 'autoSelect', label: 'Seleção automática', title: 'Clicar em um objeto seleciona a camada dele' },
          { type: 'select', key: 'autoTarget', options: [['layer', 'Camada'], ['group', 'Grupo']], width: 90, title: 'O que a seleção automática escolhe' },
          { type: 'check', key: 'showBounds', label: 'Controles de transformação', title: 'Mostra a caixa da camada; arraste uma alça para transformar' },
          { type: 'check', key: 'distances', label: 'Distâncias', title: 'Mostra as distâncias até as bordas do documento ao mover' },
          { type: 'custom', build: () => save },
          { type: 'custom', build: () => U.el('span.opt-group', ab('objLeft', 'Alinhar à esquerda', 'left'), ab('objCenterH', 'Centralizar na horizontal', 'hcenter'), ab('objRight', 'Alinhar à direita', 'right'), db('distV', 'Distribuir centros verticais', 'vcenter')) },
          { type: 'custom', build: () => U.el('span.opt-group', ab('objTop', 'Alinhar ao topo', 'top'), ab('objCenterV', 'Centralizar na vertical', 'vcenter'), ab('objBottom', 'Alinhar à base', 'bottom'), db('distH', 'Distribuir centros horizontais', 'hcenter'), more) }
        ];
      }
      return [
        { type: 'check', key: 'autoSelect', label: 'Seleção automática', title: 'Clicar em um objeto seleciona a camada dele' },
        { type: 'select', key: 'autoTarget', options: [['layer', 'Camada'], ['group', 'Grupo']], width: 90, title: 'O que a seleção automática escolhe' },
        { type: 'check', key: 'showBounds', label: 'Controles de transformação', title: 'Mostra a caixa da camada; arraste uma alça para transformar' },
        { type: 'sep' },
        { type: 'custom', build: () => U.el('span.opt-group', ab('objLeft', 'Alinhar à esquerda', 'left'), ab('objCenterH', 'Centralizar na horizontal', 'hcenter'), ab('objRight', 'Alinhar à direita', 'right'),
            ab('objTop', 'Alinhar ao topo', 'top'), ab('objCenterV', 'Centralizar na vertical', 'vcenter'), ab('objBottom', 'Alinhar à base', 'bottom')) },
        { type: 'sep' },
        { type: 'button', label: 'Transformação livre', icon: 'transform', action: () => IMG.UI.run('edit.transform') }
      ];
    },

    /** Alça dos controles de transformação sob o ponteiro (ou -1). */
    handleAt(ev) {
      const doc = IMG.app.doc, o = IMG.Tools.o('move');
      if (!o.showBounds) return -1;
      let b = null;
      Layers.selectedLayers(doc).forEach((l) => { if (Layers.isVisible(l)) b = U.rectUnion(b, l.contentBounds()); });
      if (!b) return -1;
      const v = doc.view, pts = [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]];
      for (let i = 0; i < pts.length; i++) { const x = v.x + (b.x + b.w * pts[i][0]) * v.zoom, y = v.y + (b.y + b.h * pts[i][1]) * v.zoom; if (Math.abs(x - ev.sx) <= 6 && Math.abs(y - ev.sy) <= 6) return i; }
      return -1;
    },

    down(ev) {
      const doc = IMG.app.doc, o = IMG.Tools.o('move'), p = IMG.app.prefs;
      this.drag = null;
      // arrastar uma alça dos controles de transformação inicia a Transformação livre
      if (!ev.tempMove && this.handleAt(ev) >= 0 && IMG.Transform && !doc.selection) {
        if (IMG.Transform.begin({ mode: 'free' })) {
          const t = IMG.Tools.defs.transform;
          t.down(ev); IMG.Tools.isDown = true; IMG.Tools.routed = t;
          return;
        }
      }
      const g = !p.lockGuides && IMG.Engine.guideAt(ev.sx, ev.sy);
      if (g) { this.drag = { type: 'guide', g, orig: doc.guides[g.o][g.i] }; return; }

      if (o.autoSelect !== ev.ctrl) {
        let hit = Layers.pick(doc, ev.x, ev.y);
        if (hit && o.autoTarget === 'group') while (hit.parent && !hit.parent.artboard) hit = hit.parent;
        if (hit) {
          let sel = false;
          for (let q = hit; q; q = q.parent) if (doc.selected.has(q.id)) sel = true;
          if (!sel || ev.shift) Layers.setActive(doc, hit.id, ev.shift ? 'toggle' : undefined);
        }
      }
      const all = Layers.selectedLayers(doc);
      const layers = all.filter((l) => !Layers.isLocked(l) && !l.lockPos);
      if (!layers.length) { if (all.length) IMG.UI.toast('A camada está bloqueada e não pode ser movida.'); return false; }

      const single = layers.length === 1 ? layers[0] : null;
      if (doc.selection && single && single.type === 'raster' && !doc.editMask) {
        this.drag = { type: 'float', L: single, sx: ev.x, sy: ev.y, dx: 0, dy: 0, started: false, copy: !!ev.alt, bounds: { ...doc.selection.bounds } };
      } else {
        let b = null;
        layers.forEach((l) => { b = U.rectUnion(b, l.contentBounds()); });
        const ex = new Set(layers.map((l) => l.id));
        this.drag = { type: 'layers', layers, sx: ev.x, sy: ev.y, dx: 0, dy: 0, bounds: b, dup: !!ev.alt };
        this.drag.T = IMG.Snap.collect(doc, ex);
      }
      if (this.drag.type === 'float') this.drag.T = IMG.Snap.collect(doc, new Set([single.id]));
    },

    _delta(ev, d) {
      const doc = IMG.app.doc;
      let dx = Math.round(ev.x - d.sx), dy = Math.round(ev.y - d.sy);
      if (ev.shift) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      IMG.Engine.smart = [];
      if (d.bounds && !ev.ctrl) {
        const r = { x: d.bounds.x + dx, y: d.bounds.y + dy, w: d.bounds.w, h: d.bounds.h };
        const sn = IMG.Snap.rect(doc, r, d.T);
        if (!(ev.shift && dx === 0)) dx += Math.round(sn.dx);
        if (!(ev.shift && dy === 0)) dy += Math.round(sn.dy);
        IMG.Engine.smart = sn.lines;
      }
      return { dx, dy };
    },

    _startFloat(d) {
      const doc = IMG.app.doc, L = d.L;
      L.ensureCovers(doc.rect);
      const fl = U.createCanvas(doc.width, doc.height), fc = fl.getContext('2d');
      fc.drawImage(L.canvas, L.x, L.y);
      Sel.clip(doc, fl);
      const lc = L.ctx;
      if (!d.copy) {
        lc.globalCompositeOperation = 'destination-out';
        lc.drawImage(doc.selection.canvas, -L.x, -L.y);
        lc.globalCompositeOperation = 'source-over';
      }
      d.float = fl;
      d.base = U.cloneCanvas(L.canvas);
      d.selBase = U.cloneCanvas(doc.selection.canvas);
      d.selPath = doc.selection.path;
      d.started = true;
      IMG.Engine.beginStrokeCache(doc, L);
    },

    move(ev) {
      const doc = IMG.app.doc, d = this.drag;
      if (!d) return;
      if (d.type === 'guide') {
        const p = IMG.Engine.s2d(ev.sx, ev.sy);
        doc.guides[d.g.o][d.g.i] = Math.round(d.g.o === 'v' ? p.x : p.y);
        IMG.Engine.requestRender();
        return;
      }
      const { dx, dy } = this._delta(ev, d);
      if (dx === d.dx && dy === d.dy) { IMG.Engine.requestRender(); return; }
      if (d.type === 'layers') {
        if (d.dup && !d.duped) {
          // Alt+arrastar: duplica as camadas selecionadas e move as cópias
          d.duped = true;
          Layers.duplicate(doc);
          d.layers = Layers.selectedLayers(doc).filter((l) => !Layers.isLocked(l) && !l.lockPos);
          bus.emit('layers:change', doc);
        }
        d.layers.forEach((l) => l.translate(dx - d.dx, dy - d.dy));
        d.dx = dx; d.dy = dy;
        IMG.Engine.invalidate();
      } else {
        if (!d.started) this._startFloat(d);
        d.dx = dx; d.dy = dy;
        const L = d.L, c = L.ctx;
        c.globalCompositeOperation = 'copy'; c.drawImage(d.base, 0, 0);
        c.globalCompositeOperation = 'source-over'; c.drawImage(d.float, dx - L.x, dy - L.y);
        const p = new Path2D();
        p.addPath(d.selPath, new DOMMatrix([1, 0, 0, 1, dx, dy]));
        doc.selection.path = p;
        IMG.Engine.invalidate();
      }
      IMG.UI.setHint('Δ ' + dx + ', ' + dy + ' px');
    },

    up(ev) {
      const doc = IMG.app.doc, d = this.drag;
      this.drag = null;
      IMG.Engine.smart = [];
      IMG.UI.setHint('');
      if (!d) return;
      if (d.type === 'guide') {
        const out = ev.sx < 0 || ev.sy < 0 || ev.sx > IMG.Engine.w || ev.sy > IMG.Engine.h;
        if (out) doc.guides[d.g.o].splice(d.g.i, 1);
        if (out || doc.guides[d.g.o][d.g.i] !== d.orig) IMG.commit(out ? 'Remover guia' : 'Mover guia');
        IMG.Engine.requestRender();
        return;
      }
      if (d.type === 'layers') {
        if (d.dx || d.dy || d.duped) { bus.emit('layers:change', doc); IMG.commit(d.duped ? 'Duplicar camada' : 'Mover'); }
        else IMG.Engine.requestRender();
        return;
      }
      if (d.started) {
        IMG.Engine.endStrokeCache();
        const s = doc.selection, sc = s.canvas.getContext('2d');
        sc.globalCompositeOperation = 'copy'; sc.drawImage(d.selBase, d.dx, d.dy); sc.globalCompositeOperation = 'source-over';
        if (d.dx || d.dy) { sc.clearRect(0, 0, doc.width, doc.height); sc.drawImage(d.selBase, d.dx, d.dy); }
        IMG.markDirty(s);
        Sel.update(doc);
        d.L.markDirty();
        bus.emit('layer:pixels', d.L);
        IMG.commit(d.copy ? 'Duplicar pixels selecionados' : 'Mover pixels selecionados');
      }
    },

    hover(ev) {
      const g = !IMG.app.prefs.lockGuides && IMG.Engine.guideAt(ev.sx, ev.sy);
      const h = g ? -1 : this.handleAt(ev);
      IMG.Tools.cursor(g ? (g.o === 'v' ? 'col-resize' : 'row-resize') : h >= 0 ? ['nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize'][h % 4] : 'default');
    },

    onKey(e, combo) {
      if (!/^(alt\+)?(shift\+)?arrow(up|down|left|right)$/.test(combo) && !/^(shift\+)?(alt\+)?arrow(up|down|left|right)$/.test(combo)) return false;
      const doc = IMG.app.doc;
      if (e.altKey && !e.repeat && Layers.selectedLayers(doc).length) { commitNudge.cancel(); Layers.duplicate(doc); bus.emit('layers:change', doc); IMG.commit('Duplicar camada'); }
      const layers = Layers.selectedLayers(doc).filter((l) => !Layers.isLocked(l) && !l.lockPos);
      if (!layers.length) return true;
      const n = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
      layers.forEach((l) => l.translate(dx, dy));
      IMG.Engine.invalidate();
      bus.emit('layers:props', doc);
      commitNudge();
      return true;
    },

    drawOverlay(ctx, v) {
      const doc = IMG.app.doc, o = IMG.Tools.o('move');
      if (o.distances && this.drag && this.drag.type === 'layers' && this.drag.bounds) {
        const b0 = this.drag.bounds, b = { x: b0.x + this.drag.dx, y: b0.y + this.drag.dy, w: b0.w, h: b0.h };
        const X = (x) => v.x + x * v.zoom, Y = (y) => v.y + y * v.zoom;
        ctx.save(); ctx.strokeStyle = '#ff3fb4'; ctx.fillStyle = '#ff3fb4'; ctx.lineWidth = 1; ctx.font = '11px "Open Sans", sans-serif';
        const seg = (x1, y1, x2, y2, val, horiz) => {
          if (val <= 0) return;
          ctx.beginPath(); ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5); ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5); ctx.stroke();
          const t = String(Math.round(val)), w = ctx.measureText(t).width + 8, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
          ctx.fillRect(cx - w / 2, cy - 8, w, 16); ctx.fillStyle = '#fff'; ctx.fillText(t, cx - w / 2 + 4, cy + 4); ctx.fillStyle = '#ff3fb4';
          void horiz;
        };
        const my = b.y + b.h / 2, mx = b.x + b.w / 2;
        seg(X(0), Y(my), X(b.x), Y(my), b.x, true);
        seg(X(b.x + b.w), Y(my), X(doc.width), Y(my), doc.width - b.x - b.w, true);
        seg(X(mx), Y(0), X(mx), Y(b.y), b.y, false);
        seg(X(mx), Y(b.y + b.h), X(mx), Y(doc.height), doc.height - b.y - b.h, false);
        ctx.restore();
      }
      if (!o.showBounds || (this.drag && this.drag.type === 'float')) return;
      let b = null;
      Layers.selectedLayers(doc).forEach((l) => { if (Layers.isVisible(l)) b = U.rectUnion(b, l.contentBounds()); });
      if (!b) return;
      const x = Math.round(v.x + b.x * v.zoom) + 0.5, y = Math.round(v.y + b.y * v.zoom) + 0.5, w = Math.round(b.w * v.zoom), h = Math.round(b.h * v.zoom);
      ctx.strokeStyle = 'rgba(77,143,214,.95)'; ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#fff';
      for (const [hx, hy] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5]]) {
        ctx.fillRect(x + w * hx - 3, y + h * hy - 3, 6, 6); ctx.strokeRect(x + w * hx - 3, y + h * hy - 3, 6, 6);
      }
    }
  });

})();
