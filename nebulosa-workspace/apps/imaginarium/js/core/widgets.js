/* ==========================================================================
   Imaginarium — componentes de interface reutilizáveis
   Histograma, Níveis, Curvas, seletor/editor de gradiente, seletor de padrão,
   disco de ângulo. Usados nos diálogos de ajuste, no painel Propriedades
   (camadas de ajuste), nos estilos de camada e nas ferramentas.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, el = U.el;

  const W = (IMG.Widgets = {});

  /* ------------------------------------------------------------------
     Histograma de um ImageData / canvas
     ------------------------------------------------------------------ */
  W.histogramOf = function (src) {
    let d;
    if (!src) return null;
    if (src.data) d = src.data;
    else { try { d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data; } catch (e) { return null; } }
    const r = new Uint32Array(256), g = new Uint32Array(256), b = new Uint32Array(256), l = new Uint32Array(256);
    const step = Math.max(1, Math.floor(d.length / 4 / 400000)) * 4;
    for (let i = 0; i < d.length; i += step) {
      if (d[i + 3] < 8) continue;
      r[d[i]]++; g[d[i + 1]]++; b[d[i + 2]]++;
      l[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++;
    }
    return { r, g, b, rgb: l, l };
  };

  W.drawHistogram = function (cv, hist, color, o = {}) {
    const c = cv.getContext('2d'), Wd = cv.width, H = cv.height;
    if (!o.keep) { c.clearRect(0, 0, Wd, H); c.fillStyle = o.bg || '#1b1c1f'; c.fillRect(0, 0, Wd, H); }
    if (!hist) return;
    let max = 0; for (let i = 1; i < 255; i++) if (hist[i] > max) max = hist[i];
    max = Math.max(1, max);
    c.fillStyle = color || '#9aa0a9';
    for (let i = 0; i < 256; i++) {
      const hh = Math.min(H, (hist[i] / max) * (H - 2));
      c.fillRect((i / 256) * Wd, H - hh, Wd / 256 + 0.6, hh);
    }
  };

  /* ------------------------------------------------------------------
     Barra com alças triangulares arrastáveis (Níveis)
     handles: [{ key, value, min, max, color }]
     ------------------------------------------------------------------ */
  function handleBar(width, handles, onChange) {
    const H = 14;
    const cv = U.domCanvas(width, H); cv.className = 'hbar';
    const draw = () => {
      const c = cv.getContext('2d');
      c.clearRect(0, 0, width, H);
      handles.forEach((h) => {
        const x = (h.value / 255) * (width - 1);
        c.beginPath(); c.moveTo(x, 1); c.lineTo(x + 6, H - 1); c.lineTo(x - 6, H - 1); c.closePath();
        c.fillStyle = h.fill; c.fill(); c.strokeStyle = '#888'; c.lineWidth = 1; c.stroke();
      });
    };
    cv.addEventListener('pointerdown', (e) => {
      const r = cv.getBoundingClientRect();
      const val = (ev) => U.clamp(((ev.clientX - r.left) / r.width) * 255, 0, 255);
      const v0 = val(e);
      let best = null, bd = 1e9;
      handles.forEach((h) => { const dd = Math.abs(h.value - v0); if (dd < bd) { bd = dd; best = h; } });
      if (!best || bd > 20) return;
      U.drag(e, (ev) => { const v = Math.round(U.clamp(val(ev), best.min(), best.max())); best.value = v; draw(); onChange(best); });
    });
    draw();
    return { el: cv, draw };
  }

  /* ------------------------------------------------------------------
     NÍVEIS — state: { rgb:{ib,g,iw,ob,ow}, r:{..}, g:{..}, b:{..} }
     ------------------------------------------------------------------ */
  W.levelsDefaults = () => { const ch = () => ({ ib: 0, g: 1, iw: 255, ob: 0, ow: 255 }); return { rgb: ch(), r: ch(), g: ch(), b: ch() }; };
  /** Conta-gotas de ponto preto, cinza e branco (Níveis e Curvas). onPick(kind, {r,g,b}). */
  W.pointPickers = function (env, onPick) {
    const box = el('div.seg.pk-seg');
    if (!env || !env.sample) return box;
    let mode = null, handler = null;
    const set = (m) => {
      mode = mode === m ? null : m;
      U.$$('button', box).forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
      if (mode) {
        handler = (ev) => {
          if (!box.isConnected) { if (IMG.Tools.overrideClick === handler) IMG.Tools.overrideClick = null; return; }
          const c = env.sample(ev.x, ev.y); if (c) onPick(mode, c);
        };
        IMG.Tools.overrideClick = handler;
      } else if (IMG.Tools.overrideClick === handler) IMG.Tools.overrideClick = null;
    };
    [['black', '#000', 'Amostra na imagem para definir o ponto preto'], ['gray', '#808080', 'Amostra na imagem para definir o ponto cinza'], ['white', '#fff', 'Amostra na imagem para definir o ponto branco']].forEach(([m, col, t]) => {
      const b = el('button.seg-btn', { type: 'button', title: t, data: { m }, html: IMG.icon('eyedropper', 14) + '<i class="pk-sw" style="background:' + col + '"></i>' });
      b.addEventListener('click', () => set(m)); box.appendChild(b);
    });
    if (env.onCleanup) env.onCleanup(() => { if (handler && IMG.Tools.overrideClick === handler) IMG.Tools.overrideClick = null; });
    return box;
  };
  const lumOf = (c) => (c.r + c.g + c.b) / 3;

  W.levels = function (state, onChange, env = {}) {
    const UI = IMG.UI, WIDTH = 256;
    let ch = 'rgb';
    const cv = U.domCanvas(WIDTH, 100); cv.className = 'histogram';
    const COL = { rgb: '#a9aeb7', r: '#ff6b6b', g: '#5fd38d', b: '#5aa2ff' };
    const hist = env.histogram ? env.histogram() : null;
    const drawH = () => W.drawHistogram(cv, hist ? (ch === 'rgb' ? hist.l : hist[ch]) : null, COL[ch]);
    const S = () => state[ch];
    const midVal = () => { const s = S(); return s.ib + (s.iw - s.ib) * Math.pow(0.5, s.g); };
    const inH = [
      { key: 'ib', fill: '#000', value: 0, min: () => 0, max: () => S().iw - 2 },
      { key: 'mid', fill: '#808080', value: 128, min: () => S().ib + 1, max: () => S().iw - 1 },
      { key: 'iw', fill: '#fff', value: 255, min: () => S().ib + 2, max: () => 255 }
    ];
    const outH = [
      { key: 'ob', fill: '#000', value: 0, min: () => 0, max: () => 255 },
      { key: 'ow', fill: '#fff', value: 255, min: () => 0, max: () => 255 }
    ];
    const fields = {};
    const sync = () => {
      const s = S();
      inH[0].value = s.ib; inH[2].value = s.iw; inH[1].value = midVal();
      outH[0].value = s.ob; outH[1].value = s.ow;
      inBar.draw(); outBar.draw();
      fields.ib.set(s.ib); fields.g.set(U.round(s.g, 2)); fields.iw.set(s.iw); fields.ob.set(s.ob); fields.ow.set(s.ow);
      drawH();
    };
    const inBar = handleBar(WIDTH, inH, (h) => {
      const s = S();
      if (h.key === 'mid') { const t = (h.value - s.ib) / Math.max(1, s.iw - s.ib); s.g = U.clamp(Math.log(t) / Math.log(0.5), 0.1, 9.99); }
      else s[h.key] = h.value;
      sync(); onChange(false);
    });
    const outBar = handleBar(WIDTH, outH, (h) => { S()[h.key] = h.value; sync(); onChange(false); });
    const grad = el('div.levels-grad');
    const f = (key, min, max, step, dec) => (fields[key] = UI.num({ value: 0, min, max, step, decimals: dec, width: 54, onChange: (v) => { S()[key] = v; sync(); onChange(true); } }));
    f('ib', 0, 253, 1, 0); f('g', 0.1, 9.99, 0.01, 2); f('iw', 2, 255, 1, 0); f('ob', 0, 255, 1, 0); f('ow', 0, 255, 1, 0);
    const chSel = UI.select([['rgb', 'RGB'], ['r', 'Vermelho'], ['g', 'Verde'], ['b', 'Azul']], ch, (v) => { ch = v; sync(); }, { keepFocus: true, width: 110 });
    const presets = UI.select([['', 'Predefinição…'], ['default', 'Padrão'], ['darker', 'Mais escuro'], ['contrast1', 'Aumentar contraste 1'], ['contrast2', 'Aumentar contraste 2'], ['contrast3', 'Aumentar contraste 3'], ['lighter', 'Mais claro'], ['lightenShadows', 'Clarear sombras'], ['midBright', 'Tons médios mais claros'], ['midDark', 'Tons médios mais escuros']], '', (v) => {
      const P = { default: [0, 1, 255, 0, 255], darker: [15, 1, 255, 0, 255], contrast1: [10, 1, 245, 0, 255], contrast2: [20, 1, 235, 0, 255], contrast3: [30, 1, 225, 0, 255], lighter: [0, 1, 230, 0, 255], lightenShadows: [0, 1.6, 255, 0, 255], midBright: [0, 1.25, 255, 0, 255], midDark: [0, 0.75, 255, 0, 255] }[v];
      if (P) { Object.assign(state, W.levelsDefaults()); Object.assign(state.rgb, { ib: P[0], g: P[1], iw: P[2], ob: P[3], ow: P[4] }); sync(); onChange(true); }
      presets.set('');
    }, { keepFocus: true, width: 150 });
    const auto = UI.btn('Automático', () => {
      if (!hist) return;
      ['r', 'g', 'b'].forEach((k) => {
        const hh = hist[k]; let tot = 0; for (let i = 0; i < 256; i++) tot += hh[i];
        const clip = tot * 0.001; let acc = 0, lo = 0, hi = 255;
        for (let i = 0; i < 256; i++) { acc += hh[i]; if (acc > clip) { lo = i; break; } }
        acc = 0; for (let i = 255; i >= 0; i--) { acc += hh[i]; if (acc > clip) { hi = i; break; } }
        if (hi - lo >= 2) { state[k].ib = lo; state[k].iw = hi; }
      });
      sync(); onChange(true);
    }, { small: true });
    const pk = W.pointPickers(env, (kind, c) => {
      const v = { r: c.r, g: c.g, b: c.b };
      if (kind === 'black') ['r', 'g', 'b'].forEach((k) => { state[k].ib = U.clamp(v[k], 0, state[k].iw - 2); });
      else if (kind === 'white') ['r', 'g', 'b'].forEach((k) => { state[k].iw = U.clamp(Math.max(v[k], state[k].ib + 2), 2, 255); });
      else {
        const target = lumOf(c);
        ['r', 'g', 'b'].forEach((k) => {
          const s = state[k], x = U.clamp((v[k] - s.ib) / Math.max(1, s.iw - s.ib), 0.01, 0.99), t = U.clamp((target - s.ob) / Math.max(1, s.ow - s.ob), 0.01, 0.99);
          s.g = U.clamp(Math.log(x) / Math.log(t), 0.1, 9.99);
        });
      }
      sync(); onChange(true);
    });
    const node = el('div.w-levels',
      el('div.form-row.solo.between', presets.el, chSel.el, auto), env.sample ? el('div.form-row.solo', pk) : null,
      el('div.w-label', { text: 'Níveis de entrada' }), cv, inBar.el,
      el('div.w-fields3', fields.ib.el, fields.g.el, fields.iw.el),
      el('div.w-label', { text: 'Níveis de saída' }), grad, outBar.el,
      el('div.w-fields2', fields.ob.el, fields.ow.el));
    sync();
    return node;
  };
  /** Tabelas (r, g, b) a partir do estado de Níveis. */
  W.levelsLUT = function (st) {
    const one = (s) => {
      const t = new Uint8ClampedArray(256), range = Math.max(1, s.iw - s.ib), g = 1 / Math.max(0.05, s.g || 1);
      for (let v = 0; v < 256; v++) { const x = U.clamp((v - s.ib) / range, 0, 1); t[v] = s.ob + Math.pow(x, g) * (s.ow - s.ob); }
      return t;
    };
    const m = one(st.rgb);
    const comb = (c) => { const t = one(st[c]), o = new Uint8ClampedArray(256); for (let v = 0; v < 256; v++) o[v] = m[t[v]]; return o; };
    return { r: comb('r'), g: comb('g'), b: comb('b') };
  };

  /* ------------------------------------------------------------------
     CURVAS — state: { rgb: [[x,y]...], r, g, b }
     ------------------------------------------------------------------ */
  W.curvesDefaults = () => ({ rgb: [[0, 0], [255, 255]], r: [[0, 0], [255, 255]], g: [[0, 0], [255, 255]], b: [[0, 0], [255, 255]] });
  /** Interpolação cúbica monótona (Fritsch–Carlson) → 256 valores. */
  W.curveLUT = function (p) {
    p = p.slice().sort((a, b) => a[0] - b[0]);
    const n = p.length, xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    const out = new Uint8ClampedArray(256);
    if (n === 1) return out.fill(ys[0]);
    const d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    let k = 0;
    for (let x = 0; x < 256; x++) {
      if (x <= xs[0]) { out[x] = ys[0]; continue; }
      if (x >= xs[n - 1]) { out[x] = ys[n - 1]; continue; }
      while (k < n - 2 && x > xs[k + 1]) k++;
      const h = xs[k + 1] - xs[k], t = (x - xs[k]) / h, t2 = t * t, t3 = t2 * t;
      out[x] = Math.round((2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h * m[k + 1]);
    }
    return out;
  };
  const isIdCurve = (p) => p.length === 2 && p[0][0] === 0 && p[0][1] === 0 && p[1][0] === 255 && p[1][1] === 255;
  W.curvesLUTs = function (st) {
    const id = new Uint8ClampedArray(256).map((_, i) => i);
    const m = isIdCurve(st.rgb) ? id : W.curveLUT(st.rgb);
    const comb = (c) => { const t = isIdCurve(st[c]) ? id : W.curveLUT(st[c]), o = new Uint8ClampedArray(256); for (let v = 0; v < 256; v++) o[v] = m[t[v]]; return o; };
    return { r: comb('r'), g: comb('g'), b: comb('b') };
  };
  W.CURVE_PRESETS = {
    contrastM: ['Contraste médio', [[0, 0], [64, 58], [192, 198], [255, 255]]],
    contrastS: ['Contraste forte', [[0, 0], [64, 47], [192, 208], [255, 255]]],
    contrastL: ['Contraste linear', [[0, 0], [64, 54], [192, 202], [255, 255]]],
    lighter: ['Mais claro', [[0, 0], [113, 141], [255, 255]]],
    darker: ['Mais escuro', [[0, 0], [141, 113], [255, 255]]],
    negative: ['Negativo', [[0, 255], [255, 0]]],
    increase: ['Aumentar contraste', [[0, 0], [62, 46], [189, 207], [255, 255]]]
  };
  W.curves = function (state, onChange, env = {}) {
    const UI = IMG.UI, SIZE = 256, PAD = 8;
    const COL = { rgb: '#e6e8ec', r: '#ff6b6b', g: '#5fd38d', b: '#5aa2ff' };
    let ch = 'rgb', sel = -1;
    const hist = env.histogram ? env.histogram() : null;
    const cv = U.domCanvas(SIZE + PAD * 2, SIZE + PAD * 2); cv.className = 'curve-editor';
    const X = (v) => PAD + v, Y = (v) => PAD + (255 - v);
    const inF = UI.num({ value: 0, min: 0, max: 255, width: 54, onChange: (v) => { if (sel < 0) return; state[ch][sel][0] = v; state[ch].sort((a, b) => a[0] - b[0]); draw(); onChange(true); } });
    const outF = UI.num({ value: 0, min: 0, max: 255, width: 54, onChange: (v) => { if (sel < 0) return; state[ch][sel][1] = v; draw(); onChange(true); } });
    const draw = () => {
      const c = cv.getContext('2d'), Wd = cv.width, H = cv.height;
      c.clearRect(0, 0, Wd, H);
      c.fillStyle = '#1b1c1f'; c.fillRect(PAD, PAD, SIZE, SIZE);
      if (hist) {
        const hh = ch === 'rgb' ? hist.l : hist[ch];
        let max = 1; for (let i = 1; i < 255; i++) if (hh[i] > max) max = hh[i];
        c.fillStyle = 'rgba(154,160,169,.30)';
        for (let i = 0; i < 256; i++) { const v = Math.min(SIZE, (hh[i] / max) * (SIZE - 4)); c.fillRect(PAD + i, PAD + SIZE - v, 1, v); }
      }
      c.strokeStyle = 'rgba(255,255,255,.09)'; c.lineWidth = 1; c.beginPath();
      for (let i = 1; i < 4; i++) { const q = Math.round(PAD + (SIZE * i) / 4) + 0.5; c.moveTo(q, PAD); c.lineTo(q, PAD + SIZE); c.moveTo(PAD, q); c.lineTo(PAD + SIZE, q); }
      c.moveTo(PAD, PAD + SIZE); c.lineTo(PAD + SIZE, PAD);
      c.stroke();
      c.strokeStyle = '#3a3d43'; c.strokeRect(PAD + 0.5, PAD + 0.5, SIZE - 1, SIZE - 1);
      ['r', 'g', 'b', 'rgb'].forEach((k) => {
        if (k !== ch && isIdCurve(state[k])) return;
        const lut = W.curveLUT(state[k]);
        c.strokeStyle = COL[k]; c.globalAlpha = k === ch ? 1 : 0.4; c.lineWidth = k === ch ? 1.6 : 1;
        c.beginPath();
        for (let x = 0; x < 256; x++) { if (x) c.lineTo(X(x), Y(lut[x])); else c.moveTo(X(x), Y(lut[x])); }
        c.stroke();
      });
      c.globalAlpha = 1;
      state[ch].forEach((p, i) => {
        c.fillStyle = i === sel ? COL[ch] : '#1b1c1f'; c.strokeStyle = COL[ch]; c.lineWidth = 1.5;
        c.fillRect(X(p[0]) - 3.5, Y(p[1]) - 3.5, 7, 7); c.strokeRect(X(p[0]) - 3.5, Y(p[1]) - 3.5, 7, 7);
      });
      if (sel >= 0 && state[ch][sel]) { inF.set(state[ch][sel][0]); outF.set(state[ch][sel][1]); }
    };
    cv.addEventListener('pointerdown', (e) => {
      const r = cv.getBoundingClientRect(), k = cv.width / r.width;
      const pos = (ev) => ({ x: U.clamp(Math.round((ev.clientX - r.left) * k - PAD), 0, 255), y: U.clamp(Math.round(255 - ((ev.clientY - r.top) * k - PAD)), 0, 255) });
      const p0 = pos(e), list = state[ch];
      sel = list.findIndex((p) => Math.hypot(p[0] - p0.x, p[1] - p0.y) <= 9);
      if (sel < 0) {
        const lut = W.curveLUT(list);
        let i = list.findIndex((p) => p[0] > p0.x); if (i < 0) i = list.length;
        list.splice(i, 0, [p0.x, Math.abs(lut[p0.x] - p0.y) < 14 ? lut[p0.x] : p0.y]); sel = i;
      }
      draw(); onChange(false);
      U.drag(e, (ev) => {
        if (sel < 0) return;
        const p = pos(ev), n = list.length;
        const ox = (ev.clientX - r.left) * k, oy = (ev.clientY - r.top) * k;
        const out = ox < -20 || ox > cv.width + 20 || oy < -20 || oy > cv.height + 20;
        if (out && n > 2) { list.splice(sel, 1); sel = -1; draw(); onChange(false); return; }
        const lo = sel > 0 ? list[sel - 1][0] + 1 : 0, hi = sel < n - 1 ? list[sel + 1][0] - 1 : 255;
        list[sel][0] = U.clamp(p.x, lo, hi); list[sel][1] = p.y;
        draw(); onChange(false);
      }, () => onChange(true));
    });
    const chSel = UI.select([['rgb', 'RGB'], ['r', 'Vermelho'], ['g', 'Verde'], ['b', 'Azul']], ch, (v) => { ch = v; sel = -1; draw(); }, { keepFocus: true, width: 110 });
    const pre = [['', 'Predefinição…'], ['default', 'Padrão']].concat(Object.keys(W.CURVE_PRESETS).map((k) => [k, W.CURVE_PRESETS[k][0]]));
    const presets = UI.select(pre, '', (v) => {
      if (v === 'default') Object.assign(state, W.curvesDefaults());
      else if (W.CURVE_PRESETS[v]) state[ch] = W.CURVE_PRESETS[v][1].map((p) => p.slice());
      sel = -1; draw(); onChange(true); presets.set('');
    }, { keepFocus: true, width: 150 });
    const setPt = (k, x, y, where) => {
      const list = state[k];
      if (where === 'first') { list[0] = [U.clamp(x, 0, list[1] ? list[1][0] - 1 : 254), y]; }
      else if (where === 'last') { list[list.length - 1] = [U.clamp(x, list.length > 1 ? list[list.length - 2][0] + 1 : 1, 255), y]; }
      else {
        const i = list.findIndex((p) => Math.abs(p[0] - x) < 6);
        if (i > 0 && i < list.length - 1) list[i] = [x, y];
        else if (x > list[0][0] && x < list[list.length - 1][0]) { list.push([x, y]); list.sort((a, b) => a[0] - b[0]); }
      }
    };
    const pk = W.pointPickers(env, (kind, c) => {
      const v = { r: c.r, g: c.g, b: c.b }, target = Math.round(lumOf(c));
      ['r', 'g', 'b'].forEach((k) => setPt(k, v[k], kind === 'black' ? 0 : kind === 'white' ? 255 : target, kind === 'black' ? 'first' : kind === 'white' ? 'last' : 'mid'));
      sel = -1; draw(); onChange(true);
    });
    const auto = UI.btn('Automático', () => {
      if (!hist) return;
      ['r', 'g', 'b'].forEach((k) => {
        const hh = hist[k]; let tot = 0; for (let i = 0; i < 256; i++) tot += hh[i];
        const clip = tot * 0.001; let acc = 0, lo = 0, hi = 255;
        for (let i = 0; i < 256; i++) { acc += hh[i]; if (acc > clip) { lo = i; break; } }
        acc = 0; for (let i = 255; i >= 0; i--) { acc += hh[i]; if (acc > clip) { hi = i; break; } }
        if (hi - lo >= 2) { state[k] = [[lo, 0], [hi, 255]]; }
      });
      sel = -1; draw(); onChange(true);
    }, { small: true });
    const node = el('div.w-curves', el('div.form-row.solo.between', presets.el, chSel.el), el('div.form-row.solo.between', env.sample ? pk : el('span'), auto), cv,
      el('div.w-fields2', el('label.w-mini', 'Entrada ', inF.el), el('label.w-mini', 'Saída ', outF.el)),
      el('span.curve-info', { text: 'Clique para criar pontos; arraste para fora para removê-los.' }));
    draw();
    return node;
  };

  /* ------------------------------------------------------------------
     GRADIENTE — botão de pré-visualização + editor
     ------------------------------------------------------------------ */
  W.gradientBtn = function (grad, onChange, o = {}) {
    let g = grad ? IMG.Gradients.clone(grad) : IMG.Gradients.def();
    const holder = el('button.grad-btn', { type: 'button', title: 'Clique para editar o gradiente' });
    const paint = () => { U.clear(holder); const c = IMG.Gradients.preview(g, o.width || 140, 18, o.reverse); holder.appendChild(c); };
    holder.addEventListener('click', () => W.gradientEditor(g, (ng, final) => { g = ng; paint(); onChange(IMG.Gradients.clone(g), final); }));
    const caret = el('button.num-caret', { type: 'button', title: 'Predefinições', html: IMG.icon('chevronDown', 11) });
    caret.addEventListener('click', () => {
      const grid = el('div.grad-grid');
      IMG.Gradients.all().forEach((pg) => {
        const b = el('button.grad-cell', { type: 'button', title: pg.name }, IMG.Gradients.preview(pg, 46, 20));
        b.addEventListener('click', () => { g = IMG.Gradients.clone(pg); paint(); onChange(IMG.Gradients.clone(g), true); IMG.UI.closePopover(); });
        grid.appendChild(b);
      });
      IMG.UI.popover(wrap, grid);
    });
    const wrap = el('span.grad-pick', holder, caret);
    paint();
    return { el: wrap, get: () => IMG.Gradients.clone(g), set: (v) => { g = IMG.Gradients.clone(v); paint(); } };
  };

  W.gradientEditor = function (start, onChange) {
    const UI = IMG.UI, G = IMG.Gradients;
    const g = G.clone(start);
    const BW = 380;
    let selKind = 'colors', selIdx = 0;
    const presetsBox = el('div.grad-grid.big');
    const renderPresets = () => {
      U.clear(presetsBox);
      G.all().forEach((pg) => {
        const b = el('button.grad-cell', { type: 'button', title: pg.name }, G.preview(pg, 52, 24));
        b.addEventListener('click', () => { const c = G.clone(pg); g.colors = c.colors; g.alphas = c.alphas; g.name = c.name; selIdx = 0; selKind = 'colors'; nameIn.value = g.name; refresh(true); });
        presetsBox.appendChild(b);
      });
    };
    const nameIn = el('input.inp', { type: 'text', value: g.name || 'Personalizado' });
    nameIn.addEventListener('change', () => { g.name = nameIn.value; });
    const bar = U.domCanvas(BW, 26); bar.className = 'grad-bar';
    const topStops = el('div.grad-stops.top'), botStops = el('div.grad-stops.bottom');
    const colorBtn = UI.colorBtn('#000000', (hex, fin) => { if (!hex || selKind !== 'colors') return; g.colors[selIdx].c = hex; refresh(fin); });
    const opNum = UI.num({ value: 100, min: 0, max: 100, unit: '%', width: 70, onChange: (v) => { if (selKind !== 'alphas') return; g.alphas[selIdx].a = v / 100; refresh(true); } });
    const locNum = UI.num({ value: 0, min: 0, max: 100, unit: '%', width: 70, onChange: (v) => { const arr = g[selKind]; if (arr[selIdx]) { arr[selIdx].t = v / 100; refresh(true); } } });
    const delBtn = UI.btn('Excluir', () => { const arr = g[selKind]; if (arr.length <= 2) return; arr.splice(selIdx, 1); selIdx = 0; refresh(true); }, { small: true });
    const fgBg = UI.select([['', 'Cor…'], ['fg', 'Primeiro plano'], ['bg', 'Fundo']], '', (v) => { if (v && selKind === 'colors') { g.colors[selIdx].c = v; refresh(true); } fgBg.set(''); }, { keepFocus: true, width: 120 });
    const stopEl = (kind, s, i) => {
      const st = el('div.grad-stop' + (kind === selKind && i === selIdx ? '.sel' : ''), { style: { left: s.t * 100 + '%' } });
      const sw = el('i');
      sw.style.background = kind === 'colors' ? G.resolve(s.c) : 'rgb(' + Math.round(255 * (1 - s.a)) + ',' + Math.round(255 * (1 - s.a)) + ',' + Math.round(255 * (1 - s.a)) + ')';
      st.appendChild(sw);
      st.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        selKind = kind; selIdx = i; refresh(false);
        const box = (kind === 'colors' ? botStops : topStops).getBoundingClientRect();
        const arr = g[kind];
        let removed = false;
        U.drag(e, (ev) => {
          const off = Math.abs(ev.clientY - (box.top + box.height / 2)) > 40;
          if (off && arr.length > 2 && !removed) { arr.splice(selIdx, 1); removed = true; selIdx = 0; refresh(false); return; }
          if (removed) return;
          arr[selIdx].t = U.clamp((ev.clientX - box.left) / box.width, 0, 1);
          refresh(false, true);
        }, () => refresh(true));
      });
      return st;
    };
    const addStop = (kind) => (e) => {
      if (e.target !== (kind === 'colors' ? botStops : topStops)) return;
      const r = e.currentTarget.getBoundingClientRect(), t = U.clamp((e.clientX - r.left) / r.width, 0, 1);
      const lut = G.lut(g, 101);
      const k = Math.round(t * 100) * 4;
      if (kind === 'colors') g.colors.push({ t, c: U.rgbToHex(lut[k], lut[k + 1], lut[k + 2]) });
      else g.alphas.push({ t, a: lut[k + 3] / 255 });
      selKind = kind; selIdx = g[kind].length - 1;
      refresh(true);
    };
    topStops.addEventListener('pointerdown', addStop('alphas'));
    botStops.addEventListener('pointerdown', addStop('colors'));
    const refresh = (final, keepFields) => {
      const c = bar.getContext('2d'), T = G.lut(g, BW);
      for (let y = 0; y < 26; y += 6) for (let x = 0; x < BW; x += 6) { c.fillStyle = ((x + y) / 6) % 2 ? '#cfcfcf' : '#fff'; c.fillRect(x, y, 6, 6); }
      for (let x = 0; x < BW; x++) { c.fillStyle = 'rgba(' + T[x * 4] + ',' + T[x * 4 + 1] + ',' + T[x * 4 + 2] + ',' + T[x * 4 + 3] / 255 + ')'; c.fillRect(x, 0, 1, 26); }
      U.clear(topStops); U.clear(botStops);
      g.alphas.forEach((s, i) => topStops.appendChild(stopEl('alphas', s, i)));
      g.colors.forEach((s, i) => botStops.appendChild(stopEl('colors', s, i)));
      const s = g[selKind][selIdx];
      if (s && !keepFields) {
        if (selKind === 'colors') { colorBtn.set(G.resolve(s.c)); colorBtn.el.style.opacity = 1; opNum.el.style.opacity = 0.4; }
        else { opNum.set(Math.round(s.a * 100)); colorBtn.el.style.opacity = 0.4; opNum.el.style.opacity = 1; }
      }
      if (s) locNum.set(Math.round(s.t * 100));
      onChange(G.clone(g), !!final);
    };
    renderPresets();
    const saveBtn = UI.btn('Salvar como predefinição', () => { const c = G.clone(g); c.name = nameIn.value || 'Personalizado'; G.user.push(c); G.saveUser(); renderPresets(); }, { small: true });
    const body = [
      el('div.w-label', { text: 'Predefinições' }), presetsBox,
      UI.row('Nome', nameIn),
      el('div.grad-edit', topStops, bar, botStops),
      el('div.form-row', el('span.form-label', { text: 'Opacidade' }), opNum.el, el('span.form-label.short', { text: 'Local' }), locNum.el),
      el('div.form-row', el('span.form-label', { text: 'Cor' }), colorBtn.el, fgBg.el, delBtn),
      el('p.dialog-note', { text: 'Clique abaixo da barra para adicionar uma parada de cor; acima, uma parada de opacidade. Arraste uma parada para fora para removê-la.' })
    ];
    const orig = G.clone(start);
    UI.dialog({
      title: 'Editor de gradiente', width: 440, body, footLeft: [saveBtn],
      buttons: [{ label: 'Cancelar', onClick: () => { onChange(orig, true); } }, { label: 'OK', primary: true, onClick: () => { g.name = nameIn.value; onChange(G.clone(g), true); } }]
    });
    refresh(false);
  };

  /* ------------------------------------------------------------------
     PADRÃO — botão + seletor
     ------------------------------------------------------------------ */
  W.patternBtn = function (id, onChange) {
    let cur = id || 'p0';
    const b = el('button.pat-btn', { type: 'button', title: 'Escolher padrão' });
    const paint = () => { U.clear(b); b.appendChild(IMG.Patterns.preview(cur, 32, 22)); };
    b.addEventListener('click', () => {
      const grid = el('div.pat-grid');
      IMG.Patterns.all().forEach((p) => {
        const cell = el('button.pat-cell', { type: 'button', title: p.name }, IMG.Patterns.preview(p.id, 40, 40));
        cell.addEventListener('click', () => { cur = p.id; paint(); onChange(cur); IMG.UI.closePopover(); });
        grid.appendChild(cell);
      });
      IMG.UI.popover(b, grid);
    });
    paint();
    return { el: b, get: () => cur, set: (v) => { cur = v; paint(); } };
  };

  /* ------------------------------------------------------------------
     DISCO DE ÂNGULO
     ------------------------------------------------------------------ */
  W.angle = function (value, onChange, o = {}) {
    const S = 34;
    const cv = U.domCanvas(S, S); cv.className = 'angle-dial';
    let v = value || 0;
    const num = IMG.UI.num({ value: v, min: -180, max: 180, unit: '°', width: 64, onChange: (x) => { v = x; draw(); onChange(v, true); } });
    const draw = () => {
      const c = cv.getContext('2d');
      c.clearRect(0, 0, S, S);
      c.fillStyle = '#1b1c1f'; c.strokeStyle = '#5b6068'; c.lineWidth = 1;
      c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 1.5, 0, Math.PI * 2); c.fill(); c.stroke();
      const a = U.rad(v), r = S / 2 - 3;
      c.strokeStyle = '#fff'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(S / 2, S / 2); c.lineTo(S / 2 + Math.cos(a) * r, S / 2 - Math.sin(a) * r); c.stroke();
      if (o.alt != null) {
        const rr = r * Math.cos(U.rad(o.alt));
        c.fillStyle = '#fff'; c.beginPath(); c.arc(S / 2 + Math.cos(a) * rr, S / 2 - Math.sin(a) * rr, 2.2, 0, Math.PI * 2); c.fill();
      }
      num.set(Math.round(v));
    };
    cv.addEventListener('pointerdown', (e) => {
      const r = cv.getBoundingClientRect();
      const upd = (ev) => {
        let a = Math.round(U.deg(Math.atan2(-(ev.clientY - r.top - r.height / 2), ev.clientX - r.left - r.width / 2)));
        if (ev.shiftKey) a = Math.round(a / 15) * 15;
        v = a; draw(); onChange(v, false);
      };
      upd(e); U.drag(e, upd, () => onChange(v, true));
    });
    draw();
    return { el: el('span.angle-wrap', cv, num.el), set: (x) => { v = x; draw(); } };
  };
})();
