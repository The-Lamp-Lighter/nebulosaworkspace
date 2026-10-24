/* ==========================================================================
   FotoFlow — export.js
   Exportação: PNG, JPG, PDF, JSON, PPTX e vídeo.
   Tudo é gerado no próprio navegador, sem bibliotecas externas:
   - PDF: escritor mínimo com imagens JPEG embutidas.
   - PPTX: pacote Office Open XML montado em ZIP sem compressão.
   - Vídeo: gravação em tempo real do preview (MediaRecorder).
   A lista ENCODERS deixa a estrutura pronta para um codificador nativo
   (ffmpeg via Electron ou Tauri), que permitirá MP4/MOV em qualquer sistema.
   ========================================================================== */
(function (FF) {
  'use strict';
  const U = () => FF.util;
  const A = () => FF.App;
  const E = () => FF.Engine;
  const enc = new TextEncoder();

  /* ---------- Renderização fora da tela ---------- */
  function frame(t, width, opts) {
    const p = FF.state.project;
    const c = document.createElement('canvas');
    c.width = Math.round(width / 2) * 2;
    c.height = Math.round(width * p.height / p.width / 2) * 2;
    E().render(c.getContext('2d'), p, t, opts);
    return c;
  }
  const toBlob = (canvas, type, q) => new Promise(res => canvas.toBlob(res, type, q));
  function dataUrlBytes(url) {
    const bin = atob(url.split(',')[1]), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const safeName = () => (FF.state.project.name || 'fotoflow').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'fotoflow';
  const pause = ms => new Promise(r => setTimeout(r, ms));

  /* Instante representativo de cada foto: o meio do trecho em que ela aparece sozinha. */
  function sceneMoments() {
    const items = E().schedule(FF.state.project).items;
    return items.map((it, i) => {
      const a = it.start + (i ? items[i - 1].transition : 0), b = it.end - it.transition;
      return { item: it, time: (a + b) / 2, solo: Math.max(0.5, b - a) };
    });
  }

  /* ==========================================================================
     IMAGENS (PNG / JPG)
     ========================================================================== */
  async function exportFrame(type) {
    const p = FF.state.project, ext = type === 'image/png' ? 'png' : 'jpg';
    const blob = await toBlob(frame(FF.state.time, p.width), type, 0.92);
    U().download(blob, `${safeName()}-quadro.${ext}`);
  }
  async function exportAllFrames(type) {
    const p = FF.state.project, ext = type === 'image/png' ? 'png' : 'jpg', list = sceneMoments();
    if (!list.length) return U().toast('Não há fotos na linha do tempo.', 'warn');
    progress('Gerando imagens…', 0);
    for (let i = 0; i < list.length; i++) {
      const blob = await toBlob(frame(list[i].time, p.width), type, 0.92);
      U().download(blob, `${safeName()}-${String(i + 1).padStart(2, '0')}.${ext}`);
      progress('Gerando imagens…', (i + 1) / list.length);
      await pause(350);     // intervalo para o navegador não bloquear vários downloads seguidos
    }
    progress(null);
    U().toast(`${list.length} imagens exportadas. Se o navegador perguntar, permita vários downloads.`);
  }

  /* ==========================================================================
     PDF (uma página por foto)
     ========================================================================== */
  function pdfString(s) {
    let hex = 'FEFF';
    for (const ch of String(s)) { const c = ch.codePointAt(0); hex += (c > 0xffff ? 0x25a1 : c).toString(16).padStart(4, '0').toUpperCase(); }
    return `<${hex}>`;
  }
  function buildPdf(pages, PW, PH, meta) {
    const chunks = []; let offset = 0; const xref = [];
    const push = d => { const b = typeof d === 'string' ? enc.encode(d) : d; chunks.push(b); offset += b.length; };
    const open = n => { xref[n] = offset; push(`${n} 0 obj\n`); };
    const close = () => push('\nendobj\n');
    push('%PDF-1.4\n%âãÏÓ\n');
    const kids = pages.map((_, i) => `${4 + i * 3} 0 R`).join(' ');
    open(1); push('<< /Type /Catalog /Pages 2 0 R >>'); close();
    open(2); push(`<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`); close();
    open(3); push(`<< /Title ${pdfString(meta.title)} /Author ${pdfString(meta.author)} /Creator ${pdfString('FotoFlow')} >>`); close();
    pages.forEach((pg, i) => {
      const n = 4 + i * 3;
      const content = enc.encode(`q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`);
      open(n); push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`); close();
      open(n + 1); push(`<< /Length ${content.length} >>\nstream\n`); push(content); push('\nendstream'); close();
      open(n + 2); push(`<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`);
      push(pg.jpeg); push('\nendstream'); close();
    });
    const total = 3 + pages.length * 3, start = offset;
    push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
    for (let n = 1; n <= total; n++) push(String(xref[n]).padStart(10, '0') + ' 00000 n \n');
    push(`trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${start}\n%%EOF\n`);
    return new Blob(chunks, { type: 'application/pdf' });
  }
  async function exportPdf() {
    const p = FF.state.project, list = sceneMoments();
    if (!list.length) return U().toast('Não há fotos na linha do tempo.', 'warn');
    progress('Montando o PDF…', 0);
    const pages = [];
    for (let i = 0; i < list.length; i++) {
      const c = frame(list[i].time, Math.min(1920, p.width));
      pages.push({ jpeg: dataUrlBytes(c.toDataURL('image/jpeg', 0.9)), w: c.width, h: c.height });
      progress('Montando o PDF…', (i + 1) / list.length);
      await pause(0);
    }
    const PW = 960, PH = Math.round(960 * p.height / p.width);
    U().download(buildPdf(pages, PW, PH, { title: p.name || 'FotoFlow', author: p.author || '' }), `${safeName()}.pdf`);
    progress(null);
    U().toast('PDF exportado: uma página por foto.');
  }

  /* ==========================================================================
     ZIP sem compressão (base do PPTX)
     ========================================================================== */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zip(files) {
    const parts = [], central = []; let offset = 0;
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    files.forEach(f => {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const cdSize = central.reduce((s, b) => s + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  }

  /* ==========================================================================
     PPTX (um slide por foto, com textos editáveis e transição do PowerPoint)
     ========================================================================== */
  const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rels = list => XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    list.map((r, i) => `<Relationship Id="rId${i + 1}" Type="${r[0]}" Target="${r[1]}"/>`).join('') + '</Relationships>';
  const EMPTY_TREE = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
  const THEME = XML + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="FotoFlow"><a:themeElements>' +
    '<a:clrScheme name="FotoFlow"><a:dk1><a:srgbClr val="1B1F2A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="2C3447"/></a:dk2><a:lt2><a:srgbClr val="F4EFE6"/></a:lt2>' +
    '<a:accent1><a:srgbClr val="F2B84B"/></a:accent1><a:accent2><a:srgbClr val="E8705A"/></a:accent2><a:accent3><a:srgbClr val="4FB6A8"/></a:accent3><a:accent4><a:srgbClr val="4F8FCC"/></a:accent4>' +
    '<a:accent5><a:srgbClr val="8A62A8"/></a:accent5><a:accent6><a:srgbClr val="7D9273"/></a:accent6><a:hlink><a:srgbClr val="4F8FCC"/></a:hlink><a:folHlink><a:srgbClr val="8A62A8"/></a:folHlink></a:clrScheme>' +
    '<a:fontScheme name="FotoFlow"><a:majorFont><a:latin typeface="Georgia"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
    '<a:fmtScheme name="FotoFlow"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
    '<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
    '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>' +
    '</a:themeElements></a:theme>';
  const PPT_TRANS = { fade: '<p:fade thruBlk="1"/>', push: '<p:push dir="l"/>', slide: '<p:cover dir="l"/>', reveal: '<p:wipe dir="r"/>', parallax: '<p:pull dir="l"/>',
    dissolve: '<p:dissolve/>', iris: '<p:circle/>', zoom: '<p:zoom dir="in"/>', motionBlur: '<p:push dir="l"/>', voo: '<p:push dir="u"/>' };

  function pptText(tx, id, CX, CY) {
    const heightPt = CY / 12700, sizePt = (tx.size || 5) / 100 * heightPt;
    const lines = String(tx.text).split('\n');
    const w = Math.round(CX * 0.84), h = Math.round((lines.length * sizePt * 1.35 + sizePt) * 12700);
    const align = tx.align || 'center';
    const ax = tx.x * CX, x = Math.round(Math.max(0, Math.min(CX - w, align === 'left' ? ax : align === 'right' ? ax - w : ax - w / 2)));
    const y = Math.round(Math.max(0, Math.min(CY - h, tx.y * CY - h / 2)));
    const color = /^#[0-9a-f]{6}$/i.test(tx.color || '') ? tx.color.slice(1).toUpperCase() : 'FFFFFF';
    const face = esc(String(tx.font || 'Arial').split(',')[0].replace(/['"]/g, '').trim());
    const shadow = tx.shadow !== false ? '<a:effectLst><a:outerShdw blurRad="76200" dist="25400" dir="5400000" algn="ctr" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="60000"/></a:srgbClr></a:outerShdw></a:effectLst>' : '';
    const rpr = `<a:rPr lang="pt-BR" sz="${Math.max(800, Math.round(sizePt * 100))}" b="${(tx.weight || 400) >= 600 ? 1 : 0}" i="${tx.italic ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>${shadow}<a:latin typeface="${face}"/></a:rPr>`;
    const algn = align === 'left' ? 'l' : align === 'right' ? 'r' : 'ctr';
    const paras = lines.map(l => `<a:p><a:pPr algn="${algn}"/><a:r>${rpr}<a:t>${esc(tx.upper ? l.toUpperCase() : l)}</a:t></a:r></a:p>`).join('');
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Texto ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
      `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;
  }

  async function exportPptx() {
    const p = FF.state.project, list = sceneMoments();
    if (!list.length) return U().toast('Não há fotos na linha do tempo.', 'warn');
    progress('Montando o PowerPoint…', 0);
    const CX = 12192000, CY = Math.round(CX * p.height / p.width);
    const files = [];
    const slideCT = [], presRels = [[REL + '/slideMaster', 'slideMasters/slideMaster1.xml'], [REL + '/theme', 'theme/theme1.xml']], ids = [];
    for (let i = 0; i < list.length; i++) {
      const mo = list[i], n = i + 1;
      // Fundo: o quadro da cena sem os textos, para que eles fiquem editáveis no PowerPoint.
      const c = frame(mo.time, Math.min(1920, p.width), { texts: false });
      files.push({ name: `ppt/media/image${n}.jpeg`, data: dataUrlBytes(c.toDataURL('image/jpeg', 0.9)) });
      const a = mo.item.start, b = mo.item.end - mo.item.transition;
      const texts = p.texts.filter(t => t.start < b && t.start + t.duration > a + (i ? list[i - 1].item.transition : 0));
      const tr = mo.item.scene.transition || {};
      const trXml = `<p:transition spd="slow" advTm="${Math.round(mo.solo * 1000)}">${PPT_TRANS[tr.type] || '<p:fade/>'}</p:transition>`;
      const slide = XML + `<p:sld ${NS}><p:cSld><p:spTree>${EMPTY_TREE}` +
        `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Foto ${n}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
        `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${CX}" cy="${CY}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>` +
        texts.map((t, k) => pptText(t, 3 + k, CX, CY)).join('') +
        `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${trXml}</p:sld>`;
      files.push({ name: `ppt/slides/slide${n}.xml`, data: slide });
      files.push({ name: `ppt/slides/_rels/slide${n}.xml.rels`, data: rels([[REL + '/slideLayout', '../slideLayouts/slideLayout1.xml'], [REL + '/image', `../media/image${n}.jpeg`]]) });
      slideCT.push(`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
      presRels.push([REL + '/slide', `slides/slide${n}.xml`]);
      ids.push(`<p:sldId id="${255 + n}" r:id="rId${n + 2}"/>`);
      progress('Montando o PowerPoint…', n / list.length);
      await pause(0);
    }
    const fixed = [
      { name: '[Content_Types].xml', data: XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/>' +
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
        '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' + slideCT.join('') + '</Types>' },
      { name: '_rels/.rels', data: rels([[REL + '/officeDocument', 'ppt/presentation.xml'], ['http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml'], [REL + '/extended-properties', 'docProps/app.xml']]) },
      { name: 'docProps/core.xml', data: XML + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(p.name || 'FotoFlow')}</dc:title><dc:creator>${esc(p.author || 'FotoFlow')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>` },
      { name: 'docProps/app.xml', data: XML + `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>FotoFlow</Application><Slides>${list.length}</Slides></Properties>` },
      { name: 'ppt/presentation.xml', data: XML + `<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${ids.join('')}</p:sldIdLst><p:sldSz cx="${CX}" cy="${CY}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` },
      { name: 'ppt/_rels/presentation.xml.rels', data: rels(presRels) },
      { name: 'ppt/theme/theme1.xml', data: THEME },
      { name: 'ppt/slideMasters/slideMaster1.xml', data: XML + `<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${EMPTY_TREE}</p:spTree></p:cSld>` +
        '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>' },
      { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: rels([[REL + '/slideLayout', '../slideLayouts/slideLayout1.xml'], [REL + '/theme', '../theme/theme1.xml']]) },
      { name: 'ppt/slideLayouts/slideLayout1.xml', data: XML + `<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Em branco"><p:spTree>${EMPTY_TREE}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` },
      { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: rels([[REL + '/slideMaster', '../slideMasters/slideMaster1.xml']]) }
    ];
    U().download(zip(fixed.concat(files)), `${safeName()}.pptx`);
    progress(null);
    U().toast('PowerPoint exportado: um slide por foto, com textos editáveis.');
  }

  /* ==========================================================================
     JSON
     ========================================================================== */
  function exportJson() {
    U().download(new Blob([JSON.stringify(FF.state.project)], { type: 'application/json' }), `${safeName()}.fotoflow.json`);
    U().toast('Projeto exportado em JSON.');
  }

  /* ==========================================================================
     VÍDEO
     Gravação em tempo real do preview. O formato depende do navegador:
     WebM funciona em Chrome, Edge e Firefox; MP4 só onde o navegador oferece.
     ========================================================================== */
  const ENCODERS = [
    { id: 'mp4', label: 'MP4 (H.264)', ext: 'mp4', mimes: ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'] },
    { id: 'webm', label: 'WebM (VP9/VP8)', ext: 'webm', mimes: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] },
    // MOV exige um codificador nativo. Ponto de extensão para a versão desktop (Electron/Tauri + ffmpeg):
    // basta fornecer aqui uma função encode(frames, audio) e marcar native: true.
    { id: 'mov', label: 'MOV (QuickTime)', ext: 'mov', mimes: [], native: true }
  ];
  function supportedMime(encoder) {
    if (!window.MediaRecorder) return null;
    return encoder.mimes.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || null;
  }

  /* Mistura de áudio para a gravação (Web Audio). */
  let actx = null, dest = null;
  function attachAudio(a) {
    if (!actx || a._ffNode) return;
    try { const n = actx.createMediaElementSource(a); n.connect(actx.destination); n.connect(dest); a._ffNode = n; } catch (e) { /* já conectado */ }
  }
  function ensureGraph() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!actx) { actx = new AC(); dest = actx.createMediaStreamDestination(); }
    if (actx.state === 'suspended') actx.resume();
    FF.state.project.audio.forEach(c => { const a = A().audioEl(c); if (a) attachAudio(a); });
    return true;
  }

  let recorder = null;
  async function exportVideo(encoderId, height) {
    const app = A(), p = FF.state.project;
    const encd = ENCODERS.find(e => e.id === encoderId), mime = encd && supportedMime(encd);
    if (!app.total()) return U().toast('Não há nada na linha do tempo para gravar.', 'warn');
    if (!mime || !app.canvas.captureStream) return U().toast('Este navegador não grava vídeo neste formato. Use Chrome ou Edge e escolha WebM.', 'error');
    app.pause();
    Exporter.busy = true;
    app.fitCanvas(height / Math.min(p.width, p.height));     // resolução cheia durante a gravação
    const stream = app.canvas.captureStream(p.fps || 30);
    if (p.audio.length && ensureGraph()) dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    const chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: height >= 1080 ? 12e6 : 6e6, audioBitsPerSecond: 192000 });
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const finished = new Promise(res => { recorder.onstop = res; });
    let cancelled = false;
    const timer = setInterval(() => progress('Gravando o vídeo em tempo real. Mantenha esta janela visível.', FF.state.time / app.total(), () => { cancelled = true; app.pause(); if (recorder.state !== 'inactive') recorder.stop(); }), 200);
    app.onEnded = () => setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 350);
    app.seek(0);
    recorder.start(500);
    app.play();
    await finished;
    clearInterval(timer);
    app.onEnded = null; recorder = null;
    stream.getTracks().forEach(t => { if (t.kind === 'video') t.stop(); });
    app.fitCanvas(); app.seek(0);
    Exporter.busy = false;
    progress(null);
    if (cancelled) return U().toast('Gravação cancelada.', 'warn');
    U().download(new Blob(chunks, { type: mime.split(';')[0] }), `${safeName()}.${encd.ext}`);
    U().toast('Vídeo exportado.');
  }

  /* ==========================================================================
     JANELA DE EXPORTAÇÃO
     ========================================================================== */
  function progress(msg, value, onCancel) {
    const box = document.getElementById('exportProgress');
    if (!box) return;
    if (!msg) { box.hidden = true; return; }
    box.hidden = false;
    box.querySelector('.progress-text').textContent = msg;
    box.querySelector('.progress-bar > span').style.width = Math.round(Math.max(0, Math.min(1, value || 0)) * 100) + '%';
    const b = box.querySelector('button');
    b.hidden = !onCancel; b.onclick = onCancel || null;
  }

  function open() {
    const el = U().el, body = document.getElementById('exportForm');
    body.innerHTML = '';
    const run = fn => async () => { try { await fn(); } catch (e) { console.error(e); Exporter.busy = false; progress(null); U().toast('A exportação falhou: ' + (e.message || e), 'error'); } };
    const btn = (label, hint, fn) => el('button', { class: 'export-btn', type: 'button', onclick: run(fn) }, [el('strong', { text: label }), el('span', { text: hint })]);
    const available = ENCODERS.filter(e => supportedMime(e));
    const selFmt = el('select', { id: 'vidFormat' }, available.map(e => el('option', { value: e.id }, e.label)));
    const selRes = el('select', { id: 'vidRes' }, [el('option', { value: 720 }, 'HD 720p (mais leve)'), el('option', { value: 1080, selected: true }, 'Full HD 1080p')]);
    body.append(
      el('h3', { text: 'Vídeo' }),
      available.length
        ? el('div', { class: 'export-video' }, [
            el('label', { class: 'prow' }, [el('span', { class: 'plabel', text: 'Formato' }), selFmt]),
            el('label', { class: 'prow' }, [el('span', { class: 'plabel', text: 'Qualidade' }), selRes]),
            el('button', { class: 'btn primary', type: 'button', onclick: run(() => exportVideo(selFmt.value, parseInt(selRes.value, 10))) }, 'Gravar vídeo'),
            el('p', { class: 'muted', text: 'O filme é gravado enquanto toca, então leva o tempo do próprio filme. ' +
              (available.some(e => e.id === 'mp4') ? '' : 'Este navegador grava em WebM; MP4 aparece aqui quando o navegador oferece. ') +
              'MOV fica preparado para a futura versão desktop.' })])
        : el('p', { class: 'warn-text', text: 'Este navegador não oferece gravação de vídeo. Abra o FotoFlow no Chrome, Edge ou Firefox.' }),
      el('h3', { text: 'Imagens' }),
      el('div', { class: 'export-grid' }, [
        btn('PNG do quadro atual', 'A imagem que está no preview', () => exportFrame('image/png')),
        btn('JPG do quadro atual', 'Arquivo menor, ideal para compartilhar', () => exportFrame('image/jpeg')),
        btn('PNG de cada foto', 'Uma imagem por cena, com textos', () => exportAllFrames('image/png')),
        btn('JPG de cada foto', 'Uma imagem por cena, com textos', () => exportAllFrames('image/jpeg'))]),
      el('h3', { text: 'Documentos e projeto' }),
      el('div', { class: 'export-grid' }, [
        btn('PDF', 'Uma página por foto', exportPdf),
        btn('PowerPoint (PPTX)', 'Um slide por foto, textos editáveis', exportPptx),
        btn('Projeto (JSON)', 'Para reabrir e continuar depois', exportJson)])
    );
    progress(null);
    document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
    document.getElementById('modalExport').hidden = false;
  }

  const Exporter = FF.Export = { open, attachAudio, busy: false, ENCODERS,
    frame, exportFrame, exportAllFrames, exportPdf, exportPptx, exportJson, exportVideo, buildPdf, zip };
})(window.FF = window.FF || {});
