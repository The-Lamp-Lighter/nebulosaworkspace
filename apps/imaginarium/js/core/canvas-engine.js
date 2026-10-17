/* ==========================================================================
   Imaginarium — motor de renderização
   - composição das camadas (com cache durante pinceladas)
   - viewport com zoom/pan suaves e rolagem infinita
   - réguas, grade, guias, guias inteligentes e contorno de seleção
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus;

  const ZOOM_STEPS = [0.01, 0.02, 0.03, 0.05, 0.0667, 0.1, 0.125, 0.1667, 0.25, 0.3333, 0.5, 0.6667, 1, 1.5, 2, 3, 4, 5, 6, 8, 12, 16, 24, 32, 48, 64];
  const RULER_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000];

  const Engine = (IMG.Engine = {
    MINZ: 0.01, MAXZ: 64,
    vp: null, canvas: null, ctx: null, rh: null, rv: null,
    w: 0, h: 0, dpr: 1,
    comp: null, compDirty: true, needsDraw: true, rulersDirty: true,
    temps: [], cache: null,
    ants: 0, antT: 0, hideAnts: false,
    smart: [], dragGuide: null,
    anim: null, panAnim: null,
    checker: null, checkerKey: '',

    init() {
      this.vp = U.$('#viewport');
      this.canvas = U.$('#screen');
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.rh = U.$('#ruler-h'); this.rv = U.$('#ruler-v');
      this.markH = U.$('#ruler-mark-h'); this.markV = U.$('#ruler-mark-v');

      if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(this.vp);
      window.addEventListener('resize', () => this.resize());
      this.resize();

      this.vp.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      this.initRulers();

      bus.on('layers:change', () => this.invalidate());
      bus.on('layers:select', () => this.requestRender());
      bus.on('layer:pixels', () => this.invalidate());
      bus.on('selection:change', () => this.requestRender());
      bus.on('doc:resize', () => this.invalidate());
      bus.on('doc:change', () => {
        this.endStrokeCache();
        const doc = IMG.app.doc;
        if (doc && !doc.view.ready) { this.fit(false); doc.view.ready = true; }
        this.invalidate(); this.viewChanged();
      });
      bus.on('prefs:change', () => { this.applyPrefs(); this.resize(); this.viewChanged(); });
      this.applyPrefs();

      const loop = (t) => { this.frame(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    },

    /** Animação suave de zoom/rolagem (o Photopea não anima). */
    smooth() { return !!IMG.app.prefs.smoothZoom && !(IMG.Skins && IMG.Skins.current === 'photopea'); },
    applyPrefs() {
      const p = IMG.app.prefs;
      U.$('#stage').classList.toggle('no-rulers', !p.showRulers);
    },

    get doc() { return IMG.app.doc; },

    /* ---------- controle de redesenho ---------- */
    /** Marca o documento para recompor (todo, ou só o retângulo r, em coordenadas do documento). */
    invalidate(r) {
      if (!r) this.compDirty = true;
      else if (!this.compDirty) this.dirty = U.rectUnion(this.dirty, U.rectInt(r));
      this.needsDraw = true;
    },
    /** Recompõe a área r de uma camada (considerando efeitos que se espalham). */
    invalidateLayer(L, r) {
      if (!r || !L) { this.invalidate(); return; }
      for (let q = L; q; q = q.parent) if (IMG.Effects && IMG.Effects.active(q)) { this.invalidate(); return; }
      const doc = this.doc;
      // camadas com "Dissolver" ou efeitos acima também ficam corretas, pois a composição é por pixel
      if (doc) { const list = L.parent ? L.parent.children : doc.layers, i = list.indexOf(L); for (let k = i + 1; k < list.length && list[k].clip; k++) if (IMG.Effects && IMG.Effects.active(list[k])) { this.invalidate(); return; } }
      this.invalidate(r);
    },
    requestRender() { this.needsDraw = true; },
    viewChanged() { this.needsDraw = true; this.rulersDirty = true; bus.emit('view:change'); },

    resize() {
      const r = this.vp.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (r.width < 1 || r.height < 1) return;
      this.w = r.width; this.h = r.height; this.dpr = dpr;
      const cw = Math.round(r.width * dpr), ch = Math.round(r.height * dpr);
      if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
      this.canvas.style.width = r.width + 'px'; this.canvas.style.height = r.height + 'px';
      for (const rc of [this.rh, this.rv]) {
        const rr = rc.getBoundingClientRect();
        rc.width = Math.max(1, Math.round(rr.width * dpr)); rc.height = Math.max(1, Math.round(rr.height * dpr));
      }
      this.needsDraw = true; this.rulersDirty = true;
    },

    /* ---------- conversão de coordenadas ---------- */
    s2d(sx, sy) { const v = this.doc.view; return { x: (sx - v.x) / v.zoom, y: (sy - v.y) / v.zoom }; },
    /** Converte coordenadas reais da tela em "virtuais" (sem a rotação da vista). */
    toVirtual(sx, sy) {
      const doc = this.doc, r = doc && doc.view.rot;
      if (!r) return { x: sx, y: sy };
      const cx = this.w / 2, cy = this.h / 2, c = Math.cos(-r), s = Math.sin(-r), dx = sx - cx, dy = sy - cy;
      return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
    },
    fromVirtual(sx, sy) {
      const doc = this.doc, r = doc && doc.view.rot;
      if (!r) return { x: sx, y: sy };
      const cx = this.w / 2, cy = this.h / 2, c = Math.cos(r), s = Math.sin(r), dx = sx - cx, dy = sy - cy;
      return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
    },
    setRotation(deg) {
      const doc = this.doc; if (!doc) return;
      doc.view.rot = U.rad(((deg % 360) + 540) % 360 - 180);
      this.viewChanged();
    },
    d2s(x, y) { const v = this.doc.view; return { x: v.x + x * v.zoom, y: v.y + y * v.zoom }; },

    /* ---------- zoom e pan ---------- */
    setZoom(z, ax, ay) {
      const doc = this.doc; if (!doc) return;
      const v = doc.view;
      z = U.clamp(z, this.MINZ, this.MAXZ);
      if (ax == null) { ax = this.w / 2; ay = this.h / 2; }
      const px = (ax - v.x) / v.zoom, py = (ay - v.y) / v.zoom;
      v.zoom = z; v.x = ax - px * z; v.y = ay - py * z;
      this.viewChanged();
    },
    zoomTo(z, ax, ay, animate = true) {
      if (!this.doc) return;
      z = U.clamp(z, this.MINZ, this.MAXZ);
      if (ax == null) { ax = this.w / 2; ay = this.h / 2; }
      this.panAnim = null;
      if (!animate || !this.smooth()) { this.anim = null; this.setZoom(z, ax, ay); return; }
      this.anim = { target: z, ax, ay };
      this.needsDraw = true;
    },
    targetZoom() { return this.anim ? this.anim.target : this.doc.view.zoom; },
    zoomStep(dir, ax, ay) {
      if (!this.doc) return;
      const cur = this.targetZoom();
      let z;
      if (dir > 0) z = ZOOM_STEPS.find((s) => s > cur * 1.001) || this.MAXZ;
      else z = ZOOM_STEPS.slice().reverse().find((s) => s < cur * 0.999) || this.MINZ;
      this.zoomTo(z, ax, ay);
    },
    fit(animate = true, fill = false) {
      const doc = this.doc; if (!doc || this.w < 10) return;
      const pad = 36;
      const zx = (this.w - pad * 2) / doc.width, zy = (this.h - pad * 2) / doc.height;
      let z = fill ? Math.max(zx, zy) : Math.min(zx, zy);
      z = U.clamp(z, this.MINZ, this.MAXZ);
      const tx = Math.round((this.w - doc.width * z) / 2), ty = Math.round((this.h - doc.height * z) / 2);
      this.anim = null; this.panAnim = null;
      if (animate && this.smooth() && doc.view.ready) this.anim = { target: z, tx, ty };
      else { doc.view.zoom = z; doc.view.x = tx; doc.view.y = ty; this.viewChanged(); }
      this.needsDraw = true;
    },
    actualSize() {
      const doc = this.doc; if (!doc) return;
      const tx = Math.round((this.w - doc.width) / 2), ty = Math.round((this.h - doc.height) / 2);
      if (this.smooth()) { this.anim = { target: 1, tx, ty }; this.needsDraw = true; }
      else { doc.view.zoom = 1; doc.view.x = tx; doc.view.y = ty; this.viewChanged(); }
    },
    panBy(dx, dy) {
      const doc = this.doc; if (!doc) return;
      this.anim = null; this.panAnim = null;
      doc.view.x += dx; doc.view.y += dy;
      this.viewChanged();
    },
    /** Centraliza um ponto do documento na viewport. */
    centerOn(x, y) {
      const doc = this.doc; if (!doc) return;
      const v = doc.view;
      this.anim = null; this.panAnim = null;
      v.x = this.w / 2 - x * v.zoom; v.y = this.h / 2 - y * v.zoom;
      this.viewChanged();
    },

    onWheel(e) {
      e.preventDefault();
      const doc = this.doc; if (!doc) return;
      const r = this.vp.getBoundingClientRect();
      const ax = e.clientX - r.left, ay = e.clientY - r.top;
      let dx = e.deltaX, dy = e.deltaY;
      if (e.deltaMode === 1) { dx *= 32; dy *= 32; }
      else if (e.deltaMode === 2) { dx *= this.w; dy *= this.h; }
      // Como no Photopea: roda = rolar na vertical · Ctrl+roda = rolar na horizontal · Alt+roda = zoom.
      // A pinça do touchpad chega como Ctrl+roda com valores pequenos: vira zoom.
      const pinch = e.ctrlKey && !e.metaKey && e.deltaMode === 0 && Math.abs(e.deltaY) < 50 && !e.deltaX;
      const zoomMode = e.altKey || e.metaKey || pinch || (IMG.app.prefs.wheelZoom && !e.ctrlKey && !e.shiftKey);
      if (zoomMode) {
        const f = Math.exp(-dy * (pinch ? 0.012 : 0.0018));
        this.zoomTo(this.targetZoom() * f, ax, ay);
      } else {
        if ((e.ctrlKey || e.shiftKey) && !dx) { dx = dy; dy = 0; }
        this.anim = null;
        const v = doc.view;
        if (!this.smooth()) { this.panAnim = null; v.x -= dx; v.y -= dy; this.viewChanged(); return; }
        if (!this.panAnim) this.panAnim = { x: v.x, y: v.y };
        this.panAnim.x -= dx; this.panAnim.y -= dy;
        this.needsDraw = true;
      }
    },

    stepAnimations() {
      const doc = this.doc, v = doc.view;
      if (this.anim) {
        const a = this.anim;
        const lz = Math.log(v.zoom), lt = Math.log(a.target);
        let n = lz + (lt - lz) * 0.32, done = false;
        if (Math.abs(lt - n) < 0.004) { n = lt; done = true; }
        if (a.tx != null) {
          const t = done ? 1 : 0.32;
          v.zoom = Math.exp(n);
          v.x += (a.tx - v.x) * t; v.y += (a.ty - v.y) * t;
          if (done) { v.x = a.tx; v.y = a.ty; }
          this.viewChanged();
        } else this.setZoom(Math.exp(n), a.ax, a.ay);
        if (done) this.anim = null;
        this.needsDraw = true;
      }
      if (this.panAnim) {
        const p = this.panAnim;
        const dx = p.x - v.x, dy = p.y - v.y;
        if (Math.abs(dx) < 0.6 && Math.abs(dy) < 0.6) { v.x = p.x; v.y = p.y; this.panAnim = null; }
        else { v.x += dx * 0.4; v.y += dy * 0.4; }
        this.viewChanged();
      }
    },

    /* ---------- composição ---------- */
    /** Canvas temporário de trabalho (por profundidade e uso), limpo, do tamanho de R. */
    tmp(depth, slot, R) {
      const key = depth + ':' + slot;
      let c = this.temps[key];
      const w = Math.max(1, R.w | 0), h = Math.max(1, R.h | 0);
      if (!c) { c = this.temps[key] = U.createCanvas(w, h); return c; }
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      else { const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, w, h); }
      return c;
    },

    /** Assinatura do conteúdo de uma camada (para caches). */
    key(L) {
      let k = L.id + '/' + (L._ver || 0) + '/' + L.x + ',' + L.y + '/' + (L.visible ? 1 : 0) + '/' + L.opacity + '/' + L.fill + '/' + L.blend + (L.clip ? '/c' : '');
      const m = L.mask;
      if (m) k += '/m' + (m._ver || 0) + ',' + m.x + ',' + m.y + (m.enabled ? 1 : 0) + ',' + (m.density == null ? 100 : m.density) + ',' + (m.feather || 0);
      if (L.vmask) k += '/v' + (L.vmask._ver || 0) + (L.vmask.enabled === false ? 0 : 1);
      if (L.fx) k += '/f' + JSON.stringify(L.fx);
      if (L.adj) k += '/a' + JSON.stringify(L.adj);
      if (L.adv) k += '/b' + JSON.stringify(L.adv);
      if (L.type === 'group') k += '[' + L.children.map((c) => this.key(c)).join(';') + ']';
      return k;
    },

    /** Recorta o conteúdo de ctx (no espaço de R) pelas máscaras da camada. */
    applyMasks(ctx, L, R, depth) {
      const m = L.mask;
      if (m && m.enabled !== false && m.canvas) {
        const eff = this.maskSurface(m);
        const covers = m.x <= R.x && m.y <= R.y && m.x + m.canvas.width >= R.x + R.w && m.y + m.canvas.height >= R.y + R.h;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        if (covers || !m.bg) {
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(eff, m.x - R.x, m.y - R.y);
        } else {
          const M = this.tmp(depth, 'mk', R), mc = M.getContext('2d');
          mc.fillStyle = '#fff'; mc.fillRect(0, 0, R.w, R.h);
          mc.clearRect(m.x - R.x, m.y - R.y, m.canvas.width, m.canvas.height);
          mc.drawImage(eff, m.x - R.x, m.y - R.y);
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(M, 0, 0);
        }
        ctx.restore();
      }
      const v = L.vmask;
      if (v && v.enabled !== false && IMG.Paths) {
        const vc = IMG.Paths.maskCanvas(v, this.curDoc());
        if (vc) {
          ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(vc.canvas, vc.x - R.x, vc.y - R.y);
          ctx.restore();
        }
      }
    },

    /** Máscara efetiva (densidade e difusão aplicadas), em cache. */
    maskSurface(m) {
      const dens = m.density == null ? 100 : m.density, fea = m.feather || 0;
      if (dens >= 100 && fea <= 0) return m.canvas;
      const key = (m._ver || 0) + ':' + dens + ':' + fea + ':' + m.canvas.width + 'x' + m.canvas.height;
      if (m._eff && m._effKey === key) return m._eff;
      const pad = Math.ceil(fea * 2);
      let c = U.createCanvas(m.canvas.width, m.canvas.height);
      const x = c.getContext('2d');
      if (fea > 0 && typeof x.filter === 'string') { x.filter = 'blur(' + fea + 'px)'; x.drawImage(m.canvas, 0, 0); x.filter = 'none'; }
      else x.drawImage(m.canvas, 0, 0);
      if (dens < 100) {
        // alfa efetivo = 1 - d * (1 - m)
        const k = 1 - dens / 100;
        x.globalCompositeOperation = 'destination-over';
        x.fillStyle = 'rgba(255,255,255,' + k + ')';
        x.fillRect(0, 0, c.width, c.height);
        x.globalCompositeOperation = 'source-over';
      }
      void pad;
      m._eff = c; m._effKey = key;
      return c;
    },

    /** Valores (0..255) da máscara de uma camada no retângulo R, ou null. */
    maskValues(L, R) {
      const m = L.mask;
      if (!m || m.enabled === false || !m.canvas) return null;
      const c = U.createCanvas(R.w, R.h), x = c.getContext('2d');
      if (m.bg) { x.fillStyle = '#fff'; x.fillRect(0, 0, R.w, R.h); x.clearRect(m.x - R.x, m.y - R.y, m.canvas.width, m.canvas.height); }
      x.drawImage(this.maskSurface(m), m.x - R.x, m.y - R.y);
      const d = x.getImageData(0, 0, R.w, R.h).data, out = new Uint8Array(R.w * R.h);
      for (let i = 0, j = 3; i < out.length; i++, j += 4) out[i] = d[j];
      return out;
    },

    /** Desenha os pixels da camada (× máscaras) em ctx, no espaço de R. */
    renderContent(ctx, L, R, depth) {
      if (L.type === 'group' && L.artboard) {
        const a = L.artboard;
        if (a.bg && a.bg !== 'transparent') { ctx.fillStyle = a.bg; ctx.fillRect(a.x - R.x, a.y - R.y, a.w, a.h); }
        this.drawList(ctx, L.children, R, depth + 1);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = '#000'; ctx.fillRect(a.x - R.x, a.y - R.y, a.w, a.h); ctx.restore();
      } else if (L.type === 'group') this.drawList(ctx, L.children, R, depth + 1);
      else if (L.canvas) ctx.drawImage(L.canvas, L.x - R.x, L.y - R.y);
      this.applyMasks(ctx, L, R, depth);
    },

    drawList(ctx, list, R, depth) {
      for (let i = 0; i < list.length;) {
        let j = i + 1;
        while (j < list.length && list[j].clip) j++;
        this.drawLayer(ctx, list[i], R, depth, j > i + 1 ? list.slice(i + 1, j) : null);
        i = j;
      }
    },

    /** result = B0·(1−k) + atual·k, com k = alfa × máscara da camada. */
    _lerpMask(ctx, B0, L, alpha, R, depth) {
      const K = this.tmp(depth, 'lk', R), kc = K.getContext('2d');
      kc.fillStyle = 'rgba(255,255,255,' + alpha + ')'; kc.fillRect(0, 0, R.w, R.h);
      this.applyMasks(kc, L, R, depth);
      const X = this.tmp(depth, 'lx', R), xc = X.getContext('2d');
      xc.drawImage(ctx.canvas, 0, 0);
      xc.globalCompositeOperation = 'destination-in'; xc.drawImage(K, 0, 0);
      const bc = B0.getContext('2d');
      bc.globalCompositeOperation = 'destination-out'; bc.drawImage(K, 0, 0); bc.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'copy'; ctx.drawImage(X, 0, 0);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(B0, 0, 0);
      ctx.restore();
    },

    applyAdjust(ctx, L, R) {
      if (!L.adj || !IMG.Adjust || !IMG.Adjust.layerApply) return;
      const k = L.opacity * (L.fill == null ? 1 : L.fill);
      if (k <= 0) return;
      const W = ctx.canvas.width, H = ctx.canvas.height;
      const img = ctx.getImageData(0, 0, W, H);
      const m = this.maskValues(L, R);
      IMG.Adjust.layerApply(L.adj, img, k, m, L.blend, this.curDoc(), R);
      ctx.putImageData(img, 0, 0);
    },

    drawLayer(ctx, L, R, depth, clipped) {
      if (!L.visible || L._hidden) return;
      const alpha = L.opacity;
      if (L.type === 'adjust') { if (alpha > 0) this.applyAdjust(ctx, L, R); return; }
      const fxOn = IMG.Effects && IMG.Effects.active(L);
      const adv = L.adv || null;
      if (L.type === 'group') {
        if (!L.children.length && !clipped && !L.artboard) return;
        if (L.blend === 'pass' && !clipped && !fxOn && !L.artboard && !(adv && (adv.blendIf || adv.channels))) {
          if (alpha <= 0) return;
          const masked = (L.mask && L.mask.enabled !== false) || (L.vmask && L.vmask.enabled !== false);
          if (alpha >= 1 && !masked) { this.drawList(ctx, L.children, R, depth + 1); return; }
          const B0 = this.tmp(depth, 'p0', R);
          B0.getContext('2d').drawImage(ctx.canvas, 0, 0);
          this.drawList(ctx, L.children, R, depth + 1);
          this._lerpMask(ctx, B0, L, alpha, R, depth);
          return;
        }
      }
      if (alpha <= 0) return;
      const fill = L.type === 'group' ? 1 : (L.fill == null ? 1 : L.fill);
      const A = this.tmp(depth, 'a', R);
      const ac = A.getContext('2d');
      this.renderContent(ac, L, R, depth);
      const blend = L.blend === 'pass' ? 'normal' : L.blend;
      const opts = adv && (adv.blendIf || adv.channels) ? adv : null;
      let S = null;
      if (fxOn) {
        const doc = this.curDoc();
        const self = this;
        const fr = IMG.Effects.get(L, doc, L.contentBounds(), (E) => {
          const c = U.createCanvas(E.w, E.h), x = c.getContext('2d');
          if (L.type === 'group') self.drawList(x, L.children, E, depth + 40);
          else if (L.canvas) x.drawImage(L.canvas, L.x - E.x, L.y - E.y);
          self.applyMasks(x, L, E, depth + 40);
          return c;
        }, this.key(L));
        if (fr) {
          for (const b of fr.below) IMG.Blend.draw(ctx, b.c, b.x - R.x, b.y - R.y, b.blend, b.opacity * alpha);
          if (fr.body) {
            S = this.tmp(depth, 's', R);
            S.getContext('2d').drawImage(fr.body.c, fr.body.x - R.x, fr.body.y - R.y);
          }
        }
        if (!S) return;
      }
      if (clipped) {
        if (!S) {
          S = this.tmp(depth, 's', R);
          const sc = S.getContext('2d'); sc.globalAlpha = fill; sc.drawImage(A, 0, 0); sc.globalAlpha = 1;
        }
        for (const C of clipped) {
          if (!C.visible) continue;
          if (C.type === 'adjust') { this.applyAdjust(S.getContext('2d'), C, R); continue; }
          const X = this.tmp(depth, 'x', R), xc = X.getContext('2d');
          xc.drawImage(S, 0, 0);
          this.drawLayer(xc, C, R, depth + 1, null);
          // S = X·a + S·(1 − a), a = alfa do conteúdo da base
          xc.globalCompositeOperation = 'destination-in'; xc.drawImage(A, 0, 0); xc.globalCompositeOperation = 'source-over';
          const sc = S.getContext('2d');
          sc.globalCompositeOperation = 'destination-out'; sc.drawImage(A, 0, 0);
          sc.globalCompositeOperation = 'lighter'; sc.drawImage(X, 0, 0);
          sc.globalCompositeOperation = 'source-over';
        }
      }
      if (S) IMG.Blend.draw(ctx, S, 0, 0, blend, alpha, opts);
      else IMG.Blend.draw(ctx, A, 0, 0, blend, alpha * fill, opts);
    },

    renderComposite(doc, region) {
      let full = false;
      if (!this.comp || this.comp.width !== doc.width || this.comp.height !== doc.height) { this.comp = U.createCanvas(doc.width, doc.height); full = true; }
      let R = full || !region ? doc.rect : U.rectIntersect(U.rectInt(region), doc.rect);
      this.compDirty = false; this.dirty = null;
      if (!R) return;
      const T = this.tmp(-1, 'root', R);
      this.doc_ = doc;
      try { this.drawList(T.getContext('2d'), doc.layers, R, 0); } catch (err) { console.error(err); }
      if (this.postProcess && doc.mode && doc.mode !== 'rgb') { try { this.postProcess(T.getContext('2d'), R, doc); } catch (err) { console.error(err); } }
      const ctx = this.comp.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(R.x, R.y, R.w, R.h);
      ctx.drawImage(T, R.x, R.y);
    },

    /* compatibilidade: a renderização por região substitui o cache de pincelada */
    beginStrokeCache() {},
    endStrokeCache() {},

    /** Imagem achatada do documento (para exportar, copiar mesclado, etc.). */
    /** Documento sendo renderizado agora (o ativo, ou o que está sendo achatado). */
    curDoc() { return this._flatDoc || this.doc || IMG.app.doc; },
    flatten(doc, background) {
      const c = U.createCanvas(doc.width, doc.height), ctx = c.getContext('2d');
      if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, doc.width, doc.height); }
      const t = U.createCanvas(doc.width, doc.height);
      const prevFlat = this._flatDoc; this._flatDoc = doc;
      try { this.drawList(t.getContext('2d'), doc.layers, doc.rect, 60); } finally { this._flatDoc = prevFlat; }
      if (this.postProcess && doc.mode && doc.mode !== 'rgb') { try { this.postProcess(t.getContext('2d'), doc.rect, doc); } catch (err) { console.error(err); } }
      ctx.drawImage(t, 0, 0);
      return c;
    },

    /** Imagem composta só com as camadas abaixo de L (e L, se include). Usada por "Atual e abaixo". */
    compositeBelow(doc, L, include = true) {
      const hidden = [];
      let found = false;
      const rec = (list) => {
        for (const q of list) {
          if (found) { if (!q._hidden) { q._hidden = true; hidden.push(q); } continue; }
          if (q === L) { found = true; if (!include) { q._hidden = true; hidden.push(q); } continue; }
          if (q.type === 'group' && q.children) rec(q.children);
        }
      };
      rec(doc.layers);
      let c;
      try { c = this.flatten(doc); } finally { hidden.forEach((q) => { q._hidden = false; }); }
      return c;
    },

    /** Canvas composto atualizado (não modificar). */
    composite(doc) {
      doc = doc || this.doc;
      if (this.doc !== doc) { const c = this.flatten(doc); this.compDirty = true; this.needsDraw = true; return c; }
      if (this.compDirty || this.dirty || !this.comp) this.renderComposite(doc, this.compDirty ? null : this.dirty);
      return this.comp;
    },

    /* ---------- quadro ---------- */
    frame(t) {
      const doc = this.doc;
      if (!doc) {
        if (this.needsDraw) {
          this.needsDraw = false;
          const ctx = this.ctx;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.fillStyle = '#17181b'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
          this.drawRulers();
        }
        return;
      }
      if (this.anim || this.panAnim) this.stepAnimations();
      if (doc.selection && !this.hideAnts && t - this.antT > 90) { this.ants = (this.ants + 1) % 16; this.antT = t; this.needsDraw = true; }
      if (!this.needsDraw) return;
      this.needsDraw = false;
      if (this.compDirty) this.renderComposite(doc);
      else if (this.dirty) this.renderComposite(doc, this.dirty);
      this.draw(doc);
      if (this.rulersDirty) { this.rulersDirty = false; this.drawRulers(); }
    },

    /** Fonte alternativa da vista: máscara (Alt+clique) ou canal isolado. */
    viewSource(doc) {
      if (doc.viewMask) {
        const L = IMG.Layers.find(doc, doc.viewMask);
        if (!L || !L.mask) { doc.viewMask = null; return null; }
        return { canvas: L.mask.canvas, x: L.mask.x, y: L.mask.y, bg: L.mask.bg ? '#fff' : '#000' };
      }
      if (this.channelView) return this.channelView(doc);
      return null;
    },

    checkerPattern(ctx) {
      const p = IMG.app.prefs, key = p.checker + '|' + this.dpr;
      if (this.checker && this.checkerKey === key) return this.checker;
      const s = 8, c = U.domCanvas(s * 2, s * 2), x = c.getContext('2d');
      const cols = p.checker === 'dark' ? ['#3b3d42', '#2f3135'] : p.checker === 'mid' ? ['#9a9a9a', '#7f7f7f'] : ['#ffffff', '#d7d7d7'];
      x.fillStyle = cols[0]; x.fillRect(0, 0, s * 2, s * 2);
      x.fillStyle = cols[1]; x.fillRect(s, 0, s, s); x.fillRect(0, s, s, s);
      this.checker = ctx.createPattern(c, 'repeat'); this.checkerKey = key;
      return this.checker;
    },

    draw(doc) {
      const ctx = this.ctx, dpr = this.dpr, v = doc.view, z = v.zoom, p = IMG.app.prefs;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      const th = this.theme || {};
      ctx.fillStyle = th.workspace || IMG.app.prefs.workspaceColor || '#17181b';
      ctx.fillRect(0, 0, this.w, this.h);
      const rot = v.rot || 0;
      if (rot) { ctx.translate(this.w / 2, this.h / 2); ctx.rotate(rot); ctx.translate(-this.w / 2, -this.h / 2); }

      const dx = Math.round(v.x), dy = Math.round(v.y), dw = doc.width * z, dh = doc.height * z;
      let x0 = Math.max(0, dx), y0 = Math.max(0, dy), x1 = Math.min(this.w, dx + dw), y1 = Math.min(this.h, dy + dh);
      if (rot) { const ext = Math.hypot(this.w, this.h); x0 = Math.max(dx, this.w / 2 - ext); y0 = Math.max(dy, this.h / 2 - ext); x1 = Math.min(dx + dw, this.w / 2 + ext); y1 = Math.min(dy + dh, this.h / 2 + ext); }

      if (x1 > x0 && y1 > y0) {
        if (th.docShadow) {
          ctx.save(); ctx.shadowColor = th.docShadow; ctx.shadowBlur = th.docShadowBlur || 8; ctx.shadowOffsetY = th.docShadowY || 0;
          ctx.fillStyle = th.workspace; ctx.fillRect(dx, dy, dw, dh); ctx.restore();
        } else {
          ctx.fillStyle = 'rgba(0,0,0,.55)';
          ctx.fillRect(dx - 1, dy - 1, dw + 2, dh + 2);
        }
        ctx.save();
        ctx.translate(dx, dy);
        ctx.fillStyle = this.checkerPattern(ctx);
        ctx.fillRect(x0 - dx, y0 - dy, x1 - x0, y1 - y0);
        ctx.restore();
        ctx.imageSmoothingEnabled = z < 3;
        ctx.imageSmoothingQuality = z < 0.6 ? 'high' : 'medium';
        const vm = this.viewSource(doc);
        if (vm) {
          ctx.fillStyle = vm.bg; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
          ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
          ctx.fillStyle = vm.under || '#000'; ctx.fillRect(dx + vm.x * z, dy + vm.y * z, vm.canvas.width * z, vm.canvas.height * z);
          ctx.drawImage(vm.canvas, dx + vm.x * z, dy + vm.y * z, vm.canvas.width * z, vm.canvas.height * z);
          ctx.restore();
        } else ctx.drawImage(this.comp, (x0 - dx) / z, (y0 - dy) / z, (x1 - x0) / z, (y1 - y0) / z, x0, y0, x1 - x0, y1 - y0);
        if (!vm && this.overlaySource) { const ov = this.overlaySource(doc); if (ov) { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip(); ctx.globalAlpha = ov.alpha == null ? 1 : ov.alpha; ctx.drawImage(ov.canvas, dx + ov.x * z, dy + ov.y * z, ov.canvas.width * z, ov.canvas.height * z); ctx.restore(); } }
        ctx.imageSmoothingEnabled = true;

        if (p.pixelGrid && z >= 12) this.drawPixelGrid(ctx, dx, dy, z, x0, y0, x1, y1);
        if (p.showGrid) this.drawGrid(ctx, doc, dx, dy, z, x0, y0, x1, y1);
      }

      if (p.showGuides) this.drawGuides(ctx, doc, dx, dy, z);
      this.drawSelection(ctx, doc, dx, dy, z);

      const tool = IMG.Tools && IMG.Tools.active;
      if (IMG.drawTargetPath && doc.pathTarget === 'doc' && doc.activePathId && !(tool && /^(pen|freePen|curvPen|addAnchor|delAnchor|convertPt|pathSelect|directSelect)$/.test(tool.id))) { ctx.save(); try { IMG.drawTargetPath(ctx, { x: dx, y: dy, zoom: z }, doc); } catch (err) { console.error(err); } ctx.restore(); }
      if (this.drawExtras) { ctx.save(); try { this.drawExtras(ctx, { x: dx, y: dy, zoom: z, w: this.w, h: this.h }, doc); } catch (err) { console.error(err); } ctx.restore(); }
      if (tool && tool.drawOverlay) {
        ctx.save();
        try { tool.drawOverlay(ctx, { x: dx, y: dy, zoom: z, w: this.w, h: this.h }); } catch (err) { console.error(err); }
        ctx.restore();
      }

      if (this.dialogOverlay) { ctx.save(); try { this.dialogOverlay(ctx, { x: dx, y: dy, zoom: z, w: this.w, h: this.h }); } catch (err) { console.error(err); } ctx.restore(); }

      if (this.smart.length) {
        ctx.save();
        ctx.strokeStyle = '#ff3fb4'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (const l of this.smart) {
          if (l.o === 'v') { const x = Math.round(dx + l.pos * z) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, this.h); }
          else { const y = Math.round(dy + l.pos * z) + 0.5; ctx.moveTo(0, y); ctx.lineTo(this.w, y); }
        }
        ctx.stroke();
        ctx.restore();
      }
    },

    drawPixelGrid(ctx, dx, dy, z, x0, y0, x1, y1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(120,120,120,.35)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = Math.ceil((x0 - dx) / z); i <= (x1 - dx) / z; i++) { const x = Math.round(dx + i * z) + 0.5; ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
      for (let i = Math.ceil((y0 - dy) / z); i <= (y1 - dy) / z; i++) { const y = Math.round(dy + i * z) + 0.5; ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
      ctx.stroke();
      ctx.restore();
    },

    drawGrid(ctx, doc, dx, dy, z, x0, y0, x1, y1) {
      const p = IMG.app.prefs;
      const size = Math.max(1, p.gridSize || 50), sub = Math.max(1, p.gridSub || 1);
      const minor = size / sub;
      ctx.save();
      ctx.lineWidth = 1;
      const pass = (step, alpha) => {
        if (step * z < 5) return;
        ctx.strokeStyle = U.rgba(p.gridColor || '#6fa3e0', alpha);
        ctx.beginPath();
        for (let i = Math.ceil((x0 - dx) / z / step); i * step <= (x1 - dx) / z; i++) { const x = Math.round(dx + i * step * z) + 0.5; ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
        for (let i = Math.ceil((y0 - dy) / z / step); i * step <= (y1 - dy) / z; i++) { const y = Math.round(dy + i * step * z) + 0.5; ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
        ctx.stroke();
      };
      if (sub > 1) pass(minor, 0.22);
      pass(size, 0.55);
      ctx.restore();
    },

    drawGuides(ctx, doc, dx, dy, z) {
      const p = IMG.app.prefs;
      ctx.save();
      ctx.strokeStyle = p.guideColor || '#35d0ff'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const g of doc.guides.v) { const x = Math.round(dx + g * z) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, this.h); }
      for (const g of doc.guides.h) { const y = Math.round(dy + g * z) + 0.5; ctx.moveTo(0, y); ctx.lineTo(this.w, y); }
      const g = this.dragGuide;
      if (g) {
        if (g.o === 'v') { const x = Math.round(dx + g.pos * z) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, this.h); }
        else { const y = Math.round(dy + g.pos * z) + 0.5; ctx.moveTo(0, y); ctx.lineTo(this.w, y); }
      }
      ctx.stroke();
      ctx.restore();
    },

    drawSelection(ctx, doc, dx, dy, z) {
      const s = doc.selection;
      if (!s || !s.path || this.hideAnts || doc.quickMask || IMG.app.prefs.showSelEdges === false) return;
      ctx.save();
      ctx.translate(dx, dy); ctx.scale(z, z);
      ctx.lineWidth = 1 / z;
      ctx.strokeStyle = '#ffffff'; ctx.setLineDash([]);
      ctx.stroke(s.path);
      ctx.strokeStyle = '#111111';
      ctx.setLineDash([4 / z, 4 / z]); ctx.lineDashOffset = -this.ants / (2 * z);
      ctx.stroke(s.path);
      ctx.restore();
    },

    /* ---------- réguas ---------- */
    drawRulers() {
      if (!IMG.app.prefs.showRulers) return;
      const doc = this.doc, dpr = this.dpr, th = this.theme || {};
      const paint = (canvas, horizontal) => {
        const ctx = canvas.getContext('2d');
        const W = canvas.width / dpr, H = canvas.height / dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = th.rulerBg || '#232528'; ctx.fillRect(0, 0, W, H);
        if (!doc) return;
        const v = doc.view, z = v.zoom;
        const origin = Math.round(horizontal ? v.x : v.y);
        const len = horizontal ? W : H, thick = horizontal ? H : W;
        const major = RULER_STEPS.find((s) => s * z >= 56) || 20000;
        let div = 10;
        if ((major * z) / 10 < 5) div = 5;
        if ((major * z) / 5 < 5) div = 2;
        if (major === 1) div = 1; else if (major === 2) div = 2; else if (major === 5 && div === 10) div = 5;
        // área do documento em destaque
        const d0 = origin, d1 = origin + (horizontal ? doc.width : doc.height) * z;
        ctx.fillStyle = th.rulerDoc || '#2c2f33';
        if (horizontal) ctx.fillRect(Math.max(0, d0), 0, Math.min(len, d1) - Math.max(0, d0), thick);
        else ctx.fillRect(0, Math.max(0, d0), thick, Math.min(len, d1) - Math.max(0, d0));
        ctx.strokeStyle = th.rulerTick || '#6f747c'; ctx.fillStyle = th.rulerText || '#9499a1'; ctx.lineWidth = 1;
        ctx.font = th.rulerFont || '9px "Segoe UI", system-ui, sans-serif'; ctx.textBaseline = 'top';
        ctx.beginPath();
        const first = Math.floor(-origin / z / major) * major;
        for (let val = first; origin + val * z < len; val += major) {
          const pos = Math.round(origin + val * z) + 0.5;
          if (horizontal) { ctx.moveTo(pos, 0); ctx.lineTo(pos, thick); ctx.fillText(String(val), pos + 3, 1); }
          else {
            ctx.moveTo(0, pos); ctx.lineTo(thick, pos);
            const s = String(val);
            for (let i = 0; i < s.length; i++) ctx.fillText(s[i], 3, pos + 2 + i * 9);
          }
          for (let k = 1; k < div; k++) {
            const mp = Math.round(origin + (val + (k * major) / div) * z) + 0.5;
            const tl = div % 2 === 0 && k === div / 2 ? 9 : 5;
            if (horizontal) { ctx.moveTo(mp, thick - tl); ctx.lineTo(mp, thick); }
            else { ctx.moveTo(thick - tl, mp); ctx.lineTo(thick, mp); }
          }
        }
        ctx.stroke();
        ctx.strokeStyle = th.rulerLine || '#121315';
        ctx.beginPath();
        if (horizontal) { ctx.moveTo(0, thick - 0.5); ctx.lineTo(len, thick - 0.5); }
        else { ctx.moveTo(thick - 0.5, 0); ctx.lineTo(thick - 0.5, len); }
        ctx.stroke();
      };
      paint(this.rh, true);
      paint(this.rv, false);
    },

    /** Atualiza os marcadores de posição do cursor nas réguas. */
    setRulerMark(sx, sy) {
      if (!this.markH) return;
      if (sx == null) { this.markH.style.display = 'none'; this.markV.style.display = 'none'; return; }
      this.markH.style.display = this.markV.style.display = 'block';
      this.markH.style.transform = 'translateX(' + Math.round(sx) + 'px)';
      this.markV.style.transform = 'translateY(' + Math.round(sy) + 'px)';
    },

    initRulers() {
      const start = (o) => (e) => {
        const doc = this.doc;
        if (!doc || e.button !== 0) return;
        e.preventDefault();
        const upd = (ev) => {
          const r = this.vp.getBoundingClientRect();
          const p = this.s2d(ev.clientX - r.left, ev.clientY - r.top);
          let pos = Math.round(o === 'h' ? p.y : p.x);
          if (ev.shiftKey) pos = Math.round(pos / 10) * 10;
          const inside = o === 'h' ? ev.clientY > r.top : ev.clientX > r.left;
          this.dragGuide = inside ? { o, pos } : null;
          this.needsDraw = true;
        };
        IMG.app.prefs.showGuides = true;
        U.drag(e, upd, (ev) => {
          upd(ev);
          const g = this.dragGuide;
          this.dragGuide = null;
          if (g) { doc.guides[g.o].push(g.pos); IMG.commit('Nova guia'); }
          this.needsDraw = true;
        });
      };
      this.rh.addEventListener('pointerdown', start('h'));
      this.rv.addEventListener('pointerdown', start('v'));
    },

    /** Guia sob o cursor (coordenadas de tela), ou null. */
    guideAt(sx, sy) {
      const doc = this.doc;
      if (!doc || !IMG.app.prefs.showGuides) return null;
      const v = doc.view;
      for (let i = doc.guides.v.length - 1; i >= 0; i--) if (Math.abs(v.x + doc.guides.v[i] * v.zoom - sx) <= 4) return { o: 'v', i };
      for (let i = doc.guides.h.length - 1; i >= 0; i--) if (Math.abs(v.y + doc.guides.h[i] * v.zoom - sy) <= 4) return { o: 'h', i };
      return null;
    },

    /** Lê a cor composta em um ponto do documento. */
    sample(doc, x, y, size = 1) {
      const c = this.composite(doc);
      const half = Math.floor(size / 2);
      const x0 = U.clamp(Math.floor(x) - half, 0, doc.width - 1), y0 = U.clamp(Math.floor(y) - half, 0, doc.height - 1);
      const w = Math.min(size, doc.width - x0), h = Math.min(size, doc.height - y0);
      const d = c.getContext('2d').getImageData(x0, y0, w, h).data;
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < d.length; i += 4) { const al = d[i + 3]; r += d[i] * al; g += d[i + 1] * al; b += d[i + 2] * al; a += al; }
      if (!a) return null;
      return { r: Math.round(r / a), g: Math.round(g / a), b: Math.round(b / a), a: a / (d.length / 4) / 255 };
    }
  });

  /* ------------------------------------------------------------------
     Encaixe (snap) em guias, bordas, centro, grade e outras camadas
     ------------------------------------------------------------------ */
  IMG.Snap = {
    collect(doc, exclude) {
      const p = IMG.app.prefs, xs = [], ys = [];
      const T = { xs, ys, grid: 0 };
      if (!p.snap) return T;
      xs.push(0, doc.width / 2, doc.width); ys.push(0, doc.height / 2, doc.height);
      if (p.showGuides) { xs.push(...doc.guides.v); ys.push(...doc.guides.h); }
      if (p.showGrid && p.snapGrid) T.grid = Math.max(1, p.gridSize / Math.max(1, p.gridSub));
      if (p.smartGuides) {
        let n = 0;
        IMG.Layers.walk(doc.layers, (L) => {
          if (n > 40 || L.type === 'group' || !IMG.Layers.isVisible(L)) return;
          if (exclude) for (let q = L; q; q = q.parent) if (exclude.has(q.id)) return;
          const b = L.contentBounds();
          if (!b || (b.w >= doc.width && b.h >= doc.height)) return;
          n++;
          xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h);
        });
      }
      return T;
    },
    _axis(own, targets, grid, thr) {
      let best = null;
      for (const o of own) {
        for (const t of targets) { const d = t - o; if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t }; }
        if (grid) { const t = Math.round(o / grid) * grid, d = t - o; if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t }; }
      }
      return best;
    },
    rect(doc, r, T) {
      const thr = 6 / doc.view.zoom;
      const bx = this._axis([r.x, r.x + r.w / 2, r.x + r.w], T.xs, T.grid, thr);
      const by = this._axis([r.y, r.y + r.h / 2, r.y + r.h], T.ys, T.grid, thr);
      const lines = [];
      if (bx) lines.push({ o: 'v', pos: bx.t });
      if (by) lines.push({ o: 'h', pos: by.t });
      return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, lines };
    },
    point(doc, x, y, T) {
      const thr = 6 / doc.view.zoom;
      const bx = this._axis([x], T.xs, T.grid, thr), by = this._axis([y], T.ys, T.grid, thr);
      const lines = [];
      if (bx) lines.push({ o: 'v', pos: bx.t });
      if (by) lines.push({ o: 'h', pos: by.t });
      return { x: bx ? bx.t : x, y: by ? by.t : y, lines };
    }
  };
})();
