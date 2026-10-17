/* ============================================================
   LêPraMim — audiobook.js
   Player de audiobooks (MP3, M4A/M4B, AAC, OGG, WAV, FLAC):
   tocar, pausar, parar, ±10 segundos, velocidade de 0,5× a 3×,
   volume, barra de progresso, capítulos (quando o arquivo traz
   metadados) e retomada do ponto exato onde o usuário parou.
   ============================================================ */
(function () {
  'use strict';
  const { $, el, formatarTempo, formatarDuracao, limitar } = LPM.util;
  const dados = LPM.dados;
  const cfg = dados.cfg;
  const ui = LPM.ui;

  const A = {
    meta: null,
    prog: null,
    aoTempo: null,       // usado pelo modo híbrido para acompanhar o texto
    _url: null,
    _ultimoSalvo: 0,
    _relogio: 0,         // marca de tempo real, para somar "tempo ouvido"
    _arrastando: false
  };
  let som = null;        // o elemento <audio>

  /* ============================================================
     Carregar / abrir
     ============================================================ */

  /** Carrega o arquivo no player (sem trocar de tela). */
  A.carregar = async function (meta) {
    if (A.meta && A.meta.id === meta.id && som.src) return;
    A.descarregar();
    const blob = await dados.bd.arquivo(meta.id);
    if (!blob) throw new Error('O arquivo de áudio não está mais na biblioteca. Remova-o e adicione de novo.');
    A.meta = meta;
    A.prog = dados.progresso(meta.id);
    A._url = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
      const ok = () => { limpar(); resolve(); };
      const erro = () => { limpar(); reject(new Error('O navegador não conseguiu abrir este arquivo de áudio.')); };
      const limpar = () => { som.removeEventListener('loadedmetadata', ok); som.removeEventListener('error', erro); };
      som.addEventListener('loadedmetadata', ok);
      som.addEventListener('error', erro);
      som.src = A._url;
    });
    som.playbackRate = cfg.velocidadeAudio;
    som.volume = cfg.volumeAudio;
    if ('preservesPitch' in som) som.preservesPitch = true; // acelera sem deixar a voz fina
    sessaoDeMidia();
  };

  A.descarregar = function () {
    if (!A.meta) return;
    salvar();
    som.pause();
    som.removeAttribute('src');
    som.load();
    if (A._url) { URL.revokeObjectURL(A._url); A._url = null; }
    A.meta = A.prog = null;
    A.aoTempo = null;
    atualizarBotao();
  };

  /** Abre o audiobook na tela do player. */
  A.abrir = async function (meta, op) {
    op = op || {};
    LPM.leitor.fechar();
    await A.carregar(meta);
    dados.gravar('ultimo', meta.id);

    // Ficha
    $('#audioTitulo').textContent = meta.titulo;
    $('#audioAutor').textContent = meta.autor || '';
    const detalhes = [];
    if (meta.narrador) detalhes.push('Narração: ' + meta.narrador);
    if (meta.genero) detalhes.push(meta.genero);
    detalhes.push(formatarDuracao(som.duration || meta.duracao));
    detalhes.push(meta.formato.toUpperCase());
    $('#audioDetalhes').textContent = detalhes.join(' · ');
    const capa = $('#audioCapa');
    capa.textContent = '';
    if (meta.capa) capa.appendChild(el('img', { src: meta.capa, alt: '' })); else capa.textContent = '🎧';

    $('#campoBusca').value = '';
    ui.definirContexto('audio');
    ui.mostrarVisao('audio');
    A.renderCapitulos();
    LPM.marcadores.render();
    ui.vazio($('#abaBusca'), 'A busca funciona em livros de texto.');
    ui.aba('capitulos');

    // "Você deseja continuar a partir de 03:25:14?"
    const salvo = A.prog.tempo || 0;
    let inicio = 0;
    if (salvo > 5 && salvo < (som.duration || Infinity) - 3) {
      const continuar = op.continuar || await ui.perguntar('Continuar audiobook',
        `Você deseja continuar a partir de ${formatarTempo(salvo, true)}?`, 'Continuar', 'Começar do início');
      if (continuar) inicio = salvo;
    }
    som.currentTime = inicio;
    atualizarTempo();
    if (!op.semTocar) A.tocar();
  };

  /* ============================================================
     Controles
     ============================================================ */

  A.tocando = () => !!(som && A.meta && !som.paused && !som.ended);

  A.tocar = function () {
    if (!A.meta) return;
    LPM.voz.calar();
    const p = som.play();
    if (p && p.catch) p.catch(() => { /* o navegador pode exigir um clique antes de tocar */ });
  };

  A.pausar = function () {
    if (!A.meta || som.paused) return;
    som.pause();
  };

  A.alternar = function () { if (A.tocando()) A.pausar(); else A.tocar(); };

  /** Parar: interrompe e guarda o ponto exato (para continuar depois). */
  A.parar = function () {
    if (!A.meta) return;
    som.pause();
    salvar();
    ui.aviso('Audiobook parado em ' + formatarTempo(som.currentTime, true) + '. O ponto foi salvo.');
  };

  A.pular = function (seg) {
    if (!A.meta) return;
    som.currentTime = limitar(som.currentTime + seg, 0, Math.max(0, (som.duration || 0) - 0.5));
    atualizarTempo();
  };

  A.tempoAtual = () => (A.meta ? som.currentTime : 0);
  A.duracao = () => (A.meta ? (som.duration || A.meta.duracao || 0) : 0);

  A.irParaTempo = function (t) {
    if (!A.meta) return;
    som.currentTime = limitar(t, 0, Math.max(0, (som.duration || 0) - 0.5));
    atualizarTempo();
  };

  /* ---------------- Capítulos ---------------- */

  function capitulos() { return (A.meta && A.meta.capitulosAudio) || []; }

  function indiceDoCapitulo(t) {
    const caps = capitulos();
    let idx = -1;
    for (let i = 0; i < caps.length; i++) { if (caps[i].inicio <= t + 0.3) idx = i; else break; }
    return idx;
  }

  A.tituloDoCapitulo = function () {
    const i = indiceDoCapitulo(A.tempoAtual());
    return i >= 0 ? capitulos()[i].titulo : '';
  };

  A.capitulo = function (dir) {
    const caps = capitulos();
    if (!A.meta) return;
    if (!caps.length) { A.pular(dir * 60); return; } // sem capítulos: salta 1 minuto
    const i = indiceDoCapitulo(som.currentTime);
    if (dir > 0) { if (i + 1 < caps.length) A.irParaTempo(caps[i + 1].inicio); }
    else {
      // se já passou 4 s do início do capítulo, volta ao início dele; senão, ao anterior
      const alvo = i >= 0 && som.currentTime - caps[i].inicio > 4 ? i : Math.max(0, i - 1);
      A.irParaTempo(caps[alvo].inicio);
    }
  };

  A.renderCapitulos = function () {
    const alvo = $('#abaCapitulos');
    const caps = capitulos();
    if (!caps.length) { ui.vazio(alvo, 'Este arquivo não traz capítulos nos metadados. Use os marcadores para guardar pontos importantes.'); return; }
    alvo.textContent = '';
    caps.forEach(c => {
      alvo.appendChild(el('button', { class: 'item', onclick: () => { A.irParaTempo(c.inicio); A.tocar(); ui.fecharLateral(); } }, [
        el('span', { class: 'item-corpo' }, el('span', { class: 'item-titulo', text: c.titulo })),
        el('span', { class: 'item-pag', text: formatarTempo(c.inicio, true) })
      ]));
    });
  };

  /* ============================================================
     Atualização da tela e progresso
     ============================================================ */

  function atualizarBotao() {
    const tocando = A.tocando();
    ui.estadoTocar($('#btAudioTocar'), tocando);
    // no modo híbrido o texto acompanha: atualiza o destaque ao tocar/pausar
    if (LPM.leitor.hibrido) LPM.leitor.destacar(false);
  }

  function atualizarTempo() {
    if (!A.meta) return;
    const t = som.currentTime, d = som.duration || A.meta.duracao || 0;
    const horas = d >= 3600;
    $('#audioTempo').textContent = formatarTempo(t, horas);
    $('#audioDuracao').textContent = formatarTempo(d, horas);
    if (!A._arrastando) $('#audioBarra').value = d ? Math.round((t / d) * 1000) : 0;
    const i = indiceDoCapitulo(t);
    $('#audioCapituloAtual').textContent = i >= 0 ? capitulos()[i].titulo : '';
    if (ui.contexto === 'audio' && !LPM.leitor.hibrido) {
      document.querySelectorAll('#abaCapitulos .item').forEach((b, k) => b.classList.toggle('atual', k === i));
      $('#progressoLivro').style.width = (d ? (t / d) * 100 : 0) + '%';
    }
    $('#audioOuvido').textContent = A.prog && A.prog.ouvido > 60 ? 'Tempo total ouvido: ' + formatarDuracao(A.prog.ouvido) : '';
    if (A.aoTempo) A.aoTempo(t);
  }

  /** Grava: arquivo reproduzido, tempo atual e tempo total ouvido. */
  function salvar() {
    if (!A.meta || !A.prog) return;
    const d = som.duration || A.meta.duracao || 0;
    A.prog.tempo = som.currentTime || 0;
    A.prog.pct = A.prog.concluido ? 1 : (d ? Math.min(0.999, A.prog.tempo / d) : 0);
    dados.salvarProgresso(A.meta.id, A.prog);
    A._ultimoSalvo = Date.now();
  }

  /** Soma o tempo real de escuta (independe da velocidade escolhida). */
  function contarEscuta() {
    const agora = Date.now();
    if (A._relogio && A.meta) {
      const seg = (agora - A._relogio) / 1000;
      if (seg > 0 && seg < 5) {
        A.prog.ouvido = (A.prog.ouvido || 0) + seg;
        LPM.estat.somar('ouvido', seg, A.meta);
      }
    }
    A._relogio = A.tocando() ? agora : 0;
  }

  /** Teclas de mídia do teclado e painel de mídia do Windows. */
  function sessaoDeMidia() {
    if (!('mediaSession' in navigator) || !A.meta) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: A.meta.titulo, artist: A.meta.autor || '', album: A.meta.album || 'LêPraMim',
        artwork: A.meta.capa ? [{ src: A.meta.capa }] : []
      });
      const acoes = { play: A.tocar, pause: A.pausar, seekbackward: () => A.pular(-10), seekforward: () => A.pular(10), previoustrack: () => A.capitulo(-1), nexttrack: () => A.capitulo(1) };
      Object.keys(acoes).forEach(k => { try { navigator.mediaSession.setActionHandler(k, acoes[k]); } catch (e) { /* ação não suportada */ } });
    } catch (e) { /* opcional */ }
  }

  /* ============================================================
     Ligações (uma vez)
     ============================================================ */
  A.ligar = function () {
    som = $('#tocador');

    // Opções de velocidade: 0,5× … 3×
    const sel = $('#selVelAudio');
    LPM.config.VELOCIDADES_AUDIO.forEach(v => sel.appendChild(el('option', { value: v, text: String(v).replace('.', ',') + '×' })));
    sel.value = cfg.velocidadeAudio;
    sel.addEventListener('change', () => {
      cfg.velocidadeAudio = parseFloat(sel.value);
      dados.salvarCfg();
      som.playbackRate = cfg.velocidadeAudio;
    });
    const vol = $('#volAudio');
    vol.value = cfg.volumeAudio;
    vol.addEventListener('input', () => { cfg.volumeAudio = parseFloat(vol.value); som.volume = cfg.volumeAudio; dados.salvarCfg(); });

    $('#btAudioTocar').addEventListener('click', A.alternar);
    $('#btAudioParar').addEventListener('click', A.parar);
    $('#btAudioMenos10').addEventListener('click', () => A.pular(-10));
    $('#btAudioMais10').addEventListener('click', () => A.pular(10));
    $('#btAudioCapAnt').addEventListener('click', () => A.capitulo(-1));
    $('#btAudioCapProx').addEventListener('click', () => A.capitulo(1));
    $('#btMarcarAudio').addEventListener('click', () => LPM.marcadores.adicionar());

    const barra = $('#audioBarra');
    barra.addEventListener('input', () => {
      A._arrastando = true;
      const d = A.duracao();
      $('#audioTempo').textContent = formatarTempo((barra.value / 1000) * d, d >= 3600);
    });
    barra.addEventListener('change', () => {
      A._arrastando = false;
      A.irParaTempo((barra.value / 1000) * A.duracao());
    });

    som.addEventListener('timeupdate', () => {
      contarEscuta();
      atualizarTempo();
      if (Date.now() - A._ultimoSalvo > 5000) salvar();
    });
    som.addEventListener('play', () => { A._relogio = Date.now(); atualizarBotao(); });
    som.addEventListener('pause', () => { contarEscuta(); atualizarBotao(); salvar(); });
    som.addEventListener('ratechange', () => { sel.value = som.playbackRate; });
    som.addEventListener('ended', () => {
      contarEscuta();
      if (A.prog) { A.prog.concluido = true; LPM.estat.livroConcluido(A.meta.id); }
      atualizarBotao();
      salvar();
      ui.aviso('Fim do audiobook.', null, 6000);
    });
    window.addEventListener('pagehide', salvar);
  };

  LPM.audio = A;
})();
