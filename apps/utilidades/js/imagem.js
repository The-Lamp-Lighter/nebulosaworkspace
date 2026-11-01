/* ==========================================================================
   Utilidades — Imagens (js/imagem.js)
   Comprime, redimensiona e converte fotos (JPEG, WebP, PNG) no próprio navegador.
   Os dados de câmera e localização (EXIF) saem junto, porque a imagem é redesenhada.
   ========================================================================== */
(function () {
  'use strict';
  const { $, $$, esc, T, ICO, tam, num } = UT;
  const op = Object.assign({ formato: 'jpeg', q: 80, modo: 'caixa', maxL: 1920, maxA: 1920, pct: 50 }, UT.ler('imagem', {}));
  let el, itens = [], seq = 0, trab = null;
  const MIME = { jpeg: 'image/jpeg', webp: 'image/webp', png: 'image/png' };
  const EXT = { jpeg: '.jpg', webp: '.webp', png: '.png' };

  function montar(v) {
    el = v;
    v.innerHTML = `<div class="cab"><div><h1>Imagens</h1><p>Deixe fotos mais leves para mandar por e-mail, WhatsApp ou colocar num site. As imagens não saem do seu computador.</p></div>
      <div class="linha"><button class="btn" id="imLimpar" hidden>${ICO.lixo}<span>Limpar</span></button><button class="btn pri" id="imZip" hidden>${ICO.baixar}<span>Baixar todas (.zip)</span></button></div></div>
      <div class="grade2 l">
        <div class="solte" id="imSolte"><b>Solte as imagens aqui</b>ou clique para escolher · também dá para colar com Ctrl+V<br><button class="btn pri" data-escolher>${ICO.imagem}<span>Escolher imagens</span></button></div>
        <div class="painel">
          <div class="campo"><span class="rot">Formato</span><div class="seg" id="imFmt"><button data-f="jpeg">JPEG</button><button data-f="webp">WebP</button><button data-f="png">PNG</button><button data-f="manter">Manter</button></div></div>
          <label class="campo" id="imQc"><span>Qualidade: <b id="imQv"></b></span><input type="range" id="imQ" min="30" max="100" step="1"><small>80% costuma ser o melhor equilíbrio entre tamanho e qualidade.</small></label>
          <div class="campo"><span class="rot">Tamanho</span><div class="seg" id="imModo"><button data-m="nao">Original</button><button data-m="caixa">Até um limite</button><button data-m="pct">Porcentagem</button></div></div>
          <div class="linha" id="imCaixa"><label class="campo" style="flex:1"><span>Largura máxima (px)</span><input class="in num" id="imL" type="number" min="16" max="16000"></label><label class="campo" style="flex:1"><span>Altura máxima (px)</span><input class="in num" id="imA" type="number" min="16" max="16000"></label></div>
          <label class="campo" id="imPctc"><span>Porcentagem: <b id="imPv"></b></span><input type="range" id="imPct" min="5" max="100" step="5"></label>
          <p class="dica">Ao comprimir, as informações escondidas da foto (câmera, data e localização) são removidas.</p>
        </div>
      </div>
      <p class="aviso" id="imResumo" hidden></p>
      <div class="imgs" id="imLista"></div>`;
    UT.zona($('#imSolte', v), { accept: 'image/*', multiplo: true, filtro: UT.ehImagem, recusa: T('Escolha arquivos de imagem (JPG, PNG, WebP, GIF…).'), aoArquivos: adicionar });
    $('#imFmt', v).addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { op.formato = b.dataset.f; mudou(); } });
    $('#imModo', v).addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { op.modo = b.dataset.m; mudou(); } });
    $('#imQ', v).addEventListener('input', () => { op.q = +$('#imQ', v).value; mudou(); });
    $('#imPct', v).addEventListener('input', () => { op.pct = +$('#imPct', v).value; mudou(); });
    $('#imL', v).addEventListener('input', () => { op.maxL = Math.max(16, +$('#imL', v).value || 0); mudou(); });
    $('#imA', v).addEventListener('input', () => { op.maxA = Math.max(16, +$('#imA', v).value || 0); mudou(); });
    $('#imLimpar', v).addEventListener('click', () => { itens.forEach(soltarUrls); itens = []; render(); });
    $('#imZip', v).addEventListener('click', baixarZip);
    $('#imLista', v).addEventListener('click', e => {
      const c = e.target.closest('[data-id]'); if (!c) return;
      const it = itens.find(x => x.id === +c.dataset.id); if (!it) return;
      if (e.target.closest('[data-baixar]') && it.res) UT.baixar(it.res.blob, it.res.nome);
      if (e.target.closest('[data-tirar]')) { soltarUrls(it); itens = itens.filter(x => x !== it); render(); }
    });
    $('#imQ', v).value = op.q; $('#imPct', v).value = op.pct; $('#imL', v).value = op.maxL; $('#imA', v).value = op.maxA;
    document.addEventListener('paste', e => {
      if (UT.atual !== 'imagem' || !e.clipboardData) return;
      const fs = [...e.clipboardData.files].filter(UT.ehImagem);
      if (fs.length) { e.preventDefault(); adicionar(fs.map((f, i) => f.name && f.name !== 'image.png' ? f : new File([f], T('imagem-colada') + (i ? '-' + (i + 1) : '') + '.png', { type: f.type || 'image/png' }))); }
    });
    controles();
  }
  function controles() {
    $$('#imFmt [data-f]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === op.formato)));
    $$('#imModo [data-m]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === op.modo)));
    $('#imQv', el).textContent = op.q + '%'; $('#imPv', el).textContent = op.pct + '%';
    $('#imQc', el).hidden = op.formato === 'png';
    $('#imCaixa', el).hidden = op.modo !== 'caixa';
    $('#imPctc', el).hidden = op.modo !== 'pct';
  }
  let mT = null;
  function mudou() {
    controles();
    UT.guardar('imagem', { formato: op.formato, q: op.q, modo: op.modo, maxL: op.maxL, maxA: op.maxA, pct: op.pct });
    clearTimeout(mT); mT = setTimeout(() => processarTudo(), 280);
  }
  function soltarUrls(it) { try { URL.revokeObjectURL(it.url); if (it.res) URL.revokeObjectURL(it.res.url); } catch (e) { /* ignora */ } }
  async function adicionar(fs) {
    for (const f of fs) {
      if (itens.length >= 200) { UT.aviso(T('Até 200 imagens de cada vez.'), true); break; }
      itens.push({ id: ++seq, file: f, nome: f.name || 'imagem', url: URL.createObjectURL(f), res: null, erro: '' });
    }
    render(); processarTudo();
  }
  async function processarTudo() {
    const meu = trab = {};
    for (const it of itens) {
      if (trab !== meu) return;
      it.proc = true; renderItem(it);
      try { await processar(it); it.erro = ''; } catch (e) { console.error(e); it.erro = T('Não foi possível ler esta imagem.'); }
      it.proc = false;
      if (trab !== meu) return;
      renderItem(it); resumo();
    }
  }
  async function bitmap(f) {
    if (window.createImageBitmap && !/svg/.test(f.type)) {
      try { return await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch (e) { /* tenta pelo <img> */ }
    }
    const u = URL.createObjectURL(f);
    try {
      const im = new Image(); im.decoding = 'async'; im.src = u;
      await im.decode();
      return im;
    } finally { setTimeout(() => URL.revokeObjectURL(u), 1000); }
  }
  async function processar(it) {
    const bm = await bitmap(it.file);
    const w0 = bm.width || bm.naturalWidth, h0 = bm.height || bm.naturalHeight;
    if (!w0 || !h0) throw new Error('sem tamanho');
    it.w = w0; it.h = h0;
    let k = 1;
    if (op.modo === 'caixa') k = Math.min(1, op.maxL / w0, op.maxA / h0);
    else if (op.modo === 'pct') k = op.pct / 100;
    k = Math.min(k, Math.sqrt(2.6e8 / (w0 * h0)), 16000 / w0, 16000 / h0);
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    let fmt = op.formato;
    if (fmt === 'manter') fmt = /png|gif|svg|bmp/.test(it.file.type) ? 'png' : /webp/.test(it.file.type) ? 'webp' : 'jpeg';
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (fmt === 'jpeg') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); } // JPEG não tem transparência: fundo branco
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(bm, 0, 0, w, h);
    if (bm.close) bm.close();
    let blob = await new Promise(r => c.toBlob(r, MIME[fmt], op.q / 100));
    if (!blob) throw new Error('falhou');
    if (fmt === 'webp' && blob.type !== 'image/webp') { fmt = 'png'; } // navegador sem WebP
    if (it.res) URL.revokeObjectURL(it.res.url);
    it.res = { blob, url: URL.createObjectURL(blob), w, h, nome: UT.semExt(it.nome) + EXT[fmt], fmt };
    c.width = c.height = 0;
  }
  function itemHtml(it) {
    const r = it.res;
    let corpo;
    if (it.erro) corpo = `<span class="tm" style="color:var(--err)">${esc(it.erro)}</span>`;
    else if (!r || it.proc) corpo = `<span class="tm">${esc(tam(it.file.size))} · ${esc(T('processando…'))}</span>`;
    else {
      const p = Math.round((1 - r.blob.size / it.file.size) * 100);
      corpo = `<span class="tm">${esc(tam(it.file.size))} → <b>${esc(tam(r.blob.size))}</b></span><span class="tm">${it.w}×${it.h} → ${r.w}×${r.h} px</span>` +
        (p >= 0 ? `<span class="eco">−${p}%</span>` : `<span class="eco pior">${esc(T('ficou {1}% maior: baixe a qualidade ou escolha JPEG/WebP', -p))}</span>`);
    }
    return `<div class="imgc" data-id="${it.id}"><div class="th"><img src="${r && !it.proc ? r.url : it.url}" alt="" loading="lazy"></div>
      <div class="inf"><span class="nm" title="${esc(it.nome)}">${esc(r ? r.nome : it.nome)}</span>${corpo}</div>
      <div class="ac"><button class="btn peq pri" data-baixar ${r && !it.proc ? '' : 'disabled'}>${ICO.baixar}<span>Baixar</span></button><button class="btn peq so" data-tirar title="Tirar da lista" aria-label="Tirar da lista">${ICO.x}</button></div></div>`;
  }
  function renderItem(it) {
    const o = $('#imLista [data-id="' + it.id + '"]', el);
    if (o) o.outerHTML = itemHtml(it);
  }
  function render() {
    $('#imLista', el).innerHTML = itens.map(itemHtml).join('');
    $('#imLimpar', el).hidden = $('#imZip', el).hidden = !itens.length;
    resumo();
  }
  function resumo() {
    const p = $('#imResumo', el), ok = itens.filter(x => x.res && !x.proc);
    if (!ok.length) { p.hidden = true; return; }
    const a = ok.reduce((s, x) => s + x.file.size, 0), b = ok.reduce((s, x) => s + x.res.blob.size, 0);
    p.hidden = false;
    p.textContent = T('{1} imagens: {2} → {3} ({4}% a menos)', ok.length, tam(a), tam(b), num(Math.max(0, (1 - b / a) * 100), 0));
  }
  async function baixarZip() {
    const ok = itens.filter(x => x.res && !x.proc);
    if (!ok.length) return;
    if (ok.length === 1) { UT.baixar(ok[0].res.blob, ok[0].res.nome); return; }
    try {
      UT.aviso(T('Preparando o arquivo .zip…'));
      const Z = await UT.jszip(), z = new Z(), usados = {};
      ok.forEach(x => {
        let n = x.res.nome; const b = UT.semExt(n), e = n.slice(b.length); let i = 1;
        while (usados[n.toLowerCase()]) n = b + ' (' + (++i) + ')' + e;
        usados[n.toLowerCase()] = 1; z.file(n, x.res.blob);
      });
      const blob = await z.generateAsync({ type: 'blob', compression: 'STORE' });
      UT.baixar(blob, T('imagens') + '.zip');
    } catch (e) { UT.aviso(e.message || String(e), true); }
  }
  UT.registrar('imagem', {
    montar,
    conteudos: () => itens.filter(x => x.res && !x.proc).slice(0, 12).map(x => ({ id: 'img' + x.id, rotulo: x.res.nome, detalhe: tam(x.res.blob.size) + ' · ' + x.res.w + '×' + x.res.h, tipo: 'imagem', nome: x.res.nome, obter: () => x.res.blob })),
    aceita: info => info.tipoUtil === 'imagem',
    receber: info => { adicionar([info.arquivo instanceof File ? info.arquivo : new File([info.arquivo], info.nome, { type: info.arquivo.type || 'image/png' })]); return true; },
    ocupado: () => itens.length > 0
  });
})();
