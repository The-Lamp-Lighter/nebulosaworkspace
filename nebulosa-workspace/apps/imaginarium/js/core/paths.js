/* ==========================================================================
   Imaginarium — vetores: demarcadores, camadas de forma e máscaras vetoriais
   Demarcador (path): { subs: [{ closed, op, pts: [{ x, y, ix, iy, ox, oy, smooth }] }], rule }
     op do componente: 'add' (combinar), 'sub' (subtrair), 'int' (interseção), 'xor' (excluir).
   Camada de forma: L.shape = { path, fill, stroke, live }
     fill: { type: 'solid', color } | { type: 'gradient', grad, style, angle, scale } | { type: 'pattern', id, scale } | null
     stroke: { on, fill, width, align: 'inside'|'center'|'outside', cap, join, dash: null|[..] }
     live: forma paramétrica (retângulo com cantos, elipse, polígono, estrela, linha) ou null
   Máscara vetorial: L.vmask = { path, invert, enabled, density, feather }
   Demarcadores do documento: doc.paths = [{ id, name, kind: 'work'|'saved', path }]
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;

  const P = (x, y) => ({ x, y, ix: x, iy: y, ox: x, oy: y, smooth: false });
  const clonePath = (p) => (p ? JSON.parse(JSON.stringify(p)) : { subs: [], rule: 'nonzero' });

  /* ---------- geometria de Bézier ---------- */
  const cubic = (p0, p1, p2, p3, t) => { const m = 1 - t; return m * m * m * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t * t * t * p3; };
  function segPt(a, b, t) { return { x: cubic(a.x, a.ox, b.ix, b.x, t), y: cubic(a.y, a.oy, b.iy, b.y, t) }; }
  /** Divide o segmento a→b em t; retorna o novo ponto e ajusta as alças de a e b. */
  function splitSeg(a, b, t) {
    const lerp = (p, q) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    const p0 = { x: a.x, y: a.y }, p1 = { x: a.ox, y: a.oy }, p2 = { x: b.ix, y: b.iy }, p3 = { x: b.x, y: b.y };
    const p01 = lerp(p0, p1), p12 = lerp(p1, p2), p23 = lerp(p2, p3), p012 = lerp(p01, p12), p123 = lerp(p12, p23), m = lerp(p012, p123);
    a.ox = p01.x; a.oy = p01.y; b.ix = p23.x; b.iy = p23.y;
    const lin = a.ox === a.x && a.oy === a.y && b.ix === b.x && b.iy === b.y;
    return { x: m.x, y: m.y, ix: p012.x, iy: p012.y, ox: p123.x, oy: p123.y, smooth: !lin };
  }
  function segBounds(a, b) {
    const xs = [a.x, b.x], ys = [a.y, b.y];
    const roots = (p0, p1, p2, p3) => {
      const A = -p0 + 3 * p1 - 3 * p2 + p3, B = 2 * (p0 - 2 * p1 + p2), C = p1 - p0, out = [];
      if (Math.abs(A) < 1e-9) { if (Math.abs(B) > 1e-9) out.push(-C / B); }
      else { const d = B * B - 4 * A * C; if (d >= 0) { const s = Math.sqrt(d); out.push((-B + s) / (2 * A), (-B - s) / (2 * A)); } }
      return out.filter((t) => t > 0 && t < 1);
    };
    roots(a.x, a.ox, b.ix, b.x).forEach((t) => xs.push(cubic(a.x, a.ox, b.ix, b.x, t)));
    roots(a.y, a.oy, b.iy, b.y).forEach((t) => ys.push(cubic(a.y, a.oy, b.iy, b.y, t)));
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }
  function eachSeg(sub, fn) {
    const n = sub.pts.length;
    for (let i = 0; i < n - 1; i++) fn(sub.pts[i], sub.pts[i + 1], i);
    if (sub.closed && n > 1) fn(sub.pts[n - 1], sub.pts[0], n - 1);
  }

  const Paths = (IMG.Paths = {
    P, clone: clonePath, segPt, splitSeg, eachSeg,
    empty() { return { subs: [], rule: 'nonzero' }; },

    /** Path2D de um componente (ou de todos). */
    sub2D(sub, p2) {
      const p = p2 || new Path2D(), pts = sub.pts;
      if (!pts.length) return p;
      p.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; p.bezierCurveTo(a.ox, a.oy, b.ix, b.iy, b.x, b.y); }
      if (sub.closed && pts.length > 1) { const a = pts[pts.length - 1], b = pts[0]; p.bezierCurveTo(a.ox, a.oy, b.ix, b.iy, b.x, b.y); p.closePath(); }
      return p;
    },
    to2D(path) { const p = new Path2D(); (path.subs || []).forEach((s) => this.sub2D(s, p)); return p; },
    /** Traça o demarcador em um contexto (já com beginPath feito por quem chama). */
    trace(ctx, path, M) {
      (path.subs || []).forEach((sub) => {
        const pts = sub.pts; if (!pts.length) return;
        const T = M ? (x, y) => { const q = M.transformPoint(new DOMPoint(x, y)); return [q.x, q.y]; } : (x, y) => [x, y];
        ctx.moveTo(...T(pts[0].x, pts[0].y));
        for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; ctx.bezierCurveTo(...T(a.ox, a.oy), ...T(b.ix, b.iy), ...T(b.x, b.y)); }
        if (sub.closed && pts.length > 1) { const a = pts[pts.length - 1], b = pts[0]; ctx.bezierCurveTo(...T(a.ox, a.oy), ...T(b.ix, b.iy), ...T(b.x, b.y)); ctx.closePath(); }
      });
    },

    bounds(path, subsIdx) {
      let r = null;
      (path.subs || []).forEach((sub, k) => {
        if (subsIdx && !subsIdx.includes(k)) return;
        if (sub.pts.length === 1) { const p = sub.pts[0]; r = U.rectUnion(r, { x: p.x, y: p.y, w: 0, h: 0 }); }
        eachSeg(sub, (a, b) => { const q = segBounds(a, b); r = U.rectUnion(r, { x: q.x0, y: q.y0, w: q.x1 - q.x0, h: q.y1 - q.y0 }); });
      });
      return r;
    },

    /** Aplica fn(x, y) → {x, y} a todos os pontos (ou só aos componentes listados). */
    map(path, fn, subsIdx) {
      (path.subs || []).forEach((sub, k) => {
        if (subsIdx && !subsIdx.includes(k)) return;
        sub.pts.forEach((p) => {
          const a = fn(p.x, p.y), i = fn(p.ix, p.iy), o = fn(p.ox, p.oy);
          p.x = a.x; p.y = a.y; p.ix = i.x; p.iy = i.y; p.ox = o.x; p.oy = o.y;
        });
      });
      return path;
    },
    translate(path, dx, dy, subsIdx) { return this.map(path, (x, y) => ({ x: x + dx, y: y + dy }), subsIdx); },
    matrix(path, M, subsIdx) { return this.map(path, (x, y) => { const q = M.transformPoint(new DOMPoint(x, y)); return { x: q.x, y: q.y }; }, subsIdx); },

    /** Máscara de alfa (canvas R.w×R.h) do demarcador com as operações de componente. */
    fillCanvas(path, R, o = {}) {
      const c = U.createCanvas(Math.max(1, R.w), Math.max(1, R.h)), x = c.getContext('2d');
      x.translate(-R.x, -R.y);
      x.fillStyle = '#fff';
      const subs = path.subs || [];
      let k = 0;
      while (k < subs.length) {
        const op = k === 0 ? 'add' : subs[k].op || 'add';
        const p = new Path2D();
        let j = k;
        // componentes consecutivos com a mesma operação (exceto o primeiro) formam um grupo
        do { if (subs[j].closed || subs[j].pts.length > 2) this.sub2D(Object.assign({}, subs[j], { closed: true }), p); j++; } while (j < subs.length && (subs[j].op || 'add') === op && op === 'add');
        x.globalCompositeOperation = op === 'sub' ? 'destination-out' : op === 'int' ? 'destination-in' : op === 'xor' ? 'xor' : 'source-over';
        if (op === 'int') { const t = U.createCanvas(c.width, c.height), tx = t.getContext('2d'); tx.translate(-R.x, -R.y); tx.fillStyle = '#fff'; tx.fill(p, path.rule || 'nonzero'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(t, 0, 0); x.restore(); }
        else x.fill(p, path.rule || 'nonzero');
        k = j;
      }
      x.globalCompositeOperation = 'source-over';
      if (o.antiAlias === false) IMG.Selection.hardenCanvas(c);
      return c;
    },

    /** Máscara vetorial em cache: { canvas, x, y } no espaço do documento. */
    maskCanvas(vm, doc) {
      if (!doc) return null;
      const key = (vm._ver || 0) + '|' + doc.width + 'x' + doc.height + '|' + (vm.feather || 0) + '|' + (vm.density == null ? 100 : vm.density) + '|' + (vm.invert ? 1 : 0);
      if (vm._mc && vm._mcKey === key) return vm._mc;
      const R = doc.rect;
      let c;
      const has = vm.path && vm.path.subs && vm.path.subs.length;
      if (!has) { c = U.createCanvas(R.w, R.h); if (!vm.invert) { const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, R.w, R.h); } }
      else {
        c = this.fillCanvas(vm.path, R);
        if (vm.invert) { const x = c.getContext('2d'); x.globalCompositeOperation = 'xor'; x.fillStyle = '#fff'; x.fillRect(0, 0, R.w, R.h); x.globalCompositeOperation = 'source-over'; }
      }
      if (vm.feather > 0) IMG.blurCanvas(c, vm.feather);
      const dens = vm.density == null ? 100 : vm.density;
      if (dens < 100) { const x = c.getContext('2d'); x.globalCompositeOperation = 'destination-over'; x.fillStyle = 'rgba(255,255,255,' + (1 - dens / 100) + ')'; x.fillRect(0, 0, R.w, R.h); x.globalCompositeOperation = 'source-over'; }
      vm._mc = { canvas: c, x: 0, y: 0 }; vm._mcKey = key;
      return vm._mc;
    },
    translateMask(vm, dx, dy) { if (vm.path) this.translate(vm.path, dx, dy); vm._ver = (vm._ver || 0) + 1; },
    touch(vm) { vm._ver = (vm._ver || 0) + 1; vm._mc = null; },

    /* ---------- consulta ---------- */
    /** Ponto mais próximo no demarcador: { sub, seg, t, x, y, d } (d em px do documento). */
    nearest(path, x, y) {
      let best = null;
      (path.subs || []).forEach((sub, k) => {
        eachSeg(sub, (a, b, i) => {
          let bt = 0, bd = Infinity;
          for (let s = 0; s <= 24; s++) { const t = s / 24, q = segPt(a, b, t), d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < bd) { bd = d; bt = t; } }
          let lo = Math.max(0, bt - 1 / 24), hi = Math.min(1, bt + 1 / 24);
          for (let it = 0; it < 12; it++) { const t1 = lo + (hi - lo) / 3, t2 = hi - (hi - lo) / 3, q1 = segPt(a, b, t1), q2 = segPt(a, b, t2); if ((q1.x - x) ** 2 + (q1.y - y) ** 2 < (q2.x - x) ** 2 + (q2.y - y) ** 2) hi = t2; else lo = t1; }
          const t = (lo + hi) / 2, q = segPt(a, b, t), d = Math.hypot(q.x - x, q.y - y);
          if (!best || d < best.d) best = { sub: k, seg: i, t, x: q.x, y: q.y, d };
        });
      });
      return best;
    },
    /** Componente que contém o ponto (ou cujo traço está perto). */
    subAt(path, x, y, tol) {
      const c = U.createCanvas(1, 1).getContext('2d');
      for (let k = (path.subs || []).length - 1; k >= 0; k--) {
        const sub = path.subs[k];
        if (sub.closed && c.isPointInPath(this.sub2D(sub), x, y, path.rule || 'nonzero')) return k;
      }
      const n = this.nearest(path, x, y);
      return n && n.d <= tol ? n.sub : -1;
    },

    /* ---------- conversões ---------- */
    /** Seleção → demarcador (contornos por "marching squares", simplificação e suavização). */
    fromSelection(doc, tol = 2) {
      const s = doc.selection; if (!s || !s.bounds) return null;
      const b = U.rectIntersect(U.rectInflate(s.bounds, 1), doc.rect);
      const W = b.w + 2, H = b.h + 2;
      const d = s.canvas.getContext('2d').getImageData(b.x, b.y, b.w, b.h).data;
      const on = new Uint8Array(W * H);
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) on[(y + 1) * W + x + 1] = d[(y * b.w + x) * 4 + 3] >= 128 ? 1 : 0;
      // arestas orientadas entre pixels ligados e desligados → contornos
      const key = (x, y) => y * (W + 1) + x;
      const out = new Map();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!on[y * W + x]) continue;
        if (!on[(y - 1) * W + x] || y === 0) push(out, x, y, x + 1, y);
        if (x === W - 1 || !on[y * W + x + 1]) push(out, x + 1, y, x + 1, y + 1);
        if (y === H - 1 || !on[(y + 1) * W + x]) push(out, x + 1, y + 1, x, y + 1);
        if (x === 0 || !on[y * W + x - 1]) push(out, x, y + 1, x, y);
      }
      function push(m, x0, y0, x1, y1) { const k = key(x0, y0); if (!m.has(k)) m.set(k, []); m.get(k).push([x1, y1]); }
      const subs = [];
      while (out.size) {
        const [k0, list] = out.entries().next().value;
        let cx = k0 % (W + 1), cy = Math.floor(k0 / (W + 1));
        const poly = [[cx, cy]];
        let nx, ny;
        [nx, ny] = list.shift(); if (!list.length) out.delete(k0);
        let guard = 0;
        while (!(nx === poly[0][0] && ny === poly[0][1]) && guard++ < 4e6) {
          poly.push([nx, ny]);
          const k = key(nx, ny), l = out.get(k); if (!l) break;
          const nxt = l.shift(); if (!l.length) out.delete(k);
          nx = nxt[0]; ny = nxt[1];
        }
        if (poly.length < 3) continue;
        const simp = rdp(poly.map(([x, y]) => ({ x: x - 1 + b.x, y: y - 1 + b.y })), Math.max(0.5, tol));
        if (simp.length < 3) continue;
        subs.push({ closed: true, op: 'add', pts: smoothPts(simp, tol) });
      }
      return { subs, rule: 'evenodd' };
    },
    /** Demarcador → seleção. */
    toSelection(doc, path, mode, o = {}) {
      const c = this.fillCanvas(path, doc.rect, { antiAlias: o.antiAlias });
      if (o.feather > 0) IMG.blurCanvas(c, o.feather);
      IMG.Selection.combine(doc, c, mode || 'new');
    },

    /** Interpreta dados de caminho SVG (M L H V C S Q T Z; A aproximado). */
    fromSVG(d, M) {
      const tok = String(d).match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g) || [];
      const subs = []; let sub = null, i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = '', lc = null;
      const num = () => parseFloat(tok[i++]);
      const start = (x, y) => { sub = { closed: false, op: 'add', pts: [P(x, y)] }; subs.push(sub); sx = x; sy = y; };
      const last = () => sub.pts[sub.pts.length - 1];
      const curve = (x1, y1, x2, y2, x, y) => { const a = last(); a.ox = x1; a.oy = y1; const p = P(x, y); p.ix = x2; p.iy = y2; sub.pts.push(p); lc = { x: x2, y: y2 }; };
      while (i < tok.length) {
        if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
        const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
        const bx = rel ? cx : 0, by = rel ? cy : 0;
        if (C === 'Z') { if (sub) { sub.closed = true; const f = sub.pts[0], l = last(); if (sub.pts.length > 1 && Math.abs(f.x - l.x) < 1e-6 && Math.abs(f.y - l.y) < 1e-6) { f.ix = l.ix; f.iy = l.iy; sub.pts.pop(); } } cx = sx; cy = sy; lc = null; continue; }
        if (C === 'M') { const x = num() + bx, y = num() + by; start(x, y); cx = x; cy = y; cmd = rel ? 'l' : 'L'; lc = null; continue; }
        if (!sub) start(cx, cy);
        if (C === 'L') { const x = num() + bx, y = num() + by; sub.pts.push(P(x, y)); cx = x; cy = y; lc = null; }
        else if (C === 'H') { const x = num() + bx; sub.pts.push(P(x, cy)); cx = x; lc = null; }
        else if (C === 'V') { const y = num() + by; sub.pts.push(P(cx, y)); cy = y; lc = null; }
        else if (C === 'C') { const x1 = num() + bx, y1 = num() + by, x2 = num() + bx, y2 = num() + by, x = num() + bx, y = num() + by; curve(x1, y1, x2, y2, x, y); cx = x; cy = y; }
        else if (C === 'S') { const x1 = lc ? 2 * cx - lc.x : cx, y1 = lc ? 2 * cy - lc.y : cy, x2 = num() + bx, y2 = num() + by, x = num() + bx, y = num() + by; curve(x1, y1, x2, y2, x, y); cx = x; cy = y; }
        else if (C === 'Q' || C === 'T') {
          let qx, qy;
          if (C === 'Q') { qx = num() + bx; qy = num() + by; } else { qx = lc && lc.q ? 2 * cx - lc.q.x : cx; qy = lc && lc.q ? 2 * cy - lc.q.y : cy; }
          const x = num() + bx, y = num() + by;
          curve(cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy), x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y); lc.q = { x: qx, y: qy }; cx = x; cy = y;
        } else if (C === 'A') {
          const rx = num(), ry = num(), rotA = num(), large = num(), sweep = num(), x = num() + bx, y = num() + by;
          arcToBeziers(cx, cy, rx, ry, rotA, large, sweep, x, y).forEach((c) => curve(...c));
          cx = x; cy = y; lc = null;
        } else i++;
      }
      const path = { subs: subs.filter((s) => s.pts.length), rule: 'nonzero' };
      if (M) this.matrix(path, M);
      return path;
    },
    /** Demarcador → string SVG. */
    toSVG(path) {
      const f = (v) => U.round(v, 2);
      return (path.subs || []).map((sub) => {
        const p = sub.pts; if (!p.length) return '';
        let s = 'M' + f(p[0].x) + ' ' + f(p[0].y);
        for (let i = 1; i < p.length; i++) s += 'C' + [p[i - 1].ox, p[i - 1].oy, p[i].ix, p[i].iy, p[i].x, p[i].y].map(f).join(' ');
        if (sub.closed && p.length > 1) { const a = p[p.length - 1], b = p[0]; s += 'C' + [a.ox, a.oy, b.ix, b.iy, b.x, b.y].map(f).join(' ') + 'Z'; }
        return s;
      }).join('');
    },

    /* ---------- formas paramétricas ---------- */
    rect(x, y, w, h, radii) {
      const r = (radii || [0, 0, 0, 0]).map((v) => Math.max(0, Math.min(v || 0, Math.abs(w) / 2, Math.abs(h) / 2)));
      const pts = [];
      // implementação direta, no sentido horário a partir do canto superior esquerdo
      const [tl, tr, br, bl] = r, k = 0.4477;
      const add = (x0, y0, hx0, hy0, x1, y1, hx1, hy1) => { const a = P(x0, y0); a.ox = hx0; a.oy = hy0; pts.push(a); const b = P(x1, y1); b.ix = hx1; b.iy = hy1; pts.push(b); };
      if (tl) add(x, y + tl, x, y + tl * k, x + tl, y, x + tl * k, y); else pts.push(P(x, y));
      if (tr) add(x + w - tr, y, x + w - tr * k, y, x + w, y + tr, x + w, y + tr * k); else pts.push(P(x + w, y));
      if (br) add(x + w, y + h - br, x + w, y + h - br * k, x + w - br, y + h, x + w - br * k, y + h); else pts.push(P(x + w, y + h));
      if (bl) add(x + bl, y + h, x + bl * k, y + h, x, y + h - bl, x, y + h - bl * k); else pts.push(P(x, y + h));
      return { closed: true, op: 'add', pts };
    },
    ellipse(cx, cy, rx, ry) {
      const k = 0.5523;
      const pts = [P(cx, cy - ry), P(cx + rx, cy), P(cx, cy + ry), P(cx - rx, cy)];
      const set = (p, ix, iy, ox, oy) => { p.ix = ix; p.iy = iy; p.ox = ox; p.oy = oy; p.smooth = true; };
      set(pts[0], cx - rx * k, cy - ry, cx + rx * k, cy - ry);
      set(pts[1], cx + rx, cy - ry * k, cx + rx, cy + ry * k);
      set(pts[2], cx + rx * k, cy + ry, cx - rx * k, cy + ry);
      set(pts[3], cx - rx, cy + ry * k, cx - rx, cy - ry * k);
      return { closed: true, op: 'add', pts };
    },
    polygon(cx, cy, rx, ry, sides, star, inner, smooth) {
      const n = Math.max(3, Math.round(sides)), pts = [], k = U.clamp((inner == null ? 50 : inner) / 100, 0.01, 0.99);
      const N = star ? n * 2 : n;
      for (let i = 0; i < N; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / N, r = star && i % 2 ? k : 1; pts.push(P(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r)); }
      if (smooth) pts.forEach((p, i) => { const a = pts[(i + N - 1) % N], b = pts[(i + 1) % N], dx = (b.x - a.x) / 6, dy = (b.y - a.y) / 6; p.ix = p.x - dx; p.iy = p.y - dy; p.ox = p.x + dx; p.oy = p.y + dy; p.smooth = true; });
      return { closed: true, op: 'add', pts };
    },
    /** Linha com espessura e pontas de seta: retorna componentes fechados. */
    line(x0, y0, x1, y1, weight, o = {}) {
      const len = Math.hypot(x1 - x0, y1 - y0) || 1e-6, ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux, h = Math.max(0.5, weight / 2);
      const subs = [];
      let a0 = 0, a1 = len;
      const arrow = (atEnd) => {
        const aw = Math.max(1, (o.arrowW || 500) / 100 * weight), al = Math.max(1, (o.arrowL || 1000) / 100 * weight), con = U.clamp((o.arrowC || 0) / 100, -0.5, 0.5);
        const tip = atEnd ? { x: x1, y: y1 } : { x: x0, y: y0 }, dir = atEnd ? 1 : -1;
        const base = { x: tip.x - ux * al * dir, y: tip.y - uy * al * dir };
        const notch = { x: base.x + ux * al * con * dir, y: base.y + uy * al * con * dir };
        subs.push({ closed: true, op: 'add', pts: [P(tip.x, tip.y), P(base.x + nx * aw / 2, base.y + ny * aw / 2), P(notch.x, notch.y), P(base.x - nx * aw / 2, base.y - ny * aw / 2)] });
        return al * (1 - Math.max(0, con));
      };
      if (o.arrowStart) a0 = Math.min(len, arrow(false) * 0.98);
      if (o.arrowEnd) a1 = Math.max(a0, len - arrow(true) * 0.98);
      const A = { x: x0 + ux * a0, y: y0 + uy * a0 }, B = { x: x0 + ux * a1, y: y0 + uy * a1 };
      subs.unshift({ closed: true, op: 'add', pts: [P(A.x + nx * h, A.y + ny * h), P(B.x + nx * h, B.y + ny * h), P(B.x - nx * h, B.y - ny * h), P(A.x - nx * h, A.y - ny * h)] });
      return subs;
    }
  });

  /* ---------- auxiliares ---------- */
  function rdp(pts, eps) {
    if (pts.length < 4) return pts;
    // contorno fechado: começa pelo ponto mais distante do primeiro
    let far = 0, fd = -1;
    for (let i = 1; i < pts.length; i++) { const d = (pts[i].x - pts[0].x) ** 2 + (pts[i].y - pts[0].y) ** 2; if (d > fd) { fd = d; far = i; } }
    const simp = (a) => {
      if (a.length < 3) return a;
      const s = a[0], e = a[a.length - 1];
      let idx = -1, md = 0;
      const dx = e.x - s.x, dy = e.y - s.y, L = Math.hypot(dx, dy) || 1;
      for (let i = 1; i < a.length - 1; i++) { const d = Math.abs((a[i].x - s.x) * dy - (a[i].y - s.y) * dx) / L; if (d > md) { md = d; idx = i; } }
      if (md <= eps) return [s, e];
      const l = simp(a.slice(0, idx + 1)), r = simp(a.slice(idx));
      return l.slice(0, -1).concat(r);
    };
    const A = simp(pts.slice(0, far + 1)), B = simp(pts.slice(far).concat([pts[0]]));
    return A.slice(0, -1).concat(B.slice(0, -1));
  }
  IMG.rdp = rdp;
  /** Polígono → pontos com alças suaves (cantos agudos permanecem retos). */
  function smoothPts(poly, tol) {
    const n = poly.length, out = poly.map((p) => P(p.x, p.y));
    for (let i = 0; i < n; i++) {
      const a = poly[(i + n - 1) % n], p = poly[i], b = poly[(i + 1) % n];
      const v1 = { x: p.x - a.x, y: p.y - a.y }, v2 = { x: b.x - p.x, y: b.y - p.y };
      const l1 = Math.hypot(v1.x, v1.y), l2 = Math.hypot(v2.x, v2.y);
      if (!l1 || !l2) continue;
      const cos = (v1.x * v2.x + v1.y * v2.y) / (l1 * l2);
      if (cos < 0.55 || (l1 < tol * 2.5 && l2 < tol * 2.5 && cos < 0.9)) continue; // canto
      const tx = (b.x - a.x), ty = (b.y - a.y), tl = Math.hypot(tx, ty) || 1;
      out[i].ix = p.x - (tx / tl) * l1 / 3; out[i].iy = p.y - (ty / tl) * l1 / 3;
      out[i].ox = p.x + (tx / tl) * l2 / 3; out[i].oy = p.y + (ty / tl) * l2 / 3;
      out[i].smooth = true;
    }
    return out;
  }
  IMG.smoothPolyPts = smoothPts;
  function arcToBeziers(x1, y1, rx, ry, phiDeg, fa, fs, x2, y2) {
    if (!rx || !ry) return [[x1, y1, x2, y2, x2, y2]];
    const phi = U.rad(phiDeg), cs = Math.cos(phi), sn = Math.sin(phi);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cs * dx + sn * dy, y1p = -sn * dx + cs * dy;
    rx = Math.abs(rx); ry = Math.abs(ry);
    const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
    const sign = fa === fs ? -1 : 1;
    const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    const co = sign * Math.sqrt(Math.max(0, num / den));
    const cxp = co * (rx * y1p) / ry, cyp = co * -(ry * x1p) / rx;
    const cx = cs * cxp - sn * cyp + (x1 + x2) / 2, cy = sn * cxp + cs * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
    let t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry), dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
    const segs = Math.ceil(Math.abs(dt) / (Math.PI / 2)), d = dt / segs, k = (4 / 3) * Math.tan(d / 4), out = [];
    const pt = (t) => ({ x: cx + rx * Math.cos(t) * cs - ry * Math.sin(t) * sn, y: cy + rx * Math.cos(t) * sn + ry * Math.sin(t) * cs });
    const dv = (t) => ({ x: -rx * Math.sin(t) * cs - ry * Math.cos(t) * sn, y: -rx * Math.sin(t) * sn + ry * Math.cos(t) * cs });
    for (let i = 0; i < segs; i++) {
      const a = t1 + i * d, b = a + d, pa = pt(a), pb = pt(b), da = dv(a), db = dv(b);
      out.push([pa.x + k * da.x, pa.y + k * da.y, pb.x - k * db.x, pb.y - k * db.y, pb.x, pb.y]);
    }
    return out;
  }

  /* ==================================================================
     CAMADAS DE FORMA
     ================================================================== */
  const Shapes = (IMG.Shapes = {
    style: Object.assign({ fill: { type: 'solid', color: '#4d8fd6' }, stroke: { on: false, fill: { type: 'solid', color: '#000000' }, width: 3, align: 'inside', cap: 'butt', join: 'miter', dash: null }, radius: 0, sides: 5, star: false, inner: 50, smoothCorners: false, weight: 4, arrowStart: false, arrowEnd: false, arrowW: 500, arrowL: 1000, arrowC: 0, custom: 'heart', mode: 'shape', op: 'new' }, U.store.get('shapeStyle2', {})),
    saveStyle: U.debounce(() => U.store.set('shapeStyle2', Shapes.style), 300),

    /** Converte camadas de forma do formato antigo (kind/cx/cy/w/h) para demarcador. */
    normalize(s) {
      if (s.path) return s;
      const rot = new DOMMatrix().translate(s.cx, s.cy).rotate(s.rotation || 0);
      const hw = s.w / 2, hh = s.h / 2;
      let subs;
      switch (s.kind) {
        case 'ellipse': subs = [Paths.ellipse(0, 0, hw, hh)]; break;
        case 'line': subs = Paths.line(-hw, 0, hw, 0, s.strokeWidth || 2); break;
        case 'polygon': subs = [Paths.polygon(0, 0, hw, hh, s.sides || 5, false)]; break;
        case 'star': subs = [Paths.polygon(0, 0, hw, hh, s.points || 5, true, s.inner == null ? 45 : s.inner)]; break;
        case 'path': { const X = (v) => (v - 0.5) * s.w, Y = (v) => (v - 0.5) * s.h; subs = [{ closed: !!s.closed, op: 'add', pts: (s.path || []).map((a) => ({ x: X(a.x), y: Y(a.y), ix: X(a.ix), iy: Y(a.iy), ox: X(a.ox), oy: Y(a.oy), smooth: false })) }]; break; }
        case 'svg': subs = Paths.fromSVG(s.svg.d, new DOMMatrix([s.w / s.svg.vw, 0, 0, s.h / s.svg.vh, -hw, -hh])).subs; break;
        default: { const r = s.radius || 0; subs = [Paths.rect(-hw, -hh, s.w, s.h, [r, r, r, r])]; }
      }
      const path = Paths.matrix({ subs, rule: s.rule || 'nonzero' }, rot);
      const line = s.kind === 'line';
      return { path, fill: line ? { type: 'solid', color: s.stroke || '#000' } : s.fill ? { type: 'solid', color: s.fill } : null, stroke: { on: !line && !!(s.stroke && s.strokeWidth), fill: { type: 'solid', color: s.stroke || '#000000' }, width: s.strokeWidth || 0, align: 'center', cap: 'butt', join: 'miter', dash: null }, live: null };
    },

    /** Estilo de preenchimento → fillStyle (no espaço do documento). */
    paint(ctx, f, R, doc) {
      if (!f) return null;
      if (f.type === 'solid') return f.color;
      if (f.type === 'pattern') {
        const p = IMG.Patterns.get(f.id); if (!p) return '#000';
        const pat = ctx.createPattern(p.canvas, 'repeat');
        if (pat.setTransform) pat.setTransform(new DOMMatrix().scale((f.scale || 100) / 100));
        return pat;
      }
      if (f.type === 'gradient') {
        const c = U.createCanvas(Math.max(1, R.w), Math.max(1, R.h)), img = new ImageData(c.width, c.height);
        const a = U.rad(f.angle == null ? 90 : f.angle), cx = R.w / 2, cy = R.h / 2, half = (Math.abs(R.w * Math.cos(a)) + Math.abs(R.h * Math.sin(a))) / 2 * ((f.scale || 100) / 100);
        const p0 = { x: cx - Math.cos(a) * half, y: cy + Math.sin(a) * half }, p1 = { x: cx + Math.cos(a) * half, y: cy - Math.sin(a) * half };
        IMG.Gradients.paint(img, f.grad || IMG.Gradients.def(), f.style || 'linear', f.style === 'radial' || f.style === 'angle' || f.style === 'diamond' ? { x: cx, y: cy } : p0, f.style === 'radial' || f.style === 'diamond' ? { x: cx + half, y: cy } : p1, { reverse: f.reverse, dither: true });
        c.getContext('2d').putImageData(img, 0, 0);
        const pat = ctx.createPattern(c, 'no-repeat');
        if (pat.setTransform) pat.setTransform(new DOMMatrix().translate(R.x, R.y));
        return pat;
      }
      return null;
    },

    /** Desenha a forma (preenchimento + traçado) em ctx no espaço do documento. R = limites. */
    draw(ctx, s, R, doc) {
      s = this.normalize(s);
      const path = s.path; if (!path || !path.subs.length) return;
      const st = s.stroke && s.stroke.on && s.stroke.width > 0 ? s.stroke : null;
      // preenchimento com as operações de componente
      if (s.fill) {
        const m = Paths.fillCanvas(path, R);
        const t = U.createCanvas(R.w, R.h), tx = t.getContext('2d');
        tx.translate(-R.x, -R.y);
        tx.fillStyle = this.paint(tx, s.fill, R, doc) || '#000'; tx.fillRect(R.x, R.y, R.w, R.h);
        tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalCompositeOperation = 'destination-in'; tx.drawImage(m, 0, 0);
        ctx.drawImage(t, R.x, R.y);
      }
      if (st) {
        const t = U.createCanvas(R.w, R.h), tx = t.getContext('2d');
        tx.translate(-R.x, -R.y);
        const p2 = Paths.to2D(path);
        const w = st.align === 'center' ? st.width : st.width * 2;
        tx.lineWidth = w; tx.lineCap = st.cap || 'butt'; tx.lineJoin = st.join || 'miter'; tx.miterLimit = 10;
        if (st.dash && st.dash.length) tx.setLineDash(st.dash.map((v) => v * st.width));
        tx.strokeStyle = this.paint(tx, st.fill || { type: 'solid', color: '#000' }, R, doc) || '#000';
        tx.stroke(p2);
        if (st.align !== 'center') {
          const m = Paths.fillCanvas(Object.assign({}, path, { subs: path.subs.filter((q) => q.closed) }), R);
          tx.setTransform(1, 0, 0, 1, 0, 0);
          tx.globalCompositeOperation = st.align === 'inside' ? 'destination-in' : 'destination-out';
          tx.drawImage(m, 0, 0);
        }
        ctx.drawImage(t, R.x, R.y);
      }
    },

    /** Limites da forma, incluindo o traçado. */
    bounds(s) {
      s = this.normalize(s);
      const b = Paths.bounds(s.path); if (!b) return null;
      const st = s.stroke && s.stroke.on ? s.stroke.width * (s.stroke.align === 'center' ? 0.5 : s.stroke.align === 'outside' ? 1 : 0) * (s.stroke.join === 'miter' ? 4 : 1) : 0;
      return U.rectInt(U.rectInflate(b, st + 2));
    },

    render(L) {
      if (!L.shape) return;
      L.shape = this.normalize(L.shape);
      const s = L.shape;
      if (s.live) this.applyLive(s);
      let R = this.bounds(s);
      if (!R || R.w < 1 || R.h < 1) { L.setCanvas(U.createCanvas(1, 1), 0, 0); L._blank = true; return; }
      if (R.w > 16000 || R.h > 16000) { const doc = IMG.app.doc; R = U.rectIntersect(R, U.rectInflate(doc ? doc.rect : R, 2000)) || R; }
      const c = U.createCanvas(R.w, R.h), ctx = c.getContext('2d');
      ctx.translate(-R.x, -R.y);
      this.draw(ctx, s, R, IMG.app.doc);
      L.setCanvas(c, R.x, R.y);
      IMG.Effects && IMG.Effects.invalidate(L);
    },

    /** Recria o demarcador a partir dos parâmetros da forma dinâmica. */
    applyLive(s) {
      const lv = s.live; if (!lv) return;
      let subs;
      if (lv.kind === 'rect') subs = [Paths.rect(lv.x, lv.y, lv.w, lv.h, lv.radii)];
      else if (lv.kind === 'ellipse') subs = [Paths.ellipse(lv.x + lv.w / 2, lv.y + lv.h / 2, lv.w / 2, lv.h / 2)];
      else if (lv.kind === 'polygon') subs = [Paths.polygon(lv.x + lv.w / 2, lv.y + lv.h / 2, lv.w / 2, lv.h / 2, lv.sides, lv.star, lv.inner, lv.smooth)];
      else if (lv.kind === 'line') subs = Paths.line(lv.x0, lv.y0, lv.x1, lv.y1, lv.weight, lv);
      else return;
      if (lv.angle) { const c = { x: lv.kind === 'line' ? (lv.x0 + lv.x1) / 2 : lv.x + lv.w / 2, y: lv.kind === 'line' ? (lv.y0 + lv.y1) / 2 : lv.y + lv.h / 2 }; const M = new DOMMatrix().translate(c.x, c.y).rotate(lv.angle).translate(-c.x, -c.y); Paths.matrix({ subs }, M); }
      // mantém componentes extras (operações adicionadas depois)
      const extra = (s.path && s.path.subs ? s.path.subs.slice(lv.n || 1) : []);
      lv.n = subs.length;
      s.path = { subs: subs.concat(extra), rule: (s.path && s.path.rule) || 'nonzero' };
    },

    create(doc, shape, name) {
      const L = new IMG.Layer('shape', { name: name || IMG.Layers.name(doc, 'Forma') });
      L.shape = shape;
      IMG.Layers.add(doc, L);
      this.render(L);
      return L;
    },
    current() { const doc = IMG.app.doc, L = doc && doc.active; return L && L.type === 'shape' ? L : null; },
    translate(s, dx, dy) {
      if (!s.path) { s.cx += dx; s.cy += dy; return; }
      Paths.translate(s.path, dx, dy);
      const lv = s.live;
      if (lv) { if (lv.kind === 'line') { lv.x0 += dx; lv.y0 += dy; lv.x1 += dx; lv.y1 += dy; } else { lv.x += dx; lv.y += dy; } }
    },
    /** Aplica uma matriz afim à forma (formas dinâmicas viram demarcador se houver rotação/inclinação). */
    transform(L, M) {
      const s = L.shape = this.normalize(L.shape);
      Paths.matrix(s.path, M);
      const lv = s.live;
      if (lv) {
        const axis = Math.abs(M.b) < 1e-9 && Math.abs(M.c) < 1e-9;
        if (axis && lv.kind !== 'line' && !lv.angle) {
          const p0 = M.transformPoint(new DOMPoint(lv.x, lv.y)), p1 = M.transformPoint(new DOMPoint(lv.x + lv.w, lv.y + lv.h));
          lv.x = Math.min(p0.x, p1.x); lv.y = Math.min(p0.y, p1.y); lv.w = Math.abs(p1.x - p0.x); lv.h = Math.abs(p1.y - p0.y);
          if (lv.radii) { const k = Math.sqrt(Math.abs(M.a * M.d)); lv.radii = lv.radii.map((r) => r * k); }
        } else if (lv.kind === 'line' && Math.abs(M.a * M.d - M.b * M.c - 1) < 1e-6 && Math.abs(Math.hypot(M.a, M.b) - 1) < 1e-6) {
          const a = M.transformPoint(new DOMPoint(lv.x0, lv.y0)), b = M.transformPoint(new DOMPoint(lv.x1, lv.y1));
          lv.x0 = a.x; lv.y0 = a.y; lv.x1 = b.x; lv.y1 = b.y;
        } else s.live = null;
      }
      if (s.stroke && s.stroke.on) { /* espessura do traçado é preservada, como no Photoshop */ }
      this.render(L);
    },
    /** Função genérica de pontos (perspectiva/deformação). */
    transformFn(L, fn) { const s = L.shape = this.normalize(L.shape); Paths.map(s.path, fn); s.live = null; this.render(L); }
  });

  /* integração com Transformação livre */
  IMG.vectorTransform = IMG.vectorTransform || {};
  IMG.vectorTransform.shape = (L, M) => Shapes.transform(L, M);
  IMG.vectorTransformFn = IMG.vectorTransformFn || {};
  IMG.vectorTransformFn.shape = (L, fn) => Shapes.transformFn(L, fn);

  /** Aplica uma transformação afim a todos os vetores do documento (redimensionar/girar a imagem). */
  IMG.transformDocVectors = function (doc, M, opts = {}) {
    IMG.Layers.walk(doc.layers, (L) => {
      if (L.vmask && L.vmask.path) { Paths.matrix(L.vmask.path, M); Paths.touch(L.vmask); }
      if (L.type === 'shape' && L.shape && !opts.skipShapes) { Shapes.transform(L, M); if (opts.scaleStroke && L.shape.stroke) L.shape.stroke.width *= opts.scaleStroke; if (opts.scaleStroke) Shapes.render(L); }
      if (L.type === 'text' && L.text && IMG.vectorTransform && IMG.vectorTransform.text) IMG.vectorTransform.text(L, M);
    });
    (doc.paths || []).forEach((p) => Paths.matrix(p.path, M));
  };

  /* ==================================================================
     DEMARCADOR ATIVO (alvo das ferramentas de caneta e seleção)
     ================================================================== */
  /** Retorna { path, kind: 'shape'|'vmask'|'doc', L?, entry? } para o demarcador editável atual. */
  Paths.target = function (doc, create) {
    if (!doc) return null;
    const L = doc.active;
    if (L && L.type === 'shape' && doc.pathTarget !== 'doc') { L.shape = Shapes.normalize(L.shape); return { path: L.shape.path, kind: 'shape', L }; }
    if (L && L.vmask && doc.pathTarget === 'vmask') { if (!L.vmask.path) L.vmask.path = Paths.empty(); return { path: L.vmask.path, kind: 'vmask', L }; }
    doc.paths = doc.paths || [];
    let e = doc.paths.find((p) => p.id === doc.activePathId);
    if (!e && create) {
      e = doc.paths.find((p) => p.kind === 'work');
      if (!e) { e = { id: U.uid('path'), name: 'Demarcador de trabalho', kind: 'work', path: Paths.empty() }; doc.paths.push(e); }
      doc.activePathId = e.id; doc.pathTarget = 'doc';
      bus.emit('paths:change', doc);
    }
    return e ? { path: e.path, kind: 'doc', entry: e } : null;
  };
  /** Após editar o alvo: renderiza a forma/máscara e atualiza a vista. */
  Paths.changed = function (doc, tg, label) {
    if (!tg) return;
    if (tg.kind === 'shape') Shapes.render(tg.L);
    if (tg.kind === 'vmask') Paths.touch(tg.L.vmask);
    if (tg.L) { IMG.Effects.invalidate(tg.L); bus.emit('layer:pixels', tg.L); }
    IMG.Engine.invalidate();
    bus.emit('paths:change', doc);
    if (label) IMG.commit(label);
  };

  /* ==================================================================
     PREENCHER / CONTORNAR DEMARCADOR
     ================================================================== */
  function fillPathDialog(doc, path) {
    const UI = IMG.UI;
    let src = 'fg', color = IMG.app.fg, pat = 'p0', mode = 'normal', op = 100, keep = false, feather = 0, aa = true;
    const cb = UI.colorBtn(color, (h) => { if (h) color = h; }), pb = IMG.Widgets.patternBtn(pat, (v) => { pat = v; });
    cb.el.style.display = 'none'; pb.el.style.display = 'none';
    UI.dialog({
      title: 'Preencher demarcador', width: 400,
      body: [UI.row('Conteúdo', UI.select([['fg', 'Cor do primeiro plano'], ['bg', 'Cor de fundo'], ['custom', 'Cor…'], ['pattern', 'Padrão'], null, ['black', 'Preto'], ['gray', 'Cinza 50%'], ['white', 'Branco']], src, (v) => { src = v; cb.el.style.display = v === 'custom' ? '' : 'none'; pb.el.style.display = v === 'pattern' ? '' : 'none'; }, { keepFocus: true }).el, cb.el, pb.el),
        el('h3.form-title', { text: 'Mesclagem' }), UI.row('Modo', UI.select(IMG.BLEND_LIST, mode, (v) => { mode = v; }, { keepFocus: true }).el),
        UI.slider({ label: 'Opacidade', value: 100, min: 1, max: 100, unit: '%', onInput: (v) => { op = v; } }).el, UI.row('', UI.check('Preservar transparência', false, (v) => { keep = v; }).el),
        el('h3.form-title', { text: 'Renderização' }), UI.row('Raio de difusão', UI.num({ value: 0, min: 0, max: 250, unit: 'px', width: 80, onInput: (v) => { feather = v; } }).el), UI.row('', UI.check('Suavização de serrilhado', true, (v) => { aa = v; }).el)],
      buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
        const L = IMG.Layers.paintTarget(doc); if (!L) return;
        const m = Paths.fillCanvas(path, doc.rect, { antiAlias: aa });
        if (feather > 0) IMG.blurCanvas(m, feather);
        const x = m.getContext('2d'); x.globalCompositeOperation = 'source-in';
        if (src === 'pattern') IMG.Patterns.fill(x, pat, doc.width, doc.height);
        else { x.fillStyle = { fg: IMG.app.fg, bg: IMG.app.bg, custom: color, black: '#000', gray: '#808080', white: '#fff' }[src]; x.fillRect(0, 0, doc.width, doc.height); }
        const wasLock = L.lockAlpha; if (keep) L.lockAlpha = true;
        IMG.paintCanvas(doc, L, m, { mode, opacity: op / 100 });
        L.lockAlpha = wasLock;
        IMG.commit('Preencher demarcador');
      } }]
    });
  }
  /** Contorna o demarcador com uma ferramenta de pintura, simulando o arraste. */
  function strokePath(doc, path, toolId, simPressure) {
    const T = IMG.Tools, tool = T.defs[toolId]; if (!tool) return;
    const prev = T.activeId;
    T.set(toolId);
    IMG._batch = (IMG._batch || 0) + 1;
    try {
      const v = doc.view;
      const ev = (x, y, p) => ({ x, y, sx: v.x + x * v.zoom, sy: v.y + y * v.zoom, shift: false, alt: false, ctrl: false, button: 0, pen: !!simPressure, pressure: p, tilt: { x: 0, y: 0 }, e: {} });
      (path.subs || []).forEach((sub) => {
        const pts = [];
        eachSeg(sub, (a, b) => { const len = Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(a.ox - a.x, a.oy - a.y) + Math.hypot(b.ix - b.x, b.iy - b.y); const n = Math.max(2, Math.ceil(len / 2)); for (let i = 0; i < n; i++) pts.push(segPt(a, b, i / n)); });
        if (!sub.closed && sub.pts.length) pts.push({ x: sub.pts[sub.pts.length - 1].x, y: sub.pts[sub.pts.length - 1].y });
        if (sub.closed && sub.pts.length) pts.push({ x: sub.pts[0].x, y: sub.pts[0].y });
        if (!pts.length) return;
        const N = pts.length, pr = (i) => (simPressure ? Math.max(0.05, Math.sin((i / Math.max(1, N - 1)) * Math.PI)) : 1);
        T.isDown = true;
        if (tool.down(ev(pts[0].x, pts[0].y, pr(0))) === false) { T.isDown = false; return; }
        for (let i = 1; i < N; i++) tool.move(ev(pts[i].x, pts[i].y, pr(i)));
        T.isDown = false;
        tool.up(ev(pts[N - 1].x, pts[N - 1].y, pr(N - 1)));
      });
    } finally { IMG._batch--; }
    IMG.commit('Contornar demarcador');
    if (prev && prev !== toolId) T.set(prev);
  }
  Paths.fillDialog = fillPathDialog;
  Paths.strokePath = strokePath;
  function strokePathDialog(doc, path) {
    const UI = IMG.UI;
    let tool = 'brush', sim = false;
    const tools = [['brush', 'Pincel'], ['pencil', 'Lápis'], ['eraser', 'Borracha'], ['bgEraser', 'Borracha de plano de fundo'], ['stamp', 'Carimbo'], ['patternStamp', 'Carimbo de padrão'], ['historyBrush', 'Pincel de histórico'], ['mixer', 'Pincel misturador'], ['blurTool', 'Desfoque'], ['sharpenTool', 'Nitidez'], ['smudge', 'Borrar'], ['dodge', 'Subexposição'], ['burn', 'Superexposição'], ['sponge', 'Esponja'], ['colorReplace', 'Substituição de cor']].filter(([id]) => IMG.Tools.defs[id]);
    UI.dialog({ title: 'Contornar demarcador', width: 360,
      body: [UI.row('Ferramenta', UI.select(tools, tool, (v) => { tool = v; }, { keepFocus: true, width: 200 }).el), UI.row('', UI.check('Simular pressão', false, (v) => { sim = v; }).el)],
      buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => strokePath(doc, path, tool, sim) }] });
  }
  Paths.strokeDialog = strokePathDialog;

  /* ==================================================================
     FORMAS PERSONALIZADAS (biblioteca própria)
     ================================================================== */
  const CUSTOM = [
    ['heart', 'Coração', 'M50 88C20 66 6 50 6 31C6 17 17 8 29 8C39 8 46 14 50 22C54 14 61 8 71 8C83 8 94 17 94 31C94 50 80 66 50 88Z'],
    ['star5', 'Estrela', 'M50 4L61 37L96 37L68 58L79 92L50 71L21 92L32 58L4 37L39 37Z'],
    ['burst', 'Explosão', 'M50 2L58 26L80 12L74 37L98 38L78 53L94 72L69 70L70 95L52 80L36 98L32 73L8 80L20 58L2 44L26 36L14 14L39 24Z'],
    ['check', 'Visto', 'M8 52L22 38L40 56L80 14L94 28L40 84Z'],
    ['cross', 'Xis', 'M20 6L50 36L80 6L94 20L64 50L94 80L80 94L50 64L20 94L6 80L36 50L6 20Z'],
    ['plus', 'Mais', 'M38 6H62V38H94V62H62V94H38V62H6V38H38Z'],
    ['arrowR', 'Seta direita', 'M6 38H58V14L94 50L58 86V62H6Z'],
    ['arrowL', 'Seta esquerda', 'M94 38H42V14L6 50L42 86V62H94Z'],
    ['arrowU', 'Seta para cima', 'M38 94V42H14L50 6L86 42H62V94Z'],
    ['arrowD', 'Seta para baixo', 'M38 6V58H14L50 94L86 58H62V6Z'],
    ['arrowLR', 'Seta dupla', 'M6 50L30 22V38H70V22L94 50L70 78V62H30V78Z'],
    ['chevron', 'Divisa', 'M10 10H50L90 50L50 90H10L50 50Z'],
    ['bubble', 'Balão de fala', 'M14 10H86C92 10 96 14 96 20V62C96 68 92 72 86 72H44L22 92L26 72H14C8 72 4 68 4 62V20C4 14 8 10 14 10Z'],
    ['thought', 'Balão de pensamento', 'M30 66C14 66 6 56 10 46C2 38 8 24 22 26C24 12 42 8 50 18C60 6 80 10 82 24C96 26 98 44 88 50C94 62 80 72 68 66C62 74 42 74 30 66ZM20 80C20 76 24 74 27 76C30 78 28 84 24 84C21 84 20 82 20 80ZM10 92C10 89 13 88 15 89C17 91 16 95 13 95C11 95 10 94 10 92Z'],
    ['bolt', 'Raio', 'M58 2L18 56H46L38 98L82 40H54Z'],
    ['drop', 'Gota', 'M50 4C50 4 18 46 18 64C18 82 32 96 50 96C68 96 82 82 82 64C82 46 50 4 50 4Z'],
    ['leaf', 'Folha', 'M10 90C10 40 40 10 92 8C90 60 60 90 10 90ZM18 82L70 30'],
    ['moon', 'Lua', 'M62 6C40 10 24 30 24 52C24 76 44 94 68 94C78 94 86 91 92 86C66 86 46 66 46 42C46 26 52 14 62 6Z'],
    ['sun', 'Sol', 'M50 28C62 28 72 38 72 50C72 62 62 72 50 72C38 72 28 62 28 50C28 38 38 28 50 28ZM46 2H54V20H46ZM46 80H54V98H46ZM2 46H20V54H2ZM80 46H98V54H80ZM14 20L20 14L33 27L27 33ZM67 73L73 67L86 80L80 86ZM80 14L86 20L73 33L67 27ZM20 86L14 80L27 67L33 73Z'],
    ['cloud', 'Nuvem', 'M26 80C12 80 4 70 4 60C4 50 12 42 22 42C22 26 36 16 50 16C62 16 72 24 76 36C88 36 96 46 96 58C96 70 86 80 74 80Z'],
    ['house', 'Casa', 'M50 6L94 44H82V94H58V64H42V94H18V44H6Z'],
    ['envelope', 'Envelope', 'M6 20H94V80H6ZM10 24V26L50 54L90 26V24Z'],
    ['note', 'Nota musical', 'M38 12L86 4V70C86 79 78 86 68 86C58 86 52 80 52 73C52 65 59 59 68 59C71 59 74 60 76 61V22L48 27V78C48 87 40 94 30 94C20 94 14 88 14 81C14 73 21 67 30 67C33 67 36 68 38 69Z'],
    ['paw', 'Pegada', 'M50 50C64 50 80 66 80 78C80 88 70 92 62 90C56 89 54 86 50 86C46 86 44 89 38 90C30 92 20 88 20 78C20 66 36 50 50 50ZM24 30C30 30 34 36 34 44C34 50 30 54 26 54C20 54 16 48 16 40C16 34 20 30 24 30ZM76 30C80 30 84 34 84 40C84 48 80 54 74 54C70 54 66 50 66 44C66 36 70 30 76 30ZM40 10C46 10 50 18 50 26C50 32 46 36 42 36C36 36 32 28 32 22C32 14 36 10 40 10ZM60 10C64 10 68 14 68 22C68 28 64 36 58 36C54 36 50 32 50 26C50 18 54 10 60 10Z'],
    ['ring', 'Anel', 'M50 6C74 6 94 26 94 50C94 74 74 94 50 94C26 94 6 74 6 50C6 26 26 6 50 6ZM50 26C37 26 26 37 26 50C26 63 37 74 50 74C63 74 74 63 74 50C74 37 63 26 50 26Z'],
    ['hexagon', 'Hexágono', 'M50 4L90 27V73L50 96L10 73V27Z'],
    ['octagon', 'Octógono', 'M32 4H68L96 32V68L68 96H32L4 68V32Z'],
    ['triangle', 'Triângulo', 'M50 6L96 92H4Z'],
    ['diamond', 'Losango', 'M50 2L94 50L50 98L6 50Z'],
    ['frame', 'Moldura', 'M4 4H96V96H4ZM16 16V84H84V16Z'],
    ['ribbon', 'Faixa', 'M2 30H20V22H80V30H98L88 48L98 66H80V74H20V66H2L12 48Z'],
    ['crown', 'Coroa', 'M8 80L4 26L28 48L50 14L72 48L96 26L92 80Z'],
    ['puzzle', 'Peça', 'M10 30H34C30 24 32 12 44 12C56 12 58 24 54 30H80V54C86 50 96 52 96 64C96 76 86 78 80 74V96H10Z']
  ];
  Shapes.CUSTOM = CUSTOM;
  Shapes.userCustom = U.store.get('customShapes', []);
  Shapes.customAll = () => CUSTOM.map(([id, name, d]) => ({ id, name, d })).concat(Shapes.userCustom);
  Shapes.customPath = function (id, x, y, w, h) {
    const it = Shapes.customAll().find((c) => c.id === id) || { d: CUSTOM[0][2] };
    const p = Paths.fromSVG(it.d);
    const b = Paths.bounds(p) || { x: 0, y: 0, w: 100, h: 100 };
    Paths.map(p, (px, py) => ({ x: x + ((px - b.x) / (b.w || 1)) * w, y: y + ((py - b.y) / (b.h || 1)) * h }));
    p.rule = 'evenodd';
    return p;
  };
  Shapes.customPreview = function (id, s) {
    const c = U.domCanvas(s, s), x = c.getContext('2d'), p = Shapes.customPath(id, 3, 3, s - 6, s - 6);
    x.fillStyle = '#d6d9de'; x.fill(Paths.to2D(p), 'evenodd');
    return c;
  };

  /* ==================================================================
     PAINEL DEMARCADORES
     ================================================================== */
  let proot, plist;
  function pathThumb(path, doc) {
    const c = U.domCanvas(38, 28), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 38, 28);
    if (path && doc) { const k = Math.min(38 / doc.width, 28 / doc.height); x.setTransform(k, 0, 0, k, (38 - doc.width * k) / 2, (28 - doc.height * k) / 2); x.fillStyle = '#555'; x.fill(Paths.to2D(path), path.rule || 'nonzero'); }
    return c;
  }
  function renderPaths() {
    if (!proot || !proot.isConnected) return;
    U.clear(plist);
    const doc = IMG.app.doc;
    if (!doc) { plist.appendChild(el('div.panel-empty', { text: 'Nenhum documento aberto.' })); return; }
    const L = doc.active, rows = [];
    if (L && L.type === 'shape') rows.push({ key: 'shape', name: L.name + ' — demarcador da forma', path: Shapes.normalize(L.shape).path, italic: true, on: doc.pathTarget !== 'doc' && doc.pathTarget !== 'vmask' });
    if (L && L.vmask) rows.push({ key: 'vmask', name: L.name + ' — máscara vetorial', path: L.vmask.path, italic: true, on: doc.pathTarget === 'vmask' });
    (doc.paths || []).forEach((p) => rows.push({ key: p.id, entry: p, name: p.name, path: p.path, italic: p.kind === 'work', on: doc.pathTarget === 'doc' && doc.activePathId === p.id }));
    if (!rows.length) plist.appendChild(el('div.panel-empty', { text: 'Sem demarcadores. Use a Caneta no modo Demarcador.' }));
    rows.forEach((r) => {
      const row = el('div.prow' + (r.on ? '.on' : ''), pathThumb(r.path, doc), el('span.pname' + (r.italic ? '.it' : ''), { text: r.name }));
      row.addEventListener('click', () => {
        if (r.key === 'shape') doc.pathTarget = 'shape';
        else if (r.key === 'vmask') doc.pathTarget = 'vmask';
        else { doc.pathTarget = 'doc'; doc.activePathId = r.key; }
        renderPaths(); IMG.Engine.requestRender();
      });
      if (r.entry) row.addEventListener('dblclick', () => {
        IMG.UI.prompt(r.entry.kind === 'work' ? 'Salvar demarcador' : 'Renomear demarcador', 'Nome', r.entry.kind === 'work' ? 'Demarcador ' + ((doc.paths || []).filter((q) => q.kind === 'saved').length + 1) : r.entry.name).then((v) => { if (v) { r.entry.name = v; r.entry.kind = 'saved'; renderPaths(); IMG.commit('Salvar demarcador'); } });
      });
      plist.appendChild(row);
    });
  }
  function curPath(doc) { const tg = Paths.target(doc); return tg ? tg.path : null; }
  IMG.UI.registerPanel({
    id: 'paths', title: 'Demarcadores', icon: 'paths',
    build(node) {
      proot = node; const UI = IMG.UI;
      plist = el('div.plist');
      plist.addEventListener('click', (e) => { if (e.target === plist) { const d = IMG.app.doc; if (d) { d.activePathId = null; d.pathTarget = 'doc'; renderPaths(); IMG.Engine.requestRender(); } } });
      const need = (fn) => () => { const d = IMG.app.doc; const p = d && curPath(d); if (!p || !p.subs.length) { UI.toast('Selecione um demarcador no painel.'); return; } fn(d, p); };
      const foot = el('div.panel-foot',
        UI.iconBtn('bucket', 'Preencher demarcador com a cor do primeiro plano (Alt: opções)', (e) => need((d, p) => { if (e && e.altKey) fillPathDialog(d, p); else { const L = IMG.Layers.paintTarget(d); if (!L) return; const m = Paths.fillCanvas(p, d.rect); const x = m.getContext('2d'); x.globalCompositeOperation = 'source-in'; x.fillStyle = IMG.app.fg; x.fillRect(0, 0, d.width, d.height); IMG.paintCanvas(d, L, m, {}); IMG.commit('Preencher demarcador'); } })()),
        UI.iconBtn('brush', 'Contornar demarcador com o pincel (Alt: opções)', (e) => need((d, p) => { if (e && e.altKey) strokePathDialog(d, p); else strokePath(d, p, 'brush', false); })()),
        UI.iconBtn('selNew', 'Carregar demarcador como seleção', need((d, p) => { Paths.toSelection(d, p, 'new'); IMG.commit('Carregar seleção'); })),
        UI.iconBtn('paths', 'Criar demarcador de trabalho a partir da seleção', () => UI.run('select.toPath')),
        UI.iconBtn('vmask', 'Adicionar máscara vetorial com o demarcador', () => UI.run('layer.vmaskPath')),
        el('span.pgroup-fill'),
        UI.iconBtn('newLayer', 'Novo demarcador', () => { const d = IMG.app.doc; if (!d) return; d.paths = d.paths || []; const e = { id: U.uid('path'), name: 'Demarcador ' + (d.paths.filter((q) => q.kind === 'saved').length + 1), kind: 'saved', path: Paths.empty() }; d.paths.push(e); d.activePathId = e.id; d.pathTarget = 'doc'; renderPaths(); IMG.commit('Novo demarcador'); }),
        UI.iconBtn('trash', 'Excluir demarcador', () => { const d = IMG.app.doc; if (!d) return; if (d.pathTarget === 'doc' && d.activePathId) { d.paths = (d.paths || []).filter((q) => q.id !== d.activePathId); d.activePathId = null; renderPaths(); IMG.Engine.requestRender(); IMG.commit('Excluir demarcador'); } else if (d.pathTarget === 'vmask') UI.run('layer.vmaskDelete'); }));
      proot.append(plist, foot);
      ['paths:change', 'doc:change', 'layers:select', 'layers:change', 'history:change'].forEach((e) => bus.on(e, renderPaths));
      renderPaths();
    },
    onShow() { renderPaths(); }
  });

  /* ---------- exibição do demarcador alvo na tela ---------- */
  IMG.drawTargetPath = function (ctx, v, doc) {
    if (!IMG.app.prefs || IMG.app.prefs.showPath === false) return;
    const tg = Paths.target(doc); if (!tg || !tg.path || !tg.path.subs.length) return;
    const t = IMG.Tools.activeId;
    if (tg.kind === 'shape' && !/^(pen|freePen|curvPen|addAnchor|delAnchor|convertPt|pathSelect|directSelect|shape)/.test(t || '')) return;
    ctx.save();
    ctx.beginPath(); Paths.trace(ctx, tg.path, new DOMMatrix([v.zoom, 0, 0, v.zoom, v.x, v.y]));
    ctx.lineWidth = 1; ctx.strokeStyle = '#3d8bff'; ctx.stroke();
    ctx.restore();
  };

  /* ==================================================================
     COMANDOS
     ================================================================== */
  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, H) => {
    const doc = H.doc, act = H.act;
    const done = (L, label) => { bus.emit('layers:change', IMG.app.doc); IMG.Engine.invalidate(); IMG.commit(label); };
    C('select.toPath', 'Criar demarcador de trabalho…', () => {
      const d = doc(); if (!d.selection) { IMG.UI.toast('Faça uma seleção primeiro.'); return; }
      let tol = 2;
      IMG.UI.dialog({ title: 'Criar demarcador de trabalho', width: 320, body: IMG.UI.row('Tolerância', IMG.UI.num({ value: 2, min: 0.5, max: 10, decimals: 1, unit: 'px', width: 80, onInput: (v) => { tol = v; } }).el),
        buttons: [{ label: 'Cancelar' }, { label: 'OK', primary: true, onClick: () => {
          const p = Paths.fromSelection(d, tol); if (!p) return;
          d.paths = (d.paths || []).filter((q) => q.kind !== 'work');
          const e = { id: U.uid('path'), name: 'Demarcador de trabalho', kind: 'work', path: p };
          d.paths.push(e); d.activePathId = e.id; d.pathTarget = 'doc';
          IMG.Selection.clear(d);
          bus.emit('paths:change', d); IMG.UI.showPanel('paths'); IMG.Engine.requestRender();
          IMG.commit('Criar demarcador de trabalho');
        } }] });
    }, { enabled: H.hasSel });
    const vmask = (invert) => () => { const L = act(); if (!L || L.isBg) return; L.vmask = { path: Paths.empty(), invert, enabled: true, density: 100, feather: 0, _ver: 1 }; doc().pathTarget = 'vmask'; done(L, 'Adicionar máscara vetorial'); };
    C('layer.vmaskReveal', 'Revelar tudo', vmask(false), { enabled: () => !!(act() && !act().isBg) });
    C('layer.vmaskHide', 'Ocultar tudo', vmask(true), { enabled: () => !!(act() && !act().isBg) });
    C('layer.vmaskPath', 'Demarcador atual', () => {
      const d = doc(), L = act(); if (!L) return;
      const e = (d.paths || []).find((q) => q.id === d.activePathId) || (d.paths || []).find((q) => q.kind === 'work');
      if (!e || !e.path.subs.length) { IMG.UI.toast('Não há demarcador ativo no painel Demarcadores.'); return; }
      L.vmask = { path: Paths.clone(e.path), invert: false, enabled: true, density: 100, feather: 0, _ver: 1 };
      if (e.kind === 'work') d.paths = d.paths.filter((q) => q !== e);
      d.pathTarget = 'vmask';
      done(L, 'Adicionar máscara vetorial');
    }, { enabled: () => !!(act() && !act().isBg) });
    C('layer.vmaskDelete', 'Excluir', () => { const L = act(); if (L && L.vmask) { L.vmask = null; doc().pathTarget = null; done(L, 'Excluir máscara vetorial'); } }, { enabled: () => !!(act() && act().vmask) });
    C('layer.vmaskToggle', 'Desativar', () => { const L = act(); if (L && L.vmask) { L.vmask.enabled = L.vmask.enabled === false; Paths.touch(L.vmask); done(L, L.vmask.enabled ? 'Ativar máscara vetorial' : 'Desativar máscara vetorial'); } }, { enabled: () => !!(act() && act().vmask), label2: () => (act() && act().vmask && act().vmask.enabled === false ? 'Ativar' : null) });
    C('layer.vmaskRasterize', 'Rasterizar máscara vetorial', () => {
      const d = doc(), L = act(); if (!L || !L.vmask) return;
      const mc = Paths.maskCanvas(L.vmask, d);
      const c = U.cloneCanvas(mc.canvas);
      if (L.mask) { const m = IMG.Selection.maskCanvas(d, L), x = c.getContext('2d'); x.globalCompositeOperation = 'destination-in'; x.drawImage(m, 0, 0); }
      L.mask = IMG.Layers.makeMask(c, 0, 0, 0);
      L.vmask = null; done(L, 'Rasterizar máscara vetorial');
    }, { enabled: () => !!(act() && act().vmask) });
    // Combinar formas (camadas de forma selecionadas)
    const combine = (op, label) => () => {
      const d = doc(), sel = IMG.Layers.selectedLayers(d).filter((L) => L.type === 'shape');
      if (sel.length < 2) { const L = act(); if (L && L.type === 'shape') { L.shape = Shapes.normalize(L.shape); L.shape.path.subs.forEach((s, i) => { if (i) s.op = op; }); L.shape.live = null; Shapes.render(L); done(L, label); } return; }
      const ordered = IMG.Layers.all(d).filter((L) => sel.includes(L));
      const base = ordered[0]; base.shape = Shapes.normalize(base.shape); base.shape.live = null;
      for (let i = 1; i < ordered.length; i++) { const s = Shapes.normalize(ordered[i].shape); s.path.subs.forEach((q, k) => { q.op = k === 0 ? op : q.op; base.shape.path.subs.push(q); }); IMG.Layers.remove(d, ordered[i]); }
      Shapes.render(base); d.activeId = base.id; d.selected = new Set([base.id]);
      done(base, label);
    };
    C('shape.unite', 'Unir formas', combine('add', 'Unir formas'), { enabled: () => !!(act() && act().type === 'shape') });
    C('shape.subtract', 'Subtrair forma da frente', combine('sub', 'Subtrair forma'), { enabled: () => !!(act() && act().type === 'shape') });
    C('shape.intersect', 'Fazer interseção das formas', combine('int', 'Interseção de formas'), { enabled: () => !!(act() && act().type === 'shape') });
    C('shape.exclude', 'Excluir sobreposição', combine('xor', 'Excluir sobreposição'), { enabled: () => !!(act() && act().type === 'shape') });
    C('edit.defineShape', 'Definir forma personalizada…', () => {
      const d = doc(), p = curPath(d) || (act() && act().type === 'shape' ? Shapes.normalize(act().shape).path : null);
      if (!p || !p.subs.length) { IMG.UI.toast('Selecione um demarcador ou uma camada de forma.'); return; }
      IMG.UI.prompt('Nome da forma', 'Nome', 'Forma ' + (Shapes.userCustom.length + 1)).then((v) => {
        if (!v) return;
        const b = Paths.bounds(p), k = 100 / Math.max(b.w, b.h, 1), q = Paths.clone(p);
        Paths.map(q, (x, y) => ({ x: (x - b.x) * k, y: (y - b.y) * k }));
        Shapes.userCustom.push({ id: U.uid('cs'), name: v, d: Paths.toSVG(q) });
        U.store.set('customShapes', Shapes.userCustom);
        IMG.UI.toast('Forma "' + v + '" definida.');
      });
    }, { enabled: H.has });
    C('path.fill', 'Preencher demarcador…', () => { const d = doc(), p = curPath(d); if (p) fillPathDialog(d, p); }, { enabled: () => !!(IMG.app.doc && curPath(IMG.app.doc)) });
    C('path.stroke', 'Contornar demarcador…', () => { const d = doc(), p = curPath(d); if (p) strokePathDialog(d, p); }, { enabled: () => !!(IMG.app.doc && curPath(IMG.app.doc)) });
    C('path.toSelection', 'Criar seleção a partir do demarcador', () => { const d = doc(), p = curPath(d); if (p) { Paths.toSelection(d, p, 'new'); IMG.commit('Carregar seleção'); } }, { enabled: () => !!(IMG.app.doc && curPath(IMG.app.doc)), keys: ['ctrl+enter'] });
  });
})();
