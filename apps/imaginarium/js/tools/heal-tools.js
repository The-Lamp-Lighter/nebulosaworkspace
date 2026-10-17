/* ==========================================================================
   Imaginarium — grupo da Recuperação (J) e preenchimento sensível ao conteúdo
   Pincel de recuperação para manchas, Pincel de recuperação, Remendo,
   Movimento sensível ao conteúdo e Olhos vermelhos.
   A "recuperação" usa a textura da origem e ajusta cor e luz pela borda do
   destino (interpolação harmônica da diferença, como uma membrana).
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus;
  const T = () => IMG.Tools;

  /* ==================================================================
     Membrana: preenche os valores desconhecidos com uma interpolação
     suave dos conhecidos (pirâmide "push-pull" + relaxação de Jacobi).
     ================================================================== */
  function membrane(val, known, w, h, ch) {
    const levels = [{ w, h, v: val, wt: Float32Array.from(known) }];
    let anyHole = false;
    for (let i = 0; i < known.length; i++) if (!known[i]) { anyHole = true; break; }
    if (!anyHole) return val;
    for (;;) {
      const L = levels[levels.length - 1];
      if (L.w <= 1 && L.h <= 1) break;
      const nw = Math.max(1, Math.ceil(L.w / 2)), nh = Math.max(1, Math.ceil(L.h / 2));
      const v = new Float32Array(nw * nh * ch), wt = new Float32Array(nw * nh);
      let holes = false;
      for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
        let ws = 0; const acc = [0, 0, 0, 0];
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const sx = x * 2 + dx, sy = y * 2 + dy; if (sx >= L.w || sy >= L.h) continue;
          const j = sy * L.w + sx, q = L.wt[j]; if (!q) continue;
          ws += q; for (let c = 0; c < ch; c++) acc[c] += L.v[j * ch + c] * q;
        }
        const k = y * nw + x;
        wt[k] = Math.min(1, ws);
        if (ws > 0) for (let c = 0; c < ch; c++) v[k * ch + c] = acc[c] / ws; else holes = true;
      }
      levels.push({ w: nw, h: nh, v, wt });
      if (!holes && levels.length > 3) break;
    }
    for (let k = levels.length - 2; k >= 0; k--) {
      const L = levels[k], P = levels[k + 1];
      for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        const j = y * L.w + x, q = L.wt[j];
        if (q >= 1) continue;
        const fx = U.clamp((x + 0.5) / 2 - 0.5, 0, P.w - 1), fy = U.clamp((y + 0.5) / 2 - 0.5, 0, P.h - 1);
        const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(P.w - 1, x0 + 1), y1 = Math.min(P.h - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
        for (let c = 0; c < ch; c++) {
          const p = (P.v[(y0 * P.w + x0) * ch + c] * (1 - ax) + P.v[(y0 * P.w + x1) * ch + c] * ax) * (1 - ay) + (P.v[(y1 * P.w + x0) * ch + c] * (1 - ax) + P.v[(y1 * P.w + x1) * ch + c] * ax) * ay;
          L.v[j * ch + c] = L.v[j * ch + c] * q + p * (1 - q);
        }
        L.wt[j] = 1;
      }
    }
    // relaxação nos pixels desconhecidos
    const unk = [];
    for (let i = 0; i < known.length; i++) if (!known[i]) unk.push(i);
    const iters = Math.min(60, 8 + Math.round(Math.sqrt(unk.length) / 2));
    for (let it = 0; it < iters; it++) {
      for (const i of unk) {
        const x = i % w, y = (i / w) | 0;
        const l = x > 0 ? i - 1 : i, r = x < w - 1 ? i + 1 : i, u = y > 0 ? i - w : i, d = y < h - 1 ? i + w : i;
        for (let c = 0; c < ch; c++) val[i * ch + c] = (val[l * ch + c] + val[r * ch + c] + val[u * ch + c] + val[d * ch + c]) * 0.25;
      }
    }
    return val;
  }

  /**
   * Recuperação: D = destino, S = origem (RGBA), cov = cobertura (0..1).
   * Retorna os pixels resultantes: textura de S com a cor/luz ajustadas pela borda de D.
   */
  function healRegion(D, S, cov, w, h, o = {}) {
    const n = w * h, known = new Uint8Array(n), diff = new Float32Array(n * 3);
    const adapt = o.adapt == null ? 1 : o.adapt;
    for (let j = 0; j < n; j++) {
      if (cov[j] < 0.01) {
        known[j] = 1;
        const i = j * 4;
        if (D[i + 3] && S[i + 3]) { diff[j * 3] = D[i] - S[i]; diff[j * 3 + 1] = D[i + 1] - S[i + 1]; diff[j * 3 + 2] = D[i + 2] - S[i + 2]; }
      }
    }
    membrane(diff, known, w, h, 3);
    const out = new Uint8ClampedArray(D), tmp = [0, 0, 0];
    for (let j = 0; j < n; j++) {
      const c = cov[j]; if (!c) continue;
      const i = j * 4;
      let r = S[i] + diff[j * 3] * adapt, g = S[i + 1] + diff[j * 3 + 1] * adapt, b = S[i + 2] + diff[j * 3 + 2] * adapt;
      if (o.mode && o.mode !== 'normal' && o.mode !== 'replace') {
        const m = IMG.Blend.color(o.mode, D[i], D[i + 1], D[i + 2], U.clamp(Math.round(r), 0, 255), U.clamp(Math.round(g), 0, 255), U.clamp(Math.round(b), 0, 255));
        r = m[0]; g = m[1]; b = m[2];
      }
      if (o.mode === 'replace') { r = S[i]; g = S[i + 1]; b = S[i + 2]; }
      tmp[0] = r; tmp[1] = g; tmp[2] = b;
      const a0 = D[i + 3], a1 = S[i + 3], a = a0 + (a1 - a0) * c;
      if (a <= 0) { out[i + 3] = 0; continue; }
      for (let q = 0; q < 3; q++) out[i + q] = (D[i + q] * a0 + (U.clamp(tmp[q], 0, 255) * a1 - D[i + q] * a0) * c) / a;
      out[i + 3] = a;
    }
    return out;
  }

  const Heal = (IMG.Heal = { membrane, healRegion });

  /* ---------- utilidades de região ---------- */
  function readRegion(canvas, x, y, w, h) {
    const c = U.createCanvas(w, h), ctx = c.getContext('2d');
    ctx.drawImage(canvas, -x, -y);
    return ctx.getImageData(0, 0, w, h).data;
  }
  function alphaRegion(canvas, x, y, w, h) {
    const d = readRegion(canvas, x, y, w, h), out = new Float32Array(w * h);
    for (let j = 0; j < out.length; j++) out[j] = d[j * 4 + 3] / 255;
    return out;
  }
  function alphaBounds(canvas) {
    const W = canvas.width, H = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  function toGray(d) { const o = new Uint8ClampedArray(d.length); for (let i = 0; i < d.length; i += 4) { o[i] = o[i + 1] = o[i + 2] = d[i + 3]; o[i + 3] = 255; } return o; }
  function fromGray(d) { for (let i = 0; i < d.length; i += 4) { d[i + 3] = d[i]; d[i] = d[i + 1] = d[i + 2] = 255; } return d; }
  function surfaceOf(doc, L) {
    const onMask = !!(doc.editMask && L.mask);
    if (onMask) { IMG.Layers.maskEnsureCovers(L.mask, doc.rect); return { surf: L.mask, onMask }; }
    L.ensureCovers(doc.rect);
    return { surf: L, onMask };
  }
  function writeSurface(doc, L, surf, R, data, onMask) {
    if (onMask) fromGray(data);
    surf.canvas.getContext('2d').putImageData(new ImageData(data, R.w, R.h), R.x - surf.x, R.y - surf.y);
    IMG.markDirty(surf, { x: R.x - surf.x, y: R.y - surf.y, w: R.w, h: R.h });
    IMG.Effects.invalidate(L);
    IMG.Engine.invalidateLayer(L, R);
    bus.emit('layer:pixels', L);
  }

  /* ==================================================================
     Preenchimento sensível ao conteúdo
     ================================================================== */
  const Inpaint = (IMG.Inpaint = {
    /** Executa o PatchMatch sobre "data" (RGBA w×h) nos pixels com hole[j] = 255. */
    run(data, w, h, hole, o = {}) {
      return IMG.Filters.run('inpaint', new ImageData(new Uint8ClampedArray(data), w, h), { mask: hole, patch: o.patch || 7, quality: o.quality || 1, seed: o.seed || 1234 }, null).then((r) => r.data);
    },

    /**
     * Preenche a camada L na área do canvas "holeC" (alfa = buraco, no espaço do documento).
     * o: { sampleAll, mode, pad, opacity, label }
     */
    async fillLayer(doc, L, holeC, o = {}) {
      if (!L || (L.type !== 'raster' && !(doc.editMask && L.mask))) { IMG.UI.toast('Selecione uma camada de pixels.'); return false; }
      const B = alphaBounds(holeC);
      if (!B) return false;
      const { surf, onMask } = surfaceOf(doc, L);
      const big = Math.max(B.w, B.h);
      let pad = o.pad != null ? o.pad : U.clamp(Math.round(big * 1.6), 24, 700);
      let R;
      for (;;) {
        R = U.rectIntersect(U.rectInt(U.rectInflate(B, pad)), doc.rect);
        if (!R || R.w * R.h <= 2.6e6 || pad <= 16) break;
        pad = Math.round(pad * 0.75);
      }
      if (!R) return false;
      const cur = readRegion(surf.canvas, R.x - surf.x, R.y - surf.y, R.w, R.h);
      const curD = onMask ? toGray(cur) : cur;
      const src = o.sampleAll && !onMask ? readRegion(IMG.Engine.composite(doc), R.x, R.y, R.w, R.h) : curD;
      const ha = alphaRegion(holeC, R.x, R.y, R.w, R.h);
      if (IMG.activeSelection(doc) && o.clipSel !== false) { const sa = alphaRegion(doc.selection.canvas, R.x, R.y, R.w, R.h); for (let j = 0; j < ha.length; j++) ha[j] *= sa[j]; }
      // buraco binário um pouco dilatado (cobre as bordas suaves)
      const hole = new Uint8Array(R.w * R.h);
      for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) {
        const j = y * R.w + x; if (ha[j] <= 0.02) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < R.w && yy < R.h) hole[yy * R.w + xx] = 255; }
      }
      const done = R.w * R.h > 250000 ? IMG.UI.busy(o.label ? o.label + '…' : 'Preenchendo…') : null;
      let res;
      try { res = await this.run(src, R.w, R.h, hole, { patch: o.patch, quality: o.quality }); }
      catch (err) { console.error(err); IMG.UI.toast('Falha no preenchimento: ' + err.message, 'error'); return false; }
      finally { if (done) done(); }
      if (IMG.app.doc !== doc && !IMG.app.docs.includes(doc)) return false;
      const out = new Uint8ClampedArray(curD), op = o.opacity == null ? 1 : o.opacity, tmp = [0, 0, 0];
      for (let j = 0; j < ha.length; j++) {
        const t = Math.min(1, ha[j] * 1.15) * op; if (t <= 0) continue;
        const i = j * 4;
        let r = res[i], g = res[i + 1], b = res[i + 2];
        if (o.mode && o.mode !== 'normal' && o.mode !== 'replace' && curD[i + 3]) { const m = IMG.Blend.color(o.mode, curD[i], curD[i + 1], curD[i + 2], r, g, b); r = m[0]; g = m[1]; b = m[2]; }
        tmp[0] = r; tmp[1] = g; tmp[2] = b;
        const a0 = curD[i + 3], a1 = res[i + 3], a = a0 + (a1 - a0) * t;
        if (a <= 0) { out[i + 3] = 0; continue; }
        for (let q = 0; q < 3; q++) out[i + q] = (curD[i + q] * a0 + (tmp[q] * a1 - curD[i + q] * a0) * t) / a;
        out[i + 3] = a;
      }
      writeSurface(doc, L, surf, R, out, onMask);
      return true;
    },

    /** Editar › Preenchimento sensível ao conteúdo (preenche a seleção). */
    async contentAwareFill(doc) {
      doc = doc || IMG.app.doc;
      if (!doc) return;
      if (!doc.selection) { IMG.UI.toast('Faça uma seleção da área a preencher.'); return; }
      const L = IMG.Layers.paintTarget(doc);
      if (!L) return;
      const ok = await this.fillLayer(doc, L, doc.selection.canvas, { label: 'Preenchimento sensível ao conteúdo', clipSel: false, quality: 1.3 });
      if (ok) { IMG.commit('Preenchimento sensível ao conteúdo'); IMG.lastPixelOp = { layerId: L.id, label: 'Preenchimento sensível ao conteúdo' }; }
    }
  });

  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C) => {
    C('edit.contentAware', 'Preenchimento sensível ao conteúdo', () => Inpaint.contentAwareFill(IMG.app.doc), { enabled: () => !!(IMG.app.doc && IMG.app.doc.selection) });
  });

  const HEAL_MODES = [['normal', 'Normal'], ['replace', 'Substituir'], ['multiply', 'Multiplicação'], ['screen', 'Tela'], ['darken', 'Escurecer'], ['lighten', 'Clarear'], ['color', 'Cor'], ['luminosity', 'Luminosidade']];

  /* ---------- Pincel de recuperação para manchas ---------- */
  IMG.Tools.register(IMG.makeBrushTool({
    id: 'spotHeal', name: 'Pincel de recuperação para manchas', icon: 'spotHeal', modes: HEAL_MODES, showOpacity: false, showFlow: false, showAirbrush: false,
    hint: 'Pinte sobre manchas e imperfeições; elas são preenchidas com o conteúdo ao redor',
    defaults: { size: 30, hardness: 100, spacing: 15, mode: 'normal', type: 'content', sampleAll: false, smoothing: 0 },
    extraOptions: () => [
      { type: 'select', key: 'type', label: 'Tipo', options: [['proximity', 'Correspondência por proximidade'], ['texture', 'Criar textura'], ['content', 'Sensível ao conteúdo']], width: 150 },
      { type: 'check', key: 'sampleAll', label: 'Usar todas as camadas' }
    ],
    makeStroke(o) { return new IMG.MaskStroke(o); },
    endStroke(s, tool) {
      const o = T().o('spotHeal');
      if (!s.bbox) return;
      tool.pending = s; tool.busy = true;
      const pad = o.type === 'proximity' ? Math.max(12, o.size) : o.type === 'texture' ? Math.max(16, o.size * 1.2) : undefined;
      Inpaint.fillLayer(s.doc, s.layer, s.c, { sampleAll: o.sampleAll, mode: o.mode, pad, patch: o.type === 'texture' ? 5 : 7, label: 'Recuperação' })
        .then((ok) => { if (ok) { IMG.commit('Pincel de recuperação para manchas'); IMG.lastPixelOp = { layerId: s.layer.id, label: 'Pincel de recuperação para manchas' }; } })
        .finally(() => { tool.busy = false; tool.pending = null; IMG.Engine.requestRender(); });
    },
    overlay(ctx, v, tool) { const s = tool.stroke || tool.pending; if (s && s.draw) s.draw(ctx, v, 0.45); }
  }));

  /* ---------- Pincel de recuperação ---------- */
  const CSH = IMG.cloneSourceBehavior('heal');
  IMG.Tools.register(IMG.makeBrushTool({
    id: 'heal', name: 'Pincel de recuperação', icon: 'heal', mode: 'clone', modes: HEAL_MODES, altHandled: true, showOpacity: false, showFlow: false,
    hint: 'Alt+clique: definir a origem · pinte para recuperar com a textura da origem',
    defaults: { size: 30, hardness: 100, spacing: 12, mode: 'normal', source: 'sampled', pattern: 'p0', aligned: true, sample: 'current', smoothing: 0 },
    extraOptions: (o) => [
      { type: 'select', key: 'source', label: 'Origem', options: [['sampled', 'Amostra'], ['pattern', 'Padrão']], width: 100 },
      o.source === 'pattern' ? { type: 'custom', build: () => IMG.Widgets.patternBtn(o.pattern, (v) => T().setOpt('heal', 'pattern', v, true)).el } : null,
      { type: 'check', key: 'aligned', label: 'Alinhado' },
      { type: 'select', key: 'sample', label: 'Amostra', options: [['current', 'Camada atual'], ['below', 'Atual e abaixo'], ['all', 'Todas as camadas']], width: 130 }
    ].filter(Boolean),
    begin(ev, tool) { if (T().o('heal').source === 'pattern') { if (ev.alt) return false; return {}; } return CSH.begin(ev, tool); },
    prepare(ev, tool, L) {
      const doc = IMG.app.doc, o = T().o('heal');
      const r = o.source === 'pattern' ? (() => { const c = U.createCanvas(doc.width, doc.height); IMG.Patterns.fill(c.getContext('2d'), o.pattern, doc.width, doc.height); return { src: { canvas: c, x: 0, y: 0 }, off: { dx: 0, dy: 0 } }; })() : CSH.sourceFor(ev, tool, L);
      return Object.assign(r, { blend: 'normal' });
    },
    overlay(ctx, v, tool) { if (T().o('heal').source !== 'pattern') CSH.overlay(ctx, v, tool); },
    endStroke(s) {
      const o = T().o('heal');
      if (!s.bbox || s.onMask || o.mode === 'replace') { s.end('Pincel de recuperação'); return; }
      const doc = s.doc, surf = s.surf;
      const R = U.rectIntersect(U.rectInt(U.rectInflate(s.bbox, 6)), { x: s.sx, y: s.sy, w: surf.canvas.width, h: surf.canvas.height });
      if (!R) { s.end('Pincel de recuperação'); return; }
      const D = readRegion(s.base, R.x - s.sx, R.y - s.sy, R.w, R.h);
      const S = (() => { const c = U.createCanvas(R.w, R.h), x = c.getContext('2d'); x.drawImage(s.src.canvas, s.src.x + s.off.dx - R.x, s.src.y + s.off.dy - R.y); return x.getImageData(0, 0, R.w, R.h).data; })();
      const cov = alphaRegion(s.buf, R.x, R.y, R.w, R.h);
      if (IMG.activeSelection(doc)) { const sa = alphaRegion(doc.selection.canvas, R.x, R.y, R.w, R.h); for (let j = 0; j < cov.length; j++) cov[j] *= sa[j]; }
      const out = healRegion(D, S, cov, R.w, R.h, { mode: o.mode });
      if (s.layer.lockAlpha) for (let i = 3; i < out.length; i += 4) out[i] = D[i];
      s.base = s.buf = s.clipTmp = null;
      writeSurface(doc, s.layer, surf, R, out, false);
      IMG.commit('Pincel de recuperação');
      IMG.lastPixelOp = { layerId: s.layer.id, label: 'Pincel de recuperação' };
    }
  }));

  /* ==================================================================
     Remendo e Movimento sensível ao conteúdo: desenhe a seleção (laço)
     e arraste-a; ao soltar, o conteúdo é recuperado.
     ================================================================== */
  function lassoDragTool(cfg) {
    return {
      id: cfg.id, name: cfg.name, icon: cfg.icon, cursor: 'crosshair', defaults: cfg.defaults, hint: cfg.hint,
      options() {
        return [{ type: 'seg', key: 'smode', options: IMG.SEL_MODES }, { type: 'sep' }].concat(cfg.options());
      },
      down(ev) {
        const doc = IMG.app.doc;
        if (this.busy) return false;
        if (doc.selection && !ev.shift && !ev.alt && IMG.Selection.contains(doc, ev.x, ev.y)) {
          const L = IMG.Layers.paintTarget(doc);
          if (!L || L.type !== 'raster') { IMG.UI.toast('Selecione uma camada de pixels.'); return false; }
          this.drag = { x0: ev.x, y0: ev.y, dx: 0, dy: 0, tint: tinted(doc.selection.canvas) };
          return;
        }
        this.mode = IMG.selModeFrom(ev, T().o(cfg.id).smode || 'new');
        this.pts = [{ x: ev.x, y: ev.y }];
      },
      move(ev) {
        if (this.drag) { this.drag.dx = Math.round(ev.x - this.drag.x0); this.drag.dy = Math.round(ev.y - this.drag.y0); IMG.Engine.requestRender(); return; }
        if (!this.pts) return;
        const l = this.pts[this.pts.length - 1];
        if (Math.hypot(ev.x - l.x, ev.y - l.y) * IMG.app.doc.view.zoom < 1.5) return;
        this.pts.push({ x: ev.x, y: ev.y });
        IMG.Engine.requestRender();
      },
      up() {
        const doc = IMG.app.doc;
        if (this.drag) {
          const d = this.drag; this.drag = null; IMG.Engine.requestRender();
          if (!d.dx && !d.dy) return;
          this.busy = true;
          Promise.resolve(cfg.apply(doc, d.dx, d.dy)).catch((e) => { console.error(e); IMG.UI.toast('Erro: ' + e.message, 'error'); }).finally(() => { this.busy = false; IMG.Engine.requestRender(); });
          return;
        }
        const pts = this.pts; this.pts = null; IMG.Engine.requestRender();
        if (!pts || pts.length < 3) { if (this.mode === 'new' && IMG.Selection.clear(doc)) IMG.commit('Desselecionar'); return; }
        IMG.Selection.fromPath(doc, (c) => { c.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y); c.closePath(); }, this.mode, { rule: 'evenodd' });
        IMG.commit(cfg.name);
      },
      hover(ev) { const doc = IMG.app.doc; T().cursor(doc.selection && !ev.shift && !ev.alt && IMG.Selection.contains(doc, ev.x, ev.y) ? 'move' : 'crosshair'); },
      drawOverlay(ctx, v) {
        if (this.drag) {
          const doc = IMG.app.doc, d = this.drag;
          ctx.save(); ctx.globalAlpha = 0.4; ctx.imageSmoothingEnabled = v.zoom < 1;
          ctx.drawImage(d.tint, v.x + d.dx * v.zoom, v.y + d.dy * v.zoom, doc.width * v.zoom, doc.height * v.zoom);
          ctx.restore();
          return;
        }
        const pts = this.pts;
        if (!pts || pts.length < 2) return;
        IMG.dashedPath(ctx, () => { ctx.moveTo(v.x + pts[0].x * v.zoom, v.y + pts[0].y * v.zoom); for (let i = 1; i < pts.length; i++) ctx.lineTo(v.x + pts[i].x * v.zoom, v.y + pts[i].y * v.zoom); });
      }
    };
  }
  function tinted(selC) {
    const c = U.createCanvas(selC.width, selC.height), x = c.getContext('2d');
    x.drawImage(selC, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#3d8bff'; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  /** Seleção deslocada (canvas do documento). */
  function shiftedSel(doc, dx, dy) {
    const c = U.createCanvas(doc.width, doc.height);
    c.getContext('2d').drawImage(doc.selection.canvas, dx, dy);
    return c;
  }
  function moveSelection(doc, dx, dy) {
    const s = doc.selection, c = shiftedSel(doc, dx, dy), x = s.canvas.getContext('2d');
    x.clearRect(0, 0, doc.width, doc.height); x.drawImage(c, 0, 0);
    IMG.markDirty(s); IMG.Selection.update(doc);
  }

  /** Recupera a área "dest" (alfa) com a textura de "src" (layer deslocada de sx, sy). */
  function patchApply(doc, L, destMask, srcDx, srcDy, o) {
    const { surf } = surfaceOf(doc, L);
    const B = alphaBounds(destMask);
    if (!B) return false;
    const R = U.rectIntersect(U.rectInt(U.rectInflate(B, 6)), doc.rect);
    if (!R) return false;
    const D = readRegion(surf.canvas, R.x - surf.x, R.y - surf.y, R.w, R.h);
    const srcCanvas = o.sampleAll ? IMG.Engine.composite(doc) : null;
    const S = srcCanvas ? readRegion(srcCanvas, R.x + srcDx, R.y + srcDy, R.w, R.h) : readRegion(surf.canvas, R.x - surf.x + srcDx, R.y - surf.y + srcDy, R.w, R.h);
    let cov = alphaRegion(destMask, R.x, R.y, R.w, R.h);
    if (o.feather) {
      const tmp = new Uint8ClampedArray(R.w * R.h * 4);
      for (let j = 0; j < cov.length; j++) tmp[j * 4 + 3] = cov[j] * 255;
      IMG.Filters.K._gaussian(tmp, R.w, R.h, o.feather);
      for (let j = 0; j < cov.length; j++) cov[j] = Math.min(cov[j], tmp[j * 4 + 3] / 255 * 1.6);
    }
    let out = healRegion(D, S, cov, R.w, R.h, { adapt: o.adapt == null ? 1 : o.adapt });
    if (o.transparent) for (let i = 0; i < out.length; i++) out[i] = (out[i] + D[i]) / 2;
    if (L.lockAlpha) for (let i = 3; i < out.length; i += 4) out[i] = D[i];
    writeSurface(doc, L, surf, R, out, false);
    return true;
  }

  /* ---------- Remendo ---------- */
  IMG.Tools.register(lassoDragTool({
    id: 'patch', name: 'Remendo', icon: 'patch',
    hint: 'Desenhe ao redor da área e arraste a seleção até a área de origem (ou de destino)',
    defaults: { smode: 'new', patch: 'source', transparent: false, kind: 'normal', sampleAll: false },
    options: () => [
      { type: 'select', key: 'kind', label: 'Remendo', options: [['normal', 'Normal'], ['content', 'Sensível ao conteúdo']], width: 150 },
      { type: 'select', key: 'patch', label: '', options: [['source', 'Origem'], ['dest', 'Destino']], width: 90 },
      { type: 'check', key: 'transparent', label: 'Transparente' },
      { type: 'check', key: 'sampleAll', label: 'Usar todas as camadas' }
    ],
    apply(doc, dx, dy) {
      const o = T().o('patch'), L = IMG.Layers.paintTarget(doc);
      if (!L || L.type !== 'raster') return;
      let ok;
      if (o.patch === 'source') ok = patchApply(doc, L, doc.selection.canvas, dx, dy, { transparent: o.transparent, sampleAll: o.sampleAll, feather: o.kind === 'content' ? 3 : 0 });
      else { ok = patchApply(doc, L, shiftedSel(doc, dx, dy), -dx, -dy, { transparent: o.transparent, sampleAll: o.sampleAll, feather: o.kind === 'content' ? 3 : 0 }); if (ok) moveSelection(doc, dx, dy); }
      if (ok) { IMG.commit('Remendo'); IMG.lastPixelOp = { layerId: L.id, label: 'Remendo' }; }
    }
  }));

  /* ---------- Movimento sensível ao conteúdo ---------- */
  IMG.Tools.register(lassoDragTool({
    id: 'contentMove', name: 'Movimento sensível ao conteúdo', icon: 'contentMove',
    hint: 'Selecione um objeto e arraste-o: a área original é preenchida automaticamente',
    defaults: { smode: 'new', cmode: 'move', structure: 4, color: 5, sampleAll: false },
    options: () => [
      { type: 'select', key: 'cmode', label: 'Modo', options: [['move', 'Mover'], ['extend', 'Estender']], width: 90 },
      { type: 'slider', key: 'structure', label: 'Estrutura', min: 1, max: 7, step: 1 },
      { type: 'slider', key: 'color', label: 'Cor', min: 0, max: 10, step: 1 },
      { type: 'check', key: 'sampleAll', label: 'Usar todas as camadas' }
    ],
    async apply(doc, dx, dy) {
      const o = T().o('contentMove'), L = IMG.Layers.paintTarget(doc);
      if (!L || L.type !== 'raster') return;
      const { surf } = surfaceOf(doc, L);
      const sel = U.cloneCanvas(doc.selection.canvas);
      // conteúdo original (antes do preenchimento)
      const content = U.createCanvas(doc.width, doc.height), cx = content.getContext('2d');
      cx.drawImage(o.sampleAll ? IMG.Engine.composite(doc) : surf.canvas, o.sampleAll ? 0 : surf.x, o.sampleAll ? 0 : surf.y);
      if (o.cmode === 'move') {
        const ok = await Inpaint.fillLayer(doc, L, sel, { sampleAll: o.sampleAll, clipSel: false, label: 'Movimento sensível ao conteúdo' });
        if (!ok) return;
      }
      // cola o conteúdo deslocado com a borda recuperada
      const dest = shiftedSel(doc, dx, dy);
      const B = alphaBounds(dest);
      const R = B && U.rectIntersect(U.rectInt(U.rectInflate(B, 6)), doc.rect);
      if (R) {
        const D = readRegion(surf.canvas, R.x - surf.x, R.y - surf.y, R.w, R.h);
        const S = readRegion(content, R.x - dx, R.y - dy, R.w, R.h);
        const cov = alphaRegion(dest, R.x, R.y, R.w, R.h);
        const fe = 8 - o.structure;
        if (fe > 0) {
          const tmp = new Uint8ClampedArray(R.w * R.h * 4);
          for (let j = 0; j < cov.length; j++) tmp[j * 4 + 3] = cov[j] * 255;
          IMG.Filters.K._gaussian(tmp, R.w, R.h, fe * 0.8);
          for (let j = 0; j < cov.length; j++) cov[j] = Math.min(cov[j], (tmp[j * 4 + 3] / 255) * 1.8);
        }
        const out = healRegion(D, S, cov, R.w, R.h, { adapt: o.color / 10 });
        writeSurface(doc, L, surf, R, out, false);
      }
      moveSelection(doc, dx, dy);
      IMG.commit('Movimento sensível ao conteúdo');
    }
  }));

  /* ---------- Olhos vermelhos ---------- */
  IMG.Tools.register({
    id: 'redEye', name: 'Olhos vermelhos', icon: 'redEye', cursor: 'crosshair',
    defaults: { pupil: 50, darken: 50 },
    hint: 'Clique no olho vermelho (ou arraste um retângulo em volta dele)',
    options() {
      return [
        { type: 'slider', key: 'pupil', label: 'Tamanho da pupila', min: 1, max: 100, step: 1, unit: '%' },
        { type: 'slider', key: 'darken', label: 'Quantidade de escurecimento', min: 1, max: 100, step: 1, unit: '%' }
      ];
    },
    down(ev) { this.r = { x0: ev.x, y0: ev.y, x1: ev.x, y1: ev.y }; },
    move(ev) { if (this.r) { this.r.x1 = ev.x; this.r.y1 = ev.y; IMG.Engine.requestRender(); } },
    up() {
      const doc = IMG.app.doc, r = this.r; this.r = null; IMG.Engine.requestRender();
      if (!r) return;
      const L = IMG.Layers.paintTarget(doc);
      if (!L || L.type !== 'raster') { IMG.UI.toast('Selecione uma camada de pixels.'); return; }
      const o = T().o('redEye');
      let R;
      const dragged = Math.abs(r.x1 - r.x0) * doc.view.zoom > 4 && Math.abs(r.y1 - r.y0) * doc.view.zoom > 4;
      if (dragged) R = { x: Math.min(r.x0, r.x1), y: Math.min(r.y0, r.y1), w: Math.abs(r.x1 - r.x0), h: Math.abs(r.y1 - r.y0) };
      else { const s = U.clamp(Math.round(Math.min(doc.width, doc.height) * 0.06), 16, 220); R = { x: r.x0 - s, y: r.y0 - s, w: s * 2, h: s * 2 }; }
      R = U.rectIntersect(U.rectInt(R), doc.rect);
      if (!R) return;
      const { surf } = surfaceOf(doc, L);
      const d = readRegion(surf.canvas, R.x - surf.x, R.y - surf.y, R.w, R.h);
      const n = R.w * R.h, red = new Float32Array(n);
      for (let j = 0; j < n; j++) {
        const i = j * 4, rr = d[i], g = d[i + 1], b = d[i + 2];
        const m = Math.max(g, b);
        red[j] = rr > 60 && rr > m * 1.4 ? U.clamp((rr - m) / Math.max(1, rr) * 1.6, 0, 1) : 0;
      }
      let amt = red;
      if (!dragged) {
        // componente vermelho mais próximo do clique
        const cx = U.clamp(Math.round(r.x0 - R.x), 0, R.w - 1), cy = U.clamp(Math.round(r.y0 - R.y), 0, R.h - 1);
        amt = IMG.contiguousOnly(Float32Array.from(red), R.w, R.h, cx, cy);
        let any = false; for (let j = 0; j < n; j++) if (amt[j] > 0) { any = true; break; }
        if (!any) { IMG.UI.toast('Nenhum olho vermelho encontrado aqui.'); return; }
      }
      // tamanho da pupila: expande/contrai a área corrigida
      const grow = (o.pupil - 50) / 50;
      const tmp = new Uint8ClampedArray(n * 4);
      for (let j = 0; j < n; j++) tmp[j * 4 + 3] = amt[j] * 255;
      IMG.Filters.K._gaussian(tmp, R.w, R.h, 1 + Math.abs(grow) * 3);
      const dk = o.darken / 100;
      for (let j = 0; j < n; j++) {
        let t = tmp[j * 4 + 3] / 255;
        t = grow >= 0 ? Math.min(1, Math.max(amt[j], t * (1 + grow * 2))) : Math.min(amt[j], t * (1 + grow));
        if (t <= 0.01) continue;
        const i = j * 4, g = d[i + 1], b = d[i + 2], nr = (g + b) / 2, k = 1 - dk * 0.7;
        const tr = nr * k, tg = g * k, tb = b * k;
        d[i] += (tr - d[i]) * t; d[i + 1] += (tg - g) * t; d[i + 2] += (tb - b) * t;
      }
      writeSurface(doc, L, surf, R, d, false);
      IMG.commit('Olhos vermelhos');
    },
    drawOverlay(ctx, v) {
      const r = this.r; if (!r) return;
      const x = v.x + Math.min(r.x0, r.x1) * v.zoom, y = v.y + Math.min(r.y0, r.y1) * v.zoom, w = Math.abs(r.x1 - r.x0) * v.zoom, h = Math.abs(r.y1 - r.y0) * v.zoom;
      if (w < 3 && h < 3) return;
      IMG.dashedPath(ctx, () => ctx.rect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h)));
    }
  });

  void Heal;
})();
