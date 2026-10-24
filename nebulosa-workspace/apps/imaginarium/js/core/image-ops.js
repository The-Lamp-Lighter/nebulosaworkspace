/* ==========================================================================
   Imaginarium — operações de imagem e área de transferência
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const Layers = IMG.Layers;

  /** Reamostragem: método em IMG.resampleMethod ('bicubic' padrão, 'bilinear', 'nearest', 'smoother', 'sharper'). */
  function scaleCanvas(src, w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const m = IMG.resampleMethod || 'bicubic';
    let cur = src;
    // redução em etapas (metade por vez) para os métodos suaves
    if ((m === 'bicubic' || m === 'smoother') && (w < src.width / 2 || h < src.height / 2)) {
      while (cur.width / 2 > w && cur.height / 2 > h) {
        const t = U.createCanvas(Math.max(w, Math.round(cur.width / 2)), Math.max(h, Math.round(cur.height / 2))), tx = t.getContext('2d');
        tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high'; tx.drawImage(cur, 0, 0, t.width, t.height); cur = t;
      }
    }
    const c = U.createCanvas(w, h), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = m !== 'nearest'; ctx.imageSmoothingQuality = m === 'bilinear' ? 'low' : 'high';
    ctx.drawImage(cur, 0, 0, w, h);
    if (m === 'sharper' && IMG.Filters && IMG.unsharpCanvas) IMG.unsharpCanvas(c, 0.6, 0.8);
    return c;
  }
  IMG.scaleCanvas = scaleCanvas;
  /** Aplica uma transformação (a,b,c,d,e,f) e devolve um canvas novo de tamanho w×h. */
  function drawTransformed(src, w, h, m) {
    const c = U.createCanvas(w, h), ctx = c.getContext('2d');
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(src, 0, 0);
    return c;
  }
  const eachSurface = (doc, fn) => Layers.walk(doc.layers, (L) => { if (L.type !== 'group') fn(L, L, false); if (L.mask) fn(L.mask, L, true); });
  const setSurf = (s, canvas, x, y) => { s.canvas = canvas; s.x = x; s.y = y; s._snap = null; IMG.markDirty(s); };

  /** Transforma os canais alfa do documento (matriz afim antigo → novo, tela NW×NH). */
  function xfChannels(doc, NW, NH, m) {
    (doc.channels || []).forEach((ch) => {
      const c = U.createCanvas(NW, NH), x = c.getContext('2d');
      x.imageSmoothingQuality = 'high'; x.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); x.drawImage(ch.canvas, ch.x || 0, ch.y || 0);
      setSurf(ch, c, 0, 0);
    });
  }
  IMG.xfChannels = xfChannels;
  /** Estende a camada de fundo para cobrir a tela inteira, com a cor indicada. */
  function extendBackground(doc, color) {
    Layers.walk(doc.layers, (L) => {
      if (!L.isBg || !L.canvas) return;
      const cur = { x: L.x, y: L.y, w: L.canvas.width, h: L.canvas.height };
      if (cur.x <= 0 && cur.y <= 0 && cur.x + cur.w >= doc.width && cur.y + cur.h >= doc.height) return;
      const u = U.rectUnion(cur, { x: 0, y: 0, w: doc.width, h: doc.height });
      const c = U.createCanvas(u.w, u.h), x = c.getContext('2d');
      x.fillStyle = color || IMG.app.bg; x.fillRect(0, 0, u.w, u.h);
      x.clearRect(cur.x - u.x, cur.y - u.y, cur.w, cur.h);
      x.drawImage(L.canvas, cur.x - u.x, cur.y - u.y);
      L.setCanvas(c, u.x, u.y);
    });
  }

  function afterResize(doc, label) {
    IMG.Selection.clear(doc);
    bus.emit('doc:resize', doc);
    bus.emit('layers:change', doc);
    IMG.commit(label);
    IMG.Engine.fit(false);
  }

  const Ops = (IMG.ImageOps = {
    extendBackground,
    /* ---------- redimensionar imagem ---------- */
    resize(doc, w, h, o = {}) {
      w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
      if (w === doc.width && h === doc.height) return;
      const kx = w / doc.width, ky = h / doc.height, k = (kx + ky) / 2;
      Layers.walk(doc.layers, (L) => {
        if (L.type === 'text') { /* via transformDocVectors */
        } else if (L.type === 'raster' || L.type === 'smart') {
          const c = scaleCanvas(L.canvas, L.canvas.width * kx, L.canvas.height * ky);
          L.setCanvas(c, Math.round(L.x * kx), Math.round(L.y * ky));
        }
        if (L.mask) { const m = L.mask; setSurf(m, scaleCanvas(m.canvas, m.canvas.width * kx, m.canvas.height * ky), Math.round(m.x * kx), Math.round(m.y * ky)); }
      });
      if (IMG.transformDocVectors) IMG.transformDocVectors(doc, new DOMMatrix().scale(kx, ky), { scaleStroke: k });
      doc.guides.v = doc.guides.v.map((g) => Math.round(g * kx)); doc.guides.h = doc.guides.h.map((g) => Math.round(g * ky));
      xfChannels(doc, w, h, [kx, 0, 0, ky, 0, 0]);
      doc.width = w; doc.height = h;
      afterResize(doc, o.label || 'Redimensionar imagem');
    },

    resizeDialog() {
      const doc = IMG.app.doc, UI = IMG.UI;
      let w = doc.width, h = doc.height, lock = true;
      const ratio = w / h;
      const nw = UI.num({ value: w, min: 1, max: 30000, unit: 'px', width: 110, onInput: (v) => { w = v; if (lock) { h = Math.max(1, Math.round(v / ratio)); nh.set(h); } pct.set(U.round((w / doc.width) * 100, 1)); info(); } });
      const nh = UI.num({ value: h, min: 1, max: 30000, unit: 'px', width: 110, onInput: (v) => { h = v; if (lock) { w = Math.max(1, Math.round(v * ratio)); nw.set(w); } pct.set(U.round((w / doc.width) * 100, 1)); info(); } });
      const pct = UI.num({ value: 100, min: 1, max: 2000, step: 0.1, unit: '%', width: 110, onInput: (v) => { w = Math.max(1, Math.round((doc.width * v) / 100)); h = lock ? Math.max(1, Math.round(w / ratio)) : Math.max(1, Math.round((doc.height * v) / 100)); nw.set(w); nh.set(h); info(); } });
      const note = el('p.dialog-note');
      const info = () => { note.textContent = 'Atual: ' + doc.width + ' × ' + doc.height + ' px  →  Novo: ' + w + ' × ' + h + ' px (' + U.round((w * h) / 1e6, 2).toString().replace('.', ',') + ' MP)'; };
      info();
      UI.dialog({
        title: 'Redimensionar imagem', width: 360,
        body: [UI.row('Largura', nw.el), UI.row('Altura', nh.el), UI.row('Escala', pct.el), UI.row('', UI.check('Manter proporção', true, (v) => { lock = v; }).el), note],
        buttons: [{ label: 'Cancelar' }, { label: 'Redimensionar', primary: true, onClick: () => { this.resize(doc, w, h); } }]
      });
    },

    /* ---------- tamanho da tela ---------- */
    canvasSize(doc, w, h, ax, ay, ext) {
      w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
      if (w === doc.width && h === doc.height) return;
      const dx = Math.round((w - doc.width) * ax), dy = Math.round((h - doc.height) * ay);
      doc.layers.forEach((L) => { const linked = []; Layers.walk([L], (q) => { if (q.mask && !q.mask.linked) linked.push(q.mask); }); L.translate(dx, dy); linked.forEach((m) => { m.x += dx; m.y += dy; }); });
      (doc.paths || []).forEach((p) => IMG.Paths && IMG.Paths.translate(p.path, dx, dy));
      doc.guides.v = doc.guides.v.map((g) => g + dx); doc.guides.h = doc.guides.h.map((g) => g + dy);
      xfChannels(doc, w, h, [1, 0, 0, 1, dx, dy]);
      doc.width = w; doc.height = h;
      extendBackground(doc, ext);
      afterResize(doc, 'Tamanho da tela');
    },

    canvasDialog() {
      const doc = IMG.app.doc, UI = IMG.UI;
      let w = doc.width, h = doc.height, ax = 0.5, ay = 0.5, rel = false, ext = 'bg', custom = '#808080';
      const nw = UI.num({ value: w, min: -30000, max: 30000, unit: 'px', width: 110, onInput: (v) => { w = v; info(); } });
      const nh = UI.num({ value: h, min: -30000, max: 30000, unit: 'px', width: 110, onInput: (v) => { h = v; info(); } });
      const grid = el('div.anchor-grid', { role: 'group', 'aria-label': 'Âncora' });
      const cells = [];
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
        const b = el('button.anchor-cell' + (i === 1 && j === 1 ? '.active' : ''), { type: 'button', title: ['Superior', 'Centro', 'Inferior'][j] + ' / ' + ['esquerda', 'centro', 'direita'][i] });
        b.addEventListener('click', () => { ax = i / 2; ay = j / 2; cells.forEach((c) => c.classList.remove('active')); b.classList.add('active'); });
        cells.push(b); grid.appendChild(b);
      }
      const fw = () => (rel ? doc.width + w : w), fh = () => (rel ? doc.height + h : h);
      const note = el('p.dialog-note');
      const info = () => { note.textContent = 'Atual: ' + doc.width + ' × ' + doc.height + ' px  →  Novo: ' + Math.max(1, Math.round(fw())) + ' × ' + Math.max(1, Math.round(fh())) + ' px'; };
      info();
      const cb = UI.colorBtn(custom, (hx) => { if (hx) custom = hx; });
      cb.el.style.display = 'none';
      const extSel = UI.select([['fg', 'Primeiro plano'], ['bg', 'Plano de fundo'], ['white', 'Branco'], ['black', 'Preto'], ['gray', 'Cinza'], ['custom', 'Outra…']], ext, (v) => { ext = v; cb.el.style.display = v === 'custom' ? '' : 'none'; }, { keepFocus: true, width: 150 });
      const relChk = UI.check('Relativo', false, (v) => { rel = v; if (v) { w = 0; h = 0; } else { w = doc.width; h = doc.height; } nw.set(w); nh.set(h); info(); });
      const extColor = () => ({ fg: IMG.app.fg, bg: IMG.app.bg, white: '#ffffff', black: '#000000', gray: '#808080', custom }[ext]);
      UI.dialog({
        title: 'Tamanho da tela', width: 380,
        body: [UI.row('Largura', nw.el), UI.row('Altura', nh.el), UI.row('', relChk.el), UI.row('Âncora', grid), UI.row('Cor da extensão', el('div.fill-field', extSel.el, cb.el)), note],
        buttons: [{ label: 'Cancelar' }, { label: 'Aplicar', primary: true, onClick: () => { this.canvasSize(doc, Math.max(1, fw()), Math.max(1, fh()), ax, ay, extColor()); } }]
      });
    },

    /* ---------- rotação da imagem (90 / 180 / 270) ---------- */
    rotate(doc, deg) {
      deg = ((deg % 360) + 360) % 360;
      if (!deg) return;
      const W = doc.width, H = doc.height;
      const mapPt = (x, y) => (deg === 90 ? [H - y, x] : deg === 180 ? [W - x, H - y] : [y, W - x]);
      const turn = (s) => {
        const w = s.canvas.width, h = s.canvas.height;
        let c, x, y;
        if (deg === 90) { c = drawTransformed(s.canvas, h, w, [0, 1, -1, 0, h, 0]); x = H - (s.y + h); y = s.x; }
        else if (deg === 180) { c = drawTransformed(s.canvas, w, h, [-1, 0, 0, -1, w, h]); x = W - (s.x + w); y = H - (s.y + h); }
        else { c = drawTransformed(s.canvas, h, w, [0, -1, 1, 0, 0, w]); x = s.y; y = W - (s.x + w); }
        return [c, x, y];
      };
      Layers.walk(doc.layers, (L) => {
        if (L.type === 'raster' || L.type === 'smart') { const [c, x, y] = turn(L); L.setCanvas(c, x, y); }
        if (L.mask) { const [c, x, y] = turn(L.mask); setSurf(L.mask, c, x, y); }
      });
      const rm = deg === 90 ? [0, 1, -1, 0, H, 0] : deg === 180 ? [-1, 0, 0, -1, W, H] : [0, -1, 1, 0, 0, W];
      if (IMG.transformDocVectors) IMG.transformDocVectors(doc, new DOMMatrix(rm));
      xfChannels(doc, deg === 180 ? W : H, deg === 180 ? H : W, rm);
      const gv = doc.guides.v, gh = doc.guides.h;
      if (deg === 90) { doc.guides.v = gh.map((g) => H - g); doc.guides.h = gv.slice(); }
      else if (deg === 180) { doc.guides.v = gv.map((g) => W - g); doc.guides.h = gh.map((g) => H - g); }
      else { doc.guides.v = gh.slice(); doc.guides.h = gv.map((g) => W - g); }
      if (deg !== 180) { doc.width = H; doc.height = W; }
      afterResize(doc, 'Rotacionar ' + (deg === 270 ? '90° anti-horário' : deg + '°'));
    },

    /* ---------- espelhar a imagem ---------- */
    flip(doc, dir) {
      const W = doc.width, H = doc.height, hz = dir === 'h';
      let rasterized = 0;
      Layers.walk(doc.layers, (L) => {
        void L;
      });
      if (IMG.transformDocVectors) IMG.transformDocVectors(doc, new DOMMatrix(hz ? [-1, 0, 0, 1, W, 0] : [1, 0, 0, -1, 0, H]));
      eachSurface(doc, (s, L, isMask) => {
        if (!isMask && L.type !== 'raster') return;
        const w = s.canvas.width, h = s.canvas.height;
        const c = hz ? drawTransformed(s.canvas, w, h, [-1, 0, 0, 1, w, 0]) : drawTransformed(s.canvas, w, h, [1, 0, 0, -1, 0, h]);
        const x = hz ? W - (s.x + w) : s.x, y = hz ? s.y : H - (s.y + h);
        if (isMask) setSurf(s, c, x, y); else L.setCanvas(c, x, y);
      });
      if (hz) doc.guides.v = doc.guides.v.map((g) => W - g); else doc.guides.h = doc.guides.h.map((g) => H - g);
      xfChannels(doc, W, H, hz ? [-1, 0, 0, 1, W, 0] : [1, 0, 0, -1, 0, H]);
      if (doc.selection) {
        const s = doc.selection, c = hz ? drawTransformed(s.canvas, W, H, [-1, 0, 0, 1, W, 0]) : drawTransformed(s.canvas, W, H, [1, 0, 0, -1, 0, H]);
        s.canvas = c; s._snap = null; IMG.markDirty(s); IMG.Selection.update(doc);
      }
      if (rasterized) IMG.UI.toast(rasterized + (rasterized > 1 ? ' camadas foram rasterizadas' : ' camada foi rasterizada') + ' para o espelhamento.');
      bus.emit('layers:change', doc);
      IMG.commit(hz ? 'Espelhar horizontal' : 'Espelhar vertical');
    },

    /** Espelha apenas a camada ativa em torno do próprio centro. */
    flipLayer(doc, dir) {
      const L = doc.active, hz = dir === 'h';
      if (!L || L.type === 'group') { IMG.UI.toast('Selecione uma camada.'); return; }
      if (Layers.isLocked(L)) { IMG.UI.toast('A camada está bloqueada.'); return; }
      const b = L.contentBounds(); if (!b) return;
      if (L.type !== 'raster') Layers.rasterize(doc, L);
      const w = L.canvas.width, h = L.canvas.height;
      const c = hz ? drawTransformed(L.canvas, w, h, [-1, 0, 0, 1, w, 0]) : drawTransformed(L.canvas, w, h, [1, 0, 0, -1, 0, h]);
      const nx = hz ? 2 * (b.x + b.w / 2) - (L.x + w) : L.x, ny = hz ? L.y : 2 * (b.y + b.h / 2) - (L.y + h);
      L.setCanvas(c, Math.round(nx), Math.round(ny));
      bus.emit('layers:change', doc);
      IMG.commit(hz ? 'Espelhar camada (horizontal)' : 'Espelhar camada (vertical)');
    },

    /* ---------- recorte ---------- */
    crop(doc, r, o = {}) {
      r = U.rectInt(r);
      r.w = Math.max(1, r.w); r.h = Math.max(1, r.h);
      const view = doc.view, keepX = view.x + r.x * view.zoom, keepY = view.y + r.y * view.zoom;
      doc.layers.forEach((L) => { const free = []; Layers.walk([L], (q) => { if (q.mask && !q.mask.linked) free.push(q.mask); }); L.translate(-r.x, -r.y); free.forEach((m) => { m.x -= r.x; m.y -= r.y; }); });
      (doc.paths || []).forEach((p) => IMG.Paths && IMG.Paths.translate(p.path, -r.x, -r.y));
      if (o.deletePixels !== false) {
        const R = { x: 0, y: 0, w: r.w, h: r.h };
        Layers.walk(doc.layers, (L) => {
          if (L.type !== 'raster') return;
          const cur = L.rect(), keep = U.rectIntersect(cur, R);
          if (keep && keep.x === cur.x && keep.y === cur.y && keep.w === cur.w && keep.h === cur.h) return;
          const k = keep || { x: 0, y: 0, w: 1, h: 1 };
          const c = U.createCanvas(k.w, k.h);
          if (keep) c.getContext('2d').drawImage(L.canvas, cur.x - k.x, cur.y - k.y);
          L.setCanvas(c, k.x, k.y);
        });
      }
      doc.guides.v = doc.guides.v.map((g) => g - r.x).filter((g) => g >= 0 && g <= r.w);
      doc.guides.h = doc.guides.h.map((g) => g - r.y).filter((g) => g >= 0 && g <= r.h);
      xfChannels(doc, r.w, r.h, [1, 0, 0, 1, -r.x, -r.y]);
      if (doc.samplers) doc.samplers = doc.samplers.map((p) => ({ x: p.x - r.x, y: p.y - r.y })).filter((p) => p.x >= 0 && p.y >= 0 && p.x < r.w && p.y < r.h);
      doc.width = r.w; doc.height = r.h;
      extendBackground(doc, o.bgColor);
      IMG.Selection.clear(doc);
      view.x = keepX; view.y = keepY;
      bus.emit('doc:resize', doc);
      bus.emit('layers:change', doc);
      IMG.commit(o.label || 'Recortar');
      IMG.Engine.viewChanged();
    },

    cropToSelection(doc) {
      if (!doc.selection || !doc.selection.bounds) { IMG.UI.toast('Faça uma seleção para recortar a imagem.'); return; }
      this.crop(doc, doc.selection.bounds, { label: 'Recortar pela seleção' });
      IMG.Engine.fit();
    },

    /** Ajusta a tela aos limites do conteúdo visível. */
    trim(doc) {
      let b = null;
      Layers.walk(doc.layers, (L) => { if (L.type !== 'group' && Layers.isVisible(L)) b = U.rectUnion(b, L.contentBounds()); });
      if (!b) { IMG.UI.toast('Não há conteúdo visível para ajustar a tela.'); return; }
      if (b.x === 0 && b.y === 0 && b.w === doc.width && b.h === doc.height) { IMG.UI.toast('A tela já corresponde ao conteúdo.'); return; }
      this.crop(doc, b, { deletePixels: false, label: 'Ajustar tela ao conteúdo' });
      IMG.Engine.fit();
    },

    /* ---------- alinhamento ---------- */
    align(kind) {
      const doc = IMG.app.doc; if (!doc) return;
      const layers = Layers.selectedLayers(doc).filter((l) => !Layers.isLocked(l) && !l.lockPos);
      if (!layers.length) return;
      let ref = doc.selection && doc.selection.bounds ? doc.selection.bounds : null;
      if (!ref && layers.length > 1) layers.forEach((l) => { ref = U.rectUnion(ref, l.contentBounds()); });
      if (!ref) ref = doc.rect;
      let moved = false;
      layers.forEach((L) => {
        const b = L.contentBounds(); if (!b) return;
        let dx = 0, dy = 0;
        if (kind === 'left') dx = ref.x - b.x; else if (kind === 'hcenter') dx = ref.x + ref.w / 2 - (b.x + b.w / 2); else if (kind === 'right') dx = ref.x + ref.w - (b.x + b.w);
        else if (kind === 'top') dy = ref.y - b.y; else if (kind === 'vcenter') dy = ref.y + ref.h / 2 - (b.y + b.h / 2); else if (kind === 'bottom') dy = ref.y + ref.h - (b.y + b.h);
        dx = Math.round(dx); dy = Math.round(dy);
        if (dx || dy) { L.translate(dx, dy); moved = true; }
      });
      if (moved) { bus.emit('layers:change', doc); IMG.commit('Alinhar'); }
    },

    /* ---------- preencher / limpar / contornar ---------- */
    fill(doc, color, opacity = 1, o = {}) {
      const L = Layers.paintTarget(doc); if (!L) return;
      const onMask = !!(doc.editMask && L.mask);
      let surf = L;
      if (onMask) { Layers.maskEnsureCovers(L.mask, doc.rect); surf = L.mask; } else L.ensureCovers(doc.rect);
      const t = U.createCanvas(doc.width, doc.height), c = t.getContext('2d');
      let op = !onMask && (L.lockAlpha || o.keepAlpha) ? 'source-atop' : 'source-over';
      if (o.pattern) { IMG.Patterns.fill(c, o.pattern, doc.width, doc.height, o.scale || 100); color = null; }
      if (onMask) { const lum = color ? U.luma(color) : 1; c.fillStyle = '#fff'; if (lum < 0.5) { op = 'destination-out'; opacity *= 1 - lum; } else opacity *= lum; c.fillRect(0, 0, doc.width, doc.height); }
      else if (color) { c.fillStyle = color; c.fillRect(0, 0, doc.width, doc.height); }
      if (o.blend && o.blend !== 'normal' && !onMask) {
        IMG.Selection.clip(doc, t);
        const x = surf.canvas.getContext('2d');
        const keep = U.cloneCanvas(surf.canvas);
        IMG.Blend.draw(x, t, -surf.x, -surf.y, o.blend, opacity);
        if (op === 'source-atop') { x.globalCompositeOperation = 'destination-in'; x.drawImage(keep, 0, 0); x.globalCompositeOperation = 'source-over'; }
        IMG.markDirty(surf); bus.emit('layer:pixels', L); IMG.Effects.invalidate(L); IMG.Engine.invalidate(); IMG.commit('Preencher');
        return;
      }
      IMG.Selection.clip(doc, t);
      const x = surf.canvas.getContext('2d');
      x.globalAlpha = opacity; x.globalCompositeOperation = op;
      x.drawImage(t, -surf.x, -surf.y);
      x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
      IMG.markDirty(surf);
      bus.emit('layer:pixels', L);
      IMG.commit('Preencher');
    },

    fillDialog() {
      const doc = IMG.app.doc, UI = IMG.UI;
      let src = 'fg', color = IMG.app.fg, opacity = 100, blend = 'normal', keep = false, pat = 'p0';
      const cb = UI.colorBtn(color, (hex) => { if (hex) color = hex; });
      const pb = IMG.Widgets.patternBtn(pat, (v) => { pat = v; });
      const sel = UI.select([['fg', 'Cor do primeiro plano'], ['bg', 'Cor de fundo'], ['custom', 'Cor…'], ['pattern', 'Padrão'], ['contentAware', 'Sensível ao conteúdo'], null, ['black', 'Preto'], ['gray', 'Cinza 50%'], ['white', 'Branco']], src, (v) => { src = v; cb.el.style.display = v === 'custom' ? '' : 'none'; pb.el.style.display = v === 'pattern' ? '' : 'none'; }, { keepFocus: true });
      cb.el.style.display = 'none'; pb.el.style.display = 'none';
      const op = UI.slider({ label: 'Opacidade', value: 100, min: 1, max: 100, step: 1, unit: '%', onInput: (v) => { opacity = v; } });
      const md = UI.select(IMG.BLEND_LIST, blend, (v) => { blend = v; }, { keepFocus: true });
      UI.dialog({
        title: 'Preencher', width: 380,
        body: [UI.row('Conteúdo', sel.el, cb.el, pb.el), el('h3.form-title', { text: 'Mesclagem' }), UI.row('Modo', md.el), op.el, UI.row('', UI.check('Preservar transparência', keep, (v) => { keep = v; }).el),
          el('p.dialog-note', { text: doc.selection ? 'O preenchimento será aplicado dentro da seleção.' : 'Sem seleção: a camada inteira será preenchida.' })],
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
          if (src === 'contentAware') { if (IMG.Inpaint) IMG.Inpaint.contentAwareFill(doc); else UI.toast('Indisponível.'); return; }
          const m = { fg: IMG.app.fg, bg: IMG.app.bg, white: '#ffffff', black: '#000000', gray: '#808080', custom: color };
          this.fill(doc, src === 'pattern' ? null : m[src], opacity / 100, { keepAlpha: keep, blend, pattern: src === 'pattern' ? pat : null });
        } }]
      });
    },

    /* ---------- camada via cópia / recorte (Ctrl+J / Shift+Ctrl+J) ---------- */
    layerVia(doc, cut) {
      const L = doc.active; if (!L) return;
      if (!doc.selection || L.type === 'group' || L.type === 'adjust' || L.type !== 'raster') {
        if (cut) { IMG.UI.toast('Faça uma seleção em uma camada de pixels para recortar.'); return; }
        if (Layers.duplicate(doc)) { bus.emit('layers:change', doc); IMG.commit('Camada via cópia'); }
        return;
      }
      const t = U.createCanvas(doc.width, doc.height), c = t.getContext('2d');
      c.drawImage(L.canvas, L.x, L.y);
      IMG.Selection.clip(doc, t);
      const ab = IMG.alphaBounds(t);
      if (!ab) { IMG.UI.toast('A área selecionada está vazia.'); return; }
      const out = U.createCanvas(ab.w, ab.h); out.getContext('2d').drawImage(t, -ab.x, -ab.y);
      if (cut) {
        if (Layers.isLocked(L) || L.lockPaint) { IMG.UI.toast('A camada está bloqueada.'); return; }
        const x = L.ctx;
        if (L.isBg) { const f = U.createCanvas(doc.width, doc.height), fc = f.getContext('2d'); fc.fillStyle = IMG.app.bg; fc.fillRect(0, 0, doc.width, doc.height); IMG.Selection.clip(doc, f); x.drawImage(f, -L.x, -L.y); }
        else { x.globalCompositeOperation = 'destination-out'; x.drawImage(doc.selection.canvas, -L.x, -L.y); x.globalCompositeOperation = 'source-over'; }
        L.markDirty(); bus.emit('layer:pixels', L);
      }
      const N = Layers.fromCanvas(doc, out, Layers.name(doc, 'Camada'), ab.x, ab.y, { outside: true });
      void N;
      bus.emit('layers:change', doc);
      IMG.commit(cut ? 'Camada via recorte' : 'Camada via cópia');
    },

    /* ---------- seleção de camadas adjacentes (Alt+[ / Alt+]) ---------- */
    selectAdjacent(doc, dir, add) {
      const flat = Layers.all(doc).filter((q) => Layers.isVisible(q) || true);
      const cur = doc.active; if (!cur) return;
      const i = flat.indexOf(cur), j = U.clamp(i + dir, 0, flat.length - 1);
      if (j === i) return;
      Layers.setActive(doc, flat[j].id, add ? 'toggle' : undefined);
      if (add) { doc.selected.add(cur.id); bus.emit('layers:select'); }
    },

    /* ---------- vínculos ---------- */
    linkLayers(doc) {
      const s = Layers.selectedLayers(doc); if (s.length < 2) return;
      const id = U.uid('lk');
      s.forEach((q) => { q.link = id; });
      bus.emit('layers:change', doc); IMG.commit('Vincular camadas');
    },
    unlinkLayers(doc) {
      const s = Layers.selectedLayers(doc);
      s.forEach((q) => { q.link = null; });
      bus.emit('layers:change', doc); IMG.commit('Desvincular camadas');
    },
    selectLinked(doc) {
      const a = doc.active; if (!a || !a.link) return;
      const ids = Layers.all(doc).filter((q) => q.link === a.link).map((q) => q.id);
      doc.selected = new Set(ids); bus.emit('layers:select');
    },
    /** Camadas afetadas por mover/transformar: as selecionadas + vinculadas. */
    withLinked(doc, layers) {
      const links = new Set(layers.map((q) => q.link).filter(Boolean));
      if (!links.size) return layers;
      const out = layers.slice();
      Layers.walk(doc.layers, (q) => { if (q.link && links.has(q.link) && !out.includes(q)) out.push(q); });
      return out;
    },

    /* ---------- distribuir ---------- */
    distribute(kind) {
      const doc = IMG.app.doc; if (!doc) return;
      const layers = Layers.selectedLayers(doc).filter((l) => !Layers.isLocked(l) && !l.lockPos).map((L) => ({ L, b: L.contentBounds() })).filter((o) => o.b);
      if (layers.length < 3) return;
      const key = (b) => (kind === 'left' ? b.x : kind === 'hcenter' ? b.x + b.w / 2 : kind === 'right' ? b.x + b.w : kind === 'top' ? b.y : kind === 'vcenter' ? b.y + b.h / 2 : b.y + b.h);
      layers.sort((a, b) => key(a.b) - key(b.b));
      const k0 = key(layers[0].b), k1 = key(layers[layers.length - 1].b), step = (k1 - k0) / (layers.length - 1);
      const horiz = kind === 'left' || kind === 'hcenter' || kind === 'right';
      layers.forEach((o, i) => { const d = Math.round(k0 + step * i - key(o.b)); if (d) o.L.translate(horiz ? d : 0, horiz ? 0 : d); });
      bus.emit('layers:change', doc); IMG.commit('Distribuir');
    },

    /* ---------- camadas de preenchimento ---------- */
    newFillLayer(type) {
      const doc = IMG.app.doc, UI = IMG.UI; if (!doc) return;
      const def = type === 'solid' ? { type, color: IMG.app.fg } : type === 'gradient' ? { type, gradient: IMG.Gradients.def(), style: 'linear', angle: 90, scale: 100, reverse: false, dither: true } : { type, pattern: 'p0', scale: 100 };
      const L = Layers.newFill(doc, def);
      bus.emit('layers:change', doc);
      const finish = (ok) => { if (ok) IMG.commit('Nova camada de preenchimento'); else { Layers.remove(doc, L); const all = Layers.all(doc); Layers.setActive(doc, all.length ? all[all.length - 1].id : null); bus.emit('layers:change', doc); } };
      this.editFill(L, finish);
    },
    /** Diálogo de edição de uma camada de preenchimento (também usado pelo clique duplo na miniatura). */
    editFill(L, finish) {
      const doc = IMG.app.doc, UI = IMG.UI, d = L.fillDef, orig = IMG.jclone(d);
      const upd = () => { Layers.renderFill(L, doc); IMG.Engine.invalidate(); };
      let body;
      if (d.type === 'solid') {
        const picker = new IMG.ColorPicker({ color: d.color, onChange: (hex) => { d.color = hex; upd(); } });
        body = [picker.el];
        setTimeout(() => picker.layout(), 0);
      } else if (d.type === 'gradient') {
        const g = IMG.Widgets.gradientBtn(d.gradient, (ng) => { d.gradient = ng; upd(); }, { width: 200 });
        body = [UI.row('Gradiente', g.el),
          UI.row('Estilo', UI.select([['linear', 'Linear'], ['radial', 'Radial'], ['angle', 'Angular'], ['reflected', 'Refletido'], ['diamond', 'Losango']], d.style, (v) => { d.style = v; upd(); }, { keepFocus: true }).el),
          UI.row('Ângulo', IMG.Widgets.angle(d.angle, (v) => { d.angle = v; upd(); }).el),
          UI.slider({ label: 'Escala', value: d.scale, min: 10, max: 150, unit: '%', stack: true, def: 100, onInput: (v) => { d.scale = v; upd(); } }).el,
          UI.row('', UI.check('Inverter', d.reverse, (v) => { d.reverse = v; upd(); }).el, UI.check('Pontilhado', d.dither !== false, (v) => { d.dither = v; upd(); }).el)];
      } else {
        const pb = IMG.Widgets.patternBtn(d.pattern, (v) => { d.pattern = v; upd(); });
        body = [UI.row('Padrão', pb.el), UI.slider({ label: 'Escala', value: d.scale, min: 1, max: 1000, unit: '%', stack: true, def: 100, pow: 2, onInput: (v) => { d.scale = v; upd(); } }).el];
      }
      const T = { solid: 'Seletor de cores (cor sólida)', gradient: 'Preenchimento de gradiente', pattern: 'Preenchimento de padrão' };
      UI.dialog({ title: T[d.type], width: d.type === 'solid' ? 300 : 380, body, clear: true,
        buttons: [{ label: 'Cancelar', onClick: () => { L.fillDef = orig; Layers.renderFill(L, doc); IMG.Engine.invalidate(); if (finish) finish(false); } }, { label: 'OK', primary: true, onClick: () => { if (finish) finish(true); else { bus.emit('layer:pixels', L); IMG.commit('Editar preenchimento'); } } }] });
    },

    /* ---------- Camada › Aparação ---------- */
    matting(kind) {
      const doc = IMG.app.doc;
      const run = (px) => {
        const S = IMG.FXSession.begin({ allowMask: false }); if (!S) return;
        S.runFn((d, w, h) => {
          if (kind === 'defringe') {
            // substitui as cores das bordas semitransparentes pelas cores do interior próximo
            const src = new Uint8ClampedArray(d);
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4; const a = src[i + 3];
              if (a === 0 || a === 255) continue;
              let best = -1, bd = 1e9;
              for (let dy = -px; dy <= px; dy++) for (let dx = -px; dx <= px; dx++) {
                const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
                const j = (yy * w + xx) * 4; if (src[j + 3] < 250) continue;
                const dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = j; }
              }
              if (best >= 0) { d[i] = src[best]; d[i + 1] = src[best + 1]; d[i + 2] = src[best + 2]; }
            }
          } else {
            const m = kind === 'black' ? 0 : 255;
            for (let i = 0; i < d.length; i += 4) {
              const a = d[i + 3] / 255; if (a <= 0 || a >= 1) continue;
              for (let c = 0; c < 3; c++) d[i + c] = U.clamp((d[i + c] - m * (1 - a)) / a, 0, 255);
            }
          }
        });
        S.commit(kind === 'defringe' ? 'Remover franja' : kind === 'black' ? 'Remover fosco preto' : 'Remover fosco branco');
      };
      if (kind !== 'defringe') { run(0); return; }
      let px = 1;
      IMG.UI.dialog({ title: 'Remover franja', width: 300, body: IMG.UI.row('Largura', IMG.UI.num({ value: 1, min: 1, max: 50, unit: 'px', width: 90, onInput: (v) => { px = v; } }).el),
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => run(px) }] });
      void doc;
    },

    /* ---------- Visualizar › Novo layout de guias ---------- */
    guideLayoutDialog() {
      const doc = IMG.app.doc, UI = IMG.UI;
      const o = Object.assign({ cols: true, nc: 8, gw: 0, gutC: 20, rows: false, nr: 4, gutR: 20, margin: false, mt: 20, ml: 20, mb: 20, mr: 20, clear: true }, U.store.get('guideLayout', {}));
      const N = (k, min, max) => UI.num({ value: o[k], min, max, width: 64, onInput: (v) => { o[k] = v; } }).el;
      UI.dialog({
        title: 'Novo layout de guias', width: 400,
        body: [UI.row('', UI.check('Colunas', o.cols, (v) => { o.cols = v; }).el), UI.row('Número', N('nc', 1, 100)), UI.row('Medianiz', N('gutC', 0, 2000)),
          UI.row('', UI.check('Linhas', o.rows, (v) => { o.rows = v; }).el), UI.row('Número', N('nr', 1, 100)), UI.row('Medianiz', N('gutR', 0, 2000)),
          UI.row('', UI.check('Margem', o.margin, (v) => { o.margin = v; }).el), UI.row('Superior / esquerda', N('mt', 0, 5000), N('ml', 0, 5000)), UI.row('Inferior / direita', N('mb', 0, 5000), N('mr', 0, 5000)),
          UI.row('', UI.check('Limpar guias existentes', o.clear, (v) => { o.clear = v; }).el)],
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
          U.store.set('guideLayout', o);
          if (o.clear) doc.guides = { h: [], v: [] };
          const x0 = o.margin ? o.ml : 0, x1 = doc.width - (o.margin ? o.mr : 0), y0 = o.margin ? o.mt : 0, y1 = doc.height - (o.margin ? o.mb : 0);
          if (o.margin) { doc.guides.v.push(x0, x1); doc.guides.h.push(y0, y1); }
          if (o.cols) { const w = (x1 - x0 - o.gutC * (o.nc - 1)) / o.nc; for (let i = 0; i <= o.nc; i++) { const x = x0 + i * (w + o.gutC); if (i > 0 && i < o.nc) { doc.guides.v.push(Math.round(x - o.gutC), Math.round(x)); } else doc.guides.v.push(Math.round(i ? x1 : x0)); } }
          if (o.rows) { const h = (y1 - y0 - o.gutR * (o.nr - 1)) / o.nr; for (let i = 0; i <= o.nr; i++) { const y = y0 + i * (h + o.gutR); if (i > 0 && i < o.nr) { doc.guides.h.push(Math.round(y - o.gutR), Math.round(y)); } else doc.guides.h.push(Math.round(i ? y1 : y0)); } }
          doc.guides.v = Array.from(new Set(doc.guides.v)); doc.guides.h = Array.from(new Set(doc.guides.h));
          IMG.app.prefs.showGuides = true; IMG.commit('Novo layout de guias'); IMG.Engine.requestRender();
        } }]
      });
    },

    strokeDialog() {
      const doc = IMG.app.doc, UI = IMG.UI;
      if (!doc.selection) { UI.toast('Faça uma seleção para contornar.'); return; }
      let width = 4, color = IMG.app.fg, pos = 'center';
      UI.dialog({
        title: 'Contornar seleção', width: 360,
        body: [
          UI.row('Largura', UI.num({ value: width, min: 1, max: 250, unit: 'px', width: 90, onInput: (v) => { width = v; } }).el),
          UI.row('Cor', UI.colorBtn(color, (hex) => { if (hex) color = hex; }).el),
          UI.row('Posição', UI.select([['inside', 'Interna'], ['center', 'Centralizada'], ['outside', 'Externa']], pos, (v) => { pos = v; }, { keepFocus: true }).el)
        ],
        buttons: [{ label: 'Cancelar' }, { label: 'Contornar', primary: true, onClick: () => { this.strokeSelection(doc, width, color, pos); } }]
      });
    },

    strokeSelection(doc, width, color, pos) {
      const L = Layers.paintTarget(doc, { allowMask: false }); if (!L || !doc.selection) return;
      L.ensureCovers(doc.rect);
      const W = doc.width, H = doc.height, sel = doc.selection.canvas;
      const grown = U.cloneCanvas(sel), shrunk = U.cloneCanvas(sel);
      const morph = (c, px) => {
        if (!px) return;
        IMG.blurCanvas(c, Math.abs(px) * 0.6);
        const x = c.getContext('2d'), img = x.getImageData(0, 0, W, H), d = img.data, thr = px > 0 ? 18 : 237;
        for (let i = 3; i < d.length; i += 4) { d[i] = d[i] > thr ? 255 : 0; d[i - 1] = d[i - 2] = d[i - 3] = 255; }
        x.putImageData(img, 0, 0);
      };
      const out = pos === 'inside' ? 0 : pos === 'center' ? width / 2 : width, inn = pos === 'inside' ? width : pos === 'center' ? width / 2 : 0;
      morph(grown, out); morph(shrunk, -inn);
      const g = grown.getContext('2d');
      g.globalCompositeOperation = 'destination-out'; g.drawImage(shrunk, 0, 0);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, W, H);
      const x = L.ctx;
      x.globalCompositeOperation = L.lockAlpha ? 'source-atop' : 'source-over';
      x.drawImage(grown, -L.x, -L.y);
      x.globalCompositeOperation = 'source-over';
      L.markDirty();
      bus.emit('layer:pixels', L);
      IMG.commit('Contornar seleção');
    },

    /** Delete: limpa os pixels selecionados; sem seleção, exclui a(s) camada(s). */
    clear(doc) {
      if (!doc.selection) { if (Layers.deleteSelected(doc)) { bus.emit('layers:change', doc); IMG.commit('Excluir camada'); } return; }
      const L = Layers.paintTarget(doc); if (!L) return;
      if (L.isBg && !(doc.editMask && L.mask)) { this.fill(doc, IMG.app.bg, 1); return; }
      const onMask = !!(doc.editMask && L.mask), surf = onMask ? L.mask : L;
      if (onMask) Layers.maskEnsureCovers(L.mask, doc.rect);
      const x = surf.canvas.getContext('2d');
      x.globalCompositeOperation = 'destination-out';
      x.drawImage(doc.selection.canvas, -surf.x, -surf.y);
      x.globalCompositeOperation = 'source-over';
      IMG.markDirty(surf);
      bus.emit('layer:pixels', L);
      IMG.commit('Limpar seleção');
    }
  });

  /* ==================================================================
     Área de transferência
     ================================================================== */
  const Clip = (IMG.Clipboard = {
    data: null,     // { canvas, x, y, name }

    _grab(doc, merged) {
      const L = doc.active;
      let src;
      if (merged || !L) src = { canvas: IMG.Engine.flatten(doc), x: 0, y: 0 };
      else if (L.type === 'group') src = { canvas: Layers.renderTo([L], doc.rect), x: 0, y: 0 };
      else src = { canvas: L.canvas, x: L.x, y: L.y };
      let out, ox, oy;
      if (doc.selection) {
        const b = doc.selection.bounds;
        const t = U.createCanvas(doc.width, doc.height);
        t.getContext('2d').drawImage(src.canvas, src.x, src.y);
        IMG.Selection.clip(doc, t);
        const ab = IMG.alphaBounds(t);
        if (!ab) return null;
        out = U.createCanvas(ab.w, ab.h); out.getContext('2d').drawImage(t, -ab.x, -ab.y);
        ox = ab.x; oy = ab.y;
        void b;
      } else {
        const ab = IMG.alphaBounds(src.canvas);
        if (!ab) return null;
        out = U.createCanvas(ab.w, ab.h); out.getContext('2d').drawImage(src.canvas, -ab.x, -ab.y);
        ox = src.x + ab.x; oy = src.y + ab.y;
      }
      return { canvas: out, x: ox, y: oy, name: L ? L.name : 'Camada' };
    },

    copy(merged) {
      const doc = IMG.app.doc; if (!doc) return false;
      const d = this._grab(doc, merged);
      if (!d) { IMG.UI.toast('Não há pixels para copiar.'); return false; }
      this.data = d;
      this.stamp = Date.now();
      // tenta também a área de transferência do sistema (pode não estar disponível em file://)
      try {
        if (navigator.clipboard && window.ClipboardItem) {
          const p = U.toBlob(d.canvas, 'image/png');
          navigator.clipboard.write([new ClipboardItem({ 'image/png': p })]).catch(() => {});
        }
      } catch (e) { /* ignore */ }
      IMG.UI.toast(merged ? 'Imagem mesclada copiada.' : 'Copiado.');
      return true;
    },

    cut() {
      const doc = IMG.app.doc; if (!doc) return;
      const L = Layers.paintTarget(doc, { allowMask: false }); if (!L) return;
      if (!this.copy(false)) return;
      if (doc.selection) {
        const x = L.ctx;
        x.globalCompositeOperation = 'destination-out'; x.drawImage(doc.selection.canvas, -L.x, -L.y); x.globalCompositeOperation = 'source-over';
        L.markDirty();
        bus.emit('layer:pixels', L);
      } else { Layers.deleteSelected(doc); bus.emit('layers:change', doc); }
      IMG.commit('Recortar (área de transferência)');
    },

    /** Cola o conteúdo interno como nova camada (centralizado na vista, ou no lugar). */
    paste(inPlace = false) {
      const doc = IMG.app.doc, d = this.data;
      if (!d) { IMG.UI.toast('A área de transferência está vazia. Copie algo primeiro (Ctrl+C).'); return; }
      if (!doc) { IMG.Files.fromCanvas(d.canvas, 'Colado'); return; }
      let x = d.x, y = d.y;
      if (!inPlace && doc.selection && doc.selection.bounds) { const b = doc.selection.bounds; x = Math.round(b.x + (b.w - d.canvas.width) / 2); y = Math.round(b.y + (b.h - d.canvas.height) / 2); }
      this.place(doc, U.cloneCanvas(d.canvas), 'Camada', x, y);
      IMG.commit('Colar');
    },

    /** Colar dentro (outside=false) ou fora da seleção: nova camada com máscara. */
    pasteInto(outside) {
      const doc = IMG.app.doc, d = this.data;
      if (!doc || !doc.selection) return;
      if (!d) { IMG.UI.toast('A área de transferência está vazia.'); return; }
      const b = doc.selection.bounds;
      const L = this.place(doc, U.cloneCanvas(d.canvas), 'Camada', Math.round(b.x + (b.w - d.canvas.width) / 2), Math.round(b.y + (b.h - d.canvas.height) / 2));
      Layers.addMask(doc, L, outside ? 'hideSelection' : 'selection');
      L.mask.linked = false;
      IMG.Selection.clear(doc);
      bus.emit('layers:change', doc);
      IMG.commit(outside ? 'Colar fora' : 'Colar dentro');
    },

    /** Insere um canvas como camada nova (centralizado, se x for nulo). */
    place(doc, canvas, name, x, y) {
      if (x == null) { x = Math.round((doc.width - canvas.width) / 2); y = Math.round((doc.height - canvas.height) / 2); }
      else if (x >= doc.width || y >= doc.height || x + canvas.width <= 0 || y + canvas.height <= 0) { x = Math.round((doc.width - canvas.width) / 2); y = Math.round((doc.height - canvas.height) / 2); }
      const L = Layers.fromCanvas(doc, canvas, Layers.name(doc, name || 'Camada'), x, y);
      bus.emit('layers:change', doc);
      return L;
    },

    /** Cola uma imagem vinda do sistema (evento paste ou botão). */
    async pasteBlob(blob) {
      const url = URL.createObjectURL(blob);
      try {
        const im = await U.loadImage(url);
        const c = U.createCanvas(im.naturalWidth || im.width, im.naturalHeight || im.height);
        c.getContext('2d').drawImage(im, 0, 0);
        const doc = IMG.app.doc;
        if (!doc) IMG.Files.fromCanvas(c, 'Colado');
        else { this.place(doc, c, 'Camada colada'); IMG.commit('Colar imagem'); }
      } finally { URL.revokeObjectURL(url); }
    },

    /** Comando Colar do menu: tenta o sistema; se não houver imagem, usa a cópia interna. */
    async pasteCommand() {
      try {
        if (navigator.clipboard && navigator.clipboard.read && !this.data) {
          const items = await navigator.clipboard.read();
          for (const it of items) {
            const type = it.types.find((t) => t.indexOf('image/') === 0);
            if (type) { await this.pasteBlob(await it.getType(type)); return; }
          }
        }
      } catch (e) { /* sem permissão: usa a cópia interna */ }
      this.paste(true);
    }
  });
  void Clip;

  /* ==================================================================
     Editar › Atenuar (Fade) — mistura o resultado da última operação de
     pixels com o estado anterior, com opacidade e modo de mesclagem.
     ================================================================== */
  function fadeDialog() {
    const doc = IMG.app.doc, UI = IMG.UI, op = IMG.lastPixelOp, h = doc.history;
    const after = h.current, before = h.states[h.index - 1];
    const nA = IMG.findNode(after, op.layerId), nB = IMG.findNode(before, op.layerId);
    const L = Layers.find(doc, op.layerId);
    if (!nA || !nB || !L) { UI.toast('Não é possível atenuar a última operação.'); return; }
    const sA = op.onMask ? nA.mask : nA, sB = op.onMask ? nB.mask : nB;
    if (!sA || !sB || !sA.snap || !sB.snap) { UI.toast('Não é possível atenuar a última operação.'); return; }
    const A = { canvas: null }, B = { canvas: null };
    IMG.restoreSurface(A, sA.snap); IMG.restoreSurface(B, sB.snap);
    const surf = op.onMask ? L.mask : L;
    const ox = (sB.x - sA.x) || 0, oy = (sB.y - sA.y) || 0;
    let opacity = 100, mode = 'normal';
    const apply = () => {
      const c = surf.canvas.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'copy'; c.globalAlpha = 1; c.drawImage(B.canvas, ox, oy);
      c.globalCompositeOperation = 'source-over';
      IMG.Blend.draw(c, A.canvas, 0, 0, mode, opacity / 100);
      IMG.markDirty(surf); IMG.Effects.invalidate(L); IMG.Engine.invalidate();
    };
    UI.dialog({ title: 'Atenuar', width: 360, clear: true,
      body: [UI.slider({ label: 'Opacidade', value: 100, min: 0, max: 100, unit: '%', stack: true, def: 100, onInput: (v) => { opacity = v; apply(); } }).el,
        UI.row('Modo', UI.select(IMG.BLEND_LIST, mode, (v) => { mode = v; apply(); }, { keepFocus: true }).el)],
      buttons: [{ label: 'Cancelar', onClick: () => { h.restore(h.current); } }, { label: 'OK', primary: true, onClick: () => {
        // resultado = antes + (depois × opacidade, no modo escolhido)
        const R = U.createCanvas(A.canvas.width, A.canvas.height), rc = R.getContext('2d');
        rc.drawImage(B.canvas, ox, oy);
        IMG.Blend.draw(rc, A.canvas, 0, 0, mode, opacity / 100);
        h.undo();
        const L2 = Layers.find(doc, op.layerId);
        if (op.onMask) { L2.mask.canvas = R; L2.mask.x = sA.x; L2.mask.y = sA.y; L2.mask._snap = null; IMG.markDirty(L2.mask); }
        else L2.setCanvas(R, sA.x, sA.y);
        bus.emit('layer:pixels', L2); bus.emit('layers:change', doc);
        IMG.commit('Atenuar: ' + op.label);
        IMG.lastPixelOp = null;
      } }] });
  }
  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, h) => {
    C('edit.fade', 'Atenuar…', fadeDialog, { keys: ['ctrl+shift+f'], enabled: () => { const d = h.doc(); return !!(d && IMG.lastPixelOp && d.history.index > 0 && IMG.findNode(d.history.current, IMG.lastPixelOp.layerId)); }, label2: () => (IMG.lastPixelOp ? 'Atenuar ' + IMG.lastPixelOp.label + '…' : null) });
  });
})();