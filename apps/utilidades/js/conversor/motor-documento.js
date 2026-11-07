/* ==========================================================================
   Utilidades — Conversor: motor de DOCUMENTOS (1.0)
   Todo documento é lido para HTML (o "formato do meio") e gravado a partir dele.
   Lê:    DOCX, ODT, RTF, EPUB, FB2, HTML, Markdown, TXT e PDF (texto; páginas só de imagem entram como figuras)
   Grava: PDF, DOCX, ODT, RTF, EPUB, HTML, Markdown e TXT
   O PDF é gerado por motor-pdf.js. Formatação complexa (colunas, caixas de texto, campos) é simplificada.
   ========================================================================== */
(function () {
  'use strict';
  const { T, esc } = UT, CV = UT.CV;
  const ENTRADAS = ['docx', 'odt', 'rtf', 'epub', 'fb2', 'html', 'md', 'txt', 'pdf'];
  const SAIDAS = ['pdf', 'docx', 'odt', 'rtf', 'epub', 'html', 'md', 'txt'];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------- HTML seguro ---------- */
  function limpar(html) {
    const d = new DOMParser().parseFromString('<body>' + html, 'text/html');
    d.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,button,textarea,select,base,video,audio,noscript,template,canvas').forEach(n => n.remove());
    d.body.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(a => {
        const n = a.name.toLowerCase(), v = a.value.trim().toLowerCase();
        if (n.startsWith('on')) el.removeAttribute(a.name);
        else if ((n === 'href' || n === 'src') && /^(javascript:|vbscript:|data:(?!image\/(png|jpe?g|gif|webp|bmp)))/.test(v)) el.removeAttribute(a.name);
      });
    });
    return d.body.innerHTML;
  }
  const paraDom = html => new DOMParser().parseFromString('<!DOCTYPE html><html><body>' + html + '</body></html>', 'text/html');
  const dataUri = (mime, b64) => 'data:' + mime + ';base64,' + b64;
  async function zipUri(z, caminho) {
    const e = z.file(caminho); if (!e) return '';
    const ext = (/\.([a-z0-9]+)$/i.exec(caminho) || [])[1] || 'png', mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml' }[ext.toLowerCase()];
    if (!mime) return '';
    return dataUri(mime, await e.async('base64'));
  }
  const juntar = (base, rel) => { const p = (base ? base.replace(/[^/]*$/, '') : '') + decodeURIComponent(rel.split('#')[0]); const o = []; p.split('/').forEach(s => { if (s === '..') o.pop(); else if (s && s !== '.') o.push(s); }); return o.join('/'); };

  /* ---------- leitores: arquivo -> { html, titulo } ---------- */
  async function lerDocx(f) {
    const M = await CV.lib('mammoth');
    const r = await M.convertToHtml({ arrayBuffer: await f.arrayBuffer() });
    return { html: limpar(r.value) };
  }
  async function lerOdt(f) {
    const Z = await UT.jszip(), z = await Z.loadAsync(await f.arrayBuffer());
    const arq = z.file('content.xml'); if (!arq) throw new Error(T('Este arquivo não parece ser um documento ODT.'));
    const xml = new DOMParser().parseFromString(await arq.async('string'), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error(T('Não foi possível ler o conteúdo do ODT.'));
    const imgs = {}, estilos = {}, listas = {};
    for (const n of Object.keys(z.files)) if (/^Pictures\//i.test(n)) imgs[n] = await zipUri(z, n);
        let estXml = null; try { const sa = z.file('styles.xml'); if (sa) estXml = new DOMParser().parseFromString(await sa.async('string'), 'application/xml'); } catch (e) { estXml = null; }
    [xml, estXml].forEach(doc => {
      if (!doc) return;
      [...doc.getElementsByTagName('text:list-style')].forEach(ls => { const nome = ls.getAttribute('style:name'); if (nome) listas[nome] = !!ls.getElementsByTagName('text:list-level-style-number')[0]; });
      [...doc.getElementsByTagName('style:style')].forEach(s => {
        const nome = s.getAttribute('style:name'), tp = s.getElementsByTagName('style:text-properties')[0]; if (!nome || !tp) return;
        estilos[nome] = { b: /bold|[6-9]00/.test(tp.getAttribute('fo:font-weight') || ''), i: tp.getAttribute('fo:font-style') === 'italic', u: !!tp.getAttribute('style:text-underline-style') && tp.getAttribute('style:text-underline-style') !== 'none', s: !!tp.getAttribute('style:text-line-through-style') && tp.getAttribute('style:text-line-through-style') !== 'none' };
      });
    });
    const env = (txt, st) => { if (!st) return txt; if (st.b) txt = '<strong>' + txt + '</strong>'; if (st.i) txt = '<em>' + txt + '</em>'; if (st.u) txt = '<u>' + txt + '</u>'; if (st.s) txt = '<s>' + txt + '</s>'; return txt; };
    const inl = n => {
      let o = '';
      n.childNodes.forEach(c => {
        if (c.nodeType === 3) { o += esc(c.nodeValue); return; }
        if (c.nodeType !== 1) return;
        const t = c.tagName;
        if (t === 'text:span') o += env(inl(c), estilos[c.getAttribute('text:style-name')]);
        else if (t === 'text:a') o += '<a href="' + esc(c.getAttribute('xlink:href') || '') + '">' + inl(c) + '</a>';
        else if (t === 'text:line-break') o += '<br>';
        else if (t === 'text:tab') o += '\t';
        else if (t === 'text:s') o += ' '.repeat(+c.getAttribute('text:c') || 1);
        else if (t === 'draw:frame') { const im = c.getElementsByTagName('draw:image')[0], h = im && (im.getAttribute('xlink:href') || '').replace(/^\.\//, ''); if (h && imgs[h]) o += '<img src="' + imgs[h] + '" alt="">'; }
        else if (t === 'text:note') { /* notas de rodapé ficam de fora */ }
        else o += inl(c);
      });
      return o;
    };
    const bloco = n => {
      let o = '';
      n.childNodes.forEach(c => {
        if (c.nodeType !== 1) return;
        const t = c.tagName;
        if (t === 'text:h') { const l = Math.min(6, Math.max(1, +c.getAttribute('text:outline-level') || 1)); o += '<h' + l + '>' + inl(c) + '</h' + l + '>'; }
        else if (t === 'text:p') { const i = inl(c); o += i.trim() ? '<p>' + i + '</p>' : ''; }
        else if (t === 'text:list') { const ord = listas[c.getAttribute('text:style-name')], tag = ord ? 'ol' : 'ul'; o += '<' + tag + '>' + [...c.children].map(li => '<li>' + (li.tagName === 'text:list-item' || li.tagName === 'text:list-header' ? bloco(li).replace(/^<p>([\s\S]*?)<\/p>/, '$1') : '') + '</li>').join('') + '</' + tag + '>'; }
        else if (t === 'table:table') { o += '<table>' + [...c.getElementsByTagName('table:table-row')].filter(r => r.closest('table\\:table') === c || r.parentNode.parentNode === c || r.parentNode === c).map(r => '<tr>' + [...r.children].filter(x => x.tagName === 'table:table-cell').map(x => '<td>' + (bloco(x) || '') + '</td>').join('') + '</tr>').join('') + '</table>'; }
        else if (t === 'text:section' || t === 'text:table-of-content' || t === 'text:index-body') o += bloco(c);
      });
      return o;
    };
    const corpo = xml.getElementsByTagName('office:text')[0];
    if (!corpo) throw new Error(T('Este documento ODT não tem texto.'));
    return { html: limpar(bloco(corpo)) };
  }
  function lerRtf(txt) {
    const PULAR = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'headerl', 'headerr', 'footerl', 'footerr', 'listtable', 'listoverridetable', 'generator', 'revtbl', 'rsidtbl', 'themedata', 'colorschememapping', 'latentstyles', 'datastore', 'xmlnstbl', 'fldinst', 'private', 'object', 'footnote', 'bkmkstart', 'bkmkend']);
    const ESPECIAIS = { emdash: '—', endash: '–', lquote: '‘', rquote: '’', ldblquote: '“', rdblquote: '”', bullet: '•', tab: '\t', emspace: ' ', enspace: ' ' };
    let i = 0, pilha = [], st = { b: 0, i: 0, u: 0, pular: 0 }, runs = [], html = '', uc = 1, saltar = 0;
    const cp1252 = c => { try { return new TextDecoder('windows-1252').decode(new Uint8Array([c])); } catch (e) { return String.fromCharCode(c); } };
    const txtAtual = [];
    const emitir = s => { if (st.pular || !s) return; txtAtual.push([s, st.b, st.i, st.u]); };
    const fecharPar = () => {
      const t = txtAtual.splice(0), tem = t.some(x => x[0].trim());
      if (!tem) { html += ''; return; }
      html += '<p>' + t.map(([s, b, it, u]) => { let h = esc(s); if (b) h = '<strong>' + h + '</strong>'; if (it) h = '<em>' + h + '</em>'; if (u) h = '<u>' + h + '</u>'; return h; }).join('') + '</p>';
    };
    const n = txt.length;
    while (i < n) {
      const c = txt[i];
      if (c === '{') { pilha.push(Object.assign({}, st)); i++; let j = i; if (txt[j] === '\\' && txt[j + 1] === '*') { st.pular++; i = j + 2; } continue; }
      if (c === '}') { st = pilha.pop() || st; i++; continue; }
      if (c === '\\') {
        const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(txt.slice(i, i + 40));
        if (m) {
          const p = m[1], v = m[2] == null ? null : +m[2]; i += m[0].length;
          if (PULAR.has(p) && !st.pular) { st.pular++; continue; }
          if (p === 'par' || p === 'sect' || p === 'row') fecharPar();
          else if (p === 'line') { if (!st.pular) txtAtual.push(['\n', 0, 0, 0]); }
          else if (p === 'cell') emitir('\t');
          else if (p === 'b') st.b = v === 0 ? 0 : 1; else if (p === 'i') st.i = v === 0 ? 0 : 1;
          else if (p === 'ul') st.u = v === 0 ? 0 : 1; else if (p === 'ulnone') st.u = 0; else if (p === 'plain') { st.b = st.i = st.u = 0; }
          else if (p === 'uc') uc = v == null ? 1 : v;
          else if (p === 'u') { emitir(String.fromCharCode(v < 0 ? v + 65536 : v)); saltar = uc; }
          else if (ESPECIAIS[p] != null) emitir(ESPECIAIS[p]);
          continue;
        }
        const n2 = txt[i + 1];
        if (n2 === "'") { const h = parseInt(txt.substr(i + 2, 2), 16); if (saltar) saltar--; else emitir(cp1252(h)); i += 4; continue; }
        if (n2 === '~') { emitir(' '); i += 2; continue; }
        if (n2 === '_') { emitir('‑'); i += 2; continue; }
        if (n2 === '{' || n2 === '}' || n2 === '\\') { emitir(n2); i += 2; continue; }
        i += 2; continue;
      }
      if (c === '\r' || c === '\n') { i++; continue; }
      if (saltar > 0) { saltar--; i++; continue; }
      let j = i; while (j < n && txt[j] !== '\\' && txt[j] !== '{' && txt[j] !== '}' && txt[j] !== '\r' && txt[j] !== '\n') j++;
      emitir(txt.slice(i, j)); i = j;
    }
    fecharPar();
    return { html };
  }
  async function lerEpub(f) {
    const Z = await UT.jszip(), z = await Z.loadAsync(await f.arrayBuffer());
    const cont = z.file('META-INF/container.xml'); if (!cont) throw new Error(T('Este arquivo não parece ser um EPUB.'));
    const xml = s => new DOMParser().parseFromString(s, 'application/xml');
    const raiz = xml(await cont.async('string')).querySelector('rootfile').getAttribute('full-path');
    const opf = xml(await z.file(raiz).async('string')), itens = {};
    opf.querySelectorAll('manifest > item').forEach(it => { itens[it.getAttribute('id')] = it.getAttribute('href'); });
    const titulo = (opf.querySelector('metadata > title, metadata title') || {}).textContent || '';
    let html = '';
    for (const r of [...opf.querySelectorAll('spine > itemref')]) {
      const href = itens[r.getAttribute('idref')]; if (!href) continue;
      const cam = juntar(raiz, href), arq = z.file(cam); if (!arq) continue;
      const d = new DOMParser().parseFromString(await arq.async('string'), 'text/html');
      for (const im of [...d.querySelectorAll('img')]) { const s = im.getAttribute('src') || ''; if (/^data:/.test(s)) continue; const u = await zipUri(z, juntar(cam, s)); if (u) im.setAttribute('src', u); else im.remove(); }
      d.querySelectorAll('svg,image').forEach(x => x.remove());
      html += d.body.innerHTML;
    }
    return { html: limpar(html), titulo };
  }
  async function lerFb2(f) {
    const d = new DOMParser().parseFromString(await CV.lerTexto(f), 'application/xml');
    if (d.querySelector('parsererror')) throw new Error(T('Este arquivo não parece ser um FB2 válido.'));
    const bin = {}; d.querySelectorAll('binary').forEach(b => { bin[b.getAttribute('id')] = dataUri(b.getAttribute('content-type') || 'image/jpeg', (b.textContent || '').replace(/\s+/g, '')); });
    const inl = n => { let o = ''; n.childNodes.forEach(c => { if (c.nodeType === 3) o += esc(c.nodeValue); else if (c.nodeType === 1) { const t = c.localName; if (t === 'emphasis') o += '<em>' + inl(c) + '</em>'; else if (t === 'strong') o += '<strong>' + inl(c) + '</strong>'; else if (t === 'strikethrough') o += '<s>' + inl(c) + '</s>'; else if (t === 'sub') o += '<sub>' + inl(c) + '</sub>'; else if (t === 'sup') o += '<sup>' + inl(c) + '</sup>'; else if (t === 'a') o += inl(c); else if (t === 'image') { const h = (c.getAttribute('l:href') || c.getAttribute('xlink:href') || '').replace('#', ''); if (bin[h]) o += '<img src="' + bin[h] + '" alt="">'; } else o += inl(c); } }); return o; };
    const sec = (n, nivel) => { let o = ''; [...n.children].forEach(c => { const t = c.localName; if (t === 'title') o += '<h' + Math.min(6, nivel) + '>' + [...c.children].map(inl).join(' ') + '</h' + Math.min(6, nivel) + '>'; else if (t === 'p') o += '<p>' + inl(c) + '</p>'; else if (t === 'empty-line') o += '<br>'; else if (t === 'subtitle') o += '<h' + Math.min(6, nivel + 1) + '>' + inl(c) + '</h' + Math.min(6, nivel + 1) + '>'; else if (t === 'epigraph' || t === 'cite') o += '<blockquote>' + sec(c, nivel) + '</blockquote>'; else if (t === 'poem') o += sec(c, nivel); else if (t === 'stanza') o += sec(c, nivel) + '<br>'; else if (t === 'v') o += '<p>' + inl(c) + '</p>'; else if (t === 'section') o += sec(c, nivel + 1); else if (t === 'image') o += '<p>' + inl({ childNodes: [c] }) + '</p>'; }); return o; };
    let html = ''; d.querySelectorAll('FictionBook > body').forEach(b => { html += sec(b, 1); });
    const titulo = (d.querySelector('title-info > book-title') || {}).textContent || '';
    return { html: limpar(html), titulo };
  }
  async function lerHtml(f) {
    const d = new DOMParser().parseFromString(await CV.lerTexto(f), 'text/html');
    const titulo = (d.querySelector('title') || {}).textContent || '';
    return { html: limpar(d.body ? d.body.innerHTML : ''), titulo: titulo.trim() };
  }
  async function lerMd(f) {
    const M = await CV.lib('marked'), t = await CV.lerTexto(f);
    return { html: limpar(M.parse(t, { mangle: false, headerIds: false })) };
  }
  async function lerTxt(f) {
    const t = await CV.lerTexto(f);
    return { html: t.replace(/\r\n?/g, '\n').split(/\n{2,}/).filter(s => s.trim()).map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('') };
  }
  /* PDF: texto vira títulos/parágrafos/listas; páginas sem texto (digitalizadas) entram como figuras, na ordem */
  async function lerPdf(f, ctx, o) {
    const lib = await UT.pdfjs();
    let pdf;
    try { pdf = await lib.getDocument({ data: await CV.lerBytes(f), isEvalSupported: false, verbosity: 0 }).promise; }
    catch (e) { if (/Password/i.test(String(e && e.name + e.message))) throw new Error(T('Este PDF é protegido por senha. Tire a senha antes (no programa que criou o arquivo) e tente de novo.')); throw e; }
    const nPag = pdf.numPages, linhas = [], pgImg = {}, O = lib.OPS || {};
    const pinta = new Set(['paintImageXObject', 'paintInlineImageXObject', 'paintImageMaskXObject', 'paintJpegXObject', 'paintSolidColorImageMask', 'paintImageXObjectRepeat', 'paintXObject', 'fill', 'eoFill', 'fillStroke', 'stroke', 'shadingFill', 'showText', 'showSpacedText'].map(k => O[k]).filter(x => x !== undefined));
    let nImg = 0;
    for (let n = 1; n <= nPag; n++) {
      if (ctx) { CV.checar(ctx); ctx.progresso((n - 1) / nPag * 0.8, T('Página {1} de {2}', n, nPag)); }
      const pg = await pdf.getPage(n), tc = await pg.getTextContent(), vp = pg.getViewport({ scale: 1 });
      const its = tc.items.filter(i => i.str !== undefined).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], h: Math.hypot(i.transform[2], i.transform[3]) || i.height || 10, w: i.width }));
      if (its.reduce((t, i) => t + i.s.trim().length, 0) < 15) {
        if (o.imagens === 'nao') continue;
        let desenha = true; try { const ops = await pg.getOperatorList(); desenha = ops.fnArray.some(x => pinta.has(x)); } catch (e) { /* desenha */ }
        if (!desenha) continue;
        const k = Math.min(3, Math.max(.4, (nPag > 60 ? 900 : nPag > 30 ? 1100 : nPag > 12 ? 1400 : 1700) / vp.width)), v = pg.getViewport({ scale: k });
        const c = document.createElement('canvas'); c.width = Math.ceil(v.width); c.height = Math.ceil(v.height);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        await pg.render({ canvasContext: g, viewport: v }).promise;
        pgImg[n] = c.toDataURL('image/jpeg', nPag > 60 ? .7 : nPag > 30 ? .78 : .86); nImg++; c.width = c.height = 0; continue;
      }
      its.sort((a, b) => b.y - a.y || a.x - b.x);
      let cur = null;
      for (const it of its) {
        if (!it.s) continue;
        if (cur && Math.abs(cur.y - it.y) <= Math.max(2, cur.h * .45)) { const gap = it.x - cur.xf; cur.t += (gap > cur.h * .15 && !/\s$/.test(cur.t) && !/^\s/.test(it.s) ? ' ' : '') + it.s; cur.xf = it.x + it.w; cur.h = Math.max(cur.h, it.h); }
        else { cur = { t: it.s, x: it.x, xf: it.x + it.w, y: it.y, h: it.h, pg: n, pw: vp.width }; linhas.push(cur); }
      }
    }
    const freq = {}; linhas.forEach(l => { const k = Math.round(l.h); freq[k] = (freq[k] || 0) + l.t.length; });
    const base = +Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0] || 11;
    const rep = {}; linhas.forEach(l => { const k = l.t.trim().replace(/\d+/g, '#'); (rep[k] = rep[k] || new Set()).add(l.pg); });
    const nTexto = new Set(linhas.map(l => l.pg)).size;
    const util = linhas.filter(l => { const t = l.t.trim(); if (!t) return false; if (/^(p[áa]gina\s*)?\d+(\s*(de|\/)\s*\d+)?$/i.test(t)) return false; const k = t.replace(/\d+/g, '#'); return !(nTexto >= 3 && rep[k].size >= Math.max(3, nTexto * .6) && t.length < 90); });
    const montar = ls => {
      const out = []; let par = null, lista = null;
      const fp = () => { if (par) { out.push('<p>' + esc(par.t) + '</p>'); par = null; } };
      const fl = () => { if (lista) { out.push('<' + lista.tag + '>' + lista.itens.map(i => '<li>' + esc(i) + '</li>').join('') + '</' + lista.tag + '>'); lista = null; } };
      ls.forEach((l, i) => {
        const t = l.t.replace(/\s+/g, ' ').trim(), prev = ls[i - 1], gap = prev && prev.pg === l.pg ? prev.y - l.y : 999;
        const marc = /^([•●▪◦·\-–—*]|\d{1,3}[.)]|[a-z][.)])\s+/.exec(t);
        if (l.h >= base * 1.25 && t.length <= 120) { fp(); fl(); const tag = l.h >= base * 1.7 ? 'h1' : l.h >= base * 1.4 ? 'h2' : 'h3'; const ult = out[out.length - 1]; if (ult && ult.startsWith('<' + tag + '>') && gap < l.h * 1.6) out[out.length - 1] = ult.replace('</' + tag + '>', ' ' + esc(t) + '</' + tag + '>'); else out.push('<' + tag + '>' + esc(t) + '</' + tag + '>'); return; }
        if (marc) { fp(); const tag = /^\d/.test(marc[1]) || /^[a-z]/.test(marc[1]) ? 'ol' : 'ul'; if (!lista || lista.tag !== tag) { fl(); lista = { tag, itens: [] }; } lista.itens.push(t.slice(marc[0].length)); return; }
        const novo = !par || gap > l.h * 1.75 || gap < 0 || (l.x - prev.x > l.h * 1.2 && prev.xf < prev.pw * .8) || /[.:!?…]$/.test(par.t) && prev.xf < prev.pw * .62;
        if (lista && !novo && gap < l.h * 1.75 && l.x > (prev ? prev.x : 0)) { lista.itens[lista.itens.length - 1] += ' ' + t; return; }
        fl();
        if (novo) { fp(); par = { t }; } else par.t = /[A-Za-zÀ-ú]-$/.test(par.t) && /^[a-zà-ú]/.test(t) ? par.t.slice(0, -1) + t : par.t + ' ' + t;
      });
      fp(); fl(); return out;
    };
    const partes = []; let trecho = [];
    const fecha = () => { if (trecho.length) { partes.push(...montar(trecho)); trecho = []; } };
    for (let n = 1; n <= nPag; n++) { if (pgImg[n]) { fecha(); partes.push('<p><img src="' + pgImg[n] + '" alt="' + esc(T('Página {1}', n)) + '"></p>'); } else trecho.push(...util.filter(l => l.pg === n)); }
    fecha();
    if (!partes.length) throw new Error(T('Este PDF não tem texto nem imagens que possam ser convertidos (as páginas estão em branco).'));
    return { html: partes.join(''), soImagens: !nTexto && nImg > 0 };
  }
  async function lerDocumento(f, de, ctx, o) {
    switch (de) {
      case 'docx': return lerDocx(f); case 'odt': return lerOdt(f); case 'rtf': return lerRtf(await CV.lerTexto(f));
      case 'epub': return lerEpub(f); case 'fb2': return lerFb2(f); case 'html': return lerHtml(f); case 'md': return lerMd(f);
      case 'txt': return lerTxt(f); case 'pdf': return lerPdf(f, ctx, o || {});
    }
    throw new Error('formato');
  }

  /* ---------- gravadores a partir do HTML ---------- */
  const BLOCOS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE', 'HR', 'SECTION', 'ARTICLE', 'FIGURE', 'FIGCAPTION', 'HEADER', 'FOOTER', 'MAIN', 'DL', 'DT', 'DD']);
  function paraTxt(body) {
    let out = '';
    const nl = () => { if (out && !/\n\n$/.test(out)) out += out.endsWith('\n') ? '\n' : '\n\n'; };
    (function walk(n, ctx) {
      n.childNodes.forEach(c => {
        if (c.nodeType === 3) { out += ctx.pre ? c.nodeValue : c.nodeValue.replace(/\s+/g, ' '); return; }
        if (c.nodeType !== 1) return;
        const t = c.tagName;
        if (t === 'BR') { out += '\n'; return; }
        if (t === 'IMG') { return; }
        if (t === 'HR') { nl(); out += '----------------------------------------\n\n'; return; }
        if (t === 'TABLE') { nl(); [...c.querySelectorAll('tr')].forEach(r => { out += [...r.children].map(x => x.textContent.replace(/\s+/g, ' ').trim()).join('\t') + '\n'; }); out += '\n'; return; }
        if (t === 'UL' || t === 'OL') { nl(); let k = 0; [...c.children].forEach(li => { k++; out += '  '.repeat(ctx.nivel || 0) + (t === 'OL' ? k + '. ' : '• '); const sub = []; const tmp = out.length; walk(li, { nivel: (ctx.nivel || 0) + 1, pre: false }); out = out.replace(/\n+$/, '') + '\n'; }); out += '\n'; return; }
        if (t === 'PRE') { nl(); out += c.textContent.replace(/\n$/, '') + '\n\n'; return; }
        if (t === 'LI') { walk(c, ctx); return; }
        if (BLOCOS.has(t)) { const q = t === 'BLOCKQUOTE'; nl(); if (q) out += '\u0001'; walk(c, ctx); if (q) { const a = out.lastIndexOf('\u0001'); out = out.slice(0, a) + out.slice(a + 1).replace(/^[ \t]*(?=\S)/gm, '> '); } out = out.replace(/[ \t]+$/gm, ''); nl(); return; }
        walk(c, ctx);
      });
    })(body, {});
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  async function paraMd(body, o) {
    const TD = await CV.lib('turndown');
    const td = new TD({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*' });
    td.keep(['u']);
    td.addRule('strike', { filter: ['del', 's', 'strike'], replacement: c => '~~' + c + '~~' });
    td.addRule('img', { filter: 'img', replacement: (c, n) => o.imagens === 'nao' ? '' : '![' + (n.getAttribute('alt') || '') + '](' + (n.getAttribute('src') || '') + ')' });
    td.addRule('table', { filter: 'table', replacement: (c, node) => {
      const rows = [...node.rows].map(r => [...r.cells].map(x => x.textContent.trim().replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')));
      if (!rows.length) return '';
      const w = Math.max(...rows.map(r => r.length)); rows.forEach(r => { while (r.length < w) r.push(''); });
      const l = r => '| ' + r.join(' | ') + ' |';
      return '\n\n' + l(rows[0]) + '\n' + l(rows[0].map(() => '---')) + '\n' + rows.slice(1).map(l).join('\n') + '\n\n';
    } });
    return td.turndown(body.innerHTML).trim() + '\n';
  }
  const CSS_HTML = 'body{font-family:Georgia,"Times New Roman",serif;line-height:1.6;max-width:46em;margin:2em auto;padding:0 1em;color:#222}h1,h2,h3,h4{font-family:system-ui,sans-serif;line-height:1.25}img{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:.3em .6em}pre,code{background:#f3f3f3;font-family:Consolas,monospace}pre{padding:.8em;overflow:auto}blockquote{border-left:4px solid #bbb;margin-left:0;padding-left:1em;color:#555}';
  const paraHtml = (body, titulo) => '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + esc(titulo) + '</title>\n<style>' + CSS_HTML + '</style>\n</head>\n<body>\n' + body.innerHTML + '\n</body>\n</html>\n';

  /* DOCX */
  async function carregarImagens(body) {
    const m = new Map();
    for (const im of [...body.querySelectorAll('img')]) {
      const s = im.getAttribute('src') || '', r = /^data:image\/(png|jpe?g|gif|bmp|webp);base64,(.+)$/i.exec(s);
      if (!r || m.has(s)) continue;
      let tipo = r[1].toLowerCase().replace('jpeg', 'jpg'), b64 = r[2], uri = s;
      const dim = await new Promise(ok => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight, i]); i.onerror = () => ok(null); i.src = uri; });
      if (!dim) continue;
      if (tipo === 'webp') { const c = document.createElement('canvas'); c.width = dim[0]; c.height = dim[1]; c.getContext('2d').drawImage(dim[2], 0, 0); b64 = c.toDataURL('image/png').split(',')[1]; tipo = 'png'; }
      const bin = atob(b64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      m.set(s, { data: arr, tipo, w: dim[0], h: dim[1], b64 });
    }
    return m;
  }
  async function paraDocx(body, titulo, o) {
    const D = await CV.lib('docx'), imgs = await carregarImagens(body);
    let ol = 0; const niveis = [];
    const lista = ordem => ({ reference: 'ol' + ordem, levels: [0, 1, 2, 3, 4, 5].map(i => ({ level: i, format: D.LevelFormat.DECIMAL, text: '%' + (i + 1) + '.', alignment: D.AlignmentType.START, style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } } })) });
    const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); return m ? m[1] : null; };
    const inl = (n, st, out) => {
      if (n.nodeType === 3) { const t = n.nodeValue.replace(/[\r\n\t ]+/g, ' '); if (t) out.push(new D.TextRun(Object.assign({ text: t }, st))); return; }
      if (n.nodeType !== 1) return;
      const t = n.tagName; let s = st;
      if (t === 'BR') { out.push(new D.TextRun({ break: 1 })); return; }
      if (t === 'IMG') { const im = imgs.get(n.getAttribute('src') || ''); if (im) { const k = Math.min(1, 600 / im.w); out.push(new D.ImageRun({ data: im.data, type: im.tipo, transformation: { width: Math.max(1, Math.round(im.w * k)), height: Math.max(1, Math.round(im.h * k)) } })); } return; }
      if (t === 'B' || t === 'STRONG') s = Object.assign({}, st, { bold: true });
      else if (t === 'I' || t === 'EM' || t === 'CITE') s = Object.assign({}, st, { italics: true });
      else if (t === 'U' || t === 'INS') s = Object.assign({}, st, { underline: {} });
      else if (t === 'S' || t === 'DEL' || t === 'STRIKE') s = Object.assign({}, st, { strike: true });
      else if (t === 'SUP') s = Object.assign({}, st, { superScript: true }); else if (t === 'SUB') s = Object.assign({}, st, { subScript: true });
      else if (t === 'CODE' || t === 'KBD' || t === 'SAMP') s = Object.assign({}, st, { font: 'Consolas' });
      if (t === 'A') {
        const kids = [], ls = Object.assign({}, st, { color: '1F4FBF', underline: {} }); n.childNodes.forEach(c => inl(c, ls, kids));
        const href = n.getAttribute('href') || '';
        if (/^(https?:|mailto:)/i.test(href) && kids.length) out.push(new D.ExternalHyperlink({ children: kids, link: href })); else out.push(...kids);
        return;
      }
      n.childNodes.forEach(c => inl(c, s, out));
    };
    const para = (el, op, st) => { const kids = []; el.childNodes.forEach(c => inl(c, st || {}, kids)); return new D.Paragraph(Object.assign({ children: kids }, op || {})); };
    const tem = el => [...el.children].some(c => BLOCOS.has(c.tagName));
    const lst = (el, ordenada, nivel, inst) => {
      const out = [];
      [...el.children].forEach(li => {
        if (li.tagName !== 'LI') return;
        const kids = [], aninhadas = [];
        li.childNodes.forEach(c => { if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) aninhadas.push(c); else if (c.nodeType === 1 && (c.tagName === 'P' || c.tagName === 'DIV')) c.childNodes.forEach(x => inl(x, {}, kids)); else inl(c, {}, kids); });
        const lv = Math.min(nivel, 5);
        out.push(new D.Paragraph(Object.assign({ children: kids }, ordenada ? { numbering: { reference: 'ol' + inst, level: lv } } : { bullet: { level: lv } })));
        aninhadas.forEach(a => { const o2 = a.tagName === 'OL'; out.push(...lst(a, o2, nivel + 1, o2 ? inst : 0)); });
      });
      return out;
    };
    const tabela = el => {
      const trs = [...el.querySelectorAll('tr')]; if (!trs.length) return null;
      const n = Math.max(...trs.map(r => [...r.children].filter(c => /^T[DH]$/.test(c.tagName)).length)) || 1, cw = Math.floor(9360 / n);
      const brd = { style: D.BorderStyle.SINGLE, size: 4, color: 'A0A4B8' };
      return new D.Table({ columnWidths: Array(n).fill(cw), width: { size: cw * n, type: D.WidthType.DXA }, rows: trs.map(tr => new D.TableRow({ children: [...tr.children].filter(c => /^T[DH]$/.test(c.tagName)).map(c => { const th = c.tagName === 'TH'; let k = blocos(c, th ? { bold: true } : {}); if (!k.length) k = [new D.Paragraph('')]; return new D.TableCell({ children: k, width: { size: cw, type: D.WidthType.DXA }, borders: { top: brd, bottom: brd, left: brd, right: brd }, shading: th ? { type: D.ShadingType.CLEAR, fill: 'ECEFFB', color: 'auto' } : undefined }); }) })) });
    };
    const blocos = (pai, st) => {
      const res = []; let buf = [];
      const fl = () => { if (buf.length) { res.push(new D.Paragraph({ children: buf })); buf = []; } };
      pai.childNodes.forEach(ch => {
        if (ch.nodeType === 3) { if (ch.nodeValue.trim()) inl(ch, st, buf); return; }
        if (ch.nodeType !== 1) return;
        const t = ch.tagName;
        if (!BLOCOS.has(t)) { inl(ch, st, buf); return; }
        fl();
        if (/^H[1-6]$/.test(t)) res.push(para(ch, { heading: D.HeadingLevel['HEADING_' + t[1]] }, st));
        else if (t === 'P' || t === 'DIV' || t === 'LI' || t === 'FIGCAPTION' || t === 'DT' || t === 'DD') { if (tem(ch)) res.push(...blocos(ch, st)); else res.push(para(ch, null, st)); }
        else if (t === 'UL' || t === 'OL') res.push(...lst(ch, t === 'OL', 0, t === 'OL' ? (niveis.push(++ol), ol) : 0));
        else if (t === 'BLOCKQUOTE') res.push(...blocos(ch, Object.assign({}, st, { italics: true })).map(x => x));
        else if (t === 'PRE') ch.textContent.replace(/\n$/, '').split('\n').forEach(l => res.push(new D.Paragraph({ children: [new D.TextRun({ text: l || ' ', font: 'Consolas', size: 20 })], shading: { type: D.ShadingType.CLEAR, fill: 'EEF0F8', color: 'auto' } })));
        else if (t === 'HR') res.push(new D.Paragraph({ border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: '9AA0BB', space: 1 } } }));
        else if (t === 'TABLE') { const tb = tabela(ch); if (tb) { res.push(tb); res.push(new D.Paragraph('')); } }
        else res.push(...blocos(ch, st));
      });
      fl(); return res;
    };
    const filhos = blocos(body, {}); if (!filhos.length) filhos.push(new D.Paragraph(''));
    const hs = (id, nome, tam) => ({ id, name: nome, basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Calibri', size: tam, bold: true, color: '1D2033' }, paragraph: { spacing: { before: 320, after: 120 } } });
    const A4 = o.papel === 'letter' ? { width: 12240, height: 15840 } : { width: 11906, height: 16838 };
    const doc = new D.Document({
      creator: 'Nebulosa Workspace · Utilidades', title: titulo,
      styles: { default: { document: { run: { font: 'Calibri', size: 22 }, paragraph: { spacing: { after: 140, line: 300 } } } }, paragraphStyles: [hs('Heading1', 'Heading 1', 40), hs('Heading2', 'Heading 2', 32), hs('Heading3', 'Heading 3', 26), hs('Heading4', 'Heading 4', 24)] },
      numbering: { config: niveis.map(i => lista(i)).length ? niveis.map(i => lista(i)) : [lista(1)] },
      sections: [{ properties: { page: { size: A4, margin: { top: 1417, right: 1417, bottom: 1417, left: 1417 } } }, children: filhos }]
    });
    return D.Packer.toBlob(doc);
  }

  /* ODT */
  async function paraOdt(body, titulo) {
    const Z = await UT.jszip(), z = new Z(), imgs = await carregarImagens(body), figuras = [];
    const estilos = new Map(); // chave -> nome
    const estilo = s => { const k = [s.b ? 'b' : '', s.i ? 'i' : '', s.u ? 'u' : '', s.s ? 's' : '', s.m ? 'm' : '', s.sup ? 'p' : '', s.sub ? 'q' : ''].join(''); if (!k) return ''; if (!estilos.has(k)) estilos.set(k, 'T' + (estilos.size + 1)); return estilos.get(k); };
    const xesc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    const texto = s => xesc(s).replace(/ {2,}/g, m => ' <text:s text:c="' + (m.length - 1) + '"/>').replace(/\t/g, '<text:tab/>');
    const inl = (n, st) => {
      if (n.nodeType === 3) { const t = n.nodeValue.replace(/[\r\n\t ]+/g, ' '); if (!t) return ''; const e = estilo(st), x = texto(t); return e ? '<text:span text:style-name="' + e + '">' + x + '</text:span>' : x; }
      if (n.nodeType !== 1) return '';
      const t = n.tagName; let s = st;
      if (t === 'BR') return '<text:line-break/>';
      if (t === 'IMG') {
        const im = imgs.get(n.getAttribute('src') || ''); if (!im) return '';
        const k = Math.min(1, 600 / im.w), w = im.w * k / 96 * 2.54, h = im.h * k / 96 * 2.54, nome = 'Pictures/img' + (figuras.length + 1) + '.' + im.tipo;
        figuras.push([nome, im]);
        return '<draw:frame draw:name="Imagem' + figuras.length + '" text:anchor-type="as-char" svg:width="' + w.toFixed(3) + 'cm" svg:height="' + h.toFixed(3) + 'cm"><draw:image xlink:href="' + nome + '" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>';
      }
      if (t === 'B' || t === 'STRONG') s = Object.assign({}, st, { b: 1 }); else if (t === 'I' || t === 'EM' || t === 'CITE') s = Object.assign({}, st, { i: 1 });
      else if (t === 'U' || t === 'INS') s = Object.assign({}, st, { u: 1 }); else if (t === 'S' || t === 'DEL' || t === 'STRIKE') s = Object.assign({}, st, { s: 1 });
      else if (t === 'CODE' || t === 'KBD' || t === 'SAMP') s = Object.assign({}, st, { m: 1 }); else if (t === 'SUP') s = Object.assign({}, st, { sup: 1 }); else if (t === 'SUB') s = Object.assign({}, st, { sub: 1 });
      const dentro = [...n.childNodes].map(c => inl(c, s)).join('');
      if (t === 'A' && /^(https?:|mailto:)/i.test(n.getAttribute('href') || '')) return '<text:a xlink:type="simple" xlink:href="' + xesc(n.getAttribute('href')) + '">' + dentro + '</text:a>';
      return dentro;
    };
    const tem = el => [...el.children].some(c => BLOCOS.has(c.tagName));
    const par = (el, est, st) => '<text:p text:style-name="' + est + '">' + [...el.childNodes].map(c => inl(c, st || {})).join('') + '</text:p>';
    const lst = (el, ord) => '<text:list text:style-name="' + (ord ? 'LNum' : 'LBul') + '">' + [...el.children].filter(li => li.tagName === 'LI').map(li => {
      let h = '', buf = '';
      const fl = () => { if (buf.trim()) h += '<text:p text:style-name="Standard">' + buf + '</text:p>'; buf = ''; };
      li.childNodes.forEach(c => { if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) { fl(); h += lst(c, c.tagName === 'OL'); } else if (c.nodeType === 1 && (c.tagName === 'P' || c.tagName === 'DIV')) buf += [...c.childNodes].map(x => inl(x, {})).join(''); else buf += inl(c, {}); });
      fl(); return '<text:list-item>' + (h || '<text:p text:style-name="Standard"/>') + '</text:list-item>';
    }).join('') + '</text:list>';
    const blocos = (pai, st) => {
      let o = '', buf = '';
      const fl = () => { if (buf.trim()) o += '<text:p text:style-name="Standard">' + buf + '</text:p>'; buf = ''; };
      pai.childNodes.forEach(ch => {
        if (ch.nodeType === 3) { buf += inl(ch, st); return; }
        if (ch.nodeType !== 1) return;
        const t = ch.tagName;
        if (!BLOCOS.has(t)) { buf += inl(ch, st); return; }
        fl();
        if (/^H[1-6]$/.test(t)) o += '<text:h text:style-name="Heading_20_' + t[1] + '" text:outline-level="' + t[1] + '">' + [...ch.childNodes].map(c => inl(c, st)).join('') + '</text:h>';
        else if (t === 'P' || t === 'DIV' || t === 'LI' || t === 'FIGCAPTION' || t === 'DT' || t === 'DD') { if (tem(ch)) o += blocos(ch, st); else o += par(ch, 'Standard', st); }
        else if (t === 'UL' || t === 'OL') o += lst(ch, t === 'OL');
        else if (t === 'BLOCKQUOTE') o += tem(ch) ? blocos(ch, Object.assign({}, st, { i: 1 })) : par(ch, 'Quote', st);
        else if (t === 'PRE') o += ch.textContent.replace(/\n$/, '').split('\n').map(l => '<text:p text:style-name="Preformatted_20_Text">' + texto(l) + '</text:p>').join('');
        else if (t === 'HR') o += '<text:p text:style-name="Horizontal_20_Line"/>';
        else if (t === 'TABLE') {
          const trs = [...ch.querySelectorAll('tr')], n = Math.max(1, ...trs.map(r => [...r.children].filter(c => /^T[DH]$/.test(c.tagName)).length));
          o += '<table:table table:name="Tabela' + (Math.random() * 1e6 | 0) + '" table:style-name="Tabela">' + '<table:table-column table:number-columns-repeated="' + n + '"/>' + trs.map(r => '<table:table-row>' + [...r.children].filter(c => /^T[DH]$/.test(c.tagName)).map(c => '<table:table-cell table:style-name="Celula" office:value-type="string">' + (blocos(c, c.tagName === 'TH' ? { b: 1 } : {}) || '<text:p text:style-name="Standard"/>') + '</table:table-cell>').join('') + '</table:table-row>').join('') + '</table:table>';
        } else o += blocos(ch, st);
      });
      fl(); return o;
    };
    const corpo = blocos(body, {});
    const auto = [...estilos].map(([k, nome]) => '<style:style style:name="' + nome + '" style:family="text"><style:text-properties' + (k.includes('b') ? ' fo:font-weight="bold"' : '') + (k.includes('i') ? ' fo:font-style="italic"' : '') + (k.includes('u') ? ' style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"' : '') + (k.includes('s') ? ' style:text-line-through-style="solid"' : '') + (k.includes('m') ? ' style:font-name="Consolas" fo:font-family="Consolas"' : '') + (k.includes('p') ? ' style:text-position="super 58%"' : '') + (k.includes('q') ? ' style:text-position="sub 58%"' : '') + '/></style:style>').join('');
    const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"';
    const head = n => { const t = 'Heading_20_' + n, tam = [0, 20, 16, 14, 13, 12, 11][n]; return '<style:style style:name="' + t + '" style:display-name="Heading ' + n + '" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:default-outline-level="' + n + '"><style:paragraph-properties fo:margin-top="0.42cm" fo:margin-bottom="0.21cm" fo:keep-with-next="always"/><style:text-properties fo:font-size="' + tam + 'pt" fo:font-weight="bold"/></style:style>'; };
    const estilosXml = '<?xml version="1.0" encoding="UTF-8"?><office:document-styles ' + NS + ' office:version="1.2"><office:styles><style:default-style style:family="paragraph"><style:text-properties style:font-name="Calibri" fo:font-size="11pt" fo:language="pt" fo:country="BR"/></style:default-style><style:style style:name="Standard" style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.25cm" fo:line-height="120%"/></style:style>' + [1, 2, 3, 4, 5, 6].map(head).join('') + '<style:style style:name="Quote" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-left="1cm" fo:border-left="0.06cm solid #9aa0bb" fo:padding-left="0.3cm"/><style:text-properties fo:font-style="italic"/></style:style><style:style style:name="Preformatted_20_Text" style:display-name="Preformatted Text" style:family="paragraph"><style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0cm" fo:background-color="#eef0f8"/><style:text-properties style:font-name="Consolas" fo:font-family="Consolas" fo:font-size="10pt"/></style:style><style:style style:name="Horizontal_20_Line" style:family="paragraph"><style:paragraph-properties fo:border-bottom="0.03cm solid #9aa0bb"/></style:style>' + [[ 'LBul', 'b' ], [ 'LNum', 'n' ]].map(([nome, tp]) => '<text:list-style style:name="' + nome + '">' + [1,2,3,4,5,6].map(l => (tp === 'b' ? '<text:list-level-style-bullet text:level="' + l + '" text:bullet-char="' + (l % 2 ? '•' : '◦') + '">' : '<text:list-level-style-number text:level="' + l + '" style:num-suffix="." style:num-format="1">') + '<style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="' + (l * 1) + 'cm" fo:text-indent="-0.6cm" fo:margin-left="' + (l * 1) + 'cm"/></style:list-level-properties>' + (tp === 'b' ? '</text:list-level-style-bullet>' : '</text:list-level-style-number>')).join('') + '</text:list-style>').join('') + '</office:styles></office:document-styles>';
    const conteudo = '<?xml version="1.0" encoding="UTF-8"?><office:document-content ' + NS + ' office:version="1.2"><office:automatic-styles>' + auto + '<style:style style:name="Tabela" style:family="table"><style:table-properties style:width="17cm" table:align="margins"/></style:style><style:style style:name="Celula" style:family="table-cell"><style:table-cell-properties fo:padding="0.1cm" fo:border="0.5pt solid #a0a4b8"/></style:style></office:automatic-styles><office:body><office:text>' + (corpo || '<text:p text:style-name="Standard"/>') + '</office:text></office:body></office:document-content>';
    z.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
    z.file('META-INF/manifest.xml', '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>' + figuras.map(([n, im]) => '<manifest:file-entry manifest:full-path="' + n + '" manifest:media-type="image/' + (im.tipo === 'jpg' ? 'jpeg' : im.tipo) + '"/>').join('') + '</manifest:manifest>');
    z.file('content.xml', conteudo); z.file('styles.xml', estilosXml);
    z.file('meta.xml', '<?xml version="1.0" encoding="UTF-8"?><office:document-meta ' + NS + ' office:version="1.2"><office:meta><dc:title>' + xesc(titulo) + '</dc:title><meta:generator>Nebulosa Workspace · Utilidades</meta:generator></office:meta></office:document-meta>');
    figuras.forEach(([n, im]) => z.file(n, im.data));
    return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.text', compression: 'DEFLATE' });
  }

  /* RTF */
  async function paraRtf(body) {
    const imgs = await carregarImagens(body);
    const u = s => { let o = ''; for (const ch of s) { const c = ch.codePointAt(0); if (ch === '\\') o += '\\\\'; else if (ch === '{') o += '\\{'; else if (ch === '}') o += '\\}'; else if (ch === '\t') o += '\\tab '; else if (ch === '\n') o += '\\line '; else if (c < 128) o += ch; else if (c < 65536) o += '\\u' + (c > 32767 ? c - 65536 : c) + '?'; else { const x = c - 65536, h = 0xD800 + (x >> 10), l = 0xDC00 + (x & 1023); o += '\\u' + (h - 65536) + '?\\u' + (l - 65536) + '?'; } } return o; };
    const inl = (n, st) => {
      if (n.nodeType === 3) { const t = n.nodeValue.replace(/[\r\n\t ]+/g, ' '); if (!t) return ''; return (st.b ? '\\b ' : '') + (st.i ? '\\i ' : '') + (st.u ? '\\ul ' : '') + (st.s ? '\\strike ' : '') + (st.m ? '\\f1 ' : '') + u(t) + (st.m ? '\\f0 ' : '') + (st.s ? '\\strike0 ' : '') + (st.u ? '\\ulnone ' : '') + (st.i ? '\\i0 ' : '') + (st.b ? '\\b0 ' : ''); }
      if (n.nodeType !== 1) return '';
      const t = n.tagName; let s = st;
      if (t === 'BR') return '\\line ';
      if (t === 'IMG') { const im = imgs.get(n.getAttribute('src') || ''); if (!im || (im.tipo !== 'png' && im.tipo !== 'jpg')) return ''; const k = Math.min(1, 560 / im.w); let hex = ''; for (let i = 0; i < im.data.length; i++) hex += (im.data[i] < 16 ? '0' : '') + im.data[i].toString(16); return '{\\pict\\' + (im.tipo === 'png' ? 'pngblip' : 'jpegblip') + '\\picw' + im.w + '\\pich' + im.h + '\\picwgoal' + Math.round(im.w * k * 15) + '\\pichgoal' + Math.round(im.h * k * 15) + ' ' + hex + '}'; }
      if (t === 'B' || t === 'STRONG') s = Object.assign({}, st, { b: 1 }); else if (t === 'I' || t === 'EM' || t === 'CITE') s = Object.assign({}, st, { i: 1 });
      else if (t === 'U' || t === 'INS') s = Object.assign({}, st, { u: 1 }); else if (t === 'S' || t === 'DEL' || t === 'STRIKE') s = Object.assign({}, st, { s: 1 }); else if (t === 'CODE' || t === 'KBD' || t === 'SAMP') s = Object.assign({}, st, { m: 1 });
      return [...n.childNodes].map(c => inl(c, s)).join('');
    };
    const tem = el => [...el.children].some(c => BLOCOS.has(c.tagName));
    const blocos = (pai, st, nivel) => {
      let o = '', buf = '';
      const fl = () => { if (buf.trim()) o += '{\\pard\\sa160 ' + buf + '\\par}\n'; buf = ''; };
      pai.childNodes.forEach(ch => {
        if (ch.nodeType === 3) { buf += inl(ch, st); return; }
        if (ch.nodeType !== 1) return;
        const t = ch.tagName;
        if (!BLOCOS.has(t)) { buf += inl(ch, st); return; }
        fl();
        if (/^H[1-6]$/.test(t)) { const tam = [0, 40, 32, 28, 26, 24, 22][+t[1]]; o += '{\\pard\\sb240\\sa120\\keepn\\b\\fs' + tam + ' ' + [...ch.childNodes].map(c => inl(c, st)).join('') + '\\par}\n'; }
        else if (t === 'P' || t === 'DIV' || t === 'LI' || t === 'FIGCAPTION' || t === 'DT' || t === 'DD') { if (tem(ch)) o += blocos(ch, st, nivel); else o += '{\\pard\\sa160 ' + [...ch.childNodes].map(c => inl(c, st)).join('') + '\\par}\n'; }
        else if (t === 'UL' || t === 'OL') { let k = 0; [...ch.children].forEach(li => { k++; let txt = ''; let sub = ''; li.childNodes.forEach(c => { if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) sub += blocos({ childNodes: [c] }, st, (nivel || 0) + 1); else txt += inl(c, st); }); o += '{\\pard\\li' + (360 * ((nivel || 0) + 1)) + '\\fi-300\\sa60 ' + (t === 'OL' ? k + '.\\tab ' : '\\bullet\\tab ') + txt + '\\par}\n' + sub; }); }
        else if (t === 'BLOCKQUOTE') o += '{\\pard\\li720\\sa160\\i ' + ch.textContent.replace(/\s+/g, ' ').trim().replace(/./gs, c => u(c)) + '\\par}\n';
        else if (t === 'PRE') ch.textContent.replace(/\n$/, '').split('\n').forEach(l => { o += '{\\pard\\f1\\fs20 ' + u(l) + '\\par}\n'; });
        else if (t === 'HR') o += '{\\pard\\brdrb\\brdrs\\brdrw10\\brsp1 \\par}\n';
        else if (t === 'TABLE') { [...ch.querySelectorAll('tr')].forEach(r => { const cs = [...r.children].filter(c => /^T[DH]$/.test(c.tagName)), w = Math.floor(9000 / (cs.length || 1)); o += '\\trowd\\trgaph108' + cs.map((c, i) => '\\clbrdrt\\brdrs\\clbrdrl\\brdrs\\clbrdrb\\brdrs\\clbrdrr\\brdrs\\cellx' + (w * (i + 1))).join('') + '\n' + cs.map(c => '\\pard\\intbl ' + inl(c, c.tagName === 'TH' ? { b: 1 } : {}) + '\\cell').join('') + '\\row\n'; }); o += '\\pard\\par\n'; }
        else o += blocos(ch, st, nivel);
      });
      fl(); return o;
    };
    return '{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss Calibri;}{\\f1\\fmodern Consolas;}}\\viewkind4\\uc1\\pard\\f0\\fs22\n' + blocos(body, {}, 0) + '}';
  }

  /* EPUB */
  async function paraEpub(body, titulo, o) {
    const Z = await UT.jszip(), z = new Z(), uid = 'urn:uuid:' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));
    const imgs = []; let nImg = 0;
    body.querySelectorAll('img').forEach(im => {
      const r = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/i.exec(im.getAttribute('src') || '');
      if (!r) { im.remove(); return; }
      const ext = r[1].toLowerCase().replace('jpeg', 'jpg'), nome = 'images/img' + (++nImg) + '.' + ext;
      imgs.push([nome, r[2], ext]); im.setAttribute('src', nome); if (!im.hasAttribute('alt')) im.setAttribute('alt', '');
    });
    // capítulos: cada <h1> abre um capítulo (sem <h1>, cada <h2>)
    const nivel = body.querySelector('h1') ? 'H1' : (body.querySelector('h2') ? 'H2' : null);
    const caps = []; let atual = { titulo, nos: [] };
    [...body.childNodes].forEach(n => { if (nivel && n.nodeType === 1 && n.tagName === nivel && (atual.nos.length || caps.length)) { caps.push(atual); atual = { titulo: n.textContent.trim() || titulo, nos: [] }; } else if (nivel && n.nodeType === 1 && n.tagName === nivel) atual.titulo = n.textContent.trim() || titulo; atual.nos.push(n); });
    caps.push(atual);
    const ser = new XMLSerializer(), xesc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const xhtml = (tit, nos) => {
      const tmp = document.implementation.createHTMLDocument(''); const div = tmp.createElement('div'); nos.forEach(n => div.appendChild(tmp.importNode(n, true)));
      let h = ser.serializeToString(div).replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '').replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
      h = h.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
      return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt-BR"><head><meta charset="utf-8"/><title>' + xesc(tit) + '</title><link rel="stylesheet" type="text/css" href="estilo.css"/></head><body>' + h + '</body></html>';
    };
    z.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    z.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    z.file('OEBPS/estilo.css', 'body{font-family:serif;line-height:1.5}h1,h2,h3{font-family:sans-serif}img{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #999;padding:.2em .5em}pre{white-space:pre-wrap}blockquote{margin-left:1em;color:#444}');
    caps.forEach((c, i) => z.file('OEBPS/cap' + (i + 1) + '.xhtml', xhtml(c.titulo, c.nos)));
    imgs.forEach(([n, b64]) => z.file('OEBPS/' + n, b64, { base64: true }));
    const tipoImg = e => 'image/' + (e === 'jpg' ? 'jpeg' : e);
    z.file('OEBPS/nav.xhtml', '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><meta charset="utf-8"/><title>' + xesc(titulo) + '</title></head><body><nav epub:type="toc" id="toc"><ol>' + caps.map((c, i) => '<li><a href="cap' + (i + 1) + '.xhtml">' + xesc(c.titulo) + '</a></li>').join('') + '</ol></nav></body></html>');
    z.file('OEBPS/toc.ncx', '<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="' + uid + '"/></head><docTitle><text>' + xesc(titulo) + '</text></docTitle><navMap>' + caps.map((c, i) => '<navPoint id="n' + (i + 1) + '" playOrder="' + (i + 1) + '"><navLabel><text>' + xesc(c.titulo) + '</text></navLabel><content src="cap' + (i + 1) + '.xhtml"/></navPoint>').join('') + '</navMap></ncx>');
    z.file('OEBPS/content.opf', '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">' + uid + '</dc:identifier><dc:title>' + xesc(titulo) + '</dc:title><dc:language>' + (o.idioma || 'pt-BR') + '</dc:language><meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="estilo.css" media-type="text/css"/>' + caps.map((c, i) => '<item id="c' + (i + 1) + '" href="cap' + (i + 1) + '.xhtml" media-type="application/xhtml+xml"/>').join('') + imgs.map(([n, , e], i) => '<item id="i' + (i + 1) + '" href="' + n + '" media-type="' + tipoImg(e) + '"/>').join('') + '</manifest><spine toc="ncx">' + caps.map((c, i) => '<itemref idref="c' + (i + 1) + '"/>').join('') + '</spine></package>');
    return z.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
  }

  /* ---------- registro ---------- */
  async function htmlParaPdf(html, op, ctx) { return CV.pdfDoc.gerar(html, op, ctx); }
  CV.motor({
    id: 'documento',
    rotas(de) { return ENTRADAS.includes(de) ? SAIDAS : []; },
    opcoes(de, para) {
      const o = [];
      if (para === 'pdf') o.push(
        { id: 'papel', tipo: 'lista', rot: 'Papel', pad: 'a4', opcoes: [['a4', 'A4'], ['letter', 'Carta (Letter)']] },
        { id: 'fonte', tipo: 'lista', rot: 'Letra', pad: 'serif', opcoes: [['serif', 'Com serifa (Noto Serif)'], ['sans', 'Sem serifa (Noto Sans)']] },
        { id: 'tamanho', tipo: 'numero', rot: 'Tamanho da letra (pt)', pad: 11, min: 7, max: 24 },
        { id: 'margem', tipo: 'numero', rot: 'Margem (mm)', pad: 20, min: 5, max: 50 },
        { id: 'numerar', tipo: 'caixa', rot: 'Numerar as páginas', pad: true });
      if (para === 'docx') o.push({ id: 'papel', tipo: 'lista', rot: 'Papel', pad: 'a4', opcoes: [['a4', 'A4'], ['letter', 'Carta (Letter)']] });
      if (para === 'md') o.push({ id: 'imagens', tipo: 'lista', rot: 'Imagens', pad: 'sim', opcoes: [['sim', 'Incluir no arquivo'], ['nao', 'Deixar de fora']] });
      if (de === 'pdf' && para !== 'pdf') o.push({ id: 'imagens', tipo: 'lista', rot: 'Páginas só de imagem (digitalizadas)', pad: 'sim', opcoes: [['sim', 'Incluir como figuras'], ['nao', 'Deixar de fora']] });
      return o;
    },
    async converter(ctx) {
      const { arquivo: f, de, para, opcoes: o, nomeBase } = ctx;
      ctx.progresso(0.05, T('Lendo o documento…'));
      let r;
      try { r = await lerDocumento(f, de, ctx, o); } catch (e) { if (e.cancelado || e.message) throw e; throw new Error(T('Não foi possível ler este documento.')); }
      CV.checar(ctx);
      const doc = paraDom(r.html), body = doc.body, titulo = (r.titulo && r.titulo.trim()) || nomeBase;
      ctx.progresso(0.85, T('Gravando…'));
      let blob;
      if (para === 'html') blob = new Blob([paraHtml(body, titulo)], { type: 'text/html' });
      else if (para === 'txt') blob = new Blob([paraTxt(body)], { type: 'text/plain' });
      else if (para === 'md') blob = new Blob([await paraMd(body, o)], { type: 'text/markdown' });
      else if (para === 'docx') blob = await paraDocx(body, titulo, o);
      else if (para === 'odt') blob = await paraOdt(body, titulo);
      else if (para === 'rtf') blob = new Blob([await paraRtf(body)], { type: 'application/rtf' });
      else if (para === 'epub') blob = await paraEpub(body, titulo, o);
      else if (para === 'pdf') blob = await htmlParaPdf(r.html, Object.assign({}, o, { titulo }), ctx);
      return [{ blob, nome: CV.nomeSaida(nomeBase, para) }];
    }
  });
  CV.documento = { lerDocumento, htmlParaPdf, limpar, paraDom, paraTxt };
})();
