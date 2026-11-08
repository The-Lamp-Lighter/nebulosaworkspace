/* ==========================================================================
   Fluxo › Ondas — motor.js (1.1)
   Análise do áudio (FFT própria, sem bibliotecas) e desenho das camadas no canvas.
   Tudo roda no navegador. Este arquivo não mexe na tela: quem monta a interface é
   ui.js e quem grava o vídeo é exportar.js.

   Duas ideias importantes:
   - A análise (Analise) olha o áudio já decodificado na posição "t" e entrega números
     de 0 a 1 (graves, médios, agudos, volume, pulso de batida, espectro, onda).
   - O desenho (Cena.desenhar) usa SÓ esses números e o tempo. Por isso a prévia e o
     vídeo exportado ficam iguais: na exportação o tempo anda em passos fixos de 1/fps.
   ========================================================================== */
(function () {
  'use strict';
  var FO = window.FluxoOndas = window.FluxoOndas || {};

  var PI2 = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* ruído determinístico: mesmo número de quadro dá sempre o mesmo valor (-1…1) */
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; }

  /* ---------------------------------------------------------------- FFT */
  function fft(re, im) {
    var n = re.length, i, j = 0, bit, k, len, a, b, t;
    for (i = 1; i < n; i++) {
      bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (len = 2; len <= n; len <<= 1) {
      var ang = -PI2 / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < half; k++) {
          a = i + k; b = a + half;
          var tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          var nc = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nc;
        }
      }
    }
  }

  /* ----------------------------------------------------------- Análise */
  var NB = 128;          /* bandas do espectro (escala de graves a agudos, como o ouvido) */
  var FFT_N = 2048;
  var F_MIN = 30, F_MAX = 16000;

  function Analise(buf) {
    var ch = buf.numberOfChannels, n = buf.length, i, c;
    this.sr = buf.sampleRate; this.dur = buf.duration;
    var mono = new Float32Array(n);
    for (c = 0; c < ch; c++) {
      var d = buf.getChannelData(c);
      for (i = 0; i < n; i++) mono[i] += d[i] / ch;
    }
    this.pcm = mono;
    /* ganho automático: músicas baixinhas também ganham vida (mira num volume típico) */
    var jan = Math.max(1, Math.floor(this.sr)), rms = [];
    for (var s = 0; s < n; s += jan) {
      var e = Math.min(n, s + jan), acc = 0;
      for (i = s; i < e; i += 7) acc += mono[i] * mono[i];
      rms.push(Math.sqrt(acc / Math.max(1, (e - s) / 7)));
    }
    rms.sort(function (x, y) { return x - y; });
    var p90 = rms.length ? rms[Math.floor(rms.length * 0.9)] : 0.1;
    this.ganhoAuto = clamp(0.2 / Math.max(p90, 0.005), 0.6, 8);
    this.win = new Float32Array(FFT_N);
    for (i = 0; i < FFT_N; i++) this.win[i] = 0.5 - 0.5 * Math.cos(PI2 * i / (FFT_N - 1));
    this.re = new Float32Array(FFT_N); this.im = new Float32Array(FFT_N);
    this.bruto = new Float32Array(NB);
    this.onda = new Float32Array(512);
    /* limites (em bins) de cada banda */
    this.lim = new Float32Array(NB + 1);
    for (i = 0; i <= NB; i++) this.lim[i] = F_MIN * Math.pow(F_MAX / F_MIN, i / NB) * FFT_N / this.sr;
    this.sensib = 1;
    this.reiniciar();
  }
  Analise.prototype.reiniciar = function () {
    this.graves = this.medios = this.agudos = this.volume = this.pulso = 0;
    this.mediaG = 0.2; this.cool = 0; this.t = -1; this.pulsoNovo = false;
    this.bruto.fill(0);
  };
  Analise.prototype.passo = function (t, dt) {
    dt = clamp(dt, 1 / 240, 0.1);
    var N = FFT_N, pcm = this.pcm, sr = this.sr, ga = this.ganhoAuto * this.sensib;
    var ini = Math.floor(t * sr) - (N >> 1), i, k;
    for (i = 0; i < N; i++) {
      var p = ini + i;
      this.re[i] = (p >= 0 && p < pcm.length ? pcm[p] : 0) * this.win[i];
      this.im[i] = 0;
    }
    fft(this.re, this.im);
    var mag = this.mag || (this.mag = new Float32Array(N / 2));
    for (i = 0; i < N / 2; i++) mag[i] = Math.sqrt(this.re[i] * this.re[i] + this.im[i] * this.im[i]) / (N / 4) * ga;
    var bruto = this.bruto, lim = this.lim;
    for (var b = 0; b < NB; b++) {
      var a0 = lim[b], a1 = lim[b + 1], m;
      if (a1 - a0 < 1) {                     /* banda mais estreita que um bin: interpola */
        var c = (a0 + a1) / 2, i0 = Math.floor(c), fr = c - i0;
        m = lerp(mag[i0] || 0, mag[i0 + 1] || 0, fr);
      } else {
        m = 0;
        for (k = Math.floor(a0); k <= Math.min(N / 2 - 1, Math.ceil(a1) - 1); k++) if (mag[k] > m) m = mag[k];
      }
      var f = F_MIN * Math.pow(F_MAX / F_MIN, (b + 0.5) / NB);
      var db = 20 * Math.log10(m + 1e-5) + 3 * Math.max(0, Math.log2(f / 500));
      bruto[b] = clamp((db + 64) / 52, 0, 1);
    }
    /* forma da onda (curtinha, ao redor de t) */
    var ond = this.onda, o0 = Math.floor(t * sr) - 256;
    for (i = 0; i < 512; i++) {
      var q = o0 + i, x = (q >= 0 && q < pcm.length ? pcm[q] : 0) * this.ganhoAuto * this.sensib;
      ond[i] = Math.tanh(x * 1.4);
    }
    /* grupos de frequência: graves < 250 Hz, médios até 2 kHz, agudos acima */
    var sg = 0, sm = 0, sa = 0, ng = 44, nm = 86;
    for (b = 0; b < NB; b++) { if (b < ng) sg += bruto[b]; else if (b < nm) sm += bruto[b]; else sa += bruto[b]; }
    sg /= ng; sm /= (nm - ng); sa /= (NB - nm);
    var vol = 0; for (b = 0; b < NB; b++) vol += bruto[b]; vol /= NB;
    var at = 1 - Math.exp(-dt / 0.03), re = 1 - Math.exp(-dt / 0.16);
    this.graves += (sg - this.graves) * (sg > this.graves ? at : re);
    this.medios += (sm - this.medios) * (sm > this.medios ? at : re);
    this.agudos += (sa - this.agudos) * (sa > this.agudos ? at : re);
    this.volume += (vol - this.volume) * (vol > this.volume ? at : re);
    /* batida: graves bem acima da média recente */
    this.cool -= dt; this.pulsoNovo = false;
    if (sg > this.mediaG * 1.18 + 0.04 && sg > 0.25 && this.cool <= 0) { this.pulso = 1; this.cool = 0.16; this.pulsoNovo = true; }
    this.mediaG += (sg - this.mediaG) * (1 - Math.exp(-dt / 0.8));
    this.pulso *= Math.exp(-dt * 5);
    this.t = t;
  };
  /* valor do espectro para a barra i de n, dentro da faixa escolhida */
  var FAIXAS = { completa: [0, 108], graves: [0, 46], medios: [38, 88], agudos: [78, 124] };
  Analise.prototype.banda = function (i, n, faixa) {
    var f = FAIXAS[faixa] || FAIXAS.completa, w = (f[1] - f[0]) / n, a = f[0] + i * w, b = a + w;
    if (w <= 1) {
      var c = (a + b) / 2, i0 = Math.floor(c), fr = c - i0;
      return lerp(this.bruto[i0] || 0, this.bruto[i0 + 1] || 0, fr);
    }
    var m = 0;
    for (var k = Math.floor(a); k < Math.ceil(b) && k < NB; k++) if (this.bruto[k] > m) m = this.bruto[k];
    return m;
  };
  Analise.prototype.nivel = function (reage) {
    switch (reage) {
      case 'graves': return this.graves;
      case 'medios': return this.medios;
      case 'agudos': return this.agudos;
      case 'batida': return this.pulso;
      default: return this.volume;
    }
  };

  /* -------------------------------------------------------- Utilidades */
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    if (!r) { ctx.rect(x, y, w, h); return; }
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function hexRgb(h) {
    h = String(h || '#ffffff').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(c1, c2, t) {
    var a = hexRgb(c1), b = hexRgb(c2);
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
  }
  /* cor da camada: sólida ou degradê vertical/horizontal entre cor1 e cor2 */
  function pincel(ctx, L, x0, y0, x1, y1) {
    if (!L.grad) return L.cor1;
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, L.cor1); g.addColorStop(1, L.cor2);
    return g;
  }
  function temFiltro(ctx) { return typeof ctx.filter === 'string'; }

  /* --------------------------------------------------------- Camadas */
  var D = {};   /* desenhadores por tipo: D.tipo(ctx, L, st, an, ctxEnv) — origem no centro da camada */

  D.barras = function (c, L, st, an, e) {
    var n = L.n | 0, W = e.W / e.u, tot = L.largTotal * W, bw = tot / n, gap = bw * (1 - L.larg), i;
    if (!st.s || st.s.length !== n) st.s = new Float32Array(n);
    var rel = 1 - Math.exp(-e.dt / (0.02 + L.suavizacao * 0.35)), atk = 1 - Math.exp(-e.dt / 0.014);
    var simetria = L.simetria;
    c.fillStyle = pincel(c, L, 0, 0, 0, -L.altMax);
    for (i = 0; i < n; i++) {
      var idx = simetria ? Math.abs(i - (n - 1) / 2) / ((n - 1) / 2) * (n - 1) : i;
      var v = clamp(an.banda(Math.min(n - 1, Math.round(idx)), n, L.faixa) * L.ganho, 0, 1.2);
      st.s[i] += (v - st.s[i]) * (v > st.s[i] ? atk : rel);
      var h = Math.max(L.minAlt, Math.pow(st.s[i], L.curva) * L.altMax), x = -tot / 2 + i * bw + gap / 2, w = Math.max(1, bw - gap);
      if (L.direcao === 'centro') rr(c, x, -h / 2, w, h, L.arred * w / 2);
      else if (L.direcao === 'cima') rr(c, x, 0, w, h, L.arred * w / 2);
      else rr(c, x, -h, w, h, L.arred * w / 2);
      c.fill();
    }
  };

  D.linha = function (c, L, st, an, e) {
    var W = e.W / e.u, tot = L.largTotal * W, n = L.pontos | 0, i, pts = new Array(n);
    if (!st.s || st.s.length !== n) st.s = new Float32Array(n);
    var rel = 1 - Math.exp(-e.dt / (0.02 + L.suavizacao * 0.35)), atk = 1 - Math.exp(-e.dt / 0.02);
    for (i = 0; i < n; i++) {
      var v;
      if (L.modo === 'espectro') v = clamp(an.banda(i, n, L.faixa) * L.ganho, 0, 1.2) * 2 - 0.0;
      else v = an.onda[Math.floor(i / (n - 1) * 511)] * L.ganho * 1.6;
      var alvo = L.modo === 'espectro' ? v * 0.5 : v;
      st.s[i] += (alvo - st.s[i]) * (Math.abs(alvo) > Math.abs(st.s[i]) ? atk : rel);
      pts[i] = [-tot / 2 + i / (n - 1) * tot, -st.s[i] * L.altMax * (L.modo === 'espectro' ? 1 : 0.5)];
    }
    function trilha(sinal) {
      c.beginPath();
      c.moveTo(pts[0][0], sinal * pts[0][1]);
      for (var j = 1; j < n - 1; j++) {
        var mx = (pts[j][0] + pts[j + 1][0]) / 2, my = sinal * (pts[j][1] + pts[j + 1][1]) / 2;
        if (L.suave) c.quadraticCurveTo(pts[j][0], sinal * pts[j][1], mx, my); else c.lineTo(pts[j][0], sinal * pts[j][1]);
      }
      c.lineTo(pts[n - 1][0], sinal * pts[n - 1][1]);
    }
    c.lineWidth = L.espessura; c.lineJoin = c.lineCap = 'round';
    c.strokeStyle = pincel(c, L, -tot / 2, 0, tot / 2, 0); c.fillStyle = c.strokeStyle;
    var vezes = L.espelho ? [1, -1] : [1];
    for (var q = 0; q < vezes.length; q++) {
      trilha(vezes[q]);
      if (L.preencher) {
        var gl = c.globalAlpha; c.globalAlpha = gl * 0.35;
        c.lineTo(tot / 2, 0); c.lineTo(-tot / 2, 0); c.closePath(); c.fill(); c.globalAlpha = gl;
        trilha(vezes[q]);
      }
      c.stroke();
    }
  };

  D.circulo = function (c, L, st, an, e) {
    var n = L.n | 0, i, nv = clamp(an.nivel(L.reage) * L.ganho, 0, 1.4);
    if (!st.s || st.s.length !== n) st.s = new Float32Array(n);
    var rel = 1 - Math.exp(-e.dt / (0.02 + L.suavizacao * 0.35)), atk = 1 - Math.exp(-e.dt / 0.014);
    st.rot = (st.rot || 0) + L.giro * e.dt;
    var r0 = L.raio * (1 + nv * L.pulsoRaio), half = n >> 1, pos = [];
    c.rotate(st.rot * Math.PI / 180);
    for (i = 0; i < n; i++) {
      /* espelha a metade do círculo para as pontas se encontrarem sem emenda */
      var idx = i <= half ? i : n - i, v = clamp(an.banda(Math.min(half, idx) % (half + 1), half + 1, L.faixa) * L.ganho, 0, 1.2);
      st.s[i] += (v - st.s[i]) * (v > st.s[i] ? atk : rel);
      var a = i / n * PI2 - Math.PI / 2, h = Math.max(L.minAlt, Math.pow(st.s[i], L.curva) * L.altMax);
      pos.push([a, h]);
    }
    c.strokeStyle = pincel(c, L, -r0, -r0, r0, r0); c.fillStyle = c.strokeStyle;
    c.lineWidth = L.espessura; c.lineCap = 'round'; c.lineJoin = 'round';
    if (L.estilo === 'barras') {
      for (i = 0; i < n; i++) {
        var a2 = pos[i][0], h2 = pos[i][1], ca = Math.cos(a2), sa = Math.sin(a2), ri = L.dentro ? r0 - h2 : r0;
        c.beginPath(); c.moveTo(ca * ri, sa * ri); c.lineTo(ca * (ri + h2), sa * (ri + h2)); c.stroke();
      }
    } else if (L.estilo === 'pontos') {
      for (i = 0; i < n; i++) {
        var rr0 = r0 + (L.dentro ? -pos[i][1] : pos[i][1]);
        c.beginPath(); c.arc(Math.cos(pos[i][0]) * rr0, Math.sin(pos[i][0]) * rr0, Math.max(1, L.espessura * 0.9), 0, PI2); c.fill();
      }
    } else {
      c.beginPath();
      for (i = 0; i <= n; i++) {
        var p = pos[i % n], rj = r0 + (L.dentro ? -p[1] : p[1]);
        var px = Math.cos(p[0]) * rj, py = Math.sin(p[0]) * rj;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath(); if (L.preencher) { var ga = c.globalAlpha; c.globalAlpha = ga * 0.3; c.fill(); c.globalAlpha = ga; } c.stroke();
    }
  };

  D.pontos = function (c, L, st, an, e) {
    var cols = L.n | 0, rows = L.linhas | 0, W = e.W / e.u, tot = L.largTotal * W, cw = tot / cols, ch = L.altMax / rows, r = Math.min(cw, ch) * 0.5 * L.larg, i, j;
    if (!st.s || st.s.length !== cols) st.s = new Float32Array(cols);
    var rel = 1 - Math.exp(-e.dt / (0.03 + L.suavizacao * 0.35)), atk = 1 - Math.exp(-e.dt / 0.016);
    for (i = 0; i < cols; i++) {
      var v = clamp(an.banda(i, cols, L.faixa) * L.ganho, 0, 1.2);
      st.s[i] += (v - st.s[i]) * (v > st.s[i] ? atk : rel);
      var acesas = Math.round(Math.min(1, st.s[i]) * rows);
      for (j = 0; j < rows; j++) {
        var on = j < acesas, x = -tot / 2 + (i + 0.5) * cw, y = -(j + 0.5) * ch;
        c.globalAlpha = on ? 1 : 0.12;
        c.fillStyle = L.grad ? mix(L.cor1, L.cor2, j / Math.max(1, rows - 1)) : L.cor1;
        c.beginPath(); c.arc(x, y, Math.max(0.6, r), 0, PI2); c.fill();
      }
    }
    c.globalAlpha = 1;
  };

  D.aneis = function (c, L, st, an, e) {
    st.an = st.an || [];
    if (an.pulsoNovo && an.t !== st.ultimo) { st.an.push({ r: L.raio, a: 1 }); st.ultimo = an.t; }
    var nv = clamp(an.nivel(L.reage) * L.ganho, 0, 1.4), i;
    c.strokeStyle = pincel(c, L, -L.raio, -L.raio, L.raio, L.raio);
    c.lineWidth = L.espessura;
    if (L.base) { c.globalAlpha *= 0.9; c.beginPath(); c.arc(0, 0, L.raio * (1 + nv * 0.25), 0, PI2); c.stroke(); c.globalAlpha /= 0.9; }
    for (i = st.an.length - 1; i >= 0; i--) {
      var a = st.an[i]; a.r += L.velocidade * e.dt; a.a -= e.dt / L.vida;
      if (a.a <= 0) { st.an.splice(i, 1); continue; }
      var ga = c.globalAlpha; c.globalAlpha = ga * a.a; c.lineWidth = L.espessura * (0.4 + a.a * 0.8);
      c.beginPath(); c.arc(0, 0, a.r, 0, PI2); c.stroke(); c.globalAlpha = ga;
    }
  };

  function forma(c, tipo, x, y, r, rot) {
    if (tipo === 'quadrado') { c.save(); c.translate(x, y); c.rotate(rot); c.fillRect(-r, -r, r * 2, r * 2); c.restore(); return; }
    if (tipo === 'estrela') {
      c.beginPath();
      for (var i = 0; i < 10; i++) { var rad = i % 2 ? r * 0.45 : r * 1.2, a = rot + i * Math.PI / 5 - Math.PI / 2; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
      c.closePath(); c.fill(); return;
    }
    if (tipo === 'faisca') {
      c.save(); c.translate(x, y); c.rotate(rot); c.beginPath(); c.ellipse(0, 0, r * 2.4, r * 0.45, 0, 0, PI2); c.fill(); c.restore(); return;
    }
    c.beginPath(); c.arc(x, y, r, 0, PI2); c.fill();
  }
  /* partículas: ficam em coordenadas absolutas da cena (já em unidades u); a origem é o centro da camada */
  D.particulas = function (c, L, st, an, e) {
    st.p = st.p || []; st.rng = st.rng || mulberry(L._semente || 7); st.acu = st.acu || 0;
    var rnd = st.rng, P = st.p, nv = clamp(an.nivel(L.reage) * L.ganho, 0, 1.4), W = e.W / e.u, H = e.H / e.u, i;
    st.acu += L.taxa * (1 + nv * L.reagente * 3) * e.dt;
    var novas = Math.floor(st.acu); st.acu -= novas;
    if (an.pulsoNovo && an.t !== st.ultimo) { novas += Math.round(L.rajada); st.ultimo = an.t; }
    for (i = 0; i < novas && P.length < 1800; i++) {
      var a, sp = L.velocidade * (0.5 + rnd()), p = { t: 0, vida: L.vida * (0.6 + rnd() * 0.8), s: L.tamanho * (0.5 + rnd()), k: rnd(), r: rnd() * PI2 };
      if (L.emissor === 'baixo') { p.x = (rnd() - 0.5) * W * 0.9; p.y = H / 2 - L.origemY * 0 + 10; a = -Math.PI / 2 + (rnd() - 0.5) * 0.9; }
      else if (L.emissor === 'tela') { p.x = (rnd() - 0.5) * W; p.y = (rnd() - 0.5) * H; a = rnd() * PI2; sp *= 0.25; }
      else if (L.emissor === 'anel') { a = rnd() * PI2; p.x = Math.cos(a) * L.raio; p.y = Math.sin(a) * L.raio; }
      else { a = rnd() * PI2; p.x = 0; p.y = 0; }
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      P.push(p);
    }
    c.globalCompositeOperation = c.globalCompositeOperation; /* mantém a mistura da camada */
    for (i = P.length - 1; i >= 0; i--) {
      var q = P[i]; q.t += e.dt;
      if (q.t >= q.vida) { P.splice(i, 1); continue; }
      q.vy += L.gravidade * e.dt; q.vx *= (1 - 0.35 * e.dt); q.vy *= (1 - 0.35 * e.dt);
      q.x += q.vx * e.dt * (1 + nv * L.reagente); q.y += q.vy * e.dt * (1 + nv * L.reagente);
      var f = q.t / q.vida, ga = c.globalAlpha;
      c.globalAlpha = ga * Math.sin(Math.min(1, f * 4) * Math.PI / 2) * (1 - f) * 0.95;
      c.fillStyle = L.grad ? mix(L.cor1, L.cor2, q.k) : L.cor1;
      forma(c, L.forma, q.x, q.y, Math.max(0.5, q.s * (1 + nv * L.reagente * 0.8) * (1 - f * 0.5)), q.r + q.t * 2);
      c.globalAlpha = ga;
    }
  };

  D.texto = function (c, L, st, an, e) {
    var nv = clamp(an.nivel(L.reage) * L.ganho, 0, 1.4), s = 1 + nv * L.pulsa;
    var linhas = String(L.texto || '').split('\n'), tam = L.tamanho * s;
    c.font = (L.italico ? 'italic ' : '') + L.peso + ' ' + tam + 'px ' + L.fonte;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    var ox = hash(Math.floor(e.t * 30) * 3.1) * L.vibra * nv * 10, oy = hash(Math.floor(e.t * 30) * 5.7 + 9) * L.vibra * nv * 10;
    var gl = L.letra * tam / 100;
    if (gl && 'letterSpacing' in c) c.letterSpacing = gl + 'px';
    var hh = tam * 1.2, y0 = -(linhas.length - 1) * hh / 2;
    for (var i = 0; i < linhas.length; i++) {
      if (L.contorno > 0) { c.lineWidth = L.contorno; c.strokeStyle = L.cor2; c.lineJoin = 'round'; c.strokeText(linhas[i], ox, y0 + i * hh + oy); }
      c.fillStyle = L.cor1; c.fillText(linhas[i], ox, y0 + i * hh + oy);
    }
    if ('letterSpacing' in c) c.letterSpacing = '0px';
  };

  D.imagem = function (c, L, st, an, e) {
    if (!st.img) return;
    var im = st.img, nv = clamp(an.nivel(L.reage) * L.ganho, 0, 1.4), s = 1 + nv * L.pulsa;
    var iw = im.width, ih = im.height, base = L.tamanho * s, w, h;
    if (L.circular) { w = h = base; } else { var r = iw / ih; if (r >= 1) { w = base; h = base / r; } else { h = base; w = base * r; } }
    c.save();
    if (L.circular) { c.beginPath(); c.arc(0, 0, base / 2, 0, PI2); c.clip(); var sc = Math.max(base / iw, base / ih); c.drawImage(im, -iw * sc / 2, -ih * sc / 2, iw * sc, ih * sc); }
    else if (L.arred > 0) { rr(c, -w / 2, -h / 2, w, h, L.arred * Math.min(w, h) / 2); c.clip(); c.drawImage(im, -w / 2, -h / 2, w, h); }
    else c.drawImage(im, -w / 2, -h / 2, w, h);
    c.restore();
    if (L.borda > 0) {
      c.strokeStyle = L.cor1; c.lineWidth = L.borda;
      if (L.circular) { c.beginPath(); c.arc(0, 0, base / 2 + L.borda / 2, 0, PI2); c.stroke(); }
      else { rr(c, -w / 2, -h / 2, w, h, L.arred * Math.min(w, h) / 2); c.stroke(); }
    }
  };

  D.progresso = function (c, L, st, an, e) {
    var W = e.W / e.u, tot = L.largTotal * W, f = clamp(e.t / Math.max(0.01, e.dur), 0, 1);
    if (L.estilo !== 'tempo') {
      c.fillStyle = L.cor2; c.globalAlpha *= 0.35; rr(c, -tot / 2, -L.espessura / 2, tot, L.espessura, L.espessura / 2); c.fill(); c.globalAlpha /= 0.35;
      c.fillStyle = L.cor1; rr(c, -tot / 2, -L.espessura / 2, Math.max(L.espessura, tot * f), L.espessura, L.espessura / 2); c.fill();
    }
    if (L.estilo !== 'barra') {
      var mm = function (s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };
      c.fillStyle = L.cor1; c.font = '600 ' + L.tamanho + 'px ' + L.fonte; c.textBaseline = 'middle';
      var y = L.estilo === 'tempo' ? 0 : L.espessura + L.tamanho * 0.9;
      if (L.estilo === 'tempo') { c.textAlign = 'center'; c.fillText(mm(e.t) + ' / ' + mm(e.dur), 0, y); }
      else { c.textAlign = 'left'; c.fillText(mm(e.t), -tot / 2, y); c.textAlign = 'right'; c.fillText(mm(e.dur), tot / 2, y); }
    }
  };

  /* ------------------------------------------------------------ Cena */
  var TIPOS = ['barras', 'linha', 'circulo', 'pontos', 'aneis', 'particulas', 'texto', 'imagem', 'progresso'];

  function comum(o) {
    return Object.assign({ visivel: true, x: 0.5, y: 0.5, escala: 1, rotacao: 0, opacidade: 1, mistura: 'source-over', cor1: '#ffffff', cor2: '#a778ff', grad: false, reage: 'tudo', ganho: 1, suavizacao: 0.3, brilho: 0 }, o);
  }
  var PADRAO = {
    barras: function () { return comum({ nome: 'Barras', y: 0.78, n: 48, larg: 0.7, arred: 1, altMax: 380, minAlt: 6, largTotal: 0.7, direcao: 'baixo', simetria: false, faixa: 'completa', curva: 1, cor1: '#a778ff', cor2: '#ff9c54', grad: true, brilho: 14 }); },
    linha: function () { return comum({ nome: 'Onda', y: 0.5, modo: 'onda', largTotal: 0.8, altMax: 300, espessura: 5, pontos: 160, suave: true, preencher: false, espelho: false, faixa: 'completa', cor1: '#7dd3fc', cor2: '#a778ff', grad: true, brilho: 18, ganho: 1.2 }); },
    circulo: function () { return comum({ nome: 'Círculo', n: 96, raio: 230, altMax: 170, minAlt: 5, estilo: 'barras', espessura: 5, giro: 12, pulsoRaio: 0.08, dentro: false, preencher: false, curva: 1, faixa: 'completa', cor1: '#ff9c54', cor2: '#feff36', grad: true, brilho: 16, reage: 'graves' }); },
    pontos: function () { return comum({ nome: 'Pontos', y: 0.75, n: 40, linhas: 12, larg: 0.8, altMax: 330, largTotal: 0.7, faixa: 'completa', cor1: '#38bdf8', cor2: '#f472b6', grad: true, brilho: 10 }); },
    aneis: function () { return comum({ nome: 'Anéis de batida', raio: 140, velocidade: 520, vida: 1.1, espessura: 6, base: true, reage: 'batida', cor1: '#ffffff', cor2: '#a778ff', brilho: 12 }); },
    particulas: function () { return comum({ nome: 'Partículas', x: 0.5, y: 0.5, taxa: 70, rajada: 26, tamanho: 6, velocidade: 150, vida: 3, gravidade: -10, forma: 'circulo', emissor: 'centro', raio: 230, reagente: 1, reage: 'graves', mistura: 'lighter', cor1: '#feff36', cor2: '#ff9c54', grad: true, brilho: 8 }); },
    texto: function () { return comum({ nome: 'Título', y: 0.15, texto: 'Minha música', tamanho: 84, peso: 800, italico: false, fonte: 'Inter, "Segoe UI", Arial, sans-serif', letra: 4, contorno: 0, pulsa: 0.08, vibra: 0, reage: 'graves', cor1: '#ffffff', cor2: '#000000' }); },
    imagem: function () { return comum({ nome: 'Imagem', tamanho: 340, circular: true, arred: 0.1, borda: 8, pulsa: 0.06, reage: 'graves', cor1: '#ffffff', arquivo: '' }); },
    progresso: function () { return comum({ nome: 'Progresso', y: 0.93, largTotal: 0.7, espessura: 8, estilo: 'barra', tamanho: 30, fonte: 'Inter, "Segoe UI", Arial, sans-serif', cor1: '#ffffff', cor2: '#ffffff' }); }
  };
  var NOMES = { barras: 'Barras', linha: 'Linha de onda', circulo: 'Círculo', pontos: 'Equalizador de pontos', aneis: 'Anéis de batida', particulas: 'Partículas', texto: 'Texto', imagem: 'Imagem', progresso: 'Progresso' };

  function cenaVazia() {
    return {
      versao: 1, larg: 1920, alt: 1080, fps: 30,
      fundo: { tipo: 'gradiente', cor1: '#14102a', cor2: '#2b1d57', angulo: 160, imagem: '', escurecer: 0.35, desfoque: 0, zoomBatida: 0.04 },
      fx: {
        vibracao: { on: false, forca: 10, rot: 0.4, reage: 'graves' },
        zoom: { on: false, forca: 0.05, reage: 'graves' },
        rgb: { on: false, forca: 8, reage: 'batida' },
        glitch: { on: false, forca: 0.6 },
        brilho: { on: false, forca: 0.6, raio: 24 },
        vinheta: { on: false, forca: 0.55 },
        granulado: { on: false, forca: 0.12 },
        flash: { on: false, forca: 0.25, reage: 'batida' },
        espelho: 'nenhum', matiz: 0
      },
      camadas: []
    };
  }
  var _id = 1;
  function novaCamada(tipo, extra) {
    var L = PADRAO[tipo](); L.id = 'c' + Date.now().toString(36) + (_id++); L.tipo = tipo;
    return Object.assign(L, extra || {});
  }

  /* Renderizador: guarda os estados (partículas, suavização…) por camada. */
  function Render() {
    this.est = {}; this.imgs = {}; this.bgImg = null; this.A = null; this.B = null; this.C = null;
  }
  /* zera partículas e suavizações, mas mantém as imagens já carregadas */
  Render.prototype.reiniciar = function () {
    var novo = {}, k;
    for (k in this.est) if (this.est[k] && this.est[k].img !== undefined) novo[k] = { img: this.est[k].img, fonte: this.est[k].fonte };
    this.est = novo;
  };
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  Render.prototype.fundo = function (c, cena, an, e) {
    var f = cena.fundo, W = e.W, H = e.H, ang;
    if (f.tipo === 'gradiente' || f.tipo === 'radial') {
      var g;
      if (f.tipo === 'radial') g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
      else { ang = f.angulo * Math.PI / 180; var dx = Math.sin(ang), dy = -Math.cos(ang), r = Math.abs(dx * W) / 2 + Math.abs(dy * H) / 2; g = c.createLinearGradient(W / 2 - dx * r, H / 2 - dy * r, W / 2 + dx * r, H / 2 + dy * r); }
      g.addColorStop(0, f.cor1); g.addColorStop(1, f.cor2); c.fillStyle = g;
    } else c.fillStyle = f.cor1;
    c.fillRect(0, 0, W, H);
    if (f.tipo === 'imagem' && this.bgImg) {
      var im = this.bgImg, z = 1 + an.pulso * f.zoomBatida, sc = Math.max(W / im.width, H / im.height) * z, w = im.width * sc, h = im.height * sc;
      c.save();
      if (f.desfoque > 0 && temFiltro(c)) c.filter = 'blur(' + Math.round(f.desfoque * e.u) + 'px)';
      c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); c.restore();
      if (f.escurecer > 0) { c.fillStyle = 'rgba(0,0,0,' + f.escurecer + ')'; c.fillRect(0, 0, W, H); }
    }
  };

  /* desenha tudo em "out" (um contexto 2D de W×H). e = {W,H,t,dt,dur} */
  Render.prototype.desenhar = function (out, cena, an, e) {
    var W = e.W, H = e.H; e.u = Math.min(W, H) / 1080;
    if (!this.A || this.A.width !== W || this.A.height !== H) { this.A = cv(W, H); this.B = cv(W, H); this.C = cv(W, H); }
    var a = this.A.getContext('2d'), fx = cena.fx, i, u = e.u;
    a.setTransform(1, 0, 0, 1, 0, 0); a.globalAlpha = 1; a.globalCompositeOperation = 'source-over'; a.filter = 'none';
    this.fundo(a, cena, an, e);
    for (i = 0; i < cena.camadas.length; i++) {
      var L = cena.camadas[i]; if (!L.visivel) continue;
      var st = this.est[L.id] || (this.est[L.id] = {});
      if (L.tipo === 'imagem') this.carregarImg(L, st);
      a.save();
      a.globalAlpha = L.opacidade; a.globalCompositeOperation = L.mistura || 'source-over';
      a.translate(L.x * W, L.y * H); a.rotate(L.rotacao * Math.PI / 180); a.scale(L.escala * u, L.escala * u);
      if (L.brilho > 0) { a.shadowBlur = L.brilho * u; a.shadowColor = L.cor1; }
      if (L.tipo === 'particulas') { a.scale(1 / L.escala, 1 / L.escala); a.rotate(-L.rotacao * Math.PI / 180); }
      D[L.tipo](a, L, st, an, e);
      a.restore();
    }
    this.pos(out, cena, an, e);
  };
  Render.prototype.carregarImg = function (L, st) {
    if (!L.arquivo) { st.img = null; st.fonte = ''; return; }
    if (st.fonte === L.arquivo) return;
    st.fonte = L.arquivo; st.img = null;
    var im = new Image(); im.onload = function () { if (st.fonte === L.arquivo) st.img = im; }; im.src = L.arquivo;
  };
  Render.prototype.definirFundoImagem = function (url) {
    var self = this; this.bgImg = null; if (!url) return;
    var im = new Image(); im.onload = function () { self.bgImg = im; }; im.src = url;
  };

  /* efeitos de tela cheia: tremida, zoom, espelho, glitch, RGB, brilho, vinheta, granulado, flash */
  Render.prototype.pos = function (out, cena, an, e) {
    var W = e.W, H = e.H, u = e.u, fx = cena.fx, A = this.A, B = this.B, b = B.getContext('2d'), frame = Math.floor(e.t * 30);
    var nv = function (r) { return an.nivel(r); };
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; b.filter = 'none';
    b.clearRect(0, 0, W, H);
    /* 1) câmera: tremida + zoom + leve giro, tudo vindo do áudio */
    var dx = 0, dy = 0, rot = 0, z = 1;
    if (fx.vibracao.on) { var v = nv(fx.vibracao.reage); dx = hash(frame * 1.7) * fx.vibracao.forca * u * v; dy = hash(frame * 2.9 + 4) * fx.vibracao.forca * u * v; rot = hash(frame * 3.3 + 8) * fx.vibracao.rot * v * Math.PI / 180; }
    if (fx.zoom.on) z += nv(fx.zoom.reage) * fx.zoom.forca;
    var mover = dx || dy || rot || z !== 1;
    if (fx.vibracao.on || fx.zoom.on) z *= 1.0 + (fx.vibracao.on ? 0.012 : 0);   /* esconde as bordas na tremida */
    b.save(); b.translate(W / 2 + dx, H / 2 + dy); b.rotate(rot); b.scale(z, z); b.drawImage(A, -W / 2, -H / 2); b.restore();
    /* 2) espelho */
    if (fx.espelho && fx.espelho !== 'nenhum') {
      var cc = this.C.getContext('2d'); cc.setTransform(1, 0, 0, 1, 0, 0); cc.clearRect(0, 0, W, H); cc.drawImage(B, 0, 0);
      b.save();
      if (fx.espelho === 'h' || fx.espelho === 'quad') { b.beginPath(); b.rect(W / 2, 0, W / 2, H); b.clip(); b.translate(W, 0); b.scale(-1, 1); b.drawImage(this.C, 0, 0); }
      b.restore(); b.save();
      if (fx.espelho === 'v' || fx.espelho === 'quad') { cc.drawImage(B, 0, 0); b.beginPath(); b.rect(0, H / 2, W, H / 2); b.clip(); b.translate(0, H); b.scale(1, -1); b.drawImage(this.C, 0, 0); }
      b.restore();
    }
    /* 3) glitch: faixas deslocadas no ritmo da batida */
    if (fx.glitch.on && an.pulso > 0.25) {
      var cg = this.C.getContext('2d'); cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, W, H); cg.drawImage(B, 0, 0);
      var nf = Math.round(3 + 6 * fx.glitch.forca * an.pulso);
      for (var s = 0; s < nf; s++) {
        var sy = Math.floor((hash(frame * 5.1 + s * 7.3) * 0.5 + 0.5) * H), sh = Math.max(2, Math.floor((hash(frame * 2.1 + s) * 0.5 + 0.5) * H * 0.07)), off = hash(frame * 9.7 + s * 3.1) * W * 0.06 * fx.glitch.forca * an.pulso;
        b.clearRect(0, sy, W, sh); b.drawImage(this.C, 0, sy, W, sh, off, sy, W, sh);
      }
    }
    /* 4) divisão RGB (aberração cromática) */
    if (fx.rgb.on) {
      var off2 = Math.max(0.5, fx.rgb.forca * u * (0.25 + nv(fx.rgb.reage))), t = this.C, ct = t.getContext('2d');
      var cores = [['#ff0000', -off2], ['#00ff00', 0], ['#0000ff', off2]];
      var base = this.est.__rgb || (this.est.__rgb = cv(W, H));
      if (base.width !== W || base.height !== H) { base.width = W; base.height = H; }
      var cb = base.getContext('2d'); cb.setTransform(1, 0, 0, 1, 0, 0); cb.clearRect(0, 0, W, H); cb.drawImage(B, 0, 0);
      b.clearRect(0, 0, W, H); b.fillStyle = '#000'; b.fillRect(0, 0, W, H); b.globalCompositeOperation = 'lighter';
      for (var k = 0; k < 3; k++) {
        ct.setTransform(1, 0, 0, 1, 0, 0); ct.globalCompositeOperation = 'source-over'; ct.clearRect(0, 0, W, H); ct.drawImage(base, 0, 0);
        ct.globalCompositeOperation = 'multiply'; ct.fillStyle = cores[k][0]; ct.fillRect(0, 0, W, H);
        b.drawImage(t, cores[k][1], 0);
      }
      b.globalCompositeOperation = 'source-over';
    }
    /* 5) brilho (bloom): uma cópia borrada somada por cima */
    if (fx.brilho.on && temFiltro(b)) {
      b.save(); b.globalCompositeOperation = 'lighter'; b.globalAlpha = clamp(fx.brilho.forca * (0.7 + an.volume * 0.8), 0, 1.4);
      b.filter = 'blur(' + Math.max(1, Math.round(fx.brilho.raio * u)) + 'px)'; b.drawImage(B, 0, 0); b.restore();
    }
    /* 6) vinheta, flash, granulado */
    if (fx.vinheta.on) {
      var vg = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + clamp(fx.vinheta.forca, 0, 1) + ')'); b.fillStyle = vg; b.fillRect(0, 0, W, H);
    }
    if (fx.flash.on) { b.fillStyle = 'rgba(255,255,255,' + clamp(nv(fx.flash.reage) * fx.flash.forca, 0, 0.9) + ')'; b.fillRect(0, 0, W, H); }
    if (fx.granulado.on) {
      if (!FO._ruido) { var rc = cv(256, 256), rx = rc.getContext('2d'), id = rx.createImageData(256, 256), rg = mulberry(5); for (var q = 0; q < id.data.length; q += 4) { var g = rg() * 255; id.data[q] = id.data[q + 1] = id.data[q + 2] = g; id.data[q + 3] = 255; } rx.putImageData(id, 0, 0); FO._ruido = rc; }
      b.save(); b.globalAlpha = clamp(fx.granulado.forca, 0, 1) * 0.5; b.globalCompositeOperation = 'overlay';
      var ox = Math.floor((hash(frame * 1.3) * 0.5 + 0.5) * 256), oy = Math.floor((hash(frame * 4.1) * 0.5 + 0.5) * 256);
      for (var gx = -ox; gx < W; gx += 256) for (var gy = -oy; gy < H; gy += 256) b.drawImage(FO._ruido, gx, gy);
      b.restore();
    }
    /* 7) saída (com giro de cor opcional) */
    out.save(); out.setTransform(1, 0, 0, 1, 0, 0); out.globalAlpha = 1; out.globalCompositeOperation = 'source-over';
    if (fx.matiz && temFiltro(out)) out.filter = 'hue-rotate(' + ((fx.matiz * e.t) % 360).toFixed(1) + 'deg)';
    out.drawImage(B, 0, 0); out.restore();
  };

  FO.motor = { Analise: Analise, Render: Render, PADRAO: PADRAO, NOMES: NOMES, TIPOS: TIPOS, cenaVazia: cenaVazia, novaCamada: novaCamada, clamp: clamp, FAIXAS: FAIXAS };
})();
