/* ==========================================================================
   Imaginarium — Deformação de marionete, Deformação de perspectiva e
   ferramenta Corte em perspectiva.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus;
  const Layers = IMG.Layers, Hm = IMG.Homography;
  const T = () => IMG.Tools;

  function prepLayer(doc) {
    const L = doc.active;
    if (!L || L.type === 'group' || L.type === 'adjust') { IMG.UI.toast('Selecione uma camada de pixels.'); return null; }
    if (Layers.isLocked(L) || L.lockPos) { IMG.UI.toast('A camada está bloqueada.'); return null; }
    if (L.type === 'text' || L.type === 'shape') { Layers.rasterize(doc, L); IMG.UI.toast('A camada foi rasterizada.'); }
    if (L.isBg) Layers.fromBackground(doc, L);
    const cb = L.contentBounds();
    if (!cb) { IMG.UI.toast('A camada está vazia.'); return null; }
    return { L, cb };
  }

  /* ==================================================================
     DEFORMAÇÃO DE MARIONETE (mínimos quadrados móveis)
     ================================================================== */
  function mls(pins, vx, vy, mode) {
    const n = pins.length;
    if (!n) return { x: vx, y: vy };
    if (n === 1) return { x: vx + pins[0].x - pins[0].x0, y: vy + pins[0].y - pins[0].y0 };
    let sw = 0, px = 0, py = 0, qx = 0, qy = 0;
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const p = pins[i], dx = p.x0 - vx, dy = p.y0 - vy, d2 = dx * dx + dy * dy;
      if (d2 < 1e-6) return { x: p.x, y: p.y };
      w[i] = 1 / d2; sw += w[i];
      px += w[i] * p.x0; py += w[i] * p.y0; qx += w[i] * p.x; qy += w[i] * p.y;
    }
    px /= sw; py /= sw; qx /= sw; qy /= sw;
    const dx = vx - px, dy = vy - py;
    if (mode === 'distort') {
      // afim: M = (Σ w p̂ᵀp̂)⁻¹ Σ w p̂ᵀq̂
      let a = 0, b = 0, c = 0, m00 = 0, m01 = 0, m10 = 0, m11 = 0;
      for (let i = 0; i < n; i++) {
        const p = pins[i], hx = p.x0 - px, hy = p.y0 - py, kx = p.x - qx, ky = p.y - qy, wi = w[i];
        a += wi * hx * hx; b += wi * hx * hy; c += wi * hy * hy;
        m00 += wi * hx * kx; m01 += wi * hx * ky; m10 += wi * hy * kx; m11 += wi * hy * ky;
      }
      const det = a * c - b * b;
      if (Math.abs(det) < 1e-9) return { x: dx + qx, y: dy + qy };
      const i00 = c / det, i01 = -b / det, i11 = a / det;
      const M00 = i00 * m00 + i01 * m10, M01 = i00 * m01 + i01 * m11, M10 = i01 * m00 + i11 * m10, M11 = i01 * m01 + i11 * m11;
      return { x: dx * M00 + dy * M10 + qx, y: dx * M01 + dy * M11 + qy };
    }
    // semelhança / rígido (números complexos): S = Σ w q̂·conj(p̂)
    let sr = 0, si = 0, mu = 0;
    for (let i = 0; i < n; i++) {
      const p = pins[i], hx = p.x0 - px, hy = p.y0 - py, kx = p.x - qx, ky = p.y - qy, wi = w[i];
      sr += wi * (kx * hx + ky * hy); si += wi * (ky * hx - kx * hy); mu += wi * (hx * hx + hy * hy);
    }
    let fx = sr * dx - si * dy, fy = sr * dy + si * dx;
    if (mode === 'rigid') { const l = Math.hypot(fx, fy); if (l < 1e-9) return { x: dx + qx, y: dy + qy }; const dl = Math.hypot(dx, dy); fx = (fx / l) * dl; fy = (fy / l) * dl; }
    else { if (mu < 1e-9) return { x: dx + qx, y: dy + qy }; fx /= mu; fy /= mu; }
    return { x: fx + qx, y: fy + qy };
  }
  IMG.mlsDeform = mls;

  const Puppet = (IMG.Puppet = {
    s: null,
    begin() {
      const doc = IMG.app.doc; if (!doc || this.s) return;
      const p = prepLayer(doc); if (!p) return;
      const { L, cb } = p;
      const src = U.createCanvas(cb.w, cb.h); src.getContext('2d').drawImage(L.canvas, L.x - cb.x, L.y - cb.y);
      this.s = { doc, L, cb, src, orig: { canvas: L.canvas, x: L.x, y: L.y }, pins: [], sel: -1, pv: U.createCanvas(doc.width, doc.height) };
      this.buildMesh();
      L.canvas = this.s.pv; L.x = 0; L.y = 0;
      this.preview();
      T().set('puppet');
    },
    buildMesh() {
      const s = this.s, o = T().o('puppet'), cb = s.cb;
      const N = { less: 10, normal: 18, more: 30 }[o.density] || 18;
      const step = Math.max(6, Math.round(Math.sqrt(cb.w * cb.h) / N));
      const cols = Math.max(1, Math.ceil(cb.w / step)), rows = Math.max(1, Math.ceil(cb.h / step));
      // alfa dilatado pela expansão
      const a = s.src.getContext('2d').getImageData(0, 0, cb.w, cb.h).data;
      const exp = Math.max(0, o.expansion);
      const on = new Uint8Array(cols * rows);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x0 = Math.max(0, i * step - exp), y0 = Math.max(0, j * step - exp), x1 = Math.min(cb.w, (i + 1) * step + exp), y1 = Math.min(cb.h, (j + 1) * step + exp);
        let hit = false;
        for (let y = y0; y < y1 && !hit; y += 2) for (let x = x0; x < x1; x += 2) if (a[(y * cb.w + x) * 4 + 3] > 8) { hit = true; break; }
        on[j * cols + i] = hit ? 1 : 0;
      }
      s.mesh = { step, cols, rows, on };
    },
    vertex(i, j) { const s = this.s, m = s.mesh; return { x: s.cb.x + Math.min(s.cb.w, i * m.step), y: s.cb.y + Math.min(s.cb.h, j * m.step) }; },
    deformed() {
      const s = this.s, m = s.mesh, mode = T().o('puppet').mode, out = [];
      for (let j = 0; j <= m.rows; j++) for (let i = 0; i <= m.cols; i++) { const v = this.vertex(i, j); out.push(mls(s.pins, v.x, v.y, mode)); }
      return out;
    },
    render(ctx, ox, oy, grow) {
      const s = this.s, m = s.mesh, D = this.deformed(), K = (i, j) => j * (m.cols + 1) + i;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingQuality = 'high';
      for (let j = 0; j < m.rows; j++) for (let i = 0; i < m.cols; i++) {
        if (!m.on[j * m.cols + i]) continue;
        const sp = (a, b) => { const v = this.vertex(a, b); return { x: v.x - s.cb.x, y: v.y - s.cb.y }; };
        const dp = (a, b) => { const v = D[K(a, b)]; return { x: v.x - ox, y: v.y - oy }; };
        IMG.drawTri(ctx, s.src, sp(i, j), sp(i + 1, j), sp(i + 1, j + 1), dp(i, j), dp(i + 1, j), dp(i + 1, j + 1), grow);
        IMG.drawTri(ctx, s.src, sp(i, j), sp(i + 1, j + 1), sp(i, j + 1), dp(i, j), dp(i + 1, j + 1), dp(i, j + 1), grow);
      }
      ctx.restore();
      return D;
    },
    preview() {
      const s = this.s; if (!s) return;
      const c = s.pv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, s.pv.width, s.pv.height);
      s.D = this.render(c, 0, 0, 0.6);
      IMG.markDirty(s.L); IMG.Effects.invalidate(s.L); IMG.Engine.invalidate();
    },
    commit() {
      const s = this.s; if (!s) return;
      const D = this.deformed(), m = s.mesh;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      D.forEach((p) => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
      const R = U.rectIntersect({ x: Math.floor(x0) - 2, y: Math.floor(y0) - 2, w: Math.ceil(x1 - x0) + 4, h: Math.ceil(y1 - y0) + 4 }, U.rectInflate(s.doc.rect, 4000));
      s.L.canvas = s.orig.canvas; s.L.x = s.orig.x; s.L.y = s.orig.y;
      const c = U.createCanvas(Math.max(1, R.w), Math.max(1, R.h));
      this.render(c.getContext('2d'), R.x, R.y, 0.45);
      // pixels fora do conteúdo deformado (área da camada fora do retângulo de conteúdo) são preservados
      s.L.setCanvas(c, R.x, R.y);
      void m;
      IMG.Effects.invalidate(s.L);
      this.s = null;
      bus.emit('layers:change', IMG.app.doc); IMG.Engine.invalidate();
      IMG.commit('Deformação de marionete');
      if (T().activeId === 'puppet') T().back();
    },
    cancel() {
      const s = this.s; if (!s) return;
      s.L.canvas = s.orig.canvas; s.L.x = s.orig.x; s.L.y = s.orig.y; IMG.markDirty(s.L); IMG.Effects.invalidate(s.L);
      this.s = null; IMG.Engine.invalidate();
      if (T().activeId === 'puppet') T().back();
    }
  });

  IMG.Tools.register({
    id: 'puppet', name: 'Deformação de marionete', icon: 'puppet', hidden: true, modal: true, cursor: 'crosshair', noCtrlMove: true,
    defaults: { mode: 'normal', density: 'normal', expansion: 2, showMesh: true },
    hint: 'Clique para adicionar alfinetes e arraste-os · Alt+clique remove · Enter: aplicar · Esc: cancelar',
    options() {
      return [
        { type: 'select', key: 'mode', label: 'Modo', options: [['rigid', 'Rígido'], ['normal', 'Normal'], ['distort', 'Distorcer']], width: 100 },
        { type: 'select', key: 'density', label: 'Densidade', options: [['less', 'Menos pontos'], ['normal', 'Normal'], ['more', 'Mais pontos']], width: 120 },
        { type: 'number', key: 'expansion', label: 'Expansão', min: -20, max: 100, unit: 'px', width: 60 },
        { type: 'check', key: 'showMesh', label: 'Mostrar malha' },
        { type: 'sep' },
        { type: 'button', label: 'Remover todos os alfinetes', onClick: () => { if (Puppet.s) { Puppet.s.pins = []; Puppet.preview(); } } },
        { type: 'button', label: 'Cancelar', onClick: () => Puppet.cancel() },
        { type: 'button', label: 'Aplicar', icon: 'check', primary: true, onClick: () => Puppet.commit() }
      ];
    },
    onOption(key) { if (!Puppet.s) return; if (key === 'density' || key === 'expansion') Puppet.buildMesh(); Puppet.preview(); },
    deactivate() { if (Puppet.s) Puppet.cancel(); },
    beforeCommand(id) { if (!Puppet.s) return false; if (id === 'edit.undo') { Puppet.cancel(); return true; } if (/^(view|window|help)\./.test(id)) return false; Puppet.commit(); return false; },
    pinAt(ev) {
      const s = Puppet.s, v = s.doc.view;
      for (let i = s.pins.length - 1; i >= 0; i--) { const p = s.pins[i]; if (Math.hypot((p.x - ev.x) * v.zoom, (p.y - ev.y) * v.zoom) <= 7) return i; }
      return -1;
    },
    down(ev) {
      const s = Puppet.s; if (!s) return false;
      const k = this.pinAt(ev);
      if (k >= 0 && ev.alt) { s.pins.splice(k, 1); s.sel = -1; Puppet.preview(); return false; }
      if (k >= 0) { s.sel = k; this.drag = { k, x: ev.x, y: ev.y, px: s.pins[k].x, py: s.pins[k].y }; IMG.Engine.requestRender(); return; }
      // novo alfinete: posição de origem correspondente ao ponto clicado (inverte a deformação aproximando pela malha)
      const src = this.unproject(ev.x, ev.y);
      if (!src) return false;
      s.pins.push({ x0: src.x, y0: src.y, x: ev.x, y: ev.y }); s.sel = s.pins.length - 1;
      this.drag = { k: s.sel, x: ev.x, y: ev.y, px: ev.x, py: ev.y };
      Puppet.preview();
    },
    unproject(x, y) {
      const s = Puppet.s, m = s.mesh, D = s.D || Puppet.deformed(), K = (i, j) => j * (m.cols + 1) + i;
      // procura o triângulo deformado que contém o ponto e interpola em coordenadas baricêntricas
      for (let j = 0; j < m.rows; j++) for (let i = 0; i < m.cols; i++) {
        if (!m.on[j * m.cols + i]) continue;
        for (const tri of [[[i, j], [i + 1, j], [i + 1, j + 1]], [[i, j], [i + 1, j + 1], [i, j + 1]]]) {
          const [a, b, c] = tri.map(([u, v]) => D[K(u, v)]);
          const den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
          if (Math.abs(den) < 1e-9) continue;
          const l1 = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / den, l2 = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / den, l3 = 1 - l1 - l2;
          if (l1 < -0.01 || l2 < -0.01 || l3 < -0.01) continue;
          const [A, B, C] = tri.map(([u, v]) => Puppet.vertex(u, v));
          return { x: A.x * l1 + B.x * l2 + C.x * l3, y: A.y * l1 + B.y * l2 + C.y * l3 };
        }
      }
      return null;
    },
    move(ev) {
      const s = Puppet.s, d = this.drag; if (!s || !d) return;
      s.pins[d.k].x = d.px + (ev.x - d.x); s.pins[d.k].y = d.py + (ev.y - d.y);
      Puppet.preview();
    },
    up() { this.drag = null; },
    onKey(e) {
      const s = Puppet.s; if (!s) return false;
      if (e.key === 'Enter') { Puppet.commit(); return true; }
      if (e.key === 'Escape') { Puppet.cancel(); return true; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.sel >= 0) { s.pins.splice(s.sel, 1); s.sel = -1; Puppet.preview(); return true; }
      return false;
    },
    hover(ev) { if (Puppet.s) T().cursor(this.pinAt(ev) >= 0 ? (ev.alt ? 'not-allowed' : 'move') : 'crosshair'); },
    drawOverlay(ctx, v) {
      const s = Puppet.s; if (!s) return;
      const S = (p) => ({ x: v.x + p.x * v.zoom, y: v.y + p.y * v.zoom });
      if (T().o('puppet').showMesh && s.D) {
        const m = s.mesh, K = (i, j) => j * (m.cols + 1) + i;
        ctx.strokeStyle = 'rgba(40,40,40,.55)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let j = 0; j < m.rows; j++) for (let i = 0; i < m.cols; i++) {
          if (!m.on[j * m.cols + i]) continue;
          const a = S(s.D[K(i, j)]), b = S(s.D[K(i + 1, j)]), c = S(s.D[K(i + 1, j + 1)]), d = S(s.D[K(i, j + 1)]);
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.lineTo(a.x, a.y); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
        }
        ctx.stroke();
      }
      s.pins.forEach((p, i) => {
        const q = S(p);
        ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, 7);
        ctx.fillStyle = i === s.sel ? '#000' : '#ffd400'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
        if (i === s.sel) { ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); }
      });
    }
  });

  /* ==================================================================
     DEFORMAÇÃO DE PERSPECTIVA
     ================================================================== */
  const PW = (IMG.PerspWarp = {
    s: null,
    begin() {
      const doc = IMG.app.doc; if (!doc || this.s) return;
      const p = prepLayer(doc); if (!p) return;
      const { L, cb } = p;
      const src = U.createCanvas(L.canvas.width, L.canvas.height); src.getContext('2d').drawImage(L.canvas, 0, 0);
      this.s = { doc, L, src, sx: L.x, sy: L.y, orig: { canvas: L.canvas, x: L.x, y: L.y }, phase: 'layout', quad0: null, quad: null, pv: U.createCanvas(doc.width, doc.height) };
      void cb;
      T().set('perspWarp');
      IMG.UI.renderOptions();
      IMG.UI.toast('Desenhe um plano (arraste) e ajuste os cantos ao longo das linhas da imagem; depois clique em Deformar.');
    },
    H(s) { return s.quad0 && s.quad ? Hm.homography(s.quad0, s.quad) : null; },
    preview() {
      const s = this.s; if (!s || s.phase !== 'warp') return;
      const H = this.H(s), c = s.pv.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, s.pv.width, s.pv.height);
      const n = 16, w = s.src.width, h = s.src.height;
      IMG.drawMesh(c, s.src, n, n, (i, j) => ({ x: (i / n) * w, y: (j / n) * h }), (i, j) => Hm.apply(H, s.sx + (i / n) * w, s.sy + (j / n) * h));
      s.L.canvas = s.pv; s.L.x = 0; s.L.y = 0;
      IMG.markDirty(s.L); IMG.Effects.invalidate(s.L); IMG.Engine.invalidate();
    },
    setPhase(ph) {
      const s = this.s; if (!s) return;
      if (ph === 'warp' && !s.quad) { IMG.UI.toast('Desenhe um plano primeiro.'); return; }
      if (ph === 'warp' && s.phase === 'layout') { s.quad0 = s.quad.map((p) => ({ ...p })); }
      if (ph === 'layout' && s.phase === 'warp') { s.L.canvas = s.orig.canvas; s.L.x = s.orig.x; s.L.y = s.orig.y; IMG.markDirty(s.L); IMG.Engine.invalidate(); s.quad = s.quad0.map((p) => ({ ...p })); }
      s.phase = ph;
      this.preview(); IMG.UI.renderOptions(); IMG.Engine.requestRender();
    },
    straighten(kind) {
      const s = this.s; if (!s || s.phase !== 'warp') return;
      const q = s.quad.map((p) => ({ ...p }));
      if (kind === 'v' || kind === 'both') { const lx = (q[0].x + q[3].x) / 2, rx = (q[1].x + q[2].x) / 2; q[0].x = q[3].x = lx; q[1].x = q[2].x = rx; }
      if (kind === 'h' || kind === 'both') { const ty = (q[0].y + q[1].y) / 2, by = (q[2].y + q[3].y) / 2; q[0].y = q[1].y = ty; q[2].y = q[3].y = by; }
      s.quad = q; this.preview();
    },
    commit() {
      const s = this.s; if (!s) return;
      s.L.canvas = s.orig.canvas; s.L.x = s.orig.x; s.L.y = s.orig.y;
      if (s.phase === 'warp' && s.quad0) {
        const H = this.H(s), Hi = Hm.invert(H), w = s.src.width, h = s.src.height;
        const pts = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => Hm.apply(H, s.sx + x, s.sy + y));
        let R = { x: Math.floor(Math.min(...pts.map((p) => p.x))), y: Math.floor(Math.min(...pts.map((p) => p.y))) };
        R.w = Math.ceil(Math.max(...pts.map((p) => p.x))) - R.x; R.h = Math.ceil(Math.max(...pts.map((p) => p.y))) - R.y;
        R = U.rectIntersect(R, U.rectInflate(s.doc.rect, 2000)) || s.doc.rect;
        const c = IMG.renderProjective(s.src, s.sx, s.sy, Hi, R, 'bilinear');
        s.L.setCanvas(c, R.x, R.y);
        IMG.Effects.invalidate(s.L);
        bus.emit('layers:change', s.doc); IMG.Engine.invalidate();
        IMG.commit('Deformação de perspectiva');
      } else IMG.Engine.invalidate();
      this.s = null;
      if (T().activeId === 'perspWarp') T().back();
    },
    cancel() {
      const s = this.s; if (!s) return;
      s.L.canvas = s.orig.canvas; s.L.x = s.orig.x; s.L.y = s.orig.y; IMG.markDirty(s.L); IMG.Effects.invalidate(s.L);
      this.s = null; IMG.Engine.invalidate();
      if (T().activeId === 'perspWarp') T().back();
    }
  });

  /** Arraste de cantos de um quadrilátero (comum à Deformação de perspectiva e ao Corte em perspectiva). */
  function quadHit(quad, ev, v) {
    if (!quad) return -1;
    for (let i = 0; i < 4; i++) if (Math.hypot((quad[i].x - ev.x) * v.zoom, (quad[i].y - ev.y) * v.zoom) <= 8) return i;
    return -1;
  }
  function drawQuad(ctx, v, q, grid, color) {
    const S = (p) => ({ x: v.x + p.x * v.zoom, y: v.y + p.y * v.zoom });
    const P = q.map(S);
    ctx.strokeStyle = color || '#4d8fd6'; ctx.lineWidth = 1;
    ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
    if (grid) {
      ctx.strokeStyle = 'rgba(77,143,214,.45)'; ctx.beginPath();
      const H = Hm.homography([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], q);
      for (let k = 1; k < grid; k++) {
        const t = k / grid, a = S(Hm.apply(H, t, 0)), b = S(Hm.apply(H, t, 1)), c = S(Hm.apply(H, 0, t)), d = S(Hm.apply(H, 1, t));
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.strokeStyle = color || '#4d8fd6';
    P.forEach((p) => { ctx.fillRect(Math.round(p.x) - 4, Math.round(p.y) - 4, 8, 8); ctx.strokeRect(Math.round(p.x) - 4, Math.round(p.y) - 4, 8, 8); });
  }

  IMG.Tools.register({
    id: 'perspWarp', name: 'Deformação de perspectiva', icon: 'perspCrop', hidden: true, modal: true, cursor: 'crosshair', noCtrlMove: true,
    defaults: {},
    hint: 'Layout: desenhe e ajuste o plano · Deformar: arraste os cantos · Enter: aplicar',
    options() {
      const s = PW.s; if (!s) return [];
      const UI = IMG.UI;
      const list = [{ type: 'custom', build: () => UI.seg([{ value: 'layout', label: 'Layout' }, { value: 'warp', label: 'Deformar' }], s.phase, (v) => PW.setPhase(v), { labels: true }).el }];
      if (s.phase === 'warp') list.push({ type: 'sep' }, { type: 'button', label: 'Endireitar verticais', onClick: () => PW.straighten('v') }, { type: 'button', label: 'Endireitar horizontais', onClick: () => PW.straighten('h') }, { type: 'button', label: 'Ambos', onClick: () => PW.straighten('both') });
      list.push({ type: 'sep' }, { type: 'button', label: 'Cancelar', onClick: () => PW.cancel() }, { type: 'button', label: 'Aplicar', icon: 'check', primary: true, onClick: () => PW.commit() });
      return list;
    },
    deactivate() { if (PW.s) PW.cancel(); },
    beforeCommand(id) { if (!PW.s) return false; if (id === 'edit.undo') { PW.cancel(); return true; } if (/^(view|window|help)\./.test(id)) return false; PW.commit(); return false; },
    down(ev) {
      const s = PW.s; if (!s) return false;
      const k = quadHit(s.quad, ev, s.doc.view);
      if (k >= 0) { this.drag = { k, x: ev.x, y: ev.y, p: { ...s.quad[k] } }; return; }
      if (s.phase === 'layout' && !s.quad) { this.create = { x: ev.x, y: ev.y }; s.quad = [{ x: ev.x, y: ev.y }, { x: ev.x, y: ev.y }, { x: ev.x, y: ev.y }, { x: ev.x, y: ev.y }]; return; }
      return false;
    },
    move(ev) {
      const s = PW.s; if (!s) return;
      if (this.create) { const a = this.create; s.quad = [{ x: a.x, y: a.y }, { x: ev.x, y: a.y }, { x: ev.x, y: ev.y }, { x: a.x, y: ev.y }]; IMG.Engine.requestRender(); return; }
      const d = this.drag; if (!d) return;
      s.quad[d.k] = { x: d.p.x + ev.x - d.x, y: d.p.y + ev.y - d.y };
      if (s.phase === 'warp') PW.preview(); else IMG.Engine.requestRender();
    },
    up() {
      const s = PW.s;
      if (this.create && s) { const q = s.quad; if (Math.abs(q[2].x - q[0].x) < 4 || Math.abs(q[2].y - q[0].y) < 4) s.quad = null; }
      this.create = null; this.drag = null;
    },
    hover(ev) { const s = PW.s; if (s) T().cursor(quadHit(s.quad, ev, s.doc.view) >= 0 ? 'move' : 'crosshair'); },
    onKey(e) { if (e.key === 'Enter') { if (PW.s && PW.s.phase === 'layout' && PW.s.quad) PW.setPhase('warp'); else PW.commit(); return true; } if (e.key === 'Escape') { PW.cancel(); return true; } return false; },
    drawOverlay(ctx, v) { const s = PW.s; if (s && s.quad) drawQuad(ctx, v, s.quad, s.phase === 'layout' ? 3 : 0, s.phase === 'warp' ? '#f0a020' : null); }
  });

  /* ==================================================================
     CORTE EM PERSPECTIVA
     ================================================================== */
  function perspCrop(doc, quad, W, H) {
    const dst = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
    const Hh = Hm.homography(quad, dst), Hi = Hm.invert(Hh);
    const R = { x: 0, y: 0, w: W, h: H };
    Layers.walk(doc.layers, (L) => {
      if (L.type === 'group' || L.type === 'adjust') { if (L.mask) { const m = L.mask; const c = IMG.renderProjective(m.canvas, m.x, m.y, Hi, R, 'bilinear'); m.canvas = c; m.x = 0; m.y = 0; m._snap = null; IMG.markDirty(m); } return; }
      if (L.type === 'text' || L.type === 'shape') Layers.rasterize(doc, L);
      if (L.canvas) { const c = IMG.renderProjective(L.canvas, L.x, L.y, Hi, R, 'bilinear'); L.setCanvas(c, 0, 0); }
      if (L.mask) { const m = L.mask, c = IMG.renderProjective(m.canvas, m.x, m.y, Hi, R, 'bilinear'); m.canvas = c; m.x = 0; m.y = 0; m._snap = null; IMG.markDirty(m); }
      IMG.Effects.invalidate(L);
    });
    doc.width = W; doc.height = H; doc.guides = { h: [], v: [] }; doc.selection = null;
    bus.emit('doc:resize', doc); IMG.Engine.fit(false); bus.emit('layers:change', doc); IMG.Engine.invalidate();
    IMG.commit('Corte em perspectiva');
  }
  IMG.perspCrop = perspCrop;

  IMG.Tools.register({
    id: 'perspCrop', name: 'Corte em perspectiva', icon: 'perspCrop', cursor: 'crosshair',
    defaults: { w: 0, h: 0, grid: true },
    hint: 'Arraste para criar a área e ajuste os cantos sobre o plano inclinado · Enter: cortar · Esc: cancelar',
    options() {
      return [
        { type: 'number', key: 'w', label: 'L', min: 0, max: 30000, width: 70, unit: 'px' },
        { type: 'custom', build: () => IMG.UI.iconBtn('swap', 'Trocar largura e altura', () => { const o = T().o('perspCrop'), t = o.w; T().setOpt('perspCrop', 'w', o.h, true); T().setOpt('perspCrop', 'h', t); }) },
        { type: 'number', key: 'h', label: 'A', min: 0, max: 30000, width: 70, unit: 'px' },
        { type: 'button', label: 'Limpar', onClick: () => { T().setOpt('perspCrop', 'w', 0, true); T().setOpt('perspCrop', 'h', 0); IMG.UI.renderOptions(); } },
        { type: 'check', key: 'grid', label: 'Mostrar grade' },
        { type: 'sep' },
        { type: 'button', label: 'Cancelar', onClick: () => { this.quad = null; IMG.Engine.requestRender(); } },
        { type: 'button', label: 'Cortar', icon: 'check', primary: true, onClick: () => this.apply() }
      ];
    },
    apply() {
      const q = this.quad, doc = IMG.app.doc; if (!q || !doc) return;
      const o = T().o('perspCrop');
      const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const W = Math.max(1, Math.round(o.w || (d(q[0], q[1]) + d(q[3], q[2])) / 2)), H = Math.max(1, Math.round(o.h || (d(q[0], q[3]) + d(q[1], q[2])) / 2));
      this.quad = null;
      perspCrop(doc, q, W, H);
    },
    deactivate() { this.quad = null; },
    down(ev) {
      const k = quadHit(this.quad, ev, IMG.app.doc.view);
      if (k >= 0) { this.drag = { k, x: ev.x, y: ev.y, p: { ...this.quad[k] } }; return; }
      if (this.quad) {
        // dentro: move tudo
        const q = this.quad; let inside = false;
        for (let i = 0, j = 3; i < 4; j = i++) if ((q[i].y > ev.y) !== (q[j].y > ev.y) && ev.x < ((q[j].x - q[i].x) * (ev.y - q[i].y)) / (q[j].y - q[i].y) + q[i].x) inside = !inside;
        if (inside) { this.drag = { all: true, x: ev.x, y: ev.y, q: q.map((p) => ({ ...p })) }; return; }
      }
      this.create = { x: ev.x, y: ev.y };
      this.quad = [{ x: ev.x, y: ev.y }, { x: ev.x, y: ev.y }, { x: ev.x, y: ev.y }, { x: ev.x, y: ev.y }];
    },
    move(ev) {
      if (this.create) { const a = this.create; this.quad = [{ x: a.x, y: a.y }, { x: ev.x, y: a.y }, { x: ev.x, y: ev.y }, { x: a.x, y: ev.y }]; IMG.Engine.requestRender(); return; }
      const d = this.drag; if (!d) return;
      if (d.all) this.quad = d.q.map((p) => ({ x: p.x + ev.x - d.x, y: p.y + ev.y - d.y }));
      else this.quad[d.k] = { x: d.p.x + ev.x - d.x, y: d.p.y + ev.y - d.y };
      IMG.Engine.requestRender();
    },
    up() {
      if (this.create && this.quad) { const q = this.quad; if (Math.abs(q[2].x - q[0].x) < 4 || Math.abs(q[2].y - q[0].y) < 4) this.quad = null; }
      this.create = null; this.drag = null; IMG.Engine.requestRender();
    },
    hover(ev) { T().cursor(quadHit(this.quad, ev, IMG.app.doc.view) >= 0 ? 'move' : 'crosshair'); },
    dblclick() { this.apply(); },
    onKey(e) { if (!this.quad) return false; if (e.key === 'Enter') { this.apply(); return true; } if (e.key === 'Escape') { this.quad = null; IMG.Engine.requestRender(); return true; } return false; },
    drawOverlay(ctx, v) {
      const q = this.quad; if (!q) return;
      const doc = IMG.app.doc;
      // escurece fora do quad
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.rect(v.x, v.y, doc.width * v.zoom, doc.height * v.zoom);
      const P = q.map((p) => ({ x: v.x + p.x * v.zoom, y: v.y + p.y * v.zoom }));
      ctx.moveTo(P[0].x, P[0].y); for (let i = 3; i >= 1; i--) ctx.lineTo(P[i].x, P[i].y); ctx.closePath(); ctx.fill('evenodd'); ctx.restore();
      drawQuad(ctx, v, q, T().o('perspCrop').grid ? 6 : 0);
    }
  });

  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, Hh) => {
    C('edit.puppetWarp', 'Deformação de marionete', () => Puppet.begin(), { enabled: Hh.hasLayer });
    C('edit.perspectiveWarp', 'Deformação de perspectiva', () => PW.begin(), { enabled: Hh.hasLayer });
  });
})();
