/* ==========================================================================
   Nebulosa Workspace — js/theme.js
   Aplica o tema claro/escuro do Workspace antes de a página ser desenhada,
   para não "piscar" no tema errado. A escolha fica em localStorage
   ("nebulosa.hub") e é mudada pelo painel Aparência (js/workspace.js).
   ========================================================================== */
(function () {
  var theme = 'dark';
  try { theme = (JSON.parse(localStorage.getItem('nebulosa.hub') || '{}') || {}).theme || 'dark'; } catch (e) { /* sem armazenamento */ }
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
})();
