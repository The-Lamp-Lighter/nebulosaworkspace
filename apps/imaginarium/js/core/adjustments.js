/* ==========================================================================
   Imaginarium — ajustes (Imagem › Ajustes e camadas de ajuste)
   Cada ajuste define: valores padrão, preparo (parâmetros do núcleo),
   interface (usada no diálogo e no painel Propriedades) e o núcleo.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const Layers = IMG.Layers;

  /* ==================================================================
     Sessão de edição de pixels (ajustes e filtros destrutivos)
     Funciona na camada ativa ou na máscara em edição; respeita a seleção.
     ================================================================== */
  function beginSession(o = {}) {
    const doc = IMG.app.doc, UI = IMG.UI;
    if (!doc) return null;
    const L = doc.active;
    if (!L) { UI.toast('Selecione uma camada para aplicar o efeito.'); return null; }
    const onMask = !!(doc.editMask && L.mask) && o.allowMask !== false;
    if (!onMask) {
      if (L.type === 'group') { UI.toast('Selecione uma camada (não um grupo) para aplicar o efeito.'); return null; }
      if (L.type === 'adjust') { UI.toast('Camadas de ajuste não têm pixels. Edite a máscara ou selecione outra camada.'); return null; }
      if (L.type === 'smart' && o.smart !== false && IMG.Smart && o.smartFilter) return { smart: true, L };
    }
    if (!Layers.isVisible(L)) { UI.toast('A camada ativa está oculta.'); return null; }
    if (Layers.isLocked(L) || (!onMask && L.lockPaint)) { UI.toast('A camada ativa está bloqueada.'); return null; }
    let rasterized = false;
    if (!onMask && L.type !== 'raster') {
      Layers.rasterize(doc, L); rasterized = true; bus.emit('layers:change', doc);
      UI.toast('A camada foi rasterizada para receber o efeito.');
    }
    const surf = onMask ? L.mask : L;
    if (!onMask && o.fullDoc) L.ensureCovers(doc.rect);
    const c = surf.canvas, w = c.width, h = c.height, ctx = c.getContext('2d');
    let src;
    try { src = ctx.getImageData(0, 0, w, h); } catch (e) { UI.toast('Não foi possível ler os pixels da camada.', 'error'); return null; }
    let work = src;
    if (onMask) {
      // a máscara é guardada no alfa; os núcleos trabalham sobre cinza opaco
      work = new ImageData(w, h);
      const s = src.data, d = work.data;
      for (let i = 0; i < s.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = s[i + 3]; d[i + 3] = 255; }
    }
    const mask = IMG.Selection.maskFor(doc, { x: surf.x, y: surf.y, w, h });
    const chan = !onMask && doc.chanMask ? doc.chanMask : null;
    let busy = false, pending = null, alive = true, idle = [], applied = false;
    const toSurface = (img) => {
      if (onMask) {
        const out = new ImageData(w, h), s = img.data, d = out.data;
        for (let i = 0; i < s.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]); }
        return out;
      }
      if (chan) {
        const s = src.data, d = img.data;
        for (let i = 0; i < d.length; i += 4) { if (!chan.r) d[i] = s[i]; if (!chan.g) d[i + 1] = s[i + 1]; if (!chan.b) d[i + 2] = s[i + 2]; }
      }
      return img;
    };
    const S = {
      L, src: work, w, h, onMask, doc,
      run(name, params) {
        if (!alive) return;
        if (busy) { pending = [name, params]; return; }
        busy = true;
        IMG.Filters.run(name, work, params, mask).then((img) => {
          busy = false;
          if (!alive) return;
          if (pending) { const p = pending; pending = null; S.run(p[0], p[1]); return; }
          ctx.putImageData(toSurface(img), 0, 0); applied = true;
          IMG.markDirty(surf); IMG.Effects.invalidate(L);
          IMG.Engine.invalidate();
          const fns = idle; idle = []; fns.forEach((f) => f());
        }).catch((err) => { busy = false; UI.fail(err); const fns = idle; idle = []; fns.forEach((f) => f()); });
      },
      /** Aplica uma função síncrona (data, w, h) → altera data. */
      runFn(fn) {
        const img = new ImageData(new Uint8ClampedArray(work.data), w, h);
        fn(img.data, w, h);
        if (mask) { const s = work.data, d = img.data; for (let i = 0, j = 0; i < d.length; i += 4, j++) { const t = mask[j] / 255; if (t >= 1) continue; d[i] = s[i] + (d[i] - s[i]) * t; d[i + 1] = s[i + 1] + (d[i + 1] - s[i + 1]) * t; d[i + 2] = s[i + 2] + (d[i + 2] - s[i + 2]) * t; d[i + 3] = s[i + 3] + (d[i + 3] - s[i + 3]) * t; } }
        ctx.putImageData(toSurface(img), 0, 0); applied = true;
        IMG.markDirty(surf); IMG.Effects.invalidate(L); IMG.Engine.invalidate();
      },
      whenIdle(fn) { if (busy || pending) idle.push(fn); else fn(); },
      showOriginal() { pending = null; S.whenIdle(() => { ctx.putImageData(src, 0, 0); applied = false; IMG.markDirty(surf); IMG.Effects.invalidate(L); IMG.Engine.invalidate(); }); },
      commit(label) {
        return new Promise((res) => S.whenIdle(() => {
          alive = false;
          if (applied || rasterized) { IMG.markDirty(surf); bus.emit('layer:pixels', L); IMG.commit(label); IMG.lastPixelOp = { layerId: L.id, label, onMask }; }
          res();
        }));
      },
      cancel() {
        alive = false; pending = null;
        ctx.putImageData(src, 0, 0);
        IMG.markDirty(surf); IMG.Effects.invalidate(L);
        if (rasterized) doc.history.restore(doc.history.current);
        IMG.Engine.invalidate();
      }
    };
    return S;
  }

  /** Diálogo padrão de efeito com pré-visualização ao vivo. */
  function fxDialog(o) {
    const UI = IMG.UI;
    const S = o.session || beginSession(o.sessionOpts);
    if (!S || S.smart) return null;
    let preview = true, done = false;
    const run = () => { if (o.fn) S.runFn((d, w, h) => o.fn(d, w, h, o.params())); else S.run(o.kernel, o.params()); };
    const update = U.debounce(() => { if (preview && !done) run(); }, o.delay || 24);
    const chk = UI.check('Visualizar', true, (v) => { preview = v; if (v) update(); else S.showOriginal(); });
    const footLeft = [chk.el];
    if (o.reset) footLeft.push(UI.btn('Redefinir', () => { o.reset(); update(); }, { small: true }));
    const dlg = UI.dialog({
      title: o.title, width: Math.max(320, o.width || 360), clear: true, body: typeof o.body === 'function' ? o.body(update) : o.body, className: 'fx-dialog',
      offset: { x: Math.max(0, Math.min(260, window.innerWidth / 2 - 420)), y: -40 },
      footLeft,
      buttons: [
        { label: 'Cancelar' },
        { label: 'OK', primary: true, onClick: (d) => {
          if (done) return false;
          done = true;
          U.$$('button', d.foot).forEach((b) => { b.disabled = true; });
          update.cancel();
          preview = true; run();
          S.commit(o.title).then(() => d.close('ok'));
          return false;
        } }
      ],
      onClose: (v) => { if (v !== 'ok') { done = true; update.cancel(); S.cancel(); } if (o.onDone) o.onDone(v === 'ok'); }
    });
    update();
    return { S, dlg, update };
  }
  IMG.FXSession = { begin: beginSession, dialog: fxDialog };

  /* ==================================================================
     Construtores de interface
     ================================================================== */
  const sl = (p, ch, key, label, min, max, o = {}) => IMG.UI.slider({ label, value: p[key], min, max, step: o.step || 1, unit: o.unit || '', def: o.def != null ? o.def : 0, stack: true, decimals: o.decimals, pow: o.pow,
    onInput: (v) => { p[key] = v; ch(false); }, onChange: (v) => { p[key] = v; ch(true); } });
  const chk = (p, ch, key, label) => el('div.form-row.solo', IMG.UI.check(label, p[key], (v) => { p[key] = v; ch(true); }).el);
  const presetSel = (list, apply) => {
    const s = IMG.UI.select([['', 'Predefinição…']].concat(list.map((x, i) => [String(i), x[0]])), '', (v) => { if (v !== '') apply(list[+v][1]); s.set(''); }, { keepFocus: true });
    return s.el;
  };
  const rebuild = (box, fn) => { U.clear(box); fn(box); };

  /* faixas de matiz do Photoshop (graus) */
  const HUE_RANGES = {
    reds: [315, 345, 15, 45], yellows: [15, 45, 75, 105], greens: [75, 105, 135, 165],
    cyans: [135, 165, 195, 225], blues: [195, 225, 255, 285], magentas: [255, 285, 315, 345]
  };
  const HUE_NAMES = [['master', 'Principal'], ['reds', 'Vermelhos'], ['yellows', 'Amarelos'], ['greens', 'Verdes'], ['cyans', 'Cianos'], ['blues', 'Azuis'], ['magentas', 'Magentas']];

  const PHOTO_FILTERS = [
    ['warming85', 'Filtro de aquecimento (85)', '#ec8a00'], ['warmingLBA', 'Filtro de aquecimento (LBA)', '#fa9600'], ['warming81', 'Filtro de aquecimento (81)', '#ebb113'],
    ['cooling80', 'Filtro de resfriamento (80)', '#006dff'], ['coolingLBB', 'Filtro de resfriamento (LBB)', '#005dff'], ['cooling82', 'Filtro de resfriamento (82)', '#00b5ff'],
    ['red', 'Vermelho', '#ea1a1a'], ['orange', 'Laranja', '#f28f17'], ['yellow', 'Amarelo', '#f9e31c'], ['green', 'Verde', '#19c919'], ['cyan', 'Ciano', '#1dcbea'],
    ['blue', 'Azul', '#1d35ea'], ['violet', 'Violeta', '#9b1dea'], ['magenta', 'Magenta', '#e318e3'], ['sepia', 'Sépia', '#ac7a33'], ['deepRed', 'Vermelho profundo', '#ff0000'],
    ['deepBlue', 'Azul profundo', '#0022cd'], ['deepEmerald', 'Esmeralda profundo', '#008c00'], ['deepYellow', 'Amarelo profundo', '#ffd500'], ['underwater', 'Subaquático', '#00c1b1']
  ];

  /* ---------- Pesquisa de cores: looks embutidos (tabelas 3D geradas) ---------- */
  const LOOKS = {
    warm: ['Filme quente', (r, g, b) => [r * 1.06 + 0.02, g * 1.0 + 0.01, b * 0.86]],
    cool: ['Frio', (r, g, b) => [r * 0.9, g * 0.98 + 0.01, b * 1.08 + 0.03]],
    faded: ['Desbotado', (r, g, b) => [0.1 + r * 0.82, 0.1 + g * 0.8, 0.12 + b * 0.78]],
    teal: ['Cinema (azul-petróleo e laranja)', (r, g, b) => { const l = 0.3 * r + 0.59 * g + 0.11 * b; const t = l; return [r + (t - 0.5) * 0.18, g + (0.5 - Math.abs(t - 0.5)) * 0.02, b - (t - 0.5) * 0.22]; }],
    bleach: ['Bleach bypass', (r, g, b) => { const l = 0.3 * r + 0.59 * g + 0.11 * b; const m = (x) => x + (l - x) * 0.55; const c = (x) => 0.5 + (x - 0.5) * 1.35; return [c(m(r)), c(m(g)), c(m(b))]; }],
    sepia: ['Sépia antigo', (r, g, b) => { const l = 0.3 * r + 0.59 * g + 0.11 * b; return [l * 1.07 + 0.05, l * 0.92 + 0.03, l * 0.72]; }],
    night: ['Noite americana', (r, g, b) => [r * 0.45, g * 0.6, b * 0.95 + 0.04]],
    contrast: ['Alto contraste', (r, g, b) => { const c = (x) => 1 / (1 + Math.exp(-(x - 0.5) * 8)); const k = c(1) - c(0); return [(c(r) - c(0)) / k, (c(g) - c(0)) / k, (c(b) - c(0)) / k]; }],
    vintage: ['Vintage', (r, g, b) => [0.08 + r * 0.9, 0.05 + g * 0.85 + 0.03, 0.15 + b * 0.62]],
    mono: ['Preto e branco cinematográfico', (r, g, b) => { let l = 0.25 * r + 0.65 * g + 0.1 * b; l = 1 / (1 + Math.exp(-(l - 0.5) * 6)); l = (l - 0.0474) / 0.9052; return [l, l, l * 0.98]; }],
    matte: ['Fosco', (r, g, b) => [0.06 + r * 0.9, 0.06 + g * 0.9, 0.08 + b * 0.88]],
    golden: ['Hora dourada', (r, g, b) => [r * 1.08 + 0.04, g * 1.02 + 0.02, b * 0.8]]
  };
  const lutCache = new Map();
  function lookTable(key, cube) {
    const ck = key + (cube ? cube.length : '');
    if (lutCache.has(ck)) return lutCache.get(ck);
    let t;
    if (key === 'custom' && cube) t = parseCube(cube);
    else {
      const N = 17, f = (LOOKS[key] || LOOKS.warm)[1], table = new Float32Array(N * N * N * 3);
      for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
        const o = f(r / (N - 1), g / (N - 1), b / (N - 1)), i = ((b * N + g) * N + r) * 3;
        table[i] = U.clamp(o[0], 0, 1); table[i + 1] = U.clamp(o[1], 0, 1); table[i + 2] = U.clamp(o[2], 0, 1);
      }
      t = { size: N, table };
    }
    lutCache.set(ck, t);
    return t;
  }
  /** Lê um arquivo .cube (Adobe/Resolve). */
  function parseCube(text) {
    const lines = String(text).split(/\r?\n/);
    let N = 0; const vals = [];
    for (const ln of lines) {
      const s = ln.trim();
      if (!s || s[0] === '#') continue;
      const m = /^LUT_3D_SIZE\s+(\d+)/i.exec(s);
      if (m) { N = +m[1]; continue; }
      if (/^[A-Z_]/i.test(s)) continue;
      const p = s.split(/\s+/).map(Number);
      if (p.length >= 3 && p.every((x) => isFinite(x))) vals.push(p[0], p[1], p[2]);
    }
    if (!N || vals.length < N * N * N * 3) throw new Error('Arquivo .cube inválido.');
    return { size: N, table: Float32Array.from(vals.slice(0, N * N * N * 3)) };
  }

  /* ==================================================================
     Definições
     ================================================================== */
  const ADJ = {
    brightnessContrast: {
      label: 'Brilho/Contraste', layer: true, kernel: 'lut3',
      defaults: () => ({ brightness: 0, contrast: 0, legacy: false }),
      prep(p) {
        const b = p.brightness || 0, c = p.contrast || 0, t = new Uint8ClampedArray(256);
        for (let v = 0; v < 256; v++) {
          let x = v / 255;
          if (p.legacy) { x = (x - 0.5) * (c >= 0 ? 1 + c / 50 : 1 + c / 100) + 0.5 + b / 255; }
          else {
            x = Math.pow(x, Math.pow(2, -b / 150));
            if (c > 0) { const k = 1 + c / 40; x = 0.5 + (0.5 * Math.tanh((x - 0.5) * 2 * k)) / Math.tanh(k); }
            else if (c < 0) x = 0.5 + (x - 0.5) * (1 + c / 100);
          }
          t[v] = x * 255;
        }
        return { r: t };
      },
      ui: (p, ch) => [sl(p, ch, 'brightness', 'Brilho', -150, 150), sl(p, ch, 'contrast', 'Contraste', -50, 100), chk(p, ch, 'legacy', 'Usar herdado')]
    },
    levels: {
      label: 'Níveis', layer: true, keys: ['ctrl+l'], kernel: 'lut3', width: 320,
      defaults: () => ({ lv: IMG.Widgets.levelsDefaults() }),
      prep: (p) => IMG.Widgets.levelsLUT(p.lv),
      ui: (p, ch, env) => [IMG.Widgets.levels(p.lv, ch, env)]
    },
    curves: {
      label: 'Curvas', layer: true, keys: ['ctrl+m'], kernel: 'lut3', width: 320,
      defaults: () => ({ cv: IMG.Widgets.curvesDefaults() }),
      prep: (p) => IMG.Widgets.curvesLUTs(p.cv),
      ui: (p, ch, env) => [IMG.Widgets.curves(p.cv, ch, env)]
    },
    exposure: {
      label: 'Exposição', layer: true, kernel: 'lut3',
      defaults: () => ({ exposure: 0, offset: 0, gamma: 1 }),
      prep(p) {
        const mul = Math.pow(2, p.exposure || 0), off = (p.offset || 0) * 255, g = 1 / Math.max(0.01, p.gamma || 1), t = new Uint8ClampedArray(256);
        for (let v = 0; v < 256; v++) t[v] = 255 * Math.pow(U.clamp((v * mul + off) / 255, 0, 1), g);
        return { r: t };
      },
      ui: (p, ch) => [sl(p, ch, 'exposure', 'Exposição', -20, 20, { step: 0.01, decimals: 2 }), sl(p, ch, 'offset', 'Deslocamento', -0.5, 0.5, { step: 0.0001, decimals: 4 }), sl(p, ch, 'gamma', 'Correção de gama', 0.01, 9.99, { step: 0.01, decimals: 2, def: 1 })]
    },
    vibrance: {
      label: 'Vibração', layer: true, kernel: 'vibrance',
      defaults: () => ({ vibrance: 0, saturation: 0 }),
      prep: (p) => ({ vibrance: p.vibrance, saturation: p.saturation }),
      ui: (p, ch) => [sl(p, ch, 'vibrance', 'Vibração', -100, 100), sl(p, ch, 'saturation', 'Saturação', -100, 100)]
    },
    hueSaturation: {
      label: 'Matiz/Saturação', layer: true, keys: ['ctrl+u'], kernel: 'hueSat',
      defaults: () => ({ master: { h: 0, s: 0, l: 0 }, reds: { h: 0, s: 0, l: 0 }, yellows: { h: 0, s: 0, l: 0 }, greens: { h: 0, s: 0, l: 0 }, cyans: { h: 0, s: 0, l: 0 }, blues: { h: 0, s: 0, l: 0 }, magentas: { h: 0, s: 0, l: 0 }, colorize: false, cz: { h: 0, s: 25, l: 0 }, cur: 'master' }),
      prep(p) {
        if (p.colorize) return { colorize: p.cz };
        return { master: p.master, ranges: Object.keys(HUE_RANGES).map((k) => Object.assign({ range: HUE_RANGES[k] }, p[k])) };
      },
      ui(p, ch) {
        const box = el('div');
        const draw = () => rebuild(box, (b) => {
          const UI = IMG.UI;
          const target = p.colorize ? p.cz : p[p.cur || 'master'];
          b.appendChild(el('div.form-row.solo.between',
            presetSel([['Cianotipia', { colorize: true, cz: { h: 210, s: 25, l: 0 } }], ['Aumentar saturação', { master: { h: 0, s: 30, l: 0 } }], ['Antigo', { colorize: true, cz: { h: 30, s: 15, l: 5 } }], ['Realçar vermelhos', { reds: { h: 0, s: 40, l: 0 } }], ['Sépia', { colorize: true, cz: { h: 35, s: 25, l: 0 } }], ['Saturação forte', { master: { h: 0, s: 60, l: 0 } }], ['Realçar amarelos', { yellows: { h: 0, s: 40, l: 0 } }]], (pr) => { Object.assign(p, ADJ.hueSaturation.defaults(), IMG.jclone(pr)); draw(); ch(true); }),
            p.colorize ? el('span') : UI.select(HUE_NAMES, p.cur || 'master', (v) => { p.cur = v; draw(); }, { keepFocus: true, width: 120 }).el));
          b.appendChild(sl(target, ch, 'h', 'Matiz', -180, p.colorize ? 360 : 180).el);
          if (p.colorize) { const s = sl(target, ch, 's', 'Saturação', 0, 100); b.appendChild(s.el); }
          else b.appendChild(sl(target, ch, 's', 'Saturação', -100, 100).el);
          b.appendChild(sl(target, ch, 'l', 'Luminosidade', -100, 100).el);
          b.appendChild(el('div.form-row.solo', UI.check('Colorir', p.colorize, (v) => { p.colorize = v; draw(); ch(true); }).el));
          const bar = U.domCanvas(256, 10); bar.className = 'hue-bar';
          const c = bar.getContext('2d');
          for (let x = 0; x < 256; x++) { c.fillStyle = 'hsl(' + (x / 256) * 360 + ',100%,50%)'; c.fillRect(x, 0, 1, 5); c.fillStyle = 'hsl(' + ((x / 256) * 360 + (p.colorize ? 0 : target.h)) + ',100%,50%)'; c.fillRect(x, 5, 1, 5); }
          b.appendChild(bar);
        });
        draw();
        return [box];
      }
    },
    colorBalance: {
      label: 'Equilíbrio de cores', layer: true, keys: ['ctrl+b'], kernel: 'colorBalance',
      defaults: () => ({ shadows: [0, 0, 0], midtones: [0, 0, 0], highlights: [0, 0, 0], preserve: true, tone: 'midtones' }),
      prep(p) {
        const a = 0.25, b = 0.333, sc = 0.7;
        const luts = [0, 1, 2].map((c) => {
          const t = new Uint8ClampedArray(256);
          for (let v = 0; v < 256; v++) {
            const l = v / 255;
            const sh = U.clamp((l - b) / -a + 0.5, 0, 1) * sc;
            const md = U.clamp((l - b) / a + 0.5, 0, 1) * U.clamp((l + b - 1) / -a + 0.5, 0, 1) * sc;
            const hl = U.clamp((l + b - 1) / a + 0.5, 0, 1) * sc;
            t[v] = 255 * U.clamp(l + (p.shadows[c] / 100) * sh + (p.midtones[c] / 100) * md + (p.highlights[c] / 100) * hl, 0, 1);
          }
          return t;
        });
        return { r: luts[0], g: luts[1], b: luts[2], preserve: p.preserve };
      },
      ui(p, ch) {
        const box = el('div');
        const draw = () => rebuild(box, (b) => {
          const UI = IMG.UI, t = p[p.tone || 'midtones'];
          b.appendChild(UI.row('Tom', UI.seg([{ value: 'shadows', label: 'Sombras' }, { value: 'midtones', label: 'Tons médios' }, { value: 'highlights', label: 'Realces' }], p.tone || 'midtones', (v) => { p.tone = v; draw(); }, { labels: true }).el));
          const pair = (i, l1, l2) => { const s = UI.slider({ label: l1 + ' — ' + l2, value: t[i], min: -100, max: 100, def: 0, stack: true, onInput: (v) => { t[i] = v; ch(false); }, onChange: (v) => { t[i] = v; ch(true); } }); return s.el; };
          b.appendChild(pair(0, 'Ciano', 'Vermelho')); b.appendChild(pair(1, 'Magenta', 'Verde')); b.appendChild(pair(2, 'Amarelo', 'Azul'));
          b.appendChild(chk(p, ch, 'preserve', 'Preservar luminosidade'));
        });
        draw();
        return [box];
      }
    },
    blackWhite: {
      label: 'Preto e branco', layer: true, keys: ['ctrl+alt+shift+b'], kernel: 'blackWhite',
      defaults: () => ({ reds: 40, yellows: 60, greens: 40, cyans: 60, blues: 20, magentas: 80, tint: false, tintH: 42, tintS: 20 }),
      prep: (p) => ({ w: [p.reds, p.yellows, p.greens, p.cyans, p.blues, p.magentas].map((v) => v / 100), tint: p.tint ? { h: p.tintH, s: p.tintS } : null }),
      ui(p, ch) {
        const box = el('div');
        const draw = () => rebuild(box, (b) => {
          const P = [['Padrão', [40, 60, 40, 60, 20, 80]], ['Filtro azul', [0, 0, 0, 110, 110, 110]], ['Filtro verde', [40, 60, 70, 60, 10, 50]], ['Alto contraste azul', [0, 0, 0, 150, 150, 0]], ['Alto contraste vermelho', [120, 120, -10, -50, -50, 120]], ['Infravermelho', [-40, 235, 144, -68, -3, -107]], ['Mais claro', [60, 80, 60, 80, 40, 100]], ['Mais escuro', [30, 40, 30, 40, 10, 50]], ['Preto máximo', [0, 0, 0, 0, 0, 0]], ['Branco máximo', [100, 100, 100, 100, 100, 100]], ['Densidade neutra', [27, 37, 37, 37, 27, 37]], ['Filtro vermelho', [120, 110, -10, -50, -50, 120]], ['Filtro amarelo', [120, 110, 40, -30, -90, 80]]];
          b.appendChild(el('div.form-row.solo.between', presetSel(P, (v) => { ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas'].forEach((k, i) => { p[k] = v[i]; }); draw(); ch(true); }),
            IMG.UI.btn('Automático', () => { Object.assign(p, { reds: 46, yellows: 72, greens: 34, cyans: 60, blues: 20, magentas: 80 }); draw(); ch(true); }, { small: true })));
          [['reds', 'Vermelhos'], ['yellows', 'Amarelos'], ['greens', 'Verdes'], ['cyans', 'Cianos'], ['blues', 'Azuis'], ['magentas', 'Magentas']].forEach(([k, l]) => b.appendChild(sl(p, ch, k, l, -200, 300, { unit: '%' }).el));
          b.appendChild(el('div.form-row.solo', IMG.UI.check('Tonalidade', p.tint, (v) => { p.tint = v; draw(); ch(true); }).el));
          if (p.tint) { b.appendChild(sl(p, ch, 'tintH', 'Matiz', 0, 360, { unit: '°' }).el); b.appendChild(sl(p, ch, 'tintS', 'Saturação', 0, 100, { unit: '%' }).el); }
        });
        draw();
        return [box];
      }
    },
    photoFilter: {
      label: 'Filtro de fotos', layer: true, kernel: 'photoFilter',
      defaults: () => ({ useColor: false, filter: 'warming85', color: '#ec8a00', density: 25, preserve: true }),
      prep(p) {
        const f = PHOTO_FILTERS.find((x) => x[0] === p.filter) || PHOTO_FILTERS[0];
        const c = U.hexToRgb(p.useColor ? p.color : f[2]);
        return { color: [c.r, c.g, c.b], density: (p.density || 0) / 100, preserve: p.preserve };
      },
      ui(p, ch) {
        const UI = IMG.UI;
        const box = el('div');
        const draw = () => rebuild(box, (b) => {
          b.appendChild(el('div.form-row', UI.check('Filtro', !p.useColor, (v) => { p.useColor = !v; draw(); ch(true); }).el,
            UI.select(PHOTO_FILTERS.map((x) => [x[0], x[1]]), p.filter, (v) => { p.filter = v; p.useColor = false; draw(); ch(true); }, { keepFocus: true }).el));
          b.appendChild(el('div.form-row', UI.check('Cor', p.useColor, (v) => { p.useColor = v; draw(); ch(true); }).el,
            UI.colorBtn(p.color, (hex, fin) => { if (hex) { p.color = hex; p.useColor = true; ch(fin); } }).el));
          b.appendChild(sl(p, ch, 'density', 'Densidade', 0, 100, { unit: '%' }).el);
          b.appendChild(chk(p, ch, 'preserve', 'Preservar luminosidade'));
        });
        draw();
        return [box];
      }
    },
    channelMixer: {
      label: 'Misturador de canais', layer: true, kernel: 'channelMixer',
      defaults: () => ({ out: 'r', m: { r: [100, 0, 0, 0], g: [0, 100, 0, 0], b: [0, 0, 100, 0] }, mono: false }),
      prep: (p) => ({ m: ['r', 'g', 'b'].map((k) => (p.mono ? p.m.r : p.m[k]).map((v) => v / 100)), mono: p.mono }),
      ui(p, ch) {
        const UI = IMG.UI, box = el('div');
        const draw = () => rebuild(box, (b) => {
          const P = [['Padrão', null], ['P&B com filtro azul', [0, 0, 100, 0]], ['P&B com filtro verde', [0, 100, 0, 0]], ['P&B com filtro laranja', [50, 50, 0, 0]], ['P&B com filtro vermelho', [100, 0, 0, 0]], ['P&B com filtro amarelo', [34, 66, 0, 0]], ['P&B infravermelho', [-70, 200, -30, 0]]];
          b.appendChild(el('div.form-row.solo.between', presetSel(P, (v) => { if (!v) Object.assign(p, ADJ.channelMixer.defaults()); else { p.mono = true; p.m.r = v.slice(); p.out = 'r'; } draw(); ch(true); }),
            p.mono ? el('span') : UI.select([['r', 'Vermelho'], ['g', 'Verde'], ['b', 'Azul']], p.out, (v) => { p.out = v; draw(); }, { keepFocus: true, width: 110 }).el));
          const row = p.mono ? p.m.r : p.m[p.out];
          ['Vermelho', 'Verde', 'Azul', 'Constante'].forEach((l, i) => b.appendChild(UI.slider({ label: l, value: row[i], min: -200, max: 200, unit: '%', stack: true, def: i === ['r', 'g', 'b'].indexOf(p.out) ? 100 : 0, onInput: (v) => { row[i] = v; tot.textContent = 'Total: ' + (row[0] + row[1] + row[2]) + '%'; ch(false); }, onChange: (v) => { row[i] = v; ch(true); } }).el));
          const tot = el('p.dialog-note', { text: 'Total: ' + (row[0] + row[1] + row[2]) + '%' });
          b.appendChild(tot);
          b.appendChild(el('div.form-row.solo', UI.check('Monocromático', p.mono, (v) => { p.mono = v; draw(); ch(true); }).el));
        });
        draw();
        return [box];
      }
    },
    colorLookup: {
      label: 'Pesquisa de cores', layer: true, kernel: 'colorLookup',
      defaults: () => ({ look: 'warm', cube: null, cubeName: '' }),
      prep(p) { const t = lookTable(p.look, p.cube); return { size: t.size, table: t.table }; },
      ui(p, ch) {
        const UI = IMG.UI;
        const opts = Object.keys(LOOKS).map((k) => [k, LOOKS[k][1] ? LOOKS[k][0] : k]);
        if (p.cube) opts.push(['custom', 'Arquivo: ' + (p.cubeName || '.cube')]);
        const s = UI.select(opts, p.look, (v) => { p.look = v; ch(true); }, { keepFocus: true });
        const load = UI.btn('Carregar arquivo .cube…', async () => {
          const files = await IMG.Files.pick('.cube', false);
          if (!files.length) return;
          try { const txt = await files[0].text(); parseCube(txt); p.cube = txt; p.cubeName = files[0].name; p.look = 'custom'; lutCache.clear(); ch(true); s.fill(opts.concat([['custom', 'Arquivo: ' + files[0].name]])); s.set('custom'); }
          catch (e) { UI.toast(e.message, 'error'); }
        }, { small: true });
        return [UI.row('Tabela 3D', s.el), el('div.form-row.solo', load)];
      }
    },
    invert: {
      label: 'Inverter', layer: true, keys: ['ctrl+i'], kernel: 'lut3', direct: true,
      defaults: () => ({}),
      prep() { const t = new Uint8ClampedArray(256); for (let v = 0; v < 256; v++) t[v] = 255 - v; return { r: t }; },
      ui: () => [el('p.dialog-note', { text: 'Inverte as cores das camadas abaixo. Não há parâmetros.' })]
    },
    posterize: {
      label: 'Posterizar', layer: true, kernel: 'lut3',
      defaults: () => ({ levels: 4 }),
      prep(p) { const n = Math.max(2, Math.round(p.levels)), t = new Uint8ClampedArray(256); for (let v = 0; v < 256; v++) t[v] = Math.round(Math.round((v * (n - 1)) / 255) * (255 / (n - 1))); return { r: t }; },
      ui: (p, ch) => [sl(p, ch, 'levels', 'Níveis', 2, 255, { def: 4 })]
    },
    threshold: {
      label: 'Limiar', layer: true, kernel: 'threshold',
      defaults: () => ({ level: 128 }),
      prep: (p) => ({ level: p.level }),
      ui(p, ch, env) {
        const cv = U.domCanvas(256, 80); cv.className = 'histogram';
        const h = env && env.histogram ? env.histogram() : null;
        const draw = () => { IMG.Widgets.drawHistogram(cv, h && h.l, '#a9aeb7'); const c = cv.getContext('2d'); c.fillStyle = '#4d8fd6'; c.fillRect(p.level, 0, 1, 80); };
        draw();
        return [cv, IMG.UI.slider({ label: 'Nível do limiar', value: p.level, min: 1, max: 255, stack: true, def: 128, onInput: (v) => { p.level = v; draw(); ch(false); }, onChange: (v) => { p.level = v; ch(true); } }).el];
      }
    },
    gradientMap: {
      label: 'Mapa de gradiente', layer: true, kernel: 'gradientMap',
      defaults: () => ({ gradient: IMG.Gradients.def(), reverse: false, dither: false }),
      prep: (p) => ({ lut: IMG.Gradients.lut(p.gradient, 256, p.reverse) }),
      ui(p, ch) {
        const g = IMG.Widgets.gradientBtn(p.gradient, (ng, fin) => { p.gradient = ng; ch(fin); }, { width: 200 });
        return [IMG.UI.row('Gradiente', g.el), chk(p, ch, 'dither', 'Pontilhado'), chk(p, ch, 'reverse', 'Inverter')];
      }
    },
    selectiveColor: {
      label: 'Cor seletiva', layer: true, kernel: 'selectiveColor',
      defaults: () => ({ cur: 'reds', relative: true, c: { reds: [0, 0, 0, 0], yellows: [0, 0, 0, 0], greens: [0, 0, 0, 0], cyans: [0, 0, 0, 0], blues: [0, 0, 0, 0], magentas: [0, 0, 0, 0], whites: [0, 0, 0, 0], neutrals: [0, 0, 0, 0], blacks: [0, 0, 0, 0] } }),
      prep(p) { const adj = {}; Object.keys(p.c).forEach((k) => { adj[k] = p.c[k].map((v) => v / 100); }); return { adj, relative: p.relative }; },
      ui(p, ch) {
        const UI = IMG.UI, box = el('div');
        const draw = () => rebuild(box, (b) => {
          b.appendChild(UI.row('Cores', UI.select([['reds', 'Vermelhos'], ['yellows', 'Amarelos'], ['greens', 'Verdes'], ['cyans', 'Cianos'], ['blues', 'Azuis'], ['magentas', 'Magentas'], null, ['whites', 'Brancos'], ['neutrals', 'Neutros'], ['blacks', 'Pretos']], p.cur, (v) => { p.cur = v; draw(); }, { keepFocus: true }).el));
          const arr = p.c[p.cur];
          ['Ciano', 'Magenta', 'Amarelo', 'Preto'].forEach((l, i) => b.appendChild(UI.slider({ label: l, value: arr[i], min: -100, max: 100, unit: '%', stack: true, def: 0, onInput: (v) => { arr[i] = v; ch(false); }, onChange: (v) => { arr[i] = v; ch(true); } }).el));
          b.appendChild(UI.row('Método', UI.seg([{ value: true, label: 'Relativo' }, { value: false, label: 'Absoluto' }], p.relative, (v) => { p.relative = v; ch(true); }, { labels: true }).el));
        });
        draw();
        return [box];
      }
    },
    /* ---- somente destrutivos (sem camada de ajuste) ---- */
    shadowsHighlights: {
      label: 'Sombras/Realces', kernel: 'shadowsHighlights',
      defaults: () => ({ shadows: 35, highlights: 0, shadowWidth: 50, highlightWidth: 50, radius: 30, color: 20, midtone: 0 }),
      prep: (p) => ({ shadows: p.shadows / 100, highlights: p.highlights / 100, shadowWidth: p.shadowWidth, highlightWidth: p.highlightWidth, radius: p.radius, color: p.color / 100, midtone: p.midtone / 100 }),
      ui: (p, ch) => [el('h3.form-title', { text: 'Sombras' }), sl(p, ch, 'shadows', 'Quantidade', 0, 100, { unit: '%' }).el, sl(p, ch, 'shadowWidth', 'Amplitude tonal', 0, 100, { unit: '%', def: 50 }).el,
        el('h3.form-title', { text: 'Realces' }), sl(p, ch, 'highlights', 'Quantidade', 0, 100, { unit: '%' }).el, sl(p, ch, 'highlightWidth', 'Amplitude tonal', 0, 100, { unit: '%', def: 50 }).el,
        el('h3.form-title', { text: 'Ajustes' }), sl(p, ch, 'radius', 'Raio', 0, 500, { unit: 'px', def: 30 }).el, sl(p, ch, 'color', 'Correção de cor', -100, 100, { def: 20 }).el, sl(p, ch, 'midtone', 'Contraste dos tons médios', -100, 100).el]
    },
    hdrToning: {
      label: 'Tonificação HDR', kernel: 'hdrToning',
      defaults: () => ({ radius: 30, strength: 50, exposure: 0, gamma: 1, detail: 0, vibrance: 0, saturation: 20 }),
      prep: (p) => Object.assign({}, p),
      ui: (p, ch) => [el('h3.form-title', { text: 'Brilho de borda' }), sl(p, ch, 'radius', 'Raio', 1, 500, { unit: 'px', def: 30 }).el, sl(p, ch, 'strength', 'Força', 0, 200, { unit: '%', def: 50 }).el,
        el('h3.form-title', { text: 'Tom e detalhe' }), sl(p, ch, 'gamma', 'Gama', 0.1, 2, { step: 0.01, decimals: 2, def: 1 }).el, sl(p, ch, 'exposure', 'Exposição', -5, 5, { step: 0.01, decimals: 2 }).el, sl(p, ch, 'detail', 'Detalhe', -100, 300, { unit: '%' }).el,
        el('h3.form-title', { text: 'Avançado' }), sl(p, ch, 'vibrance', 'Vibração', -100, 100, { unit: '%' }).el, sl(p, ch, 'saturation', 'Saturação', -100, 100, { unit: '%', def: 20 }).el]
    },
    replaceColor: {
      label: 'Substituir cor', kernel: 'replaceColor', pick: true,
      defaults: () => ({ color: IMG.app.fg, fuzz: 40, h: 0, s: 0, l: 0 }),
      prep(p) { const c = U.hexToRgb(p.color); return { color: [c.r, c.g, c.b], fuzz: p.fuzz, h: p.h, s: p.s, l: p.l }; },
      ui(p, ch) {
        const UI = IMG.UI;
        const cb = UI.colorBtn(p.color, (hex, fin) => { if (hex) { p.color = hex; ch(fin); } });
        p._setColor = (hex) => { p.color = hex; cb.set(hex); ch(true); };
        return [UI.row('Cor', cb.el, el('span.form-hint', { text: 'ou clique na imagem' })), sl(p, ch, 'fuzz', 'Tolerância', 0, 200, { def: 40 }).el,
          el('h3.form-title', { text: 'Substituição' }), sl(p, ch, 'h', 'Matiz', -180, 180).el, sl(p, ch, 's', 'Saturação', -100, 100).el, sl(p, ch, 'l', 'Luminosidade', -100, 100).el];
      }
    },
    desaturate: { label: 'Dessaturar', keys: ['ctrl+shift+u'], kernel: 'grayscale', direct: true, defaults: () => ({}), prep: () => ({ amount: 100 }) },
    equalize: { label: 'Equalizar', kernel: 'equalize', direct: true, defaults: () => ({}), prep: () => ({}) },
    autoTone: { label: 'Tom automático', keys: ['ctrl+shift+l'], kernel: 'autoLevels', direct: true, defaults: () => ({}), prep: () => ({ mode: 'tone' }) },
    autoContrast: { label: 'Contraste automático', keys: ['ctrl+alt+shift+l'], kernel: 'autoLevels', direct: true, defaults: () => ({}), prep: () => ({ mode: 'contrast' }) },
    autoColor: { label: 'Cor automática', keys: ['ctrl+shift+b'], kernel: 'autoLevels', direct: true, defaults: () => ({}), prep: () => ({ mode: 'color' }) }
  };

  /* ordem dos menus (como no Photopea) */
  const MENU_ORDER = ['brightnessContrast', 'levels', 'curves', 'exposure', '-', 'vibrance', 'hueSaturation', 'colorBalance', 'blackWhite', 'photoFilter', 'channelMixer', 'colorLookup', '-',
    'invert', 'posterize', 'threshold', 'gradientMap', 'selectiveColor', '-', 'shadowsHighlights', 'hdrToning', '-', 'desaturate', 'replaceColor', 'equalize'];
  const LAYER_ORDER = ['brightnessContrast', 'levels', 'curves', 'exposure', '-', 'vibrance', 'hueSaturation', 'colorBalance', 'blackWhite', 'photoFilter', 'channelMixer', 'colorLookup', '-', 'invert', 'posterize', 'threshold', 'gradientMap', 'selectiveColor'];

  /* ---------- cache do preparo ---------- */
  const prepCache = new Map();
  function prepped(adj) {
    const def = ADJ[adj.kind];
    const key = adj.kind + '|' + JSON.stringify(adj) + (adj.kind === 'gradientMap' ? IMG.app.fg + IMG.app.bg : '');
    let p = prepCache.get(key);
    if (!p) { p = def.prep(adj); prepCache.set(key, p); if (prepCache.size > 60) prepCache.delete(prepCache.keys().next().value); }
    return p;
  }

  const Adjust = (IMG.Adjust = {
    defs: ADJ, MENU_ORDER, LAYER_ORDER, HUE_RANGES, PHOTO_FILTERS, LOOKS, parseCube,
    label(kind) { return ADJ[kind] ? ADJ[kind].label : kind; },
    create(kind) { return Object.assign({ kind }, ADJ[kind].defaults()); },

    /** Aplica uma camada de ajuste sobre o ImageData do fundo (no lugar). */
    layerApply(adj, img, k, mask, blend, doc) {
      const def = ADJ[adj.kind]; if (!def) return;
      const d = img.data;
      const mixing = k < 0.999 || mask || (blend && blend !== 'normal' && blend !== 'pass');
      const src = mixing ? new Uint8ClampedArray(d) : null;
      IMG.Filters.K[def.kernel](d, img.width, img.height, prepped(adj));
      if (!mixing) return;
      const mode = !blend || blend === 'pass' ? 'normal' : blend;
      const lut = mode !== 'normal' && IMG.Blend.SEP[mode] ? IMG.Blend.lut(mode) : null;
      const nonsep = mode !== 'normal' && !lut;
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        let w = k; if (mask) w *= mask[j] / 255;
        if (src[i + 3] === 0) continue;
        let r = d[i], g = d[i + 1], b = d[i + 2];
        if (lut) { r = lut[(src[i] << 8) | r]; g = lut[(src[i + 1] << 8) | g]; b = lut[(src[i + 2] << 8) | b]; }
        else if (nonsep) { const o = IMG.Blend.color(mode, src[i], src[i + 1], src[i + 2], r, g, b); r = o[0]; g = o[1]; b = o[2]; }
        d[i] = src[i] + (r - src[i]) * w; d[i + 1] = src[i + 1] + (g - src[i + 1]) * w; d[i + 2] = src[i + 2] + (b - src[i + 2]) * w;
      }
      void doc;
    },

    /** Interface (lista de nós) para editar os parâmetros. */
    ui(adj, onChange, env) {
      const def = ADJ[adj.kind];
      if (!def || !def.ui) return [el('p.dialog-note', { text: 'Sem parâmetros.' })];
      const r = def.ui(adj, onChange, env || {});
      // aceita nós ou controles { el } (sliders, caixas de seleção...)
      return (Array.isArray(r) ? r : [r]).map((n) => (n && !(n instanceof Node) && n.el ? n.el : n)).filter(Boolean);
    },

    /** Abre o diálogo do ajuste (destrutivo) sobre a camada ativa. */
    open(kind) {
      const def = ADJ[kind]; if (!def) return;
      if (def.direct) return this.applyDirect(kind);
      const S = beginSession(); if (!S || S.smart) return;
      const p = this.create(kind);
      const cleanups = [];
      const env = { histogram: () => IMG.Widgets.histogramOf(S.src), onCleanup: (f) => cleanups.push(f),
        sample: (x, y) => { const L = S.L, sx = S.onMask ? L.mask.x : L.x, sy = S.onMask ? L.mask.y : L.y, px = Math.floor(x - sx), py = Math.floor(y - sy); if (px < 0 || py < 0 || px >= S.w || py >= S.h) return null; const d = S.src.data, i = (py * S.w + px) * 4; return { r: d[i], g: d[i + 1], b: d[i + 2] }; } };
      let fx = null;
      const body = this.ui(p, () => { if (fx) fx.update(); }, env);
      let picker = null;
      if (def.pick) {
        picker = (ev) => { const c = IMG.Engine.sample(S.doc, ev.x, ev.y, 1); if (c && p._setColor) p._setColor(U.rgbToHex(c.r, c.g, c.b)); };
        IMG.Tools.overrideClick = picker;
      }
      fx = fxDialog({ session: S, title: def.label, kernel: def.kernel, body, width: def.width || 340, params: () => def.prep(p),
        reset: def.ui ? () => { Object.assign(p, this.create(kind)); fx.dlg.close(); this.open(kind); } : null,
        onDone: () => { cleanups.forEach((f) => f()); if (picker && IMG.Tools.overrideClick === picker) IMG.Tools.overrideClick = null; IMG.FX && (IMG.FX.last = { adjust: kind, params: IMG.jclone(p) }); } });
    },

    /** Aplica sem diálogo (Inverter, Dessaturar, automáticos...). */
    applyDirect(kind, params) {
      const def = ADJ[kind]; if (!def) return;
      const S = beginSession(); if (!S || S.smart) return;
      S.run(def.kernel, def.prep(params || this.create(kind)));
      S.commit(def.label);
    },

    /** Cria uma camada de ajuste e abre o painel Propriedades. */
    newLayer(kind) {
      const doc = IMG.app.doc; if (!doc) return;
      const L = Layers.newAdjust(doc, this.create(kind), Layers.name(doc, ADJ[kind].label));
      // camada criada logo acima da ativa, herda o recorte se a ativa for recortada
      bus.emit('layers:change', doc);
      IMG.commit('Nova camada de ajuste: ' + ADJ[kind].label);
      if (IMG.UI.showPanel) IMG.UI.showPanel('properties');
      return L;
    }
  });
  void Adjust;
})();
