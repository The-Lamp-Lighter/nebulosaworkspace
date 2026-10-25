/* ==========================================================================
   Stardust — js/app.js
   A interface: menus, barra de ferramentas, barra de fórmulas, painel
   lateral (funções e gráficos), abas das planilhas, janelas, desfazer,
   salvar/abrir e todas as ações sobre as células.
   ========================================================================== */
(function () {
  'use strict';
  const SD = window.SD, G = SD.grid, V = G.V;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const NS = window.NebulosaSkin || null;
  const VERSAO = '1.0';

  /* ---------- ícones ---------- */
  const P = {
    desfazer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
    refazer: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>',
    abrir: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v1"/><path d="M3 7v11a2 2 0 002 2h13l3-8H7l-3 8"/>',
    salvar: '<path d="M5 3h11l5 5v11a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
    paleta: '<path d="M12 3a9 9 0 100 18c1.4 0 2-1 1.6-2.2-.4-1.2.3-2.3 1.6-2.3H17a4 4 0 004-4c0-5-4-9.5-9-9.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    balde: '<path d="M5 12l7-7 7 7-7 7z"/><path d="M5 12h14"/><path d="M20 15s2 2.5 2 3.5a2 2 0 01-4 0c0-1 2-3.5 2-3.5z"/>',
    bordas: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16" stroke-dasharray="2 2"/>',
    alEsq: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', alCen: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>', alDir: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
    alTopo: '<path d="M4 4h16M12 8v12M8 12l4-4 4 4"/>', alMeio: '<path d="M4 12h16M12 3v5M12 16v5M9 6l3 2 3-2M9 18l3-2 3 2"/>', alBase: '<path d="M4 20h16M12 4v12M8 12l4 4 4-4"/>',
    quebra: '<path d="M4 6h16M4 12h13a3 3 0 010 6h-4"/><path d="M15 16l-2 2 2 2M4 18h6"/>',
    mesclar: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M8 12h8M8 12l2-2M8 12l2 2M16 12l-2-2M16 12l-2 2"/>',
    decMais: '<path d="M3 17h.01M7 7v10M11 9a2 2 0 014 0v6a2 2 0 01-4 0zM19 13h4M21 11v4"/>', decMenos: '<path d="M3 17h.01M7 7v10M11 9a2 2 0 014 0v6a2 2 0 01-4 0zM19 13h4"/>',
    ordemAZ: '<path d="M4 15l3 4 3-4M7 5v14"/><path d="M14 5h5l-5 6h5M14 14l2.5 5 2.5-5M14.8 17.5h3.4"/>', ordemZA: '<path d="M4 15l3 4 3-4M7 5v14"/><path d="M14 14h5l-5 6h5M14 4l2.5 5 2.5-5M14.8 7.5h3.4"/>',
    filtro: '<path d="M4 5h16l-6 8v5l-4 2v-7z"/>',
    grafico: '<path d="M4 20V4M4 20h16"/><rect x="7" y="11" width="3" height="6" rx=".8"/><rect x="12" y="7" width="3" height="10" rx=".8"/><rect x="17" y="13" width="3" height="4" rx=".8"/>',
    painel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    mais: '<path d="M12 5v14M5 12h14"/>', menos: '<path d="M5 12h14"/>', fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
    seta: '<path d="M7 10l5 5 5-5"/>', lupa: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    linhaIns: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 12h18M12 9v6M9 12h6" />',
    lixo: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
    recortar: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8 16L18 4M16 16L6 4"/>', colar: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 9h6M9 13h6M9 17h4"/>',
    imagem: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    congelar: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 9h18M9 3v18"/>', ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"/>',
    manual: '<path d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5A2.5 2.5 0 004 21.5z"/><path d="M4 19.5V4.5M8 7h8M8 11h6"/>',
    teclado: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    pdf: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 15h6M9 11h3"/>', imprimir: '<path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
    novo: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>', modelo: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    localizar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6"/>', grade: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>', borracha: '<path d="M20 20H9l-5-5 10-10 7 7-7 7"/><path d="M8 11l6 6"/>',
    comentario: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>', // [Nebulosa]
    condicional: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18"/><rect x="5" y="11.5" width="9" height="2" rx=".6" fill="currentColor"/><rect x="5" y="16.5" width="5" height="2" rx=".6" fill="currentColor"/>',
    validacao: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M14 10l2.5 2.5L14 15M7 12h5"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    ocultar: '<path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10 10 0 0112 5c5 0 9 5 9 7a11 11 0 01-2.2 3.2M6.6 6.6C4.3 8 3 10.3 3 12c0 2 4 7 9 7a9.6 9.6 0 004.2-1"/>'
  };
  const ic = (n, cls) => `<svg class="i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
  const TIPO_IC = {
    colunas: '<svg viewBox="0 0 24 24" class="i"><path d="M4 20h16"/><rect x="6" y="10" width="3" height="10"/><rect x="11" y="5" width="3" height="15"/><rect x="16" y="13" width="3" height="7"/></svg>',
    barras: '<svg viewBox="0 0 24 24" class="i"><path d="M4 4v16"/><rect x="4" y="6" width="10" height="3"/><rect x="4" y="11" width="15" height="3"/><rect x="4" y="16" width="7" height="3"/></svg>',
    linhas: '<svg viewBox="0 0 24 24" class="i"><path d="M4 20h16"/><path d="M4 16l5-6 4 4 7-8"/></svg>',
    area: '<svg viewBox="0 0 24 24" class="i"><path d="M4 20h16"/><path d="M4 18l5-7 4 3 7-7v11H4z" fill="currentColor" fill-opacity=".3"/></svg>',
    pizza: '<svg viewBox="0 0 24 24" class="i"><circle cx="12" cy="12" r="8"/><path d="M12 4v8l6 5"/></svg>',
    rosca: '<svg viewBox="0 0 24 24" class="i"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 4v4.5M15 14.5l4.5 3"/></svg>',
    dispersao: '<svg viewBox="0 0 24 24" class="i"><path d="M4 4v16h16"/><circle cx="8" cy="14" r="1.2" fill="currentColor"/><circle cx="11" cy="10" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="7" r="1.2" fill="currentColor"/></svg>'
  };

  /* ---------- estado ---------- */
  let wb = SD.newWorkbook();
  let sujo = false, salvoEm = null, fileHandle = null, recuperado = false;
  const sheet = () => wb.sheets[V.si];

  /* ======================================================================
     Desfazer / refazer
     ====================================================================== */
  const U = {
    pilha: [], volta: [], tx: null,
    inicio(rotulo) { if (this.tx) { this.tx.prof++; return; } this.tx = { rotulo, prof: 0, cells: new Map(), sheets: new Map(), charts: new Map(), wb: null, sel: { si: V.si, sel: Object.assign({}, V.sel), act: Object.assign({}, V.act) } }; },
    celula(si, k) { if (!this.tx || this.tx.wb) return; const s = wb.sheets[si]; const id = s.id + '|' + k; if (this.tx.sheets.has(s.id) || this.tx.cells.has(id)) return; this.tx.cells.set(id, { sid: s.id, k, antes: SD.cloneCell(s.cells.get(k)) }); },
    planilha(si) { if (!this.tx || this.tx.wb) return; const s = wb.sheets[si]; if (!this.tx.sheets.has(s.id)) this.tx.sheets.set(s.id, SD.sheetToJSON(s)); },
    graficos(si) { if (!this.tx || this.tx.wb) return; const s = wb.sheets[si]; if (!this.tx.sheets.has(s.id) && !this.tx.charts.has(s.id)) this.tx.charts.set(s.id, JSON.parse(JSON.stringify(s.charts))); },
    pasta() { if (!this.tx) return; if (!this.tx.wb) this.tx.wb = SD.wbToJSON(wb); },
    fim(sem) {
      if (!this.tx) return;
      if (this.tx.prof > 0) { this.tx.prof--; return; }
      const tx = this.tx; this.tx = null;
      const vazio = !tx.wb && !tx.cells.size && !tx.sheets.size && !tx.charts.size;
      if (!vazio && !sem) { this.pilha.push(tx); if (this.pilha.length > 200) this.pilha.shift(); this.volta = []; marcarSujo(); }
      atualizar();
    },
    cancelar() { this.tx = null; },
    aplicar(tx) {
      // troca o estado atual pelo guardado (e guarda o atual para o caminho inverso)
      const inv = { rotulo: tx.rotulo, cells: new Map(), sheets: new Map(), charts: new Map(), wb: null, sel: { si: V.si, sel: Object.assign({}, V.sel), act: Object.assign({}, V.act) } };
      if (tx.wb) {
        inv.wb = SD.wbToJSON(wb);
        const nw = SD.wbFromJSON(tx.wb); nw.name = wb.name; nw.format = wb.format;
        wb = nw; G.setWorkbook(wb, true); renderAbas();
      } else {
        const byId = id => wb.sheets.find(s => s.id === id);
        tx.sheets.forEach((json, id) => { const s = byId(id); if (!s) return; inv.sheets.set(id, SD.sheetToJSON(s)); const n = SD.sheetFromJSON(json); n.id = id; Object.keys(n).forEach(k => { s[k] = n[k]; }); s.charts.forEach(c => { c.sheetId = id; }); });
        tx.charts.forEach((charts, id) => { const s = byId(id); if (!s) return; inv.charts.set(id, JSON.parse(JSON.stringify(s.charts))); s.charts = JSON.parse(JSON.stringify(charts)); });
        tx.cells.forEach((it, idk) => { const s = byId(it.sid); if (!s) return; inv.cells.set(idk, { sid: it.sid, k: it.k, antes: SD.cloneCell(s.cells.get(it.k)) }); if (it.antes) s.cells.set(it.k, SD.cloneCell(it.antes)); else s.cells.delete(it.k); });
      }
      const sel = tx.sel;
      if (sel && sel.si < wb.sheets.length) {
        if (sel.si !== V.si) { G.setSheet(sel.si); renderAbas(); }
        V.sel = sel.sel; V.act = sel.act; V.anchor = Object.assign({}, sel.act);
      }
      G.rebuildAxes(); G.syncCharts();
      return inv;
    },
    desfazer() { if (G.editando()) return; const tx = this.pilha.pop(); if (!tx) { toast('Nada para desfazer.'); return; } this.volta.push(this.aplicar(tx)); marcarSujo(); atualizar(); toast('Desfeito: ' + tx.rotulo); },
    refazer() { if (G.editando()) return; const tx = this.volta.pop(); if (!tx) { toast('Nada para refazer.'); return; } this.pilha.push(this.aplicar(tx)); marcarSujo(); atualizar(); toast('Refeito: ' + tx.rotulo); },
    limpar() { this.pilha = []; this.volta = []; this.tx = null; }
  };

  /* ---------- acesso às células com registro para desfazer ---------- */
  function setCell(si, r, c, cell) {
    const s = wb.sheets[si], k = r + ',' + c;
    U.celula(si, k);
    if (!cell || (cell.v === null || cell.v === undefined) && !cell.f && (!cell.s || !Object.keys(cell.s).length)) s.cells.delete(k);
    else { if (cell.s && !Object.keys(cell.s).length) delete cell.s; s.cells.set(k, cell); }
  }
  const getCell = (si, r, c) => wb.sheets[si].cells.get(r + ',' + c);

  /* ======================================================================
     Atualização geral
     ====================================================================== */
  let circularAvisado = false;
  function atualizar() {
    const res = SD.F.recalc(wb);
    if (SD.R) SD.R.invalidar(); // [Nebulosa] formatação condicional recalculada
    G.refresh(true); G.syncCharts();
    onSelection();
    if (res.circular && !circularAvisado) { circularAvisado = true; toast('Atenção: há uma referência circular (uma fórmula que depende dela mesma). Ela aparece como #CIRC!.', true); }
    if (!res.circular) circularAvisado = false;
    atualizarBotoesDesfazer();
  }
  function marcarSujo() { sujo = true; estadoDoc(); agendarRecuperacao(); }
  function estadoDoc() {
    const e = $('#docEstado');
    e.textContent = sujo ? 'Alterações não salvas' : salvoEm ? 'Salvo às ' + salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : recuperado ? 'Recuperado' : 'Novo';
    e.classList.toggle('sujo', sujo);
    document.title = (sujo ? '● ' : '') + wb.name + ' — Stardust';
  }
  function atualizarBotoesDesfazer() {
    const d = $('[data-cmd="desfazer"]'), r = $('[data-cmd="refazer"]');
    if (d) { d.disabled = !U.pilha.length; d.title = U.pilha.length ? 'Desfazer: ' + U.pilha[U.pilha.length - 1].rotulo + ' (Ctrl+Z)' : 'Desfazer (Ctrl+Z)'; }
    if (r) { r.disabled = !U.volta.length; r.title = U.volta.length ? 'Refazer: ' + U.volta[U.volta.length - 1].rotulo + ' (Ctrl+Y)' : 'Refazer (Ctrl+Y)'; }
  }

  /* ======================================================================
     Entrada de dados
     ====================================================================== */
  function interpretar(txt, cellAntes) {
    const s = cellAntes && cellAntes.s ? SD.cloneStyle(cellAntes.s) : undefined;
    if (txt === '' || txt === null) return { v: null, s };
    if (txt[0] === "'") return { v: txt.slice(1), s };
    if (s && s.z === '@') return { v: txt, s };
    if (txt[0] === '=' && txt.length > 1) {
      let f = SD.F.toCanonical(txt.slice(1));
      // fecha parênteses esquecidos
      const abertos = (f.replace(/"[^"]*"/g, '').match(/\(/g) || []).length - (f.replace(/"[^"]*"/g, '').match(/\)/g) || []).length;
      if (abertos > 0) f += ')'.repeat(abertos);
      const erro = SD.F.check(f);
      if (erro) return { erro, txt };
      return { v: null, f, s };
    }
    if ((txt[0] === '+' || txt[0] === '-') && txt.length > 1 && /[A-Za-z(]/.test(txt) && !/^[+-]?[\d.,]+$/.test(txt)) {
      const f = SD.F.toCanonical(txt.replace(/^\+/, ''));
      if (!SD.F.check(f)) return { v: null, f, s };
    }
    const p = SD.parseInput(txt);
    let st = s;
    if (p.z && (!st || !st.z)) st = Object.assign({}, st || {}, { z: p.z });
    if (typeof p.v === 'string' && txt.includes('\n')) st = Object.assign({}, st || {}, { wrap: true });
    return { v: p.v, s: st };
  }
  function entrarTexto(r, c, txt, todas, semValidar) {
    const alvo = todas ? G.boundSel() : { r1: r, c1: c, r2: r, c2: c };
    const res = interpretar(txt, getCell(V.si, r, c));
    // [Nebulosa] validação de dados
    if (!res.erro && !res.f && !semValidar && SD.R) {
      const vd = SD.R.validacaoEm(sheet(), r, c);
      if (vd && !SD.R.valido(wb, sheet(), vd, res.v, res.s && res.s.z)) { avisoValidacao(vd, r, c, txt, todas); return; }
    }
    if (res.erro) {
      dialogo({ titulo: 'Há um problema com esta fórmula', corpo: `<p>O Stardust não entendeu a fórmula <code>${esc(txt)}</code>.</p><p style="color:var(--text-dim)">Confira os parênteses, as aspas e se os argumentos estão separados por ponto e vírgula ( ; ). Para escrever um texto que começa com “=”, comece com um apóstrofo: <code>'=texto</code>.</p>`, botoes: [{ t: 'Corrigir', pri: true, acao: () => { G.select(r, c); G.startEdit(txt, 'editar'); } }, { t: 'Guardar como texto', acao: () => entrarTexto(r, c, "'" + txt) }] });
      return;
    }
    U.inicio(todas ? 'Preencher seleção' : 'Digitar em ' + SD.addr(r, c));
    for (let rr = alvo.r1; rr <= alvo.r2; rr++) for (let cc = alvo.c1; cc <= alvo.c2; cc++) {
      if (sheet().hiddenRows.has(rr)) continue;
      const antes = getCell(V.si, rr, cc);
      const cell = { v: res.v, s: rr === r && cc === c ? res.s : (antes && antes.s ? SD.cloneStyle(antes.s) : res.s ? SD.cloneStyle(res.s) : undefined) };
      if (res.f) cell.f = (rr === r && cc === c) ? res.f : SD.F.shiftFormula(res.f, rr - r, cc - c);
      setCell(V.si, rr, cc, cell);
    }
    U.fim();
    const cell = getCell(V.si, r, c);
    if (cell && cell.s && cell.s.wrap) autoAjustarLinhas([r], true);
  }

  /** [Nebulosa] Valor fora da validação: bloqueia ou só avisa. */
  function avisoValidacao(vd, r, c, txt, todas) {
    const desc = SD.R.descreverVal(wb, sheet(), vd);
    const reeditar = () => { G.select(r, c); G.startEdit(txt, 'editar'); };
    const botoes = vd.bloquear !== false
      ? [{ t: 'Cancelar' }].concat(vd.tipo === 'lista' ? [{ t: 'Escolher da lista', acao: () => { G.select(r, c); setTimeout(() => menuLista(r, c, G.cellRect(r, c)), 30); } }] : []).concat([{ t: 'Tentar de novo', pri: true, acao: reeditar }])
      : [{ t: 'Corrigir', acao: reeditar }, { t: 'Manter assim', pri: true, acao: () => entrarTexto(r, c, txt, todas, true) }];
    dialogo({ titulo: vd.bloquear !== false ? 'Valor não permitido' : 'Confira o valor', corpo: `<p>O valor <b>${esc(txt)}</b> não segue a regra de ${esc(SD.addr(r, c))}.</p><p style="color:var(--text-dim)">${esc(desc)}</p>`, botoes });
  }
  /** [Nebulosa] Lista suspensa da validação de dados. */
  function menuLista(r, c, rect) {
    const vd = SD.R.validacaoEm(sheet(), r, c); if (!vd) return;
    const ops = SD.R.opcoes(wb, sheet(), vd);
    const hr = G.host.getBoundingClientRect();
    if (!ops.length) { toast('A lista desta célula está vazia. Confira em Dados › Validação de dados.'); return; }
    const atual = getCell(V.si, r, c), tAtual = atual ? SD.formatValue(atual.f ? atual.val : atual.v, atual.s && atual.s.z).t : '';
    const itens = ops.map(o => ({ t: o, i: o === tAtual ? 'ok' : '', a: () => entrarTexto(r, c, /^[=+\-']/.test(o) ? "'" + o : o, false, true) }));
    if (atual && (atual.v !== null || atual.f)) itens.push('-', { t: 'Limpar a célula', i: 'borracha', a: () => { G.select(r, c); limparConteudo(); } });
    menuItens(itens, hr.left + rect.x, hr.top + rect.y + rect.h + 2);
    $('#menupop').classList.add('listaval');
    const fecharClasse = new MutationObserver(() => { if ($('#menupop').hidden) { $('#menupop').classList.remove('listaval'); fecharClasse.disconnect(); } });
    fecharClasse.observe($('#menupop'), { attributes: true, attributeFilter: ['hidden'] });
  }

  /* ======================================================================
     Estilos
     ====================================================================== */
  function forEachSel(fn, g) {
    g = g || G.boundSel();
    for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) fn(r, c);
  }
  function aplicarEstilo(patch, rotulo) {
    U.inicio(rotulo || 'Formatar');
    forEachSel((r, c) => {
      const old = getCell(V.si, r, c);
      const cell = old ? SD.cloneCell(old) : { v: null };
      const s = Object.assign({}, cell.s || {});
      const p = typeof patch === 'function' ? patch(s, cell, r, c) : patch;
      if (p) Object.keys(p).forEach(k => { if (p[k] === undefined || p[k] === null || p[k] === false && ['b', 'i', 'u', 'st', 'wrap'].includes(k)) delete s[k]; else s[k] = p[k]; });
      cell.s = s; delete cell.val;
      setCell(V.si, r, c, cell);
    });
    U.fim();
  }
  const estiloAtivo = () => { const c = getCell(V.si, V.act.r, V.act.c); return (c && c.s) || {}; };
  function alternar(k, rotulo) { const on = !estiloAtivo()[k]; aplicarEstilo({ [k]: on || undefined }, rotulo); }

  const FORMATOS_NUM = [
    { id: 'geral', nome: 'Geral', z: undefined, ex: '1234,5' },
    { id: 'numero', nome: 'Número', z: '#,##0.00', ex: '1.234,50' },
    { id: 'moeda', nome: 'Moeda (R$)', z: '"R$" #,##0.00;[Red]-"R$" #,##0.00', ex: 'R$ 1.234,50' },
    { id: 'porcentagem', nome: 'Porcentagem', z: '0.00%', ex: '12,50%' },
    { id: 'data', nome: 'Data', z: 'dd/mm/yyyy', ex: '25/10/2026' },
    { id: 'datalonga', nome: 'Data por extenso', z: 'dddd, d" de "mmmm" de "yyyy', ex: 'domingo, 25 de outubro de 2026' },
    { id: 'hora', nome: 'Hora', z: 'hh:mm:ss', ex: '14:30:00' },
    { id: 'texto', nome: 'Texto', z: '@', ex: '00123' },
    { id: 'cientifico', nome: 'Científico', z: '0.00E+00', ex: '1,23E+03' }
  ];
  function formatoAtualId(z) {
    if (!z) return 'geral';
    const f = FORMATOS_NUM.find(x => x.z === z); if (f) return f.id;
    if (/R\$/.test(z)) return 'moeda'; if (/%/.test(z)) return 'porcentagem'; if (SD.isDateFormat(z)) return /h/i.test(z) && !/[dy]/i.test(z) ? 'hora' : 'data';
    if (/E\+/.test(z)) return 'cientifico'; if (z === '@') return 'texto'; return 'numero';
  }
  function casasDecimais(delta) {
    const c = getCell(V.si, V.act.r, V.act.c);
    aplicarEstilo(s => {
      let z = s.z;
      if (!z || /general/i.test(z)) {
        const v = c ? (c.f ? c.val : c.v) : null;
        const d = typeof v === 'number' ? (SD.fmtGeneral(v).split(',')[1] || '').length : 0;
        const n = Math.max(0, d + delta);
        return { z: n ? '0.' + '0'.repeat(n) : '0' };
      }
      if (SD.isDateFormat(z)) return {};
      return {
        z: z.split(';').map(sec => {
          return sec.replace(/(0|#)(\.0*)?(?=[^0#.]*$|%|E|\s|"|\]|_|\)|$)/, (m, a, dec) => {
            const n = Math.max(0, (dec ? dec.length - 1 : 0) + delta);
            return a + (n ? '.' + '0'.repeat(n) : '');
          });
        }).join(';')
      };
    }, delta > 0 ? 'Aumentar casas decimais' : 'Diminuir casas decimais');
  }
  function bordas(tipo) {
    const g = G.boundSel();
    U.inicio('Bordas');
    forEachSel((r, c) => {
      const old = getCell(V.si, r, c);
      const cell = old ? SD.cloneCell(old) : { v: null };
      const s = Object.assign({}, cell.s || {});
      let bd = Object.assign({}, s.bd || {});
      const top = r === g.r1, bot = r === g.r2, lef = c === g.c1, rig = c === g.c2;
      switch (tipo) {
        case 'todas': bd = { t: 'thin', b: 'thin', l: 'thin', r: 'thin' }; break;
        case 'externas': if (top) bd.t = 'thin'; if (bot) bd.b = 'thin'; if (lef) bd.l = 'thin'; if (rig) bd.r = 'thin'; break;
        case 'espessa': if (top) bd.t = 'medium'; if (bot) bd.b = 'medium'; if (lef) bd.l = 'medium'; if (rig) bd.r = 'medium'; break;
        case 'inferior': if (bot) bd.b = 'thin'; break;
        case 'inferiorDupla': if (bot) bd.b = 'thick'; break;
        case 'superior': if (top) bd.t = 'thin'; break;
        case 'esquerda': if (lef) bd.l = 'thin'; break;
        case 'direita': if (rig) bd.r = 'thin'; break;
        case 'nenhuma': bd = {}; break;
      }
      if (bordaCor && Object.keys(bd).length) bd.c = bordaCor; else delete bd.c;
      if (Object.keys(bd).filter(k => k !== 'c').length) s.bd = bd; else delete s.bd;
      cell.s = s; setCell(V.si, r, c, cell);
    }, g);
    U.fim();
  }
  let bordaCor = null;
  function mesclar() {
    const g = G.boundSel(), sh = sheet();
    const m0 = G.mergeAt(g.r1, g.c1);
    if (m0 && m0.r1 === g.r1 && m0.c1 === g.c1 && m0.r2 === g.r2 && m0.c2 === g.c2) {
      U.inicio('Desfazer mesclagem'); U.planilha(V.si); sh.merges = sh.merges.filter(m => m !== m0); U.fim(); return;
    }
    if (g.r1 === g.r2 && g.c1 === g.c2) { toast('Selecione duas ou mais células para mesclar.'); return; }
    let cheias = 0; forEachSel((r, c) => { const cl = getCell(V.si, r, c); if (cl && (cl.f || (cl.v !== null && cl.v !== ''))) cheias++; }, g);
    const fazer = () => {
      U.inicio('Mesclar e centralizar'); U.planilha(V.si);
      sh.merges = sh.merges.filter(m => m.r2 < g.r1 || m.r1 > g.r2 || m.c2 < g.c1 || m.c1 > g.c2);
      forEachSel((r, c) => { if (r === g.r1 && c === g.c1) return; const cl = getCell(V.si, r, c); if (cl) { const n = SD.cloneCell(cl); n.v = null; delete n.f; setCell(V.si, r, c, n); } }, g);
      sh.merges.push({ r1: g.r1, c1: g.c1, r2: g.r2, c2: g.c2 });
      const tl = getCell(V.si, g.r1, g.c1); const n = tl ? SD.cloneCell(tl) : { v: null }; n.s = Object.assign({}, n.s || {}, { ha: 'center', va: n.s && n.s.va || 'middle' }); setCell(V.si, g.r1, g.c1, n);
      U.fim(); G.setSelection(g, { r: g.r1, c: g.c1 });
    };
    if (cheias > 1) confirmar('Mesclar células', 'Ao mesclar, só fica o valor da célula do canto superior esquerdo. Os outros valores serão apagados.', 'Mesclar', fazer);
    else fazer();
  }

  /* ======================================================================
     Limpar, linhas e colunas
     ====================================================================== */
  function limparConteudo() {
    if (V.chartSel) { excluirGrafico(V.chartSel); return; }
    U.inicio('Limpar conteúdo');
    const sh = sheet(), g = V.sel;
    sh.cells.forEach((cell, k) => { const [r, c] = SD.unkey(k); if (!SD.inRange(g, r, c)) return; if (cell.v === null && !cell.f) return; const n = SD.cloneCell(cell); n.v = null; delete n.f; delete n.val; setCell(V.si, r, c, n); });
    U.fim();
  }
  function limparFormatacao() {
    U.inicio('Limpar formatação'); U.planilha(V.si);
    const sh = sheet(), g = V.sel;
    sh.cells.forEach((cell, k) => { const [r, c] = SD.unkey(k); if (!SD.inRange(g, r, c) || !cell.s) return; const n = SD.cloneCell(cell); delete n.s; setCell(V.si, r, c, n); });
    sh.merges = sh.merges.filter(m => !(m.r1 >= g.r1 && m.r2 <= g.r2 && m.c1 >= g.c1 && m.c2 <= g.c2));
    if (SD.R) sh.condFormats = SD.R.recortar(sh.condFormats, g); // [Nebulosa] como no Excel, sai também a formatação condicional
    U.fim();
  }
  function limparTudo() { U.inicio('Limpar tudo'); limparConteudo(); limparFormatacao(); excluirComentarios(true); U.fim(); }

  function deslocar(axis, at, n) {
    // n > 0 insere, n < 0 exclui (a partir de "at")
    const sh = sheet(), nome = sh.name;
    U.inicio(n > 0 ? (axis === 'r' ? 'Inserir linhas' : 'Inserir colunas') : (axis === 'r' ? 'Excluir linhas' : 'Excluir colunas'));
    U.pasta();
    const novo = new Map();
    sh.cells.forEach((cell, k) => {
      let [r, c] = SD.unkey(k);
      const p = axis === 'r' ? r : c;
      if (n < 0 && p >= at && p < at - n) return;
      if (p >= at) { if (axis === 'r') r += n; else c += n; }
      novo.set(r + ',' + c, cell);
    });
    sh.cells = novo;
    const mapIdx = obj => { const o = {}; Object.keys(obj).forEach(k => { const i = +k; if (n < 0 && i >= at && i < at - n) return; o[i >= at ? i + n : i] = obj[k]; }); return o; };
    if (axis === 'r') { sh.rowH = mapIdx(sh.rowH); sh.hiddenRows = new Set([...sh.hiddenRows].filter(i => !(n < 0 && i >= at && i < at - n)).map(i => i >= at ? i + n : i)); }
    else sh.colW = mapIdx(sh.colW);
    // mescladas
    sh.merges = sh.merges.map(m => {
      const a = axis === 'r' ? 'r1' : 'c1', b = axis === 'r' ? 'r2' : 'c2', o = Object.assign({}, m);
      if (n > 0) { if (o[a] >= at) o[a] += n; if (o[b] >= at) o[b] += n; }
      else { const d = -n, end = at + d - 1; if (o[a] >= at && o[b] <= end) return null; o[a] = o[a] > end ? o[a] - d : o[a] >= at ? at : o[a]; o[b] = o[b] > end ? o[b] - d : o[b] >= at ? at - 1 : o[b]; if (o[b] < o[a]) return null; }
      return (o.r1 === o.r2 && o.c1 === o.c2) ? null : o;
    }).filter(Boolean);
    // fórmulas de todas as planilhas
    wb.sheets.forEach(s2 => s2.cells.forEach(cell => { if (cell.f) cell.f = SD.F.adjustForInsert(cell.f, axis, at, n, nome, s2.name); }));
    // intervalos dos gráficos e do filtro
    const ajIntervalo = rg => { const f = SD.F.adjustForInsert(rg, axis, at, n, nome, nome); return /#REF!/.test(f) ? null : f; };
    wb.sheets.forEach(s2 => s2.charts.forEach(ch => { if (s2 === sh && ch.range) { const nr = ajIntervalo(ch.range); if (nr) ch.range = nr; } }));
    if (sh.filter && sh.filter.range) { const nr = ajIntervalo(sh.filter.range); if (nr) sh.filter.range = nr; else sh.filter = null; }
    if (SD.R) SD.R.deslocar(wb, sh, axis, at, n); // [Nebulosa] regras e comentários acompanham as células
    U.fim();
  }
  function inserirLinhas(acima) { const g = V.sel; const n = g.c1 === 0 && g.c2 >= G.MAX_C - 1 ? g.r2 - g.r1 + 1 : 1; deslocar('r', acima ? g.r1 : g.r2 + 1, n); }
  function inserirColunas(esq) { const g = V.sel; const n = g.r1 === 0 && g.r2 >= G.MAX_R - 1 ? g.c2 - g.c1 + 1 : 1; deslocar('c', esq ? g.c1 : g.c2 + 1, n); }
  function excluirLinhas() { const g = G.boundSel(); deslocar('r', g.r1, -(g.r2 - g.r1 + 1)); G.select(g.r1, V.act.c); }
  function excluirColunas() { const g = G.boundSel(); deslocar('c', g.c1, -(g.c2 - g.c1 + 1)); G.select(V.act.r, g.c1); }
  function setColWidth(list, w) { U.inicio('Largura da coluna'); U.planilha(V.si); list.forEach(c => { if (Math.abs(w - SD.DEF_W) < 1) delete sheet().colW[c]; else sheet().colW[c] = w; }); U.fim(); }
  function setRowHeight(list, h) { U.inicio('Altura da linha'); U.planilha(V.si); list.forEach(r => { if (Math.abs(h - SD.DEF_H) < 1) delete sheet().rowH[r]; else sheet().rowH[r] = h; }); U.fim(); }
  function medirTexto(cell) {
    const c2 = G.measureCtx(); c2.save(); c2.font = G.fontOf(cell.s || {}, 1);
    const t = SD.formatValue(cell.f ? cell.val : cell.v, cell.s && cell.s.z).t;
    const w = Math.max(...String(t).split('\n').map(l => c2.measureText(l).width)); c2.restore(); return w;
  }
  function autoAjustarColunas(list) {
    const sh = sheet(); U.inicio('Ajustar largura'); U.planilha(V.si);
    list.forEach(c => {
      let max = 0;
      sh.cells.forEach((cell, k) => { const [r, cc] = SD.unkey(k); if (cc !== c || sh.hiddenRows.has(r) || G.mergeAt(r, cc)) return; if (cell.s && cell.s.wrap) return; max = Math.max(max, medirTexto(cell)); });
      const w = max ? Math.ceil(max + 14) : SD.DEF_W;
      if (Math.abs(w - SD.DEF_W) < 1) delete sh.colW[c]; else sh.colW[c] = Math.max(24, w);
    });
    U.fim();
  }
  function autoAjustarLinhas(list, silencioso) {
    const sh = sheet(); U.inicio('Ajustar altura'); U.planilha(V.si);
    const c2 = G.measureCtx();
    list.forEach(r => {
      let max = SD.DEF_H;
      sh.cells.forEach((cell, k) => {
        const [rr, cc] = SD.unkey(k); if (rr !== r) return;
        const st = cell.s || {}; const fs = (st.fs || 11) * 4 / 3;
        let linhas = 1;
        if (st.wrap) { c2.save(); c2.font = G.fontOf(st, 1); const t = SD.formatValue(cell.f ? cell.val : cell.v, st.z).t; linhas = G.wrapText(c2, t, (sh.colW[cc] !== undefined ? sh.colW[cc] : SD.DEF_W) - 8).length; c2.restore(); }
        max = Math.max(max, Math.ceil(linhas * fs * 1.22 + 8));
      });
      if (Math.abs(max - SD.DEF_H) < 1) delete sh.rowH[r]; else sh.rowH[r] = max;
    });
    U.fim(silencioso);
  }
  function ocultar(axis, mostrar) {
    const g = V.sel, sh = sheet();
    U.inicio(mostrar ? 'Reexibir' : 'Ocultar'); U.planilha(V.si);
    if (axis === 'c') for (let c = g.c1; c <= Math.min(g.c2, g.c1 + 500); c++) { if (mostrar) { if (sh.colW[c] === 0) delete sh.colW[c]; } else sh.colW[c] = 0; }
    else for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 5000); r++) { if (mostrar) sh.hiddenRows.delete(r); else sh.hiddenRows.add(r); }
    if (mostrar && axis === 'c' && g.c1 === g.c2) { if (sh.colW[g.c1 - 1] === 0) delete sh.colW[g.c1 - 1]; if (sh.colW[g.c1 + 1] === 0) delete sh.colW[g.c1 + 1]; }
    if (mostrar && axis === 'r' && g.r1 === g.r2) { sh.hiddenRows.delete(g.r1 - 1); sh.hiddenRows.delete(g.r1 + 1); }
    U.fim();
  }

  /* ======================================================================
     Preencher (alça), séries e AutoSoma
     ====================================================================== */
  const LISTAS = [
    ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'],
    ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
    ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
    ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']
  ];
  function caso(modelo, t) { if (modelo === modelo.toUpperCase() && modelo !== modelo.toLowerCase()) return t.toUpperCase(); if (modelo[0] === modelo[0].toUpperCase() && modelo[0] !== modelo[0].toLowerCase()) return t[0].toUpperCase() + t.slice(1); return t; }
  function serie(fontes, k) {
    // fontes: células de origem (na ordem); k: posição a preencher (pode ser negativa)
    const n = fontes.length, mod = (a, b) => ((a % b) + b) % b;
    const src = fontes[mod(k, n)];
    if (!src) return null;
    const out = SD.cloneCell(src); delete out.val;
    const vals = fontes.map(c => c ? c.v : null);
    const isDate = c => c && c.s && SD.isDateFormat(c.s.z);
    if (src.f) { out.f = SD.F.shiftFormula(src.f, k - mod(k, n), 0); out._shift = k - mod(k, n); return out; }
    const nums = fontes.every(c => c && !c.f && typeof c.v === 'number');
    if (nums && (n >= 2 || isDate(fontes[0]))) {
      const step = n >= 2 ? (vals[n - 1] - vals[0]) / (n - 1) : 1;
      out.v = vals[0] + step * k;
      out.v = Math.round(out.v * 1e10) / 1e10;
      return out;
    }
    if (typeof src.v === 'string') {
      const low = src.v.toLowerCase();
      for (const L of LISTAS) {
        const i = L.indexOf(low);
        if (i >= 0 && fontes.every(c => c && typeof c.v === 'string' && L.includes(c.v.toLowerCase()))) {
          const i0 = L.indexOf(String(fontes[0].v).toLowerCase());
          const st = n >= 2 ? mod(L.indexOf(String(fontes[1].v).toLowerCase()) - i0, L.length) || 1 : 1;
          out.v = caso(src.v, L[mod(i0 + st * k, L.length)]);
          return out;
        }
      }
      const m = /^(.*?)(\d+)(\D*)$/.exec(src.v);
      if (m && fontes.every(c => c && typeof c.v === 'string' && /\d+\D*$/.test(c.v))) {
        const m0 = /^(.*?)(\d+)(\D*)$/.exec(fontes[0].v), mL = /^(.*?)(\d+)(\D*)$/.exec(fontes[n - 1].v);
        const step = n >= 2 ? (+mL[2] - +m0[2]) / (n - 1) || 1 : 1;
        const v = +m0[2] + step * k;
        out.v = m0[1] + (v < 0 ? v : String(v).padStart(m0[2].length, '0')) + m0[3];
        return out;
      }
    }
    return out;
  }
  function preencher(orig, alvo) {
    const vert = alvo.c1 === orig.c1 && alvo.c2 === orig.c2;
    U.inicio('Preencher');
    if (vert) {
      for (let c = orig.c1; c <= orig.c2; c++) {
        const fontes = []; for (let r = orig.r1; r <= orig.r2; r++) fontes.push(getCell(V.si, r, c));
        for (let r = alvo.r1; r <= alvo.r2; r++) {
          if (r >= orig.r1 && r <= orig.r2) continue;
          const k = r - orig.r1;
          const nc = serie(fontes, k);
          if (nc && nc.f) nc.f = SD.F.shiftFormula(fontes[((k % fontes.length) + fontes.length) % fontes.length].f, r - (orig.r1 + ((k % fontes.length) + fontes.length) % fontes.length), 0);
          if (nc) delete nc._shift;
          setCell(V.si, r, c, nc);
        }
      }
    } else {
      for (let r = orig.r1; r <= orig.r2; r++) {
        const fontes = []; for (let c = orig.c1; c <= orig.c2; c++) fontes.push(getCell(V.si, r, c));
        for (let c = alvo.c1; c <= alvo.c2; c++) {
          if (c >= orig.c1 && c <= orig.c2) continue;
          const k = c - orig.c1, n = fontes.length, i = ((k % n) + n) % n;
          const nc = serie(fontes, k);
          if (nc && fontes[i] && fontes[i].f) nc.f = SD.F.shiftFormula(fontes[i].f, 0, c - (orig.c1 + i));
          if (nc) delete nc._shift;
          setCell(V.si, r, c, nc);
        }
      }
    }
    U.fim();
    G.setSelection(SD.norm({ r1: Math.min(orig.r1, alvo.r1), c1: Math.min(orig.c1, alvo.c1), r2: Math.max(orig.r2, alvo.r2), c2: Math.max(orig.c2, alvo.c2) }), V.act);
  }
  function preencherAteFim() {
    const g = V.sel, sh = sheet();
    const vizinha = [g.c1 - 1, g.c2 + 1].find(c => c >= 0 && sh.cells.get((g.r2 + 1) + ',' + c));
    if (vizinha === undefined) return;
    let r = g.r2 + 1; while (sh.cells.get((r + 1) + ',' + vizinha) && !(sh.cells.get((r + 1) + ',' + vizinha).v === null && !sh.cells.get((r + 1) + ',' + vizinha).f)) r++;
    preencher(g, { r1: g.r1, c1: g.c1, r2: r, c2: g.c2 });
  }
  function preencherDir(dir) {
    const g = G.boundSel();
    if (dir === 'baixo') { if (g.r1 === g.r2) { if (g.r1 === 0) return; preencher({ r1: g.r1 - 1, c1: g.c1, r2: g.r1 - 1, c2: g.c2 }, { r1: g.r1 - 1, c1: g.c1, r2: g.r2, c2: g.c2 }); } else { U.inicio('Preencher abaixo'); for (let c = g.c1; c <= g.c2; c++) { const src = getCell(V.si, g.r1, c); for (let r = g.r1 + 1; r <= g.r2; r++) { const n = src ? SD.cloneCell(src) : null; if (n && n.f) n.f = SD.F.shiftFormula(src.f, r - g.r1, 0); setCell(V.si, r, c, n); } } U.fim(); } }
    else { if (g.c1 === g.c2) { if (g.c1 === 0) return; preencher({ r1: g.r1, c1: g.c1 - 1, r2: g.r2, c2: g.c1 - 1 }, { r1: g.r1, c1: g.c1 - 1, r2: g.r2, c2: g.c2 }); } else { U.inicio('Preencher à direita'); for (let r = g.r1; r <= g.r2; r++) { const src = getCell(V.si, r, g.c1); for (let c = g.c1 + 1; c <= g.c2; c++) { const n = src ? SD.cloneCell(src) : null; if (n && n.f) n.f = SD.F.shiftFormula(src.f, 0, c - g.c1); setCell(V.si, r, c, n); } } U.fim(); } }
  }
  function autoSoma(fn) {
    fn = fn || 'SUM';
    const nomePt = SD.F.PT[fn] || fn;
    const g = G.boundSel(), sh = sheet();
    const isNum = (r, c) => { const cl = sh.cells.get(r + ',' + c); const v = cl ? (cl.f ? cl.val : cl.v) : null; return typeof v === 'number'; };
    if (g.r1 === g.r2 && g.c1 === g.c2) {
      const r = g.r1, c = g.c1;
      let r0 = r - 1; while (r0 >= 0 && !isNum(r0, c) && r0 > r - 3 && !sh.cells.get(r0 + ',' + c)) r0--;
      let top = r0; while (top - 1 >= 0 && isNum(top - 1, c)) top--;
      let txt;
      if (r0 >= 0 && isNum(r0, c)) txt = '=' + nomePt + '(' + SD.rangeStr({ r1: top, c1: c, r2: r0, c2: c }) + ')';
      else {
        let c0 = c - 1; let lf = c0; while (lf - 1 >= 0 && isNum(r, lf - 1)) lf--;
        txt = c0 >= 0 && isNum(r, c0) ? '=' + nomePt + '(' + SD.rangeStr({ r1: r, c1: lf, r2: r, c2: c0 }) + ')' : '=' + nomePt + '()';
      }
      G.startEdit(txt, 'editar');
      if (txt.endsWith('()')) { const ed = G.editor; ed.setSelectionRange(txt.length - 1, txt.length - 1); }
      return;
    }
    // intervalo: total embaixo de cada coluna
    U.inicio('AutoSoma');
    for (let c = g.c1; c <= g.c2; c++) {
      let last = g.r2; let alvo = g.r2 + 1;
      if (!isNum(g.r2, c) && !sh.cells.get(g.r2 + ',' + c)) { alvo = g.r2; last = g.r2 - 1; }
      if (last < g.r1) continue;
      setCell(V.si, alvo, c, { v: null, f: fn + '(' + SD.rangeStr({ r1: g.r1, c1: c, r2: last, c2: c }) + ')', s: getCell(V.si, last, c) && getCell(V.si, last, c).s ? SD.cloneStyle(getCell(V.si, last, c).s) : undefined });
    }
    U.fim();
  }

  /* ======================================================================
     Copiar e colar
     ====================================================================== */
  function colar(txt, html, modo) {
    const clip = V.clip;
    const destino = { r: V.sel.r1, c: V.sel.c1 };
    if (clip && (txt === undefined || txt === clip.texto || (txt || '').replace(/\r/g, '') === clip.texto.replace(/\r/g, ''))) {
      const H = clip.dados.length, W = H ? clip.dados[0].length : 0;
      if (!H || !W) return;
      const selH = V.sel.r2 - V.sel.r1 + 1, selW = V.sel.c2 - V.sel.c1 + 1;
      const repR = selH % H === 0 && selH > H && selH < 5000 ? selH / H : 1, repC = selW % W === 0 && selW > W && selW < 500 ? selW / W : 1;
      U.inicio(modo === 'valores' ? 'Colar valores' : modo === 'formatos' ? 'Colar formatação' : 'Colar');
      if (clip.corte && clip.si === V.si) U.planilha(V.si);
      const origem = clip.g, src = wb.sheets[clip.si];
      if (clip.corte) {
        for (let r = origem.r1; r <= origem.r2; r++) for (let c = origem.c1; c <= origem.c2; c++) setCell(clip.si, r, c, null);
        src.merges = src.merges.filter(m => !(m.r1 >= origem.r1 && m.r2 <= origem.r2 && m.c1 >= origem.c1 && m.c2 <= origem.c2));
      }
      for (let i = 0; i < repR; i++) for (let j = 0; j < repC; j++) {
        clip.dados.forEach((row, ri) => row.forEach((cell, ci) => {
          const r = destino.r + i * H + ri, c = destino.c + j * W + ci;
          const old = getCell(V.si, r, c);
          let n;
          if (modo === 'valores') { n = old ? SD.cloneCell(old) : { v: null }; delete n.f; n.v = cell ? (cell.f ? (cell.val === undefined ? null : cell.val) : cell.v) : null; if (cell && cell.s && cell.s.z) n.s = Object.assign({}, n.s || {}, { z: cell.s.z }); }
          else if (modo === 'formatos') { n = old ? SD.cloneCell(old) : { v: null }; n.s = cell && cell.s ? SD.cloneStyle(cell.s) : undefined; }
          else { n = cell ? SD.cloneCell(cell) : null; if (n && n.f && !clip.corte) n.f = SD.F.shiftFormula(n.f, r - (origem.r1 + ri), c - (origem.c1 + ci)); }
          if (n) delete n.val;
          setCell(V.si, r, c, n);
        }));
        if (!modo || modo === 'formatos') { U.planilha(V.si); clip.merges.forEach(m => sheet().merges.push({ r1: destino.r + i * H + m.r1, c1: destino.c + j * W + m.c1, r2: destino.r + i * H + m.r2, c2: destino.c + j * W + m.c2 })); }
      }
      U.fim();
      G.setSelection({ r1: destino.r, c1: destino.c, r2: destino.r + H * repR - 1, c2: destino.c + W * repC - 1 }, destino);
      if (clip.corte) V.clip = null;
      return;
    }
    // de fora (outro programa)
    let linhas = [];
    if (html && /<table/i.test(html)) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const tb = doc.querySelector('table');
      linhas = [...tb.querySelectorAll('tr')].map(tr => [...tr.querySelectorAll('td,th')].map(td => ({ t: td.innerText.replace(/ /g, ' ').replace(/\n+$/, ''), b: /bold|[6-9]00/.test(td.style.fontWeight || '') || !!td.querySelector('b,strong') || td.tagName === 'TH', bg: td.style.backgroundColor || td.getAttribute('bgcolor') || '' })));
    } else if (txt) {
      const rows = []; let row = [], cur = '', q = false;
      const t = txt.replace(/\r\n?/g, '\n').replace(/\n$/, '');
      for (let i = 0; i < t.length; i++) { const ch = t[i]; if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; } if (ch === '"' && cur === '') { q = true; continue; } if (ch === '\t') { row.push(cur); cur = ''; continue; } if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; continue; } cur += ch; }
      row.push(cur); rows.push(row);
      linhas = rows.map(r => r.map(t2 => ({ t: t2 })));
    }
    if (!linhas.length) return;
    U.inicio('Colar');
    const cssCor = c => { if (!c) return null; if (/^#/.test(c)) return c.length === 4 ? '#' + c.slice(1).split('').map(x => x + x).join('') : c; const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('') : null; };
    linhas.forEach((row, ri) => row.forEach((it, ci) => {
      const r = destino.r + ri, c = destino.c + ci;
      const res = interpretar(it.t, getCell(V.si, r, c));
      const n = res.erro ? { v: it.t } : { v: res.v, s: res.s };
      if (res.f) n.f = res.f;
      if (it.b) n.s = Object.assign({}, n.s || {}, { b: true });
      const bg = cssCor(it.bg); if (bg && !/^#(ffffff|fff)$/i.test(bg)) n.s = Object.assign({}, n.s || {}, { bg });
      setCell(V.si, r, c, n);
    }));
    U.fim();
    G.setSelection({ r1: destino.r, c1: destino.c, r2: destino.r + linhas.length - 1, c2: destino.c + Math.max(...linhas.map(l => l.length)) - 1 }, destino);
  }
  async function cmdCopiar(corte) {
    try { document.execCommand(corte ? 'cut' : 'copy'); } catch (e) { toast('Use Ctrl+C / Ctrl+X para copiar.'); }
  }
  async function cmdColar(modo) {
    if (V.clip) { colar(undefined, undefined, modo); return; }
    try { const t = await navigator.clipboard.readText(); colar(t, '', modo); }
    catch (e) { toast('O navegador não deixou ler a área de transferência por aqui. Use Ctrl+V.'); }
  }

  /* ======================================================================
     Classificar, filtrar, localizar
     ====================================================================== */
  function regiaoAtual(r, c) {
    const sh = sheet();
    const cheia = (rr, cc) => { const cl = sh.cells.get(rr + ',' + cc); return cl && (cl.f || (cl.v !== null && cl.v !== '')); };
    let g = { r1: r, c1: c, r2: r, c2: c }, mudou = true;
    if (!cheia(r, c)) {
      // procura dados vizinhos
      const viz = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].find(([a, b]) => a >= 0 && b >= 0 && cheia(a, b));
      if (!viz) return null;
      g = { r1: viz[0], c1: viz[1], r2: viz[0], c2: viz[1] };
    }
    while (mudou) {
      mudou = false;
      const lin = (rr, a, b) => { for (let cc = a; cc <= b; cc++) if (rr >= 0 && cheia(rr, cc)) return true; return false; };
      const col = (cc, a, b) => { for (let rr = a; rr <= b; rr++) if (cc >= 0 && cheia(rr, cc)) return true; return false; };
      if (g.r1 > 0 && lin(g.r1 - 1, Math.max(0, g.c1 - 1), g.c2 + 1)) { g.r1--; mudou = true; }
      if (lin(g.r2 + 1, Math.max(0, g.c1 - 1), g.c2 + 1)) { g.r2++; mudou = true; }
      if (g.c1 > 0 && col(g.c1 - 1, Math.max(0, g.r1 - 1), g.r2 + 1)) { g.c1--; mudou = true; }
      if (col(g.c2 + 1, Math.max(0, g.r1 - 1), g.r2 + 1)) { g.c2++; mudou = true; }
    }
    return g;
  }
  function temCabecalho(g) {
    const sh = sheet();
    if (g.r2 <= g.r1) return false;
    let txt1 = 0, num2 = 0, n = 0;
    for (let c = g.c1; c <= g.c2; c++) {
      const a = sh.cells.get(g.r1 + ',' + c), b = sh.cells.get((g.r1 + 1) + ',' + c);
      const va = a ? (a.f ? a.val : a.v) : null, vb = b ? (b.f ? b.val : b.v) : null;
      if (typeof va === 'string') txt1++;
      if (typeof vb === 'number' || (a && a.s && a.s.b && !(b && b.s && b.s.b))) num2++;
      n++;
    }
    return txt1 === n || (txt1 > 0 && num2 > 0);
  }
  function areaClassificar() {
    const g = V.sel;
    if (g.r1 === g.r2 && g.c1 === g.c2 || (g.r1 === 0 && g.r2 >= G.MAX_R - 1)) return regiaoAtual(V.act.r, V.act.c);
    return G.boundSel();
  }
  function ordenarArea(g, chaves, cab) {
    const sh = sheet();
    const r0 = g.r1 + (cab ? 1 : 0);
    if (r0 > g.r2) return;
    const linhas = [];
    for (let r = r0; r <= g.r2; r++) { const row = []; for (let c = g.c1; c <= g.c2; c++) row.push(sh.cells.get(r + ',' + c) || null); linhas.push({ r, row }); }
    const valor = (cell) => cell ? (cell.f ? cell.val : cell.v) : null;
    linhas.sort((a, b) => {
      for (const k of chaves) {
        const va = valor(a.row[k.c - g.c1]), vb = valor(b.row[k.c - g.c1]);
        const ea = va === null || va === '' || va === undefined, eb = vb === null || vb === '' || vb === undefined;
        if (ea || eb) { if (ea && eb) continue; return ea ? 1 : -1; }
        const d = SD.F.cmp(va, vb) * (k.desc ? -1 : 1);
        if (d) return d;
      }
      return a.r - b.r;
    });
    U.inicio('Classificar');
    linhas.forEach((ln, i) => {
      const r = r0 + i;
      ln.row.forEach((cell, j) => { const n = cell ? SD.cloneCell(cell) : null; if (n && n.f) n.f = SD.F.shiftFormula(n.f, r - ln.r, 0); if (n) delete n.val; setCell(V.si, r, g.c1 + j, n); });
    });
    U.fim();
  }
  function ordenarRapido(desc) {
    const g = areaClassificar();
    if (!g) { toast('Clique numa célula dentro da tabela que quer classificar.'); return; }
    const c = Math.min(Math.max(V.act.c, g.c1), g.c2);
    ordenarArea(g, [{ c, desc }], temCabecalho(g));
    toast('Classificado pela coluna ' + SD.colName(c) + (desc ? ' (Z → A).' : ' (A → Z).'));
  }
  function dlgClassificar() {
    const g = areaClassificar();
    if (!g) { toast('Clique numa célula dentro da tabela que quer classificar.'); return; }
    const sh = sheet();
    const cab0 = temCabecalho(g);
    const nomeCol = (c, cab) => { if (cab) { const cl = sh.cells.get(g.r1 + ',' + c); const v = cl ? SD.formatValue(cl.f ? cl.val : cl.v, cl.s && cl.s.z).t : ''; if (v) return v + ' (' + SD.colName(c) + ')'; } return 'Coluna ' + SD.colName(c); };
    const ops = cab => { let o = ''; for (let c = g.c1; c <= g.c2; c++) o += `<option value="${c}">${esc(nomeCol(c, cab))}</option>`; return o; };
    const corpo = `<p>Área: <b>${SD.rangeStr(g)}</b></p>
      <label class="chk"><input type="checkbox" id="csCab" ${cab0 ? 'checked' : ''}> Meus dados têm cabeçalho (a primeira linha fica onde está)</label>
      <div class="grade2"><div class="campo"><span>Classificar por</span><select class="in" id="csC1">${ops(cab0)}</select></div><div class="campo"><span>Ordem</span><select class="in" id="csO1"><option value="0">Crescente (A → Z, 1 → 9)</option><option value="1">Decrescente (Z → A, 9 → 1)</option></select></div>
      <div class="campo"><span>Depois por (opcional)</span><select class="in" id="csC2"><option value="">—</option>${ops(cab0)}</select></div><div class="campo"><span>Ordem</span><select class="in" id="csO2"><option value="0">Crescente</option><option value="1">Decrescente</option></select></div></div>`;
    const d = dialogo({
      titulo: 'Classificar', corpo, botoes: [{ t: 'Cancelar' }, {
        t: 'Classificar', pri: true, acao: () => {
          const chaves = [{ c: +$('#csC1').value, desc: $('#csO1').value === '1' }];
          if ($('#csC2').value !== '') chaves.push({ c: +$('#csC2').value, desc: $('#csO2').value === '1' });
          ordenarArea(g, chaves, $('#csCab').checked);
        }
      }]
    });
    $('#csC1', d).value = String(Math.min(Math.max(V.act.c, g.c1), g.c2));
    $('#csCab', d).onchange = e => { const v1 = $('#csC1').value, v2 = $('#csC2').value; $('#csC1').innerHTML = ops(e.target.checked); $('#csC2').innerHTML = '<option value="">—</option>' + ops(e.target.checked); $('#csC1').value = v1; $('#csC2').value = v2; };
  }
  function alternarFiltro() {
    const sh = sheet();
    if (sh.filter) {
      U.inicio('Tirar filtro'); U.planilha(V.si);
      const g = SD.parseRange(sh.filter.range);
      if (g) for (let r = g.r1; r <= g.r2; r++) sh.hiddenRows.delete(r);
      sh.filter = null; U.fim(); toast('Filtro removido.'); return;
    }
    const g = areaClassificar();
    if (!g) { toast('Clique numa célula da tabela que quer filtrar.'); return; }
    U.inicio('Filtro'); U.planilha(V.si);
    sh.filter = { range: SD.rangeStr(g), hidden: {} };
    U.fim(); toast('Filtro ligado: use as setinhas no cabeçalho.');
  }
  function aplicarFiltros(sh) {
    const g = SD.parseRange(sh.filter.range); if (!g) return;
    for (let r = g.r1 + 1; r <= g.r2; r++) {
      let esconder = false;
      Object.keys(sh.filter.hidden || {}).forEach(c => {
        const lista = sh.filter.hidden[c]; if (!lista || !lista.length) return;
        const cl = sh.cells.get(r + ',' + c); const t = cl ? SD.formatValue(cl.f ? cl.val : cl.v, cl.s && cl.s.z).t : '';
        if (lista.includes(t)) esconder = true;
      });
      if (esconder) sh.hiddenRows.add(r); else sh.hiddenRows.delete(r);
    }
  }
  function menuFiltro(c, rect) {
    const sh = sheet(); const g = SD.parseRange(sh.filter.range); if (!g) return;
    const valores = new Map();
    for (let r = g.r1 + 1; r <= g.r2; r++) { const cl = sh.cells.get(r + ',' + c); const t = cl ? SD.formatValue(cl.f ? cl.val : cl.v, cl.s && cl.s.z).t : ''; valores.set(t, (valores.get(t) || 0) + 1); }
    const escondidos = new Set((sh.filter.hidden || {})[c] || []);
    const lista = [...valores.keys()].sort((a, b) => a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'pt-BR', { numeric: true }));
    const host = G.host.getBoundingClientRect();
    abrirPop(`<div class="filtrobox"><button class="mi" data-f="az">${ic('ordemAZ')}Classificar de A a Z</button><button class="mi" data-f="za">${ic('ordemZA')}Classificar de Z a A</button><hr>
      <input class="in" id="fBusca" placeholder="Procurar…"><div class="lista"><label><input type="checkbox" id="fTodos" ${escondidos.size ? '' : 'checked'}> <b>(Selecionar tudo)</b></label>${lista.map(v => `<label><input type="checkbox" data-v="${esc(v)}" ${escondidos.has(v) ? '' : 'checked'}> ${v === '' ? '<i>(Vazias)</i>' : esc(v)}</label>`).join('')}</div>
      <div class="linha" style="justify-content:flex-end"><button class="bt" data-f="limpar">Limpar filtro</button><button class="bt pri" data-f="ok">OK</button></div></div>`, host.left + rect.x + rect.w - 260, host.top + rect.y + rect.h + 2);
    const pop = $('#menupop');
    $('#fTodos', pop).onchange = e => $$('input[data-v]', pop).forEach(i => { if (i.closest('label').style.display !== 'none') i.checked = e.target.checked; });
    $('#fBusca', pop).oninput = e => { const q = e.target.value.toLowerCase(); $$('input[data-v]', pop).forEach(i => { i.closest('label').style.display = i.dataset.v.toLowerCase().includes(q) ? '' : 'none'; }); };
    pop.onclick = e => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      const f = b.dataset.f;
      if (f === 'az' || f === 'za') { fecharPop(); ordenarArea(g, [{ c, desc: f === 'za' }], true); return; }
      U.inicio('Filtrar'); U.planilha(V.si);
      sh.filter.hidden = sh.filter.hidden || {};
      if (f === 'limpar') delete sh.filter.hidden[c];
      else sh.filter.hidden[c] = $$('input[data-v]', pop).filter(i => !i.checked).map(i => i.dataset.v);
      aplicarFiltros(sh); U.fim(); fecharPop();
    };
  }
  let buscaUltima = null;
  function dlgLocalizar(substituir) {
    const sel = estiloAtivo && getCell(V.si, V.act.r, V.act.c);
    const d = dialogo({
      titulo: substituir ? 'Localizar e substituir' : 'Localizar', corpo: `<div class="campo"><span>Localizar</span><input class="in" id="lqBusca" value="${esc(buscaUltima || '')}"></div>
      <div class="campo" ${substituir ? '' : 'hidden'} id="lqSubW"><span>Substituir por</span><input class="in" id="lqSub"></div>
      <div class="linha"><label class="chk"><input type="checkbox" id="lqCaixa"> Diferenciar maiúsculas</label><label class="chk"><input type="checkbox" id="lqInteira"> Célula inteira</label><label class="chk"><input type="checkbox" id="lqTodas"> Todas as planilhas</label></div><p id="lqMsg" style="color:var(--text-dim);min-height:1.2em"></p>`,
      botoes: [{ t: substituir ? 'Só localizar' : 'Substituir…', esq: true, manter: true, acao: () => { $('#lqSubW').hidden = !$('#lqSubW').hidden; } }, { t: 'Fechar' }, { t: 'Substituir tudo', manter: true, acao: () => substituirTudo() }, { t: 'Substituir', manter: true, acao: () => substituirUm() }, { t: 'Localizar próxima', pri: true, manter: true, acao: () => proxima() }]
    });
    void sel;
    const crit = () => {
      const q = $('#lqBusca', d).value; buscaUltima = q;
      const caixa = $('#lqCaixa', d).checked, inteira = $('#lqInteira', d).checked;
      const norm = s => caixa ? s : s.toLowerCase();
      return { q, ok: t => { t = String(t); return inteira ? norm(t) === norm(q) : norm(t).includes(norm(q)); }, troca: (t, n) => { if (inteira) return n; const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caixa ? 'g' : 'gi'); return t.replace(re, n); } };
    };
    const textoCel = cl => cl.f ? '=' + SD.F.toDisplay(cl.f) : SD.formatValue(cl.v, cl.s && cl.s.z).t;
    function lista() {
      const out = [], todas = $('#lqTodas', d).checked;
      wb.sheets.forEach((s, si) => { if (!todas && si !== V.si) return; s.cells.forEach((cl, k) => { const [r, c] = SD.unkey(k); out.push({ si, r, c, cl }); }); });
      out.sort((a, b) => a.si - b.si || a.r - b.r || a.c - b.c);
      return out;
    }
    function proxima() {
      const C = crit(); if (!C.q) return;
      const L = lista().filter(x => C.ok(textoCel(x.cl)) || C.ok(SD.formatValue(x.cl.f ? x.cl.val : x.cl.v, x.cl.s && x.cl.s.z).t));
      if (!L.length) { $('#lqMsg', d).textContent = 'Nada encontrado.'; return; }
      const atual = { si: V.si, r: V.act.r, c: V.act.c };
      const nx = L.find(x => x.si > atual.si || (x.si === atual.si && (x.r > atual.r || (x.r === atual.r && x.c > atual.c)))) || L[0];
      if (nx.si !== V.si) { G.setSheet(nx.si); renderAbas(); }
      G.select(nx.r, nx.c);
      $('#lqMsg', d).textContent = L.length + ' célula(s) encontrada(s).';
    }
    function substituirUm() {
      const C = crit(); const cl = getCell(V.si, V.act.r, V.act.c);
      if (cl && C.ok(textoCel(cl))) { const t = C.troca(textoCel(cl), $('#lqSub', d).value); entrarTexto(V.act.r, V.act.c, t); }
      proxima();
    }
    function substituirTudo() {
      const C = crit(); if (!C.q) return; let n = 0;
      U.inicio('Substituir tudo');
      lista().forEach(x => { const t = textoCel(x.cl); if (!C.ok(t)) return; const nt = C.troca(t, $('#lqSub', d).value); const res = interpretar(nt, x.cl); if (res.erro) return; const c = { v: res.v, s: res.s }; if (res.f) c.f = res.f; setCell(x.si, x.r, x.c, c); n++; });
      U.fim();
      $('#lqMsg', d).textContent = n ? n + ' substituição(ões) feita(s).' : 'Nada encontrado.';
    }
    $('#lqBusca', d).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); proxima(); } });
    setTimeout(() => { $('#lqBusca', d).focus(); $('#lqBusca', d).select(); }, 30);
  }

  /* ======================================================================
     Congelar, grade, zoom, planilhas
     ====================================================================== */
  function congelar(tipo) {
    U.inicio('Congelar painéis'); U.planilha(V.si);
    const sh = sheet();
    sh.freeze = tipo === 'linha' ? { r: 1, c: 0 } : tipo === 'coluna' ? { r: 0, c: 1 } : tipo === 'celula' ? { r: V.act.r, c: V.act.c } : { r: 0, c: 0 };
    U.fim();
  }
  function alternarGrade() { U.inicio('Linhas de grade'); U.planilha(V.si); sheet().showGrid = sheet().showGrid === false; U.fim(); }
  function setZoom(z) { z = Math.max(0.5, Math.min(2.5, Math.round(z * 100) / 100)); G.setZoom(z); }
  function onZoom(z) { $('#zoom').value = Math.round(z * 100); $('#zoomTxt').textContent = Math.round(z * 100) + '%'; }

  const CORES_ABA = [];
  function renderAbas() {
    $('#abas').innerHTML = wb.sheets.map((s, i) => s.hidden ? '' : `<button class="aba" role="tab" draggable="true" data-i="${i}" aria-selected="${i === V.si}" title="${esc(s.name)} — clique duas vezes para renomear">${esc(s.name)}</button>`).join('');
    void CORES_ABA;
  }
  function irPlanilha(i) { if (i === V.si || i < 0 || i >= wb.sheets.length) return; G.setSheet(i); renderAbas(); onSelection(); }
  function novaPlanilha() {
    U.inicio('Nova planilha'); U.pasta();
    const s = SD.newSheet(SD.uniqueSheetName(wb, 'Planilha' + (wb.sheets.length + 1)));
    wb.sheets.splice(V.si + 1, 0, s);
    U.fim();
    irPlanilha(V.si + 1);
    renderAbas();
  }
  function renomearPlanilha(i) {
    i = i === undefined ? V.si : i;
    const btn = $(`.aba[data-i="${i}"]`); if (!btn) return;
    const antigo = wb.sheets[i].name;
    btn.innerHTML = `<input value="${esc(antigo)}" maxlength="31">`;
    const inp = btn.querySelector('input'); inp.focus(); inp.select();
    let feito = false;
    const fim = ok => {
      if (feito) return; feito = true;
      const novo = inp.value.trim().replace(/[\\/?*[\]:]/g, '');
      if (ok && novo && novo !== antigo) {
        if (wb.sheets.some((s, k) => k !== i && s.name.toLowerCase() === novo.toLowerCase())) { toast('Já existe uma planilha com esse nome.', true); }
        else {
          U.inicio('Renomear planilha'); U.pasta();
          wb.sheets[i].name = novo;
          wb.sheets.forEach(s => s.cells.forEach(c => { if (c.f) c.f = SD.F.renameSheetRefs(c.f, antigo, novo); }));
          if (SD.R) SD.R.renomear(wb, antigo, novo); // [Nebulosa] listas de validação que apontam para esta planilha
          U.fim();
        }
      }
      renderAbas(); G.focus();
    };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') fim(true); if (e.key === 'Escape') fim(false); });
    inp.addEventListener('blur', () => fim(true));
    inp.addEventListener('click', e => e.stopPropagation());
  }
  function excluirPlanilha(i) {
    i = i === undefined ? V.si : i;
    if (wb.sheets.filter(s => !s.hidden).length <= 1) { toast('A pasta precisa ter pelo menos uma planilha.'); return; }
    const s = wb.sheets[i];
    const fazer = () => { U.inicio('Excluir planilha'); U.pasta(); wb.sheets.splice(i, 1); wb.active = Math.min(i, wb.sheets.length - 1); U.fim(); G.setWorkbook(wb, false); G.setSheet(wb.active); renderAbas(); atualizar(); };
    if (s.cells.size || s.charts.length) confirmar('Excluir planilha', `Excluir “${s.name}” e tudo o que há nela? Dá para desfazer com Ctrl+Z.`, 'Excluir', fazer, true); else fazer();
  }
  function duplicarPlanilha(i) {
    i = i === undefined ? V.si : i;
    U.inicio('Duplicar planilha'); U.pasta();
    const copia = SD.sheetFromJSON(JSON.parse(JSON.stringify(SD.sheetToJSON(wb.sheets[i]))));
    copia.name = SD.uniqueSheetName(wb, wb.sheets[i].name.slice(0, 26) + ' (2)');
    copia.charts.forEach(c => { c.id = 'g' + Math.random().toString(36).slice(2, 9); c.sheetId = copia.id; });
    wb.sheets.splice(i + 1, 0, copia);
    U.fim(); irPlanilha(i + 1); renderAbas();
  }
  function moverPlanilha(de, para) {
    if (de === para || para < 0 || para >= wb.sheets.length) return;
    U.inicio('Mover planilha'); U.pasta();
    const [s] = wb.sheets.splice(de, 1); wb.sheets.splice(para, 0, s);
    U.fim(); G.setWorkbook(wb, true); V.si = para; wb.active = para; G.setSheet(para); renderAbas();
  }

  /* ======================================================================
     Gráficos
     ====================================================================== */
  function inserirGrafico(tipo) {
    let g = G.boundSel();
    if (g.r1 === g.r2 && g.c1 === g.c2) g = regiaoAtual(V.act.r, V.act.c);
    if (!g) { toast('Selecione os dados do gráfico (com os títulos) e tente de novo.'); return; }
    const sh = sheet();
    let temNum = false; for (let r = g.r1; r <= g.r2 && !temNum; r++) for (let c = g.c1; c <= g.c2; c++) { const cl = sh.cells.get(r + ',' + c); if (cl && typeof (cl.f ? cl.val : cl.v) === 'number') { temNum = true; break; } }
    if (!temNum) { toast('Não há números na seleção para fazer o gráfico.', true); return; }
    let x = 0; for (let c = 0; c <= g.c2; c++) x += SD.IO.colPx(sh, c);
    let y = 0; for (let r = 0; r < g.r1; r++) y += sh.hiddenRows.has(r) ? 0 : SD.IO.rowPx(sh, r);
    const ch = { id: 'g' + Math.random().toString(36).slice(2, 9), sheetId: sh.id, tipo: tipo || 'colunas', range: SD.rangeStr(g), x: x + 24, y: y, w: 520, h: 320, titulo: '' };
    // título automático: cabeçalho da primeira série, se houver uma só
    const D = SD.G.dados(wb, ch);
    if (D.series.length === 1 && !/^Série/.test(D.series[0].name)) ch.titulo = D.series[0].name;
    U.inicio('Inserir gráfico'); U.graficos(V.si); sh.charts.push(ch); U.fim();
    G.selectChart(ch.id); abrirPainel('grafico');
    G.scrollIntoView(g.r1, g.c2 + 1);
  }
  function grafico(id) { for (const s of wb.sheets) { const c = s.charts.find(x => x.id === id); if (c) return c; } return null; }
  function alterarGrafico(id, patch, rotulo) {
    const ch = grafico(id); if (!ch) return;
    U.inicio(rotulo || 'Editar gráfico'); U.graficos(V.si); Object.assign(ch, patch); Object.keys(patch).forEach(k => patch[k] === undefined && delete ch[k]); U.fim();
    if (painelAba === 'grafico') renderPainel();
  }
  function excluirGrafico(id) { U.inicio('Excluir gráfico'); U.graficos(V.si); sheet().charts = sheet().charts.filter(c => c.id !== id); U.fim(); G.selectChart(null); renderPainel(); }
  function baixarGraficoPng(id) {
    const ch = grafico(id); if (!ch) return;
    const cv = SD.G.imagem(wb, ch, ch.w, ch.h, 2, SD.temaGraficoImpressao());
    cv.toBlob(b => baixar(b, (ch.titulo || 'grafico').replace(/[\\/:*?"<>|]+/g, '_') + '.png'), 'image/png');
  }
  let gAntes = null;
  function antesGrafico() { gAntes = JSON.stringify(sheet().charts); }
  function depoisGrafico(moveu) {
    if (moveu && gAntes) { const agora = sheet().charts; sheet().charts = JSON.parse(gAntes); U.inicio('Mover gráfico'); U.graficos(V.si); sheet().charts = agora; U.fim(); }
    gAntes = null;
    if (V.chartSel) { onSelection(); if (painelAba !== 'grafico' && !$('#painel').hidden) abrirPainel('grafico'); }
  }

  /* ======================================================================
     Painel lateral (Funções / Gráfico)
     ====================================================================== */
  let painelAba = 'funcoes', fnSel = null, fnBusca = '', fnCat = 'Mais usadas';
  function abrirPainel(aba) { painelAba = aba || painelAba; $('#painel').hidden = false; renderPainel(); setTimeout(() => G.refresh(), 0); }
  function fecharPainel() { $('#painel').hidden = true; setTimeout(() => G.refresh(), 0); G.focus(); }
  function renderPainel() {
    if ($('#painel').hidden) return;
    $$('.pabas [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.aba === painelAba));
    const pc = $('#painelCorpo');
    if (painelAba === 'funcoes') {
      const L = SD.F.library();
      const nn = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      let nomes = fnBusca ? Object.keys(L.doc).filter(k => nn((L.pt[k] || k) + ' ' + k + ' ' + L.doc[k][1]).includes(nn(fnBusca))) : (L.categorias[fnCat] || []);
      nomes = [...new Set(nomes)];
      const det = fnSel && L.doc[fnSel] ? `<div class="fdet"><code>${esc(L.pt[fnSel] || fnSel)}(${esc(L.doc[fnSel][0])})</code><p>${esc(L.doc[fnSel][1])}</p><p style="font-size:11.5px;color:var(--text-faint)">Nome em inglês: ${esc(fnSel)}</p><div class="linha"><button class="bt pri" id="fnInserir">${ic('mais')}Inserir na célula ${SD.addr(V.act.r, V.act.c)}</button></div></div>` : '<p class="vazio" style="padding:8px">Escolha uma função para ver como usar.</p>';
      pc.innerHTML = `<div class="linha"><input class="in" id="fnBusca" placeholder="Procurar função (ex.: soma, data, procv)" value="${esc(fnBusca)}"></div>
        <select class="in" id="fnCat" ${fnBusca ? 'disabled' : ''}>${Object.keys(L.categorias).map(c => `<option ${c === fnCat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        ${det}<div class="flist">${nomes.map(k => `<button data-fn="${k}" class="${k === fnSel ? 'on' : ''}"><b>${esc(L.pt[k] || k)}</b><small>${esc(L.doc[k] ? L.doc[k][1] : '')}</small></button>`).join('') || '<p class="vazio">Nenhuma função encontrada.</p>'}</div>`;
      const b = $('#fnBusca'); b.oninput = () => { fnBusca = b.value; const pos = b.selectionStart; renderPainel(); const nb = $('#fnBusca'); nb.focus(); nb.setSelectionRange(pos, pos); };
      $('#fnCat').onchange = e => { fnCat = e.target.value; renderPainel(); };
      $$('.flist [data-fn]', pc).forEach(x => { x.onclick = () => { fnSel = x.dataset.fn; renderPainel(); }; x.ondblclick = () => inserirFuncao(x.dataset.fn); });
      const ins = $('#fnInserir'); if (ins) ins.onclick = () => inserirFuncao(fnSel);
    } else {
      const ch = V.chartSel && grafico(V.chartSel);
      if (!ch) {
        pc.innerHTML = `<p class="vazio">Nenhum gráfico selecionado.</p><p>Selecione os dados (com os títulos das colunas) e escolha um tipo para criar um gráfico:</p><div class="tipos">${SD.G.TIPOS.map(t => `<button data-novo="${t.id}">${TIPO_IC[t.id]}${t.nome}</button>`).join('')}</div>`;
        $$('[data-novo]', pc).forEach(b => { b.onclick = () => inserirGrafico(b.dataset.novo); });
        return;
      }
      const D = SD.G.dados(wb, ch);
      const cartes = !['pizza', 'rosca'].includes(ch.tipo);
      pc.innerHTML = `<h4>Tipo</h4><div class="tipos">${SD.G.TIPOS.map(t => `<button data-tipo="${t.id}" aria-pressed="${ch.tipo === t.id}">${TIPO_IC[t.id]}${t.nome}</button>`).join('')}</div>
        <div class="campo"><label for="gTit">Título</label><input class="in" id="gTit" value="${esc(ch.titulo || '')}" placeholder="Sem título"></div>
        <div class="campo"><label for="gInt">Dados (intervalo)</label><div class="linha"><input class="in" id="gInt" value="${esc(ch.range)}"><button class="bt" id="gSel" title="Selecionar na planilha">${ic('grade')}</button></div></div>
        <div class="campo"><span>Séries em</span><div class="seg"><button data-pl="0" aria-pressed="${!D.porLinhas}">Colunas</button><button data-pl="1" aria-pressed="${D.porLinhas}">Linhas</button></div></div>
        <div class="campo"><span>Legenda</span><div class="seg">${[['baixo', 'Embaixo'], ['direita', 'À direita'], ['nenhuma', 'Sem legenda']].map(([v, t]) => `<button data-leg="${v}" aria-pressed="${(ch.legenda || (D.series.length > 1 || !cartes ? 'baixo' : 'nenhuma')) === v}">${t}</button>`).join('')}</div></div>
        <label class="chk"><input type="checkbox" id="gRot" ${(ch.rotulos || (!cartes && ch.rotulos !== false)) ? 'checked' : ''}> Mostrar ${cartes ? 'valores' : 'porcentagens'} no gráfico</label>
        ${['colunas', 'barras', 'area'].includes(ch.tipo) ? `<label class="chk"><input type="checkbox" id="gEmp" ${ch.empilhado ? 'checked' : ''}> Empilhado</label>` : ''}
        <div class="campo"><span>Cores</span><div class="seg">${[['stardust', 'Stardust'], ['nebulosa', 'Nebulosa'], ['sobrio', 'Sóbrio']].map(([v, t]) => `<button data-pal="${v}" aria-pressed="${(ch.paleta || (document.documentElement.dataset.skin === 'nebulosa' ? 'nebulosa' : 'stardust')) === v}">${t}</button>`).join('')}</div></div>
        <p style="font-size:12px;color:var(--text-faint)">${D.series.length} série(s) · ${D.cats.length} categoria(s). Arraste o gráfico para mover e as bolinhas para mudar o tamanho.</p>
        <div class="linha"><button class="bt" id="gPng">${ic('imagem')}Baixar imagem</button><button class="bt perigo" id="gDel">${ic('lixo')}Excluir</button></div>`;
      $$('[data-tipo]', pc).forEach(b => { b.onclick = () => alterarGrafico(ch.id, { tipo: b.dataset.tipo }, 'Tipo do gráfico'); });
      $('#gTit').onchange = e => alterarGrafico(ch.id, { titulo: e.target.value }, 'Título do gráfico');
      $('#gInt').onchange = e => { const g = SD.parseRange(e.target.value); if (!g) { toast('Intervalo inválido. Exemplo: A1:C10', true); e.target.value = ch.range; return; } alterarGrafico(ch.id, { range: SD.rangeStr(g), porLinhas: undefined }, 'Dados do gráfico'); };
      $('#gSel').onclick = () => escolherIntervalo('Selecione os dados do gráfico', ch.range, g => alterarGrafico(ch.id, { range: SD.rangeStr(g), porLinhas: undefined }, 'Dados do gráfico'));
      $$('[data-pl]', pc).forEach(b => { b.onclick = () => alterarGrafico(ch.id, { porLinhas: b.dataset.pl === '1' }, 'Séries do gráfico'); });
      $$('[data-leg]', pc).forEach(b => { b.onclick = () => alterarGrafico(ch.id, { legenda: b.dataset.leg }, 'Legenda'); });
      $$('[data-pal]', pc).forEach(b => { b.onclick = () => alterarGrafico(ch.id, { paleta: b.dataset.pal }, 'Cores do gráfico'); });
      $('#gRot').onchange = e => alterarGrafico(ch.id, { rotulos: e.target.checked }, 'Rótulos');
      const emp = $('#gEmp'); if (emp) emp.onchange = e => alterarGrafico(ch.id, { empilhado: e.target.checked || undefined }, 'Empilhar');
      $('#gPng').onclick = () => baixarGraficoPng(ch.id);
      $('#gDel').onclick = () => excluirGrafico(ch.id);
    }
  }
  function inserirFuncao(fn) {
    const nome = SD.F.PT[fn] || fn;
    if (G.editando()) { const ed = G.editor; const p = ed.selectionStart; const t = ed.value; G.setEditorValue(t.slice(0, p) + nome + '(' + t.slice(ed.selectionEnd)); ed.setSelectionRange(p + nome.length + 1, p + nome.length + 1); }
    else G.startEdit('=' + nome + '()', 'editar');
    const ed = G.editor; if (ed.value.endsWith('()')) ed.setSelectionRange(ed.value.length - 1, ed.value.length - 1);
    G.focus();
  }
  // seleção de intervalo na grade (para o painel de gráfico)
  let pickCb = null;
  function escolherIntervalo(titulo, atual, cb) {
    pickCb = cb;
    V.pickRange = SD.parseRange(atual) || Object.assign({}, V.sel);
    G.render();
    const bar = document.createElement('div');
    bar.id = 'pickBar'; bar.className = 'dlg'; bar.style.cssText = 'position:fixed;left:50%;top:120px;transform:translateX(-50%);z-index:70;width:auto;padding:10px 14px;flex-direction:row;align-items:center;gap:10px';
    bar.innerHTML = `<b>${esc(titulo)}</b><input class="in" id="pickTxt" style="width:140px" value="${esc(SD.rangeStr(V.pickRange))}"><button class="bt" id="pickNo">Cancelar</button><button class="bt pri" id="pickOk">OK</button>`;
    document.body.appendChild(bar);
    const fim = ok => { const g = SD.parseRange($('#pickTxt').value); bar.remove(); V.pickRange = null; G.render(); if (ok && g && pickCb) pickCb(g); pickCb = null; };
    $('#pickOk').onclick = () => fim(true); $('#pickNo').onclick = () => fim(false);
    $('#pickTxt').onkeydown = e => { if (e.key === 'Enter') fim(true); if (e.key === 'Escape') fim(false); };
  }
  function onPick(g) { const t = $('#pickTxt'); if (t) t.value = SD.rangeStr(g); }

  /* ======================================================================
     Barra de ferramentas
     ====================================================================== */
  function montarFerramentas() {
    const tb = (cmd, conteudo, titulo, extra) => `<button class="tb ${extra || ''}" data-cmd="${cmd}" title="${esc(titulo)}" aria-label="${esc(titulo)}">${conteudo}</button>`;
    $('#ferramentas').innerHTML =
      `<div class="grp"><select id="tbFonte" title="Fonte" aria-label="Fonte"><option value="">Calibri</option><option value="serif">Cambria (serifa)</option><option value="mono">Consolas (mono)</option></select><select id="tbTam" title="Tamanho da fonte" aria-label="Tamanho da fonte">${[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48].map(n => `<option>${n}</option>`).join('')}</select></div>` +
      `<div class="grp">${tb('negrito', '<b style="font-size:14px">N</b>', 'Negrito (Ctrl+B)', 'txt')}${tb('italico', '<i style="font-family:Georgia,serif;font-size:14px">I</i>', 'Itálico (Ctrl+I)', 'txt')}${tb('sublinhado', '<u style="font-size:14px">S</u>', 'Sublinhado (Ctrl+U)', 'txt')}${tb('tachado', '<s style="font-size:14px">ab</s>', 'Tachado (Ctrl+5)', 'txt')}</div>` +
      `<div class="grp">${tb('corTexto', '<b style="font-size:14px;line-height:1">A</b><span class="barra" id="barraTexto" style="background:#e5484d"></span>', 'Cor do texto', 'cor')}${tb('corTextoMenu', ic('seta'), 'Escolher cor do texto', 'seta')}${tb('corFundo', ic('balde') + '<span class="barra" id="barraFundo" style="background:#ffd23f"></span>', 'Cor de preenchimento', 'cor')}${tb('corFundoMenu', ic('seta'), 'Escolher cor de preenchimento', 'seta')}${tb('bordasMenu', ic('bordas'), 'Bordas')}</div>` +
      `<div class="grp">${tb('alEsq', ic('alEsq'), 'Alinhar à esquerda')}${tb('alCen', ic('alCen'), 'Centralizar')}${tb('alDir', ic('alDir'), 'Alinhar à direita')}<span class="sep"></span>${tb('alTopo', ic('alTopo'), 'Alinhar em cima')}${tb('alMeio', ic('alMeio'), 'Alinhar no meio')}${tb('alBase', ic('alBase'), 'Alinhar embaixo')}<span class="sep"></span>${tb('quebra', ic('quebra'), 'Quebrar texto automaticamente')}${tb('mesclar', ic('mesclar'), 'Mesclar e centralizar')}</div>` +
      `<div class="grp"><select id="tbFormato" title="Formato de número" aria-label="Formato de número">${FORMATOS_NUM.map(f => `<option value="${f.id}">${f.nome}</option>`).join('')}<option value="outro" hidden>Personalizado</option></select>${tb('moeda', '<b>R$</b>', 'Formato de moeda (R$)', 'txt')}${tb('porcento', '<b>%</b>', 'Porcentagem', 'txt')}${tb('milhar', '<b>000</b>', 'Separador de milhar', 'txt')}${tb('decMais', ic('decMais'), 'Aumentar casas decimais')}${tb('decMenos', ic('decMenos'), 'Diminuir casas decimais')}</div>` +
      `<div class="grp">${tb('autosoma', '<b style="font-size:15px">Σ</b>', 'AutoSoma (Alt+=)', 'txt')}${tb('autosomaMenu', ic('seta'), 'Outras funções rápidas', 'seta')}${tb('ordemAZ', ic('ordemAZ'), 'Classificar de A a Z')}${tb('ordemZA', ic('ordemZA'), 'Classificar de Z a A')}${tb('filtro', ic('filtro'), 'Filtro')}</div>` +
      `<div class="grp destaque">${tb('graficoMenu', ic('grafico') + '<span>Gráfico</span>', 'Inserir gráfico')}</div>` +
      `<span class="ferr-spacer"></span><div class="grp">${tb('painel', ic('painel'), 'Mostrar ou esconder o painel de funções e gráficos')}</div>`;
    $('#tbFonte').onchange = e => { aplicarEstilo({ ff: e.target.value || undefined }, 'Fonte'); G.focus(); };
    $('#tbTam').onchange = e => { const v = +e.target.value; aplicarEstilo({ fs: v === 11 ? undefined : v }, 'Tamanho da fonte'); autoAjustarAlturaFonte(); G.focus(); };
    $('#tbFormato').onchange = e => { const f = FORMATOS_NUM.find(x => x.id === e.target.value); if (f) aplicarEstilo({ z: f.z }, 'Formato de número'); G.focus(); };
  }
  function autoAjustarAlturaFonte() {
    const g = G.boundSel(); const rowsL = []; for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 2000); r++) if (sheet().rowH[r] === undefined || sheet().rowH[r] < 60) rowsL.push(r);
    autoAjustarLinhas(rowsL, true);
  }
  let corTexto = '#e5484d', corFundo = '#ffd23f';
  const CORES = ['#000000', '#3f3f46', '#71717a', '#a1a1aa', '#d4d4d8', '#ffffff', '#4d8fd6', '#a244f5', '#f23fb0', '#ff8a2b',
    '#e5484d', '#f76b15', '#ffd23f', '#46a758', '#12a594', '#19c6f5', '#3b82f6', '#6e56cf', '#d6409f', '#8e4ec6',
    '#fde2e2', '#ffe8d6', '#fff6c2', '#e3f6e5', '#d8f5f1', '#dbf3fd', '#e0ebfd', '#ece8fd', '#fbe1f1', '#f2e6fb',
    '#9b1c1c', '#9a3412', '#854d0e', '#166534', '#115e59', '#075985', '#1e40af', '#4c1d95', '#831843', '#3b0764'];
  function menuCor(tipo, el) {
    const r = el.getBoundingClientRect();
    abrirPop(`<div class="paleta"><button class="lnk" data-cor="">${tipo === 'fundo' ? ic('fechar') + 'Sem preenchimento' : ic('borracha') + 'Automática (cor padrão)'}</button><div class="cores">${CORES.map(c => `<button data-cor="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div><label class="lnk">${ic('paleta')}Mais cores… <input type="color" id="corLivre" value="${tipo === 'fundo' ? corFundo : corTexto}" style="margin-left:auto;width:40px;height:24px;border:0;background:none"></label></div>`, r.left, r.bottom + 4);
    const usar = c => {
      if (tipo === 'fundo') { if (c) { corFundo = c; $('#barraFundo').style.background = c; } aplicarEstilo({ bg: c || undefined }, 'Cor de preenchimento'); }
      else if (tipo === 'borda') { bordaCor = c || null; }
      else { if (c) { corTexto = c; $('#barraTexto').style.background = c; } aplicarEstilo({ fc: c || undefined }, 'Cor do texto'); }
      fecharPop(); G.focus();
    };
    $('#menupop').onclick = e => { const b = e.target.closest('[data-cor]'); if (b) usar(b.dataset.cor); };
    $('#corLivre').onchange = e => usar(e.target.value);
  }
  function menuBordas(el) {
    const r = el.getBoundingClientRect();
    const itens = [['todas', 'Todas as bordas'], ['externas', 'Bordas externas'], ['espessa', 'Borda externa espessa'], ['inferior', 'Borda inferior'], ['inferiorDupla', 'Borda inferior grossa'], ['superior', 'Borda superior'], ['esquerda', 'Borda esquerda'], ['direita', 'Borda direita'], ['nenhuma', 'Sem bordas']];
    abrirPop(itens.map(([k, t]) => `<button class="mi" data-b="${k}"><span class="ico">${ic('bordas')}</span>${t}</button>`).join('') + `<hr><button class="mi" data-b="cor"><span class="ico" style="color:${bordaCor || 'inherit'}">■</span>Cor da borda…</button>`, r.left, r.bottom + 4);
    $('#menupop').onclick = e => { const b = e.target.closest('[data-b]'); if (!b) return; if (b.dataset.b === 'cor') { fecharPop(); menuCor('borda', el); return; } fecharPop(); bordas(b.dataset.b); G.focus(); };
  }
  function menuGraficoNovo(el) {
    const r = el.getBoundingClientRect();
    abrirPop(SD.G.TIPOS.map(t => `<button class="mi" data-t="${t.id}"><span class="ico">${TIPO_IC[t.id]}</span>${t.nome}</button>`).join(''), r.left, r.bottom + 4);
    $('#menupop').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { fecharPop(); inserirGrafico(b.dataset.t); } };
  }
  function menuAutoSoma(el) {
    const r = el.getBoundingClientRect();
    abrirPop([['SUM', 'Soma'], ['AVERAGE', 'Média'], ['COUNT', 'Contar números'], ['MAX', 'Máximo'], ['MIN', 'Mínimo']].map(([f, t]) => `<button class="mi" data-f="${f}">${t}<kbd>${SD.F.PT[f]}</kbd></button>`).join('') + '<hr><button class="mi" data-f="mais">Mais funções…</button>', r.left, r.bottom + 4);
    $('#menupop').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; fecharPop(); if (b.dataset.f === 'mais') abrirPainel('funcoes'); else autoSoma(b.dataset.f); };
  }
  function atualizarFerramentas() {
    const s = estiloAtivo();
    const set = (cmd, on) => { const b = $(`#ferramentas [data-cmd="${cmd}"]`); if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    set('negrito', s.b); set('italico', s.i); set('sublinhado', s.u); set('tachado', s.st);
    set('alEsq', s.ha === 'left'); set('alCen', s.ha === 'center'); set('alDir', s.ha === 'right');
    set('alTopo', s.va === 'top'); set('alMeio', s.va === 'middle'); set('alBase', !s.va || s.va === 'bottom');
    set('quebra', s.wrap); set('filtro', !!sheet().filter);
    const m = G.mergeAt(V.act.r, V.act.c); set('mesclar', !!m);
    $('#tbFonte').value = s.ff || ''; $('#tbTam').value = String(s.fs || 11);
    const fid = formatoAtualId(s.z); const sel = $('#tbFormato');
    sel.value = FORMATOS_NUM.find(f => f.z === s.z) || !s.z ? fid : (FORMATOS_NUM.some(f => f.id === fid) ? fid : 'outro');
  }

  /* ======================================================================
     Barra de fórmulas, caixa de nome, status
     ====================================================================== */
  function onSelection() {
    if (!G.editando()) {
      const cell = getCell(V.si, V.act.r, V.act.c);
      $('#fbar').value = SD.editText(cell);
      ajustarFbar();
    }
    const g = V.sel;
    let nome = SD.addr(V.act.r, V.act.c);
    if (V.chartSel) { const ch = grafico(V.chartSel); nome = ch ? (ch.titulo || 'Gráfico') : nome; }
    else if (!(g.r1 === g.r2 && g.c1 === g.c2) && !G.mergeAt(g.r1, g.c1)) nome = g.r1 === 0 && g.r2 >= G.MAX_R - 1 ? (g.c1 === 0 && g.c2 >= G.MAX_C - 1 ? 'Tudo' : SD.colName(g.c1) + ':' + SD.colName(g.c2)) : g.c1 === 0 && g.c2 >= G.MAX_C - 1 ? (g.r1 + 1) + ':' + (g.r2 + 1) : SD.rangeStr(g);
    if (document.activeElement !== $('#caixaNome')) $('#caixaNome').value = nome;
    atualizarFerramentas();
    statusSel();
    if (painelAba === 'grafico' && !$('#painel').hidden) renderPainel();
    else if (painelAba === 'funcoes' && !$('#painel').hidden) { const b = $('#fnInserir'); if (b) b.lastChild.textContent = 'Inserir na célula ' + SD.addr(V.act.r, V.act.c); }
  }
  function statusSel() {
    const g = V.sel, sh = sheet();
    let soma = 0, n = 0, cont = 0;
    const multi = !(g.r1 === g.r2 && g.c1 === g.c2);
    if (multi) sh.cells.forEach((cl, k) => { const [r, c] = SD.unkey(k); if (!SD.inRange(g, r, c) || sh.hiddenRows.has(r)) return; const v = cl.f ? cl.val : cl.v; if (v === null || v === undefined || v === '') return; cont++; if (typeof v === 'number') { soma += v; n++; } });
    const f = x => x.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
    const modo = G.editando() ? (V.edit.modo === 'editar' ? 'Editar' : 'Entrar') : V.pickRange ? 'Apontar' : 'Pronto';
    $('#status').innerHTML = `<span class="modo">${modo}</span>` + (multi && cont ? (n ? `<span>Média: <b>${f(soma / n)}</b></span>` : '') + `<span>Contagem: <b>${cont}</b></span>` + (n ? `<span>Soma: <b>${f(soma)}</b></span>` : '') : '');
  }
  function status(m) { statusSel(); void m; }
  function ajustarFbar() { const t = $('#fbar'); t.style.height = 'auto'; t.style.height = Math.min(120, Math.max(30, t.scrollHeight + 2)) + 'px'; }
  function irPara(txt) {
    txt = txt.trim(); if (!txt) return;
    let si = V.si, ref = txt;
    const m = /^(?:'([^']+)'|([^!]+))!(.+)$/.exec(txt);
    if (m) { si = wb.sheets.findIndex(s => s.name.toLowerCase() === (m[1] || m[2]).toLowerCase()); ref = m[3]; if (si < 0) { toast('Planilha não encontrada.', true); return; } }
    const g = SD.parseRange(ref);
    if (!g) { toast('Digite uma célula (ex.: B12) ou um intervalo (ex.: A1:D20).', true); return; }
    if (si !== V.si) irPlanilha(si);
    G.setSelection(g, { r: g.r1, c: g.c1 }); G.focus();
  }

  /* ---------- autocompletar e dica de sintaxe ---------- */
  let ac = { itens: [], sel: 0, prefixo: '', inicio: 0 };
  function onEditText(t) {
    const fb = $('#fbar');
    if (t === null) { esconderAuto(); $('#dicaSintaxe').hidden = true; onSelection(); return; }
    if (document.activeElement !== fb) { fb.value = t; ajustarFbar(); }
    statusSel();
    const ed = G.editor;
    const pos = document.activeElement === fb ? fb.selectionStart : ed.selectionStart;
    if (t[0] !== '=') { esconderAuto(); $('#dicaSintaxe').hidden = true; return; }
    const antes = t.slice(0, pos);
    const m = /([A-Za-zÀ-ɏ][\w.À-ɏ]*)$/.exec(antes);
    if (m && !/^[A-Za-z]{1,3}\d+$/.test(m[1]) && !/"[^"]*$/.test(antes.replace(/"[^"]*"/g, ''))) {
      const nn = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
      const p = nn(m[1]);
      const L = SD.F.library();
      const nomes = Object.keys(L.doc).map(k => ({ k, pt: L.pt[k] || k })).filter(x => nn(x.pt).startsWith(p) || x.k.startsWith(p)).sort((a, b) => a.pt.length - b.pt.length).slice(0, 10);
      if (nomes.length && !(nomes.length === 1 && nn(nomes[0].pt) === p && t[pos] === '(')) { mostrarAuto(nomes, m[1], pos - m[1].length); }
      else esconderAuto();
    } else esconderAuto();
    // dica: função em que o cursor está
    const fnAtual = funcaoNoCursor(antes);
    const dica = $('#dicaSintaxe');
    if (fnAtual) {
      const L = SD.F.library(); const en = SD.F.toEn(fnAtual.nome); const d = L.doc[en];
      if (d) {
        const args = d[0].split(';').map(s => s.trim()).filter(Boolean);
        const k = Math.min(fnAtual.arg, Math.max(0, args.length - 1));
        dica.innerHTML = `<b>${esc(L.pt[en] || en)}</b>(${args.map((a, i) => `<span class="${i === k || (a.includes('…') && fnAtual.arg >= i) ? 'arg-on' : ''}">${esc(a)}</span>`).join('; ')}) — ${esc(d[1])}`;
        dica.hidden = false;
      } else dica.hidden = true;
    } else dica.hidden = true;
  }
  function funcaoNoCursor(antes) {
    const toks = []; let i = 0, q = false;
    for (; i < antes.length; i++) { const ch = antes[i]; if (ch === '"') q = !q; if (q) continue; if (ch === '(') toks.push({ pos: i, arg: 0 }); else if (ch === ')') toks.pop(); else if ((ch === ';' || ch === ',') && toks.length && !/\d$/.test(antes.slice(0, i)) ) toks[toks.length - 1].arg++; else if (ch === ';' && toks.length) toks[toks.length - 1].arg++; }
    const t = toks[toks.length - 1]; if (!t) return null;
    const m = /([A-Za-zÀ-ɏ][\w.À-ɏ]*)\s*$/.exec(antes.slice(0, t.pos));
    return m ? { nome: m[1], arg: t.arg } : null;
  }
  function mostrarAuto(nomes, prefixo, inicio) {
    ac = { itens: nomes, sel: 0, prefixo, inicio };
    const el = $('#autoc');
    const L = SD.F.library();
    el.innerHTML = nomes.map((x, i) => `<button data-i="${i}" class="${i === 0 ? 'on' : ''}"><b>${esc(x.pt)}</b><small>${esc(L.doc[x.k][1])}</small></button>`).join('');
    const fb = $('#fbar');
    const alvo = document.activeElement === fb ? fb : G.editor;
    const r = alvo.getBoundingClientRect();
    el.style.left = Math.min(r.left + (alvo === fb ? 10 : 0), innerWidth - 300) + 'px'; el.style.top = (r.bottom + 2) + 'px';
    el.hidden = false;
    el.onmousedown = e => { e.preventDefault(); const b = e.target.closest('[data-i]'); if (b) aceitarAuto(+b.dataset.i); };
  }
  function esconderAuto() { $('#autoc').hidden = true; ac.itens = []; }
  function aceitarAuto(i) {
    const x = ac.itens[i]; if (!x) return;
    const fb = $('#fbar'), noFb = document.activeElement === fb;
    const t = noFb ? fb.value : G.editor.value;
    const fim = ac.inicio + ac.prefixo.length;
    const novo = t.slice(0, ac.inicio) + x.pt + '(' + t.slice(fim).replace(/^\(/, '');
    const pos = ac.inicio + x.pt.length + 1;
    G.setEditorValue(novo);
    G.editor.setSelectionRange(pos, pos);
    if (noFb) { fb.value = novo; fb.setSelectionRange(pos, pos); }
    esconderAuto();
    onEditText(novo);
  }
  function teclaAutocompletar(e) {
    if ($('#autoc').hidden || !ac.itens.length) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); ac.sel = (ac.sel + (e.key === 'ArrowDown' ? 1 : -1) + ac.itens.length) % ac.itens.length; $$('#autoc button').forEach((b, i) => b.classList.toggle('on', i === ac.sel)); return true; }
    if (e.key === 'Tab') { e.preventDefault(); aceitarAuto(ac.sel); return true; }
    if (e.key === 'Escape') { e.preventDefault(); esconderAuto(); return true; }
    return false;
  }
  // F4: alterna $ na referência do cursor
  function alternarAbsoluta() {
    const fb = $('#fbar'); const noFb = document.activeElement === fb; const ed = G.editor;
    const t = noFb ? fb.value : ed.value; const pos = noFb ? fb.selectionStart : ed.selectionStart;
    const re = /\$?[A-Za-z]{1,3}\$?\d{1,7}/g; let m;
    while ((m = re.exec(t))) {
      if (pos >= m.index && pos <= m.index + m[0].length) {
        const p = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(m[0]);
        const st = (p[1] ? 2 : 0) + (p[3] ? 1 : 0); const nx = { 0: 3, 3: 1, 1: 2, 2: 0 }[st];
        const novo = (nx & 2 ? '$' : '') + p[2] + (nx & 1 ? '$' : '') + p[4];
        const nt = t.slice(0, m.index) + novo + t.slice(m.index + m[0].length);
        G.setEditorValue(nt); const np = m.index + novo.length; ed.setSelectionRange(np, np); if (noFb) { fb.value = nt; fb.setSelectionRange(np, np); }
        return;
      }
    }
  }

  /* ======================================================================
     Teclas globais
     ====================================================================== */
  function teclaGlobal(e) {
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (!$('#modal').hidden) return false;
    if (G.editando()) {
      if (ctrl && e.key === 'Enter') { e.preventDefault(); const t = G.valorEditor(); const { r, c } = V.edit; G.cancelEdit(); entrarTexto(r, c, t, true); return true; }
      if (e.key === 'F4') { e.preventDefault(); alternarAbsoluta(); return true; }
      return false;
    }
    if (ctrl && !e.shiftKey && k === 's') { e.preventDefault(); salvar(); return true; }
    if (ctrl && e.shiftKey && k === 's') { e.preventDefault(); dlgSalvarComo(); return true; }
    if (ctrl && k === 'o') { e.preventDefault(); abrirArquivo(); return true; }
    if (ctrl && k === 'p') { e.preventDefault(); dlgSalvarComo('pdf'); return true; }
    if (ctrl && !e.shiftKey && k === 'z') { e.preventDefault(); U.desfazer(); return true; }
    if (ctrl && (k === 'y' || (e.shiftKey && k === 'z'))) { e.preventDefault(); U.refazer(); return true; }
    if (ctrl && k === 'b') { e.preventDefault(); alternar('b', 'Negrito'); return true; }
    if (ctrl && k === 'i') { e.preventDefault(); alternar('i', 'Itálico'); return true; }
    if (ctrl && k === 'u') { e.preventDefault(); alternar('u', 'Sublinhado'); return true; }
    if (ctrl && k === '5') { e.preventDefault(); alternar('st', 'Tachado'); return true; }
    if (ctrl && k === '1') { e.preventDefault(); dlgFormatar(); return true; }
    if (ctrl && k === 'f') { e.preventDefault(); dlgLocalizar(false); return true; }
    if (ctrl && k === 'h') { e.preventDefault(); dlgLocalizar(true); return true; }
    if (ctrl && k === 'd') { e.preventDefault(); preencherDir('baixo'); return true; }
    if (ctrl && k === 'r') { e.preventDefault(); preencherDir('direita'); return true; }
    if (ctrl && (e.key === ';' || e.code === 'Semicolon' || e.code === 'Slash' && e.shiftKey)) { e.preventDefault(); const d = new Date(); G.startEdit(e.shiftKey ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR'), 'entrar'); return true; }
    if (e.altKey && (e.key === '=' || e.code === 'Equal')) { e.preventDefault(); autoSoma('SUM'); return true; }
    if (e.shiftKey && e.key === 'F11') { e.preventDefault(); novaPlanilha(); return true; }
    if (e.shiftKey && e.key === 'F2') { e.preventDefault(); dlgComentario(); return true; } // [Nebulosa]
    if (e.altKey && (e.key === 'PageDown' || e.key === 'PageUp')) { e.preventDefault(); irPlanilha(V.si + (e.key === 'PageDown' ? 1 : -1)); return true; }
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = G.cellRect(V.act.r, V.act.c), hr = G.host.getBoundingClientRect(); menuContexto({ clientX: hr.left + r.x + r.w / 2, clientY: hr.top + r.y + r.h / 2 }, { k: 'cell', r: V.act.r, c: V.act.c }); return true; }
    if (ctrl && (k === '+' || k === '=') && e.shiftKey) { e.preventDefault(); inserirLinhas(true); return true; }
    if (ctrl && k === '-') { e.preventDefault(); const g = V.sel; if (g.r1 === 0 && g.r2 >= G.MAX_R - 1) excluirColunas(); else excluirLinhas(); return true; }
    return false;
  }

  /* ======================================================================
     Menus
     ====================================================================== */
  function abrirPop(html, x, y) {
    const p = $('#menupop'); p.innerHTML = html; p.hidden = false; p.onclick = null;
    const w = p.offsetWidth, h = p.offsetHeight;
    p.style.left = Math.max(4, Math.min(x, innerWidth - w - 6)) + 'px';
    p.style.top = Math.max(4, Math.min(y, innerHeight - h - 6)) + 'px';
    setTimeout(() => { const f = p.querySelector('button.mi:not(:disabled), input'); if (f && f.tagName === 'INPUT') f.focus(); }, 10);
  }
  function fecharPop() { const p = $('#menupop'); p.hidden = true; p.innerHTML = ''; $$('#menus [aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false')); }
  function menuItens(lista, x, y) {
    const html = lista.map((it, i) => it === '-' ? '<hr>' : it.h ? `<div class="mh">${esc(it.h)}</div>` : `<button class="mi" data-k="${i}" ${it.off ? 'disabled' : ''}><span class="ico">${it.i ? ic(it.i) : ''}</span>${esc(it.t)}${it.k ? `<kbd>${esc(it.k)}</kbd>` : ''}</button>`).join('');
    abrirPop(html, x, y);
    $('#menupop').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; const it = lista[+b.dataset.k]; fecharPop(); if (it && it.a) setTimeout(it.a, 0); };
  }
  const MENUS = {
    arquivo: () => [
      { t: 'Nova pasta de trabalho', i: 'novo', a: cmdNovo },
      { t: 'Novo a partir de modelo…', i: 'modelo', a: dlgModelos },
      { t: 'Abrir…', i: 'abrir', k: 'Ctrl+O', a: abrirArquivo }, '-',
      { t: 'Salvar', i: 'salvar', k: 'Ctrl+S', a: salvar },
      { t: 'Salvar como…', i: 'salvar', k: 'Ctrl+Shift+S', a: () => dlgSalvarComo() }, '-',
      { h: 'Exportar' },
      { t: 'PDF…', i: 'pdf', k: 'Ctrl+P', a: () => dlgSalvarComo('pdf') },
      { t: 'Imagem JPG…', i: 'imagem', a: () => dlgSalvarComo('jpg') },
      { t: 'CSV (planilha atual)…', i: 'grade', a: () => dlgSalvarComo('csv') }, '-',
      { t: 'Imprimir…', i: 'imprimir', a: imprimir }
    ],
    editar: () => [
      { t: 'Desfazer', i: 'desfazer', k: 'Ctrl+Z', a: () => U.desfazer(), off: !U.pilha.length },
      { t: 'Refazer', i: 'refazer', k: 'Ctrl+Y', a: () => U.refazer(), off: !U.volta.length }, '-',
      { t: 'Recortar', i: 'recortar', k: 'Ctrl+X', a: () => cmdCopiar(true) },
      { t: 'Copiar', i: 'copiar', k: 'Ctrl+C', a: () => cmdCopiar(false) },
      { t: 'Colar', i: 'colar', k: 'Ctrl+V', a: () => cmdColar() },
      { t: 'Colar só os valores', i: 'colar', a: () => cmdColar('valores'), off: !V.clip },
      { t: 'Colar só a formatação', i: 'paleta', a: () => cmdColar('formatos'), off: !V.clip }, '-',
      { t: 'Preencher abaixo', k: 'Ctrl+D', a: () => preencherDir('baixo') },
      { t: 'Preencher à direita', k: 'Ctrl+R', a: () => preencherDir('direita') }, '-',
      { t: 'Limpar conteúdo', i: 'borracha', k: 'Delete', a: limparConteudo },
      { t: 'Limpar formatação', a: limparFormatacao },
      { t: 'Limpar tudo', a: limparTudo }, '-',
      { t: 'Localizar…', i: 'localizar', k: 'Ctrl+F', a: () => dlgLocalizar(false) },
      { t: 'Localizar e substituir…', k: 'Ctrl+H', a: () => dlgLocalizar(true) },
      { t: 'Ir para…', a: () => { $('#caixaNome').focus(); $('#caixaNome').select(); } }
    ],
    inserir: () => [
      { t: 'Linha acima', i: 'linhaIns', a: () => inserirLinhas(true) },
      { t: 'Linha abaixo', a: () => inserirLinhas(false) },
      { t: 'Coluna à esquerda', a: () => inserirColunas(true) },
      { t: 'Coluna à direita', a: () => inserirColunas(false) }, '-',
      { t: 'Nova planilha', i: 'mais', k: 'Shift+F11', a: novaPlanilha }, '-',
      { t: 'Gráfico…', i: 'grafico', a: () => abrirPainel('grafico') },
      { t: 'Função…', i: 'manual', a: () => abrirPainel('funcoes') },
      { t: temNota() ? 'Editar comentário…' : 'Comentário…', i: 'comentario', k: 'Shift+F2', a: dlgComentario }, '-',
      { t: 'Data de hoje', k: 'Ctrl+;', a: () => G.startEdit(new Date().toLocaleDateString('pt-BR'), 'entrar') },
      { t: 'AutoSoma', k: 'Alt+=', a: () => autoSoma('SUM') }
    ],
    formatar: () => [
      { t: 'Formatar células…', i: 'paleta', k: 'Ctrl+1', a: dlgFormatar }, '-',
      { t: 'Negrito', k: 'Ctrl+B', a: () => alternar('b', 'Negrito') },
      { t: 'Itálico', k: 'Ctrl+I', a: () => alternar('i', 'Itálico') },
      { t: 'Sublinhado', k: 'Ctrl+U', a: () => alternar('u', 'Sublinhado') }, '-',
      { t: 'Mesclar e centralizar', i: 'mesclar', a: mesclar },
      { t: 'Quebrar texto', i: 'quebra', a: () => alternar('wrap', 'Quebrar texto') }, '-',
      { t: 'Formatação condicional…', i: 'condicional', a: dlgCondicional },
      { t: 'Tirar formatação condicional da seleção', a: () => limparCondicional(G.boundSel()), off: !(sheet().condFormats || []).length }, '-',
      { t: 'Largura da coluna…', a: dlgLargura },
      { t: 'Ajustar largura ao conteúdo', a: () => autoAjustarColunas(colunasSel()) },
      { t: 'Altura da linha…', a: dlgAltura },
      { t: 'Ajustar altura ao conteúdo', a: () => autoAjustarLinhas(linhasSel()) }, '-',
      { t: 'Ocultar colunas', i: 'ocultar', a: () => ocultar('c') }, { t: 'Reexibir colunas', a: () => ocultar('c', true) },
      { t: 'Ocultar linhas', a: () => ocultar('r') }, { t: 'Reexibir linhas', a: () => ocultar('r', true) }
    ],
    dados: () => [
      { t: 'Classificar de A a Z', i: 'ordemAZ', a: () => ordenarRapido(false) },
      { t: 'Classificar de Z a A', i: 'ordemZA', a: () => ordenarRapido(true) },
      { t: 'Classificar…', a: dlgClassificar }, '-',
      { t: sheet().filter ? 'Tirar filtro' : 'Filtro', i: 'filtro', a: alternarFiltro },
      { t: 'Limpar filtros', a: () => { const sh = sheet(); if (!sh.filter) return; U.inicio('Limpar filtros'); U.planilha(V.si); sh.filter.hidden = {}; aplicarFiltros(sh); U.fim(); }, off: !sheet().filter }, '-',
      { t: 'Validação de dados…', i: 'validacao', a: dlgValidacao },
      { t: 'Tirar validação da seleção', a: () => removerValidacao([G.boundSel()]), off: !(sheet().validations || []).length }, '-',
      { t: 'Remover duplicadas…', a: dlgDuplicadas },
      { t: 'Recalcular tudo', k: 'F9', a: () => { atualizar(); toast('Fórmulas recalculadas.'); } }
    ],
    exibir: () => [
      { t: (sheet().showGrid === false ? 'Mostrar' : 'Esconder') + ' linhas de grade', i: 'grade', a: alternarGrade }, '-',
      { h: 'Congelar painéis' },
      { t: 'Congelar a primeira linha', i: 'congelar', a: () => congelar('linha') },
      { t: 'Congelar a primeira coluna', a: () => congelar('coluna') },
      { t: 'Congelar acima e à esquerda da célula', a: () => congelar('celula') },
      { t: 'Descongelar', a: () => congelar('nada'), off: !(sheet().freeze.r || sheet().freeze.c) }, '-',
      { t: 'Aumentar zoom', i: 'mais', a: () => setZoom((sheet().zoom || 1) + 0.1) },
      { t: 'Diminuir zoom', i: 'menos', a: () => setZoom((sheet().zoom || 1) - 0.1) },
      { t: 'Zoom 100%', a: () => setZoom(1) }, '-',
      { t: ($('#painel').hidden ? 'Mostrar' : 'Esconder') + ' painel lateral', i: 'painel', a: () => $('#painel').hidden ? abrirPainel() : fecharPainel() },
      { t: 'Aparência…', i: 'paleta', a: aparencia },
      { t: temaEscuro() ? 'Modo claro' : 'Modo escuro', i: 'sol', a: alternarModo }
    ],
    ajuda: () => [
      { t: 'Manual do Stardust', i: 'manual', a: () => window.open('../../manuais/stardust.html', '_blank', 'noopener') },
      { t: 'Atalhos de teclado', i: 'teclado', a: dlgAtalhos },
      { t: 'Lista de funções', i: 'manual', a: () => abrirPainel('funcoes') }, '-',
      { t: 'Sobre o Stardust', i: 'info', a: dlgSobre }
    ]
  };
  const colunasSel = () => { const g = G.boundSel(); const o = []; for (let c = g.c1; c <= Math.min(g.c2, g.c1 + 300); c++) o.push(c); return o; };
  const linhasSel = () => { const g = G.boundSel(); const o = []; for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 5000); r++) o.push(r); return o; };
  function abrirMenu(btn) {
    const nome = btn.dataset.menu;
    const aberto = btn.getAttribute('aria-expanded') === 'true';
    fecharPop();
    if (aberto) return;
    btn.setAttribute('aria-expanded', 'true');
    const r = btn.getBoundingClientRect();
    menuItens(MENUS[nome](), r.left, r.bottom + 4);
    $$('#menus [aria-expanded="true"]').forEach(b => { if (b !== btn) b.setAttribute('aria-expanded', 'false'); });
    btn.setAttribute('aria-expanded', 'true');
  }
  function menuContexto(e, h) {
    const x = e.clientX, y = e.clientY;
    if (h && h.k === 'colhdr') return menuItens([
      { t: 'Recortar', i: 'recortar', a: () => cmdCopiar(true) }, { t: 'Copiar', i: 'copiar', a: () => cmdCopiar(false) }, { t: 'Colar', i: 'colar', a: () => cmdColar() }, '-',
      { t: 'Inserir coluna à esquerda', i: 'linhaIns', a: () => inserirColunas(true) }, { t: 'Inserir coluna à direita', a: () => inserirColunas(false) },
      { t: 'Excluir coluna(s)', i: 'lixo', a: excluirColunas }, { t: 'Limpar conteúdo', i: 'borracha', a: limparConteudo }, '-',
      { t: 'Largura da coluna…', a: dlgLargura }, { t: 'Ajustar ao conteúdo', a: () => autoAjustarColunas(colunasSel()) },
      { t: 'Ocultar', i: 'ocultar', a: () => ocultar('c') }, { t: 'Reexibir', a: () => ocultar('c', true) }, '-',
      { t: 'Classificar de A a Z', i: 'ordemAZ', a: () => ordenarRapido(false) }, { t: 'Classificar de Z a A', i: 'ordemZA', a: () => ordenarRapido(true) }
    ], x, y);
    if (h && h.k === 'rowhdr') return menuItens([
      { t: 'Recortar', i: 'recortar', a: () => cmdCopiar(true) }, { t: 'Copiar', i: 'copiar', a: () => cmdCopiar(false) }, { t: 'Colar', i: 'colar', a: () => cmdColar() }, '-',
      { t: 'Inserir linha acima', i: 'linhaIns', a: () => inserirLinhas(true) }, { t: 'Inserir linha abaixo', a: () => inserirLinhas(false) },
      { t: 'Excluir linha(s)', i: 'lixo', a: excluirLinhas }, { t: 'Limpar conteúdo', i: 'borracha', a: limparConteudo }, '-',
      { t: 'Altura da linha…', a: dlgAltura }, { t: 'Ajustar ao conteúdo', a: () => autoAjustarLinhas(linhasSel()) },
      { t: 'Ocultar', i: 'ocultar', a: () => ocultar('r') }, { t: 'Reexibir', a: () => ocultar('r', true) }
    ], x, y);
    menuItens([
      { t: 'Recortar', i: 'recortar', k: 'Ctrl+X', a: () => cmdCopiar(true) }, { t: 'Copiar', i: 'copiar', k: 'Ctrl+C', a: () => cmdCopiar(false) },
      { t: 'Colar', i: 'colar', k: 'Ctrl+V', a: () => cmdColar() }, { t: 'Colar só os valores', a: () => cmdColar('valores'), off: !V.clip }, '-',
      { t: 'Inserir linha acima', i: 'linhaIns', a: () => inserirLinhas(true) }, { t: 'Inserir coluna à esquerda', a: () => inserirColunas(true) },
      { t: 'Excluir linha', i: 'lixo', a: excluirLinhas }, { t: 'Excluir coluna', a: excluirColunas }, '-',
      { t: 'Limpar conteúdo', i: 'borracha', k: 'Delete', a: limparConteudo }, { t: 'Formatar células…', i: 'paleta', k: 'Ctrl+1', a: dlgFormatar }, '-',
      { t: temNota() ? 'Editar comentário…' : 'Inserir comentário…', i: 'comentario', k: 'Shift+F2', a: dlgComentario },
      ...(notasNaSel() ? [{ t: 'Excluir comentário', a: () => excluirComentarios() }] : []),
      { t: 'Formatação condicional…', i: 'condicional', a: dlgCondicional }, { t: 'Validação de dados…', i: 'validacao', a: dlgValidacao }, '-',
      { t: 'Classificar de A a Z', i: 'ordemAZ', a: () => ordenarRapido(false) }, { t: 'Filtro', i: 'filtro', a: alternarFiltro },
      { t: 'Inserir gráfico', i: 'grafico', a: () => inserirGrafico('colunas') }, { t: 'Inserir função…', i: 'manual', a: () => abrirPainel('funcoes') }
    ], x, y);
  }
  function menuGrafico(e, id) {
    menuItens([{ t: 'Editar gráfico…', i: 'grafico', a: () => abrirPainel('grafico') }, { t: 'Baixar imagem (PNG)', i: 'imagem', a: () => baixarGraficoPng(id) }, '-', { t: 'Excluir gráfico', i: 'lixo', a: () => excluirGrafico(id) }], e.clientX, e.clientY);
  }
  function menuAba(e, i) {
    menuItens([{ t: 'Renomear', a: () => renomearPlanilha(i) }, { t: 'Duplicar', i: 'copiar', a: () => duplicarPlanilha(i) }, { t: 'Inserir nova planilha', i: 'mais', a: novaPlanilha }, '-',
      { t: 'Mover para a esquerda', a: () => moverPlanilha(i, i - 1), off: i === 0 }, { t: 'Mover para a direita', a: () => moverPlanilha(i, i + 1), off: i === wb.sheets.length - 1 }, '-',
      { t: 'Excluir', i: 'lixo', a: () => excluirPlanilha(i) }], e.clientX, e.clientY - 10);
  }

  /* ======================================================================
     Janelas
     ====================================================================== */
  function dialogo(o) {
    const m = $('#modal');
    m.innerHTML = `<div class="dlg ${o.larga ? 'larga' : ''}" role="dialog" aria-modal="true" aria-labelledby="dlgT"><header><h2 id="dlgT">${esc(o.titulo)}</h2><button class="ib" data-x aria-label="Fechar">${ic('fechar')}</button></header>${o.abas || ''}<div class="corpo">${o.corpo}</div><footer>${(o.botoes || [{ t: 'OK', pri: true }]).map((b, i) => `<button class="bt ${b.pri ? 'pri' : ''} ${b.perigo ? 'perigo' : ''} ${b.esq ? 'esq' : ''}" data-b="${i}">${esc(b.t)}</button>`).join('')}</footer></div>`;
    m.hidden = false;
    const fechar = () => { m.hidden = true; m.innerHTML = ''; G.focus(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); } };
    document.addEventListener('keydown', onKey, true);
    m.onmousedown = e => { if (e.target === m) fechar(); };
    m.onclick = e => {
      if (e.target.closest('[data-x]')) { fechar(); return; }
      const b = e.target.closest('[data-b]'); if (!b) return;
      const bt = o.botoes[+b.dataset.b];
      const r = bt.acao ? bt.acao() : undefined;
      if (!bt.manter && r !== false) fechar();
    };
    const d = m.querySelector('.dlg');
    d.fechar = fechar;
    setTimeout(() => { const f = d.querySelector('.corpo input, .corpo select, footer .pri'); if (f) f.focus(); }, 20);
    return d;
  }
  function confirmar(titulo, texto, ok, acao, perigo) { dialogo({ titulo, corpo: `<p>${esc(texto)}</p>`, botoes: [{ t: 'Cancelar' }, { t: ok, pri: !perigo, perigo, acao }] }); }
  function dlgLargura() {
    const cs = colunasSel(), atual = SD.IO.colPx(sheet(), cs[0]);
    const d = dialogo({ titulo: 'Largura da coluna', corpo: `<div class="campo"><span>Largura em pixels (padrão: ${SD.DEF_W})</span><input class="in" type="number" min="0" max="2000" id="wTam" value="${atual}"></div>`, botoes: [{ t: 'Cancelar' }, { t: 'OK', pri: true, acao: () => setColWidth(cs, Math.max(0, +$('#wTam').value || SD.DEF_W)) }] });
    $('#wTam', d).select();
  }
  function dlgAltura() {
    const rs = linhasSel(), atual = SD.IO.rowPx(sheet(), rs[0]);
    const d = dialogo({ titulo: 'Altura da linha', corpo: `<div class="campo"><span>Altura em pixels (padrão: ${SD.DEF_H})</span><input class="in" type="number" min="0" max="800" id="hTam" value="${atual}"></div>`, botoes: [{ t: 'Cancelar' }, { t: 'OK', pri: true, acao: () => setRowHeight(rs, Math.max(0, +$('#hTam').value || SD.DEF_H)) }] });
    $('#hTam', d).select();
  }
  function dlgDuplicadas() {
    const g = areaClassificar(); if (!g) { toast('Clique numa célula da tabela.'); return; }
    const cab = temCabecalho(g);
    confirmar('Remover duplicadas', `Procurar linhas repetidas em ${SD.rangeStr(g)}${cab ? ' (a primeira linha é cabeçalho)' : ''} e apagar as repetições, mantendo a primeira de cada?`, 'Remover', () => {
      const sh = sheet(), vistos = new Set(), manter = [];
      for (let r = g.r1 + (cab ? 1 : 0); r <= g.r2; r++) {
        const ch = []; for (let c = g.c1; c <= g.c2; c++) { const cl = sh.cells.get(r + ',' + c); ch.push(cl ? String(cl.f ? cl.val : cl.v).toLowerCase() : ''); }
        const k = ch.join('\u0001'); if (vistos.has(k)) continue; vistos.add(k);
        const row = []; for (let c = g.c1; c <= g.c2; c++) row.push(sh.cells.get(r + ',' + c) || null); manter.push({ r, row });
      }
      const total = g.r2 - (g.r1 + (cab ? 1 : 0)) + 1, removidas = total - manter.length;
      U.inicio('Remover duplicadas');
      for (let i = 0; i < total; i++) { const r = g.r1 + (cab ? 1 : 0) + i; for (let c = g.c1; c <= g.c2; c++) { const it = manter[i]; const n = it ? (it.row[c - g.c1] ? SD.cloneCell(it.row[c - g.c1]) : null) : null; if (n && n.f) n.f = SD.F.shiftFormula(n.f, r - it.r, 0); setCell(V.si, r, c, n); } }
      U.fim();
      toast(removidas ? removidas + ' linha(s) repetida(s) removida(s).' : 'Nenhuma linha repetida.');
    });
  }
  function dlgFormatar() {
    const s0 = estiloAtivo();
    const cell = getCell(V.si, V.act.r, V.act.c);
    const valorEx = cell ? (cell.f ? cell.val : cell.v) : 1234.5;
    let st = JSON.parse(JSON.stringify(s0));
    let aba = 'numero';
    const abas = `<div class="abasdlg" role="tablist">${[['numero', 'Número'], ['alinhamento', 'Alinhamento'], ['fonte', 'Fonte'], ['borda', 'Borda'], ['preenchimento', 'Preenchimento']].map(([k, t]) => `<button role="tab" data-aba="${k}" aria-selected="${k === aba}">${t}</button>`).join('')}</div>`;
    const d = dialogo({ titulo: 'Formatar células', larga: true, abas, corpo: '<div id="fmtCorpo"></div>', botoes: [{ t: 'Cancelar' }, { t: 'OK', pri: true, acao: () => aplicarEstilo(() => normalizar(st), 'Formatar células') }] });
    const normalizar = x => { const o = {}; ['b', 'i', 'u', 'st', 'fs', 'fc', 'bg', 'ha', 'va', 'wrap', 'z', 'ff', 'ind', 'bd'].forEach(k => { o[k] = x[k] === undefined || x[k] === '' || x[k] === false ? undefined : x[k]; }); if (o.fs === 11) o.fs = undefined; if (o.bd && !Object.keys(o.bd).filter(k => k !== 'c').length) o.bd = undefined; return o; };
    const ex = () => { const v = typeof valorEx === 'number' || typeof valorEx === 'string' ? valorEx : 1234.5; return esc(SD.formatValue(v === null ? 1234.5 : v, st.z).t || ' '); };
    function render() {
      $$('.abasdlg [role=tab]', d).forEach(b => b.setAttribute('aria-selected', b.dataset.aba === aba));
      const c = $('#fmtCorpo', d);
      if (aba === 'numero') {
        const cat = formatoAtualId(st.z);
        const casas = st.z && /0\.(0+)/.test(st.z) ? /0\.(0+)/.exec(st.z)[1].length : (cat === 'numero' || cat === 'moeda' || cat === 'porcentagem' ? 0 : 2);
        c.innerHTML = `<div class="grade2"><div class="campo"><span>Categoria</span><div class="lista-cat">${FORMATOS_NUM.map(f => `<button data-cat="${f.id}" aria-pressed="${f.id === cat}">${f.nome}</button>`).join('')}</div></div>
          <div style="display:flex;flex-direction:column;gap:10px"><div class="campo"><span>Exemplo</span><div class="exemplo" id="fEx">${ex()}</div></div>
          ${['numero', 'moeda', 'porcentagem', 'cientifico'].includes(cat) ? `<div class="campo"><span>Casas decimais</span><input class="in" type="number" min="0" max="10" id="fCasas" value="${casas}"></div>` : ''}
          ${cat === 'numero' ? `<label class="chk"><input type="checkbox" id="fMil" ${!st.z || /,/.test(st.z) ? 'checked' : ''}> Usar separador de milhar (.)</label>` : ''}
          ${cat === 'data' ? `<div class="campo"><span>Tipo</span><select class="in" id="fData">${['dd/mm/yyyy', 'dd/mm/yy', 'd/m/yyyy', 'dd/mm', 'mmm/yy', 'mmmm" de "yyyy', 'dd/mm/yyyy hh:mm', 'yyyy-mm-dd'].map(z => `<option value="${esc(z)}" ${st.z === z ? 'selected' : ''}>${esc(SD.formatValue(46320.6, z).t)}</option>`).join('')}</select></div>` : ''}
          <div class="campo"><span>Código do formato (avançado)</span><input class="in" id="fCod" value="${esc(st.z || 'Geral')}" spellcheck="false"></div>
          <p style="font-size:12px;color:var(--text-faint)">Os códigos seguem o Excel: 0 = dígito, # = dígito opcional, , = milhar, . = decimal, "texto" = texto fixo.</p></div></div>`;
        $$('[data-cat]', c).forEach(b => b.onclick = () => { const f = FORMATOS_NUM.find(x => x.id === b.dataset.cat); st.z = f.z; render(); });
        const atualizarNum = () => {
          const n = $('#fCasas', c) ? Math.max(0, Math.min(10, +$('#fCasas', c).value || 0)) : null;
          const dec = n ? '.' + '0'.repeat(n) : '';
          if (cat === 'numero') st.z = ($('#fMil', c) && $('#fMil', c).checked ? '#,##0' : '0') + dec;
          else if (cat === 'moeda') st.z = `"R$" #,##0${dec};[Red]-"R$" #,##0${dec}`;
          else if (cat === 'porcentagem') st.z = '0' + dec + '%';
          else if (cat === 'cientifico') st.z = '0' + dec + 'E+00';
          $('#fEx', c).innerHTML = ex(); $('#fCod', c).value = st.z;
        };
        if ($('#fCasas', c)) $('#fCasas', c).oninput = atualizarNum;
        if ($('#fMil', c)) $('#fMil', c).onchange = atualizarNum;
        if ($('#fData', c)) $('#fData', c).onchange = e => { st.z = e.target.value; $('#fEx', c).innerHTML = ex(); $('#fCod', c).value = st.z; };
        $('#fCod', c).oninput = e => { const v = e.target.value.trim(); st.z = !v || /^geral$/i.test(v) ? undefined : v; $('#fEx', c).innerHTML = ex(); };
      } else if (aba === 'alinhamento') {
        c.innerHTML = `<div class="grade2"><div class="campo"><span>Horizontal</span><select class="in" id="aH"><option value="">Geral (texto à esquerda, números à direita)</option><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option><option value="justify">Justificado</option></select></div>
          <div class="campo"><span>Vertical</span><select class="in" id="aV"><option value="">Embaixo</option><option value="middle">No meio</option><option value="top">Em cima</option></select></div>
          <div class="campo"><span>Recuo</span><input class="in" type="number" min="0" max="15" id="aInd" value="${st.ind || 0}"></div>
          <div class="campo"><span>&nbsp;</span><label class="chk"><input type="checkbox" id="aW" ${st.wrap ? 'checked' : ''}> Quebrar o texto automaticamente</label></div></div>`;
        $('#aH', c).value = st.ha || ''; $('#aV', c).value = st.va === 'bottom' ? '' : st.va || '';
        $('#aH', c).onchange = e => { st.ha = e.target.value || undefined; }; $('#aV', c).onchange = e => { st.va = e.target.value || undefined; };
        $('#aInd', c).oninput = e => { st.ind = +e.target.value || undefined; }; $('#aW', c).onchange = e => { st.wrap = e.target.checked || undefined; };
      } else if (aba === 'fonte') {
        c.innerHTML = `<div class="grade2"><div class="campo"><span>Fonte</span><select class="in" id="tF"><option value="">Calibri (padrão)</option><option value="serif">Cambria (com serifa)</option><option value="mono">Consolas (monoespaçada)</option></select></div>
          <div class="campo"><span>Tamanho</span><input class="in" type="number" min="6" max="96" id="tT" value="${st.fs || 11}"></div>
          <div class="campo"><span>Estilo</span><div class="linha"><label class="chk"><input type="checkbox" id="tB" ${st.b ? 'checked' : ''}> Negrito</label><label class="chk"><input type="checkbox" id="tI" ${st.i ? 'checked' : ''}> Itálico</label><label class="chk"><input type="checkbox" id="tU" ${st.u ? 'checked' : ''}> Sublinhado</label><label class="chk"><input type="checkbox" id="tS" ${st.st ? 'checked' : ''}> Tachado</label></div></div>
          <div class="campo"><span>Cor</span><div class="linha"><input type="color" id="tC" value="${st.fc || '#000000'}"><label class="chk"><input type="checkbox" id="tCa" ${st.fc ? '' : 'checked'}> Automática</label></div></div></div>
          <div class="campo"><span>Exemplo</span><div class="exemplo" id="tEx">Stardust 123</div></div>`;
        const ex2 = () => { const e = $('#tEx', c); e.style.cssText = `font:${st.i ? 'italic ' : ''}${st.b ? 'bold ' : ''}${(st.fs || 11) * 4 / 3}px ${st.ff === 'serif' ? 'Cambria,Georgia,serif' : st.ff === 'mono' ? 'Consolas,monospace' : 'var(--cell-font)'};text-decoration:${st.u ? 'underline' : ''} ${st.st ? 'line-through' : ''};color:${st.fc || 'var(--sheet-ink)'}`; };
        $('#tF', c).value = st.ff || '';
        $('#tF', c).onchange = e => { st.ff = e.target.value || undefined; ex2(); }; $('#tT', c).oninput = e => { st.fs = +e.target.value || 11; ex2(); };
        [['tB', 'b'], ['tI', 'i'], ['tU', 'u'], ['tS', 'st']].forEach(([id, k]) => { $('#' + id, c).onchange = e => { st[k] = e.target.checked || undefined; ex2(); }; });
        $('#tC', c).oninput = e => { st.fc = e.target.value; $('#tCa', c).checked = false; ex2(); }; $('#tCa', c).onchange = e => { if (e.target.checked) st.fc = undefined; else st.fc = $('#tC', c).value; ex2(); };
        ex2();
      } else if (aba === 'borda') {
        const bd = st.bd || {};
        c.innerHTML = `<p>Bordas desta célula (para a seleção inteira, use o botão Bordas da barra).</p><div class="linha">${[['t', 'Em cima'], ['b', 'Embaixo'], ['l', 'Esquerda'], ['r', 'Direita']].map(([k, t]) => `<div class="campo"><span>${t}</span><select class="in" data-lado="${k}"><option value="">Nenhuma</option><option value="thin">Fina</option><option value="medium">Média</option><option value="thick">Grossa</option></select></div>`).join('')}</div>
          <div class="campo"><span>Cor</span><input type="color" id="bC" value="${bd.c || '#000000'}"></div>`;
        $$('[data-lado]', c).forEach(s => { s.value = bd[s.dataset.lado] || ''; s.onchange = () => { st.bd = Object.assign({}, st.bd || {}); if (s.value) st.bd[s.dataset.lado] = s.value; else delete st.bd[s.dataset.lado]; }; });
        $('#bC', c).oninput = e => { st.bd = Object.assign({}, st.bd || {}, { c: e.target.value }); };
      } else {
        c.innerHTML = `<div class="paleta" style="padding:0"><div class="cores">${CORES.map(x => `<button data-cor="${x}" style="background:${x}" title="${x}"></button>`).join('')}</div><div class="linha"><button class="bt" data-cor="">Sem preenchimento</button><input type="color" id="pC" value="${st.bg || '#ffffff'}"></div><div class="campo"><span>Exemplo</span><div class="exemplo" id="pEx" style="background:${st.bg || 'var(--sheet)'}">Stardust</div></div></div>`;
        const set = v => { st.bg = v || undefined; $('#pEx', c).style.background = v || 'var(--sheet)'; };
        $$('[data-cor]', c).forEach(b => b.onclick = () => set(b.dataset.cor)); $('#pC', c).oninput = e => set(e.target.value);
      }
    }
    $$('.abasdlg [role=tab]', d).forEach(b => b.onclick = () => { aba = b.dataset.aba; render(); });
    render();
  }
  /* ======================================================================
     [Nebulosa] Comentários, formatação condicional e validação de dados
     ====================================================================== */
  const celulaBase = () => { const m = G.mergeAt(V.act.r, V.act.c); return m ? { r: m.r1, c: m.c1 } : { r: V.act.r, c: V.act.c }; };
  const temNota = () => { const b = celulaBase(); return !!SD.R.nota(sheet(), b.r, b.c); };
  const notasNaSel = () => Object.keys(sheet().notas || {}).some(k => { const [r, c] = SD.unkey(k); return SD.inRange(V.sel, r, c); });
  function excluirComentarios(silencioso) {
    const sh = sheet(); if (!sh.notas || !notasNaSel()) { if (!silencioso) toast('Não há comentário na seleção.'); return; }
    U.inicio('Excluir comentário'); U.planilha(V.si);
    const n = {}; Object.keys(sh.notas).forEach(k => { const [r, c] = SD.unkey(k); if (!SD.inRange(V.sel, r, c)) n[k] = sh.notas[k]; });
    sh.notas = n; U.fim();
  }
  function dlgComentario() {
    const b = celulaBase(), k = b.r + ',' + b.c, atual = SD.R.nota(sheet(), b.r, b.c);
    const salvar = () => {
      const t = $('#cmTxt').value.replace(/\s+$/, '');
      const sh = sheet();
      U.inicio(atual ? 'Editar comentário' : 'Inserir comentário'); U.planilha(V.si);
      const n = Object.assign({}, sh.notas || {});
      if (t) n[k] = Object.assign({}, atual || {}, { t }); else delete n[k];
      sh.notas = n; U.fim();
    };
    const botoes = (atual ? [{ t: 'Excluir', perigo: true, esq: true, acao: () => { U.inicio('Excluir comentário'); U.planilha(V.si); const n = Object.assign({}, sheet().notas); delete n[k]; sheet().notas = n; U.fim(); } }] : []).concat([{ t: 'Cancelar' }, { t: 'Salvar', pri: true, acao: salvar }]);
    const d = dialogo({ titulo: 'Comentário em ' + SD.addr(b.r, b.c), corpo: `<div class="campo"><span>Escreva uma observação sobre esta célula. Ela aparece quando o mouse passa por cima (a célula ganha um triângulo vermelho no canto).</span><textarea class="in" id="cmTxt" rows="5" style="resize:vertical;min-height:100px">${esc(atual ? atual.t : '')}</textarea></div>${atual && atual.a ? `<p style="font-size:12px;color:var(--text-faint)">Autor: ${esc(atual.a)}</p>` : ''}`, botoes });
    const ta = $('#cmTxt', d);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 30);
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); salvar(); d.fechar(); } });
  }

  function lerAreas(txt) {
    const a = SD.R.areas(String(txt).replace(/^=/, ''));
    if (!a.length) toast('Intervalo inválido. Use algo como A1:A20 (ou várias áreas separadas por espaço).', true);
    return a;
  }
  function limparCondicional(g) {
    const sh = sheet(); const antes = (sh.condFormats || []).length;
    U.inicio('Tirar formatação condicional'); U.planilha(V.si);
    sh.condFormats = SD.R.recortar(sh.condFormats, g); U.fim();
    if (!antes) toast('Esta planilha não tem formatação condicional.');
  }
  function amostraCond(rg) {
    if (rg.tipo === 'escala') return `<span class="amostra" style="background:linear-gradient(90deg,${(rg.cores || []).join(',')})"></span>`;
    if (rg.tipo === 'barras') return `<span class="amostra" style="background:linear-gradient(90deg,${rg.cor} 0 65%,transparent 65%)"></span>`;
    const e = rg.estilo || {};
    return `<span class="amostra" style="background:${e.bg || 'var(--sheet)'};color:${e.fc || 'var(--sheet-ink)'};font-weight:${e.b ? 700 : 500};font-style:${e.i ? 'italic' : 'normal'}">AaBb</span>`;
  }
  function dlgCondicional() {
    const R = SD.R, g0 = G.boundSel();
    let estiloId = 'vermelho', escalaId = 'vav', cor = R.BARRAS[0];
    const custom = { bg: '#e6dbff', fc: '#4b2a99', b: false };
    const d = dialogo({
      titulo: 'Formatação condicional', larga: true,
      corpo: `<p style="margin-top:0;color:var(--text-dim)">Muda a aparência das células automaticamente, de acordo com o valor de cada uma.</p>
        <div class="grade2"><div class="campo"><span>Aplicar a</span><input class="in" id="cfArea" value="${esc(R.areaStr(g0))}" spellcheck="false"></div>
        <div class="campo"><span>Formatar as células com</span><select class="in" id="cfTipo">${R.TIPOS_COND.map(t => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select></div></div>
        <div class="linha" id="cfVal" style="margin:8px 0"></div>
        <div class="campo"><span id="cfEstT">Aparência</span><div class="amostras" id="cfEst"></div></div>
        <div class="linha" id="cfCustom" hidden style="margin-top:6px"><label class="chk">Fundo <input type="color" id="cfBg" value="${custom.bg}"></label><label class="chk">Texto <input type="color" id="cfFc" value="${custom.fc}"></label><label class="chk"><input type="checkbox" id="cfB"> Negrito</label></div>
        <div class="campo" style="margin-top:14px"><span>Regras desta planilha (a de cima tem prioridade)</span><ul class="regras" id="cfLista"></ul></div>`,
      botoes: [{ t: 'Tirar regras da área', esq: true, manter: true, acao: () => { lerAreas($('#cfArea', d).value).forEach(limparCondicional); lista(); } }, { t: 'Fechar' }, { t: 'Aplicar', pri: true, acao: () => adicionar() }]
    });
    const tipoSel = $('#cfTipo', d);
    function campos() {
      const t = R.TIPOS_COND.find(x => x.id === tipoSel.value);
      const v = $('#cfVal', d);
      v.innerHTML = t.n === 0 ? '' : t.n === 1 ? `<input class="in" id="cfV1" style="max-width:240px" placeholder="${t.id === 'contem' ? 'texto procurado' : 'valor (ex.: 100 ou 01/01/2026)'}">` : `<input class="in" id="cfV1" style="max-width:160px" placeholder="de"><span>e</span><input class="in" id="cfV2" style="max-width:160px" placeholder="até">`;
      v.hidden = t.n === 0;
      const e = $('#cfEst', d);
      $('#cfCustom', d).hidden = true;
      if (t.id === 'escala') {
        $('#cfEstT', d).textContent = 'Cores (do menor para o maior valor)';
        e.innerHTML = R.ESCALAS.map(x => `<button type="button" data-esc="${x.id}" aria-pressed="${x.id === escalaId}" style="background:linear-gradient(90deg,${x.cores.join(',')});color:#1b1d24">${esc(x.nome)}</button>`).join('');
        $$('[data-esc]', e).forEach(b => b.onclick = () => { escalaId = b.dataset.esc; campos(); });
      } else if (t.id === 'barras') {
        $('#cfEstT', d).textContent = 'Cor da barra';
        e.innerHTML = R.BARRAS.map(x => `<button type="button" data-cor="${x}" aria-pressed="${x === cor}" style="background:linear-gradient(90deg,${x} 0 60%,${x}33 60%);min-width:64px">&nbsp;</button>`).join('');
        $$('[data-cor]', e).forEach(b => b.onclick = () => { cor = b.dataset.cor; campos(); });
      } else {
        $('#cfEstT', d).textContent = 'Aparência';
        e.innerHTML = R.ESTILOS.map(x => `<button type="button" data-est="${x.id}" aria-pressed="${x.id === estiloId}" title="${esc(x.nome)}" style="background:${x.bg || 'var(--sheet)'};color:${x.fc || 'var(--sheet-ink)'};font-weight:${x.b ? 700 : 600}">${esc(x.nome.split(' com ')[0])}</button>`).join('') + `<button type="button" data-est="custom" aria-pressed="${estiloId === 'custom'}" style="background:var(--bg2);color:var(--text)">Personalizado…</button>`;
        $$('[data-est]', e).forEach(b => b.onclick = () => { estiloId = b.dataset.est; campos(); });
        $('#cfCustom', d).hidden = estiloId !== 'custom';
      }
    }
    $('#cfBg', d).oninput = ev => { custom.bg = ev.target.value; };
    $('#cfFc', d).oninput = ev => { custom.fc = ev.target.value; };
    $('#cfB', d).onchange = ev => { custom.b = ev.target.checked; };
    tipoSel.onchange = campos;
    function lista() {
      const l = $('#cfLista', d), regras = sheet().condFormats || [];
      l.innerHTML = regras.length ? regras.map((rg, i) => `<li>${amostraCond(rg)}<span class="txt">${esc(R.descreverCond(rg))}<small>${esc(rg.range)}</small></span><button class="ib" data-del="${i}" title="Excluir esta regra" aria-label="Excluir esta regra">${ic('lixo')}</button></li>`).join('') : '<li class="vazio">Nenhuma regra ainda.</li>';
      $$('[data-del]', l).forEach(b => b.onclick = () => { U.inicio('Excluir regra condicional'); U.planilha(V.si); const n = (sheet().condFormats || []).slice(); n.splice(+b.dataset.del, 1); sheet().condFormats = n; U.fim(); lista(); });
    }
    function adicionar() {
      const areas = lerAreas($('#cfArea', d).value); if (!areas.length) return false;
      const t = R.TIPOS_COND.find(x => x.id === tipoSel.value);
      const rg = { range: R.rangeStr(areas), tipo: t.id };
      if (t.n >= 1) { rg.v1 = $('#cfV1', d).value.trim(); if (!rg.v1) { toast('Escreva o valor da regra.', true); $('#cfV1', d).focus(); return false; } }
      if (t.n === 2) { rg.v2 = $('#cfV2', d).value.trim(); if (!rg.v2) { toast('Escreva os dois valores.', true); $('#cfV2', d).focus(); return false; } }
      if (t.id === 'escala') rg.cores = R.ESCALAS.find(x => x.id === escalaId).cores.slice();
      else if (t.id === 'barras') rg.cor = cor;
      else { const e = estiloId === 'custom' ? custom : R.ESTILOS.find(x => x.id === estiloId); rg.estilo = {}; ['bg', 'fc', 'b', 'i'].forEach(k => { if (e[k]) rg.estilo[k] = e[k]; }); }
      U.inicio('Formatação condicional'); U.planilha(V.si);
      sheet().condFormats = [rg].concat(sheet().condFormats || []);
      U.fim();
      toast('Formatação condicional aplicada em ' + rg.range + '.');
    }
    campos(); lista();
  }

  function removerValidacao(areas) {
    const sh = sheet(); if (!(sh.validations || []).length) { toast('Esta planilha não tem validação de dados.'); return; }
    U.inicio('Tirar validação'); U.planilha(V.si);
    areas.forEach(g => { sh.validations = SD.R.recortar(sh.validations, g); });
    U.fim();
  }
  function dlgValidacao() {
    const R = SD.R, g0 = G.boundSel();
    const atual = R.validacaoEm(sheet(), V.act.r, V.act.c);
    const area0 = atual && R.areas(atual.range).length === 1 && SD.inRange(R.areas(atual.range)[0], g0.r1, g0.c1) && g0.r1 === g0.r2 && g0.c1 === g0.c2 ? atual.range : R.areaStr(g0);
    const vd = atual ? JSON.parse(JSON.stringify(atual)) : { tipo: 'lista', op: 'entre', bloquear: true };
    const opcoesTxt = vd.fonte ? '=' + SD.F.toDisplay(vd.fonte) : (vd.lista || []).join('; ');
    const d = dialogo({
      titulo: 'Validação de dados', larga: true,
      corpo: `<p style="margin-top:0;color:var(--text-dim)">Limita o que pode ser digitado nas células. Com uma lista de opções, a célula ganha uma setinha que abre a lista (ou use Alt+↓).</p>
        <div class="grade2"><div class="campo"><span>Aplicar a</span><input class="in" id="vdArea" value="${esc(area0)}" spellcheck="false"></div>
        <div class="campo"><span>Permitir</span><select class="in" id="vdTipo">${R.TIPOS_VAL.map(t => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select></div></div>
        <div id="vdLista" class="campo" style="margin-top:8px"><span>Opções, separadas por ponto e vírgula — ou um intervalo começando com “=”, como =E1:E10 ou =Listas!A1:A20</span><input class="in" id="vdOps" value="${esc(opcoesTxt)}" placeholder="Sim; Não; Talvez" spellcheck="false"></div>
        <div id="vdNum" class="linha" style="margin-top:8px"><select class="in" id="vdOp" style="max-width:200px">${R.OPS.map(o => `<option value="${o.id}">${esc(o.nome)}</option>`).join('')}</select><input class="in" id="vdV1" style="max-width:150px" value="${esc(vd.v1 || '')}"><span id="vdE">e</span><input class="in" id="vdV2" style="max-width:150px" value="${esc(vd.v2 || '')}"></div>
        <div class="grade2" style="margin-top:10px"><div class="campo"><span>Quando digitarem um valor fora da regra</span><select class="in" id="vdBloq"><option value="1">Não aceitar (pedir outro valor)</option><option value="0">Só avisar (deixar a pessoa decidir)</option></select></div>
        <div class="campo"><span>Mensagem de erro (opcional)</span><input class="in" id="vdMsg" value="${esc(vd.msg || '')}" placeholder="Ex.: escolha um dos setores da lista"></div></div>`,
      botoes: [{ t: 'Tirar validação', esq: true, acao: () => { const a = lerAreas($('#vdArea', d).value); if (!a.length) return false; removerValidacao(a); } }, { t: 'Cancelar' }, { t: 'OK', pri: true, acao: () => aplicar() }]
    });
    $('#vdTipo', d).value = vd.tipo; $('#vdOp', d).value = vd.op || 'entre'; $('#vdBloq', d).value = vd.bloquear === false ? '0' : '1';
    function campos() {
      const t = $('#vdTipo', d).value, op = R.OPS.find(o => o.id === $('#vdOp', d).value);
      $('#vdLista', d).hidden = t !== 'lista'; $('#vdNum', d).hidden = t === 'lista';
      $('#vdV2', d).hidden = $('#vdE', d).hidden = op.n !== 2;
      $('#vdV1', d).placeholder = t === 'data' ? 'dd/mm/aaaa' : t === 'texto' ? 'nº de letras' : 'valor';
      $('#vdV2', d).placeholder = $('#vdV1', d).placeholder;
    }
    $('#vdTipo', d).onchange = campos; $('#vdOp', d).onchange = campos; campos();
    function aplicar() {
      const areas = lerAreas($('#vdArea', d).value); if (!areas.length) return false;
      const n = { range: R.rangeStr(areas), tipo: $('#vdTipo', d).value, bloquear: $('#vdBloq', d).value === '1' };
      const msg = $('#vdMsg', d).value.trim(); if (msg) n.msg = msg;
      if (n.tipo === 'lista') {
        const t = $('#vdOps', d).value.trim();
        if (!t) { toast('Escreva as opções da lista.', true); return false; }
        if (t[0] === '=') {
          n.fonte = SD.F.toCanonical(t.slice(1).trim());
          if (!R.opcoes(wb, sheet(), n).length && !/^(?:'(?:[^']|'')+'|[^!]+)!/.test(n.fonte) && !SD.R.areas(n.fonte).length) { toast('Não entendi o intervalo da lista. Use algo como =E1:E10.', true); return false; }
        } else n.lista = t.split(t.includes(';') ? ';' : ',').map(x => x.trim()).filter(Boolean);
      } else {
        n.op = $('#vdOp', d).value; n.v1 = $('#vdV1', d).value.trim();
        const op = R.OPS.find(o => o.id === n.op);
        if (op.n === 2) n.v2 = $('#vdV2', d).value.trim();
        const num = x => typeof R.alvo(x) === 'number';
        if (!num(n.v1) || (op.n === 2 && !num(n.v2))) { toast(n.tipo === 'data' ? 'Escreva datas válidas, como 01/01/2026.' : 'Escreva números válidos nos limites.', true); return false; }
      }
      U.inicio('Validação de dados'); U.planilha(V.si);
      let l = sheet().validations || [];
      areas.forEach(g => { l = R.recortar(l, g); });
      sheet().validations = l.concat([n]);
      U.fim();
      toast('Validação aplicada em ' + n.range + '.');
    }
  }

  function dlgAtalhos() {
    const L = [['Ctrl+S', 'Salvar'], ['Ctrl+Shift+S', 'Salvar como'], ['Ctrl+O', 'Abrir'], ['Ctrl+P', 'Exportar PDF / imprimir'], ['Ctrl+Z / Ctrl+Y', 'Desfazer / refazer'], ['Ctrl+C / X / V', 'Copiar / recortar / colar'],
      ['F2', 'Editar a célula'], ['Enter / Tab', 'Confirmar e ir para baixo / direita'], ['Alt+Enter', 'Nova linha dentro da célula'], ['Ctrl+Enter', 'Escrever o mesmo valor em toda a seleção'], ['Esc', 'Cancelar a edição'],
      ['F4', 'Alternar $ (referência absoluta) ao escrever fórmulas'], ['Tab (na lista)', 'Aceitar a função sugerida'], ['Ctrl+setas', 'Ir até o fim dos dados'], ['Shift+setas', 'Ampliar a seleção'], ['Ctrl+A', 'Selecionar tudo'],
      ['Ctrl+Espaço / Shift+Espaço', 'Selecionar coluna / linha'], ['Ctrl+B / I / U', 'Negrito / itálico / sublinhado'], ['Ctrl+1', 'Formatar células'], ['Ctrl+D / Ctrl+R', 'Preencher abaixo / à direita'], ['Alt+=', 'AutoSoma'],
      ['Ctrl+;', 'Data de hoje'], ['Shift+F2', 'Inserir ou editar comentário'], ['Alt+↓', 'Abrir a lista suspensa da célula'], ['Ctrl+F / Ctrl+H', 'Localizar / substituir'], ['Delete', 'Limpar conteúdo'], ['Shift+F11', 'Nova planilha'], ['Alt+PageUp / PageDown', 'Planilha anterior / seguinte'], ['Ctrl+roda do mouse', 'Zoom']];
    dialogo({ titulo: 'Atalhos de teclado', corpo: `<div class="kbds">${L.map(([k, t]) => `<span><kbd>${esc(k)}</kbd></span><span>${esc(t)}</span>`).join('')}</div>` });
  }
  function dlgSobre() {
    const v = (NS && NS.versao) || '0.3';
    dialogo({ titulo: 'Sobre', corpo: `<div class="sobre"><img src="assets/icone.svg" alt=""><h3>Stardust</h3><p><b>Stardust by Nebulosa Workspace</b> — Planilhas de Cálculo e Gráficos. Versão ${VERSAO}.</p><p>Fórmulas em português (SOMA, SE, PROCV…), gráficos, filtros e classificação, formatação condicional, listas suspensas (validação de dados) e comentários. Abre e salva XLSX, XLSM, XLSB, XLS, ODS e CSV, e exporta PDF e JPG. Tudo no seu computador: nenhum dado sai do navegador.</p><p style="font-size:12px">Bibliotecas: SheetJS Community (Apache 2.0), JSZip (MIT) e pdf-lib (MIT).</p><p class="nb-rodape">Nebulosa Workspace - um pacote de programas simples, bonitos e que funcionam direto no navegador. Versão ${esc(v)}</p></div>`, botoes: [{ t: 'Manual', acao: () => window.open('../../manuais/stardust.html', '_blank', 'noopener') }, { t: 'Fechar', pri: true }] });
  }

  /* ======================================================================
     Modelos
     ====================================================================== */
  const MODELOS = {
    orcamento: { nome: 'Orçamento mensal', desc: 'Receitas, despesas por categoria, saldo e gráfico de pizza.' },
    notas: { nome: 'Notas da turma', desc: 'Notas por bimestre, média, situação (aprovado/recuperação) e gráfico.' },
    vendas: { nome: 'Vendas por mês', desc: 'Vendas de três produtos ao longo do ano, totais e gráfico de linhas.' },
    compras: { nome: 'Lista de compras', desc: 'Itens, quantidade, preço e total com soma automática.' }
  };
  function montarModelo(id) {
    const w = SD.newWorkbook(); const s = w.sheets[0];
    const put = (a, v, st) => { const p = SD.parseAddr(a); const cell = {}; if (typeof v === 'string' && v[0] === '=') { cell.v = null; cell.f = SD.F.toCanonical(v.slice(1)); } else cell.v = v; if (st) cell.s = st; s.cells.set(SD.key(p.r, p.c), cell); };
    const H = { b: true, bg: '#4d8fd6', fc: '#ffffff' }, R = { z: '"R$" #,##0.00;[Red]-"R$" #,##0.00' }, T = { b: true, bd: { t: 'thin' } };
    if (id === 'orcamento') {
      w.name = 'Orçamento mensal'; s.name = 'Orçamento';
      put('A1', 'Orçamento mensal', { b: true, fs: 16 }); put('A2', 'Mês de referência:'); put('B2', SD.todaySerial(), { z: 'mmmm" de "yyyy' });
      put('A4', 'Receitas', H); put('B4', 'Valor', H);
      [['Salário', 4500], ['Renda extra', 800], ['Outros', 150]].forEach(([t, v], i) => { put('A' + (5 + i), t); put('B' + (5 + i), v, R); });
      put('A8', 'Total de receitas', T); put('B8', '=SOMA(B5:B7)', Object.assign({}, R, T));
      put('A10', 'Despesas', H); put('B10', 'Valor', H);
      [['Moradia', 1500], ['Alimentação', 1100], ['Transporte', 450], ['Saúde', 320], ['Educação', 400], ['Lazer', 300], ['Contas da casa', 380]].forEach(([t, v], i) => { put('A' + (11 + i), t); put('B' + (11 + i), v, R); });
      put('A18', 'Total de despesas', T); put('B18', '=SOMA(B11:B17)', Object.assign({}, R, T));
      put('A20', 'Saldo do mês', { b: true, fs: 13 }); put('B20', '=B8-B18', Object.assign({ b: true, fs: 13 }, R));
      put('A21', 'Situação'); put('B21', '=SE(B20>=0;"Dentro do orçamento";"Atenção: gastos maiores que a renda")', { i: true });
      s.colW = { 0: 170, 1: 140 }; s.rowH = { 0: 32, 19: 28 };
      s.charts.push({ id: 'g1', sheetId: s.id, tipo: 'pizza', range: 'A10:B17', x: 340, y: 72, w: 440, h: 300, titulo: 'Para onde vai o dinheiro' });
    } else if (id === 'notas') {
      w.name = 'Notas da turma'; s.name = 'Notas';
      ['Aluno', '1º bim.', '2º bim.', '3º bim.', '4º bim.', 'Média', 'Situação'].forEach((t, i) => put(SD.addr(0, i), t, Object.assign({}, H, { ha: 'center' })));
      [['Ana', 8, 7.5, 9, 8.5], ['Bruno', 6, 5.5, 7, 6], ['Carla', 9.5, 9, 10, 9.5], ['Diego', 4.5, 6, 5, 5.5], ['Elisa', 7, 8, 7.5, 8], ['Felipe', 5, 6.5, 6, 7]].forEach((row, i) => {
        const r = i + 2; row.forEach((v, j) => put(SD.addr(r - 1, j), v, j ? { z: '0.0', ha: 'center' } : undefined));
        put('F' + r, '=MÉDIA(B' + r + ':E' + r + ')', { z: '0.0', ha: 'center', b: true });
        put('G' + r, '=SE(F' + r + '>=6;"Aprovado";"Recuperação")', { ha: 'center' });
      });
      put('A9', 'Média da turma', { b: true }); ['B', 'C', 'D', 'E', 'F'].forEach(c => put(c + '9', '=MÉDIA(' + c + '2:' + c + '7)', { z: '0.0', ha: 'center', b: true, bd: { t: 'thin' } }));
      put('A10', 'Aprovados', { b: true }); put('G10', '=CONT.SE(G2:G7;"Aprovado")', { ha: 'center', b: true });
      s.colW = { 0: 140, 6: 120 }; s.freeze = { r: 1, c: 0 };
      s.charts.push({ id: 'g1', sheetId: s.id, tipo: 'colunas', range: 'A1:E7', x: 20, y: 290, w: 620, h: 300, titulo: 'Notas por bimestre' });
    } else if (id === 'vendas') {
      w.name = 'Vendas por mês'; s.name = 'Vendas';
      ['Mês', 'Produto A', 'Produto B', 'Produto C', 'Total'].forEach((t, i) => put(SD.addr(0, i), t, Object.assign({}, H, { ha: 'center' })));
      const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      meses.forEach((m, i) => {
        const r = i + 2; put('A' + r, m);
        [1200, 900, 600].forEach((b, j) => put(SD.addr(r - 1, j + 1), Math.round(b * (1 + 0.08 * i + Math.sin(i + j) * 0.12)), R));
        put('E' + r, '=SOMA(B' + r + ':D' + r + ')', Object.assign({ b: true }, R));
      });
      put('A14', 'Total', T); ['B', 'C', 'D', 'E'].forEach(c => put(c + '14', '=SOMA(' + c + '2:' + c + '13)', Object.assign({}, R, T)));
      s.colW = { 1: 110, 2: 110, 3: 110, 4: 120 }; s.freeze = { r: 1, c: 1 };
      s.charts.push({ id: 'g1', sheetId: s.id, tipo: 'linhas', range: 'A1:D13', x: 600, y: 0, w: 520, h: 320, titulo: 'Vendas por mês' });
    } else if (id === 'compras') {
      w.name = 'Lista de compras'; s.name = 'Compras';
      ['Item', 'Quantidade', 'Preço unitário', 'Total', 'Comprado?'].forEach((t, i) => put(SD.addr(0, i), t, Object.assign({}, H, { ha: 'center' })));
      [['Arroz 5 kg', 1, 27.9], ['Feijão 1 kg', 2, 8.49], ['Café 500 g', 1, 18.9], ['Leite 1 L', 6, 4.79], ['Pão de forma', 2, 8.5], ['Frutas', 1, 25], ['Sabão em pó', 1, 21.9]].forEach((it, i) => {
        const r = i + 2; put('A' + r, it[0]); put('B' + r, it[1], { ha: 'center' }); put('C' + r, it[2], R); put('D' + r, '=B' + r + '*C' + r, R); put('E' + r, 'não', { ha: 'center' });
      });
      put('C10', 'Total geral', T); put('D10', '=SOMA(D2:D8)', Object.assign({}, R, T));
      put('C11', 'Falta comprar'); put('D11', '=SOMASE(E2:E8;"não";D2:D8)', R);
      s.colW = { 0: 180, 1: 100, 2: 120, 3: 120, 4: 100 };
    }
    return w;
  }
  function dlgModelos() {
    const d = dialogo({ titulo: 'Novo a partir de modelo', corpo: `<div class="formatos">${Object.keys(MODELOS).map(k => `<label><input type="radio" name="mod" value="${k}" ${k === 'orcamento' ? 'checked' : ''}><span><b>${esc(MODELOS[k].nome)}</b><small>${esc(MODELOS[k].desc)}</small></span></label>`).join('')}</div>`, botoes: [{ t: 'Cancelar' }, { t: 'Criar', pri: true, acao: () => { const id = $('input[name=mod]:checked', d).value; seguroDescartar(() => carregar(montarModelo(id), { novo: true })); } }] });
  }

  /* ======================================================================
     Arquivos: novo, abrir, salvar
     ====================================================================== */
  function seguroDescartar(fn) {
    if (!sujo) { fn(); return; }
    dialogo({ titulo: 'Alterações não salvas', corpo: `<p>“${esc(wb.name)}” tem alterações que ainda não foram salvas em arquivo.</p>`, botoes: [{ t: 'Cancelar' }, { t: 'Descartar', perigo: true, acao: fn }, { t: 'Salvar antes', pri: true, acao: () => { salvar().then(ok => { if (ok) fn(); }); } }] });
  }
  function cmdNovo() { seguroDescartar(() => carregar(SD.newWorkbook(), { novo: true })); }
  function carregar(novo, op) {
    op = op || {};
    wb = novo; fileHandle = op.handle || null; sujo = false; salvoEm = op.salvo ? new Date() : null; recuperado = !!op.recuperado;
    U.limpar(); V.clip = null;
    SD.F.recalc(wb);
    G.setWorkbook(wb);
    renderAbas(); $('#docNome').value = wb.name; estadoDoc(); atualizar();
    if (op.recuperado) marcarSujo();
    limparRecuperacao(op.recuperado);
  }
  function abrirArquivo() { seguroDescartar(() => { const i = $('#arquivo'); i.value = ''; i.click(); }); }
  async function abrirArquivoObj(f) {
    toast('Abrindo ' + f.name + '…');
    try {
      const novo = await SD.IO.abrir(f);
      carregar(novo, { salvo: false });
      salvoEm = null; estadoDoc();
      toast('“' + f.name + '” aberto.');
      if (NS && NS.notificar) NS.notificar({ titulo: 'Planilha aberta', texto: f.name, tipo: 'info' });
    } catch (e) {
      console.error(e);
      dialogo({ titulo: 'Não consegui abrir o arquivo', corpo: `<p>O arquivo <b>${esc(f.name)}</b> não pôde ser lido.</p><p style="color:var(--text-dim)">${esc(e.message || String(e))}</p><p style="color:var(--text-dim)">O Stardust abre XLSX, XLSM, XLSB, XLS, ODS e CSV. Arquivos protegidos por senha não são suportados.</p>` });
    }
  }
  const EXT = { xlsx: 'xlsx', xlsm: 'xlsm', xlsb: 'xlsb', xls: 'xls', ods: 'ods', csv: 'csv', csvv: 'csv', pdf: 'pdf', jpg: 'jpg' };
  const PLANILHA = ['xlsx', 'xlsm', 'xlsb', 'xls', 'ods'];
  async function salvar() {
    if (fileHandle && PLANILHA.includes(wb.format)) {
      try { const blob = await SD.IO.gerar(wb, wb.format); const w = await fileHandle.createWritable(); await w.write(blob); await w.close(); marcarSalvo(); toast('Salvo em ' + fileHandle.name + '.'); return true; }
      catch (e) { console.warn(e); }
    }
    return dlgSalvarComo(PLANILHA.includes(wb.format) ? wb.format : 'xlsx');
  }
  function marcarSalvo() { sujo = false; salvoEm = new Date(); recuperado = false; estadoDoc(); limparRecuperacao(true); }
  function dlgSalvarComo(fmt0) {
    return new Promise(res => {
      fmt0 = fmt0 || (PLANILHA.includes(wb.format) ? wb.format : 'xlsx');
      const F = SD.IO.FORMATOS;
      const corpo = `<div class="campo"><label for="scNome">Nome do arquivo</label><input class="in" id="scNome" value="${esc(wb.name)}"></div>
        <div class="formatos">${F.map(f => `<label><input type="radio" name="fmt" value="${f.id}" ${f.id === fmt0 ? 'checked' : ''}><span><b><span class="ext">.${f.ext}</span>${esc(f.nome)}</b><small>${esc(f.nota)}</small></span></label>`).join('')}</div>
        <div id="scOpPdf" class="linha" hidden><div class="seg" id="scOri"><button data-o="retrato" aria-pressed="true">Retrato</button><button data-o="paisagem" aria-pressed="false">Paisagem</button></div><label class="chk"><input type="checkbox" id="scAjustar" checked> Caber na largura da página</label><label class="chk"><input type="checkbox" id="scGrade" checked> Linhas de grade</label><label class="chk"><input type="checkbox" id="scTodas"> Todas as planilhas</label></div>
        <div id="scOpJpg" class="linha" hidden><label class="chk"><input type="checkbox" id="scGradeJ" checked> Linhas de grade</label><span style="color:var(--text-faint);font-size:12px">A imagem mostra a planilha aberta inteira, com os gráficos.</span></div>`;
      let feito = false;
      const d = dialogo({
        titulo: 'Salvar como', larga: true, corpo, botoes: [{ t: 'Cancelar', acao: () => { if (!feito) res(false); } }, {
          t: 'Salvar', pri: true, manter: true, acao: () => {
            const fmt = $('input[name=fmt]:checked', d).value;
            const nome = ($('#scNome', d).value.trim() || 'Planilha').replace(/[\\/:*?"<>|]+/g, '_');
            const opts = { orientacao: $('#scOri [aria-pressed=true]', d).dataset.o, ajustar: $('#scAjustar', d).checked, grade: fmt === 'jpg' ? $('#scGradeJ', d).checked : $('#scGrade', d).checked, todas: $('#scTodas', d).checked };
            feito = true; d.fechar();
            gravar(fmt, nome, opts).then(res);
            return false;
          }
        }]
      });
      const mostrar = () => { const f = $('input[name=fmt]:checked', d).value; $('#scOpPdf', d).hidden = f !== 'pdf'; $('#scOpJpg', d).hidden = f !== 'jpg'; };
      $$('input[name=fmt]', d).forEach(i => i.onchange = mostrar); mostrar();
      $$('#scOri button', d).forEach(b => b.onclick = () => $$('#scOri button', d).forEach(x => x.setAttribute('aria-pressed', x === b)));
      $('#scNome', d).addEventListener('keydown', e => { if (e.key === 'Enter') $('footer .pri', d).click(); });
    });
  }
  async function gravar(fmt, nome, opts) {
    toast('Gerando o arquivo…');
    try {
      if (G.editando()) G.commitEdit();
      const blob = await SD.IO.gerar(wb, fmt, opts);
      const ext = EXT[fmt];
      const arquivo = nome + '.' + ext;
      let handle = null;
      if (window.showSaveFilePicker) {
        try {
          const f = SD.IO.FORMATOS.find(x => x.id === fmt);
          handle = await window.showSaveFilePicker({ suggestedName: arquivo, types: [{ description: f.nome, accept: { [f.mime.split(';')[0]]: ['.' + ext] } }] });
          const w = await handle.createWritable(); await w.write(blob); await w.close();
        } catch (e) { if (e && e.name === 'AbortError') { toast('Cancelado.'); return false; } handle = null; baixar(blob, arquivo); }
      } else baixar(blob, arquivo);
      if (PLANILHA.includes(fmt)) {
        wb.format = fmt; wb.name = nome; $('#docNome').value = nome; fileHandle = handle;
        marcarSalvo();
        toast('Salvo como ' + arquivo + (fmt === 'xls' || fmt === 'xlsb' || fmt === 'ods' ? ' (cores e gráficos ficam só no XLSX).' : '.'));
      } else toast('Exportado: ' + arquivo);
      if (NS && NS.notificar) NS.notificar({ titulo: PLANILHA.includes(fmt) ? 'Planilha salva' : 'Arquivo exportado', texto: arquivo, tipo: 'sucesso' });
      return true;
    } catch (e) {
      console.error(e);
      toast('Não foi possível salvar: ' + (e.message || e), true);
      return false;
    }
  }
  function baixar(blob, nome) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  async function imprimir() {
    toast('Preparando a impressão…');
    try {
      const blob = await SD.IO.gerar(wb, 'pdf', { orientacao: 'retrato', ajustar: true, grade: true });
      const url = URL.createObjectURL(blob);
      const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'; fr.src = url;
      document.body.appendChild(fr);
      fr.onload = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { window.open(url, '_blank'); } setTimeout(() => { fr.remove(); URL.revokeObjectURL(url); }, 120000); };
    } catch (e) { toast('Não foi possível imprimir: ' + (e.message || e), true); }
  }

  /* ---------- recuperação (cópia automática no navegador) ---------- */
  const REC_KEY = 'stardust.recuperacao';
  let recT = null;
  function agendarRecuperacao() { clearTimeout(recT); recT = setTimeout(() => { try { const j = JSON.stringify({ quando: Date.now(), wb: SD.wbToJSON(wb) }); if (j.length < 4.5e6) localStorage.setItem(REC_KEY, j); } catch (e) { /* cheio ou bloqueado */ } }, 2500); }
  function limparRecuperacao(sempre) { if (sempre !== false) { try { localStorage.removeItem(REC_KEY); } catch (e) { /* ignora */ } } }
  function verificarRecuperacao() {
    let o = null; try { o = JSON.parse(localStorage.getItem(REC_KEY) || 'null'); } catch (e) { o = null; }
    if (!o || !o.wb) return;
    const qd = new Date(o.quando).toLocaleString('pt-BR');
    dialogo({ titulo: 'Recuperar planilha?', corpo: `<p>Encontrei uma cópia de <b>${esc(o.wb.name || 'Planilha')}</b> que não foi salva em arquivo (${esc(qd)}).</p><p style="color:var(--text-dim)">Ela foi guardada automaticamente neste navegador.</p>`, botoes: [{ t: 'Descartar', acao: () => limparRecuperacao(true) }, { t: 'Recuperar', pri: true, acao: () => { const w = SD.wbFromJSON(o.wb); carregar(w, { recuperado: true }); toast('Planilha recuperada. Lembre de salvar em arquivo.'); } }] });
  }

  /* ======================================================================
     Aparência (ponte do Nebulosa Workspace)
     ====================================================================== */
  const temaEscuro = () => { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches; };
  function alternarModo() {
    const novo = temaEscuro() ? 'light' : 'dark';
    if (NS && NS.setMode) NS.setMode(novo); else { document.documentElement.setAttribute('data-theme', novo); try { localStorage.setItem('stardust.modo', novo); } catch (e) { /* ignora */ } }
  }
  function aparencia() { if (NS && NS.openDialog) NS.openDialog(); else alternarModo(); }
  function retema() { G.lerTema(); G.redrawCharts(); G.render(); }

  /* ======================================================================
     Avisos
     ====================================================================== */
  function toast(m, erro) { const t = $('#toast'); t.textContent = m; t.classList.toggle('erro', !!erro); t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), erro ? 5200 : 2800); }

  /* ======================================================================
     Ligações dos botões e partida
     ====================================================================== */
  const CMDS = {
    desfazer: () => U.desfazer(), refazer: () => U.refazer(), abrir: abrirArquivo, salvar: () => salvar(), aparencia,
    negrito: () => alternar('b', 'Negrito'), italico: () => alternar('i', 'Itálico'), sublinhado: () => alternar('u', 'Sublinhado'), tachado: () => alternar('st', 'Tachado'),
    corTexto: () => aplicarEstilo({ fc: corTexto }, 'Cor do texto'), corFundo: () => aplicarEstilo({ bg: corFundo }, 'Cor de preenchimento'),
    corTextoMenu: el => menuCor('texto', el), corFundoMenu: el => menuCor('fundo', el), bordasMenu: el => menuBordas(el),
    alEsq: () => aplicarEstilo(s => ({ ha: s.ha === 'left' ? undefined : 'left' }), 'Alinhar'), alCen: () => aplicarEstilo(s => ({ ha: s.ha === 'center' ? undefined : 'center' }), 'Centralizar'), alDir: () => aplicarEstilo(s => ({ ha: s.ha === 'right' ? undefined : 'right' }), 'Alinhar'),
    alTopo: () => aplicarEstilo({ va: 'top' }, 'Alinhar'), alMeio: () => aplicarEstilo({ va: 'middle' }, 'Alinhar'), alBase: () => aplicarEstilo({ va: undefined }, 'Alinhar'),
    quebra: () => { alternar('wrap', 'Quebrar texto'); autoAjustarLinhas(linhasSel(), true); }, mesclar,
    moeda: () => aplicarEstilo({ z: FORMATOS_NUM[2].z }, 'Moeda'), porcento: () => aplicarEstilo({ z: '0%' }, 'Porcentagem'), milhar: () => aplicarEstilo({ z: '#,##0.00' }, 'Separador de milhar'),
    decMais: () => casasDecimais(1), decMenos: () => casasDecimais(-1),
    autosoma: () => autoSoma('SUM'), autosomaMenu: el => menuAutoSoma(el), ordemAZ: () => ordenarRapido(false), ordemZA: () => ordenarRapido(true), filtro: alternarFiltro,
    graficoMenu: el => menuGraficoNovo(el), painel: () => $('#painel').hidden ? abrirPainel() : fecharPainel(),
    zoomMais: () => setZoom((sheet().zoom || 1) + 0.1), zoomMenos: () => setZoom((sheet().zoom || 1) - 0.1)
  };
  function ligar() {
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-cmd]');
      if (b && CMDS[b.dataset.cmd]) { e.preventDefault(); const keep = /Menu$/.test(b.dataset.cmd); if (!keep) fecharPop(); CMDS[b.dataset.cmd](b); if (!keep && !/salvar|abrir|aparencia/.test(b.dataset.cmd)) G.focus(); return; }
      const m = e.target.closest('#menus [data-menu]');
      if (m) { abrirMenu(m); return; }
      if (!e.target.closest('#menupop')) fecharPop();
    });
    $('#menus').addEventListener('mouseover', e => { const m = e.target.closest('[data-menu]'); if (m && $$('#menus [aria-expanded="true"]').length && m.getAttribute('aria-expanded') !== 'true') abrirMenu(m); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#menupop').hidden) { fecharPop(); G.focus(); } });
    // ícones dos botões do topo
    $$('[data-i]').forEach(i => { i.outerHTML = ic(i.dataset.i); });
    $('[data-cmd="desfazer"]').innerHTML = ic('desfazer'); $('[data-cmd="refazer"]').innerHTML = ic('refazer');
    $('#novaAba').innerHTML = ic('mais'); $('#fecharPainel').innerHTML = ic('fechar');
    $('[data-cmd="zoomMenos"]').innerHTML = ic('menos'); $('[data-cmd="zoomMais"]').innerHTML = ic('mais');
    $('#btnMarca').onclick = dlgSobre;
    $('#docNome').addEventListener('change', e => { const v = e.target.value.trim() || 'Planilha sem nome'; e.target.value = v; if (v !== wb.name) { wb.name = v; marcarSujo(); } });
    $('#docNome').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); G.focus(); } });
    // caixa de nome
    const cn = $('#caixaNome');
    cn.addEventListener('focus', () => cn.select());
    cn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); irPara(cn.value); } if (e.key === 'Escape') { onSelection(); G.focus(); } });
    // barra de fórmulas
    const fb = $('#fbar');
    fb.addEventListener('focus', () => { if (!G.editando()) { G.startEdit(undefined, 'editar'); fb.focus(); } });
    fb.addEventListener('input', () => { if (!G.editando()) G.startEdit(undefined, 'editar'); const ed = G.editor; ed.value = fb.value; ed.setSelectionRange(fb.selectionStart, fb.selectionEnd); ed.dispatchEvent(new Event('input')); fb.focus(); ajustarFbar(); });
    const syncCaret = () => { if (G.editando()) { V.pointing = null; G.editor.setSelectionRange(fb.selectionStart, fb.selectionEnd); onEditText(fb.value); } };
    fb.addEventListener('click', syncCaret); fb.addEventListener('keyup', e => { if (!['Enter', 'Tab', 'Escape'].includes(e.key)) syncCaret(); });
    fb.addEventListener('keydown', e => {
      if (teclaAutocompletar(e)) return;
      if (e.key === 'Enter' && !e.altKey) { e.preventDefault(); if (e.ctrlKey) { const { r, c } = V.edit; const t = fb.value; G.cancelEdit(); entrarTexto(r, c, t, true); } else G.commitEdit([1, 0]); G.focus(); }
      else if (e.key === 'Enter' && e.altKey) { e.preventDefault(); const p = fb.selectionStart; fb.value = fb.value.slice(0, p) + '\n' + fb.value.slice(fb.selectionEnd); fb.setSelectionRange(p + 1, p + 1); fb.dispatchEvent(new Event('input')); }
      else if (e.key === 'Tab') { e.preventDefault(); G.commitEdit([0, 1]); G.focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); G.cancelEdit(); G.focus(); }
      else if (e.key === 'F4') { e.preventDefault(); alternarAbsoluta(); }
    });
    $('#btnFx').onclick = () => abrirPainel('funcoes');
    // painel
    $$('.pabas [role=tab]').forEach(b => b.onclick = () => { painelAba = b.dataset.aba; renderPainel(); });
    $('#fecharPainel').onclick = fecharPainel;
    // abas das planilhas
    $('#novaAba').onclick = novaPlanilha;
    const abas = $('#abas');
    abas.addEventListener('click', e => { const a = e.target.closest('.aba'); if (a && !a.querySelector('input')) { const i = +a.dataset.i; if (G.editando() && G.valorEditor()[0] === '=') { G.setSheet(i); renderAbas(); } else irPlanilha(i); } });
    abas.addEventListener('dblclick', e => { const a = e.target.closest('.aba'); if (a) renomearPlanilha(+a.dataset.i); });
    abas.addEventListener('contextmenu', e => { const a = e.target.closest('.aba'); if (a) { e.preventDefault(); menuAba(e, +a.dataset.i); } });
    let arrasto = null;
    abas.addEventListener('dragstart', e => { const a = e.target.closest('.aba'); if (!a) return; arrasto = +a.dataset.i; a.classList.add('arrastando'); e.dataTransfer.effectAllowed = 'move'; });
    abas.addEventListener('dragover', e => { if (arrasto !== null) e.preventDefault(); });
    abas.addEventListener('drop', e => { const a = e.target.closest('.aba'); if (a && arrasto !== null) { e.preventDefault(); moverPlanilha(arrasto, +a.dataset.i); } arrasto = null; });
    abas.addEventListener('dragend', () => { arrasto = null; $$('.aba').forEach(x => x.classList.remove('arrastando')); });
    // zoom
    $('#zoom').addEventListener('input', e => setZoom(+e.target.value / 100));
    // arquivo
    $('#arquivo').addEventListener('change', e => { const f = e.target.files[0]; if (f) abrirArquivoObj(f); });
    // arrastar arquivo para a janela
    document.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    document.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) { e.preventDefault(); seguroDescartar(() => abrirArquivoObj(f)); } });
    // aviso ao fechar sozinho (fora do Workspace)
    window.addEventListener('beforeunload', e => { if (sujo && !(NS && NS.inWorkspace)) { e.preventDefault(); e.returnValue = ''; } });
    // tema
    new MutationObserver(retema).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-skin'] });
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', retema);
    if (!NS) { try { const m = localStorage.getItem('stardust.modo'); if (m) document.documentElement.setAttribute('data-theme', m); } catch (e) { /* ignora */ } }
    window.addEventListener('keydown', e => { if (e.key === 'F9') { e.preventDefault(); atualizar(); } });
    // teclas com o foco fora da grade (ex.: depois de clicar num gráfico ou num botão): manda para a grade
    document.addEventListener('keydown', e => {
      if (e.defaultPrevented || e.target === G.editor || !$('#modal').hidden || !$('#menupop').hidden) return;
      const t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (t && t.closest && (t.closest('#painel') || t.closest('#abas')) && !(e.ctrlKey || e.metaKey)) return;
      G.onKeyDown(e);
      if (!G.editando()) G.focus();
    });
  }

  function iniciar() {
    montarFerramentas();
    G.mount($('#grade'));
    ligar();
    G.setWorkbook(wb);
    renderAbas(); estadoDoc(); atualizar();
    G.focus();
    // nova janela do Workspace com #modelo=orcamento abre o modelo
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('modelo') && MODELOS[h.get('modelo')]) carregar(montarModelo(h.get('modelo')), { novo: true });
    else setTimeout(verificarRecuperacao, 300);
  }

  SD.app = {
    entrarTexto, limparConteudo, setColWidth, setRowHeight, autoAjustarColunas, autoAjustarLinhas, preencher, preencherAteFim, colar,
    menuContexto, menuFiltro, menuGrafico, excluirGrafico, menuLista, antesGrafico, depoisGrafico, painelGrafico: () => abrirPainel('grafico'),
    onSelection, onEditText, onSheetChange: renderAbas, onZoom, onPick, onChartSelect: id => { onSelection(); if (id && !$('#painel').hidden) { painelAba = 'grafico'; renderPainel(); } else if (!id && painelAba === 'grafico') renderPainel(); },
    teclaGlobal, teclaAutocompletar, status, toast,
    sujo: () => sujo, get wb() { return wb; }, carregar, montarModelo, U, atualizar, gravar
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
