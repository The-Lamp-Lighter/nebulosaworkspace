/* ==========================================================================
   Utilidades — Contador de palavras (js/contador.js)
   O texto fica só neste navegador (pode ser apagado com "Limpar").
   ========================================================================== */
(function () {
  'use strict';
  const { $, $$, esc, T, ICO, num } = UT;
  const PALAVRA = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
  const PARADAS = new Set(('a o e é de da do das dos em no na nos nas um uma uns umas para por com sem que se ao aos às as os ou mas mais menos como quando onde porque pois já não sim muito muita muitos muitas seu sua seus suas ele ela eles elas eu tu você vocês nós isso isto esse essa este esta aquele aquela lhe me te nos foi ser são está estão era tem ter há sobre entre até também só bem então ' +
    'the of and to in is it that for on with as was are be by at this from or an have has not but they you he she we his her their its our your will can all would there what which so if do does did about into than then them these those been were had ' +
    'el la los las y en es que un una por con para del al se lo le les su sus como pero más sin sobre este esta esto ese esa ya muy también fue son está están era hay ser').split(/\s+/));
  const LIMITES = [['Título para buscadores (SEO)', 60], ['Título no YouTube', 100], ['SMS', 160], ['Descrição para buscadores', 160], ['Post no X (Twitter)', 280], ['Legenda no Instagram', 2200], ['Post no LinkedIn', 3000]];
  let el, ta, antes = null, gT = null;

  function montar(v) {
    el = v;
    v.innerHTML = `<div class="cab"><div><h1>Contador de palavras</h1><p>Cole ou escreva um texto para contar palavras, caracteres e frases, ver o tempo de leitura e os limites das redes sociais.</p></div>
      <div class="linha"><button class="btn" id="ctCopiar">${ICO.copiar}<span>Copiar texto</span></button><button class="btn" id="ctLimpar">${ICO.lixo}<span>Limpar</span></button></div></div>
      <div class="grade2 l">
        <div class="painel">
          <textarea class="in" id="ctTexto" spellcheck="true" placeholder="Escreva ou cole o texto aqui…" aria-label="Texto"></textarea>
          <div class="linha" style="margin-top:10px">
            <button class="btn peq" data-x="mai">MAIÚSCULAS</button><button class="btn peq" data-x="min">minúsculas</button>
            <button class="btn peq" data-x="tit">Iniciais Maiúsculas</button><button class="btn peq" data-x="frase">Como frase</button>
            <button class="btn peq" data-x="espacos">Tirar espaços extras</button><button class="btn peq" data-x="linhas">Juntar linhas</button>
            <button class="btn peq so" id="ctDesfazer" hidden>Desfazer</button>
          </div>
          <p class="dica">O texto fica guardado só neste navegador, para você não perder o que escreveu.</p>
        </div>
        <div>
          <div class="painel"><div class="stats" id="ctStats"></div></div>
          <div class="painel"><h2>Limites</h2><div class="lim" id="ctLim"></div></div>
          <div class="painel"><h2>Palavras que mais aparecem</h2><div class="freq" id="ctFreq"></div></div>
        </div>
      </div>`;
    ta = $('#ctTexto', v);
    ta.value = UT.ler('contador', '') || '';
    ta.addEventListener('input', () => { antes = null; $('#ctDesfazer', el).hidden = true; contar(); guardarDepois(); });
    $$('[data-x]', v).forEach(b => b.addEventListener('click', () => transformar(b.dataset.x)));
    $('#ctDesfazer', v).addEventListener('click', () => { if (antes != null) { ta.value = antes; antes = null; $('#ctDesfazer', el).hidden = true; contar(); guardarDepois(); } });
    $('#ctCopiar', v).addEventListener('click', () => { if (ta.value) UT.copiar(ta.value); });
    $('#ctLimpar', v).addEventListener('click', () => { if (!ta.value) return; antes = ta.value; ta.value = ''; $('#ctDesfazer', el).hidden = false; contar(); guardarDepois(); ta.focus(); });
    contar();
  }
  function guardarDepois() { clearTimeout(gT); gT = setTimeout(() => { const t = ta.value; UT.guardar('contador', t.length > 400000 ? null : t); }, 500); }
  function transformar(x) {
    const s = ta.value; if (!s) return;
    const loc = UT.local();
    let r = s;
    if (x === 'mai') r = s.toLocaleUpperCase(loc);
    else if (x === 'min') r = s.toLocaleLowerCase(loc);
    else if (x === 'tit') r = s.toLocaleLowerCase(loc).replace(/(^|[\s(“"'\-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase(loc));
    else if (x === 'frase') r = s.toLocaleLowerCase(loc).replace(/(^\s*|[.!?…]\s+|\n\s*)(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase(loc));
    else if (x === 'espacos') r = s.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    else if (x === 'linhas') r = s.replace(/\s*\n\s*/g, ' ').replace(/ {2,}/g, ' ').trim();
    if (r === s) return;
    antes = s; ta.value = r; $('#ctDesfazer', el).hidden = false;
    contar(); guardarDepois();
  }
  function minutos(m) {
    if (m < 1 / 60) return '0 s';
    if (m < 1) return Math.max(1, Math.round(m * 60)) + ' s';
    const h = Math.floor(m / 60), mm = Math.round(m % 60);
    return h ? h + ' h ' + mm + ' min' : Math.round(m) + ' min';
  }
  function contar() {
    const s = ta.value;
    const pal = s.match(PALAVRA) || [];
    const car = [...s].length, semEsp = [...s.replace(/\s/g, '')].length;
    const frases = s.split(/[.!?…]+(?=\s|$)/).filter(x => /[\p{L}\p{N}]/u.test(x)).length;
    const pars = s.split(/\n+/).filter(x => x.trim()).length;
    const unicas = new Set(pal.map(p => p.toLocaleLowerCase())).size;
    const st = [
      [num(pal.length, 0), 'Palavras'], [num(car, 0), 'Caracteres'], [num(semEsp, 0), 'Sem espaços'], [num(frases, 0), 'Frases'],
      [num(pars, 0), 'Parágrafos'], [num(unicas, 0), 'Palavras diferentes'], [minutos(pal.length / 200), 'Leitura (200 palavras/min)'], [minutos(pal.length / 130), 'Falando em voz alta']
    ];
    $('#ctStats', el).innerHTML = st.map(x => `<div class="stat"><b>${esc(x[0])}</b><small>${esc(x[1])}</small></div>`).join('');
    $('#ctLim', el).innerHTML = LIMITES.map(([n, m]) => {
      const p = Math.min(100, car / m * 100), over = car > m;
      return `<div class="${over ? 'over' : ''}"><div class="linha" style="gap:6px"><span>${esc(n)}</span><span class="espaco"></span><span class="num">${num(car, 0)} / ${num(m, 0)}</span></div><div class="bar"><i style="width:${p}%"></i></div></div>`;
    }).join('');
    const cont = new Map();
    pal.forEach(p => { const k = p.toLocaleLowerCase(); if (k.length > 2 && !PARADAS.has(k) && !/^\d+$/.test(k)) cont.set(k, (cont.get(k) || 0) + 1); });
    const top = [...cont.entries()].filter(x => x[1] > 1).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 15);
    $('#ctFreq', el).innerHTML = top.length ? top.map(([w, n]) => `<span>${esc(w)} <b>${n}</b></span>`).join('') : `<span class="dica" style="background:none;padding:0">${esc(T('Nenhuma palavra se repete ainda.'))}</span>`;
  }
  UT.registrar('contador', {
    montar,
    abrir() { if (!matchMedia('(max-width:760px)').matches) ta.focus({ preventScroll: true }); },
    conteudos: () => ta && ta.value.trim() ? [{ id: 'texto', rotulo: 'Texto', detalhe: T('{1} palavras', num((ta.value.match(PALAVRA) || []).length, 0)), tipo: 'texto', nome: T('texto') + '.txt', obter: () => new Blob([ta.value], { type: 'text/plain;charset=utf-8' }) }] : [],
    aceita: info => info.tipoUtil === 'texto',
    receber: async info => {
      const t = await info.arquivo.text();
      if (ta.value.trim() && info.acao === 'inserir') { antes = ta.value; ta.value = ta.value.replace(/\s+$/, '') + '\n\n' + t; $('#ctDesfazer', el).hidden = false; }
      else { if (ta.value.trim()) { antes = ta.value; $('#ctDesfazer', el).hidden = false; } ta.value = t; }
      contar(); guardarDepois();
      UT.aviso(T('Texto recebido: {1} palavras.', num((t.match(PALAVRA) || []).length, 0)));
      return true;
    }
  });
  if (UT.N && UT.N.idiomas) UT.N.idiomas.aoMudar(() => { if (el) contar(); });
})();
