/* ==========================================================================
   Utilidades — Quadro branco (js/quadro.js)
   Desenho livre, formas com texto (fluxogramas), setas, notas e imagens.
   Guardado sozinho neste navegador; exporta PNG, SVG e o próprio quadro (.json).
   ========================================================================== */
(function () {
  'use strict';
  const { $, $$, esc, T, ICO } = UT;
  const S = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  const FERRS = [
    ['sel', 'V', 'Selecionar e mover', S('<path d="M5 3l14 8-6 1.5L10 19z"/>')],
    ['mao', 'H', 'Mover a área', S('<path d="M8 13V5.5a1.5 1.5 0 013 0V11m0-6.5a1.5 1.5 0 013 0V11m0-4.5a1.5 1.5 0 013 0V14a7 7 0 01-7 7h-1a6 6 0 01-5-2.7L3.5 15a1.5 1.5 0 012.5-1.6L8 16"/>')],
    ['caneta', 'P', 'Caneta', S('<path d="M3 21c3 0 4-1.5 5.5-3L19 7.5a2.1 2.1 0 00-3-3L5.5 15C4 16.5 3 17.5 3 21z"/>')],
    ['ret', 'R', 'Retângulo', S('<rect x="3" y="5" width="18" height="14" rx="2"/>')],
    ['elipse', 'O', 'Elipse', S('<ellipse cx="12" cy="12" rx="9" ry="7"/>')],
    ['losango', 'L', 'Losango (decisão)', S('<path d="M12 3l9 9-9 9-9-9z"/>')],
    ['seta', 'A', 'Seta', S('<path d="M4 20L20 4M11 4h9v9"/>')],
    ['texto', 'T', 'Texto', S('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>')],
    ['nota', 'N', 'Nota adesiva', S('<path d="M4 4h16v10l-6 6H4z"/><path d="M14 20v-6h6"/>')],
    ['borracha', 'E', 'Borracha', S('<path d="M8 20l-4-4L15 5l5 5-9 10z"/><path d="M13 20h7"/>')]
  ];
  const CORES = ['#24243a', '#e03b3b', '#f08c00', '#2f9e44', '#1971c2', '#7048e8', '#c2255c', '#ffffff'];
  const ESP = [[2, 'Fino'], [4, 'Médio'], [8, 'Grosso']];
  const NOTA = '#fff3a8';
  let el, cv, g, palco, dpr = 1;
  let objs = [], sel = [], ferr = 'sel', cor = CORES[0], esp = 4, preench = false;
  let view = { x: 0, y: 0, z: 1 }, desfazer = [], refazer = [], seq = 0, sujoGuardar = false;
  const imgs = new Map();
  const novoId = () => 'o' + Date.now().toString(36) + (++seq);

  /* ---------- guardar ---------- */
  function carregar() {
    const d = UT.ler('quadro', null);
    if (d && Array.isArray(d.objs)) { objs = d.objs.filter(o => o && o.t); if (d.view) view = Object.assign({ x: 0, y: 0, z: 1 }, d.view); }
  }
  let gT = null, avisouCheio = false;
  function guardar() {
    clearTimeout(gT);
    gT = setTimeout(() => {
      try { localStorage.setItem('nebulosa.utilidades.quadro', JSON.stringify({ versao: 1, objs, view })); avisouCheio = false; }
      catch (e) { if (!avisouCheio) { avisouCheio = true; UT.aviso(T('O quadro ficou grande demais para guardar no navegador. Salve como arquivo (.json) para não perder.'), true); } }
    }, 600);
  }
  function marco() { desfazer.push(JSON.stringify(objs)); if (desfazer.length > 100) desfazer.shift(); refazer = []; }
  function voltar(de, para) {
    if (!de.length) return;
    para.push(JSON.stringify(objs));
    objs = JSON.parse(de.pop()); sel = []; guardar(); pedir();
  }

  /* ---------- tela ---------- */
  function montar(v) {
    el = v; v.classList.add('cheia');
    v.innerHTML = `<div class="qb-barra">
        <div class="grp" id="qbFerr" role="toolbar" aria-label="Ferramentas do quadro">${FERRS.map(f => `<button data-f="${f[0]}" title="${esc(f[2])} (${f[1]})" aria-label="${esc(f[2])}">${f[3]}</button>`).join('')}
          <button id="qbImg" title="Imagem" aria-label="Imagem">${ICO.imagem}</button></div>
        <span class="sep"></span>
        <div class="linha" style="gap:5px" id="qbCores">${CORES.map(c => `<button class="sw" data-c="${c}" style="background:${c}" title="${c}" aria-label="${c}"></button>`).join('')}<input type="color" id="qbCorLivre" title="Outra cor" aria-label="Outra cor" style="width:30px;height:30px"></div>
        <span class="sep"></span>
        <div class="grp" id="qbEsp">${ESP.map(e => `<button data-e="${e[0]}" title="${esc(e[1])}" aria-label="${esc(e[1])}"><svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="${e[0] / 1.4 + .8}" stroke-linecap="round"/></svg></button>`).join('')}
          <button id="qbPre" title="Preencher as formas" aria-label="Preencher as formas">${S('<rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" fill-opacity=".35"/>')}</button></div>
        <span class="sep"></span>
        <div class="grp"><button id="qbDesf" title="Desfazer (Ctrl+Z)" aria-label="Desfazer">${S('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>')}</button><button id="qbRef" title="Refazer (Ctrl+Y)" aria-label="Refazer">${S('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>')}</button><button id="qbApagar" title="Apagar o que está selecionado (Delete)" aria-label="Apagar o que está selecionado">${ICO.lixo}</button></div>
        <span class="espaco"></span>
        <div class="menu"><button class="btn peq" id="qbMenu" aria-haspopup="true">${ICO.baixar}<span>Salvar e abrir</span></button>
          <div class="pop" id="qbPop" hidden>
            <button data-q="png">Baixar imagem (PNG)</button><button data-q="svg">Baixar desenho (SVG)</button>
            <hr><button data-q="json">Salvar o quadro (.json)</button><button data-q="abrir">Abrir um quadro (.json)</button>
            ${UT.N && UT.N.inWorkspace ? '<hr><button data-q="mandar">Mandar para…</button>' : ''}
            <hr><button data-q="limpar">Limpar o quadro</button></div></div>
      </div>
      <div class="qb-palco" id="qbPalco"><canvas id="qbCanvas" tabindex="0" aria-label="Quadro branco"></canvas>
        <div class="qb-zoom"><button id="qbMenos" aria-label="Afastar">−</button><button id="qbZ" title="Voltar para 100%">100%</button><button id="qbMais" aria-label="Aproximar">+</button><button id="qbTudo" title="Mostrar tudo">⤢</button></div>
        <div class="qb-dica" id="qbDica"></div></div>`;
    palco = $('#qbPalco', v); cv = $('#qbCanvas', v); g = cv.getContext('2d');
    carregar();
    $('#qbFerr', v).addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) usar(b.dataset.f); });
    $('#qbImg', v).addEventListener('click', () => UT.escolher('image/*').then(fs => { if (fs[0]) inserirImagem(fs[0]); }));
    $('#qbCores', v).addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) mudarCor(b.dataset.c); });
    $('#qbCorLivre', v).addEventListener('input', e => mudarCor(e.target.value));
    $('#qbEsp', v).addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (b) { esp = +b.dataset.e; if (sel.length) { marco(); sel.forEach(o => { if (o.t !== 'texto' && o.t !== 'imagem') o.esp = esp; }); guardar(); } marcar(); pedir(); } });
    $('#qbPre', v).addEventListener('click', () => { preench = !preench; if (sel.length) { marco(); sel.forEach(o => { if (/ret|elipse|losango/.test(o.t)) o.pre = preench; }); guardar(); } marcar(); pedir(); });
    $('#qbDesf', v).addEventListener('click', () => voltar(desfazer, refazer));
    $('#qbRef', v).addEventListener('click', () => voltar(refazer, desfazer));
    $('#qbApagar', v).addEventListener('click', apagarSel);
    const pop = $('#qbPop', v);
    $('#qbMenu', v).addEventListener('click', e => { e.stopPropagation(); pop.hidden = !pop.hidden; });
    document.addEventListener('mousedown', e => { if (!pop.hidden && !e.target.closest('#qbPop,#qbMenu')) pop.hidden = true; });
    pop.addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (!b) return; pop.hidden = true; acaoMenu(b.dataset.q); });
    $('#qbMenos', v).addEventListener('click', () => zoom(1 / 1.25));
    $('#qbMais', v).addEventListener('click', () => zoom(1.25));
    $('#qbZ', v).addEventListener('click', () => zoom(1 / view.z));
    $('#qbTudo', v).addEventListener('click', mostrarTudo);
    ligarPonteiro();
    new ResizeObserver(redimensionar).observe(palco);
    usar('sel');
  }
  function mudarCor(c) {
    cor = c;
    if (sel.length) { marco(); sel.forEach(o => { if (o.t !== 'imagem') o.cor = c; }); guardar(); }
    marcar(); pedir();
  }
  function usar(f) {
    ferr = f;
    if (f !== 'sel') sel = [];
    marcar(); pedir();
    const D = { sel: 'Clique para escolher; arraste para mover. Dois cliques numa forma escrevem dentro dela.', mao: 'Arraste para mover a área. Ctrl + roda do mouse aproxima.', caneta: 'Desenhe à vontade.',
      ret: 'Arraste para desenhar. Com Shift fica quadrado.', elipse: 'Arraste para desenhar. Com Shift fica um círculo.', losango: 'Arraste para desenhar. Bom para decisões em fluxogramas.',
      seta: 'Arraste do começo até a ponta da seta.', texto: 'Clique onde quer escrever.', nota: 'Clique para colar uma nota adesiva.', borracha: 'Clique ou passe por cima do que quer apagar.' };
    $('#qbDica', el).textContent = T(D[f] || '');
    cv.style.cursor = f === 'mao' ? 'grab' : f === 'sel' ? 'default' : f === 'texto' ? 'text' : f === 'borracha' ? 'cell' : 'crosshair';
  }
  function marcar() {
    $$('#qbFerr [data-f]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === ferr)));
    $$('#qbCores [data-c]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c === cor)));
    $$('#qbEsp [data-e]', el).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.e === esp)));
    $('#qbPre', el).setAttribute('aria-pressed', String(preench));
    $('#qbZ', el).textContent = Math.round(view.z * 100) + '%';
  }
  function redimensionar() {
    dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(palco.clientWidth * dpr)); cv.height = Math.max(1, Math.round(palco.clientHeight * dpr));
    pedir();
  }

  /* ---------- geometria ---------- */
  const tela = (x, y) => [x * view.z + view.x, y * view.z + view.y];
  function mundo(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - view.x) / view.z, (e.clientY - r.top - view.y) / view.z]; }
  function caixa(o) {
    if (o.t === 'caneta') { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; o.p.forEach(([x, y]) => { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }); return [a, b, c - a, d - b]; }
    if (o.t === 'seta') return [Math.min(o.x1, o.x2), Math.min(o.y1, o.y2), Math.abs(o.x2 - o.x1), Math.abs(o.y2 - o.y1)];
    return [o.x, o.y, o.w, o.h];
  }
  function distSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
  function acerta(o, x, y) {
    const tol = 6 / view.z + (o.esp || 2) / 2;
    if (o.t === 'caneta') { for (let i = 1; i < o.p.length; i++) if (distSeg(x, y, o.p[i - 1][0], o.p[i - 1][1], o.p[i][0], o.p[i][1]) <= tol) return true; return o.p.length === 1 && Math.hypot(x - o.p[0][0], y - o.p[0][1]) <= tol; }
    if (o.t === 'seta') return distSeg(x, y, o.x1, o.y1, o.x2, o.y2) <= tol;
    const [a, b, w, h] = caixa(o);
    if (o.t === 'elipse') { const rx = w / 2 + tol, ry = h / 2 + tol; return Math.pow((x - a - w / 2) / rx, 2) + Math.pow((y - b - h / 2) / ry, 2) <= 1; }
    if (o.t === 'losango') return Math.abs(x - a - w / 2) / (w / 2 + tol) + Math.abs(y - b - h / 2) / (h / 2 + tol) <= 1;
    return x >= a - tol && x <= a + w + tol && y >= b - tol && y <= b + h + tol;
  }
  const noTopo = (x, y) => { for (let i = objs.length - 1; i >= 0; i--) if (acerta(objs[i], x, y)) return objs[i]; return null; };
  function mover(o, dx, dy) {
    if (o.t === 'caneta') o.p = o.p.map(([x, y, p]) => [x + dx, y + dy, p]);
    else if (o.t === 'seta') { o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy; }
    else { o.x += dx; o.y += dy; }
  }
  function normal(o) { if (o.w < 0) { o.x += o.w; o.w = -o.w; } if (o.h < 0) { o.y += o.h; o.h = -o.h; } }

  /* ---------- desenho ---------- */
  let pedido = false;
  function pedir() { if (!pedido) { pedido = true; requestAnimationFrame(() => { pedido = false; desenhar(); }); } }
  function fonte(o) { return (o.t === 'texto' ? '500 ' : '600 ') + (o.fs || 20) + 'px Figtree, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'; }
  function linhas(c, txt, larg) {
    const out = [];
    String(txt || '').split('\n').forEach(par => {
      if (!larg) { out.push(par); return; }
      let l = '';
      par.split(/(\s+)/).forEach(p => { const t = l + p; if (c.measureText(t).width > larg && l.trim()) { out.push(l.trimEnd()); l = p.trimStart(); } else l = t; });
      out.push(l);
    });
    return out;
  }
  function medirTexto(o) {
    g.save(); g.font = fonte(o);
    const L = String(o.txt || '').split('\n'); const w = Math.max(20, ...L.map(l => g.measureText(l).width));
    g.restore();
    o.w = w + 4; o.h = Math.max(1, L.length) * (o.fs || 20) * 1.25 + 4;
  }
  function textoDentro(c, o, corT) {
    if (!o.txt) return;
    c.save(); c.font = fonte(o); c.fillStyle = corT; c.textAlign = 'center'; c.textBaseline = 'middle';
    const fs = o.fs || 20, pad = o.t === 'losango' ? o.w * .22 : 10, L = linhas(c, o.txt, Math.max(20, o.w - pad * 2)), lh = fs * 1.25;
    const y0 = o.y + o.h / 2 - (L.length - 1) * lh / 2;
    if (o.t === 'nota') { c.textAlign = 'left'; c.textBaseline = 'top'; L.forEach((l, i) => c.fillText(l, o.x + 12, o.y + 12 + i * lh)); }
    else L.forEach((l, i) => c.fillText(l, o.x + o.w / 2, y0 + i * lh));
    c.restore();
  }
  function seta(c, o) {
    const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1), k = Math.max(10, (o.esp || 2) * 3.2);
    c.beginPath(); c.moveTo(o.x1, o.y1); c.lineTo(o.x2 - Math.cos(a) * k * .5, o.y2 - Math.sin(a) * k * .5); c.stroke();
    c.beginPath(); c.moveTo(o.x2, o.y2); c.lineTo(o.x2 - k * Math.cos(a - .45), o.y2 - k * Math.sin(a - .45)); c.lineTo(o.x2 - k * Math.cos(a + .45), o.y2 - k * Math.sin(a + .45)); c.closePath(); c.fillStyle = o.cor; c.fill();
  }
  function desenharObj(c, o) {
    c.save();
    c.strokeStyle = o.cor; c.fillStyle = o.cor; c.lineWidth = o.esp || 2; c.lineCap = 'round'; c.lineJoin = 'round';
    const preenchido = o.pre ? (o.cor === '#ffffff' ? '#ffffff' : o.cor + '33') : null;
    if (o.t === 'caneta') {
      const p = o.p;
      if (p.length === 1) { c.beginPath(); c.arc(p[0][0], p[0][1], (o.esp || 2) / 2, 0, 7); c.fill(); }
      else { c.beginPath(); c.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; c.quadraticCurveTo(p[i][0], p[i][1], mx, my); } const u = p[p.length - 1]; c.lineTo(u[0], u[1]); c.stroke(); }
    } else if (o.t === 'ret') {
      c.beginPath(); if (c.roundRect) c.roundRect(o.x, o.y, o.w, o.h, Math.min(10, o.w / 4, o.h / 4)); else c.rect(o.x, o.y, o.w, o.h);
      if (preenchido) { c.fillStyle = preenchido; c.fill(); } c.stroke(); textoDentro(c, o, o.cor);
    } else if (o.t === 'elipse') {
      c.beginPath(); c.ellipse(o.x + o.w / 2, o.y + o.h / 2, Math.max(.5, o.w / 2), Math.max(.5, o.h / 2), 0, 0, 7);
      if (preenchido) { c.fillStyle = preenchido; c.fill(); } c.stroke(); textoDentro(c, o, o.cor);
    } else if (o.t === 'losango') {
      c.beginPath(); c.moveTo(o.x + o.w / 2, o.y); c.lineTo(o.x + o.w, o.y + o.h / 2); c.lineTo(o.x + o.w / 2, o.y + o.h); c.lineTo(o.x, o.y + o.h / 2); c.closePath();
      if (preenchido) { c.fillStyle = preenchido; c.fill(); } c.stroke(); textoDentro(c, o, o.cor);
    } else if (o.t === 'seta') seta(c, o);
    else if (o.t === 'texto') {
      c.font = fonte(o); c.textBaseline = 'top';
      String(o.txt || '').split('\n').forEach((l, i) => c.fillText(l, o.x + 2, o.y + 2 + i * (o.fs || 20) * 1.25));
    } else if (o.t === 'nota') {
      c.shadowColor = 'rgba(0,0,0,.18)'; c.shadowBlur = 10; c.shadowOffsetY = 3;
      c.fillStyle = o.fundo || NOTA; c.fillRect(o.x, o.y, o.w, o.h); c.shadowColor = 'transparent';
      textoDentro(c, o, '#3a3520');
    } else if (o.t === 'imagem') {
      let im = imgs.get(o.id);
      if (!im) { im = new Image(); im.onload = pedir; im.src = o.src; imgs.set(o.id, im); }
      if (im.complete && im.naturalWidth) c.drawImage(im, o.x, o.y, o.w, o.h);
      else { c.strokeStyle = '#bbb'; c.strokeRect(o.x, o.y, o.w, o.h); }
    }
    c.restore();
  }
  function desenhar() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    // pontinhos de fundo
    const passo = 24 * view.z;
    if (passo > 8) {
      g.fillStyle = 'rgba(80,80,110,.18)';
      const ox = ((view.x % passo) + passo) % passo, oy = ((view.y % passo) + passo) % passo;
      for (let x = ox; x < cv.width / dpr; x += passo) for (let y = oy; y < cv.height / dpr; y += passo) g.fillRect(x * dpr - dpr * .75, y * dpr - dpr * .75, dpr * 1.5, dpr * 1.5);
    }
    g.setTransform(dpr * view.z, 0, 0, dpr * view.z, dpr * view.x, dpr * view.y);
    objs.forEach(o => { if (o !== editandoObj) desenharObj(g, o); else if (o.t !== 'texto') desenharObj(g, Object.assign({}, o, { txt: '' })); });
    if (rascunho) desenharObj(g, rascunho);
    // seleção
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = '#7048e8'; g.lineWidth = 1.5; g.setLineDash([5, 4]);
    sel.forEach(o => {
      if (o.t === 'seta') { [[o.x1, o.y1], [o.x2, o.y2]].forEach(([x, y]) => { const [sx, sy] = tela(x, y); alca(sx, sy); }); return; }
      const [a, b, w, h] = caixa(o), [sx, sy] = tela(a, b);
      g.strokeRect(sx - 5, sy - 5, w * view.z + 10, h * view.z + 10);
      if (sel.length === 1 && o.t !== 'caneta') alca(sx + w * view.z + 5, sy + h * view.z + 5);
    });
    if (laco) { const [x1, y1] = tela(laco[0], laco[1]), [x2, y2] = tela(laco[2], laco[3]); g.fillStyle = 'rgba(112,72,232,.08)'; g.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); g.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); }
    g.setLineDash([]);
    marcar();
  }
  function alca(x, y) { g.save(); g.setLineDash([]); g.fillStyle = '#fff'; g.strokeStyle = '#7048e8'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.stroke(); g.restore(); }

  /* ---------- mouse, dedo e caneta ---------- */
  let rascunho = null, laco = null, acao = null, espaco = false, editandoObj = null;
  function ligarPonteiro() {
    cv.addEventListener('pointerdown', e => {
      if (editandoObj) fecharEditor();
      cv.focus({ preventScroll: true });
      const [x, y] = mundo(e);
      cv.setPointerCapture(e.pointerId);
      if (ferr === 'mao' || espaco || e.button === 1) { acao = { tipo: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; cv.style.cursor = 'grabbing'; return; }
      if (e.button > 0) return;
      if (ferr === 'sel') {
        // alça de tamanho / ponta da seta
        if (sel.length === 1) {
          const o = sel[0];
          if (o.t === 'seta') {
            for (const k of [1, 2]) { const [sx, sy] = tela(o['x' + k], o['y' + k]), r = cv.getBoundingClientRect(); if (Math.hypot(e.clientX - r.left - sx, e.clientY - r.top - sy) < 10) { marco(); acao = { tipo: 'ponta', o, k }; return; } }
          } else if (o.t !== 'caneta') {
            const [a, b, w, h] = caixa(o), [sx, sy] = tela(a + w, b + h), r = cv.getBoundingClientRect();
            if (Math.hypot(e.clientX - r.left - sx - 5, e.clientY - r.top - sy - 5) < 11) { marco(); acao = { tipo: 'tam', o, x0: x, y0: y, w0: o.w, h0: o.h, fs0: o.fs || 20, ar: o.h / o.w }; return; }
          }
        }
        const o = noTopo(x, y);
        if (o) {
          if (e.shiftKey) { sel = sel.includes(o) ? sel.filter(s => s !== o) : sel.concat(o); pedir(); return; }
          if (!sel.includes(o)) sel = [o];
          marco(); acao = { tipo: 'mover', x0: x, y0: y, mexeu: false }; pedir(); return;
        }
        if (!e.shiftKey) sel = [];
        laco = [x, y, x, y]; acao = { tipo: 'laco' }; pedir(); return;
      }
      if (ferr === 'borracha') { acao = { tipo: 'borracha', marcou: false }; borrar(x, y, acao); return; }
      if (ferr === 'texto' || ferr === 'nota') {
        const sob = noTopo(x, y);
        if (sob && (sob.t === 'texto' || sob.t === 'nota') && sob.t === ferr) { editar(sob); return; }
        marco();
        const o = ferr === 'texto' ? { id: novoId(), t: 'texto', x, y: y - 12, w: 40, h: 28, txt: '', cor, fs: 22 } : { id: novoId(), t: 'nota', x: x - 90, y: y - 70, w: 180, h: 160, txt: '', cor: '#3a3520', fs: 18 };
        objs.push(o); sel = [o]; editar(o, true); return;
      }
      marco();
      if (ferr === 'caneta') rascunho = { id: novoId(), t: 'caneta', p: [[x, y, e.pressure || .5]], cor, esp };
      else if (ferr === 'seta') rascunho = { id: novoId(), t: 'seta', x1: x, y1: y, x2: x, y2: y, cor, esp };
      else rascunho = { id: novoId(), t: ferr, x, y, w: 0, h: 0, cor, esp, pre: preench, txt: '', fs: 18 };
      acao = { tipo: 'criar', x0: x, y0: y };
      pedir();
    });
    cv.addEventListener('pointermove', e => {
      if (!acao) return;
      const [x, y] = mundo(e);
      if (acao.tipo === 'pan') { view.x = acao.vx + e.clientX - acao.sx; view.y = acao.vy + e.clientY - acao.sy; pedir(); return; }
      if (acao.tipo === 'mover') { const dx = x - acao.x0, dy = y - acao.y0; if (dx || dy) { sel.forEach(o => mover(o, dx, dy)); acao.x0 = x; acao.y0 = y; acao.mexeu = true; pedir(); } return; }
      if (acao.tipo === 'ponta') { acao.o['x' + acao.k] = x; acao.o['y' + acao.k] = y; pedir(); return; }
      if (acao.tipo === 'tam') {
        const o = acao.o;
        if (o.t === 'texto') { const k = Math.max(.3, (acao.w0 + x - acao.x0) / acao.w0); o.fs = Math.max(8, Math.min(200, Math.round(acao.fs0 * k))); medirTexto(o); }
        else { o.w = Math.max(10, acao.w0 + x - acao.x0); o.h = o.t === 'imagem' || e.shiftKey ? o.w * acao.ar : Math.max(10, acao.h0 + y - acao.y0); }
        pedir(); return;
      }
      if (acao.tipo === 'laco') { laco[2] = x; laco[3] = y; pedir(); return; }
      if (acao.tipo === 'borracha') { borrar(x, y, acao); return; }
      if (acao.tipo === 'criar' && rascunho) {
        if (rascunho.t === 'caneta') (e.getCoalescedEvents ? e.getCoalescedEvents() : [e]).forEach(ev => { const [a, b] = mundo(ev); rascunho.p.push([a, b, ev.pressure || .5]); });
        else if (rascunho.t === 'seta') { rascunho.x2 = x; rascunho.y2 = y; if (e.shiftKey) { const a = Math.round(Math.atan2(y - rascunho.y1, x - rascunho.x1) / (Math.PI / 4)) * Math.PI / 4, d = Math.hypot(x - rascunho.x1, y - rascunho.y1); rascunho.x2 = rascunho.x1 + Math.cos(a) * d; rascunho.y2 = rascunho.y1 + Math.sin(a) * d; } }
        else { let w = x - acao.x0, h = y - acao.y0; if (e.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; } rascunho.x = acao.x0; rascunho.y = acao.y0; rascunho.w = w; rascunho.h = h; }
        pedir();
      }
    });
    const fim = () => {
      if (!acao) return;
      const a = acao; acao = null;
      if (a.tipo === 'pan') { cv.style.cursor = ferr === 'mao' ? 'grab' : ''; usar(ferr); guardar(); return; }
      if (a.tipo === 'mover' && !a.mexeu) desfazer.pop();
      if (a.tipo === 'laco') {
        const [x1, y1, x2, y2] = laco, A = Math.min(x1, x2), B = Math.min(y1, y2), C = Math.max(x1, x2), D = Math.max(y1, y2);
        if (C - A > 2 || D - B > 2) objs.forEach(o => { const [a2, b2, w, h] = caixa(o); if (a2 >= A && b2 >= B && a2 + w <= C && b2 + h <= D && !sel.includes(o)) sel.push(o); });
        laco = null;
      }
      if (a.tipo === 'borracha' && !a.marcou) { /* nada apagado */ }
      if (a.tipo === 'criar' && rascunho) {
        const r = rascunho; rascunho = null;
        if (r.t !== 'caneta' && r.t !== 'seta') normal(r);
        const pequeno = r.t === 'caneta' ? false : r.t === 'seta' ? Math.hypot(r.x2 - r.x1, r.y2 - r.y1) < 4 : r.w < 4 && r.h < 4;
        if (pequeno) {
          // um clique só: forma de tamanho padrão
          if (r.t === 'seta') { desfazer.pop(); pedir(); return; }
          r.w = r.t === 'losango' ? 150 : 160; r.h = r.t === 'losango' ? 110 : 90; r.x -= r.w / 2; r.y -= r.h / 2;
        }
        if (r.t === 'caneta' && r.p.length > 2) r.p = simplificar(r.p, .6 / view.z);
        objs.push(r);
        if (r.t !== 'caneta') { sel = [r]; usar('sel'); sel = [r]; }
      }
      guardar(); pedir();
    };
    cv.addEventListener('pointerup', fim); cv.addEventListener('pointercancel', fim);
    cv.addEventListener('dblclick', e => {
      if (ferr !== 'sel') return;
      const [x, y] = mundo(e), o = noTopo(x, y);
      if (o && /ret|elipse|losango|texto|nota/.test(o.t)) { marco(); editar(o); }
      else if (!o) { usar('texto'); marco(); const n = { id: novoId(), t: 'texto', x, y: y - 12, w: 40, h: 28, txt: '', cor, fs: 22 }; objs.push(n); sel = [n]; editar(n, true); }
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { const r = cv.getBoundingClientRect(); zoom(Math.pow(1.0015, -e.deltaY), e.clientX - r.left, e.clientY - r.top); }
      else { view.x -= e.deltaX; view.y -= e.deltaY; pedir(); guardar(); }
    }, { passive: false });
    document.addEventListener('keydown', tecla);
    document.addEventListener('keyup', e => { if (e.code === 'Space' && espaco) { espaco = false; usar(ferr); } });
  }
  function simplificar(p, tol) { const o = [p[0]]; for (let i = 1; i < p.length - 1; i++) { const u = o[o.length - 1]; if (Math.hypot(p[i][0] - u[0], p[i][1] - u[1]) >= tol) o.push(p[i]); } o.push(p[p.length - 1]); return o; }
  function borrar(x, y, a) {
    const o = noTopo(x, y); if (!o) return;
    if (!a.marcou) { marco(); a.marcou = true; }
    objs = objs.filter(z => z !== o); sel = sel.filter(z => z !== o); imgs.delete(o.id); pedir();
  }
  function zoom(k, cx, cy) {
    const nz = Math.max(.1, Math.min(6, view.z * k));
    if (cx == null) { cx = palco.clientWidth / 2; cy = palco.clientHeight / 2; }
    view.x = cx - (cx - view.x) * (nz / view.z); view.y = cy - (cy - view.y) * (nz / view.z); view.z = nz;
    pedir(); guardar();
  }
  function limites(L) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    (L || objs).forEach(o => { const [x, y, w, h] = caixa(o), m = (o.esp || 2) + (o.t === 'seta' ? (o.esp || 2) * 3 : 0); a = Math.min(a, x - m); b = Math.min(b, y - m); c = Math.max(c, x + w + m); d = Math.max(d, y + h + m); });
    return isFinite(a) ? [a, b, c - a, d - b] : null;
  }
  function mostrarTudo() {
    const L = limites(); if (!L) { view = { x: 0, y: 0, z: 1 }; pedir(); return; }
    const W = palco.clientWidth, H = palco.clientHeight, z = Math.max(.1, Math.min(2, (W - 80) / L[2], (H - 80) / L[3]));
    view = { z, x: W / 2 - (L[0] + L[2] / 2) * z, y: H / 2 - (L[1] + L[3] / 2) * z }; pedir(); guardar();
  }
  function apagarSel() { if (!sel.length) return; marco(); objs = objs.filter(o => !sel.includes(o)); sel.forEach(o => imgs.delete(o.id)); sel = []; guardar(); pedir(); }
  function tecla(e) {
    if (UT.atual !== 'quadro' || editandoObj) return;
    const alvo = e.target, digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable);
    if (digitando || !$('#qbPop', el).hidden) return;
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); voltar(desfazer, refazer); return; }
    if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); voltar(refazer, desfazer); return; }
    if (ctrl && k === 'a') { e.preventDefault(); usar('sel'); sel = objs.slice(); pedir(); return; }
    if (ctrl && k === 'd' && sel.length) { e.preventDefault(); marco(); const novos = sel.map(o => { const c = JSON.parse(JSON.stringify(o)); c.id = novoId(); mover(c, 20, 20); return c; }); objs.push(...novos); sel = novos; guardar(); pedir(); return; }
    if (ctrl) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { if (sel.length) { e.preventDefault(); apagarSel(); } return; }
    if (e.key === 'Escape') { sel = []; pedir(); return; }
    if (e.code === 'Space') { if (!espaco) { espaco = true; cv.style.cursor = 'grab'; } e.preventDefault(); return; }
    if (e.key.startsWith('Arrow') && sel.length) { e.preventDefault(); const d = e.shiftKey ? 10 : 1; marco(); sel.forEach(o => mover(o, e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0)); guardar(); pedir(); return; }
    if (e.altKey) return;
    const f = FERRS.find(x => x[1].toLowerCase() === k); if (f) { e.preventDefault(); usar(f[0]); }
  }

  /* ---------- escrever ---------- */
  let editor = null, editNovo = false;
  function editar(o, novo) {
    fecharEditor();
    editandoObj = o; editNovo = !!novo;
    const ta = editor = document.createElement('textarea');
    ta.className = 'qb-txt'; ta.value = o.txt || ''; ta.spellcheck = true; ta.setAttribute('aria-label', T('Texto'));
    const fs = (o.fs || 20) * view.z;
    ta.style.fontSize = fs + 'px'; ta.style.fontWeight = o.t === 'texto' ? '500' : '600'; ta.style.color = o.t === 'nota' ? '#3a3520' : o.cor;
    if (o.t === 'nota') ta.style.background = NOTA;
    const pos = () => {
      const [sx, sy] = tela(o.x, o.y);
      if (o.t === 'texto') { ta.style.left = sx + 'px'; ta.style.top = sy + 'px'; ta.style.width = Math.max(80, (o.w + 30) * view.z) + 'px'; ta.style.height = Math.max(fs * 1.4, o.h * view.z + 6) + 'px'; ta.style.textAlign = 'left'; }
      else { ta.style.left = sx + 'px'; ta.style.top = sy + 'px'; ta.style.width = o.w * view.z + 'px'; ta.style.height = o.h * view.z + 'px'; ta.style.textAlign = o.t === 'nota' ? 'left' : 'center'; ta.style.padding = o.t === 'nota' ? 12 * view.z + 'px' : Math.max(4, (o.h * view.z - fs * 1.3) / 2) + 'px 6px'; }
    };
    pos();
    ta.addEventListener('input', () => { o.txt = ta.value; if (o.t === 'texto') { medirTexto(o); pos(); } });
    ta.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); fecharEditor(); } });
    ta.addEventListener('blur', () => setTimeout(fecharEditor, 0));
    palco.appendChild(ta); pedir();
    setTimeout(() => { ta.focus(); ta.select(); }, 0);
  }
  function fecharEditor() {
    if (!editandoObj) return;
    const o = editandoObj; editandoObj = null;
    if (editor) { o.txt = editor.value; editor.remove(); editor = null; }
    if (o.t === 'texto') { if (!String(o.txt).trim()) { objs = objs.filter(x => x !== o); sel = []; if (editNovo) desfazer.pop(); } else medirTexto(o); }
    if (ferr === 'texto' || ferr === 'nota') usar('sel');
    guardar(); pedir();
  }

  /* ---------- imagens ---------- */
  async function inserirImagem(f) {
    try {
      const bm = await createImageBitmap(f, { imageOrientation: 'from-image' });
      const k = Math.min(1, 1400 / Math.max(bm.width, bm.height)), c = document.createElement('canvas');
      c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
      const src = /png|gif|svg/.test(f.type) ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', .86);
      const W = palco.clientWidth, H = palco.clientHeight, z = Math.min(1, (W * .6) / c.width / view.z, (H * .6) / c.height / view.z);
      const w = c.width * z, h = c.height * z, cx = (W / 2 - view.x) / view.z, cy = (H / 2 - view.y) / view.z;
      marco(); const o = { id: novoId(), t: 'imagem', x: cx - w / 2, y: cy - h / 2, w, h, src }; objs.push(o); usar('sel'); sel = [o]; guardar(); pedir();
      return true;
    } catch (e) { UT.aviso(T('Não foi possível ler a imagem.'), true); return false; }
  }

  /* ---------- salvar e abrir ---------- */
  function pngQuadro(fundo) {
    const L = limites(); if (!L) return Promise.resolve(null);
    const m = 32, k = Math.min(2, 8000 / Math.max(L[2] + 2 * m, L[3] + 2 * m));
    const c = document.createElement('canvas'); c.width = Math.ceil((L[2] + 2 * m) * k); c.height = Math.ceil((L[3] + 2 * m) * k);
    const x = c.getContext('2d');
    if (fundo !== false) { x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); }
    x.setTransform(k, 0, 0, k, (m - L[0]) * k, (m - L[1]) * k);
    objs.forEach(o => desenharObj(x, o));
    return new Promise(r => c.toBlob(r, 'image/png'));
  }
  function svgQuadro() {
    const L = limites(); if (!L) return null;
    const m = 32, a = (s) => esc(String(s));
    const txt = (o, cx, cy, anc, corT) => {
      if (!o.txt) return '';
      g.save(); g.font = fonte(o);
      const fs = o.fs || 20, lh = fs * 1.25, pad = o.t === 'losango' ? o.w * .22 : 10, Ls = o.t === 'texto' ? String(o.txt).split('\n') : linhas(g, o.txt, Math.max(20, o.w - pad * 2));
      g.restore();
      const y0 = o.t === 'texto' || o.t === 'nota' ? cy : cy - (Ls.length - 1) * lh / 2;
      return `<text font-family="Figtree, system-ui, sans-serif" font-size="${fs}" font-weight="${o.t === 'texto' ? 500 : 600}" fill="${a(corT)}" text-anchor="${anc}" ${o.t === 'texto' || o.t === 'nota' ? 'dominant-baseline="hanging"' : 'dominant-baseline="middle"'}>` +
        Ls.map((l, i) => `<tspan x="${cx}" y="${y0 + i * lh}">${a(l)}</tspan>`).join('') + '</text>';
    };
    const corpo = objs.map(o => {
      const st = `stroke="${a(o.cor)}" stroke-width="${o.esp || 2}" stroke-linecap="round" stroke-linejoin="round"`, fill = o.pre ? (o.cor === '#ffffff' ? '#ffffff' : a(o.cor) + '33') : 'none';
      if (o.t === 'caneta') return `<path d="M${o.p.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L')}" fill="none" ${st}/>`;
      if (o.t === 'ret') return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${Math.min(10, o.w / 4, o.h / 4)}" fill="${fill}" ${st}/>` + txt(o, o.x + o.w / 2, o.y + o.h / 2, 'middle', o.cor);
      if (o.t === 'elipse') return `<ellipse cx="${o.x + o.w / 2}" cy="${o.y + o.h / 2}" rx="${o.w / 2}" ry="${o.h / 2}" fill="${fill}" ${st}/>` + txt(o, o.x + o.w / 2, o.y + o.h / 2, 'middle', o.cor);
      if (o.t === 'losango') return `<path d="M${o.x + o.w / 2} ${o.y}L${o.x + o.w} ${o.y + o.h / 2}L${o.x + o.w / 2} ${o.y + o.h}L${o.x} ${o.y + o.h / 2}Z" fill="${fill}" ${st}/>` + txt(o, o.x + o.w / 2, o.y + o.h / 2, 'middle', o.cor);
      if (o.t === 'seta') { const an = Math.atan2(o.y2 - o.y1, o.x2 - o.x1), k = Math.max(10, (o.esp || 2) * 3.2); return `<path d="M${o.x1} ${o.y1}L${o.x2 - Math.cos(an) * k * .5} ${o.y2 - Math.sin(an) * k * .5}" fill="none" ${st}/><path d="M${o.x2} ${o.y2}L${o.x2 - k * Math.cos(an - .45)} ${o.y2 - k * Math.sin(an - .45)}L${o.x2 - k * Math.cos(an + .45)} ${o.y2 - k * Math.sin(an + .45)}Z" fill="${a(o.cor)}"/>`; }
      if (o.t === 'texto') return txt(o, o.x + 2, o.y + 2, 'start', o.cor);
      if (o.t === 'nota') return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="${NOTA}"/>` + txt(o, o.x + 12, o.y + 12, 'start', '#3a3520');
      if (o.t === 'imagem') return `<image href="${a(o.src)}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" preserveAspectRatio="none"/>`;
      return '';
    }).join('\n');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${L[0] - m} ${L[1] - m} ${L[2] + 2 * m} ${L[3] + 2 * m}" width="${Math.round(L[2] + 2 * m)}" height="${Math.round(L[3] + 2 * m)}"><rect x="${L[0] - m}" y="${L[1] - m}" width="${L[2] + 2 * m}" height="${L[3] + 2 * m}" fill="#ffffff"/>\n${corpo}\n</svg>`;
  }
  async function acaoMenu(q) {
    if (q !== 'abrir' && q !== 'limpar' && !objs.length) { UT.aviso(T('O quadro está vazio.'), true); return; }
    const d = new Date(), nome = T('quadro') + '-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (q === 'png') UT.baixar(await pngQuadro(), nome + '.png');
    else if (q === 'svg') UT.baixar(new Blob([svgQuadro()], { type: 'image/svg+xml' }), nome + '.svg');
    else if (q === 'json') UT.baixar(new Blob([JSON.stringify({ app: 'nebulosa-utilidades-quadro', versao: 1, objs })], { type: 'application/json' }), nome + '.json');
    else if (q === 'mandar') UT.N.mandar({ rotulo: 'Quadro branco (imagem)', tipo: 'imagem', nome: nome + '.png', obter: () => pngQuadro() });
    else if (q === 'abrir') {
      const fs = await UT.escolher('.json,application/json'); if (!fs[0]) return;
      try {
        const j = JSON.parse(await fs[0].text());
        if (!j || j.app !== 'nebulosa-utilidades-quadro' || !Array.isArray(j.objs)) throw new Error('formato');
        if (objs.length && !confirm(T('Trocar o quadro atual pelo arquivo aberto? (Dá para desfazer com Ctrl+Z.)'))) return;
        marco(); objs = j.objs.filter(o => o && o.t); sel = []; imgs.clear(); guardar(); mostrarTudo();
      } catch (e) { UT.aviso(T('Esse arquivo não é um quadro salvo pelas Utilidades.'), true); }
    } else if (q === 'limpar') {
      if (!objs.length) return;
      if (!confirm(T('Apagar tudo o que está no quadro? (Dá para desfazer com Ctrl+Z.)'))) return;
      marco(); objs = []; sel = []; imgs.clear(); guardar(); pedir();
    }
  }

  UT.registrar('quadro', {
    montar,
    abrir() { requestAnimationFrame(redimensionar); },
    conteudos: () => objs.length ? [{ id: 'quadro', rotulo: 'Quadro branco (imagem)', detalhe: T('{1} elementos', objs.length), tipo: 'imagem', nome: T('quadro') + '.png', obter: () => pngQuadro() }] : [],
    aceita: info => info.tipoUtil === 'imagem',
    receber: info => inserirImagem(info.arquivo),
    ocupado: () => !!acao || !!editandoObj
  });
  if (UT.N && UT.N.idiomas) UT.N.idiomas.aoMudar(() => { if (el) usar(ferr); });
})();
