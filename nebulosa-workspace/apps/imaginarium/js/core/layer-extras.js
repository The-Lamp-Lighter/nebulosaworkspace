/* ==========================================================================
   Imaginarium — extras de camadas
   Diálogos Nova camada / Novo grupo / Grupo a partir de camadas,
   painel Estilos, Alinhar camadas automaticamente, Mesclar camadas
   automaticamente e Gerenciador de predefinições.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const Layers = IMG.Layers;
  const LCOLORS = [['', 'Nenhuma'], ['#d9534f', 'Vermelho'], ['#f0ad4e', 'Laranja'], ['#e8d44d', 'Amarelo'], ['#5cb85c', 'Verde'], ['#5bc0de', 'Azul'], ['#9b6bd6', 'Violeta'], ['#8c8c8c', 'Cinza']];

  /* ==================================================================
     DIÁLOGOS DE CAMADA
     ================================================================== */
  /** Abre o diálogo de propriedades de nova camada/grupo. Resolve com {name,color,blend,opacity,clip} ou null. */
  function layerDialog(title, o = {}) {
    const UI = IMG.UI;
    return new Promise((res) => {
      const nameIn = el('input.inp', { type: 'text', value: o.name || '' });
      let color = o.color || '', blend = o.blend || 'normal', opacity = o.opacity == null ? 100 : o.opacity, clip = false, ok = false;
      const body = [UI.row('Nome', nameIn)];
      if (o.clip) body.push(UI.row('', UI.check('Usar camada anterior para criar máscara de recorte', false, (v) => { clip = v; }).el));
      body.push(UI.row('Cor', UI.select(LCOLORS, color, (v) => { color = v; }, { width: 150, keepFocus: true }).el));
      body.push(UI.row('Modo', UI.select(o.group ? IMG.BLEND_LIST_GROUP : IMG.BLEND_LIST, blend, (v) => { blend = v; }, { width: 200, keepFocus: true }).el));
      body.push(UI.row('Opacidade', UI.num({ value: opacity, min: 0, max: 100, unit: '%', width: 80, onInput: (v) => { opacity = v; } }).el));
      UI.dialog({ title, width: 420, body,
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => { ok = true; } }],
        onClose: () => res(ok ? { name: nameIn.value.trim() || o.name, color: color || null, blend, opacity, clip } : null) });
      setTimeout(() => { nameIn.focus(); nameIn.select(); }, 30);
    });
  }
  function applyProps(L, p) {
    if (!L || !p) return;
    if (p.name) L.name = p.name;
    L.color = p.color || null;
    L.blend = p.blend || L.blend;
    L.opacity = U.clamp(p.opacity / 100, 0, 1);
  }
  IMG.layerDialog = layerDialog;

  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, H) => {
    C('layer.new', 'Camada…', async () => {
      const d = H.doc(), p = await layerDialog('Nova camada', { name: Layers.name(d, 'Camada'), clip: true });
      if (!p) return;
      const L = Layers.newRaster(d, { name: p.name }); applyProps(L, p);
      if (p.clip && L) Layers.toggleClip(d, L, true);
      bus.emit('layers:change', d); IMG.commit('Nova camada');
    }, { enabled: H.has, keys: ['ctrl+shift+n'] });
    C('layer.newGroup', 'Grupo…', async () => {
      const d = H.doc(), p = await layerDialog('Novo grupo', { name: Layers.name(d, 'Grupo'), group: true, blend: 'pass' });
      if (!p) return;
      const G = Layers.newGroup(d) || d.active; applyProps(G, p);
      bus.emit('layers:change', d); IMG.commit('Novo grupo');
    }, { enabled: H.has });
    C('layer.groupFromLayers', 'Grupo a partir de camadas…', async () => {
      const d = H.doc(), p = await layerDialog('Novo grupo a partir de camadas', { name: Layers.name(d, 'Grupo'), group: true, blend: 'pass' });
      if (!p) return;
      const G = Layers.group(d); if (!G) return; applyProps(G, p);
      bus.emit('layers:change', d); IMG.commit('Grupo a partir de camadas');
    }, { enabled: H.hasLayer });
    C('layer.props', 'Propriedades da camada…', async () => {
      const d = H.doc(), L = d.active;
      const p = await layerDialog('Propriedades da camada', { name: L.name, color: L.color, blend: L.blend, opacity: Math.round(L.opacity * 100), group: L.type === 'group' });
      if (!p) return;
      applyProps(L, p); if (L.text) L.text.auto = false;
      bus.emit('layers:change', d); IMG.commit('Propriedades da camada');
    }, { enabled: H.hasLayer });
  });

  /* ==================================================================
     PAINEL ESTILOS
     ================================================================== */
  const fxd = (k, o) => Object.assign(IMG.Effects.defaults(k), { enabled: true }, o || {});
  const grad = (cols) => ({ name: '', colors: cols.map((c, i) => ({ t: i / (cols.length - 1), c })), alphas: [{ t: 0, a: 1 }, { t: 1, a: 1 }] });
  const BUILTIN = () => [
    { name: 'Sombra suave', fx: { dropShadow: fxd('dropShadow', { opacity: 45, distance: 8, size: 18 }) } },
    { name: 'Sombra dura', fx: { dropShadow: fxd('dropShadow', { opacity: 90, distance: 6, size: 0 }) } },
    { name: 'Contorno preto', fx: { stroke: fxd('stroke', { size: 3, color: '#000000' }) } },
    { name: 'Contorno branco', fx: { stroke: fxd('stroke', { size: 4, color: '#ffffff' }), dropShadow: fxd('dropShadow', { opacity: 40, distance: 3, size: 6 }) } },
    { name: 'Neon', fx: { colorOverlay: fxd('colorOverlay', { color: '#e9fbff' }), outerGlow: fxd('outerGlow', { color: '#14d8ff', size: 22, opacity: 95, spread: 10 }), innerGlow: fxd('innerGlow', { color: '#14d8ff', size: 6, opacity: 80 }) } },
    { name: 'Relevo', fx: { bevel: fxd('bevel', { size: 8, depth: 150 }) } },
    { name: 'Almofada', fx: { bevel: fxd('bevel', { style: 'pillow', size: 10 }) } },
    { name: 'Entalhe', fx: { innerShadow: fxd('innerShadow', { opacity: 70, distance: 3, size: 4 }), bevel: fxd('bevel', { direction: 'down', size: 3 }) } },
    { name: 'Botão', fx: { gradientOverlay: fxd('gradientOverlay', { gradient: grad(['#2b6cb0', '#63b3ed']), angle: 90 }), bevel: fxd('bevel', { size: 6, soften: 4 }), dropShadow: fxd('dropShadow', { opacity: 50, distance: 4, size: 8 }), stroke: fxd('stroke', { size: 1, color: '#1a4a80', position: 'inside' }) } },
    { name: 'Dourado', fx: { gradientOverlay: fxd('gradientOverlay', { gradient: grad(['#8a5a12', '#f7d774', '#b8860b', '#fff1b8', '#8a5a12']), angle: 90 }), bevel: fxd('bevel', { size: 7, depth: 220, technique: 'chiselHard' }), dropShadow: fxd('dropShadow', { opacity: 60, distance: 4, size: 6 }) } },
    { name: 'Prata', fx: { gradientOverlay: fxd('gradientOverlay', { gradient: grad(['#6b7280', '#f3f4f6', '#9ca3af', '#ffffff', '#6b7280']), angle: 90 }), bevel: fxd('bevel', { size: 6, depth: 200 }), stroke: fxd('stroke', { size: 1, color: '#4b5563' }) } },
    { name: 'Vidro', fx: { colorOverlay: fxd('colorOverlay', { color: '#9fd8ff', opacity: 35 }), innerGlow: fxd('innerGlow', { color: '#ffffff', size: 10, opacity: 70 }), bevel: fxd('bevel', { size: 12, soften: 6, hlOpacity: 90, shOpacity: 30 }), dropShadow: fxd('dropShadow', { opacity: 25, distance: 6, size: 12 }) } },
    { name: 'Carimbo', fx: { colorOverlay: fxd('colorOverlay', { color: '#c0392b' }), stroke: fxd('stroke', { size: 2, color: '#c0392b', position: 'outside' }), patternOverlay: fxd('patternOverlay', { blend: 'screen', opacity: 25 }) } },
    { name: 'Cetim', fx: { colorOverlay: fxd('colorOverlay', { color: '#7c3aed' }), satin: fxd('satin', { color: '#ffffff', blend: 'overlay', opacity: 60 }) } },
    { name: 'Brilho externo', fx: { outerGlow: fxd('outerGlow', { size: 16, opacity: 85 }) } },
    { name: 'Arco-íris', fx: { gradientOverlay: fxd('gradientOverlay', { gradient: grad(['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#5856d6', '#af52de']), angle: 0 }) } }
  ];
  const Styles = (IMG.StylePresets = {
    builtin: null,
    user: U.store.get('stylePresets', []) || [],
    all() { if (!this.builtin) this.builtin = BUILTIN(); return this.builtin.concat(this.user); },
    save() { try { U.store.set('stylePresets', this.user); } catch (e) { IMG.UI.toast('Sem espaço para salvar estilos.'); } bus.emit('styles:change'); },
    apply(doc, st, merge) {
      const sel = Layers.selectedLayers(doc).filter((q) => !q.isBg && q.type !== 'adjust' && q.type !== 'group' || q.type === 'group');
      if (!sel.length) { IMG.UI.toast('Selecione uma camada (o Fundo não aceita estilos).'); return; }
      sel.forEach((q) => { if (q.isBg) return; q.fx = merge && q.fx ? Object.assign(IMG.jclone(q.fx), IMG.jclone(st.fx)) : IMG.jclone(st.fx); if (st.adv) q.adv = IMG.jclone(st.adv); if (st.blend) q.blend = st.blend; if (st.fill != null) q.fill = st.fill; IMG.Effects.invalidate(q); });
      bus.emit('layers:change', doc); IMG.Engine.invalidate(); IMG.commit('Aplicar estilo');
    },
    fromLayer(L, name, withBlend) {
      const st = { id: U.uid('sty'), name, fx: IMG.jclone(L.fx || {}), adv: IMG.jclone(L.adv) };
      if (withBlend) { st.blend = L.blend; st.fill = L.fill; }
      this.user.push(st); this.save(); return st;
    },
    /** Miniatura: um quadrado arredondado com o estilo aplicado. */
    thumb(st, size = 44) {
      const key = st.id || st.name;
      this._cache = this._cache || {};
      if (this._cache[key]) return this._cache[key];
      const c = U.domCanvas(size, size), x = c.getContext('2d');
      x.fillStyle = '#e9ebee'; x.fillRect(0, 0, size, size);
      x.fillStyle = '#d6d9de'; for (let j = 0; j < size; j += 6) for (let i = (j / 6) % 2 ? 6 : 0; i < size; i += 12) x.fillRect(i, j, 6, 6);
      try {
        const s = size * 2, cv = U.createCanvas(s, s), cx = cv.getContext('2d');
        cx.fillStyle = '#9aa3ad'; cx.beginPath();
        if (cx.roundRect) cx.roundRect(s * 0.2, s * 0.2, s * 0.6, s * 0.6, s * 0.1); else cx.rect(s * 0.2, s * 0.2, s * 0.6, s * 0.6);
        cx.fill();
        const L = new IMG.Layer('raster', { name: 's', canvas: cv, x: 0, y: 0 });
        L.fx = IMG.jclone(st.fx); if (st.blend) L.blend = st.blend; if (st.fill != null) L.fill = st.fill;
        const D = new IMG.Doc({ name: 'estilo', width: s, height: s }); D.layers = [L]; L.parent = null;
        x.drawImage(IMG.Engine.flatten(D), 0, 0, size, size);
      } catch (err) { console.warn(err); }
      this._cache[key] = c;
      return c;
    }
  });
  bus.on('styles:change', () => { Styles._cache = {}; });

  IMG.UI.registerPanel({
    id: 'styles', title: 'Estilos', icon: 'styles',
    build(node) {
      const UI = IMG.UI, grid = el('div.style-grid');
      const render = () => {
        U.clear(grid);
        Styles.all().forEach((st) => {
          const b = el('button.style-item', { type: 'button', title: st.name + ' — clique: aplicar · Shift+clique: acrescentar' });
          b.appendChild(Styles.thumb(st));
          b.addEventListener('click', (e) => { const d = IMG.app.doc; if (d) Styles.apply(d, st, e.shiftKey); });
          b.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const user = Styles.user.includes(st);
            UI.contextMenu(e.clientX, e.clientY, [
              { label: 'Aplicar', run: () => IMG.app.doc && Styles.apply(IMG.app.doc, st, false) },
              { label: 'Acrescentar ao estilo atual', run: () => IMG.app.doc && Styles.apply(IMG.app.doc, st, true) },
              '-',
              { label: 'Renomear estilo…', enabled: () => user, run: () => UI.prompt('Renomear estilo', 'Nome', st.name).then((v) => { if (v) { st.name = v; Styles.save(); } }) },
              { label: 'Excluir estilo', enabled: () => user, run: () => { Styles.user.splice(Styles.user.indexOf(st), 1); Styles.save(); } }
            ]);
          });
          grid.appendChild(b);
        });
      };
      const foot = el('div.panel-foot',
        UI.iconBtn('close', 'Limpar estilo das camadas selecionadas', () => UI.run('layer.style.clear')),
        el('span.pgroup-fill'),
        UI.iconBtn('newLayer', 'Novo estilo a partir da camada ativa', () => UI.run('layer.style.new')),
        UI.iconBtn('trash', 'Excluir os estilos criados por você', () => { if (!Styles.user.length) return; UI.confirm ? UI.confirm('Excluir todos os estilos personalizados?').then((ok) => { if (ok) { Styles.user = []; Styles.save(); } }) : (Styles.user = [], Styles.save()); }));
      node.append(grid, foot);
      bus.on('styles:change', render);
      render();
    }
  });
  IMG.onInit.push((C, H) => {
    C('layer.style.new', 'Novo estilo…', async () => {
      const L = H.doc().active;
      if (!L.fx || !Object.keys(L.fx).length) { IMG.UI.toast('A camada ativa não tem estilo de camada.'); return; }
      const v = await IMG.UI.prompt('Novo estilo', 'Nome', 'Estilo ' + (Styles.user.length + 1));
      if (v) { Styles.fromLayer(L, v, true); IMG.UI.toast('Estilo "' + v + '" salvo no painel Estilos.'); }
    }, { enabled: () => !!(H.hasLayer() && H.doc().active.fx) });
  });

  /* ==================================================================
     ALINHAR CAMADAS AUTOMATICAMENTE (pontos de interesse + RANSAC)
     ================================================================== */
  const Hm = () => IMG.Homography;
  /** Camada em tons de cinza (Float32 0..1) e alfa, no espaço do documento reduzido por s. */
  function grayOf(L, doc, s) {
    const W = Math.max(8, Math.round(doc.width * s)), H = Math.max(8, Math.round(doc.height * s));
    const c = U.createCanvas(W, H), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(L.canvas, L.x * s, L.y * s, L.canvas.width * s, L.canvas.height * s);
    const d = x.getImageData(0, 0, W, H).data, g = new Float32Array(W * H), a = new Float32Array(W * H);
    for (let i = 0, j = 0; j < g.length; i += 4, j++) { g[j] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; a[j] = d[i + 3] / 255; }
    return { g, a, W, H };
  }
  function boxBlur(src, W, H, r) {
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H), n = 2 * r + 1;
    for (let y = 0; y < H; y++) { let s = 0; const o = y * W; for (let x = -r; x <= r; x++) s += src[o + U.clamp(x, 0, W - 1)]; for (let x = 0; x < W; x++) { tmp[o + x] = s / n; s += src[o + Math.min(W - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; } }
    for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[U.clamp(y, 0, H - 1) * W + x]; for (let y = 0; y < H; y++) { out[y * W + x] = s / n; s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
    return out;
  }
  /** Cantos de Harris (com supressão de não máximos). */
  function corners(im, max = 500) {
    const { g, a, W, H } = im, Ixx = new Float32Array(W * H), Iyy = new Float32Array(W * H), Ixy = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = (g[i - W + 1] + 2 * g[i + 1] + g[i + W + 1]) - (g[i - W - 1] + 2 * g[i - 1] + g[i + W - 1]);
      const gy = (g[i + W - 1] + 2 * g[i + W] + g[i + W + 1]) - (g[i - W - 1] + 2 * g[i - W] + g[i - W + 1]);
      Ixx[i] = gx * gx; Iyy[i] = gy * gy; Ixy[i] = gx * gy;
    }
    const A = boxBlur(Ixx, W, H, 2), B = boxBlur(Iyy, W, H, 2), Cc = boxBlur(Ixy, W, H, 2), R = new Float32Array(W * H);
    let mx = 0;
    for (let i = 0; i < R.length; i++) { const tr = A[i] + B[i]; R[i] = A[i] * B[i] - Cc[i] * Cc[i] - 0.04 * tr * tr; if (R[i] > mx) mx = R[i]; }
    const pts = [], m = 14, thr = mx * 0.004;
    for (let y = m; y < H - m; y++) for (let x = m; x < W - m; x++) {
      const i = y * W + x, v = R[i];
      if (v <= thr || a[i] < 0.99 || a[i - m * W - m] < 0.99 || a[i + m * W + m] < 0.99 || a[i - m * W + m] < 0.99 || a[i + m * W - m] < 0.99) continue;
      let best = true;
      for (let dy = -3; dy <= 3 && best; dy++) for (let dx = -3; dx <= 3; dx++) { if ((dx || dy) && R[i + dy * W + dx] > v) { best = false; break; } }
      if (best) pts.push({ x, y, v });
    }
    pts.sort((p, q) => q.v - p.v);
    // distribui os pontos pela imagem: no máximo um a cada 6 px
    const out = [], cell = 6, used = new Set();
    for (const p of pts) { const k = ((p.y / cell) | 0) * 100000 + ((p.x / cell) | 0); if (used.has(k)) continue; used.add(k); out.push(p); if (out.length >= max) break; }
    return out;
  }
  /** Descritor: 8×8 amostras normalizadas (orientadas quando rot = true). */
  function describe(im, pts, rot) {
    const { W, H } = im, gb = boxBlur(im.g, W, H, 1), out = [];
    const smp = (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0; if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) return 0; const i = y0 * W + x0; return gb[i] * (1 - fx) * (1 - fy) + gb[i + 1] * fx * (1 - fy) + gb[i + W] * (1 - fx) * fy + gb[i + W + 1] * fx * fy; };
    for (const p of pts) {
      let th = 0;
      if (rot) { let m10 = 0, m01 = 0; for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) { if (dx * dx + dy * dy > 81) continue; const v = gb[(p.y + dy) * W + p.x + dx]; m10 += dx * v; m01 += dy * v; } th = Math.atan2(m01, m10); }
      const c = Math.cos(th), s = Math.sin(th), d = new Float32Array(64);
      let mean = 0;
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const u = (i - 3.5) * 1.6, v = (j - 3.5) * 1.6; const val = smp(p.x + u * c - v * s, p.y + u * s + v * c); d[j * 8 + i] = val; mean += val; }
      mean /= 64; let n = 0;
      for (let k = 0; k < 64; k++) { d[k] -= mean; n += d[k] * d[k]; }
      n = Math.sqrt(n); if (n < 1e-3) continue;
      for (let k = 0; k < 64; k++) d[k] /= n;
      out.push({ x: p.x, y: p.y, d });
    }
    return out;
  }
  function match(A, B) {
    const out = [];
    for (const a of A) {
      let b1 = -2, b2 = -2, bi = -1;
      for (let j = 0; j < B.length; j++) { const d = B[j].d; let s = 0; for (let k = 0; k < 64; k++) s += a.d[k] * d[k]; if (s > b1) { b2 = b1; b1 = s; bi = j; } else if (s > b2) b2 = s; }
      if (bi < 0 || b1 < 0.75) continue;
      const d1 = Math.sqrt(Math.max(0, 2 - 2 * b1)), d2 = Math.sqrt(Math.max(0, 2 - 2 * b2));
      if (d1 < 0.8 * d2) out.push({ p: { x: a.x, y: a.y }, q: { x: B[bi].x, y: B[bi].y } });
    }
    return out;
  }
  /* modelos: retornam H 3×3 (linha a linha) que leva p → q */
  const FIT = {
    translate(ms) { let dx = 0, dy = 0; ms.forEach((m) => { dx += m.q.x - m.p.x; dy += m.q.y - m.p.y; }); dx /= ms.length; dy /= ms.length; return [1, 0, dx, 0, 1, dy, 0, 0, 1]; },
    similarity(ms) {
      // mínimos quadrados para x' = a x − b y + tx, y' = b x + a y + ty
      const N = Array.from({ length: 4 }, () => new Array(4).fill(0)), v = new Array(4).fill(0);
      const addRow = (r, t) => { for (let i = 0; i < 4; i++) { v[i] += r[i] * t; for (let j = 0; j < 4; j++) N[i][j] += r[i] * r[j]; } };
      ms.forEach((m) => { addRow([m.p.x, -m.p.y, 1, 0], m.q.x); addRow([m.p.y, m.p.x, 0, 1], m.q.y); });
      const r = Hm().solve(N, v); if (!r) return null;
      return [r[0], -r[1], r[2], r[1], r[0], r[3], 0, 0, 1];
    },
    homography(ms) {
      if (ms.length === 4) { const H = Hm().homography(ms.map((m) => m.p), ms.map((m) => m.q)); return H; }
      const N = Array.from({ length: 8 }, () => new Array(8).fill(0)), v = new Array(8).fill(0);
      const addRow = (r, t) => { for (let i = 0; i < 8; i++) { v[i] += r[i] * t; for (let j = 0; j < 8; j++) N[i][j] += r[i] * r[j]; } };
      ms.forEach(({ p, q }) => { addRow([p.x, p.y, 1, 0, 0, 0, -q.x * p.x, -q.x * p.y], q.x); addRow([0, 0, 0, p.x, p.y, 1, -q.y * p.x, -q.y * p.y], q.y); });
      const h = Hm().solve(N, v); return h ? [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1] : null;
    }
  };
  const NEED = { translate: 1, similarity: 2, homography: 4 };
  function ransac(ms, kind, thr, iters) {
    const n = NEED[kind]; if (ms.length < n + 2) return null;
    let best = null, bestIn = [];
    let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let it = 0; it < iters; it++) {
      const smp = new Set(); while (smp.size < n) smp.add(Math.floor(rnd() * ms.length));
      const H = FIT[kind]([...smp].map((i) => ms[i])); if (!H || H.some((x) => !isFinite(x))) continue;
      if (kind !== 'translate') { const det = H[0] * H[4] - H[1] * H[3]; if (det < 0.2 || det > 5) continue; }
      const inl = ms.filter((m) => { const r = Hm().apply(H, m.p.x, m.p.y); return Math.hypot(r.x - m.q.x, r.y - m.q.y) < thr; });
      if (inl.length > bestIn.length) { bestIn = inl; best = H; }
    }
    if (!best || bestIn.length < Math.max(n + 2, 6)) return null;
    const H = FIT[kind](bestIn) || best;
    return { H, inliers: bestIn.length };
  }
  function warpLayer(doc, L, H) {
    if (L.type !== 'raster') Layers.rasterize(doc, L);
    if (Hm().isAffine(H)) {
      if (Math.abs(H[0] - 1) < 1e-6 && Math.abs(H[4] - 1) < 1e-6 && Math.abs(H[1]) < 1e-6 && Math.abs(H[3]) < 1e-6) { L.translate(Math.round(H[2]), Math.round(H[5])); return; }
      IMG.xfSurface(L, H, false); if (L.mask) IMG.xfSurface(L.mask, H, true);
    } else {
      const Hi = Hm().invert(H), w = L.canvas.width, h = L.canvas.height;
      const pts = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => Hm().apply(H, L.x + x, L.y + y));
      let R = { x: Math.floor(Math.min(...pts.map((p) => p.x))), y: Math.floor(Math.min(...pts.map((p) => p.y))) };
      R.w = Math.ceil(Math.max(...pts.map((p) => p.x))) - R.x; R.h = Math.ceil(Math.max(...pts.map((p) => p.y))) - R.y;
      R = U.rectIntersect(R, U.rectInflate(doc.rect, Math.max(doc.width, doc.height))) || doc.rect;
      L.setCanvas(IMG.renderProjective(L.canvas, L.x, L.y, Hi, R, 'bilinear'), R.x, R.y);
      if (L.mask) { const m = L.mask, c = IMG.renderProjective(m.canvas, m.x, m.y, Hi, R, 'bilinear'); m.canvas = c; m.x = R.x; m.y = R.y; m._snap = null; IMG.markDirty(m); }
    }
    IMG.Effects.invalidate(L);
  }
  /** Alinha as camadas selecionadas à de referência. mode: auto | perspective | collage | reposition */
  function autoAlign(doc, mode) {
    const sel = Layers.selectedLayers(doc).filter((L) => L.type === 'raster' || L.type === 'text' || L.type === 'shape' || L.type === 'smart');
    if (sel.length < 2) { IMG.UI.toast('Selecione duas ou mais camadas.'); return 0; }
    const s = Math.min(1, 720 / Math.max(doc.width, doc.height));
    const kind = mode === 'reposition' ? 'translate' : mode === 'collage' ? 'similarity' : 'homography';
    const ref = sel.find((L) => L.isBg) || sel[0];
    const ri = grayOf(ref, doc, s), rd = describe(ri, corners(ri), kind === 'similarity');
    let ok = 0;
    for (const L of sel) {
      if (L === ref || L.lockPos || Layers.isLocked(L)) continue;
      const im = grayOf(L, doc, s), ds = describe(im, corners(im), kind === 'similarity');
      const ms = match(ds, rd);
      let r = ransac(ms, kind, 2.5, kind === 'translate' ? 200 : kind === 'similarity' ? 600 : 1500);
      if (!r && kind === 'homography') r = ransac(ms, 'similarity', 2.5, 600);
      if (!r) continue;
      const H = r.H.slice(); H[2] /= s; H[5] /= s; H[6] *= s; H[7] *= s;
      warpLayer(doc, L, H); ok++;
    }
    bus.emit('layers:change', doc); IMG.Engine.invalidate();
    if (ok) IMG.commit('Alinhar camadas automaticamente');
    IMG.UI.toast(ok ? ok + (ok > 1 ? ' camadas alinhadas.' : ' camada alinhada.') : 'Não foi possível encontrar pontos em comum entre as camadas.');
    return ok;
  }
  IMG.autoAlign = autoAlign;

  /* ==================================================================
     MESCLAR CAMADAS AUTOMATICAMENTE (panorama / empilhar imagens)
     ================================================================== */
  function autoBlend(doc, mode) {
    const sel = Layers.selectedLayers(doc).filter((L) => L.type === 'raster' || L.type === 'smart' || L.type === 'text' || L.type === 'shape');
    if (sel.length < 2) { IMG.UI.toast('Selecione duas ou mais camadas.'); return false; }
    const done = IMG.UI.busy ? IMG.UI.busy('Mesclando camadas…') : null;
    try {
      const s = Math.min(1, Math.sqrt(3e6 / (doc.width * doc.height)));
      const ims = sel.map((L) => grayOf(L, doc, s)), W = ims[0].W, H = ims[0].H, N = W * H;
      const score = ims.map((im) => {
        const sc = new Float32Array(N);
        if (mode === 'stack') {
          const lap = new Float32Array(N), g = im.g;
          for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; lap[i] = Math.abs(4 * g[i] - g[i - 1] - g[i + 1] - g[i - W] - g[i + W]); }
          const b = boxBlur(lap, W, H, Math.max(2, Math.round(4 * s)));
          for (let i = 0; i < N; i++) sc[i] = im.a[i] > 0.5 ? b[i] : -1;
        } else {
          const ins = new Uint8Array(N); for (let i = 0; i < N; i++) ins[i] = im.a[i] > 0.5 ? 1 : 0;
          const out = new Uint8Array(N); for (let i = 0; i < N; i++) out[i] = 1 - ins[i];
          const d = IMG.Effects.edt(out, W, H); // distância até a borda transparente
          for (let i = 0; i < N; i++) sc[i] = ins[i] ? d[i] : -1;
        }
        return sc;
      });
      // escolha do melhor por pixel e suavização das transições
      const w = sel.map(() => new Float32Array(N));
      for (let i = 0; i < N; i++) { let bi = -1, bv = -0.5; for (let k = 0; k < sel.length; k++) if (score[k][i] > bv) { bv = score[k][i]; bi = k; } if (bi >= 0) w[bi][i] = 1; }
      const r = Math.max(1, Math.round((mode === 'stack' ? 2 : 6) * Math.max(0.5, s)));
      const ws = w.map((a, k) => { const b = boxBlur(a, W, H, r); for (let i = 0; i < N; i++) if (ims[k].a[i] < 0.5) b[i] = 0; return b; });
      for (let i = 0; i < N; i++) { let t = 0; for (let k = 0; k < sel.length; k++) t += ws[k][i]; if (t > 0) for (let k = 0; k < sel.length; k++) ws[k][i] /= t; }
      // pesos → máscaras de sobreposição (de cima para baixo)
      const order = sel.map((L, k) => ({ L, k }));
      const flat = []; Layers.walk(doc.layers, (q) => flat.push(q));
      order.sort((p, q) => flat.indexOf(q.L) - flat.indexOf(p.L)); // topo primeiro
      const rem = new Float32Array(N).fill(1);
      order.forEach(({ L, k }, idx) => {
        const img = new ImageData(W, H), d = img.data;
        for (let i = 0; i < N; i++) { const m = idx === order.length - 1 ? (rem[i] > 1e-4 || ws[k][i] > 0 ? 1 : 0) : rem[i] > 1e-4 ? U.clamp(ws[k][i] / rem[i], 0, 1) : 0; rem[i] -= ws[k][i]; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = Math.round(m * 255); }
        const small = U.createCanvas(W, H); small.getContext('2d').putImageData(img, 0, 0);
        const c = U.createCanvas(doc.width, doc.height), cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(small, 0, 0, doc.width, doc.height);
        if (L.type !== 'raster') Layers.rasterize(doc, L);
        if (L.isBg) Layers.fromBackground(doc, L);
        L.mask = Layers.makeMask(c, 0, 0, 0);
        IMG.Effects.invalidate(L);
      });
    } finally { if (done) done(); }
    bus.emit('layers:change', doc); IMG.Engine.invalidate();
    IMG.commit('Mesclar camadas automaticamente');
    return true;
  }
  IMG.autoBlend = autoBlend;

  IMG.onInit.push((C, H) => {
    const two = () => !!(H.has() && Layers.selectedLayers(H.doc()).length > 1);
    C('edit.autoAlign', 'Alinhar camadas automaticamente…', () => {
      const UI = IMG.UI; let mode = 'auto';
      const opts = [['auto', 'Automático (perspectiva)'], ['collage', 'Colagem (girar e redimensionar)'], ['reposition', 'Reposicionar (só mover)']];
      const box = el('div.radio-list');
      opts.forEach(([v, label]) => { const r = el('label.radio', el('input', { type: 'radio', name: 'aa', value: v }), el('span', { text: label })); r.firstChild.checked = v === mode; r.firstChild.addEventListener('change', () => { mode = v; }); box.appendChild(r); });
      UI.dialog({ title: 'Alinhar camadas automaticamente', width: 380, body: [el('h3.form-title', { text: 'Projeção' }), box, el('p.dialog-note', { text: 'A camada de referência é o Fundo (ou a camada mais abaixo da seleção). As demais são deformadas para coincidir com ela.' })],
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => { setTimeout(() => autoAlign(H.doc(), mode === 'auto' ? 'perspective' : mode), 30); } }] });
    }, { enabled: two });
    C('edit.autoBlend', 'Mesclar camadas automaticamente…', () => {
      const UI = IMG.UI; let mode = 'panorama';
      const box = el('div.radio-list');
      [['panorama', 'Panorama'], ['stack', 'Empilhar imagens (foco)']].forEach(([v, label]) => { const r = el('label.radio', el('input', { type: 'radio', name: 'ab', value: v }), el('span', { text: label })); r.firstChild.checked = v === mode; r.firstChild.addEventListener('change', () => { mode = v; }); box.appendChild(r); });
      UI.dialog({ title: 'Mesclar camadas automaticamente', width: 380, body: [el('h3.form-title', { text: 'Método de mesclagem' }), box, el('p.dialog-note', { text: 'Cria máscaras de camada que combinam as camadas selecionadas sem emendas visíveis.' })],
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => { setTimeout(() => autoBlend(H.doc(), mode), 30); } }] });
    }, { enabled: two });
  });

  /* ==================================================================
     GERENCIADOR DE PREDEFINIÇÕES
     ================================================================== */
  const PM = {
    brushes: { label: 'Pincéis', list: () => (IMG.Brushes ? (IMG.Brushes.init(), IMG.Brushes.all()) : []), user: (it) => IMG.Brushes.user.includes(it), remove: (it) => { IMG.Brushes.user.splice(IMG.Brushes.user.indexOf(it), 1); }, save: () => { try { U.store.set('userBrushes', IMG.Brushes.user); } catch (e) { /* cota */ } bus.emit('brushes:change'); },
      thumb: (it) => { const c = U.domCanvas(40, 40), x = c.getContext('2d'); x.fillStyle = '#e9ebee'; x.fillRect(0, 0, 40, 40); const tip = IMG.Brushes.tips[it.tip]; if (tip) { x.filter = 'invert(1)'; x.drawImage(tip, 4, 4, 32, 32); x.filter = 'none'; } else { const g = x.createRadialGradient(20, 20, 0, 20, 20, 14); g.addColorStop(0, '#000'); g.addColorStop(Math.min(0.99, (it.hardness || 0) / 100), '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(20, 20, 14, 0, Math.PI * 2); x.fill(); } return c; } },
    swatches: { label: 'Amostras', list: () => (IMG.Swatches ? IMG.Swatches.list.map((h) => ({ name: h.toUpperCase(), hex: h })) : []), user: () => true, remove: (it) => { const l = IMG.Swatches.list, i = l.indexOf(it.hex); if (i >= 0) l.splice(i, 1); }, save: () => IMG.Swatches.save(),
      thumb: (it) => { const c = U.domCanvas(40, 40), x = c.getContext('2d'); x.fillStyle = it.hex; x.fillRect(0, 0, 40, 40); return c; }, rename: false },
    gradients: { label: 'Gradientes', list: () => IMG.Gradients.all(), user: (it) => IMG.Gradients.user.includes(it), remove: (it) => { IMG.Gradients.user.splice(IMG.Gradients.user.indexOf(it), 1); }, save: () => IMG.Gradients.saveUser(),
      thumb: (it) => { const c = U.domCanvas(40, 40), x = c.getContext('2d'); x.drawImage(IMG.Gradients.preview(it, 40, 40), 0, 0); return c; } },
    patterns: { label: 'Padrões', list: () => IMG.Patterns.all(), user: (it) => !it.builtin, remove: (it) => { const l = IMG.Patterns.list; l.splice(l.indexOf(it), 1); }, save: () => bus.emit('patterns:change'),
      thumb: (it) => { const c = U.domCanvas(40, 40); c.getContext('2d').drawImage(IMG.Patterns.preview(it.id, 40, 40), 0, 0); return c; } },
    styles: { label: 'Estilos', list: () => Styles.all(), user: (it) => Styles.user.includes(it), remove: (it) => { Styles.user.splice(Styles.user.indexOf(it), 1); }, save: () => Styles.save(), thumb: (it) => { const c = U.domCanvas(40, 40); c.getContext('2d').drawImage(Styles.thumb(it), 0, 0, 40, 40); return c; } },
    shapes: { label: 'Formas personalizadas', list: () => (IMG.Shapes ? IMG.Shapes.customAll() : []), user: (it) => IMG.Shapes.userCustom.includes(it), remove: (it) => { IMG.Shapes.userCustom.splice(IMG.Shapes.userCustom.indexOf(it), 1); }, save: () => U.store.set('customShapes', IMG.Shapes.userCustom),
      thumb: (it) => { const c = U.domCanvas(40, 40), x = c.getContext('2d'); x.fillStyle = '#e9ebee'; x.fillRect(0, 0, 40, 40); try { const p = new Path2D(it.d); x.save(); x.translate(5, 5); x.scale(30 / 100, 30 / 100); x.fillStyle = '#2b2d31'; x.fill(p); x.restore(); } catch (e) { /* ignore */ } return c; } },
    tools: { label: 'Predefinições de ferramenta', list: () => (IMG.ToolPresets ? IMG.ToolPresets.list : []), user: () => true, remove: (it) => { const l = IMG.ToolPresets.list; l.splice(l.indexOf(it), 1); }, save: () => IMG.ToolPresets.save(),
      thumb: (it) => { const c = U.domCanvas(40, 40), x = c.getContext('2d'); x.fillStyle = '#2b2d31'; x.fillRect(0, 0, 40, 40); const def = IMG.Tools.defs[it.tool]; if (def) { const im = new Image(); im.onload = () => x.drawImage(im, 8, 8, 24, 24); im.src = 'data:image/svg+xml,' + encodeURIComponent(IMG.icon(def.icon, 24).replace('<svg', '<svg color="#d6d9de"')); } return c; } }
  };
  function presetManager() {
    const UI = IMG.UI;
    let kind = 'brushes', sel = new Set();
    const grid = el('div.pm-grid');
    const render = () => {
      U.clear(grid); sel = new Set();
      const A = PM[kind];
      A.list().forEach((it, i) => {
        const b = el('button.pm-item' + (A.user(it) ? '' : '.builtin'), { type: 'button', title: (it.name || '') + (A.user(it) ? '' : ' (padrão)') });
        b.append(A.thumb(it), el('span', { text: it.name || '—' }));
        b.addEventListener('click', (e) => { if (!A.user(it)) return; if (!e.shiftKey && !e.ctrlKey) { sel.clear(); grid.querySelectorAll('.pm-item.on').forEach((q) => q.classList.remove('on')); } if (sel.has(it)) { sel.delete(it); b.classList.remove('on'); } else { sel.add(it); b.classList.add('on'); } });
        b.addEventListener('dblclick', () => { if (!A.user(it) || A.rename === false) return; UI.prompt('Renomear predefinição', 'Nome', it.name).then((v) => { if (v) { it.name = v; A.save(); render(); } }); });
        void i;
        grid.appendChild(b);
      });
      if (!grid.childNodes.length) grid.appendChild(el('div.panel-empty.wide', { text: 'Nenhuma predefinição.' }));
    };
    const exportSet = () => {
      const A = PM[kind], items = A.list().filter((it) => A.user(it));
      if (!items.length) { UI.toast('Não há predefinições personalizadas para exportar.'); return; }
      const data = items.map((it) => (kind === 'patterns' ? { name: it.name, data: it.canvas.toDataURL ? it.canvas.toDataURL() : (() => { const c = U.domCanvas(it.canvas.width, it.canvas.height); c.getContext('2d').drawImage(it.canvas, 0, 0); return c.toDataURL(); })() } : it));
      U.download(new Blob([JSON.stringify({ imaginariumPresets: kind, items: data }, null, 1)], { type: 'application/json' }), 'predefinicoes-' + kind + '.json');
    };
    const importSet = () => {
      const inp = el('input', { type: 'file', accept: '.json,application/json' });
      inp.addEventListener('change', async () => {
        const f = inp.files[0]; if (!f) return;
        try {
          const j = JSON.parse(await f.text()); const k = j.imaginariumPresets; if (!PM[k]) throw new Error('arquivo não reconhecido');
          const items = j.items || [];
          if (k === 'brushes') { IMG.Brushes.init(); items.forEach((b) => { if (b.data) U.loadImage(b.data).then((im) => { const c = U.createCanvas(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); IMG.Brushes.tips[b.tip] = c; }); IMG.Brushes.user.push(b); }); }
          else if (k === 'swatches') { items.forEach((s) => { if (s.hex && !IMG.Swatches.list.includes(s.hex)) IMG.Swatches.list.push(s.hex); }); }
          else if (k === 'gradients') items.forEach((g) => IMG.Gradients.user.push(g));
          else if (k === 'patterns') for (const p of items) { const im = await U.loadImage(p.data); const c = U.createCanvas(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); IMG.Patterns.add(c, p.name); }
          else if (k === 'styles') items.forEach((s) => Styles.user.push(Object.assign({}, s, { id: U.uid('sty') })));
          else if (k === 'shapes') items.forEach((s) => IMG.Shapes.userCustom.push(Object.assign({}, s, { id: U.uid('cs') })));
          else if (k === 'tools') items.forEach((t) => IMG.ToolPresets.list.push(t));
          PM[k].save(); kind = k; kindSel.set ? kindSel.set(k) : null; render(); UI.toast(items.length + ' predefinições importadas.');
        } catch (err) { UI.toast('Falha ao importar: ' + err.message, 'error'); }
      });
      inp.click();
    };
    const kindSel = UI.select(Object.keys(PM).map((k) => [k, PM[k].label]), kind, (v) => { kind = v; render(); }, { width: 220, keepFocus: true });
    const del = () => { const A = PM[kind]; if (!sel.size) { UI.toast('Selecione predefinições personalizadas (as padrão não podem ser excluídas).'); return; } sel.forEach((it) => A.remove(it)); A.save(); render(); };
    const ren = () => { const A = PM[kind], it = [...sel][0]; if (!it || A.rename === false) return; UI.prompt('Renomear predefinição', 'Nome', it.name).then((v) => { if (v) { it.name = v; A.save(); render(); } }); };
    UI.dialog({ title: 'Gerenciador de predefinições', width: 620, className: 'pm-dialog',
      body: [el('div.pm-top', el('span', { text: 'Tipo:' }), kindSel.el, el('span.pgroup-fill'), UI.btn('Renomear…', ren, { small: true }), UI.btn('Excluir', del, { small: true }), UI.btn('Importar…', importSet, { small: true }), UI.btn('Exportar…', exportSet, { small: true })), grid, el('p.dialog-note', { text: 'Clique para selecionar (Shift/Ctrl: vários) · duplo clique: renomear. As predefinições padrão não podem ser excluídas.' })],
      buttons: [{ label: 'Concluído', primary: true }] });
    render();
  }
  IMG.presetManager = presetManager;
  IMG.onInit.push((C) => { C('edit.presets', 'Gerenciador de predefinições…', presetManager); });
})();

/* Camada › Duplicar em… (copia as camadas selecionadas para outro documento aberto, como no Photopea) */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus;
  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, H) => {
    C('layer.duplicateInto', 'Duplicar em…', () => {
      const src = H.doc(), UI = IMG.UI, Layers = IMG.Layers;
      const sel = Layers.selectedLayers(src); if (!sel.length) return;
      const others = IMG.app.docs.filter((d) => d !== src);
      let target = others.length ? String(IMG.app.docs.indexOf(others[0])) : 'new';
      const opts = others.map((d) => [String(IMG.app.docs.indexOf(d)), d.name]).concat([['new', 'Novo documento']]);
      UI.dialog({ title: 'Duplicar em', width: 360, body: [UI.row('Documento', UI.select(opts, target, (v) => { target = v; }, { keepFocus: true, width: 200 }).el)],
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
          let D = target === 'new' ? null : IMG.app.docs[+target];
          if (!D) D = IMG.Files.create({ name: (sel[sel.length - 1].name || 'Camada'), width: src.width, height: src.height, background: null });
          const clones = sel.map((L) => { const c = Layers.clone(L, ''); c.parent = null; c.isBg = false; return c; });
          D.layers.push(...clones);
          D.selected = new Set(clones.map((c) => c.id)); D.activeId = clones[clones.length - 1].id;
          IMG.app.setDoc(D);
          bus.emit('layers:change', D); IMG.Engine.invalidate(); IMG.commit('Duplicar camada');
        } }] });
    }, { enabled: H.hasLayer });
  });
})();
