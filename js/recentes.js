/* ==========================================================================
   Nebulosa Workspace — js/recentes.js  (0.8)
   Arquivos recentes da página inicial.

   Os programas não precisam fazer nada: a ponte (shared/nebulosa-bridge.js)
   percebe quando um arquivo é aberto (escolher arquivo, arrastar, abrir pelo
   sistema) ou salvo (download ou "Salvar como") e avisa o Workspace com
   { nebulosa: 'arquivo', acao: 'abriu' | 'salvou', nome, handle? }.

   Guardado neste navegador, nunca enviado:
     - localStorage "nebulosa.recentes": nome do arquivo, programa, data;
     - IndexedDB "nebulosa-recentes": o "atalho" do arquivo, quando o navegador
       oferece (Chrome e Edge, arquivos abertos/salvos pela janela do sistema).
       Com ele, um clique reabre o arquivo direto no programa (o navegador
       pergunta antes se pode ler o arquivo de novo).
   ========================================================================== */
(function () {
  'use strict';
  const CHAVE = 'nebulosa.recentes', MAX = 16, DB = 'nebulosa-recentes', LOJA = 'atalhos';
  let lista = [];
  try { lista = JSON.parse(localStorage.getItem(CHAVE) || '[]'); if (!Array.isArray(lista)) lista = []; } catch (e) { lista = []; }
  lista = lista.filter(x => x && x.id && x.app && x.nome);
  const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(lista.slice(0, MAX))); } catch (e) { /* sem armazenamento */ } };
  const ouvintes = [];
  const avisar = () => ouvintes.forEach(f => { try { f(); } catch (e) { /* ignora */ } });

  let dbP = null;
  function banco() {
    if (!window.indexedDB) return Promise.resolve(null);
    if (!dbP) dbP = new Promise(res => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => { try { r.result.createObjectStore(LOJA); } catch (e) { /* já existe */ } };
        r.onsuccess = () => res(r.result);
        r.onerror = r.onblocked = () => res(null);
      } catch (e) { res(null); }
    });
    return dbP;
  }
  function pedido(modo, fn) {
    return banco().then(d => d && new Promise(res => {
      try {
        const tx = d.transaction(LOJA, modo), st = tx.objectStore(LOJA), r = fn(st);
        tx.oncomplete = () => res(r && 'result' in r ? r.result : true);
        tx.onerror = tx.onabort = () => res(null);
      } catch (e) { res(null); }
    }));
  }
  const guardarAtalho = (id, h) => pedido('readwrite', st => st.put(h, id));
  const lerAtalho = id => pedido('readonly', st => st.get(id));
  const apagarAtalho = id => pedido('readwrite', st => st.delete(id));

  function registrar(op) {
    if (!op || !op.app || !op.nome) return;
    const nome = String(op.nome).slice(0, 160);
    const id = op.app + '|' + nome.toLowerCase();
    const antigo = lista.find(x => x.id === id);
    const temAtalho = !!op.handle || !!(antigo && antigo.atalho);
    lista = [{ id, app: op.app, nome, acao: op.acao === 'salvou' ? 'salvou' : 'abriu', t: Date.now(), atalho: temAtalho }]
      .concat(lista.filter(x => x.id !== id));
    lista.slice(MAX).forEach(x => { if (x.atalho) apagarAtalho(x.id); });
    lista = lista.slice(0, MAX);
    salvar();
    if (op.handle) guardarAtalho(id, op.handle).then(ok => { if (!ok) { const x = lista.find(y => y.id === id); if (x && !antigo) { x.atalho = false; salvar(); } } });
    avisar();
  }

  /** Lê o arquivo de novo pelo atalho guardado. Devolve File ou null (sem atalho ou sem permissão). */
  async function reabrir(item) {
    if (!item || !item.atalho) return null;
    const h = await lerAtalho(item.id);
    if (!h || typeof h.getFile !== 'function') return null;
    try {
      let p = h.queryPermission ? await h.queryPermission({ mode: 'read' }) : 'granted';
      if (p !== 'granted' && h.requestPermission) p = await h.requestPermission({ mode: 'read' });
      if (p !== 'granted') return null;
      return await h.getFile();
    } catch (e) { return null; }
  }

  window.NebulosaRecentes = {
    lista: () => lista.slice(),
    registrar,
    reabrir,
    remover(id) { const x = lista.find(y => y.id === id); lista = lista.filter(y => y.id !== id); if (x && x.atalho) apagarAtalho(id); salvar(); avisar(); },
    limpar() { lista.forEach(x => { if (x.atalho) apagarAtalho(x.id); }); lista = []; salvar(); avisar(); },
    aoMudar(f) { if (typeof f === 'function') ouvintes.push(f); }
  };
})();
