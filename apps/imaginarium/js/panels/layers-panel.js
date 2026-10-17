/* ==========================================================================
   Imaginarium — painel Camadas (no modelo do Photopea)
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const Layers = IMG.Layers;

  const TW = 38, TH = 28;
  let root, list, blendSel, opCtl, fillCtl, lockBtns = {}, thumbs = new Map(), checker = null;
  const doc = () => IMG.app.doc;

  function changed(label, structural = true) {
    bus.emit(structural ? 'layers:change' : 'layers:props', doc());
    IMG.Engine.invalidate();
    if (label) IMG.commit(label);
  }

  /* ---------- miniaturas ---------- */
  function drawThumb(cv, L, isMask) {
    const d = doc(); if (!d) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(TW * dpr), H = Math.round(TH * dpr);
    if (cv.width !== W) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    const k = Math.min(W / d.width, H / d.height), w = Math.max(1, d.width * k), h = Math.max(1, d.height * k), ox = (W - w) / 2, oy = (H - h) / 2;
    if (isMask) { c.fillStyle = L.mask.bg ? '#fff' : '#000'; c.fillRect(ox, oy, w, h); if (L.mask.bg) { c.fillStyle = '#000'; c.fillRect(ox + L.mask.x * k, oy + L.mask.y * k, L.mask.canvas.width * k, L.mask.canvas.height * k); } }
    else {
      if (!checker) { const p = U.domCanvas(8, 8), x = p.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 8, 8); x.fillStyle = '#cfcfcf'; x.fillRect(4, 0, 4, 4); x.fillRect(0, 4, 4, 4); checker = p; }
      c.fillStyle = c.createPattern(checker, 'repeat'); c.fillRect(ox, oy, w, h);
    }
    c.save();
    c.beginPath(); c.rect(ox, oy, w, h); c.clip();
    c.imageSmoothingQuality = 'medium';
    const s = isMask ? L.mask : L;
    if (s && s.canvas) c.drawImage(s.canvas, ox + s.x * k, oy + s.y * k, s.canvas.width * k, s.canvas.height * k);
    c.restore();
  }
  function thumbFor(L, isMask) {
    const key = L.id + (isMask ? ':m' : '');
    let t = thumbs.get(key);
    const ver = isMask ? (L.mask._ver || 0) + ':' + L.mask.x + ':' + L.mask.y + ':' + L.mask.bg : (L._ver || 0) + ':' + L.x + ':' + L.y;
    const d = doc(), sig = ver + ':' + d.width + 'x' + d.height;
    if (!t) { t = { cv: U.domCanvas(TW, TH), sig: null }; t.cv.className = 'lthumb-cv'; thumbs.set(key, t); }
    if (t.sig !== sig) { t.sig = sig; drawThumb(t.cv, L, isMask); }
    return t.cv;
  }
  const refreshThumb = U.debounce((L) => {
    if (!root || !root.isConnected || !L) return;
    const d = doc(); if (!d || !Layers.find(d, L.id)) return;
    if (L.canvas && L.type !== 'adjust') thumbFor(L, false);
    if (L.mask) thumbFor(L, true);
  }, 120);

  function fillThumb(L) {
    const f = L.fillDef, c = U.domCanvas(TW, TH), x = c.getContext('2d');
    c.className = 'lthumb-cv';
    if (f.type === 'solid') { x.fillStyle = f.color; x.fillRect(0, 0, TW, TH); }
    else if (f.type === 'gradient') { const g = IMG.Gradients.preview(f.gradient, TW, TH, f.reverse); x.drawImage(g, 0, 0); }
    else IMG.Patterns.fill(x, f.pattern, TW, TH);
    return c;
  }

  /* ---------- seleção a partir de camada / máscara ---------- */
  function selMode(e) { return e.shiftKey && e.altKey ? 'int' : e.shiftKey ? 'add' : e.altKey ? 'sub' : 'new'; }
  function loadSelection(L, fromMask, e) {
    const d = doc();
    if (fromMask) IMG.Selection.fromMask(d, L, selMode(e));
    else IMG.Selection.fromLayer(d, L, selMode(e));
    IMG.commit('Carregar seleção');
  }

  /* ---------- linhas ---------- */
  function clipBaseIds(d) {
    const ids = new Set();
    Layers.walk(d.layers, (L) => { if (L.clip) { const b = Layers.clipBase(d, L); if (b) ids.add(b.id); } });
    return ids;
  }

  function rowFor(L, depth, bases) {
    const d = doc();
    const sel = d.selected.has(L.id), act = d.activeId === L.id;
    const row = el('div.lrow' + (sel ? '.selected' : '') + (act ? '.active' : '') + (L.visible ? '' : '.off') + (L.type === 'group' ? '.group' : '') + (L.clip ? '.clipped' : ''), { data: { id: L.id } });
    if (L.color) row.style.setProperty('--lcolor', L.color);
    const eye = el('button.leye', { type: 'button', title: 'Visibilidade (Alt+clique: mostrar só esta)', 'aria-label': 'Visibilidade', html: IMG.icon(L.visible ? 'eye' : 'eyeOff', 15) });
    eye.addEventListener('pointerdown', (e) => e.stopPropagation());
    eye.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.altKey) {
        const others = Layers.all(d).filter((q) => q !== L && !Layers.hasAncestor(L, q) && !Layers.hasAncestor(q, L));
        const solo = others.some((q) => q.visible);
        if (solo) { L._soloSaved = others.filter((q) => q.visible).map((q) => q.id); others.forEach((q) => { q.visible = false; }); }
        else { const ids = new Set(L._soloSaved || others.map((q) => q.id)); others.forEach((q) => { if (ids.has(q.id)) q.visible = true; }); L._soloSaved = null; }
        for (let p = L; p; p = p.parent) p.visible = true;
      } else L.visible = !L.visible;
      changed(L.visible ? 'Mostrar camada' : 'Ocultar camada');
    });
    row.appendChild(eye);
    row.appendChild(el('span.lindent', { style: { width: depth * 14 + 'px' } }));
    if (L.clip) row.appendChild(el('span.lclip', { title: 'Recortada na camada abaixo', html: IMG.icon('clipArrow', 13) }));

    if (L.type === 'group') {
      const tw = el('button.ltwist', { type: 'button', title: L.expanded ? 'Recolher grupo' : 'Expandir grupo', html: IMG.icon(L.expanded ? 'chevronDown' : 'chevronRight', 12) });
      tw.addEventListener('pointerdown', (e) => e.stopPropagation());
      tw.addEventListener('click', (e) => { e.stopPropagation(); if (e.altKey) { const v = !L.expanded; Layers.walk([L], (q) => { if (q.type === 'group') q.expanded = v; }); } else L.expanded = !L.expanded; render(); });
      row.appendChild(tw);
      row.appendChild(el('span.lthumb.folder', { html: IMG.icon(L.artboard ? 'artboard' : 'folder', 18) }));
    } else if (L.type === 'adjust') {
      row.appendChild(el('span.lthumb.adj' + (act && !d.editMask ? '.target' : ''), { title: 'Camada de ajuste (clique duplo: propriedades)', html: IMG.icon('adjLayer', 18) }));
    } else if (L.type === 'fill') {
      row.appendChild(el('span.lthumb.fill' + (act && !d.editMask ? '.target' : ''), { title: 'Camada de preenchimento (clique duplo: editar)' }, fillThumb(L)));
    } else {
      const th = el('span.lthumb' + (act && !d.editMask ? '.target' : ''), { title: L.type === 'text' ? 'Camada de texto (clique duplo: editar o texto)' : L.type === 'shape' ? 'Camada de forma' : L.type === 'smart' ? 'Objeto inteligente (clique duplo: editar conteúdo)' : 'Pixels da camada — Ctrl+clique: carregar seleção' }, thumbFor(L, false));
      if (L.type === 'text') th.appendChild(el('span.lbadge', { text: 'T' }));
      else if (L.type === 'shape') th.appendChild(el('span.lbadge', { text: '◆' }));
      else if (L.type === 'smart') th.appendChild(el('span.lbadge', { html: IMG.icon('smart', 10) }));
      row.appendChild(th);
    }
    if (L.mask) {
      const m = L.mask;
      const link = el('button.llink' + (m.linked !== false ? '.on' : ''), { type: 'button', title: m.linked !== false ? 'Máscara vinculada à camada' : 'Máscara desvinculada', html: IMG.icon('chain', 11) });
      link.addEventListener('pointerdown', (e) => e.stopPropagation());
      link.addEventListener('click', (e) => { e.stopPropagation(); m.linked = m.linked === false; changed(m.linked ? 'Vincular máscara' : 'Desvincular máscara'); });
      const mt = el('span.lthumb.mask' + (act && d.editMask ? '.target' : '') + (m.enabled !== false ? '' : '.disabled'), { title: 'Máscara — clique: editar · Shift+clique: desativar · Alt+clique: exibir · Ctrl+clique: carregar seleção' }, thumbFor(L, true));
      mt.dataset.mask = '1';
      row.appendChild(link); row.appendChild(mt);
    }
    if (L.vmask) {
      const vt = el('span.lthumb.vmask' + (act && d.pathTarget === 'vmask' ? '.target' : '') + (L.vmask.enabled === false ? '.disabled' : ''), { title: 'Máscara vetorial — clique: editar o demarcador · Shift+clique: desativar · Ctrl+clique: carregar seleção', html: IMG.icon('vmask', 18) });
      vt.addEventListener('pointerdown', (e) => e.stopPropagation());
      vt.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.shiftKey) { IMG.UI.run('layer.vmaskToggle'); return; }
        if (e.ctrlKey || e.metaKey) { IMG.Paths.toSelection(d, L.vmask.path || IMG.Paths.empty(), e.altKey ? 'sub' : 'new'); IMG.commit('Carregar seleção'); return; }
        IMG.Layers.setActive(d, L.id); d.editMask = false; d.pathTarget = 'vmask';
        if (!/^(pen|freePen|curvPen|pathSelect|directSelect|addAnchor|delAnchor|convertPt)$/.test(IMG.Tools.activeId)) IMG.Tools.set('directSelect');
        bus.emit('layers:select', d); bus.emit('paths:change', d); IMG.Engine.requestRender();
      });
      row.appendChild(vt);
    }
    const name = el('span.lname' + (bases.has(L.id) ? '.clipbase' : ''), { text: L.name, title: L.name });
    row.appendChild(name);
    if (L.fx && IMG.Effects.count(L)) {
      const fxb = el('button.lfx', { type: 'button', title: 'Efeitos de camada (clique: mostrar/ocultar a lista)', html: IMG.icon('fx', 14) + IMG.icon(L._fxOpen ? 'chevronUp' : 'chevronDown', 10) });
      fxb.addEventListener('pointerdown', (e) => e.stopPropagation());
      fxb.addEventListener('click', (e) => { e.stopPropagation(); L._fxOpen = !L._fxOpen; render(); });
      row.appendChild(fxb);
    }
    if (L.link) row.appendChild(el('span.llinked', { title: 'Camada vinculada', html: IMG.icon('chain', 12) }));
    if (L.locked || L.lockPos || L.lockAlpha || L.lockPaint || L.isBg) row.appendChild(el('span.llock' + (L.locked || L.isBg ? '.full' : ''), { title: L.isBg ? 'Camada Fundo (clique duplo para desbloquear)' : 'Camada com bloqueio', html: IMG.icon('lock', 12) }));

    row.addEventListener('pointerdown', (e) => onRowDown(e, L, row));
    row.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!d.selected.has(L.id)) { Layers.setActive(d, L.id); render(); } IMG.UI.contextMenu(e.clientX, e.clientY, contextItems(L)); });
    return row;
  }

  function fxRows(L, depth) {
    const out = [];
    const d = doc();
    const head = el('div.lrow.lfxrow', { data: { id: L.id } });
    const eye = el('button.leye', { type: 'button', html: IMG.icon(L.fx.off ? 'eyeOff' : 'eye', 13) });
    eye.addEventListener('pointerdown', (e) => e.stopPropagation());
    eye.addEventListener('click', (e) => { e.stopPropagation(); L.fx.off = !L.fx.off; IMG.Effects.invalidate(L); changed(L.fx.off ? 'Ocultar efeitos' : 'Mostrar efeitos'); });
    head.append(eye, el('span.lindent', { style: { width: depth * 14 + 34 + 'px' } }), el('span.lfxname', { text: 'Efeitos' }));
    head.addEventListener('dblclick', () => { Layers.setActive(d, L.id); IMG.LayerStyle.open('blending'); });
    out.push(head);
    IMG.Effects.LIST.forEach((k) => {
      const e = L.fx[k];
      if (!e) return;
      const r = el('div.lrow.lfxrow' + (e.enabled ? '' : '.off'), { data: { id: L.id } });
      const ey = el('button.leye', { type: 'button', html: IMG.icon(e.enabled ? 'eye' : 'eyeOff', 13) });
      ey.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      ey.addEventListener('click', (ev) => { ev.stopPropagation(); e.enabled = !e.enabled; IMG.Effects.invalidate(L); changed((e.enabled ? 'Mostrar ' : 'Ocultar ') + IMG.Effects.NAMES[k]); });
      r.append(ey, el('span.lindent', { style: { width: depth * 14 + 48 + 'px' } }), el('span.lfxname', { text: IMG.Effects.NAMES[k] }));
      r.addEventListener('dblclick', () => { Layers.setActive(d, L.id); IMG.LayerStyle.open(k); });
      out.push(r);
    });
    return out;
  }

  function rename(L, node) {
    const inp = el('input.inp.lrename', { type: 'text', value: L.name, maxlength: 120 });
    node.replaceWith(inp);
    inp.focus(); inp.select();
    let done = false;
    const finish = (ok) => {
      if (done) return; done = true;
      const v = inp.value.trim();
      if (ok && v && v !== L.name) { L.name = v; if (L.text) L.text.auto = false; changed('Renomear camada'); }
      else render();
    };
    inp.addEventListener('pointerdown', (e) => e.stopPropagation());
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); });
    inp.addEventListener('blur', () => finish(true));
  }

  const COLORS = [[null, 'Sem cor'], ['#d9534f', 'Vermelho'], ['#f0ad4e', 'Laranja'], ['#e8d44d', 'Amarelo'], ['#5cb85c', 'Verde'], ['#5bc0de', 'Azul'], ['#9b6bd6', 'Violeta'], ['#8c8c8c', 'Cinza']];
  function contextItems(L) {
    const d = doc();
    return [
      'layer.style.blending', '-',
      'layer.duplicate', 'layer.duplicateInto', 'layer.delete', '-',
      { label: 'Renomear…', run: () => { const n = U.$('.lrow[data-id="' + L.id + '"] .lname', list); if (n) rename(L, n); } },
      L.type === 'text' ? { label: 'Editar texto', run: () => IMG.Text.editLayer(L) } : null,
      L.type === 'fill' ? { label: 'Editar preenchimento…', run: () => IMG.ImageOps.editFill(L) } : null,
      { label: 'Selecionar pixels', run: () => { IMG.Selection.fromLayer(d, L); IMG.commit('Carregar seleção'); } },
      '-', 'layer.group', 'layer.ungroup', 'layer.clip', '-',
      'layer.mask', 'layer.maskApply', 'layer.maskDelete', 'layer.maskToggle', '-',
      'layer.smartConvert', 'layer.smartEdit', 'layer.rasterize', 'layer.rasterizeStyle', '-',
      'layer.style.copy', 'layer.style.paste', 'layer.style.clear', '-',
      'layer.link', 'layer.selectLinked', '-',
      'layer.mergeDown', 'layer.mergeSelected', 'layer.mergeVisible', 'layer.flatten', '-',
      { label: 'Cor', items: COLORS.map(([c, n]) => ({ label: n, run: () => { Layers.selectedLayers(d).forEach((q) => { q.color = c; }); changed('Cor da camada'); } })) },
      L.isBg ? 'layer.fromBg' : null
    ];
  }

  /* ---------- clique duplo ---------- */
  function onDouble(e) {
    const d = doc(); if (!d) return;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const row = under && under.closest('.lrow');
    if (!row || row.classList.contains('lfxrow') || under.closest('.leye, .ltwist, .llink, .lfx, input')) return;
    const L = Layers.find(d, row.dataset.id); if (!L) return;
    if (under.closest('.lname')) { const n = U.$('.lname', row); if (n) rename(L, n); return; }
    if (L.isBg) { IMG.UI.prompt('Nova camada', 'Nome', 'Camada 0').then((n) => { if (n != null && Layers.fromBackground(d, L, n)) changed('Camada a partir do fundo'); }); return; }
    if (under.closest('.lthumb.mask')) { IMG.UI.showPanel('properties'); return; }
    if (under.closest('.lthumb')) {
      if (L.type === 'text') { IMG.Text.editLayer(L); return; }
      if (L.type === 'adjust') { IMG.UI.showPanel('properties'); return; }
      if (L.type === 'fill') { IMG.ImageOps.editFill(L); return; }
      if (L.type === 'smart' && IMG.Smart) { IMG.Smart.editContents(L); return; }
    }
    if (L.type !== 'adjust') IMG.LayerStyle.open('blending');
  }

  /* ---------- seleção e arrastar para reorganizar ---------- */
  function onRowDown(e, L, row) {
    if (e.button !== 0) return;
    const d = doc();
    if (e.target.closest('input')) return;
    const thumb = e.target.closest('.lthumb');
    const onMask = thumb && thumb.dataset.mask;
    // Ctrl+clique em miniatura: carregar seleção
    if ((e.ctrlKey || e.metaKey) && thumb && L.type !== 'group') { e.preventDefault(); loadSelection(L, !!onMask, e); return; }
    if (onMask) {
      if (e.shiftKey) { Layers.toggleMask(d, L); changed(L.mask.enabled ? 'Ativar máscara' : 'Desativar máscara'); return; }
      if (e.altKey) { d.viewMask = d.viewMask === L.id ? null : L.id; Layers.setActive(d, L.id); d.editMask = true; IMG.Engine.invalidate(); render(); return; }
      Layers.setActive(d, L.id); d.editMask = true; d.viewMask = null; render(); bus.emit('layers:props', d); bus.emit('layers:select'); return;
    }
    if (e.altKey && !e.ctrlKey && !e.shiftKey && !thumb) {
      // Alt+clique: cria/libera máscara de recorte
      if (Layers.toggleClip(d, L)) changed(L.clip ? 'Criar máscara de recorte' : 'Liberar máscara de recorte');
      return;
    }
    const mode = e.ctrlKey || e.metaKey ? 'toggle' : e.shiftKey ? 'range' : undefined;
    const wasSel = d.selected.has(L.id);
    if (d.editMask && thumb) { d.editMask = false; d.viewMask = null; IMG.Engine.invalidate(); bus.emit('layers:select'); bus.emit('layers:props', d); }
    if (mode || !wasSel) { Layers.setActive(d, L.id, mode); }
    else if (d.activeId !== L.id) { d.activeId = L.id; d.editMask = false; bus.emit('layers:select'); }
    const x0 = e.clientX, y0 = e.clientY;
    let dragging = false, marker = null, target = null;
    U.drag(e, (ev) => {
      if (!dragging) {
        if (Math.abs(ev.clientY - y0) + Math.abs(ev.clientX - x0) < 6) return;
        if (L.isBg) return;
        dragging = true;
        marker = el('div.ldrop');
        list.appendChild(marker);
        list.classList.add('dragging');
      }
      target = null;
      U.$$('.lrow.drop-into', list).forEach((n) => n.classList.remove('drop-into'));
      const lr = list.getBoundingClientRect();
      const rows = U.$$('.lrow:not(.lfxrow)', list);
      if (ev.clientY < lr.top + 14) list.scrollTop -= 12; else if (ev.clientY > lr.bottom - 14) list.scrollTop += 12;
      let over = rows.find((r) => { const b = r.getBoundingClientRect(); return ev.clientY >= b.top && ev.clientY < b.bottom; });
      if (!over) { over = ev.clientY < lr.top + 4 || !rows.length ? rows[0] : rows[rows.length - 1]; if (!over) return; }
      const b = over.getBoundingClientRect(), T = Layers.find(d, over.dataset.id);
      if (!T) return;
      const f = (ev.clientY - b.top) / b.height;
      let pos = f < 0.5 ? 'above' : 'below';
      if (T.type === 'group' && f > 0.28 && f < 0.72) pos = 'into';
      if (ev.clientY < b.top) pos = 'above'; else if (ev.clientY >= b.bottom) pos = 'below';
      if (T.isBg && pos === 'below') pos = 'above';
      target = { T, pos };
      if (pos === 'into') { over.classList.add('drop-into'); marker.style.display = 'none'; }
      else {
        marker.style.display = 'block';
        marker.style.top = (pos === 'above' ? b.top : b.bottom) - lr.top + list.scrollTop - 1 + 'px';
        marker.style.left = '30px';
      }
    }, () => {
      if (marker) marker.remove();
      list.classList.remove('dragging');
      U.$$('.lrow.drop-into', list).forEach((n) => n.classList.remove('drop-into'));
      if (!dragging) {
        if (!mode && wasSel && d.selected.size > 1) Layers.setActive(d, L.id);
        return;
      }
      if (!target) return;
      const moving = Layers.selectedLayers(d).filter((m) => !m.isBg);
      const { T, pos } = target;
      if (moving.some((m) => m === T || Layers.hasAncestor(T, m))) return;
      moving.forEach((m) => Layers.remove(d, m));
      let parent, index;
      if (pos === 'into') { parent = T; index = T.children.length; T.expanded = true; }
      else { parent = T.parent; const sib = Layers.siblings(d, T); index = sib.indexOf(T) + (pos === 'above' ? 1 : 0); }
      const arr = parent ? parent.children : d.layers;
      if (!parent && arr[0] && arr[0].isBg) index = Math.max(1, index);
      moving.forEach((m, i) => { m.parent = parent || null; arr.splice(index + i, 0, m); });
      changed('Reorganizar camadas');
    }, list);
  }

  /* ---------- renderização ---------- */
  function render() {
    if (!root || !root.isConnected) return;
    const d = doc();
    const scroll = list.scrollTop;
    U.clear(list);
    if (!d) { list.appendChild(el('div.panel-empty', { text: 'Nenhum documento aberto.' })); syncTop(); return; }
    const alive = new Set();
    const bases = clipBaseIds(d);
    const rec = (arr, depth) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const L = arr[i];
        alive.add(L.id); if (L.mask) alive.add(L.id + ':m');
        list.appendChild(rowFor(L, depth, bases));
        if (L.fx && L._fxOpen && IMG.Effects.count(L)) fxRows(L, depth).forEach((r) => list.appendChild(r));
        (IMG.layerRowHooks || []).forEach((fn) => { try { (fn(L, depth, { render, doc: d }) || []).forEach((r) => list.appendChild(r)); } catch (err) { console.error(err); } });
        if (L.type === 'group' && L.expanded) rec(L.children, depth + 1);
        else if (L.type === 'group') Layers.walk(L.children, (q) => { alive.add(q.id); if (q.mask) alive.add(q.id + ':m'); });
      }
    };
    rec(d.layers, 0);
    for (const k of thumbs.keys()) if (!alive.has(k)) thumbs.delete(k);
    if (!d.layers.length) list.appendChild(el('div.panel-empty', { text: 'Este documento não tem camadas. Crie uma com o botão abaixo.' }));
    list.scrollTop = scroll;
    syncTop();
  }

  function syncTop() {
    const d = doc(), L = d && d.active;
    const dis = !L;
    root.classList.toggle('no-layer', dis);
    if (L) {
      blendSel.fill(L.type === 'group' ? IMG.BLEND_LIST_GROUP : IMG.BLEND_LIST);
      blendSel.set(L.blend);
      blendSel.el.disabled = !!L.isBg;
      opCtl.set(Math.round(L.opacity * 100)); fillCtl.set(Math.round(L.fill * 100));
      lockBtns.lockAlpha.classList.toggle('active', !!(L.lockAlpha || L.isBg));
      lockBtns.lockPaint.classList.toggle('active', !!L.lockPaint);
      lockBtns.lockPos.classList.toggle('active', !!(L.lockPos || L.isBg));
      lockBtns.locked.classList.toggle('active', !!L.locked);
    }
  }

  IMG.UI.registerPanel({
    id: 'layers', title: 'Camadas', icon: 'layers', keys: ['f7'],
    build(node) {
      root = node;
      const UI = IMG.UI;
      const each = (fn) => { const d = doc(); if (!d) return []; const ls = Layers.selectedLayers(d).filter((q) => !q.isBg); ls.forEach(fn); return ls; };
      blendSel = UI.select(IMG.BLEND_LIST, 'normal', (v) => { if (each((L) => { L.blend = v === 'pass' && L.type !== 'group' ? 'normal' : v; }).length) changed('Modo de mesclagem'); }, { title: 'Modo de mesclagem' });
      blendSel.el.classList.add('lblend');
      opCtl = UI.numPop({ label: 'Opacidade:', value: 100, min: 0, max: 100, step: 1, unit: '%', width: 56,
        onInput: (v) => { each((L) => { L.opacity = v / 100; }); IMG.Engine.invalidate(); }, onChange: () => changed('Opacidade da camada', false) });
      fillCtl = UI.numPop({ label: 'Preench.:', value: 100, min: 0, max: 100, step: 1, unit: '%', width: 56,
        onInput: (v) => { each((L) => { L.fill = v / 100; IMG.Effects.invalidate(L); }); IMG.Engine.invalidate(); }, onChange: () => changed('Opacidade do preenchimento', false) });
      const lk = (key, icon, title) => {
        const b = UI.iconBtn(icon, title, () => { const d = doc(), L = d && d.active; if (!L || L.isBg) return; const on = !L[key]; each((q) => { q[key] = on; }); changed(on ? 'Bloquear' : 'Desbloquear'); }, { size: 14 });
        lockBtns[key] = b; return b;
      };
      const top = el('div.ltop',
        el('div.ltop-row', blendSel.el, opCtl.el),
        el('div.ltop-row', el('span.opt-label', { text: 'Bloquear:' }), lk('lockAlpha', 'lockAlpha', 'Bloquear pixels transparentes'), lk('lockPaint', 'lockPaint', 'Bloquear pixels da imagem'), lk('lockPos', 'lockPos', 'Bloquear posição'), lk('locked', 'lock', 'Bloquear tudo'), el('span.pgroup-fill'), fillCtl.el));
      list = el('div.llist', { role: 'listbox', 'aria-label': 'Camadas' });
      list.addEventListener('dblclick', onDouble);
      list.addEventListener('pointerdown', (e) => { if (e.target === list && doc()) { Layers.setActive(doc(), null); render(); } });
      const fxMenu = (e) => { const r = e.currentTarget.getBoundingClientRect(); UI.contextMenu(r.left, r.top, ['layer.style.blending', '-', ...IMG.Effects.LIST.map((k) => 'layer.style.' + k)]); const m = UI.menuStack[0]; if (m) m.style.top = Math.max(4, r.top - m.offsetHeight - 2) + 'px'; };
      const adjMenu = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        UI.contextMenu(r.left, r.top, ['layer.fillSolid', 'layer.fillGradient', 'layer.fillPattern', '-', ...IMG.Adjust.LAYER_ORDER.map((k) => (k === '-' ? '-' : 'adjl.' + k))]);
        const m = UI.menuStack[0]; if (m) m.style.top = Math.max(4, r.top - m.offsetHeight - 2) + 'px';
      };
      const fxBtn = UI.iconBtn('fx', 'Adicionar estilo de camada', null); fxBtn.addEventListener('click', fxMenu);
      const adjBtn = UI.iconBtn('adjLayer', 'Nova camada de preenchimento ou de ajuste', null); adjBtn.addEventListener('click', adjMenu);
      const foot = el('div.panel-foot.lfoot',
        UI.iconBtn('chain', 'Vincular camadas', () => { const d = doc(); if (!d) return; const s = Layers.selectedLayers(d); if (s.length > 1 && s.every((q) => q.link && q.link === s[0].link)) UI.run('layer.unlink'); else UI.run('layer.link'); }),
        fxBtn,
        UI.iconBtn('mask', 'Adicionar máscara de camada (Alt: ocultar tudo)', (e) => UI.run(e && e.altKey ? (doc() && doc().selection ? 'layer.maskHideSel' : 'layer.maskHide') : 'layer.mask')),
        adjBtn,
        UI.iconBtn('folder', 'Novo grupo', () => UI.run('layer.newGroup')),
        UI.iconBtn('newLayer', 'Nova camada', () => UI.run('layer.newQuick')),
        el('span.pgroup-fill'),
        UI.iconBtn('trash', 'Excluir camada', () => { const d = doc(); if (d && d.editMask && d.active && d.active.mask) UI.run('layer.maskDelete'); else UI.run('layer.delete'); }));
      root.append(top, list, foot);
      ['layers:change', 'layers:select', 'doc:change', 'doc:resize'].forEach((ev) => bus.on(ev, render));
      bus.on('history:change', () => render());
      bus.on('layers:props', syncTop);
      bus.on('layer:pixels', (L) => refreshThumb(L));
      render();
    },
    onShow() { render(); }
  });
})();
