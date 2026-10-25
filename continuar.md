# Continuar o projeto Nebulosa Workspace

> **Para o Claude (ou qualquer pessoa) que for continuar este projeto:** leia este
> arquivo inteiro e depois o `README.md` antes de mexer em qualquer coisa.
> Responda sempre em **português do Brasil**.
>
> **Para o dono do projeto:** numa conversa nova, anexe o zip do projeto (ou mande o
> link do repositório no GitHub) e escreva: *"Leia o continuar.md e depois faça: …"*.

Última atualização: 25/10/2026 · **Versão 0.3**.

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
    Multifuncional de Imagens) · FotoFlow (Criador de Apresentações de Fotos e Vídeo)
  - Arte & Estilo de Vida: EmCanto (Importador e Editor de Partituras) · Paz no Bolso
    (Gerenciador Financeiro Pessoal) · #pratododia (Caderno e Gestor de Receitas Culinárias)
- **Manifesto** "Bem-vindo ao Nebulosa Workspace" na página inicial, na janela
  "Sobre o Workspace", no `README.md` e no manual do Workspace (texto em
  `MANIFESTO`, no topo de `js/workspace.js`).
- **Rodapé:** "Nebulosa Workspace - um pacote de programas simples, bonitos e que
  funcionam direto no navegador. Versão 0.3" na página inicial, no Sobre, nos manuais,
  no Sobre do Stardust e nas telas iniciais do EmCanto, PazNoBolso e #pratododia
  (`.nb-rodape`).

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
assets/img/                logotipos do Workspace
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

## 4. Os 9 programas

| Alt | id | Nome | Grupo no menu | Forma |
|---|---|---|---|---|
| 1 | typee | Typee | Escrever e apresentar | um `index.html` + `nebulosa-skin.css` |
| 2 | flyde | Flyde | Escrever e apresentar | um `index.html` + `nebulosa-skin.css` |
| 3 | stardust | Stardust (novo na 0.3) | Escrever e apresentar | `index.html`, `css/`, `js/`, `libs/`, `assets/` + `nebulosa-skin.css` |
| 4 | emcanto | EmCanto | Música e leitura | um `index.html` (≈11 MB, versão nova com recursos embutidos) + `nebulosa-skin.css` |
| 5 | lepramim | LêPraMim | Música e leitura | projeto completo (css/, js/, libs/, assets/) |
| 6 | paznobolso | PazNoBolso | Dia a dia | um `index.html` + `nebulosa-skin.css` |
| 7 | pratododia | #pratododia | Dia a dia | um `index.html` (≈3 MB) + `nebulosa-skin.css` |
| 8 | imaginarium | Imaginarium | Imagens e vídeo | projeto completo (css/, js/, help/) |
| 9 | fotoflow | FotoFlow | Imagens e vídeo | projeto completo + `nebulosa-skin.css` |

A ordem em `js/apps.js` é a ordem do menu e dos atalhos `Alt+1…9`
(a entrada do Stardust deslocou os atalhos dos programas seguintes).

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
  `colW`, `rowH`, `merges`, `charts`, `freeze`, `hiddenRows`, `filter`), endereços A1,
  leitura de entrada à brasileira e formatador de códigos de número do Excel.
- `js/formulas.js`: tokenizador/analisador/avaliador. Fórmulas guardadas em inglês com
  vírgula (canônico do Excel); `toDisplay()`/`toCanonical()` traduzem para pt-BR com `;`.
  Recalcula a pasta inteira a cada alteração (detecção de referência circular → `#CIRC!`).
  Funções novas do Excel são gravadas com `_xlfn.`.
- `js/arquivos.js`: XLSX/XLSM próprios (JSZip) com estilos, mescladas, painéis, filtro e
  **gráficos nativos** (DrawingML); leitura própria de XLSX (estilos, fórmulas compartilhadas,
  gráficos); SheetJS para XLS/XLSB/ODS; CSV próprio; PDF com pdf-lib (texto vetorial,
  gráficos no fim); JPG em canvas.
- `js/grade.js`: grade em canvas com eixos de tamanhos variáveis, painéis congelados,
  edição por textarea sobre a célula, apontar referências com o mouse, alça de
  preenchimento, redimensionar, camada de gráficos.
- `js/app.js`: interface, desfazer/refazer (por célula ou por planilha), menus, painel de
  funções e de gráfico, janelas (Formatar células, Classificar, Localizar, Salvar como),
  modelos, recuperação e integração com a ponte.
- Testado: digitação, fórmulas, preencher, desfazer, classificar, filtro, gráficos,
  aparências, e os 8 formatos de saída — abertos de volta no LibreOffice (XLSX com
  gráfico renderizado), no openpyxl e no próprio Stardust; leitura de XLSX do openpyxl e do
  LibreOffice, XLS, ODS e CSV.
- Ainda não tem: macros, tabelas dinâmicas, formatação condicional, validação de dados,
  comentários, seleção múltipla com Ctrl.

## 8. LêPraMim e a voz neural (Piper)

- No GitHub Pages a voz Piper (Cadu, Faber, Jeff, Edresson) é baixada na primeira leitura
  do jsDelivr e do Hugging Face e fica no Cache do navegador. **Testado no GitHub Pages:
  baixa e lê.** Endereços em `apps/lepramim/js/config.js` → `PIPER_WEB`. A CSP do
  `apps/lepramim/index.html` libera esses sites e o endereço do contador de acessos.
- O LêPraMim avisa no canto do Workspace quando um audiobook fica pronto e quando a voz
  termina de baixar.

## 9. Pendências e ideias

- [ ] Opcional: fazer OCR (Tesseract.js), MP3 (lamejs) e DOCX (Mammoth.js) do LêPraMim
      também baixarem sozinhos pela internet, do mesmo jeito que a voz (pedir permissão,
      baixar do jsDelivr, guardar no Cache do navegador). Hoje, no site, sem a pasta
      `libs/` enviada: PDF digitalizado não tem OCR, o audiolivro sai em WAV e o DOCX
      usa o leitor interno.
- [ ] Typee: a função oficial do cartão diz "Leitor e Conversor de PDF". Hoje o Typee
      converte documentos em PDF (pela impressão), mas não abre PDF. Se for desejado,
      acrescentar a leitura/importação de PDF no próprio Typee (ex.: com PDF.js, como o
      LêPraMim).
- [ ] Stardust: formatação condicional, validação de dados, comentários e tabelas
      dinâmicas são os próximos passos naturais.
- [ ] Imaginarium: pedido antigo (feito na conversa própria dele) de deixar os menus e os
      controles de transformação iguais aos do Photopea. É trabalho do programa.

## 10. Como foi testado (para repetir)

Servidor local (`python3 -m http.server`) e Playwright/Chromium:

- os 9 programas abrem no Workspace (`Alt+1…9`), mostram a assinatura e trocam de aparência;
- aviso ao fechar com alterações (Stardust), atalhos, nova janela do Typee;
- lembrete de doação com relógio acelerado (aparece aos 2 min e de novo aos 30 min);
- janela de Acessos (sem rede no ambiente de teste: mostra a contagem local);
- Stardust: ver item 7; LibreOffice e openpyxl para conferir os arquivos gerados;
- manuais em computador e celular (390 px).

## 11. Como pedir mudanças

- **Atualizar um programa:** mande a pasta atual dele (`apps/<id>`) e peça para manter as
  partes marcadas com `[Nebulosa]`.
- **Incluir um programa novo:** mande o programa; ele entra em `apps/<id>/`, ganha uma
  linha em `js/apps.js` (com `tema` e `funcao`), a ponte, a aparência Nebulosa Default, a
  assinatura e um manual em `manuais/`.
- **Trocar textos ou Pix da doação:** `js/doacao.js`.
- **Contador de acessos:** `js/acessos.js`.
- **Nova versão:** `NEBULOSA_VERSAO` em `js/apps.js` + `VERSAO` em `shared/nebulosa-bridge.js`
  (+ o número que aparece no texto dos manuais, em `manuais/*.html`).
