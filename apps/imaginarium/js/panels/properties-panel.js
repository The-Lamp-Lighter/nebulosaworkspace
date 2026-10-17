/* ==========================================================================
   Imaginarium — painel Propriedades (contextual, como no Photopea)
   Camada de ajuste, preenchimento, máscara, forma, texto, pixels, documento.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const Layers = IMG.Layers;
  let root, selfEdit = false;

  const TYPE = { raster: 'Camada de pixels', text: 'Camada de texto', shape: 'Camada de forma', group: 'Grupo', adjust: 'Camada de ajuste', fill: 'Camada de preenchimento', smart: 'Objeto inteligente' };
  const KIND = { rect: 'Retângulo', ellipse: 'Elipse', line: 'Linha', polygon: 'Polígono', star: 'Estrela', path: 'Traçado', vpath: 'Traçado', svg: 'Forma personalizada' };

  const commitLater = U.debounce((label) => { selfEdit = true; IMG.commit(label); selfEdit = false; }, 350);

  function adjustSection(box, L, doc) {
    const UI = IMG.UI, A = IMG.Adjust;
    box.appendChild(el('div.props-head', IMG.iconEl('adjLayer', 16), el('span', { text: A.label(L.adj.kind) })));
    const env = { histogram: () => IMG.Widgets.histogramOf(IMG.Engine.composite(doc)), isLayer: true,
      sample: (x, y) => { const v = L.visible; L.visible = false; IMG.Engine.invalidate(); let c = null; try { c = IMG.Engine.sample(doc, x, y, 1); } finally { L.visible = v; IMG.Engine.invalidate(); } return c; } };
    const onChange = (final) => {
      IMG.Engine.invalidate();
      bus.emit('layers:props', doc);
      if (final !== false) commitLater('Editar ' + A.label(L.adj.kind));
    };
    const ui = el('div.props-adj');
    A.ui(L.adj, onChange, env).forEach((n) => n && ui.appendChild(n));
    box.appendChild(ui);
    const view = UI.iconBtn('eye', 'Visualizar o estado anterior (segure)', null);
    view.addEventListener('pointerdown', () => { L.visible = false; IMG.Engine.invalidate(); });
    const back = () => { if (!L.visible) { L.visible = true; IMG.Engine.invalidate(); } };
    view.addEventListener('pointerup', back); view.addEventListener('pointerleave', back);
    box.appendChild(el('div.panel-foot.props-foot',
      UI.iconBtn('clipArrow', 'Recortar na camada abaixo', () => { if (Layers.toggleClip(doc, L)) { bus.emit('layers:change', doc); IMG.commit(L.clip ? 'Criar máscara de recorte' : 'Liberar máscara de recorte'); } }, { active: L.clip }),
      view,
      UI.iconBtn('reset', 'Redefinir para os padrões', () => { const k = L.adj.kind; L.adj = A.create(k); IMG.Engine.invalidate(); IMG.commit('Redefinir ajuste'); render(true); }),
      UI.iconBtn(L.visible ? 'eye' : 'eyeOff', 'Mostrar/ocultar a camada', () => { L.visible = !L.visible; bus.emit('layers:change', doc); IMG.commit(L.visible ? 'Mostrar camada' : 'Ocultar camada'); render(true); }),
      el('span.pgroup-fill'),
      UI.iconBtn('trash', 'Excluir esta camada de ajuste', () => UI.run('layer.delete'))));
  }

  function maskSection(box, L, doc) {
    const UI = IMG.UI, m = L.mask;
    box.appendChild(el('div.props-head', IMG.iconEl('mask', 16), el('span', { text: 'Máscara de camada' })));
    const upd = (final) => { m._ver = (m._ver || 0) + 1; IMG.Effects.invalidate(L); IMG.Engine.invalidate(); bus.emit('layer:pixels', L); if (final) commitLater('Propriedades da máscara'); };
    box.appendChild(UI.slider({ label: 'Densidade', value: m.density == null ? 100 : m.density, min: 0, max: 100, unit: '%', stack: true, def: 100, onInput: (v) => { m.density = v; upd(false); }, onChange: (v) => { m.density = v; upd(true); } }).el);
    box.appendChild(UI.slider({ label: 'Difusão', value: m.feather || 0, min: 0, max: 250, step: 0.1, unit: 'px', stack: true, pow: 2, def: 0, onInput: (v) => { m.feather = v; upd(false); }, onChange: (v) => { m.feather = v; upd(true); } }).el);
    box.appendChild(el('h4.props-title', { text: 'Refinar' }));
    box.appendChild(el('div.props-actions',
      UI.btn('Borda da máscara…', () => UI.run('select.refineEdge'), { small: true }),
      UI.btn('Intervalo de cores…', () => UI.run('select.colorRange'), { small: true }),
      UI.btn('Inverter', () => UI.run('layer.maskInvert'), { small: true })));
    box.appendChild(el('div.panel-foot.props-foot',
      UI.iconBtn('selNew', 'Carregar seleção da máscara', () => { IMG.Selection.fromMask(doc, L, 'new'); IMG.commit('Carregar seleção'); }),
      UI.iconBtn('check', 'Aplicar máscara', () => UI.run('layer.maskApply')),
      UI.iconBtn(m.enabled !== false ? 'eye' : 'eyeOff', 'Ativar/desativar máscara', () => { UI.run('layer.maskToggle'); render(true); }),
      el('span.pgroup-fill'),
      UI.iconBtn('trash', 'Excluir máscara', () => UI.run('layer.maskDelete'))));
  }

  function fillSection(box, L, doc) {
    const UI = IMG.UI, d = L.fillDef;
    const upd = (final) => { Layers.renderFill(L, doc); IMG.Engine.invalidate(); bus.emit('layer:pixels', L); if (final !== false) commitLater('Editar preenchimento'); };
    box.appendChild(el('div.props-head', IMG.iconEl('adjLayer', 16), el('span', { text: { solid: 'Cor sólida', gradient: 'Gradiente', pattern: 'Padrão' }[d.type] })));
    if (d.type === 'solid') box.appendChild(UI.row('Cor', UI.colorBtn(d.color, (hex, fin) => { if (hex) { d.color = hex; upd(fin); } }).el));
    else if (d.type === 'gradient') {
      box.appendChild(UI.row('Gradiente', IMG.Widgets.gradientBtn(d.gradient, (g, fin) => { d.gradient = g; upd(fin); }, { width: 150 }).el));
      box.appendChild(UI.row('Estilo', UI.select([['linear', 'Linear'], ['radial', 'Radial'], ['angle', 'Angular'], ['reflected', 'Refletido'], ['diamond', 'Losango']], d.style, (v) => { d.style = v; upd(); }, { keepFocus: true }).el));
      box.appendChild(UI.row('Ângulo', IMG.Widgets.angle(d.angle, (v, fin) => { d.angle = v; upd(fin); }).el));
      box.appendChild(UI.slider({ label: 'Escala', value: d.scale, min: 10, max: 150, unit: '%', stack: true, def: 100, onInput: (v) => { d.scale = v; upd(false); }, onChange: () => upd(true) }).el);
      box.appendChild(el('div.props-actions', UI.check('Inverter', d.reverse, (v) => { d.reverse = v; upd(); }).el, UI.check('Pontilhado', d.dither !== false, (v) => { d.dither = v; upd(); }).el));
    } else {
      box.appendChild(UI.row('Padrão', IMG.Widgets.patternBtn(d.pattern, (v) => { d.pattern = v; upd(); }).el));
      box.appendChild(UI.slider({ label: 'Escala', value: d.scale, min: 1, max: 1000, unit: '%', stack: true, pow: 2, def: 100, onInput: (v) => { d.scale = v; upd(false); }, onChange: () => upd(true) }).el);
    }
  }

  function render(force) {
    if (!root || !root.isConnected) return;
    if (!force && root.contains(document.activeElement) && U.isTyping(document.activeElement)) return;
    const UI = IMG.UI, doc = IMG.app.doc;
    const scroll = root.scrollTop;
    U.clear(root);
    if (!doc) { root.appendChild(el('div.panel-empty', { text: 'Abra ou crie um documento para ver as propriedades.' })); return; }
    const box = el('div.props');
    const title = (t) => el('h4.props-title', { text: t });
    const L = doc.active;

    if (L && doc.editMask && L.mask) maskSection(box, L, doc);
    else if (L && L.type === 'adjust') adjustSection(box, L, doc);
    else if (L) {
      if (L.type === 'fill') fillSection(box, L, doc);
      box.appendChild(title(TYPE[L.type] + (doc.selected.size > 1 ? ' (+' + (doc.selected.size - 1) + ' selecionadas)' : '')));
      const name = el('input.inp', { type: 'text', value: L.name, maxlength: 120, 'aria-label': 'Nome da camada' });
      name.addEventListener('change', () => { const v = name.value.trim(); if (v && v !== L.name) { L.name = v; if (L.text) L.text.auto = false; bus.emit('layers:change', doc); IMG.commit('Renomear camada'); } });
      name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });
      box.appendChild(UI.row('Nome', name));
      const b = L.contentBounds();
      if (b && L.type !== 'fill') {
        const mv = (axis) => (v) => { if (Layers.isLocked(L) || L.lockPos) { UI.toast('A camada está bloqueada.'); return; } const cur = L.contentBounds(); if (!cur) return; const d = Math.round(v - cur[axis]); if (!d) return; L.translate(axis === 'x' ? d : 0, axis === 'y' ? d : 0); bus.emit('layers:props', doc); IMG.Engine.invalidate(); IMG.commit('Mover'); };
        box.appendChild(UI.row('Posição', UI.num({ value: b.x, min: -30000, max: 30000, unit: 'X', width: 84, onChange: mv('x') }).el, UI.num({ value: b.y, min: -30000, max: 30000, unit: 'Y', width: 84, onChange: mv('y') }).el));
        const sz = (axis) => (v) => {
          if (Layers.isLocked(L) || L.lockPos || L.type === 'group') return;
          const cur = L.contentBounds(); if (!cur || v < 1) return;
          const k = v / (axis === 'w' ? cur.w : cur.h);
          if (IMG.Transform && IMG.Transform.scaleLayer) IMG.Transform.scaleLayer(doc, L, axis === 'w' ? k : 1, axis === 'h' ? k : 1, cur);
        };
        box.appendChild(UI.row('Tamanho', UI.num({ value: b.w, min: 1, max: 30000, unit: 'L', width: 84, onChange: sz('w') }).el, UI.num({ value: b.h, min: 1, max: 30000, unit: 'A', width: 84, onChange: sz('h') }).el));
      } else if (L.type !== 'group' && L.type !== 'fill') box.appendChild(UI.row('Conteúdo', el('span.props-val', { text: 'camada vazia' })));

      if (L.type === 'shape' && L.shape && IMG.Shapes && IMG.Shapes.propsUI) IMG.Shapes.propsUI(box, L, doc);
      else if (L.type === 'shape') {
        const s = L.shape, S = IMG.Shapes;
        box.appendChild(title(KIND[s.kind] || 'Forma'));
        if (s.kind !== 'line') box.appendChild(UI.row('Preenchimento', UI.colorBtn(s.fill, (hex, fin) => S.set('fill', hex, fin), { nullable: true }).el));
        box.appendChild(UI.row('Contorno', UI.colorBtn(s.stroke, (hex, fin) => { if (hex && !s.strokeWidth) s.strokeWidth = 4; S.set('stroke', hex, fin); if (fin) setTimeout(() => render(true), 0); }, { nullable: s.kind !== 'line' }).el,
          UI.num({ value: s.strokeWidth || 0, min: 0, max: 500, step: 1, decimals: 1, unit: 'px', width: 78, onChange: (v) => S.set('strokeWidth', v) }).el));
        if (s.kind === 'rect') box.appendChild(UI.slider({ label: 'Raio dos cantos', value: Math.min(s.radius || 0, 500), min: 0, max: 500, step: 1, unit: 'px', stack: true, onInput: (v) => S.set('radius', v, false), onChange: (v) => S.set('radius', v) }).el);
        if (s.kind === 'polygon') box.appendChild(UI.slider({ label: 'Lados', value: s.sides || 5, min: 3, max: 40, step: 1, stack: true, onInput: (v) => S.set('sides', v, false), onChange: (v) => S.set('sides', v) }).el);
        if (s.kind === 'star') {
          box.appendChild(UI.slider({ label: 'Pontas', value: s.points || 5, min: 3, max: 40, step: 1, stack: true, onInput: (v) => S.set('points', v, false), onChange: (v) => S.set('points', v) }).el);
          box.appendChild(UI.slider({ label: 'Recuo', value: s.inner == null ? 45 : s.inner, min: 5, max: 95, step: 1, unit: '%', stack: true, onInput: (v) => S.set('inner', v, false), onChange: (v) => S.set('inner', v) }).el);
        }
      }
      if (L.type === 'text' && L.text) {
        const t = L.text;
        box.appendChild(title('Texto'));
        const st0 = IMG.Text.Model.styleAt(IMG.Text.normalize(t, L), 0);
        box.appendChild(UI.row('Fonte', el('span.props-val', { text: (st0.font || '') + ' · ' + U.round(st0.size || 0, 1) + ' px' })));
        box.appendChild(UI.row('Tipo', el('span.props-val', { text: t.onPath ? 'Texto no demarcador' : t.box ? 'Texto de parágrafo' : 'Texto de ponto' })));
        box.appendChild(el('div.props-actions', UI.btn('Editar texto', () => IMG.Text.editLayer(L), { small: true, icon: 'text' }), UI.btn('Caractere', () => UI.showPanel('character'), { small: true }), UI.btn('Parágrafo', () => UI.showPanel('paragraph'), { small: true })));
      }
      if (L.type === 'smart' && IMG.Smart && IMG.Smart.propsUI) IMG.Smart.propsUI(box, L, doc);
      if (L.mask) {
        box.appendChild(title('Máscara de camada'));
        box.appendChild(el('div.props-actions',
          UI.btn('Editar máscara', () => { doc.editMask = true; bus.emit('layers:select', doc); render(true); }, { small: true }),
          UI.check('Ativada', L.mask.enabled !== false, (v) => { L.mask.enabled = v; L.mask._ver = (L.mask._ver || 0) + 1; bus.emit('layers:change', doc); IMG.commit(v ? 'Ativar máscara' : 'Desativar máscara'); }).el));
      }
      if (L.fx) box.appendChild(el('div.props-actions', UI.btn('Estilo de camada…', () => IMG.LayerStyle.open('blending'), { small: true, icon: 'fx' })));
      if (L.type !== 'group' && L.type !== 'raster') box.appendChild(el('div.props-actions', UI.btn('Rasterizar camada', () => UI.run('layer.rasterize'), { small: true, icon: 'rasterize' })));
    } else box.appendChild(el('div.panel-empty', { text: 'Nenhuma camada selecionada.' }));

    box.appendChild(title('Documento'));
    box.appendChild(UI.row('Tela', el('span.props-val', { text: doc.width + ' × ' + doc.height + ' px · ' + (doc.dpi || 72) + ' ppp' })));
    box.appendChild(UI.row('Camadas', el('span.props-val', { text: String(Layers.all(doc).length) })));
    box.appendChild(el('div.props-actions', UI.btn('Tamanho da imagem', () => UI.run('image.resize'), { small: true }), UI.btn('Tamanho da tela', () => UI.run('image.canvas'), { small: true })));
    root.appendChild(box);
    root.scrollTop = scroll;
  }
  const later = U.debounce(() => render(), 60);
  let lastKey = '';
  const onLayerChange = () => {
    const doc = IMG.app.doc, L = doc && doc.active;
    const key = (doc ? doc.id : '') + '|' + (L ? L.id + L.type + (doc.editMask ? 'm' : '') + (L.mask ? 'k' : '') + (L.fx ? 'f' : '') : '');
    if (selfEdit && key === lastKey) return;
    lastKey = key;
    later();
  };

  IMG.UI.registerPanel({
    id: 'properties', title: 'Propriedades', icon: 'properties',
    build(node) {
      root = node;
      ['layers:change', 'layers:select', 'doc:change', 'doc:resize'].forEach((ev) => bus.on(ev, onLayerChange));
      bus.on('history:change', () => { if (!selfEdit) onLayerChange(); });
      bus.on('layers:props', () => { const d = IMG.app.doc; if (d && d.active && d.active.type !== 'adjust' && !d.editMask) later(); });
      render();
    },
    onShow() { render(true); }
  });
})();
