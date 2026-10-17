/* ============================================================
   LêPraMim — marcadores.js
   Adicionar, listar, excluir marcadores e voltar rapidamente ao
   ponto salvo — tanto em livros de texto quanto em audiobooks.
   ============================================================ */
(function () {
  'use strict';
  const { $, el, icone, formatarTempo, formatarData } = LPM.util;
  const dados = LPM.dados;
  const marc = {};

  /** O livro em uso no momento: { tipo: 'texto'|'audio', meta } ou null. */
  marc.alvo = function () {
    if (LPM.ui.visao === 'leitor' && LPM.leitor.meta) return { tipo: 'texto', meta: LPM.leitor.meta };
    if (LPM.ui.contexto === 'audio' && LPM.audio.meta) return { tipo: 'audio', meta: LPM.audio.meta };
    return null;
  };

  /** Adiciona um marcador na posição atual. */
  marc.adicionar = function () {
    const alvo = marc.alvo();
    if (!alvo) return;
    const lista = dados.marcadores(alvo.meta.id);
    let novo;
    if (alvo.tipo === 'texto') {
      const p = LPM.leitor.posicaoAtual();
      if (lista.some(m => m.pagina === p.pagina && m.paragrafo === p.paragrafo && m.frase === p.frase)) {
        LPM.ui.aviso('Já existe um marcador neste ponto.');
        return;
      }
      novo = { id: LPM.util.gerarId(), pagina: p.pagina, paragrafo: p.paragrafo, frase: p.frase, trecho: p.trecho, data: Date.now() };
    } else {
      const t = LPM.audio.tempoAtual();
      novo = { id: LPM.util.gerarId(), tempo: t, trecho: LPM.audio.tituloDoCapitulo() || 'Ponto marcado', data: Date.now() };
    }
    lista.push(novo);
    dados.salvarMarcadores(alvo.meta.id, lista);
    marc.render();
    LPM.ui.aviso('Marcador adicionado.');
  };

  marc.excluir = function (idLivro, idMarcador) {
    dados.salvarMarcadores(idLivro, dados.marcadores(idLivro).filter(m => m.id !== idMarcador));
    marc.render();
  };

  /** Desenha a aba "Marcadores". */
  marc.render = function () {
    const alvoEl = $('#abaMarcadores');
    const alvo = marc.alvo();
    if (!alvo) { LPM.ui.vazio(alvoEl, 'Abra um livro para ver os marcadores dele.'); return; }
    const lista = dados.marcadores(alvo.meta.id).slice();
    if (!lista.length) {
      LPM.ui.vazio(alvoEl, 'Nenhum marcador ainda. Use o botão "Marcar" (ou a tecla M) para guardar este ponto.');
      return;
    }
    if (alvo.tipo === 'texto') lista.sort((a, b) => a.pagina - b.pagina || a.paragrafo - b.paragrafo || a.frase - b.frase);
    else lista.sort((a, b) => a.tempo - b.tempo);

    alvoEl.textContent = '';
    lista.forEach(m => {
      const onde = alvo.tipo === 'texto' ? 'pág. ' + (m.pagina + 1) : formatarTempo(m.tempo, true);
      const ir = () => {
        if (alvo.tipo === 'texto') LPM.leitor.irPara(m.pagina, m.paragrafo, m.frase);
        else LPM.audio.irParaTempo(m.tempo);
        LPM.ui.fecharLateral();
      };
      const linha = el('div', { class: 'item', role: 'button', tabindex: '0', title: 'Voltar a este ponto', onclick: ir,
        onkeydown: e => { if (e.key === 'Enter') ir(); } }, [
        el('span', { class: 'item-corpo' }, [
          el('span', { class: 'item-titulo', text: m.trecho || 'Marcador' }),
          el('span', { class: 'item-sub', text: `${onde} · ${formatarData(m.data)}` })
        ]),
        el('button', { class: 'bt-icone', title: 'Excluir marcador', 'aria-label': 'Excluir marcador',
          onclick: e => { e.stopPropagation(); marc.excluir(alvo.meta.id, m.id); } }, icone('lixeira'))
      ]);
      alvoEl.appendChild(linha);
    });
  };

  LPM.marcadores = marc;
})();
