# Continuar o projeto Nebulosa Workspace

> **Para o Claude (ou qualquer pessoa) que for continuar este projeto:** leia este
> arquivo inteiro e depois o `README.md` antes de mexer em qualquer coisa.
> Responda sempre em **português do Brasil**.
>
> **Para o dono do projeto:** numa conversa nova, anexe o zip do projeto (ou mande o
> link do repositório no GitHub) e escreva: *"Leia o continuar.md e depois faça: …"*.

Última atualização: 26/10/2026 · **Versão 0.4** — entrou o **Fluxo** (editor de vídeo,
10º programa), o **logotipo novo** com os ícones dos 10 programas na página inicial (no
lugar dos 3 botões das temáticas), o **e-mail de contato** nebulosaworkspace@gmail.com
(envelope no cabeçalho, antes do sino, e no fim do "Sobre") e os manuais do Fluxo e do
Workspace atualizados. (A 0.3 trouxe o Stardust, o Typee abrindo PDF e o LêPraMim baixando
OCR/MP3/DOCX sozinho.)

---

## 1. O que é

Um site estático (HTML, CSS e JavaScript puro, sem build) que reúne os programas da
família Nebulosa num só lugar: menu lateral por grupo, página inicial com as três
temáticas, abas, busca (`Alt+K`), troca de aparência, notificações, doação por Pix,
contador de acessos e manuais.

- **Onde roda:** GitHub Pages (pasta raiz do repositório, branch `main`).
  Também abre com duplo clique no `index.html`, com menos recursos.
- **Não há** `.bat`, servidor local ou etapa de build na raiz — foi pedido
  explicitamente. Os `.bat` que existem ficam dentro de `apps/lepramim` e
  `apps/imaginarium`, porque são desses programas.
- O dono atualiza os programas um por um, muitas vezes em outras conversas.
  **Regra principal:** trocar a pasta de um programa nunca pode quebrar o
  Workspace nem os outros programas.

## 2. Identidade visual (pedida na versão 0.3)

- **Assinatura** em cada programa, no topo, ao lado do nome: `[Nome] by Nebulosa Workspace`
  (`<small class="nb-by">`; o estilo vem da ponte).
- **Cartões da página inicial** agrupados por temática, com a função prática oficial
  (campos `tema` e `funcao` em `js/apps.js`; `nomeCartao` para "Paz no Bolso").
  As listas laterais (grupos do menu) continuam como eram.
  - Produtividade & Dados: Typee (Editor de Texto, Leitor e Conversor de PDF) ·
    Stardust (Planilhas de Cálculo e Gráficos) · LêPraMim (Leitor de Textos e Audiolivros)
  - Mídia & Criatividade: Flyde (Apresentações em Slides) · Imaginarium (Editor
    Multifuncional de Imagens) · FotoFlow (Criador de Apresentações de Fotos e Vídeo) ·
    Fluxo (Editor de Vídeo e Motion Design)
  - Arte & Estilo de Vida: EmCanto (Importador e Editor de Partituras) · Paz no Bolso
    (Gerenciador Financeiro Pessoal) · #pratododia (Caderno e Gestor de Receitas Culinárias)
- **Logotipo (0.4)**: a nebulosa em aquarela do logotipo original, com órbitas douradas e os
  **ícones dos 10 programas** em estilo "broche esmaltado" (moldura dourada, esmalte lavanda,
  desenho azul-marinho e amarelo). Arquivos em `assets/img/`:
  `nebulosa-workspace-logo.png` (1254×1134, letras azul-marinho, fundo transparente — o de
  download), `nebulosa-workspace-logo-720.png` (tema claro) e
  `nebulosa-workspace-logo-escuro-720.png` (letras claras, tema escuro). Na página inicial ele
  ocupa o lugar dos 3 botões das temáticas (`.nlogo` em `css/workspace.css`, imagem de fundo
  trocada pelo tema). "Sobre" tem o botão **Baixar logotipo**. Como foi feito: a nebulosa
  foi recortada da imagem original (fundo xadrez falso removido, ícones e órbitas antigos
  apagados por inpainting) e o resto (órbitas, ícones, letreiro original recortado) foi
  montado em SVG e renderizado com fundo transparente. Para incluir um 11º ícone, é preciso
  refazer a montagem (peça ao Claude; ele guarda os passos).
- **Contato (0.4)**: `nebulosaworkspace@gmail.com` — botão `#btnMail` (envelope) no cabeçalho,
  antes do sino, e no fim da janela "Sobre" (`CONTATO_EMAIL` em `js/workspace.js`). Também nos manuais.
  **Correção (26/10, noite):** o dono relatou que clicar no envelope "não fazia nada" — um
  `mailto:` não faz nada quando o computador não tem programa de e-mail configurado (comum no
  Windows com Gmail no navegador). Agora o envelope (e o e-mail no "Sobre") abre o painel
  `#mailPanel` (`openMail()`): Gmail e Outlook no navegador, programa de e-mail (`mailto:`) e
  "Copiar endereço".
  No celular (≤ 440 px) o botão de tela cheia some para caber o envelope na barra de cima.
- **Licença e páginas legais (0.4)**: `LICENSE` (MIT, titular "Nebulosa Workspace — equipe Lamp
  Lighter"; troque o nome se quiser), `legal/termos.html`, `legal/privacidade.html` e
  `legal/creditos.html` (geradas pelo mesmo estilo dos manuais; atualizar a lista de créditos
  quando um programa ganhar biblioteca nova). Links no rodapé da página inicial (`LEGAL_LINKS`),
  no "Sobre" e no rodapé dos manuais. **Aceite:** faixa no rodapé da tela na primeira visita
  (`avisoTermos()` em `js/workspace.js`, `#termosBar` no CSS) — de propósito NÃO é popup e NÃO
  bloqueia: usar o site vale como concordância (o projeto não coleta dados, então não há base
  para exigir clique). "Entendi" grava `nebulosa.termos` = `TERMOS_VERSAO`; mudou os termos,
  mude a data ali.
- **Manifesto** "Bem-vindo ao Nebulosa Workspace" na página inicial, na janela
  "Sobre o Workspace", no `README.md` e no manual do Workspace (texto em
  `MANIFESTO`, no topo de `js/workspace.js`).
- **Rodapé:** "Nebulosa Workspace - um pacote de programas simples, bonitos e que
  funcionam direto no navegador. Versão 0.4" na página inicial, no Sobre, nos manuais,
  no Sobre do Stardust e nas telas iniciais do EmCanto, PazNoBolso e #pratododia
  (`.nb-rodape`).

## 2b. Domínio e busca (26/10/2026)

- Endereço oficial: **https://nebulosaworkspace.com.br** (registrado pelo dono no Registro.br).
  Arquivo `CNAME` na raiz — **não apagar** ao atualizar. DNS e passos no `README.md`
  ("Endereço").
- SEO: `robots.txt`, `sitemap.xml` (15 endereços: início, 11 manuais, 3 páginas legais), bloco
  `<!-- seo --> … <!-- /seo -->` (canonical, Open Graph, Twitter Card; JSON-LD schema.org na
  página inicial) em `index.html`, `manuais/*.html` e `legal/*.html`, imagem de prévia
  `assets/img/og-nebulosa-workspace.jpg` (1200×630, logo + "10 programas que funcionam direto no
  navegador" + o domínio). Títulos dos manuais no formato
  "<Programa> — <função> grátis no navegador | Manual". Ao incluir página nova ou programa novo:
  acrescentar no `sitemap.xml` e copiar o bloco seo (trocando o endereço).
- Link do domínio no "Sobre" e no rodapé dos manuais e das páginas legais.

## 3. Estrutura

```
index.html                 casca do Workspace (só a estrutura da página)
css/workspace.css          visual do Workspace
js/apps.js                 LISTA DOS PROGRAMAS, NEBULOSA_TEMAS e NEBULOSA_VERSAO
js/doacao.js               Pix Copia e Cola, textos da janela de doação e lembretes
js/acessos.js              contador de acessos (serviço Abacus, "espaco" dos contadores)
js/icons.js                ícones SVG
js/theme.js                tema claro/escuro do Workspace, aplicado antes de desenhar
js/qrcode.js               gerador de QR Code próprio (sem serviço externo)
js/notificacoes.js         canto de notificações + histórico do sino
js/workspace.js            lógica: menu, abas, página inicial, janelas, aparência,
                           doação, lembretes, acessos, conversa com os programas
assets/img/                logotipos do Workspace (+ nebulosa-workspace-logo*.png, versão 0.4)
shared/nebulosa-bridge.js  PONTE usada por todos os programas (aparência, aviso de
                           alterações, atalhos, notificações, assinatura, acessos, versão)
manuais/                   manual do Workspace (index.html) + um por programa + manual.css
apps/<id>/index.html       cada programa, aberto num <iframe>
README.md                  documentação completa (estrutura, atualizar, incluir programa)
continuar.md               este arquivo
.nojekyll                  GitHub Pages publica os arquivos como estão
.gitattributes             finais de linha (.bat/.ps1 CRLF, .sh LF) e binários
```

Os scripts são clássicos (sem módulos ES) para funcionar também abrindo do disco.
A ordem no `index.html` importa:
`icons → apps → doacao → qrcode → notificacoes → acessos → workspace`.

## 4. Os 10 programas

| Alt | id | Nome | Grupo no menu | Forma |
|---|---|---|---|---|
| 1 | typee | Typee | Escrever e apresentar | um `index.html` + `nebulosa-skin.css` + `libs/pdfjs/` (abrir PDF) |
| 2 | flyde | Flyde | Escrever e apresentar | um `index.html` + `nebulosa-skin.css` |
| 3 | stardust | Stardust (novo na 0.3) | Escrever e apresentar | `index.html`, `css/`, `js/`, `libs/`, `assets/` + `nebulosa-skin.css` |
| 4 | emcanto | EmCanto | Música e leitura | um `index.html` (≈11 MB, versão nova com recursos embutidos) + `nebulosa-skin.css` |
| 5 | lepramim | LêPraMim | Música e leitura | projeto completo (css/, js/, libs/, assets/) |
| 6 | paznobolso | PazNoBolso | Dia a dia | um `index.html` + `nebulosa-skin.css` |
| 7 | pratododia | #pratododia | Dia a dia | um `index.html` (≈3 MB) + `nebulosa-skin.css` |
| 8 | imaginarium | Imaginarium | Imagens e vídeo | projeto completo (css/, js/, help/) |
| 9 | fotoflow | FotoFlow | Imagens e vídeo | projeto completo + `nebulosa-skin.css` |
| — | fluxo | Fluxo (novo na 0.4) | Imagens e vídeo | um `index.html` (≈0,7 MB) **gerado** do código-fonte do Fluxo; aparência no próprio CSS |

A ordem em `js/apps.js` é a ordem do menu e dos atalhos `Alt+1…9`
(a entrada do Stardust deslocou os atalhos dos programas seguintes). O Fluxo entrou **no
fim** da lista para não mudar os atalhos conferidos pelo dono: ele não tem `Alt+número`.

### Fluxo (editor de vídeo)

- O código-fonte fica num projeto à parte (`fluxo-v0.4-codigo.zip`, React + TypeScript +
  esbuild, com o próprio `CONTINUAR-PROJETO.txt`). `npm run build` gera `dist/index.html`,
  que é copiado para `apps/fluxo/index.html`. **Atualizar o Fluxo = trocar esse arquivo.**
- Integração `[Nebulosa]` (no código-fonte): ponte em `src/template.html`, assinatura em
  `src/ui/TopBar.tsx`, aparência Nebulosa Default no fim de `src/styles/app.css` (não há
  `nebulosa-skin.css`), `window.__nebulosaDirty` em `src/main.tsx` (= exportação em
  andamento; o projeto em si é salvo sozinho no IndexedDB do navegador).
- **Fluxo 0.4.1** (26/10, noite): chroma key completo (conta-gotas, tolerância, ruído, bordas,
  opacidade, reflexo, ver máscara) e exportar só o áudio em MP3 (lamejs baixado do jsDelivr na
  primeira vez, como no LêPraMim) ou WAV.
- Novidades da versão que entrou (Fluxo 0.4): exportação rápida e formatos MP4/MOV/MKV/WebM/
  AVI (H.264, H.265, VP9, AV1, ProRes, MJPEG), câmera 3D, drone, modelos, máscara livre +
  rotoscopia, rodas de cor, separar/unir áudio, ducking, correção do som nos cortes,
  recortar e preencher, setinhas de ajuste fino, efeitos visíveis na linha do tempo,
  agrupar camadas, adesivos/emojis/GIFs, muitos presets novos. **WMV é impossível no
  navegador** (codec fechado da Microsoft); H.265 depende do computador.

## 5. Integração dos programas (ponte)

Tudo o que foi alterado dentro de um programa está marcado com **`[Nebulosa]`** no código.
Ao atualizar um programa, essas partes precisam ser mantidas (tabela no `README.md`).
Sem elas o programa ainda abre e funciona; só perde aparências, aviso de alterações,
notificações, assinatura e contagem de acessos pelo Workspace.

No `<head>` de cada programa:

```html
<script src="../../shared/nebulosa-bridge.js" data-app="typee" data-name="Typee"
        data-modes data-preview="#141824 #232a3f #7b8cc7 #d6dc00"></script>
...
<link rel="stylesheet" href="nebulosa-skin.css">
```

API dentro do programa (`window.NebulosaSkin`, também `window.Nebulosa`):

- `list`, `get()`, `set(id)`, `on(fn)`, `getMode()`, `setMode()`, `openDialog()` → aparência
- `versao` → versão do Workspace (igual a `NEBULOSA_VERSAO`)
- `window.__nebulosaDirty = () => true/false` → aviso de alterações não salvas ao fechar
- `openNewWindow('#novo')` → nova janela pelo Workspace (usado pelo Typee)
- `provide({...})` + `notify()` → programa com aparência própria (Imaginarium, `data-provider`)
- `notificar({ titulo, texto, tipo: 'info'|'sucesso'|'aviso'|'erro', duracao, sempre })`
- A ponte também: injeta o estilo de `.nb-by` (assinatura) e `.nb-rodape`, e carrega
  `../../js/acessos.js` (só quando a ponte é um arquivo, não no HTML único).

Mensagens (`postMessage`, todas com a chave `nebulosa`), documentadas no topo de `js/workspace.js`:
Workspace → programa: `ping`, `set-skin`, `open-skin`, `query-dirty`.
Programa → Workspace: `hello`/`skin`, `dirty`, `key`, `new-window`, `notify`.

**Aparência "Nebulosa Default"** em todos os programas: roxo `#A778FF` (principal),
azul-marinho `#323559`, laranja `#FF9C54`, amarelo `#FEFF36`. O CSS de cada programa usa
`:root[data-skin="nebulosa"]` e respeita o claro/escuro dele.
O Imaginarium tem 3 aparências (Imaginarium, Nebulosa e Photopea).

## 6. Recursos do Workspace

- **Aparência:** botão "Aparência" (por programa, ou "Usar Nebulosa Default em todos") e
  tema claro/escuro do próprio Workspace.
- **Doe com Pix:** botão no fim do menu lateral (no celular, coração na barra de cima) e na
  busca. Janela com os dados do card "Lamp Lighter · Equipe de produção", Pix Copia e Cola
  com botão de copiar e QR Code gerado por `js/qrcode.js`.
  **Para trocar chave ou textos: só `js/doacao.js`.**
- **Lembrete de doação:** o primeiro **2 minutos depois de abrir a página**, depois **a cada
  30 minutos** (sem variação; `variacaoPorcento` permite variar). Nunca com janela aberta ou
  aba escondida; quem copia o Pix fica 72 h sem lembretes. Ajustes em `js/doacao.js` →
  `lembretes`. A cada abertura da página o relógio do primeiro lembrete recomeça.
- **Canto de notificações** e **sino** com histórico.
- **Acessos:** botão discreto "Acessos" no rodapé da página inicial (também na busca).
  Conta a página inicial (`inicio`) e cada programa (`<id>`), uma vez por sessão do
  navegador, no serviço gratuito Abacus (`https://abacus.jasoncameron.dev`,
  `/hit/<espaco>/<pagina>` e `/get/<espaco>/<pagina>`, resposta `{"value": n}`).
  `espaco` = `nebulosa-workspace-mwba`. Em `file://`/`localhost` não conta (só soma
  localmente). Se o serviço falhar, a lista mostra a contagem local e avisa.
  Observação: o serviço é de terceiros e gratuito; pode limitar pedidos (30 a cada 10 s
  por IP) e, em tese, apagar contadores sem uso por muito tempo.
- **Manuais:** link "Manuais" no rodapé da página inicial, botão no Sobre e itens
  "Manual de …" na busca.
- **Pasta não encontrada:** no site, o Workspace confere se `apps/<id>/index.html` existe
  e mostra um aviso claro em vez de uma página 404.

Chaves no `localStorage`: `nebulosa.hub` (tema e recentes), `nebulosa.skin.<id>`,
`nebulosa.mode.<id>`, `nebulosa.lembrete`, `nebulosa.notificacoes`,
`nebulosa.acessos.local`. No `sessionStorage`: `nebulosa.acesso.<pagina>`.
O Stardust usa `stardust.recuperacao` (cópia de recuperação) e `stardust.modo`.

## 7. Stardust (planilhas) — notas técnicas

- `js/nucleo.js`: modelo (`wb.sheets[]` com `cells: Map("r,c" → {v, f, s, val})`,
  `colW`, `rowH`, `merges`, `charts`, `freeze`, `hiddenRows`, `filter`, `condFormats`,
  `validations`, `notas`), endereços A1,
  leitura de entrada à brasileira e formatador de códigos de número do Excel.
- `js/formulas.js`: tokenizador/analisador/avaliador. Fórmulas guardadas em inglês com
  vírgula (canônico do Excel); `toDisplay()`/`toCanonical()` traduzem para pt-BR com `;`.
  Recalcula a pasta inteira a cada alteração (detecção de referência circular → `#CIRC!`).
  Funções novas do Excel são gravadas com `_xlfn.`.
- `js/arquivos.js`: XLSX/XLSM próprios (JSZip) com estilos, mescladas, painéis, filtro e
  **gráficos nativos** (DrawingML); leitura própria de XLSX (estilos, fórmulas compartilhadas,
  gráficos); SheetJS para XLS/XLSB/ODS; CSV próprio; PDF com pdf-lib (texto vetorial,
  gráficos no fim); JPG em canvas.
- `js/regras.js` (`SD.R`): **formatação condicional** (`sh.condFormats`, a primeira regra
  tem prioridade; tipos maior/menor/maior-igual/menor-igual/entre/igual/diferente/contém/
  repetidos/únicos/acima e abaixo da média/escala de cores/barras de dados), **validação de
  dados** (`sh.validations`, a última regra que cobre a célula vale; lista literal ou
  intervalo `fonte`, inteiro, número, data, tamanho do texto; bloquear ou só avisar) e
  **comentários** (`sh.notas["r,c"] = {t, a}`). Cada regra tem `range` com uma ou mais
  áreas separadas por espaço. Também ajusta tudo ao inserir/excluir linhas e colunas
  (`SD.R.deslocar`) e ao renomear planilha (`SD.R.renomear`). No XLSX: `<conditionalFormatting>`
  + `dxfs`, `<dataValidations>`, `comments*.xml` + `vmlDrawing*.vml` (escrita e leitura).
  Regras do tipo "expression" (fórmula) do Excel ainda não são lidas.
- `js/grade.js`: grade em canvas com eixos de tamanhos variáveis, painéis congelados,
  edição por textarea sobre a célula, apontar referências com o mouse, alça de
  preenchimento, redimensionar, camada de gráficos; desenha a formatação condicional, o
  triângulo dos comentários (com o balão ao passar o mouse) e a setinha da lista suspensa
  (`Alt+↓` também abre).
- `js/app.js`: interface, desfazer/refazer (por célula ou por planilha), menus, painel de
  funções e de gráfico, janelas (Formatar células, Classificar, Localizar, Salvar como),
  modelos, recuperação e integração com a ponte.
- Testado: digitação, fórmulas, preencher, desfazer, classificar, filtro, gráficos,
  aparências, e os 8 formatos de saída — abertos de volta no LibreOffice (XLSX com
  gráfico renderizado), no openpyxl e no próprio Stardust; leitura de XLSX do openpyxl e do
  LibreOffice, XLS, ODS e CSV. Formatação condicional, validação e comentários: criados pelas
  janelas, salvos em XLSX, conferidos no openpyxl e no LibreOffice (renderização no PDF) e
  reabertos no Stardust; também lidos de um XLSX feito no openpyxl.
- XLS, XLSB e ODS saem sem cores, sem gráficos, sem regras e sem comentários (limitação do
  SheetJS gratuito). **O dono decidiu não resolver isso** — não é pendência.
- Ainda não tem: macros, tabelas dinâmicas, seleção múltipla com Ctrl.

## 8. LêPraMim e a voz neural (Piper)

- No GitHub Pages a voz Piper (Cadu, Faber, Jeff, Edresson) é baixada na primeira leitura
  do jsDelivr e do Hugging Face e fica no Cache do navegador. **Testado no GitHub Pages:
  baixa e lê.** Endereços em `apps/lepramim/js/config.js` → `PIPER_WEB`. A CSP do
  `apps/lepramim/index.html` libera esses sites e o endereço do contador de acessos.
- O LêPraMim avisa no canto do Workspace quando um audiobook fica pronto e quando a voz
  termina de baixar.
- **OCR, MP3 e DOCX baixam sozinhos** (feito nesta versão), do mesmo jeito que a voz:
  `apps/lepramim/js/bibliotecas-web.js` (`LPM.libsWeb.obter('ocr'|'mp3'|'docx')`). Ordem:
  1) pasta `libs/` (Baixar-Bibliotecas), 2) cópia no Cache Storage `lepramim-libs-v1`,
  3) internet com permissão e barra de progresso. Endereços em `js/config.js` → `LIBS_WEB`
  (tesseract.js 5.0.0 + tesseract.js-core 5.0.0 do jsDelivr, idioma por
  `tessdata.projectnaptha.com/4.0.0`, lamejs 1.2.1, mammoth 1.6.0). A CSP libera
  `tessdata.projectnaptha.com`. Configurações mostram a situação de cada um e têm
  "Esquecer componentes baixados". `sw.js` passou para `lepramim-v5`.
  Testado com o CDN simulado (o ambiente de teste não tem internet): falta confirmar no
  GitHub Pages que os três baixam de verdade.

## 8b. Typee — abrir PDF

- `Abrir` aceita `.pdf` (feito nesta versão): `openPdf()` no `apps/typee/index.html`
  (marcado `[Nebulosa] PDF`) usa o PDF.js de `apps/typee/libs/pdfjs/` (cópia do do LêPraMim,
  carregado só quando um PDF é aberto). Agrupa o texto em linhas, tira cabeçalhos/rodapés e
  números de página repetidos, detecta títulos pelo tamanho da letra, listas e parágrafos,
  junta palavras hifenizadas e monta o documento editável; daí "Salvar › Word" faz a
  conversão PDF → Word. PDF sem texto (digitalizado) mostra aviso sugerindo o LêPraMim.
- No HTML único do Typee o PDF.js vai embutido (`window.__typeePdfLib` /
  `window.__typeePdfWorker` com endereços blob).

## 9. Pendências e ideias

- [x] LêPraMim: OCR, MP3 e DOCX baixam sozinhos (feito). Conferir no GitHub Pages o
      primeiro download real de cada um.
- [x] Typee abre PDF e converte em Word (feito).
- [x] Stardust: formatação condicional, validação de dados e comentários (feito).
- [x] Contador de acessos: testado pelo dono no site, funcionando. Atalhos `Alt+1…9`
      conferidos pelo dono — não mudar.
- [x] Fluxo incluído (0.4), com manual; logotipo novo com os 10 ícones; e-mail de contato.
- [ ] Fluxo: conferir no GitHub Pages a exportação num computador Windows (H.265 aparece
      quando o navegador tem o codificador) e abrir um MOV ProRes num editor profissional.
- [ ] Stardust: tabelas dinâmicas; ler regras condicionais por fórmula ("expression");
      comentários acompanharem a classificação das linhas.
- [ ] Imaginarium: pedido antigo (feito na conversa própria dele) de deixar os menus e os
      controles de transformação iguais aos do Photopea. É trabalho do programa.

## 10. Como foi testado (para repetir)

Servidor local (`python3 -m http.server`) e Playwright/Chromium:

- os 10 programas abrem no Workspace (`Alt+1…9`; o Fluxo pelo menu), mostram a assinatura e
  trocam de aparência;
- página inicial com o logotipo nos temas escuro e claro; envelope do e-mail (`mailto:`);
  "Sobre" com o contato e o botão de baixar o logotipo;
- Fluxo: a bateria de testes do próprio projeto (Playwright, ver o CONTINUAR-PROJETO.txt dele),
  exportações conferidas com ffprobe/ffmpeg;
- aviso ao fechar com alterações (Stardust), atalhos, nova janela do Typee;
- lembrete de doação com relógio acelerado (aparece aos 2 min e de novo aos 30 min);
- janela de Acessos (sem rede no ambiente de teste: mostra a contagem local);
- Stardust: ver item 7; LibreOffice e openpyxl para conferir os arquivos gerados;
- Typee: abrir um PDF de teste com títulos, listas e parágrafos e conferir o HTML gerado;
- LêPraMim: componentes OCR/MP3/DOCX com o CDN simulado (`page.route`), inclusive
  funcionando depois sem rede (cópia guardada);
- HTML único de cada programa alterado aberto direto do disco (`file://`);
- manuais em computador e celular (390 px).

## 11. Como pedir mudanças

- **Atualizar um programa:** mande a pasta atual dele (`apps/<id>`) e peça para manter as
  partes marcadas com `[Nebulosa]`.
- **Incluir um programa novo:** mande o programa; ele entra em `apps/<id>/`, ganha uma
  linha em `js/apps.js` (com `tema` e `funcao`), a ponte, a aparência Nebulosa Default, a
  assinatura e um manual em `manuais/`.
- **Trocar textos ou Pix da doação:** `js/doacao.js`.
- **Contador de acessos:** `js/acessos.js`.
- **Atualizar o Fluxo:** mande o zip do código do Fluxo (ou peça na conversa do Fluxo) e
  copie o `dist/index.html` novo para `apps/fluxo/index.html`.
- **Trocar o e-mail de contato:** `CONTATO_EMAIL` em `js/workspace.js` e o `href` do `#btnMail`
  em `index.html` (e o texto nos manuais).
- **Nova versão:** `NEBULOSA_VERSAO` em `js/apps.js` + `VERSAO` em `shared/nebulosa-bridge.js`
  (+ o número que aparece no texto dos manuais, em `manuais/*.html`).
