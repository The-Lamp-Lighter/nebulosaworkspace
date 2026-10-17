/* ==========================================================================
   Imaginarium — gerenciador de interface
   Comandos e atalhos, barra de menus, menus de contexto, diálogos, controles
   de formulário, barra de opções, barra de ferramentas, abas de documentos,
   painéis acopláveis, barra de status e avisos.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;

  const KEY_LABELS = {
    ctrl: U.isMac ? '⌘' : 'Ctrl', alt: U.isMac ? '⌥' : 'Alt', shift: 'Shift', plus: '+', minus: '−', delete: 'Del', backspace: 'Backspace',
    escape: 'Esc', enter: 'Enter', tab: 'Tab', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', space: 'Espaço'
  };

  const UI = (IMG.UI = {
    commands: {},
    keymap: {},
    panels: {},
    panelOrder: [],
    panelEls: {},
    modalCount: 0,
    dialogs: [],
    menuStack: [],
    menuOpen: false,
    menuDefs: [],
    root: null,

    /* ==================================================================
       Comandos e atalhos
       ================================================================== */
    cmd(id, def) {
      def.id = id;
      this.commands[id] = def;
      (def.keys || []).forEach((k) => { this.keymap[k] = id; });
      return def;
    },

    run(id, arg) {
      const c = this.commands[id];
      if (!c) { console.warn('Comando inexistente:', id); return; }
      if (c.enabled && !c.enabled()) return;
      // ferramentas com edição em andamento (transformação, texto, recorte) decidem o que fazer antes do comando
      const tool = IMG.Tools && IMG.Tools.active;
      if (tool && tool.beforeCommand && tool.beforeCommand(id) === true) return;
      try {
        const r = c.run(arg);
        if (r && typeof r.catch === 'function') r.catch((err) => this.fail(err));
      } catch (err) { this.fail(err); }
    },

    fail(err) {
      if (err && err.name === 'AbortError') return;
      console.error(err);
      this.toast('Algo deu errado: ' + ((err && err.message) || err), 'error');
    },

    keyOf(e) {
      let k = e.key;
      if (!k || k === 'Control' || k === 'Shift' || k === 'Alt' || k === 'Meta' || k === 'Dead') return '';
      const code = e.code || '';
      if (/^Key[A-Z]$/.test(code)) k = code.slice(3).toLowerCase();
      else if (/^Digit\d$/.test(code)) k = code.slice(5);
      else if (code === 'NumpadAdd' || k === '+' || k === '=') k = 'plus';
      else if (code === 'NumpadSubtract' || k === '-' || k === '_') k = 'minus';
      else if (k === ' ') k = 'space';
      else k = k.toLowerCase();
      return (e.ctrlKey || e.metaKey ? 'ctrl+' : '') + (e.altKey ? 'alt+' : '') + (e.shiftKey ? 'shift+' : '') + k;
    },

    keyLabel(combo) {
      if (!combo) return '';
      return combo.split('+').map((p) => KEY_LABELS[p] || (p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1))).join(U.isMac ? '' : '+');
    },

    /* ==================================================================
       Menus
       ================================================================== */
    setMenus(defs) {
      this.menuDefs = defs;
      const nav = U.$('#menus');
      U.clear(nav);
      this.topButtons = defs.map((m, i) => {
        const b = el('button.menu-top', {
          text: m.label, type: 'button',
          on: {
            pointerdown: (e) => { e.preventDefault(); e.stopPropagation(); if (this.menuOpen && this.topIndex === i) this.closeMenus(); else this.openTop(i); },
            pointerenter: () => { if (this.menuOpen && this.topIndex != null && this.topIndex !== i) this.openTop(i); }
          }
        });
        nav.appendChild(b);
        return b;
      });
    },

    openTop(i) {
      this.closeMenus();
      const b = this.topButtons[i], r = b.getBoundingClientRect();
      b.classList.add('open');
      this.menuOpen = true; this.topIndex = i;
      this.showMenu(this.menuDefs[i].items, r.left, r.bottom, 0);
    },

    closeMenus() {
      while (this.menuStack.length) this.menuStack.pop().remove();
      if (this.topButtons) this.topButtons.forEach((b) => b.classList.remove('open'));
      this.menuOpen = false; this.topIndex = null;
      clearTimeout(this._subTimer);
    },

    _hasItems(items) {
      try {
        const list = typeof items === 'function' ? items() : items;
        return list.some((it) => it && it !== '-' && (typeof it === 'string' ? !!this.commands[it] : (!it.items || this._hasItems(it.items))));
      } catch (e) { return false; }
    },

    contextMenu(x, y, items) {
      this.closeMenus();
      this.menuOpen = true; this.topIndex = null;
      this.showMenu(items, x, y, 0);
    },

    showMenu(items, x, y, level, anchor) {
      while (this.menuStack.length > level) this.menuStack.pop().remove();
      const menu = el('div.menu', { role: 'menu' });
      items = typeof items === 'function' ? items() : items;
      let lastSep = true;
      items.forEach((it) => {
        if (!it) return;
        if (it === '-') { if (!lastSep) menu.appendChild(el('div.menu-sep')); lastSep = true; return; }
        const def = typeof it === 'string' ? this.commands[it] : it;
        if (!def) return;
        if (def.visible && !def.visible()) return;
        if (def.items && !this._hasItems(def.items)) return;
        lastSep = false;
        const enabled = def.items ? (def.enabled ? !!def.enabled() : true) : def.enabled ? !!def.enabled() : true;
        const checked = def.checked ? !!def.checked() : false;
        const hint = def.hint || (def.keys && def.keys.length ? this.keyLabel(def.keys[0]) : '');
        const row = el('div.menu-item' + (enabled ? '' : '.disabled') + (def.icon && checked ? '.checked' : ''), { role: 'menuitem' },
          el('span.mi-check', { html: def.icon ? IMG.icon(def.icon, 15) : checked ? IMG.icon('check', 14) : '' }),
          el('span.mi-label', { text: (def.label2 && def.label2()) || def.label }),
          el('span.mi-hint' + (def.hint ? '.alt' : ''), { text: hint }),
          def.items ? el('span.mi-arrow', { html: IMG.icon('chevronRight', 12) }) : null);
        row.addEventListener('pointerenter', () => {
          clearTimeout(this._subTimer);
          U.$$('.menu-item.hover', menu).forEach((n) => n.classList.remove('hover'));
          row.classList.add('hover');
          this._subTimer = setTimeout(() => {
            while (this.menuStack.length > level + 1) this.menuStack.pop().remove();
            if (def.items && enabled) {
              const r = row.getBoundingClientRect();
              this.showMenu(def.items, r.right - 2, r.top - 5, level + 1, r);
            }
          }, def.items ? 90 : 220);
        });
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!enabled || def.items) return;
          this.closeMenus();
          if (typeof it === 'string') this.run(it);
          else { try { const r = def.run(); if (r && r.catch) r.catch((err) => this.fail(err)); } catch (err) { this.fail(err); } }
        });
        menu.appendChild(row);
      });
      if (menu.lastChild && menu.lastChild.classList.contains('menu-sep')) menu.lastChild.remove();
      this.root.appendChild(menu);
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      const vw = window.innerWidth, vh = window.innerHeight;
      if (x + mw > vw - 4) x = anchor ? Math.max(4, anchor.left - mw + 2) : Math.max(4, vw - mw - 4);
      if (y + mh > vh - 4) y = Math.max(4, vh - mh - 4);
      menu.style.left = Math.round(x) + 'px'; menu.style.top = Math.round(y) + 'px';
      if (mh > vh - 8) { menu.style.maxHeight = vh - 8 + 'px'; menu.style.overflowY = 'auto'; }
      this.menuStack.push(menu);
      return menu;
    },

    /* ==================================================================
       Avisos (toasts) e indicador de ocupado
       ================================================================== */
    toast(msg, type) {
      const now = Date.now();
      if (this._lastToast && this._lastToast.msg === msg && now - this._lastToast.t < 1500) return;
      this._lastToast = { msg, t: now };
      let box = U.$('#toasts');
      if (!box) { box = el('div#toasts'); document.body.appendChild(box); }
      const t = el('div.toast' + (type ? '.' + type : ''), { text: msg, role: 'status' });
      box.appendChild(t);
      while (box.children.length > 4) box.firstChild.remove();
      setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, type === 'error' ? 5200 : 3200);
    },

    busy(text) {
      const b = el('div.busy', el('div.busy-box', el('span.spinner'), el('span', { text: text || 'Processando…' })));
      document.body.appendChild(b);
      return () => b.remove();
    },

    /* ==================================================================
       Diálogos
       ================================================================== */
    dialog(o) {
      const back = el('div.modal-back' + (o.clear ? '.clear' : ''));
      const body = el('div.dialog-body' + (o.flush ? '.flush' : ''));
      const foot = el('div.dialog-foot');
      const head = el('div.dialog-head', el('span.dialog-title', { text: o.title || IMG.NAME }),
        el('button.dialog-x', { type: 'button', title: 'Fechar', html: IMG.icon('close', 14), on: { click: () => dlg.close() } }));
      const win = el('div.dialog' + (o.className ? '.' + o.className : ''), { role: 'dialog', 'aria-modal': 'true', style: { width: (o.width || 380) + 'px' } }, head, body, foot);
      if (o.body) (Array.isArray(o.body) ? o.body : [o.body]).forEach((n) => n && body.appendChild(n));
      let closed = false, primaryBtn = null;
      const dlg = {
        el: win, body, foot,
        close: (value) => {
          if (closed) return;
          closed = true;
          back.remove();
          this.modalCount--;
          const i = this.dialogs.indexOf(dlg); if (i >= 0) this.dialogs.splice(i, 1);
          if (o.onClose) o.onClose(value, dlg);
        },
        onKey: (e) => {
          if (e.key === 'Escape') { e.preventDefault(); dlg.close(); }
          else if (e.key === 'Enter' && primaryBtn && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
            e.preventDefault();
            if (U.isTyping(e.target)) e.target.blur();
            primaryBtn.click();
          }
        }
      };
      const buttons = o.buttons || [{ label: 'Fechar', primary: true }];
      if (o.footLeft) foot.appendChild(el('div.dialog-foot-left', o.footLeft));
      buttons.forEach((b) => {
        const btn = el('button.btn' + (b.primary ? '.primary' : '') + (b.danger ? '.danger' : ''), { type: 'button', text: b.label });
        btn.addEventListener('click', () => {
          let r;
          try { r = b.onClick ? b.onClick(dlg) : undefined; } catch (err) { this.fail(err); return; }
          if (r !== false) dlg.close(b.value !== undefined ? b.value : b.primary ? 'ok' : undefined);
        });
        if (b.primary) primaryBtn = btn;
        foot.appendChild(btn);
      });
      if (!buttons.length && !o.footLeft) foot.style.display = 'none';

      // arrastar pelo título
      let ox = 0, oy = 0;
      head.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.dialog-x')) return;
        const sx = e.clientX - ox, sy = e.clientY - oy;
        U.drag(e, (ev) => { ox = ev.clientX - sx; oy = ev.clientY - sy; win.style.transform = 'translate(' + ox + 'px,' + oy + 'px)'; });
      });
      if (o.offset) { ox = o.offset.x || 0; oy = o.offset.y || 0; win.style.transform = 'translate(' + ox + 'px,' + oy + 'px)'; }

      back.appendChild(win);
      this.closeMenus();
      this.root.appendChild(back);
      this.modalCount++;
      this.dialogs.push(dlg);
      setTimeout(() => {
        if (closed) return;
        const f = o.focus ? U.$(o.focus, win) : U.$('input:not([type=range]):not([type=checkbox]), select, textarea', body);
        if (f && !o.noFocus) { f.focus(); if (f.select) f.select(); } else if (primaryBtn) primaryBtn.focus();
      }, 30);
      return dlg;
    },

    alert(msg, title) {
      return new Promise((res) => this.dialog({ title: title || IMG.NAME, body: el('p.dialog-msg', { text: msg }), buttons: [{ label: 'OK', primary: true }], onClose: () => res() }));
    },
    confirm(msg, o = {}) {
      return new Promise((res) => this.dialog({
        title: o.title || 'Confirmar', body: el('p.dialog-msg', { text: msg }),
        buttons: [{ label: o.cancel || 'Cancelar', value: false }, { label: o.ok || 'OK', primary: true, danger: o.danger, value: true }],
        onClose: (v) => res(v === true)
      }));
    },
    /** Diálogo com várias respostas: buttons = [{label, value, primary, danger}] */
    choice(msg, buttons, title) {
      return new Promise((res) => this.dialog({ title: title || IMG.NAME, body: el('p.dialog-msg', { text: msg }), buttons, width: 420, onClose: (v) => res(v) }));
    },
    prompt(title, label, value) {
      return new Promise((res) => {
        const inp = el('input.inp', { type: 'text', value: value || '' });
        this.dialog({
          title, body: this.row(label, inp), width: 360,
          buttons: [{ label: 'Cancelar', value: null }, { label: 'OK', primary: true, onClick: (d) => { d.close(inp.value.trim() || null); return false; } }],
          onClose: (v) => res(v == null ? null : v)
        });
      });
    },

    /* ==================================================================
       Popover (flutuante ancorado)
       ================================================================== */
    popover(anchor, content, o = {}) {
      this.closePopover();
      const pop = el('div.popover' + (o.className ? '.' + o.className : ''), content);
      this.root.appendChild(pop);
      const r = anchor.getBoundingClientRect();
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      let x = o.align === 'right' ? r.right - pw : r.left, y = r.bottom + 6;
      if (x + pw > window.innerWidth - 6) x = window.innerWidth - pw - 6;
      if (y + ph > window.innerHeight - 6) y = Math.max(6, r.top - ph - 6);
      pop.style.left = Math.max(6, Math.round(x)) + 'px'; pop.style.top = Math.round(y) + 'px';
      const onDown = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) this.closePopover(); };
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.closePopover(); } };
      setTimeout(() => { document.addEventListener('pointerdown', onDown, true); }, 0);
      document.addEventListener('keydown', onKey, true);
      this._pop = { pop, anchor, close: () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey, true); pop.remove(); if (o.onClose) o.onClose(); } };
      return this._pop;
    },
    closePopover() { if (this._pop) { const p = this._pop; this._pop = null; p.close(); } },

    /** Abre o seletor de cores em um popover. */
    pickColor(anchor, color, onInput, o = {}) {
      let last = color;
      const picker = new IMG.ColorPicker({ color: color || '#000000', compact: true, onChange: (hex) => { last = hex; onInput(hex, false); } });
      const extra = el('div.pop-actions');
      if (o.nullable) extra.appendChild(this.btn('Sem cor', () => { last = null; onInput(null, true); changed = false; this.closePopover(); }));
      extra.appendChild(this.btn('Cor do primeiro plano', () => { picker.set(IMG.app.fg); last = IMG.app.fg; onInput(last, false); }));
      let changed = true;
      const box = el('div.pop-color', picker.el, extra);
      const pop = this.popover(anchor, box, { align: o.align, onClose: () => { if (changed && last !== color && last != null) onInput(last, true); if (o.onClose) o.onClose(last); } });
      picker.layout();
      return pop;
    },

    /* ==================================================================
       Controles de formulário
       ================================================================== */
    btn(label, onClick, o = {}) {
      const b = el('button.btn' + (o.primary ? '.primary' : '') + (o.small ? '.small' : ''), { type: 'button', title: o.title });
      if (o.icon) b.appendChild(IMG.iconEl(o.icon, 15));
      if (label) b.appendChild(el('span', { text: label }));
      if (onClick) b.addEventListener('click', onClick);
      return b;
    },
    iconBtn(icon, title, onClick, o = {}) {
      const b = el('button.icon-btn' + (o.active ? '.active' : ''), { type: 'button', title, 'aria-label': title, html: IMG.icon(icon, o.size || 16) });
      if (onClick) b.addEventListener('click', onClick);
      return b;
    },
    row(label, ...controls) {
      return el('div.form-row', el('label.form-label', { text: label }), el('div.form-ctl', controls));
    },

    /** Campo numérico. Retorna { el, input, get(), set(v) }. */
    num(o) {
      const dec = o.decimals != null ? o.decimals : (String(o.step || 1).split('.')[1] || '').length;
      const fmt = (v) => String(U.round(v, dec)).replace('.', ',');
      let value = o.value == null ? 0 : o.value;
      const input = el('input.num-input', { type: 'text', inputmode: 'decimal', value: o.value == null ? '' : fmt(value), spellcheck: false, autocomplete: 'off', 'aria-label': o.label || o.title, placeholder: o.placeholder || '' });
      const wrap = el('span.num' + (o.className ? '.' + o.className : ''), { style: o.width ? { width: o.width + 'px' } : null, title: o.title }, input, o.unit ? el('span.num-unit', { text: o.unit }) : null);
      const parse = () => {
        let v = parseFloat(input.value.replace(',', '.'));
        if (!isFinite(v)) return value;
        if (o.min != null) v = Math.max(o.min, v);
        if (o.max != null) v = Math.min(o.max, v);
        return U.round(v, Math.max(dec, 0));
      };
      const commit = (final) => {
        const v = parse();
        const changed = v !== value;
        value = v; input.value = fmt(v);
        if (changed && o.onInput) o.onInput(v);
        if (final && o.onChange) o.onChange(v);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commit(true); input.blur(); }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const st = (o.step || 1) * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
          input.value = String(parse() + st); commit(true); input.select();
        } else if (e.key === 'Escape') { input.value = fmt(value); input.blur(); e.stopPropagation(); }
      });
      input.addEventListener('focus', () => setTimeout(() => input.select(), 0));
      input.addEventListener('change', () => commit(true));
      return { el: wrap, input, get: () => value, set: (v) => { value = v; if (document.activeElement !== input) input.value = fmt(v); } };
    },

    /** Controle deslizante com campo numérico (para painéis e diálogos). */
    slider(o) {
      const pow = o.pow || 1;
      const toT = (v) => Math.pow((v - o.min) / (o.max - o.min), 1 / pow);
      const fromT = (t) => { const v = o.min + (o.max - o.min) * Math.pow(t, pow); const st = o.step || 1; return U.clamp(Math.round(v / st) * st, o.min, o.max); };
      const range = el('input.range', { type: 'range', min: 0, max: 1000, step: 1, 'aria-label': o.label });
      range.value = Math.round(toT(o.value) * 1000);
      const paint = () => range.style.setProperty('--fill', range.value / 10 + '%');
      const num = this.num({ value: o.value, min: o.min, max: o.max, step: o.step, unit: o.unit, decimals: o.decimals, width: o.numWidth || 58, label: o.label,
        onInput: (v) => { range.value = Math.round(toT(v) * 1000); paint(); if (o.onInput) o.onInput(v); },
        onChange: (v) => { if (o.onChange) o.onChange(v); } });
      range.addEventListener('input', () => { const v = fromT(range.value / 1000); num.set(v); paint(); if (o.onInput) o.onInput(v); });
      range.addEventListener('change', () => { if (o.onChange) o.onChange(fromT(range.value / 1000)); });
      range.addEventListener('dblclick', () => { if (o.def != null) { ctl.set(o.def); if (o.onInput) o.onInput(o.def); if (o.onChange) o.onChange(o.def); } });
      paint();
      const node = el('div.slider-row' + (o.stack ? '.stack' : ''), o.label ? el('label.slider-label', { text: o.label }) : null, range, num.el);
      const ctl = { el: node, get: () => num.get(), set: (v) => { num.set(v); range.value = Math.round(toT(v) * 1000); paint(); } };
      return ctl;
    },

    /** Campo compacto (rótulo + número + deslizante em popover) para a barra de opções. */
    numPop(o) {
      const num = this.num({ value: o.value, min: o.min, max: o.max, step: o.step, unit: o.unit, decimals: o.decimals, width: o.width || 62, label: o.label,
        onInput: (v) => { if (o.onInput) o.onInput(v); }, onChange: (v) => { if (o.onChange) o.onChange(v); } });
      const caret = el('button.num-caret', { type: 'button', title: 'Ajustar ' + (o.label || ''), html: IMG.icon('chevronDown', 11) });
      const label = el('span.opt-label.scrub', { text: o.label, title: 'Arraste para ajustar' });
      const node = el('span.opt-field', label, el('span.num-group', num.el, caret));
      caret.addEventListener('click', () => {
        if (this._pop && this._pop.anchor === node) { this.closePopover(); return; }
        const s = this.slider({ value: num.get(), min: o.min, max: o.max, step: o.step, pow: o.pow, unit: o.unit, decimals: o.decimals, def: o.def,
          onInput: (v) => { num.set(v); if (o.onInput) o.onInput(v); }, onChange: (v) => { if (o.onChange) o.onChange(v); } });
        this.popover(node, el('div.pop-slider', s.el));
      });
      label.addEventListener('pointerdown', (e) => {
        const x0 = e.clientX, v0 = num.get(), span = o.max - o.min;
        let moved = false;
        U.drag(e, (ev) => {
          const d = ev.clientX - x0;
          if (Math.abs(d) > 2) moved = true;
          const st = o.step || 1;
          let v = v0 + (d / 220) * span * (ev.shiftKey ? 0.2 : 1);
          v = U.clamp(Math.round(v / st) * st, o.min, o.max);
          num.set(v); if (o.onInput) o.onInput(v);
        }, () => { if (moved && o.onChange) o.onChange(num.get()); });
      });
      return { el: node, get: num.get, set: num.set };
    },

    select(options, value, onChange, o = {}) {
      const s = el('select.sel', { title: o.title, 'aria-label': o.label || o.title, style: o.width ? { width: o.width + 'px' } : null });
      const fill = (opts) => {
        U.clear(s);
        opts.forEach((op) => {
          if (!op) { s.appendChild(el('option', { disabled: true, text: '──────────' })); return; }
          const [v, l] = Array.isArray(op) ? op : [op, op];
          s.appendChild(el('option', { value: String(v), text: l }));
        });
      };
      fill(options);
      s.value = String(value);
      s.addEventListener('change', () => { onChange(s.value); if (!o.keepFocus) s.blur(); });
      return { el: s, get: () => s.value, set: (v) => { s.value = String(v); }, fill };
    },

    check(label, value, onChange, o = {}) {
      const input = el('input', { type: 'checkbox' });
      input.checked = !!value;
      input.addEventListener('change', () => { onChange(input.checked); input.blur(); });
      const node = el('label.chk', { title: o.title }, input, el('span.chk-box', { html: IMG.icon('check', 12) }), el('span.chk-label', { text: label }));
      return { el: node, get: () => input.checked, set: (v) => { input.checked = !!v; } };
    },

    colorBtn(color, onChange, o = {}) {
      let value = color;
      const sw = el('span.color-sw');
      const b = el('button.color-btn', { type: 'button', title: o.title || 'Escolher cor', 'aria-label': o.title || 'Escolher cor' }, sw);
      const paint = () => { sw.style.background = value || ''; sw.classList.toggle('none', !value); };
      paint();
      b.addEventListener('click', () => {
        if (this._pop && this._pop.anchor === b) { this.closePopover(); return; }
        this.pickColor(b, value, (hex, final) => { value = hex; paint(); onChange(hex, final); }, { nullable: o.nullable, align: o.align });
      });
      return { el: b, get: () => value, set: (v) => { value = v; paint(); } };
    },

    /** Botões segmentados: options = [{value, icon, label, title}] */
    seg(options, value, onChange, o = {}) {
      const node = el('span.seg');
      const btns = options.map((op) => {
        const b = el('button.seg-btn', { type: 'button', title: op.title || op.label, 'aria-label': op.title || op.label });
        if (op.icon) b.appendChild(IMG.iconEl(op.icon, 15));
        if (op.label && (!op.icon || o.labels)) b.appendChild(el('span', { text: op.label }));
        b.addEventListener('click', () => { if (o.multi) { const on = !b.classList.contains('active'); b.classList.toggle('active', on); onChange(op.value, on); } else { set(op.value); onChange(op.value); } });
        node.appendChild(b);
        return b;
      });
      const set = (v) => { if (o.multi) btns.forEach((b, i) => b.classList.toggle('active', !!(v && v[options[i].value]))); else btns.forEach((b, i) => b.classList.toggle('active', options[i].value === v)); };
      set(value);
      return { el: node, set };
    },

    /* ==================================================================
       Barra de opções (dinâmica por ferramenta)
       ================================================================== */
    renderOptions() {
      const bar = U.$('#optionsbar');
      this.closePopover();
      U.clear(bar);
      if (!bar._wheel) { bar._wheel = true; bar.addEventListener('wheel', (e) => { if (bar.scrollWidth > bar.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.target.closest('input,select')) { bar.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false }); }
      const T = IMG.Tools, t = T.active;
      if (!t) return;
      bar.appendChild(el('div.opt-tool', { title: t.name }, IMG.iconEl(t.icon, 17), el('span', { text: t.name })));
      const list = typeof t.options === 'function' ? t.options() : t.options || [];
      list.forEach((d) => { const n = d && this.optControl(t.id, d); if (n) bar.appendChild(n); });
      if (t.hint) bar.appendChild(el('span.opt-hint', { text: t.hint }));
    },

    optControl(id, d) {
      const T = IMG.Tools, o = T.o(id);
      const set = (v) => T.setOpt(id, d.key, v, true);
      const wrap = (node) => (d.label ? el('span.opt-field', el('span.opt-label', { text: d.label }), node) : node);
      switch (d.type) {
        case 'sep': return el('span.opt-sep');
        case 'label': case 'text': return el('span.opt-label' + (d.type === 'text' ? '.opt-text' : ''), { text: d.text });
        case 'slider': return this.numPop({ label: d.label, value: o[d.key], min: d.min, max: d.max, step: d.step, unit: d.unit, pow: d.pow, decimals: d.decimals, width: d.width, onInput: set, onChange: (v) => { set(v); if (d.onChange) d.onChange(v); } }).el;
        case 'number': return wrap(this.num({ value: d.value !== undefined ? d.value : o[d.key], min: d.min, max: d.max, step: d.step, unit: d.unit, decimals: d.decimals, width: d.width || 64, label: d.label, onChange: (v) => { if (d.key) set(v); if (d.onChange) d.onChange(v); } }).el);
        case 'select': return wrap(this.select(d.options, d.value !== undefined ? d.value : o[d.key], (v) => { if (d.numeric) v = parseFloat(v); if (d.key) set(v); if (d.onChange) d.onChange(v); }, { width: d.width, label: d.label }).el);
        case 'check': return this.check(d.label, d.value !== undefined ? d.value : o[d.key], (v) => { if (d.key) set(v); if (d.onChange) d.onChange(v); }, { title: d.title }).el;
        case 'color': return wrap(this.colorBtn(d.value !== undefined ? d.value : o[d.key], (hex, final) => { if (d.key) set(hex); if (d.onChange) d.onChange(hex, final); }, { nullable: d.nullable, title: d.title || d.label }).el);
        case 'seg': return wrap(this.seg(d.options, d.value !== undefined ? d.value : o[d.key], (v, on) => { if (d.key) set(v); if (d.onChange) d.onChange(v, on); }, { multi: d.multi, labels: d.labels }).el);
        case 'button': return this.btn(d.label, d.action || d.onClick, { primary: d.primary, icon: d.icon, title: d.title, small: true });
        case 'custom': return d.build();
        default: return null;
      }
    },

    /* ==================================================================
       Barra de ferramentas
       ================================================================== */
    renderToolbar() {
      const bar = U.$('#toolbar');
      U.clear(bar);
      const T = IMG.Tools;
      const grid = el('div.tool-grid');
      this._groupBtns = {};
      T.GROUPS.forEach((g) => {
        const list = T.groupTools(g);
        if (!list.length) return;
        const b = el('button.tool-btn' + (list.length > 1 ? '.multi' : ''), { type: 'button', data: { group: g.id } });
        const paint = () => {
          const id = T.currentOf(g), t = T.defs[id];
          b.innerHTML = IMG.icon(t.icon, 19);
          b.title = t.name + '  (' + g.key.toUpperCase() + ')' + (list.length > 1 ? ' — clique com o botão direito para mais ferramentas' : '');
          b.setAttribute('aria-label', t.name);
          b.dataset.tool = id;
        };
        paint();
        b._paint = paint;
        let timer = 0, opened = false;
        const flyout = () => {
          opened = true;
          const r = b.getBoundingClientRect();
          const items = T.groupTools(g).map((id) => ({ label: T.defs[id].name, icon: T.defs[id].icon, hint: g.key.toUpperCase(), checked: () => T.activeId === id, run: () => { if (!(T.active && T.active.modal)) T.set(id); } }));
          this.contextMenu(r.right + 2, r.top, items);
        };
        b.addEventListener('pointerdown', (e) => { if (e.button !== 0 || list.length < 2) return; opened = false; clearTimeout(timer); timer = setTimeout(flyout, 380); });
        b.addEventListener('pointerup', () => clearTimeout(timer));
        b.addEventListener('pointerleave', () => clearTimeout(timer));
        b.addEventListener('click', () => { clearTimeout(timer); if (opened) { opened = false; return; } if (T.active && T.active.modal) return; T.pickGroup(g, false); });
        b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (list.length > 1) flyout(); });
        this._groupBtns[g.id] = b;
        grid.appendChild(b);
      });
      bar.appendChild(grid);

      const fg = el('button.cw-fg', { type: 'button', title: 'Cor do primeiro plano' });
      const bg = el('button.cw-bg', { type: 'button', title: 'Cor do plano de fundo' });
      fg.addEventListener('click', () => this.colorDialog('fg'));
      bg.addEventListener('click', () => this.colorDialog('bg'));
      const well = el('div.color-well', bg, fg,
        el('button.cw-swap', { type: 'button', title: 'Trocar cores (X)', html: IMG.icon('swap', 12), on: { click: () => IMG.app.swapColors() } }),
        el('button.cw-reset', { type: 'button', title: 'Cores padrão (D)', on: { click: () => IMG.app.resetColors() } }, el('i'), el('i')));
      bar.appendChild(well);
      const qm = el('button.tool-btn.qm-btn', { type: 'button', title: 'Editar no modo de máscara rápida (Q)', html: IMG.icon('mask', 18), on: { click: () => this.run('select.quickMask') } });
      bar.appendChild(qm);
      this._qmBtn = qm;
      this._fgEl = fg; this._bgEl = bg;
      this.updateColors();
      this.updateToolbar();
      this.layoutToolbar();
    },
    updateToolbar() {
      const T = IMG.Tools, id = T.activeId;
      const g = T.groupOf(id);
      Object.keys(this._groupBtns || {}).forEach((gid) => {
        const b = this._groupBtns[gid];
        if (g && gid === g.id && !T.defs[id].hidden) b._paint();
        b.classList.toggle('active', !!g && gid === g.id);
      });
      if (this._qmBtn) this._qmBtn.classList.toggle('active', !!(IMG.app.doc && IMG.app.doc.quickMask));
    },
    /** Seletor de cores do primeiro plano / fundo (diálogo como no Photopea). */
    colorDialog(which) {
      const app = IMG.app, orig = which === 'fg' ? app.fg : app.bg;
      const set = (hex) => (which === 'fg' ? app.setFg(hex) : app.setBg(hex));
      const picker = new IMG.ColorPicker({ color: orig, full: true, onChange: (hex) => set(hex) });
      picker.el.classList.add('cp-dialog');
      const prevBox = el('div.cp-compare', el('span', { style: { background: orig }, title: 'Atual' }));
      this.dialog({ title: which === 'fg' ? 'Seletor de cores (primeiro plano)' : 'Seletor de cores (fundo)', width: 320, clear: true, body: [picker.el, prevBox],
        footLeft: [this.btn('Adicionar às amostras', () => { if (IMG.Swatches) IMG.Swatches.add(which === 'fg' ? app.fg : app.bg); }, { small: true })],
        buttons: [{ label: 'Cancelar', onClick: () => set(orig) }, { label: 'OK', primary: true }] });
      const prevOverride = IMG.Tools.overrideClick;
      IMG.Tools.overrideClick = (ev) => { const doc = app.doc; if (!doc) return; const c = IMG.Engine.sample(doc, ev.x, ev.y, 1); if (c) { const hex = U.rgbToHex(c.r, c.g, c.b); picker.set(hex); set(hex); } };
      const d = this.dialogs[this.dialogs.length - 1];
      const oc = d.close; d.close = (v) => { IMG.Tools.overrideClick = prevOverride; oc(v); };
      setTimeout(() => picker.layout(), 0);
    },
    updateColors() {
      if (!this._fgEl) return;
      this._fgEl.style.background = IMG.app.fg; this._bgEl.style.background = IMG.app.bg;
    },
    layoutToolbar() {
      const bar = U.$('#toolbar');
      if (!bar) return;
      const n = U.$$('.tool-btn', bar).length, seps = U.$$('.tool-sep', bar).length;
      const need = n * 32 + seps * 9 + 96;
      bar.classList.toggle('two', bar.clientHeight > 0 && need > bar.clientHeight);
    },

    /* ==================================================================
       Abas de documentos
       ================================================================== */
    renderTabs() {
      const bar = U.$('#doctabs');
      U.clear(bar);
      const app = IMG.app;
      app.docs.forEach((d) => {
        const tab = el('div.doc-tab' + (d === app.doc ? '.active' : ''), { title: d.name + ' — ' + d.width + ' × ' + d.height + ' px' },
          el('span.doc-name', { text: d.name + (d.dirty ? ' •' : '') }),
          el('button.doc-x', { type: 'button', title: 'Fechar', html: IMG.icon('close', 11), on: { click: (e) => { e.stopPropagation(); IMG.Files.closeDoc(d); } } }));
        tab.addEventListener('pointerdown', (e) => { if (e.button === 1) { e.preventDefault(); IMG.Files.closeDoc(d); } else if (e.button === 0 && !e.target.closest('.doc-x')) app.setDoc(d); });
        bar.appendChild(tab);
      });
      document.body.classList.toggle('no-doc', !app.doc);
      document.title = (app.doc ? app.doc.name + (app.doc.dirty ? ' • ' : ' ') + '— ' : '') + 'Imaginarium';
    },

    /* ==================================================================
       Painéis acopláveis
       ================================================================== */
    registerPanel(def) {
      this.panels[def.id] = def;
      this.panelOrder.push(def.id);
    },

    defaultDock() {
      return {
        width: 302,
        groups: [
          { tabs: ['color', 'swatches', 'navigator', 'histogram', 'info'], active: 'color', size: 270, collapsed: false },
          { tabs: ['properties', 'adjustments', 'character', 'paragraph', 'brush'], active: 'properties', size: 200, collapsed: false },
          { tabs: ['layers', 'channels', 'paths', 'history', 'library'], active: 'layers', size: 310, collapsed: false }
        ]
      };
    },

    loadDock() {
      const def = this.defaultDock();
      const saved = U.store.get('dock', null);
      let d = saved && Array.isArray(saved.groups) ? saved : def;
      // saneamento: remove painéis desconhecidos; painéis novos entram no primeiro grupo
      const known = new Set(this.panelOrder), seen = new Set();
      d.groups.forEach((g) => { g.tabs = (g.tabs || []).filter((t) => known.has(t) && !seen.has(t) && seen.add(t)); if (!g.tabs.includes(g.active)) g.active = g.tabs[0]; });
      d.groups = d.groups.filter((g) => g.tabs.length);
      d.hidden = (d.hidden || []).filter((t) => known.has(t) && !seen.has(t));
      d.hidden.forEach((t) => seen.add(t));
      // painéis que ainda não estavam no layout salvo: entram onde o layout padrão os coloca; os demais ficam ocultos (menu Janela)
      const defTabs = def.groups.map((g) => g.tabs);
      this.panelOrder.forEach((t) => {
        if (seen.has(t)) return;
        const gi = defTabs.findIndex((tabs) => tabs.includes(t));
        if (gi < 0) { d.hidden.push(t); return; }
        if (!d.groups.length) d.groups.push({ tabs: [], active: t, size: 240 });
        d.groups[Math.min(gi, d.groups.length - 1)].tabs.push(t);
      });
      d.width = U.clamp(d.width || 302, 240, 560);
      this.dock = d;
    },
    saveDock() { U.store.set('dock', this.dock); },
    resetDock() { U.store.del('dock'); this.loadDock(); document.body.classList.remove('hide-dock'); this.renderDock(); this.saveDock(); },

    panelVisible(id) { return this.dock.groups.some((g) => g.tabs.includes(id)); },
    panelShown(id) { return this.dock.groups.some((g) => !g.collapsed && g.active === id) && !document.body.classList.contains('hide-dock'); },
    togglePanel(id) {
      const d = this.dock;
      const g = d.groups.find((gr) => gr.tabs.includes(id));
      if (g) {
        if (g.active !== id || g.collapsed) { g.active = id; g.collapsed = false; }
        else { g.tabs.splice(g.tabs.indexOf(id), 1); g.active = g.tabs[0]; d.hidden.push(id); if (!g.tabs.length) d.groups.splice(d.groups.indexOf(g), 1); }
      } else {
        d.hidden = d.hidden.filter((t) => t !== id);
        if (!d.groups.length) d.groups.push({ tabs: [], active: id, size: 260 });
        const tg = d.groups[0]; tg.tabs.push(id); tg.active = id; tg.collapsed = false;
      }
      document.body.classList.remove('hide-dock');
      this.renderDock(); this.saveDock();
    },
    showPanel(id) { if (!this.panelShown(id)) { const g = this.dock.groups.find((gr) => gr.tabs.includes(id)); if (g) { g.active = id; g.collapsed = false; this.renderDock(); } else this.togglePanel(id); } },

    panelEl(id) {
      if (this.panelEls[id]) return this.panelEls[id];
      const def = this.panels[id];
      const node = el('div.panel.panel-' + id);
      this.panelEls[id] = node;
      try { def.build(node); } catch (err) { console.error(err); node.textContent = 'Falha ao montar o painel.'; }
      return node;
    },

    renderDock() {
      const dockEl = U.$('#dock'), d = this.dock;
      dockEl.style.width = d.width + 'px';
      // preserva os elementos dos painéis (não recria)
      Object.values(this.panelEls).forEach((n) => n.remove());
      U.clear(dockEl);
      d.groups.forEach((g, gi) => {
        if (gi > 0) {
          const split = el('div.pgroup-split', { data: { gi } });
          split.addEventListener('pointerdown', (e) => this._dragSplit(e, gi));
          dockEl.appendChild(split);
        }
        const head = el('div.pgroup-head', { data: { gi } });
        g.tabs.forEach((id) => {
          const def = this.panels[id];
          const tab = el('button.ptab' + (id === g.active ? '.active' : ''), { type: 'button', data: { panel: id }, title: def.title }, el('span', { text: def.title }));
          tab.addEventListener('pointerdown', (e) => this._dragTab(e, id, gi));
          head.appendChild(tab);
        });
        head.appendChild(el('span.pgroup-fill'));
        head.appendChild(el('button.pgroup-btn', { type: 'button', title: g.collapsed ? 'Expandir' : 'Recolher', html: IMG.icon(g.collapsed ? 'chevronDown' : 'chevronUp', 12),
          on: { click: () => { g.collapsed = !g.collapsed; this.renderDock(); this.saveDock(); } } }));
        head.addEventListener('dblclick', (e) => { if (e.target.closest('.pgroup-btn')) return; g.collapsed = !g.collapsed; this.renderDock(); this.saveDock(); });
        const body = el('div.pgroup-body');
        const ge = el('div.pgroup' + (g.collapsed ? '.collapsed' : ''), { data: { gi }, style: g.collapsed ? null : { flex: Math.max(60, g.size || 200) + ' 1 0px' } }, head, body);
        dockEl.appendChild(ge);
        if (!g.collapsed && g.active) {
          body.appendChild(this.panelEl(g.active));
          const def = this.panels[g.active];
          if (def.onShow) { try { def.onShow(); } catch (err) { console.error(err); } }
        }
      });
      if (!d.groups.length) dockEl.appendChild(el('div.dock-empty', { text: 'Use o menu Janela para exibir painéis.' }));
      bus.emit('dock:change');
    },

    _dragSplit(e, gi) {
      e.preventDefault();
      const dockEl = U.$('#dock'), groups = U.$$('.pgroup', dockEl), d = this.dock;
      let ai = gi - 1; while (ai >= 0 && d.groups[ai].collapsed) ai--;
      let bi = gi; while (bi < d.groups.length && d.groups[bi].collapsed) bi++;
      if (ai < 0 || bi >= d.groups.length) return;
      d.groups.forEach((g, i) => { if (!g.collapsed) g.size = groups[i].offsetHeight; });
      const a = d.groups[ai], b = d.groups[bi], y0 = e.clientY, a0 = a.size, b0 = b.size;
      U.drag(e, (ev) => {
        let dy = ev.clientY - y0;
        dy = U.clamp(dy, -(a0 - 70), b0 - 70);
        a.size = a0 + dy; b.size = b0 - dy;
        groups[ai].style.flex = a.size + ' 1 0px'; groups[bi].style.flex = b.size + ' 1 0px';
        bus.emit('dock:resize');
      }, () => { this.saveDock(); bus.emit('dock:resize'); });
    },

    _dragTab(e, id, gi) {
      if (e.button !== 0) return;
      const d = this.dock, x0 = e.clientX, y0 = e.clientY;
      let dragging = false, ghost = null, target = null;
      const dockEl = U.$('#dock');
      const clearMarks = () => U.$$('.drop-target', dockEl).forEach((n) => n.classList.remove('drop-target'));
      U.drag(e, (ev) => {
        if (!dragging) {
          if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 7) return;
          dragging = true;
          ghost = el('div.tab-ghost', { text: this.panels[id].title });
          document.body.appendChild(ghost);
          dockEl.classList.add('dragging-tab');
        }
        ghost.style.transform = 'translate(' + (ev.clientX + 10) + 'px,' + (ev.clientY + 8) + 'px)';
        clearMarks(); target = null;
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        if (!under) return;
        const head = under.closest('.pgroup-head'), split = under.closest('.pgroup-split'), grp = under.closest('.pgroup');
        if (head) { target = { type: 'group', gi: +head.dataset.gi }; head.classList.add('drop-target'); }
        else if (split) { target = { type: 'new', at: +split.dataset.gi }; split.classList.add('drop-target'); }
        else if (grp) {
          const r = grp.getBoundingClientRect(), g2 = +grp.dataset.gi;
          if (ev.clientY > r.bottom - 26 && g2 === d.groups.length - 1) { target = { type: 'new', at: d.groups.length }; grp.classList.add('drop-target'); }
          else { target = { type: 'group', gi: g2 }; U.$('.pgroup-head', grp).classList.add('drop-target'); }
        }
      }, () => {
        if (ghost) ghost.remove();
        dockEl.classList.remove('dragging-tab');
        clearMarks();
        const src = d.groups[gi];
        if (!dragging) {
          if (src.active === id && !src.collapsed) return;
          src.active = id; src.collapsed = false; this.renderDock(); this.saveDock(); return;
        }
        if (!target) return;
        if (target.type === 'group' && target.gi === gi) return;
        if (target.type === 'new' && src.tabs.length === 1 && (target.at === gi || target.at === gi + 1)) return;
        src.tabs.splice(src.tabs.indexOf(id), 1);
        if (src.active === id) src.active = src.tabs[0];
        if (target.type === 'group') { const g = d.groups[target.gi]; g.tabs.push(id); g.active = id; g.collapsed = false; }
        else d.groups.splice(target.at, 0, { tabs: [id], active: id, size: 220, collapsed: false, _new: true });
        d.groups = d.groups.filter((g) => g.tabs.length);
        d.groups.forEach((g) => delete g._new);
        this.renderDock(); this.saveDock();
      });
    },

    initDockResizer() {
      const handle = U.$('#dock-resizer');
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const x0 = e.clientX, w0 = this.dock.width;
        document.body.classList.add('resizing-h');
        U.drag(e, (ev) => { this.dock.width = U.clamp(w0 - (ev.clientX - x0), 240, 560); U.$('#dock').style.width = this.dock.width + 'px'; bus.emit('dock:resize'); },
          () => { document.body.classList.remove('resizing-h'); this.saveDock(); });
      });
      handle.addEventListener('dblclick', () => { document.body.classList.toggle('hide-dock'); bus.emit('dock:change'); });
    },

    /* ==================================================================
       Barra de status
       ================================================================== */
    initStatus() {
      const bar = U.$('#statusbar');
      this.st = {
        zoom: el('button.st-zoom', { type: 'button', title: 'Nível de zoom (clique para opções)' }),
        size: el('span.st-item'),
        pos: el('span.st-item.st-pos'),
        sel: el('span.st-item'),
        hint: el('span.st-hint'),
        hist: el('span.st-item.st-right')
      };
      this.st.zoom.addEventListener('click', () => {
        const r = this.st.zoom.getBoundingClientRect();
        const z = (v) => ({ label: v * 100 + '%', run: () => IMG.Engine.zoomTo(v) });
        this.contextMenu(r.left, r.top - 4, ['view.fit', 'view.fill', '-', z(0.25), z(0.5), z(1), z(2), z(4), z(8)]);
        const m = this.menuStack[0]; if (m) m.style.top = Math.max(4, r.top - m.offsetHeight - 4) + 'px';
      });
      bar.append(this.st.zoom, this.st.size, this.st.pos, this.st.sel, this.st.hint, this.st.hist);
      bus.on('pointer:move', (ev) => { this.st.pos.textContent = 'X ' + Math.floor(ev.x) + '   Y ' + Math.floor(ev.y); });
      bus.on('pointer:leave', () => { this.st.pos.textContent = ''; });
      const upd = () => this.updateStatus();
      ['view:change', 'doc:change', 'doc:resize', 'history:change', 'selection:change', 'layers:change'].forEach((ev) => bus.on(ev, upd));
      this.updateStatus();
    },
    updateStatus() {
      const doc = IMG.app.doc, s = this.st;
      if (!s) return;
      if (!doc) { s.zoom.textContent = '—'; s.size.textContent = ''; s.sel.textContent = ''; s.hist.textContent = 'Imaginarium ' + IMG.VERSION; s.pos.textContent = ''; return; }
      const z = doc.view.zoom * 100;
      s.zoom.textContent = (z < 10 ? U.round(z, 1) : Math.round(z)) + '%';
      s.size.textContent = doc.width + ' × ' + doc.height + ' px';
      const b = doc.selection && doc.selection.bounds;
      s.sel.textContent = b ? 'Seleção ' + b.w + ' × ' + b.h : '';
      s.hist.textContent = 'Histórico ' + (doc.history.index + 1) + '/' + doc.history.states.length;
    },
    setHint(text) { if (this.st) this.st.hint.textContent = text || ''; },

    /* ==================================================================
       Ajuda
       ================================================================== */
    openHelp(which) {
      if (which === 'credits') {
        const frame = el('iframe.help-frame', { src: 'help/credits.html', title: 'Créditos' });
        frame.style.height = '520px';
        this.dialog({ title: 'Créditos', body: frame, width: 440, flush: true, buttons: [{ label: 'Fechar', primary: true }], noFocus: true });
      } else {
        const frame = el('iframe.help-frame', { src: 'help/manual.html', title: 'Manual do Imaginarium' });
        frame.style.height = 'min(74vh, 720px)';
        this.dialog({ title: 'Manual do Imaginarium', body: frame, width: Math.min(980, window.innerWidth - 40), flush: true, buttons: [], noFocus: true });
      }
    },

    /* ==================================================================
       Inicialização
       ================================================================== */
    init() {
      this.root = U.$('#overlay-root');

      document.addEventListener('pointerdown', (e) => {
        if (this.menuOpen && !e.target.closest('.menu') && !e.target.closest('.menu-top')) this.closeMenus();
      }, true);
      window.addEventListener('blur', () => this.closeMenus());
      window.addEventListener('keydown', (e) => {
        if (this.dialogs.length) { const top = this.dialogs[this.dialogs.length - 1]; if (!this._pop) top.onKey(e); return; }
        if (e.key === 'Escape' && this.menuOpen) { this.closeMenus(); e.stopPropagation(); }
      }, true);
      window.addEventListener('resize', () => { this.closeMenus(); this.closePopover(); this.layoutToolbar(); });

      // as janelas de ajuda (iframes) pedem para fechar com Esc
      window.addEventListener('message', (e) => { if (e.data === 'imaginarium:close' && this.dialogs.length) this.dialogs[this.dialogs.length - 1].close(); });

      // botões declarados no HTML com data-cmd
      document.addEventListener('click', (e) => {
        const b = e.target.closest('[data-cmd]');
        if (b) { e.preventDefault(); this.run(b.dataset.cmd); }
      });
      // evita o menu de contexto do navegador sobre a interface (exceto em campos de texto)
      document.addEventListener('contextmenu', (e) => { if (!U.isTyping(e.target)) e.preventDefault(); });

      this.loadDock();
      this.renderToolbar();
      this.renderDock();
      this.initDockResizer();
      this.initStatus();
      this.renderTabs();
      this.renderOptions();

      bus.on('tool:change', () => { this.updateToolbar(); this.renderOptions(); });
      bus.on('quickmask:change', () => this.updateToolbar());
      bus.on('tool:option', () => this.renderOptions());
      bus.on('color:change', () => this.updateColors());
      bus.on('doc:change', () => { this.renderTabs(); });
      bus.on('history:change', () => this.renderTabs());
      bus.on('doc:rename', () => this.renderTabs());
    }
  });
})();
