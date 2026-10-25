/* ============================================================
   LêPraMim — importadores.js
   Converte cada formato de arquivo no "conteúdo bruto" que o
   app entende:
     { paginado, paginas: [[bloco…]…], capitulosFonte: [{titulo, pagina}] }
   PDF  -> PDF.js (texto, páginas, sumário) + Tesseract.js (OCR)
   EPUB -> leitor nativo (ZIP + XHTML)
   DOCX -> Mammoth.js quando instalado; senão, leitor nativo
   TXT / HTML / RTF -> leitura direta e conversão para texto limpo
   Todo o processamento acontece neste computador.
   ============================================================ */
(function () {
  'use strict';
  const util = LPM.util;
  const cfgLibs = LPM.config.LIBS;

  /* ============================================================
     TXT
     ============================================================ */

  /** Transforma texto puro em conteúdo (detecta páginas e linhas quebradas). */
  function conteudoDeTexto(texto) {
    texto = texto.replace(/\r\n?/g, '\n');

    // TXT com quebras de página (caractere "form feed"): trata como páginas reais
    if (texto.indexOf('\f') >= 0) {
      const paginas = texto.split('\f').map(pg => {
        const linhas = [];
        let q = true;
        pg.split('\n').forEach(l => {
          const t = l.trim();
          if (!t) { q = true; return; }
          linhas.push({ t, q });
          q = false;
        });
        return linhas;
      });
      return { paginado: true, paginas };
    }

    const linhas = texto.split('\n');
    const cheias = linhas.filter(l => l.trim());
    const vazias = linhas.length - cheias.length;
    const medias = cheias.filter(l => l.length >= 40 && l.length <= 100).length;
    const longas = cheias.filter(l => l.length > 100).length;
    // "Quebrado": texto com linhas cortadas em ~70 colunas e parágrafos separados por linha em branco
    const quebrado = vazias > cheias.length * 0.05 && longas < cheias.length * 0.05 && medias > cheias.length * 0.5;

    const blocos = [];
    if (quebrado) {
      let atual = '';
      const fechar = () => { if (atual) { blocos.push({ t: atual }); atual = ''; } };
      for (const l of linhas) {
        const t = l.trim();
        if (!t) { fechar(); continue; }
        if (LPM.capitulos.ehTitulo(t)) { fechar(); blocos.push({ t }); continue; }
        if (atual && /[a-zà-ÿ]-$/i.test(atual) && /^[a-zà-ÿ]/.test(t)) atual = atual.slice(0, -1) + t;
        else atual += (atual ? ' ' : '') + t;
      }
      fechar();
    } else {
      cheias.forEach(l => blocos.push({ t: l.trim() }));
    }
    return { paginado: false, paginas: [blocos] };
  }

  async function importarTxt(arquivo) {
    return { conteudo: conteudoDeTexto(util.decodificarTexto(await arquivo.arrayBuffer())) };
  }

  /* ============================================================
     HTML
     ============================================================ */

  const IGNORAR = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'SVG', 'CANVAS', 'HEAD', 'TITLE', 'META', 'LINK', 'OBJECT', 'AUDIO', 'VIDEO', 'MAP', 'MATH']);
  const BLOCO = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'DL', 'DT', 'DD', 'FIGURE', 'FIGCAPTION', 'BODY', 'HTML', 'HEADER', 'FOOTER', 'ASIDE', 'NAV', 'HR', 'ADDRESS', 'CAPTION', 'DETAILS', 'SUMMARY', 'CENTER', 'FORM', 'FIELDSET']);

  /** Percorre o HTML e devolve os blocos de texto (parágrafos e títulos). */
  function extrairBlocos(raiz) {
    const blocos = [];
    let buffer = '';
    const descarregar = h => {
      const t = buffer.replace(/\s+/g, ' ').trim();
      buffer = '';
      if (t) blocos.push(h ? { t, h } : { t });
    };
    (function andar(no) {
      for (const f of no.childNodes) {
        if (f.nodeType === 3) { buffer += f.nodeValue; continue; }
        if (f.nodeType !== 1) continue;
        const tag = (f.localName || f.tagName || '').toUpperCase();
        if (IGNORAR.has(tag)) continue;
        if (tag === 'BR') { buffer += ' '; continue; }
        const m = /^H([1-6])$/.exec(tag);
        if (m) {
          descarregar();
          buffer = f.textContent;
          descarregar(Math.min(3, parseInt(m[1], 10)));
        } else if (BLOCO.has(tag)) {
          descarregar();
          andar(f);
          descarregar();
        } else {
          andar(f); // elemento "em linha" (negrito, link…): continua o mesmo parágrafo
        }
      }
    })(raiz);
    descarregar();
    return blocos;
  }

  /** Interpreta XHTML; se o arquivo tiver erros de XML, tenta como HTML comum. */
  function interpretarHtml(texto, preferirXml) {
    const leitor = new DOMParser();
    if (preferirXml) {
      const doc = leitor.parseFromString(texto, 'application/xhtml+xml');
      if (!doc.getElementsByTagName('parsererror').length) return doc;
    }
    return leitor.parseFromString(texto, 'text/html');
  }

  function corpoDe(doc) {
    return doc.body || doc.getElementsByTagNameNS('*', 'body')[0] || doc.documentElement;
  }

  /** Localiza o texto principal de uma página da web (ignora menus, rodapés e barras laterais). */
  function conteudoPrincipal(doc) {
    const corpo = corpoDe(doc);
    corpo.querySelectorAll('script,style,noscript,template,iframe,svg,canvas,form,button,select,nav,aside,[hidden],[aria-hidden="true"]').forEach(e => e.remove());
    const totalTexto = corpo.textContent.length || 1;

    // 1) Marcações semânticas conhecidas
    for (const sel of ['article', 'main', '[role="main"]', '#content', '.post-content', '.entry-content', '.article-body']) {
      const melhor = Array.from(corpo.querySelectorAll(sel)).sort((a, b) => b.textContent.length - a.textContent.length)[0];
      if (melhor && melhor.textContent.length > totalTexto * 0.4) return melhor;
    }
    // 2) O elemento que concentra a maior parte dos parágrafos
    const pontos = new Map();
    corpo.querySelectorAll('p').forEach(p => {
      const n = p.textContent.trim().length;
      if (n < 40) return;
      const pai = p.parentElement;
      if (!pai) return;
      pontos.set(pai, (pontos.get(pai) || 0) + n);
      if (pai.parentElement) pontos.set(pai.parentElement, (pontos.get(pai.parentElement) || 0) + n * 0.5);
    });
    let melhor = null, max = 0;
    pontos.forEach((v, k) => { if (v > max) { max = v; melhor = k; } });
    if (melhor && melhor !== corpo && melhor.textContent.length > totalTexto * 0.5) return melhor;
    // 3) O corpo inteiro, sem cabeçalho e rodapé do site
    corpo.querySelectorAll('header, footer').forEach(e => { if (e.parentElement === corpo) e.remove(); });
    return corpo;
  }

  async function importarHtml(arquivo) {
    const doc = interpretarHtml(util.decodificarTexto(await arquivo.arrayBuffer()), false);
    const titulo = (doc.querySelector('title') || {}).textContent || '';
    const autor = (doc.querySelector('meta[name="author" i]') || { getAttribute: () => '' }).getAttribute('content') || '';
    const blocos = extrairBlocos(conteudoPrincipal(doc));
    return { conteudo: { paginado: false, paginas: [blocos] }, titulo: titulo.trim(), autor: autor.trim() };
  }

  /* ============================================================
     RTF -> texto limpo
     ============================================================ */

  const DESTINOS_RTF = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'headerl', 'headerr', 'headerf', 'footerl', 'footerr', 'footerf', 'footnote', 'object', 'themedata', 'colorschememapping', 'datastore', 'latentstyles', 'generator', 'xmlnstbl', 'listtable', 'listoverridetable', 'rsidtbl', 'pgdsctbl', 'fldinst', 'nonshppict', 'filetbl', 'revtbl']);
  const SIMBOLOS_RTF = { emdash: '—', endash: '–', lquote: '‘', rquote: '’', ldblquote: '“', rdblquote: '”', bullet: '•', emspace: ' ', enspace: ' ' };

  /** Converte RTF em texto puro (interpreta grupos, \par, \'hh, \uN…). */
  function rtfParaTexto(rtf) {
    const cp1252 = new TextDecoder('windows-1252');
    const pilha = [];
    const saida = [];
    let ignorar = false, uc = 1, pular = 0, i = 0;
    const n = rtf.length;
    const emitir = t => { if (ignorar) return; if (pular > 0) { pular--; return; } saida.push(t); };

    while (i < n) {
      const c = rtf[i];
      if (c === '{') { pilha.push({ ignorar, uc }); i++; }
      else if (c === '}') { const e = pilha.pop(); if (e) { ignorar = e.ignorar; uc = e.uc; } i++; }
      else if (c === '\\') {
        const p = rtf[i + 1];
        if (p === '\\' || p === '{' || p === '}') { emitir(p); i += 2; }
        else if (p === "'") {
          const byte = parseInt(rtf.substr(i + 2, 2), 16);
          if (!isNaN(byte)) emitir(cp1252.decode(new Uint8Array([byte])));
          i += 4;
        }
        else if (p === '*') { ignorar = true; i += 2; }           // {\*\destino desconhecido}
        else if (p === '~') { emitir(' '); i += 2; }
        else if (p === '_') { emitir('-'); i += 2; }
        else if (p === '-') { i += 2; }                           // hífen opcional
        else if (p === '\n' || p === '\r') { if (!ignorar) saida.push('\n'); i += 2; }
        else {
          const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.substr(i, 48));
          if (!m) { i += 2; continue; }
          i += m[0].length;
          const palavra = m[1];
          const num = m[2] !== undefined ? parseInt(m[2], 10) : null;
          if (DESTINOS_RTF.has(palavra)) ignorar = true;
          else if (ignorar) { /* dentro de um grupo ignorado */ }
          else if (palavra === 'par' || palavra === 'line' || palavra === 'sect' || palavra === 'row') saida.push('\n');
          else if (palavra === 'page') saida.push('\n');
          else if (palavra === 'tab' || palavra === 'cell') saida.push(' ');
          else if (palavra === 'uc') uc = num === null ? 1 : num;
          else if (palavra === 'u' && num !== null) { saida.push(String.fromCharCode(num < 0 ? num + 65536 : num)); pular = uc; }
          else if (SIMBOLOS_RTF[palavra]) saida.push(SIMBOLOS_RTF[palavra]);
        }
      }
      else if (c === '\r' || c === '\n') { i++; }
      else { emitir(c); i++; }
    }
    return saida.join('');
  }

  async function importarRtf(arquivo) {
    // RTF usa bytes de 8 bits; lemos como Windows-1252 para não perder nenhum
    const bruto = new TextDecoder('windows-1252').decode(await arquivo.arrayBuffer());
    if (!/^\s*\{\\rtf/.test(bruto)) throw new Error('O arquivo não parece ser um RTF válido.');
    return { conteudo: conteudoDeTexto(rtfParaTexto(bruto)) };
  }

  /* ============================================================
     DOCX
     ============================================================ */

  const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

  function interpretarXml(texto) {
    const doc = new DOMParser().parseFromString(texto, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Não foi possível interpretar o conteúdo interno do arquivo.');
    return doc;
  }

  function textoDaTag(doc, nome) {
    const e = doc.getElementsByTagNameNS('*', nome)[0];
    return e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  /** Leitor nativo de DOCX: lê os parágrafos e reconhece os estilos de título. */
  function blocosDoDocx(doc) {
    const blocos = [];
    for (const p of Array.from(doc.getElementsByTagNameNS(NS_W, 'p'))) {
      // ignora a cópia de compatibilidade de caixas de texto (evita texto duplicado)
      let dentroDeFallback = false;
      for (let a = p.parentNode; a; a = a.parentNode) if (a.localName === 'Fallback') { dentroDeFallback = true; break; }
      if (dentroDeFallback) continue;

      let t = '';
      (function andar(no) {
        for (const f of no.childNodes) {
          if (f.nodeType !== 1) continue;
          const n = f.localName;
          if (n === 't') t += f.textContent;
          else if (n === 'tab' || n === 'br' || n === 'cr') t += ' ';
          else if (n === 'noBreakHyphen') t += '-';
          else if (n === 'pPr' || n === 'rPr' || n === 'del' || n === 'instrText' || n === 'p') continue;
          else andar(f);
        }
      })(p);
      t = t.replace(/\s+/g, ' ').trim();
      if (!t) continue;

      let h = 0;
      const estilo = p.getElementsByTagNameNS(NS_W, 'pStyle')[0];
      if (estilo) {
        const val = estilo.getAttributeNS(NS_W, 'val') || estilo.getAttribute('w:val') || '';
        const m = /^(?:heading|t[ií]?tulo)\s*([1-6])$/i.exec(val);
        if (m) h = Math.min(3, parseInt(m[1], 10));
        else if (/^(title|t[ií]?tulo)$/i.test(val)) h = 1;
      }
      blocos.push(h ? { t, h } : { t });
    }
    return blocos;
  }

  async function importarDocx(arquivo) {
    const buffer = await arquivo.arrayBuffer();
    const zip = await LPM.zip.abrir(buffer);
    if (!zip.tem('word/document.xml')) throw new Error('O arquivo não é um DOCX válido.');

    let titulo = '', autor = '';
    if (zip.tem('docProps/core.xml')) {
      try {
        const props = interpretarXml(await zip.lerTexto('docProps/core.xml'));
        titulo = textoDaTag(props, 'title');
        autor = textoDaTag(props, 'creator');
      } catch (e) { /* propriedades são opcionais */ }
    }

    let blocos = null;
    // Mammoth.js (recomendado): pasta libs/mammoth, cópia guardada ou internet [Nebulosa]
    await LPM.libsWeb.obter('docx', { explicacao: 'Para abrir documentos do Word com mais fidelidade (listas, tabelas e estilos),', textoNao: 'Usar o leitor interno', lembrarNao: true });
    if (window.mammoth) {
      try {
        const r = await window.mammoth.convertToHtml({ arrayBuffer: buffer });
        blocos = extrairBlocos(corpoDe(interpretarHtml(r.value, false)));
      } catch (e) { console.warn('Mammoth falhou; usando o leitor nativo.', e); }
    }
    if (!blocos || !blocos.length) {
      blocos = blocosDoDocx(interpretarXml(await zip.lerTexto('word/document.xml')));
    }
    return { conteudo: { paginado: false, paginas: [blocos] }, titulo, autor };
  }

  /* ============================================================
     EPUB
     ============================================================ */

  /** Resolve um caminho relativo dentro do EPUB ("../Text/cap1.xhtml#p3" -> "OEBPS/Text/cap1.xhtml"). */
  function resolverCaminho(base, href) {
    href = String(href || '').split('#')[0];
    try { href = decodeURIComponent(href); } catch (e) { /* mantém */ }
    if (href.startsWith('/')) return href.slice(1);
    const partes = (base + href).split('/');
    const saida = [];
    for (const p of partes) {
      if (p === '..') saida.pop();
      else if (p !== '.' && p !== '') saida.push(p);
    }
    return saida.join('/');
  }

  const pastaDe = caminho => (caminho.indexOf('/') >= 0 ? caminho.slice(0, caminho.lastIndexOf('/') + 1) : '');

  async function importarEpub(arquivo, ctx) {
    const zip = await LPM.zip.abrir(await arquivo.arrayBuffer());
    if (!zip.tem('META-INF/container.xml')) throw new Error('O arquivo não é um EPUB válido.');
    if (zip.tem('META-INF/encryption.xml') && zip.tem('META-INF/rights.xml')) {
      throw new Error('Este EPUB é protegido por DRM e não pode ser aberto.');
    }

    // 1) container.xml aponta para o arquivo .opf (a "ficha" do livro)
    const container = interpretarXml(await zip.lerTexto('META-INF/container.xml'));
    const raiz = container.getElementsByTagNameNS('*', 'rootfile')[0];
    const caminhoOpf = raiz && raiz.getAttribute('full-path');
    if (!caminhoOpf) throw new Error('EPUB sem índice interno (OPF).');
    const base = pastaDe(caminhoOpf);
    const opf = interpretarXml(await zip.lerTexto(caminhoOpf));

    // 2) Manifesto (todos os arquivos) e espinha (ordem de leitura)
    const manifesto = {};
    for (const it of Array.from(opf.getElementsByTagNameNS('*', 'item'))) {
      manifesto[it.getAttribute('id')] = {
        caminho: resolverCaminho(base, it.getAttribute('href')),
        tipo: it.getAttribute('media-type') || '',
        props: it.getAttribute('properties') || ''
      };
    }
    const espinhaEl = opf.getElementsByTagNameNS('*', 'spine')[0];
    const espinha = Array.from(opf.getElementsByTagNameNS('*', 'itemref'))
      .map(r => manifesto[r.getAttribute('idref')]).filter(Boolean);
    if (!espinha.length) throw new Error('EPUB sem conteúdo de leitura.');

    // 3) Sumário: documento de navegação (EPUB 3) ou NCX (EPUB 2)
    const sumario = [];
    const itemNav = Object.values(manifesto).find(m => /\bnav\b/.test(m.props));
    const idNcx = espinhaEl && espinhaEl.getAttribute('toc');
    const itemNcx = (idNcx && manifesto[idNcx]) || Object.values(manifesto).find(m => m.tipo === 'application/x-dtbncx+xml');
    try {
      if (itemNav) {
        const nav = interpretarHtml(await zip.lerTexto(itemNav.caminho), true);
        const navs = Array.from(nav.getElementsByTagNameNS('*', 'nav'));
        const toc = navs.find(e => /toc/.test(e.getAttribute('epub:type') || e.getAttributeNS('http://www.idpf.org/2007/ops', 'type') || '')) || navs[0];
        if (toc) for (const a of Array.from(toc.getElementsByTagNameNS('*', 'a'))) {
          const href = a.getAttribute('href');
          if (href) sumario.push({ titulo: a.textContent.replace(/\s+/g, ' ').trim(), caminho: resolverCaminho(pastaDe(itemNav.caminho), href) });
        }
      }
      if (!sumario.length && itemNcx) {
        const ncx = interpretarXml(await zip.lerTexto(itemNcx.caminho));
        for (const np of Array.from(ncx.getElementsByTagNameNS('*', 'navPoint'))) {
          const rotulo = np.getElementsByTagNameNS('*', 'text')[0];
          const cont = np.getElementsByTagNameNS('*', 'content')[0];
          if (rotulo && cont) sumario.push({ titulo: rotulo.textContent.replace(/\s+/g, ' ').trim(), caminho: resolverCaminho(pastaDe(itemNcx.caminho), cont.getAttribute('src')) });
        }
      }
    } catch (e) { console.warn('Sumário do EPUB ilegível; os capítulos serão detectados pelo texto.', e); }

    // 4) Texto de cada item da espinha (uma "seção" por arquivo)
    const paginas = [];
    for (let i = 0; i < espinha.length; i++) {
      const item = espinha[i];
      ctx.progresso('Lendo o EPUB…', (i + 1) / espinha.length);
      if (item === itemNav) { paginas.push([]); continue; } // o próprio sumário não é lido em voz alta
      try {
        const doc = interpretarHtml(await zip.lerTexto(item.caminho), true);
        paginas.push(extrairBlocos(corpoDe(doc)));
      } catch (e) { paginas.push([]); }
      if (i % 8 === 0) await util.esperar(0);
    }

    // 5) Capítulos do sumário -> índice da seção correspondente
    const capitulosFonte = [];
    const usados = new Set();
    sumario.forEach(s => {
      const idx = espinha.findIndex(it => it.caminho === s.caminho);
      if (idx >= 0 && !usados.has(idx) && s.titulo) { usados.add(idx); capitulosFonte.push({ titulo: s.titulo, pagina: idx }); }
    });

    // 6) Capa
    let capa = null;
    try {
      const metaCapa = Array.from(opf.getElementsByTagNameNS('*', 'meta')).find(m => m.getAttribute('name') === 'cover');
      const itemCapa = (metaCapa && manifesto[metaCapa.getAttribute('content')]) ||
        Object.values(manifesto).find(m => /cover-image/.test(m.props)) ||
        Object.values(manifesto).find(m => /^image\//.test(m.tipo) && /cover|capa/i.test(m.caminho));
      if (itemCapa && /^image\//.test(itemCapa.tipo)) {
        capa = await util.miniatura(new Blob([await zip.ler(itemCapa.caminho)], { type: itemCapa.tipo }));
      }
    } catch (e) { /* capa é opcional */ }

    return {
      conteudo: { paginado: false, paginas, capitulosFonte },
      titulo: textoDaTag(opf, 'title'),
      autor: Array.from(opf.getElementsByTagNameNS('*', 'creator')).map(e => e.textContent.trim()).filter(Boolean).join(', '),
      capa
    };
  }

  /* ============================================================
     PDF (PDF.js)
     ============================================================ */

  /** Carrega o PDF.js da pasta libs (uma única vez). */
  async function carregarPdfJs() {
    // Aberto por duplo clique (file://), o navegador não permite "workers";
    // nesse caso o PDF.js processa na própria página.
    if (!util.viaServidor()) await util.carregarScript(cfgLibs.pdfWorker);
    if (!window.pdfjsLib) await util.carregarScript(cfgLibs.pdf);
    if (!window.pdfjsLib) throw new Error('A biblioteca PDF.js não foi encontrada em libs/pdfjs. Extraia novamente o pacote do LêPraMim.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = util.urlAbsoluta(cfgLibs.pdfWorker);
    return window.pdfjsLib;
  }

  /** Abre um PDF a partir de um ArrayBuffer/Blob. */
  async function abrirPdf(fonte) {
    const lib = await carregarPdfJs();
    const buffer = fonte instanceof Blob ? await fonte.arrayBuffer() : fonte;
    const srv = util.viaServidor();
    const opcoes = { data: new Uint8Array(buffer), isEvalSupported: false, verbosity: 0 };
    if (srv) {
      opcoes.cMapUrl = util.urlAbsoluta(cfgLibs.pdfCmaps);
      opcoes.cMapPacked = true;
      opcoes.standardFontDataUrl = util.urlAbsoluta(cfgLibs.pdfFontes);
      opcoes.wasmUrl = util.urlAbsoluta(cfgLibs.pdfWasm);
    }
    try {
      return await lib.getDocument(opcoes).promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') throw new Error('Este PDF é protegido por senha.');
      throw e;
    }
  }

  /** Extrai as linhas de texto de uma página, com pistas de parágrafo e posição. */
  async function linhasDaPagina(pagina) {
    const vp = pagina.getViewport({ scale: 1 });
    const tc = await pagina.getTextContent();
    const linhas = [];
    let atual = null;

    for (const it of tc.items) {
      if (it.str === undefined) continue;
      const tr = it.transform;
      if (Math.abs(tr[1]) > Math.abs(tr[0]) * 2) continue; // texto na vertical (marca d'água lateral)
      const x = tr[4], y = tr[5];
      const alt = it.height || Math.hypot(tr[2], tr[3]) || 10;
      if (!it.str.trim()) {
        if (atual) { if (it.hasEOL) atual.fim = true; else atual.espaco = true; }
        continue;
      }
      const mesma = atual && !atual.fim && Math.abs(y - atual.y) < Math.max(atual.alt, alt) * 0.5;
      if (mesma) {
        const vao = x - atual.xFim;
        if ((vao > alt * 0.18 || atual.espaco) && !/\s$/.test(atual.t) && !/^\s/.test(it.str)) atual.t += ' ';
        atual.t += it.str;
        atual.xFim = x + (it.width || 0);
        atual.espaco = false;
        atual.alt = Math.max(atual.alt, alt);
      } else {
        atual = { t: it.str, x, y, xFim: x + (it.width || 0), alt, fim: false, espaco: false };
        linhas.push(atual);
      }
      if (it.hasEOL) atual.fim = true;
    }

    // Espaçamento típico entre linhas (mediana)
    const saltos = [];
    for (let i = 1; i < linhas.length; i++) {
      const d = linhas[i - 1].y - linhas[i].y;
      if (d > 0 && d < linhas[i].alt * 4) saltos.push(d);
    }
    saltos.sort((a, b) => a - b);
    const tipico = saltos.length ? saltos[Math.floor(saltos.length / 2)] : 0;

    return linhas.map((l, i) => {
      let q = i === 0;
      if (i > 0) {
        const ant = linhas[i - 1];
        const d = ant.y - l.y;
        if (d < -l.alt) q = true;                                   // subiu: nova coluna
        else if (tipico && d > tipico * 1.45) q = true;             // espaço maior: novo parágrafo
        else if (l.x - ant.x > l.alt * 0.8 && l.x - ant.x < l.alt * 6) q = true; // recuo de primeira linha
      }
      return {
        t: l.t.replace(/\s+/g, ' ').trim(),
        q,
        a: Math.round(l.alt * 2) / 2,
        y: Math.round((1 - l.y / (vp.height || 1)) * 1000) / 1000
      };
    }).filter(l => l.t);
  }

  /** Desenha uma página do PDF em um canvas. */
  async function desenharPagina(pagina, escala, canvas) {
    const vp = pagina.getViewport({ scale: escala });
    canvas = canvas || document.createElement('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvasContext: ctx, canvas, viewport: vp }).promise;
    return canvas;
  }

  /** Sumário embutido no PDF (marcadores/outline) -> [{titulo, pagina}] */
  async function sumarioDoPdf(pdf) {
    const saida = [];
    let itens = null;
    try { itens = await pdf.getOutline(); } catch (e) { return saida; }
    if (!itens || !itens.length) return saida;
    if (itens.length === 1 && itens[0].items && itens[0].items.length > 1) itens = itens[0].items;
    for (const it of itens.slice(0, 400)) {
      try {
        let dest = it.dest;
        if (typeof dest === 'string') dest = await pdf.getDestination(dest);
        if (!dest || dest[0] === undefined || dest[0] === null) continue;
        const idx = typeof dest[0] === 'object' ? await pdf.getPageIndex(dest[0]) : dest[0];
        if (it.title) saida.push({ titulo: it.title, pagina: idx });
      } catch (e) { /* destino inválido: ignora */ }
    }
    return saida;
  }

  /* ---------------- OCR (Tesseract.js) ---------------- */

  /** Diz por que o OCR não pode ser usado agora (ou '' se puder). */
  async function motivoSemOcr(perguntar) {
    if (!util.viaServidor()) return 'O OCR só funciona quando o LêPraMim é aberto por um site ou pelo arquivo "Iniciar-LePraMim" (modo servidor local).';
    // [Nebulosa] pasta libs, cópia guardada no navegador ou download pela internet (com permissão)
    const ok = await LPM.libsWeb.obter('ocr', { perguntar, explicacao: 'Para reconhecer o texto de páginas digitalizadas,' });
    if (!ok || !window.Tesseract) return perguntar === false ? 'O componente de OCR ainda não foi baixado.' : 'O componente de OCR não está disponível agora (sem internet, ou o download não foi aceito).';
    return '';
  }

  /** Cria um reconhecedor de texto totalmente local. */
  async function criarOcr(aoProgresso) {
    const motivo = await motivoSemOcr();
    if (motivo) throw new Error(motivo);
    const web = LPM.libsWeb.opcoesOcr(); // [Nebulosa] componente baixado pela internet
    return window.Tesseract.createWorker(LPM.dados.cfg.idiomaOcr || 'por', 1, Object.assign({
      workerPath: util.urlAbsoluta(cfgLibs.tesseractWorker),
      corePath: util.urlAbsoluta(cfgLibs.tesseractCore).replace(/\/$/, ''),
      langPath: util.urlAbsoluta(cfgLibs.tesseractLang),
      workerBlobURL: false,
      gzip: true,
      logger: m => { if (aoProgresso && m && m.status === 'recognizing text') aoProgresso(m.progress || 0); }
    }, web || {}));
  }

  /** Converte o texto devolvido pelo OCR em linhas com pistas de parágrafo. */
  function linhasDoOcr(texto) {
    const linhas = [];
    let q = true;
    String(texto || '').split('\n').forEach(l => {
      const t = l.replace(/\s+/g, ' ').trim();
      if (!t) { q = true; return; }
      linhas.push({ t, q });
      q = false;
    });
    return linhas;
  }

  async function importarPdf(arquivo, ctx) {
    ctx.progresso('Abrindo o PDF…', 0);
    const pdf = await abrirPdf(await arquivo.arrayBuffer());
    const n = pdf.numPages;
    const paginas = [];
    const semTexto = [];

    for (let i = 1; i <= n; i++) {
      if (ctx.cancelado()) throw new Error('Importação cancelada.');
      ctx.progresso(`Extraindo o texto: página ${i} de ${n}`, i / n);
      const pg = await pdf.getPage(i);
      const linhas = await linhasDaPagina(pg);
      paginas.push(linhas);
      if (linhas.reduce((s, l) => s + l.t.length, 0) < 25) semTexto.push(i);
      pg.cleanup();
    }

    // PDF digitalizado (imagens no lugar do texto): oferece OCR
    let aviso = '';
    if (semTexto.length >= Math.max(1, n * 0.2)) {
      const motivo = util.viaServidor() ? '' : await motivoSemOcr(false);
      if (motivo) {
        aviso = `${semTexto.length} de ${n} páginas não têm texto (parecem digitalizadas). ${motivo}`;
      } else if (await ctx.perguntar(
        'PDF digitalizado',
        `${semTexto.length} de ${n} páginas não têm texto: parecem imagens digitalizadas. Reconhecer o texto com OCR? ` +
        'O processo é feito neste computador e leva alguns segundos por página.',
        'Reconhecer texto', 'Agora não')) {
        let ocr = null;
        try {
          ctx.progresso('Preparando o OCR…', 0);
          let atual = 0;
          ocr = await criarOcr(f => ctx.progresso(`OCR: página ${semTexto[atual]} (${atual + 1} de ${semTexto.length})`, (atual + f) / semTexto.length));
          for (atual = 0; atual < semTexto.length; atual++) {
            if (ctx.cancelado()) break; // mantém o que já foi reconhecido
            const num = semTexto[atual];
            const pg = await pdf.getPage(num);
            const vp = pg.getViewport({ scale: 1 });
            const canvas = await desenharPagina(pg, Math.min(2.5, 2000 / vp.width));
            const r = await ocr.recognize(canvas);
            paginas[num - 1] = linhasDoOcr(r.data.text);
            canvas.width = canvas.height = 0;
            pg.cleanup();
          }
        } catch (e) {
          aviso = 'O OCR não pôde ser concluído: ' + (e && e.message ? e.message : e);
        } finally {
          if (ocr) try { await ocr.terminate(); } catch (e) { /* ignora */ }
        }
      }
    }

    // Metadados, sumário e capa
    let titulo = '', autor = '';
    try {
      const md = await pdf.getMetadata();
      titulo = (md.info && md.info.Title) || '';
      autor = (md.info && md.info.Author) || '';
    } catch (e) { /* opcional */ }
    const capitulosFonte = await sumarioDoPdf(pdf);
    let capa = null;
    try {
      const p1 = await pdf.getPage(1);
      const vp = p1.getViewport({ scale: 1 });
      capa = (await desenharPagina(p1, 300 / vp.width)).toDataURL('image/jpeg', 0.82);
    } catch (e) { /* opcional */ }
    try { await pdf.destroy(); } catch (e) { /* ignora */ }

    // Títulos genéricos gravados por programas ("Microsoft Word - doc1.docx") não ajudam
    if (/^(untitled|sem t[ií]tulo|microsoft word|document\d*)\b/i.test(titulo.trim())) titulo = '';
    return { conteudo: { paginado: true, paginas, capitulosFonte }, titulo: String(titulo).trim(), autor: String(autor).trim(), capa, aviso, guardar: true, paginasOriginais: n };
  }

  /* ---------------- Imagem (OCR direto) ---------------- */
  async function importarImagem(arquivo, ctx) {
    ctx.progresso('Preparando o OCR…', 0);
    const ocr = await criarOcr(f => ctx.progresso('Reconhecendo o texto da imagem…', f));
    try {
      const r = await ocr.recognize(arquivo);
      const capa = await util.miniatura(arquivo).catch(() => null);
      return { conteudo: { paginado: true, paginas: [linhasDoOcr(r.data.text)] }, capa };
    } finally {
      try { await ocr.terminate(); } catch (e) { /* ignora */ }
    }
  }

  /* ============================================================
     Áudio
     ============================================================ */

  /** Descobre a duração de um arquivo de áudio. */
  function duracaoDoAudio(arquivo) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(arquivo);
      const a = new Audio();
      const fim = v => { URL.revokeObjectURL(url); resolve(v); };
      a.preload = 'metadata';
      a.onloadedmetadata = () => fim(isFinite(a.duration) ? a.duration : 0);
      a.onerror = () => fim(0);
      setTimeout(() => fim(0), 15000);
      a.src = url;
    });
  }

  async function importarAudio(arquivo, ctx) {
    ctx.progresso('Lendo as informações do audiobook…', 0.3);
    let md = {};
    try { md = await LPM.metaAudio.ler(arquivo); } catch (e) { console.warn('Metadados ilegíveis:', e); }
    const duracao = await duracaoDoAudio(arquivo);
    if (!duracao) throw new Error('O navegador não conseguiu reproduzir este arquivo de áudio.');
    let capa = null;
    if (md.capa) try { capa = await util.miniatura(md.capa); } catch (e) { /* opcional */ }
    return {
      tipo: 'audio', guardar: true, capa,
      titulo: md.titulo || md.album || '', autor: md.autor || '',
      extras: { narrador: md.narrador || '', genero: md.genero || '', album: md.album || '', duracao, capitulosAudio: md.capitulos || [] }
    };
  }

  /* ============================================================
     Ponto de entrada
     ============================================================ */
  const EXT_IMAGEM = ['png', 'jpg', 'jpeg', 'webp', 'bmp'];

  function tipoDoArquivo(nome) {
    const ext = util.extensao(nome);
    if (LPM.config.EXT_AUDIO.includes(ext)) return 'audio';
    if (LPM.config.EXT_TEXTO.includes(ext)) return 'texto';
    if (EXT_IMAGEM.includes(ext)) return 'imagem';
    return '';
  }

  /**
   * Importa um arquivo. ctx = { progresso(texto, fração), perguntar(...), cancelado() }
   * Retorna { meta, conteudo, arquivo (ou null), aviso }
   */
  async function arquivo(arq, ctx) {
    const ext = util.extensao(arq.name);
    const tipo = tipoDoArquivo(arq.name);
    if (!tipo) throw new Error(`O formato ".${ext || '?'}" não é suportado.`);

    let r;
    if (tipo === 'audio') r = await importarAudio(arq, ctx);
    else if (tipo === 'imagem') r = await importarImagem(arq, ctx);
    else if (ext === 'pdf') r = await importarPdf(arq, ctx);
    else if (ext === 'epub') r = await importarEpub(arq, ctx);
    else if (ext === 'docx') r = await importarDocx(arq, ctx);
    else if (ext === 'rtf') r = await importarRtf(arq, ctx);
    else if (ext === 'txt') r = await importarTxt(arq, ctx);
    else r = await importarHtml(arq, ctx);

    const formato = (ext === 'htm' || ext === 'xhtml') ? 'html' : ext;
    const meta = Object.assign({
      id: util.gerarId(),
      titulo: (r.titulo || util.semExtensao(arq.name)).slice(0, 200),
      autor: (r.autor || '').slice(0, 200),
      formato,
      tipo: tipo === 'audio' ? 'audio' : 'texto',
      arquivo: arq.name,
      tamanho: arq.size,
      adicionado: Date.now(),
      capa: r.capa || null,
      temArquivo: !!r.guardar,
      paginasOriginais: r.paginasOriginais || 0
    }, r.extras || {});

    if (meta.tipo === 'texto') {
      const totalTexto = r.conteudo.paginas.reduce((s, pg) => s + pg.reduce((x, b) => x + (b.t ? b.t.length : 0), 0), 0);
      if (totalTexto < 5 && !r.aviso) r.aviso = 'Nenhum texto foi encontrado neste arquivo.';
    }
    return { meta, conteudo: r.conteudo || null, arquivo: r.guardar ? arq : null, aviso: r.aviso || '' };
  }

  LPM.importar = { arquivo, tipoDoArquivo, abrirPdf, carregarPdfJs, desenharPagina, EXT_IMAGEM };
})();
