/* ==========================================================================
   Nebulosa Workspace — shared/nebulosa-bridge.js  (ponte dos programas)
   --------------------------------------------------------------------------
   Liga um programa ao Nebulosa Workspace. É o mesmo arquivo para todos os
   programas: uma correção aqui vale para todos de uma vez.

   O programa continua funcionando sozinho (aberto direto, fora do Workspace)
   e também sem este arquivo: nesse caso ele só perde as opções de aparência
   e o aviso de alterações não salvas dentro do Workspace.

   COMO USAR — no <head> do programa, antes dos estilos dele:

     <script src="../../shared/nebulosa-bridge.js"
             data-app="typee" data-name="Typee" data-modes
             data-preview="#141824 #232a3f #7b8cc7 #d6dc00"></script>
     ...estilos do programa...
     <link rel="stylesheet" href="nebulosa-skin.css">

   Atributos:
     data-app       identificador do programa, igual ao "id" em js/apps.js (obrigatório)
     data-name      nome exibido (padrão: o data-app)
     data-skins     aparências oferecidas, separadas por espaço (padrão: "default nebulosa")
     data-modes     o programa aceita modo claro/escuro por <html data-theme="light|dark">
     data-preview   4 cores da miniatura do visual original: fundo, barra, destaque, destaque 2
     data-preview-<aparência>  o mesmo, para outra aparência (ex.: data-preview-nebulosa)
     data-provider  o programa tem um sistema de aparência próprio e se registra com
                    NebulosaSkin.provide({...}) (ex.: Imaginarium). A ponte então não mexe
                    no atributo data-skin.

   O que a ponte faz:
     - põe <html data-skin="..."> logo no início (sem "piscar" no visual errado);
       o CSS do programa usa :root[data-skin="nebulosa"] para o visual Nebulosa;
     - lembra a escolha em localStorage "nebulosa.skin.<app>" (o Workspace também
       grava essa chave em "Usar Nebulosa Default em todos");
     - conversa com o Workspace por postMessage (ver js/workspace.js);
     - repassa ao Workspace os atalhos Alt+0…9 e Alt+K apertados dentro do programa;
     - oferece uma janela "Aparência" pronta (NebulosaSkin.openDialog()).

   API para o programa (window.NebulosaSkin):
     list                 aparências [{id, name, desc, swatch}]
     get() / set(id)      aparência atual / trocar
     on(fn)               avisa fn(id) quando a aparência muda
     getMode() / setMode('auto'|'light'|'dark')   só com data-modes
     openDialog()         abre a janela de aparência (o programa pode substituir)
     inWorkspace          true quando o programa está aberto dentro do Workspace
     openNewWindow(hash)  pede ao Workspace outra janela com este programa;
                          devolve false fora do Workspace (o programa abre por conta própria)
     provide(impl)        para programas com aparência própria: {list(), get(), set(id), openDialog?, isDirty?}
     notify()             avisa o Workspace que a aparência mudou (usado com provide)
   Alterações não salvas: o programa define window.__nebulosaDirty = function () { return true|false; }
   ========================================================================== */
(function () {
  'use strict';
  if (window.NebulosaSkin) return; // carregada duas vezes: mantém a primeira

  var me = document.currentScript;
  function attr(n, d) { var v = me && me.getAttribute('data-' + n); return v === null || v === undefined || v === '' ? d : v; }
  function has(n) { return !!(me && me.hasAttribute('data-' + n)); }

  var folder = (location.pathname.split('/').slice(-2, -1)[0] || 'app').toLowerCase();
  var APP = attr('app', folder);
  var NAME = attr('name', APP);
  var MODES = has('modes');
  var PROVIDER = has('provider');
  var PREVIEW = attr('preview', '#141824 #232a3f #7b8cc7 #d6dc00').split(/\s+/);
  var KEY = 'nebulosa.skin.' + APP, MODE_KEY = 'nebulosa.mode.' + APP;
  var root = document.documentElement;
  var inFrame = false;
  try { inFrame = window.parent && window.parent !== window; } catch (e) { inFrame = true; }

  var KNOWN = {
    'default': { name: NAME + ' Default', desc: 'O visual original de ' + NAME + '.', preview: PREVIEW },
    nebulosa: { name: 'Nebulosa Default', desc: 'Roxo, azul-marinho, laranja e amarelo: a cara da família Nebulosa.', preview: ['#323559', '#3e4274', '#A778FF', '#FF9C54', '#FEFF36'] }
  };
  // miniatura do Workspace: fundo + cores de destaque (sem a cor da barra)
  function swatchOf(p) { return [p[0]].concat(p.slice(2)); }
  var LIST = attr('skins', 'default nebulosa').split(/\s+/).map(function (id) {
    var k = KNOWN[id] || { name: id, desc: '', preview: PREVIEW };
    var own = attr('preview-' + id, ''); // ex.: data-preview-nebulosa="..." quando o visual Nebulosa do programa é claro
    var p = own ? own.split(/\s+/) : k.preview;
    return { id: id, name: k.name, desc: k.desc, swatch: swatchOf(p), preview: p };
  });

  function storeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storeSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } }
  function valid(id) { return LIST.some(function (x) { return x.id === id; }); }

  // aparência e modo aplicados antes de a página ser desenhada
  var cur = storeGet(KEY);
  if (!valid(cur)) cur = LIST[0].id;
  if (!PROVIDER) root.setAttribute('data-skin', cur);
  if (MODES) { var m0 = storeGet(MODE_KEY); if (m0 === 'light' || m0 === 'dark') root.setAttribute('data-theme', m0); }

  var provider = null, subs = [];

  function publicList() {
    var l = provider ? (provider.list() || []) : LIST;
    return l.map(function (x) { return { id: x.id, name: x.name, desc: x.desc || '', swatch: x.swatch || null }; });
  }
  function current() { return provider ? provider.get() : cur; }
  function post(type, extra) {
    if (!inFrame) return;
    if (PROVIDER && !provider) return; // ainda esperando o programa chamar provide()
    try {
      var o = { nebulosa: type, app: APP, skins: publicList(), skin: current() };
      if (extra) for (var k in extra) o[k] = extra[k];
      window.parent.postMessage(o, '*');
    } catch (e) { /* ignora */ }
  }
  function isDirty() {
    try {
      if (provider && provider.isDirty) return !!provider.isDirty();
      return !!(window.__nebulosaDirty && window.__nebulosaDirty());
    } catch (e) { return false; }
  }

  var api = window.NebulosaSkin = {
    app: APP,
    name: NAME,
    inWorkspace: inFrame,
    get list() { return publicList(); },
    get: current,
    set: function (id) {
      if (provider) { provider.set(id); post('skin'); return; }
      if (PROVIDER || !valid(id)) return;
      cur = id;
      root.setAttribute('data-skin', id);
      storeSet(KEY, id);
      subs.forEach(function (f) { try { f(id); } catch (e) { /* ignora */ } });
      post('skin');
    },
    on: function (f) { if (typeof f === 'function') subs.push(f); },
    getMode: function () { return MODES ? (root.getAttribute('data-theme') || 'auto') : null; },
    setMode: function (m) {
      if (!MODES) return;
      if (m === 'light' || m === 'dark') { root.setAttribute('data-theme', m); storeSet(MODE_KEY, m); }
      else { root.removeAttribute('data-theme'); storeSet(MODE_KEY, null); }
    },
    openDialog: function () { if (provider && provider.openDialog) provider.openDialog(); else openDialog(); },
    openNewWindow: function (hash) {
      if (!inFrame) return false;
      try { window.parent.postMessage({ nebulosa: 'new-window', app: APP, hash: hash || '' }, '*'); return true; } catch (e) { return false; }
    },
    provide: function (impl) { provider = impl || null; post('hello'); },
    notify: function () { post('skin'); }
  };

  /* ---------- conversa com o Workspace ---------- */
  window.addEventListener('message', function (e) {
    if (!inFrame || e.source !== window.parent) return;
    var d = e.data;
    if (!d || typeof d !== 'object' || !d.nebulosa) return;
    if (d.nebulosa === 'set-skin') api.set(d.skin);
    else if (d.nebulosa === 'ping') post('hello');
    else if (d.nebulosa === 'open-skin') api.openDialog();
    else if (d.nebulosa === 'query-dirty') post('dirty', { dirty: isDirty() });
  });
  // Alt+0…9 e Alt+K são atalhos do Workspace
  window.addEventListener('keydown', function (e) {
    if (!inFrame || !e.altKey || e.ctrlKey || e.metaKey) return;
    if (!/^Digit[0-9]$/.test(e.code) && e.code !== 'KeyK') return;
    try { e.preventDefault(); e.stopPropagation(); window.parent.postMessage({ nebulosa: 'key', code: e.code }, '*'); } catch (_) { /* ignora */ }
  }, true);
  post('hello');
  document.addEventListener('DOMContentLoaded', function () { post('hello'); });

  /* ---------- janela "Aparência" pronta ---------- */
  // Sempre com as cores da família Nebulosa (a mesma cara do painel do Workspace),
  // para ficar legível em qualquer programa, claro ou escuro.
  var CSS =
    '#nbSkinOv{position:fixed;inset:0;z-index:2147483000;background:rgba(10,11,28,.62);display:grid;place-items:center;padding:20px;box-sizing:border-box;' +
    'font:14px/1.45 Figtree,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#f3f1ff;-webkit-font-smoothing:antialiased}' +
    '#nbSkinOv *{box-sizing:border-box}' +
    '#nbSkinOv .nbBox{background:#2d3053;color:#f3f1ff;border:1px solid rgba(190,185,255,.18);border-radius:18px;padding:22px;width:min(560px,100%);max-height:calc(100vh - 40px);overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:14px}' +
    '#nbSkinOv h3{margin:0;font-size:20px;font-weight:700}#nbSkinOv p{margin:0;font-size:13.5px;color:#b9bce0;line-height:1.45}' +
    '#nbSkinOv .nbCards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}' +
    '#nbSkinOv .nbCard{border:2px solid rgba(190,185,255,.22);border-radius:14px;background:#262948;color:inherit;padding:10px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:8px;font:inherit}' +
    '#nbSkinOv .nbCard:hover{border-color:#A778FF}#nbSkinOv .nbCard.on{border-color:#A778FF;box-shadow:0 0 0 2px #A778FF}' +
    '#nbSkinOv .nbCard:focus-visible,#nbSkinOv button:focus-visible{outline:2px solid #FEFF36;outline-offset:2px}' +
    '#nbSkinOv .nbPrev{height:74px;border-radius:9px;position:relative;overflow:hidden;border:1px solid rgba(190,185,255,.25)}' +
    '#nbSkinOv .nbPrev i{position:absolute;display:block}#nbSkinOv .nbCard b{font-size:14px}#nbSkinOv .nbCard span{font-size:12px;color:#b9bce0}' +
    '#nbSkinOv .nbMode{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px}#nbSkinOv .nbMode span{color:#b9bce0;margin-right:4px}' +
    '#nbSkinOv .nbSeg{display:inline-flex;border:1px solid rgba(190,185,255,.25);border-radius:10px;overflow:hidden}' +
    '#nbSkinOv .nbSeg button{background:transparent;color:inherit;border:0;padding:7px 12px;cursor:pointer;font:inherit}#nbSkinOv .nbSeg button.on{background:#A778FF;color:#1b1d38;font-weight:700}' +
    '#nbSkinOv .nbFoot{display:flex;align-items:center;gap:10px;justify-content:flex-end}' +
    '#nbSkinOv .nbOk{background:#A778FF;color:#1b1d38;border:0;border-radius:10px;padding:8px 16px;font:inherit;font-weight:700;cursor:pointer}';

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function preview(p) {
    return '<div class="nbPrev" style="background:' + p[0] + '">' +
      '<i style="left:0;top:0;right:0;height:12px;background:' + p[1] + '"></i>' +
      '<i style="left:0;top:12px;width:26px;bottom:0;background:' + p[1] + '"></i>' +
      '<i style="left:34px;top:22px;width:78px;height:9px;border-radius:5px;background:' + p[2] + '"></i>' +
      '<i style="left:34px;top:38px;width:120px;height:6px;border-radius:4px;background:' + p[1] + '"></i>' +
      '<i style="left:34px;top:50px;width:60px;height:6px;border-radius:4px;background:' + p[1] + '"></i>' +
      (p[3] ? '<i style="right:10px;bottom:10px;width:16px;height:16px;border-radius:50%;background:' + p[3] + '"></i>' : '') +
      (p[4] ? '<i style="right:32px;bottom:10px;width:10px;height:10px;border-radius:50%;background:' + p[4] + '"></i>' : '') +
      '</div>';
  }
  function closeDialog() {
    var o = document.getElementById('nbSkinOv');
    if (o) o.remove();
    document.removeEventListener('keydown', onKey, true);
  }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closeDialog(); } }
  function openDialog() {
    closeDialog();
    if (!document.getElementById('nbSkinStyle')) {
      var st = document.createElement('style'); st.id = 'nbSkinStyle'; st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
    }
    var now = current();
    var cards = LIST.map(function (c) {
      return '<button type="button" class="nbCard' + (now === c.id ? ' on' : '') + '" data-id="' + esc(c.id) + '">' + preview(c.preview) +
        '<b>' + esc(c.name) + '</b><span>' + esc(c.desc) + '</span></button>';
    }).join('');
    var m = api.getMode();
    var modeHtml = m ? '<div class="nbMode"><span>Modo</span><div class="nbSeg">' +
      [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(function (x) {
        return '<button type="button" data-m="' + x[0] + '" class="' + (m === x[0] ? 'on' : '') + '">' + x[1] + '</button>';
      }).join('') + '</div></div>' : '';
    var o = document.createElement('div');
    o.id = 'nbSkinOv';
    o.innerHTML = '<div class="nbBox" role="dialog" aria-modal="true" aria-label="Aparência"><h3>Aparência</h3>' +
      '<p>Escolha o visual de ' + esc(NAME) + '. A mudança vale só para este programa.</p>' +
      '<div class="nbCards">' + cards + '</div>' + modeHtml +
      '<div class="nbFoot"><button type="button" class="nbOk">Fechar</button></div></div>';
    o.addEventListener('mousedown', function (e) { if (e.target === o) closeDialog(); });
    o.addEventListener('click', function (e) {
      var c = e.target.closest('.nbCard'), b = e.target.closest('[data-m]');
      if (c) { api.set(c.getAttribute('data-id')); [].forEach.call(o.querySelectorAll('.nbCard'), function (x) { x.classList.toggle('on', x === c); }); }
      if (b) { api.setMode(b.getAttribute('data-m')); [].forEach.call(o.querySelectorAll('[data-m]'), function (x) { x.classList.toggle('on', x === b); }); }
      if (e.target.closest('.nbOk')) closeDialog();
    });
    document.body.appendChild(o);
    document.addEventListener('keydown', onKey, true);
    var f = o.querySelector('.nbCard.on') || o.querySelector('.nbCard');
    if (f) f.focus();
  }
})();
