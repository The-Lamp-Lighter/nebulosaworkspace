/* ==========================================================================
   Imaginarium — filtros (menu Filtro)
   Cada filtro: { label, group, kernel | fn, params: [esquema], direct }
   O diálogo é montado a partir do esquema; o processamento roda no Worker.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, el = U.el;

  /** Parâmetro numérico: P(chave, rótulo, mín, máx, padrão, passo, unidade, {pow}) */
  const P = (key, label, min, max, def, step, unit, o) => Object.assign({ key, label, min, max, def, step: step || 1, unit: unit || '' }, o || {});
  const C = (key, label, def) => ({ key, label, type: 'check', def: !!def });
  const S = (key, label, options, def) => ({ key, label, type: 'select', options, def });
  const COL = (key, label, def) => ({ key, label, type: 'color', def });
  IMG.FXP = { P, C, S, COL };

  const DEFS = {};
  const GROUPS = {};
  /** Registra um filtro. */
  function def(id, d) {
    d.id = id;
    DEFS[id] = d;
    if (d.group) (GROUPS[d.group] || (GROUPS[d.group] = [])).push(id);
    return d;
  }

  /* filtros básicos (ampliados em filters-extra.js) */
  def('gaussianBlur', { label: 'Desfoque gaussiano', group: 'blur', kernel: 'gaussianBlur', params: [P('radius', 'Raio', 0.1, 250, 4, 0.1, ' px', { pow: 2.2 })] });
  def('motionBlur', { label: 'Desfoque de movimento', group: 'blur', kernel: 'motionBlur', params: [P('angle', 'Ângulo', -90, 90, 0, 1, '°'), P('distance', 'Distância', 1, 999, 20, 1, ' px', { pow: 2 })] });
  def('sharpen', { label: 'Tornar nítido', group: 'sharpen', kernel: 'sharpen', direct: true, defaults: { amount: 60, radius: 0.6 } });
  def('unsharpMask', { label: 'Máscara de nitidez', group: 'sharpen', kernel: 'sharpen', params: [P('amount', 'Quantidade', 1, 500, 100, 1, '%'), P('radius', 'Raio', 0.1, 250, 1, 0.1, ' px', { pow: 2 }), P('threshold', 'Limiar', 0, 255, 0, 1, ' níveis')] });
  def('addNoise', { label: 'Adicionar ruído', group: 'noise', kernel: 'noise', params: [P('amount', 'Quantidade', 0.1, 400, 12, 0.1, '%'), S('dist', 'Distribuição', [['uniform', 'Uniforme'], ['gaussian', 'Gaussiana']], 'uniform'), C('mono', 'Monocromático', false)] });
  def('emboss', { label: 'Relevo', group: 'stylize', kernel: 'emboss', params: [P('angle', 'Ângulo', -180, 180, 135, 1, '°'), P('height', 'Altura', 1, 100, 3, 1, ' px'), P('amount', 'Quantidade', 1, 500, 100, 1, '%')] });
  def('mosaic', { label: 'Mosaico', group: 'pixelate', kernel: 'pixelate', params: [P('size', 'Tamanho da célula', 2, 200, 10, 1, ' px', { pow: 2 })] });
  def('findEdges', { label: 'Localizar bordas', group: 'stylize', kernel: 'edges', direct: true, defaults: { amount: 100, invert: true } });

  /* nomes dos submenus */
  const GROUP_NAMES = { blur: 'Desfoque', blurGallery: 'Galeria de desfoque', distort: 'Distorção', noise: 'Ruído', pixelate: 'Pixelização', render: 'Acabamento', sharpen: 'Nitidez', stylize: 'Estilização', other: 'Outros', artistic: 'Artístico' };

  const FX = (IMG.FX = {
    defs: DEFS, groups: GROUPS, GROUP_NAMES, register: def,
    last: null,
    memory: U.store.get('fxMemory', {}),
    saveMemory: U.debounce(() => U.store.set('fxMemory', FX.memory), 500),

    label(id) { return DEFS[id] ? DEFS[id].label : id; },

    values(id) {
      const d = DEFS[id], mem = this.memory[id] || {}, vals = {};
      (d.params || []).forEach((p) => { vals[p.key] = mem[p.key] !== undefined ? mem[p.key] : p.def; });
      if (d.defaults) Object.assign(vals, d.defaults);
      return vals;
    },

    /** Interface do esquema de parâmetros. */
    buildParams(d, vals, onChange) {
      const UI = IMG.UI, ctls = {};
      const nodes = (d.params || []).map((p) => {
        if (p.visible && !p.visible(vals)) return null;
        if (p.type === 'check') { const c = UI.check(p.label, vals[p.key], (v) => { vals[p.key] = v; onChange(p.key); }); ctls[p.key] = c; return el('div.form-row.solo', c.el); }
        if (p.type === 'select') { const s = UI.select(p.options, vals[p.key], (v) => { vals[p.key] = p.numeric ? +v : v; onChange(p.key); }, { keepFocus: true }); ctls[p.key] = s; return UI.row(p.label, s.el); }
        if (p.type === 'color') { const c = UI.colorBtn(vals[p.key], (hex, fin) => { if (hex) { vals[p.key] = hex; onChange(p.key, fin); } }); ctls[p.key] = c; return UI.row(p.label, c.el); }
        if (p.type === 'angle') { const a = IMG.Widgets.angle(vals[p.key], (v) => { vals[p.key] = v; onChange(p.key); }); ctls[p.key] = a; return UI.row(p.label, a.el); }
        if (p.type === 'note') return el('p.dialog-note', { text: p.label });
        if (p.type === 'button') return el('div.form-row.solo', UI.btn(p.label, () => { p.action(vals); onChange(p.key); }, { small: true }));
        const s = UI.slider({ label: p.label, value: vals[p.key], min: p.min, max: p.max, step: p.step, unit: p.unit, def: p.def, stack: true, pow: p.pow || 1, decimals: p.decimals,
          onInput: (v) => { vals[p.key] = v; onChange(p.key); } });
        ctls[p.key] = s;
        return s.el;
      }).filter(Boolean);
      return { nodes, ctls };
    },

    open(id, o = {}) {
      const d = DEFS[id];
      if (!d) return;
      if (d.custom) return d.custom(o);
      if (d.direct) return this.applyDirect(id, this.values(id));
      const doc = IMG.app.doc; if (!doc) return;
      const L = doc.active;
      if (L && L.type === 'smart' && IMG.Smart && !doc.editMask) return IMG.Smart.addFilterDialog(L, id);
      const vals = this.values(id);
      const box = el('div');
      let fx = null;
      const params = () => (d.prep ? d.prep(Object.assign({}, vals), fx && fx.S) : Object.assign({}, vals));
      const render = () => {
        U.clear(box);
        const { nodes } = this.buildParams(d, vals, (key) => {
          this.memory[id] = Object.assign({}, vals); this.saveMemory();
          if (d.params.some((p) => p.visible)) render();
          if (fx) fx.update();
        });
        nodes.forEach((n) => box.appendChild(n));
      };
      render();
      fx = IMG.FXSession.dialog({
        title: d.label, kernel: d.kernel, fn: d.fn, body: [box], width: d.width || 340, params, delay: d.slow ? 120 : 24,
        sessionOpts: { fullDoc: d.fullDoc },
        reset: () => { (d.params || []).forEach((p) => { vals[p.key] = p.def; }); this.memory[id] = Object.assign({}, vals); render(); },
        onDone: (ok) => { if (ok) this.last = { id, values: Object.assign({}, vals) }; }
      });
    },

    /** Aplica sem diálogo. */
    applyDirect(id, values) {
      const d = DEFS[id]; if (!d) return;
      const doc = IMG.app.doc, L = doc && doc.active;
      if (L && L.type === 'smart' && IMG.Smart && !doc.editMask) { IMG.Smart.addFilter(L, id, values || {}); return; }
      const S2 = IMG.FXSession.begin({ fullDoc: d.fullDoc }); if (!S2 || S2.smart) return;
      const p = d.prep ? d.prep(Object.assign({}, values || {}), S2) : values || {};
      if (d.fn) S2.runFn((data, w, h) => d.fn(data, w, h, p));
      else S2.run(d.kernel, p);
      S2.commit(d.label);
      this.last = { id, values: Object.assign({}, values || {}) };
    },

    repeat() {
      const l = this.last;
      if (!l) { IMG.UI.toast('Nenhum filtro foi aplicado ainda.'); return; }
      if (l.adjust) { IMG.Adjust.open(l.adjust); return; }
      const d = DEFS[l.id];
      if (d && d.custom) return this.open(l.id);
      this.applyDirect(l.id, l.values || {});
    }
  });
  void FX;
})();
