/* ==========================================================================
   Imaginarium — ferramentas de retoque por pixels
   Desfoque, Nitidez, Borrar (R) · Subexposição, Superexposição, Esponja (O)
   Substituição de cor e Pincel misturador (grupo do Pincel, B)
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U;
  const T = () => IMG.Tools;
  const K = () => IMG.Filters.K;

  const RETOUCH_MODES = [['normal', 'Normal'], ['darken', 'Escurecer'], ['lighten', 'Clarear'], ['hue', 'Matiz'], ['saturation', 'Saturação'], ['color', 'Cor'], ['luminosity', 'Luminosidade']];
  const SAMPLE_ALL = { type: 'check', key: 'sampleAll', label: 'Usar todas as camadas' };

  /** Mistura "res" sobre "cur" (ambos 0..255) pelo modo de retoque. */
  function modeMix(mode, cur, i, res, out) {
    if (mode === 'normal') { out[0] = res[i]; out[1] = res[i + 1]; out[2] = res[i + 2]; return; }
    if (mode === 'darken') { out[0] = Math.min(cur[i], res[i]); out[1] = Math.min(cur[i + 1], res[i + 1]); out[2] = Math.min(cur[i + 2], res[i + 2]); return; }
    if (mode === 'lighten') { out[0] = Math.max(cur[i], res[i]); out[1] = Math.max(cur[i + 1], res[i + 1]); out[2] = Math.max(cur[i + 2], res[i + 2]); return; }
    const c = IMG.Blend.color(mode, cur[i], cur[i + 1], cur[i + 2], Math.round(res[i]), Math.round(res[i + 1]), Math.round(res[i + 2]));
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  }

  /** Pixels compostos (instantâneo do início da pincelada) para "Usar todas as camadas". */
  function compRegion(state, doc, gx, gy, w, h) {
    if (!state.comp) state.comp = IMG.Engine.composite(doc).getContext('2d').getImageData(0, 0, doc.width, doc.height);
    const C = state.comp, out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      const sy = gy + y; if (sy < 0 || sy >= C.height) continue;
      for (let x = 0; x < w; x++) {
        const sx = gx + x; if (sx < 0 || sx >= C.width) continue;
        const a = (sy * C.width + sx) * 4, b = (y * w + x) * 4;
        out[b] = C.data[a]; out[b + 1] = C.data[a + 1]; out[b + 2] = C.data[a + 2]; out[b + 3] = C.data[a + 3];
      }
    }
    return out;
  }

  /** Aplica "res" sobre "data" com peso por pixel (interpolação com alfa pré-multiplicado). */
  function lerpInto(data, res, wts, k, mode) {
    const tmp = [0, 0, 0];
    for (let j = 0, i = 0; j < wts.length; j++, i += 4) {
      const t = wts[j] * k; if (t <= 0) continue;
      const a0 = data[i + 3], a1 = res[i + 3];
      if (mode && mode !== 'normal' && a0 > 0) {
        modeMix(mode, data, i, res, tmp);
        data[i] += (tmp[0] - data[i]) * t; data[i + 1] += (tmp[1] - data[i + 1]) * t; data[i + 2] += (tmp[2] - data[i + 2]) * t;
        continue;
      }
      const a = a0 + (a1 - a0) * t;
      if (a <= 0) { data[i + 3] = 0; continue; }
      for (let q = 0; q < 3; q++) data[i + q] = (data[i + q] * a0 + (res[i + q] * a1 - data[i + q] * a0) * t) / a;
      data[i + 3] = a;
    }
  }

  /* ---------- Desfoque ---------- */
  IMG.Tools.register(IMG.makeBrushTool({
    id: 'blurTool', name: 'Desfoque', icon: 'blurTool', kind: 'pixel', modes: RETOUCH_MODES, showOpacity: false, showFlow: false, showSmoothing: false,
    hint: 'Pinte para suavizar a imagem · repita para desfocar mais',
    defaults: { size: 40, hardness: 50, spacing: 25, mode: 'normal', strength: 50, sampleAll: false },
    extraOptions: () => [{ type: 'slider', key: 'strength', label: 'Intensidade', min: 1, max: 100, step: 1, unit: '%' }, SAMPLE_ALL],
    process(o) {
      const doc = IMG.app.doc, rad = Math.max(1, o.size / 24);
      return {
        pad: Math.ceil(rad * 3),
        process(data, wts, w, h, info) {
          const src = o.sampleAll && !info.onMask ? compRegion(info.state, doc, info.gx, info.gy, w, h) : new Uint8ClampedArray(data);
          K()._gaussian(src, w, h, rad);
          lerpInto(data, src, wts, (o.strength / 100) * 0.6, o.mode);
        }
      };
    },
    label: 'Desfoque'
  }));

  /* ---------- Nitidez ---------- */
  IMG.Tools.register(IMG.makeBrushTool({
    id: 'sharpenTool', name: 'Nitidez', icon: 'sharpenTool', kind: 'pixel', modes: RETOUCH_MODES, showOpacity: false, showFlow: false, showSmoothing: false,
    hint: 'Pinte para aumentar o contraste das bordas',
    defaults: { size: 40, hardness: 50, spacing: 25, mode: 'normal', strength: 50, sampleAll: false, protect: true },
    extraOptions: () => [{ type: 'slider', key: 'strength', label: 'Intensidade', min: 1, max: 100, step: 1, unit: '%' }, SAMPLE_ALL, { type: 'check', key: 'protect', label: 'Proteger detalhes' }],
    process(o) {
      const doc = IMG.app.doc;
      return {
        pad: 4,
        process(data, wts, w, h, info) {
          const base = o.sampleAll && !info.onMask ? compRegion(info.state, doc, info.gx, info.gy, w, h) : new Uint8ClampedArray(data);
          const bl = new Uint8ClampedArray(base);
          K()._gaussian(bl, w, h, 1.2);
          const amt = o.protect ? 0.8 : 1.6, lim = o.protect ? 24 : 255;
          const res = new Uint8ClampedArray(base.length);
          for (let i = 0; i < base.length; i += 4) {
            for (let q = 0; q < 3; q++) { let d = (base[i + q] - bl[i + q]) * amt; if (d > lim) d = lim; else if (d < -lim) d = -lim; res[i + q] = base[i + q] + d; }
            res[i + 3] = base[i + 3];
          }
          lerpInto(data, res, wts, (o.strength / 100) * 0.35, o.mode);
        }
      };
    },
    label: 'Nitidez'
  }));

  /* ---------- Borrar ---------- */
  IMG.Tools.register(IMG.makeBrushTool({
    id: 'smudge', name: 'Borrar', icon: 'smudge', kind: 'pixel', modes: RETOUCH_MODES, showOpacity: false, showFlow: false, showSmoothing: false,
    hint: 'Arraste para espalhar a tinta como com o dedo · "Pintura com o dedo" começa com a cor do primeiro plano',
    defaults: { size: 30, hardness: 60, spacing: 8, mode: 'normal', strength: 50, sampleAll: false, finger: false },
    extraOptions: () => [{ type: 'slider', key: 'strength', label: 'Intensidade', min: 1, max: 100, step: 1, unit: '%' }, SAMPLE_ALL, { type: 'check', key: 'finger', label: 'Pintura com o dedo' }],
    process(o) {
      const doc = IMG.app.doc, k = o.strength / 100, fg = U.hexToRgb(IMG.app.fg);
      return {
        spacing: 0.08,
        process(data, wts, w, h, info) {
          const st = info.state;
          const D = Math.ceil(info.R * 2) + 4, half = D / 2;
          const pick = o.sampleAll && !info.onMask ? compRegion(st, doc, info.gx, info.gy, w, h) : data;
          if (!st.f) {
            // "dedo": cor pré-multiplicada (r, g, b, a) por pixel do carimbo
            st.f = new Float32Array(D * D * 4); st.D = D;
            for (let fy = 0; fy < D; fy++) for (let fx = 0; fx < D; fx++) {
              const o4 = (fy * D + fx) * 4;
              if (o.finger) { st.f[o4] = fg.r; st.f[o4 + 1] = fg.g; st.f[o4 + 2] = fg.b; st.f[o4 + 3] = 255; continue; }
              const x = Math.floor(info.x - half + fx), y = Math.floor(info.y - half + fy);
              if (x < 0 || y < 0 || x >= w || y >= h) continue;
              const i = (y * w + x) * 4, a = pick[i + 3];
              st.f[o4] = pick[i] * a / 255; st.f[o4 + 1] = pick[i + 1] * a / 255; st.f[o4 + 2] = pick[i + 2] * a / 255; st.f[o4 + 3] = a;
            }
            return;
          }
          const f = st.f, FD = st.D, fh = FD / 2, tmp = [0, 0, 0], one = new Uint8ClampedArray(4);
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const j = y * w + x, wt = wts[j]; if (!wt) continue;
            const fx = Math.floor(x - info.x + fh), fy = Math.floor(y - info.y + fh);
            if (fx < 0 || fy < 0 || fx >= FD || fy >= FD) continue;
            const o4 = (fy * FD + fx) * 4, i = j * 4;
            const a0 = data[i + 3], t = wt * (0.35 + 0.65 * k);
            const pr = data[i] * a0 / 255, pg = data[i + 1] * a0 / 255, pb = data[i + 2] * a0 / 255;
            let nr = pr + (f[o4] - pr) * t, ng = pg + (f[o4 + 1] - pg) * t, nb = pb + (f[o4 + 2] - pb) * t, na = a0 + (f[o4 + 3] - a0) * t;
            if (o.mode !== 'normal' && a0 > 0 && na > 0) {
              one[0] = nr * 255 / na; one[1] = ng * 255 / na; one[2] = nb * 255 / na; one[3] = na;
              modeMix(o.mode, data, i, one, tmp);
              nr = tmp[0] * a0 / 255; ng = tmp[1] * a0 / 255; nb = tmp[2] * a0 / 255; na = a0;
            }
            if (na > 0.5) { data[i] = nr * 255 / na; data[i + 1] = ng * 255 / na; data[i + 2] = nb * 255 / na; data[i + 3] = na; } else data[i + 3] = 0;
            // o dedo recolhe parte da tinta que encontra (quanto menor a intensidade, mais recolhe)
            const pk = 1 - k * 0.97;
            if (pk > 0) {
              const pa = pick === data ? data[i + 3] : pick[i + 3];
              const src = pick === data ? data : pick;
              f[o4] += (src[i] * pa / 255 - f[o4]) * pk; f[o4 + 1] += (src[i + 1] * pa / 255 - f[o4 + 1]) * pk; f[o4 + 2] += (src[i + 2] * pa / 255 - f[o4 + 2]) * pk; f[o4 + 3] += (pa - f[o4 + 3]) * pk;
            }
          }
        }
      };
    },
    label: 'Borrar'
  }));

  /* ---------- Subexposição / Superexposição ---------- */
  const RANGES = [['shadows', 'Sombras'], ['midtones', 'Tons médios'], ['highlights', 'Realces']];
  function dodgeBurn(v, e, range, dodge) {
    if (dodge) {
      if (range === 'shadows') return v + e * (1 - v) * (1 - v) * 0.9;
      if (range === 'highlights') return v * (1 + e * v * 1.1);
      return Math.pow(v, 1 / (1 + e * 0.9));
    }
    if (range === 'shadows') return v * (1 - e * (1 - v) * 1.1);
    if (range === 'highlights') return v - e * v * v * 0.85;
    return Math.pow(v, 1 + e * 0.9);
  }
  IMG.dodgeBurn = dodgeBurn;
  function makeDodge(id, name, icon, dodge) {
    IMG.Tools.register(IMG.makeBrushTool({
      id, name, icon, kind: 'pixel', showMode: false, showOpacity: false, showFlow: false, showSmoothing: false,
      hint: dodge ? 'Clareia as áreas pintadas · Alt: alterna para Superexposição' : 'Escurece as áreas pintadas · Alt: alterna para Subexposição',
      altPick: false, altHandled: true,
      defaults: { size: 60, hardness: 0, spacing: 20, range: 'midtones', exposure: 50, protect: true },
      extraOptions: () => [
        { type: 'select', key: 'range', label: 'Intervalo', options: RANGES, width: 110 },
        { type: 'slider', key: 'exposure', label: 'Exposição', min: 1, max: 100, step: 1, unit: '%' },
        { type: 'check', key: 'protect', label: 'Proteger tons' }
      ],
      process(o, ev) {
        const isDodge = ev.alt ? !dodge : dodge, ex = o.exposure / 100;
        return {
          apply(base, cov, w, h, info) {
            for (let j = 0, i = 0; j < cov.length; j++, i += 4) {
              const c = cov[j]; if (!c || base[i + 3] === 0) continue;
              const e = c * ex;
              if (info.onMask) { base[i] = base[i + 1] = base[i + 2] = 255 * U.clamp(dodgeBurn(base[i] / 255, e, o.range, isDodge), 0, 1); continue; }
              if (o.protect) {
                const r = base[i] / 255, g = base[i + 1] / 255, b = base[i + 2] / 255;
                const l = 0.299 * r + 0.587 * g + 0.114 * b;
                const l2 = U.clamp(dodgeBurn(l, e, o.range, isDodge), 0, 1);
                if (l <= 0.0001) { base[i] = base[i + 1] = base[i + 2] = l2 * 255; continue; }
                const kk = l2 / l;
                let nr = r * kk, ng = g * kk, nb = b * kk;
                const mx = Math.max(nr, ng, nb);
                if (mx > 1) { const s = (1 - l2) / Math.max(1e-6, mx - l2); nr = l2 + (nr - l2) * s; ng = l2 + (ng - l2) * s; nb = l2 + (nb - l2) * s; }
                base[i] = nr * 255; base[i + 1] = ng * 255; base[i + 2] = nb * 255;
              } else for (let q = 0; q < 3; q++) base[i + q] = 255 * U.clamp(dodgeBurn(base[i + q] / 255, e, o.range, isDodge), 0, 1);
            }
          }
        };
      },
      label: name
    }));
  }
  makeDodge('dodge', 'Subexposição', 'dodge', true);
  makeDodge('burn', 'Superexposição', 'burn', false);

  /* ---------- Esponja ---------- */
  IMG.Tools.register(IMG.makeBrushTool({
    id: 'sponge', name: 'Esponja', icon: 'sponge', kind: 'pixel', showMode: false, showOpacity: false, showFlow: false, showSmoothing: false,
    hint: 'Satura ou dessatura as áreas pintadas',
    defaults: { size: 60, hardness: 0, spacing: 20, smode: 'desat', sflow: 50, vibrance: true },
    extraOptions: () => [
      { type: 'select', key: 'smode', label: 'Modo', options: [['desat', 'Dessaturar'], ['sat', 'Saturar']], width: 110 },
      { type: 'slider', key: 'sflow', label: 'Fluxo', min: 1, max: 100, step: 1, unit: '%' },
      { type: 'check', key: 'vibrance', label: 'Vibração', title: 'Evita a saturação excessiva e protege os tons de pele' }
    ],
    process(o) {
      const fl = o.sflow / 100, sat = o.smode === 'sat';
      return {
        apply(base, cov) {
          for (let j = 0, i = 0; j < cov.length; j++, i += 4) {
            const c = cov[j]; if (!c || base[i + 3] === 0) continue;
            const r = base[i], g = base[i + 1], b = base[i + 2];
            const l = 0.299 * r + 0.587 * g + 0.114 * b;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
            let e = c * fl;
            if (o.vibrance) e *= sat ? (1 - s) * (1 - s) : 0.4 + 0.6 * (1 - s);
            const k = sat ? 1 + e * 1.5 : 1 - e;
            base[i] = l + (r - l) * k; base[i + 1] = l + (g - l) * k; base[i + 2] = l + (b - l) * k;
          }
        }
      };
    },
    label: 'Esponja'
  }));

  /* ---------- Substituição de cor ---------- */
  IMG.Tools.register(IMG.makeBrushTool({
    id: 'colorReplace', name: 'Substituição de cor', icon: 'colorReplace', kind: 'pixel', showOpacity: false, showFlow: false, showSmoothing: false,
    modes: [['hue', 'Matiz'], ['saturation', 'Saturação'], ['color', 'Cor'], ['luminosity', 'Luminosidade']],
    hint: 'Troca a cor amostrada pela cor do primeiro plano, mantendo a textura',
    defaults: { size: 40, hardness: 100, spacing: 20, mode: 'color', sampling: 'cont', limits: 'cont', tolerance: 30, antiAlias: true },
    extraOptions: () => [
      { type: 'select', key: 'sampling', label: 'Amostragem', options: [['cont', 'Contínua'], ['once', 'Uma vez'], ['bgswatch', 'Amostra de fundo']], width: 120 },
      { type: 'select', key: 'limits', label: 'Limites', options: [['disc', 'Não contíguo'], ['cont', 'Contíguo'], ['edges', 'Localizar arestas']], width: 120 },
      { type: 'slider', key: 'tolerance', label: 'Tolerância', min: 0, max: 100, step: 1, unit: '%' },
      { type: 'check', key: 'antiAlias', label: 'Suavização de serrilhado' }
    ],
    process(o, ev, tool, L) {
      if (IMG.app.doc.editMask && L.mask) { IMG.UI.toast('Substituição de cor não funciona em máscaras.'); return false; }
      const tol = (o.tolerance / 100) * 255, fg = U.hexToRgb(IMG.app.fg);
      return {
        amount(base, wts, w, h, info) {
          const smp = IMG.sampleForDab(o, base, w, info);
          const amt = new Float32Array(w * h);
          if (!smp) return amt;
          for (let j = 0; j < amt.length; j++) {
            if (!wts[j]) continue;
            const i = j * 4;
            const d = Math.max(Math.abs(base[i] - smp[0]), Math.abs(base[i + 1] - smp[1]), Math.abs(base[i + 2] - smp[2]));
            const m = o.antiAlias ? IMG.colorSimilarity(d, tol) : d <= tol ? 1 : 0;
            amt[j] = wts[j] * m;
          }
          if (o.limits !== 'disc') IMG.contiguousOnly(amt, w, h, info.x, info.y);
          return amt;
        },
        apply(base, cov) {
          for (let j = 0, i = 0; j < cov.length; j++, i += 4) {
            const c = cov[j]; if (!c) continue;
            const r = IMG.Blend.color(o.mode, base[i], base[i + 1], base[i + 2], fg.r, fg.g, fg.b);
            base[i] += (r[0] - base[i]) * c; base[i + 1] += (r[1] - base[i + 1]) * c; base[i + 2] += (r[2] - base[i + 2]) * c;
          }
        }
      };
    },
    label: 'Substituição de cor'
  }));

  /* ---------- Pincel misturador ---------- */
  IMG.Tools.register(IMG.makeBrushTool({
    id: 'mixer', name: 'Pincel misturador', icon: 'mixer', kind: 'pixel', showMode: false, showOpacity: false, showFlow: false, showSmoothing: false,
    hint: 'Mistura a cor carregada com a tinta da tela · Alt+clique: carrega a cor sob o cursor',
    altPick: false, altHandled: true,
    defaults: { size: 40, hardness: 60, spacing: 10, wet: 50, load: 50, mix: 50, mflow: 100, clean: true, sampleAll: false },
    extraOptions: () => [
      { type: 'slider', key: 'wet', label: 'Umidade', min: 0, max: 100, step: 1, unit: '%' },
      { type: 'slider', key: 'load', label: 'Carga', min: 1, max: 100, step: 1, unit: '%' },
      { type: 'slider', key: 'mix', label: 'Mistura', min: 0, max: 100, step: 1, unit: '%' },
      { type: 'slider', key: 'mflow', label: 'Fluxo', min: 1, max: 100, step: 1, unit: '%' },
      { type: 'check', key: 'clean', label: 'Limpar após cada pincelada' },
      SAMPLE_ALL
    ],
    begin(ev, tool) {
      if (ev.alt) {
        const c = IMG.Engine.sample(IMG.app.doc, ev.x, ev.y, 1);
        if (c) { tool.loaded = [c.r, c.g, c.b]; IMG.app.setFg(U.rgbToHex(c.r, c.g, c.b)); }
        return false;
      }
      return {};
    },
    process(o, ev, tool) {
      const doc = IMG.app.doc, fg = U.hexToRgb(IMG.app.fg);
      if (o.clean || !tool.res) tool.res = tool.loaded && !o.clean ? tool.loaded.slice() : [fg.r, fg.g, fg.b];
      if (o.clean) tool.loaded = null;
      let paintLeft = 1;
      return {
        process(data, wts, w, h, info) {
          const pick = o.sampleAll && !info.onMask ? compRegion(info.state, doc, info.gx, info.gy, w, h) : data;
          // cor da tela sob o pincel
          let sr = 0, sg = 0, sb = 0, sw = 0;
          for (let j = 0, i = 0; j < wts.length; j++, i += 4) { const t = wts[j] * pick[i + 3] / 255; if (!t) continue; sr += pick[i] * t; sg += pick[i + 1] * t; sb += pick[i + 2] * t; sw += t; }
          const res = tool.res, wet = o.wet / 100, mixK = o.mix / 100;
          if (sw > 0) { sr /= sw; sg /= sw; sb /= sw; res[0] += (sr - res[0]) * wet * mixK; res[1] += (sg - res[1]) * wet * mixK; res[2] += (sb - res[2]) * wet * mixK; }
          paintLeft *= 1 - (1 - o.load / 100) * 0.05;
          const k = (o.mflow / 100) * (0.25 + 0.75 * paintLeft) * (1 - wet * 0.6);
          for (let j = 0, i = 0; j < wts.length; j++, i += 4) {
            const t = wts[j] * k; if (!t) continue;
            const a0 = data[i + 3], a = a0 + (255 - a0) * t;
            for (let q = 0; q < 3; q++) data[i + q] = (data[i + q] * a0 * (1 - t) + res[q] * 255 * t) / a;
            data[i + 3] = a;
          }
        }
      };
    },
    label: 'Pincel misturador'
  }));
})();
