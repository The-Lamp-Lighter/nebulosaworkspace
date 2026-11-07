/* ==========================================================================
   Utilidades — Conversor: motor de ARQUIVOS COMPACTADOS e FONTES (1.0)
   ZIP, TAR, TAR.GZ e GZ entre si; fontes TTF/OTF ⇄ WOFF. Tudo no navegador.
   ========================================================================== */
(function () {
  'use strict';
  const { T } = UT, CV = UT.CV;

  /* ---------- gzip ---------- */
  async function fluxo(bytes, Cls, formato) {
    if (typeof window[Cls] === 'undefined') throw new Error(T('Este navegador não sabe comprimir arquivos (.gz). Atualize o navegador.'));
    const s = new Blob([bytes]).stream().pipeThrough(new window[Cls](formato));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  const gzip = b => fluxo(b, 'CompressionStream', 'gzip');
  const gunzip = b => fluxo(b, 'DecompressionStream', 'gzip');

  /* ---------- tar ---------- */
  const TD = new TextDecoder(), TE = new TextEncoder();
  const campo = (b, a, n) => { let t = b.subarray(a, a + n), i = t.indexOf(0); if (i >= 0) t = t.subarray(0, i); return TD.decode(t); };
  function lerTar(bytes) {
    const itens = []; let o = 0, longo = '';
    while (o + 512 <= bytes.length) {
      const h = bytes.subarray(o, o + 512);
      if (h.every(x => x === 0)) break;
      let nome = campo(h, 0, 100); const pref = campo(h, 345, 155), tipo = String.fromCharCode(h[156] || 48);
      const tam = parseInt(campo(h, 124, 12).trim() || '0', 8) || 0;
      if (pref && !longo) nome = pref + '/' + nome;
      o += 512;
      const dados = bytes.subarray(o, o + tam);
      o += Math.ceil(tam / 512) * 512;
      if (tipo === 'L') { longo = TD.decode(dados).replace(/\0+$/, ''); continue; }
      if (longo) { nome = longo; longo = ''; }
      if (tipo === '0' || tipo === '\0' || tipo === '7') itens.push({ nome, dados: dados.slice(), data: new Date((parseInt(campo(h, 136, 12).trim() || '0', 8) || 0) * 1000) });
      else if (tipo === '5') itens.push({ nome: nome.replace(/\/?$/, '/'), pasta: true });
    }
    return itens;
  }
  function gravarTar(itens) {
    const partes = [];
    const oct = (n, l) => (n.toString(8).padStart(l - 1, '0') + '\0');
    const cab = (nome, tam, tipo, mtime) => {
      const h = new Uint8Array(512), put = (s, a) => h.set(TE.encode(s), a);
      let nb = TE.encode(nome); if (nb.length > 100) { const longoH = cabLongo(nome); partes.push(...longoH); nb = nb.subarray(0, 100); }
      h.set(nb, 0); put(oct(tipo === '5' ? 0o755 : 0o644, 8), 100); put(oct(0, 8), 108); put(oct(0, 8), 116); put(oct(tam, 12), 124); put(oct(Math.floor(mtime / 1000), 12), 136);
      put('        ', 148); h[156] = tipo.charCodeAt(0); put('ustar\0', 257); put('00', 263);
      let s = 0; for (let i = 0; i < 512; i++) s += h[i];
      put(s.toString(8).padStart(6, '0') + '\0 ', 148);
      return h;
    };
    function cabLongo(nome) {
      const d = TE.encode(nome + '\0'), h = new Uint8Array(512), put = (s, a) => h.set(TE.encode(s), a);
      put('././@LongLink', 0); put(oct(0o644, 8), 100); put(oct(0, 8), 108); put(oct(0, 8), 116); put(oct(d.length, 12), 124); put(oct(0, 12), 136); put('        ', 148); h[156] = 76; put('ustar  \0', 257);
      let s = 0; for (let i = 0; i < 512; i++) s += h[i]; put(s.toString(8).padStart(6, '0') + '\0 ', 148);
      const pad = new Uint8Array(Math.ceil(d.length / 512) * 512); pad.set(d);
      return [h, pad];
    }
    itens.forEach(it => {
      const t = (it.data || new Date()).getTime ? it.data.getTime() : Date.now();
      if (it.pasta) { partes.push(cab(it.nome.replace(/\/?$/, '/'), 0, '5', t)); return; }
      partes.push(cab(it.nome, it.dados.length, '0', t));
      const pad = new Uint8Array(Math.ceil(it.dados.length / 512) * 512); pad.set(it.dados); partes.push(pad);
    });
    partes.push(new Uint8Array(1024));
    return new Blob(partes);
  }

  /* ---------- itens <-> formatos ---------- */
  async function lerItens(f, de) {
    if (de === 'zip') {
      const Z = await UT.jszip(), z = await Z.loadAsync(await f.arrayBuffer()), itens = [];
      for (const nome of Object.keys(z.files)) { const e = z.files[nome]; if (e.dir) itens.push({ nome, pasta: true }); else itens.push({ nome, dados: await e.async('uint8array'), data: e.date }); }
      return itens;
    }
    if (de === 'tar') return lerTar(await CV.lerBytes(f));
    if (de === 'tgz') return lerTar(await gunzip(await CV.lerBytes(f)));
    if (de === 'gz') { const b = await gunzip(await CV.lerBytes(f)); return [{ nome: UT.semExt(f.name) || 'arquivo', dados: b, data: new Date() }]; }
    return [];
  }
  async function gravarItens(itens, para) {
    if (para === 'zip') {
      const Z = await UT.jszip(), z = new Z();
      itens.forEach(it => { if (it.pasta) z.folder(it.nome); else z.file(it.nome, it.dados, { date: it.data || new Date() }); });
      return z.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    }
    const tar = await gravarTar(itens);
    if (para === 'tar') return tar;
    return new Blob([await gzip(new Uint8Array(await tar.arrayBuffer()))], { type: 'application/gzip' });
  }

  /* ---------- fontes: WOFF ---------- */
  const u32 = (v, o) => v.getUint32(o), tag = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  async function inflar(b) { return fluxo(b, 'DecompressionStream', 'deflate'); }
  async function deflar(b) { return fluxo(b, 'CompressionStream', 'deflate'); }
  const soma = b => { let s = 0; const n = Math.ceil(b.length / 4); const v = new DataView(new ArrayBuffer(n * 4)); new Uint8Array(v.buffer).set(b); for (let i = 0; i < n; i++) s = (s + v.getUint32(i * 4)) >>> 0; return s; };
  async function sfntParaWoff(b) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength), n = v.getUint16(4), flavor = v.getUint32(0), tabs = [];
    for (let i = 0; i < n; i++) { const o = 12 + i * 16; tabs.push({ tag: tag(b, o), sum: v.getUint32(o + 4), off: v.getUint32(o + 8), len: v.getUint32(o + 12) }); }
    tabs.sort((a, c) => (a.tag < c.tag ? -1 : 1));
    const dados = [];
    for (const t of tabs) { const orig = b.subarray(t.off, t.off + t.len), c = await deflar(orig); dados.push(c.length < orig.length ? { c, orig: orig.length, z: true } : { c: orig.slice(), orig: orig.length, z: false }); }
    let off = 44 + 20 * n; const offs = dados.map(d => { const o = off; off += Math.ceil(d.c.length / 4) * 4; return o; });
    const out = new Uint8Array(off), w = new DataView(out.buffer);
    w.setUint32(0, 0x774F4646); w.setUint32(4, flavor); w.setUint32(8, off); w.setUint16(12, n);
    const totalSfnt = 12 + 16 * n + tabs.reduce((s, t) => s + Math.ceil(t.len / 4) * 4, 0); w.setUint32(16, totalSfnt);
    tabs.forEach((t, i) => { const o = 44 + i * 20, d = dados[i]; out.set(new TextEncoder().encode(t.tag), o); w.setUint32(o + 4, offs[i]); w.setUint32(o + 8, d.c.length); w.setUint32(o + 12, d.orig); w.setUint32(o + 16, t.sum); out.set(d.c, offs[i]); });
    return out;
  }
  async function woffParaSfnt(b) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (u32(v, 0) !== 0x774F4646) throw new Error(T('Este arquivo não é uma fonte WOFF válida.'));
    const flavor = u32(v, 4), n = v.getUint16(12), tabs = [];
    for (let i = 0; i < n; i++) { const o = 44 + i * 20; tabs.push({ tag: tag(b, o), off: u32(v, o + 4), comp: u32(v, o + 8), orig: u32(v, o + 12), sum: u32(v, o + 16) }); }
    let off = 12 + 16 * n; const posicoes = tabs.map(t => { const o = off; off += Math.ceil(t.orig / 4) * 4; return o; });
    const out = new Uint8Array(off), w = new DataView(out.buffer);
    w.setUint32(0, flavor); w.setUint16(4, n);
    let pot = 1, log = 0; while (pot * 2 <= n) { pot *= 2; log++; }
    w.setUint16(6, pot * 16); w.setUint16(8, log); w.setUint16(10, n * 16 - pot * 16);
    for (let i = 0; i < n; i++) {
      const t = tabs[i], o = 12 + i * 16, bruto = b.subarray(t.off, t.off + t.comp), d = t.comp < t.orig ? await inflar(bruto) : bruto;
      out.set(new TextEncoder().encode(t.tag), o); w.setUint32(o + 4, t.sum); w.setUint32(o + 8, posicoes[i]); w.setUint32(o + 12, t.orig); out.set(d.subarray(0, t.orig), posicoes[i]);
    }
    return { bytes: out, flavor };
  }

  CV.motor({
    id: 'arquivo',
    rotas(de) {
      if (de === 'zip') return ['tar', 'tgz'];
      if (de === 'tar') return ['zip', 'tgz'];
      if (de === 'tgz') return ['zip', 'tar'];
      if (de === 'gz') return ['zip', 'tar', 'tgz'];
      if (de === 'ttf' || de === 'otf') return ['woff'];
      if (de === 'woff') return ['ttf', 'otf'];
      return [];
    },
    opcoes() { return []; },
    async converter(ctx) {
      const { arquivo: f, de, para, nomeBase } = ctx;
      if (CV.FMT[de].cat === 'fonte') {
        const b = await CV.lerBytes(f);
        if (para === 'woff') return [CV.saida(await sfntParaWoff(b), nomeBase, 'woff')];
        const r = await woffParaSfnt(b), ehOtf = r.flavor === 0x4F54544F;
        if (ehOtf !== (para === 'otf')) throw new Error(ehOtf ? T('Esta fonte WOFF tem contornos PostScript (CFF): converta para OTF.') : T('Esta fonte WOFF tem contornos TrueType: converta para TTF.'));
        return [CV.saida(r.bytes, nomeBase, para)];
      }
      ctx.progresso(0.2, T('Lendo o arquivo…'));
      let itens;
      try { itens = await lerItens(f, de); } catch (e) { throw new Error(T('Não foi possível abrir este arquivo compactado: {1}', e.message || e)); }
      if (!itens.length) throw new Error(T('O arquivo compactado está vazio.'));
      ctx.progresso(0.6, T('Gravando…'));
      return [{ blob: await gravarItens(itens, para), nome: CV.nomeSaida(nomeBase, para) }];
    }
  });
})();
