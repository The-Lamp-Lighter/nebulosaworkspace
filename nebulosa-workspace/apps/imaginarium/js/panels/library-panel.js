/* ==========================================================================
   Imaginarium — painel Biblioteca de Recursos
   Tudo é gerado localmente (sem arquivos externos): formas vetoriais,
   gradientes e texturas procedurais. "Meus recursos" guarda imagens do
   usuário no próprio navegador (IndexedDB).
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const Layers = IMG.Layers;

  /* ---------- formas ---------- */
  const V = (d, rule) => ({ kind: 'svg', svg: { d, vw: 100, vh: 100 }, rule });
  const SHAPES = [
    ['Coração', V('M50 88 C20 66 6 48 6 30 C6 16 17 6 30 6 C39 6 46 11 50 18 C54 11 61 6 70 6 C83 6 94 16 94 30 C94 48 80 66 50 88 Z')],
    ['Seta', V('M4 38 H58 V16 L96 50 L58 84 V62 H4 Z')],
    ['Seta dupla', V('M2 50 L30 20 V38 H70 V20 L98 50 L70 80 V62 H30 V80 Z')],
    ['Balão de fala', V('M14 8 H86 C92 8 96 12 96 18 V60 C96 66 92 70 86 70 H46 L24 92 V70 H14 C8 70 4 66 4 60 V18 C4 12 8 8 14 8 Z')],
    ['Nuvem', V('M28 80 C14 80 4 70 4 58 C4 47 12 38 23 36 C25 22 37 12 51 12 C63 12 73 19 78 30 C89 31 97 40 97 52 C97 67 86 80 72 80 Z')],
    ['Raio', V('M58 2 L16 56 H44 L36 98 L84 40 H54 Z')],
    ['Gota', V('M50 4 C50 4 16 44 16 64 C16 83 31 96 50 96 C69 96 84 83 84 64 C84 44 50 4 50 4 Z')],
    ['Confirmação', V('M6 54 L22 38 L40 56 L78 14 L94 30 L40 90 Z')],
    ['Xis', V('M20 4 L50 34 L80 4 L96 20 L66 50 L96 80 L80 96 L50 66 L20 96 L4 80 L34 50 L4 20 Z')],
    ['Mais', V('M36 4 H64 V36 H96 V64 H64 V96 H36 V64 H4 V36 H36 Z')],
    ['Losango', V('M50 2 L98 50 L50 98 L2 50 Z')],
    ['Triângulo', V('M50 6 L96 92 H4 Z')],
    ['Lua', V('M62 4 C36 8 18 30 20 56 C22 80 42 97 66 96 C78 95 88 90 96 82 C68 86 44 66 44 40 C44 26 50 13 62 4 Z')],
    ['Faixa', V('M2 20 H98 L84 50 L98 80 H2 L16 50 Z')],
    ['Escudo', V('M50 4 L92 18 V48 C92 72 74 90 50 97 C26 90 8 72 8 48 V18 Z')],
    ['Marcador', V('M50 2 C28 2 12 18 12 40 C12 66 50 98 50 98 C50 98 88 66 88 40 C88 18 72 2 50 2 Z M50 26 A14 14 0 1 0 50 54 A14 14 0 1 0 50 26 Z', 'evenodd')],
    ['Anel', V('M50 4 A46 46 0 1 0 50 96 A46 46 0 1 0 50 4 Z M50 27 A23 23 0 1 0 50 73 A23 23 0 1 0 50 27 Z', 'evenodd')],
    ['Explosão', { kind: 'star', points: 14, inner: 72 }],
    ['Estrela de 4 pontas', { kind: 'star', points: 4, inner: 36 }],
    ['Pentágono', { kind: 'polygon', sides: 5 }],
    ['Hexágono', { kind: 'polygon', sides: 6 }],
    ['Octógono', { kind: 'polygon', sides: 8 }],
    ['Cápsula', { kind: 'rect', radius: 9999, ratio: 2.6 }],
    ['Cartão', { kind: 'rect', radius: 28, ratio: 1.5 }]
  ];

  /* ---------- gradientes ---------- */
  const GRADS = [
    ['Espectro Imaginarium', ['#19c6f5', '#4f6bff', '#a244f5', '#f23fb0', '#ff8a2b'], 0],
    ['Aurora', ['#0b1d51', '#1f7a8c', '#7ef0c8'], 90],
    ['Entardecer', ['#2b1055', '#d53369', '#fbb040'], 90],
    ['Oceano', ['#031a3a', '#0b63a8', '#6fd6ff'], 135],
    ['Brasa', ['#1a0500', '#b3261e', '#ffb347'], 45],
    ['Menta', ['#0f3d3e', '#2fa58a', '#d7fbe8'], 135],
    ['Pêssego', ['#ffecd2', '#fcb69f', '#ff8177'], 45],
    ['Uva', ['#1b1035', '#5b2a86', '#c77dff'], 90],
    ['Grafite', ['#16171a', '#4a4e57', '#c9ccd1'], 90],
    ['Céu limpo', ['#2f80ed', '#56ccf2', '#e8f7ff'], 90],
    ['Neon', ['#00f5a0', '#00d9f5', '#7a4dff'], 0],
    ['Meia-noite', ['#05060a', '#141e30', '#243b55'], 135]
  ];
  function paintGradient(ctx, w, h, colors, angle) {
    const a = U.rad(angle), cx = w / 2, cy = h / 2, len = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2;
    const g = ctx.createLinearGradient(cx - Math.cos(a) * len, cy - Math.sin(a) * len, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }

  /* ---------- texturas procedurais ---------- */
  function rng(seed) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const TEX = [
    ['Listras diagonais', (c, w, h, fg, bg, s) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = fg; c.lineWidth = s * 0.5; c.beginPath(); for (let x = -h; x < w + h; x += s * 1.5) { c.moveTo(x, h); c.lineTo(x + h, 0); } c.stroke(); }],
    ['Bolinhas', (c, w, h, fg, bg, s) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; let row = 0; for (let y = s / 2; y < h + s; y += s, row++) for (let x = (row % 2 ? s : s / 2); x < w + s; x += s) { c.beginPath(); c.arc(x, y, s * 0.22, 0, Math.PI * 2); c.fill(); } }],
    ['Xadrez', (c, w, h, fg, bg, s) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; for (let y = 0, j = 0; y < h; y += s, j++) for (let x = j % 2 ? s : 0; x < w; x += s * 2) c.fillRect(x, y, s, s); }],
    ['Grade', (c, w, h, fg, bg, s) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = fg; c.lineWidth = Math.max(1, s * 0.06); c.beginPath(); for (let x = 0; x <= w; x += s) { c.moveTo(x, 0); c.lineTo(x, h); } for (let y = 0; y <= h; y += s) { c.moveTo(0, y); c.lineTo(w, y); } c.stroke(); }],
    ['Ondas', (c, w, h, fg, bg, s) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = fg; c.lineWidth = Math.max(1, s * 0.14); for (let y = 0; y < h + s; y += s * 0.8) { c.beginPath(); for (let x = 0; x <= w + 4; x += 4) { const yy = y + Math.sin((x / s) * 1.6) * s * 0.22; if (x) c.lineTo(x, yy); else c.moveTo(x, yy); } c.stroke(); } }],
    ['Meio-tom', (c, w, h, fg, bg, s) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; const st = s * 0.55; for (let y = 0; y < h + st; y += st) for (let x = 0; x < w + st; x += st) { const r = st * 0.52 * (1 - x / w) * (0.4 + 0.6 * (y / h)); if (r > 0.3) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); } } }],
    ['Confete', (c, w, h, fg, bg, s) => { const r = rng(7), cols = ['#19c6f5', '#4f6bff', '#a244f5', '#f23fb0', '#ff8a2b', '#ffd43b']; const n = Math.round((w * h) / (s * s) * 1.4); for (let i = 0; i < n; i++) { c.save(); c.translate(r() * w, r() * h); c.rotate(r() * Math.PI); c.fillStyle = cols[Math.floor(r() * cols.length)]; const k = s * (0.12 + r() * 0.2); if (r() > 0.5) c.fillRect(-k, -k / 2.4, k * 2, k / 1.2); else { c.beginPath(); c.arc(0, 0, k * 0.6, 0, Math.PI * 2); c.fill(); } c.restore(); } }],
    ['Granulado', (c, w, h, fg, bg) => {
      c.fillStyle = bg; c.fillRect(0, 0, w, h);
      const img = c.getImageData(0, 0, w, h), d = img.data, f = U.hexToRgb(fg), r = rng(11);
      for (let i = 0; i < d.length; i += 4) { const t = r() * 0.55; d[i] += (f.r - d[i]) * t; d[i + 1] += (f.g - d[i + 1]) * t; d[i + 2] += (f.b - d[i + 2]) * t; }
      c.putImageData(img, 0, 0);
    }]
  ];

  /* ---------- "Meus recursos" (IndexedDB, com alternativa em memória) ---------- */
  const Store = {
    items: [], db: null, ready: null,
    open() {
      if (this.ready) return this.ready;
      this.ready = new Promise((res) => {
        try {
          const rq = indexedDB.open('imaginarium-biblioteca', 1);
          rq.onupgradeneeded = () => rq.result.createObjectStore('assets', { keyPath: 'id' });
          rq.onsuccess = () => {
            this.db = rq.result;
            try {
              const all = this.db.transaction('assets').objectStore('assets').getAll();
              all.onsuccess = () => { this.items = (all.result || []).sort((a, b) => a.t - b.t); res(); };
              all.onerror = () => res();
            } catch (e) { res(); }
          };
          rq.onerror = () => res();
        } catch (e) { res(); }
      });
      return this.ready;
    },
    add(item) { this.items.push(item); try { if (this.db) this.db.transaction('assets', 'readwrite').objectStore('assets').put(item); } catch (e) { /* só em memória */ } },
    remove(id) { this.items = this.items.filter((i) => i.id !== id); try { if (this.db) this.db.transaction('assets', 'readwrite').objectStore('assets').delete(id); } catch (e) { /* ignore */ } }
  };

  /* ---------- inserção ---------- */
  function needDoc() { const d = IMG.app.doc; if (!d) IMG.UI.toast('Abra ou crie um documento antes de inserir recursos.'); return d; }

  function insertShape(name, def) {
    const doc = needDoc(); if (!doc) return;
    const S = IMG.Shapes.style, base = Math.round(Math.min(doc.width, doc.height) * 0.36);
    const sh = Object.assign({ cx: doc.width / 2, cy: doc.height / 2, w: base, h: base, rotation: 0, fill: S.fill || IMG.app.fg, stroke: S.stroke, strokeWidth: S.stroke ? S.strokeWidth : 0 }, JSON.parse(JSON.stringify(def)));
    if (def.ratio) { sh.w = Math.round(base * 1.4); sh.h = Math.round(sh.w / def.ratio); sh.radius = Math.min(def.radius, sh.h / 2); }
    delete sh.ratio;
    IMG.Shapes.create(doc, sh, Layers.name(doc, name));
    bus.emit('layers:change', doc);
    IMG.commit('Inserir forma: ' + name);
    IMG.Tools.set('move');
  }

  function insertRaster(name, paint) {
    const doc = needDoc(); if (!doc) return;
    const c = U.createCanvas(doc.width, doc.height);
    paint(c.getContext('2d'), doc.width, doc.height);
    IMG.Selection.clip(doc, c);
    Layers.fromCanvas(doc, c, Layers.name(doc, name), 0, 0);
    bus.emit('layers:change', doc);
    IMG.commit('Inserir: ' + name);
  }

  /* ---------- painel ---------- */
  let root, grid, cat = 'shapes';
  const item = (title, draw, onClick, onMenu) => {
    const cv = U.domCanvas(120, 84); cv.className = 'lib-cv';
    try { draw(cv.getContext('2d'), cv.width, cv.height); } catch (e) { console.error(e); }
    const b = el('button.lib-item', { type: 'button', title }, cv, el('span.lib-name', { text: title }));
    b.addEventListener('click', onClick);
    if (onMenu) b.addEventListener('contextmenu', (e) => { e.preventDefault(); onMenu(e); });
    return b;
  };

  function render() {
    if (!root || !root.isConnected) return;
    U.clear(grid);
    const fg = IMG.app.fg, bg = IMG.app.bg;
    if (cat === 'shapes') {
      SHAPES.forEach(([name, def]) => grid.appendChild(item(name, (c, w, h) => {
        const r = def.ratio || 1, sw = r > 1 ? w * 0.78 : h * 0.72 * 1, sh = r > 1 ? sw / r : h * 0.72;
        const ns = IMG.Shapes.normalize(Object.assign({ cx: w / 2, cy: h / 2, w: r > 1 ? sw : sh, h: sh, rotation: 0, fill: '#c9ccd1', stroke: null }, def, def.radius ? { radius: Math.min(def.radius, sh / 2) } : null));
        IMG.Shapes.draw(c, ns, { x: 0, y: 0, w, h }, IMG.app.doc);
      }, () => insertShape(name, def))));
    } else if (cat === 'gradients') {
      GRADS.forEach(([name, colors, angle]) => grid.appendChild(item(name, (c, w, h) => paintGradient(c, w, h, colors, angle), () => insertRaster(name, (c, w, h) => paintGradient(c, w, h, colors, angle)))));
    } else if (cat === 'textures') {
      TEX.forEach(([name, fn]) => grid.appendChild(item(name, (c, w, h) => fn(c, w, h, fg, bg, 16), () => insertRaster(name, (c, w, h) => fn(c, w, h, IMG.app.fg, IMG.app.bg, Math.max(8, Math.round(Math.max(w, h) / 36)))))));
    } else {
      if (!Store.items.length) grid.appendChild(el('div.panel-empty.wide', { text: 'Nenhum recurso salvo. Use "Importar imagens" para guardar logotipos, texturas e recortes que você usa com frequência.' }));
      Store.items.forEach((it) => {
        const b = item(it.name, () => {}, async () => { const doc = needDoc(); if (doc) await IMG.Files.placeFile(doc, new File([it.blob], it.name + '.png', { type: it.blob.type || 'image/png' })); },
          (e) => IMG.UI.contextMenu(e.clientX, e.clientY, [{ label: 'Remover da biblioteca', run: () => { Store.remove(it.id); render(); } }]));
        const url = URL.createObjectURL(it.blob);
        U.loadImage(url).then((im) => { const cv = U.$('canvas', b), c = cv.getContext('2d'); const k = Math.min(cv.width / im.naturalWidth, cv.height / im.naturalHeight, 1); const w = im.naturalWidth * k, h = im.naturalHeight * k; c.drawImage(im, (cv.width - w) / 2, (cv.height - h) / 2, w, h); }).catch(() => {}).finally(() => URL.revokeObjectURL(url));
        grid.appendChild(b);
      });
    }
  }

  IMG.UI.registerPanel({
    id: 'library', title: 'Biblioteca',
    build(node) {
      root = node;
      const UI = IMG.UI;
      const sel = UI.select([['shapes', 'Formas'], ['gradients', 'Gradientes'], ['textures', 'Texturas'], ['mine', 'Meus recursos']], cat, (v) => { cat = v; if (v === 'mine') Store.open().then(render); else render(); });
      const imp = UI.btn('Importar imagens', async () => {
        const files = await IMG.Files.pick('.png,.jpg,.jpeg,.webp,.svg,.gif,image/*', true);
        if (!files.length) return;
        await Store.open();
        files.forEach((f) => Store.add({ id: U.uid('A'), name: U.baseName(f.name).slice(0, 40), blob: f, t: Date.now() }));
        cat = 'mine'; sel.set('mine'); render();
        UI.toast(files.length + (files.length > 1 ? ' recursos adicionados' : ' recurso adicionado') + ' à biblioteca.');
      }, { small: true, icon: 'plus' });
      grid = el('div.lib-grid');
      root.append(el('div.lib-head', sel.el, imp), grid, el('p.panel-note.lib-note', { text: 'Clique para inserir como nova camada. Formas usam o estilo das ferramentas de forma; texturas usam as cores atuais.' }));
      bus.on('color:change', U.debounce(() => { if (cat === 'textures') render(); }, 200));
      render();
    },
    onShow() { render(); }
  });
})();
