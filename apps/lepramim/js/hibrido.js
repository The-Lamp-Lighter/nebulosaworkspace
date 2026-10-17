/* ============================================================
   LêPraMim — hibrido.js
   Modo híbrido: quando um livro de texto (EPUB/PDF…) tem um
   audiobook correspondente vinculado, o usuário ouve o áudio e
   acompanha o texto, com o trecho em execução destacado.

   Como os arquivos não trazem marcas de sincronia, a posição é
   ESTIMADA: o tempo do áudio é convertido em posição no texto
   de forma proporcional, usando como "âncoras" o início de cada
   capítulo (quando o número de capítulos coincide) e os pontos
   que o usuário acertar manualmente ("Acertar sincronia").
   ============================================================ */
(function () {
  'use strict';
  const { $ } = LPM.util;
  const dados = LPM.dados;
  const ui = LPM.ui;
  const H = { ativo: false, ancoras: [], pedindoAncora: false };

  const leitor = () => LPM.leitor;
  const audio = () => LPM.audio;

  /** Monta a tabela de âncoras (caractere do texto <-> segundo do áudio). */
  function montarAncoras() {
    const L = leitor();
    const total = L.dados.totalCaracteres, dur = audio().duracao();
    let pontos = [{ c: 0, t: 0 }, { c: total, t: dur }];

    // Capítulos do texto e do áudio em mesma quantidade: alinha um a um
    const capsTexto = L.dados.capitulos.filter(c => c.titulo !== 'Início');
    const capsAudio = (audio().meta.capitulosAudio || []);
    if (capsTexto.length >= 2 && capsTexto.length === capsAudio.length) {
      capsTexto.forEach((c, i) => pontos.push({ c: L.charDaPosicao(c.pagina, c.paragrafo, 0), t: capsAudio[i].inicio }));
    }
    // Acertos manuais do usuário têm prioridade
    const manuais = dados.ler('sinc.' + L.meta.id, []);
    pontos = pontos.concat(manuais.map(m => ({ c: m.c, t: m.t, manual: true })));

    pontos.sort((a, b) => a.c - b.c || a.t - b.t);
    // Mantém apenas pontos coerentes (o tempo precisa crescer junto com o texto)
    const ok = [];
    pontos.forEach(p => {
      const ant = ok[ok.length - 1];
      if (!ant) { ok.push(p); return; }
      if (p.c === ant.c) { if (p.manual) ok[ok.length - 1] = p; return; }
      if (p.t > ant.t) ok.push(p);
      else if (p.manual && !ant.manual && ok.length > 1) { ok[ok.length - 1] = p; }
    });
    if (ok[ok.length - 1].c < total) ok.push({ c: total, t: Math.max(dur, ok[ok.length - 1].t + 1) });
    H.ancoras = ok;
  }

  /** Interpolação linear entre âncoras. */
  function interpolar(valor, de, para) {
    const a = H.ancoras;
    for (let i = 1; i < a.length; i++) {
      if (valor <= a[i][de] || i === a.length - 1) {
        const x0 = a[i - 1][de], x1 = a[i][de];
        const f = x1 > x0 ? (valor - x0) / (x1 - x0) : 0;
        return a[i - 1][para] + Math.min(1, Math.max(0, f)) * (a[i][para] - a[i - 1][para]);
      }
    }
    return 0;
  }
  const tempoDoChar = c => interpolar(c, 'c', 't');
  const charDoTempo = t => interpolar(t, 't', 'c');

  /** A cada avanço do áudio, leva o destaque do texto para o trecho estimado. */
  function acompanhar(t) {
    if (!H.ativo || H.pedindoAncora) return;
    const L = leitor();
    if (!L.dados) return;
    L.seguir(L.posicaoDoChar(charDoTempo(t)));
  }

  /* ---------------- Ligar / desligar ---------------- */

  H.alternarModo = function () { if (H.ativo) H.desativar(); else H.ativar(); };

  H.ativar = async function () {
    const L = leitor();
    if (!L.meta || !L.meta.audioVinculado) return;
    try {
      const metaAudio = await dados.bd.meta(L.meta.audioVinculado);
      if (!metaAudio) throw new Error('O audiobook vinculado não está mais na biblioteca.');
      L.parar();
      await audio().carregar(metaAudio);
      H.ativo = true;
      L.hibrido = true;
      montarAncoras();
      // O áudio começa no ponto correspondente ao texto que está na tela
      const c = L.charDaPosicao(L.pagina, L.paragrafo, L.frase);
      audio().irParaTempo(c > 0 ? tempoDoChar(c) : (audio().prog.tempo || 0));
      audio().aoTempo = acompanhar;
      ui.definirContexto('audio');
      $('#btHibrido').classList.add('ligado');
      $('#btSinc').hidden = false;
      ui.aviso('Modo híbrido ligado. O destaque acompanha o áudio de forma aproximada; clique em uma frase para levar o áudio até ela.', null, 7000);
    } catch (e) {
      ui.aviso(e.message || String(e), 'erro');
    }
  };

  H.desativar = function () {
    if (!H.ativo) return;
    audio().pausar();
    audio().aoTempo = null;
    H.ativo = false;
    H.pedindoAncora = false;
    leitor().hibrido = false;
    $('#btHibrido').classList.remove('ligado');
    $('#btSinc').hidden = true;
    $('#btSinc').classList.remove('ligado');
    ui.definirContexto('leitor');
    leitor().destacar(false);
  };

  /** O usuário navegou pelo texto (capítulo, marcador, página): leva o áudio junto. */
  H.irParaTexto = function () {
    if (!H.ativo) return;
    const L = leitor();
    audio().irParaTempo(tempoDoChar(L.charDaPosicao(L.pagina, L.paragrafo, L.frase)));
  };

  /** "Acertar sincronia": o próximo clique numa frase diz "o áudio está AQUI agora". */
  H.pedirAncora = function () {
    if (!H.ativo) return;
    H.pedindoAncora = !H.pedindoAncora;
    $('#btSinc').classList.toggle('ligado', H.pedindoAncora);
    if (H.pedindoAncora) ui.aviso('Clique na frase que está sendo falada neste momento.', null, 6000);
  };

  /** Clique em uma frase no modo híbrido. Retorna true se tratou o clique. */
  H.aoClicar = function (p, par, f) {
    if (!H.ativo) return false;
    const L = leitor();
    const c = L.charDaPosicao(p, par, f);
    if (H.pedindoAncora) {
      const lista = dados.ler('sinc.' + L.meta.id, []).filter(m => Math.abs(m.c - c) > 200);
      lista.push({ c, t: audio().tempoAtual() });
      dados.gravar('sinc.' + L.meta.id, lista);
      H.pedindoAncora = false;
      $('#btSinc').classList.remove('ligado');
      montarAncoras();
      L.irPara(p, par, f, { doAudio: true });
      ui.aviso('Sincronia acertada neste ponto.');
      return true;
    }
    L.irPara(p, par, f, { doAudio: true });
    audio().irParaTempo(tempoDoChar(c));
    return true;
  };

  LPM.hibrido = H;
})();
