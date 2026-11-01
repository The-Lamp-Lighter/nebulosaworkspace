/* ==========================================================================
   Utilidades — PDF (js/pdf.js)
   Juntar (PDFs e imagens), dividir/extrair/remover páginas, girar e assinar.
   pdf-lib monta os arquivos; PDF.js desenha as miniaturas. Tudo no navegador.
   ========================================================================== */
(function () {
  'use strict';
  const { $, $$, esc, T, ICO, tam, num } = UT;
  const SUBS = [['juntar', 'Juntar'], ['dividir', 'Dividir'], ['girar', 'Girar'], ['assinar', 'Assinar']];
  let el, sub = UT.ler('pdf.sub', 'juntar');
  const res = {};          // último resultado de cada parte: { blob, nome }
  let lista = [], seq = 0; // Juntar
  let doc = null;          // Dividir, Girar e Assinar usam o mesmo documento aberto

  /* ---------- leitura ---------- */
  function erroPdf(e) {
    const m = String((e && (e.name + ' ' + e.message)) || e);
    if (/Password|Encrypt/i.test(m)) return T('Este PDF é protegido por senha. Tire a senha antes (no programa que criou o arquivo) e tente de novo.');
    if (/Invalid PDF|No PDF header|not a PDF|Failed to parse/i.test(m)) return T('Este arquivo não parece ser um PDF válido.');
    return T('Não foi possível ler o PDF: {1}', (e && e.message) || m);
  }
  async function abrirPjs(bytes) {
    const lib = await UT.pdfjs();
    return lib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, verbosity: 0 }).promise;
  }
  async function carregarDoc(f) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const PL = await UT.pdflib();
    const d = await PL.PDFDocument.load(bytes, { updateMetadata: false }); // erro aqui = senha ou arquivo estragado
    const pjs = await abrirPjs(bytes);
    return { file: f, nome: f.name || 'documento.pdf', bytes, n: d.getPageCount(), pjs, mini: [], view: [], rot: [], sel: new Set(), giro: [], marcas: [] };
  }
  // miniaturas: uma de cada vez, só quando aparecem na tela
  const fila = []; let desenhando = false;
  function pedirMini(d, i, cv) { fila.push([d, i, cv]); if (!desenhando) proxima(); }
  async function proxima() {
    const x = fila.shift(); if (!x) { desenhando = false; return; }
    desenhando = true;
    const [d, i, cv] = x;
    try {
      if (!d.mini[i]) {
        const p = await d.pjs.getPage(i + 1);
        const v1 = p.getViewport({ scale: 1 });
        d.view[i] = p.view.slice(); d.rot[i] = p.rotate || 0;
        const k = Math.min(200 / v1.width, 260 / v1.height), vp = p.getViewport({ scale: k * (window.devicePixelRatio > 1 ? 1.5 : 1) });
        const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
        await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        d.mini[i] = c;
      }
      if (cv.isConnected) { cv.width = d.mini[i].width; cv.height = d.mini[i].height; cv.getContext('2d').drawImage(d.mini[i], 0, 0); }
    } catch (e) { console.warn(e); }
    proxima();
  }
  function observar(raiz, d) {
    if (raiz._obs) raiz._obs.disconnect();
    const obs = raiz._obs = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      obs.unobserve(e.target);
      const cv = e.target.querySelector('canvas'); if (cv) pedirMini(d, +e.target.dataset.i, cv);
    }), { root: $('#main'), rootMargin: '400px' });
    $$('[data-i]', raiz).forEach(x => obs.observe(x));
  }
  function nomeSaida(base, suf) { return UT.nomeSeguro(UT.semExt(base) + '-' + T(suf), 'documento') + '.pdf'; }
  async function salvar(pdfDoc, nome, chave) {
    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    res[chave] = { blob, nome };
    UT.baixar(blob, nome);
    mostrarRes(chave);
    return blob;
  }
  function mostrarRes(chave) {
    const r = res[chave], box = $('#pdfRes-' + chave, el);
    if (!box) return;
    if (!r) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<span>${ICO.ok}</span><span style="flex:1">${esc(T('Pronto: {1} ({2}). O arquivo foi baixado.', r.nome, tam(r.blob.size)))}</span>
      <button class="btn peq" data-rebaixar="${chave}">${ICO.baixar}<span>Baixar de novo</span></button>` +
      (UT.N && UT.N.inWorkspace ? `<button class="btn peq" data-remandar="${chave}">${ICO.mandar}<span>Mandar para…</span></button>` : '');
  }
  function ocupar(btn, sim, txt) {
    btn.disabled = sim;
    if (sim) { btn.dataset.txt = btn.innerHTML; btn.innerHTML = '<span>' + esc(txt || T('Trabalhando…')) + '</span>'; }
    else if (btn.dataset.txt) { btn.innerHTML = btn.dataset.txt; delete btn.dataset.txt; }
  }

  /* ---------- tela ---------- */
  function montar(v) {
    el = v;
    v.innerHTML = `<div class="cab"><div><h1>PDF</h1><p>Junte, divida, gire e assine PDFs aqui mesmo: os arquivos não são enviados para nenhum site.</p></div></div>
      <div class="abas" role="tablist">${SUBS.map(s => `<button role="tab" data-sub="${s[0]}" aria-selected="false">${esc(s[1])}</button>`).join('')}</div>
      <section data-p="juntar">
        <div class="solte" id="pjSolte"><b>Solte PDFs e imagens aqui</b>na ordem que quiser · as imagens viram páginas<br><button class="btn pri" data-escolher>${ICO.arquivo}<span>Escolher arquivos</span></button></div>
        <ul class="arqs" id="pjLista"></ul>
        <div class="painel" id="pjOpc" hidden style="margin-top:14px">
          <div class="linha"><label class="campo" style="margin:0"><span>Páginas das imagens</span><select class="in" id="pjTam"><option value="a4">Folha A4, com a imagem inteira</option><option value="img">Do tamanho da imagem</option></select></label>
          <span class="espaco"></span><span class="dica" id="pjConta" style="margin:0"></span><button class="btn pri" id="pjIr">${ICO.baixar}<span>Juntar e baixar</span></button></div>
        </div>
        <div class="aviso ok" id="pdfRes-juntar" hidden style="margin-top:12px;align-items:center"></div>
      </section>
      <section data-p="dividir" hidden>
        <div data-doc></div>
        <div class="painel" data-com-doc hidden>
          <div class="seg" id="pdModo"><button data-m="selecao">Extrair as selecionadas</button><button data-m="remover">Remover as selecionadas</button><button data-m="intervalos">Por intervalos</button><button data-m="todas">Uma página por arquivo</button></div>
          <div id="pdIntBox" hidden style="margin-top:12px"><label class="campo"><span>Intervalos</span><input class="in mono" id="pdInt" placeholder="1-3, 5, 8-10" autocomplete="off"><small>Cada intervalo vira um arquivo. Ex.: “1-3, 4-6” gera dois PDFs.</small></label></div>
          <div class="linha" style="margin-top:12px"><button class="btn peq" id="pdTodas">Selecionar todas</button><button class="btn peq" id="pdNenhuma">Limpar seleção</button><span class="dica" id="pdInfo" style="margin:0"></span><span class="espaco"></span><button class="btn pri" id="pdIr">${ICO.baixar}<span>Dividir e baixar</span></button></div>
        </div>
        <div class="aviso ok" id="pdfRes-dividir" hidden style="margin-top:12px;align-items:center"></div>
        <div class="pags" id="pdPags"></div>
      </section>
      <section data-p="girar" hidden>
        <div data-doc></div>
        <div class="painel" data-com-doc hidden>
          <div class="linha"><button class="btn" id="pgTodasE">${ICO.girarE}<span>Todas para a esquerda</span></button><button class="btn" id="pgTodasD">${ICO.girarD}<span>Todas para a direita</span></button><button class="btn so" id="pgZerar">Desfazer giros</button><span class="espaco"></span><button class="btn pri" id="pgIr">${ICO.baixar}<span>Salvar PDF girado</span></button></div>
          <p class="dica">Use as setas de cada página para girar só aquela.</p>
        </div>
        <div class="aviso ok" id="pdfRes-girar" hidden style="margin-top:12px;align-items:center"></div>
        <div class="pags" id="pgPags"></div>
      </section>
      <section data-p="assinar" hidden>
        <div data-doc></div>
        <div class="grade2 l" data-com-doc hidden>
          <div class="painel">
            <div class="nav-pag"><button class="btn peq" id="paAnt" aria-label="Página anterior">${ICO.esq}</button><span class="num" id="paPag" style="white-space:nowrap"></span><button class="btn peq" id="paProx" aria-label="Próxima página">${ICO.dir}</button></div>
            <div style="overflow:auto;text-align:center"><div class="ass-area" id="paArea"><canvas class="pg" id="paCanvas"></canvas></div></div>
            <p class="dica">Arraste a assinatura para o lugar certo; a bolinha muda o tamanho.</p>
          </div>
          <div>
            <div class="painel">
              <div class="seg" id="paModo"><button data-m="desenhar">Desenhar</button><button data-m="escrever">Escrever</button><button data-m="imagem">Imagem</button></div>
              <div id="paDesenhar" style="margin-top:12px"><canvas class="desenho" id="paPad" aria-label="Área para desenhar a assinatura"></canvas>
                <div class="linha" style="margin-top:8px"><span class="rot">Cor</span><button class="btn peq" data-tinta="#111111">Preta</button><button class="btn peq" data-tinta="#1a3fa8">Azul</button><span class="espaco"></span><button class="btn peq so" id="paApagar">Apagar</button></div></div>
              <div id="paEscrever" hidden style="margin-top:12px"><label class="campo"><span>Seu nome</span><input class="in" id="paNome" autocomplete="name"></label>
                <label class="campo"><span>Estilo</span><select class="in" id="paFonte"><option value="'Segoe Script','Brush Script MT','Lucida Handwriting',cursive">Cursiva</option><option value="'Lucida Handwriting','Segoe Print','Comic Sans MS',cursive">Manuscrita</option><option value="Georgia,'Times New Roman',serif">Clássica</option></select></label></div>
              <div id="paImagem" hidden style="margin-top:12px"><button class="btn" id="paImg">${ICO.imagem}<span>Escolher imagem da assinatura</span></button><label class="chk" style="margin-top:8px"><input type="checkbox" id="paFundo" checked> Tirar o fundo branco</label><p class="dica">Uma foto da assinatura em papel branco funciona bem.</p></div>
              <div class="linha" style="margin-top:12px"><button class="btn pri" id="paColocar">${ICO.mais}<span>Colocar na página</span></button><button class="btn" id="paData">${ICO.mais}<span>Data de hoje</span></button></div>
            </div>
            <div class="painel"><div class="linha"><span class="dica" id="paConta" style="margin:0"></span><span class="espaco"></span><button class="btn pri" id="paIr">${ICO.baixar}<span>Salvar PDF assinado</span></button></div>
              <p class="dica">É uma assinatura desenhada (como no papel), não uma assinatura digital com certificado.</p></div>
          </div>
        </div>
        <div class="aviso ok" id="pdfRes-assinar" hidden style="margin-top:12px;align-items:center"></div>
      </section>`;
    $('.abas', v).addEventListener('click', e => { const b = e.target.closest('[data-sub]'); if (b) UT.ir('pdf/' + b.dataset.sub); });
    v.addEventListener('click', e => {
      const rb = e.target.closest('[data-rebaixar]'); if (rb && res[rb.dataset.rebaixar]) { const r = res[rb.dataset.rebaixar]; UT.baixar(r.blob, r.nome); }
      const rm = e.target.closest('[data-remandar]'); if (rm && res[rm.dataset.remandar]) { const r = res[rm.dataset.remandar]; UT.N.mandar({ rotulo: r.nome, tipo: '.pdf', nome: r.nome, obter: () => r.blob }); }
      if (e.target.closest('[data-trocar-doc]')) UT.escolher('.pdf,application/pdf').then(fs => { if (fs[0]) abrirDoc(fs[0]); });
      if (e.target.closest('[data-fechar-doc]')) fecharDoc();
    });
    montarJuntar(); montarDividir(); montarGirar(); montarAssinar();
    $$('[data-doc]', v).forEach(montarZonaDoc);
  }
  function abrir(s) {
    if (!s) s = sub;
    if (!SUBS.some(x => x[0] === s)) s = 'juntar';
    sub = s; UT.guardar('pdf.sub', s);
    $$('.abas [data-sub]', el).forEach(b => b.setAttribute('aria-selected', String(b.dataset.sub === s)));
    $$('section[data-p]', el).forEach(p => { p.hidden = p.dataset.p !== s; });
    if (UT.sub !== s) { try { history.replaceState(null, '', '#pdf/' + s); } catch (e) { /* ignora */ } }
    mostrarDoc();
  }

  /* ---------- documento único (Dividir, Girar, Assinar) ---------- */
  function montarZonaDoc(box) {
    box.innerHTML = `<div class="solte"><b>Solte um PDF aqui</b>ou clique para escolher<br><button class="btn pri" data-escolher>${ICO.arquivo}<span>Escolher PDF</span></button></div>
      <div class="painel linha" data-barra-doc hidden style="margin-bottom:14px"><span class="ico">${ICO.arquivo}</span><span style="flex:1;min-width:0"><b data-nome></b> <small class="dica" data-info></small></span>
      <button class="btn peq" data-trocar-doc>Trocar PDF</button><button class="btn peq so" data-fechar-doc title="Fechar" aria-label="Fechar">${ICO.x}</button></div>`;
    UT.zona($('.solte', box), { accept: '.pdf,application/pdf', filtro: UT.ehPdf, recusa: T('Escolha um arquivo PDF.'), aoArquivos: fs => abrirDoc(fs[0]) });
  }
  async function abrirDoc(f) {
    UT.aviso(T('Abrindo “{1}”…', f.name));
    try {
      const d = await carregarDoc(f);
      fecharDoc(true);
      doc = d;
      ['dividir', 'girar', 'assinar'].forEach(k => { res[k] = null; mostrarRes(k); });
      paPagina = 0;
      mostrarDoc();
    } catch (e) { console.error(e); UT.aviso(erroPdf(e), true); }
  }
  function fecharDoc(silencioso) {
    if (doc && doc.pjs) { try { doc.pjs.destroy(); } catch (e) { /* ignora */ } }
    doc = null;
    if (!silencioso) mostrarDoc();
  }
  function mostrarDoc() {
    $$('[data-doc]', el).forEach(box => {
      $('.solte', box).hidden = !!doc; $('[data-barra-doc]', box).hidden = !doc;
      if (doc) { $('[data-nome]', box).textContent = doc.nome; $('[data-info]', box).textContent = T('{1} páginas · {2}', doc.n, tam(doc.file.size)); }
    });
    $$('[data-com-doc]', el).forEach(x => { x.hidden = !doc; });
    if (sub === 'dividir') pagsDividir();
    if (sub === 'girar') pagsGirar();
    if (sub === 'assinar') assinarMostrar();
    if (!doc) ['#pdPags', '#pgPags'].forEach(id => { const b = $(id, el); b.innerHTML = ''; delete b.dataset.chave; if (b._obs) b._obs.disconnect(); });
  }

  /* ---------- Juntar ---------- */
  function montarJuntar() {
    UT.zona($('#pjSolte', el), { accept: '.pdf,application/pdf,image/*', multiplo: true, filtro: f => UT.ehPdf(f) || UT.ehImagem(f), recusa: T('Só PDFs e imagens.'), aoArquivos: adicionarJ });
    const ul = $('#pjLista', el);
    ul.addEventListener('click', e => {
      const li = e.target.closest('li[data-id]'); if (!li) return;
      const i = lista.findIndex(x => x.id === +li.dataset.id); if (i < 0) return;
      if (e.target.closest('[data-cima]') && i > 0) { [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]]; renderJ(); }
      if (e.target.closest('[data-baixo]') && i < lista.length - 1) { [lista[i + 1], lista[i]] = [lista[i], lista[i + 1]]; renderJ(); }
      if (e.target.closest('[data-tirar]')) { const x = lista.splice(i, 1)[0]; if (x.url) URL.revokeObjectURL(x.url); renderJ(); }
    });
    let arr = null;
    ul.addEventListener('dragstart', e => { const li = e.target.closest('li[data-id]'); if (!li) return; arr = +li.dataset.id; li.classList.add('arrastando'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(arr)); } catch (x) { /* ignora */ } });
    ul.addEventListener('dragend', () => { arr = null; $$('li', ul).forEach(l => l.classList.remove('arrastando')); });
    ul.addEventListener('dragover', e => { if (arr == null) return; e.preventDefault(); const li = e.target.closest('li[data-id]'); if (!li || +li.dataset.id === arr) return;
      const a = lista.findIndex(x => x.id === arr), b = lista.findIndex(x => x.id === +li.dataset.id);
      const [m] = lista.splice(a, 1); lista.splice(b, 0, m); renderJ(); $('li[data-id="' + arr + '"]', ul).classList.add('arrastando'); });
    ul.addEventListener('drop', e => { if (arr != null) e.preventDefault(); });
    $('#pjIr', el).addEventListener('click', juntar);
  }
  async function adicionarJ(fs) {
    for (const f of fs) {
      const it = { id: ++seq, file: f, nome: f.name || 'arquivo', img: !UT.ehPdf(f), pags: 1, erro: '' };
      lista.push(it);
      if (it.img) it.url = URL.createObjectURL(f);
    }
    renderJ();
    for (const it of lista.filter(x => !x.img && !x.lido)) {
      it.lido = true;
      try {
        const bytes = new Uint8Array(await it.file.arrayBuffer());
        const PL = await UT.pdflib();
        const d = await PL.PDFDocument.load(bytes, { updateMetadata: false });
        it.pags = d.getPageCount(); it.bytes = bytes;
        try { const pj = await abrirPjs(bytes); const p = await pj.getPage(1); const v1 = p.getViewport({ scale: 1 }); const vp = p.getViewport({ scale: 92 / v1.height });
          const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height); await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; it.mini = c; pj.destroy(); } catch (e) { /* sem miniatura */ }
      } catch (e) { it.erro = erroPdf(e); }
      renderJ();
    }
  }
  function renderJ() {
    const ul = $('#pjLista', el);
    ul.innerHTML = lista.map((x, i) => `<li data-id="${x.id}" draggable="true"><span class="th">${x.img ? `<img src="${x.url}" alt="">` : '<canvas></canvas>'}</span>
      <span class="nm"><b title="${esc(x.nome)}">${i + 1}. ${esc(x.nome)}</b><small${x.erro ? ' style="color:var(--err)"' : ''}>${esc(x.erro || (x.img ? T('imagem · 1 página') : T('{1} páginas', x.pags)) + ' · ' + tam(x.file.size))}</small></span>
      <button class="btn peq so" data-cima title="Subir" aria-label="Subir" ${i ? '' : 'disabled'}>${ICO.cima}</button><button class="btn peq so" data-baixo title="Descer" aria-label="Descer" ${i < lista.length - 1 ? '' : 'disabled'}>${ICO.baixo}</button><button class="btn peq so" data-tirar title="Tirar" aria-label="Tirar">${ICO.x}</button></li>`).join('');
    lista.forEach(x => { if (x.mini) { const c = $('li[data-id="' + x.id + '"] canvas', ul); if (c) { c.width = x.mini.width; c.height = x.mini.height; c.getContext('2d').drawImage(x.mini, 0, 0); } } });
    $('#pjOpc', el).hidden = !lista.length;
    const tot = lista.filter(x => !x.erro).reduce((s, x) => s + x.pags, 0);
    $('#pjConta', el).textContent = T('{1} arquivos · {2} páginas', lista.length, tot);
  }
  async function imagemParaPdf(PL, out, f) {
    let bytes = new Uint8Array(await f.arrayBuffer()), img;
    if (/jpe?g/i.test(f.type) || /\.jpe?g$/i.test(f.name)) { try { img = await out.embedJpg(bytes); } catch (e) { img = null; } }
    else if (/png/i.test(f.type) || /\.png$/i.test(f.name)) { try { img = await out.embedPng(bytes); } catch (e) { img = null; } }
    if (!img) { // WebP, GIF, BMP…: redesenha como PNG (e respeita a rotação da foto)
      const bm = await createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => null);
      if (!bm) throw new Error(T('Não foi possível ler a imagem “{1}”.', f.name));
      const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0);
      const b = await new Promise(r => c.toBlob(r, 'image/png'));
      img = await out.embedPng(new Uint8Array(await b.arrayBuffer()));
    }
    const a4 = $('#pjTam', el).value === 'a4';
    const W = a4 ? 595.28 : img.width * .75, H = a4 ? 841.89 : img.height * .75;
    const pg = out.addPage([W, H]);
    if (a4) {
      const m = 28, k = Math.min((W - 2 * m) / img.width, (H - 2 * m) / img.height), w = img.width * k, h = img.height * k;
      pg.drawImage(img, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });
    } else pg.drawImage(img, { x: 0, y: 0, width: W, height: H });
  }
  async function juntar() {
    const ok = lista.filter(x => !x.erro);
    if (!ok.length) { UT.aviso(T('Acrescente pelo menos um arquivo.'), true); return; }
    const b = $('#pjIr', el); ocupar(b, true, T('Juntando…'));
    try {
      const PL = await UT.pdflib(), out = await PL.PDFDocument.create();
      for (const x of ok) {
        if (x.img) { await imagemParaPdf(PL, out, x.file); continue; }
        const d = await PL.PDFDocument.load(x.bytes || new Uint8Array(await x.file.arrayBuffer()), { updateMetadata: false });
        const ps = await out.copyPages(d, d.getPageIndices());
        ps.forEach(p => out.addPage(p));
      }
      out.setProducer('Nebulosa Workspace — Utilidades'); out.setCreator('Nebulosa Workspace');
      await salvar(out, ok.length > 1 ? nomeSaida(ok[0].nome, 'juntado') : UT.semExt(ok[0].nome) + '.pdf', 'juntar');
    } catch (e) { console.error(e); UT.aviso(erroPdf(e), true); }
    ocupar(b, false);
  }

  /* ---------- Dividir ---------- */
  let pdModo = 'selecao';
  function montarDividir() {
    $('#pdModo', el).addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { pdModo = b.dataset.m; infoDividir(); } });
    $('#pdTodas', el).addEventListener('click', () => { if (!doc) return; for (let i = 0; i < doc.n; i++) doc.sel.add(i); marcarSel(); });
    $('#pdNenhuma', el).addEventListener('click', () => { if (!doc) return; doc.sel.clear(); marcarSel(); });
    $('#pdInt', el).addEventListener('input', infoDividir);
    $('#pdPags', el).addEventListener('click', e => {
      const p = e.target.closest('.pag'); if (!p || !doc) return;
      const i = +p.dataset.i;
      if (e.shiftKey && doc.ultimo != null) { const [a, b] = [Math.min(doc.ultimo, i), Math.max(doc.ultimo, i)]; for (let k = a; k <= b; k++) doc.sel.add(k); }
      else if (doc.sel.has(i)) doc.sel.delete(i); else doc.sel.add(i);
      doc.ultimo = i; marcarSel();
    });
    $('#pdPags', el).addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && e.target.classList.contains('pag')) { e.preventDefault(); e.target.click(); } });
    $('#pdIr', el).addEventListener('click', dividir);
  }
  function pagsDividir() {
    if (!doc) return;
    const box = $('#pdPags', el);
    if (box.dataset.chave !== doc.nome + doc.n + doc.file.lastModified) {
      box.dataset.chave = doc.nome + doc.n + doc.file.lastModified;
      box.innerHTML = Array.from({ length: doc.n }, (_, i) => `<div class="pag" data-i="${i}" tabindex="0" role="button" aria-pressed="false"><span class="ck">✓</span><span class="cv"><canvas></canvas></span><small>${i + 1}</small></div>`).join('');
      observar(box, doc);
    }
    marcarSel();
  }
  function marcarSel() { $$('#pdPags .pag', el).forEach(p => p.setAttribute('aria-pressed', String(doc.sel.has(+p.dataset.i)))); infoDividir(); }
  function intervalos(s, n) {
    const R = [];
    for (const parte of String(s).split(/[,;]+/)) {
      const t = parte.trim(); if (!t) continue;
      const m = /^(\d+)\s*(?:-|–|a|até|to|hasta)\s*(\d+|fim|end|final)?$/i.exec(t) || /^(\d+)$/.exec(t);
      if (!m) return { erro: T('Não entendi “{1}”. Use números e hifens, como 1-3, 5, 8-10.', t) };
      const a = +m[1], b = m[2] == null ? (/-|–/.test(t) ? n : a) : /^\d+$/.test(m[2]) ? +m[2] : n;
      if (a < 1 || b > n || a > b) return { erro: T('O intervalo “{1}” não existe neste PDF (ele tem {2} páginas).', t, n) };
      R.push([a - 1, b - 1]);
    }
    return { R };
  }
  function infoDividir() {
    $$('#pdModo [data-m]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === pdModo)));
    $('#pdIntBox', el).hidden = pdModo !== 'intervalos';
    if (!doc) return;
    const n = doc.sel.size, inf = $('#pdInfo', el);
    if (pdModo === 'selecao') inf.textContent = n ? T('{1} páginas selecionadas viram um PDF.', n) : T('Clique nas páginas que quer tirar (Shift seleciona várias).');
    else if (pdModo === 'remover') inf.textContent = n ? T('O PDF fica com {1} páginas.', doc.n - n) : T('Clique nas páginas que quer remover.');
    else if (pdModo === 'todas') inf.textContent = T('{1} arquivos, um por página, num .zip.', doc.n);
    else { const r = intervalos($('#pdInt', el).value, doc.n); inf.textContent = r.erro || (r.R.length ? T('{1} arquivos.', r.R.length) : T('Escreva os intervalos.')); }
  }
  async function dividir() {
    if (!doc) return;
    const n = doc.n; let grupos = [];
    if (pdModo === 'selecao') { if (!doc.sel.size) return UT.aviso(T('Selecione pelo menos uma página.'), true); grupos = [[...doc.sel].sort((a, b) => a - b)]; }
    else if (pdModo === 'remover') {
      if (!doc.sel.size) return UT.aviso(T('Selecione as páginas que quer remover.'), true);
      if (doc.sel.size >= n) return UT.aviso(T('Não dá para remover todas as páginas.'), true);
      grupos = [Array.from({ length: n }, (_, i) => i).filter(i => !doc.sel.has(i))];
    } else if (pdModo === 'todas') grupos = Array.from({ length: n }, (_, i) => [i]);
    else {
      const r = intervalos($('#pdInt', el).value, n);
      if (r.erro || !r.R.length) return UT.aviso(r.erro || T('Escreva os intervalos.'), true);
      grupos = r.R.map(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => a + k));
    }
    const bt = $('#pdIr', el); ocupar(bt, true);
    try {
      const PL = await UT.pdflib(), src = await PL.PDFDocument.load(doc.bytes, { updateMetadata: false });
      const base = UT.semExt(doc.nome);
      const faixa = g => { const L = []; let a = g[0], u = g[0]; for (const x of g.slice(1).concat([null])) { if (x === u + 1) { u = x; continue; } L.push(a === u ? String(a + 1) : (a + 1) + '-' + (u + 1)); a = u = x; } return L.join(', '); };
      const rotulo = g => g.length === 1 ? T('página {1}', g[0] + 1) : T('páginas {1}', faixa(g));
      const fazer = async g => { const o = await PL.PDFDocument.create(); (await o.copyPages(src, g)).forEach(p => o.addPage(p)); return o; };
      if (grupos.length === 1) {
        const suf = pdModo === 'remover' ? T('editado') : rotulo(grupos[0]);
        await salvar(await fazer(grupos[0]), UT.nomeSeguro(base + ' - ' + suf, 'documento') + '.pdf', 'dividir');
      } else {
        const Z = await UT.jszip(), z = new Z();
        for (const g of grupos) z.file(UT.nomeSeguro(base + ' - ' + rotulo(g), 'parte') + '.pdf', await (await fazer(g)).save());
        const blob = await z.generateAsync({ type: 'blob' }), nome = UT.nomeSeguro(base + ' - ' + T('partes'), 'partes') + '.zip';
        res.dividir = { blob, nome, zip: true }; UT.baixar(blob, nome); mostrarRes('dividir');
      }
    } catch (e) { console.error(e); UT.aviso(erroPdf(e), true); }
    ocupar(bt, false);
  }

  /* ---------- Girar ---------- */
  function montarGirar() {
    const todas = d => { if (!doc) return; for (let i = 0; i < doc.n; i++) doc.giro[i] = ((doc.giro[i] || 0) + d + 360) % 360; aplicarGiros(); };
    $('#pgTodasE', el).addEventListener('click', () => todas(-90));
    $('#pgTodasD', el).addEventListener('click', () => todas(90));
    $('#pgZerar', el).addEventListener('click', () => { if (!doc) return; doc.giro = []; aplicarGiros(); });
    $('#pgPags', el).addEventListener('click', e => {
      const b = e.target.closest('[data-g]'), p = e.target.closest('.pag'); if (!b || !p || !doc) return;
      const i = +p.dataset.i; doc.giro[i] = ((doc.giro[i] || 0) + +b.dataset.g + 360) % 360; aplicarGiros();
    });
    $('#pgIr', el).addEventListener('click', girar);
  }
  function pagsGirar() {
    if (!doc) return;
    const box = $('#pgPags', el);
    if (box.dataset.chave !== doc.nome + doc.n + doc.file.lastModified) {
      box.dataset.chave = doc.nome + doc.n + doc.file.lastModified;
      box.innerHTML = Array.from({ length: doc.n }, (_, i) => `<div class="pag" data-i="${i}" style="cursor:default"><span class="cv"><canvas></canvas></span>
        <span class="rots"><button class="btn peq so" data-g="-90" title="Girar para a esquerda" aria-label="Girar para a esquerda">${ICO.girarE}</button><small>${i + 1}</small><button class="btn peq so" data-g="90" title="Girar para a direita" aria-label="Girar para a direita">${ICO.girarD}</button></span></div>`).join('');
      observar(box, doc);
    }
    aplicarGiros();
  }
  function aplicarGiros() {
    $$('#pgPags .pag', el).forEach(p => { const g = doc.giro[+p.dataset.i] || 0, c = $('canvas', p); c.style.transform = g ? 'rotate(' + g + 'deg) scale(' + (g % 180 ? .75 : 1) + ')' : ''; p.setAttribute('aria-pressed', String(!!g)); });
  }
  async function girar() {
    if (!doc) return;
    if (!doc.giro.some(Boolean)) return UT.aviso(T('Gire pelo menos uma página.'), true);
    const bt = $('#pgIr', el); ocupar(bt, true);
    try {
      const PL = await UT.pdflib(), d = await PL.PDFDocument.load(doc.bytes, { updateMetadata: false });
      d.getPages().forEach((p, i) => { const g = doc.giro[i] || 0; if (g) p.setRotation(PL.degrees(((p.getRotation().angle || 0) + g + 360) % 360)); });
      await salvar(d, nomeSaida(doc.nome, 'girado'), 'girar');
    } catch (e) { console.error(e); UT.aviso(erroPdf(e), true); }
    ocupar(bt, false);
  }

  /* ---------- Assinar ---------- */
  let paPagina = 0, paModo = 'desenhar', tinta = '#111111', imgAss = null, renderT = 0;
  const pad = { tracos: [] };
  function montarAssinar() {
    $('#paModo', el).addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { paModo = b.dataset.m; modoAss(); } });
    $('#paAnt', el).addEventListener('click', () => { if (doc && paPagina > 0) { paPagina--; assinarMostrar(); } });
    $('#paProx', el).addEventListener('click', () => { if (doc && paPagina < doc.n - 1) { paPagina++; assinarMostrar(); } });
    $$('[data-tinta]', el).forEach(b => b.addEventListener('click', () => { tinta = b.dataset.tinta; desenharPad(); marcarTinta(); }));
    $('#paApagar', el).addEventListener('click', () => { pad.tracos = []; desenharPad(); });
    $('#paImg', el).addEventListener('click', () => UT.escolher('image/*').then(async fs => { if (fs[0]) { imgAss = fs[0]; UT.aviso(T('Imagem escolhida: {1}', fs[0].name)); } }));
    $('#paColocar', el).addEventListener('click', colocar);
    $('#paData', el).addEventListener('click', () => { const t = new Date().toLocaleDateString(UT.local()); textoPng(t, "system-ui, 'Segoe UI', Roboto, sans-serif", '400').then(u => adicionarMarca(u, .22)); });
    $('#paIr', el).addEventListener('click', assinar);
    // assinatura desenhada com mouse, dedo ou caneta
    const c = $('#paPad', el); let tr = null;
    const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, e.pressure || .5]; };
    c.addEventListener('pointerdown', e => { e.preventDefault(); c.setPointerCapture(e.pointerId); tr = [pt(e)]; pad.tracos.push(tr); desenharPad(); });
    c.addEventListener('pointermove', e => { if (!tr) return; (e.getCoalescedEvents ? e.getCoalescedEvents() : [e]).forEach(x => tr.push(pt(x))); desenharPad(); });
    const fim = () => { tr = null; };
    c.addEventListener('pointerup', fim); c.addEventListener('pointercancel', fim);
    new ResizeObserver(desenharPad).observe(c);
    // arrastar e redimensionar as assinaturas na página
    const area = $('#paArea', el); let arr = null;
    area.addEventListener('pointerdown', e => {
      const s = e.target.closest('.ass-sel'); if (!s) return;
      const m = doc.marcas.find(x => x.id === +s.dataset.id); if (!m) return;
      if (e.target.closest('.x')) { doc.marcas = doc.marcas.filter(x => x !== m); marcasMostrar(); return; }
      e.preventDefault(); area.setPointerCapture(e.pointerId);
      const r = area.getBoundingClientRect();
      arr = { m, al: !!e.target.closest('.al'), x0: e.clientX, y0: e.clientY, W: r.width, H: r.height, o: { x: m.x, y: m.y, w: m.w, h: m.h } };
    });
    area.addEventListener('pointermove', e => {
      if (!arr) return;
      const dx = (e.clientX - arr.x0) / arr.W, dy = (e.clientY - arr.y0) / arr.H, m = arr.m, o = arr.o;
      if (arr.al) { const k = Math.max(.15, (o.w + dx) / o.w); m.w = Math.min(1, o.w * k); m.h = o.h * (m.w / o.w); }
      else { m.x = Math.min(1 - m.w, Math.max(0, o.x + dx)); m.y = Math.min(1 - m.h, Math.max(0, o.y + dy)); }
      posicionar(m);
    });
    const solta = () => { arr = null; };
    area.addEventListener('pointerup', solta); area.addEventListener('pointercancel', solta);
    modoAss(); marcarTinta();
  }
  function marcarTinta() { $$('[data-tinta]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tinta === tinta))); }
  function modoAss() {
    $$('#paModo [data-m]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === paModo)));
    $('#paDesenhar', el).hidden = paModo !== 'desenhar'; $('#paEscrever', el).hidden = paModo !== 'escrever'; $('#paImagem', el).hidden = paModo !== 'imagem';
    if (paModo === 'desenhar') desenharPad();
  }
  function desenharPad() {
    const c = $('#paPad', el); if (!c || !c.offsetWidth) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(c.offsetWidth * dpr); c.height = Math.round(c.offsetHeight * dpr);
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    g.strokeStyle = '#d8d5e8'; g.lineWidth = dpr; g.setLineDash([6 * dpr, 6 * dpr]); g.beginPath(); g.moveTo(16 * dpr, c.height * .75); g.lineTo(c.width - 16 * dpr, c.height * .75); g.stroke(); g.setLineDash([]);
    tracar(g, c.width, c.height, 2.6 * dpr);
  }
  function tracar(g, W, H, esp) {
    g.strokeStyle = tinta; g.lineCap = 'round'; g.lineJoin = 'round';
    pad.tracos.forEach(t => {
      if (t.length === 1) { g.fillStyle = tinta; g.beginPath(); g.arc(t[0][0] * W, t[0][1] * H, esp / 2, 0, 7); g.fill(); return; }
      for (let i = 1; i < t.length; i++) { g.lineWidth = esp * (.6 + t[i][2] * .8); g.beginPath(); g.moveTo(t[i - 1][0] * W, t[i - 1][1] * H); g.lineTo(t[i][0] * W, t[i][1] * H); g.stroke(); }
    });
  }
  function recortar(c) { // tira a sobra transparente em volta
    const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const m = 6, o = document.createElement('canvas'); o.width = x1 - x0 + 1 + 2 * m; o.height = y1 - y0 + 1 + 2 * m;
    o.getContext('2d').drawImage(c, x0 - m, y0 - m, o.width, o.height, 0, 0, o.width, o.height);
    return o;
  }
  function textoPng(texto, fonte, peso) {
    const c = document.createElement('canvas'), g = c.getContext('2d'), px = 120;
    g.font = (peso || '400') + ' ' + px + 'px ' + fonte;
    c.width = Math.ceil(g.measureText(texto).width + px); c.height = Math.ceil(px * 1.8);
    g.font = (peso || '400') + ' ' + px + 'px ' + fonte; g.fillStyle = tinta; g.textBaseline = 'middle'; g.fillText(texto, px / 2, c.height / 2);
    const r = recortar(c); return Promise.resolve(r ? r.toDataURL('image/png') : null);
  }
  async function imagemAssPng() {
    const bm = await createImageBitmap(imgAss, { imageOrientation: 'from-image' });
    const k = Math.min(1, 1600 / bm.width), c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
    const g = c.getContext('2d'); g.drawImage(bm, 0, 0, c.width, c.height);
    if ($('#paFundo', el).checked) {
      const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; if (l > 200) d[i + 3] = 0; else if (l > 150) d[i + 3] = Math.round(d[i + 3] * (200 - l) / 50); }
      g.putImageData(id, 0, 0);
    }
    const r = recortar(c); return r ? r.toDataURL('image/png') : null;
  }
  async function colocar() {
    if (!doc) return;
    let url = null;
    if (paModo === 'desenhar') {
      if (!pad.tracos.length) return UT.aviso(T('Desenhe a assinatura no quadro branco acima.'), true);
      const c = document.createElement('canvas'); c.width = 1200; c.height = 400; tracar(c.getContext('2d'), 1200, 400, 7);
      const r = recortar(c); url = r && r.toDataURL('image/png');
    } else if (paModo === 'escrever') {
      const n = $('#paNome', el).value.trim(); if (!n) return UT.aviso(T('Escreva seu nome.'), true);
      url = await textoPng(n, $('#paFonte', el).value, '400');
    } else {
      if (!imgAss) return UT.aviso(T('Escolha a imagem da assinatura.'), true);
      try { url = await imagemAssPng(); } catch (e) { return UT.aviso(T('Não foi possível ler a imagem.'), true); }
    }
    if (!url) return UT.aviso(T('A assinatura ficou vazia.'), true);
    adicionarMarca(url, .32);
  }
  let marcaSeq = 0;
  function adicionarMarca(url, larg) {
    if (!doc || !url) return;
    const im = new Image();
    im.onload = () => {
      const area = $('#paArea', el), ar = area.offsetWidth / Math.max(1, area.offsetHeight);
      const w = larg, h = w * (im.height / im.width) * ar, k = doc.marcas.filter(m => m.pag === paPagina).length;
      doc.marcas.push({ id: ++marcaSeq, pag: paPagina, url, x: .55 - w / 2 + .1, y: Math.max(0, Math.min(1 - h, .78) - k * (h + .03)), w, h });
      marcasMostrar();
    };
    im.src = url;
  }
  async function assinarMostrar() {
    if (!doc) return;
    $('#paPag', el).textContent = T('Página {1} de {2}', paPagina + 1, doc.n);
    $('#paAnt', el).disabled = paPagina <= 0; $('#paProx', el).disabled = paPagina >= doc.n - 1;
    const meu = ++renderT, p = await doc.pjs.getPage(paPagina + 1);
    if (meu !== renderT) return;
    doc.view[paPagina] = p.view.slice(); doc.rot[paPagina] = p.rotate || 0;
    const v1 = p.getViewport({ scale: 1 }), area = $('#paArea', el), cont = area.parentElement;
    const larg = Math.max(260, Math.min(cont.clientWidth || 600, 900)), k = larg / v1.width, dpr = window.devicePixelRatio || 1;
    const vp = p.getViewport({ scale: k * dpr }), c = $('#paCanvas', el);
    const tmp = document.createElement('canvas'); tmp.width = Math.ceil(vp.width); tmp.height = Math.ceil(vp.height);
    await p.render({ canvasContext: tmp.getContext('2d'), viewport: vp }).promise;
    if (meu !== renderT) return;
    c.width = tmp.width; c.height = tmp.height; c.style.width = Math.round(vp.width / dpr) + 'px'; c.getContext('2d').drawImage(tmp, 0, 0);
    marcasMostrar();
  }
  function posicionar(m) { const s = $('.ass-sel[data-id="' + m.id + '"]', el); if (s) { s.style.left = m.x * 100 + '%'; s.style.top = m.y * 100 + '%'; s.style.width = m.w * 100 + '%'; s.style.height = m.h * 100 + '%'; } }
  function marcasMostrar() {
    const area = $('#paArea', el);
    $$('.ass-sel', area).forEach(x => x.remove());
    doc.marcas.filter(m => m.pag === paPagina).forEach(m => {
      const s = document.createElement('div'); s.className = 'ass-sel'; s.dataset.id = m.id;
      s.innerHTML = `<img src="${m.url}" alt=""><span class="al" title="Mudar o tamanho"></span><button class="x" title="Tirar" aria-label="Tirar">×</button>`;
      area.appendChild(s); posicionar(m);
    });
    const n = doc.marcas.length, pg = new Set(doc.marcas.map(m => m.pag)).size;
    $('#paConta', el).textContent = !n ? T('Nenhuma assinatura colocada ainda.') : n === 1 ? T('1 assinatura colocada.') : pg === 1 ? T('{1} assinaturas na mesma página.', n) : T('{1} assinaturas em {2} páginas.', n, pg);
  }
  async function assinar() {
    if (!doc || !doc.marcas.length) return UT.aviso(T('Coloque a assinatura em pelo menos uma página.'), true);
    const bt = $('#paIr', el); ocupar(bt, true);
    try {
      const PL = await UT.pdflib(), d = await PL.PDFDocument.load(doc.bytes, { updateMetadata: false }), pages = d.getPages();
      for (const m of doc.marcas) {
        const pg = pages[m.pag];
        if (!doc.view[m.pag]) { const p = await doc.pjs.getPage(m.pag + 1); doc.view[m.pag] = p.view.slice(); doc.rot[m.pag] = p.rotate || 0; }
        const [x0, y0, x1, y1] = doc.view[m.pag], W = x1 - x0, H = y1 - y0, rot = ((doc.rot[m.pag] || 0) % 360 + 360) % 360;
        const img = await d.embedPng(m.url);
        // medidas na página como aparece na tela (já girada)
        const VW = rot % 180 ? H : W, VH = rot % 180 ? W : H;
        const u0 = m.x * VW, v0 = m.y * VH, wu = m.w * VW, hv = m.h * VH;
        let o;
        if (rot === 0) o = { x: u0, y: H - v0 - hv, width: wu, height: hv };
        else if (rot === 90) o = { x: v0 + hv, y: u0, width: wu, height: hv, rotate: PL.degrees(90) };
        else if (rot === 180) o = { x: W - u0, y: v0 + hv, width: wu, height: hv, rotate: PL.degrees(180) };
        else o = { x: W - v0 - hv, y: H - u0, width: wu, height: hv, rotate: PL.degrees(270) };
        o.x += x0; o.y += y0;
        pg.drawImage(img, o);
      }
      await salvar(d, nomeSaida(doc.nome, 'assinado'), 'assinar');
    } catch (e) { console.error(e); UT.aviso(erroPdf(e), true); }
    ocupar(bt, false);
  }

  UT.registrar('pdf', {
    montar, abrir,
    conteudos: () => { const r = res[sub]; return r && !r.zip ? [{ id: 'pdf-' + sub, rotulo: r.nome, detalhe: tam(r.blob.size), tipo: '.pdf', nome: r.nome, obter: () => r.blob }] : []; },
    aceita: info => info.tipoUtil === 'pdf' || (info.tipoUtil === 'imagem' && sub === 'juntar'),
    receber: info => {
      const f = info.arquivo instanceof File ? info.arquivo : new File([info.arquivo], info.nome || 'documento.pdf', { type: info.arquivo.type || 'application/pdf' });
      if (sub === 'juntar') { adicionarJ([f]); return true; }
      return abrirDoc(f).then(() => true);
    },
    ocupado: () => lista.length > 0 || !!doc
  });
  if (UT.N && UT.N.idiomas) UT.N.idiomas.aoMudar(() => { if (!el) return; renderJ(); if (doc) { infoDividir(); mostrarDoc(); } ['juntar', 'dividir', 'girar', 'assinar'].forEach(mostrarRes); });
})();
