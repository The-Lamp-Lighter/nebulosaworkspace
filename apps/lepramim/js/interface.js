/* ============================================================
   LêPraMim — interface.js
   Peças de interface reutilizadas por todos os módulos:
   janelas (modais), avisos rápidos, barra de progresso, troca de
   tema, troca de visão (biblioteca / leitor / audiobook) e abas
   do painel lateral.
   ============================================================ */
(function () {
  'use strict';
  const { $, $$, el, icone } = LPM.util;
  const ui = {
    visao: 'biblioteca',   // o que aparece na área central
    contexto: null         // o que a barra inferior controla: 'leitor' | 'audio' | null
  };
  const abertos = [];

  /* ---------------- Modais ---------------- */

  /**
   * Abre uma janela.
   * op = { titulo, corpo (elemento ou texto), botoes:[{texto, classe, acao, manter}], largo, fixo, aoFechar }
   * Retorna { el, corpo, fechar() }
   */
  ui.modal = function (op) {
    const corpo = el('div', { class: 'modal-corpo' });
    if (typeof op.corpo === 'string') corpo.appendChild(el('p', { text: op.corpo }));
    else if (op.corpo) corpo.appendChild(op.corpo);

    const ref = { corpo, fixo: !!op.fixo };
    const fechar = () => {
      const i = abertos.indexOf(ref);
      if (i < 0) return;
      abertos.splice(i, 1);
      fundo.remove();
      if (op.aoFechar) op.aoFechar();
      if (anterior && document.contains(anterior)) anterior.focus();
    };
    ref.fechar = fechar;

    const cab = el('div', { class: 'modal-cab' }, [
      el('h2', { text: op.titulo || '' }),
      op.fixo ? null : el('button', { class: 'bt-icone', title: 'Fechar', 'aria-label': 'Fechar', onclick: fechar }, icone('fechar'))
    ]);
    const rodape = el('div', { class: 'modal-rodape' });
    (op.botoes || []).forEach(b => {
      rodape.appendChild(el('button', {
        class: 'bt ' + (b.classe || ''),
        onclick: () => { if (!b.manter) fechar(); if (b.acao) b.acao(ref); }
      }, b.texto));
    });

    const caixa = el('div', { class: 'modal' + (op.largo ? ' largo' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': op.titulo || '' },
      [cab, corpo, (op.botoes && op.botoes.length) ? rodape : null]);
    const fundo = el('div', { class: 'modal-fundo' }, caixa);
    // clicar fora fecha (exceto janelas "fixas", como a de progresso)
    fundo.addEventListener('mousedown', e => { if (e.target === fundo && !op.fixo) fechar(); });

    const anterior = document.activeElement;
    ref.el = caixa;
    abertos.push(ref);
    $('#modais').appendChild(fundo);
    const foco = rodape.querySelector('.primario') || rodape.querySelector('button') || caixa.querySelector('button');
    if (foco) foco.focus();
    return ref;
  };

  /** Fecha a janela do topo (tecla Esc). Retorna true se fechou alguma. */
  ui.fecharModalDoTopo = function () {
    const ref = abertos[abertos.length - 1];
    if (!ref) return false;
    if (!ref.fixo) ref.fechar();
    return true;
  };

  ui.temModal = () => abertos.length > 0;

  /** Pergunta com dois botões. Resolve true (sim) ou false (não/fechou). */
  ui.perguntar = function (titulo, texto, sim, nao) {
    return new Promise(resolve => {
      let respondeu = false;
      ui.modal({
        titulo, corpo: texto,
        aoFechar: () => { if (!respondeu) resolve(false); },
        botoes: [
          // "manter": a resposta é registrada ANTES de a janela fechar; senão o
          // fechamento seria entendido como "não" e a confirmação nunca valeria.
          { texto: nao || 'Cancelar', manter: true, acao: ref => { respondeu = true; resolve(false); ref.fechar(); } },
          { texto: sim || 'Confirmar', classe: 'primario', manter: true, acao: ref => { respondeu = true; resolve(true); ref.fechar(); } }
        ]
      });
    });
  };

  /** Janela de progresso com botão Cancelar. */
  ui.progresso = function (titulo) {
    const barra = el('div');
    const texto = el('div', { class: 'progresso-texto', text: 'Preparando…' });
    const estado = { cancelado: false };
    const m = ui.modal({
      titulo, fixo: true,
      corpo: el('div', null, [el('div', { class: 'progresso' }, barra), texto]),
      botoes: [{ texto: 'Cancelar', manter: true, acao: () => { estado.cancelado = true; texto.textContent = 'Cancelando…'; } }]
    });
    estado.atualizar = (t, fracao) => {
      if (estado.cancelado) return;
      if (t) texto.textContent = t;
      if (fracao !== undefined) barra.style.width = Math.round(LPM.util.limitar(fracao, 0, 1) * 100) + '%';
    };
    estado.fechar = m.fechar;
    return estado;
  };

  /* ---------------- Avisos rápidos ---------------- */

  ui.aviso = function (texto, tipo, ms) {
    const a = el('div', { class: 'aviso' + (tipo === 'erro' ? ' erro' : ''), text: texto });
    $('#avisos').appendChild(a);
    setTimeout(() => a.remove(), ms || (tipo === 'erro' ? 7000 : 3500));
  };

  /* ---------------- Tema ---------------- */

  ui.aplicarTema = function () {
    const escuro = LPM.dados.cfg.tema === 'escuro';
    document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
    const use = $('#btTema use');
    if (use) use.setAttribute('href', escuro ? '#i-sol' : '#i-lua');
    $('#btTema').title = escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro';
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = escuro ? '#1D2128' : '#2563EB';
  };

  ui.alternarTema = function () {
    LPM.dados.cfg.tema = LPM.dados.cfg.tema === 'escuro' ? 'claro' : 'escuro';
    LPM.dados.salvarCfg();
    ui.aplicarTema();
  };

  /* ---------------- Visões e barra inferior ---------------- */

  /** Mostra 'biblioteca', 'leitor' ou 'audio' na área central. */
  ui.mostrarVisao = function (nome) {
    ui.visao = nome;
    $('#visaoBiblioteca').hidden = nome !== 'biblioteca';
    $('#visaoLeitor').hidden = nome !== 'leitor';
    $('#visaoAudio').hidden = nome !== 'audio';
    $('#btBiblioteca').classList.toggle('ativo', nome === 'biblioteca');
    $('#campoBusca').placeholder = nome === 'leitor' ? 'Buscar no livro' : 'Buscar na biblioteca';
    ui.atualizarBarra();
    ui.fecharLateral();
  };

  /** Define o que a barra inferior controla. */
  ui.definirContexto = function (ctx) {
    ui.contexto = ctx;
    ui.atualizarBarra();
  };

  ui.atualizarBarra = function () {
    const ctx = ui.contexto;
    // Na biblioteca a barra só aparece se houver um audiobook carregado (continua tocando)
    const visivel = ui.visao === 'leitor' || ui.visao === 'audio' || (ui.visao === 'biblioteca' && ctx === 'audio');
    $('#barra').hidden = !visivel;
    $('#controlesLeitor').hidden = ctx !== 'leitor';
    $('#controlesAudio').hidden = ctx !== 'audio';
  };

  /* ---------------- Painel lateral ---------------- */

  const NOMES_ABAS = { capitulos: 'abaCapitulos', marcadores: 'abaMarcadores', historico: 'abaHistorico', busca: 'abaBusca' };

  ui.aba = function (nome) {
    $$('.abas button').forEach(b => {
      const ativa = b.dataset.aba === nome;
      b.classList.toggle('ativa', ativa);
      b.setAttribute('aria-selected', ativa ? 'true' : 'false');
    });
    Object.keys(NOMES_ABAS).forEach(k => { $('#' + NOMES_ABAS[k]).hidden = k !== nome; });
    if (nome === 'historico') LPM.estat.renderHistorico();
  };

  ui.abrirLateral = function () { $('#lateral').classList.add('aberta'); $('#veuLateral').hidden = false; };
  ui.fecharLateral = function () { $('#lateral').classList.remove('aberta'); $('#veuLateral').hidden = true; };

  /** Monta uma lista vazia com mensagem (usada nas abas). */
  ui.vazio = function (alvo, texto) {
    alvo.textContent = '';
    alvo.appendChild(el('div', { class: 'lista-vazia', text: texto }));
  };

  /** Troca o ícone do botão principal (tocar <-> pausar) e liga as "ondas". */
  ui.estadoTocar = function (botao, tocando) {
    botao.classList.toggle('tocando', !!tocando);
    const use = botao.querySelector('use');
    if (use) use.setAttribute('href', tocando ? '#i-pausar' : '#i-tocar');
  };

  LPM.ui = ui;
})();
