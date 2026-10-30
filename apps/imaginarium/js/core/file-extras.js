/* ==========================================================================
   Imaginarium — Arquivo e Imagem (extras)
   Abrir PSD/PSB/TIFF/TGA/GIF animado, Salvar como PSD, Exportar como (com
   prévia), exportar camadas, imprimir, informações do arquivo, arquivos
   recentes, lote, folha de contatos, script; modos de imagem, duplicar,
   revelar tudo, aplicar imagem, vetorizar bitmap, variáveis e o novo
   diálogo Tamanho da imagem.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el, F = IMG.Formats;
  const Files = IMG.Files, Layers = IMG.Layers;
  const extOf = (n) => { const m = /\.([a-z0-9]+)$/i.exec(n || ''); return m ? m[1].toLowerCase() : ''; };
  const OPEN_ACCEPT = '.png,.jpg,.jpeg,.jfif,.webp,.svg,.gif,.bmp,.avif,.ico,.psd,.psb,.tif,.tiff,.tga,.edt,image/*';

  /* ==================================================================
     ARQUIVOS RECENTES (identificadores guardados no IndexedDB)
     ================================================================== */
  const Recent = {
    list: U.store.get('recent', []) || [],
    db: null,
    idb() {
      if (this.db) return Promise.resolve(this.db);
      if (!window.indexedDB) return Promise.resolve(null);
      return new Promise((res) => {
        try {
          const rq = indexedDB.open('imaginarium', 1);
          rq.onupgradeneeded = () => rq.result.createObjectStore('handles');
          rq.onsuccess = () => { this.db = rq.result; res(this.db); };
          rq.onerror = () => res(null);
        } catch (err) { res(null); }
      });
    },
    async put(key, h) { const db = await this.idb(); if (!db) return; await new Promise((res) => { try { const tx = db.transaction('handles', 'readwrite'); tx.objectStore('handles').put(h, key); tx.oncomplete = res; tx.onerror = res; } catch (err) { res(); } }); },
    async get(key) { const db = await this.idb(); if (!db) return null; return new Promise((res) => { try { const rq = db.transaction('handles').objectStore('handles').get(key); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); } catch (err) { res(null); } }); },
    add(name, handle) {
      const key = 'f:' + name;
      this.list = [{ name, key, handle: !!handle, t: Date.now() }].concat(this.list.filter((r) => r.name !== name)).slice(0, 15);
      U.store.set('recent', this.list);
      if (handle) this.put(key, handle);
    },
    async open(r) {
      const h = r.handle ? await this.get(r.key) : null;
      if (!h) { IMG.UI.toast('Abra "' + r.name + '" novamente em Arquivo › Abrir (o navegador não guardou o acesso).'); return; }
      try {
        if (h.queryPermission && (await h.queryPermission({ mode: 'read' })) !== 'granted' && (await h.requestPermission({ mode: 'read' })) !== 'granted') return;
        const f = await h.getFile();
        await Files.openFiles([f], [h]);
      } catch (err) { IMG.UI.toast('Não foi possível abrir "' + r.name + '": ' + err.message, 'error'); }
    }
  };
  IMG.Recent = Recent;
  Files.recentItems = () => (Recent.list.length
    ? Recent.list.map((r) => ({ label: r.name, run: () => Recent.open(r) })).concat(['-', { label: 'Limpar arquivos recentes', run: () => { Recent.list = []; U.store.set('recent', []); } }])
    : [{ label: 'Nenhum arquivo recente', enabled: () => false, run() {} }]);

  /* ==================================================================
     ABRIR
     ================================================================== */
  const origOpen = Files.openFiles.bind(Files), origPlace = Files.placeFile.bind(Files);
  function docFromCanvas(c, name) {
    const doc = new IMG.Doc({ name, width: c.width, height: c.height });
    const opaque = Files.isOpaque(c);
    const L = new IMG.Layer('raster', { name: opaque ? 'Fundo' : 'Camada 0', canvas: c });
    if (opaque) { L.isBg = true; L.lockPos = true; L.lockAlpha = true; }
    doc.layers.push(L); doc.activeId = L.id; doc.selected = new Set([L.id]);
    return doc;
  }
  /** Decodifica qualquer formato suportado para um documento (sem adicioná-lo). */
  async function decodeToDoc(f) {
    const e = extOf(f.name), name = U.baseName(f.name);
    if (e === 'psd' || e === 'psb') { const d = await IMG.PSD.read(await f.arrayBuffer(), name); d.sourceExt = e; return d; }
    if (e === 'tif' || e === 'tiff') { const d = docFromCanvas(await F.decodeTIFF(await f.arrayBuffer()), name); d.sourceExt = e; return d; }
    if (e === 'tga') { const d = docFromCanvas(F.decodeTGA(await f.arrayBuffer()), name); d.sourceExt = e; return d; }
    if (e === 'gif') {
      const g = F.decodeGIF(await f.arrayBuffer());
      if (g.frames.length > 1) {
        const doc = new IMG.Doc({ name, width: g.width, height: g.height });
        g.frames.forEach((fr, i) => { const L = new IMG.Layer('raster', { name: 'Quadro ' + (i + 1) + ' (' + fr.delay + ' ms)', canvas: fr.canvas }); L.frameDelay = fr.delay; doc.layers.push(L); });
        const top = doc.layers[doc.layers.length - 1]; doc.activeId = top.id; doc.selected = new Set([top.id]);
        doc.sourceExt = 'gif'; doc.animDelay = g.frames[0].delay;
        return doc;
      }
    }
    const d = docFromCanvas(await Files.decode(f), name); d.sourceExt = e; return d;
  }
  Files.decodeToDoc = decodeToDoc;
  Files.openFiles = async function (files, handles) {
    if (!files || !files.length) return;
    const rest = [];
    const hide = IMG.UI.busy('Abrindo…');
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i], e = extOf(f.name);
        if (e === 'edt' || !['psd', 'psb', 'tif', 'tiff', 'tga', 'gif'].includes(e)) { rest.push(f); Recent.add(f.name, handles && handles[i]); continue; }
        try {
          const doc = await decodeToDoc(f);
          doc.fileHandle = e === 'psd' && handles && handles[i] ? handles[i] : null;
          doc.history.reset('Abrir');
          IMG.app.addDoc(doc);
          Recent.add(f.name, handles && handles[i]);
          if (doc._psdWarnings && doc._psdWarnings.length) IMG.UI.toast('PSD aberto. Atenção: ' + doc._psdWarnings.join(', ') + '.');
        } catch (err) { console.error(err); IMG.UI.toast('Não foi possível abrir "' + f.name + '": ' + err.message, 'error'); }
      }
    } finally { hide(); }
    if (rest.length) {
      await origOpen(rest);
      // documentos abertos pelo método original: lembra o identificador para Salvar
      if (handles) rest.forEach((f) => { const h = handles[files.indexOf(f)]; if (h && IMG.app.doc && IMG.app.doc.name === U.baseName(f.name)) IMG.app.doc.fileHandle = /\.edt$/i.test(f.name) ? h : IMG.app.doc.fileHandle; });
    }
  };
  Files.openDialog = async function () {
    if (typeof window.showOpenFilePicker === 'function') {
      try {
        const hs = await window.showOpenFilePicker({ multiple: true, types: [{ description: 'Imagens e projetos', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg', '.avif', '.ico', '.tif', '.tiff', '.tga'], 'application/octet-stream': ['.psd', '.psb', '.edt'] } }] });
        const files = await Promise.all(hs.map((h) => h.getFile()));
        return this.openFiles(files, hs);
      } catch (err) { if (err && err.name === 'AbortError') return; }
    }
    return this.openFiles(await this.pick(OPEN_ACCEPT, true));
  };
  Files.placeFile = async function (doc, file) {
    const e = extOf(file.name);
    if (!['psd', 'psb', 'tif', 'tiff', 'tga'].includes(e)) return origPlace(doc, file);
    try {
      const d = await decodeToDoc(file);
      let c = IMG.Engine.flatten(d);
      const k = Math.min(1, doc.width / c.width, doc.height / c.height);
      if (k < 1) c = IMG.scaleCanvas(c, c.width * k, c.height * k);
      const L = Layers.fromCanvas(doc, c, U.baseName(file.name).slice(0, 40), Math.round((doc.width - c.width) / 2), Math.round((doc.height - c.height) / 2));
      if (IMG.Smart && IMG.Smart.fromDoc) IMG.Smart.fromDoc(L, d);
      bus.emit('layers:change', doc); IMG.commit('Inserir imagem');
      return L;
    } catch (err) { IMG.UI.toast('Não foi possível inserir "' + file.name + '": ' + err.message, 'error'); return null; }
  };
  Files.placeDialog = async function () {
    const doc = IMG.app.doc;
    const files = await this.pick(OPEN_ACCEPT.replace(',.edt', ''), true);
    if (!doc) return this.openFiles(files);
    for (const f of files) await this.placeFile(doc, f);
  };

  /* ==================================================================
     SALVAR (PSD)
     ================================================================== */
  async function saveBlob(blob, suggested, desc, mime, exts, doc, reuse) {
    let handle = reuse && doc && doc.fileHandle && doc.fileHandle.name && new RegExp('\\.(' + exts.map((x) => x.slice(1)).join('|') + ')$', 'i').test(doc.fileHandle.name) ? doc.fileHandle : null;
    if (!handle && typeof window.showSaveFilePicker === 'function') {
      try { handle = await window.showSaveFilePicker({ suggestedName: suggested, types: [{ description: desc, accept: { [mime]: exts } }] }); }
      catch (err) { if (err && err.name === 'AbortError') return null; handle = null; }
    }
    if (handle) { const w = await handle.createWritable(); await w.write(blob); await w.close(); return handle; }
    U.download(blob, suggested);
    return { name: suggested };
  }
  Files.savePSD = async function (doc, reuse) {
    doc = doc || IMG.app.doc; if (!doc) return false;
    const hide = IMG.UI.busy('Gravando PSD…');
    try {
      const { blob, warnings } = await IMG.PSD.write(doc);
      const h = await saveBlob(blob, U.safeFile(doc.name) + '.psd', 'Documento do Photoshop', 'image/vnd.adobe.photoshop', ['.psd'], doc, reuse);
      if (!h) return false;
      if (h.createWritable) doc.fileHandle = h;
      doc.savedState = doc.history.current; doc.sourceFormat = 'psd';
      bus.emit('doc:rename', doc);
      IMG.UI.toast('Salvo: ' + h.name + ' (' + U.fmtBytes(blob.size) + ')' + (warnings.length ? ' — atenção: ' + warnings.join(', ') + '.' : ''));
      return true;
    } catch (err) { IMG.UI.fail(err); return false; } finally { hide(); }
  };
  {
    const origSave = Files.save.bind(Files);
    Files.save = function (doc, saveAs) {
      doc = doc || IMG.app.doc;
      if (doc && !saveAs && doc.sourceFormat === 'psd') return this.savePSD(doc, true);
      return origSave(doc, saveAs);
    };
  }

  /* ==================================================================
     EXPORTAR COMO (com prévia)
     ================================================================== */
  const FORMATS = {
    png: { label: 'PNG', ext: 'png', mime: 'image/png', alpha: true },
    jpg: { label: 'JPG', ext: 'jpg', mime: 'image/jpeg', quality: true },
    webp: { label: 'WEBP', ext: 'webp', mime: 'image/webp', quality: true, alpha: true },
    gif: { label: 'GIF', ext: 'gif', mime: 'image/gif', alpha: true, gif: true },
    svg: { label: 'SVG', ext: 'svg', mime: 'image/svg+xml', vector: true },
    pdf: { label: 'PDF', ext: 'pdf', mime: 'application/pdf', quality: true },
    bmp: { label: 'BMP', ext: 'bmp', mime: 'image/bmp', alpha: true },
    tiff: { label: 'TIFF', ext: 'tif', mime: 'image/tiff', alpha: true },
    ico: { label: 'ICO', ext: 'ico', mime: 'image/x-icon', alpha: true, ico: true },
    tga: { label: 'TGA', ext: 'tga', mime: 'image/x-tga', alpha: true },
    psd: { label: 'PSD', ext: 'psd', mime: 'image/vnd.adobe.photoshop', layered: true }
  };
  /** Insere metadados (tEXt) num PNG. */
  async function pngWithText(blob, info) {
    const keys = { Title: info.title, Author: info.author, Description: info.description, Copyright: info.copyright, Keywords: info.keywords, Source: info.url };
    const ent = Object.keys(keys).filter((k) => keys[k]);
    if (!ent.length) return blob;
    const u = new Uint8Array(await blob.arrayBuffer());
    const chunks = ent.map((k) => {
      const str = k + '\0' + String(keys[k]).replace(/[^\x00-\xff]/g, '?'), txt = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) txt[i] = str.charCodeAt(i);
      const w = new F.Writer(false, txt.length + 12); w.u32(txt.length); const tb = new TextEncoder().encode('tEXt'); w.bytes(tb); w.bytes(txt);
      w.u32(F.crc32(new Uint8Array([...tb, ...txt])));
      return w.out();
    });
    return new Blob([u.subarray(0, 33), ...chunks, u.subarray(33)], { type: 'image/png' });
  }
  /** Gera o arquivo exportado. o: { format, w, h, quality, matte, alpha, colors, dither, animated, delay, loop, icoSizes, dpi, textAsText } */
  async function encodeDoc(doc, o) {
    const fm = FORMATS[o.format];
    const scaled = (c) => (c.width === o.w && c.height === o.h ? c : IMG.scaleCanvas(c, o.w, o.h));
    if (o.format === 'psd') return (await IMG.PSD.write(doc)).blob;
    if (o.format === 'svg') return F.encodeSVG(doc, { textAsText: o.textAsText !== false });
    if (o.format === 'gif' && o.animated) {
      const frames = [];
      const vis = doc.layers.filter((L) => L.type !== 'adjust');
      for (const L of vis) {
        const D = new IMG.Doc({ name: 'q', width: doc.width, height: doc.height }); const C = Layers.clone(L); C.visible = true; C.parent = null; D.layers = [C];
        let c = IMG.Engine.flatten(D, o.alpha ? null : o.matte);
        c = scaled(c);
        frames.push({ canvas: c, delay: L.frameDelay || o.delay, disposal: o.alpha ? 2 : 1 });
      }
      return F.encodeGIF(frames, o.w, o.h, { loop: o.loop, dither: o.dither, colors: o.colors });
    }
    const opaque = !fm.alpha || !o.alpha;
    const c = scaled(IMG.Engine.flatten(doc, opaque ? o.matte : null));
    if (o.format === 'gif') return F.encodeGIF([{ canvas: c, delay: 0 }], o.w, o.h, { dither: o.dither, colors: o.colors });
    if (o.format === 'bmp') return F.encodeBMP(c);
    if (o.format === 'tiff') return F.encodeTIFF(c, doc.dpi || 72);
    if (o.format === 'tga') return F.encodeTGA(c, true);
    if (o.format === 'ico') return F.encodeICO(c, o.icoSizes && o.icoSizes.length ? o.icoSizes : [16, 32, 48, 256]);
    if (o.format === 'pdf') { const jb = await U.toBlob(c, 'image/jpeg', o.quality / 100); return Files.buildPDF(new Uint8Array(await jb.arrayBuffer()), c.width, c.height, (c.width * 72) / (o.dpi || 300), (c.height * 72) / (o.dpi || 300), doc.name); }
    let blob = await U.toBlob(c, fm.mime, fm.quality ? o.quality / 100 : undefined);
    if (o.format === 'webp' && blob.type !== 'image/webp') throw new Error('Este navegador não codifica WEBP. Use PNG ou JPG.');
    if (o.format === 'png' && doc.info) blob = await pngWithText(blob, doc.info);
    return blob;
  }
  IMG.encodeDoc = encodeDoc;

  function exportAs(format) {
    const doc = IMG.app.doc, UI = IMG.UI; if (!doc) return;
    const p = IMG.app.prefs;
    const o = { format: format || p.lastExport || 'png', w: doc.width, h: doc.height, quality: p.exportQuality || 92, matte: '#ffffff', alpha: true, colors: 256, dither: true, animated: false, delay: 100, loop: 0, icoSizes: [16, 32, 48, 256], dpi: doc.dpi || 300, textAsText: true };
    const ratio = doc.width / doc.height;
    const nameIn = el('input.inp', { type: 'text', value: U.safeFile(doc.name), maxlength: 120 });
    const extTag = el('span.ext-tag');
    const opts = el('div.xp-opts');
    const prevBox = el('div.xp-preview'), prevCanvas = U.domCanvas(10, 10); prevCanvas.className = 'xp-canvas';
    const sizeNote = el('div.xp-note', { text: 'Calculando…' });
    prevBox.append(prevCanvas);
    let token = 0;
    const preview = U.debounce(async () => {
      const my = ++token;
      sizeNote.textContent = 'Calculando…';
      try {
        const blob = await encodeDoc(doc, o);
        if (my !== token) return;
        sizeNote.textContent = o.w + ' × ' + o.h + ' px — ' + U.fmtBytes(blob.size);
        // prévia: decodifica o próprio arquivo quando o navegador consegue
        let img = null;
        if (['png', 'jpg', 'webp', 'gif', 'bmp', 'svg'].includes(o.format)) { try { const url = URL.createObjectURL(blob); img = await U.loadImage(url); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (err) { img = null; } }
        const src = img || IMG.Engine.flatten(doc);
        const box = prevBox.getBoundingClientRect(), k = Math.min(1, (box.width - 16) / o.w, (box.height - 16) / o.h);
        const pw = Math.max(1, Math.round(o.w * k)), ph = Math.max(1, Math.round(o.h * k));
        const dpr = window.devicePixelRatio || 1;
        prevCanvas.width = pw * dpr; prevCanvas.height = ph * dpr; prevCanvas.style.width = pw + 'px'; prevCanvas.style.height = ph + 'px';
        const x = prevCanvas.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, pw, ph); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, pw, ph);
      } catch (err) { if (my === token) sizeNote.textContent = err.message; }
    }, 280);
    const render = () => {
      U.clear(opts);
      const fm = FORMATS[o.format];
      extTag.textContent = '.' + fm.ext;
      opts.appendChild(UI.row('Formato', UI.select(Object.keys(FORMATS).map((k) => [k, FORMATS[k].label]), o.format, (v) => { o.format = v; render(); preview(); }, { width: 140, keepFocus: true }).el));
      if (!fm.layered && !fm.vector) {
        const nw = UI.num({ value: o.w, min: 1, max: 30000, unit: 'px', width: 90, onInput: (v) => { o.w = v; o.h = Math.max(1, Math.round(v / ratio)); nh.set(o.h); preview(); } });
        const nh = UI.num({ value: o.h, min: 1, max: 30000, unit: 'px', width: 90, onInput: (v) => { o.h = v; o.w = Math.max(1, Math.round(v * ratio)); nw.set(o.w); preview(); } });
        opts.appendChild(UI.row('Largura', nw.el)); opts.appendChild(UI.row('Altura', nh.el));
        opts.appendChild(UI.row('', el('div.xp-scales', ...[25, 50, 100, 200].map((s) => UI.btn(s + '%', () => { o.w = Math.max(1, Math.round((doc.width * s) / 100)); o.h = Math.max(1, Math.round((doc.height * s) / 100)); render(); preview(); }, { small: true })))));
      }
      if (fm.quality) opts.appendChild(UI.slider({ label: 'Qualidade', value: o.quality, min: 1, max: 100, step: 1, unit: '%', def: 92, onInput: (v) => { o.quality = v; preview(); } }).el);
      if (fm.alpha) opts.appendChild(UI.row('', UI.check('Transparência', o.alpha, (v) => { o.alpha = v; render(); preview(); }).el));
      if (!fm.vector && !fm.layered && (!fm.alpha || !o.alpha)) opts.appendChild(UI.row('Fundo', UI.colorBtn(o.matte, (hx) => { if (hx) { o.matte = hx; preview(); } }).el));
      if (fm.gif) {
        opts.appendChild(UI.row('Cores', UI.num({ value: o.colors, min: 2, max: 256, width: 80, onChange: (v) => { o.colors = v; preview(); } }).el));
        opts.appendChild(UI.row('', UI.check('Pontilhado (dithering)', o.dither, (v) => { o.dither = v; preview(); }).el));
        opts.appendChild(UI.row('', UI.check('Animação: camadas como quadros', o.animated, (v) => { o.animated = v; render(); preview(); }).el));
        if (o.animated) {
          opts.appendChild(UI.row('Atraso', UI.num({ value: o.delay, min: 10, max: 10000, unit: 'ms', width: 90, onChange: (v) => { o.delay = v; } }).el));
          opts.appendChild(UI.row('Repetir', UI.select([['0', 'Sempre'], ['1', 'Uma vez'], ['3', '3 vezes']], String(o.loop), (v) => { o.loop = +v; }, { width: 120, keepFocus: true }).el));
        }
      }
      if (fm.ico) { const box = el('div.xp-icos'); [16, 24, 32, 48, 64, 128, 256].forEach((s) => box.appendChild(UI.check(s + '', o.icoSizes.includes(s), (v) => { o.icoSizes = v ? [...new Set(o.icoSizes.concat(s))].sort((a, b) => a - b) : o.icoSizes.filter((q) => q !== s); preview(); }).el)); opts.appendChild(UI.row('Tamanhos', box)); }
      if (o.format === 'pdf') opts.appendChild(UI.row('Resolução', UI.num({ value: o.dpi, min: 36, max: 1200, unit: 'ppp', width: 90, onChange: (v) => { o.dpi = v; preview(); } }).el));
      if (o.format === 'svg') opts.appendChild(UI.row('', UI.check('Textos como texto (editáveis)', o.textAsText, (v) => { o.textAsText = v; preview(); }).el));
      if (fm.layered) opts.appendChild(el('p.dialog-note', { text: 'Mantém camadas, grupos, máscaras, estilos de camada, formas e ajustes simples. Textos são gravados como pixels.' }));
      opts.appendChild(sizeNote);
    };
    render();
    UI.dialog({
      title: 'Exportar como', width: 820, className: 'xp-dialog',
      body: [el('div.xp-wrap', prevBox, el('div.xp-side', UI.row('Nome', el('div.fill-field', nameIn, extTag)), opts))],
      buttons: [{ label: 'Cancelar' }, {
        label: 'Salvar', primary: true, onClick: (d) => {
          const fm = FORMATS[o.format], fname = U.safeFile(nameIn.value.trim() || doc.name) + '.' + fm.ext;
          p.lastExport = o.format; if (fm.quality) p.exportQuality = o.quality; IMG.app.savePrefs();
          const hide = UI.busy('Exportando…');
          encodeDoc(doc, o).then((b) => { U.download(b, fname); UI.toast('Exportado: ' + fname + ' (' + U.fmtBytes(b.size) + ')'); d.close('ok'); })
            .catch((err) => UI.fail(err)).finally(hide);
          return false;
        }
      }],
      onClose: () => { token++; preview.cancel && preview.cancel(); }
    });
    setTimeout(preview, 60);
  }
  Files.exportAs = exportAs;

  /* ---------- exportar camadas ---------- */
  function exportLayers() {
    const doc = IMG.app.doc, UI = IMG.UI; if (!doc) return;
    let fmt = 'png', trim = true, visibleOnly = true, leaves = false, prefix = U.safeFile(doc.name) + '_';
    const preIn = el('input.inp', { type: 'text', value: prefix });
    UI.dialog({ title: 'Exportar camadas', width: 400, body: [UI.row('Prefixo', preIn), UI.row('Formato', UI.select([['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WEBP']], fmt, (v) => { fmt = v; }, { width: 120, keepFocus: true }).el), UI.row('', UI.check('Recortar ao conteúdo', true, (v) => { trim = v; }).el), UI.row('', UI.check('Somente camadas visíveis', true, (v) => { visibleOnly = v; }).el), UI.row('', UI.check('Exportar camadas dentro dos grupos', false, (v) => { leaves = v; }).el)],
      buttons: [{ label: 'Cancelar' }, { label: 'Exportar', primary: true, onClick: () => {
        prefix = preIn.value;
        (async () => {
          const hide = UI.busy('Exportando camadas…');
          try {
            const list = [];
            const walk = (arr) => arr.forEach((L) => { if (visibleOnly && !L.visible) return; if (L.type === 'adjust') return; if (leaves && L.type === 'group' && !L.artboard) walk(L.children); else list.push(L); });
            walk(doc.layers);
            const files = [];
            for (let i = 0; i < list.length; i++) {
              const L = list[i];
              const D = new IMG.Doc({ name: 'l', width: doc.width, height: doc.height }); const C = Layers.clone(L); C.visible = true; C.parent = null; C.clip = false; D.layers = [C];
              let c = IMG.Engine.flatten(D, fmt === 'jpg' ? '#ffffff' : null);
              if (trim) { const b = IMG.alphaBounds ? IMG.alphaBounds(c) : null; const bb = b || (L.contentBounds && L.contentBounds()); if (bb && bb.w > 0 && bb.h > 0) { const t = U.createCanvas(bb.w, bb.h); t.getContext('2d').drawImage(c, -bb.x, -bb.y); c = t; } }
              files.push({ name: prefix + String(i + 1).padStart(2, '0') + '_' + U.safeFile(L.name) + '.' + fmt, data: await U.toBlob(c, fmt === 'jpg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png', 0.92) });
            }
            if (!files.length) { UI.toast('Nenhuma camada para exportar.'); return; }
            U.download(await F.zip(files), U.safeFile(doc.name) + '_camadas.zip');
            UI.toast(files.length + ' camadas exportadas.');
          } finally { hide(); }
        })().catch((err) => UI.fail(err));
      } }] });
  }

  /* ---------- imprimir ---------- */
  async function print() {
    const doc = IMG.app.doc; if (!doc) return;
    const c = IMG.Engine.flatten(doc, '#ffffff');
    const url = URL.createObjectURL(await U.toBlob(c, 'image/png'));
    const dpi = doc.dpi || 72, wIn = doc.width / dpi, hIn = doc.height / dpi;
    const fr = el('iframe', { style: { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' } });
    document.body.appendChild(fr);
    const d = fr.contentDocument;
    d.open(); d.write('<!doctype html><html><head><title>' + U.safeFile(doc.name) + '</title><style>@page{margin:10mm}html,body{margin:0}img{display:block;max-width:100%;max-height:100vh;width:' + wIn + 'in;height:auto;margin:auto}</style></head><body><img src="' + url + '"></body></html>'); d.close();
    const img = d.querySelector('img');
    const go = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (err) { IMG.UI.toast('Não foi possível imprimir.'); } setTimeout(() => { fr.remove(); URL.revokeObjectURL(url); }, 2000); };
    if (img.complete) go(); else img.onload = go;
    void hIn;
  }

  /* ---------- informações do arquivo ---------- */
  function fileInfo() {
    const doc = IMG.app.doc, UI = IMG.UI; if (!doc) return;
    const inf = doc.info = doc.info || {};
    const f = (k, multi) => { const n = el(multi ? 'textarea.inp' : 'input.inp', multi ? { rows: 3 } : { type: 'text' }); n.value = inf[k] || ''; n.addEventListener('input', () => { inf[k] = n.value; }); return n; };
    const st = UI.select([['unknown', 'Desconhecido'], ['copyrighted', 'Protegido por direitos autorais'], ['public', 'Domínio público']], inf.status || 'unknown', (v) => { inf.status = v; }, { width: 220, keepFocus: true });
    UI.dialog({ title: 'Informações do arquivo', width: 460, body: [UI.row('Título', f('title')), UI.row('Autor', f('author')), UI.row('Cargo do autor', f('authorTitle')), UI.row('Descrição', f('description', true)), UI.row('Palavras-chave', f('keywords')), UI.row('Direitos autorais', st.el), UI.row('Aviso de direitos', f('copyright')), UI.row('URL', f('url')),
      el('p.dialog-note', { text: 'Documento: ' + doc.width + ' × ' + doc.height + ' px · ' + (doc.dpi || 72) + ' ppp · modo ' + (doc.mode || 'rgb').toUpperCase() + ' · ' + (doc.bits || 8) + ' bits · ' + Layers.all(doc).length + ' camadas. Os metadados vão para o projeto .edt e para os PNG exportados.' })],
      buttons: [{ label: 'OK', primary: true, onClick: () => { IMG.commit('Informações do arquivo'); } }] });
  }
  {
    const origSer = Files.serialize.bind(Files);
    Files.serialize = async function (doc) {
      const blob = await origSer(doc);
      if (!doc.info && !doc.variables && !doc.mode) return blob;
      // regrava o cabeçalho JSON com os campos extras
      const u = new Uint8Array(await blob.arrayBuffer()), hlen = new DataView(u.buffer).getUint32(8, true);
      const header = JSON.parse(new TextDecoder().decode(u.subarray(12, 12 + hlen)));
      header.doc.info = doc.info || null; header.doc.variables = doc.variables || null; header.doc.palette = doc.palette || null;
      const json = new TextEncoder().encode(JSON.stringify(header)), len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, json.length, true);
      return new Blob([u.subarray(0, 8), len, json, u.subarray(12 + hlen)], { type: blob.type });
    };
    const origProj = Files.openProject.bind(Files);
    Files.openProject = async function (file) {
      const doc = await origProj(file);
      try {
        const u = new Uint8Array(await file.arrayBuffer()), hlen = new DataView(u.buffer).getUint32(8, true);
        const h = JSON.parse(new TextDecoder().decode(u.subarray(12, 12 + hlen))).doc;
        if (h.info) doc.info = h.info; if (h.variables) doc.variables = h.variables; if (h.mode) doc.mode = h.mode; if (h.palette) doc.palette = h.palette;
      } catch (err) { /* sem extras */ }
      return doc;
    };
  }

  /* ---------- automatizar: lote ---------- */
  function batch() {
    const UI = IMG.UI, A = IMG.Actions;
    if (!A) { UI.toast('Painel Ações indisponível.'); return; }
    const acts = []; A.sets.forEach((s, si) => s.items.forEach((it, ii) => acts.push([si + ':' + ii, s.name + ' › ' + it.name])));
    if (!acts.length) { UI.toast('Grave uma ação no painel Ações primeiro.'); return; }
    let act = acts[0][0], fmt = 'same', files = [], quality = 92, suffix = '';
    const info = el('p.dialog-note', { text: 'Nenhum arquivo escolhido.' });
    const sufIn = el('input.inp', { type: 'text', value: '' });
    UI.dialog({ title: 'Lote', width: 460, body: [UI.row('Ação', UI.select(acts, act, (v) => { act = v; }, { width: 260, keepFocus: true }).el), UI.row('Origem', UI.btn('Escolher arquivos…', async () => { files = await Files.pick(OPEN_ACCEPT.replace(',.edt', ''), true); info.textContent = files.length + ' arquivo(s): ' + files.slice(0, 4).map((f) => f.name).join(', ') + (files.length > 4 ? '…' : ''); }, { small: true })), info,
      UI.row('Salvar como', UI.select([['same', 'Mesmo formato (PNG/JPG/WEBP)'], ['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WEBP'], ['psd', 'PSD']], fmt, (v) => { fmt = v; }, { width: 220, keepFocus: true }).el), UI.row('Sufixo do nome', sufIn), UI.slider({ label: 'Qualidade', value: 92, min: 1, max: 100, unit: '%', onInput: (v) => { quality = v; } }).el],
      buttons: [{ label: 'Cancelar' }, { label: 'Executar', primary: true, onClick: () => {
        if (!files.length) { UI.toast('Escolha os arquivos de origem.'); return false; }
        suffix = sufIn.value;
        (async () => {
          const [si, ii] = act.split(':').map(Number), item = A.sets[si].items[ii], out = [];
          const hide = UI.busy('Processando lote…');
          const prev = IMG.app.doc;
          try {
            for (const f of files) {
              let doc;
              try { doc = await decodeToDoc(f); } catch (err) { UI.toast('Ignorado: ' + f.name); continue; }
              doc.history.reset('Lote'); IMG.app.addDoc(doc);
              await A.play(item);
              const e = fmt === 'same' ? (['jpg', 'jpeg', 'webp', 'png'].includes(extOf(f.name)) ? extOf(f.name).replace('jpeg', 'jpg') : 'png') : fmt;
              const blob = await encodeDoc(doc, { format: e, w: doc.width, h: doc.height, quality, matte: '#ffffff', alpha: true });
              out.push({ name: U.baseName(f.name) + suffix + '.' + FORMATS[e].ext, data: blob });
              doc.savedState = doc.history.current; IMG.app.removeDoc(doc);
            }
          } finally { hide(); if (prev && IMG.app.docs.includes(prev)) IMG.app.setDoc(prev); }
          if (out.length) U.download(await F.zip(out), 'lote.zip');
          UI.toast(out.length + ' arquivo(s) processado(s).');
        })().catch((err) => UI.fail(err));
      } }] });
  }

  /* ---------- automatizar: folha de contatos ---------- */
  async function contactSheet() {
    const UI = IMG.UI;
    const files = await Files.pick(OPEN_ACCEPT.replace(',.edt', ''), true);
    if (!files.length) return;
    let W = 2480, H = 3508, cols = 4, rows = 5, gap = 40, captions = true, bg = '#ffffff', fsize = 28;
    UI.dialog({ title: 'Folha de contatos', width: 400, body: [el('p.dialog-note', { text: files.length + ' imagem(ns) escolhida(s).' }), UI.row('Largura', UI.num({ value: W, min: 100, max: 20000, unit: 'px', width: 100, onInput: (v) => { W = v; } }).el), UI.row('Altura', UI.num({ value: H, min: 100, max: 20000, unit: 'px', width: 100, onInput: (v) => { H = v; } }).el), UI.row('Colunas', UI.num({ value: cols, min: 1, max: 30, width: 70, onInput: (v) => { cols = v; } }).el), UI.row('Linhas', UI.num({ value: rows, min: 1, max: 30, width: 70, onInput: (v) => { rows = v; } }).el), UI.row('Espaçamento', UI.num({ value: gap, min: 0, max: 1000, unit: 'px', width: 90, onInput: (v) => { gap = v; } }).el), UI.row('', UI.check('Nome do arquivo como legenda', true, (v) => { captions = v; }).el), UI.row('Tamanho da legenda', UI.num({ value: fsize, min: 6, max: 200, unit: 'px', width: 80, onInput: (v) => { fsize = v; } }).el), UI.row('Fundo', UI.colorBtn(bg, (h) => { if (h) bg = h; }).el)],
      buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
        (async () => {
          const hide = UI.busy('Montando folha de contatos…');
          try {
            const per = cols * rows, pages = Math.ceil(files.length / per);
            for (let p = 0; p < pages; p++) {
              const doc = Files.create({ name: 'Folha de contatos' + (pages > 1 ? ' ' + (p + 1) : ''), width: W, height: H, background: bg });
              const cw = (W - gap * (cols + 1)) / cols, ch = (H - gap * (rows + 1)) / rows, capH = captions ? fsize * 1.6 : 0;
              for (let i = 0; i < per; i++) {
                const f = files[p * per + i]; if (!f) break;
                let c; try { const d = await decodeToDoc(f); c = IMG.Engine.flatten(d); } catch (err) { continue; }
                const k = Math.min(cw / c.width, (ch - capH) / c.height), w = Math.max(1, Math.round(c.width * k)), h = Math.max(1, Math.round(c.height * k));
                const col = i % cols, row = Math.floor(i / cols), x = Math.round(gap + col * (cw + gap) + (cw - w) / 2), y = Math.round(gap + row * (ch + gap) + (ch - capH - h) / 2);
                Layers.fromCanvas(doc, IMG.scaleCanvas(c, w, h), U.baseName(f.name).slice(0, 40), x, y);
                if (captions) makeText(doc, U.baseName(f.name), { x: gap + col * (cw + gap) + cw / 2, y: gap + row * (ch + gap) + ch - fsize * 0.4, size: fsize, color: '#000000', align: 'center' });
              }
              bus.emit('layers:change', doc); IMG.Engine.invalidate(); doc.history.reset('Folha de contatos');
            }
          } finally { hide(); }
        })().catch((err) => UI.fail(err));
      } }] });
  }

  /** Cria uma camada de texto de ponto. o: { x, y, size, color, font, align } */
  function makeText(doc, str, o = {}) {
    const T = IMG.Text, s = Object.assign({}, T.DEF_STYLE, { size: o.size || 24, color: o.color || '#000000', font: o.font || 'Arial' });
    const L = new IMG.Layer('text', { name: str.slice(0, 28) || 'Texto' });
    L.text = T.normalize({ text: str, runs: [{ n: str.length, s }], paras: str.split('\n').map(() => Object.assign({}, T.DEF_PARA, { align: o.align || 'left' })), x: o.x || 0, y: o.y || 0, box: null, orient: 'h', m: [1, 0, 0, 1], aa: 'smooth', auto: false }, L);
    Layers.add(doc, L); T.render(L);
    return L;
  }
  IMG.makeTextLayer = makeText;

  /* ---------- script ---------- */
  function scriptDialog() {
    const UI = IMG.UI;
    const ta = el('textarea.inp.code-area', { rows: 14, spellcheck: false });
    ta.value = U.store.get('lastScript', '// Exemplo: inverter as cores e duplicar a camada\n// Disponíveis: IMG, app (documento ativo), run(comando), alert(texto)\nrun("adj.invert");\nrun("layer.duplicate");\n');
    const out = el('pre.css-code', { text: '' });
    UI.dialog({ title: 'Script', width: 620, body: [el('p.dialog-note', { text: 'Execute JavaScript sobre o documento aberto. Use run("id.do.comando") para qualquer comando do menu (lista em Editar › Atalhos de teclado).' }), ta, out],
      footLeft: [UI.btn('Carregar…', async () => { const [f] = await Files.pick('.js,.jsx,.txt', false); if (f) ta.value = await f.text(); }, { small: true }), UI.btn('Salvar…', () => U.download(new Blob([ta.value], { type: 'text/javascript' }), 'script.js'), { small: true })],
      buttons: [{ label: 'Fechar' }, { label: 'Executar', primary: true, onClick: () => {
        U.store.set('lastScript', ta.value);
        const log = []; out.textContent = '';
        try {
          const fn = new Function('IMG', 'app', 'run', 'alert', 'console', ta.value);
          const r = fn(IMG, IMG.app.doc, (id, a) => IMG.UI.run(id, a), (m) => log.push(String(m)), { log: (...a) => log.push(a.map(String).join(' ')) });
          if (r && r.then) r.then((v) => { out.textContent = log.concat(v !== undefined ? ['→ ' + v] : []).join('\n') || 'Concluído.'; }).catch((err) => { out.textContent = 'Erro: ' + err.message; });
          else out.textContent = log.concat(r !== undefined ? ['→ ' + r] : []).join('\n') || 'Concluído.';
        } catch (err) { out.textContent = 'Erro: ' + err.message; }
        return false;
      } }] });
  }

  /* ==================================================================
     MODOS DE IMAGEM
     ================================================================== */
  IMG.Engine.postProcess = function (ctx, R, doc) {
    if (doc.mode !== 'gray' && doc.mode !== 'bitmap') return;
    const img = ctx.getImageData(0, 0, R.w, R.h), d = img.data;
    for (let i = 0; i < d.length; i += 4) { let v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; if (doc.mode === 'bitmap') v = v >= 128 ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; }
    ctx.putImageData(img, 0, 0);
  };
  const grayHex = (hex) => { const c = U.hexToRgb(hex); const v = Math.round(0.299 * c.r + 0.587 * c.g + 0.114 * c.b); return U.rgbToHex(v, v, v); };
  function toGrayModels(doc) {
    Layers.walk(doc.layers, (L) => {
      if (L.type === 'raster' && L.canvas) { const x = L.canvas.getContext('2d'), img = x.getImageData(0, 0, L.canvas.width, L.canvas.height), d = img.data; for (let i = 0; i < d.length; i += 4) { const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = d[i + 1] = d[i + 2] = v; } x.putImageData(img, 0, 0); IMG.markDirty(L); }
      if (L.type === 'shape' && L.shape) { const s = IMG.Shapes.normalize(L.shape); if (s.fill && s.fill.color) s.fill.color = grayHex(s.fill.color); if (s.stroke && s.stroke.fill && s.stroke.fill.color) s.stroke.fill.color = grayHex(s.stroke.fill.color); IMG.Shapes.render(L); }
      if (L.type === 'text' && L.text && L.text.runs) { L.text.runs.forEach((r) => { if (r.s && r.s.color) r.s.color = grayHex(r.s.color); }); IMG.Text.render(L); }
      if (L.type === 'fill' && L.fillDef && L.fillDef.color) { L.fillDef.color = grayHex(L.fillDef.color); Layers.renderFill(L, doc); }
      if (L.fx) Object.keys(L.fx).forEach((k) => { const e = L.fx[k]; ['color', 'hlColor', 'shColor'].forEach((c) => { if (e && e[c]) e[c] = grayHex(e[c]); }); });
      IMG.Effects.invalidate(L);
    });
  }
  async function setMode(mode) {
    const doc = IMG.app.doc, UI = IMG.UI; if (!doc) return;
    const cur = doc.mode || 'rgb';
    if (cur === mode) return;
    if (mode === 'gray') {
      const ok = await UI.choice('Descartar as informações de cor?', [{ label: 'Cancelar', value: 'no' }, { label: 'Descartar', value: 'yes', primary: true }], 'Tons de cinza');
      if (ok !== 'yes') return;
      toGrayModels(doc); doc.mode = 'gray';
    } else if (mode === 'bitmap') {
      if (cur !== 'gray') { UI.toast('Converta primeiro para Tons de cinza (Imagem › Modo › Tons de cinza).'); return; }
      let method = 'diffusion', thr = 128;
      UI.dialog({ title: 'Bitmap', width: 360, body: [UI.row('Método', UI.select([['threshold', 'Limite de 50%'], ['pattern', 'Pontilhado padrão'], ['diffusion', 'Pontilhado de difusão'], ['halftone', 'Retícula']], method, (v) => { method = v; }, { width: 200, keepFocus: true }).el), UI.row('Limite', UI.num({ value: thr, min: 1, max: 254, width: 70, onInput: (v) => { thr = v; } }).el), el('p.dialog-note', { text: 'A imagem será achatada.' })],
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
          Layers.flatten(doc);
          const L = doc.layers[0]; L.ensureCovers && L.ensureCovers(doc.rect);
          const W = L.canvas.width, H = L.canvas.height, x = L.canvas.getContext('2d'), img = x.getImageData(0, 0, W, H), d = img.data;
          const g = new Float32Array(W * H); for (let i = 0; i < g.length; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
          const B = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
          for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
            const i = y * W + xx, v = g[i]; let o;
            if (method === 'threshold') o = v >= thr ? 255 : 0;
            else if (method === 'pattern') o = v > (B[y & 3][xx & 3] + 0.5) * 16 ? 255 : 0;
            else if (method === 'halftone') { const cell = 6, cx = (xx % cell) - cell / 2 + 0.5, cy = (y % cell) - cell / 2 + 0.5, r = Math.sqrt((1 - v / 255)) * cell * 0.72; o = cx * cx + cy * cy <= r * r ? 0 : 255; }
            else { o = v >= 128 ? 255 : 0; const e = v - o; if (xx + 1 < W) g[i + 1] += e * 7 / 16; if (y + 1 < H) { if (xx > 0) g[i + W - 1] += e * 3 / 16; g[i + W] += e * 5 / 16; if (xx + 1 < W) g[i + W + 1] += e / 16; } }
            d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = o; d[i * 4 + 3] = 255;
          }
          x.putImageData(img, 0, 0); IMG.markDirty(L);
          doc.mode = 'bitmap'; IMG.Engine.invalidate(); bus.emit('layers:change', doc); IMG.commit('Modo Bitmap'); bus.emit('doc:change', doc);
        } }] });
      return;
    } else if (mode === 'indexed') {
      let pal = 'adaptive', colors = 256, dither = true, transp = true;
      UI.dialog({ title: 'Cores indexadas', width: 380, body: [UI.row('Paleta', UI.select([['adaptive', 'Local (adaptável)'], ['uniform', 'Uniforme'], ['web', 'Web'], ['gray', 'Tons de cinza'], ['bw', 'Preto e branco']], pal, (v) => { pal = v; }, { width: 200, keepFocus: true }).el), UI.row('Cores', UI.num({ value: colors, min: 2, max: 256, width: 80, onInput: (v) => { colors = v; } }).el), UI.row('', UI.check('Pontilhado (difusão)', true, (v) => { dither = v; }).el), UI.row('', UI.check('Transparência', true, (v) => { transp = v; }).el), el('p.dialog-note', { text: 'As camadas visíveis serão mescladas.' })],
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
          Layers.flatten(doc);
          const L = doc.layers[0], W = L.canvas.width, H = L.canvas.height, x = L.canvas.getContext('2d'), img = x.getImageData(0, 0, W, H);
          let fixed = null;
          if (pal === 'web') { fixed = []; for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) fixed.push([r * 51, g * 51, b * 51]); }
          else if (pal === 'uniform') { fixed = []; const n = Math.max(2, Math.round(Math.cbrt(colors))); for (let r = 0; r < n; r++) for (let g = 0; g < n; g++) for (let b = 0; b < n; b++) fixed.push([r, g, b].map((v) => Math.round((v * 255) / (n - 1)))); }
          else if (pal === 'gray') { fixed = []; for (let i = 0; i < colors; i++) { const v = Math.round((i * 255) / (colors - 1)); fixed.push([v, v, v]); } }
          else if (pal === 'bw') fixed = [[0, 0, 0], [255, 255, 255]];
          const q = fixed ? F.mapToPalette(img.data, fixed, transp && !Files.isOpaque(L.canvas), { dither, width: W, alphaThreshold: 128 }) : F.quantize(img.data, colors, { dither, width: W });
          const d = img.data;
          for (let i = 0; i < W * H; i++) { const k = q.index[i]; if (k === q.transparent) { d[i * 4 + 3] = 0; continue; } const p = q.palette[k]; d[i * 4] = p[0]; d[i * 4 + 1] = p[1]; d[i * 4 + 2] = p[2]; d[i * 4 + 3] = 255; }
          x.putImageData(img, 0, 0); IMG.markDirty(L);
          doc.mode = 'indexed'; doc.palette = q.palette.filter((_, i) => i !== q.transparent);
          IMG.Engine.invalidate(); bus.emit('layers:change', doc); IMG.commit('Cores indexadas'); bus.emit('doc:change', doc);
        } }] });
      return;
    } else doc.mode = mode;
    IMG.Engine.invalidate(); bus.emit('layers:change', doc); bus.emit('doc:change', doc);
    IMG.commit('Modo ' + ({ rgb: 'RGB', cmyk: 'CMYK', lab: 'Lab', gray: 'Tons de cinza' }[mode] || mode));
  }

  /* ==================================================================
     IMAGEM: duplicar, revelar tudo, aplicar imagem, vetorizar, variáveis
     ================================================================== */
  function duplicate() {
    const doc = IMG.app.doc, UI = IMG.UI; if (!doc) return;
    let merged = false; const nameIn = el('input.inp', { type: 'text', value: doc.name + ' ' + (window.NebulosaIdiomas ? NebulosaIdiomas.t('cópia') : 'cópia') });
    UI.dialog({ title: 'Duplicar imagem', width: 380, body: [UI.row('Como', nameIn), UI.row('', UI.check('Duplicar somente camadas mescladas', false, (v) => { merged = v; }).el)],
      buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
        const D = new IMG.Doc({ name: nameIn.value.trim() || doc.name + ' ' + (window.NebulosaIdiomas ? NebulosaIdiomas.t('cópia') : 'cópia'), width: doc.width, height: doc.height, dpi: doc.dpi });
        if (merged) { const L = new IMG.Layer('raster', { name: 'Fundo', canvas: IMG.Engine.flatten(doc) }); D.layers = [L]; }
        else D.layers = doc.layers.map((L) => { const C = Layers.clone(L, ''); C.name = L.name; C.isBg = L.isBg; C.lockPos = L.lockPos; C.lockAlpha = L.lockAlpha; C.parent = null; return C; });
        D.guides = IMG.jclone(doc.guides); D.paths = IMG.jclone(doc.paths || []); D.dpi = doc.dpi; D.mode = doc.mode; D.bits = doc.bits; D.info = IMG.jclone(doc.info || null);
        (doc.channels || []).forEach((c) => IMG.Channels.add(D, c.name, U.cloneCanvas(c.canvas)));
        const all = Layers.all(D); D.activeId = all.length ? all[all.length - 1].id : null; D.selected = new Set(D.activeId ? [D.activeId] : []);
        D.history.reset('Duplicar'); IMG.app.addDoc(D);
      } }] });
  }
  function revealAll() {
    const doc = IMG.app.doc; if (!doc) return;
    let u = doc.rect;
    Layers.walk(doc.layers, (L) => { if (L.type === 'group' && !L.artboard) return; const b = L.contentBounds && L.contentBounds(); if (b) u = U.rectUnion(u, b); });
    u = U.rectInt(u);
    if (u.x === 0 && u.y === 0 && u.w === doc.width && u.h === doc.height) { IMG.UI.toast('Todo o conteúdo já está visível.'); return; }
    const dx = -u.x, dy = -u.y;
    IMG.ImageOps.canvasSize(doc, u.w, u.h, u.w > doc.width ? dx / (u.w - doc.width) : 0, u.h > doc.height ? dy / (u.h - doc.height) : 0);
  }
  function applyImage() {
    const doc = IMG.app.doc, UI = IMG.UI, L = doc && doc.active;
    if (!L || L.type !== 'raster') { UI.toast('Selecione uma camada de pixels.'); return; }
    const docs = IMG.app.docs.filter((d) => d.width === doc.width && d.height === doc.height);
    let srcDoc = doc, layer = 'merged', channel = 'rgb', invert = false, blend = 'multiply', opacity = 100, keepT = false;
    const before = U.cloneCanvas(L.canvas), bx = L.x, by = L.y;
    const layerSel = el('span');
    const fillLayers = () => { U.clear(layerSel); layerSel.appendChild(UI.select([['merged', 'Mesclado']].concat(Layers.all(srcDoc).filter((q) => q.type !== 'group' && q.type !== 'adjust').reverse().map((q) => [q.id, q.name])), layer, (v) => { layer = v; apply(); }, { width: 200, keepFocus: true }).el); };
    const srcCanvas = () => {
      let c;
      if (layer === 'merged') c = IMG.Engine.flatten(srcDoc);
      else { const q = Layers.find(srcDoc, layer); c = U.createCanvas(doc.width, doc.height); if (q && q.canvas) c.getContext('2d').drawImage(q.canvas, q.x, q.y); }
      const x = c.getContext('2d'), img = x.getImageData(0, 0, c.width, c.height), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i + 1], b = d[i + 2];
        if (channel === 'r') g = b = r; else if (channel === 'g') r = b = g; else if (channel === 'b') r = g = b; else if (channel === 'a') { r = g = b = d[i + 3]; d[i + 3] = 255; }
        if (invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
        d[i] = r; d[i + 1] = g; d[i + 2] = b;
      }
      x.putImageData(img, 0, 0); return c;
    };
    const apply = () => {
      L.setCanvas(U.cloneCanvas(before), bx, by); L.ensureCovers(doc.rect);
      const x = L.canvas.getContext('2d'), alpha0 = keepT ? U.cloneCanvas(L.canvas) : null;
      IMG.Blend.draw(x, srcCanvas(), -L.x, -L.y, blend, opacity / 100);
      if (alpha0) { x.globalCompositeOperation = 'destination-in'; x.drawImage(alpha0, 0, 0); x.globalCompositeOperation = 'source-over'; }
      IMG.markDirty(L); bus.emit('layer:pixels', L); IMG.Engine.invalidate(); IMG.Engine.requestRender();
    };
    fillLayers();
    let ok = false;
    UI.dialog({ title: 'Aplicar imagem', width: 420, body: [
      UI.row('Origem', UI.select(docs.map((d) => [d.id, d.name]), srcDoc.id, (v) => { srcDoc = docs.find((d) => d.id === v) || doc; layer = 'merged'; fillLayers(); apply(); }, { width: 200, keepFocus: true }).el),
      UI.row('Camada', layerSel),
      UI.row('Canal', UI.select([['rgb', 'RGB'], ['r', 'Vermelho'], ['g', 'Verde'], ['b', 'Azul'], ['a', 'Transparência']], channel, (v) => { channel = v; apply(); }, { width: 160, keepFocus: true }).el, UI.check('Inverter', false, (v) => { invert = v; apply(); }).el),
      UI.row('Mesclagem', UI.select(IMG.BLEND_LIST, blend, (v) => { blend = v; apply(); }, { width: 200, keepFocus: true }).el),
      UI.row('Opacidade', UI.num({ value: 100, min: 0, max: 100, unit: '%', width: 80, onInput: (v) => { opacity = v; apply(); } }).el),
      UI.row('', UI.check('Preservar transparência', false, (v) => { keepT = v; apply(); }).el)],
      buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => { ok = true; } }],
      onClose: () => { if (ok) IMG.commit('Aplicar imagem'); else { L.setCanvas(before, bx, by); IMG.markDirty(L); IMG.Engine.invalidate(); IMG.Engine.requestRender(); } } });
    apply();
  }
  function vectorize() {
    const doc = IMG.app.doc, UI = IMG.UI; if (!doc) return;
    let colors = 6, detail = 2, minArea = 12, group = true, hideSrc = true;
    UI.dialog({ title: 'Vetorizar bitmap', width: 380, body: [UI.row('Cores', UI.num({ value: colors, min: 2, max: 32, width: 70, onInput: (v) => { colors = v; } }).el), UI.row('Suavidade', UI.num({ value: detail, min: 0.5, max: 8, decimals: 1, width: 70, onInput: (v) => { detail = v; } }).el), UI.row('Área mínima', UI.num({ value: minArea, min: 0, max: 5000, unit: 'px', width: 90, onInput: (v) => { minArea = v; } }).el), UI.row('', UI.check('Agrupar as formas', true, (v) => { group = v; }).el), UI.row('', UI.check('Ocultar a imagem original', true, (v) => { hideSrc = v; }).el), el('p.dialog-note', { text: 'Converte a imagem visível em camadas de forma, uma por cor.' })],
      buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
        const hide = UI.busy('Vetorizando…');
        setTimeout(() => {
          try {
            const flat = IMG.Engine.flatten(doc), s = Math.min(1, 700 / Math.max(doc.width, doc.height));
            const W = Math.max(2, Math.round(doc.width * s)), H = Math.max(2, Math.round(doc.height * s));
            const small = IMG.scaleCanvas(flat, W, H), data = small.getContext('2d').getImageData(0, 0, W, H).data;
            // suaviza levemente antes de quantizar
            const q = F.quantize(data, colors, { width: W });
            const counts = new Array(q.palette.length).fill(0); for (let i = 0; i < W * H; i++) counts[q.index[i]]++;
            const order = q.palette.map((_, i) => i).filter((i) => i !== q.transparent && counts[i] > minArea * s * s).sort((a, b) => counts[b] - counts[a]);
            const made = [];
            for (const ci of order) {
              const m = U.createCanvas(W, H), mx = m.getContext('2d'), img = mx.createImageData(W, H), md = img.data;
              let any = false;
              for (let i = 0; i < W * H; i++) if (q.index[i] === ci) { md[i * 4] = md[i * 4 + 1] = md[i * 4 + 2] = md[i * 4 + 3] = 255; any = true; }
              if (!any) continue;
              mx.putImageData(img, 0, 0);
              const fake = { selection: { canvas: m, bounds: { x: 0, y: 0, w: W, h: H } }, rect: { x: 0, y: 0, w: W, h: H } };
              const path = IMG.Paths.fromSelection(fake, detail);
              if (!path || !path.subs.length) continue;
              path.subs = path.subs.filter((sub) => { const b = IMG.Paths.bounds({ subs: [sub] }); return b && b.w * b.h >= minArea * s * s; });
              if (!path.subs.length) continue;
              IMG.Paths.matrix(path, new DOMMatrix().scale(1 / s, 1 / s));
              const p = q.palette[ci], hex = U.rgbToHex(p[0], p[1], p[2]);
              const L = IMG.Shapes.create(doc, { path, fill: { type: 'solid', color: hex }, stroke: { on: false, fill: { type: 'solid', color: '#000000' }, width: 1, align: 'center', cap: 'butt', join: 'miter', dash: null } }, 'Cor ' + hex.toUpperCase());
              made.push(L);
            }
            if (hideSrc) doc.layers.forEach((L) => { if (!made.includes(L)) L.visible = false; });
            if (group && made.length) { doc.selected = new Set(made.map((L) => L.id)); const G = Layers.group(doc); if (G) G.name = 'Vetorizado'; }
            bus.emit('layers:change', doc); IMG.Engine.invalidate(); IMG.commit('Vetorizar bitmap');
            UI.toast(made.length + ' formas criadas.');
          } catch (err) { UI.fail(err); } finally { hide(); }
        }, 30);
      } }] });
  }

  /* ---------- variáveis (gráficos orientados por dados) ---------- */
  function parseCSV(txt) {
    const rows = []; let row = [], cur = '', q = false;
    const sep = (txt.split('\n')[0].match(/;/g) || []).length > (txt.split('\n')[0].match(/,/g) || []).length ? ';' : txt.includes('\t') ? '\t' : ',';
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      if (q) { if (c === '"' && txt[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; continue; }
      if (c === '"') q = true; else if (c === sep) { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((v) => v !== '')) rows.push(row); row = []; } else cur += c;
    }
    row.push(cur); if (row.some((v) => v !== '')) rows.push(row);
    return rows;
  }
  function applyDataSet(doc, set) {
    const V = doc.variables; if (!V || !set) return;
    Layers.walk(doc.layers, (L) => {
      const d = V.defs[L.id]; if (!d) return;
      if (d.text && L.type === 'text' && set.values[d.text] != null) { const t = L.text, s = (t.runs[0] && t.runs[0].s) || IMG.Text.DEF_STYLE, str = String(set.values[d.text]); L.text = IMG.Text.normalize(Object.assign({}, t, { text: str, runs: [{ n: str.length, s: Object.assign({}, s) }], paras: str.split('\n').map(() => Object.assign({}, (t.paras && t.paras[0]) || IMG.Text.DEF_PARA)), auto: false }), L); IMG.Text.render(L); }
      if (d.visible && set.values[d.visible] != null) { const v = String(set.values[d.visible]).trim().toLowerCase(); L.visible = !['false', '0', 'não', 'nao', 'no', 'oculto', 'invisível', 'invisivel', ''].includes(v); }
    });
    bus.emit('layers:change', doc); IMG.Engine.invalidate();
  }
  function variables() {
    const doc = IMG.app.doc, UI = IMG.UI; if (!doc) return;
    const V = doc.variables = doc.variables || { defs: {}, sets: [], cur: 0 };
    const body = el('div.var-body');
    let tab = 'defs';
    const render = () => {
      U.clear(body);
      const tabs = el('div.tbtns', ...[['defs', 'Definir'], ['sets', 'Conjuntos de dados']].map(([k, l]) => { const b = el('button.tbtn' + (tab === k ? '.on' : ''), { type: 'button', text: l }); b.style.fontFamily = 'inherit'; b.addEventListener('click', () => { tab = k; render(); }); return b; }));
      body.appendChild(tabs);
      if (tab === 'defs') {
        const list = el('div.var-list');
        Layers.all(doc).slice().reverse().forEach((L) => {
          if (L.type === 'adjust') return;
          const d = V.defs[L.id] = V.defs[L.id] || { text: null, visible: null };
          const tIn = el('input.inp', { type: 'text', value: d.text || '', placeholder: 'variável de texto', disabled: L.type !== 'text' });
          const vIn = el('input.inp', { type: 'text', value: d.visible || '', placeholder: 'variável de visibilidade' });
          tIn.addEventListener('input', () => { d.text = tIn.value.trim() || null; }); vIn.addEventListener('input', () => { d.visible = vIn.value.trim() || null; });
          list.appendChild(el('div.var-row', el('span.pname', { text: L.name }), tIn, vIn));
        });
        body.appendChild(list);
      } else {
        const names = [...new Set(Object.values(V.defs).flatMap((d) => [d.text, d.visible]).filter(Boolean))];
        const info = el('p.dialog-note', { text: V.sets.length ? V.sets.length + ' conjunto(s) de dados. Variáveis: ' + names.join(', ') : 'Importe um arquivo CSV/TXT cuja primeira linha contém os nomes das variáveis.' });
        body.appendChild(info);
        const nav = el('div.props-actions',
          UI.btn('Importar CSV…', async () => {
            const [f] = await Files.pick('.csv,.txt,.tsv', false); if (!f) return;
            const rows = parseCSV(await f.text()); if (rows.length < 2) { UI.toast('O arquivo precisa de cabeçalho e ao menos uma linha.'); return; }
            const head = rows[0].map((h) => h.trim());
            V.sets = rows.slice(1).map((r, i) => ({ name: 'Conjunto ' + (i + 1), values: Object.fromEntries(head.map((h, k) => [h, r[k] != null ? r[k] : ''])) }));
            V.cur = 0; render();
          }, { small: true }),
          UI.btn('◀', () => { if (!V.sets.length) return; V.cur = (V.cur - 1 + V.sets.length) % V.sets.length; applyDataSet(doc, V.sets[V.cur]); render(); }, { small: true }),
          el('span', { text: V.sets.length ? (V.cur + 1) + ' / ' + V.sets.length : '—' }),
          UI.btn('▶', () => { if (!V.sets.length) return; V.cur = (V.cur + 1) % V.sets.length; applyDataSet(doc, V.sets[V.cur]); render(); }, { small: true }),
          UI.btn('Aplicar', () => { if (V.sets[V.cur]) { applyDataSet(doc, V.sets[V.cur]); IMG.commit('Aplicar conjunto de dados'); } }, { small: true }),
          UI.btn('Exportar todos (PNG)…', async () => {
            if (!V.sets.length) return;
            const hide = UI.busy('Exportando conjuntos…'); const files = [];
            const idx = doc.history.index;
            try { for (let i = 0; i < V.sets.length; i++) { applyDataSet(doc, V.sets[i]); files.push({ name: U.safeFile(doc.name) + '_' + String(i + 1).padStart(3, '0') + '.png', data: await U.toBlob(IMG.Engine.flatten(doc), 'image/png') }); } }
            finally { hide(); doc.history.goto(idx); }
            U.download(await F.zip(files), U.safeFile(doc.name) + '_dados.zip');
          }, { small: true }));
        body.appendChild(nav);
        const cur = V.sets[V.cur];
        if (cur) body.appendChild(el('pre.css-code', { text: Object.entries(cur.values).map(([k, v]) => k + ' = ' + v).join('\n') }));
      }
    };
    render();
    UI.dialog({ title: 'Variáveis', width: 620, body: [body], buttons: [{ label: 'OK', primary: true }] });
  }

  /* ---------- Aparar (Imagem › Aparar…) ---------- */
  function trimDialog() {
    const doc = IMG.app.doc, UI = IMG.UI; if (!doc) return;
    const o = Object.assign({ base: 'transparent', top: true, bottom: true, left: true, right: true }, U.store.get('trim', {}));
    const flat = IMG.Engine.flatten(doc), d = flat.getContext('2d').getImageData(0, 0, doc.width, doc.height).data;
    let hasAlpha = false; for (let i = 3; i < d.length; i += 4) if (d[i] < 255) { hasAlpha = true; break; }
    if (!hasAlpha && o.base === 'transparent') o.base = 'topleft';
    const radio = (v, label, dis) => { const r = el('input', { type: 'radio', name: 'trimbase', value: v }); r.checked = o.base === v; r.disabled = !!dis; r.addEventListener('change', () => { o.base = v; }); return el('label.radio', r, el('span', { text: label })); };
    const chk = (k, label) => UI.check(label, o[k], (v) => { o[k] = v; }).el;
    UI.dialog({ title: 'Aparar', width: 380, body: [
      el('h3.form-title', { text: 'Com base em' }),
      el('div.radio-list', radio('transparent', 'Pixels transparentes', !hasAlpha), radio('topleft', 'Cor do pixel superior esquerdo'), radio('bottomright', 'Cor do pixel inferior direito')),
      el('h3.form-title', { text: 'Aparar' }),
      el('div.form-row.solo', chk('top', 'Superior'), chk('bottom', 'Inferior'), chk('left', 'Esquerda'), chk('right', 'Direita'))
    ], buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
      U.store.set('trim', o);
      const W = doc.width, H = doc.height;
      const ref = o.base === 'topleft' ? 0 : (W * H - 1) * 4;
      const same = o.base === 'transparent' ? (i) => d[i + 3] === 0 : (i) => Math.abs(d[i] - d[ref]) <= 1 && Math.abs(d[i + 1] - d[ref + 1]) <= 1 && Math.abs(d[i + 2] - d[ref + 2]) <= 1 && Math.abs(d[i + 3] - d[ref + 3]) <= 1;
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!same((y * W + x) * 4)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) { UI.toast('A imagem inteira seria aparada.'); return; }
      const r = { x: o.left ? x0 : 0, y: o.top ? y0 : 0 }; r.w = (o.right ? x1 + 1 : W) - r.x; r.h = (o.bottom ? y1 + 1 : H) - r.y;
      if (r.x === 0 && r.y === 0 && r.w === W && r.h === H) { UI.toast('Não há nada para aparar.'); return; }
      IMG.ImageOps.crop(doc, r, { label: 'Aparar' });
      IMG.Engine.fit();
    } }] });
  }

  /* ---------- Tamanho da imagem ---------- */
  function imageSize() {
    const doc = IMG.app.doc, UI = IMG.UI; if (!doc) return;
    let w = doc.width, h = doc.height, dpi = doc.dpi || 72, lock = true, resample = true, method = 'bicubic', unit = 'px';
    const ratio = w / h;
    const toU = (px, d = dpi) => (unit === 'px' ? px : unit === '%' ? (px / (unit === '%' ? 1 : 1)) : unit === 'in' ? px / d : unit === 'cm' ? (px / d) * 2.54 : (px / d) * 25.4);
    const fromU = (v, base, d = dpi) => (unit === 'px' ? v : unit === '%' ? (base * v) / 100 : unit === 'in' ? v * d : unit === 'cm' ? (v / 2.54) * d : (v / 25.4) * d);
    const note = el('p.dialog-note');
    const fmt = () => { note.textContent = 'Atual: ' + doc.width + ' × ' + doc.height + ' px  →  Novo: ' + Math.round(w) + ' × ' + Math.round(h) + ' px (' + U.round((w * h) / 1e6, 2).toString().replace('.', ',') + ' MP) · ' + U.round((w / dpi) * 2.54, 2).toString().replace('.', ',') + ' × ' + U.round((h / dpi) * 2.54, 2).toString().replace('.', ',') + ' cm'; };
    const dec = () => (unit === 'px' ? 0 : 2);
    const nw = UI.num({ value: w, min: 0.01, max: 300000, decimals: 0, width: 100, onInput: (v) => { w = fromU(v, doc.width); if (lock) { h = w / ratio; nh.set(U.round(unit === '%' ? (h / doc.height) * 100 : toU(h), dec())); } if (!resample) { dpi = (doc.width / w) * dpi; nd.set(U.round(dpi, 2)); w = doc.width; h = doc.height; } fmt(); } });
    const nh = UI.num({ value: h, min: 0.01, max: 300000, decimals: 0, width: 100, onInput: (v) => { h = fromU(v, doc.height); if (lock) { w = h * ratio; nw.set(U.round(unit === '%' ? (w / doc.width) * 100 : toU(w), dec())); } fmt(); } });
    const nd = UI.num({ value: dpi, min: 1, max: 10000, decimals: 2, unit: 'ppp', width: 100, onInput: (v) => { const old = dpi; dpi = v; if (resample && unit !== 'px' && unit !== '%') { w = (w / old) * v; h = (h / old) * v; } fmt(); } });
    const unitSel = UI.select([['px', 'Pixels'], ['%', 'Porcentagem'], ['cm', 'Centímetros'], ['mm', 'Milímetros'], ['in', 'Polegadas']], unit, (v) => { unit = v; nw.set(U.round(unit === '%' ? (w / doc.width) * 100 : toU(w), dec())); nh.set(U.round(unit === '%' ? (h / doc.height) * 100 : toU(h), dec())); }, { width: 140, keepFocus: true });
    const methSel = UI.select([['bicubic', 'Automático (bicúbico)'], ['smoother', 'Bicúbico mais suave (ampliação)'], ['sharper', 'Bicúbico mais nítido (redução)'], ['bilinear', 'Bilinear'], ['nearest', 'Vizinho mais próximo (bordas duras)']], method, (v) => { method = v; }, { width: 240, keepFocus: true });
    fmt();
    UI.dialog({ title: 'Tamanho da imagem', width: 440, body: [UI.row('Largura', nw.el), UI.row('Altura', nh.el), UI.row('Unidade', unitSel.el), UI.row('Resolução', nd.el), UI.row('', UI.check('Restringir proporções', true, (v) => { lock = v; }).el), UI.row('', UI.check('Reamostrar', true, (v) => { resample = v; methSel.el.style.opacity = v ? '' : '0.4'; }).el), UI.row('Método', methSel.el), note],
      buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
        doc.dpi = Math.round(dpi * 100) / 100;
        if (!resample) { IMG.commit('Resolução'); bus.emit('doc:change', doc); return; }
        IMG.resampleMethod = method;
        try { IMG.ImageOps.resize(doc, Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); } finally { IMG.resampleMethod = null; }
      } }] });
  }

  /* ==================================================================
     COMANDOS
     ================================================================== */
  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, H) => {
    const has = H.has;
    C('file.open', 'Abrir…', () => Files.openDialog(), { keys: ['ctrl+o'] });
    C('file.saveAsPsd', 'Salvar como PSD…', () => Files.savePSD(H.doc(), false), { enabled: has, keys: ['ctrl+shift+s'] });
    C('file.exportAs', 'Exportar como…', () => exportAs(), { enabled: has, keys: ['ctrl+alt+shift+w'] });
    ['png', 'jpg', 'webp', 'gif', 'svg', 'pdf', 'bmp', 'tiff', 'ico', 'tga', 'psd'].forEach((k) => C('file.export' + k[0].toUpperCase() + k.slice(1), FORMATS[k].label, () => exportAs(k), { enabled: has }));
    C('file.exportLayers', 'Exportar camadas…', exportLayers, { enabled: has });
    C('file.print', 'Imprimir…', () => print().catch((e) => IMG.UI.fail(e)), { enabled: has, keys: ['ctrl+p'] });
    C('file.info', 'Informações do arquivo…', fileInfo, { enabled: has, keys: ['ctrl+alt+shift+i'] });
    C('file.batch', 'Lote…', batch);
    C('file.contactSheet', 'Folha de contatos…', () => contactSheet().catch((e) => IMG.UI.fail(e)));
    C('file.script', 'Script…', scriptDialog);
    const modeCmd = (id, label, mode) => C(id, label, () => setMode(mode).catch((e) => IMG.UI.fail(e)), { enabled: has, checked: () => !!(H.has() && (H.doc().mode || 'rgb') === mode) });
    modeCmd('image.modeBitmap', 'Bitmap…', 'bitmap'); modeCmd('image.modeGray', 'Tons de cinza', 'gray'); modeCmd('image.modeIndexed', 'Cores indexadas…', 'indexed');
    modeCmd('image.modeRgb', 'Cores RGB', 'rgb'); modeCmd('image.modeCmyk', 'Cores CMYK', 'cmyk'); modeCmd('image.modeLab', 'Cores Lab', 'lab');
    [8, 16, 32].forEach((b) => C('image.bits' + b, b + ' bits/canal', () => { const d = H.doc(); d.bits = b; IMG.commit(b + ' bits/canal'); bus.emit('doc:change', d); }, { enabled: has, checked: () => !!(H.has() && (H.doc().bits || 8) === b) }));
    C('image.duplicate', 'Duplicar…', duplicate, { enabled: has });
    C('image.trim', 'Aparar…', trimDialog, { enabled: has });
    C('image.revealAll', 'Revelar tudo', revealAll, { enabled: has });
    C('image.applyImage', 'Aplicar imagem…', applyImage, { enabled: H.hasLayer });
    C('image.vectorize', 'Vetorizar bitmap…', vectorize, { enabled: has });
    C('image.variables', 'Variáveis…', variables, { enabled: has });
    C('image.resize', 'Tamanho da imagem…', imageSize, { enabled: has, keys: ['ctrl+alt+i'] });
  });
  IMG.applyDataSet = applyDataSet;
})();
