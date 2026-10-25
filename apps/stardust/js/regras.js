/* ==========================================================================
   Stardust — js/regras.js   [Nebulosa]
   Formatação condicional, validação de dados (listas suspensas e limites)
   e comentários nas células. Aqui ficam o modelo e as contas; o desenho
   está em grade.js, as janelas em app.js e os arquivos em arquivos.js.

   Modelo (em cada planilha):
     sh.condFormats = [{ range, tipo, v1, v2, estilo:{bg,fc,b,i}, cores:[...], cor }]
        (a primeira regra da lista tem prioridade, como no Excel)
     sh.validations = [{ range, tipo, op, v1, v2, lista:[...], fonte, bloquear, msg }]
        (a última regra que cobre a célula é a que vale)
     sh.notas = { 'linha,coluna': { t: 'texto', a: 'autor' } }
   "range" aceita várias áreas separadas por espaço: "A1:A10 C1:C10".
   ========================================================================== */
(function () {
  'use strict';
  const SD = window.SD;
  const R = {};
  const MAX_R = 1048576, MAX_C = 16384;

  /* ---------- áreas ---------- */
  function parseArea(s) {
    s = String(s).trim().replace(/\$/g, '');
    if (!s) return null;
    const g = SD.parseRange(s); if (g) return g;
    let m = /^([A-Z]{1,3}):([A-Z]{1,3})$/i.exec(s);
    if (m) return SD.norm({ r1: 0, r2: MAX_R - 1, c1: SD.colIndex(m[1]), c2: SD.colIndex(m[2]) });
    m = /^(\d+):(\d+)$/.exec(s);
    if (m) return SD.norm({ r1: +m[1] - 1, r2: +m[2] - 1, c1: 0, c2: MAX_C - 1 });
    return null;
  }
  const cacheAreas = new Map();
  R.areas = function (str) {
    str = String(str || '');
    let a = cacheAreas.get(str);
    if (!a) { a = str.split(/[\s,;]+/).map(parseArea).filter(Boolean); if (cacheAreas.size > 2000) cacheAreas.clear(); cacheAreas.set(str, a); }
    return a;
  };
  R.areaStr = g => {
    if (g.r1 === 0 && g.r2 >= MAX_R - 1) return SD.colName(g.c1) + ':' + SD.colName(g.c2);
    if (g.c1 === 0 && g.c2 >= MAX_C - 1) return (g.r1 + 1) + ':' + (g.r2 + 1);
    return SD.rangeStr(g);
  };
  R.rangeStr = lista => lista.map(R.areaStr).join(' ');
  R.cobre = (regra, r, c) => R.areas(regra.range).some(g => SD.inRange(g, r, c));
  const cruza = (a, b) => a.r1 <= b.r2 && a.r2 >= b.r1 && a.c1 <= b.c2 && a.c2 >= b.c1;
  R.cruza = (regra, g) => R.areas(regra.range).some(a => cruza(a, g));
  /** Tira a área "corte" de "g" (devolve até 4 retângulos). */
  function subtrair(g, corte) {
    if (!cruza(g, corte)) return [g];
    const o = [];
    if (g.r1 < corte.r1) o.push({ r1: g.r1, r2: corte.r1 - 1, c1: g.c1, c2: g.c2 });
    if (g.r2 > corte.r2) o.push({ r1: corte.r2 + 1, r2: g.r2, c1: g.c1, c2: g.c2 });
    const r1 = Math.max(g.r1, corte.r1), r2 = Math.min(g.r2, corte.r2);
    if (g.c1 < corte.c1) o.push({ r1, r2, c1: g.c1, c2: corte.c1 - 1 });
    if (g.c2 > corte.c2) o.push({ r1, r2, c1: corte.c2 + 1, c2: g.c2 });
    return o;
  }
  /** Remove a área g de todas as regras da lista (as que ficam vazias somem). */
  R.recortar = function (lista, g) {
    return (lista || []).map(rg => {
      if (!R.cruza(rg, g)) return rg;
      const sobra = R.areas(rg.range).flatMap(a => subtrair(a, g));
      return sobra.length ? Object.assign({}, rg, { range: R.rangeStr(sobra) }) : null;
    }).filter(Boolean);
  };

  /* ---------- valores ---------- */
  const valOf = cell => !cell ? null : cell.f ? (cell.val === undefined ? null : cell.val) : cell.v;
  R.valOf = valOf;
  /** Texto digitado numa regra ("10", "1.234,5", "01/02/2025", "sim") → valor. */
  R.alvo = function (txt) {
    if (txt === undefined || txt === null || txt === '') return null;
    if (typeof txt === 'number') return txt;
    const p = SD.parseInput(String(txt));
    return p.v === null ? String(txt) : p.v;
  };
  const vazio = v => v === null || v === undefined || v === '';
  function comparar(v, alvo) { // <0, 0, >0 ou null (tipos diferentes)
    if (typeof v === 'number' && typeof alvo === 'number') return v - alvo;
    if (typeof v === 'string' && typeof alvo === 'string') return v.localeCompare(alvo, 'pt-BR', { sensitivity: 'base' });
    if (typeof v === 'boolean' && typeof alvo === 'boolean') return (v ? 1 : 0) - (alvo ? 1 : 0);
    return null;
  }
  function textoDe(v, z) { return SD.formatValue(v, z).t || String(v); }

  /* ======================================================================
     Formatação condicional
     ====================================================================== */
  R.TIPOS_COND = [
    { id: 'maior', nome: 'Maior que', n: 1 },
    { id: 'menor', nome: 'Menor que', n: 1 },
    { id: 'maiorIgual', nome: 'Maior ou igual a', n: 1 },
    { id: 'menorIgual', nome: 'Menor ou igual a', n: 1 },
    { id: 'entre', nome: 'Entre', n: 2 },
    { id: 'igual', nome: 'Igual a', n: 1 },
    { id: 'diferente', nome: 'Diferente de', n: 1 },
    { id: 'contem', nome: 'Texto que contém', n: 1 },
    { id: 'duplicados', nome: 'Valores repetidos', n: 0 },
    { id: 'unicos', nome: 'Valores que não se repetem', n: 0 },
    { id: 'acimaMedia', nome: 'Acima da média', n: 0 },
    { id: 'abaixoMedia', nome: 'Abaixo da média', n: 0 },
    { id: 'escala', nome: 'Escala de cores', n: 0, visual: true },
    { id: 'barras', nome: 'Barras de dados', n: 0, visual: true }
  ];
  R.ESTILOS = [
    { id: 'vermelho', nome: 'Vermelho claro com texto vermelho escuro', bg: '#ffc7ce', fc: '#9c0006' },
    { id: 'amarelo', nome: 'Amarelo com texto amarelo escuro', bg: '#ffeb9c', fc: '#9c5700' },
    { id: 'verde', nome: 'Verde com texto verde escuro', bg: '#c6efce', fc: '#006100' },
    { id: 'roxo', nome: 'Roxo Nebulosa', bg: '#e6dbff', fc: '#4b2a99' },
    { id: 'laranja', nome: 'Laranja Nebulosa', bg: '#ffe0c7', fc: '#8a3d00' },
    { id: 'negrito', nome: 'Só texto em negrito', b: true },
    { id: 'textoVermelho', nome: 'Só texto vermelho', fc: '#c00000' }
  ];
  R.ESCALAS = [
    { id: 'vav', nome: 'Verde · amarelo · vermelho', cores: ['#63be7b', '#ffeb84', '#f8696b'] },
    { id: 'rav', nome: 'Vermelho · amarelo · verde', cores: ['#f8696b', '#ffeb84', '#63be7b'] },
    { id: 'roxo', nome: 'Branco · roxo', cores: ['#ffffff', '#a778ff'] },
    { id: 'laranja', nome: 'Branco · laranja', cores: ['#ffffff', '#ff9c54'] },
    { id: 'azul', nome: 'Azul · branco · vermelho', cores: ['#5a8ac6', '#fcfcff', '#f8696b'] }
  ];
  R.BARRAS = ['#a778ff', '#ff9c54', '#638ec6', '#63c384', '#ff555a', '#ffb628'];

  R.descreverCond = function (rg) {
    const t = R.TIPOS_COND.find(x => x.id === rg.tipo);
    let d = t ? t.nome : rg.tipo;
    if (rg.tipo === 'entre') d += ' ' + rg.v1 + ' e ' + rg.v2;
    else if (t && t.n === 1) d += rg.tipo === 'contem' ? ' “' + rg.v1 + '”' : ' ' + rg.v1;
    return d;
  };

  let geracao = 0;
  R.invalidar = () => { geracao++; };
  const cacheCond = new WeakMap();
  const chaveDup = v => typeof v === 'string' ? 's' + v.toLowerCase() : typeof v + String(v);
  function preparar(sh) {
    let c = cacheCond.get(sh);
    if (c && c.g === geracao && c.lista === sh.condFormats) return c;
    c = { g: geracao, lista: sh.condFormats, regras: [] };
    (sh.condFormats || []).forEach(rg => {
      const areas = R.areas(rg.range);
      if (!areas.length) return;
      const it = { rg, areas };
      const precisa = ['duplicados', 'unicos', 'acimaMedia', 'abaixoMedia', 'escala', 'barras'].includes(rg.tipo);
      if (precisa) {
        const nums = [], cont = new Map();
        sh.cells.forEach((cell, k) => {
          const v = valOf(cell); if (vazio(v) || SD.isErr(v)) return;
          const [r, cc] = SD.unkey(k);
          if (!areas.some(g => SD.inRange(g, r, cc))) return;
          if (typeof v === 'number') nums.push(v);
          const kk = chaveDup(v); cont.set(kk, (cont.get(kk) || 0) + 1);
        });
        it.cont = cont;
        if (nums.length) {
          nums.sort((a, b) => a - b);
          it.min = nums[0]; it.max = nums[nums.length - 1];
          it.media = nums.reduce((a, b) => a + b, 0) / nums.length;
          const p = (nums.length - 1) * 0.5, lo = Math.floor(p);
          it.meio = nums[lo] + (nums[Math.min(lo + 1, nums.length - 1)] - nums[lo]) * (p - lo);
        }
      } else {
        it.a1 = R.alvo(rg.v1); it.a2 = R.alvo(rg.v2);
      }
      c.regras.push(it);
    });
    cacheCond.set(sh, c);
    return c;
  }
  function misturar(c1, c2, t) {
    const a = SD.hexToRgb(c1) || { r: 255, g: 255, b: 255 }, b = SD.hexToRgb(c2) || { r: 255, g: 255, b: 255 };
    const f = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
    return '#' + f(a.r, b.r) + f(a.g, b.g) + f(a.b, b.b);
  }
  function corEscala(it, v) {
    const cores = it.rg.cores && it.rg.cores.length >= 2 ? it.rg.cores : R.ESCALAS[0].cores;
    if (it.max === it.min) return cores[cores.length === 3 ? 1 : 0];
    if (cores.length === 2) return misturar(cores[0], cores[1], (v - it.min) / (it.max - it.min));
    if (v <= it.meio) return misturar(cores[0], cores[1], it.meio === it.min ? 1 : (v - it.min) / (it.meio - it.min));
    return misturar(cores[1], cores[2], it.max === it.meio ? 0 : (v - it.meio) / (it.max - it.meio));
  }
  function confere(it, v, z) {
    const rg = it.rg;
    switch (rg.tipo) {
      case 'maior': { const k = comparar(v, it.a1); return k !== null && k > 0; }
      case 'menor': { const k = comparar(v, it.a1); return k !== null && k < 0; }
      case 'maiorIgual': { const k = comparar(v, it.a1); return k !== null && k >= 0; }
      case 'menorIgual': { const k = comparar(v, it.a1); return k !== null && k <= 0; }
      case 'entre': { const a = comparar(v, it.a1), b = comparar(v, it.a2); if (a === null || b === null) return false; const lo = comparar(it.a1, it.a2) <= 0; return lo ? a >= 0 && b <= 0 : a <= 0 && b >= 0; }
      case 'igual': { if (typeof it.a1 === 'string') return textoDe(v, z).toLowerCase() === it.a1.toLowerCase() || comparar(v, it.a1) === 0; return comparar(v, it.a1) === 0; }
      case 'diferente': { if (typeof it.a1 === 'string') return !(textoDe(v, z).toLowerCase() === it.a1.toLowerCase() || comparar(v, it.a1) === 0); return comparar(v, it.a1) !== 0; }
      case 'contem': return rg.v1 !== undefined && rg.v1 !== '' && textoDe(v, z).toLowerCase().includes(String(rg.v1).toLowerCase());
      case 'duplicados': return (it.cont.get(chaveDup(v)) || 0) > 1;
      case 'unicos': return (it.cont.get(chaveDup(v)) || 0) === 1;
      case 'acimaMedia': return typeof v === 'number' && it.media !== undefined && v > it.media;
      case 'abaixoMedia': return typeof v === 'number' && it.media !== undefined && v < it.media;
    }
    return false;
  }
  /**
   * Formatação condicional de uma célula. Devolve null ou
   * { s: {bg, fc, b, i}, barra: { frac, cor } }.
   */
  R.condicional = function (sh, r, c, cell) {
    if (!sh.condFormats || !sh.condFormats.length || !cell) return null;
    const v = valOf(cell);
    if (vazio(v) || SD.isErr(v)) return null;
    const p = preparar(sh);
    let s = null, barra = null;
    // da última para a primeira: a primeira regra (prioridade 1) fica por cima
    for (let i = p.regras.length - 1; i >= 0; i--) {
      const it = p.regras[i];
      if (!it.areas.some(g => SD.inRange(g, r, c))) continue;
      const rg = it.rg;
      if (rg.tipo === 'escala') { if (typeof v === 'number' && it.min !== undefined) s = Object.assign(s || {}, { bg: corEscala(it, v) }); continue; }
      if (rg.tipo === 'barras') {
        if (typeof v === 'number' && it.max !== undefined) {
          const base = Math.min(0, it.min), topo = Math.max(it.max, base + 1e-9);
          barra = { frac: Math.max(0.04, Math.min(1, (v - base) / (topo - base))), cor: rg.cor || R.BARRAS[0] };
        }
        continue;
      }
      if (confere(it, v, cell.s && cell.s.z)) {
        const e = rg.estilo || {};
        s = Object.assign(s || {}, e.bg ? { bg: e.bg } : {}, e.fc ? { fc: e.fc } : {}, e.b ? { b: true } : {}, e.i ? { i: true } : {});
      }
    }
    return s || barra ? { s, barra } : null;
  };

  /* ======================================================================
     Validação de dados
     ====================================================================== */
  R.TIPOS_VAL = [
    { id: 'lista', nome: 'Lista de opções (caixa suspensa)' },
    { id: 'inteiro', nome: 'Número inteiro' },
    { id: 'decimal', nome: 'Número (com ou sem casas decimais)' },
    { id: 'data', nome: 'Data' },
    { id: 'texto', nome: 'Tamanho do texto' }
  ];
  R.OPS = [
    { id: 'entre', nome: 'entre', n: 2 }, { id: 'fora', nome: 'fora do intervalo', n: 2 },
    { id: 'igual', nome: 'igual a', n: 1 }, { id: 'diferente', nome: 'diferente de', n: 1 },
    { id: 'maior', nome: 'maior que', n: 1 }, { id: 'menor', nome: 'menor que', n: 1 },
    { id: 'maiorIgual', nome: 'maior ou igual a', n: 1 }, { id: 'menorIgual', nome: 'menor ou igual a', n: 1 }
  ];
  R.validacaoEm = function (sh, r, c) {
    const l = sh.validations; if (!l || !l.length) return null;
    for (let i = l.length - 1; i >= 0; i--) if (R.cobre(l[i], r, c)) return l[i];
    return null;
  };
  /** Opções de uma lista (texto). "fonte" é um intervalo, ex.: Cores!$A$1:$A$5 */
  R.opcoes = function (wb, sh, vd) {
    if (!vd || vd.tipo !== 'lista') return [];
    if (vd.fonte) {
      let alvo = sh, ref = String(vd.fonte).replace(/^=/, '').trim();
      const m = /^(?:'((?:[^']|'')+)'|([^!]+))!(.+)$/.exec(ref);
      if (m) { const nome = (m[1] || m[2]).replace(/''/g, "'"); alvo = wb.sheets.find(s => s.name.toLowerCase() === nome.toLowerCase()); ref = m[3]; }
      const g = alvo && parseArea(ref);
      if (!g) return [];
      const o = [], r2 = Math.min(g.r2, g.r1 + 999), c2 = Math.min(g.c2, g.c1 + 50);
      for (let r = g.r1; r <= r2; r++) for (let c = g.c1; c <= c2; c++) {
        const cell = alvo.cells.get(r + ',' + c), v = valOf(cell);
        if (!vazio(v)) o.push(textoDe(v, cell.s && cell.s.z));
      }
      return o;
    }
    return (vd.lista || []).filter(x => x !== '');
  };
  function confereOp(op, x, a, b) {
    if (a === null || a === undefined || typeof a !== 'number') return true;
    switch (op) {
      case 'entre': return typeof b !== 'number' || (x >= Math.min(a, b) && x <= Math.max(a, b));
      case 'fora': return typeof b !== 'number' || (x < Math.min(a, b) || x > Math.max(a, b));
      case 'igual': return x === a;
      case 'diferente': return x !== a;
      case 'maior': return x > a;
      case 'menor': return x < a;
      case 'maiorIgual': return x >= a;
      case 'menorIgual': return x <= a;
    }
    return true;
  }
  /** true se o valor é aceito. Célula vazia é sempre aceita. */
  R.valido = function (wb, sh, vd, v, z) {
    if (!vd || vazio(v)) return true;
    const a = R.alvo(vd.v1), b = R.alvo(vd.v2);
    switch (vd.tipo) {
      case 'lista': {
        const ops = R.opcoes(wb, sh, vd);
        const t = textoDe(v, z).toLowerCase(), ts = String(v).toLowerCase();
        return ops.some(o => { const ol = String(o).toLowerCase(); if (ol === t || ol === ts) return true; const n = R.alvo(o); return typeof n === 'number' && typeof v === 'number' && Math.abs(n - v) < 1e-9; });
      }
      case 'inteiro': return typeof v === 'number' && Number.isInteger(Math.round(v * 1e9) / 1e9) && confereOp(vd.op, v, a, b);
      case 'decimal': return typeof v === 'number' && confereOp(vd.op, v, a, b);
      case 'data': return typeof v === 'number' && confereOp(vd.op, Math.floor(v), a, b);
      case 'texto': return confereOp(vd.op, String(v).length, a, b);
    }
    return true;
  };
  R.descreverVal = function (wb, sh, vd) {
    if (!vd) return '';
    if (vd.msg) return vd.msg;
    if (vd.tipo === 'lista') { const o = R.opcoes(wb, sh, vd); return 'Escolha um valor da lista: ' + o.slice(0, 12).join(', ') + (o.length > 12 ? '…' : '') + '.'; }
    const op = R.OPS.find(x => x.id === vd.op) || R.OPS[0];
    const oque = vd.tipo === 'inteiro' ? 'um número inteiro' : vd.tipo === 'decimal' ? 'um número' : vd.tipo === 'data' ? 'uma data' : 'um texto com tamanho';
    return 'Digite ' + oque + ' ' + op.nome + ' ' + vd.v1 + (op.n === 2 ? ' e ' + vd.v2 : '') + '.';
  };

  /* ======================================================================
     Comentários
     ====================================================================== */
  R.nota = (sh, r, c) => (sh.notas && sh.notas[r + ',' + c]) || null;

  /* ======================================================================
     Inserir / excluir linhas e colunas
     ====================================================================== */
  function deslocarArea(g, axis, at, n) {
    const a = axis === 'r' ? 'r1' : 'c1', b = axis === 'r' ? 'r2' : 'c2', max = axis === 'r' ? MAX_R : MAX_C;
    const o = Object.assign({}, g);
    if (o[a] === 0 && o[b] >= max - 1) return o; // coluna/linha inteira
    if (n > 0) { if (o[a] >= at) o[a] += n; if (o[b] >= at) o[b] += n; return o; }
    const d = -n, end = at + d - 1;
    if (o[a] >= at && o[b] <= end) return null;
    o[a] = o[a] > end ? o[a] - d : o[a] >= at ? at : o[a];
    o[b] = o[b] > end ? o[b] - d : o[b] >= at ? at - 1 : o[b];
    return o[b] < o[a] ? null : o;
  }
  const ajustarLista = (lista, axis, at, n) => (lista || []).map(rg => {
    const novas = R.areas(rg.range).map(g => deslocarArea(g, axis, at, n)).filter(Boolean);
    return novas.length ? Object.assign({}, rg, { range: R.rangeStr(novas) }) : null;
  }).filter(Boolean);
  /** Ajusta regras e comentários da planilha "sh" (e as fontes de listas de todas as planilhas). */
  R.deslocar = function (wb, sh, axis, at, n) {
    sh.condFormats = ajustarLista(sh.condFormats, axis, at, n);
    sh.validations = ajustarLista(sh.validations, axis, at, n);
    if (sh.notas) {
      const novo = {};
      Object.keys(sh.notas).forEach(k => {
        let [r, c] = SD.unkey(k); const p = axis === 'r' ? r : c;
        if (n < 0 && p >= at && p < at - n) return;
        if (p >= at) { if (axis === 'r') r += n; else c += n; }
        novo[r + ',' + c] = sh.notas[k];
      });
      sh.notas = novo;
    }
    wb.sheets.forEach(s2 => (s2.validations || []).forEach(vd => {
      if (!vd.fonte) return;
      const f = SD.F.adjustForInsert(vd.fonte, axis, at, n, sh.name, s2.name);
      if (f && !/#REF!/.test(f)) vd.fonte = f;
    }));
    R.invalidar();
  };
  R.renomear = function (wb, antigo, novo) {
    wb.sheets.forEach(s => (s.validations || []).forEach(vd => { if (vd.fonte) vd.fonte = SD.F.renameSheetRefs(vd.fonte, antigo, novo); }));
  };

  SD.R = R;
})();
