# Nebulosa Workspace

Os programas da família Nebulosa num só lugar, direto no navegador:
**Typee** (documentos), **Flyde** (apresentações), **EmCanto** (partituras),
**LêPraMim** (leitura e audiolivros), **PazNoBolso** (orçamento doméstico) e
**Imaginarium** (editor de imagens).

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
│   ├── icons.js               ícones do menu e dos cartões
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
│   ├── lepramim/              projeto completo (css/, js/, libs/, assets/…)
│   └── imaginarium/           projeto completo (css/, js/, help/, assets/…)
├── tools/servidor-local.ps1   servidor local usado pelo Iniciar-Workspace.bat
├── Iniciar-Workspace.bat      abre tudo num servidor local (Windows)
└── iniciar.sh                 o mesmo para Linux e macOS
```

## Como abrir

- **No GitHub Pages** (recomendado): publique o repositório (Settings › Pages ›
  branch `main`, pasta `/ (root)`) e abra o endereço do site. Tudo funciona.
- **No computador, com todos os recursos:** dê duplo clique em
  `Iniciar-Workspace.bat` (Windows) ou rode `sh iniciar.sh` (Linux/macOS).
  Abre em `http://localhost:8780/`.
- **No computador, modo simples:** duplo clique no `index.html`. Quase tudo
  funciona; o OCR e a voz Piper do LêPraMim pedem um dos dois modos acima.

As bibliotecas opcionais do LêPraMim (OCR, MP3 e a voz neural Piper, cerca de
90 MB) não vêm no pacote: rode `apps/lepramim/Baixar-Bibliotecas.bat` uma vez e,
se quiser que elas funcionem também no GitHub Pages, envie junto a pasta
`apps/lepramim/libs/`.

> Os dados de cada programa (documentos recentes, biblioteca, preferências)
> ficam guardados no navegador **por endereço**: o site no GitHub Pages, o
> `localhost:8780` e o arquivo aberto do disco têm memórias separadas.

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
| LêPraMim | `index.html` (ponte e link do CSS), `js/configuracoes.js` ("Visual" nas Configurações), `sw.js` (cache), `css/aparencia-nebulosa.css` |
| Imaginarium | `index.html` (ponte com `data-provider` e link do CSS), `js/core/skins.js` (aparência Nebulosa e registro na ponte), `css/skin-nebulosa.css` |

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

## Aparências

Cada programa tem o visual original dele ("<Programa> Default") e o
**Nebulosa Default** — roxo `#A778FF`, azul-marinho `#323559`, laranja
`#FF9C54` e amarelo `#FEFF36`. A troca vale só para aquele programa e pode ser
feita no botão **Aparência** do Workspace, dentro do próprio programa, ou para
todos de uma vez ("Usar Nebulosa Default em todos").
