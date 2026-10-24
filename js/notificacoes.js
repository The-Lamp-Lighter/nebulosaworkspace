/* ==========================================================================
   Nebulosa Workspace — js/notificacoes.js
   O canto de notificações (canto superior direito) e o sino com o histórico.

   Quem usa:
     - o próprio Workspace (lembrete de doação, avisos gerais);
     - os programas, pela ponte: NebulosaSkin.notificar({...}) dentro do programa
       vira uma mensagem { nebulosa:'notify' } que o js/workspace.js entrega aqui.

   NebulosaNotificacoes.mostrar({
     titulo, texto,              textos (sem HTML)
     icone,                      HTML do ícone (opcional)
     origem,                     nome exibido em cima do título (ex.: "LêPraMim")
     app,                        id do programa (para o histórico e o clique)
     tipo,                       'info' | 'sucesso' | 'aviso' | 'erro'
     cor,                        cor ou degradê da faixa lateral (opcional)
     acoes: [{ texto, primaria, acao }],
     duracao,                    milissegundos na tela (0 = até fechar); padrão 9 s
     guardar,                    false = não entra no histórico do sino
     naTela,                     false = só entra no histórico (sem aparecer no canto)
     aoClicar                    clique no corpo da notificação
   })
   ========================================================================== */
(function () {
  'use strict';
  const CHAVE = 'nebulosa.notificacoes';
  const MAX_HIST = 40, MAX_TELA = 3;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CORES = { sucesso: '#6fe0a5', aviso: '#FF9C54', erro: '#ff7d73' };

  let historico = [];
  try { historico = JSON.parse(localStorage.getItem(CHAVE) || '[]'); if (!Array.isArray(historico)) historico = []; } catch (e) { historico = []; }
  const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(historico.slice(0, MAX_HIST))); } catch (e) { /* sem armazenamento */ } };
  const ouvintes = [];
  const avisar = () => ouvintes.forEach(f => { try { f(); } catch (e) { /* ignora */ } });
  let resolverIcone = () => '';

  function quando(ts) {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'agora';
    if (m < 60) return 'há ' + m + ' min';
    const h = Math.round(m / 60);
    if (h < 24) return 'há ' + h + ' h';
    return 'há ' + Math.round(h / 24) + ' d';
  }

  function caixa() {
    let c = document.getElementById('notifs');
    if (!c) {
      c = document.createElement('div');
      c.id = 'notifs';
      c.setAttribute('role', 'region');
      c.setAttribute('aria-label', 'Notificações');
      c.setAttribute('aria-live', 'polite');
      document.body.appendChild(c);
    }
    return c;
  }

  function fechar(el) {
    if (!el || el.dataset.saindo) return;
    el.dataset.saindo = '1';
    if (reduce) { el.remove(); return; }
    el.classList.add('sai');
    setTimeout(() => el.remove(), 320);
  }

  function mostrar(op) {
    op = op || {};
    const tipo = Object.prototype.hasOwnProperty.call(CORES, op.tipo) ? op.tipo : 'info';
    const item = {
      id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      t: Date.now(), titulo: String(op.titulo || '').slice(0, 90), texto: String(op.texto || '').slice(0, 320),
      origem: op.origem ? String(op.origem).slice(0, 40) : '', app: op.app || '', tipo, lida: false
    };
    if (op.guardar !== false) { historico.unshift(item); historico = historico.slice(0, MAX_HIST); salvar(); avisar(); }
    if (op.naTela === false) return { fechar() {}, item };

    const el = document.createElement('div');
    el.className = 'ntf ntf-' + tipo;
    el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    el.style.setProperty('--ntf-c', op.cor || CORES[tipo] || 'linear-gradient(180deg,var(--p),var(--o))');
    const icone = op.icone || resolverIcone(item.app) || '';
    el.innerHTML =
      (icone ? '<span class="ntf-ic">' + icone + '</span>' : '') +
      '<div class="ntf-c">' +
        '<small>' + esc(item.origem || 'Nebulosa Workspace') + ' · agora</small>' +
        (item.titulo ? '<b>' + esc(item.titulo) + '</b>' : '') +
        (item.texto ? '<p>' + esc(item.texto) + '</p>' : '') +
        ((op.acoes && op.acoes.length) ? '<div class="ntf-a">' + op.acoes.map((a, i) =>
          '<button type="button" class="chip' + (a.primaria ? ' prim' : '') + '" data-ac="' + i + '">' + esc(a.texto) + '</button>').join('') + '</div>' : '') +
      '</div>' +
      '<button type="button" class="ntf-x" aria-label="Fechar notificação" title="Fechar">×</button>';
    const duracao = op.duracao === undefined ? 9000 : op.duracao;
    if (duracao > 0) {
      const barra = document.createElement('i');
      barra.className = 'ntf-t';
      barra.style.animationDuration = duracao + 'ms';
      barra.addEventListener('animationend', () => fechar(el));
      el.appendChild(barra);
    }
    el.addEventListener('click', e => {
      if (e.target.closest('.ntf-x')) { fechar(el); return; }
      const b = e.target.closest('[data-ac]');
      if (b) { const a = op.acoes[+b.dataset.ac]; fechar(el); if (a && a.acao) a.acao(); return; }
      if (op.aoClicar) { fechar(el); op.aoClicar(); }
    });
    if (op.aoClicar) el.classList.add('clicavel');

    const c = caixa();
    c.appendChild(el);
    const vivos = [...c.querySelectorAll('.ntf:not(.sai)')];
    vivos.slice(0, Math.max(0, vivos.length - MAX_TELA)).forEach(fechar);
    return { fechar: () => fechar(el), item };
  }

  /** Lista do sino (histórico). */
  function renderizarLista(alvo) {
    if (!historico.length) {
      alvo.innerHTML = '<p class="nvazio">Nenhuma notificação por enquanto.<br>Os avisos dos programas aparecem aqui.</p>';
      return;
    }
    alvo.innerHTML = historico.map(n =>
      '<div class="nitem' + (n.lida ? '' : ' nova') + '" data-app="' + esc(n.app) + '">' +
        '<span class="ntf-ic">' + (resolverIcone(n.app) || '') + '</span>' +
        '<div><small>' + esc(n.origem || 'Nebulosa Workspace') + ' · ' + quando(n.t) + '</small>' +
        (n.titulo ? '<b>' + esc(n.titulo) + '</b>' : '') + (n.texto ? '<p>' + esc(n.texto) + '</p>' : '') + '</div>' +
      '</div>').join('');
  }

  window.NebulosaNotificacoes = {
    mostrar,
    renderizarLista,
    naoLidas: () => historico.filter(n => !n.lida).length,
    fecharTodas() { document.querySelectorAll('#notifs .ntf').forEach(fechar); },
    marcarLidas() { if (historico.some(n => !n.lida)) { historico.forEach(n => { n.lida = true; }); salvar(); avisar(); } },
    limpar() { historico = []; salvar(); avisar(); },
    aoMudar(f) { ouvintes.push(f); },
    configurar(o) { if (o && typeof o.icone === 'function') resolverIcone = o.icone; }
  };
})();
