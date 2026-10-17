/* ==========================================================================
   Imaginarium — Atalhos do teclado (ver e personalizar)
   Editar › Atalhos do teclado… (Alt+Shift+Ctrl+K) e Ajuda › Atalhos.
   As personalizações ficam no navegador (localStorage).
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, el = U.el;

  const Shortcuts = (IMG.Shortcuts = {
    overrides: U.store.get('shortcuts', {}),

    /** Aplica as personalizações ao mapa de teclas. */
    apply() {
      const UI = IMG.UI;
      Object.keys(this.overrides).forEach((id) => {
        const c = UI.commands[id]; if (!c) return;
        (c.keys || []).forEach((k) => { if (UI.keymap[k] === id) delete UI.keymap[k]; });
        c.keys = this.overrides[id].slice();
        c.keys.forEach((k) => { UI.keymap[k] = id; });
      });
    },
    set(id, keys) {
      const UI = IMG.UI, c = UI.commands[id]; if (!c) return;
      (c.keys || []).forEach((k) => { if (UI.keymap[k] === id) delete UI.keymap[k]; });
      keys.forEach((k) => { const other = UI.keymap[k]; if (other && other !== id) { const oc = UI.commands[other]; oc.keys = (oc.keys || []).filter((x) => x !== k); this.overrides[other] = oc.keys.slice(); } UI.keymap[k] = id; });
      c.keys = keys.slice();
      this.overrides[id] = keys.slice();
      U.store.set('shortcuts', this.overrides);
    },
    reset() { U.store.del('shortcuts'); this.overrides = {}; IMG.UI.toast('Atalhos restaurados. Recarregue a página para aplicar.'); },

    /** Lista de comandos agrupados por menu (rótulo do menu → [ids]). */
    groups() {
      const out = [];
      const walk = (items, path, acc) => {
        const list = typeof items === 'function' ? items() : items;
        list.forEach((it) => {
          if (!it || it === '-') return;
          if (typeof it === 'string') { if (IMG.UI.commands[it]) acc.push({ id: it, path }); return; }
          if (it.items) walk(it.items, path.concat(it.label), acc);
        });
      };
      IMG.buildMenus().forEach((m) => { const acc = []; walk(m.items, [], acc); if (acc.length) out.push({ label: m.label, items: acc }); });
      return out;
    },

    dialog(readOnly) {
      const UI = IMG.UI;
      const search = el('input.inp', { type: 'search', placeholder: 'Procurar comando ou atalho…' });
      const table = el('div.sc-table');
      let recording = null;
      const render = () => {
        U.clear(table);
        const q = search.value.trim().toLowerCase();
        const row = (label, sub, keysTxt, id) => {
          const k = el('button.sc-key' + (recording === id ? '.rec' : ''), { type: 'button', text: recording === id ? 'Pressione as teclas…' : keysTxt || '—' });
          if (!readOnly && id) k.addEventListener('click', () => { recording = id; render(); });
          return el('div.sc-row', el('span.sc-label', el('b', { text: label }), sub ? el('small', { text: sub }) : null), k);
        };
        this.groups().forEach((g) => {
          const rows = g.items.filter(({ id, path }) => { const c = UI.commands[id]; const txt = ((c.label || '') + ' ' + path.join(' ') + ' ' + (c.keys || []).map((x) => UI.keyLabel(x)).join(' ')).toLowerCase(); return !q || txt.includes(q); });
          if (!rows.length) return;
          table.appendChild(el('div.sc-head', { text: g.label }));
          rows.forEach(({ id, path }) => { const c = UI.commands[id]; table.appendChild(row(c.label, path.join(' › '), (c.keys || []).filter((x) => !/^escape\+/.test(x)).map((x) => UI.keyLabel(x)).join(', '), id)); });
        });
        const tools = IMG.Tools.GROUPS.map((g) => ({ g, list: IMG.Tools.groupTools(g) })).filter((x) => x.list.length);
        const tt = tools.filter(({ list }) => !q || list.some((id) => IMG.Tools.defs[id].name.toLowerCase().includes(q)));
        if (tt.length) {
          table.appendChild(el('div.sc-head', { text: 'Ferramentas' }));
          tt.forEach(({ g, list }) => table.appendChild(row(list.map((id) => IMG.Tools.defs[id].name).join(', '), list.length > 1 ? 'Shift+' + g.key.toUpperCase() + ' alterna entre elas' : '', g.key.toUpperCase(), null)));
        }
        if (!q || 'temporário espaço mão zoom'.includes(q)) {
          table.appendChild(el('div.sc-head', { text: 'Teclas temporárias' }));
          [['Mão (temporária)', 'Espaço'], ['Zoom para aproximar (temporário)', 'Ctrl+Espaço'], ['Zoom para afastar (temporário)', 'Alt+Espaço'], ['Mover (temporário)', 'Ctrl (manter)'], ['Conta-gotas (nas ferramentas de pintura)', 'Alt (manter)'], ['Tamanho do pincel', '[ e ]'], ['Dureza do pincel', 'Shift+[ e Shift+]'], ['Opacidade da ferramenta', '0 a 9'], ['Trocar cores', 'X'], ['Cores padrão', 'D'], ['Máscara rápida', 'Q']].forEach(([a, b]) => table.appendChild(row(a, '', b, null)));
        }
      };
      search.addEventListener('input', render);
      const onKey = (e) => {
        if (!recording) return;
        e.preventDefault(); e.stopPropagation();
        if (e.key === 'Escape') { recording = null; render(); return; }
        if (e.key === 'Backspace' || e.key === 'Delete') { this.set(recording, []); recording = null; render(); return; }
        const combo = UI.keyOf(e);
        if (!combo || /^(ctrl|alt|shift)\+?$/.test(combo)) return;
        this.set(recording, [combo]);
        recording = null; render();
      };
      window.addEventListener('keydown', onKey, true);
      render();
      UI.dialog({
        title: readOnly ? 'Atalhos do teclado' : 'Atalhos do teclado (clique em um atalho para alterá-lo)', width: 620,
        body: [search, table], noFocus: false,
        footLeft: readOnly ? [] : [UI.btn('Restaurar padrões', () => this.reset(), { small: true })],
        buttons: [{ label: 'Fechar', primary: true }],
        onClose: () => window.removeEventListener('keydown', onKey, true)
      });
    }
  });

  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C) => {
    C('edit.shortcuts', 'Atalhos do teclado…', () => Shortcuts.dialog(false), { keys: ['ctrl+alt+shift+k'] });
    C('help.shortcuts', 'Lista de atalhos', () => Shortcuts.dialog(true), { keys: ['shift+?', '?'] });
  });
  IMG.bus.on('app:ready', () => Shortcuts.apply());
})();
