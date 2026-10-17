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
     programa → Workspace
       hello / skin   { app, skins:[{id,name,desc,swatch}], skin }
       dirty          { dirty: true|false }  resposta ao query-dirty
       key            { code }  atalho Alt+0…9 / Alt+K apertado dentro do programa
       new-window     { app, hash }  abrir o programa numa nova janela

   Um programa que não fala esse "idioma" (sem shared/nebulosa-bridge.js)
   abre e funciona normalmente; ele só não oferece aparências pelo Workspace
   nem avisa sobre alterações não salvas ao fechar a aba.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- utilidades ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const VERSION = '0.2 (prévia)';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICONS = window.NEBULOSA_ICONS || {};
  const LOGO = '<img src="assets/img/logo-112.png" alt="" aria-hidden="true" draggable="false">';
  const LOGO_BIG = '<img src="assets/img/logo-320.png" alt="Nebulosa Workspace" draggable="false">';
  const IFRAME_ALLOW = 'clipboard-read; clipboard-write; fullscreen; display-capture; autoplay; microphone';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* ---------- programas (vêm de js/apps.js) ---------- */
  const APPS = (window.NEBULOSA_APPS || [])
    .filter(a => a && /^[a-z0-9-]+$/.test(a.id || '') && a.name && (a.path || a.soon))
    .map(a => Object.assign({ group: 'Programas', tag: '', desc: '', keywords: '', icon: 'doc', colors: ['#A778FF', '#7f63e8'], defaultSkin: 'default' }, a, {
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
    h += `<div class="rspacer"></div><div class="rfoot"><button class="ritem" id="rAbout"><span class="ric">${ICONS.info}</span><span class="rl">Sobre o Workspace</span></button></div>`;
    $('#rail').innerHTML = h;
  }
  $('#rail').addEventListener('click', e => {
    const g = e.target.closest('[data-go]');
    if (g) { if (g.dataset.go === 'home') goHome(); else openApp(g.dataset.go, g); return; }
    if (e.target.closest('#brand')) goHome();
    if (e.target.closest('#rAbout')) openAbout();
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
  function renderHome() {
    const hr = new Date().getHours(), gr = hr < 5 ? 'Boa madrugada' : hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
    const rec = Object.entries(H.recent).filter(([id]) => byId[id] && !byId[id].soon).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const lastKey = Math.min(APPS.length, 9);
    let h = `<div class="wrap"><p class="greet">${gr}!</p><h1 class="big">O que vamos <em>criar</em> hoje?</h1>
  <button class="search" id="homeSearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><span>Buscar um programa ou uma ação…</span><kbd>Alt K</kbd></button>`;
    if (rec.length) {
      h += `<h2 class="sec">Continue de onde parou</h2><div class="recent">${rec.map(([id, ts]) => `<button class="rchip" data-open="${id}">${ric(byId[id])}<span><b>${esc(byId[id].name)}</b><small>${ST[id].open ? 'aberto agora' : ago(ts)}</small></span></button>`).join('')}</div>`;
    }
    h += `<h2 class="sec">Seus programas</h2><div class="grid">${APPS.map((a, i) => `<button class="card ${a.soon ? 'off' : ''}" data-open="${a.id}" style="animation-delay:${i * 70 + 60}ms" aria-label="Abrir ${esc(a.name)}"><div class="art" style="background:${grad(a)}">${ICONS[a.icon]}<span class="tag">${esc(a.tag)}</span></div><div class="cbody"><h3>${esc(a.name)}${ST[a.id].open ? '<span class="badge">aberto</span>' : ''}${a.soon ? '<span class="badge soon">em breve</span>' : ''}</h3><p>${esc(a.desc)}</p><span class="go">${a.soon ? 'Saiba mais' : 'Abrir'} <i>→</i></span></div></button>`).join('')}</div>
  <div class="foot"><div class="tips"><span><kbd>Alt K</kbd>buscar</span><span><kbd>Alt 0</kbd>início</span><span><kbd>Alt 1…${lastKey}</kbd>abrir um programa</span></div><span>Nebulosa Workspace ${esc(VERSION)}</span></div></div>`;
    $('#home').innerHTML = h;
  }
  $('#home').addEventListener('click', e => {
    const o = e.target.closest('[data-open]');
    if (o) { openApp(o.dataset.open, o); return; }
    if (e.target.closest('#homeSearch')) openPalette();
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
    } else if (d.nebulosa === 'new-window') {
      const hash = typeof d.hash === 'string' ? d.hash.replace(/^#/, '') : 'novo';
      const w = window.open(location.href.split('#')[0] + '#app=' + encodeURIComponent(a.id) + (hash ? '&h=' + encodeURIComponent(hash) : ''), '_blank');
      if (!w) toast('O navegador bloqueou a nova janela. Permita pop-ups para este site.');
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
  const POPS = ['skinPanel', 'palette', 'about', 'confirm'];
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
  function openAbout() {
    const a = $('#about');
    a.innerHTML = `<div class="mk">${LOGO_BIG}</div><h3>Nebulosa Workspace</h3><p>Um pacote de programas simples, bonitos e que funcionam direto no navegador. Versão ${esc(VERSION)}.</p><div class="alist">${APPS.map(x => `<span>${ric(x)}${esc(x.name)}</span>`).join('')}</div><div class="ra"><button class="chip prim" id="abOk">Fechar</button></div>`;
    closeOthers('about'); openPop(a);
    $('#abOk').onclick = closePops;
  }

  /* ---------- busca rápida (Alt+K) ---------- */
  let pItems = [], pSel = 0;
  function actions() {
    const L = [];
    APPS.forEach((a, i) => L.push({ t: 'Abrir ' + a.name, s: a.tag + ' · ' + a.desc.split('.')[0], kw: a.name + ' ' + a.tag + ' ' + a.keywords, icon: ric(a), k: i < 9 ? 'Alt ' + (i + 1) : '', run: () => { closePops(); openApp(a.id); } }));
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
    L.push({ t: 'Tela cheia', s: 'Ocupa a tela inteira', kw: 'tela cheia fullscreen', icon: plainRic('⤢'), run: () => { closePops(); $('#btnFs').click(); } });
    L.push({ t: 'Sobre o Workspace', s: 'Versão e créditos', kw: 'sobre ajuda creditos autor', icon: plainRic(ICONS.info), run: () => { closePops(); setTimeout(openAbout, 180); } });
    return L;
  }
  function renderPalette() {
    const q = norm($('#pq').value.trim()), all = actions();
    pItems = q ? all.filter(x => q.split(/\s+/).every(w => norm(x.t + ' ' + x.s + ' ' + x.kw).includes(w))) : all.slice(0, 9);
    pSel = Math.min(pSel, Math.max(0, pItems.length - 1));
    $('#plist').innerHTML = pItems.length
      ? pItems.map((x, i) => `<button class="pit ${i === pSel ? 'on' : ''}" data-i="${i}">${x.icon}<span><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span>${x.k ? `<span class="k">${x.k}</span>` : ''}</button>`).join('')
      : '<div class="pempty">Nada encontrado. Tente “escrever”, “slides”, “partitura”, “livro”, “orçamento”, “receita”, “imagem” ou “vídeo”.</div>';
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
  renderRail(); renderTabs(); renderHome();
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
  window.__nebulosa = { APPS, ST, openApp, goHome, closeApp, showApp, applyAll, get active() { return active; }, get order() { return order; } };
})();
