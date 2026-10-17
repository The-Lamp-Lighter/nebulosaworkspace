/* ============================================================
   LêPraMim — gerador.js
   "Gerar Audiobook": converte o texto do livro em arquivos de
   áudio (WAV ou MP3), por capítulo ou livro completo.

   COMO FUNCIONA (limitação dos navegadores):
   a Speech Synthesis API fala o texto, mas não entrega o áudio
   ao programa. Por isso o LêPraMim lê o livro em voz alta e
   grava o som do próprio computador (o navegador pede permissão
   para "compartilhar a tela com áudio do sistema"). A gravação
   leva o mesmo tempo da leitura e fica só neste computador.

   WAV é gerado sem dependências. MP3 usa a biblioteca lamejs
   (pasta libs/lamejs), quando instalada.
   ============================================================ */
(function () {
  'use strict';
  const { $, el, formatarDuracao, esperar } = LPM.util;
  const cfg = LPM.dados.cfg;
  const ui = LPM.ui;
  const G = { gravando: false };

  /* ---------------- Codificadores ---------------- */

  /** Cabeçalho de um arquivo WAV PCM 16 bits mono. */
  function cabecalhoWav(bytesDeAudio, taxa) {
    const b = new ArrayBuffer(44), v = new DataView(b);
    const txt = (pos, s) => { for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i)); };
    txt(0, 'RIFF'); v.setUint32(4, 36 + bytesDeAudio, true); txt(8, 'WAVE');
    txt(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, taxa, true); v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    txt(36, 'data'); v.setUint32(40, bytesDeAudio, true);
    return b;
  }

  function codificadorWav(taxa) {
    let partes = [], total = 0;
    return {
      extensao: 'wav',
      adicionar(pcm) {
        partes.push(pcm);
        total += pcm.length * 2;
        if (partes.length > 256) partes = [new Blob(partes)]; // libera memória em gravações longas
      },
      fechar() { return new Blob([cabecalhoWav(total, taxa)].concat(partes), { type: 'audio/wav' }); }
    };
  }

  function codificadorMp3(taxa) {
    const enc = new window.lamejs.Mp3Encoder(1, taxa, 64);
    let partes = [];
    return {
      extensao: 'mp3',
      adicionar(pcm) {
        const saida = enc.encodeBuffer(pcm);
        if (saida.length) partes.push(new Uint8Array(saida));
        if (partes.length > 512) partes = [new Blob(partes)];
      },
      fechar() {
        const fim = enc.flush();
        if (fim.length) partes.push(new Uint8Array(fim));
        return new Blob(partes, { type: 'audio/mpeg' });
      }
    };
  }

  /* ---------------- Texto a gravar ---------------- */

  /** Junta as frases em blocos de até ~600 caracteres (fala mais natural, com menos pausas). */
  function blocosEntre(dadosLivro, ini, fim) {
    const blocos = [];
    const pgs = dadosLivro.paginas;
    for (let p = ini.pagina; p < pgs.length; p++) {
      if (fim && p > fim.pagina) break;
      const pars = pgs[p].paragrafos;
      for (let i = (p === ini.pagina ? ini.paragrafo : 0); i < pars.length; i++) {
        if (fim && p === fim.pagina && i >= fim.paragrafo) break;
        let atual = '';
        pars[i].frases.forEach(f => {
          if (atual && atual.length + f.length > 600) { blocos.push(atual); atual = ''; }
          atual += (atual ? ' ' : '') + f;
        });
        if (atual) blocos.push(atual);
      }
    }
    return blocos;
  }

  /** Lista de partes a gravar: [{ nome, blocos }] */
  function montarPartes(escopo) {
    const L = LPM.leitor;
    const caps = L.dados.capitulos;
    const inicio = { pagina: 0, paragrafo: 0 };
    if (escopo === 'livro' || !caps.length) return [{ nome: '', blocos: blocosEntre(L.dados, inicio, null) }];
    const parte = i => ({ nome: caps[i].titulo, blocos: blocosEntre(L.dados, caps[i], caps[i + 1] || null) });
    if (escopo === 'capitulo') {
      const i = Math.max(0, LPM.capitulos.capituloDe(caps, L.pagina, L.paragrafo));
      return [parte(i)];
    }
    return caps.map((c, i) => parte(i)).filter(p => p.blocos.length);
  }

  const caracteres = partes => partes.reduce((s, p) => s + p.blocos.reduce((x, b) => x + b.length, 0), 0);
  const estimar = (partes, vel) => caracteres(partes) / (14.5 * vel);

  /* ---------------- Janela de opções ---------------- */

  G.abrir = async function () {
    const L = LPM.leitor;
    if (!L.meta || !L.dados || !L.dados.totalCaracteres) { ui.aviso('Abra um livro com texto para gerar o audiobook.', 'erro'); return; }
    if (G.gravando) return;
    L.parar();

    const temMp3 = (await LPM.util.carregarScript(LPM.config.LIBS.lame)) && !!window.lamejs;
    const vozes = LPM.voz.filtradas();
    const atual = LPM.voz.escolhida();

    const selVoz = el('select', { id: 'gVoz' }, vozes.map(v => el('option', { value: v.voiceURI, text: `${v.name} (${v.lang})`, selected: atual && v.voiceURI === atual.voiceURI })));
    const vel = el('input', { type: 'range', id: 'gVel', min: '0.5', max: '3', step: '0.05', value: cfg.velocidade });
    const rotVel = el('output', { text: '' });
    const selEscopo = el('select', { id: 'gEscopo' }, [
      el('option', { value: 'capitulo', text: 'Capítulo atual' }),
      el('option', { value: 'capitulos', text: 'Livro inteiro, um arquivo por capítulo' }),
      el('option', { value: 'livro', text: 'Livro completo em um único arquivo' })
    ]);
    if (!L.dados.capitulos.length) selEscopo.value = 'livro';
    const selFormato = el('select', { id: 'gFormato' }, [
      el('option', { value: 'wav', text: 'WAV (sem compressão, arquivos grandes)' }),
      el('option', { value: 'mp3', text: temMp3 ? 'MP3 (arquivos pequenos)' : 'MP3 — instale com "Baixar-Bibliotecas"', disabled: !temMp3 })
    ]);
    if (temMp3) selFormato.value = 'mp3';
    const estimativa = el('p', { class: 'nota' });
    const explicacao = el('p', { class: 'nota destaque' });
    const TEXTO_SISTEMA = '<b>Como funciona:</b> o navegador não entrega o áudio das vozes do sistema diretamente, então o LêPraMim lê o texto em voz alta e grava o som do computador. ' +
      'Ao clicar em <b>Gravar</b>, o navegador pedirá para compartilhar a tela: escolha <b>Tela inteira</b> e ative <b>Compartilhar áudio do sistema</b>. ' +
      'A gravação leva o mesmo tempo da leitura; deixe o volume ligado e evite outros sons no computador. Nada sai deste computador.';
    const TEXTO_PIPER = '<b>Voz Piper:</b> o áudio é gerado diretamente pelo LêPraMim, sem compartilhar a tela e sem tocar nos alto-falantes. ' +
      'Você pode continuar usando o computador; só mantenha esta janela aberta até terminar. Nada sai deste computador.';

    const atualizar = () => {
      const v = parseFloat(vel.value);
      rotVel.textContent = v.toFixed(2).replace(/0$/, '').replace('.', ',') + '×';
      const partes = montarPartes(selEscopo.value);
      const seg = estimar(partes, v);
      const piper = !!(LPM.voz.porUri(selVoz.value) || {}).piper;
      const mb = selFormato.value === 'wav' ? seg * (piper ? 44100 : 48000) / 1048576 : seg * 8000 / 1048576;
      estimativa.textContent = `${partes.length === 1 ? '1 arquivo' : partes.length + ' arquivos'}, cerca de ${formatarDuracao(seg)} de áudio e ${Math.max(1, Math.round(mb))} MB.` +
        (piper ? ' A geração costuma ser mais rápida que a leitura.' : '');
      explicacao.innerHTML = piper ? TEXTO_PIPER : TEXTO_SISTEMA;
    };
    [vel, selEscopo, selFormato, selVoz].forEach(c => c.addEventListener('input', atualizar));
    atualizar();

    const corpo = el('div', null, [
      el('div', { class: 'campo' }, [el('label', { for: 'gVoz', text: 'Voz' }), selVoz]),
      el('div', { class: 'campo' }, [el('label', { for: 'gVel', text: 'Velocidade' }), vel, rotVel]),
      el('div', { class: 'campo' }, [el('label', { for: 'gEscopo', text: 'O que gravar' }), selEscopo]),
      el('div', { class: 'campo' }, [el('label', { for: 'gFormato', text: 'Formato' }), selFormato]),
      estimativa,
      explicacao
    ]);

    ui.modal({
      titulo: 'Gerar audiobook', corpo,
      botoes: [
        { texto: 'Cancelar' },
        { texto: 'Gravar', classe: 'primario', acao: () => gravar({
          voz: LPM.voz.porUri(selVoz.value), velocidade: parseFloat(vel.value),
          partes: montarPartes(selEscopo.value), formato: selFormato.value
        }) }
      ]
    });
  };

  /* ---------------- Gravação ---------------- */

  /** Nome do arquivo de uma parte: "Título - 03 - Capítulo.mp3". */
  function nomeDaParte(op, i, extensao) {
    const base = LPM.util.nomeArquivo(LPM.leitor.meta.titulo);
    const parte = op.partes[i];
    const casas = String(op.partes.length).length;
    return op.partes.length > 1
      ? `${base} - ${String(i + 1).padStart(casas, '0')} - ${LPM.util.nomeArquivo(parte.nome)}.${extensao}`
      : `${base}${parte.nome ? ' - ' + LPM.util.nomeArquivo(parte.nome) : ''}.${extensao}`;
  }

  /** Salva um arquivo pronto e o acrescenta à lista da janela. */
  function entregar(blob, nome, lista) {
    const url = LPM.util.baixar(blob, nome);
    lista.appendChild(el('a', { class: 'item', href: url, download: nome, text: `⬇ ${nome} (${LPM.util.formatarTamanho(blob.size)})` }));
  }

  function mostrarResultado(cancelado, gerados, lista) {
    ui.modal({
      titulo: cancelado ? 'Geração interrompida' : 'Audiobook gerado',
      corpo: el('div', null, [
        el('p', { text: gerados
          ? `${gerados === 1 ? '1 arquivo foi salvo' : gerados + ' arquivos foram salvos'} na pasta de downloads do navegador. Você pode adicioná-los à biblioteca para ouvir no player.`
          : 'Nenhum arquivo foi gerado.' }),
        gerados ? lista : null
      ]),
      botoes: [{ texto: 'Fechar', classe: 'primario' }]
    });
  }

  /* ---------------- Geração direta (vozes Piper) ---------------- */

  /** Converte amostras de -1..1 para inteiros de 16 bits. */
  function paraInt16(pcm) {
    const saida = new Int16Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      const v = Math.max(-1, Math.min(1, pcm[i]));
      saida[i] = v < 0 ? v * 32768 : v * 32767;
    }
    return saida;
  }

  /** Com voz Piper o áudio vem pronto do motor: não é preciso gravar o som do computador. */
  async function gerarDireto(op) {
    const estado = { cancelado: false };
    const barra = el('div');
    const texto = el('div', { class: 'progresso-texto', text: 'Preparando a voz…' });
    const arquivos = el('div', { class: 'menu-lista', style: { marginTop: '10px' } });
    const janela = ui.modal({
      titulo: 'Gerando o audiobook', fixo: true,
      corpo: el('div', null, [
        el('p', { class: 'nota', text: 'O áudio está sendo gerado. Mantenha esta janela aberta; os arquivos prontos aparecem abaixo.' }),
        el('div', { class: 'progresso' }, barra), texto, arquivos
      ]),
      botoes: [{ texto: 'Parar', manter: true, acao: () => { estado.cancelado = true; texto.textContent = 'Encerrando…'; } }]
    });

    G.gravando = true;
    const total = caracteres(op.partes);
    const inicio = Date.now();
    let feitos = 0, gerados = 0;
    try {
      for (let i = 0; i < op.partes.length && !estado.cancelado; i++) {
        const parte = op.partes[i];
        if (!parte.blocos.length) continue;
        let cod = null, taxa = 22050;
        for (let k = 0; k < parte.blocos.length && !estado.cancelado; k++) {
          texto.textContent = `${op.partes.length > 1 ? `Parte ${i + 1} de ${op.partes.length}: ` : ''}${parte.nome || LPM.leitor.meta.titulo} — ${Math.round((feitos / total) * 100)}% (${formatarDuracao((Date.now() - inicio) / 1000)})`;
          const audio = await LPM.piper.sintetizar(parte.blocos[k], op.velocidade, op.voz.id);
          if (!cod) { taxa = audio.taxa; cod = op.formato === 'mp3' ? codificadorMp3(taxa) : codificadorWav(taxa); }
          cod.adicionar(paraInt16(audio.pcm));
          cod.adicionar(new Int16Array(Math.round(taxa * 0.35))); // respiro entre os blocos
          feitos += parte.blocos[k].length;
          barra.style.width = Math.round((feitos / total) * 100) + '%';
        }
        if (estado.cancelado || !cod) break; // descarta a parte incompleta
        entregar(cod.fechar(), nomeDaParte(op, i, cod.extensao), arquivos);
        gerados++;
      }
    } catch (e) {
      ui.aviso('A geração falhou: ' + (e.message || e), 'erro', 9000);
    } finally {
      G.gravando = false;
    }
    janela.fechar();
    mostrarResultado(estado.cancelado, gerados, arquivos);
  }

  /* ---------------- Gravação do som do sistema (vozes do Windows) ---------------- */

  async function gravar(op) {
    const L = LPM.leitor;
    if (!op.partes.length || !caracteres(op.partes)) { ui.aviso('Não há texto para gravar neste trecho.', 'erro'); return; }
    if (op.voz && op.voz.piper) return gerarDireto(op);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      ui.aviso('Este navegador não permite gravar o áudio do sistema. Use o Microsoft Edge ou o Chrome no computador.', 'erro');
      return;
    }

    // 1) Permissão para capturar o áudio do sistema
    let fluxo;
    try {
      fluxo = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        systemAudio: 'include'
      });
    } catch (e) {
      ui.aviso('A gravação foi cancelada: é preciso permitir o compartilhamento da tela com áudio.', 'erro');
      return;
    }
    const encerrarFluxo = () => fluxo.getTracks().forEach(t => t.stop());
    if (!fluxo.getAudioTracks().length) {
      encerrarFluxo();
      ui.modal({ titulo: 'Áudio do sistema não compartilhado', corpo:
        'A tela foi compartilhada sem o áudio. Tente de novo e, na janela do navegador, escolha "Tela inteira" e marque "Compartilhar áudio do sistema" (em alguns sistemas a opção aparece como "Compartilhar áudio da guia").',
        botoes: [{ texto: 'Entendi', classe: 'primario' }] });
      return;
    }

    // 2) Cadeia de áudio: captura -> processador -> (mudo) -> saída
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const fonte = ctx.createMediaStreamSource(new MediaStream(fluxo.getAudioTracks()));
    const proc = ctx.createScriptProcessor(4096, 2, 1);
    const mudo = ctx.createGain();
    mudo.gain.value = 0; // não devolve o som capturado aos alto-falantes (evitaria eco)
    fonte.connect(proc); proc.connect(mudo); mudo.connect(ctx.destination);
    // Reduz a taxa de amostragem (voz não precisa de 48 kHz) para arquivos menores
    const fator = ctx.sampleRate >= 88200 ? 4 : (ctx.sampleRate >= 44100 ? 2 : 1);
    const taxa = Math.round(ctx.sampleRate / fator);
    let cod = null;
    proc.onaudioprocess = ev => {
      if (!cod) return;
      const buf = ev.inputBuffer;
      const a = buf.getChannelData(0), b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a;
      const n = Math.floor(a.length / fator);
      const pcm = new Int16Array(n);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let k = 0; k < fator; k++) s += a[i * fator + k] + b[i * fator + k];
        s = Math.max(-1, Math.min(1, s / (2 * fator)));
        pcm[i] = s < 0 ? s * 32768 : s * 32767;
      }
      cod.adicionar(pcm);
    };

    // 3) Janela de acompanhamento
    const estado = { cancelado: false, destravar: null };
    // Interrompe: cala a voz e destrava a espera do bloco em andamento
    // (voz.calar() não dispara "aoTerminar" de propósito)
    const interromper = () => {
      estado.cancelado = true;
      LPM.voz.calar();
      texto.textContent = 'Encerrando…';
      if (estado.destravar) estado.destravar();
    };
    const barra = el('div');
    const texto = el('div', { class: 'progresso-texto' });
    const arquivos = el('div', { class: 'menu-lista', style: { marginTop: '10px' } });
    const janela = ui.modal({
      titulo: 'Gravando o audiobook', fixo: true,
      corpo: el('div', null, [
        el('p', { class: 'nota', text: 'A voz está lendo o livro e o som está sendo gravado. Não feche esta janela nem use outros sons no computador.' }),
        el('div', { class: 'progresso' }, barra), texto, arquivos
      ]),
      botoes: [{ texto: 'Parar gravação', manter: true, acao: () => interromper() }]
    });
    // Se o usuário encerrar o compartilhamento pelo navegador, a gravação também para
    fluxo.getTracks().forEach(t => t.addEventListener('ended', () => interromper()));

    G.gravando = true;
    const total = caracteres(op.partes);
    let feitos = 0, gerados = 0;
    const inicio = Date.now();

    try {
      for (let i = 0; i < op.partes.length && !estado.cancelado; i++) {
        const parte = op.partes[i];
        if (!parte.blocos.length) continue;
        cod = op.formato === 'mp3' ? codificadorMp3(taxa) : codificadorWav(taxa);
        await esperar(250);

        for (let k = 0; k < parte.blocos.length && !estado.cancelado; k++) {
          const bloco = parte.blocos[k];
          texto.textContent = `${op.partes.length > 1 ? `Parte ${i + 1} de ${op.partes.length}: ` : ''}${parte.nome || L.meta.titulo} — ${Math.round((feitos / total) * 100)}% (${formatarDuracao((Date.now() - inicio) / 1000)})`;
          await new Promise(resolve => {
            estado.destravar = resolve; // guardado para destravar ao cancelar
            LPM.voz.falar(bloco, { voz: op.voz, velocidade: op.velocidade, volume: 1, aoTerminar: resolve, aoErro: resolve });
            if (estado.cancelado) resolve();
          });
          feitos += bloco.length;
          barra.style.width = Math.round((feitos / total) * 100) + '%';
        }
        if (estado.cancelado) { cod = null; break; } // descarta a parte incompleta

        await esperar(450); // deixa o fim da última palavra entrar na gravação
        const pronto = cod; cod = null;
        entregar(pronto.fechar(), nomeDaParte(op, i, pronto.extensao), arquivos);
        gerados++;
      }
    } catch (e) {
      ui.aviso('A gravação falhou: ' + (e.message || e), 'erro');
    } finally {
      cod = null;
      G.gravando = false;
      LPM.voz.calar();
      try { proc.disconnect(); fonte.disconnect(); mudo.disconnect(); } catch (e) { /* ignora */ }
      try { await ctx.close(); } catch (e) { /* ignora */ }
      encerrarFluxo();
    }

    janela.fechar();
    mostrarResultado(estado.cancelado, gerados, arquivos);
  }

  LPM.gerador = G;
})();
