/* ============================================================
   LêPraMim — estatisticas.js
   Horas ouvidas, horas lidas, livros e capítulos concluídos,
   páginas lidas e histórico de leitura (por dia e por livro).
   ============================================================ */
(function () {
  'use strict';
  const { $, el, formatarDuracao } = LPM.util;
  const dados = LPM.dados;

  const base = { ouvidos: 0, lidos: 0, paginas: 0, capitulos: 0, concluidos: [], historico: [] };
  let e = Object.assign({}, base, dados.ler('estat', {}));
  let sujo = false;

  const estat = {};

  function gravar() { if (sujo) { dados.gravar('estat', e); sujo = false; } }
  setInterval(gravar, 15000);
  window.addEventListener('pagehide', gravar);
  document.addEventListener('visibilitychange', () => { if (document.hidden) gravar(); });

  /** Soma segundos de leitura ('lido') ou de audiobook ('ouvido') e registra no histórico. */
  estat.somar = function (tipo, seg, meta) {
    if (!(seg > 0) || !meta) return;
    if (tipo === 'ouvido') e.ouvidos += seg; else e.lidos += seg;
    const dia = LPM.util.diaDeHoje();
    let reg = e.historico[0];
    if (!reg || reg.dia !== dia || reg.id !== meta.id) {
      // procura o registro de hoje para este livro; se não houver, cria no topo
      const i = e.historico.findIndex(r => r.dia === dia && r.id === meta.id);
      if (i >= 0) reg = e.historico.splice(i, 1)[0];
      else reg = { dia, id: meta.id, titulo: meta.titulo, tipo: meta.tipo, seg: 0 };
      e.historico.unshift(reg);
      if (e.historico.length > 400) e.historico.length = 400;
    }
    reg.seg += seg;
    reg.quando = Date.now();
    sujo = true;
  };

  estat.paginaLida = function () { e.paginas++; sujo = true; };
  estat.capituloConcluido = function () { e.capitulos++; sujo = true; };
  estat.livroConcluido = function (id) {
    if (e.concluidos.indexOf(id) < 0) { e.concluidos.push(id); sujo = true; gravar(); }
  };
  estat.gravarAgora = function () { sujo = true; gravar(); };

  const horas = seg => (seg / 3600).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dataCurta = dia => {
    const p = dia.split('-');
    return dia === LPM.util.diaDeHoje() ? 'Hoje' : `${p[2]}/${p[1]}/${p[0]}`;
  };

  /** Janela de estatísticas. */
  estat.abrir = function () {
    gravar();
    const numero = (valor, rotulo) => el('div', { class: 'numero' }, [el('b', { text: valor }), el('span', { text: rotulo })]);
    const corpo = el('div', null, [
      el('div', { class: 'numeros' }, [
        numero(horas(e.ouvidos), 'horas ouvidas (audiobooks)'),
        numero(horas(e.lidos), 'horas lidas (texto e voz)'),
        numero(String(e.concluidos.length), 'livros concluídos'),
        numero(String(e.capitulos), 'capítulos concluídos'),
        numero(e.paginas.toLocaleString('pt-BR'), 'páginas lidas'),
        numero(String(new Set(e.historico.map(r => r.dia)).size), 'dias com leitura')
      ])
    ]);

    corpo.appendChild(el('h3', { text: 'Histórico de leitura', style: { margin: '0 0 8px', fontSize: '15px' } }));
    if (!e.historico.length) {
      corpo.appendChild(el('p', { class: 'nota', text: 'O histórico aparece aqui depois da sua primeira leitura.' }));
    } else {
      const tabela = el('table', { class: 'tabela' }, [
        el('thead', null, el('tr', null, [el('th', { text: 'Dia' }), el('th', { text: 'Livro' }), el('th', { text: 'Tempo' })])),
        el('tbody', null, e.historico.slice(0, 120).map(r => el('tr', null, [
          el('td', { text: dataCurta(r.dia) }),
          el('td', { text: (r.tipo === 'audio' ? '🎧 ' : '') + r.titulo }),
          el('td', { text: formatarDuracao(r.seg) })
        ])))
      ]);
      corpo.appendChild(tabela);
    }
    LPM.ui.modal({ titulo: 'Estatísticas', corpo, largo: true, botoes: [{ texto: 'Fechar', classe: 'primario' }] });
  };

  /** Aba "Histórico" do painel lateral: últimos livros lidos, com atalho para reabrir. */
  estat.renderHistorico = function () {
    const alvo = $('#abaHistorico');
    if (!e.historico.length) { LPM.ui.vazio(alvo, 'Os livros que você ler ou ouvir aparecem aqui.'); return; }
    alvo.textContent = '';
    e.historico.slice(0, 60).forEach(r => {
      alvo.appendChild(el('button', { class: 'item', title: 'Abrir', onclick: () => LPM.biblioteca.abrir(r.id) }, [
        el('span', { class: 'item-corpo' }, [
          el('span', { class: 'item-titulo', text: (r.tipo === 'audio' ? '🎧 ' : '') + r.titulo }),
          el('span', { class: 'item-sub', text: `${dataCurta(r.dia)} · ${formatarDuracao(r.seg)}` })
        ])
      ]));
    });
  };

  /** Remove um livro do histórico (quando é excluído da biblioteca). */
  estat.esquecer = function (id) {
    e.historico = e.historico.filter(r => r.id !== id);
    sujo = true; gravar();
  };

  LPM.estat = estat;
})();
