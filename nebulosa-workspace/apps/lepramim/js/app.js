/* ============================================================
   LêPraMim — app.js
   Inicialização: liga os botões da barra superior, os atalhos
   de teclado, o "arrastar e soltar", o modo aplicativo (PWA) e
   a pergunta "Deseja continuar de onde parou?".
   ============================================================ */
(function () {
  'use strict';
  const { $, $$, formatarTempo } = LPM.util;
  const dados = LPM.dados;
  const ui = LPM.ui;

  function escolherArquivos() { $('#entradaArquivo').click(); }

  /** Barra superior, abas e arquivo. */
  function ligarInterface() {
    $('#btAbrir').addEventListener('click', escolherArquivos);
    $('#btAbrirVazio').addEventListener('click', escolherArquivos);
    $('#entradaArquivo').addEventListener('change', e => {
      const arquivos = Array.from(e.target.files);
      e.target.value = ''; // permite escolher o mesmo arquivo de novo
      LPM.biblioteca.importar(arquivos);
    });
    $('#btBiblioteca').addEventListener('click', () => LPM.biblioteca.mostrar());
    $('#btInicio').addEventListener('click', () => LPM.biblioteca.mostrar());
    $('#btEstatisticas').addEventListener('click', () => LPM.estat.abrir());
    $('#btConfig').addEventListener('click', () => LPM.configuracoes.abrir());
    $('#btAjuda').addEventListener('click', () => LPM.ajuda.tutorial());
    $('#btTema').addEventListener('click', () => ui.alternarTema());
    $('#btSono').addEventListener('click', () => LPM.sono.abrir());
    $('#btMenu').addEventListener('click', () => ui.abrirLateral());
    $('#veuLateral').addEventListener('click', () => ui.fecharLateral());
    $$('.abas button').forEach(b => b.addEventListener('click', () => ui.aba(b.dataset.aba)));

    // Busca: no leitor pesquisa o livro; fora dele filtra a estante
    const buscar = LPM.util.adiar(() => LPM.busca.executar($('#campoBusca').value), 300);
    $('#campoBusca').addEventListener('input', buscar);
    $('#campoBusca').addEventListener('keydown', e => { if (e.key === 'Enter') LPM.busca.executar(e.target.value); });
    $('#filtroBiblioteca').addEventListener('input', e => LPM.biblioteca.filtrar(e.target.value));
  }

  /** Arrastar arquivos para a janela. */
  function ligarArrastar() {
    let nivel = 0;
    const temArquivos = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0;
    window.addEventListener('dragenter', e => { if (temArquivos(e)) { nivel++; $('#soltar').hidden = false; } });
    window.addEventListener('dragleave', e => { if (temArquivos(e)) { nivel = Math.max(0, nivel - 1); if (!nivel) $('#soltar').hidden = true; } });
    window.addEventListener('dragover', e => { if (temArquivos(e)) e.preventDefault(); });
    window.addEventListener('drop', e => {
      if (!temArquivos(e)) return;
      e.preventDefault();
      nivel = 0;
      $('#soltar').hidden = true;
      LPM.biblioteca.importar(e.dataTransfer.files);
    });
  }

  /** Atalhos de teclado. */
  function ligarTeclado() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { if (!ui.fecharModalDoTopo()) ui.fecharLateral(); return; }
      if (ui.temModal() || e.ctrlKey || e.altKey || e.metaKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
      const noLeitor = ui.contexto === 'leitor' && ui.visao === 'leitor';
      const noAudio = ui.contexto === 'audio';

      if (e.key === ' ' || e.code === 'Space') {
        if (tag === 'button') return; // deixa o botão focado funcionar normalmente
        e.preventDefault();
        if (noLeitor) LPM.leitor.tocar(); else if (noAudio) LPM.audio.alternar();
      } else if (e.key === 'ArrowLeft') {
        if (noLeitor) LPM.leitor.irParaPagina(LPM.leitor.pagina - 1); else if (noAudio) LPM.audio.pular(-10);
      } else if (e.key === 'ArrowRight') {
        if (noLeitor) LPM.leitor.irParaPagina(LPM.leitor.pagina + 1); else if (noAudio) LPM.audio.pular(10);
      } else if (e.key === 'm' || e.key === 'M') {
        LPM.marcadores.adicionar();
      }
    });
  }

  /** Modo aplicativo (PWA): funciona offline e abre arquivos pelo "Abrir com". */
  function ligarPwa() {
    if (LPM.util.viaServidor() && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(e => console.warn('Modo offline do aplicativo indisponível:', e));
    }
    if ('launchQueue' in window) {
      window.launchQueue.setConsumer(async params => {
        if (!params.files || !params.files.length) return;
        const arquivos = [];
        for (const h of params.files) { try { arquivos.push(await h.getFile()); } catch (e) { /* ignora */ } }
        LPM.biblioteca.importar(arquivos);
      });
    }
  }

  /** "Deseja continuar de onde parou?" */
  async function oferecerRetomada() {
    const id = dados.ler('ultimo', null);
    if (!id) return;
    const meta = await dados.bd.meta(id).catch(() => null);
    if (!meta) return;
    const prog = dados.progresso(id);
    if (meta.tipo === 'audio') {
      if (!(prog.tempo > 5)) return;
      if (await ui.perguntar(meta.titulo, `Você deseja continuar a partir de ${formatarTempo(prog.tempo, true)}?`, 'Continuar', 'Agora não')) {
        LPM.biblioteca.abrir(id, { continuar: true });
      }
    } else {
      const onde = `página ${(prog.pagina || 0) + 1}` + (prog.pct ? ` (${Math.round(prog.pct * 100)}%)` : '');
      if (await ui.perguntar('Deseja continuar de onde parou?', `"${meta.titulo}" — ${onde}.`, 'Continuar', 'Agora não')) {
        LPM.biblioteca.abrir(id);
      }
    }
  }

  async function iniciar() {
    ui.aplicarTema();
    ligarInterface();
    ligarArrastar();
    ligarTeclado();
    LPM.leitor.ligar();
    LPM.audio.ligar();
    LPM.leitor.aplicarAparencia();
    LPM.voz.carregar();
    ligarPwa();
    ui.vazio($('#abaBusca'), 'Abra um livro e use o campo de busca no alto da janela.');
    await LPM.biblioteca.mostrar();
    LPM.estat.renderHistorico();
    oferecerRetomada();
  }

  // Erros inesperados aparecem para o usuário em vez de falhar em silêncio
  window.addEventListener('unhandledrejection', e => {
    console.error(e.reason);
    ui.aviso('Algo deu errado: ' + ((e.reason && e.reason.message) || e.reason), 'erro');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  LPM.app = { iniciar };
})();
