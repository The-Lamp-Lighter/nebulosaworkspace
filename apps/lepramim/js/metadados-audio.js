/* ============================================================
   LêPraMim — metadados-audio.js
   Lê as informações gravadas dentro dos arquivos de áudio,
   sem bibliotecas externas:
   - MP3 (ID3v2): título, autor, narrador, gênero, capa, capítulos (CHAP)
   - M4A / M4B / AAC em MP4: idem, com capítulos Nero (chpl) e QuickTime
   - FLAC e OGG (Vorbis/Opus): comentários, capa e capítulos
   Retorna { titulo, autor, narrador, genero, album, capa (Blob), capitulos:[{titulo, inicio}] }
   ============================================================ */
(function () {
  'use strict';

  const latin1 = new TextDecoder('windows-1252');
  const utf8 = new TextDecoder('utf-8');
  const ascii = (u8, ini, n) => String.fromCharCode.apply(null, u8.subarray(ini, ini + n));
  const be32 = (u8, p) => ((u8[p] << 24) | (u8[p + 1] << 16) | (u8[p + 2] << 8) | u8[p + 3]) >>> 0;
  const le32 = (u8, p) => ((u8[p + 3] << 24) | (u8[p + 2] << 16) | (u8[p + 1] << 8) | u8[p]) >>> 0;
  const synch = (u8, p) => ((u8[p] & 0x7f) << 21) | ((u8[p + 1] & 0x7f) << 14) | ((u8[p + 2] & 0x7f) << 7) | (u8[p + 3] & 0x7f);

  const GENEROS = { 12: 'Outro', 28: 'Vocal', 57: 'Comédia', 65: 'Comédia', 77: 'Musical', 101: 'Fala', 183: 'Audiobook', 184: 'Teatro em áudio', 186: 'Podcast' };

  function limparGenero(g) {
    g = String(g || '').trim();
    const m = /^\(?(\d{1,3})\)?$/.exec(g);
    if (m) return GENEROS[parseInt(m[1], 10)] || '';
    return g.replace(/^\(\d+\)/, '').trim();
  }

  /* ============================================================
     MP3 — ID3v2
     ============================================================ */

  /** Decodifica um texto ID3 conforme o byte de codificação. */
  function textoId3(d, cod) {
    let t;
    if (cod === 1) t = new TextDecoder('utf-16').decode(d);        // UTF-16 com BOM
    else if (cod === 2) t = new TextDecoder('utf-16be').decode(d);
    else if (cod === 3) t = utf8.decode(d);
    else t = latin1.decode(d);
    return t.replace(/\u0000+$/g, '').split('\u0000').filter(Boolean).join(', ').trim();
  }

  /** Posição do terminador nulo (1 byte, ou 2 bytes em UTF-16). */
  function fimDoTexto(d, ini, cod) {
    if (cod === 1 || cod === 2) {
      for (let i = ini; i + 1 < d.length; i += 2) if (d[i] === 0 && d[i + 1] === 0) return { fim: i, prox: i + 2 };
      return { fim: d.length, prox: d.length };
    }
    const i = d.indexOf(0, ini);
    return i < 0 ? { fim: d.length, prox: d.length } : { fim: i, prox: i + 1 };
  }

  function tratarQuadro(id, d, versao, r, cap) {
    if (!d.length) return;
    // Dentro de um capítulo (CHAP) só interessa o título
    if (cap) { if (id === 'TIT2' || id === 'TT2') cap.titulo = textoId3(d.subarray(1), d[0]); return; }

    if (id === 'TIT2' || id === 'TT2') r.titulo = textoId3(d.subarray(1), d[0]);
    else if (id === 'TPE1' || id === 'TP1') r.autor = textoId3(d.subarray(1), d[0]);
    else if ((id === 'TPE2' || id === 'TP2') && !r.autor) r.autor = textoId3(d.subarray(1), d[0]);
    else if (id === 'TALB' || id === 'TAL') r.album = textoId3(d.subarray(1), d[0]);
    else if (id === 'TCON' || id === 'TCO') r.genero = limparGenero(textoId3(d.subarray(1), d[0]));
    else if ((id === 'TCOM' || id === 'TCM') && !r.narrador) r.narrador = textoId3(d.subarray(1), d[0]); // em audiobooks, "compositor" costuma ser o narrador
    else if (id === 'TXXX') {
      const cod = d[0];
      const f = fimDoTexto(d, 1, cod);
      const desc = textoId3(d.subarray(1, f.fim), cod);
      if (/narrat|narrador|read ?by|lido por/i.test(desc)) r.narrador = textoId3(d.subarray(f.prox), cod);
    }
    else if (id === 'APIC' && !r.capa) {
      const cod = d[0];
      const fimMime = d.indexOf(0, 1);
      if (fimMime < 0) return;
      const mime = latin1.decode(d.subarray(1, fimMime)) || 'image/jpeg';
      const f = fimDoTexto(d, fimMime + 2, cod); // +1 nulo, +1 tipo da imagem
      r.capa = new Blob([d.slice(f.prox)], { type: mime.indexOf('/') > 0 ? mime : 'image/jpeg' });
    }
    else if (id === 'PIC' && !r.capa) {
      const cod = d[0];
      const formato = ascii(d, 1, 3).toLowerCase();
      const f = fimDoTexto(d, 5, cod);
      r.capa = new Blob([d.slice(f.prox)], { type: formato === 'png' ? 'image/png' : 'image/jpeg' });
    }
    else if (id === 'CHAP') {
      const fimId = d.indexOf(0);
      if (fimId < 0 || fimId + 17 > d.length) return;
      const novo = { titulo: '', inicio: be32(d, fimId + 1) / 1000 };
      lerQuadros(d, fimId + 17, d.length, versao, r, novo);
      r.capitulos.push(novo);
    }
  }

  function lerQuadros(buf, pos, fim, versao, r, cap) {
    const tamId = versao === 2 ? 3 : 4;
    const tamCab = versao === 2 ? 6 : 10;
    while (pos + tamCab <= fim) {
      const id = ascii(buf, pos, tamId);
      if (!/^[A-Z0-9]+$/.test(id)) break; // chegou no preenchimento (zeros)
      let tam;
      if (versao === 2) tam = (buf[pos + 3] << 16) | (buf[pos + 4] << 8) | buf[pos + 5];
      else if (versao === 4) tam = synch(buf, pos + 4);
      else tam = be32(buf, pos + 4);
      const ini = pos + tamCab;
      if (tam <= 0 || ini + tam > fim) break;
      try { tratarQuadro(id, buf.subarray(ini, ini + tam), versao, r, cap); } catch (e) { /* quadro defeituoso: segue */ }
      pos = ini + tam;
    }
  }

  async function lerId3(arquivo, cab) {
    const versao = cab[3], flags = cab[5];
    const tam = synch(cab, 6);
    if (versao < 2 || versao > 4 || tam <= 0) return {};
    const buf = new Uint8Array(await arquivo.slice(10, 10 + tam).arrayBuffer());
    let pos = 0;
    if (versao >= 3 && (flags & 0x40)) pos = versao === 4 ? synch(buf, 0) : be32(buf, 0) + 4; // cabeçalho estendido
    const r = { capitulos: [] };
    lerQuadros(buf, pos, buf.length, versao, r, null);
    r.capitulos.sort((a, b) => a.inicio - b.inicio);
    r.capitulos.forEach((c, i) => { if (!c.titulo) c.titulo = 'Capítulo ' + (i + 1); });
    return r;
  }

  /* ============================================================
     M4A / M4B — contêiner MP4
     ============================================================ */

  /** Percorre os "átomos" (caixas) de um trecho do arquivo. */
  function atomos(dv, ini, fim) {
    const lista = [];
    let p = ini;
    while (p + 8 <= fim) {
      let tam = dv.getUint32(p);
      const tipo = latin1.decode(new Uint8Array(dv.buffer, dv.byteOffset + p + 4, 4));
      let cab = 8;
      if (tam === 1) { if (p + 16 > fim) break; tam = Number(dv.getBigUint64(p + 8)); cab = 16; }
      else if (tam === 0) tam = fim - p;
      if (tam < cab || p + tam > fim) break;
      lista.push({ tipo, ini: p + cab, fim: p + tam });
      p += tam;
    }
    return lista;
  }

  /** Desce por um caminho de átomos: achar(dv, 0, n, ['udta','meta','ilst']) */
  function achar(dv, ini, fim, caminho) {
    let a = { ini, fim };
    for (const nome of caminho) {
      const prox = atomos(dv, a.ini, a.fim).find(x => x.tipo === nome);
      if (!prox) return null;
      a = nome === 'meta' ? { ini: prox.ini + 4, fim: prox.fim } : prox; // 'meta' tem 4 bytes extras
    }
    return a;
  }

  async function lerMp4(arquivo) {
    // 1) Procura o átomo 'moov' (pode estar no começo ou no fim do arquivo)
    let pos = 0, moov = null;
    const total = arquivo.size;
    while (pos + 8 <= total) {
      const c = new DataView(await arquivo.slice(pos, pos + 16).arrayBuffer());
      if (c.byteLength < 8) break;
      let tam = c.getUint32(0), cab = 8;
      const tipo = latin1.decode(new Uint8Array(c.buffer, 4, 4));
      if (tam === 1 && c.byteLength >= 16) { tam = Number(c.getBigUint64(8)); cab = 16; }
      else if (tam === 0) tam = total - pos;
      if (tam < 8) break;
      if (tipo === 'moov') {
        if (tam > 96 * 1024 * 1024) return {};
        moov = await arquivo.slice(pos + cab, pos + tam).arrayBuffer();
        break;
      }
      pos += tam;
    }
    if (!moov) return {};
    const dv = new DataView(moov), u8 = new Uint8Array(moov), n = u8.length;
    const r = { capitulos: [] };

    // 2) Etiquetas (estilo iTunes)
    const ilst = achar(dv, 0, n, ['udta', 'meta', 'ilst']);
    if (ilst) {
      for (const item of atomos(dv, ilst.ini, ilst.fim)) {
        const dado = atomos(dv, item.ini, item.fim).find(x => x.tipo === 'data');
        if (!dado || dado.fim - dado.ini < 8) continue;
        const tipoDado = dv.getUint32(dado.ini) & 0xffffff;
        const valor = u8.subarray(dado.ini + 8, dado.fim);
        const txt = () => utf8.decode(valor).trim();
        switch (item.tipo) {
          case '©nam': r.titulo = txt(); break;
          case '©ART': r.autor = txt(); break;
          case 'aART': if (!r.autor) r.autor = txt(); break;
          case '©alb': r.album = txt(); break;
          case '©gen': r.genero = txt(); break;
          case 'gnre': if (!r.genero && valor.length >= 2) r.genero = GENEROS[((valor[0] << 8) | valor[1]) - 1] || ''; break;
          case '©nrt': r.narrador = txt(); break;
          case '©wrt': if (!r.narrador) r.narrador = txt(); break;
          case 'covr': if (!r.capa) r.capa = new Blob([valor.slice()], { type: tipoDado === 14 ? 'image/png' : 'image/jpeg' }); break;
        }
      }
    }

    // 3) Capítulos no formato Nero ('chpl')
    const chpl = achar(dv, 0, n, ['udta', 'chpl']);
    if (chpl) {
      try {
        let p = chpl.ini;
        const versao = u8[p]; p += 4;
        if (versao) p += 4;
        const qtd = u8[p]; p += 1;
        for (let i = 0; i < qtd && p + 9 <= chpl.fim; i++) {
          const inicio = Number(dv.getBigUint64(p)) / 1e7; p += 8;
          const tam = u8[p]; p += 1;
          r.capitulos.push({ titulo: utf8.decode(u8.subarray(p, p + tam)).trim() || 'Capítulo ' + (i + 1), inicio });
          p += tam;
        }
      } catch (e) { r.capitulos = []; }
    }

    // 4) Capítulos no formato QuickTime (uma trilha de texto referenciada por 'chap')
    if (!r.capitulos.length) {
      try { r.capitulos = await capitulosQuickTime(arquivo, dv, u8, n); } catch (e) { r.capitulos = []; }
    }
    return r;
  }

  async function capitulosQuickTime(arquivo, dv, u8, n) {
    const trilhas = atomos(dv, 0, n).filter(a => a.tipo === 'trak');
    const idDe = t => {
      const tkhd = achar(dv, t.ini, t.fim, ['tkhd']);
      if (!tkhd) return -1;
      return dv.getUint32(tkhd.ini + (u8[tkhd.ini] === 1 ? 20 : 12));
    };
    // qual trilha é a de capítulos?
    let idCap = -1;
    for (const t of trilhas) {
      const chap = achar(dv, t.ini, t.fim, ['tref', 'chap']);
      if (chap && chap.fim - chap.ini >= 4) { idCap = dv.getUint32(chap.ini); break; }
    }
    if (idCap < 0) return [];
    const trilha = trilhas.find(t => idDe(t) === idCap);
    if (!trilha) return [];

    const mdhd = achar(dv, trilha.ini, trilha.fim, ['mdia', 'mdhd']);
    const stbl = achar(dv, trilha.ini, trilha.fim, ['mdia', 'minf', 'stbl']);
    if (!mdhd || !stbl) return [];
    const escala = dv.getUint32(mdhd.ini + (u8[mdhd.ini] === 1 ? 20 : 12)) || 1000;
    const caixa = nome => atomos(dv, stbl.ini, stbl.fim).find(a => a.tipo === nome);
    const stts = caixa('stts'), stsz = caixa('stsz'), stsc = caixa('stsc'), stco = caixa('stco'), co64 = caixa('co64');
    if (!stts || !stsz || !(stco || co64)) return [];

    // durações de cada amostra
    const duracoes = [];
    for (let i = 0, q = dv.getUint32(stts.ini + 4), p = stts.ini + 8; i < q; i++, p += 8) {
      const vezes = dv.getUint32(p), delta = dv.getUint32(p + 4);
      for (let k = 0; k < vezes && duracoes.length < 2000; k++) duracoes.push(delta);
    }
    // tamanhos
    const tamFixo = dv.getUint32(stsz.ini + 4), qtd = Math.min(dv.getUint32(stsz.ini + 8), 2000);
    const tamanhos = [];
    for (let i = 0; i < qtd; i++) tamanhos.push(tamFixo || dv.getUint32(stsz.ini + 12 + i * 4));
    // posições dos blocos ("chunks")
    const blocos = [];
    if (stco) for (let i = 0, q = dv.getUint32(stco.ini + 4); i < q; i++) blocos.push(dv.getUint32(stco.ini + 8 + i * 4));
    else for (let i = 0, q = dv.getUint32(co64.ini + 4); i < q; i++) blocos.push(Number(dv.getBigUint64(co64.ini + 8 + i * 8)));
    // quantas amostras por bloco
    const regras = [];
    if (stsc) for (let i = 0, q = dv.getUint32(stsc.ini + 4), p = stsc.ini + 8; i < q; i++, p += 12) regras.push({ de: dv.getUint32(p), por: dv.getUint32(p + 4) });
    const porBloco = idx => { let v = 1; for (const g of regras) { if (g.de <= idx + 1) v = g.por; else break; } return v; };

    const posicoes = [];
    let amostra = 0;
    for (let b = 0; b < blocos.length && amostra < qtd; b++) {
      let desloc = blocos[b];
      for (let k = 0, q = porBloco(b); k < q && amostra < qtd; k++, amostra++) {
        posicoes.push(desloc);
        desloc += tamanhos[amostra];
      }
    }

    const caps = [];
    let tempo = 0;
    for (let i = 0; i < posicoes.length; i++) {
      const bytes = new Uint8Array(await arquivo.slice(posicoes[i], posicoes[i] + tamanhos[i]).arrayBuffer());
      if (bytes.length >= 2) {
        const tam = (bytes[0] << 8) | bytes[1];
        const corpo = bytes.subarray(2, 2 + tam);
        const utf16 = corpo.length >= 2 && ((corpo[0] === 0xFE && corpo[1] === 0xFF) || (corpo[0] === 0xFF && corpo[1] === 0xFE));
        const titulo = (utf16 ? new TextDecoder('utf-16').decode(corpo) : utf8.decode(corpo)).trim();
        caps.push({ titulo: titulo || 'Capítulo ' + (i + 1), inicio: tempo / escala });
      }
      tempo += duracoes[i] || 0;
    }
    return caps;
  }

  /* ============================================================
     FLAC e OGG — comentários Vorbis
     ============================================================ */

  function comentariosVorbis(u8, p, r) {
    const tamFornecedor = le32(u8, p); p += 4 + tamFornecedor;
    const qtd = le32(u8, p); p += 4;
    const tempos = {}, nomes = {};
    for (let i = 0; i < qtd && p + 4 <= u8.length; i++) {
      const tam = le32(u8, p); p += 4;
      if (tam > 1000000 || p + tam > u8.length) break;
      const s = utf8.decode(u8.subarray(p, p + tam)); p += tam;
      const ig = s.indexOf('=');
      if (ig < 1) continue;
      const k = s.slice(0, ig).toUpperCase(), v = s.slice(ig + 1).trim();
      if (k === 'TITLE') r.titulo = v;
      else if (k === 'ARTIST' || (k === 'ALBUMARTIST' && !r.autor)) r.autor = v;
      else if (k === 'ALBUM') r.album = v;
      else if (k === 'GENRE') r.genero = v;
      else if (k === 'NARRATOR' || k === 'NARRATEDBY' || (k === 'COMPOSER' && !r.narrador)) r.narrador = v;
      else {
        const m = /^CHAPTER(\d+)(NAME)?$/.exec(k);
        if (m) (m[2] ? nomes : tempos)[m[1]] = v;
      }
    }
    Object.keys(tempos).sort().forEach((num, i) => {
      const m = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(tempos[num]);
      if (m) r.capitulos.push({ titulo: nomes[num] || 'Capítulo ' + (i + 1), inicio: (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) });
    });
  }

  async function lerFlac(arquivo) {
    const u8 = new Uint8Array(await arquivo.slice(0, Math.min(arquivo.size, 8 * 1024 * 1024)).arrayBuffer());
    const r = { capitulos: [] };
    let p = 4;
    while (p + 4 <= u8.length) {
      const ultimo = u8[p] & 0x80, tipo = u8[p] & 0x7f;
      const tam = (u8[p + 1] << 16) | (u8[p + 2] << 8) | u8[p + 3];
      const ini = p + 4;
      if (ini + tam > u8.length) break;
      if (tipo === 4) { try { comentariosVorbis(u8, ini, r); } catch (e) { /* segue */ } }
      else if (tipo === 6 && !r.capa) {
        try {
          let q = ini + 4;
          const tamMime = be32(u8, q); q += 4;
          const mime = ascii(u8, q, tamMime); q += tamMime;
          const tamDesc = be32(u8, q); q += 4 + tamDesc + 16;
          const tamImg = be32(u8, q); q += 4;
          r.capa = new Blob([u8.slice(q, q + tamImg)], { type: mime || 'image/jpeg' });
        } catch (e) { /* capa opcional */ }
      }
      p = ini + tam;
      if (ultimo) break;
    }
    return r;
  }

  async function lerOgg(arquivo) {
    const u8 = new Uint8Array(await arquivo.slice(0, Math.min(arquivo.size, 512 * 1024)).arrayBuffer());
    const r = { capitulos: [] };
    const procurar = assinatura => {
      const alvo = Array.from(assinatura).map(c => c.charCodeAt(0));
      externo: for (let i = 0; i + alvo.length < u8.length; i++) {
        for (let k = 0; k < alvo.length; k++) if (u8[i + k] !== alvo[k]) continue externo;
        return i + alvo.length;
      }
      return -1;
    };
    let p = procurar('\u0003vorbis');
    if (p < 0) p = procurar('OpusTags');
    if (p >= 0) { try { comentariosVorbis(u8, p, r); } catch (e) { /* segue */ } }
    return r;
  }

  /* ============================================================
     Ponto de entrada
     ============================================================ */
  async function ler(arquivo) {
    const cab = new Uint8Array(await arquivo.slice(0, 12).arrayBuffer());
    if (cab.length < 12) return {};
    const inicio = ascii(cab, 0, 4);
    let r = {};
    if (inicio.slice(0, 3) === 'ID3') r = await lerId3(arquivo, cab);
    else if (inicio === 'fLaC') r = await lerFlac(arquivo);
    else if (inicio === 'OggS') r = await lerOgg(arquivo);
    else if (ascii(cab, 4, 4) === 'ftyp') r = await lerMp4(arquivo);
    r.capitulos = (r.capitulos || []).filter(c => isFinite(c.inicio) && c.inicio >= 0);
    if (r.capitulos.length < 2) r.capitulos = []; // um único capítulo não ajuda na navegação
    return r;
  }

  LPM.metaAudio = { ler };
})();
