/* ============================================================
   LêPraMim — voz.js
   Leitura em voz alta com a Speech Synthesis API do navegador,
   usando as vozes instaladas no Windows (Edge/Chrome).

   Também encaminha a leitura para as vozes neurais Piper
   (piper.js) quando uma delas está instalada e escolhida.

   Privacidade: por padrão só são oferecidas as vozes LOCAIS.
   As vozes "online" do Edge enviam o texto para o provedor da
   voz; por isso ficam ocultas até o usuário liberar nas
   Configurações.
   ============================================================ */
(function () {
  'use strict';
  const sintese = window.speechSynthesis;
  const cfg = () => LPM.dados.cfg;

  // Nomes comuns de vozes, usados para estimar o gênero (a API não informa)
  const FEMININAS = /\b(maria|francisca|let[ií]cia|helo[ií]sa|helena|luciana|fernanda|raquel|vit[oó]ria|thalita|brenda|elza|giovanna|leila|manuela|yara|joana|catarina|in[eê]s|zira|hazel|susan|aria|jenny|michelle|samantha|sonia|libby|emma|ava|linda|heather|female|feminin[ao]|mulher)\b/i;
  const MASCULINAS = /\b(cadu|faber|jeff|edresson|daniel|ant[oô]nio|antonio|fabio|f[aá]bio|felipe|ricardo|humberto|julio|j[uú]lio|nicolau|valerio|val[eé]rio|donato|duarte|cristiano|david|mark|george|guy|ryan|james|brian|andrew|eric|christopher|male|masculin[ao]|homem)\b/i;

  const voz = {
    disponivel: !!sintese,
    vozes: [],
    falando: false,
    _ficha: 0,       // identifica a fala atual; falas antigas são ignoradas
    _atual: null     // referência à fala em andamento (evita ser descartada pelo navegador)
  };

  /** Gênero estimado pelo nome da voz: 'feminina', 'masculina' ou ''. */
  voz.generoDe = function (v) {
    if (v.genero) return v.genero; // vozes Piper informam o gênero
    if (FEMININAS.test(v.name)) return 'feminina';
    if (MASCULINAS.test(v.name)) return 'masculina';
    return '';
  };

  /** Junta as vozes neurais Piper (primeiro) com as vozes do sistema. */
  function montarLista() {
    voz.vozes = (LPM.piper ? LPM.piper.vozes : []).concat(voz._nativas || []);
    if (voz.aoMudar) voz.aoMudar();
  }

  /** Vozes do sistema (o navegador entrega de forma assíncrona). */
  function carregarNativas() {
    if (!sintese) return Promise.resolve();
    return new Promise(resolve => {
      let pronto = false;
      const terminar = () => {
        const lista = sintese.getVoices();
        if (!lista.length && !pronto) return;
        pronto = true;
        // Português primeiro, depois o restante em ordem alfabética
        voz._nativas = lista.slice().sort((a, b) => {
          const pa = /^pt/i.test(a.lang) ? 0 : 1, pb = /^pt/i.test(b.lang) ? 0 : 1;
          return pa - pb || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name);
        });
        montarLista();
        resolve();
      };
      sintese.addEventListener('voiceschanged', terminar);
      terminar();
      setTimeout(() => { pronto = true; terminar(); }, 2500);
    });
  }

  /** Carrega todas as vozes: as do sistema e as Piper (de libs/piper ou da internet). */
  voz.carregar = async function () {
    const piper = LPM.piper ? LPM.piper.detectar().catch(() => []) : Promise.resolve([]);
    await Promise.all([carregarNativas(), piper]);
    montarLista();
    voz.disponivel = !!sintese || voz.vozes.length > 0;
    return voz.vozes;
  };

  /** Vozes visíveis conforme as configurações (locais/online e gênero). */
  voz.filtradas = function () {
    const c = cfg();
    return voz.vozes.filter(v => {
      if (!c.vozesOnline && v.localService === false) return false;
      if (c.genero !== 'todas' && voz.generoDe(v) !== c.genero) return false;
      return true;
    });
  };

  /** A voz em uso: a última escolhida ou a melhor voz local em português. */
  voz.escolhida = function () {
    const c = cfg();
    const visiveis = voz.filtradas();
    return visiveis.find(v => v.voiceURI === c.voz) ||
      visiveis.find(v => v.piper) ||                    // voz neural instalada tem preferência
      visiveis.find(v => /^pt[-_]BR/i.test(v.lang)) ||
      visiveis.find(v => /^pt/i.test(v.lang)) ||
      visiveis[0] || voz.vozes.find(v => v.localService !== false) || null;
  };

  voz.porUri = uri => voz.vozes.find(v => v.voiceURI === uri) || null;

  /** A melhor voz do sistema (sem Piper), para quando a voz neural não pode ser usada. */
  voz.melhorDoSistema = function () {
    const sist = voz.filtradas().filter(v => !v.piper);
    return sist.find(v => /^pt[-_]BR/i.test(v.lang)) || sist.find(v => /^pt/i.test(v.lang)) || sist[0] ||
      voz.vozes.find(v => !v.piper && v.localService !== false) || null;
  };

  /**
   * Fala um texto.
   * op = { aoLimite(indice, tamanho), aoTerminar(), aoErro(e), voz, velocidade, volume, tom }
   */
  voz.falar = function (texto, op) {
    op = op || {};
    const c = cfg();
    const v = op.voz || voz.escolhida();

    // Voz Piper da internet ainda não baixada: pede permissão e baixa uma vez
    if (v && v.piper && !LPM.piper.liberada(v)) {
      const minha = ++voz._ficha;
      if (sintese) sintese.cancel();
      voz.falando = true;
      LPM.piper.garantir(v).then(ok => {
        if (minha !== voz._ficha) return; // o usuário parou ou mudou de trecho enquanto isso
        if (ok) { voz.falar(texto, op); return; }
        // Recusou ou falhou: passa a usar a melhor voz do sistema
        const alt = voz.melhorDoSistema();
        if (!alt) { voz.falando = false; if (op.aoErro) op.aoErro({ error: 'Nenhuma voz disponível neste navegador.' }); return; }
        c.voz = alt.voiceURI;
        LPM.dados.salvarCfg();
        voz.falar(texto, Object.assign({}, op, { voz: alt }));
      });
      return;
    }

    // Voz neural Piper: o áudio é gerado pelo próprio app
    if (v && v.piper) {
      voz._ficha++;
      if (sintese) sintese.cancel();
      voz._motor = 'piper';
      voz.falando = true;
      LPM.piper.falar(texto, {
        voz: v,
        velocidade: op.velocidade || c.velocidade,
        volume: op.volume !== undefined ? op.volume : c.volume,
        aoLimite: op.aoLimite,
        aoTerminar: () => { voz.falando = false; if (op.aoTerminar) op.aoTerminar(); },
        aoErro: e => { voz.falando = false; if (op.aoErro) op.aoErro(e); }
      });
      return;
    }

    // Voz do sistema (Speech Synthesis API)
    if (LPM.piper) LPM.piper.calar();
    voz._motor = 'sistema';
    if (!sintese) { if (op.aoErro) op.aoErro(new Error('Este navegador não tem leitura por voz.')); return; }
    const minha = ++voz._ficha;

    const u = new SpeechSynthesisUtterance(texto);
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'pt-BR'; }
    u.rate = op.velocidade || c.velocidade;
    u.volume = op.volume !== undefined ? op.volume : c.volume;
    u.pitch = op.tom !== undefined ? op.tom : c.tom;

    u.onboundary = e => {
      if (minha !== voz._ficha || !op.aoLimite) return;
      if (e.name && e.name !== 'word') return;
      op.aoLimite(e.charIndex, e.charLength || 0);
    };
    u.onend = () => {
      if (minha !== voz._ficha) return;
      voz.falando = false;
      if (op.aoTerminar) op.aoTerminar();
    };
    u.onerror = e => {
      if (minha !== voz._ficha) return;
      if (e.error === 'interrupted' || e.error === 'canceled') return; // parada pedida pelo próprio app
      voz.falando = false;
      if (op.aoErro) op.aoErro(e);
    };

    voz._atual = u;
    voz.falando = true;
    const iniciar = () => { if (minha === voz._ficha) sintese.speak(u); };
    // Se algo ainda está sendo falado, cancela e dá um instante ao navegador
    if (sintese.speaking || sintese.pending) { sintese.cancel(); setTimeout(iniciar, 90); }
    else iniciar();
  };

  /** Interrompe qualquer fala imediatamente. */
  voz.calar = function () {
    voz._ficha++;
    voz.falando = false;
    voz._atual = null;
    if (sintese) sintese.cancel();
    if (LPM.piper) LPM.piper.calar();
  };

  /* --- Pausa de verdade (só as vozes Piper permitem congelar o áudio no ponto exato) --- */
  voz.pausar = () => voz._motor === 'piper' && LPM.piper.pausar();
  voz.retomar = () => voz._motor === 'piper' && LPM.piper.retomar();
  voz.pausada = () => voz._motor === 'piper' && LPM.piper.pausada;

  /** Prepara com antecedência o áudio da próxima frase (leitura sem pausas com vozes Piper). */
  voz.preparar = function (texto) {
    const v = voz.escolhida();
    if (v && v.piper && texto && LPM.piper.liberada(v)) LPM.piper.sintetizar(texto, cfg().velocidade, v.id).catch(() => {});
  };

  /** true quando a voz em uso é uma voz Piper. */
  voz.usaPiper = function () { const v = voz.escolhida(); return !!(v && v.piper); };

  LPM.voz = voz;
})();
