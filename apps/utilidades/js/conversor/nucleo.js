/* ==========================================================================
   Utilidades — Conversor de arquivos: núcleo (1.0)
   Tabela de formatos, detecção, registro dos motores de conversão, download dos
   componentes pesados (FFmpeg, ImageMagick) só quando preciso, e trabalhadores (Workers).

   Cada motor (motor-*.js) se registra com:
     UT.CV.motor({
       id: 'imagem',
       rotas(de)           -> ['png','jpg',…]  formatos de saída possíveis a partir do formato "de"
       opcoes(de, para)    -> [{ id, tipo:'faixa'|'numero'|'lista'|'caixa'|'cor'|'texto', rot, pad, … }]
       converter(ctx)      -> Promise<[{ blob, nome }]>
          ctx = { arquivo:File, de, para, opcoes:{…}, nomeBase, progresso(0..1, texto?), cancelado() }
     })
   Um motor pode chamar outro: UT.CV.converter(arquivo, de, para, opcoes) (ex.: planilha → html → pdf).
   ========================================================================== */
(function () {
  'use strict';
  const { T, esc } = UT;
  const CV = {};

  /* ---------- formatos ---------- */
  // id: [nome, categoria, extensões, mime, sai (pode ser resultado)]
  const F = {
    // imagens
    png: ['PNG', 'imagem', ['png'], 'image/png'], jpg: ['JPG', 'imagem', ['jpg', 'jpeg', 'jfif', 'jpe'], 'image/jpeg'],
    webp: ['WebP', 'imagem', ['webp'], 'image/webp'], gif: ['GIF', 'imagem', ['gif'], 'image/gif'],
    bmp: ['BMP', 'imagem', ['bmp', 'dib'], 'image/bmp'], ico: ['ICO', 'imagem', ['ico', 'cur'], 'image/x-icon'],
    svg: ['SVG', 'imagem', ['svg', 'svgz'], 'image/svg+xml', false], avif: ['AVIF', 'imagem', ['avif'], 'image/avif'],
    tiff: ['TIFF', 'imagem', ['tif', 'tiff'], 'image/tiff'], tga: ['TGA', 'imagem', ['tga'], 'image/x-tga'],
    psd: ['PSD', 'imagem', ['psd', 'psb'], 'image/vnd.adobe.photoshop'], heic: ['HEIC', 'imagem', ['heic', 'heif'], 'image/heic', false],
    jxl: ['JPEG XL', 'imagem', ['jxl'], 'image/jxl'], jp2: ['JPEG 2000', 'imagem', ['jp2', 'j2k', 'jpf', 'jpx'], 'image/jp2'],
    dds: ['DDS', 'imagem', ['dds'], 'image/vnd.ms-dds'], pcx: ['PCX', 'imagem', ['pcx'], 'image/x-pcx'],
    ppm: ['PPM', 'imagem', ['ppm', 'pgm', 'pbm', 'pnm'], 'image/x-portable-pixmap'], qoi: ['QOI', 'imagem', ['qoi'], 'image/x-qoi'],
    exr: ['OpenEXR', 'imagem', ['exr'], 'image/x-exr'], hdr: ['Radiance HDR', 'imagem', ['hdr'], 'image/vnd.radiance'],
    // documentos
    pdf: ['PDF', 'documento', ['pdf'], 'application/pdf'], docx: ['DOCX (Word)', 'documento', ['docx', 'dotx'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    odt: ['ODT (LibreOffice)', 'documento', ['odt', 'ott'], 'application/vnd.oasis.opendocument.text'], rtf: ['RTF', 'documento', ['rtf'], 'application/rtf'],
    html: ['HTML', 'documento', ['html', 'htm', 'xhtml'], 'text/html'], md: ['Markdown', 'documento', ['md', 'markdown'], 'text/markdown'],
    txt: ['Texto (TXT)', 'documento', ['txt', 'text', 'log'], 'text/plain'], epub: ['EPUB', 'documento', ['epub'], 'application/epub+zip'],
    fb2: ['FB2', 'documento', ['fb2'], 'application/x-fictionbook+xml'],
    // planilhas e dados
    xlsx: ['XLSX (Excel)', 'planilha', ['xlsx', 'xltx'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    xlsm: ['XLSM', 'planilha', ['xlsm'], 'application/vnd.ms-excel.sheet.macroEnabled.12', false], xlsb: ['XLSB', 'planilha', ['xlsb'], 'application/vnd.ms-excel.sheet.binary.macroEnabled.12'],
    xls: ['XLS (Excel 97-2003)', 'planilha', ['xls', 'xlt'], 'application/vnd.ms-excel'], ods: ['ODS (LibreOffice)', 'planilha', ['ods', 'ots'], 'application/vnd.oasis.opendocument.spreadsheet'],
    fods: ['FODS', 'planilha', ['fods'], 'application/xml'], csv: ['CSV', 'planilha', ['csv'], 'text/csv'], tsv: ['TSV', 'planilha', ['tsv', 'tab'], 'text/tab-separated-values'],
    dif: ['DIF', 'planilha', ['dif'], 'text/plain'], slk: ['SYLK', 'planilha', ['slk', 'sylk'], 'text/plain'], prn: ['PRN', 'planilha', ['prn'], 'text/plain'],
    numbers: ['Numbers', 'planilha', ['numbers'], 'application/vnd.apple.numbers', false], json: ['JSON', 'dados', ['json'], 'application/json'],
    // áudio
    mp3: ['MP3', 'audio', ['mp3'], 'audio/mpeg'], wav: ['WAV', 'audio', ['wav', 'wave'], 'audio/wav'], ogg: ['OGG Vorbis', 'audio', ['ogg', 'oga'], 'audio/ogg'],
    opus: ['Opus', 'audio', ['opus'], 'audio/opus'], flac: ['FLAC', 'audio', ['flac'], 'audio/flac'], aac: ['AAC', 'audio', ['aac'], 'audio/aac'],
    m4a: ['M4A', 'audio', ['m4a', 'm4b', 'm4r'], 'audio/mp4'], wma: ['WMA', 'audio', ['wma'], 'audio/x-ms-wma'], aiff: ['AIFF', 'audio', ['aiff', 'aif', 'aifc'], 'audio/aiff'],
    ac3: ['AC3', 'audio', ['ac3'], 'audio/ac3'], mp2: ['MP2', 'audio', ['mp2'], 'audio/mpeg'], amr: ['AMR', 'audio', ['amr'], 'audio/amr', false],
    mka: ['MKA', 'audio', ['mka'], 'audio/x-matroska'], au: ['AU', 'audio', ['au', 'snd'], 'audio/basic'], caf: ['CAF', 'audio', ['caf'], 'audio/x-caf', false],
    // vídeo
    mp4: ['MP4', 'video', ['mp4'], 'video/mp4'], mov: ['MOV', 'video', ['mov', 'qt'], 'video/quicktime'], mkv: ['MKV', 'video', ['mkv'], 'video/x-matroska'],
    webm: ['WebM', 'video', ['webm'], 'video/webm'], avi: ['AVI', 'video', ['avi'], 'video/x-msvideo'], flv: ['FLV', 'video', ['flv'], 'video/x-flv'],
    wmv: ['WMV', 'video', ['wmv', 'asf'], 'video/x-ms-wmv'], mpg: ['MPEG', 'video', ['mpg', 'mpeg', 'mpe', 'vob'], 'video/mpeg'], '3gp': ['3GP', 'video', ['3gp', '3g2'], 'video/3gpp'],
    ogv: ['OGV', 'video', ['ogv'], 'video/ogg'], ts: ['MPEG-TS', 'video', ['mts', 'm2ts', 'm2t'], 'video/mp2t', false], m4v: ['M4V', 'video', ['m4v'], 'video/x-m4v'],
    // arquivos compactados e fontes
    zip: ['ZIP', 'arquivo', ['zip'], 'application/zip'], tar: ['TAR', 'arquivo', ['tar'], 'application/x-tar'], tgz: ['TAR.GZ', 'arquivo', ['tgz', 'tar.gz'], 'application/gzip'],
    gz: ['GZ', 'arquivo', ['gz'], 'application/gzip'],
    ttf: ['TTF', 'fonte', ['ttf'], 'font/ttf'], otf: ['OTF', 'fonte', ['otf'], 'font/otf'], woff: ['WOFF', 'fonte', ['woff'], 'font/woff'], woff2: ['WOFF2', 'fonte', ['woff2'], 'font/woff2']
  };
  const FMT = {}, EXT = {};
  Object.keys(F).forEach(id => {
    const a = F[id];
    FMT[id] = { id, nome: a[0], cat: a[1], exts: a[2], mime: a[3], sai: a[4] !== false };
    a[2].forEach(e => { if (!EXT[e]) EXT[e] = id; });
  });
  EXT['tar.gz'] = 'tgz';
  const CATS = { imagem: 'Imagem', documento: 'Documento', planilha: 'Planilha', dados: 'Dados', audio: 'Áudio', video: 'Vídeo', arquivo: 'Arquivo compactado', fonte: 'Fonte' };
  const CAT_ORDEM = ['documento', 'imagem', 'planilha', 'dados', 'audio', 'video', 'arquivo', 'fonte'];
  CV.FMT = FMT; CV.CATS = CATS; CV.CAT_ORDEM = CAT_ORDEM;
  CV.ext = id => (FMT[id] ? FMT[id].exts[0] : id);

  /* ---------- detecção ---------- */
  function extDe(nome) {
    const n = String(nome || '').toLowerCase();
    if (/\.tar\.gz$/.test(n)) return 'tar.gz';
    const m = /\.([a-z0-9]+)$/.exec(n); return m ? m[1] : '';
  }
  const bytesIni = async f => new Uint8Array(await f.slice(0, 32).arrayBuffer());
  const ascii = (b, a, z) => String.fromCharCode.apply(null, b.subarray(a, z));
  /** id do formato de um arquivo (pela extensão; sem extensão, pelo começo do conteúdo) */
  CV.detectar = async function (f) {
    let id = EXT[extDe(f.name)];
    if (id) return id;
    if (f.type) { const o = Object.keys(FMT).find(k => FMT[k].mime === f.type && !/^(mp2)$/.test(k)); if (o) return o; }
    try {
      const b = await bytesIni(f), s = ascii(b, 0, 12);
      if (s.startsWith('%PDF')) return 'pdf';
      if (b[0] === 0x89 && ascii(b, 1, 4) === 'PNG') return 'png';
      if (b[0] === 0xFF && b[1] === 0xD8) return 'jpg';
      if (s.startsWith('GIF8')) return 'gif';
      if (s.startsWith('RIFF') && ascii(b, 8, 12) === 'WEBP') return 'webp';
      if (s.startsWith('RIFF') && ascii(b, 8, 12) === 'WAVE') return 'wav';
      if (s.startsWith('BM')) return 'bmp';
      if (s.startsWith('PK')) return 'zip';
      if (s.startsWith('ID3') || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)) return 'mp3';
      if (s.startsWith('OggS')) return 'ogg';
      if (s.startsWith('fLaC')) return 'flac';
      if (ascii(b, 4, 8) === 'ftyp') return 'mp4';
      if (b[0] === 0x1F && b[1] === 0x8B) return 'gz';
    } catch (e) { /* sem leitura */ }
    return '';
  };

  /* ---------- motores ---------- */
  const motores = [];
  CV.motor = function (m) { motores.push(m); };
  CV.motores = motores;
  CV.alvos = function (de) {
    const s = new Set();
    motores.forEach(m => { try { (m.rotas(de) || []).forEach(p => { if (p !== de && FMT[p] && FMT[p].sai) s.add(p); }); } catch (e) { console.error(e); } });
    return [...s];
  };
  /** Todos os formatos de entrada que algum motor aceita (para o "escolher arquivos") */
  CV.entradas = function () { return Object.keys(FMT).filter(id => CV.alvos(id).length); };
  CV.motorDe = (de, para) => motores.find(m => { try { return (m.rotas(de) || []).includes(para); } catch (e) { return false; } });
  CV.opcoes = (de, para) => { const m = CV.motorDe(de, para); try { return (m && m.opcoes && m.opcoes(de, para)) || []; } catch (e) { return []; } };
  CV.valoresPadrao = (de, para) => { const o = {}; CV.opcoes(de, para).forEach(x => { o[x.id] = x.pad; }); return o; };
  CV.nomeSaida = (nomeBase, para) => UT.nomeSeguro(nomeBase, 'arquivo') + '.' + CV.ext(para);
  /** Converte um arquivo (também usado de dentro de outros motores). Devolve [{ blob, nome }]. */
  CV.converter = async function (arquivo, de, para, opcoes, extra) {
    const m = CV.motorDe(de, para);
    if (!m) throw new Error(T('Ainda não é possível converter {1} em {2}.', (FMT[de] || {}).nome || de, (FMT[para] || {}).nome || para));
    const padrao = CV.valoresPadrao(de, para), e = extra || {};
    return m.converter({
      arquivo, de, para, opcoes: Object.assign(padrao, opcoes || {}), nomeBase: UT.semExt(arquivo.name || 'arquivo').replace(/\.tar$/i, ''),
      progresso: e.progresso || (() => {}), cancelado: e.cancelado || (() => false)
    });
  };
  CV.Cancelado = class extends Error { constructor() { super(T('Cancelado.')); this.cancelado = true; } };

  /* ---------- bibliotecas leves (scripts da pasta libs/) ---------- */
  const LIBS = {
    sheetjs: ['libs/sheetjs/xlsx.full.min.js', () => window.XLSX],
    mammoth: ['libs/mammoth/mammoth.browser.min.js', () => window.mammoth],
    docx: ['libs/docx/docx.min.js', () => window.docx],
    marked: ['libs/marked/marked.min.js', () => window.marked],
    turndown: ['libs/turndown/turndown.min.js', () => window.TurndownService]
  };
  CV.lib = async function (nome) {
    const d = LIBS[nome];
    if (!d) throw new Error('Componente desconhecido: ' + nome);
    if (!d[1]()) await UT.lib(d[0]);
    return d[1]();
  };
  CV.LIBS = LIBS;

  /* ---------- componentes pesados: pasta libs/conversor → cópia no navegador → internet ---------- */
  const CDN = 'https://cdn.jsdelivr.net/npm/';
  const MOTORES_WEB = {
    ffmpeg: { nome: 'FFmpeg', mb: 32, versao: '1', arquivos: { js: ['libs/conversor/ffmpeg/ffmpeg-core.js', CDN + '@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js', 'text/javascript'], wasm: ['libs/conversor/ffmpeg/ffmpeg-core.wasm', CDN + '@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm', 'application/wasm'] } },
    magick: { nome: 'ImageMagick', mb: 16, versao: '1', arquivos: { js: ['libs/conversor/magick/magick.umd.js', CDN + '@imagemagick/magick-wasm@0.0.45/dist/index.umd.cjs', 'text/javascript'], wasm: ['libs/conversor/magick/magick.wasm', CDN + '@imagemagick/magick-wasm@0.0.45/dist/x86/magick.wasm', 'application/wasm'] } }
  };
  CV.MOTORES_WEB = MOTORES_WEB;
  const CACHE = 'nebulosa-utilidades-motores-1';
  const prontos = {};
  const urlLocal = rel => new URL(window.__nbArq ? window.__nbArq(rel) : rel, document.baseURI).href;
  async function baixarComProgresso(url, aoProgresso, mime) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const total = +r.headers.get('content-length') || 0;
    if (!r.body || !r.body.getReader) { const b = await r.blob(); aoProgresso(1); return new Blob([b], { type: mime }); }
    const rd = r.body.getReader(), partes = []; let got = 0;
    for (;;) { const x = await rd.read(); if (x.done) break; partes.push(x.value); got += x.value.length; if (total) aoProgresso(Math.min(1, got / total)); }
    return new Blob(partes, { type: mime });
  }
  function perguntarBaixar(m) {
    return new Promise(res => {
      const d = document.createElement('div'); d.className = 'modal';
      d.innerHTML = `<div class="caixa" role="dialog" aria-modal="true"><h2>${esc(T('Componente necessário'))}</h2>
        <p>${esc(T('Para esta conversão o Conversor precisa do componente {1} (cerca de {2} MB). Ele é baixado uma única vez, fica guardado neste navegador e depois funciona sem internet. Seus arquivos não são enviados para lugar nenhum.', m.nome, m.mb))}</p>
        <div class="acoes"><button class="btn" data-n>${esc(T('Cancelar'))}</button><button class="btn pri" data-s>${esc(T('Baixar agora'))}</button></div></div>`;
      document.body.appendChild(d);
      const fim = v => { d.remove(); res(v); };
      d.querySelector('[data-n]').onclick = () => fim(false);
      d.querySelector('[data-s]').onclick = () => fim(true);
      d.addEventListener('mousedown', e => { if (e.target === d) fim(false); });
      d.querySelector('[data-s]').focus();
    });
  }
  /** Devolve { js: blobURL, wasm: blobURL } do componente (pergunta antes de baixar da internet). */
  CV.motorWeb = function (chave, aoProgresso) {
    if (prontos[chave]) return prontos[chave];
    const m = MOTORES_WEB[chave];
    prontos[chave] = (async () => {
      const urls = {}, prog = aoProgresso || (() => {});
      const chaves = Object.keys(m.arquivos);
      // 1) pasta libs/conversor (instalada com baixar-bibliotecas)
      try {
        let ok = true; const bl = {};
        for (const k of chaves) { const r = await fetch(urlLocal(m.arquivos[k][0])); if (!r.ok) { ok = false; break; } bl[k] = new Blob([await r.arrayBuffer()], { type: m.arquivos[k][2] }); }
        if (ok) { chaves.forEach(k => { urls[k] = URL.createObjectURL(bl[k]); }); return urls; }
      } catch (e) { /* sem pasta local */ }
      // 2) cópia guardada neste navegador
      let cache = null; try { cache = await caches.open(CACHE); } catch (e) { cache = null; }
      const guard = {};
      if (cache) for (const k of chaves) { const r = await cache.match(m.arquivos[k][1]); if (r) guard[k] = await r.blob(); }
      if (chaves.every(k => guard[k])) { chaves.forEach(k => { urls[k] = URL.createObjectURL(new Blob([guard[k]], { type: m.arquivos[k][2] })); }); return urls; }
      // 3) internet
      if (!await perguntarBaixar(m)) throw new CV.Cancelado();
      const pesos = { js: 0.03, wasm: 0.97 }; let base = 0;
      for (const k of chaves) {
        const w = pesos[k] || 0.5;
        let b;
        try { b = await baixarComProgresso(m.arquivos[k][1], p => prog(base + p * w, T('Baixando {1}…', m.nome)), m.arquivos[k][2]); }
        catch (e) { throw new Error(T('Não foi possível baixar o componente {1}. Verifique a conexão e tente de novo.', m.nome)); }
        base += w;
        if (cache) { try { await cache.put(m.arquivos[k][1], new Response(b, { headers: { 'Content-Type': m.arquivos[k][2] } })); } catch (e) { /* espaço cheio */ } }
        urls[k] = URL.createObjectURL(b);
      }
      return urls;
    })().catch(e => { delete prontos[chave]; throw e; });
    return prontos[chave];
  };

  /* ---------- Workers de uso geral ---------- */
  /** Cria um Worker a partir de um texto de código. Mensagens: {id, ...} -> {id, ok, ...} ou {id, prog} */
  CV.worker = function (codigo) {
    const url = URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' }));
    const w = new Worker(url); let seq = 0; const pend = {};
    w.onmessage = e => {
      const d = e.data || {}, p = pend[d.id]; if (!p) return;
      if (d.prog != null) { p.prog && p.prog(d.prog, d.txt); return; }
      if (d.log) { p.log && p.log(d.log); return; }
      delete pend[d.id];
      if (d.ok) p.ok(d); else p.no(new Error(d.erro || 'erro'));
    };
    w.onerror = e => { Object.keys(pend).forEach(k => { const p = pend[k]; delete pend[k]; p.no(new Error(e.message || 'Erro no componente de conversão.')); }); };
    return {
      w,
      chamar(msg, transf, prog, log) { return new Promise((ok, no) => { const id = ++seq; pend[id] = { ok, no, prog, log }; w.postMessage(Object.assign({ id }, msg), transf || []); }); },
      parar() { try { w.terminate(); } catch (e) { /* ignora */ } URL.revokeObjectURL(url); Object.keys(pend).forEach(k => { const p = pend[k]; delete pend[k]; p.no(new CV.Cancelado()); }); }
    };
  };

  /* ---------- utilidades comuns aos motores ---------- */
  CV.lerBytes = async f => new Uint8Array(await f.arrayBuffer());
  CV.lerTexto = async f => { const b = await CV.lerBytes(f); let t; try { t = new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { t = new TextDecoder('windows-1252').decode(b); } return t.replace(/^﻿/, ''); };
  CV.blob = (dados, id) => new Blob([dados], { type: (FMT[id] || {}).mime || 'application/octet-stream' });
  CV.saida = (dados, nomeBase, para) => ({ blob: CV.blob(dados, para), nome: CV.nomeSaida(nomeBase, para) });
  CV.cedo = () => new Promise(r => setTimeout(r, 0));   // deixa a tela respirar
  CV.checar = ctx => { if (ctx.cancelado()) throw new CV.Cancelado(); };

  UT.CV = CV;
})();
