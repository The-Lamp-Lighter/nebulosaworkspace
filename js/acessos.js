/* ==========================================================================
   Nebulosa Workspace — js/acessos.js
   Contador de acessos da página inicial do Workspace e de cada programa.

   Como funciona
   -------------
   O site é estático (GitHub Pages), então não tem um servidor próprio para
   guardar números. A contagem usa um serviço gratuito de contadores na
   internet (Abacus, https://abacus.jasoncameron.dev), que só guarda um
   número por página — nenhum dado de quem visita.

   - Página inicial do Workspace: conta quando o index.html da raiz abre.
   - Cada programa: conta quando o apps/<id>/index.html abre (dentro do
     Workspace ou sozinho). Quem carrega este arquivo nos programas é a ponte
     (shared/nebulosa-bridge.js), então não é preciso mexer nos programas.
   - Cada página conta no máximo uma vez por sessão do navegador (recarregar
     a página não soma de novo).
   - Abrindo do próprio computador (file:// ou localhost) não conta nada,
     para os testes não somarem.
   - Se o serviço estiver fora do ar, a lista mostra os acessos feitos neste
     navegador (contagem local) e avisa.

   Para trocar de serviço ou "zerar" tudo, mude o "espaco" abaixo (um nome
   novo começa do zero). Nomes: letras, números, ponto, hífen e sublinhado.
   ========================================================================== */
(function () {
  'use strict';
  if (window.NebulosaAcessos) return;

  var CFG = window.NEBULOSA_ACESSOS_CFG = window.NEBULOSA_ACESSOS_CFG || {
    ligado: true,
    servico: 'https://abacus.jasoncameron.dev', // endereços /hit/<espaco>/<pagina> e /get/<espaco>/<pagina>
    espaco: 'nebulosa-workspace-mwba',            // "pasta" dos contadores deste site
    contarNoComputador: false                     // true = conta também em file:// e localhost
  };

  var LOCAL_KEY = 'nebulosa.acessos.local';
  var noSite = /^https?:$/.test(location.protocol) &&
    !/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname);

  function chave(p) { return String(p || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '-').slice(0, 60) || 'pagina'; }
  function url(acao, p) { return CFG.servico.replace(/\/+$/, '') + '/' + acao + '/' + encodeURIComponent(CFG.espaco) + '/' + encodeURIComponent(chave(p)); }
  function lerLocal() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function somarLocal(p) {
    var o = lerLocal(); o[chave(p)] = (+o[chave(p)] || 0) + 1;
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(o)); } catch (e) { /* sem armazenamento */ }
  }
  function pedir(u, ms) {
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 6000);
    return fetch(u, { cache: 'no-store', mode: 'cors', credentials: 'omit', signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        clearTimeout(to);
        if (r.status === 404) return { value: 0 };           // contador ainda não existe = 0 acessos
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) { var v = j && (j.value != null ? j.value : j.count); return typeof v === 'number' ? v : +v || 0; })
      .catch(function (e) { clearTimeout(to); throw e; });
  }

  var api = window.NebulosaAcessos = {
    /** Registra um acesso à página (uma vez por sessão do navegador). */
    registrar: function (pagina) {
      var p = chave(pagina), sk = 'nebulosa.acesso.' + p;
      try { if (sessionStorage.getItem(sk)) return Promise.resolve(null); sessionStorage.setItem(sk, '1'); } catch (e) { /* sem armazenamento */ }
      somarLocal(p);
      if (!CFG.ligado || (!noSite && !CFG.contarNoComputador) || !window.fetch) return Promise.resolve(null);
      return pedir(url('hit', p)).catch(function () { return null; });
    },
    /** Lê os números de várias páginas: { pagina: número | null }, mais { _online: bool }. */
    ler: function (paginas) {
      var loc = lerLocal(), out = { _online: false, _local: {} };
      paginas.forEach(function (p) { out._local[chave(p)] = +loc[chave(p)] || 0; });
      if (!CFG.ligado || !window.fetch || !/^https?:$/.test(location.protocol)) {
        paginas.forEach(function (p) { out[chave(p)] = null; });
        return Promise.resolve(out);
      }
      // todos ao mesmo tempo (são poucos; o serviço aceita 30 pedidos a cada 10 s)
      return Promise.all(paginas.map(function (p) {
        p = chave(p);
        return pedir(url('get', p), 6000).then(function (v) { out[p] = v; return true; }, function () { out[p] = null; return false; });
      })).then(function (oks) { out._online = oks.some(Boolean); return out; });
    },
    chave: chave,
    get noSite() { return noSite; },
    config: CFG
  };

  // Carregado pela ponte dentro de um programa: registra o acesso a ele.
  if (window.NEBULOSA_ACESSO_PAGINA) api.registrar(window.NEBULOSA_ACESSO_PAGINA);
})();
