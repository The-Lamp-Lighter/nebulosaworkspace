/* ==========================================================================
   Utilidades — Tarefas e notas (js/tarefas.js)
   Quadro "A fazer / Fazendo / Feito" e notas soltas. Fica guardado neste
   navegador (entra no Backup do Workspace) e pode ser exportado em .json.
   ========================================================================== */
(function () {
  'use strict';
  const { $, $$, esc, T, ICO } = UT;
  const COLS = [['fazer', 'A fazer', '#A778FF'], ['fazendo', 'Fazendo', '#FF9C54'], ['feito', 'Feito', '#4CC38A']];
  const TAGS = ['', '#A778FF', '#FF9C54', '#4CC38A', '#4FA3FF', '#F25F8A', '#F5C451'];
  const NCOR = ['#FDFCC2', '#FFE0C9', '#E4D9FF', '#D5F1E6', '#DCE3FF', '#FFD9E4'];
  let D = carregar(), el, aba = UT.ler('tarefas.aba', 'quadro'), novaCor = '', editando = null;
  const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function carregar() {
    const d = UT.ler('tarefas', null) || {};
    return { cartoes: Array.isArray(d.cartoes) ? d.cartoes : [], notas: Array.isArray(d.notas) ? d.notas : [] };
  }
  let gT = null;
  function guardar() { clearTimeout(gT); gT = setTimeout(() => UT.guardar('tarefas', D), 250); }
  // outra aba do navegador mexeu: recarrega
  window.addEventListener('storage', e => { if (e.key === 'nebulosa.utilidades.tarefas' && el) { D = carregar(); render(); } });

  function montar(v) {
    el = v;
    v.innerHTML = `<div class="cab"><div><h1>Tarefas e notas</h1><p>Organize o que precisa fazer e guarde anotações rápidas. Fica guardado neste navegador e entra no Backup do Workspace.</p></div>
      <div class="linha"><button class="btn" id="taImp">Importar</button><button class="btn" id="taExp">${ICO.baixar}<span>Exportar (.json)</span></button></div></div>
      <div class="abas" role="tablist"><button role="tab" data-aba="quadro">Quadro de tarefas</button><button role="tab" data-aba="notas">Notas</button></div>
      <div id="taQuadro">
        <form class="nova" id="taNova" autocomplete="off">
          <input class="in" id="taTit" placeholder="Nova tarefa… (Enter para adicionar)" aria-label="Nova tarefa" maxlength="300">
          <input class="in" id="taPrazo" type="date" style="width:auto" aria-label="Prazo (opcional)" title="Prazo (opcional)">
          <span class="cores-tag" id="taCores">${TAGS.map(c => `<button type="button" data-cor="${c}" style="background:${c || 'var(--sup2)'}" title="${c ? esc(T('Cor da etiqueta')) : esc(T('Sem cor'))}" aria-label="${c ? esc(T('Cor da etiqueta')) : esc(T('Sem cor'))}"></button>`).join('')}</span>
          <button class="btn pri" type="submit">${ICO.mais}<span>Adicionar</span></button>
        </form>
        <div class="kanban" id="taKanban">${COLS.map(c => `<div class="col" data-col="${c[0]}"><h2><span class="dot" style="background:${c[2]}"></span>${esc(c[1])} <i data-n></i>${c[0] === 'feito' ? `<span class="espaco"></span><button class="btn peq so" id="taLimpaFeitas" style="font-size:12px">Limpar</button>` : ''}</h2><div class="cards" style="display:flex;flex-direction:column;gap:8px;min-height:40px"></div></div>`).join('')}</div>
        <p class="dica">Arraste os cartões entre as colunas, ou use as setas. Tarefas com prazo vencido ficam em vermelho.</p>
      </div>
      <div id="taNotas" hidden>
        <div class="linha" style="margin-bottom:14px"><button class="btn pri" id="taNovaNota">${ICO.mais}<span>Nova nota</span></button><input class="in" id="taBusca" placeholder="Procurar nas notas…" style="max-width:320px" aria-label="Procurar nas notas"></div>
        <div class="notas" id="taListaNotas"></div>
      </div>`;
    $('.abas', v).addEventListener('click', e => { const b = e.target.closest('[data-aba]'); if (b) { aba = b.dataset.aba; UT.guardar('tarefas.aba', aba); render(); } });
    $('#taNova', v).addEventListener('submit', e => {
      e.preventDefault();
      const t = $('#taTit', v).value.trim(); if (!t) return;
      D.cartoes.push({ id: id(), t, n: '', col: 'fazer', cor: novaCor, prazo: $('#taPrazo', v).value || '', criado: Date.now() });
      $('#taTit', v).value = ''; $('#taPrazo', v).value = '';
      guardar(); render(); $('#taTit', v).focus();
    });
    $('#taCores', v).addEventListener('click', e => { const b = e.target.closest('[data-cor]'); if (b) { novaCor = b.dataset.cor; marcarCor(); } });
    $('#taKanban', v).addEventListener('click', cliqueCartao);
    $('#taKanban', v).addEventListener('submit', e => { e.preventDefault(); salvarEdicao(e.target); });
    $('#taKanban', v).addEventListener('keydown', e => { if (e.key === 'Escape' && editando) { editando = null; render(); } });
    $('#taLimpaFeitas', v).addEventListener('click', () => {
      const n = D.cartoes.filter(c => c.col === 'feito').length; if (!n) return;
      if (!confirm(n === 1 ? T('Apagar a tarefa feita?') : T('Apagar as {1} tarefas feitas?', n))) return;
      D.cartoes = D.cartoes.filter(c => c.col !== 'feito'); guardar(); render();
    });
    arrastar($('#taKanban', v));
    $('#taNovaNota', v).addEventListener('click', () => { const n = { id: id(), t: '', x: '', cor: NCOR[D.notas.length % NCOR.length], fixa: false, at: Date.now() }; D.notas.unshift(n); guardar(); render(); const i = $('[data-nota="' + n.id + '"] input', el); if (i) i.focus(); });
    $('#taBusca', v).addEventListener('input', renderNotas);
    const LN = $('#taListaNotas', v);
    LN.addEventListener('input', e => { const c = e.target.closest('[data-nota]'); if (!c) return; const n = D.notas.find(x => x.id === c.dataset.nota); if (!n) return; n.t = $('input', c).value; n.x = $('textarea', c).value; n.at = Date.now(); guardar(); });
    LN.addEventListener('click', e => {
      const c = e.target.closest('[data-nota]'); if (!c) return; const n = D.notas.find(x => x.id === c.dataset.nota); if (!n) return;
      if (e.target.closest('[data-fixar]')) { n.fixa = !n.fixa; guardar(); renderNotas(); }
      if (e.target.closest('[data-ncor]')) { n.cor = NCOR[(NCOR.indexOf(n.cor) + 1) % NCOR.length]; guardar(); c.style.background = n.cor; }
      if (e.target.closest('[data-napagar]')) { if ((n.t || n.x) && !confirm(T('Apagar esta nota?'))) return; D.notas = D.notas.filter(x => x !== n); guardar(); renderNotas(); }
    });
    $('#taExp', v).addEventListener('click', () => UT.baixar(new Blob([JSON.stringify({ app: 'nebulosa-utilidades-tarefas', versao: 1, exportado: new Date().toISOString(), cartoes: D.cartoes, notas: D.notas }, null, 2)], { type: 'application/json' }), T('tarefas-e-notas') + '.json'));
    $('#taImp', v).addEventListener('click', () => UT.escolher('.json,application/json').then(async fs => {
      if (!fs[0]) return;
      try {
        const j = JSON.parse(await fs[0].text());
        if (!j || (!Array.isArray(j.cartoes) && !Array.isArray(j.notas))) throw new Error('formato');
        const ids = new Set(D.cartoes.map(c => c.id).concat(D.notas.map(n => n.id)));
        const limpaC = c => ({ id: ids.has(c.id) || !c.id ? id() : String(c.id), t: String(c.t || '').slice(0, 300), n: String(c.n || '').slice(0, 5000), col: COLS.some(k => k[0] === c.col) ? c.col : 'fazer', cor: TAGS.includes(c.cor) ? c.cor : '', prazo: /^\d{4}-\d{2}-\d{2}$/.test(c.prazo || '') ? c.prazo : '', criado: +c.criado || Date.now() });
        const limpaN = n => ({ id: ids.has(n.id) || !n.id ? id() : String(n.id), t: String(n.t || '').slice(0, 300), x: String(n.x || '').slice(0, 20000), cor: NCOR.includes(n.cor) ? n.cor : NCOR[0], fixa: !!n.fixa, at: +n.at || Date.now() });
        const nc = (j.cartoes || []).filter(c => c && c.t).map(limpaC), nn = (j.notas || []).filter(n => n && (n.t || n.x)).map(limpaN);
        D.cartoes = D.cartoes.concat(nc); D.notas = D.notas.concat(nn); guardar(); render();
        UT.aviso(T('Importado: {1} e {2}.', UT.Q(nc.length, '{1} tarefa', '{1} tarefas'), UT.Q(nn.length, '{1} nota', '{1} notas')));
      } catch (e) { UT.aviso(T('Esse arquivo não é uma exportação de Tarefas e notas.'), true); }
    }));
    render();
  }
  function marcarCor() { $$('#taCores [data-cor]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cor === novaCor))); }
  function hoje() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dataCurta(s) { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString(UT.local(), { day: 'numeric', month: 'short' }); }
  function cartaoHtml(c) {
    if (editando === c.id) {
      return `<form class="tcard" data-id="${c.id}" data-editar style="cursor:default"><input class="in" name="t" value="${esc(c.t)}" maxlength="300" aria-label="Título" required>
        <textarea class="in" name="n" rows="3" placeholder="Detalhes (opcional)" style="margin-top:6px;min-height:70px">${esc(c.n)}</textarea>
        <div class="linha" style="margin-top:6px"><input class="in" name="prazo" type="date" value="${esc(c.prazo || '')}" style="width:auto" aria-label="Prazo">
        <select class="in" name="cor" style="width:auto" aria-label="Cor da etiqueta">${TAGS.map(t => `<option value="${t}" ${t === c.cor ? 'selected' : ''}>${t ? esc(corNome(t)) : esc(T('Sem cor'))}</option>`).join('')}</select></div>
        <div class="linha fim" style="margin-top:8px"><button class="btn peq so" type="button" data-cancelar>Cancelar</button><button class="btn peq pri" type="submit">Salvar</button></div></form>`;
    }
    const i = COLS.findIndex(k => k[0] === c.col), atr = c.prazo && c.col !== 'feito' && c.prazo < hoje();
    return `<div class="tcard${c.col === 'feito' ? ' feita' : ''}" data-id="${c.id}" style="--tc:${c.cor || 'var(--line2)'}" tabindex="0">
      <div class="tt">${esc(c.t)}</div>${c.n ? `<div class="tn">${esc(c.n)}</div>` : ''}
      <div class="tm">${c.prazo ? `<span class="${atr ? 'atr' : ''}">${esc((atr ? T('venceu') + ' ' : '') + dataCurta(c.prazo))}</span>` : ''}
        <span class="tb"><button data-mover="-1" title="Coluna anterior" aria-label="Coluna anterior" ${i > 0 ? '' : 'disabled'}>${ICO.esq}</button><button data-mover="1" title="Próxima coluna" aria-label="Próxima coluna" ${i < 2 ? '' : 'disabled'}>${ICO.dir}</button>
        <button data-editar-c title="Editar" aria-label="Editar">${ICO.lapis}</button><button data-apagar title="Apagar" aria-label="Apagar">${ICO.lixo}</button></span></div></div>`;
  }
  function corNome(c) { return T({ '#A778FF': 'Roxo', '#FF9C54': 'Laranja', '#4CC38A': 'Verde', '#4FA3FF': 'Azul', '#F25F8A': 'Rosa', '#F5C451': 'Amarelo' }[c] || 'Cor'); }
  function render() {
    if (!el) return;
    $$('.abas [data-aba]', el).forEach(b => b.setAttribute('aria-selected', String(b.dataset.aba === aba)));
    $('#taQuadro', el).hidden = aba !== 'quadro'; $('#taNotas', el).hidden = aba !== 'notas';
    marcarCor();
    COLS.forEach(([k]) => {
      const col = $('[data-col="' + k + '"]', el), cs = D.cartoes.filter(c => c.col === k);
      $('[data-n]', col).textContent = cs.length;
      $('.cards', col).innerHTML = cs.length ? cs.map(cartaoHtml).join('') : `<p class="vazio" style="padding:14px 6px;margin:0;font-size:13px">${esc(T(k === 'feito' ? 'Nada concluído ainda.' : 'Nenhuma tarefa aqui.'))}</p>`;
    });
    renderNotas();
  }
  function renderNotas() {
    const q = ($('#taBusca', el).value || '').trim().toLocaleLowerCase();
    const L = D.notas.filter(n => !q || (n.t + ' ' + n.x).toLocaleLowerCase().includes(q)).sort((a, b) => (b.fixa - a.fixa) || (b.at - a.at));
    $('#taListaNotas', el).innerHTML = L.length ? L.map(n => `<div class="nota" data-nota="${n.id}" style="background:${n.cor}"><input value="${esc(n.t)}" placeholder="Título" aria-label="Título da nota" maxlength="300"><textarea placeholder="Escreva aqui…" aria-label="Texto da nota">${esc(n.x)}</textarea>
      <div class="nb"><span>${esc(new Date(n.at).toLocaleDateString(UT.local(), { day: 'numeric', month: 'short', year: 'numeric' }))}</span><span class="espaco"></span>
      <button data-fixar title="${esc(T(n.fixa ? 'Desafixar' : 'Fixar no topo'))}" aria-label="${esc(T(n.fixa ? 'Desafixar' : 'Fixar no topo'))}" style="${n.fixa ? 'background:rgba(0,0,0,.18)' : ''}">${ICO.fixar}</button><button data-ncor title="Trocar a cor" aria-label="Trocar a cor">●</button><button data-napagar title="Apagar" aria-label="Apagar">${ICO.lixo}</button></div></div>`).join('')
      : `<p class="vazio">${esc(T(q ? 'Nenhuma nota encontrada.' : 'Nenhuma nota ainda. Clique em “Nova nota”.'))}</p>`;
  }
  function cliqueCartao(e) {
    const card = e.target.closest('[data-id]'); if (!card) return;
    const c = D.cartoes.find(x => x.id === card.dataset.id); if (!c) return;
    if (e.target.closest('[data-cancelar]')) { editando = null; render(); return; }
    const mv = e.target.closest('[data-mover]');
    if (mv) { const i = COLS.findIndex(k => k[0] === c.col) + +mv.dataset.mover; if (COLS[i]) { mover(c, COLS[i][0]); render(); } return; }
    if (e.target.closest('[data-editar-c]')) { editando = c.id; render(); const i = $('[data-editar] input', el); if (i) i.focus(); return; }
    if (e.target.closest('[data-apagar]')) { D.cartoes = D.cartoes.filter(x => x !== c); guardar(); render(); }
  }
  function mover(c, col, antesDe) {
    D.cartoes = D.cartoes.filter(x => x !== c);
    c.col = col;
    if (col === 'feito' && !c.feitoEm) c.feitoEm = Date.now();
    if (col !== 'feito') delete c.feitoEm;
    const k = antesDe ? D.cartoes.indexOf(antesDe) : -1;
    if (k >= 0) D.cartoes.splice(k, 0, c); else D.cartoes.push(c);
    guardar();
  }
  function salvarEdicao(f) {
    const c = D.cartoes.find(x => x.id === f.dataset.id); if (!c) return;
    const t = f.t.value.trim(); if (!t) return;
    c.t = t; c.n = f.n.value.trim(); c.prazo = f.prazo.value || ''; c.cor = f.cor.value;
    editando = null; guardar(); render();
  }
  // arrastar com mouse, dedo ou caneta (pointer events)
  function arrastar(raiz) {
    let a = null;
    raiz.addEventListener('pointerdown', e => {
      const card = e.target.closest('.tcard:not([data-editar])');
      if (!card || e.button > 0 || e.target.closest('button,input,textarea,select')) return;
      a = { card, x0: e.clientX, y0: e.clientY, id: e.pointerId, ativo: false };
    });
    raiz.addEventListener('pointermove', e => {
      if (!a || e.pointerId !== a.id) return;
      if (!a.ativo) {
        if (Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 6) return;
        a.ativo = true; raiz.setPointerCapture(e.pointerId);
        const r = a.card.getBoundingClientRect();
        a.fant = a.card.cloneNode(true); a.dx = a.x0 - r.left; a.dy = a.y0 - r.top;
        Object.assign(a.fant.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', zIndex: 300, pointerEvents: 'none', boxShadow: 'var(--shadow2)', transform: 'rotate(2deg)', opacity: '.95' });
        document.body.appendChild(a.fant); a.card.classList.add('arr');
      }
      a.fant.style.left = e.clientX - a.dx + 'px'; a.fant.style.top = e.clientY - a.dy + 'px';
      $$('.col', raiz).forEach(c => c.classList.remove('sobre'));
      const col = alvo(e); if (col) col.classList.add('sobre');
    });
    const fim = e => {
      if (!a) return;
      const b = a; a = null;
      if (!b.ativo) return;
      b.fant.remove(); b.card.classList.remove('arr');
      $$('.col', raiz).forEach(c => c.classList.remove('sobre'));
      const col = e.type === 'pointerup' ? alvo(e) : null; if (!col) return;
      const c = D.cartoes.find(x => x.id === b.card.dataset.id); if (!c) return;
      const irmaos = $$('.tcard', col).filter(x => x !== b.card);
      const antes = irmaos.find(x => { const r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      mover(c, col.dataset.col, antes ? D.cartoes.find(x => x.id === antes.dataset.id) : null);
      render();
    };
    raiz.addEventListener('pointerup', fim); raiz.addEventListener('pointercancel', fim);
    function alvo(e) { const x = document.elementFromPoint(e.clientX, e.clientY); return x && x.closest ? x.closest('.col') : null; }
  }
  UT.registrar('tarefas', {
    montar,
    abrir() { render(); },
    conteudos: () => D.cartoes.length ? [{ id: 'lista', rotulo: 'Lista de tarefas (texto)', detalhe: UT.Q(D.cartoes.length, '{1} tarefa', '{1} tarefas'), tipo: 'texto', nome: T('tarefas') + '.txt',
      obter: () => COLS.map(([k, n]) => { const cs = D.cartoes.filter(c => c.col === k); return cs.length ? T(n) + '\n' + cs.map(c => (k === 'feito' ? '[x] ' : '[ ] ') + c.t + (c.prazo ? ' (' + dataCurta(c.prazo) + ')' : '') + (c.n ? '\n    ' + c.n.replace(/\n/g, '\n    ') : '')).join('\n') : ''; }).filter(Boolean).join('\n\n') + '\n' }] : []
  });
  if (UT.N && UT.N.idiomas) UT.N.idiomas.aoMudar(() => { if (el) render(); });
})();
