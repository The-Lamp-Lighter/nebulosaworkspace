/* ==========================================================================
   Imaginarium — painéis Caracteres e Parágrafo
   Durante a edição, valem para o texto selecionado (ou para o que for
   digitado); com uma camada de texto ativa, para o texto todo; sem texto,
   para os próximos textos.
   ========================================================================== */
(function () {
  'use strict';
  const IMG = window.IMG, U = IMG.U, bus = IMG.bus, el = U.el;
  const roots = {};

  function note(node) {
    const T = IMG.Text, L = T.current();
    const txt = T.edit ? (T.edit.caret !== T.edit.anchor ? 'Aplicando à seleção' : 'Aplicando ao texto digitado a seguir') : L ? 'Camada: "' + L.name + '"' : 'Sem texto selecionado — os ajustes valem para os próximos textos.';
    node.appendChild(el('p.panel-note', { text: txt }));
  }
  const busyIn = (root) => root.contains(document.activeElement) && U.isTyping(document.activeElement) && !document.activeElement.classList.contains('text-input');
  const mixed = (v) => v === undefined;

  function toggleBtn(label, title, key, on, value, css) {
    const T = IMG.Text;
    const b = el('button.tbtn' + (on ? '.on' : ''), { type: 'button', title, html: label });
    if (css) b.style.cssText = css;
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => { T.set({ [key]: on ? (typeof value === 'boolean' ? false : 'none') : value }, false); setTimeout(renderChar, 0); });
    return b;
  }

  function renderChar() {
    const root = roots.character;
    if (!root || !root.isConnected || busyIn(root)) return;
    const UI = IMG.UI, T = IMG.Text, F = IMG.Fonts, g = (k) => T.get(k);
    U.clear(root);
    const box = el('div.props.char-panel');
    note(box);
    const font = UI.select(F.options(g('font') || 'Arial'), g('font') || '', (v) => T.set({ font: v }), { label: 'Fonte', width: 180 });
    if (g('font')) font.el.style.fontFamily = '"' + g('font') + '", sans-serif';
    const wv = g('weight'), it = g('italic');
    const style = UI.select([['400', 'Regular'], ['400i', 'Itálico'], ['300', 'Leve'], ['300i', 'Leve itálico'], ['500', 'Médio'], ['600', 'Seminegrito'], ['700', 'Negrito'], ['700i', 'Negrito itálico'], ['900', 'Black']], mixed(wv) || mixed(it) ? '' : (wv || 400) + (it ? 'i' : ''), (v) => T.set({ weight: parseInt(v, 10), italic: /i$/.test(v) }), { width: 120 });
    box.appendChild(el('div.char-row', font.el, style.el));
    if (F.canQuery && !F.full) box.appendChild(el('div.props-actions', UI.btn('Carregar todas as fontes do sistema', () => F.loadSystem().catch(() => UI.toast('Permissão negada para listar as fontes.')), { small: true })));
    const num = (label, title, key, o) => {
      const v = g(key);
      const n = UI.num({ value: mixed(v) ? null : o.get ? o.get(v) : v, min: o.min, max: o.max, decimals: o.dec == null ? 1 : o.dec, unit: o.unit || '', width: 78, placeholder: mixed(v) ? '—' : o.auto && !v ? 'Auto' : '', onChange: (x) => T.set({ [key]: o.set ? o.set(x) : x }) });
      return el('label.char-field', { title }, el('span.char-ic', { html: label }), n.el);
    };
    box.appendChild(el('div.char-grid',
      num('T↕', 'Tamanho da fonte', 'size', { min: 0.5, max: 3000, unit: 'px' }),
      num('A↨', 'Entrelinha (0 = automática)', 'leading', { min: 0, max: 5000, unit: 'px', auto: true }),
      el('label.char-field', { title: 'Kerning' }, el('span.char-ic', { text: 'V/A' }), UI.select([['metric', 'Métrico'], ['none', '0']], g('kern') || 'metric', (v) => T.set({ kern: v }), { width: 84 }).el),
      num('VA', 'Rastreamento (milésimos de em)', 'tracking', { min: -1000, max: 10000, dec: 0 }),
      num('↕T', 'Escala vertical', 'vScale', { min: 1, max: 1000, unit: '%', dec: 0 }),
      num('T↔', 'Escala horizontal', 'hScale', { min: 1, max: 1000, unit: '%', dec: 0 }),
      num('A↑', 'Deslocamento da linha de base', 'shift', { min: -3000, max: 3000, unit: 'px' }),
      el('label.char-field', { title: 'Cor' }, el('span.char-ic', { text: 'Cor' }), UI.colorBtn(g('color') || '#000000', (hex, fin) => { if (hex) T.set({ color: hex }, false, fin); }).el)));
    const caps = g('caps'), pos = g('pos');
    box.appendChild(el('div.tbtns',
      toggleBtn('<b>T</b>', 'Negrito falso (Ctrl+Shift+B)', 'fauxBold', g('fauxBold') === true, true),
      toggleBtn('<i>T</i>', 'Itálico falso (Ctrl+Shift+I)', 'fauxItalic', g('fauxItalic') === true, true),
      toggleBtn('TT', 'Todas em maiúsculas (Ctrl+Shift+K)', 'caps', caps === 'all', 'all'),
      toggleBtn('T<small>T</small>', 'Versalete (Ctrl+Shift+H)', 'caps', caps === 'small', 'small'),
      toggleBtn('T<sup>1</sup>', 'Sobrescrito (Ctrl+Shift+=)', 'pos', pos === 'super', 'super'),
      toggleBtn('T<sub>1</sub>', 'Subscrito (Ctrl+Alt+Shift+=)', 'pos', pos === 'sub', 'sub'),
      toggleBtn('<u>T</u>', 'Sublinhado (Ctrl+Shift+U)', 'underline', g('underline') === true, true),
      toggleBtn('<s>T</s>', 'Tachado (Ctrl+Shift+/)', 'strike', g('strike') === true, true)));
    const L = T.current();
    box.appendChild(UI.row('Suavização', UI.select([['none', 'Nenhuma'], ['sharp', 'Nítida'], ['crisp', 'Precisa'], ['strong', 'Forte'], ['smooth', 'Suave']], (L ? L.text.aa : IMG.Tools.o('text').aa) || 'smooth', (v) => T.setLayer({ aa: v }, 'Suavização do texto'), { width: 120 }).el));
    if (L) box.appendChild(el('div.props-actions', UI.btn('Estilo de camada…', () => IMG.LayerStyle && IMG.LayerStyle.open('stroke'), { small: true, icon: 'fx', title: 'Contorno, sombra e outros efeitos do texto' }), UI.btn('Deformar…', () => T.warpDialog(), { small: true, icon: 'tWarp' })));
    root.appendChild(box);
  }

  function renderPara() {
    const root = roots.paragraph;
    if (!root || !root.isConnected || busyIn(root)) return;
    const UI = IMG.UI, T = IMG.Text, g = (k) => T.get(k, true);
    U.clear(root);
    const box = el('div.props');
    note(box);
    const al = g('align');
    const aligns = [['left', 'alignLeft', 'Alinhar texto à esquerda'], ['center', 'alignCenter', 'Centralizar texto'], ['right', 'alignRight', 'Alinhar texto à direita'], ['justify-left', 'justifyLeft', 'Justificar, última linha à esquerda'], ['justify-center', 'justifyCenter', 'Justificar, última linha centralizada'], ['justify-right', 'justifyRight', 'Justificar, última linha à direita'], ['justify-all', 'justifyAll', 'Justificar tudo']];
    const row = el('div.tbtns');
    aligns.forEach(([v, ic, title]) => { const b = el('button.tbtn' + (al === v ? '.on' : ''), { type: 'button', title, html: IMG.icon(ic, 15) }); b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', () => { T.set({ align: v }, true); setTimeout(renderPara, 0); }); row.appendChild(b); });
    box.appendChild(row);
    const num = (label, title, key) => el('label.char-field', { title }, el('span.char-ic', { html: label }), UI.num({ value: mixed(g(key)) ? null : g(key), min: -5000, max: 5000, decimals: 1, unit: 'px', width: 78, onChange: (x) => T.set({ [key]: x }, true) }).el);
    box.appendChild(el('div.char-grid', num('→|', 'Recuo à esquerda', 'indL'), num('|←', 'Recuo à direita', 'indR'), num('→¶', 'Recuo da primeira linha', 'indF'), el('span'), num('¶↑', 'Espaço antes do parágrafo', 'spB'), num('¶↓', 'Espaço depois do parágrafo', 'spA')));
    box.appendChild(UI.row('', UI.check('Hifenizar', g('hyph') === true, (v) => T.set({ hyph: v }, true)).el));
    const L = T.current();
    if (L) {
      box.appendChild(el('div.props-actions',
        L.text.box ? UI.btn('Converter em texto de ponto', () => UI.run('type.toPoint'), { small: true }) : (!L.text.onPath ? UI.btn('Converter em texto de parágrafo', () => UI.run('type.toBox'), { small: true }) : null),
        UI.btn(L.text.orient === 'v' ? 'Horizontal' : 'Vertical', () => UI.run(L.text.orient === 'v' ? 'type.horizontal' : 'type.vertical'), { small: true })));
    }
    root.appendChild(box);
  }

  const lateChar = U.debounce(renderChar, 60), latePara = U.debounce(renderPara, 60);
  const onText = (kind) => { if (kind === 'value') return; lateChar(); latePara(); };

  IMG.UI.registerPanel({
    id: 'character', title: 'Caracteres', icon: 'character',
    build(node) {
      roots.character = node;
      ['layers:select', 'layers:change', 'doc:change', 'fonts:change', 'history:change'].forEach((ev) => bus.on(ev, lateChar));
      bus.on('text:change', onText);
      renderChar();
    },
    onShow() { renderChar(); }
  });
  IMG.UI.registerPanel({
    id: 'paragraph', title: 'Parágrafo', icon: 'paragraph',
    build(node) {
      roots.paragraph = node;
      ['layers:select', 'layers:change', 'doc:change', 'history:change'].forEach((ev) => bus.on(ev, latePara));
      bus.on('text:change', onText);
      renderPara();
    },
    onShow() { renderPara(); }
  });
})();
