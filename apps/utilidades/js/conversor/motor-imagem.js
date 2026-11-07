/* ==========================================================================
   Utilidades — Conversor: motor de IMAGENS (1.0)
   - Formatos comuns (PNG, JPG, WebP, GIF, BMP, ICO, SVG, AVIF) usam o próprio navegador (canvas).
   - Formatos menos comuns (TIFF, TGA, PSD, HEIC, JPEG XL, JPEG 2000, DDS, PCX, PPM, QOI, EXR, HDR…) e
     a gravação de GIF/AVIF usam o ImageMagick (WebAssembly), baixado só quando preciso.
   - Imagem → PDF (pdf-lib) e PDF → imagens (PDF.js).
   ========================================================================== */
(function () {
  'use strict';
  const { T } = UT, CV = UT.CV;
  const NAVEGADOR = ['png', 'jpg', 'webp', 'gif', 'bmp', 'ico', 'svg', 'avif'];            // o navegador lê
  const SO_MAGICK_LER = ['tiff', 'tga', 'psd', 'heic', 'jxl', 'jp2', 'dds', 'pcx', 'ppm', 'qoi', 'exr', 'hdr'];
  const CANVAS_SAI = ['png', 'jpg', 'webp'];
  const PROPRIO_SAI = ['bmp', 'ico'];
  const MAGICK_SAI = ['gif', 'avif', 'jxl', 'tiff', 'tga', 'psd', 'jp2', 'dds', 'pcx', 'ppm', 'qoi', 'exr', 'hdr'];
  const MAGICK_FMT = { png: 'Png', jpg: 'Jpeg', webp: 'WebP', gif: 'Gif', bmp: 'Bmp', ico: 'Ico', avif: 'Avif', tiff: 'Tiff', tga: 'Tga', psd: 'Psd', heic: 'Heic', jxl: 'Jxl', jp2: 'Jp2', dds: 'Dds', pcx: 'Pcx', ppm: 'Ppm', qoi: 'Qoi', exr: 'Exr', hdr: 'Hdr', svg: 'Svg' };
  const SEM_ALFA = ['jpg', 'bmp', 'pcx', 'ppm', 'hdr'];
  const COM_QUALIDADE = ['jpg', 'webp', 'avif', 'jp2'];
  const IMG_SAI = [...CANVAS_SAI, ...PROPRIO_SAI, ...MAGICK_SAI];
  const IMG_ENT = [...NAVEGADOR, ...SO_MAGICK_LER];

  /* ---------- ImageMagick num Worker ---------- */
  const CODIGO_MAGICK = `
    let M = null;
    self.onmessage = async e => {
      const d = e.data;
      try {
        if (d.cmd === 'init') {
          importScripts(d.js);
          M = self['magick-wasm'];
          const wasm = await (await fetch(d.wasm)).arrayBuffer();
          await M.initializeImageMagick(new Uint8Array(wasm));
          postMessage({ id: d.id, ok: true });
        } else if (d.cmd === 'conv') {
          let saida = null;
          const ler = (cb) => d.de ? M.ImageMagick.read(new Uint8Array(d.bytes), d.de, cb) : M.ImageMagick.read(new Uint8Array(d.bytes), cb);
          ler(img => {
            if (d.largura && d.altura && (img.width > d.largura || img.height > d.altura)) {
              const k = Math.min(d.largura / img.width, d.altura / img.height);
              img.resize(Math.max(1, Math.round(img.width * k)), Math.max(1, Math.round(img.height * k)));
            }
            if (d.qualidade) img.quality = d.qualidade;
            if (d.fundo) { try { img.backgroundColor = new M.MagickColor(d.fundo); img.alpha(M.AlphaOption.Remove); } catch (x) {} }
            img.write(d.para, data => { saida = data.slice(); });
          });
          if (!saida) throw new Error('sem resultado');
          postMessage({ id: d.id, ok: true, bytes: saida.buffer }, [saida.buffer]);
        }
      } catch (err) { postMessage({ id: d.id, ok: false, erro: String(err && err.message || err) }); }
    };`;
  let magick = null;
  async function motorMagick(ctx) {
    if (magick) return magick;
    const urls = await CV.motorWeb('magick', (p, t) => ctx && ctx.progresso(p * 0.3, t));
    const w = CV.worker(CODIGO_MAGICK);
    try { await w.chamar({ cmd: 'init', js: urls.js, wasm: urls.wasm }); }
    catch (e) { w.parar(); throw new Error(T('O componente ImageMagick não iniciou: {1}', e.message)); }
    magick = w;
    return w;
  }
  async function viaMagick(ctx, bytes, de, para, o) {
    const w = await motorMagick(ctx);
    const r = await w.chamar({ cmd: 'conv', bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), de: de ? MAGICK_FMT[de] : null, para: MAGICK_FMT[para], qualidade: o.qualidade || 0, largura: o.largura || 0, altura: o.altura || 0, fundo: o.fundo || null });
    return new Uint8Array(r.bytes);
  }

  /* ---------- decodificar para canvas ---------- */
  function canvasDe(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  async function desenhar(blob) {
    if (window.createImageBitmap) { try { const b = await createImageBitmap(blob, { imageOrientation: 'from-image' }); const c = canvasDe(b.width, b.height); c.getContext('2d').drawImage(b, 0, 0); b.close && b.close(); return c; } catch (e) { /* tenta <img> */ } }
    const u = URL.createObjectURL(blob);
    try {
      const im = new Image(); im.decoding = 'async'; im.src = u; await im.decode();
      const w = im.naturalWidth || 1024, h = im.naturalHeight || 1024;   // SVG sem tamanho
      const c = canvasDe(w, h); c.getContext('2d').drawImage(im, 0, 0, w, h); return c;
    } finally { setTimeout(() => URL.revokeObjectURL(u), 2000); }
  }
  async function paraCanvas(ctx, f, de) {
    if (NAVEGADOR.includes(de)) {
      try { return await desenhar(de === 'svg' ? new Blob([await f.arrayBuffer()], { type: 'image/svg+xml' }) : f); } catch (e) { if (de !== 'avif' && de !== 'ico') throw e; }
    }
    // ImageMagick lê e devolve PNG
    const png = await viaMagick(ctx, await CV.lerBytes(f), de, 'png', {});
    return desenhar(new Blob([png], { type: 'image/png' }));
  }
  function limitar(c, o) {
    const mw = +o.largura || 0, mh = +o.altura || 0;
    if (!mw && !mh) return c;
    const k = Math.min(mw ? mw / c.width : 1, mh ? mh / c.height : 1, 1);
    if (k >= 1) return c;
    const s = canvasDe(Math.max(1, Math.round(c.width * k)), Math.max(1, Math.round(c.height * k)));
    const g = s.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, s.width, s.height);
    return s;
  }
  function comFundo(c, cor) {
    const s = canvasDe(c.width, c.height), g = s.getContext('2d');
    g.fillStyle = cor || '#ffffff'; g.fillRect(0, 0, s.width, s.height); g.drawImage(c, 0, 0);
    return s;
  }
  const paraBlob = (c, mime, q) => new Promise(r => c.toBlob(r, mime, q));

  /* ---------- gravar BMP e ICO ---------- */
  function gravarBmp(c) {
    const w = c.width, h = c.height, linha = Math.ceil(w * 3 / 4) * 4, tam = 54 + linha * h;
    const buf = new ArrayBuffer(tam), v = new DataView(buf);
    v.setUint16(0, 0x4D42, true); v.setUint32(2, tam, true); v.setUint32(10, 54, true); v.setUint32(14, 40, true);
    v.setInt32(18, w, true); v.setInt32(22, h, true); v.setUint16(26, 1, true); v.setUint16(28, 24, true); v.setUint32(34, linha * h, true);
    v.setInt32(38, 2835, true); v.setInt32(42, 2835, true);
    const px = c.getContext('2d').getImageData(0, 0, w, h).data, u = new Uint8Array(buf);
    for (let y = 0; y < h; y++) { let o = 54 + (h - 1 - y) * linha; for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; u[o++] = px[i + 2]; u[o++] = px[i + 1]; u[o++] = px[i]; } }
    return new Blob([buf], { type: 'image/bmp' });
  }
  async function gravarIco(c, tamanhos) {
    const lista = [...new Set(tamanhos)].filter(n => n >= 8 && n <= 256).sort((a, b) => a - b);
    if (!lista.length) lista.push(32);
    const pngs = [];
    for (const n of lista) {
      const s = canvasDe(n, n), g = s.getContext('2d'); g.imageSmoothingQuality = 'high';
      const k = Math.min(n / c.width, n / c.height), w = Math.max(1, Math.round(c.width * k)), h = Math.max(1, Math.round(c.height * k));
      g.drawImage(c, Math.round((n - w) / 2), Math.round((n - h) / 2), w, h);
      pngs.push(new Uint8Array(await (await paraBlob(s, 'image/png')).arrayBuffer()));
    }
    const cab = 6 + 16 * pngs.length, total = cab + pngs.reduce((s, p) => s + p.length, 0), buf = new ArrayBuffer(total), v = new DataView(buf), u = new Uint8Array(buf);
    v.setUint16(2, 1, true); v.setUint16(4, pngs.length, true);
    let off = cab;
    pngs.forEach((p, i) => {
      const e = 6 + 16 * i, n = lista[i];
      u[e] = n >= 256 ? 0 : n; u[e + 1] = n >= 256 ? 0 : n; v.setUint16(e + 4, 1, true); v.setUint16(e + 6, 32, true); v.setUint32(e + 8, p.length, true); v.setUint32(e + 12, off, true);
      u.set(p, off); off += p.length;
    });
    return new Blob([buf], { type: 'image/x-icon' });
  }

  /** Canvas -> arquivo no formato pedido */
  async function gravar(ctx, c, para, o) {
    c = limitar(c, o);
    const q = (o.qualidade || 85) / 100;
    if (SEM_ALFA.includes(para) || (para === 'pdf')) c = comFundo(c, o.fundo);
    if (CANVAS_SAI.includes(para)) {
      let b = await paraBlob(c, CV.FMT[para].mime, q);
      if (!b || b.type !== CV.FMT[para].mime) { if (para === 'webp') throw new Error(T('Este navegador não grava WebP. Escolha PNG ou JPG.')); throw new Error(T('Não foi possível gerar a imagem.')); }
      return b;
    }
    if (para === 'bmp') return gravarBmp(c);
    if (para === 'ico') return gravarIco(c, String(o.tamanhos || '16,32,48,64,128,256').split(/[^\d]+/).map(Number).filter(Boolean));
    const png = new Uint8Array(await (await paraBlob(c, 'image/png')).arrayBuffer());
    const bytes = await viaMagick(ctx, png, 'png', para, { qualidade: COM_QUALIDADE.includes(para) ? Math.round(q * 100) : 0 });
    return new Blob([bytes], { type: CV.FMT[para].mime });
  }

  /* ---------- imagem -> PDF ---------- */
  async function imagemParaPdf(ctx, f, de, o) {
    const PL = await UT.pdflib(), doc = await PL.PDFDocument.create();
    let img, w, h;
    if (de === 'jpg' && !o.largura && !o.altura) { img = await doc.embedJpg(await CV.lerBytes(f)); w = img.width; h = img.height; }
    else {
      let c = limitar(await paraCanvas(ctx, f, de), o);
      const png = new Uint8Array(await (await paraBlob(c, 'image/png')).arrayBuffer());
      img = await doc.embedPng(png); w = img.width; h = img.height;
    }
    if (o.pagina === 'img') { const p = doc.addPage([w * 0.75, h * 0.75]); p.drawImage(img, { x: 0, y: 0, width: w * 0.75, height: h * 0.75 }); }
    else {
      let [pw, ph] = o.pagina === 'letter' ? [612, 792] : [595.28, 841.89];
      if (w > h) [pw, ph] = [ph, pw];
      const m = 28, k = Math.min((pw - 2 * m) / w, (ph - 2 * m) / h), dw = w * k, dh = h * k;
      const p = doc.addPage([pw, ph]); p.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
    }
    doc.setCreator('Nebulosa Workspace · Utilidades');
    return new Blob([await doc.save()], { type: 'application/pdf' });
  }

  /* ---------- PDF -> imagens ---------- */
  function intervalo(txt, n) {
    txt = String(txt || '').trim();
    if (!txt) return Array.from({ length: n }, (_, i) => i + 1);
    const out = [];
    for (const p of txt.split(/[,;\s]+/).filter(Boolean)) {
      const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(p);
      if (!m) throw new Error(T('Escreva as páginas assim: 1-3, 5 (o PDF tem {1#}).').replace('{1#}', n));
      let a = +m[1], b = m[2] ? +m[2] : a; if (a > b) [a, b] = [b, a];
      if (a < 1 || b > n) throw new Error(T('O intervalo “{1}” não existe neste PDF (ele tem {2}).', p, UT.Q(n, '{1} página', '{1} páginas')));
      for (let i = a; i <= b; i++) if (!out.includes(i)) out.push(i);
    }
    return out;
  }
  async function pdfParaImagens(ctx, f, para, o) {
    const lib = await UT.pdfjs();
    let pdf;
    try { pdf = await lib.getDocument({ data: await CV.lerBytes(f), isEvalSupported: false, verbosity: 0 }).promise; }
    catch (e) { if (/Password/i.test(String(e && e.name + e.message))) throw new Error(T('Este PDF é protegido por senha. Tire a senha antes (no programa que criou o arquivo) e tente de novo.')); throw e; }
    const pags = intervalo(o.paginas, pdf.numPages), saidas = [], k0 = (+o.dpi || 150) / 72;
    for (let i = 0; i < pags.length; i++) {
      CV.checar(ctx);
      ctx.progresso(i / pags.length, T('Página {1} de {2}', pags[i], pdf.numPages));
      const pg = await pdf.getPage(pags[i]), v1 = pg.getViewport({ scale: 1 });
      const k = Math.min(k0, Math.sqrt(1.2e8 / (v1.width * v1.height))), v = pg.getViewport({ scale: k });
      const c = canvasDe(Math.ceil(v.width), Math.ceil(v.height)), g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: g, viewport: v }).promise;
      const b = await gravar(ctx, c, para, o);
      const num = String(pags[i]).padStart(String(pdf.numPages).length, '0');
      saidas.push({ blob: b, nome: UT.nomeSeguro(ctx.nomeBase, 'pagina') + (pdf.numPages > 1 || pags.length > 1 ? '-' + num : '') + '.' + CV.ext(para) });
      c.width = c.height = 0; pg.cleanup && pg.cleanup();
      await CV.cedo();
    }
    return saidas;
  }

  /* ---------- registro ---------- */
  const OPC_TAM = [
    { id: 'largura', tipo: 'numero', rot: 'Largura máxima (px)', pad: 0, min: 0, max: 20000, dica: '0 = tamanho original' },
    { id: 'altura', tipo: 'numero', rot: 'Altura máxima (px)', pad: 0, min: 0, max: 20000, dica: '0 = tamanho original' }
  ];
  CV.motor({
    id: 'imagem',
    pesado: (de, para) => (SO_MAGICK_LER.includes(de) || MAGICK_SAI.includes(para)) ? 'magick' : null,
    rotas(de) {
      if (IMG_ENT.includes(de)) return [...IMG_SAI, 'pdf'];
      if (de === 'pdf') return ['png', 'jpg', 'webp', 'bmp', 'tiff', 'gif', 'avif'];
      return [];
    },
    opcoes(de, para) {
      const o = [];
      if (de === 'pdf') o.push({ id: 'dpi', tipo: 'lista', rot: 'Resolução', pad: '150', opcoes: [['72', '72 ppp (tela)'], ['100', '100 ppp'], ['150', '150 ppp'], ['200', '200 ppp'], ['300', '300 ppp (impressão)'], ['600', '600 ppp']] },
        { id: 'paginas', tipo: 'texto', rot: 'Páginas', pad: '', dica: 'Vazio = todas. Ex.: 1-3, 5' });
      if (para === 'pdf') { o.push({ id: 'pagina', tipo: 'lista', rot: 'Tamanho da página', pad: 'a4', opcoes: [['a4', 'A4, com a imagem inteira'], ['letter', 'Carta (Letter)'], ['img', 'Do tamanho da imagem']] }); }
      else if (COM_QUALIDADE.includes(para)) o.push({ id: 'qualidade', tipo: 'faixa', rot: 'Qualidade', pad: 85, min: 30, max: 100 });
      if (para === 'ico') o.push({ id: 'tamanhos', tipo: 'texto', rot: 'Tamanhos (px)', pad: '16,32,48,64,128,256', dica: 'Até 256' });
      if (de !== 'pdf' || para !== 'pdf') o.push(...OPC_TAM);
      if (SEM_ALFA.includes(para) || para === 'pdf') o.push({ id: 'fundo', tipo: 'cor', rot: 'Cor no lugar da transparência', pad: '#ffffff' });
      return o;
    },
    async converter(ctx) {
      const { arquivo: f, de, para, opcoes: o } = ctx;
      if (de === 'pdf') return pdfParaImagens(ctx, f, para, o);
      if (para === 'pdf') return [{ blob: await imagemParaPdf(ctx, f, de, o), nome: CV.nomeSaida(ctx.nomeBase, 'pdf') }];
      ctx.progresso(0.05, T('Lendo a imagem…'));
      const c = await paraCanvas(ctx, f, de);
      CV.checar(ctx);
      ctx.progresso(0.6, T('Gravando…'));
      const b = await gravar(ctx, c, para, o);
      return [{ blob: b, nome: CV.nomeSaida(ctx.nomeBase, para) }];
    }
  });
  CV.imagem = { paraCanvas, gravar, viaMagick };
})();
