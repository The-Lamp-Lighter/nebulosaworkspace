/* ============================================================
   LêPraMim — capitulos.js
   Detecção automática de capítulos ("Capítulo 1", "Parte II",
   "Chapter 3", "Section 2", "Prólogo"…) e divisão em páginas
   para formatos que não têm páginas (EPUB, DOCX, TXT, HTML, RTF).
   ============================================================ */
(function () {
  'use strict';
  const { normalizar } = LPM.util;

  // Numeral romano válido (evita confundir palavras como "civil" ou "mil")
  const ROMANO = /^(?=[ivxlcdm])m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;
  const EXTENSO = /^(um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|primeir[oa]|segund[oa]|terceir[oa]|quart[oa]|quint[oa]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|first|second|third|fourth|fifth)$/i;
  const ROTULO = /^(cap[ií]tulo|cap\.|chapter|parte|part|se[cç][aã]o|section|livro|book|ato|act)\s+(\S+)(?:\s+(.*))?$/i;
  const ESPECIAL = /^(pr[oó]logo|ep[ií]logo|introdu[cç][aã]o|pref[aá]cio|posf[aá]cio|conclus[aã]o|agradecimentos|ap[eê]ndice(\s+\w{1,3})?|prologue|epilogue|introduction|preface|foreword|afterword|conclusion|acknowledge?ments|appendix(\s+\w{1,3})?)\s*[.:]?$/i;

  /** Diz se uma linha/parágrafo curto é um título de capítulo. */
  function ehTitulo(texto) {
    const t = String(texto || '').trim();
    if (t.length < 3 || t.length > 110) return false;
    if (ESPECIAL.test(t)) return true;
    const m = ROTULO.exec(t);
    if (!m) return false;

    let num = m[2];
    let resto = (m[3] || '').trim();
    let separador = false;
    // "Capítulo 1:" / "Parte II." / "Chapter 3 —"
    const semPontuacao = num.replace(/[.:—–\-]+$/, '');
    if (semPontuacao !== num) { separador = true; num = semPontuacao; }
    if (/^[—–\-:.]/.test(resto)) { separador = true; resto = resto.replace(/^[—–\-:.\s]+/, ''); }
    if (!num) return false;

    const digitos = /^\d{1,3}$/.test(num);
    const romano = ROMANO.test(num);
    const extenso = EXTENSO.test(num);
    if (!digitos && !romano && !extenso) return false;

    if (!resto) return true;                               // "Capítulo 7"
    if (resto.length > 80) return false;                   // longo demais para ser título
    if (separador) return true;                            // "Capítulo 7 — A viagem"
    if (extenso) return false;                             // "Livro um tanto estranho…"
    if (romano && !digitos && num !== num.toUpperCase()) return false; // "Parte vi ontem…"
    if (/[.,;]$/.test(resto)) return false;                // parece uma frase comum
    return true;                                           // "Capítulo 7 A viagem"
  }

  /** Procura, na página, o parágrafo que corresponde a um título do sumário. */
  function acharParagrafo(pagina, titulo) {
    if (!pagina) return 0;
    const alvo = normalizar(titulo).replace(/\s+/g, ' ').trim().slice(0, 30);
    if (!alvo) return 0;
    const i = pagina.paragrafos.findIndex(p => {
      const t = normalizar(p.t).replace(/\s+/g, ' ').trim();
      return t.length < 160 && (t.startsWith(alvo) || alvo.startsWith(t.slice(0, 30)) && t.length > 3);
    });
    return i < 0 ? 0 : i;
  }

  /**
   * Monta a lista de capítulos.
   * paginas: [{paragrafos:[{t,h}]}]
   * fonte:   capítulos informados pelo próprio arquivo (sumário do PDF/EPUB), se houver
   */
  function detectar(paginas, fonte, paginado) {
    let caps = [];

    if (fonte && fonte.length >= 2) {
      // O arquivo traz o próprio sumário: é a fonte mais confiável
      caps = fonte
        .filter(c => c && c.titulo && c.pagina >= 0 && c.pagina < paginas.length)
        .map(c => ({
          titulo: String(c.titulo).replace(/\s+/g, ' ').trim().slice(0, 120),
          pagina: c.pagina,
          paragrafo: acharParagrafo(paginas[c.pagina], c.titulo)
        }));
    }

    if (caps.length < 2) {
      const porTexto = [], porEstrutura = [];
      paginas.forEach((pg, pi) => pg.paragrafos.forEach((p, i) => {
        if (p.t.length > 110) return;
        if (ehTitulo(p.t)) {
          let titulo = p.t;
          // "Capítulo 1" seguido de uma linha curta: junta as duas no menu
          const prox = pg.paragrafos[i + 1];
          if (titulo.length <= 24 && prox && prox.t.length <= 70 && !/[.;,]$/.test(prox.t) && !ehTitulo(prox.t)) {
            titulo += ' — ' + prox.t;
          }
          if (!p.h) p.h = 1;
          porTexto.push({ titulo, pagina: pi, paragrafo: i });
        } else if (p.h === 1 || p.h === 2) {
          porEstrutura.push({ titulo: p.t, pagina: pi, paragrafo: i, h: p.h });
        }
      }));

      if (paginado) {
        // Em PDFs, títulos "por tamanho de letra" são menos confiáveis
        caps = porTexto.length >= 2 ? porTexto : porTexto.concat(porEstrutura);
      } else {
        const h1 = porEstrutura.filter(c => c.h === 1);
        caps = porTexto.concat(h1.length >= 2 ? h1 : porEstrutura);
      }
      if (caps.length > 500 && porTexto.length >= 2) caps = porTexto;
      caps.sort((a, b) => a.pagina - b.pagina || a.paragrafo - b.paragrafo);
    }

    // Remove repetições em páginas vizinhas (sobras de cabeçalhos corridos)
    const visto = new Map();
    caps = caps.filter(c => {
      const k = normalizar(c.titulo);
      const ultima = visto.get(k);
      visto.set(k, c.pagina);
      return ultima === undefined || c.pagina - ultima > 2;
    }).map(c => ({ titulo: c.titulo, pagina: c.pagina, paragrafo: c.paragrafo }));

    // Se o livro começa antes do primeiro capítulo, cria a entrada "Início"
    if (caps.length && (caps[0].pagina > 0 || caps[0].paragrafo > 0)) {
      caps.unshift({ titulo: 'Início', pagina: 0, paragrafo: 0 });
    }
    return caps;
  }

  /**
   * Divide seções (listas de parágrafos) em páginas virtuais.
   * Retorna { paginas, inicioSecao } — inicioSecao[i] é a página onde a seção i começa.
   */
  function paginar(secoes, limite) {
    limite = limite || LPM.config.CARACTERES_POR_PAGINA;
    const paginas = [];
    const inicioSecao = [];
    let atual = null, tam = 0;
    const nova = () => { atual = { paragrafos: [] }; paginas.push(atual); tam = 0; };

    secoes.forEach((sec, si) => {
      let primeiro = true;
      sec.forEach(p => {
        const inicioDeCapitulo = (p.h === 1 || ehTitulo(p.t)) && tam > 400;
        const cheia = tam + p.t.length > limite && tam > limite * 0.4;
        if (!atual || (primeiro && atual.paragrafos.length) || inicioDeCapitulo || cheia) nova();
        if (primeiro) { inicioSecao[si] = paginas.length - 1; primeiro = false; }
        atual.paragrafos.push(p);
        tam += p.t.length;
      });
      if (primeiro) inicioSecao[si] = -1; // seção sem texto (ex.: só a imagem da capa)
    });

    if (!paginas.length) nova();
    // Seções vazias apontam para a página seguinte
    for (let i = inicioSecao.length - 1; i >= 0; i--) {
      if (inicioSecao[i] === -1) {
        inicioSecao[i] = i + 1 < inicioSecao.length ? inicioSecao[i + 1] : paginas.length - 1;
      }
    }
    return { paginas, inicioSecao };
  }

  /** Índice do capítulo que contém a posição (página, parágrafo). -1 se não houver. */
  function capituloDe(capitulos, pagina, paragrafo) {
    let idx = -1;
    for (let i = 0; i < capitulos.length; i++) {
      const c = capitulos[i];
      if (c.pagina < pagina || (c.pagina === pagina && c.paragrafo <= paragrafo)) idx = i;
      else break;
    }
    return idx;
  }

  LPM.capitulos = { ehTitulo, detectar, paginar, capituloDe };
})();
