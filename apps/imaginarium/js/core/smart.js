/* ==========================================================================
   Imaginarium — Objetos inteligentes e filtros inteligentes
   L.smart = {
     src (canvas com o conteúdo), quad (4 cantos no documento) | mesh (grade
     deformada), filters [{ type:'fx'|'adj', id|kind, values|params, on,
     blend, opacity }], fon (filtros ligados), fmask (máscara de filtro),
     docData (Blob .edt com as camadas do conteúdo), name
   }
   O conteúdo nunca é alterado pelas transformações: os pixels da camada são
   sempre re-renderizados a partir de src (transformação + filtros).
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const Layers = IMG.Layers, Hm = () => IMG.Homography;

  const rectQuad = (r) => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
  const srcQuad = (sm) => rectQuad({ x: 0, y: 0, w: sm.src.width, h: sm.src.height });
  const quadBounds = (pts) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; pts.forEach((p) => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }); return { x: Math.floor(x0), y: Math.floor(y0), w: Math.max(1, Math.ceil(x1) - Math.floor(x0)), h: Math.max(1, Math.ceil(y1) - Math.floor(y0)) }; };
  const isParallelogram = (q) => Math.abs(q[0].x + q[2].x - q[1].x - q[3].x) < 0.01 && Math.abs(q[0].y + q[2].y - q[1].y - q[3].y) < 0.01;
  /** Homografia src → documento. */
  const mapH = (sm) => Hm().homography(srcQuad(sm), sm.quad);

  /* ==================================================================
     RENDERIZAÇÃO
     ================================================================== */
  function baseRender(sm, doc) {
    const src = sm.src, W = src.width, H = src.height;
    const lim = U.rectInflate(doc ? doc.rect : { x: 0, y: 0, w: 4000, h: 4000 }, 4000);
    if (sm.mesh) {
      const m = sm.mesh;
      let R = U.rectIntersect(quadBounds(m.pts), lim) || { x: 0, y: 0, w: 1, h: 1 };
      const c = U.createCanvas(R.w, R.h), x = c.getContext('2d');
      IMG.drawMesh(x, src, m.cols, m.rows, (i, j) => ({ x: (i / m.cols) * W, y: (j / m.rows) * H }), (i, j) => { const p = m.pts[j * (m.cols + 1) + i]; return { x: p.x - R.x, y: p.y - R.y }; }, 0.5);
      return { canvas: c, x: R.x, y: R.y };
    }
    const q = sm.quad;
    const R = U.rectIntersect(quadBounds(q), lim) || { x: 0, y: 0, w: 1, h: 1 };
    if (isParallelogram(q)) {
      const c = U.createCanvas(R.w, R.h), x = c.getContext('2d');
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      const a = (q[1].x - q[0].x) / W, b = (q[1].y - q[0].y) / W, cc = (q[3].x - q[0].x) / H, d = (q[3].y - q[0].y) / H;
      // redução forte: reamostra antes para manter a qualidade
      const k = Math.max(Math.hypot(a, b), Math.hypot(cc, d));
      if (k < 0.5 && IMG.scaleCanvas) {
        const s2 = IMG.scaleCanvas(src, Math.max(1, W * Math.hypot(a, b)), Math.max(1, H * Math.hypot(cc, d)));
        const sx = s2.width / W, sy = s2.height / H;
        x.setTransform(a / sx, b / sx, cc / sy, d / sy, q[0].x - R.x, q[0].y - R.y); x.drawImage(s2, 0, 0);
      } else { x.setTransform(a, b, cc, d, q[0].x - R.x, q[0].y - R.y); x.drawImage(src, 0, 0); }
      return { canvas: c, x: R.x, y: R.y };
    }
    const Hh = mapH(sm);
    return { canvas: IMG.renderProjective(src, 0, 0, Hm().invert(Hh), R, 'bilinear'), x: R.x, y: R.y };
  }
  const blurish = /blur|gauss|motion|radial|lens|surface|smart|box|shape|spin|path|tilt|iris|field|glow|median|dust|maximum|minimum|offset|wind|emboss/i;
  function filterPad(list) {
    let p = 0;
    for (const f of list) {
      const v = f.values || {};
      if (f.type === 'fx' && blurish.test(f.id)) p = Math.max(p, Math.min(400, Math.ceil(((v.radius || v.distance || v.amount || 10) * 3))));
    }
    return p;
  }
  async function applyOne(f, canvas, doc, L) {
    const w = canvas.width, h = canvas.height, x = canvas.getContext('2d');
    const img = x.getImageData(0, 0, w, h);
    if (f.type === 'adj') {
      const def = IMG.Adjust.defs[f.kind]; if (!def) return null;
      const p = def.prep(IMG.jclone(f.params || {}));
      return IMG.Filters.run(def.kernel, img, p, null);
    }
    const def = IMG.FX.defs[f.id]; if (!def) return null;
    const S = { L, w, h, doc, src: img };
    const p = def.prep ? def.prep(Object.assign({}, f.values || {}), S) : Object.assign({}, f.values || {});
    if (def.fn) { const out = new ImageData(new Uint8ClampedArray(img.data), w, h); def.fn(out.data, w, h, p); return out; }
    if (!def.kernel) return null;
    return IMG.Filters.run(def.kernel, img, p, null);
  }
  /** Aplica a lista de filtros sobre um canvas (no lugar). */
  async function runFilters(list, canvas, doc, L, tokCheck) {
    for (const f of list) {
      const res = await applyOne(f, canvas, doc, L);
      if (tokCheck && !tokCheck()) return false;
      if (!res) continue;
      const t = U.createCanvas(canvas.width, canvas.height); t.getContext('2d').putImageData(res, 0, 0);
      const x = canvas.getContext('2d'), op = f.opacity == null ? 1 : f.opacity / 100, mode = f.blend || 'normal';
      if (mode === 'normal' && op >= 1) { x.clearRect(0, 0, canvas.width, canvas.height); x.drawImage(t, 0, 0); }
      else { const base = U.cloneCanvas(canvas); x.clearRect(0, 0, canvas.width, canvas.height); x.drawImage(base, 0, 0); IMG.Blend.draw(x, t, 0, 0, mode, op); }
    }
    return true;
  }
  async function render(L, doc) {
    const sm = L.smart; if (!sm || !sm.src) return;
    doc = doc || IMG.app.doc;
    const tok = (sm._tok = (sm._tok || 0) + 1);
    let out = baseRender(sm, doc);
    const list = sm.fon !== false ? (sm.filters || []).filter((f) => f.on !== false) : [];
    if (list.length) {
      const pad = filterPad(list);
      if (pad) { const c = U.createCanvas(out.canvas.width + pad * 2, out.canvas.height + pad * 2); c.getContext('2d').drawImage(out.canvas, pad, pad); out = { canvas: c, x: out.x - pad, y: out.y - pad }; }
      const before = sm.fmask && sm.fmask.enabled !== false ? U.cloneCanvas(out.canvas) : null;
      const ok = await runFilters(list, out.canvas, doc, L, () => sm._tok === tok && L.smart === sm);
      if (!ok) return;
      if (before) {
        // máscara de filtro: mistura o resultado filtrado com o original
        const m = sm.fmask, k = U.createCanvas(out.canvas.width, out.canvas.height), kx = k.getContext('2d');
        if (m.bg) { kx.fillStyle = '#fff'; kx.fillRect(0, 0, k.width, k.height); kx.clearRect(m.x - out.x, m.y - out.y, m.canvas.width, m.canvas.height); }
        kx.drawImage(m.canvas, m.x - out.x, m.y - out.y);
        const f2 = U.cloneCanvas(out.canvas), fx2 = f2.getContext('2d'); fx2.globalCompositeOperation = 'destination-in'; fx2.drawImage(k, 0, 0);
        const b2 = before.getContext('2d'); b2.globalCompositeOperation = 'destination-out'; b2.drawImage(k, 0, 0);
        const ox = out.canvas.getContext('2d'); ox.clearRect(0, 0, out.canvas.width, out.canvas.height); ox.globalCompositeOperation = 'lighter'; ox.drawImage(before, 0, 0); ox.drawImage(f2, 0, 0); ox.globalCompositeOperation = 'source-over';
      }
    }
    if (sm._tok !== tok || L.smart !== sm) return;
    L.setCanvas(out.canvas, out.x, out.y);
    IMG.Effects.invalidate(L); IMG.Engine.invalidate(); IMG.Engine.requestRender();
    bus.emit('layer:pixels', L);
  }

  /* ==================================================================
     API
     ================================================================== */
  const Smart = (IMG.Smart = {
    render,
    /** Re-renderiza e registra no histórico quando terminar. */
    update(L, label) { return render(L).then(() => { if (label) IMG.commit(label); }); },
    make(L, src, quad, o = {}) {
      L.type = 'smart';
      L.smart = { src, quad: quad || rectQuad({ x: L.x, y: L.y, w: src.width, h: src.height }), mesh: null, filters: [], fon: true, fmask: null, docData: o.docData || null, name: o.name || L.name, ext: o.ext || null, lid: U.uid('so') };
      L.text = null; L.shape = null; L.fillDef = null;
      return L;
    },
    translate(L, dx, dy) {
      const sm = L.smart; if (!sm) return;
      if (sm.quad) sm.quad = sm.quad.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      if (sm.mesh) sm.mesh.pts = sm.mesh.pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      if (sm.fmask) { sm.fmask.x += dx; sm.fmask.y += dy; }
    },
    transform(L, M) {
      const sm = L.smart; if (!sm) return;
      const tp = (p) => { const q = M.transformPoint(new DOMPoint(p.x, p.y)); return { x: q.x, y: q.y }; };
      sm.quad = sm.quad.map(tp);
      if (sm.mesh) sm.mesh.pts = sm.mesh.pts.map(tp);
      render(L);
    },
    transformFn(L, fn) {
      const sm = L.smart; if (!sm) return;
      const n = 12, W = sm.src.width, H = sm.src.height, Hh = mapH(sm);
      const cur = sm.mesh ? (i, j) => sm.mesh.pts[j * (sm.mesh.cols + 1) + i] : (i, j) => Hm().apply(Hh, (i / n) * W, (j / n) * H);
      const cols = sm.mesh ? sm.mesh.cols : n, rows = sm.mesh ? sm.mesh.rows : n;
      const pts = [];
      for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { const p = cur(i, j); pts.push(fn(p.x, p.y)); }
      const corners = [pts[0], pts[cols], pts[rows * (cols + 1) + cols], pts[rows * (cols + 1)]];
      const H2 = Hm().homography(srcQuad(sm), corners);
      let proj = true;
      for (let j = 0; j <= rows && proj; j++) for (let i = 0; i <= cols; i++) { const a = Hm().apply(H2, (i / cols) * W, (j / rows) * H), b = pts[j * (cols + 1) + i]; if (Math.hypot(a.x - b.x, a.y - b.y) > 0.75) { proj = false; break; } }
      sm.quad = corners.map((p) => ({ x: p.x, y: p.y }));
      sm.mesh = proj ? null : { cols, rows, pts: pts.map((p) => ({ x: p.x, y: p.y })) };
      render(L);
    },
    /** Converte as camadas selecionadas em um objeto inteligente. */
    async convert(doc) {
      doc = doc || IMG.app.doc; if (!doc) return null;
      let sel = Layers.selectedLayers(doc).filter((L) => L.type !== 'adjust' || true);
      sel = sel.filter((L) => !sel.some((q) => q !== L && q.type === 'group' && isInside(L, q)));
      if (!sel.length) { IMG.UI.toast('Selecione uma camada.'); return null; }
      let b = null; sel.forEach((L) => { const cb = L.contentBounds && L.contentBounds(); if (cb) b = U.rectUnion(b, cb); });
      b = b ? U.rectInt(b) : doc.rect;
      const D = new IMG.Doc({ name: sel[sel.length - 1].name, width: b.w, height: b.h, dpi: doc.dpi });
      D.layers = sel.map((L) => { const C = Layers.clone(L, ''); C.name = L.name; C.isBg = false; C.lockPos = false; C.lockAlpha = false; C.parent = null; C.translate(-b.x, -b.y); return C; });
      if (D.layers.length === 1 && D.layers[0].type === 'smart') { /* objeto inteligente aninhado */ }
      const src = IMG.Engine.flatten(D);
      const plain = D.layers.length === 1 && D.layers[0].type === 'raster' && !D.layers[0].mask && !D.layers[0].fx && D.layers[0].blend === 'normal' && D.layers[0].opacity === 1;
      const all = Layers.all(D); D.activeId = all.length ? all[all.length - 1].id : null; D.selected = new Set(D.activeId ? [D.activeId] : []);
      const docData = plain ? null : await IMG.Files.serialize(D);
      // a nova camada ocupa o lugar da mais alta da seleção
      const top = sel[sel.length - 1], list = Layers.siblings(doc, top), idx = list.indexOf(top);
      const S = new IMG.Layer('smart', { name: top.name, canvas: U.cloneCanvas(src), x: b.x, y: b.y });
      Smart.make(S, src, rectQuad(b), { docData, name: top.name });
      S.parent = top.parent || null;
      list.splice(idx + 1, 0, S);
      sel.forEach((L) => Layers.remove(doc, L));
      doc.activeId = S.id; doc.selected = new Set([S.id]); doc.editMask = false;
      bus.emit('layers:change', doc); IMG.Engine.invalidate();
      IMG.commit('Converter em objeto inteligente');
      return S;
    },
    /** Abre o conteúdo como documento; ao salvar (Ctrl+S) o objeto é atualizado. */
    async editContents(L) {
      const doc = IMG.app.doc, sm = L && L.smart; if (!sm) return;
      let D;
      if (sm.docData) {
        D = await IMG.Files.openProject(new File([sm.docData], (sm.name || L.name) + '.edt'));
      } else {
        D = IMG.Files.fromCanvas(sm.src, sm.name || L.name);
        D.layers[0].name = 'Camada 0';
      }
      D.name = (sm.name || L.name).replace(/\.(edt|psb|psd)$/i, '') + '.psb';
      D.isProject = false; D.fileHandle = null;
      D.smartParent = { doc, layerId: L.id };
      D.history.reset('Abrir conteúdo');
      D.savedState = D.history.current;
      bus.emit('doc:rename', D);
      IMG.UI.toast('Edite o conteúdo e use Arquivo › Salvar (Ctrl+S) para atualizar o objeto inteligente.');
      return D;
    },
    /** Grava o documento de conteúdo de volta no objeto inteligente. */
    async commitContents(D) {
      const P = D.smartParent; if (!P) return false;
      const parent = P.doc; if (!IMG.app.docs.includes(parent)) { IMG.UI.toast('O documento de origem foi fechado.'); return false; }
      const L = Layers.find(parent, P.layerId); if (!L || !L.smart) { IMG.UI.toast('O objeto inteligente não existe mais.'); return false; }
      const src = IMG.Engine.flatten(D);
      const docData = await IMG.Files.serialize(D);
      const all = Smart.instances(parent, L);
      all.forEach((q) => Smart.setSource(q, src, docData));
      D.savedState = D.history.current; bus.emit('doc:rename', D);
      const cur = IMG.app.doc;
      const redo = async () => { for (const q of all) await render(q, parent); IMG.commit('Editar conteúdo'); };
      if (cur !== parent) { const prev = cur; IMG.app.setDoc(parent); await redo(); IMG.app.setDoc(prev); }
      else await redo();
      IMG.UI.toast('Objeto inteligente atualizado.');
      return true;
    },
    /** Troca o conteúdo mantendo a escala por pixel (ancorado no centro). */
    setSource(L, src, docData, name) {
      const sm = L.smart, W0 = sm.src.width, H0 = sm.src.height, W = src.width, H = src.height;
      if (W !== W0 || H !== H0) {
        const Hh = mapH(sm), cx = W0 / 2, cy = H0 / 2;
        sm.quad = [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]].map(([dx, dy]) => Hm().apply(Hh, cx + dx, cy + dy));
        sm.mesh = null;
      }
      sm.src = src; sm.docData = docData || null; if (name) sm.name = name;
    },
    /** Instâncias vinculadas (cópias com Ctrl+J compartilham o conteúdo, como no Photoshop). */
    instances(doc, L) {
      const lid = L.smart && L.smart.lid; if (!lid || !doc) return [L];
      const out = []; Layers.walk(doc.layers, (q) => { if (q.smart && q.smart.lid === lid) out.push(q); });
      return out.length ? out : [L];
    },
    async replace(L) {
      const [f] = await IMG.Files.pick('.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.psd,.psb,.tif,.tiff,.tga,.edt,image/*', false); if (!f) return;
      const hide = IMG.UI.busy('Substituindo conteúdo…');
      try {
        let src, docData = null;
        if (/\.edt$/i.test(f.name)) { const D = await openQuiet(f); src = IMG.Engine.flatten(D); docData = f; }
        else { const D = await IMG.Files.decodeToDoc(f); src = IMG.Engine.flatten(D); if (Layers.all(D).length > 1) docData = await IMG.Files.serialize(D); }
        const all = Smart.instances(IMG.app.doc, L);
        all.forEach((q) => Smart.setSource(q, src, docData, U.baseName(f.name)));
        for (const q of all) await render(q); IMG.commit('Substituir conteúdo');
      } catch (err) { IMG.UI.fail(err); } finally { hide(); }
    },
    async exportContents(L) {
      const sm = L.smart; if (!sm) return;
      const base = U.safeFile(String(sm.name || L.name).replace(/\.(edt|psb|psd|png|jpe?g)$/i, ''));
      if (sm.docData) {
        const D = await openQuiet(new File([sm.docData], base + '.edt'));
        const { blob } = await IMG.PSD.write(D);
        U.download(blob, base + '.psd');
      } else U.download(await U.toBlob(sm.src, 'image/png'), base + '.png');
    },
    resetTransform(L) {
      const sm = L.smart; if (!sm) return;
      const b = quadBounds(sm.mesh ? sm.mesh.pts : sm.quad), cx = b.x + b.w / 2, cy = b.y + b.h / 2, W = sm.src.width, H = sm.src.height;
      sm.quad = rectQuad({ x: Math.round(cx - W / 2), y: Math.round(cy - H / 2), w: W, h: H }); sm.mesh = null;
      Smart.update(L, 'Redefinir transformação');
    },
    rasterize(doc, L) { if (!L || !L.smart) return false; L.type = 'raster'; L.smart = null; L._ver++; return true; },
    /** Converte o objeto inteligente em camadas (quando a transformação é só deslocamento/escala). */
    async toLayers(doc, L) {
      const sm = L.smart; if (!sm) return;
      if (!sm.docData) { Smart.rasterize(doc, L); bus.emit('layers:change', doc); IMG.commit('Converter em camadas'); return; }
      const D = await openQuiet(new File([sm.docData], 'c.edt'));
      const q = sm.quad, W = sm.src.width, H = sm.src.height;
      const M = new DOMMatrix([(q[1].x - q[0].x) / W, (q[1].y - q[0].y) / W, (q[3].x - q[0].x) / H, (q[3].y - q[0].y) / H, q[0].x, q[0].y]);
      if (sm.mesh || !isParallelogram(q)) { IMG.UI.toast('Este objeto está distorcido: ele será rasterizado.'); Smart.rasterize(doc, L); bus.emit('layers:change', doc); IMG.commit('Rasterizar'); return; }
      const G = new IMG.Layer('group', { name: L.name });
      const list = Layers.siblings(doc, L); G.parent = L.parent || null;
      list.splice(list.indexOf(L) + 1, 0, G);
      const identity = Math.abs(M.a - 1) < 1e-6 && Math.abs(M.d - 1) < 1e-6 && Math.abs(M.b) < 1e-6 && Math.abs(M.c) < 1e-6;
      D.layers.forEach((C) => {
        C.parent = G; G.children.push(C);
        if (identity) C.translate(Math.round(M.e), Math.round(M.f));
        else {
          Layers.walk([C], (q2) => { if (q2.type === 'raster' && q2.canvas) IMG.xfSurface(q2, [M.a, M.c, M.e, M.b, M.d, M.f, 0, 0, 1], false); if (q2.mask) IMG.xfSurface(q2.mask, [M.a, M.c, M.e, M.b, M.d, M.f, 0, 0, 1], true); if ((q2.type === 'text' || q2.type === 'shape') && IMG.vectorTransform[q2.type]) IMG.vectorTransform[q2.type](q2, M); if (q2.type === 'smart') Smart.transform(q2, M); });
        }
      });
      Layers.remove(doc, L);
      doc.activeId = G.id; doc.selected = new Set([G.id]);
      bus.emit('layers:change', doc); IMG.Engine.invalidate(); IMG.commit('Converter em camadas');
    },

    /* ---------- filtros inteligentes ---------- */
    async addFilter(L, id, values) {
      const sm = L.smart; if (!sm) return;
      sm.filters = (sm.filters || []).concat([{ type: 'fx', id, values: IMG.jclone(values || {}), on: true, blend: 'normal', opacity: 100 }]);
      ensureFilterMask(L);
      await render(L); IMG.commit((IMG.FX.defs[id] || {}).label || 'Filtro inteligente');
    },
    /** Sessão de pré-visualização para os diálogos de filtro (o resultado vira filtro inteligente). */
    async session(L, upto, record) {
      const doc = IMG.app.doc, sm = L.smart;
      const prevCanvas = L.canvas, prevX = L.x, prevY = L.y;
      let base = baseRender(sm, doc);
      const before = (sm.filters || []).slice(0, upto).filter((f) => f.on !== false && sm.fon !== false);
      const pad = Math.max(filterPad(before), 40);
      { const c = U.createCanvas(base.canvas.width + pad * 2, base.canvas.height + pad * 2); c.getContext('2d').drawImage(base.canvas, pad, pad); base = { canvas: c, x: base.x - pad, y: base.y - pad }; }
      if (before.length) await runFilters(before, base.canvas, doc, L);
      const work = base.canvas, ctx = work.getContext('2d'), w = work.width, h = work.height;
      const src = ctx.getImageData(0, 0, w, h);
      const view = U.cloneCanvas(work);
      L.setCanvas(view, base.x, base.y); IMG.Engine.invalidate();
      let busy = false, pending = null, alive = true, idle = [];
      const show = (img) => { view.getContext('2d').putImageData(img, 0, 0); IMG.markDirty(L); IMG.Effects.invalidate(L); IMG.Engine.invalidate(); };
      const S = {
        L, src, w, h, doc, onMask: false, smart: false,
        run(name, params) {
          if (!alive) return;
          if (busy) { pending = [name, params]; return; }
          busy = true;
          IMG.Filters.run(name, src, params, null).then((img) => {
            busy = false; if (!alive) return;
            if (pending) { const p = pending; pending = null; S.run(p[0], p[1]); return; }
            show(img); const fns = idle; idle = []; fns.forEach((f) => f());
          }).catch((err) => { busy = false; IMG.UI.fail(err); const fns = idle; idle = []; fns.forEach((f) => f()); });
        },
        runFn(fn) { const img = new ImageData(new Uint8ClampedArray(src.data), w, h); fn(img.data, w, h); show(img); },
        whenIdle(fn) { if (busy || pending) idle.push(fn); else fn(); },
        showOriginal() { pending = null; S.whenIdle(() => show(src)); },
        commit(label) {
          return new Promise((res) => S.whenIdle(async () => {
            alive = false;
            record();
            ensureFilterMask(L);
            await render(L); IMG.commit(label + ' (filtro inteligente)');
            res();
          }));
        },
        cancel() { alive = false; pending = null; L.setCanvas(prevCanvas, prevX, prevY); IMG.markDirty(L); IMG.Effects.invalidate(L); IMG.Engine.invalidate(); }
      };
      return S;
    },
    /** Diálogo de filtro aplicado como filtro inteligente (novo ou edição do índice idx). */
    async addFilterDialog(L, id, idx) {
      const FX = IMG.FX, d = FX.defs[id]; if (!d) return;
      const sm = L.smart, editing = idx != null;
      if (d.direct) { if (!editing) return Smart.addFilter(L, id, FX.values(id)); return; }
      const vals = editing ? IMG.jclone(sm.filters[idx].values || {}) : FX.values(id);
      const S = await Smart.session(L, editing ? idx : (sm.filters || []).length, () => {
        if (editing) { sm.filters = sm.filters.map((f, i) => (i === idx ? Object.assign({}, f, { values: IMG.jclone(vals) }) : f)); }
        else sm.filters = (sm.filters || []).concat([{ type: 'fx', id, values: IMG.jclone(vals), on: true, blend: 'normal', opacity: 100 }]);
        FX.memory[id] = Object.assign({}, vals); FX.saveMemory && FX.saveMemory();
      });
      const box = el('div'); let fx = null;
      const params = () => (d.prep ? d.prep(Object.assign({}, vals), S) : Object.assign({}, vals));
      const draw = () => { U.clear(box); const { nodes } = FX.buildParams(d, vals, () => { if (d.params && d.params.some((p) => p.visible)) draw(); if (fx) fx.update(); }); nodes.forEach((n) => box.appendChild(n)); };
      draw();
      fx = IMG.FXSession.dialog({ title: d.label, kernel: d.kernel, fn: d.fn, body: [box], width: d.width || 340, params, session: S, delay: d.slow ? 120 : 24,
        reset: () => { (d.params || []).forEach((p) => { vals[p.key] = p.def; }); draw(); },
        onDone: (ok) => { if (ok) FX.last = { id, values: Object.assign({}, vals) }; } });
    },
    /** Ajuste aplicado como filtro inteligente. */
    async addAdjustDialog(L, kind, idx) {
      const A = IMG.Adjust, def = A.defs[kind]; if (!def) return;
      const sm = L.smart, editing = idx != null;
      const p = editing ? IMG.jclone(sm.filters[idx].params) : A.create(kind);
      if (def.direct) {
        sm.filters = (sm.filters || []).concat([{ type: 'adj', kind, params: p, on: true, blend: 'normal', opacity: 100 }]);
        ensureFilterMask(L); await render(L); IMG.commit(def.label + ' (filtro inteligente)'); return;
      }
      const S = await Smart.session(L, editing ? idx : (sm.filters || []).length, () => {
        const ent = { type: 'adj', kind, params: IMG.jclone(p), on: true, blend: 'normal', opacity: 100 };
        if (editing) sm.filters = sm.filters.map((f, i) => (i === idx ? Object.assign({}, f, { params: ent.params }) : f));
        else sm.filters = (sm.filters || []).concat([ent]);
      });
      let fx = null;
      const env = { histogram: () => IMG.Widgets.histogramOf(S.src) };
      const body = A.ui(p, () => { if (fx) fx.update(); }, env);
      fx = IMG.FXSession.dialog({ session: S, title: def.label, kernel: def.kernel, body, width: def.width || 340, params: () => def.prep(p) });
    },
    editFilter(L, idx) {
      const f = L.smart.filters[idx]; if (!f) return;
      if (f.type === 'adj') Smart.addAdjustDialog(L, f.kind, idx); else Smart.addFilterDialog(L, f.id, idx);
    },
    filterBlendDialog(L, idx) {
      const UI = IMG.UI, sm = L.smart, f = sm.filters[idx]; if (!f) return;
      const orig = { blend: f.blend || 'normal', opacity: f.opacity == null ? 100 : f.opacity };
      let blend = orig.blend, opacity = orig.opacity, ok = false;
      const apply = () => { sm.filters = sm.filters.map((q, i) => (i === idx ? Object.assign({}, q, { blend, opacity }) : q)); render(L); };
      UI.dialog({ title: 'Opções de mesclagem (' + filterName(f) + ')', width: 360, body: [UI.row('Modo', UI.select(IMG.BLEND_LIST, blend, (v) => { blend = v; apply(); }, { width: 200, keepFocus: true }).el), UI.row('Opacidade', UI.num({ value: opacity, min: 0, max: 100, unit: '%', width: 80, onInput: (v) => { opacity = v; apply(); } }).el)],
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => { ok = true; } }],
        onClose: () => { if (ok) IMG.commit('Opções de mesclagem do filtro'); else { blend = orig.blend; opacity = orig.opacity; apply(); } } });
    },

    /* ---------- painel Propriedades ---------- */
    propsUI(box, L, doc) {
      const UI = IMG.UI, sm = L.smart; if (!sm) return;
      box.appendChild(el('h3.props-title', { text: 'Objeto inteligente' }));
      box.appendChild(UI.row('Conteúdo', el('span.props-val', { text: 'Incorporado · ' + sm.src.width + ' × ' + sm.src.height + ' px' + (sm.docData ? ' · com camadas' : '') })));
      const b = quadBounds(sm.mesh ? sm.mesh.pts : sm.quad);
      box.appendChild(UI.row('Tamanho', el('span.props-val', { text: b.w + ' × ' + b.h + ' px (' + U.round((Math.hypot(sm.quad[1].x - sm.quad[0].x, sm.quad[1].y - sm.quad[0].y) / sm.src.width) * 100, 1) + '%)' })));
      if ((sm.filters || []).length) box.appendChild(UI.row('Filtros', el('span.props-val', { text: sm.filters.map(filterName).join(', ') })));
      box.appendChild(el('div.props-actions',
        UI.btn('Editar conteúdo', () => Smart.editContents(L), { small: true, icon: 'smart' }),
        UI.btn('Substituir…', () => Smart.replace(L), { small: true }),
        UI.btn('Exportar…', () => Smart.exportContents(L), { small: true }),
        UI.btn('Converter em camadas', () => Smart.toLayers(doc, L), { small: true }),
        UI.btn('Redefinir transformação', () => Smart.resetTransform(L), { small: true })));
    }
  });
  const isInside = (L, G) => { let p = L.parent; while (p) { if (p === G) return true; p = p.parent; } return false; };
  const filterName = (f) => (f.type === 'adj' ? (IMG.Adjust.defs[f.kind] || {}).label || f.kind : (IMG.FX.defs[f.id] || {}).label || f.id);
  /** Cria a máscara de filtro (revelar tudo, ou a partir da seleção) na primeira vez. */
  function ensureFilterMask(L) {
    const sm = L.smart, doc = IMG.app.doc;
    if (sm.fmask) return;
    const R = doc ? doc.rect : { x: 0, y: 0, w: 1, h: 1 };
    const c = U.createCanvas(R.w, R.h), x = c.getContext('2d');
    let bg = 255;
    if (doc && doc.selection) { x.drawImage(doc.selection.canvas, 0, 0); bg = 0; }
    else { x.fillStyle = '#fff'; x.fillRect(0, 0, R.w, R.h); }
    sm.fmask = { canvas: c, x: 0, y: 0, bg, enabled: true };
  }
  async function openQuiet(file) {
    const add = IMG.app.addDoc;
    IMG.app.addDoc = () => {};
    try { return await IMG.Files.openProject(file); } finally { IMG.app.addDoc = add; }
  }
  Smart.openQuiet = openQuiet;

  /* ---------- clonagem para o histórico (a máscara de filtro é copiada) ---------- */
  {
    const prev = IMG.cloneSmart;
    IMG.cloneSmart = function (sm) {
      if (!sm) return null;
      const fm = sm.fmask;
      const o = prev(Object.assign({}, sm, { fmask: null, _tok: undefined }));
      o.fmask = fm ? Object.assign({}, fm, { canvas: U.cloneCanvas(fm.canvas) }) : null;
      return o;
    };
  }

  /* ---------- transformações (ferramenta Transformar e operações de imagem) ---------- */
  IMG.vectorTransform = IMG.vectorTransform || {};
  IMG.vectorTransformFn = IMG.vectorTransformFn || {};
  IMG.vectorTransform.smart = (L, M) => Smart.transform(L, M);
  IMG.vectorTransformFn.smart = (L, fn) => Smart.transformFn(L, fn);
  {
    const prev = IMG.transformDocVectors;
    IMG.transformDocVectors = function (doc, M, opts) {
      if (prev) prev(doc, M, opts);
      Layers.walk(doc.layers, (L) => { if (L.type === 'smart' && L.smart) { const tp = (p) => { const q = M.transformPoint(new DOMPoint(p.x, p.y)); return { x: q.x, y: q.y }; }; L.smart.quad = L.smart.quad.map(tp); if (L.smart.mesh) L.smart.mesh.pts = L.smart.mesh.pts.map(tp); setTimeout(() => render(L, doc), 0); } });
    };
  }
  {
    const prev = Layers.rasterize.bind(Layers);
    Layers.rasterize = function (doc, L) { if (L && L.type === 'smart') return Smart.rasterize(doc, L); return prev(doc, L); };
  }

  /* ---------- ajustes em objetos inteligentes viram filtros inteligentes ---------- */
  {
    const A = IMG.Adjust, open = A.open.bind(A), direct = A.applyDirect.bind(A);
    const smartActive = () => { const d = IMG.app.doc, L = d && d.active; return L && L.type === 'smart' && L.smart && !d.editMask ? L : null; };
    A.open = function (kind) { const L = smartActive(); if (L && A.defs[kind] && !A.defs[kind].noSmart) return Smart.addAdjustDialog(L, kind); return open(kind); };
    A.applyDirect = function (kind, params) { const L = smartActive(); if (L && A.defs[kind]) { const sm = L.smart; sm.filters = (sm.filters || []).concat([{ type: 'adj', kind, params: Object.assign(A.create(kind), params || {}), on: true, blend: 'normal', opacity: 100 }]); ensureFilterMask(L); return render(L).then(() => IMG.commit(A.defs[kind].label + ' (filtro inteligente)')); } return direct(kind, params); };
  }

  /* ---------- inserir arquivo = objeto inteligente (como no Photoshop) ---------- */
  {
    const Files = IMG.Files, prevPlace = Files.placeFile.bind(Files);
    Files.placeFile = async function (doc, file) {
      if (/\.edt$/i.test(file.name)) return prevPlace(doc, file);
      try {
        const D = await Files.decodeToDoc(file);
        const src = IMG.Engine.flatten(D);
        const docData = Layers.all(D).length > 1 ? await Files.serialize(D) : null;
        const k = Math.min(1, doc.width / src.width, doc.height / src.height), w = src.width * k, h = src.height * k;
        const r = { x: Math.round((doc.width - w) / 2), y: Math.round((doc.height - h) / 2), w, h };
        const L = new IMG.Layer('smart', { name: U.baseName(file.name).slice(0, 40), canvas: U.createCanvas(1, 1), x: r.x, y: r.y });
        Smart.make(L, src, rectQuad(r), { docData, name: file.name });
        Layers.add(doc, L);
        doc.activeId = L.id; doc.selected = new Set([L.id]);
        await render(L, doc);
        bus.emit('layers:change', doc);
        IMG.commit('Inserir ' + U.baseName(file.name));
        return L;
      } catch (err) { IMG.UI.toast('Não foi possível inserir "' + file.name + '": ' + err.message, 'error'); return null; }
    };
    Smart.fromDoc = () => {};
    // Salvar no documento de conteúdo atualiza o objeto inteligente
    const prevSave = Files.save.bind(Files);
    Files.save = function (doc, saveAs) { doc = doc || IMG.app.doc; if (doc && doc.smartParent && !saveAs) return Smart.commitContents(doc); return prevSave(doc, saveAs); };
  }

  /* ---------- linhas de filtros inteligentes no painel Camadas ---------- */
  IMG.layerRowHooks = IMG.layerRowHooks || [];
  IMG.layerRowHooks.push((L, depth, h) => {
    if (L.type !== 'smart' || !L.smart || !(L.smart.filters || []).length) return [];
    const sm = L.smart, d = h.doc, out = [];
    const changed = (label) => { render(L).then(() => { IMG.commit(label); h.render(); }); };
    const head = el('div.lrow.lfxrow.sfrow', { data: { id: L.id } });
    const eye = el('button.leye', { type: 'button', html: IMG.icon(sm.fon === false ? 'eyeOff' : 'eye', 13) });
    eye.addEventListener('pointerdown', (e) => e.stopPropagation());
    eye.addEventListener('click', (e) => { e.stopPropagation(); sm.fon = sm.fon === false; changed(sm.fon === false ? 'Ocultar filtros inteligentes' : 'Mostrar filtros inteligentes'); });
    const mth = U.domCanvas(26, 20);
    if (sm.fmask) { const x = mth.getContext('2d'), k = Math.min(26 / d.width, 20 / d.height); x.fillStyle = '#000'; x.fillRect(0, 0, 26, 20); x.drawImage(sm.fmask.canvas, 0, 0, sm.fmask.canvas.width * k, sm.fmask.canvas.height * k); }
    mth.className = 'sfmask' + (sm.fmask && sm.fmask.enabled === false ? ' off' : '');
    mth.title = 'Máscara do filtro (Shift+clique: desativar)';
    mth.addEventListener('pointerdown', (e) => e.stopPropagation());
    mth.addEventListener('click', (e) => { if (e.shiftKey && sm.fmask) { sm.fmask.enabled = sm.fmask.enabled === false; changed('Máscara do filtro'); } });
    head.append(eye, el('span.lindent', { style: { width: depth * 14 + 30 + 'px' } }), mth, el('span.lfxname', { text: 'Filtros inteligentes' }));
    head.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); IMG.UI.contextMenu(e.clientX, e.clientY, [
      { label: sm.fmask && sm.fmask.enabled === false ? 'Ativar máscara de filtro' : 'Desativar máscara de filtro', run: () => { if (sm.fmask) { sm.fmask.enabled = sm.fmask.enabled === false; changed('Máscara do filtro'); } } },
      { label: 'Máscara de filtro a partir da seleção', enabled: () => !!d.selection, run: () => { sm.fmask = null; ensureFilterMask(L); changed('Máscara do filtro'); } },
      { label: 'Excluir máscara de filtro', run: () => { sm.fmask = null; changed('Excluir máscara do filtro'); } },
      '-', { label: 'Excluir filtros inteligentes', run: () => { sm.filters = []; sm.fmask = null; changed('Excluir filtros inteligentes'); } }]); });
    out.push(head);
    sm.filters.slice().reverse().forEach((f) => {
      const i = sm.filters.indexOf(f);
      const r = el('div.lrow.lfxrow.sfrow' + (f.on === false ? '.off' : ''), { data: { id: L.id } });
      const ey = el('button.leye', { type: 'button', html: IMG.icon(f.on === false ? 'eyeOff' : 'eye', 13) });
      ey.addEventListener('pointerdown', (e) => e.stopPropagation());
      ey.addEventListener('click', (e) => { e.stopPropagation(); sm.filters = sm.filters.map((q, k) => (k === i ? Object.assign({}, q, { on: q.on === false }) : q)); changed('Filtro inteligente'); });
      const opt = el('button.lfx.sfopt', { type: 'button', title: 'Opções de mesclagem do filtro', html: IMG.icon('sliders', 13) });
      opt.addEventListener('pointerdown', (e) => e.stopPropagation());
      opt.addEventListener('click', (e) => { e.stopPropagation(); Layers.setActive(d, L.id); Smart.filterBlendDialog(L, i); });
      r.append(ey, el('span.lindent', { style: { width: depth * 14 + 48 + 'px' } }), el('span.lfxname', { text: filterName(f) + (f.blend && f.blend !== 'normal' || (f.opacity != null && f.opacity < 100) ? ' (' + (IMG.BLEND_NAMES[f.blend] || f.blend) + ', ' + (f.opacity == null ? 100 : f.opacity) + '%)' : '') }), opt);
      r.addEventListener('dblclick', () => { Layers.setActive(d, L.id); Smart.editFilter(L, i); });
      r.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); IMG.UI.contextMenu(e.clientX, e.clientY, [
        { label: 'Editar filtro inteligente…', run: () => Smart.editFilter(L, i) },
        { label: 'Opções de mesclagem…', run: () => Smart.filterBlendDialog(L, i) },
        '-',
        { label: 'Mover para cima', enabled: () => i < sm.filters.length - 1, run: () => { const a = sm.filters.slice(); [a[i], a[i + 1]] = [a[i + 1], a[i]]; sm.filters = a; changed('Reordenar filtros'); } },
        { label: 'Mover para baixo', enabled: () => i > 0, run: () => { const a = sm.filters.slice(); [a[i], a[i - 1]] = [a[i - 1], a[i]]; sm.filters = a; changed('Reordenar filtros'); } },
        '-', { label: 'Excluir filtro inteligente', run: () => { sm.filters = sm.filters.filter((_, k) => k !== i); if (!sm.filters.length) sm.fmask = null; changed('Excluir filtro inteligente'); } }]); });
      out.push(r);
    });
    return out;
  });

  /* ---------- comandos ---------- */
  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, H) => {
    const isSmart = () => !!(H.hasLayer() && H.act().type === 'smart' && H.act().smart);
    C('layer.smartConvert', 'Converter em objeto inteligente', () => Smart.convert(H.doc()).catch((e) => IMG.UI.fail(e)), { enabled: () => !!(H.hasLayer() && !(H.act().isBg && Layers.selectedLayers(H.doc()).length === 1 && false)) });
    C('filter.smartConvert', 'Converter para filtros inteligentes', () => { if (isSmart()) { IMG.UI.toast('A camada já é um objeto inteligente.'); return; } Smart.convert(H.doc()).catch((e) => IMG.UI.fail(e)); }, { enabled: H.hasLayer });
    C('layer.smartViaCopy', 'Novo objeto inteligente via cópia', () => { const d = H.doc(), L = H.act(); const Cc = Layers.clone(L, ' cópia'); if (Cc.smart) Cc.smart.lid = U.uid('so'); const list = Layers.siblings(d, L); Cc.parent = L.parent || null; list.splice(list.indexOf(L) + 1, 0, Cc); d.activeId = Cc.id; d.selected = new Set([Cc.id]); bus.emit('layers:change', d); IMG.commit('Novo objeto inteligente via cópia'); }, { enabled: isSmart });
    C('layer.smartEdit', 'Editar conteúdo', () => Smart.editContents(H.act()).catch((e) => IMG.UI.fail(e)), { enabled: isSmart });
    C('layer.smartReplace', 'Substituir conteúdo…', () => Smart.replace(H.act()), { enabled: isSmart });
    C('layer.smartExport', 'Exportar conteúdo…', () => Smart.exportContents(H.act()).catch((e) => IMG.UI.fail(e)), { enabled: isSmart });
    C('layer.smartReset', 'Redefinir transformação', () => Smart.resetTransform(H.act()), { enabled: isSmart });
    C('layer.smartToLayers', 'Converter em camadas', () => Smart.toLayers(H.doc(), H.act()).catch((e) => IMG.UI.fail(e)), { enabled: isSmart });
    C('layer.smartRasterize', 'Rasterizar', () => { if (Smart.rasterize(H.doc(), H.act())) { bus.emit('layers:change', H.doc()); IMG.commit('Rasterizar objeto inteligente'); } }, { enabled: isSmart });
  });
})();
