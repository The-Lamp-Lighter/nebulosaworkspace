/* ==========================================================================
   Imaginarium — gerenciador de ferramentas
   Grupos de ferramentas iguais aos do Photopea (um botão por grupo, com menu
   suspenso), atalhos de uma letra (Shift+letra alterna dentro do grupo) e
   ferramentas temporárias (Espaço = Mão, Ctrl+Espaço/Alt+Espaço = Zoom,
   Ctrl = Mover).

   Cada ferramenta registra um objeto:
   { id, name, icon, cursor, defaults, options(), activate(), deactivate(),
     down(ev), move(ev), up(ev), hover(ev), leave(), dblclick(ev), onKey(e, combo),
     drawOverlay(ctx, view), onOption(key, value), hidden, modal, noCtrlMove }
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus;

  /* grupos na ordem da barra do Photopea: [id, tecla, [ferramentas]] */
  const GROUPS = [
    ['move', 'v', ['move', 'artboard']],
    ['marquee', 'm', ['marqueeRect', 'marqueeEllipse', 'marqueeRow', 'marqueeCol']],
    ['lasso', 'l', ['lasso', 'polyLasso', 'magLasso']],
    ['wand', 'w', ['wand', 'quickSel']],
    ['crop', 'c', ['crop', 'perspCrop', 'slice', 'sliceSelect']],
    ['eyedrop', 'i', ['eyedropper', 'colorSampler', 'ruler', 'count']],
    ['heal', 'j', ['spotHeal', 'heal', 'patch', 'contentMove', 'redEye']],
    ['brush', 'b', ['brush', 'pencil', 'colorReplace', 'mixer']],
    ['stamp', 's', ['stamp', 'patternStamp']],
    ['histbrush', 'y', ['historyBrush']],
    ['eraser', 'e', ['eraser', 'bgEraser', 'magicEraser']],
    ['fill', 'g', ['gradient', 'bucket']],
    ['blur', 'r', ['blurTool', 'sharpenTool', 'smudge']],
    ['dodge', 'o', ['dodge', 'burn', 'sponge']],
    ['pen', 'p', ['pen', 'freePen', 'curvPen', 'addAnchor', 'delAnchor', 'convertPt']],
    ['type', 't', ['text', 'textV', 'textMaskV', 'textMaskH']],
    ['pathSel', 'a', ['pathSelect', 'directSelect']],
    ['shape', 'u', ['shapeRect', 'shapeEllipse', 'shapePolygon', 'shapeStar', 'shapeLine', 'shapeCustom']],
    ['hand', 'h', ['hand', 'rotateView']],
    ['zoom', 'z', ['zoom']]
  ].map(([id, key, tools]) => ({ id, key, tools }));

  const Tools = (IMG.Tools = {
    defs: {},
    order: [],
    GROUPS,
    groupCur: U.store.get('toolGroups', {}),
    active: null,
    activeId: null,
    prevId: 'move',
    opts: {},
    space: false,
    panning: null,
    isDown: false,
    last: null,
    routed: null,       // ferramenta temporária durante um arraste (Ctrl = Mover)
    overrideClick: null,

    register(def) {
      this.defs[def.id] = def;
      const g = GROUPS.find((gr) => gr.tools.includes(def.id));
      if (g) { def.key = g.key; def.groupId = g.id; }
      this._reorder();
      const stored = U.store.get('tool.' + def.id, {});
      const base = Object.assign({}, def.defaults || {});
      for (const k in stored) if (k in base && typeof stored[k] === typeof base[k]) base[k] = stored[k];
      this.opts[def.id] = base;
      return def;
    },
    _reorder() {
      const known = [];
      GROUPS.forEach((g) => g.tools.forEach((id) => { if (this.defs[id]) known.push(id); }));
      Object.keys(this.defs).forEach((id) => { if (!known.includes(id)) known.push(id); });
      this.order = known;
    },
    groupOf(id) { return GROUPS.find((g) => g.tools.includes(id)) || null; },
    groupTools(g) { return g.tools.filter((id) => this.defs[id] && !this.defs[id].hidden); },
    currentOf(g) {
      const list = this.groupTools(g);
      const c = this.groupCur[g.id];
      return list.includes(c) ? c : list[0];
    },

    /** Opções da ferramenta (ativa, se o id for omitido). */
    o(id) { return this.opts[id || this.activeId] || {}; },

    setOpt(id, key, value, silent) {
      const o = this.opts[id];
      if (!o) return;
      o[key] = value;
      this._save(id);
      const t = this.defs[id];
      if (t && t.onOption) t.onOption(key, value);
      if (!silent) bus.emit('tool:option', id, key, value);
      IMG.Engine.requestRender();
    },

    _save: (function () {
      const pending = new Set();
      const flush = U.debounce(() => { pending.forEach((id) => U.store.set('tool.' + id, Tools.opts[id])); pending.clear(); }, 400);
      return function (id) { pending.add(id); flush(); };
    })(),

    set(id) {
      const def = this.defs[id];
      if (!def || id === this.activeId) return;
      const prev = this.active;
      if (prev) {
        if (this.isDown && prev.up && this.last) { try { prev.up(this.last); } catch (e) { console.error(e); } }
        this.isDown = false;
        if (prev.deactivate) prev.deactivate(id);
        if (!prev.modal) this.prevId = this.activeId;
      }
      this.activeId = id;
      this.active = def;
      const g = this.groupOf(id);
      if (g && !def.hidden) { this.groupCur[g.id] = id; U.store.set('toolGroups', this.groupCur); }
      if (def.activate) def.activate();
      IMG.Engine.smart = [];
      this.updateCursor();
      bus.emit('tool:change', id);
      IMG.Engine.requestRender();
    },

    /** Volta para a ferramenta usada antes de uma ferramenta modal. */
    back() { this.set(this.prevId && this.defs[this.prevId] && !this.defs[this.prevId].modal ? this.prevId : 'move'); },

    cursor(css) { IMG.Engine.canvas.style.cursor = css; },
    updateCursor() {
      const t = this.active;
      let c = 'default';
      if (this.panning) c = 'grabbing';
      else if (this.space) c = this.spaceZoom ? (this.spaceZoom === 'out' ? 'zoom-out' : 'zoom-in') : 'grab';
      else if (this.ctrlMove) c = 'default';
      else if (t) c = typeof t.cursor === 'function' ? t.cursor() : t.cursor || 'default';
      IMG.Engine.canvas.style.cursor = c;
    },

    ev(e) {
      const r = IMG.Engine.canvas.getBoundingClientRect();
      const v = IMG.Engine.toVirtual(e.clientX - r.left, e.clientY - r.top);
      const sx = v.x, sy = v.y;
      const p = IMG.Engine.s2d(sx, sy);
      return {
        x: p.x, y: p.y, sx, sy,
        shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey,
        button: e.button,
        pen: e.pointerType === 'pen',
        pressure: e.pointerType === 'pen' ? Math.max(0.02, e.pressure) : 1,
        tilt: { x: e.tiltX || 0, y: e.tiltY || 0 },
        time: e.timeStamp,
        e
      };
    },

    /** A ferramenta ativa aceita Ctrl = Mover temporário? */
    _ctrlMoveOK() {
      const t = this.active;
      if (!t || t.modal || t.noCtrlMove) return false;
      return this.activeId !== 'move' && !!this.defs.move;
    },

    init() {
      const c = IMG.Engine.canvas;
      c.addEventListener('pointerdown', (e) => this.onDown(e));
      c.addEventListener('pointermove', (e) => this.onMove(e));
      c.addEventListener('pointerup', (e) => this.onUp(e));
      c.addEventListener('pointercancel', (e) => this.onUp(e));
      c.addEventListener('pointerleave', () => {
        IMG.Engine.setRulerMark(null);
        bus.emit('pointer:leave');
        if (this.active && this.active.leave && !this.isDown) this.active.leave();
      });
      c.addEventListener('dblclick', (e) => {
        if (!IMG.app.doc || this.space || IMG.UI.modalCount) return;
        if (this.active && this.active.dblclick) this.active.dblclick(this.ev(e));
      });
      c.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!IMG.app.doc || IMG.UI.modalCount) return;
        if (this.active && this.active.context) this.active.context(this.ev(e));
        else if (IMG.UI.canvasMenu) IMG.UI.canvasMenu(e);
      });
      window.addEventListener('keydown', (e) => this.onKeyDown(e));
      window.addEventListener('keyup', (e) => this.onKeyUp(e));
      window.addEventListener('blur', () => { this.space = false; this.spaceZoom = null; this.ctrlMove = false; this.updateCursor(); });
    },

    onDown(e) {
      if (!IMG.app.doc) return;
      if (IMG.UI.modalCount > 0) {
        // com um diálogo aberto, a tela só aceita cliques de "conta-gotas" do diálogo
        if (this.overrideClick && e.button === 0) {
          const ev = this.ev(e); this.overrideClick(ev);
          const mv = (m) => { if (this.overrideClick) this.overrideClick(this.ev(m)); };
          const upf = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upf); };
          window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upf);
        }
        return;
      }
      const ae = document.activeElement;
      if (ae && ae !== document.body && U.isTyping(ae) && !ae.classList.contains('text-editor')) ae.blur();
      try { IMG.Engine.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (e.button === 1 || (e.button === 0 && this.space && !this.spaceZoom)) {
        e.preventDefault();
        this.panning = { x: e.clientX, y: e.clientY };
        this.updateCursor();
        return;
      }
      if (e.button === 0 && this.space && this.spaceZoom && this.defs.zoom) {
        const ev = this.ev(e); ev.alt = this.spaceZoom === 'out';
        this.routed = this.defs.zoom; this.isDown = true; this.last = ev;
        this.routed.down(ev);
        return;
      }
      if (e.button !== 0 || !this.active) return;
      const ev = this.ev(e);
      this.isDown = true; this.last = ev;
      if (ev.ctrl && this._ctrlMoveOK() && !(this.active.ctrlHandled && this.active.ctrlHandled(ev))) {
        ev.tempMove = true;
        this.routed = this.defs.move;
        try { if (this.routed.down(ev) === false) { this.isDown = false; this.routed = null; } } catch (err) { this.isDown = false; this.routed = null; console.error(err); }
        return;
      }
      if (this.active.down) {
        try { if (this.active.down(ev) === false) this.isDown = false; } catch (err) { this.isDown = false; console.error(err); IMG.UI.toast('Erro na ferramenta: ' + err.message, 'error'); }
      }
    },

    onMove(e) {
      if (!IMG.app.doc) return;
      const ev = this.ev(e);
      IMG.Engine.setRulerMark(ev.sx, ev.sy);
      bus.emit('pointer:move', ev);
      if (this.panning) {
        IMG.Engine.panBy(e.clientX - this.panning.x, e.clientY - this.panning.y);
        this.panning.x = e.clientX; this.panning.y = e.clientY;
        return;
      }
      if (IMG.UI.modalCount > 0) return;
      const t = this.routed || this.active;
      if (!t) return;
      this.last = ev;
      try {
        if (this.isDown) { if (t.move) t.move(ev); }
        else if (t.hover && !this.ctrlMove) t.hover(ev);
      } catch (err) { console.error(err); }
    },

    onUp(e) {
      try { IMG.Engine.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (this.panning) { this.panning = null; this.updateCursor(); return; }
      if (!this.isDown) return;
      this.isDown = false;
      const t = this.routed || this.active;
      this.routed = null;
      if (t && t.up && IMG.app.doc) {
        try { t.up(this.ev(e)); } catch (err) { console.error(err); IMG.UI.toast('Erro na ferramenta: ' + err.message, 'error'); }
      }
      this.updateCursor();
    },

    /** Ativa a ferramenta de um grupo (ou alterna para a próxima do grupo). */
    pickGroup(g, cycle) {
      const list = this.groupTools(g);
      if (!list.length) return;
      if (cycle) {
        const cur = list.includes(this.activeId) ? this.activeId : this.currentOf(g);
        this.set(list[(list.indexOf(cur) + 1) % list.length]);
      } else this.set(this.currentOf(g));
    },

    /** 1–9 = 10–90%, 0 = 100%; dois dígitos rápidos dão o valor exato (4 e 5 = 45%). */
    numberKey(k, shift) {
      const now = Date.now(), quick = this._numT && now - this._numT < 600 && this._numK;
      const v = quick ? U.clamp(+(this._numK + k), 1, 100) : k === '0' ? 100 : +k * 10;
      this._numK = quick ? null : k; this._numT = now;
      const t = this.active, o = t ? this.o(t.id) : null;
      if (o && 'opacity' in o) {
        const key = shift && 'flow' in o ? 'flow' : shift && 'strength' in o ? 'strength' : 'opacity';
        this.setOpt(t.id, key, v); IMG.UI.renderOptions(); IMG.UI.setHint((key === 'flow' ? 'Fluxo' : key === 'strength' ? 'Intensidade' : 'Opacidade') + ': ' + v + '%');
        return;
      }
      const doc = IMG.app.doc, sel = IMG.Layers.selectedLayers(doc).filter((L) => !L.isBg && !IMG.Layers.isLocked(L));
      if (!sel.length) return;
      sel.forEach((L) => { if (shift) L.fill = v / 100; else L.opacity = v / 100; });
      IMG.Engine.invalidate(); IMG.bus.emit('layers:props', doc);
      IMG.UI.setHint((shift ? 'Preenchimento' : 'Opacidade') + ' da camada: ' + v + '%');
      clearTimeout(this._numC); this._numC = setTimeout(() => IMG.commit(shift ? 'Preenchimento' : 'Opacidade'), 650);
    },

    onKeyDown(e) {
      const UI = IMG.UI;
      if (UI.modalCount > 0) return;
      const combo = UI.keyOf(e);
      if (e.key === 'Control' || e.key === 'Meta') { if (!this.isDown && this._ctrlMoveOK() && IMG.app.doc && !U.isTyping(e.target)) { this.ctrlMove = true; this.updateCursor(); } }
      if (!combo) return;
      const typing = U.isTyping(e.target);
      if (typing) {
        // Atalhos de arquivo continuam valendo mesmo com foco em um campo.
        if (['ctrl+s', 'ctrl+shift+s', 'ctrl+o'].includes(combo)) { e.preventDefault(); UI.run(UI.keymap[combo]); }
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.isDown) this.spaceDrag = true;
        if (!this.isDown) {
          this.space = true;
          this.spaceZoom = e.ctrlKey || e.metaKey ? 'in' : e.altKey ? 'out' : null;
          this.updateCursor();
        }
        return;
      }
      const t = this.active;
      if (IMG.app.doc && t && t.onKey && t.onKey(e, combo)) { e.preventDefault(); return; }
      const cmd = UI.keymap[combo];
      if (cmd) { e.preventDefault(); UI.closeMenus(); UI.run(cmd); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Teclas numéricas (como no Photoshop): opacidade da ferramenta, se ela tiver; senão, da camada (Shift: fluxo / preenchimento).
      const dm = /^(?:Digit|Numpad)([0-9])$/.exec(e.code || '');
      if (dm && IMG.app.doc && !(t && t.modal)) { e.preventDefault(); this.numberKey(dm[1], e.shiftKey); return; }
      // Atalhos de ferramenta (uma letra). Shift+letra alterna entre as ferramentas do grupo.
      const shift = e.shiftKey;
      const letter = combo.replace('shift+', '');
      if (letter.length !== 1) return;
      if (t && t.modal) return;
      const g = GROUPS.find((gr) => gr.key === letter && this.groupTools(gr).length);
      if (!g) return;
      e.preventDefault();
      const prefShift = IMG.app.prefs.shiftToolSwitch !== false;
      const inGroup = this.groupOf(this.activeId) === g;
      this.pickGroup(g, shift || (!prefShift && inGroup));
    },

    onKeyUp(e) {
      if (e.code === 'Space') this.spaceDrag = false;
      if (this.active && this.active.onKeyUp && IMG.app.doc) { try { this.active.onKeyUp(e); } catch (err) { console.error(err); } }
      if (e.code === 'Space' && this.space) { this.space = false; this.spaceZoom = null; this.updateCursor(); }
      if ((e.key === 'Control' || e.key === 'Meta') && this.ctrlMove) { this.ctrlMove = false; this.updateCursor(); }
      if (this.space && (e.key === 'Control' || e.key === 'Alt')) { this.spaceZoom = null; this.updateCursor(); }
    }
  });
  void Tools;
})();
