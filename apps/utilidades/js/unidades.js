/* ==========================================================================
   Utilidades — Conversor de unidades (js/unidades.js)
   Cada categoria tem uma unidade-base; "f" é quanto 1 unidade vale na base.
   Temperatura e consumo usam funções (para/de a base).
   ========================================================================== */
(function () {
  'use strict';
  const { $, $$, esc, T, ICO, num } = UT;
  const u = (id, nome, s, f) => ({ id, nome, s, f });
  const CATS = [
    { id: 'comp', nome: 'Comprimento', un: [u('mm', 'milímetro', 'mm', .001), u('cm', 'centímetro', 'cm', .01), u('m', 'metro', 'm', 1), u('km', 'quilômetro', 'km', 1000),
      u('in', 'polegada', 'pol', .0254), u('ft', 'pé', 'ft', .3048), u('yd', 'jarda', 'jd', .9144), u('mi', 'milha', 'mi', 1609.344), u('nmi', 'milha náutica', 'M', 1852)], de: 'm', para: 'ft' },
    { id: 'area', nome: 'Área', un: [u('cm2', 'centímetro quadrado', 'cm²', 1e-4), u('m2', 'metro quadrado', 'm²', 1), u('ha', 'hectare', 'ha', 1e4), u('km2', 'quilômetro quadrado', 'km²', 1e6),
      u('alqsp', 'alqueire paulista', 'alq. SP', 24200), u('alqmg', 'alqueire mineiro', 'alq. MG', 48400), u('in2', 'polegada quadrada', 'pol²', .00064516), u('ft2', 'pé quadrado', 'ft²', .09290304), u('ac', 'acre', 'ac', 4046.8564224)], de: 'm2', para: 'ha' },
    { id: 'vol', nome: 'Volume', un: [u('ml', 'mililitro', 'ml', .001), u('l', 'litro', 'L', 1), u('m3', 'metro cúbico', 'm³', 1000), u('cm3', 'centímetro cúbico', 'cm³', .001),
      u('galus', 'galão americano', 'gal (EUA)', 3.785411784), u('galuk', 'galão imperial', 'gal (RU)', 4.54609), u('pt', 'pint americano', 'pt', .473176473), u('floz', 'onça fluida', 'fl oz', .0295735295625), u('bbl', 'barril de petróleo', 'bbl', 158.987294928)], de: 'l', para: 'galus' },
    { id: 'massa', nome: 'Massa', un: [u('mg', 'miligrama', 'mg', 1e-6), u('g', 'grama', 'g', .001), u('kg', 'quilograma', 'kg', 1), u('t', 'tonelada', 't', 1000),
      u('oz', 'onça', 'oz', .028349523125), u('lb', 'libra', 'lb', .45359237), u('st', 'stone', 'st', 6.35029318), u('arroba', 'arroba', '@', 15), u('ct', 'quilate', 'ct', .0002)], de: 'kg', para: 'lb' },
    { id: 'temp', nome: 'Temperatura', un: [
      { id: 'c', nome: 'grau Celsius', s: '°C', para: v => v, de: v => v },
      { id: 'f', nome: 'grau Fahrenheit', s: '°F', para: v => (v - 32) * 5 / 9, de: v => v * 9 / 5 + 32 },
      { id: 'k', nome: 'kelvin', s: 'K', para: v => v - 273.15, de: v => v + 273.15 }], de: 'c', para: 'f' },
    { id: 'vel', nome: 'Velocidade', un: [u('kmh', 'quilômetro por hora', 'km/h', 1 / 3.6), u('ms', 'metro por segundo', 'm/s', 1), u('mph', 'milha por hora', 'mph', .44704), u('kn', 'nó', 'nó', 1852 / 3600), u('fts', 'pé por segundo', 'ft/s', .3048)], de: 'kmh', para: 'mph' },
    { id: 'tempo', nome: 'Tempo', un: [u('ms', 'milissegundo', 'ms', .001), u('s', 'segundo', 's', 1), u('min', 'minuto', 'min', 60), u('h', 'hora', 'h', 3600), u('d', 'dia', 'd', 86400),
      u('sem', 'semana', 'sem', 604800), u('mes', 'mês (média)', 'mês', 2629746), u('ano', 'ano (média)', 'ano', 31557600)], de: 'h', para: 'min' },
    { id: 'dados', nome: 'Dados', un: [u('bit', 'bit', 'bit', .125), u('b', 'byte', 'B', 1), u('kb', 'quilobyte', 'KB', 1e3), u('mb', 'megabyte', 'MB', 1e6), u('gb', 'gigabyte', 'GB', 1e9), u('tb', 'terabyte', 'TB', 1e12),
      u('kib', 'kibibyte', 'KiB', 1024), u('mib', 'mebibyte', 'MiB', 1048576), u('gib', 'gibibyte', 'GiB', 1073741824), u('tib', 'tebibyte', 'TiB', 1099511627776)], de: 'gb', para: 'mb' },
    { id: 'cozinha', nome: 'Cozinha', un: [u('xic', 'xícara (240 ml)', 'xíc.', 240), u('copo', 'copo americano (190 ml)', 'copo', 190), u('cs', 'colher de sopa', 'c. sopa', 15), u('csb', 'colher de sobremesa', 'c. sobremesa', 10),
      u('cc', 'colher de chá', 'c. chá', 5), u('ml', 'mililitro', 'ml', 1), u('l', 'litro', 'L', 1000), u('cup', 'cup americana', 'cup', 236.5882365), u('floz', 'onça fluida', 'fl oz', 29.5735295625)], de: 'xic', para: 'ml' },
    { id: 'energia', nome: 'Energia', un: [u('j', 'joule', 'J', 1), u('kj', 'quilojoule', 'kJ', 1000), u('cal', 'caloria', 'cal', 4.184), u('kcal', 'quilocaloria', 'kcal', 4184), u('wh', 'watt-hora', 'Wh', 3600), u('kwh', 'quilowatt-hora', 'kWh', 3.6e6), u('btu', 'BTU', 'BTU', 1055.05585)], de: 'kcal', para: 'kj' },
    { id: 'pressao', nome: 'Pressão', un: [u('pa', 'pascal', 'Pa', 1), u('kpa', 'quilopascal', 'kPa', 1000), u('bar', 'bar', 'bar', 1e5), u('atm', 'atmosfera', 'atm', 101325), u('psi', 'libra por polegada quadrada', 'psi', 6894.757293168), u('mmhg', 'milímetro de mercúrio', 'mmHg', 133.322387415)], de: 'psi', para: 'bar' },
    { id: 'consumo', nome: 'Consumo', un: [
      { id: 'kml', nome: 'quilômetros por litro', s: 'km/L', para: v => v, de: v => v },
      { id: 'l100', nome: 'litros a cada 100 km', s: 'L/100 km', para: v => 100 / v, de: v => 100 / v },
      { id: 'mpg', nome: 'milhas por galão (EUA)', s: 'mpg', para: v => v * .425143707, de: v => v / .425143707 }], de: 'kml', para: 'l100' }
  ];
  const st = Object.assign({ cat: 'comp', esc: {} }, UT.ler('unidades', {}));
  let el, valor = 1;

  const catAtual = () => CATS.find(c => c.id === st.cat) || CATS[0];
  const paraBase = (un, v) => un.para ? un.para(v) : v * un.f;
  const daBase = (un, v) => un.de ? un.de(v) : v / un.f;
  function ler(s) {
    s = String(s || '').replace(/\s/g, '');
    if (!s) return NaN;
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else s = s.replace(',', '.');
    return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? parseFloat(s) : NaN;
  }
  function montar(v) {
    el = v;
    v.innerHTML = `<div class="cab"><div><h1>Conversor de unidades</h1><p>Medidas, áreas, volumes, pesos, temperatura, velocidade, tempo, dados, receitas, energia, pressão e consumo de combustível.</p></div></div>
      <div class="cats" id="unCats" role="group" aria-label="Categoria">${CATS.map(c => `<button data-c="${c.id}" aria-pressed="false">${esc(c.nome)}</button>`).join('')}</div>
      <div class="painel">
        <div class="conv">
          <div><label class="campo"><span>Valor</span><input class="in num" id="unVal" inputmode="decimal" autocomplete="off" value="1"></label>
            <label class="campo"><span>De</span><select class="in" id="unDe"></select></label></div>
          <button class="btn so troca" id="unTroca" title="Inverter" aria-label="Inverter">${ICO.trocar}</button>
          <div><div class="campo"><span>Resultado</span><output class="in num" id="unRes" style="display:flex;align-items:center;font-weight:700"></output></div>
            <label class="campo"><span>Para</span><select class="in" id="unPara"></select></label></div>
        </div>
        <p class="res-grande num" id="unFrase"></p>
        <div class="linha"><button class="btn peq" id="unCopiar">${ICO.copiar}<span>Copiar resultado</span></button><span class="dica" id="unNota"></span></div>
      </div>
      <div class="painel"><h2>Em todas as unidades</h2><div class="lista-un" id="unTodas"></div><p class="dica">Clique num valor para copiar.</p></div>`;
    $('#unCats', v).addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { st.cat = b.dataset.c; salvar(); preencher(); } });
    $('#unVal', v).addEventListener('input', calc);
    $('#unDe', v).addEventListener('change', () => { escolha().de = $('#unDe', v).value; salvar(); calc(); });
    $('#unPara', v).addEventListener('change', () => { escolha().para = $('#unPara', v).value; salvar(); calc(); });
    $('#unTroca', v).addEventListener('click', () => { const e = escolha(), t = e.de; e.de = e.para; e.para = t; salvar(); preencher(); });
    $('#unCopiar', v).addEventListener('click', () => { const r = $('#unRes', v).textContent; if (r && r !== '—') UT.copiar(r); });
    $('#unTodas', v).addEventListener('click', e => { const b = e.target.closest('[data-copia]'); if (b) UT.copiar(b.dataset.copia); });
    preencher();
  }
  function escolha() { const c = catAtual(); if (!st.esc[c.id]) st.esc[c.id] = { de: c.de, para: c.para }; return st.esc[c.id]; }
  function salvar() { UT.guardar('unidades', { cat: st.cat, esc: st.esc }); }
  function preencher() {
    const c = catAtual(), e = escolha();
    $$('#unCats [data-c]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c === c.id)));
    const ops = c.un.map(x => `<option value="${x.id}">${esc(T(x.nome))} (${esc(T(x.s))})</option>`).join('');
    $('#unDe', el).innerHTML = ops; $('#unPara', el).innerHTML = ops;
    if (!c.un.some(x => x.id === e.de)) e.de = c.de;
    if (!c.un.some(x => x.id === e.para)) e.para = c.para;
    $('#unDe', el).value = e.de; $('#unPara', el).value = e.para;
    calc();
  }
  function fmt(x) { if (!isFinite(x)) return '—'; const a = Math.abs(x); return num(x, a >= 1000 ? 2 : a >= 1 ? 4 : 6); }
  function calc() {
    const c = catAtual(), e = escolha();
    const de = c.un.find(x => x.id === e.de), para = c.un.find(x => x.id === e.para);
    valor = ler($('#unVal', el).value);
    const ok = isFinite(valor);
    $('#unVal', el).setAttribute('aria-invalid', String(!ok && $('#unVal', el).value.trim() !== ''));
    const base = ok ? paraBase(de, valor) : NaN;
    const r = ok ? daBase(para, base) : NaN;
    $('#unRes', el).textContent = ok ? fmt(r) : '—';
    $('#unFrase', el).textContent = ok ? fmt(valor) + ' ' + T(de.s) + ' = ' + fmt(r) + ' ' + T(para.s) : T('Digite um número.');
    const NOTAS = { cozinha: 'Medidas caseiras do Brasil: xícara de 240 ml e copo americano de 190 ml. Para farinha e açúcar o peso varia; use a balança quando a receita pedir precisão.',
      tempo: 'Mês e ano usam a duração média (30,44 dias e 365,25 dias).', dados: 'KB, MB e GB usam 1000; KiB, MiB e GiB usam 1024 (como o Windows mostra).',
      area: 'O alqueire muda de região para região: paulista = 24.200 m², mineiro = 48.400 m².' };
    $('#unNota', el).textContent = NOTAS[c.id] ? T(NOTAS[c.id]) : '';
    $('#unTodas', el).innerHTML = c.un.filter(x => x.id !== de.id).map(x => {
      const y = ok ? daBase(x, base) : NaN, s = fmt(y);
      return `<button data-copia="${esc(s)}" title="${esc(T('Copiar'))}"><b>${esc(s)} ${esc(T(x.s))}</b><small>${esc(T(x.nome))}</small></button>`;
    }).join('');
  }
  UT.registrar('unidades', {
    montar,
    abrir() { const i = $('#unVal', el); if (i && !matchMedia('(max-width:760px)').matches) { i.focus({ preventScroll: true }); i.select(); } }
  });
  // números no formato do idioma quando o idioma muda
  if (UT.N && UT.N.idiomas) UT.N.idiomas.aoMudar(() => { if (el) preencher(); });
})();
