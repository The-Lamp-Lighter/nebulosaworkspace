/* ==========================================================================
   Imaginarium — Filtro › Ponto de fuga (Alt+Ctrl+V)
   Planos em perspectiva com proporção real estimada (calibração pelo
   retângulo em perspectiva), letreiro, carimbo e pincel em perspectiva,
   colar imagens que se ajustam ao plano. Resultado na camada atual ou em
   uma camada nova.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const Hm = () => IMG.Homography;

  /* ---------- geometria ---------- */
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  /** Proporção largura/altura do retângulo real visto em perspectiva (Zhang & He). p: [tl, tr, br, bl]. */
  function aspect(p, u0, v0) {
    const m1 = [p[0].x, p[0].y, 1], m2 = [p[1].x, p[1].y, 1], m3 = [p[3].x, p[3].y, 1], m4 = [p[2].x, p[2].y, 1];
    const fallback = () => ((Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) + Math.hypot(p[2].x - p[3].x, p[2].y - p[3].y)) / 2) / Math.max(1, (Math.hypot(p[3].x - p[0].x, p[3].y - p[0].y) + Math.hypot(p[2].x - p[1].x, p[2].y - p[1].y)) / 2);
    const k2 = dot3(cross3(m1, m4), m3) / dot3(cross3(m2, m4), m3), k3 = dot3(cross3(m1, m4), m2) / dot3(cross3(m3, m4), m2);
    const n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]], n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];
    if (!isFinite(k2) || !isFinite(k3)) return fallback();
    // distância focal: estimada pelos dois pontos de fuga; se um deles está no infinito, assume uma lente normal
    const diag = Math.hypot(u0 * 2, v0 * 2);
    let f = NaN;
    const nz = Math.min(Math.abs(n2[2]) / (Math.hypot(n2[0], n2[1]) || 1), Math.abs(n3[2]) / (Math.hypot(n3[0], n3[1]) || 1));
    if (nz > 1e-5) {
      const f2 = -((n2[0] * n3[0] - (n2[0] * n3[2] + n2[2] * n3[0]) * u0 + n2[2] * n3[2] * u0 * u0) + (n2[1] * n3[1] - (n2[1] * n3[2] + n2[2] * n3[1]) * v0 + n2[2] * n3[2] * v0 * v0)) / (n2[2] * n3[2]);
      if (f2 > 0) f = Math.sqrt(f2);
    }
    if (!(f > diag * 0.15 && f < diag * 8)) f = diag;
    const q = (n) => { const a = (n[0] - u0 * n[2]) / f, b = (n[1] - v0 * n[2]) / f; return a * a + b * b + n[2] * n[2]; };
    const r = Math.sqrt(q(n2) / q(n3));
    return isFinite(r) && r > 0.02 && r < 50 ? r : fallback();
  }
  function convex(p) {
    let s = 0;
    for (let i = 0; i < 4; i++) { const a = p[i], b = p[(i + 1) % 4], c = p[(i + 2) % 4]; const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x); if (Math.abs(z) < 1e-6) return false; if (!s) s = Math.sign(z); else if (Math.sign(z) !== s) return false; }
    return true;
  }
  function planeInfo(pl, doc) {
    if (pl._info && pl._key === JSON.stringify(pl.pts)) return pl._info;
    const p = pl.pts, ok = convex(p);
    const r = ok ? aspect(p, doc.width / 2, doc.height / 2) : 1;
    const PH = Math.max(1, (Math.hypot(p[3].x - p[0].x, p[3].y - p[0].y) + Math.hypot(p[2].x - p[1].x, p[2].y - p[1].y)) / 2), PW = PH * r;
    const H = Hm().homography([{ x: 0, y: 0 }, { x: PW, y: 0 }, { x: PW, y: PH }, { x: 0, y: PH }], p);
    pl._info = { ok, H, Hi: Hm().invert(H), PW, PH }; pl._key = JSON.stringify(p);
    return pl._info;
  }
  const inPlane = (info, x, y) => { const q = Hm().apply(info.Hi, x, y); return q.x >= 0 && q.y >= 0 && q.x <= info.PW && q.y <= info.PH ? q : null; };
  /** Escala local (px do documento por unidade do plano). */
  const localScale = (info, u, v) => { const a = Hm().apply(info.H, u, v), b = Hm().apply(info.H, u + 1, v), c = Hm().apply(info.H, u, v + 1); return Math.sqrt(Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))); };

  /* ---------- amostragem ---------- */
  function sampler(canvas) {
    const W = canvas.width, H = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, W, H).data;
    return (x, y, out) => {
      x -= 0.5; y -= 0.5;
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < 4; k++) {
        const xx = x0 + (k & 1), yy = y0 + (k >> 1);
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const w = ((k & 1) ? fx : 1 - fx) * ((k >> 1) ? fy : 1 - fy), i = (yy * W + xx) * 4, al = d[i + 3] * w;
        r += d[i] * al; g += d[i + 1] * al; b += d[i + 2] * al; a += al;
      }
      if (a > 0) { out[0] = r / a; out[1] = g / a; out[2] = b / a; out[3] = a; } else { out[0] = out[1] = out[2] = out[3] = 0; }
      return out;
    };
  }

  /* ==================================================================
     DIÁLOGO
     ================================================================== */
  function open() {
    const doc = IMG.app.doc, UI = IMG.UI;
    if (!doc) return;
    const L0 = doc.active;
    const st = {
      tool: (doc.vpPlanes || []).length ? 'edit' : 'create',
      planes: IMG.jclone(doc.vpPlanes || []).map((p) => ({ pts: p.pts, grid: p.grid || 8 })),
      act: 0, creating: [], sel: null, float: null, src: null, stampOff: null,
      size: 60, hard: 50, opacity: 100, color: IMG.app.fg, gridOn: true, sampleAll: !(L0 && L0.type === 'raster'), heal: 'off', z: 1, ox: 0, oy: 0, hist: [], cursor: null, dirty: true
    };
    // superfícies
    const below = L0 && L0.type === 'raster' && !st.sampleAll ? IMG.Engine.compositeBelow(doc, L0, false) : null;
    const orig = U.createCanvas(doc.width, doc.height);
    if (st.sampleAll || !L0 || L0.type !== 'raster') orig.getContext('2d').drawImage(IMG.Engine.flatten(doc), 0, 0);
    else orig.getContext('2d').drawImage(L0.canvas, L0.x, L0.y);
    const work = U.cloneCanvas(orig), wx = work.getContext('2d');
    const snapshot = () => { st.hist.push(wx.getImageData(0, 0, doc.width, doc.height)); if (st.hist.length > 20) st.hist.shift(); };
    let samp = null; const refreshSampler = () => { samp = sampler(work); };
    refreshSampler();

    // interface
    const view = el('canvas.vp-canvas'), vx = view.getContext('2d');
    const tools = [['edit', 'Editar plano (V)', 'move'], ['create', 'Criar plano (C)', 'perspCrop'], ['marquee', 'Letreiro (M)', 'marqueeRect'], ['stamp', 'Carimbo (S)', 'stamp'], ['brush', 'Pincel (B)', 'brush'], ['hand', 'Mão (H)', 'hand']];
    const bar = el('div.vp-tools');
    const toolBtns = {};
    tools.forEach(([id, title, icon]) => { const b = el('button.tool-btn', { type: 'button', title, html: IMG.icon(icon, 18) }); b.addEventListener('click', () => setTool(id)); toolBtns[id] = b; bar.appendChild(b); });
    const opts = el('div.vp-opts');
    const hint = el('div.vp-hint');
    const setTool = (id) => { st.tool = id; Object.keys(toolBtns).forEach((k) => toolBtns[k].classList.toggle('active', k === id)); renderOpts(); dirty(); };
    const renderOpts = () => {
      U.clear(opts);
      const t = st.tool;
      if (t === 'edit' || t === 'create') {
        const pl = st.planes[st.act];
        opts.appendChild(UI.row('Grade', UI.num({ value: pl ? pl.grid : 8, min: 1, max: 100, width: 70, onInput: (v) => { if (st.planes[st.act]) { st.planes[st.act].grid = v; dirty(); } } }).el));
        opts.appendChild(UI.check('Mostrar grade', st.gridOn, (v) => { st.gridOn = v; dirty(); }).el);
        opts.appendChild(UI.btn('Excluir plano', () => { if (st.planes.length) { st.planes.splice(st.act, 1); st.act = Math.max(0, st.act - 1); dirty(); } }, { small: true }));
        hint.textContent = t === 'create' ? 'Clique nos 4 cantos de uma superfície retangular (em sequência). Ctrl+arraste o meio de uma aresta para criar um plano vizinho.' : 'Arraste os cantos para ajustar; arraste dentro para mover o plano; Ctrl+arraste o meio de uma aresta para estender um novo plano.';
      } else if (t === 'marquee') {
        opts.appendChild(UI.btn('Desmarcar', () => { st.sel = null; dirty(); }, { small: true }));
        hint.textContent = 'Arraste dentro de um plano para selecionar. Alt+arraste a seleção para duplicar o conteúdo em perspectiva; arraste para mover a seleção.';
      } else if (t === 'stamp' || t === 'brush') {
        opts.appendChild(UI.row('Diâmetro', UI.num({ value: st.size, min: 1, max: 2000, unit: 'px', width: 80, onInput: (v) => { st.size = v; } }).el));
        opts.appendChild(UI.row('Dureza', UI.num({ value: st.hard, min: 0, max: 100, unit: '%', width: 70, onInput: (v) => { st.hard = v; } }).el));
        opts.appendChild(UI.row('Opacidade', UI.num({ value: st.opacity, min: 1, max: 100, unit: '%', width: 70, onInput: (v) => { st.opacity = v; } }).el));
        if (t === 'brush') opts.appendChild(UI.row('Cor', UI.colorBtn(st.color, (h) => { if (h) st.color = h; }).el));
        hint.textContent = t === 'stamp' ? 'Alt+clique para definir a origem; depois pinte: a cópia segue a perspectiva dos planos.' : 'Pinte com o pincel em perspectiva (o tamanho muda com a profundidade do plano).';
      } else hint.textContent = 'Arraste para mover a vista. Roda do mouse: zoom.';
      opts.appendChild(el('span.pgroup-fill'));
      opts.appendChild(UI.btn('Colar imagem', () => pasteFloat(), { small: true, title: 'Cola a imagem copiada (Ctrl+C) ou a camada escolhida' }));
      opts.appendChild(UI.btn('Desfazer', () => undo(), { small: true }));
    };
    const outSel = UI.select([['new', 'Resultado em nova camada'], ['layer', 'Aplicar na camada atual']], st.sampleAll ? 'new' : 'new', () => {}, { width: 230, keepFocus: true });
    const wrap = el('div.vp-wrap', bar, el('div.vp-main', opts, el('div.vp-view', view), hint));
    let dlg;

    /* ---------- vista ---------- */
    const fit = () => { const r = view.getBoundingClientRect(); st.z = Math.min(r.width / doc.width, r.height / doc.height) * 0.95; st.ox = (r.width - doc.width * st.z) / 2; st.oy = (r.height - doc.height * st.z) / 2; };
    const s2d = (e) => { const r = view.getBoundingClientRect(); return { x: (e.clientX - r.left - st.ox) / st.z, y: (e.clientY - r.top - st.oy) / st.z, sx: e.clientX - r.left, sy: e.clientY - r.top }; };
    const d2s = (p) => ({ x: st.ox + p.x * st.z, y: st.oy + p.y * st.z });
    let raf = 0;
    const dirty = () => { if (!raf) raf = requestAnimationFrame(draw); };
    function draw() {
      raf = 0;
      const r = view.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      if (view.width !== Math.round(r.width * dpr) || view.height !== Math.round(r.height * dpr)) { view.width = Math.round(r.width * dpr); view.height = Math.round(r.height * dpr); }
      vx.setTransform(dpr, 0, 0, dpr, 0, 0);
      vx.fillStyle = '#1b1c1f'; vx.fillRect(0, 0, r.width, r.height);
      vx.save(); vx.translate(st.ox, st.oy); vx.scale(st.z, st.z);
      vx.imageSmoothingEnabled = st.z < 2;
      vx.fillStyle = '#fff'; vx.fillRect(0, 0, doc.width, doc.height);
      if (below) vx.drawImage(below, 0, 0);
      vx.drawImage(work, 0, 0);
      // imagem flutuante
      if (st.float) { const fr = floatRender(); if (fr) { vx.globalAlpha = 0.9; vx.drawImage(fr.canvas, fr.x, fr.y); vx.globalAlpha = 1; } }
      vx.restore();
      // planos
      st.planes.forEach((pl, i) => {
        const info = planeInfo(pl, doc), on = i === st.act;
        const col = info.ok ? (on ? '#4da3ff' : 'rgba(77,163,255,.55)') : '#ff4d4d';
        vx.strokeStyle = col; vx.lineWidth = on ? 1.5 : 1;
        if (st.gridOn && info.ok) {
          vx.beginPath(); const n = pl.grid || 8;
          for (let k = 1; k < n; k++) {
            const a = d2s(Hm().apply(info.H, (k / n) * info.PW, 0)), b = d2s(Hm().apply(info.H, (k / n) * info.PW, info.PH)); vx.moveTo(a.x, a.y); vx.lineTo(b.x, b.y);
            const c = d2s(Hm().apply(info.H, 0, (k / n) * info.PH)), e = d2s(Hm().apply(info.H, info.PW, (k / n) * info.PH)); vx.moveTo(c.x, c.y); vx.lineTo(e.x, e.y);
          }
          vx.globalAlpha = 0.45; vx.stroke(); vx.globalAlpha = 1;
        }
        vx.beginPath(); pl.pts.forEach((p, k) => { const s = d2s(p); if (k) vx.lineTo(s.x, s.y); else vx.moveTo(s.x, s.y); }); vx.closePath(); vx.stroke();
        if (on && (st.tool === 'edit' || st.tool === 'create')) {
          vx.fillStyle = '#fff';
          pl.pts.forEach((p) => { const s = d2s(p); vx.fillRect(s.x - 4, s.y - 4, 8, 8); vx.strokeRect(s.x - 4, s.y - 4, 8, 8); });
          for (let k = 0; k < 4; k++) { const a = pl.pts[k], b = pl.pts[(k + 1) % 4], s = d2s({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); vx.beginPath(); vx.arc(s.x, s.y, 3.5, 0, Math.PI * 2); vx.fill(); vx.stroke(); }
        }
      });
      // plano em criação
      if (st.creating.length) {
        vx.strokeStyle = '#ffd24d'; vx.beginPath(); st.creating.forEach((p, k) => { const s = d2s(p); if (k) vx.lineTo(s.x, s.y); else vx.moveTo(s.x, s.y); }); if (st.cursor) { const s = d2s(st.cursor); vx.lineTo(s.x, s.y); } vx.stroke();
        st.creating.forEach((p) => { const s = d2s(p); vx.fillStyle = '#ffd24d'; vx.fillRect(s.x - 3, s.y - 3, 6, 6); });
      }
      // seleção
      if (st.sel) {
        const pl = st.planes[st.sel.plane]; if (pl) {
          const info = planeInfo(pl, doc), c = st.sel;
          vx.save(); vx.setLineDash([5, 4]); vx.strokeStyle = '#fff'; vx.beginPath();
          [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]].forEach(([u, v], k) => { const s = d2s(Hm().apply(info.H, u, v)); if (k) vx.lineTo(s.x, s.y); else vx.moveTo(s.x, s.y); });
          vx.closePath(); vx.stroke(); vx.strokeStyle = '#000'; vx.lineDashOffset = 4.5; vx.stroke(); vx.restore();
        }
      }
      // cursor do pincel
      if (st.cursor && (st.tool === 'stamp' || st.tool === 'brush')) {
        const hit = planeAt(st.cursor);
        if (hit) {
          const { info, q } = hit, rp = (st.size / 2) / Math.max(1e-3, localScaleRatio(info));
          vx.strokeStyle = 'rgba(255,255,255,.9)'; vx.beginPath();
          for (let k = 0; k <= 32; k++) { const a = (k / 32) * Math.PI * 2, p = d2s(Hm().apply(info.H, q.x + Math.cos(a) * rp, q.y + Math.sin(a) * rp)); if (k) vx.lineTo(p.x, p.y); else vx.moveTo(p.x, p.y); }
          vx.stroke();
        } else { const s = d2s(st.cursor); vx.strokeStyle = 'rgba(255,255,255,.6)'; vx.beginPath(); vx.arc(s.x, s.y, (st.size / 2) * st.z, 0, Math.PI * 2); vx.stroke(); }
        if (st.src) { const s = d2s(st.src.p); vx.strokeStyle = '#ffd24d'; vx.beginPath(); vx.moveTo(s.x - 6, s.y); vx.lineTo(s.x + 6, s.y); vx.moveTo(s.x, s.y - 6); vx.lineTo(s.x, s.y + 6); vx.stroke(); }
      }
    }
    // o diâmetro é definido no ponto de referência do plano (centro), o tamanho varia com a profundidade
    const localScaleRatio = (info) => localScale(info, info.PW / 2, info.PH / 2);
    const planeAt = (p) => { for (let i = st.planes.length - 1; i >= 0; i--) { const info = planeInfo(st.planes[i], doc); if (!info.ok) continue; const q = inPlane(info, p.x, p.y); if (q) return { i, info, q }; } return null; };

    /* ---------- imagem flutuante (colar / duplicar seleção) ---------- */
    function floatRender() {
      const f = st.float; if (!f) return null;
      const pl = f.plane != null ? st.planes[f.plane] : null;
      const iw = f.img.width, ih = f.img.height;
      if (!pl) { const w = iw * f.flatScale, h = ih * f.flatScale; const c = U.createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); c.getContext('2d').drawImage(f.img, 0, 0, c.width, c.height); return { canvas: c, x: Math.round(f.x - w / 2), y: Math.round(f.y - h / 2) }; }
      const info = planeInfo(pl, doc);
      const A = [f.s, 0, f.cu - (iw / 2) * f.s, 0, f.s, f.cv - (ih / 2) * f.s, 0, 0, 1];
      const Ht = Hm().mul(info.H, A);
      const pts = [[0, 0], [iw, 0], [iw, ih], [0, ih]].map(([x, y]) => Hm().apply(Ht, x, y));
      let R = { x: Math.floor(Math.min(...pts.map((p) => p.x))), y: Math.floor(Math.min(...pts.map((p) => p.y))) };
      R.w = Math.ceil(Math.max(...pts.map((p) => p.x))) - R.x; R.h = Math.ceil(Math.max(...pts.map((p) => p.y))) - R.y;
      R = U.rectIntersect(R, { x: 0, y: 0, w: doc.width, h: doc.height }); if (!R) return null;
      const c = IMG.renderProjective(f.img, 0, 0, Hm().invert(Ht), R, 'bilinear');
      // recorta à área do plano
      const cx = c.getContext('2d'); cx.globalCompositeOperation = 'destination-in'; cx.beginPath(); pl.pts.forEach((p, k) => (k ? cx.lineTo(p.x - R.x, p.y - R.y) : cx.moveTo(p.x - R.x, p.y - R.y))); cx.closePath(); cx.fill();
      return { canvas: c, x: R.x, y: R.y };
    }
    function commitFloat() {
      const fr = floatRender(); if (!fr) { st.float = null; return; }
      snapshot(); wx.drawImage(fr.canvas, fr.x, fr.y); refreshSampler(); st.float = null; dirty();
    }
    function pasteFloat() {
      const clip = IMG.Clipboard && IMG.Clipboard.data;
      const pick = (c) => { st.float = { img: c, plane: null, x: doc.width / 2, y: doc.height / 2, flatScale: Math.min(1, (doc.width * 0.4) / c.width), s: 1, cu: 0, cv: 0 }; setTool('marquee'); hint.textContent = 'Arraste a imagem para dentro de um plano. Roda do mouse: escala · Enter: aplicar · Esc: descartar.'; dirty(); };
      if (clip && clip.canvas) { pick(clip.canvas); return; }
      const layers = IMG.Layers.all(doc).filter((l) => l.canvas && l.type !== 'group').reverse();
      UI.dialog({ title: 'Colar no ponto de fuga', width: 340, body: [el('p.dialog-note', { text: 'Nada copiado. Escolha uma camada para colar:' }), el('div.vp-pick', ...layers.map((l) => UI.btn(l.name, () => { const b = l.contentBounds(); if (!b) return; const c = U.createCanvas(b.w, b.h); c.getContext('2d').drawImage(l.canvas, l.x - b.x, l.y - b.y); pick(c); UI.dialogs[UI.dialogs.length - 1].close(); }, { small: true })))], buttons: [{ label: 'Cancelar' }] });
    }
    function selToFloat() {
      const c = st.sel, pl = st.planes[c.plane], info = planeInfo(pl, doc);
      const w = Math.max(1, Math.round(c.u1 - c.u0)), h = Math.max(1, Math.round(c.v1 - c.v0));
      const img = new ImageData(w, h), d = img.data, tmp = [0, 0, 0, 0];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = Hm().apply(info.H, c.u0 + x + 0.5, c.v0 + y + 0.5); samp(p.x, p.y, tmp); const i = (y * w + x) * 4; d[i] = tmp[0]; d[i + 1] = tmp[1]; d[i + 2] = tmp[2]; d[i + 3] = tmp[3]; }
      const cv = U.createCanvas(w, h); cv.getContext('2d').putImageData(img, 0, 0);
      st.float = { img: cv, plane: c.plane, s: 1, cu: (c.u0 + c.u1) / 2, cv: (c.v0 + c.v1) / 2, flatScale: 1, x: 0, y: 0 };
    }

    /* ---------- pinceladas em perspectiva ---------- */
    function dab(p, brushTip) {
      const hit = planeAt(p); if (!hit) return;
      const { info, q } = hit;
      const r = (st.size / 2) * (localScale(info, q.x, q.y) / Math.max(1e-3, localScaleRatio(info)));
      if (r < 0.5) return;
      const R = U.rectIntersect(U.rectInt({ x: p.x - r - 1, y: p.y - r - 1, w: 2 * r + 2, h: 2 * r + 2 }), { x: 0, y: 0, w: doc.width, h: doc.height }); if (!R) return;
      const img = wx.getImageData(R.x, R.y, R.w, R.h), d = img.data, tmp = [0, 0, 0, 0];
      const hard = st.hard / 100, op = st.opacity / 100, col = U.hexToRgb(st.color);
      for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) {
        const px = R.x + x + 0.5, py = R.y + y + 0.5, dist = Math.hypot(px - p.x, py - p.y) / r;
        if (dist > 1) continue;
        let a = dist <= hard ? 1 : 1 - (dist - hard) / Math.max(1e-3, 1 - hard); a *= op;
        if (a <= 0) continue;
        let sr, sg, sb, sa;
        if (brushTip === 'stamp') {
          const qq = Hm().apply(info.Hi, px, py);
          const s = Hm().apply(info.H, qq.x + st.stampOff.du, qq.y + st.stampOff.dv);
          brushSrc(s.x, s.y, tmp); sr = tmp[0]; sg = tmp[1]; sb = tmp[2]; sa = tmp[3];
        } else { sr = col.r; sg = col.g; sb = col.b; sa = 255; }
        const i = (y * R.w + x) * 4, ta = (sa / 255) * a, da = d[i + 3] / 255, oa = ta + da * (1 - ta);
        if (oa <= 0) continue;
        d[i] = (sr * ta + d[i] * da * (1 - ta)) / oa; d[i + 1] = (sg * ta + d[i + 1] * da * (1 - ta)) / oa; d[i + 2] = (sb * ta + d[i + 2] * da * (1 - ta)) / oa; d[i + 3] = oa * 255;
      }
      wx.putImageData(img, R.x, R.y);
    }
    let brushSrc = null;
    let drag = null;
    const hitCorner = (p) => { const pl = st.planes[st.act]; if (!pl) return -1; const tol = 8 / st.z; return pl.pts.findIndex((c) => Math.hypot(c.x - p.x, c.y - p.y) <= tol); };
    const hitEdge = (p) => { const pl = st.planes[st.act]; if (!pl) return -1; const tol = 8 / st.z; for (let k = 0; k < 4; k++) { const a = pl.pts[k], b = pl.pts[(k + 1) % 4]; if (Math.hypot((a.x + b.x) / 2 - p.x, (a.y + b.y) / 2 - p.y) <= tol) return k; } return -1; };
    view.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      try { view.setPointerCapture(e.pointerId); } catch (err) { /* evento sintético */ }
      const p = s2d(e);
      if (st.tool === 'hand' || e.getModifierState && e.getModifierState(' ')) { drag = { hand: true, sx: p.sx, sy: p.sy, ox: st.ox, oy: st.oy }; return; }
      if (st.float) {
        const hit = planeAt(p);
        drag = { float: true }; moveFloat(p, hit); return;
      }
      if (st.tool === 'create') {
        const ci = hitCorner(p);
        if (!st.creating.length && ci >= 0) { drag = { corner: ci }; return; }
        st.creating.push({ x: p.x, y: p.y });
        if (st.creating.length === 4) { let pts = st.creating; const cx = pts.reduce((s, q) => s + q.x, 0) / 4, cy = pts.reduce((s, q) => s + q.y, 0) / 4; pts = pts.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)); const k0 = pts.reduce((bi, q, k) => (q.x + q.y < pts[bi].x + pts[bi].y ? k : bi), 0); pts = pts.slice(k0).concat(pts.slice(0, k0)); st.planes.push({ pts, grid: 8 }); st.act = st.planes.length - 1; st.creating = []; setTool('edit'); }
        dirty(); return;
      }
      if (st.tool === 'edit') {
        const ci = hitCorner(p); if (ci >= 0) { drag = { corner: ci }; return; }
        const ei = hitEdge(p);
        if (ei >= 0 && (e.ctrlKey || e.metaKey)) {
          const pl = st.planes[st.act], a = pl.pts[ei], b = pl.pts[(ei + 1) % 4];
          st.planes.push({ pts: [{ x: b.x, y: b.y }, { x: a.x, y: a.y }, { x: a.x, y: a.y }, { x: b.x, y: b.y }], grid: pl.grid }); st.act = st.planes.length - 1;
          drag = { extrude: true, a, b, p0: p }; return;
        }
        const hit = planeAt(p); if (hit) { st.act = hit.i; drag = { movePlane: true, p0: p, pts0: IMG.jclone(st.planes[hit.i].pts) }; renderOpts(); dirty(); }
        return;
      }
      if (st.tool === 'marquee') {
        if (st.sel) {
          const pl = st.planes[st.sel.plane], info = pl && planeInfo(pl, doc), q = info && inPlane(info, p.x, p.y), c = st.sel;
          if (q && q.x >= c.u0 && q.x <= c.u1 && q.y >= c.v0 && q.y <= c.v1) {
            if (e.altKey) { selToFloat(); drag = { float: true, q0: q, cu0: st.float.cu, cv0: st.float.cv }; return; }
            drag = { moveSel: true, q0: q, sel0: Object.assign({}, c) }; return;
          }
        }
        const hit = planeAt(p); if (!hit) { st.sel = null; dirty(); return; }
        drag = { sel: true, plane: hit.i, q0: hit.q }; st.sel = { plane: hit.i, u0: hit.q.x, v0: hit.q.y, u1: hit.q.x, v1: hit.q.y }; return;
      }
      if (st.tool === 'stamp') {
        if (e.altKey) { const hit = planeAt(p); st.src = { p, q: hit ? hit.q : null, plane: hit ? hit.i : null }; dirty(); return; }
        if (!st.src || !st.src.q) { UI.toast('Alt+clique dentro de um plano para definir a origem.'); return; }
        const hit = planeAt(p); if (!hit) return;
        snapshot();
        const srcCanvas = U.cloneCanvas(work); const s2 = sampler(srcCanvas); brushSrc = s2;
        st.stampOff = { du: st.src.q.x - hit.q.x, dv: st.src.q.y - hit.q.y };
        drag = { paint: 'stamp', last: p }; dab(p, 'stamp'); dirty(); return;
      }
      if (st.tool === 'brush') { snapshot(); drag = { paint: 'brush', last: p }; dab(p, 'brush'); dirty(); }
    });
    view.addEventListener('pointermove', (e) => {
      const p = s2d(e); st.cursor = p;
      if (!drag) { if (st.creating.length || st.tool === 'stamp' || st.tool === 'brush') dirty(); return; }
      if (drag.hand) { st.ox = drag.ox + p.sx - drag.sx; st.oy = drag.oy + p.sy - drag.sy; dirty(); return; }
      if (drag.float) { moveFloat(p, planeAt(p), drag); dirty(); return; }
      if (drag.corner != null) { const pl = st.planes[st.act]; pl.pts[drag.corner] = { x: p.x, y: p.y }; dirty(); return; }
      if (drag.extrude) { const pl = st.planes[st.act], d = { x: p.x - drag.p0.x, y: p.y - drag.p0.y }; pl.pts[2] = { x: drag.a.x + d.x, y: drag.a.y + d.y }; pl.pts[3] = { x: drag.b.x + d.x, y: drag.b.y + d.y }; dirty(); return; }
      if (drag.movePlane) { const dx = p.x - drag.p0.x, dy = p.y - drag.p0.y; st.planes[st.act].pts = drag.pts0.map((q) => ({ x: q.x + dx, y: q.y + dy })); dirty(); return; }
      if (drag.sel) { const pl = st.planes[drag.plane], info = planeInfo(pl, doc), q = Hm().apply(info.Hi, p.x, p.y); const u = U.clamp(q.x, 0, info.PW), v = U.clamp(q.y, 0, info.PH); st.sel = { plane: drag.plane, u0: Math.min(drag.q0.x, u), v0: Math.min(drag.q0.y, v), u1: Math.max(drag.q0.x, u), v1: Math.max(drag.q0.y, v) }; dirty(); return; }
      if (drag.moveSel) { const pl = st.planes[st.sel.plane], info = planeInfo(pl, doc), q = Hm().apply(info.Hi, p.x, p.y), du = q.x - drag.q0.x, dv = q.y - drag.q0.y; st.sel = Object.assign({}, drag.sel0, { u0: drag.sel0.u0 + du, u1: drag.sel0.u1 + du, v0: drag.sel0.v0 + dv, v1: drag.sel0.v1 + dv }); dirty(); return; }
      if (drag.paint) {
        const a = drag.last, dist = Math.hypot(p.x - a.x, p.y - a.y), step = Math.max(1, st.size * 0.12);
        for (let t = step; t <= dist; t += step) dab({ x: a.x + ((p.x - a.x) * t) / dist, y: a.y + ((p.y - a.y) * t) / dist }, drag.paint);
        if (dist >= step) drag.last = p;
        dirty();
      }
    });
    const end = () => {
      if (!drag) return;
      if (drag.paint) refreshSampler();
      if (drag.float && st.float && st.float.plane != null && st.tool !== 'paste' && drag.q0) commitFloat();
      drag = null; dirty();
    };
    view.addEventListener('pointerup', end);
    view.addEventListener('pointercancel', end);
    view.addEventListener('pointerleave', () => { st.cursor = null; dirty(); });
    view.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (st.float && !e.ctrlKey) { const k = e.deltaY < 0 ? 1.06 : 1 / 1.06; if (st.float.plane != null) st.float.s *= k; else st.float.flatScale *= k; dirty(); return; }
      const r = view.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, k = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      st.ox = mx - (mx - st.ox) * k; st.oy = my - (my - st.oy) * k; st.z *= k; dirty();
    }, { passive: false });
    function moveFloat(p, hit, dr) {
      const f = st.float; if (!f) return;
      if (dr && dr.q0 && f.plane != null) { const info = planeInfo(st.planes[f.plane], doc), q = Hm().apply(info.Hi, p.x, p.y); f.cu = dr.cu0 + q.x - dr.q0.x; f.cv = dr.cv0 + q.y - dr.q0.y; return; }
      if (hit) {
        if (f.plane == null) { const sc = localScale(hit.info, hit.q.x, hit.q.y); f.s = (f.flatScale / Math.max(1e-3, sc)); }
        f.plane = hit.i; f.cu = hit.q.x; f.cv = hit.q.y;
      } else { f.plane = null; f.x = p.x; f.y = p.y; }
    }
    function undo() { if (st.float) { st.float = null; dirty(); return; } const s = st.hist.pop(); if (s) { wx.putImageData(s, 0, 0); refreshSampler(); dirty(); } }
    // teclas: tratadas antes do diálogo (Enter/Esc também servem para a imagem flutuante)
    const onKey = (e) => {
      if (!dlg) return false;
      const k = (e.key || '').toLowerCase();
      if (U.isTyping(e.target)) return false;
      let handled = false;
      const stop = () => { handled = true; e.preventDefault(); e.stopPropagation(); };
      if ((e.ctrlKey || e.metaKey) && k === 'z') { stop(); undo(); return true; }
      if ((e.ctrlKey || e.metaKey) && k === 'v') { stop(); pasteFloat(); return true; }
      if (e.key === 'Enter' && st.float) { stop(); commitFloat(); return true; }
      if (e.key === 'Escape' && (st.float || st.creating.length || st.sel)) { stop(); st.float = null; st.creating = []; st.sel = null; dirty(); return true; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.tool === 'edit' && st.planes.length) { stop(); st.planes.splice(st.act, 1); st.act = Math.max(0, st.act - 1); dirty(); return true; }
      const map = { v: 'edit', c: 'create', m: 'marquee', s: 'stamp', b: 'brush', h: 'hand' };
      if (!e.ctrlKey && !e.metaKey && !e.altKey && map[k]) { stop(); setTool(map[k]); }
      if (k === '[' || k === ']') { stop(); st.size = U.clamp(st.size * (k === ']' ? 1.15 : 1 / 1.15), 1, 2000); renderOpts(); dirty(); }
      return handled;
    };

    dlg = UI.dialog({
      title: 'Ponto de fuga', width: Math.min(1200, window.innerWidth - 40), className: 'vp-dialog', body: [wrap],
      footLeft: [outSel.el],
      buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
        if (st.float) commitFloat();
        doc.vpPlanes = st.planes.map((p) => ({ pts: p.pts, grid: p.grid }));
        const mode = outSel.el.value || 'new';
        const od = orig.getContext('2d').getImageData(0, 0, doc.width, doc.height).data, wd = wx.getImageData(0, 0, doc.width, doc.height), w2 = wd.data;
        let changed = false;
        if (mode === 'new' || !(L0 && L0.type === 'raster') || st.sampleAll) {
          for (let i = 0; i < w2.length; i += 4) { if (w2[i] === od[i] && w2[i + 1] === od[i + 1] && w2[i + 2] === od[i + 2] && w2[i + 3] === od[i + 3]) w2[i + 3] = 0; else changed = true; }
          if (changed) { const c = U.createCanvas(doc.width, doc.height); c.getContext('2d').putImageData(wd, 0, 0); IMG.Layers.fromCanvas(doc, c, 'Ponto de fuga', 0, 0); }
        } else {
          for (let i = 0; i < w2.length; i += 4) if (w2[i] !== od[i] || w2[i + 1] !== od[i + 1] || w2[i + 2] !== od[i + 2] || w2[i + 3] !== od[i + 3]) { changed = true; break; }
          if (changed) { L0.ensureCovers(doc.rect); L0.ctx.clearRect(-L0.x, -L0.y, doc.width, doc.height); L0.ctx.drawImage(work, -L0.x, -L0.y); IMG.markDirty(L0); bus.emit('layer:pixels', L0); }
        }
        bus.emit('layers:change', doc); IMG.Engine.invalidate();
        IMG.commit('Ponto de fuga');
      } }],
      onClose: () => { dlg = null; }
    });
    { const base = dlg.onKey; dlg.onKey = (e) => { if (!onKey(e)) base(e); }; }
    setTool(st.tool);
    requestAnimationFrame(() => { fit(); dirty(); });
  }

  IMG.Vanishing = { open, aspect, planeInfo };
  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, H) => {
    C('filter.vanishing', 'Ponto de fuga…', open, { enabled: H.has, keys: ['ctrl+alt+v'] });
  });
})();
