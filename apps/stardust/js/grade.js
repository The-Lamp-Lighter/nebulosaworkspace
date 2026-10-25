/* ==========================================================================
   Stardust — js/grade.js
   A grade da planilha: desenho (canvas), rolagem, seleção, edição de
   células, área de transferência, alça de preenchimento, redimensionar
   linhas/colunas, painéis congelados e a camada dos gráficos.
   As ações de menu ficam em js/app.js; aqui só o que acontece na grade.
   ========================================================================== */
(function () {
  'use strict';
  const SD = window.SD;
  const HDR_H = 24, HDR_W = 46, MAX_R = 1048576, MAX_C = 16384;
  const $ = s => document.querySelector(s);

  /* ---------- eixos (posições acumuladas com tamanhos personalizados) ---------- */
  class Eixo {
    constructor(def, sizes, hidden) { this.def = def; this.set(sizes, hidden); }
    set(sizes, hidden) {
      this.sizes = sizes || {}; this.hidden = hidden || null;
      const custom = new Map();
      Object.keys(this.sizes).forEach(k => custom.set(+k, +this.sizes[k]));
      if (this.hidden) this.hidden.forEach(k => custom.set(+k, 0));
      this.keys = [...custom.keys()].sort((a, b) => a - b);
      this.vals = this.keys.map(k => custom.get(k));
      this.cum = []; let acc = 0;
      this.keys.forEach((k, i) => { acc += this.vals[i] - this.def; this.cum.push(acc); });
    }
    size(i) { if (this.hidden && this.hidden.has(i)) return 0; const v = this.sizes[i]; return v !== undefined ? +v : this.def; }
    // soma dos tamanhos antes do índice i
    pos(i) {
      let lo = 0, hi = this.keys.length - 1, j = -1;
      while (lo <= hi) { const m = (lo + hi) >> 1; if (this.keys[m] < i) { j = m; lo = m + 1; } else hi = m - 1; }
      return i * this.def + (j >= 0 ? this.cum[j] : 0);
    }
    // índice na posição p (px, sem zoom)
    at(p) {
      if (p <= 0) return 0;
      let lo = 0, hi = MAX_R;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (this.pos(m) <= p) lo = m; else hi = m - 1; }
      return lo;
    }
  }

  /* ---------- estado ---------- */
  const V = {
    wb: null, si: 0,
    act: { r: 0, c: 0 }, sel: { r1: 0, c1: 0, r2: 0, c2: 0 }, anchor: { r: 0, c: 0 },
    sx: 0, sy: 0, nRows: 1000, nCols: 52,
    edit: null,            // { r, c, modo: 'entrar'|'editar', original }
    clip: null,            // { si, g, corte, dados, texto }
    refs: [],              // referências coloridas enquanto edita
    pickRange: null,       // seleção de intervalo para diálogos
    fillDrag: null, chartSel: null,
    tema: {}
  };
  let cols = new Eixo(SD.DEF_W), rows = new Eixo(SD.DEF_H);
  let cv, ctx, scroller, sizer, ed, layer, host;
  let dpr = 1, W = 0, H = 0;
  const sh = () => V.wb.sheets[V.si];
  const z = () => sh().zoom || 1;
  const fz = () => sh().freeze || { r: 0, c: 0 };

  function rebuildAxes() {
    const s = sh();
    cols = new Eixo(SD.DEF_W, s.colW, null);
    rows = new Eixo(SD.DEF_H, s.rowH, s.hiddenRows);
  }

  /* ---------- cores do tema (lidas do CSS) ---------- */
  function lerTema() {
    const cs = getComputedStyle(document.documentElement);
    const g = n => cs.getPropertyValue(n).trim();
    V.tema = {
      fundo: g('--sheet') || '#ffffff', tinta: g('--sheet-ink') || '#1b1d24', grade: g('--sheet-grid') || '#e1e4ea',
      cab: g('--hdr') || '#f3f4f7', cabTinta: g('--hdr-ink') || '#5b6170', cabSel: g('--hdr-sel') || '#dfe9f8', cabSelTinta: g('--hdr-sel-ink') || '#1d4f91',
      sel: g('--sel') || '#4d8fd6', selFundo: g('--sel-fill') || 'rgba(77,143,214,.14)', linha: g('--line') || '#d0d4dc',
      congela: g('--freeze') || '#9aa3b2', fonte: g('--cell-font') || 'Calibri, Carlito, "Segoe UI", Arial, sans-serif',
      escuro: SD.luminance(g('--sheet') || '#ffffff') < 0.4
    };
  }
  const FAMILIAS = () => ({ sans: V.tema.fonte, serif: 'Cambria, Caladea, Georgia, "Times New Roman", serif', mono: 'Consolas, "Cascadia Mono", "DejaVu Sans Mono", monospace' });
  function fontOf(s, zoom) {
    const px = (s && s.fs ? s.fs : 11) * 4 / 3 * zoom;
    return (s && s.i ? 'italic ' : '') + (s && s.b ? 'bold ' : '') + px.toFixed(2) + 'px ' + (FAMILIAS()[s && s.ff] || V.tema.fonte);
  }

  /* ---------- geometria na tela ---------- */
  function frozenW() { return cols.pos(fz().c) * z(); }
  function frozenH() { return rows.pos(fz().r) * z(); }
  const colX = c => HDR_W + cols.pos(c) * z() - (c >= fz().c ? V.sx : 0);
  const rowY = r => HDR_H + rows.pos(r) * z() - (r >= fz().r ? V.sy : 0);
  function colAt(x) {
    const xx = x - HDR_W, fw = frozenW();
    if (xx < fw) return Math.min(cols.at(xx / z()), Math.max(0, fz().c - 1));
    return Math.max(fz().c, cols.at((xx + V.sx) / z()));
  }
  function rowAt(y) {
    const yy = y - HDR_H, fh = frozenH();
    if (yy < fh) return Math.min(rows.at(yy / z()), Math.max(0, fz().r - 1));
    return Math.max(fz().r, rows.at((yy + V.sy) / z()));
  }
  function visibleRange() {
    const f = fz();
    return { r1: Math.max(f.r, rows.at(V.sy / z() + rows.pos(f.r))), r2: Math.min(V.nRows - 1, rows.at((V.sy + H - HDR_H) / z() + 1) + 1), c1: Math.max(f.c, cols.at(V.sx / z() + cols.pos(f.c))), c2: Math.min(V.nCols - 1, cols.at((V.sx + W - HDR_W) / z() + 1) + 1) };
  }
  function mergeAt(r, c) { const ms = sh().merges; for (let i = 0; i < ms.length; i++) { const m = ms[i]; if (r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) return m; } return null; }
  // retângulo de uma célula (ou área mesclada) na tela
  function cellRect(r, c) {
    const m = mergeAt(r, c);
    const g = m || { r1: r, c1: c, r2: r, c2: c };
    const x = colX(g.c1), y = rowY(g.r1);
    return { x, y, w: (cols.pos(g.c2 + 1) - cols.pos(g.c1)) * z(), h: (rows.pos(g.r2 + 1) - rows.pos(g.r1)) * z(), g };
  }
  function rangeRect(g) {
    const x1 = colX(g.c1), y1 = rowY(g.r1);
    const x2 = HDR_W + cols.pos(Math.min(g.c2, MAX_C - 1) + 1) * z() - (g.c2 >= fz().c ? V.sx : 0);
    const y2 = HDR_H + rows.pos(Math.min(g.r2, MAX_R - 1) + 1) * z() - (g.r2 >= fz().r ? V.sy : 0);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  /* ---------- valores ---------- */
  const cellAt = (r, c) => sh().cells.get(r + ',' + c);
  const valOf = cell => !cell ? null : cell.f ? (cell.val === undefined ? null : cell.val) : cell.v;
  const isEmpty = cell => !cell || ((cell.v === null || cell.v === undefined || cell.v === '') && !cell.f);

  /* ======================================================================
     Desenho
     ====================================================================== */
  let rafPending = false;
  function render() { if (!rafPending) { rafPending = true; requestAnimationFrame(() => { rafPending = false; draw(); }); } }
  function resize() {
    const r = host.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1; W = Math.max(50, r.width); H = Math.max(50, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    updateSizer(); draw();
  }
  function updateSizer() {
    const used = SD.sheetUsed(sh());
    V.nRows = Math.min(MAX_R, Math.max(V.nRows, used.r2 + 60, 200));
    V.nCols = Math.min(MAX_C, Math.max(V.nCols, used.c2 + 12, 30));
    sizer.style.width = (HDR_W + cols.pos(V.nCols) * z() + 40) + 'px';
    sizer.style.height = (HDR_H + rows.pos(V.nRows) * z() + 40) + 'px';
  }

  /** Desenha células de um bloco (usado na tela e na exportação). */
  function paintCells(c2d, s, geo, r1, r2, c1, c2, opt) {
    const zoom = geo.zoom, T = opt.tema;
    const merges = s.merges.filter(m => m.r2 >= r1 && m.r1 <= r2 && m.c2 >= c1 && m.c1 <= c2);
    const covered = (r, c) => { for (const m of merges) if (r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2 && !(r === m.r1 && c === m.c1)) return m; return null; };
    const X = geo.x, Y = geo.y, CW = geo.w, RH = geo.h;
    // 1. fundos
    for (let r = r1; r <= r2; r++) {
      const rh = RH(r); if (rh <= 0) continue;
      for (let c = c1; c <= c2; c++) {
        const cell = s.cells.get(r + ',' + c);
        if (cell && cell.s && cell.s.bg && !covered(r, c)) {
          const m = merges.find(mm => mm.r1 === r && mm.c1 === c);
          c2d.fillStyle = cell.s.bg;
          if (m) c2d.fillRect(X(c), Y(r), geoSpan(geo, m.c1, m.c2, 'c'), geoSpan(geo, m.r1, m.r2, 'r'));
          else c2d.fillRect(X(c), Y(r), CW(c), rh);
        }
      }
    }
    // 2. linhas de grade
    if (opt.grade) {
      c2d.strokeStyle = T.grade; c2d.lineWidth = 1;
      c2d.beginPath();
      for (let c = c1; c <= c2 + 1; c++) { const x = Math.round(X(c)) + .5; c2d.moveTo(x, Y(r1)); c2d.lineTo(x, Y(r2) + RH(r2)); }
      for (let r = r1; r <= r2 + 1; r++) { if (r <= r2 && RH(r) <= 0) continue; const y = Math.round(Y(r)) + .5; c2d.moveTo(X(c1), y); c2d.lineTo(X(c2) + CW(c2), y); }
      c2d.stroke();
      // tira a grade de dentro das mescladas
      merges.forEach(m => {
        const top = s.cells.get(m.r1 + ',' + m.c1);
        c2d.fillStyle = top && top.s && top.s.bg ? top.s.bg : T.fundo;
        c2d.fillRect(X(m.c1) + 1, Y(m.r1) + 1, geoSpan(geo, m.c1, m.c2, 'c') - 1, geoSpan(geo, m.r1, m.r2, 'r') - 1);
      });
    }
    // 3. textos
    const scanFrom = Math.max(0, c1 - 12), scanTo = c2 + 12;
    for (let r = r1; r <= r2; r++) {
      const rh = RH(r); if (rh <= 0) continue;
      for (let c = scanFrom; c <= scanTo; c++) {
        const cell = s.cells.get(r + ',' + c);
        if (!cell || covered(r, c)) continue;
        const v = valOf(cell);
        if (v === null || v === undefined || v === '') continue;
        const st = cell.s || {};
        const fv = SD.formatValue(v, st.z);
        let t = fv.t; if (!t) continue;
        const m = merges.find(mm => mm.r1 === r && mm.c1 === c);
        const cx = X(c), cy = Y(r), cw = m ? geoSpan(geo, m.c1, m.c2, 'c') : CW(c), ch = m ? geoSpan(geo, m.r1, m.r2, 'r') : rh;
        const isNum = typeof v === 'number';
        const ha = st.ha || (isNum ? 'right' : typeof v === 'boolean' || SD.isErr(v) ? 'center' : 'left');
        c2d.font = fontOf(st, zoom);
        const pad = 4 * zoom + (st.ind || 0) * 9 * zoom;
        let tw = c2d.measureText(t).width;
        // limites do texto (transbordo para vizinhas vazias)
        let left = cx, right = cx + cw;
        if (!st.wrap && !m && !isNum && tw + pad * 2 > cw) {
          if (ha === 'left' || ha === 'center') { let k = c + 1; while (right - cx < tw + pad * 2 + (ha === 'center' ? tw : 0) && k < c + 40 && isEmpty(s.cells.get(r + ',' + k)) && !covered(r, k)) { right += CW(k); k++; } }
          if (ha === 'right' || ha === 'center') { let k = c - 1; while (right - left < tw + pad * 2 + (ha === 'center' ? tw : 0) && k >= 0 && k > c - 40 && isEmpty(s.cells.get(r + ',' + k)) && !covered(r, k)) { left -= CW(k); k--; } }
        }
        if (right < X(c1) - 1 || left > X(c2) + CW(c2) + 1) continue;
        if (c < c1 || c > c2) { if (!(right > X(c1))) continue; }
        if (isNum && !st.wrap && tw + pad * 2 > cw) { t = '#'.repeat(Math.max(1, Math.floor((cw - pad) / Math.max(1, c2d.measureText('#').width)))); tw = c2d.measureText(t).width; }
        c2d.save();
        c2d.beginPath(); c2d.rect(left + 1, cy + 1, right - left - 2, ch - 1); c2d.clip();
        // cor legível: sem cor própria, acompanha o fundo; preto em planilha escura vira a tinta do tema
        let ink = fv.c || st.fc;
        if (!ink) ink = st.bg ? (SD.luminance(st.bg) > 0.55 ? '#1b1d24' : '#f2f3f5') : T.tinta;
        else if (T.escuro && !st.bg && SD.luminance(ink) < 0.22) ink = T.tinta;
        c2d.fillStyle = ink;
        const fsPx = (st.fs || 11) * 4 / 3 * zoom;
        let lines = [t];
        if (st.wrap) lines = wrapText(c2d, t, cw - pad * 2);
        const lh = fsPx * 1.22, blockH = lines.length * lh;
        const va = st.va || 'bottom';
        let ty = va === 'top' ? cy + 3 * zoom : va === 'middle' ? cy + (ch - blockH) / 2 : cy + ch - blockH - 3 * zoom;
        c2d.textBaseline = 'top';
        lines.forEach(ln => {
          const lw = c2d.measureText(ln).width;
          let tx = ha === 'right' ? cx + cw - pad - lw : ha === 'center' ? cx + (cw - lw) / 2 : (ha === 'justify' ? cx + pad : cx + pad);
          c2d.fillText(ln, tx, ty + fsPx * 0.08);
          if (st.u) c2d.fillRect(tx, ty + fsPx * 1.02, lw, Math.max(1, zoom));
          if (st.st) c2d.fillRect(tx, ty + fsPx * 0.55, lw, Math.max(1, zoom));
          ty += lh;
        });
        c2d.restore();
      }
    }
    // 4. bordas
    for (let r = r1; r <= r2; r++) {
      if (RH(r) <= 0) continue;
      for (let c = c1; c <= c2; c++) {
        const cell = s.cells.get(r + ',' + c);
        if (!cell || !cell.s || !cell.s.bd || covered(r, c)) continue;
        const bd = cell.s.bd, m = merges.find(mm => mm.r1 === r && mm.c1 === c);
        const x = X(c), y = Y(r), w = m ? geoSpan(geo, m.c1, m.c2, 'c') : CW(c), h = m ? geoSpan(geo, m.r1, m.r2, 'r') : RH(r);
        c2d.strokeStyle = bd.c || (T.escuro ? '#c9cdd6' : '#1b1d24');
        const lw = v => v === 'thick' ? 3 : v === 'medium' ? 2 : 1;
        const line = (v, x1, y1, x2, y2) => { if (!v) return; c2d.lineWidth = lw(v); const o = lw(v) % 2 ? .5 : 0; c2d.beginPath(); c2d.moveTo(Math.round(x1) + o, Math.round(y1) + o); c2d.lineTo(Math.round(x2) + o, Math.round(y2) + o); c2d.stroke(); };
        line(bd.t, x, y, x + w, y); line(bd.b, x, y + h, x + w, y + h); line(bd.l, x, y, x, y + h); line(bd.r, x + w, y, x + w, y + h);
      }
    }
  }
  function geoSpan(geo, a, b, axis) { let t = 0; for (let i = a; i <= b; i++) t += axis === 'c' ? geo.w(i) : geo.h(i); return t; }
  function wrapText(c2d, t, maxW) {
    const out = [];
    String(t).split('\n').forEach(par => {
      const words = par.split(/(\s+)/); let line = '';
      words.forEach(w => {
        const test = line + w;
        if (c2d.measureText(test.trimEnd()).width > maxW && line.trim()) { out.push(line.trimEnd()); line = w.trimStart(); }
        else line = test;
        while (c2d.measureText(line).width > maxW && line.length > 1) { let k = line.length; while (k > 1 && c2d.measureText(line.slice(0, k)).width > maxW) k--; out.push(line.slice(0, k)); line = line.slice(k); }
      });
      out.push(line.trimEnd());
    });
    return out;
  }

  function draw() {
    if (!V.wb || !ctx) return;
    const s = sh(), Z = z(), T = V.tema, f = fz();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = T.fundo; ctx.fillRect(0, 0, W, H);
    const vr = visibleRange();
    const geo = { zoom: Z, x: colX, y: rowY, w: c => cols.size(c) * Z, h: r => rows.size(r) * Z };
    const fw = frozenW(), fh = frozenH();
    const panes = [];
    panes.push({ r1: vr.r1, r2: vr.r2, c1: vr.c1, c2: vr.c2, clip: [HDR_W + fw, HDR_H + fh, W, H] });
    if (f.r) panes.push({ r1: 0, r2: f.r - 1, c1: vr.c1, c2: vr.c2, clip: [HDR_W + fw, HDR_H, W, HDR_H + fh] });
    if (f.c) panes.push({ r1: vr.r1, r2: vr.r2, c1: 0, c2: f.c - 1, clip: [HDR_W, HDR_H + fh, HDR_W + fw, H] });
    if (f.r && f.c) panes.push({ r1: 0, r2: f.r - 1, c1: 0, c2: f.c - 1, clip: [HDR_W, HDR_H, HDR_W + fw, HDR_H + fh] });
    panes.forEach(p => {
      ctx.save(); ctx.beginPath(); ctx.rect(p.clip[0], p.clip[1], p.clip[2] - p.clip[0], p.clip[3] - p.clip[1]); ctx.clip();
      paintCells(ctx, s, geo, p.r1, p.r2, p.c1, p.c2, { grade: s.showGrid !== false, tema: T });
      drawOverlays(p);
      ctx.restore();
    });
    // divisórias dos painéis congelados
    ctx.strokeStyle = T.congela; ctx.lineWidth = 1.5;
    if (f.r) { ctx.beginPath(); ctx.moveTo(HDR_W, HDR_H + fh + .5); ctx.lineTo(W, HDR_H + fh + .5); ctx.stroke(); }
    if (f.c) { ctx.beginPath(); ctx.moveTo(HDR_W + fw + .5, HDR_H); ctx.lineTo(HDR_W + fw + .5, H); ctx.stroke(); }
    drawHeaders(vr);
    positionEditor();
    positionCharts();
  }
  function drawOverlays() {
    const T = V.tema;
    // referências coloridas da fórmula em edição
    V.refs.forEach(rf => {
      if (rf.si !== V.si) return;
      const r = rangeRect(rf.g);
      ctx.fillStyle = rf.cor + '22'; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = rf.cor; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    });
    // área copiada
    if (V.clip && V.clip.si === V.si) {
      const r = rangeRect(V.clip.g);
      ctx.strokeStyle = T.sel; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -(performance.now() / 60) % 9;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); ctx.setLineDash([]);
    }
    // seleção
    const g = V.pickRange || V.sel;
    const R = rangeRect(g);
    const single = g.r1 === g.r2 && g.c1 === g.c2 || (mergeAt(g.r1, g.c1) && (() => { const m = mergeAt(g.r1, g.c1); return m.r1 === g.r1 && m.c1 === g.c1 && m.r2 === g.r2 && m.c2 === g.c2; })());
    if (!single) { ctx.fillStyle = T.selFundo; ctx.fillRect(R.x, R.y, R.w, R.h); }
    if (!V.pickRange) {
      const a = cellRect(V.act.r, V.act.c);
      ctx.strokeStyle = T.sel; ctx.lineWidth = 2;
      ctx.strokeRect(R.x + 1, R.y + 1, R.w - 2, R.h - 2);
      if (!single) { ctx.lineWidth = 1; ctx.strokeRect(a.x + 1.5, a.y + 1.5, a.w - 3, a.h - 3); }
      // alça de preenchimento
      if (!V.edit) { ctx.fillStyle = T.sel; ctx.fillRect(R.x + R.w - 4, R.y + R.h - 4, 7, 7); ctx.strokeStyle = T.fundo; ctx.lineWidth = 1; ctx.strokeRect(R.x + R.w - 4.5, R.y + R.h - 4.5, 8, 8); }
    } else {
      ctx.strokeStyle = T.sel; ctx.lineWidth = 2; ctx.setLineDash([6, 3]); ctx.strokeRect(R.x + 1, R.y + 1, R.w - 2, R.h - 2); ctx.setLineDash([]);
    }
    // preenchimento sendo arrastado
    if (V.fillDrag && V.fillDrag.alvo) {
      const r = rangeRect(V.fillDrag.alvo);
      ctx.strokeStyle = T.sel; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1); ctx.setLineDash([]);
    }
  }
  function drawHeaders(vr) {
    const T = V.tema, Z = z(), f = fz();
    const g = V.pickRange || V.sel;
    ctx.save();
    ctx.font = '500 ' + Math.max(10, Math.min(13, 11.5 * Math.sqrt(Z))) + 'px ' + (getComputedStyle(document.body).fontFamily || 'sans-serif');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // colunas
    ctx.fillStyle = T.cab; ctx.fillRect(0, 0, W, HDR_H);
    const colsToDraw = [];
    for (let c = 0; c < f.c; c++) colsToDraw.push(c);
    for (let c = vr.c1; c <= vr.c2; c++) colsToDraw.push(c);
    const fw = frozenW();
    colsToDraw.forEach(c => {
      const x = colX(c), w = cols.size(c) * Z;
      if (w <= 0) return;
      if (c >= f.c && x + w < HDR_W + fw) return;
      ctx.save(); ctx.beginPath(); ctx.rect(c >= f.c ? HDR_W + fw : HDR_W, 0, W, HDR_H); ctx.clip();
      const selC = c >= g.c1 && c <= g.c2;
      const full = g.r1 === 0 && g.r2 >= MAX_R - 1;
      if (selC) { ctx.fillStyle = full ? T.sel : T.cabSel; ctx.fillRect(x, 0, w, HDR_H); }
      ctx.fillStyle = selC ? (full ? '#fff' : T.cabSelTinta) : T.cabTinta;
      ctx.fillText(SD.colName(c), x + w / 2, HDR_H / 2 + 1);
      ctx.fillStyle = T.linha; ctx.fillRect(Math.round(x + w) - .5, 4, 1, HDR_H - 8);
      if (selC) { ctx.fillStyle = T.sel; ctx.fillRect(x, HDR_H - 2, w, 2); }
      ctx.restore();
    });
    // linhas
    ctx.fillStyle = T.cab; ctx.fillRect(0, HDR_H, HDR_W, H);
    const rowsToDraw = [];
    for (let r = 0; r < f.r; r++) rowsToDraw.push(r);
    for (let r = vr.r1; r <= vr.r2; r++) rowsToDraw.push(r);
    const fh = frozenH();
    rowsToDraw.forEach(r => {
      const y = rowY(r), h = rows.size(r) * Z;
      if (h <= 0) return;
      if (r >= f.r && y + h < HDR_H + fh) return;
      ctx.save(); ctx.beginPath(); ctx.rect(0, r >= f.r ? HDR_H + fh : HDR_H, HDR_W, H); ctx.clip();
      const selR = r >= g.r1 && r <= g.r2;
      const full = g.c1 === 0 && g.c2 >= MAX_C - 1;
      if (selR) { ctx.fillStyle = full ? T.sel : T.cabSel; ctx.fillRect(0, y, HDR_W, h); }
      ctx.fillStyle = selR ? (full ? '#fff' : T.cabSelTinta) : T.cabTinta;
      if (h > 9) ctx.fillText(String(r + 1), HDR_W / 2, y + h / 2 + 1);
      ctx.fillStyle = T.linha; ctx.fillRect(6, Math.round(y + h) - .5, HDR_W - 12, 1);
      if (selR) { ctx.fillStyle = T.sel; ctx.fillRect(HDR_W - 2, y, 2, h); }
      // linha com filtro escondendo outras logo depois: marcador
      if (sh().hiddenRows.has(r + 1)) { ctx.fillStyle = T.sel; ctx.fillRect(HDR_W - 10, y + h - 2, 8, 3); }
      ctx.restore();
    });
    // canto
    ctx.fillStyle = T.cab; ctx.fillRect(0, 0, HDR_W, HDR_H);
    ctx.fillStyle = T.cabTinta; ctx.globalAlpha = .55;
    ctx.beginPath(); ctx.moveTo(HDR_W - 6, 6); ctx.lineTo(HDR_W - 6, HDR_H - 6); ctx.lineTo(HDR_W - 6 - (HDR_H - 12), HDR_H - 6); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = T.linha; ctx.fillRect(0, HDR_H - 1, W, 1); ctx.fillRect(HDR_W - 1, 0, 1, H);
    // setas do filtro
    const fl = sh().filter;
    if (fl && fl.range) {
      const fg = SD.parseRange(fl.range);
      if (fg) for (let c = fg.c1; c <= fg.c2; c++) {
        const rc = cellRect(fg.r1, c); if (rc.x + rc.w < HDR_W || rc.y + rc.h < HDR_H) continue;
        const bx = rc.x + rc.w - 18, by = rc.y + (rc.h - 16) / 2;
        const ativo = fl.hidden && fl.hidden[c] && fl.hidden[c].length;
        ctx.fillStyle = ativo ? T.sel : T.cab; ctx.strokeStyle = T.linha; ctx.lineWidth = 1;
        ctx.fillRect(bx, by, 16, 16); ctx.strokeRect(bx + .5, by + .5, 15, 15);
        ctx.fillStyle = ativo ? '#fff' : T.cabTinta; ctx.beginPath(); ctx.moveTo(bx + 4, by + 6); ctx.lineTo(bx + 12, by + 6); ctx.lineTo(bx + 8, by + 11); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ======================================================================
     Rolagem e visibilidade
     ====================================================================== */
  function onScroll() {
    V.sx = scroller.scrollLeft; V.sy = scroller.scrollTop;
    const needR = rows.at((V.sy + H * 2) / z()), needC = cols.at((V.sx + W * 2) / z());
    if (needR > V.nRows - 50 || needC > V.nCols - 10) { V.nRows = Math.min(MAX_R, Math.max(V.nRows, needR + 300)); V.nCols = Math.min(MAX_C, Math.max(V.nCols, needC + 20)); updateSizer(); }
    draw();
  }
  function scrollIntoView(r, c) {
    const f = fz(), Z = z();
    const fw = frozenW(), fh = frozenH();
    let sx = V.sx, sy = V.sy;
    if (c >= f.c) {
      const x1 = cols.pos(c) * Z - fw, x2 = cols.pos(c + 1) * Z - fw, vw = W - HDR_W - fw;
      if (x1 < sx) sx = x1; else if (x2 > sx + vw) sx = x2 - vw;
    }
    if (r >= f.r) {
      const y1 = rows.pos(r) * Z - fh, y2 = rows.pos(r + 1) * Z - fh, vh = H - HDR_H - fh;
      if (y1 < sy) sy = y1; else if (y2 > sy + vh) sy = y2 - vh;
    }
    sx = Math.max(0, sx); sy = Math.max(0, sy);
    if (r > V.nRows - 30) { V.nRows = Math.min(MAX_R, r + 200); updateSizer(); }
    if (c > V.nCols - 5) { V.nCols = Math.min(MAX_C, c + 20); updateSizer(); }
    if (sx !== V.sx || sy !== V.sy) { scroller.scrollLeft = sx; scroller.scrollTop = sy; V.sx = scroller.scrollLeft; V.sy = scroller.scrollTop; }
  }

  /* ======================================================================
     Seleção
     ====================================================================== */
  function expandMerges(g) {
    let changed = true, out = Object.assign({}, g);
    while (changed) {
      changed = false;
      sh().merges.forEach(m => {
        if (m.r2 < out.r1 || m.r1 > out.r2 || m.c2 < out.c1 || m.c1 > out.c2) return;
        if (m.r1 < out.r1 || m.c1 < out.c1 || m.r2 > out.r2 || m.c2 > out.c2) { out = { r1: Math.min(out.r1, m.r1), c1: Math.min(out.c1, m.c1), r2: Math.max(out.r2, m.r2), c2: Math.max(out.c2, m.c2) }; changed = true; }
      });
    }
    return out;
  }
  function select(r, c, extend, keepAnchor) {
    r = Math.max(0, Math.min(MAX_R - 1, r)); c = Math.max(0, Math.min(MAX_C - 1, c));
    if (extend) {
      V.sel = expandMerges(SD.norm({ r1: V.anchor.r, c1: V.anchor.c, r2: r, c2: c }));
    } else {
      const m = mergeAt(r, c);
      if (m) { r = m.r1; c = m.c1; }
      V.act = { r, c }; if (!keepAnchor) V.anchor = { r, c };
      V.sel = m ? { r1: m.r1, c1: m.c1, r2: m.r2, c2: m.c2 } : { r1: r, c1: c, r2: r, c2: c };
    }
    scrollIntoView(r, c);
    selectChart(null);
    changed();
  }
  function setSelection(g, act) {
    selectChart(null);
    V.sel = SD.norm(g); V.act = act || { r: V.sel.r1, c: V.sel.c1 }; V.anchor = Object.assign({}, V.act);
    scrollIntoView(V.act.r, V.act.c); changed();
  }
  function changed() { render(); if (SD.app && SD.app.onSelection) SD.app.onSelection(); }
  // fim do bloco de dados (Ctrl+seta)
  function jump(r, c, dr, dc) {
    const filled = (rr, cc) => !isEmpty(cellAt(rr, cc));
    let nr = r, nc = c;
    const maxR = Math.max(SD.sheetUsed(sh()).r2 + 1, 0), maxC = Math.max(SD.sheetUsed(sh()).c2 + 1, 0);
    const lim = (a, b) => dr ? (a >= 0 && a <= maxR) : (b >= 0 && b <= maxC);
    const step = () => { nr += dr; nc += dc; };
    if (filled(r, c) && lim(r + dr, c + dc) && filled(r + dr, c + dc)) { while (lim(nr + dr, nc + dc) && filled(nr + dr, nc + dc)) step(); }
    else { step(); while (lim(nr, nc) && !filled(nr, nc)) step(); if (!lim(nr, nc)) { nr = dr ? (dr > 0 ? Math.max(r, maxR) : 0) : r; nc = dc ? (dc > 0 ? Math.max(c, maxC) : 0) : c; } }
    return { r: Math.max(0, nr), c: Math.max(0, nc) };
  }
  function moveAct(dr, dc, ext, ctrl) {
    let base = ext ? { r: V.sel.r1 === V.anchor.r ? V.sel.r2 : V.sel.r1, c: V.sel.c1 === V.anchor.c ? V.sel.c2 : V.sel.c1 } : V.act;
    if (!ext) { const m = mergeAt(V.act.r, V.act.c); if (m) base = { r: dr > 0 ? m.r2 : dr < 0 ? m.r1 : V.act.r, c: dc > 0 ? m.c2 : dc < 0 ? m.c1 : V.act.c }; }
    let t;
    if (ctrl) t = jump(base.r, base.c, dr, dc);
    else {
      t = { r: base.r + dr, c: base.c + dc };
      while (dr && t.r > 0 && t.r < MAX_R - 1 && rows.size(t.r) === 0) t.r += dr; // pula linhas escondidas
    }
    if (ext) { select(t.r, t.c, true); scrollIntoView(t.r, t.c); }
    else select(t.r, t.c);
  }
  /** Seleção limitada à área útil (para formatar coluna/linha inteira sem percorrer 1 milhão de células). */
  function boundSel(g) {
    g = g || V.sel;
    const u = SD.sheetUsed(sh()), vr = visibleRange();
    return { r1: g.r1, c1: g.c1, r2: Math.min(g.r2, Math.max(u.r2, vr.r2, g.r1)), c2: Math.min(g.c2, Math.max(u.c2, vr.c2, g.c1)) };
  }

  /* ======================================================================
     Edição
     ====================================================================== */
  const REF_COLORS = ['#3b82f6', '#e5484d', '#8e4ec6', '#12a594', '#f76b15', '#d6409f', '#0090ff', '#46a758'];
  function startEdit(initial, modo) {
    if (V.edit) return;
    if (SD.app && SD.app.podeEditar && !SD.app.podeEditar()) return;
    const cell = cellAt(V.act.r, V.act.c);
    const orig = SD.editText(cell);
    V.edit = { r: V.act.r, c: V.act.c, si0: V.si, modo: modo || (initial !== undefined ? 'entrar' : 'editar'), original: orig };
    ed.value = initial !== undefined ? initial : orig;
    ed.classList.add('on');
    const st = cell && cell.s || {};
    ed.style.font = fontOf(st, z());
    ed.style.color = st.fc || V.tema.tinta;
    ed.style.background = st.bg || V.tema.fundo;
    ed.style.textAlign = st.ha === 'center' ? 'center' : st.ha === 'right' || (initial === undefined && cell && typeof valOf(cell) === 'number' && !cell.f) ? 'right' : 'left';
    positionEditor();
    ed.focus();
    const n = ed.value.length; ed.setSelectionRange(n, n);
    onEditInput();
    render();
  }
  function positionEditor() {
    if (!ed) return;
    if (!V.edit) {
      // escondido sobre a célula ativa, recebendo as teclas
      const a = cellRect(V.act.r, V.act.c);
      ed.style.left = Math.max(HDR_W, Math.min(W - 10, a.x)) + 'px'; ed.style.top = Math.max(HDR_H, Math.min(H - 10, a.y)) + 'px';
      ed.style.width = '4px'; ed.style.height = '4px';
      return;
    }
    ed.classList.toggle('longe', V.edit.si0 !== V.si); // apontando células de outra planilha
    const a = cellRect(V.edit.r, V.edit.c);
    const meas = measureEditor();
    const w = Math.min(Math.max(a.w, meas.w + 16), Math.max(a.w, W - a.x - 6));
    const h = Math.max(a.h, Math.min(meas.h + 6, H - a.y - 6));
    ed.style.left = a.x + 'px'; ed.style.top = a.y + 'px'; ed.style.width = w + 'px'; ed.style.height = h + 'px';
  }
  function measureEditor() {
    ctx.save(); ctx.font = ed.style.font || fontOf({}, z());
    const lines = ed.value.split('\n');
    const w = Math.max(...lines.map(l => ctx.measureText(l).width));
    ctx.restore();
    const lh = parseFloat(ed.style.font) * 1.3 || 18;
    return { w, h: lines.length * lh };
  }
  function onEditInput() {
    positionEditor();
    // referências coloridas
    V.refs = [];
    const t = ed.value;
    if (t[0] === '=') {
      const found = SD.F.refsIn(t);
      const map = new Map();
      found.forEach(f => {
        const k = (f.sheet || '') + '!' + f.ref.toUpperCase();
        if (!map.has(k)) map.set(k, REF_COLORS[map.size % REF_COLORS.length]);
        const si = f.sheet ? V.wb.sheets.findIndex(s => s.name.toLowerCase() === f.sheet.toLowerCase()) : (V.edit ? V.edit.si0 : V.si);
        let g = SD.parseRange(f.ref);
        if (!g) { const m = /^\$?([A-Z]+):\$?([A-Z]+)$/i.exec(f.ref.replace(/\$/g, '')); if (m) g = { r1: 0, r2: MAX_R - 1, c1: SD.colIndex(m[1]), c2: SD.colIndex(m[2]) }; }
        if (g && si >= 0) V.refs.push({ si, g, cor: map.get(k), start: f.start, end: f.end });
      });
    }
    if (SD.app && SD.app.onEditText) SD.app.onEditText(t);
    render();
  }
  function canPoint() {
    if (!V.edit) return false;
    const t = ed.value, pos = ed.selectionStart;
    if (t[0] !== '=') return false;
    const before = t.slice(0, pos).replace(/\s+$/, '');
    if (V.pointing) return true;
    return /[=(;,+\-*/^&<>:]$/.test(before) || before === '=';
  }
  function insertRef(g, si) {
    let txt = SD.rangeStr(g);
    if (si !== undefined && V.edit && si !== V.edit.si0) { const n = V.wb.sheets[si].name; txt = (/^[A-Za-z_À-ɏ][\w.À-ɏ]*$/.test(n) ? n : "'" + n.replace(/'/g, "''") + "'") + '!' + txt; }
    const t = ed.value;
    let a = V.pointing ? V.pointing.start : ed.selectionStart, b = V.pointing ? V.pointing.end : ed.selectionEnd;
    ed.value = t.slice(0, a) + txt + t.slice(b);
    V.pointing = { start: a, end: a + txt.length };
    ed.setSelectionRange(a + txt.length, a + txt.length);
    onEditInput();
  }
  function commitEdit(move) {
    if (!V.edit) return;
    const e = V.edit; V.edit = null; V.refs = []; V.pointing = null;
    const txt = ed.value;
    ed.classList.remove('on'); ed.value = '';
    if (e.si0 !== V.si) voltarPlanilha(e.si0);
    if (txt !== e.original && SD.app) SD.app.entrarTexto(e.r, e.c, txt);
    if (move) moveAct(move[0], move[1]); else render();
    ed.focus({ preventScroll: true });
    if (SD.app && SD.app.onEditText) SD.app.onEditText(null);
  }
  function cancelEdit() {
    if (!V.edit) return;
    const e = V.edit; V.edit = null; V.refs = []; V.pointing = null; ed.classList.remove('on'); ed.value = '';
    if (e.si0 !== V.si) voltarPlanilha(e.si0);
    render(); ed.focus({ preventScroll: true });
    if (SD.app && SD.app.onEditText) SD.app.onEditText(null);
  }

  /* ======================================================================
     Mouse
     ====================================================================== */
  let drag = null;
  function local(e) { const r = host.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function hit(p) {
    if (p.x < HDR_W && p.y < HDR_H) return { k: 'corner' };
    if (p.y < HDR_H) {
      const c = colAt(p.x), x2 = colX(c) + cols.size(c) * z(), x1 = colX(c);
      if (Math.abs(p.x - x2) <= 4) return { k: 'colsize', c };
      if (Math.abs(p.x - x1) <= 3 && c > 0) return { k: 'colsize', c: c - 1 };
      return { k: 'colhdr', c };
    }
    if (p.x < HDR_W) {
      const r = rowAt(p.y), y2 = rowY(r) + rows.size(r) * z(), y1 = rowY(r);
      if (Math.abs(p.y - y2) <= 3) return { k: 'rowsize', r };
      if (Math.abs(p.y - y1) <= 2 && r > 0) return { k: 'rowsize', r: r - 1 };
      return { k: 'rowhdr', r };
    }
    const r = rowAt(p.y), c = colAt(p.x);
    if (!V.edit && !V.pickRange) {
      const R = rangeRect(V.sel);
      if (Math.abs(p.x - (R.x + R.w)) <= 5 && Math.abs(p.y - (R.y + R.h)) <= 5) return { k: 'fill', r, c };
    }
    // seta do filtro
    const fl = sh().filter;
    if (fl && fl.range) {
      const fg = SD.parseRange(fl.range);
      if (fg && r === fg.r1 && c >= fg.c1 && c <= fg.c2) { const rc = cellRect(r, c); if (p.x >= rc.x + rc.w - 19 && p.x <= rc.x + rc.w - 1) return { k: 'filter', r, c, rect: rc }; }
    }
    return { k: 'cell', r, c };
  }
  function onMouseMove(e) {
    if (drag) return;
    const h = hit(local(e));
    scroller.style.cursor = h.k === 'colsize' ? 'col-resize' : h.k === 'rowsize' ? 'row-resize' : h.k === 'fill' ? 'crosshair' : h.k === 'colhdr' ? 's-resize' : h.k === 'rowhdr' ? 'e-resize' : h.k === 'filter' ? 'pointer' : 'cell';
  }
  function onMouseDown(e) {
    if (e.button === 2) {
      const h = hit(local(e));
      if (h.k === 'cell' && !SD.inRange(V.sel, h.r, h.c)) { if (V.edit) commitEdit(); select(h.r, h.c); }
      if (h.k === 'colhdr' && !(V.sel.c1 <= h.c && h.c <= V.sel.c2 && V.sel.r1 === 0 && V.sel.r2 >= MAX_R - 1)) { V.sel = { r1: 0, r2: MAX_R - 1, c1: h.c, c2: h.c }; V.act = { r: 0, c: h.c }; V.anchor = Object.assign({}, V.act); changed(); }
      if (h.k === 'rowhdr' && !(V.sel.r1 <= h.r && h.r <= V.sel.r2 && V.sel.c1 === 0 && V.sel.c2 >= MAX_C - 1)) { V.sel = { r1: h.r, r2: h.r, c1: 0, c2: MAX_C - 1 }; V.act = { r: h.r, c: V.sx ? cols.at(V.sx / z()) : 0 }; V.anchor = Object.assign({}, V.act); changed(); }
      return;
    }
    if (e.button !== 0) return;
    const p = local(e), h = hit(p);
    e.preventDefault();
    if (V.pickRange && h.k === 'cell') { drag = { k: 'pick', r: h.r, c: h.c }; V.pickRange = { r1: h.r, c1: h.c, r2: h.r, c2: h.c }; SD.app.onPick && SD.app.onPick(V.pickRange); render(); }
    else if (V.edit && (h.k === 'cell') && canPoint()) {
      drag = { k: 'point', r: h.r, c: h.c };
      insertRef({ r1: h.r, c1: h.c, r2: h.r, c2: h.c }, V.si);
    } else {
      if (V.edit) commitEdit();
      if (h.k === 'colsize') { drag = { k: 'colsize', c: h.c, x0: p.x, w0: cols.size(h.c) }; }
      else if (h.k === 'rowsize') { drag = { k: 'rowsize', r: h.r, y0: p.y, h0: rows.size(h.r) }; }
      else if (h.k === 'corner') { V.sel = { r1: 0, c1: 0, r2: MAX_R - 1, c2: MAX_C - 1 }; changed(); }
      else if (h.k === 'colhdr') {
        if (e.shiftKey) { V.sel = { r1: 0, r2: MAX_R - 1, c1: Math.min(V.anchor.c, h.c), c2: Math.max(V.anchor.c, h.c) }; }
        else { V.sel = { r1: 0, r2: MAX_R - 1, c1: h.c, c2: h.c }; V.act = { r: Math.max(fz().r, rows.at(V.sy / z() + rows.pos(fz().r))), c: h.c }; V.anchor = { r: 0, c: h.c }; }
        drag = { k: 'colsel', c0: V.anchor.c }; selectChart(null); changed();
      } else if (h.k === 'rowhdr') {
        if (e.shiftKey) { V.sel = { r1: Math.min(V.anchor.r, h.r), r2: Math.max(V.anchor.r, h.r), c1: 0, c2: MAX_C - 1 }; }
        else { V.sel = { r1: h.r, r2: h.r, c1: 0, c2: MAX_C - 1 }; V.act = { r: h.r, c: Math.max(fz().c, cols.at(V.sx / z() + cols.pos(fz().c))) }; V.anchor = { r: h.r, c: 0 }; }
        drag = { k: 'rowsel', r0: V.anchor.r }; selectChart(null); changed();
      } else if (h.k === 'fill') { drag = { k: 'fill' }; V.fillDrag = { orig: Object.assign({}, V.sel), alvo: null }; }
      else if (h.k === 'filter') { if (SD.app && SD.app.menuFiltro) SD.app.menuFiltro(h.c, h.rect); return; }
      else if (h.k === 'cell') {
        if (e.shiftKey) select(h.r, h.c, true); else select(h.r, h.c);
        drag = { k: 'sel' };
      }
    }
    if (drag) { addEventListener('mousemove', onDragMove); addEventListener('mouseup', onDragEnd, { once: true }); }
    if (!V.edit) ed.focus({ preventScroll: true });
  }
  let autoScrollT = null;
  function onDragMove(e) {
    const p = local(e);
    // rolagem automática perto das bordas
    clearInterval(autoScrollT);
    if (['sel', 'point', 'pick', 'fill', 'colsel', 'rowsel'].includes(drag.k)) {
      const dx = p.x > W - 10 ? 20 : p.x < HDR_W + 4 ? -20 : 0, dy = p.y > H - 10 ? 20 : p.y < HDR_H + 4 ? -20 : 0;
      if (dx || dy) autoScrollT = setInterval(() => { scroller.scrollLeft += dx; scroller.scrollTop += dy; dragTo(p); }, 40);
    }
    dragTo(p);
  }
  function dragTo(p) {
    const r = rowAt(Math.max(HDR_H + 1, Math.min(H - 2, p.y))), c = colAt(Math.max(HDR_W + 1, Math.min(W - 2, p.x)));
    switch (drag.k) {
      case 'sel': V.sel = expandMerges(SD.norm({ r1: V.anchor.r, c1: V.anchor.c, r2: r, c2: c })); changed(); break;
      case 'point': { const g = SD.norm({ r1: drag.r, c1: drag.c, r2: r, c2: c }); insertRef(g, V.si); break; }
      case 'pick': V.pickRange = SD.norm({ r1: drag.r, c1: drag.c, r2: r, c2: c }); SD.app.onPick && SD.app.onPick(V.pickRange); render(); break;
      case 'colsel': V.sel = { r1: 0, r2: MAX_R - 1, c1: Math.min(drag.c0, c), c2: Math.max(drag.c0, c) }; changed(); break;
      case 'rowsel': V.sel = { r1: Math.min(drag.r0, r), r2: Math.max(drag.r0, r), c1: 0, c2: MAX_C - 1 }; changed(); break;
      case 'colsize': { const w = Math.max(0, Math.round(drag.w0 + (p.x - drag.x0) / z())); drag.nw = w; showSizeTip(p, 'Largura: ' + w + ' px'); const tmp = Object.assign({}, sh().colW); tmp[drag.c] = w; cols.set(tmp, null); draw(); break; }
      case 'rowsize': { const h = Math.max(0, Math.round(drag.h0 + (p.y - drag.y0) / z())); drag.nh = h; showSizeTip(p, 'Altura: ' + h + ' px'); const tmp = Object.assign({}, sh().rowH); tmp[drag.r] = h; rows.set(tmp, sh().hiddenRows); draw(); break; }
      case 'fill': {
        const o = V.fillDrag.orig;
        const dr = r > o.r2 ? r - o.r2 : r < o.r1 ? r - o.r1 : 0, dc = c > o.c2 ? c - o.c2 : c < o.c1 ? c - o.c1 : 0;
        if (Math.abs(dr) >= Math.abs(dc) && dr) V.fillDrag.alvo = dr > 0 ? { r1: o.r1, c1: o.c1, r2: r, c2: o.c2 } : { r1: r, c1: o.c1, r2: o.r2, c2: o.c2 };
        else if (dc) V.fillDrag.alvo = dc > 0 ? { r1: o.r1, c1: o.c1, r2: o.r2, c2: c } : { r1: o.r1, c1: c, r2: o.r2, c2: o.c2 };
        else V.fillDrag.alvo = null;
        render(); break;
      }
    }
  }
  function onDragEnd() {
    removeEventListener('mousemove', onDragMove); clearInterval(autoScrollT); hideSizeTip();
    const d = drag; drag = null;
    if (!d) return;
    if (d.k === 'colsize' && d.nw !== undefined && SD.app) SD.app.setColWidth(colsTargets(d.c), d.nw);
    else if (d.k === 'rowsize' && d.nh !== undefined && SD.app) SD.app.setRowHeight(rowsTargets(d.r), d.nh);
    else if (d.k === 'fill') { const f = V.fillDrag; V.fillDrag = null; if (f && f.alvo && SD.app) SD.app.preencher(f.orig, f.alvo); render(); }
    else if (d.k === 'point') { V.pointing = null; ed.focus(); }
    else if (d.k === 'pick') { /* continua até confirmar no diálogo */ }
    rebuildAxes(); render();
  }
  // redimensiona todas as colunas selecionadas inteiras, se a coluna arrastada fizer parte
  function colsTargets(c) { const g = V.sel; if (g.r1 === 0 && g.r2 >= MAX_R - 1 && c >= g.c1 && c <= g.c2) { const o = []; for (let k = g.c1; k <= g.c2; k++) o.push(k); return o; } return [c]; }
  function rowsTargets(r) { const g = V.sel; if (g.c1 === 0 && g.c2 >= MAX_C - 1 && r >= g.r1 && r <= g.r2) { const o = []; for (let k = g.r1; k <= g.r2; k++) o.push(k); return o; } return [r]; }
  let tipEl = null;
  function showSizeTip(p, t) { if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'sizetip'; host.appendChild(tipEl); } tipEl.textContent = t; tipEl.style.left = (p.x + 12) + 'px'; tipEl.style.top = (p.y + 12) + 'px'; tipEl.hidden = false; }
  function hideSizeTip() { if (tipEl) tipEl.hidden = true; }
  function onDblClick(e) {
    const h = hit(local(e));
    if (h.k === 'colsize' && SD.app) { SD.app.autoAjustarColunas(colsTargets(h.c)); return; }
    if (h.k === 'rowsize' && SD.app) { SD.app.autoAjustarLinhas(rowsTargets(h.r)); return; }
    if (h.k === 'fill' && SD.app) { SD.app.preencherAteFim(); return; }
    if (h.k === 'cell') { select(h.r, h.c); startEdit(undefined, 'editar'); }
  }

  /* ======================================================================
     Teclado (o editor fica sempre focado, invisível, sobre a célula ativa)
     ====================================================================== */
  function onKeyDown(e) {
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (SD.app && SD.app.teclaGlobal && SD.app.teclaGlobal(e)) return;
    if (V.edit) {
      if (SD.app && SD.app.teclaAutocompletar && SD.app.teclaAutocompletar(e)) return;
      if (k === 'Enter' && !e.altKey) { e.preventDefault(); commitEdit(e.shiftKey ? [-1, 0] : [1, 0]); return; }
      if (k === 'Enter' && e.altKey) { e.preventDefault(); const p = ed.selectionStart; ed.value = ed.value.slice(0, p) + '\n' + ed.value.slice(ed.selectionEnd); ed.setSelectionRange(p + 1, p + 1); onEditInput(); return; }
      if (k === 'Tab') { e.preventDefault(); commitEdit(e.shiftKey ? [0, -1] : [0, 1]); return; }
      if (k === 'Escape') { e.preventDefault(); cancelEdit(); return; }
      if (k === 'F2') { e.preventDefault(); V.edit.modo = V.edit.modo === 'entrar' ? 'editar' : 'entrar'; SD.app && SD.app.status && SD.app.status(V.edit.modo === 'editar' ? 'Editar' : 'Entrar'); return; }
      if (V.edit.modo === 'entrar' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k) && !canPoint()) {
        e.preventDefault(); commitEdit(k === 'ArrowUp' ? [-1, 0] : k === 'ArrowDown' ? [1, 0] : k === 'ArrowLeft' ? [0, -1] : [0, 1]); return;
      }
      V.pointing = null;
      return; // digitação normal no editor
    }
    if (V.chartSel && (k === 'Delete' || k === 'Backspace')) { e.preventDefault(); SD.app.excluirGrafico(V.chartSel); return; }
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[k]) { e.preventDefault(); moveAct(arrows[k][0], arrows[k][1], e.shiftKey, ctrl); return; }
    if (k === 'Enter') { e.preventDefault(); moveInSel(e.shiftKey ? -1 : 1, 'r'); return; }
    if (k === 'Tab') { e.preventDefault(); moveInSel(e.shiftKey ? -1 : 1, 'c'); return; }
    if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); const n = Math.max(1, Math.floor((H - HDR_H) / (SD.DEF_H * z())) - 1); moveAct(k === 'PageDown' ? n : -n, 0, e.shiftKey); return; }
    if (k === 'Home') { e.preventDefault(); if (ctrl) select(0, 0); else select(V.act.r, 0, e.shiftKey); return; }
    if (k === 'End' && ctrl) { e.preventDefault(); const u = SD.sheetUsed(sh()); select(Math.max(0, u.r2), Math.max(0, u.c2), e.shiftKey); return; }
    if (k === 'F2') { e.preventDefault(); startEdit(undefined, 'editar'); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); if (SD.app) SD.app.limparConteudo(); return; }
    if (k === 'Escape') { if (V.clip) { V.clip = null; render(); } return; }
    if (ctrl && k.toLowerCase() === 'a') { e.preventDefault(); V.sel = { r1: 0, c1: 0, r2: MAX_R - 1, c2: MAX_C - 1 }; changed(); return; }
    if (ctrl && (k === ' ')) { e.preventDefault(); V.sel = { r1: 0, r2: MAX_R - 1, c1: V.sel.c1, c2: V.sel.c2 }; changed(); return; }
    if (e.shiftKey && k === ' ' && !ctrl) { e.preventDefault(); V.sel = { r1: V.sel.r1, r2: V.sel.r2, c1: 0, c2: MAX_C - 1 }; changed(); return; }
    if (ctrl || e.altKey) return; // atalhos tratados no app
    if (k.length === 1) { e.preventDefault(); startEdit(k, 'entrar'); return; }
  }
  function moveInSel(d, axis) {
    const g = V.sel;
    if (g.r1 === g.r2 && g.c1 === g.c2 || mergeEq(g)) { moveAct(axis === 'r' ? d : 0, axis === 'c' ? d : 0); return; }
    let { r, c } = V.act;
    if (axis === 'r') { r += d; if (r > g.r2) { r = g.r1; c++; if (c > g.c2) c = g.c1; } if (r < g.r1) { r = g.r2; c--; if (c < g.c1) c = g.c2; } }
    else { c += d; if (c > g.c2) { c = g.c1; r++; if (r > g.r2) r = g.r1; } if (c < g.c1) { c = g.c2; r--; if (r < g.r1) r = g.r2; } }
    V.act = { r, c }; scrollIntoView(r, c); changed();
  }
  const mergeEq = g => { const m = mergeAt(g.r1, g.c1); return m && m.r1 === g.r1 && m.c1 === g.c1 && m.r2 === g.r2 && m.c2 === g.c2; };

  /* ======================================================================
     Área de transferência
     ====================================================================== */
  function onCopy(e, corte) {
    if (V.edit || !gridFocused()) return;
    if (V.chartSel) return;
    const g = boundSel();
    const s = sh();
    const linhas = [], html = ['<table>'];
    const dados = [];
    for (let r = g.r1; r <= g.r2; r++) {
      if (s.hiddenRows.has(r)) continue;
      const row = [], hrow = [], drow = [];
      for (let c = g.c1; c <= g.c2; c++) {
        const cell = s.cells.get(r + ',' + c);
        const t = cell ? SD.formatValue(valOf(cell), cell.s && cell.s.z).t : '';
        row.push(/[\t\n"]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t);
        const st = cell && cell.s || {};
        const css = [st.b ? 'font-weight:bold' : '', st.i ? 'font-style:italic' : '', st.bg ? 'background:' + st.bg : '', st.fc ? 'color:' + st.fc : ''].filter(Boolean).join(';');
        hrow.push('<td' + (css ? ' style="' + css + '"' : '') + '>' + t.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</td>');
        drow.push(cell ? SD.cloneCell(cell) : null);
      }
      linhas.push(row.join('\t')); html.push('<tr>' + hrow.join('') + '</tr>'); dados.push(drow);
    }
    html.push('</table>');
    const texto = linhas.join('\r\n');
    e.clipboardData.setData('text/plain', texto);
    e.clipboardData.setData('text/html', html.join(''));
    e.preventDefault();
    V.clip = { si: V.si, g, corte: !!corte, dados, texto, merges: s.merges.filter(m => m.r1 >= g.r1 && m.r2 <= g.r2 && m.c1 >= g.c1 && m.c2 <= g.c2).map(m => ({ r1: m.r1 - g.r1, c1: m.c1 - g.c1, r2: m.r2 - g.r1, c2: m.c2 - g.c1 })) };
    animClip();
    if (SD.app && SD.app.toast) SD.app.toast(corte ? 'Recortado. Escolha onde colar (Ctrl+V).' : 'Copiado. Escolha onde colar (Ctrl+V).');
  }
  let clipAnim = null;
  function animClip() { cancelAnimationFrame(clipAnim); const tick = () => { if (!V.clip) return; render(); clipAnim = requestAnimationFrame(() => setTimeout(tick, 80)); }; tick(); }
  function onPaste(e) {
    if (V.edit || !gridFocused()) return;
    const txt = e.clipboardData.getData('text/plain');
    const html = e.clipboardData.getData('text/html');
    e.preventDefault();
    if (SD.app) SD.app.colar(txt, html);
  }
  function gridFocused() { return document.activeElement === ed || document.activeElement === document.body || host.contains(document.activeElement); }

  /* ======================================================================
     Camada dos gráficos (cada gráfico é um elemento com um canvas)
     ====================================================================== */
  const chartEls = new Map();
  function syncCharts() {
    const list = sh().charts;
    const ids = new Set(list.map(c => c.id));
    chartEls.forEach((el, id) => { if (!ids.has(id)) { el.remove(); chartEls.delete(id); } });
    list.forEach(ch => {
      let el = chartEls.get(ch.id);
      if (!el) {
        el = document.createElement('div'); el.className = 'chart'; el.dataset.id = ch.id; el.tabIndex = -1;
        el.innerHTML = '<canvas></canvas><i class="h nw"></i><i class="h ne"></i><i class="h sw"></i><i class="h se"></i><i class="h n"></i><i class="h s"></i><i class="h w"></i><i class="h e"></i>';
        el.addEventListener('mousedown', chartMouseDown);
        el.addEventListener('dblclick', () => SD.app && SD.app.painelGrafico && SD.app.painelGrafico(ch.id));
        el.addEventListener('contextmenu', ev => { ev.preventDefault(); selectChart(ch.id); SD.app && SD.app.menuGrafico && SD.app.menuGrafico(ev, ch.id); });
        layer.appendChild(el); chartEls.set(ch.id, el);
      }
      el.classList.toggle('sel', V.chartSel === ch.id);
    });
    // planilhas que não estão na tela: some com os elementos
    chartEls.forEach((el, id) => { if (!list.some(c => c.id === id)) { el.remove(); chartEls.delete(id); } });
    redrawCharts();
  }
  function redrawCharts() {
    const list = sh().charts;
    list.forEach(ch => {
      const el = chartEls.get(ch.id); if (!el) return;
      const cvs = el.querySelector('canvas');
      const Z = z(), w = ch.w * Z, h = ch.h * Z;
      const d = window.devicePixelRatio || 1;
      cvs.width = Math.round(w * d); cvs.height = Math.round(h * d); cvs.style.width = w + 'px'; cvs.style.height = h + 'px';
      const c2 = cvs.getContext('2d'); c2.setTransform(d * Z, 0, 0, d * Z, 0, 0);
      SD.G.desenhar(c2, ch.w, ch.h, ch, SD.G.dados(V.wb, ch), SD.temaGrafico());
    });
    positionCharts();
  }
  function positionCharts() {
    if (!layer) return;
    layer.style.left = HDR_W + 'px'; layer.style.top = HDR_H + 'px'; layer.style.width = (W - HDR_W) + 'px'; layer.style.height = (H - HDR_H) + 'px';
    const Z = z();
    sh().charts.forEach(ch => {
      const el = chartEls.get(ch.id); if (!el) return;
      const x = ch.x * Z - V.sx, y = ch.y * Z - V.sy;
      el.style.transform = `translate(${x}px,${y}px)`; el.style.width = ch.w * Z + 'px'; el.style.height = ch.h * Z + 'px';
    });
  }
  function selectChart(id) {
    if (V.chartSel === id) return;
    V.chartSel = id;
    chartEls.forEach((el, k) => el.classList.toggle('sel', k === id));
    if (SD.app && SD.app.onChartSelect) SD.app.onChartSelect(id);
  }
  function chartMouseDown(e) {
    if (e.button !== 0) return;
    const el = e.currentTarget, id = el.dataset.id, ch = sh().charts.find(c => c.id === id);
    if (!ch) return;
    e.preventDefault(); e.stopPropagation();
    if (V.edit) commitEdit();
    selectChart(id);
    const handle = e.target.classList.contains('h') ? [...e.target.classList].find(c => c !== 'h') : null;
    const start = { x: e.clientX, y: e.clientY, ch: Object.assign({}, ch) };
    let moved = false;
    if (SD.app && SD.app.antesGrafico) SD.app.antesGrafico();
    const mm = ev => {
      const dx = (ev.clientX - start.x) / z(), dy = (ev.clientY - start.y) / z();
      if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
      if (!handle) { ch.x = Math.max(0, Math.round(start.ch.x + dx)); ch.y = Math.max(0, Math.round(start.ch.y + dy)); }
      else {
        if (/e/.test(handle)) ch.w = Math.max(160, Math.round(start.ch.w + dx));
        if (/s/.test(handle)) ch.h = Math.max(110, Math.round(start.ch.h + dy));
        if (/w/.test(handle)) { const nw = Math.max(160, Math.round(start.ch.w - dx)); ch.x = Math.max(0, start.ch.x + (start.ch.w - nw)); ch.w = nw; }
        if (/n/.test(handle)) { const nh = Math.max(110, Math.round(start.ch.h - dy)); ch.y = Math.max(0, start.ch.y + (start.ch.h - nh)); ch.h = nh; }
        redrawCharts();
      }
      positionCharts();
    };
    const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); if (SD.app && SD.app.depoisGrafico) SD.app.depoisGrafico(moved); ed.focus({ preventScroll: true }); };
    addEventListener('mousemove', mm); addEventListener('mouseup', mu);
  }

  /* ======================================================================
     Montagem
     ====================================================================== */
  function mount(el) {
    host = el;
    host.innerHTML = '<canvas class="gc"></canvas><div class="gs"><div class="gsz"></div></div><div class="glayer"></div><textarea class="ged" spellcheck="false" autocomplete="off" aria-label="Editor da célula"></textarea>';
    cv = host.querySelector('.gc'); ctx = cv.getContext('2d');
    scroller = host.querySelector('.gs'); sizer = host.querySelector('.gsz'); layer = host.querySelector('.glayer'); ed = host.querySelector('.ged');
    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.addEventListener('mousedown', onMouseDown);
    scroller.addEventListener('mousemove', onMouseMove);
    scroller.addEventListener('dblclick', onDblClick);
    scroller.addEventListener('contextmenu', e => { e.preventDefault(); const h = hit(local(e)); if (SD.app && SD.app.menuContexto) SD.app.menuContexto(e, h); });
    layer.addEventListener('wheel', e => { scroller.scrollLeft += e.deltaX; scroller.scrollTop += e.deltaY; }, { passive: true });
    scroller.addEventListener('wheel', e => {
      if (e.ctrlKey) { e.preventDefault(); const nz = Math.max(0.5, Math.min(2.5, z() * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); setZoom(Math.round(nz * 100) / 100); }
    }, { passive: false });
    ed.addEventListener('keydown', onKeyDown);
    ed.addEventListener('input', () => { if (V.edit) { V.pointing = null; onEditInput(); } else { const v = ed.value; ed.value = ''; if (v) { startEdit(v, 'entrar'); } } });
    ed.addEventListener('compositionstart', () => { if (!V.edit) startEdit('', 'entrar'); });
    ed.addEventListener('click', () => { V.pointing = null; });
    document.addEventListener('copy', e => onCopy(e, false));
    document.addEventListener('cut', e => onCopy(e, true));
    document.addEventListener('paste', onPaste);
    new ResizeObserver(() => resize()).observe(host);
    lerTema();
  }
  function setWorkbook(wb, keepView) {
    V.wb = wb; V.si = Math.min(wb.active || 0, wb.sheets.length - 1);
    if (!keepView) { V.act = { r: 0, c: 0 }; V.sel = { r1: 0, c1: 0, r2: 0, c2: 0 }; V.anchor = { r: 0, c: 0 }; V.sx = V.sy = 0; }
    V.clip = null; V.edit = null; V.chartSel = null; V.nRows = 1000; V.nCols = 52;
    chartEls.forEach(el => el.remove()); chartEls.clear();
    rebuildAxes(); updateSizer();
    if (scroller) { scroller.scrollLeft = V.sx; scroller.scrollTop = V.sy; }
    syncCharts(); changed();
  }
  // volta para a planilha onde a fórmula estava sendo escrita
  function voltarPlanilha(i) {
    V.si = i; V.wb.active = i;
    chartEls.forEach(el => el.remove()); chartEls.clear();
    rebuildAxes(); updateSizer(); syncCharts();
    if (SD.app && SD.app.onSheetChange) SD.app.onSheetChange();
  }
  function setSheet(i) {
    // escrevendo uma fórmula: troca de planilha para apontar células de outra planilha
    if (V.edit && ed.value[0] !== '=') commitEdit();
    V.si = i; V.wb.active = i;
    if (V.edit) { chartEls.forEach(el => el.remove()); chartEls.clear(); rebuildAxes(); updateSizer(); scroller.scrollLeft = 0; scroller.scrollTop = 0; V.sx = V.sy = 0; syncCharts(); render(); ed.focus(); return; }
    V.act = { r: 0, c: 0 }; V.sel = { r1: 0, c1: 0, r2: 0, c2: 0 }; V.anchor = { r: 0, c: 0 };
    chartEls.forEach(el => el.remove()); chartEls.clear(); V.chartSel = null;
    V.nRows = 1000; V.nCols = 52;
    rebuildAxes(); updateSizer();
    scroller.scrollLeft = 0; scroller.scrollTop = 0; V.sx = V.sy = 0;
    syncCharts(); changed();
    if (V.edit) ed.focus();
  }
  function setZoom(zz) { sh().zoom = zz; updateSizer(); redrawCharts(); draw(); if (SD.app && SD.app.onZoom) SD.app.onZoom(zz); }
  function refresh(full) { if (full) rebuildAxes(); updateSizer(); redrawCharts(); render(); }

  /** Desenha uma área inteira, sem cabeçalhos (exportação JPG). */
  SD.pintarArea = function (c2d, wb, s, g, opt) {
    const cA = new Eixo(SD.DEF_W, s.colW, null), rA = new Eixo(SD.DEF_H, s.rowH, s.hiddenRows);
    const x0 = cA.pos(g.c1), y0 = rA.pos(g.r1);
    const geo = { zoom: 1, x: c => cA.pos(c) - x0, y: r => rA.pos(r) - y0, w: c => cA.size(c), h: r => rA.size(r) };
    const T = Object.assign({}, V.tema, { fundo: '#ffffff', tinta: '#1b1d24', grade: '#d9dce3', escuro: false });
    const saved = V.wb, savedSi = V.si; V.wb = wb; V.si = wb.sheets.indexOf(s);
    try { paintCells(c2d, s, geo, g.r1, g.r2, g.c1, g.c2, { grade: opt.grade && s.showGrid !== false, tema: T }); }
    finally { V.wb = saved; V.si = savedSi; }
  };
  SD.temaGrafico = () => {
    const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
    return { fundo: g('--chart-bg') || '#ffffff', tinta: g('--chart-ink') || '#222631', tinta2: g('--chart-ink2') || '#5b6170', grade: g('--chart-grid') || 'rgba(120,130,150,.22)', fonte: g('--ui-font') || 'system-ui, sans-serif', paleta: document.documentElement.dataset.skin === 'nebulosa' ? 'nebulosa' : 'stardust' };
  };
  SD.temaGraficoImpressao = () => ({ fundo: '#ffffff', tinta: '#222631', tinta2: '#5b6170', grade: 'rgba(120,130,150,.25)', fonte: 'Helvetica, Arial, sans-serif', paleta: document.documentElement.dataset.skin === 'nebulosa' ? 'nebulosa' : 'stardust' });

  SD.grid = {
    V, mount, setWorkbook, setSheet, setZoom, refresh, render, draw, select, setSelection, startEdit, commitEdit, cancelEdit, insertRef,
    syncCharts, redrawCharts, selectChart, boundSel, lerTema, cellRect, rangeRect, rebuildAxes, scrollIntoView, colsTargets, rowsTargets,
    get editor() { return ed; }, onKeyDown, get host() { return host; }, MAX_R, MAX_C, fontOf, wrapText, measureCtx: () => ctx, mergeAt, jump, visibleRange,
    editando: () => !!V.edit, valorEditor: () => ed.value,
    setEditorValue: v => { if (!V.edit) startEdit('', 'editar'); ed.value = v; onEditInput(); },
    focus: () => ed.focus({ preventScroll: true })
  };
})();
