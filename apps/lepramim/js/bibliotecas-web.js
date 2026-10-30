/* ============================================================
   LêPraMim — bibliotecas-web.js   [Nebulosa]
   Componentes opcionais baixados pela internet na primeira vez
   em que são usados, do mesmo jeito que a voz Piper:
     ocr   Tesseract.js  — reconhecer texto de PDFs digitalizados e imagens
     mp3   lamejs        — gerar o audiobook em MP3
     docx  Mammoth.js    — leitor mais completo de documentos do Word
   Ordem de busca: 1) pasta libs/ (Baixar-Bibliotecas), 2) cópia já
   guardada neste navegador, 3) internet (pede permissão e mostra o
   progresso). Os endereços são os mesmos do Baixar-Bibliotecas e
   ficam em LPM.config.LIBS_WEB. Nenhum texto dos livros sai do
   computador: só os arquivos do programa são baixados.
   ============================================================ */
(function () {
  'use strict';
  const B = {};
  const util = LPM.util;

  const WEB = () => LPM.config.LIBS_WEB;
  const LOCAL = () => LPM.config.LIBS;
  const cfg = () => LPM.dados.cfg;
  const urlsBlob = {}; // url da internet -> blob: (desta sessão)

  // Teste de suporte a SIMD do WebAssembly (o mesmo do "wasm-feature-detect")
  const temSimd = (() => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; } })();

  /** Arquivos de cada componente (endereços da internet) e tamanho aproximado. */
  function arquivos(nome) {
    const W = WEB();
    if (nome === 'ocr') return {
      mb: 18, titulo: 'reconhecimento de texto (OCR)',
      lista: [
        { url: W.tesseract, rotulo: 'Tesseract.js' },
        { url: W.tesseractWorker, rotulo: 'Tesseract.js (trabalhador)' },
        { url: W.tesseractCore + (temSimd ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'), rotulo: 'motor do OCR' }
      ]
    };
    if (nome === 'mp3') return { mb: 0.2, titulo: 'gravação em MP3', lista: [{ url: W.lame, rotulo: 'lamejs' }] };
    if (nome === 'docx') return { mb: 0.7, titulo: 'leitor completo de Word (DOCX)', lista: [{ url: W.mammoth, rotulo: 'Mammoth.js' }] };
    return null;
  }
  const globalDe = nome => nome === 'ocr' ? window.Tesseract : nome === 'mp3' ? window.lamejs : window.mammoth;
  const localDe = nome => nome === 'ocr' ? LOCAL().tesseract : nome === 'mp3' ? LOCAL().lame : LOCAL().mammoth;

  async function abrirCache() {
    try { return await caches.open(WEB().cache); } catch (e) { return null; }
  }
  /** true se todos os arquivos do componente já estão guardados neste navegador. */
  B.guardada = async function (nome) {
    const a = arquivos(nome), c = await abrirCache();
    if (!a || !c) return false;
    for (const f of a.lista) if (!(await c.match(f.url))) return false;
    return true;
  };

  /** Baixa (ou lê do cache) um arquivo e devolve um endereço blob: para ele. */
  async function blobDe(url, aoProgresso) {
    if (urlsBlob[url]) return urlsBlob[url];
    const c = await abrirCache();
    let r = c ? await c.match(url) : null;
    if (!r) {
      const resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status + ' em ' + url.replace(/^https:\/\/[^/]+\//, ''));
      const total = +resp.headers.get('content-length') || 0;
      let corpo;
      if (resp.body && resp.body.getReader) {
        const leitor = resp.body.getReader(), partes = [];
        let n = 0;
        for (;;) { const { done, value } = await leitor.read(); if (done) break; partes.push(value); n += value.length; if (aoProgresso) aoProgresso(n, total); }
        corpo = new Blob(partes, { type: 'text/javascript' });
      } else corpo = new Blob([await resp.arrayBuffer()], { type: 'text/javascript' });
      if (c) { try { await c.put(url, new Response(corpo, { headers: { 'Content-Type': 'text/javascript' } })); } catch (e) { /* sem espaço: segue sem guardar */ } }
      r = new Response(corpo);
    }
    const blob = new Blob([await r.arrayBuffer()], { type: 'text/javascript' });
    urlsBlob[url] = URL.createObjectURL(blob);
    return urlsBlob[url];
  }

  const emAndamento = {};
  /**
   * Garante que o componente esteja carregado. Resolve true/false.
   * op.perguntar = false: não pergunta nem baixa; só usa o que já existe (pasta libs ou cópia guardada).
   */
  B.obter = function (nome, op) {
    op = op || {};
    if (globalDe(nome)) return Promise.resolve(true);
    if (emAndamento[nome]) return emAndamento[nome];
    const tarefa = (async () => {
      // 1) pasta libs/ deste computador ou do site
      if (await util.carregarScript(localDe(nome)) && globalDe(nome)) { B.origem[nome] = 'local'; return true; }
      const a = arquivos(nome);
      const guardada = await B.guardada(nome);
      // 2) cópia guardada neste navegador (funciona sem internet)
      if (!guardada) {
        if (op.perguntar === false) return false;
        if (navigator.onLine === false) return false;
        const escolhas = cfg().libsWeb || (cfg().libsWeb = {});
        if (escolhas[nome] === false && !op.forcar) return false;
        if (escolhas[nome] !== true) {
          const ok = await LPM.ui.perguntar('Baixar o componente de ' + a.titulo + '?',
            (op.explicacao ? op.explicacao + ' ' : '') +
            'O LêPraMim baixa este componente uma única vez (cerca de ' + a.mb.toLocaleString(window.NebulosaIdiomas ? NebulosaIdiomas.local() : 'pt-BR') + ' MB) e o guarda neste navegador; ' +
            'das próximas vezes ele funciona na hora, mesmo sem internet. O conteúdo dos seus livros nunca sai do computador.',
            'Baixar', op.textoNao || 'Agora não');
          escolhas[nome] = ok || (op.lembrarNao ? false : undefined);
          if (escolhas[nome] === undefined) delete escolhas[nome];
          LPM.dados.salvarCfg();
          if (!ok) return false;
        }
      }
      const janela = guardada ? null : LPM.ui.progresso('Baixando: ' + a.titulo);
      const mb = n => (n / 1048576).toLocaleString(window.NebulosaIdiomas ? NebulosaIdiomas.local() : 'pt-BR', { maximumFractionDigits: 1 });
      try {
        const blobs = [];
        for (let i = 0; i < a.lista.length; i++) {
          const f = a.lista[i];
          if (janela && janela.cancelado) throw new Error('cancelado');
          blobs.push(await blobDe(f.url, (n, t) => { if (janela) janela.atualizar(f.rotulo + ': ' + mb(n) + (t ? ' de ' + mb(t) : '') + ' MB  (' + (i + 1) + ' de ' + a.lista.length + ')', t ? (i + n / t) / a.lista.length : undefined); }));
        }
        if (janela && janela.cancelado) throw new Error('cancelado');
        if (!(await util.carregarScript(blobs[0])) || !globalDe(nome)) throw new Error('o componente não pôde ser iniciado');
        B.blobs[nome] = blobs;
        B.origem[nome] = 'web';
        if (janela) {
          if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
          LPM.ui.aviso('Componente de ' + a.titulo + ' pronto e guardado neste navegador.', null, 5000);
          if (window.NebulosaSkin && window.NebulosaSkin.notificar) window.NebulosaSkin.notificar({ titulo: 'Componente pronto', texto: 'O LêPraMim baixou o componente de ' + a.titulo + ' e o guardou neste navegador.', tipo: 'sucesso' });
        }
        return true;
      } catch (e) {
        if (e.message !== 'cancelado') LPM.ui.aviso('Não foi possível baixar o componente de ' + a.titulo + ': ' + e.message, 'erro', 9000);
        return false;
      } finally {
        if (janela) janela.fechar();
      }
    })();
    emAndamento[nome] = tarefa;
    tarefa.finally(() => { delete emAndamento[nome]; });
    return tarefa;
  };
  B.blobs = {};
  B.origem = {};

  /** Opções do Tesseract.createWorker conforme a origem do componente. */
  B.opcoesOcr = function () {
    if (B.origem.ocr === 'web' && B.blobs.ocr) {
      return {
        workerPath: B.blobs.ocr[1],
        // o "#….js" no fim faz o Tesseract usar este arquivo direto (sem escolher pela pasta)
        corePath: B.blobs.ocr[2] + '#tesseract-core.wasm.js',
        langPath: WEB().tesseractLang,
        workerBlobURL: false
      };
    }
    return null;
  };

  /** Esquece as cópias guardadas (Configurações). */
  B.apagar = async function () {
    try { await caches.delete(WEB().cache); } catch (e) { /* ignora */ }
    Object.keys(urlsBlob).forEach(k => { URL.revokeObjectURL(urlsBlob[k]); delete urlsBlob[k]; });
  };

  LPM.libsWeb = B;
})();
