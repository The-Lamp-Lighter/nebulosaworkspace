/* ============================================================
   LêPraMim — ajuda.js
   Tutorial simples e objetivo, e a janela de créditos com o
   logotipo, o nome do programa e o nome do autor.
   ============================================================ */
(function () {
  'use strict';
  const { el } = LPM.util;
  const ui = LPM.ui;
  const cfg = LPM.config;
  const ajuda = {};

  /** Tutorial de uso. */
  ajuda.tutorial = function () {
    const corpo = el('div', { class: 'tutorial', html: `
      <h3>Primeiros passos</h3>
      <ol>
        <li>Clique em <b>Abrir arquivo</b> (ou arraste arquivos para a janela) e escolha um livro, documento ou audiobook.</li>
        <li>O arquivo entra na <b>Biblioteca</b> e abre na tela. Da próxima vez, basta clicar na capa.</li>
        <li>Aperte o botão azul <b>▶</b> na barra de baixo para ouvir. Aperte de novo para pausar.</li>
        <li>Feche quando quiser: o LêPraMim guarda o ponto exato e pergunta se você deseja continuar de onde parou.</li>
      </ol>

      <h3>Lendo um livro em voz alta</h3>
      <ol>
        <li>Clique em qualquer frase para a leitura começar dali.</li>
        <li>Use as setas da barra para ir ao trecho ou à página anterior e seguinte, ou digite o número da página.</li>
        <li>Escolha o que a voz lê: só a página atual, a página e as seguintes, o capítulo atual ou o livro inteiro.</li>
        <li>Ajuste a velocidade na barra. Voz, volume, tom e o destaque das palavras ficam em <b>Configurações</b>.</li>
        <li>No painel da esquerda estão os <b>Capítulos</b> detectados, os seus <b>Marcadores</b>, o <b>Histórico</b> e os resultados da <b>Busca</b>.</li>
        <li>Em PDFs, o botão <b>Página original</b> mostra a página como ela é no arquivo.</li>
      </ol>

      <h3>Ouvindo um audiobook</h3>
      <ol>
        <li>Abra um arquivo MP3, M4A, M4B, AAC, OGG, WAV ou FLAC.</li>
        <li>Use tocar, pausar, parar, voltar e avançar 10 segundos, e escolha a velocidade de 0,5× a 3×.</li>
        <li>Se o arquivo tiver capítulos, eles aparecem no painel da esquerda.</li>
      </ol>

      <h3>Recursos extras</h3>
      <ol>
        <li><b>Marcadores:</b> botão <b>Marcar</b> guarda o ponto atual; na aba Marcadores você volta a ele ou o exclui.</li>
        <li><b>Temporizador do sono:</b> botão <b>Sono</b>, na barra de baixo, pausa a leitura depois do tempo escolhido.</li>
        <li><b>Modo híbrido:</b> na Biblioteca, abra o menu <b>⋯</b> do livro e vincule o audiobook correspondente. No leitor, o botão <b>Modo híbrido</b> toca o áudio e acompanha o texto. A sincronia é aproximada; use <b>Acertar sincronia</b> para corrigir.</li>
        <li><b>Gerar audiobook:</b> transforma o livro em arquivos de áudio. O navegador pede para compartilhar a tela com o áudio do sistema, e a gravação leva o tempo da leitura.</li>
        <li><b>Voz neural Cadu:</b> depois do <b>Baixar-Bibliotecas</b>, abra pelo <b>Iniciar-LePraMim</b> e a voz "Cadu — Piper" já estará escolhida em Configurações. Funciona sem internet; a primeira frase demora alguns segundos.</li>
        <li><b>PDF digitalizado:</b> ao adicionar um PDF sem texto, o LêPraMim oferece o reconhecimento por OCR.</li>
        <li><b>Limpeza automática:</b> cabeçalhos, rodapés, números de página, sumários e propagandas não são lidos. Em Configurações você liga e desliga cada item.</li>
      </ol>

      <h3>Atalhos do teclado</h3>
      <p><kbd>Espaço</kbd> ler ou pausar &nbsp; <kbd>←</kbd> <kbd>→</kbd> página anterior e seguinte (no audiobook, 10 segundos) &nbsp; <kbd>M</kbd> marcar &nbsp; <kbd>Esc</kbd> fechar janela</p>

      <h3>Sobre a instalação</h3>
      <p>Abrindo pelo arquivo <b>Iniciar-LePraMim</b>, todos os recursos ficam disponíveis e o navegador oferece <b>Instalar aplicativo</b>. A voz neural, o OCR e a exportação em MP3 pedem que você execute o <b>Baixar-Bibliotecas</b> uma única vez, com internet. Depois disso, tudo funciona offline.</p>
    ` });
    ui.modal({ titulo: 'Como usar o LêPraMim', corpo, largo: true, botoes: [
      { texto: 'Créditos', acao: () => ajuda.creditos() },
      { texto: 'Fechar', classe: 'primario' }
    ] });
  };

  /** Créditos: logotipo, nome do programa e autor. */
  ajuda.creditos = function () {
    const corpo = el('div', { class: 'creditos' }, [
      el('img', { src: 'assets/logo-vertical.png', alt: cfg.NOME + ' — ' + cfg.SLOGAN }),
      el('p', { class: 'autor', text: cfg.NOME }),
      el('p', { text: 'Versão ' + cfg.VERSAO }),
      el('p', { text: 'Autor: ' + cfg.AUTOR }),
      el('p', { class: 'nota', text: 'Finalidade: ' + cfg.FINALIDADE.toLowerCase() + '.' }),
      el('p', { class: 'nota', text: 'Leitor de ebooks, documentos e audiobooks que funciona sem internet. Nenhum conteúdo sai deste computador.' }),
      el('p', { class: 'nota', text: 'Componentes de terceiros: PDF.js (Mozilla, Apache 2.0). Opcionais: Piper e ONNX Runtime (MIT), voz Cadu (CC0), Tesseract.js (Apache 2.0), Mammoth.js (BSD) e lamejs (LGPL).' })
    ]);
    ui.modal({ titulo: 'Créditos', corpo, botoes: [{ texto: 'Fechar', classe: 'primario' }] });
  };

  LPM.ajuda = ajuda;
})();
