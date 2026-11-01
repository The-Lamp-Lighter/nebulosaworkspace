/* ==========================================================================
   Nebulosa Workspace — js/backup.js  (0.8)
   Backup de tudo o que o Workspace e os programas guardam NESTE navegador,
   num único arquivo .zip, para levar a outro computador ou navegador.

   O que entra:
     - localStorage do site: preferências (tema, idioma, aparências), textos e
       cópias de recuperação (Typee, Stardust, Flyde…);
     - IndexedDB do site (opcional, "mídias"): arquivos que os programas guardam
       no navegador — livros do LêPraMim, áudios do Flyde, projetos do Fluxo…
   O que não entra: os "atalhos" dos arquivos recentes (só valem neste
   computador) e os componentes baixados (vozes do LêPraMim etc.), que o
   programa baixa de novo quando precisar.

   O arquivo nunca sai do computador: é gerado e lido aqui mesmo.
   Formato: backup.json (dados) + bin/N (conteúdo binário).
   Usa o JSZip (shared/libs/jszip.min.js), carregado só na hora.
   ========================================================================== */
(function () {
  'use strict';
  const FORMATO = 1;
  const FORA = ['nebulosa-recentes']; // bancos que não entram no backup
  const TEMPORARIAS = /^nebulosa\.acesso\./;

  function base() {
    const s = document.querySelector('script[src*="js/backup.js"]');
    return s ? s.src.replace(/js\/backup\.js.*$/, '') : '';
  }
  function carregarZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = (window.__nbArq ? window.__nbArq('shared/libs/jszip.min.js') : base() + 'shared/libs/jszip.min.js');
      s.onload = () => window.JSZip ? res(window.JSZip) : rej(new Error('JSZip não carregou'));
      s.onerror = () => rej(new Error('Não foi possível carregar o JSZip'));
      document.head.appendChild(s);
    });
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  /* ---------- valores do IndexedDB → JSON + arquivos binários ---------- */
  function codificar(v, zip, cont) {
    if (v === undefined) return { __nb: 'u' };
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number') return isFinite(v) ? v : { __nb: 'num', v: String(v) };
    if (typeof v === 'bigint') return { __nb: 'big', v: String(v) };
    if (typeof v !== 'object') return null;
    if (v instanceof Date) return { __nb: 'data', v: isNaN(v) ? null : v.toISOString() };
    if (typeof Blob !== 'undefined' && v instanceof Blob) {
      const f = 'bin/' + (cont.n++);
      zip.file(f, v, { compression: 'STORE' }); cont.bytes += v.size;
      return { __nb: 'blob', f, tipo: v.type || '', nome: v instanceof File ? v.name : undefined, mod: v instanceof File ? v.lastModified : undefined };
    }
    if (v instanceof ArrayBuffer) {
      const f = 'bin/' + (cont.n++);
      zip.file(f, new Uint8Array(v), { compression: 'STORE' }); cont.bytes += v.byteLength;
      return { __nb: 'ab', f };
    }
    if (ArrayBuffer.isView(v)) {
      const f = 'bin/' + (cont.n++);
      zip.file(f, new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)), { compression: 'STORE' }); cont.bytes += v.byteLength;
      return { __nb: 'ta', t: v.constructor.name, f };
    }
    if (v instanceof Map) return { __nb: 'map', v: [...v].map(([k, x]) => [codificar(k, zip, cont), codificar(x, zip, cont)]) };
    if (v instanceof Set) return { __nb: 'set', v: [...v].map(x => codificar(x, zip, cont)) };
    if (v instanceof RegExp) return { __nb: 're', s: v.source, f: v.flags };
    if (Array.isArray(v)) return v.map(x => codificar(x, zip, cont));
    const o = {};
    for (const k of Object.keys(v)) o[k] = codificar(v[k], zip, cont);
    return Object.prototype.hasOwnProperty.call(o, '__nb') ? { __nb: 'obj', v: o } : o;
  }
  async function decodificar(v, zip) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) { const a = []; for (const x of v) a.push(await decodificar(x, zip)); return a; }
    if (typeof v.__nb === 'string') {
      switch (v.__nb) {
        case 'u': return undefined;
        case 'num': return Number(v.v);
        case 'big': return typeof BigInt === 'function' ? BigInt(v.v) : Number(v.v);
        case 'data': return v.v ? new Date(v.v) : new Date(NaN);
        case 'blob': {
          const b = await zip.file(v.f).async('blob');
          const t = new Blob([b], { type: v.tipo || '' });
          return v.nome !== undefined ? new File([t], v.nome, { type: v.tipo || '', lastModified: v.mod || Date.now() }) : t;
        }
        case 'ab': return await zip.file(v.f).async('arraybuffer');
        case 'ta': { const ab = await zip.file(v.f).async('arraybuffer'); const C = window[v.t] || Uint8Array; return v.t === 'DataView' ? new DataView(ab) : new C(ab); }
        case 'map': { const m = new Map(); for (const [k, x] of v.v) m.set(await decodificar(k, zip), await decodificar(x, zip)); return m; }
        case 'set': { const s = new Set(); for (const x of v.v) s.add(await decodificar(x, zip)); return s; }
        case 're': return new RegExp(v.s, v.f);
        case 'obj': { const o = {}; for (const k of Object.keys(v.v)) o[k] = await decodificar(v.v[k], zip); return o; }
      }
    }
    const o = {};
    for (const k of Object.keys(v)) o[k] = await decodificar(v[k], zip);
    return o;
  }

  async function bancosDoSite() {
    if (!window.indexedDB || !indexedDB.databases) return [];
    try { return (await indexedDB.databases()).filter(d => d && d.name && !FORA.includes(d.name)); } catch (e) { return []; }
  }

  async function lerBanco(nome, zip, cont, aoProgresso) {
    const db = await req(indexedDB.open(nome));
    try {
      const lojas = [];
      for (const ln of [...db.objectStoreNames]) {
        aoProgresso && aoProgresso(nome + ' › ' + ln);
        const tx = db.transaction(ln, 'readonly'), st = tx.objectStore(ln);
        const indices = [...st.indexNames].map(i => { const x = st.index(i); return { nome: i, keyPath: x.keyPath, unique: x.unique, multiEntry: x.multiEntry }; });
        const [valores, chaves] = await Promise.all([req(st.getAll()), req(st.getAllKeys())]);
        lojas.push({
          nome: ln, keyPath: st.keyPath, autoIncrement: st.autoIncrement, indices,
          registros: valores.map((v, i) => ({ c: st.keyPath === null ? codificar(chaves[i], zip, cont) : undefined, v: codificar(v, zip, cont) }))
        });
      }
      return { nome, versao: db.version, lojas };
    } finally { db.close(); }
  }

  /** Gera o arquivo de backup. op.midias = incluir o IndexedDB. Devolve { blob, nome, resumo }. */
  async function exportar(op) {
    op = op || {};
    const JSZip = await carregarZip();
    const zip = new JSZip(), cont = { n: 0, bytes: 0 };
    const local = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!TEMPORARIAS.test(k)) local[k] = localStorage.getItem(k); }
    const bancos = [];
    if (op.midias) for (const d of await bancosDoSite()) { try { bancos.push(await lerBanco(d.name, zip, cont, op.aoProgresso)); } catch (e) { console.warn('Backup: banco ignorado', d.name, e); } }
    const versao = window.NEBULOSA_VERSAO || '';
    const dados = { formato: FORMATO, app: 'Nebulosa Workspace', versao, criado: new Date().toISOString(), origem: location.origin, local, bancos };
    zip.file('backup.json', JSON.stringify(dados));
    zip.file('LEIA-ME.txt', 'Backup do Nebulosa Workspace ' + versao + ' (' + dados.criado + ').\r\nPara restaurar: abra o Nebulosa Workspace › Sobre o Workspace › Backup › Restaurar.\r\n');
    op.aoProgresso && op.aoProgresso('zip');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return {
      blob, nome: 'nebulosa-backup-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.zip',
      resumo: { chaves: Object.keys(local).length, bancos: bancos.length, registros: bancos.reduce((t, b) => t + b.lojas.reduce((u, l) => u + l.registros.length, 0), 0), bytes: blob.size }
    };
  }

  /** Lê um arquivo de backup e devolve um resumo (sem aplicar nada). */
  async function ler(arquivo) {
    const JSZip = await carregarZip();
    let zip;
    try { zip = await JSZip.loadAsync(arquivo); } catch (e) { throw new Error('Este arquivo não é um backup do Nebulosa Workspace.'); }
    const f = zip.file('backup.json');
    if (!f) throw new Error('Este arquivo não é um backup do Nebulosa Workspace.');
    const dados = JSON.parse(await f.async('string'));
    if (!dados || dados.app !== 'Nebulosa Workspace' || !dados.local) throw new Error('Este arquivo não é um backup do Nebulosa Workspace.');
    if (dados.formato > FORMATO) throw new Error('Este backup foi feito por uma versão mais nova do Nebulosa Workspace. Atualize a página e tente de novo.');
    return { zip, dados, resumo: { versao: dados.versao, criado: dados.criado, chaves: Object.keys(dados.local).length, bancos: (dados.bancos || []).length } };
  }

  function apagarBanco(nome) {
    return new Promise(res => {
      const r = indexedDB.deleteDatabase(nome);
      const t = setTimeout(() => res(false), 4000); // bloqueado por um programa aberto
      r.onsuccess = r.onerror = () => { clearTimeout(t); res(true); };
    });
  }
  async function gravarBanco(b, zip) {
    await apagarBanco(b.nome);
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open(b.nome, b.versao || 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const l of b.lojas) {
          if (d.objectStoreNames.contains(l.nome)) d.deleteObjectStore(l.nome);
          const op = {}; if (l.keyPath !== null && l.keyPath !== undefined) op.keyPath = l.keyPath; if (l.autoIncrement) op.autoIncrement = true;
          const st = d.createObjectStore(l.nome, op);
          for (const i of l.indices || []) st.createIndex(i.nome, i.keyPath, { unique: !!i.unique, multiEntry: !!i.multiEntry });
        }
      };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('Feche os programas abertos e tente de novo.'));
    });
    try {
      for (const l of b.lojas) {
        const regs = [];
        for (const x of l.registros) regs.push({ c: x.c === undefined ? undefined : await decodificar(x.c, zip), v: await decodificar(x.v, zip) });
        await new Promise((res, rej) => {
          const tx = db.transaction(l.nome, 'readwrite'), st = tx.objectStore(l.nome);
          for (const x of regs) { if (l.keyPath === null || l.keyPath === undefined) st.put(x.v, x.c); else st.put(x.v); }
          tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('Gravação cancelada'));
        });
      }
    } finally { db.close(); }
  }

  /** Aplica um backup lido por ler(). Substitui o que está neste navegador. */
  async function restaurar(lido, aoProgresso) {
    const { zip, dados } = lido;
    const manter = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (TEMPORARIAS.test(k)) manter[k] = localStorage.getItem(k); }
    localStorage.clear();
    Object.entries(manter).concat(Object.entries(dados.local)).forEach(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) { /* cheio */ } });
    for (const b of dados.bancos || []) { aoProgresso && aoProgresso(b.nome); await gravarBanco(b, zip); }
    return true;
  }

  async function estimativa() {
    try { const e = await navigator.storage.estimate(); return e.usage || 0; } catch (e) { return 0; }
  }

  window.NebulosaBackup = { exportar, ler, restaurar, estimativa, temBancos: () => !!(window.indexedDB && indexedDB.databases) };
})();
