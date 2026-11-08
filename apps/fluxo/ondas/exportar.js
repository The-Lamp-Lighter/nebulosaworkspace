/* ==========================================================================
   Fluxo › Ondas — exportar.js (1.1)
   Grava a cena em vídeo WebM (VP8 ou VP9 + áudio Opus), no próprio navegador.

   Caminho principal: WebCodecs (VideoEncoder / AudioEncoder) + um empacotador WebM
   próprio, escrito aqui. Vantagem: não é em tempo real (um vídeo de 3 minutos pode sair
   em menos de 3 minutos) e o arquivo já sai com a duração certa.

   Caminho de reserva (navegador sem WebCodecs): MediaRecorder em tempo real, com a
   duração corrigida no final (o MediaRecorder grava WebM sem duração).
   ========================================================================== */
(function () {
  'use strict';
  var FO = window.FluxoOndas = window.FluxoOndas || {};

  /* ------------------------------------------------------ EBML / WebM */
  function vintSize(n) {      /* tamanho em 8 bytes: simples e sempre válido */
    var b = new Uint8Array(8); b[0] = 1;
    for (var i = 7; i >= 1; i--) { b[i] = n % 256; n = Math.floor(n / 256); }
    return b;
  }
  function idBytes(id) { var a = []; while (id > 0) { a.unshift(id & 255); id = Math.floor(id / 256); } return new Uint8Array(a); }
  function junta(parts) {
    var tot = 0, i, o, p = 0;
    for (i = 0; i < parts.length; i++) tot += parts[i].length;
    o = new Uint8Array(tot);
    for (i = 0; i < parts.length; i++) { o.set(parts[i], p); p += parts[i].length; }
    return o;
  }
  function el(id, dados) {
    if (Array.isArray(dados)) dados = junta(dados);
    return junta([idBytes(id), vintSize(dados.length), dados]);
  }
  function uint(id, v) {
    var a = []; if (v === 0) a = [0]; while (v > 0) { a.unshift(v % 256); v = Math.floor(v / 256); }
    return el(id, new Uint8Array(a));
  }
  function flt(id, v) { var b = new ArrayBuffer(8); new DataView(b).setFloat64(0, v, false); return el(id, new Uint8Array(b)); }
  function str(id, s) { var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 127; return el(id, a); }

  function opusHead(canais, taxa, preSkip) {
    var b = new Uint8Array(19), dv = new DataView(b.buffer);
    b.set([79, 112, 117, 115, 72, 101, 97, 100], 0); b[8] = 1; b[9] = canais;
    dv.setUint16(10, preSkip, true); dv.setUint32(12, taxa, true); dv.setInt16(16, 0, true); b[18] = 0;
    return b;
  }

  /* chunks: [{tipo:'v'|'a', us, dur, dados:Uint8Array, chave:bool}] */
  function montarWebm(chunks, info) {
    var i, durMs = info.duracaoUs / 1000;
    chunks.sort(function (a, b) { return a.us - b.us || (a.tipo === 'v' ? -1 : 1); });
    var cab = el(0x1A45DFA3, [uint(0x4286, 1), uint(0x42F7, 1), uint(0x42F2, 4), uint(0x42F3, 8), str(0x4282, 'webm'), uint(0x4287, 4), uint(0x4285, 2)]);
    var infoEl = el(0x1549A966, [uint(0x2AD7B1, 1000000), flt(0x4489, durMs), str(0x4D80, 'Nebulosa Fluxo'), str(0x5741, 'Nebulosa Fluxo Ondas')]);
    var faixas = [el(0xAE, [uint(0xD7, 1), uint(0x73C5, 1), uint(0x83, 1), str(0x86, info.codecVideo === 'vp9' ? 'V_VP9' : 'V_VP8'),
      el(0xE0, [uint(0xB0, info.larg), uint(0xBA, info.alt)])])];
    if (info.audio) faixas.push(el(0xAE, [uint(0xD7, 2), uint(0x73C5, 2), uint(0x83, 2), str(0x86, 'A_OPUS'), el(0x63A2, opusHead(2, 48000, info.preSkip)),
      uint(0x56AA, Math.round(info.preSkip / 48000 * 1e9)), uint(0x56BB, 80000000),
      el(0xE1, [flt(0xB5, 48000), uint(0x9F, 2), uint(0x6264, 32)])]));
    var tracks = el(0x1654AE6B, faixas);
    /* clusters: um novo a cada quadro-chave de vídeo (e a cada 5 s no máximo) */
    var clusters = [], cues = [], offset = infoEl.length + tracks.length, atual = null;
    function fecha() { if (!atual) return; var cl = el(0x1F43B675, [uint(0xE7, atual.ini)].concat(atual.blocos)); atual.bytes = cl; atual.pos = offset; offset += cl.length; clusters.push(atual); if (atual.cue) cues.push(atual); atual = null; }
    for (i = 0; i < chunks.length; i++) {
      var c = chunks[i], ms = Math.round(c.us / 1000);
      if (!atual || (c.tipo === 'v' && c.chave) || ms - atual.ini > 5000 || ms - atual.ini > 30000) { fecha(); atual = { ini: ms, blocos: [], cue: c.tipo === 'v' && c.chave }; }
      var rel = Math.max(0, Math.min(32767, ms - atual.ini)), cabBloco = new Uint8Array([0x80 | (c.tipo === 'v' ? 1 : 2), rel >> 8, rel & 255, c.chave ? 0x80 : 0]);
      atual.blocos.push(el(0xA3, junta([cabBloco, c.dados])));
    }
    fecha();
    var cuesEl = el(0x1C53BB6B, cues.map(function (cl) { return el(0xBB, [uint(0xB3, cl.ini), el(0xB7, [uint(0xF7, 1), uint(0xF1, cl.pos)])]); }));
    var corpo = [infoEl, tracks]; clusters.forEach(function (cl) { corpo.push(cl.bytes); }); corpo.push(cuesEl);
    var tam = 0; corpo.forEach(function (p) { tam += p.length; });
    return new Blob([cab, idBytes(0x18538067), vintSize(tam)].concat(corpo), { type: 'video/webm' });
  }

  /* ---------------------------------------------------------- Áudio */
  async function audio48(buf, t0, t1) {
    var sr = 48000, n = Math.max(1, Math.round((t1 - t0) * sr));
    var oc = new OfflineAudioContext(2, n, sr), src = oc.createBufferSource();
    src.buffer = buf; src.connect(oc.destination); src.start(0, t0, t1 - t0);
    return oc.startRendering();
  }

  FO.suportaWebCodecs = function () { return typeof VideoEncoder === 'function' && typeof VideoFrame === 'function' && typeof AudioEncoder === 'function'; };

  async function escolherCodec(prefer, w, h, fps, bitrate) {
    var lista = prefer === 'vp9' ? [['vp9', 'vp09.00.10.08'], ['vp8', 'vp8']] : [['vp8', 'vp8'], ['vp9', 'vp09.00.10.08']];
    for (var i = 0; i < lista.length; i++) {
      try {
        var cfg = { codec: lista[i][1], width: w, height: h, bitrate: bitrate, framerate: fps };
        var r = await VideoEncoder.isConfigSupported(cfg);
        if (r && r.supported) return { id: lista[i][0], cfg: cfg };
      } catch (e) { /* tenta o próximo */ }
    }
    return null;
  }

  /* opc: {larg, alt, fps, codec:'vp8'|'vp9', bitrate (bps), inicio, fim, audio:true}
     cb: {progresso(f,texto), cancelado()} → devolve Blob (video/webm) */
  FO.exportarWebCodecs = async function (cena, buf, an, opc, cb) {
    var M = FO.motor, W = opc.larg & ~1, H = opc.alt & ~1, fps = opc.fps;
    var t0 = Math.max(0, opc.inicio || 0), t1 = Math.min(buf.duration, opc.fim || buf.duration), dur = t1 - t0;
    if (dur <= 0.05) throw new Error('trecho vazio');
    var cod = await escolherCodec(opc.codec, W, H, fps, opc.bitrate);
    if (!cod) throw new Error('nenhum codec de vídeo disponível');
    var chunks = [], erro = null, preSkip = 312;
    var venc = new VideoEncoder({ output: function (ch) { var d = new Uint8Array(ch.byteLength); ch.copyTo(d); chunks.push({ tipo: 'v', us: ch.timestamp, dur: ch.duration || 0, dados: d, chave: ch.type === 'key' }); }, error: function (e) { erro = e; } });
    venc.configure(cod.cfg);
    var aenc = null;
    if (opc.audio !== false) {
      aenc = new AudioEncoder({ output: function (ch) { var d = new Uint8Array(ch.byteLength); ch.copyTo(d); chunks.push({ tipo: 'a', us: ch.timestamp, dur: ch.duration || 0, dados: d, chave: true }); }, error: function (e) { erro = e; } });
      aenc.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 });
    }
    var cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H;
    var ctx = cvs.getContext('2d'), rend = new M.Render(); rend.definirFundoImagem(cena.fundo.tipo === 'imagem' ? cena.fundo.imagem : '');
    if (FO.copiarImagens) FO.copiarImagens(rend);
    an.reiniciar();
    var total = Math.round(dur * fps), dt = 1 / fps, i, k;
    /* desenha uma vez só para disparar o carregamento das imagens e espera um pouco */
    an.passo(t0, dt); rend.desenhar(ctx, cena, an, { W: W, H: H, t: 0, dt: dt, dur: dur }); rend.reiniciar(); an.reiniciar();
    await new Promise(function (r) { setTimeout(r, 400); });
    for (i = 0; i < total; i++) {
      if (cb.cancelado && cb.cancelado()) { venc.close(); if (aenc) aenc.close(); throw new Error('cancelado'); }
      if (erro) throw erro;
      var t = t0 + i * dt;
      an.passo(t, dt);
      rend.desenhar(ctx, cena, an, { W: W, H: H, t: t - t0, dt: dt, dur: dur });
      var vf = new VideoFrame(cvs, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      venc.encode(vf, { keyFrame: i % (fps * 2) === 0 }); vf.close();
      while (venc.encodeQueueSize > 8) await new Promise(function (r) { setTimeout(r, 3); });
      if (i % 3 === 0) { cb.progresso && cb.progresso(i / total * (aenc ? 0.93 : 0.97), i + ' / ' + total); await new Promise(function (r) { setTimeout(r, 0); }); }
    }
    await venc.flush(); venc.close();
    if (aenc) {
      cb.progresso && cb.progresso(0.94, 'áudio');
      var pcm = await audio48(buf, t0, t1), L = pcm.getChannelData(0), R = pcm.numberOfChannels > 1 ? pcm.getChannelData(1) : L, passo = 48000;
      for (k = 0; k < L.length; k += passo) {
        var n = Math.min(passo, L.length - k), plano = new Float32Array(n * 2);
        plano.set(L.subarray(k, k + n), 0); plano.set(R.subarray(k, k + n), n);
        var ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(k / 48000 * 1e6), data: plano });
        aenc.encode(ad); ad.close();
        while (aenc.encodeQueueSize > 8) await new Promise(function (r) { setTimeout(r, 3); });
      }
      await aenc.flush(); aenc.close();
    }
    if (erro) throw erro;
    cb.progresso && cb.progresso(0.99, 'arquivo');
    return montarWebm(chunks, { larg: W, alt: H, codecVideo: cod.id, audio: !!aenc, preSkip: preSkip, duracaoUs: dur * 1e6 });
  };

  /* ------------------------------------------- Reserva: MediaRecorder */
  function lerVint(b, p, manterMarca) {
    var f = b[p], n = 1, m = 0x80;
    while (n <= 8 && !(f & m)) { n++; m >>= 1; }
    var v = manterMarca ? f : (f & (m - 1)), desconhecido = (f & (m - 1)) === (m - 1);
    for (var i = 1; i < n; i++) { v = v * 256 + b[p + i]; if (b[p + i] !== 255) desconhecido = false; }
    return { v: v, n: n, desc: desconhecido };
  }
  /* o MediaRecorder grava WebM sem duração: põe o campo Duration na seção Info */
  FO.corrigirDuracaoWebm = async function (blob, durMs) {
    var b = new Uint8Array(await blob.arrayBuffer()), p = 0, id = lerVint(b, p, true);
    p += id.n; var sz = lerVint(b, p, false); p += sz.n + sz.v;          /* pula o cabeçalho EBML */
    id = lerVint(b, p, true); if (id.v !== 0x18538067) return blob;
    var segIni = p; p += id.n; var segSz = lerVint(b, p, false), segSzPos = p; p += segSz.n; var corpoIni = p;
    while (p < Math.min(b.length, corpoIni + 4096)) {
      id = lerVint(b, p, true); var s2 = lerVint(b, p + id.n, false), ini = p + id.n + s2.n;
      if (id.v === 0x1549A966) {
        var info = b.subarray(ini, ini + s2.v), tem = false, q = 0;
        while (q < info.length) { var i2 = lerVint(info, q, true), s3 = lerVint(info, q + i2.n, false); if (i2.v === 0x4489) tem = true; q += i2.n + s3.n + s3.v; }
        if (tem) return blob;
        var novoInfo = el(0x1549A966, [info, flt(0x4489, durMs)]);
        var delta = novoInfo.length - (id.n + s2.n + s2.v);
        var pre = b.slice(0, p), pos = b.subarray(ini + s2.v);
        if (!segSz.desc) { var ns = segSz.v + delta; for (var z = segSz.n - 1; z >= 0; z--) { pre[segSzPos + z] = ns % 256; ns = Math.floor(ns / 256); } pre[segSzPos] = (pre[segSzPos] & ((0x80 >> (segSz.n - 1)) - 1)) | (0x80 >> (segSz.n - 1)); }
        return new Blob([pre, novoInfo, pos], { type: 'video/webm' });
      }
      p = ini + s2.v;
    }
    return blob;
  };

  /* grava em tempo real (mais lento: dura o tempo do trecho) */
  FO.exportarGravador = async function (cena, buf, an, opc, cb) {
    var M = FO.motor, W = opc.larg & ~1, H = opc.alt & ~1, fps = opc.fps;
    var t0 = Math.max(0, opc.inicio || 0), t1 = Math.min(buf.duration, opc.fim || buf.duration), dur = t1 - t0;
    var cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H;
    var ctx = cvs.getContext('2d'), rend = new M.Render(); rend.definirFundoImagem(cena.fundo.tipo === 'imagem' ? cena.fundo.imagem : '');
    if (FO.copiarImagens) FO.copiarImagens(rend);
    var ac = new (window.AudioContext || window.webkitAudioContext)(), dest = ac.createMediaStreamDestination(), src = ac.createBufferSource();
    src.buffer = buf; src.connect(dest);
    var fluxo = cvs.captureStream(fps); if (opc.audio !== false) dest.stream.getAudioTracks().forEach(function (t) { fluxo.addTrack(t); });
    var mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].filter(function (m) { return MediaRecorder.isTypeSupported(m); })[0];
    var rec = new MediaRecorder(fluxo, { mimeType: mime, videoBitsPerSecond: opc.bitrate }), partes = [];
    rec.ondataavailable = function (e) { if (e.data.size) partes.push(e.data); };
    var fim = new Promise(function (r) { rec.onstop = r; });
    an.reiniciar(); rec.start(500); src.start(0, t0, dur); var ini = ac.currentTime, ult = 0;
    await new Promise(function (resolve) {
      (function laco() {
        var t = ac.currentTime - ini;
        if ((cb.cancelado && cb.cancelado()) || t >= dur) return resolve();
        var dt = Math.max(1 / 120, t - ult); ult = t;
        an.passo(t0 + t, dt); rend.desenhar(ctx, cena, an, { W: W, H: H, t: t, dt: dt, dur: dur });
        cb.progresso && cb.progresso(t / dur, Math.floor(t) + ' s');
        requestAnimationFrame(laco);
      })();
    });
    rec.stop(); await fim; try { src.stop(); } catch (e) { } ac.close();
    if (cb.cancelado && cb.cancelado()) throw new Error('cancelado');
    return FO.corrigirDuracaoWebm(new Blob(partes, { type: 'video/webm' }), dur * 1000);
  };
})();
