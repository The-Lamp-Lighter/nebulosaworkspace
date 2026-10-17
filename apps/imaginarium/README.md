# Imaginarium

**Editor gráfico offline — sua criatividade sem limites.**
Versão 2.0 · Autor: **Márcio Willians Barreto de Andrade**

O Imaginarium é um editor de imagens completo que roda no navegador, sem
servidor, sem instalação e sem internet. A versão 2.0 segue o modelo de
trabalho do Photopea/Photoshop: mesmas ferramentas, mesmos atalhos, mesmos
menus (com os nomes oficiais em português), camadas de ajuste, objetos
inteligentes, estilos de camada e leitura/gravação de arquivos **PSD**.
Tudo foi escrito em HTML5, CSS3 e JavaScript puro, sem bibliotecas externas.

## Como abrir

1. Copie a pasta `imaginarium` para o computador.
2. Dê um duplo clique em **`index.html`** (no Windows, também serve o
   `Iniciar_Imaginarium.bat`).

Funciona em Chrome, Edge, Firefox e Safari atualizados. No Chrome e no Edge há
extras: salvar sempre no mesmo arquivo e listar todas as fontes instaladas.

> Não é necessário rodar servidor local. Os scripts são clássicos (sem módulos
> ES) justamente para funcionarem direto do disco (`file://`).

## O que o programa faz

| Área | Recursos |
|---|---|
| Arquivos | Abre PSD/PSB (camadas, grupos, máscaras, textos editáveis, formas, estilos, ajustes, pranchetas), PNG, JPG, WEBP, GIF (com quadros), BMP, TIFF, TGA, ICO, SVG, AVIF e o projeto `.edt`. Salva PSD e `.edt`. Exporta PNG, JPG, WEBP, GIF, SVG, PDF, BMP, TIFF, ICO, TGA e PSD; **Exportar como** com prévia, escala e qualidade; exportar camadas, pranchetas e fatias; abrir recentes; imprimir; informações do arquivo; lote, folha de contatos, script, variáveis (CSV) |
| Ferramentas | 66 ferramentas em 20 grupos, com as letras do Photoshop e `Shift`+letra para alternar no grupo (lista abaixo) |
| Camadas | Pixels, texto, forma, grupo, ajuste, preenchimento (cor, gradiente, padrão), objeto inteligente e prancheta; 27 modos de mesclagem; opacidade e preenchimento; máscaras de camada e vetoriais; máscaras de recorte; bloqueios; vincular; alinhar/distribuir; Alinhar e Mesclar automaticamente; composições de camadas |
| Estilos de camada | Chanfro e entalhe, Traçado, Sombra interna, Brilho interno, Cetim, Sobreposição de cores/gradiente/padrão, Brilho externo, Sombra projetada, opções de mesclagem e "Mesclar se"; painel Estilos com predefinições |
| Objetos inteligentes | Converter, transformar sem perda (inclusive deformação), editar conteúdo, substituir, exportar, converter em camadas; **filtros inteligentes** com máscara e opções de mesclagem |
| Ajustes | 21 ajustes do menu Imagem (Curvas, Níveis, Matiz/Saturação, Equilíbrio de cores, Preto e branco, Filtro de fotos, Misturador de canais, Pesquisa de cores, Mapa de gradiente, Cor seletiva, Sombras/Realces, Tonificação HDR, Substituir cor, Equalizar…) e 16 como camadas de ajuste; Tom/Contraste/Cor automáticos; exportação de LUT `.cube` |
| Filtros | 67 filtros em 10 grupos (Desfoque, Galeria de desfoque, Distorção, Ruído, Pixelização, Acabamento, Nitidez, Estilização, Artístico, Outros), Galeria de filtros, Camera Raw, Correção de lente, Dissolver (Liquify), Ponto de fuga |
| Seleção | Letreiros, laços (livre, poligonal, magnético), varinha mágica, seleção rápida, Intervalo de cores, Refinar borda, máscara rápida, modificar, transformar seleção, salvar/carregar em canais |
| Vetores | Caneta, caneta livre e de curvatura, seleção direta e de demarcador, formas (inclusive personalizadas), combinar formas, painel Demarcadores, máscaras vetoriais |
| Texto | Texto de ponto e de parágrafo, horizontal e vertical, máscaras de texto, deformar texto, texto em demarcador, estilos por caractere, painéis Caracteres, Parágrafo e Glifos |
| Transformação | Transformação livre, escala, girar, inclinar, distorcer, perspectiva, deformar, Novamente; deformação de marionete e de perspectiva; escala sensível ao conteúdo |
| Documento | Abas, réguas, grade, guias e layout de guias, guias inteligentes, encaixe, girar vista, pranchetas, fatias, modos de cor (Bitmap, Tons de cinza, Cores indexadas, RGB, CMYK, Lab) |
| Aparência | Imaginarium (padrão), Nebulosa ou Photopea (idêntica ao Photopea), em Editar › Preferências › Aparência |
| Painéis | Camadas, Canais, Demarcadores, Histórico, Propriedades, Ajustes, Cores, Amostras, Pincel, Caracteres, Parágrafo, Glifos, Navegador, Informações, Histograma, Ações (gravar e reproduzir), Composições de camadas, Estilos, Predefinições de ferramenta, CSS e Biblioteca |
| Histórico | Desfazer/refazer com 120 passos por padrão (ajustável até 500), Pincel de histórico, Atenuar |

## Aparências

Em **Editar › Preferências › Aparência** há três aparências:

- **Imaginarium** — o visual original (grafite e azul, barra de status, painéis em abas).
- **Nebulosa** — a organização do Imaginarium com as cores da família Nebulosa
  (azul-marinho, roxo, laranja e amarelo), em `css/skin-nebulosa.css`.
- **Photopea** — igual ao Photopea: cinza `#474747`, fonte Open Sans 13 px
  (embutida), barra de ferramentas de 38 px com os mesmos grupos, painéis em duas
  colunas, menus claros, tela inicial "Solte qualquer arquivo aqui", pesquisa de
  comandos e teclado virtual. Medidas e cores tiradas de capturas do Photopea.

Em todas, a navegação segue o Photopea: roda = rolar na vertical, `Ctrl`+roda =
rolar na horizontal, `Alt`+roda (ou pinça do touchpad) = zoom.

## Ferramentas e atalhos de ferramenta

| Tecla | Grupo |
|---|---|
| `V` | Mover, Prancheta |
| `M` | Letreiro retangular, elíptico, de linha única e de coluna única |
| `L` | Laço, Laço poligonal, Laço magnético |
| `W` | Varinha mágica, Seleção rápida |
| `C` | Recorte, Corte em perspectiva, Fatia, Seleção de fatia |
| `I` | Conta-gotas, Amostra de cor, Régua, Contagem |
| `J` | Pincel de recuperação para manchas, Pincel de recuperação, Remendo, Movimento sensível ao conteúdo, Olhos vermelhos |
| `B` | Pincel, Lápis, Substituição de cor, Pincel misturador |
| `S` | Carimbo, Carimbo de padrão |
| `Y` | Pincel de histórico |
| `E` | Borracha, Borracha de plano de fundo, Borracha mágica |
| `G` | Gradiente, Balde de tinta |
| `R` | Desfoque, Nitidez, Borrar |
| `O` | Subexposição, Superexposição, Esponja |
| `P` | Caneta, Caneta de forma livre, Caneta de curvatura, Adicionar/Excluir ponto de ancoragem, Converter ponto |
| `T` | Texto horizontal, Texto vertical, Máscara de texto vertical e horizontal |
| `A` | Seleção de demarcador, Seleção direta |
| `U` | Retângulo, Elipse, Polígono, Estrela, Linha, Forma personalizada |
| `H` | Mão, Girar vista |
| `Z` | Zoom |

Com uma ferramenta de pintura: `[` `]` tamanho, `{` `}` dureza, `1`–`0`
opacidade, `Shift`+número fluxo. `D` cores padrão, `X` troca as cores, `Q`
máscara rápida, `Espaço` mão temporária, `Ctrl` mover temporário.

## Atalhos principais

| Ação | Atalho |
|---|---|
| Novo / Abrir / Salvar | `Ctrl+Alt+N` / `Ctrl+O` / `Ctrl+S` |
| Salvar como PSD / Exportar como | `Ctrl+Shift+S` / `Ctrl+Alt+Shift+W` |
| Fechar / Imprimir | `Ctrl+Alt+W` / `Ctrl+P` |
| Desfazer / Refazer | `Ctrl+Z` / `Ctrl+Shift+Z` (`Ctrl+Y`) |
| Voltar / Avançar um passo | `Ctrl+Alt+Z` / `Ctrl+Alt+Shift+Z` |
| Recortar / Copiar / Copiar mesclado / Colar / Colar no lugar | `Ctrl+X` / `Ctrl+C` / `Ctrl+Shift+C` / `Ctrl+V` / `Ctrl+Shift+V` |
| Transformação livre / Novamente | `Ctrl+Alt+T` (`Ctrl+T`) / `Ctrl+Shift+T` |
| Preencher / com primeiro plano / com fundo | `Shift+F5` / `Alt+Backspace` / `Ctrl+Backspace` |
| Camada via cópia / via recorte | `Ctrl+J` / `Ctrl+Shift+J` |
| Nova camada | `Ctrl+Alt+Shift+N` |
| Agrupar / Desagrupar | `Ctrl+G` / `Ctrl+Shift+G` |
| Máscara de recorte | `Ctrl+Alt+G` |
| Mesclar abaixo / visíveis / carimbar visíveis | `Ctrl+E` / `Ctrl+Shift+E` / `Ctrl+Alt+Shift+E` |
| Organizar camadas | `Ctrl+]` `Ctrl+[` `Ctrl+Shift+]` `Ctrl+Shift+[` |
| Selecionar camada acima / abaixo | `Alt+]` / `Alt+[` |
| Selecionar tudo / Desmarcar / Selecionar novamente / Inverter | `Ctrl+A` / `Ctrl+D` / `Ctrl+Shift+D` / `Ctrl+Shift+I` |
| Difusão / Refinar borda | `Shift+F6` / `Ctrl+Alt+R` |
| Níveis / Curvas / Matiz/Saturação / Equilíbrio de cores | `Ctrl+L` / `Ctrl+M` / `Ctrl+U` / `Ctrl+B` |
| Inverter / Dessaturar / Preto e branco | `Ctrl+I` / `Ctrl+Shift+U` / `Ctrl+Alt+Shift+B` |
| Tom / Contraste / Cor automáticos | `Ctrl+Shift+L` / `Ctrl+Alt+Shift+L` / `Ctrl+Shift+B` |
| Tamanho da imagem / da tela | `Ctrl+Alt+I` / `Ctrl+Alt+C` |
| Último filtro / Atenuar | `Ctrl+F` / `Ctrl+Shift+F` |
| Camera Raw / Correção de lente / Dissolver / Ponto de fuga | `Ctrl+Shift+A` / `Ctrl+Shift+R` / `Ctrl+Shift+X` / `Ctrl+Alt+V` |
| Ampliar / Reduzir / Ajustar / 100% | `Ctrl++` / `Ctrl+-` / `Ctrl+0` / `Ctrl+1` |
| Réguas / Grade / Guias / Extras / Encaixar | `Ctrl+R` / `Ctrl+'` / `Ctrl+;` / `Ctrl+H` / `Ctrl+Shift+;` |
| Canais | `Ctrl+2` … `Ctrl+9` |
| Painéis Camadas / Pincel / Informações / Ações | `F7` / `F5` / `F8` / `Alt+F9` |
| Ocultar interface / painéis | `Tab` / `Shift+Tab` |
| Preferências / Atalhos do teclado | `Ctrl+K` / `Ctrl+Alt+Shift+K` |
| Manual / Lista de atalhos | `F1` / `?` |

**Sobre `Ctrl+N`, `Ctrl+T` e `Ctrl+W`:** os navegadores reservam esses
atalhos (nova janela, nova aba, fechar aba) e nenhuma página consegue
interceptá-los. Por isso — como no Photopea — os comandos também respondem às
variantes com `Alt` (`Ctrl+Alt+N`, `Ctrl+Alt+T`, `Ctrl+Alt+W`). Todos os
atalhos podem ser personalizados em **Editar › Atalhos do teclado**.

## Estrutura do projeto

```
imaginarium/
├── index.html                  Estrutura da interface e tela inicial
├── Iniciar_Imaginarium.bat     Atalho para abrir no Windows
├── README.md
├── css/main.css                Tema escuro (grafite + azul)
├── js/
│   ├── app.js                  Estado, comandos centrais, menus, inicialização
│   ├── core/
│   │   ├── utils.js            Utilitários (DOM, cores, canvas, armazenamento)
│   │   ├── icons.js            Ícones SVG próprios
│   │   ├── widgets.js          Controles reutilizáveis
│   │   ├── canvas-engine.js    Composição, viewport, zoom/rotação, réguas, guias, encaixe
│   │   ├── blend.js            27 modos de mesclagem
│   │   ├── layer-manager.js    Documento, camadas, grupos, máscaras
│   │   ├── layer-extras.js     Diálogos de camada, Estilos, Alinhar/Mesclar automaticamente
│   │   ├── effects.js          Estilos de camada
│   │   ├── history-manager.js  Histórico com instantâneos em blocos
│   │   ├── tool-manager.js     Registro de ferramentas, grupos e teclado
│   │   ├── shortcuts.js        Atalhos personalizáveis
│   │   ├── ui-manager.js       Menus, diálogos, painéis acopláveis, status
│   │   ├── file-manager.js     Novo, abrir, projeto .edt, exportação básica
│   │   ├── file-extras.js      Exportar como, recentes, imprimir, lote, modos de imagem…
│   │   ├── formats.js          ZIP/deflate, GIF, BMP, TIFF, ICO, TGA, SVG
│   │   ├── psd.js              Leitura e gravação de PSD/PSB
│   │   ├── image-ops.js        Tamanho da imagem/tela, girar, espelhar, reamostragem
│   │   ├── selection.js        Seleção, canais, máscara rápida, Intervalo de cores, Refinar borda
│   │   ├── paths.js            Demarcadores, formas, máscaras vetoriais
│   │   ├── smart.js            Objetos e filtros inteligentes
│   │   ├── vanishing.js        Ponto de fuga
│   │   ├── liquify.js          Dissolver (Liquify)
│   │   ├── adjustments.js      Ajustes e camadas de ajuste
│   │   ├── filters*.js         Filtros (Web Worker) e diálogos
│   │   ├── kernels-*.js        Núcleos de processamento (ajustes, filtros, preenchimento)
│   │   └── resources.js        Pincéis, padrões, formas e gradientes
│   ├── tools/                  Uma ou mais ferramentas por arquivo (mover, seleção,
│   │                           recorte/fatia, pincéis, retoque, recuperação, texto,
│   │                           máscara de texto, vetores, transformação, deformações,
│   │                           prancheta, zoom/mão/girar vista)
│   └── panels/                 Camadas, Histórico, Propriedades, Ajustes, Cores,
│                               Pincel, Texto, Navegador, Biblioteca, Estilo de camada
│                               e os demais painéis (more-panels.js)
├── help/
│   ├── manual.html             Manual com índice e busca
│   └── credits.html            Créditos
└── assets/icons/               Logotipo e ícones do aplicativo
```

## Notas técnicas

- **Desempenho:** redesenho sob demanda com `requestAnimationFrame`; só a parte
  visível do documento é desenhada; durante a pincelada, as camadas abaixo e
  acima são pré-compostas; filtros e ajustes pesados rodam em Web Worker.
- **Memória:** o histórico guarda os pixels em blocos e reaproveita os que não
  mudaram entre um passo e outro.
- **PSD:** leitor e gravador próprios (descritores, EngineData de texto,
  compressão RLE e ZIP). Testado com dezenas de arquivos PSD de referência; o
  PSD gravado reabre com camadas, máscaras, textos editáveis, formas, estilos,
  ajustes e pranchetas.
- **Formato `.edt`:** contêiner binário próprio — assinatura `IMGEDT01`,
  cabeçalho JSON e bitmaps em PNG; guarda também objetos inteligentes, fatias,
  composições de camadas, canais e informações do arquivo.
- **PDF, GIF, TIFF, ZIP:** gerados por código próprio, sem bibliotecas.
- **Privacidade:** nenhuma requisição de rede. Preferências, amostras e layout
  dos painéis ficam no `localStorage`; a biblioteca pessoal e os arquivos
  recentes, no `IndexedDB`.

## Limites conhecidos

- O histórico não é gravado no arquivo; vale enquanto o documento está aberto.
- Os modos CMYK e Lab e as opções de 16/32 bits trabalham sobre a composição
  RGB de 8 bits (a conversão é aplicada à exibição e à exportação).
- Recursos que dependem de IA (remover fundo, preenchimento generativo etc.)
  não fazem parte do programa.
- Ao salvar PSD, recursos sem equivalente direto no formato (objetos e filtros
  inteligentes, texto em demarcador e alguns ajustes menos comuns) são
  simplificados — o programa avisa quando isso acontece. Para guardar tudo
  editável, salve também o projeto `.edt`.

## Créditos

**IMAGINARIUM** — Versão 2.0 — Editor Gráfico Offline
Autor: **Márcio Willians Barreto de Andrade**

Projeto desenvolvido para uso pessoal e educacional.
Photoshop é marca da Adobe; Photopea é de seu respectivo autor. Todos os
direitos dos respectivos formatos pertencem aos seus proprietários.
Interface criada exclusivamente para o Imaginarium.
