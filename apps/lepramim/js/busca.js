/* ============================================================
   LêPraMim — busca.js
   Pesquisa palavras, frases ou termos no livro aberto e lista
   todos os resultados no painel lateral. Sem livro aberto, o
   campo de busca filtra a biblioteca.
   ============================================================ */
(function () {
  'use strict';
  const { $, el, normalizar } = LPM.util;
  const LIMITE = 500;
  const busca = { termo: '' };

  /** Trecho ao redor do resultado, com o termo destacado. */
  function trecho(texto, pos, tam) {
    const ini = Math.max(0, pos - 45), fim = Math.min(texto.length, pos + tam + 70);
    const span = el('span', { class: 'item-titulo' });
    span.appendChild(document.createTextNode((ini > 0 ? '…' : '') + texto.slice(ini, pos)));
    span.appendChild(el('mark', { text: texto.slice(pos, pos + tam) }));
    span.appendChild(document.createTextNode(texto.slice(pos + tam, fim) + (fim < texto.length ? '…' : '')));
    return span;
  }

  busca.executar = function (termo) {
    termo = String(termo || '').trim();
    busca.termo = termo;

    // Fora do leitor, a busca filtra a estante
    if (LPM.ui.visao !== 'leitor' || !LPM.leitor.dados) {
      $('#filtroBiblioteca').value = termo;
      LPM.biblioteca.filtrar(termo);
      if (LPM.ui.visao !== 'biblioteca') LPM.biblioteca.mostrar();
      return;
    }

    const alvo = $('#abaBusca');
    LPM.ui.aba('busca');
    if (termo.length < 2) { LPM.ui.vazio(alvo, 'Digite pelo menos duas letras para pesquisar no livro.'); return; }

    const chave = normalizar(termo);
    const paginas = LPM.leitor.dados.paginas;
    const achados = [];
    let total = 0;
    for (let p = 0; p < paginas.length; p++) {
      const pars = paginas[p].paragrafos;
      for (let i = 0; i < pars.length; i++) {
        const base = normalizar(pars[i].t);
        let pos = base.indexOf(chave);
        while (pos >= 0) {
          total++;
          if (achados.length < LIMITE) achados.push({ p, i, pos });
          pos = base.indexOf(chave, pos + chave.length);
        }
      }
    }

    alvo.textContent = '';
    if (!total) { LPM.ui.vazio(alvo, `Nenhum resultado para "${termo}".`); return; }
    alvo.appendChild(el('div', { class: 'painel-cab', text:
      total === 1 ? '1 resultado' : `${total.toLocaleString('pt-BR')} resultados` + (total > LIMITE ? ` (mostrando os primeiros ${LIMITE})` : '') }));
    achados.forEach(a => {
      const texto = paginas[a.p].paragrafos[a.i].t;
      alvo.appendChild(el('button', { class: 'item', onclick: () => {
        LPM.leitor.irPara(a.p, a.i, 0, { achado: true });
        LPM.ui.fecharLateral();
      } }, [
        el('span', { class: 'item-corpo' }, trecho(texto, a.pos, chave.length)),
        el('span', { class: 'item-pag', text: 'pág. ' + (a.p + 1) })
      ]));
    });
    LPM.ui.abrirLateral();
  };

  LPM.busca = busca;
})();
