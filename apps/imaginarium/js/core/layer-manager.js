/* ==========================================================================
   Imaginarium — documento, camadas e operações de camadas
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus;

  const MAX_SIDE = 16000;

  /* ------------------------------------------------------------------
     Superfícies (canvas + controle de áreas alteradas para o histórico)
     ------------------------------------------------------------------ */
  function markDirty(s, r) {
    s._ver = (s._ver || 0) + 1;
    s._blank = false;
    if (!r) { s._dirtyAll = true; s._dirty = null; return; }
    if (s._dirtyAll) return;
    s._dirty = U.rectUnion(s._dirty, U.rectInt(r));
  }
  IMG.markDirty = markDirty;

  /** Limites dos pixels não transparentes de um canvas (ou null se vazio). */
  function alphaBounds(canvas) {
    const w = canvas.width, h = canvas.height;
    let data;
    try { data = canvas.getContext('2d').getImageData(0, 0, w, h).data; } catch (e) { return { x: 0, y: 0, w, h }; }
    const d = new Uint32Array(data.buffer);
    let top = -1, bottom = -1, left = w, right = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let x = 0;
      for (; x < w; x++) if (d[row + x] >>> 24) break;
      if (x === w) continue;
      if (top < 0) top = y;
      bottom = y;
      if (x < left) left = x;
      let x2 = w - 1;
      for (; x2 > right; x2--) if (d[row + x2] >>> 24) break;
      if (x2 > right) right = x2;
    }
    if (top < 0) return null;
    return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
  }
  IMG.alphaBounds = alphaBounds;

  /* ------------------------------------------------------------------
     Camada
     ------------------------------------------------------------------ */
  // [Nebulosa] idiomas (0.6): nomes padrão (Fundo, Camada 1, Sem título…) nascem no idioma escolhido
  const nbT = (t) => (window.NebulosaIdiomas ? window.NebulosaIdiomas.t(t) : t);
  const NB_PADRAO = /^(Fundo|Camada|Texto|Sem título|Grupo|Forma|Prancheta|Cor sólida|Gradiente|Padrão)( \d+|-\d+)?$/;
  const nbNome = (n) => (NB_PADRAO.test(n) ? nbT(n) : n);
  class Layer {
    constructor(type, o = {}) {
      this.id = o.id || U.uid('L');
      this.type = type;                 // raster | text | shape | group | adjust | fill | smart
      this.name = nbNome(o.name || 'Camada');
      this.visible = true;
      this.opacity = 1;
      this.fill = 1;
      this.blend = type === 'group' ? 'pass' : 'normal';
      this.locked = false;              // bloqueio total
      this.lockAlpha = false;           // preservar transparência
      this.lockPaint = false;           // bloquear pixels da imagem
      this.lockPos = false;             // bloquear posição
      this.clip = false;                // máscara de recorte (recorta na camada de baixo)
      this.isBg = false;                // camada "Fundo"
      this.fx = null;                   // estilos de camada
      this.adv = null;                  // opções de mesclagem avançadas (Mesclar se, canais)
      this.adj = null;                  // camada de ajuste: { kind, ... }
      this.fillDef = null;              // camada de preenchimento: { type: solid|gradient|pattern, ... }
      this.smart = null;                // objeto inteligente
      this.vmask = null;                // máscara vetorial
      this.color = null;                // cor de identificação no painel
      this.link = null;                 // id do vínculo entre camadas
      this.x = o.x || 0;
      this.y = o.y || 0;
      this.canvas = null;
      this.mask = null;                 // { canvas, x, y, enabled, linked }
      this.parent = null;
      this.children = type === 'group' ? [] : null;
      this.expanded = true;
      this.text = null;
      this.shape = null;
      this._snap = null; this._dirty = null; this._dirtyAll = true; this._blank = false; this._ver = 0;
      if (type !== 'group' && type !== 'adjust') {
        if (o.canvas) this.canvas = o.canvas;
        else { this.canvas = U.createCanvas(o.width || 1, o.height || 1); this._blank = true; }
      }
    }
    get ctx() { return this.canvas.getContext('2d'); }
    rect() { return this.canvas ? { x: this.x, y: this.y, w: this.canvas.width, h: this.canvas.height } : { x: 0, y: 0, w: 0, h: 0 }; }
    get isGroup() { return this.type === 'group'; }
    get isPixel() { return this.type === 'raster'; }
    markDirty(r) { markDirty(this, r); }
    setCanvas(c, x, y) {
      this.canvas = c;
      if (x != null) { this.x = x; this.y = y; }
      this._snap = null; this._dirtyAll = true; this._dirty = null; this._blank = false; this._ver++;
    }
    /** Move a camada (e tudo o que estiver vinculado a ela). */
    translate(dx, dy) {
      if (!dx && !dy) return;
      if (this.type === 'group') { this.children.forEach((c) => c.translate(dx, dy)); if (this.artboard) { this.artboard.x += dx; this.artboard.y += dy; } }
      else if (this.type !== 'adjust') { this.x += dx; this.y += dy; }
      if (this.mask && this.mask.linked !== false) { this.mask.x += dx; this.mask.y += dy; }
      if (this.vmask && this.vmask.linked !== false && IMG.Paths) IMG.Paths.translateMask(this.vmask, dx, dy);
      if (this.text) { this.text.x += dx; this.text.y += dy; if (this.text.box) { this.text.box.x += dx; this.text.box.y += dy; } }
      if (this.shape) { if (IMG.Shapes && IMG.Shapes.translate) IMG.Shapes.translate(this.shape, dx, dy); else { this.shape.cx += dx; this.shape.cy += dy; } }
      if (this.smart && IMG.Smart) IMG.Smart.translate(this, dx, dy);
      if (this.fillDef && this.fillDef.type !== 'solid') { this.fillDef.offX = (this.fillDef.offX || 0) + dx; this.fillDef.offY = (this.fillDef.offY || 0) + dy; }
    }
    /** Garante que o canvas da camada cubra o retângulo informado (coordenadas do documento). */
    ensureCovers(r) {
      const cur = this.rect();
      r = U.rectInt(r);
      if (cur.x <= r.x && cur.y <= r.y && cur.x + cur.w >= r.x + r.w && cur.y + cur.h >= r.y + r.h) return;
      let u = U.rectUnion(cur, r);
      if (u.w > MAX_SIDE || u.h > MAX_SIDE) u = r;
      const c = U.createCanvas(u.w, u.h);
      c.getContext('2d').drawImage(this.canvas, cur.x - u.x, cur.y - u.y);
      const wasBlank = this._blank;
      this.setCanvas(c, u.x, u.y);
      this._blank = wasBlank;
    }
    /** Limites do conteúdo visível, em coordenadas do documento. */
    contentBounds() {
      if (this.type === 'group') {
        if (this.artboard) return { x: this.artboard.x, y: this.artboard.y, w: this.artboard.w, h: this.artboard.h };
        let r = null;
        for (const c of this.children) if (c.visible) r = U.rectUnion(r, c.contentBounds());
        return r;
      }
      if (this.type === 'adjust' || !this.canvas) return null;
      if (this._bVer !== this._ver) { this._b = this._blank ? null : alphaBounds(this.canvas); this._bVer = this._ver; }
      return this._b ? { x: this._b.x + this.x, y: this._b.y + this.y, w: this._b.w, h: this._b.h } : null;
    }
  }
  IMG.Layer = Layer;

  /* propriedades simples e estruturadas (para clonar, histórico e arquivos) */
  IMG.LAYER_PROPS = ['type', 'name', 'visible', 'opacity', 'fill', 'blend', 'locked', 'lockAlpha', 'lockPaint', 'lockPos', 'clip', 'isBg', 'x', 'y', 'expanded', 'color', 'link'];
  IMG.LAYER_JPROPS = ['text', 'shape', 'fx', 'adj', 'fillDef', 'vmask', 'adv', 'artboard'];
  const jclone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));
  IMG.jclone = jclone;
  IMG.copyLayerProps = function (dst, src) {
    for (const k of IMG.LAYER_PROPS) if (k in src) dst[k] = src[k];
    for (const k of IMG.LAYER_JPROPS) dst[k] = jclone(src[k]);
    return dst;
  };
  /** Objeto inteligente: a imagem de origem é imutável (pode ser compartilhada). */
  IMG.cloneSmart = function (sm) {
    if (!sm) return null;
    const o = jclone(Object.assign({}, sm, { src: null, docData: null }));
    o.src = sm.src; o.docData = sm.docData || null;
    return o;
  };

  /* ------------------------------------------------------------------
     Documento
     ------------------------------------------------------------------ */
  class Doc {
    constructor(o = {}) {
      this.id = U.uid('D');
      this.name = nbNome(o.name || 'Sem título');
      this.width = Math.max(1, Math.round(o.width || 1280));
      this.height = Math.max(1, Math.round(o.height || 720));
      this.layers = [];                 // índice 0 = camada de baixo
      this.activeId = null;
      this.selected = new Set();
      this.selection = null;            // { canvas, path, bounds }
      this.guides = { h: [], v: [] };
      this.view = { zoom: 1, x: 0, y: 0, rot: 0, ready: false };
      this.editMask = false;
      this.globalAngle = 120;            // luz global (estilos de camada)
      this.globalAltitude = 30;
      this.paths = [];                   // demarcadores salvos e demarcador de trabalho
      this.channels = [];                // canais alfa (seleções salvas)
      this.mode = 'rgb';
      this.dpi = o.dpi || 72;
      this.counter = 0;
      this.fileHandle = null;
      this.savedState = null;
      this.history = new IMG.History(this);
    }
    get rect() { return { x: 0, y: 0, w: this.width, h: this.height }; }
    get active() { return this.activeId ? Layers.find(this, this.activeId) : null; }
    get dirty() { return this.history.current !== this.savedState; }
  }
  IMG.Doc = Doc;

  /* ------------------------------------------------------------------
     Operações
     ------------------------------------------------------------------ */
  const Layers = (IMG.Layers = {
    alphaBounds,

    walk(list, fn, parent = null, depth = 0) {
      for (const L of list.slice()) {
        fn(L, parent, depth);
        if (L.children) this.walk(L.children, fn, L, depth + 1);
      }
    },
    find(doc, id) {
      let found = null;
      const rec = (list) => { for (const L of list) { if (L.id === id) { found = L; return true; } if (L.children && rec(L.children)) return true; } return false; };
      rec(doc.layers);
      return found;
    },
    all(doc) { const out = []; this.walk(doc.layers, (L) => out.push(L)); return out; },
    siblings(doc, L) { return L.parent ? L.parent.children : doc.layers; },
    isVisible(L) { for (let p = L; p; p = p.parent) if (!p.visible) return false; return true; },
    isLocked(L) { for (let p = L; p; p = p.parent) if (p.locked) return true; return false; },
    hasAncestor(L, G) { for (let p = L.parent; p; p = p.parent) if (p === G) return true; return false; },

    /** Próximo nome livre para uma camada: "Camada 2", "Retângulo 1"... */
    name(doc, base) {
      base = nbNome(base);
      let max = 0;
      const prefix = base + ' ';
      this.walk(doc.layers, (L) => {
        if (L.name === base) max = Math.max(max, 1);
        else if (L.name.indexOf(prefix) === 0) { const n = parseInt(L.name.slice(prefix.length), 10); if (n > 0 && String(n) === L.name.slice(prefix.length)) max = Math.max(max, n); }
      });
      return base + ' ' + (max + 1);
    },

    /** Camadas selecionadas (de baixo para cima), sem descendentes de grupos já selecionados. */
    selectedLayers(doc) {
      const out = [];
      this.walk(doc.layers, (L) => {
        if (!doc.selected.has(L.id)) return;
        for (let p = L.parent; p; p = p.parent) if (doc.selected.has(p.id)) return;
        out.push(L);
      });
      if (!out.length && doc.active) out.push(doc.active);
      return out;
    },

    setActive(doc, id, mode) {
      const L = id ? this.find(doc, id) : null;
      if (!L) { doc.activeId = null; doc.selected.clear(); doc.editMask = false; bus.emit('layers:select'); return; }
      if (mode === 'toggle') {
        if (doc.selected.has(id) && doc.selected.size > 1) {
          doc.selected.delete(id);
          if (doc.activeId === id) doc.activeId = Array.from(doc.selected).pop();
        } else { doc.selected.add(id); doc.activeId = id; }
      } else if (mode === 'range' && doc.activeId) {
        const order = this.all(doc).map((l) => l.id);
        let a = order.indexOf(doc.activeId), b = order.indexOf(id);
        if (a > b) { const t = a; a = b; b = t; }
        for (let i = a; i <= b; i++) doc.selected.add(order[i]);
        doc.activeId = id;
      } else {
        doc.selected = new Set([id]);
        if (doc.activeId !== id) doc.editMask = false;
        doc.activeId = id;
      }
      bus.emit('layers:select');
    },

    /** Insere uma camada. Por padrão, logo acima da camada ativa. */
    add(doc, L, opts = {}) {
      let list = doc.layers, index = list.length, parent = null;
      if (opts.parent !== undefined || opts.index !== undefined) {
        parent = opts.parent || null;
        list = parent ? parent.children : doc.layers;
        index = opts.index == null ? list.length : U.clamp(opts.index, 0, list.length);
      } else {
        const act = doc.active;
        if (act) {
          if (act.type === 'group' && act.expanded && !opts.outside) { parent = act; list = act.children; index = list.length; }
          else { parent = act.parent; list = this.siblings(doc, act); index = list.indexOf(act) + 1; }
        }
      }
      L.parent = parent;
      list.splice(index, 0, L);
      if (opts.select !== false) { doc.activeId = L.id; doc.selected = new Set([L.id]); doc.editMask = false; }
      return L;
    },

    remove(doc, L) {
      const list = this.siblings(doc, L);
      const i = list.indexOf(L);
      if (i >= 0) list.splice(i, 1);
      L.parent = null;
      return i;
    },

    newRaster(doc, o = {}) {
      const L = new Layer('raster', { name: o.name || this.name(doc, 'Camada'), width: doc.width, height: doc.height });
      if (o.fill) { const c = L.ctx; c.fillStyle = o.fill; c.fillRect(0, 0, doc.width, doc.height); L._blank = false; }
      return this.add(doc, L, o);
    },

    fromCanvas(doc, canvas, name, x = 0, y = 0, o = {}) {
      const L = new Layer('raster', { name: name || this.name(doc, 'Camada'), canvas, x, y });
      return this.add(doc, L, o);
    },

    newGroup(doc, o = {}) {
      const G = new Layer('group', { name: o.name || this.name(doc, 'Grupo') });
      return this.add(doc, G, Object.assign({ outside: true }, o));
    },

    clone(L, suffix) {
      if (suffix === ' cópia') suffix = ' ' + nbT('cópia');
      const C = new Layer(L.type, { name: L.name + (suffix || ''), canvas: L.canvas ? U.cloneCanvas(L.canvas) : undefined, x: L.x, y: L.y });
      IMG.copyLayerProps(C, L);
      C.name = L.name + (suffix || '');
      C.isBg = false;
      if (L.smart) C.smart = IMG.cloneSmart(L.smart);
      if (L.mask) C.mask = this.makeMask(U.cloneCanvas(L.mask.canvas), L.mask.x, L.mask.y, L.mask.bg, L.mask);
      if (L.children) C.children = L.children.map((ch) => { const cc = this.clone(ch); cc.parent = C; return cc; });
      return C;
    },

    /** Cria o objeto de máscara de camada. bg = valor fora da área armazenada (255 = revela). */
    makeMask(canvas, x, y, bg, from) {
      return {
        canvas, x, y, enabled: from ? from.enabled !== false : true, linked: from ? from.linked !== false : true,
        bg: bg == null ? 255 : bg, density: from && from.density != null ? from.density : 100, feather: from ? from.feather || 0 : 0,
        _snap: null, _dirty: null, _dirtyAll: true, _blank: false, _ver: 1
      };
    },

    /* ---------- camadas de ajuste e de preenchimento ---------- */
    newAdjust(doc, adj, name) {
      const L = new Layer('adjust', { name: name || this.name(doc, (IMG.Adjust && IMG.Adjust.label(adj.kind)) || 'Ajuste') });
      L.adj = adj;
      this.add(doc, L, { outside: true });
      this.addMask(doc, L, doc.selection ? 'selection' : 'reveal');
      return L;
    },
    newFill(doc, def, name) {
      const N = { solid: 'Preenchimento de cor', gradient: 'Preenchimento de gradiente', pattern: 'Preenchimento de padrão' };
      const L = new Layer('fill', { name: name || this.name(doc, N[def.type] || 'Preenchimento'), width: doc.width, height: doc.height });
      L.fillDef = def;
      this.renderFill(L, doc);
      this.add(doc, L, { outside: true });
      this.addMask(doc, L, doc.selection ? 'selection' : 'reveal');
      return L;
    },
    /** Gera os pixels de uma camada de preenchimento cobrindo o documento. */
    renderFill(L, doc) {
      const d = L.fillDef; if (!d) return;
      const W = doc.width, H = doc.height;
      const c = U.createCanvas(W, H), ctx = c.getContext('2d');
      if (d.type === 'gradient') {
        const rect = { x: 0, y: 0, w: W, h: H };
        const pts = IMG.Gradients.pointsFor(rect, d.angle == null ? 90 : d.angle, d.scale || 100, d.style || 'linear', 0, 0);
        const ox = d.offX || 0, oy = d.offY || 0;
        pts.p0.x += ox; pts.p1.x += ox; pts.p0.y += oy; pts.p1.y += oy;
        const img = ctx.createImageData(W, H);
        IMG.Gradients.paint(img, d.gradient || IMG.Gradients.def(), d.style || 'linear', pts.p0, pts.p1, { reverse: d.reverse, dither: d.dither !== false });
        ctx.putImageData(img, 0, 0);
      } else if (d.type === 'pattern') {
        IMG.Patterns.fill(ctx, d.pattern, W, H, d.scale || 100, d.offX || 0, d.offY || 0);
      } else {
        ctx.fillStyle = d.color || '#000000'; ctx.fillRect(0, 0, W, H);
      }
      L.setCanvas(c, 0, 0);
    },

    /** Liga/desliga a máscara de recorte da camada. */
    toggleClip(doc, L, on) {
      if (!L) return false;
      const list = this.siblings(doc, L);
      if (on === undefined) on = !L.clip;
      if (on && list.indexOf(L) <= 0) return false;
      if (L.isBg) return false;
      L.clip = on;
      return true;
    },
    /** Base de recorte (camada não recortada logo abaixo). */
    clipBase(doc, L) {
      if (!L || !L.clip) return null;
      const list = this.siblings(doc, L);
      for (let i = list.indexOf(L) - 1; i >= 0; i--) if (!list[i].clip) return list[i];
      return null;
    },

    /** Converte a camada Fundo em camada normal. */
    fromBackground(doc, L, name) {
      if (!L || !L.isBg) return false;
      L.isBg = false; L.lockPos = false; L.lockAlpha = false; L.locked = false;
      L.name = name || 'Camada 0';
      return true;
    },
    /** Torna uma camada o Fundo (Camada › Novo › Fundo a partir da camada). */
    toBackground(doc, L) {
      if (!L || L.type !== 'raster' || doc.layers.some((q) => q.isBg)) return false;
      this.remove(doc, L);
      const c = U.createCanvas(doc.width, doc.height), x = c.getContext('2d');
      x.fillStyle = IMG.app.bg; x.fillRect(0, 0, doc.width, doc.height);
      x.drawImage(L.canvas, L.x, L.y);
      L.setCanvas(c, 0, 0);
      L.parent = null; doc.layers.unshift(L);
      L.isBg = true; L.lockPos = true; L.lockAlpha = true; L.name = 'Fundo'; L.opacity = 1; L.fill = 1; L.blend = 'normal'; L.clip = false; L.mask = null; L.fx = null;
      return true;
    },

    duplicate(doc) {
      const sel = this.selectedLayers(doc);
      if (!sel.length) return null;
      const ids = [];
      for (const L of sel) {
        const C = this.clone(L, ' cópia');
        const list = this.siblings(doc, L);
        C.parent = L.parent;
        list.splice(list.indexOf(L) + 1, 0, C);
        ids.push(C.id);
      }
      doc.selected = new Set(ids); doc.activeId = ids[ids.length - 1]; doc.editMask = false;
      return ids;
    },

    deleteSelected(doc) {
      const sel = this.selectedLayers(doc);
      if (!sel.length) return false;
      const flat = this.all(doc).map((l) => l.id);
      let next = null;
      const firstIdx = flat.indexOf(sel[0].id);
      for (const L of sel) this.remove(doc, L);
      const remaining = this.all(doc);
      if (remaining.length) {
        const below = flat.slice(0, firstIdx).reverse().find((id) => this.find(doc, id));
        next = below || remaining[remaining.length - 1].id;
        const nl = this.find(doc, next);
        next = nl ? nl.id : remaining[0].id;
      }
      doc.activeId = next; doc.selected = new Set(next ? [next] : []); doc.editMask = false;
      return true;
    },

    /** Move uma camada para outra posição (pai + índice) na árvore. */
    move(doc, L, parent, index) {
      if (parent && (parent === L || this.hasAncestor(parent, L))) return false;
      const from = this.siblings(doc, L);
      const fi = from.indexOf(L);
      const to = parent ? parent.children : doc.layers;
      if (from === to && fi < index) index--;
      from.splice(fi, 1);
      L.parent = parent || null;
      to.splice(U.clamp(index, 0, to.length), 0, L);
      return true;
    },

    group(doc) {
      const sel = this.selectedLayers(doc);
      if (!sel.length) return null;
      const top = sel[sel.length - 1];
      const parent = top.parent;
      const G = new Layer('group', { name: this.name(doc, 'Grupo') });
      const list = this.siblings(doc, top);
      G.parent = parent;
      list.splice(list.indexOf(top) + 1, 0, G);
      for (const L of sel) { this.remove(doc, L); L.parent = G; G.children.push(L); }
      doc.activeId = G.id; doc.selected = new Set([G.id]);
      return G;
    },

    ungroup(doc, G) {
      if (!G || G.type !== 'group') return false;
      const list = this.siblings(doc, G);
      const i = list.indexOf(G);
      const kids = G.children.slice();
      list.splice(i, 1, ...kids);
      kids.forEach((k) => { k.parent = G.parent; });
      doc.selected = new Set(kids.map((k) => k.id));
      doc.activeId = kids.length ? kids[kids.length - 1].id : (list[i - 1] || list[0] || {}).id || null;
      return true;
    },

    /** Renderiza um conjunto de camadas em um canvas cobrindo o retângulo R. */
    renderTo(layers, R) {
      const c = U.createCanvas(R.w, R.h);
      IMG.Engine.drawList(c.getContext('2d'), layers, R, 8);
      return c;
    },

    boundsOf(layers, base) {
      let r = base ? { ...base } : null;
      const add = (L) => { if (L.type === 'group') L.children.forEach(add); else r = U.rectUnion(r, L.rect()); };
      layers.forEach(add);
      if (r && (r.w > MAX_SIDE || r.h > MAX_SIDE) && base) r = { ...base };
      return r;
    },

    merge(doc, layers, name) {
      layers = layers.filter(Boolean);
      if (!layers.length) return null;
      const order = this.all(doc);
      layers.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      const top = layers[layers.length - 1];
      const R = this.boundsOf(layers, doc.rect);
      const canvas = this.renderTo(layers, R);
      const M = new Layer('raster', { name: name || top.name, canvas, x: R.x, y: R.y });
      const list = this.siblings(doc, top);
      M.parent = top.parent;
      list.splice(list.indexOf(top) + 1, 0, M);
      layers.forEach((L) => this.remove(doc, L));
      doc.activeId = M.id; doc.selected = new Set([M.id]); doc.editMask = false;
      return M;
    },

    mergeDown(doc) {
      const L = doc.active;
      if (!L) return null;
      const list = this.siblings(doc, L);
      const i = list.indexOf(L);
      if (i <= 0) return null;
      const below = list[i - 1];
      return this.merge(doc, [below, L], below.name);
    },

    mergeVisible(doc) {
      const vis = doc.layers.filter((L) => L.visible);
      if (vis.length < 1) return null;
      return this.merge(doc, vis, vis[0].name);
    },

    flatten(doc) {
      const vis = doc.layers.filter((L) => L.visible);
      const R = doc.rect;
      const canvas = U.createCanvas(R.w, R.h), cx = canvas.getContext('2d');
      cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, R.w, R.h);
      cx.drawImage(this.renderTo(vis, R), 0, 0);
      doc.layers = [];
      const M = new Layer('raster', { name: 'Fundo', canvas, x: 0, y: 0 });
      M.isBg = true; M.lockPos = true; M.lockAlpha = true;
      doc.layers.push(M);
      doc.activeId = M.id; doc.selected = new Set([M.id]); doc.editMask = false;
      return M;
    },

    rasterize(doc, L) {
      if (!L) return false;
      if (L.type === 'group') { const list = this.siblings(doc, L); if (list.indexOf(L) < 0) return false; doc.activeId = L.id; doc.selected = new Set([L.id]); return !!this.merge(doc, [L], L.name); }
      if (L.type === 'raster' || L.type === 'adjust') return false;
      L.type = 'raster'; L.text = null; L.shape = null; L.fillDef = null; L.smart = null; L._ver++;
      return true;
    },

    /* ---------- máscaras ---------- */
    addMask(doc, L, mode = 'reveal') {
      if (!L || L.mask) return false;
      const R = U.rectInt(L.type === 'adjust' || L.type === 'group' ? doc.rect : this.boundsOf([L], doc.rect));
      const c = U.createCanvas(R.w, R.h), ctx = c.getContext('2d');
      let bg = 255;
      if ((mode === 'selection' || mode === 'hideSelection') && doc.selection) {
        ctx.drawImage(doc.selection.canvas, -R.x, -R.y);
        bg = 0;
        if (mode === 'hideSelection') { ctx.globalCompositeOperation = 'xor'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, R.w, R.h); ctx.globalCompositeOperation = 'source-over'; bg = 255; }
      } else if (mode === 'transparency' && L.canvas) {
        ctx.drawImage(L.canvas, L.x - R.x, L.y - R.y);
        ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, R.w, R.h); ctx.globalCompositeOperation = 'source-over';
        bg = 0;
      } else if (mode === 'hide') {
        bg = 0;
      } else {
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, R.w, R.h);
      }
      L.mask = this.makeMask(c, R.x, R.y, bg);
      return true;
    },
    deleteMask(doc, L) { if (!L || !L.mask) return false; L.mask = null; doc.editMask = false; return true; },
    applyMask(doc, L) {
      if (!L || !L.mask) return false;
      if (L.type === 'group') return false;
      if (L.type !== 'raster') this.rasterize(doc, L);
      const ctx = L.ctx;
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(L.mask.canvas, L.mask.x - L.x, L.mask.y - L.y);
      ctx.globalCompositeOperation = 'source-over';
      L.markDirty();
      L.mask = null; doc.editMask = false;
      return true;
    },
    /** Desabilita/habilita a máscara. */
    toggleMask(doc, L) { if (!L || !L.mask) return false; L.mask.enabled = !L.mask.enabled; L.mask._ver = (L.mask._ver || 0) + 1; return true; },
    invertMask(doc, L) {
      if (!L || !L.mask) return false;
      const m = L.mask, ctx = m.canvas.getContext('2d');
      ctx.globalCompositeOperation = 'xor';
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, m.canvas.width, m.canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      m.bg = m.bg === 0 ? 255 : 0;
      markDirty(m);
      return true;
    },
    /** Amplia a máscara para cobrir o retângulo (área nova = revelada). */
    maskEnsureCovers(m, r) {
      const cur = { x: m.x, y: m.y, w: m.canvas.width, h: m.canvas.height };
      r = U.rectInt(r);
      if (cur.x <= r.x && cur.y <= r.y && cur.x + cur.w >= r.x + r.w && cur.y + cur.h >= r.y + r.h) return;
      const u = U.rectUnion(cur, r);
      const c = U.createCanvas(u.w, u.h), ctx = c.getContext('2d');
      if (m.bg !== 0) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, u.w, u.h); ctx.clearRect(cur.x - u.x, cur.y - u.y, cur.w, cur.h); }
      ctx.drawImage(m.canvas, cur.x - u.x, cur.y - u.y);
      m.canvas = c; m.x = u.x; m.y = u.y; m._snap = null; markDirty(m);
    },

    /**
     * Retorna a camada ativa se ela puder receber pintura/edição de pixels.
     * Caso contrário, informa o motivo ao usuário e retorna null.
     */
    paintTarget(doc, o = {}) {
      const UI = IMG.UI;
      const L = doc && doc.active;
      if (!L) { UI.toast('Selecione uma camada para editar.'); return null; }
      if (!this.isVisible(L)) { UI.toast('A camada ativa está oculta.'); return null; }
      if (this.isLocked(L)) { UI.toast('A camada ativa está bloqueada.'); return null; }
      if (doc.editMask && L.mask && o.allowMask !== false) return L;
      if ((L.type === 'adjust' || L.type === 'fill') && L.mask && o.allowMask !== false) { doc.editMask = true; bus.emit('layers:select'); return L; }
      if (L.type === 'group') { UI.toast('Selecione uma camada dentro do grupo.'); return null; }
      if (L.lockPaint) { UI.toast('Os pixels desta camada estão bloqueados.'); return null; }
      if (L.type !== 'raster') {
        const T = { text: 'texto', shape: 'forma', adjust: 'ajuste', fill: 'preenchimento', smart: 'objeto inteligente' };
        UI.toast('Esta é uma camada de ' + (T[L.type] || L.type) + '. Use Camada › Rasterizar para editar os pixels.');
        return null;
      }
      return L;
    },

    /** Camada mais acima que possui pixel visível na posição do documento. */
    pick(doc, x, y) {
      let hit = null;
      const test = (list) => {
        for (let i = list.length - 1; i >= 0 && !hit; i--) {
          const L = list[i];
          if (!L.visible) continue;
          if (L.type === 'group') { test(L.children); continue; }
          if (L.type === 'adjust' || !L.canvas) continue;
          const lx = Math.floor(x - L.x), ly = Math.floor(y - L.y);
          if (lx < 0 || ly < 0 || lx >= L.canvas.width || ly >= L.canvas.height) continue;
          try { if (L.ctx.getImageData(lx, ly, 1, 1).data[3] > 8) hit = L; } catch (e) { /* ignore */ }
        }
      };
      test(doc.layers);
      return hit;
    }
  });
})();
