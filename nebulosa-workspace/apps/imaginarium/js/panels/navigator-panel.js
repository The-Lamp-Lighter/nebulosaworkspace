/* ==========================================================================
   Imaginarium — painel Navegador
   Miniatura do documento com o retângulo da área visível; arraste para
   percorrer a imagem e use o controle para ajustar o zoom.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  let root, cv, zoomCtl, thumb = null, geo = null;

  function layout() {
    const doc = IMG.app.doc;
    const box = cv.parentElement;
    const W = Math.max(60, box.clientWidth), H = Math.max(60, box.clientHeight);
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    if (!doc) { geo = null; return; }
    const k = Math.min((W - 12) / doc.width, (H - 12) / doc.height);
    geo = { k, w: doc.width * k, h: doc.height * k, x: (W - doc.width * k) / 2, y: (H - doc.height * k) / 2, W, H, dpr };
  }

  function buildThumb() {
    const doc = IMG.app.doc;
    if (!doc || !geo) { thumb = null; return; }
    const w = Math.max(1, Math.round(geo.w * geo.dpr)), h = Math.max(1, Math.round(geo.h * geo.dpr));
    thumb = U.domCanvas(w, h);
    const c = thumb.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#d7d7d7';
    for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < w; x += 16) c.fillRect(x, y, 8, 8);
    c.drawImage(IMG.Engine.composite(doc), 0, 0, w, h);
  }
  const rebuild = U.debounce(() => { if (!root || !root.isConnected) return; layout(); buildThumb(); draw(); }, 160);

  function draw() {
    if (!root || !root.isConnected) return;
    const doc = IMG.app.doc, c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    if (!doc || !geo) return;
    const g = geo;
    c.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    if (thumb) c.drawImage(thumb, g.x, g.y, g.w, g.h);
    const v = doc.view, E = IMG.Engine;
    const rx = g.x + (-v.x / v.zoom) * g.k, ry = g.y + (-v.y / v.zoom) * g.k, rw = (E.w / v.zoom) * g.k, rh = (E.h / v.zoom) * g.k;
    c.save();
    c.beginPath(); c.rect(g.x, g.y, g.w, g.h); c.rect(rx, ry, rw, rh);
    c.fillStyle = 'rgba(12,13,15,.5)'; c.fill('evenodd');
    c.restore();
    c.strokeStyle = '#ff4d6d'; c.lineWidth = 1.5;
    c.strokeRect(Math.round(rx) + 0.5, Math.round(ry) + 0.5, Math.round(rw), Math.round(rh));
    if (zoomCtl) zoomCtl.set(U.round(v.zoom * 100, v.zoom < 0.1 ? 1 : 0));
  }

  IMG.UI.registerPanel({
    id: 'navigator', title: 'Navegador',
    build(node) {
      root = node;
      const UI = IMG.UI, E = IMG.Engine;
      cv = U.domCanvas(200, 120); cv.className = 'nav-cv';
      const go = (ev) => {
        const doc = IMG.app.doc; if (!doc || !geo) return;
        const r = cv.getBoundingClientRect();
        E.centerOn((ev.clientX - r.left - geo.x) / geo.k, (ev.clientY - r.top - geo.y) / geo.k);
      };
      cv.addEventListener('pointerdown', (e) => { go(e); U.drag(e, go); });
      cv.addEventListener('wheel', (e) => { e.preventDefault(); E.zoomStep(e.deltaY < 0 ? 1 : -1); }, { passive: false });
      zoomCtl = UI.slider({ value: 100, min: 1, max: 6400, step: 1, unit: '%', pow: 4, numWidth: 64, onInput: (v) => { if (IMG.app.doc) E.zoomTo(v / 100, null, null, false); } });
      const bar = el('div.panel-foot.nav-foot', UI.iconBtn('zoomOut', 'Reduzir', () => E.zoomStep(-1)), zoomCtl.el, UI.iconBtn('zoomIn', 'Ampliar', () => E.zoomStep(1)), UI.iconBtn('fit', 'Ajustar à janela', () => E.fit()));
      root.append(el('div.nav-box', cv), bar);
      bus.on('view:change', draw);
      ['layers:change', 'layer:pixels', 'doc:change', 'doc:resize', 'history:change', 'dock:resize', 'dock:change'].forEach((ev) => bus.on(ev, rebuild));
      window.addEventListener('resize', rebuild);
      rebuild();
    },
    onShow() { rebuild(); }
  });
})();
