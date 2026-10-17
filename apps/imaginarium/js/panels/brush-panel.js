/* ==========================================================================
   Imaginarium — painel Pincel (F5)
   Forma da ponta, Dinâmica de forma, Dispersão, Dinâmica de cor e
   Transferência para a ferramenta de pintura ativa.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  let root, body, preview, section = 'tip';

  const SECTIONS = [
    ['tip', 'Forma da ponta do pincel', null],
    ['shape', 'Dinâmica de forma', 'shape'],
    ['scatter', 'Dispersão', 'scatterOn'],
    ['color', 'Dinâmica de cor', 'colorOn'],
    ['transfer', 'Transferência', 'transfer']
  ];

  function toolInfo() {
    const T = IMG.Tools, id = T.activeId, o = T.o(id);
    if (!o || o.size == null || !('tip' in o)) return null;
    if (!o.dyn) o.dyn = Object.assign({}, IMG.BRUSH_DYN_DEF);
    return { T, id, o };
  }

  function drawPreview() {
    const inf = toolInfo();
    if (!preview) return;
    const W = preview.width, H = preview.height, ctx = preview.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    if (!inf) return;
    const o = inf.o, d = Object.assign({}, IMG.BRUSH_DYN_DEF, o.dyn || {});
    const size = Math.min(H * 0.5, Math.max(2, o.size)), sp = Math.max(0.01, (o.spacing == null ? 25 : o.spacing) / 100) * size;
    const pt = (t) => ({ x: 14 + t * (W - 28), y: H / 2 + Math.sin(t * Math.PI * 2) * (H * 0.22) });
    let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    let last = pt(0), acc = 0;
    const tipCache = {};
    const fg = IMG.app.fg;
    for (let i = 1; i <= 400; i++) {
      const p = pt(i / 400), seg = Math.hypot(p.x - last.x, p.y - last.y);
      acc += seg; last = p;
      if (acc < sp) continue;
      acc = 0;
      let s = 1, ang = U.rad(o.angle || 0), rnd = (o.roundness == null ? 100 : o.roundness) / 100, al = (o.flow == null ? 100 : o.flow) / 100;
      if (d.shape) {
        if (d.sizeJitter) s *= Math.max(d.minDiameter / 100, 1 - r() * d.sizeJitter / 100);
        if (d.angleJitter) ang += (r() - 0.5) * 2 * Math.PI * d.angleJitter / 100;
        if (d.roundJitter) rnd *= Math.max(d.minRound / 100, 1 - r() * d.roundJitter / 100);
      }
      if (d.transfer) { if (d.flowJitter) al *= 1 - r() * d.flowJitter / 100; if (d.opacityJitter) al *= 1 - r() * d.opacityJitter / 100; }
      let col = fg;
      if (d.colorOn) {
        let c = U.hexToRgb(fg);
        if (d.fgbg) { const t = r() * d.fgbg / 100, b2 = U.hexToRgb(IMG.app.bg); c = { r: c.r + (b2.r - c.r) * t, g: c.g + (b2.g - c.g) * t, b: c.b + (b2.b - c.b) * t }; }
        const hsv = U.rgbToHsv(c.r, c.g, c.b);
        if (d.hueJitter) hsv.h += (r() - 0.5) * 360 * d.hueJitter / 100;
        if (d.satJitter) hsv.s = U.clamp(hsv.s + (r() - 0.5) * 2 * d.satJitter / 100, 0, 1);
        if (d.briJitter) hsv.v = U.clamp(hsv.v + (r() - 0.5) * 2 * d.briJitter / 100, 0, 1);
        if (d.purity) hsv.s = U.clamp(hsv.s + d.purity / 100, 0, 1);
        const q = U.hsvToRgb(hsv.h, hsv.s, hsv.v); col = U.rgbToHex(Math.round(q.r), Math.round(q.g), Math.round(q.b));
      }
      const n = d.scatterOn ? Math.max(1, Math.round((d.count || 1) * (1 - r() * (d.countJitter || 0) / 100))) : 1;
      for (let k = 0; k < n; k++) {
        let ox = 0, oy = 0;
        if (d.scatterOn && d.scatter) { const sc = (d.scatter / 100) * size; ox = d.bothAxes ? (r() - 0.5) * 2 * sc : 0; oy = (r() - 0.5) * 2 * sc; }
        const key = col;
        const tip = tipCache[key] || (tipCache[key] = IMG.makeBrushTip(size, (o.hardness == null ? 100 : o.hardness) / 100, col, o.tip, inf.id === 'pencil'));
        ctx.save();
        ctx.globalAlpha = U.clamp(al, 0, 1);
        ctx.translate(p.x + ox, p.y + oy); ctx.rotate(ang);
        ctx.scale((d.flipX ? -1 : 1) * s, rnd * (d.flipY ? -1 : 1) * s);
        ctx.drawImage(tip, -tip.width / 2, -tip.height / 2);
        ctx.restore();
      }
    }
  }

  function render() {
    if (!root || !root.isConnected) return;
    U.clear(body);
    const UI = IMG.UI, inf = toolInfo();
    if (!inf) { body.appendChild(el('div.panel-empty', { text: 'Escolha uma ferramenta de pintura (Pincel, Lápis, Borracha, Carimbo…) para ajustar o pincel.' })); drawPreview(); return; }
    const { T, id, o } = inf, d = o.dyn;
    const setO = (k, v) => { T.setOpt(id, k, v, true); drawPreview(); };
    const setD = (k, v) => { d[k] = v; T.setOpt(id, 'dyn', d, true); drawPreview(); };
    const sl = (label, val, min, max, on, o2 = {}) => UI.slider({ label, value: val, min, max, step: o2.step || 1, unit: o2.unit == null ? '%' : o2.unit, pow: o2.pow, stack: true, onInput: on, onChange: on }).el;

    const nav = el('div.bp-nav');
    SECTIONS.forEach(([sid, name, flag]) => {
      const row = el('div.bp-sec' + (section === sid ? '.on' : ''));
      if (flag) {
        const cb = el('input', { type: 'checkbox' }); cb.checked = !!d[flag];
        cb.addEventListener('change', () => { setD(flag, cb.checked); });
        row.appendChild(cb);
      } else row.appendChild(el('span.bp-pad'));
      const lb = el('span', { text: name });
      lb.addEventListener('click', () => { section = sid; if (flag && !d[flag]) setD(flag, true); render(); });
      row.appendChild(lb);
      nav.appendChild(row);
    });

    const pane = el('div.bp-pane');
    if (section === 'tip') {
      const grid = el('div.brush-grid.bp-tips');
      IMG.Brushes.all().forEach((pr) => {
        const cell = el('button.brush-cell' + (o.tip === pr.tip && o.size === pr.size ? '.sel' : ''), { type: 'button', title: pr.name }, IMG.brushPreview({ size: Math.min(30, pr.size), hardness: pr.hardness, tip: pr.tip }, 36, 34), el('small', { text: String(pr.size) }));
        cell.addEventListener('click', () => { setO('tip', pr.tip); setO('size', pr.size); if ('hardness' in o) setO('hardness', pr.hardness); if (pr.spacing) setO('spacing', pr.spacing); IMG.UI.renderOptions(); render(); });
        grid.appendChild(cell);
      });
      pane.append(grid,
        sl('Tamanho', o.size, 1, 2500, (v) => setO('size', v), { unit: 'px', pow: 2.6 }),
        el('div.bp-row', UI.check('Inverter X', !!d.flipX, (v) => setD('flipX', v)).el, UI.check('Inverter Y', !!d.flipY, (v) => setD('flipY', v)).el),
        el('div.bp-row', el('span.form-label', { text: 'Ângulo' }), IMG.Widgets.angle(o.angle || 0, (v) => setO('angle', v)).el),
        sl('Arredondamento', o.roundness == null ? 100 : o.roundness, 1, 100, (v) => setO('roundness', v)));
      if ('hardness' in o) pane.appendChild(sl('Dureza', o.hardness, 0, 100, (v) => setO('hardness', v)));
      pane.appendChild(sl('Espaçamento', o.spacing == null ? 25 : o.spacing, 1, 1000, (v) => setO('spacing', v), { pow: 2 }));
    } else if (section === 'shape') {
      pane.append(
        sl('Variação de tamanho', d.sizeJitter, 0, 100, (v) => setD('sizeJitter', v)),
        sl('Diâmetro mínimo', d.minDiameter, 0, 100, (v) => setD('minDiameter', v)),
        sl('Variação de ângulo', d.angleJitter, 0, 100, (v) => setD('angleJitter', v)),
        sl('Variação de arredondamento', d.roundJitter, 0, 100, (v) => setD('roundJitter', v)),
        sl('Arredondamento mínimo', d.minRound, 1, 100, (v) => setD('minRound', v)),
        el('div.bp-row', UI.check('Variação de inversão X', !!d.flipXJ, (v) => setD('flipXJ', v)).el, UI.check('Variação de inversão Y', !!d.flipYJ, (v) => setD('flipYJ', v)).el),
        el('p.dialog-note', { text: 'Com caneta, o tamanho também acompanha a pressão quando o botão de pressão de tamanho está ativo na barra de opções.' }));
    } else if (section === 'scatter') {
      pane.append(
        sl('Dispersão', d.scatter, 0, 1000, (v) => setD('scatter', v), { pow: 2 }),
        el('div.bp-row', UI.check('Ambos os eixos', !!d.bothAxes, (v) => setD('bothAxes', v)).el),
        sl('Contagem', d.count || 1, 1, 16, (v) => setD('count', v), { unit: '' }),
        sl('Variação de contagem', d.countJitter, 0, 100, (v) => setD('countJitter', v)));
    } else if (section === 'color') {
      pane.append(
        sl('Variação de 1º plano/fundo', d.fgbg, 0, 100, (v) => setD('fgbg', v)),
        sl('Variação de matiz', d.hueJitter, 0, 100, (v) => setD('hueJitter', v)),
        sl('Variação de saturação', d.satJitter, 0, 100, (v) => setD('satJitter', v)),
        sl('Variação de brilho', d.briJitter, 0, 100, (v) => setD('briJitter', v)),
        sl('Pureza', d.purity, -100, 100, (v) => setD('purity', v)));
    } else if (section === 'transfer') {
      pane.append(
        sl('Variação de opacidade', d.opacityJitter, 0, 100, (v) => setD('opacityJitter', v)),
        sl('Variação de fluxo', d.flowJitter, 0, 100, (v) => setD('flowJitter', v)));
    }
    body.append(el('div.bp-main', nav, pane));
    drawPreview();
  }

  IMG.UI.registerPanel({
    id: 'brush', title: 'Pincel', icon: 'brushPanel', keys: ['f5'],
    build(node) {
      root = node;
      body = el('div.bp-body');
      preview = U.domCanvas(280, 70); preview.className = 'bp-preview';
      const foot = el('div.panel-foot',
        IMG.UI.btn('Definir pincel…', () => IMG.UI.run('edit.defineBrush'), { small: true, title: 'Cria um pincel a partir da seleção' }),
        el('span.pgroup-fill'),
        IMG.UI.btn('Redefinir', () => { const inf = toolInfo(); if (inf) { inf.o.dyn = Object.assign({}, IMG.BRUSH_DYN_DEF); inf.T.setOpt(inf.id, 'dyn', inf.o.dyn, true); render(); } }, { small: true, title: 'Desliga todas as dinâmicas' }));
      root.append(body, preview, foot);
      bus.on('tool:change', render);
      bus.on('tool:option', () => drawPreview());
      bus.on('color:change', () => drawPreview());
      bus.on('brushes:change', render);
      render();
    },
    onShow() { render(); }
  });

  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C) => {
    C('edit.defineBrush', 'Definir predefinição de pincel…', () => {
      const doc = IMG.app.doc; if (!doc) return;
      const p = IMG.Brushes.defineFromSelection(doc);
      IMG.UI.prompt('Nome do pincel', 'Nome', p.name).then((v) => {
        if (v) { p.name = v; try { U.store.set('userBrushes', IMG.Brushes.user); } catch (e) { /* cota */ } }
        const T = IMG.Tools, id = T.o(T.activeId).tip !== undefined ? T.activeId : 'brush';
        T.setOpt(id, 'tip', p.tip, true); T.setOpt(id, 'size', Math.min(2500, p.size), true);
        if (T.activeId !== id) T.set(id); else IMG.UI.renderOptions();
        IMG.UI.toast('Pincel "' + p.name + '" definido.');
        bus.emit('brushes:change');
      });
    }, { enabled: () => !!IMG.app.doc });
    C('edit.definePattern', 'Definir padrão…', () => {
      const doc = IMG.app.doc; if (!doc) return;
      const comp = IMG.Engine.composite(doc);
      const b = doc.selection ? doc.selection.bounds : doc.rect;
      if (!b || b.w < 1 || b.h < 1) return;
      const c = U.createCanvas(b.w, b.h); c.getContext('2d').drawImage(comp, -b.x, -b.y);
      IMG.UI.prompt('Nome do padrão', 'Nome', 'Padrão ' + (IMG.Patterns.all().length + 1)).then((v) => {
        if (v == null) return;
        IMG.Patterns.add(c, v);
        IMG.UI.toast('Padrão "' + v + '" definido.');
      });
    }, { enabled: () => !!IMG.app.doc });
  });
})();
