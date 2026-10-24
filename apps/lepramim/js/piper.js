/* ============================================================
   LêPraMim — piper.js
   Vozes neurais do Piper (ex.: "Cadu", português do Brasil).
   A síntese acontece no arquivo piper-worker.js, dentro do
   navegador: o texto nunca sai do computador.
   De onde vêm o motor e as vozes:
   - da pasta libs/piper (instalada pelo "Baixar-Bibliotecas"), ou
   - da internet, quando a pasta não os tem (ex.: no GitHub Pages):
     cada voz é baixada uma única vez, com a permissão do usuário,
     e fica guardada no navegador (LPM.config.PIPER_WEB).
   Este módulo cuida de:
   - descobrir quais vozes estão disponíveis
   - pedir permissão e mostrar o progresso do primeiro download
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
  const WEB = LPM.config.PIPER_WEB;
  const MAX_CACHE = 8;

  const P = {
    vozes: [],        // vozes disponíveis, no mesmo formato das vozes do sistema
    motor: 'local',   // 'local' (libs/piper) ou 'web' (internet, guardado no navegador)
    pausada: false,
    _ficha: 0
  };

  let worker = null;
  let proximoId = 1;
  const pendentes = new Map();   // id -> { resolve, reject, chave }
  const downloads = new Map();   // id -> { resolve, reject, progresso }
  const liberadas = new Set();   // vozes da internet já baixadas nesta sessão
  const cache = new Map();       // chave -> Promise<{pcm, taxa}>
  let ctx = null, fonte = null, relogio = null;
  let avisouCarga = false;

  /* ---------------- Detecção das vozes instaladas ---------------- */

  async function existe(caminho) {
    try { return (await fetch(BASE + caminho, { method: 'HEAD', cache: 'no-store' })).ok; } catch (e) { return false; }
  }

  /** Endereços da voz na internet (repositório oficial de vozes do Piper). */
  function enderecosWeb(v) {
    const m = /^([a-z]{2,3})_([A-Z]{2})-(.+)-(x_low|low|medium|high)$/.exec(v.id);
    if (!WEB || !m) return null;
    const base = WEB.vozes + m[1] + '/' + m[1] + '_' + m[2] + '/' + m[3] + '/' + m[4] + '/' + v.id;
    return { json: base + '.onnx.json', onnx: base + '.onnx' };
  }

  async function abrirCache() {
    if (!window.caches || !WEB) return null;
    try { return await caches.open(WEB.cache); } catch (e) { return null; }
  }

  function nomeDaVoz(v) { return v.name.split(' — ')[0]; }

  /**
   * Procura as vozes Piper. Precisa do app aberto por http(s) — servidor
   * local ou site. Abrindo o index.html direto do disco não há vozes Piper.
   */
  P.detectar = async function () {
    const achadas = [];
    const concluir = () => { P.vozes = achadas; return achadas; };
    if (!util.viaServidor() || typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return concluir();
    let lista;
    try {
      const r = await fetch(BASE + 'vozes/vozes.json', { cache: 'no-store' });
      if (!r.ok) return concluir();
      lista = await r.json();
    } catch (e) { return concluir(); }
    const motorLocal = (await existe('ort/ort.wasm.min.js')) && (await existe('phonemize/piper_phonemize.js'));
    P.motor = motorLocal ? 'local' : 'web';
    const cache = motorLocal ? null : await abrirCache();
    for (const v of lista) {
      const basico = { piper: true, id: v.id, genero: v.genero || '', lang: v.idioma || 'pt-BR', voiceURI: 'piper:' + v.id, localService: true };
      if (motorLocal && (await existe('vozes/' + v.id + '.onnx.json')) && (await existe('vozes/' + v.id + '.onnx'))) {
        achadas.push(Object.assign(basico, {
          origem: 'local', name: v.nome + ' — Piper (neural, offline)',
          json: util.urlAbsoluta(BASE + 'vozes/' + v.id + '.onnx.json'), onnx: util.urlAbsoluta(BASE + 'vozes/' + v.id + '.onnx')
        }));
        continue;
      }
      if (motorLocal) continue; // instalação local: só as vozes que estão na pasta
      const web = enderecosWeb(v);
      if (!web) continue;
      const baixada = liberadas.has(v.id) || !!(cache && await cache.match(web.onnx));
      achadas.push(Object.assign(basico, web, {
        origem: 'web', baixada, mb: v.mb || 60,
        name: v.nome + (baixada ? ' — Piper (neural, guardada neste navegador)' : ' — Piper (neural, baixa ' + (v.mb || 60) + ' MB na 1ª vez)')
      }));
    }
    return concluir();
  };

  /** true quando a voz já pode falar sem baixar nada (local ou já guardada). */
  P.liberada = v => !!v && (v.origem !== 'web' || v.baixada || liberadas.has(v.id));

  /**
   * Garante que uma voz da internet esteja baixada: pergunta na primeira vez,
   * mostra o progresso e guarda a voz no navegador. Resolve true se pode falar.
   */
  const emAndamento = new Map();
  P.garantir = function (v) {
    if (!v || !v.piper || P.liberada(v)) return Promise.resolve(true);
    if (emAndamento.has(v.id)) return emAndamento.get(v.id);
    const ui = LPM.ui, cfg = LPM.dados.cfg;
    const tarefa = (async () => {
      if (!cfg.piperWeb) {
        const ok = await ui.perguntar('Baixar a voz ' + nomeDaVoz(v) + '?',
          'Para ler com a voz neural ' + nomeDaVoz(v) + ', o LêPraMim baixa a voz uma única vez (cerca de ' + v.mb +
          ' MB, mais uns 25 MB do motor de voz, que servem para todas as vozes). Ela fica guardada neste navegador e, das próximas vezes, a leitura começa na hora. ' +
          'O texto dos seus livros nunca sai do computador: a leitura acontece aqui mesmo.',
          'Baixar a voz', 'Usar a voz do sistema');
        if (!ok) return false;
        cfg.piperWeb = true;
        LPM.dados.salvarCfg();
      }
      const janela = ui.progresso('Baixando a voz ' + nomeDaVoz(v));
      garantirWorker();
      const id = proximoId++;
      const mb = n => (n / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: n < 10485760 ? 1 : 0 });
      const pronto = new Promise((resolve, reject) => downloads.set(id, {
        resolve, reject,
        progresso: m => janela.atualizar(
          (m.rotulo === 'voz' ? 'Voz ' + nomeDaVoz(v) : 'Motor de voz') + ': ' + mb(m.carregado) + (m.total ? ' de ' + mb(m.total) : '') + ' MB',
          m.total ? m.carregado / m.total : undefined)
      }));
      worker.postMessage({ tipo: 'baixar', id, voz: { id: v.id, json: v.json, onnx: v.onnx } });
      // o botão Cancelar da janela só marca "cancelado": confere aqui
      const vigia = setInterval(() => {
        if (!janela.cancelado || !downloads.has(id)) return;
        const d = downloads.get(id); downloads.delete(id);
        reiniciarWorker(new Error('cancelado'));
        d.reject(new Error('cancelado'));
      }, 200);
      try {
        await pronto;
        liberadas.add(v.id);
        v.baixada = true;
        v.name = nomeDaVoz(v) + ' — Piper (neural, guardada neste navegador)';
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
        if (LPM.voz.aoMudar) LPM.voz.aoMudar();
        ui.aviso('Voz ' + nomeDaVoz(v) + ' pronta e guardada neste navegador.', null, 5000);
        // [Nebulosa] também no canto de notificações do Workspace (o download pode levar alguns minutos)
        if (window.NebulosaSkin && window.NebulosaSkin.notificar) window.NebulosaSkin.notificar({ titulo: 'Voz ' + nomeDaVoz(v) + ' pronta', texto: 'A voz neural foi baixada e fica guardada neste navegador.', tipo: 'sucesso' });
        return true;
      } catch (e) {
        if (e.message !== 'cancelado') ui.aviso('Não foi possível baixar a voz: ' + e.message, 'erro', 9000);
        return false;
      } finally {
        clearInterval(vigia);
        janela.fechar();
      }
    })();
    emAndamento.set(v.id, tarefa);
    tarefa.finally(() => emAndamento.delete(v.id));
    return tarefa;
  };

  /* ---------------- Síntese ---------------- */

  /** Encerra o worker e devolve o erro a todos os pedidos em andamento. */
  function reiniciarWorker(erro) {
    pendentes.forEach(p => { cache.delete(p.chave); p.reject(erro); });
    pendentes.clear();
    downloads.forEach(d => d.reject(erro));
    downloads.clear();
    if (worker) { try { worker.terminate(); } catch (e) { /* ignora */ } }
    worker = null;
  }

  function garantirWorker() {
    if (worker) return;
    worker = new Worker('js/piper-worker.js');
    const web = P.motor === 'web';
    worker.postMessage({
      tipo: 'config',
      ort: web ? WEB.ort : util.urlAbsoluta(BASE + 'ort/'),
      fonemizador: web ? WEB.fonemizador : util.urlAbsoluta(BASE + 'phonemize/'),
      cache: WEB ? WEB.cache : undefined
    });
    worker.onmessage = ev => {
      const m = ev.data;
      const d = downloads.get(m.id);
      if (d) {
        if (m.tipo === 'progresso') { d.progresso(m); return; }
        downloads.delete(m.id);
        if (m.tipo === 'erro') d.reject(new Error(m.mensagem)); else d.resolve();
        return;
      }
      const p = pendentes.get(m.id);
      if (!p || m.tipo === 'progresso') return;
      pendentes.delete(m.id);
      if (m.tipo === 'audio') p.resolve({ pcm: m.pcm, taxa: m.taxa });
      else { cache.delete(p.chave); p.reject(new Error(m.mensagem)); }
    };
    worker.onerror = ev => {
      // falha geral do worker: devolve o erro a quem estava esperando e recomeça do zero
      reiniciarWorker(new Error('O motor de voz Piper falhou: ' + (ev.message || 'erro desconhecido')));
    };
  }

  /**
   * Devolve o áudio de um texto: Promise<{ pcm: Float32Array, taxa }>.
   * velocidade 1 = normal; 2 = duas vezes mais rápido.
   */
  P.sintetizar = function (texto, velocidade, vozId) {
    const voz = P.vozes.find(x => x.id === vozId);
    if (!voz) return Promise.reject(new Error('A voz Piper "' + vozId + '" não está disponível.'));
    if (!P.liberada(voz)) return Promise.reject(new Error('A voz ' + nomeDaVoz(voz) + ' ainda não foi baixada.'));
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
    worker.postMessage({ tipo: 'sintetizar', id, voz: { id: voz.id, json: voz.json, onnx: voz.onnx }, texto, escala });
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
