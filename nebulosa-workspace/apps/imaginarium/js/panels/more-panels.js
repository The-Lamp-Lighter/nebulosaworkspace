/* ==========================================================================
   Imaginarium — painéis Canais, Informações, Histograma, Ações,
   Composições de camadas, Glifos, Predefinições de ferramenta e CSS
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const doc = () => IMG.app.doc;

  /* ==================================================================
     CANAIS
     ================================================================== */
  const CH = { r: ['Vermelho', 0], g: ['Verde', 1], b: ['Azul', 2] };
  let chRoot, chList;
  /** Canal de cor isolado como imagem em tons de cinza (em cache). */
  function channelCanvas(d, which) {
    const E = IMG.Engine, comp = E.composite(d);
    const key = which + '|' + (E._compVer || 0) + '|' + d.width + 'x' + d.height;
    if (d._chc && d._chcKey === key) return d._chc;
    const W = d.width, H = d.height, img = comp.getContext('2d').getImageData(0, 0, W, H), s = img.data, o = new ImageData(W, H), od = o.data, c = CH[which][1];
    for (let i = 0; i < s.length; i += 4) { const a = s[i + 3] / 255, v = s[i + c] * a + 255 * (1 - a); od[i] = od[i + 1] = od[i + 2] = v; od[i + 3] = 255; }
    const cv = U.createCanvas(W, H); cv.getContext('2d').putImageData(o, 0, 0);
    d._chc = cv; d._chcKey = key;
    return cv;
  }
  bus.on('layer:pixels', () => { const d = doc(); if (d) d._chc = null; });
  bus.on('layers:change', () => { const d = doc(); if (d) d._chc = null; });
  bus.on('history:change', () => { const d = doc(); if (d) d._chc = null; });
  {
    const E = IMG.Engine, prev = E.channelView;
    E.channelView = (d) => {
      if (d.viewChannel && CH[d.viewChannel]) return { canvas: channelCanvas(d, d.viewChannel), x: 0, y: 0, bg: '#fff' };
      if (d.editChannel) {
        const ch = (d.channels || []).find((c) => c.id === d.editChannel);
        if (ch && !d.showComposite) { const g = U.createCanvas(d.width, d.height), x = g.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, d.width, d.height); x.drawImage(ch.canvas, 0, 0); return { canvas: g, x: 0, y: 0, bg: '#000' }; }
      }
      return prev ? prev(d) : null;
    };
    // canais alfa visíveis junto com a composição: sobreposição colorida
    const prevOv = E.overlaySource;
    E.overlaySource = (d) => {
      const base = prevOv ? prevOv(d) : null;
      if (base) return base;
      const vis = (d.channels || []).filter((c) => c.visible);
      if (!vis.length) return null;
      const c = U.createCanvas(d.width, d.height), x = c.getContext('2d');
      vis.forEach((ch) => { const t = U.createCanvas(d.width, d.height), tx = t.getContext('2d'); tx.fillStyle = ch.color || '#ff0000'; tx.fillRect(0, 0, d.width, d.height); tx.globalCompositeOperation = 'destination-out'; tx.drawImage(ch.canvas, 0, 0); x.globalAlpha = (ch.opacity == null ? 50 : ch.opacity) / 100; x.drawImage(t, 0, 0); });
      return { canvas: c, x: 0, y: 0, alpha: 1 };
    };
    // edição de um canal alfa: a pintura vai para o canal (como na Máscara rápida)
    const pt = IMG.Layers.paintTarget.bind(IMG.Layers);
    const fake = new Map();
    IMG.Layers.paintTarget = function (d, o) {
      if (d && d.editChannel && !d.quickMask) {
        const ch = (d.channels || []).find((c) => c.id === d.editChannel);
        if (ch) {
          let L = fake.get(ch);
          if (!L) { L = { id: '__ch_' + ch.id, type: 'raster', name: ch.name, visible: true, opacity: 1, fill: 1, blend: 'normal', parent: null, isQM: true, lockAlpha: false, locked: false, lockPaint: false, fx: null, ensureCovers() {}, contentBounds() { return d.rect; } }; Object.defineProperty(L, 'mask', { get: () => ch }); Object.defineProperty(L, 'canvas', { get: () => ch.canvas }); fake.set(ch, L); }
          d.editMask = true;
          return L;
        }
      }
      return pt(d, o);
    };
  }
  function selectChannel(d, kind, id) {
    d.viewChannel = null; d.editChannel = null;
    if (kind === 'color') d.viewChannel = id;
    else if (kind === 'alpha') { d.editChannel = id; d.editMask = true; }
    else { d.editMask = !!(d.active && d.active.mask && d.editMask && !d._chEdit); }
    if (kind !== 'alpha' && d._chEdit) d.editMask = false;
    d._chEdit = kind === 'alpha';
    IMG.Engine.invalidate(); IMG.Engine.requestRender(); renderChannels(); bus.emit('layers:select', d);
  }
  function chThumb(d, kind, id) {
    const c = U.domCanvas(34, 26), x = c.getContext('2d');
    const k = Math.min(34 / d.width, 26 / d.height), w = d.width * k, h = d.height * k, ox = (34 - w) / 2, oy = (26 - h) / 2;
    if (kind === 'rgb') x.drawImage(IMG.Engine.composite(d), ox, oy, w, h);
    else if (kind === 'color') x.drawImage(channelCanvas(d, id), ox, oy, w, h);
    else { const ch = (d.channels || []).find((q) => q.id === id) || null; x.fillStyle = '#000'; x.fillRect(ox, oy, w, h); if (ch) x.drawImage(ch.canvas, ox, oy, w, h); else if (kind === 'mask' && d.active && d.active.mask) x.drawImage(IMG.Selection.maskCanvas(d, d.active), ox, oy, w, h); }
    return c;
  }
  function renderChannels() {
    if (!chRoot || !chRoot.isConnected) return;
    U.clear(chList);
    const d = doc(); if (!d) { chList.appendChild(el('div.panel-empty', { text: 'Nenhum documento aberto.' })); return; }
    const UI = IMG.UI;
    const row = (kind, id, name, key, on, visible, onEye) => {
      const eye = el('button.leye', { type: 'button', html: IMG.icon(visible ? 'eye' : 'eyeOff', 15) });
      eye.addEventListener('click', (e) => { e.stopPropagation(); onEye(); renderChannels(); });
      const r = el('div.chrow' + (on ? '.on' : ''), eye, chThumb(d, kind, id), el('span.pname' + (kind === 'mask' ? '.it' : ''), { text: name }), key ? el('span.chkey', { text: key }) : null);
      r.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) { loadChannelSel(d, kind, id, e.shiftKey ? 'add' : e.altKey ? 'sub' : 'new'); return; }
        if (kind === 'mask') { d.editMask = true; d.editChannel = null; d.viewChannel = null; bus.emit('layers:select', d); renderChannels(); return; }
        selectChannel(d, kind, id);
      });
      if (kind === 'alpha') r.addEventListener('dblclick', () => channelOptions(d, id));
      chList.appendChild(r);
    };
    const none = !d.viewChannel && !d.editChannel;
    row('rgb', null, 'RGB', 'Ctrl+2', none, true, () => {});
    Object.keys(CH).forEach((c, i) => row('color', c, CH[c][0], 'Ctrl+' + (i + 3), d.viewChannel === c, none || d.viewChannel === c, () => {}));
    if (d.active && d.active.mask) row('mask', null, d.active.name + ' — máscara', null, d.editMask && !d.editChannel, false, () => {});
    (d.channels || []).forEach((ch, i) => row('alpha', ch.id, ch.name, i < 4 ? 'Ctrl+' + (i + 6) : null, d.editChannel === ch.id, !!ch.visible || d.editChannel === ch.id, () => { ch.visible = !ch.visible; IMG.Engine.requestRender(); }));
    void UI;
  }
  function loadChannelSel(d, kind, id, mode) {
    let c;
    if (kind === 'rgb') { const comp = IMG.Engine.composite(d), img = comp.getContext('2d').getImageData(0, 0, d.width, d.height), s = img.data; for (let i = 0; i < s.length; i += 4) { const l = (0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]) * s[i + 3] / 255; s[i] = s[i + 1] = s[i + 2] = 255; s[i + 3] = l; } c = U.createCanvas(d.width, d.height); c.getContext('2d').putImageData(img, 0, 0); }
    else if (kind === 'color') { const g = channelCanvas(d, id), img = g.getContext('2d').getImageData(0, 0, d.width, d.height), s = img.data; for (let i = 0; i < s.length; i += 4) { s[i + 3] = s[i]; s[i] = s[i + 1] = s[i + 2] = 255; } c = U.createCanvas(d.width, d.height); c.getContext('2d').putImageData(img, 0, 0); }
    else if (kind === 'mask') c = IMG.Selection.maskCanvas(d, d.active);
    else { const ch = (d.channels || []).find((q) => q.id === id); if (!ch) return; c = U.cloneCanvas(ch.canvas); }
    IMG.Selection.combine(d, c, mode); IMG.commit('Carregar seleção');
  }
  function channelOptions(d, id) {
    const ch = (d.channels || []).find((q) => q.id === id); if (!ch) return;
    const UI = IMG.UI, nameIn = el('input.inp', { type: 'text', value: ch.name });
    let color = ch.color || '#ff0000', op = ch.opacity == null ? 50 : ch.opacity;
    UI.dialog({ title: 'Opções de canal', width: 340, body: [UI.row('Nome', nameIn), UI.row('Cor', UI.colorBtn(color, (h) => { if (h) color = h; }).el), UI.row('Opacidade', UI.num({ value: op, min: 0, max: 100, unit: '%', width: 70, onInput: (v) => { op = v; } }).el)],
      buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => { ch.name = nameIn.value.trim() || ch.name; ch.color = color; ch.opacity = op; renderChannels(); IMG.Engine.requestRender(); IMG.commit('Opções de canal'); } }] });
  }
  IMG.UI.registerPanel({
    id: 'channels', title: 'Canais', icon: 'channels',
    build(node) {
      chRoot = node; const UI = IMG.UI;
      chList = el('div.plist');
      const foot = el('div.panel-foot',
        UI.iconBtn('selNew', 'Carregar canal como seleção', () => { const d = doc(); if (!d) return; if (d.editChannel) loadChannelSel(d, 'alpha', d.editChannel, 'new'); else if (d.viewChannel) loadChannelSel(d, 'color', d.viewChannel, 'new'); else loadChannelSel(d, 'rgb', null, 'new'); }),
        UI.iconBtn('save', 'Salvar seleção como canal', () => { const d = doc(); if (!d || !d.selection) { UI.toast('Faça uma seleção primeiro.'); return; } IMG.Channels.add(d, null, U.cloneCanvas(d.selection.canvas)); renderChannels(); IMG.commit('Salvar seleção'); }),
        el('span.pgroup-fill'),
        UI.iconBtn('newLayer', 'Novo canal', () => { const d = doc(); if (!d) return; const ch = IMG.Channels.add(d); renderChannels(); selectChannel(d, 'alpha', ch.id); IMG.commit('Novo canal'); }),
        UI.iconBtn('trash', 'Excluir canal', () => { const d = doc(); if (!d || !d.editChannel) return; d.channels = d.channels.filter((c) => c.id !== d.editChannel); selectChannel(d, 'rgb'); IMG.commit('Excluir canal'); }));
      chRoot.append(chList, foot);
      ['doc:change', 'channels:change', 'history:change', 'layers:select', 'layers:change'].forEach((e) => bus.on(e, renderChannels));
      bus.on('layer:pixels', U.debounce(renderChannels, 400));
      renderChannels();
    },
    onShow() { renderChannels(); }
  });

  /* ==================================================================
     INFORMAÇÕES
     ================================================================== */
  let infoRoot, infoPos = null;
  function rgbToCmyk(r, g, b) { const k = 1 - Math.max(r, g, b) / 255; if (k >= 1) return [0, 0, 0, 100]; const c = (1 - r / 255 - k) / (1 - k), m = (1 - g / 255 - k) / (1 - k), y = (1 - b / 255 - k) / (1 - k); return [c, m, y, k].map((v) => Math.round(v * 100)); }
  function renderInfo() {
    if (!infoRoot || !infoRoot.isConnected) return;
    U.clear(infoRoot);
    const d = doc(); if (!d) { infoRoot.appendChild(el('div.panel-empty', { text: 'Nenhum documento aberto.' })); return; }
    const grid = el('div.info-grid');
    const cell = (title, lines) => grid.appendChild(el('div.info-cell', el('b', { text: title }), ...lines.map((l) => el('div', { text: l }))));
    let c = null;
    if (infoPos && infoPos.x >= 0 && infoPos.y >= 0 && infoPos.x < d.width && infoPos.y < d.height) c = IMG.Engine.sample(d, infoPos.x, infoPos.y, (IMG.Tools.o('eyedropper') || {}).sample || 1);
    const rgb = c ? [c.r, c.g, c.b] : null;
    cell('RGB', rgb ? ['R: ' + rgb[0], 'G: ' + rgb[1], 'B: ' + rgb[2]] : ['R:', 'G:', 'B:']);
    const cm = rgb ? rgbToCmyk(...rgb) : null;
    cell('CMYK', cm ? ['C: ' + cm[0] + '%', 'M: ' + cm[1] + '%', 'Y: ' + cm[2] + '%', 'K: ' + cm[3] + '%'] : ['C:', 'M:', 'Y:', 'K:']);
    cell('Posição', infoPos ? ['X: ' + Math.floor(infoPos.x) + ' px', 'Y: ' + Math.floor(infoPos.y) + ' px'] : ['X:', 'Y:']);
    const sb = d.selection && d.selection.bounds;
    cell('Seleção', sb ? ['L: ' + sb.w + ' px', 'A: ' + sb.h + ' px'] : ['L:', 'A:']);
    infoRoot.appendChild(grid);
    if (rgb) infoRoot.appendChild(el('div.info-hex', el('i', { style: { background: U.rgbToHex(...rgb) } }), el('span', { text: U.rgbToHex(...rgb).toUpperCase() + (c.a < 1 ? '  ·  alfa ' + Math.round(c.a * 100) + '%' : '') })));
    infoRoot.appendChild(el('div.info-doc', { text: 'Documento: ' + d.width + ' × ' + d.height + ' px' + (d.dpi ? ' · ' + d.dpi + ' ppp' : '') }));
    (d.samplers || []).forEach((p, i) => {
      const s = IMG.Engine.sample(d, p.x, p.y, (IMG.Tools.o('colorSampler') || {}).sample || 1);
      infoRoot.appendChild(el('div.info-sampler', el('b', { text: '#' + (i + 1) }), el('i', { style: { background: s ? U.rgbToHex(s.r, s.g, s.b) : 'transparent' } }), el('span', { text: s ? 'R ' + s.r + '  G ' + s.g + '  B ' + s.b : '—' })));
    });
  }
  const lateInfo = U.throttle ? U.throttle(renderInfo, 60) : U.debounce(renderInfo, 30);
  IMG.UI.registerPanel({
    id: 'info', title: 'Informações', icon: 'info2', keys: ['f8'],
    build(node) {
      infoRoot = el('div.panel-info'); node.appendChild(infoRoot);
      bus.on('pointer:move', (ev) => { infoPos = { x: ev.x, y: ev.y }; lateInfo(); });
      bus.on('pointer:leave', () => { infoPos = null; lateInfo(); });
      ['doc:change', 'samplers:change', 'selection:change', 'layer:pixels'].forEach((e) => bus.on(e, lateInfo));
      renderInfo();
    },
    onShow() { renderInfo(); }
  });

  /* ==================================================================
     HISTOGRAMA
     ================================================================== */
  let hiRoot, hiState = { ch: 'colors', src: 'image' };
  function computeHist(d) {
    let c = IMG.Engine.composite(d);
    if (hiState.src === 'layer' && d.active && d.active.canvas) c = d.active.canvas;
    const k = Math.min(1, 600 / Math.max(c.width, c.height)), w = Math.max(1, Math.round(c.width * k)), h = Math.max(1, Math.round(c.height * k));
    const s = U.createCanvas(w, h); s.getContext('2d').drawImage(c, 0, 0, w, h);
    const px = s.getContext('2d').getImageData(0, 0, w, h).data;
    const H = { r: new Uint32Array(256), g: new Uint32Array(256), b: new Uint32Array(256), l: new Uint32Array(256) };
    let n = 0;
    const sel = d.selection && hiState.src !== 'layer' ? (() => { const m = U.createCanvas(w, h); m.getContext('2d').drawImage(d.selection.canvas, 0, 0, w, h); return m.getContext('2d').getImageData(0, 0, w, h).data; })() : null;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 8) continue;
      if (sel && sel[i + 3] < 128) continue;
      H.r[px[i]]++; H.g[px[i + 1]]++; H.b[px[i + 2]]++; H.l[Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])]++; n++;
    }
    return { H, n };
  }
  function renderHist() {
    if (!hiRoot || !hiRoot.isConnected) return;
    U.clear(hiRoot);
    const d = doc(); if (!d) { hiRoot.appendChild(el('div.panel-empty', { text: 'Nenhum documento aberto.' })); return; }
    const UI = IMG.UI;
    hiRoot.appendChild(el('div.hist-top', UI.select([['colors', 'Cores'], ['rgb', 'RGB'], ['l', 'Luminosidade'], ['r', 'Vermelho'], ['g', 'Verde'], ['b', 'Azul']], hiState.ch, (v) => { hiState.ch = v; renderHist(); }, { width: 120 }).el,
      UI.select([['image', 'Imagem inteira'], ['layer', 'Camada selecionada']], hiState.src, (v) => { hiState.src = v; renderHist(); }, { width: 140 }).el));
    const { H, n } = computeHist(d);
    const W = 256, Hh = 100, cv = U.domCanvas(W, Hh); cv.className = 'hist-canvas';
    const x = cv.getContext('2d');
    x.fillStyle = '#1d1f22'; x.fillRect(0, 0, W, Hh);
    const draw = (arr, col, comp) => {
      let mx = 1; for (let i = 0; i < 256; i++) mx = Math.max(mx, arr[i]);
      x.fillStyle = col; x.globalCompositeOperation = comp || 'source-over';
      for (let i = 0; i < 256; i++) { const hh = Math.round((arr[i] / mx) * (Hh - 2)); x.fillRect(i, Hh - hh, 1, hh); }
      x.globalCompositeOperation = 'source-over';
    };
    if (hiState.ch === 'colors') { draw(H.r, '#e04040', 'lighter'); draw(H.g, '#40c040', 'lighter'); draw(H.b, '#4060e0', 'lighter'); }
    else if (hiState.ch === 'rgb') { const s = new Uint32Array(256); for (let i = 0; i < 256; i++) s[i] = H.r[i] + H.g[i] + H.b[i]; draw(s, '#c8ccd2'); }
    else draw(H[hiState.ch], { l: '#c8ccd2', r: '#e04040', g: '#40c040', b: '#4060e0' }[hiState.ch]);
    hiRoot.appendChild(cv);
    const arr = hiState.ch === 'r' || hiState.ch === 'g' || hiState.ch === 'b' ? H[hiState.ch] : H.l;
    let sum = 0, sq = 0, med = 0, acc = 0;
    for (let i = 0; i < 256; i++) { sum += i * arr[i]; sq += i * i * arr[i]; }
    const mean = n ? sum / n : 0, sd = n ? Math.sqrt(Math.max(0, sq / n - mean * mean)) : 0;
    for (let i = 0; i < 256; i++) { acc += arr[i]; if (acc >= n / 2) { med = i; break; } }
    hiRoot.appendChild(el('div.hist-stats', el('span', { text: 'Média: ' + U.round(mean, 2) }), el('span', { text: 'Desvio: ' + U.round(sd, 2) }), el('span', { text: 'Mediana: ' + med }), el('span', { text: 'Pixels: ' + n.toLocaleString('pt-BR') })));
  }
  const lateHist = U.debounce(renderHist, 350);
  IMG.UI.registerPanel({
    id: 'histogram', title: 'Histograma', icon: 'histogram',
    build(node) { hiRoot = el('div.panel-hist'); node.appendChild(hiRoot); ['doc:change', 'layer:pixels', 'layers:change', 'history:change', 'selection:change'].forEach((e) => bus.on(e, lateHist)); renderHist(); },
    onShow() { renderHist(); }
  });

  /* ==================================================================
     AÇÕES (gravar e reproduzir comandos)
     ================================================================== */
  const Actions = (IMG.Actions = {
    sets: U.store.get('actions', null) || [{ name: 'Ações padrão', open: true, items: [
      { name: 'Vinheta suave', steps: [{ fx: 'lensCorrection', values: { vignette: -60, vigMid: 50 }, label: 'Correção de lente' }] },
      { name: 'Sépia', steps: [{ cmd: 'adj.desaturate', label: 'Dessaturar' }, { fx: 'addNoise', values: { amount: 3, dist: 'uniform', mono: true }, label: 'Adicionar ruído' }] },
      { name: 'Espelhar e duplicar', steps: [{ cmd: 'layer.duplicate', label: 'Duplicar camada' }, { cmd: 'edit.tFlipH', label: 'Inverter horizontalmente' }] },
      { name: 'Achatar e aumentar nitidez', steps: [{ cmd: 'layer.flatten', label: 'Achatar imagem' }, { fx: 'unsharp', values: { amount: 80, radius: 1.2, threshold: 2 }, label: 'Máscara de nitidez' }] }
    ] }],
    rec: null, sel: { set: 0, item: 0 },
    save() { U.store.set('actions', this.sets); },
    current() { const s = this.sets[this.sel.set]; return s && s.items[this.sel.item]; },
    record(step) { if (!this.rec) return; this.rec.steps.push(step); this.save(); renderActions(); },
    async play(item) {
      const UI = IMG.UI;
      if (!item || !IMG.app.doc) return;
      const wait = () => new Promise((res) => { const t = setInterval(() => { if (!UI.modalCount) { clearInterval(t); res(); } }, 120); });
      for (const st of item.steps) {
        if (st.off) continue;
        try {
          if (st.fx) { if (st.dialog) IMG.FX.open(st.fx); else IMG.FX.applyDirect(st.fx, st.values || {}); }
          else if (st.cmd) UI.run(st.cmd);
        } catch (err) { console.error(err); UI.toast('Erro na ação: ' + err.message, 'error'); break; }
        await wait();
        await new Promise((r) => setTimeout(r, 30));
      }
    }
  });
  // gravação: comandos executados e filtros aplicados
  {
    const UI = IMG.UI, run = UI.run.bind(UI);
    UI.run = function (id, arg) {
      if (Actions.rec && !/^(window|help|view|actions)\./.test(id) && id !== 'edit.undo' && id !== 'edit.redo') {
        const c = UI.commands[id];
        if (!/^filter\./.test(id) || (IMG.FX.defs[id.slice(7)] && IMG.FX.defs[id.slice(7)].direct)) Actions.record({ cmd: id, label: c ? (c.label2 && c.label2()) || c.label : id });
      }
      return run(id, arg);
    };
    let last = IMG.FX.last;
    Object.defineProperty(IMG.FX, 'last', { get: () => last, set: (v) => { last = v; if (Actions.rec && v && v.id) Actions.record({ fx: v.id, values: v.values || {}, label: IMG.FX.defs[v.id] ? IMG.FX.defs[v.id].label : v.id }); } });
  }
  let acRoot, acList;
  function renderActions() {
    if (!acRoot || !acRoot.isConnected) return;
    U.clear(acList);
    Actions.sets.forEach((set, si) => {
      const head = el('div.acrow.acset', el('span', { html: IMG.icon(set.open ? 'chevronDown' : 'chevronRight', 11) }), IMG.iconEl('folder', 14), el('span.pname', { text: set.name }));
      head.addEventListener('click', () => { set.open = !set.open; Actions.save(); renderActions(); });
      acList.appendChild(head);
      if (!set.open) return;
      set.items.forEach((it, ii) => {
        const on = Actions.sel.set === si && Actions.sel.item === ii;
        const r = el('div.acrow.acitem' + (on ? '.on' : '') + (Actions.rec === it ? '.rec' : ''), el('span', { html: IMG.icon(it.open ? 'chevronDown' : 'chevronRight', 11) }), el('span.pname', { text: it.name }));
        r.firstChild.addEventListener('click', (e) => { e.stopPropagation(); it.open = !it.open; renderActions(); });
        r.addEventListener('click', () => { Actions.sel = { set: si, item: ii }; renderActions(); });
        r.addEventListener('dblclick', () => IMG.UI.prompt('Renomear ação', 'Nome', it.name).then((v) => { if (v) { it.name = v; Actions.save(); renderActions(); } }));
        acList.appendChild(r);
        if (it.open) it.steps.forEach((st, k) => {
          const chk = el('input', { type: 'checkbox' }); chk.checked = !st.off;
          chk.addEventListener('change', () => { st.off = !chk.checked; Actions.save(); });
          const dlg = el('button.acdlg' + (st.dialog ? '.on' : ''), { type: 'button', title: 'Mostrar a caixa de diálogo ao reproduzir', text: '▭' });
          dlg.addEventListener('click', (e) => { e.stopPropagation(); st.dialog = !st.dialog; Actions.save(); renderActions(); });
          const del = el('button.acdlg', { type: 'button', title: 'Excluir passo', text: '×' });
          del.addEventListener('click', (e) => { e.stopPropagation(); it.steps.splice(k, 1); Actions.save(); renderActions(); });
          acList.appendChild(el('div.acrow.acstep', chk, st.fx ? dlg : el('span.acdlg-pad'), el('span.pname', { text: st.label || st.cmd || st.fx }), del));
        });
      });
    });
  }
  IMG.UI.registerPanel({
    id: 'actions', title: 'Ações', icon: 'actions', keys: ['alt+f9'],
    build(node) {
      acRoot = node; const UI = IMG.UI;
      acList = el('div.plist');
      const recBtn = UI.iconBtn('record', 'Iniciar gravação', () => {
        if (Actions.rec) { Actions.rec = null; recBtn.classList.remove('active'); renderActions(); return; }
        const it = Actions.current(); if (!it) { UI.toast('Crie ou selecione uma ação.'); return; }
        Actions.rec = it; recBtn.classList.add('active'); renderActions(); UI.toast('Gravando: execute os comandos e filtros desejados.');
      });
      const foot = el('div.panel-foot',
        UI.iconBtn('stop', 'Parar gravação', () => { Actions.rec = null; recBtn.classList.remove('active'); renderActions(); }),
        recBtn,
        UI.iconBtn('actions', 'Reproduzir a ação selecionada', () => Actions.play(Actions.current())),
        el('span.pgroup-fill'),
        UI.iconBtn('folder', 'Novo conjunto', () => UI.prompt('Novo conjunto', 'Nome', 'Conjunto ' + (Actions.sets.length + 1)).then((v) => { if (v) { Actions.sets.push({ name: v, open: true, items: [] }); Actions.save(); renderActions(); } })),
        UI.iconBtn('newLayer', 'Nova ação', () => UI.prompt('Nova ação', 'Nome', 'Ação ' + ((Actions.sets[Actions.sel.set] || Actions.sets[0]).items.length + 1)).then((v) => {
          if (!v) return; const set = Actions.sets[Actions.sel.set] || Actions.sets[0]; const it = { name: v, steps: [], open: true }; set.items.push(it);
          Actions.sel = { set: Actions.sets.indexOf(set), item: set.items.length - 1 }; Actions.rec = it; recBtn.classList.add('active'); Actions.save(); renderActions(); UI.toast('Gravando "' + v + '".');
        })),
        UI.iconBtn('trash', 'Excluir ação', () => { const set = Actions.sets[Actions.sel.set]; if (!set || !set.items[Actions.sel.item]) return; set.items.splice(Actions.sel.item, 1); Actions.sel.item = 0; Actions.save(); renderActions(); }));
      acRoot.append(acList, foot);
      renderActions();
    },
    onShow() { renderActions(); }
  });

  /* ==================================================================
     COMPOSIÇÕES DE CAMADAS
     ================================================================== */
  let lcRoot, lcList;
  function captureComp(d) { const st = {}; IMG.Layers.walk(d.layers, (L) => { st[L.id] = { visible: L.visible, x: L.x, y: L.y, fx: L.fx ? JSON.parse(JSON.stringify(L.fx)) : null, opacity: L.opacity, blend: L.blend }; }); return st; }
  function applyComp(d, comp) {
    IMG.Layers.walk(d.layers, (L) => {
      const s = comp.state[L.id]; if (!s) return;
      L.visible = s.visible;
      if (comp.pos && (s.x !== L.x || s.y !== L.y)) L.translate(s.x - L.x, s.y - L.y);
      if (comp.fx) { L.fx = s.fx ? JSON.parse(JSON.stringify(s.fx)) : null; L.opacity = s.opacity; L.blend = s.blend; IMG.Effects.invalidate(L); }
    });
    bus.emit('layers:change', d); IMG.Engine.invalidate(); IMG.commit('Aplicar composição de camadas');
  }
  function renderComps() {
    if (!lcRoot || !lcRoot.isConnected) return;
    U.clear(lcList);
    const d = doc(); if (!d) return;
    (d.comps || []).forEach((c) => {
      const r = el('div.prow' + (d.activeComp === c.id ? '.on' : ''), el('span.pname', { text: c.name }));
      r.addEventListener('click', () => { d.activeComp = c.id; applyComp(d, c); renderComps(); });
      r.addEventListener('dblclick', () => IMG.UI.prompt('Composição de camadas', 'Nome', c.name).then((v) => { if (v) { c.name = v; renderComps(); } }));
      lcList.appendChild(r);
    });
    if (!(d.comps || []).length) lcList.appendChild(el('div.panel-empty', { text: 'Salve estados de visibilidade, posição e aparência das camadas.' }));
  }
  IMG.UI.registerPanel({
    id: 'layerComps', title: 'Composições de camadas', icon: 'layerComps',
    build(node) {
      lcRoot = node; const UI = IMG.UI; lcList = el('div.plist');
      const foot = el('div.panel-foot',
        UI.iconBtn('undo', 'Composição anterior', () => { const d = doc(); if (!d || !(d.comps || []).length) return; let i = d.comps.findIndex((c) => c.id === d.activeComp); i = (i - 1 + d.comps.length) % d.comps.length; d.activeComp = d.comps[i].id; applyComp(d, d.comps[i]); renderComps(); }),
        UI.iconBtn('redo', 'Próxima composição', () => { const d = doc(); if (!d || !(d.comps || []).length) return; let i = d.comps.findIndex((c) => c.id === d.activeComp); i = (i + 1) % d.comps.length; d.activeComp = d.comps[i].id; applyComp(d, d.comps[i]); renderComps(); }),
        UI.iconBtn('reset', 'Atualizar a composição selecionada', () => { const d = doc(); const c = d && (d.comps || []).find((q) => q.id === d.activeComp); if (c) { c.state = captureComp(d); UI.toast('Composição atualizada.'); } }),
        el('span.pgroup-fill'),
        UI.iconBtn('newLayer', 'Nova composição de camadas', () => { const d = doc(); if (!d) return; let vis = true, pos = true, fx = true; const nameIn = el('input.inp', { type: 'text', value: 'Composição ' + ((d.comps || []).length + 1) });
          UI.dialog({ title: 'Nova composição de camadas', width: 340, body: [UI.row('Nome', nameIn), el('h3.form-title', { text: 'Aplicar às camadas' }), UI.row('', UI.check('Visibilidade', true, (v) => { vis = v; }).el), UI.row('', UI.check('Posição', true, (v) => { pos = v; }).el), UI.row('', UI.check('Aparência (estilo de camada)', true, (v) => { fx = v; }).el)],
            buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => { d.comps = d.comps || []; const c = { id: U.uid('comp'), name: nameIn.value || 'Composição', state: captureComp(d), vis, pos, fx }; d.comps.push(c); d.activeComp = c.id; renderComps(); } }] }); }),
        UI.iconBtn('trash', 'Excluir composição', () => { const d = doc(); if (!d) return; d.comps = (d.comps || []).filter((c) => c.id !== d.activeComp); d.activeComp = null; renderComps(); }));
      lcRoot.append(lcList, foot);
      ['doc:change'].forEach((e) => bus.on(e, renderComps));
      renderComps();
    },
    onShow() { renderComps(); }
  });

  /* ==================================================================
     GLIFOS
     ================================================================== */
  const GLYPHS = {
    'Pontuação': '!¡?¿"\'«»‹›“”‘’‚„…·•–—_/\\|¦§¶†‡@&#%‰*~^`´¨¸',
    'Moedas': '$¢£¥€₹₽₩₪₺₿¤',
    'Matemática': '+−×÷=≠≈±∓<>≤≥∞∑∏√∫∂∆∇∈∉∩∪⊂⊃∧∨¬∀∃°′″‰½⅓⅔¼¾⅛⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃',
    'Setas': '←↑→↓↔↕↖↗↘↙⇐⇑⇒⇓⇔➔➜➤↩↪⟵⟶',
    'Símbolos': '©®™℠℗№℃℉µΩ♠♣♥♦♪♫☀☁☂★☆✓✔✗✘☐☑☒✉☎⌘⌥⏎',
    'Grego': 'αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ',
    'Acentuadas': 'ÁÀÂÃÄÅÇÉÈÊËÍÌÎÏÑÓÒÔÕÖÚÙÛÜÝáàâãäåçéèêëíìîïñóòôõöúùûüýÿßæœøÆŒØ',
    'Formas': '■□▪▫▲△▼▽◆◇○●◎◐◑◯▬▭▮▯░▒▓█'
  };
  IMG.UI.registerPanel({
    id: 'glyphs', title: 'Glifos', icon: 'glyphs',
    build(node) {
      const UI = IMG.UI;
      let cat = Object.keys(GLYPHS)[0];
      const grid = el('div.glyph-grid');
      const paint = () => {
        U.clear(grid);
        const f = IMG.Text.get('font') || 'Arial';
        Array.from(GLYPHS[cat]).forEach((ch) => {
          const b = el('button.glyph', { type: 'button', text: ch, title: 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') });
          b.style.fontFamily = '"' + f + '", sans-serif';
          b.addEventListener('mousedown', (e) => e.preventDefault());
          b.addEventListener('click', () => { if (IMG.Text.edit) { IMG.Text.Editor.insert(ch); IMG.Text.edit.ta.focus(); } else UI.toast('Clique em um texto com a ferramenta Texto para inserir glifos.'); });
          grid.appendChild(b);
        });
      };
      node.append(el('div.hist-top', UI.select(Object.keys(GLYPHS).map((k) => [k, k]), cat, (v) => { cat = v; paint(); }, { width: 160 }).el), grid);
      bus.on('text:change', U.debounce(paint, 200));
      paint();
    }
  });

  /* ==================================================================
     PREDEFINIÇÕES DE FERRAMENTA
     ================================================================== */
  const TP = { list: U.store.get('toolPresets', []), save() { U.store.set('toolPresets', this.list); } };
  IMG.ToolPresets = TP;
  let tpRoot, tpList, tpAll = false;
  function renderTP() {
    if (!tpRoot || !tpRoot.isConnected) return;
    U.clear(tpList);
    const T = IMG.Tools, cur = T.activeId;
    const items = TP.list.filter((p) => tpAll || p.tool === cur);
    if (!items.length) tpList.appendChild(el('div.panel-empty', { text: 'Nenhuma predefinição para esta ferramenta.' }));
    items.forEach((p) => {
      const def = T.defs[p.tool];
      const r = el('div.prow', def ? IMG.iconEl(def.icon, 16) : null, el('span.pname', { text: p.name }));
      r.addEventListener('click', () => { T.set(p.tool); Object.keys(p.opts).forEach((k) => T.setOpt(p.tool, k, JSON.parse(JSON.stringify(p.opts[k])), true)); IMG.UI.renderOptions(); bus.emit('tool:option', p.tool); });
      r.addEventListener('contextmenu', (e) => { e.preventDefault(); IMG.UI.contextMenu(e.clientX, e.clientY, [{ label: 'Renomear', run: () => IMG.UI.prompt('Renomear predefinição', 'Nome', p.name).then((v) => { if (v) { p.name = v; TP.save(); renderTP(); } }) }, { label: 'Excluir', run: () => { TP.list.splice(TP.list.indexOf(p), 1); TP.save(); renderTP(); } }]); });
      tpList.appendChild(r);
    });
  }
  IMG.UI.registerPanel({
    id: 'toolPresets', title: 'Predefinições de ferramenta', icon: 'toolPresets',
    build(node) {
      tpRoot = node; const UI = IMG.UI; tpList = el('div.plist');
      const foot = el('div.panel-foot', UI.check('Todas as ferramentas', false, (v) => { tpAll = v; renderTP(); }).el, el('span.pgroup-fill'),
        UI.iconBtn('newLayer', 'Nova predefinição a partir da ferramenta atual', () => { const T = IMG.Tools, id = T.activeId; if (!id) return; UI.prompt('Nova predefinição', 'Nome', T.defs[id].name + ' ' + (TP.list.filter((p) => p.tool === id).length + 1)).then((v) => { if (v) { TP.list.push({ tool: id, name: v, opts: JSON.parse(JSON.stringify(T.o(id))) }); TP.save(); renderTP(); } }); }));
      tpRoot.append(tpList, foot);
      bus.on('tool:change', renderTP);
      renderTP();
    },
    onShow() { renderTP(); }
  });

  /* ==================================================================
     CSS
     ================================================================== */
  let cssRoot;
  function cssFor(L, d) {
    const b = L.contentBounds() || { x: 0, y: 0, w: 0, h: 0 };
    const out = ['.' + (L.name || 'camada').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + ' {', '  position: absolute;', '  left: ' + b.x + 'px;', '  top: ' + b.y + 'px;', '  width: ' + b.w + 'px;', '  height: ' + b.h + 'px;'];
    if (L.opacity < 1) out.push('  opacity: ' + U.round(L.opacity, 2) + ';');
    if (L.blend && L.blend !== 'normal' && L.blend !== 'pass') out.push('  mix-blend-mode: ' + L.blend + ';');
    if (L.type === 'shape') {
      const s = IMG.Shapes.normalize(L.shape);
      if (s.fill && s.fill.type === 'solid') out.push('  background-color: ' + s.fill.color + ';');
      if (s.live && s.live.kind === 'rect' && s.live.radii && s.live.radii.some((r) => r)) out.push('  border-radius: ' + s.live.radii.map((r) => U.round(r, 1) + 'px').join(' ') + ';');
      if (s.live && s.live.kind === 'ellipse') out.push('  border-radius: 50%;');
      if (s.stroke && s.stroke.on && s.stroke.fill && s.stroke.fill.type === 'solid') out.push('  border: ' + s.stroke.width + 'px solid ' + s.stroke.fill.color + ';');
    }
    if (L.type === 'text') {
      const st = IMG.Text.Model.styleAt(IMG.Text.normalize(L.text, L), 0), p = (L.text.paras || [])[0] || {};
      out.push('  font-family: "' + st.font + '";', '  font-size: ' + U.round(st.size, 1) + 'px;', '  font-weight: ' + st.weight + ';', '  color: ' + st.color + ';');
      if (st.italic) out.push('  font-style: italic;');
      if (st.tracking) out.push('  letter-spacing: ' + U.round(st.tracking / 1000, 3) + 'em;');
      if (st.leading) out.push('  line-height: ' + U.round(st.leading, 1) + 'px;');
      if (p.align && p.align !== 'left') out.push('  text-align: ' + p.align.replace('justify-left', 'justify').replace(/justify-.*/, 'justify') + ';');
      if (st.underline || st.strike) out.push('  text-decoration: ' + [st.underline ? 'underline' : '', st.strike ? 'line-through' : ''].filter(Boolean).join(' ') + ';');
    }
    const fx = L.fx || {};
    const shadow = (e, inset) => { const a = U.rad(e.useGlobal ? (d.globalAngle || 120) : e.angle); return (inset ? 'inset ' : '') + U.round(-Math.cos(a) * e.distance, 1) + 'px ' + U.round(Math.sin(a) * e.distance, 1) + 'px ' + e.size + 'px ' + U.rgba(e.color, e.opacity / 100); };
    const sh = [];
    if (fx.dropShadow && fx.dropShadow.enabled) sh.push(shadow(fx.dropShadow, false));
    if (fx.innerShadow && fx.innerShadow.enabled) sh.push(shadow(fx.innerShadow, true));
    if (sh.length) out.push('  ' + (L.type === 'text' ? 'text-shadow' : 'box-shadow') + ': ' + sh.join(', ') + ';');
    out.push('}');
    return out.join('\n');
  }
  function renderCSS() {
    if (!cssRoot || !cssRoot.isConnected) return;
    U.clear(cssRoot);
    const d = doc(), sel = d ? IMG.Layers.selectedLayers(d) : [];
    if (!sel.length) { cssRoot.appendChild(el('div.panel-empty', { text: 'Selecione camadas para ver o CSS.' })); return; }
    const txt = sel.map((L) => cssFor(L, d)).join('\n\n');
    const pre = el('pre.css-code', { text: txt });
    cssRoot.append(pre, el('div.props-actions', IMG.UI.btn('Copiar', () => { navigator.clipboard && navigator.clipboard.writeText(txt).then(() => IMG.UI.toast('CSS copiado.')).catch(() => IMG.UI.toast('Não foi possível copiar.')); }, { small: true })));
  }
  IMG.UI.registerPanel({
    id: 'css', title: 'CSS', icon: 'css',
    build(node) { cssRoot = el('div.panel-css'); node.appendChild(cssRoot); ['layers:select', 'layers:change', 'layer:pixels', 'doc:change'].forEach((e) => bus.on(e, U.debounce(renderCSS, 150))); renderCSS(); },
    onShow() { renderCSS(); }
  });

  /* ---------- atalhos de canais ---------- */
  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, H) => {
    C('channel.rgb', 'Canal composto', () => selectChannel(H.doc(), 'rgb'), { enabled: H.has, keys: ['ctrl+2'] });
    ['r', 'g', 'b'].forEach((c, i) => C('channel.' + c, 'Canal ' + CH[c][0], () => selectChannel(H.doc(), 'color', c), { enabled: H.has, keys: ['ctrl+' + (i + 3)] }));
    for (let i = 0; i < 4; i++) C('channel.alpha' + i, 'Canal alfa ' + (i + 1), () => { const d = H.doc(), ch = (d.channels || [])[i]; if (ch) selectChannel(d, 'alpha', ch.id); }, { enabled: () => !!(H.has() && (H.doc().channels || [])[i]), keys: ['ctrl+' + (i + 6)] });
  });
  bus.on('history:change', (d) => { if (d && d.editChannel && !(d.channels || []).some((c) => c.id === d.editChannel)) { d.editChannel = null; d.editMask = false; } });
})();
