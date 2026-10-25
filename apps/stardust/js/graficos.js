/* ==========================================================================
   Stardust — js/graficos.js
   Gráficos desenhados no próprio navegador (canvas): colunas, barras,
   linhas, área, pizza, rosca e dispersão. O mesmo desenho é usado na tela,
   na exportação em JPG/PDF e na imagem do gráfico.
   ========================================================================== */
(function () {
  'use strict';
  const SD = window.SD;

  const TIPOS = [
    { id: 'colunas', nome: 'Colunas' },
    { id: 'barras', nome: 'Barras' },
    { id: 'linhas', nome: 'Linhas' },
    { id: 'area', nome: 'Área' },
    { id: 'pizza', nome: 'Pizza' },
    { id: 'rosca', nome: 'Rosca' },
    { id: 'dispersao', nome: 'Dispersão' }
  ];
  const PALETAS = {
    stardust: ['#4d8fd6', '#a244f5', '#f23fb0', '#ff8a2b', '#19c6f5', '#5fc48b', '#ffd23f', '#7f8cff', '#e8677a', '#3fb8a9'],
    nebulosa: ['#A778FF', '#FF9C54', '#FEFF36', '#6f74c9', '#ff6fa8', '#5fd3c6', '#c9a8ff', '#ffc38f', '#8b8fd6', '#e0e36a'],
    sobrio: ['#3b6ea8', '#6b8fb5', '#9bb3cc', '#c87d3a', '#7d8c5a', '#8a6fa8', '#5b9a95', '#b05c5c', '#999999', '#d1a33c']
  };

  /* ---------- dados do gráfico a partir do intervalo ---------- */
  function dados(wb, chart) {
    const sh = wb.sheets.find(s => s.charts.includes(chart)) || wb.sheets.find(s => s.id === chart.sheetId) || wb.sheets[wb.active] || wb.sheets[0];
    const g = SD.parseRange(chart.range || 'A1');
    if (!g) return { cats: [], series: [] };
    const val = (r, c) => { const cell = sh.cells.get(r + ',' + c); if (!cell) return null; const v = cell.f ? cell.val : cell.v; return SD.isErr(v) ? null : v; };
    const fmt = (r, c) => { const cell = sh.cells.get(r + ',' + c); const v = val(r, c); if (v === null || v === undefined) return ''; return SD.formatValue(v, cell && cell.s && cell.s.z).t; };
    const rows = g.r2 - g.r1 + 1, cols = g.c2 - g.c1 + 1;
    const isNum = v => typeof v === 'number';
    // primeira linha é cabeçalho? (tem texto, ou está vazia no canto)
    let headRow = false;
    for (let c = g.c1; c <= g.c2; c++) { const v = val(g.r1, c); if (typeof v === 'string' && v.trim()) { headRow = true; break; } }
    if (rows === 1) headRow = false;
    // primeira coluna são rótulos? (tem texto ou datas)
    let labelCol = false;
    for (let r = g.r1 + (headRow ? 1 : 0); r <= g.r2; r++) {
      const v = val(r, g.c1), cell = sh.cells.get(r + ',' + g.c1);
      if ((typeof v === 'string' && v.trim()) || (isNum(v) && cell && cell.s && SD.isDateFormat(cell.s.z))) { labelCol = true; break; }
    }
    if (cols === 1) labelCol = false;
    if (chart.tipo === 'dispersao' && cols > 1) labelCol = true;
    const porLinhas = chart.porLinhas === undefined ? (rows - (headRow ? 1 : 0) < cols - (labelCol ? 1 : 0) && rows <= 3) : !!chart.porLinhas;
    const r0 = g.r1 + (headRow ? 1 : 0), c0 = g.c1 + (labelCol ? 1 : 0);
    const out = { cats: [], series: [], catNums: [] };
    if (!porLinhas) {
      for (let r = r0; r <= g.r2; r++) { out.cats.push(labelCol ? fmt(r, g.c1) : String(r - r0 + 1)); out.catNums.push(labelCol ? val(r, g.c1) : r - r0 + 1); }
      for (let c = c0; c <= g.c2; c++) {
        const name = headRow ? fmt(g.r1, c) : 'Série ' + (c - c0 + 1);
        const values = []; for (let r = r0; r <= g.r2; r++) { const v = val(r, c); values.push(isNum(v) ? v : null); }
        out.series.push({ name, values, ref: { r1: r0, c1: c, r2: g.r2, c2: c }, nameRef: headRow ? { r: g.r1, c } : null });
      }
      out.catRef = labelCol ? { r1: r0, c1: g.c1, r2: g.r2, c2: g.c1 } : null;
    } else {
      for (let c = c0; c <= g.c2; c++) { out.cats.push(headRow ? fmt(g.r1, c) : String(c - c0 + 1)); out.catNums.push(headRow ? val(g.r1, c) : c - c0 + 1); }
      for (let r = r0; r <= g.r2; r++) {
        const name = labelCol ? fmt(r, g.c1) : 'Série ' + (r - r0 + 1);
        const values = []; for (let c = c0; c <= g.c2; c++) { const v = val(r, c); values.push(isNum(v) ? v : null); }
        out.series.push({ name, values, ref: { r1: r, c1: c0, r2: r, c2: g.c2 }, nameRef: labelCol ? { r, c: g.c1 } : null });
      }
      out.catRef = headRow ? { r1: g.r1, c1: c0, r2: g.r1, c2: g.c2 } : null;
    }
    out.porLinhas = porLinhas;
    out.sheetName = sh.name;
    return out;
  }

  /* ---------- números do eixo ---------- */
  function niceStep(span, n) {
    const raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }
  function axis(min, max, n) {
    if (min === max) { if (min === 0) { max = 1; } else { const d = Math.abs(min) * 0.1; min -= d; max += d; } }
    if (min > 0 && min / max < 0.5) min = 0;
    if (max < 0 && max / min < 0.5) max = 0;
    const st = niceStep(max - min, n);
    const lo = Math.floor(min / st) * st, hi = Math.ceil(max / st) * st;
    const ticks = []; for (let v = lo; v <= hi + st / 2; v += st) ticks.push(Math.abs(v) < st / 1e6 ? 0 : v);
    return { lo, hi, ticks, st };
  }
  function fmtNum(v) {
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' bi';
    if (a >= 1e6) return (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
    if (a >= 1e4) return (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return v.toLocaleString('pt-BR', { maximumFractionDigits: a < 1 && a > 0 ? 3 : 2 });
  }

  /* ---------- desenho ---------- */
  function desenhar(ctx, W, H, chart, D, tema) {
    tema = Object.assign({ fundo: '#ffffff', tinta: '#222631', tinta2: '#5b6170', grade: 'rgba(120,130,150,.22)', fonte: 'system-ui, "Segoe UI", Roboto, sans-serif', paleta: 'stardust' }, tema || {});
    const cores = PALETAS[chart.paleta || tema.paleta] || PALETAS.stardust;
    const cor = i => cores[i % cores.length];
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (tema.fundo) { ctx.fillStyle = tema.fundo; ctx.fillRect(0, 0, W, H); }
    const F = (px, w) => (w || '') + ' ' + px + 'px ' + tema.fonte;
    let top = 12, bottom = H - 10, left = 12, right = W - 14;
    // título
    if (chart.titulo) {
      ctx.fillStyle = tema.tinta; ctx.font = F(Math.max(12, Math.min(18, W / 26)), '600'); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(clip(ctx, chart.titulo, W - 24), W / 2, top);
      top += Math.max(12, Math.min(18, W / 26)) + 12;
    }
    const series = D.series.filter(s => s.values.some(v => v !== null));
    const circular = chart.tipo === 'pizza' || chart.tipo === 'rosca';
    if (!series.length) {
      ctx.fillStyle = tema.tinta2; ctx.font = F(13); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Sem números no intervalo ' + (chart.range || ''), W / 2, (top + bottom) / 2);
      ctx.restore(); return;
    }
    // legenda
    const legItems = circular ? D.cats.map((c, i) => ({ t: c || '(vazio)', c: cor(i) })) : series.map((s, i) => ({ t: s.name, c: cor(i) }));
    const legPos = chart.legenda || (legItems.length > 1 || circular ? 'baixo' : 'nenhuma');
    ctx.font = F(11.5);
    if (legPos === 'baixo' && legItems.length) {
      const rowsL = [[]]; let x = 0; const maxW = right - left;
      legItems.forEach(it => { const w = Math.min(ctx.measureText(it.t).width, 160) + 26; if (x + w > maxW && rowsL[rowsL.length - 1].length) { rowsL.push([]); x = 0; } rowsL[rowsL.length - 1].push(Object.assign(it, { w })); x += w; });
      const shown = rowsL.slice(0, 3);
      let y = bottom - shown.length * 18 + 4;
      shown.forEach(row => {
        const tw = row.reduce((s, it) => s + it.w, 0); let x2 = (W - tw) / 2;
        row.forEach(it => { ctx.fillStyle = it.c; roundRect(ctx, x2, y + 2, 10, 10, 3); ctx.fill(); ctx.fillStyle = tema.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(clip(ctx, it.t, 160), x2 + 15, y); x2 += it.w; });
        y += 18;
      });
      bottom -= shown.length * 18 + 6;
    } else if (legPos === 'direita' && legItems.length) {
      const lw = Math.min(170, Math.max(...legItems.map(it => ctx.measureText(it.t).width)) + 30);
      let y = top + 6;
      legItems.slice(0, Math.floor((bottom - top) / 18)).forEach(it => { ctx.fillStyle = it.c; roundRect(ctx, right - lw + 6, y + 2, 10, 10, 3); ctx.fill(); ctx.fillStyle = tema.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(clip(ctx, it.t, lw - 26), right - lw + 21, y); y += 18; });
      right -= lw + 6;
    }
    if (circular) desenharPizza(ctx, { left, top, right, bottom }, series[0], D, chart, tema, cor, F);
    else if (chart.tipo === 'barras') desenharBarras(ctx, { left, top, right, bottom }, series, D, chart, tema, cor, F);
    else if (chart.tipo === 'dispersao') desenharDispersao(ctx, { left, top, right, bottom }, series, D, chart, tema, cor, F);
    else desenharCartesiano(ctx, { left, top, right, bottom }, series, D, chart, tema, cor, F);
    ctx.restore();
  }
  function clip(ctx, t, w) {
    t = String(t);
    if (ctx.measureText(t).width <= w) return t;
    while (t.length > 1 && ctx.measureText(t + '…').width > w) t = t.slice(0, -1);
    return t + '…';
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function rangeOf(series, stacked, n) {
    let mn = Infinity, mx = -Infinity;
    if (stacked) {
      for (let i = 0; i < n; i++) { let p = 0, q = 0; series.forEach(s => { const v = s.values[i] || 0; if (v >= 0) p += v; else q += v; }); mx = Math.max(mx, p); mn = Math.min(mn, q); }
    } else series.forEach(s => s.values.forEach(v => { if (v !== null) { mn = Math.min(mn, v); mx = Math.max(mx, v); } }));
    if (!isFinite(mn)) { mn = 0; mx = 1; }
    return [Math.min(mn, 0), Math.max(mx, 0)];
  }
  function desenharCartesiano(ctx, B, series, D, chart, tema, cor, F) {
    const n = D.cats.length, stacked = !!chart.empilhado && chart.tipo !== 'linhas';
    const [mn, mx] = rangeOf(series, stacked, n);
    const ax = axis(mn, mx, Math.max(3, Math.floor((B.bottom - B.top) / 46)));
    ctx.font = F(11);
    const yw = Math.max(...ax.ticks.map(t => ctx.measureText(fmtNum(t)).width)) + 10;
    const x0 = B.left + yw, x1 = B.right, y0 = B.bottom - 20, y1 = B.top + 4;
    const Y = v => y0 - (v - ax.lo) / (ax.hi - ax.lo) * (y0 - y1);
    // grade e eixo Y
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ax.ticks.forEach(t => { const y = Math.round(Y(t)) + .5; ctx.strokeStyle = t === 0 ? tema.tinta2 : tema.grade; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.fillStyle = tema.tinta2; ctx.fillText(fmtNum(t), x0 - 6, y); });
    const band = (x1 - x0) / Math.max(1, n);
    // rótulos do eixo X
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = tema.tinta2;
    const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((x1 - x0) / 56))));
    D.cats.forEach((c, i) => { if (i % every === 0) ctx.fillText(clip(ctx, c, band * every - 4), x0 + band * (i + .5), y0 + 5); });
    if (chart.tipo === 'colunas') {
      const ns = stacked ? 1 : series.length, gap = band * 0.18, bw = (band - gap * 2) / ns;
      const pos = new Array(n).fill(0), neg = new Array(n).fill(0);
      series.forEach((s, k) => {
        ctx.fillStyle = cor(k);
        s.values.forEach((v, i) => {
          if (v === null) return;
          let ya, yb;
          if (stacked) { if (v >= 0) { ya = Y(pos[i] + v); yb = Y(pos[i]); pos[i] += v; } else { ya = Y(neg[i]); yb = Y(neg[i] + v); neg[i] += v; } }
          else { ya = Y(Math.max(v, 0)); yb = Y(Math.min(v, 0)); }
          const x = x0 + band * i + gap + (stacked ? 0 : bw * k);
          roundRect(ctx, x + 1, ya, Math.max(1, bw - 2), Math.max(1, yb - ya), Math.min(4, bw / 4)); ctx.fill();
          if (chart.rotulos) { ctx.save(); ctx.fillStyle = tema.tinta; ctx.font = F(10.5); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(fmtNum(v), x + bw / 2, ya - 2); ctx.restore(); ctx.fillStyle = cor(k); }
        });
      });
    } else {
      const acc = new Array(n).fill(0);
      series.forEach((s, k) => {
        const pts = s.values.map((v, i) => v === null ? null : [x0 + band * (i + .5), Y(stacked ? (acc[i] += v) : v)]);
        const base = stacked ? s.values.map((v, i) => Y(acc[i] - (v || 0))) : null;
        if (chart.tipo === 'area') {
          const valid = pts.map((p, i) => p ? [p, i] : null).filter(Boolean);
          if (valid.length) {
            ctx.beginPath(); ctx.moveTo(valid[0][0][0], stacked ? base[valid[0][1]] : Y(Math.max(ax.lo, 0)));
            valid.forEach(([p]) => ctx.lineTo(p[0], p[1]));
            if (stacked) for (let j = valid.length - 1; j >= 0; j--) ctx.lineTo(valid[j][0][0], base[valid[j][1]]);
            else ctx.lineTo(valid[valid.length - 1][0][0], Y(Math.max(ax.lo, 0)));
            ctx.closePath(); ctx.globalAlpha = .35; ctx.fillStyle = cor(k); ctx.fill(); ctx.globalAlpha = 1;
          }
        }
        ctx.strokeStyle = cor(k); ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.beginPath();
        let started = false;
        pts.forEach(p => { if (!p) { started = false; return; } if (!started) { ctx.moveTo(p[0], p[1]); started = true; } else ctx.lineTo(p[0], p[1]); });
        ctx.stroke();
        if (chart.tipo === 'linhas' && n <= 40) pts.forEach(p => { if (!p) return; ctx.beginPath(); ctx.arc(p[0], p[1], 3.4, 0, Math.PI * 2); ctx.fillStyle = tema.fundo || '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); });
        if (chart.rotulos) { ctx.fillStyle = tema.tinta; ctx.font = F(10.5); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; pts.forEach((p, i) => { if (p) ctx.fillText(fmtNum(s.values[i]), p[0], p[1] - 6); }); }
      });
    }
    ctx.strokeStyle = tema.tinta2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + .5, y1); ctx.lineTo(x0 + .5, y0); ctx.stroke();
  }
  function desenharBarras(ctx, B, series, D, chart, tema, cor, F) {
    const n = D.cats.length, stacked = !!chart.empilhado;
    const [mn, mx] = rangeOf(series, stacked, n);
    ctx.font = F(11);
    const lw = Math.min((B.right - B.left) * 0.35, Math.max(...D.cats.map(c => ctx.measureText(c).width)) + 10);
    const x0 = B.left + lw, x1 = B.right - 8, y0 = B.bottom - 20, y1 = B.top + 2;
    const ax = axis(mn, mx, Math.max(3, Math.floor((x1 - x0) / 80)));
    const X = v => x0 + (v - ax.lo) / (ax.hi - ax.lo) * (x1 - x0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ax.ticks.forEach(t => { const x = Math.round(X(t)) + .5; ctx.strokeStyle = t === 0 ? tema.tinta2 : tema.grade; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y0); ctx.stroke(); ctx.fillStyle = tema.tinta2; ctx.fillText(fmtNum(t), x, y0 + 5); });
    const band = (y0 - y1) / Math.max(1, n), ns = stacked ? 1 : series.length, gap = band * 0.18, bh = (band - gap * 2) / ns;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    D.cats.forEach((c, i) => { ctx.fillStyle = tema.tinta2; ctx.fillText(clip(ctx, c, lw - 10), x0 - 6, y1 + band * (i + .5)); });
    const pos = new Array(n).fill(0), neg = new Array(n).fill(0);
    series.forEach((s, k) => {
      s.values.forEach((v, i) => {
        if (v === null) return;
        let xa, xb;
        if (stacked) { if (v >= 0) { xa = X(pos[i]); xb = X(pos[i] + v); pos[i] += v; } else { xb = X(neg[i]); xa = X(neg[i] + v); neg[i] += v; } }
        else { xa = X(Math.min(v, 0)); xb = X(Math.max(v, 0)); }
        const y = y1 + band * i + gap + (stacked ? 0 : bh * k);
        ctx.fillStyle = cor(k); roundRect(ctx, xa, y + 1, Math.max(1, xb - xa), Math.max(1, bh - 2), Math.min(4, bh / 4)); ctx.fill();
        if (chart.rotulos) { ctx.fillStyle = tema.tinta; ctx.font = F(10.5); ctx.textAlign = 'left'; ctx.fillText(fmtNum(v), xb + 4, y + bh / 2); ctx.textAlign = 'right'; }
      });
    });
  }
  function desenharDispersao(ctx, B, series, D, chart, tema, cor, F) {
    const xs = D.catNums.map(v => typeof v === 'number' ? v : null);
    const okX = xs.filter(v => v !== null);
    const xmn = okX.length ? Math.min(...okX) : 0, xmx = okX.length ? Math.max(...okX) : 1;
    let mn = Infinity, mx = -Infinity; series.forEach(s => s.values.forEach(v => { if (v !== null) { mn = Math.min(mn, v); mx = Math.max(mx, v); } }));
    const ay = axis(mn, mx, 5);
    ctx.font = F(11);
    const yw = Math.max(...ay.ticks.map(t => ctx.measureText(fmtNum(t)).width)) + 10;
    const x0 = B.left + yw, x1 = B.right, y0 = B.bottom - 20, y1 = B.top + 4;
    const axx = axis(xmn, xmx, Math.max(3, Math.floor((x1 - x0) / 70)));
    const X = v => x0 + (v - axx.lo) / (axx.hi - axx.lo) * (x1 - x0), Y = v => y0 - (v - ay.lo) / (ay.hi - ay.lo) * (y0 - y1);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ay.ticks.forEach(t => { const y = Math.round(Y(t)) + .5; ctx.strokeStyle = tema.grade; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.fillStyle = tema.tinta2; ctx.fillText(fmtNum(t), x0 - 6, y); });
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    axx.ticks.forEach(t => { const x = Math.round(X(t)) + .5; ctx.strokeStyle = tema.grade; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y0); ctx.stroke(); ctx.fillStyle = tema.tinta2; ctx.fillText(fmtNum(t), x, y0 + 5); });
    series.forEach((s, k) => {
      ctx.fillStyle = cor(k);
      s.values.forEach((v, i) => { if (v === null || xs[i] === null) return; ctx.beginPath(); ctx.arc(X(xs[i]), Y(v), 4, 0, Math.PI * 2); ctx.fill(); });
    });
  }
  function desenharPizza(ctx, B, s, D, chart, tema, cor, F) {
    const vals = s.values.map(v => v && v > 0 ? v : 0), tot = vals.reduce((a, b) => a + b, 0);
    const cx = (B.left + B.right) / 2, cy = (B.top + B.bottom) / 2, R = Math.max(10, Math.min(B.right - B.left, B.bottom - B.top) / 2 - 6);
    if (!tot) return;
    let a = -Math.PI / 2;
    vals.forEach((v, i) => {
      if (!v) return;
      const da = v / tot * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a, a + da); ctx.closePath(); ctx.fillStyle = cor(i); ctx.fill();
      ctx.strokeStyle = tema.fundo || '#fff'; ctx.lineWidth = 2; ctx.stroke();
      a += da;
    });
    if (chart.tipo === 'rosca') { ctx.beginPath(); ctx.arc(cx, cy, R * 0.56, 0, Math.PI * 2); ctx.fillStyle = tema.fundo || '#fff'; ctx.fill(); }
    if (chart.rotulos !== false) {
      a = -Math.PI / 2; ctx.font = F(Math.max(10, Math.min(13, R / 8)), '600'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      vals.forEach((v, i) => {
        const da = v / tot * Math.PI * 2;
        if (v && da > 0.25) {
          const m = a + da / 2, rr = chart.tipo === 'rosca' ? R * 0.78 : R * 0.64;
          const c = SD.hexToRgb(cor(i)); const lum = c ? (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 : 0;
          ctx.fillStyle = lum > 0.6 ? '#1b1d24' : '#ffffff';
          ctx.fillText(Math.round(v / tot * 100) + '%', cx + Math.cos(m) * rr, cy + Math.sin(m) * rr);
        }
        a += da;
      });
    }
  }

  /** Desenha num canvas novo e devolve o canvas (para exportar). */
  function imagem(wb, chart, w, h, escala, tema) {
    const cv = document.createElement('canvas');
    escala = escala || 2;
    cv.width = Math.round(w * escala); cv.height = Math.round(h * escala);
    const ctx = cv.getContext('2d'); ctx.scale(escala, escala);
    desenhar(ctx, w, h, chart, dados(wb, chart), tema);
    return cv;
  }

  SD.G = { TIPOS, PALETAS, dados, desenhar, imagem, fmtNum };
})();
