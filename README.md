# Nebulosa Workspace

> **Bem-vindo ao Nebulosa Workspace**
>
> O Nebulosa Workspace é uma suíte de aplicativos web gratuitos, leves e de código
> aberto, desenvolvidos para funcionar direto no seu navegador, em qualquer
> computador, sem necessidade de instalação.
>
> Organizado em três temáticas — Produtividade, Criatividade e Estilo de Vida.
>
> O ecossistema reúne ferramentas acessíveis para simplificar suas tarefas diárias,
> desde a edição de documentos e criação de vídeos até a organização financeira e
> culinária.
>
> Explore nossas temáticas e descubra como o Nebulosa Workspace pode impulsionar
> suas ideias.

**Versão 0.4** · Nebulosa Workspace - um pacote de programas simples, bonitos e
que funcionam direto no navegador.

## Os programas

| Temática | Programa | Função prática | Pasta |
|---|---|---|---|
| Produtividade & Dados | **Typee** | Editor de Texto, Leitor e Conversor de PDF | `apps/typee/` |
| Produtividade & Dados | **Stardust** | Planilhas de Cálculo e Gráficos | `apps/stardust/` |
| Produtividade & Dados | **LêPraMim** | Leitor de Textos e Audiolivros | `apps/lepramim/` |
| Mídia & Criatividade | **Flyde** | Apresentações em Slides | `apps/flyde/` |
| Mídia & Criatividade | **Imaginarium** | Editor Multifuncional de Imagens | `apps/imaginarium/` |
| Mídia & Criatividade | **FotoFlow** | Criador de Apresentações de Fotos e Vídeo | `apps/fotoflow/` |
| Mídia & Criatividade | **Fluxo** *(novo na 0.4)* | Editor de Vídeo e Motion Design | `apps/fluxo/` |
| Arte & Estilo de Vida | **EmCanto** | Importador e Editor de Partituras | `apps/emcanto/` |
| Arte & Estilo de Vida | **Paz no Bolso** (PazNoBolso) | Gerenciador Financeiro Pessoal | `apps/paznobolso/` |
| Arte & Estilo de Vida | **#pratododia** | Caderno e Gestor de Receitas Culinárias | `apps/pratododia/` |

Cada programa assina no topo como **“[Nome] by Nebulosa Workspace”**.
Os cartões da página inicial ficam agrupados pelas três temáticas, com a função
prática de cada programa; o menu lateral continua com os grupos de sempre.
Ao lado da apresentação "Bem-vindo ao Nebulosa Workspace" fica o **logotipo**: a
nebulosa com os ícones dos 10 programas em órbita (versão escura e clara, conforme
o tema). O PNG com fundo transparente fica em `assets/img/nebulosa-workspace-logo.png`
e pode ser baixado em **Sobre o Workspace › Baixar logotipo**.

**Licença:** código aberto sob a **licença MIT** (arquivo `LICENSE`). Bibliotecas, fontes e vozes
de terceiros seguem as licenças delas — lista em `legal/creditos.html`. Também há
`legal/termos.html` (Termos de uso) e `legal/privacidade.html` (Privacidade), com links no rodapé
da página inicial, no "Sobre" e nos manuais. Na primeira visita aparece uma **faixa discreta no
rodapé** (não é popup e não bloqueia nada) dizendo que usar o site vale como concordância com os
termos; "Entendi" esconde a faixa (`localStorage["nebulosa.termos"]`). Ao mudar os termos, troque
`TERMOS_VERSAO` em `js/workspace.js` para a faixa aparecer de novo.

**Contato:** nebulosaworkspace@gmail.com — botão do envelope no alto do Workspace
(antes do sino) e no fim da janela "Sobre o Workspace". Ele abre o painel "Fale conosco"
com Gmail, Outlook, o programa de e-mail do computador e "Copiar endereço" (um link
`mailto:` sozinho não faz nada em computadores sem programa de e-mail configurado).

O Workspace é só a "casca": menu lateral, abas, busca (`Alt+K`), aparência,
notificações, doação e contador de acessos. **Cada programa mora na própria pasta
e continua sendo um programa independente** — dá para abrir qualquer um sozinho,
e dá para atualizar um sem mexer nos outros.

## Estrutura

```
nebulosa-workspace/
├── index.html                 a casca do Workspace (só a estrutura da página)
├── css/workspace.css          visual do Workspace
├── js/
│   ├── apps.js                LISTA DOS PROGRAMAS, temáticas, funções práticas e VERSÃO
│   ├── doacao.js              DADOS DA DOAÇÃO (Pix Copia e Cola, textos e lembretes)
│   ├── acessos.js             CONTADOR DE ACESSOS (serviço e "espaço" dos contadores)
│   ├── icons.js               ícones do menu e dos cartões
│   ├── qrcode.js              gera o QR Code do Pix no próprio navegador
│   ├── notificacoes.js        canto de notificações e histórico (sino)
│   ├── theme.js               tema claro/escuro do Workspace (carrega antes da página)
│   └── workspace.js           lógica do Workspace (abas, busca, aparência, conversa com os programas)
├── assets/img/                logotipos do Workspace (nebulosa-workspace-logo*.png = logotipo com os 10 ícones)
├── shared/
│   └── nebulosa-bridge.js     PONTE: o único arquivo que os programas usam para falar com o Workspace
├── manuais/                   manuais de usuário (Workspace e um por programa) + manual.css
├── legal/                     termos.html, privacidade.html, creditos.html (usam manuais/manual.css)
├── LICENSE                    licença MIT do projeto
├── CNAME                      domínio próprio (nebulosaworkspace.com.br) — não apagar
├── robots.txt, sitemap.xml    para o Google encontrar o site
├── apps/                      um programa por pasta, cada um com o seu index.html
│   ├── typee/                 index.html + nebulosa-skin.css
│   ├── flyde/                 index.html + nebulosa-skin.css
│   ├── stardust/              index.html, css/, js/, libs/, assets/ + nebulosa-skin.css
│   ├── emcanto/               index.html (≈11 MB, recursos embutidos) + nebulosa-skin.css
│   ├── paznobolso/            index.html + nebulosa-skin.css
│   ├── pratododia/            index.html + nebulosa-skin.css
│   ├── lepramim/              projeto completo (css/, js/, libs/, assets/…)
│   ├── imaginarium/           projeto completo (css/, js/, help/, assets/…)
│   ├── fotoflow/              projeto completo (index.html, styles.css, *.js, assets/) + nebulosa-skin.css
│   └── fluxo/                 index.html (≈0,7 MB, editor de vídeo compilado num arquivo só)
├── continuar.md               resumo para continuar o projeto numa conversa nova
└── .nojekyll                  diz ao GitHub Pages para publicar os arquivos como estão
```

## Endereço: nebulosaworkspace.com.br

O site usa o domínio próprio **https://nebulosaworkspace.com.br** (registrado no Registro.br,
apontado para o GitHub Pages). O arquivo **`CNAME`** na raiz (uma linha:
`nebulosaworkspace.com.br`) diz isso ao GitHub — **nunca apague o `CNAME` ao enviar
atualizações**, senão o domínio para de funcionar.

DNS no Registro.br (Editar zona): quatro registros **A** sem nome → `185.199.108.153`,
`185.199.109.153`, `185.199.110.153`, `185.199.111.153`; quatro **AAAA** →
`2606:50c0:8000::153` … `2606:50c0:8003::153`; **CNAME** `www` → `<usuário>.github.io`; e o
**TXT** de verificação que o GitHub pedir (Settings da conta › Pages). No repositório:
Settings › Pages › Custom domain = `nebulosaworkspace.com.br` e **Enforce HTTPS**.

Para o Google e as redes sociais:
- `robots.txt` e `sitemap.xml` na raiz (página inicial, manuais e páginas legais);
- em cada página (início, manuais, legal/), um bloco entre `<!-- seo -->` e `<!-- /seo -->` com
  endereço canônico, prévia para WhatsApp/Facebook/X (Open Graph e Twitter Card) e, na
  página inicial, dados estruturados (schema.org);
- imagem de prévia `assets/img/og-nebulosa-workspace.jpg` (1200×630);
- os manuais funcionam como "página de cada programa" para a busca (título com a função, por
  exemplo "Fluxo — Editor de Vídeo e Motion Design grátis no navegador").
- Cadastre o site no **Google Search Console** e envie `https://nebulosaworkspace.com.br/sitemap.xml`.

Ao mudar de domínio, o que cada pessoa guardou no navegador (cópias automáticas, projetos do
Fluxo, preferências) fica no endereço antigo; os arquivos salvos no computador não são afetados.

## Publicar no GitHub Pages

1. Envie todo o conteúdo desta pasta para a raiz do repositório
   (o `index.html` do Workspace fica na raiz).
2. No GitHub: **Settings › Pages › Build and deployment** → *Deploy from a branch*,
   branch `main`, pasta `/ (root)`.
3. Abra o endereço que o GitHub mostrar (`https://<usuário>.github.io/<repositório>/`).

Cada programa também tem endereço próprio, por exemplo `…/apps/stardust/` — dá
para abrir um programa sozinho, fora do Workspace. Os manuais ficam em
`…/manuais/`.

**Voz neural do LêPraMim (Piper) no site:** funciona sem instalar nada. Na
primeira leitura o LêPraMim pede permissão e baixa a voz escolhida (Cadu, Faber,
Jeff ou Edresson; cerca de 60 MB, mais uns 25 MB do motor) do jsDelivr e do
Hugging Face. A voz fica guardada no navegador e o texto dos livros nunca sai do
computador. Os endereços estão em `apps/lepramim/js/config.js` (`PIPER_WEB`).
Testado no GitHub Pages e funcionando.

**OCR, MP3 e DOCX do LêPraMim no site:** também baixam sozinhos, do mesmo jeito
que a voz. Na primeira vez em que são necessários, o LêPraMim pede permissão,
mostra o progresso e guarda o componente no navegador:

| Componente | Quando baixa | Tamanho | Sem ele |
|---|---|---|---|
| OCR (Tesseract.js) | ao "Reconhecer texto" de um PDF digitalizado ou imagem | ~18 MB + idioma | PDF de fotos não tem texto |
| MP3 (lamejs) | ao gerar audiolivro em MP3 | ~0,2 MB | o audiolivro sai em WAV |
| DOCX (Mammoth.js) | ao abrir o primeiro .docx | ~0,7 MB | usa o leitor interno |

Código em `apps/lepramim/js/bibliotecas-web.js`; endereços em
`apps/lepramim/js/config.js` (`LIBS_WEB`). Quem preferir pode ainda rodar
`apps/lepramim/Baixar-Bibliotecas.bat` e enviar a pasta `apps/lepramim/libs/`:
com ela nada é baixado na hora.

**Typee abre PDF:** o botão Abrir aceita `.pdf` e transforma o texto num
documento editável (títulos, parágrafos e listas); depois é só salvar em Word.
O PDF.js usado fica em `apps/typee/libs/pdfjs/` e só é carregado quando um PDF é
aberto.

> Os dados de cada programa (documentos recentes, biblioteca, preferências)
> ficam guardados no navegador de quem usa, ligados ao endereço do site.

## Fluxo (editor de vídeo) — novo na versão 0.4

Em `apps/fluxo/`. Editor de vídeo e motion design (estilo CapCut / After Effects):
linha do tempo com várias faixas, 44 filtros, 50 efeitos (86 variações), 58
transições, títulos animados, câmera 3D, movimento de drone, máscaras com
rotoscopia, rodas de cor, partículas, adesivos e GIFs, modelos de projeto,
agrupar camadas, separar/unir áudio e ducking. Exporta em MP4 (H.264/H.265),
MOV (H.264/ProRes), MKV, WebM e AVI, e só o áudio em MP3 ou WAV. Chroma key com
conta-gotas (Fluxo 0.4.1). **WMV não existe em navegador** (codec
fechado da Microsoft) — o próprio Fluxo explica e sugere MP4.

- O `index.html` é **gerado** a partir do código-fonte do Fluxo (React +
  TypeScript, projeto separado `fluxo-v0.4-codigo.zip`): `npm run build` e copiar
  `dist/index.html` para `apps/fluxo/index.html`. Não edite o arquivo gerado à mão.
- Integração marcada `[Nebulosa]` no código-fonte: `src/template.html` (ponte),
  `src/ui/TopBar.tsx` (assinatura), fim de `src/styles/app.css` (aparência Nebulosa
  Default, sem `nebulosa-skin.css` separado) e `src/main.tsx` (aviso ao fechar
  durante uma exportação).
- Tudo roda no navegador; precisa de Chrome/Edge atualizados (WebCodecs) para exportar.
- O Fluxo é o 10º programa: não tem atalho `Alt+número` (os `Alt+1…9` continuam
  como estavam); abre pelo menu, cartão ou busca.

## Stardust (planilhas)

Programa novo da versão 0.3, em `apps/stardust/`. Visual irmão do Imaginarium
(carvão/grafite, azul e o "espectro" de cores), com modo claro e a aparência
Nebulosa Default.

- Fórmulas em português com `;` e vírgula decimal (`=SOMA(A1:A10;2,5)`), aceitando
  também os nomes em inglês. Mais de 120 funções (SOMA, MÉDIA, SE, SES, SEERRO, PROCV,
  PROCX, ÍNDICE, CORRESP, SOMASE(S), CONT.SE(S), DATADIF, PGTO, TIR…), com
  autocompletar e dica de argumentos. Por dentro (e nos arquivos) as fórmulas ficam
  no formato do Excel em inglês.
- Formatação, bordas, mesclar, formatos de número (R$, %, datas), congelar painéis,
  classificar, filtro, remover duplicadas, localizar e substituir, várias planilhas,
  desfazer/refazer, alça de preenchimento com séries, copiar/colar com o Excel.
- Gráficos: colunas, barras, linhas, área, pizza, rosca e dispersão.
- **Formatação condicional** (maior/menor/entre/igual/contém, repetidos, acima da
  média, escala de cores, barras de dados), **validação de dados** (lista suspensa
  com opções ou intervalo, números, datas, tamanho do texto; bloquear ou só avisar)
  e **comentários** nas células (`Shift+F2`), gravados no XLSX/XLSM.
- Abre: XLSX, XLSM, XLSB, XLS, ODS, CSV/TSV/TXT.
- Salva/exporta: **XLSX e XLSM** (com formatação, gráficos nativos do Excel,
  formatação condicional, validação e comentários), **XLSB, XLS e ODS** (valores,
  fórmulas quando o formato aceita, formatos de número, larguras e mescladas — sem
  cores, gráficos, regras e comentários; decidido manter assim), **CSV**, **PDF** e
  **JPG**.
- Bibliotecas em `apps/stardust/libs/`: SheetJS Community 0.18.5 (Apache 2.0),
  JSZip 3.10.1 (MIT) e pdf-lib 1.17.1 (MIT), com as licenças ao lado.
- Código: `js/nucleo.js` (modelo, endereços, formatos de número), `js/formulas.js`
  (motor de fórmulas), `js/graficos.js`, `js/regras.js` (formatação condicional,
  validação e comentários), `js/arquivos.js` (abrir/salvar),
  `js/grade.js` (a grade em canvas) e `js/app.js` (interface).
- Link direto para um modelo: `apps/stardust/#modelo=orcamento` (também `notas`,
  `vendas`, `compras`).

## Contador de acessos

- Conta a página inicial do Workspace e a página inicial de cada programa
  (quando o `apps/<id>/index.html` abre, dentro do Workspace ou sozinho).
- O botão discreto **Acessos**, no rodapé da página inicial, mostra a lista com os
  números atualizados e o total.
- O site é estático, então a contagem usa um serviço gratuito de contadores
  (Abacus, `https://abacus.jasoncameron.dev`), que guarda só um número por página.
  Configuração em `js/acessos.js` (`servico` e `espaco`; trocar o `espaco` começa
  do zero). Cada página conta no máximo uma vez por sessão do navegador; abrindo do
  próprio computador (`file://` ou `localhost`) não conta.
- Nos programas, quem carrega o contador é a ponte (`shared/nebulosa-bridge.js`),
  então nenhum programa precisa de código próprio para isso. O LêPraMim tem uma
  política de segurança (CSP) que libera o endereço do serviço.
- Se o serviço sair do ar, a lista mostra os acessos daquele navegador e avisa.
  Para trocar de serviço, só `js/acessos.js` muda (e a CSP do LêPraMim).

## Como atualizar um programa

Cada programa é uma pasta em `apps/`. Para atualizar, troque só os arquivos
daquela pasta — o Workspace e os outros programas não são tocados.

1. Substitua o conteúdo de `apps/<programa>/` pela versão nova.
   O arquivo principal precisa continuar se chamando **`index.html`**.
2. Mantenha as **partes de integração**, todas marcadas com `[Nebulosa]` no
   código (tabela abaixo). Se a versão nova vier sem elas, o programa abre e
   funciona normalmente no Workspace; ele só deixa de oferecer as aparências
   pelo Workspace, de avisar sobre alterações não salvas, de contar acessos e de
   mostrar a assinatura "by Nebulosa Workspace".
3. Confira se o nome da pasta continua igual ao `path` em `js/apps.js`
   (no GitHub, maiúsculas e minúsculas contam).

**Dica:** ao pedir uma atualização de um programa numa conversa com o Claude,
envie a pasta do programa que está aqui (`apps/<programa>`) e peça para
"manter as partes marcadas com [Nebulosa]".

### Partes de integração de cada programa

Em todos: a ponte no `<head>` (que também conta os acessos e dá o estilo da
assinatura), o link do CSS da aparência Nebulosa e a assinatura
`<small class="nb-by">by Nebulosa Workspace</small>` ao lado do nome.

| Programa | Onde está a integração |
|---|---|
| Typee | `index.html`: ponte no `<head>`, link do `nebulosa-skin.css`, assinatura no `.brand`, botão "Aparência", nova aba pelo Workspace, abrir PDF (`openPdf`, marcado `[Nebulosa] PDF`) e um bloco no fim do script · `nebulosa-skin.css` (inclui o tamanho da assinatura) · `libs/pdfjs/` |
| Flyde | `index.html`: ponte no `<head>`, link do `nebulosa-skin.css`, assinatura no `.brand`, botão "Aparência", cores do tema de slides "Nebulosa" · `nebulosa-skin.css` |
| Stardust | `index.html`: ponte no `<head>` (com `data-modes`), link do `nebulosa-skin.css`, assinatura na `.marca`, aviso de alterações (último `<script>`) · `nebulosa-skin.css` |
| EmCanto | `index.html`: ponte no `<head>`, link do `nebulosa-skin.css`, assinatura no `brandmark` (função que monta a barra), rodapé Nebulosa na tela inicial, campo "Aparência (skin)" nas Configurações, aviso de alterações (último `<script>`) · `nebulosa-skin.css` |
| PazNoBolso | `index.html`: ponte no `<head>`, link do `nebulosa-skin.css`, assinatura no nome (tela inicial e menu) e rodapé Nebulosa na tela inicial (`telaInicio`/`casca`), ação `A.skin` + aviso de alterações, "Visual do programa" em Ajustes · `nebulosa-skin.css` |
| #pratododia | `index.html`: ponte no `<head>`, link do `nebulosa-skin.css`, assinatura na tela inicial e na marca do menu (`UI.moldura`), rodapé Nebulosa na tela inicial, "Visual do programa" em Configurações › Aparência (`PD.entrada.ajVisual`), aviso de alterações (último `<script>`) · `nebulosa-skin.css` |
| LêPraMim | `index.html` (ponte, link do CSS, assinatura na `.marca`, o `js/bibliotecas-web.js` e, na CSP, o contador de acessos e o `tessdata.projectnaptha.com`), `js/bibliotecas-web.js` (OCR/MP3/DOCX baixados na hora), `js/config.js` (`LIBS_WEB`), `js/importadores.js` e `js/gerador.js` (uso dos componentes; avisos no canto do Workspace), `js/configuracoes.js` ("Visual" e situação dos componentes), `js/ajuda.js`, `js/piper.js`, `sw.js` (cache), `css/aparencia-nebulosa.css` |
| Imaginarium | `index.html` (ponte com `data-provider`, link do CSS e assinatura no `.brand`), `js/core/skins.js` (aparência Nebulosa e registro na ponte), `css/skin-nebulosa.css` |
| FotoFlow | `index.html`: ponte e link do CSS no `<head>`, assinatura no `.brand`, botão "Aparência" na barra, bloco depois do `app.js` (aviso de alterações) · `nebulosa-skin.css` |
| Fluxo | no **código-fonte** do Fluxo (o `index.html` é gerado): `src/template.html` (ponte), `src/ui/TopBar.tsx` (assinatura `.nb-by`), `src/styles/app.css` (fim: `:root[data-skin="nebulosa"]`), `src/main.tsx` e `src/ui/dialogs/ExportDialog.tsx` (aviso de alterações = exportação em andamento) |

## Como incluir um programa novo

1. Crie a pasta `apps/<id>/` com o `index.html` do programa
   (`<id>` em minúsculas, sem espaços nem acentos).
2. Acrescente o programa em `js/apps.js` (o próprio arquivo explica cada campo,
   inclusive `tema` e `funcao`, usados nos cartões da página inicial).
   A ordem da lista é a ordem do menu e dos atalhos `Alt+1`, `Alt+2`… (só os 9
   primeiros têm atalho; programas novos entram no fim para não mudar os atalhos)
3. Coloque a ponte no `<head>` do programa:

   ```html
   <script src="../../shared/nebulosa-bridge.js" data-app="<id>" data-name="Nome"></script>
   ```

   crie a aparência Nebulosa num CSS do próprio programa, com regras que
   começam por `:root[data-skin="nebulosa"]`, e ponha a assinatura
   `<small class="nb-by">by Nebulosa Workspace</small>` ao lado do nome.
   Para avisar sobre alterações não salvas, o programa define
   `window.__nebulosaDirty = () => true/false`. Todas as opções da ponte estão
   comentadas no topo de `shared/nebulosa-bridge.js`.
4. Crie o manual em `manuais/<id>.html` (copie um existente como modelo) e
   acrescente o programa na lista de `manuais/index.html`.

Um programa que ainda não está pronto pode entrar na lista com `soon: true`:
ele aparece como "em breve" e não abre.

## Como o Workspace conversa com os programas

O Workspace abre cada programa num `<iframe>` (`apps/<id>/index.html`) e os dois
conversam só por mensagens (`postMessage`). O Workspace nunca lê nem altera o
código de dentro de um programa, e nenhum programa depende do Workspace para
funcionar. As mensagens estão documentadas no topo de `js/workspace.js`; a
escolha de aparência de cada programa fica guardada em
`localStorage["nebulosa.skin.<id>"]`.

## Doação e notificações

- **Doe com Pix:** botão no fim do menu lateral (no celular, o coração na barra
  de cima) e na busca (`Alt+K`). Abre a janela de apoio com o Pix Copia e Cola e
  o QR Code. O QR é desenhado pelo próprio site a partir do código, sem nenhum
  serviço de fora. **Para trocar a chave ou os textos, edite só `js/doacao.js`.**
- **Canto de notificações (canto superior direito):** avisos que somem sozinhos
  (param enquanto o mouse está em cima). O sino na barra de cima guarda o
  histórico, com o número de avisos novos.
- **Lembrete de doação:** o primeiro aparece **2 minutos depois de abrir a
  página**, e depois **a cada 30 minutos** de uso, com o botão "Doar com Pix" (as
  mensagens se revezam). Nunca com uma janela aberta nem com a aba escondida;
  quem copia o Pix fica 3 dias sem lembretes. Tudo ajustável em `js/doacao.js`
  (`lembretes`: `primeiroAposMinutos`, `intervaloMinutos`, `variacaoPorcento`,
  `pausaDepoisDeCopiarHoras`).
- **Avisos dos programas:** dentro de um programa com a ponte,
  `NebulosaSkin.notificar({ titulo, texto, tipo })` (tipo `info`, `sucesso`,
  `aviso` ou `erro`) manda um aviso para o canto do Workspace. Hoje o LêPraMim
  avisa quando um audiolivro fica pronto e quando a voz Piper termina de baixar,
  e o Stardust quando uma planilha é aberta, salva ou exportada.

## Aparências

Cada programa tem o visual original dele ("<Programa> Default") e o
**Nebulosa Default** — roxo `#A778FF`, azul-marinho `#323559`, laranja
`#FF9C54` e amarelo `#FEFF36`. A troca vale só para aquele programa e pode ser
feita no botão **Aparência** do Workspace, dentro do próprio programa, ou para
todos de uma vez ("Usar Nebulosa Default em todos").

## Versão

A versão aparece no rodapé da página inicial, na janela "Sobre o Workspace", nos
manuais e no rodapé de alguns programas. Ela fica em dois lugares, que devem
andar juntos: `NEBULOSA_VERSAO` em `js/apps.js` e `VERSAO` em
`shared/nebulosa-bridge.js` (os manuais repetem o número no texto).

## Arquivos HTML únicos

Cada programa também é distribuído como **um único arquivo .html** (com a ponte,
os estilos, os scripts e as imagens embutidos), para abrir com dois cliques, sem
servidor e sem internet. Esses arquivos ficam fora do repositório (são gerados a
partir das pastas `apps/<id>/`). No HTML único o contador de acessos fica
desligado (não há site para contar).
