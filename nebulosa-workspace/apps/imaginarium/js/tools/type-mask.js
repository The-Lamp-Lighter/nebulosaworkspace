/* ==========================================================================
   Imaginarium — ferramentas Máscara de texto horizontal / vertical (T)
   Digita como a ferramenta Texto; ao concluir, o texto vira seleção.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, bus = IMG.bus, U = IMG.U;
  const T = IMG.Tools, Text = IMG.Text, Layers = IMG.Layers;
  const make = (base, id, name, icon) => {
    const b = T.defs[base];
    const def = Object.assign({}, b, {
      id, name, icon,
      hint: 'Clique ou arraste para digitar; ao concluir (Ctrl+Enter ou Esc), o texto se torna uma seleção.',
      down(ev) {
        const r = b.down.call(this, ev);
        if (Text.edit && Text.edit.isNew) Text.edit.maskTool = true;
        return r;
      },
      drawOverlay(ctx, v) {
        // cobertura vermelha de máscara rápida enquanto digita
        const e = Text.edit, doc = IMG.app.doc;
        if (e && e.maskTool && doc) { ctx.save(); ctx.fillStyle = 'rgba(255,0,0,.35)'; ctx.fillRect(v.x, v.y, doc.width * v.zoom, doc.height * v.zoom); ctx.restore(); }
        if (b.drawOverlay) b.drawOverlay.call(this, ctx, v);
      }
    });
    def.options = function () { return b.options.call(this); };
    return def;
  };
  T.register(make('textV', 'textMaskV', 'Máscara de texto vertical', 'textMaskV'));
  T.register(make('text', 'textMaskH', 'Máscara de texto horizontal', 'textMaskH'));
  // ao concluir: converte em seleção e remove a camada temporária
  const E = Text.Editor, orig = E.commit.bind(E), start = E.start.bind(E);
  E.start = function (L, isNew, at) { const r = start(L, isNew, at); if (Text.edit && isNew && /^textMask/.test(T.activeId || '')) Text.edit.maskTool = true; return r; };
  E.commit = function () {
    const e = Text.edit, mask = e && e.maskTool, L = e && e.L, doc = IMG.app.doc;
    if (!mask) return orig();
    IMG._batch = (IMG._batch || 0) + 1;
    try { orig(); } finally { IMG._batch--; }
    if (!doc || !Layers.find(doc, L.id)) return;
    const c = U.createCanvas(doc.width, doc.height), x = c.getContext('2d');
    if (L.canvas) x.drawImage(L.canvas, L.x, L.y);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, doc.width, doc.height);
    Layers.remove(doc, L);
    const rest = Layers.all(doc); doc.activeId = null; doc.selected.clear(); if (rest.length) Layers.setActive(doc, rest[rest.length - 1].id);
    IMG.Selection.combine(doc, c, 'new');
    bus.emit('layers:change', doc); IMG.Engine.invalidate();
    IMG.commit('Máscara de texto');
  };
})();
