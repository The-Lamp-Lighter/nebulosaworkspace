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
     soon        true = aparece como "em breve" e não abre (opcional)

   A ordem da lista é a ordem do menu e dos atalhos Alt+1, Alt+2...
   ========================================================================== */
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
    defaultSkin: 'default'
  },
  {
    id: 'flyde',
    name: 'Flyde',
    path: 'apps/flyde/',
    group: 'Escrever e apresentar',
    tag: 'Apresentações',
    desc: 'Slides clássicos e mapas com zoom, com animações e transições para impressionar sem esforço.',
    keywords: 'slides apresentacao powerpoint canva prezi animacao transicao palestra aula',
    icon: 'slides',
    colors: ['#FF9C54', '#A778FF'],
    defaultSkin: 'default'
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
    defaultSkin: 'default'
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
    defaultSkin: 'default'
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
    defaultSkin: 'default'
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
    defaultSkin: 'default'
  },
  {
    id: 'imaginarium',
    name: 'Imaginarium',
    path: 'apps/imaginarium/',
    group: 'Imagens e vídeo',
    tag: 'Imagens',
    desc: 'Editor gráfico completo: camadas, filtros, arquivos PSD e muito mais.',
    keywords: 'imagem foto editar photoshop photopea camadas filtro design desenho arte',
    icon: 'brush',
    colors: ['#A778FF', '#FF9C54'],
    defaultSkin: 'imaginarium'
  },
  {
    id: 'fotoflow',
    name: 'FotoFlow',
    path: 'apps/fotoflow/',
    group: 'Imagens e vídeo',
    tag: 'Vídeos',
    desc: 'Transforme fotos em filmes com movimentos de câmera, transições e música.',
    keywords: 'video filme foto slideshow fotos musica transicao montagem apresentacao clipe animacao',
    icon: 'film',
    colors: ['#7f63e8', '#FF9C54'],
    defaultSkin: 'default'
  }
];
