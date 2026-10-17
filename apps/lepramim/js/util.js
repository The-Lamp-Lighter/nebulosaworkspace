/* ============================================================
   LêPraMim — util.js
   Funções utilitárias usadas por todos os módulos.
   ============================================================ */
(function () {
  'use strict';

  const util = {};

  /** Atalhos para selecionar elementos. */
  util.$ = (sel, raiz) => (raiz || document).querySelector(sel);
  util.$$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));

  /**
   * Cria um elemento HTML.
   * el('button', {class:'bt', onclick: fn}, 'Texto' | [filhos])
   */
  util.el = function (tag, attrs, filhos) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'text') e.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(e.dataset, v);
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    if (filhos !== undefined && filhos !== null) {
      (Array.isArray(filhos) ? filhos : [filhos]).forEach(f => {
        if (f === null || f === undefined || f === false) return;
        e.appendChild(typeof f === 'object' ? f : document.createTextNode(String(f)));
      });
    }
    return e;
  };

  /** Ícone SVG a partir do "sprite" definido no index.html. */
  util.icone = function (nome) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ic');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + nome);
    svg.appendChild(use);
    return svg;
  };

  /** Escapa texto para uso seguro dentro de HTML. */
  util.escapar = function (t) {
    return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  /** Remove acentos e coloca em minúsculas (para comparações e buscas). */
  util.normalizar = function (t) {
    return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  };

  /** Identificador único simples. */
  util.gerarId = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  /** Extensão do arquivo em minúsculas, sem o ponto. */
  util.extensao = function (nome) {
    const m = /\.([a-z0-9]+)$/i.exec(nome || '');
    return m ? m[1].toLowerCase() : '';
  };

  /** Nome do arquivo sem a extensão. */
  util.semExtensao = function (nome) {
    return String(nome || '').replace(/\.[a-z0-9]+$/i, '');
  };

  /** 12345 segundos -> "03:25:45" */
  util.formatarTempo = function (seg, sempreHoras) {
    seg = Math.max(0, Math.floor(seg || 0));
    const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
    const dd = n => String(n).padStart(2, '0');
    return (h > 0 || sempreHoras) ? `${dd(h)}:${dd(m)}:${dd(s)}` : `${dd(m)}:${dd(s)}`;
  };

  /** Duração em linguagem natural: "2 h 05 min", "12 min". */
  util.formatarDuracao = function (seg) {
    seg = Math.floor(seg || 0);
    const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60);
    if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
    if (m > 0) return `${m} min`;
    return `${seg} s`;
  };

  /** Data curta em português. */
  util.formatarData = function (ms) {
    if (!ms) return 'nunca';
    const d = new Date(ms), hoje = new Date();
    const mesmoDia = d.toDateString() === hoje.toDateString();
    if (mesmoDia) return 'hoje, ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  /** "2026-10-05" (dia local) — chave usada no histórico. */
  util.diaDeHoje = function () {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  /** Tamanho de arquivo legível. */
  util.formatarTamanho = function (b) {
    if (b > 1048576) return (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
    return Math.max(1, Math.round(b / 1024)) + ' KB';
  };

  /** Adia a execução até o usuário parar de acionar (ex.: digitação). */
  util.adiar = function (fn, ms) {
    let t;
    return function () {
      const args = arguments, eu = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(eu, args), ms);
    };
  };

  util.limitar = (v, min, max) => Math.min(max, Math.max(min, v));

  util.esperar = ms => new Promise(r => setTimeout(r, ms));

  /**
   * Decodifica bytes em texto. Tenta UTF-8 e, se houver caracteres
   * inválidos, usa Windows-1252 (comum em TXT antigos no Brasil).
   */
  util.decodificarTexto = function (buffer) {
    const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    // Marcas de ordem de bytes (BOM) de UTF-16
    if (u8.length >= 2 && u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8);
    if (u8.length >= 2 && u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder('utf-16be').decode(u8);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(u8);
    } catch (e) {
      return new TextDecoder('windows-1252').decode(u8);
    }
  };

  /** Carrega um script local sob demanda. Resolve true/false (nunca rejeita). */
  const scriptsCarregados = {};
  util.carregarScript = function (url) {
    if (scriptsCarregados[url]) return scriptsCarregados[url];
    scriptsCarregados[url] = new Promise(resolve => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => resolve(true);
      s.onerror = () => { delete scriptsCarregados[url]; s.remove(); resolve(false); };
      document.head.appendChild(s);
    });
    return scriptsCarregados[url];
  };

  /** URL absoluta de um caminho relativo ao app. */
  util.urlAbsoluta = caminho => new URL(caminho, document.baseURI).href;

  /** true quando o app roda via http(s)/localhost (necessário para OCR e PWA). */
  util.viaServidor = () => location.protocol === 'http:' || location.protocol === 'https:';

  /** Reduz uma imagem (Blob/canvas) a uma miniatura JPEG em data URL. */
  util.miniatura = async function (fonte, larguraMax) {
    larguraMax = larguraMax || 300;
    let img = fonte;
    if (fonte instanceof Blob) img = await createImageBitmap(fonte);
    const r = Math.min(1, larguraMax / img.width);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * r));
    c.height = Math.max(1, Math.round(img.height * r));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  };

  /** Dispara o download de um Blob com o nome indicado. */
  util.baixar = function (blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = util.el('a', { href: url, download: nome });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return url;
  };

  /** Nome de arquivo seguro para o Windows. */
  util.nomeArquivo = t => String(t).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'arquivo';

  /** Cor estável derivada de um texto (para capas geradas). */
  util.corDoTexto = function (t) {
    let h = 0;
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360;
    return h;
  };

  LPM.util = util;
})();
