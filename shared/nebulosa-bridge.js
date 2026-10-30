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
     data-host      (0.6) usado SÓ pelo index.html do Workspace: a ponte fornece apenas o
                    motor de idiomas (window.NebulosaIdiomas) e não faz mais nada.

   IDIOMAS (0.6): Português do Brasil (padrão), English e Español. O motor está logo abaixo
   deste comentário. Cada programa tem, na própria pasta, o dicionário nebulosa-idiomas.js,
   carregado logo depois desta ponte:
     <script src="nebulosa-idiomas.js"></script>        <!-- [Nebulosa] idiomas -->
   e o item "Idioma" no menu Ajuda, que chama NebulosaSkin.abrirAjuda('idioma').

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
     notificar({ titulo, texto, tipo, duracao, sempre })
                          aviso no canto de notificações do Workspace (tipo: 'info' | 'sucesso' |
                          'aviso' | 'erro'; duracao em ms). Se o programa está na tela, o aviso
                          vai só para o sino, a menos que sempre = true. Devolve false fora do
                          Workspace — aí o programa mostra o aviso do jeito dele.
     versao               versão do Nebulosa Workspace (mantenha igual a NEBULOSA_VERSAO em js/apps.js)
     links                endereços do site para este programa: { manual, termos, privacidade, creditos }
     abrirAjuda(tipo)     (0.5) abre, NA MESMA PÁGINA, uma janela com o conteúdo pedido:
                          'manual' (manuais/<app>.html), 'termos', 'privacidade' ou 'creditos'
                          (legal/*.html). É o que os itens do menu Ajuda de cada programa chamam.
                          (0.6) Abre a versão do idioma escolhido (<página>.en.html / .es.html);
                          'idioma' abre a janela de escolha do idioma.
                          No HTML único usa as páginas embutidas (window.__nbPaginas), se houver
                          (chaves 'manual', 'manual.en', 'manual.es', 'termos.en'…).
     itensAjuda           [{id, texto}] os itens padrão do menu Ajuda, na ordem
     idiomas              (0.6) o motor de idiomas (= window.NebulosaIdiomas, ver abaixo)
     t(texto, a1…)        (0.6) tradução de um texto no idioma atual
     idioma()             (0.6) 'pt-BR' | 'en' | 'es'
     abrirIdioma()        (0.6) janela "Idioma" (= abrirAjuda('idioma'))
     creditos             { autores, equipe } — autores e idealizadores e equipe de produção
   Também disponível como window.Nebulosa (mesmo objeto).

   Identidade visual (feita pela ponte, igual em todos os programas):
     .nb-by       assinatura "by Nebulosa Workspace" ao lado do nome do programa
     .nb-rodape   texto de rodapé do Nebulosa Workspace
   O programa só escreve o elemento (ex.: <small class="nb-by">by Nebulosa Workspace</small>);
   o estilo é colocado por esta ponte e herda a cor do lugar onde está.

   Contador de acessos: cada vez que o programa abre (uma vez por sessão do
   navegador), a ponte carrega ../../js/acessos.js, que registra o acesso.
   Configuração do contador só em js/acessos.js.
   Alterações não salvas: o programa define window.__nebulosaDirty = function () { return true|false; }
   ========================================================================== */
/* ---------- (0.6) IDIOMAS: Português do Brasil (padrão), English e Español ----------
   Motor de tradução usado pelo Workspace (modo data-host) e por todos os programas.

   Como funciona: os programas continuam escritos em português. Quando o idioma escolhido é
   inglês ou espanhol, a ponte troca, na tela, cada texto em português pelo texto do
   dicionário do programa (arquivo nebulosa-idiomas.js na pasta dele). Textos que mudam
   depois (o programa reescreve um botão, abre uma janela nova…) são traduzidos na hora,
   por um MutationObserver. Ao voltar para o português, os textos originais voltam.
   Não traduz o que a pessoa escreve: campos de texto, áreas editáveis (contenteditable),
   [translate="no"], .notranslate e os seletores "ignorar" de cada programa.

   Dicionário (no nebulosa-idiomas.js de cada programa):
     NebulosaIdiomas.registrar({
       'Salvar': ['Save', 'Guardar'],                       // [inglês, espanhol]
       'Exportando {1} de {2}…': ['Exporting {1} of {2}…', 'Exportando {1} de {2}…']
     }, { ignorar: '.slide, .page', atributos: ['data-tip'] });
   {1}, {2}… são partes que variam (números, nomes). Um texto vazio ('') mantém o original.

   API (window.NebulosaIdiomas; nos programas também NebulosaSkin.idiomas):
     lista                    [{id, nome, curto}]  ('pt-BR', 'en', 'es')
     atual()                  idioma atual
     definir(id)              troca o idioma (vale para o Workspace e todos os programas)
     registrar(dic, opcoes)   acrescenta textos ao dicionário
     t(texto, a1, a2…)        traduz um texto (com {1}, {2}… preenchidos)
     traduzir(texto)          traduz um texto já pronto (como na tela); devolve o original se não achar
     traduzirHtml(html)       traduz os textos de um pedaço de HTML (modelos de documento etc.)
     aoMudar(fn)              avisa fn(id) quando o idioma muda
     abrir()                  janela "Idioma" (escolher entre os três)
     local()                  'pt-BR' | 'en-US' | 'es-ES' (para datas e números)
   Guardado em localStorage "nebulosa.idioma". */
(function () {
  'use strict';
  if (window.NebulosaIdiomas) return;
  var CHAVE = 'nebulosa.idioma';
  var LISTA = [
    { id: 'pt-BR', nome: 'Português (Brasil)', curto: 'PT' },
    { id: 'en', nome: 'English', curto: 'EN' },
    { id: 'es', nome: 'Español', curto: 'ES' }
  ];
  var LOCAL = { 'pt-BR': 'pt-BR', en: 'en-US', es: 'es-ES' };
  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } }
  function normal(v) { v = String(v || ''); if (/^en/i.test(v)) return 'en'; if (/^es/i.test(v)) return 'es'; if (/^pt/i.test(v)) return 'pt-BR'; return null; }
  var idioma = normal(ler(CHAVE)) || 'pt-BR';
  var IX = { en: 0, es: 1 };
  var ESPACO = { en: 'Space', es: 'Espacio' };
  var DIC = new Map(), DICL = new Map(), PATS = {}, PGEN = [], MERG = {};
  // textos com formatação (<b>, <i>…): a chave é o HTML de dentro do elemento, ex.: 'Clique em <b>Salvar</b>.'
  var HDIC = new Map(), INLINE = { B: 1, I: 1, STRONG: 1, EM: 1, U: 1, SMALL: 1, CODE: 1, KBD: 1, BR: 1, SUP: 1, SUB: 1, MARK: 1, Q: 1, S: 1 };
  var ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'data-tip', 'data-tooltip', 'data-title', 'label', 'aria-roledescription'];
  var IGN = '[translate="no"],.notranslate';
  var PULA = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, IFRAME: 1, OBJECT: 1 };
  var LETRA = /[A-Za-zÀ-ÿ]/;
  var cache = new Map();
  var subs = [];

  /* ---------- dicionário ---------- */
  function limpa(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function registrar(dic, op) {
    if (dic) Object.keys(dic).forEach(function (k0) {
      var v = dic[k0]; if (!v) return;
      if (typeof v === 'string') v = [v, v];
      var k = limpa(k0); if (!k) return;
      if (/<[a-z][^>]*>/i.test(k)) { HDIC.set(k, v); DIC.set(k, v); return; }
      if (/\{\d+#?\}/.test(k)) {
        // {1} = qualquer texto; {1#} = só número (ex.: '{1#} de {2} de {3#}' para datas)
        var partes = k.split(/(\{\d+#?\})/), re = '', lit = 0, ordem = [];
        partes.forEach(function (p) {
          var m = /^\{(\d+)(#?)\}$/.exec(p);
          if (m) { re += m[2] ? '(\\d+(?:[.,]\\d+)?)' : '([\\s\\S]+?)'; ordem.push(+m[1]); } else { re += escRe(p); lit += p.length + 0; }
        });
        var pat = { re: new RegExp('^' + re + '$'), v: v, ordem: ordem, lit: lit, k: k };
        var pre = partes[0];
        if (pre.length >= 2) { var b = pre.slice(0, 2).toLowerCase(); (PATS[b] = PATS[b] || []).push(pat); PATS[b].sort(porLit); }
        else { PGEN.push(pat); PGEN.sort(porLit); }
        DIC.set(k, v); // também para t('...{1}...')
      } else {
        DIC.set(k, v);
        var l = k.toLowerCase(); if (!DICL.has(l)) DICL.set(l, k);
      }
    });
    if (op) {
      if (op.ignorar) IGN += ',' + op.ignorar;
      if (op.atributos) op.atributos.forEach(function (a) { if (ATTRS.indexOf(a) < 0) ATTRS.push(a); });
    }
    cache.clear(); MERG = {};
    if (idioma !== 'pt-BR') { ligar(); passar(document); }
  }
  function porLit(a, b) { return b.lit - a.lit; }
  function val(v, k) { var t = v[IX[idioma]]; return t === '' || t == null ? k : t; }
  function caixa(orig, t) {
    if (orig === orig.toUpperCase() && orig !== orig.toLowerCase()) return t.toUpperCase();
    var c = orig.charAt(0);
    if (c !== c.toLowerCase()) return t.charAt(0).toUpperCase() + t.slice(1);
    return t;
  }
  function exato(k) {
    var v = DIC.get(k); if (v) return val(v, k);
    var l = DICL.get(k.toLowerCase()); if (l) return caixa(k, val(DIC.get(l), l));
    return null;
  }
  var prof = 0;
  function padrao(k) {
    // padrões do mesmo começo + gerais, do mais específico (mais texto fixo) para o menos
    var b = k.slice(0, 2).toLowerCase(), L = MERG[b] || (MERG[b] = (PATS[b] || []).concat(PGEN).sort(porLit));
    for (var i = 0; i < L.length; i++) {
      var p = L[i], m = p.re.exec(k);
      if (!m) continue;
      var vals = {};
      p.ordem.forEach(function (n, j) {
        var c = m[j + 1], t = exato(limpa(c));
        // parte variável com atalho ou número ("Laço (L)", "Camada 3"): uma volta a mais, com limite
        if (t == null && prof < 2 && /[A-Za-zÀ-ÿ]/.test(c)) { prof++; try { t = traduzir0(limpa(c)); } finally { prof--; } }
        vals[n] = t != null ? c.replace(limpa(c), t) : c;
      });
      return val(p.v, p.k).replace(/\{(\d+)\}/g, function (x, n) { return vals[n] != null ? vals[n] : x; });
    }
    return null;
  }
  function olhar(k) { var t = exato(k); return t != null ? t : padrao(k); }
  // texto já "limpo" (sem espaços nas pontas)
  function nucleo(k) {
    var t = olhar(k); if (t != null) return t;
    // ícone/símbolo na frente (➕, •, →, emoji…) e pontuação no fim (:, …, !, ?)
    var m = /^([^A-Za-zÀ-ÿ0-9¿¡"“'(\[]*)([\s\S]*?)([\s:：…!?.*]*)$/.exec(k);
    if (m && (m[1] || m[3]) && m[2]) {
      var suf = m[3];
      t = olhar(m[2]);
      if (t == null && suf.trim()) { t = olhar(m[2] + suf.trim()); if (t != null) suf = suf.slice(0, suf.length - suf.replace(/^\s+/, '').length); }
      if (t != null) return m[1] + t + suf;
    }
    // atalho no fim: "Desfazer (Ctrl+Z)", "Salvar — Ctrl+S"
    m = /^(.*?[A-Za-zÀ-ÿ].*?)(\s*(?:\(\s*(?:(?:Ctrl|Alt|Shift|Cmd|⌘|⇧|F\d+|Tab|Esc|Enter|Del|Delete|Espaço|Space)\b[^)]*|[A-Z0-9↑↓←→?+\-]{1,3})\)|(?:—|·)\s*(?:Ctrl|Alt|Shift|Cmd|⌘|F\d+)\b.*))$/.exec(k);
    if (m) { t = olhar(m[1]); if (t != null) return t + m[2].replace(/Espaço/g, ESPACO[idioma] || 'Espaço'); }
    // número no fim: "Camada 3", "Slide 12", "Página (2)"
    m = /^(.*?[A-Za-zÀ-ÿ].*?)(\s+\(?\d+\)?)$/.exec(k);
    if (m) { t = olhar(m[1]); if (t != null) return t + m[2]; }
    return null;
  }
  function traduzir0(s) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), c = m[2];
    if (!c || !LETRA.test(c)) return null;
    var t = nucleo(c.indexOf('\n') >= 0 || /\s{2,}/.test(c) ? limpa(c) : c);
    // primeiro corte só no 1º separador: "Nome — descrição que também tem — dentro"
    if (t == null && prof < 2) {
      var m1 = /^([\s\S]+?)(\s(?:·|—|\||\/)\s)([\s\S]+)$/.exec(limpa(c));
      if (m1) { prof++; try { var h1 = nucleo(m1[1]), r1 = h1 != null ? traduzir0(m1[3]) : null; if (h1 != null && r1 != null) t = h1 + m1[2] + r1; } finally { prof--; } }
    }
    // "nome.pdf: frase traduzível" — o que vem antes dos dois-pontos pode ser um nome (fica como está)
    if (t == null && prof < 2) {
      var m2 = /^([^:\n]{1,80}?):\s+([\s\S]+)$/.exec(limpa(c));
      if (m2) { prof++; try { var r2 = traduzir0(m2[2]); if (r2 != null) { var h2 = nucleo(m2[1]); t = (h2 != null ? h2 : m2[1]) + ': ' + r2; } } finally { prof--; } }
    }
    // partes separadas por " · ", " — ", " | ", " / ": "Retângulo · Revelar"
    if (t == null && /\s(·|—|\||\/)\s/.test(c)) {
      var ps = limpa(c).split(/(\s(?:·|—|\||\/)\s)/), achou = false;
      ps = ps.map(function (x, i) { if (i % 2) return x; var r = nucleo(x); if (r != null) { achou = true; return r; } return x; });
      if (achou) t = ps.join('');
    }
    // frases: "Primeira frase. Segunda frase." traduz frase por frase
    if (t == null && /[.!?…:]\s+\S/.test(c)) {
      var fr = limpa(c).split(/(?<=[.!?…:])\s+(?=[A-ZÀ-Ú¿¡"“(0-9])/);
      if (fr.length > 1) {
        var ok = false;
        fr = fr.map(function (f) { var r = nucleo(f); if (r != null) { ok = true; return r; } return f; });
        if (ok) t = fr.join(' ');
      }
    }
    if (t == null && /\n/.test(c)) {
      var mudou = false;
      var linhas = c.split('\n').map(function (l) { var r = l.trim() ? traduzir0(l) : null; if (r != null) { mudou = true; return r; } return l; });
      if (mudou) t = linhas.join('\n');
    }
    return t == null ? null : m[1] + t + m[3];
  }
  /** Tradução de um texto como aparece na tela; null = não há tradução. */
  function tr(s) {
    if (idioma === 'pt-BR' || s == null) return null;
    s = String(s);
    if (s.length > 4000) return null;
    var c = cache.get(s); if (c !== undefined) return c;
    var r = traduzir0(s);
    if (cache.size > 6000) cache.clear();
    cache.set(s, r);
    return r;
  }
  function traduzir(s) { var t = tr(s); return t == null ? s : t; }
  function t(k) {
    var args = arguments, v = DIC.get(limpa(k)), r = idioma === 'pt-BR' || !v ? String(k) : val(v, String(k));
    if (!v && idioma !== 'pt-BR') { var x = tr(k); if (x != null) r = x; }
    return r.replace(/\{(\d+)\}/g, function (x, n) { return args[+n] != null ? traduzir(String(args[+n])) : x; });
  }

  /** Traduz os textos de um pedaço de HTML (modelos, conteúdo inicial). */
  function traduzirHtml(h) {
    if (idioma === 'pt-BR' || !h) return h;
    var tp = document.createElement('template'); tp.innerHTML = h;
    var w = document.createTreeWalker(tp.content, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n, x;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { x = tr(n.data); if (x != null) n.data = x; }
      else ATTRS.forEach(function (a) { var v = n.getAttribute(a); if (v) { x = tr(v); if (x != null) n.setAttribute(a, x); } });
    }
    return tp.innerHTML;
  }

  /* ---------- tela ---------- */
  var TXT = new WeakMap(), ATR = new WeakMap(), obs = null;
  function ignorado(el) {
    for (; el && el.nodeType === 1; el = el.parentElement) {
      if (PULA[el.nodeName]) return true;
      if (el.isContentEditable) return true;
    }
    return false;
  }
  function ignoradoSel(el) { try { return !!(el && el.closest && el.closest(IGN)); } catch (e) { return false; } }
  function texto(n, feitos) {
    if (feitos && feitos.has(n)) return;
    if (n.parentNode && n.parentNode.nodeName === 'TEXTAREA') return; // conteúdo de campo: é da pessoa
    // vários nós de texto vizinhos (React, appendChild): traduz o conjunto
    if ((n.previousSibling && n.previousSibling.nodeType === 3) || (n.nextSibling && n.nextSibling.nodeType === 3)) {
      var ini = n; while (ini.previousSibling && ini.previousSibling.nodeType === 3) ini = ini.previousSibling;
      var nos = []; for (var x = ini; x && x.nodeType === 3; x = x.nextSibling) nos.push(x);
      if (nos.length > 1 && nos.length < 40) { grupo(nos, feitos); return; }
    }
    um(n);
    if (feitos) feitos.add(n);
  }
  function origDe(n) { var r = TXT.get(n), d = n.data; return r && d === r[1] ? r[0] : d; }
  function um(n) {
    var d = n.data, r = TXT.get(n), o = r && d === r[1] ? r[0] : d;
    if (idioma === 'pt-BR') { if (r) { if (d === r[1] && d !== r[0]) n.data = r[0]; TXT.delete(n); } return; }
    if (!LETRA.test(o)) { if (r) TXT.delete(n); return; }
    var t = tr(o);
    if (t == null) { if (r) { TXT.delete(n); if (d !== o) n.data = o; } return; }
    TXT.set(n, [o, t]);
    if (d !== t) n.data = t;
  }
  function grupo(nos, feitos) {
    var origs = nos.map(origDe), junto = origs.join('');
    if (feitos) nos.forEach(function (x) { feitos.add(x); });
    var t = idioma !== 'pt-BR' && LETRA.test(junto) ? tr(junto) : null;
    if (t != null) {
      nos.forEach(function (x, i) { var v = i === 0 ? t : ''; TXT.set(x, [origs[i], v]); if (x.data !== v) x.data = v; });
      return;
    }
    // o conjunto não tem tradução: volta cada pedaço ao original e traduz um por um
    // (um() já sabe qual é o original de cada pedaço; não volta ao português antes, senão vira ciclo sem fim)
    nos.forEach(function (x) { um(x); });
  }
  function atributo(el, a) {
    var v = el.getAttribute(a); if (v == null) return;
    var m = ATR.get(el), r = m && m[a], o = r && v === r[1] ? r[0] : v;
    if (idioma === 'pt-BR') { if (r) { if (v === r[1] && v !== r[0]) el.setAttribute(a, r[0]); delete m[a]; } return; }
    var t = LETRA.test(o) ? tr(o) : null;
    if (t == null) { if (r) { delete m[a]; if (v !== o) el.setAttribute(a, o); } return; }
    if (!m) { m = {}; ATR.set(el, m); }
    m[a] = [o, t];
    if (v !== t) el.setAttribute(a, t);
  }
  var BLC = new WeakMap();
  function bloco(el) {
    var r = BLC.get(el);
    if (idioma === 'pt-BR') { if (r && el.innerHTML === r[1]) el.innerHTML = r[0]; BLC.delete(el); return; }
    var n = el.childElementCount;
    if (!n || n > 16 || el.textContent.length > 3000) return;
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (!INLINE[c.nodeName] || c.attributes.length) return;
    var h = el.innerHTML, o = r && h === r[1] ? r[0] : h, v = HDIC.get(limpa(o));
    if (!v) { if (r && h === r[1]) el.innerHTML = r[0]; BLC.delete(el); return; }
    var t = val(v, o); BLC.set(el, [o, t]);
    if (h !== t) el.innerHTML = t;
  }
  function atributos(el) {
    if (HDIC.size && el.firstElementChild) bloco(el);
    for (var i = 0; i < ATTRS.length; i++) if (el.hasAttribute(ATTRS[i])) atributo(el, ATTRS[i]);
    if (el.nodeName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && el.hasAttribute('value')) atributo(el, 'value');
  }
  var FILTRO = {
    acceptNode: function (n) {
      if (n.nodeType === 1) {
        if (PULA[n.nodeName]) return NodeFilter.FILTER_REJECT;
        if (n.isContentEditable && idioma !== 'pt-BR') return NodeFilter.FILTER_REJECT;
        try { if (n.matches(IGN)) return NodeFilter.FILTER_REJECT; } catch (e) { /* seletor inválido */ }
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  };
  function passar(raiz, feitos) {
    if (!raiz) return;
    if (raiz.nodeType === 3) { texto(raiz, feitos); return; }
    if (raiz.nodeType === 1) { if (FILTRO.acceptNode(raiz) === NodeFilter.FILTER_REJECT) return; atributos(raiz); }
    else if (raiz.nodeType !== 9 && raiz.nodeType !== 11) return;
    feitos = feitos || new Set();
    var w = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, FILTRO), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) texto(n, feitos); else atributos(n); }
  }
  function mudancas(lista) {
    var feitos = new Set();
    for (var i = 0; i < lista.length; i++) {
      var r = lista[i], alvo = r.target;
      if (r.type === 'childList') {
        if (!r.addedNodes.length) continue;
        var base = alvo.nodeType === 1 ? alvo : alvo.parentElement;
        if (base && (ignorado(base) || ignoradoSel(base))) continue;
        if (HDIC.size && base && base.firstElementChild && !feitos.has(base)) { feitos.add(base); bloco(base); }
        for (var j = 0; j < r.addedNodes.length; j++) { var a = r.addedNodes[j]; if (a.isConnected) passar(a, feitos); }
      } else if (r.type === 'characterData') {
        var pe = alvo.parentElement;
        if (!pe || ignorado(pe) || ignoradoSel(pe)) continue;
        texto(alvo, feitos);
      } else if (r.type === 'attributes') {
        if (alvo.isContentEditable || ignoradoSel(alvo) || ignorado(alvo.parentElement)) continue;
        if (r.attributeName === 'value') { if (alvo.nodeName === 'INPUT' && /^(button|submit|reset)$/i.test(alvo.type)) atributo(alvo, 'value'); }
        else atributo(alvo, r.attributeName);
      }
    }
  }
  function ligar() {
    if (obs || !window.MutationObserver) return;
    obs = new MutationObserver(mudancas);
    obs.observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(['value']) });
  }
  function desligar() { if (obs) { mudancas(obs.takeRecords()); obs.disconnect(); obs = null; } }

  /* ---------- janelas nativas (alert, confirm, prompt) ---------- */
  ['alert', 'confirm'].forEach(function (f) {
    var o = window[f]; if (typeof o !== 'function') return;
    window[f] = function (m) { return o.call(window, m == null ? m : traduzir(String(m))); };
  });
  (function () {
    var o = window.prompt; if (typeof o !== 'function') return;
    window.prompt = function (m, d) { return o.call(window, m == null ? m : traduzir(String(m)), d == null ? d : traduzir(String(d))); };
  })();

  // imprimir logo depois de montar a página: traduz o que ainda está na fila antes
  (function () {
    var o = window.print; if (typeof o !== 'function') return;
    window.print = function () { if (obs) mudancas(obs.takeRecords()); return o.apply(window, arguments); };
  })();

  /* ---------- trocar ---------- */
  function aplicarLang() { try { document.documentElement.setAttribute('lang', idioma); } catch (e) { /* ignora */ } }
  function definir(id, deFora) {
    id = normal(id) || 'pt-BR';
    if (id === idioma) return;
    if (obs) mudancas(obs.takeRecords());
    idioma = id; cache.clear();
    if (!deFora) gravar(CHAVE, id);
    aplicarLang();
    passar(document);
    if (id === 'pt-BR') desligar(); else ligar();
    subs.slice().forEach(function (f) { try { f(id); } catch (e) { /* ignora */ } });
  }
  window.addEventListener('storage', function (e) { if (e.key === CHAVE) definir(e.newValue, true); });

  /* ---------- janela "Idioma" ---------- */
  var CSS = '#nbIdiOv{position:fixed;inset:0;z-index:2147483002;background:rgba(10,11,28,.62);display:grid;place-items:center;padding:20px;box-sizing:border-box;font:14px/1.45 Figtree,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#f3f1ff}' +
    '#nbIdiOv *{box-sizing:border-box}#nbIdiOv .nbIb{background:#2d3053;border:1px solid rgba(190,185,255,.18);border-radius:18px;padding:22px;width:min(420px,100%);box-shadow:0 24px 70px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:12px}' +
    '#nbIdiOv h3{margin:0;font-size:20px}#nbIdiOv p{margin:0;font-size:13.5px;color:#b9bce0}' +
    '#nbIdiOv .nbIl{display:flex;flex-direction:column;gap:8px}#nbIdiOv .nbIo{display:flex;align-items:center;gap:12px;background:#262948;color:inherit;border:2px solid rgba(190,185,255,.22);border-radius:12px;padding:10px 14px;font:inherit;cursor:pointer;text-align:left}' +
    '#nbIdiOv .nbIo:hover{border-color:#A778FF}#nbIdiOv .nbIo.on{border-color:#A778FF;box-shadow:0 0 0 2px #A778FF}#nbIdiOv .nbIo i{font-style:normal;font-weight:700;font-size:12px;background:#A778FF;color:#1b1d38;border-radius:6px;padding:2px 6px}#nbIdiOv .nbIo b{flex:1}' +
    '#nbIdiOv .nbIf{display:flex;justify-content:flex-end}#nbIdiOv .nbIx{background:#A778FF;color:#1b1d38;border:0;border-radius:10px;padding:8px 16px;font:inherit;font-weight:700;cursor:pointer}' +
    '#nbIdiOv button:focus-visible{outline:2px solid #FEFF36;outline-offset:2px}';
  function fecharJanela() { var o = document.getElementById('nbIdiOv'); if (o) o.remove(); document.removeEventListener('keydown', teclaJanela, true); }
  function teclaJanela(e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); fecharJanela(); } }
  function abrir(aoEscolher) {
    fecharJanela();
    if (!document.getElementById('nbIdiStyle')) { var st = document.createElement('style'); st.id = 'nbIdiStyle'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); }
    var o = document.createElement('div'); o.id = 'nbIdiOv';
    o.innerHTML = '<div class="nbIb" role="dialog" aria-modal="true" aria-label="Idioma"><h3>Idioma</h3><p>Escolha o idioma do Nebulosa Workspace e de todos os programas.</p><div class="nbIl" translate="no">' +
      LISTA.map(function (l) { return '<button type="button" class="nbIo' + (l.id === idioma ? ' on' : '') + '" data-l="' + l.id + '" lang="' + l.id + '"><i>' + l.curto + '</i><b>' + l.nome + '</b></button>'; }).join('') +
      '</div><div class="nbIf"><button type="button" class="nbIx">Fechar</button></div></div>';
    o.addEventListener('mousedown', function (e) { if (e.target === o) fecharJanela(); });
    o.addEventListener('click', function (e) {
      var b = e.target.closest('[data-l]');
      if (b) { var id = b.getAttribute('data-l'); definir(id); if (aoEscolher) try { aoEscolher(id); } catch (x) { /* ignora */ } [].forEach.call(o.querySelectorAll('[data-l]'), function (x) { x.classList.toggle('on', x === b); }); setTimeout(fecharJanela, 160); return; }
      if (e.target.closest('.nbIx')) fecharJanela();
    });
    (document.body || document.documentElement).appendChild(o);
    document.addEventListener('keydown', teclaJanela, true);
    var f = o.querySelector('.nbIo.on'); if (f) f.focus();
    return true;
  }

  // textos da própria ponte (janelas de Ajuda, Aparência e Idioma)
  registrar({
    'Idioma': ['Language', 'Idioma'],
    'Escolha o idioma do Nebulosa Workspace e de todos os programas.': ['Choose the language of Nebulosa Workspace and all its programs.', 'Elige el idioma de Nebulosa Workspace y de todos los programas.'],
    'Fechar': ['Close', 'Cerrar'],
    'Ajuda': ['Help', 'Ayuda'],
    'Manual do usuário': ['User manual', 'Manual del usuario'],
    'Manual do usuário — {1}': ['User manual — {1}', 'Manual del usuario — {1}'],
    'Termos de uso': ['Terms of use', 'Términos de uso'],
    'Privacidade': ['Privacy', 'Privacidad'],
    'Créditos e licenças': ['Credits and licenses', 'Créditos y licencias'],
    'Atalhos do teclado': ['Keyboard shortcuts', 'Atajos de teclado'],
    'Aparência': ['Appearance', 'Apariencia'],
    'Escolha o visual de {1}. A mudança vale só para este programa.': ['Choose the look of {1}. The change applies only to this program.', 'Elige el aspecto de {1}. El cambio vale solo para este programa.'],
    'Modo': ['Mode', 'Modo'],
    'Automático': ['Automatic', 'Automático'],
    'Claro': ['Light', 'Claro'],
    'Escuro': ['Dark', 'Oscuro'],
    '{1} Default': ['{1} Default', '{1} Default'],
    'O visual original de {1}.': ['The original look of {1}.', 'El aspecto original de {1}.'],
    'Roxo, azul-marinho, laranja e amarelo: a cara da família Nebulosa.': ['Purple, navy blue, orange and yellow: the face of the Nebulosa family.', 'Morado, azul marino, naranja y amarillo: la cara de la familia Nebulosa.'],
    'Idêntica ao Photopea.': ['Identical to Photopea.', 'Idéntica a Photopea.'],
    'by Nebulosa Workspace': ['by Nebulosa Workspace', 'by Nebulosa Workspace'],
    'Nebulosa Workspace - um pacote de programas simples, bonitos e que funcionam direto no navegador. Versão {1}': ['Nebulosa Workspace - a suite of simple, beautiful programs that run right in your browser. Version {1}', 'Nebulosa Workspace - un paquete de programas sencillos, bonitos y que funcionan directamente en el navegador. Versión {1}'],
    'Nebulosa Workspace — um pacote de programas simples, bonitos e que funcionam direto no navegador. Versão {1}': ['Nebulosa Workspace — a suite of simple, beautiful programs that run right in your browser. Version {1}', 'Nebulosa Workspace — un paquete de programas sencillos, bonitos y que funcionan directamente en el navegador. Versión {1}'],
    'Autores e idealizadores': ['Authors and creators', 'Autores e idealizadores'],
    'Autores e idealizadores:': ['Authors and creators:', 'Autores e idealizadores:'],
    'Equipe de produção': ['Production team', 'Equipo de producción'],
    'Equipe de produção:': ['Production team:', 'Equipo de producción:'],
    'Equipe de Produção Lamp Lighter': ['Lamp Lighter Production Team', 'Equipo de Producción Lamp Lighter'],
    'Márcio Willians Barreto de Andrade e Raul Goulart de Andrade': ['Márcio Willians Barreto de Andrade and Raul Goulart de Andrade', 'Márcio Willians Barreto de Andrade y Raul Goulart de Andrade']
  });

  // datas por extenso em português: "27 de outubro de 2026", "terça, 27 de outubro", "outubro de 2026"
  (function () {
    var M = [['janeiro', 'January', 'enero'], ['fevereiro', 'February', 'febrero'], ['março', 'March', 'marzo'], ['abril', 'April', 'abril'], ['maio', 'May', 'mayo'], ['junho', 'June', 'junio'],
      ['julho', 'July', 'julio'], ['agosto', 'August', 'agosto'], ['setembro', 'September', 'septiembre'], ['outubro', 'October', 'octubre'], ['novembro', 'November', 'noviembre'], ['dezembro', 'December', 'diciembre']];
    var D = [['domingo', 'Sunday', 'domingo'], ['segunda-feira', 'Monday', 'lunes'], ['terça-feira', 'Tuesday', 'martes'], ['quarta-feira', 'Wednesday', 'miércoles'], ['quinta-feira', 'Thursday', 'jueves'], ['sexta-feira', 'Friday', 'viernes'], ['sábado', 'Saturday', 'sábado'],
      ['segunda', 'Monday', 'lunes'], ['terça', 'Tuesday', 'martes'], ['quarta', 'Wednesday', 'miércoles'], ['quinta', 'Thursday', 'jueves'], ['sexta', 'Friday', 'viernes']];
    var d = {};
    M.forEach(function (m) {
      d['{1#} de ' + m[0] + ' de {2#}'] = [m[1] + ' {1}, {2}', '{1} de ' + m[2] + ' de {2}'];
      d['{1}, {2#} de ' + m[0] + ' de {3#}'] = ['{1}, ' + m[1] + ' {2}, {3}', '{1}, {2} de ' + m[2] + ' de {3}'];
      d['{1}, {2#} de ' + m[0]] = ['{1}, ' + m[1] + ' {2}', '{1}, {2} de ' + m[2]];
      d['{1#} de ' + m[0]] = [m[1] + ' {1}', '{1} de ' + m[2]];
      d[m[0] + ' de {1#}'] = [m[1] + ' {1}', m[2] + ' de {1}'];
      d[m[0]] = [m[1], m[2]];
    });
    D.forEach(function (x) { d[x[0]] = [x[1], x[2]]; });
    registrar(d);
  })();

  aplicarLang();
  if (idioma !== 'pt-BR') ligar();
  document.addEventListener('DOMContentLoaded', function () { if (idioma !== 'pt-BR') passar(document); });

  window.NebulosaIdiomas = {
    lista: LISTA,
    atual: function () { return idioma; },
    local: function () { return LOCAL[idioma]; },
    definir: function (id) { definir(id); },
    registrar: registrar,
    t: t,
    traduzir: traduzir,
    traduzirHtml: traduzirHtml,
    tem: function (k) { return DIC.has(limpa(k)); },
    aoMudar: function (f) { if (typeof f === 'function') subs.push(f); },
    abrir: abrir,
    passar: function (raiz) { if (idioma !== 'pt-BR') passar(raiz || document); }
  };
})();

(function () {
  'use strict';
  var me = document.currentScript;
  if (me && me.hasAttribute('data-host')) return; // (0.6) no Workspace a ponte só fornece os idiomas
  if (window.NebulosaSkin) return; // carregada duas vezes: mantém a primeira

  var VERSAO = '0.6';
  var I = window.NebulosaIdiomas;
  function T(s) { var a = arguments; return I ? I.t.apply(null, a) : String(s).replace(/\{(\d+)\}/g, function (x, n) { return a[+n] != null ? a[+n] : x; }); }
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

  /* ---------- (0.5) menu Ajuda: Manual do usuário, Termos de uso, Privacidade, Créditos e licenças ----------
     O conteúdo abre numa janela dentro do próprio programa (não em outra aba).
     No site os endereços são os do próprio site; no HTML único (aberto do computador)
     usa as páginas embutidas nele ou, sem elas, o domínio oficial. */
  var SITE = 'https://nebulosaworkspace.com.br/';
  var BASE = (function () {
    var src = me && me.src;
    if (src && /^https?:/.test(src) && /shared\/nebulosa-bridge\.js(\?|#|$)/.test(src)) return src.replace(/shared\/nebulosa-bridge\.js.*$/, '');
    return SITE;
  })();
  var LINKS = {
    manual: BASE + 'manuais/' + APP + '.html',
    termos: BASE + 'legal/termos.html',
    privacidade: BASE + 'legal/privacidade.html',
    creditos: BASE + 'legal/creditos.html#' + APP
  };
  var TITULOS = { manual: 'Manual do usuário', termos: 'Termos de uso', privacidade: 'Privacidade', creditos: 'Créditos e licenças' };
  // (0.6) versões traduzidas das páginas: manuais/<app>.en.html, legal/termos.es.html…
  function sufixo() { var l = I ? I.atual() : 'pt-BR'; return l === 'en' ? '.en' : l === 'es' ? '.es' : ''; }
  function comIdioma(u) { var s = sufixo(); return s ? u.replace(/\.html(#|$)/, s + '.html$1') : u; }
  var CREDITOS = {
    autores: 'Márcio Willians Barreto de Andrade e Raul Goulart de Andrade',
    equipe: 'Equipe de Produção Lamp Lighter'
  };
  var AJ_CSS =
    '#nbAjudaOv{position:fixed;inset:0;z-index:2147483001;background:rgba(10,11,28,.62);display:grid;place-items:center;padding:16px;box-sizing:border-box;font:14px/1.4 Figtree,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '#nbAjudaOv *{box-sizing:border-box}' +
    '#nbAjudaOv .nbA{width:min(1100px,100%);height:min(92vh,100%);background:#2d3053;color:#f3f1ff;border:1px solid rgba(190,185,255,.2);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden}' +
    '#nbAjudaOv .nbAh{display:flex;align-items:center;gap:8px;padding:10px 12px 10px 18px;border-bottom:1px solid rgba(190,185,255,.18)}' +
    '#nbAjudaOv .nbAh b{flex:1;font-size:16px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#nbAjudaOv .nbAt{display:flex;gap:4px;flex-wrap:wrap}' +
    '#nbAjudaOv .nbAt button{background:transparent;color:#c9c6ee;border:1px solid transparent;border-radius:9px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer}' +
    '#nbAjudaOv .nbAt button:hover{border-color:rgba(190,185,255,.3);color:#fff}#nbAjudaOv .nbAt button.on{background:#A778FF;color:#1b1d38;font-weight:700}' +
    '#nbAjudaOv .nbAx{background:#A778FF;color:#1b1d38;border:0;border-radius:9px;padding:7px 14px;font:inherit;font-weight:700;cursor:pointer}' +
    '#nbAjudaOv iframe{flex:1;width:100%;border:0;background:#f4f1fc}' +
    '#nbAjudaOv button:focus-visible{outline:2px solid #FEFF36;outline-offset:2px}' +
    '@media (max-width:700px){#nbAjudaOv{padding:0}#nbAjudaOv .nbA{height:100%;border-radius:0}#nbAjudaOv .nbAh{flex-wrap:wrap}}';
  function urlAjuda(tipo) {
    var P = window.__nbPaginas, emb = P && (P[tipo + sufixo()] || P[tipo]);
    if (emb) return emb;
    var u = comIdioma(LINKS[tipo] || LINKS.manual), h = u.indexOf('#');
    return h < 0 ? u + '?embed=1' : u.slice(0, h) + '?embed=1' + u.slice(h);
  }
  function fecharAjuda() {
    var o = document.getElementById('nbAjudaOv'); if (o) o.remove();
    document.removeEventListener('keydown', teclaAjuda, true);
  }
  function teclaAjuda(e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); fecharAjuda(); } }
  function abrirAjuda(tipo) {
    if (tipo === 'idioma') return abrirIdioma();
    if (!TITULOS[tipo]) tipo = 'manual';
    fecharAjuda();
    if (!document.getElementById('nbAjudaStyle')) { var st = document.createElement('style'); st.id = 'nbAjudaStyle'; st.textContent = AJ_CSS; (document.head || document.documentElement).appendChild(st); }
    var o = document.createElement('div'); o.id = 'nbAjudaOv';
    o.innerHTML = '<div class="nbA" role="dialog" aria-modal="true" aria-label="' + T('Ajuda') + '"><div class="nbAh"><b></b><div class="nbAt">' +
      ['manual', 'termos', 'privacidade', 'creditos'].map(function (k) { return '<button type="button" data-k="' + k + '">' + T(TITULOS[k]) + '</button>'; }).join('') +
      '</div><button type="button" class="nbAx">' + T('Fechar') + '</button></div><iframe title="' + T('Ajuda') + '"></iframe></div>';
    var fr = o.querySelector('iframe');
    var mostrar = function (k) {
      tipo = k; o.querySelector('b').textContent = T(TITULOS[k]) + (k === 'manual' ? ' — ' + NAME : '');
      [].forEach.call(o.querySelectorAll('[data-k]'), function (b) { b.classList.toggle('on', b.getAttribute('data-k') === k); });
      fr.src = urlAjuda(k);
    };
    o.addEventListener('mousedown', function (e) { if (e.target === o) fecharAjuda(); });
    o.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]'); if (b) { mostrar(b.getAttribute('data-k')); return; }
      if (e.target.closest('.nbAx')) fecharAjuda();
    });
    (document.body || document.documentElement).appendChild(o);
    document.addEventListener('keydown', teclaAjuda, true);
    mostrar(tipo);
    var x = o.querySelector('.nbAx'); if (x) x.focus();
    return true;
  }

  function publicList() {
    var l = provider ? (provider.list() || []) : LIST;
    return l.map(function (x) { return { id: x.id, name: x.name, desc: x.desc ? (I ? I.traduzir(x.desc) : x.desc) : '', swatch: x.swatch || null }; });
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
    versao: VERSAO,
    links: LINKS,
    creditos: CREDITOS,
    itensAjuda: [{ id: 'manual', texto: 'Manual do usuário' }, { id: 'termos', texto: 'Termos de uso' }, { id: 'privacidade', texto: 'Privacidade' }, { id: 'creditos', texto: 'Créditos e licenças' }, { id: 'idioma', texto: 'Idioma' }],
    abrirAjuda: abrirAjuda,
    // (0.6) idiomas: NebulosaSkin.idiomas (= window.NebulosaIdiomas), t('texto'), idioma(), abrirIdioma()
    idiomas: I,
    t: T,
    idioma: function () { return I ? I.atual() : 'pt-BR'; },
    abrirIdioma: abrirIdioma,
    abrirManual: function () { return abrirAjuda('manual'); },
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
    notify: function () { post('skin'); },
    notificar: function (op) {
      if (!inFrame || !op) return false;
      try {
        window.parent.postMessage({
          nebulosa: 'notify', app: APP,
          title: tradu(op.titulo).slice(0, 90), text: tradu(op.texto).slice(0, 320),
          kind: op.tipo || 'info', ttl: +op.duracao || 0, always: !!op.sempre
        }, '*');
        return true;
      } catch (e) { return false; }
    }
  };
  if (!window.Nebulosa) window.Nebulosa = api;
  function tradu(s) { s = String(s || ''); return I ? I.traduzir(s) : s; }

  /* ---------- (0.6) idioma ---------- */
  // A escolha vale para o Workspace e todos os programas (localStorage "nebulosa.idioma").
  // Escolhido dentro de um programa (Ajuda › Idioma), o programa avisa o Workspace.
  function abrirIdioma() {
    if (!I) return false;
    return I.abrir(function (id) { if (inFrame) { try { window.parent.postMessage({ nebulosa: 'lang', app: APP, idioma: id }, '*'); } catch (e) { /* ignora */ } } });
  }
  if (I) I.aoMudar(function () { if (document.getElementById('nbSkinOv')) openDialog(); post('skin'); });

  /* ---------- conversa com o Workspace ---------- */
  window.addEventListener('message', function (e) {
    if (!inFrame || e.source !== window.parent) return;
    var d = e.data;
    if (!d || typeof d !== 'object' || !d.nebulosa) return;
    if (d.nebulosa === 'set-skin') api.set(d.skin);
    else if (d.nebulosa === 'ping') post('hello');
    else if (d.nebulosa === 'open-skin') api.openDialog();
    else if (d.nebulosa === 'query-dirty') post('dirty', { dirty: isDirty() });
    else if (d.nebulosa === 'set-lang' && I) I.definir(d.idioma);
  });
  // Alt+0…9 e Alt+K são atalhos do Workspace
  window.addEventListener('keydown', function (e) {
    if (!inFrame || !e.altKey || e.ctrlKey || e.metaKey) return;
    if (!/^Digit[0-9]$/.test(e.code) && e.code !== 'KeyK') return;
    try { e.preventDefault(); e.stopPropagation(); window.parent.postMessage({ nebulosa: 'key', code: e.code }, '*'); } catch (_) { /* ignora */ }
  }, true);
  post('hello');
  document.addEventListener('DOMContentLoaded', function () { post('hello'); });

  /* ---------- identidade visual: assinatura e rodapé ---------- */
  (function () {
    var st = document.createElement('style');
    st.id = 'nbIdStyle';
    st.textContent =
      '.nb-by{display:inline-block;font-size:min(.6em,14px);font-weight:500;letter-spacing:.02em;opacity:.78;margin-left:.5em;white-space:nowrap;vertical-align:baseline;font-style:normal;text-transform:none;line-height:1.1}' +
      '.nb-by.nb-block{display:block;margin-left:0;margin-top:2px}' +
      '.nb-rodape{font-size:.92em;opacity:.85}';
    (document.head || document.documentElement).appendChild(st);
  })();

  /* ---------- contador de acessos (js/acessos.js) ---------- */
  // Só quando a ponte é um arquivo de verdade (no site ou no pacote). No HTML
  // único baixado separadamente a ponte vem embutida e não conta acessos.
  (function () {
    var src = me && me.src;
    if (!src || !/shared\/nebulosa-bridge\.js(\?|#|$)/.test(src)) return;
    var base = src.replace(/shared\/nebulosa-bridge\.js.*$/, '');
    window.NEBULOSA_ACESSO_PAGINA = APP;
    function carregar() {
      var s = document.createElement('script');
      s.src = base + 'js/acessos.js';
      s.async = true;
      (document.head || document.documentElement).appendChild(s);
    }
    if (document.readyState === 'complete') setTimeout(carregar, 400);
    else window.addEventListener('load', function () { setTimeout(carregar, 400); });
  })();

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
        '<b>' + esc(c.id === 'default' ? NAME + ' Default' : c.name) + '</b><span>' + esc(c.id === 'default' ? T('O visual original de {1}.', NAME) : T(c.desc)) + '</span></button>';
    }).join('');
    var m = api.getMode();
    var modeHtml = m ? '<div class="nbMode"><span>' + T('Modo') + '</span><div class="nbSeg">' +
      [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(function (x) {
        return '<button type="button" data-m="' + x[0] + '" class="' + (m === x[0] ? 'on' : '') + '">' + T(x[1]) + '</button>';
      }).join('') + '</div></div>' : '';
    var lg = I ? I.atual() : 'pt-BR';
    var idiHtml = I ? '<div class="nbMode"><span>' + T('Idioma') + '</span><div class="nbSeg" translate="no">' +
      I.lista.map(function (x) { return '<button type="button" data-lg="' + x.id + '" class="' + (lg === x.id ? 'on' : '') + '" title="' + esc(x.nome) + '">' + esc(x.nome) + '</button>'; }).join('') + '</div></div>' : '';
    var o = document.createElement('div');
    o.id = 'nbSkinOv';
    o.innerHTML = '<div class="nbBox" role="dialog" aria-modal="true" aria-label="' + T('Aparência') + '"><h3>' + T('Aparência') + '</h3>' +
      '<p>' + esc(T('Escolha o visual de {1}. A mudança vale só para este programa.', NAME)) + '</p>' +
      '<div class="nbCards">' + cards + '</div>' + modeHtml + idiHtml +
      '<div class="nbFoot"><button type="button" class="nbOk">' + T('Fechar') + '</button></div></div>';
    o.setAttribute('translate', 'no');
    o.addEventListener('mousedown', function (e) { if (e.target === o) closeDialog(); });
    o.addEventListener('click', function (e) {
      var c = e.target.closest('.nbCard'), b = e.target.closest('[data-m]'), lgb = e.target.closest('[data-lg]');
      if (lgb && I) { I.definir(lgb.getAttribute('data-lg')); if (inFrame) { try { window.parent.postMessage({ nebulosa: 'lang', app: APP, idioma: I.atual() }, '*'); } catch (x) { /* ignora */ } } return; }
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
