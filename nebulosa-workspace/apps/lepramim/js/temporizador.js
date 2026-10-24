/* ============================================================
   LêPraMim — temporizador.js
   Temporizador do sono: 15, 30, 45, 60 minutos ou um valor
   personalizado. Ao terminar, pausa a leitura por voz e o
   audiobook.
   ============================================================ */
(function () {
  'use strict';
  const { $, el, formatarTempo } = LPM.util;
  const sono = { fim: 0, relogio: null };

  function atualizarRotulo() {
    const rot = $('#rotSono');
    const bt = $('#btSono');
    if (!sono.fim) { rot.textContent = 'Sono'; bt.classList.remove('ligado'); return; }
    const resta = Math.max(0, Math.round((sono.fim - Date.now()) / 1000));
    rot.textContent = formatarTempo(resta);
    bt.classList.add('ligado');
  }

  function tique() {
    if (!sono.fim) return;
    if (Date.now() >= sono.fim) {
      sono.cancelar(true);
      // Pausa tudo o que estiver tocando
      LPM.leitor.pausar();
      LPM.audio.pausar();
      LPM.ui.aviso('Temporizador do sono: a leitura foi pausada. Boa noite!', null, 8000);
      return;
    }
    atualizarRotulo();
  }

  sono.iniciar = function (minutos) {
    minutos = Number(minutos);
    if (!(minutos > 0)) return;
    sono.fim = Date.now() + minutos * 60000;
    clearInterval(sono.relogio);
    sono.relogio = setInterval(tique, 1000);
    atualizarRotulo();
    LPM.ui.aviso(`A leitura será pausada em ${minutos} minuto${minutos === 1 ? '' : 's'}.`);
  };

  sono.cancelar = function (silencioso) {
    const estavaLigado = !!sono.fim;
    sono.fim = 0;
    clearInterval(sono.relogio);
    atualizarRotulo();
    if (estavaLigado && !silencioso) LPM.ui.aviso('Temporizador do sono desligado.');
  };

  /** Janela para escolher o tempo. */
  sono.abrir = function () {
    const campo = el('input', { type: 'number', min: '1', max: '720', value: '20', id: 'sonoPersonalizado' });
    const lista = el('div', { class: 'menu-lista' });
    let modal = null;
    LPM.config.SONO_MINUTOS.forEach(m => {
      lista.appendChild(el('button', { class: 'item', onclick: () => { modal.fechar(); sono.iniciar(m); } }, `${m} minutos`));
    });
    const corpo = el('div', null, [
      sono.fim ? el('p', { class: 'nota destaque', text: `Temporizador ligado: faltam ${formatarTempo(Math.round((sono.fim - Date.now()) / 1000))}.` }) : null,
      lista,
      el('div', { class: 'campo', style: { marginTop: '14px' } }, [
        el('label', { for: 'sonoPersonalizado', text: 'Personalizado (minutos)' }),
        campo,
        el('button', { class: 'bt', onclick: () => { modal.fechar(); sono.iniciar(campo.value); } }, 'Iniciar')
      ])
    ]);
    modal = LPM.ui.modal({
      titulo: 'Temporizador do sono', corpo,
      botoes: sono.fim ? [{ texto: 'Desligar temporizador', classe: 'perigo', acao: () => sono.cancelar() }] : []
    });
  };

  LPM.sono = sono;
})();
