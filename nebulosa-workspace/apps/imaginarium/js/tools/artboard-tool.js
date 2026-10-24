/* ==========================================================================
   Imaginarium — Pranchetas (grupo da ferramenta Mover, V)
   Uma prancheta é um grupo com retângulo e fundo próprios; o conteúdo dos
   filhos é recortado ao retângulo. Arraste no vazio para criar, arraste a
   prancheta para movê-la com o conteúdo, use as alças para redimensionar e os
   botões "+" para criar pranchetas vizinhas.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const Layers = IMG.Layers, T = () => IMG.Tools;

  const SIZES = [['custom', 'Personalizado'], null,
    ['390x844', 'iPhone 14 — 390 × 844'], ['375x667', 'iPhone SE — 375 × 667'], ['360x800', 'Android — 360 × 800'], ['820x1180', 'iPad Air — 820 × 1180'], null,
    ['1366x768', 'Web — 1366 × 768'], ['1440x900', 'Web — 1440 × 900'], ['1920x1080', 'Web — 1920 × 1080'], null,
    ['1080x1080', 'Instagram — 1080 × 1080'], ['1080x1350', 'Instagram retrato — 1080 × 1350'], ['1080x1920', 'Story — 1080 × 1920'], ['1200x630', 'Facebook — 1200 × 630'], null,
    ['595x842', 'A4 (72 ppp) — 595 × 842'], ['612x792', 'Carta (72 ppp) — 612 × 792']];
  const BGS = [['#ffffff', 'Branco'], ['#000000', 'Preto'], ['transparent', 'Transparente']];
  const HANDLES = [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]];
  const GAP = 60;

  const AB = (IMG.Artboards = {
    list(doc) { const out = []; Layers.walk(doc.layers, (L) => { if (L.type === 'group' && L.artboard) out.push(L); }); return out; },
    of(doc, L) { while (L) { if (L.type === 'group' && L.artboard) return L; L = L.parent; } return null; },
    at(doc, x, y) { const l = this.list(doc); for (let i = l.length - 1; i >= 0; i--) { const a = l[i].artboard; if (x >= a.x && y >= a.y && x < a.x + a.w && y < a.y + a.h) return l[i]; } return null; },
    labelAt(doc, sx, sy) {
      const v = doc.view, z = v.zoom;
      for (const G of this.list(doc)) { const a = G.artboard, x = v.x + a.x * z, y = v.y + a.y * z; if (sx >= x && sx <= x + Math.max(60, G.name.length * 7 + 10) && sy >= y - 18 && sy <= y) return G; }
      return null;
    },
    create(doc, r, o = {}) {
      const G = new IMG.Layer('group', { name: o.name || Layers.name(doc, 'Prancheta') });
      G.artboard = { x: Math.round(r.x), y: Math.round(r.y), w: Math.max(1, Math.round(r.w)), h: Math.max(1, Math.round(r.h)), bg: o.bg || '#ffffff' };
      G.blend = 'pass';
      doc.layers.push(G); G.parent = null;
      if (o.children) o.children.forEach((L) => { Layers.remove(doc, L); L.parent = G; G.children.push(L); });
      doc.activeId = G.id; doc.selected = new Set([G.id]);
      return G;
    },
    /** Amplia a tela para conter todas as pranchetas (sem registrar no histórico). */
    fit(doc) {
      const l = this.list(doc); if (!l.length) return false;
      let u = doc.rect; l.forEach((G) => { u = U.rectUnion(u, G.artboard); });
      if (u.x === 0 && u.y === 0 && u.w === doc.width && u.h === doc.height) return false;
      const dx = -u.x, dy = -u.y;
      if (dx || dy) {
        doc.layers.forEach((L) => L.translate(dx, dy));
        (doc.paths || []).forEach((p) => IMG.Paths && IMG.Paths.translate(p.path, dx, dy));
        doc.guides.v = doc.guides.v.map((g) => g + dx); doc.guides.h = doc.guides.h.map((g) => g + dy);
        (doc.slices || []).forEach((s) => { s.x += dx; s.y += dy; });
        const v = doc.view; v.x -= dx * v.zoom; v.y -= dy * v.zoom;
      }
      if (IMG.xfChannels) IMG.xfChannels(doc, u.w, u.h, [1, 0, 0, 1, dx, dy]);
      doc.width = u.w; doc.height = u.h;
      if (doc.selection) IMG.Selection.clear(doc);
      bus.emit('doc:resize', doc);
      return true;
    },
    /** Recorta a tela para o retângulo que envolve as pranchetas. */
    trimTo(doc) {
      const l = this.list(doc); if (!l.length) return;
      let u = null; l.forEach((G) => { u = U.rectUnion(u, G.artboard); });
      IMG.ImageOps.crop(doc, u, { deletePixels: false, label: 'Ajustar tela às pranchetas' });
    },
    async exportAll(doc, fmt = 'png') {
      const l = this.list(doc);
      if (!l.length) { IMG.UI.toast('O documento não tem pranchetas.'); return; }
      const files = [];
      for (const G of l) {
        const a = G.artboard;
        const D = new IMG.Doc({ name: G.name, width: a.w, height: a.h });
        const C2 = Layers.clone(G); C2.translate(-a.x, -a.y); C2.parent = null; D.layers = [C2];
        const c = IMG.Engine.flatten(D, fmt === 'jpg' ? '#ffffff' : null);
        files.push({ name: U.safeFile(G.name) + '.' + fmt, data: await U.toBlob(c, fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.92) });
      }
      if (files.length === 1) U.download(files[0].data, files[0].name);
      else if (IMG.Formats && IMG.Formats.zip) U.download(await IMG.Formats.zip(files), U.safeFile(doc.name) + '_pranchetas.zip');
      else for (const f of files) U.download(f.data, f.name);
    },
    draw(ctx, v, doc) {
      const l = this.list(doc); if (!l.length) return;
      const z = v.zoom, act = AB.of(doc, doc.active), tool = T().activeId === 'artboard';
      ctx.save();
      ctx.font = '11px system-ui, sans-serif'; ctx.textBaseline = 'bottom';
      for (const G of l) {
        if (!G.visible) continue;
        const a = G.artboard, x = Math.round(v.x + a.x * z), y = Math.round(v.y + a.y * z), w = Math.round(a.w * z), h = Math.round(a.h * z);
        const on = G === act;
        ctx.fillStyle = on ? '#e8eaee' : '#9da2ab'; ctx.fillText(G.name, x, y - 4);
        ctx.strokeStyle = on ? (tool ? '#4d8fd6' : 'rgba(77,143,214,.7)') : 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
        ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
        if (on && tool) {
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#4d8fd6';
          HANDLES.forEach(([i, j]) => { ctx.fillRect(x + w * i - 4, y + h * j - 4, 8, 8); ctx.strokeRect(x + w * i - 4.5, y + h * j - 4.5, 9, 9); });
          // botões "+"
          this.plusPts(v, a).forEach((p) => { ctx.fillStyle = 'rgba(77,143,214,.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - 4, p.y); ctx.lineTo(p.x + 4, p.y); ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x, p.y + 4); ctx.stroke(); ctx.lineWidth = 1; });
        }
      }
      ctx.restore();
    },
    plusPts(v, a) {
      const z = v.zoom, x = v.x + a.x * z, y = v.y + a.y * z, w = a.w * z, h = a.h * z;
      return [{ dir: 'r', x: x + w + 22, y: y + h / 2 }, { dir: 'l', x: x - 22, y: y + h / 2 }, { dir: 'b', x: x + w / 2, y: y + h + 22 }, { dir: 't', x: x + w / 2, y: y - 30 }];
    },
    addNext(doc, G, dir) {
      const a = G.artboard, r = { x: a.x, y: a.y, w: a.w, h: a.h };
      if (dir === 'r') r.x = a.x + a.w + GAP; else if (dir === 'l') r.x = a.x - a.w - GAP; else if (dir === 'b') r.y = a.y + a.h + GAP; else r.y = a.y - a.h - GAP;
      const N = this.create(doc, r, { bg: a.bg });
      this.fit(doc);
      bus.emit('layers:change', doc); IMG.Engine.invalidate(); IMG.commit('Nova prancheta');
      return N;
    }
  });
  {
    const E = IMG.Engine, prev = E.drawExtras;
    E.drawExtras = function (ctx, v, doc) { if (prev) prev.call(this, ctx, v, doc); try { AB.draw(ctx, v, doc); } catch (err) { console.error(err); } };
  }

  const handleHit = (doc, G, sx, sy) => {
    const v = doc.view, z = v.zoom, a = G.artboard;
    for (let i = 0; i < 8; i++) { const hx = v.x + (a.x + a.w * HANDLES[i][0]) * z, hy = v.y + (a.y + a.h * HANDLES[i][1]) * z; if (Math.abs(sx - hx) <= 7 && Math.abs(sy - hy) <= 7) return i; }
    return -1;
  };

  IMG.Tools.register({
    id: 'artboard', name: 'Prancheta', icon: 'artboard', group: 'move', cursor: 'default',
    defaults: { size: 'custom', bg: '#ffffff' },
    hint: 'Arraste no vazio para criar · arraste a prancheta para movê-la · "+" cria uma vizinha · Delete exclui',
    options() {
      const d = IMG.app.doc, G = d && AB.of(d, d.active), a = G && G.artboard;
      const setSize = (w, h) => { if (!G) return; G.artboard.w = Math.max(1, Math.round(w)); G.artboard.h = Math.max(1, Math.round(h)); AB.fit(d); bus.emit('layers:change', d); IMG.Engine.invalidate(); IMG.commit('Tamanho da prancheta'); IMG.UI.renderOptions(); };
      return [
        { type: 'select', key: 'size', label: 'Tamanho', options: SIZES, width: 210, onChange: (v) => { const m = /^(\d+)x(\d+)$/.exec(v); if (m && G) setSize(+m[1], +m[2]); } },
        { type: 'number', label: 'L', value: a ? a.w : null, min: 1, max: 30000, unit: 'px', width: 74, onChange: (v) => a && setSize(v, a.h) },
        { type: 'custom', build: () => IMG.UI.iconBtn('swap', 'Alternar retrato/paisagem', () => a && setSize(a.h, a.w)) },
        { type: 'number', label: 'A', value: a ? a.h : null, min: 1, max: 30000, unit: 'px', width: 74, onChange: (v) => a && setSize(a.w, v) },
        { type: 'select', label: 'Fundo', value: a ? (BGS.some((b) => b[0] === a.bg) ? a.bg : '#ffffff') : T().o('artboard').bg, options: BGS, width: 120, onChange: (v) => { T().setOpt('artboard', 'bg', v, true); if (G) { G.artboard.bg = v; IMG.Engine.invalidate(); IMG.commit('Fundo da prancheta'); } } },
        { type: 'sep' },
        { type: 'button', label: 'Adicionar prancheta', icon: 'plus', onClick: () => { if (!d) return; if (G) AB.addNext(d, G, 'r'); else { AB.create(d, { x: 0, y: 0, w: d.width, h: d.height }, { bg: T().o('artboard').bg }); bus.emit('layers:change', d); IMG.Engine.invalidate(); IMG.commit('Nova prancheta'); } IMG.UI.renderOptions(); } },
        { type: 'button', label: 'Ajustar tela', onClick: () => d && AB.trimTo(d) }
      ];
    },
    down(ev) {
      const doc = IMG.app.doc, cur = AB.of(doc, doc.active);
      if (cur) {
        const p = AB.plusPts(doc.view, cur.artboard).find((q) => Math.hypot(q.x - ev.sx, q.y - ev.sy) <= 10);
        if (p) { const N = AB.addNext(doc, cur, p.dir); doc.activeId = N.id; IMG.UI.renderOptions(); return false; }
        const hi = handleHit(doc, cur, ev.sx, ev.sy);
        if (hi >= 0) { this.d = { mode: 'resize', G: cur, i: hi, a0: Object.assign({}, cur.artboard), x: ev.x, y: ev.y }; return; }
      }
      const G = AB.labelAt(doc, ev.sx, ev.sy) || AB.at(doc, ev.x, ev.y);
      if (G) {
        doc.activeId = G.id; doc.selected = new Set([G.id]); bus.emit('layers:select', doc);
        this.d = { mode: 'move', G, x: ev.x, y: ev.y, dx: 0, dy: 0 };
        IMG.UI.renderOptions(); IMG.Engine.requestRender();
        return;
      }
      this.d = { mode: 'new', x: ev.x, y: ev.y, r: null };
    },
    move(ev) {
      const d = this.d; if (!d) return;
      const doc = IMG.app.doc;
      if (d.mode === 'move') {
        const dx = Math.round(ev.x - d.x) - d.dx, dy = Math.round(ev.y - d.y) - d.dy;
        if (dx || dy) { d.G.translate(dx, dy); d.dx += dx; d.dy += dy; IMG.Effects.invalidate(d.G); IMG.Engine.invalidate(); }
      } else if (d.mode === 'resize') {
        const [i, j] = HANDLES[d.i], a0 = d.a0, dx = Math.round(ev.x - d.x), dy = Math.round(ev.y - d.y);
        let x0 = a0.x, y0 = a0.y, x1 = a0.x + a0.w, y1 = a0.y + a0.h;
        if (i === 0) x0 += dx; else if (i === 1) x1 += dx;
        if (j === 0) y0 += dy; else if (j === 1) y1 += dy;
        const r = U.rectFromPoints(x0, y0, x1, y1);
        Object.assign(d.G.artboard, { x: r.x, y: r.y, w: Math.max(1, r.w), h: Math.max(1, r.h) });
        IMG.Engine.invalidate(); IMG.UI.setHint(d.G.artboard.w + ' × ' + d.G.artboard.h + ' px');
      } else {
        d.r = U.rectFromPoints(d.x, d.y, ev.x, ev.y);
        IMG.UI.setHint(Math.round(d.r.w) + ' × ' + Math.round(d.r.h) + ' px');
        IMG.Engine.requestRender();
      }
      void doc;
    },
    up() {
      const d = this.d, doc = IMG.app.doc; this.d = null; IMG.UI.setHint('');
      if (!d) return;
      if (d.mode === 'move') { if (d.dx || d.dy) { AB.fit(doc); bus.emit('layers:change', doc); IMG.Engine.invalidate(); IMG.commit('Mover prancheta'); } return; }
      if (d.mode === 'resize') { AB.fit(doc); bus.emit('layers:change', doc); IMG.Engine.invalidate(); IMG.commit('Redimensionar prancheta'); IMG.UI.renderOptions(); return; }
      let r = d.r;
      const m = /^(\d+)x(\d+)$/.exec(T().o('artboard').size);
      if ((!r || r.w < 4 || r.h < 4) && m) r = { x: d.x, y: d.y, w: +m[1], h: +m[2] };
      if (!r || r.w < 4 || r.h < 4) return;
      AB.create(doc, r, { bg: T().o('artboard').bg });
      AB.fit(doc);
      bus.emit('layers:change', doc); IMG.Engine.invalidate(); IMG.commit('Nova prancheta'); IMG.UI.renderOptions();
    },
    hover(ev) {
      const doc = IMG.app.doc, cur = AB.of(doc, doc.active);
      if (cur) {
        if (AB.plusPts(doc.view, cur.artboard).some((q) => Math.hypot(q.x - ev.sx, q.y - ev.sy) <= 10)) { T().cursor('pointer'); return; }
        const hi = handleHit(doc, cur, ev.sx, ev.sy);
        if (hi >= 0) { const [i, j] = HANDLES[hi]; T().cursor(i === 0.5 ? 'ns-resize' : j === 0.5 ? 'ew-resize' : i === j ? 'nwse-resize' : 'nesw-resize'); return; }
      }
      T().cursor(AB.labelAt(doc, ev.sx, ev.sy) || AB.at(doc, ev.x, ev.y) ? 'move' : 'crosshair');
    },
    onKey(e) {
      const doc = IMG.app.doc, G = AB.of(doc, doc.active);
      if (!G) return false;
      if (e.key === 'Delete' || e.key === 'Backspace') { doc.activeId = G.id; doc.selected = new Set([G.id]); IMG.UI.run('layer.delete'); return true; }
      const st = e.shiftKey ? 10 : 1, k = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
      if (k) { G.translate(k[0], k[1]); AB.fit(doc); IMG.Engine.invalidate(); IMG.commit('Mover prancheta'); return true; }
      return false;
    },
    drawOverlay(ctx, v) {
      const d = this.d; if (!d || d.mode !== 'new' || !d.r) return;
      const r = d.r;
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.strokeStyle = '#4d8fd6';
      ctx.fillRect(v.x + r.x * v.zoom, v.y + r.y * v.zoom, r.w * v.zoom, r.h * v.zoom);
      ctx.strokeRect(Math.round(v.x + r.x * v.zoom) + 0.5, Math.round(v.y + r.y * v.zoom) + 0.5, Math.round(r.w * v.zoom), Math.round(r.h * v.zoom));
      ctx.restore();
    }
  });

  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, H) => {
    C('layer.newArtboard', 'Prancheta…', () => {
      const UI = IMG.UI, d = H.doc();
      let w = d.width, h = d.height, bg = '#ffffff';
      const nameIn = el('input.inp', { type: 'text', value: Layers.name(d, 'Prancheta') });
      const nw = UI.num({ value: w, min: 1, max: 30000, unit: 'px', width: 100, onInput: (v) => { w = v; } }), nh = UI.num({ value: h, min: 1, max: 30000, unit: 'px', width: 100, onInput: (v) => { h = v; } });
      UI.dialog({ title: 'Nova prancheta', width: 380, body: [UI.row('Nome', nameIn), UI.row('Predefinição', UI.select(SIZES, 'custom', (v) => { const m = /^(\d+)x(\d+)$/.exec(v); if (m) { w = +m[1]; h = +m[2]; nw.set(w); nh.set(h); } }, { width: 220, keepFocus: true }).el), UI.row('Largura', nw.el), UI.row('Altura', nh.el), UI.row('Fundo', UI.select(BGS, bg, (v) => { bg = v; }, { width: 140, keepFocus: true }).el)],
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
          const l = AB.list(d); let x = 0, y = 0;
          if (l.length) { const last = l[l.length - 1].artboard; x = last.x + last.w + GAP; y = last.y; }
          AB.create(d, { x, y, w, h }, { name: nameIn.value.trim(), bg }); AB.fit(d);
          bus.emit('layers:change', d); IMG.Engine.invalidate(); IMG.commit('Nova prancheta');
        } }] });
    }, { enabled: H.has });
    const fromLayers = (label) => () => {
      const d = H.doc(), sel = Layers.selectedLayers(d).filter((L) => !L.isBg && !AB.of(d, L.parent));
      if (!sel.length) { IMG.UI.toast('Selecione camadas que não sejam o Fundo.'); return; }
      let b = null; sel.forEach((L) => { b = U.rectUnion(b, L.contentBounds()); });
      if (!b) b = d.rect;
      const kids = sel.length === 1 && sel[0].type === 'group' && label === 'g' ? sel[0].children.slice() : sel;
      const G = AB.create(d, U.rectInt(b), { children: kids, name: label === 'g' && sel[0].type === 'group' ? sel[0].name : undefined });
      if (label === 'g' && sel.length === 1 && sel[0].type === 'group' && !sel[0].children.length) Layers.remove(d, sel[0]);
      void G; AB.fit(d);
      bus.emit('layers:change', d); IMG.Engine.invalidate(); IMG.commit('Prancheta a partir de camadas');
    };
    C('layer.artboardFromGroup', 'Prancheta a partir do grupo', fromLayers('g'), { enabled: () => !!(H.hasLayer() && H.act().type === 'group' && !H.act().artboard) });
    C('layer.artboardFromLayers', 'Prancheta a partir de camadas…', fromLayers('l'), { enabled: H.hasLayer });
    C('file.exportArtboards', 'Pranchetas para arquivos…', () => AB.exportAll(H.doc()), { enabled: () => !!(H.has() && AB.list(H.doc()).length) });
  });
})();
