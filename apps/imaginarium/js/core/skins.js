/* ==========================================================================
   Imaginarium — Aparências (skins)
   "Imaginarium" (padrão), "Nebulosa" (as cores da família Nebulosa, ver
   css/skin-nebulosa.css) e "Photopea" (layout, cores, medidas, fonte e
   comportamento iguais aos do Photopea). Editar › Preferências › Aparência.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const UI = IMG.UI, T = IMG.Tools;

  // aplica o atributo o quanto antes, para a página não "piscar" no tema errado
  // [Nebulosa] o Nebulosa Workspace grava a aparência escolhida nesta chave ("Usar Nebulosa em todos")
  const nbKey = () => { try { return localStorage.getItem('nebulosa.skin.imaginarium'); } catch (e) { return null; } };
  const early = nbKey() || (U.store.get('prefs', {}) || {}).skin || 'imaginarium';
  document.documentElement.dataset.skin = early;

  /* ------------------------------------------------------------------
     Grupos da barra de ferramentas por aparência
     ------------------------------------------------------------------ */
  const G = (id, key, tools) => ({ id, key, tools });
  const GROUPS = {
    imaginarium: T.GROUPS.map((g) => G(g.id, g.key, g.tools.slice())),
    nebulosa: T.GROUPS.map((g) => G(g.id, g.key, g.tools.slice())),
    // mesma ordem e composição da barra do Photopea (sem as ferramentas de IA)
    photopea: [
      G('move', 'v', ['move', 'artboard']),
      G('marquee', 'm', ['marqueeRect', 'marqueeEllipse']),
      G('lasso', 'l', ['lasso', 'polyLasso', 'magLasso']),
      G('wand', 'w', ['wand', 'quickSel']),
      G('crop', 'c', ['crop', 'perspCrop', 'slice', 'sliceSelect']),
      G('eyedrop', 'i', ['eyedropper', 'colorSampler', 'ruler']),
      G('heal', 'j', ['spotHeal', 'heal', 'patch', 'contentMove', 'redEye']),
      G('brush', 'b', ['brush', 'pencil', 'colorReplace']),
      G('stamp', 's', ['stamp']),
      G('eraser', 'e', ['eraser', 'bgEraser', 'magicEraser']),
      G('fill', 'g', ['gradient', 'bucket']),
      G('blur', 'r', ['blurTool', 'sharpenTool', 'smudge']),
      G('dodge', 'o', ['dodge', 'burn', 'sponge']),
      G('type', 't', ['text', 'textV']),
      G('pen', 'p', ['pen', 'freePen', 'curvPen', 'addAnchor', 'delAnchor', 'convertPt']),
      G('pathSel', 'a', ['pathSelect', 'directSelect']),
      G('shape', 'u', ['shapeRect', 'shapeEllipse', 'shapeLine', 'shapePolygon', 'shapeCustom']),
      G('hand', 'h', ['hand', 'rotateView']),
      G('zoom', 'z', ['zoom'])
    ]
  };
  T.setGroups = function (list) {
    T.GROUPS.splice(0, T.GROUPS.length, ...list.map((g) => G(g.id, g.key, g.tools.slice())));
    Object.keys(T.defs).forEach((id) => { const d = T.defs[id], g = T.groupOf(id); d.key = g ? g.key : d.key0; d.groupId = g ? g.id : undefined; });
    T._reorder();
  };

  /* ------------------------------------------------------------------
     Temas do motor (área de trabalho, réguas, sombra do documento)
     ------------------------------------------------------------------ */
  const THEMES = {
    imaginarium: {},
    nebulosa: {
      workspace: '#1b1d36', rulerBg: '#2b2e50', rulerDoc: '#2b2e50', rulerTick: '#8084b5', rulerText: '#b4b7de', rulerLine: '#15172d'
    },
    photopea: {
      workspace: '#252525', docShadow: 'rgba(0,0,0,0.42)', docShadowBlur: 9, docShadowY: 1,
      rulerBg: '#474747', rulerDoc: '#474747', rulerTick: '#8a8a8a', rulerText: '#c8c8c8', rulerLine: '#252525',
      rulerFont: '10px "Open Sans", sans-serif'
    }
  };

  /* ------------------------------------------------------------------
     Painéis no layout do Photopea: coluna estreita (ícones) + coluna larga
     ------------------------------------------------------------------ */
  const PP = {
    st: null,
    defaults() {
      return {
        narrow: [['info', 'properties'], ['brush'], ['character', 'paragraph'], ['css', 'navigator']],
        main: [{ tabs: ['history', 'swatches'], active: 'history', size: 186 }, { tabs: ['layers', 'channels', 'paths'], active: 'layers', size: 400 }],
        hidden: [], fly: null, wide: false, mainOff: false
      };
    },
    load() {
      const def = this.defaults(), saved = U.store.get('dockPP', null);
      const s = saved && Array.isArray(saved.main) && Array.isArray(saved.narrow) ? saved : def;
      const known = new Set(UI.panelOrder), seen = new Set();
      const keep = (id) => known.has(id) && !seen.has(id) && seen.add(id);
      s.narrow = s.narrow.map((g) => g.filter(keep)).filter((g) => g.length);
      s.main.forEach((g) => { g.tabs = (g.tabs || []).filter(keep); if (!g.tabs.includes(g.active)) g.active = g.tabs[0]; });
      s.main = s.main.filter((g) => g.tabs.length);
      s.hidden = (s.hidden || []).filter(keep);
      UI.panelOrder.forEach((id) => { if (!seen.has(id)) { seen.add(id); s.hidden.push(id); } });
      if (s.fly && !s.narrow.some((g) => g.includes(s.fly))) s.fly = null;
      this.st = s;
      UI.dock = s;
    },
    save() { U.store.set('dockPP', this.st); },
    reset() { U.store.del('dockPP'); this.load(); document.body.classList.remove('hide-dock'); this.render(); this.save(); },
    find(id) {
      const s = this.st;
      for (let i = 0; i < s.main.length; i++) if (s.main[i].tabs.includes(id)) return { col: 'main', gi: i };
      for (let i = 0; i < s.narrow.length; i++) if (s.narrow[i].includes(id)) return { col: 'narrow', gi: i };
      return null;
    },
    shown(id) {
      const s = this.st; if (!s || document.body.classList.contains('hide-dock')) return false;
      if (s.fly === id) return true;
      return !s.mainOff && s.main.some((g) => g.active === id);
    },
    toggle(id) {
      const s = this.st, loc = this.find(id);
      if (loc && loc.col === 'main') {
        const g = s.main[loc.gi];
        if (g.active === id && !s.mainOff) { g.tabs.splice(g.tabs.indexOf(id), 1); g.active = g.tabs[0]; if (!g.tabs.length) s.main.splice(loc.gi, 1); s.hidden.push(id); }
        else { g.active = id; s.mainOff = false; }
      } else if (loc) s.fly = s.fly === id ? null : id;
      else {
        s.hidden = s.hidden.filter((t) => t !== id);
        if (!s.main.length) s.main.push({ tabs: [], active: id, size: 240 });
        const g = s.main[0]; g.tabs.push(id); g.active = id; s.mainOff = false;
      }
      document.body.classList.remove('hide-dock');
      this.render(); this.save();
    },
    show(id) {
      if (this.shown(id)) return;
      const s = this.st, loc = this.find(id);
      if (loc && loc.col === 'main') { s.main[loc.gi].active = id; s.mainOff = false; this.render(); this.save(); }
      else if (loc) { s.fly = id; this.render(); }
      else this.toggle(id);
    },
    icon(id) {
      const def = UI.panels[id];
      const name = (def && def.ppIcon) || PANEL_ICONS[id] || (def && def.icon);
      if (name && IMG.iconSets.photopea && IMG.iconSets.photopea[name]) return IMG.icon(name, 22);
      return '<b class="pp-nabbr">' + U.escapeHtml((def ? def.title : id).slice(0, 3)) + '</b>';
    },
    render() {
      const dockEl = U.$('#dock'), s = this.st;
      Object.values(UI.panelEls).forEach((n) => n.remove());
      U.clear(dockEl);
      dockEl.style.width = '';
      dockEl.classList.toggle('pp-main-off', !!s.mainOff);

      // coluna estreita
      const ncol = el('div.pp-ncol' + (s.wide ? '.wide' : ''));
      const ntop = el('div.pp-dtop', el('button.pp-tog', { type: 'button', title: s.wide ? 'Recolher' : 'Expandir', text: s.wide ? '> <' : '< >', on: { click: () => { s.wide = !s.wide; this.render(); this.save(); } } }));
      const nbody = el('div.pp-nbody');
      s.narrow.forEach((grp, ni) => {
        const g = el('div.pp-ngroup', { data: { ni } });
        grp.forEach((id) => {
          const def = UI.panels[id];
          const b = el('button.pp-nbtn' + (s.fly === id ? '.on' : ''), { type: 'button', title: def.title, data: { panel: id }, html: this.icon(id) + '<span class="pp-nlabel">' + U.escapeHtml(def.title) + '</span>' });
          b.addEventListener('pointerdown', (e) => this.drag(e, id, { col: 'narrow', gi: ni }));
          g.appendChild(b);
        });
        nbody.appendChild(g);
      });
      nbody.appendChild(el('div.pp-ngroup.pp-nfill', { data: { ni: s.narrow.length } }));
      ncol.append(ntop, nbody);

      // coluna larga
      const mcol = el('div.pp-mcol');
      const mtop = el('div.pp-dtop', el('button.pp-tog', { type: 'button', title: s.mainOff ? 'Expandir painéis' : 'Recolher painéis', text: s.mainOff ? '< >' : '> <', on: { click: () => { s.mainOff = !s.mainOff; this.render(); this.save(); bus.emit('dock:resize'); IMG.Engine.resize(); } } }));
      const mbody = el('div.pp-mbody');
      s.main.forEach((g, gi) => {
        if (gi > 0) { const sp = el('div.pp-msplit', { data: { gi } }); sp.addEventListener('pointerdown', (e) => this.dragSplit(e, gi)); mbody.appendChild(sp); }
        const head = el('div.pp-mhead', { data: { gi } });
        g.tabs.forEach((id) => {
          const def = UI.panels[id];
          const t = el('button.pp-tab' + (id === g.active ? '.active' : ''), { type: 'button', text: def.title, data: { panel: id } });
          t.addEventListener('pointerdown', (e) => this.drag(e, id, { col: 'main', gi }));
          head.appendChild(t);
        });
        head.appendChild(el('span.pp-hfill'));
        head.appendChild(el('button.pp-menu', { type: 'button', title: 'Opções do painel', html: '<i></i><i></i><i></i>', on: { click: (e) => this.panelMenu(e.currentTarget, g.active, { col: 'main', gi }) } }));
        const body = el('div.pp-gbody');
        const last = gi === s.main.length - 1;
        const ge = el('div.pp-mgroup' + (last ? '.last' : ''), { data: { gi }, style: last ? null : { height: Math.max(60, g.size || 186) + 'px' } }, head, body);
        mbody.appendChild(ge);
        if (g.active) {
          body.appendChild(UI.panelEl(g.active));
          const def = UI.panels[g.active];
          if (def.onShow) { try { def.onShow(); } catch (err) { console.error(err); } }
        }
      });
      if (!s.main.length) mbody.appendChild(el('div.dock-empty', { text: 'Use o menu Janela para exibir painéis.' }));
      mcol.append(mtop, mbody);
      dockEl.append(ncol, mcol);

      // painel aberto a partir da coluna estreita
      this.renderFly();
      bus.emit('dock:change');
    },
    renderFly() {
      const old = U.$('#pp-fly'); if (old) old.remove();
      const s = this.st, id = s.fly; if (!id) return;
      const btn = U.$('.pp-nbtn[data-panel="' + id + '"]'); if (!btn) return;
      const def = UI.panels[id], loc = this.find(id);
      const head = el('div.pp-mhead', el('button.pp-tab.active', { type: 'button', text: def.title }), el('span.pp-hfill'),
        el('button.pp-menu', { type: 'button', title: 'Opções do painel', html: '<i></i><i></i><i></i>', on: { click: (e) => this.panelMenu(e.currentTarget, id, loc) } }));
      const body = el('div.pp-gbody');
      const fly = el('div#pp-fly.pp-fly', head, body);
      document.body.appendChild(fly);
      body.appendChild(UI.panelEl(id));
      const r = btn.getBoundingClientRect(), dock = U.$('#dock').getBoundingClientRect();
      fly.style.right = Math.round(window.innerWidth - dock.left + 4 - (s.mainOff ? 0 : 0)) + 'px';
      const top = Math.max(r.top, 0), maxH = window.innerHeight - top - 6;
      fly.style.top = Math.round(top) + 'px';
      fly.style.maxHeight = maxH + 'px';
      if (def.onShow) { try { def.onShow(); } catch (err) { console.error(err); } }
      bus.emit('dock:resize');
    },
    panelMenu(anchor, id, loc) {
      const def = UI.panels[id]; if (!def) return;
      const items = [];
      const extra = typeof def.menu === 'function' ? def.menu() : def.menu;
      if (extra && extra.length) items.push(...extra, '-');
      if (loc && loc.col === 'main') items.push({ label: 'Mover para a coluna de ícones', run: () => this.moveTo(id, { col: 'narrow', gi: this.st.narrow.length }) });
      else if (loc) items.push({ label: 'Mover para a coluna de painéis', run: () => this.moveTo(id, { col: 'main', gi: Math.max(0, this.st.main.length - 1) }) });
      items.push({ label: 'Fechar', run: () => { this.hide(id); } });
      items.push('-', { label: 'Restaurar layout dos painéis', run: () => this.reset() });
      const r = anchor.getBoundingClientRect();
      UI.contextMenu(r.left, r.bottom + 2, items);
      const m = UI.menuStack[0]; if (m && r.left + m.offsetWidth > window.innerWidth - 4) m.style.left = Math.max(4, r.right - m.offsetWidth) + 'px';
    },
    remove(id) {
      const s = this.st, loc = this.find(id); if (!loc) return;
      if (loc.col === 'main') { const g = s.main[loc.gi]; g.tabs.splice(g.tabs.indexOf(id), 1); if (g.active === id) g.active = g.tabs[0]; }
      else s.narrow[loc.gi].splice(s.narrow[loc.gi].indexOf(id), 1);
      if (s.fly === id) s.fly = null;
    },
    clean() { const s = this.st; s.main = s.main.filter((g) => g.tabs.length); s.narrow = s.narrow.filter((g) => g.length); },
    hide(id) { this.remove(id); this.st.hidden.push(id); this.clean(); this.render(); this.save(); },
    moveTo(id, target) {
      const s = this.st;
      this.remove(id);
      if (target.col === 'narrow') {
        if (target.into != null && s.narrow[target.into]) s.narrow[target.into].push(id);
        else s.narrow.splice(Math.min(target.gi, s.narrow.length), 0, [id]);
      } else if (target.into != null && s.main[target.into]) { const g = s.main[target.into]; g.tabs.push(id); g.active = id; }
      else s.main.splice(Math.min(target.gi, s.main.length), 0, { tabs: [id], active: id, size: 220 });
      this.clean(); this.render(); this.save();
    },
    drag(e, id, src) {
      if (e.button !== 0) return;
      const x0 = e.clientX, y0 = e.clientY, s = this.st;
      let dragging = false, ghost = null, target = null;
      const clear = () => U.$$('.pp-drop').forEach((n) => n.classList.remove('pp-drop'));
      U.drag(e, (ev) => {
        if (!dragging) {
          if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 7) return;
          dragging = true;
          ghost = el('div.tab-ghost', { text: UI.panels[id].title }); document.body.appendChild(ghost);
        }
        ghost.style.transform = 'translate(' + (ev.clientX + 10) + 'px,' + (ev.clientY + 8) + 'px)';
        clear(); target = null;
        const under = document.elementFromPoint(ev.clientX, ev.clientY); if (!under) return;
        const head = under.closest('.pp-mhead[data-gi]'), split = under.closest('.pp-msplit'), ng = under.closest('.pp-ngroup'), mg = under.closest('.pp-mgroup');
        if (head) { target = { col: 'main', into: +head.dataset.gi }; head.classList.add('pp-drop'); }
        else if (split) { target = { col: 'main', gi: +split.dataset.gi }; split.classList.add('pp-drop'); }
        else if (ng) { const ni = +ng.dataset.ni; target = ng.classList.contains('pp-nfill') ? { col: 'narrow', gi: ni } : { col: 'narrow', into: ni }; ng.classList.add('pp-drop'); }
        else if (mg) { const gi = +mg.dataset.gi, r = mg.getBoundingClientRect(); if (ev.clientY > r.bottom - 30) { target = { col: 'main', gi: gi + 1 }; mg.classList.add('pp-drop'); } else { target = { col: 'main', into: gi }; U.$('.pp-mhead', mg).classList.add('pp-drop'); } }
      }, () => {
        if (ghost) ghost.remove();
        clear();
        if (!dragging) {
          if (src.col === 'narrow') { s.fly = s.fly === id ? null : id; this.render(); return; }
          const g = s.main[src.gi]; if (g.active !== id || s.mainOff) { g.active = id; s.mainOff = false; this.render(); this.save(); }
          return;
        }
        if (!target) return;
        if (target.col === src.col && target.into === src.gi) return;
        this.moveTo(id, target);
      });
    },
    dragSplit(e, gi) {
      e.preventDefault();
      const s = this.st, a = s.main[gi - 1]; if (!a) return;
      const groups = U.$$('.pp-mgroup'), ge = groups[gi - 1];
      const y0 = e.clientY, h0 = ge.offsetHeight;
      U.drag(e, (ev) => { a.size = U.clamp(h0 + ev.clientY - y0, 60, window.innerHeight - 160); ge.style.height = a.size + 'px'; bus.emit('dock:resize'); }, () => { this.save(); bus.emit('dock:resize'); });
    }
  };
  const PANEL_ICONS = { info: 'ppInfo', properties: 'ppProps', brush: 'ppBrushPanel', character: 'ppChar', paragraph: 'ppPara', css: 'ppCss', navigator: 'ppNav', history: 'ppHistory', swatches: 'ppSwatches', layers: 'ppLayers', channels: 'ppChannels', paths: 'ppPaths', actions: 'ppActions', adjustments: 'ppAdjust', glyphs: 'ppGlyphs', histogram: 'ppHisto', layerComps: 'ppComps', styles: 'ppStyles', toolPresets: 'ppToolPresets', color: 'ppColor', library: 'ppLibrary' };

  /* ------------------------------------------------------------------
     Barra superior do Photopea: busca, tela cheia e links à direita
     ------------------------------------------------------------------ */
  function mountChrome() {
    const bar = U.$('#menubar');
    if (!U.$('#pp-extra')) {
      const extra = el('div#pp-extra',
        el('button.pp-ico-btn', { type: 'button', title: 'Pesquisar (ferramentas, comandos e menus)', html: IMG.icon('ppSearch', 20), on: { click: (e) => openSearch(e.currentTarget) } }),
        el('button.pp-ico-btn', { type: 'button', title: 'Tela cheia', html: IMG.icon('ppFullscreen', 18), on: { click: () => UI.run('view.fullscreen') } }));
      const menus = U.$('#menus'); menus.after(extra);
      const links = el('div#pp-links',
        el('button.pp-link', { type: 'button', text: 'Sobre', on: { click: () => UI.run('help.credits') } }),
        el('button.pp-link', { type: 'button', text: 'Atalhos', on: { click: () => UI.run('help.shortcuts') } }),
        el('button.pp-link', { type: 'button', text: 'Aprender', on: { click: () => UI.run('help.manual') } }));
      bar.appendChild(links);
    }
    if (!U.$('#pp-home')) buildHome();
  }

  /* ---------- pesquisa de comandos ---------- */
  function allCommands() {
    const out = [], seen = new Set();
    const walk = (items, path) => {
      const list = typeof items === 'function' ? items() : items;
      (list || []).forEach((it) => {
        if (!it || it === '-') return;
        if (typeof it === 'string') {
          const c = UI.commands[it]; if (!c || seen.has(it)) return; seen.add(it);
          out.push({ id: it, label: (c.label2 && c.label2()) || c.label, path: path.join(' › '), keys: c.keys && c.keys[0] });
        } else if (it.items) walk(it.items, path.concat(it.label));
      });
    };
    (UI.menuDefs || []).forEach((m) => walk(m.items, [m.label]));
    T.order.forEach((id) => { const d = T.defs[id]; if (d && !d.hidden && T.groupOf(id) && UI.commands['tools.' + id] && !seen.has('tools.' + id)) out.push({ id: 'tools.' + id, label: d.name, path: 'Ferramentas', keys: d.key }); });
    return out;
  }
  function openSearch(anchor) {
    const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const inp = el('input.inp.pp-search-inp', { type: 'search', placeholder: 'Pesquisar…', spellcheck: false });
    const list = el('div.pp-search-list');
    const box = el('div.pp-search', inp, list);
    const cmds = allCommands();
    let hits = [], sel = 0;
    const draw = () => {
      U.clear(list);
      const q = norm(inp.value.trim());
      hits = q ? cmds.filter((c) => norm(c.label + ' ' + c.path).includes(q)).slice(0, 40) : [];
      sel = Math.min(sel, Math.max(0, hits.length - 1));
      hits.forEach((c, i) => {
        const r = el('div.pp-search-row' + (i === sel ? '.on' : ''), el('span.pp-sr-label', { text: c.label.replace(/…$/, '') }), el('span.pp-sr-path', { text: c.path }), el('span.pp-sr-key', { text: c.keys ? UI.keyLabel(c.keys) : '' }));
        r.addEventListener('pointerdown', (e) => { e.preventDefault(); go(i); });
        list.appendChild(r);
      });
      if (q && !hits.length) list.appendChild(el('div.pp-search-none', { text: 'Nada encontrado.' }));
    };
    const go = (i) => { const c = hits[i]; if (!c) return; UI.closePopover(); UI.run(c.id); };
    inp.addEventListener('input', () => { sel = 0; draw(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(hits.length - 1, sel + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); go(sel); }
      e.stopPropagation();
    });
    UI.popover(anchor, box, { className: 'pp-search-pop' });
    setTimeout(() => inp.focus(), 0);
  }

  /* ---------- teclado virtual (modificadores para telas de toque) ---------- */
  T.vmods = { shift: false, ctrl: false, alt: false };
  const baseEv = T.ev.bind(T);
  T.ev = function (e) {
    const ev = baseEv(e), m = T.vmods;
    if (m.shift) ev.shift = true; if (m.ctrl) ev.ctrl = true; if (m.alt) ev.alt = true;
    return ev;
  };
  function openKeyboard(anchor) {
    const m = T.vmods;
    const key = (k, label) => { const b = el('button.btn.small' + (m[k] ? '.primary' : ''), { type: 'button', text: label }); b.addEventListener('click', () => { m[k] = !m[k]; b.classList.toggle('primary', m[k]); }); return b; };
    const send = (label, combo) => el('button.btn.small', { type: 'button', text: label, on: { click: () => { const c = UI.keymap[combo]; if (c) UI.run(c); else { const k = combo === 'escape' ? 'Escape' : combo === 'enter' ? 'Enter' : 'Delete'; window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k, bubbles: true })); } } } });
    const box = el('div.pp-kbd', el('div.pp-kbd-row', key('shift', 'Shift'), key('ctrl', 'Ctrl'), key('alt', 'Alt')),
      el('div.pp-kbd-row', send('Enter', 'enter'), send('Esc', 'escape'), send('Del', 'delete'), send('Desfazer', 'ctrl+z'), send('Refazer', 'ctrl+shift+z')),
      el('p.dialog-note', { text: 'Os modificadores ficam presos até serem desligados — útil em telas de toque.' }));
    UI.popover(anchor, box, { className: 'pp-kbd-pop' });
  }

  /* ---------- tela inicial no estilo do Photopea ---------- */
  function buildHome() {
    const nav = (icon, label, run, on) => el('button.pp-hnav' + (on ? '.on' : ''), { type: 'button', on: { click: run } }, IMG.iconEl(icon, 20), el('span', { text: label }));
    const fmt = (t, c) => el('span.pp-fmt', el('i', { text: t, style: { borderColor: c, color: c } }), el('b', { text: t }));
    const home = el('div#pp-home',
      el('nav.pp-hside',
        nav('ppHome', 'Início', () => {}, true),
        nav('ppDevice', 'Este dispositivo', () => UI.run('file.open')),
        nav('ppRecent', 'Abrir recentes', () => { const items = IMG.Files.recentItems ? IMG.Files.recentItems() : []; const r = U.$('.pp-hside').getBoundingClientRect(); UI.contextMenu(r.right + 2, r.top + 80, items.length ? items : [{ label: 'Nenhum arquivo recente', enabled: () => false, run: () => {} }]); })),
      el('div.pp-hmain',
        el('div.pp-hlogo', el('img', { src: 'assets/icons/icon-192.png', alt: '' }), el('span', { text: 'Imaginarium' })),
        el('div.pp-hbtns',
          el('button.pp-hbtn', { type: 'button', on: { click: () => UI.run('file.new') } }, IMG.iconEl('ppNewDoc', 20), el('span', { text: 'Novo projeto' })),
          el('button.pp-hbtn', { type: 'button', on: { click: () => UI.run('file.open') } }, IMG.iconEl('ppDevice', 20), el('span', { text: 'Abrir do computador' })),
          el('button.pp-hbtn', { type: 'button', on: { click: () => UI.run('file.openProject') } }, IMG.iconEl('ppImage', 20), el('span', { text: 'Abrir projeto .edt' }))),
        el('div.pp-hdrop', { text: 'Solte qualquer arquivo aqui' }),
        el('div.pp-hfmts', fmt('PSD', '#31a8ff'), fmt('PSB', '#31a8ff'), fmt('EDT', '#b35cff'), fmt('SVG', '#ffb13b'), fmt('PDF', '#e54b4b'), fmt('TIFF', '#c7c7c7'), fmt('GIF', '#c7c7c7'), el('span.pp-fmt.any', el('i', { html: 'JPG&nbsp;PNG<br>WEBP&nbsp;BMP' }), el('b', { text: 'QUALQUER' })))));
    U.$('#stage').appendChild(home);
  }

  /* ------------------------------------------------------------------
     Aparências
     ------------------------------------------------------------------ */
  const Skins = (IMG.Skins = {
    list: [
      { id: 'imaginarium', name: 'Imaginarium Default', desc: 'O visual original: grafite com detalhes em azul, barra de status e painéis em abas.' },
      { id: 'nebulosa', name: 'Nebulosa Default', desc: 'A organização do Imaginarium com as cores da família Nebulosa: azul-marinho, roxo, laranja e amarelo.' },
      { id: 'photopea', name: 'Photopea', desc: 'Igual ao Photopea: cinza #474747, fonte Open Sans, barra de ferramentas, painéis em duas colunas, menus e comportamento do Photopea.' }
    ],
    current: early,
    GROUPS, THEMES, PP,
    is(id) { return this.current === id; },
    /** Prepara a aparência antes de a interface ser montada. */
    init() {
      const want = nbKey() || IMG.app.prefs.skin; const id = (want && GROUPS[want]) ? want : 'imaginarium';
      Object.keys(T.defs).forEach((k) => { const d = T.defs[k]; if (d.key0 === undefined) d.key0 = d.key; });
      this.current = id;
      document.documentElement.dataset.skin = id;
      T.setGroups(GROUPS[id]);
      IMG.Engine.theme = THEMES[id];
    },
    apply(id) {
      if (!GROUPS[id]) id = 'imaginarium';
      if (IMG.app.prefs.skin !== id) { IMG.app.prefs.skin = id; IMG.app.savePrefs(); }
      try { localStorage.setItem('nebulosa.skin.imaginarium', id); } catch (e) { /* ignore */ }
      if (this.current === id && UI.root && U.$('#app').classList.contains('ready')) { this.refresh(); return; }
      this.current = id;
      document.documentElement.dataset.skin = id;
      T.setGroups(GROUPS[id]);
      IMG.Engine.theme = THEMES[id];
      const fly = U.$('#pp-fly'); if (fly) fly.remove();
      if (T.activeId && T.defs[T.activeId] && !T.defs[T.activeId].hidden && !T.groupOf(T.activeId)) T.set('move');
      this.refresh();
      bus.emit('skin:change', id);
    },
    refresh() {
      if (!UI.root) return;
      UI.closeMenus(); UI.closePopover();
      UI.loadDock(); UI.renderToolbar(); UI.renderDock(); UI.setMenus(IMG.buildMenus()); UI.renderOptions(); UI.renderTabs(); UI.updateStatus();
      mountChrome();
      IMG.refreshIcons(document);
      IMG.Engine.resize(); IMG.Engine.viewChanged(); IMG.Engine.invalidate();
      UI.layoutToolbar();
    }
  });

  /* ------------------------------------------------------------------
     Ganchos na interface
     ------------------------------------------------------------------ */
  const base = {
    loadDock: UI.loadDock, saveDock: UI.saveDock, resetDock: UI.resetDock, renderDock: UI.renderDock,
    panelVisible: UI.panelVisible, panelShown: UI.panelShown, togglePanel: UI.togglePanel, showPanel: UI.showPanel,
    renderToolbar: UI.renderToolbar, init: UI.init
  };
  const pp = () => Skins.current === 'photopea';
  UI.loadDock = function () { return pp() ? PP.load() : base.loadDock.call(UI); };
  UI.saveDock = function () { return pp() ? PP.save() : base.saveDock.call(UI); };
  UI.resetDock = function () { return pp() ? PP.reset() : base.resetDock.call(UI); };
  UI.renderDock = function () { return pp() ? PP.render() : base.renderDock.call(UI); };
  UI.panelVisible = function (id) { return pp() ? !!PP.find(id) : base.panelVisible.call(UI, id); };
  UI.panelShown = function (id) { return pp() ? PP.shown(id) : base.panelShown.call(UI, id); };
  UI.togglePanel = function (id) { return pp() ? PP.toggle(id) : base.togglePanel.call(UI, id); };
  UI.showPanel = function (id) { return pp() ? PP.show(id) : base.showPanel.call(UI, id); };
  UI.renderToolbar = function () {
    base.renderToolbar.call(UI);
    const bar = U.$('#toolbar');
    const kb = el('button.tool-btn.pp-kbd-btn', { type: 'button', title: 'Teclado (modificadores para telas de toque)', html: IMG.icon('ppKeyboard', 18), on: { click: (e) => openKeyboard(e.currentTarget) } });
    bar.appendChild(kb);
  };
  UI.init = function () {
    base.init.call(UI);
    mountChrome();
    window.addEventListener('resize', () => { if (pp()) PP.renderFly(); });
  };

  // menus: no Photopea, "Ajuda" vira "Mais"
  bus.on('app:ready', () => {
    const baseMenus = IMG.buildMenus;
    IMG.buildMenus = function () {
      const m = baseMenus();
      if (pp()) {
        const i = m.findIndex((x) => x.label === 'Ajuda');
        const more = { label: 'Mais', items: [{ label: 'Aparência', items: Skins.list.map((s) => 'skin.' + s.id) }, 'edit.shortcuts', '-', 'help.manual', 'help.shortcuts', '-', 'help.credits'] };
        if (i >= 0) m.splice(i, 1, more); else m.push(more);
      }
      return m;
    };
    UI.setMenus(IMG.buildMenus());
  });

  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C) => {
    Skins.list.forEach((s) => C('skin.' + s.id, s.name, () => Skins.apply(s.id), { checked: () => Skins.current === s.id }));
  });

  /* ------------------------------------------------------------------
     Preferências com abas (inclui Aparência)
     ------------------------------------------------------------------ */
  function skinPreview(id) {
    const c = id === 'nebulosa'
      ? { top: '#232547', bar: '#2b2e50', tools: '#2b2e50', ws: '#1b1d36', narrow: null, panel: '#2b2e50', head: '#232547', sel: '#5b4a9a', acc: '#A778FF', doc: '#ffffff', gap: '#15172d' }
      : id === 'photopea'
      ? { top: '#474747', bar: '#474747', tools: '#474747', ws: '#252525', narrow: '#474747', panel: '#474747', head: '#252525', sel: '#5d5d5d', acc: '#3482f6', doc: '#ffffff', gap: '#252525' }
      : { top: '#1e1f22', bar: '#27292d', tools: '#27292d', ws: '#17181b', narrow: null, panel: '#27292d', head: '#1e1f22', sel: '#3a5378', acc: '#3577c0', doc: '#ffffff', gap: '#121315' };
    const box = el('div.skin-prev', { style: { background: c.gap } });
    const add = (st) => box.appendChild(el('i', { style: st }));
    add({ left: 0, top: 0, right: 0, height: '9px', background: c.top });
    add({ left: 0, top: '9px', right: 0, height: '9px', background: c.bar, borderTop: id === 'photopea' ? 'none' : '1px solid #121315' });
    add({ left: 0, top: '19px', width: '12px', bottom: 0, background: c.tools });
    add({ left: '1px', top: '22px', width: '1.5px', height: '7px', background: c.acc });
    for (let k = 0; k < 8; k++) add({ left: '4px', top: 23 + k * 8 + 'px', width: '5px', height: '5px', borderRadius: '1px', background: k === 0 ? '#ddd' : '#9a9a9a', opacity: 0.8 });
    add({ left: '14px', top: '19px', right: id === 'photopea' ? '79px' : '66px', bottom: 0, background: c.ws, borderRadius: id === 'photopea' ? '3px 3px 0 0' : '0' });
    add({ left: '34px', top: '40px', width: id === 'photopea' ? '86px' : '96px', height: '52px', background: c.doc, boxShadow: '0 1px 4px rgba(0,0,0,.5)' });
    if (c.narrow) {
      add({ right: '66px', top: '19px', width: '11px', bottom: 0, background: c.narrow });
      add({ right: 0, top: '19px', width: '64px', height: '36px', background: c.panel });
      add({ right: 0, top: '19px', width: '64px', height: '7px', background: c.head });
      add({ right: '44px', top: '19px', width: '20px', height: '7px', background: c.panel, borderRadius: '2px 2px 0 0' });
      add({ right: 0, top: '58px', width: '64px', bottom: 0, background: c.panel });
      add({ right: 0, top: '58px', width: '64px', height: '7px', background: c.head });
      add({ right: '44px', top: '58px', width: '20px', height: '7px', background: c.panel, borderRadius: '2px 2px 0 0' });
      add({ right: '2px', top: '74px', width: '60px', height: '8px', background: c.sel });
    } else {
      add({ right: 0, top: '19px', width: '64px', bottom: 0, background: c.panel });
      [19, 58].forEach((y) => { add({ right: 0, top: y + 'px', width: '64px', height: '7px', background: c.head }); add({ right: '44px', top: y + 'px', width: '20px', height: '7px', background: c.panel, boxShadow: 'inset 0 1px 0 ' + c.acc }); });
      add({ right: '2px', top: '74px', width: '60px', height: '8px', background: c.sel });
      add({ left: 0, right: 0, bottom: 0, height: '6px', background: c.top });
    }
    return box;
  }

  IMG.Files.prefsDialog = function () {
    const app = IMG.app, p = app.prefs;
    const set = (k) => (v) => { p[k] = v; app.savePrefs(); };
    const sec = (t) => el('h3.form-title', { text: t });
    const tabs = [
      { id: 'general', label: 'Geral', build: () => [
        sec('Geral'),
        UI.row('Estados do histórico', UI.num({ value: p.historyMax, min: 100, max: 500, width: 90, onChange: set('historyMax') }).el, el('span.form-hint', { text: 'mínimo de 100' })),
        UI.row('', UI.check('Usar Shift para alternar ferramentas do mesmo grupo', p.shiftToolSwitch !== false, set('shiftToolSwitch')).el),
        UI.row('Fundo da transparência', UI.select([['light', 'Xadrez claro'], ['mid', 'Xadrez médio'], ['dark', 'Xadrez escuro']], p.checker, (v) => { set('checker')(v); IMG.Engine.invalidate(); }, { keepFocus: true }).el),
        UI.row('Unidades', UI.select([['px', 'Pixels'], ['cm', 'Centímetros'], ['mm', 'Milímetros'], ['in', 'Polegadas'], ['%', 'Porcentagem']], p.units || 'px', (v) => { set('units')(v); IMG.Engine.viewChanged(); }, { keepFocus: true }).el)
      ] },
      { id: 'look', label: 'Aparência', build: () => {
        const cards = el('div.skin-cards');
        const paint = () => U.$$('.skin-card', cards).forEach((c) => c.classList.toggle('on', c.dataset.skin === Skins.current));
        Skins.list.forEach((s) => {
          const card = el('button.skin-card', { type: 'button', data: { skin: s.id } }, skinPreview(s.id), el('b', { text: s.name }), el('span', { text: s.desc }));
          card.addEventListener('click', () => { Skins.apply(s.id); paint(); });
          cards.appendChild(card);
        });
        paint();
        return [sec('Aparência'), el('p.dialog-note', { text: 'A aparência muda cores, fontes, medidas e a organização da interface. Os documentos abertos continuam como estão.' }), cards];
      } },
      { id: 'nav', label: 'Navegação', build: () => [
        sec('Zoom e rolagem'),
        UI.row('', UI.check('Roda do mouse aplica zoom (sem Alt)', p.wheelZoom, set('wheelZoom')).el),
        UI.row('', UI.check('Zoom e rolagem com animação suave (só na aparência Imaginarium)', p.smoothZoom, set('smoothZoom')).el),
        el('p.dialog-note', { text: 'Como no Photopea: roda = rolar na vertical · Ctrl + roda = rolar na horizontal · Alt + roda = zoom · pinça do touchpad = zoom.' })
      ] },
      { id: 'guides', label: 'Guias e grade', build: () => [
        sec('Grade'),
        UI.row('Tamanho da grade', UI.num({ value: p.gridSize, min: 2, max: 2000, unit: 'px', width: 90, onChange: (v) => { set('gridSize')(v); IMG.Engine.requestRender(); } }).el),
        UI.row('Subdivisões', UI.num({ value: p.gridSub, min: 1, max: 20, width: 90, onChange: (v) => { set('gridSub')(v); IMG.Engine.requestRender(); } }).el),
        UI.row('Cor da grade', UI.colorBtn(p.gridColor, (hex) => { if (hex) { set('gridColor')(hex); IMG.Engine.requestRender(); } }).el),
        sec('Guias'),
        UI.row('Cor das guias', UI.colorBtn(p.guideColor, (hex) => { if (hex) { set('guideColor')(hex); IMG.Engine.requestRender(); } }).el),
        UI.row('', UI.check('Encaixar em guias, bordas e centro', p.snap, set('snap')).el),
        UI.row('', UI.check('Guias inteligentes (alinhar com outras camadas)', p.smartGuides, set('smartGuides')).el),
        UI.row('', UI.check('Encaixar na grade quando ela estiver visível', p.snapGrid, set('snapGrid')).el),
        UI.row('', UI.check('Mostrar grade de pixels com zoom alto', p.pixelGrid, set('pixelGrid')).el)
      ] }
    ];
    let cur = U.store.get('prefsTab', 'general');
    if (!tabs.some((t) => t.id === cur)) cur = 'general';
    const nav = el('div.prefs-nav'), pane = el('div.prefs-pane');
    const show = (id) => {
      cur = id; U.store.set('prefsTab', id);
      U.$$('.prefs-tab', nav).forEach((b) => b.classList.toggle('on', b.dataset.t === id));
      U.clear(pane); tabs.find((t) => t.id === id).build().forEach((n) => n && pane.appendChild(n));
    };
    tabs.forEach((t) => nav.appendChild(el('button.prefs-tab', { type: 'button', text: t.label, data: { t: t.id }, on: { click: () => show(t.id) } })));
    show(cur);
    UI.dialog({
      title: 'Preferências', width: 660, className: 'prefs-dialog', body: el('div.prefs-wrap', nav, pane), noFocus: true,
      footLeft: [UI.btn('Restaurar padrões', () => { const sk = Skins.current; app.resetPrefs(); app.prefs.skin = sk; app.savePrefs(); UI.dialogs[UI.dialogs.length - 1].close(); IMG.Files.prefsDialog(); }, { small: true })],
      buttons: [{ label: 'OK', primary: true }]
    });
  };

  /* ---- [Nebulosa] ligação com o Nebulosa Workspace ----
     A conversa com o Workspace fica em ../../shared/nebulosa-bridge.js (carregado
     no index.html com data-provider). Aqui o Imaginarium só informa as aparências
     dele. Sem a ponte (programa aberto fora do Workspace), nada disto roda. */
  if (window.NebulosaSkin && window.NebulosaSkin.provide) {
    const SWATCH = { imaginarium: ['#1e1f22', '#4d8fd6', '#313439'], nebulosa: ['#323559', '#A778FF', '#FF9C54', '#FEFF36'], photopea: ['#474747', '#3482f6', '#252525'] };
    window.NebulosaSkin.provide({
      list: () => Skins.list.map((s) => ({ id: s.id, name: s.name, desc: s.desc, swatch: SWATCH[s.id] })),
      get: () => Skins.current,
      set: (id) => Skins.apply(id),
      openDialog: () => { U.store.set('prefsTab', 'look'); IMG.Files.prefsDialog(); },
      isDirty: () => !!(IMG.app && IMG.app.docs && IMG.app.docs.some((d) => d.dirty))
    });
    bus.on('skin:change', () => window.NebulosaSkin.notify());
    bus.on('app:ready', () => window.NebulosaSkin.notify());
  }
})();

