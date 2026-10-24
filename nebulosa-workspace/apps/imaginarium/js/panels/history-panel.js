/* ==========================================================================
   Imaginarium — painel Histórico
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  let root, list;

  function render() {
    if (!root || !root.isConnected) return;
    const doc = IMG.app.doc;
    U.clear(list);
    if (!doc) { list.appendChild(el('div.panel-empty', { text: 'Nenhum documento aberto.' })); return; }
    const h = doc.history;
    let current = null;
    const srcSt = IMG.historySourceState ? IMG.historySourceState(doc) : null;
    const srcBox = (st) => {
      const b = el('span.hsrc' + (st === srcSt ? '.on' : ''), { title: 'Definir a origem do Pincel de histórico' });
      if (st === srcSt) b.appendChild(IMG.iconEl('historyBrush', 13));
      b.addEventListener('click', (e) => { e.stopPropagation(); doc.histSource = st; render(); });
      return b;
    };
    (doc.snapshots || []).forEach((sn) => {
      const row = el('button.hrow.hsnap', { type: 'button', title: 'Instantâneo — clique para voltar a este estado' }, srcBox(sn.state), el('span.hthumb', IMG.iconEl('image', 13)), el('span.hname', { text: sn.name }));
      row.addEventListener('click', () => { h.restore(sn.state); h.commit(sn.name); });
      row.addEventListener('dblclick', () => { IMG.UI.prompt('Instantâneo', 'Nome', sn.name).then((v) => { if (v) { sn.name = v; render(); } }); });
      list.appendChild(row);
    });
    h.states.forEach((s, i) => {
      const row = el('button.hrow' + (i === h.index ? '.current' : '') + (i > h.index ? '.future' : ''), { type: 'button', title: new Date(s.time).toLocaleTimeString('pt-BR') },
        srcBox(s), el('span.hnum', { text: String(i + 1) }), el('span.hname', { text: s.name }), s === doc.savedState ? el('span.hsaved', { text: 'salvo', title: 'Estado salvo em arquivo' }) : null);
      row.addEventListener('click', () => { if (IMG.Tools.active && IMG.Tools.active.beforeCommand && IMG.Tools.active.beforeCommand('edit.goto') === true) return; h.goto(i); });
      list.appendChild(row);
      if (i === h.index) current = row;
    });
    if (current) current.scrollIntoView({ block: 'nearest' });
  }

  IMG.UI.registerPanel({
    id: 'history', title: 'Histórico',
    build(node) {
      root = node;
      const UI = IMG.UI;
      list = el('div.hlist');
      const foot = el('div.panel-foot',
        UI.iconBtn('undo', 'Desfazer (Ctrl+Z)', () => UI.run('edit.undo')),
        UI.iconBtn('redo', 'Refazer (Ctrl+Y)', () => UI.run('edit.redo')),
        UI.iconBtn('image', 'Novo instantâneo', () => { const d = IMG.app.doc; if (!d) return; d.snapshots = d.snapshots || []; d.snapshots.push({ name: 'Instantâneo ' + (d.snapshots.length + 1), state: d.history.capture('Instantâneo') }); render(); }),
        UI.iconBtn('trash', 'Excluir o instantâneo mais recente', () => { const d = IMG.app.doc; if (d && d.snapshots && d.snapshots.length) { const sn = d.snapshots.pop(); if (d.histSource === sn.state) d.histSource = null; render(); } }),
        el('span.pgroup-fill'),
        UI.btn('Limpar', () => { const d = IMG.app.doc; if (d) d.history.clear(); }, { small: true, title: 'Remove os passos anteriores e libera memória' }));
      root.append(list, foot);
      bus.on('history:change', render);
      bus.on('doc:change', render);
      bus.on('doc:rename', render);
      render();
    },
    onShow() { render(); }
  });
})();
