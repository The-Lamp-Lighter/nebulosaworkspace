/* ============================================================
   LêPraMim — leitor.js
   O leitor de texto: mostra a página atual, lê em voz alta,
   destaca palavra/frase/parágrafo (modo karaokê), navega por
   páginas e trechos e salva o progresso automaticamente.

   Posição de leitura = (página, parágrafo, frase).
   ============================================================ */
(function () {
  'use strict';
  const { $, el, limitar } = LPM.util;
  const dados = LPM.dados;
  const cfg = dados.cfg;
  const ui = LPM.ui;

  const L = {
    meta: null,        // ficha do livro aberto
    conteudo: null,    // texto bruto (como está na biblioteca)
    dados: null,       // livro preparado: páginas, capítulos, relatório da limpeza
    prog: null,        // progresso salvo
    pagina: 0, paragrafo: 0, frase: 0,
    tocando: false,    // a voz está lendo
    pausado: false,    // pausado no meio de uma frase
    charPausa: 0,      // caractere da frase onde a voz parou
    _pausaReal: false, // pausa com o áudio congelado (vozes Piper)
    original: false,   // mostrando a página original do PDF
    hibrido: false,    // o áudio vinculado comanda a leitura
    pdf: null,
    _span: null, _texto: '', _desenho: 0, _atividade: 0
  };

  /* ============================================================
     Abrir / fechar
     ============================================================ */

  L.abrir = async function (meta) {
    L.fechar();
    LPM.audio.pausar();
    const conteudo = await dados.bd.conteudo(meta.id);
    if (!conteudo) throw new Error('O texto deste livro não foi encontrado na biblioteca. Remova-o e adicione o arquivo novamente.');

    L.meta = meta;
    L.conteudo = conteudo;
    L.dados = LPM.livro.preparar(conteudo);
    L.prog = dados.progresso(meta.id);
    const n = L.dados.paginas.length;
    if (!L.prog.lidas || L.prog.lidas.length !== n) L.prog.lidas = '0'.repeat(n);
    L.prog.capsOk = L.prog.capsOk || [];
    L.pagina = limitar(L.prog.pagina || 0, 0, n - 1);
    L.paragrafo = L.prog.paragrafo || 0;
    L.frase = L.prog.frase || 0;
    ajustarPosicao();
    L.tocando = L.pausado = L.original = false;
    L.charPausa = 0;
    L._atividade = Date.now();

    dados.gravar('ultimo', meta.id);
    $('#leitorTitulo').textContent = meta.titulo;
    $('#btOriginal').hidden = !(meta.formato === 'pdf' && meta.temArquivo);
    $('#btHibrido').hidden = !meta.audioVinculado;
    $('#btSinc').hidden = true;
    $('#campoBusca').value = '';
    L.aplicarAparencia();
    aplicarOriginal();
    ui.definirContexto('leitor');
    ui.mostrarVisao('leitor');
    L.renderCapitulos();
    L.renderPagina();
    LPM.marcadores.render();
    ui.vazio($('#abaBusca'), 'Use o campo de busca no alto da janela para pesquisar neste livro.');
    ui.aba('capitulos');
    atualizarBotoes();
  };

  L.fechar = function () {
    if (!L.meta) return;
    if (L.hibrido) LPM.hibrido.desativar();
    LPM.voz.calar();
    salvar();
    if (L.pdf) { try { L.pdf.destroy(); } catch (e) { /* ignora */ } L.pdf = null; }
    L._desenho++;
    L.meta = L.conteudo = L.dados = L.prog = null;
    L.tocando = L.pausado = L._pausaReal = false;
  };

  /** Refaz a limpeza e a paginação (depois de mudar as Configurações). */
  L.reprocessar = function () {
    if (!L.meta || !L.conteudo) return;
    const estavaTocando = L.tocando;
    L.parar();
    const fracao = L.dados.totalCaracteres ? charDaPosicao(L.pagina, L.paragrafo, L.frase) / L.dados.totalCaracteres : 0;
    const paginado = !!L.conteudo.paginado;
    const paginaAntiga = L.pagina;
    L.dados = LPM.livro.preparar(L.conteudo);
    const n = L.dados.paginas.length;
    if (L.prog.lidas.length !== n) L.prog.lidas = '0'.repeat(n);
    if (paginado) { L.pagina = limitar(paginaAntiga, 0, n - 1); L.paragrafo = 0; L.frase = 0; }
    else { const pos = L.posicaoDoChar(fracao * L.dados.totalCaracteres); L.pagina = pos.p; L.paragrafo = pos.par; L.frase = 0; }
    ajustarPosicao();
    L.renderCapitulos();
    L.renderPagina();
    if (estavaTocando) L.tocar();
  };

  /* ============================================================
     Posição
     ============================================================ */

  function ajustarPosicao() {
    const pars = L.dados.paginas[L.pagina].paragrafos;
    L.paragrafo = limitar(L.paragrafo, 0, Math.max(0, pars.length - 1));
    const par = pars[L.paragrafo];
    L.frase = par ? limitar(L.frase, 0, par.frases.length - 1) : 0;
  }

  function fraseAtual() {
    const par = L.dados.paginas[L.pagina].paragrafos[L.paragrafo];
    return par && par.frases[L.frase] !== undefined ? par.frases[L.frase] : null;
  }

  /** Posição seguinte (ou null no fim do livro). virou = mudou de página. */
  function proxima() {
    const pgs = L.dados.paginas, pg = pgs[L.pagina], par = pg.paragrafos[L.paragrafo];
    if (par && L.frase + 1 < par.frases.length) return { p: L.pagina, par: L.paragrafo, f: L.frase + 1 };
    if (L.paragrafo + 1 < pg.paragrafos.length) return { p: L.pagina, par: L.paragrafo + 1, f: 0 };
    for (let q = L.pagina + 1; q < pgs.length; q++) {
      if (pgs[q].paragrafos.length) return { p: q, par: 0, f: 0, virou: true };
    }
    return null;
  }

  function anterior() {
    const pgs = L.dados.paginas, pg = pgs[L.pagina];
    if (L.frase > 0) return { p: L.pagina, par: L.paragrafo, f: L.frase - 1 };
    if (L.paragrafo > 0 && pg.paragrafos.length) {
      const a = pg.paragrafos[L.paragrafo - 1];
      return { p: L.pagina, par: L.paragrafo - 1, f: a.frases.length - 1 };
    }
    for (let q = L.pagina - 1; q >= 0; q--) {
      const ps = pgs[q].paragrafos;
      if (ps.length) return { p: q, par: ps.length - 1, f: ps[ps.length - 1].frases.length - 1, virou: true };
    }
    return null;
  }

  /** Quantos caracteres do livro vêm antes de uma posição (base do percentual). */
  function charDaPosicao(p, par, f) {
    let c = L.dados.inicioPagina[p] || 0;
    const pars = L.dados.paginas[p].paragrafos;
    for (let i = 0; i < par && i < pars.length; i++) c += pars[i].t.length + 1;
    if (pars[par]) for (let j = 0; j < f && j < pars[par].frases.length; j++) c += pars[par].frases[j].length + 1;
    return c;
  }
  L.charDaPosicao = charDaPosicao;

  /** Inverso de charDaPosicao: a posição que contém o caractere c. */
  L.posicaoDoChar = function (c) {
    const ini = L.dados.inicioPagina;
    let a = 0, b = ini.length - 1;
    while (a < b) { const m = (a + b + 1) >> 1; if (ini[m] <= c) a = m; else b = m - 1; }
    let p = a;
    // páginas sem texto: usa a seguinte que tenha
    while (p < L.dados.paginas.length - 1 && !L.dados.paginas[p].paragrafos.length) p++;
    let resto = c - ini[p];
    const pars = L.dados.paginas[p].paragrafos;
    for (let i = 0; i < pars.length; i++) {
      const tam = pars[i].t.length + 1;
      if (resto < tam || i === pars.length - 1) {
        const fr = pars[i].frases;
        for (let j = 0; j < fr.length; j++) {
          if (resto < fr[j].length + 1 || j === fr.length - 1) return { p, par: i, f: j };
          resto -= fr[j].length + 1;
        }
      }
      resto -= tam;
    }
    return { p, par: 0, f: 0 };
  };

  L.posicaoAtual = function () {
    return { pagina: L.pagina, paragrafo: L.paragrafo, frase: L.frase, trecho: (fraseAtual() || 'Página ' + (L.pagina + 1)).slice(0, 110) };
  };

  function capituloAtual() {
    return LPM.capitulos.capituloDe(L.dados.capitulos, L.pagina, L.paragrafo);
  }

  function inicioDeCapitulo(pos) {
    return pos.f === 0 && L.dados.capitulos.some(c => c.pagina === pos.p && c.paragrafo === pos.par);
  }

  /* ============================================================
     Progresso
     ============================================================ */

  function salvar() {
    if (!L.meta || !L.prog) return;
    const total = L.dados.totalCaracteres;
    L.prog.pagina = L.pagina;
    L.prog.paragrafo = L.paragrafo;
    L.prog.frase = L.frase;
    L.prog.pct = L.prog.concluido ? 1 : (total ? Math.min(0.999, charDaPosicao(L.pagina, L.paragrafo, L.frase) / total) : 0);
    dados.salvarProgresso(L.meta.id, L.prog);
  }

  /** Marca uma página como lida e atualiza as estatísticas. */
  function marcarLida(p) {
    const pr = L.prog;
    if (!pr || pr.lidas[p] === '1') return;
    pr.lidas = pr.lidas.slice(0, p) + '1' + pr.lidas.slice(p + 1);
    LPM.estat.paginaLida();

    // Capítulo concluído = todas as páginas do capítulo foram lidas
    const caps = L.dados.capitulos;
    const c = LPM.capitulos.capituloDe(caps, p, 9999);
    if (c >= 0 && pr.capsOk.indexOf(c) < 0) {
      const ini = caps[c].pagina;
      const fim = c + 1 < caps.length ? Math.max(ini, caps[c + 1].pagina - (caps[c + 1].paragrafo === 0 ? 1 : 0)) : pr.lidas.length - 1;
      let completo = true;
      for (let i = ini; i <= fim; i++) if (pr.lidas[i] !== '1' && L.dados.paginas[i].paragrafos.length) { completo = false; break; }
      if (completo) { pr.capsOk.push(c); LPM.estat.capituloConcluido(); }
    }
    // Livro concluído = a última página com texto foi lida
    let ultima = L.dados.paginas.length - 1;
    while (ultima > 0 && !L.dados.paginas[ultima].paragrafos.length) ultima--;
    if (p >= ultima && !pr.concluido) { pr.concluido = true; LPM.estat.livroConcluido(L.meta.id); }
  }

  /* ============================================================
     Desenho da página
     ============================================================ */

  L.renderPagina = function () {
    const pg = L.dados.paginas[L.pagina];
    const alvo = $('#pagina');
    alvo.textContent = '';
    L._span = null;

    if (!pg.paragrafos.length) {
      const pdf = L.meta.formato === 'pdf';
      alvo.appendChild(el('div', { class: 'pagina-vazia', text:
        L.dados.totalCaracteres < 5
          ? 'Nenhum texto foi encontrado neste arquivo.' + (pdf ? ' Se for um PDF digitalizado, adicione-o de novo e aceite o OCR.' : '')
          : 'Esta página não tem texto para ler (sumário, imagem ou página em branco).' + (pdf ? ' Use "Página original" para vê-la.' : '') }));
    } else {
      const frag = document.createDocumentFragment();
      pg.paragrafos.forEach((p, i) => {
        const bloco = document.createElement(p.h === 1 ? 'h2' : (p.h ? 'h3' : 'p'));
        bloco.dataset.p = i;
        p.frases.forEach((f, j) => {
          if (j) bloco.appendChild(document.createTextNode(' '));
          const s = document.createElement('span');
          s.className = 'frase';
          s.dataset.p = i;
          s.dataset.f = j;
          s.textContent = f;
          bloco.appendChild(s);
        });
        frag.appendChild(bloco);
      });
      alvo.appendChild(frag);
    }
    $('#rolagem').scrollTop = 0;
    atualizarIndicadores();
    destacar(false);
    if (L.original) desenharOriginal();
  };

  /** Atualiza número da página, barra de progresso, capítulo atual e grava o progresso. */
  function atualizarIndicadores() {
    const n = L.dados.paginas.length;
    $('#campoPagina').value = L.pagina + 1;
    $('#campoPagina').max = n;
    $('#totalPaginas').textContent = 'de ' + n.toLocaleString(window.NebulosaIdiomas ? NebulosaIdiomas.local() : 'pt-BR');
    const c = capituloAtual();
    $('#leitorCapitulo').textContent = c >= 0 ? L.dados.capitulos[c].titulo : (L.meta.autor || '');
    document.querySelectorAll('#abaCapitulos .item').forEach((b, i) => b.classList.toggle('atual', i === c));
    salvar();
    $('#progressoLivro').style.width = Math.round((L.prog.pct || 0) * 1000) / 10 + '%';
  }

  /** Lista de capítulos no painel lateral. */
  L.renderCapitulos = function () {
    const alvo = $('#abaCapitulos');
    const caps = L.dados.capitulos;
    if (!caps.length) { ui.vazio(alvo, 'Nenhum capítulo foi detectado neste livro. Use as páginas para navegar.'); return; }
    alvo.textContent = '';
    caps.forEach(c => {
      alvo.appendChild(el('button', { class: 'item', onclick: () => { L.irPara(c.pagina, c.paragrafo, 0); ui.fecharLateral(); } }, [
        el('span', { class: 'item-corpo' }, el('span', { class: 'item-titulo', text: c.titulo })),
        el('span', { class: 'item-pag', text: String(c.pagina + 1) })
      ]));
    });
  };

  /** Destaca a frase atual (ativa enquanto lê; sublinhada quando parado). */
  function destacar(rolar) {
    const alvo = $('#pagina');
    if (L._span && L._span.isConnected && L._span.firstElementChild) L._span.textContent = L._texto;
    alvo.querySelectorAll('.ativa, .ativo, .cursor').forEach(e => e.classList.remove('ativa', 'ativo', 'cursor'));
    const span = alvo.querySelector(`.frase[data-p="${L.paragrafo}"][data-f="${L.frase}"]`);
    L._span = span;
    if (!span) return;
    L._texto = span.textContent;
    if (L.tocando || (L.hibrido && LPM.audio.tocando())) {
      span.classList.add('ativa');
      span.parentElement.classList.add('ativo');
    } else {
      span.classList.add('cursor');
    }
    if (rolar !== false && !L.original) rolarAte(span);
  }
  L.destacar = destacar;

  function rolarAte(span) {
    const caixa = $('#rolagem');
    const r = span.getBoundingClientRect(), c = caixa.getBoundingClientRect();
    if (r.top < c.top + 50 || r.bottom > c.bottom - 90) {
      caixa.scrollTo({ top: caixa.scrollTop + (r.top - c.top) - c.height * 0.3, behavior: 'smooth' });
    }
  }

  /** Karaokê: destaca a palavra que a voz está dizendo. */
  function palavra(indice, tam) {
    if (!cfg.karaokePalavra) return;
    const span = L._span, t = L._texto;
    if (!span || !span.isConnected || indice >= t.length) return;
    if (!tam) { const m = /^\S+/.exec(t.slice(indice)); tam = m ? m[0].length : 0; }
    if (!tam) return;
    span.textContent = '';
    span.append(t.slice(0, indice), el('mark', { text: t.slice(indice, indice + tam) }), t.slice(indice + tam));
  }

  /* ---------------- Página original do PDF ---------------- */

  function aplicarOriginal() {
    $('#pagina').hidden = L.original;
    $('#original').hidden = !L.original;
    const bt = $('#btOriginal');
    bt.classList.toggle('ligado', L.original);
    bt.querySelector('span').textContent = L.original ? 'Texto limpo' : 'Página original';
  }

  async function desenharOriginal() {
    const ficha = ++L._desenho;
    try {
      if (!L.pdf) {
        const blob = await dados.bd.arquivo(L.meta.id);
        if (!blob) throw new Error('o arquivo original não está mais na biblioteca');
        const pdf = await LPM.importar.abrirPdf(blob);
        if (ficha !== L._desenho) { try { pdf.destroy(); } catch (e) { /* ignora */ } return; }
        L.pdf = pdf;
      }
      const pg = await L.pdf.getPage(L.pagina + 1);
      const vp = pg.getViewport({ scale: 1 });
      const largura = Math.max(280, Math.min(1000, $('#rolagem').clientWidth - 40));
      const tmp = await LPM.importar.desenharPagina(pg, (largura / vp.width) * Math.min(2, window.devicePixelRatio || 1));
      if (ficha !== L._desenho) return;
      const canvas = $('#canvasOriginal');
      canvas.width = tmp.width;
      canvas.height = tmp.height;
      canvas.getContext('2d').drawImage(tmp, 0, 0);
      canvas.style.width = largura + 'px';
    } catch (e) {
      if (ficha !== L._desenho) return;
      ui.aviso('Não foi possível mostrar a página original: ' + (e.message || e), 'erro');
      L.original = false;
      aplicarOriginal();
    }
  }

  L.alternarOriginal = function () {
    if (!L.meta) return;
    L.original = !L.original;
    aplicarOriginal();
    if (L.original) desenharOriginal();
  };

  /* ============================================================
     Leitura por voz
     ============================================================ */

  function atualizarBotoes() {
    ui.estadoTocar($('#btTocar'), L.tocando);
    $('#btTocar').title = L.tocando ? 'Pausar (Espaço)' : (L.pausado ? 'Continuar (Espaço)' : 'Ler em voz alta (Espaço)');
  }

  function mover(pos) {
    const virou = pos.p !== L.pagina;
    L.pagina = pos.p; L.paragrafo = pos.par; L.frase = pos.f;
    if (virou) L.renderPagina();
    else { destacar(); atualizarIndicadores(); }
  }

  /** Fala a frase atual a partir do caractere indicado. */
  function falarAtual(desde) {
    let texto = fraseAtual();
    if (texto === null) { // página sem texto: pula para a próxima que tenha
      const prox = proxima();
      if (!prox) { fimDoLivro(); return; }
      mover(prox);
      texto = fraseAtual();
      desde = 0;
    }
    desde = desde && desde < texto.length ? desde : 0;
    L.charPausa = desde;
    destacar();
    LPM.voz.falar(texto.slice(desde), {
      aoLimite: (i, tam) => { L.charPausa = desde + i; palavra(desde + i, tam); },
      aoTerminar: aoFimDaFrase,
      aoErro: e => {
        L.parar();
        ui.aviso('A voz não pôde ser reproduzida' + (e && e.error ? ` (${e.error})` : '') + '. Escolha outra voz em Configurações.', 'erro', 9000);
      }
    });
    // Vozes Piper: já vai gerando o áudio da frase seguinte, para não haver pausa entre elas
    const prox = proxima();
    if (prox) {
      const par = L.dados.paginas[prox.p].paragrafos[prox.par];
      if (par) LPM.voz.preparar(par.frases[prox.f]);
    }
  }

  /** Descarta um áudio que estava congelado em pausa (o usuário mudou de lugar ou de voz). */
  function descartarPausa() {
    if (L._pausaReal) { L._pausaReal = false; LPM.voz.calar(); }
  }

  /** Chamado quando a voz termina uma frase: decide o que vem depois conforme o modo. */
  function aoFimDaFrase() {
    if (!L.tocando) return;
    L.charPausa = 0;
    const prox = proxima();
    if (!prox || prox.virou) marcarLida(L.pagina);
    if (!prox) { fimDoLivro(); return; }

    if (prox.virou && cfg.modo === 'pagina') {
      // "Só a página atual": para no fim e volta o cursor ao começo da página
      L.paragrafo = 0; L.frase = 0;
      L.parar();
      return;
    }
    if (cfg.modo === 'capitulo' && inicioDeCapitulo(prox)) {
      mover(prox);
      L.parar();
      ui.aviso('Fim do capítulo.');
      return;
    }
    mover(prox);
    falarAtual(0);
  }

  function fimDoLivro() {
    L.prog.concluido = true;
    LPM.estat.livroConcluido(L.meta.id);
    L.parar();
    ui.aviso('Fim do livro. Parabéns pela leitura!', null, 6000);
  }

  /** Botão principal: lê, pausa ou continua. */
  L.tocar = function () {
    if (!L.dados) return;
    if (L.hibrido) { LPM.audio.alternar(); return; }
    if (L.tocando) { L.pausar(); return; }
    if (!LPM.voz.disponivel && !LPM.voz.usaPiper()) { ui.aviso('Este navegador não oferece leitura por voz. Use o Microsoft Edge ou o Chrome.', 'erro'); return; }
    if (!L.dados.totalCaracteres) { ui.aviso('Este livro não tem texto para ler.', 'erro'); return; }
    const desde = L.pausado ? L.charPausa : 0;
    L._atividade = Date.now();
    // Voz Piper pausada: continua do ponto exato, sem gerar o áudio de novo
    if (L.pausado && L._pausaReal && LPM.voz.retomar()) {
      L._pausaReal = false;
      L.tocando = true;
      L.pausado = false;
      atualizarBotoes();
      destacar(false);
      return;
    }
    L._pausaReal = false;
    L.tocando = true;
    L.pausado = false;
    atualizarBotoes();
    falarAtual(desde);
  };

  L.pausar = function () {
    if (L.hibrido) { LPM.audio.pausar(); return; }
    if (!L.tocando) return;
    // Vozes Piper congelam o áudio; as do sistema param e depois recomeçam da palavra atual
    L._pausaReal = !!LPM.voz.pausar();
    if (!L._pausaReal) LPM.voz.calar();
    L.tocando = false;
    L.pausado = true;
    atualizarBotoes();
    salvar();
  };

  L.parar = function () {
    if (L.hibrido) { LPM.audio.pausar(); return; }
    if (!L.meta) return;
    LPM.voz.calar();
    L._pausaReal = false;
    L.tocando = false;
    L.pausado = false;
    L.charPausa = 0;
    atualizarBotoes();
    destacar(false);
    atualizarIndicadores();
  };

  /** Próximo trecho (+1) ou trecho anterior (-1). */
  L.trecho = function (dir) {
    if (!L.dados) return;
    const pos = dir > 0 ? proxima() : anterior();
    if (!pos) return;
    descartarPausa();
    L.pausado = false;
    L._atividade = Date.now();
    mover(pos);
    if (L.hibrido) LPM.hibrido.irParaTexto();
    else if (L.tocando) falarAtual(0);
  };

  /** Vai para uma página (0 = primeira). */
  L.irParaPagina = function (p) {
    if (!L.dados) return;
    p = limitar(Math.round(p), 0, L.dados.paginas.length - 1);
    if (p === L.pagina) { $('#campoPagina').value = p + 1; return; }
    if (p === L.pagina + 1) marcarLida(L.pagina); // virar a página conta como página lida
    L.irPara(p, 0, 0);
  };

  /** Vai para uma posição exata (capítulos, marcadores, busca, clique na frase). */
  L.irPara = function (p, par, f, op) {
    if (!L.dados) return;
    op = op || {};
    descartarPausa();
    L.pausado = false;
    L.charPausa = 0;
    L._atividade = Date.now();
    const virou = p !== L.pagina;
    L.pagina = limitar(p, 0, L.dados.paginas.length - 1);
    L.paragrafo = par || 0;
    L.frase = f || 0;
    ajustarPosicao();
    if (virou) L.renderPagina(); else { destacar(false); atualizarIndicadores(); }
    if (op.achado) {
      const s = $('#pagina').querySelector(`[data-p="${L.paragrafo}"]`);
      if (s) { s.querySelectorAll('.frase').forEach(x => x.classList.add('achado')); setTimeout(() => s.querySelectorAll('.achado').forEach(x => x.classList.remove('achado')), 2600); }
    }
    if (L._span && !L.original) rolarAte(L._span);
    if (L.hibrido && !op.doAudio) LPM.hibrido.irParaTexto();
    else if (L.tocando) falarAtual(0);
  };

  /** Usado pelo modo híbrido: acompanha o áudio sem falar. */
  L.seguir = function (pos) {
    if (!L.dados || (pos.p === L.pagina && pos.par === L.paragrafo && pos.f === L.frase)) return;
    if (pos.p > L.pagina) marcarLida(L.pagina);
    mover(pos);
  };

  /* ============================================================
     Aparência e controles
     ============================================================ */

  L.aplicarAparencia = function () {
    document.documentElement.style.setProperty('--tamanho-leitura', cfg.tamanhoFonte + 'px');
    const v = $('#visaoLeitor');
    v.classList.toggle('k-palavra', !!cfg.karaokePalavra);
    v.classList.toggle('k-frase', !!cfg.karaokeFrase);
    v.classList.toggle('k-paragrafo', !!cfg.karaokeParagrafo);
    $('#selModo').value = cfg.modo;
    $('#selVelocidade').value = cfg.velocidade;
    $('#rotVelocidade').textContent = Number(cfg.velocidade).toFixed(2).replace(/0$/, '').replace('.', ',') + '×';
  };

  /** Recomeça a frase atual (depois de trocar voz, velocidade, volume ou tom). */
  L.reaplicarVoz = function () {
    if (L.pausado && L._pausaReal) { descartarPausa(); L.charPausa = 0; }
    if (L.tocando && !L.hibrido) falarAtual(L.charPausa);
  };

  function mudarFonte(delta) {
    cfg.tamanhoFonte = limitar(cfg.tamanhoFonte + delta, 14, 34);
    dados.salvarCfg();
    L.aplicarAparencia();
  }

  /** Liga os botões e eventos (chamado uma vez na inicialização). */
  L.ligar = function () {
    $('#btTocar').addEventListener('click', L.tocar);
    $('#btParar').addEventListener('click', L.parar);
    $('#btTrechoAnt').addEventListener('click', () => L.trecho(-1));
    $('#btTrechoProx').addEventListener('click', () => L.trecho(1));
    $('#btPagAnt').addEventListener('click', () => L.irParaPagina(L.pagina - 1));
    $('#btPagProx').addEventListener('click', () => L.irParaPagina(L.pagina + 1));
    $('#campoPagina').addEventListener('change', e => L.irParaPagina((parseInt(e.target.value, 10) || 1) - 1));
    $('#campoPagina').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
    $('#btFonteMenos').addEventListener('click', () => mudarFonte(-1));
    $('#btFonteMais').addEventListener('click', () => mudarFonte(1));
    $('#btOriginal').addEventListener('click', L.alternarOriginal);
    $('#btMarcar').addEventListener('click', () => LPM.marcadores.adicionar());
    $('#btGerar').addEventListener('click', () => LPM.gerador.abrir());
    $('#btInfo').addEventListener('click', () => { if (L.meta) LPM.biblioteca.info(L.meta); });
    $('#btHibrido').addEventListener('click', () => LPM.hibrido.alternarModo());
    $('#btSinc').addEventListener('click', () => LPM.hibrido.pedirAncora());

    $('#selModo').addEventListener('change', async e => {
      cfg.modo = e.target.value;
      dados.salvarCfg();
      if (cfg.modo === 'livro' && L.dados && (L.pagina > 0 || L.paragrafo > 0) && !L.tocando) {
        if (await ui.perguntar('Livro inteiro', 'Quer começar a leitura do início do livro?', 'Ir para o início', 'Continuar daqui')) L.irPara(0, 0, 0);
      }
    });

    const reaplicar = LPM.util.adiar(L.reaplicarVoz, 350);
    $('#selVelocidade').addEventListener('input', e => {
      cfg.velocidade = parseFloat(e.target.value);
      dados.salvarCfg();
      L.aplicarAparencia();
      reaplicar();
    });

    // Clique em uma frase: leva a leitura para ela
    $('#pagina').addEventListener('click', e => {
      const s = e.target.closest('.frase');
      if (!s || !L.dados) return;
      if (window.getSelection && String(window.getSelection()).length > 0) return; // está selecionando texto
      const par = parseInt(s.dataset.p, 10), f = parseInt(s.dataset.f, 10);
      if (L.hibrido && LPM.hibrido.aoClicar(L.pagina, par, f)) return;
      L.irPara(L.pagina, par, f);
    });
    $('#rolagem').addEventListener('scroll', () => { L._atividade = Date.now(); }, { passive: true });

    // Conta o tempo de leitura: enquanto a voz lê, ou enquanto o leitor está em uso
    setInterval(() => {
      if (!L.meta || ui.visao !== 'leitor' || document.hidden || L.hibrido) return;
      if (L.tocando || Date.now() - L._atividade < 120000) LPM.estat.somar('lido', 1, L.meta);
    }, 1000);

    window.addEventListener('pagehide', salvar);
    window.addEventListener('resize', LPM.util.adiar(() => { if (L.meta && L.original) desenharOriginal(); }, 300));
  };

  LPM.leitor = L;
})();
