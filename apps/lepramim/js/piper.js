/* ============================================================
   LêPraMim — piper.js
   Vozes neurais do Piper (ex.: "Cadu", português do Brasil),
   funcionando sem internet. A síntese acontece no arquivo
   piper-worker.js; este módulo cuida de:
   - descobrir quais vozes estão instaladas em libs/piper/vozes
   - pedir o áudio de cada frase (com cache e preparo antecipado
     da frase seguinte, para a leitura não ter pausas)
   - tocar, pausar, retomar e calar
   - estimar a palavra atual para o modo karaokê (o Piper não
     informa o instante de cada palavra)
   ============================================================ */
(function () {
  'use strict';
  const util = LPM.util;
  const BASE = 'libs/piper/';
  const MAX_CACHE = 8;

  const P = {
    vozes: [],        // vozes instaladas, no mesmo formato das vozes do sistema
    pausada: false,
    _ficha: 0
  };

  let worker = null;
  let proximoId = 1;
  const pendentes = new Map();   // id -> { resolve, reject, chave }
  const cache = new Map();       // chave -> Promise<{pcm, taxa}>
  let ctx = null, fonte = null, relogio = null;
  let avisouCarga = false;

  /* ---------------- Detecção das vozes instaladas ---------------- */

  async function existe(caminho) {
    try { return (await fetch(BASE + caminho, { method: 'HEAD', cache: 'no-store' })).ok; } catch (e) { return false; }
  }

  /** Procura as vozes Piper instaladas. Só funciona no modo servidor local. */
  P.detectar = async function () {
    const achadas = [];
    const concluir = () => { P.vozes = achadas; return achadas; };
    if (!util.viaServidor() || typeof Worker === 'undefined') return concluir();
    let lista;
    try {
      const r = await fetch(BASE + 'vozes/vozes.json', { cache: 'no-store' });
      if (!r.ok) return concluir();
      lista = await r.json();
    } catch (e) { return concluir(); }
    const motor = (await existe('ort/ort.wasm.min.js')) && (await existe('phonemize/piper_phonemize.js'));
    if (!motor) return concluir();
    for (const v of lista) {
      if ((await existe('vozes/' + v.id + '.onnx.json')) && (await existe('vozes/' + v.id + '.onnx'))) {
        achadas.push({
          piper: true, id: v.id, genero: v.genero || '',
          name: v.nome + ' — Piper (neural, offline)', lang: v.idioma || 'pt-BR',
          voiceURI: 'piper:' + v.id, localService: true
        });
      }
    }
    return concluir();
  };

  /* ---------------- Síntese ---------------- */

  function garantirWorker() {
    if (worker) return;
    worker = new Worker('js/piper-worker.js');
    worker.onmessage = ev => {
      const m = ev.data, p = pendentes.get(m.id);
      if (!p) return;
      pendentes.delete(m.id);
      if (m.tipo === 'audio') p.resolve({ pcm: m.pcm, taxa: m.taxa });
      else { cache.delete(p.chave); p.reject(new Error(m.mensagem)); }
    };
    worker.onerror = ev => {
      // falha geral do worker: devolve o erro a quem estava esperando e recomeça do zero
      const erro = new Error('O motor de voz Piper falhou: ' + (ev.message || 'erro desconhecido'));
      pendentes.forEach(p => { cache.delete(p.chave); p.reject(erro); });
      pendentes.clear();
      try { worker.terminate(); } catch (e) { /* ignora */ }
      worker = null;
    };
  }

  /**
   * Devolve o áudio de um texto: Promise<{ pcm: Float32Array, taxa }>.
   * velocidade 1 = normal; 2 = duas vezes mais rápido.
   */
  P.sintetizar = function (texto, velocidade, vozId) {
    const escala = Math.round((1 / util.limitar(velocidade || 1, 0.4, 3.5)) * 1000) / 1000;
    const chave = vozId + '|' + escala + '|' + texto;
    if (cache.has(chave)) {
      const p = cache.get(chave);
      cache.delete(chave); cache.set(chave, p); // marca como usado recentemente
      return p;
    }
    garantirWorker();
    const id = proximoId++;
    const promessa = new Promise((resolve, reject) => pendentes.set(id, { resolve, reject, chave }));
    promessa.catch(() => {}); // evita aviso de "erro não tratado" em preparos antecipados
    cache.set(chave, promessa);
    while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    worker.postMessage({ tipo: 'sintetizar', id, voz: vozId, texto, escala });
    return promessa;
  };

  /** Cancela pedidos que ainda estão na fila, menos o da chave indicada. */
  function descartarFila(manterChave) {
    if (!worker) return;
    const ids = [];
    pendentes.forEach((p, id) => { if (p.chave !== manterChave) ids.push(id); });
    if (ids.length) worker.postMessage({ tipo: 'descartar', ids });
  }

  /* ---------------- Reprodução ---------------- */

  function pararFonte() {
    clearInterval(relogio);
    relogio = null;
    if (fonte) { fonte.onended = null; try { fonte.stop(); } catch (e) { /* já parou */ } try { fonte.disconnect(); } catch (e) { /* ignora */ } fonte = null; }
  }

  /**
   * Fala um texto com uma voz Piper.
   * op = { voz (objeto da lista), velocidade, volume, aoLimite(indice, tamanho), aoTerminar(), aoErro(e) }
   */
  P.falar = async function (texto, op) {
    const minha = ++P._ficha;
    pararFonte();
    P.pausada = false;
    if (ctx && ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* ignora */ } }

    const velocidade = op.velocidade || 1;
    const escala = Math.round((1 / util.limitar(velocidade, 0.4, 3.5)) * 1000) / 1000;
    descartarFila(op.voz.id + '|' + escala + '|' + texto);

    // A primeira frase demora mais: o modelo da voz é carregado na memória
    let temporizador = null;
    if (!avisouCarga) {
      temporizador = setTimeout(() => {
        if (minha === P._ficha) { avisouCarga = true; LPM.ui.aviso('Preparando a voz ' + op.voz.name.split(' — ')[0] + '… A primeira frase demora alguns segundos.', null, 6000); }
      }, 900);
    }

    let audio;
    try { audio = await P.sintetizar(texto, velocidade, op.voz.id); }
    catch (e) {
      clearTimeout(temporizador);
      if (minha === P._ficha && e.message !== 'descartado' && op.aoErro) op.aoErro({ error: e.message });
      return;
    }
    clearTimeout(temporizador);
    avisouCarga = true;
    if (minha !== P._ficha) return; // o usuário já mudou de frase

    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      const buffer = ctx.createBuffer(1, audio.pcm.length, audio.taxa);
      buffer.copyToChannel(audio.pcm, 0);
      const ganho = ctx.createGain();
      ganho.gain.value = op.volume !== undefined ? op.volume : 1;
      fonte = ctx.createBufferSource();
      fonte.buffer = buffer;
      fonte.connect(ganho);
      ganho.connect(ctx.destination);

      // Karaokê: a palavra atual é estimada pela fração do áudio já tocada
      const palavras = [];
      const re = /\S+/g;
      let m;
      while ((m = re.exec(texto))) palavras.push({ i: m.index, n: m[0].length });
      const inicio = ctx.currentTime, duracao = buffer.duration || 0.001;
      let ultima = -1;
      const marcar = () => {
        if (minha !== P._ficha || !op.aoLimite) return;
        const alvo = Math.min(1, (ctx.currentTime - inicio) / duracao) * texto.length;
        let k = 0;
        while (k + 1 < palavras.length && palavras[k + 1].i <= alvo) k++;
        if (k !== ultima && palavras[k]) { ultima = k; op.aoLimite(palavras[k].i, palavras[k].n); }
      };
      marcar();
      relogio = setInterval(marcar, 70);

      const estaFonte = fonte;
      fonte.onended = () => {
        if (minha !== P._ficha || fonte !== estaFonte) return;
        pararFonte();
        if (op.aoTerminar) op.aoTerminar();
      };
      fonte.start();
    } catch (e) {
      pararFonte();
      if (minha === P._ficha && op.aoErro) op.aoErro({ error: e.message || String(e) });
    }
  };

  /** Pausa de verdade: o áudio fica congelado no ponto exato. */
  P.pausar = function () {
    if (!ctx || !fonte || P.pausada) return false;
    ctx.suspend();
    P.pausada = true;
    return true;
  };

  P.retomar = function () {
    if (!ctx || !fonte || !P.pausada) return false;
    P.pausada = false;
    ctx.resume();
    return true;
  };

  P.tocando = () => !!fonte;

  /** Interrompe a fala e esquece os pedidos pendentes. */
  P.calar = function () {
    P._ficha++;
    pararFonte();
    descartarFila(null);
    if (P.pausada && ctx) { try { ctx.resume(); } catch (e) { /* ignora */ } }
    P.pausada = false;
  };

  LPM.piper = P;
})();
