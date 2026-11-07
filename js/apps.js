/* ==========================================================================
   Nebulosa Workspace — js/apps.js
   Registro dos programas. É o ÚNICO lugar do Workspace que conhece os
   programas: para incluir, trocar ou tirar um programa, mexa só aqui e na
   pasta dele em apps/.

   Campos de cada programa:
     id          nome curto, sem espaços (o mesmo da pasta e do data-app da ponte)
     name        nome exibido
     path        pasta do programa; o Workspace abre path + 'index.html'
     group       título do grupo no menu lateral
     tag         etiqueta do cartão na tela inicial
     desc        descrição curta
     keywords    palavras para a busca (Alt+K), sem acentos
     icon        ícone de js/icons.js
     colors      as duas cores do degradê do ícone e do cartão
     defaultSkin aparência original do programa (usada em "Voltar ao padrão")
     tema        temática do cartão na página inicial (NEBULOSA_TEMAS, abaixo)
     funcao      função prática oficial, mostrada no cartão da página inicial
     nomeCartao  nome escrito no cartão, quando for diferente de "name" (opcional)
     soon        true = aparece como "em breve" e não abre (opcional)
     aceita      (0.8) o que o programa recebe pelo "Mandar para…" e pela busca:
                 'imagem', 'texto', 'tabela', 'video', 'audio' e/ou extensões ('.pdf')
     dorme       (0.8) true = pode descansar depois de muito tempo escondido, sem nada
                 pendente (ele reabre sozinho do ponto em que estava salvo)
     principal   (0.8) false = não é um dos programas principais: não entra nos cartões
                 das temáticas, na contagem nem nos atalhos Alt+1…9 (ex.: Utilidades)
     ferramentas (0.8) só em Utilidades: as mini-ferramentas, na ordem da página inicial

   A ordem da lista é a ordem do menu e dos atalhos Alt+1, Alt+2...
   O manual de cada programa fica em manuais/<id>.html.
   ========================================================================== */

/* Versão do Nebulosa Workspace (aparece no rodapé e na janela "Sobre").
   Ao mudar, mude também VERSAO em shared/nebulosa-bridge.js. */
window.NEBULOSA_VERSAO = '1.0';

/* Temáticas da página inicial, na ordem em que aparecem. */
window.NEBULOSA_TEMAS = ['Produtividade & Dados', 'Mídia & Criatividade', 'Arte & Estilo de Vida'];

window.NEBULOSA_APPS = [
  {
    id: 'typee',
    name: 'Typee',
    path: 'apps/typee/',
    group: 'Escrever e apresentar',
    tag: 'Documentos',
    desc: 'Escreva cartas, relatórios e trabalhos como no Word, só que bem mais simples e direto no navegador.',
    keywords: 'texto documento word escrever carta relatorio trabalho docx markdown folha pagina',
    icon: 'doc',
    colors: ['#A778FF', '#7f63e8'],
    defaultSkin: 'default',
    tema: 'Produtividade & Dados',
    funcao: 'Editor de Texto, Leitor e Conversor de PDF',
    aceita: ['imagem', 'texto', 'tabela', '.docx', '.pdf', '.md', '.markdown', '.txt'],
    dorme: true
  },
  {
    id: 'flyde',
    name: 'Flyde',
    path: 'apps/flyde/',
    group: 'Escrever e apresentar',
    tag: 'Apresentações',
    desc: 'Slides clássicos e mapas com zoom, com animações, transições e trilhas de áudio. Exporta em vídeo, imagens, PDF e PowerPoint.',
    keywords: 'slides apresentacao powerpoint canva prezi animacao transicao palestra aula video mp4 webm musica audio trilha fotos pdf imagem png jpg',
    icon: 'slides',
    colors: ['#FF9C54', '#A778FF'],
    defaultSkin: 'default',
    tema: 'Mídia & Criatividade',
    funcao: 'Apresentações em Slides',
    aceita: ['imagem'],
    dorme: true
  },
  {
    id: 'stardust',
    name: 'Stardust',
    path: 'apps/stardust/',
    group: 'Escrever e apresentar',
    tag: 'Planilhas',
    desc: 'Planilhas com fórmulas, gráficos e formatação, que abrem e salvam arquivos do Excel e do LibreOffice.',
    keywords: 'planilha planilhas excel calculo calcular tabela formula grafico graficos xlsx xls csv ods soma numeros dados',
    icon: 'sheet',
    colors: ['#4d8fd6', '#a244f5'],
    defaultSkin: 'default',
    tema: 'Produtividade & Dados',
    funcao: 'Planilhas de Cálculo e Gráficos',
    aceita: ['tabela', '.xlsx', '.xlsm', '.xlsb', '.xls', '.ods', '.csv']
  },
  {
    id: 'emcanto',
    name: 'EmCanto',
    path: 'apps/emcanto/',
    group: 'Música e leitura',
    tag: 'Partituras',
    desc: 'Leia, ouça e transforme partituras: a sua partitura ganha voz.',
    keywords: 'musica partitura cantar coro voz musicxml melodia ouvir',
    icon: 'music',
    colors: ['#FEFF36', '#FF9C54'],
    defaultSkin: 'default',
    tema: 'Arte & Estilo de Vida',
    funcao: 'Importador e Editor de Partituras',
    aceita: ['.pdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.musicxml', '.mxl', '.xml', '.gp3', '.gp4', '.gp5', '.emcanto']
  },
  {
    id: 'lepramim',
    name: 'LêPraMim',
    path: 'apps/lepramim/',
    group: 'Música e leitura',
    tag: 'Leitura',
    desc: 'Leitor de ebooks, documentos e audiobooks que lê em voz alta, sem internet.',
    keywords: 'ler livro ebook audiobook voz leitura pdf epub ouvir audiolivro',
    icon: 'book',
    colors: ['#A778FF', '#FEFF36'],
    defaultSkin: 'default',
    tema: 'Produtividade & Dados',
    funcao: 'Leitor de Textos e Audiolivros',
    aceita: ['texto', '.pdf', '.epub', '.docx', '.txt', '.rtf', '.html', '.htm', '.mp3', '.m4a', '.m4b', '.aac', '.ogg', '.oga', '.opus', '.wav', '.flac'],
    dorme: true
  },
  {
    id: 'paznobolso',
    name: 'PazNoBolso',
    path: 'apps/paznobolso/',
    group: 'Dia a dia',
    tag: 'Finanças',
    desc: 'Orçamento doméstico no seu computador, sem internet e com planilhas do Excel.',
    keywords: 'dinheiro orcamento financas gastos contas planilha excel xlsx casa',
    icon: 'wallet',
    colors: ['#8b8fd6', '#A778FF'],
    defaultSkin: 'default',
    tema: 'Arte & Estilo de Vida',
    funcao: 'Gerenciador Financeiro Pessoal',
    nomeCartao: 'Paz no Bolso'
  },
  {
    id: 'pratododia',
    name: '#pratododia',
    path: 'apps/pratododia/',
    group: 'Dia a dia',
    tag: 'Receitas',
    desc: 'Suas receitas num só lugar: cardápio, lista de compras, eventos e um livro de receitas para imprimir.',
    keywords: 'receita receitas cozinha comida culinaria cardapio prato almoco jantar lista compras livro',
    icon: 'food',
    colors: ['#FF9C54', '#FEFF36'],
    defaultSkin: 'default',
    tema: 'Arte & Estilo de Vida',
    funcao: 'Caderno e Gestor de Receitas Culinárias'
  },
  {
    id: 'imaginarium',
    name: 'Imaginarium',
    path: 'apps/imaginarium/',
    group: 'Imagens e vídeo',
    tag: 'Imagens',
    desc: 'Editor gráfico completo: camadas, filtros, arquivos PSD e muito mais.',
    keywords: 'imagem foto editar photoshop photopea camadas filtro design desenho arte pdf escaneado digitalizado',
    icon: 'brush',
    colors: ['#A778FF', '#FF9C54'],
    defaultSkin: 'imaginarium',
    tema: 'Mídia & Criatividade',
    funcao: 'Editor Multifuncional de Imagens',
    aceita: ['imagem', '.psd', '.psb', '.pdf']
  },
  {
    id: 'fluxo',
    name: 'Fluxo',
    path: 'apps/fluxo/',
    group: 'Imagens e vídeo',
    tag: 'Edição de vídeo',
    desc: 'Edite vídeos como no CapCut e no After Effects: cortes, efeitos, títulos, câmera 3D, partículas e exportação em MP4, MOV, MKV, WebM e AVI.',
    keywords: 'video editar editor capcut premiere after effects motion corte efeito transicao titulo legenda tiktok reels youtube mp4 mov prores mkv webm avi drone camera 3d particulas',
    icon: 'clapper',
    colors: ['#A778FF', '#323559'],
    defaultSkin: 'default',
    tema: 'Mídia & Criatividade',
    funcao: 'Editor de Vídeo e Motion Design',
    aceita: ['imagem', 'video', 'audio']
  },
  /* (0.8) Utilidades: um lugar separado dos programas principais, com mini-ferramentas.
     Abre numa aba como os outros, mas fica fora das temáticas e dos atalhos Alt+1…9. */
  {
    id: 'utilidades',
    name: 'Utilidades',
    path: 'apps/utilidades/',
    group: 'Utilidades',
    tag: 'Utilidades',
    desc: 'Mini-ferramentas do dia a dia: QR Code, unidades, imagens, conversor de arquivos, senhas, palavras, cores, PDF, tarefas e quadro branco.',
    keywords: 'utilidades ferramentas qr code unidades converter conversor arquivos convertio docx xlsx mp3 mp4 imagem comprimir senha contador palavras cores pdf juntar dividir assinar tarefas notas quadro branco',
    icon: 'tools',
    colors: ['#FEFF36', '#A778FF'],
    defaultSkin: 'default',
    tema: '',
    funcao: 'Mini-ferramentas do dia a dia',
    principal: false,
    aceita: ['imagem', 'texto', '.pdf', '.docx', '.odt', '.rtf', '.epub', '.fb2', '.html', '.xlsx', '.xls', '.ods', '.csv', '.tsv', '.json', '.zip', '.tar', '.gz', '.mp3', '.wav', '.ogg', '.flac', '.m4a', '.mp4', '.mov', '.mkv', '.webm', '.avi', '.tiff', '.heic', '.psd'],
    dorme: true,
    ferramentas: [
      { id: 'qr', nome: 'QR Code', desc: 'Links, textos, Wi-Fi e contatos.', icon: 'qr' },
      { id: 'unidades', nome: 'Conversor de unidades', desc: 'Medidas, temperatura, cozinha e mais.', icon: 'ruler' },
      { id: 'imagem', nome: 'Imagens', desc: 'Comprima e redimensione fotos.', icon: 'image' },
      { id: 'senha', nome: 'Gerador de senha', desc: 'Senhas fortes e frases-senha.', icon: 'key' },
      { id: 'contador', nome: 'Contador de palavras', desc: 'Palavras, caracteres e tempo de leitura.', icon: 'count' },
      { id: 'cores', nome: 'Cores', desc: 'Conversões, paletas e contraste.', icon: 'paint' },
      { id: 'pdf', nome: 'PDF', desc: 'Juntar, dividir, girar e assinar.', icon: 'pdf' },
      { id: 'conversor', nome: 'Conversor de arquivos', desc: 'Documentos, planilhas, imagens, áudio e vídeo.', icon: 'convert' },
      { id: 'tarefas', nome: 'Tarefas e notas', desc: 'A fazer, fazendo e feito.', icon: 'kanban' },
      { id: 'quadro', nome: 'Quadro branco', desc: 'Esboços, setas e fluxogramas.', icon: 'board' }
    ]
  }
];
