/* ==========================================================================
   Imaginarium — painel Ajustes e Arquivo › Exportar pesquisa de cores (.cube)
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, el = U.el;

  IMG.UI.registerPanel({
    id: 'adjustments', title: 'Ajustes', icon: 'adjPanel',
    build(node) {
      const A = IMG.Adjust;
      node.appendChild(el('p.panel-note.adj-note', { text: 'Adicionar uma camada de ajuste' }));
      const grid = el('div.adj-grid');
      A.LAYER_ORDER.forEach((k) => {
        if (k === '-') { grid.appendChild(el('div.adj-sep')); return; }
        const b = el('button.adj-btn', { type: 'button', title: A.label(k), text: A.label(k) });
        b.addEventListener('click', () => { if (!IMG.app.doc) { IMG.UI.toast('Abra ou crie um documento.'); return; } A.newLayer(k); });
        grid.appendChild(b);
      });
      node.appendChild(grid);
    }
  });

  /** Gera um LUT 3D (.cube) a partir das camadas de ajuste visíveis do documento. */
  async function exportLut(size = 33) {
    const doc = IMG.app.doc; if (!doc) return;
    const adj = []; IMG.Layers.walk(doc.layers, (L) => { if (L.type === 'adjust' && IMG.Layers.isVisible(L)) adj.push(L); });
    if (!adj.length) { IMG.UI.toast('O documento não tem camadas de ajuste visíveis para exportar.'); return; }
    const n = size, W = n * n, H = n;
    const c = U.createCanvas(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), d = img.data;
    for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
      const px = b * n + r, py = g, i = (py * W + px) * 4;
      d[i] = Math.round((r * 255) / (n - 1)); d[i + 1] = Math.round((g * 255) / (n - 1)); d[i + 2] = Math.round((b * 255) / (n - 1)); d[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const D = new IMG.Doc({ name: 'lut', width: W, height: H });
    const base = new IMG.Layer('raster', { name: 'grade', canvas: c });
    D.layers = [base].concat(adj.map((L) => { const C = IMG.Layers.clone(L, ''); C.mask = null; C.parent = null; return C; }));
    const out = IMG.Engine.flatten(D).getContext('2d').getImageData(0, 0, W, H).data;
    const lines = ['TITLE "' + String(doc.name).replace(/"/g, "'") + '"', '# Gerado pelo Imaginarium', 'LUT_3D_SIZE ' + n, 'DOMAIN_MIN 0.0 0.0 0.0', 'DOMAIN_MAX 1.0 1.0 1.0'];
    for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
      const i = (g * W + b * n + r) * 4;
      lines.push((out[i] / 255).toFixed(6) + ' ' + (out[i + 1] / 255).toFixed(6) + ' ' + (out[i + 2] / 255).toFixed(6));
    }
    U.download(new Blob([lines.join('\n') + '\n'], { type: 'text/plain' }), U.safeFile(doc.name) + '.cube');
    IMG.UI.toast('Pesquisa de cores exportada (' + n + '³).');
  }
  IMG.exportLut = exportLut;
  IMG.onInit = IMG.onInit || [];
  IMG.onInit.push((C, H) => {
    C('file.exportLut', 'Exportar pesquisa de cores (.cube)…', () => {
      const UI = IMG.UI; let sz = 33;
      UI.dialog({ title: 'Exportar pesquisa de cores', width: 360, body: [UI.row('Qualidade', UI.select([['17', 'Baixa (17)'], ['33', 'Média (33)'], ['65', 'Alta (65)']], '33', (v) => { sz = +v; }, { width: 140, keepFocus: true }).el), el('p.dialog-note', { text: 'Combina as camadas de ajuste visíveis em um arquivo .cube, que pode ser usado em Ajustes › Pesquisa de cores ou em editores de vídeo.' })],
        buttons: [{ label: 'Cancelar' }, { label: 'Exportar', primary: true, onClick: () => { exportLut(sz).catch((e) => UI.fail(e)); } }] });
    }, { enabled: H.has });
  });
})();
