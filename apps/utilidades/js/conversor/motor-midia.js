/* ==========================================================================
   Utilidades — Conversor: motor de ÁUDIO e VÍDEO (1.0)
   Usa o FFmpeg (versão WebAssembly de um só núcleo), carregado só quando preciso:
   pasta libs/conversor → cópia guardada no navegador → download (com consentimento).
   Limites: roda no seu computador, sem aceleração de placa de vídeo; vídeos longos/pesados demoram e
   arquivos acima de ~1 GB podem não caber na memória do navegador. Sem codificadores proprietários
   (HEVC/H.265 de saída, Dolby, DTS, ProRes etc.).
   ========================================================================== */
(function () {
  'use strict';
  const { T } = UT, CV = UT.CV, FMT = CV.FMT;
  const AUDIO = ['mp3', 'wav', 'ogg', 'opus', 'flac', 'aac', 'm4a', 'wma', 'aiff', 'ac3', 'mp2', 'amr', 'mka', 'au', 'caf'];
  const VIDEO = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'flv', 'wmv', 'mpg', '3gp', 'ogv', 'ts', 'm4v'];
  const AUD_SAI = AUDIO.filter(x => FMT[x] && FMT[x].sai), VID_SAI = VIDEO.filter(x => FMT[x] && FMT[x].sai);
  const LIMITE = 1.5 * 1024 * 1024 * 1024;

  const CODIGO = `
    let core = null, atual = 0, logs = [];
    self.onmessage = async e => {
      const d = e.data;
      try {
        if (d.cmd === 'init') {
          importScripts(d.js);
          core = await self.createFFmpegCore({ mainScriptUrlOrBlob: d.js + '#' + btoa(JSON.stringify({ wasmURL: d.wasm, workerURL: d.js })) });
          core.setLogger(m => { logs.push(m.message); if (logs.length > 40) logs.shift(); });
          core.setProgress(p => { if (atual) postMessage({ id: atual, prog: Math.max(0, Math.min(1, p.progress || 0)) }); });
          postMessage({ id: d.id, ok: true });
        } else if (d.cmd === 'run') {
          atual = d.id; logs = [];
          core.FS.writeFile(d.entrada, new Uint8Array(d.bytes));
          core.setTimeout(-1);
          core.exec(...d.args);
          const ret = core.ret; core.reset();
          let saida = null;
          try { saida = core.FS.readFile(d.saida); } catch (x) { saida = null; }
          try { core.FS.unlink(d.entrada); } catch (x) {}
          try { core.FS.unlink(d.saida); } catch (x) {}
          atual = 0;
          if (ret !== 0 || !saida || !saida.length) { postMessage({ id: d.id, ok: false, erro: logs.slice(-6).join(' | ') || ('código ' + ret) }); return; }
          const copia = saida.slice();
          postMessage({ id: d.id, ok: true, bytes: copia.buffer }, [copia.buffer]);
        }
      } catch (err) { atual = 0; postMessage({ id: d.id, ok: false, erro: String(err && err.message || err) }); }
    };`;
  let ff = null;
  async function motor(ctx) {
    if (ff) return ff;
    const urls = await CV.motorWeb('ffmpeg', (p, t) => ctx && ctx.progresso(p * 0.25, t));
    const w = CV.worker(CODIGO);
    try { await w.chamar({ cmd: 'init', js: urls.js, wasm: urls.wasm }); }
    catch (e) { w.parar(); throw new Error(T('O componente FFmpeg não iniciou: {1}', e.message)); }
    ff = w; return w;
  }

  const AUD = { mp3: ['libmp3lame', 'mp3'], ogg: ['libvorbis', 'ogg'], opus: ['libopus', 'ogg'], flac: ['flac', 'flac'], aac: ['aac', 'adts'], m4a: ['aac', 'ipod'], wma: ['wmav2', 'asf'], aiff: ['pcm_s16be', 'aiff'], ac3: ['ac3', 'ac3'], mp2: ['mp2', 'mp2'], mka: ['libvorbis', 'matroska'], au: ['pcm_s16be', 'au'], wav: ['pcm_s16le', 'wav'] };
  const COM_BITRATE = new Set(['mp3', 'ogg', 'opus', 'aac', 'm4a', 'wma', 'ac3', 'mp2', 'mka']);
  // vídeo: [codec de vídeo, codec de áudio, formato do contêiner]
  const VID = { mp4: ['libx264', 'aac', 'mp4'], mov: ['libx264', 'aac', 'mov'], m4v: ['libx264', 'aac', 'ipod'], mkv: ['libx264', 'aac', 'matroska'], webm: ['libvpx', 'libopus', 'webm'], avi: ['mpeg4', 'libmp3lame', 'avi'], flv: ['flv', 'libmp3lame', 'flv'], wmv: ['wmv2', 'wmav2', 'asf'], mpg: ['mpeg2video', 'mp2', 'mpeg'], '3gp': ['libx264', 'aac', '3gp'], ogv: ['libtheora', 'libvorbis', 'ogg'] };
  const Q = { alta: 0, media: 1, baixa: 2 };

  function argsAudio(para, o, temVideo) {
    const [c, f] = AUD[para], a = [];
    if (temVideo) a.push('-vn');
    a.push('-map_metadata', '-1', '-c:a', c);
    if (COM_BITRATE.has(para) && o.taxa && o.taxa !== 'auto') a.push('-b:a', o.taxa + 'k');
    if (o.amostragem && o.amostragem !== 'auto') a.push('-ar', o.amostragem);
    if (o.canais && o.canais !== 'auto') a.push('-ac', o.canais);
    if (o.volume && +o.volume !== 100) a.push('-af', 'volume=' + (+o.volume / 100));
    if (para === 'flac' && o.nivel != null) a.push('-compression_level', '5');
    if (para === 'opus' || (para === 'mka' && false)) a.push('-compression_level', '3'); // acima de 4 o libopus estéreo derruba o FFmpeg WebAssembly
    a.push('-f', f);
    return a;
  }
  function argsVideo(para, o, temAudio) {
    const [cv, ca, f] = VID[para], q = Q[o.qualidade] != null ? Q[o.qualidade] : 1, a = [];
    const filtros = [];
    if (o.altura && o.altura !== 'auto') filtros.push("scale=-2:'min(" + o.altura + ",ih)'");
    else if (cv === 'libx264' || cv === 'libvpx' || cv === 'mpeg4' || cv === 'mpeg2video' || cv === 'wmv2' || cv === 'libtheora') filtros.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');
    if (o.fps && o.fps !== 'auto') filtros.push('fps=' + o.fps);
    if (filtros.length) a.push('-vf', filtros.join(','));
    a.push('-c:v', cv);
    if (cv === 'libx264') a.push('-preset', 'veryfast', '-crf', String([20, 24, 29][q]), '-pix_fmt', 'yuv420p');
    else if (cv === 'libvpx') a.push('-b:v', ['4M', '2M', '1M'][q], '-crf', String([10, 16, 24][q]), '-deadline', 'realtime', '-cpu-used', '5', '-pix_fmt', 'yuv420p'); // VP8: o VP9 derruba o FFmpeg WebAssembly
    else if (cv === 'libtheora') a.push('-q:v', String([8, 6, 4][q]));
    else a.push('-q:v', String([3, 5, 8][q]));
    if (cv === 'mpeg2video') a.push('-pix_fmt', 'yuv420p');
    if (!temAudio || o.semAudio) a.push('-an');
    else { a.push('-c:a', ca, '-b:a', '128k', '-ac', '2'); if (ca === 'libopus') a.push('-compression_level', '3'); }
    if (['mp4', 'mov', 'm4v', '3gp'].includes(para)) a.push('-movflags', '+faststart');
    a.push('-map_metadata', '-1', '-f', f);
    return a;
  }
  const argsGif = o => ['-vf', 'fps=' + (o.fps && o.fps !== 'auto' ? o.fps : 12) + ',scale=' + (o.largura || 480) + ":-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4", '-loop', '0', '-f', 'gif'];

  CV.motor({
    id: 'midia',
    pesado: () => 'ffmpeg',
    rotas(de) {
      if (AUDIO.includes(de)) return AUD_SAI.filter(x => x !== de);
      if (VIDEO.includes(de)) return [...AUD_SAI, ...VID_SAI.filter(x => x !== de), 'gif'];
      if (de === 'gif') return VID_SAI.filter(x => ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(x));
      return [];
    },
    opcoes(de, para) {
      const o = [];
      if (AUD[para]) {
        if (COM_BITRATE.has(para)) o.push({ id: 'taxa', tipo: 'lista', rot: 'Qualidade (taxa de bits)', pad: 'auto', opcoes: [['auto', 'Automática'], ['320', '320 kbps (máxima)'], ['256', '256 kbps'], ['192', '192 kbps'], ['128', '128 kbps'], ['96', '96 kbps'], ['64', '64 kbps (menor arquivo)']] });
        o.push({ id: 'amostragem', tipo: 'lista', rot: 'Frequência de amostragem', pad: 'auto', opcoes: [['auto', 'Manter a original'], ['48000', '48 kHz'], ['44100', '44,1 kHz'], ['22050', '22,05 kHz'], ['16000', '16 kHz']] },
          { id: 'canais', tipo: 'lista', rot: 'Canais', pad: 'auto', opcoes: [['auto', 'Manter os originais'], ['1', 'Mono'], ['2', 'Estéreo']] },
          { id: 'volume', tipo: 'numero', rot: 'Volume (%)', pad: 100, min: 10, max: 400 });
      } else if (para === 'gif') {
        o.push({ id: 'largura', tipo: 'numero', rot: 'Largura (px)', pad: 480, min: 64, max: 1280 }, { id: 'fps', tipo: 'lista', rot: 'Quadros por segundo', pad: '12', opcoes: [['8', '8'], ['12', '12'], ['15', '15'], ['24', '24']] });
      } else if (VID[para]) {
        o.push({ id: 'qualidade', tipo: 'lista', rot: 'Qualidade', pad: 'media', opcoes: [['alta', 'Alta (arquivo maior)'], ['media', 'Média'], ['baixa', 'Baixa (arquivo menor)']] },
          { id: 'altura', tipo: 'lista', rot: 'Altura do vídeo', pad: 'auto', opcoes: [['auto', 'Manter a original'], ['1080', '1080p'], ['720', '720p'], ['480', '480p'], ['360', '360p'], ['240', '240p']] },
          { id: 'fps', tipo: 'lista', rot: 'Quadros por segundo', pad: 'auto', opcoes: [['auto', 'Manter os originais'], ['30', '30'], ['24', '24'], ['15', '15']] });
        if (de !== 'gif') o.push({ id: 'semAudio', tipo: 'caixa', rot: 'Remover o áudio', pad: false });
      }
      return o;
    },
    async converter(ctx) {
      const { arquivo: f, de, para, opcoes: o, nomeBase } = ctx;
      if (f.size > LIMITE) throw new Error(T('Este arquivo é grande demais para o navegador (limite de cerca de 1,5 GB). Reduza o arquivo antes ou use um programa instalado, como o FFmpeg.'));
      const w = await motor(ctx);
      CV.checar(ctx);
      ctx.progresso(0.27, T('Lendo o arquivo…'));
      const ext = (/\.([a-z0-9]+)$/i.exec(f.name || '') || [])[1] || FMT[de].exts[0], ent = 'entrada.' + ext.toLowerCase().replace(/[^a-z0-9]/g, ''), sai = 'saida.' + CV.ext(para);
      const bytes = (await f.arrayBuffer());
      const ehVideoEnt = VIDEO.includes(de) || de === 'gif';
      let args = ['-i', ent];
      if (AUD[para]) args = args.concat(argsAudio(para, o, ehVideoEnt));
      else if (para === 'gif') args = args.concat(argsGif(o));
      else args = args.concat(argsVideo(para, o, VIDEO.includes(de)));
      args.push('-y', sai);
      const vigia = setInterval(() => { if (ctx.cancelado()) { clearInterval(vigia); w.parar(); ff = null; } }, 300);
      let r;
      try {
        r = await w.chamar({ cmd: 'run', entrada: ent, saida: sai, args, bytes }, [bytes], p => ctx.progresso(0.3 + p * 0.68, T('Convertendo… {1}%', Math.round(p * 100))));
      } catch (e) { if (e.cancelado) throw e; ff = null; try { w.parar(); } catch (x) { /* já parado */ } throw new Error(/memory|abort|OOM/i.test(e.message) ? T('O navegador ficou sem memória para este arquivo. Tente um arquivo menor ou uma qualidade mais baixa.') : T('Não foi possível converter este arquivo: {1}', e.message.slice(0, 220))); }
      finally { clearInterval(vigia); }
      CV.checar(ctx);
      return [{ blob: CV.blob(r.bytes, para), nome: CV.nomeSaida(nomeBase, para) }];
    }
  });
})();
