/* ==========================================================================
   FotoFlow — transitions.js
   Motor de renderização cinematográfica: câmera virtual, Ken Burns,
   transições entre cenas, animações de texto e acabamento visual.
   Autor do software: Márcio Willians Barreto de Andrade
   Tudo é desenhado em Canvas 2D, sem bibliotecas externas (100% offline).
   ========================================================================== */
(function (FF) {
  'use strict';

  /* ---------- Utilidades matemáticas ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  /* Curvas de movimento: definem a "sensação" de cada deslocamento. */
  const Ease = {
    linear: t => t,
    inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    inCubic: t => t * t * t,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutQuart: t => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
    outQuint: t => 1 - Math.pow(1 - t, 5)
  };

  /* O filtro de desfoque do Canvas não existe em todos os navegadores. */
  const SUPPORTS_FILTER = (() => {
    try { const c = document.createElement('canvas').getContext('2d'); return typeof c.filter === 'string'; }
    catch (e) { return false; }
  })();

  /* Canvases auxiliares reutilizados (evita criar memória a cada quadro). */
  const buffers = {};
  function buffer(name, w, h) {
    let c = buffers[name];
    if (!c) c = buffers[name] = document.createElement('canvas');
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  /* ==========================================================================
     1. LINHA DO TEMPO LÓGICA
     As cenas se sobrepõem durante a transição: é isso que cria continuidade.
     ========================================================================== */
  function transitionDuration(scene, next) {
    const tr = scene.transition || {};
    if (!next || !tr.type || tr.type === 'none') return 0;
    return Math.max(0, Math.min(tr.duration || 1, scene.duration * 0.45, next.duration * 0.45));
  }

  function schedule(project) {
    const items = [];
    let t = 0;
    const scenes = project.scenes || [];
    scenes.forEach((scene, i) => {
      const tr = transitionDuration(scene, scenes[i + 1]);
      items.push({ scene, index: i, start: t, end: t + scene.duration, transition: tr });
      t = t + scene.duration - tr;
    });
    let total = items.length ? items[items.length - 1].end : 0;
    if (!items.length) (project.texts || []).forEach(x => { total = Math.max(total, x.start + x.duration); });
    return { items, total };
  }

  /* ==========================================================================
     2. CÂMERA VIRTUAL
     Cada tipo devolve o estado da câmera (zoom, centro, rotação, inclinação)
     para um progresso p de 0 a 1 dentro da cena.
     ========================================================================== */
  const CAMERAS = [
    { id: 'kenburns', label: 'Ken Burns automático' },
    { id: 'zoomIn', label: 'Zoom in' },
    { id: 'zoomOut', label: 'Zoom out' },
    { id: 'panH', label: 'Panorâmica horizontal' },
    { id: 'panV', label: 'Panorâmica vertical' },
    { id: 'tilt', label: 'Tilt' },
    { id: 'dollyIn', label: 'Dolly in' },
    { id: 'dollyOut', label: 'Dolly out' },
    { id: 'orbit', label: 'Órbita' },
    { id: 'travelling', label: 'Travelling' },
    { id: 'static', label: 'Câmera parada' }
  ];

  function cameraState(scene, p) {
    const cam = scene.camera || {};
    const k = cam.intensity == null ? 0.5 : cam.intensity;      // 0 a 1
    const dir = cam.dir === -1 ? -1 : 1;                           // sentido do movimento
    const f = cam.focus || { x: 0.5, y: 0.5 };                     // ponto de interesse da foto
    const a = 0.1 + 0.36 * k;                                      // amplitude do zoom
    const e = Ease.inOutSine(clamp(p));
    const s = { zoom: 1, cx: 0.5, cy: 0.5, rot: 0, skew: 0 };

    switch (cam.type || 'kenburns') {
      case 'static':
        s.zoom = 1.02; s.cx = f.x; s.cy = f.y; break;
      case 'zoomIn':
        s.zoom = 1.02 + a * e; s.cx = lerp(0.5, f.x, e); s.cy = lerp(0.5, f.y, e); break;
      case 'zoomOut':
        s.zoom = 1.02 + a * (1 - e); s.cx = lerp(f.x, 0.5, e); s.cy = lerp(f.y, 0.5, e); break;
      case 'panH': {
        const d = 0.18 + 0.3 * k;
        s.zoom = 1.14 + 0.2 * k; s.cy = f.y;
        s.cx = lerp(f.x - d * dir, f.x + d * dir, e); break;
      }
      case 'panV': {
        const d = 0.18 + 0.3 * k;
        s.zoom = 1.14 + 0.2 * k; s.cx = f.x;
        s.cy = lerp(f.y + d * dir, f.y - d * dir, e); break;
      }
      case 'tilt': {
        // Tilt: a câmera "inclina" de baixo para cima com leve mudança de perspectiva.
        const d = 0.14 + 0.22 * k;
        s.zoom = lerp(1.16, 1.24 + 0.1 * k, e); s.cx = f.x;
        s.cy = lerp(f.y + d * dir, f.y - d * dir, e);
        s.skew = lerp(-0.02, 0.02, e) * dir; break;
      }
      case 'dollyIn': {
        // Dolly: aproximação física, mais forte que o zoom e com aceleração de carrinho.
        const q = Ease.inOutCubic(clamp(p));
        s.zoom = 1.0 + a * 1.7 * q; s.cx = lerp(0.5, f.x, q); s.cy = lerp(0.5, f.y, q); break;
      }
      case 'dollyOut': {
        const q = Ease.inOutCubic(clamp(p));
        s.zoom = 1.0 + a * 1.7 * (1 - q); s.cx = lerp(f.x, 0.5, q); s.cy = lerp(f.y, 0.5, q); break;
      }
      case 'orbit': {
        // Órbita: giro suave em torno do ponto de interesse.
        const r = 0.03 + 0.05 * k;
        s.rot = lerp(-r, r, e) * dir;
        s.skew = lerp(-0.03, 0.03, e) * dir;
        s.zoom = 1.16 + 0.12 * k;
        s.cx = f.x + Math.sin((e - 0.5) * Math.PI) * 0.1 * dir; s.cy = f.y; break;
      }
      case 'travelling': {
        // Travelling: deslocamento diagonal contínuo com leve aproximação.
        const d = 0.14 + 0.2 * k;
        s.zoom = lerp(1.16, 1.24 + 0.12 * k, e);
        s.cx = lerp(f.x - d * dir, f.x + d * dir, e);
        s.cy = lerp(f.y + d * 0.5, f.y - d * 0.5, e); break;
      }
      case 'kenburns':
      default: {
        // Ken Burns: percurso entre dois enquadramentos (definidos à mão ou automáticos).
        const kb = cam.kb || { from: { x: 0.5, y: 0.5, z: 1.03 }, to: { x: f.x, y: f.y, z: 1.03 + a } };
        s.zoom = lerp(kb.from.z, kb.to.z, e);
        s.cx = lerp(kb.from.x, kb.to.x, e); s.cy = lerp(kb.from.y, kb.to.y, e);
      }
    }
    return s;
  }

  /* Desenha a imagem preenchendo o quadro conforme o estado da câmera. */
  function drawWithCamera(ctx, img, W, H, st) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    // Margem extra para rotação e inclinação nunca mostrarem bordas vazias.
    const cover = 1 + 1.9 * Math.abs(st.rot) + 1.1 * Math.abs(st.skew);
    const scale = Math.max(W / iw, H / ih) * st.zoom * cover;
    const hw = W / (2 * scale) * cover, hh = H / (2 * scale) * cover;
    const cx = hw >= iw / 2 ? iw / 2 : clamp(st.cx * iw, hw, iw - hw);
    const cy = hh >= ih / 2 ? ih / 2 : clamp(st.cy * ih, hh, ih - hh);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(st.rot);
    ctx.transform(1, 0, st.skew, 1, 0, 0);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -cx, -cy);
    ctx.restore();
  }

  /* Modo "Inteira": a foto aparece completa sobre um fundo desfocado dela mesma. */
  function drawContained(ctx, img, W, H, st, p) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    ctx.save();
    if (SUPPORTS_FILTER) ctx.filter = `blur(${Math.round(H * 0.03)}px) brightness(0.62)`;
    drawWithCamera(ctx, img, W, H, { zoom: 1.2, cx: 0.5, cy: 0.5, rot: 0, skew: 0 });
    ctx.restore();
    if (!SUPPORTS_FILTER) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H); }
    const base = Math.min(W / iw, H / ih) * 0.9;
    const sc = base * lerp(1.0, 1.06, (st.zoom - 1) / 0.5 > 1 ? 1 : Math.max(0, (st.zoom - 1) / 0.5));
    const dx = (st.cx - 0.5) * W * 0.06, dy = (st.cy - 0.5) * H * 0.06;
    ctx.save();
    ctx.translate(W / 2 - dx, H / 2 - dy);
    ctx.rotate(st.rot * 0.5);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = H * 0.04; ctx.shadowOffsetY = H * 0.01;
    ctx.drawImage(img, -iw * sc / 2, -ih * sc / 2, iw * sc, ih * sc);
    ctx.restore();
  }

  /* Renderiza uma cena inteira (foto + câmera + correção de cor) num canvas auxiliar. */
  function renderScene(target, project, scene, p) {
    const W = target.width, H = target.height;
    const ctx = target.getContext('2d');
    const look = project.look || {};
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const pal = project.palette || {};
    ctx.fillStyle = pal.bg || '#000';
    ctx.fillRect(0, 0, W, H);
    const img = scene.mediaId && FF.media ? FF.media.image(scene.mediaId) : null;
    if (!img) {
      // Cena sem foto: cartela de título com as cores do modelo.
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, pal.bg || '#1b1f2a'); g.addColorStop(1, pal.primary || '#2c3447');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      return;
    }
    const st = cameraState(scene, p);
    ctx.save();
    const filters = [look.filter, scene.filter].filter(Boolean).join(' ');
    if (SUPPORTS_FILTER && filters) ctx.filter = filters;
    if (scene.fit === 'contain') drawContained(ctx, img, W, H, st, p);
    else drawWithCamera(ctx, img, W, H, st);
    ctx.restore();
  }

  /* ==========================================================================
     3. TRANSIÇÕES
     Cada função recebe a cena que sai (A), a que entra (B) e o progresso p.
     ========================================================================== */
  const TRANSITIONS = [
    { id: 'none', label: 'Corte seco' },
    { id: 'fade', label: 'Fade (pelo preto)' },
    { id: 'crossfade', label: 'Crossfade' },
    { id: 'dissolve', label: 'Dissolve' },
    { id: 'blur', label: 'Desfoque (blur)' },
    { id: 'reveal', label: 'Revelar (reveal)' },
    { id: 'slide', label: 'Deslizar (slide)' },
    { id: 'push', label: 'Empurrar (push)' },
    { id: 'morph', label: 'Morph' },
    { id: 'parallax', label: 'Parallax' },
    { id: 'motionBlur', label: 'Motion blur' },
    { id: 'light', label: 'Efeito de luz' },
    { id: 'zoom', label: 'Zoom através' },
    { id: 'iris', label: 'Íris' },
    { id: 'voo', label: 'Voo de câmera (estilo Mural)' }
  ];

  /* Ruído fixo para o dissolve (mesmo padrão em todos os quadros). */
  const NOISE_W = 160, NOISE_H = 90;
  const noise = new Float32Array(NOISE_W * NOISE_H);
  (function seedNoise() {
    let s = 1234567;
    const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    // Ruído suavizado: média com vizinhos para formar "manchas" orgânicas.
    const raw = new Float32Array(noise.length);
    for (let i = 0; i < raw.length; i++) raw[i] = rnd();
    for (let y = 0; y < NOISE_H; y++) for (let x = 0; x < NOISE_W; x++) {
      let sum = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = (x + dx + NOISE_W) % NOISE_W, yy = (y + dy + NOISE_H) % NOISE_H;
        sum += raw[yy * NOISE_W + xx]; n++;
      }
      noise[y * NOISE_W + x] = sum / n;
    }
    let mn = 1, mx = 0;
    for (let i = 0; i < noise.length; i++) { mn = Math.min(mn, noise[i]); mx = Math.max(mx, noise[i]); }
    for (let i = 0; i < noise.length; i++) noise[i] = (noise[i] - mn) / (mx - mn);
  })();

  /* Desenha B através de uma máscara (função que pinta a opacidade). */
  function drawMasked(ctx, B, W, H, paintMask) {
    const tmp = buffer('mask', W, H);
    const t = tmp.getContext('2d');
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1;
    t.clearRect(0, 0, W, H);
    t.drawImage(B, 0, 0);
    t.globalCompositeOperation = 'destination-in';
    paintMask(t);
    t.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, 0, 0);
  }

  function blurOn(ctx, px) { if (SUPPORTS_FILTER && px > 0.3) ctx.filter = `blur(${px.toFixed(1)}px)`; }
  function blurOff(ctx) { if (SUPPORTS_FILTER) ctx.filter = 'none'; }
  function drawScaled(ctx, img, W, H, s, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.drawImage(img, -W / 2, -H / 2);
    ctx.restore();
  }

  const T = {
    none(ctx, A, B, p) { ctx.drawImage(p < 1 ? A : B, 0, 0); },

    fade(ctx, A, B, p, W, H) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (p < 0.5) { ctx.globalAlpha = 1 - Ease.inOutSine(p * 2); ctx.drawImage(A, 0, 0); }
      else { ctx.globalAlpha = Ease.inOutSine((p - 0.5) * 2); ctx.drawImage(B, 0, 0); }
      ctx.globalAlpha = 1;
    },

    crossfade(ctx, A, B, p) {
      ctx.drawImage(A, 0, 0);
      ctx.globalAlpha = Ease.inOutSine(p); ctx.drawImage(B, 0, 0); ctx.globalAlpha = 1;
    },

    dissolve(ctx, A, B, p, W, H) {
      ctx.drawImage(A, 0, 0);
      const m = buffer('noise', NOISE_W, NOISE_H);
      const mc = m.getContext('2d');
      const im = mc.createImageData(NOISE_W, NOISE_H);
      const q = p * 1.3;
      for (let i = 0; i < noise.length; i++) {
        const a = smooth(noise[i], noise[i] + 0.3, q);
        im.data[i * 4 + 3] = a * 255;
      }
      mc.putImageData(im, 0, 0);
      drawMasked(ctx, B, W, H, t => { t.imageSmoothingEnabled = true; t.drawImage(m, 0, 0, W, H); });
    },

    blur(ctx, A, B, p, W, H) {
      const r = Math.sin(p * Math.PI) * H * 0.035;
      const e = smooth(0.25, 0.75, p);
      blurOn(ctx, r);
      drawScaled(ctx, A, W, H, 1 + 0.06 * p, 1);
      drawScaled(ctx, B, W, H, 1.06 - 0.06 * p, e);
      blurOff(ctx);
    },

    reveal(ctx, A, B, p, W, H, o) {
      const e = Ease.inOutCubic(p), dir = o.dir === -1 ? -1 : 1;
      const feather = W * 0.22;
      ctx.drawImage(A, 0, 0);
      drawMasked(ctx, B, W, H, t => {
        const edge = lerp(-feather, W + feather, e);
        const x0 = dir === 1 ? edge - feather : W - edge + feather;
        const x1 = dir === 1 ? edge : W - edge;
        const g = t.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        t.fillStyle = g; t.fillRect(0, 0, W, H);
      });
    },

    slide(ctx, A, B, p, W, H, o) {
      const e = Ease.outQuint(p), dir = o.dir === -1 ? -1 : 1;
      drawScaled(ctx, A, W, H, 1 - 0.04 * e, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.45 * e})`; ctx.fillRect(0, 0, W, H);
      const x = dir * W * (1 - e);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = W * 0.03;
      ctx.drawImage(B, x, 0);
      ctx.restore();
    },

    push(ctx, A, B, p, W, H, o) {
      const e = Ease.inOutCubic(p), dir = o.dir === -1 ? -1 : 1;
      ctx.drawImage(A, -dir * W * e, 0);
      ctx.drawImage(B, dir * W * (1 - e), 0);
    },

    morph(ctx, A, B, p, W, H) {
      // Morph aproximado: as duas imagens se deformam em escala e foco enquanto se fundem.
      const e = Ease.inOutCubic(p);
      const r = Math.sin(p * Math.PI) * H * 0.02;
      blurOn(ctx, r);
      drawScaled(ctx, A, W, H, 1 + 0.3 * e, 1);
      drawScaled(ctx, B, W, H, 1.3 - 0.3 * e, smooth(0.15, 0.85, p));
      blurOff(ctx);
    },

    parallax(ctx, A, B, p, W, H, o) {
      // Camadas em velocidades diferentes: A recua devagar, B avança mais rápido.
      const e = Ease.inOutCubic(p), dir = o.dir === -1 ? -1 : 1;
      ctx.drawImage(A, -dir * W * 0.35 * e, 0);
      ctx.fillStyle = `rgba(0,0,0,${0.5 * e})`; ctx.fillRect(0, 0, W, H);
      const edge = W * (1 - e);
      ctx.save();
      ctx.beginPath();
      if (dir === 1) ctx.rect(edge, 0, W - edge, H); else ctx.rect(0, 0, W - edge, H);
      ctx.clip();
      ctx.drawImage(B, dir * edge * 0.45, 0);
      ctx.restore();
      // Sombra suave na borda da camada que entra.
      const sx = dir === 1 ? edge : W - edge;
      const g = ctx.createLinearGradient(sx - dir * W * 0.05, 0, sx, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.4 * Math.sin(p * Math.PI)})`);
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(sx, sx - dir * W * 0.05), 0, W * 0.05, H);
    },

    motionBlur(ctx, A, B, p, W, H, o) {
      // Chicote de câmera: deslocamento rápido com rastro proporcional à velocidade.
      const dir = o.dir === -1 ? -1 : 1;
      const e = Ease.inOutQuart(p);
      const v = (Ease.inOutQuart(Math.min(1, p + 0.02)) - Ease.inOutQuart(Math.max(0, p - 0.02))) / 0.04;
      const N = 9;
      for (let i = 0; i < N; i++) {
        const off = clamp(e + (i / (N - 1) - 0.5) * v * 0.07, 0, 1) * W;
        ctx.globalAlpha = 1 / (i + 1);
        ctx.drawImage(A, -dir * off, 0);
        ctx.drawImage(B, dir * (W - off), 0);
      }
      ctx.globalAlpha = 1;
    },

    light(ctx, A, B, p, W, H) {
      // Vazamento de luz: clarão quente que atravessa o quadro enquanto as cenas se fundem.
      ctx.drawImage(A, 0, 0);
      ctx.globalAlpha = smooth(0.3, 0.7, p); ctx.drawImage(B, 0, 0); ctx.globalAlpha = 1;
      const s = Math.sin(p * Math.PI);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const cx = lerp(-0.1, 1.1, Ease.inOutSine(p)) * W, cy = H * 0.4;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.75);
      g.addColorStop(0, `rgba(255,236,190,${0.95 * s})`);
      g.addColorStop(0.35, `rgba(255,170,90,${0.5 * s})`);
      g.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(255,255,255,${0.28 * s * s})`; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    },

    zoom(ctx, A, B, p, W, H) {
      const e = Ease.inOutCubic(p);
      blurOn(ctx, Math.sin(p * Math.PI) * H * 0.012);
      drawScaled(ctx, A, W, H, 1 + 1.2 * e, 1);
      drawScaled(ctx, B, W, H, 1.5 - 0.5 * e, smooth(0.2, 0.8, p));
      blurOff(ctx);
    },

    iris(ctx, A, B, p, W, H, o) {
      const e = Ease.inOutCubic(p);
      const fx = (o.focus ? o.focus.x : 0.5) * W, fy = (o.focus ? o.focus.y : 0.5) * H;
      const R = Math.hypot(W, H) * 1.15 * e;
      ctx.drawImage(A, 0, 0);
      drawMasked(ctx, B, W, H, t => {
        const g = t.createRadialGradient(fx, fy, R * 0.7, fx, fy, R + 1);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        t.fillStyle = g; t.fillRect(0, 0, W, H);
      });
    }
  };

  T.voo = T.parallax;   // fora do estilo Mural, o voo de câmera vira um parallax

  function drawTransition(ctx, A, B, p, W, H, tr) {
    const fn = T[tr.type] || T.crossfade;
    ctx.save();
    fn(ctx, A, B, clamp(p), W, H, tr);
    ctx.restore();
  }

  /* ==========================================================================
     4. ACABAMENTO VISUAL (vinheta, grão de filme, bordas de papel, luz ambiente)
     ========================================================================== */
  let grainTile = null;
  function getGrain() {
    if (grainTile) return grainTile;
    grainTile = document.createElement('canvas');
    grainTile.width = grainTile.height = 256;
    const g = grainTile.getContext('2d');
    const im = g.createImageData(256, 256);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = Math.random() * 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return grainTile;
  }

  function drawLook(ctx, look, W, H, t) {
    if (!look) return;
    ctx.save();
    if (look.lightLeak) {
      // Luz ambiente que passeia devagar: dá vida mesmo às cenas paradas.
      ctx.globalCompositeOperation = 'screen';
      const cx = (0.5 + 0.45 * Math.sin(t * 0.21)) * W, cy = (0.3 + 0.2 * Math.cos(t * 0.17)) * H;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.6);
      g.addColorStop(0, `rgba(255,214,150,${0.22 * look.lightLeak})`);
      g.addColorStop(1, 'rgba(255,160,90,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (look.tint) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = look.tint; ctx.globalAlpha = look.tintAmount == null ? 0.25 : look.tintAmount;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (look.vignette) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.75 * look.vignette})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (look.paperEdge) {
      // Borda clara e difusa, como aquarela sobre papel (modelo Inspiração Waldorf).
      const c = look.paperColor || '250,244,230';
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.56);
      g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.75, `rgba(${c},${0.55 * look.paperEdge})`);
      g.addColorStop(1, `rgba(${c},${0.95 * look.paperEdge})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (look.grain) {
      const tile = getGrain();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.16 * look.grain;
      const ox = -Math.floor(Math.random() * 256), oy = -Math.floor(Math.random() * 256);
      const sc = Math.max(1, H / 720);
      for (let y = oy * sc; y < H; y += 256 * sc) for (let x = ox * sc; x < W; x += 256 * sc) ctx.drawImage(tile, x, y, 256 * sc, 256 * sc);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (look.letterbox) {
      // Faixas de cinema (proporção 2.39:1).
      const bar = Math.max(0, (H - W / 2.39) / 2) * look.letterbox;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
    }
    ctx.restore();
  }

  /* ==========================================================================
     5. TEXTOS E ANIMAÇÕES DE TEXTO
     ========================================================================== */
  const TEXT_ANIMS = [
    { id: 'fade', label: 'Fade' },
    { id: 'slide', label: 'Deslizar' },
    { id: 'zoom', label: 'Zoom' },
    { id: 'reveal', label: 'Revelar' },
    { id: 'typewriter', label: 'Máquina de escrever' },
    { id: 'cinematic', label: 'Título cinematográfico' }
  ];

  function measure(ctx, str, sp) {
    if (!sp) return ctx.measureText(str).width;
    let w = 0;
    for (const ch of str) w += ctx.measureText(ch).width + sp;
    return Math.max(0, w - sp);
  }
  function fillSpaced(ctx, str, x, y, sp) {
    if (!sp) { ctx.fillText(str, x, y); return; }
    for (const ch of str) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + sp; }
  }
  function wrapLines(ctx, text, maxW, sp) {
    const out = [];
    String(text).split('\n').forEach(par => {
      const words = par.split(/\s+/).filter(Boolean);
      if (!words.length) { out.push(''); return; }
      let line = words[0];
      for (let i = 1; i < words.length; i++) {
        const test = line + ' ' + words[i];
        if (measure(ctx, test, sp) <= maxW) line = test; else { out.push(line); line = words[i]; }
      }
      out.push(line);
    });
    return out;
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawText(ctx, tx, tl, W, H) {
    const d = tx.duration;
    const inD = Math.min(1.0, d * 0.35), outD = Math.min(0.7, d * 0.3);
    const pin = clamp(tl / inD), pout = clamp((d - tl) / outD);
    const eIn = Ease.outCubic(pin);
    let alpha = Math.min(pin, pout), dy = 0, scale = 1, clipW = 1, chars = Infinity;
    let spacing = tx.spacing || 0, blur = 0, rules = 0;

    switch (tx.anim || 'fade') {
      case 'slide': alpha = Math.min(eIn, pout); dy = (1 - eIn) * 0.06 * H - (1 - pout) * 0.02 * H; break;
      case 'zoom': alpha = Math.min(eIn, pout); scale = lerp(0.78, 1, eIn) * lerp(1.06, 1, pout); break;
      case 'reveal': alpha = pout; clipW = Ease.inOutCubic(pin); break;
      case 'typewriter': {
        const len = String(tx.text).length;
        const typeD = Math.min(d * 0.55, Math.max(0.6, len * 0.055));
        chars = Math.floor(len * clamp(tl / typeD)); alpha = pout; break;
      }
      case 'cinematic':
        alpha = Math.min(Ease.inOutSine(pin), pout);
        spacing += (1 - eIn) * 0.35; blur = (1 - eIn) * 0.012 * H; rules = eIn * pout; break;
      default: alpha = Math.min(Ease.inOutSine(pin), pout);
    }
    if (alpha <= 0.002) return;

    const size = (tx.size || 6) / 100 * H * scale;
    ctx.save();
    ctx.font = `${tx.italic ? 'italic ' : ''}${tx.weight || 400} ${size}px ${tx.font || 'sans-serif'}`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const raw = tx.upper ? String(tx.text).toUpperCase() : String(tx.text);
    const sp = spacing * size;
    const lines = wrapLines(ctx, raw, W * (tx.maxWidth || 0.84), sp);
    const widths = lines.map(l => measure(ctx, l, sp));
    const maxW = Math.max(1, ...widths);
    const lh = size * (tx.lineHeight || 1.25);
    const totalH = lines.length * lh;
    const align = tx.align || 'center';
    const ax = (tx.x == null ? 0.5 : tx.x) * W, ay = (tx.y == null ? 0.5 : tx.y) * H + dy;
    const bx = align === 'left' ? ax : align === 'right' ? ax - maxW : ax - maxW / 2;
    const by = ay - totalH / 2;

    ctx.globalAlpha = alpha;
    if (clipW < 1) { ctx.beginPath(); ctx.rect(bx - size, by - size, (maxW + 2 * size) * clipW, totalH + 2 * size); ctx.clip(); }
    if (tx.bg && tx.bg !== 'none') {
      const padX = size * (tx.bg === 'bar' ? 0.7 : 0.5), padY = size * 0.32;
      ctx.fillStyle = tx.bgColor || 'rgba(0,0,0,0.5)';
      roundRect(ctx, bx - padX, by - padY, maxW + 2 * padX, totalH + 2 * padY, tx.bg === 'bar' ? size * 0.2 : size * 0.45);
      ctx.fill();
    }
    if (blur > 0.3 && SUPPORTS_FILTER) ctx.filter = `blur(${blur.toFixed(1)}px)`;
    if (tx.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = size * 0.28; ctx.shadowOffsetY = size * 0.05; }
    ctx.fillStyle = tx.color || '#fff';
    let count = 0;
    lines.forEach((line, i) => {
      let str = line;
      if (chars !== Infinity) { str = line.slice(0, Math.max(0, chars - count)); count += line.length + 1; }
      const x = align === 'left' ? bx : align === 'right' ? bx + maxW - widths[i] : bx + (maxW - widths[i]) / 2;
      fillSpaced(ctx, str, x, by + lh * (i + 0.5), sp);
    });
    if (rules > 0.01) {
      // Filetes finos acima e abaixo do título cinematográfico.
      ctx.shadowColor = 'transparent'; if (SUPPORTS_FILTER) ctx.filter = 'none';
      const rw = maxW * 0.6 * rules, th = Math.max(1, size * 0.03), cx = bx + maxW / 2;
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillRect(cx - rw / 2, by - size * 0.35, rw, th);
      ctx.fillRect(cx - rw / 2, by + totalH + size * 0.3, rw, th);
    }
    ctx.restore();
  }


  /* ==========================================================================
     6. ESTILO MURAL
     Calibrado pelo vídeo de referência do CofeShow: as fotos são impressões com
     borda branca, levemente inclinadas, sobre uma superfície decorada, e a
     câmera VOA de uma foto para a outra em vez de trocar de slide.
     Medidas do vídeo (30 qps): pausa quase parada, uma antecipação que acelera
     aos poucos, cerca de 0,85 s de deslocamento rápido em velocidade constante
     e 0,8 s de acomodação; período de 3,85 s por foto; abertura e encerramento
     com fade linear de 1 s.
     ========================================================================== */
  const SURFACES = [
    { id: 'madeira', label: 'Madeira clara' }, { id: 'papel', label: 'Papel aquarela' }, { id: 'linho', label: 'Linho' },
    { id: 'cortica', label: 'Cortiça' }, { id: 'ardosia', label: 'Ardósia escura' },
    { id: 'imagem', label: 'Imagem própria (importada)' }
  ];
  const DECORS = [
    { id: 'flores', label: 'Flores de papel' }, { id: 'folhas', label: 'Ramos e folhas' },
    { id: 'confete', label: 'Confete' }, { id: 'nenhum', label: 'Sem decoração' }
  ];
  const TAU = Math.PI * 2;
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* Superfícies geradas por código (sem arquivos de imagem), em azulejos que se repetem sem emenda. */
  const tiles = {}, patterns = {};
  function speckle(g, N, amount) {
    const im = g.getImageData(0, 0, N, N), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const v = (Math.random() - 0.5) * amount; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
    g.putImageData(im, 0, 0);
  }
  function surfaceTile(id) {
    if (tiles[id]) return tiles[id];
    const N = 1024, c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d'), r = rng(77);
    const wrapped = draw => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.save(); g.translate(ox, oy); draw(); g.restore(); } };
    if (id === 'papel') {
      g.fillStyle = '#f4eee1'; g.fillRect(0, 0, N, N);
      const washes = ['232,112,90', '79,143,204', '246,211,85', '143,177,132', '238,193,189'];
      for (let i = 0; i < 9; i++) {
        const x = r() * N, y = r() * N, rad = 140 + r() * 220, col = washes[i % washes.length], a = 0.1 + r() * 0.12;
        wrapped(() => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); });
      }
      speckle(g, N, 14);
    } else if (id === 'linho') {
      g.fillStyle = '#d8d1c3'; g.fillRect(0, 0, N, N);
      for (let y = 0; y < N; y += 3) { g.fillStyle = `rgba(110,100,86,${0.04 + r() * 0.1})`; g.fillRect(0, y, N, 1); }
      for (let x = 0; x < N; x += 3) { g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.09})`; g.fillRect(x, 0, 1, N); }
      speckle(g, N, 10);
    } else if (id === 'cortica') {
      g.fillStyle = '#b98f62'; g.fillRect(0, 0, N, N);
      for (let i = 0; i < 5200; i++) {
        const x = r() * N, y = r() * N, w = 1 + r() * 5, h = 1 + r() * 3;
        g.fillStyle = r() < 0.6 ? `rgba(90,58,30,${0.12 + r() * 0.3})` : `rgba(240,210,170,${0.1 + r() * 0.25})`;
        g.beginPath(); g.ellipse(x, y, w, h, r() * 3.14, 0, TAU); g.fill();
      }
      speckle(g, N, 12);
    } else if (id === 'ardosia') {
      g.fillStyle = '#262a32'; g.fillRect(0, 0, N, N);
      for (let i = 0; i < 9; i++) {
        const x = r() * N, y = r() * N, rad = 160 + r() * 240;
        wrapped(() => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(120,130,150,0.1)'); gr.addColorStop(1, 'rgba(120,130,150,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); });
      }
      for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(220,225,235,${0.03 + r() * 0.06})`; g.lineWidth = 0.6 + r(); g.beginPath(); const x = r() * N, y = r() * N; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 260, y + (r() - 0.5) * 60); g.stroke(); }
      speckle(g, N, 12);
    } else {
      // Madeira clara em tábuas horizontais, como no vídeo de referência.
      g.fillStyle = '#b9b1a5'; g.fillRect(0, 0, N, N);
      const rows = 8, ph = N / rows;
      for (let row = 0; row < rows; row++) {
        const y0 = row * ph, tone = r();
        g.fillStyle = tone < 0.5 ? `rgba(255,250,240,${tone * 0.22})` : `rgba(70,60,50,${(tone - 0.5) * 0.2})`;
        g.fillRect(0, y0, N, ph);
        for (let k = 0; k < 30; k++) {                       // veios
          const y = y0 + 5 + r() * (ph - 10), amp = 0.8 + r() * 3.2, per = 1 + Math.floor(r() * 3), phs = r() * TAU;
          g.strokeStyle = r() < 0.7 ? `rgba(80,68,56,${0.05 + r() * 0.12})` : `rgba(255,250,240,${0.06 + r() * 0.12})`;
          g.lineWidth = 0.6 + r() * 1.4;
          g.beginPath();
          for (let x = 0; x <= N; x += 16) { const yy = y + Math.sin(x / N * TAU * per + phs) * amp; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
          g.stroke();
        }
        if (r() < 0.6) {                                     // nó da madeira
          const kx = 80 + r() * (N - 160), ky = y0 + ph * (0.3 + r() * 0.4);
          for (let q = 4; q > 0; q--) { g.strokeStyle = `rgba(70,58,46,${0.1 + 0.05 * q})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(kx, ky, q * 7, q * 3.2, 0, 0, TAU); g.stroke(); }
        }
        g.fillStyle = 'rgba(58,50,42,0.6)'; g.fillRect(0, y0, N, 2.5);                 // fresta entre tábuas
        g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(0, y0 + 2.5, N, 1.5);
        g.fillStyle = 'rgba(58,50,42,0.45)'; g.fillRect(r() * N, y0, 2, ph);           // emenda
      }
      speckle(g, N, 9);
    }
    tiles[id] = c;
    return c;
  }

  /* Superfície importada pelo usuário: a imagem já chega ajustada (azulejo quadrado sem emendas)
     e fica guardada no modelo ou no projeto como texto (data URL). */
  const customTiles = {};
  const tileKey = url => 'img:' + url.length + ':' + url.slice(-48);
  function registerTile(url, canvas) { customTiles[tileKey(url)] = canvas; }
  function customTile(url) {
    const key = tileKey(url), c = customTiles[key];
    if (c && c !== 'loading') return c;
    if (!c) {
      customTiles[key] = 'loading';
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = im.naturalWidth; cv.height = im.naturalHeight;
        cv.getContext('2d').drawImage(im, 0, 0);
        customTiles[key] = cv;
        if (FF.App && FF.App.draw) FF.App.draw();       // redesenha quando a superfície termina de carregar
      };
      im.onerror = () => { delete customTiles[key]; };
      im.src = url;
    }
    return null;
  }

  /* Decorações desenhadas por código, em unidades do mural (1 = largura de uma foto). */
  function drawFlower(ctx, r, size, fill) {
    const petals = 9 + Math.floor(r() * 4);
    ctx.lineWidth = size * 0.012; ctx.strokeStyle = 'rgba(96,84,72,0.4)';
    [1, 0.68, 0.4].forEach((ring, q) => {
      ctx.fillStyle = q === 1 ? 'rgba(236,231,222,0.97)' : fill;
      for (let i = 0; i < petals; i++) {
        ctx.save(); ctx.rotate(i / petals * TAU + q * 0.35);
        ctx.beginPath(); ctx.ellipse(size * 0.3 * ring, 0, size * 0.24 * ring, size * 0.12 * ring, 0, 0, TAU);
        ctx.fill(); ctx.stroke(); ctx.restore();
      }
    });
    ctx.fillStyle = 'rgba(214,200,180,1)'; ctx.beginPath(); ctx.arc(0, 0, size * 0.07, 0, TAU); ctx.fill(); ctx.stroke();
  }
  function drawSprig(ctx, r, size, color) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = size * 0.02; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-size * 0.5, size * 0.1); ctx.quadraticCurveTo(0, -size * 0.12, size * 0.5, -size * 0.05); ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const t = 0.1 + i * 0.13, x = -size * 0.5 + size * t, y = size * 0.1 - size * 0.32 * t + size * 0.2 * t * t, side = i % 2 ? 1 : -1;
      ctx.save(); ctx.translate(x, y); ctx.rotate(side * 0.9 - 0.15);
      ctx.beginPath(); ctx.ellipse(size * 0.09, 0, size * (0.1 - i * 0.006), size * 0.04, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  function drawConfetti(ctx, r, size, colors) {
    for (let i = 0; i < 12; i++) {
      ctx.save(); ctx.translate((r() - 0.5) * size * 1.3, (r() - 0.5) * size * 1.3); ctx.rotate(r() * TAU);
      ctx.fillStyle = colors[i % colors.length];
      if (i % 3 === 0) { ctx.beginPath(); ctx.arc(0, 0, size * 0.035, 0, TAU); ctx.fill(); }
      else ctx.fillRect(-size * 0.05, -size * 0.018, size * 0.1, size * 0.036);
      ctx.restore();
    }
  }
  function drawDecor(ctx, L, project) {
    const bd = project.board || {}, kind = bd.decor || 'flores';
    if (kind === 'nenhum') return;
    const r = rng(L.seed), pal = project.palette || {};
    const n = 3 + Math.floor(r() * 2);
    for (let j = 0; j < n; j++) {
      const ang = r() * TAU, size = 0.2 + r() * 0.17;
      const x = L.x + Math.cos(ang) * (L.w * 0.5 + 0.1 + r() * 0.2), y = L.y + Math.sin(ang) * (L.h * 0.5 + 0.08 + r() * 0.16);
      ctx.save(); ctx.translate(x, y); ctx.rotate(r() * TAU);
      if (kind === 'confete') drawConfetti(ctx, r, size * 1.5, [pal.accent || '#ffd23f', pal.primary || '#ff5d8f', '#ffffff', '#4fb6a8']);
      else if (kind === 'folhas' || j % 2) drawSprig(ctx, r, size * 1.5, j % 3 ? 'rgba(150,164,140,0.9)' : 'rgba(120,138,116,0.9)');
      else drawFlower(ctx, r, size, j % 4 === 0 ? 'rgba(246,243,237,0.97)' : 'rgba(238,224,214,0.97)');
      ctx.restore();
    }
  }

  /* Disposição das fotos no mural: um caminho em zigue-zague descendo, como no vídeo de referência. */
  let layoutCache = { key: '', value: [] };
  function boardLayout(project) {
    const bd = project.board || {}, tilt = bd.tilt == null ? 0.5 : bd.tilt;
    const key = project.scenes.map(s => s.id + ':' + s.mediaId).join('|') + '|' + tilt;
    if (layoutCache.key === key) return layoutCache.value;
    const r = rng(4242), out = [];
    let x = 0, y = 0, dir = 1;
    project.scenes.forEach((sc, i) => {
      const img = sc.mediaId && FF.media ? FF.media.image(sc.mediaId) : null;
      const a = clamp(img ? (img.naturalWidth || img.width) / (img.naturalHeight || img.height) : 1.5, 0.7, 1.7);
      if (i) { x += dir * (1.35 + 0.3 * r()); y += 0.78 + 0.3 * r(); dir = r() < 0.2 ? dir : -dir; }
      out.push({ x, y, w: a >= 1 ? 1 : a, h: a >= 1 ? 1 / a : 1, rot: (i % 2 ? 1 : -1) * (0.03 + 0.07 * r()) * tilt * 2, seed: 1000 + i * 97 });
    });
    layoutCache = { key, value: out };
    return out;
  }

  /* Enquadramento de uma foto do mural, com o leve movimento durante a pausa. */
  function homePose(project, item, t, W, H) {
    const L = boardLayout(project)[item.index], sc = item.scene, cam = sc.camera || {};
    const k = cam.intensity == null ? 0.5 : cam.intensity, dir = cam.dir === -1 ? -1 : 1;
    const e = clamp((t - item.start) / sc.duration) - 0.5;
    let z = 1, dx = 0, dy = 0;
    switch (cam.type) {
      case 'static': break;
      case 'zoomOut': case 'dollyOut': z = 1 - 0.07 * k * e; break;
      case 'panH': case 'travelling': case 'orbit': dx = 0.09 * k * e * dir; break;
      case 'panV': case 'tilt': dy = 0.07 * k * e * dir; break;
      default: z = 1 + 0.07 * k * e;
    }
    return { x: L.x + dx, y: L.y + dy, scale: Math.min(0.62 * W / L.w, 0.8 * H / L.h) * z, roll: 0 };
  }

  /* Curva do voo medida no vídeo: trecho rápido em velocidade constante e acomodação exponencial. */
  const CREEP = 0.04;
  function flight(u) {
    if (u < 0.5) return CREEP + (0.85 - CREEP) * (u / 0.5);
    const v = (u - 0.5) / 0.5, k = 4;
    return 0.85 + 0.15 * (1 - Math.exp(-k * v)) / (1 - Math.exp(-k));
  }
  const isFlight = it => it && it.transition > 0 && (it.scene.transition || {}).type === 'voo';
  function mixPose(a, b, s, bump) {
    const arc = Math.sin(Math.PI * clamp(s));
    return { x: lerp(a.x, b.x, s), y: lerp(a.y, b.y, s),
      scale: Math.exp(lerp(Math.log(a.scale), Math.log(b.scale), s)) * (1 - 0.05 * arc * (bump ? 1 : 0)),
      roll: lerp(a.roll, b.roll, s) + (bump || 0) * 0.035 * arc };
  }
  function poseAt(project, sch, t, W, H) {
    const items = sch.items;
    let k = 0;
    items.forEach((it, i) => { if (t >= it.start) k = i; });
    const cur = items[k], prev = items[k - 1], next = items[k + 1];
    if (prev && t < prev.end && isFlight(prev)) {
      const u = (t - cur.start) / Math.max(0.001, prev.end - cur.start);
      return mixPose(homePose(project, prev, t, W, H), homePose(project, cur, t, W, H), flight(clamp(u)), k % 2 ? 1 : -1);
    }
    let pose = homePose(project, cur, t, W, H);
    if (next && isFlight(cur)) {
      // Antecipação: a câmera começa a escorregar em direção à próxima foto antes de partir.
      const c = CREEP * Math.exp(-(next.start - t) / 0.45);
      pose = mixPose(pose, homePose(project, next, t, W, H), c, 0);
    }
    return pose;
  }

  function drawPrint(ctx, project, scene, L, S) {
    const bd = project.board || {}, look = project.look || {};
    const img = scene.mediaId && FF.media ? FF.media.image(scene.mediaId) : null;
    const b = 0.034;
    ctx.save();
    ctx.translate(L.x, L.y); ctx.rotate(L.rot);
    ctx.shadowColor = 'rgba(0,0,0,0.42)'; ctx.shadowBlur = S * 0.035; ctx.shadowOffsetX = S * 0.006; ctx.shadowOffsetY = S * 0.014;
    ctx.fillStyle = bd.frame || '#ffffff';
    ctx.fillRect(-L.w / 2 - b, -L.h / 2 - b, L.w + 2 * b, L.h + 2 * b);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    if (img) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, ta = L.w / L.h;
      const f = (scene.camera && scene.camera.focus) || { x: 0.5, y: 0.5 };
      let sw = iw, sh = ih, sx = 0, sy = 0;
      if (iw / ih > ta) { sw = ih * ta; sx = clamp(f.x * iw - sw / 2, 0, iw - sw); } else { sh = iw / ta; sy = clamp(f.y * ih - sh / 2, 0, ih - sh); }
      const filters = [look.filter, scene.filter].filter(Boolean).join(' ');
      if (SUPPORTS_FILTER && filters) ctx.filter = filters;
      ctx.drawImage(img, sx, sy, sw, sh, -L.w / 2, -L.h / 2, L.w, L.h);
      if (SUPPORTS_FILTER) ctx.filter = 'none';
    } else {
      ctx.fillStyle = (project.palette || {}).primary || '#2c3447';
      ctx.fillRect(-L.w / 2, -L.h / 2, L.w, L.h);
    }
    ctx.restore();
  }

  function renderBoard(ctx, project, pose, W, H) {
    const layout = boardLayout(project), bd = project.board || {};
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.translate(W / 2, H / 2); ctx.rotate(pose.roll); ctx.scale(pose.scale, pose.scale); ctx.translate(-pose.x, -pose.y);
    // Superfície: um azulejo cobre 2,6 larguras de foto.
    let id = bd.surface || 'madeira', tile = null, pkey = id;
    if (id === 'imagem' && bd.image) { tile = customTile(bd.image); pkey = tileKey(bd.image); }
    if (!tile) { if (id === 'imagem') id = pkey = 'madeira'; tile = surfaceTile(id); }   // enquanto carrega, ou sem imagem
    if (!patterns[pkey]) patterns[pkey] = ctx.createPattern(tile, 'repeat');
    const k = 2.6 / tile.width, R = Math.hypot(W, H) / pose.scale / 2 + 0.3;
    ctx.save(); ctx.scale(k, k); ctx.fillStyle = patterns[pkey];
    ctx.fillRect((pose.x - R) / k, (pose.y - R) / k, 2 * R / k, 2 * R / k); ctx.restore();
    const near = L => Math.hypot(L.x - pose.x, L.y - pose.y) < R + 1.3;
    layout.forEach(L => { if (near(L)) drawDecor(ctx, L, project); });
    layout.forEach((L, i) => { if (near(L)) drawPrint(ctx, project, project.scenes[i], L, pose.scale); });
    ctx.restore();
  }

  /* ==========================================================================
     7. QUADRO FINAL
     ========================================================================== */
  function render(ctx, project, t, opts) {
    opts = opts || {};
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const sch = opts.schedule || schedule(project);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (SUPPORTS_FILTER) ctx.filter = 'none';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

    // Cenas ativas neste instante (uma, ou duas durante a transição).
    const active = sch.items.filter(it => t >= it.start && t < it.end);
    if (!active.length && sch.items.length && t >= sch.total) active.push(sch.items[sch.items.length - 1]);
    const mural = project.style === 'mural' && sch.items.length > 0;
    if (mural && !(active.length >= 2 && !isFlight(active[active.length - 2]))) {
      // Mural: uma única câmera percorre a superfície (pausa, antecipação, voo e acomodação).
      renderBoard(ctx, project, poseAt(project, sch, t, W, H), W, H);
    } else if (mural) {
      // Mural com outra transição (ex.: crossfade): funde as duas vistas do mural.
      const a = active[active.length - 2], b = active[active.length - 1];
      const A = buffer('sceneA', W, H), B = buffer('sceneB', W, H);
      renderBoard(A.getContext('2d'), project, homePose(project, a, t, W, H), W, H);
      renderBoard(B.getContext('2d'), project, homePose(project, b, t, W, H), W, H);
      drawTransition(ctx, A, B, (t - b.start) / Math.max(0.001, a.end - b.start), W, H, Object.assign({}, a.scene.transition));
    } else if (active.length >= 2) {
      const a = active[active.length - 2], b = active[active.length - 1];
      const A = buffer('sceneA', W, H), B = buffer('sceneB', W, H);
      renderScene(A, project, a.scene, (t - a.start) / a.scene.duration);
      renderScene(B, project, b.scene, (t - b.start) / b.scene.duration);
      const span = Math.max(0.001, a.end - b.start);
      const tr = Object.assign({ focus: (b.scene.camera || {}).focus }, a.scene.transition);
      drawTransition(ctx, A, B, (t - b.start) / span, W, H, tr);
    } else if (active.length === 1) {
      const a = active[0], A = buffer('sceneA', W, H);
      renderScene(A, project, a.scene, clamp((t - a.start) / a.scene.duration));
      ctx.drawImage(A, 0, 0);
    }

    if (opts.look !== false) drawLook(ctx, project.look, W, H, t);

    // Abertura e encerramento suaves do filme.
    if (project.fadeEdges !== false && sch.total > 2 && sch.items.length) {
      // Fade linear de 1 s na abertura e no encerramento, como no vídeo de referência.
      const a = 1 - Math.min(clamp(t / 1.0), clamp((sch.total - t) / 1.0));
      if (a > 0.003) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); }
    }

    if (opts.texts !== false) {
      (project.texts || []).forEach(tx => {
        if (t >= tx.start && t <= tx.start + tx.duration) drawText(ctx, tx, t - tx.start, W, H);
      });
    }
  }

  FF.Engine = {
    Ease, clamp, lerp, schedule, transitionDuration, cameraState, render, renderScene, drawText,
    CAMERAS, TRANSITIONS, TEXT_ANIMS, SURFACES, DECORS, SUPPORTS_FILTER, boardLayout, poseAt, flight, registerTile, customTile,
    label(list, id) { const f = list.find(x => x.id === id); return f ? f.label : id; }
  };
})(window.FF = window.FF || {});
