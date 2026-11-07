/* ==========================================================================
   Utilidades — js/base.js  (Nebulosa Workspace 0.8)
   Peças comuns a todas as mini-ferramentas: navegação (#qr, #pdf/juntar…),
   avisos, baixar e copiar, escolher e soltar arquivos, bibliotecas sob demanda
   e a conversa com o Workspace (ponte NebulosaSkin).

   Cada ferramenta se registra com:
     UT.registrar('id', {
       montar(el)        monta a tela na primeira vez (el = <section>)
       abrir(sub)        ao mostrar a ferramenta (sub = parte depois da barra, ex.: 'juntar')
       conteudos()       [{ id, rotulo, tipo, nome, obter }] para o "Mandar para…"
       aceita(info)      true se recebe o arquivo { arquivo, nome, tipo, acao }
       receber(info)     recebe o arquivo (true | Promise<true>)
       ocupado()         true quando há trabalho na tela que se perderia (arquivos abertos)
     });
   ========================================================================== */
(function () {
  'use strict';
  const N = window.NebulosaSkin || null;
  const I = window.NebulosaIdiomas || null;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /** Tradução com partes variáveis: T('Página {1} de {2}', 3, 9) */
  function T(s) {
    const a = arguments;
    if (I) return I.t.apply(null, a);
    return String(s).replace(/\{(\d+)\}/g, (x, n) => a[+n] != null ? a[+n] : x);
  }
  const local = () => (I ? I.local() : 'pt-BR');
  function num(v, casas) {
    if (!isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e15 || a < 1e-6)) return v.toExponential(4).replace('.', local() === 'en-US' ? '.' : ',');
    return new Intl.NumberFormat(local(), { maximumFractionDigits: casas == null ? 4 : casas }).format(v);
  }
  /** (0.9) singular ou plural: Q(1, '{1} página', '{1} páginas') */
  function Q(n, um, varios) { return T(n === 1 ? um : varios, num(n, 0)); }
  function tam(b) {
    if (b < 1024) return num(b, 0) + ' B';
    if (b < 1048576) return num(b / 1024, 1) + ' KB';
    if (b < 1073741824) return num(b / 1048576, 1) + ' MB';
    return num(b / 1073741824, 2) + ' GB';
  }
  const PREF = 'nebulosa.utilidades.';
  function ler(k, d) { try { const v = localStorage.getItem(PREF + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function guardar(k, v) {
    try { if (v == null) localStorage.removeItem(PREF + k); else localStorage.setItem(PREF + k, JSON.stringify(v)); return true; }
    catch (e) { aviso(T('O navegador não deixou guardar (espaço cheio ou bloqueado).'), true); return false; }
  }

  /* ---------- ícones ---------- */
  const S = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  const ICO = {
    baixar: S('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    lixo: S('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
    mais: S('<path d="M12 5v14M5 12h14"/>'),
    x: S('<path d="M6 6l12 12M18 6L6 18"/>'),
    girarE: S('<path d="M3 4v6h6"/><path d="M3.6 14a8.5 8.5 0 102.3-8.4L3 10"/>'),
    girarD: S('<path d="M21 4v6h-6"/><path d="M20.4 14a8.5 8.5 0 11-2.3-8.4L21 10"/>'),
    cima: S('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    baixo: S('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    esq: S('<path d="M15 6l-6 6 6 6"/>'),
    dir: S('<path d="M9 6l6 6-6 6"/>'),
    trocar: S('<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
    renovar: S('<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>'),
    conta: S('<path d="M14.5 4.5l5 5"/><path d="M16.5 2.5l5 5-3 3-5-5z"/><path d="M13.5 7.5l-9 9-1 4 4-1 9-9"/>'),
    lapis: S('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
    ok: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    sol: S('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    lua: S('<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>'),
    olho: S('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    olhoX: S('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 005.4-1.6"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>'),
    fixar: S('<path d="M12 17v5"/><path d="M9 3h6l-1 6 4 4H6l4-4z"/>'),
    mandar: (window.NEBULOSA_ICONS && window.NEBULOSA_ICONS.send) || S('<path d="M4 12l16-8-6 16-2-7z"/>'),
    copiar: (window.NEBULOSA_ICONS && window.NEBULOSA_ICONS.copy) || S('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>'),
    imagem: (window.NEBULOSA_ICONS && window.NEBULOSA_ICONS.image) || S('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
    arquivo: (window.NEBULOSA_ICONS && window.NEBULOSA_ICONS.file) || S('<path d="M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8z"/><path d="M14 3v5h5"/>')
  };
  const icone = n => ICO[n] || (window.NEBULOSA_ICONS && window.NEBULOSA_ICONS[n]) || '';

  /* ---------- avisos ---------- */
  let avT = null;
  function aviso(msg, erro) {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.toggle('err', !!erro); t.classList.add('on');
    clearTimeout(avT); avT = setTimeout(() => t.classList.remove('on'), erro ? 5200 : 3000);
  }

  /* ---------- baixar, copiar ---------- */
  function baixar(blob, nome) {
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u; a.download = nome; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 30000);
  }
  async function copiar(texto, msg) {
    let ok = false;
    try { await navigator.clipboard.writeText(texto); ok = true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = texto; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (x) { ok = false; }
      ta.remove();
    }
    aviso(ok ? (msg || T('Copiado.')) : T('Não foi possível copiar. Selecione e copie com Ctrl+C.'), !ok);
    return ok;
  }
  async function copiarImagem(blob) {
    try {
      if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) throw new Error('sem suporte');
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
      aviso(T('Imagem copiada. Cole onde quiser com Ctrl+V.'));
      return true;
    } catch (e) { aviso(T('Este navegador não deixa copiar imagens. Use “Baixar”.'), true); return false; }
  }
  const nomeSeguro = (s, d) => (String(s || '').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || d || 'arquivo');
  const semExt = n => String(n || '').replace(/\.[^.]+$/, '');

  /* ---------- escolher e soltar arquivos ---------- */
  function escolher(accept, multiplo) {
    return new Promise(res => {
      const i = document.createElement('input');
      i.type = 'file'; if (accept) i.accept = accept; if (multiplo) i.multiple = true;
      i.style.cssText = 'position:fixed;left:-9999px;opacity:0';
      i.addEventListener('change', () => { res(i.files ? [...i.files] : []); setTimeout(() => i.remove(), 0); }, { once: true });
      document.body.appendChild(i);
      i.click();
      setTimeout(() => { if (i.isConnected) i.remove(); }, 600000);
    });
  }
  /** Área de soltar arquivos (também abre a janela de escolher ao clicar). */
  function zona(el, op) {
    const filtra = fs => [...fs].filter(f => !op.filtro || op.filtro(f));
    let n = 0;
    el.addEventListener('dragenter', e => { if (!temArquivos(e)) return; e.preventDefault(); n++; el.classList.add('sobre'); });
    el.addEventListener('dragover', e => { if (!temArquivos(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    el.addEventListener('dragleave', () => { n = Math.max(0, n - 1); if (!n) el.classList.remove('sobre'); });
    el.addEventListener('drop', e => {
      if (!temArquivos(e)) return;
      e.preventDefault(); e.stopPropagation(); n = 0; el.classList.remove('sobre');
      const fs = filtra(e.dataTransfer.files);
      if (fs.length) op.aoArquivos(fs); else aviso(op.recusa || T('Esse tipo de arquivo não serve aqui.'), true);
    });
    el.addEventListener('click', e => {
      if (e.target.closest('a,input,select,textarea') || (e.target.closest('button') && !e.target.closest('[data-escolher]'))) return;
      escolher(op.accept, op.multiplo).then(fs => { fs = filtra(fs); if (fs.length) op.aoArquivos(fs); });
    });
    el.tabIndex = el.tabIndex >= 0 ? el.tabIndex : 0;
    el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); el.click(); } });
  }
  function temArquivos(e) { const t = e.dataTransfer && e.dataTransfer.types; return !!t && [...t].includes('Files'); }
  const ehImagem = f => /^image\//.test(f.type || '') || /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(f.name || '');
  const ehPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');

  /* ---------- bibliotecas sob demanda (no HTML único vêm embutidas: window.__nbArq) ---------- */
  const libs = {};
  function lib(rel) {
    if (!libs[rel]) libs[rel] = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = window.__nbArq ? window.__nbArq(rel) : rel;
      s.onload = () => ok(true);
      s.onerror = () => { delete libs[rel]; no(new Error(T('Não foi possível carregar um componente ({1}). Verifique a conexão e tente de novo.', rel.split('/').pop()))); };
      document.head.appendChild(s);
    });
    return libs[rel];
  }
  async function pdfjs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    const wk = 'libs/pdfjs/pdf.worker.js';
    // o "worker" do PDF.js roda na própria página: funciona no site e no arquivo baixado
    if (!(globalThis.pdfjsWorker && globalThis.pdfjsWorker.WorkerMessageHandler)) await lib(wk);
    await lib('libs/pdfjs/pdf.js');
    if (!window.pdfjsLib) throw new Error(T('O leitor de PDF não carregou.'));
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(window.__nbArq ? window.__nbArq(wk) : wk, document.baseURI).href;
    return window.pdfjsLib;
  }
  const pdflib = () => lib('libs/pdf-lib.min.js').then(() => window.PDFLib);
  const jszip = () => lib('libs/jszip.min.js').then(() => window.JSZip);

  /* ---------- ferramentas e navegação ---------- */
  const UTIL = (window.NEBULOSA_APPS || []).find(a => a.id === 'utilidades');
  const LISTA = (UTIL && UTIL.ferramentas) || [];
  const FERR = {};
  let atual = null, atualSub = '';
  function registrar(id, def) { FERR[id] = def; }
  function info(id) { return LISTA.find(f => f.id === id) || { id, nome: id, desc: '', icon: 'tools' }; }
  function mostrar(rota) {
    rota = String(rota || '').replace(/^#/, '');
    let [id, sub] = rota.split('/');
    if (id && !FERR[id]) id = '';
    sub = sub || '';
    $$('.vista').forEach(v => { v.hidden = true; });
    if (!id) {
      $('#v-inicio').hidden = false;
      atual = null; atualSub = '';
      document.title = T('Utilidades') + ' — Nebulosa Workspace';
    } else {
      const d = FERR[id];
      let el = $('#v-' + id);
      if (!el) {
        el = document.createElement('section'); el.className = 'vista'; el.id = 'v-' + id; el.dataset.vista = id;
        $('#main').appendChild(el);
        try { d.montar(el); } catch (e) { console.error(e); el.innerHTML = '<p class="aviso err">' + esc(T('Esta ferramenta não abriu: {1}', e.message || e)) + '</p>'; }
      }
      el.hidden = false;
      atual = id; atualSub = sub;
      try { if (d.abrir) d.abrir(sub); } catch (e) { console.error(e); }
      document.title = T(info(id).nome) + ' — ' + T('Utilidades');
    }
    try { sessionStorage.setItem(PREF + 'rota', rota && id ? rota : ''); } catch (e) { /* ignora */ }
    $$('#lado [data-ir]').forEach(b => { if (b.dataset.ir === (id || '')) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const tr = $('#trilha');
    tr.innerHTML = id ? '<span class="sep">›</span><b>' + esc(info(id).nome) + '</b>' : '';
    const m = $('#main'); m.scrollTop = 0;
  }
  function ir(rota) {
    rota = String(rota || '').replace(/^#/, '');
    const h = rota ? '#' + rota : '';
    if (location.hash.replace(/^#/, '') === rota) { mostrar(rota); return; }
    // replaceState: dentro do Workspace o "Voltar" do navegador não mexe nas ferramentas escondidas
    try { history.replaceState(null, '', h || location.pathname + location.search); } catch (e) { location.hash = h; return; }
    mostrar(rota);
  }
  window.addEventListener('popstate', () => mostrar(location.hash));
  window.addEventListener('hashchange', () => mostrar(location.hash));

  /* ---------- conversa com o Workspace ---------- */
  function tipoDe(info) {
    const f = info.arquivo || {}, n = String(info.nome || f.name || '').toLowerCase();
    if (info.tipo === 'imagem' || ehImagem({ type: f.type, name: n })) return 'imagem';
    if (n.endsWith('.pdf') || f.type === 'application/pdf') return 'pdf';
    if (info.tipo === 'texto' || /\.(txt|md|markdown)$/.test(n) || /^text\/plain/.test(f.type || '')) return 'texto';
    return '';
  }
  async function receber(info) {
    info.tipoUtil = tipoDe(info);
    // a ferramenta aberta recebe, se aceitar; senão vai para a ferramenta certa
    let id = atual && FERR[atual].aceita && FERR[atual].aceita(info) ? atual : ({ imagem: 'imagem', pdf: 'pdf', texto: 'contador' }[info.tipoUtil]);
    if (!id && FERR.conversor && FERR.conversor.aceita && FERR.conversor.aceita(info)) id = 'conversor';   // 1.0: outros formatos vão para o Conversor
    if (!id || !FERR[id] || !FERR[id].receber) { aviso(T('As Utilidades não sabem o que fazer com “{1}”.', info.nome), true); return false; }
    if (atual !== id) ir(id);
    return FERR[id].receber(info);
  }
  if (N) {
    if (N.aoAcao) N.aoAcao('ferramenta', id => { ir(String(id || '')); return true; });
    if (N.aoReceber) N.aoReceber(receber);
    if (N.conteudos) N.conteudos(() => { const d = atual && FERR[atual]; try { return (d && d.conteudos && d.conteudos()) || []; } catch (e) { return []; } });
  }
  window.__nebulosaOcupado = () => Object.keys(FERR).some(k => { try { return !!(FERR[k].ocupado && FERR[k].ocupado()); } catch (e) { return false; } });

  window.UT = {
    $, $$, esc, T, Q, local, num, tam, ler, guardar, ICO, icone, aviso, baixar, copiar, copiarImagem, nomeSeguro, semExt,
    escolher, zona, ehImagem, ehPdf, lib, pdfjs, pdflib, jszip, registrar, ir, mostrar, info, LISTA, FERR, N,
    get atual() { return atual; }, get sub() { return atualSub; }
  };
})();
