/* ==========================================================================
   Stardust — js/arquivos.js
   Abrir e salvar arquivos.

   XLSX e XLSM  escritos e lidos aqui mesmo (com JSZip): valores, fórmulas,
                formatação (fonte, cores, bordas, alinhamento, formato de
                número), larguras, alturas, células mescladas, painéis
                congelados e GRÁFICOS nativos do Excel.
   XLS, XLSB    escritos e lidos com a SheetJS (libs/xlsx.full.min.js):
   e ODS        valores, fórmulas (quando o formato aceita), formatos de
                número, larguras e células mescladas.
   CSV          a planilha que está aberta, separada por ponto e vírgula
                (padrão do Excel no Brasil) ou por vírgula.
   PDF          desenhado com a pdf-lib (libs/pdf-lib.min.js), com os
                gráficos no fim.
   JPG          uma imagem da planilha, com os gráficos no lugar.
   ========================================================================== */
(function () {
  'use strict';
  const SD = window.SD;
  const X = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const EMU = 9525; // 1 px = 9525 EMU
  const pxToChars = px => Math.max(0, Math.round((px - 5) / 7 * 100) / 100);
  const charsToPx = w => Math.round(w * 7 + 5);

  const FORMATOS = [
    { id: 'xlsx', nome: 'Pasta de Trabalho do Excel', ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', nota: 'Guarda tudo: fórmulas, formatação e gráficos.' },
    { id: 'xlsm', nome: 'Pasta de Trabalho do Excel Habilitada para Macro', ext: 'xlsm', mime: 'application/vnd.ms-excel.sheet.macroEnabled.12', nota: 'Igual ao XLSX (o Stardust não cria macros).' },
    { id: 'xlsb', nome: 'Pasta de Trabalho Binária do Excel', ext: 'xlsb', mime: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12', nota: 'Valores, fórmulas e larguras. Sem cores e sem gráficos.' },
    { id: 'xls', nome: 'Pasta de Trabalho do Excel 97-2003', ext: 'xls', mime: 'application/vnd.ms-excel', nota: 'Valores calculados, formatos de número e larguras. Sem cores e sem gráficos.' },
    { id: 'ods', nome: 'Planilha OpenDocument (LibreOffice)', ext: 'ods', mime: 'application/vnd.oasis.opendocument.spreadsheet', nota: 'Valores, fórmulas e formatos de número. Sem cores e sem gráficos.' },
    { id: 'csv', nome: 'CSV separado por ponto e vírgula', ext: 'csv', mime: 'text/csv', nota: 'Só a planilha aberta e só o texto das células.' },
    { id: 'csvv', nome: 'CSV separado por vírgula', ext: 'csv', mime: 'text/csv', nota: 'Só a planilha aberta, com ponto decimal (padrão internacional).' },
    { id: 'pdf', nome: 'PDF', ext: 'pdf', mime: 'application/pdf', nota: 'Para imprimir ou enviar. Os gráficos vão no fim.' },
    { id: 'jpg', nome: 'Imagem JPG', ext: 'jpg', mime: 'image/jpeg', nota: 'Uma foto da planilha aberta, com os gráficos.' }
  ];

  /* ======================================================================
     XLSX / XLSM — escrita
     ====================================================================== */
  function styleKey(s) { return JSON.stringify(s || {}); }
  function buildStyles(wb) {
    const numFmts = [], numFmtIds = new Map();
    const BUILTIN = { 'General': 0, '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4, '0%': 9, '0.00%': 10, '0.00E+00': 11, '@': 49 };
    const fonts = ['<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>'], fontIds = new Map([['{}', 0]]);
    const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'], fillIds = new Map();
    const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'], borderIds = new Map([['{}', 0]]);
    const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'], xfIds = new Map([['{}', 0]]);
    const FAM = { serif: 'Cambria', mono: 'Consolas', sans: 'Calibri' };
    function fmtId(z) {
      if (!z) return 0;
      if (BUILTIN[z] !== undefined) return BUILTIN[z];
      if (numFmtIds.has(z)) return numFmtIds.get(z);
      const id = 164 + numFmts.length; numFmts.push(`<numFmt numFmtId="${id}" formatCode="${X(z)}"/>`); numFmtIds.set(z, id); return id;
    }
    const argb = h => 'FF' + String(h || '#000000').replace('#', '').toUpperCase().padStart(6, '0').slice(-6);
    function fontId(s) {
      const f = { b: s.b, i: s.i, u: s.u, st: s.st, fs: s.fs, fc: s.fc, ff: s.ff };
      Object.keys(f).forEach(k => f[k] === undefined && delete f[k]);
      const k = JSON.stringify(f); if (fontIds.has(k)) return fontIds.get(k);
      const xml = '<font>' + (f.b ? '<b/>' : '') + (f.i ? '<i/>' : '') + (f.st ? '<strike/>' : '') + (f.u ? '<u/>' : '') + `<sz val="${f.fs || 11}"/>` + (f.fc ? `<color rgb="${argb(f.fc)}"/>` : '<color theme="1"/>') + `<name val="${FAM[f.ff] || 'Calibri'}"/><family val="${f.ff === 'serif' ? 1 : f.ff === 'mono' ? 3 : 2}"/>` + (!f.ff || f.ff === 'sans' ? '<scheme val="minor"/>' : '') + '</font>';
      fonts.push(xml); fontIds.set(k, fonts.length - 1); return fonts.length - 1;
    }
    function fillId(bg) {
      if (!bg) return 0;
      if (fillIds.has(bg)) return fillIds.get(bg);
      fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="${argb(bg)}"/><bgColor indexed="64"/></patternFill></fill>`); fillIds.set(bg, fills.length - 1); return fills.length - 1;
    }
    function borderId(bd) {
      if (!bd) return 0;
      const k = JSON.stringify(bd); if (borderIds.has(k)) return borderIds.get(k);
      const side = (tag, v) => v ? `<${tag} style="${v}"><color rgb="${argb(bd.c || '#000000')}"/></${tag}>` : `<${tag}/>`;
      borders.push('<border>' + side('left', bd.l) + side('right', bd.r) + side('top', bd.t) + side('bottom', bd.b) + '<diagonal/></border>'); borderIds.set(k, borders.length - 1); return borders.length - 1;
    }
    function xfId(s) {
      if (!s || !Object.keys(s).length) return 0;
      const k = styleKey(s); if (xfIds.has(k)) return xfIds.get(k);
      const nf = fmtId(s.z), fo = fontId(s), fi = fillId(s.bg), bo = borderId(s.bd);
      const H = { left: 'left', center: 'center', right: 'right', justify: 'justify' }, V = { top: 'top', middle: 'center', bottom: 'bottom' };
      const al = (s.ha || s.va || s.wrap || s.ind) ? `<alignment${s.ha ? ` horizontal="${H[s.ha] || 'general'}"` : ''}${s.va ? ` vertical="${V[s.va] || 'bottom'}"` : ''}${s.wrap ? ' wrapText="1"' : ''}${s.ind ? ` indent="${s.ind}"` : ''}/>` : '';
      xfs.push(`<xf numFmtId="${nf}" fontId="${fo}" fillId="${fi}" borderId="${bo}" xfId="0"${nf ? ' applyNumberFormat="1"' : ''}${fo ? ' applyFont="1"' : ''}${fi ? ' applyFill="1"' : ''}${bo ? ' applyBorder="1"' : ''}${al ? ' applyAlignment="1">' + al + '</xf>' : '/>'}`);
      xfIds.set(k, xfs.length - 1); return xfs.length - 1;
    }
    wb.sheets.forEach(sh => sh.cells.forEach(c => { if (c.s) xfId(c.s); }));
    const xml = () => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.join('')}</numFmts>` : '') +
      `<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`;
    return { xfId, xml };
  }

  function colPx(sh, c) { return sh.colW[c] !== undefined ? sh.colW[c] : SD.DEF_W; }
  function rowPx(sh, r) { return sh.rowH[r] !== undefined ? sh.rowH[r] : SD.DEF_H; }
  // posição (px) → âncora de célula (col, deslocamento EMU)
  function anchorFrom(sh, x, y) {
    let c = 0, acc = 0; while (acc + colPx(sh, c) <= x && c < 16000) { acc += colPx(sh, c); c++; }
    const cx = Math.round((x - acc) * EMU);
    let r = 0, accY = 0; while (accY + rowPx(sh, r) <= y && r < 1000000) { accY += rowPx(sh, r); r++; }
    return { c, cx, r, cy: Math.round((y - accY) * EMU) };
  }

  function chartXml(wb, sh, ch) {
    const D = SD.G.dados(wb, ch);
    const cores = SD.G.PALETAS[ch.paleta || 'stardust'] || SD.G.PALETAS.stardust;
    const color = i => cores[i % cores.length].replace('#', '').toUpperCase();
    const sn = "'" + sh.name.replace(/'/g, "''") + "'!";
    const abs = g => sn + '$' + SD.colName(g.c1) + '$' + (g.r1 + 1) + (g.r1 === g.r2 && g.c1 === g.c2 ? '' : ':$' + SD.colName(g.c2) + '$' + (g.r2 + 1));
    const strCache = arr => `<c:strCache><c:ptCount val="${arr.length}"/>${arr.map((v, i) => `<c:pt idx="${i}"><c:v>${X(v)}</c:v></c:pt>`).join('')}</c:strCache>`;
    const numCache = arr => `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${arr.length}"/>${arr.map((v, i) => v === null ? '' : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numCache>`;
    const tx = s => s.nameRef ? `<c:tx><c:strRef><c:f>${X(abs({ r1: s.nameRef.r, c1: s.nameRef.c, r2: s.nameRef.r, c2: s.nameRef.c }))}</c:f>${strCache([s.name])}</c:strRef></c:tx>` : `<c:tx><c:v>${X(s.name)}</c:v></c:tx>`;
    const cat = () => D.catRef ? `<c:cat><c:strRef><c:f>${X(abs(D.catRef))}</c:f>${strCache(D.cats)}</c:strRef></c:cat>` : `<c:cat><c:strLit><c:ptCount val="${D.cats.length}"/>${D.cats.map((v, i) => `<c:pt idx="${i}"><c:v>${X(v)}</c:v></c:pt>`).join('')}</c:strLit></c:cat>`;
    const val = s => `<c:val><c:numRef><c:f>${X(abs(s.ref))}</c:f>${numCache(s.values)}</c:numRef></c:val>`;
    const sp = (i, line) => line ? `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${color(i)}"/></a:solidFill><a:round/></a:ln></c:spPr>` : `<c:spPr><a:solidFill><a:srgbClr val="${color(i)}"/></a:solidFill></c:spPr>`;
    const dl = ch.rotulos ? '<c:dLbls><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>' : '';
    const axes = (catType) => `<c:${catType}><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${ch.tipo === 'barras' ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="222"/><c:crosses val="autoZero"/>${catType === 'catAx' ? '<c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/>' : '<c:crossBetween val="midCat"/>'}</c:${catType}>` +
      `<c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${ch.tipo === 'barras' ? 'b' : 'l'}"/><c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="111"/><c:crosses val="autoZero"/><c:crossBetween val="${ch.tipo === 'area' ? 'midCat' : 'between'}"/></c:valAx>`;
    let plot = '';
    const stacked = !!ch.empilhado;
    const ser = (s, i, extra) => `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx(s)}${extra || ''}${cat()}${val(s)}</c:ser>`;
    switch (ch.tipo) {
      case 'barras': case 'colunas':
        plot = `<c:barChart><c:barDir val="${ch.tipo === 'barras' ? 'bar' : 'col'}"/><c:grouping val="${stacked ? 'stacked' : 'clustered'}"/><c:varyColors val="0"/>${D.series.map((s, i) => ser(s, i, sp(i) + '<c:invertIfNegative val="0"/>')).join('')}${dl}<c:gapWidth val="80"/>${stacked ? '<c:overlap val="100"/>' : ''}<c:axId val="111"/><c:axId val="222"/></c:barChart>` + axes('catAx');
        break;
      case 'linhas':
        plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${D.series.map((s, i) => ser(s, i, sp(i, true) + `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${color(i)}"/></a:solidFill></c:spPr></c:marker>`)).join('')}${dl}<c:marker val="1"/><c:axId val="111"/><c:axId val="222"/></c:lineChart>` + axes('catAx');
        break;
      case 'area':
        plot = `<c:areaChart><c:grouping val="${stacked ? 'stacked' : 'standard'}"/><c:varyColors val="0"/>${D.series.map((s, i) => ser(s, i, sp(i))).join('')}${dl}<c:axId val="111"/><c:axId val="222"/></c:areaChart>` + axes('catAx');
        break;
      case 'pizza': case 'rosca': {
        const s = D.series[0] || { name: '', values: [], ref: { r1: 0, c1: 0, r2: 0, c2: 0 } };
        const dpts = D.cats.map((c, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${color(i)}"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`).join('');
        const pl = '<c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="1"/></c:dLbls>';
        const body = `<c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>${tx(s)}${dpts}${ch.rotulos !== false ? pl : ''}${cat()}${val(s)}</c:ser>`;
        plot = ch.tipo === 'pizza' ? `<c:pieChart>${body}<c:firstSliceAng val="0"/></c:pieChart>` : `<c:doughnutChart>${body}<c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`;
        break;
      }
      case 'dispersao': {
        const xr = D.catRef;
        const xv = xr ? `<c:xVal><c:numRef><c:f>${X(abs(xr))}</c:f>${numCache(D.catNums.map(v => typeof v === 'number' ? v : null))}</c:numRef></c:xVal>` : '';
        plot = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${D.series.map((s, i) => `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx(s)}<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr><a:solidFill><a:srgbClr val="${color(i)}"/></a:solidFill></c:spPr></c:marker>${xv}<c:yVal><c:numRef><c:f>${X(abs(s.ref))}</c:f>${numCache(s.values)}</c:numRef></c:yVal><c:smooth val="0"/></c:ser>`).join('')}${dl}<c:axId val="111"/><c:axId val="222"/></c:scatterChart>` + axes('valAx');
        break;
      }
    }
    const legPos = ch.legenda || ((D.series.length > 1 || ch.tipo === 'pizza' || ch.tipo === 'rosca') ? 'baixo' : 'nenhuma');
    const legend = legPos === 'nenhuma' ? '' : `<c:legend><c:legendPos val="${legPos === 'direita' ? 'r' : 'b'}"/><c:overlay val="0"/></c:legend>`;
    const title = ch.titulo ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="1"/></a:pPr><a:r><a:rPr lang="pt-BR" sz="1400" b="1"/><a:t>${X(ch.titulo)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` : '<c:autoTitleDeleted val="1"/>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<c:roundedCorners val="0"/><c:chart>${title}<c:plotArea><c:layout/>${plot}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1000"/></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr></c:chartSpace>`;
  }

  async function writeXlsx(wb, macro) {
    const zip = new JSZip();
    const st = buildStyles(wb);
    const sst = [], sstIdx = new Map();
    const si = s => { if (sstIdx.has(s)) return sstIdx.get(s); sst.push(s); sstIdx.set(s, sst.length - 1); return sst.length - 1; };
    const ct = ['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>', '<Default Extension="xml" ContentType="application/xml"/>',
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.${macro ? 'ms-excel.sheet.macroEnabled.main+xml' : 'openxmlformats-officedocument.spreadsheetml.sheet.main+xml'}"/>`,
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>',
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'];
    const wbRels = [];
    let chartN = 0, drawN = 0;
    const definedNames = [];
    wb.sheets.forEach((sh, i) => {
      const n = i + 1;
      ct.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
      wbRels.push(`<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`);
      // células por linha
      const rows = new Map();
      sh.cells.forEach((c, k) => { const [r, cc] = SD.unkey(k); if (!rows.has(r)) rows.set(r, []); rows.get(r).push([cc, c]); });
      Object.keys(sh.rowH).forEach(r => { if (!rows.has(+r)) rows.set(+r, []); });
      sh.hiddenRows.forEach(r => { if (!rows.has(r)) rows.set(r, []); });
      const rowKeys = [...rows.keys()].sort((a, b) => a - b);
      let data = '';
      let maxR = 0, maxC = 0;
      rowKeys.forEach(r => {
        const cells = rows.get(r).sort((a, b) => a[0] - b[0]);
        const ht = sh.rowH[r];
        data += `<row r="${r + 1}"${ht !== undefined ? ` ht="${Math.round(ht * 0.75 * 100) / 100}" customHeight="1"` : ''}${sh.hiddenRows.has(r) ? ' hidden="1"' : ''}>`;
        cells.forEach(([c, cell]) => {
          const ref = SD.addr(r, c), s = cell.s ? st.xfId(cell.s) : 0;
          const sa = s ? ` s="${s}"` : '';
          maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
          const v = cell.f ? cell.val : cell.v;
          if (cell.f) {
            const f = `<f>${X(SD.F.toFileFormula(cell.f))}</f>`;
            if (typeof v === 'number') data += `<c r="${ref}"${sa}>${f}<v>${v}</v></c>`;
            else if (typeof v === 'boolean') data += `<c r="${ref}"${sa} t="b">${f}<v>${v ? 1 : 0}</v></c>`;
            else if (SD.isErr(v)) data += `<c r="${ref}"${sa} t="e">${f}<v>${SD.ERR_EN[v.err] || '#VALUE!'}</v></c>`;
            else data += `<c r="${ref}"${sa} t="str">${f}<v>${X(v === null || v === undefined ? '' : v)}</v></c>`;
          } else if (v === null || v === undefined || v === '') data += s ? `<c r="${ref}"${sa}/>` : '';
          else if (typeof v === 'number') data += `<c r="${ref}"${sa}><v>${v}</v></c>`;
          else if (typeof v === 'boolean') data += `<c r="${ref}"${sa} t="b"><v>${v ? 1 : 0}</v></c>`;
          else if (SD.isErr(v)) data += `<c r="${ref}"${sa} t="e"><v>${SD.ERR_EN[v.err] || '#VALUE!'}</v></c>`;
          else data += `<c r="${ref}"${sa} t="s"><v>${si(String(v))}</v></c>`;
        });
        data += '</row>';
      });
      const colKeys = Object.keys(sh.colW).map(Number).sort((a, b) => a - b);
      const cols = colKeys.length ? '<cols>' + colKeys.map(c => `<col min="${c + 1}" max="${c + 1}" width="${pxToChars(sh.colW[c])}" customWidth="1"/>`).join('') + '</cols>' : '';
      const fr = sh.freeze || { r: 0, c: 0 };
      const pane = fr.r || fr.c ? `<pane${fr.c ? ` xSplit="${fr.c}"` : ''}${fr.r ? ` ySplit="${fr.r}"` : ''} topLeftCell="${SD.addr(fr.r, fr.c)}" activePane="${fr.r && fr.c ? 'bottomRight' : fr.r ? 'bottomLeft' : 'topRight'}" state="frozen"/>` : '';
      const merges = sh.merges.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map(m => `<mergeCell ref="${SD.rangeStr(m)}"/>`).join('')}</mergeCells>` : '';
      let autoFilter = '';
      if (sh.filter && sh.filter.range) {
        autoFilter = `<autoFilter ref="${sh.filter.range}"/>`;
        definedNames.push(`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${X("'" + sh.name.replace(/'/g, "''") + "'!" + sh.filter.range.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2'))}</definedName>`);
      }
      let drawing = '';
      if (sh.charts.length) {
        drawN++;
        const dn = drawN;
        drawing = '<drawing r:id="rId1"/>';
        zip.file(`xl/worksheets/_rels/sheet${n}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${dn}.xml"/></Relationships>`);
        ct.push(`<Override PartName="/xl/drawings/drawing${dn}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
        const anchors = [], drels = [];
        sh.charts.forEach((ch, j) => {
          chartN++;
          const a = anchorFrom(sh, ch.x, ch.y), b = anchorFrom(sh, ch.x + ch.w, ch.y + ch.h);
          anchors.push(`<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${a.c}</xdr:col><xdr:colOff>${a.cx}</xdr:colOff><xdr:row>${a.r}</xdr:row><xdr:rowOff>${a.cy}</xdr:rowOff></xdr:from><xdr:to><xdr:col>${b.c}</xdr:col><xdr:colOff>${b.cx}</xdr:colOff><xdr:row>${b.r}</xdr:row><xdr:rowOff>${b.cy}</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${j + 2}" name="${X(ch.titulo || 'Gráfico ' + (j + 1))}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId${j + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`);
          drels.push(`<Relationship Id="rId${j + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartN}.xml"/>`);
          zip.file(`xl/charts/chart${chartN}.xml`, chartXml(wb, sh, ch));
          ct.push(`<Override PartName="/xl/charts/chart${chartN}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
        });
        zip.file(`xl/drawings/drawing${dn}.xml`, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' + anchors.join('') + '</xdr:wsDr>');
        zip.file(`xl/drawings/_rels/drawing${dn}.xml.rels`, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + drels.join('') + '</Relationships>');
      }
      const dim = `<dimension ref="${maxR || maxC ? 'A1:' + SD.addr(maxR, maxC) : 'A1'}"/>`;
      const sel = `<selection${pane ? ` pane="${fr.r && fr.c ? 'bottomRight' : fr.r ? 'bottomLeft' : 'topRight'}"` : ''} activeCell="${SD.addr(fr.r, fr.c)}" sqref="${SD.addr(fr.r, fr.c)}"/>`;
      zip.file(`xl/worksheets/sheet${n}.xml`, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        dim + `<sheetViews><sheetView${sh.showGrid === false ? ' showGridLines="0"' : ''}${i === wb.active ? ' tabSelected="1"' : ''}${sh.zoom && sh.zoom !== 1 ? ` zoomScale="${Math.round(sh.zoom * 100)}"` : ''} workbookViewId="0">${pane}${sel}</sheetView></sheetViews>` +
        `<sheetFormatPr baseColWidth="10" defaultColWidth="${pxToChars(SD.DEF_W)}" defaultRowHeight="${SD.DEF_H * 0.75}" customHeight="1"/>` + cols + `<sheetData>${data}</sheetData>` + autoFilter + merges +
        '<pageMargins left="0.511811024" right="0.511811024" top="0.787401575" bottom="0.787401575" header="0.31496062" footer="0.31496062"/>' + drawing + '</worksheet>');
    });
    const nS = wb.sheets.length;
    wbRels.push(`<Relationship Id="rId${nS + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`);
    wbRels.push(`<Relationship Id="rId${nS + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`);
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' + ct.join('') + '</Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(wb.name)}</dc:title><dc:creator>Stardust</dc:creator><cp:lastModifiedBy>Stardust</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
    zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Stardust by Nebulosa Workspace</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Planilhas</vt:lpstr></vt:variant><vt:variant><vt:i4>${nS}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="${nS}" baseType="lpstr">${wb.sheets.map(s => `<vt:lpstr>${X(s.name)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts><AppVersion>16.0300</AppVersion></Properties>`);
    zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr defaultThemeVersion="164011"/>' +
      `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000" activeTab="${wb.active}"/></bookViews><sheets>${wb.sheets.map((s, i) => `<sheet name="${X(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
      (definedNames.length ? `<definedNames>${definedNames.join('')}</definedNames>` : '') + '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>');
    zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + wbRels.join('') + '</Relationships>');
    zip.file('xl/styles.xml', st.xml());
    zip.file('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sst.length}" uniqueCount="${sst.length}">${sst.map(s => `<si><t${/^\s|\s$|\n/.test(s) ? ' xml:space="preserve"' : ''}>${X(s)}</t></si>`).join('')}</sst>`);
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 }, mimeType: FORMATOS.find(f => f.id === (macro ? 'xlsm' : 'xlsx')).mime });
  }

  /* ======================================================================
     XLSX / XLSM — leitura
     ====================================================================== */
  const P = s => new DOMParser().parseFromString(s, 'application/xml');
  const all = (n, tag) => n ? Array.from(n.getElementsByTagNameNS('*', tag)) : [];
  const one = (n, tag) => all(n, tag)[0] || null;
  const childrenNamed = (n, tag) => n ? Array.from(n.children).filter(x => x.localName === tag) : [];
  const attr = (n, a) => n ? n.getAttribute(a) : null;
  function textOf(n) { return all(n, 't').filter(t => !t.parentNode || t.parentNode.localName !== 'rPh').map(t => t.textContent).join(''); }
  function resolvePath(base, target) {
    if (target.startsWith('/')) return target.slice(1);
    const parts = base.split('/'); parts.pop();
    target.split('/').forEach(p => { if (p === '..') parts.pop(); else if (p !== '.') parts.push(p); });
    return parts.join('/');
  }
  async function rels(zip, path) {
    const dir = path.split('/'); const file = dir.pop();
    const rp = (dir.length ? dir.join('/') + '/' : '') + '_rels/' + file + '.rels';
    const f = zip.file(rp); if (!f) return {};
    const doc = P(await f.async('string')); const o = {};
    all(doc, 'Relationship').forEach(r => { o[attr(r, 'Id')] = { target: resolvePath(path, attr(r, 'Target')), type: attr(r, 'Type') }; });
    return o;
  }
  const THEME_DEFAULT = ['FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47'];
  function readColor(n, theme) {
    if (!n) return null;
    let hex = null;
    if (attr(n, 'rgb')) hex = attr(n, 'rgb').slice(-6);
    else if (attr(n, 'theme') !== null) { hex = (theme || THEME_DEFAULT)[+attr(n, 'theme')] || null; }
    else if (attr(n, 'indexed') !== null) { const ix = +attr(n, 'indexed'); const IDX = { 8: '000000', 9: 'FFFFFF', 10: 'FF0000', 11: '00FF00', 12: '0000FF', 13: 'FFFF00', 14: 'FF00FF', 15: '00FFFF', 64: null }; hex = IDX[ix] === undefined ? null : IDX[ix]; }
    if (!hex) return null;
    const tint = +attr(n, 'tint') || 0;
    if (tint) {
      const c = SD.hexToRgb(hex); const f = v => Math.round(tint < 0 ? v * (1 + tint) : v + (255 - v) * tint);
      hex = [c.r, c.g, c.b].map(v => f(v).toString(16).padStart(2, '0')).join('');
    }
    return '#' + hex.toLowerCase();
  }
  const BUILTIN_FMT = { 0: '', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 12: '# ?/?', 13: '# ??/??', 14: 'dd/mm/yyyy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'hh:mm', 21: 'hh:mm:ss', 22: 'dd/mm/yyyy hh:mm', 37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mmss.0', 48: '##0.0E+0', 49: '@' };

  async function readXlsx(buf) {
    const zip = await JSZip.loadAsync(buf);
    const wbPath = 'xl/workbook.xml';
    const wbDoc = P(await zip.file(wbPath).async('string'));
    const wbr = await rels(zip, wbPath);
    // tema (cores)
    let theme = null;
    const thRel = Object.values(wbr).find(r => /theme$/.test(r.type));
    if (thRel && zip.file(thRel.target)) {
      const td = P(await zip.file(thRel.target).async('string'));
      const cs = one(td, 'clrScheme');
      if (cs) {
        const order = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
        theme = order.map(nm => { const e = one(cs, nm); if (!e) return null; const s = one(e, 'srgbClr'), sy = one(e, 'sysClr'); return s ? attr(s, 'val') : sy ? (attr(sy, 'lastClr') || (nm === 'lt1' ? 'FFFFFF' : '000000')) : null; });
      }
    }
    // textos compartilhados
    let sst = [];
    const sstRel = Object.values(wbr).find(r => /sharedStrings$/.test(r.type));
    if (sstRel && zip.file(sstRel.target)) sst = childrenNamed(P(await zip.file(sstRel.target).async('string')).documentElement, 'si').map(textOf);
    // estilos
    let xfStyles = [];
    const stRel = Object.values(wbr).find(r => /styles$/.test(r.type));
    if (stRel && zip.file(stRel.target)) {
      const sd = P(await zip.file(stRel.target).async('string'));
      const nf = {}; all(one(sd, 'numFmts'), 'numFmt').forEach(n => { nf[attr(n, 'numFmtId')] = attr(n, 'formatCode'); });
      const fonts = all(one(sd, 'fonts'), 'font').map(f => {
        const o = {};
        if (one(f, 'b') && attr(one(f, 'b'), 'val') !== '0') o.b = true;
        if (one(f, 'i') && attr(one(f, 'i'), 'val') !== '0') o.i = true;
        if (one(f, 'u') && attr(one(f, 'u'), 'val') !== 'none') o.u = true;
        if (one(f, 'strike') && attr(one(f, 'strike'), 'val') !== '0') o.st = true;
        const sz = one(f, 'sz'); if (sz) o.fs = +attr(sz, 'val');
        const col = readColor(one(f, 'color'), theme); if (col && col !== '#000000') o.fc = col;
        const name = attr(one(f, 'name'), 'val') || '';
        if (/cambria|times|georgia|garamond|serif/i.test(name)) o.ff = 'serif'; else if (/consolas|courier|mono/i.test(name)) o.ff = 'mono';
        return o;
      });
      const base = fonts[0] || {};
      const fills = all(one(sd, 'fills'), 'fill').map(f => { const pf = one(f, 'patternFill'); if (!pf || attr(pf, 'patternType') !== 'solid') return null; return readColor(one(pf, 'fgColor'), theme); });
      const borders = all(one(sd, 'borders'), 'border').map(b => {
        const o = {}; let col = null;
        [['left', 'l'], ['right', 'r'], ['top', 't'], ['bottom', 'b']].forEach(([tag, k]) => { const e = one(b, tag); const s = attr(e, 'style'); if (s) { o[k] = /medium|thick|double/.test(s) ? (s === 'thick' ? 'thick' : 'medium') : 'thin'; col = col || readColor(one(e, 'color'), theme); } });
        if (!Object.keys(o).length) return null;
        if (col && col !== '#000000') o.c = col;
        return o;
      });
      xfStyles = all(one(sd, 'cellXfs'), 'xf').map(x => {
        const s = {};
        const fid = +attr(x, 'numFmtId') || 0;
        const z = nf[fid] !== undefined ? nf[fid] : BUILTIN_FMT[fid];
        if (z && z !== 'General') s.z = z;
        const f = fonts[+attr(x, 'fontId') || 0] || {};
        Object.keys(f).forEach(k => { if (k === 'fs') { if (f.fs !== (base.fs || 11)) s.fs = f.fs; } else if (f[k] !== base[k]) s[k] = f[k]; });
        const fill = fills[+attr(x, 'fillId') || 0]; if (fill) s.bg = fill;
        const bd = borders[+attr(x, 'borderId') || 0]; if (bd) s.bd = bd;
        const al = one(x, 'alignment');
        if (al) {
          const h = attr(al, 'horizontal'), v = attr(al, 'vertical');
          if (h && h !== 'general') s.ha = h === 'centerContinuous' ? 'center' : h === 'fill' ? 'left' : h;
          if (v) s.va = v === 'center' ? 'middle' : v === 'top' ? 'top' : 'bottom';
          if (s.va === 'bottom') delete s.va;
          if (attr(al, 'wrapText') === '1' || attr(al, 'wrapText') === 'true') s.wrap = true;
          if (+attr(al, 'indent')) s.ind = +attr(al, 'indent');
        }
        return Object.keys(s).length ? s : null;
      });
    }
    const wb = SD.newWorkbook(); wb.sheets = [];
    const sheetsEl = all(wbDoc, 'sheet');
    const actTab = +attr(one(wbDoc, 'workbookView'), 'activeTab') || 0;
    for (let si = 0; si < sheetsEl.length; si++) {
      const se = sheetsEl[si];
      const rid = se.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || attr(se, 'r:id');
      const rel = wbr[rid]; if (!rel || !zip.file(rel.target)) continue;
      const sh = SD.newSheet(attr(se, 'name') || 'Planilha' + (si + 1));
      if (attr(se, 'state') === 'hidden' || attr(se, 'state') === 'veryHidden') sh.hidden = true;
      const xml = await zip.file(rel.target).async('string');
      const sd = P(xml);
      // larguras e alturas
      const fmtPr = one(sd, 'sheetFormatPr');
      const defW = attr(fmtPr, 'defaultColWidth') ? charsToPx(+attr(fmtPr, 'defaultColWidth')) : (attr(fmtPr, 'baseColWidth') ? charsToPx(+attr(fmtPr, 'baseColWidth') + 0.71) : 64);
      const defH = attr(fmtPr, 'defaultRowHeight') ? Math.round(+attr(fmtPr, 'defaultRowHeight') / 0.75) : 20;
      const colStyle = {};
      all(one(sd, 'cols'), 'col').forEach(c => {
        const a = +attr(c, 'min') - 1, b = Math.min(+attr(c, 'max') - 1, a + 300);
        const w = attr(c, 'width') ? charsToPx(+attr(c, 'width')) : defW;
        for (let k = a; k <= b; k++) { if (attr(c, 'hidden') === '1') sh.colW[k] = 0; else if (Math.abs(w - SD.DEF_W) > 1) sh.colW[k] = w; if (attr(c, 's') && +attr(c, 's')) colStyle[k] = +attr(c, 's'); }
      });
      // a largura padrão do arquivo (normalmente 64 px) vira explícita nas colunas usadas
      const showGrid = one(sd, 'sheetView'); if (showGrid && attr(showGrid, 'showGridLines') === '0') sh.showGrid = false;
      const zs = showGrid && attr(showGrid, 'zoomScale'); if (zs && +zs !== 100) sh.zoom = Math.max(0.5, Math.min(2, +zs / 100));
      const pane = one(sd, 'pane');
      if (pane && /frozen/.test(attr(pane, 'state') || '')) sh.freeze = { r: Math.round(+attr(pane, 'ySplit') || 0), c: Math.round(+attr(pane, 'xSplit') || 0) };
      const shared = {};
      let maxC = -1;
      all(one(sd, 'sheetData'), 'row').forEach(rowEl => {
        const r = +attr(rowEl, 'r') - 1;
        if (attr(rowEl, 'ht') && (attr(rowEl, 'customHeight') === '1' || attr(rowEl, 'customHeight') === 'true' || Math.abs(+attr(rowEl, 'ht') / 0.75 - defH) > 1)) { const h = Math.round(+attr(rowEl, 'ht') / 0.75); if (Math.abs(h - SD.DEF_H) > 1) sh.rowH[r] = h; }
        if (attr(rowEl, 'hidden') === '1') sh.hiddenRows.add(r);
        let cIdx = -1;
        childrenNamed(rowEl, 'c').forEach(cEl => {
          const ref = attr(cEl, 'r');
          let rr = r, cc;
          if (ref) { const p = SD.parseAddr(ref); rr = p.r; cc = p.c; } else cc = cIdx + 1;
          cIdx = cc; maxC = Math.max(maxC, cc);
          const t = attr(cEl, 't') || 'n';
          const vEl = childrenNamed(cEl, 'v')[0], fEl = childrenNamed(cEl, 'f')[0];
          const cell = { v: null };
          const sIdx = attr(cEl, 's') !== null ? +attr(cEl, 's') : colStyle[cc];
          if (sIdx && xfStyles[sIdx]) cell.s = Object.assign({}, xfStyles[sIdx]);
          const raw = vEl ? vEl.textContent : null;
          if (t === 's') cell.v = raw !== null ? (sst[+raw] !== undefined ? sst[+raw] : '') : null;
          else if (t === 'inlineStr') cell.v = textOf(one(cEl, 'is'));
          else if (t === 'b') cell.v = raw === '1' || raw === 'true';
          else if (t === 'e') cell.v = SD.ERR[SD.ERR_PT[raw]] || new SD.Err(raw || '#VALOR!');
          else if (t === 'str') cell.v = raw;
          else if (t === 'd') { const d = new Date(raw); cell.v = isNaN(d) ? raw : (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000; }
          else cell.v = raw !== null && raw !== '' ? +raw : null;
          if (fEl) {
            const ft = attr(fEl, 't');
            let f = fEl.textContent;
            if (ft === 'shared') {
              const sidx = attr(fEl, 'si');
              if (f) shared[sidx] = { f: SD.F.fromFileFormula(f), r: rr, c: cc };
              else if (shared[sidx]) f = SD.F.shiftFormula(shared[sidx].f, rr - shared[sidx].r, cc - shared[sidx].c);
            }
            if (ft === 'array' && !f) f = '';
            if (f) { cell.f = SD.F.fromFileFormula(f); cell.val = cell.v; }
          }
          if (cell.v === null && !cell.f && !cell.s) return;
          sh.cells.set(SD.key(rr, cc), cell);
        });
      });
      // larguras padrão do arquivo nas colunas sem largura própria
      if (Math.abs(defW - SD.DEF_W) > 1) for (let k = 0; k <= Math.max(maxC, 25); k++) if (sh.colW[k] === undefined) sh.colW[k] = defW;
      if (Math.abs(defH - SD.DEF_H) > 2) { /* altura padrão diferente: mantém a do Stardust para ficar legível */ }
      all(one(sd, 'mergeCells'), 'mergeCell').forEach(m => { const g = SD.parseRange(attr(m, 'ref')); if (g && (g.r1 !== g.r2 || g.c1 !== g.c2)) sh.merges.push(g); });
      const af = one(sd, 'autoFilter'); if (af && attr(af, 'ref')) sh.filter = { range: attr(af, 'ref'), hidden: {} };
      // gráficos
      const shRels = await rels(zip, rel.target);
      const drEl = one(sd, 'drawing');
      if (drEl) {
        const drid = drEl.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || attr(drEl, 'r:id');
        const dRel = shRels[drid];
        if (dRel && zip.file(dRel.target)) {
          try { await readCharts(zip, dRel.target, sh); } catch (e) { console.warn('Stardust: gráfico não lido', e); }
        }
      }
      wb.sheets.push(sh);
    }
    if (!wb.sheets.length) wb.sheets.push(SD.newSheet('Planilha1'));
    wb.active = Math.min(actTab, wb.sheets.length - 1);
    return wb;
  }
  function pxFromAnchor(sh, el) {
    const c = +one(el, 'col').textContent, co = +one(el, 'colOff').textContent, r = +one(el, 'row').textContent, ro = +one(el, 'rowOff').textContent;
    let x = 0; for (let k = 0; k < c; k++) x += colPx(sh, k);
    let y = 0; for (let k = 0; k < r; k++) y += rowPx(sh, k);
    return { x: x + co / EMU, y: y + ro / EMU };
  }
  async function readCharts(zip, drawPath, sh) {
    const dd = P(await zip.file(drawPath).async('string'));
    const dr = await rels(zip, drawPath);
    const anchors = [...all(dd, 'twoCellAnchor'), ...all(dd, 'oneCellAnchor')];
    for (const an of anchors) {
      const chEl = one(an, 'chart'); if (!chEl) continue;
      const rid = chEl.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || attr(chEl, 'r:id');
      const cr = dr[rid]; if (!cr || !zip.file(cr.target)) continue;
      const a = pxFromAnchor(sh, one(an, 'from'));
      let w = 480, h = 300;
      const to = one(an, 'to'), ext = childrenNamed(an, 'ext')[0];
      if (to) { const b = pxFromAnchor(sh, to); w = b.x - a.x; h = b.y - a.y; } else if (ext) { w = +attr(ext, 'cx') / EMU; h = +attr(ext, 'cy') / EMU; }
      const cd = P(await zip.file(cr.target).async('string'));
      const plot = one(cd, 'plotArea'); if (!plot) continue;
      const kinds = ['barChart', 'bar3DChart', 'lineChart', 'line3DChart', 'areaChart', 'area3DChart', 'pieChart', 'pie3DChart', 'doughnutChart', 'scatterChart'];
      const kEl = Array.from(plot.children).find(n => kinds.includes(n.localName)); if (!kEl) continue;
      const k = kEl.localName;
      const ch = { id: 'g' + Math.random().toString(36).slice(2, 9), sheetId: sh.id, x: Math.round(a.x), y: Math.round(a.y), w: Math.max(160, Math.round(w)), h: Math.max(120, Math.round(h)) };
      if (/^bar/.test(k)) ch.tipo = attr(one(kEl, 'barDir'), 'val') === 'bar' ? 'barras' : 'colunas';
      else if (/^line/.test(k)) ch.tipo = 'linhas';
      else if (/^area/.test(k)) ch.tipo = 'area';
      else if (/^pie/.test(k)) ch.tipo = 'pizza';
      else if (k === 'doughnutChart') ch.tipo = 'rosca';
      else ch.tipo = 'dispersao';
      const grp = attr(one(kEl, 'grouping'), 'val'); if (/stacked/i.test(grp || '')) ch.empilhado = true;
      const tEl = childrenNamed(one(cd, 'chart'), 'title')[0];
      if (tEl) ch.titulo = all(tEl, 't').map(t => t.textContent).join('') || '';
      const lg = one(cd, 'legend'); ch.legenda = !lg ? 'nenhuma' : attr(one(lg, 'legendPos'), 'val') === 'r' ? 'direita' : 'baixo';
      const dl = one(kEl, 'dLbls'); if (dl && (attr(one(dl, 'showVal'), 'val') === '1')) ch.rotulos = true;
      // intervalo: junta as referências das séries
      const refs = all(kEl, 'f').map(f => f.textContent).filter(Boolean);
      let g = null, porLinhas = null;
      refs.forEach(f => {
        const m = /!?\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/i.exec(f.replace(/^\(|\)$/g, ''));
        if (!m) return;
        const rr = SD.norm({ r1: +m[2] - 1, c1: SD.colIndex(m[1]), r2: +(m[4] || m[2]) - 1, c2: SD.colIndex(m[3] || m[1]) });
        g = g ? { r1: Math.min(g.r1, rr.r1), c1: Math.min(g.c1, rr.c1), r2: Math.max(g.r2, rr.r2), c2: Math.max(g.c2, rr.c2) } : rr;
      });
      const valRefs = all(kEl, 'val').concat(all(kEl, 'yVal')).map(v => one(v, 'f')).filter(Boolean).map(f => f.textContent);
      if (valRefs.length) { const m = /\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/i.exec(valRefs[0]); if (m) porLinhas = m[2] === m[4] && m[1] !== m[3]; }
      if (!g) continue;
      ch.range = SD.rangeStr(g);
      if (porLinhas !== null) ch.porLinhas = porLinhas;
      sh.charts.push(ch);
    }
  }

  /* ======================================================================
     SheetJS — XLS, XLSB, ODS (escrita e leitura)
     ====================================================================== */
  const ERR_CODE = { '#NULL!': 0x00, '#DIV/0!': 0x07, '#VALUE!': 0x0F, '#REF!': 0x17, '#NAME?': 0x1D, '#NUM!': 0x24, '#N/A': 0x2A };
  function toSheetJS(wb, fmt) {
    const out = XLSX.utils.book_new();
    wb.sheets.forEach(sh => {
      const ws = {};
      let maxR = 0, maxC = 0;
      sh.cells.forEach((c, k) => {
        const [r, cc] = SD.unkey(k);
        const v = c.f ? c.val : c.v;
        const z = c.s && c.s.z;
        let o = null;
        if (typeof v === 'number') o = { t: 'n', v };
        else if (typeof v === 'boolean') o = { t: 'b', v };
        else if (SD.isErr(v)) { const en = SD.ERR_EN[v.err] || '#VALUE!'; o = { t: 'e', v: ERR_CODE[en] !== undefined ? ERR_CODE[en] : 0x0F, w: en }; }
        else if (v !== null && v !== undefined && v !== '') o = { t: 's', v: String(v) };
        else if (c.f) o = { t: 's', v: '' };
        if (!o) return;
        if (c.f && fmt !== 'xls') o.f = SD.F.toFileFormula(c.f).replace(/_xlfn\./g, fmt === 'ods' ? '' : '_xlfn.');
        if (z) o.z = z;
        ws[SD.addr(r, cc)] = o;
        maxR = Math.max(maxR, r); maxC = Math.max(maxC, cc);
      });
      ws['!ref'] = 'A1:' + SD.addr(maxR, maxC);
      const nC = Math.max(maxC + 1, ...Object.keys(sh.colW).map(k => +k + 1), 1);
      ws['!cols'] = Array.from({ length: nC }, (_, c) => ({ wpx: colPx(sh, c), wch: pxToChars(colPx(sh, c)) }));
      const rowKeys = Object.keys(sh.rowH).map(Number);
      if (rowKeys.length) { ws['!rows'] = []; rowKeys.forEach(r => { ws['!rows'][r] = { hpx: sh.rowH[r], hpt: sh.rowH[r] * 0.75 }; }); }
      if (sh.merges.length) ws['!merges'] = sh.merges.map(m => ({ s: { r: m.r1, c: m.c1 }, e: { r: m.r2, c: m.c2 } }));
      XLSX.utils.book_append_sheet(out, ws, sh.name.slice(0, 31));
    });
    return out;
  }
  function writeSheetJS(wb, fmt) {
    const book = toSheetJS(wb, fmt);
    const bookType = fmt === 'xls' ? 'biff8' : fmt;
    return XLSX.write(book, { bookType, type: 'array', compression: true });
  }
  // referências no estilo OpenDocument que a SheetJS às vezes deixa passar: [$'Planilha'.A1:.B2] → 'Planilha'!A1:B2
  function odsParaExcel(f) {
    if (!/\[/.test(f)) return f;
    return f.replace(/\[([^\]"]+)\]/g, (m, inner) => {
      const partes = inner.split(':').map(p => { const q = /^\$?(?:'((?:[^']|'')*)'|([^.']*))\.(\$?[A-Za-z]+\$?\d+|\$?[A-Za-z]+|\$?\d+)$/.exec(p.trim()); return q ? { sh: q[1] !== undefined ? q[1].replace(/''/g, "'") : (q[2] || ''), ref: q[3] } : null; });
      if (partes.some(x => !x)) return m;
      const sh = partes[0].sh;
      const pref = sh ? (/^[A-Za-z_\u00C0-\u024F][\w.\u00C0-\u024F]*$/.test(sh) ? sh : "'" + sh.replace(/'/g, "''") + "'") + '!' : '';
      return pref + partes.map(x => x.ref).join(':');
    });
  }
  function fromSheetJS(book) {
    const wb = SD.newWorkbook(); wb.sheets = [];
    book.SheetNames.forEach((name, i) => {
      const ws = book.Sheets[name];
      const sh = SD.newSheet(name);
      const hid = book.Workbook && book.Workbook.Sheets && book.Workbook.Sheets[i] && book.Workbook.Sheets[i].Hidden;
      if (hid) sh.hidden = true;
      Object.keys(ws).forEach(a => {
        if (a[0] === '!') return;
        const p = SD.parseAddr(a); if (!p) return;
        const c = ws[a]; const cell = { v: null };
        if (c.t === 'n') cell.v = c.v;
        else if (c.t === 'b') cell.v = !!c.v;
        else if (c.t === 'e') cell.v = SD.ERR[SD.ERR_PT[c.w]] || SD.ERR['#VALOR!'];
        else if (c.t === 'd') cell.v = (c.v - new Date(Date.UTC(1899, 11, 30))) / 86400000;
        else if (c.t === 's') cell.v = c.v;
        else if (c.t === 'z') cell.v = null;
        if (c.f) { cell.f = odsParaExcel(SD.F.fromFileFormula(c.f).replace(/^of:=?/i, '')); cell.val = cell.v; }
        if (c.z && c.z !== 'General') cell.s = { z: c.z };
        if (c.s && c.s.fgColor && c.s.fgColor.rgb && c.s.patternType === 'solid') { cell.s = cell.s || {}; cell.s.bg = '#' + c.s.fgColor.rgb.slice(-6).toLowerCase(); }
        if (cell.v === null && !cell.f && !cell.s) return;
        sh.cells.set(SD.key(p.r, p.c), cell);
      });
      (ws['!cols'] || []).forEach((c, k) => { if (!c) return; const w = c.wpx || (c.wch ? charsToPx(c.wch) : c.width ? charsToPx(c.width) : null); if (c.hidden) sh.colW[k] = 0; else if (w && Math.abs(w - SD.DEF_W) > 1) sh.colW[k] = Math.round(w); });
      (ws['!rows'] || []).forEach((r, k) => { if (!r) return; const h = r.hpx || (r.hpt ? r.hpt / 0.75 : null); if (r.hidden) sh.hiddenRows.add(k); else if (h && Math.abs(h - SD.DEF_H) > 1) sh.rowH[k] = Math.round(h); });
      (ws['!merges'] || []).forEach(m => sh.merges.push({ r1: m.s.r, c1: m.s.c, r2: m.e.r, c2: m.e.c }));
      wb.sheets.push(sh);
    });
    if (!wb.sheets.length) wb.sheets.push(SD.newSheet('Planilha1'));
    return wb;
  }

  /* ======================================================================
     CSV
     ====================================================================== */
  function writeCsv(wb, sep) {
    const sh = wb.sheets[wb.active];
    const b = SD.sheetDataBounds(sh);
    if (!b) return '﻿';
    const lines = [];
    for (let r = 0; r <= b.r2; r++) {
      const row = [];
      for (let c = 0; c <= b.c2; c++) {
        const cell = sh.cells.get(r + ',' + c);
        let t = '';
        if (cell) {
          const v = cell.f ? cell.val : cell.v;
          if (sep === ',' && typeof v === 'number' && !(cell.s && SD.isDateFormat(cell.s.z))) t = String(v);
          else t = SD.formatValue(v, cell.s && cell.s.z).t;
        }
        if (t.includes(sep) || /["\n\r]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
        row.push(t);
      }
      lines.push(row.join(sep));
    }
    return '﻿' + lines.join('\r\n') + '\r\n';
  }
  function readCsv(text, name) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/).slice(0, 5).join('\n');
    const count = ch => (first.match(new RegExp('\\' + ch, 'g')) || []).length;
    const sep = ['\t', ';', ','].sort((a, b) => count(b) - count(a))[0];
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
      if (ch === '"' && cur === '') { q = true; continue; }
      if (ch === sep) { row.push(cur); cur = ''; continue; }
      if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; continue; }
      cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    const wb = SD.newWorkbook();
    const sh = wb.sheets[0];
    sh.name = (name || 'Planilha1').replace(/\.[^.]+$/, '').slice(0, 31) || 'Planilha1';
    rows.forEach((r, ri) => r.forEach((t, ci) => {
      if (t === '') return;
      let p;
      if (sep === ',' && /^-?\d+(\.\d+)?$/.test(t.trim())) p = { v: parseFloat(t) };
      else p = SD.parseInput(t);
      if (typeof p.v === 'string' && /^=/.test(t)) p = { v: t };
      const cell = { v: p.v }; if (p.z) cell.s = { z: p.z };
      sh.cells.set(SD.key(ri, ci), cell);
    }));
    return wb;
  }

  /* ======================================================================
     Abrir (detecta o formato)
     ====================================================================== */
  async function abrir(file) {
    const name = file.name || 'planilha';
    const ext = (name.split('.').pop() || '').toLowerCase();
    const buf = await file.arrayBuffer();
    let wb, fmt = ext;
    if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
      let text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
      if (/�/.test(text)) text = new TextDecoder('windows-1252').decode(buf);
      wb = readCsv(text, name); fmt = 'csv';
    } else if (ext === 'xlsx' || ext === 'xlsm' || ext === 'xltx' || ext === 'xltm') {
      try { wb = await readXlsx(buf); }
      catch (e) { console.warn('Stardust: leitura própria falhou, usando a SheetJS', e); wb = fromSheetJS(XLSX.read(new Uint8Array(buf), { type: 'array', cellFormula: true, cellNF: true, cellStyles: true })); }
    } else {
      if (!window.XLSX) throw new Error('A biblioteca de planilhas não carregou.');
      wb = fromSheetJS(XLSX.read(new Uint8Array(buf), { type: 'array', cellFormula: true, cellNF: true, cellStyles: true, codepage: 1252 }));
    }
    wb.name = name.replace(/\.[^.]+$/, '');
    wb.format = ['xlsx', 'xlsm', 'xlsb', 'xls', 'ods'].includes(fmt) ? fmt : fmt === 'csv' ? 'csv' : 'xlsx';
    return wb;
  }

  /* ======================================================================
     Imagem (JPG) e PDF
     ====================================================================== */
  function areaImpressao(sh) {
    const b = SD.sheetDataBounds(sh) || { r1: 0, c1: 0, r2: 0, c2: 0 };
    const u = SD.sheetUsed(sh);
    return { r1: 0, c1: 0, r2: Math.max(b.r2, u.r2, 0), c2: Math.max(b.c2, u.c2, 0) };
  }
  async function jpg(wb, opts) {
    opts = opts || {};
    const sh = wb.sheets[wb.active];
    const g = opts.area || areaImpressao(sh);
    let W = 0; for (let c = g.c1; c <= g.c2; c++) W += colPx(sh, c);
    let H = 0; for (let r = g.r1; r <= g.r2; r++) H += sh.hiddenRows.has(r) ? 0 : rowPx(sh, r);
    // gráficos ampliam a área
    let x0 = 0, y0 = 0; for (let c = 0; c < g.c1; c++) x0 += colPx(sh, c); for (let r = 0; r < g.r1; r++) y0 += rowPx(sh, r);
    sh.charts.forEach(ch => { W = Math.max(W, ch.x - x0 + ch.w + 8); H = Math.max(H, ch.y - y0 + ch.h + 8); });
    const pad = 16;
    let esc = opts.escala || 2;
    const maxDim = 12000;
    if ((W + pad * 2) * esc > maxDim || (H + pad * 2) * esc > maxDim) esc = Math.max(0.25, Math.min(maxDim / (W + pad * 2), maxDim / (H + pad * 2)));
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((W + pad * 2) * esc); cv.height = Math.ceil((H + pad * 2) * esc);
    const ctx = cv.getContext('2d');
    ctx.scale(esc, esc);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W + pad * 2, H + pad * 2);
    ctx.translate(pad, pad);
    SD.pintarArea(ctx, wb, sh, g, { grade: opts.grade !== false, impressao: true });
    sh.charts.forEach(ch => {
      const img = SD.G.imagem(wb, ch, ch.w, ch.h, esc, SD.temaGraficoImpressao());
      ctx.save(); ctx.drawImage(img, ch.x - x0, ch.y - y0, ch.w, ch.h); ctx.strokeStyle = '#d0d4dc'; ctx.strokeRect(ch.x - x0 + .5, ch.y - y0 + .5, ch.w - 1, ch.h - 1); ctx.restore();
    });
    return new Promise(res => cv.toBlob(b => res(b), 'image/jpeg', 0.93));
  }

  async function pdf(wb, opts) {
    opts = Object.assign({ orientacao: 'retrato', ajustar: true, grade: true, todas: false, graficos: true }, opts || {});
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    doc.setTitle(wb.name); doc.setCreator('Stardust by Nebulosa Workspace'); doc.setProducer('Stardust');
    const fonts = {
      r: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold),
      i: await doc.embedFont(StandardFonts.HelveticaOblique), bi: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
      sr: await doc.embedFont(StandardFonts.TimesRoman), sb: await doc.embedFont(StandardFonts.TimesRomanBold), si: await doc.embedFont(StandardFonts.TimesRomanItalic), sbi: await doc.embedFont(StandardFonts.TimesRomanBoldItalic),
      mr: await doc.embedFont(StandardFonts.Courier), mb: await doc.embedFont(StandardFonts.CourierBold), mi: await doc.embedFont(StandardFonts.CourierOblique), mbi: await doc.embedFont(StandardFonts.CourierBoldOblique)
    };
    const okChars = new Set(fonts.r.getCharacterSet());
    const safe = t => Array.from(String(t)).map(ch => okChars.has(ch.codePointAt(0)) ? ch : (ch === '\t' ? ' ' : '?')).join('');
    const pickFont = s => { const p = s && s.ff === 'serif' ? 's' : s && s.ff === 'mono' ? 'm' : ''; const k = (s && s.b ? 'b' : '') + (s && s.i ? 'i' : ''); return fonts[(p || '') + (k || 'r')] || fonts[p + 'r'] || fonts.r; };
    const col = h => { const c = SD.hexToRgb(h) || { r: 0, g: 0, b: 0 }; return rgb(c.r / 255, c.g / 255, c.b / 255); };
    const A4 = [595.28, 841.89];
    const [PW, PH] = opts.orientacao === 'paisagem' ? [A4[1], A4[0]] : A4;
    const M = 36; // margem 1,27 cm
    const sheets = opts.todas ? wb.sheets.filter(s => !s.hidden) : [wb.sheets[wb.active]];
    for (const sh of sheets) {
      const g = areaImpressao(sh);
      const cols = []; for (let c = g.c1; c <= g.c2; c++) cols.push(c);
      const totalW = cols.reduce((s, c) => s + colPx(sh, c), 0) * 0.75;
      const k = opts.ajustar ? Math.min(1, (PW - 2 * M) / Math.max(1, totalW)) : 1;
      // grupos de colunas por página (se não couber na largura)
      const colGroups = []; let cur = [], w = 0;
      cols.forEach(c => { const cw = colPx(sh, c) * 0.75 * k; if (w + cw > PW - 2 * M && cur.length) { colGroups.push(cur); cur = []; w = 0; } cur.push(c); w += cw; });
      if (cur.length) colGroups.push(cur);
      const rows = []; for (let r = g.r1; r <= g.r2; r++) if (!sh.hiddenRows.has(r)) rows.push(r);
      const mergeAt = new Map(); const covered = new Set();
      sh.merges.forEach(m => { mergeAt.set(m.r1 + ',' + m.c1, m); for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) if (r !== m.r1 || c !== m.c1) covered.add(r + ',' + c); });
      let page = null, y = 0;
      const newPage = () => { page = doc.addPage([PW, PH]); y = PH - M; if (sheets.length > 1 || opts.titulo) { page.drawText(safe(sh.name), { x: M, y: PH - M + 12, size: 9, font: fonts.b, color: rgb(.4, .42, .48) }); } };
      for (const grp of colGroups) {
        newPage();
        const xs = {}; let x = M; grp.forEach(c => { xs[c] = x; x += colPx(sh, c) * 0.75 * k; });
        const xEnd = x;
        for (const r of rows) {
          const rh = rowPx(sh, r) * 0.75 * k;
          if (y - rh < M) newPage();
          const yTop = y, yBot = y - rh;
          grp.forEach((c, gi) => {
            const key = r + ',' + c;
            if (covered.has(key)) return;
            const m = mergeAt.get(key);
            let cw = colPx(sh, c) * 0.75 * k, ch2 = rh;
            if (m) { cw = 0; for (let cc = m.c1; cc <= m.c2; cc++) if (grp.includes(cc)) cw += colPx(sh, cc) * 0.75 * k; ch2 = 0; for (let rr = m.r1; rr <= m.r2; rr++) if (!sh.hiddenRows.has(rr)) ch2 += rowPx(sh, rr) * 0.75 * k; }
            const cell = sh.cells.get(key), s = cell && cell.s || {};
            const x0 = xs[c], yb = yTop - ch2;
            if (s.bg) page.drawRectangle({ x: x0, y: yb, width: cw, height: ch2, color: col(s.bg) });
            if (opts.grade && sh.showGrid !== false) page.drawRectangle({ x: x0, y: yb, width: cw, height: ch2, borderColor: rgb(.82, .84, .87), borderWidth: 0.4 });
            if (s.bd) {
              const bc = col(s.bd.c || '#000000'), wv = v => v === 'thick' ? 1.6 : v === 'medium' ? 1 : 0.5;
              if (s.bd.t) page.drawLine({ start: { x: x0, y: yTop }, end: { x: x0 + cw, y: yTop }, thickness: wv(s.bd.t), color: bc });
              if (s.bd.b) page.drawLine({ start: { x: x0, y: yb }, end: { x: x0 + cw, y: yb }, thickness: wv(s.bd.b), color: bc });
              if (s.bd.l) page.drawLine({ start: { x: x0, y: yb }, end: { x: x0, y: yTop }, thickness: wv(s.bd.l), color: bc });
              if (s.bd.r) page.drawLine({ start: { x: x0 + cw, y: yb }, end: { x: x0 + cw, y: yTop }, thickness: wv(s.bd.r), color: bc });
            }
            if (!cell) return;
            const v = cell.f ? cell.val : cell.v;
            const fv = SD.formatValue(v, s.z);
            let t = safe(fv.t); if (!t) return;
            const font = pickFont(s), size = (s.fs || 11) * k * 0.92;
            const pad = 2.5 * k;
            const ha = s.ha || (typeof v === 'number' ? 'right' : typeof v === 'boolean' || SD.isErr(v) ? 'center' : 'left');
            // texto que não cabe: corta (números viram ###, como no Excel)
            let tw = font.widthOfTextAtSize(t, size);
            let avail = cw - pad * 2;
            if (tw > avail && ha === 'left' && typeof v === 'string' && !s.wrap) {
              // transborda para as células vazias à direita
              let extra = 0, cc = c + 1;
              while (tw > avail + extra && grp.includes(cc) && !sh.cells.get(r + ',' + cc) && !covered.has(r + ',' + cc)) { extra += colPx(sh, cc) * 0.75 * k; cc++; }
              avail += extra;
            }
            const lines = [];
            if (s.wrap) {
              const words = t.split(/(\s+)/); let line = '';
              words.forEach(wd => { const test = line + wd; if (font.widthOfTextAtSize(test.trim(), size) > avail && line.trim()) { lines.push(line.trim()); line = wd.trimStart(); } else line = test; });
              if (line.trim()) lines.push(line.trim());
            } else {
              if (tw > avail) {
                if (typeof v === 'number') t = '#'.repeat(Math.max(1, Math.floor(avail / font.widthOfTextAtSize('#', size))));
                else { while (t.length > 1 && font.widthOfTextAtSize(t, size) > avail) t = t.slice(0, -1); }
              }
              lines.push(t);
            }
            const lh = size * 1.18, blockH = lines.length * lh;
            const va = s.va || 'bottom';
            let ty = va === 'top' ? yTop - pad - size * 0.82 : va === 'middle' ? yb + (ch2 + blockH) / 2 - size * 0.86 : yb + pad + (lines.length - 1) * lh + size * 0.18;
            const color = col(fv.c || s.fc || '#1b1d24');
            lines.forEach(ln => {
              const lw = font.widthOfTextAtSize(ln, size);
              const tx = ha === 'right' ? x0 + cw - pad - lw : ha === 'center' ? x0 + (cw - lw) / 2 : x0 + pad + (s.ind || 0) * 7 * k;
              if (ty > yb - size && ty < yTop) page.drawText(ln, { x: tx, y: ty, size, font, color });
              if (s.u) page.drawLine({ start: { x: tx, y: ty - 1.2 }, end: { x: tx + lw, y: ty - 1.2 }, thickness: 0.6, color });
              if (s.st) page.drawLine({ start: { x: tx, y: ty + size * 0.3 }, end: { x: tx + lw, y: ty + size * 0.3 }, thickness: 0.6, color });
              ty -= lh;
            });
            void gi; void xEnd;
          });
          y -= rh;
        }
      }
      // gráficos no fim
      if (opts.graficos && sh.charts.length) {
        for (const chrt of sh.charts) {
          const maxW = PW - 2 * M, scale = Math.min(1, maxW / (chrt.w * 0.75));
          const w = chrt.w * 0.75 * scale, h = chrt.h * 0.75 * scale;
          if (y - h - 14 < M) newPage();
          const cv = SD.G.imagem(wb, chrt, chrt.w, chrt.h, 2.5, SD.temaGraficoImpressao());
          const png = await doc.embedPng(cv.toDataURL('image/png'));
          y -= 14;
          page.drawImage(png, { x: M, y: y - h, width: w, height: h });
          y -= h;
        }
      }
    }
    if (!doc.getPageCount()) doc.addPage([PW, PH]);
    return doc.save();
  }

  /* ======================================================================
     Salvar (gera os bytes do formato escolhido)
     ====================================================================== */
  async function gerar(wb, fmt, opts) {
    switch (fmt) {
      case 'xlsx': return new Blob([await writeXlsx(wb, false)], { type: FORMATOS[0].mime });
      case 'xlsm': return new Blob([await writeXlsx(wb, true)], { type: FORMATOS[1].mime });
      case 'xlsb': case 'xls': case 'ods': {
        if (!window.XLSX) throw new Error('A biblioteca de planilhas (SheetJS) não carregou.');
        return new Blob([writeSheetJS(wb, fmt)], { type: FORMATOS.find(f => f.id === fmt).mime });
      }
      case 'csv': return new Blob([writeCsv(wb, ';')], { type: 'text/csv;charset=utf-8' });
      case 'csvv': return new Blob([writeCsv(wb, ',')], { type: 'text/csv;charset=utf-8' });
      case 'pdf': if (!window.PDFLib) throw new Error('A biblioteca de PDF não carregou.'); return new Blob([await pdf(wb, opts)], { type: 'application/pdf' });
      case 'jpg': return jpg(wb, opts);
    }
    throw new Error('Formato desconhecido: ' + fmt);
  }

  SD.IO = { FORMATOS, gerar, abrir, writeXlsx, readXlsx, writeCsv, readCsv, toSheetJS, fromSheetJS, pdf, jpg, colPx, rowPx, areaImpressao };
})();
