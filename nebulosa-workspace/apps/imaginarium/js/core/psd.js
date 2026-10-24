/* ==========================================================================
   Imaginarium — PSD / PSB (leitura e gravação), sem bibliotecas externas
   Leitura: modos RGB, Tons de cinza, CMYK, Lab, Indexado e Bitmap; 8/16/32
   bits; compressão RAW, RLE e ZIP; grupos; modos de mesclagem; opacidade e
   preenchimento; máscaras de camada e vetoriais; camadas de forma; texto
   editável (TySh/EngineData); estilos de camada (lfx2); camadas de ajuste e
   de preenchimento comuns; guias e resolução.
   Gravação: camadas, grupos, máscaras, formas (SoCo + vmsk), estilos (lfx2),
   ajustes simples, nomes Unicode, cores das camadas, guias, resolução e
   imagem composta.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, F = IMG.Formats;
  const { Reader, Writer } = F;

  /* ---------- tabelas ---------- */
  const BK = { pass: 'pass', norm: 'normal', diss: 'dissolve', dark: 'darken', 'mul ': 'multiply', idiv: 'color-burn', lbrn: 'linear-burn', dkCl: 'darker-color', lite: 'lighten', scrn: 'screen', 'div ': 'color-dodge', lddg: 'linear-dodge', lgCl: 'lighter-color', over: 'overlay', sLit: 'soft-light', hLit: 'hard-light', vLit: 'vivid-light', lLit: 'linear-light', pLit: 'pin-light', hMix: 'hard-mix', diff: 'difference', smud: 'exclusion', fsub: 'subtract', fdiv: 'divide', 'hue ': 'hue', 'sat ': 'saturation', colr: 'color', 'lum ': 'luminosity' };
  const BK_INV = {}; Object.keys(BK).forEach((k) => { BK_INV[BK[k]] = k; });
  const BM = { Nrml: 'normal', Dslv: 'dissolve', Drkn: 'darken', Mltp: 'multiply', CBrn: 'color-burn', linearBurn: 'linear-burn', darkerColor: 'darker-color', Lghn: 'lighten', Scrn: 'screen', CDdg: 'color-dodge', linearDodge: 'linear-dodge', lighterColor: 'lighter-color', Ovrl: 'overlay', SftL: 'soft-light', HrdL: 'hard-light', vividLight: 'vivid-light', linearLight: 'linear-light', pinLight: 'pin-light', hardMix: 'hard-mix', Dfrn: 'difference', Xclu: 'exclusion', blendSubtraction: 'subtract', blendDivide: 'divide', 'H   ': 'hue', Strt: 'saturation', 'Clr ': 'color', Lmns: 'luminosity', passThrough: 'pass' };
  const BM_INV = {}; Object.keys(BM).forEach((k) => { BM_INV[BM[k]] = k; });
  const LCOLORS = [null, '#d9534f', '#f0ad4e', '#e8d44d', '#5cb85c', '#5bc0de', '#9b6bd6', '#8c8c8c'];
  const BG_NAMES = ['background', 'fundo', 'plano de fundo', 'hintergrund', 'fond', 'fondo', 'sfondo', 'achtergrond', 'tło', 'фон', '背景', '배경'];
  const PATH_OPS = ['xor', 'add', 'sub', 'int'];

  /* ==================================================================
     DESCRITORES (leitura)
     ================================================================== */
  function rUni(r) { const n = r.u32(); let s = ''; for (let i = 0; i < n; i++) { const c = r.u16(); if (c) s += String.fromCharCode(c); } return s; }
  function rKey(r) { const n = r.u32(); return r.ascii(n || 4); }
  function rDesc(r) { rUni(r); const cls = rKey(r), n = r.u32(), o = { _class: cls }; for (let i = 0; i < n; i++) { const k = rKey(r); o[k] = rItem(r); } return o; }
  function rRef(r) {
    const n = r.u32(), out = [];
    for (let i = 0; i < n; i++) {
      const t = r.ascii(4);
      if (t === 'prop') { rUni(r); rKey(r); out.push(rKey(r)); }
      else if (t === 'Clss') { rUni(r); out.push(rKey(r)); }
      else if (t === 'Enmr') { rUni(r); rKey(r); rKey(r); out.push(rKey(r)); }
      else if (t === 'rele') { rUni(r); rKey(r); out.push(r.u32()); }
      else if (t === 'Idnt' || t === 'indx') out.push(r.u32());
      else if (t === 'name') { rUni(r); rKey(r); out.push(rUni(r)); }
    }
    return out;
  }
  function rItem(r, type) {
    type = type || r.ascii(4);
    switch (type) {
      case 'obj ': return rRef(r);
      case 'Objc': case 'GlbO': return rDesc(r);
      case 'VlLs': { const n = r.u32(), a = []; for (let i = 0; i < n; i++) a.push(rItem(r)); return a; }
      case 'doub': return r.f64();
      case 'UntF': { const unit = r.ascii(4); return { unit, value: r.f64() }; }
      case 'UnFl': { const unit = r.ascii(4), n = r.u32(), v = []; for (let i = 0; i < n; i++) v.push(r.f64()); return { unit, values: v }; }
      case 'TEXT': return rUni(r);
      case 'enum': { const t = rKey(r); return { _enum: t, value: rKey(r) }; }
      case 'long': return r.i32();
      case 'comp': { const hi = r.i32(), lo = r.u32(); return hi * 4294967296 + lo; }
      case 'bool': return !!r.u8();
      case 'type': case 'GlbC': { rUni(r); return { _class: rKey(r) }; }
      case 'alis': case 'tdta': case 'Pth ': { const n = r.u32(); return r.bytes(n); }
      case 'ObAr': {
        r.u32(); rUni(r); rKey(r); const n = r.u32(), o = {};
        for (let i = 0; i < n; i++) { const k = rKey(r), t = r.ascii(4); if (t === 'UnFl') { const unit = r.ascii(4), c = r.u32(), v = []; for (let j = 0; j < c; j++) v.push(r.f64()); o[k] = { unit, values: v }; } else o[k] = rItem(r, t); }
        return o;
      }
      default: throw new Error('tipo de descritor desconhecido: ' + type);
    }
  }
  const val = (x, d) => (x == null ? d : typeof x === 'object' && 'value' in x ? x.value : x);
  const en = (x) => (x && x.value != null ? String(x.value).trim() : x ? String(x).trim() : '');
  function colorOf(c) {
    if (!c) return '#000000';
    const h2 = (v) => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    if (c._class === 'RGBC' || c['Rd  '] != null) return '#' + h2(val(c['Rd  '], 0)) + h2(val(c['Grn '], 0)) + h2(val(c['Bl  '], val(c.Bl, 0)));
    if (c._class === 'HSBC') { const rgb = U.hsvToRgb ? U.hsvToRgb(val(c['H   '], 0), val(c.Strt, 0) / 100, val(c.Brgh, 0) / 100) : null; if (rgb) return U.rgbToHex(rgb.r, rgb.g, rgb.b); }
    if (c._class === 'Grsc') { const v = 255 - val(c['Gry '], 0) * 2.55; return '#' + h2(v) + h2(v) + h2(v); }
    if (c._class === 'CMYC') { const C = val(c['Cyn '], 0) / 100, M = val(c.Mgnt, 0) / 100, Y = val(c['Ylw '], 0) / 100, K = val(c.Blck, 0) / 100; return '#' + h2(255 * (1 - C) * (1 - K)) + h2(255 * (1 - M) * (1 - K)) + h2(255 * (1 - Y) * (1 - K)); }
    if (c._class === 'LbCl') { const rgb = labToRgb(val(c.Lmnc, 0), val(c['A   '], 0), val(c['B   '], 0)); return '#' + h2(rgb[0]) + h2(rgb[1]) + h2(rgb[2]); }
    return '#000000';
  }
  function labToRgb(L, a, b) {
    let y = (L + 16) / 116, x = a / 500 + y, z = y - b / 200;
    const f = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
    x = 0.95047 * f(x); y = f(y); z = 1.08883 * f(z);
    let r = x * 3.2406 + y * -1.5372 + z * -0.4986, g = x * -0.9689 + y * 1.8758 + z * 0.0415, bl = x * 0.0557 + y * -0.204 + z * 1.057;
    const gm = (v) => (v > 0.0031308 ? 1.055 * v ** (1 / 2.4) - 0.055 : 12.92 * v);
    return [gm(r) * 255, gm(g) * 255, gm(bl) * 255].map((v) => U.clamp(Math.round(v), 0, 255));
  }
  function gradOf(g) {
    if (!g) return null;
    const cols = (g.Clrs || []).map((s) => { const t = en(s.Type); return { t: U.clamp(val(s.Lctn, 0) / 4096, 0, 1), c: t === 'FrgC' ? 'fg' : t === 'BckC' ? 'bg' : colorOf(s['Clr ']) }; });
    const al = (g.Trns || []).map((s) => ({ t: U.clamp(val(s.Lctn, 0) / 4096, 0, 1), a: U.clamp(val(s.Opct, 100) / 100, 0, 1) }));
    return { name: g['Nm  '] || 'Gradiente', colors: cols.length ? cols : [{ t: 0, c: '#000000' }, { t: 1, c: '#ffffff' }], alphas: al.length ? al : [{ t: 0, a: 1 }, { t: 1, a: 1 }] };
  }
  const GRAD_STYLE = { Lnr: 'linear', Rdl: 'radial', Angl: 'angle', Rflc: 'reflected', Dmnd: 'diamond' };
  const GRAD_STYLE_INV = { linear: 'Lnr ', radial: 'Rdl ', angle: 'Angl', reflected: 'Rflc', diamond: 'Dmnd' };

  /** Estilos de camada (lfx2/lmfx) → L.fx */
  function fxFromDesc(d, pmap) {
    pmap = pmap || {};
    const E = IMG.Effects, fx = {};
    const pick = (k, multi) => d[k] || (d[multi] && d[multi][0]);
    const base = (e) => ({ enabled: e.enab !== false, blend: BM[en(e['Md  '])] || 'normal', opacity: Math.round(val(e.Opct, 100)) });
    let e;
    if ((e = pick('DrSh', 'dropShadowMulti'))) fx.dropShadow = Object.assign(E.defaults('dropShadow'), base(e), { color: colorOf(e['Clr ']), angle: val(e.lagl, 120), useGlobal: !!e.uglg, distance: val(e.Dstn, 5), spread: val(e.Ckmt, 0), size: val(e.blur, 5), knockout: e.layerConceals !== false });
    if ((e = pick('IrSh', 'innerShadowMulti'))) fx.innerShadow = Object.assign(E.defaults('innerShadow'), base(e), { color: colorOf(e['Clr ']), angle: val(e.lagl, 120), useGlobal: !!e.uglg, distance: val(e.Dstn, 5), choke: val(e.Ckmt, 0), size: val(e.blur, 5) });
    if ((e = d.OrGl)) fx.outerGlow = Object.assign(E.defaults('outerGlow'), base(e), { fillType: e.Grad ? 'gradient' : 'color', color: e['Clr '] ? colorOf(e['Clr ']) : '#ffffbe', gradient: gradOf(e.Grad), technique: en(e.GlwT) === 'PrBL' ? 'precise' : 'softer', spread: val(e.Ckmt, 0), size: val(e.blur, 5), range: val(e.Inpr, 50) });
    if ((e = d.IrGl)) fx.innerGlow = Object.assign(E.defaults('innerGlow'), base(e), { fillType: e.Grad ? 'gradient' : 'color', color: e['Clr '] ? colorOf(e['Clr ']) : '#ffffbe', gradient: gradOf(e.Grad), technique: en(e.GlwT) === 'PrBL' ? 'precise' : 'softer', source: en(e.glwS) === 'SrcC' ? 'center' : 'edge', choke: val(e.Ckmt, 0), size: val(e.blur, 5), range: val(e.Inpr, 50) });
    if ((e = d.ebbl)) fx.bevel = Object.assign(E.defaults('bevel'), { enabled: e.enab !== false, style: { OtrB: 'outer', InrB: 'inner', Embs: 'emboss', PlEb: 'pillow', strokeEmboss: 'stroke' }[en(e.bvlS)] || 'inner', technique: { SfBL: 'smooth', PrBL: 'chiselHard', Slmt: 'chiselSoft' }[en(e.bvlT)] || 'smooth', depth: val(e.srgR, 100), direction: en(e.bvlD) === 'Out' ? 'down' : 'up', size: val(e.blur, 5), soften: val(e.Sftn, 0), angle: val(e.lagl, 120), useGlobal: !!e.uglg, altitude: val(e.Lald, 30), hlBlend: BM[en(e.hglM)] || 'screen', hlColor: colorOf(e.hglC), hlOpacity: Math.round(val(e.hglO, 75)), shBlend: BM[en(e.sdwM)] || 'multiply', shColor: colorOf(e.sdwC), shOpacity: Math.round(val(e.sdwO, 75)) });
    if ((e = d.ChFX)) fx.satin = Object.assign(E.defaults('satin'), base(e), { color: colorOf(e['Clr ']), angle: val(e.lagl, 19), distance: val(e.Dstn, 11), size: val(e.blur, 14), invert: !!e.Invr });
    if ((e = pick('SoFi', 'solidFillMulti'))) fx.colorOverlay = Object.assign(E.defaults('colorOverlay'), base(e), { color: colorOf(e['Clr ']) });
    if ((e = pick('GrFl', 'gradientFillMulti'))) fx.gradientOverlay = Object.assign(E.defaults('gradientOverlay'), base(e), { gradient: gradOf(e.Grad), reverse: !!e.Rvrs, style: GRAD_STYLE[en(e.Type)] || 'linear', align: e.Algn !== false, angle: val(e.Angl, 90), scale: val(e['Scl '], 100), offX: e.Ofst ? val(e.Ofst.Hrzn, 0) : 0, offY: e.Ofst ? val(e.Ofst.Vrtc, 0) : 0 });
    if ((e = d.patternFill)) fx.patternOverlay = Object.assign(E.defaults('patternOverlay'), base(e), { scale: val(e['Scl '], 100), pattern: (e.Ptrn && pmap[e.Ptrn.Idnt]) || 'p0' });
    if ((e = pick('FrFX', 'frameFXMulti'))) { const pt = en(e.PntT); fx.stroke = Object.assign(E.defaults('stroke'), base(e), { size: val(e['Sz  '], 3), position: { OutF: 'outside', InsF: 'inside', CtrF: 'center' }[en(e.Styl)] || 'outside', fillType: pt === 'GrFl' ? 'gradient' : pt === 'Ptrn' ? 'pattern' : 'color', color: colorOf(e['Clr ']), gradient: gradOf(e.Grad), pattern: (e.Ptrn && pmap[e.Ptrn.Idnt]) || 'p0', patScale: val(e['Scl '], 100), gradStyle: GRAD_STYLE[en(e.Type)] || 'linear', angle: val(e.Angl, 90), scale: val(e['Scl '], 100) }); }
    return Object.keys(fx).length ? fx : null;
  }

  /* ==================================================================
     EngineData (texto)
     ================================================================== */
  function parseEngineData(b) {
    let i = 0; const n = b.length;
    const DELIM = (c) => c <= 32 || c === 0x2f || c === 0x5b || c === 0x5d || c === 0x3c || c === 0x3e || c === 0x28 || c === 0x29;
    const ws = () => { while (i < n && b[i] <= 32) i++; };
    const tok = () => { const st = i; while (i < n && !DELIM(b[i])) i++; let s = ''; for (let k = st; k < i; k++) s += String.fromCharCode(b[k]); return s; };
    function value() {
      ws();
      if (i >= n) return null;
      const c = b[i];
      if (c === 0x3c && b[i + 1] === 0x3c) {
        i += 2; const o = {};
        for (;;) { ws(); if (i >= n) return o; if (b[i] === 0x3e && b[i + 1] === 0x3e) { i += 2; return o; } if (b[i] !== 0x2f) { i++; continue; } i++; const k = tok(); o[k] = value(); }
      }
      if (c === 0x5b) { i++; const a = []; for (;;) { ws(); if (i >= n) return a; if (b[i] === 0x5d) { i++; return a; } a.push(value()); } }
      if (c === 0x28) {
        i++; const out = [];
        while (i < n) { let ch = b[i++]; if (ch === 0x5c) { ch = b[i++]; out.push(ch); continue; } if (ch === 0x29) break; out.push(ch); }
        if (out[0] === 0xfe && out[1] === 0xff) { let s = ''; for (let k = 2; k + 1 < out.length; k += 2) s += String.fromCharCode((out[k] << 8) | out[k + 1]); return s; }
        return String.fromCharCode.apply(null, out);
      }
      if (c === 0x2f) { i++; return { _name: tok() }; }
      const t = tok();
      if (!t) { i++; return null; }
      if (t === 'true') return true; if (t === 'false') return false; if (t === 'null') return null;
      const v = parseFloat(t); return isNaN(v) ? t : v;
    }
    return value();
  }
  function fontFromPS(ps) {
    let name = String(ps || 'Arial');
    const [famRaw, styRaw = ''] = name.split('-');
    let fam = famRaw.replace(/PSMT$|MT$|PS$/, '');
    fam = fam.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    const sty = (styRaw + (/(Bold|Italic|Light|Black)/.test(famRaw) ? famRaw : '')).toLowerCase();
    const weight = /black|heavy/.test(sty) ? 900 : /extrabold|ultrabold/.test(sty) ? 800 : /semibold|demibold|demi/.test(sty) ? 600 : /bold/.test(sty) ? 700 : /medium/.test(sty) ? 500 : /extralight|ultralight/.test(sty) ? 200 : /light/.test(sty) ? 300 : /thin|hairline/.test(sty) ? 100 : 400;
    const italic = /italic|oblique|\bit\b|^it$/.test(sty);
    const known = { 'Times New Roman': 'Times New Roman', 'Arial': 'Arial', 'Helvetica': 'Helvetica', 'Courier New': 'Courier New', 'Myriad Pro': 'Myriad Pro', 'Minion Pro': 'Minion Pro' };
    return { font: known[fam] || fam || 'Arial', weight, italic };
  }
  /** TySh → modelo de texto do Imaginarium. */
  function textFromTySh(r, len, doc) {
    const end = r.pos + len;
    r.u16();
    const xx = r.f64(), xy = r.f64(), yx = r.f64(), yy = r.f64(), tx = r.f64(), ty = r.f64();
    r.u16(); r.u32();
    const td = rDesc(r);
    let warp = null;
    try { r.u16(); r.u32(); const wd = rDesc(r); const st = en(wd.warpStyle); if (st && st !== 'warpNone') warp = { style: st.replace(/^warp/, '').replace(/^./, (c) => c.toLowerCase()), bend: val(wd.warpValue, 0), h: val(wd.warpPerspective, 0), v: val(wd.warpPerspectiveOther, 0), vertical: en(wd.warpRotate) === 'Vrtc' }; } catch (err) { /* sem deformação */ }
    r.seek(end);
    const T = IMG.Text, DS = T.DEF_STYLE, DP = T.DEF_PARA;
    let raw = td['Txt '] || '';
    let ed = null; try { ed = td.EngineData ? parseEngineData(td.EngineData) : null; } catch (err) { console.warn('EngineData', err); }
    const E = ed && ed.EngineDict, R = ed && (ed.ResourceDict || ed.DocumentResources);
    const fonts = R && R.FontSet ? R.FontSet.map((f) => f.Name) : [];
    let text = (E && E.Editor && E.Editor.Text) || raw;
    text = String(text).replace(/\r/g, '\n').replace(/\u0003/g, '\n');
    const totalLen = text.length;
    if (text.endsWith('\n')) text = text.slice(0, -1);
    const defSheet = R && R.StyleSheetSet && R.StyleSheetSet[0] && R.StyleSheetSet[0].StyleSheetData || {};
    const toStyle = (sd) => {
      const s = Object.assign({}, DS), d2 = Object.assign({}, defSheet, sd || {});
      if (d2.Font != null && fonts[d2.Font]) Object.assign(s, fontFromPS(fonts[d2.Font]));
      if (d2.FontSize != null) s.size = d2.FontSize;
      if (d2.FauxBold) s.fauxBold = true; if (d2.FauxItalic) s.fauxItalic = true;
      if (d2.AutoLeading === false && d2.Leading != null) s.leading = d2.Leading;
      if (d2.Tracking != null) s.tracking = d2.Tracking;
      if (d2.HorizontalScale != null) s.hScale = d2.HorizontalScale * 100;
      if (d2.VerticalScale != null) s.vScale = d2.VerticalScale * 100;
      if (d2.BaselineShift != null) s.shift = d2.BaselineShift;
      if (d2.FontCaps === 1) s.caps = 'small'; else if (d2.FontCaps === 2) s.caps = 'all';
      if (d2.FontBaseline === 1) s.pos = 'super'; else if (d2.FontBaseline === 2) s.pos = 'sub';
      if (d2.Underline) s.underline = true; if (d2.Strikethrough) s.strike = true;
      if (d2.FillColor && d2.FillColor.Values) { const v = d2.FillColor.Values; s.color = U.rgbToHex(Math.round(v[1] * 255), Math.round(v[2] * 255), Math.round(v[3] * 255)); }
      if (d2.Kerning === 0 || d2.AutoKerning === false) s.kern = 'none';
      return s;
    };
    const runs = [];
    if (E && E.StyleRun && E.StyleRun.RunArray) {
      const ra = E.StyleRun.RunArray, rl = E.StyleRun.RunLengthArray || [];
      let acc = 0;
      ra.forEach((run, k) => { let n = rl[k] || 0; if (acc + n > text.length) n = Math.max(0, text.length - acc); acc += n; if (n || !runs.length) runs.push({ n, s: toStyle(run.StyleSheet && run.StyleSheet.StyleSheetData) }); });
      if (acc < text.length) runs[runs.length - 1].n += text.length - acc;
    } else runs.push({ n: text.length, s: toStyle(null) });
    const JUST = ['left', 'right', 'center', 'justify-left', 'justify-right', 'justify-center', 'justify-all'];
    const paras = [];
    const nPara = text.split('\n').length;
    if (E && E.ParagraphRun && E.ParagraphRun.RunArray) {
      const pa = E.ParagraphRun.RunArray, pl = E.ParagraphRun.RunLengthArray || [];
      let pos = 0, k = 0, used = 0;
      const lens = text.split('\n').map((p) => p.length + 1);
      for (let i = 0; i < nPara; i++) {
        while (k < pl.length - 1 && pos >= used + pl[k]) { used += pl[k]; k++; }
        const pr = (pa[k] && pa[k].ParagraphSheet && pa[k].ParagraphSheet.Properties) || {};
        paras.push(Object.assign({}, DP, { align: JUST[pr.Justification || 0] || 'left', indL: pr.StartIndent || 0, indR: pr.EndIndent || 0, indF: pr.FirstLineIndent || 0, spB: pr.SpaceBefore || 0, spA: pr.SpaceAfter || 0, hyph: !!pr.AutoHyphenate }));
        pos += lens[i];
      }
    } else for (let i = 0; i < nPara; i++) paras.push(Object.assign({}, DP));
    void totalLen;
    // caixa de texto
    let box = null, x = tx, y = ty;
    try {
      const sh = E.Rendered.Shapes.Children[0];
      if (sh.ShapeType === 1 && sh.Cookie && sh.Cookie.Photoshop && sh.Cookie.Photoshop.BoxBounds) {
        const bb = sh.Cookie.Photoshop.BoxBounds;
        x = tx + bb[0] * xx + bb[1] * yx; y = ty + bb[0] * xy + bb[1] * yy;
        box = { x, y, w: bb[2] - bb[0], h: bb[3] - bb[1] };
      }
    } catch (err) { /* texto de ponto */ }
    const aa = { antiAliasNone: 'none', AnNo: 'none', antiAliasSharp: 'sharp', AnSh: 'sharp', antiAliasCrisp: 'crisp', AnCr: 'crisp', antiAliasStrong: 'strong', AnSt: 'strong', antiAliasSmooth: 'smooth', AnSm: 'smooth' }[en(td.AntA)] || 'smooth';
    const orient = en(td.Ornt) === 'Vrtc' ? 'v' : 'h';
    void doc;
    return { text, runs, paras, x, y, box, orient, m: [xx, xy, yx, yy], warp, aa, onPath: null, auto: false };
  }

  /* ==================================================================
     Demarcadores (vmsk/vsms)
     ================================================================== */
  function readPath(r, end, W, H) {
    const subs = []; let cur = null, rule = 'nonzero';
    while (r.pos + 26 <= end) {
      const sel = r.u16();
      if (sel === 0 || sel === 3) { r.u16(); const op = r.i16(); r.skip(20); cur = { closed: sel === 0, op: op >= 0 && op < 4 ? PATH_OPS[op] : 'add', pts: [] }; subs.push(cur); continue; }
      if (sel === 1 || sel === 2 || sel === 4 || sel === 5) {
        const q = []; for (let k = 0; k < 3; k++) { const vy = r.i32() / 16777216 * H, vx = r.i32() / 16777216 * W; q.push({ x: vx, y: vy }); }
        if (cur) cur.pts.push({ x: q[1].x, y: q[1].y, ix: q[0].x, iy: q[0].y, ox: q[2].x, oy: q[2].y, smooth: sel === 1 || sel === 4 });
        continue;
      }
      if (sel === 6 || sel === 8) { r.skip(24); continue; }
      r.skip(24);
    }
    // a primeira operação define o modo do primeiro componente: o restante combina-se a ele
    if (subs.length && subs[0].op === 'xor') subs[0].op = 'add';
    return { subs: subs.filter((s) => s.pts.length), rule };
  }
  function writePath(w, path, W, H) {
    const fx = (v, dim) => Math.round((v / dim) * 16777216) | 0;
    w.u16(6).zeros(24); // regra de preenchimento
    w.u16(8).u32(0).zeros(20); // regra inicial
    (path.subs || []).forEach((s, i) => {
      if (!s.pts.length) return;
      w.u16(s.closed ? 0 : 3).u16(s.pts.length).i16(Math.max(0, PATH_OPS.indexOf(i === 0 ? 'add' : s.op || 'add'))).u16(1).zeros(18);
      for (const p of s.pts) {
        w.u16(s.closed ? (p.smooth ? 1 : 2) : (p.smooth ? 4 : 5));
        for (const [x, y] of [[p.ix, p.iy], [p.x, p.y], [p.ox, p.oy]]) w.i32(fx(y, H)).i32(fx(x, W));
      }
    });
  }

  /* ==================================================================
     Decodificação de canais
     ================================================================== */
  async function readChannel(r, w, h, depth, psb, end) {
    const comp = r.u16();
    const bpc = depth === 16 ? 2 : depth === 32 ? 4 : depth === 1 ? 0 : 1;
    const rowBytes = depth === 1 ? Math.ceil(w / 8) : w * bpc;
    let raw;
    if (comp === 0) raw = r.bytes(rowBytes * h);
    else if (comp === 1) {
      const counts = []; let tot = 0; for (let y = 0; y < h; y++) { const c = psb ? r.u32() : r.u16(); counts.push(c); tot += c; }
      raw = new Uint8Array(rowBytes * h);
      for (let y = 0; y < h; y++) raw.set(F.unpackBits(r.bytes(counts[y]), rowBytes), y * rowBytes);
      void tot;
    } else {
      const data = r.bytes((end != null ? end : r.u.length) - r.pos);
      raw = await F.inflate(data);
      if (comp === 3) {
        if (bpc === 1) for (let y = 0; y < h; y++) { const o = y * rowBytes; for (let x = 1; x < rowBytes; x++) raw[o + x] = (raw[o + x] + raw[o + x - 1]) & 255; }
        else if (bpc === 2) for (let y = 0; y < h; y++) { const o = y * rowBytes; for (let x = 1; x < w; x++) { const p = ((raw[o + (x - 1) * 2] << 8) | raw[o + (x - 1) * 2 + 1]), c = (((raw[o + x * 2] << 8) | raw[o + x * 2 + 1]) + p) & 0xffff; raw[o + x * 2] = c >> 8; raw[o + x * 2 + 1] = c & 255; } }
        else if (bpc === 4) {
          for (let y = 0; y < h; y++) { const o = y * rowBytes; for (let x = 1; x < rowBytes; x++) raw[o + x] = (raw[o + x] + raw[o + x - 1]) & 255; const tmp = raw.slice(o, o + rowBytes); for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) raw[o + x * 4 + k] = tmp[k * w + x]; }
        }
      }
    }
    // para 8 bits
    if (bpc === 1) return raw;
    const out = new Uint8Array(w * h);
    if (depth === 1) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = (raw[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1 ? 0 : 255; }
    else if (bpc === 2) for (let i = 0; i < out.length; i++) out[i] = raw[i * 2];
    else { const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength); for (let i = 0; i < out.length; i++) { const f = dv.getFloat32(i * 4, false); out[i] = U.clamp(Math.round(Math.pow(U.clamp(f, 0, 1), 1 / 2.2) * 255), 0, 255); } }
    return out;
  }
  /** Converte canais (já em 8 bits) para RGBA, conforme o modo de cor. */
  function toRGBA(ch, w, h, mode, palette) {
    const img = new ImageData(Math.max(1, w), Math.max(1, h)), d = img.data, N = w * h;
    const A = ch[-1];
    for (let i = 0; i < N; i++) {
      let r = 0, g = 0, b = 0;
      if (mode === 3) { r = ch[0] ? ch[0][i] : 0; g = ch[1] ? ch[1][i] : 0; b = ch[2] ? ch[2][i] : 0; }
      else if (mode === 1 || mode === 8 || mode === 0) { r = g = b = ch[0] ? ch[0][i] : 0; }
      else if (mode === 4) { const c = ch[0] ? ch[0][i] : 255, m = ch[1] ? ch[1][i] : 255, y = ch[2] ? ch[2][i] : 255, k = ch[3] ? ch[3][i] : 255; r = (c * k) / 255; g = (m * k) / 255; b = (y * k) / 255; }
      else if (mode === 9) { const lab = labToRgb((ch[0] ? ch[0][i] : 0) * 100 / 255, (ch[1] ? ch[1][i] : 128) - 128, (ch[2] ? ch[2][i] : 128) - 128); r = lab[0]; g = lab[1]; b = lab[2]; }
      else if (mode === 2 && palette) { const v = ch[0] ? ch[0][i] : 0; r = palette[v]; g = palette[256 + v]; b = palette[512 + v]; }
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = A ? A[i] : 255;
    }
    return img;
  }
  const canvasFrom = (img) => { const c = U.createCanvas(img.width, img.height); c.getContext('2d').putImageData(img, 0, 0); return c; };

  /* ---------- padrões embutidos (Patt/Pat2/Pat3) ---------- */
  function readPatterns(r, end) {
    const out = [];
    while (r.pos + 8 < end) {
      let len = r.u32(); while (len % 4) len++;
      const pEnd = r.pos + len;
      try {
        if (r.u32() !== 1) { r.seek(pEnd); continue; }
        const mode = r.u32(); r.i16(); r.i16();
        const name = rUni(r), idl = r.u8(), id = r.ascii(idl);
        let pal = null;
        if (mode === 2) { pal = r.bytes(768); r.skip(4); }
        if (r.u32() !== 3) { r.seek(pEnd); continue; }
        r.u32();
        const top = r.u32(), left = r.u32(), bottom = r.u32(), right = r.u32(), nch = r.u32();
        const W = right - left, H = bottom - top;
        if (W <= 0 || H <= 0 || W * H > 16e6) { r.seek(pEnd); continue; }
        const img = new ImageData(W, H), d = img.data;
        for (let i = 3; i < d.length; i += 4) d[i] = 255;
        for (let i = 0, ch = 0; i < nch + 2; i++) {
          if (!r.u32()) continue;
          const clen = r.u32(), cst = r.pos;
          const depth = r.u32(), ct = r.u32(), cl = r.u32(), cb = r.u32(), cr = r.u32(); r.u16(); const comp = r.u8();
          const w = cr - cl, h = cb - ct, ox = cl - left, oy = ct - top, cd = r.bytes(Math.max(0, clen - 23));
          if (depth === 8 && w > 0 && h > 0) {
            let plane = cd;
            if (comp === 1) { const rr = new Reader(cd), counts = []; for (let y = 0; y < h; y++) counts.push(rr.u16()); plane = new Uint8Array(w * h); for (let y = 0; y < h; y++) plane.set(F.unpackBits(rr.bytes(counts[y]), w), y * w); }
            const put = (k) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[((oy + y) * W + ox + x) * 4 + k] = plane[y * w + x]; };
            if (mode === 3 && ch < 3) put(ch);
            else if ((mode === 1 || mode === 8) && ch < 1) { put(0); put(1); put(2); }
            else if (mode === 2 && ch < 1 && pal) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = plane[y * w + x], o = ((oy + y) * W + ox + x) * 4; d[o] = pal[v * 3]; d[o + 1] = pal[v * 3 + 1]; d[o + 2] = pal[v * 3 + 2]; } }
          }
          r.seek(cst + clen);
          ch++;
        }
        out.push({ id, name, canvas: canvasFrom(img) });
      } catch (err) { console.warn('padrão', err); }
      r.seek(pEnd);
    }
    return out;
  }

  /* ==================================================================
     LEITURA
     ================================================================== */
  async function readPSD(buf, name) {
    const r = new Reader(buf);
    if (r.ascii(4) !== '8BPS') throw new Error('não é um arquivo PSD.');
    const version = r.u16(), psb = version === 2; r.skip(6);
    const nch = r.u16(), H = r.u32(), W = r.u32(), depth = r.u16(), mode = r.u16();
    if (W * H > 200e6) throw new Error('imagem grande demais (' + W + ' × ' + H + ').');
    const cmLen = r.u32(), palette = cmLen ? r.bytes(cmLen) : null;
    // recursos de imagem
    const resEnd = r.u32() + r.pos;
    const info = { dpi: 72, guides: { h: [], v: [] }, tIndex: -1, target: -1, alphas: [], alphaNames: [] };
    while (r.pos + 12 <= resEnd) {
      if (r.ascii(4) !== '8BIM') break;
      const id = r.u16(), nl = r.u8(); r.skip(nl); if ((nl + 1) % 2) r.skip(1);
      const sz = r.u32(), st = r.pos;
      try {
        if (id === 0x03ed) { info.dpi = Math.round(r.u32() / 65536) || 72; }
        else if (id === 0x0408) { r.u32(); r.skip(8); const n = r.u32(); for (let i = 0; i < n; i++) { const loc = r.i32() / 32, dir = r.u8(); (dir === 0 ? info.guides.v : info.guides.h).push(loc); } }
        else if (id === 0x0417) info.tIndex = r.u16();
        else if (id === 0x0400) info.target = r.u16();
        else if (id === 0x0415) { const e = st + sz; while (r.pos + 4 <= e) info.alphaNames.push(rUni(r)); }
        else if (id === 0x03ee && !info.alphaNames.length) { const e = st + sz; while (r.pos < e) { const n = r.u8(); if (!n) break; info.alphaNames.push(r.ascii(n)); } }
      } catch (err) { /* recurso ignorado */ }
      r.seek(st + sz + (sz % 2));
    }
    r.seek(resEnd);
    // camadas e máscaras
    const lmLen = psb ? r.u64() : r.u32(), lmEnd = r.pos + lmLen;
    let records = [], mergedAlpha = false;
    const readLayerInfo = async (lr, endPos) => {
      let count = lr.i16(); if (count < 0) { count = -count; mergedAlpha = true; }
      const recs = [];
      for (let i = 0; i < count; i++) {
        const rec = { top: lr.i32(), left: lr.i32(), bottom: lr.i32(), right: lr.i32(), channels: [], extra: {} };
        const n = lr.u16();
        for (let k = 0; k < n; k++) rec.channels.push({ id: lr.i16(), len: psb ? lr.u64() : lr.u32() });
        lr.ascii(4); rec.blend = BK[lr.ascii(4)] || 'normal';
        rec.opacity = lr.u8(); rec.clip = lr.u8() === 1; rec.flags = lr.u8(); lr.u8();
        const exLen = lr.u32(), exEnd = lr.pos + exLen;
        const mLen = lr.u32(), mEnd = lr.pos + mLen;
        if (mLen >= 18) { rec.mask = { top: lr.i32(), left: lr.i32(), bottom: lr.i32(), right: lr.i32(), def: lr.u8(), flags: lr.u8() }; }
        lr.seek(mEnd);
        const bLen = lr.u32(), bEnd = lr.pos + bLen;
        if (bLen >= 8) { const sr = [lr.u8(), lr.u8(), lr.u8(), lr.u8()], dr = [lr.u8(), lr.u8(), lr.u8(), lr.u8()]; const id = (a) => a[0] === 0 && a[1] === 0 && a[2] === 255 && a[3] === 255; if (!id(sr) || !id(dr)) rec.blendIf = { self: id(sr) ? null : sr, under: id(dr) ? null : dr }; }
        lr.seek(bEnd);
        const nl = lr.u8(); rec.name = lr.ascii(nl); lr.skip((4 - ((nl + 1) % 4)) % 4);
        while (lr.pos + 12 <= exEnd) {
          const sig = lr.ascii(4); if (sig !== '8BIM' && sig !== '8B64') break;
          const key = lr.ascii(4);
          const big = psb && ['LMsk', 'Lr16', 'Lr32', 'Layr', 'Mt16', 'Mt32', 'Mtrn', 'Alph', 'FMsk', 'lnk2', 'FEid', 'FXid', 'PxSD'].includes(key);
          const len = big ? lr.u64() : lr.u32(), st = lr.pos;
          rec.extra[key] = { pos: st, len };
          lr.seek(st + len);
        }
        lr.seek(exEnd);
        recs.push(rec);
      }
      // dados dos canais
      for (const rec of recs) {
        const w = rec.right - rec.left, h = rec.bottom - rec.top;
        rec.data = {};
        for (const c of rec.channels) {
          const st = lr.pos, end = st + c.len;
          try {
            let cw = w, chh = h;
            if (c.id === -2 && rec.mask) { cw = rec.mask.right - rec.mask.left; chh = rec.mask.bottom - rec.mask.top; }
            if (c.id < -2) { lr.seek(end); continue; }
            if (c.len >= 2 && cw > 0 && chh > 0) rec.data[c.id] = await readChannel(lr, cw, chh, depth, psb, end);
          } catch (err) { console.warn('canal', c.id, err); }
          lr.seek(end);
        }
      }
      void endPos;
      return recs;
    };
    if (lmLen > 0) {
      const liLen = psb ? r.u64() : r.u32(), liEnd = r.pos + liLen;
      if (liLen > 0) records = await readLayerInfo(r, liEnd);
      r.seek(liEnd);
      if (r.pos < lmEnd) { const gl = r.u32(); r.skip(gl); }
      // informações adicionais globais (Lr16/Lr32 em arquivos de 16/32 bits)
      while (r.pos + 12 <= lmEnd) {
        const sig = r.ascii(4); if (sig !== '8BIM' && sig !== '8B64') break;
        const key = r.ascii(4), big = psb && ['LMsk', 'Lr16', 'Lr32', 'Layr', 'Mt16', 'Mt32', 'Mtrn', 'Alph', 'FMsk', 'lnk2', 'FEid', 'FXid', 'PxSD'].includes(key);
        const len = big ? r.u64() : r.u32(), st = r.pos;
        if ((key === 'Lr16' || key === 'Lr32' || key === 'Layr') && !records.length && len > 0) records = await readLayerInfo(r, st + len);
        if (key === 'Patt' || key === 'Pat2' || key === 'Pat3') { try { info.patterns = (info.patterns || []).concat(readPatterns(r, st + len)); } catch (err) { console.warn(err); } }
        r.seek(st + len);
        if (r.pos > lmEnd) break;
      }
    }
    r.seek(lmEnd);
    // imagem composta
    let merged = null;
    try {
      const comp = r.u16(), bpc = depth === 16 ? 2 : depth === 32 ? 4 : 1;
      const rowBytes = depth === 1 ? Math.ceil(W / 8) : W * bpc;
      const ch = {};
      const order = [];
      for (let c = 0; c < nch; c++) order.push(c);
      if (comp === 1) {
        const counts = []; for (let i = 0; i < nch * H; i++) counts.push(psb ? r.u32() : r.u16());
        for (const c of order) { const raw = new Uint8Array(rowBytes * H); for (let y = 0; y < H; y++) raw.set(F.unpackBits(r.bytes(counts[c * H + y]), rowBytes), y * rowBytes); ch[c] = raw; }
      } else if (comp === 0) { for (const c of order) ch[c] = r.bytes(rowBytes * H); }
      else { const raw = await F.inflate(r.bytes(r.left)); for (const c of order) ch[c] = raw.subarray(c * rowBytes * H, (c + 1) * rowBytes * H); }
      const to8 = (raw) => { if (depth === 8) return raw; const out = new Uint8Array(W * H); if (depth === 1) { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] = (raw[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1 ? 0 : 255; } else if (depth === 16) for (let i = 0; i < out.length; i++) out[i] = raw[i * 2]; else { const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength); for (let i = 0; i < out.length; i++) out[i] = U.clamp(Math.round(Math.pow(U.clamp(dv.getFloat32(i * 4), 0, 1), 1 / 2.2) * 255), 0, 255); } return out; };
      const cc = {}; Object.keys(ch).forEach((k) => { cc[k] = to8(ch[k]); });
      const colorCh = { 3: 3, 1: 1, 8: 1, 0: 1, 4: 4, 9: 3, 2: 1 }[mode] || 3;
      if (nch > colorCh && mergedAlpha) cc[-1] = cc[colorCh];
      for (let c = colorCh + (mergedAlpha ? 1 : 0); c < nch; c++) if (cc[c]) info.alphas.push(cc[c]);
      const img = toRGBA(cc, W, H, mode, palette);
      if (mode === 2 && info.tIndex >= 0) { const d = img.data, idx = cc[0]; for (let i = 0; i < W * H; i++) if (idx[i] === info.tIndex) d[i * 4 + 3] = 0; }
      merged = canvasFrom(img);
    } catch (err) { console.warn('imagem composta', err); }
    return buildDoc({ name, W, H, mode, depth, palette, info, records, merged, buf, psb });
  }

  async function buildDoc(o) {
    const { W, H, mode, palette, info, records, merged } = o;
    const Layers = IMG.Layers;
    const doc = new IMG.Doc({ name: o.name, width: W, height: H, dpi: info.dpi });
    doc.dpi = info.dpi;
    doc.guides = info.guides;
    doc.mode = { 0: 'bitmap', 1: 'gray', 2: 'indexed', 3: 'rgb', 4: 'cmyk', 7: 'rgb', 8: 'gray', 9: 'lab' }[mode] || 'rgb';
    doc.bits = o.depth === 1 ? 8 : o.depth;
    const r = new Reader(o.buf);
    const stack = [[]];
    const pmap = {};
    (info.patterns || []).forEach((p) => {
      const P = IMG.Patterns, ex = P.all().find((q) => q.name === p.name && q.canvas && q.canvas.width === p.canvas.width && q.canvas.height === p.canvas.height);
      pmap[p.id] = ex ? ex.id : P.add(p.canvas, p.name || 'Padrão do PSD').id;
    });
    const warnings = new Set();
    let colorChannels = { 3: 3, 1: 1, 8: 1, 4: 4, 9: 3, 2: 1, 0: 1 }[mode] || 3;
    void colorChannels;
    for (let li = 0; li < records.length; li++) {
      const rec = records[li], ex = rec.extra;
      const at = (k) => (ex[k] ? r.seek(ex[k].pos) : null);
      let nm = rec.name;
      if (at('luni')) { try { nm = rUni(r); } catch (err) { /* nome ASCII */ } }
      let sect = null;
      const sk = ex.lsct ? 'lsct' : ex.lsdk ? 'lsdk' : null;
      if (sk) { at(sk); sect = { type: r.u32(), blend: null }; if (ex[sk].len >= 12) { r.ascii(4); sect.blend = BK[r.ascii(4)] || null; } }
      if (sect && sect.type === 3) { stack.push([]); continue; }
      let L;
      if (sect && (sect.type === 1 || sect.type === 2)) {
        const kids = stack.length > 1 ? stack.pop() : [];
        L = new IMG.Layer('group', { name: nm || 'Grupo' });
        kids.forEach((c) => { c.parent = L; L.children.push(c); });
        L.expanded = sect.type === 1;
        L.blend = sect.blend === 'pass' || rec.blend === 'pass' ? 'pass' : rec.blend;
      } else {
        const w = rec.right - rec.left, h = rec.bottom - rec.top;
        const img = toRGBA(rec.data, w, h, mode, palette);
        const c = w > 0 && h > 0 ? canvasFrom(img) : U.createCanvas(1, 1);
        L = new IMG.Layer('raster', { name: nm || 'Camada', canvas: c, x: rec.left, y: rec.top });
        if (!(w > 0 && h > 0)) L._blank = true;
        L.blend = rec.blend === 'pass' ? 'normal' : rec.blend;
      }
      L.opacity = rec.opacity / 255;
      if (rec.blendIf) L.adv = Object.assign({}, L.adv || {}, { blendIf: rec.blendIf });
      if (L.type === 'group' && (at('artb') || at('artd') || at('abdd'))) {
        try {
          r.u32(); const d = rDesc(r), rc = d.artboardRect;
          if (rc) { const bgT = d.artboardBackgroundType; L.artboard = { x: Math.round(val(rc.Left, 0)), y: Math.round(val(rc['Top '], 0)), w: Math.round(val(rc.Rght, 0) - val(rc.Left, 0)), h: Math.round(val(rc.Btom, 0) - val(rc['Top '], 0)), bg: bgT === 2 ? '#000000' : bgT === 3 ? 'transparent' : bgT === 4 ? colorOf(d['Clr ']) : '#ffffff' }; L.blend = 'pass'; }
        } catch (err) { /* sem prancheta */ }
      }
      L.visible = !(rec.flags & 2);
      L.clip = rec.clip;
      if (at('iOpa')) L.fill = r.u8() / 255;
      if (at('lclr')) { const ci = r.u16(); if (LCOLORS[ci]) L.color = LCOLORS[ci]; }
      // máscara de camada
      if (rec.mask && rec.data[-2]) {
        const m = rec.mask, mw = m.right - m.left, mh = m.bottom - m.top;
        if (mw > 0 && mh > 0) {
          const img = new ImageData(mw, mh), d = img.data, src = rec.data[-2];
          for (let i = 0; i < mw * mh; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = src[i]; }
          L.mask = Layers.makeMask(canvasFrom(img), m.left, m.top, m.def ? 255 : 0, { enabled: !(m.flags & 2), linked: true });
        }
      } else if (rec.mask && rec.mask.right - rec.mask.left === 0) {
        L.mask = null;
      }
      // estilos de camada
      for (const k of ['lfx2', 'lmfx']) {
        if (L.fx || !at(k)) continue;
        try { r.u32(); r.u32(); const d = rDesc(r); if (d.masterFXSwitch !== false) L.fx = fxFromDesc(d, pmap); } catch (err) { warnings.add('alguns estilos de camada'); }
      }
      // demarcador (máscara vetorial ou forma)
      let vpath = null, vflags = 0;
      const vk = ex.vmsk ? 'vmsk' : ex.vsms ? 'vsms' : null;
      if (vk) { at(vk); r.u32(); vflags = r.u32(); try { vpath = readPath(r, ex[vk].pos + ex[vk].len, W, H); } catch (err) { vpath = null; } }
      // camadas de preenchimento / ajuste
      let fillDef = null;
      try {
        if (at('SoCo')) { r.u32(); const d = rDesc(r); fillDef = { type: 'solid', color: colorOf(d['Clr ']) }; }
        else if (at('GdFl')) { r.u32(); const d = rDesc(r); fillDef = { type: 'gradient', gradient: gradOf(d.Grad), angle: val(d.Angl, 90), style: GRAD_STYLE[en(d.Type)] || 'linear', reverse: !!d.Rvrs, scale: val(d['Scl '], 100), dither: !!d.Dthr }; }
        else if (at('PtFl')) { r.u32(); const d = rDesc(r); fillDef = { type: 'pattern', pattern: (d.Ptrn && pmap[d.Ptrn.Idnt]) || 'p0', scale: val(d['Scl '], 100) }; }
      } catch (err) { fillDef = null; }
      if (fillDef && vpath && vpath.subs.length && !(vflags & 1)) {
        // camada de forma
        let stroke = { on: false, fill: { type: 'solid', color: '#000000' }, width: 3, align: 'inside', cap: 'butt', join: 'miter', dash: null };
        if (at('vstk')) { try { r.u32(); const d = rDesc(r); if (d.strokeEnabled !== false && d.strokeStyleContent) { stroke = { on: true, fill: { type: 'solid', color: colorOf(d.strokeStyleContent['Clr ']) }, width: val(d.strokeStyleLineWidth, 1), align: { strokeStyleAlignInside: 'inside', strokeStyleAlignCenter: 'center', strokeStyleAlignOutside: 'outside' }[en(d.strokeStyleLineAlignment)] || 'center', cap: { strokeStyleButtCap: 'butt', strokeStyleRoundCap: 'round', strokeStyleSquareCap: 'square' }[en(d.strokeStyleLineCapType)] || 'butt', join: { strokeStyleMiterJoin: 'miter', strokeStyleRoundJoin: 'round', strokeStyleBevelJoin: 'bevel' }[en(d.strokeStyleLineJoinType)] || 'miter', dash: null }; if (d.fillEnabled === false) fillDef = null; } } catch (err) { /* sem traçado */ } }
        L.type = 'shape';
        L.shape = { path: vpath, fill: fillDef && fillDef.type === 'solid' ? fillDef : fillDef ? { type: 'solid', color: '#808080' } : null, stroke };
        if (fillDef && fillDef.type === 'gradient') L.shape.fill = { type: 'gradient', gradient: fillDef.gradient, angle: fillDef.angle, style: fillDef.style };
        vpath = null;
      } else if (fillDef) {
        L.type = 'fill'; L.fillDef = fillDef;
      } else {
        const adj = readAdjust(r, ex, at);
        if (adj) { L.type = 'adjust'; L.adj = adj; L.canvas = null; }
      }
      if (vpath && vpath.subs.length) L.vmask = { path: vpath, invert: !!(vflags & 1), enabled: !(vflags & 2), density: 100, feather: 0, _ver: 1 };
      // texto
      if (at('TySh') && L.type === 'raster') {
        try { const t = textFromTySh(r, ex.TySh.len, doc); if (t && t.text) { L.type = 'text'; L.text = t; } } catch (err) { console.warn('texto', err); warnings.add('textos (mantidos como pixels)'); }
      }
      if (ex.SoLd || ex.PlLd || ex.SoLE) L._psdSmart = true;
      stack[stack.length - 1].push(L);
    }
    while (stack.length > 1) { const kids = stack.pop(); stack[stack.length - 1].push(...kids); }
    let top = stack[0];
    // fundo
    if (top.length) {
      const B = top[0], rec0 = records.find((q) => !q.extra.lsct && !q.extra.lsdk);
      if (B.type === 'raster' && rec0 && !rec0.channels.some((c) => c.id === -1) && BG_NAMES.includes(String(B.name).toLowerCase())) { B.isBg = true; B.lockPos = true; B.lockAlpha = true; }
      else if (B.type === 'raster' && BG_NAMES.includes(String(B.name).toLowerCase()) && B.x === 0 && B.y === 0 && B.canvas.width === W && B.canvas.height === H && IMG.Files.isOpaque(B.canvas)) { B.isBg = true; B.lockPos = true; B.lockAlpha = true; }
    }
    if (!top.length) {
      const c = merged || U.createCanvas(W, H);
      const L = new IMG.Layer('raster', { name: 'Fundo', canvas: c, x: 0, y: 0 });
      if (IMG.Files.isOpaque(c)) { L.isBg = true; L.lockPos = true; L.lockAlpha = true; }
      top = [L];
    }
    top.forEach((L) => { L.parent = null; });
    doc.layers = top;
    (info.alphas || []).forEach((plane, i) => {
      const img = new ImageData(W, H), d = img.data;
      for (let k = 0; k < W * H; k++) { d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = 255; d[k * 4 + 3] = plane[k]; }
      IMG.Channels.add(doc, info.alphaNames[i] || 'Alfa ' + (i + 1), canvasFrom(img));
    });
    // renderiza o que precisa de re-renderização (preenchimentos e formas sem pixels)
    Layers.walk(doc.layers, (L) => {
      if (L.type === 'fill') { try { Layers.renderFill(L, doc); } catch (err) { console.warn(err); } }
      if (L.type === 'shape' && (!L.canvas || L._blank || L.canvas.width <= 1)) { try { IMG.Shapes.render(L); } catch (err) { console.warn(err); } }
      if (L.type === 'text' && (!L.canvas || L._blank || L.canvas.width <= 1)) { try { IMG.Text.render(L); } catch (err) { console.warn(err); } }
    });
    const all = Layers.all(doc);
    const tgt = info.target >= 0 ? null : null; void tgt;
    doc.activeId = all.length ? all[all.length - 1].id : null;
    doc.selected = new Set(doc.activeId ? [doc.activeId] : []);
    doc.sourceFormat = 'psd';
    doc._psdWarnings = [...warnings];
    return doc;
  }

  /** Camadas de ajuste reconhecidas. */
  function readAdjust(r, ex, at) {
    const A = IMG.Adjust; if (!A) return null;
    const mk = (kind, p) => Object.assign(A.create(kind), p || {});
    try {
      if (at('nvrt')) return mk('invert');
      if (at('post')) return mk('posterize', { levels: r.u16() });
      if (at('thrs')) return mk('threshold', { level: r.u16() });
      if (at('CgEd')) { r.u32(); const d = rDesc(r); return mk('brightnessContrast', { brightness: val(d.Brgh, 0), contrast: val(d.Cntr, 0), legacy: !!d.useLegacy }); }
      if (at('brit')) return mk('brightnessContrast', { brightness: r.i16(), contrast: r.i16(), legacy: true });
      if (at('expA')) { r.u16(); return mk('exposure', { exposure: U.round(r.f32(), 2), offset: U.round(r.f32(), 4), gamma: U.round(r.f32(), 2) }); }
      if (at('vibA')) { r.u32(); const d = rDesc(r); return mk('vibrance', { vibrance: val(d.vibrance, 0), saturation: val(d.Strt, 0) }); }
      if (at('levl')) {
        r.u16(); const lv = IMG.Widgets.levelsDefaults();
        ['rgb', 'r', 'g', 'b'].forEach((k) => { const ib = r.u16(), iw = r.u16(), ob = r.u16(), ow = r.u16(), g = r.u16() / 100; lv[k] = { ib, g: g || 1, iw, ob, ow }; });
        return mk('levels', { lv });
      }
      if (at('curv')) {
        r.u8(); const ver = r.u16(), bits = r.u32(), cv = IMG.Widgets.curvesDefaults(), keys = ['rgb', 'r', 'g', 'b'];
        void ver;
        for (let i = 0; i < 32; i++) {
          if (!(bits & (1 << i))) continue;
          const n = r.u16(), pts = []; for (let k = 0; k < n; k++) { const out = r.u16(), inp = r.u16(); pts.push([inp, out]); }
          if (keys[i]) cv[keys[i]] = pts;
        }
        return mk('curves', { cv });
      }
      if (at('hue2')) {
        r.u16(); const colorize = !!r.u8(); r.u8();
        const cz = { h: r.i16(), s: r.i16(), l: r.i16() }, master = { h: r.i16(), s: r.i16(), l: r.i16() };
        const p = { colorize, cz: colorize ? { h: (cz.h + 360) % 360, s: cz.s, l: cz.l } : { h: 0, s: 25, l: 0 }, master };
        ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas'].forEach((k) => { r.skip(8); p[k] = { h: r.i16(), s: r.i16(), l: r.i16() }; });
        return mk('hueSaturation', p);
      }
      if (at('blnc')) {
        const rd = () => [r.i16(), r.i16(), r.i16()];
        return mk('colorBalance', { shadows: rd(), midtones: rd(), highlights: rd(), preserve: !!r.u8() });
      }
      if (at('blwh')) return mk('blackWhite');
      if (at('phfl')) return mk('photoFilter');
      if (at('mixr')) return mk('channelMixer');
      if (at('selc')) return mk('selectiveColor');
      if (at('grdm')) {
        r.u16(); const rev = !!r.u8(), dith = !!r.u8();
        if (r.u[r.pos]) r.skip(4);
        rUni(r);
        const n = r.u16(), colors = [];
        for (let i = 0; i < n; i++) { const loc = r.u32(); r.u32(); const cs = r.u16(), c = [r.u16(), r.u16(), r.u16(), r.u16()]; r.skip(2); const v = Math.round((c[0] / 10000) * 255); colors.push({ t: U.clamp(loc / 4096, 0, 1), c: cs === 0 ? U.rgbToHex(c[0] >> 8, c[1] >> 8, c[2] >> 8) : cs === 8 ? U.rgbToHex(255 - v, 255 - v, 255 - v) : '#000000' }); }
        const na = r.u16(), alphas = [];
        for (let i = 0; i < na; i++) { const loc = r.u32(); r.u32(); alphas.push({ t: U.clamp(loc / 4096, 0, 1), a: U.clamp(r.u16() / 255, 0, 1) }); }
        return mk('gradientMap', { gradient: { name: 'Mapa', colors: colors.length ? colors : [{ t: 0, c: '#000000' }, { t: 1, c: '#ffffff' }], alphas: alphas.length ? alphas : [{ t: 0, a: 1 }, { t: 1, a: 1 }] }, reverse: rev, dither: dith });
      }
      if (at('clrL')) return mk('colorLookup');
    } catch (err) { console.warn('ajuste', err); }
    return null;
  }

  /* ==================================================================
     GRAVAÇÃO
     ================================================================== */
  function packBits(src) {
    const out = []; let i = 0; const n = src.length;
    while (i < n) {
      let run = 1;
      while (i + run < n && run < 128 && src[i + run] === src[i]) run++;
      if (run > 1) { out.push(257 - run, src[i]); i += run; continue; }
      let lit = 1;
      while (i + lit < n && lit < 128 && !(i + lit + 1 < n && src[i + lit] === src[i + lit + 1])) lit++;
      out.push(lit - 1); for (let k = 0; k < lit; k++) out.push(src[i + k]);
      i += lit;
    }
    return out;
  }
  /** Canal comprimido (RLE) → Uint8Array com o código de compressão no início. */
  function encodeChannel(plane, w, h) {
    if (!w || !h) { const e = new Uint8Array(2); return e; }
    const rows = []; let tot = 0;
    for (let y = 0; y < h; y++) { const p = packBits(plane.subarray(y * w, (y + 1) * w)); rows.push(p); tot += p.length; }
    const out = new Uint8Array(2 + h * 2 + tot), dv = new DataView(out.buffer);
    dv.setUint16(0, 1);
    for (let y = 0; y < h; y++) dv.setUint16(2 + y * 2, rows[y].length);
    let o = 2 + h * 2; for (const p of rows) { out.set(p, o); o += p.length; }
    return out;
  }
  function planes(canvas, x, y, w, h) {
    const d = canvas.getContext('2d').getImageData(x, y, w, h).data, N = w * h, P = [new Uint8Array(N), new Uint8Array(N), new Uint8Array(N), new Uint8Array(N)];
    for (let i = 0; i < N; i++) { P[0][i] = d[i * 4]; P[1][i] = d[i * 4 + 1]; P[2][i] = d[i * 4 + 2]; P[3][i] = d[i * 4 + 3]; }
    return P;
  }

  /* descritores (gravação) */
  const D = {
    doub: (v) => ({ t: 'doub', v }), unt: (u, v) => ({ t: 'UntF', u, v }), long: (v) => ({ t: 'long', v }), bool: (v) => ({ t: 'bool', v }),
    enm: (type, v) => ({ t: 'enum', type, v }), text: (v) => ({ t: 'TEXT', v }), obj: (cls, items) => ({ t: 'Objc', cls, items }), list: (v) => ({ t: 'VlLs', v }), raw: (v) => ({ t: 'tdta', v })
  };
  function wUni(w, s) { s = String(s || ''); w.u32(s.length + 1); for (let i = 0; i < s.length; i++) w.u16(s.charCodeAt(i)); w.u16(0); }
  function wKey(w, k) { if (k.length === 4 && !/^[a-z][a-zA-Z]{4,}/.test(k)) { w.u32(0); w.ascii(k); } else { w.u32(k.length); w.ascii(k); } }
  function wDesc(w, cls, items) { wUni(w, ''); wKey(w, cls); const ks = Object.keys(items).filter((k) => items[k] != null); w.u32(ks.length); for (const k of ks) { wKey(w, k); wItem(w, items[k]); } }
  function wItem(w, it) {
    w.ascii(it.t);
    switch (it.t) {
      case 'doub': w.f64(it.v); break;
      case 'UntF': w.ascii(it.u); w.f64(it.v); break;
      case 'long': w.i32(it.v); break;
      case 'bool': w.u8(it.v ? 1 : 0); break;
      case 'enum': wKey(w, it.type); wKey(w, it.v); break;
      case 'TEXT': wUni(w, it.v); break;
      case 'Objc': wDesc(w, it.cls, it.items); break;
      case 'VlLs': w.u32(it.v.length); it.v.forEach((x) => wItem(w, x)); break;
      case 'tdta': w.u32(it.v.length); w.bytes(it.v); break;
      default: break;
    }
  }
  const rgbObj = (hex) => { const c = U.hexToRgb(hex || '#000000'); return D.obj('RGBC', { 'Rd  ': D.doub(c.r), 'Grn ': D.doub(c.g), 'Bl  ': D.doub(c.b) }); };
  const pct = (v) => D.unt('#Prc', v), px = (v) => D.unt('#Pxl', v), ang = (v) => D.unt('#Ang', v);
  const bmE = (m) => D.enm('BlnM', BM_INV[m] || 'Nrml');
  const contour = () => D.obj('ShpC', { 'Nm  ': D.text('Linear'), 'Crv ': D.list([D.obj('CrPt', { Hrzn: D.doub(0), Vrtc: D.doub(0) }), D.obj('CrPt', { Hrzn: D.doub(255), Vrtc: D.doub(255) })]) });
  function gradDesc(g) {
    g = g || IMG.Gradients.def();
    const col = (c) => (c === 'fg' ? IMG.app.fg : c === 'bg' ? IMG.app.bg : c);
    return D.obj('Grdn', {
      'Nm  ': D.text(g.name || 'Personalizado'), GrdF: D.enm('GrdF', 'CstS'), Intr: D.doub(4096),
      Clrs: D.list((g.colors || []).map((s) => D.obj('Clrt', { 'Clr ': rgbObj(col(s.c)), Type: D.enm('Clry', 'UsrS'), Lctn: D.long(Math.round(s.t * 4096)), Mdpn: D.long(50) }))),
      Trns: D.list((g.alphas || [{ t: 0, a: 1 }, { t: 1, a: 1 }]).map((s) => D.obj('TrnS', { Opct: pct(s.a * 100), Lctn: D.long(Math.round(s.t * 4096)), Mdpn: D.long(50) })))
    });
  }
  function fxDesc(fx, doc) {
    const items = { 'Scl ': pct(100), masterFXSwitch: D.bool(true) };
    const e = (k) => fx[k] && fx[k];
    let x;
    if ((x = e('dropShadow'))) items.DrSh = D.obj('DrSh', { enab: D.bool(x.enabled !== false), present: D.bool(true), showInDialog: D.bool(true), 'Md  ': bmE(x.blend), 'Clr ': rgbObj(x.color), Opct: pct(x.opacity), uglg: D.bool(!!x.useGlobal), lagl: ang(x.useGlobal ? doc.globalAngle || 120 : x.angle), Dstn: px(x.distance), Ckmt: px(x.spread), blur: px(x.size), Nose: pct(0), AntA: D.bool(false), TrnS: contour(), layerConceals: D.bool(x.knockout !== false) });
    if ((x = e('innerShadow'))) items.IrSh = D.obj('IrSh', { enab: D.bool(x.enabled !== false), present: D.bool(true), showInDialog: D.bool(true), 'Md  ': bmE(x.blend), 'Clr ': rgbObj(x.color), Opct: pct(x.opacity), uglg: D.bool(!!x.useGlobal), lagl: ang(x.useGlobal ? doc.globalAngle || 120 : x.angle), Dstn: px(x.distance), Ckmt: px(x.choke), blur: px(x.size), Nose: pct(0), AntA: D.bool(false), TrnS: contour() });
    if ((x = e('outerGlow'))) items.OrGl = D.obj('OrGl', Object.assign({ enab: D.bool(x.enabled !== false), present: D.bool(true), showInDialog: D.bool(true), 'Md  ': bmE(x.blend) }, x.fillType === 'gradient' ? { Grad: gradDesc(x.gradient) } : { 'Clr ': rgbObj(x.color) }, { Opct: pct(x.opacity), GlwT: D.enm('BETE', x.technique === 'precise' ? 'PrBL' : 'SfBL'), Ckmt: px(x.spread), blur: px(x.size), Nose: pct(0), ShdN: pct(0), AntA: D.bool(false), TrnS: contour(), Inpr: pct(x.range == null ? 50 : x.range) }));
    if ((x = e('innerGlow'))) items.IrGl = D.obj('IrGl', Object.assign({ enab: D.bool(x.enabled !== false), present: D.bool(true), showInDialog: D.bool(true), 'Md  ': bmE(x.blend) }, x.fillType === 'gradient' ? { Grad: gradDesc(x.gradient) } : { 'Clr ': rgbObj(x.color) }, { Opct: pct(x.opacity), GlwT: D.enm('BETE', x.technique === 'precise' ? 'PrBL' : 'SfBL'), Ckmt: px(x.choke), blur: px(x.size), ShdN: pct(0), Nose: pct(0), AntA: D.bool(false), glwS: D.enm('IGSr', x.source === 'center' ? 'SrcC' : 'SrcE'), TrnS: contour(), Inpr: pct(x.range == null ? 50 : x.range) }));
    if ((x = e('bevel'))) items.ebbl = D.obj('ebbl', { enab: D.bool(x.enabled !== false), present: D.bool(true), showInDialog: D.bool(true), hglM: bmE(x.hlBlend), hglC: rgbObj(x.hlColor), hglO: pct(x.hlOpacity), sdwM: bmE(x.shBlend), sdwC: rgbObj(x.shColor), sdwO: pct(x.shOpacity), bvlT: D.enm('bvlT', { smooth: 'SfBL', chiselHard: 'PrBL', chiselSoft: 'Slmt' }[x.technique] || 'SfBL'), bvlS: D.enm('BESl', { outer: 'OtrB', inner: 'InrB', emboss: 'Embs', pillow: 'PlEb', stroke: 'strokeEmboss' }[x.style] || 'InrB'), uglg: D.bool(!!x.useGlobal), lagl: ang(x.useGlobal ? doc.globalAngle || 120 : x.angle), Lald: ang(x.useGlobal ? doc.globalAltitude || 30 : x.altitude), srgR: pct(x.depth), blur: px(x.size), bvlD: D.enm('BESs', x.direction === 'down' ? 'Out ' : 'In  '), TrnS: contour(), antialiasGloss: D.bool(false), Sftn: px(x.soften), useShape: D.bool(false), useTexture: D.bool(false) });
    if ((x = e('satin'))) items.ChFX = D.obj('ChFX', { enab: D.bool(x.enabled !== false), present: D.bool(true), showInDialog: D.bool(true), 'Md  ': bmE(x.blend), 'Clr ': rgbObj(x.color), AntA: D.bool(true), Invr: D.bool(!!x.invert), Opct: pct(x.opacity), lagl: ang(x.angle), Dstn: px(x.distance), blur: px(x.size), MpgS: contour() });
    if ((x = e('colorOverlay'))) items.SoFi = D.obj('SoFi', { enab: D.bool(x.enabled !== false), present: D.bool(true), showInDialog: D.bool(true), 'Md  ': bmE(x.blend), 'Clr ': rgbObj(x.color), Opct: pct(x.opacity) });
    if ((x = e('gradientOverlay'))) items.GrFl = D.obj('GrFl', { enab: D.bool(x.enabled !== false), present: D.bool(true), showInDialog: D.bool(true), 'Md  ': bmE(x.blend), Opct: pct(x.opacity), Grad: gradDesc(x.gradient), Angl: ang(x.angle), Type: D.enm('GrdT', GRAD_STYLE_INV[x.style] || 'Lnr '), Rvrs: D.bool(!!x.reverse), Dthr: D.bool(false), Algn: D.bool(x.align !== false), 'Scl ': pct(x.scale), Ofst: D.obj('Pnt ', { Hrzn: pct(x.offX || 0), Vrtc: pct(x.offY || 0) }) });
    if ((x = e('stroke'))) items.FrFX = D.obj('FrFX', Object.assign({ enab: D.bool(x.enabled !== false), present: D.bool(true), showInDialog: D.bool(true), Styl: D.enm('FStl', { outside: 'OutF', inside: 'InsF', center: 'CtrF' }[x.position] || 'OutF'), PntT: D.enm('FrFl', x.fillType === 'gradient' ? 'GrFl' : 'SClr'), 'Md  ': bmE(x.blend), Opct: pct(x.opacity), 'Sz  ': px(x.size) }, x.fillType === 'gradient' ? { Grad: gradDesc(x.gradient), Angl: ang(x.angle), Type: D.enm('GrdT', GRAD_STYLE_INV[x.gradStyle] || 'Lnr '), Rvrs: D.bool(false), Dthr: D.bool(false), 'Scl ': pct(x.scale || 100), Algn: D.bool(true), Ofst: D.obj('Pnt ', { Hrzn: pct(0), Vrtc: pct(0) }) } : { 'Clr ': rgbObj(x.color) }));
    return items;
  }
  function block(w, key, fn, padTo = 2) {
    w.ascii('8BIM').ascii(key);
    const at = w.pos; w.u32(0);
    const st = w.pos; fn(w);
    while ((w.pos - st) % padTo) w.u8(0);
    w.setU32(at, w.pos - st);
  }
  function pascal(w, s, mult) {
    const a = String(s).replace(/[^\x20-\x7e]/g, '?').slice(0, 255);
    const st = w.pos; w.u8(a.length); w.ascii(a);
    while ((w.pos - st) % mult) w.u8(0);
  }

  /* ---------- texto editável (TySh + EngineData) ---------- */
  const FLOAT_KEYS = ['Axis', 'XY', 'Zone', 'WordSpacing', 'FirstLineIndent', 'GlyphSpacing', 'StartIndent', 'EndIndent', 'SpaceBefore', 'SpaceAfter', 'LetterSpacing', 'Values', 'GridSize', 'GridLeading', 'PointBase', 'BoxBounds', 'TransformPoint0', 'TransformPoint1', 'TransformPoint2', 'FontSize', 'Leading', 'HorizontalScale', 'VerticalScale', 'BaselineShift', 'Tsume', 'OutlineWidth', 'AutoLeading'];
  function serializeEngineData(data) {
    const out = []; let indent = 0;
    const ws = (str) => { for (let i = 0; i < str.length; i++) out.push(str.charCodeAt(i) & 255); };
    const ind = () => { for (let i = 0; i < indent; i++) ws('\t'); };
    const fl = (v) => v.toFixed(5).replace(/(\d)0+$/g, '$1').replace(/^0+\.([1-9])/g, '.$1').replace(/^-0+\.0(\d)/g, '-.0$1');
    const num = (v, k) => ((k && FLOAT_KEYS.includes(k)) || (v | 0) !== v ? fl(v) : String(v));
    const sb = (b) => { if (b === 40 || b === 41 || b === 92) out.push(92); out.push(b); };
    const value = (v, key, inProp) => {
      const pre = () => (inProp ? ws(' ') : ind());
      if (v === null) { pre(); ws('null'); }
      else if (typeof v === 'number') { pre(); ws(num(v, key)); }
      else if (typeof v === 'boolean') { pre(); ws(v ? 'true' : 'false'); }
      else if (typeof v === 'string') { pre(); ws('('); out.push(0xfe, 0xff); for (let i = 0; i < v.length; i++) { const c = v.charCodeAt(i); sb((c >> 8) & 255); sb(c & 255); } ws(')'); }
      else if (Array.isArray(v)) {
        pre();
        if (v.every((x) => typeof x === 'number')) { ws('['); v.forEach((x) => { ws(' '); ws(key === 'RunLengthArray' ? String(x) : fl(x)); }); ws(' ]'); }
        else { ws('[\n'); v.forEach((x) => { value(x, key); ws('\n'); }); ind(); ws(']'); }
      } else if (typeof v === 'object') {
        if (inProp) ws('\n');
        ind(); ws('<<\n'); indent++;
        Object.keys(v).forEach((k) => { ind(); ws('/' + k); value(v[k], k, true); ws('\n'); });
        indent--; ind(); ws('>>');
      }
    };
    ws('\n\n'); value(data);
    return new Uint8Array(out);
  }
  function psFontName(s) {
    const fam = String(s.font || 'Arial').replace(/["']/g, '');
    const known = { Arial: ['ArialMT', 'Arial-BoldMT', 'Arial-ItalicMT', 'Arial-BoldItalicMT'], 'Times New Roman': ['TimesNewRomanPSMT', 'TimesNewRomanPS-BoldMT', 'TimesNewRomanPS-ItalicMT', 'TimesNewRomanPS-BoldItalicMT'], 'Courier New': ['CourierNewPSMT', 'CourierNewPS-BoldMT', 'CourierNewPS-ItalicMT', 'CourierNewPS-BoldItalicMT'] };
    const bold = (s.weight || 400) >= 600, it = !!s.italic;
    if (known[fam]) return known[fam][(bold ? 1 : 0) + (it ? 2 : 0)];
    const base = fam.replace(/\s+/g, '');
    const st = (s.weight || 400) >= 900 ? 'Black' : (s.weight || 400) >= 700 ? 'Bold' : (s.weight || 400) >= 600 ? 'Semibold' : (s.weight || 400) >= 500 ? 'Medium' : (s.weight || 400) <= 300 ? 'Light' : '';
    return base + '-' + ((st || (it ? '' : 'Regular')) + (it ? 'Italic' : ''));
  }
  function engineDataFor(t) {
    const text = String(t.text || '').replace(/\r?\n/g, '\r') + '\r';
    const fonts = [{ Name: 'AdobeInvisFont', Script: 0, FontType: 0, Synthetic: 0 }];
    const fontIdx = (name) => { let i = fonts.findIndex((f) => f.Name === name); if (i < 0) { fonts.push({ Name: name, Script: 0, FontType: 0, Synthetic: 0 }); i = fonts.length - 1; } return i; };
    const JUST = ['left', 'right', 'center', 'justify-left', 'justify-right', 'justify-center', 'justify-all'];
    const color = (hex) => { const c = U.hexToRgb(hex || '#000000'); return { Type: 1, Values: [1, c.r / 255, c.g / 255, c.b / 255] }; };
    const styleData = (s) => ({
      Font: fontIdx(psFontName(s)), FontSize: s.size || 12, FauxBold: !!s.fauxBold, FauxItalic: !!s.fauxItalic, AutoLeading: !(s.leading > 0), Leading: s.leading > 0 ? s.leading : 0,
      HorizontalScale: (s.hScale || 100) / 100, VerticalScale: (s.vScale || 100) / 100, Tracking: Math.round(s.tracking || 0), AutoKerning: s.kern !== 'none', Kerning: 0, BaselineShift: s.shift || 0,
      FontCaps: s.caps === 'small' ? 1 : s.caps === 'all' ? 2 : 0, FontBaseline: s.pos === 'super' ? 1 : s.pos === 'sub' ? 2 : 0, Underline: !!s.underline, Strikethrough: !!s.strike,
      Ligatures: true, DLigatures: false, BaselineDirection: 2, Tsume: 0, StyleRunAlignment: 2, Language: 0, NoBreak: false, FillColor: color(s.color), StrokeColor: color('#000000'),
      FillFlag: true, StrokeFlag: false, FillFirst: true, YUnderline: 1, OutlineWidth: 1, CharacterDirection: 0, HindiNumbers: false, Kashida: 1, DiacriticPos: 2
    });
    const paraProps = (p) => ({
      Justification: Math.max(0, JUST.indexOf(p.align || 'left')), FirstLineIndent: p.indF || 0, StartIndent: p.indL || 0, EndIndent: p.indR || 0, SpaceBefore: p.spB || 0, SpaceAfter: p.spA || 0,
      AutoHyphenate: !!p.hyph, HyphenatedWordSize: 6, PreHyphen: 2, PostHyphen: 2, ConsecutiveHyphens: 8, Zone: 36, WordSpacing: [0.8, 1, 1.33], LetterSpacing: [0, 0, 0], GlyphSpacing: [1, 1, 1],
      AutoLeading: 1.2, LeadingType: 0, Hanging: false, Burasagari: false, KinsokuOrder: 0, EveryLineComposer: false
    });
    const DS = IMG.Text.DEF_STYLE, DP = IMG.Text.DEF_PARA;
    const runs = (t.runs || []).filter((r) => r.n > 0);
    if (!runs.length) runs.push({ n: 0, s: (t.runs && t.runs[0] && t.runs[0].s) || DS });
    const RunArray = runs.map((r) => ({ StyleSheet: { StyleSheetData: styleData(Object.assign({}, DS, r.s)) } }));
    const RunLengthArray = runs.map((r) => r.n);
    RunLengthArray[RunLengthArray.length - 1] += text.length - RunLengthArray.reduce((a, b) => a + b, 0);
    const parts = text.split('\r'); parts.pop();
    const PRun = parts.map((ptxt, i) => ({ ParagraphSheet: { DefaultStyleSheet: 0, Properties: paraProps(Object.assign({}, DP, (t.paras || [])[i] || {})) }, Adjustments: { Axis: [1, 0, 1], XY: [0, 0] } }));
    const PLen = parts.map((ptxt) => ptxt.length + 1);
    const box = t.box && t.orient !== 'v', vertical = t.orient === 'v';
    const Photoshop = { ShapeType: box ? 1 : 0 };
    if (box) Photoshop.BoxBounds = [0, 0, t.box.w, t.box.h]; else Photoshop.PointBase = [0, 0];
    Photoshop.Base = { ShapeType: box ? 1 : 0, TransformPoint0: [1, 0], TransformPoint1: [0, 1], TransformPoint2: [0, 0] };
    const res = () => ({
      KinsokuSet: [{ Name: 'PhotoshopKinsokuHard', NoStart: '、。，．・：；？！ー―’”）〕］｝〉》」』】ヽヾゝゞ々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ゛゜?!)]},.:;℃℉¢％‰', NoEnd: '‘“（〔［｛〈《「『【([{￥＄£＠§〒＃', Keep: '―‥', Hanging: '、。.,' }, { Name: 'PhotoshopKinsokuSoft', NoStart: '、。，．・：；？！’”）〕］｝〉》」』】ヽヾゝゞ々', NoEnd: '‘“（〔［｛〈《「『【', Keep: '―‥', Hanging: '、。.,' }],
      MojiKumiSet: [{ InternalName: 'Photoshop6MojiKumiSet1' }, { InternalName: 'Photoshop6MojiKumiSet2' }, { InternalName: 'Photoshop6MojiKumiSet3' }, { InternalName: 'Photoshop6MojiKumiSet4' }],
      TheNormalStyleSheet: 0, TheNormalParagraphSheet: 0,
      ParagraphSheetSet: [{ Name: 'Normal RGB', DefaultStyleSheet: 0, Properties: paraProps(DP) }],
      StyleSheetSet: [{ Name: 'Normal RGB', StyleSheetData: styleData(Object.assign({}, DS, runs[0].s)) }],
      FontSet: fonts.map((f) => Object.assign({}, f)),
      SuperscriptSize: 0.583, SuperscriptPosition: 0.333, SubscriptSize: 0.583, SubscriptPosition: 0.333, SmallCapSize: 0.7
    });
    const data = {
      EngineDict: {
        Editor: { Text: text },
        ParagraphRun: { DefaultRunData: { ParagraphSheet: { DefaultStyleSheet: 0, Properties: {} }, Adjustments: { Axis: [1, 0, 1], XY: [0, 0] } }, RunArray: PRun, RunLengthArray: PLen, IsJoinable: 1 },
        StyleRun: { DefaultRunData: { StyleSheet: { StyleSheetData: {} } }, RunArray, RunLengthArray, IsJoinable: 2 },
        GridInfo: { GridIsOn: false, ShowGrid: false, GridSize: 18, GridLeading: 22, GridColor: { Type: 1, Values: [0, 0, 0, 1] }, GridLeadingFillColor: { Type: 1, Values: [0, 0, 0, 1] }, AlignLineHeightToGridFlags: false },
        AntiAlias: ['none', 'crisp', 'strong', 'smooth', 'sharp'].indexOf(t.aa || 'smooth') < 0 ? 3 : ['none', 'crisp', 'strong', 'smooth', 'sharp'].indexOf(t.aa || 'smooth'),
        UseFractionalGlyphWidths: true,
        Rendered: { Version: 1, Shapes: { WritingDirection: vertical ? 2 : 0, Children: [{ ShapeType: box ? 1 : 0, Procession: vertical ? 1 : 0, Lines: { WritingDirection: vertical ? 2 : 0, Children: [] }, Cookie: { Photoshop } }] } }
      },
      ResourceDict: null, DocumentResources: null
    };
    // as fontes são descobertas ao montar os estilos: os recursos vêm por último
    data.ResourceDict = res(); data.DocumentResources = res();
    return serializeEngineData(data);
  }
  function writeTySh(w, L) {
    const t = IMG.Text.normalize(L.text, L), m = t.m || [1, 0, 0, 1];
    const tx = t.box && t.orient !== 'v' ? t.box.x : t.x, ty = t.box && t.orient !== 'v' ? t.box.y : t.y;
    w.i16(1);
    [m[0], m[1], m[2], m[3], tx, ty].forEach((v) => w.f64(v));
    w.i16(50).u32(16);
    const AA = { none: 'Anno', sharp: 'antiAliasSharp', crisp: 'AnCr', strong: 'AnSt', smooth: 'AnSm' };
    wDesc(w, 'TxLr', { 'Txt ': D.text(String(t.text || '').replace(/\r?\n/g, '\r')), textGridding: D.enm('textGridding', 'None'), Ornt: D.enm('Ornt', t.orient === 'v' ? 'Vrtc' : 'Hrzn'), AntA: D.enm('Annt', AA[t.aa] || 'AnSm'), TextIndex: D.long(0), EngineData: D.raw(engineDataFor(t)) });
    w.i16(1).u32(16);
    const wp = t.warp && t.warp.style && t.warp.style !== 'none' ? t.warp : null;
    wDesc(w, 'warp', { warpStyle: D.enm('warpStyle', wp ? 'warp' + wp.style[0].toUpperCase() + wp.style.slice(1) : 'warpNone'), warpValue: D.doub(wp ? wp.bend || 0 : 0), warpPerspective: D.doub(wp ? wp.h || 0 : 0), warpPerspectiveOther: D.doub(wp ? wp.v || 0 : 0), warpRotate: D.enm('Ornt', wp && wp.vertical ? 'Vrtc' : 'Hrzn'), bounds: D.obj('Rctn', { 'Top ': D.unt('#Pxl', 0), Left: D.unt('#Pxl', 0), Btom: D.unt('#Pxl', 0), Rght: D.unt('#Pxl', 0) }), uOrder: D.long(0), vOrder: D.long(0) });
    const b = L.contentBounds() || { x: tx, y: ty, w: 0, h: 0 };
    w.f32(b.x - tx).f32(b.y - ty).f32(b.x + b.w - tx).f32(b.y + b.h - ty);
  }

  /** Grava o documento como PSD. o: { maximize (inclui composto), psb } */
  async function writePSD(doc, o = {}) {
    const W = doc.width, H = doc.height, Layers = IMG.Layers;
    const flat = IMG.Engine.flatten(doc);
    const recs = [];
    const warn = new Set();
    // lista linear (de baixo para cima) com divisores de grupo
    const push = (L) => {
      if (L.type === 'group') {
        recs.push({ divider: true, L });
        L.children.forEach(push);
        recs.push({ group: true, L });
        return;
      }
      recs.push({ L });
    };
    doc.layers.forEach(push);
    for (const rec of recs) {
      const L = rec.L;
      rec.name = rec.divider ? '</Layer group>' : L.name || 'Camada';
      rec.blend = rec.divider ? 'norm' : L.type === 'group' ? (L.blend === 'pass' ? 'pass' : BK_INV[L.blend] || 'norm') : BK_INV[L.blend] || 'norm';
      rec.opacity = rec.divider ? 255 : Math.round(U.clamp(L.opacity, 0, 1) * 255);
      rec.clip = !rec.divider && L.clip ? 1 : 0;
      rec.hidden = !rec.divider && !L.visible;
      rec.chans = [];
      if (rec.divider || rec.group || L.type === 'adjust') {
        rec.rect = { x: 0, y: 0, w: 0, h: 0 };
        [-1, 0, 1, 2].forEach((id) => rec.chans.push({ id, data: new Uint8Array(2) }));
      } else {
        const cb = L.canvas && !L._blank && L.contentBounds ? L.contentBounds() : null;
        let b = cb ? U.rectInt(cb) : null;
        if (L.type === 'fill') b = { x: 0, y: 0, w: W, h: H };
        if (b && b.w > 0 && b.h > 0 && L.canvas) {
          const P = planes(L.canvas, b.x - L.x, b.y - L.y, b.w, b.h);
          rec.rect = b;
          rec.chans.push({ id: -1, data: encodeChannel(P[3], b.w, b.h) }, { id: 0, data: encodeChannel(P[0], b.w, b.h) }, { id: 1, data: encodeChannel(P[1], b.w, b.h) }, { id: 2, data: encodeChannel(P[2], b.w, b.h) });
        } else {
          rec.rect = { x: 0, y: 0, w: 0, h: 0 };
          [-1, 0, 1, 2].forEach((id) => rec.chans.push({ id, data: new Uint8Array(2) }));
        }
      }
      if (!rec.divider && L.mask && L.mask.canvas) {
        const m = L.mask, mw = m.canvas.width, mh = m.canvas.height, md = m.canvas.getContext('2d').getImageData(0, 0, mw, mh).data, pl = new Uint8Array(mw * mh);
        for (let i = 0; i < pl.length; i++) pl[i] = md[i * 4 + 3];
        rec.mask = { x: m.x, y: m.y, w: mw, h: mh, def: m.bg ? 255 : 0, disabled: m.enabled === false };
        rec.chans.push({ id: -2, data: encodeChannel(pl, mw, mh) });
      }
      if (L.type === 'text' && L.text && L.text.onPath) warn.add('texto em demarcador (gravado como texto comum)');
      if (L.type === 'adjust' && !['invert', 'posterize', 'threshold', 'brightnessContrast', 'levels', 'curves', 'exposure', 'vibrance', 'hueSaturation', 'colorBalance'].includes(L.adj && L.adj.kind)) warn.add('alguns ajustes');
    }
    const w = new Writer(false, 1 << 22);
    w.ascii('8BPS').u16(1).zeros(6);
    let transparent = false; { const d = flat.getContext('2d').getImageData(0, 0, W, H).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 255) { transparent = true; break; } }
    w.u16(transparent ? 4 : 3).u32(H).u32(W).u16(8).u16(3);
    w.u32(0); // modo de cor
    // recursos
    const resLen = w.lenU32();
    const res = (id, fn) => { w.ascii('8BIM').u16(id).u16(0); const at = w.pos; w.u32(0); const st = w.pos; fn(); const sz = w.pos - st; if (sz % 2) w.u8(0); w.setU32(at, sz); };
    const dpi = doc.dpi || 72;
    res(0x03ed, () => { w.u32(dpi * 65536).u16(1).u16(1).u32(dpi * 65536).u16(1).u16(1); });
    if (doc.guides && (doc.guides.h.length || doc.guides.v.length)) res(0x0408, () => { w.u32(1).u32(0).u32(0); w.u32(doc.guides.h.length + doc.guides.v.length); doc.guides.v.forEach((g) => { w.i32(Math.round(g * 32)); w.u8(0); }); doc.guides.h.forEach((g) => { w.i32(Math.round(g * 32)); w.u8(1); }); });
    res(0x0421, () => { w.u32(1).u8(1); wUni(w, 'Imaginarium'); wUni(w, 'Imaginarium ' + IMG.VERSION); w.u32(1); });
    const act = recs.findIndex((q) => !q.divider && q.L.id === doc.activeId);
    res(0x0400, () => { w.u16(Math.max(0, act)); });
    resLen();
    // camadas e máscaras
    const lmLen = w.lenU32();
    const liLen = w.lenU32();
    w.i16(transparent ? -recs.length : recs.length);
    for (const rec of recs) {
      const L = rec.L, b = rec.rect;
      w.i32(b.y).i32(b.x).i32(b.y + b.h).i32(b.x + b.w);
      w.u16(rec.chans.length);
      for (const c of rec.chans) w.i16(c.id).u32(c.data.length);
      w.ascii('8BIM').ascii(rec.blend);
      w.u8(rec.opacity).u8(rec.clip).u8((rec.hidden ? 2 : 0) | 8 | (rec.divider || rec.group ? 16 : 0)).u8(0);
      const exLen = w.lenU32(), exSt = w.pos;
      if (rec.mask) { const m = rec.mask; w.u32(20).i32(m.y).i32(m.x).i32(m.y + m.h).i32(m.x + m.w).u8(m.def).u8(m.disabled ? 2 : 0).u16(0); }
      else w.u32(0);
      const bi = !rec.divider && L.adv && L.adv.blendIf;
      w.u32(40);
      if (bi) { (bi.self || [0, 0, 255, 255]).forEach((v) => w.u8(v)); (bi.under || [0, 0, 255, 255]).forEach((v) => w.u8(v)); } else w.u32(0x0000ffff).u32(0x0000ffff);
      for (let k = 0; k < 4; k++) w.u32(0x0000ffff).u32(0x0000ffff);
      pascal(w, rec.name, 4);
      block(w, 'luni', (x) => { const nm = String(rec.name); x.u32(nm.length); for (let i = 0; i < nm.length; i++) x.u16(nm.charCodeAt(i)); }, 4);
      if (rec.divider) block(w, 'lsct', (x) => { x.u32(3); }, 4);
      else if (rec.group) {
        block(w, 'lsct', (x) => { x.u32(L.expanded === false ? 2 : 1).ascii('8BIM').ascii(L.blend === 'pass' ? 'pass' : BK_INV[L.blend] || 'norm'); }, 4);
        if (L.artboard) { const a = L.artboard; block(w, 'artb', (x) => { x.u32(16); wDesc(x, 'artboard', { artboardRect: D.obj('classFloatRect', { 'Top ': D.doub(a.y), Left: D.doub(a.x), Btom: D.doub(a.y + a.h), Rght: D.doub(a.x + a.w) }), guideIndeces: D.list([]), artboardPresetName: D.text(''), 'Clr ': rgbObj(a.bg && a.bg !== 'transparent' ? a.bg : '#ffffff'), artboardBackgroundType: D.long(a.bg === '#ffffff' ? 1 : a.bg === '#000000' ? 2 : a.bg === 'transparent' ? 3 : 4) }); }, 4); }
      }
      if (!rec.divider) {
        if (L.type !== 'group' && L.fill != null && L.fill < 1) block(w, 'iOpa', (x) => { x.u8(Math.round(L.fill * 255)).zeros(3); }, 4);
        const ci = LCOLORS.indexOf(L.color || null); if (ci > 0) block(w, 'lclr', (x) => { x.u16(ci).zeros(6); }, 4);
        if (L.fx && Object.keys(L.fx).some((k) => L.fx[k] && L.fx[k].enabled)) block(w, 'lfx2', (x) => { x.u32(0).u32(16); wDesc(x, 'null', fxDesc(L.fx, doc)); }, 4);
        if (L.type === 'shape' && L.shape) {
          const s = IMG.Shapes.normalize(L.shape), noStroke = !(s.stroke && s.stroke.on);
          if (s.fill && s.fill.type === 'solid' && noStroke) {
            block(w, 'SoCo', (x) => { x.u32(16); wDesc(x, 'null', { 'Clr ': rgbObj(s.fill.color) }); }, 4);
            block(w, 'vmsk', (x) => { x.u32(3).u32(0); writePath(x, s.path, W, H); }, 4);
          } else warn.add('formas com traçado ou gradiente (gravadas como pixels)');
        } else if (L.type === 'text' && L.text) {
          try { block(w, 'TySh', (x) => writeTySh(x, L), 4); } catch (err) { console.warn('TySh', err); }
        } else if (L.type === 'fill' && L.fillDef && L.fillDef.type === 'solid') {
          block(w, 'SoCo', (x) => { x.u32(16); wDesc(x, 'null', { 'Clr ': rgbObj(L.fillDef.color) }); }, 4);
        } else if (L.type === 'adjust' && L.adj) writeAdjust(w, L.adj);
        if (L.vmask && L.vmask.path && L.type !== 'shape') block(w, 'vmsk', (x) => { x.u32(3).u32((L.vmask.invert ? 1 : 0) | (L.vmask.enabled === false ? 2 : 0)); writePath(x, L.vmask.path, W, H); }, 4);
      }
      w.setU32(exSt - 4, w.pos - exSt);
      void exLen;
    }
    for (const rec of recs) for (const c of rec.chans) w.bytes(c.data);
    while ((w.pos) % 2) w.u8(0);
    liLen();
    w.u32(0); // informações globais de máscara
    lmLen();
    // imagem composta (RLE)
    const P = planes(flat, 0, 0, W, H), nc = transparent ? 4 : 3, rows = [];
    for (let c = 0; c < nc; c++) for (let y = 0; y < H; y++) rows.push(packBits(P[c].subarray(y * W, (y + 1) * W)));
    w.u16(1);
    for (const rr of rows) w.u16(rr.length);
    for (const rr of rows) w.bytes(rr);
    return { blob: new Blob([w.out()], { type: 'image/vnd.adobe.photoshop' }), warnings: [...warn] };
  }
  function writeAdjust(w, a) {
    const k = a.kind;
    if (k === 'invert') block(w, 'nvrt', () => {}, 4);
    else if (k === 'posterize') block(w, 'post', (x) => { x.u16(a.levels || 4).u16(0); }, 4);
    else if (k === 'threshold') block(w, 'thrs', (x) => { x.u16(a.level || 128).u16(0); }, 4);
    else if (k === 'brightnessContrast') {
      block(w, 'brit', (x) => { x.i16(a.brightness || 0).i16(a.contrast || 0).i16(127).u8(0).u8(0); }, 4);
      block(w, 'CgEd', (x) => { x.u32(16); wDesc(x, 'null', { Vrsn: D.long(1), Brgh: D.long(a.brightness || 0), Cntr: D.long(a.contrast || 0), means: D.long(127), 'Lab ': D.bool(false), useLegacy: D.bool(!!a.legacy), Auto: D.bool(false) }); }, 4);
    } else if (k === 'exposure') block(w, 'expA', (x) => { x.u16(1).f32(a.exposure || 0).f32(a.offset || 0).f32(a.gamma || 1); }, 4);
    else if (k === 'vibrance') block(w, 'vibA', (x) => { x.u32(16); wDesc(x, 'null', { vibrance: D.long(a.vibrance || 0), Strt: D.long(a.saturation || 0) }); }, 4);
    else if (k === 'levels') block(w, 'levl', (x) => {
      x.u16(2);
      ['rgb', 'r', 'g', 'b'].forEach((c) => { const l = (a.lv && a.lv[c]) || { ib: 0, g: 1, iw: 255, ob: 0, ow: 255 }; x.u16(l.ib).u16(l.iw).u16(l.ob).u16(l.ow).u16(Math.round((l.g || 1) * 100)); });
      for (let i = 4; i < 29; i++) x.u16(0).u16(255).u16(0).u16(255).u16(100);
    }, 4);
    else if (k === 'curves') block(w, 'curv', (x) => {
      const keys = ['rgb', 'r', 'g', 'b'], cv = a.cv || {}; let bits = 0;
      keys.forEach((c, i) => { if (cv[c]) bits |= 1 << i; });
      x.u8(0).u16(1).u32(bits);
      keys.forEach((c) => { if (!cv[c]) return; x.u16(cv[c].length); cv[c].forEach(([inp, out]) => { x.u16(Math.round(out)).u16(Math.round(inp)); }); });
    }, 4);
    else if (k === 'hueSaturation') block(w, 'hue2', (x) => {
      x.u16(2).u8(a.colorize ? 1 : 0).u8(0);
      const cz = a.cz || { h: 0, s: 25, l: 0 }, m = a.master || { h: 0, s: 0, l: 0 };
      x.i16(cz.h).i16(cz.s).i16(cz.l).i16(m.h).i16(m.s).i16(m.l);
      const R = [[315, 345, 15, 45], [15, 45, 75, 105], [75, 105, 135, 165], [135, 165, 195, 225], [195, 225, 255, 285], [255, 285, 315, 345]];
      ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas'].forEach((c, i) => { R[i].forEach((v) => x.i16(v)); const q = a[c] || { h: 0, s: 0, l: 0 }; x.i16(q.h).i16(q.s).i16(q.l); });
    }, 4);
    else if (k === 'colorBalance') block(w, 'blnc', (x) => { ['shadows', 'midtones', 'highlights'].forEach((t) => (a[t] || [0, 0, 0]).forEach((v) => x.i16(v))); x.u8(a.preserve ? 1 : 0).u8(0); }, 4);
  }

  IMG.PSD = { read: readPSD, write: writePSD, parseEngineData, fxFromDesc };
})();
