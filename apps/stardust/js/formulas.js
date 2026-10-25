/* ==========================================================================
   Stardust — js/formulas.js
   Motor de fórmulas.

   - Na tela as fórmulas aparecem como no Excel em português:
       =SOMA(A1:A10;2,5)   =SE(B2>10;"alto";"baixo")   =PROCV(A2;Tabela!A:C;3;FALSO)
   - Por dentro (e nos arquivos .xlsx/.ods) ficam no formato "canônico" do
     Excel, em inglês, com vírgula separando argumentos e ponto decimal:
       SUM(A1:A10,2.5)
     toDisplay() e toCanonical() fazem a tradução. A pessoa pode digitar em
     português ou em inglês, com ";" ou ",".
   ========================================================================== */
(function () {
  'use strict';
  const SD = window.SD;
  const { ERR, Err, isErr } = SD;

  /* ---------- nomes das funções (inglês ↔ português) ---------- */
  const PT = {
    SUM: 'SOMA', AVERAGE: 'MÉDIA', MIN: 'MÍNIMO', MAX: 'MÁXIMO', COUNT: 'CONT.NÚM', COUNTA: 'CONT.VALORES', COUNTBLANK: 'CONTAR.VAZIO',
    COUNTIF: 'CONT.SE', COUNTIFS: 'CONT.SES', SUMIF: 'SOMASE', SUMIFS: 'SOMASES', AVERAGEIF: 'MÉDIASE', AVERAGEIFS: 'MÉDIASES',
    MAXIFS: 'MÁXIMOSES', MINIFS: 'MÍNIMOSES',
    IF: 'SE', IFS: 'SES', IFERROR: 'SEERRO', IFNA: 'SENÃODISP', AND: 'E', OR: 'OU', NOT: 'NÃO', XOR: 'OUX', SWITCH: 'PARÂMETRO', TRUE: 'VERDADEIRO', FALSE: 'FALSO',
    ROUND: 'ARRED', ROUNDUP: 'ARREDONDAR.PARA.CIMA', ROUNDDOWN: 'ARREDONDAR.PARA.BAIXO', INT: 'INT', TRUNC: 'TRUNCAR', ABS: 'ABS', SQRT: 'RAIZ',
    POWER: 'POTÊNCIA', MOD: 'MOD', PI: 'PI', RAND: 'ALEATÓRIO', RANDBETWEEN: 'ALEATÓRIOENTRE', PRODUCT: 'MULT', SUMPRODUCT: 'SOMARPRODUTO',
    SUMSQ: 'SOMAQUAD', MEDIAN: 'MED', MODE: 'MODO', 'MODE.SNGL': 'MODO.ÚNICO', STDEV: 'DESVPAD', 'STDEV.S': 'DESVPAD.A', 'STDEV.P': 'DESVPAD.P', STDEVP: 'DESVPADP',
    VAR: 'VAR', 'VAR.S': 'VAR.A', 'VAR.P': 'VAR.P', VARP: 'VARP', LARGE: 'MAIOR', SMALL: 'MENOR', RANK: 'ORDEM', 'RANK.EQ': 'ORDEM.EQ',
    CEILING: 'TETO', FLOOR: 'ARREDMULTB', MROUND: 'MARRED', EXP: 'EXP', LN: 'LN', LOG: 'LOG', LOG10: 'LOG10', SIGN: 'SINAL', EVEN: 'PAR', ODD: 'ÍMPAR',
    FACT: 'FATORIAL', GCD: 'MDC', LCM: 'MMC', SIN: 'SEN', COS: 'COS', TAN: 'TAN', RADIANS: 'RADIANOS', DEGREES: 'GRAUS', COUNTUNIQUE: 'CONTARVALORESÚNICOS',
    CONCATENATE: 'CONCATENAR', CONCAT: 'CONCAT', TEXTJOIN: 'UNIRTEXTO', LEFT: 'ESQUERDA', RIGHT: 'DIREITA', MID: 'EXT.TEXTO', LEN: 'NÚM.CARACT',
    UPPER: 'MAIÚSCULA', LOWER: 'MINÚSCULA', PROPER: 'PRI.MAIÚSCULA', TRIM: 'ARRUMAR', SUBSTITUTE: 'SUBSTITUIR', REPLACE: 'MUDAR',
    FIND: 'PROCURAR', SEARCH: 'LOCALIZAR', TEXT: 'TEXTO', VALUE: 'VALOR', REPT: 'REPT', EXACT: 'EXATO', CHAR: 'CARACT', CODE: 'CÓDIGO', CLEAN: 'TIRAR', T: 'T', N: 'N',
    VLOOKUP: 'PROCV', HLOOKUP: 'PROCH', XLOOKUP: 'PROCX', LOOKUP: 'PROC', INDEX: 'ÍNDICE', MATCH: 'CORRESP', CHOOSE: 'ESCOLHER',
    ROW: 'LIN', COLUMN: 'COL', ROWS: 'LINS', COLUMNS: 'COLS', TRANSPOSE: 'TRANSPOR',
    TODAY: 'HOJE', NOW: 'AGORA', DATE: 'DATA', TIME: 'TEMPO', YEAR: 'ANO', MONTH: 'MÊS', DAY: 'DIA', HOUR: 'HORA', MINUTE: 'MINUTO', SECOND: 'SEGUNDO',
    WEEKDAY: 'DIA.DA.SEMANA', WEEKNUM: 'NÚMSEMANA', DATEDIF: 'DATADIF', EDATE: 'DATAM', EOMONTH: 'FIMMÊS', NETWORKDAYS: 'DIATRABALHOTOTAL', WORKDAY: 'DIATRABALHO',
    DAYS: 'DIAS', DATEVALUE: 'DATA.VALOR', YEARFRAC: 'FRAÇÃOANO',
    ISBLANK: 'ÉCÉL.VAZIA', ISNUMBER: 'ÉNÚM', ISTEXT: 'ÉTEXTO', ISERROR: 'ÉERROS', ISERR: 'ÉERRO', ISNA: 'É.NÃO.DISP', ISLOGICAL: 'ÉLÓGICO', ISEVEN: 'ÉPAR', ISODD: 'ÉIMPAR', NA: 'NÃO.DISP',
    PMT: 'PGTO', FV: 'VF', PV: 'VP', NPER: 'NPER', RATE: 'TAXA', NPV: 'VPL', IRR: 'TIR'
  };
  const EN = {}; // nome português normalizado → inglês
  const normName = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  Object.keys(PT).forEach(k => { EN[normName(PT[k])] = k; });
  const toEn = name => { const u = String(name).toUpperCase(); if (FN[u] || PT[u]) return u; const n = normName(name); return EN[n] || (FN[n] ? n : u); };

  /* ---------- tokens ---------- */
  // Uma referência pode ter planilha: Planilha1!A1, 'Minha planilha'!A1:B2
  const SHEET_RE = /^(?:'((?:[^']|'')+)'|([A-Za-z_\u00C0-\u024F][\w.\u00C0-\u024F]*))!/;
  const CELL = '\\$?[A-Za-z]{1,3}\\$?\\d{1,7}';
  const REF_RE = new RegExp('^(?:' + CELL + '(?::' + CELL + ')?|\\$?[A-Za-z]{1,3}:\\$?[A-Za-z]{1,3}|\\$?\\d{1,7}:\\$?\\d{1,7})(?![\\w.(])');
  function tokenize(src, pt) {
    const toks = []; let i = 0;
    const dec = pt ? ',' : '.';
    while (i < src.length) {
      const ch = src[i], rest = src.slice(i);
      if (/\s/.test(ch)) { let j = i; while (j < src.length && /\s/.test(src[j])) j++; toks.push({ t: 'ws', v: src.slice(i, j) }); i = j; continue; }
      if (ch === '"') {
        let j = i + 1, s = '';
        while (j < src.length) { if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += src[j++]; }
        toks.push({ t: 'str', v: s }); i = j + 1; continue;
      }
      if (ch === '#') {
        const m = /^#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|NULO!|VALOR!|NOME\?|NÚM!|N\/D|CIRC!)/i.exec(rest);
        if (m) { toks.push({ t: 'err', v: m[0].toUpperCase() }); i += m[0].length; continue; }
      }
      // número
      const numRe = pt ? /^(\d+(?:,\d+)?|,\d+)(?:[eE][+-]?\d+)?/ : /^(\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
      let m = numRe.exec(rest);
      if (m && !REF_RE.test(rest)) {
        // em português aceita também ponto decimal (1.5) quando não parece milhar
        let txt = m[0];
        if (pt) { const m2 = /^\d+\.\d+(?:[eE][+-]?\d+)?/.exec(rest); if (m2 && m2[0].length > txt.length) txt = m2[0]; }
        toks.push({ t: 'num', v: parseFloat(txt.replace(',', '.')), raw: txt }); i += txt.length; continue;
      }
      // planilha!ref
      const sm = SHEET_RE.exec(rest);
      if (sm) {
        const after = rest.slice(sm[0].length), rm = REF_RE.exec(after);
        if (rm) { toks.push({ t: 'ref', sheet: sm[1] !== undefined ? sm[1].replace(/''/g, "'") : sm[2], v: rm[0] }); i += sm[0].length + rm[0].length; continue; }
        if (/^#REF!/i.test(after)) { toks.push({ t: 'err', v: '#REF!' }); i += sm[0].length + 5; continue; }
      }
      // função
      m = /^([A-Za-z_\u00C0-\u024F][\w.\u00C0-\u024F]*)\s*\(/.exec(rest);
      if (m) { toks.push({ t: 'fn', v: m[1] }); i += m[0].length; continue; }
      m = REF_RE.exec(rest);
      if (m) { toks.push({ t: 'ref', v: m[0] }); i += m[0].length; continue; }
      m = /^([A-Za-z_\u00C0-\u024F][\w.\u00C0-\u024F]*)/.exec(rest);
      if (m) {
        const u = normName(m[1]);
        if (u === 'TRUE' || u === 'VERDADEIRO') toks.push({ t: 'bool', v: true });
        else if (u === 'FALSE' || u === 'FALSO') toks.push({ t: 'bool', v: false });
        else toks.push({ t: 'name', v: m[1] });
        i += m[1].length; continue;
      }
      if (ch === '(') { toks.push({ t: '(' }); i++; continue; }
      if (ch === ')') { toks.push({ t: ')' }); i++; continue; }
      if (ch === ';' || (ch === ',' && (!pt || true))) { toks.push({ t: 'sep' }); i++; continue; }
      if (ch === '{' || ch === '}') { toks.push({ t: ch }); i++; continue; }
      m = /^(<>|<=|>=|[-+*/^&=<>%])/.exec(rest);
      if (m) { toks.push({ t: 'op', v: m[0] }); i += m[0].length; continue; }
      toks.push({ t: 'bad', v: ch }); i++;
    }
    return toks;
  }
  const quoteSheet = n => /^[A-Za-z_\u00C0-\u024F][\w.\u00C0-\u024F]*$/.test(n) && !/^[A-Za-z]{1,3}\d+$/.test(n) ? n : "'" + n.replace(/'/g, "''") + "'";
  function untokenize(toks, pt) {
    return toks.map(k => {
      switch (k.t) {
        case 'ws': return k.v;
        case 'str': return '"' + k.v.replace(/"/g, '""') + '"';
        case 'num': return pt ? fmtNumLit(k.v).replace('.', ',') : fmtNumLit(k.v);
        case 'bool': return pt ? (k.v ? 'VERDADEIRO' : 'FALSO') : (k.v ? 'TRUE' : 'FALSE');
        case 'err': return pt ? (SD.ERR_PT[k.v] || k.v) : (SD.ERR_EN[k.v] || k.v);
        case 'ref': return (k.sheet !== undefined ? quoteSheet(k.sheet) + '!' : '') + k.v.toUpperCase();
        case 'fn': { if (/^_xl(fn|ws)\./i.test(k.v)) return '_xlfn.' + k.v.replace(/^_xl(fn|ws)\./i, '').toUpperCase() + '('; const en = toEn(k.v); return (pt ? (PT[en] || en) : en) + '('; }
        case 'name': return k.v;
        case 'sep': return pt ? ';' : ',';
        case 'op': case 'bad': return k.v;
        default: return k.t;
      }
    }).join('');
  }
  const fmtNumLit = n => { let s = String(n); if (/e/.test(s)) s = n.toExponential().replace('e+', 'E+').replace('e-', 'E-'); return s; };
  const toDisplay = f => { try { return untokenize(tokenize(f, false), true); } catch (e) { return f; } };
  const toCanonical = f => untokenize(tokenize(f, true), false);

  /* ---------- análise (gera a árvore da fórmula) ---------- */
  function parse(f) {
    const toks = tokenize(f, false).filter(k => k.t !== 'ws');
    let p = 0;
    const peek = () => toks[p], next = () => toks[p++];
    const PREC = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };
    function expr(minP) {
      let left = unary();
      for (;;) {
        const k = peek();
        if (!k || k.t !== 'op' || PREC[k.v] === undefined || PREC[k.v] < minP) break;
        next();
        const pr = PREC[k.v];
        const right = expr(k.v === '^' ? pr : pr + 1);
        left = { k: 'bin', op: k.v, a: left, b: right };
      }
      return left;
    }
    function unary() {
      const k = peek();
      if (k && k.t === 'op' && (k.v === '-' || k.v === '+')) { next(); const e = unary(); return k.v === '-' ? { k: 'neg', a: e } : e; }
      return postfix(primary());
    }
    function postfix(e) {
      while (peek() && peek().t === 'op' && peek().v === '%') { next(); e = { k: 'pct', a: e }; }
      return e;
    }
    function primary() {
      const k = next();
      if (!k) throw new Error('fim inesperado');
      switch (k.t) {
        case 'num': return { k: 'lit', v: k.v };
        case 'str': return { k: 'lit', v: k.v };
        case 'bool': return { k: 'lit', v: k.v };
        case 'err': return { k: 'lit', v: ERR[SD.ERR_PT[k.v] || k.v] || new Err(k.v) };
        case 'ref': return { k: 'ref', sheet: k.sheet, ref: k.v };
        case 'name': return { k: 'name', v: k.v };
        case '(': { const e = expr(1); if (!peek() || next().t !== ')') throw new Error('falta )'); return e; }
        case '{': {
          const rows = [[]];
          while (peek() && peek().t !== '}') {
            const t = next();
            if (t.t === 'sep') continue;
            if (t.t === 'op' && t.v === '-') { const n = next(); rows[rows.length - 1].push(-n.v); continue; }
            if (t.t === 'num' || t.t === 'str' || t.t === 'bool') rows[rows.length - 1].push(t.v);
          }
          next();
          return { k: 'arr', v: rows };
        }
        case 'fn': {
          const args = [];
          if (peek() && peek().t === ')') { next(); return { k: 'fn', name: toEn(k.v), args }; }
          for (;;) {
            if (peek() && (peek().t === 'sep' || peek().t === ')')) args.push({ k: 'empty' });
            else args.push(expr(1));
            const t = next();
            if (!t) throw new Error('falta )');
            if (t.t === ')') break;
            if (t.t !== 'sep') throw new Error('esperava ; ou )');
          }
          return { k: 'fn', name: toEn(k.v), args };
        }
      }
      throw new Error('símbolo inesperado');
    }
    const ast = expr(1);
    if (p < toks.length) throw new Error('sobrou texto');
    return ast;
  }
  const astCache = new Map();
  function getAst(f) {
    let a = astCache.get(f);
    if (!a) { try { a = parse(f); } catch (e) { a = { k: 'bad', msg: e.message }; } astCache.set(f, a); if (astCache.size > 20000) astCache.clear(); }
    return a;
  }
  /** Confere a sintaxe de uma fórmula canônica. Devolve null se estiver certa, ou a mensagem. */
  function check(f) { try { parse(f); return null; } catch (e) { return e.message; } }

  /* ---------- intervalos ---------- */
  class Rng {
    constructor(sh, r1, c1, r2, c2) { this.sh = sh; this.r1 = r1; this.c1 = c1; this.r2 = r2; this.c2 = c2; }
    get rows() { return this.r2 - this.r1 + 1; }
    get cols() { return this.c2 - this.c1 + 1; }
    get(i, j) { return ctx.value(this.sh, this.r1 + i, this.c1 + j); }
    values() { const o = []; for (let r = this.r1; r <= this.r2; r++) { const row = []; for (let c = this.c1; c <= this.c2; c++) row.push(ctx.value(this.sh, r, c)); o.push(row); } return o; }
    flat() { const o = []; for (let r = this.r1; r <= this.r2; r++) for (let c = this.c1; c <= this.c2; c++) o.push(ctx.value(this.sh, r, c)); return o; }
  }
  // contexto da avaliação atual
  let ctx = null;
  function resolveRef(node, sh) {
    let sheetIdx = sh;
    if (node.sheet !== undefined) {
      sheetIdx = ctx.wb.sheets.findIndex(s => s.name.toLowerCase() === node.sheet.toLowerCase());
      if (sheetIdx < 0) return ERR['#REF!'];
    }
    const ref = node.ref.replace(/\$/g, '');
    const used = () => SD.sheetUsed(ctx.wb.sheets[sheetIdx]);
    let m;
    if ((m = /^([A-Za-z]{1,3}):([A-Za-z]{1,3})$/.exec(ref))) {
      const u = used(); return new Rng(sheetIdx, 0, SD.colIndex(m[1]), Math.max(0, u.r2), SD.colIndex(m[2]));
    }
    if ((m = /^(\d+):(\d+)$/.exec(ref))) {
      const u = used(); return new Rng(sheetIdx, +m[1] - 1, 0, +m[2] - 1, Math.max(0, u.c2));
    }
    const g = SD.parseRange(ref);
    if (!g) return ERR['#REF!'];
    return new Rng(sheetIdx, g.r1, g.c1, g.r2, g.c2);
  }

  /* ---------- conversões ---------- */
  function scalar(v) {
    if (v instanceof Rng) {
      if (v.rows === 1 && v.cols === 1) return v.get(0, 0);
      // interseção implícita com a linha/coluna da célula
      if (v.cols === 1 && ctx.r >= v.r1 && ctx.r <= v.r2) return ctx.value(v.sh, ctx.r, v.c1);
      if (v.rows === 1 && ctx.c >= v.c1 && ctx.c <= v.c2) return ctx.value(v.sh, v.r1, ctx.c);
      return v.get(0, 0);
    }
    if (Array.isArray(v)) return Array.isArray(v[0]) ? v[0][0] : v[0];
    return v;
  }
  function num(v) {
    v = scalar(v);
    if (isErr(v)) throw v;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v === null || v === undefined || v === '') return 0;
    const p = SD.parseInput(String(v));
    if (typeof p.v === 'number') return p.v;
    throw ERR['#VALOR!'];
  }
  function str(v) {
    v = scalar(v);
    if (isErr(v)) throw v;
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'VERDADEIRO' : 'FALSO';
    if (typeof v === 'number') return SD.fmtGeneral(v);
    return String(v);
  }
  function bool(v) {
    v = scalar(v);
    if (isErr(v)) throw v;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (v === null || v === undefined || v === '') return false;
    const u = normName(v);
    if (u === 'TRUE' || u === 'VERDADEIRO') return true;
    if (u === 'FALSE' || u === 'FALSO') return false;
    throw ERR['#VALOR!'];
  }
  const int = v => Math.trunc(num(v));
  // todos os valores de uma lista de argumentos (intervalos abertos)
  function each(args, fn) {
    args.forEach(a => {
      if (a instanceof Rng) a.flat().forEach(v => fn(v, true));
      else if (Array.isArray(a)) a.flat().forEach(v => fn(v, true));
      else fn(a, false);
    });
  }
  // números: em intervalos ignora texto e lógicos; argumento direto converte
  function nums(args) {
    const o = [];
    each(args, (v, inR) => {
      if (isErr(v)) throw v;
      if (inR) { if (typeof v === 'number') o.push(v); }
      else if (v !== null && v !== undefined) o.push(num(v));
    });
    return o;
  }
  const flatVals = a => a instanceof Rng ? a.flat() : Array.isArray(a) ? a.flat() : [a];
  const grid = a => a instanceof Rng ? a.values() : Array.isArray(a) ? (Array.isArray(a[0]) ? a : [a]) : [[a]];

  /* ---------- critérios (CONT.SE, SOMASE…) ---------- */
  function criterion(c) {
    c = scalar(c);
    if (typeof c === 'number' || typeof c === 'boolean') return v => cmp(v, c) === 0 && typeof v === typeof c;
    let s = c === null || c === undefined ? '' : String(c);
    const m = /^(<=|>=|<>|=|<|>)?(.*)$/.exec(s);
    const op = m[1] || '=', rhsTxt = m[2];
    const p = SD.parseInput(rhsTxt);
    const rhs = rhsTxt === '' ? '' : p.v;
    if (typeof rhs === 'string' && (op === '=' || op === '<>')) {
      if (/[*?]/.test(rhs)) {
        const re = new RegExp('^' + rhs.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/~\*/g, '\u0001').replace(/~\?/g, '\u0002').replace(/\*/g, '.*').replace(/\?/g, '.').replace(/\u0001/g, '\\*').replace(/\u0002/g, '\\?') + '$', 'i');
        return op === '=' ? v => typeof v === 'string' && re.test(v) : v => !(typeof v === 'string' && re.test(v));
      }
      const low = rhs.toLowerCase();
      if (op === '=') return rhs === '' ? v => v === null || v === undefined || v === '' : v => typeof v === 'string' && v.toLowerCase() === low;
      return rhs === '' ? v => !(v === null || v === undefined || v === '') : v => !(typeof v === 'string' && v.toLowerCase() === low);
    }
    return v => {
      if (v === null || v === undefined || v === '') return op === '<>' ;
      if (typeof rhs === 'number' && typeof v !== 'number') return op === '<>';
      const k = cmp(v, rhs);
      return op === '=' ? k === 0 : op === '<>' ? k !== 0 : op === '<' ? k < 0 : op === '>' ? k > 0 : op === '<=' ? k <= 0 : k >= 0;
    };
  }
  const typeRank = v => typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : typeof v === 'boolean' ? 2 : -1;
  function cmp(a, b) {
    if (a === null || a === undefined) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
    if (b === null || b === undefined) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
    const ta = typeRank(a), tb = typeRank(b);
    if (ta !== tb) return ta - tb;
    if (typeof a === 'string') { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function ifsCollect(args, startPairs) {
    // devolve a lista de índices (posição dentro do intervalo) que atendem a todos os critérios
    const pairs = [];
    for (let i = startPairs; i + 1 < args.length; i += 2) pairs.push([flatVals(args[i]), criterion(args[i + 1])]);
    const n = pairs.length ? pairs[0][0].length : 0;
    const ok = [];
    for (let k = 0; k < n; k++) if (pairs.every(([vals, f]) => f(vals[k]))) ok.push(k);
    return ok;
  }

  /* ---------- funções ---------- */
  const LAZY = new Set(['IF', 'IFS', 'IFERROR', 'IFNA', 'AND', 'OR', 'CHOOSE', 'SWITCH', 'ROW', 'COLUMN', 'ROWS', 'COLUMNS', 'ISBLANK', 'ISERROR', 'ISERR', 'ISNA']);
  const round = (x, d) => { const f = Math.pow(10, d); const y = Math.abs(x) * f; const r = Math.round(y + 1e-9 * Math.max(1, y)) / f; return x < 0 ? -r : r; };
  const sum = a => a.reduce((s, x) => s + x, 0);
  const mean = a => { if (!a.length) throw ERR['#DIV/0!']; return sum(a) / a.length; };
  function variance(a, pop) { const m = mean(a); const n = a.length - (pop ? 0 : 1); if (n <= 0) throw ERR['#DIV/0!']; return sum(a.map(x => (x - m) * (x - m))) / n; }
  function lookupExact(vals, key) {
    for (let i = 0; i < vals.length; i++) if (vals[i] !== null && cmp(vals[i], key) === 0 && typeRank(vals[i]) === typeRank(key)) return i;
    if (typeof key === 'string' && /[*?]/.test(key)) { const f = criterion(key); for (let i = 0; i < vals.length; i++) if (f(vals[i])) return i; }
    return -1;
  }
  function lookupApprox(vals, key) {
    let best = -1;
    for (let i = 0; i < vals.length; i++) { const v = vals[i]; if (v === null || typeRank(v) !== typeRank(key)) continue; if (cmp(v, key) <= 0) best = i; else break; }
    return best;
  }
  function addMonths(serial, n) {
    const p = SD.serialToParts(serial);
    const t = new Date(Date.UTC(p.y, p.m - 1 + n, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    return SD.dateToSerial(t.getUTCFullYear(), t.getUTCMonth() + 1, Math.min(p.d, last));
  }
  const isWeekend = s => { const w = SD.serialToParts(s).wd; return w === 0 || w === 6; };

  const FN = {
    SUM: a => sum(nums(a)),
    AVERAGE: a => mean(nums(a)),
    MIN: a => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
    MAX: a => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
    COUNT: a => { let n = 0; each(a, (v, inR) => { if (typeof v === 'number' || (!inR && v !== null && !isErr(v) && typeof v !== 'string')) n++; else if (!inR && typeof v === 'string' && typeof SD.parseInput(v).v === 'number') n++; }); return n; },
    COUNTA: a => { let n = 0; each(a, (v, inR) => { if (!(v === null || v === undefined || (inR && v === ''))) n++; }); return n; },
    COUNTBLANK: a => { let n = 0; each(a, v => { if (v === null || v === undefined || v === '') n++; }); return n; },
    COUNTIF: a => { const f = criterion(a[1]); return flatVals(a[0]).filter(f).length; },
    COUNTIFS: a => ifsCollect(a, 0).length,
    SUMIF: a => { const f = criterion(a[1]); const k = flatVals(a[0]), s = a[2] !== undefined ? flatVals(a[2]) : k; let t = 0; k.forEach((v, i) => { if (f(v) && typeof s[i] === 'number') t += s[i]; }); return t; },
    SUMIFS: a => { const s = flatVals(a[0]); return sum(ifsCollect(a, 1).map(i => s[i]).filter(x => typeof x === 'number')); },
    AVERAGEIF: a => { const f = criterion(a[1]); const k = flatVals(a[0]), s = a[2] !== undefined ? flatVals(a[2]) : k; const o = []; k.forEach((v, i) => { if (f(v) && typeof s[i] === 'number') o.push(s[i]); }); return mean(o); },
    AVERAGEIFS: a => { const s = flatVals(a[0]); return mean(ifsCollect(a, 1).map(i => s[i]).filter(x => typeof x === 'number')); },
    MAXIFS: a => { const s = flatVals(a[0]); const o = ifsCollect(a, 1).map(i => s[i]).filter(x => typeof x === 'number'); return o.length ? Math.max(...o) : 0; },
    MINIFS: a => { const s = flatVals(a[0]); const o = ifsCollect(a, 1).map(i => s[i]).filter(x => typeof x === 'number'); return o.length ? Math.min(...o) : 0; },
    IF: a => bool(a[0]()) ? (a[1] ? a[1]() : true) : (a[2] ? a[2]() : false),
    IFS: a => { for (let i = 0; i + 1 < a.length; i += 2) if (bool(a[i]())) return a[i + 1](); throw ERR['#N/D']; },
    IFERROR: a => { try { const v = scalar(a[0]()); if (isErr(v)) return a[1](); return v; } catch (e) { if (isErr(e)) return a[1](); throw e; } },
    IFNA: a => { try { const v = scalar(a[0]()); if (v === ERR['#N/D']) return a[1](); return v; } catch (e) { if (e === ERR['#N/D']) return a[1](); throw e; } },
    AND: a => { let r = true; a.forEach(t => { const v = t(); each([v], (x, inR) => { if (isErr(x)) throw x; if (inR && typeof x !== 'boolean' && typeof x !== 'number') return; if (!bool(x)) r = false; }); }); return r; },
    OR: a => { let r = false; a.forEach(t => { const v = t(); each([v], (x, inR) => { if (isErr(x)) throw x; if (inR && typeof x !== 'boolean' && typeof x !== 'number') return; if (bool(x)) r = true; }); }); return r; },
    XOR: a => { let n = 0; each(a, x => { if (bool(x)) n++; }); return n % 2 === 1; },
    NOT: a => !bool(a[0]),
    SWITCH: a => { const v = scalar(a[0]()); let i = 1; for (; i + 1 < a.length; i += 2) if (cmp(v, scalar(a[i]())) === 0) return a[i + 1](); if (i < a.length) return a[i](); throw ERR['#N/D']; },
    TRUE: () => true, FALSE: () => false,
    ROUND: a => round(num(a[0]), int(a[1] || 0)),
    ROUNDUP: a => { const f = Math.pow(10, int(a[1] || 0)), x = num(a[0]); return (x < 0 ? -1 : 1) * Math.ceil(round(Math.abs(x) * f, 9)) / f; },
    ROUNDDOWN: a => { const f = Math.pow(10, int(a[1] || 0)), x = num(a[0]); return (x < 0 ? -1 : 1) * Math.floor(round(Math.abs(x) * f, 9)) / f; },
    INT: a => Math.floor(num(a[0])),
    TRUNC: a => { const f = Math.pow(10, int(a[1] || 0)); return Math.trunc(num(a[0]) * f) / f; },
    ABS: a => Math.abs(num(a[0])),
    SQRT: a => { const x = num(a[0]); if (x < 0) throw ERR['#NÚM!']; return Math.sqrt(x); },
    POWER: a => Math.pow(num(a[0]), num(a[1])),
    MOD: a => { const n = num(a[0]), d = num(a[1]); if (d === 0) throw ERR['#DIV/0!']; return n - d * Math.floor(n / d); },
    PI: () => Math.PI,
    RAND: () => Math.random(),
    RANDBETWEEN: a => { const lo = Math.ceil(num(a[0])), hi = Math.floor(num(a[1])); return lo + Math.floor(Math.random() * (hi - lo + 1)); },
    PRODUCT: a => nums(a).reduce((p, x) => p * x, 1),
    SUMPRODUCT: a => { const L = a.map(flatVals); const n = L[0].length; if (L.some(l => l.length !== n)) throw ERR['#VALOR!']; let t = 0; for (let i = 0; i < n; i++) t += L.reduce((p, l) => p * (typeof l[i] === 'number' ? l[i] : typeof l[i] === 'boolean' ? +l[i] : 0), 1); return t; },
    SUMSQ: a => sum(nums(a).map(x => x * x)),
    MEDIAN: a => { const n = nums(a).sort((x, y) => x - y); if (!n.length) throw ERR['#NÚM!']; const h = n.length >> 1; return n.length % 2 ? n[h] : (n[h - 1] + n[h]) / 2; },
    MODE: a => { const c = new Map(); let best = null, bc = 1; nums(a).forEach(x => { const k = (c.get(x) || 0) + 1; c.set(x, k); if (k > bc) { bc = k; best = x; } }); if (best === null) throw ERR['#N/D']; return best; },
    STDEV: a => Math.sqrt(variance(nums(a), false)), STDEVP: a => Math.sqrt(variance(nums(a), true)),
    VAR: a => variance(nums(a), false), VARP: a => variance(nums(a), true),
    LARGE: a => { const n = nums([a[0]]).sort((x, y) => y - x), k = int(a[1]); if (k < 1 || k > n.length) throw ERR['#NÚM!']; return n[k - 1]; },
    SMALL: a => { const n = nums([a[0]]).sort((x, y) => x - y), k = int(a[1]); if (k < 1 || k > n.length) throw ERR['#NÚM!']; return n[k - 1]; },
    RANK: a => { const x = num(a[0]), n = nums([a[1]]), asc = a[2] !== undefined && num(a[2]) !== 0; if (!n.includes(x)) throw ERR['#N/D']; return 1 + n.filter(v => asc ? v < x : v > x).length; },
    CEILING: a => { const x = num(a[0]), s = a[1] === undefined ? 1 : num(a[1]); if (s === 0) return 0; return Math.ceil(round(x / s, 9)) * s; },
    FLOOR: a => { const x = num(a[0]), s = a[1] === undefined ? 1 : num(a[1]); if (s === 0) throw ERR['#DIV/0!']; return Math.floor(round(x / s, 9)) * s; },
    MROUND: a => { const x = num(a[0]), s = num(a[1]); if (s === 0) return 0; return Math.round(x / s) * s; },
    EXP: a => Math.exp(num(a[0])), LN: a => { const x = num(a[0]); if (x <= 0) throw ERR['#NÚM!']; return Math.log(x); },
    LOG: a => { const x = num(a[0]), b = a[1] === undefined ? 10 : num(a[1]); if (x <= 0 || b <= 0) throw ERR['#NÚM!']; return Math.log(x) / Math.log(b); },
    LOG10: a => { const x = num(a[0]); if (x <= 0) throw ERR['#NÚM!']; return Math.log10(x); },
    SIGN: a => Math.sign(num(a[0])),
    EVEN: a => { const x = num(a[0]); const c = Math.ceil(Math.abs(x) / 2) * 2; return x < 0 ? -c : c; },
    ODD: a => { const x = num(a[0]); let c = Math.ceil(Math.abs(x)); if (c % 2 === 0) c++; return x < 0 ? -c : c; },
    FACT: a => { let n = int(a[0]), f = 1; if (n < 0) throw ERR['#NÚM!']; while (n > 1) f *= n--; return f; },
    GCD: a => nums(a).map(Math.trunc).reduce((x, y) => { while (y) [x, y] = [y, x % y]; return x; }),
    LCM: a => nums(a).map(Math.trunc).reduce((x, y) => { let g = x, h = y; while (h) [g, h] = [h, g % h]; return x * y / g; }),
    SIN: a => Math.sin(num(a[0])), COS: a => Math.cos(num(a[0])), TAN: a => Math.tan(num(a[0])),
    RADIANS: a => num(a[0]) * Math.PI / 180, DEGREES: a => num(a[0]) * 180 / Math.PI,
    COUNTUNIQUE: a => { const s = new Set(); each(a, v => { if (v !== null && v !== '') s.add(typeof v === 'string' ? v.toLowerCase() : v); }); return s.size; },
    CONCATENATE: a => a.map(str).join(''),
    CONCAT: a => { let s = ''; each(a, v => { s += str(v); }); return s; },
    TEXTJOIN: a => { const d = str(a[0]), skip = bool(a[1]); const o = []; each(a.slice(2), v => { const t = str(v); if (!(skip && t === '')) o.push(t); }); return o.join(d); },
    LEFT: a => str(a[0]).slice(0, a[1] === undefined ? 1 : int(a[1])),
    RIGHT: a => { const s = str(a[0]), n = a[1] === undefined ? 1 : int(a[1]); return n <= 0 ? '' : s.slice(-n); },
    MID: a => { const s = str(a[0]), st = int(a[1]), n = int(a[2]); if (st < 1 || n < 0) throw ERR['#VALOR!']; return s.substr(st - 1, n); },
    LEN: a => str(a[0]).length,
    UPPER: a => str(a[0]).toUpperCase(), LOWER: a => str(a[0]).toLowerCase(),
    PROPER: a => str(a[0]).toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (m, p, c) => p + c.toUpperCase()),
    TRIM: a => str(a[0]).replace(/ +/g, ' ').trim(),
    SUBSTITUTE: a => { const s = str(a[0]), o = str(a[1]), n = str(a[2]); if (o === '') return s; if (a[3] === undefined) return s.split(o).join(n); let k = int(a[3]), i = -1; while (k-- > 0) { i = s.indexOf(o, i + 1); if (i < 0) return s; } return s.slice(0, i) + n + s.slice(i + o.length); },
    REPLACE: a => { const s = str(a[0]), st = int(a[1]), n = int(a[2]); return s.slice(0, st - 1) + str(a[3]) + s.slice(st - 1 + n); },
    FIND: a => { const i = str(a[1]).indexOf(str(a[0]), (a[2] === undefined ? 1 : int(a[2])) - 1); if (i < 0) throw ERR['#VALOR!']; return i + 1; },
    SEARCH: a => { const f = criterion(str(a[0]) + '*'); const s = str(a[1]); const st = (a[2] === undefined ? 1 : int(a[2])) - 1; for (let i = st; i < s.length; i++) if (f(s.slice(i))) return i + 1; throw ERR['#VALOR!']; },
    TEXT: a => {
      const v0 = scalar(a[0]), v = typeof v0 === 'string' && typeof SD.parseInput(v0).v === 'number' ? SD.parseInput(v0).v : v0;
      // formato escrito à brasileira: "#.##0,00", "dd/mm/aaaa" → código do Excel
      const z = str(a[1]).replace(/[.,]/g, ch => ch === '.' ? ',' : '.').replace(/a{3,4}/gi, 'yyyy').replace(/aa/gi, 'yy');
      return SD.formatValue(v, z).t;
    },
    VALUE: a => num(a[0]),
    REPT: a => str(a[0]).repeat(Math.max(0, int(a[1]))),
    EXACT: a => str(a[0]) === str(a[1]),
    CHAR: a => String.fromCharCode(int(a[0])), CODE: a => { const s = str(a[0]); if (!s) throw ERR['#VALOR!']; return s.charCodeAt(0); },
    CLEAN: a => str(a[0]).replace(/[\x00-\x1f]/g, ''),
    T: a => { const v = scalar(a[0]); return typeof v === 'string' ? v : ''; },
    N: a => { const v = scalar(a[0]); return typeof v === 'number' ? v : typeof v === 'boolean' ? +v : 0; },
    VLOOKUP: a => {
      const key = scalar(a[0]), g = grid(a[1]), col = int(a[2]), approx = a[3] === undefined ? true : bool(a[3]);
      if (col < 1 || col > (g[0] || []).length) throw ERR['#REF!'];
      const first = g.map(r => r[0]);
      const i = approx ? lookupApprox(first, key) : lookupExact(first, key);
      if (i < 0) throw ERR['#N/D'];
      return g[i][col - 1];
    },
    HLOOKUP: a => {
      const key = scalar(a[0]), g = grid(a[1]), row = int(a[2]), approx = a[3] === undefined ? true : bool(a[3]);
      if (row < 1 || row > g.length) throw ERR['#REF!'];
      const i = approx ? lookupApprox(g[0], key) : lookupExact(g[0], key);
      if (i < 0) throw ERR['#N/D'];
      return g[row - 1][i];
    },
    XLOOKUP: a => {
      const key = scalar(a[0]), look = flatVals(a[1]), ret = a[2];
      const i = lookupExact(look, key);
      if (i < 0) { if (a[3] !== undefined) return scalar(a[3]); throw ERR['#N/D']; }
      const g = grid(ret);
      return g.length === 1 ? g[0][i] : g[i][0];
    },
    LOOKUP: a => { const key = scalar(a[0]), look = flatVals(a[1]), ret = a[2] !== undefined ? flatVals(a[2]) : look; const i = lookupApprox(look, key); if (i < 0) throw ERR['#N/D']; return ret[i]; },
    INDEX: a => {
      const g = grid(a[0]); let r = a[1] === undefined ? 1 : int(a[1]), c = a[2] === undefined ? 1 : int(a[2]);
      if (g.length === 1 && a[2] === undefined) { c = r; r = 1; }
      if (r < 1 || c < 1 || r > g.length || c > g[0].length) throw ERR['#REF!'];
      return g[r - 1][c - 1];
    },
    MATCH: a => {
      const key = scalar(a[0]), vals = flatVals(a[1]), t = a[2] === undefined ? 1 : int(a[2]);
      let i;
      if (t === 0) i = lookupExact(vals, key);
      else if (t === 1) i = lookupApprox(vals, key);
      else { i = -1; for (let k = 0; k < vals.length; k++) { if (vals[k] !== null && cmp(vals[k], key) >= 0) i = k; else break; } }
      if (i < 0) throw ERR['#N/D'];
      return i + 1;
    },
    CHOOSE: a => { const i = int(a[0]()); if (i < 1 || i >= a.length) throw ERR['#VALOR!']; return a[i](); },
    ROW: (a, n) => { if (!n[0]) return ctx.r + 1; const v = a[0](); if (v instanceof Rng) return v.r1 + 1; throw ERR['#VALOR!']; },
    COLUMN: (a, n) => { if (!n[0]) return ctx.c + 1; const v = a[0](); if (v instanceof Rng) return v.c1 + 1; throw ERR['#VALOR!']; },
    ROWS: a => { const v = a[0](); return v instanceof Rng ? v.rows : grid(v).length; },
    COLUMNS: a => { const v = a[0](); return v instanceof Rng ? v.cols : grid(v)[0].length; },
    TRANSPOSE: a => { const g = grid(a[0]); return g[0][0]; },
    TODAY: () => SD.todaySerial(), NOW: () => SD.nowSerial(),
    DATE: a => { const y = int(a[0]), m = int(a[1]), d = int(a[2]); const t = new Date(Date.UTC(y < 1900 ? y + 1900 : y, m - 1, d)); return (t.getTime() - Date.UTC(1899, 11, 30)) / 86400000; },
    TIME: a => ((int(a[0]) * 3600 + int(a[1]) * 60 + int(a[2])) / 86400) % 1,
    YEAR: a => SD.serialToParts(num(a[0])).y, MONTH: a => SD.serialToParts(num(a[0])).m, DAY: a => SD.serialToParts(num(a[0])).d,
    HOUR: a => SD.serialToParts(num(a[0])).H, MINUTE: a => SD.serialToParts(num(a[0])).M, SECOND: a => SD.serialToParts(num(a[0])).S,
    WEEKDAY: a => { const w = SD.serialToParts(num(a[0])).wd, t = a[1] === undefined ? 1 : int(a[1]); return t === 2 ? (w + 6) % 7 + 1 : t === 3 ? (w + 6) % 7 : w + 1; },
    WEEKNUM: a => { const s = Math.floor(num(a[0])), p = SD.serialToParts(s); const jan1 = SD.dateToSerial(p.y, 1, 1); const w1 = SD.serialToParts(jan1).wd; return Math.floor((s - jan1 + w1) / 7) + 1; },
    DATEDIF: a => {
      const s = Math.floor(num(a[0])), e = Math.floor(num(a[1])), u = str(a[2]).toUpperCase();
      if (e < s) throw ERR['#NÚM!'];
      const P = SD.serialToParts(s), Q = SD.serialToParts(e);
      let months = (Q.y - P.y) * 12 + (Q.m - P.m); if (Q.d < P.d) months--;
      if (u === 'D') return e - s;
      if (u === 'M') return months;
      if (u === 'Y') return Math.floor(months / 12);
      if (u === 'YM') return months % 12;
      if (u === 'MD') { let d = Q.d - P.d; if (d < 0) { d += new Date(Date.UTC(Q.y, Q.m - 1, 0)).getUTCDate(); } return d; }
      if (u === 'YD') { let t = SD.dateToSerial(Q.y, P.m, P.d); if (t > e) t = SD.dateToSerial(Q.y - 1, P.m, P.d); return e - t; }
      throw ERR['#NÚM!'];
    },
    EDATE: a => addMonths(num(a[0]), int(a[1])),
    EOMONTH: a => { const p = SD.serialToParts(num(a[0])); const t = new Date(Date.UTC(p.y, p.m + int(a[1]), 0)); return SD.dateToSerial(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); },
    NETWORKDAYS: a => { let s = Math.floor(num(a[0])), e = Math.floor(num(a[1])), sg = 1; if (e < s) { [s, e] = [e, s]; sg = -1; } const hol = a[2] !== undefined ? new Set(nums([a[2]]).map(Math.floor)) : new Set(); let n = 0; for (let d = s; d <= e; d++) if (!isWeekend(d) && !hol.has(d)) n++; return n * sg; },
    WORKDAY: a => { let d = Math.floor(num(a[0])), n = int(a[1]); const hol = a[2] !== undefined ? new Set(nums([a[2]]).map(Math.floor)) : new Set(); const st = n < 0 ? -1 : 1; while (n !== 0) { d += st; if (!isWeekend(d) && !hol.has(d)) n -= st; } return d; },
    DAYS: a => Math.floor(num(a[0])) - Math.floor(num(a[1])),
    DATEVALUE: a => { const p = SD.parseInput(str(a[0])); if (typeof p.v !== 'number') throw ERR['#VALOR!']; return Math.floor(p.v); },
    YEARFRAC: a => Math.abs(num(a[1]) - num(a[0])) / 365,
    ISBLANK: a => { const v = scalar(a[0]()); return v === null || v === undefined; },
    ISNUMBER: a => typeof scalar(a[0]) === 'number',
    ISTEXT: a => typeof scalar(a[0]) === 'string',
    ISLOGICAL: a => typeof scalar(a[0]) === 'boolean',
    ISERROR: a => { try { return isErr(scalar(a[0]())); } catch (e) { return isErr(e); } },
    ISERR: a => { try { const v = scalar(a[0]()); return isErr(v) && v !== ERR['#N/D']; } catch (e) { return isErr(e) && e !== ERR['#N/D']; } },
    ISNA: a => { try { return scalar(a[0]()) === ERR['#N/D']; } catch (e) { return e === ERR['#N/D']; } },
    ISEVEN: a => Math.trunc(num(a[0])) % 2 === 0, ISODD: a => Math.abs(Math.trunc(num(a[0])) % 2) === 1,
    NA: () => { throw ERR['#N/D']; },
    PMT: a => { const r = num(a[0]), n = num(a[1]), pv = num(a[2]), fv = a[3] === undefined ? 0 : num(a[3]), t = a[4] === undefined ? 0 : num(a[4]); if (r === 0) return -(pv + fv) / n; const q = Math.pow(1 + r, n); return -(r * (pv * q + fv)) / ((1 + r * t) * (q - 1)); },
    FV: a => { const r = num(a[0]), n = num(a[1]), p = num(a[2]), pv = a[3] === undefined ? 0 : num(a[3]), t = a[4] === undefined ? 0 : num(a[4]); if (r === 0) return -(pv + p * n); const q = Math.pow(1 + r, n); return -(pv * q + p * (1 + r * t) * (q - 1) / r); },
    PV: a => { const r = num(a[0]), n = num(a[1]), p = num(a[2]), fv = a[3] === undefined ? 0 : num(a[3]), t = a[4] === undefined ? 0 : num(a[4]); if (r === 0) return -(fv + p * n); const q = Math.pow(1 + r, n); return -(fv + p * (1 + r * t) * (q - 1) / r) / q; },
    NPER: a => { const r = num(a[0]), p = num(a[1]), pv = num(a[2]), fv = a[3] === undefined ? 0 : num(a[3]), t = a[4] === undefined ? 0 : num(a[4]); if (r === 0) return -(pv + fv) / p; const z = p * (1 + r * t) / r; return Math.log((z - fv) / (z + pv)) / Math.log(1 + r); },
    RATE: a => { const n = num(a[0]), p = num(a[1]), pv = num(a[2]), fv = a[3] === undefined ? 0 : num(a[3]), t = a[4] === undefined ? 0 : num(a[4]); let r = a[5] === undefined ? 0.1 : num(a[5]); for (let i = 0; i < 100; i++) { const f = x => { if (Math.abs(x) < 1e-12) return pv + p * n + fv; const q = Math.pow(1 + x, n); return pv * q + p * (1 + x * t) * (q - 1) / x + fv; }; const y = f(r), d = (f(r + 1e-7) - y) / 1e-7; if (d === 0) break; const nr = r - y / d; if (Math.abs(nr - r) < 1e-10) return nr; r = nr; } if (!isFinite(r)) throw ERR['#NÚM!']; return r; },
    NPV: a => { const r = num(a[0]); return nums(a.slice(1)).reduce((s, v, i) => s + v / Math.pow(1 + r, i + 1), 0); },
    IRR: a => { const v = nums([a[0]]); let r = a[1] === undefined ? 0.1 : num(a[1]); for (let i = 0; i < 100; i++) { let f = 0, d = 0; v.forEach((x, k) => { f += x / Math.pow(1 + r, k); d -= k * x / Math.pow(1 + r, k + 1); }); if (d === 0) break; const nr = r - f / d; if (Math.abs(nr - r) < 1e-10) return nr; r = nr; } throw ERR['#NÚM!']; }
  };
  FN['MODE.SNGL'] = FN.MODE; FN['STDEV.S'] = FN.STDEV; FN['STDEV.P'] = FN.STDEVP; FN['VAR.S'] = FN.VAR; FN['VAR.P'] = FN.VARP; FN['RANK.EQ'] = FN.RANK;
  // no arquivo, funções novas do Excel levam o prefixo _xlfn.
  const XLFN = new Set(['IFS', 'IFNA', 'XOR', 'SWITCH', 'CONCAT', 'TEXTJOIN', 'XLOOKUP', 'MAXIFS', 'MINIFS', 'DAYS', 'MODE.SNGL', 'STDEV.S', 'STDEV.P', 'VAR.S', 'VAR.P', 'RANK.EQ']);

  /* ---------- avaliação ---------- */
  function evalNode(n) {
    switch (n.k) {
      case 'lit': return n.v;
      case 'empty': return null;
      case 'arr': return n.v;
      case 'ref': return resolveRef(n, ctx.sh);
      case 'name': throw ERR['#NOME?'];
      case 'bad': throw ERR['#NOME?'];
      case 'neg': return -num(evalNode(n.a));
      case 'pct': return num(evalNode(n.a)) / 100;
      case 'bin': {
        const A = evalNode(n.a), B = evalNode(n.b);
        if (n.op === '&') return str(A) + str(B);
        if ('=<><=>='.includes(n.op) && ['=', '<>', '<', '>', '<=', '>='].includes(n.op)) {
          const a = scalar(A), b = scalar(B);
          if (isErr(a)) throw a; if (isErr(b)) throw b;
          const k = cmp(a, b);
          return n.op === '=' ? k === 0 : n.op === '<>' ? k !== 0 : n.op === '<' ? k < 0 : n.op === '>' ? k > 0 : n.op === '<=' ? k <= 0 : k >= 0;
        }
        const a = num(A), b = num(B);
        switch (n.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': if (b === 0) throw ERR['#DIV/0!']; return a / b;
          case '^': { const r = Math.pow(a, b); if (!isFinite(r) || isNaN(r)) throw ERR['#NÚM!']; return r; }
        }
        throw ERR['#VALOR!'];
      }
      case 'fn': {
        const f = FN[n.name];
        if (!f) throw ERR['#NOME?'];
        if (LAZY.has(n.name)) return f(n.args.map(a => () => evalNode(a)), n.args.map(a => a.k !== 'empty'));
        const args = n.args.map(a => a.k === 'empty' ? undefined : evalNode(a));
        // erros diretos nos argumentos escalares
        return f(args, n.args.map(a => a.k !== 'empty'));
      }
    }
    throw ERR['#VALOR!'];
  }
  function finish(v) {
    v = scalar(v);
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number' && !isFinite(v)) return ERR['#NÚM!'];
    return v;
  }

  /* ---------- recálculo da pasta inteira ---------- */
  function recalc(wb) {
    const memo = new Map(), stack = new Set();
    const sheetIds = wb.sheets.map(s => s.id);
    const valueOf = (si, r, c) => {
      const sh = wb.sheets[si]; if (!sh) return ERR['#REF!'];
      const cell = sh.cells.get(r + ',' + c);
      if (!cell) return null;
      if (!cell.f) return cell.v === undefined ? null : cell.v;
      const mk = sheetIds[si] + ':' + r + ',' + c;
      if (memo.has(mk)) return memo.get(mk);
      if (stack.has(mk)) return ERR['#CIRC!'];
      stack.add(mk);
      const saved = ctx;
      ctx = { wb, sh: si, r, c, value: valueOf };
      let v;
      try { v = finish(evalNode(getAst(cell.f))); } catch (e) { v = isErr(e) ? e : ERR['#VALOR!']; }
      ctx = saved;
      stack.delete(mk);
      memo.set(mk, v);
      cell.val = v;
      return v;
    };
    let circ = false;
    wb.sheets.forEach((sh, si) => {
      sh.cells.forEach((cell, k) => {
        if (!cell.f) { if ('val' in cell) delete cell.val; return; }
        const [r, c] = SD.unkey(k);
        const v = valueOf(si, r, c);
        if (v === ERR['#CIRC!']) circ = true;
      });
    });
    return { circular: circ };
  }
  /** Avalia uma fórmula avulsa (ex.: pré-visualização) no contexto de uma planilha. */
  function evaluate(wb, si, f, r, c) {
    const memo = new Map();
    const valueOf = (s, rr, cc) => { const cell = wb.sheets[s] && wb.sheets[s].cells.get(rr + ',' + cc); if (!cell) return null; return cell.f ? (cell.val !== undefined ? cell.val : null) : cell.v; };
    const saved = ctx; ctx = { wb, sh: si, r: r || 0, c: c || 0, value: valueOf };
    try { return finish(evalNode(getAst(f))); } catch (e) { return isErr(e) ? e : ERR['#VALOR!']; } finally { ctx = saved; void memo; }
  }

  /* ---------- mover referências (copiar, preencher, inserir/excluir) ---------- */
  function mapRefs(f, fn) {
    const toks = tokenize(f, false);
    toks.forEach(k => { if (k.t === 'ref') { const o = fn(k); if (o === null) { k.t = 'err'; k.v = '#REF!'; } else k.v = o; } });
    return untokenize(toks, false);
  }
  function shiftRefText(ref, dr, dc) {
    let bad = false;
    const out = ref.replace(/(\$?)([A-Za-z]{1,3})?(\$?)(\d{1,7})?/g, (m, a1, col, a2, row) => {
      if (!m) return m;
      let s = '';
      if (col !== undefined) { let ci = SD.colIndex(col); if (!a1) ci += dc; if (ci < 0) bad = true; s += a1 + SD.colName(Math.max(0, ci)); }
      if (row !== undefined) { let ri = +row - 1; if (!a2) ri += dr; if (ri < 0) bad = true; s += a2 + (Math.max(0, ri) + 1); }
      else if (col === undefined) return m;
      return s;
    });
    return bad ? null : out;
  }
  /** Copia uma fórmula de (r0,c0) para (r1,c1): referências relativas acompanham. */
  const shiftFormula = (f, dr, dc) => mapRefs(f, k => shiftRefText(k.v, dr, dc));
  /**
   * Ajusta as fórmulas quando linhas/colunas são inseridas ou excluídas.
   * axis 'r' ou 'c'; at = primeira linha/coluna afetada; n > 0 insere, n < 0 exclui.
   * targetSheet = nome da planilha alterada; fSheet = nome da planilha onde a fórmula está.
   */
  function adjustForInsert(f, axis, at, n, targetSheet, fSheet) {
    return mapRefs(f, k => {
      const sheetName = k.sheet !== undefined ? k.sheet : fSheet;
      if (sheetName.toLowerCase() !== targetSheet.toLowerCase()) return k.v;
      const parts = k.v.split(':');
      const pos = parts.map(p => {
        const m = /^(\$?)([A-Za-z]{1,3})?(\$?)(\d{1,7})?$/.exec(p);
        return { a1: m[1], col: m[2] !== undefined ? SD.colIndex(m[2]) : null, a2: m[3], row: m[4] !== undefined ? +m[4] - 1 : null };
      });
      const get = p => axis === 'r' ? p.row : p.col;
      const set = (p, v) => { if (axis === 'r') p.row = v; else p.col = v; };
      if (pos.every(p => get(p) === null)) return k.v;
      if (n > 0) {
        pos.forEach(p => { const v = get(p); if (v !== null && v >= at) set(p, v + n); });
      } else {
        const d = -n, end = at + d - 1;
        if (pos.length === 1) {
          const v = get(pos[0]);
          if (v >= at && v <= end) return null;
          if (v > end) set(pos[0], v - d);
        } else {
          let a = get(pos[0]), b = get(pos[1]);
          if (a >= at && b <= end) return null;
          const na = a > end ? a - d : a >= at ? at : a;
          const nb = b > end ? b - d : b >= at ? at - 1 : b;
          if (nb < na) return null;
          set(pos[0], na); set(pos[1], nb);
        }
      }
      return pos.map(p => (p.col !== null ? p.a1 + SD.colName(p.col) : '') + (p.row !== null ? p.a2 + (p.row + 1) : '')).join(':');
    });
  }
  /** Troca o nome de uma planilha dentro das fórmulas. */
  function renameSheetRefs(f, oldName, newName) {
    const toks = tokenize(f, false);
    toks.forEach(k => { if (k.t === 'ref' && k.sheet !== undefined && k.sheet.toLowerCase() === oldName.toLowerCase()) k.sheet = newName; });
    return untokenize(toks, false);
  }
  /** Referências de uma fórmula exibida (para colorir enquanto edita). */
  function refsIn(displayF) {
    const out = []; let pos = 1;
    tokenize(displayF.slice(1), true).forEach(k => {
      const len = untokenize([k], true).length;
      if (k.t === 'ref') out.push({ sheet: k.sheet, ref: k.v, start: pos, end: pos + len });
      pos += len;
    });
    return out;
  }
  /** Fórmula para salvar em arquivo .xlsx (com _xlfn. nas funções novas). */
  function toFileFormula(f) {
    return untokenize(tokenize(f, false).map(k => k.t === 'fn' && XLFN.has(toEn(k.v)) ? Object.assign({}, k, { v: '_xlfn.' + toEn(k.v) }) : k), false).replace(/_xlfn\._xlfn\./g, '_xlfn.');
  }
  const fromFileFormula = f => String(f).replace(/^=/, '').replace(/_xlfn\.|_xlws\./gi, '');

  /* ---------- biblioteca de funções (janela "Inserir função") ---------- */
  const CAT = {
    'Mais usadas': ['SUM', 'AVERAGE', 'IF', 'COUNT', 'MAX', 'MIN', 'VLOOKUP', 'SUMIF', 'COUNTIF', 'ROUND', 'TODAY', 'CONCAT'],
    'Matemática': ['SUM', 'SUMIF', 'SUMIFS', 'SUMPRODUCT', 'PRODUCT', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'INT', 'TRUNC', 'ABS', 'SQRT', 'POWER', 'MOD', 'PI', 'RAND', 'RANDBETWEEN', 'CEILING', 'FLOOR', 'MROUND', 'EXP', 'LN', 'LOG', 'LOG10', 'SIGN', 'FACT', 'GCD', 'LCM', 'SIN', 'COS', 'TAN', 'RADIANS', 'DEGREES', 'EVEN', 'ODD', 'SUMSQ'],
    'Estatística': ['AVERAGE', 'AVERAGEIF', 'AVERAGEIFS', 'COUNT', 'COUNTA', 'COUNTBLANK', 'COUNTIF', 'COUNTIFS', 'MAX', 'MIN', 'MAXIFS', 'MINIFS', 'MEDIAN', 'MODE', 'STDEV', 'STDEVP', 'VAR', 'VARP', 'LARGE', 'SMALL', 'RANK'],
    'Lógica': ['IF', 'IFS', 'IFERROR', 'IFNA', 'AND', 'OR', 'NOT', 'XOR', 'SWITCH', 'TRUE', 'FALSE'],
    'Texto': ['CONCAT', 'CONCATENATE', 'TEXTJOIN', 'LEFT', 'RIGHT', 'MID', 'LEN', 'UPPER', 'LOWER', 'PROPER', 'TRIM', 'SUBSTITUTE', 'REPLACE', 'FIND', 'SEARCH', 'TEXT', 'VALUE', 'REPT', 'EXACT', 'CHAR', 'CODE', 'CLEAN'],
    'Procura e referência': ['VLOOKUP', 'HLOOKUP', 'XLOOKUP', 'LOOKUP', 'INDEX', 'MATCH', 'CHOOSE', 'ROW', 'COLUMN', 'ROWS', 'COLUMNS'],
    'Data e hora': ['TODAY', 'NOW', 'DATE', 'TIME', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'WEEKDAY', 'WEEKNUM', 'DATEDIF', 'EDATE', 'EOMONTH', 'NETWORKDAYS', 'WORKDAY', 'DAYS', 'DATEVALUE'],
    'Informação': ['ISBLANK', 'ISNUMBER', 'ISTEXT', 'ISLOGICAL', 'ISERROR', 'ISERR', 'ISNA', 'ISEVEN', 'ISODD', 'NA', 'N', 'T'],
    'Financeira': ['PMT', 'FV', 'PV', 'NPER', 'RATE', 'NPV', 'IRR']
  };
  const DOC = {
    SUM: ['núm1; [núm2]; …', 'Soma os números.'], AVERAGE: ['núm1; [núm2]; …', 'Média aritmética dos números.'], MIN: ['núm1; …', 'O menor número.'], MAX: ['núm1; …', 'O maior número.'],
    COUNT: ['valor1; …', 'Conta as células que têm números.'], COUNTA: ['valor1; …', 'Conta as células que não estão vazias.'], COUNTBLANK: ['intervalo', 'Conta as células vazias.'],
    COUNTIF: ['intervalo; critério', 'Conta as células que atendem a um critério. Ex.: =CONT.SE(A:A;">10")'], COUNTIFS: ['intervalo1; critério1; …', 'Conta quando todos os critérios são atendidos.'],
    SUMIF: ['intervalo; critério; [intervalo_soma]', 'Soma as células que atendem a um critério. Ex.: =SOMASE(A:A;"Aluguel";B:B)'], SUMIFS: ['intervalo_soma; intervalo1; critério1; …', 'Soma com vários critérios.'],
    AVERAGEIF: ['intervalo; critério; [intervalo_média]', 'Média das células que atendem ao critério.'], AVERAGEIFS: ['intervalo_média; intervalo1; critério1; …', 'Média com vários critérios.'],
    MAXIFS: ['intervalo_max; intervalo1; critério1; …', 'Maior valor com critérios.'], MINIFS: ['intervalo_min; intervalo1; critério1; …', 'Menor valor com critérios.'],
    IF: ['teste; [se_verdadeiro]; [se_falso]', 'Escolhe um resultado conforme o teste. Ex.: =SE(B2>=7;"Aprovado";"Recuperação")'], IFS: ['teste1; valor1; teste2; valor2; …', 'Vários testes em sequência.'],
    IFERROR: ['valor; valor_se_erro', 'Mostra outro valor quando a fórmula dá erro.'], IFNA: ['valor; valor_se_nd', 'Outro valor quando o resultado é #N/D.'],
    AND: ['lógico1; …', 'VERDADEIRO se todos forem verdadeiros.'], OR: ['lógico1; …', 'VERDADEIRO se algum for verdadeiro.'], NOT: ['lógico', 'Inverte VERDADEIRO e FALSO.'], XOR: ['lógico1; …', 'OU exclusivo.'],
    SWITCH: ['expressão; valor1; resultado1; …; [padrão]', 'Compara um valor com uma lista.'], TRUE: ['', 'O valor VERDADEIRO.'], FALSE: ['', 'O valor FALSO.'],
    ROUND: ['número; casas', 'Arredonda.'], ROUNDUP: ['número; casas', 'Arredonda para cima.'], ROUNDDOWN: ['número; casas', 'Arredonda para baixo.'], INT: ['número', 'Parte inteira (para baixo).'], TRUNC: ['número; [casas]', 'Corta as casas decimais.'],
    ABS: ['número', 'Valor absoluto.'], SQRT: ['número', 'Raiz quadrada.'], POWER: ['número; potência', 'Eleva a uma potência.'], MOD: ['número; divisor', 'Resto da divisão.'], PI: ['', 'O número π.'],
    RAND: ['', 'Número aleatório entre 0 e 1.'], RANDBETWEEN: ['inferior; superior', 'Inteiro aleatório entre dois valores.'], PRODUCT: ['núm1; …', 'Multiplica os números.'], SUMPRODUCT: ['matriz1; matriz2; …', 'Soma dos produtos.'],
    SUMSQ: ['núm1; …', 'Soma dos quadrados.'], MEDIAN: ['núm1; …', 'Mediana.'], MODE: ['núm1; …', 'Valor mais frequente.'], STDEV: ['núm1; …', 'Desvio padrão (amostra).'], STDEVP: ['núm1; …', 'Desvio padrão (população).'],
    VAR: ['núm1; …', 'Variância (amostra).'], VARP: ['núm1; …', 'Variância (população).'], LARGE: ['matriz; k', 'O k-ésimo maior valor.'], SMALL: ['matriz; k', 'O k-ésimo menor valor.'], RANK: ['número; lista; [ordem]', 'Posição do número na lista.'],
    CEILING: ['número; múltiplo', 'Arredonda para cima até o múltiplo.'], FLOOR: ['número; múltiplo', 'Arredonda para baixo até o múltiplo.'], MROUND: ['número; múltiplo', 'Arredonda para o múltiplo mais próximo.'],
    EXP: ['número', 'e elevado ao número.'], LN: ['número', 'Logaritmo natural.'], LOG: ['número; [base]', 'Logaritmo.'], LOG10: ['número', 'Logaritmo na base 10.'], SIGN: ['número', '1, 0 ou -1 conforme o sinal.'],
    FACT: ['número', 'Fatorial.'], GCD: ['núm1; …', 'Máximo divisor comum.'], LCM: ['núm1; …', 'Mínimo múltiplo comum.'], SIN: ['ângulo', 'Seno (radianos).'], COS: ['ângulo', 'Cosseno (radianos).'], TAN: ['ângulo', 'Tangente (radianos).'],
    RADIANS: ['graus', 'Converte graus em radianos.'], DEGREES: ['radianos', 'Converte radianos em graus.'], EVEN: ['número', 'Arredonda para o par seguinte.'], ODD: ['número', 'Arredonda para o ímpar seguinte.'],
    CONCATENATE: ['texto1; …', 'Junta textos.'], CONCAT: ['texto1; …', 'Junta textos e intervalos.'], TEXTJOIN: ['delimitador; ignorar_vazio; texto1; …', 'Junta textos com um separador.'],
    LEFT: ['texto; [n]', 'Primeiros caracteres.'], RIGHT: ['texto; [n]', 'Últimos caracteres.'], MID: ['texto; início; n', 'Caracteres do meio.'], LEN: ['texto', 'Número de caracteres.'],
    UPPER: ['texto', 'MAIÚSCULAS.'], LOWER: ['texto', 'minúsculas.'], PROPER: ['texto', 'Primeira Letra De Cada Palavra.'], TRIM: ['texto', 'Tira espaços extras.'],
    SUBSTITUTE: ['texto; antigo; novo; [ocorrência]', 'Troca um texto por outro.'], REPLACE: ['texto; início; n; novo', 'Troca parte do texto pela posição.'], FIND: ['procurar; no_texto; [início]', 'Posição de um texto (diferencia maiúsculas).'],
    SEARCH: ['procurar; no_texto; [início]', 'Posição de um texto (aceita * e ?).'], TEXT: ['valor; formato', 'Número como texto formatado. Ex.: =TEXTO(A1;"dd/mm/aaaa")'], VALUE: ['texto', 'Converte texto em número.'],
    REPT: ['texto; vezes', 'Repete um texto.'], EXACT: ['texto1; texto2', 'Compara dois textos exatamente.'], CHAR: ['número', 'Caractere do código.'], CODE: ['texto', 'Código do primeiro caractere.'], CLEAN: ['texto', 'Tira caracteres invisíveis.'],
    VLOOKUP: ['valor; tabela; coluna; [aproximado]', 'Procura na primeira coluna e devolve outra coluna da mesma linha. Ex.: =PROCV(A2;Produtos!A:C;3;FALSO)'],
    HLOOKUP: ['valor; tabela; linha; [aproximado]', 'Procura na primeira linha.'], XLOOKUP: ['valor; procurar_em; devolver; [se_não_achar]', 'Procura moderna, em qualquer direção.'], LOOKUP: ['valor; vetor; [resultado]', 'Procura aproximada.'],
    INDEX: ['matriz; linha; [coluna]', 'Valor de uma posição da tabela.'], MATCH: ['valor; matriz; [tipo]', 'Posição de um valor na lista (0 = exato).'], CHOOSE: ['índice; valor1; valor2; …', 'Escolhe um valor da lista.'],
    ROW: ['[ref]', 'Número da linha.'], COLUMN: ['[ref]', 'Número da coluna.'], ROWS: ['intervalo', 'Quantidade de linhas.'], COLUMNS: ['intervalo', 'Quantidade de colunas.'],
    TODAY: ['', 'Data de hoje.'], NOW: ['', 'Data e hora de agora.'], DATE: ['ano; mês; dia', 'Monta uma data.'], TIME: ['hora; minuto; segundo', 'Monta um horário.'], YEAR: ['data', 'Ano.'], MONTH: ['data', 'Mês.'], DAY: ['data', 'Dia.'],
    HOUR: ['hora', 'Hora.'], MINUTE: ['hora', 'Minuto.'], SECOND: ['hora', 'Segundo.'], WEEKDAY: ['data; [tipo]', 'Dia da semana (1 = domingo).'], WEEKNUM: ['data', 'Número da semana no ano.'],
    DATEDIF: ['início; fim; unidade', 'Diferença entre datas em "D", "M" ou "Y". Ex.: idade =DATADIF(B2;HOJE();"Y")'], EDATE: ['data; meses', 'Soma meses a uma data.'], EOMONTH: ['data; meses', 'Último dia do mês.'],
    NETWORKDAYS: ['início; fim; [feriados]', 'Dias úteis entre duas datas.'], WORKDAY: ['início; dias; [feriados]', 'Data depois de N dias úteis.'], DAYS: ['fim; início', 'Dias entre duas datas.'], DATEVALUE: ['texto', 'Converte texto em data.'],
    ISBLANK: ['valor', 'Está vazia?'], ISNUMBER: ['valor', 'É número?'], ISTEXT: ['valor', 'É texto?'], ISLOGICAL: ['valor', 'É VERDADEIRO/FALSO?'], ISERROR: ['valor', 'É erro?'], ISERR: ['valor', 'É erro (menos #N/D)?'], ISNA: ['valor', 'É #N/D?'],
    ISEVEN: ['número', 'É par?'], ISODD: ['número', 'É ímpar?'], NA: ['', 'O erro #N/D.'], N: ['valor', 'Converte em número.'], T: ['valor', 'Devolve o texto.'],
    PMT: ['taxa; nper; vp; [vf]; [tipo]', 'Valor da prestação. Ex.: =PGTO(1%;12;-1000)'], FV: ['taxa; nper; pgto; [vp]; [tipo]', 'Valor futuro.'], PV: ['taxa; nper; pgto; [vf]; [tipo]', 'Valor presente.'],
    NPER: ['taxa; pgto; vp; [vf]; [tipo]', 'Número de períodos.'], RATE: ['nper; pgto; vp; [vf]; [tipo]', 'Taxa de juros por período.'], NPV: ['taxa; valor1; …', 'Valor presente líquido.'], IRR: ['valores; [estimativa]', 'Taxa interna de retorno.']
  };
  const library = () => ({ categorias: CAT, doc: DOC, pt: PT });

  SD.F = { tokenize, untokenize, toDisplay, toCanonical, parse, check, recalc, evaluate, shiftFormula, adjustForInsert, renameSheetRefs, refsIn, toFileFormula, fromFileFormula, library, PT, toEn, FN, cmp, Rng };
})();
