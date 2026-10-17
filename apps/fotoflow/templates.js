/* ==========================================================================
   FotoFlow — templates.js
   Sistema de modelos: cada modelo reúne paleta, fontes, estilos de texto,
   transições, movimentos de câmera, Ken Burns, ritmo e acabamento visual.
   Inclui os modelos de fábrica, os modelos do usuário (formato próprio
   .fftemplate, em JSON) e a sugestão automática a partir das fotos.
   ========================================================================== */
(function (FF) {
  'use strict';

  /* Famílias de fontes: somente fontes já instaladas no computador (uso offline). */
  const FONTS = {
    'Sem serifa moderna': "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    'Geométrica': "'Century Gothic', 'Trebuchet MS', 'Segoe UI', sans-serif",
    'Serifada clássica': "Georgia, 'Times New Roman', serif",
    'Serifada elegante': "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif",
    'Manuscrita': "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive",
    'Caligráfica': "'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive",
    'Impacto': "Impact, 'Arial Narrow', 'Franklin Gothic Medium', sans-serif",
    'Máquina de escrever': "'Courier New', Courier, monospace"
  };

  /* Monta os cinco estilos de texto de um modelo a partir de poucas escolhas. */
  function textStyles(titleFont, bodyFont, color, accent, o) {
    o = o || {};
    return {
      title: { font: FONTS[titleFont], size: o.titleSize || 9, weight: o.titleWeight || 600, color, upper: !!o.upper,
        spacing: o.spacing || 0, italic: !!o.titleItalic, anim: o.titleAnim || 'cinematic', x: 0.5, y: 0.46, align: 'center', shadow: true, bg: 'none' },
      subtitle: { font: FONTS[bodyFont], size: 4, weight: 400, color: accent, upper: false, spacing: 0.04,
        anim: 'fade', x: 0.5, y: 0.6, align: 'center', shadow: true, bg: 'none' },
      caption: { font: FONTS[bodyFont], size: 3.4, weight: 400, color: '#ffffff', upper: false, spacing: 0,
        anim: o.captionAnim || 'slide', x: 0.5, y: 0.88, align: 'center', shadow: true, bg: o.captionBg || 'bar', bgColor: o.captionBgColor || 'rgba(0,0,0,0.5)' },
      phrase: { font: FONTS[titleFont], size: 6.5, weight: o.titleWeight || 600, color, upper: !!o.upper, spacing: o.spacing || 0,
        italic: !!o.titleItalic, anim: o.phraseAnim || 'zoom', x: 0.5, y: 0.5, align: 'center', shadow: true, bg: 'none' },
      credits: { font: FONTS[bodyFont], size: 3.6, weight: 400, color, upper: false, spacing: 0.02, lineHeight: 1.6,
        anim: 'fade', x: 0.5, y: 0.5, align: 'center', shadow: true, bg: 'none' }
    };
  }

  function T(id, name, description, palette, fonts, cfg) {
    return {
      id, name, description, builtin: true,
      palette,                                   // { bg, primary, accent, text }
      fonts,                                     // { title, body } (nomes de FONTS)
      text: textStyles(fonts.title, fonts.body, palette.text, palette.accent, cfg.textOpts),
      transitions: cfg.transitions,              // sequência usada na geração automática
      cameras: cfg.cameras,                      // sequência de movimentos de câmera
      kenBurns: cfg.kenBurns || { intensity: 0.5 },
      rhythm: cfg.rhythm,                        // { scene, transition } em segundos
      look: cfg.look || {},                      // acabamento visual
      boardTransitions: cfg.boardTransitions || ['voo'],   // transições usadas no estilo Mural
      keywords: cfg.keywords || [],              // palavras em nomes de arquivos que indicam o modelo
      layout: cfg.layout || 'cover',             // enquadramento padrão das fotos
      style: cfg.style || 'classico',            // 'classico' (tela cheia) ou 'mural' (fotos sobre a mesa)
      board: cfg.board || { surface: 'madeira', decor: 'flores', tilt: 0.5 }
    };
  }

  const BUILTIN = [
    T('viagem', 'Viagem', 'Paisagens amplas, panorâmicas e ritmo de descoberta.',
      { bg: '#0f1d2b', primary: '#1f5f8b', accent: '#ffd27a', text: '#ffffff' }, { title: 'Geométrica', body: 'Sem serifa moderna' },
      { transitions: ['parallax', 'crossfade', 'push', 'light', 'reveal', 'zoom'], cameras: ['panH', 'zoomIn', 'travelling', 'kenburns', 'dollyOut', 'panH'],
        kenBurns: { intensity: 0.6 }, rhythm: { scene: 4.5, transition: 1.2 },
        look: { filter: 'saturate(1.15) contrast(1.05)', vignette: 0.35, lightLeak: 0.6 },
        textOpts: { upper: true, spacing: 0.12, titleAnim: 'cinematic' }, keywords: ['viagem', 'trip', 'travel', 'praia', 'ferias', 'férias', 'montanha', 'passeio'] }),

    T('casamento', 'Casamento', 'Romântico e luminoso, com fusões longas e delicadas.',
      { bg: '#2a2224', primary: '#b98c7a', accent: '#f3d9c8', text: '#fffaf5' }, { title: 'Caligráfica', body: 'Serifada elegante' },
      { transitions: ['light', 'crossfade', 'blur', 'dissolve', 'crossfade', 'iris'], cameras: ['zoomIn', 'kenburns', 'dollyIn', 'panH', 'zoomOut', 'orbit'],
        kenBurns: { intensity: 0.4 }, rhythm: { scene: 5.5, transition: 1.8 },
        look: { filter: 'brightness(1.05) saturate(0.95) sepia(0.08)', vignette: 0.3, lightLeak: 0.9, tint: '#ffd9c2', tintAmount: 0.18 },
        textOpts: { titleSize: 10, titleWeight: 400, titleAnim: 'fade', captionBg: 'none' }, keywords: ['casamento', 'wedding', 'noiva', 'noivo', 'cerimonia', 'cerimônia', 'bodas'] }),

    T('familia', 'Família', 'Acolhedor e caloroso, para o dia a dia e os encontros.',
      { bg: '#2b2118', primary: '#c97b4a', accent: '#ffe0a8', text: '#fff8ec' }, { title: 'Serifada clássica', body: 'Sem serifa moderna' },
      { transitions: ['crossfade', 'slide', 'blur', 'push', 'crossfade', 'light'], cameras: ['kenburns', 'zoomIn', 'panH', 'zoomOut', 'kenburns', 'travelling'],
        kenBurns: { intensity: 0.45 }, rhythm: { scene: 4.5, transition: 1.3 },
        look: { filter: 'saturate(1.08) sepia(0.1)', vignette: 0.3, lightLeak: 0.4 },
        textOpts: { titleAnim: 'slide' }, keywords: ['familia', 'família', 'family', 'natal', 'almoco', 'almoço', 'avos', 'avós', 'primos'] }),

    T('bebe', 'Bebê', 'Suave e claro, com movimentos lentos e tons pastel.',
      { bg: '#f3e9ee', primary: '#e7b7c8', accent: '#8fb7d9', text: '#5a4a57' }, { title: 'Manuscrita', body: 'Geométrica' },
      { transitions: ['blur', 'crossfade', 'dissolve', 'iris', 'crossfade'], cameras: ['zoomIn', 'kenburns', 'zoomOut', 'panV', 'kenburns'],
        kenBurns: { intensity: 0.3 }, rhythm: { scene: 5, transition: 1.6 },
        look: { filter: 'brightness(1.06) saturate(0.9)', paperEdge: 0.35, paperColor: '255,244,248' },
        textOpts: { titleWeight: 400, titleAnim: 'zoom', captionBg: 'box', captionBgColor: 'rgba(255,255,255,0.72)' },
        keywords: ['bebe', 'bebê', 'baby', 'nascimento', 'maternidade', 'mesversario', 'mêsversário', 'newborn'] }),

    T('aniversario', 'Aniversário', 'Alegre e colorido, com cortes animados.',
      { bg: '#2a1340', primary: '#ff5d8f', accent: '#ffd23f', text: '#ffffff' }, { title: 'Geométrica', body: 'Sem serifa moderna' },
      { transitions: ['push', 'zoom', 'slide', 'motionBlur', 'light', 'iris'], cameras: ['zoomIn', 'orbit', 'panH', 'dollyIn', 'travelling', 'zoomOut'],
        kenBurns: { intensity: 0.6 }, rhythm: { scene: 3.5, transition: 0.9 },
        look: { filter: 'saturate(1.25) contrast(1.05)', vignette: 0.2 },
        textOpts: { titleWeight: 700, titleAnim: 'zoom', phraseAnim: 'zoom' }, keywords: ['aniversario', 'aniversário', 'birthday', 'festa', 'parabens', 'parabéns', 'bolo'] }),

    T('formatura', 'Formatura', 'Solene e festivo, com títulos de destaque.',
      { bg: '#101728', primary: '#1d3461', accent: '#e8c15a', text: '#ffffff' }, { title: 'Serifada elegante', body: 'Sem serifa moderna' },
      { transitions: ['reveal', 'crossfade', 'light', 'push', 'zoom', 'fade'], cameras: ['dollyIn', 'panH', 'zoomOut', 'kenburns', 'tilt', 'zoomIn'],
        kenBurns: { intensity: 0.5 }, rhythm: { scene: 4.5, transition: 1.2 },
        look: { filter: 'contrast(1.08)', vignette: 0.45, letterbox: 0.5 },
        textOpts: { upper: true, spacing: 0.14, titleAnim: 'cinematic' }, keywords: ['formatura', 'graduation', 'colacao', 'colação', 'beca', 'diploma', 'turma'] }),

    T('eventos', 'Eventos', 'Dinâmico, para festas, shows e encontros.',
      { bg: '#12131c', primary: '#5b3cc4', accent: '#3fd0c9', text: '#ffffff' }, { title: 'Impacto', body: 'Sem serifa moderna' },
      { transitions: ['motionBlur', 'push', 'zoom', 'light', 'slide', 'parallax'], cameras: ['travelling', 'zoomIn', 'orbit', 'panH', 'dollyIn', 'zoomOut'],
        kenBurns: { intensity: 0.65 }, rhythm: { scene: 3.2, transition: 0.8 },
        look: { filter: 'contrast(1.1) saturate(1.15)', vignette: 0.4 },
        textOpts: { upper: true, spacing: 0.06, titleWeight: 400, titleAnim: 'zoom' }, keywords: ['evento', 'show', 'congresso', 'feira', 'palestra', 'encontro'] }),

    T('marketing', 'Marketing', 'Direto e vibrante, com frases de impacto.',
      { bg: '#0d0f14', primary: '#ff4f3a', accent: '#ffe14a', text: '#ffffff' }, { title: 'Impacto', body: 'Geométrica' },
      { transitions: ['push', 'motionBlur', 'slide', 'zoom', 'reveal'], cameras: ['dollyIn', 'panH', 'zoomIn', 'travelling', 'zoomOut'],
        kenBurns: { intensity: 0.7 }, rhythm: { scene: 3, transition: 0.7 },
        look: { filter: 'contrast(1.12) saturate(1.2)', vignette: 0.25 },
        textOpts: { upper: true, titleWeight: 400, titleSize: 10, titleAnim: 'reveal', phraseAnim: 'reveal', captionAnim: 'slide' },
        keywords: ['produto', 'promo', 'oferta', 'marketing', 'campanha', 'lancamento', 'lançamento'] }),

    T('empresarial', 'Empresarial', 'Sóbrio e limpo, para apresentações institucionais.',
      { bg: '#0f1a26', primary: '#1e4d6b', accent: '#7fc8e8', text: '#ffffff' }, { title: 'Sem serifa moderna', body: 'Sem serifa moderna' },
      { transitions: ['reveal', 'crossfade', 'push', 'slide', 'crossfade'], cameras: ['zoomIn', 'panH', 'static', 'zoomOut', 'kenburns'],
        kenBurns: { intensity: 0.3 }, rhythm: { scene: 5, transition: 1.0 },
        look: { filter: 'saturate(0.92) contrast(1.04)', vignette: 0.2 },
        textOpts: { titleWeight: 300, titleAnim: 'slide', captionAnim: 'fade' }, keywords: ['empresa', 'equipe', 'reuniao', 'reunião', 'escritorio', 'escritório', 'corporativo', 'institucional'] }),

    T('turismo', 'Turismo', 'Cartão-postal: cores vivas e passeios pela cena.',
      { bg: '#10231c', primary: '#1f8a70', accent: '#ffcb69', text: '#ffffff' }, { title: 'Serifada elegante', body: 'Geométrica' },
      { transitions: ['parallax', 'light', 'crossfade', 'reveal', 'morph', 'push'], cameras: ['travelling', 'panH', 'tilt', 'dollyIn', 'kenburns', 'orbit'],
        kenBurns: { intensity: 0.55 }, rhythm: { scene: 5, transition: 1.3 },
        look: { filter: 'saturate(1.2) contrast(1.04)', vignette: 0.3, lightLeak: 0.5 },
        textOpts: { titleItalic: true, titleAnim: 'cinematic' }, keywords: ['turismo', 'cidade', 'museu', 'hotel', 'roteiro', 'tour', 'centro'] }),

    T('portfolio', 'Portfólio', 'Minimalista: a imagem em primeiro lugar.',
      { bg: '#111111', primary: '#2a2a2a', accent: '#bdbdbd', text: '#f5f5f5' }, { title: 'Geométrica', body: 'Geométrica' },
      { transitions: ['crossfade', 'fade', 'reveal', 'crossfade', 'blur'], cameras: ['zoomIn', 'static', 'panH', 'zoomOut', 'kenburns'],
        kenBurns: { intensity: 0.25 }, rhythm: { scene: 4.5, transition: 1.4 },
        look: { vignette: 0.15 }, layout: 'contain',
        textOpts: { upper: true, spacing: 0.3, titleWeight: 300, titleSize: 6, titleAnim: 'fade', captionBg: 'none' },
        keywords: ['portfolio', 'portfólio', 'ensaio', 'projeto', 'obra', 'arte'] }),

    T('memorial', 'Memorial', 'Sereno e respeitoso, em preto e branco suave.',
      { bg: '#141414', primary: '#3a3a3a', accent: '#d8cfc0', text: '#f4efe6' }, { title: 'Serifada elegante', body: 'Serifada clássica' },
      { transitions: ['crossfade', 'dissolve', 'fade', 'blur', 'crossfade'], cameras: ['zoomIn', 'kenburns', 'zoomOut', 'panH', 'kenburns'],
        kenBurns: { intensity: 0.25 }, rhythm: { scene: 6.5, transition: 2.2 },
        look: { filter: 'grayscale(0.85) contrast(1.05) sepia(0.12)', vignette: 0.55, grain: 0.6 },
        textOpts: { titleWeight: 400, titleItalic: true, titleAnim: 'fade', captionBg: 'none', captionAnim: 'fade' },
        keywords: ['memorial', 'homenagem', 'saudade', 'lembranca', 'lembrança', 'in memoriam'] }),

    T('redes', 'Redes Sociais', 'Vertical, rápido e chamativo.',
      { bg: '#0e0e12', primary: '#7a3cff', accent: '#00e0b8', text: '#ffffff' }, { title: 'Geométrica', body: 'Sem serifa moderna' },
      { transitions: ['zoom', 'motionBlur', 'push', 'slide', 'light'], cameras: ['dollyIn', 'zoomOut', 'panV', 'orbit', 'zoomIn'],
        kenBurns: { intensity: 0.75 }, rhythm: { scene: 2.5, transition: 0.6 },
        look: { filter: 'contrast(1.1) saturate(1.2)', vignette: 0.2 },
        textOpts: { titleWeight: 700, titleAnim: 'typewriter', phraseAnim: 'zoom', captionBg: 'box' }, keywords: ['reels', 'story', 'stories', 'tiktok', 'insta', 'post'] }),

    T('mural', 'Mural de Fotos', 'Fotos como impressões sobre a madeira; a câmera voa de uma para a outra.',
      { bg: '#b9b1a5', primary: '#8e9a86', accent: '#f3efe6', text: '#ffffff' }, { title: 'Serifada elegante', body: 'Sem serifa moderna' },
      { style: 'mural', board: { surface: 'madeira', decor: 'flores', tilt: 0.5 }, boardTransitions: ['voo', 'voo', 'voo', 'crossfade'],
        transitions: ['voo', 'voo', 'voo', 'crossfade'], cameras: ['zoomIn', 'static', 'zoomOut', 'panH'],
        kenBurns: { intensity: 0.3 }, rhythm: { scene: 5.5, transition: 1.7 },
        look: { vignette: 0.4 }, textOpts: { titleAnim: 'fade', captionAnim: 'fade' },
        keywords: ['mural', 'album', 'álbum', 'lembrancas', 'lembranças', 'scrapbook'] }),

    T('waldorf', 'Inspiração Waldorf', 'Aquarela e papel: fusões em véus, luz quente e ritmo contemplativo.',
      { bg: '#f7f1e3', primary: '#e58a6a', accent: '#4f8fcc', text: '#3d4a63' }, { title: 'Serifada elegante', body: 'Manuscrita' },
      { transitions: ['dissolve', 'blur', 'crossfade', 'light', 'dissolve', 'iris'], cameras: ['kenburns', 'zoomIn', 'panH', 'zoomOut', 'kenburns', 'panV'],
        kenBurns: { intensity: 0.28 }, rhythm: { scene: 6.5, transition: 2.4 },
        look: { filter: 'saturate(0.92) brightness(1.05) sepia(0.1)', paperEdge: 0.65, paperColor: '250,244,230', lightLeak: 0.5, tint: '#ffd9a8', tintAmount: 0.16 },
        textOpts: { titleWeight: 400, titleAnim: 'fade', phraseAnim: 'fade', captionAnim: 'fade', captionBg: 'box', captionBgColor: 'rgba(250,244,230,0.82)' },
        keywords: ['waldorf', 'jardim', 'aquarela', 'epoca', 'época', 'lanterna', 'festa junina', 'sao joao', 'são joão', 'escola'] })
  ];
  // No modelo Waldorf e no Bebê a legenda fica sobre papel claro: o texto precisa ser escuro.
  BUILTIN.find(t => t.id === 'waldorf').text.caption.color = '#3d4a63';
  BUILTIN.find(t => t.id === 'waldorf').text.caption.shadow = false;
  BUILTIN.find(t => t.id === 'bebe').text.caption.color = '#5a4a57';
  BUILTIN.find(t => t.id === 'bebe').text.caption.shadow = false;
  // Superfície e decoração de cada modelo quando o filme usa o estilo Mural.
  BUILTIN.find(t => t.id === 'viagem').board = { surface: 'cortica', decor: 'nenhum', tilt: 0.6 };
  BUILTIN.find(t => t.id === 'bebe').board = { surface: 'papel', decor: 'flores', tilt: 0.5 };
  BUILTIN.find(t => t.id === 'aniversario').board = { surface: 'linho', decor: 'confete', tilt: 0.7 };
  BUILTIN.find(t => t.id === 'formatura').board = { surface: 'linho', decor: 'nenhum', tilt: 0.4 };
  BUILTIN.find(t => t.id === 'eventos').board = { surface: 'ardosia', decor: 'confete', tilt: 0.7 };
  BUILTIN.find(t => t.id === 'marketing').board = { surface: 'ardosia', decor: 'nenhum', tilt: 0.5 };
  BUILTIN.find(t => t.id === 'empresarial').board = { surface: 'linho', decor: 'nenhum', tilt: 0.25 };
  BUILTIN.find(t => t.id === 'turismo').board = { surface: 'cortica', decor: 'folhas', tilt: 0.6 };
  BUILTIN.find(t => t.id === 'portfolio').board = { surface: 'ardosia', decor: 'nenhum', tilt: 0.2 };
  BUILTIN.find(t => t.id === 'memorial').board = { surface: 'ardosia', decor: 'folhas', tilt: 0.3 };
  BUILTIN.find(t => t.id === 'redes').board = { surface: 'ardosia', decor: 'confete', tilt: 0.8 };
  BUILTIN.find(t => t.id === 'waldorf').board = { surface: 'papel', decor: 'folhas', tilt: 0.45 };
  // Redes sociais nasce em formato vertical.
  BUILTIN.find(t => t.id === 'redes').aspect = '9:16';

  /* ---------- Modelos do usuário (guardados no navegador) ---------- */
  const STORE_KEY = 'fotoflow.modelos';
  let custom = [];
  function loadCustom() {
    try { custom = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { custom = []; }
    if (!Array.isArray(custom)) custom = [];
  }
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(custom)); return true; } catch (e) { return false; }
  }
  loadCustom();

  const clone = o => JSON.parse(JSON.stringify(o));

  const Templates = {
    FONTS,
    textStyles,
    all() { return BUILTIN.concat(custom); },
    get(id) { return this.all().find(t => t.id === id) || BUILTIN[0]; },
    isCustom(id) { return custom.some(t => t.id === id); },

    /* Cria uma cópia editável de qualquer modelo. */
    duplicate(id) {
      const src = this.get(id), copy = clone(src);
      copy.id = 'meu-' + Date.now().toString(36);
      copy.name = src.name + ' (cópia)';
      copy.builtin = false;
      custom.push(copy); persist();
      return copy;
    },
    save(tpl) {
      tpl.builtin = false;
      const i = custom.findIndex(t => t.id === tpl.id);
      if (i >= 0) custom[i] = clone(tpl); else custom.push(clone(tpl));
      return persist();
    },
    remove(id) { custom = custom.filter(t => t.id !== id); persist(); },

    /* Formato próprio do FotoFlow para modelos: arquivo .fftemplate (JSON). */
    toFile(tpl) {
      return JSON.stringify({ formato: 'FotoFlow.Modelo', versao: 1, modelo: tpl }, null, 2);
    },
    fromFile(text) {
      const data = JSON.parse(text);
      if (!data || data.formato !== 'FotoFlow.Modelo' || !data.modelo) throw new Error('Este arquivo não é um modelo do FotoFlow.');
      const tpl = data.modelo;
      tpl.id = 'meu-' + Date.now().toString(36);
      tpl.builtin = false;
      custom.push(tpl); persist();
      return tpl;
    },

    /* ----------------------------------------------------------------------
       Sugestão automática.
       Funciona offline com pistas simples: palavras nos nomes dos arquivos e
       características visuais das fotos (tons de pele, céu/mar, verde, claros,
       saturação, rostos). É uma estimativa, não um reconhecimento de cena.
       ---------------------------------------------------------------------- */
    suggest(mediaList) {
      const imgs = mediaList.filter(m => m.type === 'image');
      if (!imgs.length) return null;
      const avg = k => imgs.reduce((s, m) => s + ((m.stats && m.stats[k]) || 0), 0) / imgs.length;
      const st = { skin: avg('skin'), blue: avg('blue'), green: avg('green'), white: avg('white'), sat: avg('sat'),
        dark: avg('dark'), warm: avg('warm'), faces: avg('faces'), portrait: imgs.filter(m => m.h > m.w * 1.1).length / imgs.length };
      const names = imgs.map(m => (m.name || '').toLowerCase()).join(' ');
      const score = {}, why = {};
      const add = (id, v, reason) => { score[id] = (score[id] || 0) + v; if (reason && v > 0.25 && !why[id]) why[id] = reason; };

      this.all().forEach(t => (t.keywords || []).forEach(k => { if (names.includes(k)) add(t.id, 3, `nomes dos arquivos citam "${k}"`); }));
      add('viagem', st.blue * 2.2 + st.green * 1.0, 'muito céu, mar ou paisagem');
      add('turismo', st.blue * 1.2 + st.warm * 0.6 + st.sat * 0.4, 'cenários externos coloridos');
      add('casamento', st.white * 1.8 + st.skin * 0.6 + (st.faces >= 1.5 ? 0.3 : 0), 'tons claros e pessoas em destaque');
      add('familia', st.skin * 1.6 + (st.faces >= 2 ? 0.6 : st.faces >= 1 ? 0.3 : 0), 'várias pessoas e tons de pele');
      add('bebe', st.skin * 0.9 + st.white * 0.8 + (st.sat < 0.25 ? 0.25 : 0) - st.dark * 0.5, 'tons suaves e claros');
      add('aniversario', st.sat * 1.3 + st.warm * 0.5 + st.skin * 0.4, 'cores vivas e quentes');
      add('memorial', (st.sat < 0.08 ? 1.4 : 0), 'fotos em preto e branco');
      add('empresarial', (st.sat < 0.2 ? 0.4 : 0) + (st.skin < 0.08 ? 0.2 : 0), 'cores sóbrias');
      add('portfolio', st.dark * 0.6 + (st.skin < 0.05 ? 0.3 : 0), 'imagens escuras e poucos rostos');
      add('redes', st.portrait * 0.9, 'maioria das fotos na vertical');
      add('waldorf', st.green * 0.8 + st.warm * 0.5 + (st.sat < 0.3 ? 0.2 : 0), 'natureza e tons quentes suaves');

      const best = Object.keys(score).sort((a, b) => score[b] - score[a])[0];
      return best ? { id: best, reason: why[best] || 'características gerais das fotos', stats: st } : null;
    }
  };

  FF.Templates = Templates;
})(window.FF = window.FF || {});
