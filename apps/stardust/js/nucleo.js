/* ==========================================================================
   Stardust — js/nucleo.js
   Modelo da pasta de trabalho (planilhas, células, estilos), endereços de
   células (A1), leitura do que a pessoa digita e formatação de números no
   jeito brasileiro (vírgula decimal, ponto de milhar, R$, datas dd/mm/aaaa).
   ========================================================================== */
(function () {
  'use strict';
  const SD = window.SD = window.SD || {};

  /* ---------- endereços ---------- */
  const colName = c => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
  const colIndex = s => { let n = 0; s = s.toUpperCase(); for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64); return n - 1; };
  const addr = (r, c) => colName(c) + (r + 1);
  const key = (r, c) => r + ',' + c;
  const unkey = k => { const i = k.indexOf(','); return [+k.slice(0, i), +k.slice(i + 1)]; };
  function parseAddr(a) {
    const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(String(a).trim());
    return m ? { r: +m[2] - 1, c: colIndex(m[1]) } : null;
  }
  function parseRange(s) {
    s = String(s).trim().replace(/\$/g, '');
    const p = s.split(':');
    const a = parseAddr(p[0]); if (!a) return null;
    const b = p[1] ? parseAddr(p[1]) : a; if (!b) return null;
    return norm({ r1: a.r, c1: a.c, r2: b.r, c2: b.c });
  }
  const norm = g => ({ r1: Math.min(g.r1, g.r2), c1: Math.min(g.c1, g.c2), r2: Math.max(g.r1, g.r2), c2: Math.max(g.c1, g.c2) });
  const rangeStr = g => g.r1 === g.r2 && g.c1 === g.c2 ? addr(g.r1, g.c1) : addr(g.r1, g.c1) + ':' + addr(g.r2, g.c2);
  const inRange = (g, r, c) => r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;

  /* ---------- erros ---------- */
  class Err { constructor(code) { this.err = code; } toString() { return this.err; } }
  const ERR = {};
  ['#NULO!', '#DIV/0!', '#VALOR!', '#REF!', '#NOME?', '#NÚM!', '#N/D', '#CIRC!'].forEach(e => { ERR[e] = new Err(e); });
  // nomes do Excel em inglês (arquivos) ↔ português (tela)
  const ERR_EN = { '#NULO!': '#NULL!', '#DIV/0!': '#DIV/0!', '#VALOR!': '#VALUE!', '#REF!': '#REF!', '#NOME?': '#NAME?', '#NÚM!': '#NUM!', '#N/D': '#N/A', '#CIRC!': '#REF!' };
  const ERR_PT = {}; Object.keys(ERR_EN).forEach(k => { if (k !== '#CIRC!') ERR_PT[ERR_EN[k]] = k; });
  const isErr = v => v instanceof Err;
  /* [Nebulosa] idiomas (0.6): erros e VERDADEIRO/FALSO aparecem no idioma escolhido (por dentro continuam iguais) */
  const idioma = () => (window.NebulosaIdiomas ? window.NebulosaIdiomas.atual() : 'pt-BR');
  const ERR_ES = { '#NULO!': '#¡NULO!', '#DIV/0!': '#¡DIV/0!', '#VALOR!': '#¡VALOR!', '#REF!': '#¡REF!', '#NOME?': '#¿NOMBRE?', '#NÚM!': '#¡NUM!', '#N/D': '#N/A', '#CIRC!': '#CIRC!' };
  const ERR_EN_TELA = Object.assign({}, ERR_EN, { '#CIRC!': '#CIRC!' });
  const errTela = code => { const l = idioma(); return l === 'en' ? (ERR_EN_TELA[code] || code) : l === 'es' ? (ERR_ES[code] || code) : code; };
  const boolTela = b => { const l = idioma(); return l === 'en' ? (b ? 'TRUE' : 'FALSE') : l === 'es' ? (b ? 'VERDADERO' : 'FALSO') : (b ? 'VERDADEIRO' : 'FALSO'); };
  // qualquer grafia (pt, en, es) → código interno
  const ERR_DE = {}; Object.keys(ERR_EN).forEach(k => { ERR_DE[k] = k; ERR_DE[ERR_EN[k]] = ERR_DE[ERR_EN[k]] || k; ERR_DE[ERR_ES[k]] = k; });

  /* ---------- datas (número de série do Excel, sistema 1900) ---------- */
  const EPOCH = Date.UTC(1899, 11, 30);
  const dateToSerial = (y, m, d) => (Date.UTC(y, m - 1, d) - EPOCH) / 86400000;
  function serialToParts(n) {
    const ms = Math.round(n * 86400000) + EPOCH;
    const dt = new Date(ms);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), H: dt.getUTCHours(), M: dt.getUTCMinutes(), S: dt.getUTCSeconds(), wd: dt.getUTCDay() };
  }
  const todaySerial = () => { const t = new Date(); return dateToSerial(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
  const nowSerial = () => { const t = new Date(); return todaySerial() + (t.getHours() * 3600 + t.getMinutes() * 60 + t.getSeconds()) / 86400; };

  /* ---------- formatação de números ---------- */
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  // [Nebulosa] idiomas (0.6): nomes de meses e dias nos formatos de data (mmmm, dddd) no idioma escolhido
  const MESES_L = { en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] };
  const DIAS_L = { en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] };
  const mesesL = () => MESES_L[window.NebulosaIdiomas ? window.NebulosaIdiomas.atual() : ''] || MESES;
  const diasL = () => DIAS_L[window.NebulosaIdiomas ? window.NebulosaIdiomas.atual() : ''] || DIAS;
  function groupInt(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function fmtGeneral(n) {
    if (!isFinite(n)) return '#NÚM!';
    if (n === 0) return '0';
    const a = Math.abs(n);
    if (a >= 1e11 || a < 1e-9) {
      return n.toExponential(5).replace(/\.?0+e/, 'e').replace('e', 'E').replace('.', ',');
    }
    let s = String(+n.toPrecision(11));
    if (/e/i.test(s)) s = n.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',');
  }
  const fmtCache = new Map();
  function compile(z) {
    if (fmtCache.has(z)) return fmtCache.get(z);
    const secs = []; let cur = '', q = false;
    for (let i = 0; i < z.length; i++) {
      const ch = z[i];
      if (ch === '"') q = !q;
      if (ch === '\\' && !q) { cur += ch + (z[i + 1] || ''); i++; continue; }
      if (ch === ';' && !q) { secs.push(cur); cur = ''; continue; }
      cur += ch;
    }
    secs.push(cur);
    const out = secs.map(compileSection);
    fmtCache.set(z, out);
    return out;
  }
  function compileSection(sec) {
    // tira [Red], [$R$-416] etc.; guarda a cor
    let color = null;
    sec = sec.replace(/\[(Red|Vermelho|Blue|Azul|Green|Verde|Black|Preto)\]/i, (m, c) => { color = { red: '#d9534f', vermelho: '#d9534f', blue: '#3b7ddd', azul: '#3b7ddd', green: '#2e9e5b', verde: '#2e9e5b', black: null, preto: null }[c.toLowerCase()]; return ''; });
    sec = sec.replace(/\[\$([^\]-]*)(-[0-9A-Fa-f]+)?\]/g, (m, sym) => sym ? '"' + sym + '"' : '');
    sec = sec.replace(/\[[^\]]*\]/g, '');
    // separa partes literais e código
    const lit = s => s.replace(/"([^"]*)"/g, '$1').replace(/\\(.)/g, '$1').replace(/_./g, ' ').replace(/\*./g, '');
    const strip = sec.replace(/"[^"]*"/g, '').replace(/\\./g, '');
    const isDate = /[dmyhsDMYHS]/.test(strip.replace(/E[+-]/g, '')) && !/[0#?]/.test(strip);
    const text = /@/.test(strip);
    if (isDate) return { kind: 'date', src: sec, color };
    if (text && !/[0#?]/.test(strip)) return { kind: 'text', pre: lit(sec.split('@')[0]), post: lit(sec.split('@').slice(1).join('@')), color };
    const m = /[0#?][0#?.,\s]*(%|E[+-]0+)?/.exec(sec.replace(/"[^"]*"/g, m2 => '\u0001'.repeat(m2.length)));
    if (!m) return { kind: 'lit', text: lit(sec), color };
    const code = sec.substr(m.index, m[0].length);
    const pre = lit(sec.slice(0, m.index));
    let post = lit(sec.slice(m.index + m[0].length));
    if (/%/.test(code)) post = '%'.repeat((code.match(/%/g) || []).length) + post;
    const sci = /E[+-]/.test(code);
    const pct = (post.match(/%/g) || []).length + (pre.match(/%/g) || []).length;
    const core = code.replace(/E[+-]0+/, '').replace(/%/g, '').trim();
    const dot = core.indexOf('.');
    const intPart = dot >= 0 ? core.slice(0, dot) : core;
    const decPart = dot >= 0 ? core.slice(dot + 1) : '';
    const trailingCommas = (intPart.match(/,+$/) || [''])[0].length;
    return {
      kind: 'num', pre, post, sci, pct,
      dec: (decPart.match(/[0#?]/g) || []).length, decMin: (decPart.match(/0/g) || []).length,
      group: /,/.test(intPart.replace(/,+$/, '')), scale: Math.pow(1000, trailingCommas),
      intMin: (intPart.match(/0/g) || []).length, color
    };
  }
  function fmtNumSection(n, s, neg) {
    let v = Math.abs(n) / s.scale * Math.pow(100, s.pct);
    let body;
    if (s.sci) {
      let e = v === 0 ? 0 : Math.floor(Math.log10(v)), mnt = v / Math.pow(10, e);
      let t = mnt.toFixed(s.dec);
      if (+t >= 10) { e++; t = (mnt / 10).toFixed(s.dec); }
      body = t.replace('.', ',') + 'E' + (e < 0 ? '-' : '+') + String(Math.abs(e)).padStart(2, '0');
    } else {
      let t = v.toFixed(s.dec);
      let [ip, dp] = t.split('.');
      if (dp && s.decMin < s.dec) { dp = dp.replace(/0+$/, ''); while (dp.length < s.decMin) dp += '0'; }
      if (ip === '0' && s.intMin === 0 && (dp || s.dec)) ip = '';
      while (ip.length < s.intMin) ip = '0' + ip;
      if (s.group) ip = groupInt(ip);
      body = ip + (dp ? ',' + dp : (s.dec && s.decMin ? ',' : ''));
      if (body.endsWith(',')) body = body.slice(0, -1);
      if (body === '') body = '0';
    }
    return (neg ? '-' : '') + s.pre + body + s.post;
  }
  function fmtDate(n, src) {
    const p = serialToParts(n);
    const hasAmPm = /AM\/PM|A\/P/i.test(src);
    let out = '', i = 0;
    const s = src;
    // m depois de h ou antes de s = minuto
    const toks = [];
    while (i < s.length) {
      const ch = s[i];
      if (ch === '"') { const j = s.indexOf('"', i + 1); toks.push({ lit: s.slice(i + 1, j < 0 ? s.length : j) }); i = j < 0 ? s.length : j + 1; continue; }
      if (ch === '\\') { toks.push({ lit: s[i + 1] || '' }); i += 2; continue; }
      if (/AM\/PM/i.test(s.substr(i, 5))) { toks.push({ t: 'ampm' }); i += 5; continue; }
      const low = ch.toLowerCase();
      if ('dmyhs'.includes(low)) { let j = i; while (j < s.length && s[j].toLowerCase() === low) j++; toks.push({ t: low, n: j - i }); i = j; continue; }
      if (ch === '.' && /^\.0+/.test(s.slice(i))) { const m = /^\.0+/.exec(s.slice(i))[0]; toks.push({ t: 'frac', n: m.length - 1 }); i += m.length; continue; }
      toks.push({ lit: ch === '_' ? ' ' : ch }); i += ch === '_' ? 2 : 1;
    }
    toks.forEach((t, k) => {
      if (t.t === 'm') {
        const prev = toks.slice(0, k).reverse().find(x => x.t), next = toks.slice(k + 1).find(x => x.t);
        if ((prev && prev.t === 'h') || (next && next.t === 's')) t.t = 'min';
      }
    });
    const pad = (v, n) => String(v).padStart(n, '0');
    for (const t of toks) {
      if (t.lit !== undefined) { out += t.lit; continue; }
      switch (t.t) {
        case 'd': { const D = diasL(); out += t.n === 1 ? p.d : t.n === 2 ? pad(p.d, 2) : t.n === 3 ? D[p.wd].slice(0, 3) : D[p.wd]; break; } // [Nebulosa] idiomas
        case 'm': { const M = mesesL(); out += t.n === 1 ? p.m : t.n === 2 ? pad(p.m, 2) : t.n === 3 ? M[p.m - 1].slice(0, 3) : t.n === 5 ? M[p.m - 1][0] : M[p.m - 1]; break; }
        case 'y': out += t.n <= 2 ? pad(p.y % 100, 2) : p.y; break;
        case 'h': { let h = p.H; if (hasAmPm) h = h % 12 || 12; out += t.n >= 2 ? pad(h, 2) : h; break; }
        case 'min': out += t.n >= 2 ? pad(p.M, 2) : p.M; break;
        case 's': out += t.n >= 2 ? pad(p.S, 2) : p.S; break;
        case 'frac': out += ',' + pad(Math.round((n * 86400 % 1) * Math.pow(10, t.n)), t.n); break;
        case 'ampm': out += p.H < 12 ? 'AM' : 'PM'; break;
      }
    }
    return out;
  }
  /** Texto que aparece na célula, e a cor do formato (se houver). */
  function formatValue(v, z) {
    if (v === null || v === undefined || v === '') return { t: '' };
    if (isErr(v)) return { t: errTela(v.err) }; // [Nebulosa] idiomas
    if (typeof v === 'boolean') return { t: boolTela(v) };
    if (typeof v === 'string') {
      if (z && /@/.test(z)) { const secs = compile(z); const s = secs[3] || secs.find(x => x.kind === 'text'); if (s && s.kind === 'text') return { t: s.pre + v + s.post }; }
      return { t: v };
    }
    if (typeof v !== 'number') return { t: String(v) };
    if (!z || /^general$|^geral$/i.test(z)) return { t: fmtGeneral(v) };
    if (z === '@') return { t: fmtGeneral(v) };
    const secs = compile(z);
    let s = secs[0], neg = v < 0;
    if (secs.length > 1 && v < 0) { s = secs[1]; neg = false; }
    if (secs.length > 2 && v === 0) s = secs[2];
    if (s.kind === 'date') { if (v < 0) return { t: '#######' }; return { t: fmtDate(v, s.src), c: s.color }; }
    if (s.kind === 'lit') return { t: s.text, c: s.color };
    if (s.kind === 'text') return { t: fmtGeneral(v) };
    return { t: fmtNumSection(v, s, neg), c: s.color };
  }
  const isDateFormat = z => !!z && compile(z)[0].kind === 'date';

  /* ---------- leitura do que a pessoa digita ---------- */
  // Devolve { v, z? } — z é um formato sugerido (porcentagem, moeda, data)
  function parseInput(txt) {
    const s = String(txt);
    const t = s.trim();
    if (t === '') return { v: null };
    if (/^(verdadeiro|true|verdadero)$/i.test(t)) return { v: true };
    if (/^(falso|false)$/i.test(t)) return { v: false };
    if (ERR[t.toUpperCase()]) return { v: ERR[t.toUpperCase()] };
    if (ERR_DE[t.toUpperCase()]) return { v: ERR[ERR_DE[t.toUpperCase()]] }; // [Nebulosa] idiomas
    // número brasileiro: 1.234,56 · 1234,56 · 1234.56 · -12 · (12) · 1,5e3
    const num = parseNumberBR(t);
    if (num !== null) return { v: num };
    let m = /^(-?)\s*R\$\s*(-?[\d.,]+)$/i.exec(t);
    if (m) { const n = parseNumberBR(m[2]); if (n !== null) return { v: m[1] ? -n : n, z: '"R$" #,##0.00' }; }
    m = /^(-?[\d.,]+)\s*%$/.exec(t);
    if (m) { const n = parseNumberBR(m[1]); if (n !== null) return { v: n / 100, z: /[.,]\d/.test(m[1]) ? '0.00%' : '0%' }; }
    m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
    if (m) {
      const d = +m[1], mo = +m[2]; let y = m[3] ? +m[3] : new Date().getFullYear();
      if (y < 100) y += y < 50 ? 2000 : 1900;
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        let v = dateToSerial(y, mo, d);
        if (m[4]) v += (+m[4] * 3600 + +m[5] * 60 + (+m[6] || 0)) / 86400;
        return { v, z: m[4] ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy' };
      }
    }
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (m) return { v: dateToSerial(+m[1], +m[2], +m[3]), z: 'dd/mm/yyyy' };
    m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
    if (m && +m[1] < 48 && +m[2] < 60) return { v: (+m[1] * 3600 + +m[2] * 60 + (+m[3] || 0)) / 86400, z: m[3] ? 'hh:mm:ss' : 'hh:mm' };
    return { v: s };
  }
  function parseNumberBR(t) {
    t = String(t).trim();
    let neg = false;
    if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1).trim(); }
    if (!/^[+-]?[\d.,]+(e[+-]?\d+)?$/i.test(t) || !/\d/.test(t)) return null;
    let sign = 1;
    if (t[0] === '-' || t[0] === '+') { if (t[0] === '-') sign = -1; t = t.slice(1); }
    let exp = '';
    const em = /e[+-]?\d+$/i.exec(t); if (em) { exp = em[0]; t = t.slice(0, em.index); }
    let n;
    const hasDot = t.includes('.'), hasComma = t.includes(',');
    if (hasDot && hasComma) {
      // o último separador é o decimal
      if (t.lastIndexOf(',') > t.lastIndexOf('.')) { if (!/^\d{1,3}(\.\d{3})*,\d*$/.test(t)) return null; n = parseFloat(t.replace(/\./g, '').replace(',', '.') + exp); }
      else { if (!/^\d{1,3}(,\d{3})*\.\d*$/.test(t)) return null; n = parseFloat(t.replace(/,/g, '') + exp); }
    } else if (hasComma) {
      if ((t.match(/,/g) || []).length > 1) return null;
      n = parseFloat(t.replace(',', '.') + exp);
    } else if (hasDot) {
      const parts = t.split('.');
      if (parts.length > 2) { if (!/^\d{1,3}(\.\d{3})+$/.test(t)) return null; n = parseFloat(t.replace(/\./g, '') + exp); }
      else if (/^\d{1,3}\.\d{3}$/.test(t) && !exp) n = parseFloat(t.replace('.', '')); // 1.000 = mil
      else n = parseFloat(t + exp);
    } else n = parseFloat(t + exp);
    if (!isFinite(n)) return null;
    return (neg ? -1 : 1) * sign * n;
  }
  /** Texto para editar a célula (o que a pessoa vê ao clicar duas vezes). */
  function editText(cell) {
    if (!cell) return '';
    if (cell.f) return '=' + SD.F.toDisplay(cell.f);
    const v = cell.v, z = cell.s && cell.s.z;
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') {
      if (z && isDateFormat(z)) {
        const p = serialToParts(v);
        const d = String(p.d).padStart(2, '0') + '/' + String(p.m).padStart(2, '0') + '/' + p.y;
        if (v % 1 && v >= 1) return d + ' ' + String(p.H).padStart(2, '0') + ':' + String(p.M).padStart(2, '0');
        if (v < 1) return String(p.H).padStart(2, '0') + ':' + String(p.M).padStart(2, '0');
        return d;
      }
      if (z && /%/.test(z)) return fmtGeneral(v * 100) + '%';
      return fmtGeneral(v);
    }
    if (typeof v === 'boolean') return boolTela(v); // [Nebulosa] idiomas
    if (isErr(v)) return errTela(v.err);
    return String(v);
  }

  /* ---------- pasta de trabalho ---------- */
  const DEF_W = 100, DEF_H = 24;
  let uid = 1;
  function newSheet(name) {
    return { id: uid++, name: name || 'Planilha1', cells: new Map(), colW: {}, rowH: {}, merges: [], charts: [], freeze: { r: 0, c: 0 }, hiddenRows: new Set(), filter: null, showGrid: true, zoom: 1,
      condFormats: [], validations: [], notas: {} }; // [Nebulosa] regras e comentários (js/regras.js)
  }
  // [Nebulosa] idiomas (0.6): nome das planilhas novas no idioma escolhido (Planilha1, Sheet1, Hoja1)
  const baseNomePlanilha = () => ({ en: 'Sheet', es: 'Hoja' })[idioma()] || 'Planilha';
  const semNome = () => ({ en: 'Untitled spreadsheet', es: 'Hoja de cálculo sin nombre' })[idioma()] || 'Planilha sem nome';
  function newWorkbook() {
    return { sheets: [newSheet(baseNomePlanilha() + '1')], active: 0, name: semNome(), format: 'xlsx', props: {} };
  }
  function sheetUsed(sh) {
    let r2 = -1, c2 = -1;
    sh.cells.forEach((cell, k) => {
      if (!cell || (cell.v === null || cell.v === undefined || cell.v === '') && !cell.f && !cell.s) return;
      const [r, c] = unkey(k);
      if (r > r2) r2 = r; if (c > c2) c2 = c;
    });
    sh.merges.forEach(m => { if (m.r2 > r2) r2 = m.r2; if (m.c2 > c2) c2 = m.c2; });
    return { r2, c2 };
  }
  /** Área usada só com conteúdo (sem estilos soltos). */
  function sheetDataBounds(sh) {
    let r2 = -1, c2 = -1, r1 = Infinity, c1 = Infinity;
    sh.cells.forEach((cell, k) => {
      if (!cell || ((cell.v === null || cell.v === undefined || cell.v === '') && !cell.f)) return;
      const [r, c] = unkey(k);
      if (r > r2) r2 = r; if (c > c2) c2 = c; if (r < r1) r1 = r; if (c < c1) c1 = c;
    });
    return r2 < 0 ? null : { r1, c1, r2, c2 };
  }
  const uniqueSheetName = (wb, base) => {
    let n = 1, name = base;
    while (wb.sheets.some(s => s.name.toLowerCase() === name.toLowerCase())) name = base.replace(/\d+$/, '') + (++n);
    return name;
  };

  // cópia profunda de estilos
  const cloneStyle = s => s ? JSON.parse(JSON.stringify(s)) : undefined;
  const cloneCell = c => c ? { v: c.v, f: c.f, s: cloneStyle(c.s), val: c.val } : null;

  /* ---------- serialização (desfazer, recuperação) ---------- */
  function cellToJSON(c) {
    const o = {};
    if (c.f) o.f = c.f;
    if (c.v !== null && c.v !== undefined) o.v = isErr(c.v) ? { e: c.v.err } : c.v;
    if (c.s && Object.keys(c.s).length) o.s = c.s;
    return o;
  }
  function cellFromJSON(o) {
    const c = { v: o.v && typeof o.v === 'object' && o.v.e ? (ERR[o.v.e] || new Err(o.v.e)) : (o.v === undefined ? null : o.v) };
    if (o.f) c.f = o.f;
    if (o.s) c.s = o.s;
    return c;
  }
  const copia = x => JSON.parse(JSON.stringify(x)); // [Nebulosa]
  function sheetToJSON(sh) {
    const cells = [];
    sh.cells.forEach((c, k) => { const o = cellToJSON(c); if (Object.keys(o).length) cells.push([k, o]); });
    return { name: sh.name, cells, colW: sh.colW, rowH: sh.rowH, merges: sh.merges, charts: sh.charts, freeze: sh.freeze, hiddenRows: [...sh.hiddenRows], filter: sh.filter, showGrid: sh.showGrid, zoom: sh.zoom,
      condFormats: copia(sh.condFormats || []), validations: copia(sh.validations || []), notas: copia(sh.notas || {}) }; // [Nebulosa] cópia (o desfazer guarda isto)
  }
  function sheetFromJSON(o) {
    const sh = newSheet(o.name);
    (o.cells || []).forEach(([k, c]) => sh.cells.set(k, cellFromJSON(c)));
    Object.assign(sh, { colW: o.colW || {}, rowH: o.rowH || {}, merges: o.merges || [], charts: o.charts || [], freeze: o.freeze || { r: 0, c: 0 }, hiddenRows: new Set(o.hiddenRows || []), filter: o.filter || null, showGrid: o.showGrid !== false, zoom: o.zoom || 1,
      condFormats: copia(o.condFormats || []), validations: copia(o.validations || []), notas: copia(o.notas || {}) }); // [Nebulosa]
    return sh;
  }
  const wbToJSON = wb => ({ app: 'Stardust', v: 1, name: wb.name, format: wb.format, active: wb.active, sheets: wb.sheets.map(sheetToJSON) });
  function wbFromJSON(o) {
    const wb = newWorkbook();
    wb.name = o.name || wb.name; wb.format = o.format || 'xlsx'; wb.active = o.active || 0;
    wb.sheets = (o.sheets || []).map(sheetFromJSON);
    if (!wb.sheets.length) wb.sheets = [newSheet('Planilha1')];
    if (wb.active >= wb.sheets.length) wb.active = 0;
    return wb;
  }

  /* ---------- cores ---------- */
  function hexToRgb(h) {
    h = String(h || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    if (h.length === 8) h = h.slice(2);
    const n = parseInt(h, 16);
    return isNaN(n) ? null : { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const luminance = h => { const c = hexToRgb(h); if (!c) return 1; return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255; };

  Object.assign(SD, {
    colName, colIndex, addr, key, unkey, parseAddr, parseRange, norm, rangeStr, inRange,
    Err, ERR, ERR_EN, ERR_PT, ERR_ES, ERR_DE, isErr, idioma, errTela, boolTela, local: () => (window.NebulosaIdiomas ? window.NebulosaIdiomas.local() : 'pt-BR'),
    dateToSerial, serialToParts, todaySerial, nowSerial, MESES, DIAS,
    formatValue, fmtGeneral, isDateFormat, parseInput, parseNumberBR, editText,
    DEF_W, DEF_H, newSheet, newWorkbook, baseNomePlanilha, sheetUsed, sheetDataBounds, uniqueSheetName, cloneStyle, cloneCell,
    sheetToJSON, sheetFromJSON, wbToJSON, wbFromJSON, cellToJSON, cellFromJSON,
    hexToRgb, luminance
  });
})();
