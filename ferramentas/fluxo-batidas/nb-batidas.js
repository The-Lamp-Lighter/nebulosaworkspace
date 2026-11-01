/* [Nebulosa] Fluxo 0.4.2 — batidas editáveis na linha do tempo.
   Antes só dava para detectar (Batidas) e marcar/desmarcar na agulha (M). Agora cada batida da régua:
     - clique: seleciona (Shift ou Ctrl: várias) e leva a agulha até ela;
     - arrastar: move (todas as selecionadas juntas), grudando nas bordas dos clipes e na agulha,
       e sempre num quadro inteiro;
     - dois cliques na régua: põe uma batida (ou tira, em cima de uma);
     - botão direito (na batida ou na régua): força, apagar, selecionar todas, adicionar aqui;
     - Delete apaga; ← → movem um quadro (Shift = 10); Esc desmarca;
     - painel Projeto (sem clipe selecionado): tempo exato e força das selecionadas.
   Tudo passa pelo desfazer (Ctrl+Z). A seleção fica em f.ui.beatSel (ids das batidas).
   No código-fonte do Fluxo: o equivalente vai em src/ui/Timeline.tsx (régua e teclado) e no painel
   Projeto do inspetor. */
var nbBatSetUIOrig = f.setUI;
f.setUI = function (e) {
  // escolher clipes (ou clicar no vazio, ou Esc) desmarca as batidas
  if (e && "selected" in e && !("beatSel" in e) && f.ui.beatSel && f.ui.beatSel.length) e = Object.assign({}, e, { beatSel: [] });
  return nbBatSetUIOrig.call(f, e);
};
var nbBatArr = null;
function nbBatSel() {
  var s = f.ui.beatSel;
  if (!s || !s.length) return [];
  var ids = new Set(f.project.markers.map(function (m) { return m.id; }));
  return s.filter(function (id) { return ids.has(id); });
}
function nbBatOrdenar(p) { p.markers.sort(function (a, b) { return a.t - b.t; }); }
function nbBatQuadro(t) { var q = f.project.fps || 30; return Math.max(0, Math.round(t * q) / q); }
function nbBatTexto(m) {
  return "Batida em " + tr(m.t, f.project.fps) + " \xB7 for\xE7a " + Math.round((m.strength ?? 1) * 100) + "% — arraste para mover; dois cliques apaga; bot\xE3o direito: mais op\xE7\xF5es";
}
function nbBatEscolher(ids) { f.setUI({ selected: [], selectedTransition: null, beatSel: ids }); }
function nbBatAdicionar(t) {
  t = nbBatQuadro(t);
  var meio = 0.5 / (f.project.fps || 30), ja = f.project.markers.find(function (m) { return Math.abs(m.t - t) < meio; });
  if (ja) { nbBatEscolher([ja.id]); return ja.id; }
  var id = Bt("mk");
  f.commit("Adicionar batida", function (p) { p.markers.push({ id: id, t: t, kind: "beat", strength: 1 }); nbBatOrdenar(p); });
  nbBatEscolher([id]);
  Z.requestRender();
  return id;
}
function nbBatApagar(ids) {
  ids = ids || nbBatSel();
  if (!ids.length) return;
  var s = new Set(ids);
  f.commit(ids.length > 1 ? "Apagar batidas" : "Apagar batida", function (p) { p.markers = p.markers.filter(function (m) { return !s.has(m.id); }); });
  f.setUI({ beatSel: [] });
  Z.requestRender();
  f.toast(ids.length > 1 ? ids.length + " batidas apagadas (Ctrl+Z desfaz)" : "Batida apagada (Ctrl+Z desfaz)", "ok", 2200);
}
function nbBatMover(ids, dt) {
  if (!ids.length) return;
  var s = new Set(ids), menor = Infinity;
  f.project.markers.forEach(function (m) { if (s.has(m.id)) menor = Math.min(menor, m.t); });
  dt = Math.max(-menor, dt);
  f.commit(ids.length > 1 ? "Mover batidas" : "Mover batida", function (p) {
    p.markers.forEach(function (m) { if (s.has(m.id)) m.t = nbBatQuadro(m.t + dt); });
    nbBatOrdenar(p);
  });
  Z.requestRender();
}
function nbBatForca(ids, v, vivo) {
  var s = new Set(ids);
  uo("For\xE7a da batida", function (p) { p.markers.forEach(function (m) { if (s.has(m.id)) m.strength = Math.max(0, Math.min(1, v)); }); }, vivo);
}
function nbBatTempo(id, v, vivo) {
  uo("Tempo da batida", function (p) {
    var m = p.markers.find(function (x) { return x.id === id; });
    if (m) { m.t = nbBatQuadro(v); nbBatOrdenar(p); }
  }, vivo);
}
function nbBatTodas() { nbBatEscolher(f.project.markers.map(function (m) { return m.id; })); }

/* ---------- arrastar ---------- */
function nbBatDown(ev, m) {
  ev.stopPropagation();
  if (ev.button !== 0) return;
  ev.preventDefault();
  var mod = ev.shiftKey || ev.ctrlKey || ev.metaKey, sel = nbBatSel(), tem = sel.indexOf(m.id) >= 0;
  if (mod) sel = tem ? sel.filter(function (x) { return x !== m.id; }) : sel.concat([m.id]);
  else if (!tem) sel = [m.id];
  nbBatEscolher(sel);
  if (sel.indexOf(m.id) < 0) { nbBatArr = null; return; }
  try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (x) { /* ignora */ }
  var orig = {};
  f.project.markers.forEach(function (x) { if (sel.indexOf(x.id) >= 0) orig[x.id] = x.t; });
  nbBatArr = { prim: m.id, orig: orig, x0: ev.clientX, moved: false, mod: mod };
}
function nbBatMove(ev) {
  var a = nbBatArr;
  if (!a) return;
  ev.stopPropagation();
  var dx = ev.clientX - a.x0;
  if (!a.moved && Math.abs(dx) < 3) return;
  var p = f.project, z = f.ui.zoom, ids = Object.keys(a.orig);
  if (!a.moved) { a.moved = true; f.beginGesture(ids.length > 1 ? "Mover batidas" : "Mover batida"); }
  var t0 = a.orig[a.prim], alvo = t0 + dx / z, fim = null;
  if (f.ui.snapping) {
    // gruda na agulha e nas bordas dos clipes (não em outras batidas, para não juntar duas no mesmo lugar)
    var melhor = 8 / z, pontos = [J.time];
    De(p).forEach(function (c) { pontos.push(c.start, c.start + c.duration); });
    pontos.forEach(function (v) { var d = Math.abs(v - alvo); if (d < melhor) { melhor = d; fim = v; } });
  }
  if (fim === null) fim = nbBatQuadro(alvo);
  var menor = Infinity;
  ids.forEach(function (id) { menor = Math.min(menor, a.orig[id]); });
  var d = Math.max(-menor, fim - t0);
  p.markers.forEach(function (x) { if (x.id in a.orig) x.t = Math.max(0, a.orig[x.id] + d); });
  nbBatOrdenar(p);
  f.touch();
  Z.requestRender();
}
function nbBatUp(ev) {
  var a = nbBatArr;
  if (!a) return;
  nbBatArr = null;
  if (a.moved) { f.endGesture(); Z.requestRender(); }
  else if (!a.mod && a.orig[a.prim] !== void 0) Z.seek(a.orig[a.prim]);
  f.touch();
}

/* ---------- menus ---------- */
function nbBatMenu(ev, m) {
  ev.preventDefault();
  ev.stopPropagation();
  var sel = nbBatSel();
  if (sel.indexOf(m.id) < 0) { sel = [m.id]; nbBatEscolher(sel); }
  var forca = function (v) { return function () { nbBatForca(sel, v, false); }; };
  ta(ev.nativeEvent || ev, [
    { label: "Levar a agulha at\xE9 a batida", action: function () { Z.seek(m.t); } },
    "sep",
    { label: "For\xE7a: forte (100%)", action: forca(1) },
    { label: "For\xE7a: m\xE9dia (70%)", action: forca(0.7) },
    { label: "For\xE7a: fraca (40%)", action: forca(0.4) },
    "sep",
    { label: sel.length > 1 ? "Apagar " + sel.length + " batidas" : "Apagar batida", k: "Delete", action: function () { nbBatApagar(sel); } },
    { label: "Selecionar todas as batidas", action: nbBatTodas }
  ]);
}
function nbBatRegua(ev, el) {
  // tempo no ponto clicado, só quando o clique foi na régua (faixa de cima)
  var r = el && el.querySelector(".ruler");
  if (!r) return null;
  var b = r.getBoundingClientRect();
  if (ev.clientY < b.top || ev.clientY > b.bottom) return null;
  return Math.max(0, (ev.clientX - b.left) / f.ui.zoom);
}
function nbBatDuplo(ev, el) {
  var t = nbBatRegua(ev, el);
  if (t === null) return;
  ev.preventDefault();
  var lim = 5 / f.ui.zoom, perto = null;
  f.project.markers.forEach(function (m) { var d = Math.abs(m.t - t); if (d <= lim && (!perto || d < Math.abs(perto.t - t))) perto = m; });
  if (perto) nbBatApagar([perto.id]); else nbBatAdicionar(t);
}
function nbBatMenuRegua(ev, el) {
  var t = nbBatRegua(ev, el);
  if (t === null) return;
  var itens = [
    { label: "Adicionar batida aqui", action: function () { nbBatAdicionar(t); } },
    { label: "Adicionar batida na agulha", k: "M", action: function () { nbBatAdicionar(J.time); } }
  ];
  if (f.project.markers.length) itens.push("sep", { label: "Selecionar todas as batidas", action: nbBatTodas });
  ta(ev.nativeEvent || ev, itens);
}

/* ---------- a batida na régua ---------- */
function NbBatida({ m: m, z: z, sel: sel }) {
  var arrastando = !!(nbBatArr && nbBatArr.moved && nbBatArr.prim === m.id);
  return (0, O.jsx)("div", {
    className: "marker-pin nb-pin" + (m.kind === "user" ? " user" : "") + (sel ? " is-sel" : ""),
    style: { left: m.t * z, opacity: sel ? 1 : 0.45 + (m.strength ?? 1) * 0.55 },
    title: arrastando ? void 0 : nbBatTexto(m),
    onPointerDown: function (ev) { nbBatDown(ev, m); },
    onPointerMove: nbBatMove,
    onPointerUp: nbBatUp,
    onPointerCancel: nbBatUp,
    onDoubleClick: function (ev) { ev.stopPropagation(); ev.preventDefault(); nbBatApagar([m.id]); },
    onContextMenu: function (ev) { nbBatMenu(ev, m); },
    children: arrastando ? (0, O.jsx)("span", { className: "nb-pin-t", children: tr(m.t, f.project.fps) }) : null
  });
}

/* ---------- painel Projeto (inspetor, sem clipe selecionado) ---------- */
function NbBatidasPainel() {
  var s = kt("beatSel") || [], p = f.project;
  if (!p.markers.length) return null;
  var set = new Set(s), sel = p.markers.filter(function (m) { return set.has(m.id); }), n = sel.length;
  if (!n) return (0, O.jsxs)(wt, { title: "Batidas", id: "proj-beats", children: [
    (0, O.jsx)("p", { className: "hint", style: { margin: "0 0 10px" }, children: "Clique numa batida na r\xE9gua da linha do tempo para escolher (Shift ou Ctrl: v\xE1rias). Arraste para mover; dois cliques na r\xE9gua p\xF5em ou tiram uma batida; Delete apaga." }),
    (0, O.jsx)("div", { className: "btn-row", children: (0, O.jsx)("button", { className: "btn btn-sm", onClick: nbBatTodas, children: "Selecionar todas" }) })
  ] });
  var ids = sel.map(function (m) { return m.id; }), m0 = sel[0], fps = p.fps || 30;
  var forca = Math.round(sel.reduce(function (a, m) { return a + (m.strength ?? 1); }, 0) / n * 100);
  return (0, O.jsxs)(wt, { title: "Batidas", id: "proj-beats", children: [
    (0, O.jsx)("p", { className: "hint", style: { margin: "0 0 8px", color: "var(--beat)" }, children: n === 1 ? "1 batida selecionada" : n + " batidas selecionadas" }),
    n === 1 && (0, O.jsx)(gt, { label: "Tempo", value: m0.t, min: 0, max: Math.max($t(p), m0.t + 1, 1), step: 1 / fps, unit: "s", onChange: function (v, vivo) { nbBatTempo(m0.id, v, vivo); } }),
    (0, O.jsx)(gt, { label: "For\xE7a", value: forca, min: 0, max: 100, step: 1, unit: "%", def: 100, onChange: function (v, vivo) { nbBatForca(ids, v / 100, vivo); } }),
    (0, O.jsx)("p", { className: "hint", style: { margin: "6px 0 10px" }, children: "Arraste a batida na r\xE9gua ou mude os valores acima. As setas ← → movem um quadro (Shift = 10); Delete apaga." }),
    (0, O.jsxs)("div", { className: "btn-row", children: [
      n === 1 && (0, O.jsx)("button", { className: "btn btn-sm", onClick: function () { Z.seek(m0.t); }, children: "Ir at\xE9 a batida" }),
      (0, O.jsx)("button", { className: "btn btn-sm", onClick: function () { nbBatApagar(ids); }, children: n > 1 ? "Apagar " + n + " batidas" : "Apagar batida" }),
      (0, O.jsx)("button", { className: "btn btn-sm btn-ghost", onClick: function () { f.setUI({ beatSel: [] }); }, children: "Desmarcar" }),
      n < p.markers.length && (0, O.jsx)("button", { className: "btn btn-sm btn-ghost", onClick: nbBatTodas, children: "Selecionar todas" })
    ] })
  ] });
}
