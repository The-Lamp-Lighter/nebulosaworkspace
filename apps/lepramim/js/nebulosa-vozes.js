/* ============================================================
   LêPraMim — nebulosa-vozes.js   [Nebulosa] (versão 0.5 do Workspace)
   - Botão "Baixar Vozes": volta, quando quiser, à opção
     "Baixar a voz …?" de cada voz neural Piper (Cadu, Faber, Jeff,
     Edresson), mostra quais já estão guardadas e permite usá-las.
   - Botão "Trocar Voz": abre as Configurações (como já existiam),
     já na parte "Voz da leitura".
   - Botão "Ajuda": menu com Manual do usuário, Como usar, Atalhos do
     teclado, Termos de uso, Privacidade, Créditos e licenças e Sobre o
     LêPraMim. O manual e as páginas legais abrem aqui mesmo, numa janela.
   A pergunta automática "Baixar a voz do Cadu?" da primeira leitura
   continua igual (js/piper.js).
   ============================================================ */
(function () {
  'use strict';
  const { $, el } = LPM.util;
  const ui = LPM.ui;
  const SITE = 'https://nebulosaworkspace.com.br/';

  /* ---------------- Baixar Vozes ---------------- */
  const nome = v => v.name.split(' — ')[0];
  const generoTxt = g => g === 'feminina' || g === 'f' ? 'feminina' : g === 'masculina' || g === 'm' ? 'masculina' : '';

  async function abrirBaixar() {
    const corpo = el('div', { class: 'nbvozes' });
    const lista = el('div', { class: 'nbvozes-lista' }, el('p', { class: 'nota', text: 'Procurando as vozes neurais…' }));
    corpo.appendChild(el('p', { text: 'As vozes neurais Piper leem com som natural, sem internet depois de baixadas. Cada voz é baixada uma única vez e fica guardada neste navegador; o texto dos seus livros nunca sai do computador.' }));
    corpo.appendChild(lista);
    const janela = ui.modal({ titulo: 'Baixar vozes', corpo, largo: true, botoes: [
      { texto: 'Trocar voz…', acao: () => setTimeout(trocarVoz, 30) },
      { texto: 'Fechar', classe: 'primario' }
    ] });

    let vozes = [];
    try {
      if (LPM.voz && LPM.voz.carregar) await LPM.voz.carregar(); // atualiza a lista de vozes do programa (inclui as Piper)
      else if (LPM.piper) await LPM.piper.detectar();
      vozes = LPM.piper ? LPM.piper.vozes.slice() : [];
    } catch (e) { vozes = []; }
    lista.textContent = '';
    if (!vozes.length) {
      lista.appendChild(el('p', { class: 'nota', text: LPM.util.viaServidor()
        ? 'Nenhuma voz neural está disponível neste navegador (ele precisa aceitar WebAssembly e Web Workers). As vozes do sistema continuam funcionando em Trocar voz.'
        : 'As vozes neurais precisam do LêPraMim aberto pelo site (ou pelo Iniciar-LePraMim). Abrindo o arquivo direto do computador, use as vozes do sistema em Trocar voz.' }));
      return;
    }
    const atual = LPM.voz && LPM.voz.escolhida ? LPM.voz.escolhida() : null;
    const desenhar = () => {
      lista.textContent = '';
      vozes.forEach(v => {
        const pronta = LPM.piper.liberada(v);
        const emUso = atual && atual.voiceURI === v.voiceURI;
        const situacao = v.origem === 'local' ? 'instalada no computador' : pronta ? 'guardada neste navegador' : 'ainda não baixada · cerca de ' + (v.mb || 60) + ' MB';
        const linha = el('div', { class: 'nbvoz' + (pronta ? ' pronta' : '') }, [
          el('div', { class: 'nbvoz-nome' }, [el('b', { text: nome(v) }), el('small', { text: [window.NebulosaIdiomas ? NebulosaIdiomas.t(generoTxt(v.genero)) : generoTxt(v.genero), situacao].filter(Boolean).join(' · ') })]),
          pronta ? null : el('button', { class: 'bt primario', type: 'button', onclick: async () => {
            const ok = await LPM.piper.garantir(v, { perguntar: true });
            if (ok) { if (LPM.voz.aoMudar) LPM.voz.aoMudar(); desenhar(); }
          } }, 'Baixar'),
          el('button', { class: 'bt' + (emUso ? ' ativo' : ''), type: 'button', disabled: emUso, onclick: async () => {
            if (!LPM.piper.liberada(v)) { const ok = await LPM.piper.garantir(v, { perguntar: true }); if (!ok) return; }
            LPM.dados.cfg.voz = v.voiceURI; LPM.dados.salvarCfg();
            if (LPM.leitor && LPM.leitor.reaplicarVoz) LPM.leitor.reaplicarVoz();
            ui.aviso('Voz ' + nome(v) + ' escolhida para a leitura.', null, 3500);
            janela.fechar();
          } }, emUso ? 'Em uso' : 'Usar esta voz')
        ]);
        lista.appendChild(linha);
      });
    };
    desenhar();
  }

  /* ---------------- Trocar Voz ---------------- */
  function trocarVoz() {
    LPM.configuracoes.abrir();
    setTimeout(() => {
      const s = $('#cfgVoz');
      if (!s) return;
      const secao = s.closest('.secao') || s;
      try { secao.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { secao.scrollIntoView(); }
      s.focus();
    }, 60);
  }

  /* ---------------- Ajuda: Manual do usuário, Atalhos, Termos de uso, Privacidade, Créditos e licenças ---------------- */
  function abrirSite(k) {
    const N = window.NebulosaSkin;
    if (N && N.abrirAjuda) return N.abrirAjuda(k); // o conteúdo abre aqui mesmo, numa janela
    const P = { manual: 'manuais/lepramim.html', termos: 'legal/termos.html', privacidade: 'legal/privacidade.html', creditos: 'legal/creditos.html' };
    window.open(SITE + (P[k] || P.manual), '_blank');
  }
  function atalhos() {
    const L = [['Espaço', 'Ler ou pausar'], ['← →', 'Página anterior e seguinte (no audiobook, 10 segundos)'], ['M', 'Marcar o ponto atual'], ['Esc', 'Fechar janela']];
    const corpo = el('div', { class: 'nbatalhos' }, L.map(([k, t]) => el('div', null, [el('kbd', { text: k }), el('span', { text: t })])));
    ui.modal({ titulo: 'Atalhos do teclado', corpo, botoes: [{ texto: 'Fechar', classe: 'primario' }] });
  }
  let menuAberto = null;
  function fecharMenu() { if (menuAberto) { menuAberto.remove(); menuAberto = null; document.removeEventListener('mousedown', foraDoMenu, true); } }
  function foraDoMenu(e) { if (menuAberto && !menuAberto.contains(e.target) && !e.target.closest('#btAjuda')) fecharMenu(); }
  function menuAjuda(botao) {
    if (menuAberto) { fecharMenu(); return; }
    const item = (t, d, f) => el('button', { type: 'button', role: 'menuitem', onclick: () => { fecharMenu(); f(); } }, [el('b', { text: t }), d ? el('small', { text: d }) : null]);
    const m = el('div', { class: 'nbmenu', role: 'menu' }, [
      item('Manual do usuário', '', () => abrirSite('manual')),
      item('Como usar', 'Guia rápido dentro do programa', () => LPM.ajuda.tutorial()),
      item('Atalhos do teclado', '', atalhos),
      item('Termos de uso', '', () => abrirSite('termos')),
      item('Privacidade', '', () => abrirSite('privacidade')),
      item('Créditos e licenças', '', () => abrirSite('creditos')),
      item('🌐 Idioma', 'Português (Brasil), English, Español', () => abrirSite('idioma')), // [Nebulosa] idiomas 0.6
      item('Sobre o LêPraMim', 'Versão, autores e equipe', () => LPM.ajuda.creditos())
    ]);
    const r = botao.getBoundingClientRect();
    m.style.top = Math.round(r.bottom + 6) + 'px';
    m.style.left = Math.max(8, Math.min(innerWidth - 290, Math.round(r.left))) + 'px';
    document.body.appendChild(m);
    menuAberto = m;
    document.addEventListener('mousedown', foraDoMenu, true);
    const f = m.querySelector('button'); if (f) f.focus();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuAberto) { e.stopPropagation(); fecharMenu(); } }, true);

  LPM.nebulosaVozes = { abrirBaixar, trocarVoz, menuAjuda, abrirSite, atalhos };
})();
