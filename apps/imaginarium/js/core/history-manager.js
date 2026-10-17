/* ==========================================================================
   Imaginarium — histórico (desfazer / refazer)
   Cada estado guarda a árvore de camadas + instantâneos dos pixels divididos
   em blocos de 256 px. Blocos não alterados são compartilhados entre estados,
   de modo que 100+ operações cabem na memória mesmo em imagens grandes.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus;
  const TILE = 256;

  function copyTile(src, tx, ty, w, h) {
    const tw = Math.min(TILE, w - tx * TILE), th = Math.min(TILE, h - ty * TILE);
    const c = U.createCanvas(tw, th);
    c.getContext('2d').drawImage(src, -tx * TILE, -ty * TILE);
    return c;
  }

  /** Captura (ou reaproveita) o instantâneo de uma superfície {canvas,_snap,_dirty,_dirtyAll,_blank}. */
  function snapSurface(s) {
    const c = s.canvas, w = c.width, h = c.height;
    const prev = s._snap;
    const cols = Math.ceil(w / TILE), rows = Math.ceil(h / TILE);
    let snap;
    if (prev && prev.w === w && prev.h === h && !s._dirtyAll) {
      if (!s._dirty) return prev;
      snap = { w, h, cols, rows, tiles: prev.tiles.slice() };
      const d = s._dirty;
      const x0 = U.clamp(Math.floor(d.x / TILE), 0, cols - 1), x1 = U.clamp(Math.floor((d.x + d.w - 1) / TILE), 0, cols - 1);
      const y0 = U.clamp(Math.floor(d.y / TILE), 0, rows - 1), y1 = U.clamp(Math.floor((d.y + d.h - 1) / TILE), 0, rows - 1);
      if (d.x < w && d.y < h && d.x + d.w > 0 && d.y + d.h > 0) {
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) snap.tiles[ty * cols + tx] = copyTile(c, tx, ty, w, h);
      }
    } else {
      snap = { w, h, cols, rows, tiles: new Array(cols * rows).fill(null) };
      if (!s._blank) {
        for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) snap.tiles[ty * cols + tx] = copyTile(c, tx, ty, w, h);
      }
    }
    s._snap = snap; s._dirty = null; s._dirtyAll = false;
    return snap;
  }

  /** Restaura uma superfície a partir de um instantâneo, redesenhando só os blocos diferentes. */
  function restoreSurface(s, snap) {
    if (!s.canvas) s.canvas = U.createCanvas(snap.w, snap.h);
    const c = s.canvas;
    const cur = s._snap;
    const clean = cur && !s._dirty && !s._dirtyAll && cur.w === snap.w && cur.h === snap.h && c.width === snap.w && c.height === snap.h;
    if (cur === snap && clean) return;
    if (c.width !== snap.w || c.height !== snap.h) { c.width = snap.w; c.height = snap.h; }
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    let blank = true;
    for (let ty = 0; ty < snap.rows; ty++) {
      for (let tx = 0; tx < snap.cols; tx++) {
        const i = ty * snap.cols + tx, t = snap.tiles[i];
        if (t) blank = false;
        if (clean && cur.tiles[i] === t) continue;
        ctx.clearRect(tx * TILE, ty * TILE, TILE, TILE);
        if (t) ctx.drawImage(t, tx * TILE, ty * TILE);
      }
    }
    s._snap = snap; s._dirty = null; s._dirtyAll = false; s._blank = blank;
    s._ver = (s._ver || 0) + 1;
  }

  function capNode(L) {
    const n = { id: L.id };
    for (const k of IMG.LAYER_PROPS) n[k] = L[k];
    for (const k of IMG.LAYER_JPROPS) n[k] = L[k] ? IMG.jclone(L[k]) : null;
    n.smart = L.smart ? IMG.cloneSmart(L.smart) : null;
    if (L.type === 'group') n.children = L.children.map(capNode);
    else if (L.canvas) n.snap = snapSurface(L);
    if (L.mask) n.mask = { x: L.mask.x, y: L.mask.y, enabled: L.mask.enabled, linked: L.mask.linked, bg: L.mask.bg, density: L.mask.density, feather: L.mask.feather, snap: snapSurface(L.mask) };
    return n;
  }

  class History {
    constructor(doc) {
      this.doc = doc;
      this.states = [];
      this.index = -1;
    }
    get current() { return this.states[this.index] || null; }
    get max() { const p = IMG.app && IMG.app.prefs ? IMG.app.prefs.historyMax | 0 : 0; return Math.max(100, p || 120); }
    get canUndo() { return this.index > 0; }
    get canRedo() { return this.index < this.states.length - 1; }

    capture(name) {
      const doc = this.doc;
      const sel = doc.selection;
      return {
        name,
        time: Date.now(),
        width: doc.width, height: doc.height,
        activeId: doc.activeId,
        selected: Array.from(doc.selected),
        guides: { h: doc.guides.h.slice(), v: doc.guides.v.slice() },
        tree: doc.layers.map(capNode),
        globalAngle: doc.globalAngle, globalAltitude: doc.globalAltitude,
        paths: IMG.jclone(doc.paths || []),
        slices: IMG.jclone(doc.slices || []),
        channels: (doc.channels || []).map((c) => ({ id: c.id, name: c.name, color: c.color, opacity: c.opacity, inverted: c.inverted, snap: snapSurface(c) })),
        mode: doc.mode,
        quickMask: !!doc.quickMask,
        selection: sel ? { snap: snapSurface(sel), path: sel.path, bounds: sel.bounds ? { ...sel.bounds } : null } : null
      };
    }

    /** Registra o estado atual do documento como um novo passo. */
    commit(name) {
      const st = this.capture(name || 'Edição');
      this.states.length = this.index + 1;
      this.states.push(st);
      const max = this.max;
      if (this.states.length > max) this.states.splice(0, this.states.length - max);
      this.index = this.states.length - 1;
      bus.emit('history:change', this.doc);
      return st;
    }

    reset(name) {
      this.states = []; this.index = -1;
      const st = this.commit(name || 'Abrir');
      this.doc.savedState = st;
      return st;
    }

    clear() {
      const cur = this.current;
      this.states = cur ? [cur] : [];
      this.index = this.states.length - 1;
      bus.emit('history:change', this.doc);
    }

    undo() { if (this.canUndo) this.goto(this.index - 1); }
    redo() { if (this.canRedo) this.goto(this.index + 1); }

    goto(i) {
      if (i < 0 || i >= this.states.length || i === this.index) return;
      this.index = i;
      this.restore(this.states[i]);
    }

    restore(st) {
      const doc = this.doc;
      const old = new Map();
      IMG.Layers.walk(doc.layers, (L) => old.set(L.id, L));
      const sized = doc.width !== st.width || doc.height !== st.height;

      const build = (n, parent) => {
        let L = old.get(n.id);
        const isGroup = n.type === 'group';
        if (!L || (L.type === 'group') !== isGroup) L = new IMG.Layer(isGroup ? 'group' : 'raster', { id: n.id, width: 1, height: 1 });
        for (const k of IMG.LAYER_PROPS) if (k !== 'x' && k !== 'y') L[k] = n[k];
        for (const k of IMG.LAYER_JPROPS) L[k] = n[k] ? IMG.jclone(n[k]) : null;
        L.smart = n.smart ? IMG.cloneSmart(n.smart) : null;
        L.parent = parent;
        L._hidden = false;
        L._fxc = null;
        if (isGroup) L.children = n.children.map((c) => build(c, L));
        else if (n.snap) { L.children = null; restoreSurface(L, n.snap); L.x = n.x; L.y = n.y; }
        else { L.canvas = null; L.x = n.x; L.y = n.y; }
        if (n.mask) {
          if (!L.mask) L.mask = { canvas: null, x: 0, y: 0, enabled: true, linked: true, _snap: null, _dirty: null, _dirtyAll: true, _blank: false, _ver: 0 };
          restoreSurface(L.mask, n.mask.snap);
          L.mask.x = n.mask.x; L.mask.y = n.mask.y; L.mask.enabled = n.mask.enabled; L.mask.linked = n.mask.linked;
          L.mask.bg = n.mask.bg == null ? 255 : n.mask.bg; L.mask.density = n.mask.density == null ? 100 : n.mask.density; L.mask.feather = n.mask.feather || 0;
        } else L.mask = null;
        return L;
      };

      doc.layers = st.tree.map((n) => build(n, null));
      doc.width = st.width; doc.height = st.height;
      doc.activeId = st.activeId;
      doc.selected = new Set(st.selected);
      doc.guides = { h: st.guides.h.slice(), v: st.guides.v.slice() };
      if (st.globalAngle != null) { doc.globalAngle = st.globalAngle; doc.globalAltitude = st.globalAltitude; }
      doc.paths = IMG.jclone(st.paths || []);
      doc.slices = IMG.jclone(st.slices || []);
      if (st.mode) doc.mode = st.mode;
      {
        const prev = new Map((doc.channels || []).map((c) => [c.id, c]));
        doc.channels = (st.channels || []).map((n) => {
          const c = prev.get(n.id) || { id: n.id, canvas: null, _snap: null, _dirty: null, _dirtyAll: true, _blank: false };
          c.name = n.name; c.color = n.color; c.opacity = n.opacity; c.inverted = n.inverted;
          restoreSurface(c, n.snap);
          return c;
        });
      }

      if (st.selection) {
        if (!doc.selection) doc.selection = { canvas: null, path: null, bounds: null, x: 0, y: 0, bg: 0, _snap: null, _dirty: null, _dirtyAll: true, _blank: false };
        restoreSurface(doc.selection, st.selection.snap);
        doc.selection.path = st.selection.path;
        doc.selection.bounds = st.selection.bounds ? { ...st.selection.bounds } : null;
      } else doc.selection = null;
      if (st.quickMask != null && st.quickMask !== !!doc.quickMask) { doc.quickMask = st.quickMask; if (!doc.quickMask) doc.editMask = false; bus.emit('quickmask:change', doc); }
      if (doc.quickMask && !doc.selection && IMG.Selection) IMG.Selection.ensure(doc);

      const act = doc.active;
      if (!doc.quickMask && (!act || !act.mask)) doc.editMask = false;

      if (sized) { bus.emit('doc:resize', doc); if (IMG.app.doc === doc) IMG.Engine.fit(false); }
      bus.emit('layers:change', doc);
      bus.emit('selection:change', doc);
      bus.emit('history:change', doc);
    }
  }

  IMG.History = History;
  IMG.snapSurface = snapSurface;
  IMG.restoreSurface = restoreSurface;

  /** Procura o nó de uma camada (por id) em um estado do histórico. */
  IMG.findNode = function (st, id) {
    let found = null;
    const rec = (list) => { for (const n of list) { if (n.id === id) { found = n; return true; } if (n.children && rec(n.children)) return true; } return false; };
    if (st) rec(st.tree);
    return found;
  };

  /** Atalho: registra um passo no histórico do documento ativo. */
  IMG.commit = function (name) {
    const doc = IMG.app && IMG.app.doc;
    if (!doc) return;
    // operações compostas (contornar demarcador, ações, recorte com preenchimento) agrupam os passos
    if (IMG._batch > 0) { doc._batchDirty = true; bus.emit('history:pending', doc); return; }
    doc.history.commit(name);
  };
  /** Executa fn agrupando todos os commits internos em um único passo do histórico. */
  IMG.batch = function (name, fn) {
    IMG._batch = (IMG._batch || 0) + 1;
    let r;
    try { r = fn(); } finally { IMG._batch--; }
    if (r && typeof r.then === 'function') return r;
    if (!IMG._batch) IMG.commit(name);
    return r;
  };
})();
