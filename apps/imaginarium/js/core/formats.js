/* ==========================================================================
   Imaginarium — formatos de arquivo (sem bibliotecas externas)
   ZIP (gravação), GIF (gravação com animação e leitura de quadros),
   BMP, TIFF, ICO e TGA (gravação e leitura), SVG (gravação).
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U;

  /* ==================================================================
     Utilitários binários
     ================================================================== */
  class Writer {
    constructor(le, cap) { this.le = !!le; this.buf = new Uint8Array(cap || 1 << 16); this.dv = new DataView(this.buf.buffer); this.pos = 0; }
    ensure(n) {
      if (this.pos + n <= this.buf.length) return;
      let cap = this.buf.length * 2; while (cap < this.pos + n) cap *= 2;
      const nb = new Uint8Array(cap); nb.set(this.buf.subarray(0, this.pos)); this.buf = nb; this.dv = new DataView(nb.buffer);
    }
    u8(v) { this.ensure(1); this.buf[this.pos++] = v & 255; return this; }
    i8(v) { return this.u8(v < 0 ? v + 256 : v); }
    u16(v) { this.ensure(2); this.dv.setUint16(this.pos, v, this.le); this.pos += 2; return this; }
    i16(v) { this.ensure(2); this.dv.setInt16(this.pos, v, this.le); this.pos += 2; return this; }
    u32(v) { this.ensure(4); this.dv.setUint32(this.pos, v >>> 0, this.le); this.pos += 4; return this; }
    i32(v) { this.ensure(4); this.dv.setInt32(this.pos, v | 0, this.le); this.pos += 4; return this; }
    f64(v) { this.ensure(8); this.dv.setFloat64(this.pos, v, this.le); this.pos += 8; return this; }
    f32(v) { this.ensure(4); this.dv.setFloat32(this.pos, v, this.le); this.pos += 4; return this; }
    bytes(a) { this.ensure(a.length); this.buf.set(a, this.pos); this.pos += a.length; return this; }
    ascii(s) { this.ensure(s.length); for (let i = 0; i < s.length; i++) this.buf[this.pos++] = s.charCodeAt(i) & 255; return this; }
    zeros(n) { this.ensure(n); this.buf.fill(0, this.pos, this.pos + n); this.pos += n; return this; }
    pad(m, from = 0) { while ((this.pos - from) % m) this.u8(0); return this; }
    /** Reserva um u32 e devolve uma função que grava nele o tamanho desde a reserva. */
    lenU32() { const at = this.pos; this.u32(0); return (extra = 0) => { this.dv.setUint32(at, this.pos - at - 4 + extra, this.le); }; }
    setU32(at, v) { this.dv.setUint32(at, v >>> 0, this.le); }
    out() { return this.buf.slice(0, this.pos); }
  }
  class Reader {
    constructor(buf, le) { this.u = buf instanceof Uint8Array ? buf : new Uint8Array(buf); this.dv = new DataView(this.u.buffer, this.u.byteOffset, this.u.byteLength); this.pos = 0; this.le = !!le; }
    get left() { return this.u.length - this.pos; }
    u8() { return this.u[this.pos++]; }
    i8() { const v = this.u[this.pos++]; return v > 127 ? v - 256 : v; }
    u16() { const v = this.dv.getUint16(this.pos, this.le); this.pos += 2; return v; }
    i16() { const v = this.dv.getInt16(this.pos, this.le); this.pos += 2; return v; }
    u32() { const v = this.dv.getUint32(this.pos, this.le); this.pos += 4; return v; }
    i32() { const v = this.dv.getInt32(this.pos, this.le); this.pos += 4; return v; }
    u64() { const hi = this.u32(), lo = this.u32(); return this.le ? lo * 4294967296 + hi : hi * 4294967296 + lo; }
    f32() { const v = this.dv.getFloat32(this.pos, this.le); this.pos += 4; return v; }
    f64() { const v = this.dv.getFloat64(this.pos, this.le); this.pos += 8; return v; }
    bytes(n) { const b = this.u.subarray(this.pos, this.pos + n); this.pos += n; return b; }
    ascii(n) { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(this.u[this.pos + i]); this.pos += n; return s; }
    skip(n) { this.pos += n; return this; }
    seek(p) { this.pos = p; return this; }
  }
  const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8, crc = 0) { crc = ~crc >>> 0; for (let i = 0; i < u8.length; i++) crc = crcTable[(crc ^ u8[i]) & 255] ^ (crc >>> 8); return ~crc >>> 0; }

  async function toBytes(d) {
    if (d instanceof Uint8Array) return d;
    if (d instanceof ArrayBuffer) return new Uint8Array(d);
    if (typeof d === 'string') return new TextEncoder().encode(d);
    if (d && d.arrayBuffer) return new Uint8Array(await d.arrayBuffer());
    return new Uint8Array(0);
  }
  /** Descompacta zlib/deflate usando a API nativa do navegador. */
  async function inflate(u8, raw) {
    if (typeof DecompressionStream !== 'function') throw new Error('Este navegador não descompacta dados ZIP.');
    const ds = new DecompressionStream(raw ? 'deflate-raw' : 'deflate');
    const out = new Response(new Blob([u8]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function deflate(u8) {
    if (typeof CompressionStream !== 'function') return null;
    const cs = new CompressionStream('deflate');
    return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(cs)).arrayBuffer());
  }

  /* ==================================================================
     ZIP (método "store")
     ================================================================== */
  async function zip(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let off = 0;
    const d = new Date(), dosT = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosD = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const used = new Set();
    for (const f of files) {
      let name = f.name; let k = 2; while (used.has(name)) { name = f.name.replace(/(\.[^.]*)?$/, ' (' + k++ + ')$1'); } used.add(name);
      const data = await toBytes(f.data), nb = enc.encode(name), crc = crc32(data);
      const h = new Writer(true, 64);
      h.u32(0x04034b50).u16(20).u16(0x0800).u16(0).u16(dosT).u16(dosD).u32(crc).u32(data.length).u32(data.length).u16(nb.length).u16(0).bytes(nb);
      const hb = h.out(); parts.push(hb, data);
      const c = new Writer(true, 80);
      c.u32(0x02014b50).u16(20).u16(20).u16(0x0800).u16(0).u16(dosT).u16(dosD).u32(crc).u32(data.length).u32(data.length).u16(nb.length).u16(0).u16(0).u16(0).u16(0).u32(0).u32(off).bytes(nb);
      central.push(c.out());
      off += hb.length + data.length;
    }
    const cl = central.reduce((s, c) => s + c.length, 0);
    const e = new Writer(true, 32);
    e.u32(0x06054b50).u16(0).u16(0).u16(files.length).u16(files.length).u32(cl).u32(off).u16(0);
    return new Blob([...parts, ...central, e.out()], { type: 'application/zip' });
  }

  /* ==================================================================
     Quantização de cores (corte mediano) e pontilhado
     ================================================================== */
  /** data: RGBA. Retorna { palette: [[r,g,b]...], index: Uint8Array, transparent: idx|-1 }. */
  function quantize(data, maxColors = 256, o = {}) {
    const N = data.length / 4, alphaT = o.alphaThreshold == null ? 128 : o.alphaThreshold;
    let hasT = false;
    const hist = new Map();
    for (let i = 0; i < N; i++) {
      if (data[i * 4 + 3] < alphaT) { hasT = true; continue; }
      const k = (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
      hist.set(k, (hist.get(k) || 0) + 1);
      if (hist.size > 70000) break;
    }
    const cap = maxColors - (hasT ? 1 : 0);
    let palette;
    if (hist.size <= cap && hist.size <= 70000) palette = [...hist.keys()].map((k) => [k >> 16, (k >> 8) & 255, k & 255]);
    else {
      // histograma 5-5-5
      const h5 = new Map();
      for (let i = 0; i < N; i++) { if (data[i * 4 + 3] < alphaT) continue; const k = ((data[i * 4] >> 3) << 10) | ((data[i * 4 + 1] >> 3) << 5) | (data[i * 4 + 2] >> 3); h5.set(k, (h5.get(k) || 0) + 1); }
      const pts = [...h5.entries()].map(([k, n]) => ({ r: ((k >> 10) << 3) + 4, g: (((k >> 5) & 31) << 3) + 4, b: ((k & 31) << 3) + 4, n }));
      const boxes = [pts];
      while (boxes.length < cap) {
        let bi = -1, best = -1, bc = 'r';
        boxes.forEach((b, i) => {
          if (b.length < 2) return;
          for (const c of ['r', 'g', 'b']) { let mn = 255, mx = 0; for (const p of b) { if (p[c] < mn) mn = p[c]; if (p[c] > mx) mx = p[c]; } const sc = (mx - mn) * Math.sqrt(b.reduce((s, p) => s + p.n, 0)); if (sc > best) { best = sc; bi = i; bc = c; } }
        });
        if (bi < 0 || best <= 0) break;
        const b = boxes[bi]; b.sort((p, q) => p[bc] - q[bc]);
        const tot = b.reduce((s, p) => s + p.n, 0); let acc = 0, cut = 1;
        for (let i = 0; i < b.length; i++) { acc += b[i].n; if (acc >= tot / 2) { cut = Math.max(1, Math.min(b.length - 1, i + 1)); break; } }
        boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
      }
      palette = boxes.filter((b) => b.length).map((b) => { let r = 0, g = 0, bl = 0, n = 0; for (const p of b) { r += p.r * p.n; g += p.g * p.n; bl += p.b * p.n; n += p.n; } return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)]; });
    }
    if (o.fixed) palette = o.fixed.slice(0, cap);
    if (!palette.length) palette = [[0, 0, 0]];
    return mapToPalette(data, palette, hasT, o);
  }
  function mapToPalette(data, palette, hasT, o = {}) {
    const N = data.length / 4, alphaT = o.alphaThreshold == null ? 128 : o.alphaThreshold, W = o.width || N;
    const pal = palette.slice(); let tIdx = -1;
    if (hasT) { tIdx = pal.length; pal.push([0, 0, 0]); }
    const cache = new Map();
    const near = (r, g, b) => {
      const k = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
      let v = cache.get(k); if (v !== undefined) return v;
      let bd = 1e9; v = 0;
      for (let i = 0; i < palette.length; i++) { const p = palette[i], dr = p[0] - r, dg = p[1] - g, db = p[2] - b, d = dr * dr * 2 + dg * dg * 4 + db * db * 3; if (d < bd) { bd = d; v = i; } }
      cache.set(k, v); return v;
    };
    const index = new Uint8Array(N);
    if (o.dither && W) {
      const H = N / W, err = new Float32Array(N * 3);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (data[i * 4 + 3] < alphaT) { index[i] = tIdx; continue; }
        const r = U.clamp(data[i * 4] + err[i * 3], 0, 255), g = U.clamp(data[i * 4 + 1] + err[i * 3 + 1], 0, 255), b = U.clamp(data[i * 4 + 2] + err[i * 3 + 2], 0, 255);
        const k = near(r | 0, g | 0, b | 0); index[i] = k;
        const p = palette[k], er = r - p[0], eg = g - p[1], eb = b - p[2];
        const add = (xx, yy, f) => { if (xx < 0 || xx >= W || yy >= H) return; const j = (yy * W + xx) * 3; err[j] += er * f; err[j + 1] += eg * f; err[j + 2] += eb * f; };
        add(x + 1, y, 7 / 16); add(x - 1, y + 1, 3 / 16); add(x, y + 1, 5 / 16); add(x + 1, y + 1, 1 / 16);
      }
    } else for (let i = 0; i < N; i++) index[i] = data[i * 4 + 3] < alphaT ? tIdx : near(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    return { palette: pal, index, transparent: tIdx };
  }

  /* ==================================================================
     GIF — gravação (LZW) e leitura
     ================================================================== */
  function lzwEncode(index, minCode, w) {
    const clear = 1 << minCode, eoi = clear + 1;
    let codeSize = minCode + 1, next = eoi + 1, dict = new Map();
    let cur = 0, bits = 0; const out = [];
    const emit = (c) => { cur |= c << bits; bits += codeSize; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } };
    emit(clear);
    let prefix = index[0];
    for (let i = 1; i < index.length; i++) {
      const k = index[i], key = (prefix << 12) | k, v = dict.get(key);
      if (v !== undefined) { prefix = v; continue; }
      emit(prefix);
      if (next < 4096) { dict.set(key, next++); if (next > (1 << codeSize) && codeSize < 12) codeSize++; }
      else { emit(clear); dict = new Map(); codeSize = minCode + 1; next = eoi + 1; }
      prefix = k;
    }
    emit(prefix); emit(eoi);
    if (bits > 0) out.push(cur & 255);
    void w;
    return out;
  }
  /** frames: [{ canvas, delay(ms), x, y }]; o: { loop, dither, colors } */
  function encodeGIF(frames, W, H, o = {}) {
    const w = new Writer(true, 1 << 20);
    w.ascii('GIF89a').u16(W).u16(H).u8(0x70).u8(0).u8(0); // sem tabela global
    if (frames.length > 1) { w.u8(0x21).u8(0xff).u8(11).ascii('NETSCAPE2.0').u8(3).u8(1).u16(o.loop == null ? 0 : o.loop).u8(0); }
    for (const f of frames) {
      const c = f.canvas, cw = c.width, ch = c.height;
      const data = c.getContext('2d').getImageData(0, 0, cw, ch).data;
      const q = quantize(data, o.colors || 256, { dither: o.dither, width: cw });
      let bitsN = 1; while ((1 << bitsN) < q.palette.length) bitsN++;
      const size = 1 << bitsN;
      // extensão de controle gráfico
      w.u8(0x21).u8(0xf9).u8(4).u8(((f.disposal == null ? (q.transparent >= 0 ? 2 : 1) : f.disposal) << 2) | (q.transparent >= 0 ? 1 : 0)).u16(Math.round((f.delay || 100) / 10)).u8(q.transparent >= 0 ? q.transparent : 0).u8(0);
      w.u8(0x2c).u16(f.x || 0).u16(f.y || 0).u16(cw).u16(ch).u8(0x80 | (bitsN - 1));
      for (let i = 0; i < size; i++) { const p = q.palette[i] || [0, 0, 0]; w.u8(p[0]).u8(p[1]).u8(p[2]); }
      const minCode = Math.max(2, bitsN);
      w.u8(minCode);
      const lz = lzwEncode(q.index, minCode, cw);
      for (let i = 0; i < lz.length; i += 255) { const n = Math.min(255, lz.length - i); w.u8(n); for (let k = 0; k < n; k++) w.u8(lz[i + k]); }
      w.u8(0);
    }
    w.u8(0x3b);
    return new Blob([w.out()], { type: 'image/gif' });
  }
  function lzwDecode(data, minCode, npix) {
    const out = new Uint8Array(npix), clear = 1 << minCode, eoi = clear + 1;
    let codeSize = minCode + 1, mask = (1 << codeSize) - 1, next = eoi + 1;
    const prefix = new Int16Array(4096), suffix = new Uint8Array(4096), stack = new Uint8Array(4097);
    for (let i = 0; i < clear; i++) { prefix[i] = -1; suffix[i] = i; }
    let cur = 0, bits = 0, p = 0, old = -1, first = 0, op = 0;
    while (op < npix) {
      while (bits < codeSize) { if (p >= data.length) return out; cur |= data[p++] << bits; bits += 8; }
      let code = cur & mask; cur >>>= codeSize; bits -= codeSize;
      if (code === clear) { codeSize = minCode + 1; mask = (1 << codeSize) - 1; next = eoi + 1; old = -1; continue; }
      if (code === eoi) break;
      if (old === -1) { out[op++] = suffix[code]; old = code; first = code; continue; }
      const inCode = code; let sp = 0;
      if (code >= next) { stack[sp++] = first; code = old; }
      while (code >= clear) { stack[sp++] = suffix[code]; code = prefix[code]; }
      first = suffix[code]; stack[sp++] = first;
      while (sp && op < npix) out[op++] = stack[--sp];
      if (next < 4096) { prefix[next] = old; suffix[next] = first; next++; if ((next & mask) === 0 && next < 4096) { codeSize++; mask = (1 << codeSize) - 1; } }
      old = inCode;
    }
    return out;
  }
  /** Lê todos os quadros (já compostos) de um GIF. Retorna { width, height, frames: [{canvas, delay}] }. */
  function decodeGIF(buf) {
    const r = new Reader(buf, true);
    if (r.ascii(3) !== 'GIF') throw new Error('não é um GIF');
    r.skip(3);
    const W = r.u16(), H = r.u16(), flags = r.u8(); r.u8(); r.u8();
    let gct = null;
    if (flags & 0x80) { const n = 2 << (flags & 7); gct = r.bytes(n * 3); }
    const screen = U.createCanvas(W, H), sx = screen.getContext('2d');
    const frames = [];
    let gce = { disposal: 0, delay: 100, tIdx: -1 };
    while (r.left > 0) {
      const b = r.u8();
      if (b === 0x3b) break;
      if (b === 0x21) {
        const label = r.u8();
        if (label === 0xf9) { r.u8(); const pf = r.u8(), delay = r.u16(), ti = r.u8(); r.u8(); gce = { disposal: (pf >> 2) & 7, delay: (delay || 10) * 10, tIdx: pf & 1 ? ti : -1 }; }
        else { let n; while ((n = r.u8())) r.skip(n); }
        continue;
      }
      if (b !== 0x2c) break;
      const fx = r.u16(), fy = r.u16(), fw = r.u16(), fh = r.u16(), f2 = r.u8();
      let ct = gct; if (f2 & 0x80) ct = r.bytes((2 << (f2 & 7)) * 3);
      const interlaced = !!(f2 & 0x40), minCode = r.u8();
      const chunks = []; let n, tot = 0; while ((n = r.u8())) { chunks.push(r.bytes(n)); tot += n; }
      const lz = new Uint8Array(tot); let o = 0; for (const c of chunks) { lz.set(c, o); o += c.length; }
      const idx = lzwDecode(lz, minCode, fw * fh);
      const before = gce.disposal === 3 ? sx.getImageData(0, 0, W, H) : null;
      const img = sx.getImageData(fx, fy, fw, fh), d = img.data;
      const rows = []; if (interlaced) { [[0, 8], [4, 8], [2, 4], [1, 2]].forEach(([s, st]) => { for (let y = s; y < fh; y += st) rows.push(y); }); } else for (let y = 0; y < fh; y++) rows.push(y);
      for (let k = 0; k < fh; k++) {
        const y = rows[k];
        for (let x = 0; x < fw; x++) {
          const c = idx[k * fw + x]; if (c === gce.tIdx || !ct) continue;
          const i = (y * fw + x) * 4; d[i] = ct[c * 3]; d[i + 1] = ct[c * 3 + 1]; d[i + 2] = ct[c * 3 + 2]; d[i + 3] = 255;
        }
      }
      sx.putImageData(img, fx, fy);
      frames.push({ canvas: U.cloneCanvas(screen), delay: gce.delay });
      if (gce.disposal === 2) sx.clearRect(fx, fy, fw, fh);
      else if (gce.disposal === 3 && before) sx.putImageData(before, 0, 0);
      gce = { disposal: 0, delay: 100, tIdx: -1 };
    }
    return { width: W, height: H, frames };
  }

  /* ==================================================================
     BMP
     ================================================================== */
  function encodeBMP(canvas) {
    const W = canvas.width, H = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, W, H).data;
    let opaque = true; for (let i = 3; i < d.length; i += 4) if (d[i] < 255) { opaque = false; break; }
    const bpp = opaque ? 24 : 32, row = opaque ? (W * 3 + 3) & ~3 : W * 4, hdr = opaque ? 40 : 108, off = 14 + hdr, size = off + row * H;
    const w = new Writer(true, size + 16);
    w.ascii('BM').u32(size).u32(0).u32(off);
    w.u32(hdr).i32(W).i32(H).u16(1).u16(bpp).u32(opaque ? 0 : 3).u32(row * H).i32(2835).i32(2835).u32(0).u32(0);
    if (!opaque) { w.u32(0x00ff0000).u32(0x0000ff00).u32(0x000000ff).u32(0xff000000).ascii('BGRs').zeros(36).zeros(12); }
    for (let y = H - 1; y >= 0; y--) {
      const st = w.pos;
      for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; w.u8(d[i + 2]).u8(d[i + 1]).u8(d[i]); if (!opaque) w.u8(d[i + 3]); }
      while (w.pos - st < row) w.u8(0);
    }
    return new Blob([w.out()], { type: 'image/bmp' });
  }

  /* ==================================================================
     TIFF — gravação (sem compressão) e leitura (nenhuma, LZW, PackBits, Deflate)
     ================================================================== */
  function encodeTIFF(canvas, dpi = 72) {
    const W = canvas.width, H = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, W, H).data;
    let opaque = true; for (let i = 3; i < d.length; i += 4) if (d[i] < 255) { opaque = false; break; }
    const spp = opaque ? 3 : 4, n = W * H * spp;
    const px = new Uint8Array(n);
    for (let i = 0, j = 0; i < d.length; i += 4) { px[j++] = d[i]; px[j++] = d[i + 1]; px[j++] = d[i + 2]; if (!opaque) px[j++] = d[i + 3]; }
    const tags = [];
    const T = (tag, type, count, value) => tags.push({ tag, type, count, value });
    T(256, 4, 1, W); T(257, 4, 1, H); T(258, 3, spp, null); T(259, 3, 1, 1); T(262, 3, 1, 2); T(273, 4, 1, 0); T(277, 3, 1, spp);
    T(278, 4, 1, H); T(279, 4, 1, n); T(282, 5, 1, null); T(283, 5, 1, null); T(284, 3, 1, 1); T(296, 3, 1, 2); T(305, 2, 0, null);
    if (!opaque) T(338, 3, 1, 2);
    const software = 'Imaginarium\0'; tags.find((t) => t.tag === 305).count = software.length;
    const ifdOff = 8, ifdSize = 2 + tags.length * 12 + 4;
    let extra = ifdOff + ifdSize;
    const bpsOff = extra; extra += spp * 2;
    const xresOff = extra; extra += 8; const yresOff = extra; extra += 8;
    const swOff = extra; extra += software.length; if (extra % 2) extra++;
    const dataOff = extra;
    const w = new Writer(true, dataOff + n + 16);
    w.ascii('II').u16(42).u32(ifdOff);
    w.u16(tags.length);
    for (const t of tags) {
      w.u16(t.tag).u16(t.type).u32(t.count);
      if (t.tag === 258) { if (spp > 2) w.u32(bpsOff); else { w.u16(8).u16(8); } }
      else if (t.tag === 273) w.u32(dataOff);
      else if (t.tag === 282) w.u32(xresOff);
      else if (t.tag === 283) w.u32(yresOff);
      else if (t.tag === 305) w.u32(swOff);
      else if (t.type === 3) { w.u16(t.value).u16(0); }
      else w.u32(t.value);
    }
    w.u32(0);
    for (let i = 0; i < spp; i++) w.u16(8);
    w.u32(dpi).u32(1).u32(dpi).u32(1);
    w.ascii(software); w.pad(2);
    w.bytes(px);
    return new Blob([w.out()], { type: 'image/tiff' });
  }
  function unpackBits(src, outLen) {
    const out = new Uint8Array(outLen); let i = 0, o = 0;
    while (i < src.length && o < outLen) {
      const n = src[i] > 127 ? src[i] - 256 : src[i]; i++;
      if (n >= 0) { for (let k = 0; k <= n && o < outLen; k++) out[o++] = src[i++]; }
      else if (n !== -128) { const v = src[i++]; for (let k = 0; k < 1 - n && o < outLen; k++) out[o++] = v; }
    }
    return out;
  }
  function tiffLZW(src, outLen) {
    const out = new Uint8Array(outLen); let o = 0;
    let dict = [], codeLen = 9, bitPos = 0;
    const reset = () => { dict = []; for (let i = 0; i < 256; i++) dict[i] = [i]; dict[256] = null; dict[257] = null; codeLen = 9; };
    const read = () => { let v = 0; for (let i = 0; i < codeLen; i++) { const byte = src[(bitPos + i) >> 3]; if (byte === undefined) return 257; v = (v << 1) | ((byte >> (7 - ((bitPos + i) & 7))) & 1); } bitPos += codeLen; return v; };
    reset();
    let old = null;
    while (o < outLen) {
      const code = read();
      if (code === 257) break;
      if (code === 256) { reset(); const c = read(); if (c === 257) break; const s = dict[c]; for (const b of s) out[o++] = b; old = s; continue; }
      let s;
      if (code < dict.length && dict[code]) { s = dict[code]; if (old) dict.push(old.concat([s[0]])); }
      else { s = old.concat([old[0]]); dict.push(s); }
      for (const b of s) { if (o < outLen) out[o++] = b; }
      old = s;
      if (dict.length + 1 >= (1 << codeLen) && codeLen < 12) codeLen++;
    }
    return out;
  }
  async function decodeTIFF(buf) {
    const u = new Uint8Array(buf), le = u[0] === 0x49;
    const r = new Reader(u, le);
    r.skip(2); if (r.u16() !== 42) throw new Error('TIFF inválido (BigTIFF não é suportado)');
    r.seek(r.u32());
    const n = r.u16(), tags = {};
    const SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
    for (let i = 0; i < n; i++) {
      const tag = r.u16(), type = r.u16(), count = r.u32(), size = (SZ[type] || 1) * count;
      const at = size > 4 ? r.u32() : r.pos; const back = r.pos + (size > 4 ? 0 : 4);
      const rr = new Reader(u, le); rr.seek(at); const vals = [];
      for (let k = 0; k < Math.min(count, 1 << 20); k++) vals.push(type === 3 ? rr.u16() : type === 4 ? rr.u32() : type === 5 ? rr.u32() / (rr.u32() || 1) : type === 1 || type === 7 || type === 2 ? rr.u8() : type === 8 ? rr.i16() : type === 9 ? rr.i32() : type === 11 ? rr.f32() : type === 12 ? rr.f64() : rr.u8());
      tags[tag] = vals; r.seek(back);
    }
    const W = tags[256][0], H = tags[257][0], bps = (tags[258] || [1])[0], comp = (tags[259] || [1])[0], photo = (tags[262] || [2])[0], spp = (tags[277] || [1])[0], pred = (tags[317] || [1])[0], planar = (tags[284] || [1])[0];
    const extra = tags[338] ? tags[338][0] : 0;
    if (planar !== 1) throw new Error('TIFF planar não suportado');
    if (bps !== 8 && bps !== 16 && bps !== 1) throw new Error('TIFF de ' + bps + ' bits não suportado');
    const tiled = !!tags[322];
    const tw = tiled ? tags[322][0] : W, th = tiled ? tags[323][0] : (tags[278] || [H])[0];
    const offs = tiled ? tags[324] : tags[273], cnts = tiled ? tags[325] : tags[279];
    const bpp = (bps === 1 ? 1 : (bps / 8) * spp), rowBytes = bps === 1 ? Math.ceil((tw * spp) / 8) : tw * bpp;
    const img = new ImageData(W, H), d = img.data;
    const cmap = tags[320];
    const across = tiled ? Math.ceil(W / tw) : 1;
    for (let s = 0; s < offs.length; s++) {
      let raw = u.subarray(offs[s], offs[s] + cnts[s]);
      const need = rowBytes * th;
      if (comp === 5) raw = tiffLZW(raw, need);
      else if (comp === 32773) raw = unpackBits(raw, need);
      else if (comp === 8 || comp === 32946) raw = await inflate(raw);
      else if (comp !== 1) throw new Error('compressão TIFF ' + comp + ' não suportada');
      if (pred === 2 && bps === 8) for (let y = 0; y < th; y++) for (let x = spp; x < rowBytes; x++) raw[y * rowBytes + x] = (raw[y * rowBytes + x] + raw[y * rowBytes + x - spp]) & 255;
      const ox = tiled ? (s % across) * tw : 0, oy = tiled ? Math.floor(s / across) * th : s * th;
      for (let y = 0; y < th; y++) {
        const yy = oy + y; if (yy >= H) break;
        for (let x = 0; x < tw; x++) {
          const xx = ox + x; if (xx >= W) continue;
          const o = (yy * W + xx) * 4;
          const smp = (k) => { if (bps === 1) { const bit = x * spp + k; return (raw[y * rowBytes + (bit >> 3)] >> (7 - (bit & 7))) & 1 ? 255 : 0; } const i = y * rowBytes + x * bpp + k * (bps / 8); return bps === 16 ? (le ? raw[i + 1] : raw[i]) : raw[i]; };
          if (photo === 2) { d[o] = smp(0); d[o + 1] = smp(1); d[o + 2] = smp(2); d[o + 3] = spp > 3 ? smp(3) : 255; if (spp > 3 && extra === 1 && d[o + 3]) { const a = d[o + 3] / 255; d[o] /= a; d[o + 1] /= a; d[o + 2] /= a; } }
          else if (photo === 3 && cmap) { const v = smp(0), n3 = cmap.length / 3; d[o] = cmap[v] >> 8; d[o + 1] = cmap[n3 + v] >> 8; d[o + 2] = cmap[2 * n3 + v] >> 8; d[o + 3] = 255; }
          else if (photo === 5) { const c = smp(0), m = smp(1), yv = smp(2), k = smp(3); d[o] = 255 - Math.min(255, c + k); d[o + 1] = 255 - Math.min(255, m + k); d[o + 2] = 255 - Math.min(255, yv + k); d[o + 3] = 255; }
          else { let v = smp(0); if (photo === 0) v = 255 - v; d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = spp > 1 ? smp(1) : 255; }
        }
      }
    }
    const c = U.createCanvas(W, H); c.getContext('2d').putImageData(img, 0, 0);
    return c;
  }

  /* ==================================================================
     ICO (PNG embutido) e TGA
     ================================================================== */
  async function encodeICO(canvas, sizes = [16, 24, 32, 48, 64, 128, 256]) {
    const imgs = [];
    for (const s of sizes) {
      const c = U.createCanvas(s, s), x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
      const k = Math.min(s / canvas.width, s / canvas.height), w = canvas.width * k, h = canvas.height * k;
      x.drawImage(canvas, (s - w) / 2, (s - h) / 2, w, h);
      imgs.push({ s, data: await toBytes(await U.toBlob(c, 'image/png')) });
    }
    const w = new Writer(true, 1024);
    w.u16(0).u16(1).u16(imgs.length);
    let off = 6 + imgs.length * 16;
    for (const im of imgs) { w.u8(im.s >= 256 ? 0 : im.s).u8(im.s >= 256 ? 0 : im.s).u8(0).u8(0).u16(1).u16(32).u32(im.data.length).u32(off); off += im.data.length; }
    return new Blob([w.out(), ...imgs.map((i) => i.data)], { type: 'image/x-icon' });
  }
  function encodeTGA(canvas, rle = true) {
    const W = canvas.width, H = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, W, H).data;
    const w = new Writer(true, W * H * 4 + 64);
    w.u8(0).u8(0).u8(rle ? 10 : 2).zeros(5).u16(0).u16(0).u16(W).u16(H).u8(32).u8(0x28);
    const px = (i) => [d[i + 2], d[i + 1], d[i], d[i + 3]];
    if (!rle) { for (let i = 0; i < d.length; i += 4) { const p = px(i); w.u8(p[0]).u8(p[1]).u8(p[2]).u8(p[3]); } }
    else for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        const i = (y * W + x) * 4; let run = 1;
        while (x + run < W && run < 128 && d[i] === d[i + run * 4] && d[i + 1] === d[i + run * 4 + 1] && d[i + 2] === d[i + run * 4 + 2] && d[i + 3] === d[i + run * 4 + 3]) run++;
        if (run > 1) { w.u8(0x80 | (run - 1)); const p = px(i); w.u8(p[0]).u8(p[1]).u8(p[2]).u8(p[3]); x += run; continue; }
        let n = 1;
        while (x + n < W && n < 128) { const j = (y * W + x + n) * 4; if (j + 4 < (y + 1) * W * 4 && d[j] === d[j + 4] && d[j + 1] === d[j + 5] && d[j + 2] === d[j + 6] && d[j + 3] === d[j + 7]) break; n++; }
        w.u8(n - 1); for (let k = 0; k < n; k++) { const p = px(i + k * 4); w.u8(p[0]).u8(p[1]).u8(p[2]).u8(p[3]); }
        x += n;
      }
    }
    w.zeros(8).ascii('TRUEVISION-XFILE.').u8(0);
    return new Blob([w.out()], { type: 'image/x-tga' });
  }
  function decodeTGA(buf) {
    const r = new Reader(buf, true);
    const idLen = r.u8(), cmType = r.u8(), type = r.u8(), cmStart = r.u16(), cmLen = r.u16(), cmBits = r.u8();
    r.skip(4); const W = r.u16(), H = r.u16(), bpp = r.u8(), desc = r.u8();
    r.skip(idLen);
    let cmap = null; if (cmType) { const bpe = Math.ceil(cmBits / 8); cmap = r.bytes(cmLen * bpe); void cmStart; }
    const rle = type >= 9, base = type & 7, Bpp = bpp / 8, n = W * H;
    const raw = new Uint8Array(n * Bpp);
    if (!rle) raw.set(r.bytes(n * Bpp));
    else { let o = 0; while (o < raw.length && r.left > 0) { const h = r.u8(), cnt = (h & 127) + 1; if (h & 128) { const v = r.bytes(Bpp); for (let k = 0; k < cnt; k++) { raw.set(v, o); o += Bpp; } } else { raw.set(r.bytes(cnt * Bpp), o); o += cnt * Bpp; } } }
    const img = new ImageData(W, H), d = img.data, top = !!(desc & 0x20), right = !!(desc & 0x10), aBits = desc & 15;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sy = top ? y : H - 1 - y, sxx = right ? W - 1 - x : x, i = (sy * W + sxx) * Bpp, o = (y * W + x) * 4;
      if (base === 1 && cmap) { const e = raw[i], bpe = Math.ceil(cmBits / 8); d[o] = cmap[e * bpe + 2]; d[o + 1] = cmap[e * bpe + 1]; d[o + 2] = cmap[e * bpe]; d[o + 3] = bpe === 4 ? cmap[e * bpe + 3] : 255; }
      else if (base === 3) { d[o] = d[o + 1] = d[o + 2] = raw[i]; d[o + 3] = Bpp > 1 ? raw[i + 1] : 255; }
      else if (Bpp === 2) { const v = raw[i] | (raw[i + 1] << 8); d[o] = ((v >> 10) & 31) * 8.226; d[o + 1] = ((v >> 5) & 31) * 8.226; d[o + 2] = (v & 31) * 8.226; d[o + 3] = 255; }
      else { d[o] = raw[i + 2]; d[o + 1] = raw[i + 1]; d[o + 2] = raw[i]; d[o + 3] = Bpp === 4 && aBits ? raw[i + 3] : 255; }
    }
    const c = U.createCanvas(W, H); c.getContext('2d').putImageData(img, 0, 0);
    return c;
  }

  /* ==================================================================
     SVG (formas e texto como vetores; pixels como imagens)
     ================================================================== */
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  async function canvasURL(c) { const b = await U.toBlob(c, 'image/png'); return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }); }
  async function encodeSVG(doc, o = {}) {
    const defs = [], body = [];
    let gid = 0;
    const blendCSS = (L) => (L.blend && !['normal', 'pass'].includes(L.blend) ? ' style="mix-blend-mode:' + (['linear-burn', 'linear-dodge', 'vivid-light', 'linear-light', 'pin-light', 'hard-mix', 'darker-color', 'lighter-color', 'subtract', 'divide', 'dissolve'].includes(L.blend) ? 'normal' : L.blend) + '"' : '');
    const fillAttr = (f, b) => {
      if (!f) return 'none';
      if (f.type === 'solid') return f.color || '#000';
      if (f.type === 'gradient' && f.gradient) {
        const id = 'g' + gid++, g = f.gradient, a = U.rad(f.angle == null ? 90 : f.angle);
        const stops = (g.colors || []).map((s) => '<stop offset="' + U.round(s.t, 4) + '" stop-color="' + (s.c === 'fg' ? IMG.app.fg : s.c === 'bg' ? IMG.app.bg : s.c) + '"/>').join('');
        if (f.style === 'radial') defs.push('<radialGradient id="' + id + '" cx="' + (b.x + b.w / 2) + '" cy="' + (b.y + b.h / 2) + '" r="' + Math.max(b.w, b.h) / 2 + '" gradientUnits="userSpaceOnUse">' + stops + '</radialGradient>');
        else { const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = (Math.abs(Math.cos(a)) * b.w + Math.abs(Math.sin(a)) * b.h) / 2; defs.push('<linearGradient id="' + id + '" x1="' + U.round(cx - Math.cos(a) * r, 2) + '" y1="' + U.round(cy + Math.sin(a) * r, 2) + '" x2="' + U.round(cx + Math.cos(a) * r, 2) + '" y2="' + U.round(cy - Math.sin(a) * r, 2) + '" gradientUnits="userSpaceOnUse">' + stops + '</linearGradient>'); }
        return 'url(#' + id + ')';
      }
      return '#808080';
    };
    const rendered = async (L) => {
      const b = U.rectIntersect(L.contentBounds() || doc.rect, U.rectInflate(doc.rect, 4000)); if (!b) return '';
      const D = new IMG.Doc({ name: 'x', width: doc.width, height: doc.height });
      const C2 = IMG.Layers.clone(L); C2.parent = null; C2.visible = true; C2.opacity = 1; C2.blend = L.type === 'group' ? 'pass' : 'normal'; C2.clip = false; D.layers = [C2];
      const flat = IMG.Engine.flatten(D);
      const R = U.rectIntersect(U.rectInt(U.rectInflate(b, 80)), doc.rect);
      if (!R) return '';
      const c = U.createCanvas(R.w, R.h); c.getContext('2d').drawImage(flat, -R.x, -R.y);
      return '<image x="' + R.x + '" y="' + R.y + '" width="' + R.w + '" height="' + R.h + '" href="' + (await canvasURL(c)) + '"' + (L.opacity < 1 ? ' opacity="' + U.round(L.opacity, 3) + '"' : '') + blendCSS(L) + '/>';
    };
    const textSVG = (L) => {
      const T = IMG.Text, t = T.normalize(L.text, L), lay = L._lay;
      if (!lay || !lay.lines || t.warp || t.onPath || t.orient === 'v') return null;
      const st0 = T.Model.styleAt(t, 0), m = t.m || [1, 0, 0, 1];
      const out = ['<text transform="matrix(' + [m[0], m[1], m[2], m[3], t.x, t.y].map((v) => U.round(v, 4)).join(' ') + ')" font-family="' + esc(st0.font) + '" font-size="' + U.round(st0.size, 2) + '" fill="' + st0.color + '"' + (st0.weight !== 400 ? ' font-weight="' + st0.weight + '"' : '') + (st0.italic ? ' font-style="italic"' : '') + (L.opacity < 1 ? ' opacity="' + U.round(L.opacity, 3) + '"' : '') + blendCSS(L) + ' xml:space="preserve">'];
      for (const ln of lay.lines) {
        if (ln.hidden) continue;
        let k = ln.a;
        while (k < ln.b) {
          const g0 = lay.glyphs[k]; let j = k + 1;
          while (j < ln.b && lay.glyphs[j].s === g0.s) j++;
          const s = g0.s, str = t.text.slice(k, j).replace(/\n/g, '');
          if (str) {
            const attrs = ' x="' + U.round(ln.xs[k - ln.a], 2) + '" y="' + U.round(ln.y - (g0.rise || 0), 2) + '"' +
              (s.font !== st0.font ? ' font-family="' + esc(s.font) + '"' : '') + (s.size !== st0.size ? ' font-size="' + U.round(g0.size || s.size, 2) + '"' : '') +
              (s.color !== st0.color ? ' fill="' + s.color + '"' : '') + (s.weight !== st0.weight ? ' font-weight="' + s.weight + '"' : '') + (s.italic !== st0.italic ? ' font-style="' + (s.italic ? 'italic' : 'normal') + '"' : '') +
              (s.tracking ? ' letter-spacing="' + U.round((s.tracking / 1000) * s.size, 2) + '"' : '') + (s.underline || s.strike ? ' text-decoration="' + [s.underline ? 'underline' : '', s.strike ? 'line-through' : ''].join(' ').trim() + '"' : '');
            out.push('<tspan' + attrs + '>' + esc(s.caps === 'all' ? str.toUpperCase() : str) + '</tspan>');
          }
          k = j;
        }
      }
      out.push('</text>');
      return out.join('');
    };
    const walk = async (list, into) => {
      for (const L of list) {
        if (!L.visible) continue;
        const fx = IMG.Effects && IMG.Effects.active && IMG.Effects.active(L);
        const masked = (L.mask && L.mask.enabled !== false) || L.clip;
        if (L.type === 'group' && !fx && !masked && !L.artboard) {
          const inner = []; await walk(L.children, inner);
          into.push('<g id="' + esc(L.name) + '"' + (L.opacity < 1 ? ' opacity="' + U.round(L.opacity, 3) + '"' : '') + blendCSS(L) + '>' + inner.join('') + '</g>');
          continue;
        }
        if (L.type === 'shape' && !fx && !masked && IMG.Shapes && IMG.Paths && IMG.Paths.toSVG) {
          const s = IMG.Shapes.normalize(L.shape), b = L.contentBounds() || doc.rect, d = IMG.Paths.toSVG(s.path);
          const st = s.stroke && s.stroke.on ? ' stroke="' + fillAttr(s.stroke.fill, b) + '" stroke-width="' + s.stroke.width + '" stroke-linecap="' + (s.stroke.cap || 'butt') + '" stroke-linejoin="' + (s.stroke.join || 'miter') + '"' + (s.stroke.dash ? ' stroke-dasharray="' + s.stroke.dash.map((v) => v * s.stroke.width).join(' ') + '"' : '') : '';
          const op = L.opacity * (L.fill == null ? 1 : L.fill);
          into.push('<path d="' + d + '" fill="' + fillAttr(s.fill, b) + '" fill-rule="' + (s.path.rule === 'evenodd' ? 'evenodd' : 'nonzero') + '"' + st + (op < 1 ? ' opacity="' + U.round(op, 3) + '"' : '') + blendCSS(L) + '/>');
          continue;
        }
        if (L.type === 'text' && !fx && !masked && o.textAsText !== false) { const t = textSVG(L); if (t) { into.push(t); continue; } }
        if (L.type === 'adjust') continue;
        into.push(await rendered(L));
      }
    };
    await walk(doc.layers, body);
    const svg = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + doc.width + '" height="' + doc.height + '" viewBox="0 0 ' + doc.width + ' ' + doc.height + '">\n' + (defs.length ? '<defs>' + defs.join('') + '</defs>\n' : '') + body.join('\n') + '\n</svg>\n';
    return new Blob([svg], { type: 'image/svg+xml' });
  }

  IMG.Formats = { Writer, Reader, crc32, inflate, deflate, toBytes, zip, quantize, mapToPalette, encodeGIF, decodeGIF, encodeBMP, encodeTIFF, decodeTIFF, encodeICO, encodeTGA, decodeTGA, encodeSVG, unpackBits };
})();
