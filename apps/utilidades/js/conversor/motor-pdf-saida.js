/* ==========================================================================
   Utilidades — Conversor: gerador de PDF a partir de HTML (1.0)
   Monta o PDF com pdf-lib, com letras Noto/DejaVu incorporadas (acentos, gregos, cirílico etc.).
   Se as fontes não puderem ser lidas, usa as fontes padrão do PDF (só caracteres latinos).
   Faz: títulos, parágrafos com quebra de linha, negrito/itálico/sublinhado/tachado, links, listas, citações,
   código, linhas, tabelas (com quebra entre páginas), imagens, numeração de páginas.
   Não faz: colunas, caixas flutuantes, estilos CSS (cores, alinhamento, fontes do documento original).
   ========================================================================== */
(function () {
  'use strict';
  const { T } = UT, CV = UT.CV;
  const ARQ = {
    serif: { r: 'NotoSerif_400Regular.ttf', b: 'NotoSerif_700Bold.ttf', i: 'NotoSerif_400Regular_Italic.ttf', bi: 'NotoSerif_700Bold_Italic.ttf', d: 'noto-serif' },
    sans: { r: 'NotoSans_400Regular.ttf', b: 'NotoSans_700Bold.ttf', i: 'NotoSans_400Regular_Italic.ttf', bi: 'NotoSans_700Bold_Italic.ttf', d: 'noto-sans' },
    mono: { r: 'DejaVuSansMono.ttf', b: 'DejaVuSansMono-Bold.ttf', i: 'DejaVuSansMono.ttf', bi: 'DejaVuSansMono-Bold.ttf', d: 'dejavu-mono' }
  };
  const cacheBytes = {};
  async function bytesFonte(fam, v) {
    const chave = ARQ[fam].d + '/' + ARQ[fam][v], rel = 'libs/fontes/' + chave.replace(/\.ttf$/, '.js');
    if (!cacheBytes[chave]) cacheBytes[chave] = (async () => {
      await UT.lib(rel);                                   // o arquivo .js guarda a fonte em base64 (funciona também fora de um servidor)
      const b64 = window.__nbFontes && window.__nbFontes[chave]; if (!b64) throw new Error('fonte ausente');
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      delete window.__nbFontes[chave];
      return u;
    })().catch(e => { delete cacheBytes[chave]; throw e; });
    return cacheBytes[chave];
  }
  const BLOCOS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE', 'HR', 'SECTION', 'ARTICLE', 'FIGURE', 'FIGCAPTION', 'HEADER', 'FOOTER', 'MAIN', 'DL', 'DT', 'DD']);

  /* Só incorpora as variações usadas (cada uma pesa ~0,3 a 0,6 MB: as fontes são incorporadas inteiras, sem "subconjunto",
     porque o subconjunto do pdf-lib com estas fontes perdia letras). */
  const FAM = { r: ['r'], b: ['b'], i: ['i'], bi: ['bi'], mr: ['mono', 'r'], mb: ['mono', 'b'] };
  async function carregarFontes(pdf, P, familia, chaves, F) {
    const conj = f => { try { return new Set(f.getCharacterSet()); } catch (e) { return null; } };
    const fam = ARQ[familia] ? familia : 'serif';
    if (!F) F = { padrao: false, mapa: {} };
    if (!F.padrao) {
      try {
        if (!window.fontkit) await UT.lib('libs/fontkit/fontkit.umd.min.js');
        if (!F.reg) { pdf.registerFontkit(window.fontkit); F.reg = true; }
        for (const k of chaves) {
          if (F.mapa[k]) continue;
          const [f, v] = FAM[k].length === 1 ? [fam, FAM[k][0]] : FAM[k];
          const ob = await pdf.embedFont(await bytesFonte(f, v), { subset: false });
          F.mapa[k] = { f: ob, set: conj(ob) };
        }
        return F;
      } catch (e) { F.padrao = true; F.mapa = {}; }
    }
    const S = P.StandardFonts, ser = fam !== 'sans';
    const nomes = { r: ser ? S.TimesRoman : S.Helvetica, b: ser ? S.TimesRomanBold : S.HelveticaBold, i: ser ? S.TimesRomanItalic : S.HelveticaOblique, bi: ser ? S.TimesRomanBoldItalic : S.HelveticaBoldOblique, mr: S.Courier, mb: S.CourierBold };
    for (const k of Object.keys(nomes)) if (!F.mapa[k]) F.mapa[k] = { f: await pdf.embedFont(nomes[k]), set: null };
    return F;
  }
  const LATIN = /^[ -~ -ÿŒœŠšŸŽžƒˆ˜–—‘-‚“-„†-•…‰‹›€™]$/;
  const temChar = (fo, ch) => fo.set ? fo.set.has(ch.codePointAt(0)) : LATIN.test(ch);

  async function gerar(html, op, ctx) {
    const P = await UT.pdflib(), o = op || {};
    const pdf = await P.PDFDocument.create();
    pdf.setProducer('Nebulosa Workspace · Utilidades'); pdf.setCreator('Nebulosa Workspace · Utilidades');
    try { pdf.setTitle(o.titulo || ''); } catch (e) { /* título opcional */ }
    const mm = v => v * 72 / 25.4;
    let [PW, PH] = o.papel === 'letter' ? [612, 792] : [595.28, 841.89];
    if (o.orientacao === 'paisagem') [PW, PH] = [PH, PW];
    const M = Math.max(14, mm(o.margem == null ? 20 : +o.margem)), TAM = Math.min(30, Math.max(6, +o.tamanho || 11));
    const topo = PH - M, rodape = M + (o.numerar === false ? 0 : 8), LARG = PW - 2 * M;
    const body = CV.documento.paraDom(html).body;

    /* ---- HTML -> blocos ---- */
    const runsDe = (n, st, runs) => {
      if (n.nodeType === 3) { const t = n.nodeValue.replace(/[\r\n\t ]+/g, ' '); if (t) runs.push(Object.assign({ t }, st)); return; }
      if (n.nodeType !== 1) return;
      const t = n.tagName; let s = st;
      if (t === 'BR') { runs.push({ br: 1 }); return; }
      if (t === 'IMG') { runs.push({ img: n.getAttribute('src') || '' }); return; }
      if (t === 'B' || t === 'STRONG') s = Object.assign({}, st, { b: 1 }); else if (t === 'I' || t === 'EM' || t === 'CITE') s = Object.assign({}, st, { i: 1 });
      else if (t === 'U' || t === 'INS') s = Object.assign({}, st, { u: 1 }); else if (t === 'S' || t === 'DEL' || t === 'STRIKE') s = Object.assign({}, st, { s: 1 });
      else if (t === 'CODE' || t === 'KBD' || t === 'SAMP') s = Object.assign({}, st, { m: 1 }); else if (t === 'SUP') s = Object.assign({}, st, { sup: 1 }); else if (t === 'SUB') s = Object.assign({}, st, { sub: 1 });
      else if (t === 'A' && /^(https?:|mailto:)/i.test(n.getAttribute('href') || '')) s = Object.assign({}, st, { link: n.getAttribute('href'), u: 1 });
      n.childNodes.forEach(c => runsDe(c, s, runs));
    };
    const temBloco = el => [...el.children].some(c => BLOCOS.has(c.tagName));
    const blocos = (pai, st, ind, out, cel) => {
      let runs = [];
      const fl = (extra) => {
        if (!runs.length) return;
        let seg = [];
        const fim = () => { if (seg.some(r => r.br || (r.t && r.t.trim()))) out.push(Object.assign({ tipo: 'p', runs: seg, ind }, extra || {})); seg = []; };
        runs.forEach(r => { if (r.img !== undefined) { fim(); if (!cel) out.push({ tipo: 'img', src: r.img, ind }); } else seg.push(r); });
        fim(); runs = [];
      };
      pai.childNodes.forEach(ch => {
        if (ch.nodeType === 3) { runsDe(ch, st, runs); return; }
        if (ch.nodeType !== 1) return;
        const t = ch.tagName;
        if (!BLOCOS.has(t)) { runsDe(ch, st, runs); return; }
        fl();
        if (/^H[1-6]$/.test(t)) { const r = []; runsDe(ch, Object.assign({}, st, { b: 1 }), r); const k = [0, 2, 1.6, 1.35, 1.2, 1.1, 1][+t[1]]; const tmp = []; const seg = r; if (seg.some(x => x.t && x.t.trim())) out.push({ tipo: 'p', runs: seg, ind, mult: k, antes: TAM * k * .9, depois: TAM * .45, manter: true }); }
        else if (t === 'P' || t === 'DIV' || t === 'LI' || t === 'FIGCAPTION' || t === 'DT' || t === 'DD' || t === 'SECTION' || t === 'ARTICLE' || t === 'FIGURE' || t === 'HEADER' || t === 'FOOTER' || t === 'MAIN' || t === 'DL') { if (temBloco(ch) || t === 'SECTION' || t === 'ARTICLE' || t === 'FIGURE' || t === 'DL' || t === 'MAIN') blocos(ch, st, ind, out, cel); else { const r = []; ch.childNodes.forEach(c => runsDe(c, st, r)); runs = r; fl(); } }
        else if (t === 'UL' || t === 'OL') {
          let k = 0;
          [...ch.children].forEach(li => {
            if (li.tagName !== 'LI') return; k++;
            const r = [], subs = [];
            li.childNodes.forEach(c => { if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) subs.push(c); else if (c.nodeType === 1 && (c.tagName === 'P' || c.tagName === 'DIV')) { if (r.length) r.push({ t: ' ' }); c.childNodes.forEach(x => runsDe(x, st, r)); } else runsDe(c, st, r); });
            out.push({ tipo: 'p', runs: r.filter(x => x.img === undefined), ind: ind + 1, pref: t === 'OL' ? k + '.' : '•', depois: TAM * .2 });
            subs.forEach(s => { const tmp = document.createElement('div'); tmp.appendChild(s.cloneNode(true)); blocos(tmp, st, ind + 1, out, cel); });
          });
          if (out.length) out[out.length - 1].depois = TAM * .6;
        }
        else if (t === 'BLOCKQUOTE') { const a = out.length; blocos(ch, Object.assign({}, st, { i: 1 }), ind + 1, out, cel); out.slice(a).forEach(b => { if (b.tipo === 'p' && b.citacao === undefined) b.citacao = 1; }); }
        else if (t === 'PRE') ch.textContent.replace(/\n$/, '').split('\n').forEach(l => out.push({ tipo: 'p', runs: [{ t: l || ' ', m: 1 }], ind, pre: 1, fundo: 1, depois: 0, mult: .9 }));
        else if (t === 'HR') out.push({ tipo: 'hr' });
        else if (t === 'TABLE') {
          const trs = [...ch.querySelectorAll('tr')].filter(r => r.closest('table') === ch);
          const linhas = trs.map(tr => [...tr.children].filter(c => /^T[DH]$/.test(c.tagName)).map(c => { const b = []; blocos(c, c.tagName === 'TH' ? Object.assign({}, st, { b: 1 }) : st, 0, b, true); return { blocos: b, th: c.tagName === 'TH', peso: Math.min(40, Math.max(4, c.textContent.trim().length)) }; })).filter(r => r.length);
          if (linhas.length) out.push({ tipo: 'tab', linhas, ind });
        }
        else blocos(ch, st, ind, out, cel);
      });
      fl();
      return out;
    };
    const lista = blocos(body, {}, 0, [], false);
    ctx && ctx.progresso(0.9, T('Montando o PDF…'));
    const todosRuns = [];
    (function juntar(bs) { bs.forEach(b => { if (b.tipo === 'p') todosRuns.push(...b.runs); else if (b.tipo === 'tab') b.linhas.forEach(r => r.forEach(c => juntar(c.blocos))); }); })(lista);
    const chaves = new Set(['r', 'b']);
    todosRuns.forEach(r => { if (r.t) chaves.add(r.m ? (r.b ? 'mb' : 'mr') : (r.b && r.i ? 'bi' : r.b ? 'b' : r.i ? 'i' : 'r')); });
    chaves.add('r');
    let F = await carregarFontes(pdf, P, o.fonte || 'serif', chaves);
    // caracteres que a letra principal não tem (símbolos, etc.) usam a letra mono como reserva
    if (!F.padrao && todosRuns.some(r => r.t && [...r.t].some(ch => ch.trim() && !temChar(F.mapa[r.m ? (r.b ? 'mb' : 'mr') : (r.b && r.i ? 'bi' : r.b ? 'b' : r.i ? 'i' : 'r')], ch)))) F = await carregarFontes(pdf, P, o.fonte || 'serif', ['mr', 'mb'], F);

    /* ---- texto -> linhas ---- */
    const escolher = (r, mono) => (mono ? (r.b ? 'mb' : 'mr') : (r.b && r.i ? 'bi' : r.b ? 'b' : r.i ? 'i' : 'r'));
    function pedacos(texto, r, tam) {
      const base = escolher(r, r.m), res = []; let cur = null;
      for (const chRaw of texto) {
        let ch = chRaw; if (/[   ]/.test(ch)) ch = ' '; if (/[​-‏⁠﻿­]/.test(ch) || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(ch)) continue;
        if (ch === '\t') ch = ' ';
        let k = base; if (!temChar(F.mapa[k], ch)) { const alt = r.b ? 'mb' : 'mr'; if (k[0] !== 'm' && F.mapa[alt] && temChar(F.mapa[alt], ch)) k = alt; else { ch = '?'; } }
        if (cur && cur.k === k) cur.t += ch; else { cur = { k, t: ch }; res.push(cur); }
      }
      return res;
    }
    function quebrar(runs, larg, tam, pre) {
      const linhas = []; let lin = { it: [], w: 0, h: 0 };
      const novaLinha = () => { linhas.push(lin); lin = { it: [], w: 0, h: 0 }; };
      const poe = (t, k, r, esp) => {
        const sz = (r.sup || r.sub) ? tam * .7 : tam, fo = F.mapa[k].f;
        let w = fo.widthOfTextAtSize(t, sz);
        if (lin.it.length === 0 && esp && !pre) return;
        if (!esp && lin.w + w > larg && lin.it.length) novaLinha();
        if (!esp && w > larg) { // palavra maior que a linha: quebra por letras
          let acc = '';
          for (const ch of t) { if (fo.widthOfTextAtSize(acc + ch, sz) > larg && acc) { lin.it.push({ t: acc, fo, sz, r, w: fo.widthOfTextAtSize(acc, sz), x: lin.w }); lin.w += fo.widthOfTextAtSize(acc, sz); lin.h = Math.max(lin.h, sz * 1.35); novaLinha(); acc = ''; } acc += ch; }
          t = acc; w = fo.widthOfTextAtSize(t, sz);
        }
        if (!t) return;
        lin.it.push({ t, fo, sz, r, w, x: lin.w, esp }); lin.w += w; lin.h = Math.max(lin.h, sz * 1.35);
      };
      runs.forEach(r => {
        if (r.br) { if (!lin.h) lin.h = tam * 1.35; novaLinha(); return; }
        const partes = r.t.split(/( +)/);
        partes.forEach(p => { if (!p) return; const esp = /^ +$/.test(p); pedacos(esp ? (pre ? p : ' ') : p, r, tam).forEach(pc => poe(pc.t, pc.k, r, esp)); });
      });
      if (lin.it.length || !linhas.length) { if (!lin.h) lin.h = tam * 1.35; linhas.push(lin); }
      linhas.forEach(l => { while (l.it.length && l.it[l.it.length - 1].esp && !pre) { const u = l.it.pop(); l.w -= u.w; } });
      return linhas;
    }

    /* ---- páginas ---- */
    let pag = null, y = 0, noTopo = true;
    const nova = () => { pag = pdf.addPage([PW, PH]); y = topo; noTopo = true; };
    nova();
    const COR = P.rgb(0.1, 0.1, 0.13), AZUL = P.rgb(0.12, 0.31, 0.75);
    const desenharLinha = (l, x0, yTopo) => {
      const base = yTopo - l.h * .78;
      l.it.forEach(it => {
        if (it.esp && !it.r.u && !it.r.s) return;
        const dy = it.r.sup ? it.sz * .5 : it.r.sub ? -it.sz * .2 : 0, x = x0 + it.x, yy = base + dy;
        if (!it.esp) pag.drawText(it.t, { x, y: yy, size: it.sz, font: it.fo, color: it.r.link ? AZUL : COR });
        if (it.r.u) pag.drawLine({ start: { x, y: yy - it.sz * .12 }, end: { x: x + it.w, y: yy - it.sz * .12 }, thickness: Math.max(.4, it.sz / 20), color: it.r.link ? AZUL : COR });
        if (it.r.s) pag.drawLine({ start: { x, y: yy + it.sz * .3 }, end: { x: x + it.w, y: yy + it.sz * .3 }, thickness: Math.max(.4, it.sz / 20), color: COR });
        if (it.r.link && !it.esp) { try { const a = pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [x, yy - it.sz * .25, x + it.w, yy + it.sz * .9], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: P.PDFString.of(it.r.link) } })); pag.node.addAnnot(a); } catch (e) { /* link opcional */ } }
      });
    };
    const IND = 18;
    const fluxoPar = b => {
      const tam = TAM * (b.mult || 1), x0 = M + b.ind * IND, larg = Math.max(40, LARG - b.ind * IND);
      const ls = quebrar(b.runs, larg, tam, b.pre);
      if (!noTopo && b.antes) y -= b.antes;
      const prim = ls[0] ? ls[0].h : tam * 1.35;
      if (b.manter && y - prim * 3 < rodape && !noTopo) nova();
      ls.forEach((l, i) => {
        if (y - l.h < rodape) { nova(); }
        if (b.fundo) pag.drawRectangle({ x: x0 - 3, y: y - l.h, width: larg + 6, height: l.h, color: P.rgb(.93, .94, .97) });
        if (b.citacao) pag.drawRectangle({ x: M + (b.ind - 1) * IND + 4, y: y - l.h, width: 2.2, height: l.h, color: P.rgb(.6, .63, .74) });
        if (i === 0 && b.pref) { const fo = F.mapa.r.f, pt = pedacos(b.pref, {}, tam).map(p => p.t).join(''); try { pag.drawText(pt, { x: x0 - fo.widthOfTextAtSize(pt, tam) - 5, y: y - l.h * .78, size: tam, font: fo, color: COR }); } catch (e) { /* marcador */ } }
        desenharLinha(l, x0, y); y -= l.h; noTopo = false;
      });
      y -= (b.depois == null ? TAM * .6 : b.depois);
    };
    const imgCache = new Map();
    async function imagem(src) {
      if (imgCache.has(src)) return imgCache.get(src);
      let r = null;
      try {
        const m = /^data:image\/(png|jpe?g|gif|webp|bmp);base64,(.+)$/i.exec(src);
        if (m) {
          const tipo = m[1].toLowerCase();
          if (tipo === 'png') r = await pdf.embedPng(m[2]); else if (tipo === 'jpg' || tipo === 'jpeg') r = await pdf.embedJpg(m[2]);
          else {
            const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
            const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
            r = await pdf.embedPng(c.toDataURL('image/png').split(',')[1]); c.width = c.height = 0;
          }
        }
      } catch (e) { r = null; }
      imgCache.set(src, r); return r;
    }
    const fluxoImg = async b => {
      const im = await imagem(b.src); if (!im) return;
      const x0 = M + b.ind * IND, larg = LARG - b.ind * IND, maxH = (topo - rodape) * .96;
      let k = Math.min(1, larg / im.width, maxH / im.height); const w = im.width * k, h = im.height * k;
      if (y - h < rodape && !noTopo) nova();
      pag.drawImage(im, { x: x0, y: y - h, width: w, height: h }); y -= h + TAM * .6; noTopo = false;
    };
    const fluxoTab = b => {
      const n = Math.max(...b.linhas.map(r => r.length)), x0 = M + b.ind * IND, larg = LARG - b.ind * IND, PAD = 4;
      const pesos = Array(n).fill(4); b.linhas.forEach(r => r.forEach((c, i) => { pesos[i] = Math.max(pesos[i], c.peso); }));
      const minW = Math.min(48, larg / n); let ws = pesos.map(p => p / pesos.reduce((a, c) => a + c, 0) * larg);
      ws = ws.map(w => Math.max(minW, w)); const tot = ws.reduce((a, c) => a + c, 0); ws = ws.map(w => w * larg / tot);
      const tamC = Math.max(6, TAM * .92);
      if (!noTopo) y -= TAM * .2;
      b.linhas.forEach(row => {
        const cels = row.map((c, i) => {
          const ls = []; c.blocos.forEach(bl => { if (bl.tipo !== 'p') return; const t = tamC * (bl.mult || 1), a = quebrar(bl.runs, Math.max(10, ws[i] - 2 * PAD - bl.ind * 8), t, bl.pre); a.forEach((l, j) => { l.ind = bl.ind * 8; l.pref = j === 0 ? bl.pref : null; ls.push(l); }); });
          return { ls, th: c.th, i, idx: 0, x: x0 + ws.slice(0, i).reduce((a, c2) => a + c2, 0), w: ws[i] };
        });
        let primeiro = true;
        for (;;) {
          const resta = cels.some(c => c.idx < c.ls.length);
          if (!resta && !primeiro) break;
          const avail = y - rodape - 2 * PAD; let usado = 0, fim = [];
          cels.forEach(c => { let h = 0, k = c.idx; while (k < c.ls.length && h + c.ls[k].h <= avail) { h += c.ls[k].h; k++; } fim.push(k); usado = Math.max(usado, h); });
          const algum = cels.some((c, i) => fim[i] > c.idx) || !cels.some(c => c.idx < c.ls.length);
          if (!algum) { if (noTopo) { cels.forEach((c, i) => { if (c.idx < c.ls.length) { fim[i] = c.idx + 1; usado = Math.max(usado, c.ls[c.idx].h); } }); } else { nova(); continue; } }
          const altura = Math.max(usado, tamC * 1.35) + 2 * PAD;
          cels.forEach((c, i) => {
            pag.drawRectangle({ x: c.x, y: y - altura, width: c.w, height: altura, borderColor: P.rgb(.63, .64, .72), borderWidth: .6, color: c.th ? P.rgb(.925, .937, .984) : undefined });
            let yy = y - PAD;
            for (let k = c.idx; k < fim[i]; k++) { const l = c.ls[k]; desenharLinha(l, c.x + PAD + (l.ind || 0), yy); yy -= l.h; }
            c.idx = fim[i];
          });
          y -= altura; noTopo = false; primeiro = false;
          if (cels.every(c => c.idx >= c.ls.length)) break;
          nova();
        }
      });
      y -= TAM * .7;
    };
    let n = 0;
    for (const b of lista) {
      if (ctx && (++n % 25 === 0)) { CV.checar(ctx); await new Promise(r => setTimeout(r, 0)); }
      if (b.tipo === 'p') fluxoPar(b);
      else if (b.tipo === 'img') await fluxoImg(b);
      else if (b.tipo === 'tab') fluxoTab(b);
      else if (b.tipo === 'hr') { y -= TAM * .4; if (y < rodape) nova(); pag.drawLine({ start: { x: M, y }, end: { x: M + LARG, y }, thickness: .8, color: P.rgb(.6, .63, .74) }); y -= TAM * .8; }
    }
    if (o.numerar !== false) {
      const pgs = pdf.getPages(), fo = F.mapa.r.f;
      pgs.forEach((p, i) => { const s = (i + 1) + ' / ' + pgs.length, w = fo.widthOfTextAtSize(s, 9); p.drawText(s, { x: (PW - w) / 2, y: Math.max(10, M / 2 - 4), size: 9, font: fo, color: P.rgb(.45, .47, .55) }); });
    }
    const bytes = await pdf.save();
    return new Blob([bytes], { type: 'application/pdf' });
  }
  CV.pdfDoc = { gerar };
})();
