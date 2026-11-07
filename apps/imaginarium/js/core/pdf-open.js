/* ==========================================================================
   Imaginarium — Abrir PDF (1.0)
   Abre qualquer PDF como imagem, em especial os que são só imagens
   (digitalizados, fotos, capturas de tela): cada página vira um documento
   (ou uma camada de um documento só), com a resolução que você escolher.
   Usa o PDF.js (Mozilla, Apache 2.0) da pasta libs/pdfjs, carregado só quando
   um PDF é aberto. Nada sai do computador.
   Onde entra: Arquivo › Abrir, arrastar e soltar, Arquivos recentes,
   Inserir imagem (primeira página) e "Mandar para…" do Workspace.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el, Files = IMG.Files, Layers = IMG.Layers;
  const MAX_PIXELS = 120e6;       // por página (o mesmo limite das imagens)
  const MAX_TOTAL = 600e6;        // soma das páginas abertas de uma vez (memória)
  const WK = 'libs/pdfjs/pdf.worker.js', LIB = 'libs/pdfjs/pdf.js';
  const arq = (r) => (window.__nbArq ? window.__nbArq(r) : r);   // HTML único: arquivos embutidos
  const ehPdf = (f) => !!f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''));
  IMG.isPdf = ehPdf;

  /* ---------- PDF.js sob demanda (funciona no site e com duplo clique no index.html) ---------- */
  function script(src) {
    return new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = src; s.onload = () => ok(); s.onerror = () => no(new Error('Não foi possível carregar o leitor de PDF.'));
      document.head.appendChild(s);
    });
  }
  let pdfjsP = null;
  function pdfjs() {
    if (!pdfjsP) pdfjsP = (async () => {
      if (window.pdfjsLib) return window.pdfjsLib;
      // o "worker" do PDF.js roda na própria página: funciona também abrindo o arquivo do disco
      if (!(globalThis.pdfjsWorker && globalThis.pdfjsWorker.WorkerMessageHandler)) await script(arq(WK));
      await script(arq(LIB));
      if (!window.pdfjsLib) throw new Error('O leitor de PDF não carregou.');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(arq(WK), document.baseURI).href;
      return window.pdfjsLib;
    })().catch((e) => { pdfjsP = null; throw e; });
    return pdfjsP;
  }
  async function abrirPdfjs(file) {
    const lib = await pdfjs();
    const bytes = new Uint8Array(await file.arrayBuffer());
    try { return await lib.getDocument({ data: bytes, isEvalSupported: false, verbosity: 0 }).promise; }
    catch (e) {
      const m = String((e && (e.name + ' ' + e.message)) || e);
      if (/Password/i.test(m)) throw new Error('"' + file.name + '" é protegido por senha. Tire a senha antes e tente de novo.');
      if (/Invalid PDF|No PDF header|Failed to parse/i.test(m)) throw new Error('"' + file.name + '" não parece ser um PDF válido.');
      throw e;
    }
  }

  /* ---------- análise: só imagens? qual a resolução original? ---------- */
  async function analisar(pdf) {
    const n = pdf.numPages, amostra = Math.min(n, 6), lib = window.pdfjsLib, OPS = lib.OPS || {};
    const opImg = new Set(['paintImageXObject', 'paintJpegXObject', 'paintImageMaskXObject', 'paintInlineImageXObject'].map((k) => OPS[k]).filter((x) => x !== undefined));
    let letras = 0, comImagem = 0, dpi = 0;
    for (let i = 1; i <= amostra; i++) {
      const pg = await pdf.getPage(i), vp = pg.getViewport({ scale: 1 });
      const tc = await pg.getTextContent();
      letras += tc.items.reduce((s, it) => s + (it.str ? it.str.trim().length : 0), 0);
      let ops = null; try { ops = await pg.getOperatorList(); } catch (e) { ops = null; }
      if (ops) {
        let melhor = 0;
        ops.fnArray.forEach((f, k) => {
          if (!opImg.has(f)) return;
          const a = ops.argsArray[k] || [], w = +a[1] || 0, h = +a[2] || 0;
          if (w * h > melhor) melhor = w * h;
        });
        if (melhor > 0) { comImagem++; dpi = Math.max(dpi, Math.sqrt(melhor / ((vp.width / 72) * (vp.height / 72)))); }
      }
      pg.cleanup && pg.cleanup();
    }
    const soImagens = letras < 15 * amostra && comImagem > 0;
    return { n, letras, soImagens, temTexto: letras >= 15 * amostra, dpiAuto: Math.round(Math.min(400, Math.max(72, dpi || 150))) };
  }

  /* ---------- desenhar uma página ---------- */
  async function renderPagina(pdf, num, dpi) {
    const pg = await pdf.getPage(num), v1 = pg.getViewport({ scale: 1 });
    let k = dpi / 72;
    const px = (v1.width * k) * (v1.height * k);
    if (px > MAX_PIXELS) k *= Math.sqrt(MAX_PIXELS / px);
    const v = pg.getViewport({ scale: k });
    const c = U.createCanvas(Math.max(1, Math.round(v.width)), Math.max(1, Math.round(v.height)));
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);   // PDF não tem fundo próprio: papel branco
    await pg.render({ canvasContext: g, viewport: v }).promise;
    pg.cleanup && pg.cleanup();
    return c;
  }

  /** "1-3, 5" -> [1,2,3,5] (dentro de 1..n). null se inválido. */
  function paginasDe(txt, n) {
    txt = String(txt || '').trim().toLowerCase();
    if (!txt || txt === 'todas' || txt === 'all' || txt === '*') return Array.from({ length: n }, (_, i) => i + 1);
    const out = [];
    for (const parte of txt.split(/[,;\s]+/).filter(Boolean)) {
      const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(parte);
      if (!m) return null;
      let a = +m[1], b = m[2] ? +m[2] : a;
      if (a > b) [a, b] = [b, a];
      if (a < 1 || b > n) return null;
      for (let i = a; i <= b; i++) if (!out.includes(i)) out.push(i);
    }
    return out.length ? out : null;
  }

  function docDeCanvas(c, nome) {
    const doc = new IMG.Doc({ name: nome, width: c.width, height: c.height });
    const L = new IMG.Layer('raster', { name: 'Fundo', canvas: c });
    L.isBg = true; L.lockPos = true; L.lockAlpha = true;
    doc.layers.push(L); doc.activeId = L.id; doc.selected = new Set([L.id]);
    doc.history.reset('Abrir');
    doc.sourceExt = 'pdf';
    IMG.app.addDoc(doc);
    return doc;
  }

  /* ---------- abrir ---------- */
  async function abrirPdf(file, handle) {
    const UI = IMG.UI;
    let pdf, info;
    const esconde = UI.busy('Lendo o PDF…');
    try { pdf = await abrirPdfjs(file); info = await analisar(pdf); }
    catch (err) { console.error(err); UI.toast(err.message || String(err), 'error'); return; }
    finally { esconde(); }
    if (IMG.Recent && IMG.Recent.add) IMG.Recent.add(file.name, handle);
    const base = U.baseName(file.name);
    const o = { paginas: '', dpi: String(info.dpiAuto), modo: info.n > 12 ? 'camadas' : 'docs' };
    const resp = await new Promise((res) => {
      const pagIn = el('input.inp', { type: 'text', value: '', placeholder: info.n > 1 ? '1-' + info.n : '1', 'aria-label': 'Páginas' });
      const dpiOpts = [['auto', 'Automática (' + info.dpiAuto + ' ppp)'], ['72', '72 ppp (tela)'], ['100', '100 ppp'], ['150', '150 ppp'], ['200', '200 ppp'], ['300', '300 ppp (impressão)'], ['400', '400 ppp'], ['600', '600 ppp']];
      const selDpi = UI.select(dpiOpts, 'auto', (v) => { o.dpi = v === 'auto' ? String(info.dpiAuto) : v; }, { width: 220, keepFocus: true });
      const selModo = UI.select([['docs', 'Um documento por página'], ['camadas', 'Um só documento, uma camada por página']], o.modo, (v) => { o.modo = v; }, { width: 280, keepFocus: true });
      const nota = info.soImagens ? 'Este PDF só tem imagens (digitalizado ou de fotos): cada página é aberta na resolução original, sem perda.'
        : info.temTexto ? 'Este PDF tem texto. No Imaginarium ele é aberto como imagem (o texto vira pixels). Para editar o texto, use o Typee.'
          : 'Este PDF não tem texto reconhecível; as páginas serão abertas como imagem.';
      const corpo = [
        el('p.dialog-note', el('b', { text: file.name, translate: 'no' }), el('span', { text: ' — ' + info.n + (info.n === 1 ? ' página' : ' páginas') })),
        el('p.dialog-note', { text: nota }),
        UI.row('Páginas', pagIn), UI.row('Resolução', selDpi.el)
      ];
      if (info.n > 1) corpo.push(UI.row('Abrir como', selModo.el));
      corpo.push(el('p.dialog-note', { text: 'Cada página aberta ocupa memória: em PDFs grandes, abra poucas páginas de cada vez.' }));
      UI.dialog({
        title: 'Abrir PDF', width: 460, body: corpo,
        buttons: [{ label: 'Cancelar' }, {
          label: 'Abrir', primary: true, onClick: () => {
            const lista = paginasDe(pagIn.value, info.n);
            if (!lista) { UI.toast('Escreva as páginas assim: 1-3, 5 (o PDF tem ' + info.n + ').', 'error'); return false; }
            o.lista = lista; res(o);
          }
        }],
        onClose: (v) => { if (v !== 'ok') res(null); }
      });
    });
    if (!resp) { pdf.destroy && pdf.destroy(); return; }
    // memória: estima antes de começar
    let total = 0;
    for (const n of resp.lista) {
      const pg = await pdf.getPage(n), v = pg.getViewport({ scale: +resp.dpi / 72 });
      total += Math.min(MAX_PIXELS, v.width * v.height);
    }
    if (total > MAX_TOTAL) { UI.toast('As páginas escolhidas são grandes demais para abrir juntas (' + Math.round(total / 1e6) + ' megapixels). Escolha menos páginas ou uma resolução menor.', 'error'); pdf.destroy && pdf.destroy(); return; }
    const esconde2 = UI.busy('Abrindo…');
    let abertos = 0;
    try {
      if (resp.modo === 'camadas' && resp.lista.length > 1) {
        const canvases = [];
        for (const n of resp.lista) canvases.push(await renderPagina(pdf, n, +resp.dpi));
        const W = Math.max(...canvases.map((c) => c.width)), H = Math.max(...canvases.map((c) => c.height));
        const doc = new IMG.Doc({ name: base, width: W, height: H });
        canvases.forEach((c, i) => {
          const L = new IMG.Layer('raster', { name: 'Página ' + resp.lista[i], canvas: c });
          L.x = Math.round((W - c.width) / 2); L.y = Math.round((H - c.height) / 2);
          if (i) L.visible = false;   // só a primeira página aparece; as outras se ligam no painel Camadas
          doc.layers.push(L);
        });
        const topo = doc.layers[0]; doc.activeId = topo.id; doc.selected = new Set([topo.id]);
        doc.history.reset('Abrir'); doc.sourceExt = 'pdf';
        IMG.app.addDoc(doc); abertos = canvases.length;
      } else {
        for (const n of resp.lista) {
          const c = await renderPagina(pdf, n, +resp.dpi);
          docDeCanvas(c, resp.lista.length > 1 || info.n > 1 ? base + ' — página ' + n : base);
          abertos++;
        }
      }
      UI.toast('PDF aberto: ' + abertos + (abertos === 1 ? ' página' : ' páginas') + ' (' + resp.dpi + ' ppp).');
    } catch (err) { console.error(err); UI.toast('Não foi possível abrir "' + file.name + '": ' + (err.message || err), 'error'); }
    finally { esconde2(); pdf.destroy && pdf.destroy(); }
  }
  Files.openPdf = abrirPdf;

  /* Arquivo › Abrir, arrastar, recentes e "Mandar para…": PDFs vão para o diálogo acima; o resto segue como antes */
  const abrirOutros = Files.openFiles.bind(Files);
  Files.openFiles = async function (files, handles) {
    if (!files || !files.length) return;
    const pdfs = [], resto = [], restoH = [];
    files.forEach((f, i) => { const h = handles && handles[i]; if (ehPdf(f)) pdfs.push([f, h]); else { resto.push(f); restoH.push(h); } });
    if (resto.length) await abrirOutros(resto, handles ? restoH : undefined);
    for (const [f, h] of pdfs) await abrirPdf(f, h);
  };

  /* Inserir imagem (e colar do "Mandar para…" como camada): a primeira página do PDF, ajustada ao documento */
  const inserirOutros = Files.placeFile.bind(Files);
  Files.placeFile = async function (doc, file) {
    if (!ehPdf(file)) return inserirOutros(doc, file);
    const UI = IMG.UI, esconde = UI.busy('Lendo o PDF…');
    try {
      const pdf = await abrirPdfjs(file), info = await analisar(pdf);
      let c = await renderPagina(pdf, 1, Math.min(200, info.dpiAuto));
      const k = Math.min(1, doc.width / c.width, doc.height / c.height);
      if (k < 1) c = IMG.scaleCanvas(c, Math.max(1, Math.round(c.width * k)), Math.max(1, Math.round(c.height * k)));
      const L = Layers.fromCanvas(doc, c, U.baseName(file.name).slice(0, 40), Math.round((doc.width - c.width) / 2), Math.round((doc.height - c.height) / 2));
      bus.emit('layers:change', doc);
      IMG.commit('Inserir imagem');
      if (info.n > 1) UI.toast('Foi inserida a página 1. Para escolher outras páginas, use Arquivo › Abrir.');
      pdf.destroy && pdf.destroy();
      return L;
    } catch (err) { console.error(err); UI.toast('Não foi possível inserir "' + file.name + '": ' + (err.message || err), 'error'); return null; }
    finally { esconde(); }
  };
})();
