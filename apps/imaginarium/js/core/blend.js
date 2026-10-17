/* ==========================================================================
   Imaginarium — modos de mesclagem
   Os 27 modos do Photoshop/Photopea. Os que o Canvas 2D implementa de forma
   nativa usam globalCompositeOperation; os demais (e qualquer mesclagem com
   "Mesclar se" ou restrição de canais) são calculados em JavaScript sobre os
   pixels, com tabelas de consulta de 256 × 256 para os modos separáveis.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U;

  /* nomes oficiais do Photoshop em português */
  IMG.BLEND_LIST = [
    ['normal', 'Normal'], ['dissolve', 'Dissolver'], null,
    ['darken', 'Escurecer'], ['multiply', 'Multiplicação'], ['color-burn', 'Superexposição de Cores'], ['linear-burn', 'Superexposição Linear'], ['darker-color', 'Cor Mais Escura'], null,
    ['lighten', 'Clarear'], ['screen', 'Tela'], ['color-dodge', 'Subexposição de Cores'], ['linear-dodge', 'Subexposição Linear (Adição)'], ['lighter-color', 'Cor Mais Clara'], null,
    ['overlay', 'Sobrepor'], ['soft-light', 'Luz Indireta'], ['hard-light', 'Luz Direta'], ['vivid-light', 'Luz Brilhante'], ['linear-light', 'Luz Linear'], ['pin-light', 'Luz do Pino'], ['hard-mix', 'Mistura Sólida'], null,
    ['difference', 'Diferença'], ['exclusion', 'Exclusão'], ['subtract', 'Subtrair'], ['divide', 'Dividir'], null,
    ['hue', 'Matiz'], ['saturation', 'Saturação'], ['color', 'Cor'], ['luminosity', 'Luminosidade']
  ];
  IMG.BLEND_LIST_GROUP = [['pass', 'Passagem']].concat(IMG.BLEND_LIST);
  IMG.BLEND_NAMES = {};
  IMG.BLEND_LIST_GROUP.forEach((b) => { if (b) IMG.BLEND_NAMES[b[0]] = b[1]; });

  const NATIVE = {
    normal: 'source-over', darken: 'darken', multiply: 'multiply', 'color-burn': 'color-burn',
    lighten: 'lighten', screen: 'screen', 'color-dodge': 'color-dodge',
    overlay: 'overlay', 'soft-light': 'soft-light', 'hard-light': 'hard-light',
    difference: 'difference', exclusion: 'exclusion',
    hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity'
  };
  /* compatibilidade com o mapa antigo */
  IMG.BLEND = Object.assign({}, NATIVE, { pass: 'source-over' });
  IMG.BLEND_LIST.forEach((b) => { if (b && !IMG.BLEND[b[0]]) IMG.BLEND[b[0]] = 'source-over'; });

  /* ---------- funções de mesclagem separáveis (valores 0..1) ---------- */
  const SEP = {
    normal: (b, s) => s,
    darken: (b, s) => Math.min(b, s),
    multiply: (b, s) => b * s,
    'color-burn': (b, s) => (b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s)),
    'linear-burn': (b, s) => Math.max(0, b + s - 1),
    lighten: (b, s) => Math.max(b, s),
    screen: (b, s) => b + s - b * s,
    'color-dodge': (b, s) => (b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s))),
    'linear-dodge': (b, s) => Math.min(1, b + s),
    overlay: (b, s) => (b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
    'soft-light': (b, s) => (s <= 0.5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * (Math.sqrt(b) - b)),
    'hard-light': (b, s) => (s <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
    'vivid-light': (b, s) => {
      if (s <= 0.5) { const s2 = 2 * s; return b >= 1 ? 1 : s2 <= 0 ? 0 : Math.max(0, 1 - (1 - b) / s2); }
      const s2 = 2 * (s - 0.5); return b <= 0 ? 0 : s2 >= 1 ? 1 : Math.min(1, b / (1 - s2));
    },
    'linear-light': (b, s) => Math.max(0, Math.min(1, b + 2 * s - 1)),
    'pin-light': (b, s) => (s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1)),
    'hard-mix': (b, s) => (b + s >= 1 ? 1 : 0),
    difference: (b, s) => Math.abs(b - s),
    exclusion: (b, s) => b + s - 2 * b * s,
    subtract: (b, s) => Math.max(0, b - s),
    divide: (b, s) => (s <= 0 ? (b > 0 ? 1 : 0) : Math.min(1, b / s))
  };
  const NONSEP = { 'darker-color': 1, 'lighter-color': 1, hue: 1, saturation: 1, color: 1, luminosity: 1 };

  const luts = {};
  function lut(mode) {
    let t = luts[mode];
    if (t) return t;
    const f = SEP[mode] || SEP.normal;
    t = new Uint8Array(65536);
    for (let b = 0; b < 256; b++) for (let s = 0; s < 256; s++) t[(b << 8) | s] = Math.round(f(b / 255, s / 255) * 255);
    luts[mode] = t;
    return t;
  }

  /* ---------- não separáveis (W3C Compositing) ---------- */
  const Lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
  function clipColor(c) {
    const l = Lum(c[0], c[1], c[2]), n = Math.min(c[0], c[1], c[2]), x = Math.max(c[0], c[1], c[2]);
    if (n < 0) { const k = l - n || 1e-9; c[0] = l + ((c[0] - l) * l) / k; c[1] = l + ((c[1] - l) * l) / k; c[2] = l + ((c[2] - l) * l) / k; }
    if (x > 1) { const k = x - l || 1e-9; c[0] = l + ((c[0] - l) * (1 - l)) / k; c[1] = l + ((c[1] - l) * (1 - l)) / k; c[2] = l + ((c[2] - l) * (1 - l)) / k; }
    return c;
  }
  function setLum(c, l) { const d = l - Lum(c[0], c[1], c[2]); c[0] += d; c[1] += d; c[2] += d; return clipColor(c); }
  const Sat = (c) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
  function setSat(c, s) {
    const idx = [0, 1, 2].sort((a, b) => c[a] - c[b]);
    const mn = idx[0], md = idx[1], mx = idx[2];
    const out = [0, 0, 0];
    if (c[mx] > c[mn]) { out[md] = ((c[md] - c[mn]) * s) / (c[mx] - c[mn]); out[mx] = s; }
    out[mn] = 0;
    return out;
  }
  function nonSep(mode, br, bg, bb, sr, sg, sb, out) {
    let c;
    switch (mode) {
      case 'hue': c = setLum(setSat([sr, sg, sb], Sat([br, bg, bb])), Lum(br, bg, bb)); break;
      case 'saturation': c = setLum(setSat([br, bg, bb], Sat([sr, sg, sb])), Lum(br, bg, bb)); break;
      case 'color': c = setLum([sr, sg, sb], Lum(br, bg, bb)); break;
      case 'luminosity': c = setLum([br, bg, bb], Lum(sr, sg, sb)); break;
      case 'darker-color': c = Lum(sr, sg, sb) < Lum(br, bg, bb) ? [sr, sg, sb] : [br, bg, bb]; break;
      case 'lighter-color': c = Lum(sr, sg, sb) > Lum(br, bg, bb) ? [sr, sg, sb] : [br, bg, bb]; break;
      default: c = [sr, sg, sb];
    }
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  }

  /* ruído estável para "Dissolver" */
  function hash(i) { let x = (i * 374761393) | 0; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }

  /** Peso de "Mesclar se" para um valor de cinza. r = [preto0, preto1, branco0, branco1] (0..255). */
  function blendIfW(v, r) {
    if (!r) return 1;
    const [a0, a1, b0, b1] = r;
    let w = 1;
    if (v < a0) w = 0; else if (v < a1) w = (v - a0) / Math.max(1, a1 - a0);
    if (v > b1) w = 0; else if (v > b0) w = Math.min(w, (b1 - v) / Math.max(1, b1 - b0));
    return w;
  }

  /**
   * Mescla os pixels s (fonte) sobre d (destino), no lugar.
   * d, s: Uint8ClampedArray RGBA não pré-multiplicados de mesmo tamanho.
   * opts: { blendIf: { gray: { self: [..], under: [..] } }, channels: {r,g,b}, x0, w }
   */
  function blendPixels(d, s, mode, alpha, opts) {
    const n = d.length;
    const isNon = !!NONSEP[mode];
    const L = isNon ? null : lut(mode === 'dissolve' ? 'normal' : mode);
    const dissolve = mode === 'dissolve';
    const bi = opts && opts.blendIf, chans = opts && opts.channels;
    const selfR = bi && bi.self, underR = bi && bi.under;
    const cr = !chans || chans.r !== false, cg = !chans || chans.g !== false, cb = !chans || chans.b !== false;
    const tmp = [0, 0, 0];
    const off = (opts && opts.seed) || 0;
    for (let i = 0; i < n; i += 4) {
      let as = (s[i + 3] / 255) * alpha;
      if (as <= 0) continue;
      if (dissolve) { if (hash((i >> 2) + off) >= as) continue; as = 1; }
      const ab = d[i + 3] / 255;
      if (selfR || underR) {
        if (selfR) as *= blendIfW(0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2], selfR);
        if (underR && ab > 0) as *= blendIfW(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2], underR);
        if (as <= 0) continue;
      }
      const ao = as + ab - as * ab;
      if (ao <= 0) continue;
      const k1 = as * (1 - ab), k2 = ab * (1 - as), k3 = as * ab;
      let Br, Bg, Bb;
      if (isNon) {
        nonSep(mode, d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, s[i] / 255, s[i + 1] / 255, s[i + 2] / 255, tmp);
        Br = tmp[0] * 255; Bg = tmp[1] * 255; Bb = tmp[2] * 255;
      } else {
        Br = L[(d[i] << 8) | s[i]]; Bg = L[(d[i + 1] << 8) | s[i + 1]]; Bb = L[(d[i + 2] << 8) | s[i + 2]];
      }
      const sr = cr ? s[i] : d[i], sg = cg ? s[i + 1] : d[i + 1], sb = cb ? s[i + 2] : d[i + 2];
      if (!cr) Br = d[i]; if (!cg) Bg = d[i + 1]; if (!cb) Bb = d[i + 2];
      d[i] = (k1 * sr + k2 * d[i] + k3 * Br) / ao;
      d[i + 1] = (k1 * sg + k2 * d[i + 1] + k3 * Bg) / ao;
      d[i + 2] = (k1 * sb + k2 * d[i + 2] + k3 * Bb) / ao;
      d[i + 3] = ao * 255;
    }
  }

  const Blend = (IMG.Blend = {
    NATIVE, SEP, lut, blendPixels, nonSep, blendIfW,
    isNative(mode) { return !!NATIVE[mode]; },

    /**
     * Desenha o canvas src em (dx, dy) sobre ctx (sem transformações), com o
     * modo e a opacidade dados. opts: { blendIf, channels } força o caminho em JS.
     */
    draw(ctx, src, dx, dy, mode, alpha, opts) {
      if (!(alpha > 0) || !src) return;
      if (!mode || mode === 'pass') mode = 'normal';
      const special = opts && ((opts.blendIf && (opts.blendIf.self || opts.blendIf.under)) || (opts.channels && (opts.channels.r === false || opts.channels.g === false || opts.channels.b === false)));
      const native = NATIVE[mode];
      if (native && !special) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.globalCompositeOperation = native;
        ctx.drawImage(src, dx, dy);
        ctx.restore();
        return;
      }
      const W = ctx.canvas.width, H = ctx.canvas.height;
      dx = Math.round(dx); dy = Math.round(dy);
      const r = U.rectIntersect({ x: dx, y: dy, w: src.width, h: src.height }, { x: 0, y: 0, w: W, h: H });
      if (!r) return;
      const dst = ctx.getImageData(r.x, r.y, r.w, r.h);
      const sc = src.getContext('2d');
      const s = sc.getImageData(r.x - dx, r.y - dy, r.w, r.h);
      blendPixels(dst.data, s.data, mode, Math.min(1, alpha), opts);
      ctx.putImageData(dst, r.x, r.y);
    },

    /** Mescla uma cor (rgb 0..255) com outra pelo modo dado (para pincéis e efeitos). */
    color(mode, br, bg, bb, sr, sg, sb) {
      if (NONSEP[mode]) { const o = [0, 0, 0]; nonSep(mode, br / 255, bg / 255, bb / 255, sr / 255, sg / 255, sb / 255, o); return [o[0] * 255, o[1] * 255, o[2] * 255]; }
      const L = lut(mode === 'dissolve' ? 'normal' : mode);
      return [L[(br << 8) | sr], L[(bg << 8) | sg], L[(bb << 8) | sb]];
    }
  });
  void Blend;
})();
