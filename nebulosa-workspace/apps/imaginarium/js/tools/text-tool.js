/* ==========================================================================
   Imaginarium — texto rico
   Modelo da camada de texto (L.text):
     { text, runs: [{ n, s: estilo }], paras: [estilo de parágrafo],
       x, y (âncora: ponto = linha de base da 1ª linha; caixa = canto superior esquerdo),
       box: null | { w, h }, orient: 'h' | 'v', m: [a, b, c, d] (transformação linear),
       warp: null | { style, bend, h, v, vertical }, aa: 'smooth' | 'none',
       onPath: null | { path, off }, auto }
   Estilo de caractere: fonte, peso, itálico, tamanho, cor, rastreamento (1/1000 em),
   entrelinha (0 = automática), escala H/V, deslocamento da linha de base, negrito e
   itálico falsos, sublinhado, tachado, maiúsculas (all/small), sobrescrito/subscrito.
   Estilo de parágrafo: alinhamento (incl. justificado), recuos e espaço antes/depois.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const Layers = IMG.Layers;

  const mctx = U.domCanvas(8, 8).getContext('2d');
  const hasLS = 'letterSpacing' in mctx;
  const GENERIC = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];

  /* ==================================================================
     FONTES
     ================================================================== */
  const CANDIDATES = ['Arial', 'Arial Black', 'Arial Narrow', 'Bahnschrift', 'Calibri', 'Cambria', 'Candara', 'Century Gothic', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel',
    'Courier New', 'Ebrima', 'Franklin Gothic Medium', 'Gabriola', 'Gadugi', 'Garamond', 'Georgia', 'Impact', 'Ink Free', 'Lucida Console', 'Lucida Sans Unicode', 'Malgun Gothic',
    'Microsoft Sans Serif', 'Palatino Linotype', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Black', 'Segoe UI Light', 'Segoe UI Semibold', 'Sitka Text', 'Sylfaen', 'Tahoma', 'Times New Roman',
    'Trebuchet MS', 'Verdana', 'Book Antiqua', 'Bookman Old Style', 'Century', 'Rockwell', 'Gill Sans MT', 'Tw Cen MT', 'Perpetua', 'Baskerville Old Face', 'Bodoni MT', 'Brush Script MT', 'Copperplate Gothic Bold',
    'Helvetica', 'Helvetica Neue', 'Avenir', 'Avenir Next', 'Futura', 'Gill Sans', 'Optima', 'Palatino', 'Didot', 'Baskerville', 'American Typewriter', 'Menlo', 'Monaco', 'SF Pro Text', 'Chalkboard', 'Marker Felt', 'Noteworthy', 'Zapfino',
    'Ubuntu', 'Ubuntu Mono', 'Cantarell', 'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'Liberation Sans', 'Liberation Serif', 'Liberation Mono', 'Noto Sans', 'Noto Serif', 'Roboto', 'Roboto Slab', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Inter', 'Fira Sans', 'Fira Code', 'Source Sans Pro', 'Oswald', 'Raleway'];
  const Fonts = (IMG.Fonts = {
    list: ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'],
    full: false,
    detect() {
      const probe = 'mmmmmmmmmmlliWQ@0', bases = ['monospace', 'serif', 'sans-serif'], base = {};
      bases.forEach((b) => { mctx.font = '72px ' + b; base[b] = mctx.measureText(probe).width; });
      const found = CANDIDATES.filter((f) => bases.some((b) => { mctx.font = '72px "' + f + '", ' + b; return mctx.measureText(probe).width !== base[b]; }));
      if (found.length) this.list = found.sort((a, b) => a.localeCompare(b));
      bus.emit('fonts:change');
    },
    get canQuery() { return typeof window.queryLocalFonts === 'function'; },
    async loadSystem() {
      if (!this.canQuery) { IMG.UI.toast('Este navegador não permite listar todas as fontes; a lista usa as fontes detectadas.'); return false; }
      const fonts = await window.queryLocalFonts();
      const set = new Set(this.list);
      fonts.forEach((f) => set.add(f.family));
      this.list = Array.from(set).sort((a, b) => a.localeCompare(b));
      this.full = true;
      bus.emit('fonts:change');
      IMG.UI.toast(this.list.length + ' fontes do sistema disponíveis.');
      return true;
    },
    options(current) { const l = this.list.slice(); if (current && !l.includes(current)) l.unshift(current); return l.map((f) => [f, f]); }
  });
  const STYLES = [['400', 'Regular'], ['400i', 'Itálico'], ['300', 'Leve'], ['300i', 'Leve itálico'], ['500', 'Médio'], ['600', 'Seminegrito'], ['700', 'Negrito'], ['700i', 'Negrito itálico'], ['900', 'Black']];
  const styleKey = (s) => (s.weight || 400) + (s.italic ? 'i' : '');

  /* ==================================================================
     MODELO
     ================================================================== */
  const DEF_STYLE = { font: 'Arial', weight: 400, italic: false, size: 64, color: '#000000', tracking: 0, leading: 0, hScale: 100, vScale: 100, shift: 0, fauxBold: false, fauxItalic: false, underline: false, strike: false, caps: 'none', pos: 'normal', kern: 'metric' };
  const DEF_PARA = { align: 'left', indL: 0, indR: 0, indF: 0, spB: 0, spA: 0, hyph: false };
  const sameStyle = (a, b) => { for (const k in DEF_STYLE) if (a[k] !== b[k]) return false; return true; };
  const fam = (name) => (GENERIC.includes(name) ? name : '"' + String(name).replace(/"/g, '') + '", sans-serif');
  const fontCSS = (s, size) => (s.italic ? 'italic ' : '') + (s.weight || 400) + ' ' + Math.max(0.5, size) + 'px ' + fam(s.font);

  const Model = {
    /** Converte o formato antigo (content/font/size…) e completa campos. */
    normalize(t, L) {
      if (!t) return t;
      if (t.runs) {
        t.text = t.text || '';
        t.runs = t.runs.map((r) => ({ n: r.n, s: Object.assign({}, DEF_STYLE, r.s) }));
        const paraN = t.text.split('\n').length;
        t.paras = (t.paras || []).slice(0, paraN).map((p) => Object.assign({}, DEF_PARA, p));
        while (t.paras.length < paraN) t.paras.push(Object.assign({}, t.paras[t.paras.length - 1] || DEF_PARA));
        if (!t.m) t.m = [1, 0, 0, 1];
        if (!t.orient) t.orient = 'h';
        if (!t.aa) t.aa = 'smooth';
        Model.fixRuns(t);
        return t;
      }
      // formato antigo
      const content = String(t.content || '');
      const s = Object.assign({}, DEF_STYLE, { font: t.font || 'Arial', weight: t.bold ? 700 : 400, italic: !!t.italic, size: t.size || 64, color: t.color || '#000000', tracking: t.spacing ? (t.spacing / (t.size || 64)) * 1000 : 0, leading: t.lineHeight && Math.abs(t.lineHeight - 1.2) > 0.001 ? t.lineHeight * (t.size || 64) : 0, underline: !!t.underline });
      const fm = metrics(s.font, s.weight, s.italic), lineH = (t.lineHeight || 1.2) * s.size;
      const nt = {
        text: content, runs: [{ n: content.length, s }], paras: content.split('\n').map(() => Object.assign({}, DEF_PARA, { align: t.align || 'left' })),
        x: t.x || 0, y: (t.y || 0) + (lineH - (fm.asc + fm.desc) * s.size) / 2 + fm.asc * s.size, box: null, orient: 'h', m: [1, 0, 0, 1], warp: null, aa: 'smooth', onPath: null, auto: t.auto !== false
      };
      if (t.rotation) { const a = U.rad(t.rotation), c = Math.cos(a), sn = Math.sin(a); nt.m = [c, sn, -sn, c]; }
      if (L && (t.strokeOn || t.shadowOn)) {
        L.fx = L.fx || {};
        if (t.strokeOn && t.strokeWidth > 0) L.fx.stroke = Object.assign(IMG.Effects.defaults('stroke'), { size: t.strokeWidth, color: t.strokeColor || '#fff', position: 'outside' });
        if (t.shadowOn) L.fx.dropShadow = Object.assign(IMG.Effects.defaults('dropShadow'), { color: t.shadowColor || '#000', opacity: t.shadowOpacity == null ? 60 : t.shadowOpacity, distance: Math.hypot(t.shadowX || 0, t.shadowY || 0), angle: U.deg(Math.atan2(t.shadowY || 0, -(t.shadowX || 0))), useGlobal: false, size: t.shadowBlur || 0, blend: 'normal' });
      }
      return nt;
    },
    fixRuns(t) {
      const runs = [];
      t.runs.forEach((r) => { if (r.n <= 0 && runs.length) return; const last = runs[runs.length - 1]; if (last && sameStyle(last.s, r.s)) last.n += r.n; else runs.push({ n: Math.max(0, r.n), s: r.s }); });
      if (!runs.length) runs.push({ n: 0, s: Object.assign({}, DEF_STYLE) });
      let total = runs.reduce((a, r) => a + r.n, 0);
      const len = t.text.length;
      if (total < len) runs[runs.length - 1].n += len - total;
      else if (total > len) { let ex = total - len; for (let i = runs.length - 1; i >= 0 && ex > 0; i--) { const d = Math.min(ex, runs[i].n); runs[i].n -= d; ex -= d; } }
      t.runs = runs.filter((r, i) => r.n > 0 || i === 0 && runs.every((q) => !q.n));
      if (!t.runs.length) t.runs = [{ n: 0, s: runs[0].s }];
    },
    /** Estilo de cada caractere (array de referências). */
    expand(t) { const out = []; t.runs.forEach((r) => { for (let i = 0; i < r.n; i++) out.push(r.s); }); return out; },
    styleAt(t, i) {
      let acc = 0;
      for (const r of t.runs) { if (i < acc + r.n) return r.s; acc += r.n; }
      return t.runs[t.runs.length - 1].s;
    },
    /** Estilo ao digitar na posição i (o do caractere anterior). */
    caretStyle(t, i) { return Object.assign({}, i > 0 ? Model.styleAt(t, i - 1) : Model.styleAt(t, 0)); },
    insert(t, i, str, s) {
      if (!str) return;
      const st = Object.assign({}, DEF_STYLE, s);
      const arr = Model.expand(t);
      arr.splice(i, 0, ...Array.from({ length: str.length }, () => st));
      // parágrafos
      const before = t.text.slice(0, i).split('\n').length - 1, nl = (str.match(/\n/g) || []).length;
      if (nl) { const p = t.paras[before] || DEF_PARA; t.paras.splice(before + 1, 0, ...Array.from({ length: nl }, () => Object.assign({}, p))); }
      t.text = t.text.slice(0, i) + str + t.text.slice(i);
      Model.compress(t, arr);
    },
    remove(t, a, b) {
      if (b <= a) return;
      const arr = Model.expand(t);
      const keepFirst = arr.length ? arr[Math.min(a, arr.length - 1)] : null;
      arr.splice(a, b - a);
      const removed = t.text.slice(a, b), pi = t.text.slice(0, a).split('\n').length - 1, nl = (removed.match(/\n/g) || []).length;
      if (nl) t.paras.splice(pi + 1, nl);
      t.text = t.text.slice(0, a) + t.text.slice(b);
      Model.compress(t, arr, keepFirst);
    },
    compress(t, arr, fallback) {
      const runs = [];
      arr.forEach((s) => { const last = runs[runs.length - 1]; if (last && (last.s === s || sameStyle(last.s, s))) last.n++; else runs.push({ n: 1, s }); });
      if (!runs.length) runs.push({ n: 0, s: Object.assign({}, fallback || t.runs[0].s) });
      t.runs = runs.map((r) => ({ n: r.n, s: Object.assign({}, r.s) }));
    },
    applyStyle(t, a, b, patch) {
      const arr = Model.expand(t);
      if (a === 0 && b >= arr.length && !arr.length) { Object.assign(t.runs[0].s, patch); return; }
      for (let i = a; i < b && i < arr.length; i++) arr[i] = Object.assign({}, arr[i], patch);
      Model.compress(t, arr);
    },
    /** Índices de parágrafo cobertos por [a, b]. */
    paraRange(t, a, b) { const p0 = t.text.slice(0, a).split('\n').length - 1, p1 = t.text.slice(0, b).split('\n').length - 1; return [p0, p1]; },
    applyPara(t, a, b, patch) { const [p0, p1] = Model.paraRange(t, a, b); for (let p = p0; p <= p1; p++) t.paras[p] = Object.assign({}, t.paras[p] || DEF_PARA, patch); },
    /** Valor comum de uma propriedade no intervalo (ou undefined se misto). */
    common(t, a, b, key, para) {
      if (para) { const [p0, p1] = Model.paraRange(t, a, b); const v = (t.paras[p0] || DEF_PARA)[key]; for (let p = p0; p <= p1; p++) if ((t.paras[p] || DEF_PARA)[key] !== v) return undefined; return v; }
      if (a >= b) return Model.caretStyle(t, a)[key];
      const arr = Model.expand(t); const v = arr[a] && arr[a][key];
      for (let i = a + 1; i < b; i++) if (arr[i][key] !== v) return undefined;
      return v;
    }
  };

  /* ==================================================================
     MEDIÇÃO
     ================================================================== */
  const metricsCache = new Map();
  function metrics(font, weight, italic) {
    const k = font + '|' + weight + '|' + (italic ? 1 : 0);
    let m = metricsCache.get(k);
    if (m) return m;
    mctx.font = fontCSS({ font, weight, italic }, 100);
    if (hasLS) mctx.letterSpacing = '0px';
    const t = mctx.measureText('Hgjy|ÁÇ');
    m = { asc: (t.fontBoundingBoxAscent != null ? t.fontBoundingBoxAscent : 92) / 100, desc: (t.fontBoundingBoxDescent != null ? t.fontBoundingBoxDescent : 24) / 100, cap: (t.actualBoundingBoxAscent || 72) / 100 };
    metricsCache.set(k, m);
    return m;
  }
  const widthCache = new Map();
  function measure(s, size, str) {
    const k = fontCSS(s, size) + '|' + (s.kern === 'none' ? 0 : 1) + '|' + str;
    let w = widthCache.get(k);
    if (w != null) return w;
    mctx.font = fontCSS(s, size);
    if (hasLS) mctx.letterSpacing = '0px';
    if ('fontKerning' in mctx) mctx.fontKerning = s.kern === 'none' ? 'none' : 'normal';
    w = mctx.measureText(str).width;
    if (widthCache.size > 20000) widthCache.clear();
    widthCache.set(k, w);
    return w;
  }
  /** Tamanho efetivo e caractere exibido (maiúsculas, versalete, sobrescrito). */
  function eff(s, ch) {
    let size = s.size, dc = ch, rise = s.shift || 0;
    if (s.caps === 'all') dc = ch.toUpperCase();
    else if (s.caps === 'small' && ch !== ch.toUpperCase()) { dc = ch.toUpperCase(); size *= 0.75; }
    if (s.pos === 'super') { size *= 0.583; rise += s.size * 0.333; }
    else if (s.pos === 'sub') { size *= 0.583; rise -= s.size * 0.2; }
    return { size, dc, rise };
  }

  /* ==================================================================
     DIAGRAMAÇÃO
     ================================================================== */
  function layout(t) {
    const text = t.text, styles = Model.expand(t), N = text.length;
    const box = t.box && t.orient !== 'v' ? t.box : null;
    const vert = t.orient === 'v';
    const glyphs = new Array(N);
    // avanço de cada caractere (com kerning dentro de cada palavra do mesmo estilo)
    let i = 0;
    while (i < N) {
      const ch = text[i];
      if (ch === '\n') { glyphs[i] = { i, ch, adv: 0, nl: true, s: styles[i] }; i++; continue; }
      const isSp = /\s/.test(ch);
      let j = i + 1;
      while (j < N && text[j] !== '\n' && /\s/.test(text[j]) === isSp && styles[j] === styles[i]) j++;
      const s = styles[i];
      let prev = 0, acc = '';
      for (let k = i; k < j; k++) {
        const e = eff(s, text[k]);
        let adv;
        if (vert) adv = e.size + (s.tracking / 1000) * s.size;
        else {
          if (s.caps === 'small' || s.pos !== 'normal') adv = measure(s, e.size, e.dc);
          else { acc += e.dc; const w = measure(s, e.size, acc); adv = w - prev; prev = w; }
          adv = adv * (s.hScale / 100) + (s.tracking / 1000) * s.size;
        }
        glyphs[k] = { i: k, ch: text[k], dc: e.dc, size: e.size, rise: e.rise, adv, s, sp: isSp };
      }
      i = j;
    }
    // parágrafos → linhas
    const lines = [];
    let p = 0, start = 0;
    const paras = text.split('\n');
    paras.forEach((ptxt, pi) => {
      const ps = Object.assign({}, DEF_PARA, t.paras[pi]);
      const a = start, b = start + ptxt.length;
      const firstStyle = a < N ? styles[a] : (a > 0 ? styles[a - 1] : (t.runs[0] && t.runs[0].s) || DEF_STYLE);
      const maxW = box ? Math.max(1, box.w - ps.indL - ps.indR) : Infinity;
      let ls = a, lineW = 0, first = true, lastBreak = -1, wAtBreak = 0;
      const push = (from, to) => { lines.push({ a: from, b: to, para: pi, ps, first, last: false, fs: firstStyle }); first = false; };
      for (let k = a; k < b; k++) {
        const g = glyphs[k], limit = maxW - (first ? ps.indF : 0);
        if (g.sp) { lastBreak = k; wAtBreak = lineW; }
        if (box && !g.sp && lineW + g.adv > limit && k > ls) {
          if (lastBreak >= ls && lastBreak < k) { push(ls, lastBreak + 1); ls = lastBreak + 1; lineW = 0; for (let q = ls; q < k; q++) lineW += glyphs[q].adv; }
          else { push(ls, k); ls = k; lineW = 0; }
          lastBreak = -1; void wAtBreak;
        }
        lineW += g.adv;
      }
      push(ls, b);
      lines[lines.length - 1].last = true;
      start = b + 1;
      p++;
    });
    void p;
    // métricas verticais
    let y = 0;
    lines.forEach((ln, li) => {
      let asc = 0, desc = 0, lead = 0;
      const chars = [];
      for (let k = ln.a; k < ln.b; k++) chars.push(glyphs[k]);
      const ref = chars.length ? chars : [{ s: ln.fs, size: ln.fs.size, rise: 0 }];
      ref.forEach((g) => {
        const fm = metrics(g.s.font, g.s.weight, g.s.italic), vk = g.s.vScale / 100;
        asc = Math.max(asc, g.size * fm.asc * vk + Math.max(0, g.rise));
        desc = Math.max(desc, g.size * fm.desc * vk - Math.min(0, g.rise));
        lead = Math.max(lead, g.s.leading > 0 ? g.s.leading : g.s.size * 1.2);
      });
      if (li === 0) y = box ? asc : 0;
      else { y += lead; if (ln.first) y += ln.ps.spB + (lines[li - 1].ps.spA || 0); }
      ln.asc = asc; ln.desc = desc; ln.lead = lead; ln.y = y;
      // largura útil (sem espaços finais)
      let e = ln.b; while (e > ln.a && glyphs[e - 1].sp) e--;
      let w = 0; for (let k = ln.a; k < e; k++) w += glyphs[k].adv;
      ln.w = w;
      // alinhamento
      const ps = ln.ps, al = ps.align || 'left';
      const ind = ps.indL + (ln.first ? ps.indF : 0);
      let x0 = 0, extra = 0;
      const justify = /^justify/.test(al) && box && (!ln.last || al === 'justify-all');
      const base = al === 'center' || al === 'justify-center' ? 'center' : al === 'right' || al === 'justify-right' ? 'right' : 'left';
      if (box) {
        const avail = box.w - ps.indL - ps.indR - (ln.first ? ps.indF : 0);
        if (justify) { let spaces = 0; for (let k = ln.a; k < e; k++) if (glyphs[k].sp) spaces++; extra = spaces ? (avail - w) / spaces : 0; x0 = ind; }
        else x0 = base === 'left' ? ind : base === 'center' ? ind + (avail - w) / 2 : ind + avail - w;
      } else x0 = base === 'left' ? ind : base === 'center' ? -w / 2 : -w - ps.indR;
      let x = x0;
      ln.xs = [];
      for (let k = ln.a; k < ln.b; k++) { const g = glyphs[k]; ln.xs.push(x); g.x = x; g.line = li; g.w = g.adv + (g.sp && k < e ? extra : 0); x += g.w; }
      ln.xs.push(x);
    });
    // caixa de texto: linhas que não cabem ficam ocultas (excesso)
    if (box) lines.forEach((ln, li) => { ln.hidden = li > 0 && ln.y + ln.desc > box.h + 0.5; });
    // vertical: linhas viram colunas da direita para a esquerda
    if (vert) {
      lines.forEach((ln, li) => {
        const cx = -li * (ln.lead || 0);
        for (let k = ln.a; k < ln.b; k++) { const g = glyphs[k]; g.vx = cx; g.vy = g.x; }
        ln.cx = cx;
      });
    }
    // limites locais
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    const grow = (x0, y0, x1, y1) => { bx0 = Math.min(bx0, x0); by0 = Math.min(by0, y0); bx1 = Math.max(bx1, x1); by1 = Math.max(by1, y1); };
    lines.forEach((ln) => {
      if (ln.hidden) return;
      if (vert) { const half = (ln.lead || ln.fs.size) / 2; grow(ln.cx - half, (ln.xs[0] || 0), ln.cx + half, Math.max(ln.xs[ln.xs.length - 1] || 0, (ln.xs[0] || 0) + ln.fs.size)); }
      else grow(ln.xs[0], ln.y - ln.asc, Math.max(ln.xs[ln.xs.length - 1], ln.xs[0] + 1), ln.y + ln.desc);
    });
    if (box) grow(0, 0, box.w, box.h);
    if (!isFinite(bx0)) { bx0 = 0; by0 = -10; bx1 = 1; by1 = 10; }
    return { lines, glyphs, bounds: { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 }, vert, box };
  }

  /* ==================================================================
     DESENHO
     ================================================================== */
  function drawText(ctx, t, lay, o = {}) {
    const vert = lay.vert;
    lay.lines.forEach((ln) => {
      if (ln.hidden) return;
      // agrupa caracteres consecutivos de mesmo estilo e sem espaço justificado
      let k = ln.a;
      while (k < ln.b) {
        const g0 = lay.glyphs[k];
        if (g0.sp && !g0.s.underline && !g0.s.strike) { k++; continue; }
        let j = k + 1;
        if (!vert && g0.s.caps !== 'small' && g0.s.pos === 'normal') while (j < ln.b && lay.glyphs[j].s === g0.s && !lay.glyphs[j].sp && !g0.sp) j++;
        const s = g0.s, str = lay.glyphs.slice(k, j).map((g) => g.dc).join('');
        const x = vert ? g0.vx : g0.x, by = vert ? g0.vy : ln.y;
        ctx.save();
        ctx.font = fontCSS(s, g0.size);
        if (hasLS) ctx.letterSpacing = ((s.tracking / 1000) * s.size) / (s.hScale / 100) + 'px';
        if ('fontKerning' in ctx) ctx.fontKerning = s.kern === 'none' ? 'none' : 'normal';
        ctx.fillStyle = o.color || s.color; ctx.strokeStyle = o.color || s.color;
        ctx.textBaseline = vert ? 'top' : 'alphabetic';
        if (vert) {
          ctx.textAlign = 'center';
          ctx.translate(x, by);
          if (!g0.sp) ctx.fillText(str, 0, 0);
        } else {
          ctx.textAlign = 'left';
          ctx.translate(x, by - g0.rise);
          if (s.fauxItalic) ctx.transform(1, 0, -0.21, 1, 0, 0);
          ctx.scale(s.hScale / 100, s.vScale / 100);
          if (!g0.sp) {
            if (s.fauxBold) { ctx.lineWidth = g0.size * 0.035; ctx.lineJoin = 'round'; ctx.strokeText(str, 0, 0); }
            ctx.fillText(str, 0, 0);
          }
        }
        ctx.restore();
        if (!vert && (s.underline || s.strike)) {
          let w = 0; for (let q = k; q < j; q++) w += lay.glyphs[q].w;
          const th = Math.max(1, s.size / 16);
          ctx.fillStyle = o.color || s.color;
          if (s.underline) ctx.fillRect(x, by + s.size * 0.1, w, th);
          if (s.strike) ctx.fillRect(x, by - s.size * 0.3, w, th);
        }
        k = j;
      }
    });
  }

  /* ---------- texto em demarcador ---------- */
  function pathPoly(path) {
    const sub = path.subs[0]; if (!sub) return null;
    const pts = [];
    IMG.Paths.eachSeg(sub, (a, b) => { const n = 24; for (let i = 0; i < n; i++) pts.push(IMG.Paths.segPt(a, b, i / n)); });
    const last = sub.closed ? sub.pts[0] : sub.pts[sub.pts.length - 1];
    if (last) pts.push({ x: last.x, y: last.y });
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { pts, L, total: L[L.length - 1] };
  }
  function pathAt(pp, s) {
    s = U.clamp(s, 0, pp.total);
    let lo = 0, hi = pp.L.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pp.L[mid] <= s) lo = mid; else hi = mid; }
    const a = pp.pts[lo], b = pp.pts[hi], seg = pp.L[hi] - pp.L[lo] || 1, t = (s - pp.L[lo]) / seg;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  /* ==================================================================
     TEXTO (API)
     ================================================================== */
  const Text = (IMG.Text = {
    Model, DEF_STYLE, DEF_PARA, layout, edit: null, Fonts,
    normalize(t, L) { return Model.normalize(t, L); },
    defaults() { return Model.normalize({ text: '', runs: [{ n: 0, s: Object.assign({}, DEF_STYLE) }], paras: [Object.assign({}, DEF_PARA)], x: 0, y: 0, box: null, orient: 'h', m: [1, 0, 0, 1], warp: null, aa: 'smooth', onPath: null, auto: true }); },

    /** Matriz local → documento. */
    matrix(t) { const m = t.m || [1, 0, 0, 1]; return new DOMMatrix([m[0], m[1], m[2], m[3], t.x, t.y]); },

    /** Renderiza a camada (pixels) a partir do modelo. */
    render(L) {
      if (!L.text) return;
      const t = L.text = Model.normalize(L.text, L);
      const lay = layout(t);
      L._lay = lay;
      let c, M;
      if (t.onPath && t.onPath.path) { this.renderOnPath(L, t, lay); return; }
      const pad = Math.ceil(Math.max(4, ...t.runs.map((r) => r.s.size)) * 0.5) + 4;
      const b = lay.bounds, bx = Math.floor(b.x - pad), by = Math.floor(b.y - pad), bw = Math.ceil(b.w + pad * 2), bh = Math.ceil(b.h + pad * 2);
      c = U.createCanvas(Math.max(1, bw), Math.max(1, bh));
      const x = c.getContext('2d');
      x.translate(-bx, -by);
      drawText(x, t, lay);
      if (t.aa === 'none') IMG.Selection.hardenCanvas(c);
      let ox = bx, oy = by;
      // deformação de texto
      if (t.warp && t.warp.style && t.warp.style !== 'none') {
        const w = t.warp, src = c, W = src.width, H = src.height;
        const sbx = b.x, sby = b.y, sbw = Math.max(1, b.w), sbh = Math.max(1, b.h);
        const map = (px, py) => { const u = ((px - sbx) / sbw) * 2 - 1, v = ((py - sby) / sbh) * 2 - 1; const q = IMG.warpPreset(w.style, u, v, w.bend / 100, (w.h || 0) / 100, (w.v || 0) / 100, w.vertical); return { x: sbx + (q.x + 1) / 2 * sbw, y: sby + (q.y + 1) / 2 * sbh }; };
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let j = 0; j <= 16; j++) for (let i = 0; i <= 16; i++) { const q = map(bx + (i / 16) * W, by + (j / 16) * H); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
        x0 = Math.floor(x0) - 2; y0 = Math.floor(y0) - 2;
        const wc = U.createCanvas(Math.max(1, Math.ceil(x1 - x0) + 4), Math.max(1, Math.ceil(y1 - y0) + 4));
        IMG.drawMesh(wc.getContext('2d'), src, 32, 16, (i, j) => ({ x: (i / 32) * W, y: (j / 16) * H }), (i, j) => { const q = map(bx + (i / 32) * W, by + (j / 16) * H); return { x: q.x - x0, y: q.y - y0 }; }, 0.5);
        c = wc; ox = x0; oy = y0;
      }
      // transformação linear + posição
      M = this.matrix(t);
      const ident = Math.abs(M.a - 1) < 1e-9 && Math.abs(M.d - 1) < 1e-9 && Math.abs(M.b) < 1e-9 && Math.abs(M.c) < 1e-9;
      if (ident) { L.setCanvas(c, Math.round(M.e + ox), Math.round(M.f + oy)); const fx = M.e + ox - Math.round(M.e + ox), fy = M.f + oy - Math.round(M.f + oy); void fx; void fy; }
      else {
        const pts = [[ox, oy], [ox + c.width, oy], [ox + c.width, oy + c.height], [ox, oy + c.height]].map(([px, py]) => M.transformPoint(new DOMPoint(px, py)));
        const X0 = Math.floor(Math.min(...pts.map((q) => q.x))), Y0 = Math.floor(Math.min(...pts.map((q) => q.y)));
        const out = U.createCanvas(Math.max(1, Math.ceil(Math.max(...pts.map((q) => q.x))) - X0), Math.max(1, Math.ceil(Math.max(...pts.map((q) => q.y))) - Y0)), o = out.getContext('2d');
        o.setTransform(M.a, M.b, M.c, M.d, M.e - X0, M.f - Y0); o.imageSmoothingQuality = 'high';
        o.drawImage(c, ox, oy);
        L.setCanvas(out, X0, Y0);
      }
      if (t.auto) L.name = (t.text.split('\n')[0].trim().slice(0, 28)) || 'Texto';
      IMG.Effects && IMG.Effects.invalidate(L);
    },

    renderOnPath(L, t, lay) {
      const pp = pathPoly(t.onPath.path);
      if (!pp) { L.setCanvas(U.createCanvas(1, 1), 0, 0); return; }
      const ln = lay.lines[0] || { a: 0, b: 0 };
      const glyphs = lay.glyphs.slice(ln.a, ln.b).filter(Boolean);
      const al = (t.paras[0] || DEF_PARA).align;
      const totalW = glyphs.reduce((a, g) => a + g.w, 0);
      const startS = (t.onPath.off || 0) + (al === 'center' ? (pp.total - totalW) / 2 : al === 'right' ? pp.total - totalW : 0);
      const place = [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      let s = startS;
      glyphs.forEach((g) => {
        const mid = s + g.w / 2;
        if (!t.onPath.path.subs[0].closed && (mid < 0 || mid > pp.total)) { s += g.w; return; }
        const q = pathAt(pp, ((mid % pp.total) + pp.total) % pp.total);
        place.push({ g, q, s });
        const r = g.s.size * 1.2;
        x0 = Math.min(x0, q.x - r); y0 = Math.min(y0, q.y - r); x1 = Math.max(x1, q.x + r); y1 = Math.max(y1, q.y + r);
        s += g.w;
      });
      if (!place.length) { L.setCanvas(U.createCanvas(1, 1), Math.round(t.x), Math.round(t.y)); L._pathPlace = []; return; }
      x0 = Math.floor(x0); y0 = Math.floor(y0);
      const c = U.createCanvas(Math.max(1, Math.ceil(x1 - x0)), Math.max(1, Math.ceil(y1 - y0))), x = c.getContext('2d');
      place.forEach(({ g, q }) => {
        if (g.sp) return;
        x.save(); x.translate(q.x - x0, q.y - y0); x.rotate(q.a);
        x.font = fontCSS(g.s, g.size); x.fillStyle = g.s.color; x.textBaseline = 'alphabetic'; x.textAlign = 'center';
        x.scale(g.s.hScale / 100, g.s.vScale / 100);
        x.fillText(g.dc, 0, -(g.rise || 0));
        x.restore();
      });
      L._pathPlace = place; L._pathPoly = pp;
      L.setCanvas(c, x0, y0);
      if (t.auto) L.name = (t.text.split('\n')[0].trim().slice(0, 28)) || 'Texto';
      IMG.Effects && IMG.Effects.invalidate(L);
    },

    /** Camada de texto ativa (ou em edição). */
    current() { if (this.edit) return this.edit.L; const doc = IMG.app.doc, L = doc && doc.active; return L && L.type === 'text' ? L : null; },

    /** Intervalo afetado pelos painéis: seleção durante a edição ou o texto todo. */
    range() {
      const e = this.edit;
      if (e) { const a = Math.min(e.caret, e.anchor), b = Math.max(e.caret, e.anchor); return { a, b }; }
      const L = this.current(); if (L) { L.text = Model.normalize(L.text, L); return { a: 0, b: L.text.text.length }; }
      return null;
    },
    /** Valor de uma propriedade de caractere/parágrafo para os painéis. */
    get(key, para) {
      const L = this.current(), r = this.range();
      if (L && r) {
        const t = L.text;
        if (this.edit && r.a === r.b && !para) return (this.edit.typing || Model.caretStyle(t, r.a))[key];
        return Model.common(t, r.a, r.b, key, para);
      }
      const o = IMG.Tools.o('text');
      const base = para ? Object.assign({}, DEF_PARA, o.para || {}) : Object.assign({}, DEF_STYLE, o.style || {}, { color: (o.style && o.style.color) || IMG.app.fg });
      return base[key];
    },
    /** Altera propriedades (patch) de caractere ou de parágrafo. */
    set(patch, para, final = true) {
      const L = this.current(), r = this.range();
      if (!L || !r) {
        const o = IMG.Tools.o('text');
        const k = para ? 'para' : 'style';
        IMG.Tools.setOpt('text', k, Object.assign({}, o[k] || {}, patch), true);
        bus.emit('text:change', 'tool');
        return;
      }
      const t = L.text;
      if (para) Model.applyPara(t, r.a, r.b, patch);
      else if (this.edit && r.a === r.b) { this.edit.typing = Object.assign({}, this.edit.typing || Model.caretStyle(t, r.a), patch); if (!t.text.length) Object.assign(t.runs[0].s, patch); }
      else Model.applyStyle(t, r.a, r.b, patch);
      this.render(L);
      IMG.Engine.invalidate();
      if (this.edit) this.edit.dirty = true;
      else if (final) { bus.emit('layer:pixels', L); IMG.commit('Formatar texto'); }
      bus.emit('text:change', 'value');
    },
    /** Altera propriedades da camada de texto (orientação, deformação, suavização…). */
    setLayer(patch, label) {
      const L = this.current(); if (!L) { if (patch.aa) IMG.Tools.setOpt('text', 'aa', patch.aa); return; }
      Object.assign(L.text, patch);
      this.render(L); IMG.Engine.invalidate();
      if (!this.edit) { bus.emit('layer:pixels', L); IMG.commit(label || 'Formatar texto'); } else this.edit.dirty = true;
    },

    /* ---------- conversão ponto ↔ caixa ---------- */
    toBox(L) {
      const t = L.text = Model.normalize(L.text, L); if (t.box || t.onPath) return;
      const lay = layout(t), b = lay.bounds;
      const al = (t.paras[0] || DEF_PARA).align;
      const first = lay.lines[0];
      const p = this.matrix(t).transformPoint(new DOMPoint(b.x, b.y));
      t.x = p.x; t.y = p.y; t.box = { w: Math.ceil(b.w) + 2, h: Math.ceil(b.h) + 2 };
      void al; void first;
      this.render(L);
    },
    toPoint(L) {
      const t = L.text = Model.normalize(L.text, L); if (!t.box) return;
      const lay = layout(t), first = lay.lines[0];
      const lx = first ? first.xs[0] : 0, ly = first ? first.y : 0;
      const al = (t.paras[0] || DEF_PARA).align, w = t.box.w;
      const ax = al === 'center' ? w / 2 : al === 'right' ? w : lx;
      const p = this.matrix(t).transformPoint(new DOMPoint(ax, ly));
      // quebras automáticas viram quebras de linha
      const parts = []; lay.lines.forEach((ln, i) => { parts.push(t.text.slice(ln.a, ln.b).replace(/\s+$/, '')); if (i < lay.lines.length - 1 && !lay.lines[i + 1].first) parts.push('\n'); else if (i < lay.lines.length - 1) parts.push('\n'); });
      t.box = null; t.x = p.x; t.y = p.y;
      this.render(L);
    },

    /** Cola texto como nova camada no centro da vista. */
    pasteAsLayer(txt) {
      const doc = IMG.app.doc; if (!doc) return;
      const o = IMG.Tools.o('text'), s = Object.assign({}, DEF_STYLE, o.style || {}, { color: (o.style && o.style.color) || IMG.app.fg });
      const L = new IMG.Layer('text', { name: 'Texto' });
      const str = String(txt).replace(/\r\n?/g, '\n');
      L.text = Model.normalize({ text: str, runs: [{ n: str.length, s }], paras: str.split('\n').map(() => Object.assign({}, DEF_PARA, o.para || {})), x: doc.width / 2, y: doc.height / 2, box: null, orient: 'h', m: [1, 0, 0, 1], aa: o.aa || 'smooth', auto: true });
      L.text.paras.forEach((p) => { p.align = 'center'; });
      Layers.add(doc, L); this.render(L);
      bus.emit('layers:change', doc); IMG.commit('Colar texto');
    },

    /* ---------- texto → demarcador / forma (contorno rasterizado em alta resolução) ---------- */
    outline(L) {
      const doc = IMG.app.doc;
      const k = 4, b = L.contentBounds(); if (!b) return null;
      const W = b.w * k + 8, H = b.h * k + 8;
      if (W * H > 40e6) { IMG.UI.toast('Texto grande demais para converter.'); return null; }
      const big = U.createCanvas(W, H), x = big.getContext('2d');
      x.setTransform(k, 0, 0, k, 4 - b.x * k, 4 - b.y * k);
      // renderiza o texto ampliado
      const t = L.text, tmp = new IMG.Layer('text', {}); tmp.text = JSON.parse(JSON.stringify(t));
      tmp.text.x *= k; tmp.text.y *= k; tmp.text.runs.forEach((r) => { r.s.size *= k; r.s.leading *= k; r.s.shift *= k; });
      tmp.text.paras.forEach((p) => { p.indL *= k; p.indR *= k; p.indF *= k; p.spB *= k; p.spA *= k; });
      if (tmp.text.box) tmp.text.box = { w: tmp.text.box.w * k, h: tmp.text.box.h * k };
      if (tmp.text.onPath) IMG.Paths.map(tmp.text.onPath.path, (px, py) => ({ x: px * k, y: py * k }));
      this.render(tmp);
      x.setTransform(1, 0, 0, 1, 4 - b.x * k, 4 - b.y * k);
      x.drawImage(tmp.canvas, tmp.x, tmp.y);
      const sel = IMG.newSelectionObject(W, H);
      const sx = sel.canvas.getContext('2d'); sx.drawImage(big, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#fff'; sx.fillRect(0, 0, W, H);
      sel.bounds = { x: 0, y: 0, w: W, h: H };
      const fake = { width: W, height: H, selection: sel, rect: { x: 0, y: 0, w: W, h: H } };
      const p = IMG.Paths.fromSelection(fake, 1.2);
      if (!p) return null;
      IMG.Paths.map(p, (px, py) => ({ x: (px - 4) / k + b.x, y: (py - 4) / k + b.y }));
      void doc;
      return p;
    }
  });

  /* integração com transformações */
  IMG.vectorTransform = IMG.vectorTransform || {};
  IMG.vectorTransform.text = (L, M) => {
    const t = L.text = Model.normalize(L.text, L);
    if (t.onPath && t.onPath.path) { IMG.Paths.matrix(t.onPath.path, M); }
    const p = M.transformPoint(new DOMPoint(t.x, t.y));
    const m = t.m || [1, 0, 0, 1];
    t.m = [M.a * m[0] + M.c * m[1], M.b * m[0] + M.d * m[1], M.a * m[2] + M.c * m[3], M.b * m[2] + M.d * m[3]];
    t.x = p.x; t.y = p.y;
    Text.render(L);
  };
  IMG.vectorTransform.textFlip = IMG.vectorTransform.text;
  IMG.vectorTransformFn = IMG.vectorTransformFn || {};

  /* ==================================================================
     EDITOR NA TELA
     ================================================================== */
  const Editor = {
    start(L, isNew, caretAt) {
      if (Text.edit) this.commit();
      const t = L.text = Model.normalize(L.text, L);
      const ta = el('textarea.text-input', { spellcheck: false, autocomplete: 'off', 'aria-label': 'Texto da camada' });
      IMG.Engine.vp.appendChild(ta);
      const n = t.text.length;
      Text.edit = { L, isNew, ta, orig: JSON.parse(JSON.stringify(t)), name: L.name, caret: caretAt == null ? n : caretAt, anchor: caretAt == null ? (isNew ? n : 0) : caretAt, typing: null, blink: 0, dirty: false };
      ta.addEventListener('keydown', (e) => this.key(e));
      ta.addEventListener('input', (e) => this.input(e));
      ta.addEventListener('compositionend', (e) => { this.insert(e.data || ''); ta.value = ''; });
      ta.addEventListener('copy', (e) => { const s = this.selText(); if (s) { e.preventDefault(); e.clipboardData.setData('text/plain', s); } });
      ta.addEventListener('cut', (e) => { const s = this.selText(); if (s) { e.preventDefault(); e.clipboardData.setData('text/plain', s); this.delSel(); } });
      ta.addEventListener('paste', (e) => { e.preventDefault(); const s = (e.clipboardData.getData('text/plain') || '').replace(/\r\n?/g, '\n'); this.insert(s); });
      ta.addEventListener('blur', () => { /* mantém a edição até clicar fora da tela */ });
      clearInterval(this._blink);
      this._blink = setInterval(() => { if (!Text.edit) return; Text.edit.blink++; IMG.Engine.requestRender(); }, 530);
      Text.render(L);
      this.place();
      setTimeout(() => ta.focus(), 0);
      bus.emit('text:change'); IMG.UI.renderOptions();
      IMG.Engine.requestRender();
    },
    t() { return Text.edit.L.text; },
    sel() { const e = Text.edit; return { a: Math.min(e.caret, e.anchor), b: Math.max(e.caret, e.anchor) }; },
    selText() { const { a, b } = this.sel(); return this.t().text.slice(a, b); },
    changed() {
      const e = Text.edit; e.dirty = true; e.blink = 0;
      Text.render(e.L); IMG.Engine.invalidate(); this.place();
      bus.emit('text:change', 'value');
    },
    insert(str) {
      const e = Text.edit; if (!e || !str) return;
      const { a, b } = this.sel(), t = this.t();
      const st = e.typing || Model.caretStyle(t, a);
      if (b > a) Model.remove(t, a, b);
      Model.insert(t, a, str, st);
      e.caret = e.anchor = a + str.length; e.typing = null;
      this.changed();
    },
    delSel() { const { a, b } = this.sel(); if (b > a) { Model.remove(this.t(), a, b); Text.edit.caret = Text.edit.anchor = a; this.changed(); return true; } return false; },
    input(ev) {
      const ta = Text.edit && Text.edit.ta; if (!ta) return;
      if (ev.isComposing) return;
      const v = ta.value; ta.value = '';
      if (v) this.insert(v.replace(/\r\n?/g, '\n'));
    },
    /** Posição (local) do cursor de inserção. */
    caretPos(i) {
      const L = Text.edit.L, lay = L._lay || layout(L.text);
      for (let li = 0; li < lay.lines.length; li++) {
        const ln = lay.lines[li];
        const endIdx = ln.b + (ln.last ? 0 : 0);
        if (i >= ln.a && (i < endIdx || (i === endIdx && (ln.last || li === lay.lines.length - 1 || lay.lines[li + 1].a > i)))) {
          const x = ln.xs[Math.min(ln.xs.length - 1, i - ln.a)];
          if (lay.vert) return { x: ln.cx, y: x, h: ln.lead || ln.fs.size, line: li, vert: true };
          return { x, y: ln.y, asc: ln.asc || ln.fs.size * 0.8, desc: ln.desc || ln.fs.size * 0.2, line: li };
        }
      }
      const ln = lay.lines[lay.lines.length - 1];
      return { x: ln.xs[ln.xs.length - 1], y: ln.y, asc: ln.asc, desc: ln.desc, line: lay.lines.length - 1 };
    },
    /** Índice de caractere no ponto local (x, y). */
    hit(x, y) {
      const L = Text.edit ? Text.edit.L : null; if (!L) return 0;
      const lay = L._lay || layout(L.text);
      let li = 0;
      if (lay.vert) { let bd = Infinity; lay.lines.forEach((ln, i) => { const d = Math.abs(ln.cx - x); if (d < bd) { bd = d; li = i; } }); }
      else { let bd = Infinity; lay.lines.forEach((ln, i) => { const top = ln.y - ln.asc, bot = ln.y + ln.desc; const d = y < top ? top - y : y > bot ? y - bot : 0; if (d < bd) { bd = d; li = i; } }); }
      const ln = lay.lines[li], q = lay.vert ? y : x;
      let best = ln.a, bd = Infinity;
      for (let k = 0; k < ln.xs.length; k++) { const idx = ln.a + k; if (idx > ln.b) break; if (!ln.last && idx === ln.b && k > 0 && /\s/.test(L.text.text[idx - 1] || '')) { /* fim de linha quebrada */ } const d = Math.abs(ln.xs[k] - q); if (d < bd) { bd = d; best = idx; } }
      return best;
    },
    toLocal(L, x, y) { return Text.matrix(L.text).inverse().transformPoint(new DOMPoint(x, y)); },
    /** Posiciona o campo oculto perto do cursor (janela de composição de IME). */
    place() {
      const e = Text.edit; if (!e) return;
      const c = this.caretPos(e.caret), M = Text.matrix(e.L.text), p = M.transformPoint(new DOMPoint(c.x, c.y)), s = IMG.Engine.d2s(p.x, p.y);
      Object.assign(e.ta.style, { transform: 'translate(' + s.x + 'px,' + s.y + 'px)' });
    },
    move(i, shift) { const e = Text.edit, n = this.t().text.length; e.caret = U.clamp(i, 0, n); if (!shift) e.anchor = e.caret; e.blink = 0; e.typing = null; this.place(); IMG.Engine.requestRender(); bus.emit('text:change', 'caret'); },
    lineOf(i) { return this.caretPos(i).line; },
    key(e) {
      const ed = Text.edit; if (!ed) return;
      const t = this.t(), n = t.text.length, ctrl = e.ctrlKey || e.metaKey, k = e.key;
      e.stopPropagation();
      const lay = ed.L._lay || layout(t);
      const vert = lay.vert;
      if (k === 'Escape') { e.preventDefault(); this.commit(); return; }
      if (k === 'Enter' && ctrl) { e.preventDefault(); this.commit(); return; }
      if (k === 'Enter' && e.code === 'NumpadEnter') { e.preventDefault(); this.commit(); return; }
      if (k === 'Enter') { e.preventDefault(); this.insert('\n'); return; }
      if (k === 'Backspace') { e.preventDefault(); if (!this.delSel() && ed.caret > 0) { let a = ed.caret - 1; if (ctrl) { while (a > 0 && /\s/.test(t.text[a])) a--; while (a > 0 && !/\s/.test(t.text[a - 1])) a--; } Model.remove(t, a, ed.caret); ed.caret = ed.anchor = a; this.changed(); } return; }
      if (k === 'Delete') { e.preventDefault(); if (!this.delSel() && ed.caret < n) { let b = ed.caret + 1; if (ctrl) { while (b < n && !/\s/.test(t.text[b])) b++; } Model.remove(t, ed.caret, b); this.changed(); } return; }
      const horiz = (d) => { if (!e.shiftKey && ed.caret !== ed.anchor) { this.move(d < 0 ? Math.min(ed.caret, ed.anchor) : Math.max(ed.caret, ed.anchor), false); return; } let i = ed.caret + d; if (ctrl) { if (d < 0) { while (i > 0 && /\s/.test(t.text[i])) i--; while (i > 0 && !/\s/.test(t.text[i - 1])) i--; } else { while (i < n && !/\s/.test(t.text[i])) i++; while (i < n && /\s/.test(t.text[i])) i++; } } this.move(i, e.shiftKey); };
      const vline = (d) => {
        const c = this.caretPos(ed.caret), li = c.line + d;
        if (li < 0) { this.move(0, e.shiftKey); return; }
        if (li >= lay.lines.length) { this.move(n, e.shiftKey); return; }
        const ln = lay.lines[li];
        const q = vert ? c.y : c.x;
        let best = ln.a, bd = Infinity; ln.xs.forEach((x, kk) => { const d2 = Math.abs(x - q); if (d2 < bd && ln.a + kk <= ln.b) { bd = d2; best = ln.a + kk; } });
        this.move(best, e.shiftKey);
      };
      // atalhos de formatação do Photoshop
      if (ctrl && e.shiftKey && !e.altKey) {
        const map = { B: { fauxBold: !Text.get('fauxBold') }, I: { fauxItalic: !Text.get('fauxItalic') }, U: { underline: !Text.get('underline') }, '/': { strike: !Text.get('strike') }, K: { caps: Text.get('caps') === 'all' ? 'none' : 'all' }, H: { caps: Text.get('caps') === 'small' ? 'none' : 'small' } };
        const kk = k.length === 1 ? k.toUpperCase() : k;
        if (map[kk]) { e.preventDefault(); Text.set(map[kk], false); return; }
        if (kk === 'L' || kk === 'C' || kk === 'R' || kk === 'J' || kk === 'F') { e.preventDefault(); Text.set({ align: { L: 'left', C: 'center', R: 'right', J: 'justify-left', F: 'justify-all' }[kk] }, true); return; }
        if (k === '>' || k === '.' || k === '<' || k === ',') { e.preventDefault(); const up = k === '>' || k === '.'; const cur = Text.get('size') || 12; Text.set({ size: Math.max(0.5, cur + (up ? 2 : -2)) }, false); return; }
        if (k === '+' || k === '=') { e.preventDefault(); Text.set({ pos: Text.get('pos') === 'super' ? 'normal' : 'super' }, false); return; }
      }
      if (ctrl && e.altKey && e.shiftKey && (k === '+' || k === '=')) { e.preventDefault(); Text.set({ pos: Text.get('pos') === 'sub' ? 'normal' : 'sub' }, false); return; }
      if (e.altKey && !ctrl && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); const cur = Text.get('tracking') || 0; Text.set({ tracking: cur + (k === 'ArrowRight' ? 20 : -20) * (e.shiftKey ? 5 : 1) }, false); return; }
      if (e.altKey && !ctrl && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); const sz = Text.get('size') || 12, cur = Text.get('leading') || sz * 1.2; Text.set({ leading: Math.max(1, cur + (k === 'ArrowDown' ? 2 : -2)) }, false); return; }
      if (ctrl && !e.shiftKey && (k === 'a' || k === 'A')) { e.preventDefault(); ed.anchor = 0; this.move(n, true); return; }
      if (k === 'ArrowLeft') { e.preventDefault(); if (vert) vline(1); else horiz(-1); return; }
      if (k === 'ArrowRight') { e.preventDefault(); if (vert) vline(-1); else horiz(1); return; }
      if (k === 'ArrowUp') { e.preventDefault(); if (vert) horiz(-1); else vline(-1); return; }
      if (k === 'ArrowDown') { e.preventDefault(); if (vert) horiz(1); else vline(1); return; }
      if (k === 'Home') { e.preventDefault(); const ln = lay.lines[this.caretPos(ed.caret).line]; this.move(ctrl ? 0 : ln.a, e.shiftKey); return; }
      if (k === 'End') { e.preventDefault(); const ln = lay.lines[this.caretPos(ed.caret).line]; let b = ln.b; if (!ln.last && b > ln.a && /\s/.test(t.text[b - 1])) b--; this.move(ctrl ? n : b, e.shiftKey); return; }
      if (k === 'Tab') { e.preventDefault(); this.insert('\t'); return; }
    },
    commit() {
      const e = Text.edit; if (!e) return;
      const doc = IMG.app.doc, L = e.L;
      this.close();
      const t = L.text;
      if (!t.text.trim() && !t.box) {
        if (Layers.find(doc, L.id)) { Layers.remove(doc, L); doc.activeId = null; doc.selected.clear(); const rest = Layers.all(doc); if (rest.length) Layers.setActive(doc, rest[rest.length - 1].id); }
        bus.emit('layers:change', doc);
        if (!e.isNew) IMG.commit('Excluir texto');
      } else {
        Text.render(L);
        bus.emit('layers:change', doc);
        if (e.isNew || e.dirty || JSON.stringify(e.orig) !== JSON.stringify(t)) IMG.commit(e.isNew ? 'Novo texto' : 'Editar texto');
      }
      bus.emit('text:change'); IMG.UI.renderOptions();
    },
    cancel() {
      const e = Text.edit; if (!e) return;
      const doc = IMG.app.doc, L = e.L;
      this.close();
      if (e.isNew) { Layers.remove(doc, L); doc.activeId = null; doc.selected.clear(); const rest = Layers.all(doc); if (rest.length) Layers.setActive(doc, rest[rest.length - 1].id); }
      else { L.text = e.orig; L.name = e.name; Text.render(L); }
      IMG.Engine.invalidate();
      bus.emit('layers:change', doc); bus.emit('text:change'); IMG.UI.renderOptions();
    },
    close() { const e = Text.edit; Text.edit = null; clearInterval(this._blink); if (e && e.ta) e.ta.remove(); IMG.Engine.requestRender(); return e; },

    /** Sobreposição: seleção, cursor e caixa. */
    draw(ctx, v) {
      const e = Text.edit; if (!e) return;
      const L = e.L, t = L.text, lay = L._lay || layout(t), M = Text.matrix(t);
      const V = new DOMMatrix([v.zoom, 0, 0, v.zoom, v.x, v.y]).multiply(M);
      ctx.save();
      ctx.setTransform(ctx.getTransform().multiply(V));
      const px = 1 / (v.zoom * Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)) || 1);
      // caixa
      if (t.box) { ctx.lineWidth = px; ctx.strokeStyle = '#3d8bff'; ctx.setLineDash([4 * px, 3 * px]); ctx.strokeRect(0, 0, t.box.w, t.box.h); ctx.setLineDash([]); ctx.fillStyle = '#fff'; [[0, 0], [t.box.w / 2, 0], [t.box.w, 0], [t.box.w, t.box.h / 2], [t.box.w, t.box.h], [t.box.w / 2, t.box.h], [0, t.box.h], [0, t.box.h / 2]].forEach(([x, y]) => { ctx.fillRect(x - 3 * px, y - 3 * px, 6 * px, 6 * px); ctx.strokeRect(x - 3 * px, y - 3 * px, 6 * px, 6 * px); }); }
      else if (!t.onPath) { const b = lay.bounds; ctx.lineWidth = px; ctx.strokeStyle = 'rgba(61,139,255,.7)'; ctx.setLineDash([4 * px, 3 * px]); ctx.strokeRect(b.x - 2 * px, b.y - 2 * px, b.w + 4 * px, b.h + 4 * px); ctx.setLineDash([]); }
      // seleção
      const { a, b } = this.sel();
      if (b > a && !t.onPath) {
        ctx.fillStyle = 'rgba(61,139,255,.35)';
        lay.lines.forEach((ln) => {
          const s0 = Math.max(a, ln.a), s1 = Math.min(b, ln.b);
          if (s1 <= s0 && !(a <= ln.a && b > ln.b)) return;
          const x0 = ln.xs[s0 - ln.a], x1 = ln.xs[Math.min(ln.xs.length - 1, s1 - ln.a)] + (b > ln.b && !ln.last ? 0 : 0);
          if (lay.vert) ctx.fillRect(ln.cx - ln.lead / 2, x0, ln.lead, x1 - x0);
          else ctx.fillRect(x0, ln.y - ln.asc, Math.max(x1 - x0, 2 * px), ln.asc + ln.desc);
        });
      }
      // cursor
      if (e.blink % 2 === 0 && !t.onPath) {
        const c = this.caretPos(e.caret);
        ctx.fillStyle = '#000'; ctx.strokeStyle = '#fff';
        if (c.vert) ctx.fillRect(c.x - c.h / 2, c.y, c.h, Math.max(px, 1.5 * px));
        else { ctx.fillRect(c.x - 0.5 * px, c.y - c.asc, 1.5 * px, c.asc + c.desc); }
      }
      ctx.restore();
      if (t.onPath && L._pathPoly) {
        ctx.save(); ctx.strokeStyle = '#3d8bff'; ctx.lineWidth = 1; ctx.beginPath();
        L._pathPoly.pts.forEach((q, i) => { const s = { x: v.x + q.x * v.zoom, y: v.y + q.y * v.zoom }; i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); }); ctx.stroke();
        if (e.blink % 2 === 0) { const pl = L._pathPlace || [], idx = e.caret; const g = pl[Math.min(idx, pl.length - 1)]; if (g) { const q = idx >= pl.length ? pathAt(L._pathPoly, g.s + g.g.w) : pathAt(L._pathPoly, g.s); const s = { x: v.x + q.x * v.zoom, y: v.y + q.y * v.zoom }; ctx.translate(s.x, s.y); ctx.rotate(q.a); ctx.fillStyle = '#000'; ctx.fillRect(-0.5, -(g.g.s.size * 0.8) * v.zoom, 1.5, g.g.s.size * v.zoom); } }
        ctx.restore();
      }
    }
  };
  Text.Editor = Editor;
  Text.start = (L, isNew, at) => Editor.start(L, isNew, at);
  Text.commit = () => Editor.commit();
  Text.cancel = () => Editor.cancel();
  Text.editLayer = function (L) {
    if (!L || L.type !== 'text') return;
    if (Layers.isLocked(L)) { IMG.UI.toast('A camada está bloqueada.'); return; }
    IMG.Tools.set(L.text && L.text.orient === 'v' ? 'textV' : 'text');
    Editor.start(L, false, null);
    Text.edit.anchor = 0; Text.edit.caret = L.text.text.length;
  };
  bus.on('view:change', () => { if (Text.edit) Editor.place(); });
  bus.on('doc:change', () => { if (Text.edit) Editor.commit(); });

  /* ==================================================================
     FERRAMENTAS (Texto horizontal / vertical)
     ================================================================== */
  function pickTextLayer(doc, x, y) {
    let hit = null;
    Layers.walk(doc.layers, (L) => {
      if (L.type !== 'text' || !Layers.isVisible(L) || Layers.isLocked(L)) return;
      const t = L.text = Model.normalize(L.text, L);
      if (t.onPath) { const b = L.contentBounds(); if (b && U.rectContains(b, x, y)) hit = L; return; }
      const lay = L._lay || layout(t), p = Text.matrix(t).inverse().transformPoint(new DOMPoint(x, y)), b = t.box ? { x: 0, y: 0, w: t.box.w, h: t.box.h } : U.rectInflate(lay.bounds, 4);
      if (U.rectContains(b, p.x, p.y)) hit = L;
    });
    return hit;
  }
  function makeTextTool(id, name, icon, orient) {
    return {
      id, name, icon, cursor: 'text', noCtrlMove: false,
      defaults: { style: {}, para: {}, aa: 'smooth' },
      hint: 'Clique: texto de ponto · arraste: caixa de texto · sobre um demarcador: texto no demarcador · Ctrl+Enter: concluir · Esc: concluir',
      options() {
        const UI = IMG.UI, g = (k) => Text.get(k);
        const list = [
          { type: 'custom', build: () => UI.iconBtn('textV', 'Alternar orientação do texto', () => { const L = Text.current(); if (L) { Text.setLayer({ orient: L.text.orient === 'v' ? 'h' : 'v', box: null }, 'Orientação do texto'); } else IMG.Tools.set(id === 'text' ? 'textV' : 'text'); }) },
          { type: 'select', value: g('font'), options: Fonts.options(g('font')), width: 160, onChange: (v) => Text.set({ font: v }) },
          { type: 'select', value: styleKey({ weight: g('weight'), italic: g('italic') }), options: STYLES, width: 104, onChange: (v) => Text.set({ weight: parseInt(v, 10), italic: /i$/.test(v) }) },
          { type: 'number', value: g('size'), min: 0.5, max: 3000, decimals: 1, unit: 'px', width: 72, onChange: (v) => Text.set({ size: v }) },
          { type: 'select', label: 'aA', value: (Text.current() ? Text.current().text.aa : IMG.Tools.o(id).aa) || 'smooth', options: [['none', 'Nenhuma'], ['sharp', 'Nítida'], ['crisp', 'Precisa'], ['strong', 'Forte'], ['smooth', 'Suave']], width: 90, onChange: (v) => Text.setLayer({ aa: v }, 'Suavização do texto') },
          { type: 'seg', value: (Text.get('align', true) || 'left').replace('justify-', ''), options: [{ value: 'left', icon: 'alignLeft', title: 'Alinhar à esquerda (Ctrl+Shift+L)' }, { value: 'center', icon: 'alignCenter', title: 'Centralizar (Ctrl+Shift+C)' }, { value: 'right', icon: 'alignRight', title: 'Alinhar à direita (Ctrl+Shift+R)' }], onChange: (v) => Text.set({ align: v }, true) },
          { type: 'color', value: g('color') || IMG.app.fg, title: 'Cor do texto', onChange: (hex, fin) => { if (hex) Text.set({ color: hex }, false, fin); } },
          { type: 'custom', build: () => UI.iconBtn('tWarp', 'Criar texto deformado', () => warpDialog()) },
          { type: 'custom', build: () => UI.iconBtn('character', 'Painéis Caracteres e Parágrafo', () => UI.showPanel('character')) }
        ];
        if (Text.edit) list.push({ type: 'sep' }, { type: 'button', label: 'Cancelar', onClick: () => Editor.cancel() }, { type: 'button', label: 'Concluir', icon: 'check', primary: true, onClick: () => Editor.commit() });
        return list;
      },
      activate() { if (!Fonts._detected) { Fonts._detected = true; setTimeout(() => Fonts.detect(), 30); } },
      deactivate() { if (Text.edit) Editor.commit(); },
      beforeCommand(cid) {
        if (!Text.edit) return false;
        if (/^(view|window|help)\./.test(cid)) return false;
        if (cid === 'edit.undo') { Editor.cancel(); return true; }
        Editor.commit();
        return false;
      },
      down(ev) {
        const doc = IMG.app.doc;
        if (Text.edit) {
          const L = Text.edit.L, t = L.text;
          // alças da caixa de texto
          if (t.box) {
            const p = Editor.toLocal(L, ev.x, ev.y), z = doc.view.zoom * Math.sqrt(Math.abs(t.m[0] * t.m[3] - t.m[1] * t.m[2])), tol = 6 / z;
            const hx = Math.abs(p.x - t.box.w) < tol ? 1 : Math.abs(p.x) < tol ? -1 : 0, hy = Math.abs(p.y - t.box.h) < tol ? 1 : Math.abs(p.y) < tol ? -1 : 0;
            if ((hx || hy) && p.x > -tol && p.y > -tol && p.x < t.box.w + tol && p.y < t.box.h + tol) { this.boxDrag = { hx, hy, x0: t.x, y0: t.y, w0: t.box.w, h0: t.box.h, p0: p }; return; }
          }
          const inside = pickTextLayer(doc, ev.x, ev.y) === L;
          if (inside) {
            const p = Editor.toLocal(L, ev.x, ev.y);
            const i = t.onPath ? Math.min(t.text.length, (L._pathPlace || []).findIndex((g) => Math.hypot(pathAt(L._pathPoly, g.s + g.g.w / 2).x - ev.x, pathAt(L._pathPoly, g.s + g.g.w / 2).y - ev.y) < g.g.s.size) + 1 || t.text.length) : Editor.hit(p.x, p.y);
            const now = Date.now();
            if (this._lastClick && now - this._lastClick.t < 400 && Math.abs(this._lastClick.i - i) <= 1) {
              this._clicks = (this._clicks || 1) + 1;
              const txt = t.text;
              if (this._clicks === 2) { let a = i, b = i; while (a > 0 && /\w/.test(txt[a - 1])) a--; while (b < txt.length && /\w/.test(txt[b])) b++; Text.edit.anchor = a; Editor.move(b, true); }
              else { let a = txt.lastIndexOf('\n', i - 1) + 1, b = txt.indexOf('\n', i); if (b < 0) b = txt.length; Text.edit.anchor = a; Editor.move(b, true); }
            } else { this._clicks = 1; Editor.move(i, ev.shift); }
            this._lastClick = { t: now, i };
            this.selecting = !t.onPath;
            return;
          }
          Editor.commit();
          return false;
        }
        const hit = ev.shift ? null : pickTextLayer(doc, ev.x, ev.y);
        if (hit) {
          Layers.setActive(doc, hit.id);
          const p = Text.matrix(hit.text).inverse().transformPoint(new DOMPoint(ev.x, ev.y));
          Text.render(hit);
          Editor.start(hit, false, 0);
          const i = hit.text.onPath ? hit.text.text.length : Editor.hit(p.x, p.y);
          Text.edit.caret = Text.edit.anchor = i; Editor.place();
          return false;
        }
        this.create = { x: ev.x, y: ev.y, sx: ev.sx, sy: ev.sy, ex: ev.x, ey: ev.y };
      },
      move(ev) {
        if (this.boxDrag && Text.edit) {
          const L = Text.edit.L, t = L.text, d = this.boxDrag, p = Editor.toLocal(L, ev.x, ev.y);
          let w = d.w0, h = d.h0, dx = 0, dy = 0;
          if (d.hx === 1) w = Math.max(4, p.x); if (d.hy === 1) h = Math.max(4, p.y);
          if (d.hx === -1) { w = Math.max(4, d.w0 - p.x + 0); dx = d.w0 - w; } if (d.hy === -1) { h = Math.max(4, d.h0 - p.y); dy = d.h0 - h; }
          const M = Text.matrix(Object.assign({}, t, { x: d.x0, y: d.y0 })), o = M.transformPoint(new DOMPoint(dx, dy));
          t.box = { w, h }; t.x = o.x; t.y = o.y;
          Text.render(L); IMG.Engine.invalidate(); Text.edit.dirty = true;
          return;
        }
        if (this.selecting && Text.edit) { const L = Text.edit.L, p = Editor.toLocal(L, ev.x, ev.y); Editor.move(Editor.hit(p.x, p.y), true); return; }
        if (this.create) { this.create.ex = ev.x; this.create.ey = ev.y; IMG.Engine.requestRender(); }
      },
      up(ev) {
        this.selecting = false;
        if (this.boxDrag) { this.boxDrag = null; return; }
        const c = this.create; this.create = null;
        if (!c) return;
        const doc = IMG.app.doc, o = IMG.Tools.o(id);
        const st = Object.assign({}, DEF_STYLE, o.style || {}, { color: (o.style && o.style.color) || IMG.app.fg });
        const pa = Object.assign({}, DEF_PARA, o.para || {});
        const L = new IMG.Layer('text', { name: 'Texto' });
        const dragged = Math.hypot(ev.sx - c.sx, ev.sy - c.sy) > 6;
        const t = { text: '', runs: [{ n: 0, s: st }], paras: [pa], x: c.x, y: c.y, box: null, orient, m: [1, 0, 0, 1], warp: null, aa: o.aa || 'smooth', onPath: null, auto: true };
        if (dragged && orient === 'h') { const r = U.rectFromPoints(c.x, c.y, c.ex, c.ey); t.x = r.x; t.y = r.y; t.box = { w: Math.max(8, r.w), h: Math.max(8, r.h) }; }
        else if (!dragged) {
          // clique sobre um demarcador: texto no demarcador
          const tg = IMG.Paths.target(doc);
          if (tg && tg.path.subs.length && tg.kind !== 'vmask') {
            const n = IMG.Paths.nearest(tg.path, c.x, c.y);
            if (n && n.d * doc.view.zoom <= 6) {
              const sub = JSON.parse(JSON.stringify(tg.path.subs[n.sub]));
              const pp = pathPoly({ subs: [sub] });
              let off = 0; if (pp) { let bd = Infinity; pp.pts.forEach((q, k) => { const d = Math.hypot(q.x - n.x, q.y - n.y); if (d < bd) { bd = d; off = pp.L[k]; } }); }
              t.onPath = { path: { subs: [sub], rule: 'nonzero' }, off }; t.x = 0; t.y = 0;
            }
          }
          if (!t.onPath && orient === 'v') { t.y = c.y; }
        }
        L.text = t;
        Layers.add(doc, L);
        Text.render(L);
        bus.emit('layers:change', doc);
        Editor.start(L, true, 0);
      },
      hover(ev) {
        const doc = IMG.app.doc;
        if (Text.edit && Text.edit.L.text.box) {
          const L = Text.edit.L, t = L.text, p = Editor.toLocal(L, ev.x, ev.y), tol = 6 / doc.view.zoom;
          const onH = (Math.abs(p.x) < tol || Math.abs(p.x - t.box.w) < tol || Math.abs(p.y) < tol || Math.abs(p.y - t.box.h) < tol) && p.x > -tol && p.y > -tol && p.x < t.box.w + tol && p.y < t.box.h + tol;
          if (onH) { T().cursor('move'); return; }
        }
        let c = 'text';
        if (!Text.edit) { const tg = IMG.Paths.target(doc); if (tg && tg.kind !== 'vmask' && tg.path.subs.length) { const n = IMG.Paths.nearest(tg.path, ev.x, ev.y); if (n && n.d * doc.view.zoom <= 6) c = 'cell'; } }
        T().cursor(c);
      },
      dblclick() {},
      drawOverlay(ctx, v) {
        const c = this.create;
        if (c && Math.hypot((c.ex - c.x) * v.zoom, (c.ey - c.y) * v.zoom) > 6) { const a = { x: v.x + Math.min(c.x, c.ex) * v.zoom, y: v.y + Math.min(c.y, c.ey) * v.zoom }; IMG.dashedPath(ctx, () => ctx.rect(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5, Math.abs(c.ex - c.x) * v.zoom, Math.abs(c.ey - c.y) * v.zoom)); }
        Editor.draw(ctx, v);
      }
    };
  }
  const T = () => IMG.Tools;
  IMG.Tools.register(makeTextTool('text', 'Texto horizontal', 'text', 'h'));
  IMG.Tools.register(makeTextTool('textV', 'Texto vertical', 'textV', 'v'));

  /* ==================================================================
     DEFORMAR TEXTO (diálogo)
     ================================================================== */
  function warpDialog() {
    const UI = IMG.UI, L = Text.current();
    if (!L) { UI.toast('Selecione uma camada de texto.'); return; }
    const t = L.text, orig = t.warp ? JSON.parse(JSON.stringify(t.warp)) : null;
    const w = Object.assign({ style: 'none', bend: 50, h: 0, v: 0, vertical: false }, t.warp || {});
    const upd = () => { t.warp = w.style === 'none' ? null : Object.assign({}, w); Text.render(L); IMG.Engine.invalidate(); };
    const presets = [['none', 'Nenhum']].concat(IMG.WARP_PRESETS.filter((p) => p && p[0] !== 'custom'));
    UI.dialog({
      title: 'Deformar texto', width: 380,
      body: [UI.row('Estilo', UI.select(presets, w.style, (v) => { w.style = v; upd(); }, { keepFocus: true, width: 180 }).el),
        UI.row('', UI.seg([{ value: 'h', label: 'Horizontal' }, { value: 'v', label: 'Vertical' }], w.vertical ? 'v' : 'h', (v) => { w.vertical = v === 'v'; upd(); }, { labels: true }).el),
        UI.slider({ label: 'Curvar', value: w.bend, min: -100, max: 100, unit: '%', def: 50, onInput: (v) => { w.bend = v; upd(); } }).el,
        UI.slider({ label: 'Distorção horizontal', value: w.h, min: -100, max: 100, unit: '%', def: 0, onInput: (v) => { w.h = v; upd(); } }).el,
        UI.slider({ label: 'Distorção vertical', value: w.v, min: -100, max: 100, unit: '%', def: 0, onInput: (v) => { w.v = v; upd(); } }).el],
      buttons: [{ label: 'Cancelar', onClick: () => { t.warp = orig; Text.render(L); IMG.Engine.invalidate(); } }, { label: 'OK', primary: true, onClick: () => { upd(); if (!Text.edit) { bus.emit('layer:pixels', L); IMG.commit('Deformar texto'); } else Text.edit.dirty = true; } }],
      onClose: (v) => { if (v === undefined) { t.warp = orig; Text.render(L); IMG.Engine.invalidate(); } }
    });
  }
  Text.warpDialog = warpDialog;

  /* ==================================================================
     COMANDOS
     ================================================================== */
  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, H) => {
    const isText = () => !!(H.act() && H.act().type === 'text');
    const done = (L, label) => { bus.emit('layers:change', IMG.app.doc); IMG.Engine.invalidate(); IMG.commit(label); };
    C('type.warp', 'Deformar texto…', () => warpDialog(), { enabled: isText });
    C('type.toBox', 'Converter em texto de parágrafo', () => { const L = H.act(); Text.toBox(L); done(L, 'Converter em texto de parágrafo'); }, { enabled: () => isText() && !H.act().text.box && !H.act().text.onPath });
    C('type.toPoint', 'Converter em texto de ponto', () => { const L = H.act(); Text.toPoint(L); done(L, 'Converter em texto de ponto'); }, { enabled: () => isText() && !!H.act().text.box });
    C('type.horizontal', 'Horizontal', () => { const L = H.act(); L.text.orient = 'h'; Text.render(L); done(L, 'Orientação do texto'); }, { enabled: isText, checked: () => isText() && H.act().text.orient !== 'v' });
    C('type.vertical', 'Vertical', () => { const L = H.act(); L.text.orient = 'v'; L.text.box = null; Text.render(L); done(L, 'Orientação do texto'); }, { enabled: isText, checked: () => isText() && H.act().text.orient === 'v' });
    C('type.toPath', 'Criar demarcador de trabalho', () => {
      const d = H.doc(), L = H.act(); const p = Text.outline(L); if (!p) return;
      d.paths = (d.paths || []).filter((q) => q.kind !== 'work');
      const e = { id: U.uid('path'), name: 'Demarcador de trabalho', kind: 'work', path: p };
      d.paths.push(e); d.activePathId = e.id; d.pathTarget = 'doc';
      bus.emit('paths:change', d); IMG.Engine.requestRender(); IMG.commit('Criar demarcador de trabalho');
    }, { enabled: isText });
    C('type.toShape', 'Converter em forma', () => {
      const d = H.doc(), L = H.act(); const p = Text.outline(L); if (!p) return;
      const color = (L.text.runs[0] && L.text.runs[0].s.color) || '#000';
      const S = IMG.Shapes.create(d, { path: p, fill: { type: 'solid', color }, stroke: { on: false, fill: { type: 'solid', color: '#000' }, width: 3, align: 'inside', cap: 'butt', join: 'miter', dash: null }, live: null }, L.name);
      S.opacity = L.opacity; S.fill = L.fill; S.blend = L.blend; S.fx = L.fx ? JSON.parse(JSON.stringify(L.fx)) : null;
      // coloca a forma no lugar da camada de texto
      const list = L.parent ? L.parent.children : d.layers, i = list.indexOf(L);
      Layers.remove(d, S); list.splice(i + 1, 0, S); S.parent = L.parent || null;
      Layers.remove(d, L);
      d.activeId = S.id; d.selected = new Set([S.id]);
      IMG.Shapes.render(S);
      done(S, 'Converter em forma');
    }, { enabled: isText });
    C('type.rasterize', 'Rasterizar camada de texto', () => { const L = H.act(); if (Layers.rasterize(H.doc(), L)) done(L, 'Rasterizar texto'); }, { enabled: isText });
    C('type.lorem', 'Colar Lorem Ipsum', () => { if (Text.edit) Editor.insert('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.'); else Text.pasteAsLayer('Lorem ipsum dolor sit amet, consectetur adipiscing elit.'); }, { enabled: H.has });
  });
})();
