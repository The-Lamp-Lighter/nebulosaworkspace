/* ==========================================================================
   FotoFlow — app.js
   Aplicação principal: projeto, biblioteca de mídias, análise das fotos,
   player de preview, painel de propriedades, modelos e geração automática.
   Autor do software: Márcio Willians Barreto de Andrade
   Estrutura pensada para futura migração a Electron/Tauri: toda a lógica
   vive no objeto global FF, sem depender de servidor.
   ========================================================================== */
(function (FF) {
  'use strict';
  const E = FF.Engine, TP = FF.Templates;
  const clamp = E.clamp;

  /* ---------- Utilidades de interface ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const uid = p => p + Math.random().toString(36).slice(2, 9);
  const clone = o => JSON.parse(JSON.stringify(o));

  function el(tag, attrs, kids) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids || []).forEach(c => { if (c != null) n.append(c.nodeType ? c : document.createTextNode(c)); });
    return n;
  }
  function fmtTime(t) {
    t = Math.max(0, t || 0);
    const m = Math.floor(t / 60), s = Math.floor(t % 60), d = Math.floor((t % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${d}`;
  }
  function download(blob, name) {
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  let toastTimer = null;
  function toast(msg, kind) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, 3800);
  }
  const readAs = (file, how) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result); r.onerror = () => rej(r.error);
    how === 'text' ? r.readAsText(file) : r.readAsDataURL(file);
  });
  const loadImage = src => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = () => rej(new Error('Não foi possível abrir a imagem.'));
    i.src = src;
  });

  FF.util = { $, $$, uid, clone, el, fmtTime, download, toast, readAs, loadImage };

  /* ---------- Estado ---------- */
  const ASPECTS = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:3': [1440, 1080] };
  const state = FF.state = { project: null, sel: null, time: 0, playing: false, pps: 60, volume: 1, suggestion: null, pick: null };

  /* Cache de mídias decodificadas (as imagens ficam fora do JSON do projeto em uso). */
  FF.media = {
    images: {}, audioEls: {},
    image(id) { return this.images[id] || null; }
  };

  function newProject(tplId) {
    const tpl = TP.get(tplId || 'familia');
    return {
      formato: 'FotoFlow.Projeto', versao: 1,
      name: 'Meu filme', author: '',
      aspect: '16:9', width: 1920, height: 1080, fps: 30,
      templateId: tpl.id, palette: clone(tpl.palette), look: clone(tpl.look), fadeEdges: true,
      style: tpl.style || 'classico', board: clone(tpl.board),
      media: {}, mediaOrder: [], scenes: [], texts: [], audio: []
    };
  }

  /* ==========================================================================
     ANÁLISE DAS FOTOS (offline)
     Encontra o ponto de interesse para o Ken Burns e extrai pistas de cor
     usadas na sugestão de modelo. Usa o detector de rostos do navegador
     quando existir; caso contrário, uma estimativa por contraste e tons de pele.
     ========================================================================== */
  function analyze(source) {
    const N = 64, c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(source, 0, 0, N, N);
    const d = g.getImageData(0, 0, N, N).data;
    const luma = new Float32Array(N * N), bonus = new Float32Array(N * N);
    const st = { skin: 0, blue: 0, green: 0, white: 0, dark: 0, warm: 0, sat: 0, faces: 0 };
    for (let i = 0; i < N * N; i++) {
      const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), v = mx / 255, s = mx ? (mx - mn) / mx : 0;
      let h = 0;
      if (mx !== mn) {
        if (mx === r) h = ((gg - b) / (mx - mn)) % 6; else if (mx === gg) h = (b - r) / (mx - mn) + 2; else h = (r - gg) / (mx - mn) + 4;
        h = (h * 60 + 360) % 360;
      }
      const skin = r > 95 && gg > 40 && b > 20 && mx - mn > 15 && Math.abs(r - gg) > 15 && r > gg && r > b && s < 0.68;
      if (skin) st.skin++;
      if (h > 185 && h < 255 && s > 0.22 && v > 0.3) st.blue++;
      if (h > 70 && h < 165 && s > 0.22 && v > 0.2) st.green++;
      if (v > 0.86 && s < 0.14) st.white++;
      if (v < 0.2) st.dark++;
      if ((h < 50 || h > 330) && s > 0.3 && v > 0.3) st.warm++;
      st.sat += s;
      luma[i] = 0.299 * r + 0.587 * gg + 0.114 * b;
      bonus[i] = s * 30 + (skin ? 70 : 0);
    }
    Object.keys(st).forEach(k => { if (k !== 'faces') st[k] /= N * N; });
    // Mapa de destaque: bordas (contraste local) + saturação + pele, com leve preferência pelo centro.
    let sx = 0, sy = 0, sw = 0;
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      const grad = Math.abs(luma[i + 1] - luma[i - 1]) + Math.abs(luma[i + N] - luma[i - N]);
      const cx = (x / N - 0.5), cy = (y / N - 0.5);
      const center = 1 - Math.min(1, Math.hypot(cx, cy) * 1.2);
      const w = Math.pow((grad + bonus[i]) * (0.5 + center), 2);
      sx += x * w; sy += y * w; sw += w;
    }
    const focus = sw ? { x: clamp(sx / sw / N, 0.22, 0.78), y: clamp(sy / sw / N, 0.22, 0.78) } : { x: 0.5, y: 0.5 };
    return { stats: st, focus };
  }

  /* Detector de rostos nativo (existe em alguns navegadores baseados em Chromium). */
  async function detectFaces(media, img) {
    if (!('FaceDetector' in window)) return;
    try {
      const faces = await new window.FaceDetector({ fastMode: true, maxDetectedFaces: 8 }).detect(img);
      if (!faces.length) return;
      let sx = 0, sy = 0, sw = 0;
      faces.forEach(f => {
        const b = f.boundingBox, w = b.width * b.height;
        sx += (b.x + b.width / 2) * w; sy += (b.y + b.height / 2) * w; sw += w;
      });
      media.stats.faces = faces.length;
      media.focus = { x: clamp(sx / sw / img.naturalWidth, 0.15, 0.85), y: clamp(sy / sw / img.naturalHeight, 0.15, 0.85) };
      media.focusSource = 'rosto';
    } catch (e) { /* detector indisponível: fica a estimativa por destaque */ }
  }

  /* ==========================================================================
     IMPORTAÇÃO DE MÍDIAS
     ========================================================================== */
  const MAX_SIDE = 2560;   // lado maior das fotos guardadas no projeto

  async function importImage(file) {
    const raw = await readAs(file);
    const img = await loadImage(raw);
    let w = img.naturalWidth || 1920, h = img.naturalHeight || 1080;      // SVG pode vir sem tamanho
    const k = Math.min(1, MAX_SIDE / Math.max(w, h));
    w = Math.round(w * k); h = Math.round(h * k);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);                         // fundo para PNG/SVG transparentes
    g.drawImage(img, 0, 0, w, h);
    const src = c.toDataURL('image/jpeg', 0.9);
    const tw = 320, th = Math.round(320 * h / w);
    const tc = document.createElement('canvas');
    tc.width = tw; tc.height = th;
    tc.getContext('2d').drawImage(c, 0, 0, tw, th);
    const a = analyze(c);
    const media = { id: uid('m'), type: 'image', name: file.name, src, thumb: tc.toDataURL('image/jpeg', 0.72), w, h,
      stats: a.stats, focus: a.focus, focusSource: 'destaque' };
    const final = await loadImage(src);
    FF.media.images[media.id] = final;
    await detectFaces(media, final);
    return media;
  }

  async function importAudio(file) {
    const src = await readAs(file);
    const duration = await new Promise(res => {
      const a = new Audio();
      a.preload = 'metadata';
      a.onloadedmetadata = () => res(isFinite(a.duration) ? a.duration : 0);
      a.onerror = () => res(0);
      a.src = src;
    });
    if (!duration) throw new Error(`O navegador não conseguiu ler o áudio "${file.name}".`);
    return { id: uid('a'), type: 'audio', name: file.name, src, duration };
  }

  async function importFiles(files) {
    const p = state.project;
    let ok = 0, fail = 0;
    setBusy('Importando mídias…');
    for (const file of Array.from(files)) {
      const isImg = /^image\//.test(file.type) || /\.(jpe?g|png|webp|svg)$/i.test(file.name);
      const isAud = /^audio\//.test(file.type) || /\.(mp3|wav|aac|m4a|ogg)$/i.test(file.name);
      try {
        if (!isImg && !isAud) throw new Error('formato não aceito');
        const m = isImg ? await importImage(file) : await importAudio(file);
        p.media[m.id] = m; p.mediaOrder.push(m.id); ok++;
      } catch (e) { fail++; console.warn('Falha ao importar', file.name, e); }
    }
    setBusy(null);
    updateSuggestion();
    renderLibrary(); renderTemplates();
    toast(fail ? `${ok} arquivo(s) importado(s); ${fail} não puderam ser lidos.` : `${ok} arquivo(s) importado(s).`, fail ? 'warn' : '');
  }

  function updateSuggestion() {
    const list = state.project.mediaOrder.map(id => state.project.media[id]);
    state.suggestion = TP.suggest(list);
  }

  function setBusy(msg) {
    const b = $('#busy');
    b.hidden = !msg; if (msg) $('#busyText').textContent = msg;
  }

  /* ==========================================================================
     SUPERFÍCIE PRÓPRIA PARA O ESTILO MURAL
     A imagem importada é ajustada automaticamente ao formato que o motor usa:
     1. recorte central em quadrado;  2. redução para 512 px;
     3. cor e contraste suavizados, para as fotos e as molduras se destacarem;
     4. espelhamento em quatro quadrantes, formando um azulejo de 1024 px que
        se repete sem emendas;  5. gravação em JPEG leve, para caber no modelo.
     ========================================================================== */
  async function adjustSurface(file) {
    const img = await loadImage(await readAs(file));
    const iw = img.naturalWidth || 1024, ih = img.naturalHeight || 1024, side = Math.min(iw, ih), Hf = 512, N = 1024;
    const half = document.createElement('canvas');
    half.width = half.height = Hf;
    const hg = half.getContext('2d');
    hg.fillStyle = '#ffffff'; hg.fillRect(0, 0, Hf, Hf);
    if (E.SUPPORTS_FILTER) hg.filter = 'saturate(0.88) contrast(0.92)';
    hg.drawImage(img, (iw - side) / 2, (ih - side) / 2, side, side, 0, 0, Hf, Hf);
    const tile = document.createElement('canvas');
    tile.width = tile.height = N;
    const g = tile.getContext('2d');
    [[0, 0, 1, 1], [N, 0, -1, 1], [0, N, 1, -1], [N, N, -1, -1]].forEach(q => {
      g.save(); g.translate(q[0], q[1]); g.scale(q[2], q[3]); g.drawImage(half, 0, 0); g.restore();
    });
    const url = tile.toDataURL('image/jpeg', 0.82);
    E.registerTile(url, tile);
    return url;
  }
  let surfaceCallback = null;
  /* Abre o seletor de arquivo e devolve a imagem já ajustada. */
  function pickSurface(cb) { surfaceCallback = cb; $('#fileSurface').click(); }
  /* Controles de superfície compartilhados pelo painel do projeto e pelo editor de modelos. */
  function surfaceControls(board, onChange) {
    const apply = url => { board.image = url; board.surface = 'imagem'; onChange(true); toast('Superfície importada e ajustada: recortada, suavizada e preparada para repetir sem emendas.'); };
    return [
      F.select('Superfície', E.SURFACES.map(s => [s.id, s.label]), board.surface || 'madeira', v => {
        if (v === 'imagem' && !board.image) { pickSurface(apply); onChange(true); return; }
        board.surface = v; onChange(false);
      }),
      board.image ? el('img', { class: 'surface-preview', src: board.image, alt: 'Superfície importada' }) : null,
      el('div', { class: 'btn-row' }, [F.button(board.image ? 'Trocar imagem da superfície' : 'Importar imagem de superfície', () => pickSurface(apply))])
    ];
  }

  /* ==========================================================================
     AÇÕES SOBRE O PROJETO
     ========================================================================== */
  /* Escolhe o movimento de câmera de uma cena conforme o modelo e a foto. */
  function autoCamera(i, media, tpl) {
    let type = tpl.cameras[i % tpl.cameras.length];
    const portrait = media && media.h > media.w * 1.15;
    if (portrait && ['panH', 'travelling', 'orbit'].includes(type)) type = 'panV';
    const k = tpl.kenBurns.intensity, f = media ? clone(media.focus) : { x: 0.5, y: 0.5 };
    const cam = { type, intensity: k, dir: i % 2 ? -1 : 1, focus: f, auto: true };
    if (type === 'kenburns') {
      const z = 0.12 + 0.36 * k, v = i % 3;
      const opp = { x: clamp(1 - f.x, 0.25, 0.75), y: clamp(1 - f.y, 0.3, 0.7) };
      if (v === 0) cam.kb = { from: { x: 0.5, y: 0.5, z: 1.03 }, to: { x: f.x, y: f.y, z: 1.03 + z } };
      else if (v === 1) cam.kb = { from: { x: f.x, y: f.y, z: 1.05 + z }, to: { x: 0.5, y: 0.5, z: 1.03 } };
      else cam.kb = { from: { x: opp.x, y: opp.y, z: 1.12 + z * 0.4 }, to: { x: f.x, y: f.y, z: 1.14 + z * 0.8 } };
    }
    return cam;
  }

  /* Tempos do estilo Mural, medidos no vídeo de referência: voo de 1,7 s (0,85 s rápido + acomodação)
     e fusão curta no lugar. */
  const MURAL = { flight: 1.7, fade: 0.5, minScene: 3.8, scene: 5.5 };

  /* Transição da cena i conforme o estilo do filme (clássico ou mural). */
  function sceneTransition(i, tpl, trDur) {
    if (state.project && state.project.style === 'mural') {
      const seq = tpl.boardTransitions && tpl.boardTransitions.length ? tpl.boardTransitions : ['voo'];
      const type = seq[i % seq.length];
      return { type, duration: type === 'voo' ? MURAL.flight : MURAL.fade, dir: i % 2 ? -1 : 1 };
    }
    return { type: tpl.transitions[i % tpl.transitions.length], duration: trDur || tpl.rhythm.transition, dir: i % 2 ? -1 : 1 };
  }

  function makeScene(media, i, tpl, duration, trDur) {
    const mural = state.project && state.project.style === 'mural';
    return {
      id: uid('s'), mediaId: media ? media.id : null,
      duration: duration || (mural ? Math.max(MURAL.scene, tpl.rhythm.scene) : tpl.rhythm.scene), fit: tpl.layout || 'cover', filter: '',
      camera: autoCamera(i, media, tpl),
      transition: sceneTransition(i, tpl, trDur)
    };
  }

  const DEFAULT_TEXT = {
    title: ['Título do filme', 4.5], subtitle: ['Um subtítulo para acompanhar', 4], caption: ['Legenda desta foto', 3.5],
    phrase: ['Uma frase de impacto', 3.5], credits: ['Créditos finais\nFotos e edição: seu nome', 6]
  };
  const KIND_LABEL = { title: 'Título', subtitle: 'Subtítulo', caption: 'Legenda', phrase: 'Frase de impacto', credits: 'Créditos finais' };

  function makeText(kind, text, start, duration) {
    const tpl = TP.get(state.project.templateId);
    const style = clone(tpl.text[kind] || tpl.text.caption);
    return Object.assign({ id: uid('t'), kind, text: text || DEFAULT_TEXT[kind][0], start: Math.max(0, start),
      duration: duration || DEFAULT_TEXT[kind][1] }, style);
  }

  const actions = {
    addScene(mediaId, index) {
      const p = state.project, tpl = TP.get(p.templateId), media = p.media[mediaId];
      const i = index == null ? p.scenes.length : index;
      const sc = makeScene(media, i, tpl);
      p.scenes.splice(i, 0, sc);
      select({ type: 'scene', id: sc.id });
      return sc;
    },
    addText(kind) {
      const tx = makeText(kind, null, state.time);
      state.project.texts.push(tx);
      select({ type: 'text', id: tx.id });
    },
    addAudio(mediaId, kind) {
      const p = state.project, m = p.media[mediaId];
      kind = kind || (p.audio.some(a => a.kind === 'music') ? 'narration' : 'music');
      const clip = { id: uid('c'), mediaId, kind, start: kind === 'music' ? 0 : state.time, offset: 0, duration: m.duration,
        volume: kind === 'music' ? 0.8 : 1, fadeIn: kind === 'music' ? 1.5 : 0.2, fadeOut: kind === 'music' ? 3 : 0.3 };
      p.audio.push(clip);
      select({ type: 'audio', id: clip.id });
    },
    moveScene(from, to) {
      const sc = state.project.scenes;
      if (from === to || from < 0 || to < 0 || from >= sc.length) return;
      const [item] = sc.splice(from, 1);
      sc.splice(Math.min(to, sc.length), 0, item);
      refresh();
    },
    removeSelected() {
      const p = state.project, s = state.sel;
      if (!s) return;
      if (s.type === 'scene' || s.type === 'transition') p.scenes = p.scenes.filter(x => x.id !== s.id);
      if (s.type === 'text') p.texts = p.texts.filter(x => x.id !== s.id);
      if (s.type === 'audio') { stopAudioEl(s.id); p.audio = p.audio.filter(x => x.id !== s.id); }
      select(null);
    },
    duplicateSelected() {
      const p = state.project, s = state.sel;
      if (!s) return;
      if (s.type === 'scene') {
        const i = p.scenes.findIndex(x => x.id === s.id), c = clone(p.scenes[i]);
        c.id = uid('s'); p.scenes.splice(i + 1, 0, c); select({ type: 'scene', id: c.id });
      } else if (s.type === 'text') {
        const o = p.texts.find(x => x.id === s.id), c = clone(o);
        c.id = uid('t'); c.start = o.start + o.duration; p.texts.push(c); select({ type: 'text', id: c.id });
      } else if (s.type === 'audio') {
        const o = p.audio.find(x => x.id === s.id), c = clone(o);
        c.id = uid('c'); c.start = o.start + o.duration; p.audio.push(c); select({ type: 'audio', id: c.id });
      }
    },
    removeMedia(id) {
      const p = state.project;
      p.scenes = p.scenes.filter(s => s.mediaId !== id);
      p.audio.filter(a => a.mediaId === id).forEach(a => stopAudioEl(a.id));
      p.audio = p.audio.filter(a => a.mediaId !== id);
      delete p.media[id]; delete FF.media.images[id];
      p.mediaOrder = p.mediaOrder.filter(x => x !== id);
      updateSuggestion(); select(null); renderLibrary(); renderTemplates();
    },
    /* Aplica um modelo: troca cores e acabamento e refaz transições, câmeras e estilos de texto. */
    applyTemplate(id, quiet) {
      const p = state.project, tpl = TP.get(id), prev = TP.get(p.templateId);
      p.templateId = tpl.id; p.palette = clone(tpl.palette); p.look = clone(tpl.look);
      adoptAspect(tpl, prev);
      // O modelo "Mural de Fotos" liga o estilo Mural; ao sair dele, volta-se ao clássico.
      if (tpl.style === 'mural') p.style = 'mural'; else if (prev.style === 'mural' && prev.id !== tpl.id) p.style = 'classico';
      p.board = clone(tpl.board || { surface: 'madeira', decor: 'flores', tilt: 0.5 });
      p.scenes.forEach((sc, i) => {
        const m = p.media[sc.mediaId];
        sc.camera = autoCamera(i, m, tpl);
        sc.fit = tpl.layout || 'cover';
        sc.transition = sceneTransition(i, tpl);
        if (p.style === 'mural') sc.duration = Math.max(sc.duration, MURAL.minScene);
      });
      p.texts.forEach(tx => {
        const keep = { id: tx.id, kind: tx.kind, text: tx.text, start: tx.start, duration: tx.duration };
        Object.keys(tx).forEach(k => delete tx[k]);
        Object.assign(tx, keep, clone(tpl.text[keep.kind] || tpl.text.caption));
      });
      renderTemplates(); refresh(true);
      if (!quiet) toast(`Modelo "${tpl.name}" aplicado.`);
    }
  };

  /* Troca entre o estilo clássico (tela cheia) e o Mural, refazendo as transições. */
  function setStyle(style) {
    const p = state.project, tpl = TP.get(p.templateId);
    p.style = style === 'mural' ? 'mural' : 'classico';
    if (!p.board) p.board = clone(tpl.board || { surface: 'madeira', decor: 'flores', tilt: 0.5 });
    p.scenes.forEach((sc, i) => {
      sc.transition = sceneTransition(i, tpl);
      if (p.style === 'mural') sc.duration = Math.max(sc.duration, MURAL.minScene);
    });
    refresh(true);
  }

  function setAspect(a) {
    const p = state.project, s = ASPECTS[a] || ASPECTS['16:9'];
    p.aspect = a; p.width = s[0]; p.height = s[1];
    fitCanvas();
  }

  /* Modelos com formato próprio (ex.: Redes Sociais, vertical) ajustam o filme; ao sair deles, volta-se a 16:9. */
  function adoptAspect(tpl, prev) {
    const p = state.project;
    if (tpl.aspect && ASPECTS[tpl.aspect]) setAspect(tpl.aspect);
    else if (prev && prev.aspect && p.aspect === prev.aspect) setAspect('16:9');
  }

  function findSel() {
    const p = state.project, s = state.sel;
    if (!s) return null;
    if (s.type === 'scene' || s.type === 'transition') return p.scenes.find(x => x.id === s.id);
    if (s.type === 'text') return p.texts.find(x => x.id === s.id);
    if (s.type === 'audio') return p.audio.find(x => x.id === s.id);
    return null;
  }
  function select(sel) {
    state.sel = sel; state.pick = null;
    refresh(true);
  }

  /* ==========================================================================
     PLAYER DE PREVIEW
     ========================================================================== */
  let canvas, ctx, lastTick = 0, rafId = 0;

  function total() { return E.schedule(state.project).total; }

  /* O preview usa 2/3 da resolução final para manter a fluidez; a exportação usa a resolução cheia. */
  function fitCanvas(scale) {
    const p = state.project, k = scale || 2 / 3;
    canvas.width = Math.round(p.width * k / 2) * 2;
    canvas.height = Math.round(p.height * k / 2) * 2;
    draw();
  }
  function draw() {
    E.render(ctx, state.project, state.time);
    $('#timeLabel').textContent = `${fmtTime(state.time)} / ${fmtTime(total())}`;
    $('#emptyStage').hidden = state.project.scenes.length > 0 || state.project.texts.length > 0;
  }
  function seek(t, keepPlaying) {
    state.time = clamp(t, 0, Math.max(0, total()));
    if (!keepPlaying && !state.playing) pauseAllAudio();
    draw(); FF.Timeline.setPlayhead();
    if (state.playing) syncAudio(true);
  }
  function tick(now) {
    if (!state.playing) return;
    const dt = Math.min(0.25, (now - lastTick) / 1000);
    lastTick = now;
    state.time += dt;
    const tot = total();
    if (state.time >= tot) {
      state.time = tot; draw(); FF.Timeline.setPlayhead(); pause();
      if (FF.App.onEnded) FF.App.onEnded();
      return;
    }
    draw(); syncAudio(); FF.Timeline.setPlayhead();
    rafId = requestAnimationFrame(tick);
  }
  function play() {
    if (state.playing) return;
    if (total() <= 0) { toast('Adicione fotos à linha do tempo para reproduzir.', 'warn'); return; }
    if (state.time >= total() - 0.05) state.time = 0;
    state.playing = true; lastTick = performance.now();
    $('#btnPlay').classList.add('is-playing'); $('#btnPlay').setAttribute('aria-label', 'Pausar');
    syncAudio(true);
    rafId = requestAnimationFrame(tick);
  }
  function pause() {
    state.playing = false; cancelAnimationFrame(rafId);
    $('#btnPlay').classList.remove('is-playing'); $('#btnPlay').setAttribute('aria-label', 'Reproduzir');
    pauseAllAudio();
  }
  function stop() { pause(); seek(0); }

  /* ---------- Áudio sincronizado com a linha do tempo ---------- */
  function audioEl(clip) {
    let a = FF.media.audioEls[clip.id];
    if (!a) {
      const m = state.project.media[clip.mediaId];
      if (!m) return null;
      a = new Audio(m.src); a.preload = 'auto';
      FF.media.audioEls[clip.id] = a;
      if (FF.Export && FF.Export.attachAudio) FF.Export.attachAudio(a);
    }
    return a;
  }
  function stopAudioEl(id) { const a = FF.media.audioEls[id]; if (a) { a.pause(); delete FF.media.audioEls[id]; } }
  function pauseAllAudio() { Object.values(FF.media.audioEls).forEach(a => { if (!a.paused) a.pause(); }); }
  function syncAudio(force) {
    state.project.audio.forEach(c => {
      const a = audioEl(c);
      if (!a) return;
      const local = state.time - c.start, inside = local >= 0 && local < c.duration;
      if (state.playing && inside) {
        const want = local + (c.offset || 0);
        if (a.paused) { try { a.currentTime = want; } catch (e) {} a.play().catch(() => {}); }
        else if (force || Math.abs(a.currentTime - want) > 0.35) { try { a.currentTime = want; } catch (e) {} }
        const fi = c.fadeIn > 0 ? clamp(local / c.fadeIn) : 1, fo = c.fadeOut > 0 ? clamp((c.duration - local) / c.fadeOut) : 1;
        a.volume = clamp(c.volume * state.volume * Math.min(fi, fo));
      } else if (!a.paused) a.pause();
    });
  }

  /* ==========================================================================
     BIBLIOTECA DE MÍDIAS
     ========================================================================== */
  function renderLibrary() {
    const p = state.project, grid = $('#mediaGrid'), alist = $('#audioList');
    grid.innerHTML = ''; alist.innerHTML = '';
    const all = p.mediaOrder.map(id => p.media[id]);
    const imgs = all.filter(m => m.type === 'image'), auds = all.filter(m => m.type === 'audio');
    $('#libEmpty').hidden = all.length > 0;
    $('#libCounts').textContent = all.length ? `${imgs.length} foto(s), ${auds.length} áudio(s)` : '';
    imgs.forEach(m => {
      const used = p.scenes.filter(s => s.mediaId === m.id).length;
      const item = el('div', { class: 'media-item', draggable: 'true', title: `${m.name}\nClique para adicionar à linha do tempo`,
        ondragstart: e => { e.dataTransfer.setData('text/fotoflow-media', m.id); e.dataTransfer.effectAllowed = 'copy'; },
        onclick: () => actions.addScene(m.id) }, [
        el('img', { src: m.thumb, alt: m.name, draggable: 'false' }),
        used ? el('span', { class: 'media-used', text: used + '×' }) : null,
        el('button', { class: 'media-del', title: 'Remover da biblioteca', 'aria-label': 'Remover ' + m.name,
          onclick: e => { e.stopPropagation(); actions.removeMedia(m.id); } }, '×')
      ]);
      grid.append(item);
    });
    auds.forEach(m => {
      alist.append(el('div', { class: 'audio-item', draggable: 'true',
        ondragstart: e => { e.dataTransfer.setData('text/fotoflow-media', m.id); } }, [
        el('span', { class: 'audio-name', text: m.name, title: m.name }),
        el('span', { class: 'audio-dur', text: fmtTime(m.duration).slice(0, 5) }),
        el('button', { class: 'chip', title: 'Usar como música de fundo', onclick: () => actions.addAudio(m.id, 'music') }, 'Música'),
        el('button', { class: 'chip', title: 'Usar como narração na posição atual', onclick: () => actions.addAudio(m.id, 'narration') }, 'Narração'),
        el('button', { class: 'chip', title: 'Usar como efeito sonoro na posição atual', onclick: () => actions.addAudio(m.id, 'sfx') }, 'Efeito'),
        el('button', { class: 'media-del static', title: 'Remover da biblioteca', onclick: () => actions.removeMedia(m.id) }, '×')
      ]));
    });
  }

  /* ==========================================================================
     MODELOS (lista, sugestão e editor)
     ========================================================================== */
  function renderTemplates() {
    const p = state.project, grid = $('#tplGrid'), box = $('#suggestBox');
    grid.innerHTML = '';
    const sug = state.suggestion;
    box.hidden = !sug;
    if (sug) {
      box.innerHTML = '';
      box.append(el('div', {}, [el('strong', { text: 'Sugestão para suas fotos: ' + TP.get(sug.id).name }), el('span', { class: 'muted', text: ' (' + sug.reason + ')' })]),
        el('button', { class: 'btn small', onclick: () => actions.applyTemplate(sug.id) }, 'Usar este modelo'));
    }
    TP.all().forEach(t => {
      const pal = t.palette;
      grid.append(el('div', { class: 'tpl-card' + (p.templateId === t.id ? ' active' : ''), tabindex: '0', role: 'button',
        onclick: () => actions.applyTemplate(t.id), onkeydown: e => { if (e.key === 'Enter') actions.applyTemplate(t.id); } }, [
        el('div', { class: 'tpl-swatch', style: { background: `linear-gradient(120deg, ${pal.bg} 0 34%, ${pal.primary} 34% 67%, ${pal.accent} 67% 100%)` } }, [
          el('span', { text: 'Aa', style: { fontFamily: TP.FONTS[t.fonts.title], color: pal.text } })]),
        el('div', { class: 'tpl-info' }, [
          el('div', { class: 'tpl-name', text: t.name + (sug && sug.id === t.id ? ' · sugerido' : '') }),
          el('div', { class: 'tpl-desc', text: t.description || '' })]),
        el('button', { class: 'chip', title: t.builtin ? 'Criar uma cópia editável deste modelo' : 'Editar este modelo',
          onclick: e => { e.stopPropagation(); openTemplateEditor(t.builtin ? TP.duplicate(t.id) : t); } }, t.builtin ? 'Duplicar' : 'Editar')
      ]));
    });
  }

  const LOOK_PRESETS = { 'Natural': '', 'Vívido': 'saturate(1.2) contrast(1.06)', 'Quente': 'saturate(1.08) sepia(0.12)',
    'Preto e branco': 'grayscale(1) contrast(1.05)', 'Sépia': 'sepia(0.55) saturate(0.9)', 'Suave': 'brightness(1.05) saturate(0.9)' };

  let editing = null;
  function openTemplateEditor(tpl) {
    editing = clone(tpl);
    const body = $('#tplForm'); body.innerHTML = '';
    const t = editing;
    t.board = Object.assign({ surface: 'madeira', decor: 'flores', tilt: 0.5 }, t.board);
    // Recria só os controles de superfície quando a imagem muda (sem perder o resto do formulário).
    const refreshTplSurface = rebuild => { if (!rebuild) return; const host = $('#tplSurface'); host.innerHTML = ''; host.append(...surfaceControls(t.board, refreshTplSurface).filter(Boolean)); };
    const optsFonts = Object.keys(TP.FONTS).map(k => [k, k]);
    const refont = () => {
      const keep = {}; ['title', 'subtitle', 'caption', 'phrase', 'credits'].forEach(k => { keep[k] = t.text[k].anim; });
      t.text = TP.textStyles(t.fonts.title, t.fonts.body, t.palette.text, t.palette.accent,
        { titleAnim: keep.title, captionAnim: keep.caption, phraseAnim: keep.phrase });
    };
    const checks = (label, list, arr) => F.group(label, [el('div', { class: 'check-grid' }, list.filter(x => x.id !== 'none').map(x =>
      el('label', { class: 'check' }, [el('input', { type: 'checkbox', checked: arr.includes(x.id) || null,
        onchange: e => { if (e.target.checked) arr.push(x.id); else { const i = arr.indexOf(x.id); if (i >= 0 && arr.length > 1) arr.splice(i, 1); else e.target.checked = true; } } }), x.label])))]);
    const presetName = Object.keys(LOOK_PRESETS).find(k => LOOK_PRESETS[k] === (t.look.filter || '')) || 'Personalizado';
    body.append(
      F.group('Identidade', [
        F.text('Nome do modelo', t.name, v => { t.name = v; }),
        F.text('Descrição', t.description || '', v => { t.description = v; }),
        el('div', { class: 'row4' }, [
          F.color('Fundo', t.palette.bg, v => { t.palette.bg = v; }), F.color('Principal', t.palette.primary, v => { t.palette.primary = v; }),
          F.color('Destaque', t.palette.accent, v => { t.palette.accent = v; refont(); }), F.color('Texto', t.palette.text, v => { t.palette.text = v; refont(); })])
      ]),
      F.group('Fontes e textos', [
        F.select('Fonte dos títulos', optsFonts, t.fonts.title, v => { t.fonts.title = v; refont(); }),
        F.select('Fonte dos textos', optsFonts, t.fonts.body, v => { t.fonts.body = v; refont(); }),
        F.select('Animação dos títulos', E.TEXT_ANIMS.map(a => [a.id, a.label]), t.text.title.anim, v => { t.text.title.anim = v; }),
        F.select('Animação das legendas', E.TEXT_ANIMS.map(a => [a.id, a.label]), t.text.caption.anim, v => { t.text.caption.anim = v; })
      ]),
      checks('Transições usadas', E.TRANSITIONS, t.transitions),
      checks('Movimentos de câmera', E.CAMERAS, t.cameras),
      F.group('Ritmo e Ken Burns', [
        F.range('Duração de cada foto', 1.5, 12, 0.5, t.rhythm.scene, v => { t.rhythm.scene = v; }, v => v + ' s'),
        F.range('Duração das transições', 0.2, 4, 0.1, t.rhythm.transition, v => { t.rhythm.transition = v; }, v => v + ' s'),
        F.range('Intensidade do Ken Burns', 0, 1, 0.05, t.kenBurns.intensity, v => { t.kenBurns.intensity = v; }, v => Math.round(v * 100) + '%'),
        F.select('Enquadramento das fotos', [['cover', 'Preencher a tela'], ['contain', 'Foto inteira com fundo desfocado']], t.layout || 'cover', v => { t.layout = v; })
      ]),
      F.group('Estilo Mural', [
        F.select('Estilo padrão', STYLES, t.style || 'classico', v => { t.style = v; }),
        el('div', { id: 'tplSurface' }, surfaceControls(t.board, refreshTplSurface)),
        F.select('Decoração', E.DECORS.map(s => [s.id, s.label]), t.board.decor || 'flores', v => { t.board.decor = v; }),
        el('p', { class: 'muted phelp', text: 'Você pode importar uma foto de tecido, papel, madeira ou parede para servir de superfície. O FotoFlow ajusta a imagem sozinho.' })
      ]),
      F.group('Acabamento', [
        F.select('Cor', Object.keys(LOOK_PRESETS).map(k => [k, k]).concat(presetName === 'Personalizado' ? [['Personalizado', 'Personalizado (do modelo original)']] : []),
          presetName, v => { if (v !== 'Personalizado') t.look.filter = LOOK_PRESETS[v]; }),
        F.range('Vinheta', 0, 1, 0.05, t.look.vignette || 0, v => { t.look.vignette = v; }, pct),
        F.range('Grão de filme', 0, 1, 0.05, t.look.grain || 0, v => { t.look.grain = v; }, pct),
        F.range('Faixas de cinema', 0, 1, 0.05, t.look.letterbox || 0, v => { t.look.letterbox = v; }, pct),
        F.range('Borda de papel', 0, 1, 0.05, t.look.paperEdge || 0, v => { t.look.paperEdge = v; }, pct),
        F.range('Luz ambiente', 0, 1, 0.05, t.look.lightLeak || 0, v => { t.look.lightLeak = v; }, pct)
      ])
    );
    openModal('modalTpl');
  }
  const pct = v => Math.round(v * 100) + '%';

  /* ==========================================================================
     PAINEL DE PROPRIEDADES
     ========================================================================== */
  const F = {
    group(title, kids) { return el('section', { class: 'pgroup' }, [el('h3', { text: title })].concat(kids)); },
    row(label, control) { return el('label', { class: 'prow' }, [el('span', { class: 'plabel', text: label }), control]); },
    select(label, opts, val, cb) {
      const s = el('select', { onchange: e => cb(e.target.value) }, opts.map(o => el('option', { value: o[0], selected: String(o[0]) === String(val) || null }, o[1])));
      return F.row(label, s);
    },
    range(label, min, max, step, val, cb, fmt) {
      const out = el('output', { text: fmt ? fmt(val) : val });
      const r = el('input', { type: 'range', min, max, step, value: val,
        oninput: e => { const v = parseFloat(e.target.value); out.textContent = fmt ? fmt(v) : v; cb(v); } });
      return F.row(label, el('span', { class: 'range' }, [r, out]));
    },
    number(label, val, cb, step) {
      return F.row(label, el('input', { type: 'number', step: step || 0.1, min: 0, value: Math.round(val * 100) / 100,
        onchange: e => cb(Math.max(0, parseFloat(e.target.value) || 0)) }));
    },
    text(label, val, cb) { return F.row(label, el('input', { type: 'text', value: val, oninput: e => cb(e.target.value) })); },
    area(label, val, cb) { return F.row(label, el('textarea', { rows: 3, oninput: e => cb(e.target.value) }, val)); },
    color(label, val, cb) { return F.row(label, el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(val) ? val : '#ffffff', oninput: e => cb(e.target.value) })); },
    check(label, val, cb) { return el('label', { class: 'check' }, [el('input', { type: 'checkbox', checked: val || null, onchange: e => cb(e.target.checked) }), label]); },
    button(label, cb, cls) { return el('button', { class: 'btn small ' + (cls || ''), type: 'button', onclick: cb }, label); }
  };

  /* touch: redesenha quadro e linha do tempo sem reconstruir o painel (não perde o foco do campo). */
  function touch() { draw(); FF.Timeline.render(); }

  const STYLES = [['classico', 'Clássico (foto em tela cheia)'], ['mural', 'Mural (fotos sobre a mesa, a câmera voa)']];
  const FILTERS = [['', 'Nenhum'], ['grayscale(1)', 'Preto e branco'], ['sepia(0.6)', 'Sépia'], ['saturate(1.35) contrast(1.05)', 'Vívido'], ['brightness(1.08) saturate(0.85)', 'Suave']];
  const POSITIONS = { 'Centro': [0.5, 0.5, 'center'], 'Terço superior': [0.5, 0.2, 'center'], 'Terço inferior': [0.5, 0.8, 'center'],
    'Rodapé': [0.5, 0.9, 'center'], 'Inferior esquerdo': [0.07, 0.86, 'left'], 'Inferior direito': [0.93, 0.86, 'right'], 'Superior esquerdo': [0.07, 0.14, 'left'] };

  function renderProps() {
    const host = $('#props'); host.innerHTML = '';
    const p = state.project, s = state.sel, obj = findSel();
    if (!s || !obj) { host.append(propsProject(p)); return; }
    if (s.type === 'scene') host.append(propsScene(obj));
    else if (s.type === 'transition') host.append(propsTransition(obj));
    else if (s.type === 'text') host.append(propsText(obj));
    else if (s.type === 'audio') host.append(propsAudio(obj));
  }

  function propsProject(p) {
    const look = p.look, tpl = TP.get(p.templateId);
    return el('div', {}, [
      el('h2', { class: 'ptitle', text: 'Projeto' }),
      el('p', { class: 'muted phelp', text: 'Selecione uma foto, transição, texto ou áudio na linha do tempo para editar.' }),
      F.group('Dados', [
        F.text('Nome do filme', p.name, v => { p.name = v; $('#projName').value = v; }),
        F.text('Autor', p.author || '', v => { p.author = v; }),
        F.select('Formato', Object.keys(ASPECTS).map(a => [a, `${a} (${ASPECTS[a][0]}×${ASPECTS[a][1]})`]), p.aspect, v => { setAspect(v); FF.Timeline.render(); }),
        F.row('Modelo', el('span', { class: 'value-line' }, [tpl.name, ' ', F.button('Trocar', () => showTab('modelos'))])),
        F.select('Estilo do filme', STYLES, p.style || 'classico', v => setStyle(v))
      ]),
      p.style === 'mural' ? F.group('Mural', [
        el('p', { class: 'muted phelp', text: 'As fotos ficam como impressões sobre uma superfície e a câmera voa de uma para a outra.' }),
      ].concat(surfaceControls(p.board, rebuild => { if (rebuild) renderProps(); draw(); })).concat([
        F.select('Decoração', E.DECORS.map(s => [s.id, s.label]), p.board.decor, v => { p.board.decor = v; draw(); }),
        F.range('Inclinação das fotos', 0, 1, 0.05, p.board.tilt == null ? 0.5 : p.board.tilt, v => { p.board.tilt = v; draw(); }, pct),
        F.color('Cor da moldura', p.board.frame || '#ffffff', v => { p.board.frame = v; draw(); })
      ])) : null,
      F.group('Acabamento do filme', [
        F.range('Vinheta', 0, 1, 0.05, look.vignette || 0, v => { look.vignette = v; draw(); }, pct),
        F.range('Grão de filme', 0, 1, 0.05, look.grain || 0, v => { look.grain = v; draw(); }, pct),
        F.range('Faixas de cinema', 0, 1, 0.05, look.letterbox || 0, v => { look.letterbox = v; draw(); }, pct),
        F.range('Borda de papel', 0, 1, 0.05, look.paperEdge || 0, v => { look.paperEdge = v; draw(); }, pct),
        F.range('Luz ambiente', 0, 1, 0.05, look.lightLeak || 0, v => { look.lightLeak = v; draw(); }, pct),
        F.check('Abrir e encerrar com fade suave', p.fadeEdges !== false, v => { p.fadeEdges = v; draw(); })
      ])
    ]);
  }

  function propsScene(sc) {
    const p = state.project, m = p.media[sc.mediaId], cam = sc.camera;
    const idx = p.scenes.indexOf(sc);
    // Miniatura com seletor de ponto de interesse (clique define para onde a câmera olha).
    const dot = (cls, pt) => el('span', { class: 'focus-dot ' + cls, style: { left: pt.x * 100 + '%', top: pt.y * 100 + '%' } });
    const picker = el('div', { class: 'focus-picker', title: 'Clique na foto para definir o ponto de interesse',
      onclick: e => {
        const r = picker.getBoundingClientRect();
        const pt = { x: clamp((e.clientX - r.left) / r.width, 0.05, 0.95), y: clamp((e.clientY - r.top) / r.height, 0.05, 0.95) };
        if (state.pick === 'from' && cam.kb) { cam.kb.from.x = pt.x; cam.kb.from.y = pt.y; }
        else { cam.focus = pt; if (cam.kb) { cam.kb.to.x = pt.x; cam.kb.to.y = pt.y; } }
        cam.auto = false; state.pick = null; renderProps(); draw();
      } }, m ? [el('img', { src: m.thumb, alt: '' }), cam.kb && cam.type === 'kenburns' ? dot('from', cam.kb.from) : null, dot('to', cam.focus)] : [el('div', { class: 'muted', text: 'Cena sem foto' })]);

    const kbBox = [];
    if (cam.type === 'kenburns') {
      if (!cam.kb) cam.kb = { from: { x: 0.5, y: 0.5, z: 1.03 }, to: { x: cam.focus.x, y: cam.focus.y, z: 1.25 } };
      kbBox.push(
        F.range('Zoom inicial', 1, 2.2, 0.01, cam.kb.from.z, v => { cam.kb.from.z = v; cam.auto = false; draw(); }, v => v.toFixed(2) + '×'),
        F.range('Zoom final', 1, 2.2, 0.01, cam.kb.to.z, v => { cam.kb.to.z = v; cam.auto = false; draw(); }, v => v.toFixed(2) + '×'),
        el('div', { class: 'btn-row' }, [
          F.button(state.pick === 'from' ? 'Clique na foto…' : 'Marcar ponto inicial', () => { state.pick = 'from'; renderProps(); }),
          F.button('Automático', () => { sc.camera = Object.assign(autoCamera(idx, m, TP.get(p.templateId)), { type: 'kenburns' });
            if (!sc.camera.kb) sc.camera.kb = { from: { x: 0.5, y: 0.5, z: 1.03 }, to: { x: sc.camera.focus.x, y: sc.camera.focus.y, z: 1.28 } };
            renderProps(); draw(); })
        ]),
        el('p', { class: 'muted phelp', text: 'Ponto claro: início do percurso. Ponto dourado: destino (clique na foto para mover).' })
      );
    }
    return el('div', {}, [
      el('h2', { class: 'ptitle', text: `Foto ${idx + 1}` }),
      picker,
      m ? el('p', { class: 'muted phelp', text: `${m.name} · destaque detectado por ${m.focusSource === 'rosto' ? 'rosto' : 'contraste e cor'}` }) : null,
      F.group('Tempo e enquadramento', [
        F.range('Tempo de exibição', 1, 20, 0.1, sc.duration, v => { sc.duration = v; touch(); }, v => v.toFixed(1) + ' s'),
        F.select('Enquadramento', [['cover', 'Preencher a tela'], ['contain', 'Foto inteira com fundo desfocado']], sc.fit || 'cover', v => { sc.fit = v; draw(); }),
        F.select('Efeito na foto', FILTERS, sc.filter || '', v => { sc.filter = v; draw(); })
      ]),
      F.group('Câmera virtual', [
        p.style === 'mural' ? el('p', { class: 'muted phelp', text: 'No estilo Mural o movimento principal é o voo entre as fotos. Aqui você ajusta o leve movimento durante a pausa e o ponto da foto que fica à vista.' }) : null,
        F.select('Movimento', E.CAMERAS.map(c => [c.id, c.label]), cam.type, v => { cam.type = v; cam.auto = false; renderProps(); touch(); }),
        F.range('Intensidade', 0, 1, 0.05, cam.intensity, v => { cam.intensity = v; draw(); }, pct),
        F.select('Sentido', [[1, 'Da esquerda para a direita / para cima'], [-1, 'Da direita para a esquerda / para baixo']], cam.dir, v => { cam.dir = parseInt(v, 10); draw(); })
      ].concat(kbBox).concat([
        el('div', { class: 'btn-row' }, [F.button('Aplicar movimento a todas as fotos', () => {
          p.scenes.forEach((o, i) => { if (o !== sc) { const f = o.camera.focus; o.camera = clone(cam); o.camera.focus = f; delete o.camera.kb; o.camera.dir = i % 2 ? -1 : 1; } });
          touch(); toast('Movimento aplicado a todas as fotos.'); })])
      ])),
      el('div', { class: 'btn-row' }, [F.button('Duplicar', actions.duplicateSelected), F.button('Excluir', actions.removeSelected, 'danger')])
    ]);
  }

  function propsTransition(sc) {
    const p = state.project, tr = sc.transition, idx = p.scenes.indexOf(sc);
    return el('div', {}, [
      el('h2', { class: 'ptitle', text: `Transição ${idx + 1} → ${idx + 2}` }),
      F.group('Transição', [
        F.select('Tipo', E.TRANSITIONS.map(t => [t.id, t.label]), tr.type, v => { tr.type = v; touch(); previewTransition(sc); }),
        F.range('Duração', 0.2, 4, 0.1, tr.duration, v => { tr.duration = v; touch(); }, v => v.toFixed(1) + ' s'),
        F.select('Sentido', [[1, 'Entra pela direita'], [-1, 'Entra pela esquerda']], tr.dir || 1, v => { tr.dir = parseInt(v, 10); draw(); }),
        el('div', { class: 'btn-row' }, [
          F.button('Ver transição', () => previewTransition(sc)),
          F.button('Aplicar a todas', () => { p.scenes.forEach(o => { o.transition = clone(tr); }); touch(); toast('Transição aplicada a todo o filme.'); })
        ])
      ])
    ]);
  }
  /* Reproduz só o trecho da transição selecionada. */
  function previewTransition(sc) {
    const it = E.schedule(state.project).items.find(x => x.scene === sc);
    if (!it || !it.transition) return;
    pause(); state.time = Math.max(0, it.end - it.transition - 0.6);
    const end = it.end + 0.6;
    FF.App.stopAt = end; play();
  }

  function propsText(tx) {
    const fontOpts = Object.keys(TP.FONTS).map(k => [TP.FONTS[k], k]);
    if (!fontOpts.some(o => o[0] === tx.font)) fontOpts.push([tx.font, 'Do modelo']);
    const posName = Object.keys(POSITIONS).find(k => Math.abs(POSITIONS[k][0] - tx.x) < 0.01 && Math.abs(POSITIONS[k][1] - tx.y) < 0.01) || '';
    return el('div', {}, [
      el('h2', { class: 'ptitle', text: KIND_LABEL[tx.kind] || 'Texto' }),
      F.group('Conteúdo', [
        F.area('Texto', tx.text, v => { tx.text = v; touch(); }),
        F.select('Tipo', Object.keys(KIND_LABEL).map(k => [k, KIND_LABEL[k]]), tx.kind, v => {
          const keep = { id: tx.id, text: tx.text, start: tx.start, duration: tx.duration };
          Object.keys(tx).forEach(k => delete tx[k]);
          Object.assign(tx, keep, { kind: v }, clone(TP.get(state.project.templateId).text[v]));
          renderProps(); touch(); })
      ]),
      F.group('Aparência', [
        F.select('Fonte', fontOpts, tx.font, v => { tx.font = v; draw(); }),
        F.range('Tamanho', 2, 18, 0.2, tx.size, v => { tx.size = v; draw(); }, v => v.toFixed(1)),
        F.color('Cor', tx.color, v => { tx.color = v; draw(); }),
        F.select('Peso', [[300, 'Leve'], [400, 'Normal'], [600, 'Seminegrito'], [700, 'Negrito']], tx.weight || 400, v => { tx.weight = parseInt(v, 10); draw(); }),
        F.range('Espaço entre letras', 0, 0.5, 0.01, tx.spacing || 0, v => { tx.spacing = v; draw(); }, v => v.toFixed(2)),
        el('div', { class: 'check-grid' }, [
          F.check('Maiúsculas', tx.upper, v => { tx.upper = v; draw(); }), F.check('Itálico', tx.italic, v => { tx.italic = v; draw(); }),
          F.check('Sombra', tx.shadow !== false, v => { tx.shadow = v; draw(); })]),
        F.select('Fundo', [['none', 'Sem fundo'], ['bar', 'Faixa'], ['box', 'Caixa arredondada']], tx.bg || 'none', v => { tx.bg = v; draw(); })
      ]),
      F.group('Posição', [
        F.select('Posição pronta', [['', 'Livre']].concat(Object.keys(POSITIONS).map(k => [k, k])), posName, v => {
          if (POSITIONS[v]) { tx.x = POSITIONS[v][0]; tx.y = POSITIONS[v][1]; tx.align = POSITIONS[v][2]; renderProps(); draw(); } }),
        F.range('Horizontal', 0, 1, 0.01, tx.x, v => { tx.x = v; draw(); }, pct),
        F.range('Vertical', 0, 1, 0.01, tx.y, v => { tx.y = v; draw(); }, pct),
        F.select('Alinhamento', [['left', 'À esquerda'], ['center', 'Centralizado'], ['right', 'À direita']], tx.align || 'center', v => { tx.align = v; draw(); })
      ]),
      F.group('Animação e tempo', [
        F.select('Animação', E.TEXT_ANIMS.map(a => [a.id, a.label]), tx.anim || 'fade', v => { tx.anim = v; seek(tx.start); FF.App.stopAt = tx.start + tx.duration; play(); }),
        F.number('Início (s)', tx.start, v => { tx.start = v; touch(); }),
        F.range('Duração', 0.5, 20, 0.1, tx.duration, v => { tx.duration = v; touch(); }, v => v.toFixed(1) + ' s')
      ]),
      el('div', { class: 'btn-row' }, [F.button('Duplicar', actions.duplicateSelected), F.button('Excluir', actions.removeSelected, 'danger')])
    ]);
  }

  function propsAudio(c) {
    const m = state.project.media[c.mediaId];
    return el('div', {}, [
      el('h2', { class: 'ptitle', text: 'Áudio' }),
      el('p', { class: 'muted phelp', text: m ? m.name : '' }),
      F.group('Faixa', [
        F.select('Uso', [['music', 'Música de fundo'], ['narration', 'Narração'], ['sfx', 'Efeito sonoro']], c.kind, v => { c.kind = v; touch(); }),
        F.range('Volume', 0, 1, 0.01, c.volume, v => { c.volume = v; syncAudio(); }, pct),
        F.range('Fade in', 0, 8, 0.1, c.fadeIn, v => { c.fadeIn = v; }, v => v.toFixed(1) + ' s'),
        F.range('Fade out', 0, 8, 0.1, c.fadeOut, v => { c.fadeOut = v; }, v => v.toFixed(1) + ' s'),
        F.number('Início na linha do tempo (s)', c.start, v => { c.start = v; touch(); }),
        F.number('Começar a tocar a partir de (s)', c.offset || 0, v => { c.offset = Math.min(v, m ? m.duration - 0.5 : v); c.duration = Math.min(c.duration, (m ? m.duration : c.duration) - c.offset); touch(); }),
        F.range('Duração usada', 0.5, m ? m.duration : c.duration, 0.1, c.duration, v => { c.duration = Math.min(v, (m ? m.duration : v) - (c.offset || 0)); touch(); }, v => v.toFixed(1) + ' s'),
        el('div', { class: 'btn-row' }, [F.button('Ajustar ao fim do filme', () => { c.duration = clamp(total() - c.start, 0.5, (m ? m.duration : 9999) - (c.offset || 0)); renderProps(); touch(); })])
      ]),
      el('div', { class: 'btn-row' }, [F.button('Duplicar', actions.duplicateSelected), F.button('Excluir', actions.removeSelected, 'danger')])
    ]);
  }

  /* ==========================================================================
     GERAÇÃO AUTOMÁTICA
     Fotos + música + modelo = filme pronto (sequência, duração, transições,
     movimentos, Ken Burns e ritmo).
     ========================================================================== */
  /* Estimativa de andamento (BPM) da música, para alinhar os cortes ao ritmo. */
  async function estimateBpm(media) {
    if (media.bpm !== undefined) return media.bpm;
    media.bpm = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const buf = await (await fetch(media.src)).arrayBuffer();
      const ac = new AC();
      const audio = await ac.decodeAudioData(buf);
      ac.close();
      const ch = audio.getChannelData(0), sr = audio.sampleRate;
      const hop = Math.floor(sr / 100), n = Math.min(Math.floor(ch.length / hop), 100 * 90);   // até 90 s
      const env = new Float32Array(n);
      for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < hop; j++) { const v = ch[i * hop + j]; s += v * v; } env[i] = Math.sqrt(s / hop); }
      const flux = new Float32Array(n);
      for (let i = 1; i < n; i++) flux[i] = Math.max(0, env[i] - env[i - 1]);
      let best = 0, bestLag = 0;
      for (let lag = 33; lag <= 100; lag++) {             // 60 a 180 BPM
        let s = 0; for (let i = lag; i < n; i++) s += flux[i] * flux[i - lag];
        if (s > best) { best = s; bestLag = lag; }
      }
      media.bpm = bestLag ? Math.round(6000 / bestLag) : null;
    } catch (e) { media.bpm = null; }
    return media.bpm;
  }

  async function autoGenerate(o) {
    const p = state.project, tpl = TP.get(o.templateId);
    const imgs = p.mediaOrder.map(id => p.media[id]).filter(m => m.type === 'image');
    if (!imgs.length) { toast('Importe fotos antes de gerar o filme.', 'warn'); return; }
    setBusy('Montando o filme…');
    pause();
    const prev = TP.get(p.templateId);
    p.templateId = tpl.id; p.palette = clone(tpl.palette); p.look = clone(tpl.look);
    adoptAspect(tpl, prev);
    p.style = o.style === 'mural' ? 'mural' : 'classico';
    p.board = clone(tpl.board || { surface: 'madeira', decor: 'flores', tilt: 0.5 });
    const mural = p.style === 'mural';
    let dur = mural ? Math.max(MURAL.scene, tpl.rhythm.scene) : tpl.rhythm.scene, tr = mural ? MURAL.flight : tpl.rhythm.transition, note = '';
    const music = o.musicId ? p.media[o.musicId] : null;
    if (music && o.fitMusic) {
      // Distribui as fotos pela duração da música (dentro de limites confortáveis).
      dur = clamp((music.duration + (imgs.length - 1) * tr) / imgs.length, mural ? MURAL.minScene : 2.2, 10);
      const bpm = await estimateBpm(music);
      if (bpm) { const beat = 60 / bpm; dur = Math.max(beat * 2, mural ? MURAL.minScene : 0, Math.round(dur / beat) * beat); note = ` Cortes alinhados a cerca de ${bpm} BPM.`; }
      if (!mural) tr = Math.min(tr, dur * 0.4);
    }
    p.scenes = imgs.map((m, i) => makeScene(m, i, tpl, dur, tr));
    const tot = E.schedule(p).total;
    p.texts = [];
    if (o.title) p.texts.push(makeText('title', o.title, 0.8, Math.min(4.5, Math.max(2.5, dur - 0.4))));
    if (o.subtitle) p.texts.push(makeText('subtitle', o.subtitle, 1.5, Math.min(3.8, Math.max(2, dur - 1.1))));
    if (o.credits && tot > 8) p.texts.push(makeText('credits', o.credits, tot - Math.min(5.5, dur), Math.min(5, dur - 0.5)));
    Object.keys(FF.media.audioEls).forEach(stopAudioEl);
    p.audio = [];
    if (music) p.audio.push({ id: uid('c'), mediaId: music.id, kind: 'music', start: 0, offset: 0,
      duration: Math.min(music.duration, tot), volume: 0.8, fadeIn: 1.5, fadeOut: Math.min(4, tot / 4) });
    setBusy(null);
    state.time = 0; state.sel = null;
    renderTemplates(); refresh(true);
    toast(`Filme gerado: ${imgs.length} fotos, ${fmtTime(tot).slice(0, 5)} de duração.${note}`);
  }

  function openAuto() {
    const p = state.project;
    const imgs = p.mediaOrder.map(id => p.media[id]).filter(m => m.type === 'image');
    const auds = p.mediaOrder.map(id => p.media[id]).filter(m => m.type === 'audio');
    const o = { templateId: (state.suggestion && state.suggestion.id) || p.templateId, musicId: auds[0] ? auds[0].id : '', fitMusic: true, style: p.style || 'classico',
      title: p.name && p.name !== 'Meu filme' ? p.name : '', subtitle: '', credits: p.author ? 'Um filme de ' + p.author : '' };
    const body = $('#autoForm'); body.innerHTML = '';
    const styleSel = F.select('Estilo', STYLES, o.style, v => { o.style = v; });
    body.append(
      el('ol', { class: 'steps' }, [
        el('li', {}, [el('strong', { text: 'Fotos' }), el('p', { class: imgs.length ? '' : 'warn-text',
          text: imgs.length ? `${imgs.length} foto(s) na biblioteca, na ordem em que foram importadas.` : 'Nenhuma foto importada ainda. Feche esta janela e importe suas fotos.' })]),
        el('li', {}, [el('strong', { text: 'Música' }),
          F.select('Trilha', [['', 'Sem música']].concat(auds.map(a => [a.id, a.name])), o.musicId, v => { o.musicId = v; }),
          F.check('Ajustar o tempo das fotos à duração e ao ritmo da música', o.fitMusic, v => { o.fitMusic = v; })]),
        el('li', {}, [el('strong', { text: 'Modelo' }),
          F.select('Modelo', TP.all().map(t => [t.id, t.name + (state.suggestion && state.suggestion.id === t.id ? ' (sugerido)' : '')]), o.templateId, v => {
            o.templateId = v;
            if (TP.get(v).style === 'mural') { o.style = 'mural'; styleSel.querySelector('select').value = 'mural'; } }),
          styleSel]),
        el('li', {}, [el('strong', { text: 'Textos (opcional)' }),
          F.text('Título de abertura', o.title, v => { o.title = v; }),
          F.text('Subtítulo', o.subtitle, v => { o.subtitle = v; }),
          F.text('Créditos finais', o.credits, v => { o.credits = v; })])
      ]),
      p.scenes.length ? el('p', { class: 'warn-text', text: 'A linha do tempo atual será substituída pelo novo filme.' }) : null
    );
    $('#btnGerar').onclick = () => { closeModals(); autoGenerate(o); };
    $('#btnGerar').disabled = !imgs.length;
    openModal('modalAuto');
  }

  /* ==========================================================================
     PROJETOS (JSON local)
     ========================================================================== */
  function saveProject() {
    const p = state.project;
    const blob = new Blob([JSON.stringify(p)], { type: 'application/json' });
    download(blob, (p.name || 'projeto').replace(/[\\/:*?"<>|]+/g, '-') + '.fotoflow.json');
    toast('Projeto salvo na pasta de downloads.');
  }
  async function loadProject(data) {
    if (!data || data.formato !== 'FotoFlow.Projeto') throw new Error('Este arquivo não é um projeto do FotoFlow.');
    setBusy('Abrindo o projeto…');
    pause(); Object.keys(FF.media.audioEls).forEach(stopAudioEl);
    FF.media.images = {};
    for (const id of data.mediaOrder || []) {
      const m = data.media[id];
      if (m && m.type === 'image') { try { FF.media.images[id] = await loadImage(m.src); } catch (e) { console.warn('Imagem ilegível no projeto:', m.name); } }
    }
    if (!TP.all().some(t => t.id === data.templateId)) data.templateId = 'familia';
    if (!data.style) data.style = 'classico';
    if (!data.board) data.board = clone(TP.get(data.templateId).board || { surface: 'madeira', decor: 'flores', tilt: 0.5 });
    if (data.board.image) E.customTile(data.board.image);
    state.project = data; state.sel = null; state.time = 0;
    $('#projName').value = data.name || '';
    setBusy(null);
    updateSuggestion(); fitCanvas(); renderLibrary(); renderTemplates(); refresh(true);
  }
  function startNew(ask) {
    const p = state.project;
    if (ask && p && (p.scenes.length || p.mediaOrder.length) && !confirm('Começar um projeto novo? O que não foi salvo será perdido.')) return;
    pause(); Object.keys(FF.media.audioEls).forEach(stopAudioEl);
    FF.media.images = {};
    state.project = newProject(); state.sel = null; state.time = 0; state.suggestion = null;
    $('#projName').value = state.project.name;
    fitCanvas(); renderLibrary(); renderTemplates(); refresh(true);
  }
  function duplicateProject() {
    const p = state.project;
    p.name = (p.name || 'Projeto') + ' (cópia)';
    $('#projName').value = p.name;
    refresh(true); saveProject();
    toast('Cópia criada e salva. Você continua editando a cópia.');
  }

  /* ==========================================================================
     INTERFACE GERAL
     ========================================================================== */
  function refresh(withProps) {
    draw(); FF.Timeline.render();
    if (withProps) renderProps();
    renderLibraryUsage();
  }
  function renderLibraryUsage() {
    // Atualiza só os contadores de uso sem recriar a grade inteira a cada mudança.
    const p = state.project, items = $$('#mediaGrid .media-item');
    const imgs = p.mediaOrder.map(id => p.media[id]).filter(m => m.type === 'image');
    if (items.length !== imgs.length) { renderLibrary(); return; }
    imgs.forEach((m, i) => {
      const used = p.scenes.filter(s => s.mediaId === m.id).length;
      let b = $('.media-used', items[i]);
      if (used && !b) { b = el('span', { class: 'media-used' }); items[i].append(b); }
      if (b) { b.textContent = used ? used + '×' : ''; b.hidden = !used; }
    });
  }
  function showTab(name) {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $$('.tabpanel').forEach(t => { t.hidden = t.dataset.panel !== name; });
  }
  function openModal(id) { closeModals(); $('#' + id).hidden = false; const f = $('#' + id + ' button, #' + id + ' input, #' + id + ' select'); if (f) f.focus(); }
  function closeModals() { $$('.modal').forEach(m => { m.hidden = true; }); }

  function init() {
    canvas = $('#preview'); ctx = canvas.getContext('2d');
    state.project = newProject();
    FF.Timeline.init($('#timeline'));
    fitCanvas();

    // Barra superior
    $('#btnNovo').onclick = () => startNew(true);
    $('#btnAbrir').onclick = () => $('#fileProject').click();
    $('#btnSalvar').onclick = saveProject;
    $('#btnDuplicar').onclick = duplicateProject;
    $('#btnAuto').onclick = openAuto;
    $('#btnExportar').onclick = () => FF.Export.open();
    $('#btnTutorial').onclick = () => openModal('modalTutorial');
    $('#btnTutorialVazio').onclick = () => openModal('modalTutorial');
    $('#btnCreditos').onclick = () => openModal('modalCreditos');
    $('#fileSurface').onchange = async e => {
      const f = e.target.files[0]; e.target.value = '';
      const cb = surfaceCallback; surfaceCallback = null;
      if (!f || !cb) return;
      try { setBusy('Ajustando a imagem…'); const url = await adjustSurface(f); setBusy(null); cb(url); }
      catch (err) { setBusy(null); toast('Não foi possível usar esta imagem como superfície.', 'error'); }
    };
    $('#projName').oninput = e => { state.project.name = e.target.value; if (!state.sel) renderProps(); };

    // Arquivos
    $('#btnImportar').onclick = () => $('#fileMedia').click();
    $('#fileMedia').onchange = e => { importFiles(e.target.files); e.target.value = ''; };
    $('#fileProject').onchange = async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try { await loadProject(JSON.parse(await readAs(f, 'text'))); toast('Projeto aberto.'); }
      catch (err) { setBusy(null); toast(err.message || 'Não foi possível abrir o projeto.', 'error'); }
    };
    $('#fileTpl').onchange = async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try { const t = TP.fromFile(await readAs(f, 'text')); renderTemplates(); toast(`Modelo "${t.name}" importado.`); }
      catch (err) { toast(err.message || 'Não foi possível importar o modelo.', 'error'); }
    };

    // Arrastar arquivos do computador para a janela
    const dz = $('#dropZone');
    ['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { e.preventDefault(); dz.classList.add('over'); }
    }));
    ['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, () => dz.classList.remove('over')));
    document.addEventListener('drop', e => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); importFiles(e.dataTransfer.files); }
    });

    // Abas, textos e modelos
    $$('.tab').forEach(t => { t.onclick = () => showTab(t.dataset.tab); });
    $$('[data-addtext]').forEach(b => { b.onclick = () => actions.addText(b.dataset.addtext); });
    $('#btnNovoModelo').onclick = () => openTemplateEditor(TP.duplicate(state.project.templateId));
    $('#btnImportarModelo').onclick = () => $('#fileTpl').click();
    $('#btnTplSalvar').onclick = () => {
      if (!editing) return;
      const ok = TP.save(editing);
      closeModals(); renderTemplates();
      toast(ok ? `Modelo "${editing.name}" salvo.` : 'O navegador bloqueou o armazenamento local; exporte o modelo para não perdê-lo.', ok ? '' : 'warn');
    };
    $('#btnTplExportar').onclick = () => { if (editing) download(new Blob([TP.toFile(editing)], { type: 'application/json' }), editing.name.replace(/[\\/:*?"<>|]+/g, '-') + '.fftemplate'); };
    $('#btnTplExcluir').onclick = () => {
      if (!editing || !confirm(`Excluir o modelo "${editing.name}"?`)) return;
      TP.remove(editing.id);
      if (state.project.templateId === editing.id) state.project.templateId = 'familia';
      closeModals(); renderTemplates(); renderProps();
    };
    $$('[data-close]').forEach(b => { b.onclick = closeModals; });
    $$('.modal').forEach(m => m.addEventListener('mousedown', e => { if (e.target === m && !FF.Export.busy) closeModals(); }));

    // Player
    $('#btnPlay').onclick = () => (state.playing ? pause() : play());
    $('#btnStop').onclick = stop;
    $('#volume').oninput = e => { state.volume = parseFloat(e.target.value); syncAudio(); };
    $('#btnFull').onclick = () => {
      const w = $('#previewWrap');
      if (document.fullscreenElement) document.exitFullscreen(); else if (w.requestFullscreen) w.requestFullscreen();
    };
    canvas.onclick = () => (state.playing ? pause() : play());

    // Linha do tempo: barra de ferramentas
    $('#tlZoom').oninput = e => { state.pps = parseFloat(e.target.value); FF.Timeline.render(); };
    $('#btnDupSel').onclick = actions.duplicateSelected;
    $('#btnDelSel').onclick = actions.removeSelected;

    // Atalhos de teclado
    document.addEventListener('keydown', e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === 'Escape') { if (!FF.Export.busy) closeModals(); return; }
      if (typing) return;
      if (e.code === 'Space') { e.preventDefault(); state.playing ? pause() : play(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { if (state.sel) { e.preventDefault(); actions.removeSelected(); } }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); actions.duplicateSelected(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); }
      else if (e.key === 'ArrowLeft') seek(state.time - (e.shiftKey ? 1 : 0.1));
      else if (e.key === 'ArrowRight') seek(state.time + (e.shiftKey ? 1 : 0.1));
      else if (e.key === 'Home') seek(0);
    });
    window.addEventListener('beforeunload', e => {
      if (state.project.scenes.length) { e.preventDefault(); e.returnValue = ''; }
    });

    renderLibrary(); renderTemplates(); refresh(true);
  }

  FF.App = {
    state, actions, ASPECTS, KIND_LABEL,
    draw, seek, play, pause, stop, total, select, refresh, touch, renderProps, fitCanvas, setBusy,
    importFiles, loadProject, autoGenerate, syncAudio, pauseAllAudio, audioEl,
    get canvas() { return canvas; }, get ctx() { return ctx; },
    stopAt: null, onEnded: null
  };
  // Parada programada (usada nas pré-visualizações de transição e de texto).
  setInterval(() => {
    if (state.playing && FF.App.stopAt != null && state.time >= FF.App.stopAt) { FF.App.stopAt = null; pause(); }
    if (!state.playing) FF.App.stopAt = null;
  }, 60);

  document.addEventListener('DOMContentLoaded', init);
})(window.FF = window.FF || {});
