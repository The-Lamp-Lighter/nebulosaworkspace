/* ==========================================================================
   Nebulosa Workspace — js/acessos.js
   Contador de acessos do site (estatística do Nebulosa Workspace na fonte).

   Como funciona (versão 0.5)
   --------------------------
   O site é estático (GitHub Pages), então não tem um servidor próprio para
   guardar números. A contagem usa um serviço gratuito de contadores na
   internet (Abacus, https://abacus.jasoncameron.dev), que só guarda um
   número por contador — nenhum dado de quem visita.

   A contagem é feita a partir dos acessos ao DOMÍNIO oficial
   (nebulosaworkspace.com.br). Ela é uma estatística do site, somando todos
   os visitantes — não é uma contagem de cada pessoa nem para cada pessoa:
   nada fica guardado no navegador de quem visita (a não ser a marca de
   "já contei nesta sessão").

   Contadores (os nomes antigos foram mantidos, então o histórico continua):
     dominio   acessos ao domínio: soma 1 na primeira página do site aberta em
               cada sessão do navegador, seja ela a página inicial, um
               programa, um manual ou uma página legal (novo na 0.5);
     inicio    página inicial do Workspace;
     <id>      cada programa (apps/<id>/index.html, dentro do Workspace ou
               sozinho). Quem carrega este arquivo nos programas é a ponte
               (shared/nebulosa-bridge.js), então não é preciso mexer neles.
   Cada contador soma no máximo uma vez por sessão do navegador (recarregar a
   página não soma de novo).

   Só conta no domínio oficial (lista "dominios" abaixo). Cópias do site em
   outros endereços, file:// e localhost não contam, para não misturar testes
   e cópias com a estatística do site.

   Para "zerar" tudo, mude o "espaco" abaixo (um nome novo começa do zero).
   Nomes: letras, números, ponto, hífen e sublinhado.
   ========================================================================== */
(function () {
  'use strict';
  if (window.NebulosaAcessos) return;

  var CFG = window.NEBULOSA_ACESSOS_CFG = window.NEBULOSA_ACESSOS_CFG || {
    ligado: true,
    servico: 'https://abacus.jasoncameron.dev', // endereços /hit/<espaco>/<contador> e /get/<espaco>/<contador>
    espaco: 'nebulosa-workspace-mwba',            // "pasta" dos contadores deste site (não mude: guarda o histórico)
    dominios: ['nebulosaworkspace.com.br', 'www.nebulosaworkspace.com.br'], // só estes endereços contam
    contarEmOutrosEnderecos: false                // true = conta também fora do domínio (não recomendado)
  };

  // limpeza: a contagem local por navegador (até a 0.4) não é mais usada
  try { localStorage.removeItem('nebulosa.acessos.local'); } catch (e) { /* sem armazenamento */ }

  var host = String(location.hostname || '').toLowerCase();
  var noDominio = /^https?:$/.test(location.protocol) && (CFG.dominios || []).indexOf(host) >= 0;
  var podeContar = CFG.ligado && !!window.fetch && (noDominio || (CFG.contarEmOutrosEnderecos && /^https?:$/.test(location.protocol)));

  function chave(p) { return String(p || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '-').slice(0, 60) || 'pagina'; }
  function url(acao, p) { return CFG.servico.replace(/\/+$/, '') + '/' + acao + '/' + encodeURIComponent(CFG.espaco) + '/' + encodeURIComponent(chave(p)); }
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
  // uma vez por sessão do navegador para cada contador
  function primeiraVez(p) {
    var sk = 'nebulosa.acesso.' + p;
    try { if (sessionStorage.getItem(sk)) return false; sessionStorage.setItem(sk, '1'); } catch (e) { /* sem armazenamento: conta */ }
    return true;
  }
  function hit(p) {
    p = chave(p);
    if (!primeiraVez(p) || !podeContar) return Promise.resolve(null);
    return pedir(url('hit', p)).catch(function () { return null; });
  }

  var api = window.NebulosaAcessos = {
    /** Registra o acesso ao domínio e (se informado) à página/programa. */
    registrar: function (pagina) {
      var d = hit('dominio');
      return pagina ? Promise.all([d, hit(pagina)]).then(function (r) { return r[1]; }) : d;
    },
    /** Lê os números do serviço: { contador: número | null, _online: bool }. */
    ler: function (paginas) {
      var out = { _online: false };
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
    get noDominio() { return noDominio; },
    get conta() { return podeContar; },
    config: CFG
  };

  // Carregado pela ponte (programas) ou por uma página com data-pagina (manuais, legal):
  // registra o acesso ao domínio e, nos programas, ao programa.
  var me = document.currentScript;
  var pg = window.NEBULOSA_ACESSO_PAGINA || (me && me.getAttribute('data-pagina'));
  if (pg) api.registrar(pg === 'dominio' ? null : pg);
})();
