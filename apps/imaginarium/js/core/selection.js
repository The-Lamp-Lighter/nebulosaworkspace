/* ==========================================================================
   Imaginarium — seleção (núcleo) e menu Selecionar
   A seleção é uma máscara: canvas do tamanho do documento, branco com alfa
   (alfa = quanto o pixel está selecionado). O contorno animado é gerado a
   partir das bordas da máscara.
   Inclui: Modificar (Borda, Suavizar, Expandir, Contrair, Difusão), Expandir
   semelhantes, Semelhante, Intervalo de cores, Refinar borda (Selecionar e
   mascarar), Máscara rápida (Q), Salvar/Carregar seleção e Localizar camadas.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;

  /** Desfoca um canvas no lugar (usa ctx.filter quando existe; senão, JS). */
  function blurCanvas(canvas, radius) {
    if (radius <= 0) return;
    const w = canvas.width, h = canvas.height, ctx = canvas.getContext('2d');
    if (typeof ctx.filter === 'string') {
      const t = U.cloneCanvas(canvas);
      ctx.clearRect(0, 0, w, h);
      ctx.filter = 'blur(' + radius + 'px)';
      ctx.drawImage(t, 0, 0);
      ctx.filter = 'none';
    } else {
      const img = ctx.getImageData(0, 0, w, h);
      IMG.Filters.K._gaussian(img.data, w, h, radius);
      ctx.putImageData(img, 0, 0);
    }
  }
  IMG.blurCanvas = blurCanvas;

  /**
   * Preenchimento por inundação. Retorna Uint8Array (1 = pixel incluído).
   * data: RGBA; (sx, sy): ponto inicial; tol: 0–255.
   */
  IMG.flood = function (d, w, h, sx, sy, tol, contiguous) {
    const out = new Uint8Array(w * h);
    sx = Math.floor(sx); sy = Math.floor(sy);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return out;
    const i0 = (sy * w + sx) * 4;
    const r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2], a0 = d[i0 + 3];
    const match = (p) => {
      const i = p * 4, a = d[i + 3];
      const da = a > a0 ? a - a0 : a0 - a;
      if (da > tol) return false;
      if (a === 0 || a0 === 0) return true;
      let v = d[i] - r0; if (v < 0) v = -v; if (v > tol) return false;
      v = d[i + 1] - g0; if (v < 0) v = -v; if (v > tol) return false;
      v = d[i + 2] - b0; if (v < 0) v = -v; return v <= tol;
    };
    if (!contiguous) {
      for (let p = 0, n = w * h; p < n; p++) if (match(p)) out[p] = 1;
      return out;
    }
    const stack = [sx, sy];
    while (stack.length) {
      const y = stack.pop(), x = stack.pop();
      let p = y * w + x;
      if (out[p] || !match(p)) continue;
      let xl = x, xr = x;
      while (xl > 0 && !out[p - 1] && match(p - 1)) { xl--; p--; }
      p = y * w + x;
      while (xr < w - 1 && !out[p + 1] && match(p + 1)) { xr++; p++; }
      const row = y * w;
      for (let i = xl; i <= xr; i++) out[row + i] = 1;
      for (let k = 0; k < 2; k++) {
        const ny = k ? y + 1 : y - 1;
        if (ny < 0 || ny >= h) continue;
        const nrow = ny * w;
        let span = false;
        for (let i = xl; i <= xr; i++) {
          const q = nrow + i;
          if (!out[q] && match(q)) { if (!span) { stack.push(i, ny); span = true; } }
          else span = false;
        }
      }
    }
    return out;
  };

  /** Converte uma máscara binária (Uint8Array) em canvas branco com alfa. */
  IMG.maskToCanvas = function (mask, w, h) {
    const c = U.createCanvas(w, h), ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h), d32 = new Uint32Array(img.data.buffer);
    for (let i = 0, n = w * h; i < n; i++) if (mask[i]) d32[i] = 0xffffffff;
    ctx.putImageData(img, 0, 0);
    return c;
  };
  /** Canvas de alfa a partir de valores 0..1 (Float32Array w×h). */
  IMG.alphaToCanvas = function (a, w, h) {
    const c = U.createCanvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
    for (let i = 0; i < a.length; i++) { const j = i * 4; d[j] = d[j + 1] = d[j + 2] = 255; d[j + 3] = a[i] * 255; }
    ctx.putImageData(img, 0, 0);
    return c;
  };

  const newSel = (w, h) => ({ canvas: U.createCanvas(w, h), path: null, bounds: null, x: 0, y: 0, bg: 0, _snap: null, _dirty: null, _dirtyAll: true, _blank: false });
  IMG.newSelectionObject = newSel;
  /** Seleção que limita a pintura (nenhuma durante a Máscara rápida). */
  IMG.activeSelection = (doc) => (doc && !doc.quickMask ? doc.selection : null);

  const Sel = (IMG.Selection = {
    ensure(doc) {
      let s = doc.selection;
      if (!s || !s.canvas || s.canvas.width !== doc.width || s.canvas.height !== doc.height) s = doc.selection = newSel(doc.width, doc.height);
      s.x = 0; s.y = 0; s.bg = 0;
      return s;
    },

    clear(doc) {
      if (doc.quickMask) {
        const s = this.ensure(doc);
        s.canvas.getContext('2d').clearRect(0, 0, doc.width, doc.height);
        IMG.markDirty(s); this.update(doc); IMG.Engine.requestRender();
        return true;
      }
      if (!doc.selection) return false;
      doc.lastSelection = U.cloneCanvas(doc.selection.canvas);
      doc.selection = null;
      bus.emit('selection:change', doc);
      return true;
    },

    scratch(doc) { return U.createCanvas(doc.width, doc.height); },

    /** Combina uma forma (canvas no espaço do documento) com a seleção atual. */
    combine(doc, shape, mode) {
      const had = !!doc.selection;
      if (!had && (mode === 'sub' || mode === 'int')) return;
      if (!had && mode === 'xor') mode = 'new';
      const s = this.ensure(doc), ctx = s.canvas.getContext('2d');
      ctx.globalAlpha = 1;
      if (mode === 'add' && had) ctx.globalCompositeOperation = 'source-over';
      else if (mode === 'sub') ctx.globalCompositeOperation = 'destination-out';
      else if (mode === 'int') ctx.globalCompositeOperation = 'destination-in';
      else if (mode === 'xor') ctx.globalCompositeOperation = 'xor';
      else { ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, s.canvas.width, s.canvas.height); }
      ctx.drawImage(shape, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      IMG.markDirty(s);
      this.update(doc);
    },

    /** Cria uma forma a partir de um caminho e combina com a seleção. o: { rule, feather, antiAlias } */
    fromPath(doc, draw, mode, o = {}) {
      const c = this.scratch(doc), ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      draw(ctx);
      ctx.fill(o.rule || 'nonzero');
      if (o.antiAlias === false) this.hardenCanvas(c);
      if (o.feather > 0) blurCanvas(c, o.feather);
      this.combine(doc, c, mode || 'new');
    },
    /** Remove a suavização (limiar de 50%). */
    hardenCanvas(c) {
      const x = c.getContext('2d'), img = x.getImageData(0, 0, c.width, c.height), d = img.data;
      for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
      x.putImageData(img, 0, 0);
    },

    /** Recalcula limites e contorno. Remove a seleção se estiver vazia. */
    update(doc) {
      const s = doc.selection;
      if (!s) { bus.emit('selection:change', doc); return; }
      const W = s.canvas.width, H = s.canvas.height;
      const d = new Uint32Array(s.canvas.getContext('2d').getImageData(0, 0, W, H).data.buffer);
      let top = -1, bottom = -1, left = W, right = -1;
      for (let y = 0; y < H; y++) {
        const row = y * W;
        let x = 0;
        for (; x < W; x++) if (d[row + x] >>> 24 > 7) break;
        if (x === W) continue;
        if (top < 0) top = y;
        bottom = y;
        if (x < left) left = x;
        let x2 = W - 1;
        for (; x2 > right; x2--) if (d[row + x2] >>> 24 > 7) break;
        if (x2 > right) right = x2;
      }
      if (top < 0) {
        if (doc.quickMask) { s.bounds = null; s.path = null; bus.emit('selection:change', doc); return; }
        doc.selection = null; bus.emit('selection:change', doc); return;
      }
      s.bounds = { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };

      const path = new Path2D();
      const x0 = left, x1 = right + 1, y0 = top, y1 = bottom + 1;
      let segs = 0;
      const LIMIT = 250000;
      for (let y = y0; y <= y1 && segs < LIMIT; y++) {
        const ra = y < H ? y * W : -1, rb = y > 0 ? (y - 1) * W : -1;
        let run = -1;
        for (let x = x0; x < x1; x++) {
          const a = ra >= 0 && d[ra + x] >>> 24 >= 128, b = rb >= 0 && d[rb + x] >>> 24 >= 128;
          if (a !== b) { if (run < 0) run = x; }
          else if (run >= 0) { path.moveTo(run, y); path.lineTo(x, y); run = -1; segs++; }
        }
        if (run >= 0) { path.moveTo(run, y); path.lineTo(x1, y); segs++; }
      }
      for (let x = x0; x <= x1 && segs < LIMIT; x++) {
        let run = -1;
        for (let y = y0; y < y1; y++) {
          const row = y * W;
          const a = x < W && d[row + x] >>> 24 >= 128, b = x > 0 && d[row + x - 1] >>> 24 >= 128;
          if (a !== b) { if (run < 0) run = y; }
          else if (run >= 0) { path.moveTo(x, run); path.lineTo(x, y); run = -1; segs++; }
        }
        if (run >= 0) { path.moveTo(x, run); path.lineTo(x, y1); segs++; }
      }
      s.path = path;
      bus.emit('selection:change', doc);
    },

    all(doc) { this.fromPath(doc, (c) => c.rect(0, 0, doc.width, doc.height), 'new'); },

    invert(doc) {
      if (!doc.selection) { this.all(doc); return; }
      const s = doc.selection, ctx = s.canvas.getContext('2d');
      ctx.globalCompositeOperation = 'xor';
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, doc.width, doc.height);
      ctx.globalCompositeOperation = 'source-over';
      IMG.markDirty(s);
      this.update(doc);
    },

    /** Seleciona os pixels opacos de uma camada. */
    fromLayer(doc, L, mode) {
      if (!L) return;
      const c = this.scratch(doc), ctx = c.getContext('2d');
      if (L.type === 'group') IMG.Engine.drawList(ctx, L.children, doc.rect, 10);
      else if (L.type === 'adjust' || (L.type === 'fill' && !L.canvas)) { if (L.mask) return this.fromMask(doc, L, mode); ctx.fillRect(0, 0, doc.width, doc.height); }
      else if (L.canvas) ctx.drawImage(L.canvas, L.x, L.y);
      if (L.type === 'shape' && L.vmask && IMG.Engine.applyMasks) IMG.Engine.applyMasks(ctx, L, doc.rect, 30);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, doc.width, doc.height);
      this.combine(doc, c, mode || 'new');
    },

    /** Seleção a partir da máscara de uma camada. */
    fromMask(doc, L, mode) {
      if (!L || !L.mask) return;
      this.combine(doc, this.maskCanvas(doc, L), mode || 'new');
    },
    /** Máscara de camada como canvas do documento (branco + alfa). */
    maskCanvas(doc, L) {
      const m = L.mask, c = this.scratch(doc), ctx = c.getContext('2d');
      const bg = m.bg == null ? 255 : m.bg;
      if (bg) { ctx.fillStyle = 'rgba(255,255,255,' + bg / 255 + ')'; ctx.fillRect(0, 0, doc.width, doc.height); ctx.clearRect(m.x, m.y, m.canvas.width, m.canvas.height); }
      ctx.drawImage(m.canvas, m.x, m.y);
      return c;
    },
    /** Seleção a partir de um canvas de máscara (alfa) no tamanho do documento. */
    fromCanvas(doc, canvas, mode) { this.combine(doc, canvas, mode || 'new'); },

    feather(doc, radius) {
      const s = doc.selection; if (!s) return;
      blurCanvas(s.canvas, radius);
      IMG.markDirty(s);
      this.update(doc);
    },

    /* ---------- leitura/escrita de regiões (valores 0..1) ---------- */
    region(doc, pad) {
      const s = doc.selection;
      if (!s || !s.bounds) return doc.rect;
      return U.rectIntersect(U.rectInt(U.rectInflate(s.bounds, pad)), doc.rect) || doc.rect;
    },
    readAlpha(doc, R) {
      const s = doc.selection, out = new Float32Array(R.w * R.h);
      if (!s) return out;
      const d = s.canvas.getContext('2d').getImageData(R.x, R.y, R.w, R.h).data;
      for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] / 255;
      return out;
    },
    writeAlpha(doc, R, a) {
      const s = this.ensure(doc), ctx = s.canvas.getContext('2d');
      ctx.clearRect(0, 0, doc.width, doc.height);
      ctx.drawImage(IMG.alphaToCanvas(a, R.w, R.h), R.x, R.y);
      IMG.markDirty(s);
      this.update(doc);
    },
    /** Aplica fn(alfa, w, h) → alfa sobre a seleção (região dos limites + margem). */
    op(doc, pad, fn) {
      if (!doc.selection) return;
      const R = this.region(doc, pad);
      const a = this.readAlpha(doc, R);
      this.writeAlpha(doc, R, fn(a, R.w, R.h, R));
    },

    /** Expande (px > 0) ou contrai (px < 0) com distância euclidiana.
        canvasBounds: ao contrair, as bordas do documento também contam como borda da seleção. */
    grow(doc, px, canvasBounds) {
      if (!px) return;
      this.op(doc, Math.max(0, px) + 2, (a, w, h, R) => {
        // margem externa vazia para que a borda da tela "contraia" a seleção
        const m = px < 0 && canvasBounds ? Math.ceil(-px) + 2 : 0;
        const pw = w + m * 2, ph = h + m * 2;
        let src = a;
        if (m) {
          src = new Float32Array(pw * ph);
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) src[(y + m) * pw + x + m] = a[y * w + x];
          // fora do documento = não selecionado; fora da região (mas dentro do documento) = mantém o alfa vizinho
          for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
            const gx = R.x + x - m, gy = R.y + y - m;
            if (x >= m && y >= m && x < w + m && y < h + m) continue;
            if (gx < 0 || gy < 0 || gx >= doc.width || gy >= doc.height) continue;
            src[y * pw + x] = a[U.clamp(y - m, 0, h - 1) * w + U.clamp(x - m, 0, w - 1)];
          }
        }
        const sd = IMG.Effects.signedDist(src, pw, ph), out = new Float32Array(a.length);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = U.clamp(0.5 - sd[(y + m) * pw + x + m] + px, 0, 1);
        return out;
      });
    },
    expand(doc, px, cb) { this.grow(doc, Math.abs(px), cb); },
    contract(doc, px, cb) { this.grow(doc, -Math.abs(px), cb); },

    /** Borda: faixa de "w" px centrada no contorno, com bordas suaves. */
    border(doc, w) {
      this.op(doc, w + 4, (a, W, H) => {
        const sd = IMG.Effects.signedDist(a, W, H), out = new Float32Array(a.length);
        for (let i = 0; i < a.length; i++) out[i] = U.clamp(w / 2 + 0.5 - Math.abs(sd[i] + 0.5), 0, 1);
        const t = new Uint8ClampedArray(a.length * 4);
        for (let i = 0; i < a.length; i++) t[i * 4 + 3] = out[i] * 255;
        IMG.Filters.K._gaussian(t, W, H, Math.max(0.6, w / 8));
        for (let i = 0; i < a.length; i++) out[i] = t[i * 4 + 3] / 255;
        return out;
      });
    },

    /** Suavizar: arredonda cantos e remove pontas (média + limiar). */
    smooth(doc, r) {
      this.op(doc, r + 2, (a, W, H) => {
        const t = new Uint8ClampedArray(a.length * 4);
        for (let i = 0; i < a.length; i++) t[i * 4 + 3] = a[i] * 255;
        IMG.Filters.K._gaussian(t, W, H, r * 0.7);
        const out = new Float32Array(a.length);
        for (let i = 0; i < a.length; i++) out[i] = U.clamp((t[i * 4 + 3] / 255 - 0.5) * 3 + 0.5, 0, 1);
        return out;
      });
    },

    /** Pixels semelhantes à seleção (Expandir semelhantes / Semelhante). */
    similar(doc, contiguous) {
      const s = doc.selection; if (!s || !s.bounds) return;
      const o = IMG.Tools.o('wand') || {}, tol = o.tolerance == null ? 32 : o.tolerance;
      const W = doc.width, H = doc.height;
      const src = o.sampleAll === false && doc.active && doc.active.canvas ? (() => { const c = U.createCanvas(W, H); c.getContext('2d').drawImage(doc.active.canvas, doc.active.x, doc.active.y); return c; })() : IMG.Engine.composite(doc);
      const d = src.getContext('2d').getImageData(0, 0, W, H).data;
      const sa = s.canvas.getContext('2d').getImageData(0, 0, W, H).data;
      // faixa de cores da seleção (percentis 1–99 por canal)
      const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
      let n = 0;
      for (let i = 0; i < W * H; i++) if (sa[i * 4 + 3] >= 128) { hist[0][d[i * 4]]++; hist[1][d[i * 4 + 1]]++; hist[2][d[i * 4 + 2]]++; n++; }
      if (!n) return;
      const lo = [], hi = [];
      for (let c = 0; c < 3; c++) {
        let acc = 0, a = 0, b = 255;
        for (let v = 0; v < 256; v++) { acc += hist[c][v]; if (acc >= n * 0.01) { a = v; break; } }
        acc = 0;
        for (let v = 255; v >= 0; v--) { acc += hist[c][v]; if (acc >= n * 0.01) { b = v; break; } }
        lo[c] = a - tol; hi[c] = b + tol;
      }
      const match = (p) => { const i = p * 4; return d[i] >= lo[0] && d[i] <= hi[0] && d[i + 1] >= lo[1] && d[i + 1] <= hi[1] && d[i + 2] >= lo[2] && d[i + 2] <= hi[2]; };
      const out = new Uint8Array(W * H);
      if (!contiguous) { for (let p = 0; p < W * H; p++) if (sa[p * 4 + 3] >= 128 || match(p)) out[p] = 1; }
      else {
        const st = [];
        for (let p = 0; p < W * H; p++) if (sa[p * 4 + 3] >= 128) { out[p] = 1; st.push(p); }
        while (st.length) {
          const p = st.pop(), x = p % W, y = (p / W) | 0;
          const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
          for (const q of nb) if (q >= 0 && !out[q] && match(q)) { out[q] = 1; st.push(q); }
        }
      }
      const c = IMG.maskToCanvas(out, W, H);
      if (o.antiAlias !== false) blurCanvas(c, 0.5);
      this.combine(doc, c, 'add');
    },

    contains(doc, x, y) {
      const s = doc.selection; if (!s) return false;
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return false;
      return s.canvas.getContext('2d').getImageData(x, y, 1, 1).data[3] >= 128;
    },

    /** Recorta um canvas pela seleção. (ox, oy) = posição do canvas no documento. */
    clip(doc, canvas, ox = 0, oy = 0) {
      const sel = IMG.activeSelection(doc);
      if (!sel) return;
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(sel.canvas, -ox, -oy);
      ctx.restore();
    },

    /** Alfa da seleção (Uint8Array) para um retângulo do documento, ou null. */
    maskFor(doc, r) {
      const sel = IMG.activeSelection(doc);
      if (!sel) return null;
      const c = U.createCanvas(r.w, r.h), ctx = c.getContext('2d');
      ctx.drawImage(sel.canvas, -r.x, -r.y);
      const d = ctx.getImageData(0, 0, r.w, r.h).data;
      const out = new Uint8Array(r.w * r.h);
      for (let i = 0, j = 3; i < out.length; i++, j += 4) out[i] = d[j];
      return out;
    }
  });

  /* ==================================================================
     MÁSCARA RÁPIDA (Q)
     A própria máscara da seleção vira a superfície de pintura; vermelho
     translúcido mostra as áreas protegidas.
     ================================================================== */
  const QM = (IMG.QuickMask = {
    opts: Object.assign({ color: '#ff0000', opacity: 50, selected: false }, U.store.get('quickMask', {})),
    layers: new Map(),
    /** Pseudocamada usada pelas ferramentas de pintura. */
    layer(doc) {
      let L = this.layers.get(doc.id);
      if (!L) {
        L = { id: '__qm_' + doc.id, type: 'raster', name: 'Máscara rápida', visible: true, opacity: 1, fill: 1, blend: 'normal', parent: null, isQM: true, lockAlpha: false, locked: false, lockPaint: false, fx: null,
          ensureCovers() {}, contentBounds() { return doc.rect; } };
        Object.defineProperty(L, 'mask', { get: () => Sel.ensure(doc) });
        Object.defineProperty(L, 'canvas', { get: () => Sel.ensure(doc).canvas });
        this.layers.set(doc.id, L);
      }
      return L;
    },
    toggle(doc) {
      if (!doc) return;
      if (!doc.quickMask) {
        doc.quickMask = true;
        doc._qmEditMask = doc.editMask;
        doc.editMask = true;
        Sel.ensure(doc);
      } else {
        doc.quickMask = false;
        doc.editMask = !!(doc._qmEditMask && doc.active && doc.active.mask);
        Sel.update(doc);
      }
      bus.emit('quickmask:change', doc);
      bus.emit('layers:select');
      IMG.Engine.requestRender();
      IMG.commit(doc.quickMask ? 'Editar no modo de máscara rápida' : 'Sair do modo de máscara rápida');
    },
    overlay(doc) {
      const s = doc.selection; if (!s) return null;
      if (!this._c || this._c.width !== doc.width || this._c.height !== doc.height) this._c = U.createCanvas(doc.width, doc.height);
      const c = this._c, x = c.getContext('2d');
      x.globalCompositeOperation = 'copy';
      if (this.opts.selected) { x.drawImage(s.canvas, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = this.opts.color; x.fillRect(0, 0, c.width, c.height); }
      else { x.fillStyle = this.opts.color; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'destination-out'; x.drawImage(s.canvas, 0, 0); }
      x.globalCompositeOperation = 'source-over';
      return { canvas: c, x: 0, y: 0, alpha: this.opts.opacity / 100 };
    },
    optionsDialog() {
      const UI = IMG.UI, o = Object.assign({}, this.opts);
      UI.dialog({
        title: 'Opções de máscara rápida', width: 360,
        body: [
          UI.row('', UI.check('A cor indica as áreas selecionadas (desmarcado: áreas mascaradas)', o.selected, (v) => { o.selected = v; }).el),
          UI.row('Cor', UI.colorBtn(o.color, (hex) => { if (hex) o.color = hex; }).el),
          UI.row('Opacidade', UI.num({ value: o.opacity, min: 0, max: 100, unit: '%', width: 80, onInput: (v) => { o.opacity = v; } }).el)
        ],
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => { this.opts = o; U.store.set('quickMask', o); IMG.Engine.requestRender(); } }]
      });
    }
  });
  {
    const E = IMG.Engine;
    const prev = E.overlaySource;
    E.overlaySource = (doc) => (doc.quickMask ? QM.overlay(doc) : prev ? prev(doc) : null);
    const pt = IMG.Layers.paintTarget.bind(IMG.Layers);
    IMG.Layers.paintTarget = function (doc, o) {
      if (doc && doc.quickMask) { doc.editMask = true; return QM.layer(doc); }
      return pt(doc, o);
    };
  }

  /* ==================================================================
     CANAIS ALFA: Salvar / Carregar seleção
     ================================================================== */
  const Channels = (IMG.Channels = {
    list(doc) { if (!doc.channels) doc.channels = []; return doc.channels; },
    add(doc, name, canvas) {
      const ch = { id: U.uid('ch'), name: name || 'Alfa ' + (this.list(doc).length + 1), color: '#ff0000', opacity: 50, inverted: false, canvas: canvas || U.createCanvas(doc.width, doc.height), x: 0, y: 0, bg: 0, _snap: null, _dirty: null, _dirtyAll: true, _blank: false };
      this.list(doc).push(ch);
      bus.emit('channels:change', doc);
      return ch;
    },
    /** Fontes possíveis para "Carregar seleção". */
    sources(doc) {
      const out = this.list(doc).map((c) => ({ id: 'ch:' + c.id, label: c.name, canvas: () => c.canvas }));
      const L = doc.active;
      if (L && L.type !== 'group') out.push({ id: 'tr', label: 'Transparência de ' + L.name, canvas: () => { const c = U.createCanvas(doc.width, doc.height), x = c.getContext('2d'); if (L.canvas) x.drawImage(L.canvas, L.x, L.y); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, doc.width, doc.height); return c; } });
      if (L && L.mask) out.push({ id: 'mask', label: 'Máscara de ' + L.name, canvas: () => Sel.maskCanvas(doc, L) });
      return out;
    }
  });

  function opSelect(value, onChange) {
    return IMG.UI.select([['new', 'Nova seleção'], ['add', 'Adicionar à seleção'], ['sub', 'Subtrair da seleção'], ['int', 'Interseção com a seleção']], value, onChange, { keepFocus: true, width: 200 });
  }

  function saveSelectionDialog(doc) {
    const UI = IMG.UI;
    if (!doc.selection) return;
    const chs = Channels.list(doc);
    let target = 'new', name = 'Alfa ' + (chs.length + 1), op = 'new';
    const nameIn = el('input.inp', { type: 'text', value: name });
    const opRow = UI.row('Operação', UI.select([['new', 'Substituir canal'], ['add', 'Adicionar ao canal'], ['sub', 'Subtrair do canal'], ['int', 'Interseção com o canal']], 'new', (v) => { op = v; }, { keepFocus: true, width: 200 }).el);
    opRow.style.display = 'none';
    const chSel = UI.select([['new', 'Novo']].concat(chs.map((c) => [c.id, c.name])), 'new', (v) => { target = v; nameIn.disabled = v !== 'new'; opRow.style.display = v === 'new' ? 'none' : ''; }, { keepFocus: true, width: 200 });
    UI.dialog({
      title: 'Salvar seleção', width: 380,
      body: [UI.row('Canal', chSel.el), UI.row('Nome', nameIn), opRow],
      buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
        const sc = doc.selection.canvas;
        if (target === 'new') Channels.add(doc, nameIn.value.trim() || name, U.cloneCanvas(sc));
        else {
          const ch = chs.find((c) => c.id === target); if (!ch) return;
          const x = ch.canvas.getContext('2d');
          x.globalCompositeOperation = op === 'add' ? 'source-over' : op === 'sub' ? 'destination-out' : op === 'int' ? 'destination-in' : 'copy';
          x.drawImage(sc, 0, 0); x.globalCompositeOperation = 'source-over';
          IMG.markDirty(ch); bus.emit('channels:change', doc);
        }
        IMG.commit('Salvar seleção');
      } }]
    });
  }

  function loadSelectionDialog(doc) {
    const UI = IMG.UI, srcs = Channels.sources(doc);
    if (!srcs.length) { UI.toast('Não há canais alfa nem camadas para carregar.'); return; }
    let src = srcs[0].id, inv = false, op = doc.selection ? 'new' : 'new';
    const body = [UI.row('Canal', UI.select(srcs.map((s) => [s.id, s.label]), src, (v) => { src = v; }, { keepFocus: true, width: 220 }).el), UI.row('', UI.check('Inverter', false, (v) => { inv = v; }).el)];
    if (doc.selection) body.push(el('h3.form-title', { text: 'Operação' }), UI.row('', opSelect(op, (v) => { op = v; }).el));
    UI.dialog({
      title: 'Carregar seleção', width: 400, body,
      buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
        const s = srcs.find((q) => q.id === src); if (!s) return;
        let c = U.cloneCanvas(s.canvas());
        if (inv) { const x = c.getContext('2d'); x.globalCompositeOperation = 'xor'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'source-over'; }
        Sel.combine(doc, c, op);
        IMG.commit('Carregar seleção');
      } }]
    });
  }
  IMG.loadSelectionFrom = function (doc, canvas, op) { Sel.combine(doc, canvas, op || 'new'); };

  /* ==================================================================
     INTERVALO DE CORES
     ================================================================== */
  const PRESETS = [['sampled', 'Cores amostradas'], null, ['reds', 'Vermelhos'], ['yellows', 'Amarelos'], ['greens', 'Verdes'], ['cyans', 'Cianos'], ['blues', 'Azuis'], ['magentas', 'Magentas'], null,
    ['highlights', 'Realces'], ['midtones', 'Tons médios'], ['shadows', 'Sombras'], null, ['skin', 'Tons de pele']];
  const HUES = { reds: 0, yellows: 60, greens: 120, cyans: 180, blues: 240, magentas: 300 };

  function rangeAlpha(d, n, o) {
    const out = new Float32Array(n), F = Math.max(1, o.fuzz);
    const plus = o.samples, minus = o.minus;
    for (let j = 0; j < n; j++) {
      const i = j * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      let a = 0;
      if (o.mode === 'sampled') {
        for (const s of plus) { const dd = Math.sqrt((r - s[0]) ** 2 + (g - s[1]) ** 2 + (b - s[2]) ** 2); const v = dd <= F * 0.4 ? 1 : 1 - (dd - F * 0.4) / (F * 0.9); if (v > a) a = v; if (a >= 1) break; }
        if (a > 0) for (const s of minus) { const dd = Math.sqrt((r - s[0]) ** 2 + (g - s[1]) ** 2 + (b - s[2]) ** 2); const v = dd <= F * 0.4 ? 1 : 1 - (dd - F * 0.4) / (F * 0.9); if (v > 0) a *= 1 - Math.min(1, v); }
      } else if (HUES[o.mode] != null) {
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
        if (c > 8) {
          let h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; h *= 60; if (h < 0) h += 360;
          let dh = Math.abs(h - HUES[o.mode]); if (dh > 180) dh = 360 - dh;
          a = U.clamp(1 - (dh - 20) / 25, 0, 1) * U.clamp(c / 90, 0, 1);
        }
      } else if (o.mode === 'skin') {
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
        if (mx === r && r > 60 && c > 12) { let h = ((g - b) / c) * 60; if (h < 0) h += 360; a = (h >= 5 && h <= 50 ? 1 : h < 5 ? U.clamp(1 - (5 - h) / 10, 0, 1) : U.clamp(1 - (h - 50) / 15, 0, 1)) * U.clamp(1 - Math.abs(c / mx - 0.35) / 0.35, 0, 1); }
      } else {
        const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (o.mode === 'highlights') a = U.clamp((l - 0.6) / 0.2, 0, 1);
        else if (o.mode === 'shadows') a = U.clamp((0.4 - l) / 0.2, 0, 1);
        else a = U.clamp(1 - Math.abs(l - 0.5) / 0.3, 0, 1);
      }
      a = U.clamp(a, 0, 1) * (d[i + 3] / 255);
      out[j] = o.invert ? 1 - a : a;
    }
    return out;
  }
  IMG.colorRangeAlpha = rangeAlpha;

  function colorRangeDialog(doc) {
    const UI = IMG.UI, E = IMG.Engine;
    const W = doc.width, H = doc.height;
    const comp = IMG.Engine.composite(doc);
    const k = Math.min(1, 520 / Math.max(W, H)), pw = Math.max(1, Math.round(W * k)), ph = Math.max(1, Math.round(H * k));
    const small = U.createCanvas(pw, ph); small.getContext('2d').drawImage(comp, 0, 0, pw, ph);
    const sd = small.getContext('2d').getImageData(0, 0, pw, ph).data;
    const fullD = () => comp.getContext('2d').getImageData(0, 0, W, H).data;
    const st = U.store.get('colorRange', { mode: 'sampled', fuzz: 40, invert: false, preview: 'none' });
    const o = { mode: st.mode, fuzz: st.fuzz, invert: st.invert, samples: [], minus: [], preview: st.preview || 'none' };
    let pick = 'set';
    const thumb = U.domCanvas(pw, ph); thumb.className = 'cr-thumb';
    let maskSmall = null;
    const selC = U.createCanvas(pw, ph);
    const recompute = () => {
      maskSmall = rangeAlpha(sd, pw * ph, o);
      const tc = thumb.getContext('2d'), img = tc.createImageData(pw, ph);
      for (let i = 0; i < maskSmall.length; i++) { const v = maskSmall[i] * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
      tc.putImageData(img, 0, 0);
      selC.getContext('2d').clearRect(0, 0, pw, ph); selC.getContext('2d').drawImage(IMG.alphaToCanvas(maskSmall, pw, ph), 0, 0);
      E.requestRender();
    };
    const fuzzCtl = UI.slider({ label: 'Tolerância', value: o.fuzz, min: 0, max: 200, step: 1, def: 40, onInput: (v) => { o.fuzz = v; recompute(); } });
    const presetSel = UI.select(PRESETS, o.mode, (v) => { o.mode = v; fuzzCtl.el.style.display = v === 'sampled' ? '' : 'none'; picks.style.display = v === 'sampled' ? '' : 'none'; recompute(); }, { keepFocus: true, width: 200 });
    const picks = el('div.seg');
    const setPick = (m) => { pick = m; U.$$('button', picks).forEach((b) => b.classList.toggle('on', b.dataset.m === m)); };
    [['set', 'eyedropper', 'Conta-gotas (substitui a amostra)'], ['add', 'plus', 'Adicionar à amostra (Shift)'], ['sub', 'minus', 'Subtrair da amostra (Alt)']].forEach(([m, ic, t]) => {
      const b = el('button.seg-btn', { type: 'button', title: t, html: IMG.icon(ic, 15), data: { m } }); b.addEventListener('click', () => setPick(m)); picks.appendChild(b);
    });
    setPick('set');
    const prevSel = UI.select([['none', 'Nenhuma'], ['gray', 'Tons de cinza'], ['black', 'Fosco preto'], ['white', 'Fosco branco'], ['qm', 'Máscara rápida']], o.preview, (v) => { o.preview = v; E.requestRender(); }, { keepFocus: true, width: 150 });
    // amostragem na tela
    const sampleAt = (ev) => {
      if (o.mode !== 'sampled') return;
      const x = Math.floor(ev.x), y = Math.floor(ev.y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const p = comp.getContext('2d').getImageData(x, y, 1, 1).data, c = [p[0], p[1], p[2]];
      const m = ev.shift ? 'add' : ev.alt ? 'sub' : pick;
      if (m === 'set') { o.samples = [c]; o.minus = []; } else if (m === 'add') o.samples.push(c); else o.minus.push(c);
      recompute();
    };
    let downAt = 0;
    IMG.Tools.overrideClick = (ev) => { const now = Date.now(); if (now - downAt < 40 && pick === 'set') return; downAt = now; sampleAt(ev); };
    thumb.addEventListener('pointerdown', (e) => { const r = thumb.getBoundingClientRect(); sampleAt({ x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, shift: e.shiftKey, alt: e.altKey }); });
    // amostra inicial: primeiro plano
    const fg = U.hexToRgb(IMG.app.fg); o.samples = [[fg.r, fg.g, fg.b]];
    E.dialogOverlay = (ctx, v) => {
      if (o.preview === 'none' || !maskSmall) return;
      ctx.save(); ctx.imageSmoothingEnabled = true;
      const dw = W * v.zoom, dh = H * v.zoom;
      if (o.preview === 'gray') { ctx.fillStyle = '#000'; ctx.fillRect(v.x, v.y, dw, dh); ctx.drawImage(thumb, v.x, v.y, dw, dh); }
      else if (o.preview === 'black' || o.preview === 'white') {
        const t = U.createCanvas(pw, ph), tx = t.getContext('2d'); tx.fillStyle = o.preview === 'black' ? '#000' : '#fff'; tx.fillRect(0, 0, pw, ph); tx.globalCompositeOperation = 'destination-out'; tx.drawImage(selC, 0, 0);
        ctx.drawImage(t, v.x, v.y, dw, dh);
      } else {
        const t = U.createCanvas(pw, ph), tx = t.getContext('2d'); tx.fillStyle = 'rgba(255,0,0,.5)'; tx.fillRect(0, 0, pw, ph); tx.globalCompositeOperation = 'destination-out'; tx.drawImage(selC, 0, 0);
        ctx.drawImage(t, v.x, v.y, dw, dh);
      }
      ctx.restore();
    };
    const cleanup = () => { IMG.Tools.overrideClick = null; E.dialogOverlay = null; E.requestRender(); };
    fuzzCtl.el.style.display = o.mode === 'sampled' ? '' : 'none';
    picks.style.display = o.mode === 'sampled' ? '' : 'none';
    recompute();
    UI.dialog({
      title: 'Intervalo de cores', width: 600, noFocus: true,
      body: [el('div.cr-wrap', el('div.cr-left', UI.row('Selecionar', presetSel.el), fuzzCtl.el, UI.row('Amostra', picks), UI.row('', UI.check('Inverter', o.invert, (v) => { o.invert = v; recompute(); }).el), UI.row('Pré-visualização', prevSel.el),
        el('p.dialog-note', { text: 'Clique na imagem (ou na miniatura) para amostrar cores. Shift+clique adiciona, Alt+clique subtrai.' })), el('div.cr-right', thumb))],
      buttons: [{ label: 'Cancelar', onClick: cleanup }, { label: 'OK', primary: true, onClick: () => {
        cleanup();
        U.store.set('colorRange', { mode: o.mode, fuzz: o.fuzz, invert: o.invert, preview: o.preview });
        const a = rangeAlpha(fullD(), W * H, o);
        const c = IMG.alphaToCanvas(a, W, H);
        if (doc.selection) Sel.combine(doc, c, 'int'); else Sel.combine(doc, c, 'new');
        if (!doc.selection) UI.toast('Nenhum pixel atende ao intervalo escolhido.');
        IMG.commit('Intervalo de cores');
      } }],
      onClose: cleanup
    });
  }

  /* ==================================================================
     REFINAR BORDA (Selecionar e mascarar)
     ================================================================== */
  function blurF(a, w, h, sigma) {
    if (sigma < 0.3) return a;
    const t = new Uint8ClampedArray(a.length * 4);
    // usa os 4 canais para guardar o valor com mais precisão (alfa como valor; rgb ignorado)
    for (let i = 0; i < a.length; i++) t[i * 4 + 3] = a[i] * 255;
    IMG.Filters.K._gaussian(t, w, h, sigma);
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = t[i * 4 + 3] / 255;
    return out;
  }
  function blurFloat(v, w, h, sigma) {
    const K = IMG.Filters.K, b = new Float32Array(v.length);
    K._gaussChannel(v, b, w, h, sigma);
    return v;
  }

  /**
   * Refina um alfa: p = { radius, smooth, feather, contrast, shift }.
   * img: RGBA da imagem na mesma região. Retorna { a, fgColor } (cores de primeiro plano estimadas).
   */
  function refineAlpha(a0, img, w, h, p) {
    let a = Float32Array.from(a0);
    const n = w * h;
    let F = null;
    if (p.radius > 0) {
      const sd = IMG.Effects.signedDist(a0, w, h), R = p.radius;
      const fg = new Float32Array(n), bg = new Float32Array(n);
      for (let i = 0; i < n; i++) { if (sd[i] <= -R * 0.5 - 0.5) fg[i] = 1; else if (sd[i] >= R * 0.5 + 0.5) bg[i] = 1; }
      const sig = Math.max(1.5, R * 0.8);
      const acc = (mask) => {
        const out = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
        for (let c = 0; c < 3; c++) { for (let i = 0; i < n; i++) out[c][i] = img[i * 4 + c] * mask[i]; blurFloat(out[c], w, h, sig); }
        const m = Float32Array.from(mask); blurFloat(m, w, h, sig);
        return { c: out, m };
      };
      const A = acc(fg), B = acc(bg);
      F = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        if (A.m[i] > 1e-3) for (let c = 0; c < 3; c++) F[i * 3 + c] = A.c[c][i] / A.m[i];
        else for (let c = 0; c < 3; c++) F[i * 3 + c] = img[i * 4 + c];
        if (fg[i] || bg[i] || Math.abs(sd[i]) > R) continue;
        if (A.m[i] < 1e-3 || B.m[i] < 1e-3) continue;
        let num = 0, den = 0;
        for (let c = 0; c < 3; c++) {
          const fc = A.c[c][i] / A.m[i], bc = B.c[c][i] / B.m[i], ic = img[i * 4 + c];
          num += (ic - bc) * (fc - bc); den += (fc - bc) * (fc - bc);
        }
        if (den < 300) continue;
        const est = U.clamp(num / den, 0, 1);
        // mistura com o alfa original perto do centro da faixa
        const wgt = U.clamp(1 - Math.abs(sd[i]) / R, 0, 1);
        a[i] = est * (0.35 + 0.65 * wgt) + a[i] * (1 - (0.35 + 0.65 * wgt));
      }
    }
    if (p.smooth > 0) { const b = blurF(a, w, h, p.smooth * 0.12); const k = 1 + p.smooth * 0.04; for (let i = 0; i < n; i++) a[i] = U.clamp((b[i] - 0.5) * k + 0.5, 0, 1); }
    if (p.feather > 0) a = blurF(a, w, h, p.feather * 0.5);
    if (p.contrast > 0) { const k = 1 / Math.max(0.01, 1 - p.contrast / 100 * 0.99); for (let i = 0; i < n; i++) a[i] = U.clamp((a[i] - 0.5) * k + 0.5, 0, 1); }
    if (p.shift) { const s = p.shift / 100; for (let i = 0; i < n; i++) a[i] = s > 0 ? 1 - Math.pow(1 - a[i], 1 + 3 * s) : Math.pow(a[i], 1 - 3 * s); }
    return { a, F };
  }
  IMG.refineAlpha = refineAlpha;

  function refineDialog(doc) {
    const UI = IMG.UI, E = IMG.Engine;
    if (!doc.selection) { UI.toast('Faça uma seleção primeiro.'); return; }
    const p = Object.assign({ radius: 0, smooth: 0, feather: 0, contrast: 0, shift: 0, view: 'overlay', output: 'selection', decontam: false, amount: 50 }, U.store.get('refineEdge', {}));
    const pad = 260;
    const R = Sel.region(doc, pad);
    const a0 = Sel.readAlpha(doc, R);
    const L = doc.active;
    const srcCanvas = IMG.Engine.composite(doc);
    const img = srcCanvas.getContext('2d').getImageData(R.x, R.y, R.w, R.h).data;
    let res = null;
    const prev = U.createCanvas(R.w, R.h);
    const run = U.debounce(() => {
      res = refineAlpha(a0, img, R.w, R.h, p);
      prev.getContext('2d').clearRect(0, 0, R.w, R.h);
      prev.getContext('2d').drawImage(IMG.alphaToCanvas(res.a, R.w, R.h), 0, 0);
      E.requestRender();
    }, 120);
    E.hideAnts = true;
    E.dialogOverlay = (ctx, v) => {
      if (!res) return;
      const W = doc.width, H = doc.height, z = v.zoom;
      ctx.save();
      const full = U.createCanvas(W, H), fx = full.getContext('2d');
      const view = p.view;
      if (view === 'bw') { fx.fillStyle = '#000'; fx.fillRect(0, 0, W, H); fx.drawImage(prev, R.x, R.y); }
      else if (view === 'overlay') { fx.fillStyle = 'rgba(255,0,0,.5)'; fx.fillRect(0, 0, W, H); fx.globalCompositeOperation = 'destination-out'; fx.drawImage(prev, R.x, R.y); }
      else {
        if (view === 'black' || view === 'white') { fx.fillStyle = view === 'black' ? '#000' : '#fff'; fx.fillRect(0, 0, W, H); }
        const t = U.createCanvas(W, H), tx = t.getContext('2d');
        tx.drawImage(srcCanvas, 0, 0); tx.globalCompositeOperation = 'destination-in'; tx.fillStyle = '#000';
        const m = U.createCanvas(W, H); m.getContext('2d').drawImage(prev, R.x, R.y); tx.drawImage(m, 0, 0);
        if (view === 'layers') { ctx.fillStyle = E.checkerPattern(ctx); ctx.save(); ctx.translate(v.x, v.y); ctx.fillRect(0, 0, W * z, H * z); ctx.restore(); }
        fx.drawImage(t, 0, 0);
      }
      ctx.imageSmoothingEnabled = z < 2;
      ctx.drawImage(full, v.x, v.y, W * z, H * z);
      ctx.restore();
    };
    const sl = (label, key, min, max, unit) => UI.slider({ label, value: p[key], min, max, step: 1, unit: unit || '', def: 0, onInput: (v) => { p[key] = v; run(); } }).el;
    const cleanup = () => { E.dialogOverlay = null; E.hideAnts = false; E.requestRender(); };
    run();
    UI.dialog({
      title: 'Refinar borda', width: 420, noFocus: true,
      body: [
        UI.row('Modo de exibição', UI.select([['overlay', 'Sobreposição'], ['black', 'Sobre preto'], ['white', 'Sobre branco'], ['bw', 'Preto e branco'], ['layers', 'Sobre camadas']], p.view, (v) => { p.view = v; E.requestRender(); }, { keepFocus: true, width: 170 }).el),
        el('h3.form-title', { text: 'Detecção de borda' }), sl('Raio', 'radius', 0, 250, 'px'),
        el('h3.form-title', { text: 'Ajustar borda' }), sl('Suavizar', 'smooth', 0, 100), sl('Difusão', 'feather', 0, 250, 'px'), sl('Contraste', 'contrast', 0, 100, '%'), sl('Deslocar borda', 'shift', -100, 100, '%'),
        el('h3.form-title', { text: 'Saída' }),
        UI.row('', UI.check('Descontaminar cores', p.decontam, (v) => { p.decontam = v; }).el),
        UI.row('Enviar para', UI.select([['selection', 'Seleção'], ['mask', 'Máscara de camada'], ['layer', 'Nova camada'], ['layerMask', 'Nova camada com máscara']], p.output, (v) => { p.output = v; }, { keepFocus: true, width: 200 }).el)
      ],
      footLeft: [UI.btn('Redefinir', () => { Object.assign(p, { radius: 0, smooth: 0, feather: 0, contrast: 0, shift: 0 }); cleanup(); U.store.set('refineEdge', p); refineDialog(doc); }, { small: true })],
      buttons: [{ label: 'Cancelar', onClick: cleanup }, { label: 'OK', primary: true, onClick: () => {
        cleanup();
        U.store.set('refineEdge', p);
        const r = refineAlpha(a0, img, R.w, R.h, p);
        const mC = IMG.alphaToCanvas(r.a, R.w, R.h);
        const full = U.createCanvas(doc.width, doc.height); full.getContext('2d').drawImage(mC, R.x, R.y);
        if (p.output === 'selection' || !L || L.type === 'group') { Sel.combine(doc, full, 'new'); IMG.commit('Refinar borda'); return; }
        if (p.output === 'mask') {
          L.mask = IMG.Layers.makeMask(full, 0, 0, 0);
          doc.selection = null; bus.emit('selection:change', doc); bus.emit('layers:change', doc); IMG.Engine.invalidate(); IMG.commit('Refinar borda');
          return;
        }
        // nova camada (com ou sem máscara) a partir dos pixels da camada ativa
        if (!L.canvas) { Sel.combine(doc, full, 'new'); IMG.commit('Refinar borda'); return; }
        const c = U.createCanvas(doc.width, doc.height), x = c.getContext('2d');
        x.drawImage(L.canvas, L.x, L.y);
        if (p.decontam && r.F) {
          const d = x.getImageData(R.x, R.y, R.w, R.h), k = p.amount / 100;
          for (let i = 0; i < R.w * R.h; i++) { const al = r.a[i]; if (al <= 0.02 || al >= 0.98) continue; for (let q = 0; q < 3; q++) d.data[i * 4 + q] += (r.F[i * 3 + q] - d.data[i * 4 + q]) * k * (1 - al); }
          x.putImageData(d, R.x, R.y);
        }
        const NL = IMG.Layers.fromCanvas(doc, c, L.name + ' ' + (window.NebulosaIdiomas ? NebulosaIdiomas.t('cópia') : 'cópia'), 0, 0);
        if (p.output === 'layer') { x.globalCompositeOperation = 'destination-in'; x.drawImage(full, 0, 0); IMG.markDirty(NL); }
        else NL.mask = IMG.Layers.makeMask(full, 0, 0, 0);
        L.visible = false;
        doc.selection = null; bus.emit('selection:change', doc);
        bus.emit('layers:change', doc); IMG.Engine.invalidate();
        IMG.commit('Refinar borda');
      } }],
      onClose: cleanup
    });
  }

  /* ==================================================================
     COMANDOS
     ================================================================== */
  function numDialog(title, label, def, max, fn, commit, extra) {
    const UI = IMG.UI;
    let v = def, cb = false;
    const body = [UI.row(label, UI.num({ value: def, min: 1, max, unit: 'px', width: 100, onInput: (x) => { v = x; } }).el)];
    if (extra) body.push(UI.row('', UI.check('Aplicar efeito nos limites da tela', false, (x) => { cb = x; }).el));
    UI.dialog({ title, width: 340, body, buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => { fn(v, cb); IMG.commit(commit); } }] });
  }

  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, H) => {
    const doc = H.doc, has = H.has, hasSel = H.hasSel;
    C('select.border', 'Borda…', () => numDialog('Selecionar borda', 'Largura', 10, 200, (v) => Sel.border(doc(), v), 'Borda'), { enabled: hasSel });
    C('select.smooth', 'Suavizar…', () => numDialog('Suavizar seleção', 'Raio de amostra', 4, 500, (v) => Sel.smooth(doc(), v), 'Suavizar', true), { enabled: hasSel });
    C('select.expand', 'Expandir…', () => numDialog('Expandir seleção', 'Expandir em', 4, 500, (v, cb) => Sel.expand(doc(), v, cb), 'Expandir', true), { enabled: hasSel });
    C('select.contract', 'Contrair…', () => numDialog('Contrair seleção', 'Contrair em', 4, 500, (v, cb) => Sel.contract(doc(), v, cb), 'Contrair', true), { enabled: hasSel });
    C('select.feather', 'Difusão…', () => numDialog('Difundir seleção', 'Raio de difusão', 8, 1000, (v) => Sel.feather(doc(), v), 'Difusão', true), { enabled: hasSel, keys: ['shift+f6'] });
    C('select.grow', 'Expandir semelhantes', () => { Sel.similar(doc(), true); IMG.commit('Expandir semelhantes'); }, { enabled: hasSel });
    C('select.similar', 'Semelhante', () => { Sel.similar(doc(), false); IMG.commit('Semelhante'); }, { enabled: hasSel });
    C('select.colorRange', 'Intervalo de cores…', () => colorRangeDialog(doc()), { enabled: has });
    C('select.refineEdge', 'Refinar borda…', () => refineDialog(doc()), { enabled: hasSel, keys: ['ctrl+alt+r'] });
    C('select.quickMask', 'Editar no modo de máscara rápida', () => QM.toggle(doc()), { enabled: has, keys: ['q'], checked: () => !!(IMG.app.doc && IMG.app.doc.quickMask) });
    C('select.quickMaskOptions', 'Opções de máscara rápida…', () => QM.optionsDialog());
    C('select.save', 'Salvar seleção…', () => saveSelectionDialog(doc()), { enabled: hasSel });
    C('select.load', 'Carregar seleção…', () => loadSelectionDialog(doc()), { enabled: has });
    C('select.none', 'Desmarcar', () => { if (Sel.clear(doc())) IMG.commit('Desmarcar'); }, { enabled: () => hasSel() || !!(IMG.app.doc && IMG.app.doc.quickMask), keys: ['ctrl+d'] });
    C('select.findLayers', 'Localizar camadas', () => {
      const d = doc();
      IMG.UI.prompt('Localizar camadas', 'Nome contém', '').then((q) => {
        if (!q) return;
        const all = IMG.Layers.all(d).filter((L) => L.name.toLowerCase().includes(q.toLowerCase()));
        if (!all.length) { IMG.UI.toast('Nenhuma camada encontrada.'); return; }
        d.selected = new Set(all.map((L) => L.id)); d.activeId = all[all.length - 1].id;
        bus.emit('layers:select');
      });
    }, { enabled: has, keys: ['ctrl+alt+shift+f'] });
  });

  bus.on('history:change', (doc) => { if (doc && doc.quickMask && doc.selection) { doc.selection.x = 0; doc.selection.y = 0; doc.selection.bg = 0; } });
  void blurFloat;
})();
