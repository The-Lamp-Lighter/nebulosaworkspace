/* ==========================================================================
   Imaginarium — diálogo Estilo de camada
   Opções de mesclagem (gerais, avançadas, Mesclar se) e os dez efeitos,
   com pré-visualização ao vivo. Comandos do menu Camada › Estilo de camada.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const Layers = IMG.Layers;

  let clipboardStyle = null;

  const BLEND_SEL = (val, on) => IMG.UI.select(IMG.BLEND_LIST, val, on, { keepFocus: true, width: 170 });

  /* ---------- barra de "Mesclar se" com 4 alças (Alt separa as metades) ---------- */
  function blendIfBar(vals, onChange, label) {
    const Wd = 256, H = 26;
    const cv = U.domCanvas(Wd + 12, H); cv.className = 'blendif-bar';
    const draw = () => {
      const c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, H);
      const g = c.createLinearGradient(6, 0, Wd + 6, 0); g.addColorStop(0, '#000'); g.addColorStop(1, '#fff');
      c.fillStyle = g; c.fillRect(6, 2, Wd, 10);
      const tri = (v, fill, half) => {
        const x = 6 + v;
        c.beginPath();
        if (half === 'l') { c.moveTo(x, 13); c.lineTo(x, H - 1); c.lineTo(x - 6, H - 1); }
        else if (half === 'r') { c.moveTo(x, 13); c.lineTo(x + 6, H - 1); c.lineTo(x, H - 1); }
        else { c.moveTo(x, 13); c.lineTo(x + 6, H - 1); c.lineTo(x - 6, H - 1); }
        c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = '#888'; c.stroke();
      };
      const [a0, a1, b0, b1] = vals;
      if (a0 === a1) tri(a0, '#000'); else { tri(a0, '#000', 'l'); tri(a1, '#000', 'r'); }
      if (b0 === b1) tri(b0, '#fff'); else { tri(b0, '#fff', 'l'); tri(b1, '#fff', 'r'); }
      info.textContent = label + ':  ' + (a0 === a1 ? a0 : a0 + '/' + a1) + '   ' + (b0 === b1 ? b0 : b0 + '/' + b1);
    };
    const info = el('div.w-label');
    cv.addEventListener('pointerdown', (e) => {
      const r = cv.getBoundingClientRect();
      const pos = (ev) => U.clamp(Math.round(((ev.clientX - r.left) / r.width) * cv.width - 6), 0, 255);
      const v0 = pos(e);
      let idx = [0, 1, 2, 3].sort((i, j) => Math.abs(vals[i] - v0) - Math.abs(vals[j] - v0))[0];
      const pair = idx < 2 ? [0, 1] : [2, 3];
      const split = e.altKey;
      U.drag(e, (ev) => {
        let v = pos(ev);
        if (split || vals[pair[0]] !== vals[pair[1]]) {
          if (idx === pair[0]) v = Math.min(v, vals[pair[1]]); else v = Math.max(v, vals[pair[0]]);
          vals[idx] = v;
        } else { vals[pair[0]] = vals[pair[1]] = v; }
        if (vals[1] > vals[2]) { if (idx < 2) { vals[1] = Math.min(vals[1], vals[2]); vals[0] = Math.min(vals[0], vals[1]); } else { vals[2] = Math.max(vals[2], vals[1]); vals[3] = Math.max(vals[3], vals[2]); } }
        draw(); onChange(false);
      }, () => onChange(true));
    });
    draw();
    return el('div.blendif', info, cv);
  }

  /** Abre o diálogo de estilo para a camada ativa, na seção indicada. */
  function open(section) {
    const doc = IMG.app.doc, UI = IMG.UI;
    const L = doc && doc.active;
    if (!L) return;
    if (L.isBg) { UI.toast('A camada Fundo não aceita estilos. Converta-a em camada normal (clique duplo).'); return; }
    if (L.type === 'adjust') { UI.toast('Camadas de ajuste não aceitam estilos de camada.'); return; }
    const orig = { fx: IMG.jclone(L.fx), adv: IMG.jclone(L.adv), blend: L.blend, opacity: L.opacity, fill: L.fill, angle: doc.globalAngle, alt: doc.globalAltitude };
    const fx = L.fx = L.fx || {};
    const adv = L.adv = L.adv || {};
    let cur = section || 'blending';
    if (cur !== 'blending') { if (!fx[cur]) fx[cur] = IMG.Effects.defaults(cur); fx[cur].enabled = true; }
    const upd = U.debounce(() => { IMG.Effects.invalidate(L); IMG.Engine.invalidate(); bus.emit('layers:props', doc); }, 16);
    const live = () => upd();

    const nav = el('div.ls-nav'), pane = el('div.ls-pane');
    const ensure = (k) => { if (!fx[k]) fx[k] = IMG.Effects.defaults(k); return fx[k]; };

    const renderNav = () => {
      U.clear(nav);
      const item = (key, label, checkable) => {
        const e = checkable ? fx[key] : null;
        const row = el('div.ls-item' + (cur === key ? '.active' : ''));
        if (checkable) {
          const c = UI.check('', !!(e && e.enabled), (v) => { ensure(key).enabled = v; cur = key; renderNav(); renderPane(); live(); });
          row.appendChild(c.el);
        }
        row.appendChild(el('span', { text: label }));
        row.addEventListener('click', (ev) => { if (ev.target.closest('.chk')) return; cur = key; if (checkable && !(fx[key] && fx[key].enabled)) ensure(key).enabled = true; renderNav(); renderPane(); live(); });
        nav.appendChild(row);
      };
      item('blending', 'Opções de mesclagem', false);
      IMG.Effects.LIST.forEach((k) => item(k, IMG.Effects.NAMES[k], true));
    };

    /* ---------- campos ---------- */
    const S = (e, key, label, min, max, unit, o = {}) => UI.slider({ label, value: e[key], min, max, step: o.step || 1, unit: unit || '', def: o.def, numWidth: 64, pow: o.pow,
      onInput: (v) => { e[key] = v; live(); } }).el;
    const modeRow = (e, key, colorKey) => UI.row('Modo de mesclagem', BLEND_SEL(e[key], (v) => { e[key] = v; live(); }).el,
      colorKey ? UI.colorBtn(e[colorKey], (hex) => { if (hex) { e[colorKey] = hex; live(); } }).el : null);
    const angleRow = (e, withAlt) => {
      const useG = () => e.useGlobal !== false;
      const val = () => (useG() ? doc.globalAngle : e.angle);
      const dial = IMG.Widgets.angle(val(), (v) => { if (useG()) doc.globalAngle = v; else e.angle = v; live(); }, { alt: withAlt ? (useG() ? doc.globalAltitude : e.altitude) : null });
      const nodes = [UI.row('Ângulo', dial.el, UI.check('Usar luz global', useG(), (v) => { e.useGlobal = v; if (!v) { e.angle = doc.globalAngle; e.altitude = doc.globalAltitude; } renderPane(); live(); }).el)];
      if (withAlt) nodes.push(UI.row('Altitude', UI.num({ value: useG() ? doc.globalAltitude : e.altitude, min: 0, max: 90, unit: '°', width: 64, onChange: (v) => { if (useG()) doc.globalAltitude = v; else e.altitude = v; renderPane(); live(); } }).el));
      return nodes;
    };
    const title = (t) => el('h3.form-title', { text: t });
    const fillSrc = (e, kindKey, styleKey) => {
      const nodes = [];
      if (e[kindKey] === 'gradient') {
        if (!e.gradient) e.gradient = IMG.Gradients.def();
        nodes.push(UI.row('Gradiente', IMG.Widgets.gradientBtn(e.gradient, (g) => { e.gradient = g; live(); }, { width: 160 }).el, UI.check('Inverter', !!e.reverse, (v) => { e.reverse = v; live(); }).el));
        if (styleKey) {
          nodes.push(UI.row('Estilo', UI.select([['linear', 'Linear'], ['radial', 'Radial'], ['angle', 'Angular'], ['reflected', 'Refletido'], ['diamond', 'Losango']], e[styleKey] || 'linear', (v) => { e[styleKey] = v; live(); }, { keepFocus: true }).el));
          nodes.push(UI.row('Ângulo', IMG.Widgets.angle(e.angle == null ? 90 : e.angle, (v) => { e.angle = v; live(); }).el));
          nodes.push(S(e, 'scale', 'Escala', 10, 150, '%', { def: 100 }));
        }
      } else if (e[kindKey] === 'pattern') {
        nodes.push(UI.row('Padrão', IMG.Widgets.patternBtn(e.pattern, (v) => { e.pattern = v; live(); }).el));
        nodes.push(S(e, 'patScale', 'Escala', 1, 1000, '%', { def: 100, pow: 2 }));
      } else nodes.push(UI.row('Cor', UI.colorBtn(e.color, (hex) => { if (hex) { e.color = hex; live(); } }).el));
      return nodes;
    };

    const renderPane = () => {
      U.clear(pane);
      const add = (...n) => n.flat().forEach((x) => x && pane.appendChild(x));
      if (cur === 'blending') {
        add(title('Mesclagem geral'),
          UI.row('Modo de mesclagem', UI.select(L.type === 'group' ? IMG.BLEND_LIST_GROUP : IMG.BLEND_LIST, L.blend, (v) => { L.blend = v; live(); }, { keepFocus: true, width: 190 }).el),
          UI.slider({ label: 'Opacidade', value: Math.round(L.opacity * 100), min: 0, max: 100, unit: '%', def: 100, numWidth: 64, onInput: (v) => { L.opacity = v / 100; live(); } }).el,
          title('Mesclagem avançada'),
          UI.slider({ label: 'Opacidade do preenchimento', value: Math.round(L.fill * 100), min: 0, max: 100, unit: '%', def: 100, numWidth: 64, onInput: (v) => { L.fill = v / 100; live(); } }).el);
        const ch = adv.channels || { r: true, g: true, b: true };
        add(UI.row('Canais', UI.check('R', ch.r !== false, (v) => { adv.channels = Object.assign({}, ch, { r: v }); Object.assign(ch, adv.channels); live(); }).el,
          UI.check('G', ch.g !== false, (v) => { adv.channels = Object.assign({}, ch, { g: v }); Object.assign(ch, adv.channels); live(); }).el,
          UI.check('B', ch.b !== false, (v) => { adv.channels = Object.assign({}, ch, { b: v }); Object.assign(ch, adv.channels); live(); }).el));
        const bi = adv.blendIf || { self: [0, 0, 255, 255], under: [0, 0, 255, 255] };
        const syncBI = () => {
          const id = (a) => a[0] === 0 && a[1] === 0 && a[2] === 255 && a[3] === 255;
          adv.blendIf = id(bi.self) && id(bi.under) ? null : { self: id(bi.self) ? null : bi.self.slice(), under: id(bi.under) ? null : bi.under.slice() };
          live();
        };
        const selfV = (adv.blendIf && adv.blendIf.self) || [0, 0, 255, 255], underV = (adv.blendIf && adv.blendIf.under) || [0, 0, 255, 255];
        bi.self = selfV.slice(); bi.under = underV.slice();
        add(title('Mesclar se: Cinza'), blendIfBar(bi.self, syncBI, 'Esta camada'), blendIfBar(bi.under, syncBI, 'Camada subjacente'),
          el('p.dialog-note', { text: 'Segure Alt e arraste uma alça para dividi-la e suavizar a transição.' }));
        return;
      }
      const e = ensure(cur);
      add(title(IMG.Effects.NAMES[cur]));
      switch (cur) {
        case 'dropShadow':
          add(modeRow(e, 'blend', 'color'), S(e, 'opacity', 'Opacidade', 0, 100, '%'), angleRow(e), S(e, 'distance', 'Distância', 0, 3000, 'px', { pow: 2.5 }), S(e, 'spread', 'Espalhar', 0, 100, '%'), S(e, 'size', 'Tamanho', 0, 250, 'px', { pow: 2 }),
            UI.row('', UI.check('Camada vaza sombra projetada', e.knockout !== false, (v) => { e.knockout = v; live(); }).el));
          break;
        case 'innerShadow':
          add(modeRow(e, 'blend', 'color'), S(e, 'opacity', 'Opacidade', 0, 100, '%'), angleRow(e), S(e, 'distance', 'Distância', 0, 3000, 'px', { pow: 2.5 }), S(e, 'choke', 'Obstruir', 0, 100, '%'), S(e, 'size', 'Tamanho', 0, 250, 'px', { pow: 2 }));
          break;
        case 'outerGlow':
        case 'innerGlow':
          add(modeRow(e, 'blend'), S(e, 'opacity', 'Opacidade', 0, 100, '%'),
            UI.row('Preenchimento', UI.seg([{ value: 'color', label: 'Cor' }, { value: 'gradient', label: 'Gradiente' }], e.fillType || 'color', (v) => { e.fillType = v; renderPane(); live(); }, { labels: true }).el),
            fillSrc(e, 'fillType', null), title('Elementos'),
            UI.row('Técnica', UI.select([['softer', 'Mais suave'], ['precise', 'Precisa']], e.technique, (v) => { e.technique = v; live(); }, { keepFocus: true }).el));
          if (cur === 'innerGlow') add(UI.row('Origem', UI.seg([{ value: 'center', label: 'Centro' }, { value: 'edge', label: 'Borda' }], e.source || 'edge', (v) => { e.source = v; live(); }, { labels: true }).el), S(e, 'choke', 'Obstruir', 0, 100, '%'));
          else add(S(e, 'spread', 'Espalhar', 0, 100, '%'));
          add(S(e, 'size', 'Tamanho', 0, 250, 'px', { pow: 2 }), title('Qualidade'), S(e, 'range', 'Intervalo', 1, 100, '%', { def: 50 }));
          break;
        case 'bevel':
          add(UI.row('Estilo', UI.select([['inner', 'Chanfro interno'], ['outer', 'Chanfro externo'], ['emboss', 'Entalhe'], ['pillow', 'Entalhe em almofada']], e.style, (v) => { e.style = v; live(); }, { keepFocus: true }).el),
            UI.row('Técnica', UI.select([['smooth', 'Suave'], ['chiselHard', 'Cinzel duro'], ['chiselSoft', 'Cinzel suave']], e.technique, (v) => { e.technique = v; live(); }, { keepFocus: true }).el),
            S(e, 'depth', 'Profundidade', 1, 1000, '%', { def: 100, pow: 2 }),
            UI.row('Direção', UI.seg([{ value: 'up', label: 'Para cima' }, { value: 'down', label: 'Para baixo' }], e.direction, (v) => { e.direction = v; live(); }, { labels: true }).el),
            S(e, 'size', 'Tamanho', 0, 250, 'px', { pow: 2 }), S(e, 'soften', 'Suavizar', 0, 16, 'px'),
            title('Sombreamento'), angleRow(e, true),
            UI.row('Modo de realce', BLEND_SEL(e.hlBlend, (v) => { e.hlBlend = v; live(); }).el, UI.colorBtn(e.hlColor, (hex) => { if (hex) { e.hlColor = hex; live(); } }).el),
            S(e, 'hlOpacity', 'Opacidade', 0, 100, '%', { def: 75 }),
            UI.row('Modo de sombra', BLEND_SEL(e.shBlend, (v) => { e.shBlend = v; live(); }).el, UI.colorBtn(e.shColor, (hex) => { if (hex) { e.shColor = hex; live(); } }).el),
            S(e, 'shOpacity', 'Opacidade', 0, 100, '%', { def: 75 }));
          break;
        case 'satin':
          add(modeRow(e, 'blend', 'color'), S(e, 'opacity', 'Opacidade', 0, 100, '%'), UI.row('Ângulo', IMG.Widgets.angle(e.angle, (v) => { e.angle = v; live(); }).el),
            S(e, 'distance', 'Distância', 1, 250, 'px'), S(e, 'size', 'Tamanho', 0, 250, 'px', { pow: 2 }), UI.row('', UI.check('Inverter', !!e.invert, (v) => { e.invert = v; live(); }).el));
          break;
        case 'colorOverlay':
          add(modeRow(e, 'blend', 'color'), S(e, 'opacity', 'Opacidade', 0, 100, '%'));
          break;
        case 'gradientOverlay':
          if (!e.gradient) e.gradient = IMG.Gradients.def();
          add(modeRow(e, 'blend'), S(e, 'opacity', 'Opacidade', 0, 100, '%'),
            UI.row('Gradiente', IMG.Widgets.gradientBtn(e.gradient, (g) => { e.gradient = g; live(); }, { width: 160 }).el, UI.check('Inverter', !!e.reverse, (v) => { e.reverse = v; live(); }).el),
            UI.row('Estilo', UI.select([['linear', 'Linear'], ['radial', 'Radial'], ['angle', 'Angular'], ['reflected', 'Refletido'], ['diamond', 'Losango']], e.style, (v) => { e.style = v; live(); }, { keepFocus: true }).el, UI.check('Alinhar com a camada', e.align !== false, (v) => { e.align = v; live(); }).el),
            UI.row('Ângulo', IMG.Widgets.angle(e.angle, (v) => { e.angle = v; live(); }).el), S(e, 'scale', 'Escala', 10, 150, '%', { def: 100 }));
          break;
        case 'patternOverlay':
          add(modeRow(e, 'blend'), S(e, 'opacity', 'Opacidade', 0, 100, '%'), UI.row('Padrão', IMG.Widgets.patternBtn(e.pattern, (v) => { e.pattern = v; live(); }).el),
            S(e, 'scale', 'Escala', 1, 1000, '%', { def: 100, pow: 2 }), UI.row('', UI.check('Vincular à camada', e.link !== false, (v) => { e.link = v; live(); }).el));
          break;
        case 'stroke':
          add(S(e, 'size', 'Tamanho', 1, 250, 'px', { pow: 2 }),
            UI.row('Posição', UI.select([['outside', 'Externa'], ['inside', 'Interna'], ['center', 'Centralizada']], e.position, (v) => { e.position = v; live(); }, { keepFocus: true }).el),
            modeRow(e, 'blend'), S(e, 'opacity', 'Opacidade', 0, 100, '%'),
            UI.row('Tipo de preenchimento', UI.select([['color', 'Cor'], ['gradient', 'Gradiente'], ['pattern', 'Padrão']], e.fillType || 'color', (v) => { e.fillType = v; renderPane(); live(); }, { keepFocus: true }).el),
            fillSrc(e, 'fillType', 'gradStyle'));
          break;
      }
      add(el('div.ls-actions', UI.btn('Redefinir para o padrão', () => { fx[cur] = Object.assign(IMG.Effects.defaults(cur), { enabled: true }); renderPane(); live(); }, { small: true })));
    };

    renderNav(); renderPane();
    let preview = true;
    const prev = UI.check('Visualizar', true, (v) => {
      preview = v;
      if (v) { L.fx = fx; L.adv = adv; } else { L.fx = orig.fx; L.adv = orig.adv; }
      live();
    });
    const cleanup = () => {
      // remove efeitos desligados (mantém os parâmetros só se estiverem ativos)
      Object.keys(fx).forEach((k) => { if (fx[k] && !fx[k].enabled) delete fx[k]; });
      L.fx = Object.keys(fx).length ? fx : null;
      if (adv && !adv.blendIf && !(adv.channels && (adv.channels.r === false || adv.channels.g === false || adv.channels.b === false))) L.adv = null;
    };
    UI.dialog({
      title: 'Estilo de camada', width: 640, clear: true, className: 'ls-dialog', body: el('div.ls-wrap', nav, pane), footLeft: [prev.el],
      buttons: [
        { label: 'Cancelar', onClick: () => { L.fx = orig.fx; L.adv = orig.adv; L.blend = orig.blend; L.opacity = orig.opacity; L.fill = orig.fill; doc.globalAngle = orig.angle; doc.globalAltitude = orig.alt; IMG.Effects.invalidate(L); IMG.Engine.invalidate(); bus.emit('layers:change', doc); } },
        { label: 'OK', primary: true, onClick: () => { if (!preview) { L.fx = fx; L.adv = adv; } cleanup(); IMG.Effects.invalidate(L); IMG.Engine.invalidate(); bus.emit('layers:change', doc); IMG.commit('Estilo de camada'); } }
      ]
    });
  }

  function globalLightDialog() {
    const doc = IMG.app.doc, UI = IMG.UI; if (!doc) return;
    const o = { a: doc.globalAngle, h: doc.globalAltitude };
    const upd = () => { IMG.Layers.walk(doc.layers, (q) => IMG.Effects.invalidate(q)); IMG.Engine.invalidate(); };
    UI.dialog({ title: 'Luz global', width: 320, clear: true,
      body: [UI.row('Ângulo', IMG.Widgets.angle(doc.globalAngle, (v) => { doc.globalAngle = v; upd(); }, { alt: doc.globalAltitude }).el), UI.row('Altitude', UI.num({ value: doc.globalAltitude, min: 0, max: 90, unit: '°', width: 64, onChange: (v) => { doc.globalAltitude = v; upd(); } }).el)],
      buttons: [{ label: 'Cancelar', onClick: () => { doc.globalAngle = o.a; doc.globalAltitude = o.h; upd(); } }, { label: 'OK', primary: true, onClick: () => IMG.commit('Luz global') }] });
  }

  function scaleEffects() {
    const doc = IMG.app.doc, UI = IMG.UI, L = doc && doc.active; if (!L || !L.fx) return;
    const orig = IMG.jclone(L.fx);
    const apply = (k) => {
      L.fx = IMG.jclone(orig);
      const sc = (o, keys) => keys.forEach((key) => { if (o && o[key] != null) o[key] = Math.round(o[key] * k * 10) / 10; });
      Object.keys(L.fx).forEach((n) => sc(L.fx[n], ['distance', 'size', 'soften']));
      IMG.Effects.invalidate(L); IMG.Engine.invalidate();
    };
    UI.dialog({ title: 'Dimensionar efeitos', width: 340, clear: true,
      body: UI.slider({ label: 'Escala', value: 100, min: 1, max: 1000, unit: '%', pow: 2, def: 100, onInput: (v) => apply(v / 100) }).el,
      buttons: [{ label: 'Cancelar', onClick: () => { L.fx = orig; IMG.Effects.invalidate(L); IMG.Engine.invalidate(); } }, { label: 'OK', primary: true, onClick: () => { bus.emit('layers:change', doc); IMG.commit('Dimensionar efeitos'); } }] });
  }

  IMG.LayerStyle = { open, globalLightDialog, scaleEffects };

  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, h) => {
    const styleable = () => { const a = h.act(); return !!(a && !a.isBg && a.type !== 'adjust'); };
    C('layer.style.blending', 'Opções de mesclagem…', () => open('blending'), { enabled: styleable });
    IMG.Effects.LIST.forEach((k) => C('layer.style.' + k, IMG.Effects.NAMES[k] + '…', () => open(k), { enabled: styleable }));
    C('layer.style.copy', 'Copiar estilo de camada', () => { const a = h.act(); clipboardStyle = { fx: IMG.jclone(a.fx), adv: IMG.jclone(a.adv) }; IMG.UI.toast('Estilo copiado.'); }, { enabled: () => !!(h.act() && (h.act().fx || h.act().adv)) });
    C('layer.style.paste', 'Colar estilo de camada', () => { const d = h.doc(); Layers.selectedLayers(d).forEach((q) => { if (q.isBg || q.type === 'adjust') return; q.fx = IMG.jclone(clipboardStyle.fx); q.adv = IMG.jclone(clipboardStyle.adv); IMG.Effects.invalidate(q); }); h.done('Colar estilo de camada'); }, { enabled: () => !!(clipboardStyle && h.act()) });
    C('layer.style.clear', 'Limpar estilo de camada', () => { const d = h.doc(); Layers.selectedLayers(d).forEach((q) => { q.fx = null; q.adv = null; IMG.Effects.invalidate(q); }); h.done('Limpar estilo de camada'); }, { enabled: () => !!(h.act() && (h.act().fx || h.act().adv)) });
    C('layer.style.globalLight', 'Luz global…', globalLightDialog, { enabled: h.has });
    C('layer.style.scale', 'Dimensionar efeitos…', scaleEffects, { enabled: () => !!(h.act() && h.act().fx) });
    C('layer.style.toggle', 'Ocultar todos os efeitos', () => { const a = h.act(); if (!a.fx) return; a.fx.off = !a.fx.off; IMG.Effects.invalidate(a); h.done(a.fx.off ? 'Ocultar efeitos' : 'Mostrar efeitos'); }, { enabled: () => !!(h.act() && h.act().fx) });
    C('layer.rasterizeStyle', 'Estilo de camada', () => {
      const d = h.doc(), a = h.act(); if (!a || !a.fx) return;
      const R = U.rectInflate(Layers.boundsOf([a], d.rect), IMG.Effects.pad(a.fx));
      const c = U.createCanvas(R.w, R.h);
      IMG.Engine.drawLayer(c.getContext('2d'), Object.assign(Object.create(Object.getPrototypeOf(a)), a, { opacity: 1, blend: 'normal', clip: false }), R, 70, null);
      a.type = 'raster'; a.text = null; a.shape = null; a.fillDef = null; a.smart = null; a.fx = null; a.mask = null; a.fill = 1;
      a.setCanvas(c, R.x, R.y);
      h.done('Rasterizar estilo de camada');
    }, { enabled: () => !!(h.act() && h.act().fx && h.act().type !== 'group') });
  });
})();
