/* ==========================================================================
   Utilidades — QR Code (js/qr.js)
   Usa o gerador do próprio Workspace (../../js/qrcode.js): nada sai do navegador.
   Guarda só as opções (tipo, cores, correção); o conteúdo não é guardado.
   ========================================================================== */
(function () {
  'use strict';
  const { $, $$, esc, T, ICO } = UT;
  const TIPOS = [
    { id: 'link', nome: 'Link' }, { id: 'texto', nome: 'Texto' }, { id: 'wifi', nome: 'Wi-Fi' },
    { id: 'contato', nome: 'Contato' }, { id: 'email', nome: 'E-mail' }, { id: 'whats', nome: 'WhatsApp' }
  ];
  const NIVEIS = [['L', 'Baixa (7%)'], ['M', 'Média (15%)'], ['Q', 'Alta (25%)'], ['H', 'Máxima (30%)']];
  const op = Object.assign({ tipo: 'link', nivel: 'M', escuro: '#000000', claro: '#ffffff', borda: 4, px: 1024 }, UT.ler('qr', {}));
  let el, matriz = null, texto = '';

  const CAMPOS = {
    link: `<label class="campo"><span>Endereço (link)</span><input class="in" data-k="url" type="url" inputmode="url" placeholder="https://exemplo.com.br" autocomplete="off"></label>`,
    texto: `<label class="campo"><span>Texto</span><textarea class="in" data-k="txt" rows="5" placeholder="Qualquer texto: um recado, um código, um endereço…"></textarea></label>`,
    wifi: `<label class="campo"><span>Nome da rede (SSID)</span><input class="in" data-k="ssid" autocomplete="off"></label>
      <label class="campo"><span>Senha</span><input class="in" data-k="senha" autocomplete="off"></label>
      <div class="linha"><label class="campo" style="flex:1"><span>Segurança</span><select class="in" data-k="seg"><option value="WPA">WPA / WPA2 / WPA3</option><option value="WEP">WEP</option><option value="nopass">Sem senha</option></select></label>
      <label class="chk" style="margin-top:10px"><input type="checkbox" data-k="oculta"> Rede oculta</label></div>
      <p class="dica">Quem apontar a câmera do celular entra na rede sem digitar a senha.</p>`,
    contato: `<div class="grade2"><label class="campo"><span>Nome</span><input class="in" data-k="nome" autocomplete="off"></label><label class="campo"><span>Sobrenome</span><input class="in" data-k="sobrenome" autocomplete="off"></label></div>
      <div class="grade2"><label class="campo"><span>Telefone</span><input class="in" data-k="tel" type="tel" autocomplete="off"></label><label class="campo"><span>E-mail</span><input class="in" data-k="mail" type="email" autocomplete="off"></label></div>
      <div class="grade2"><label class="campo"><span>Empresa</span><input class="in" data-k="org" autocomplete="off"></label><label class="campo"><span>Site</span><input class="in" data-k="site" autocomplete="off"></label></div>`,
    email: `<label class="campo"><span>Para</span><input class="in" data-k="para" type="email" autocomplete="off" placeholder="alguem@exemplo.com"></label>
      <label class="campo"><span>Assunto</span><input class="in" data-k="assunto" autocomplete="off"></label>
      <label class="campo"><span>Mensagem</span><textarea class="in" data-k="msg" rows="3"></textarea></label>`,
    whats: `<label class="campo"><span>Número com DDI e DDD</span><input class="in" data-k="num" type="tel" autocomplete="off" placeholder="55 11 91234-5678"></label>
      <label class="campo"><span>Mensagem já escrita (opcional)</span><textarea class="in" data-k="msg" rows="3"></textarea></label>`
  };

  function montar(v) {
    el = v;
    v.innerHTML = `<div class="cab"><div><h1>QR Code</h1><p>Crie um QR Code para link, texto, Wi-Fi, contato, e-mail ou WhatsApp. Ele é feito aqui mesmo, sem internet.</p></div></div>
    <div class="grade2 l">
      <div>
        <div class="painel">
          <div class="seg" id="qrTipo" role="group" aria-label="Tipo de QR Code">${TIPOS.map(t => `<button data-t="${t.id}" aria-pressed="false">${esc(t.nome)}</button>`).join('')}</div>
          <div id="qrCampos" style="margin-top:14px"></div>
        </div>
        <div class="painel">
          <h2>Aparência</h2>
          <div class="campo"><span class="rot">Correção de erros</span><div class="seg" id="qrNivel">${NIVEIS.map(n => `<button data-n="${n[0]}" aria-pressed="false">${esc(n[1])}</button>`).join('')}</div>
            <small>Quanto mais alta, mais o QR aguenta sujeira ou um logotipo por cima, mas fica mais “cheio”.</small></div>
          <div class="linha">
            <label class="campo"><span>Cor do código</span><input type="color" id="qrEscuro"></label>
            <label class="campo"><span>Cor do fundo</span><input type="color" id="qrClaro"></label>
            <label class="campo" style="flex:1;min-width:150px"><span>Margem: <b id="qrBordaV"></b></span><input type="range" id="qrBorda" min="0" max="8" step="1"></label>
            <label class="campo" style="flex:1;min-width:150px"><span>Tamanho do PNG: <b id="qrPxV"></b></span><input type="range" id="qrPx" min="256" max="2048" step="128"></label>
          </div>
          <p class="aviso err" id="qrContraste" hidden>Pouco contraste entre as cores: alguns celulares podem não conseguir ler. Prefira código escuro em fundo claro.</p>
        </div>
      </div>
      <div class="painel">
        <div class="qr-prev"><div class="qrimg" id="qrImg"></div></div>
        <p class="qr-info" id="qrInfo"></p>
        <div class="linha" style="justify-content:center">
          <button class="btn pri" id="qrPng">${ICO.baixar}<span>Baixar PNG</span></button>
          <button class="btn" id="qrSvg">${ICO.baixar}<span>Baixar SVG</span></button>
          <button class="btn" id="qrCopiar">${ICO.copiar}<span>Copiar imagem</span></button>
          ${UT.N && UT.N.inWorkspace ? `<button class="btn" id="qrMandar">${ICO.mandar}<span>Mandar para…</span></button>` : ''}
        </div>
      </div>
    </div>`;
    $('#qrTipo', v).addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { op.tipo = b.dataset.t; salvarOp(); campos(); } });
    $('#qrNivel', v).addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b) { op.nivel = b.dataset.n; salvarOp(); marcar(); gerar(); } });
    $('#qrEscuro', v).value = op.escuro; $('#qrClaro', v).value = op.claro; $('#qrBorda', v).value = op.borda; $('#qrPx', v).value = op.px;
    ['qrEscuro', 'qrClaro', 'qrBorda', 'qrPx'].forEach(id => $('#' + id, v).addEventListener('input', () => {
      op.escuro = $('#qrEscuro', v).value; op.claro = $('#qrClaro', v).value; op.borda = +$('#qrBorda', v).value; op.px = +$('#qrPx', v).value;
      salvarOp(); gerar();
    }));
    $('#qrCampos', v).addEventListener('input', gerar);
    $('#qrCampos', v).addEventListener('change', gerar);
    $('#qrPng', v).addEventListener('click', async () => { const b = await png(); if (b) UT.baixar(b, nomeArq() + '.png'); });
    $('#qrSvg', v).addEventListener('click', () => { if (!matriz) return vazio(); UT.baixar(new Blob([svg()], { type: 'image/svg+xml' }), nomeArq() + '.svg'); });
    $('#qrCopiar', v).addEventListener('click', async () => { const b = await png(); if (b) UT.copiarImagem(b); });
    const bm = $('#qrMandar', v);
    if (bm) bm.addEventListener('click', () => { if (!matriz) return vazio(); UT.N.mandar({ rotulo: 'QR Code (imagem)', tipo: 'imagem', nome: nomeArq() + '.png', obter: png }); });
    campos();
  }
  function salvarOp() { UT.guardar('qr', { tipo: op.tipo, nivel: op.nivel, escuro: op.escuro, claro: op.claro, borda: op.borda, px: op.px }); }
  function marcar() {
    $$('#qrTipo [data-t]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === op.tipo)));
    $$('#qrNivel [data-n]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.n === op.nivel)));
    $('#qrBordaV', el).textContent = op.borda; $('#qrPxV', el).textContent = op.px + ' px';
  }
  function campos() {
    if (!CAMPOS[op.tipo]) op.tipo = 'link';
    $('#qrCampos', el).innerHTML = CAMPOS[op.tipo];
    marcar(); gerar();
  }
  const val = k => { const i = $('#qrCampos [data-k="' + k + '"]', el); return !i ? '' : i.type === 'checkbox' ? i.checked : i.value.trim(); };
  const escWifi = s => s.replace(/([\\;,:"])/g, '\\$1');
  const escV = s => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  function conteudo() {
    switch (op.tipo) {
      case 'link': { let u = val('url'); if (u && !/^[a-z][a-z0-9+.-]*:/i.test(u) && /\.[a-z]{2,}/i.test(u)) u = 'https://' + u; return u; }
      case 'texto': return $('#qrCampos [data-k="txt"]', el).value;
      case 'wifi': {
        const ssid = val('ssid'); if (!ssid) return '';
        const seg = val('seg');
        return 'WIFI:T:' + seg + ';S:' + escWifi(ssid) + ';' + (seg !== 'nopass' ? 'P:' + escWifi(val('senha')) + ';' : '') + (val('oculta') ? 'H:true;' : '') + ';';
      }
      case 'contato': {
        const n = val('nome'), s = val('sobrenome');
        if (!n && !s && !val('tel') && !val('mail')) return '';
        const L = ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + escV(s) + ';' + escV(n) + ';;;', 'FN:' + escV((n + ' ' + s).trim())];
        if (val('org')) L.push('ORG:' + escV(val('org')));
        if (val('tel')) L.push('TEL;TYPE=CELL:' + val('tel'));
        if (val('mail')) L.push('EMAIL:' + val('mail'));
        if (val('site')) L.push('URL:' + val('site'));
        L.push('END:VCARD');
        return L.join('\r\n');
      }
      case 'email': {
        const p = val('para'); if (!p) return '';
        const q = [];
        if (val('assunto')) q.push('subject=' + encodeURIComponent(val('assunto')));
        if (val('msg')) q.push('body=' + encodeURIComponent(val('msg')));
        return 'mailto:' + p + (q.length ? '?' + q.join('&') : '');
      }
      case 'whats': {
        const d = val('num').replace(/\D/g, ''); if (!d) return '';
        return 'https://wa.me/' + d + (val('msg') ? '?text=' + encodeURIComponent(val('msg')) : '');
      }
    }
    return '';
  }
  function luz(h) { const n = parseInt(h.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
  function gerar() {
    texto = conteudo();
    const img = $('#qrImg', el), inf = $('#qrInfo', el);
    const a = luz(op.escuro), b = luz(op.claro), razao = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    $('#qrContraste', el).hidden = razao >= 3 && a < b;
    if (!texto) { matriz = null; img.innerHTML = vazioSvg(); inf.textContent = T('Preencha os campos para ver o QR Code.'); return; }
    try {
      matriz = NebulosaQR.matriz(texto, op.nivel);
      img.innerHTML = svg();
      inf.textContent = UT.Q([...texto].length, '{1} caractere', '{1} caracteres') + ' · ' + T('{1}×{2} módulos', matriz.length, matriz.length);
    } catch (e) {
      matriz = null; img.innerHTML = vazioSvg();
      inf.textContent = T('Texto longo demais para um QR Code. Tente encurtar ou baixar a correção de erros.');
    }
  }
  function vazioSvg() { return `<svg viewBox="0 0 29 29"><rect width="29" height="29" fill="${op.claro}"/><path d="M2 2h7v7H2zM20 2h7v7h-7zM2 20h7v7H2z" fill="none" stroke="${op.escuro}" stroke-opacity=".18" stroke-width="1.2"/></svg>`; }
  function svg() {
    const b = op.borda, t = matriz.length + b * 2; let d = '';
    matriz.forEach((l, y) => { let x = 0; while (x < l.length) { if (l[x]) { let w = 1; while (l[x + w]) w++; d += 'M' + (x + b) + ' ' + (y + b) + 'h' + w + 'v1h-' + w + 'z'; x += w; } else x++; } });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges"><rect width="${t}" height="${t}" fill="${op.claro}"/><path d="${d}" fill="${op.escuro}"/></svg>`;
  }
  function png() {
    if (!matriz) { vazio(); return Promise.resolve(null); }
    const b = op.borda, t = matriz.length + b * 2, k = Math.max(1, Math.floor(op.px / t)), lado = t * k;
    const c = document.createElement('canvas'); c.width = c.height = lado;
    const g = c.getContext('2d');
    g.fillStyle = op.claro; g.fillRect(0, 0, lado, lado); g.fillStyle = op.escuro;
    matriz.forEach((l, y) => l.forEach((on, x) => { if (on) g.fillRect((x + b) * k, (y + b) * k, k, k); }));
    return new Promise(r => c.toBlob(r, 'image/png'));
  }
  function vazio() { UT.aviso(T('Preencha os campos para ver o QR Code.'), true); }
  function nomeArq() {
    const base = { link: 'link', texto: 'texto', wifi: 'wifi', contato: 'contato', email: 'email', whats: 'whatsapp' }[op.tipo];
    const extra = op.tipo === 'wifi' ? val('ssid') : op.tipo === 'contato' ? val('nome') : '';
    return UT.nomeSeguro('qrcode-' + base + (extra ? '-' + extra : ''), 'qrcode');
  }
  UT.registrar('qr', {
    montar,
    abrir() { const f = $('#qrCampos .in', el); if (f && !matchMedia('(max-width:760px)').matches) f.focus({ preventScroll: true }); },
    conteudos: () => matriz ? [{ id: 'qr', rotulo: 'QR Code (imagem)', detalhe: texto.slice(0, 60), tipo: 'imagem', nome: nomeArq() + '.png', obter: png }] : [],
    aceita: info => info.tipoUtil === 'texto' && info.acao === 'inserir' && (info.arquivo.size || 0) <= 1500, // texto curto vira QR Code
    receber: async info => {
      const t = (await info.arquivo.text()).trim();
      op.tipo = /^https?:\/\/\S+$/i.test(t) ? 'link' : 'texto'; campos();
      const i = $('#qrCampos [data-k]', el); i.value = t.slice(0, 2900); gerar();
      UT.aviso(T('Texto recebido: o QR Code já está pronto.'));
      return true;
    }
  });
})();
