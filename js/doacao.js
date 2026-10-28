/* ==========================================================================
   Nebulosa Workspace — js/doacao.js
   Dados da doação (botão "Doe com Pix", janela de apoio e lembretes).
   É só texto: para trocar a chave Pix ou as mensagens, mexa só aqui.

   pix        Pix Copia e Cola (BR Code) gerado no app do banco. O QR Code da
              janela é desenhado a partir dele, aqui mesmo no navegador.
              Use um código "reutilizável" (sem valor fixo), para que qualquer
              pessoa possa pagar o valor que quiser, quantas vezes quiser.
   lembretes  aviso no canto de notificações: o primeiro 20 minutos depois de
              abrir a página e depois a cada 60 minutos (versão 0.5).
   ========================================================================== */
window.NEBULOSA_DOACAO = {
  pix: '00020101021126580014br.gov.bcb.pix0136b2ef0406-e975-40ba-99d6-f48a126f1bf65204000053039865802BR5925MARCIO WILLIANS BARRETO D6009SAO PAULO622905251M57W4EJ7QB71KYGK5ES23W226304414C',

  equipe: 'Lamp Lighter',
  papel: 'Equipe de produção',
  selo: 'Apoio comunitário',
  titulo: 'Retribua e mantenha o projeto vivo',
  texto: 'O Nebulosa Workspace é feito por voluntários e vive de apoio espontâneo. Se ele te ajudar, considere retribuir — é assim que ele continua no ar, de graça, pra todo mundo.',
  instrucao: 'Escaneie o QR Code ou use o Pix Copia e Cola abaixo.',
  copiado: 'Chave Pix copiada! Abra o app do seu banco e escolha "Pix Copia e Cola".',
  rodape: 'Desenvolvido com carinho pela comunidade',

  lembretes: {
    ligado: true,
    primeiroAposMinutos: 20,       // o primeiro lembrete aparece 20 minutos depois de abrir a página
    intervaloMinutos: 60,          // depois, um lembrete a cada 60 minutos
    variacaoPorcento: 0,           // 0 = exatamente no intervalo; ex.: 10 = varia ±10% para não parecer robótico
    pausaDepoisDeCopiarHoras: 72,  // quem copiou o Pix fica 3 dias sem lembretes
    duracaoSegundos: 25,           // tempo que o aviso fica na tela (para enquanto o mouse está em cima)
    mensagens: [
      { titulo: 'Gostando do Nebulosa?', texto: 'Ele é gratuito e feito por voluntários. Um Pix de qualquer valor ajuda a manter tudo no ar. 💜' },
      { titulo: 'Um cafezinho para o projeto?', texto: 'Se algum programa te poupou tempo hoje, que tal retribuir com um Pix? Qualquer valor faz diferença. ☕' },
      { titulo: 'Feito pela comunidade', texto: 'Sem anúncios e sem vender seus dados: quem mantém o Nebulosa é quem usa. Você pode fazer parte. ✨' },
      { titulo: 'Cada apoio vira melhoria', texto: 'As doações viram tempo de desenvolvimento: programas novos, correções e recursos que você pede.' },
      { titulo: 'Obrigado por usar o Nebulosa', texto: 'Se puder, apoie com um Pix de qualquer valor. É assim que ele continua de graça, pra todo mundo.' }
    ]
  }
};
