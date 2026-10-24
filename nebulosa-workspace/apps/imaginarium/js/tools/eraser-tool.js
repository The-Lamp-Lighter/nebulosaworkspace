/* ==========================================================================
   Imaginarium — grupo da Borracha (E)
   Borracha (Pincel / Lápis / Bloco, Apagar para o histórico),
   Borracha de plano de fundo e Borracha mágica.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus;
  const T = () => IMG.Tools;

  /* ---------- Borracha ---------- */
  IMG.Tools.register(IMG.makeBrushTool({
    id: 'eraser', name: 'Borracha', icon: 'eraser', mode: 'erase', altPick: false, altHandled: true,
    hint: 'Alt: apagar para o histórico · Shift+clique: linha reta · [ ]: tamanho',
    showMode: false,
    defaults: { size: 40, hardness: 85, opacity: 100, spacing: 10, flow: 100, smoothing: 0, emode: 'brush', toHistory: false },
    extraOptions: () => [
      { type: 'select', key: 'emode', label: 'Modo', options: [['brush', 'Pincel'], ['pencil', 'Lápis'], ['block', 'Bloco']], width: 90 },
      { type: 'check', key: 'toHistory', label: 'Apagar para o histórico', title: 'Restaura os pixels do estado escolhido no painel Histórico (também com Alt)' }
    ],
    cursorInfo: (o) => (o.emode === 'block' ? { square: true, size: 16 } : null),
    prepare(ev, tool, L) {
      const o = T().o('eraser'), doc = IMG.app.doc, r = {};
      if (o.emode === 'pencil') r.aliased = true;
      if (o.emode === 'block') Object.assign(r, { aliased: true, tip: 'block', size: Math.max(1, 16 / doc.view.zoom), hardness: 1, opacity: 1, flow: 1, angle: 0, roundness: 100, spacing: 0.25, dyn: null });
      if (o.toHistory || ev.alt) {
        const onMask = !!(doc.editMask && L.mask);
        const src = IMG.historySource(doc, L, onMask);
        if (!src) return false;
        Object.assign(r, { mode: 'restore', src });
      }
      return r;
    }
  }));

  /* ---------- Borracha de plano de fundo ---------- */
  function colorDist(d, i, r, g, b) { return Math.max(Math.abs(d[i] - r), Math.abs(d[i + 1] - g), Math.abs(d[i + 2] - b)); }
  /** Limita "amt" à região contígua (4 vizinhos) que contém o centro do carimbo. */
  function contiguousOnly(amt, w, h, cx, cy) {
    cx = U.clamp(Math.floor(cx), 0, w - 1); cy = U.clamp(Math.floor(cy), 0, h - 1);
    const seen = new Uint8Array(w * h);
    let start = cy * w + cx;
    if (!(amt[start] > 0)) {
      // procura o pixel aceito mais próximo do centro
      let best = -1, bd = 1e9;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const j = y * w + x; if (amt[j] > 0) { const d = (x - cx) * (x - cx) + (y - cy) * (y - cy); if (d < bd) { bd = d; best = j; } } }
      if (best < 0 || bd > 4) { amt.fill(0); return amt; }
      start = best;
    }
    const st = [start]; seen[start] = 1;
    while (st.length) {
      const j = st.pop(), x = j % w, y = (j / w) | 0;
      if (x > 0 && !seen[j - 1] && amt[j - 1] > 0) { seen[j - 1] = 1; st.push(j - 1); }
      if (x < w - 1 && !seen[j + 1] && amt[j + 1] > 0) { seen[j + 1] = 1; st.push(j + 1); }
      if (y > 0 && !seen[j - w] && amt[j - w] > 0) { seen[j - w] = 1; st.push(j - w); }
      if (y < h - 1 && !seen[j + w] && amt[j + w] > 0) { seen[j + w] = 1; st.push(j + w); }
    }
    for (let j = 0; j < amt.length; j++) if (!seen[j]) amt[j] = 0;
    return amt;
  }
  IMG.contiguousOnly = contiguousOnly;
  /** Semelhança (0..1) com suavização na metade final da tolerância. */
  function similarity(d, tol) {
    if (d <= tol * 0.5) return 1;
    if (d > tol) return 0;
    return 1 - (d - tol * 0.5) / Math.max(0.5, tol * 0.5);
  }
  IMG.colorSimilarity = similarity;

  /** Amostragem (Contínua, Uma vez, Amostra de fundo) — usada também por Substituição de cor. */
  IMG.sampleForDab = function (o, base, w, info) {
    const st = info.state;
    if (o.sampling === 'bgswatch') { const c = U.hexToRgb(IMG.app.bg); return [c.r, c.g, c.b]; }
    if (o.sampling === 'once' && st.sample) return st.sample;
    const cx = U.clamp(Math.floor(info.x), 0, w - 1), cy = U.clamp(Math.floor(info.y), 0, Math.floor(base.length / 4 / w) - 1);
    const i = (cy * w + cx) * 4;
    if (base[i + 3] < 8) return o.sampling === 'once' ? null : st.lastSample || null;
    const c = [base[i], base[i + 1], base[i + 2]];
    if (o.sampling === 'once') st.sample = c;
    st.lastSample = c;
    return c;
  };

  IMG.Tools.register(IMG.makeBrushTool({
    id: 'bgEraser', name: 'Borracha de plano de fundo', icon: 'bgEraser', kind: 'pixel', altPick: false,
    hint: 'Apaga a cor amostrada sob o centro do pincel, preservando as bordas do objeto',
    showMode: false, showOpacity: false, showFlow: false, showSmoothing: false,
    defaults: { size: 60, hardness: 100, spacing: 20, sampling: 'cont', limits: 'cont', tolerance: 50, protectFg: false },
    extraOptions: () => [
      { type: 'select', key: 'sampling', label: 'Amostragem', options: [['cont', 'Contínua'], ['once', 'Uma vez'], ['bgswatch', 'Amostra de fundo']], width: 120 },
      { type: 'select', key: 'limits', label: 'Limites', options: [['disc', 'Não contíguo'], ['cont', 'Contíguo'], ['edges', 'Localizar arestas']], width: 120 },
      { type: 'slider', key: 'tolerance', label: 'Tolerância', min: 0, max: 100, step: 1, unit: '%' },
      { type: 'check', key: 'protectFg', label: 'Proteger a cor do primeiro plano' }
    ],
    process(o, ev, tool, L) {
      const doc = IMG.app.doc;
      if (L.type !== 'raster') { IMG.UI.toast('Selecione uma camada de pixels.'); return false; }
      if (L.isBg && !(doc.editMask && L.mask)) { IMG.Layers.fromBackground(doc, L); bus.emit('layers:change', doc); }
      const tol = (o.tolerance / 100) * 255, fg = U.hexToRgb(IMG.app.fg);
      return {
        ignoreLock: true,
        amount(base, wts, w, h, info) {
          const smp = IMG.sampleForDab(o, base, w, info);
          const amt = new Float32Array(w * h);
          if (!smp) return amt;
          for (let j = 0; j < amt.length; j++) {
            if (!wts[j]) continue;
            const i = j * 4;
            if (base[i + 3] === 0) continue;
            let m = similarity(colorDist(base, i, smp[0], smp[1], smp[2]), tol);
            if (m && o.protectFg && colorDist(base, i, fg.r, fg.g, fg.b) <= Math.max(tol, 8)) m = 0;
            amt[j] = wts[j] * m;
          }
          if (o.limits !== 'disc') contiguousOnly(amt, w, h, info.x, info.y);
          return amt;
        },
        apply(base, cov) {
          for (let j = 0; j < cov.length; j++) { const c = cov[j]; if (c) base[j * 4 + 3] *= 1 - c; }
        }
      };
    },
    label: 'Borracha de plano de fundo'
  }));

  /* ---------- Borracha mágica ---------- */
  IMG.Tools.register({
    id: 'magicEraser', name: 'Borracha mágica', icon: 'magicEraser', cursor: 'crosshair',
    defaults: { tolerance: 32, antiAlias: true, contiguous: true, sampleAll: false, opacity: 100 },
    hint: 'Clique para apagar todos os pixels de cor semelhante',
    options() {
      return [
        { type: 'slider', key: 'tolerance', label: 'Tolerância', min: 0, max: 255, step: 1 },
        { type: 'check', key: 'antiAlias', label: 'Suavização de serrilhado' },
        { type: 'check', key: 'contiguous', label: 'Contíguo' },
        { type: 'check', key: 'sampleAll', label: 'Usar todas as camadas' },
        { type: 'slider', key: 'opacity', label: 'Opacidade', min: 1, max: 100, step: 1, unit: '%' }
      ];
    },
    down(ev) {
      const doc = IMG.app.doc, o = T().o('magicEraser');
      const x = Math.floor(ev.x), y = Math.floor(ev.y);
      if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return false;
      const L = doc.active;
      if (!L || L.type !== 'raster' || !L.canvas) { IMG.UI.toast('Selecione uma camada de pixels.'); return false; }
      if (L.locked || L.lockPaint) { IMG.UI.toast('A camada está bloqueada.', 'error'); return false; }
      if (L.isBg) { IMG.Layers.fromBackground(doc, L); bus.emit('layers:change', doc); }
      const W = doc.width, H = doc.height;
      let src;
      if (o.sampleAll) src = IMG.Engine.composite(doc);
      else { src = U.createCanvas(W, H); src.getContext('2d').drawImage(L.canvas, L.x, L.y); }
      const data = src.getContext('2d').getImageData(0, 0, W, H).data;
      const mask = IMG.flood(data, W, H, x, y, o.tolerance, o.contiguous);
      const mc = IMG.maskToCanvas(mask, W, H);
      if (o.antiAlias) IMG.blurCanvas(mc, 0.6);
      IMG.Selection.clip(doc, mc);
      L.ensureCovers(doc.rect);
      const c = L.canvas.getContext('2d');
      c.save();
      c.globalAlpha = o.opacity / 100;
      if (L.lockAlpha) {
        const t = U.createCanvas(W, H), tc = t.getContext('2d');
        tc.drawImage(mc, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = IMG.app.bg; tc.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'source-atop'; c.drawImage(t, -L.x, -L.y);
      } else { c.globalCompositeOperation = 'destination-out'; c.drawImage(mc, -L.x, -L.y); }
      c.restore();
      IMG.markDirty(L);
      IMG.Effects.invalidate(L);
      IMG.Engine.invalidate();
      bus.emit('layer:pixels', L);
      IMG.commit('Borracha mágica');
      IMG.lastPixelOp = { layerId: L.id, label: 'Borracha mágica' };
      return false;
    }
  });
})();
