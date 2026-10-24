/* ==========================================================================
   Imaginarium — arquivos
   - Novo projeto, abrir imagens (PNG, JPG, WEBP, SVG, GIF, BMP)
   - Projeto .edt: contêiner binário próprio (cabeçalho JSON + bitmaps PNG)
   - Exportar PNG / JPG / WEBP / PDF (gerador de PDF próprio, sem bibliotecas)
   - Preferências
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const Layers = IMG.Layers;

  const MAGIC = 'IMGEDT01';
  const IMAGE_EXT = /\.(png|jpe?g|webp|svg|gif|bmp|avif)$/i;
  const MAX_PIXELS = 120e6;

  const PRESETS = [
    ['custom', 'Personalizado'], null,
    ['1920x1080', 'Full HD — 1920 × 1080'], ['1280x720', 'HD — 1280 × 720'], ['3840x2160', '4K UHD — 3840 × 2160'], null,
    ['1080x1080', 'Post quadrado — 1080 × 1080'], ['1080x1350', 'Post retrato — 1080 × 1350'], ['1080x1920', 'Story — 1080 × 1920'], ['1280x720y', 'Miniatura de vídeo — 1280 × 720'], ['1500x500', 'Capa — 1500 × 500'], null,
    ['2480x3508', 'A4 retrato 300 dpi — 2480 × 3508'], ['3508x2480', 'A4 paisagem 300 dpi — 3508 × 2480'], ['1748x2480', 'A5 retrato 300 dpi — 1748 × 2480'], null,
    ['512x512', 'Ícone — 512 × 512'], ['1024x1024', 'Quadrado — 1024 × 1024']
  ];

  /* ------------------------------------------------------------------
     Gerador de PDF mínimo (uma página com a imagem em JPEG / DCTDecode)
     ------------------------------------------------------------------ */
  function buildPDF(jpeg, imgW, imgH, pageW, pageH, title) {
    const enc = new TextEncoder();
    const chunks = [], offsets = [];
    let pos = 0;
    const push = (d) => { const b = typeof d === 'string' ? enc.encode(d) : d; chunks.push(b); pos += b.length; };
    const obj = (n, body) => { offsets[n] = pos; push(n + ' 0 obj\n'); body(); push('\nendobj\n'); };
    const hexStr = (s) => { let h = 'FEFF'; for (let i = 0; i < s.length; i++) h += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase(); return '<' + h + '>'; };
    const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
    const date = 'D:' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
    const f = (n) => U.round(n, 3);
    push('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
    obj(3, () => push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f(pageW) + ' ' + f(pageH) + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'));
    obj(4, () => { push('<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n'); push(jpeg); push('\nendstream'); });
    const content = 'q ' + f(pageW) + ' 0 0 ' + f(pageH) + ' 0 0 cm /Im0 Do Q';
    obj(5, () => push('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'));
    obj(6, () => push('<< /Title ' + hexStr(title || 'Imaginarium') + ' /Producer ' + hexStr('Imaginarium ' + IMG.VERSION) + ' /Creator ' + hexStr('Imaginarium') + ' /CreationDate (' + date + ') >>'));
    const xref = pos;
    let x = 'xref\n0 7\n0000000000 65535 f \n';
    for (let i = 1; i <= 6; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    push(x + 'trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(chunks, { type: 'application/pdf' });
  }

  const Files = (IMG.Files = {
    buildPDF,

    /* ==================================================================
       Novo projeto
       ================================================================== */
    create(o = {}) {
      const doc = new IMG.Doc({ name: o.name || 'Sem título', width: o.width, height: o.height });
      const bg = o.background;
      if (bg && bg !== 'transparent') {
        const L = new IMG.Layer('raster', { name: 'Fundo', width: doc.width, height: doc.height });
        const c = L.ctx; c.fillStyle = bg; c.fillRect(0, 0, doc.width, doc.height); L._blank = false;
        L.isBg = true; L.lockPos = true; L.lockAlpha = true;
        doc.layers.push(L); doc.activeId = L.id; doc.selected = new Set([L.id]);
      } else {
        const L = new IMG.Layer('raster', { name: 'Camada 1', width: doc.width, height: doc.height });
        doc.counter = 1;
        doc.layers.push(L); doc.activeId = L.id; doc.selected = new Set([L.id]);
      }
      doc.history.reset('Abrir');
      IMG.app.addDoc(doc);
      return doc;
    },

    newDialog() {
      const UI = IMG.UI, app = IMG.app;
      const last = U.store.get('newDoc', { width: 1920, height: 1080, background: 'white' });
      let w = last.width, h = last.height, bg = last.background || 'white';
      const n = app.docs.length + 1;
      const name = el('input.inp', { type: 'text', value: 'Sem título ' + n, maxlength: 80 });
      const nw = UI.num({ value: w, min: 1, max: 20000, unit: 'px', width: 110, onInput: (v) => { w = v; preset.set('custom'); info(); } });
      const nh = UI.num({ value: h, min: 1, max: 20000, unit: 'px', width: 110, onInput: (v) => { h = v; preset.set('custom'); info(); } });
      const preset = UI.select(PRESETS, 'custom', (v) => { const m = /^(\d+)x(\d+)/.exec(v); if (m) { w = +m[1]; h = +m[2]; nw.set(w); nh.set(h); info(); } }, { keepFocus: true });
      const swap = UI.iconBtn('swap', 'Trocar largura e altura', () => { const t = w; w = h; h = t; nw.set(w); nh.set(h); preset.set('custom'); info(); });
      const bgSel = UI.select([['white', 'Branco'], ['black', 'Preto'], ['bg', 'Cor de fundo atual'], ['transparent', 'Transparente']], bg, (v) => { bg = v; }, { keepFocus: true });
      const note = el('p.dialog-note');
      const info = () => { const mp = (w * h) / 1e6; note.textContent = U.round(mp, 2).toString().replace('.', ',') + ' megapixels' + (mp > 60 ? ' — imagens muito grandes exigem bastante memória.' : ''); };
      info();
      UI.dialog({
        title: 'Novo projeto', width: 400, focus: 'input.inp',
        body: [UI.row('Nome', name), UI.row('Predefinição', preset.el), UI.row('Largura', nw.el, swap), UI.row('Altura', nh.el), UI.row('Fundo', bgSel.el), note],
        buttons: [{ label: 'Cancelar' }, {
          label: 'Criar projeto', primary: true, onClick: () => {
            if (w * h > MAX_PIXELS) { UI.toast('Tamanho grande demais. Reduza a largura ou a altura.', 'error'); return false; }
            U.store.set('newDoc', { width: w, height: h, background: bg });
            const color = bg === 'white' ? '#ffffff' : bg === 'black' ? '#000000' : bg === 'bg' ? app.bg : 'transparent';
            this.create({ name: name.value.trim() || 'Sem título', width: w, height: h, background: color });
          }
        }]
      });
    },

    /** Cria um documento a partir de um canvas (colar sem documento aberto, etc.). */
    fromCanvas(canvas, name) {
      const doc = new IMG.Doc({ name: name || 'Sem título', width: canvas.width, height: canvas.height });
      const L = new IMG.Layer('raster', { name: 'Fundo', canvas: U.cloneCanvas(canvas) });
      doc.layers.push(L); doc.activeId = L.id; doc.selected = new Set([L.id]);
      doc.history.reset('Abrir');
      IMG.app.addDoc(doc);
      return doc;
    },

    /* ==================================================================
       Abrir
       ================================================================== */
    pick(accept, multiple) {
      return new Promise((res) => {
        const inp = U.$('#file-input');
        inp.value = '';
        inp.accept = accept; inp.multiple = !!multiple;
        const done = () => { inp.removeEventListener('change', done); res(Array.from(inp.files || [])); };
        inp.addEventListener('change', done);
        inp.click();
      });
    },

    async openDialog() { await this.openFiles(await this.pick('.png,.jpg,.jpeg,.webp,.svg,.gif,.bmp,.avif,.edt,image/*', true)); },
    async openProjectDialog() { await this.openFiles(await this.pick('.edt', true)); },
    async placeDialog() {
      const doc = IMG.app.doc;
      const files = await this.pick('.png,.jpg,.jpeg,.webp,.svg,.gif,.bmp,.avif,image/*', true);
      if (!doc) return this.openFiles(files);
      for (const f of files) await this.placeFile(doc, f);
    },

    /** true se o canvas não tem pixels transparentes. */
    isOpaque(c) {
      try {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return false;
        return true;
      } catch (e) { return false; }
    },

    async decode(file) {
      const url = URL.createObjectURL(file);
      try {
        const im = await U.loadImage(url);
        let w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
        if (!w || !h) { w = 1024; h = 1024; }
        if (w * h > MAX_PIXELS) throw new Error('A imagem "' + file.name + '" é grande demais (' + w + ' × ' + h + ').');
        const c = U.createCanvas(w, h);
        c.getContext('2d').drawImage(im, 0, 0, w, h);
        return c;
      } finally { setTimeout(() => URL.revokeObjectURL(url), 500); }
    },

    async openFiles(files) {
      if (!files || !files.length) return;
      const hide = IMG.UI.busy('Abrindo…');
      try {
        for (const f of files) {
          try {
            if (/\.edt$/i.test(f.name)) await this.openProject(f);
            else if (IMAGE_EXT.test(f.name) || /^image\//.test(f.type)) {
              const c = await this.decode(f);
              const doc = new IMG.Doc({ name: U.baseName(f.name), width: c.width, height: c.height });
              const opaque = this.isOpaque(c);
              const L = new IMG.Layer('raster', { name: opaque ? 'Fundo' : 'Camada 0', canvas: c });
              if (opaque) { L.isBg = true; L.lockPos = true; L.lockAlpha = true; }
              doc.layers.push(L); doc.activeId = L.id; doc.selected = new Set([L.id]);
              doc.history.reset('Abrir');
              IMG.app.addDoc(doc);
            } else IMG.UI.toast('Formato não reconhecido: ' + f.name, 'error');
          } catch (err) { console.error(err); IMG.UI.toast('Não foi possível abrir "' + f.name + '": ' + err.message, 'error'); }
        }
      } finally { hide(); }
    },

    /** Insere um arquivo de imagem como nova camada (reduzindo, se for maior que a tela). */
    async placeFile(doc, file) {
      try {
        let c = await this.decode(file);
        const k = Math.min(1, doc.width / c.width, doc.height / c.height);
        if (k < 1) { const s = U.createCanvas(c.width * k, c.height * k), x = s.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, s.width, s.height); c = s; }
        const L = Layers.fromCanvas(doc, c, U.baseName(file.name).slice(0, 40), Math.round((doc.width - c.width) / 2), Math.round((doc.height - c.height) / 2));
        bus.emit('layers:change', doc);
        IMG.commit('Inserir imagem');
        return L;
      } catch (err) { IMG.UI.toast('Não foi possível inserir "' + file.name + '": ' + err.message, 'error'); return null; }
    },

    /* ==================================================================
       Projeto .edt
       ================================================================== */
    async serialize(doc) {
      const blobs = [];
      const addBitmap = async (canvas) => { const b = await U.toBlob(canvas, 'image/png'); blobs.push(b); return blobs.length - 1; };
      const node = async (L) => {
        const n = { id: L.id };
        for (const k of IMG.LAYER_PROPS) n[k] = L[k];
        for (const k of IMG.LAYER_JPROPS) n[k] = L[k] || null;
        if (L.smart) {
          n.smart = Object.assign({}, L.smart, { src: null, docData: null, fmask: null, _tok: undefined });
          if (L.smart.src) { n.smart.srcBitmap = await addBitmap(L.smart.src); n.smart.srcW = L.smart.src.width; n.smart.srcH = L.smart.src.height; }
          if (L.smart.docData && L.smart.docData.size) { blobs.push(L.smart.docData); n.smart.docBlob = blobs.length - 1; }
          if (L.smart.fmask && L.smart.fmask.canvas) n.smart.fmask = { x: L.smart.fmask.x, y: L.smart.fmask.y, bg: L.smart.fmask.bg, enabled: L.smart.fmask.enabled, bitmap: await addBitmap(L.smart.fmask.canvas) };
        }
        if (L.type === 'group') { n.children = []; for (const c of L.children) n.children.push(await node(c)); }
        else if (L.canvas) { n.w = L.canvas.width; n.h = L.canvas.height; n.bitmap = L._blank ? -1 : await addBitmap(L.canvas); }
        if (L.mask) n.mask = { x: L.mask.x, y: L.mask.y, enabled: L.mask.enabled, linked: L.mask.linked, bg: L.mask.bg, density: L.mask.density, feather: L.mask.feather, bitmap: await addBitmap(L.mask.canvas) };
        return n;
      };
      const layers = [];
      for (const L of doc.layers) layers.push(await node(L));
      let off = 0;
      const header = {
        app: 'Imaginarium', format: 'edt', version: 1, saved: new Date().toISOString(),
        doc: { name: doc.name, width: doc.width, height: doc.height, guides: doc.guides, activeId: doc.activeId, counter: doc.counter, globalAngle: doc.globalAngle, globalAltitude: doc.globalAltitude, paths: doc.paths, dpi: doc.dpi, slices: doc.slices || [], comps: doc.comps || [], samplers: doc.samplers || [], mode: doc.mode, bits: doc.bits,
          channels: await Promise.all((doc.channels || []).map(async (c) => ({ id: c.id, name: c.name, color: c.color, opacity: c.opacity, inverted: c.inverted, bitmap: await addBitmap(c.canvas) }))) },
        layers,
        blobs: blobs.map((b) => { const e = { off, len: b.size }; off += b.size; return e; })
      };
      const json = new TextEncoder().encode(JSON.stringify(header));
      const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, json.length, true);
      return new Blob([new TextEncoder().encode(MAGIC), len, json, ...blobs], { type: 'application/x-imaginarium-edt' });
    },

    async openProject(file) {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      if (new TextDecoder().decode(bytes.subarray(0, 8)) !== MAGIC) throw new Error('o arquivo não é um projeto do Imaginarium (.edt).');
      const hlen = new DataView(buf).getUint32(8, true);
      const header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + hlen)));
      const base = 12 + hlen;
      const bitmap = async (i, w, h) => {
        const e = header.blobs[i];
        const blob = new Blob([bytes.subarray(base + e.off, base + e.off + e.len)], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        try {
          const im = await U.loadImage(url);
          const c = U.createCanvas(w || im.naturalWidth, h || im.naturalHeight);
          c.getContext('2d').drawImage(im, 0, 0);
          return c;
        } finally { URL.revokeObjectURL(url); }
      };
      const d = header.doc;
      const doc = new IMG.Doc({ name: U.baseName(file.name) || d.name, width: d.width, height: d.height });
      doc.guides = { h: (d.guides && d.guides.h) || [], v: (d.guides && d.guides.v) || [] };
      doc.counter = d.counter || 0;
      if (d.globalAngle != null) { doc.globalAngle = d.globalAngle; doc.globalAltitude = d.globalAltitude; }
      if (d.paths) doc.paths = d.paths;
      if (d.slices) doc.slices = d.slices;
      if (d.comps) doc.comps = d.comps;
      if (d.samplers) doc.samplers = d.samplers;
      if (d.bits) doc.bits = d.bits;
      if (d.dpi) doc.dpi = d.dpi;
      if (d.channels) for (const c of d.channels) doc.channels.push({ id: c.id, name: c.name, color: c.color, opacity: c.opacity, inverted: c.inverted, canvas: await bitmap(c.bitmap, d.width, d.height), _snap: null, _dirty: null, _dirtyAll: true, _blank: false });
      const build = async (n, parent) => {
        const isGroup = n.type === 'group';
        let canvas;
        if (!isGroup && n.type !== 'adjust' && n.bitmap != null) canvas = n.bitmap >= 0 ? await bitmap(n.bitmap, n.w, n.h) : U.createCanvas(n.w || 1, n.h || 1);
        const L = new IMG.Layer(n.type, { id: n.id, name: n.name, canvas, x: n.x, y: n.y });
        if (!isGroup && n.bitmap < 0) L._blank = true;
        for (const k of IMG.LAYER_PROPS) if (n[k] !== undefined && k !== 'type') L[k] = n[k];
        for (const k of IMG.LAYER_JPROPS) L[k] = n[k] || null;
        L.visible = n.visible !== false; L.opacity = n.opacity == null ? 1 : n.opacity; L.fill = n.fill == null ? 1 : n.fill;
        L.blend = IMG.BLEND[n.blend] ? n.blend : (isGroup ? 'pass' : 'normal');
        L.expanded = n.expanded !== false;
        if (n.text) L.text = JSON.parse(JSON.stringify(n.text));
        if (n.smart) {
          L.smart = Object.assign({}, n.smart);
          if (n.smart.srcBitmap != null) L.smart.src = await bitmap(n.smart.srcBitmap, n.smart.srcW, n.smart.srcH);
          if (n.smart.docBlob != null) { const e = header.blobs[n.smart.docBlob]; L.smart.docData = new Blob([bytes.subarray(base + e.off, base + e.off + e.len)], { type: 'application/x-imaginarium-edt' }); }
          if (n.smart.fmask && n.smart.fmask.bitmap != null) L.smart.fmask = { x: n.smart.fmask.x, y: n.smart.fmask.y, bg: n.smart.fmask.bg, enabled: n.smart.fmask.enabled !== false, canvas: await bitmap(n.smart.fmask.bitmap) };
          delete L.smart.srcBitmap; delete L.smart.docBlob;
          if (!L.smart.quad && L.canvas) L.smart.quad = [{ x: L.x, y: L.y }, { x: L.x + L.canvas.width, y: L.y }, { x: L.x + L.canvas.width, y: L.y + L.canvas.height }, { x: L.x, y: L.y + L.canvas.height }];
        }
        L.parent = parent;
        if (isGroup) for (const c of n.children || []) L.children.push(await build(c, L));
        if (n.mask) L.mask = Layers.makeMask(await bitmap(n.mask.bitmap), n.mask.x, n.mask.y, n.mask.bg, { enabled: n.mask.enabled !== false, linked: n.mask.linked !== false, density: n.mask.density, feather: n.mask.feather });
        return L;
      };
      for (const n of header.layers) doc.layers.push(await build(n, null));
      const all = Layers.all(doc);
      doc.activeId = all.some((l) => l.id === d.activeId) ? d.activeId : (all.length ? all[all.length - 1].id : null);
      doc.selected = new Set(doc.activeId ? [doc.activeId] : []);
      doc.history.reset('Abrir');
      doc.isProject = true;
      IMG.app.addDoc(doc);
      return doc;
    },

    canPickSave() { return typeof window.showSaveFilePicker === 'function'; },

    /** Salvar (reutiliza o arquivo já escolhido) ou Salvar como. */
    async save(doc, saveAs) {
      doc = doc || IMG.app.doc;
      if (!doc) return false;
      const UI = IMG.UI;
      const state = doc.history.current;
      let handle = saveAs ? null : doc.fileHandle;
      const suggested = U.safeFile(doc.name) + '.edt';
      if (!handle && this.canPickSave()) {
        try {
          handle = await window.showSaveFilePicker({ suggestedName: suggested, types: [{ description: 'Projeto do Imaginarium', accept: { 'application/x-imaginarium-edt': ['.edt'] } }] });
        } catch (err) { if (err && err.name === 'AbortError') return false; handle = null; }
      }
      let name = suggested;
      if (!handle && (saveAs || !doc.isProject)) {
        const n = await UI.prompt(saveAs ? 'Salvar como' : 'Salvar projeto', 'Nome do arquivo', U.safeFile(doc.name));
        if (!n) return false;
        name = U.safeFile(n.replace(/\.edt$/i, '')) + '.edt';
        doc.name = U.baseName(name);
      }
      const hide = UI.busy('Salvando projeto…');
      try {
        const blob = await this.serialize(doc);
        if (handle) {
          const w = await handle.createWritable();
          await w.write(blob); await w.close();
          doc.fileHandle = handle; doc.name = U.baseName(handle.name);
        } else U.download(blob, name);
        doc.savedState = state; doc.isProject = true;
        bus.emit('doc:rename', doc);
        UI.toast('Projeto salvo: ' + (handle ? handle.name : name) + ' (' + U.fmtBytes(blob.size) + ')');
        return true;
      } finally { hide(); }
    },

    /* ==================================================================
       Exportar
       ================================================================== */
    exportDialog(format) {
      const doc = IMG.app.doc, UI = IMG.UI;
      if (!doc) return;
      const F = { png: { label: 'PNG', mime: 'image/png', ext: 'png' }, jpg: { label: 'JPG', mime: 'image/jpeg', ext: 'jpg' }, webp: { label: 'WEBP', mime: 'image/webp', ext: 'webp' }, pdf: { label: 'PDF', mime: 'application/pdf', ext: 'pdf' } }[format];
      const p = IMG.app.prefs;
      let quality = p.exportQuality || 92, scale = 100, matte = '#ffffff', dpi = 300, keepAlpha = true;
      const lossy = format !== 'png';
      const name = el('input.inp', { type: 'text', value: U.safeFile(doc.name), maxlength: 120 });
      const note = el('p.dialog-note', { text: 'Calculando tamanho…' });
      const outSize = () => ({ w: Math.max(1, Math.round((doc.width * scale) / 100)), h: Math.max(1, Math.round((doc.height * scale) / 100)) });

      const render = () => {
        const { w, h } = outSize();
        const opaque = format === 'jpg' || format === 'pdf' || !keepAlpha;
        const flat = IMG.Engine.flatten(doc, opaque ? matte : null);
        if (w === doc.width && h === doc.height) return flat;
        const c = U.createCanvas(w, h), x = c.getContext('2d');
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        x.drawImage(flat, 0, 0, w, h);
        return c;
      };
      const encode = async () => {
        const c = render();
        if (format === 'pdf') {
          const jb = await U.toBlob(c, 'image/jpeg', quality / 100);
          const jpeg = new Uint8Array(await jb.arrayBuffer());
          return buildPDF(jpeg, c.width, c.height, (c.width * 72) / dpi, (c.height * 72) / dpi, name.value.trim() || doc.name);
        }
        const blob = await U.toBlob(c, F.mime, lossy ? quality / 100 : undefined);
        if (format === 'webp' && blob.type !== 'image/webp') throw new Error('Este navegador não codifica WEBP. Use PNG ou JPG.');
        return blob;
      };
      let token = 0;
      const estimate = U.debounce(async () => {
        const my = ++token;
        try {
          const b = await encode();
          if (my !== token) return;
          const { w, h } = outSize();
          let t = w + ' × ' + h + ' px — aproximadamente ' + U.fmtBytes(b.size);
          if (format === 'pdf') t += ' — página de ' + U.round((w / dpi) * 2.54, 1).toString().replace('.', ',') + ' × ' + U.round((h / dpi) * 2.54, 1).toString().replace('.', ',') + ' cm';
          note.textContent = t;
        } catch (err) { if (my === token) note.textContent = err.message; }
      }, 260);

      const body = [UI.row('Nome do arquivo', name, el('span.ext-tag', { text: '.' + F.ext }))];
      body.push(UI.slider({ label: 'Escala', value: 100, min: 5, max: 400, step: 1, unit: '%', def: 100, onInput: (v) => { scale = v; estimate(); } }).el);
      if (lossy) body.push(UI.slider({ label: 'Qualidade', value: quality, min: 1, max: 100, step: 1, unit: '%', def: 92, onInput: (v) => { quality = v; estimate(); } }).el);
      if (format === 'pdf') body.push(UI.row('Resolução', UI.num({ value: dpi, min: 36, max: 1200, unit: 'dpi', width: 100, onInput: (v) => { dpi = v; estimate(); } }).el));
      if (format === 'jpg' || format === 'pdf') body.push(UI.row('Fundo', UI.colorBtn(matte, (hex) => { if (hex) { matte = hex; estimate(); } }, { title: 'Cor usada no lugar das áreas transparentes' }).el, el('span.form-hint', { text: 'substitui as áreas transparentes' })));
      else body.push(UI.row('', UI.check('Manter transparência', true, (v) => { keepAlpha = v; estimate(); }).el));
      body.push(note);
      estimate();

      UI.dialog({
        title: 'Exportar ' + F.label, width: 420, body, focus: 'input.inp',
        buttons: [{ label: 'Cancelar' }, {
          label: 'Exportar ' + F.label, primary: true, onClick: (d) => {
            const fname = U.safeFile(name.value.trim() || doc.name) + '.' + F.ext;
            const hide = UI.busy('Exportando…');
            if (lossy) { p.exportQuality = quality; IMG.app.savePrefs(); }
            encode().then((b) => { U.download(b, fname); UI.toast('Exportado: ' + fname + ' (' + U.fmtBytes(b.size) + ')'); d.close('ok'); })
              .catch((err) => UI.fail(err)).finally(hide);
            return false;
          }
        }],
        onClose: () => { token++; estimate.cancel(); }
      });
    },

    /* ==================================================================
       Fechar / sair
       ================================================================== */
    async closeDoc(doc) {
      doc = doc || IMG.app.doc;
      if (!doc) return true;
      if (doc.dirty) {
        const r = await IMG.UI.choice('"' + doc.name + '" tem alterações que ainda não foram salvas.', [
          { label: 'Cancelar', value: 'cancel' }, { label: 'Descartar', value: 'discard', danger: true }, { label: 'Salvar projeto', value: 'save', primary: true }
        ], 'Fechar documento');
        if (r === 'save') { if (!(await this.save(doc))) return false; }
        else if (r !== 'discard') return false;
      }
      IMG.app.removeDoc(doc);
      return true;
    },

    async closeAll() {
      for (const d of IMG.app.docs.slice()) { IMG.app.setDoc(d); if (!(await this.closeDoc(d))) return false; }
      return true;
    },

    async exit() {
      if (!(await this.closeAll())) return;
      window.close();
      setTimeout(() => IMG.UI.toast('Sessão encerrada. Você já pode fechar esta aba do navegador.'), 250);
    },

    /* ==================================================================
       Preferências
       ================================================================== */
    prefsDialog() {
      const UI = IMG.UI, app = IMG.app, p = app.prefs;
      const set = (k) => (v) => { p[k] = v; app.savePrefs(); };
      const sec = (t) => el('h3.form-title', { text: t });
      const body = [
        sec('Geral'),
        UI.row('Estados do histórico', UI.num({ value: p.historyMax, min: 100, max: 500, width: 90, onChange: set('historyMax') }).el, el('span.form-hint', { text: 'mínimo de 100' })),
        UI.row('', UI.check('Zoom e rolagem com animação suave', p.smoothZoom, set('smoothZoom')).el),
        UI.row('', UI.check('Roda do mouse aplica zoom (sem Ctrl)', p.wheelZoom, set('wheelZoom')).el),
        UI.row('Fundo da transparência', UI.select([['light', 'Xadrez claro'], ['mid', 'Xadrez médio'], ['dark', 'Xadrez escuro']], p.checker, set('checker'), { keepFocus: true }).el),
        sec('Grade e guias'),
        UI.row('Tamanho da grade', UI.num({ value: p.gridSize, min: 2, max: 2000, unit: 'px', width: 90, onChange: set('gridSize') }).el),
        UI.row('Subdivisões', UI.num({ value: p.gridSub, min: 1, max: 20, width: 90, onChange: set('gridSub') }).el),
        UI.row('Cor da grade', UI.colorBtn(p.gridColor, (hex) => { if (hex) set('gridColor')(hex); }).el),
        UI.row('Cor das guias', UI.colorBtn(p.guideColor, (hex) => { if (hex) set('guideColor')(hex); }).el),
        UI.row('', UI.check('Encaixar em guias, bordas e centro', p.snap, set('snap')).el),
        UI.row('', UI.check('Guias inteligentes (alinhar com outras camadas)', p.smartGuides, set('smartGuides')).el),
        UI.row('', UI.check('Encaixar na grade quando ela estiver visível', p.snapGrid, set('snapGrid')).el),
        UI.row('', UI.check('Mostrar grade de pixels com zoom alto', p.pixelGrid, set('pixelGrid')).el)
      ];
      UI.dialog({
        title: 'Preferências', width: 440, body, noFocus: true,
        footLeft: [UI.btn('Restaurar padrões', () => { app.resetPrefs(); UI.dialogs[UI.dialogs.length - 1].close(); this.prefsDialog(); }, { small: true })],
        buttons: [{ label: 'Concluir', primary: true }]
      });
    }
  });
})();
