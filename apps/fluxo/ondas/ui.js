/* ==========================================================================
   Fluxo › Ondas — ui.js (1.1)
   O "Estúdio de ondas": tela cheia por cima do Fluxo, com a prévia, a lista de camadas,
   os ajustes, os efeitos e a exportação. Também monta o painelzinho da aba "Ondas".
   Funciona mesmo sem o Fluxo em volta (aí o vídeo só é baixado).
   ========================================================================== */
(function () {
  'use strict';
  var FO = window.FluxoOndas = window.FluxoOndas || {};
  var M = FO.motor;
  var CHAVE = 'nb.fluxo.ondas.cena';

  /* ---------------------------------------------------- listas de opções */
  var REAGE = [['tudo', 'Volume geral'], ['graves', 'Graves'], ['medios', 'Médios'], ['agudos', 'Agudos'], ['batida', 'Batidas']];
  var FAIXA = [['completa', 'Todas as frequências'], ['graves', 'Só graves'], ['medios', 'Só médios'], ['agudos', 'Só agudos']];
  var MISTURA = [['source-over', 'Normal'], ['lighter', 'Luz (soma as cores)'], ['screen', 'Clarear'], ['overlay', 'Sobrepor'], ['difference', 'Diferença'], ['multiply', 'Escurecer']];
  var FONTES = [['Inter, "Segoe UI", Arial, sans-serif', 'Moderna'], ['Georgia, "Times New Roman", serif', 'Com serifa'], ['"Courier New", monospace', 'Máquina de escrever'], ['Impact, "Arial Black", sans-serif', 'Impacto'], ['"Trebuchet MS", sans-serif', 'Humanista'], ['cursive', 'Manuscrita']];
  var FORMATOS = [['16:9', 1920, 1080, 'YouTube / TV'], ['9:16', 1080, 1920, 'TikTok / Reels / Shorts'], ['1:1', 1080, 1080, 'Quadrado'], ['4:5', 1080, 1350, 'Instagram retrato'], ['21:9', 2560, 1080, 'Ultrawide'], ['4:3', 1440, 1080, 'Clássico']];
  var DESC = {
    barras: 'Barras que sobem e descem com cada frequência.', linha: 'Uma linha que desenha a forma da onda ou o espectro.', circulo: 'Anel de barras, linha ou pontos em volta de um centro.',
    pontos: 'Colunas de pontinhos que acendem, como num aparelho de som.', aneis: 'Anéis de luz que se expandem a cada batida.', particulas: 'Faíscas, estrelas e poeira que nascem com o som.',
    texto: 'Título ou letra que pulsa e vibra com a música.', imagem: 'Logo ou capa que dá um pulinho nos graves.', progresso: 'Barra de progresso e tempo da música.'
  };

  /* Cada campo: [chave, rótulo, tipo, a, b, c, condição].  num: min, max, passo · sel: lista · pct: mostra em % */
  var COMUM_POS = [
    ['x', 'Posição horizontal', 'pct', 0, 1, 0.01], ['y', 'Posição vertical', 'pct', 0, 1, 0.01],
    ['escala', 'Tamanho geral', 'pct', 0.1, 3, 0.01], ['rotacao', 'Giro (graus)', 'num', -180, 180, 1],
    ['opacidade', 'Opacidade', 'pct', 0, 1, 0.01], ['mistura', 'Mistura com o fundo', 'sel', MISTURA]
  ];
  var ESPECIFICO = {
    barras: [
      ['n', 'Quantidade de barras', 'num', 4, 160, 1], ['larg', 'Espessura das barras', 'pct', 0.1, 1, 0.01], ['arred', 'Pontas arredondadas', 'pct', 0, 1, 0.01],
      ['altMax', 'Altura máxima', 'num', 40, 900, 1], ['minAlt', 'Altura mínima', 'num', 0, 80, 1], ['largTotal', 'Largura total', 'pct', 0.1, 1, 0.01],
      ['direcao', 'Crescem para', 'sel', [['baixo', 'Cima (a partir da base)'], ['centro', 'Os dois lados (centro)'], ['cima', 'Baixo (penduradas)']]],
      ['simetria', 'Simétrico (graves no meio)', 'chk'], ['faixa', 'Frequências usadas', 'sel', FAIXA], ['curva', 'Contraste', 'num', 0.5, 2.5, 0.05]
    ],
    linha: [
      ['modo', 'Mostrar', 'sel', [['onda', 'Forma da onda (osciloscópio)'], ['espectro', 'Espectro (frequências)']]], ['largTotal', 'Largura total', 'pct', 0.1, 1, 0.01],
      ['altMax', 'Altura da onda', 'num', 20, 900, 1], ['espessura', 'Espessura da linha', 'num', 1, 40, 0.5], ['pontos', 'Detalhe (pontos)', 'num', 24, 400, 1],
      ['suave', 'Curvas suaves', 'chk'], ['preencher', 'Preencher embaixo', 'chk'], ['espelho', 'Espelhar (cima e baixo)', 'chk'],
      ['faixa', 'Frequências usadas', 'sel', FAIXA, null, null, function (L) { return L.modo === 'espectro'; }]
    ],
    circulo: [
      ['n', 'Quantidade de barras', 'num', 12, 240, 1], ['raio', 'Raio do círculo', 'num', 40, 700, 1], ['altMax', 'Altura máxima', 'num', 10, 600, 1], ['minAlt', 'Altura mínima', 'num', 0, 60, 1],
      ['estilo', 'Estilo', 'sel', [['barras', 'Barras'], ['linha', 'Linha contínua'], ['pontos', 'Pontos']]], ['espessura', 'Espessura', 'num', 1, 30, 0.5],
      ['giro', 'Giro (graus por segundo)', 'num', -120, 120, 1], ['pulsoRaio', 'Pulso do raio', 'pct', 0, 0.6, 0.01],
      ['dentro', 'Crescem para dentro', 'chk'], ['preencher', 'Preencher o miolo', 'chk', null, null, null, function (L) { return L.estilo === 'linha'; }],
      ['faixa', 'Frequências usadas', 'sel', FAIXA], ['curva', 'Contraste', 'num', 0.5, 2.5, 0.05]
    ],
    pontos: [
      ['n', 'Colunas', 'num', 8, 120, 1], ['linhas', 'Linhas', 'num', 4, 30, 1], ['larg', 'Tamanho dos pontos', 'pct', 0.2, 1, 0.01],
      ['altMax', 'Altura total', 'num', 80, 900, 1], ['largTotal', 'Largura total', 'pct', 0.1, 1, 0.01], ['faixa', 'Frequências usadas', 'sel', FAIXA]
    ],
    aneis: [
      ['raio', 'Raio inicial', 'num', 10, 700, 1], ['velocidade', 'Velocidade de expansão', 'num', 100, 1800, 10], ['vida', 'Duração (segundos)', 'num', 0.3, 3, 0.05],
      ['espessura', 'Espessura', 'num', 1, 40, 0.5], ['base', 'Anel fixo que pulsa', 'chk']
    ],
    particulas: [
      ['emissor', 'De onde nascem', 'sel', [['centro', 'Do centro'], ['anel', 'De um anel'], ['baixo', 'Da parte de baixo'], ['tela', 'De qualquer lugar']]],
      ['raio', 'Raio do anel', 'num', 10, 700, 1, function (L) { return L.emissor === 'anel'; }],
      ['taxa', 'Quantidade por segundo', 'num', 0, 300, 1], ['rajada', 'Rajada a cada batida', 'num', 0, 150, 1], ['tamanho', 'Tamanho', 'num', 1, 40, 0.5],
      ['velocidade', 'Velocidade', 'num', 0, 700, 5], ['vida', 'Duração (segundos)', 'num', 0.5, 10, 0.1], ['gravidade', 'Gravidade (negativo sobe)', 'num', -300, 300, 5],
      ['forma', 'Formato', 'sel', [['circulo', 'Bolinha'], ['estrela', 'Estrela'], ['faisca', 'Faísca'], ['quadrado', 'Quadradinho']]], ['reagente', 'Quanto reage ao som', 'num', 0, 3, 0.05]
    ],
    texto: [
      ['texto', 'Texto', 'area'], ['fonte', 'Letra', 'sel', FONTES], ['tamanho', 'Tamanho', 'num', 12, 400, 1],
      ['peso', 'Espessura da letra', 'sel', [['400', 'Normal'], ['600', 'Semi-negrito'], ['800', 'Negrito'], ['900', 'Extra negrito']]],
      ['italico', 'Itálico', 'chk'], ['letra', 'Espaço entre letras', 'num', 0, 40, 0.5], ['contorno', 'Contorno', 'num', 0, 30, 0.5],
      ['pulsa', 'Pulsa no som', 'pct', 0, 0.6, 0.01], ['vibra', 'Vibra no som', 'num', 0, 4, 0.05]
    ],
    imagem: [
      ['arquivo', 'Imagem', 'img'], ['tamanho', 'Tamanho', 'num', 60, 1400, 1], ['circular', 'Recortar em círculo', 'chk'],
      ['arred', 'Cantos arredondados', 'pct', 0, 1, 0.01, function (L) { return !L.circular; }], ['borda', 'Borda', 'num', 0, 40, 0.5], ['pulsa', 'Pulsa no som', 'pct', 0, 0.6, 0.01]
    ],
    progresso: [
      ['estilo', 'Mostrar', 'sel', [['barra', 'Só a barra'], ['tempo', 'Só o tempo'], ['ambos', 'Barra e tempo']]], ['largTotal', 'Largura', 'pct', 0.1, 1, 0.01],
      ['espessura', 'Espessura da barra', 'num', 2, 40, 0.5], ['tamanho', 'Tamanho do tempo', 'num', 12, 120, 1]
    ]
  };
  var TEM_REAGE = { circulo: 1, aneis: 1, particulas: 1, texto: 1, imagem: 1 };
  var TEM_SUAVE = { barras: 1, linha: 1, circulo: 1, pontos: 1 };
  var COR_ROT = { texto: ['Cor do texto', 'Cor do contorno'], progresso: ['Cor da barra', 'Cor do fundo da barra'], imagem: ['Cor da borda', ''] };
  var SEM_GRAD = { texto: 1, imagem: 1, progresso: 1 };

  var FUNDO = [
    ['tipo', 'Tipo de fundo', 'sel', [['cor', 'Cor lisa'], ['gradiente', 'Degradê'], ['radial', 'Degradê circular'], ['imagem', 'Imagem']]],
    ['cor1', 'Cor', 'cor'], ['cor2', 'Segunda cor', 'cor', null, null, null, function (f) { return f.tipo === 'gradiente' || f.tipo === 'radial'; }],
    ['angulo', 'Ângulo do degradê', 'num', 0, 360, 1, function (f) { return f.tipo === 'gradiente'; }],
    ['imagem', 'Imagem de fundo', 'img', null, null, null, function (f) { return f.tipo === 'imagem'; }],
    ['escurecer', 'Escurecer a imagem', 'pct', 0, 0.9, 0.01, function (f) { return f.tipo === 'imagem'; }],
    ['desfoque', 'Desfocar a imagem', 'num', 0, 60, 1, function (f) { return f.tipo === 'imagem'; }],
    ['zoomBatida', 'Zoom da imagem nas batidas', 'pct', 0, 0.3, 0.01, function (f) { return f.tipo === 'imagem'; }]
  ];
  var EFEITOS = [
    ['vibracao', 'Vibração (a tela treme)', 'Treme a imagem toda no ritmo da música.', [['forca', 'Força (pixels)', 'num', 0, 60, 1], ['rot', 'Giro (graus)', 'num', 0, 4, 0.05], ['reage', 'Reage a', 'sel', REAGE]]],
    ['zoom', 'Pulso de zoom', 'A imagem aproxima e volta com o som.', [['forca', 'Força', 'pct', 0, 0.4, 0.01], ['reage', 'Reage a', 'sel', REAGE]]],
    ['rgb', 'Divisão de cores (RGB)', 'Separa vermelho, verde e azul, como um vídeo velho.', [['forca', 'Distância (pixels)', 'num', 0, 40, 0.5], ['reage', 'Reage a', 'sel', REAGE]]],
    ['glitch', 'Glitch', 'Faixas da imagem escorregam de lado a cada batida.', [['forca', 'Força', 'pct', 0, 1, 0.01]]],
    ['brilho', 'Brilho (bloom)', 'Um halo de luz em volta das partes claras.', [['forca', 'Força', 'pct', 0, 1.5, 0.01], ['raio', 'Espalhamento', 'num', 4, 80, 1]]],
    ['vinheta', 'Vinheta', 'Escurece os cantos.', [['forca', 'Força', 'pct', 0, 1, 0.01]]],
    ['granulado', 'Granulado de filme', 'Textura de grãos por cima de tudo.', [['forca', 'Força', 'pct', 0, 1, 0.01]]],
    ['flash', 'Flash nas batidas', 'A tela clareia a cada batida.', [['forca', 'Força', 'pct', 0, 0.8, 0.01], ['reage', 'Reage a', 'sel', REAGE]]]
  ];

  /* ------------------------------------------------------------ estado */
  var E = null;   /* estado do estúdio aberto (null = fechado) */

  function h(tag, at) {
    var e = document.createElement(tag), i, c;
    if (at) for (var k in at) {
      if (k === 'class') e.className = at[k];
      else if (k === 'text') e.textContent = at[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), at[k]);
      else if (at[k] !== null && at[k] !== undefined && at[k] !== false) e.setAttribute(k, at[k] === true ? '' : at[k]);
    }
    for (i = 2; i < arguments.length; i++) { c = arguments[i]; if (c == null || c === false) continue; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return e;
  }
  function aviso(txt, tipo) { if (FO.ponte && FO.ponte.aviso) FO.ponte.aviso(txt, tipo); else if (E && E.msg) { E.msg.textContent = txt; } }
  function mm(s) { s = Math.max(0, s); var m = Math.floor(s / 60), x = s - m * 60; return m + ':' + (x < 10 ? '0' : '') + x.toFixed(1); }
  function pad(s) { return (s < 10 ? '0' : '') + s; }

  /* grava a cena no navegador (sem imagens grandes) */
  var _t = 0;
  function mudou() {
    if (!E) return; E.sujo = true; clearTimeout(_t);
    _t = setTimeout(function () {
      try {
        var c = JSON.parse(JSON.stringify(E.cena));
        c.camadas.forEach(function (L) { if (L.arquivo && L.arquivo.length > 300000) L.arquivo = ''; });
        if (c.fundo.imagem && c.fundo.imagem.length > 300000) c.fundo.imagem = '';
        localStorage.setItem(CHAVE, JSON.stringify(c));
      } catch (e) { /* sem espaço ou bloqueado: tudo bem */ }
    }, 600);
  }
  function normalizar(c) {
    var base = M.cenaVazia(), k;
    c = c || {};
    var o = Object.assign({}, base, c);
    o.fundo = Object.assign({}, base.fundo, c.fundo || {});
    o.fx = {};
    for (k in base.fx) o.fx[k] = (typeof base.fx[k] === 'object') ? Object.assign({}, base.fx[k], (c.fx || {})[k] || {}) : ((c.fx || {})[k] !== undefined ? c.fx[k] : base.fx[k]);
    o.camadas = (c.camadas || []).filter(function (L) { return L && M.PADRAO[L.tipo]; }).map(function (L) {
      var n = M.novaCamada(L.tipo); n = Object.assign(n, L); if (!n.id) n.id = 'c' + Math.random().toString(36).slice(2, 8); return n;
    });
    return o;
  }

  /* ---------------------------------------------------------- controles */
  function ctrl(obj, def, refaz) {
    var k = def[0], rot = def[1], tipo = def[2], v = obj[k], campo, w;
    if (tipo === 'num' || tipo === 'pct') {
      var min = def[3], max = def[4], st = def[5], pc = tipo === 'pct';
      var fmt = function (x) { return pc ? Math.round(x * 100) : +(+x).toFixed(st < 1 ? 2 : 0); };
      var r = h('input', { type: 'range', min: min, max: max, step: st, value: v });
      var n = h('input', { type: 'number', min: pc ? min * 100 : min, max: pc ? max * 100 : max, step: pc ? Math.max(1, st * 100) : st, value: fmt(v) });
      r.addEventListener('input', function () { obj[k] = parseFloat(r.value); n.value = fmt(obj[k]); mudou(); });
      n.addEventListener('change', function () { var x = parseFloat(n.value); if (isNaN(x)) return; x = pc ? x / 100 : x; obj[k] = Math.max(min, Math.min(max, x)); r.value = obj[k]; n.value = fmt(obj[k]); mudou(); });
      return h('div', { class: 'nbo-f' }, h('span', { class: 'nbo-fl', text: rot }), h('div', { class: 'nbo-fc' }, r, n, h('em', { text: pc ? '%' : '' })));
    }
    if (tipo === 'sel') {
      var s = h('select');
      def[3].forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (String(o[0]) === String(v)) op.selected = true; s.appendChild(op); });
      s.addEventListener('change', function () { obj[k] = s.value; mudou(); if (refaz) refaz(); });
      return h('div', { class: 'nbo-f' }, h('span', { class: 'nbo-fl', text: rot }), h('div', { class: 'nbo-fc' }, s));
    }
    if (tipo === 'chk') {
      var cb = h('input', { type: 'checkbox' }); cb.checked = !!v;
      cb.addEventListener('change', function () { obj[k] = cb.checked; mudou(); if (refaz) refaz(); });
      return h('label', { class: 'nbo-f nbo-chk' }, cb, h('span', { text: rot }));
    }
    if (tipo === 'cor') {
      var ci = h('input', { type: 'color', value: v || '#ffffff' });
      ci.addEventListener('input', function () { obj[k] = ci.value; mudou(); });
      return h('div', { class: 'nbo-f' }, h('span', { class: 'nbo-fl', text: rot }), h('div', { class: 'nbo-fc' }, ci));
    }
    if (tipo === 'area') {
      var ta = h('textarea', { rows: 2 }); ta.value = v || '';
      ta.addEventListener('input', function () { obj[k] = ta.value; mudou(); });
      return h('div', { class: 'nbo-f' }, h('span', { class: 'nbo-fl', text: rot }), h('div', { class: 'nbo-fc' }, ta));
    }
    if (tipo === 'img') {
      var fi = h('input', { type: 'file', accept: 'image/*', class: 'nbo-oculto' });
      var nome = h('span', { class: 'nbo-nome', text: v ? 'Imagem escolhida' : 'Nenhuma imagem' });
      fi.addEventListener('change', function () {
        var f = fi.files && fi.files[0]; if (!f) return;
        var fr = new FileReader(); fr.onload = function () { obj[k] = fr.result; if (obj === E.cena.fundo) E.render.definirFundoImagem(fr.result); mudou(); if (refaz) refaz(); }; fr.readAsDataURL(f);
      });
      var bt = h('button', { class: 'nbo-b', type: 'button', onclick: function () { fi.click(); } }, 'Escolher imagem…');
      var lim = h('button', { class: 'nbo-b nbo-b2', type: 'button', onclick: function () { obj[k] = ''; if (obj === E.cena.fundo) E.render.definirFundoImagem(''); mudou(); if (refaz) refaz(); } }, 'Tirar');
      return h('div', { class: 'nbo-f' }, h('span', { class: 'nbo-fl', text: rot }), h('div', { class: 'nbo-fc nbo-fimg' }, bt, v ? lim : null, nome, fi));
    }
    return h('div');
  }
  function grupo(titulo, aberto) {
    var d = h('details', { class: 'nbo-g' }); if (aberto !== false) d.open = true;
    d.appendChild(h('summary', { text: titulo })); return d;
  }

  /* ---------------------------------------------------------- inspetor */
  function desenharInspetor() {
    var box = E.insp; box.textContent = '';
    if (E.aba === 'camada') return abaCamada(box);
    if (E.aba === 'fundo') return abaFundo(box);
    if (E.aba === 'efeitos') return abaEfeitos(box);
    return abaExportar(box);
  }
  function selecionada() { return E.cena.camadas.filter(function (L) { return L.id === E.sel; })[0]; }
  function abaCamada(box) {
    var L = selecionada();
    if (!L) { box.appendChild(h('p', { class: 'nbo-vazio', text: 'Escolha uma camada na lista da esquerda, ou adicione uma nova.' })); return; }
    var refaz = function () { var y = box.scrollTop; desenharInspetor(); box.scrollTop = y; };
    var nome = h('input', { type: 'text', value: L.nome, class: 'nbo-nomecamada', 'aria-label': 'Nome da camada' });
    nome.addEventListener('input', function () { L.nome = nome.value; var it = E.lista.querySelector('[data-id="' + L.id + '"] .nbo-ln'); if (it) it.textContent = L.nome; mudou(); });
    box.appendChild(h('div', { class: 'nbo-f' }, h('span', { class: 'nbo-fl', text: 'Nome' }), h('div', { class: 'nbo-fc' }, nome)));
    function lote(g, defs) { defs.forEach(function (d) { if (d[6] && !d[6](L)) return; g.appendChild(ctrl(L, d, refaz)); }); }
    var gE = grupo(M.NOMES[L.tipo]); lote(gE, ESPECIFICO[L.tipo]); box.appendChild(gE);
    var gC = grupo('Cor e brilho'), rot = COR_ROT[L.tipo] || ['Cor', 'Segunda cor'];
    gC.appendChild(ctrl(L, ['cor1', rot[0], 'cor']));
    if (!SEM_GRAD[L.tipo]) gC.appendChild(ctrl(L, ['grad', 'Usar degradê', 'chk'], refaz));
    if ((L.grad && !SEM_GRAD[L.tipo]) || L.tipo === 'texto' || L.tipo === 'progresso') gC.appendChild(ctrl(L, ['cor2', rot[1] || 'Segunda cor', 'cor']));
    if (L.tipo !== 'imagem') gC.appendChild(ctrl(L, ['brilho', 'Brilho em volta', 'num', 0, 80, 1]));
    box.appendChild(gC);
    if (TEM_REAGE[L.tipo] || TEM_SUAVE[L.tipo]) {
      var gS = grupo('Reação ao som');
      if (TEM_REAGE[L.tipo]) gS.appendChild(ctrl(L, ['reage', 'Reage a', 'sel', REAGE]));
      gS.appendChild(ctrl(L, ['ganho', 'Sensibilidade', 'pct', 0.1, 3, 0.01]));
      if (TEM_SUAVE[L.tipo]) gS.appendChild(ctrl(L, ['suavizacao', 'Suavidade do movimento', 'pct', 0, 1, 0.01]));
      box.appendChild(gS);
    }
    var gP = grupo('Posição e mistura', false); lote(gP, COMUM_POS); box.appendChild(gP);
  }
  function abaFundo(box) {
    var refaz = function () { var y = box.scrollTop; desenharInspetor(); box.scrollTop = y; }, f = E.cena.fundo;
    var g = grupo('Fundo'); FUNDO.forEach(function (d) { if (d[6] && !d[6](f)) return; g.appendChild(ctrl(f, d, refaz)); }); box.appendChild(g);
    var g2 = grupo('Formato do vídeo');
    var cur = FORMATOS.filter(function (x) { return x[1] === E.cena.larg && x[2] === E.cena.alt; })[0];
    var sel = h('select');
    FORMATOS.forEach(function (x) { var o = h('option', { value: x[0], text: x[0] + ' · ' + x[3] }); if (cur && cur[0] === x[0]) o.selected = true; sel.appendChild(o); });
    sel.addEventListener('change', function () { var x = FORMATOS.filter(function (y) { return y[0] === sel.value; })[0]; E.cena.larg = x[1]; E.cena.alt = x[2]; ajustarTela(); mudou(); });
    g2.appendChild(h('div', { class: 'nbo-f' }, h('span', { class: 'nbo-fl', text: 'Proporção' }), h('div', { class: 'nbo-fc' }, sel)));
    g2.appendChild(h('p', { class: 'nbo-dica', text: 'Dica: o Fluxo também tem o formato do projeto. Use a mesma proporção nos dois para o vídeo encaixar sem bordas.' }));
    box.appendChild(g2);
  }
  function abaEfeitos(box) {
    var refaz = function () { var y = box.scrollTop; desenharInspetor(); box.scrollTop = y; }, fx = E.cena.fx;
    box.appendChild(h('p', { class: 'nbo-dica', text: 'Efeitos de tela cheia: valem para a cena inteira, por cima de todas as camadas.' }));
    EFEITOS.forEach(function (d) {
      var o = fx[d[0]], g = h('div', { class: 'nbo-ef' + (o.on ? ' nbo-ef-on' : '') });
      var cb = h('input', { type: 'checkbox' }); cb.checked = !!o.on;
      cb.addEventListener('change', function () { o.on = cb.checked; mudou(); refaz(); });
      g.appendChild(h('label', { class: 'nbo-efh' }, cb, h('b', { text: d[1] })));
      g.appendChild(h('small', { text: d[2] }));
      if (o.on) d[3].forEach(function (c) { g.appendChild(ctrl(o, c, null)); });
      box.appendChild(g);
    });
    var g2 = grupo('Cena inteira');
    g2.appendChild(ctrl(fx, ['espelho', 'Espelho', 'sel', [['nenhum', 'Sem espelho'], ['h', 'Esquerda para a direita'], ['v', 'Em cima para embaixo'], ['quad', 'Os quatro cantos']]], null));
    g2.appendChild(ctrl(fx, ['matiz', 'Giro de cores (graus por segundo)', 'num', 0, 120, 1], null));
    box.appendChild(g2);
  }

  /* --------------------------------------------------------- exportação */
  function tamanhoSaida() {
    var c = E.cena, curto = E.exp.res, fator = curto / Math.min(c.larg, c.alt);
    return { W: Math.round(c.larg * fator / 2) * 2, H: Math.round(c.alt * fator / 2) * 2 };
  }
  function abaExportar(box) {
    var x = E.exp, refaz = function () { var y = box.scrollTop; desenharInspetor(); box.scrollTop = y; };
    if (!E.buf) { box.appendChild(h('p', { class: 'nbo-vazio', text: 'Abra uma música primeiro (botão "Abrir áudio", lá em cima).' })); return; }
    var g = grupo('Qualidade');
    g.appendChild(ctrl(x, ['res', 'Resolução (lado menor)', 'sel', [[480, '480p · rápido'], [720, '720p · HD'], [1080, '1080p · Full HD'], [1440, '1440p · 2K']]], refaz));
    g.appendChild(ctrl(x, ['fps', 'Quadros por segundo', 'sel', [[24, '24 · cinema'], [30, '30 · padrão'], [60, '60 · bem fluido']]], refaz));
    g.appendChild(ctrl(x, ['codec', 'Compressão', 'sel', [['vp9', 'VP9 · arquivo menor'], ['vp8', 'VP8 · mais rápido']]], null));
    g.appendChild(ctrl(x, ['qual', 'Qualidade da imagem', 'sel', [['boa', 'Boa'], ['alta', 'Alta'], ['maxima', 'Máxima']]], null));
    var t = tamanhoSaida(); g.appendChild(h('p', { class: 'nbo-dica' }, h('span', { text: 'Saída' }), ': ', h('b', { text: t.W + ' × ' + t.H }), ' · ', h('span', { text: 'WebM com som' })));
    box.appendChild(g);
    var g2 = grupo('Trecho');
    var dur = E.buf.duration, ini = x.inicio, fim = x.fim || dur;
    g2.appendChild(h('p', { class: 'nbo-dica' }, h('span', { text: 'Do' }), ' ', h('b', { text: mm(ini) }), ' ', h('span', { text: 'ao' }), ' ', h('b', { text: mm(fim) }), ' (' + mm(fim - ini) + ')'));
    g2.appendChild(h('div', { class: 'nbo-bt' },
      h('button', { class: 'nbo-b', type: 'button', onclick: function () { x.inicio = Math.min(E.t, (x.fim || dur) - 0.5); if (x.inicio < 0) x.inicio = 0; refaz(); desenharLinha(); } }, 'Começar aqui'),
      h('button', { class: 'nbo-b', type: 'button', onclick: function () { x.fim = Math.max(E.t, x.inicio + 0.5); refaz(); desenharLinha(); } }, 'Terminar aqui'),
      h('button', { class: 'nbo-b nbo-b2', type: 'button', onclick: function () { x.inicio = 0; x.fim = 0; refaz(); desenharLinha(); } }, 'Música inteira')));
    box.appendChild(g2);
    var g3 = grupo('Destino');
    g3.appendChild(ctrl(x, ['audio', 'Incluir o som da música', 'chk'], null));
    if (FO.ponte) g3.appendChild(ctrl(x, ['adicionar', 'Colocar na linha do tempo do Fluxo', 'chk'], null));
    box.appendChild(g3);
    var estado = h('div', { class: 'nbo-prog' });
    E.progBox = estado; box.appendChild(estado); desenharProgresso();
  }
  function desenharProgresso() {
    var b = E.progBox; if (!b || !b.isConnected) return; b.textContent = '';
    if (E.exportando) {
      b.appendChild(h('div', { class: 'nbo-barra' }, h('i', { style: 'width:' + Math.round(E.frac * 100) + '%' })));
      b.appendChild(h('p', { class: 'nbo-dica' }, h('span', { text: 'Gerando o vídeo' }), ' ', h('b', { text: Math.round(E.frac * 100) + '%' }), ' · ', h('span', { text: E.detalhe || '' })));
      b.appendChild(h('button', { class: 'nbo-b nbo-b2', type: 'button', onclick: function () { E.cancelar = true; } }, 'Cancelar'));
      return;
    }
    b.appendChild(h('button', { class: 'nbo-b nbo-go', type: 'button', onclick: exportar }, 'Gerar vídeo'));
    if (!FO.suportaWebCodecs()) b.appendChild(h('p', { class: 'nbo-dica', text: 'Este navegador não tem gravação rápida: o vídeo será gravado em tempo real (leva o tempo da música) e precisa ficar com esta aba aberta.' }));
    if (E.erro) b.appendChild(h('p', { class: 'nbo-erro' }, h('span', { text: E.erro }), E.erroDet ? ': ' + E.erroDet : ''));
    if (E.resultado) {
      var r = E.resultado, v = h('video', { controls: true, src: r.url, class: 'nbo-vid' });
      b.appendChild(h('div', { class: 'nbo-ok' }, h('b', { text: 'Pronto!' }), ' ', h('span', { text: r.adicionado ? 'O vídeo foi para a linha do tempo.' : 'O vídeo está pronto.' }), v,
        h('div', { class: 'nbo-bt' },
          h('a', { class: 'nbo-b', href: r.url, download: r.nome }, h('span', { text: 'Baixar' }), '\u00a0(' + (r.blob.size / 1048576).toFixed(1) + ' MB)'),
          FO.ponte && !r.adicionado ? h('button', { class: 'nbo-b', type: 'button', onclick: function () { FO.ponte.importar([r.arquivo], true).then(function () { r.adicionado = true; FO.ponte.aviso('Vídeo de ondas adicionado à linha do tempo.', 'ok'); desenharProgresso(); }); } }, 'Colocar no Fluxo') : null)));
    }
  }
  async function exportar() {
    if (E.exportando || !E.buf) return;
    parar(); E.exportando = true; E.cancelar = false; E.erro = ''; E.erroDet = ''; E.frac = 0; E.detalhe = '';
    if (E.resultado) { URL.revokeObjectURL(E.resultado.url); E.resultado = null; }
    desenharProgresso();
    var x = E.exp, t = tamanhoSaida(), bpp = { boa: 0.07, alta: 0.12, maxima: 0.2 }[x.qual] || 0.12;
    var opc = { larg: t.W, alt: t.H, fps: +x.fps, codec: x.codec, bitrate: Math.round(t.W * t.H * x.fps * bpp), inicio: x.inicio, fim: x.fim || E.buf.duration, audio: x.audio };
    var cb = { progresso: function (f, d) { E.frac = f; E.detalhe = d; var b = E.progBox; if (b && b.isConnected) { var i = b.querySelector('.nbo-barra i'), bb = b.querySelector('b'); if (i) i.style.width = Math.round(f * 100) + '%'; if (bb) bb.textContent = Math.round(f * 100) + '%'; } }, cancelado: function () { return E.cancelar; } };
    try {
      var blob = FO.suportaWebCodecs() ? await FO.exportarWebCodecs(E.cena, E.buf, E.an, opc, cb) : await FO.exportarGravador(E.cena, E.buf, E.an, opc, cb);
      var nome = (E.nome || 'musica').replace(/\.[^.]+$/, '').replace(/[^\w\-áàâãéêíóôõúç ]/gi, '').trim().replace(/\s+/g, '-') + '-ondas.webm';
      var arq = new File([blob], nome, { type: 'video/webm' });
      E.resultado = { blob: blob, arquivo: arq, nome: nome, url: URL.createObjectURL(blob), adicionado: false };
      if (FO.ponte && x.adicionar) { await FO.ponte.importar([arq], true); E.resultado.adicionado = true; FO.ponte.aviso('Vídeo de ondas adicionado à linha do tempo.', 'ok'); }
    } catch (e) {
      E.erroDet = ''; if (e && e.message === 'cancelado') E.erro = 'Exportação cancelada.'; else { E.erro = 'Não consegui gerar o vídeo'; E.erroDet = String(e && e.message ? e.message : e); }
    }
    E.exportando = false; E.an.reiniciar(); E.render.reiniciar(); E.sujo = true; desenharProgresso();
  }

  /* ------------------------------------------------------------- áudio */
  function pegarCtx() { if (!E.ac) E.ac = new (window.AudioContext || window.webkitAudioContext)(); return E.ac; }
  function tocar() {
    if (!E.buf || E.exportando) return;
    var ac = pegarCtx(); if (ac.state === 'suspended') ac.resume();
    if (E.t >= E.buf.duration - 0.05) E.t = 0;
    E.src = ac.createBufferSource(); E.src.buffer = E.buf; E.src.connect(ac.destination);
    E.src.onended = function () { };
    E.src.start(0, E.t); E.inicioCtx = ac.currentTime - E.t; E.tocando = true; atualizarBotao();
  }
  function parar() {
    if (E.tocando && E.src) { try { E.src.onended = null; E.src.stop(); } catch (e) { } E.src = null; }
    if (E.tocando) E.t = Math.min(E.buf.duration, E.ac.currentTime - E.inicioCtx);
    E.tocando = false; atualizarBotao();
  }
  function ir(t) {
    if (!E.buf) return; var era = E.tocando; if (era) parar();
    E.t = Math.max(0, Math.min(E.buf.duration, t));
    if (Math.abs(E.t - E.an.t) > 0.3) { E.an.reiniciar(); E.render.reiniciar(); }
    E.sujo = true; if (era) tocar(); desenharLinha();
  }
  function atualizarBotao() { if (E && E.bPlay) { E.bPlay.textContent = E.tocando ? '⏸' : '▶'; E.bPlay.setAttribute('aria-label', E.tocando ? 'Pausar' : 'Tocar'); } }

  async function carregarAudio(blob, nome) {
    if (E.exportando) return;
    E.msg.textContent = 'Lendo o áudio…'; parar();
    try {
      var ab = await blob.arrayBuffer(), ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 44100, 44100);
      var buf = await ctx.decodeAudioData(ab);
      E.buf = buf; E.nome = nome || blob.name || 'musica'; E.an = new M.Analise(buf); E.t = 0; E.exp.inicio = 0; E.exp.fim = 0;
      /* picos para a faixa do tempo */
      var d = buf.getChannelData(0), cols = 900, pk = new Float32Array(cols), passo = Math.max(1, Math.floor(d.length / cols));
      for (var i = 0; i < cols; i++) { var mx = 0, a = i * passo, b = Math.min(d.length, a + passo); for (var j = a; j < b; j += 5) { var v = Math.abs(d[j]); if (v > mx) mx = v; } pk[i] = mx; }
      var gm = 0; for (i = 0; i < cols; i++) if (pk[i] > gm) gm = pk[i]; if (gm > 0) for (i = 0; i < cols; i++) pk[i] /= gm;
      E.picos = pk; E.nomeEl.textContent = E.nome; E.msg.textContent = ''; E.sujo = true; desenharLinha(); desenharInspetor();
    } catch (e) { E.msg.textContent = 'Não consegui ler esse arquivo de áudio. Tente MP3, WAV, OGG, FLAC ou M4A.'; }
  }

  /* -------------------------------------------------------------- tela */
  function ajustarTela() {
    var c = E.cena, f = 960 / Math.max(c.larg, c.alt);
    E.cv.width = Math.round(c.larg * f); E.cv.height = Math.round(c.alt * f); E.sujo = true;
  }
  function desenharLinha() {
    if (!E || !E.lin) return; var cv = E.lin, w = cv.clientWidth || 600, hh = 52, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, hh);
    var cs = getComputedStyle(E.ov), ac = cs.getPropertyValue('--nbo-acc') || '#a778ff', mu = cs.getPropertyValue('--nbo-mut') || '#777';
    if (!E.buf) { c.fillStyle = mu; c.globalAlpha = 0.5; c.font = '12px sans-serif'; c.fillText('Abra uma música para ver a onda aqui', 10, hh / 2 + 4); c.globalAlpha = 1; return; }
    var dur = E.buf.duration, x = E.exp, ini = x.inicio / dur * w, fim = (x.fim || dur) / dur * w;
    c.fillStyle = ac; c.globalAlpha = 0.14; c.fillRect(ini, 0, fim - ini, hh); c.globalAlpha = 1;
    var pk = E.picos, n = pk.length;
    for (var i = 0; i < w; i += 2) { var p = pk[Math.min(n - 1, Math.floor(i / w * n))], bh = Math.max(1, p * (hh - 8)); c.fillStyle = (i >= ini && i <= fim) ? ac : mu; c.globalAlpha = (i >= ini && i <= fim) ? 0.9 : 0.5; c.fillRect(i, (hh - bh) / 2, 1.4, bh); }
    c.globalAlpha = 1; var px = E.t / dur * w; c.fillStyle = '#fff'; c.fillRect(px - 1, 0, 2, hh);
    c.fillStyle = ac; c.fillRect(ini, 0, 2, hh); c.fillRect(fim - 2, 0, 2, hh);
  }

  function laco(agora) {
    if (!E) return; E.raf = requestAnimationFrame(laco);
    if (E.exportando) { if (E.tempoEl) E.tempoEl.textContent = ''; return; }
    var dtTela = Math.min(0.05, Math.max(0.001, (agora - (E.ultimo || agora)) / 1000)); E.ultimo = agora;
    if (E.tocando) {
      var t = E.ac.currentTime - E.inicioCtx;
      if (t >= E.buf.duration) { E.t = E.buf.duration; E.tocando = false; E.src = null; atualizarBotao(); }
      else E.t = t;
      E.sujo = true;
    }
    if (E.sujo && E.an) {
      E.sujo = false;
      var dtA = E.tocando ? clampDt(E.t - E.an.t) : 1 / 30;
      E.an.passo(E.t, dtA);
      E.render.desenhar(E.ctx, E.cena, E.an, { W: E.cv.width, H: E.cv.height, t: E.t, dt: E.tocando ? dtTela : 1 / 30, dur: E.buf ? E.buf.duration : 1 });
      E.tempoEl.textContent = mm(E.t) + ' / ' + mm(E.buf.duration); desenharLinha();
    } else if (!E.an) {
      /* sem música: um desenho de exemplo para a cena não ficar vazia */
      E.render.desenhar(E.ctx, E.cena, FO.analiseFalsa(agora / 1000), { W: E.cv.width, H: E.cv.height, t: agora / 1000, dt: dtTela, dur: 60 });
    }
  }
  function clampDt(d) { return d > 0 && d < 0.5 ? d : 1 / 60; }

  /* Sem música: finge um áudio animado só para a prévia (demonstração). */
  FO.analiseFalsa = function (t) {
    var an = FO._falsa;
    if (!an) {
      an = FO._falsa = { bruto: new Float32Array(128), onda: new Float32Array(512), graves: 0, medios: 0, agudos: 0, volume: 0, pulso: 0, pulsoNovo: false, t: 0, _p: 0 };
      an.banda = M.Analise.prototype.banda; an.nivel = M.Analise.prototype.nivel;
    }
    var i, bt = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.9)), 6);
    for (i = 0; i < 128; i++) an.bruto[i] = M.clamp(0.18 + 0.5 * Math.abs(Math.sin(t * 2.1 + i * 0.37)) * Math.exp(-i / 90) + 0.35 * bt * Math.exp(-i / 18) + 0.15 * Math.abs(Math.sin(t * 5 + i)), 0, 1);
    for (i = 0; i < 512; i++) an.onda[i] = Math.sin(i / 512 * Math.PI * 8 + t * 6) * (0.25 + 0.4 * bt) + Math.sin(i / 512 * Math.PI * 22 + t * 3) * 0.12;
    an.graves = 0.2 + 0.6 * bt; an.medios = 0.3 + 0.2 * Math.abs(Math.sin(t * 3)); an.agudos = 0.2 + 0.2 * Math.abs(Math.sin(t * 7)); an.volume = 0.3 + 0.3 * bt;
    an.pulsoNovo = bt > 0.9 && an._p <= 0.9; an._p = bt; an.pulso = bt; an.t = t;
    return an;
  };

  /* ------------------------------------------------------ montar a tela */
  function addCamada(tipo) {
    var L = M.novaCamada(tipo); E.cena.camadas.push(L); E.sel = L.id; E.aba = 'camada'; desenharLista(); desenharAbas(); desenharInspetor(); mudou();
  }
  function desenharLista() {
    var ul = E.lista; ul.textContent = '';
    var cs = E.cena.camadas;
    for (var i = cs.length - 1; i >= 0; i--) (function (L, i) {
      var li = h('li', { class: 'nbo-li' + (L.id === E.sel ? ' nbo-sel' : ''), 'data-id': L.id, tabindex: 0 });
      var olho = h('button', { class: 'nbo-ic' + (L.visivel ? '' : ' nbo-off'), type: 'button', title: L.visivel ? 'Esconder camada' : 'Mostrar camada', 'aria-label': 'Mostrar ou esconder', onclick: function (ev) { ev.stopPropagation(); L.visivel = !L.visivel; desenharLista(); mudou(); } }, L.visivel ? '●' : '○');
      var nm = h('span', { class: 'nbo-ln', text: L.nome }), tp = h('small', { text: M.NOMES[L.tipo] });
      var acoes = h('span', { class: 'nbo-la' },
        h('button', { class: 'nbo-ic', type: 'button', title: 'Subir (fica na frente)', 'aria-label': 'Subir', disabled: i === cs.length - 1, onclick: function (ev) { ev.stopPropagation(); mover(i, 1); } }, '▲'),
        h('button', { class: 'nbo-ic', type: 'button', title: 'Descer (vai para trás)', 'aria-label': 'Descer', disabled: i === 0, onclick: function (ev) { ev.stopPropagation(); mover(i, -1); } }, '▼'),
        h('button', { class: 'nbo-ic', type: 'button', title: 'Duplicar', 'aria-label': 'Duplicar', onclick: function (ev) { ev.stopPropagation(); dup(L); } }, '⧉'),
        h('button', { class: 'nbo-ic', type: 'button', title: 'Apagar', 'aria-label': 'Apagar', onclick: function (ev) { ev.stopPropagation(); apagar(L); } }, '✕'));
      li.appendChild(olho); li.appendChild(h('span', { class: 'nbo-lt' }, nm, tp)); li.appendChild(acoes);
      li.addEventListener('click', function () { E.sel = L.id; E.aba = 'camada'; desenharLista(); desenharAbas(); desenharInspetor(); });
      ul.appendChild(li);
    })(cs[i], i);
    if (!cs.length) ul.appendChild(h('li', { class: 'nbo-vazio', text: 'Nenhuma camada. Adicione a primeira!' }));
  }
  function mover(i, d) { var cs = E.cena.camadas, j = i + d; if (j < 0 || j >= cs.length) return; var t = cs[i]; cs[i] = cs[j]; cs[j] = t; desenharLista(); mudou(); }
  function dup(L) { var c = JSON.parse(JSON.stringify(L)); c.id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); c.nome += ' (cópia)'; c.x = Math.min(1, c.x + 0.03); E.cena.camadas.push(c); E.sel = c.id; desenharLista(); desenharInspetor(); mudou(); }
  function apagar(L) { E.cena.camadas = E.cena.camadas.filter(function (x) { return x !== L; }); if (E.sel === L.id) E.sel = (E.cena.camadas[E.cena.camadas.length - 1] || {}).id; delete E.render.est[L.id]; desenharLista(); desenharInspetor(); mudou(); }

  function menuAdicionar(ev) {
    var m = E.menu; m.textContent = '';
    M.TIPOS.forEach(function (t) {
      m.appendChild(h('button', { class: 'nbo-mi', type: 'button', onclick: function () { m.hidden = true; addCamada(t); } }, h('b', { text: M.NOMES[t] }), h('small', { text: DESC[t] })));
    });
    m.hidden = !m.hidden; ev.stopPropagation();
  }
  function abrirModelos() {
    var d = E.dlg; d.textContent = '';
    var cx = h('div', { class: 'nbo-dl' }, h('h3', { text: 'Modelos prontos' }), h('p', { class: 'nbo-dica', text: 'Escolha um para começar. Isso troca as camadas e os efeitos atuais (a música continua).' }));
    var gr = h('div', { class: 'nbo-grade' });
    FO.MODELOS.forEach(function (m) {
      gr.appendChild(h('button', { class: 'nbo-cartao', type: 'button', onclick: function () { aplicarModelo(m.id); d.hidden = true; } }, h('b', { text: m.nome }), h('small', { text: m.desc })));
    });
    cx.appendChild(gr); cx.appendChild(h('div', { class: 'nbo-bt' }, h('button', { class: 'nbo-b nbo-b2', type: 'button', onclick: function () { d.hidden = true; } }, 'Fechar')));
    d.appendChild(cx); d.hidden = false;
  }
  function aplicarModelo(id) {
    var m = FO.MODELOS.filter(function (x) { return x.id === id; })[0]; if (!m) return;
    E.cena = m.cena(); E.render = new M.Render(); E.sel = (E.cena.camadas[0] || {}).id; E.render.definirFundoImagem('');
    ajustarTela(); desenharLista(); desenharInspetor(); mudou();
  }
  function desenharAbas() {
    var ab = E.abas; ab.textContent = '';
    [['camada', 'Camada'], ['fundo', 'Fundo'], ['efeitos', 'Efeitos'], ['exportar', 'Exportar']].forEach(function (a) {
      ab.appendChild(h('button', { class: 'nbo-aba' + (E.aba === a[0] ? ' nbo-sel' : ''), type: 'button', role: 'tab', 'aria-selected': E.aba === a[0] ? 'true' : 'false', onclick: function () { E.aba = a[0]; desenharAbas(); desenharInspetor(); } }, a[1]));
    });
  }

  function salvarArquivo() {
    var j = JSON.stringify({ nebulosa: 'fluxo-ondas', versao: 1, cena: E.cena }, null, 1), a = h('a', { href: URL.createObjectURL(new Blob([j], { type: 'application/json' })), download: 'cena.ondas.json' });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function abrirCena(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var o = JSON.parse(fr.result); if (!o || !o.cena) throw 0;
        E.cena = normalizar(o.cena); E.render = new M.Render(); E.render.definirFundoImagem(E.cena.fundo.tipo === 'imagem' ? E.cena.fundo.imagem : '');
        E.sel = (E.cena.camadas[0] || {}).id; ajustarTela(); desenharLista(); desenharInspetor(); mudou();
      } catch (e) { E.msg.textContent = 'Esse arquivo não é uma cena de ondas válida.'; }
    };
    fr.readAsText(file);
  }

  function fechar() {
    if (!E) return;
    if (E.exportando && !confirm('O vídeo ainda está sendo gerado. Cancelar e sair?')) return;
    E.cancelar = true; parar(); cancelAnimationFrame(E.raf);
    if (E.ac) { try { E.ac.close(); } catch (e) { } }
    if (E.resultado) URL.revokeObjectURL(E.resultado.url);
    document.removeEventListener('keydown', E.tecla, true);
    E.ov.remove(); document.documentElement.classList.remove('nbo-aberto'); E = null;
  }

  FO.abrir = function (opc) {
    opc = opc || {};
    if (E) { if (opc.audio) carregarAudio(opc.audio.blob, opc.audio.nome); if (opc.modelo) aplicarModelo(opc.modelo); return; }
    var cena;
    try { var salvo = localStorage.getItem(CHAVE); if (salvo && !opc.modelo) cena = normalizar(JSON.parse(salvo)); } catch (e) { }
    if (!cena || !cena.camadas.length) { cena = FO.MODELOS[0].cena(); }
    if (opc.modelo) { var mo = FO.MODELOS.filter(function (x) { return x.id === opc.modelo; })[0]; if (mo) cena = mo.cena(); }
    E = { cena: cena, render: new M.Render(), an: null, buf: null, t: 0, tocando: false, aba: 'camada', sel: (cena.camadas[0] || {}).id, sujo: true, exportando: false, frac: 0,
      exp: { res: 1080, fps: 30, codec: 'vp9', qual: 'alta', inicio: 0, fim: 0, audio: true, adicionar: true } };
    E.render.definirFundoImagem(cena.fundo.tipo === 'imagem' ? cena.fundo.imagem : '');
    var ov = E.ov = h('div', { class: 'nbo', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Estúdio de ondas' });
    var fileIn = h('input', { type: 'file', accept: 'audio/*,video/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus', class: 'nbo-oculto' });
    fileIn.addEventListener('change', function () { if (fileIn.files[0]) carregarAudio(fileIn.files[0], fileIn.files[0].name); fileIn.value = ''; });
    var cenaIn = h('input', { type: 'file', accept: '.json,application/json', class: 'nbo-oculto' });
    cenaIn.addEventListener('change', function () { if (cenaIn.files[0]) abrirCena(cenaIn.files[0]); cenaIn.value = ''; });
    E.nomeEl = h('span', { class: 'nbo-musica', text: 'Nenhuma música' }); E.msg = h('span', { class: 'nbo-msg', role: 'status' });
    var topo = h('header', { class: 'nbo-topo' },
      h('b', { class: 'nbo-tit', text: 'Ondas' }), h('span', { class: 'nbo-sub', text: 'estúdio de áudio em vídeo' }),
      h('button', { class: 'nbo-b nbo-go', type: 'button', onclick: function () { fileIn.click(); } }, 'Abrir áudio'), E.nomeEl, E.msg,
      h('span', { class: 'nbo-sp' }),
      h('button', { class: 'nbo-b', type: 'button', onclick: abrirModelos }, 'Modelos'),
      h('button', { class: 'nbo-b', type: 'button', onclick: salvarArquivo }, 'Salvar cena'),
      h('button', { class: 'nbo-b', type: 'button', onclick: function () { cenaIn.click(); } }, 'Abrir cena'),
      h('button', { class: 'nbo-b nbo-fechar', type: 'button', 'aria-label': 'Fechar o estúdio', onclick: fechar }, '✕'), fileIn, cenaIn);
    /* esquerda */
    E.lista = h('ul', { class: 'nbo-lista' }); E.menu = h('div', { class: 'nbo-menu', hidden: true });
    var esq = h('aside', { class: 'nbo-esq' }, h('div', { class: 'nbo-eh' }, h('b', { text: 'Camadas' }), h('button', { class: 'nbo-b nbo-go', type: 'button', onclick: menuAdicionar }, '+ Adicionar')), E.menu, E.lista,
      h('p', { class: 'nbo-dica', text: 'A de cima fica na frente. O fundo e os efeitos ficam nas abas ao lado.' }));
    /* centro */
    E.cv = h('canvas', { class: 'nbo-cv', 'aria-label': 'Prévia do vídeo' }); E.ctx = E.cv.getContext('2d'); ajustarTela();
    E.bPlay = h('button', { class: 'nbo-play', type: 'button', onclick: function () { if (E.tocando) parar(); else tocar(); } }, '▶');
    E.tempoEl = h('span', { class: 'nbo-tempo', text: '0:00.0 / 0:00.0' });
    E.lin = h('canvas', { class: 'nbo-lin', 'aria-label': 'Linha do tempo da música' });
    var arr = false;
    var seek = function (ev) { if (!E.buf) return; var r = E.lin.getBoundingClientRect(); ir((ev.clientX - r.left) / r.width * E.buf.duration); };
    E.lin.addEventListener('pointerdown', function (ev) { arr = true; E.lin.setPointerCapture(ev.pointerId); seek(ev); });
    E.lin.addEventListener('pointermove', function (ev) { if (arr) seek(ev); });
    E.lin.addEventListener('pointerup', function () { arr = false; });
    var cen = h('main', { class: 'nbo-cen' }, h('div', { class: 'nbo-prev' }, E.cv),
      h('div', { class: 'nbo-tr' }, h('button', { class: 'nbo-ic nbo-ic2', type: 'button', 'aria-label': 'Voltar ao começo', onclick: function () { ir(0); } }, '⏮'), E.bPlay, E.tempoEl, E.lin));
    /* direita */
    E.abas = h('div', { class: 'nbo-abas', role: 'tablist' }); E.insp = h('div', { class: 'nbo-insp' });
    var dir = h('aside', { class: 'nbo-dir' }, E.abas, E.insp);
    E.dlg = h('div', { class: 'nbo-modal', hidden: true });
    ov.appendChild(topo); ov.appendChild(h('div', { class: 'nbo-corpo' }, esq, cen, dir)); ov.appendChild(E.dlg);
    ov.addEventListener('click', function () { if (E) E.menu.hidden = true; });
    E.dlg.addEventListener('click', function (ev) { if (ev.target === E.dlg) E.dlg.hidden = true; });
    /* arrastar música para dentro */
    ov.addEventListener('dragover', function (ev) { ev.preventDefault(); });
    ov.addEventListener('drop', function (ev) { ev.preventDefault(); var f = ev.dataTransfer && ev.dataTransfer.files[0]; if (f) carregarAudio(f, f.name); });
    /* o Fluxo tem atalhos de teclado: aqui dentro eles não podem disparar */
    E.tecla = function (ev) {
      if (!E || !E.ov.contains(ev.target) && ev.target !== document.body) return;
      ev.stopPropagation();
      if (ev.type !== 'keydown') return;
      var tag = (ev.target.tagName || '').toLowerCase();
      if (ev.key === 'Escape') { if (!E.dlg.hidden) E.dlg.hidden = true; else fechar(); ev.preventDefault(); }
      else if (ev.key === ' ' && tag !== 'input' && tag !== 'textarea' && tag !== 'select' && tag !== 'button') { ev.preventDefault(); if (E.tocando) parar(); else tocar(); }
    };
    document.addEventListener('keydown', E.tecla, true); document.addEventListener('keyup', function (ev) { if (E && E.ov.contains(ev.target)) ev.stopPropagation(); }, true);
    document.body.appendChild(ov); document.documentElement.classList.add('nbo-aberto');
    desenharLista(); desenharAbas(); desenharInspetor(); desenharLinha();
    window.addEventListener('resize', function () { desenharLinha(); });
    E.raf = requestAnimationFrame(laco);
    if (opc.audio) carregarAudio(opc.audio.blob, opc.audio.nome);
    setTimeout(function () { var b = ov.querySelector('.nbo-go'); if (b) b.focus(); }, 30);
  };

  /* ------------------------------------------- painel da aba "Ondas" */
  FO.montarPainel = function (el, ponte) {
    FO.ponte = ponte; el.textContent = '';
    el.appendChild(h('p', { class: 'nbo-pp', text: 'Crie vídeos em que ondas, barras, partículas e vibrações dançam com a música.' }));
    el.appendChild(h('button', { class: 'btn btn-primary nbo-pb', type: 'button', onclick: function () { FO.abrir(); } }, 'Abrir o estúdio de ondas'));
    var audios = []; try { audios = ponte.audios(); } catch (e) { }
    if (audios.length) {
      el.appendChild(h('h4', { class: 'nbo-ph', text: 'Música do projeto' }));
      audios.forEach(function (a) { el.appendChild(h('button', { class: 'nbo-pi', type: 'button', onclick: function () { FO.abrir({ audio: { blob: a.blob, nome: a.nome } }); } }, h('span', { class: 'nbo-pn', text: a.nome }), h('small', { text: mm(a.duracao || 0) }))); });
    } else el.appendChild(h('p', { class: 'nbo-ps', text: 'Importe uma música na aba Mídia para usá-la aqui, ou abra o arquivo direto no estúdio.' }));
    el.appendChild(h('h4', { class: 'nbo-ph', text: 'Modelos prontos' }));
    var g = h('div', { class: 'nbo-pg' });
    FO.MODELOS.forEach(function (m) { g.appendChild(h('button', { class: 'nbo-pm', type: 'button', title: m.desc, onclick: function () { FO.abrir({ modelo: m.id, audio: audios[0] ? { blob: audios[0].blob, nome: audios[0].nome } : null }); } }, m.nome)); });
    el.appendChild(g);
    el.appendChild(h('p', { class: 'nbo-ps', text: 'O vídeo pronto entra na linha do tempo, onde você pode cortar, juntar com outros clipes e aplicar filtros.' }));
  };
})();
