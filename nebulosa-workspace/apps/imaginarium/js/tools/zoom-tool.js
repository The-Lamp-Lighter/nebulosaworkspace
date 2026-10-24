/* ==========================================================================
   Imaginarium — ferramentas Zoom e Mão
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG;

  IMG.Tools.register({
    id: 'zoom', name: 'Zoom', icon: 'zoom', key: 'z', group: 'view',
    defaults: { scrubby: true },
    hint: 'Clique: ampliar · Alt+clique: reduzir · Arraste: zoom contínuo',
    cursor() { return 'zoom-in'; },
    options() {
      const E = IMG.Engine;
      return [
        { type: 'check', key: 'scrubby', label: 'Zoom ao arrastar' },
        { type: 'sep' },
        { type: 'button', label: 'Ampliar', icon: 'zoomIn', action: () => E.zoomStep(1) },
        { type: 'button', label: 'Reduzir', icon: 'zoomOut', action: () => E.zoomStep(-1) },
        { type: 'sep' },
        { type: 'button', label: '100%', action: () => E.actualSize() },
        { type: 'button', label: 'Ajustar à janela', icon: 'fit', action: () => E.fit() },
        { type: 'button', label: 'Preencher janela', action: () => E.fit(true, true) }
      ];
    },
    down(ev) { this.d = { sx: ev.sx, sy: ev.sy, z: IMG.app.doc.view.zoom, moved: false, alt: ev.alt }; },
    move(ev) {
      const d = this.d; if (!d) return;
      const dx = ev.sx - d.sx;
      if (Math.abs(dx) > 3) d.moved = true;
      if (d.moved && IMG.Tools.o('zoom').scrubby) IMG.Engine.zoomTo(d.z * Math.exp(dx * 0.008), d.sx, d.sy, false);
    },
    up(ev) {
      const d = this.d; this.d = null;
      if (d && !d.moved) IMG.Engine.zoomStep(d.alt || ev.alt ? -1 : 1, ev.sx, ev.sy);
    },
    hover(ev) { IMG.Tools.cursor(ev.alt ? 'zoom-out' : 'zoom-in'); },
    dblclick() { IMG.Engine.actualSize(); }
  });

  IMG.Tools.register({
    id: 'hand', name: 'Mão', icon: 'hand', key: 'h', group: 'view', cursor: 'grab',
    defaults: {},
    hint: 'Arraste para percorrer a imagem · Espaço ativa a Mão em qualquer ferramenta',
    options() {
      const E = IMG.Engine;
      return [
        { type: 'button', label: '100%', action: () => E.actualSize() },
        { type: 'button', label: 'Ajustar à janela', icon: 'fit', action: () => E.fit() },
        { type: 'button', label: 'Preencher janela', action: () => E.fit(true, true) }
      ];
    },
    down(ev) { this.p = { x: ev.e.clientX, y: ev.e.clientY }; IMG.Tools.cursor('grabbing'); },
    move(ev) {
      if (!this.p) return;
      IMG.Engine.panBy(ev.e.clientX - this.p.x, ev.e.clientY - this.p.y);
      this.p = { x: ev.e.clientX, y: ev.e.clientY };
    },
    up() { this.p = null; IMG.Tools.cursor('grab'); },
    dblclick() { IMG.Engine.fit(); }
  });

  /* ---------- Girar vista (R no Photoshop; grupo da Mão) ---------- */
  const deg = () => { const d = IMG.app.doc; return d ? Math.round(((d.view.rot || 0) * 180) / Math.PI * 10) / 10 : 0; };
  IMG.Tools.register({
    id: 'rotateView', name: 'Girar vista', icon: 'rotateView', group: 'view', cursor: 'grab',
    defaults: { allDocs: false },
    hint: 'Arraste para girar a vista · Shift: passos de 15° · Esc ou duplo clique: redefinir',
    options() {
      return [
        { type: 'number', label: 'Ângulo de rotação', value: deg(), min: -180, max: 180, decimals: 1, unit: '°', width: 74, onChange: (v) => this.setAngle(v) },
        { type: 'button', label: 'Redefinir vista', action: () => this.setAngle(0) },
        { type: 'check', key: 'allDocs', label: 'Girar todas as janelas' }
      ];
    },
    setAngle(a) {
      const E = IMG.Engine;
      if (IMG.Tools.o('rotateView').allDocs) IMG.app.docs.forEach((d) => { d.view.rot = (a * Math.PI) / 180; });
      E.setRotation(a);
      IMG.UI.renderOptions();
    },
    center() { const E = IMG.Engine; return { x: E.w / 2, y: E.h / 2 }; },
    down(ev) {
      const c = this.center(), r = ev.e && ev.e.clientX != null ? IMG.Engine.canvas.getBoundingClientRect() : null;
      const px = r ? ev.e.clientX - r.left : ev.sx, py = r ? ev.e.clientY - r.top : ev.sy;
      this.d = { a0: Math.atan2(py - c.y, px - c.x), deg0: deg() };
      IMG.Tools.cursor('grabbing');
    },
    move(ev) {
      if (!this.d) return;
      const c = this.center(), r = ev.e && ev.e.clientX != null ? IMG.Engine.canvas.getBoundingClientRect() : null;
      const px = r ? ev.e.clientX - r.left : ev.sx, py = r ? ev.e.clientY - r.top : ev.sy;
      let a = this.d.deg0 + ((Math.atan2(py - c.y, px - c.x) - this.d.a0) * 180) / Math.PI;
      if (ev.shift) a = Math.round(a / 15) * 15;
      a = ((a % 360) + 540) % 360 - 180;
      if (IMG.Tools.o('rotateView').allDocs) IMG.app.docs.forEach((d) => { d.view.rot = (a * Math.PI) / 180; });
      IMG.Engine.setRotation(a);
      IMG.UI.setHint(Math.round(a * 10) / 10 + '°');
    },
    up() { this.d = null; IMG.Tools.cursor('grab'); IMG.UI.setHint(''); IMG.UI.renderOptions(); },
    dblclick() { this.setAngle(0); },
    onKey(e) { if (e.key === 'Escape') { this.setAngle(0); return true; } return false; },
    drawOverlay(ctx, v) {
      // bússola no centro durante o arraste
      if (!this.d) return;
      ctx.save(); ctx.setTransform(IMG.Engine.dpr, 0, 0, IMG.Engine.dpr, 0, 0);
      const cx = v.w / 2, cy = v.h / 2, a = (deg() * Math.PI) / 180;
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.fillStyle = 'rgba(20,22,26,.55)';
      ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.translate(cx, cy); ctx.rotate(a);
      ctx.fillStyle = '#e04848'; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(7, 0); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d6d9de'; ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(7, 0); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  });
})();
