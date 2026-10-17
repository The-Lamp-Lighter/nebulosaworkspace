/* ============================================================
   LêPraMim — config.js
   Constantes globais do aplicativo. Todos os módulos ficam
   pendurados no objeto global LPM (um "namespace"), o que permite
   organizar o código em arquivos separados e ainda assim abrir o
   app com duplo clique no index.html (sem servidor).
   ============================================================ */
window.LPM = window.LPM || {};

LPM.config = {
  NOME: 'LêPraMim',
  SLOGAN: 'Software de Leitura e Audiolivros para Computador',
  // Para corrigir o nome nos créditos, altere somente esta linha:
  AUTOR: 'Márcio Willians Barreto de Andrade',
  VERSAO: '1.1.0',
  FINALIDADE: 'Uso doméstico',

  // Tamanho aproximado de uma "página" em formatos sem paginação (EPUB, DOCX, TXT…)
  CARACTERES_POR_PAGINA: 1800,

  // Velocidades do player de audiobooks
  VELOCIDADES_AUDIO: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3],

  // Opções do temporizador do sono (minutos)
  SONO_MINUTOS: [15, 30, 45, 60],

  // Extensões aceitas
  EXT_TEXTO: ['pdf', 'epub', 'docx', 'txt', 'rtf', 'html', 'htm', 'xhtml'],
  EXT_AUDIO: ['mp3', 'm4a', 'm4b', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac'],

  // Emoji de capa por formato (usado quando o arquivo não tem capa)
  EMOJI: { pdf: '📕', epub: '📗', docx: '📘', txt: '📙', rtf: '📒', html: '📓', audio: '🎧' },

  // Onde ficam as bibliotecas de terceiros (todas locais, nada de CDN)
  LIBS: {
    pdf: 'libs/pdfjs/pdf.js',
    pdfWorker: 'libs/pdfjs/pdf.worker.js',
    pdfCmaps: 'libs/pdfjs/cmaps/',
    pdfFontes: 'libs/pdfjs/standard_fonts/',
    pdfWasm: 'libs/pdfjs/wasm/',
    tesseract: 'libs/tesseract/tesseract.min.js',
    tesseractWorker: 'libs/tesseract/worker.min.js',
    tesseractCore: 'libs/tesseract/core/',
    tesseractLang: 'libs/tesseract/lang',
    mammoth: 'libs/mammoth/mammoth.browser.min.js',
    lame: 'libs/lamejs/lame.min.js'
  },

  // Configurações padrão do usuário (gravadas no LocalStorage)
  PADRAO: {
    tema: 'claro',
    voz: '',              // voiceURI da última voz utilizada
    genero: 'todas',      // todas | feminina | masculina
    vozesOnline: false,   // vozes online enviam o texto ao provedor — desligado por padrão
    velocidade: 1,
    volume: 1,
    tom: 1,
    modo: 'continuo',     // pagina | continuo | capitulo | livro
    karaokePalavra: true,
    karaokeFrase: true,
    karaokeParagrafo: true,
    tamanhoFonte: 19,
    velocidadeAudio: 1,
    volumeAudio: 1,
    idiomaOcr: 'por',
    limpeza: {
      ativa: true,
      cabecalhos: true,   // cabeçalhos e rodapés repetidos
      numeros: true,      // numeração de páginas
      urls: true,
      copyrights: true,
      isbn: true,
      sumarios: true,     // índices e sumários
      propagandas: true,  // propagandas e assinaturas
      repetidos: true     // créditos e notas repetidos
    }
  }
};
