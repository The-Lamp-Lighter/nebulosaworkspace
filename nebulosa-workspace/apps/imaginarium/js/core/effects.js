/* ==========================================================================
   Imaginarium — estilos de camada (efeitos)
   Sombra projetada, Sombra interna, Brilho externo, Brilho interno,
   Chanfro e entalhe, Cetim, Sobreposição de cor / gradiente / padrão, Traçado.

   Cada camada com efeitos gera, a partir do seu conteúdo (pixels × máscaras):
     below: efeitos que ficam atrás do conteúdo e se mesclam com o fundo
            (Sombra projetada, Brilho externo)
     body:  conteúdo (com "Preenchimento") + efeitos internos + traçado
   O resultado fica em cache até a camada ou os efeitos mudarem.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U;

  /* ---------- valores padrão (iguais aos do Photoshop/Photopea) ---------- */
  const DEF = {
    dropShadow: { enabled: true, blend: 'multiply', color: '#000000', opacity: 75, angle: 120, useGlobal: true, distance: 5, spread: 0, size: 5, knockout: true },
    innerShadow: { enabled: true, blend: 'multiply', color: '#000000', opacity: 75, angle: 120, useGlobal: true, distance: 5, choke: 0, size: 5 },
    outerGlow: { enabled: true, blend: 'screen', opacity: 75, fillType: 'color', color: '#ffffbe', gradient: null, technique: 'softer', spread: 0, size: 5, range: 50 },
    innerGlow: { enabled: true, blend: 'screen', opacity: 75, fillType: 'color', color: '#ffffbe', gradient: null, technique: 'softer', source: 'edge', choke: 0, size: 5, range: 50 },
    bevel: { enabled: true, style: 'inner', technique: 'smooth', depth: 100, direction: 'up', size: 5, soften: 0, angle: 120, useGlobal: true, altitude: 30,
      hlBlend: 'screen', hlColor: '#ffffff', hlOpacity: 75, shBlend: 'multiply', shColor: '#000000', shOpacity: 75 },
    satin: { enabled: true, blend: 'multiply', color: '#000000', opacity: 50, angle: 19, distance: 11, size: 14, invert: true },
    colorOverlay: { enabled: true, blend: 'normal', color: '#ff0000', opacity: 100 },
    gradientOverlay: { enabled: true, blend: 'normal', opacity: 100, gradient: null, reverse: false, style: 'linear', align: true, angle: 90, scale: 100, offX: 0, offY: 0 },
    patternOverlay: { enabled: true, blend: 'normal', opacity: 100, pattern: 'p0', scale: 100, link: true },
    stroke: { enabled: true, size: 3, position: 'outside', blend: 'normal', opacity: 100, fillType: 'color', color: '#000000', gradient: null, gradStyle: 'linear', angle: 90, scale: 100, pattern: 'p0', patScale: 100 }
  };
  const ORDER = ['dropShadow', 'outerGlow', 'patternOverlay', 'gradientOverlay', 'colorOverlay', 'satin', 'innerGlow', 'innerShadow', 'stroke', 'bevel'];
  const NAMES = {
    dropShadow: 'Sombra projetada', innerShadow: 'Sombra interna', outerGlow: 'Brilho externo', innerGlow: 'Brilho interno', bevel: 'Chanfro e entalhe',
    satin: 'Cetim', colorOverlay: 'Sobreposição de cores', gradientOverlay: 'Sobreposição de gradiente', patternOverlay: 'Sobreposição de padrão', stroke: 'Traçado'
  };
  /* ordem da lista no diálogo (de cima para baixo, como no Photoshop) */
  const LIST = ['bevel', 'stroke', 'innerShadow', 'innerGlow', 'satin', 'colorOverlay', 'gradientOverlay', 'patternOverlay', 'outerGlow', 'dropShadow'];

  /* ---------- operações sobre campos de 1 canal (Float32Array) ---------- */
  function boxesForGauss(sigma, n) {
    const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
    let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
    const wu = wl + 2;
    const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
    const sizes = [];
    for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
    return sizes;
  }
  /* desfoque em caixa com borda transparente (fora do campo = 0) */
  function boxH(s, t, w, h, r) {
    const iarr = 1 / (r + r + 1);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let x = -r; x <= r; x++) if (x >= 0 && x < w) acc += s[row + x];
      for (let x = 0; x < w; x++) {
        t[row + x] = acc * iarr;
        const xo = x - r, xi = x + r + 1;
        if (xo >= 0) acc -= s[row + xo];
        if (xi < w) acc += s[row + xi];
      }
    }
  }
  function boxV(s, t, w, h, r) {
    const iarr = 1 / (r + r + 1);
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) if (y >= 0 && y < h) acc += s[y * w + x];
      for (let y = 0; y < h; y++) {
        t[y * w + x] = acc * iarr;
        const yo = y - r, yi = y + r + 1;
        if (yo >= 0) acc -= s[yo * w + x];
        if (yi < h) acc += s[yi * w + x];
      }
    }
  }
  function blur(src, w, h, sigma) {
    const a = Float32Array.from(src);
    if (sigma < 0.3) return a;
    const b = new Float32Array(a.length);
    const bx = boxesForGauss(sigma, 3);
    for (let k = 0; k < 3; k++) { const r = Math.max(0, (bx[k] - 1) / 2) | 0; if (!r) continue; boxH(a, b, w, h, r); boxV(b, a, w, h, r); }
    return a;
  }
  /* transformada de distância euclidiana exata (Felzenszwalb & Huttenlocher) */
  const INF = 1e20;
  function dt1(f, n, d, v, z) {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  }
  /** Distância de cada pixel até o pixel-semente mais próximo (seed[i] = 1). */
  function edt(seed, w, h) {
    const g = new Float32Array(w * h);
    for (let i = 0; i < g.length; i++) g[i] = seed[i] ? 0 : INF;
    const n = Math.max(w, h);
    const f = new Float32Array(n), d = new Float32Array(n), v = new Int32Array(n), z = new Float32Array(n + 1);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) f[y] = g[y * w + x];
      dt1(f, h, d, v, z);
      for (let y = 0; y < h; y++) g[y * w + x] = d[y];
    }
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) f[x] = g[row + x];
      dt1(f, w, d, v, z);
      for (let x = 0; x < w; x++) g[row + x] = Math.sqrt(d[x]);
    }
    return g;
  }
  /** Distância assinada até a borda (negativa dentro), com correção pelo alfa. */
  function signedDist(a, w, h) {
    const n = w * h, ins = new Uint8Array(n), outs = new Uint8Array(n);
    for (let i = 0; i < n; i++) { if (a[i] >= 0.5) ins[i] = 1; else outs[i] = 1; }
    const dOut = edt(ins, w, h), dIn = edt(outs, w, h);
    const sd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const al = a[i];
      if (al > 0.02 && al < 0.98) sd[i] = 0.5 - al;
      else sd[i] = al >= 0.5 ? -(dIn[i] - 0.5) : dOut[i] - 0.5;
    }
    return sd;
  }
  function shift(src, w, h, dx, dy) {
    dx = Math.round(dx); dy = Math.round(dy);
    if (!dx && !dy) return src;
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const sy = y - dy; if (sy < 0 || sy >= h) continue;
      for (let x = 0; x < w; x++) { const sx = x - dx; if (sx >= 0 && sx < w) out[y * w + x] = src[sy * w + sx]; }
    }
    return out;
  }
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  /* ---------- auxiliares ---------- */
  function active(L) {
    const fx = L.fx;
    if (!fx || fx.off) return null;
    let any = false;
    for (const k of ORDER) if (fx[k] && fx[k].enabled) { any = true; break; }
    return any ? fx : null;
  }
  function lightAngle(e, doc) { return e.useGlobal && doc ? (doc.globalAngle == null ? 120 : doc.globalAngle) : e.angle; }
  function lightAlt(e, doc) { return e.useGlobal && doc ? (doc.globalAltitude == null ? 30 : doc.globalAltitude) : e.altitude; }

  /** Quanto os efeitos se estendem para fora do conteúdo (px). */
  function pad(fx) {
    let p = 2;
    const on = (k) => fx[k] && fx[k].enabled;
    if (on('dropShadow')) p = Math.max(p, fx.dropShadow.distance + fx.dropShadow.size * 1.5 + 4);
    if (on('outerGlow')) p = Math.max(p, fx.outerGlow.size * 1.5 + 4);
    if (on('stroke') && fx.stroke.position !== 'inside') p = Math.max(p, fx.stroke.size + 3);
    if (on('bevel') && fx.bevel.style !== 'inner') p = Math.max(p, fx.bevel.size * 1.5 + 4);
    return Math.ceil(p);
  }

  /** Fonte de cor: constante, gradiente ou padrão, avaliada por pixel. */
  function colorSource(kind, e, E, contentRect, doc, gradStyleKey) {
    if (kind === 'gradient') {
      const g = e.gradient || IMG.Gradients.bw();
      const style = e[gradStyleKey || 'style'] || 'linear';
      const rect = e.align === false && doc ? { x: 0, y: 0, w: doc.width, h: doc.height } : contentRect;
      const pts = IMG.Gradients.pointsFor({ x: rect.x - E.x, y: rect.y - E.y, w: rect.w, h: rect.h }, e.angle == null ? 90 : e.angle, e.scale || 100, style, e.offX || 0, e.offY || 0);
      const img = new ImageData(E.w, E.h);
      IMG.Gradients.paint(img, g, style, pts.p0, pts.p1, { reverse: e.reverse, dither: false });
      return { data: img.data };
    }
    if (kind === 'pattern') {
      const c = U.createCanvas(E.w, E.h), ctx = c.getContext('2d');
      const ox = e.link !== false ? contentRect.x - E.x : -E.x, oy = e.link !== false ? contentRect.y - E.y : -E.y;
      IMG.Patterns.fill(ctx, e.pattern, E.w, E.h, e.patScale || e.scale || 100, ox, oy);
      return { data: ctx.getImageData(0, 0, E.w, E.h).data };
    }
    const c = U.hexToRgb(e.color || '#000000');
    return { r: c.r, g: c.g, b: c.b };
  }

  /* ---------- composição por pixel ---------- */
  function mixInto(R, G, B, CV, i, cov, src, j, mode, union) {
    let sr, sg, sb, sa = 1;
    if (src.data) { const q = j * 4; sr = src.data[q]; sg = src.data[q + 1]; sb = src.data[q + 2]; sa = src.data[q + 3] / 255; }
    else { sr = src.r; sg = src.g; sb = src.b; }
    const es = cov * sa;
    if (es <= 0) return;
    const cr = R[i], cg = G[i], cb = B[i], cv = CV[i];
    let br, bg, bb;
    if (mode === 'normal') { br = sr; bg = sg; bb = sb; }
    else { const o = IMG.Blend.color(mode, Math.round(cr), Math.round(cg), Math.round(cb), sr, sg, sb); br = o[0]; bg = o[1]; bb = o[2]; }
    if (union) {
      const ao = es + cv * (1 - es);
      if (ao <= 0) return;
      const k1 = es * (1 - cv), k2 = cv * (1 - es), k3 = es * cv;
      R[i] = (k1 * sr + k2 * cr + k3 * br) / ao;
      G[i] = (k1 * sg + k2 * cg + k3 * bg) / ao;
      B[i] = (k1 * sb + k2 * cb + k3 * bb) / ao;
      CV[i] = ao;
    } else {
      // "atop": mantém a cobertura
      R[i] = cr + (br - cr) * es; G[i] = cg + (bg - cg) * es; B[i] = cb + (bb - cb) * es;
    }
  }

  /* ==================================================================
     Renderização dos efeitos de uma camada
     ================================================================== */
  function compute(L, doc, content, E) {
    const fx = L.fx, W = E.w, H = E.h, N = W * H;
    const cd = content.data;
    const a = new Float32Array(N);
    let any = false;
    for (let i = 0; i < N; i++) { a[i] = cd[i * 4 + 3] / 255; if (a[i] > 0) any = true; }
    const res = { below: [], body: null };
    if (!any) return res;
    let sdCache = null;
    const sd = () => sdCache || (sdCache = signedDist(a, W, H));
    const on = (k) => fx[k] && fx[k].enabled;
    let cb = null;
    for (let i = 0; i < N; i++) if (a[i] > 0) { const x = i % W, y = (i / W) | 0; cb = cb ? U.rectUnion(cb, { x, y, w: 1, h: 1 }) : { x, y, w: 1, h: 1 }; }
    const contentRect = { x: cb.x + E.x, y: cb.y + E.y, w: cb.w, h: cb.h };

    const toCanvas = (cov, src, opacity) => {
      const c = U.createCanvas(W, H), ctx = c.getContext('2d');
      const img = ctx.createImageData(W, H), d = img.data;
      for (let i = 0; i < N; i++) {
        const v = cov[i] * opacity; if (v <= 0) continue;
        const q = i * 4;
        if (src.data) { d[q] = src.data[q]; d[q + 1] = src.data[q + 1]; d[q + 2] = src.data[q + 2]; d[q + 3] = v * src.data[q + 3]; }
        else { d[q] = src.r; d[q + 1] = src.g; d[q + 2] = src.b; d[q + 3] = v * 255; }
      }
      ctx.putImageData(img, 0, 0);
      return c;
    };
    const glowSrc = (e, g) => {
      if (e.fillType === 'gradient' && e.gradient) {
        const T = IMG.Gradients.lut(e.gradient, 256, e.reverse);
        const data = new Uint8ClampedArray(N * 4);
        for (let i = 0; i < N; i++) { const j = Math.round((1 - clamp01(g[i])) * 255) * 4; data[i * 4] = T[j]; data[i * 4 + 1] = T[j + 1]; data[i * 4 + 2] = T[j + 2]; data[i * 4 + 3] = T[j + 3]; }
        return { data };
      }
      const c = U.hexToRgb(e.color || '#ffffbe'); return { r: c.r, g: c.g, b: c.b };
    };

    /* --- Sombra projetada --- */
    if (on('dropShadow')) {
      const e = fx.dropShadow, S = Math.max(0, e.size), r1 = (S * (e.spread || 0)) / 100, r2 = S - r1;
      let base = a;
      if (r1 > 0) { const s = sd(); base = new Float32Array(N); for (let i = 0; i < N; i++) base[i] = Math.max(a[i], clamp01(r1 + 0.5 - s[i])); }
      base = r2 > 0 ? blur(base, W, H, r2 * 0.5) : Float32Array.from(base);
      const ang = U.rad(lightAngle(e, doc));
      base = shift(base, W, H, -Math.cos(ang) * e.distance, Math.sin(ang) * e.distance);
      if (e.knockout !== false) { base = Float32Array.from(base); for (let i = 0; i < N; i++) base[i] *= 1 - a[i]; }
      res.below.push({ c: toCanvas(base, colorSource('color', e), e.opacity / 100), x: E.x, y: E.y, blend: e.blend || 'multiply', opacity: 1 });
    }
    /* --- Brilho externo --- */
    if (on('outerGlow')) {
      const e = fx.outerGlow, S = Math.max(1, e.size), s = sd();
      let g;
      if (e.technique === 'precise') {
        const hold = (S * (e.spread || 0)) / 100;
        g = new Float32Array(N);
        for (let i = 0; i < N; i++) { const dd = Math.max(0, s[i]); g[i] = dd <= hold ? 1 : clamp01(1 - (dd - hold) / Math.max(0.5, S - hold)); }
      } else {
        const r1 = (S * (e.spread || 0)) / 100, r2 = S - r1;
        g = new Float32Array(N);
        for (let i = 0; i < N; i++) g[i] = Math.max(a[i], clamp01(r1 + 0.5 - s[i]));
        if (r2 > 0) g = blur(g, W, H, r2 * 0.5);
      }
      const rp = 50 / U.clamp(e.range == null ? 50 : e.range, 1, 100);
      for (let i = 0; i < N; i++) g[i] = (1 - Math.pow(1 - clamp01(g[i]), rp)) * (1 - a[i]);
      res.below.push({ c: toCanvas(g, glowSrc(e, g), e.opacity / 100), x: E.x, y: E.y, blend: e.blend || 'screen', opacity: 1 });
    }

    /* --- corpo --- */
    const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N), CV = new Float32Array(N);
    const fill = L.fill == null ? 1 : L.fill;
    for (let i = 0; i < N; i++) { const q = i * 4; R[i] = cd[q]; G[i] = cd[q + 1]; B[i] = cd[q + 2]; CV[i] = fill; }
    const interior = (cov, src, mode, opacity) => {
      for (let i = 0; i < N; i++) { if (a[i] <= 0) continue; const v = cov ? cov[i] * opacity : opacity; if (v > 0) mixInto(R, G, B, CV, i, v, src, i, mode, true); }
    };
    if (on('patternOverlay')) { const e = fx.patternOverlay; interior(null, colorSource('pattern', e, E, contentRect, doc), e.blend, e.opacity / 100); }
    if (on('gradientOverlay')) { const e = fx.gradientOverlay; interior(null, colorSource('gradient', e, E, contentRect, doc), e.blend, e.opacity / 100); }
    if (on('colorOverlay')) { const e = fx.colorOverlay; interior(null, colorSource('color', e), e.blend, e.opacity / 100); }
    if (on('satin')) {
      const e = fx.satin, b = blur(a, W, H, Math.max(0.5, e.size * 0.5)), ang = U.rad(e.angle);
      const ox = Math.cos(ang) * e.distance, oy = -Math.sin(ang) * e.distance;
      const s1 = shift(b, W, H, ox, oy), s2 = shift(b, W, H, -ox, -oy), v = new Float32Array(N);
      for (let i = 0; i < N; i++) { let t = Math.abs(s1[i] - s2[i]); if (e.invert) t = 1 - t; v[i] = clamp01(t); }
      interior(v, colorSource('color', e), e.blend, e.opacity / 100);
    }
    if (on('innerGlow')) {
      const e = fx.innerGlow, S = Math.max(1, e.size), s = sd();
      const r1 = (S * (e.choke || 0)) / 100, r2 = S - r1;
      let g = new Float32Array(N);
      if (e.source === 'center') {
        for (let i = 0; i < N; i++) g[i] = clamp01((-s[i] - r1) / Math.max(0.5, r2));
      } else if (e.technique === 'precise') {
        for (let i = 0; i < N; i++) { const dd = Math.max(0, -s[i]); g[i] = dd <= r1 ? 1 : clamp01(1 - (dd - r1) / Math.max(0.5, r2)); }
      } else {
        for (let i = 0; i < N; i++) g[i] = Math.max(1 - a[i], clamp01(r1 + 0.5 + s[i]));
        if (r2 > 0) g = blur(g, W, H, r2 * 0.5);
      }
      for (let i = 0; i < N; i++) g[i] = clamp01(g[i]);
      interior(g, glowSrc(e, g), e.blend, e.opacity / 100);
    }
    if (on('innerShadow')) {
      const e = fx.innerShadow, S = Math.max(0, e.size), s = sd();
      const r1 = (S * (e.choke || 0)) / 100, r2 = S - r1;
      let v = new Float32Array(N);
      for (let i = 0; i < N; i++) v[i] = Math.max(1 - a[i], clamp01(r1 + 0.5 + s[i]));
      // fora do campo também é "fora da forma"
      v = r2 > 0 ? blurOutside(v, W, H, r2 * 0.5) : v;
      const ang = U.rad(lightAngle(e, doc));
      v = shiftFill(v, W, H, -Math.cos(ang) * e.distance, Math.sin(ang) * e.distance, 1);
      interior(v, colorSource('color', e), e.blend, e.opacity / 100);
    }

    /* fim dos efeitos internos: alfa do corpo */
    const P = new Float32Array(N);
    for (let i = 0; i < N; i++) P[i] = a[i] * CV[i];

    /* --- traçado --- */
    if (on('stroke')) {
      const e = fx.stroke, S = Math.max(0, e.size), s = sd(), op = e.opacity / 100;
      const src = colorSource(e.fillType || 'color', Object.assign({}, e, { style: e.gradStyle, scale: e.fillType === 'pattern' ? e.patScale : e.scale }), E, contentRect, doc, 'gradStyle');
      for (let i = 0; i < N; i++) {
        const v = s[i];
        let cov;
        if (e.position === 'inside') cov = clamp01(S + v + 0.5) * clamp01(0.5 - v);
        else if (e.position === 'center') cov = clamp01(S / 2 + 0.5 - Math.abs(v));
        else cov = clamp01(S - v + 0.5) * clamp01(v + 0.5);
        cov *= op;
        if (cov > 0) mixInto(R, G, B, P, i, cov, src, i, e.blend || 'normal', true);
      }
    }

    /* --- chanfro e entalhe --- */
    if (on('bevel')) {
      const e = fx.bevel, S = Math.max(1, e.size), s = sd();
      const style = e.style || 'inner';
      const chisel = e.technique === 'chiselHard' || e.technique === 'chiselSoft';
      const st = (t) => { if (chisel) return t; const u = Math.abs(t); return Math.sign(t) * u * u * (3 - 2 * u); };
      let h = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const v = s[i];
        const inner = clamp01(-v / S), outer = clamp01(1 - Math.max(0, v) / S);
        let t;
        if (style === 'outer') t = v <= 0 ? 1 : outer;
        else if (style === 'emboss') t = clamp01(0.5 - v / (2 * S));
        else if (style === 'pillow') t = v <= 0 ? inner : -(1 - outer);
        else t = v <= 0 ? inner : 0;
        h[i] = st(t);
      }
      const soft = (e.soften || 0) + (chisel ? (e.technique === 'chiselSoft' ? 1.5 : 0.4) : S * 0.18);
      if (soft > 0.3) h = blur(h, W, H, soft * 0.6);
      const ang = U.rad(lightAngle(e, doc)), alt = U.rad(lightAlt(e, doc));
      const lx = Math.cos(ang) * Math.cos(alt), ly = -Math.sin(ang) * Math.cos(alt), lz = Math.sin(alt);
      const k = ((e.depth || 100) / 100) * S * (e.direction === 'down' ? -1 : 1);
      const hc = U.hexToRgb(e.hlColor || '#ffffff'), scc = U.hexToRgb(e.shColor || '#000000');
      const hs = { r: hc.r, g: hc.g, b: hc.b }, ss = { r: scc.r, g: scc.g, b: scc.b };
      const ho = (e.hlOpacity == null ? 75 : e.hlOpacity) / 100, so = (e.shOpacity == null ? 75 : e.shOpacity) / 100;
      const norm = 1.6 / Math.max(0.05, 1 - lz);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x, v = s[i];
          let m;
          if (style === 'outer') m = clamp01(v + 0.5) * clamp01(S + 0.5 - v);
          else if (style === 'inner') m = a[i];
          else m = Math.max(a[i], clamp01(S + 0.5 - v) * clamp01(v + 0.5));
          if (m <= 0) continue;
          const hx = (h[x + 1 < W ? i + 1 : i] - h[x > 0 ? i - 1 : i]) * 0.5, hy = (h[y + 1 < H ? i + W : i] - h[y > 0 ? i - W : i]) * 0.5;
          const nx = -hx * k, ny = -hy * k, len = Math.sqrt(nx * nx + ny * ny + 1);
          const shade = (nx * lx + ny * ly + lz) / len - lz;
          if (shade > 0) mixInto(R, G, B, P, i, clamp01(shade * norm) * m * ho, hs, i, e.hlBlend || 'screen', true);
          else if (shade < 0) mixInto(R, G, B, P, i, clamp01(-shade * norm) * m * so, ss, i, e.shBlend || 'multiply', true);
        }
      }
    }

    /* --- saída do corpo --- */
    const c = U.createCanvas(W, H), ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H), d = img.data;
    for (let i = 0; i < N; i++) {
      const al = P[i];
      if (al <= 0) continue;
      const q = i * 4;
      d[q] = R[i]; d[q + 1] = G[i]; d[q + 2] = B[i]; d[q + 3] = al * 255;
    }
    ctx.putImageData(img, 0, 0);
    res.body = { c, x: E.x, y: E.y };
    return res;
  }

  /* desfoque em que "fora do campo" conta como 1 (para a sombra interna) */
  function blurOutside(v, w, h, sigma) {
    const p = Math.ceil(sigma * 3) + 1, W2 = w + p * 2, H2 = h + p * 2;
    const big = new Float32Array(W2 * H2).fill(1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) big[(y + p) * W2 + x + p] = v[y * w + x];
    const b = blur(big, W2, H2, sigma), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = b[(y + p) * W2 + x + p];
    return out;
  }
  function shiftFill(src, w, h, dx, dy, fillV) {
    dx = Math.round(dx); dy = Math.round(dy);
    if (!dx && !dy) return src;
    const out = new Float32Array(w * h).fill(fillV);
    for (let y = 0; y < h; y++) {
      const sy = y - dy; if (sy < 0 || sy >= h) continue;
      for (let x = 0; x < w; x++) { const sx = x - dx; if (sx >= 0 && sx < w) out[y * w + x] = src[sy * w + sx]; }
    }
    return out;
  }

  const Effects = (IMG.Effects = {
    DEF, ORDER, NAMES, LIST, active, pad, blur, edt, signedDist,

    defaults(kind) { return JSON.parse(JSON.stringify(DEF[kind])); },
    has(L) { return !!active(L); },
    count(L) { if (!L.fx) return 0; return LIST.filter((k) => L.fx[k] && L.fx[k].enabled).length; },

    /**
     * Resultado (em cache) dos efeitos de uma camada.
     * contentFn(E) → canvas com o conteúdo (pixels × máscaras) no retângulo E.
     */
    get(L, doc, bounds, contentFn, contentKey) {
      const fx = active(L);
      if (!fx || !bounds) return null;
      const p = pad(fx);
      const lim = U.rectInflate({ x: 0, y: 0, w: doc.width, h: doc.height }, p + 64);
      let E = U.rectIntersect(U.rectInt(U.rectInflate(bounds, p)), lim);
      if (!E) return null;
      if (E.w * E.h > 40e6) E = U.rectIntersect(E, { x: 0, y: 0, w: doc.width, h: doc.height }) || E;
      const key = contentKey + '|' + JSON.stringify(fx) + '|' + (L.fill == null ? 1 : L.fill) + '|' + (doc.globalAngle || 120) + ',' + (doc.globalAltitude || 30) + '|' + E.x + ',' + E.y + ',' + E.w + ',' + E.h + '|' + IMG.app.fg + IMG.app.bg;
      if (L._fxc && L._fxc.key === key) return L._fxc;
      const cc = contentFn(E);
      const content = cc.getContext('2d').getImageData(0, 0, E.w, E.h);
      const r = compute(L, doc, content, E);
      r.key = key;
      L._fxc = r;
      return r;
    },
    invalidate(L) { if (L) L._fxc = null; }
  });
  void Effects;
})();
