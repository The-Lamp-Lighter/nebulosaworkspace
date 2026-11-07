/* ==========================================================================
   Utilidades — Conversor de arquivos (js/conversor.js) — 1.0
   A tela: solte arquivos, escolha o formato de saída, ajuste as opções e baixe.
   O trabalho pesado fica nos motores de js/conversor/ (documentos, planilhas, imagens, áudio/vídeo, arquivos).
   Tudo roda no navegador; nada é enviado para a internet (só o download único de FFmpeg/ImageMagick, se você aceitar).
   ========================================================================== */
(function () {
  'use strict';
  const { $, $$, esc, T, ICO, tam } = UT, CV = UT.CV, FMT = CV.FMT;
  const PREFERIDO = { docx: 'pdf', odt: 'pdf', rtf: 'pdf', md: 'pdf', html: 'pdf', txt: 'pdf', epub: 'pdf', fb2: 'epub', pdf: 'docx', xlsx: 'pdf', xls: 'xlsx', ods: 'xlsx', csv: 'xlsx', tsv: 'xlsx', json: 'csv',
    png: 'jpg', jpg: 'png', webp: 'png', gif: 'png', bmp: 'png', avif: 'jpg', heic: 'jpg', tiff: 'jpg', psd: 'png', svg: 'png', ico: 'png',
    wav: 'mp3', flac: 'mp3', m4a: 'mp3', ogg: 'mp3', aac: 'mp3', wma: 'mp3', mp3: 'wav', mp4: 'mp3', mov: 'mp4', mkv: 'mp4', avi: 'mp4', webm: 'mp4', wmv: 'mp4', flv: 'mp4', zip: 'tgz', tar: 'zip', tgz: 'zip', gz: 'zip' };
  const MB_MOTOR = { ffmpeg: 32, magick: 16 };
  let el, itens = [], seq = 0, rodando = false, aberto = null, ultimo = UT.ler('conversor', {});
  const tipoIcone = cat => ({ imagem: ICO.imagem }[cat] || ICO.arquivo);

  const nome = id => T(FMT[id].nome);
  function nomeCat(c) { return T(CV.CATS[c] || c); }
  function alvosAgrupados(de) {
    const g = {};
    CV.alvos(de).forEach(id => { const c = FMT[id].cat; (g[c] = g[c] || []).push(id); });
    return CV.CAT_ORDEM.filter(c => g[c]).map(c => [c, g[c]]);
  }
  function alvoPadrao(de) {
    const t = CV.alvos(de), u = ultimo[de];
    if (u && t.includes(u)) return u;
    if (PREFERIDO[de] && t.includes(PREFERIDO[de])) return PREFERIDO[de];
    return t[0] || '';
  }
  function precisaMotor(it) {
    if (!it.de || !it.alvo) return '';
    const m = CV.motorDe(it.de, it.alvo);
    return (m && m.pesado && m.pesado(it.de, it.alvo)) || '';
  }

  function montar(v) {
    el = v;
    v.innerHTML = `<div class="cab"><div><h1>${esc(T('Conversor de arquivos'))}</h1><p>${esc(T('Converta documentos, planilhas, imagens, áudio, vídeo e arquivos compactados. Tudo é feito no seu computador: os arquivos não são enviados para lugar nenhum.'))}</p></div>
      <div class="linha"><button class="btn" id="cvLimpar" hidden>${ICO.lixo}<span>${esc(T('Limpar'))}</span></button><button class="btn" id="cvZip" hidden>${ICO.baixar}<span>${esc(T('Baixar tudo (.zip)'))}</span></button><button class="btn pri" id="cvTudo" hidden>${ICO.trocar}<span>${esc(T('Converter tudo'))}</span></button></div></div>
      <div class="solte" id="cvSolte"><b>${esc(T('Solte os arquivos aqui'))}</b>${esc(T('ou clique para escolher · também dá para colar com Ctrl+V'))}<br><button class="btn pri" data-escolher>${ICO.arquivo}<span>${esc(T('Escolher arquivos'))}</span></button></div>
      <div class="painel cv-todos" id="cvTodos" hidden><label class="campo"><span>${esc(T('Converter todos para o mesmo formato'))}</span><select class="in" id="cvTodosSel"></select></label></div>
      <div class="cv-lista" id="cvLista"></div>
      <details class="painel cv-ajuda"><summary>${esc(T('Formatos aceitos e limites'))}</summary><div id="cvAjuda"></div></details>`;
    UT.zona($('#cvSolte', v), { multiplo: true, aoArquivos: adicionar, recusa: T('Não foi possível ler esses arquivos.') });
    $('#cvLimpar', v).addEventListener('click', limpar);
    $('#cvTudo', v).addEventListener('click', converterTudo);
    $('#cvZip', v).addEventListener('click', baixarTudo);
    $('#cvTodosSel', v).addEventListener('change', e => { const a = e.target.value; if (!a) return; itens.forEach(it => { if (!it.proc && CV.alvos(it.de).includes(a)) mudarAlvo(it, a, true); }); render(); e.target.value = ''; });
    $('#cvLista', v).addEventListener('click', aoClicar);
    $('#cvLista', v).addEventListener('change', aoMudar);
    $('#cvLista', v).addEventListener('input', aoMudar);
    document.addEventListener('paste', e => { if (UT.atual !== 'conversor') return; const fs = [...(e.clipboardData ? e.clipboardData.files : [])]; if (fs.length) { e.preventDefault(); adicionar(fs); } });
    ajuda();
    render();
  }

  function ajuda() {
    const ent = CV.entradas(), por = {};
    ent.forEach(id => { (por[FMT[id].cat] = por[FMT[id].cat] || []).push(id); });
    const saidas = {}; Object.keys(FMT).forEach(id => { if (FMT[id].sai && ent.some(e => e !== id && CV.alvos(e).includes(id))) (saidas[FMT[id].cat] = saidas[FMT[id].cat] || []).push(id); });
    const nomes = l => l.map(nome).join(', ');
    $('#cvAjuda', el).innerHTML = `<table class="cv-tab"><thead><tr><th>${esc(T('Tipo'))}</th><th>${esc(T('Abre'))}</th><th>${esc(T('Gera'))}</th></tr></thead><tbody>${CV.CAT_ORDEM.filter(c => por[c] || saidas[c]).map(c => `<tr><th>${esc(nomeCat(c))}</th><td>${esc(nomes(por[c] || []))}</td><td>${esc(nomes(saidas[c] || []))}</td></tr>`).join('')}</tbody></table>
      <ul class="cv-lim">
        <li>${esc(T('Funciona sem internet. Só o áudio/vídeo (FFmpeg, ~32 MB) e alguns formatos de imagem (ImageMagick, ~16 MB) precisam de um componente extra, baixado uma única vez e guardado no navegador.'))}</li>
        <li>${esc(T('Documentos são reconstruídos a partir do texto, títulos, listas, tabelas e imagens. Colunas, caixas de texto, campos, cabeçalhos/rodapés e a aparência exata do original não são mantidos.'))}</li>
        <li>${esc(T('Não convertemos: .doc, .ppt e outros formatos antigos do Office, PowerPoint (.pptx), MOBI/AZW3, RAW de câmeras, 7z/RAR, WOFF2 e PDFs com senha. PDFs digitalizados viram imagens, sem reconhecimento de texto (OCR).'))}</li>
        <li>${esc(T('Vídeos grandes demoram e arquivos acima de cerca de 1,5 GB podem não caber na memória do navegador.'))}</li>
      </ul>`;
  }

  /* ---------- arquivos ---------- */
  async function adicionar(fs) {
    let rec = 0;
    for (const f of fs) {
      const de = await CV.detectar(f);
      if (!de || !CV.alvos(de).length) { rec++; itens.push({ id: ++seq, file: f, de: '', alvo: '', opts: {}, estado: 'erro', msg: T('Formato não reconhecido ou ainda não suportado.') }); continue; }
      const alvo = alvoPadrao(de);
      itens.push({ id: ++seq, file: f, de, alvo, opts: CV.valoresPadrao(de, alvo), estado: 'espera', prog: 0, msg: '' });
    }
    render();
    if (rec && rec === fs.length) UT.aviso(T('Nenhum desses arquivos tem um formato que o Conversor conheça.'), true);
  }
  function mudarAlvo(it, a, silencio) {
    it.alvo = a; it.opts = Object.assign(CV.valoresPadrao(it.de, a), (ultimo['_' + a] || {}));
    Object.keys(it.opts).forEach(k => { const o = CV.opcoes(it.de, a).find(x => x.id === k); if (!o) delete it.opts[k]; });
    ultimo[it.de] = a; UT.guardar('conversor', ultimo);
    it.estado = 'espera'; it.saidas = null; it.msg = '';
    if (!silencio) render();
  }
  function limpar() { itens.filter(i => i.proc).forEach(i => { i.cancel = true; }); itens = []; render(); }
  const achar = id => itens.find(i => i.id === +id);

  /* ---------- tela ---------- */
  function opcoesHtml(it) {
    const ops = CV.opcoes(it.de, it.alvo);
    if (!ops.length) return `<p class="dica">${esc(T('Este formato não tem opções.'))}</p>`;
    return `<div class="cv-ops">${ops.map(o => {
      const v = it.opts[o.id] != null ? it.opts[o.id] : o.pad, id = `cvo${it.id}_${o.id}`, r = esc(T(o.rot)), d = o.dica ? `<small>${esc(T(o.dica))}</small>` : '';
      if (o.tipo === 'lista') return `<label class="campo"><span>${r}</span><select class="in" id="${id}" data-op="${o.id}">${o.opcoes.map(([k, n]) => `<option value="${esc(k)}"${String(k) === String(v) ? ' selected' : ''}>${esc(T(n))}</option>`).join('')}</select>${d}</label>`;
      if (o.tipo === 'caixa') return `<label class="campo cx"><input type="checkbox" id="${id}" data-op="${o.id}"${v ? ' checked' : ''}><span>${r}</span>${d}</label>`;
      if (o.tipo === 'faixa') return `<label class="campo"><span>${r}: <b>${esc(v)}</b></span><input type="range" id="${id}" data-op="${o.id}" min="${o.min}" max="${o.max}" value="${esc(v)}">${d}</label>`;
      if (o.tipo === 'numero') return `<label class="campo"><span>${r}</span><input class="in" type="number" id="${id}" data-op="${o.id}" min="${o.min != null ? o.min : ''}" max="${o.max != null ? o.max : ''}" value="${esc(v)}">${d}</label>`;
      if (o.tipo === 'cor') return `<label class="campo"><span>${r}</span><input type="color" id="${id}" data-op="${o.id}" value="${esc(v)}">${d}</label>`;
      return `<label class="campo"><span>${r}</span><input class="in" type="text" id="${id}" data-op="${o.id}" value="${esc(v)}">${d}</label>`;
    }).join('')}</div>`;
  }
  function linhaHtml(it) {
    if (!it.de) return `<div class="cv-it err" data-id="${it.id}"><div class="cv-ic">${ICO.arquivo}</div><div class="cv-nm"><b>${esc(it.file.name)}</b><small>${esc(tam(it.file.size))} · ${esc(it.msg)}</small></div><button class="btn so peq" data-a="rem" title="${esc(T('Remover'))}" aria-label="${esc(T('Remover'))}">${ICO.x}</button></div>`;
    const grupos = alvosAgrupados(it.de), mot = precisaMotor(it);
    const sel = `<select class="in cv-sel" data-a="alvo" aria-label="${esc(T('Converter para'))}"${it.proc ? ' disabled' : ''}>${grupos.map(([c, ids]) => `<optgroup label="${esc(nomeCat(c))}">${ids.map(i => `<option value="${i}"${i === it.alvo ? ' selected' : ''}>${esc(nome(i))}</option>`).join('')}</optgroup>`).join('')}</select>`;
    let estado = '';
    if (it.proc) estado = `<div class="cv-prog"><i style="width:${Math.round((it.prog || 0) * 100)}%"></i></div><small>${esc(it.msg || T('Convertendo…'))}</small>`;
    else if (it.estado === 'erro') estado = `<small class="cv-erro">${esc(it.msg)}</small>`;
    else if (it.estado === 'ok') estado = `<small class="cv-ok">${ICO.ok} ${esc(it.saidas.length === 1 ? T('Pronto: {1}', tam(it.saidas[0].blob.size)) : T('Pronto: {1} arquivos', it.saidas.length))}</small>`;
    else if (mot) estado = `<small>${esc(T('Na primeira vez baixa um componente (~{1} MB).', MB_MOTOR[mot] || 16))}</small>`;
    const acao = it.proc ? `<button class="btn peq" data-a="cancelar">${esc(T('Cancelar'))}</button>`
      : it.estado === 'ok' ? `<button class="btn pri peq" data-a="baixar">${ICO.baixar}<span>${esc(T('Baixar'))}</span></button><button class="btn so peq" data-a="conv" title="${esc(T('Converter de novo'))}" aria-label="${esc(T('Converter de novo'))}">${ICO.renovar}</button>`
      : `<button class="btn pri peq" data-a="conv">${esc(T('Converter'))}</button>`;
    return `<div class="cv-it${it.estado === 'ok' ? ' ok' : ''}${it.estado === 'erro' ? ' err' : ''}" data-id="${it.id}">
      <div class="cv-ic">${tipoIcone(FMT[it.de].cat)}<em>${esc(FMT[it.de].exts[0].toUpperCase())}</em></div>
      <div class="cv-nm"><b title="${esc(it.file.name)}">${esc(it.file.name)}</b><small>${esc(tam(it.file.size))} · ${esc(nome(it.de))}</small>${estado}</div>
      <div class="cv-para"><span>${esc(T('para'))}</span>${sel}</div>
      <div class="cv-ac">${acao}<button class="btn so peq" data-a="ops" aria-expanded="${aberto === it.id}" title="${esc(T('Opções'))}" aria-label="${esc(T('Opções'))}"${it.proc ? ' disabled' : ''}>${ICO.lapis}</button><button class="btn so peq" data-a="rem" title="${esc(T('Remover'))}" aria-label="${esc(T('Remover'))}">${ICO.x}</button></div>
      ${aberto === it.id && !it.proc ? `<div class="cv-opc">${opcoesHtml(it)}</div>` : ''}</div>`;
  }
  function render() {
    if (!el) return;
    const l = $('#cvLista', el); l.innerHTML = itens.map(linhaHtml).join('');
    const bons = itens.filter(i => i.de), tem = itens.length > 0, ok = itens.filter(i => i.estado === 'ok');
    $('#cvLimpar', el).hidden = !tem; $('#cvTudo', el).hidden = !bons.some(i => !i.proc && i.estado !== 'ok'); $('#cvZip', el).hidden = ok.length < 2;
    // formato único para todos: só os formatos que todos aceitam
    const todos = $('#cvTodos', el); todos.hidden = bons.length < 2;
    if (bons.length >= 2) {
      let com = CV.alvos(bons[0].de); bons.slice(1).forEach(i => { const a = CV.alvos(i.de); com = com.filter(x => a.includes(x)); });
      $('#cvTodosSel', el).innerHTML = `<option value="">${esc(T('Escolher…'))}</option>` + com.map(i => `<option value="${i}">${esc(nome(i))}</option>`).join('');
      todos.hidden = !com.length;
    }
  }
  function atualizarLinha(it) {
    const n = $(`[data-id="${it.id}"]`, el); if (!n) return;
    const p = $('.cv-prog i', n), s = $('.cv-nm small:last-child', n);
    if (p && it.proc) { p.style.width = Math.round((it.prog || 0) * 100) + '%'; if (s) s.textContent = it.msg || T('Convertendo…'); }
    else render();
  }

  /* ---------- eventos ---------- */
  function aoClicar(e) {
    const b = e.target.closest('[data-a]'); if (!b || b.tagName === 'SELECT') return;
    const n = b.closest('[data-id]'), it = achar(n.dataset.id), a = b.dataset.a;
    if (!it) return;
    if (a === 'rem') { if (it.proc) it.cancel = true; itens = itens.filter(x => x !== it); render(); }
    else if (a === 'ops') { aberto = aberto === it.id ? null : it.id; render(); }
    else if (a === 'conv') converterUm(it);
    else if (a === 'cancelar') { it.cancel = true; }
    else if (a === 'baixar') baixarUm(it);
  }
  function aoMudar(e) {
    const t = e.target, n = t.closest('[data-id]'); if (!n) return;
    const it = achar(n.dataset.id); if (!it) return;
    if (t.dataset.a === 'alvo' && e.type === 'change') { mudarAlvo(it, t.value); return; }
    if (t.dataset.op) {
      const o = CV.opcoes(it.de, it.alvo).find(x => x.id === t.dataset.op); if (!o) return;
      let v = t.type === 'checkbox' ? t.checked : t.value;
      if (o.tipo === 'numero') { v = +v; if (!isFinite(v)) return; if (e.type === 'change') { if (o.min != null) v = Math.max(o.min, v); if (o.max != null) v = Math.min(o.max, v); t.value = v; } }
      if (o.tipo === 'faixa') { v = +v; const b = t.closest('label').querySelector('b'); if (b) b.textContent = v; }
      it.opts[o.id] = v; it.estado = it.estado === 'ok' ? 'espera' : it.estado; ultimo['_' + it.alvo] = Object.assign(ultimo['_' + it.alvo] || {}, { [o.id]: v }); UT.guardar('conversor', ultimo);
      if (e.type === 'change' && it.estado === 'espera') { const nn = $(`[data-id="${it.id}"] .cv-nm`, el); if (nn) { const s = nn.querySelector('.cv-ok'); if (s) s.remove(); } }
    }
  }

  /* ---------- conversão ---------- */
  async function converterUm(it) {
    if (it.proc) return;
    it.proc = true; it.cancel = false; it.prog = 0; it.msg = T('Preparando…'); it.estado = 'espera'; it.saidas = null;
    render();
    try {
      const r = await CV.converter(it.file, it.de, it.alvo, it.opts, { progresso: (p, t) => { it.prog = Math.max(it.prog || 0, Math.min(1, p)); if (t) it.msg = t; atualizarLinha(it); }, cancelado: () => !!it.cancel });
      if (!r || !r.length) throw new Error(T('A conversão não gerou nenhum arquivo.'));
      it.saidas = r; it.estado = 'ok';
    } catch (e) {
      if (e && e.cancelado) { it.estado = 'espera'; it.msg = ''; }
      else { console.error(e); it.estado = 'erro'; it.msg = (e && e.message) || T('Não foi possível converter este arquivo.'); }
    }
    it.proc = false; render();
  }
  async function converterTudo() {
    if (rodando) return; rodando = true;
    try { for (const it of itens.slice()) { if (!itens.includes(it) || !it.de || it.estado === 'ok' || it.proc) continue; await converterUm(it); } }
    finally { rodando = false; }
  }
  async function zipDe(lista, nome) {
    const Z = await UT.jszip(), z = new Z(), usados = {};
    lista.forEach(s => { let n = s.nome; const b = UT.semExt(n), e = n.slice(b.length); let i = 1; while (usados[n.toLowerCase()]) n = b + ' (' + (++i) + ')' + e; usados[n.toLowerCase()] = 1; z.file(n, s.blob); });
    return z.generateAsync({ type: 'blob', compression: 'STORE' });
  }
  async function baixarUm(it) {
    if (!it.saidas) return;
    if (it.saidas.length === 1) { UT.baixar(it.saidas[0].blob, it.saidas[0].nome); return; }
    try { UT.aviso(T('Preparando o arquivo .zip…')); UT.baixar(await zipDe(it.saidas), UT.semExt(it.file.name) + '.zip'); } catch (e) { UT.aviso(e.message || String(e), true); }
  }
  async function baixarTudo() {
    const todos = []; itens.forEach(i => { if (i.estado === 'ok' && i.saidas) i.saidas.forEach(s => todos.push(s)); });
    if (!todos.length) return;
    try { UT.aviso(T('Preparando o arquivo .zip…')); UT.baixar(await zipDe(todos), T('convertidos') + '.zip'); } catch (e) { UT.aviso(e.message || String(e), true); }
  }

  /* ---------- Workspace ---------- */
  const extDe = n => { const m = /\.([a-z0-9]+)$/i.exec(n || ''); return m ? m[1].toLowerCase() : ''; };
  const sabe = nome => Object.keys(FMT).some(id => FMT[id].exts.includes(extDe(nome)) && CV.alvos(id).length);
  UT.registrar('conversor', {
    montar,
    abrir() { render(); },
    conteudos: () => itens.filter(i => i.estado === 'ok' && i.saidas).flatMap(i => i.saidas.map((s, k) => ({ id: 'cv' + i.id + '_' + k, rotulo: s.nome, detalhe: tam(s.blob.size), tipo: FMT[i.alvo] && FMT[i.alvo].cat === 'imagem' ? 'imagem' : 'arquivo', nome: s.nome, obter: () => s.blob }))).slice(0, 12),
    aceita: info => sabe(info.nome || (info.arquivo && info.arquivo.name)),
    receber: info => { const f = info.arquivo instanceof File ? info.arquivo : new File([info.arquivo], info.nome || 'arquivo', { type: (info.arquivo && info.arquivo.type) || '' }); adicionar([f]); return true; },
    ocupado: () => itens.length > 0
  });
})();
