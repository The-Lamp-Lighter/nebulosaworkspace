/* ============================================================
   LêPraMim — armazenamento.js
   Tudo fica no próprio computador:
   - LocalStorage: configurações, progresso de leitura, marcadores,
     estatísticas e último livro aberto (dados pequenos).
   - IndexedDB: os arquivos da biblioteca e o texto extraído
     (dados grandes, que não cabem no LocalStorage).
   Nada é enviado para a internet.
   ============================================================ */
(function () {
  'use strict';
  const PREFIXO = 'lpm.';
  const dados = {};

  /* ---------------- LocalStorage ---------------- */

  dados.ler = function (chave, padrao) {
    try {
      const v = localStorage.getItem(PREFIXO + chave);
      return v === null ? padrao : JSON.parse(v);
    } catch (e) { return padrao; }
  };

  dados.gravar = function (chave, valor) {
    try { localStorage.setItem(PREFIXO + chave, JSON.stringify(valor)); return true; }
    catch (e) { console.warn('Não foi possível gravar no LocalStorage:', e); return false; }
  };

  dados.remover = function (chave) {
    try { localStorage.removeItem(PREFIXO + chave); } catch (e) { /* ignora */ }
  };

  /* ---------------- Configurações ---------------- */

  const padrao = LPM.config.PADRAO;
  const salvo = dados.ler('config', {});
  dados.cfg = Object.assign({}, padrao, salvo);
  dados.cfg.limpeza = Object.assign({}, padrao.limpeza, salvo.limpeza || {});

  dados.salvarCfg = function () { dados.gravar('config', dados.cfg); };

  /* ---------------- Progresso por livro ---------------- */

  /** Progresso de um livro: {pagina, paragrafo, frase, tempo, pct, data, lidas, concluido, capsOk} */
  dados.progresso = function (id) {
    return dados.ler('prog.' + id, null) || { pagina: 0, paragrafo: 0, frase: 0, tempo: 0, pct: 0, data: 0 };
  };

  dados.salvarProgresso = function (id, p) {
    p.data = Date.now();
    dados.gravar('prog.' + id, p);
  };

  /* ---------------- Marcadores ---------------- */

  dados.marcadores = id => dados.ler('marc.' + id, []);
  dados.salvarMarcadores = (id, lista) => dados.gravar('marc.' + id, lista);

  /* ---------------- IndexedDB ---------------- */

  let promessaBd = null;

  function abrirBd() {
    if (promessaBd) return promessaBd;
    promessaBd = new Promise((resolve, reject) => {
      const req = indexedDB.open('LePraMim', 1);
      req.onupgradeneeded = () => {
        const bd = req.result;
        // meta: ficha do livro (título, autor, capa…) — leve, usada na estante
        if (!bd.objectStoreNames.contains('meta')) bd.createObjectStore('meta', { keyPath: 'id' });
        // conteudo: texto extraído (páginas e blocos)
        if (!bd.objectStoreNames.contains('conteudo')) bd.createObjectStore('conteudo', { keyPath: 'id' });
        // arquivos: o arquivo original (PDF para ver a página, áudio para tocar)
        if (!bd.objectStoreNames.contains('arquivos')) bd.createObjectStore('arquivos', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { promessaBd = null; reject(req.error); };
    });
    return promessaBd;
  }

  function pedido(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function loja(nome, modo) {
    const bd = await abrirBd();
    return bd.transaction(nome, modo || 'readonly').objectStore(nome);
  }

  dados.bd = {
    /** Grava um livro novo (ficha + conteúdo + arquivo original). */
    async salvarLivro(meta, conteudo, arquivo) {
      const bd = await abrirBd();
      return new Promise((resolve, reject) => {
        const tx = bd.transaction(['meta', 'conteudo', 'arquivos'], 'readwrite');
        tx.objectStore('meta').put(meta);
        if (conteudo) tx.objectStore('conteudo').put(Object.assign({ id: meta.id }, conteudo));
        if (arquivo) tx.objectStore('arquivos').put({ id: meta.id, blob: arquivo, nome: arquivo.name || meta.arquivo });
        tx.oncomplete = () => resolve(meta);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Gravação cancelada (sem espaço em disco?)'));
      });
    },
    async listar() { return pedido((await loja('meta')).getAll()); },
    async meta(id) { return pedido((await loja('meta')).get(id)); },
    async conteudo(id) { return pedido((await loja('conteudo')).get(id)); },
    async arquivo(id) { const r = await pedido((await loja('arquivos')).get(id)); return r ? r.blob : null; },
    async atualizarMeta(meta) { return pedido((await loja('meta', 'readwrite')).put(meta)); },
    async excluir(id) {
      const bd = await abrirBd();
      return new Promise((resolve, reject) => {
        const tx = bd.transaction(['meta', 'conteudo', 'arquivos'], 'readwrite');
        tx.objectStore('meta').delete(id);
        tx.objectStore('conteudo').delete(id);
        tx.objectStore('arquivos').delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }
  };

  /** Apaga absolutamente tudo (biblioteca, progresso, configurações). */
  dados.apagarTudo = async function () {
    try {
      Object.keys(localStorage).filter(k => k.startsWith(PREFIXO)).forEach(k => localStorage.removeItem(k));
    } catch (e) { /* ignora */ }
    const bd = await abrirBd();
    bd.close();
    promessaBd = null;
    await new Promise(resolve => {
      const req = indexedDB.deleteDatabase('LePraMim');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  };

  /** Pede ao navegador que não apague os dados sozinho quando faltar espaço. */
  dados.pedirPersistencia = function () {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  };

  LPM.dados = dados;
})();
