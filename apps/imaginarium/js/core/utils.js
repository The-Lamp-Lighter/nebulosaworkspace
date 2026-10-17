/* ==========================================================================
   Imaginarium — utilitários compartilhados
   Namespace global único: window.IMG (scripts clássicos para funcionar em file://)
   ========================================================================== */
(function () {
  'use strict';

  const IMG = (window.IMG = window.IMG || {});
  const U = (IMG.U = {});

  IMG.VERSION = '2.0';
  IMG.NAME = 'Imaginarium';

  /* ---------- números ---------- */
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.round = (v, d = 0) => { const p = Math.pow(10, d); return Math.round(v * p) / p; };
  U.deg = (r) => (r * 180) / Math.PI;
  U.rad = (d) => (d * Math.PI) / 180;

  let uidSeq = 0;
  U.uid = (p = 'id') => p + Date.now().toString(36) + (++uidSeq).toString(36) + Math.floor(Math.random() * 1296).toString(36);

  /* ---------- eventos ---------- */
  class Emitter {
    constructor() { this._h = Object.create(null); }
    on(ev, fn) { (this._h[ev] || (this._h[ev] = [])).push(fn); return () => this.off(ev, fn); }
    off(ev, fn) { const a = this._h[ev]; if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
    emit(ev, ...args) {
      const a = this._h[ev];
      if (!a) return;
      for (const fn of a.slice()) {
        try { fn(...args); } catch (err) { console.error('[Imaginarium] erro em "' + ev + '":', err); }
      }
    }
  }
  U.Emitter = Emitter;
  IMG.bus = new Emitter();

  /* ---------- canvas ---------- */
  U.offscreen = (function () {
    try {
      if (typeof OffscreenCanvas === 'undefined') return false;
      const c = new OffscreenCanvas(2, 2);
      return !!c.getContext('2d');
    } catch (e) { return false; }
  })();

  /** Canvas de trabalho (OffscreenCanvas quando disponível). */
  U.createCanvas = function (w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (U.offscreen) return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  };
  /** Canvas do DOM (para elementos de interface). */
  U.domCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  };
  U.cloneCanvas = function (src) {
    const c = U.createCanvas(src.width, src.height);
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  };
  U.toBlob = function (canvas, type = 'image/png', quality) {
    if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
    return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao codificar a imagem'))), type, quality));
  };
  U.loadImage = function (src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('Não foi possível ler a imagem'));
      im.src = src;
    });
  };

  /* ---------- retângulos ---------- */
  U.rect = (x, y, w, h) => ({ x, y, w, h });
  U.rectFromPoints = (x0, y0, x1, y1) => ({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) });
  U.rectUnion = function (a, b) {
    if (!a) return b ? { ...b } : null;
    if (!b) return { ...a };
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  };
  U.rectIntersect = function (a, b) {
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    const w = Math.min(a.x + a.w, b.x + b.w) - x, h = Math.min(a.y + a.h, b.y + b.h) - y;
    return w > 0 && h > 0 ? { x, y, w, h } : null;
  };
  U.rectInflate = (r, n) => ({ x: r.x - n, y: r.y - n, w: r.w + 2 * n, h: r.h + 2 * n });
  U.rectInt = function (r) {
    const x = Math.floor(r.x), y = Math.floor(r.y);
    return { x, y, w: Math.ceil(r.x + r.w) - x, h: Math.ceil(r.y + r.h) - y };
  };
  U.rectContains = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

  /* ---------- cores ---------- */
  U.hexToRgb = function (hex) {
    let h = String(hex || '#000').replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h.slice(0, 6), 16) || 0;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  U.rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  U.normHex = function (s) {
    let h = String(s || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toLowerCase() : null;
  };
  U.rgbToHsv = function (r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return { h, s: max ? d / max : 0, v: max };
  };
  U.hsvToRgb = function (h, s, v) {
    h = ((h % 360) + 360) % 360;
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  };
  U.rgba = function (hex, a = 1) { const c = U.hexToRgb(hex); return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; };
  U.luma = function (hex) { const c = U.hexToRgb(hex); return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255; };

  /* ---------- DOM ---------- */
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /**
   * Cria elementos: U.el('div.classe#id', {props}, ...filhos)
   * props: class, text, html, style, on:{evento:fn}, data:{...} e atributos/propriedades.
   */
  U.el = function (spec, props, ...kids) {
    const tag = (spec.match(/^[a-z0-9]+/i) || ['div'])[0];
    const node = document.createElement(tag);
    const id = spec.match(/#([\w-]+)/); if (id) node.id = id[1];
    const cls = spec.match(/\.[\w-]+/g); if (cls) node.className = cls.map((c) => c.slice(1)).join(' ');
    if (props != null && (props.nodeType || typeof props !== 'object' || Array.isArray(props))) { kids.unshift(props); props = null; }
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') node.className += (node.className ? ' ' : '') + v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style') { if (typeof v === 'string') node.style.cssText = v; else Object.assign(node.style, v); }
        else if (k === 'on') { for (const ev in v) node.addEventListener(ev, v[ev]); }
        else if (k === 'data') Object.assign(node.dataset, v);
        else if (k in node && k !== 'list' && k !== 'type' && k !== 'form') { try { node[k] = v; } catch (e) { node.setAttribute(k, v); } }
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    const add = (k) => {
      if (k == null || k === false) return;
      if (Array.isArray(k)) k.forEach(add);
      else node.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
    };
    kids.forEach(add);
    return node;
  };
  U.escapeHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

  /** Arraste genérico com Pointer Events. */
  U.drag = function (e, onMove, onEnd, captureOn) {
    const target = captureOn || e.currentTarget || e.target;
    const id = e.pointerId;
    try { target.setPointerCapture(id); } catch (err) { /* ignore */ }
    const move = (ev) => { if (ev.pointerId === id) onMove(ev); };
    const up = (ev) => {
      if (ev.pointerId !== id) return;
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      try { target.releasePointerCapture(id); } catch (err) { /* ignore */ }
      if (onEnd) onEnd(ev);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  /* ---------- diversos ---------- */
  U.debounce = function (fn, ms) {
    let t = 0;
    const d = function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
    d.cancel = () => clearTimeout(t);
    return d;
  };
  U.isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  U.download = function (blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = U.el('a', { href: url, download: filename, style: 'display:none' });
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
  };
  U.fmtBytes = function (n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1).replace('.', ',') + ' KB';
    return (n / 1048576).toFixed(2).replace('.', ',') + ' MB';
  };
  U.baseName = (name) => String(name || 'imagem').replace(/\.[a-z0-9]{2,5}$/i, '');
  U.safeFile = (name) => String(name || 'imagem').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'imagem';
  U.isTyping = function (t) {
    t = t || document.activeElement;
    if (!t) return false;
    const tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
  };

  U.store = {
    get(key, def) {
      try { const v = localStorage.getItem('imaginarium.' + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem('imaginarium.' + key, JSON.stringify(val)); } catch (e) { /* armazenamento indisponível */ }
    },
    del(key) { try { localStorage.removeItem('imaginarium.' + key); } catch (e) { /* ignore */ } }
  };
})();
