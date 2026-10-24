# Nebulosa Workspace

Os programas da família Nebulosa num só lugar, direto no navegador:
**Typee** (documentos), **Flyde** (apresentações), **EmCanto** (partituras),
**LêPraMim** (leitura e audiolivros), **PazNoBolso** (orçamento doméstico),
**#pratododia** (receitas), **Imaginarium** (editor de imagens) e
**FotoFlow** (filmes com fotos).

O Workspace é só a "casca": menu lateral, abas, busca (`Alt+K`) e o painel de
aparência. **Cada programa mora na própria pasta e continua sendo um programa
independente** — dá para abrir qualquer um sozinho, e dá para atualizar um sem
mexer nos outros.

## Estrutura

```
nebulosa-workspace/
├── index.html                 a casca do Workspace (só a estrutura da página)
├── css/workspace.css          visual do Workspace
├── js/
│   ├── apps.js                LISTA DOS PROGRAMAS (nome, pasta, cores, descrição)
│   ├── doacao.js              DADOS DA DOAÇÃO (Pix Copia e Cola, textos e lembretes)
│   ├── icons.js               ícones do menu e dos cartões
│   ├── qrcode.js              gera o QR Code do Pix no próprio navegador
│   ├── notificacoes.js        canto de notificações e histórico (sino)
│   ├── theme.js               tema claro/escuro do Workspace (carrega antes da página)
│   └── workspace.js           lógica do Workspace (abas, busca, aparência, conversa com os programas)
├── assets/img/                logotipos do Workspace
├── shared/
│   └── nebulosa-bridge.js     PONTE: o único arquivo que os programas usam para falar com o Workspace
├── apps/                      um programa por pasta, cada um com o seu index.html
│   ├── typee/                 index.html + nebulosa-skin.css
│   ├── flyde/                 index.html + nebulosa-skin.css
│   ├── emcanto/               index.html + nebulosa-skin.css
│   ├── paznobolso/            index.html + nebulosa-skin.css
│   ├── pratododia/            index.html + nebulosa-skin.css
│   ├── lepramim/              projeto completo (css/, js/, libs/, assets/…)
│   ├── imaginarium/           projeto completo (css/, js/, help/, assets/…)
│   └── fotoflow/              projeto completo (index.html, styles.css, *.js, assets/) + nebulosa-skin.css
└── .nojekyll                  diz ao GitHub Pages para publicar os arquivos como estão
```

## Publicar no GitHub Pages

1. Envie todo o conteúdo desta pasta para a raiz do repositório
   (o `index.html` do Workspace fica na raiz).
2. No GitHub: **Settings › Pages › Build and deployment** → *Deploy from a branch*,
   branch `main`, pasta `/ (root)`.
3. Abra o endereço que o GitHub mostrar (`https://<usuário>.github.io/<repositório>/`).

Cada programa também tem endereço próprio, por exemplo
`…/apps/typee/` — dá para abrir um programa sozinho, fora do Workspace.

**Voz neural do LêPraMim (Piper) no site:** funciona sem instalar nada. Na
primeira leitura o LêPraMim pede permissão e baixa a voz escolhida (Cadu, Faber,
Jeff ou Edresson; cerca de 60 MB, mais uns 25 MB do motor) do jsDelivr e do
Hugging Face — os mesmos endereços do `Baixar-Bibliotecas`. A voz fica guardada
no navegador e o texto dos livros nunca sai do computador. Os endereços estão em
`apps/lepramim/js/config.js` (`PIPER_WEB`).

As outras bibliotecas opcionais do LêPraMim (OCR, MP3 e DOCX) não vêm no
pacote. Para tê-las no site, rode uma vez no computador o
`apps/lepramim/Baixar-Bibliotecas.bat` e envie também a pasta
`apps/lepramim/libs/` que ele cria.

> Os dados de cada programa (documentos recentes, biblioteca, preferências)
> ficam guardados no navegador de quem usa, ligados ao endereço do site.

## Como atualizar um programa

Cada programa é uma pasta em `apps/`. Para atualizar, troque só os arquivos
daquela pasta — o Workspace e os outros programas não são tocados.

1. Substitua o conteúdo de `apps/<programa>/` pela versão nova.
   O arquivo principal precisa continuar se chamando **`index.html`**.
2. Mantenha as **partes de integração**, todas marcadas com `[Nebulosa]` no
   código (tabela abaixo). Se a versão nova vier sem elas, o programa abre e
   funciona normalmente no Workspace; ele só deixa de oferecer as aparências
   pelo Workspace e de avisar sobre alterações não salvas ao fechar a aba.
3. Confira se o nome da pasta continua igual ao `path` em `js/apps.js`
   (no GitHub, maiúsculas e minúsculas contam).

**Dica:** ao pedir uma atualização de um programa numa conversa com o Claude,
envie a pasta do programa que está aqui (`apps/<programa>`) e peça para
"manter as partes marcadas com [Nebulosa]".

### Partes de integração de cada programa

| Programa | Onde está a integração |
|---|---|
| Typee | `index.html`: ponte no `<head>`, link do `nebulosa-skin.css`, botão "Aparência", nova aba pelo Workspace e um bloco no fim do script · `nebulosa-skin.css` |
| Flyde | `index.html`: ponte no `<head>`, link do `nebulosa-skin.css`, botão "Aparência", cores do tema de slides "Nebulosa" · `nebulosa-skin.css` |
| EmCanto | `index.html`: ponte no `<head>`, link do `nebulosa-skin.css`, campo "Aparência (skin)" nas Configurações, aviso de alterações (último `<script>`) · `nebulosa-skin.css` |
| PazNoBolso | `index.html`: ponte no `<head>`, link do `nebulosa-skin.css`, ação `A.skin` + aviso de alterações, "Visual do programa" em Ajustes · `nebulosa-skin.css` |
| #pratododia | `index.html`: ponte no `<head>`, link do `nebulosa-skin.css`, "Visual do programa" em Configurações › Aparência (`PD.entrada.ajVisual`), aviso de alterações (último `<script>`) · `nebulosa-skin.css` |
| LêPraMim | `index.html` (ponte e link do CSS), `js/configuracoes.js` ("Visual" nas Configurações), `js/gerador.js` e `js/piper.js` (avisos no canto do Workspace), `sw.js` (cache), `css/aparencia-nebulosa.css` |
| Imaginarium | `index.html` (ponte com `data-provider` e link do CSS), `js/core/skins.js` (aparência Nebulosa e registro na ponte), `css/skin-nebulosa.css` |
| FotoFlow | `index.html`: ponte e link do CSS no `<head>`, botão "Aparência" na barra, bloco depois do `app.js` (aviso de alterações) · `nebulosa-skin.css` |

## Como incluir um programa novo

1. Crie a pasta `apps/<id>/` com o `index.html` do programa
   (`<id>` em minúsculas, sem espaços nem acentos).
2. Acrescente o programa em `js/apps.js` (o próprio arquivo explica cada campo).
   A ordem da lista é a ordem do menu e dos atalhos `Alt+1`, `Alt+2`…
3. Opcional — para ter as aparências e o aviso de alterações, coloque a ponte
   no `<head>` do programa:

   ```html
   <script src="../../shared/nebulosa-bridge.js" data-app="<id>" data-name="Nome"></script>
   ```

   e crie a aparência Nebulosa num CSS do próprio programa, com regras que
   começam por `:root[data-skin="nebulosa"]`. Para avisar sobre alterações não
   salvas, o programa define `window.__nebulosaDirty = () => true/false`.
   Todas as opções da ponte estão comentadas no topo de
   `shared/nebulosa-bridge.js`.

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
- **Lembrete de doação:** mais ou menos a cada hora de uso aparece um aviso
  curto com o botão "Doar com Pix" (as mensagens se revezam). Nunca logo que o
  site abre, nem com uma janela aberta, nem com a aba escondida; quem copia o
  Pix fica 3 dias sem lembretes. Tudo ajustável em `js/doacao.js` (`lembretes`).
- **Avisos dos programas:** dentro de um programa com a ponte,
  `NebulosaSkin.notificar({ titulo, texto, tipo })` (tipo `info`, `sucesso`,
  `aviso` ou `erro`) manda um aviso para o canto do Workspace. Se o programa
  está na tela, o aviso vai só para o sino (o programa já mostra o dele), a
  menos que use `sempre: true`. Clicar no aviso abre o programa. Hoje o
  LêPraMim avisa quando um audiobook fica pronto e quando a voz Piper termina
  de baixar.

## Aparências

Cada programa tem o visual original dele ("<Programa> Default") e o
**Nebulosa Default** — roxo `#A778FF`, azul-marinho `#323559`, laranja
`#FF9C54` e amarelo `#FEFF36`. A troca vale só para aquele programa e pode ser
feita no botão **Aparência** do Workspace, dentro do próprio programa, ou para
todos de uma vez ("Usar Nebulosa Default em todos").
