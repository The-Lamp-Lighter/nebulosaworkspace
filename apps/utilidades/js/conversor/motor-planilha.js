/* ==========================================================================
   Utilidades — Conversor: motor de PLANILHAS e DADOS (1.0)
   SheetJS lê e grava XLSX, XLSM, XLSB, XLS, ODS, FODS, CSV, TSV, DIF, SYLK, PRN, HTML e JSON.
   Planilha → PDF e → Markdown passam pelo motor de documentos.
   ========================================================================== */
(function () {
  'use strict';
  const { T, esc } = UT, CV = UT.CV;
  const TABELAS = ['xlsx', 'xlsm', 'xlsb', 'xls', 'ods', 'fods', 'csv', 'tsv', 'dif', 'slk', 'prn', 'json'];
  const ENTRADAS = [...TABELAS, 'numbers'];
  const UMA_ABA = ['csv', 'tsv', 'dif', 'slk', 'prn', 'json'];
  const TIPO = { xlsx: 'xlsx', xlsm: 'xlsm', xlsb: 'xlsb', xls: 'biff8', ods: 'ods', fods: 'fods', dif: 'dif', slk: 'slk', prn: 'prn' };

  async function lerLivro(f, de, o) {
    const X = await CV.lib('sheetjs');
    if (de === 'json') {
      let dados; try { dados = JSON.parse(await CV.lerTexto(f)); } catch (e) { throw new Error(T('Este arquivo não é um JSON válido.')); }
      let linhas = Array.isArray(dados) ? dados : (dados && typeof dados === 'object' ? [dados] : null);
      if (!linhas) throw new Error(T('O JSON precisa ser uma lista de objetos (ou uma lista de listas).'));
      const plano = v => (v && typeof v === 'object' && !(v instanceof Date)) ? JSON.stringify(v) : v;
      let ws;
      if (linhas.length && Array.isArray(linhas[0])) ws = X.utils.aoa_to_sheet(linhas.map(r => (Array.isArray(r) ? r : [r]).map(plano)));
      else ws = X.utils.json_to_sheet(linhas.map(r => { if (!r || typeof r !== 'object') return { valor: r }; const n = {}; Object.keys(r).forEach(k => { n[k] = plano(r[k]); }); return n; }));
      const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Dados'); return wb;
    }
    if (de === 'csv' || de === 'tsv' || de === 'prn') {
      const txt = await CV.lerTexto(f);
      const opt = { type: 'string', cellDates: true, raw: !!o.textoPuro };
      if (de === 'tsv') opt.FS = '\t'; else if (de === 'csv' && o.separadorEntrada && o.separadorEntrada !== 'auto') opt.FS = o.separadorEntrada === 'tab' ? '\t' : o.separadorEntrada;
      return X.read(txt, opt);
    }
    return X.read(await CV.lerBytes(f), { type: 'array', cellDates: true, cellStyles: false });
  }
  const sep = s => (s === 'tab' ? '\t' : s || ',');
  function livroParaTabelasHtml(wb, X) {
    return wb.SheetNames.map(n => '<h2>' + esc(n) + '</h2>' + (X.utils.sheet_to_html(wb.Sheets[n], { header: '', footer: '' }).replace(/^[\s\S]*?(<table[\s\S]*<\/table>)[\s\S]*$/i, '$1') || '')).join('\n');
  }
  async function gravarLivro(wb, para, o, nomeBase) {
    const X = await CV.lib('sheetjs');
    if (!wb.SheetNames.length) throw new Error(T('A planilha está vazia.'));
    if (UMA_ABA.includes(para)) {
      const nomes = o.abas === 'todas' ? wb.SheetNames : [wb.SheetNames[0]];
      const saidas = nomes.map(n => {
        const ws = wb.Sheets[n]; let dados, mime;
        if (para === 'csv') dados = '﻿' + X.utils.sheet_to_csv(ws, { FS: sep(o.separador), dateNF: 'yyyy-mm-dd', blankrows: false });
        else if (para === 'tsv') dados = X.utils.sheet_to_csv(ws, { FS: '\t', blankrows: false });
        else if (para === 'json') dados = JSON.stringify(X.utils.sheet_to_json(ws, { defval: null, raw: true, dateNF: 'yyyy-mm-dd' }), null, 2);
        else { const out = X.write({ SheetNames: [n], Sheets: { [n]: ws } }, { bookType: TIPO[para], type: 'array' }); dados = out; }
        return { blob: CV.blob(dados, para), nome: CV.nomeSaida(nomes.length > 1 ? nomeBase + '-' + n : nomeBase, para) };
      });
      return saidas;
    }
    const out = X.write(wb, { bookType: TIPO[para], type: 'array', compression: true });
    return [{ blob: CV.blob(out, para), nome: CV.nomeSaida(nomeBase, para) }];
  }

  CV.motor({
    id: 'planilha',
    rotas(de) {
      if (!ENTRADAS.includes(de)) return [];
      return [...TABELAS.filter(x => x !== 'xlsm' || de === 'xlsm' || true), 'html', 'pdf', 'md'];
    },
    opcoes(de, para) {
      const o = [];
      if (de === 'csv') o.push({ id: 'separadorEntrada', tipo: 'lista', rot: 'Separador do CSV de entrada', pad: 'auto', opcoes: [['auto', 'Detectar'], [',', 'Vírgula (,)'], [';', 'Ponto e vírgula (;)'], ['tab', 'Tabulação'], ['|', 'Barra vertical (|)']] });
      if (para === 'csv') o.push({ id: 'separador', tipo: 'lista', rot: 'Separador', pad: ',', opcoes: [[',', 'Vírgula (,)'], [';', 'Ponto e vírgula (;)'], ['tab', 'Tabulação'], ['|', 'Barra vertical (|)']] });
      if (UMA_ABA.includes(para)) o.push({ id: 'abas', tipo: 'lista', rot: 'Planilhas com várias abas', pad: 'primeira', opcoes: [['primeira', 'Só a primeira aba'], ['todas', 'Um arquivo por aba']] });
      if (para === 'pdf') o.push({ id: 'orientacao', tipo: 'lista', rot: 'Orientação da página', pad: 'paisagem', opcoes: [['paisagem', 'Paisagem'], ['retrato', 'Retrato']] }, { id: 'papel', tipo: 'lista', rot: 'Papel', pad: 'a4', opcoes: [['a4', 'A4'], ['letter', 'Carta (Letter)']] });
      return o;
    },
    async converter(ctx) {
      const { arquivo: f, de, para, opcoes: o, nomeBase } = ctx;
      ctx.progresso(0.1, T('Lendo a planilha…'));
      const wb = await lerLivro(f, de, o), X = await CV.lib('sheetjs');
      CV.checar(ctx);
      ctx.progresso(0.5, T('Gravando…'));
      if (para === 'html') {
        const corpo = livroParaTabelasHtml(wb, X);
        return [CV.saida('<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>' + esc(nomeBase) + '</title><style>body{font:14px system-ui,sans-serif;margin:24px}table{border-collapse:collapse;margin:8px 0 24px}td,th{border:1px solid #bbb;padding:4px 8px}</style></head><body>' + corpo + '</body></html>', nomeBase, 'html')];
      }
      if (para === 'md') {
        const md = wb.SheetNames.map(n => {
          const linhas = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: false });
          if (!linhas.length) return '';
          const w = Math.max(...linhas.map(r => r.length)), cel = v => String(v == null ? '' : v).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
          const l = r => '| ' + Array.from({ length: w }, (_, i) => cel(r[i])).join(' | ') + ' |';
          return (wb.SheetNames.length > 1 ? '## ' + n + '\n\n' : '') + l(linhas[0]) + '\n' + l(Array(w).fill('---')) + '\n' + linhas.slice(1).map(l).join('\n') + '\n';
        }).filter(Boolean).join('\n');
        return [CV.saida(md, nomeBase, 'md')];
      }
      if (para === 'pdf') {
        const html = '<html><body>' + livroParaTabelasHtml(wb, X) + '</body></html>';
        const blob = await CV.documento.htmlParaPdf(html, { papel: o.papel, orientacao: o.orientacao, fonte: 'sans', tamanho: 9, margem: 13, numerar: true, titulo: nomeBase }, ctx);
        return [{ blob, nome: CV.nomeSaida(nomeBase, 'pdf') }];
      }
      return gravarLivro(wb, para, o, nomeBase);
    }
  });
  CV.planilha = { lerLivro };
})();
