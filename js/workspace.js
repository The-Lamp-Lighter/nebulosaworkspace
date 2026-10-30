/* ==========================================================================
   Nebulosa Workspace — js/workspace.js
   A "casca" do Workspace: menu lateral, abas, tela inicial, busca (Alt+K),
   painel de aparência e a conversa com os programas.

   Como os programas entram aqui
   -----------------------------
   Cada programa mora na própria pasta (apps/<id>/) e é aberto num <iframe>
   apontando para apps/<id>/index.html. O Workspace não lê nem altera nada
   de dentro dos programas: só conversa com eles por mensagens (postMessage).
   Por isso dá para atualizar um programa trocando só a pasta dele.

   Mensagens (todas com a chave "nebulosa"):
     Workspace → programa
       ping           pede um "hello"
       set-skin       { skin }  troca a aparência do programa
       open-skin      abre a janela de aparência do próprio programa
       query-dirty    pergunta se há alterações não salvas
       set-lang       { idioma }  (0.6) troca o idioma ('pt-BR' | 'en' | 'es')
     programa → Workspace
       hello / skin   { app, skins:[{id,name,desc,swatch}], skin }
       dirty          { dirty: true|false }  resposta ao query-dirty
       key            { code }  atalho Alt+0…9 / Alt+K apertado dentro do programa
       new-window     { app, hash }  abrir o programa numa nova janela
       notify         { title, text, kind, ttl, always }  aviso no canto de notificações
                      (kind: info | sucesso | aviso | erro). Se o programa está
                      na tela, o aviso vai só para o sino, a menos que always = true.
       lang           { idioma }  (0.6) o idioma foi trocado dentro do programa (Ajuda › Idioma)

   Idiomas (0.6): o motor fica em shared/nebulosa-bridge.js (carregado com data-host no
   index.html) e os textos do Workspace em js/idiomas.js. Os textos daqui continuam em
   português; a tradução é feita na tela. Para textos montados em JavaScript que precisam
   ser comparados (busca), use T('texto').

   Um programa que não fala esse "idioma" (sem shared/nebulosa-bridge.js)
   abre e funciona normalmente; ele só não oferece aparências pelo Workspace
   nem avisa sobre alterações não salvas ao fechar a aba.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- utilidades ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const VERSION = window.NEBULOSA_VERSAO || '0.5';
  const TEMAS = window.NEBULOSA_TEMAS || [];
  const ACESSOS = window.NebulosaAcessos;
  // (0.5) créditos: os mesmos em todos os programas (a ponte tem a mesma informação)
  const CREDITOS = { autores: 'Márcio Willians Barreto de Andrade e Raul Goulart de Andrade', equipe: 'Equipe de Produção Lamp Lighter' };
  const RODAPE = 'Nebulosa Workspace - um pacote de programas simples, bonitos e que funcionam direto no navegador. Versão ' + VERSION;
  const MANIFESTO = {
    titulo: 'Bem-vindo ao Nebulosa Workspace',
    paragrafos: [
      'O Nebulosa Workspace é uma suíte de aplicativos web gratuitos, leves e de código aberto, desenvolvidos para funcionar direto no seu navegador, em qualquer computador, sem necessidade de instalação.',
      'Organizado em três temáticas — Produtividade, Criatividade e Estilo de Vida.',
      'O ecossistema reúne ferramentas acessíveis para simplificar suas tarefas diárias, desde a edição de documentos e criação de vídeos até a organização financeira e culinária.',
      'Explore nossas temáticas e descubra como o Nebulosa Workspace pode impulsionar suas ideias.'
    ]
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICONS = window.NEBULOSA_ICONS || {};
  const LOGO = '<img src="assets/img/logo-112.png" alt="" aria-hidden="true" draggable="false">';
  const LOGO_BIG = '<img src="assets/img/logo-320.png" alt="Nebulosa Workspace" draggable="false">';
  const DOA = window.NEBULOSA_DOACAO && window.NEBULOSA_DOACAO.pix ? window.NEBULOSA_DOACAO : null;
  const NOTIF = window.NebulosaNotificacoes;
  const IFRAME_ALLOW = 'clipboard-read; clipboard-write; fullscreen; display-capture; autoplay; microphone';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // (0.6) idiomas
  const IDI = window.NebulosaIdiomas;
  const T = (...a) => IDI ? IDI.t(...a) : String(a[0]);
  const idioma = () => IDI ? IDI.atual() : 'pt-BR';
  const localNum = () => IDI ? IDI.local() : 'pt-BR';
  // páginas traduzidas: manuais/typee.en.html, legal/termos.es.html…
  const comIdioma = u => { const l = idioma(), x = l === 'en' ? '.en' : l === 'es' ? '.es' : ''; return x ? u.replace(/\.html(#|$)/, x + '.html$1') : u; };

  /* ---------- programas (vêm de js/apps.js) ---------- */
  const APPS = (window.NEBULOSA_APPS || [])
    .filter(a => a && /^[a-z0-9-]+$/.test(a.id || '') && a.name && (a.path || a.soon))
    .map(a => Object.assign({ group: 'Programas', tag: '', desc: '', keywords: '', icon: 'doc', colors: ['#A778FF', '#7f63e8'], defaultSkin: 'default', tema: '', funcao: '' }, a, {
      path: a.path ? String(a.path).replace(/\/?$/, '/') : '',
      icon: ICONS[a.icon] ? a.icon : 'doc'
    }));
  const byId = Object.fromEntries(APPS.map(a => [a.id, a]));
  const grad = a => `linear-gradient(135deg,${a.colors[0]},${a.colors[1] || a.colors[0]})`;
  const ric = a => `<span class="ric" style="background:${grad(a)}">${ICONS[a.icon]}</span>`;
  const plainRic = icon => `<span class="ric" style="background:var(--panel2);color:var(--ink)">${icon}</span>`;

  // estado de cada programa aberto
  const ST = {};
  APPS.forEach(a => { ST[a.id] = { open: false, view: null, iframe: null, ready: false, skins: null, skin: null }; });

  // preferências do Workspace (o tema é aplicado cedo por js/theme.js)
  const KEY = 'nebulosa.hub';
  let H = { theme: 'dark', recent: {} };
  try { H = Object.assign(H, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* sem armazenamento */ }
  if (!H.recent || typeof H.recent !== 'object') H.recent = {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(H)); } catch (e) { /* sem armazenamento */ } };
  document.documentElement.setAttribute('data-theme', H.theme);

  let active = null, order = [], busy = false;

  function toast(m) {
    const t = $('#toast'); t.textContent = m; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200);
  }

  /* ---------- menu lateral ---------- */
  function renderRail() {
    let h = `<button class="brandrow" id="brand" aria-label="Ir para o início">${LOGO}<span class="rl"><b>Nebulosa</b><small>Workspace</small></span></button>`;
    h += `<button class="ritem" data-go="home" aria-current="${active === null ? 'page' : 'false'}">${plainRic(ICONS.home)}<span class="rl">Início</span></button>`;
    let g = '';
    APPS.forEach((a, i) => {
      if (a.group !== g) { g = a.group; h += `<div class="grp">${esc(g)}</div>`; }
      const extra = ST[a.id].open ? '<i class="dot" title="Aberto"></i>' : (a.soon ? '<span class="soon rl">em breve</span>' : '');
      h += `<button class="ritem" data-go="${a.id}" aria-current="${active === a.id ? 'page' : 'false'}" title="${esc(a.name)}${i < 9 ? ' (Alt+' + (i + 1) + ')' : ''}">${ric(a)}<span class="rl">${esc(a.name)}</span>${extra}</button>`;
    });
    h += `<div class="rspacer"></div><div class="rfoot">` +
      (DOA ? `<button class="ritem doe" id="rDoe" title="Apoie o Nebulosa Workspace com um Pix"><span class="ric">${ICONS.heart}</span><span class="rl"><b>Doe com Pix</b></span></button>` : '') +
      `<button class="ritem" id="rAbout"><span class="ric">${ICONS.info}</span><span class="rl">Sobre o Workspace</span></button></div>`;
    $('#rail').innerHTML = h;
  }
  $('#rail').addEventListener('click', e => {
    const g = e.target.closest('[data-go]');
    if (g) { if (g.dataset.go === 'home') goHome(); else openApp(g.dataset.go, g); return; }
    if (e.target.closest('#brand')) goHome();
    if (e.target.closest('#rAbout')) openAbout();
    if (e.target.closest('#rDoe')) openDonate();
  });

  /* ---------- abas ---------- */
  function renderTabs() {
    $('#tabs').innerHTML = order.map(id => {
      const a = byId[id];
      return `<div class="tab" role="tab" tabindex="0" data-tab="${id}" aria-selected="${active === id}"><span class="tic" style="background:${grad(a)}">${ICONS[a.icon]}</span><span>${esc(a.name)}</span><button class="x" data-close="${id}" aria-label="Fechar ${esc(a.name)}" title="Fechar ${esc(a.name)}">×</button></div>`;
    }).join('');
    $('#crumbT').textContent = active ? byId[active].name : 'Início';
    $('#crumb').style.display = order.length ? 'none' : 'flex';
  }
  $('#tabs').addEventListener('click', e => {
    const x = e.target.closest('[data-close]');
    if (x) { e.stopPropagation(); closeApp(x.dataset.close); return; }
    const t = e.target.closest('[data-tab]');
    if (t) showApp(t.dataset.tab);
  });
  $('#tabs').addEventListener('auxclick', e => {
    const t = e.target.closest('[data-tab]');
    if (t && e.button === 1) { e.preventDefault(); closeApp(t.dataset.tab); }
  });
  $('#tabs').addEventListener('keydown', e => {
    const t = e.target.closest('[data-tab]');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showApp(t.dataset.tab); }
  });

  /* ---------- tela inicial ---------- */
  function ago(ts) {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'agora há pouco';
    if (m < 60) return 'há ' + m + ' min';
    const h = Math.round(m / 60);
    if (h < 24) return 'há ' + h + ' h';
    return 'há ' + Math.round(h / 24) + ' d';
  }
  // (0.4) termos de uso, privacidade e créditos (pasta legal/)
  const legalLinks = () => `<a href="${comIdioma('legal/termos.html')}" target="_blank" rel="noopener">Termos de uso</a><span aria-hidden="true">·</span><a href="${comIdioma('legal/privacidade.html')}" target="_blank" rel="noopener">Privacidade</a><span aria-hidden="true">·</span><a href="${comIdioma('legal/creditos.html')}" target="_blank" rel="noopener">Créditos e licenças</a>`;
  const manualUrl = id => comIdioma('manuais/' + (id && byId[id] ? id + '.html' : 'index.html'));
  function cardHtml(a, i) {
    const nome = a.nomeCartao || a.name;
    return `<button class="card ${a.soon ? 'off' : ''}" data-open="${a.id}" style="animation-delay:${i * 60 + 60}ms" aria-label="Abrir ${esc(nome)}${a.funcao ? ': ' + esc(a.funcao) : ''}"><div class="art" style="background:${grad(a)}">${ICONS[a.icon]}<span class="tag">${esc(a.tag)}</span></div><div class="cbody"><h3>${esc(nome)}${ST[a.id].open ? '<span class="badge">aberto</span>' : ''}${a.soon ? '<span class="badge soon">em breve</span>' : ''}</h3>${a.funcao ? `<p class="fn">${esc(a.funcao)}</p>` : ''}<p>${esc(a.desc)}</p><span class="go">${a.soon ? 'Saiba mais' : 'Abrir'} <i>→</i></span></div></button>`;
  }
  function manifestoHtml(cls) {
    return `<section class="manifesto ${cls || ''}" aria-labelledby="mfT"><h2 id="mfT">${esc(MANIFESTO.titulo)}</h2>${MANIFESTO.paragrafos.map(p => `<p>${esc(p)}</p>`).join('')}</section>`;
  }
  function renderHome() {
    const hr = new Date().getHours(), gr = hr < 5 ? 'Boa madrugada' : hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
    const rec = Object.entries(H.recent).filter(([id]) => byId[id] && !byId[id].soon).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const lastKey = Math.min(APPS.length, 9);
    // temáticas: as de NEBULOSA_TEMAS, na ordem; programas sem temática vão para "Outros programas"
    const grupos = TEMAS.map(t => ({ t, apps: APPS.filter(a => a.tema === t) })).filter(g => g.apps.length);
    const resto = APPS.filter(a => !TEMAS.includes(a.tema));
    if (resto.length) grupos.push({ t: grupos.length ? 'Outros programas' : 'Seus programas', apps: resto });
    let h = `<div class="wrap"><p class="greet">${gr}!</p><h1 class="big">O que vamos <em>criar</em> hoje?</h1>
  <button class="search" id="homeSearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><span>Buscar um programa ou uma ação…</span><kbd>Alt K</kbd></button>`;
    // (0.4) o logotipo com os ícones dos programas ocupa o lugar dos atalhos das temáticas
    h += `<div class="mfwrap">${manifestoHtml()}<div class="nlogo" role="img" aria-label="Logotipo do Nebulosa Workspace: uma nebulosa com os ícones dos ${APPS.length} programas em órbita"></div></div>`;
    if (rec.length) {
      h += `<h2 class="sec">Continue de onde parou</h2><div class="recent">${rec.map(([id, ts]) => `<button class="rchip" data-open="${id}">${ric(byId[id])}<span><b>${esc(byId[id].name)}</b><small>${ST[id].open ? 'aberto agora' : ago(ts)}</small></span></button>`).join('')}</div>`;
    }
    let n = 0;
    grupos.forEach((g, gi) => {
      h += `<h2 class="sec tsec" id="tema-${gi}">${esc(g.t)}</h2><div class="grid">${g.apps.map(a => cardHtml(a, n++)).join('')}</div>`;
    });
    h += `<div class="foot"><div class="tips"><span><kbd>Alt K</kbd>buscar</span><span><kbd>Alt 0</kbd>início</span><span><kbd>Alt 1…${lastKey}</kbd>abrir um programa</span></div>
  <p class="rodape">${esc(RODAPE)}</p>
  <div class="flinks"><a href="${manualUrl()}" target="_blank" rel="noopener">Manuais</a><span aria-hidden="true">·</span><button class="lnk" id="btnAcessos" title="Estatística de acessos do site: domínio, página inicial e cada programa">Acessos</button><span aria-hidden="true">·</span>${legalLinks()}</div></div></div>`;
    $('#home').innerHTML = h;
  }
  $('#home').addEventListener('click', e => {
    const o = e.target.closest('[data-open]');
    if (o) { openApp(o.dataset.open, o); return; }
    if (e.target.closest('#homeSearch')) openPalette();
    if (e.target.closest('#btnAcessos')) openAcessos();
    const t = e.target.closest('[data-tema]');
    if (t) { const sec = $('#tema-' + t.dataset.tema); if (sec) sec.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
  });

  /* ---------- abrir, mostrar e fechar programas ---------- */
  const stage = $('#stage'), appsEl = $('#apps'), homeEl = $('#home');
  const appUrl = (a, hash) => a.path + 'index.html' + (hash || '');

  // No GitHub Pages (ou em qualquer servidor) confere se a pasta do programa
  // existe antes de abrir, para mostrar um aviso claro em vez de uma página 404.
  // Abrindo direto do disco (file://) não há como conferir: o iframe tenta abrir.
  async function exists(url) {
    if (!/^https?:$/.test(location.protocol)) return true;
    try {
      const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      return r.ok || r.status === 405; // alguns servidores não aceitam HEAD
    } catch (e) {
      return true; // sem rede ou servidor limitado: deixa o iframe tentar
    }
  }
  function messageView(a, title, text, badge) {
    return `<div class="soonview" style="height:100%"><div class="box">${ric(a)}${badge || ''}<h2>${esc(title)}</h2>${text}<div class="ra"><button class="chip prim" data-back>Voltar ao início</button></div></div></div>`;
  }
  function buildView(a, hash) {
    const s = ST[a.id];
    const v = document.createElement('div');
    v.className = 'appview'; v.dataset.app = a.id;
    if (a.soon) {
      v.innerHTML = messageView(a, a.name + ' chega ao Workspace em breve',
        `<p>${esc(a.desc)}</p><p style="color:var(--ink3);font-size:13px">Este programa ainda não foi incluído nesta versão do pacote. Assim que for incluído, ele aparece aqui com as mesmas opções de aparência dos outros.</p>`,
        '<span class="badge soon">em breve</span>');
      s.ready = true;
      return v;
    }
    v.innerHTML = `<div class="loading"><div class="lb">${ric(a)}<b>Abrindo ${esc(a.name)}…</b><small>só um instante</small><div class="bar"></div></div></div>`;
    s.view = v;
    const url = appUrl(a, hash);
    exists(url).then(ok => {
      if (!s.open || s.view !== v) return; // fechado enquanto conferia
      if (!ok) {
        v.innerHTML = messageView(a, 'Não encontrei o ' + a.name,
          `<p>O Workspace procurou o programa em <code>${esc(a.path)}index.html</code> e não achou.</p><p style="color:var(--ink3);font-size:13px">Confira se a pasta do programa foi enviada com esse nome (maiúsculas e minúsculas contam) ou corrija o campo <code>path</code> em <code>js/apps.js</code>.</p>`);
        s.ready = true;
        return;
      }
      const f = document.createElement('iframe');
      f.title = a.name;
      f.setAttribute('allow', IFRAME_ALLOW);
      f.addEventListener('load', () => {
        s.ready = true;
        const l = $('.loading', v);
        if (l) { l.style.opacity = '0'; setTimeout(() => l.remove(), 520); }
        post(a.id, { nebulosa: 'ping' });
        post(a.id, { nebulosa: 'set-lang', idioma: idioma() });
      }, { once: true });
      s.iframe = f;
      v.insertBefore(f, v.firstChild);
      f.src = url;
    });
    return v;
  }
  appsEl.addEventListener('click', e => { if (e.target.closest('[data-back]')) goHome(); });
  const stageRect = () => stage.getBoundingClientRect();

  async function openApp(id, fromEl, hash) {
    const a = byId[id];
    if (!a || busy) return;
    const s = ST[id];
    if (!s.open) {
      s.open = true; order.push(id);
      const v = buildView(a, hash);
      s.view = s.view || v;
      if (!v.parentNode) appsEl.appendChild(v);
    }
    H.recent[id] = Date.now(); save();
    if (active === null && fromEl && !reduce) await expandFrom(fromEl, a);
    showApp(id, true);
  }
  function expandFrom(el, a) {
    return new Promise(res => {
      const r = el.getBoundingClientRect(), S0 = stageRect(), narrow = matchMedia('(max-width:820px)').matches;
      const rl = narrow ? 0 : 72, S = { left: rl, top: S0.top, width: innerWidth - rl, height: S0.height };
      busy = true;
      const ex = document.createElement('div');
      ex.className = 'expander';
      ex.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:22px;background:${grad(a)}`;
      ex.innerHTML = ICONS[a.icon];
      document.body.appendChild(ex);
      const an = ex.animate([
        { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: '22px' },
        { left: S.left + 'px', top: S.top + 'px', width: S.width + 'px', height: S.height + 'px', borderRadius: '0px' }
      ], { duration: 520, easing: 'cubic-bezier(.22,.9,.24,1)', fill: 'forwards' });
      homeEl.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.97)' }], { duration: 380, easing: 'ease-out', fill: 'forwards' });
      an.finished.then(() => { ex.id = 'expanderLive'; res(); }).catch(res);
    });
  }
  function endExpander() {
    const ex = $('#expanderLive');
    if (!ex) return;
    const o = ex.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'forwards' });
    o.finished.then(() => ex.remove()).catch(() => ex.remove());
  }
  function showApp(id, first) {
    const prev = active;
    const dir = prev && order.indexOf(id) > order.indexOf(prev) ? 1 : -1;
    active = id;
    document.body.dataset.view = 'app';
    appsEl.style.pointerEvents = 'auto';
    homeEl.classList.add('hide');
    $$('.appview', appsEl).forEach(v => {
      const on = v.dataset.app === id, was = v.classList.contains('on');
      v.classList.toggle('on', on);
      if (on && !was && !reduce && !first) v.animate([{ opacity: 0, transform: `translateX(${dir * 28}px) scale(.99)` }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.22,.9,.24,1)' });
      else if (on && first && !reduce) v.animate([{ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
    });
    if (first || !$('#expanderLive')) homeEl.style.visibility = 'hidden';
    setTimeout(() => { endExpander(); busy = false; }, first ? 120 : 0);
    renderRail(); renderTabs();
    const f = ST[id].iframe;
    if (f) { try { f.focus(); } catch (e) { /* ignora */ } }
    if ($('#skinPanel').classList.contains('show')) renderSkinPanel();
  }
  function goHome() {
    if (active === null && document.body.dataset.view === 'home') return;
    active = null;
    document.body.dataset.view = 'home';
    homeEl.style.visibility = 'visible';
    homeEl.classList.remove('hide');
    renderHome();
    if (!reduce) homeEl.animate([{ opacity: 0, transform: 'scale(1.015)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.22,.9,.24,1)', fill: 'both' });
    else homeEl.style.opacity = 1;
    $$('.appview', appsEl).forEach(v => {
      if (!v.classList.contains('on')) return;
      if (!reduce) v.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.985)' }], { duration: 300, easing: 'ease-in' });
      v.classList.remove('on');
    });
    appsEl.style.pointerEvents = 'none';
    renderRail(); renderTabs();
  }
  // Pergunta ao programa se há alterações não salvas (meio segundo de espera;
  // programas sem a ponte não respondem e fecham direto).
  function askDirty(s) {
    if (!s.iframe || !s.ready) return Promise.resolve(false);
    return new Promise(res => {
      const win = s.iframe.contentWindow;
      const finish = v => { clearTimeout(to); removeEventListener('message', onMsg); res(v); };
      const onMsg = e => { if (e.source === win && e.data && e.data.nebulosa === 'dirty') finish(!!e.data.dirty); };
      const to = setTimeout(() => finish(false), 500);
      addEventListener('message', onMsg);
      try { win.postMessage({ nebulosa: 'query-dirty' }, '*'); } catch (e) { finish(false); }
    });
  }
  async function closeApp(id) {
    const s = ST[id];
    if (!s || !s.open) return;
    if (await askDirty(s)) {
      const ok = await askConfirm('Fechar ' + byId[id].name + '?', 'Há alterações que ainda não foram salvas em arquivo. Se fechar agora, elas serão perdidas.', 'Fechar sem salvar', 'Voltar e salvar');
      if (!ok) return;
    }
    const v = s.view, idx = order.indexOf(id);
    order.splice(idx, 1);
    Object.assign(s, { open: false, ready: false, iframe: null, view: null, skins: null, skin: null });
    const done = () => { if (v) v.remove(); };
    if (active === id) {
      const next = order[idx] || order[idx - 1];
      if (v && !reduce) v.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished.then(done).catch(done);
      else done();
      if (next) showApp(next); else goHome();
    } else {
      done();
    }
    renderRail(); renderTabs();
  }

  /* ---------- conversa com os programas ---------- */
  function post(id, msg) {
    const f = ST[id] && ST[id].iframe;
    if (f && f.contentWindow) { try { f.contentWindow.postMessage(msg, '*'); } catch (e) { /* ignora */ } }
  }
  addEventListener('message', e => {
    const d = e.data;
    if (!d || typeof d !== 'object' || !d.nebulosa) return;
    // só aceita mensagens dos programas abertos aqui
    const a = APPS.find(x => ST[x.id].iframe && ST[x.id].iframe.contentWindow === e.source);
    if (!a) return;
    const s = ST[a.id];
    if (d.nebulosa === 'hello' || d.nebulosa === 'skin') {
      s.skins = Array.isArray(d.skins) ? d.skins.filter(k => k && k.id) : null;
      s.skin = d.skin;
      if ($('#skinPanel').classList.contains('show')) renderSkinPanel();
    } else if (d.nebulosa === 'key') {
      handleKeyCode(d.code);
    } else if (d.nebulosa === 'lang' && IDI) {
      IDI.definir(d.idioma); // o resto (outros programas, telas) é feito em aoMudarIdioma
      aoMudarIdioma();
    } else if (d.nebulosa === 'new-window') {
      const hash = typeof d.hash === 'string' ? d.hash.replace(/^#/, '') : 'novo';
      const w = window.open(location.href.split('#')[0] + '#app=' + encodeURIComponent(a.id) + (hash ? '&h=' + encodeURIComponent(hash) : ''), '_blank');
      if (!w) toast('O navegador bloqueou a nova janela. Permita pop-ups para este site.');
    } else if (d.nebulosa === 'notify' && NOTIF) {
      const tipo = ['info', 'sucesso', 'aviso', 'erro'].indexOf(d.kind) >= 0 ? d.kind : 'info';
      const naFrente = active === a.id && document.body.dataset.view === 'app' && !document.hidden;
      NOTIF.mostrar({
        titulo: typeof d.title === 'string' ? d.title : '', texto: typeof d.text === 'string' ? d.text : '',
        tipo, app: a.id, origem: a.name, cor: tipo === 'info' ? grad(a) : undefined,
        duracao: Math.min(Math.max(+d.ttl || 9000, 3000), 60000),
        naTela: !naFrente || !!d.always,
        aoClicar: () => openApp(a.id)
      });
    }
  });

  /* ---------- aparência ---------- */
  // Cores das miniaturas quando o programa não manda as próprias.
  const SKIN_SW = {
    default: ['#141824', '#7b8cc7', '#d6dc00'],
    nebulosa: ['#323559', '#A778FF', '#FF9C54', '#FEFF36'],
    imaginarium: ['#1e1f22', '#4d8fd6', '#313439'],
    photopea: ['#474747', '#3482f6', '#252525']
  };
  function skinDesc(id, a) {
    return id === 'nebulosa' ? 'Roxo, azul-marinho, laranja e amarelo: a cara da família Nebulosa.'
      : id === 'photopea' ? 'Idêntica ao Photopea.' : 'O visual original de ' + a.name + '.';
  }
  function renderSkinPanel() {
    const a = active ? byId[active] : null, s = a ? ST[a.id] : null;
    let h = '';
    if (a && s && s.skins && s.skins.length) {
      h += `<h3>Aparência de ${esc(a.name)}</h3><p>Vale só para este programa. Ele lembra a sua escolha na próxima vez.</p><div class="skopts">` +
        s.skins.map(k => {
          const sw = Array.isArray(k.swatch) && k.swatch.length ? k.swatch : (SKIN_SW[k.id] || SKIN_SW.default);
          return `<button class="skopt" data-skin="${esc(k.id)}" aria-pressed="${s.skin === k.id}"><span class="sw">${sw.map(c => `<i style="background:${esc(c)}"></i>`).join('')}</span><span><b>${esc(k.name || k.id)}</b><small>${esc(k.desc || skinDesc(k.id, a))}</small></span>${s.skin === k.id ? '<span class="ck">✓</span>' : ''}</button>`;
        }).join('') +
        `</div><div class="skrow"><button class="chip" data-act="progdlg">Mais opções do programa</button></div><div class="skdiv" style="margin-top:14px"></div>`;
    } else if (a && s) {
      h += `<h3>Aparência de ${esc(a.name)}</h3><p>${s.ready ? 'Este programa não oferece opções de aparência pelo Workspace.' : 'Aguarde o programa terminar de abrir.'}</p><div class="skdiv"></div>`;
    } else {
      h += `<h3>Aparência</h3><p>Abra um programa para trocar a aparência dele. Aqui você muda o Workspace e pode aplicar um visual a todos de uma vez.</p>`;
    }
    h += `<h3 style="font-size:15px">Todos os programas</h3><div class="skrow" style="margin:8px 0 12px"><button class="chip prim" data-act="allneb">Usar Nebulosa Default em todos</button><button class="chip" data-act="alldef">Voltar ao padrão de cada um</button></div>`;
    h += `<h3 style="font-size:15px">Workspace</h3><div class="skrow" style="margin-top:8px"><button class="chip" data-wth="dark" aria-pressed="${H.theme === 'dark'}">${H.theme === 'dark' ? '✓ ' : ''}Escuro</button><button class="chip" data-wth="light" aria-pressed="${H.theme === 'light'}">${H.theme === 'light' ? '✓ ' : ''}Claro</button></div>`;
    $('#skinPanel').innerHTML = h;
  }
  function setTheme(t) {
    H.theme = t === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', H.theme);
    save();
  }
  $('#skinPanel').addEventListener('click', e => {
    const sk = e.target.closest('[data-skin]');
    if (sk && active) { post(active, { nebulosa: 'set-skin', skin: sk.dataset.skin }); return; }
    const th = e.target.closest('[data-wth]');
    if (th) { setTheme(th.dataset.wth); renderSkinPanel(); return; }
    const ac = e.target.closest('[data-act]');
    if (!ac) return;
    if (ac.dataset.act === 'progdlg' && active) { closePops(); post(active, { nebulosa: 'open-skin' }); }
    else if (ac.dataset.act === 'allneb') applyAll('nebulosa');
    else if (ac.dataset.act === 'alldef') applyAll(null);
  });
  // Grava a escolha em "nebulosa.skin.<id>" (lida por cada programa ao abrir)
  // e avisa os programas que já estão abertos.
  function applyAll(which) {
    APPS.forEach(a => {
      const target = which || a.defaultSkin;
      try { localStorage.setItem('nebulosa.skin.' + a.id, target); } catch (e) { /* sem armazenamento */ }
      post(a.id, { nebulosa: 'set-skin', skin: target });
    });
    toast(which ? 'Nebulosa Default aplicada em todos os programas.' : 'Cada programa voltou ao seu visual padrão.');
    setTimeout(() => { if ($('#skinPanel').classList.contains('show')) renderSkinPanel(); }, 150);
  }

  /* ---------- painéis e janelas ---------- */
  const POPS = ['skinPanel', 'palette', 'about', 'confirm', 'donate', 'notifPanel', 'acessos', 'mailPanel', 'langPanel'];
  function openPop(el) {
    const sc = $('#scrim');
    sc.classList.add('show');
    sc.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'forwards' });
    el.classList.add('show');
    el.animate([
      { opacity: 0, transform: getComputedStyle(el).transform === 'none' ? 'translateY(-8px) scale(.98)' : el.dataset.from || 'translate(-50%,-48%) scale(.97)' },
      { opacity: 1, transform: el.dataset.to || 'none' }
    ], { duration: 260, easing: 'cubic-bezier(.22,.9,.24,1)', fill: 'forwards' });
  }
  function closePops() {
    POPS.forEach(id => {
      const el = document.getElementById(id);
      if (!el.classList.contains('show')) return;
      const an = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
      an.finished.then(() => { el.classList.remove('show'); an.cancel(); }).catch(() => el.classList.remove('show'));
    });
    const sc = $('#scrim');
    if (sc.classList.contains('show')) {
      const an = sc.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
      an.finished.then(() => { sc.classList.remove('show'); an.cancel(); }).catch(() => sc.classList.remove('show'));
    }
  }
  function closeOthers(keep) { POPS.forEach(id => { if (id !== keep) document.getElementById(id).classList.remove('show'); }); }
  $('#scrim').addEventListener('mousedown', () => { if (confirmRes) { confirmRes(false); confirmRes = null; } closePops(); });
  $('#palette').dataset.from = 'translate(-50%,-10px) scale(.98)'; $('#palette').dataset.to = 'translate(-50%,0) scale(1)';
  $('#about').dataset.from = 'translate(-50%,-48%) scale(.97)'; $('#about').dataset.to = 'translate(-50%,-50%) scale(1)';
  $('#confirm').dataset.from = 'translate(-50%,-48%) scale(.97)'; $('#confirm').dataset.to = 'translate(-50%,-50%) scale(1)';
  $('#donate').dataset.from = 'translate(-50%,-48%) scale(.97)'; $('#donate').dataset.to = 'translate(-50%,-50%) scale(1)';
  $('#acessos').dataset.from = 'translate(-50%,-48%) scale(.97)'; $('#acessos').dataset.to = 'translate(-50%,-50%) scale(1)';
  function openSkinPanel() { renderSkinPanel(); closeOthers('skinPanel'); openPop($('#skinPanel')); }
  $('#btnSkin').addEventListener('click', () => { if ($('#skinPanel').classList.contains('show')) closePops(); else openSkinPanel(); });
  $('#btnFs').addEventListener('click', () => {
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* ignora */ }
  });
  $('#btnPal').addEventListener('click', () => openPalette());

  let confirmRes = null;
  function askConfirm(title, text, okLabel, cancelLabel) {
    return new Promise(res => {
      confirmRes = res;
      const c = $('#confirm');
      c.innerHTML = `<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="ra"><button class="chip" id="cNo">${esc(cancelLabel || 'Cancelar')}</button><button class="chip prim" id="cYes">${esc(okLabel || 'OK')}</button></div>`;
      closeOthers('confirm'); openPop(c);
      $('#cNo').focus();
      $('#cNo').onclick = () => { confirmRes = null; closePops(); res(false); };
      $('#cYes').onclick = () => { confirmRes = null; closePops(); res(true); };
    });
  }
  // (0.4) contato por e-mail: botão do cabeçalho e fim da janela "Sobre"
  const CONTATO_EMAIL = 'nebulosaworkspace@gmail.com';
  const MAILTO = 'mailto:' + CONTATO_EMAIL + '?subject=' + encodeURIComponent('Contato pelo Nebulosa Workspace');
  // (0.4.1) "Fale conosco": o mailto: sozinho não faz nada quando o computador não tem um
  // programa de e-mail configurado (comum no Windows com Gmail/Outlook no navegador). Por isso o
  // envelope abre um painel com Gmail, Outlook, o programa de e-mail e "copiar endereço".
  function openMail() {
    const p = $('#mailPanel');
    const su = encodeURIComponent('Contato pelo Nebulosa Workspace');
    const to = encodeURIComponent(CONTATO_EMAIL);
    p.innerHTML = `<h3>Fale conosco</h3><p class="mtxt">Dúvidas, sugestões, ideias ou algum problema? Escreva para:</p>
<div class="maddr"><b>${CONTATO_EMAIL}</b><button class="chip" id="mCopy">${ICONS.copy}<span>Copiar</span></button></div>
<div class="mopts">
<a class="mopt" href="https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}" target="_blank" rel="noopener"><b>Gmail</b><small>abre no navegador</small></a>
<a class="mopt" href="https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${su}" target="_blank" rel="noopener"><b>Outlook / Hotmail</b><small>abre no navegador</small></a>
<a class="mopt" href="${MAILTO}"><b>Programa de e-mail</b><small>do computador ou celular</small></a>
</div>`;
    closeOthers('mailPanel'); openPop(p);
    $('#mCopy').onclick = async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(CONTATO_EMAIL); ok = true; } catch (e) {
        try { const t = document.createElement('textarea'); t.value = CONTATO_EMAIL; document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove(); } catch (e2) { /* sem cópia */ }
      }
      const b = $('#mCopy span'); if (b) b.textContent = ok ? 'Copiado!' : 'Selecione e copie';
    };
    p.querySelectorAll('a.mopt').forEach(a => a.addEventListener('click', () => setTimeout(closePops, 150)));
  }
  $('#btnMail').addEventListener('click', openMail);

  function openAbout() {
    const a = $('#about');
    a.innerHTML = `<div class="mk">${LOGO_BIG}</div>${manifestoHtml('nobox')}<div class="alist">${APPS.map(x => `<span title="${esc(x.funcao || x.tag)}">${ric(x)}${esc(x.nomeCartao || x.name)}</span>`).join('')}</div><p class="rodape">${esc(RODAPE)}</p><p class="creditos"><b>Autores e idealizadores:</b> ${esc(CREDITOS.autores)}<br><b>Equipe de produção:</b> ${esc(CREDITOS.equipe)}</p><div class="ra"><a class="chip" href="${manualUrl()}" target="_blank" rel="noopener">${ICONS.manual}<span>Manual do Workspace</span></a><a class="chip" href="assets/img/nebulosa-workspace-logo.png" download="nebulosa-workspace-logo.png">${ICONS.image}<span>Baixar logotipo</span></a><button class="chip prim" id="abOk">Fechar</button></div><p class="contato">Dúvidas, sugestões ou problemas? Escreva para a gente: <button class="lnk" id="abMail">${CONTATO_EMAIL}</button></p><p class="legal">${legalLinks()} · Código aberto sob a licença MIT</p><p class="legal"><a href="https://nebulosaworkspace.com.br/" target="_blank" rel="noopener">nebulosaworkspace.com.br</a></p>`;
    closeOthers('about'); openPop(a);
    $('#abOk').onclick = closePops;
    $('#abMail').onclick = openMail;
  }

  /* ---------- (0.4) aviso de termos e privacidade: faixa discreta no rodapé, sem popup ----------
     Aparece na primeira visita (e de novo quando TERMOS_VERSAO muda). Não bloqueia nada:
     usar o site já vale como concordância; "Entendi" só esconde a faixa. */
  const TERMOS_VERSAO = '2026-10-28', TERMOS_KEY = 'nebulosa.termos';
  function avisoTermos() {
    let visto = null;
    try { visto = localStorage.getItem(TERMOS_KEY); } catch (e) { /* sem armazenamento */ }
    if (visto === TERMOS_VERSAO) return;
    const bar = document.createElement('div');
    bar.id = 'termosBar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Termos de uso e privacidade');
    bar.innerHTML = `<p><b>Programas gratuitos, de código aberto e sem cadastro.</b> Seus arquivos ficam no seu computador. Ao usar o Nebulosa Workspace, você concorda com os <a href="${comIdioma('legal/termos.html')}" target="_blank" rel="noopener">Termos de uso</a> e a <a href="${comIdioma('legal/privacidade.html')}" target="_blank" rel="noopener">Política de privacidade</a>.</p><button class="chip prim" id="termosOk">Entendi</button>`;
    document.body.appendChild(bar);
    requestAnimationFrame(() => bar.classList.add('on'));
    $('#termosOk').onclick = () => {
      try { localStorage.setItem(TERMOS_KEY, TERMOS_VERSAO); } catch (e) { /* sem armazenamento */ }
      bar.classList.remove('on'); setTimeout(() => bar.remove(), 400);
    };
  }

  /* ---------- acessos (botão discreto no rodapé da página inicial) ---------- */
  // Contagem feita por js/acessos.js (página inicial aqui; cada programa pela ponte).
  // (0.5) Estatística do site na fonte: acessos ao domínio + separação por página.
  // Não mostra nada "deste navegador": os números são sempre os do contador do site.
  function openAcessos() {
    const el = $('#acessos');
    const linhas = [{ id: 'inicio', nome: 'Página inicial do Workspace', icone: `<span class="ric" style="background:linear-gradient(135deg,var(--p),var(--o));color:#1b1d38">${ICONS.home}</span>` }]
      .concat(APPS.filter(a => !a.soon).map(a => ({ id: a.id, nome: a.nomeCartao || a.name, icone: ric(a) })));
    const fmt = v => v == null ? '—' : Number(v).toLocaleString(localNum());
    const desenhar = (dados, carregando) => {
      const online = dados && dados._online;
      const val = id => !dados || !online ? null : dados[id];
      const soma = online ? linhas.reduce((t, l) => t + (+val(l.id) || 0), 0) : null;
      el.innerHTML = `<h3>Acessos</h3><p class="sub">${carregando ? 'Buscando os números atualizados…' : online ? 'Estatística do Nebulosa Workspace: acessos ao domínio nebulosaworkspace.com.br, somando todos os visitantes, e quantas vezes cada página foi aberta.' : 'Não foi possível consultar o contador do site agora. Tente de novo em alguns instantes.'}</p>
        <p class="acdom"><span>Acessos ao domínio</span><b>${carregando ? '<i class="ld"></i>' : fmt(val('dominio'))}</b></p>
        <ol class="aclist">${linhas.map(l => `<li>${l.icone}<span>${esc(l.nome)}</span><b>${carregando ? '<i class="ld"></i>' : fmt(val(l.id))}</b></li>`).join('')}</ol>
        ${online ? `<p class="actot">Aberturas de páginas (soma da lista): <b>${fmt(soma)}</b></p>` : ''}
        <div class="ra"><button class="chip" id="acAtual"${carregando ? ' disabled' : ''}>Atualizar</button><button class="chip prim" id="acOk">Fechar</button></div>`;
      $('#acOk').onclick = closePops;
      $('#acAtual').onclick = carregar;
    };
    function carregar() {
      desenhar(null, true);
      if (!ACESSOS) { desenhar({ _online: false }, false); return; }
      ACESSOS.ler(['dominio'].concat(linhas.map(l => l.id))).then(d => { if (el.classList.contains('show')) desenhar(d, false); });
    }
    closeOthers('acessos'); openPop(el);
    carregar();
  }

  /* ---------- doação (Doe com Pix) ---------- */
  // Dados e textos em js/doacao.js; o QR Code é desenhado por js/qrcode.js.
  const LANTERNA = '<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><circle cx="50" cy="50" r="45" fill="#1a103c"/><path d="M50 22 L66 36 L34 36 Z" fill="#fef08a"/><rect x="38" y="36" width="24" height="28" rx="2" fill="#fde047" fill-opacity=".9"/><circle cx="50" cy="50" r="6" fill="#f97316"/><rect x="48" y="64" width="4" height="20" fill="#e2e8f0"/><path d="M28 48 L38 52 M72 48 L62 52" stroke="#fef08a" stroke-width="3" stroke-linecap="round"/></svg>';
  const heartRic = () => `<span class="ric" style="background:linear-gradient(135deg,var(--o),var(--p));color:#1b1d38">${ICONS.heart}</span>`;
  let qrSvg = null;
  function openDonate() {
    if (!DOA) return;
    if (qrSvg === null) {
      try { qrSvg = window.NebulosaQR.svg(DOA.pix, { nivel: 'M', borda: 2, escuro: '#1b1d38', rotulo: 'QR Code do Pix para apoiar o Nebulosa Workspace' }); }
      catch (e) { qrSvg = ''; }
    }
    const curto = DOA.pix.length > 30 ? DOA.pix.slice(0, 22) + '…' + DOA.pix.slice(-4) : DOA.pix;
    const texto = esc(T(DOA.texto || '')).replace('Nebulosa Workspace', '<strong>Nebulosa Workspace</strong>'); // (0.6) traduzido antes de separar o negrito
    const d = $('#donate');
    d.innerHTML = `<div class="faixa"></div><div class="dcorpo">
      <div class="dtopo">
        <span class="lanterna">${LANTERNA}</span>
        <div class="dquem"><div><b>${esc(DOA.equipe || 'Nebulosa Workspace')}</b>${DOA.papel ? `<span class="papel">${esc(DOA.papel)}</span>` : ''}</div>
          <small><i></i>Projeto <strong>Nebulosa Workspace</strong></small></div>
        ${DOA.selo ? `<span class="selo"><i></i>${esc(DOA.selo)}</span>` : ''}
      </div>
      <div class="dgrade">
        <div>
          <h3>${esc(DOA.titulo || 'Apoie o projeto')} <em>✨</em></h3>
          <p class="dtexto">${texto}</p>
          ${DOA.instrucao ? `<p class="dica">${ICONS.qr}<span>${esc(DOA.instrucao)}</span></p>` : ''}
          <div class="rotulo"><span>Pix Copia e Cola</span><span>${esc(DOA.pix.slice(0, 8))}…${esc(DOA.pix.slice(-4))}</span></div>
          <div class="copiar">
            <div class="codigo" id="dCodigo" title="Código Pix Copia e Cola"><span>${esc(curto)}</span></div>
            <button class="chip prim" id="dCopiar">${ICONS.copy}<span>Copiar Pix</span></button>
          </div>
          <p class="copiado" id="dCopiado" hidden>${ICONS.check}<span>${esc(DOA.copiado || 'Chave Pix copiada!')}</span></p>
        </div>
        <div class="qr">${qrSvg ? `<span class="img">${qrSvg}</span>` : '<p style="color:#323559;margin:20px 0">Use o Pix Copia e Cola ao lado.</p>'}<small>${ICONS.pix}Pague com qualquer banco</small></div>
      </div>
      <div class="dpe"><span>${ICONS.heart}${esc(DOA.rodape || '')}</span><button class="chip" id="dFechar">Fechar</button></div>
    </div>`;
    closeOthers('donate'); openPop(d);
    $('#dCopiar').onclick = copiarPix;
    $('#dFechar').onclick = closePops;
    adiarLembrete(); // abrir a janela conta como lembrete visto
    setTimeout(() => { const b = $('#dCopiar'); if (b) b.focus(); }, 60);
  }
  async function copiarPix() {
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(DOA.pix); ok = true; } } catch (e) { ok = false; }
    if (!ok) {
      const t = document.createElement('textarea');
      t.value = DOA.pix; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;opacity:0';
      document.body.appendChild(t); t.select();
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      t.remove();
    }
    const b = $('#dCopiar');
    if (!b) return;
    if (ok) {
      b.classList.add('ok'); b.querySelector('span').textContent = 'Copiado!';
      $('#dCopiado').hidden = false;
      pausarLembretes();
      setTimeout(() => { if (b.isConnected) { b.classList.remove('ok'); b.querySelector('span').textContent = 'Copiar Pix'; } }, 3500);
    } else {
      // sem permissão para copiar: mostra o código inteiro, já selecionado
      const c = $('#dCodigo');
      c.innerHTML = `<input readonly value="${esc(DOA.pix)}" aria-label="Pix Copia e Cola" style="flex:1;min-width:0;background:none;border:0;color:inherit;font:inherit">`;
      const i = c.querySelector('input'); i.focus(); i.select();
      toast('Não consegui copiar sozinho: o código está selecionado, é só apertar Ctrl+C.');
    }
  }

  /* ---------- lembrete de doação (20 min depois de abrir, depois a cada 60 min) ---------- */
  // Tempos em js/doacao.js → lembretes (primeiroAposMinutos, intervaloMinutos).
  const LEMB = (DOA && DOA.lembretes) || {};
  const LEMB_KEY = 'nebulosa.lembrete';
  const abertoEm = Date.now();
  let lemb = { proximo: 0, pausaAte: 0, indice: 0 };
  try { Object.assign(lemb, JSON.parse(localStorage.getItem(LEMB_KEY) || '{}')); } catch (e) { /* sem armazenamento */ }
  const salvarLemb = () => { try { localStorage.setItem(LEMB_KEY, JSON.stringify(lemb)); } catch (e) { /* sem armazenamento */ } };
  const intervalo = () => {
    const v = Math.min(50, Math.max(0, +LEMB.variacaoPorcento || 0)) / 100;
    return Math.max(1, +LEMB.intervaloMinutos || 60) * 60000 * (1 - v + Math.random() * 2 * v);
  };
  function adiarLembrete() { lemb.proximo = Date.now() + intervalo(); salvarLemb(); }
  function pausarLembretes() { lemb.pausaAte = Date.now() + Math.max(0, +LEMB.pausaDepoisDeCopiarHoras || 0) * 3600000; adiarLembrete(); }
  // A cada vez que a página abre, o primeiro lembrete vem depois de "primeiroAposMinutos"
  // (a pausa de quem copiou o Pix continua valendo).
  lemb.proximo = abertoEm + Math.max(0, LEMB.primeiroAposMinutos == null ? 20 : +LEMB.primeiroAposMinutos) * 60000;
  salvarLemb();
  function conferirLembrete() {
    const msgs = LEMB.mensagens || [];
    if (!DOA || !NOTIF || LEMB.ligado === false || !msgs.length) return;
    const agora = Date.now();
    if (document.hidden || agora < lemb.proximo || agora < (lemb.pausaAte || 0)) return;
    if (POPS.some(id => document.getElementById(id).classList.contains('show'))) return; // espera fechar as janelas
    const m = msgs[(lemb.indice || 0) % msgs.length];
    lemb.indice = ((lemb.indice || 0) + 1) % msgs.length;
    adiarLembrete();
    NOTIF.mostrar({
      titulo: m.titulo, texto: m.texto, icone: heartRic(), origem: 'Nebulosa Workspace',
      cor: 'linear-gradient(180deg,var(--o),var(--p))', guardar: false,
      duracao: Math.max(5, +LEMB.duracaoSegundos || 25) * 1000,
      acoes: [{ texto: 'Doar com Pix', primaria: true, acao: openDonate }, { texto: 'Agora não' }],
      aoClicar: openDonate
    });
  }
  setInterval(conferirLembrete, 10000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(conferirLembrete, 5000); });

  /* ---------- sino (histórico de notificações) ---------- */
  if (NOTIF) {
    NOTIF.configurar({ icone: id => byId[id] ? ric(byId[id]) : `<span class="ric" style="background:linear-gradient(135deg,var(--p),var(--o));color:#1b1d38">${ICONS.bell}</span>` });
    NOTIF.aoMudar(() => { atualizarSino(); if ($('#notifPanel').classList.contains('show')) renderNotifPanel(); });
  }
  function atualizarSino() {
    const n = NOTIF ? NOTIF.naoLidas() : 0, b = $('#nbadge');
    b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n);
    $('#btnNotif').setAttribute('aria-label', n ? `Notificações (${n} nova${n > 1 ? 's' : ''})` : 'Notificações');
  }
  function renderNotifPanel() {
    const p = $('#notifPanel');
    p.innerHTML = `<div class="nhead"><h3>Notificações</h3><button class="chip" id="nLimpar">Limpar</button></div><div class="nlist" id="nlist"></div>`;
    if (NOTIF) NOTIF.renderizarLista($('#nlist'));
    $('#nLimpar').hidden = !$('#nlist .nitem');
    $('#nLimpar').onclick = () => { if (NOTIF) NOTIF.limpar(); };
  }
  function openNotifs() {
    const p = $('#notifPanel');
    if (p.classList.contains('show')) { closePops(); return; }
    if (NOTIF) NOTIF.fecharTodas(); // o que estava no canto já está na lista
    renderNotifPanel(); closeOthers('notifPanel'); openPop(p);
    setTimeout(() => { if (NOTIF && p.classList.contains('show')) NOTIF.marcarLidas(); }, 1500);
  }
  $('#btnNotif').addEventListener('click', openNotifs);
  $('#btnDoeTop').addEventListener('click', openDonate);
  if (!DOA) $('#btnDoeTop').remove();
  $('#notifPanel').addEventListener('click', e => {
    const it = e.target.closest('.nitem');
    if (it && it.dataset.app && byId[it.dataset.app]) { closePops(); openApp(it.dataset.app); }
  });
  /** Aviso do próprio Workspace no canto de notificações. */
  function notificar(op) { return NOTIF ? NOTIF.mostrar(Object.assign({ origem: 'Nebulosa Workspace' }, op)) : null; }

  /* ---------- (0.6) idioma ---------- */
  // Português do Brasil é o padrão. A escolha fica em localStorage "nebulosa.idioma" e vale
  // para o Workspace e para todos os programas (os abertos recebem "set-lang" na hora).
  const curto = () => ((IDI && IDI.lista.find(x => x.id === idioma())) || {}).curto || 'PT';
  function renderLangPanel() {
    const p = $('#langPanel'), atual = idioma();
    p.innerHTML = `<h3>Idioma</h3><p class="ltxt">Vale para o Workspace e para todos os programas.</p><div class="lopts" translate="no">` +
      (IDI ? IDI.lista : []).map(l => `<button class="lopt" data-lang="${l.id}" lang="${l.id}" aria-pressed="${l.id === atual}"><i>${l.curto}</i><b>${esc(l.nome)}</b>${l.id === atual ? '<span class="ck">✓</span>' : ''}</button>`).join('') + '</div>';
  }
  function openLang() {
    const p = $('#langPanel');
    if (p.classList.contains('show')) { closePops(); return; }
    renderLangPanel(); closeOthers('langPanel'); openPop(p);
    setTimeout(() => { const b = $('.lopt[aria-pressed="true"]', p); if (b) b.focus(); }, 40);
  }
  function trocarIdioma(id) { if (!IDI) return; IDI.definir(id); aoMudarIdioma(); }
  function aoMudarIdioma() {
    const l = idioma();
    APPS.forEach(a => post(a.id, { nebulosa: 'set-lang', idioma: l }));
    $('#langCurto').textContent = curto();
    renderRail(); renderTabs();
    if (active === null) renderHome();
    if ($('#langPanel').classList.contains('show')) renderLangPanel();
    if ($('#palette').classList.contains('show')) renderPalette();
    if ($('#about').classList.contains('show')) openAbout();
    if ($('#skinPanel').classList.contains('show')) renderSkinPanel();
  }
  $('#btnLang').addEventListener('click', openLang);
  $('#langPanel').addEventListener('click', e => {
    const b = e.target.closest('[data-lang]');
    if (b) { trocarIdioma(b.dataset.lang); setTimeout(closePops, 180); }
  });
  if (IDI) {
    $('#langCurto').textContent = curto();
    // trocado em outra aba ou dentro de um programa (evento "storage"): repassa e redesenha
    addEventListener('storage', e => { if (e.key === 'nebulosa.idioma') setTimeout(aoMudarIdioma, 0); });
  } else $('#btnLang').remove();

  /* ---------- busca rápida (Alt+K) ---------- */
  let pItems = [], pSel = 0;
  function actions() {
    const L = [];
    APPS.forEach((a, i) => L.push({ t: 'Abrir ' + a.name, s: T(a.tag) + ' · ' + T(a.desc).split('.')[0], kw: a.name + ' ' + a.tag + ' ' + a.keywords + (idioma() === 'pt-BR' ? '' : ' ' + T(a.keywords)), icon: ric(a), k: i < 9 ? 'Alt ' + (i + 1) : '', run: () => { closePops(); openApp(a.id); } }));
    L.push({ t: 'Ir para o Início', s: 'Ver todos os programas', kw: 'inicio home principal voltar', icon: plainRic(ICONS.home), k: 'Alt 0', run: () => { closePops(); goHome(); } });
    if (active) {
      const a = byId[active];
      L.push({ t: 'Aparência de ' + a.name + '…', s: 'Trocar o visual deste programa', kw: 'aparencia skin tema visual cor ' + a.name, icon: plainRic(ICONS.paint), run: () => { closePops(); setTimeout(openSkinPanel, 180); } });
      L.push({ t: 'Usar Nebulosa Default em ' + a.name, s: 'Roxo, azul-marinho, laranja e amarelo', kw: 'aparencia skin nebulosa ' + a.name, icon: `<span class="ric" style="background:var(--p)">${ICONS.paint}</span>`, run: () => { closePops(); post(active, { nebulosa: 'set-skin', skin: 'nebulosa' }); } });
      L.push({ t: 'Usar ' + a.name + ' Default', s: 'Voltar ao visual original', kw: 'aparencia skin padrao original ' + a.name, icon: plainRic(ICONS.paint), run: () => { closePops(); post(active, { nebulosa: 'set-skin', skin: a.defaultSkin }); } });
      L.push({ t: 'Fechar ' + a.name, s: 'Fecha este programa', kw: 'fechar sair ' + a.name, icon: plainRic('×'), run: () => { closePops(); closeApp(active); } });
    }
    L.push({ t: 'Usar Nebulosa Default em todos os programas', s: 'Mesmo visual em tudo', kw: 'aparencia skin nebulosa todos', icon: `<span class="ric" style="background:var(--p)">${ICONS.paint}</span>`, run: () => { closePops(); applyAll('nebulosa'); } });
    L.push({ t: 'Voltar cada programa ao visual padrão', s: 'Desfaz a aparência Nebulosa', kw: 'aparencia skin padrao original todos', icon: plainRic(ICONS.paint), run: () => { closePops(); applyAll(null); } });
    L.push({ t: H.theme === 'dark' ? 'Workspace em modo claro' : 'Workspace em modo escuro', s: 'Muda só o Workspace', kw: 'tema claro escuro modo', icon: plainRic(ICONS.moon), run: () => { closePops(); setTheme(H.theme === 'dark' ? 'light' : 'dark'); } });
    (IDI ? IDI.lista : []).forEach(l => { if (l.id !== idioma()) L.push({ t: 'Idioma: ' + l.nome, s: 'Muda o idioma do Workspace e de todos os programas', kw: 'idioma lingua language idiom ingles english espanol espanhol portugues traducao ' + l.nome, icon: plainRic(ICONS.globe), run: () => { closePops(); trocarIdioma(l.id); } }); });
    L.push({ t: 'Tela cheia', s: 'Ocupa a tela inteira', kw: 'tela cheia fullscreen', icon: plainRic('⤢'), run: () => { closePops(); $('#btnFs').click(); } });
    if (DOA) L.push({ t: 'Doe com Pix', s: 'Apoie o Nebulosa Workspace com qualquer valor', kw: 'doar doacao doe pix apoiar apoio contribuir ajudar retribuir', icon: heartRic(), run: () => { closePops(); setTimeout(openDonate, 180); } });
    L.push({ t: 'Notificações', s: 'Avisos recentes dos programas', kw: 'notificacoes avisos alertas sino historico', icon: plainRic(ICONS.bell), run: () => { closePops(); setTimeout(openNotifs, 180); } });
    L.push({ t: 'Sobre o Workspace', s: 'Apresentação, versão e créditos', kw: 'sobre ajuda creditos autor manifesto', icon: plainRic(ICONS.info), run: () => { closePops(); setTimeout(openAbout, 180); } });
    L.push({ t: 'Manual do Nebulosa Workspace', s: 'Como usar o Workspace e cada programa', kw: 'manual ajuda guia como usar tutorial', icon: plainRic(ICONS.manual), run: () => { closePops(); window.open(manualUrl(), '_blank', 'noopener'); } });
    APPS.filter(a => !a.soon).forEach(a => L.push({ t: 'Manual de ' + a.name, s: a.funcao || a.tag, kw: 'manual ajuda guia como usar ' + a.name + ' ' + a.keywords + (idioma() === 'pt-BR' ? '' : ' manual help guide ' + T(a.keywords)), icon: ric(a), run: () => { closePops(); window.open(manualUrl(a.id), '_blank', 'noopener'); } }));
    L.push({ t: 'Acessos', s: 'Estatística do site: acessos ao domínio e a cada programa', kw: 'acessos visitas contador estatisticas', icon: plainRic(ICONS.chart), run: () => { closePops(); setTimeout(openAcessos, 180); } });
    return L;
  }
  function renderPalette() {
    const q = norm($('#pq').value.trim()), all = actions();
    // (0.6) a busca vale para o texto em português e para o texto traduzido
    pItems = q ? all.filter(x => { const alvo = norm(x.t + ' ' + x.s + ' ' + x.kw + (idioma() === 'pt-BR' ? '' : ' ' + T(x.t) + ' ' + T(x.s) + ' ' + T(x.kw))); return q.split(/\s+/).every(w => alvo.includes(w)); }) : all.slice(0, 9);
    pSel = Math.min(pSel, Math.max(0, pItems.length - 1));
    $('#plist').innerHTML = pItems.length
      ? pItems.map((x, i) => `<button class="pit ${i === pSel ? 'on' : ''}" data-i="${i}">${x.icon}<span><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span>${x.k ? `<span class="k">${x.k}</span>` : ''}</button>`).join('')
      : '<div class="pempty">Nada encontrado. Tente “escrever”, “planilha”, “slides”, “partitura”, “livro”, “orçamento”, “receita”, “imagem” ou “vídeo”.</div>';
  }
  function openPalette() {
    closeOthers('palette');
    $('#pq').value = ''; pSel = 0;
    renderPalette(); openPop($('#palette'));
    setTimeout(() => $('#pq').focus(), 30);
  }
  function movePalette(step) {
    pSel = (pSel + step + pItems.length) % Math.max(1, pItems.length);
    renderPalette();
    const on = $('.pit.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  $('#pq').addEventListener('input', () => { pSel = 0; renderPalette(); });
  $('#pq').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); movePalette(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); movePalette(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (pItems[pSel]) pItems[pSel].run(); }
  });
  $('#plist').addEventListener('click', e => { const b = e.target.closest('.pit'); if (b && pItems[+b.dataset.i]) pItems[+b.dataset.i].run(); });
  $('#plist').addEventListener('mousemove', e => {
    const b = e.target.closest('.pit');
    if (b && +b.dataset.i !== pSel) { pSel = +b.dataset.i; $$('.pit').forEach((x, i) => x.classList.toggle('on', i === pSel)); }
  });

  /* ---------- atalhos ---------- */
  function handleKeyCode(code) {
    if (code === 'Digit0') goHome();
    else if (code === 'KeyK') openPalette();
    else if (/^Digit[1-9]$/.test(code)) { const a = APPS[+code.slice(5) - 1]; if (a) openApp(a.id); }
  }
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (confirmRes) { confirmRes(false); confirmRes = null; } closePops(); return; }
    if (e.altKey && !e.ctrlKey && !e.metaKey && (/^Digit[0-9]$/.test(e.code) || e.code === 'KeyK')) { e.preventDefault(); handleKeyCode(e.code); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && document.activeElement === document.body) { e.preventDefault(); openPalette(); }
  });

  /* ---------- partida ---------- */
  renderRail(); renderTabs(); renderHome(); atualizarSino();
  avisoTermos();
  if (ACESSOS) ACESSOS.registrar('inicio'); // contador de acessos: domínio + página inicial
  // Link direto para um programa: index.html#app=typee  (h=... vira o #... do programa)
  (function bootHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const id = p.get('app');
    if (!id || !byId[id]) return;
    const h = p.get('h') || (p.get('new') === '1' ? 'novo' : '');
    try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* ignora */ }
    setTimeout(() => openApp(id, null, h ? '#' + h : ''), 200);
  })();

  // acesso para depuração no console
  window.__nebulosa = {
    APPS, ST, openApp, goHome, closeApp, showApp, applyAll, trocarIdioma, openDonate, openNotifs, notificar, openAcessos, openAbout,
    lembrete: { conferir: conferirLembrete, get estado() { return lemb; } },
    get active() { return active; }, get order() { return order; }
  };
})();
