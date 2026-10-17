/* ============================================================
   LêPraMim — livro.js
   Prepara um livro para leitura: aplica a limpeza inteligente,
   divide em páginas, detecta capítulos e separa o texto em frases
   (cada frase é um "trecho" lido pela voz).
   ============================================================ */
(function () {
  'use strict';

  // Ponto de divisão: depois de . ! ? … (e aspas de fechamento), antes de maiúscula/número
  const DIVISOR = /(?<=[.!?…]["”»’')\]]*)\s+(?=["“«‘'(\[¿¡—–-]*[A-ZÀ-ÖØ-Þ0-9])/u;
  // Abreviações que terminam com ponto mas não encerram a frase
  const ABREVIACAO = /(?:^|[\s(])(?:sr|sra|srta|dr|dra|prof|profa|av|exmo|ilmo|st|mr|mrs|ms|jr|p[aá]g|art|n[º°]?|vol|cap|ex|fig|tel|ltda|cia|etc)\.$/i;

  /** Quebra frases muito longas em pedaços menores, de preferência em vírgulas. */
  function quebrarLonga(frase) {
    const partes = [];
    let resto = frase;
    while (resto.length > 320) {
      let corte = -1;
      const achados = Array.from(resto.slice(140, 300).matchAll(/[;:,—–]\s/g));
      if (achados.length) corte = 140 + achados[achados.length - 1].index + 1;
      else {
        const espaco = resto.lastIndexOf(' ', 300);
        corte = espaco > 100 ? espaco : 300;
      }
      partes.push(resto.slice(0, corte).trim());
      resto = resto.slice(corte).trim();
    }
    if (resto) partes.push(resto);
    return partes;
  }

  /** Divide um parágrafo em frases. */
  function dividirFrases(texto) {
    const t = String(texto).trim();
    if (!t) return [];
    const brutas = t.split(DIVISOR).filter(Boolean);
    // Junta abreviações ("Dr." + "Silva") e pedaços curtos demais, para a voz não "soluçar"
    const juntas = [];
    for (const p of brutas) {
      const ant = juntas[juntas.length - 1];
      if (ant !== undefined && (ABREVIACAO.test(ant) || ant.length < 28)) juntas[juntas.length - 1] = ant + ' ' + p;
      else juntas.push(p);
    }
    const saida = [];
    for (const f of juntas) {
      if (f.length <= 320) saida.push(f);
      else saida.push.apply(saida, quebrarLonga(f));
    }
    return saida;
  }

  /**
   * Prepara o conteúdo bruto (gravado na biblioteca) para o leitor.
   * Retorna { paginas:[{paragrafos:[{t,h,frases}]}], capitulos, relatorio, inicioPagina, totalCaracteres }
   */
  function preparar(conteudo) {
    const limpo = LPM.limpeza.processar(conteudo, LPM.dados.cfg.limpeza);
    let paginas, fonte = conteudo.capitulosFonte || [];

    if (conteudo.paginado) {
      paginas = limpo.secoes.map(pars => ({ paragrafos: pars }));
      if (!paginas.length) paginas = [{ paragrafos: [] }];
    } else {
      const r = LPM.capitulos.paginar(limpo.secoes);
      paginas = r.paginas;
      // o sumário do arquivo aponta para seções; converte para páginas
      fonte = fonte.map(c => ({ titulo: c.titulo, pagina: r.inicioSecao[c.pagina] === undefined ? -1 : r.inicioSecao[c.pagina] }));
    }

    const capitulos = LPM.capitulos.detectar(paginas, fonte, !!conteudo.paginado);

    // Frases e contagem de caracteres (usada no progresso e no modo híbrido)
    const inicioPagina = [];
    let total = 0;
    paginas.forEach(pg => {
      inicioPagina.push(total);
      pg.paragrafos.forEach(p => {
        p.frases = dividirFrases(p.t);
        total += p.t.length + 1;
      });
    });

    return { paginas, capitulos, relatorio: limpo.relatorio, inicioPagina, totalCaracteres: total };
  }

  LPM.livro = { preparar, dividirFrases };
})();
