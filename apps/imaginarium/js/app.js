/* ==========================================================================
   Imaginarium — aplicação
   Estado global, preferências, comandos/atalhos, menus e inicialização.
   Os menus seguem a estrutura do Photopea. Módulos registram comandos
   extras em IMG.onInit; itens de menu sem comando registrado são ignorados.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus;

  const PREF_DEFAULTS = {
    historyMax: 120, smoothZoom: true, wheelZoom: false, checker: 'light',
    showRulers: false, showGrid: false, showGuides: true, lockGuides: false, showExtras: true, showSelEdges: true, showPath: true,
    gridSize: 50, gridSub: 5, gridColor: '#6fa3e0', guideColor: '#35d0ff',
    snap: true, smartGuides: true, snapGrid: true, snapGuides: true, snapLayers: true, snapBounds: true, snapPixels: false,
    pixelGrid: true, exportQuality: 92, shiftToolSwitch: true, units: 'px', workspaceColor: '#17181b', skin: 'imaginarium'
  };

  /* ==================================================================
     Estado
     ================================================================== */
  const app = (IMG.app = {
    docs: [],
    doc: null,
    fg: U.store.get('fg', '#000000'),
    bg: U.store.get('bg', '#ffffff'),
    prefs: Object.assign({}, PREF_DEFAULTS, U.store.get('prefs', {})),

    addDoc(doc) { this.docs.push(doc); this.setDoc(doc); },
    setDoc(doc) {
      if (this.doc === doc) return;
      const t = IMG.Tools.active;
      if (t && t.beforeCommand && this.doc) t.beforeCommand('doc.switch');
      this.doc = doc || null;
      bus.emit('doc:change', this.doc);
    },
    removeDoc(doc) {
      const i = this.docs.indexOf(doc);
      if (i < 0) return;
      this.docs.splice(i, 1);
      if (this.doc === doc) { this.doc = null; this.setDoc(this.docs[i] || this.docs[i - 1] || null); if (!this.doc) bus.emit('doc:change', null); }
      else bus.emit('doc:rename');
    },

    setFg(hex, src) { hex = U.normHex(hex); if (!hex || hex === this.fg) return; this.fg = hex; U.store.set('fg', hex); bus.emit('color:change', 'fg', src); },
    setBg(hex, src) { hex = U.normHex(hex); if (!hex || hex === this.bg) return; this.bg = hex; U.store.set('bg', hex); bus.emit('color:change', 'bg', src); },
    swapColors() { const f = this.fg; this.fg = this.bg; this.bg = f; U.store.set('fg', this.fg); U.store.set('bg', this.bg); bus.emit('color:change', 'both'); },
    resetColors() { this.fg = '#000000'; this.bg = '#ffffff'; U.store.set('fg', this.fg); U.store.set('bg', this.bg); bus.emit('color:change', 'both'); },

    savePrefs() { U.store.set('prefs', this.prefs); bus.emit('prefs:change'); },
    resetPrefs() { this.prefs = Object.assign({}, PREF_DEFAULTS); this.savePrefs(); }
  });

  /** Ganchos de inicialização dos módulos (registram comandos e painéis). */
  IMG.onInit = IMG.onInit || [];

  /* ==================================================================
     Comandos
     ================================================================== */
  function defineCommands() {
    const UI = IMG.UI, E = IMG.Engine, L = IMG.Layers, Sel = IMG.Selection, Files = IMG.Files, Ops = IMG.ImageOps, Clip = IMG.Clipboard, A = IMG.Adjust;
    const doc = () => app.doc;
    const has = () => !!app.doc;
    const act = () => app.doc && app.doc.active;
    const hasLayer = () => !!act();
    const hasSel = () => !!(app.doc && app.doc.selection);
    const hasMask = () => !!(act() && act().mask);
    const done = (label) => { bus.emit('layers:change', app.doc); IMG.commit(label); };
    const C = (id, label, run, o = {}) => UI.cmd(id, Object.assign({ label, run }, o));
    const pref = (id, label, key, keys) => C(id, label, () => { app.prefs[key] = !app.prefs[key]; app.savePrefs(); E.requestRender(); }, { checked: () => !!app.prefs[key], keys });
    IMG.cmdHelpers = { C, pref, doc, has, act, hasLayer, hasSel, hasMask, done };

    /* ---------- Arquivo ---------- */
    C('file.new', 'Novo…', () => Files.newDialog(), { keys: ['ctrl+alt+n', 'ctrl+n'] });
    C('file.open', 'Abrir…', () => Files.openDialog(), { keys: ['ctrl+o'] });
    C('file.openPlace', 'Abrir e inserir…', () => Files.placeDialog(), { enabled: has });
    C('file.openProject', 'Abrir projeto Imaginarium (.edt)…', () => Files.openProjectDialog());
    C('file.save', 'Salvar', () => Files.save(doc(), false), { enabled: has, keys: ['ctrl+s'] });
    C('file.saveProject', 'Salvar como projeto Imaginarium (.edt)…', () => Files.save(doc(), true), { enabled: has });
    C('file.exportPng', 'PNG', () => Files.exportDialog('png'), { enabled: has });
    C('file.exportJpg', 'JPG', () => Files.exportDialog('jpg'), { enabled: has });
    C('file.exportWebp', 'WEBP', () => Files.exportDialog('webp'), { enabled: has });
    C('file.exportPdf', 'PDF', () => Files.exportDialog('pdf'), { enabled: has });
    C('file.close', 'Fechar', () => Files.closeDoc(), { enabled: has, keys: ['ctrl+alt+w', 'ctrl+w'] });
    C('file.closeAll', 'Fechar todos', () => Files.closeAll(), { enabled: has });

    /* ---------- Editar ---------- */
    C('edit.undo', 'Desfazer', () => doc().history.undo(), { enabled: () => has() && doc().history.canUndo, keys: ['ctrl+z'] });
    C('edit.redo', 'Refazer', () => doc().history.redo(), { enabled: () => has() && doc().history.canRedo, keys: ['ctrl+shift+z', 'ctrl+y'] });
    C('edit.stepBack', 'Voltar um passo', () => doc().history.undo(), { enabled: () => has() && doc().history.canUndo, keys: ['ctrl+alt+z'] });
    C('edit.stepForward', 'Avançar um passo', () => doc().history.redo(), { enabled: () => has() && doc().history.canRedo, keys: ['ctrl+alt+shift+z'] });
    C('edit.cut', 'Recortar', () => Clip.cut(), { enabled: hasLayer, keys: ['ctrl+x'] });
    C('edit.copy', 'Copiar', () => Clip.copy(false), { enabled: hasLayer, keys: ['ctrl+c'] });
    C('edit.copyMerged', 'Copiar mesclado', () => Clip.copy(true), { enabled: has, keys: ['ctrl+shift+c'] });
    C('edit.paste', 'Colar', () => Clip.pasteCommand(), { hint: UI.keyLabel('ctrl+v') });
    C('edit.pasteInPlace', 'Colar no lugar', () => Clip.paste(true), { enabled: has, keys: ['ctrl+shift+v'] });
    C('edit.pasteInto', 'Colar dentro', () => Clip.pasteInto(false), { enabled: hasSel, keys: ['ctrl+alt+shift+v'] });
    C('edit.pasteOutside', 'Colar fora', () => Clip.pasteInto(true), { enabled: hasSel });
    C('edit.clear', 'Limpar', () => Ops.clear(doc()), { enabled: hasLayer, keys: ['delete', 'backspace'] });
    C('edit.fill', 'Preencher…', () => Ops.fillDialog(), { enabled: hasLayer, keys: ['shift+f5', 'shift+backspace'] });
    C('edit.fillFg', 'Preencher com a cor do primeiro plano', () => Ops.fill(doc(), app.fg, 1), { enabled: hasLayer, keys: ['alt+backspace', 'alt+delete'] });
    C('edit.fillFgKeep', 'Preencher com o primeiro plano (preservar transparência)', () => Ops.fill(doc(), app.fg, 1, { keepAlpha: true }), { enabled: hasLayer, keys: ['alt+shift+backspace', 'alt+shift+delete'] });
    C('edit.fillBg', 'Preencher com a cor de fundo', () => Ops.fill(doc(), app.bg, 1), { enabled: hasLayer, keys: ['ctrl+backspace', 'ctrl+delete'] });
    C('edit.fillBgKeep', 'Preencher com o fundo (preservar transparência)', () => Ops.fill(doc(), app.bg, 1, { keepAlpha: true }), { enabled: hasLayer, keys: ['ctrl+shift+backspace', 'ctrl+shift+delete'] });
    C('edit.stroke', 'Contornar…', () => Ops.strokeDialog(), { enabled: hasSel });
    C('edit.prefs', 'Preferências…', () => Files.prefsDialog(), { keys: ['ctrl+k'] });

    /* ---------- Imagem ---------- */
    C('image.resize', 'Tamanho da imagem…', () => Ops.resizeDialog(), { enabled: has, keys: ['ctrl+alt+i'] });
    C('image.canvas', 'Tamanho da tela…', () => Ops.canvasDialog(), { enabled: has, keys: ['ctrl+alt+c'] });
    C('image.rot180', '180°', () => Ops.rotate(doc(), 180), { enabled: has });
    C('image.rot90', '90° no sentido horário', () => Ops.rotate(doc(), 90), { enabled: has });
    C('image.rot270', '90° no sentido anti-horário', () => Ops.rotate(doc(), 270), { enabled: has });
    C('image.flipH', 'Inverter tela horizontalmente', () => Ops.flip(doc(), 'h'), { enabled: has });
    C('image.flipV', 'Inverter tela verticalmente', () => Ops.flip(doc(), 'v'), { enabled: has });
    C('image.trim', 'Aparar', () => Ops.trim(doc()), { enabled: has });
    C('image.crop', 'Cortar', () => Ops.cropToSelection(doc()), { enabled: hasSel });
    // ajustes destrutivos
    Object.keys(A.defs).forEach((k) => {
      const d = A.defs[k];
      C('adj.' + k, d.label + (d.direct ? '' : '…'), () => A.open(k), { enabled: hasLayer, keys: d.keys });
      if (d.layer) C('adjl.' + k, d.label + '…', () => A.newLayer(k), { enabled: has });
    });

    /* ---------- Camada ---------- */
    const newLayerDialog = async () => {
      const d = doc();
      const name = await UI.prompt('Nova camada', 'Nome', L.name(d, 'Camada'));
      if (name == null) return;
      L.newRaster(d, { name }); done('Nova camada');
    };
    C('layer.new', 'Camada…', newLayerDialog, { enabled: has, keys: ['ctrl+shift+n'] });
    C('layer.newQuick', 'Nova camada', () => { L.newRaster(doc()); done('Nova camada'); }, { enabled: has, keys: ['ctrl+alt+shift+n'] });
    C('layer.newGroup', 'Grupo…', () => { L.newGroup(doc()); done('Novo grupo'); }, { enabled: has });
    C('layer.viaCopy', 'Camada via cópia', () => Ops.layerVia(doc(), false), { enabled: hasLayer, keys: ['ctrl+j'] });
    C('layer.viaCut', 'Camada via recorte', () => Ops.layerVia(doc(), true), { enabled: hasLayer, keys: ['ctrl+shift+j'] });
    C('layer.fromBg', 'Camada a partir do fundo', () => { if (L.fromBackground(doc(), act())) done('Camada a partir do fundo'); }, { enabled: () => !!(act() && act().isBg) });
    C('layer.toBg', 'Fundo a partir da camada', () => { if (L.toBackground(doc(), act())) done('Fundo a partir da camada'); else UI.toast('Já existe uma camada Fundo, ou a camada não é de pixels.'); }, { enabled: () => !!(act() && act().type === 'raster' && !act().isBg) });
    C('layer.duplicate', 'Duplicar camada', () => { if (L.duplicate(doc())) done('Duplicar camada'); }, { enabled: hasLayer });
    C('layer.delete', 'Excluir camada', () => { if (L.deleteSelected(doc())) done('Excluir camada'); }, { enabled: hasLayer });
    C('layer.rename', 'Renomear camada…', async () => { const a = act(); const n = await UI.prompt('Renomear camada', 'Nome', a.name); if (n && n !== a.name) { a.name = n; if (a.text) a.text.auto = false; done('Renomear camada'); } }, { enabled: hasLayer, keys: ['f2'] });
    C('layer.mergeDown', 'Mesclar abaixo', () => { const s = L.selectedLayers(doc()); if (s.length > 1) { if (L.merge(doc(), s)) done('Mesclar camadas'); return; } if (L.mergeDown(doc())) done('Mesclar camadas'); else UI.toast('Não há camada abaixo para mesclar.'); }, { enabled: hasLayer, keys: ['ctrl+e'] });
    C('layer.mergeSelected', 'Mesclar camadas selecionadas', () => { const s = L.selectedLayers(doc()); if (s.length < 2) { UI.run('layer.mergeDown'); return; } if (L.merge(doc(), s)) done('Mesclar camadas'); }, { enabled: hasLayer });
    C('layer.mergeVisible', 'Mesclar visíveis', () => { if (L.mergeVisible(doc())) done('Mesclar visíveis'); }, { enabled: has, keys: ['ctrl+shift+e'] });
    C('layer.stampVisible', 'Carimbar visíveis em nova camada', () => { const d = doc(); const c = E.flatten(d); L.fromCanvas(d, c, L.name(d, 'Camada'), 0, 0, { outside: true }); done('Carimbar visíveis'); }, { enabled: has, keys: ['ctrl+alt+shift+e'] });
    C('layer.flatten', 'Achatar imagem', () => { L.flatten(doc()); done('Achatar imagem'); }, { enabled: has });
    C('layer.group', 'Agrupar camadas', () => { if (L.group(doc())) done('Agrupar camadas'); }, { enabled: hasLayer, keys: ['ctrl+g'] });
    C('layer.ungroup', 'Desagrupar camadas', () => { if (L.ungroup(doc(), act())) done('Desagrupar'); }, { enabled: () => !!(act() && act().type === 'group'), keys: ['ctrl+shift+g'] });
    C('layer.hide', 'Ocultar camadas', () => { const s = L.selectedLayers(doc()); const v = !s.every((q) => !q.visible); s.forEach((q) => { q.visible = !v; }); done(v ? 'Ocultar camadas' : 'Mostrar camadas'); }, { enabled: hasLayer, keys: ['ctrl+,'] });
    C('layer.clip', 'Criar máscara de recorte', () => { const s = L.selectedLayers(doc()); const on = !s.every((q) => q.clip); let ok = false; s.forEach((q) => { if (L.toggleClip(doc(), q, on)) ok = true; }); if (ok) done(on ? 'Criar máscara de recorte' : 'Liberar máscara de recorte'); }, { enabled: hasLayer, keys: ['ctrl+alt+g'], label2: () => (act() && act().clip ? 'Liberar máscara de recorte' : null) });
    const addMask = (mode, label) => () => { const a = act(); if (a.mask) { UI.toast('Esta camada já tem uma máscara.'); return; } if (a.isBg) L.fromBackground(doc(), a); if (L.addMask(doc(), a, mode)) { doc().editMask = true; done(label); } };
    C('layer.mask', 'Adicionar máscara de camada', () => addMask(hasSel() ? 'selection' : 'reveal', 'Adicionar máscara')(), { enabled: hasLayer });
    C('layer.maskReveal', 'Revelar tudo', addMask('reveal', 'Adicionar máscara'), { enabled: hasLayer });
    C('layer.maskHide', 'Ocultar tudo', addMask('hide', 'Adicionar máscara'), { enabled: hasLayer });
    C('layer.maskFromSel', 'Revelar seleção', addMask('selection', 'Máscara da seleção'), { enabled: () => hasLayer() && hasSel() });
    C('layer.maskHideSel', 'Ocultar seleção', addMask('hideSelection', 'Máscara da seleção'), { enabled: () => hasLayer() && hasSel() });
    C('layer.maskFromAlpha', 'A partir da transparência', addMask('transparency', 'Máscara da transparência'), { enabled: () => hasLayer() && !!act().canvas });
    C('layer.maskInvert', 'Inverter máscara', () => { if (L.invertMask(doc(), act())) done('Inverter máscara'); }, { enabled: hasMask });
    C('layer.maskApply', 'Aplicar', () => { if (L.applyMask(doc(), act())) done('Aplicar máscara'); else UI.toast('Não é possível aplicar a máscara nesta camada.'); }, { enabled: hasMask });
    C('layer.maskDelete', 'Excluir', () => { if (L.deleteMask(doc(), act())) done('Excluir máscara'); }, { enabled: hasMask });
    C('layer.maskToggle', 'Desativar', () => { if (L.toggleMask(doc(), act())) done(act().mask.enabled ? 'Ativar máscara' : 'Desativar máscara'); }, { enabled: hasMask, label2: () => (act() && act().mask && !act().mask.enabled ? 'Ativar' : null) });
    C('layer.maskLink', 'Desvincular', () => { const m = act().mask; m.linked = !m.linked; done(m.linked ? 'Vincular máscara' : 'Desvincular máscara'); }, { enabled: hasMask, label2: () => (act() && act().mask && !act().mask.linked ? 'Vincular' : null) });
    C('layer.rasterize', 'Rasterizar camada', () => { if (L.rasterize(doc(), act())) done('Rasterizar camada'); }, { enabled: () => !!(act() && act().type !== 'raster' && act().type !== 'adjust') });
    const order = (fn, label) => () => {
      const d = doc(); const sel = L.selectedLayers(d);
      for (const a of fn.up ? sel.slice().reverse() : sel) {
        if (a.isBg) continue;
        const list = L.siblings(d, a), i = list.indexOf(a); let j = fn(i, list.length);
        if (list[0] && list[0].isBg && j < 1) j = 1;
        if (j === i || j < 0 || j >= list.length) continue;
        list.splice(i, 1); list.splice(j, 0, a);
      }
      done(label);
    };
    const up = (i) => i + 1; up.up = true;
    const top = (i, n) => n - 1; top.up = true;
    C('layer.top', 'Trazer para a frente', order(top, 'Reorganizar camadas'), { enabled: hasLayer, keys: ['ctrl+shift+]', 'ctrl+shift+}'] });
    C('layer.up', 'Avançar', order(up, 'Reorganizar camadas'), { enabled: hasLayer, keys: ['ctrl+]'] });
    C('layer.down', 'Recuar', order((i) => i - 1, 'Reorganizar camadas'), { enabled: hasLayer, keys: ['ctrl+['] });
    C('layer.bottom', 'Enviar para trás', order(() => 0, 'Reorganizar camadas'), { enabled: hasLayer, keys: ['ctrl+shift+[', 'ctrl+shift+{'] });
    C('layer.reverse', 'Inverter ordem', () => { const d = doc(), s = L.selectedLayers(d); if (s.length < 2) return; const list = L.siblings(d, s[0]); if (!s.every((q) => L.siblings(d, q) === list)) { UI.toast('Selecione camadas do mesmo nível.'); return; } const idx = s.map((q) => list.indexOf(q)).sort((a, b) => a - b); const rev = idx.map((i) => list[i]).reverse(); idx.forEach((i, k) => { list[i] = rev[k]; }); done('Inverter ordem'); }, { enabled: hasLayer });
    C('layer.selectAbove', 'Selecionar camada acima', () => Ops.selectAdjacent(doc(), 1, false), { enabled: hasLayer, keys: ['alt+]'] });
    C('layer.selectBelow', 'Selecionar camada abaixo', () => Ops.selectAdjacent(doc(), -1, false), { enabled: hasLayer, keys: ['alt+['] });
    C('layer.addAbove', 'Adicionar camada acima à seleção', () => Ops.selectAdjacent(doc(), 1, true), { enabled: hasLayer, keys: ['alt+shift+]'] });
    C('layer.addBelow', 'Adicionar camada abaixo à seleção', () => Ops.selectAdjacent(doc(), -1, true), { enabled: hasLayer, keys: ['alt+shift+['] });
    C('layer.lockAll', 'Bloquear camadas', () => { const s = L.selectedLayers(doc()); const on = !s.every((q) => q.locked); s.forEach((q) => { q.locked = on; }); done(on ? 'Bloquear camadas' : 'Desbloquear camadas'); }, { enabled: hasLayer, keys: ['ctrl+/'] });
    C('layer.link', 'Vincular camadas', () => Ops.linkLayers(doc()), { enabled: () => has() && L.selectedLayers(doc()).length > 1 });
    C('layer.unlink', 'Desvincular camadas', () => Ops.unlinkLayers(doc()), { enabled: () => !!(act() && act().link) });
    C('layer.selectLinked', 'Selecionar camadas vinculadas', () => Ops.selectLinked(doc()), { enabled: () => !!(act() && act().link) });
    ['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom'].forEach((k, i) => C('layer.align.' + k, ['Bordas esquerdas', 'Centros horizontais', 'Bordas direitas', 'Bordas superiores', 'Centros verticais', 'Bordas inferiores'][i], () => Ops.align(k), { enabled: hasLayer }));
    ['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom'].forEach((k, i) => C('layer.dist.' + k, ['Bordas esquerdas', 'Centros horizontais', 'Bordas direitas', 'Bordas superiores', 'Centros verticais', 'Bordas inferiores'][i], () => Ops.distribute(k), { enabled: () => has() && L.selectedLayers(doc()).length > 2 }));
    C('layer.fillSolid', 'Cor sólida…', () => Ops.newFillLayer('solid'), { enabled: has });
    C('layer.fillGradient', 'Gradiente…', () => Ops.newFillLayer('gradient'), { enabled: has });
    C('layer.fillPattern', 'Padrão…', () => Ops.newFillLayer('pattern'), { enabled: has });
    C('layer.defringe', 'Remover franja…', () => Ops.matting('defringe'), { enabled: hasLayer });
    C('layer.removeBlack', 'Remover fosco preto', () => Ops.matting('black'), { enabled: hasLayer });
    C('layer.removeWhite', 'Remover fosco branco', () => Ops.matting('white'), { enabled: hasLayer });

    /* ---------- Selecionar ---------- */
    C('select.all', 'Tudo', () => { Sel.all(doc()); IMG.commit('Selecionar tudo'); }, { enabled: has, keys: ['ctrl+a'] });
    C('select.none', 'Desmarcar', () => { const d = doc(); if (d.selection) d.lastSelection = U.cloneCanvas(d.selection.canvas); if (Sel.clear(d)) IMG.commit('Desmarcar'); }, { enabled: hasSel, keys: ['ctrl+d'] });
    C('select.reselect', 'Selecionar novamente', () => { const d = doc(); if (!d.lastSelection) return; const s = Sel.ensure(d); const c = s.canvas.getContext('2d'); c.clearRect(0, 0, d.width, d.height); c.drawImage(d.lastSelection, 0, 0); IMG.markDirty(s); Sel.update(d); IMG.commit('Selecionar novamente'); }, { enabled: () => has() && !!doc().lastSelection, keys: ['ctrl+shift+d'] });
    C('select.invert', 'Inverter', () => { Sel.invert(doc()); IMG.commit('Inverter seleção'); }, { enabled: has, keys: ['ctrl+shift+i', 'shift+f7'] });
    C('select.allLayers', 'Todas as camadas', () => { const d = doc(); const all = L.all(d).filter((q) => !q.isBg); d.selected = new Set(all.map((q) => q.id)); if (all.length) d.activeId = all[all.length - 1].id; bus.emit('layers:select'); }, { enabled: has, keys: ['ctrl+alt+a'] });
    C('select.deselectLayers', 'Desmarcar camadas', () => { L.setActive(doc(), null); }, { enabled: hasLayer });
    C('select.fromLayer', 'Carregar pixels da camada', () => { Sel.fromLayer(doc(), act()); IMG.commit('Carregar seleção'); }, { enabled: hasLayer });
    const selNum = (title, label, def, max, fn, commit) => async () => {
      let v = def;
      UI.dialog({ title, width: 320, body: UI.row(label, UI.num({ value: def, min: 1, max, unit: 'px', width: 100, onInput: (x) => { v = x; } }).el),
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => { fn(v); IMG.commit(commit); } }] });
    };
    C('select.feather', 'Difusão…', selNum('Difundir seleção', 'Raio de difusão', 8, 1000, (v) => Sel.feather(doc(), v), 'Difusão'), { enabled: hasSel, keys: ['shift+f6'] });
    C('select.expand', 'Expandir…', selNum('Expandir seleção', 'Expandir em', 4, 500, (v) => Sel.grow(doc(), v), 'Expandir'), { enabled: hasSel });
    C('select.contract', 'Contrair…', selNum('Contrair seleção', 'Contrair em', 4, 500, (v) => Sel.grow(doc(), -v), 'Contrair'), { enabled: hasSel });

    /* ---------- Filtro ---------- */
    const FX = IMG.FX;
    Object.keys(FX.defs).forEach((id) => { const d = FX.defs[id]; C('filter.' + id, d.label + (d.direct ? '' : '…'), () => FX.open(id), { enabled: hasLayer, keys: d.keys }); });
    C('filter.repeat', 'Último filtro', () => FX.repeat(), { enabled: () => hasLayer() && !!FX.last, keys: ['ctrl+f'], label2: () => (FX.last && FX.last.id ? 'Último filtro (' + FX.label(FX.last.id) + ')' : null) });

    /* ---------- Visualizar ---------- */
    C('view.zoomIn', 'Aproximar', () => E.zoomStep(1), { enabled: has, keys: ['ctrl+plus', 'ctrl+shift+plus'] });
    C('view.zoomOut', 'Afastar', () => E.zoomStep(-1), { enabled: has, keys: ['ctrl+minus', 'ctrl+shift+minus'] });
    C('view.fit', 'Ajustar à área', () => E.fit(), { enabled: has, keys: ['ctrl+0'] });
    C('view.actual', 'Pixel a pixel', () => E.actualSize(), { enabled: has, keys: ['ctrl+1', 'ctrl+alt+0'] });
    C('view.fill', 'Preencher a área', () => E.fit(true, true), { enabled: has });
    C('view.resetRotation', 'Redefinir rotação da vista', () => E.setRotation(0), { enabled: () => has() && !!doc().view.rot });
    pref('view.rulers', 'Réguas', 'showRulers', ['ctrl+r']);
    pref('view.extras', 'Extras', 'showExtras', ['ctrl+h']);
    pref('view.selEdges', 'Bordas da seleção', 'showSelEdges');
    pref('view.targetPath', 'Demarcador de destino', 'showPath', ['ctrl+shift+h']);
    pref('view.grid', 'Grade', 'showGrid', ["ctrl+'"]);
    pref('view.guides', 'Guias', 'showGuides', ['ctrl+;']);
    pref('view.lockGuides', 'Bloquear guias', 'lockGuides', ['ctrl+alt+;']);
    pref('view.snap', 'Encaixar', 'snap', ['ctrl+shift+;', 'ctrl+shift+:']);
    pref('view.snapGuides', 'Guias', 'snapGuides');
    pref('view.snapLayers', 'Camadas', 'snapLayers');
    pref('view.snapBounds', 'Limites do documento', 'snapBounds');
    pref('view.snapGrid', 'Grade', 'snapGrid');
    pref('view.smart', 'Guias inteligentes', 'smartGuides');
    pref('view.pixelGrid', 'Grade de pixels', 'pixelGrid');
    C('view.clearGuides', 'Limpar guias', () => { const d = doc(); if (d.guides.h.length + d.guides.v.length) { d.guides = { h: [], v: [] }; IMG.commit('Limpar guias'); E.requestRender(); } }, { enabled: has });
    C('view.newGuide', 'Nova guia…', () => {
      const d = doc(); let o = 'v', pos = Math.round(d.width / 2);
      UI.dialog({ title: 'Nova guia', width: 320, body: [UI.row('Orientação', UI.select([['v', 'Vertical'], ['h', 'Horizontal']], o, (v) => { o = v; }, { keepFocus: true }).el), UI.row('Posição', UI.num({ value: pos, min: -30000, max: 30000, unit: 'px', width: 100, onInput: (v) => { pos = v; } }).el)],
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => { d.guides[o].push(pos); app.prefs.showGuides = true; IMG.commit('Nova guia'); E.requestRender(); } }] });
    }, { enabled: has });
    C('view.newGuideLayout', 'Novo layout de guias…', () => Ops.guideLayoutDialog(), { enabled: has });
    C('view.fullscreen', 'Tela cheia', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => UI.toast('O navegador não permitiu a tela cheia.')); }, { checked: () => !!document.fullscreenElement, keys: ['f11'] });
    C('view.hideUI', 'Ocultar painéis', () => { document.body.classList.toggle('hide-ui'); bus.emit('dock:change'); }, { keys: ['tab'], checked: () => document.body.classList.contains('hide-ui') });

    /* ---------- Janela ---------- */
    UI.panelOrder.forEach((id) => C('window.' + id, UI.panels[id].title, () => UI.togglePanel(id), { checked: () => UI.panelShown(id), keys: UI.panels[id].keys }));
    C('window.reset', 'Restaurar layout dos painéis', () => UI.resetDock());
    C('window.dock', 'Mostrar/ocultar painéis', () => { document.body.classList.toggle('hide-dock'); bus.emit('dock:change'); }, { keys: ['shift+tab'], checked: () => !document.body.classList.contains('hide-dock') });

    /* ---------- Ferramentas (comandos internos) ---------- */
    IMG.Tools.order.forEach((id) => { const t = IMG.Tools.defs[id]; if (!t.hidden) C('tools.' + id, t.name, () => { if (!(IMG.Tools.active && IMG.Tools.active.modal)) IMG.Tools.set(id); }, { hint: t.key ? t.key.toUpperCase() : '', checked: () => IMG.Tools.activeId === id }); });
    C('tools.swap', 'Trocar cores', () => app.swapColors(), { keys: ['x'] });
    C('tools.reset', 'Cores padrão', () => app.resetColors(), { keys: ['d'] });

    /* ---------- Ajuda ---------- */
    C('help.manual', 'Manual do Imaginarium', () => UI.openHelp('manual'), { keys: ['f1'] });
    C('help.credits', 'Sobre o Imaginarium', () => UI.openHelp('credits'));
    // [Nebulosa] menu Ajuda (0.5): Manual do usuário, Termos de uso, Privacidade, Créditos e licenças — abrem aqui mesmo, numa janela
    const nbAjuda = (k) => { const N = window.NebulosaSkin; if (N && N.abrirAjuda) return N.abrirAjuda(k); const P = { manual: 'manuais/imaginarium.html', termos: 'legal/termos.html', privacidade: 'legal/privacidade.html', creditos: 'legal/creditos.html' }; window.open('https://nebulosaworkspace.com.br/' + (P[k] || P.manual), '_blank'); };
    C('help.nbManual', 'Manual do usuário', () => nbAjuda('manual'));
    C('help.nbTermos', 'Termos de uso', () => nbAjuda('termos'));
    C('help.nbPrivacidade', 'Privacidade', () => nbAjuda('privacidade'));
    C('help.nbCreditos', 'Créditos e licenças', () => nbAjuda('creditos'));
    C('help.nbIdioma', '🌐 Idioma', () => nbAjuda('idioma')); // [Nebulosa] idiomas (0.6)

    /* ---------- módulos ---------- */
    IMG.onInit.forEach((fn) => { try { fn(C, IMG.cmdHelpers); } catch (err) { console.error(err); } });
  }

  function menus() {
    const UI = IMG.UI, A = IMG.Adjust, FX = IMG.FX;
    const adjItems = A.MENU_ORDER.map((k) => (k === '-' ? '-' : 'adj.' + k));
    const adjLayerItems = A.LAYER_ORDER.map((k) => (k === '-' ? '-' : 'adjl.' + k));
    const filterGroup = (g) => ({ label: FX.GROUP_NAMES[g], enabled: () => !!app.doc, items: () => (FX.groups[g] || []).map((id) => 'filter.' + id) });
    const fxItems = IMG.Effects.LIST.map((k) => 'layer.style.' + k);
    return [
      { label: 'Arquivo', items: ['file.new', 'file.open', 'file.openPlace', { label: 'Abrir recentes', items: () => (IMG.Files.recentItems ? IMG.Files.recentItems() : []) }, '-',
        'file.save', 'file.saveAsPsd', 'file.saveProject', { label: 'Exportar como', enabled: () => !!app.doc, items: ['file.exportPng', 'file.exportJpg', 'file.exportWebp', 'file.exportGif', 'file.exportSvg', 'file.exportPdf', '-', 'file.exportBmp', 'file.exportTiff', 'file.exportIco', 'file.exportTga', 'file.exportPsd', '-', 'file.exportArtboards', 'file.exportSlices'] }, 'file.exportAs', 'file.exportLayers', 'file.exportLut', '-',
        'file.print', { label: 'Automatizar', items: ['file.batch', 'file.contactSheet'] }, 'file.script', 'file.info', '-', 'file.close', 'file.closeAll'] },
      { label: 'Editar', items: ['edit.undo', 'edit.redo', 'edit.stepBack', 'edit.stepForward', 'edit.fade', '-', 'edit.cut', 'edit.copy', 'edit.copyMerged', 'edit.paste', { label: 'Colar especial', enabled: () => !!app.doc, items: ['edit.pasteInPlace', 'edit.pasteInto', 'edit.pasteOutside'] }, 'edit.clear', '-',
        'edit.fill', 'edit.stroke', 'edit.contentAware', '-', 'edit.contentScale', 'edit.puppetWarp', 'edit.perspectiveWarp', 'edit.transform',
        { label: 'Transformar', enabled: () => !!(app.doc && app.doc.active), items: ['edit.tAgain', '-', 'edit.tScale', 'edit.tRotate', 'edit.tSkew', 'edit.tDistort', 'edit.tPerspective', 'edit.tWarp', '-', 'edit.tRot180', 'edit.tRot90', 'edit.tRot270', '-', 'edit.tFlipH', 'edit.tFlipV'] },
        'edit.autoAlign', 'edit.autoBlend', '-', { label: 'Definir novo', enabled: () => !!app.doc, items: ['edit.defineBrush', 'edit.definePattern', 'edit.defineShape'] }, 'edit.presets', '-', 'edit.shortcuts', 'edit.prefs'] },
      { label: 'Imagem', items: [{ label: 'Modo', enabled: () => !!app.doc, items: ['image.modeBitmap', 'image.modeGray', 'image.modeIndexed', 'image.modeRgb', 'image.modeCmyk', 'image.modeLab', '-', 'image.bits8', 'image.bits16', 'image.bits32'] },
        { label: 'Ajustes', enabled: () => !!app.doc, items: adjItems }, '-', 'adj.autoTone', 'adj.autoContrast', 'adj.autoColor', '-',
        'image.resize', 'image.canvas', { label: 'Rotação da imagem', enabled: () => !!app.doc, items: ['image.rot180', 'image.rot90', 'image.rot270', 'image.rotArbitrary', '-', 'image.flipH', 'image.flipV'] }, '-',
        'image.crop', 'image.trim', 'image.revealAll', '-', 'image.duplicate', 'image.applyImage', 'image.vectorize', 'image.variables'] },
      { label: 'Camada', items: [{ label: 'Novo', enabled: () => !!app.doc, items: ['layer.new', 'layer.newGroup', 'layer.groupFromLayers', '-', 'layer.newArtboard', 'layer.artboardFromGroup', 'layer.artboardFromLayers', '-', 'layer.fromBg', 'layer.toBg', '-', 'layer.viaCopy', 'layer.viaCut'] },
        'layer.duplicate', 'layer.duplicateInto', 'layer.delete', 'layer.rename', 'layer.props', '-',
        { label: 'Estilo de camada', enabled: () => !!(app.doc && app.doc.active), items: ['layer.style.blending', '-', ...fxItems, '-', 'layer.style.copy', 'layer.style.paste', 'layer.style.clear', 'layer.style.new', '-', 'layer.style.globalLight', 'layer.style.scale'] },
        { label: 'Nova camada de preenchimento', enabled: () => !!app.doc, items: ['layer.fillSolid', 'layer.fillGradient', 'layer.fillPattern'] },
        { label: 'Nova camada de ajuste', enabled: () => !!app.doc, items: adjLayerItems }, '-',
        { label: 'Máscara de camada', enabled: () => !!(app.doc && app.doc.active), items: ['layer.maskReveal', 'layer.maskHide', 'layer.maskFromSel', 'layer.maskHideSel', 'layer.maskFromAlpha', '-', 'layer.maskInvert', 'layer.maskDelete', 'layer.maskApply', '-', 'layer.maskToggle', 'layer.maskLink'] },
        { label: 'Máscara vetorial', enabled: () => !!(app.doc && app.doc.active), items: ['layer.vmaskReveal', 'layer.vmaskHide', 'layer.vmaskPath', '-', 'layer.vmaskDelete', 'layer.vmaskToggle'] },
        'layer.clip', '-',
        { label: 'Objetos inteligentes', enabled: () => !!(app.doc && app.doc.active), items: ['layer.smartConvert', 'layer.smartViaCopy', '-', 'layer.smartEdit', 'layer.smartReset', '-', 'layer.smartReplace', 'layer.smartExport', 'layer.smartToLayers', '-', 'layer.smartRasterize'] },
        { label: 'Rasterizar', enabled: () => !!(app.doc && app.doc.active), items: ['layer.rasterize', 'layer.rasterizeStyle', 'layer.vmaskRasterize'] },
        { label: 'Texto', enabled: () => !!(app.doc && app.doc.active && app.doc.active.type === 'text'), items: ['type.warp', '-', 'type.toBox', 'type.toPoint', '-', 'type.horizontal', 'type.vertical', '-', 'type.toPath', 'type.toShape', 'type.rasterize', '-', 'type.lorem'] }, '-',
        'layer.group', 'layer.ungroup', 'layer.hide', '-',
        { label: 'Organizar', enabled: () => !!(app.doc && app.doc.active), items: ['layer.top', 'layer.up', 'layer.down', 'layer.bottom', '-', 'layer.reverse'] },
        { label: 'Combinar formas', enabled: () => !!(app.doc && app.doc.active), items: ['shape.unite', 'shape.subtract', 'shape.intersect', 'shape.exclude'] },
        { label: 'Alinhar', enabled: () => !!(app.doc && app.doc.active), items: ['layer.align.top', 'layer.align.vcenter', 'layer.align.bottom', '-', 'layer.align.left', 'layer.align.hcenter', 'layer.align.right'] },
        { label: 'Distribuir', enabled: () => !!(app.doc && app.doc.active), items: ['layer.dist.top', 'layer.dist.vcenter', 'layer.dist.bottom', '-', 'layer.dist.left', 'layer.dist.hcenter', 'layer.dist.right'] },
        'layer.lockAll', 'layer.link', 'layer.unlink', 'layer.selectLinked', '-',
        'layer.mergeDown', 'layer.mergeVisible', 'layer.stampVisible', 'layer.flatten', '-',
        { label: 'Aparação', enabled: () => !!(app.doc && app.doc.active), items: ['layer.defringe', 'layer.removeBlack', 'layer.removeWhite'] }] },
      { label: 'Selecionar', items: ['select.all', 'select.none', 'select.reselect', 'select.invert', '-', 'select.allLayers', 'select.deselectLayers', 'select.findLayers', '-',
        'select.colorRange', 'select.refineEdge', { label: 'Modificar', enabled: () => !!(app.doc && app.doc.selection), items: ['select.border', 'select.smooth', 'select.expand', 'select.contract', 'select.feather'] }, 'select.grow', 'select.similar', '-',
        'select.transform', 'select.quickMask', '-', 'select.fromLayer', 'select.load', 'select.save', 'select.toPath'] },
      { label: 'Filtro', items: () => ['filter.repeat', '-', 'filter.smartConvert', '-', 'filter.gallery', 'filter.cameraRaw', 'filter.lensCorrection', 'filter.liquify', 'filter.vanishing', '-',
        ...['blur', 'blurGallery', 'distort', 'noise', 'pixelate', 'render', 'sharpen', 'stylize', 'other'].filter((g) => FX.groups[g] && FX.groups[g].length).map(filterGroup)] },
      { label: 'Visualizar', items: ['view.zoomIn', 'view.zoomOut', 'view.fit', 'view.actual', 'view.fill', 'view.resetRotation', '-',
        { label: 'Mostrar', enabled: () => !!app.doc, items: ['view.extras', '-', 'view.selEdges', 'view.targetPath', 'view.grid', 'view.guides', 'view.smart', 'view.pixelGrid', 'view.slices'] },
        'view.rulers', '-', 'view.snap', { label: 'Encaixar em', items: ['view.snapGuides', 'view.snapLayers', 'view.snapBounds', 'view.snapGrid'] }, '-',
        'view.lockGuides', 'view.clearGuides', 'view.newGuide', 'view.newGuideLayout', 'view.guidesFromShape', '-', 'view.lockSlices', 'view.clearSlices', '-', 'view.printSize', 'view.fullscreen', 'view.hideUI'] },
      { label: 'Janela', items: () => UI.panelOrder.slice().sort((a, b) => UI.panels[a].title.localeCompare(UI.panels[b].title)).map((id) => 'window.' + id).concat(['-', 'window.dock', 'window.reset']) },
      { label: 'Ajuda', items: ['help.nbManual', 'help.manual', 'help.shortcuts', '-', 'help.nbTermos', 'help.nbPrivacidade', 'help.nbCreditos', '-', 'help.nbIdioma', 'help.credits'] } // [Nebulosa] menu Ajuda (0.5)
    ];
  }
  IMG.buildMenus = menus;

  /* ==================================================================
     Eventos globais
     ================================================================== */
  function wireGlobal() {
    const UI = IMG.UI, Files = IMG.Files, Clip = IMG.Clipboard;

    // arrastar e soltar arquivos
    const dz = U.$('#dropzone');
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; dz.classList.add('show'); });
    window.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    window.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) dz.classList.remove('show'); });
    window.addEventListener('drop', async (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; dz.classList.remove('show');
      if (UI.modalCount) return;
      const files = Array.from(e.dataTransfer.files || []);
      const doc = app.doc;
      const onCanvas = doc && e.target.closest && e.target.closest('#viewport');
      const isDoc = (f) => /\.(edt|psd|psb)$/i.test(f.name);
      const images = files.filter((f) => !isDoc(f)), projects = files.filter(isDoc);
      if (onCanvas && !e.shiftKey) { for (const f of images) await Files.placeFile(doc, f); }
      else await Files.openFiles(images);
      await Files.openFiles(projects);
    });

    // colar (Ctrl+V) — imagem do sistema ou cópia interna
    window.addEventListener('blur', () => { Clip.fresh = false; });
    document.addEventListener('paste', (e) => {
      if (U.isTyping(e.target) || UI.modalCount) return;
      e.preventDefault();
      const t = IMG.Tools.active;
      if (t && t.beforeCommand && t.beforeCommand('edit.paste') === true) return;
      const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
      const img = items.find((i) => i.kind === 'file' && /^image\//.test(i.type));
      if (Clip.data && (Clip.fresh || !img)) { Clip.paste(false); return; }
      if (img) { const f = img.getAsFile(); if (f) Clip.pasteBlob(f).catch((err) => UI.fail(err)); return; }
      const txt = e.clipboardData && e.clipboardData.getData('text/plain');
      if (txt && app.doc && IMG.Text && IMG.Text.pasteAsLayer) { IMG.Text.pasteAsLayer(txt); return; }
      UI.toast('Não há imagem na área de transferência.');
    });
    const origCopy = Clip.copy.bind(Clip);
    Clip.copy = function (merged) { const r = origCopy(merged); if (r) Clip.fresh = true; return r; };

    // aviso ao sair com alterações não salvas
    window.addEventListener('beforeunload', (e) => { if (app.docs.some((d) => d.dirty)) { e.preventDefault(); e.returnValue = ''; } });

    // ferramentas com estado dependente do documento
    const crop = IMG.Tools.defs.crop;
    bus.on('doc:change', () => { if (IMG.Transform && IMG.Transform.s) IMG.Transform.cancel(); if (IMG.Tools.activeId === 'crop' && crop) { crop.reset(); UI.renderOptions(); } });
    bus.on('doc:resize', (d) => {
      if (IMG.Tools.activeId === 'crop' && crop) { crop.reset(); UI.renderOptions(); }
      // camadas de preenchimento acompanham o tamanho da tela
      if (d) IMG.Layers.walk(d.layers, (q) => { if (q.type === 'fill') IMG.Layers.renderFill(q, d); });
    });
    bus.on('layers:select', () => { const id = IMG.Tools.activeId; if (id === 'text' && !(IMG.Text && IMG.Text.edit)) UI.renderOptions(); });
    bus.on('history:change', () => { if (IMG.Tools.activeId === 'text' && !(IMG.Text && IMG.Text.edit)) UI.renderOptions(); });
    bus.on('fonts:change', () => { if (IMG.Tools.activeId === 'text') UI.renderOptions(); });
    bus.on('prefs:change', () => { if (app.doc) { const max = app.doc.history.max, h = app.doc.history; if (h.states.length > max) { const cut = h.states.length - max; h.states.splice(0, cut); h.index = Math.max(0, h.index - cut); bus.emit('history:change', app.doc); } } });
    bus.on('color:change', () => { if (app.doc) IMG.Layers.walk(app.doc.layers, (q) => { if (q.adj && q.adj.kind === 'gradientMap') IMG.Engine.invalidate(); }); });
    document.addEventListener('fullscreenchange', () => IMG.Engine.resize());

    // atalhos da tela inicial (tamanhos prontos)
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-new]');
      if (!b) return;
      const [w, h] = b.dataset.new.split('x').map(Number);
      Files.create({ name: 'Sem título ' + (app.docs.length + 1), width: w, height: h, background: '#ffffff' });
    });
  }

  /* ==================================================================
     Inicialização
     ================================================================== */
  function init() {
    const T = IMG.Tools, UI = IMG.UI;
    IMG.Engine.init();
    T.init();
    if (IMG.Skins) IMG.Skins.init();
    defineCommands();
    UI.init();
    UI.setMenus(menus());
    T.set('move');
    wireGlobal();
    try { IMG.Fonts.detect(); } catch (e) { console.warn(e); }

    U.$('#app').classList.add('ready');
    IMG.ready = true;
    bus.emit('app:ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
