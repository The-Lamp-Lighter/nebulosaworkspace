/* ==========================================================================
   Utilidades — Cores (js/cores.js)
   Conversões (HEX, RGB, HSL, CMYK), paletas harmônicas, conta-gotas e
   contraste de acessibilidade (WCAG 2.1).
   ========================================================================== */
(function () {
  'use strict';
  const { $, $$, esc, T, ICO, num } = UT;
  const st = Object.assign({ cor: '#a778ff', harm: 'analoga', texto: '#323559', fundo: '#ffffff', salvas: [] }, UT.ler('cores', {}));
  let el;
  const HARM = [['complementar', 'Complementar'], ['analoga', 'Análoga'], ['triade', 'Tríade'], ['tetrade', 'Tetrádica'], ['mono', 'Monocromática'], ['tons', 'Tons e sombras']];

  /* ---------- conversões ---------- */
  const lim = (x, a, b) => Math.min(b, Math.max(a, x));
  function hexRgb(h) {
    h = String(h || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  const rgbHex = (r, g, b) => '#' + [r, g, b].map(x => lim(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
  function rgbHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
    }
    return [h, s * 100, l * 100];
  }
  function hslRgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s = lim(s, 0, 100) / 100; l = lim(l, 0, 100) / 100;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }
  function rgbCmyk(r, g, b) {
    const k = 1 - Math.max(r, g, b) / 255;
    if (k >= 1) return [0, 0, 0, 100];
    return [(1 - r / 255 - k) / (1 - k) * 100, (1 - g / 255 - k) / (1 - k) * 100, (1 - b / 255 - k) / (1 - k) * 100, k * 100];
  }
  const cmykRgb = (c, m, y, k) => [255 * (1 - c / 100) * (1 - k / 100), 255 * (1 - m / 100) * (1 - k / 100), 255 * (1 - y / 100) * (1 - k / 100)];
  function luz(hex) { const c = hexRgb(hex).map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
  const razao = (a, b) => { const x = luz(a), y = luz(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const tintaSobre = hex => luz(hex) > .4 ? '#1b1b28' : '#ffffff';
  const hslHex = (h, s, l) => rgbHex(...hslRgb(h, s, l));
  const n0 = x => Math.round(x);
  const fmt = {
    hex: h => h.toUpperCase(),
    rgb: h => { const [r, g, b] = hexRgb(h); return `rgb(${r}, ${g}, ${b})`; },
    hsl: h => { const [a, s, l] = rgbHsl(...hexRgb(h)); return `hsl(${n0(a)}, ${n0(s)}%, ${n0(l)}%)`; },
    cmyk: h => { const [c, m, y, k] = rgbCmyk(...hexRgb(h)); return `cmyk(${n0(c)}%, ${n0(m)}%, ${n0(y)}%, ${n0(k)}%)`; }
  };
  function lerCor(s) {
    s = String(s || '').trim().toLowerCase();
    let m;
    if ((m = hexRgb(s))) return rgbHex(...m);
    const nums = (s.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    if (/^rgba?\(/.test(s) && nums.length >= 3) return rgbHex(nums[0], nums[1], nums[2]);
    if (/^hsla?\(/.test(s) && nums.length >= 3) return hslHex(nums[0], nums[1], nums[2]);
    if (/^cmyk\(/.test(s) && nums.length >= 4) return rgbHex(...cmykRgb(nums[0], nums[1], nums[2], nums[3]));
    // nome de cor do CSS (red, navy…)
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = '#010203'; c.fillStyle = s;
    return c.fillStyle !== '#010203' && /^#[0-9a-f]{6}$/i.test(c.fillStyle) ? c.fillStyle : null;
  }
  function paleta(hex, tipo) {
    const [h, s, l] = rgbHsl(...hexRgb(hex));
    switch (tipo) {
      case 'complementar': return [hex, hslHex(h + 180, s, l), hslHex(h, s, lim(l + 20, 0, 95)), hslHex(h + 180, s, lim(l - 18, 5, 100))];
      case 'analoga': return [hslHex(h - 40, s, l), hslHex(h - 20, s, l), hex, hslHex(h + 20, s, l), hslHex(h + 40, s, l)];
      case 'triade': return [hex, hslHex(h + 120, s, l), hslHex(h + 240, s, l)];
      case 'tetrade': return [hex, hslHex(h + 90, s, l), hslHex(h + 180, s, l), hslHex(h + 270, s, l)];
      case 'mono': return [15, 30, 45, 60, 75, 88].map(x => hslHex(h, s, x));
      case 'tons': { const [r, g, b] = hexRgb(hex); const mix = (t, k) => rgbHex(r + (t - r) * k, g + (t - g) * k, b + (t - b) * k); return [mix(0, .6), mix(0, .4), mix(0, .2), hex, mix(255, .25), mix(255, .5), mix(255, .75)]; }
    }
    return [hex];
  }

  /* ---------- tela ---------- */
  function montar(v) {
    el = v;
    v.innerHTML = `<div class="cab"><div><h1>Cores</h1><p>Converta entre HEX, RGB, HSL e CMYK, monte paletas e confira se o texto fica legível sobre o fundo.</p></div></div>
      <div class="grade2">
        <div class="painel">
          <div class="cor-grande" id="coGrande"></div>
          <div class="linha" style="margin-top:12px">
            <input type="color" id="coPick" aria-label="Escolher cor">
            ${'EyeDropper' in window ? `<button class="btn" id="coConta">${ICO.conta}<span>Conta-gotas</span></button>` : ''}
            <button class="btn" id="coAleat">${ICO.renovar}<span>Cor aleatória</span></button>
            <button class="btn" id="coGuardar">${ICO.mais}<span>Guardar cor</span></button>
          </div>
          <div class="formatos">${['hex', 'rgb', 'hsl', 'cmyk'].map(k => `<label><span>${k.toUpperCase()}</span><input data-f="${k}" spellcheck="false" autocomplete="off"><button class="btn peq so" data-copiar="${k}" title="Copiar" aria-label="Copiar">${ICO.copiar}</button></label>`).join('')}</div>
          <p class="dica">Dá para digitar ou colar em qualquer formato, inclusive nomes como “navy” ou “tomato”. O CMYK é aproximado: para gráfica, confira com o perfil de cor da impressão.</p>
          <div id="coSalvasBox" hidden><span class="rot">Guardadas</span><div class="linha" style="margin-top:6px"><div class="salvas" id="coSalvas"></div><button class="btn peq so" id="coLimparS">Limpar</button></div></div>
        </div>
        <div class="painel">
          <h2>Paletas</h2>
          <div class="seg" id="coHarm">${HARM.map(x => `<button data-h="${x[0]}">${esc(x[1])}</button>`).join('')}</div>
          <div class="paleta" id="coPaleta" style="margin-top:12px"></div>
          <div class="linha" style="margin-top:10px"><button class="btn peq" id="coCss">${ICO.copiar}<span>Copiar como CSS</span></button><button class="btn peq" id="coPng">${ICO.baixar}<span>Baixar PNG</span></button><span class="dica" style="margin:0">Clique numa cor para copiar o código.</span></div>
        </div>
      </div>
      <div class="painel">
        <h2>Contraste (acessibilidade)</h2>
        <div class="contraste">
          <div>
            <div class="linha">
              <label class="campo"><span>Texto</span><span class="linha" style="flex-wrap:nowrap"><input type="color" id="coTxtC"><input class="in mono" id="coTxt" style="width:120px" spellcheck="false"></span></label>
              <button class="btn so" id="coInv" title="Trocar texto e fundo" aria-label="Trocar texto e fundo">${ICO.trocar}</button>
              <label class="campo"><span>Fundo</span><span class="linha" style="flex-wrap:nowrap"><input type="color" id="coFunC"><input class="in mono" id="coFun" style="width:120px" spellcheck="false"></span></label>
            </div>
            <div class="linha"><button class="btn peq" id="coUsaTxt">Usar a cor de cima no texto</button><button class="btn peq" id="coUsaFun">Usar a cor de cima no fundo</button></div>
            <div class="razao" id="coRazao" style="margin-top:10px"></div>
            <div class="selos" id="coSelos"></div>
          </div>
          <div class="amostra" id="coAmostra"><p class="g">Título de exemplo</p><p>Este é um texto comum, do tamanho de um parágrafo, para você ver como fica a leitura com essas cores.</p></div>
        </div>
        <p class="dica">WCAG 2.1: 4,5:1 para texto comum e 3:1 para texto grande (a partir de 24 px, ou 19 px em negrito) e para ícones e bordas de botões.</p>
      </div>`;
    $('#coPick', v).addEventListener('input', () => definir($('#coPick', v).value));
    $$('.formatos input', v).forEach(i => {
      i.addEventListener('change', () => { const c = lerCor(i.value); if (c) definir(c); else UT.aviso(T('Não reconheci essa cor.'), true); i.value = fmt[i.dataset.f](st.cor); });
      i.addEventListener('keydown', e => { if (e.key === 'Enter') i.dispatchEvent(new Event('change')); });
    });
    $('.formatos', v).addEventListener('click', e => { const b = e.target.closest('[data-copiar]'); if (b) UT.copiar(fmt[b.dataset.copiar](st.cor)); });
    const ct = $('#coConta', v);
    if (ct) ct.addEventListener('click', async () => { try { const r = await new window.EyeDropper().open(); if (r && r.sRGBHex) definir(lerCor(r.sRGBHex) || st.cor); } catch (e) { /* cancelado */ } });
    $('#coAleat', v).addEventListener('click', () => { const a = new Uint32Array(1); crypto.getRandomValues(a); definir(hslHex(a[0] % 360, 55 + a[0] % 35, 45 + (a[0] >> 9) % 20)); });
    $('#coGuardar', v).addEventListener('click', () => { st.salvas = [st.cor].concat(st.salvas.filter(c => c !== st.cor)).slice(0, 24); salvar(); mostrarSalvas(); UT.aviso(T('Cor guardada.')); });
    $('#coSalvas', v).addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) definir(b.dataset.c); });
    $('#coLimparS', v).addEventListener('click', () => { st.salvas = []; salvar(); mostrarSalvas(); });
    $('#coHarm', v).addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (b) { st.harm = b.dataset.h; salvar(); mostrarPaleta(); } });
    $('#coPaleta', v).addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) UT.copiar(b.dataset.c.toUpperCase()); });
    $('#coCss', v).addEventListener('click', () => UT.copiar(':root {\n' + paleta(st.cor, st.harm).map((c, i) => '  --cor-' + (i + 1) + ': ' + c.toUpperCase() + ';').join('\n') + '\n}'));
    $('#coPng', v).addEventListener('click', async () => UT.baixar(await pngPaleta(), 'paleta-' + st.cor.slice(1) + '.png'));
    const par = (c, i, k) => {
      $(c, v).addEventListener('input', () => { st[k] = $(c, v).value; contraste(); });
      $(i, v).addEventListener('change', () => { const x = lerCor($(i, v).value); if (x) st[k] = x; contraste(); });
    };
    par('#coTxtC', '#coTxt', 'texto'); par('#coFunC', '#coFun', 'fundo');
    $('#coInv', v).addEventListener('click', () => { const t = st.texto; st.texto = st.fundo; st.fundo = t; contraste(); });
    $('#coUsaTxt', v).addEventListener('click', () => { st.texto = st.cor; contraste(); });
    $('#coUsaFun', v).addEventListener('click', () => { st.fundo = st.cor; contraste(); });
    mostrar(); contraste(); mostrarSalvas();
  }
  let sT = null;
  function salvar() { clearTimeout(sT); sT = setTimeout(() => UT.guardar('cores', { cor: st.cor, harm: st.harm, texto: st.texto, fundo: st.fundo, salvas: st.salvas }), 300); }
  function definir(c) { if (!c) return; st.cor = c.toLowerCase(); salvar(); mostrar(); }
  function mostrar() {
    const g = $('#coGrande', el);
    g.style.background = st.cor; g.style.color = tintaSobre(st.cor); g.textContent = st.cor.toUpperCase();
    $('#coPick', el).value = st.cor;
    $$('.formatos input', el).forEach(i => { if (document.activeElement !== i) i.value = fmt[i.dataset.f](st.cor); });
    mostrarPaleta();
  }
  function mostrarPaleta() {
    $$('#coHarm [data-h]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.h === st.harm)));
    $('#coPaleta', el).innerHTML = paleta(st.cor, st.harm).map(c => `<button data-c="${c}" style="background:${c};color:${tintaSobre(c)}" title="${c.toUpperCase()}">${c.toUpperCase().slice(1)}</button>`).join('');
  }
  function mostrarSalvas() {
    $('#coSalvasBox', el).hidden = !st.salvas.length;
    $('#coSalvas', el).innerHTML = st.salvas.map(c => `<button data-c="${c}" style="background:${c}" title="${c.toUpperCase()}" aria-label="${c.toUpperCase()}"></button>`).join('');
  }
  function contraste() {
    $('#coTxtC', el).value = st.texto; $('#coFunC', el).value = st.fundo;
    if (document.activeElement !== $('#coTxt', el)) $('#coTxt', el).value = st.texto.toUpperCase();
    if (document.activeElement !== $('#coFun', el)) $('#coFun', el).value = st.fundo.toUpperCase();
    const a = $('#coAmostra', el); a.style.color = st.texto; a.style.background = st.fundo;
    const r = razao(st.texto, st.fundo);
    $('#coRazao', el).textContent = num(Math.floor(r * 100) / 100, 2) + ' : 1';
    const s = (ok, t) => `<span class="selo ${ok ? 'sim' : 'nao'}">${ok ? '✓' : '✗'} ${esc(T(t))}</span>`;
    $('#coSelos', el).innerHTML = s(r >= 4.5, 'AA texto comum') + s(r >= 3, 'AA texto grande') + s(r >= 7, 'AAA texto comum') + s(r >= 4.5, 'AAA texto grande') + s(r >= 3, 'Ícones e bordas');
    salvar();
  }
  function pngPaleta() {
    const P = paleta(st.cor, st.harm), w = 160, h = 220;
    const c = document.createElement('canvas'); c.width = w * P.length; c.height = h;
    const g = c.getContext('2d');
    P.forEach((x, i) => {
      g.fillStyle = x; g.fillRect(i * w, 0, w, h);
      g.fillStyle = tintaSobre(x); g.font = '600 20px ui-monospace, Consolas, monospace'; g.textAlign = 'center';
      g.fillText(x.toUpperCase(), i * w + w / 2, h - 24);
    });
    return new Promise(r => c.toBlob(r, 'image/png'));
  }
  UT.registrar('cores', {
    montar,
    conteudos: () => [{ id: 'paleta', rotulo: 'Paleta de cores (imagem)', detalhe: paleta(st.cor, st.harm).map(c => c.toUpperCase()).join(' '), tipo: 'imagem', nome: 'paleta-' + st.cor.slice(1) + '.png', obter: pngPaleta }]
  });
  if (UT.N && UT.N.idiomas) UT.N.idiomas.aoMudar(() => { if (el) contraste(); });
})();
