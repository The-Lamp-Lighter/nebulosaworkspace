/* ==========================================================================
   Imaginarium — Filtro › Dissolver (Liquify)  — Shift+Ctrl+X
   Campo de deslocamento editado com pincéis; pré-visualização em resolução
   reduzida e aplicação final em resolução total (Web Worker).
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, el = U.el;

  const TOOLS = [
    ['warp', 'Deformação para frente', 'W'], ['reconstruct', 'Reconstruir', 'R'], ['smooth', 'Suavizar', 'E'],
    ['twirlCW', 'Redemoinho no sentido horário', 'C'], ['twirlCCW', 'Redemoinho no sentido anti-horário', ''], ['pucker', 'Franzir', 'S'], ['bloat', 'Inflar', 'B'], ['push', 'Empurrar para a esquerda', 'O'],
    ['freeze', 'Congelar máscara', 'F'], ['thaw', 'Descongelar máscara', 'D']
  ];
  const ICON = { warp: 'move', reconstruct: 'reset', smooth: 'brush', twirlCW: 'redo', twirlCCW: 'undo', pucker: 'zoomOut', bloat: 'zoomIn', push: 'chevronRight', freeze: 'mask', thaw: 'eraser' };

  function open() {
    const UI = IMG.UI;
    const S = IMG.FXSession.begin(); if (!S || S.smart) return;
    const W = S.w, H = S.h;
    // resolução de trabalho (pré-visualização)
    const maxPrev = 900, k = Math.min(1, maxPrev / Math.max(W, H));
    const pw = Math.max(1, Math.round(W * k)), ph = Math.max(1, Math.round(H * k));
    const srcFull = U.createCanvas(W, H); srcFull.getContext('2d').putImageData(S.src, 0, 0);
    const prevSrc = U.createCanvas(pw, ph); { const x = prevSrc.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(srcFull, 0, 0, pw, ph); }
    const P = prevSrc.getContext('2d').getImageData(0, 0, pw, ph).data;
    const DX = new Float32Array(pw * ph), DY = new Float32Array(pw * ph), FZ = new Float32Array(pw * ph);
    const undo = [];
    const snap = () => { undo.push([DX.slice(), DY.slice(), FZ.slice()]); if (undo.length > 30) undo.shift(); };
    const st = Object.assign({ tool: 'warp', size: 100, density: 50, pressure: 100, rate: 80, mesh: false, backdrop: true, showMask: true }, U.store.get('liquify', {}));
    const view = U.domCanvas(pw, ph); view.className = 'lq-view';
    const out = view.getContext('2d').createImageData(pw, ph);
    const render = () => {
      const o = out.data;
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
        const j = y * pw + x, sx = x + DX[j], sy = y + DY[j];
        const i = j * 4;
        const x0 = Math.floor(sx), y0 = Math.floor(sy);
        if (x0 < 0 || y0 < 0 || x0 >= pw - 1 || y0 >= ph - 1) {
          const cx = U.clamp(Math.round(sx), 0, pw - 1), cy = U.clamp(Math.round(sy), 0, ph - 1), q = (cy * pw + cx) * 4;
          o[i] = P[q]; o[i + 1] = P[q + 1]; o[i + 2] = P[q + 2]; o[i + 3] = sx < -1 || sy < -1 || sx > pw || sy > ph ? 0 : P[q + 3];
          continue;
        }
        const tx = sx - x0, ty = sy - y0, q = (y0 * pw + x0) * 4, q2 = q + pw * 4;
        for (let c = 0; c < 4; c++) o[i + c] = (P[q + c] * (1 - tx) + P[q + 4 + c] * tx) * (1 - ty) + (P[q2 + c] * (1 - tx) + P[q2 + 4 + c] * tx) * ty;
      }
      if (st.showMask) for (let j = 0; j < FZ.length; j++) { const f = FZ[j]; if (f > 0) { const i = j * 4, a = f * 0.5; o[i] = o[i] * (1 - a) + 255 * a; o[i + 1] *= 1 - a; o[i + 2] *= 1 - a; o[i + 3] = Math.max(o[i + 3], 255 * a); } }
      const ctx = view.getContext('2d');
      ctx.clearRect(0, 0, pw, ph);
      ctx.putImageData(out, 0, 0);
      if (st.mesh) {
        ctx.strokeStyle = 'rgba(80,160,255,.5)'; ctx.lineWidth = 1; ctx.beginPath();
        const step = 24;
        for (let y = 0; y < ph; y += step) { for (let x = 0; x < pw; x += 4) { const j = y * pw + x; const X = x - DX[j], Y = y - DY[j]; if (x) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); } }
        for (let x = 0; x < pw; x += step) { for (let y = 0; y < ph; y += 4) { const j = y * pw + x; const X = x - DX[j], Y = y - DY[j]; if (y) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); } }
        ctx.stroke();
      }
      dirty = false;
    };
    let dirty = true, raf = 0;
    const schedule = () => { dirty = true; if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (dirty) render(); }); };

    /* ---------- pincéis ---------- */
    const brush = (cx, cy, mx, my, dt) => {
      const R = (st.size * k) / 2, R2 = R * R;
      const dens = st.density / 100, pr = st.pressure / 100, rate = st.rate / 100;
      const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(pw - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(ph - 1, Math.ceil(cy + R));
      let sx = 0, sy = 0, sc = 0;
      if (st.tool === 'smooth') { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const j = y * pw + x; sx += DX[j]; sy += DY[j]; sc++; } if (sc) { sx /= sc; sy /= sc; } }
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
        if (d2 > R2) continue;
        const t = Math.sqrt(d2) / R;
        let w = 1 - t; w = (1 - dens) * (w > 0 ? 1 : 0) * (1 - t * t) + dens * w * w * (3 - 2 * w);
        w *= pr;
        const j = y * pw + x;
        if (st.tool === 'freeze') { FZ[j] = Math.min(1, FZ[j] + w); continue; }
        if (st.tool === 'thaw') { FZ[j] = Math.max(0, FZ[j] - w); continue; }
        w *= 1 - FZ[j];
        if (w <= 0) continue;
        switch (st.tool) {
          case 'warp': DX[j] -= mx * w; DY[j] -= my * w; break;
          case 'push': DX[j] -= my * w; DY[j] += mx * w; break;
          case 'reconstruct': DX[j] *= 1 - w * rate * 0.25 * dt; DY[j] *= 1 - w * rate * 0.25 * dt; break;
          case 'smooth': DX[j] += (sx - DX[j]) * w * 0.15 * dt; DY[j] += (sy - DY[j]) * w * 0.15 * dt; break;
          case 'pucker': DX[j] += dx * w * rate * 0.04 * dt; DY[j] += dy * w * rate * 0.04 * dt; break;
          case 'bloat': DX[j] -= dx * w * rate * 0.04 * dt; DY[j] -= dy * w * rate * 0.04 * dt; break;
          case 'twirlCW': case 'twirlCCW': {
            const a = (st.tool === 'twirlCW' ? -1 : 1) * w * rate * 0.04 * dt, c = Math.cos(a), s = Math.sin(a);
            DX[j] += dx * c - dy * s - dx; DY[j] += dx * s + dy * c - dy; break;
          }
        }
      }
      schedule();
    };
    const cursor = el('div.lq-cursor');
    const stage = el('div.lq-stage', view, cursor);
    let scale = 1;
    const fitView = () => {
      const r = stage.getBoundingClientRect();
      scale = Math.min((r.width - 20) / pw, (r.height - 20) / ph, 4);
      view.style.width = pw * scale + 'px'; view.style.height = ph * scale + 'px';
    };
    const toLocal = (e) => { const r = view.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * pw, y: ((e.clientY - r.top) / r.height) * ph }; };
    stage.addEventListener('pointermove', (e) => {
      const r = view.getBoundingClientRect();
      cursor.style.display = 'block';
      const d = st.size * k * (r.width / pw);
      cursor.style.width = cursor.style.height = d + 'px';
      const sr = stage.getBoundingClientRect();
      cursor.style.transform = 'translate(' + (e.clientX - sr.left - d / 2) + 'px,' + (e.clientY - sr.top - d / 2) + 'px)';
    });
    stage.addEventListener('pointerleave', () => { cursor.style.display = 'none'; });
    view.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      let last = toLocal(e), lastT = performance.now();
      const alt = e.altKey;
      const tool0 = st.tool;
      snap();
      if (alt && st.tool === 'freeze') st.tool = 'thaw'; else if (alt && st.tool === 'thaw') st.tool = 'freeze';
      if (alt && (st.tool === 'twirlCW' || st.tool === 'twirlCCW')) st.tool = st.tool === 'twirlCW' ? 'twirlCCW' : 'twirlCW';
      if (alt && st.tool === 'pucker') st.tool = 'bloat'; else if (alt && st.tool === 'bloat') st.tool = 'pucker';
      brush(last.x, last.y, 0, 0, 1);
      let timer = null;
      const stationary = ['reconstruct', 'smooth', 'pucker', 'bloat', 'twirlCW', 'twirlCCW'].includes(st.tool);
      if (stationary) timer = setInterval(() => brush(last.x, last.y, 0, 0, 1), 30);
      U.drag(e, (ev) => {
        const p = toLocal(ev), now = performance.now();
        const mx = p.x - last.x, my = p.y - last.y;
        const steps = Math.max(1, Math.ceil(Math.hypot(mx, my) / Math.max(1, (st.size * k) / 8)));
        for (let i = 1; i <= steps; i++) brush(last.x + (mx * i) / steps, last.y + (my * i) / steps, mx / steps, my / steps, Math.min(3, (now - lastT) / 30 / steps + 0.3));
        last = p; lastT = now;
      }, () => { if (timer) clearInterval(timer); st.tool = tool0; });
    });

    /* ---------- painel lateral ---------- */
    const toolsBar = el('div.lq-tools');
    const paintTools = () => {
      U.clear(toolsBar);
      TOOLS.forEach(([id, name, key]) => {
        const b = UI.iconBtn(ICON[id], name + (key ? ' (' + key + ')' : ''), () => { st.tool = id; paintTools(); renderProps(); }, { active: st.tool === id });
        toolsBar.appendChild(b);
      });
    };
    const props = el('div.lq-props');
    const save = () => U.store.set('liquify', { size: st.size, density: st.density, pressure: st.pressure, rate: st.rate, mesh: st.mesh, showMask: st.showMask });
    const renderProps = () => {
      U.clear(props);
      props.appendChild(el('h3.form-title', { text: 'Opções do pincel' }));
      props.appendChild(UI.slider({ label: 'Tamanho', value: st.size, min: 1, max: 3000, pow: 2.5, unit: 'px', stack: true, onInput: (v) => { st.size = v; save(); } }).el);
      props.appendChild(UI.slider({ label: 'Densidade', value: st.density, min: 0, max: 100, unit: '%', stack: true, onInput: (v) => { st.density = v; save(); } }).el);
      props.appendChild(UI.slider({ label: 'Pressão', value: st.pressure, min: 1, max: 100, unit: '%', stack: true, onInput: (v) => { st.pressure = v; save(); } }).el);
      props.appendChild(UI.slider({ label: 'Taxa', value: st.rate, min: 0, max: 100, unit: '%', stack: true, onInput: (v) => { st.rate = v; save(); } }).el);
      props.appendChild(el('h3.form-title', { text: 'Reconstrução' }));
      props.appendChild(el('div.props-actions',
        UI.btn('Restaurar tudo', () => { snap(); DX.fill(0); DY.fill(0); schedule(); }, { small: true }),
        UI.btn('Reconstruir…', () => { snap(); for (let i = 0; i < DX.length; i++) { const f = 0.5 + 0.5 * FZ[i]; DX[i] *= f; DY[i] *= f; } schedule(); }, { small: true })));
      props.appendChild(el('h3.form-title', { text: 'Opções de máscara' }));
      props.appendChild(el('div.props-actions',
        UI.btn('Nenhuma', () => { snap(); FZ.fill(0); schedule(); }, { small: true }),
        UI.btn('Mascarar tudo', () => { snap(); FZ.fill(1); schedule(); }, { small: true }),
        UI.btn('Inverter', () => { snap(); for (let i = 0; i < FZ.length; i++) FZ[i] = 1 - FZ[i]; schedule(); }, { small: true })));
      props.appendChild(el('h3.form-title', { text: 'Exibir' }));
      props.appendChild(el('div.form-row.solo', UI.check('Mostrar máscara', st.showMask, (v) => { st.showMask = v; save(); schedule(); }).el));
      props.appendChild(el('div.form-row.solo', UI.check('Mostrar malha', st.mesh, (v) => { st.mesh = v; save(); schedule(); }).el));
      props.appendChild(el('p.dialog-note', { text: '[ e ]: tamanho do pincel · Alt: inverte Franzir/Inflar, Redemoinho e Congelar/Descongelar · Ctrl+Z: desfazer' }));
    };
    paintTools(); renderProps();

    const onKey = (e) => {
      const map = { w: 'warp', r: 'reconstruct', e: 'smooth', c: 'twirlCW', s: 'pucker', b: 'bloat', o: 'push', f: 'freeze', d: 'thaw' };
      if (U.isTyping(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.stopPropagation(); const u = undo.pop(); if (u) { DX.set(u[0]); DY.set(u[1]); FZ.set(u[2]); schedule(); } return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (map[e.key]) { st.tool = map[e.key]; paintTools(); renderProps(); }
      else if (e.key === '[' || e.key === ']') { st.size = U.clamp(Math.round(st.size * (e.key === ']' ? 1.15 : 0.87)), 1, 3000); renderProps(); save(); }
    };
    window.addEventListener('keydown', onKey, true);

    let applied = false;
    const dlg = UI.dialog({
      title: 'Dissolver', width: Math.min(1180, window.innerWidth - 40), className: 'lq-dialog', noFocus: true,
      body: el('div.lq-wrap', toolsBar, stage, props),
      buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: (d) => {
        applied = true;
        U.$$('button', d.foot).forEach((b) => { b.disabled = true; });
        // amplia o campo para a resolução total
        const fx = new Float32Array(W * H), fy = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const gx = Math.min(pw - 1, (x + 0.5) * k - 0.5), gy = Math.min(ph - 1, (y + 0.5) * k - 0.5);
          const x0 = Math.max(0, Math.floor(gx)), y0 = Math.max(0, Math.floor(gy)), x1 = Math.min(pw - 1, x0 + 1), y1 = Math.min(ph - 1, y0 + 1);
          const tx = Math.max(0, gx - x0), ty = Math.max(0, gy - y0);
          const a = y0 * pw + x0, b = y0 * pw + x1, c = y1 * pw + x0, e2 = y1 * pw + x1, j = y * W + x;
          fx[j] = ((DX[a] * (1 - tx) + DX[b] * tx) * (1 - ty) + (DX[c] * (1 - tx) + DX[e2] * tx) * ty) / k;
          fy[j] = ((DY[a] * (1 - tx) + DY[b] * tx) * (1 - ty) + (DY[c] * (1 - tx) + DY[e2] * tx) * ty) / k;
        }
        S.run('displaceField', { dx: fx, dy: fy, fw: W, fh: H, edge: 'clamp' });
        S.commit('Dissolver').then(() => d.close('ok'));
        return false;
      } }],
      onClose: (v) => { window.removeEventListener('keydown', onKey, true); if (v !== 'ok' && !applied) S.cancel(); }
    });
    void dlg;
    requestAnimationFrame(() => { fitView(); render(); });
  }

  IMG.Liquify = { open };
  IMG.FX.register('liquify', { label: 'Dissolver', keys: ['ctrl+shift+x'], custom: () => open() });
})();
