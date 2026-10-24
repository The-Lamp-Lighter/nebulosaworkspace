/* ==========================================================================
   Imaginarium — ícones da aparência "Photopea"
   Desenhos próprios (grade 24×24, preenchidos, cinza-claro), no mesmo estilo
   e peso visual da interface do Photopea. Os nomes coincidem com os ícones
   padrão: ao trocar a aparência, IMG.icon() passa a usar estes desenhos.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG;
  const S = (d, w) => '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="' + (w || 1.7) + '"/>';
  const D = (d, w) => '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="' + (w || 1.6) + '" stroke-dasharray="2.6 1.9" stroke-linecap="butt"/>';
  const P = (d) => '<path d="' + d + '"/>';
  const E = (d) => '<path fill-rule="evenodd" d="' + d + '"/>';
  const R = (deg, inner) => '<g transform="rotate(' + deg + ' 12 12)">' + inner + '</g>';
  const corner = '<path d="M21.5 18.5v3h-3z" opacity=".85"/>';

  // peças reutilizadas
  const ARROW = 'M4.5 2.5v15.6l3.9-3.6 2.7 6.1 2.6-1.1-2.7-6h5.4z';
  const NIB = 'M12 2.2l5.6 8.4-2.2 6.4H8.6l-2.2-6.4z M11.2 6.8v3.6a1.7 1.7 0 101.6 0V6.8z';
  const nib = (extra) => R(-135, E(NIB) + P('M8.4 18.3h7.2v2.6H8.4z')) + (extra || '');
  const BRUSH = 'M20.4 2.2c.6-.4 1.3.2 1 .8l-6.4 9.5-2.6-2.4z M10.9 11.2l2.7 2.4c-.4 3.2-2.7 5.5-6 6.5-1.6.5-3.4.6-5 .3 1.2-.8 1.7-2.1 2-3.6.6-3.3 3.3-5.6 6.3-5.6z';
  const ERASER = 'M14.4 3.3a2 2 0 012.8 0l3.5 3.5a2 2 0 010 2.8l-9.1 9.1H19v2.1H8.4l-5-5a2 2 0 010-2.8z M7.6 9.7l-3.1 3.1a.6.6 0 000 .9l4.4 4.4h1.6l3-3z';
  const LENS = 'M10 2.8a7.2 7.2 0 015.8 11.5l5.6 5.6-1.6 1.6-5.6-5.6A7.2 7.2 0 1110 2.8z M10 5a5 5 0 100 10 5 5 0 000-10z';
  const HAND = 'M8.6 21.6c-2.1-1-3.7-3.3-4.7-5.5L2.4 12.9c-.4-.9 0-1.9.9-2.2.8-.3 1.6 0 2 .8l1.3 2.4V5.4a1.45 1.45 0 012.9 0v5.9h.6V3.7a1.45 1.45 0 012.9 0v7.6h.6V4.7a1.45 1.45 0 012.9 0v6.9h.6V6.8a1.45 1.45 0 012.9 0v8.4c0 3.6-1.9 6.9-6.4 6.9z';
  const BANDAGE = 'M6.3 8.6h11.4a3.4 3.4 0 010 6.8H6.3a3.4 3.4 0 010-6.8z M9.6 9.9v4.2h4.8V9.9z';
  const STAR = (cx, cy, r) => { const p = []; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? r * 0.32 : r; p.push((cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2)); } return 'M' + p.join('L') + 'z'; };
  const STAR5 = (cx, cy, r) => { const p = []; for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? r * 0.42 : r; p.push((cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2)); } return 'M' + p.join('L') + 'z'; };
  const PIPETTE = 'M16.6 2.6a3 3 0 014.2 4.2L18.9 8.7l1 1-1.7 1.7-6.6-6.6 1.7-1.7 1 1z M11.1 7.5l5.4 5.4-7.4 7.4a3.1 3.1 0 01-2.2.9H5.4l-1.6 1.6-1-1 1.6-1.6v-1.5c0-.8.3-1.6.9-2.2z M11.1 10.5l-5 5c-.3.3-.4.6-.4 1v1.3h1.3c.4 0 .7-.1 1-.4l5-5z';

  IMG.iconSets.photopea = {
    /* ---------- ferramentas ---------- */
    move: P(ARROW) + P('M16.6 14.2h1.9v3.1h3.1v1.9h-3.1v3.1h-1.9v-3.1h-3.1v-1.9h3.1z'),
    artboard: P('M3.5 2.5v11l2.8-2.6 1.9 4.3 1.8-.8-1.9-4.2h3.8z') + E('M12.5 12.5h9v9h-9z M14.3 14.3v5.4h5.4v-5.4z'),
    marqueeRect: D('M3.6 5.3h16.8v13.4H3.6z'),
    marqueeEllipse: '<ellipse cx="12" cy="12" rx="9.2" ry="7.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.6 1.9"/>',
    marqueeRow: D('M2.5 12h19'),
    marqueeCol: D('M12 2.5v19'),
    lasso: S('M12 3.6c5.1 0 8.9 2.4 8.9 5.6s-3.8 5.6-8.9 5.6-8.9-2.4-8.9-5.6S6.9 3.6 12 3.6z') + S('M6.4 13.4c-1.8 1.4-1.4 3.7.6 4 1.7.2 1.5 2.4-.5 4.2'),
    polyLasso: S('M3.6 8.6l6.6-5 10.4 3.2-2.2 7.3-8.4 1.1z') + S('M6.6 13.4c-1.8 1.4-1.4 3.7.6 4 1.7.2 1.5 2.4-.5 4.2'),
    magLasso: S('M12 3.6c5.1 0 8.9 2.2 8.9 5.2S17.1 14 12 14s-8.9-2.2-8.9-5.2S6.9 3.6 12 3.6z') + S('M6.2 12.8c-1.6 1.4-1.2 3.4.6 3.7 1.5.2 1.3 2.2-.4 3.8') + P('M14 15.2h2v2.9a1 1 0 002 0v-2.9h2v2.9a3 3 0 01-6 0z'),
    wand: P('M2.9 19.4L13.1 9.2l1.8 1.8L4.7 21.2z') + P(STAR(17.2, 6.4, 4.6)),
    quickSel: P(BRUSH) + '<circle cx="15.5" cy="8.5" r="7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2 1.7"/>',
    crop: P('M5.6 1.6h2.6v14.2h14.2v2.6H5.6z') + P('M1.6 5.6h12.8v2.6H1.6z M15.8 9.6h2.6v12.8h-2.6z'),
    perspCrop: P('M5.6 1.6h2.6v14.2h14.2v2.6H5.6z') + P('M1.6 5.6h12.8v2.6H1.6z M15.8 9.6h2.6v12.8h-2.6z') + S('M10 13.6l1.6-3.4h2.2l1.2 3.4z', 1.2),
    slice: P('M2.6 21.4L14.8 3.6l2.3 1.5-5 11.6z') + P('M17.4 4.6l2.8 1.8-1.5 2.4-2.8-1.8z'),
    sliceSelect: P('M2.6 17.4L12.1 3.6l1.9 1.3-3.9 9z') + P('M12.6 11.5v10l2.5-2.3 1.7 3.9 1.7-.7-1.7-3.9h3.4z'),
    eyedropper: E(PIPETTE),
    colorSampler: E(PIPETTE) + S('M16.5 19h6M19.5 16v6', 1.6),
    ruler: R(-45, E('M1.5 8.5h21v7h-21z M4 11h1.4v2.6H4z M7.2 11h1.4v1.8H7.2z M10.4 11h1.4v2.6h-1.4z M13.6 11H15v1.8h-1.4z M16.8 11h1.4v2.6h-1.4z')),
    count: P('M5 3h2v18H5z M3 7h6v1.6H3z') + '<text x="10.5" y="20" font-size="10.5" font-family="Open Sans, sans-serif" font-weight="600" fill="currentColor">12</text>',
    spotHeal: R(-45, E(BANDAGE) + '<circle cx="11" cy="11.3" r=".75"/><circle cx="13" cy="12.7" r=".75"/>') + P(STAR(19.4, 4.6, 3)),
    heal: R(-45, E(BANDAGE) + '<circle cx="11" cy="11.3" r=".8"/><circle cx="13" cy="11.3" r=".8"/><circle cx="11" cy="12.7" r=".8"/><circle cx="13" cy="12.7" r=".8"/>'),
    patch: E('M4.6 9.2c-.6-3 1.7-5.4 4.6-5 1.5-1.8 4.6-2 6.2-.2 2.8-.3 5 2.2 4.4 5 2.1 1.8 1.7 5.3-.8 6.4.1 3-2.9 5-5.6 3.9-1.9 2-5.2 1.6-6.3-.9-2.8-.4-4-3.8-2.2-5.9-.8-1.1-.9-2.3-.3-3.3z M8 8.7c-.6 0-1 .7-.7 1.2l.5 1.1-.6 1c-.4.7.2 1.5.9 1.3l1.2-.2.8.9c.5.5 1.4.3 1.5-.4l.2-1.2 1.1-.5c.7-.3.7-1.2.1-1.6l-1-.6.1-1.2c0-.7-.7-1.1-1.3-.8l-1.1.6z')
      + D('M3.8 21.2h16.4', 1.3),
    contentMove: P('M12 1.8l3.4 3.4h-2.2v3.6h-2.4V5.2H8.6z M12 22.2l-3.4-3.4h2.2v-3.6h2.4v3.6h2.2z M1.8 12l3.4-3.4v2.2h3.6v2.4H5.2v2.2z M22.2 12l-3.4 3.4v-2.2h-3.6v-2.4h3.6V8.6z') + D('M8.7 8.7h6.6v6.6H8.7z', 1.3),
    redEye: E('M12 6.2c-4.9 0-8.3 3.7-9.4 5.8 1.1 2.1 4.5 5.8 9.4 5.8s8.3-3.7 9.4-5.8c-1.1-2.1-4.5-5.8-9.4-5.8z M12 8a4 4 0 110 8 4 4 0 010-8z') + '<circle cx="12" cy="12" r="2.1"/>' + P('M18.4 1.6h1.6v2.6h2.6v1.6H20v2.6h-1.6V5.8h-2.6V4.2h2.6z'),
    brush: P(BRUSH),
    pencil: E('M16.4 2.6a2 2 0 012.8 0l2.2 2.2a2 2 0 010 2.8L9.2 19.8 3 21.6l1.8-6.2z M6.5 15.9l-1 3.6 3.6-1z'),
    colorReplace: P(BRUSH) + S('M15.8 16.4a4 4 0 016.4 1.1M22.4 20.6a4 4 0 01-6.4-1.1', 1.4) + P('M22.6 14.9l-.1 3-2.8-1.1z M15.7 22.1l.1-3 2.8 1.1z'),
    mixer: P(BRUSH) + '<circle cx="18.6" cy="17.6" r="3.4"/>',
    stamp: E('M12 2.4a3.6 3.6 0 00-3.6 3.6c0 1.3.7 2.4 1.6 3V12H5.2A2.2 2.2 0 003 14.2v2.6h18v-2.6a2.2 2.2 0 00-2.2-2.2H14V9c.9-.6 1.6-1.7 1.6-3A3.6 3.6 0 0012 2.4z') + P('M3 18.4h18v2.8H3z'),
    patternStamp: E('M12 2.4a3.6 3.6 0 00-3.6 3.6c0 1.3.7 2.4 1.6 3V12H5.2A2.2 2.2 0 003 14.2v2.6h18v-2.6a2.2 2.2 0 00-2.2-2.2H14V9c.9-.6 1.6-1.7 1.6-3A3.6 3.6 0 0012 2.4z') + E('M3 18.4h18v2.8H3z M6 19.1h1.6v1.4H6z M9.6 19.1h1.6v1.4H9.6z M13.2 19.1h1.6v1.4h-1.6z M16.8 19.1h1.6v1.4h-1.6z'),
    historyBrush: P(BRUSH) + S('M15.5 17.5a3.5 3.5 0 113.5 3.5M19 15.5v2.3l1.4 1', 1.4),
    eraser: E(ERASER),
    bgEraser: E(ERASER) + S('M18.5 13.5v3M18.5 21.5v1M15 18h1.5M21 18h1.5', 1.4),
    magicEraser: E(ERASER) + P(STAR(19.2, 4.8, 3.4)),
    gradient: '<defs><linearGradient id="ppgradico" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="currentColor"/><stop offset="1" stop-color="currentColor" stop-opacity=".12"/></linearGradient></defs><rect x="2.5" y="5" width="19" height="14" fill="url(#ppgradico)"/>',
    bucket: E('M9.6 2.6l9.1 9.1-7.2 7.2a2.4 2.4 0 01-3.4 0l-5-5a2.4 2.4 0 010-3.4L8.4 5.2 6.6 3.4l1.2-1.2z M9.6 6.4l-5.4 5.4h11z') + P('M20.3 14.2s2.1 2.7 2.1 4.1a2.1 2.1 0 01-4.2 0c0-1.4 2.1-4.1 2.1-4.1z'),
    blurTool: P('M12 2.2S5.2 10 5.2 14.6a6.8 6.8 0 0013.6 0C18.8 10 12 2.2 12 2.2z'),
    sharpenTool: P('M12 2l6.8 19H5.2z'),
    smudge: R(30, P('M12.6 2.2a1.9 1.9 0 011.9 1.9v6.7l2.8.5c1.5.3 2.5 1.7 2.2 3.2l-.7 4.8a3.6 3.6 0 01-3.6 3.1h-4.1c-1.2 0-2.3-.5-3-1.5l-3.9-5.4a1.75 1.75 0 012.7-2.3l3.8 3.2V4.1a1.9 1.9 0 011.9-1.9z')),
    dodge: '<circle cx="14.6" cy="9.4" r="6.6"/>' + P('M10.1 13.1l1.5 1.4-7.3 7.3-1.5-1.4z'),
    burn: E('M4.2 14.6c-.6-4.6 1.7-9.6 6.3-11.6 2.9-1.2 6.4-.6 8.1 1.7 1.4 2 1.2 4.6-.4 6.3l2.5 2.3c1 .9.9 2.4-.2 3.2l-4.5 3.3c-3.8 2.7-9.1 1.2-11.2-2.9z M13.1 6.4a2.7 2.7 0 100 5.4 2.7 2.7 0 000-5.4z'),
    sponge: E('M7 3.2h10a3 3 0 013 3v11.6a3 3 0 01-3 3H7a3 3 0 01-3-3V6.2a3 3 0 013-3z M8.6 6.4a1.3 1.3 0 100 2.6 1.3 1.3 0 000-2.6z M14.6 7.4a1.6 1.6 0 100 3.2 1.6 1.6 0 000-3.2z M10.3 12.2a1.5 1.5 0 100 3 1.5 1.5 0 000-3z M15.4 15.4a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z M7.8 16.6a1 1 0 100 2 1 1 0 000-2z'),
    text: P('M3.6 2.8h16.8v5.4h-1.5c-.3-1.9-1.1-2.8-2.8-2.8h-2.4v13.4c0 1.3.4 1.6 2.1 1.8v1.8H8.2v-1.8c1.7-.2 2.1-.5 2.1-1.8V5.4H7.9c-1.7 0-2.5.9-2.8 2.8H3.6z'),
    textV: P('M2.6 2.8h12.6v4.2H14c-.2-1.5-.8-2.2-2.1-2.2h-1.6v10.6c0 1 .3 1.3 1.6 1.4v1.5H6v-1.5c1.3-.1 1.6-.4 1.6-1.4V4.8H6c-1.3 0-1.9.7-2.1 2.2H2.6z') + P('M17.2 5h2v11.4l2-2 1.3 1.3-4.3 4.3-4.3-4.3 1.3-1.3 2 2z'),
    textMaskH: D('M3.6 2.8h16.8v5h-2.4V5.2h-3.8v14.6h2.6v2.4H7.2v-2.4h2.6V5.2H6v2.6H3.6z', 1.3),
    textMaskV: D('M2.6 2.8h12.6v4h-2V4.8h-2.6v11.6h2v2H6v-2h2V4.8H5.4v2h-2.8z', 1.2) + P('M17.2 5h2v11.4l2-2 1.3 1.3-4.3 4.3-4.3-4.3 1.3-1.3 2 2z'),
    pen: nib(),
    freePen: nib(S('M14 21c2.4-1.2 3-3.6 5-3.6 1.4 0 1.9 1.3 3 1.3', 1.5)),
    curvPen: nib(S('M13.6 21.4c1.6-3.6 4-5.4 8.2-5', 1.4) + '<circle cx="13.6" cy="21.4" r="1.3"/><circle cx="21.8" cy="16.4" r="1.3"/>'),
    addAnchor: nib(P('M18.2 14.4h1.8v3h3v1.8h-3v3h-1.8v-3h-3v-1.8h3z')),
    delAnchor: nib(P('M15.2 17.4h7.8v1.8h-7.8z')),
    convertPt: P('M12 3.2l8.6 15.3h-3.1L12 8.6l-5.5 9.9H3.4z') + '<circle cx="12" cy="4.4" r="1.9"/>',
    pathSelect: P('M6.5 2.5v17l4.2-3.9 2.9 6.6 2.8-1.2-2.9-6.5h5.9z'),
    directSelect: S('M6.6 3v15.4l3.8-3.5 2.7 6 2.4-1-2.7-6h5.4z', 1.6),
    shapeRect: P('M2.8 5.4h18.4v13.2H2.8z'),
    shapeEllipse: '<ellipse cx="12" cy="12" rx="9.6" ry="7.2"/>',
    shapeLine: P('M2.6 19.9L19.9 2.6l1.5 1.5L4.1 21.4z'),
    shapePolygon: P('M12 2.4l8.3 4.8v9.6L12 21.6l-8.3-4.8V7.2z'),
    shapeStar: P(STAR5(12, 12.8, 10.4)),
    shapeCustom: P('M12 21.2l-1.4-1.3C5.4 15.3 2.2 12.4 2.2 8.6A5.1 5.1 0 017.4 3.4c1.8 0 3.5.8 4.6 2.1a6 6 0 014.6-2.1 5.1 5.1 0 015.2 5.2c0 3.8-3.2 6.7-8.4 11.3z'),
    hand: P(HAND),
    rotateView: '<g transform="translate(2.4 3.2) scale(.8)">' + P(HAND) + '</g>' + S('M3.6 8.6A9 9 0 0112.4 2.6', 1.5) + P('M13.6 0.8l.3 4-3.8-1z'),
    zoom: E(LENS),
    zoomIn: E(LENS) + P('M9.1 7.2h1.8v1.9h1.9v1.8h-1.9v1.9H9.1v-1.9H7.2V9.1h1.9z'),
    zoomOut: E(LENS) + P('M7.2 9.1h5.6v1.8H7.2z'),
    puppet: '<circle cx="12" cy="4.6" r="2.4"/>' + P('M9.4 8.2h5.2l3.6 4-1.4 1.3-2.5-2.5v4l2.6 6.6-1.9.7-2.6-6.2h-.8l-2.6 6.2-1.9-.7L10.4 15v-4l-2.5 2.5-1.4-1.3z'),
    tWarp: S('M3 6c3-2 6 2 9 0s6-2 9 0M3 12c3-2 6 2 9 0s6-2 9 0M3 18c3-2 6 2 9 0s6-2 9 0', 1.5),

    /* ---------- painel Camadas e cia. ---------- */
    eye: E('M12 5.4c-5 0-8.6 3.9-9.8 6.6 1.2 2.7 4.8 6.6 9.8 6.6s8.6-3.9 9.8-6.6C20.6 9.3 17 5.4 12 5.4z M12 7.2c-3.7 0-6.5 2.6-7.8 4.8 1.3 2.2 4.1 4.8 7.8 4.8s6.5-2.6 7.8-4.8C18.5 9.8 15.7 7.2 12 7.2z') + '<circle cx="12" cy="12" r="3.3"/>',
    eyeOff: S('M4 4l16 16', 1.6) + E('M12 5.4c-5 0-8.6 3.9-9.8 6.6 1.2 2.7 4.8 6.6 9.8 6.6s8.6-3.9 9.8-6.6C20.6 9.3 17 5.4 12 5.4z M12 7.2c-3.7 0-6.5 2.6-7.8 4.8 1.3 2.2 4.1 4.8 7.8 4.8s6.5-2.6 7.8-4.8C18.5 9.8 15.7 7.2 12 7.2z'),
    chain: E('M2.5 9.6A2.6 2.6 0 015.1 7h5.3a2.6 2.6 0 012.6 2.6v1.6h-2V9.6a.6.6 0 00-.6-.6H5.1a.6.6 0 00-.6.6v4.8c0 .3.3.6.6.6h3.3v2H5.1a2.6 2.6 0 01-2.6-2.6z') + E('M21.5 14.4a2.6 2.6 0 01-2.6 2.6h-5.3a2.6 2.6 0 01-2.6-2.6v-1.6h2v1.6c0 .3.3.6.6.6h5.3c.3 0 .6-.3.6-.6V9.6a.6.6 0 00-.6-.6h-3.3V7h3.3a2.6 2.6 0 012.6 2.6z'),
    link: E('M2.5 9.6A2.6 2.6 0 015.1 7h5.3a2.6 2.6 0 012.6 2.6v1.6h-2V9.6a.6.6 0 00-.6-.6H5.1a.6.6 0 00-.6.6v4.8c0 .3.3.6.6.6h3.3v2H5.1a2.6 2.6 0 01-2.6-2.6z') + E('M21.5 14.4a2.6 2.6 0 01-2.6 2.6h-5.3a2.6 2.6 0 01-2.6-2.6v-1.6h2v1.6c0 .3.3.6.6.6h5.3c.3 0 .6-.3.6-.6V9.6a.6.6 0 00-.6-.6h-3.3V7h3.3a2.6 2.6 0 012.6 2.6z'),
    fx: '<text x="1.2" y="16.6" font-size="13.5" font-family="Open Sans, sans-serif" fill="currentColor" letter-spacing="-.6">eff</text>' + corner,
    mask: E('M2 5h20v14H2z M12 7.9a4.1 4.1 0 100 8.2 4.1 4.1 0 000-8.2z'),
    quickMask: E('M2 5h20v14H2z M12 7.9a4.1 4.1 0 100 8.2 4.1 4.1 0 000-8.2z'),
    adjLayer: E('M12 2.6a9.4 9.4 0 110 18.8 9.4 9.4 0 010-18.8z M12 4.4v15.2a7.6 7.6 0 000-15.2z') + corner,
    folder: P('M2 5.6A1.6 1.6 0 013.6 4h5.2l2.1 2.6h9.5A1.6 1.6 0 0122 8.2v10.2a1.6 1.6 0 01-1.6 1.6H3.6A1.6 1.6 0 012 18.4z'),
    newLayer: E('M3 3h18v18H9.2L3 14.8z M4.8 4.8v9.2h5v5.2h9.4V4.8z M5.6 15.8l2.4 2.4v-2.4z'),
    trash: E('M4.5 4.2C4.5 3.4 7.9 2.6 12 2.6s7.5.8 7.5 1.6L17.8 20.2c-.2 1.1-2.7 1.8-5.8 1.8s-5.6-.7-5.8-1.8z M12 3.9c-3 0-5.4.5-5.4.9s2.4.9 5.4.9 5.4-.5 5.4-.9-2.4-.9-5.4-.9z'),
    lockAlpha: E('M3 3h18v18H3z M4.6 4.6v4.8h4.8V4.6z M14.6 4.6v4.8h4.8V4.6z M9.6 9.6v4.8h4.8V9.6z M4.6 14.6v4.8h4.8v-4.8z M14.6 14.6v4.8h4.8v-4.8z'),
    lockPaint: P(BRUSH),
    lockPos: P('M12 1.6l3.4 3.4h-2.3v5.9H19V8.6l3.4 3.4-3.4 3.4v-2.3h-5.9v5.9h2.3L12 22.4 8.6 19h2.3v-5.9H5v2.3L1.6 12 5 8.6v2.3h5.9V5H8.6z'),
    lock: E('M12 2.2a5 5 0 015 5V10h1.4c.9 0 1.6.7 1.6 1.6v8.8c0 .9-.7 1.6-1.6 1.6H5.6c-.9 0-1.6-.7-1.6-1.6v-8.8C4 10.7 4.7 10 5.6 10H7V7.2a5 5 0 015-5z M12 4.4a2.8 2.8 0 00-2.8 2.8V10h5.6V7.2A2.8 2.8 0 0012 4.4z'),
    clipArrow: P('M6 3h2v9.6h7.4l-2.6-2.6 1.4-1.4 5 5-5 5-1.4-1.4 2.6-2.6H6z'),
    vmask: E('M2 5h20v14H2z M12 7.9a4.1 4.1 0 100 8.2 4.1 4.1 0 000-8.2z'),

    /* ---------- barra de ferramentas / opções ---------- */
    swap: P('M4 4.5h1.8v9.7h11l-2.2-2.2 1.3-1.3 4.4 4.4-4.4 4.4-1.3-1.3 2.2-2.2H4z M5 2.8L8.3 6.1H1.7z'),
    selNew: P('M4 4h16v16H4z'),
    selAdd: E('M2.5 2.5h12v12h-12z') + E('M9.5 9.5h12v12h-12z'),
    selSub: E('M2.5 2.5h12v12h-12z M9.5 9.5v5h5v-5z') + S('M10.2 10.2h10.6v10.6H10.2z', 1.4),
    selInt: S('M2.9 2.9h11.2v11.2H2.9z M9.9 9.9h11.2v11.2H9.9z', 1.4) + P('M9.9 9.9h4.2v4.2H9.9z'),
    selXor: E('M2.5 2.5h12v12h-12z M9.5 9.5v5h5v-5z') + E('M9.5 9.5h12v12h-12z M9.5 9.5v5h5v-5z'),
    objLeft: P('M2.8 2h1.8v20H2.8z M6 4.4h9.6v6H6z') + E('M6 13.6h14v6H6z M7.6 15.2v2.8h10.8v-2.8z'),
    objCenterH: P('M11.1 2h1.8v20h-1.8z M7.2 4.4h9.6v6H7.2z') + E('M5 13.6h14v6H5z M6.6 15.2v2.8h10.8v-2.8z'),
    objRight: P('M19.4 2h1.8v20h-1.8z M8.4 4.4H18v6H8.4z') + E('M4 13.6h14v6H4z M5.6 15.2v2.8h10.8v-2.8z'),
    objTop: P('M2 2.8h20v1.8H2z M4.4 6h6v9.6h-6z') + E('M13.6 6h6v14h-6z M15.2 7.6v10.8H18V7.6z'),
    objCenterV: P('M2 11.1h20v1.8H2z M4.4 7.2h6v9.6h-6z') + E('M13.6 5h6v14h-6z M15.2 6.6v10.8H18V6.6z'),
    objBottom: P('M2 19.4h20v1.8H2z M4.4 8.4h6V18h-6z') + E('M13.6 4h6v14h-6z M15.2 5.6v10.8H18V5.6z'),
    distV: P('M5 2h14v1.8H5z M5 20.2h14V22H5z M11.1 3.8h1.8v2.4h-1.8z M11.1 17.8h1.8v2.4h-1.8z') + E('M7 7.6h10v8.8H7z M8.8 9.4v5.2h6.4V9.4z'),
    distH: P('M2 5h1.8v14H2z M20.2 5H22v14h-1.8z M3.8 11.1h2.4v1.8H3.8z M17.8 11.1h2.4v1.8h-2.4z') + E('M7.6 7h8.8v10H7.6z M9.4 8.8v6.4h5.2V8.8z'),
    more: '<circle cx="5.5" cy="15" r="1.4"/><circle cx="10" cy="15" r="1.4"/><circle cx="14.5" cy="15" r="1.4"/>',
    ppDownload: P('M10.8 2.8h2.4v9.6l3.4-3.4 1.7 1.7L12 17l-6.3-6.3L7.4 9l3.4 3.4z M3.6 19h16.8v2.4H3.6z'),
    gradLinear: '<defs><linearGradient id="ppgl" x1="0" x2="1"><stop offset="0" stop-color="currentColor"/><stop offset="1" stop-color="currentColor" stop-opacity=".1"/></linearGradient></defs><rect x="3" y="3" width="18" height="18" fill="url(#ppgl)"/>',
    gradRadial: '<defs><radialGradient id="ppgr"><stop offset="0" stop-color="currentColor"/><stop offset="1" stop-color="currentColor" stop-opacity=".1"/></radialGradient></defs><rect x="3" y="3" width="18" height="18" fill="url(#ppgr)"/>',
    transform: D('M4.5 4.5h15v15h-15z', 1.3) + P('M2.5 2.5h4v4h-4z M17.5 2.5h4v4h-4z M2.5 17.5h4v4h-4z M17.5 17.5h4v4h-4z'),

    /* ---------- painéis (coluna estreita) ---------- */
    ppInfo: E('M12 2.2a9.8 9.8 0 110 19.6 9.8 9.8 0 010-19.6z M12 4a8 8 0 100 16 8 8 0 000-16z') + P('M10.9 10h2.2v7.2h-2.2z') + '<circle cx="12" cy="7.3" r="1.35"/>',
    info2: E('M12 2.2a9.8 9.8 0 110 19.6 9.8 9.8 0 010-19.6z M12 4a8 8 0 100 16 8 8 0 000-16z') + P('M10.9 10h2.2v7.2h-2.2z') + '<circle cx="12" cy="7.3" r="1.35"/>',
    ppProps: P('M2.5 5.2h6.2v1.6H2.5z M11.6 5.2h9.9v1.6h-9.9z M8.6 3.4h1.9v5.2H8.6z M2.5 11.2h11.9v1.6H2.5z M17.3 11.2h4.2v1.6h-4.2z M14.4 9.4h1.9v5.2h-1.9z M2.5 17.2h3.3v1.6H2.5z M8.7 17.2h12.8v1.6H8.7z M5.8 15.4h1.9v5.2H5.8z'),
    properties: P('M2.5 5.2h6.2v1.6H2.5z M11.6 5.2h9.9v1.6h-9.9z M8.6 3.4h1.9v5.2H8.6z M2.5 11.2h11.9v1.6H2.5z M17.3 11.2h4.2v1.6h-4.2z M14.4 9.4h1.9v5.2h-1.9z M2.5 17.2h3.3v1.6H2.5z M8.7 17.2h12.8v1.6H8.7z M5.8 15.4h1.9v5.2H5.8z'),
    ppBrushPanel: '<g transform="translate(4 3.4) scale(.84)">' + P(BRUSH) + '</g>' + P('M2.5 3h7v1.4h-7z M2.5 5.8h7v1.4h-7z M2.5 8.6h7V10h-7z'),
    brushPanel: '<g transform="translate(4 3.4) scale(.84)">' + P(BRUSH) + '</g>' + P('M2.5 3h7v1.4h-7z M2.5 5.8h7v1.4h-7z M2.5 8.6h7V10h-7z'),
    ppChar: '<text x="1" y="20" font-size="19" font-family="Georgia, \'Times New Roman\', serif" fill="currentColor">T</text><text x="11.5" y="20" font-size="14" font-family="Georgia, \'Times New Roman\', serif" fill="currentColor">t</text>',
    character: '<text x="1" y="20" font-size="19" font-family="Georgia, \'Times New Roman\', serif" fill="currentColor">T</text><text x="11.5" y="20" font-size="14" font-family="Georgia, \'Times New Roman\', serif" fill="currentColor">t</text>',
    ppPara: P('M10.2 3h9.3v2.2h-1.8V21h-2.2V5.2h-1.9V21h-2.2v-8.7h-1.2a4.65 4.65 0 010-9.3z'),
    paragraph: P('M10.2 3h9.3v2.2h-1.8V21h-2.2V5.2h-1.9V21h-2.2v-8.7h-1.2a4.65 4.65 0 010-9.3z'),
    ppCss: '<text x="12" y="16.2" text-anchor="middle" font-size="10" font-weight="700" font-family="Open Sans, sans-serif" fill="currentColor" letter-spacing=".4">CSS</text>',
    css: '<text x="12" y="16.2" text-anchor="middle" font-size="10" font-weight="700" font-family="Open Sans, sans-serif" fill="currentColor" letter-spacing=".4">CSS</text>',
    ppNav: E('M2.5 4h19v16h-19z M4.3 5.8v12.4h15.4V5.8z') + P('M5.6 17l4.3-5.6 3 3.8 2.1-2.6 3.4 4.4z') + '<circle cx="15.8" cy="9" r="1.7"/>',
    navigator: E('M2.5 4h19v16h-19z M4.3 5.8v12.4h15.4V5.8z') + P('M5.6 17l4.3-5.6 3 3.8 2.1-2.6 3.4 4.4z') + '<circle cx="15.8" cy="9" r="1.7"/>',
    ppHistory: E('M12 2.4a9.6 9.6 0 110 19.2 9.6 9.6 0 010-19.2z M12 4.4a7.6 7.6 0 100 15.2 7.6 7.6 0 000-15.2z') + P('M11 6.6h2v5l3.3 2-1 1.7-4.3-2.6z'),
    history: E('M12 2.4a9.6 9.6 0 110 19.2 9.6 9.6 0 010-19.2z M12 4.4a7.6 7.6 0 100 15.2 7.6 7.6 0 000-15.2z') + P('M11 6.6h2v5l3.3 2-1 1.7-4.3-2.6z'),
    ppSwatches: P('M3 3h5v5H3z M9.5 3h5v5h-5z M16 3h5v5h-5z M3 9.5h5v5H3z M9.5 9.5h5v5h-5z M16 9.5h5v5h-5z M3 16h5v5H3z M9.5 16h5v5h-5z M16 16h5v5h-5z'),
    swatches: P('M3 3h5v5H3z M9.5 3h5v5h-5z M16 3h5v5h-5z M3 9.5h5v5H3z M9.5 9.5h5v5h-5z M16 9.5h5v5h-5z M3 16h5v5H3z M9.5 16h5v5h-5z M16 16h5v5h-5z'),
    ppLayers: P('M12 2.6l10 5.2-10 5.2L2 7.8z M4.3 11.3l7.7 4 7.7-4 2.3 1.2-10 5.2-10-5.2z M4.3 15.5l7.7 4 7.7-4 2.3 1.2-10 5.2-10-5.2z'),
    layers: P('M12 2.6l10 5.2-10 5.2L2 7.8z M4.3 11.3l7.7 4 7.7-4 2.3 1.2-10 5.2-10-5.2z M4.3 15.5l7.7 4 7.7-4 2.3 1.2-10 5.2-10-5.2z'),
    ppChannels: E('M8.2 3a5.2 5.2 0 110 10.4A5.2 5.2 0 018.2 3z M15.8 3a5.2 5.2 0 110 10.4 5.2 5.2 0 010-10.4z M12 10.2a5.2 5.2 0 110 10.4 5.2 5.2 0 010-10.4z'),
    channels: E('M8.2 3a5.2 5.2 0 110 10.4A5.2 5.2 0 018.2 3z M15.8 3a5.2 5.2 0 110 10.4 5.2 5.2 0 010-10.4z M12 10.2a5.2 5.2 0 110 10.4 5.2 5.2 0 010-10.4z'),
    ppPaths: S('M3.5 19.5C6 9 12 15 13.5 9.5 14.4 6.3 17 4.5 20.5 4.5', 1.7) + P('M2 18h3v3H2z M19 3h3v3h-3z'),
    paths: S('M3.5 19.5C6 9 12 15 13.5 9.5 14.4 6.3 17 4.5 20.5 4.5', 1.7) + P('M2 18h3v3H2z M19 3h3v3h-3z'),
    ppActions: E('M12 2.4a9.6 9.6 0 110 19.2 9.6 9.6 0 010-19.2z M12 4.4a7.6 7.6 0 100 15.2 7.6 7.6 0 000-15.2z') + P('M10 7.6l6.6 4.4-6.6 4.4z'),
    actions: E('M12 2.4a9.6 9.6 0 110 19.2 9.6 9.6 0 010-19.2z M12 4.4a7.6 7.6 0 100 15.2 7.6 7.6 0 000-15.2z') + P('M10 7.6l6.6 4.4-6.6 4.4z'),
    ppAdjust: E('M12 2.6a9.4 9.4 0 110 18.8 9.4 9.4 0 010-18.8z M12 4.4v15.2a7.6 7.6 0 000-15.2z'),
    adjPanel: E('M12 2.6a9.4 9.4 0 110 18.8 9.4 9.4 0 010-18.8z M12 4.4v15.2a7.6 7.6 0 000-15.2z'),
    ppGlyphs: '<text x="12" y="18.5" text-anchor="middle" font-size="17" font-family="Georgia, serif" fill="currentColor">ɑ</text>',
    glyphs: '<text x="12" y="18.5" text-anchor="middle" font-size="17" font-family="Georgia, serif" fill="currentColor">ɑ</text>',
    ppHisto: P('M2.5 20h19v1.6h-19z M3.5 15h2.4v4.4H3.5z M6.6 10h2.4v9.4H6.6z M9.7 5h2.4v14.4H9.7z M12.8 8h2.4v11.4h-2.4z M15.9 12h2.4v7.4h-2.4z M19 16h2.4v3.4H19z'),
    histogram: P('M2.5 20h19v1.6h-19z M3.5 15h2.4v4.4H3.5z M6.6 10h2.4v9.4H6.6z M9.7 5h2.4v14.4H9.7z M12.8 8h2.4v11.4h-2.4z M15.9 12h2.4v7.4h-2.4z M19 16h2.4v3.4H19z'),
    ppComps: E('M3 3h13v13H3z M4.8 4.8v9.4h9.4V4.8z') + P('M8 7.8V20.8H21V7.8h-2v11H10V7.8z'),
    layerComps: E('M3 3h13v13H3z M4.8 4.8v9.4h9.4V4.8z') + P('M8 7.8V20.8H21V7.8h-2v11H10V7.8z'),
    ppStyles: '<text x="2" y="16.6" font-size="13" font-style="italic" font-family="Georgia, serif" fill="currentColor">fx</text>' + P('M15 4h6v6h-6z M15 14h6v6h-6z'),
    styles: '<text x="2" y="16.6" font-size="13" font-style="italic" font-family="Georgia, serif" fill="currentColor">fx</text>' + P('M15 4h6v6h-6z M15 14h6v6h-6z'),
    ppToolPresets: '<g transform="translate(-1 -1) scale(.75)">' + P(BRUSH) + '</g>' + P('M12 13h10v1.8H12z M12 16.6h10v1.8H12z M12 20.2h10V22H12z'),
    toolPresets: '<g transform="translate(-1 -1) scale(.75)">' + P(BRUSH) + '</g>' + P('M12 13h10v1.8H12z M12 16.6h10v1.8H12z M12 20.2h10V22H12z'),
    ppColor: E('M12 2.4c5.5 0 9.6 3.8 9.6 8.4 0 3-2.4 4.6-4.8 4.6h-1.7c-.9 0-1.4.6-1.4 1.2 0 .6.4.9.7 1.4.4.5.6 1 .6 1.6 0 1.5-1.3 2.4-3 2.4-5.3 0-9.6-4.3-9.6-9.6S6.7 2.4 12 2.4z M7.2 8.6a1.6 1.6 0 100 3.2 1.6 1.6 0 000-3.2z M10.4 5a1.6 1.6 0 100 3.2 1.6 1.6 0 000-3.2z M15 5.4a1.6 1.6 0 100 3.2 1.6 1.6 0 000-3.2z M17.6 9a1.6 1.6 0 100 3.2 1.6 1.6 0 000-3.2z'),
    ppLibrary: P('M3 3h4v18H3z M8.4 3h4v18h-4z M14 4.2l3.8-1 4.6 17-3.8 1z'),
    library: P('M3 3h4v18H3z M8.4 3h4v18h-4z M14 4.2l3.8-1 4.6 17-3.8 1z'),

    /* ---------- barra superior, tela inicial, diversos ---------- */
    ppSearch: E(LENS),
    search: E(LENS),
    ppFullscreen: P('M2.5 2.5h6.5v2.2H4.7V9H2.5z M15 2.5h6.5V9h-2.2V4.7H15z M2.5 15h2.2v4.3H9v2.2H2.5z M19.3 15h2.2v6.5H15v-2.2h4.3z'),
    ppKeyboard: E('M1.8 5.5h20.4v13H1.8z M4 8v2h2V8z M7.2 8v2h2V8z M10.4 8v2h2V8z M13.6 8v2h2V8z M16.8 8v2H19V8z M5.6 11.2v2h2v-2z M8.8 11.2v2h2v-2z M12 11.2v2h2v-2z M15.2 11.2v2h2v-2z M7 14.6v1.8h10v-1.8z'),
    ppHome: P('M12 2.8l9.6 8.4-1.3 1.5-1.5-1.3V21h-5.6v-6h-2.4v6H5.2v-9.6l-1.5 1.3-1.3-1.5z'),
    ppDevice: E('M2.4 3.6h19.2v13H2.4z M4.2 5.4v9.4h15.6V5.4z') + P('M8.4 18.4h7.2V20H8.4z'),
    ppRecent: E('M12 2.4a9.6 9.6 0 110 19.2 9.6 9.6 0 010-19.2z M12 4.4a7.6 7.6 0 100 15.2 7.6 7.6 0 000-15.2z') + P('M11 6.6h2v5l3.3 2-1 1.7-4.3-2.6z'),
    ppNewDoc: S('M4.5 3h15v18H10.5L4.5 15z M4.5 15h6v6', 1.6),
    ppImage: E('M2.5 4h19v16h-19z M4.3 5.8v12.4h15.4V5.8z') + P('M5.6 17l4.3-5.6 3 3.8 2.1-2.6 3.4 4.4z') + '<circle cx="15.8" cy="9" r="1.7"/>',
    trashSmall: E('M4.5 4.2C4.5 3.4 7.9 2.6 12 2.6s7.5.8 7.5 1.6L17.8 20.2c-.2 1.1-2.7 1.8-5.8 1.8s-5.6-.7-5.8-1.8z M12 3.9c-3 0-5.4.5-5.4.9s2.4.9 5.4.9 5.4-.5 5.4-.9-2.4-.9-5.4-.9z')
  };
})();
