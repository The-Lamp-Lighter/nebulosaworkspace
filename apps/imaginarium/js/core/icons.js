/* ==========================================================================
   Imaginarium — ícones próprios (SVG em linha, traço 1.5, grade 20×20)
   Todos os desenhos foram criados para este projeto.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG;

  const F = 'fill="currentColor" stroke="none"';
  const icons = {
    /* ferramentas */
    move: '<path d="M10 2v16M2 10h16M7.5 4.5L10 2l2.5 2.5M7.5 15.5L10 18l2.5-2.5M4.5 7.5L2 10l2.5 2.5M15.5 7.5L18 10l-2.5 2.5"/>',
    marqueeRect: '<rect x="3" y="4" width="14" height="12" rx=".5" stroke-dasharray="2.6 2"/>',
    marqueeEllipse: '<ellipse cx="10" cy="10" rx="7.2" ry="6.2" stroke-dasharray="2.6 2"/>',
    lasso: '<path d="M10 3.5c-4 0-7 2-7 4.6 0 2.5 3 4.5 7 4.5s7-2 7-4.5c0-2.600-3-4.600-7-4.600z"/><path d="M6.200 12c-1.300.7-1.500 2.300-.2 2.900 1.300.6 2.200-.9 1.200-1.700M6.500 15c.2 1.400-.4 2.500-1.800 3"/>',
    wand: '<path d="M3 17l9-9M10.800 6.800l2.400 2.400"/><path d="M14.500 2v3M13 3.500h3M17 7.500v2.400M15.800 8.700h2.400M8.500 2.800v2.400M7.300 4h2.400"/>',
    crop: '<path d="M5.500 2v12.500H18M2 5.500h12.500V18"/>',
    eyedropper: '<path d="M11 6l3 3-7.200 7.200L4 17l.8-2.800L11 6z"/><path d="M12.800 4.200a2.100 2.100 0 013 3L14 9l-3-3 1.800-1.800z" ' + F + '/>',
    brush: '<path d="M17.200 2.800c-3 .8-7.200 4.700-9.400 8.200l2.200 2.200c3.500-2.200 7.400-6.400 8.200-9.400.1-.7-.3-1.100-1-1z"/><path d="M7.200 11.800c-2.200-.2-3.400 1.100-3.600 2.900-.1 1-.6 1.700-1.600 2.100 2 1.200 5.900.9 6.700-1.800.3-1 .1-2.200-1.500-3.200z"/>',
    eraser: '<path d="M8.200 16.500L3.600 11.900a1.200 1.200 0 010-1.700l6.900-6.900a1.200 1.200 0 011.700 0l4.600 4.600a1.200 1.200 0 010 1.700l-6.900 6.900H8.200z"/><path d="M6.800 7L13 13.200M10 16.500h7.500"/>',
    stamp: '<path d="M10 2.800a2.400 2.400 0 00-1.500 4.300c.3.300.5.7.5 1.200v1.900H5.200c-.9 0-1.700.8-1.700 1.700V14h13v-2.100c0-.9-.8-1.700-1.700-1.700H11V8.300c0-.5.2-.9.5-1.200A2.400 2.400 0 0010 2.800z"/><path d="M3.500 17h13"/>',
    gradient: '<rect x="2.800" y="4" width="14.400" height="12" rx="1.200"/><path d="M2.800 4h5v12h-5z" ' + F + ' opacity=".75"/><path d="M7.800 4h4.200v12H7.800z" ' + F + ' opacity=".38"/><path d="M12 4h3v12h-3z" ' + F + ' opacity=".14"/>',
    bucket: '<path d="M8.600 2.800l6.900 6.900-5.300 5.300a1.600 1.600 0 01-2.200 0L3.800 10.800a1.600 1.600 0 010-2.200l4.800-4.800z"/><path d="M3.800 9.700h11.700"/><path d="M17 12.600s1.500 1.900 1.500 2.900a1.500 1.500 0 01-3 0c0-1 1.500-2.900 1.500-2.900z" ' + F + '/>',
    text: '<path d="M4 5.500V3.500h12v2M10 3.500v13M7.500 16.500h5"/>',
    pen: '<path d="M10 2.500l4.800 8.300-1.800 5.200H7l-1.800-5.200L10 2.500z"/><path d="M10 2.500v7.200"/><circle cx="10" cy="11" r="1.300"/><path d="M6.500 18h7"/>',
    shapeRect: '<rect x="3" y="4.500" width="14" height="11" rx="1.200"/>',
    shapeEllipse: '<ellipse cx="10" cy="10" rx="7.300" ry="6"/>',
    shapeLine: '<path d="M4.500 15.500l11-11"/><circle cx="3.700" cy="16.300" r="1.300" ' + F + '/><circle cx="16.300" cy="3.700" r="1.300" ' + F + '/>',
    shapePolygon: '<path d="M10 2.500l6.500 3.750v7.500L10 17.500l-6.500-3.750v-7.500L10 2.500z"/>',
    shapeStar: '<path d="M10 2.500l2.300 4.800 5.200.7-3.800 3.600.9 5.200L10 14.300l-4.600 2.500.9-5.200L2.500 8l5.200-.7L10 2.500z"/>',
    zoom: '<circle cx="8.500" cy="8.500" r="5.500"/><path d="M12.600 12.600l4.900 4.900"/>',
    zoomIn: '<circle cx="8.500" cy="8.500" r="5.500"/><path d="M12.600 12.600l4.900 4.900M6 8.500h5M8.500 6v5"/>',
    zoomOut: '<circle cx="8.500" cy="8.500" r="5.500"/><path d="M12.600 12.600l4.900 4.900M6 8.500h5"/>',
    hand: '<path d="M6.600 10.500V5.200a1.200 1.200 0 012.400 0V9M9 9V3.700a1.200 1.200 0 012.400 0V9M11.400 9V4.700a1.200 1.200 0 012.400 0V10M13.800 10V7.200a1.200 1.200 0 012.400 0v5.300c0 3.100-2.200 5.500-5.300 5.500-2.300 0-3.700-1-4.800-2.900l-2.200-3.700a1.200 1.200 0 012-1.300l.7 1"/>',
    transform: '<rect x="4.500" y="4.500" width="11" height="11" stroke-dasharray="2 1.600"/><rect x="2.500" y="2.500" width="4" height="4" fill="var(--bg-2,#27292d)"/><rect x="13.500" y="2.500" width="4" height="4" fill="var(--bg-2,#27292d)"/><rect x="2.500" y="13.500" width="4" height="4" fill="var(--bg-2,#27292d)"/><rect x="13.500" y="13.500" width="4" height="4" fill="var(--bg-2,#27292d)"/>',

    /* interface */
    eye: '<path d="M1.800 10S4.800 4.500 10 4.500 18.200 10 18.200 10 15.200 15.500 10 15.500 1.800 10 1.800 10z"/><circle cx="10" cy="10" r="2.400"/>',
    eyeOff: '<path d="M3 3l14 14M8 5c.6-.3 1.300-.5 2-.5 5.200 0 8.200 5.500 8.200 5.500s-.9 1.600-2.500 3.100M12.800 14.900c-.9.4-1.800.6-2.800.6C4.800 15.500 1.800 10 1.800 10S3 7.800 5.200 6.200"/>',
    lock: '<rect x="4.500" y="9" width="11" height="8" rx="1.500"/><path d="M7 9V6.500a3 3 0 016 0V9"/>',
    lockAlpha: '<rect x="3.500" y="3.500" width="13" height="13" rx="1"/><path d="M3.500 3.500H10V10H3.500zM10 10h6.500v6.500H10z" ' + F + ' opacity=".55"/>',
    lockPos: '<path d="M10 2.500v15M2.500 10h15M8 4.500l2-2 2 2M8 15.500l2 2 2-2M4.500 8l-2 2 2 2M15.500 8l2 2-2 2"/><circle cx="10" cy="10" r="2.300" fill="var(--bg-2,#27292d)"/>',
    folder: '<path d="M2.500 6a1.500 1.500 0 011.500-1.500h3.600l1.800 2H16A1.500 1.500 0 0117.500 8v6.500A1.500 1.500 0 0116 16H4a1.500 1.500 0 01-1.500-1.500V6z"/>',
    trash: '<path d="M3.500 5.500h13M8 5.500V3.800h4v1.700M5.200 5.500l.7 10.300c0 .7.600 1.200 1.300 1.200h5.600c.7 0 1.300-.5 1.300-1.200l.7-10.300M8.300 8.500v5.500M11.700 8.500v5.500"/>',
    plus: '<path d="M10 4v12M4 10h12"/>',
    minus: '<path d="M4 10h12"/>',
    newLayer: '<path d="M4 3.500h8.500l3.500 3.500v9.500H4v-13z"/><path d="M12.500 3.500V7H16M10 9.500v5M7.500 12h5"/>',
    mask: '<rect x="2.800" y="4" width="14.400" height="12" rx="1.200"/><circle cx="10" cy="10" r="3.400" ' + F + ' opacity=".7"/>',
    duplicate: '<rect x="6.500" y="6.500" width="10.500" height="10.500" rx="1.500"/><path d="M13.500 6.500V4.500A1.500 1.500 0 0012 3H4.500A1.500 1.500 0 003 4.500V12a1.500 1.500 0 001.500 1.500h2"/>',
    chevronRight: '<path d="M7.500 5l5 5-5 5"/>',
    chevronDown: '<path d="M5 7.500l5 5 5-5"/>',
    chevronUp: '<path d="M5 12.500l5-5 5 5"/>',
    check: '<path d="M4 10.500l4 4 8-9"/>',
    close: '<path d="M5 5l10 10M15 5L5 15"/>',
    undo: '<path d="M7 4.500L3.500 8 7 11.500"/><path d="M3.500 8H12a4.500 4.500 0 010 9H8.500"/>',
    redo: '<path d="M13 4.500L16.500 8 13 11.500"/><path d="M16.500 8H8a4.500 4.500 0 000 9h3.500"/>',
    swap: '<path d="M5 3.500L2.500 6 5 8.500M2.500 6H12a4 4 0 014 4v0M15 16.500l2.500-2.500L15 11.500"/><path d="M17.500 14H8a4 4 0 01-4-4"/>',
    link: '<path d="M8.500 11.500a3.200 3.200 0 004.500 0l3-3a3.200 3.200 0 00-4.500-4.500l-1 1M11.500 8.500a3.200 3.200 0 00-4.500 0l-3 3a3.200 3.200 0 004.500 4.500l1-1"/>',
    search: '<circle cx="8.500" cy="8.500" r="5.500"/><path d="M12.600 12.600l4.900 4.900"/>',
    image: '<rect x="2.500" y="3.500" width="15" height="13" rx="1.500"/><circle cx="7" cy="8" r="1.500"/><path d="M2.500 14l4.500-4 3.500 3 2.500-2 4.500 4"/>',
    layers: '<path d="M10 2.500l7.500 4-7.500 4-7.500-4 7.500-4zM2.500 10l7.500 4 7.500-4M2.500 13.500l7.500 4 7.500-4"/>',
    history: '<path d="M3 10a7 7 0 107-7 7 7 0 00-5.500 2.700"/><path d="M3.500 2.500v3.500H7M10 6v4.300l2.800 1.700"/>',
    sliders: '<path d="M3 5.500h8M14.500 5.500H17M3 10h2.500M9 10h8M3 14.500h8.500M15 14.500h2"/><circle cx="12.800" cy="5.500" r="1.700"/><circle cx="7.200" cy="10" r="1.700"/><circle cx="13.300" cy="14.500" r="1.700"/>',
    palette: '<path d="M10 2.500a7.500 7.500 0 000 15c1.200 0 1.800-.8 1.800-1.700 0-.5-.2-.9-.5-1.300-.300-.4-.5-.8-.5-1.200 0-1 .8-1.800 1.800-1.800h2.100c1.800 0 3.300-1.500 3.300-3.300 0-3.200-3.600-5.700-8-5.700z"/><circle cx="6.300" cy="9.700" r="1" ' + F + '/><circle cx="8.300" cy="6.200" r="1" ' + F + '/><circle cx="12.300" cy="5.900" r="1" ' + F + '/>',
    swatches: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1" ' + F + ' opacity=".6"/><rect x="3" y="11" width="6" height="6" rx="1" ' + F + ' opacity=".6"/><rect x="11" y="11" width="6" height="6" rx="1"/>',
    grid: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M3 7.700h14M3 12.300h14M7.700 3v14M12.300 3v14"/>',
    navigator: '<circle cx="10" cy="10" r="7.500"/><path d="M12.800 7.200l-1.500 4.100-4.100 1.500 1.500-4.100 4.100-1.500z"/>',
    library: '<path d="M3.500 3.500v13M6.500 3.500v13M9.500 3.500l5.500.8-1.800 12.200-5.200-.8"/>',
    character: '<path d="M4.500 16l4.300-12h2.400l4.300 12M6.200 11.800h7.600"/>',
    paragraph: '<path d="M3 5h14M3 8.500h9M3 12h14M3 15.500h9"/>',
    properties: '<path d="M3 5h6M13 5h4M3 10h2M9 10h8M3 15h8M15 15h2"/><path d="M9 3.500v3M5 8.500v3M11 13.500v3"/>',
    alignLeft: '<path d="M3 5h14M3 8.500h9M3 12h14M3 15.500h7"/>',
    alignCenter: '<path d="M3 5h14M5.500 8.500h9M3 12h14M6.500 15.500h7"/>',
    alignRight: '<path d="M3 5h14M8 8.500h9M3 12h14M10 15.500h7"/>',
    objLeft: '<path d="M3 2.500v15"/><rect x="5.500" y="4.500" width="10" height="4" rx=".8"/><rect x="5.500" y="11.500" width="6.500" height="4" rx=".8"/>',
    objCenterH: '<path d="M10 2.500v15"/><rect x="4.500" y="4.500" width="11" height="4" rx=".8" fill="var(--bg-2,#27292d)"/><rect x="6.500" y="11.500" width="7" height="4" rx=".8" fill="var(--bg-2,#27292d)"/>',
    objRight: '<path d="M17 2.500v15"/><rect x="4.500" y="4.500" width="10" height="4" rx=".8"/><rect x="8" y="11.500" width="6.500" height="4" rx=".8"/>',
    objTop: '<path d="M2.500 3h15"/><rect x="4.500" y="5.500" width="4" height="10" rx=".8"/><rect x="11.500" y="5.500" width="4" height="6.500" rx=".8"/>',
    objCenterV: '<path d="M2.500 10h15"/><rect x="4.500" y="4.500" width="4" height="11" rx=".8" fill="var(--bg-2,#27292d)"/><rect x="11.500" y="6.500" width="4" height="7" rx=".8" fill="var(--bg-2,#27292d)"/>',
    objBottom: '<path d="M2.500 17h15"/><rect x="4.500" y="4.500" width="4" height="10" rx=".8"/><rect x="11.500" y="8" width="4" height="6.500" rx=".8"/>',
    selNew: '<rect x="4" y="4" width="12" height="12" rx=".5"/>',
    selAdd: '<path d="M3 3h8v4h6v10H7v-4H3V3z"/>',
    selSub: '<path d="M3 3h10v6H9v4H3V3z"/><rect x="10.500" y="10.500" width="6.500" height="6.500" stroke-dasharray="1.800 1.600"/>',
    selXor: '<path d="M3 3h10v10H3zM7 7h10v10H7z"/><path d="M7 7h6v6H7z" fill="currentColor" stroke="none" opacity=".0"/><path d="M3 3h10v4H7v6H3zM13 7h4v10H7v-4h6z" fill="currentColor" stroke="none" opacity=".55"/>',
    selInt: '<rect x="3" y="3" width="9.500" height="9.500" stroke-dasharray="1.800 1.600"/><rect x="7.500" y="7.500" width="9.500" height="9.500" stroke-dasharray="1.800 1.600"/><rect x="7.500" y="7.500" width="5" height="5" ' + F + ' opacity=".7"/>',
    fit: '<path d="M3 7.500V3h4.500M12.500 3H17v4.500M17 12.500V17h-4.500M7.500 17H3v-4.500"/>',
    info: '<circle cx="10" cy="10" r="7.500"/><path d="M10 9v5"/><circle cx="10" cy="6.300" r=".9" ' + F + '/>',
    file: '<path d="M4.500 2.500h7l4 4v11h-11v-15z"/><path d="M11.500 2.500v4h4"/>',
    open: '<path d="M2.500 15.500V5A1.500 1.500 0 014 3.500h3.500l1.800 2h6.200A1.500 1.500 0 0117 7v1.500"/><path d="M2.500 15.500l2-6.200c.2-.5.6-.8 1.100-.8h11.100c.8 0 1.300.7 1.100 1.500l-1.500 5c-.2.600-.7 1-1.300 1H3.500c-.6 0-1-.3-1-.5z"/>',
    save: '<path d="M3.500 3.500h10.500l2.500 2.500v10.500h-13v-13z"/><path d="M6.500 3.500v4h6v-4M6.500 16.500v-5h7v5"/>',
    reset: '<path d="M4 10a6 6 0 106-6H5.500"/><path d="M8 1.500L5.500 4 8 6.500"/>',
    more: '<circle cx="4.500" cy="10" r="1.300" ' + F + '/><circle cx="10" cy="10" r="1.300" ' + F + '/><circle cx="15.500" cy="10" r="1.300" ' + F + '/>',
    rasterize: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M3 3h4.700v4.700H3zM12.300 3H17v4.700h-4.700zM7.700 7.700h4.600v4.600H7.700zM3 12.300h4.700V17H3zM12.300 12.300H17V17h-4.700z" ' + F + ' opacity=".5"/>',
    help: '<circle cx="10" cy="10" r="7.500"/><path d="M7.700 7.800a2.400 2.400 0 114 1.800c-.9.7-1.700 1.200-1.700 2.400"/><circle cx="10" cy="14.300" r=".9" ' + F + '/>',
    dock: '<rect x="2.500" y="3.500" width="15" height="13" rx="1.500"/><path d="M12.500 3.500v13"/>',
    fx: '<path d="M7.500 4.500C6 4.500 5.500 5.500 5.300 7l-1.300 9" /><path d="M3.500 9h4.500M10 9l5 6M15 9l-5 6"/>',
    adjLayer: '<circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 000 14z" ' + F + '/>',
    clipArrow: '<path d="M6 3v7.500a2 2 0 002 2h7M12.500 10l2.500 2.500-2.500 2.500"/>',
    lockPaint: '<path d="M14.500 3.500c-2 .5-4.800 3.100-6.300 5.500l1.500 1.500c2.400-1.500 5-4.300 5.500-6.300.1-.5-.2-.8-.7-.7z"/><path d="M7.300 10.200c-1.500-.1-2.300.8-2.400 2-.1.7-.4 1.100-1.100 1.400 1.300.8 3.900.6 4.500-1.200.2-.7.1-1.500-1-2.200z"/>',
    chain: '<path d="M8 12l4-4"/><path d="M9.200 6.200l1.300-1.300a2.800 2.800 0 014 4l-1.300 1.300M10.800 13.800l-1.300 1.300a2.800 2.800 0 01-4-4l1.300-1.300"/>',
    vmask: '<rect x="2.800" y="4" width="14.400" height="12" rx="1.200"/><path d="M6 13l4-6 4 6z"/>',
    smart: '<rect x="3" y="3" width="14" height="14" rx="1.500"/><path d="M11 14h4v-4"/><path d="M15 14l-4-4"/>',
    brushSettings: '<path d="M16.500 3.500c-2.500.6-6 4-7.800 6.800l1.800 1.800c2.900-1.800 6.300-5.300 6.800-7.800.1-.6-.3-.9-.8-.8z"/><path d="M6.800 11c-1.900-.1-2.900 1-3.100 2.500-.1.900-.5 1.500-1.400 1.800 1.700 1 5 .8 5.800-1.500.3-.9.1-1.900-1.300-2.800z"/>',
    channels: '<circle cx="7.500" cy="8" r="4.300"/><circle cx="12.500" cy="8" r="4.300"/><circle cx="10" cy="12.300" r="4.300"/>',
    paths: '<path d="M3 16c3-9 11-3 14-12"/><rect x="1.800" y="14.800" width="2.600" height="2.600" ' + F + '/><rect x="15.600" y="2.600" width="2.600" height="2.600" ' + F + '/>',
    actions: '<path d="M6 4.500l9 5.500-9 5.500z"/>',
    histogram: '<path d="M3 16.500h14M4.500 16.500V12M7.500 16.500V7M10.500 16.500V9.500M13.500 16.500V5M16 16.500v-3"/>',
    info2: '<circle cx="10" cy="10" r="7.500"/><path d="M10 9v5"/><circle cx="10" cy="6.300" r=".9" ' + F + '/>',
    styles: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="3"/><rect x="3" y="11" width="6" height="6" rx="1" ' + F + ' opacity=".5"/><path d="M14 11l3 6h-6z"/>',
    glyphs: '<path d="M5 15l4-10 4 10M6.500 11.500h5"/><path d="M14.500 7.500a2 2 0 102 2.500"/>',
    notes: '<path d="M4 3.500h12v9.500l-4 4H4z"/><path d="M12 17v-4h4"/>',
    layerComps: '<rect x="3.500" y="3.500" width="9" height="9" rx="1"/><rect x="7.500" y="7.500" width="9" height="9" rx="1"/>',
    css: '<path d="M7 5L3 10l4 5M13 5l4 5-4 5"/>',
    toolPresets: '<path d="M4 4h12v12H4z"/><path d="M7 13l6-6M7 7h2M13 13h-2"/>',
    record: '<circle cx="10" cy="10" r="5" ' + F + '/>',
    stop: '<rect x="5.500" y="5.500" width="9" height="9" rx="1" ' + F + '/>',
    rotateView: '<path d="M4.500 10a5.500 5.500 0 109.400-3.900"/><path d="M15.500 2.500v4h-4"/><path d="M10 7v3l2 2"/>',

    /* ferramentas adicionais */
    artboard: '<rect x="5" y="5" width="10" height="10" rx=".6"/><path d="M5 2v3M15 2v3M5 15v3M15 15v3M2 5h3M2 15h3M15 5h3M15 15h3"/>',
    marqueeRow: '<path d="M2 10h16" stroke-dasharray="2.200 1.800"/><path d="M2 7.500v5M18 7.500v5"/>',
    marqueeCol: '<path d="M10 2v16" stroke-dasharray="2.200 1.800"/><path d="M7.500 2h5M7.500 18h5"/>',
    polyLasso: '<path d="M3 13l3-9 9 2.500 2 7-8.500 1.500z"/><path d="M6.200 14.200l-1 3.300"/>',
    magLasso: '<path d="M10 3.500c-4 0-7 2-7 4.600 0 2.500 3 4.500 7 4.500s7-2 7-4.500"/><path d="M13 13.500v3a1.500 1.500 0 003 0v-3M13 15h3"/><path d="M6.200 12c-1.300.7-1.500 2.300-.2 2.900"/>',
    quickSel: '<path d="M14.800 2.800c-2.300.6-5.300 3.600-7 6.200l1.700 1.700c2.600-1.700 5.600-4.700 6.200-7 .1-.6-.3-1-.9-.9z"/><path d="M6.500 10.500c-3 .2-3.800 3.400-3.700 6.300 2.700.3 6.500-.7 6.300-3.700" stroke-dasharray="2 1.500"/>',
    perspCrop: '<path d="M6 2l-1 13H18M2 5.500l13-1.500 1 13"/><path d="M5 15l10-11" opacity=".4"/>',
    slice: '<path d="M4 16L15 5l2 2L6 18z"/><path d="M2.500 14.500l3 3"/>',
    sliceSelect: '<path d="M4 3l9 5-4 1-1 4z" ' + F + '/><path d="M10 12l6 6M3 18h6"/>',
    colorSampler: '<path d="M11 6l3 3-7.200 7.200L4 17l.8-2.800L11 6z"/><circle cx="15" cy="15" r="2.500"/><path d="M15 11.500v1M15 17.500v1M11.500 15h1M17.500 15h1"/>',
    ruler: '<path d="M2.500 13.500l11-11 4 4-11 11z"/><path d="M5.500 10.500l1.500 1.500M8 8l2 2M10.500 5.500l1.500 1.500"/>',
    count: '<path d="M5 4v12M8.500 4v12M12 4v12M15.500 4v12"/><path d="M3 13l14-6"/>',
    spotHeal: '<rect x="3" y="7" width="14" height="6" rx="3" transform="rotate(-45 10 10)"/><path d="M8.600 8.600l2.800 2.800M8.600 11.400l2.800-2.800"/><path d="M15.500 3l.6 1.300 1.400.2-1 1 .2 1.400-1.200-.7-1.200.7.2-1.400-1-1 1.400-.2z" ' + F + '/>',
    heal: '<rect x="3" y="7" width="14" height="6" rx="3" transform="rotate(-45 10 10)"/><path d="M8.600 8.600l2.800 2.800M8.600 11.400l2.800-2.800"/>',
    patch: '<path d="M3.500 6c2-3 7-3.500 9.500-1.500 2.500 2 .5 5-2 5.500-3 .6-4 4-1 6"/><path d="M12 13h5v4.500h-5z" stroke-dasharray="1.600 1.300"/>',
    contentMove: '<path d="M10 2.500v15M2.500 10h15M8 4.500l2-2 2 2M8 15.500l2 2 2-2M4.500 8l-2 2 2 2M15.500 8l2 2-2 2"/><rect x="6.500" y="6.500" width="7" height="7" stroke-dasharray="1.600 1.300" fill="var(--bg-2,#27292d)"/>',
    redEye: '<path d="M1.800 10S4.800 4.500 10 4.500 18.200 10 18.200 10 15.200 15.500 10 15.500 1.800 10 1.800 10z"/><circle cx="10" cy="10" r="2.600" ' + F + '/>',
    pencil: '<path d="M13.200 3.300l3.500 3.500-9.400 9.400-4.300.8.800-4.300 9.400-9.400z"/><path d="M11.400 5.100l3.500 3.500M3.800 12.700l3.500 3.500"/>',
    colorReplace: '<path d="M17.200 2.800c-3 .8-7.200 4.700-9.400 8.200l2.200 2.200c3.500-2.200 7.400-6.400 8.200-9.400.1-.7-.3-1.100-1-1z"/><path d="M7.200 11.800c-2.200-.2-3.400 1.100-3.600 2.900-.1 1-.6 1.700-1.600 2.100 2 1.200 5.900.9 6.700-1.800.3-1 .1-2.200-1.500-3.200z" ' + F + '/><path d="M12.500 16.500h5M15 14v5"/>',
    mixer: '<path d="M17.200 2.800c-3 .8-7.200 4.700-9.400 8.200l2.200 2.200c3.500-2.200 7.400-6.400 8.200-9.400.1-.7-.3-1.100-1-1z"/><path d="M7.200 11.800c-2.200-.2-3.400 1.100-3.600 2.900-.1 1-.6 1.700-1.600 2.100 2 1.200 5.900.9 6.700-1.800.3-1 .1-2.200-1.500-3.200z"/><path d="M13 13.500c1.500 0 2.500 1 2.500 2.200s-1 2-2.500 2" />',
    patternStamp: '<path d="M10 2.800a2.400 2.400 0 00-1.500 4.300c.3.300.5.7.5 1.200v1.900H5.200c-.9 0-1.700.8-1.700 1.700V14h13v-2.100c0-.9-.8-1.700-1.700-1.700H11V8.300c0-.5.2-.9.5-1.200A2.400 2.400 0 0010 2.800z"/><path d="M3.500 17h2M7.500 17h2M11.500 17h2M15.500 17h1"/>',
    historyBrush: '<path d="M17.200 2.800c-3 .8-7.200 4.700-9.400 8.200l2.200 2.200c3.500-2.200 7.400-6.400 8.200-9.400.1-.7-.3-1.100-1-1z"/><path d="M7.200 11.800c-2.200-.2-3.400 1.100-3.600 2.900-.1 1-.6 1.700-1.600 2.100 2 1.200 5.900.9 6.700-1.800.3-1 .1-2.200-1.500-3.200z"/><path d="M2.500 6a3.500 3.500 0 106 -2.400"/><path d="M8.800 1.800v2H6.800"/>',
    bgEraser: '<path d="M8.200 16.500L3.600 11.900a1.200 1.200 0 010-1.700l6.900-6.900a1.200 1.200 0 011.700 0l4.600 4.600a1.200 1.200 0 010 1.700l-6.900 6.900H8.200z"/><path d="M6.800 7L13 13.200"/><path d="M13 16.500h4.500" stroke-dasharray="1.500 1.300"/><path d="M10.700 9.300l1.300 1.300M12.300 7.700l1.300 1.300"/>',
    magicEraser: '<path d="M8.200 16.500L3.600 11.900a1.200 1.200 0 010-1.700l6.900-6.900a1.200 1.200 0 011.700 0l4.600 4.600a1.200 1.200 0 010 1.700l-6.900 6.900H8.200z"/><path d="M6.800 7L13 13.200"/><path d="M16 1.500v3M14.500 3h3" />',
    blurTool: '<path d="M10 2.500s-5.500 6-5.500 9.500a5.500 5.500 0 0011 0C15.500 8.500 10 2.500 10 2.500z"/>',
    sharpenTool: '<path d="M10 2.500L5 16.500h10z"/>',
    smudge: '<path d="M7 17V9.500a1.300 1.300 0 012.600 0V12M9.600 11V4a1.300 1.300 0 012.600 0v7.500M12.200 11.500V8.500a1.300 1.300 0 012.600 0V13c0 2.500-1.800 4.500-4.300 4.500"/><path d="M7 12.500l-1.500-1.500a1.300 1.300 0 00-1.900 1.800L7 17"/>',
    dodge: '<circle cx="8" cy="8" r="5"/><path d="M11.500 11.500L17 17"/>',
    burn: '<path d="M7 17c-2-1.500-2.500-4-1-6.500L10 3l4 7.500c1.500 2.500 1 5-1 6.500"/><path d="M8.500 17c.5-1.500 1.500-2.500 1.500-2.500s1 1 1.500 2.500"/>',
    sponge: '<path d="M4 6.500c0-1.500 1.500-3 6-3s6 1.500 6 3v8c0 1.500-1.500 2.500-6 2.500s-6-1-6-2.500z"/><circle cx="7.500" cy="9" r="1" ' + F + '/><circle cx="12" cy="8" r="1" ' + F + '/><circle cx="10" cy="12.500" r="1" ' + F + '/><circle cx="13.300" cy="13" r=".8" ' + F + '/>',
    freePen: '<path d="M10 2.500l4.800 8.300-1.800 5.200H7l-1.800-5.200L10 2.500z"/><path d="M10 2.500v7.200"/><path d="M14 17c1.500-1 2-2.500 4-2.500"/>',
    curvPen: '<path d="M10 2.500l4.800 8.300-1.800 5.200H7l-1.800-5.200L10 2.500z"/><path d="M10 2.500v7.200"/><path d="M2 18c3-3 13-3 16 0"/>',
    addAnchor: '<path d="M8.500 2.500l4.200 7.300-1.600 4.700H6l-1.600-4.700 4.100-7.300z"/><path d="M8.500 2.500v6.200M14.500 13v5M12 15.500h5"/>',
    delAnchor: '<path d="M8.500 2.500l4.200 7.300-1.600 4.700H6l-1.600-4.700 4.100-7.300z"/><path d="M8.500 2.500v6.200M12 15.500h5"/>',
    convertPt: '<path d="M4 15l6-10 6 10"/><rect x="8.700" y="3.700" width="2.600" height="2.600" ' + F + '/><path d="M3 9h14" stroke-dasharray="1.500 1.300"/>',
    textV: '<path d="M5 4h10M10 4v3"/><path d="M7.500 9.500h5M10 9.500v8"/>',
    textMaskH: '<path d="M4 5.500V3.500h12v2M10 3.500v13M7.500 16.500h5" stroke-dasharray="2.200 1.600"/>',
    textMaskV: '<path d="M5 4h10M10 4v3M7.500 9.500h5M10 9.500v8" stroke-dasharray="2.200 1.600"/>',
    adjPanel: '<circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 000 14z" ' + F + '/><path d="M3 18h14"/>',
    pathSelect: '<path d="M5 2.500l10 7-4.500 1-2 4.500z" ' + F + '/>',
    directSelect: '<path d="M5 2.500l10 7-4.500 1-2 4.500z"/>',
    shapeCustom: '<path d="M10 16.500S3 12.500 3 7.700A3.700 3.700 0 0110 6a3.700 3.700 0 017 1.700c0 4.800-7 8.800-7 8.800z"/>',
    airbrush: '<path d="M4 12l6-6 3 3-6 6z"/><path d="M10 6l2-2 3 3-2 2"/><path d="M15.500 3.500l1-1M17 6l1.500-.5M14 2l.5-1.500"/><path d="M5.500 13.500L3 17"/>',
    pressureSize: '<circle cx="10" cy="10" r="7.300"/><circle cx="10" cy="10" r="3.200" ' + F + '/>',
    pressureOpacity: '<circle cx="10" cy="10" r="7.300"/><path d="M10 2.700a7.300 7.300 0 010 14.600z" ' + F + ' opacity=".55"/>',
    gradLinear: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M3 3h4v14H3z" ' + F + ' opacity=".8"/><path d="M7 3h4v14H7z" ' + F + ' opacity=".4"/>',
    gradRadial: '<rect x="3" y="3" width="14" height="14" rx="1"/><circle cx="10" cy="10" r="2.500" ' + F + '/><circle cx="10" cy="10" r="5" ' + F + ' opacity=".35"/>',
    gradAngle: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M10 10V3h7v7z" ' + F + ' opacity=".8"/><path d="M10 10h7v7h-7z" ' + F + ' opacity=".5"/><path d="M10 10v7H3v-7z" ' + F + ' opacity=".25"/>',
    gradReflected: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M8 3h4v14H8z" ' + F + ' opacity=".8"/><path d="M5 3h3v14H5zM12 3h3v14h-3z" ' + F + ' opacity=".35"/>',
    gradDiamond: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M10 5.500l4.500 4.500-4.500 4.500-4.500-4.500z" ' + F + ' opacity=".4"/><path d="M10 8l2 2-2 2-2-2z" ' + F + '/>',
    tWarp: '<path d="M3 5c4-2 10 2 14 0M3 10c4-2 10 2 14 0M3 15c4-2 10 2 14 0"/><path d="M5 4.300v10.500M10 5v10M15 4.300v10.500"/>',
    puppet: '<circle cx="10" cy="4" r="1.800"/><path d="M10 6v6M6 8.500l4-1 4 1M7 18l3-6 3 6"/>',
    justifyLeft: '<path d="M3 5h14M3 8.500h14M3 12h14M3 15.500h7"/>',
    justifyCenter: '<path d="M3 5h14M3 8.500h14M3 12h14M6.500 15.500h7"/>',
    justifyRight: '<path d="M3 5h14M3 8.500h14M3 12h14M10 15.500h7"/>',
    justifyAll: '<path d="M3 5h14M3 8.500h14M3 12h14M3 15.500h14"/>',
    quickMask: '<rect x="2.800" y="4" width="14.400" height="12" rx="1.200"/><circle cx="10" cy="10" r="3.400" stroke-dasharray="1.600 1.300"/>',
    brushPanel: '<path d="M16.500 3.500c-2.500.6-6 4-7.800 6.800l1.800 1.800c2.900-1.800 6.300-5.300 6.800-7.800.1-.6-.3-.9-.8-.8z"/><path d="M7.700 11.300c-2-.2-3 1-3.200 2.600-.1.900-.5 1.500-1.400 1.900 1.800 1.100 5.300.8 6-1.600.3-.9.1-2-1.400-2.900z"/>'
  };

  IMG.icons = icons;

  /** Retorna o SVG (string) de um ícone. */
  /** Conjuntos de ícones alternativos por aparência (ex.: IMG.iconSets.photopea), grade 24×24, preenchidos. */
  IMG.iconSets = IMG.iconSets || {};
  IMG.icon = function (name, size) {
    const s = size || 18;
    const set = IMG.iconSets[document.documentElement.dataset.skin];
    if (set && set[name]) {
      return '<svg class="ico" data-i="' + name + '" data-s="' + s + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="currentColor" stroke="none" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + set[name] + '</svg>';
    }
    const body = icons[name] || '';
    return '<svg class="ico" data-i="' + name + '" data-s="' + s + '" width="' + s + '" height="' + s + '" viewBox="0 0 20 20" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  };
  /** Redesenha os ícones já inseridos na página (troca de aparência). */
  IMG.refreshIcons = function (root) {
    (root || document).querySelectorAll('svg.ico[data-i]').forEach((svg) => {
      const t = document.createElement('template');
      t.innerHTML = IMG.icon(svg.dataset.i, +svg.dataset.s || 18);
      const n = t.content.firstChild;
      if (svg.getAttribute('style')) n.setAttribute('style', svg.getAttribute('style'));
      svg.replaceWith(n);
    });
  };

  /** Retorna um elemento <span> contendo o ícone. */
  IMG.iconEl = function (name, size) {
    const span = document.createElement('span');
    span.className = 'ico-wrap';
    span.innerHTML = IMG.icon(name, size);
    return span;
  };
})();
