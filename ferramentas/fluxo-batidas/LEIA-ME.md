# Fluxo 0.4.2 — batidas editáveis

Antes, as batidas da música só podiam ser detectadas (botão **Batidas**) e marcadas ou
desmarcadas na agulha (tecla **M**). Agora cada batida da régua da linha do tempo pode ser
escolhida, arrastada, posta, tirada e ajustada (tempo exato e força). Tudo passa pelo desfazer.

**Atenção:** o código-fonte do Fluxo (`fluxo-v0.4-codigo.zip`, React + TypeScript) não estava
disponível, então o recurso foi feito **direto no arquivo compilado** `apps/fluxo/index.html`,
com todas as partes marcadas `[Nebulosa] Fluxo 0.4.2`. Um build novo do Fluxo feito a partir do
código-fonte antigo **apaga o recurso**. Antes do próximo build, leve-o para o código-fonte
(peça ao Claude, mandando o zip do código-fonte do Fluxo e esta pasta).

## Arquivos

- `nb-batidas.js` — o módulo inteiro (comentado): seleção, arrastar, menus, painel e teclado.
  Usa as funções do Fluxo pelos nomes curtos do build atual (`f` = a "loja" do projeto, `J` =
  agulha, `Z` = reprodução, `O` = JSX, `kt` = ler a interface, `ta` = menu do botão direito,
  `gt` = linha com controle deslizante, `wt` = seção recolhível, `uo` = mudar com desfazer,
  `tr` = tempo `mm:ss.qq`, `De` = todos os clipes, `$t` = duração do projeto, `Bt` = id novo).
- `aplicar.py` — põe o módulo e as ligações no `index.html` compilado (só para este build;
  para se algo der errado: `git checkout apps/fluxo/index.html` e rode de novo).

## O que muda no Fluxo (para levar ao código-fonte)

| Onde (no código-fonte) | O que fazer |
|---|---|
| Linha do tempo — as batidas da régua (`.marker-pin`) | viram um componente que recebe o ponteiro: clique escolhe (Shift/Ctrl: várias) e leva a agulha; arrastar move as escolhidas (quadro inteiro; com o Ímã, gruda na agulha e nas bordas dos clipes); dois cliques apaga; botão direito abre o menu (levar a agulha, força forte/média/fraca, apagar, selecionar todas). |
| Linha do tempo — as linhas das batidas (`.marker`) | a da batida escolhida ganha a classe `nb-sel`. |
| Linha do tempo — `.tl-scroll` | dois cliques na régua põem uma batida (ou tiram, em cima de uma); botão direito na régua: "Adicionar batida aqui", "Adicionar batida na agulha", "Selecionar todas as batidas". |
| Interface (`ui`) | campo novo `beatSel` (ids das batidas escolhidas). Escolher clipes, clicar no vazio ou Esc limpa `beatSel`. |
| Teclado global (onde fica o `M`) | com batidas escolhidas: Delete/Backspace apaga; ← → movem um quadro (Shift = 10). |
| Inspetor — painel **Projeto** | seção nova **Batidas** no topo (só quando há batidas): número de escolhidas, **Tempo** (com uma só), **Força** 0–100%, Ir até a batida, Apagar, Desmarcar, Selecionar todas. |
| Janela **Batidas** | dica depois do resultado: dá para ajustar cada batida na régua. |
| Lista de atalhos | 6 linhas novas sobre as batidas. |
| CSS | regras `.marker-pin.nb-pin`, `.is-sel`, `.marker.nb-sel` e `.nb-pin-t` (rótulo do tempo durante o arrasto). |
| `src/nebulosa-idiomas.js` | as traduções do bloco "Fluxo 0.4.2: batidas editáveis". |

O formato do projeto não mudou: as batidas continuam em `project.markers`
(`{ id, t, kind: 'beat', strength }`), em ordem de tempo.
