/* ==========================================================================
   Imaginarium — catálogo completo de filtros (como no Photopea)
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, el = U.el;
  const { P, C, S, COL } = IMG.FXP;
  const FX = IMG.FX, reg = FX.register;
  const rgb = (hex) => { const c = U.hexToRgb(hex); return [c.r, c.g, c.b]; };
  const pct = (...keys) => (p) => { keys.forEach((k) => { p[k] = p[k] / 100; }); return p; };
  const N = (key, label, options, def) => Object.assign(S(key, label, options, def), { numeric: true });
  const RND = (key, label) => ({ type: 'button', key, label: label || 'Randomizar', action: (v) => { v[key] = Math.floor(Math.random() * 1e6); } });

  /* ---------- Desfoque ---------- */
  reg('average', { label: 'Média', group: 'blur', kernel: 'average', direct: true });
  reg('blur', { label: 'Desfoque', group: 'blur', kernel: 'blurSimple', direct: true, defaults: { radius: 0.7 } });
  reg('blurMore', { label: 'Mais desfoque', group: 'blur', kernel: 'blurSimple', direct: true, defaults: { radius: 1.8 } });
  reg('boxBlur', { label: 'Desfoque de caixa', group: 'blur', kernel: 'boxBlur', params: [P('radius', 'Raio', 1, 999, 10, 1, ' px', { pow: 2 })] });
  // (Desfoque gaussiano e de movimento estão em filters-ui.js)
  reg('lensBlur', { label: 'Desfoque de lente', group: 'blur', kernel: 'lensBlur', slow: true, params: [P('radius', 'Raio', 1, 100, 15, 1, ' px'), N('blades', 'Forma da íris', [[0, 'Círculo'], [3, 'Triângulo'], [4, 'Quadrado'], [5, 'Pentágono'], [6, 'Hexágono'], [8, 'Octógono']], 0), P('rotation', 'Rotação da lâmina', 0, 360, 0, 1, '°'), P('brightness', 'Brilho especular', 0, 100, 0, 1, '%'), P('threshold', 'Limiar', 0, 255, 255), P('noise', 'Ruído', 0, 100, 0, 1, '%')] });
  reg('radialBlur', { label: 'Desfoque radial', group: 'blur', kernel: 'radialBlur', slow: true, pick: ['cx', 'cy'],
    params: [P('amount', 'Quantidade', 1, 100, 10), S('method', 'Método', [['spin', 'Giratório'], ['zoom', 'Zoom']], 'spin'), S('quality', 'Qualidade', [['draft', 'Rascunho'], ['good', 'Bom'], ['best', 'Ótimo']], 'good'), P('cx', 'Centro X', 0, 100, 50, 1, '%'), P('cy', 'Centro Y', 0, 100, 50, 1, '%'), { type: 'note', label: 'Clique na imagem para definir o centro.' }],
    prep: pct('cx', 'cy') });
  reg('smartBlur', { label: 'Desfoque inteligente', group: 'blur', kernel: 'smartBlur', slow: true, params: [P('radius', 'Raio', 0.1, 100, 3, 0.1), P('threshold', 'Limiar', 0.1, 100, 25, 0.1), S('mode', 'Modo', [['normal', 'Normal'], ['edgeOnly', 'Somente bordas'], ['overlay', 'Sobrepor bordas']], 'normal')] });
  reg('surfaceBlur', { label: 'Desfoque de superfície', group: 'blur', kernel: 'surfaceBlur', slow: true, params: [P('radius', 'Raio', 1, 100, 5, 1, ' px'), P('threshold', 'Limiar', 2, 255, 15, 1, ' níveis')] });

  /* ---------- Galeria de desfoque (mapa de desfoque variável) ---------- */
  function blurMap(kind, p, w, h, L) {
    const map = new Float32Array(w * h);
    const ox = L ? L.x : 0, oy = L ? L.y : 0;
    const doc = IMG.app.doc;
    const cx = (p.cx / 100) * doc.width - ox, cy = (p.cy / 100) * doc.height - oy;
    if (kind === 'iris') {
      const rx = Math.max(1, (p.rx / 100) * doc.width), ry = Math.max(1, (p.ry / 100) * doc.height), a = U.rad(p.rot || 0), c = Math.cos(a), s = Math.sin(a);
      const sharp = U.clamp(p.sharp / 100, 0, 0.99);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = x - cx, dy = y - cy, u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
        const r = Math.sqrt(u * u + v * v);
        map[y * w + x] = r <= sharp ? 0 : Math.min(1, (r - sharp) / (1 - sharp));
      }
    } else if (kind === 'tilt') {
      const a = U.rad(p.rot || 0), nx = -Math.sin(a), ny = Math.cos(a);
      const band = (p.band / 100) * doc.height / 2, trans = Math.max(1, (p.trans / 100) * doc.height / 2);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dist = Math.abs((x - cx) * nx + (y - cy) * ny); map[y * w + x] = dist <= band ? 0 : Math.min(1, (dist - band) / trans); }
    } else {
      // campo: dois pinos com intensidades diferentes
      const x1 = (p.x1 / 100) * doc.width - ox, y1 = (p.y1 / 100) * doc.height - oy, x2 = (p.x2 / 100) * doc.width - ox, y2 = (p.y2 / 100) * doc.height - oy;
      const b1 = p.b1 / Math.max(1, p.radius), b2 = p.b2 / Math.max(1, p.radius);
      const dx = x2 - x1, dy = y2 - y1, l2 = Math.max(1, dx * dx + dy * dy);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const t = U.clamp(((x - x1) * dx + (y - y1) * dy) / l2, 0, 1); map[y * w + x] = b1 + (b2 - b1) * t; }
    }
    return map;
  }
  const galleryOverlay = (kind, vals) => (ctx, v) => {
    const doc = IMG.app.doc; if (!doc) return;
    const X = (px) => v.x + (px / 100) * doc.width * v.zoom, Y = (py) => v.y + (py / 100) * doc.height * v.zoom;
    ctx.save(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 3;
    const pin = (x, y) => { ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); };
    if (kind === 'field') { pin(X(vals.x1), Y(vals.y1)); pin(X(vals.x2), Y(vals.y2)); }
    else {
      pin(X(vals.cx), Y(vals.cy));
      if (kind === 'iris') { ctx.beginPath(); ctx.ellipse(X(vals.cx), Y(vals.cy), (vals.rx / 100) * doc.width * v.zoom, (vals.ry / 100) * doc.height * v.zoom, U.rad(vals.rot || 0), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.ellipse(X(vals.cx), Y(vals.cy), (vals.rx / 100) * doc.width * v.zoom * vals.sharp / 100, (vals.ry / 100) * doc.height * v.zoom * vals.sharp / 100, U.rad(vals.rot || 0), 0, Math.PI * 2); ctx.stroke(); }
      else {
        const a = U.rad(vals.rot || 0), L = Math.hypot(v.w, v.h), ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
        const c = { x: X(vals.cx), y: Y(vals.cy) };
        [vals.band, vals.band + vals.trans].forEach((d, i) => { const off = (d / 100) * doc.height / 2 * v.zoom; ctx.setLineDash(i ? [5, 5] : []); [-1, 1].forEach((sg) => { ctx.beginPath(); ctx.moveTo(c.x + nx * off * sg - ux * L, c.y + ny * off * sg - uy * L); ctx.lineTo(c.x + nx * off * sg + ux * L, c.y + ny * off * sg + uy * L); ctx.stroke(); }); });
      }
    }
    ctx.restore();
  };
  const galleryDef = (kind, label, params) => ({
    label, group: 'blurGallery', kernel: 'variableBlur', slow: true, params,
    pick: kind === 'field' ? ['x1', 'y1'] : ['cx', 'cy'],
    overlay: (vals) => galleryOverlay(kind, vals),
    prep: (p, Sx) => { const L = Sx && Sx.L; const w = Sx ? Sx.w : 1, h = Sx ? Sx.h : 1; return { radius: p.radius, map: blurMap(kind, p, w, h, L && !Sx.onMask ? L : (L ? L.mask : null)) }; }
  });
  reg('fieldBlur', galleryDef('field', 'Desfoque de campo', [P('radius', 'Desfoque máximo', 1, 500, 15, 1, ' px', { pow: 2 }), P('b1', 'Desfoque no pino 1', 0, 500, 0, 1, ' px'), P('b2', 'Desfoque no pino 2', 0, 500, 15, 1, ' px'), P('x1', 'Pino 1 — X', 0, 100, 30, 1, '%'), P('y1', 'Pino 1 — Y', 0, 100, 30, 1, '%'), P('x2', 'Pino 2 — X', 0, 100, 70, 1, '%'), P('y2', 'Pino 2 — Y', 0, 100, 70, 1, '%'), { type: 'note', label: 'Clique na imagem para mover o pino 1 (Shift+clique: pino 2).' }]));
  reg('irisBlur', galleryDef('iris', 'Desfoque de íris', [P('radius', 'Desfoque', 1, 500, 15, 1, ' px', { pow: 2 }), P('cx', 'Centro X', 0, 100, 50, 1, '%'), P('cy', 'Centro Y', 0, 100, 50, 1, '%'), P('rx', 'Raio horizontal', 1, 150, 30, 1, '%'), P('ry', 'Raio vertical', 1, 150, 30, 1, '%'), P('rot', 'Rotação', -180, 180, 0, 1, '°'), P('sharp', 'Área nítida', 0, 99, 40, 1, '%'), { type: 'note', label: 'Clique na imagem para posicionar o centro.' }]));
  reg('tiltShift', galleryDef('tilt', 'Tilt-shift', [P('radius', 'Desfoque', 1, 500, 15, 1, ' px', { pow: 2 }), P('cx', 'Centro X', 0, 100, 50, 1, '%'), P('cy', 'Centro Y', 0, 100, 50, 1, '%'), P('band', 'Faixa nítida', 0, 100, 15, 1, '%'), P('trans', 'Transição', 1, 100, 25, 1, '%'), P('rot', 'Rotação', -90, 90, 0, 1, '°'), { type: 'note', label: 'Clique na imagem para posicionar a faixa.' }]));

  /* ---------- Distorção ---------- */
  reg('displace', {
    label: 'Deslocar', group: 'distort', kernel: 'displace',
    params: [P('hScale', 'Escala horizontal', -999, 999, 10, 1, '%'), P('vScale', 'Escala vertical', -999, 999, 10, 1, '%'), S('mapMode', 'Mapa', [['stretch', 'Esticar para ajustar'], ['tile', 'Ladrilho']], 'stretch'), S('undef', 'Áreas indefinidas', [['repeat', 'Repetir pixels da borda'], ['wrap', 'Contornar']], 'repeat'),
      S('source', 'Origem do mapa', [['self', 'A própria camada (desfocada)'], ['pattern', 'Padrão selecionado'], ['clouds', 'Nuvens']], 'self'), { type: 'note', label: 'Vermelho desloca na horizontal; verde, na vertical (128 = sem deslocamento).' }],
    prep(p, Sx) {
      let c;
      const w = Sx ? Sx.w : 64, h = Sx ? Sx.h : 64;
      if (p.source === 'pattern') { const pat = IMG.Patterns.get(IMG.Patterns.last || 'p6').canvas; c = U.cloneCanvas(pat); }
      else if (p.source === 'clouds') { c = U.createCanvas(Math.min(512, w), Math.min(512, h)); const x = c.getContext('2d'); const img = x.createImageData(c.width, c.height); IMG.Filters.K.clouds(img.data, c.width, c.height, { fg: [0, 0, 0], bg: [255, 255, 255], seed: 5 }); for (let i = 0; i < img.data.length; i += 4) img.data[i + 1] = 255 - img.data[i]; x.putImageData(img, 0, 0); }
      else { c = U.createCanvas(w, h); const x = c.getContext('2d'); if (Sx) x.putImageData(Sx.src, 0, 0); IMG.blurCanvas(c, 4); }
      const md = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      return { hScale: p.hScale, vScale: p.vScale, map: md, mw: c.width, mh: c.height, tile: p.mapMode === 'tile', wrap: p.undef === 'wrap' };
    }
  });
  reg('pinch', { label: 'Comprimir', group: 'distort', kernel: 'pinch', params: [P('amount', 'Quantidade', -100, 100, 50, 1, '%')] });
  reg('polar', { label: 'Coordenadas polares', group: 'distort', kernel: 'polar', params: [S('mode', 'Conversão', [['rectToPolar', 'Retangular para polar'], ['polarToRect', 'Polar para retangular']], 'rectToPolar')] });
  reg('ripple', { label: 'Ondulação', group: 'distort', kernel: 'ripple', params: [P('amount', 'Quantidade', -999, 999, 100, 1, '%'), S('size', 'Tamanho', [['small', 'Pequeno'], ['medium', 'Médio'], ['large', 'Grande']], 'medium')] });
  reg('shear', {
    label: 'Torcer', group: 'distort', kernel: 'shear',
    params: [S('shape', 'Forma', [['arc', 'Arco'], ['s', 'Curva em S'], ['wave', 'Onda'], ['diag', 'Diagonal']], 'arc'), P('amount', 'Intensidade', -100, 100, 40, 1, '%'), S('undef', 'Áreas indefinidas', [['wrap', 'Contornar'], ['repeat', 'Repetir pixels da borda']], 'wrap')],
    prep(p) { const lut = new Float32Array(256), a = p.amount / 100; for (let i = 0; i < 256; i++) { const t = i / 255; lut[i] = a * (p.shape === 's' ? Math.sin(t * Math.PI * 2) * 0.5 : p.shape === 'wave' ? Math.sin(t * Math.PI * 4) * 0.4 : p.shape === 'diag' ? t - 0.5 : Math.sin(t * Math.PI) * 0.5); } return { lut, undefined: p.undef }; }
  });
  reg('spherize', { label: 'Esferizar', group: 'distort', kernel: 'spherize', params: [P('amount', 'Quantidade', -100, 100, 100, 1, '%'), S('mode', 'Modo', [['normal', 'Normal'], ['horizontal', 'Somente horizontal'], ['vertical', 'Somente vertical']], 'normal')] });
  reg('twirl', { label: 'Redemoinho', group: 'distort', kernel: 'twirl', params: [P('angle', 'Ângulo', -999, 999, 50, 1, '°')] });
  reg('wave', {
    label: 'Onda', group: 'distort', kernel: 'wave',
    params: [P('generators', 'Número de geradores', 1, 10, 5), P('wlMin', 'Comprimento de onda mín.', 1, 998, 10), P('wlMax', 'Comprimento de onda máx.', 2, 999, 120), P('ampMin', 'Amplitude mín.', 1, 998, 5), P('ampMax', 'Amplitude máx.', 1, 999, 35),
      P('scaleH', 'Escala horizontal', 1, 100, 100, 1, '%'), P('scaleV', 'Escala vertical', 1, 100, 100, 1, '%'), S('type', 'Tipo', [['sine', 'Seno'], ['triangle', 'Triângulo'], ['square', 'Quadrado']], 'sine'), S('undefined', 'Áreas indefinidas', [['repeat', 'Repetir pixels da borda'], ['wrap', 'Contornar']], 'repeat'), RND('seed')]
  });
  reg('zigzag', { label: 'Ziguezague', group: 'distort', kernel: 'zigzag', params: [P('amount', 'Quantidade', -100, 100, 10), P('ridges', 'Arestas', 1, 20, 5), S('style', 'Estilo', [['around', 'Em torno do centro'], ['out', 'A partir do centro'], ['pond', 'Ondulações de lago']], 'pond')] });
  reg('glass', { label: 'Vidro', group: 'distort', kernel: 'glass', params: [P('distortion', 'Distorção', 0, 20, 5), P('smoothness', 'Suavização', 1, 15, 3)] });
  reg('oceanRipple', { label: 'Ondulação oceânica', group: 'distort', kernel: 'oceanRipple', params: [P('size', 'Tamanho da ondulação', 1, 15, 9), P('magnitude', 'Magnitude', 0, 20, 9)] });

  /* ---------- Ruído ---------- */
  reg('despeckle', { label: 'Remover manchas', group: 'noise', kernel: 'despeckle', direct: true });
  reg('dustScratches', { label: 'Poeira e arranhões', group: 'noise', kernel: 'dustScratches', slow: true, params: [P('radius', 'Raio', 1, 100, 1, 1, ' px'), P('threshold', 'Limiar', 0, 255, 0, 1, ' níveis')] });
  reg('median', { label: 'Mediana', group: 'noise', kernel: 'median', slow: true, params: [P('radius', 'Raio', 1, 100, 1, 1, ' px')] });
  reg('reduceNoise', { label: 'Reduzir ruído', group: 'noise', kernel: 'reduceNoise', slow: true, params: [P('strength', 'Intensidade', 0, 10, 6), P('preserve', 'Preservar detalhes', 0, 100, 60, 1, '%'), P('color', 'Reduzir ruído de cor', 0, 100, 45, 1, '%'), P('sharpen', 'Tornar detalhes mais nítidos', 0, 100, 25, 1, '%')] });

  /* ---------- Pixelização ---------- */
  reg('colorHalftone', { label: 'Meio-tom em cores', group: 'pixelate', kernel: 'colorHalftone', params: [P('radius', 'Raio máximo', 4, 127, 8, 1, ' px'), P('a1', 'Canal 1', -360, 360, 108, 1, '°'), P('a2', 'Canal 2', -360, 360, 162, 1, '°'), P('a3', 'Canal 3', -360, 360, 90, 1, '°')] });
  reg('crystallize', { label: 'Cristalizar', group: 'pixelate', kernel: 'crystallize', params: [P('size', 'Tamanho da célula', 3, 300, 10)] });
  reg('facet', { label: 'Faceta', group: 'pixelate', kernel: 'facet', direct: true });
  reg('fragment', { label: 'Fragmento', group: 'pixelate', kernel: 'fragment', direct: true });
  reg('mezzotint', { label: 'Meia-tinta', group: 'pixelate', kernel: 'mezzotint', params: [S('type', 'Tipo', [['fine', 'Pontos finos'], ['medium', 'Pontos médios'], ['grainy', 'Pontos granulados'], ['coarse', 'Pontos grossos'], ['shortLines', 'Linhas curtas'], ['mediumLines', 'Linhas médias'], ['longLines', 'Linhas longas']], 'fine')] });
  reg('pointillize', { label: 'Pontilhar', group: 'pixelate', kernel: 'pointillize', params: [P('size', 'Tamanho da célula', 3, 300, 6)], prep: (p) => Object.assign(p, { bg: rgb(IMG.app.bg) }) });

  /* ---------- Acabamento (Render) ---------- */
  reg('clouds', { label: 'Nuvens', group: 'render', kernel: 'clouds', direct: true, fullDoc: true, prep: (p) => ({ fg: rgb(IMG.app.fg), bg: rgb(IMG.app.bg), seed: (Math.random() * 1e6) | 0 }) });
  reg('diffClouds', { label: 'Nuvens por diferença', group: 'render', kernel: 'clouds', direct: true, fullDoc: true, prep: () => ({ fg: rgb(IMG.app.fg), bg: rgb(IMG.app.bg), seed: (Math.random() * 1e6) | 0, diff: true }) });
  reg('fibers', { label: 'Fibras', group: 'render', kernel: 'fibers', fullDoc: true, params: [P('variance', 'Variação', 1, 64, 16), P('strength', 'Intensidade', 1, 64, 4), RND('seed')], prep: (p) => Object.assign(p, { fg: rgb(IMG.app.fg), bg: rgb(IMG.app.bg) }) });
  reg('lensFlare', { label: 'Reflexo de lente', group: 'render', kernel: 'lensFlare', pick: ['cx', 'cy'],
    params: [P('brightness', 'Brilho', 10, 300, 100, 1, '%'), S('type', 'Tipo de lente', [['zoom', 'Zoom 50–300 mm'], ['35mm', 'Prime 35 mm'], ['prime', 'Prime 105 mm']], 'zoom'), P('cx', 'Centro X', 0, 100, 30, 1, '%'), P('cy', 'Centro Y', 0, 100, 30, 1, '%'), { type: 'note', label: 'Clique na imagem para posicionar o reflexo.' }],
    prep: pct('cx', 'cy') });
  reg('lighting', { label: 'Efeitos de iluminação', group: 'render', kernel: 'lighting', pick: ['lx', 'ly'], slow: true,
    params: [S('type', 'Tipo de luz', [['spot', 'Holofote'], ['point', 'Ponto'], ['infinite', 'Infinita']], 'spot'), COL('color', 'Cor', '#ffffff'), P('intensity', 'Intensidade', -100, 100, 35), P('radius', 'Alcance', 5, 200, 60, 1, '%'), P('ambience', 'Ambiente', -100, 100, 8), C('texture', 'Textura (relevo pela luminância)', false), P('height', 'Altura', 0, 100, 50), P('lx', 'Posição X', 0, 100, 30, 1, '%'), P('ly', 'Posição Y', 0, 100, 30, 1, '%'), { type: 'note', label: 'Clique na imagem para mover a luz.' }],
    prep: (p) => Object.assign(pct('lx', 'ly')(p), { color: rgb(p.color) }) });

  /* ---------- Nitidez ---------- */
  reg('sharpenMore', { label: 'Mais nitidez', group: 'sharpen', kernel: 'sharpen', direct: true, defaults: { amount: 150, radius: 0.9 } });
  reg('sharpenEdges', { label: 'Tornar as bordas nítidas', group: 'sharpen', kernel: 'sharpen', direct: true, defaults: { amount: 100, radius: 1, threshold: 6 } });
  reg('smartSharpen', { label: 'Nitidez inteligente', group: 'sharpen', kernel: 'smartSharpen', slow: true, params: [P('amount', 'Quantidade', 1, 500, 100, 1, '%'), P('radius', 'Raio', 0.1, 64, 1, 0.1, ' px'), P('reduceNoise', 'Reduzir ruído', 0, 100, 10, 1, '%'), S('remove', 'Remover', [['gaussian', 'Desfoque gaussiano'], ['lens', 'Desfoque de lente'], ['motion', 'Desfoque de movimento']], 'lens'), Object.assign(P('angle', 'Ângulo', -180, 180, 0, 1, '°'), { visible: (v) => v.remove === 'motion' })] });

  /* ---------- Estilização ---------- */
  reg('diffuse', { label: 'Difusão', group: 'stylize', kernel: 'diffuse', params: [S('mode', 'Modo', [['normal', 'Normal'], ['darken', 'Somente escurecer'], ['lighten', 'Somente clarear'], ['anisotropic', 'Anisotrópico']], 'normal')] });
  reg('extrude', { label: 'Extrusão', group: 'stylize', kernel: 'extrude', params: [S('type', 'Tipo', [['blocks', 'Blocos'], ['pyramids', 'Pirâmides']], 'blocks'), P('size', 'Tamanho', 2, 255, 30, 1, ' px'), P('depth', 'Profundidade', 1, 255, 30)] });
  reg('oilPaint', { label: 'Pintura a óleo', group: 'stylize', kernel: 'oilPaint', slow: true, params: [P('stylization', 'Estilização', 1, 10, 3), P('shine', 'Brilho', 0, 10, 1, 0.1), P('angle', 'Ângulo da luz', -180, 180, 135, 1, '°')] });
  reg('solarize', { label: 'Solarizar', group: 'stylize', kernel: 'solarize', direct: true });
  reg('tiles', { label: 'Ladrilhos', group: 'stylize', kernel: 'tiles', params: [P('count', 'Número de ladrilhos', 1, 99, 10), P('offset', 'Deslocamento máximo', 1, 99, 10, 1, '%'), S('fill', 'Preencher área vazia com', [['background', 'Cor de fundo'], ['foreground', 'Cor do primeiro plano'], ['inverse', 'Imagem inversa'], ['unaltered', 'Imagem inalterada']], 'background')],
    prep: (p) => Object.assign(p, { fillColor: rgb(p.fill === 'foreground' ? IMG.app.fg : IMG.app.bg) }) });
  reg('traceContour', { label: 'Traçar contorno', group: 'stylize', kernel: 'traceContour', params: [P('level', 'Nível', 0, 255, 128), S('edge', 'Borda', [['lower', 'Inferior'], ['upper', 'Superior']], 'upper')] });
  reg('wind', { label: 'Vento', group: 'stylize', kernel: 'wind', params: [S('method', 'Método', [['wind', 'Vento'], ['blast', 'Rajada'], ['stagger', 'Escalonar']], 'wind'), S('direction', 'Direção', [['right', 'Da direita'], ['left', 'Da esquerda']], 'right')] });
  reg('glowingEdges', { label: 'Bordas brilhantes', group: 'stylize', kernel: 'glowingEdges', params: [P('width', 'Largura da borda', 1, 14, 2), P('brightness', 'Brilho da borda', 0, 20, 6), P('smoothness', 'Suavização', 1, 15, 5)] });

  /* ---------- Outros ---------- */
  reg('highPass', { label: 'Passa-alta', group: 'other', kernel: 'highPass', params: [P('radius', 'Raio', 0.1, 1000, 10, 0.1, ' px', { pow: 2 })] });
  reg('hsbHsl', { label: 'HSB/HSL', group: 'other', kernel: 'hsbHsl', params: [S('mode', 'Conversão', [['hsb', 'RGB para HSB'], ['hsl', 'RGB para HSL']], 'hsb')] });
  reg('maximum', { label: 'Máximo', group: 'other', kernel: 'maximum', params: [P('radius', 'Raio', 1, 500, 1, 1, ' px'), S('shape', 'Preservar', [['square', 'Quadratura'], ['round', 'Arredondamento']], 'square')] });
  reg('minimum', { label: 'Mínimo', group: 'other', kernel: 'minimum', params: [P('radius', 'Raio', 1, 500, 1, 1, ' px'), S('shape', 'Preservar', [['square', 'Quadratura'], ['round', 'Arredondamento']], 'square')] });
  reg('offset', { label: 'Deslocamento', group: 'other', kernel: 'offset', params: [P('x', 'Horizontal (px à direita)', -30000, 30000, 0), P('y', 'Vertical (px para baixo)', -30000, 30000, 0), S('undefined', 'Áreas indefinidas', [['background', 'Definir como transparente/fundo'], ['repeat', 'Repetir pixels da borda'], ['wrap', 'Contornar']], 'wrap')],
    prep: (p) => Object.assign(p, { bg: rgb(IMG.app.bg) }) });
  reg('custom', { label: 'Personalizado', group: 'other', custom: () => customDialog() });

  /* ---------- Galeria de filtros (artísticos) ---------- */
  reg('cutout', { label: 'Recorte', group: 'artistic', kernel: 'cutout', params: [P('levels', 'Número de níveis', 2, 8, 4), P('simplicity', 'Simplicidade da borda', 0, 10, 4)] });
  reg('posterEdges', { label: 'Bordas posterizadas', group: 'artistic', kernel: 'posterEdges', params: [P('thickness', 'Espessura da borda', 0, 10, 2), P('levels', 'Posterização', 0, 6, 2)] });
  reg('filmGrain', { label: 'Granulação de filme', group: 'artistic', kernel: 'filmGrain', params: [P('grain', 'Granulação', 0, 20, 4), P('highlight', 'Área de realce', 0, 20, 0)] });
  reg('watercolor', { label: 'Aquarela', group: 'artistic', kernel: 'watercolor', slow: true, params: [P('detail', 'Detalhe do pincel', 1, 14, 9), P('shadow', 'Intensidade da sombra', 0, 10, 1)] });
  reg('graphicPen', { label: 'Caneta gráfica', group: 'artistic', kernel: 'graphicPen', params: [P('length', 'Comprimento do traço', 1, 15, 15), P('balance', 'Equilíbrio claro/escuro', 0, 100, 50), S('direction', 'Direção', [['right', 'Diagonal direita'], ['left', 'Diagonal esquerda'], ['horizontal', 'Horizontal'], ['vertical', 'Vertical']], 'right')] });

  /* ---------- Camera Raw e Correção de lente ---------- */
  reg('cameraRaw', { label: 'Filtro Camera Raw', kernel: 'cameraRaw', keys: ['ctrl+shift+a'], width: 380, slow: true,
    params: [{ type: 'note', label: 'Básico' }, P('temperature', 'Temperatura', -100, 100, 0), P('tint', 'Matiz', -100, 100, 0), P('exposure', 'Exposição', -5, 5, 0, 0.05, '', { decimals: 2 }), P('contrast', 'Contraste', -100, 100, 0),
      P('highlights', 'Realces', -100, 100, 0), P('shadows', 'Sombras', -100, 100, 0), P('whites', 'Brancos', -100, 100, 0), P('blacks', 'Pretos', -100, 100, 0),
      P('clarity', 'Claridade', -100, 100, 0), P('dehaze', 'Remover neblina', -100, 100, 0), P('vibrance', 'Vibratilidade', -100, 100, 0), P('saturation', 'Saturação', -100, 100, 0),
      { type: 'note', label: 'Efeitos' }, P('vignette', 'Vinheta', -100, 100, 0), P('grain', 'Granulação', 0, 100, 0)] });
  reg('lensCorrection', { label: 'Correção de lente', kernel: 'lensCorrection', keys: ['ctrl+shift+r'], width: 380, slow: true,
    params: [P('distortion', 'Remover distorção', -100, 100, 0), P('caRC', 'Aberração: vermelho/ciano', -100, 100, 0), P('caBY', 'Aberração: azul/amarelo', -100, 100, 0), P('vignette', 'Vinheta: quantidade', -100, 100, 0), P('vigMid', 'Vinheta: ponto médio', 0, 100, 50),
      P('vPersp', 'Perspectiva vertical', -100, 100, 0), P('hPersp', 'Perspectiva horizontal', -100, 100, 0), P('angle', 'Ângulo', -180, 180, 0, 0.1, '°'), P('scale', 'Escala', 50, 150, 100, 1, '%')] });

  /* ---------- diálogo Personalizado (matriz 5×5) ---------- */
  function customDialog() {
    const UI = IMG.UI;
    const st = Object.assign({ m: [0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, -1, 5, -1, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0], scale: 1, offset: 0 }, FX.memory.custom || {});
    const grid = el('div.kernel-grid');
    let fx = null;
    st.m.forEach((v, i) => grid.appendChild(UI.num({ value: v, min: -999, max: 999, width: 52, onChange: (x) => { st.m[i] = x; FX.memory.custom = IMG.jclone(st); fx && fx.update(); } }).el));
    const body = [grid, UI.row('Escala', UI.num({ value: st.scale, min: 1, max: 9999, width: 80, onChange: (x) => { st.scale = x; fx && fx.update(); } }).el), UI.row('Deslocamento', UI.num({ value: st.offset, min: -9999, max: 9999, width: 80, onChange: (x) => { st.offset = x; fx && fx.update(); } }).el)];
    fx = IMG.FXSession.dialog({ title: 'Personalizado', kernel: 'customKernel', body, width: 340, params: () => IMG.jclone(st), onDone: (ok) => { if (ok) FX.last = { id: 'customRun', values: IMG.jclone(st) }; } });
  }
  reg('customRun', { label: 'Personalizado', kernel: 'customKernel', hidden: true, direct: true });

  /* ---------- Galeria de filtros ---------- */
  function galleryDialog() {
    const UI = IMG.UI;
    const ids = (FX.groups.artistic || []).concat(['glowingEdges', 'oilPaint', 'glass', 'oceanRipple', 'diffuse']).filter((id) => FX.defs[id]);
    let cur = U.store.get('galleryLast', ids[0]);
    if (!ids.includes(cur)) cur = ids[0];
    const S2 = IMG.FXSession.begin(); if (!S2 || S2.smart) return;
    const list = el('div.fg-list'), pane = el('div.fg-pane');
    let vals = FX.values(cur), fx = null;
    const renderPane = () => {
      U.clear(pane);
      const d = FX.defs[cur];
      pane.appendChild(el('h3.form-title', { text: d.label }));
      FX.buildParams(d, vals, () => { FX.memory[cur] = Object.assign({}, vals); FX.saveMemory(); fx && fx.update(); }).nodes.forEach((n) => pane.appendChild(n));
    };
    const renderList = () => {
      U.clear(list);
      ids.forEach((id) => {
        const b = el('div.fg-item' + (id === cur ? '.active' : ''), { text: FX.defs[id].label });
        b.addEventListener('click', () => { cur = id; vals = FX.values(id); U.store.set('galleryLast', id); renderList(); renderPane(); fx && fx.update(); });
        list.appendChild(b);
      });
    };
    renderList(); renderPane();
    fx = IMG.FXSession.dialog({
      session: S2, title: 'Galeria de filtros', width: 520, body: [el('div.fg-wrap', list, pane)],
      params: () => { const d = FX.defs[cur]; return d.prep ? d.prep(Object.assign({}, vals), S2) : Object.assign({}, vals); },
      fn: (data, w, h, p) => IMG.Filters.K[FX.defs[cur].kernel](data, w, h, p),
      onDone: (ok) => { if (ok) FX.last = { id: cur, values: Object.assign({}, vals) }; }
    });
  }
  reg('gallery', { label: 'Galeria de filtros', custom: galleryDialog });

  /* ---------- clique na imagem para posicionar (filtros com "pick") ---------- */
  const baseOpen = FX.open.bind(FX);
  FX.open = function (id, o) {
    const d = FX.defs[id];
    if (!d || !d.pick || d.custom || d.direct) return baseOpen(id, o);
    baseOpen(id, o);
    const doc = IMG.app.doc; if (!doc || !IMG.UI.dialogs.length) return;
    const dlg = IMG.UI.dialogs[IMG.UI.dialogs.length - 1];
    const L = doc.active;
    const vals = FX.memory[id] || (FX.memory[id] = FX.values(id));
    const rel = !d.overlay; // posição relativa à camada (núcleos) ou ao documento (galeria)
    const set = (ev, second) => {
      const kx = second && d.pick.length > 2 ? d.pick[2] : second && id === 'fieldBlur' ? 'x2' : d.pick[0];
      const ky = second && id === 'fieldBlur' ? 'y2' : d.pick[1];
      if (rel && L && L.canvas) { vals[kx] = U.clamp(Math.round(((ev.x - L.x) / L.canvas.width) * 100), 0, 100); vals[ky] = U.clamp(Math.round(((ev.y - L.y) / L.canvas.height) * 100), 0, 100); }
      else { vals[kx] = U.clamp(Math.round((ev.x / doc.width) * 100), 0, 100); vals[ky] = U.clamp(Math.round((ev.y / doc.height) * 100), 0, 100); }
      dlg.close(); FX.open(id);
    };
    IMG.Tools.overrideClick = (ev) => set(ev, ev.shift);
    if (d.overlay) IMG.Engine.dialogOverlay = d.overlay(vals);
    IMG.Engine.requestRender();
    const oc = dlg.close;
    dlg.close = (v) => { if (IMG.Tools.overrideClick) IMG.Tools.overrideClick = null; IMG.Engine.dialogOverlay = null; IMG.Engine.requestRender(); oc(v); };
  };
})();
