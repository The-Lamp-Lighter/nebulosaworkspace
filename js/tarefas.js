/* ==========================================================================
   Nebulosa Workspace — js/tarefas.js  (0.8)
   Tarefas da busca (Alt+K): em vez de só abrir um programa, a busca já leva
   ao que a pessoa quer fazer. É só texto: para incluir uma tarefa, acrescente
   um item aqui (e a tradução em js/idiomas.js).

   Campos:
     t          título (o que aparece na lista)
     s          subtítulo (uma linha explicando)
     kw         palavras para a busca, sem acentos
     app        programa que faz a tarefa (id de js/apps.js)
     arquivo    a busca abre a janela de escolher arquivo (aceita estes tipos)
                e entrega o arquivo ao programa, já aberto
     ferramenta abre esta ferramenta de Utilidades (id/parte opcional)
     acao       ação do Workspace: 'backup', 'restaurar', 'relatar', 'novidades', 'mandar'
   ========================================================================== */
window.NEBULOSA_TAREFAS = [
  { t: 'Converter PDF em Word', s: 'Escolha o PDF: o Typee abre e você salva em .docx', kw: 'converter transformar pdf word docx documento editar', app: 'typee', arquivo: '.pdf' },
  { t: 'Abrir um documento do Word', s: 'Abre .docx, Markdown ou texto no Typee', kw: 'abrir word docx documento texto md markdown txt', app: 'typee', arquivo: '.docx,.md,.markdown,.txt' },
  { t: 'Abrir uma planilha do Excel', s: 'Abre .xlsx, .xls, .ods ou .csv no Stardust', kw: 'abrir planilha excel xlsx xls ods csv libreoffice', app: 'stardust', arquivo: '.xlsx,.xlsm,.xlsb,.xls,.ods,.csv' },
  { t: 'Ouvir um livro ou documento em voz alta', s: 'O LêPraMim lê PDF, EPUB, Word e texto', kw: 'ouvir ler voz alta livro ebook epub pdf docx txt narrar', app: 'lepramim', arquivo: '.pdf,.epub,.docx,.txt,.rtf,.html,.htm' },
  { t: 'Ouvir um audiolivro', s: 'MP3, M4B, M4A, OGG, WAV ou FLAC no LêPraMim', kw: 'audiolivro audiobook mp3 m4b ouvir podcast', app: 'lepramim', arquivo: '.mp3,.m4a,.m4b,.aac,.ogg,.oga,.opus,.wav,.flac' },
  { t: 'Abrir uma partitura', s: 'PDF, imagem, MusicXML ou Guitar Pro no EmCanto', kw: 'partitura musica coral musicxml pdf ouvir cantar', app: 'emcanto', arquivo: '.pdf,.png,.jpg,.jpeg,.tif,.tiff,.musicxml,.mxl,.xml,.gp3,.gp4,.gp5,.emcanto' },
  { t: 'Editar uma foto', s: 'Abre a imagem ou o PSD no Imaginarium', kw: 'editar foto imagem psd recortar ajustar photoshop', app: 'imaginarium', arquivo: 'image/*,.psd,.psb' },
  { t: 'Editar um vídeo', s: 'Abre o Fluxo já com o vídeo na linha do tempo', kw: 'editar video cortar reels tiktok youtube', app: 'fluxo', arquivo: 'video/*' },
  { t: 'Fazer um vídeo de ondas de uma música', s: 'Abre o Fluxo com a música; use a aba Ondas para criar o vídeo', kw: 'ondas audio musica visualizador equalizador barras espectro vibracao particulas video clipe vizzy', app: 'fluxo', arquivo: 'audio/*' },
  { t: 'Converter um arquivo', s: 'Utilidades › Conversor: documentos, planilhas, imagens, áudio e vídeo', kw: 'converter conversor arquivo formato convertio docx pdf xlsx mp3 mp4 png jpg webp epub odt', ferramenta: 'conversor' },
  { t: 'Converter áudio ou vídeo', s: 'Utilidades › Conversor: MP3, WAV, MP4, WebM e outros', kw: 'converter audio video mp3 mp4 wav flac ogg webm mov mkv gif extrair som', ferramenta: 'conversor' },
  { t: 'Abrir um PDF só de imagens para editar', s: 'PDF digitalizado: abre as páginas como imagens no Imaginarium', kw: 'pdf escaneado digitalizado imagens editar paginas imaginarium', app: 'imaginarium', arquivo: '.pdf' },
  { t: 'Juntar PDFs', s: 'Utilidades › PDF: vários arquivos num só', kw: 'juntar unir combinar mesclar pdf', ferramenta: 'pdf/juntar' },
  { t: 'Dividir um PDF', s: 'Utilidades › PDF: separe páginas ou intervalos', kw: 'dividir separar extrair paginas pdf', ferramenta: 'pdf/dividir' },
  { t: 'Girar páginas de um PDF', s: 'Utilidades › PDF: gire uma página ou todas', kw: 'girar rotacionar virar paginas pdf', ferramenta: 'pdf/girar' },
  { t: 'Assinar um PDF', s: 'Utilidades › PDF: desenhe ou escreva a assinatura', kw: 'assinar assinatura rubrica pdf', ferramenta: 'pdf/assinar' },
  { t: 'Gerar um QR Code', s: 'Utilidades › QR Code: links, textos, Wi-Fi e contatos', kw: 'qr code qrcode gerar link wifi contato', ferramenta: 'qr' },
  { t: 'Comprimir ou redimensionar imagens', s: 'Utilidades › Imagens: deixe as fotos mais leves', kw: 'comprimir reduzir redimensionar diminuir imagem foto jpg webp', ferramenta: 'imagem' },
  { t: 'Gerar uma senha', s: 'Utilidades › Gerador de senha', kw: 'senha forte gerar password frase', ferramenta: 'senha' },
  { t: 'Converter unidades', s: 'Utilidades › Conversor: medidas, temperatura, cozinha…', kw: 'converter unidades medida metro polegada celsius fahrenheit xicara kg', ferramenta: 'unidades' },
  { t: 'Contar palavras', s: 'Utilidades › Contador de palavras e caracteres', kw: 'contar palavras caracteres letras texto frases', ferramenta: 'contador' },
  { t: 'Escolher e converter cores', s: 'Utilidades › Cores: HEX, RGB, paletas e contraste', kw: 'cor cores hex rgb hsl paleta contraste', ferramenta: 'cores' },
  { t: 'Tarefas e notas', s: 'Utilidades › Quadro de tarefas com notas', kw: 'tarefas lista afazeres kanban notas organizar', ferramenta: 'tarefas' },
  { t: 'Quadro branco', s: 'Utilidades › Esboços e fluxogramas', kw: 'quadro branco desenhar esboco fluxograma diagrama', ferramenta: 'quadro' },
  { t: 'Mandar para outro programa…', s: 'Leva o conteúdo do programa aberto para outro', kw: 'mandar enviar levar compartilhar outro programa', acao: 'mandar' },
  { t: 'Fazer backup', s: 'Guarda as preferências e as cópias dos programas num arquivo', kw: 'backup copia seguranca exportar guardar levar outro computador', acao: 'backup' },
  { t: 'Restaurar um backup', s: 'Devolve tudo a partir de um arquivo de backup', kw: 'restaurar backup importar recuperar', acao: 'restaurar' },
  { t: 'Relatar um problema', s: 'Abre um e-mail já com as informações técnicas', kw: 'relatar problema erro bug defeito suporte', acao: 'relatar' },
  { t: 'Novidades da versão', s: 'O que mudou no Nebulosa Workspace', kw: 'novidades versao mudancas o que ha de novo', acao: 'novidades' }
];
