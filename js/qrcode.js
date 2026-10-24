/* ==========================================================================
   Nebulosa Workspace — js/qrcode.js
   Gerador de QR Code feito aqui mesmo, sem biblioteca nem serviço externo:
   o texto (por exemplo, o Pix Copia e Cola) nunca sai do navegador e o QR
   aparece mesmo sem internet.

   Segue a norma ISO/IEC 18004 (modo byte, UTF-8): escolhe a menor versão que
   cabe, calcula a correção de erros Reed-Solomon e a melhor máscara.
   Algoritmo baseado na biblioteca de referência "QR Code generator" de
   Project Nayuki (licença MIT).

   Uso:
     NebulosaQR.svg('texto', { nivel: 'M', borda: 4, escuro: '#000', claro: '#fff' })
       → texto de um <svg> pronto para colocar na página
   ========================================================================== */
(function () {
  'use strict';

  // Níveis de correção: L (7%), M (15%), Q (25%), H (30%)
  const NIVEIS = { L: { ord: 0, bits: 1 }, M: { ord: 1, bits: 0 }, Q: { ord: 2, bits: 3 }, H: { ord: 3, bits: 2 } };

  // Tabelas da norma, por nível e versão (o índice 0 não é usado)
  const ECC_POR_BLOCO = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  ];
  const NUM_BLOCOS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  ];

  const bit = (x, i) => ((x >>> i) & 1) !== 0;

  function modulosBrutos(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  const codewordsDeDados = (ver, ord) => Math.floor(modulosBrutos(ver) / 8) - ECC_POR_BLOCO[ord][ver] * NUM_BLOCOS[ord][ver];

  /* ---------- Reed-Solomon sobre GF(256) ---------- */
  function multiplicar(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  function divisorRS(grau) {
    const r = new Array(grau).fill(0);
    r[grau - 1] = 1;
    let raiz = 1;
    for (let i = 0; i < grau; i++) {
      for (let j = 0; j < r.length; j++) {
        r[j] = multiplicar(r[j], raiz);
        if (j + 1 < r.length) r[j] ^= r[j + 1];
      }
      raiz = multiplicar(raiz, 0x02);
    }
    return r;
  }
  function restoRS(dados, divisor) {
    const r = divisor.map(() => 0);
    for (const b of dados) {
      const fator = b ^ r.shift();
      r.push(0);
      divisor.forEach((coef, i) => { r[i] ^= multiplicar(coef, fator); });
    }
    return r;
  }

  /* ---------- montagem do símbolo ---------- */
  function gerar(texto, nivel) {
    const N = NIVEIS[nivel] || NIVEIS.M;
    const bytes = Array.from(new TextEncoder().encode(String(texto)));

    // 1) menor versão em que os dados cabem
    let ver;
    for (ver = 1; ; ver++) {
      if (ver > 40) throw new Error('Texto longo demais para um QR Code.');
      const bitsContagem = ver <= 9 ? 8 : 16;
      if (4 + bitsContagem + bytes.length * 8 <= codewordsDeDados(ver, N.ord) * 8) break;
    }

    // 2) sequência de bits: modo byte (0100), tamanho, dados, terminador e enchimento
    const bits = [];
    const anexar = (valor, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1); };
    anexar(0x4, 4);
    anexar(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach(b => anexar(b, 8));
    const capacidade = codewordsDeDados(ver, N.ord) * 8;
    anexar(0, Math.min(4, capacidade - bits.length));
    anexar(0, (8 - bits.length % 8) % 8);
    for (let p = 0xEC; bits.length < capacidade; p ^= 0xEC ^ 0x11) anexar(p, 8);
    const dados = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      dados.push(b);
    }

    // 3) correção de erros e intercalação dos blocos
    const nBlocos = NUM_BLOCOS[N.ord][ver], eccLen = ECC_POR_BLOCO[N.ord][ver];
    const total = Math.floor(modulosBrutos(ver) / 8);
    const curtos = nBlocos - total % nBlocos, lenCurto = Math.floor(total / nBlocos);
    const divisor = divisorRS(eccLen), blocos = [];
    for (let i = 0, k = 0; i < nBlocos; i++) {
      const d = dados.slice(k, k + lenCurto - eccLen + (i < curtos ? 0 : 1));
      k += d.length;
      const ecc = restoRS(d, divisor);
      if (i < curtos) d.push(0);
      blocos.push(d.concat(ecc));
    }
    const final = [];
    for (let i = 0; i < blocos[0].length; i++) {
      blocos.forEach((b, j) => { if (i !== lenCurto - eccLen || j >= curtos) final.push(b[i]); });
    }

    // 4) desenho
    const tam = ver * 4 + 17;
    const m = Array.from({ length: tam }, () => new Array(tam).fill(false));
    const fixo = Array.from({ length: tam }, () => new Array(tam).fill(false));
    const marcar = (x, y, escuro) => { m[y][x] = escuro; fixo[y][x] = true; };

    for (let i = 0; i < tam; i++) { marcar(6, i, i % 2 === 0); marcar(i, 6, i % 2 === 0); }
    const localizador = (x, y) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < tam && yy >= 0 && yy < tam) marcar(xx, yy, d !== 2 && d !== 4);
      }
    };
    localizador(3, 3); localizador(tam - 4, 3); localizador(3, tam - 4);

    const posAlinh = [];
    if (ver > 1) {
      const n = Math.floor(ver / 7) + 2;
      const passo = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
      posAlinh.push(6);
      for (let p = tam - 7; posAlinh.length < n; p -= passo) posAlinh.splice(1, 0, p);
    }
    posAlinh.forEach((a, i) => posAlinh.forEach((b, j) => {
      const ult = posAlinh.length - 1;
      if ((i === 0 && j === 0) || (i === 0 && j === ult) || (i === ult && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) marcar(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));

    const formato = mascara => {
      const d = (N.bits << 3) | mascara;
      let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) marcar(8, i, bit(b, i));
      marcar(8, 7, bit(b, 6)); marcar(8, 8, bit(b, 7)); marcar(7, 8, bit(b, 8));
      for (let i = 9; i < 15; i++) marcar(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) marcar(tam - 1 - i, 8, bit(b, i));
      for (let i = 8; i < 15; i++) marcar(8, tam - 15 + i, bit(b, i));
      marcar(8, tam - 8, true);
    };
    formato(0);
    if (ver >= 7) {
      let r = ver;
      for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const b = (ver << 12) | r;
      for (let i = 0; i < 18; i++) {
        const a = tam - 11 + i % 3, c = Math.floor(i / 3);
        marcar(a, c, bit(b, i)); marcar(c, a, bit(b, i));
      }
    }

    // dados em zigue-zague, de baixo para cima, duas colunas por vez
    let i = 0;
    for (let dir = tam - 1; dir >= 1; dir -= 2) {
      if (dir === 6) dir = 5;
      for (let v = 0; v < tam; v++) for (let j = 0; j < 2; j++) {
        const x = dir - j, subindo = ((dir + 1) & 2) === 0, y = subindo ? tam - 1 - v : v;
        if (!fixo[y][x] && i < final.length * 8) { m[y][x] = bit(final[i >>> 3], 7 - (i & 7)); i++; }
      }
    }

    // 5) máscara com menor penalidade
    const inverte = (k, x, y) => [
      (x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0,
      (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, x * y % 2 + x * y % 3 === 0,
      (x * y % 2 + x * y % 3) % 2 === 0, ((x + y) % 2 + x * y % 3) % 2 === 0
    ][k];
    const aplicar = k => { for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) if (!fixo[y][x] && inverte(k, x, y)) m[y][x] = !m[y][x]; };
    let melhor = 0, menor = Infinity;
    for (let k = 0; k < 8; k++) {
      aplicar(k); formato(k);
      const p = penalidade(m, tam);
      if (p < menor) { menor = p; melhor = k; }
      aplicar(k);
    }
    aplicar(melhor); formato(melhor);
    return m;
  }

  function penalidade(m, tam) {
    let r = 0;
    const historico = (corrida, h) => { if (h[0] === 0) corrida += tam; h.pop(); h.unshift(corrida); };
    const padroes = h => {
      const n = h[1], meio = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
      return (meio && h[0] >= n * 4 && h[6] >= n ? 1 : 0) + (meio && h[6] >= n * 4 && h[0] >= n ? 1 : 0);
    };
    const fechar = (cor, corrida, h) => { if (cor) { historico(corrida, h); corrida = 0; } corrida += tam; historico(corrida, h); return padroes(h); };
    for (let eixo = 0; eixo < 2; eixo++) {
      for (let a = 0; a < tam; a++) {
        let cor = false, corrida = 0;
        const h = [0, 0, 0, 0, 0, 0, 0];
        for (let b = 0; b < tam; b++) {
          const v = eixo === 0 ? m[a][b] : m[b][a];
          if (v === cor) { corrida++; if (corrida === 5) r += 3; else if (corrida > 5) r++; }
          else { historico(corrida, h); if (!cor) r += padroes(h) * 40; cor = v; corrida = 1; }
        }
        r += fechar(cor, corrida, h) * 40;
      }
    }
    let escuros = 0;
    for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
      if (m[y][x]) escuros++;
      if (x < tam - 1 && y < tam - 1) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) r += 3; }
    }
    const total = tam * tam;
    r += (Math.ceil(Math.abs(escuros * 20 - total * 10) / total) - 1) * 10;
    return r;
  }

  /** QR Code como texto SVG (escala livre, nítido em qualquer tamanho). */
  function svg(texto, op) {
    op = op || {};
    const m = gerar(texto, op.nivel || 'M'), b = op.borda === undefined ? 4 : op.borda, tam = m.length + b * 2;
    let d = '';
    m.forEach((linha, y) => linha.forEach((on, x) => { if (on) d += 'M' + (x + b) + ' ' + (y + b) + 'h1v1h-1z'; }));
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + tam + ' ' + tam + '" shape-rendering="crispEdges" role="img" aria-label="' +
      String(op.rotulo || 'QR Code').replace(/"/g, '&quot;') + '"><rect width="' + tam + '" height="' + tam + '" fill="' + (op.claro || '#fff') +
      '"/><path d="' + d + '" fill="' + (op.escuro || '#000') + '"/></svg>';
  }

  window.NebulosaQR = { svg, matriz: (texto, nivel) => gerar(texto, nivel || 'M') };
})();
