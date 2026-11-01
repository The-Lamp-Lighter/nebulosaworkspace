/* ==========================================================================
   Utilidades — js/iniciar.js
   Monta o menu lateral, os cartões da página inicial e o menu Ajuda,
   e abre a ferramenta pedida (#qr, #pdf/juntar…) ou a última usada.
   ========================================================================== */
(function () {
  'use strict';
  const { $, $$, esc, T, LISTA, FERR, N } = UT;
  const ICONS = window.NEBULOSA_ICONS || {};
  const ferr = LISTA.filter(f => FERR[f.id]);

  $('#mkIcon').innerHTML = ICONS.tools || '';
  $('#lado').innerHTML = `<button data-ir=""><span class="ic">${ICONS.home || ''}</span><span>Todas as ferramentas</span></button><div class="tit">Ferramentas</div>` +
    ferr.map(f => `<button data-ir="${esc(f.id)}"><span class="ic">${ICONS[f.icon] || ''}</span><span>${esc(f.nome)}</span></button>`).join('');
  $('#cartoes').innerHTML = ferr.map(f => `<button class="cartao" data-ir="${esc(f.id)}"><span class="ic">${ICONS[f.icon] || ''}</span><span><b>${esc(f.nome)}</b><small>${esc(f.desc)}</small></span></button>`).join('');
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ir]');
    if (b && !e.defaultPrevented) { e.preventDefault(); fecharMenu(); UT.ir(b.dataset.ir); }
  });

  /* ---------- modo claro / escuro ---------- */
  const raiz = document.documentElement;
  const escuroAgora = () => { const t = raiz.getAttribute('data-theme'); if (t) return t === 'dark'; return raiz.getAttribute('data-skin') === 'nebulosa' || matchMedia('(prefers-color-scheme: dark)').matches; };
  function iconeModo() { const b = $('#btnModo'); b.innerHTML = escuroAgora() ? UT.ICO.sol : UT.ICO.lua; }
  $('#btnModo').addEventListener('click', () => {
    const novo = escuroAgora() ? 'light' : 'dark';
    if (N && N.setMode) N.setMode(novo); else raiz.setAttribute('data-theme', novo);
    iconeModo();
    document.dispatchEvent(new CustomEvent('ut-tema'));
  });
  if (N && N.on) N.on(() => { iconeModo(); document.dispatchEvent(new CustomEvent('ut-tema')); });
  new MutationObserver(() => { iconeModo(); document.dispatchEvent(new CustomEvent('ut-tema')); }).observe(raiz, { attributes: true, attributeFilter: ['data-theme', 'data-skin'] });
  iconeModo();

  /* ---------- menu Ajuda ---------- */
  $$('[data-ico]').forEach(el => { el.innerHTML = ICONS[el.dataset.ico] || ''; });
  const pop = $('#popAjuda'), bA = $('#btnAjuda');
  function fecharMenu() { pop.hidden = true; bA.setAttribute('aria-expanded', 'false'); }
  bA.addEventListener('click', e => { e.stopPropagation(); pop.hidden = !pop.hidden; bA.setAttribute('aria-expanded', String(!pop.hidden)); if (!pop.hidden) { const f = pop.querySelector('button'); if (f) f.focus(); } });
  document.addEventListener('mousedown', e => { if (!pop.hidden && !e.target.closest('#menuAjuda')) fecharMenu(); });
  pop.addEventListener('click', e => {
    const b = e.target.closest('[data-ajuda]'); if (!b) return;
    fecharMenu();
    const k = b.dataset.ajuda;
    if (k === 'atalhos') { abrirModal($('#modalAtalhos')); return; }
    if (k === 'aparencia') { if (N) N.openDialog(); return; }
    if (k === 'idioma') { if (N && N.abrirIdioma) N.abrirIdioma(); return; }
    if (k === 'relatar') { if (N && N.relatar) N.relatar(); return; }
    if (N && N.abrirAjuda) N.abrirAjuda(k);
    else window.open('https://nebulosaworkspace.com.br/' + (k === 'manual' ? 'manuais/utilidades.html' : 'legal/' + k + '.html'), '_blank', 'noopener');
  });
  function abrirModal(m) {
    m.hidden = false;
    const f = m.querySelector('[data-fechar]'); if (f) f.focus();
  }
  document.addEventListener('click', e => { const f = e.target.closest('[data-fechar]'); if (f) { const m = f.closest('.modal'); if (m) m.hidden = true; } });
  document.addEventListener('mousedown', e => { if (e.target.classList && e.target.classList.contains('modal') && e.target.id === 'modalAtalhos') e.target.hidden = true; });

  /* ---------- teclado ---------- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!pop.hidden) { fecharMenu(); bA.focus(); return; }
      const m = $$('.modal').find(x => !x.hidden && x.id === 'modalAtalhos'); if (m) { m.hidden = true; return; }
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowLeft' && UT.atual) { e.preventDefault(); UT.ir(''); }
  });

  /* ---------- primeira tela ---------- */
  let r = location.hash.replace(/^#/, '');
  if (!r) { try { r = sessionStorage.getItem('nebulosa.utilidades.rota') || ''; } catch (e) { r = ''; } }
  UT.mostrar(r);
  if (r && !location.hash) { try { history.replaceState(null, '', '#' + r); } catch (e) { /* ignora */ } }
})();
