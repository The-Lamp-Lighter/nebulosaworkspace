/* ==========================================================================
   Imaginarium — Transformação livre (Ctrl+T) e Editar › Transformar
   Modelo: o retângulo de origem (box) é levado a um quadrilátero de destino
   (quad) por uma homografia — cobre escala, rotação, inclinação, distorção e
   perspectiva. A Deformação usa uma malha de Bézier 4×4 ou uma predefinição.
   Também: Transformar novamente, Transformar seleção, Escala sensível ao
   conteúdo e utilitários (IMG.Transform.scaleLayer, rotateLayer…).
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const Layers = IMG.Layers, Sel = IMG.Selection;
  const T = () => IMG.Tools;

  /* ==================================================================
     MATEMÁTICA
     ================================================================== */
  function solve(A, b) {
    const n = b.length;
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      const d = A[c][c]; if (Math.abs(d) < 1e-12) return null;
      for (let r = c + 1; r < n; r++) { const f = A[r][c] / d; if (!f) continue; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
    }
    const x = new Array(n);
    for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]; x[r] = s / A[r][r]; }
    return x;
  }
  /** Homografia que leva src[i] → dst[i] (4 pontos). */
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const { x, y } = src[i], X = dst[i].x, Y = dst[i].y;
      A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
      A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
    }
    const h = solve(A, b);
    return h ? [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1] : [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
  const hApply = (H, x, y) => { const w = H[6] * x + H[7] * y + H[8]; return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w }; };
  function hInvert(m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-14) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const inv = [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((v) => v / det);
    const k = inv[8] || 1;
    return inv.map((v) => v / k);
  }
  const hMul = (A, B) => { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return o.map((v) => v / o[8]); };
  const boxPts = (b) => [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }];
  const isAffine = (H) => Math.abs(H[6]) < 1e-9 && Math.abs(H[7]) < 1e-9;
  const toMatrix = (H) => new DOMMatrix([H[0], H[3], H[1], H[4], H[2], H[5]]);
  const rot = (p, c, a) => { const cs = Math.cos(a), sn = Math.sin(a), x = p.x - c.x, y = p.y - c.y; return { x: c.x + x * cs - y * sn, y: c.y + x * sn + y * cs }; };
  IMG.Homography = { solve, homography, apply: hApply, invert: hInvert, mul: hMul, isAffine, toMatrix };

  /* ==================================================================
     RENDERIZAÇÃO
     ================================================================== */
  /** Desenha o triângulo de imagem (s0,s1,s2 em px do src) em (d0,d1,d2), com leve expansão contra emendas. */
  function drawTri(ctx, img, s0, s1, s2, d0, d1, d2, grow) {
    const den = s0.x * (s2.y - s1.y) - s1.x * s2.y + s2.x * s1.y + (s1.x - s2.x) * s0.y;
    if (Math.abs(den) < 1e-9) return;
    const a = -(s0.y * (d2.x - d1.x) - s1.y * d2.x + s2.y * d1.x + (s1.y - s2.y) * d0.x) / den;
    const b = (s1.y * d2.y + s0.y * (d1.y - d2.y) - s2.y * d1.y + (s2.y - s1.y) * d0.y) / den;
    const c = (s0.x * (d2.x - d1.x) - s1.x * d2.x + s2.x * d1.x + (s1.x - s2.x) * d0.x) / den;
    const d = -(s1.x * d2.y + s0.x * (d1.y - d2.y) - s2.x * d1.y + (s2.x - s1.x) * d0.y) / den;
    const e = (s0.x * (s2.y * d1.x - s1.y * d2.x) + s0.y * (s1.x * d2.x - s2.x * d1.x) + (s2.x * s1.y - s1.x * s2.y) * d0.x) / den;
    const f = (s0.x * (s2.y * d1.y - s1.y * d2.y) + s0.y * (s1.x * d2.y - s2.x * d1.y) + (s2.x * s1.y - s1.x * s2.y) * d0.y) / den;
    const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3, g = grow == null ? 0.6 : grow;
    const ex = (p) => { const dx = p.x - cx, dy = p.y - cy, l = Math.hypot(dx, dy) || 1; return { x: p.x + (dx / l) * g, y: p.y + (dy / l) * g }; };
    const e0 = ex(d0), e1 = ex(d1), e2 = ex(d2);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(e0.x, e0.y); ctx.lineTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.closePath(); ctx.clip();
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
  /** Malha (cols×rows células): src(i, j) e dst(i, j) retornam pontos (src em px do canvas de origem, dst no ctx). */
  function drawMesh(ctx, img, cols, rows, src, dst, grow) {
    const S = [], D = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { S.push(src(i, j)); D.push(dst(i, j)); }
    const k = (i, j) => j * (cols + 1) + i;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = k(i, j), b = k(i + 1, j), c = k(i + 1, j + 1), d = k(i, j + 1);
      drawTri(ctx, img, S[a], S[b], S[c], D[a], D[b], D[c], grow);
      drawTri(ctx, img, S[a], S[c], S[d], D[a], D[c], D[d], grow);
    }
  }
  IMG.drawMesh = drawMesh;
  IMG.drawTri = drawTri;

  /** Amostragem por pixel com homografia inversa (destino → origem). Retorna canvas R.w×R.h. */
  function renderProjective(src, sx, sy, Hinv, R, interp) {
    const sw = src.width, sh = src.height;
    const sd = src.getContext('2d').getImageData(0, 0, sw, sh).data;
    const out = new ImageData(R.w, R.h), od = out.data;
    const near = interp === 'nearest';
    for (let y = 0; y < R.h; y++) {
      for (let x = 0; x < R.w; x++) {
        const p = hApply(Hinv, R.x + x + 0.5, R.y + y + 0.5);
        const u = p.x - sx - 0.5, v = p.y - sy - 0.5;
        if (u < -1 || v < -1 || u > sw || v > sh) continue;
        const o = (y * R.w + x) * 4;
        if (near) {
          const ix = Math.round(u), iy = Math.round(v);
          if (ix < 0 || iy < 0 || ix >= sw || iy >= sh) continue;
          const i = (iy * sw + ix) * 4; od[o] = sd[i]; od[o + 1] = sd[i + 1]; od[o + 2] = sd[i + 2]; od[o + 3] = sd[i + 3];
          continue;
        }
        const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
        let r = 0, g = 0, b = 0, a = 0;
        for (let k = 0; k < 4; k++) {
          const xx = x0 + (k & 1), yy = y0 + (k >> 1);
          if (xx < 0 || yy < 0 || xx >= sw || yy >= sh) continue;
          const wgt = ((k & 1) ? fx : 1 - fx) * ((k >> 1) ? fy : 1 - fy), i = (yy * sw + xx) * 4, al = sd[i + 3] * wgt;
          r += sd[i] * al; g += sd[i + 1] * al; b += sd[i + 2] * al; a += al;
        }
        if (a > 0) { od[o] = r / a; od[o + 1] = g / a; od[o + 2] = b / a; od[o + 3] = a; }
      }
    }
    const c = U.createCanvas(R.w, R.h); c.getContext('2d').putImageData(out, 0, 0);
    return c;
  }
  IMG.renderProjective = renderProjective;

  /* ---------- predefinições de deformação ---------- */
  const WARPS = [['custom', 'Personalizada'], null, ['arc', 'Arco'], ['arcLower', 'Arco inferior'], ['arcUpper', 'Arco superior'], ['arch', 'Arco abaulado'], ['bulge', 'Protuberância'],
    ['shellLower', 'Concha inferior'], ['shellUpper', 'Concha superior'], ['flag', 'Bandeira'], ['wave', 'Onda'], ['fish', 'Peixe'], ['rise', 'Ascendente'], ['fisheye', 'Olho de peixe'],
    ['inflate', 'Inflar'], ['squeeze', 'Apertar'], ['twist', 'Torcer']];
  /** (x, y) em [-1, 1]; retorna o ponto deformado. */
  function warpPreset(style, x, y, b, hd, vd, vertical) {
    if (vertical) { const t = x; x = y; y = t; }
    let X = x, Y = y;
    const q = 1 - x * x;
    switch (style) {
      case 'arc': { const a = b * Math.PI * 0.5 * x, r = 1 + (y) * 0.0; void r; Y = y - b * q * 0.55; X = x * (1 - b * y * 0.25); void a; break; }
      case 'arcLower': Y = y + b * q * 0.55 * ((y + 1) / 2); break;
      case 'arcUpper': Y = y - b * q * 0.55 * ((1 - y) / 2); break;
      case 'arch': Y = y - b * q * 0.55; break;
      case 'bulge': Y = y * (1 + b * q * 0.55); break;
      case 'shellLower': Y = y + b * (1 - q) * 0.55 * ((y + 1) / 2) - b * 0.2 * ((y + 1) / 2); break;
      case 'shellUpper': Y = y - b * (1 - q) * 0.55 * ((1 - y) / 2) + b * 0.2 * ((1 - y) / 2); break;
      case 'flag': Y = y + b * Math.sin(Math.PI * x) * 0.35; break;
      case 'wave': Y = y + b * Math.sin(Math.PI * x + y * Math.PI * 0.5) * 0.3; break;
      case 'fish': Y = y * (1 + b * q * 0.5) - b * 0.25 * Math.sin(Math.PI * x) * (1 - Math.abs(y) * 0.5); break;
      case 'rise': Y = y - b * 0.45 * Math.sin(Math.PI * x / 2); break;
      case 'fisheye': { const r = Math.min(1, Math.hypot(x, y) / Math.SQRT2), k = 1 + b * (1 - r * r) * 0.6; X = x * k; Y = y * k; break; }
      case 'inflate': X = x * (1 + b * (1 - y * y) * 0.4); Y = y * (1 + b * q * 0.4); break;
      case 'squeeze': X = x * (1 - b * (1 - y * y) * 0.4); Y = y * (1 + b * q * 0.4); break;
      case 'twist': { const r = Math.min(1, Math.hypot(x, y) / Math.SQRT2), a = b * Math.PI * 0.6 * (1 - r); const cs = Math.cos(a), sn = Math.sin(a); X = x * cs - y * sn; Y = x * sn + y * cs; break; }
      default: break;
    }
    if (hd) { const k = 1 + hd * X * 0.5; Y *= k; X += hd * 0.15 * (1 - Y * Y) * 0; }
    if (vd) { const k = 1 + vd * Y * 0.5; X *= k; }
    if (vertical) { const t = X; X = Y; Y = t; }
    return { x: X, y: Y };
  }
  IMG.WARP_PRESETS = WARPS;
  IMG.warpPreset = warpPreset;

  const bern = (t) => { const m = 1 - t; return [m * m * m, 3 * t * m * m, 3 * t * t * m, t * t * t]; };
  /** Ponto da superfície de Bézier (16 pontos, linha a linha) em (u, v) ∈ [0,1]. */
  function bezierPatch(P, u, v) {
    const bu = bern(u), bv = bern(v);
    let x = 0, y = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const w = bu[i] * bv[j], p = P[j * 4 + i]; x += p.x * w; y += p.y * w; }
    return { x, y };
  }
  IMG.bezierPatch = bezierPatch;

  /* ==================================================================
     SESSÃO DE TRANSFORMAÇÃO
     ================================================================== */
  const TF = (IMG.Transform = {
    s: null,
    last: null,

    /** Inicia. o: { mode, selOnly, cas, items } */
    begin(o = {}) {
      const doc = IMG.app.doc, UI = IMG.UI;
      if (!doc) return false;
      if (this.s) return false;
      const mode = o.mode || 'free';
      let items = [], box = null, sel = false, selBase = null;
      let pathItem = null;
      if (o.pathItem) {
        const pi = o.pathItem, b = IMG.Paths.bounds(pi.tg.path, pi.subs);
        if (!b || (b.w < 0.5 && b.h < 0.5)) { UI.toast('O demarcador está vazio.'); return false; }
        box = { x: b.x, y: b.y, w: Math.max(1, b.w), h: Math.max(1, b.h) };
        pathItem = { tg: pi.tg, subs: pi.subs, orig: IMG.Paths.clone(pi.tg.path) };
      } else if (o.selOnly) {
        if (!doc.selection || !doc.selection.bounds) { UI.toast('Não há seleção para transformar.'); return false; }
        box = { ...doc.selection.bounds }; selBase = U.cloneCanvas(doc.selection.canvas);
      } else {
        const L0 = doc.active;
        let layers = o.items ? o.items.slice() : Layers.selectedLayers(doc).filter((L) => L.type !== 'adjust');
        if (!layers.length && L0) layers = [L0];
        // grupos: transforma as camadas de dentro
        const flat = [];
        layers.forEach((L) => { if (L.type === 'group') Layers.walk(L.children, (q) => { if (q.type !== 'group' && q.type !== 'adjust') flat.push(q); }); else flat.push(L); });
        layers = Array.from(new Set(flat));
        if (!layers.length) { UI.toast('Selecione uma camada para transformar.'); return false; }
        if (layers.some((L) => Layers.isLocked(L) || L.lockPos)) { UI.toast('A camada está bloqueada.'); return false; }
        if (layers.some((L) => L.isBg)) { layers.filter((L) => L.isBg).forEach((L) => Layers.fromBackground(doc, L)); bus.emit('layers:change', doc); }
        const useSel = !o.items && doc.selection && layers.length === 1 && (layers[0].type === 'raster' || layers[0].type === 'fill') && !doc.quickMask;
        for (const L of layers) {
          const it = { L, kind: L.type === 'text' || L.type === 'shape' || (L.type === 'smart' && L.smart) ? L.type : 'raster', orig: { canvas: L.canvas, x: L.x, y: L.y }, pv: null };
          if (!L.canvas) continue;
          if (useSel) {
            const fl = U.createCanvas(doc.width, doc.height);
            fl.getContext('2d').drawImage(L.canvas, L.x, L.y);
            Sel.clip(doc, fl);
            const ab = IMG.alphaBounds(fl);
            if (!ab) { UI.toast('Não há pixels desta camada dentro da seleção.'); return false; }
            it.src = U.createCanvas(ab.w, ab.h); it.src.getContext('2d').drawImage(fl, -ab.x, -ab.y);
            it.sx = ab.x; it.sy = ab.y;
            it.base = U.cloneCanvas(L.canvas); const bc = it.base.getContext('2d'); bc.globalCompositeOperation = 'destination-out'; bc.drawImage(doc.selection.canvas, -L.x, -L.y);
            it.baseX = L.x; it.baseY = L.y; it.kind = 'raster';
            sel = true; selBase = U.cloneCanvas(doc.selection.canvas);
            box = U.rectUnion(box, ab);
          } else {
            const cb = L.contentBounds();
            if (!cb) continue;
            it.src = U.createCanvas(cb.w, cb.h); it.src.getContext('2d').drawImage(L.canvas, L.x - cb.x, L.y - cb.y);
            it.sx = cb.x; it.sy = cb.y;
            box = U.rectUnion(box, cb);
          }
          // máscara vinculada
          if (L.mask && L.mask.linked !== false && L.mask.canvas && !useSel) it.mask = { canvas: U.cloneCanvas(L.mask.canvas), x: L.mask.x, y: L.mask.y, bg: L.mask.bg == null ? 255 : L.mask.bg, orig: L.mask.canvas, ox: L.mask.x, oy: L.mask.y };
          items.push(it);
        }
        if (!items.length || !box) { UI.toast('A camada está vazia.'); return false; }
      }
      const s = this.s = {
        doc, items, box, sel, selBase, selOnly: !!o.selOnly, cas: !!o.cas, mode, pathItem,
        quad: boxPts(box), ref: { u: 0.5, v: 0.5 }, warp: null, interp: U.store.get('tfInterp', 'bicubic')
      };
      if (o.H) s.quad = boxPts(box).map((p) => hApply(o.H, p.x, p.y));
      items.forEach((it) => {
        it.pv = U.createCanvas(doc.width, doc.height);
        it.L.canvas = it.pv; it.L.x = 0; it.L.y = 0;
        if (it.mask) { it.mpv = U.createCanvas(doc.width, doc.height); it.L.mask.canvas = it.mpv; it.L.mask.x = 0; it.L.mask.y = 0; }
      });
      IMG.Engine.hideAnts = !!(sel || o.selOnly);
      if (o.silent) return true;
      if (mode === 'warp') this.startWarp();
      this.preview();
      T().set('transform');
      IMG.UI.renderOptions();
      return true;
    },

    H(s) { return homography(boxPts(s.box), s.quad); },
    refPt(s) { const b = s.box; return hApply(this.H(s), b.x + s.ref.u * b.w, b.y + s.ref.v * b.h); },

    /** Ponto de destino para (u, v) ∈ [0,1]² (considera a deformação). */
    mapUV(s, H, u, v) {
      const b = s.box;
      if (s.warp) {
        if (s.warp.style === 'custom') return bezierPatch(s.warp.pts, u, v);
        const w = s.warp, p = warpPreset(w.style, u * 2 - 1, v * 2 - 1, w.bend / 100, w.h / 100, w.v / 100, w.vertical);
        return hApply(H, b.x + (p.x + 1) / 2 * b.w, b.y + (p.y + 1) / 2 * b.h);
      }
      return hApply(H, b.x + u * b.w, b.y + v * b.h);
    },

    /** Leva um ponto do documento (na caixa de origem) ao destino. */
    mapDoc(s, H, x, y) {
      if (!s.warp) return hApply(H, x, y);
      return this.mapUV(s, H, (x - s.box.x) / s.box.w, (y - s.box.y) / s.box.h);
    },
    /** Aplica a transformação atual ao demarcador (a partir do original). */
    applyPath(s) {
      const pi = s.pathItem, H = this.H(s), P = IMG.Paths;
      pi.tg.path.subs = JSON.parse(JSON.stringify(pi.orig.subs));
      P.map(pi.tg.path, (x, y) => this.mapDoc(s, H, x, y), pi.subs);
      if (pi.tg.kind === 'shape') { pi.tg.L.shape.live = null; IMG.Shapes.render(pi.tg.L); }
      else if (pi.tg.kind === 'vmask') P.touch(pi.tg.L.vmask);
    },

    /** Desenha "src" (em sx, sy do documento) transformado em ctx (origem do ctx em ox, oy). */
    drawItem(ctx, s, src, sx, sy, ox, oy, fine, final) {
      const H = this.H(s), b = s.box;
      if (!s.warp && isAffine(H)) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, -ox, -oy);
        ctx.transform(H[0], H[3], H[1], H[4], H[2], H[5]);
        ctx.imageSmoothingEnabled = s.interp !== 'nearest';
        ctx.imageSmoothingQuality = s.interp === 'bilinear' ? 'low' : 'high';
        ctx.drawImage(src, sx, sy);
        ctx.restore();
        return;
      }
      if (!s.warp && final) {
        const Hi = hInvert(H);
        const pts = [{ x: sx, y: sy }, { x: sx + src.width, y: sy }, { x: sx + src.width, y: sy + src.height }, { x: sx, y: sy + src.height }].map((p) => hApply(H, p.x, p.y));
        const R0 = { x: Math.floor(Math.min(...pts.map((p) => p.x))), y: Math.floor(Math.min(...pts.map((p) => p.y))) };
        R0.w = Math.ceil(Math.max(...pts.map((p) => p.x))) - R0.x; R0.h = Math.ceil(Math.max(...pts.map((p) => p.y))) - R0.y;
        const R = U.rectIntersect(R0, { x: ox, y: oy, w: ctx.canvas.width, h: ctx.canvas.height });
        if (!R) return;
        ctx.drawImage(renderProjective(src, sx, sy, Hi, R, s.interp), R.x - ox, R.y - oy);
        return;
      }
      const n = fine ? (s.warp ? 56 : 32) : (s.warp ? 24 : 12);
      const cols = Math.max(1, Math.min(n, Math.ceil(src.width / 4))), rows = Math.max(1, Math.min(n, Math.ceil(src.height / 4)));
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawMesh(ctx, src, cols, rows,
        (i, j) => ({ x: (i / cols) * src.width, y: (j / rows) * src.height }),
        (i, j) => { const u = (sx + (i / cols) * src.width - b.x) / b.w, v = (sy + (j / rows) * src.height - b.y) / b.h; const p = this.mapUV(s, H, u, v); return { x: p.x - ox, y: p.y - oy }; }, fine ? 0.45 : 0.6);
      ctx.restore();
    },

    /** Limites do destino de um retângulo de origem. */
    destBounds(s, x, y, w, h) {
      const H = this.H(s), pts = [];
      const n = s.warp ? 8 : 1;
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
        if (s.warp) { const u = (x + (i / n) * w - s.box.x) / s.box.w, v = (y + (j / n) * h - s.box.y) / s.box.h; pts.push(this.mapUV(s, H, u, v)); }
        else pts.push(hApply(H, x + (i / n) * w, y + (j / n) * h));
      }
      const x0 = Math.floor(Math.min(...pts.map((p) => p.x))), y0 = Math.floor(Math.min(...pts.map((p) => p.y)));
      return { x: x0 - 1, y: y0 - 1, w: Math.ceil(Math.max(...pts.map((p) => p.x))) - x0 + 2, h: Math.ceil(Math.max(...pts.map((p) => p.y))) - y0 + 2 };
    },

    preview() {
      const s = this.s; if (!s) return;
      const doc = s.doc;
      if (s.pathItem) { this.applyPath(s); IMG.Engine.invalidate(); IMG.Engine.requestRender(); return; }
      for (const it of s.items) {
        const ctx = it.pv.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, it.pv.width, it.pv.height);
        if (it.base) ctx.drawImage(it.base, it.baseX, it.baseY);
        this.drawItem(ctx, s, it.src, it.sx, it.sy, 0, 0, false, false);
        IMG.markDirty(it.L);
        if (it.mask) {
          const m = it.mpv.getContext('2d');
          m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over';
          m.fillStyle = 'rgba(255,255,255,' + it.mask.bg / 255 + ')'; m.clearRect(0, 0, doc.width, doc.height); m.fillRect(0, 0, doc.width, doc.height);
          this.clearDestArea(m, s, it.mask.x, it.mask.y, it.mask.canvas.width, it.mask.canvas.height, 0, 0);
          this.drawItem(m, s, it.mask.canvas, it.mask.x, it.mask.y, 0, 0, false, false);
          IMG.markDirty(it.L.mask);
        }
        IMG.Effects.invalidate(it.L);
      }
      IMG.Engine.invalidate();
      IMG.Engine.requestRender();
    },

    /** Apaga a área de destino de um retângulo de origem (para máscaras com fundo). */
    clearDestArea(ctx, s, x, y, w, h, ox, oy) {
      const H = this.H(s), n = s.warp ? 16 : 1, pts = [];
      const P = (u, v) => { const uu = (x + u * w - s.box.x) / s.box.w, vv = (y + v * h - s.box.y) / s.box.h; const p = s.warp ? this.mapUV(s, H, uu, vv) : hApply(H, x + u * w, y + v * h); return { x: p.x - ox, y: p.y - oy }; };
      for (let i = 0; i <= n; i++) pts.push(P(i / n, 0));
      for (let i = 0; i <= n; i++) pts.push(P(1, i / n));
      for (let i = n; i >= 0; i--) pts.push(P(i / n, 1));
      for (let i = n; i >= 0; i--) pts.push(P(0, i / n));
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
      ctx.restore();
    },

    isIdentity(s) { if (s.warp) return false; const q = s.quad, b = boxPts(s.box); return q.every((p, i) => Math.abs(p.x - b[i].x) < 0.01 && Math.abs(p.y - b[i].y) < 0.01); },

    restoreItems(s) {
      if (s.pathItem && !s.keepPath) { const pi = s.pathItem; pi.tg.path.subs = JSON.parse(JSON.stringify(pi.orig.subs)); if (pi.tg.kind === 'shape') IMG.Shapes.render(pi.tg.L); else if (pi.tg.kind === 'vmask') IMG.Paths.touch(pi.tg.L.vmask); }
      s.items.forEach((it) => {
        it.L.canvas = it.orig.canvas; it.L.x = it.orig.x; it.L.y = it.orig.y; IMG.markDirty(it.L);
        if (it.mask) { it.L.mask.canvas = it.mask.orig; it.L.mask.x = it.mask.ox; it.L.mask.y = it.mask.oy; IMG.markDirty(it.L.mask); }
        IMG.Effects.invalidate(it.L);
      });
    },

    commit() {
      const s = this.s; if (!s) return;
      if (this.isIdentity(s)) { this.cancel(); return; }
      const doc = s.doc, H = this.H(s);
      if (s.pathItem) {
        this.applyPath(s);
        if (s.pathItem.tg.kind === 'shape') IMG.Shapes.render(s.pathItem.tg.L);
        this.s = null; IMG.Engine.hideAnts = false; IMG.Engine.invalidate();
        this.last = { H, warp: s.warp ? JSON.parse(JSON.stringify(s.warp)) : null };
        IMG.Paths.changed(doc, s.pathItem.tg, 'Transformar demarcador');
        if (T().activeId === 'transform') T().back();
        return;
      }
      this.restoreItems(s);
      if (s.cas) { this.s = null; this.finishCAS(s); return; }
      const affine = !s.warp && isAffine(H);
      const M = affine ? toMatrix(H) : null;
      let rasterized = false;
      for (const it of s.items) {
        const L = it.L;
        if (it.kind !== 'raster' && affine && !s.sel && IMG.vectorTransform && IMG.vectorTransform[it.kind]) { IMG.vectorTransform[it.kind](L, M, s); continue; }
        if (it.kind !== 'raster' && !affine && !s.sel && IMG.vectorTransformFn && IMG.vectorTransformFn[it.kind]) { IMG.vectorTransformFn[it.kind](L, (x, y) => this.mapDoc(s, H, x, y)); continue; }
        if (it.kind !== 'raster') { Layers.rasterize ? Layers.rasterize(doc, L) : (L.type = 'raster'); rasterized = true; }
        let R = this.destBounds(s, it.sx, it.sy, it.src.width, it.src.height);
        if (it.base) R = U.rectUnion(R, { x: it.baseX, y: it.baseY, w: it.base.width, h: it.base.height });
        if (R.w > 16000 || R.h > 16000) R = U.rectIntersect(R, U.rectInflate(doc.rect, 4000)) || doc.rect;
        const c = U.createCanvas(Math.max(1, R.w), Math.max(1, R.h)), x = c.getContext('2d');
        if (it.base) x.drawImage(it.base, it.baseX - R.x, it.baseY - R.y);
        this.drawItem(x, s, it.src, it.sx, it.sy, R.x, R.y, true, true);
        L.setCanvas(c, R.x, R.y);
        if (it.mask) {
          const m = L.mask, mb = this.destBounds(s, it.mask.x, it.mask.y, it.mask.canvas.width, it.mask.canvas.height);
          const R2 = U.rectIntersect(mb, U.rectInflate(doc.rect, 4000)) || doc.rect;
          const mc = U.createCanvas(Math.max(1, R2.w), Math.max(1, R2.h)), mx = mc.getContext('2d');
          mx.fillStyle = 'rgba(255,255,255,' + it.mask.bg / 255 + ')'; mx.fillRect(0, 0, mc.width, mc.height);
          this.clearDestArea(mx, s, it.mask.x, it.mask.y, it.mask.canvas.width, it.mask.canvas.height, R2.x, R2.y);
          this.drawItem(mx, s, it.mask.canvas, it.mask.x, it.mask.y, R2.x, R2.y, true, true);
          m.canvas = mc; m.x = R2.x; m.y = R2.y; m._snap = null; IMG.markDirty(m);
        }
        IMG.Effects.invalidate(L);
      }
      if ((s.sel || s.selOnly) && s.selBase) {
        const sc = Sel.ensure(doc).canvas.getContext('2d');
        sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, doc.width, doc.height);
        const b = s.box, piece = U.createCanvas(b.w, b.h); piece.getContext('2d').drawImage(s.selBase, -b.x, -b.y);
        this.drawItem(sc, s, piece, b.x, b.y, 0, 0, true, true);
        IMG.markDirty(doc.selection);
      }
      this.last = { H, warp: s.warp ? JSON.parse(JSON.stringify(s.warp)) : null, boxRel: s.box };
      this.s = null;
      IMG.Engine.hideAnts = false;
      if (doc.selection) Sel.update(doc);
      bus.emit('layers:change', doc);
      IMG.Engine.invalidate();
      if (rasterized) IMG.UI.toast('A camada vetorial/de texto foi rasterizada para esta transformação.');
      IMG.commit(s.selOnly ? 'Transformar seleção' : s.warp ? 'Deformação' : 'Transformação livre');
      if (T().activeId === 'transform') T().back();
    },

    cancel() {
      const s = this.s; if (!s) return;
      this.restoreItems(s);
      this.s = null;
      IMG.Engine.hideAnts = false;
      IMG.Engine.invalidate();
      if (T().activeId === 'transform') T().back();
    },

    /* ---------- deformação ---------- */
    startWarp() {
      const s = this.s; if (!s || s.warp) return;
      const H = this.H(s), b = s.box, pts = [];
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) pts.push(hApply(H, b.x + (i / 3) * b.w, b.y + (j / 3) * b.h));
      s.warp = { style: 'custom', bend: 50, h: 0, v: 0, vertical: false, pts };
      s.mode = 'warp';
      this.preview(); IMG.UI.renderOptions();
    },
    /** Converte a predefinição atual em pontos de controle (para editar à mão). */
    presetToCustom() {
      const s = this.s; if (!s || !s.warp || s.warp.style === 'custom') return;
      const H = this.H(s), pts = [];
      // ajuste por mínimos quadrados: amostra a superfície e resolve os 16 pontos
      const N = 9, rows = [], bx = [], by = [];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const u = i / (N - 1), v = j / (N - 1), p = this.mapUV(s, H, u, v), bu = bern(u), bv = bern(v), r = [];
        for (let jj = 0; jj < 4; jj++) for (let ii = 0; ii < 4; ii++) r.push(bu[ii] * bv[jj]);
        rows.push(r); bx.push(p.x); by.push(p.y);
      }
      const AtA = Array.from({ length: 16 }, () => new Array(16).fill(0)), Atx = new Array(16).fill(0), Aty = new Array(16).fill(0);
      rows.forEach((r, k) => { for (let a = 0; a < 16; a++) { Atx[a] += r[a] * bx[k]; Aty[a] += r[a] * by[k]; for (let c = 0; c < 16; c++) AtA[a][c] += r[a] * r[c]; } });
      const X = solve(AtA.map((r) => r.slice()), Atx.slice()), Y = solve(AtA.map((r) => r.slice()), Aty.slice());
      if (!X || !Y) return;
      for (let k = 0; k < 16; k++) pts.push({ x: X[k], y: Y[k] });
      s.warp.style = 'custom'; s.warp.pts = pts;
    },

    /* ---------- outras operações ---------- */
    /** Aplica uma transformação afim direta (girar 90°, espelhar…) em torno do ponto de referência. */
    applyQuick(kind) {
      const s = this.s; if (!s) return;
      const c = this.refPt(s);
      const f = (p) => {
        if (kind === 'rot180') return rot(p, c, Math.PI);
        if (kind === 'rot90') return rot(p, c, Math.PI / 2);
        if (kind === 'rot270') return rot(p, c, -Math.PI / 2);
        if (kind === 'flipH') { const H = this.H(s), Hi = hInvert(H), q = hApply(Hi, p.x, p.y), cc = hApply(Hi, c.x, c.y); return hApply(H, 2 * cc.x - q.x, q.y); }
        if (kind === 'flipV') { const H = this.H(s), Hi = hInvert(H), q = hApply(Hi, p.x, p.y), cc = hApply(Hi, c.x, c.y); return hApply(H, q.x, 2 * cc.y - q.y); }
        return p;
      };
      if (kind === 'flipH' || kind === 'flipV') {
        // espelhar no espaço de origem: troca os cantos
        const q = s.quad.slice();
        if (kind === 'flipH') s.quad = [q[1], q[0], q[3], q[2]].map((p) => p); else s.quad = [q[3], q[2], q[1], q[0]];
        const H = homography(boxPts(s.box), q), Hn = homography(boxPts(s.box), s.quad), b = s.box;
        const rs = hApply(H, b.x + s.ref.u * b.w, b.y + s.ref.v * b.h), rn = hApply(Hn, b.x + s.ref.u * b.w, b.y + s.ref.v * b.h);
        const dx = rs.x - rn.x, dy = rs.y - rn.y;
        s.quad = s.quad.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        if (s.warp && s.warp.pts) { const P = s.warp.pts.slice(); const np = []; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) np.push(kind === 'flipH' ? P[j * 4 + (3 - i)] : P[(3 - j) * 4 + i]); s.warp.pts = np.map((p) => ({ x: p.x + dx, y: p.y + dy })); }
      } else {
        s.quad = s.quad.map(f);
        if (s.warp && s.warp.pts) s.warp.pts = s.warp.pts.map(f);
      }
      this.preview(); IMG.UI.renderOptions();
    },

    /** Parâmetros (afins) do quad: { x, y, w%, h%, angle, skH, skV }. */
    params(s) {
      const q = s.quad, b = s.box, r = this.refPt(s);
      const ux = q[1].x - q[0].x, uy = q[1].y - q[0].y, vx = q[3].x - q[0].x, vy = q[3].y - q[0].y;
      const lu = Math.hypot(ux, uy) || 1e-9, hx = ux / lu, hy = uy / lu, nx = -hy, ny = hx;
      const vn = vx * nx + vy * ny, vu = vx * hx + vy * hy;
      return { x: r.x, y: r.y, w: (lu / b.w) * 100, h: (vn / b.h) * 100, angle: U.deg(Math.atan2(uy, ux)), skH: U.deg(Math.atan2(vu, vn)), skV: s.skV || 0 };
    },
    setParams(p) {
      const s = this.s; if (!s) return;
      const b = s.box, a = U.rad(p.angle), cs = Math.cos(a), sn = Math.sin(a);
      const W = (p.w / 100) * b.w, Hh = (p.h / 100) * b.h;
      const ul = { x: W, y: W * Math.tan(U.rad(p.skV || 0)) }, vl = { x: Hh * Math.tan(U.rad(p.skH || 0)), y: Hh };
      const R = (v) => ({ x: v.x * cs - v.y * sn, y: v.x * sn + v.y * cs });
      const u = R(ul), v = R(vl);
      const tl = { x: p.x - u.x * s.ref.u - v.x * s.ref.v, y: p.y - u.y * s.ref.u - v.y * s.ref.v };
      const old = this.H(s);
      s.quad = [tl, { x: tl.x + u.x, y: tl.y + u.y }, { x: tl.x + u.x + v.x, y: tl.y + u.y + v.y }, { x: tl.x + v.x, y: tl.y + v.y }];
      s.skV = p.skV || 0;
      if (s.warp && s.warp.pts) { const Hn = this.H(s), Hm = hMul(Hn, hInvert(old)); s.warp.pts = s.warp.pts.map((q) => hApply(Hm, q.x, q.y)); }
      this.preview();
    },

    /* ---------- escala sensível ao conteúdo ---------- */
    finishCAS(s) {
      const doc = s.doc, it = s.items[0]; if (!it) return;
      const q = s.quad, W = Math.max(1, Math.round(Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y))), Hh = Math.max(1, Math.round(Math.hypot(q[3].x - q[0].x, q[3].y - q[0].y)));
      const done = IMG.UI.busy('Escala sensível ao conteúdo…');
      setTimeout(() => {
        try {
          let protect = null;
          if (s.casProtect && s.casProtect !== 'none') {
            const ch = (doc.channels || []).find((c) => c.id === s.casProtect);
            if (ch) { const pc = U.createCanvas(it.src.width, it.src.height); pc.getContext('2d').drawImage(ch.canvas, -it.sx, -it.sy); const pd = pc.getContext('2d').getImageData(0, 0, pc.width, pc.height).data; protect = new Uint8Array(pc.width * pc.height); for (let i = 0; i < protect.length; i++) protect[i] = pd[i * 4 + 3] > 127 ? 1 : 0; }
          }
          const out = seamCarve(it.src, W, Hh, protect, s.casSkin);
          const tl = q[0];
          const c = U.createCanvas(out.width, out.height); c.getContext('2d').drawImage(out, 0, 0);
          if (it.base) { const R = U.rectUnion({ x: Math.round(tl.x), y: Math.round(tl.y), w: out.width, h: out.height }, { x: it.baseX, y: it.baseY, w: it.base.width, h: it.base.height }); const cc = U.createCanvas(R.w, R.h), x = cc.getContext('2d'); x.drawImage(it.base, it.baseX - R.x, it.baseY - R.y); x.drawImage(out, Math.round(tl.x) - R.x, Math.round(tl.y) - R.y); it.L.setCanvas(cc, R.x, R.y); }
          else it.L.setCanvas(c, Math.round(tl.x), Math.round(tl.y));
          IMG.Effects.invalidate(it.L);
          if (s.sel && doc.selection) { Sel.fromPath(doc, (cx) => cx.rect(Math.round(tl.x), Math.round(tl.y), out.width, out.height), 'new'); }
          IMG.Engine.hideAnts = false;
          bus.emit('layers:change', doc); IMG.Engine.invalidate();
          IMG.commit('Escala sensível ao conteúdo');
        } catch (err) { console.error(err); IMG.UI.toast('Falha na escala: ' + err.message, 'error'); }
        finally { done(); IMG.Engine.hideAnts = false; if (T().activeId === 'transform') T().back(); }
      }, 30);
    },

    /* ---------- utilitários usados por outros módulos ---------- */
    /** Escala uma camada (kx, ky) em torno de um ponto (padrão: centro do conteúdo). */
    scaleLayer(doc, L, kx, ky, around) {
      const cb = L.contentBounds(); if (!cb) return;
      const c = around || { x: cb.x + cb.w / 2, y: cb.y + cb.h / 2 };
      this.applyMatrix(doc, [L], new DOMMatrix().translate(c.x, c.y).scale(kx, ky).translate(-c.x, -c.y), 'Escalar');
    },
    rotateLayer(doc, L, deg, around) {
      const cb = L.contentBounds(); if (!cb) return;
      const c = around || { x: cb.x + cb.w / 2, y: cb.y + cb.h / 2 };
      this.applyMatrix(doc, [L], new DOMMatrix().translate(c.x, c.y).rotate(deg).translate(-c.x, -c.y), 'Girar');
    },
    /** Aplica uma matriz afim a camadas, sem interface. */
    applyMatrix(doc, layers, M, label, noCommit) {
      const ok = this.begin({ items: layers, silent: true });
      if (!ok) return;
      const s = this.s, H = [M.a, M.c, M.e, M.b, M.d, M.f, 0, 0, 1];
      s.quad = boxPts(s.box).map((p) => hApply(H, p.x, p.y));
      if (noCommit) return;
      this.commit();
      void label;
    }
  });

  /* ---------- edição vetorial padrão para texto/forma (transformação afim) ---------- */
  IMG.vectorTransform = IMG.vectorTransform || {};
  if (!IMG.vectorTransform.text) IMG.vectorTransform.text = (L, M) => {
    const t = L.text, sx = Math.hypot(M.a, M.b), sy = Math.hypot(M.c, M.d), k = (sx + sy) / 2;
    const p = M.transformPoint(new DOMPoint(t.x, t.y));
    t.x = p.x; t.y = p.y;
    t.size = Math.max(1, U.round(t.size * k, 2));
    if (t.strokeWidth) t.strokeWidth = U.round(t.strokeWidth * k, 2);
    if (t.shadowBlur) { t.shadowBlur = U.round(t.shadowBlur * k, 2); t.shadowX = U.round((t.shadowX || 0) * k, 2); t.shadowY = U.round((t.shadowY || 0) * k, 2); }
    t.rotation = U.round((((t.rotation || 0) + U.deg(Math.atan2(M.b, M.a))) % 360 + 360) % 360, 2);
    if (M.a * M.d - M.b * M.c < 0) t.flip = !t.flip;
    IMG.Text.render(L);
  };
  if (!IMG.vectorTransform.shape) IMG.vectorTransform.shape = (L, M) => {
    const sh = L.shape, a = U.deg(Math.atan2(M.b, M.a));
    const p = M.transformPoint(new DOMPoint(sh.cx, sh.cy));
    const sx = Math.hypot(M.a, M.b), sy = (M.a * M.d - M.b * M.c) / (sx || 1);
    const r0 = U.rad(sh.rotation || 0), c = Math.cos(r0), s = Math.sin(r0);
    const kx = Math.hypot(c * sx, s * Math.abs(sy)), ky = Math.hypot(s * sx, c * Math.abs(sy));
    sh.cx = p.x; sh.cy = p.y; sh.w = Math.max(1, sh.w * kx); sh.h = Math.max(sh.kind === 'line' ? 0 : 1, sh.h * ky);
    sh.rotation = U.round((((sh.rotation || 0) + a) % 360 + 360) % 360, 2);
    IMG.Shapes.render(L);
  };

  /* ==================================================================
     ESCALA SENSÍVEL AO CONTEÚDO (remoção/inserção de costuras)
     ================================================================== */
  function seamCarve(src, tw, th, protect, skin) {
    let w = src.width, h = src.height;
    let d = src.getContext('2d').getImageData(0, 0, w, h).data;
    let prot = protect ? Uint8Array.from(protect) : null;
    if (skin) { prot = prot || new Uint8Array(w * h); for (let i = 0; i < w * h; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; if (r > 95 && g > 40 && b > 20 && r > g && r > b && r - Math.min(g, b) > 15 && Math.abs(r - g) > 15) prot[i] = 1; } }
    const energy = (data, W, H, P) => {
      const e = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, l = (y * W + Math.max(0, x - 1)) * 4, r = (y * W + Math.min(W - 1, x + 1)) * 4, u = (Math.max(0, y - 1) * W + x) * 4, dn = (Math.min(H - 1, y + 1) * W + x) * 4;
        let s = 0; for (let c = 0; c < 4; c++) s += Math.abs(data[r + c] - data[l + c]) + Math.abs(data[dn + c] - data[u + c]);
        e[i] = s + (P && P[i] ? 1e6 : 0);
      }
      return e;
    };
    /** Encontra uma costura vertical de menor energia. */
    const findSeam = (e, W, H) => {
      const M = Float32Array.from(e), from = new Int8Array(W * H);
      for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, up = (y - 1) * W + x;
        let best = M[up], k = 0;
        if (x > 0 && M[up - 1] < best) { best = M[up - 1]; k = -1; }
        if (x < W - 1 && M[up + 1] < best) { best = M[up + 1]; k = 1; }
        M[i] += best; from[i] = k;
      }
      let x = 0, bv = Infinity;
      for (let i = 0; i < W; i++) { const v = M[(H - 1) * W + i]; if (v < bv) { bv = v; x = i; } }
      const seam = new Int32Array(H);
      for (let y = H - 1; y >= 0; y--) { seam[y] = x; x += from[y * W + x]; }
      return seam;
    };
    const transpose = (data, W, H, P) => {
      const o = new Uint8ClampedArray(W * H * 4), op = P ? new Uint8Array(W * H) : null;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = (y * W + x) * 4, b = (x * H + y) * 4; o[b] = data[a]; o[b + 1] = data[a + 1]; o[b + 2] = data[a + 2]; o[b + 3] = data[a + 3]; if (P) op[x * H + y] = P[y * W + x]; }
      return { d: o, p: op };
    };
    /** Muda a largura de W para tw por costuras verticais. */
    const resizeW = (data, W, H, P, target) => {
      if (target < W) {
        while (W > target) {
          const seam = findSeam(energy(data, W, H, P), W, H);
          const nd = new Uint8ClampedArray((W - 1) * H * 4), np = P ? new Uint8Array((W - 1) * H) : null;
          for (let y = 0; y < H; y++) {
            const sx = seam[y];
            nd.set(data.subarray(y * W * 4, (y * W + sx) * 4), y * (W - 1) * 4);
            nd.set(data.subarray((y * W + sx + 1) * 4, (y + 1) * W * 4), (y * (W - 1) + sx) * 4);
            if (P) { np.set(P.subarray(y * W, y * W + sx), y * (W - 1)); np.set(P.subarray(y * W + sx + 1, (y + 1) * W), y * (W - 1) + sx); }
          }
          data = nd; P = np; W--;
        }
        return { data, W, P };
      }
      // ampliação: duplica as k costuras de menor energia (em lotes de até metade da largura)
      while (W < target) {
        const k = Math.min(target - W, Math.max(1, Math.floor(W / 2)));
        let work = data, wp = P, ww = W;
        const idx = []; for (let y = 0; y < H; y++) { const r = new Int32Array(W); for (let x = 0; x < W; x++) r[x] = x; idx.push(r); }
        const seams = [];
        for (let n = 0; n < k; n++) {
          const seam = findSeam(energy(work, ww, H, wp), ww, H);
          const orig = new Int32Array(H);
          const nw = new Uint8ClampedArray((ww - 1) * H * 4), np = wp ? new Uint8Array((ww - 1) * H) : null;
          for (let y = 0; y < H; y++) {
            const sx = seam[y]; orig[y] = idx[y][sx];
            idx[y] = Int32Array.from([...idx[y].subarray(0, sx), ...idx[y].subarray(sx + 1)]);
            nw.set(work.subarray(y * ww * 4, (y * ww + sx) * 4), y * (ww - 1) * 4);
            nw.set(work.subarray((y * ww + sx + 1) * 4, (y + 1) * ww * 4), (y * (ww - 1) + sx) * 4);
            if (wp) { np.set(wp.subarray(y * ww, y * ww + sx), y * (ww - 1)); np.set(wp.subarray(y * ww + sx + 1, (y + 1) * ww), y * (ww - 1) + sx); }
          }
          seams.push(orig); work = nw; wp = np; ww--;
        }
        const NW = W + k, nd = new Uint8ClampedArray(NW * H * 4), np = P ? new Uint8Array(NW * H) : null;
        for (let y = 0; y < H; y++) {
          const dup = new Uint8Array(W); for (const sm of seams) dup[sm[y]] = 1;
          let o = 0;
          for (let x = 0; x < W; x++) {
            const a = (y * W + x) * 4;
            nd[(y * NW + o) * 4] = data[a]; nd[(y * NW + o) * 4 + 1] = data[a + 1]; nd[(y * NW + o) * 4 + 2] = data[a + 2]; nd[(y * NW + o) * 4 + 3] = data[a + 3];
            if (np) np[y * NW + o] = P[y * W + x];
            o++;
            if (dup[x]) {
              const b2 = (y * W + Math.min(W - 1, x + 1)) * 4;
              for (let c = 0; c < 4; c++) nd[(y * NW + o) * 4 + c] = (data[a + c] + data[b2 + c]) / 2;
              if (np) np[y * NW + o] = P[y * W + x];
              o++;
            }
          }
        }
        data = nd; P = np; W = NW;
      }
      return { data, W, P };
    };
    let r = resizeW(d, w, h, prot, tw); d = r.data; w = r.W; prot = r.P;
    if (th !== h) {
      let t = transpose(d, w, h, prot);
      r = resizeW(t.d, h, w, t.p, th);
      t = transpose(r.data, w, r.W, r.P);
      d = t.d; h = r.W; prot = t.p;
    }
    const c = U.createCanvas(w, h); c.getContext('2d').putImageData(new ImageData(d, w, h), 0, 0);
    return c;
  }
  IMG.seamCarve = seamCarve;

  /* ==================================================================
     FERRAMENTA (modal) DA TRANSFORMAÇÃO
     ================================================================== */
  const HANDLES = [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]];
  const CORNER_OF = { 0: 0, 2: 1, 4: 2, 6: 3 };   // alça → índice do canto no quad
  const SIDE_OF = { 1: [0, 1], 3: [1, 2], 5: [2, 3], 7: [3, 0] };

  const MODE_NAMES = { free: 'Transformação livre', scale: 'Escala', rotate: 'Girar', skew: 'Inclinar', distort: 'Distorcer', perspective: 'Perspectiva', warp: 'Deformar' };

  IMG.Tools.register({
    id: 'transform', name: 'Transformação livre', icon: 'transform', hidden: true, modal: true, cursor: 'default', noCtrlMove: true,
    defaults: { keepRatio: true },
    hint: 'Enter: aplicar · Esc: cancelar · Ctrl: distorcer · Ctrl+Shift: inclinar · Ctrl+Alt+Shift: perspectiva · Alt: a partir do centro',
    ctrlHandled: () => true,

    options() {
      const s = TF.s; if (!s) return [];
      const UI = IMG.UI;
      const list = [];
      // localizador do ponto de referência
      list.push({ type: 'custom', build: () => {
        const g = el('span.ref-grid', { title: 'Ponto de referência' });
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
          const on = Math.abs(s.ref.u - i / 2) < 0.01 && Math.abs(s.ref.v - j / 2) < 0.01;
          const b = el('button' + (on ? '.on' : ''), { type: 'button' });
          b.addEventListener('click', () => { s.ref = { u: i / 2, v: j / 2 }; IMG.Engine.requestRender(); UI.renderOptions(); });
          g.appendChild(b);
        }
        return g;
      } });
      if (s.warp) {
        list.push({ type: 'select', label: 'Deformar', value: s.warp.style, options: WARPS, width: 150, onChange: (v) => {
          if (v === 'custom') TF.presetToCustom();
          else { s.warp.style = v; }
          TF.preview(); UI.renderOptions();
        } });
        if (s.warp.style !== 'custom') {
          list.push({ type: 'custom', build: () => UI.iconBtn('swap', 'Alterar a orientação da deformação', () => { s.warp.vertical = !s.warp.vertical; TF.preview(); UI.renderOptions(); }, { active: s.warp.vertical }) });
          list.push({ type: 'number', label: 'Curvar', value: s.warp.bend, min: -100, max: 100, unit: '%', width: 70, onChange: (v) => { s.warp.bend = v; TF.preview(); } });
          list.push({ type: 'number', label: 'H', value: s.warp.h, min: -100, max: 100, unit: '%', width: 70, onChange: (v) => { s.warp.h = v; TF.preview(); } });
          list.push({ type: 'number', label: 'V', value: s.warp.v, min: -100, max: 100, unit: '%', width: 70, onChange: (v) => { s.warp.v = v; TF.preview(); } });
        }
        list.push({ type: 'sep' });
        list.push({ type: 'button', label: 'Transformação livre', title: 'Voltar aos controles de transformação', onClick: () => { if (s.warp.style === 'custom' && s.warp.pts) { /* mantém a deformação */ } s.mode = 'free'; s.warpUI = false; UI.renderOptions(); IMG.Engine.requestRender(); } });
      } else {
        const p = TF.params(s);
        const set = (k) => (v) => { const q = TF.params(s); q[k] = v; if (T().o('transform').keepRatio && (k === 'w' || k === 'h')) { const other = k === 'w' ? 'h' : 'w'; q[other] = q[other] * (v / (p[k] || 1)); } TF.setParams(q); UI.renderOptions(); };
        list.push({ type: 'number', label: 'X', value: U.round(p.x, 1), decimals: 1, width: 70, unit: 'px', onChange: set('x') });
        list.push({ type: 'number', label: 'Y', value: U.round(p.y, 1), decimals: 1, width: 70, unit: 'px', onChange: set('y') });
        list.push({ type: 'sep' });
        list.push({ type: 'number', label: 'L', value: U.round(p.w, 2), decimals: 2, width: 76, unit: '%', onChange: set('w') });
        list.push({ type: 'custom', build: () => UI.iconBtn('chain', 'Manter proporções', () => { T().setOpt('transform', 'keepRatio', !T().o('transform').keepRatio); UI.renderOptions(); }, { active: T().o('transform').keepRatio }) });
        list.push({ type: 'number', label: 'A', value: U.round(p.h, 2), decimals: 2, width: 76, unit: '%', onChange: set('h') });
        list.push({ type: 'number', label: '∠', value: U.round(p.angle, 2), decimals: 2, width: 70, unit: '°', min: -360, max: 360, onChange: set('angle') });
        list.push({ type: 'number', label: 'H', value: U.round(p.skH, 2), decimals: 2, width: 64, unit: '°', min: -89, max: 89, onChange: set('skH') });
        list.push({ type: 'number', label: 'V', value: U.round(p.skV, 2), decimals: 2, width: 64, unit: '°', min: -89, max: 89, onChange: set('skV') });
        if (s.cas) {
          const chs = (s.doc.channels || []).map((c) => [c.id, c.name]);
          list.push({ type: 'select', label: 'Proteger', value: s.casProtect || 'none', options: [['none', 'Nenhum']].concat(chs), width: 110, onChange: (v) => { s.casProtect = v; } });
          list.push({ type: 'custom', build: () => UI.check('Proteger tons de pele', !!s.casSkin, (v) => { s.casSkin = v; }).el });
        }
      }
      list.push({ type: 'select', label: 'Interpolação', value: s.interp, options: [['nearest', 'Vizinho mais próximo'], ['bilinear', 'Bilinear'], ['bicubic', 'Bicúbica']], width: 120, onChange: (v) => { s.interp = v; U.store.set('tfInterp', v); TF.preview(); } });
      if (!s.cas && !s.selOnly || s.selOnly) list.push({ type: 'custom', build: () => UI.iconBtn('tWarp', 'Alternar entre transformação livre e deformação', () => { if (s.warp && s.mode === 'warp') { s.mode = 'free'; } else { TF.startWarp(); s.mode = 'warp'; } UI.renderOptions(); IMG.Engine.requestRender(); }, { active: s.mode === 'warp' }) });
      list.push({ type: 'sep' });
      list.push({ type: 'button', label: 'Cancelar', onClick: () => TF.cancel() });
      list.push({ type: 'button', label: 'Aplicar', icon: 'check', primary: true, onClick: () => TF.commit() });
      return list;
    },

    deactivate() { if (TF.s) TF.cancel(); },

    beforeCommand(id) {
      if (!TF.s) return false;
      if (id === 'edit.undo' || id === 'edit.stepBack') { TF.cancel(); return true; }
      if (/^(view|window|help)\./.test(id)) return false;
      if (/^edit\.t(Rot|Flip)/.test(id)) { TF.applyQuick({ 'edit.tRot180': 'rot180', 'edit.tRot90': 'rot90', 'edit.tRot270': 'rot270', 'edit.tFlipH': 'flipH', 'edit.tFlipV': 'flipV' }[id]); return true; }
      const modes = { 'edit.tScale': 'scale', 'edit.tRotate': 'rotate', 'edit.tSkew': 'skew', 'edit.tDistort': 'distort', 'edit.tPerspective': 'perspective', 'edit.tWarp': 'warp', 'edit.transform': 'free' };
      if (modes[id]) { if (modes[id] === 'warp') TF.startWarp(); TF.s.mode = modes[id]; IMG.UI.renderOptions(); IMG.Engine.requestRender(); return true; }
      TF.commit();
      return false;
    },

    toScreen(p) { const v = TF.s.doc.view; return { x: v.x + p.x * v.zoom, y: v.y + p.y * v.zoom }; },

    handlePts(s) {
      const H = TF.H(s), b = s.box;
      return HANDLES.map(([u, v]) => hApply(H, b.x + u * b.w, b.y + v * b.h));
    },

    hit(ev) {
      const s = TF.s, sx = ev.sx, sy = ev.sy;
      if (s.mode === 'warp' && s.warp) {
        if (s.warp.style === 'custom') {
          for (let k = 0; k < 16; k++) { const p = this.toScreen(s.warp.pts[k]); if (Math.abs(p.x - sx) <= 7 && Math.abs(p.y - sy) <= 7) return { type: 'wpt', k }; }
          const uv = this.findUV(ev);
          if (uv) return { type: 'wsurf', uv };
        } else {
          const uv = this.findUV(ev);
          if (uv) return { type: 'bend' };
        }
        return { type: 'none' };
      }
      const r = this.toScreen(TF.refPt(s));
      if (Math.hypot(r.x - sx, r.y - sy) <= 6) return { type: 'ref' };
      const hp = this.handlePts(s).map((p) => this.toScreen(p));
      for (let i = 0; i < hp.length; i++) if (Math.abs(hp[i].x - sx) <= 7 && Math.abs(hp[i].y - sy) <= 7) return { type: 'handle', i };
      // dentro do quad?
      const q = s.quad.map((p) => this.toScreen(p));
      let inside = false;
      for (let i = 0, j = 3; i < 4; j = i++) { if ((q[i].y > sy) !== (q[j].y > sy) && sx < ((q[j].x - q[i].x) * (sy - q[i].y)) / (q[j].y - q[i].y) + q[i].x) inside = !inside; }
      return { type: inside ? 'move' : 'rotate' };
    },

    findUV(ev) {
      const s = TF.s, H = TF.H(s);
      let best = null, bd = 1e9;
      const N = 24;
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
        const p = this.toScreen(TF.mapUV(s, H, i / N, j / N)), d = Math.hypot(p.x - ev.sx, p.y - ev.sy);
        if (d < bd) { bd = d; best = { u: i / N, v: j / N }; }
      }
      return bd < 18 ? best : null;
    },

    down(ev) {
      const s = TF.s; if (!s) return false;
      if (ev.alt && !ev.ctrl && s.mode !== 'warp') {
        const h0 = this.hit(ev);
        if (h0.type === 'move' || h0.type === 'rotate') {
          // Alt+clique: move o ponto de referência
          const Hi = hInvert(TF.H(s)), q = hApply(Hi, ev.x, ev.y);
          s.ref = { u: (q.x - s.box.x) / s.box.w, v: (q.y - s.box.y) / s.box.h };
          this.h = { type: 'ref' }; this.st = {}; IMG.Engine.requestRender(); return;
        }
      }
      this.h = this.hit(ev);
      const H = TF.H(s);
      this.st = { quad: s.quad.map((p) => ({ ...p })), H, Hi: hInvert(H), x: ev.x, y: ev.y, ref: TF.refPt(s), refUV: { ...s.ref }, pts: s.warp && s.warp.pts ? s.warp.pts.map((p) => ({ ...p })) : null, bend: s.warp ? s.warp.bend : 0 };
      if (this.h.type === 'move') {
        this.T = IMG.Snap.collect(s.doc, new Set(s.items.map((it) => it.L.id)));
        const xs = s.quad.map((p) => p.x), ys = s.quad.map((p) => p.y);
        this.bb = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      }
      if (this.h.type === 'rotate' && (s.mode === 'scale' || s.mode === 'distort' || s.mode === 'perspective' || s.mode === 'skew')) this.h = { type: 'none' };
    },

    move(ev) {
      const s = TF.s, h = this.h, st = this.st;
      if (!s || !h || h.type === 'none') return;
      const o = T().o('transform'), b = s.box;
      const dx = ev.x - st.x, dy = ev.y - st.y;
      if (h.type === 'ref') {
        const Hi = hInvert(TF.H(s)), q = hApply(Hi, ev.x, ev.y);
        s.ref = { u: (q.x - b.x) / b.w, v: (q.y - b.y) / b.h };
        IMG.Engine.requestRender(); return;
      }
      if (h.type === 'wpt') {
        s.warp.pts[h.k] = { x: st.pts[h.k].x + dx, y: st.pts[h.k].y + dy };
        // mover um canto leva junto as alças vizinhas
        const corner = { 0: [1, 4, 5], 3: [2, 7, 6], 12: [8, 13, 9], 15: [11, 14, 10] }[h.k];
        if (corner) corner.forEach((k) => { s.warp.pts[k] = { x: st.pts[k].x + dx, y: st.pts[k].y + dy }; });
        TF.preview(); return;
      }
      if (h.type === 'wsurf') {
        const bu = bern(h.uv.u), bv = bern(h.uv.v);
        let sum = 0; const w = [];
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const q = bu[i] * bv[j]; w.push(q); sum += q * q; }
        s.warp.pts = st.pts.map((p, k) => ({ x: p.x + dx * w[k] / sum, y: p.y + dy * w[k] / sum }));
        TF.preview(); return;
      }
      if (h.type === 'bend') {
        const len = Math.hypot(st.quad[3].x - st.quad[0].x, st.quad[3].y - st.quad[0].y) || 1;
        s.warp.bend = U.clamp(Math.round(st.bend - (dy / len) * 200), -100, 100);
        TF.preview(); IMG.UI.renderOptions(); return;
      }
      if (h.type === 'move') {
        let mx = dx, my = dy;
        if (ev.shift) { if (Math.abs(mx) > Math.abs(my)) my = 0; else mx = 0; }
        IMG.Engine.smart = [];
        if (!ev.ctrl && this.bb) { const sn = IMG.Snap.rect(s.doc, { x: this.bb.x + mx, y: this.bb.y + my, w: this.bb.w, h: this.bb.h }, this.T); mx += sn.dx; my += sn.dy; IMG.Engine.smart = sn.lines; }
        s.quad = st.quad.map((p) => ({ x: p.x + mx, y: p.y + my }));
        if (st.pts) s.warp.pts = st.pts.map((p) => ({ x: p.x + mx, y: p.y + my }));
      } else if (h.type === 'rotate') {
        const c = st.ref, a0 = Math.atan2(st.y - c.y, st.x - c.x), a1 = Math.atan2(ev.y - c.y, ev.x - c.x);
        let da = a1 - a0;
        if (ev.shift) { const ang0 = Math.atan2(st.quad[1].y - st.quad[0].y, st.quad[1].x - st.quad[0].x); const tot = Math.round((ang0 + da) / (Math.PI / 12)) * (Math.PI / 12); da = tot - ang0; }
        s.quad = st.quad.map((p) => rot(p, c, da));
        if (st.pts) s.warp.pts = st.pts.map((p) => rot(p, c, da));
      } else if (h.type === 'handle') {
        const i = h.i, corner = CORNER_OF[i], side = SIDE_OF[i];
        const mode = s.mode;
        const ctrl = ev.ctrl, shift = ev.shift, alt = ev.alt;
        const wantDistort = mode === 'distort' || (mode === 'free' && ctrl && !shift && !alt);
        const wantSkew = mode === 'skew' || (mode === 'free' && ctrl && shift && !alt) || (mode === 'perspective' && side);
        const wantPersp = mode === 'perspective' || (mode === 'free' && ctrl && shift && alt);
        if (wantPersp && corner != null) {
          const q = st.quad.map((p) => ({ ...p }));
          const n1 = (corner + 1) % 4, n2 = (corner + 3) % 4;
          const e1 = { x: q[n1].x - q[corner].x, y: q[n1].y - q[corner].y }, e2 = { x: q[n2].x - q[corner].x, y: q[n2].y - q[corner].y };
          const l1 = Math.hypot(e1.x, e1.y) || 1, l2 = Math.hypot(e2.x, e2.y) || 1;
          const t1 = (dx * e1.x + dy * e1.y) / l1, t2 = (dx * e2.x + dy * e2.y) / l2;
          const [e, l, t, n] = Math.abs(t1) >= Math.abs(t2) ? [e1, l1, t1, n1] : [e2, l2, t2, n2];
          q[corner] = { x: q[corner].x + (e.x / l) * t, y: q[corner].y + (e.y / l) * t };
          q[n] = { x: q[n].x - (e.x / l) * t, y: q[n].y - (e.y / l) * t };
          s.quad = q;
        } else if (wantSkew && side) {
          const [a, c2] = side, q = st.quad.map((p) => ({ ...p }));
          const dir = { x: q[c2].x - q[a].x, y: q[c2].y - q[a].y }, l = Math.hypot(dir.x, dir.y) || 1;
          const t = (dx * dir.x + dy * dir.y) / l;
          let mvx = (dir.x / l) * t, mvy = (dir.y / l) * t;
          if (mode === 'distort' || (mode === 'free' && ctrl && !shift)) { mvx = dx; mvy = dy; }
          q[a] = { x: q[a].x + mvx, y: q[a].y + mvy }; q[c2] = { x: q[c2].x + mvx, y: q[c2].y + mvy };
          if (alt) { const oa = (a + 2) % 4, ob = (c2 + 2) % 4; q[oa] = { x: q[oa].x - mvx, y: q[oa].y - mvy }; q[ob] = { x: q[ob].x - mvx, y: q[ob].y - mvy }; }
          s.quad = q;
        } else if ((wantSkew || wantDistort) && corner != null) {
          const q = st.quad.map((p) => ({ ...p }));
          if (wantSkew && !wantDistort) {
            const n1 = (corner + 1) % 4, n2 = (corner + 3) % 4;
            const e1 = { x: q[n1].x - q[corner].x, y: q[n1].y - q[corner].y }, e2 = { x: q[n2].x - q[corner].x, y: q[n2].y - q[corner].y };
            const l1 = Math.hypot(e1.x, e1.y) || 1, l2 = Math.hypot(e2.x, e2.y) || 1, t1 = (dx * e1.x + dy * e1.y) / l1, t2 = (dx * e2.x + dy * e2.y) / l2;
            const [e, l, t] = Math.abs(t1) >= Math.abs(t2) ? [e1, l1, t1] : [e2, l2, t2];
            q[corner] = { x: q[corner].x + (e.x / l) * t, y: q[corner].y + (e.y / l) * t };
          } else {
            q[corner] = { x: q[corner].x + dx, y: q[corner].y + dy };
            if (alt) { const op = (corner + 2) % 4; q[op] = { x: q[op].x - dx, y: q[op].y - dy }; }
          }
          s.quad = q;
        } else if (wantDistort && side) {
          const [a, c2] = side, q = st.quad.map((p) => ({ ...p }));
          q[a] = { x: q[a].x + dx, y: q[a].y + dy }; q[c2] = { x: q[c2].x + dx, y: q[c2].y + dy };
          s.quad = q;
        } else if (mode !== 'rotate') {
          // escala no espaço de origem (funciona também em quads em perspectiva)
          const [hu, hv] = HANDLES[i];
          const anchor = alt ? { x: b.x + st.refUV.u * b.w, y: b.y + st.refUV.v * b.h } : { x: b.x + (1 - hu) * b.w, y: b.y + (1 - hv) * b.h };
          const hp = { x: b.x + hu * b.w, y: b.y + hv * b.h };
          const m = hApply(st.Hi, ev.x, ev.y);
          let kx = hu !== 0.5 ? (m.x - anchor.x) / ((hp.x - anchor.x) || 1e-9) : 1;
          let ky = hv !== 0.5 ? (m.y - anchor.y) / ((hp.y - anchor.y) || 1e-9) : 1;
          const isCorner = corner != null;
          const prop = isCorner ? o.keepRatio !== shift : shift;
          if (prop) {
            if (isCorner) { const k = Math.abs(kx) > Math.abs(ky) ? kx : ky; kx = k; ky = k; }
            else if (hu !== 0.5) ky = Math.abs(kx); else kx = Math.abs(ky);
          }
          const minK = 1 / Math.max(b.w, b.h);
          if (Math.abs(kx) < minK) kx = minK * (kx < 0 ? -1 : 1);
          if (Math.abs(ky) < minK) ky = minK * (ky < 0 ? -1 : 1);
          const S = (p) => ({ x: anchor.x + (p.x - anchor.x) * kx, y: anchor.y + (p.y - anchor.y) * ky });
          s.quad = boxPts(b).map((p) => { const q = S(p); return hApply(st.H, q.x, q.y); });
          if (st.pts) { const Hn = homography(boxPts(b), s.quad), Hm = hMul(Hn, st.Hi); s.warp.pts = st.pts.map((p) => hApply(Hm, p.x, p.y)); }
        }
      }
      const p = TF.params(s);
      IMG.UI.setHint('L ' + U.round(p.w, 1) + '%  A ' + U.round(p.h, 1) + '%  ∠ ' + U.round(p.angle, 1) + '°');
      TF.preview();
    },

    up() { this.h = null; IMG.Engine.smart = []; IMG.UI.setHint(''); IMG.UI.renderOptions(); },

    hover(ev) {
      const s = TF.s; if (!s) return;
      const h = this.hit(ev);
      let c = 'default';
      if (h.type === 'move') c = ev.ctrl ? 'default' : 'move';
      else if (h.type === 'rotate') c = s.mode === 'free' || s.mode === 'rotate' ? 'alias' : 'default';
      else if (h.type === 'ref') c = 'crosshair';
      else if (h.type === 'wpt' || h.type === 'wsurf' || h.type === 'bend') c = 'move';
      else if (h.type === 'handle') {
        if (ev.ctrl) c = 'default';
        else {
          const hp = this.handlePts(s), r = TF.refPt(s), p = hp[h.i];
          const a = ((U.deg(Math.atan2(p.y - r.y, p.x - r.x)) % 180) + 180) % 180;
          c = a < 22.5 || a >= 157.5 ? 'ew-resize' : a < 67.5 ? 'nwse-resize' : a < 112.5 ? 'ns-resize' : 'nesw-resize';
        }
      }
      T().cursor(c);
    },

    dblclick(ev) { const h = this.hit(ev); if (h.type === 'move' || h.type === 'wsurf' || h.type === 'bend') TF.commit(); },

    onKey(e) {
      if (e.key === 'Enter') { TF.commit(); return true; }
      if (e.key === 'Escape') { TF.cancel(); return true; }
      const s = TF.s;
      if (s && /^Arrow/.test(e.key)) {
        const n = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
        s.quad = s.quad.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        if (s.warp && s.warp.pts) s.warp.pts = s.warp.pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        TF.preview(); IMG.UI.renderOptions();
        return true;
      }
      return false;
    },

    drawOverlay(ctx, v) {
      const s = TF.s; if (!s) return;
      const S = (p) => ({ x: v.x + p.x * v.zoom, y: v.y + p.y * v.zoom });
      ctx.lineWidth = 1; ctx.strokeStyle = '#4d8fd6';
      if (s.mode === 'warp' && s.warp) {
        const H = TF.H(s), N = 3, M = 24;
        ctx.beginPath();
        for (let j = 0; j <= N; j++) { for (let i = 0; i <= M; i++) { const p = S(TF.mapUV(s, H, i / M, j / N)); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } }
        for (let i = 0; i <= N; i++) { for (let j = 0; j <= M; j++) { const p = S(TF.mapUV(s, H, i / N, j / M)); j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } }
        ctx.stroke();
        if (s.warp.style === 'custom') {
          const P = s.warp.pts.map(S);
          ctx.strokeStyle = 'rgba(77,143,214,.8)'; ctx.beginPath();
          [[0, 1], [0, 4], [3, 2], [3, 7], [12, 8], [12, 13], [15, 11], [15, 14]].forEach(([a, b]) => { ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); });
          ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#4d8fd6';
          P.forEach((p, k) => { const corner = k === 0 || k === 3 || k === 12 || k === 15; const r = corner ? 3.5 : 2.5; ctx.beginPath(); if (corner) ctx.rect(Math.round(p.x) - r, Math.round(p.y) - r, r * 2, r * 2); else ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); ctx.stroke(); });
        }
        return;
      }
      const q = s.quad.map(S);
      ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = '#fff';
      this.handlePts(s).map(S).forEach((p) => { ctx.fillRect(Math.round(p.x) - 3.5, Math.round(p.y) - 3.5, 7, 7); ctx.strokeRect(Math.round(p.x) - 3.5, Math.round(p.y) - 3.5, 7, 7); });
      const r = S(TF.refPt(s));
      ctx.beginPath(); ctx.arc(r.x, r.y, 4.5, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r.x - 7, r.y); ctx.lineTo(r.x + 7, r.y); ctx.moveTo(r.x, r.y - 7); ctx.lineTo(r.x, r.y + 7); ctx.stroke();
    }
  });

  /* ==================================================================
     COMANDOS
     ================================================================== */
  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, Hh) => {
    const hasLayer = Hh.hasLayer, hasSel = Hh.hasSel;
    const start = (mode) => () => { if (TF.s) { T().active.beforeCommand('edit.t' + mode); return; } const pt = IMG.pathTransformTarget && IMG.pathTransformTarget(); TF.begin(pt ? { mode, pathItem: pt } : { mode }); };
    C('edit.transform', 'Transformação livre', () => {
      if (TF.s) return;
      const pt = IMG.pathTransformTarget && IMG.pathTransformTarget();
      if (pt) TF.begin({ mode: 'free', pathItem: pt }); else TF.begin({ mode: 'free' });
    }, { enabled: () => hasLayer() || !!(IMG.pathTransformTarget && IMG.pathTransformTarget()), keys: ['ctrl+alt+t', 'ctrl+t'], label2: () => (IMG.pathTransformTarget && IMG.pathTransformTarget() ? 'Transformar demarcador' : null) });
    C('edit.tAgain', 'Novamente', () => {
      const l = TF.last; if (!l) return;
      const doc = IMG.app.doc;
      if (!TF.begin({ mode: 'free' })) return;
      const s = TF.s;
      s.quad = boxPts(s.box).map((p) => hApply(l.H, p.x, p.y));
      TF.commit();
      void doc;
    }, { enabled: () => hasLayer() && !!TF.last, keys: ['ctrl+shift+t'] });
    C('edit.tScale', 'Escala', start('scale'), { enabled: hasLayer });
    C('edit.tRotate', 'Girar', start('rotate'), { enabled: hasLayer });
    C('edit.tSkew', 'Inclinar', start('skew'), { enabled: hasLayer });
    C('edit.tDistort', 'Distorcer', start('distort'), { enabled: hasLayer });
    C('edit.tPerspective', 'Perspectiva', start('perspective'), { enabled: hasLayer });
    C('edit.tWarp', 'Deformar', start('warp'), { enabled: hasLayer });
    const quick = (kind, label) => () => {
      if (TF.s) { TF.applyQuick(kind); return; }
      if (!TF.begin({ mode: 'free' })) return;
      TF.applyQuick(kind); TF.commit();
      void label;
    };
    C('edit.tRot180', 'Girar 180°', quick('rot180'), { enabled: hasLayer });
    C('edit.tRot90', 'Girar 90° no sentido horário', quick('rot90'), { enabled: hasLayer });
    C('edit.tRot270', 'Girar 90° no sentido anti-horário', quick('rot270'), { enabled: hasLayer });
    C('edit.tFlipH', 'Inverter horizontalmente', quick('flipH'), { enabled: hasLayer });
    C('edit.tFlipV', 'Inverter verticalmente', quick('flipV'), { enabled: hasLayer });
    C('select.transform', 'Transformar seleção', () => { if (!TF.s) TF.begin({ mode: 'free', selOnly: true }); }, { enabled: hasSel });
    C('edit.contentScale', 'Escala sensível ao conteúdo', () => {
      const d = IMG.app.doc, L = d && d.active;
      if (!L || L.type !== 'raster') { IMG.UI.toast('Selecione uma camada de pixels.'); return; }
      TF.begin({ mode: 'scale', cas: true });
    }, { enabled: hasLayer, keys: ['ctrl+alt+shift+c'] });
    C('image.rotArbitrary', 'Arbitrária…', () => {
      const UI = IMG.UI; let deg = 0, cw = true;
      UI.dialog({ title: 'Girar tela', width: 320,
        body: [UI.row('Ângulo', UI.num({ value: 0, min: -359.99, max: 359.99, decimals: 2, unit: '°', width: 90, onInput: (v) => { deg = v; } }).el),
          UI.row('', UI.select([['cw', 'Sentido horário'], ['ccw', 'Sentido anti-horário']], 'cw', (v) => { cw = v === 'cw'; }, { keepFocus: true }).el)],
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => rotateCanvas(IMG.app.doc, cw ? deg : -deg) }] });
    }, { enabled: Hh.has });
  });

  /** Gira a tela por um ângulo qualquer (amplia a tela para caber). */
  function rotateCanvas(doc, deg, o = {}) {
    if (!doc || !deg) return;
    const a = U.rad(deg), W = doc.width, H = doc.height;
    const cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
    const NW = Math.round(W * cs + H * sn), NH = Math.round(W * sn + H * cs);
    const M = new DOMMatrix().translate(NW / 2, NH / 2).rotate(deg).translate(-W / 2, -H / 2);
    affineDoc(doc, M, NW, NH, Object.assign({ label: 'Girar tela' }, o));
  }
  /**
   * Aplica uma transformação afim M (documento antigo → novo) a todo o documento,
   * que passa a medir NW×NH. o: { label, noCommit, clip (descarta pixels fora), bgColor, keepGuides }
   */
  function affineDoc(doc, M, NW, NH, o = {}) {
    const Hm = [M.a, M.c, M.e, M.b, M.d, M.f, 0, 0, 1];
    const bg = o.bgColor || IMG.app.bg, R = { x: 0, y: 0, w: NW, h: NH };
    const clipTo = (sf) => {
      if (!o.clip || !sf.canvas) return;
      const cur = { x: sf.x, y: sf.y, w: sf.canvas.width, h: sf.canvas.height }, k = U.rectIntersect(cur, R) || { x: 0, y: 0, w: 1, h: 1 };
      if (k.x === cur.x && k.y === cur.y && k.w === cur.w && k.h === cur.h) return;
      const c = U.createCanvas(k.w, k.h); c.getContext('2d').drawImage(sf.canvas, cur.x - k.x, cur.y - k.y);
      if (sf.setCanvas) sf.setCanvas(c, k.x, k.y); else { sf.canvas = c; sf.x = k.x; sf.y = k.y; sf._snap = null; IMG.markDirty(sf); }
    };
    if (IMG.transformDocVectors) IMG.transformDocVectors(doc, M, { skipShapes: false });
    Layers.walk(doc.layers, (L) => {
      if (L.type === 'group' || L.type === 'adjust') { if (L.mask) { xfSurface(L.mask, Hm, true); clipTo(L.mask); } return; }
      if (L.type === 'text' || L.type === 'shape') { /* vetores já transformados */ }
      else if (L.canvas) {
        if (L.isBg) {
          const c = U.createCanvas(NW, NH), x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, NW, NH);
          x.setTransform(M.a, M.b, M.c, M.d, M.e, M.f); x.imageSmoothingQuality = 'high'; x.drawImage(L.canvas, L.x, L.y);
          L.setCanvas(c, 0, 0);
        } else { xfSurface(L, Hm, false); clipTo(L); }
      }
      if (L.mask) { xfSurface(L.mask, Hm, true); clipTo(L.mask); }
      IMG.Effects.invalidate(L);
    });
    if (doc.samplers) doc.samplers = doc.samplers.map((p) => { const q = M.transformPoint(new DOMPoint(p.x, p.y)); return { x: q.x, y: q.y }; }).filter((p) => p.x >= 0 && p.y >= 0 && p.x < NW && p.y < NH);
    doc.width = NW; doc.height = NH;
    if (!o.keepGuides) doc.guides = { h: [], v: [] };
    if (doc.selection) IMG.Selection.clear(doc);
    if (IMG.xfChannels) IMG.xfChannels(doc, NW, NH, [M.a, M.b, M.c, M.d, M.e, M.f]);
    bus.emit('doc:resize', doc); IMG.Engine.fit(false);
    bus.emit('layers:change', doc); IMG.Engine.invalidate();
    if (!o.noCommit) IMG.commit(o.label || 'Transformar tela');
  }
  /** Transforma uma superfície (camada ou máscara) por uma matriz afim (H 3×3). */
  function xfSurface(sf, H, isMask) {
    const w = sf.canvas.width, h = sf.canvas.height, pts = [[sf.x, sf.y], [sf.x + w, sf.y], [sf.x + w, sf.y + h], [sf.x, sf.y + h]].map(([x, y]) => hApply(H, x, y));
    const x0 = Math.floor(Math.min(...pts.map((p) => p.x))), y0 = Math.floor(Math.min(...pts.map((p) => p.y)));
    const c = U.createCanvas(Math.max(1, Math.ceil(Math.max(...pts.map((p) => p.x))) - x0), Math.max(1, Math.ceil(Math.max(...pts.map((p) => p.y))) - y0)), x = c.getContext('2d');
    if (isMask && sf.bg) { x.fillStyle = 'rgba(255,255,255,' + sf.bg / 255 + ')'; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'destination-out'; x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p.x - x0, p.y - y0) : x.moveTo(p.x - x0, p.y - y0))); x.fill(); x.globalCompositeOperation = 'source-over'; }
    x.setTransform(H[0], H[3], H[1], H[4], H[2] - x0, H[5] - y0); x.imageSmoothingQuality = 'high';
    x.drawImage(sf.canvas, sf.x, sf.y);
    if (sf.setCanvas) sf.setCanvas(c, x0, y0); else { sf.canvas = c; sf.x = x0; sf.y = y0; sf._snap = null; IMG.markDirty(sf); }
  }
  IMG.xfSurface = xfSurface;
  IMG.rotateCanvas = rotateCanvas;
  IMG.affineDoc = affineDoc;
  IMG.boxPts = boxPts;
})();
