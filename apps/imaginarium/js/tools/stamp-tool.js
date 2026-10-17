/* ==========================================================================
   Imaginarium — Carimbo (S), Carimbo de padrão e Pincel de histórico (Y)
   Carimbo: Alt+clique define a origem (pode ser em outro documento);
   "Alinhado" mantém o deslocamento entre as pinceladas; "Amostra" escolhe
   entre a camada atual, a atual e abaixo, ou todas as camadas.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U;
  const T = () => IMG.Tools;

  const SAMPLE_OPTS = [['current', 'Camada atual'], ['below', 'Atual e abaixo'], ['all', 'Todas as camadas']];

  /** Pixels de amostra de um documento para as ferramentas de clonagem/recuperação. */
  IMG.sampleSource = function (doc, sample, L) {
    if (!L) L = doc.active;
    if (doc.editMask && L && L.mask && doc === IMG.app.doc) return { canvas: U.cloneCanvas(L.mask.canvas), x: L.mask.x, y: L.mask.y, isMask: true };
    if (sample === 'all' || !L) return { canvas: U.cloneCanvas(IMG.Engine.composite(doc)), x: 0, y: 0 };
    if (sample === 'below') return { canvas: IMG.Engine.compositeBelow(doc, L, true), x: 0, y: 0 };
    if (L.type === 'group' || !L.canvas) return { canvas: U.cloneCanvas(IMG.Engine.composite(doc)), x: 0, y: 0 };
    return { canvas: U.cloneCanvas(L.canvas), x: L.x, y: L.y };
  };

  /** Mira da origem (cruz) desenhada na sobreposição. */
  IMG.drawSourceMark = function (ctx, v, x, y) {
    const sx = Math.round(v.x + x * v.zoom) + 0.5, sy = Math.round(v.y + y * v.zoom) + 0.5;
    const draw = (col, lw) => {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(sx - 9, sy); ctx.lineTo(sx - 3, sy); ctx.moveTo(sx + 3, sy); ctx.lineTo(sx + 9, sy);
      ctx.moveTo(sx, sy - 9); ctx.lineTo(sx, sy - 3); ctx.moveTo(sx, sy + 3); ctx.lineTo(sx, sy + 9);
      ctx.stroke();
    };
    draw('rgba(0,0,0,.8)', 3);
    draw('#ffffff', 1);
  };

  /** Comportamento comum de "origem com Alt+clique" (Carimbo, Pincel de recuperação). */
  IMG.cloneSourceBehavior = function (toolId) {
    return {
      begin(ev, tool) {
        const doc = IMG.app.doc;
        if (ev.alt) {
          tool.source = { doc: doc.id, x: ev.x, y: ev.y };
          tool.off = null;
          IMG.Engine.requestRender();
          return false;
        }
        const s = tool.source;
        if (!s || !IMG.app.docs.some((d) => d.id === s.doc)) {
          IMG.UI.toast('Segure Alt e clique para definir a origem.');
          return false;
        }
        return {};
      },
      sourceFor(ev, tool, L) {
        const doc = IMG.app.doc, o = T().o(toolId);
        const sdoc = IMG.app.docs.find((d) => d.id === tool.source.doc) || doc;
        if (!o.aligned || !tool.off || tool.offDoc !== sdoc.id) { tool.off = { dx: ev.x - tool.source.x, dy: ev.y - tool.source.y }; tool.offDoc = sdoc.id; }
        const src = sdoc === doc ? IMG.sampleSource(doc, o.sample, L) : IMG.sampleSource(sdoc, o.sample === 'current' ? 'current' : 'all', sdoc.active);
        if (src.isMask && !(doc.editMask && L.mask)) src.isMask = false;
        return { src, off: { dx: tool.off.dx, dy: tool.off.dy } };
      },
      overlay(ctx, v, tool) {
        const doc = IMG.app.doc, s = tool.source;
        if (!s || s.doc !== doc.id) return;
        let x = s.x, y = s.y;
        if (tool.off && tool.pos && (tool.stroke || T().o(toolId).aligned)) {
          const p = IMG.Engine.s2d(tool.pos.sx, tool.pos.sy);
          x = p.x - tool.off.dx; y = p.y - tool.off.dy;
        }
        IMG.drawSourceMark(ctx, v, x, y);
      }
    };
  };

  /* ---------- Carimbo ---------- */
  const CS = IMG.cloneSourceBehavior('stamp');
  IMG.Tools.register(IMG.makeBrushTool({
    id: 'stamp', name: 'Carimbo', icon: 'stamp', mode: 'clone', altHandled: true,
    hint: 'Alt+clique: definir a origem da clonagem (também em outro documento)',
    defaults: { size: 40, hardness: 60, opacity: 100, flow: 100, spacing: 10, smoothing: 0, aligned: true, sample: 'current' },
    extraOptions: () => [
      { type: 'check', key: 'aligned', label: 'Alinhado', title: 'Mantém a distância entre origem e destino a cada pincelada' },
      { type: 'select', key: 'sample', label: 'Amostra', options: SAMPLE_OPTS, width: 130 }
    ],
    begin: CS.begin,
    prepare: (ev, tool, L) => CS.sourceFor(ev, tool, L),
    overlay: CS.overlay
  }));

  /* ---------- Carimbo de padrão ---------- */
  IMG.Tools.register(IMG.makeBrushTool({
    id: 'patternStamp', name: 'Carimbo de padrão', icon: 'patternStamp', mode: 'clone',
    hint: 'Pinta com o padrão escolhido',
    defaults: { size: 60, hardness: 80, opacity: 100, flow: 100, spacing: 12, smoothing: 0, pattern: 'p0', aligned: true, impressionist: false },
    extraOptions: (o) => [
      { type: 'custom', build: () => IMG.Widgets.patternBtn(o.pattern, (v) => T().setOpt('patternStamp', 'pattern', v, true)).el },
      { type: 'check', key: 'aligned', label: 'Alinhado', title: 'O padrão é contínuo entre as pinceladas' },
      { type: 'check', key: 'impressionist', label: 'Impressionista', title: 'Pinceladas com aparência de pintura' }
    ],
    prepare(ev) {
      const doc = IMG.app.doc, o = T().o('patternStamp');
      const c = U.createCanvas(doc.width, doc.height), x = c.getContext('2d');
      const ox = o.aligned ? 0 : Math.round(ev.x), oy = o.aligned ? 0 : Math.round(ev.y);
      IMG.Patterns.fill(x, o.pattern, doc.width, doc.height, 100, ox, oy);
      if (o.impressionist) {
        const img = x.getImageData(0, 0, doc.width, doc.height);
        IMG.Filters.K._gaussian(img.data, doc.width, doc.height, Math.max(2, o.size / 8));
        x.putImageData(img, 0, 0);
      }
      return { src: { canvas: c, x: 0, y: 0 }, off: { dx: 0, dy: 0 } };
    }
  }));

  /* ---------- Pincel de histórico ---------- */
  IMG.Tools.register(IMG.makeBrushTool({
    id: 'historyBrush', name: 'Pincel de histórico', icon: 'historyBrush', mode: 'restore', showMode: false,
    hint: 'Pinta com os pixels do estado escolhido no painel Histórico (coluna da esquerda)',
    defaults: { size: 40, hardness: 70, opacity: 100, flow: 100, spacing: 10, smoothing: 0 },
    prepare(ev, tool, L) {
      const doc = IMG.app.doc;
      const src = IMG.historySource(doc, L, !!(doc.editMask && L.mask));
      if (!src) return false;
      return { mode: 'restore', src };
    }
  }));
})();
