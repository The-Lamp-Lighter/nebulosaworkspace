/* ============================================================
   LêPraMim — configuracoes.js
   Janela de Configurações: tema, tamanho da letra, voz
   (escolha, gênero, velocidade, volume, tom), modo karaokê,
   limpeza automática, OCR, estado das bibliotecas e dados.
   Tudo é gravado no LocalStorage assim que é alterado.
   ============================================================ */
(function () {
  'use strict';
  const { el } = LPM.util;
  const dados = LPM.dados;
  const cfg = dados.cfg;
  const ui = LPM.ui;
  const C = {};

  const virgula = (v, casas) => Number(v).toFixed(casas === undefined ? 2 : casas).replace('.', ',');

  /** Botões de escolha única ("segmentos"). */
  function segmentos(opcoes, atual, aoMudar) {
    const caixa = el('div', { class: 'segmentos', role: 'group' });
    opcoes.forEach(o => {
      const b = el('button', { type: 'button', class: o[0] === atual ? 'ativo' : '', text: o[1], onclick: () => {
        caixa.querySelectorAll('button').forEach(x => x.classList.remove('ativo'));
        b.classList.add('ativo');
        aoMudar(o[0]);
      } });
      caixa.appendChild(b);
    });
    return caixa;
  }

  /** Controle deslizante com o valor ao lado. */
  function deslizante(id, rotulo, min, max, passo, valor, formatar, aoMudar) {
    const saida = el('output', { text: formatar(valor) });
    const campo = el('input', { type: 'range', id, min, max, step: passo, value: valor, oninput: e => {
      const v = parseFloat(e.target.value);
      saida.textContent = formatar(v);
      aoMudar(v);
    } });
    return el('div', { class: 'campo' }, [el('label', { for: id, text: rotulo }), campo, saida]);
  }

  function caixaMarcar(rotulo, detalhe, marcado, aoMudar) {
    return el('label', { class: 'marcar' }, [
      el('input', { type: 'checkbox', checked: marcado, onchange: e => aoMudar(e.target.checked) }),
      el('span', null, [rotulo, detalhe ? el('small', { text: detalhe }) : null])
    ]);
  }

  /** Verifica se um arquivo de biblioteca existe na pasta libs. */
  async function existe(url) {
    if (LPM.util.viaServidor()) {
      try { return (await fetch(url, { method: 'HEAD', cache: 'no-store' })).ok; } catch (e) { return false; }
    }
    return LPM.util.carregarScript(url);
  }

  C.abrir = function () {
    let limpezaMudou = false;
    const salvar = () => dados.salvarCfg();
    const reaplicarVoz = LPM.util.adiar(() => LPM.leitor.reaplicarVoz(), 350);

    /* ---------- Aparência ---------- */
    const aparencia = el('div', { class: 'secao' }, [
      el('h3', { text: 'Aparência' }),
      el('div', { class: 'campo' }, [el('span', { class: 'rot', text: 'Tema' }),
        segmentos([['claro', 'Claro'], ['escuro', 'Escuro']], cfg.tema, v => { cfg.tema = v; salvar(); ui.aplicarTema(); })]),
      // [Nebulosa] visual do programa (só aparece com a ponte do Nebulosa Workspace)
      window.NebulosaSkin ? el('div', { class: 'campo' }, [el('span', { class: 'rot', text: 'Visual' }),
        segmentos(NebulosaSkin.list.map(x => [x.id, x.name]), NebulosaSkin.get(), v => NebulosaSkin.set(v))]) : null,
      deslizante('cfgFonte', 'Tamanho da letra', 14, 34, 1, cfg.tamanhoFonte, v => v + ' px', v => { cfg.tamanhoFonte = v; salvar(); LPM.leitor.aplicarAparencia(); })
    ]);

    /* ---------- Voz ---------- */
    const selVoz = el('select', { id: 'cfgVoz', onchange: e => { cfg.voz = e.target.value; salvar(); preencherVozes(); reaplicarVoz(); } });
    const notaVoz = el('p', { class: 'nota' });
    const preencherVozes = () => {
      const lista = LPM.voz.filtradas();
      const atual = LPM.voz.escolhida();
      selVoz.textContent = '';
      lista.forEach(v => {
        const g = LPM.voz.generoDe(v);
        const T = x => (window.NebulosaIdiomas && x ? NebulosaIdiomas.t(x) : x); // [Nebulosa] idiomas 0.6
        const extra = [v.lang, T(g), v.localService === false ? 'online' : ''].filter(Boolean).join(', ');
        selVoz.appendChild(el('option', { value: v.voiceURI, text: `${T(v.name)} (${extra})`, selected: atual && atual.voiceURI === v.voiceURI }));
      });
      if (!LPM.voz.disponivel) notaVoz.textContent = 'Este navegador não oferece leitura por voz. Use o Microsoft Edge ou o Chrome.';
      else if (!LPM.voz.vozes.length) notaVoz.textContent = 'Nenhuma voz foi encontrada no sistema. No Windows, instale vozes em Configurações > Hora e idioma > Fala.';
      else if (!lista.length) notaVoz.textContent = 'Nenhuma voz corresponde a este filtro. Escolha "Todas" para ver as vozes instaladas.';
      else if (atual && atual.piper && !LPM.piper.liberada(atual)) notaVoz.textContent = 'Voz neural Piper: na primeira leitura ela é baixada uma única vez (cerca de ' + atual.mb + ' MB) e fica guardada neste navegador. O texto dos livros nunca sai do computador. O ajuste de tom não se aplica a ela, e o destaque da palavra é estimado.';
      else if (atual && atual.piper) notaVoz.textContent = 'Voz neural Piper: funciona sem internet e nada sai deste computador. O ajuste de tom não se aplica a ela, e o destaque da palavra é estimado.';
      else notaVoz.textContent = 'As vozes vêm do sistema operacional. O gênero é estimado pelo nome da voz. Para vozes melhores, instale a voz neural Piper com o "Baixar-Bibliotecas" e abra pelo "Iniciar-LePraMim".';
    };
    preencherVozes();

    const voz = el('div', { class: 'secao' }, [
      el('h3', { text: 'Voz da leitura' }),
      el('div', { class: 'campo' }, [el('span', { class: 'rot', text: 'Tipo de voz' }),
        segmentos([['todas', 'Todas'], ['feminina', 'Feminina'], ['masculina', 'Masculina']], cfg.genero, v => { cfg.genero = v; salvar(); preencherVozes(); reaplicarVoz(); })]),
      el('div', { class: 'campo' }, [el('label', { for: 'cfgVoz', text: 'Voz' }), selVoz,
        el('button', { class: 'bt', type: 'button', onclick: () => {
          LPM.leitor.pausar();
          LPM.voz.falar('Olá! Eu sou a voz do LêPraMim. É assim que vou ler os seus livros.', {
            aoErro: e => ui.aviso('A voz não pôde ser reproduzida' + (e && e.error ? ': ' + e.error : '.'), 'erro', 9000)
          });
        } }, 'Testar')]),
      deslizante('cfgVel', 'Velocidade', 0.5, 3, 0.05, cfg.velocidade, v => virgula(v) + '×', v => { cfg.velocidade = v; salvar(); LPM.leitor.aplicarAparencia(); reaplicarVoz(); }),
      deslizante('cfgVol', 'Volume', 0, 1, 0.05, cfg.volume, v => Math.round(v * 100) + '%', v => { cfg.volume = v; salvar(); reaplicarVoz(); }),
      deslizante('cfgTom', 'Tom', 0, 2, 0.05, cfg.tom, v => virgula(v), v => { cfg.tom = v; salvar(); reaplicarVoz(); }),
      notaVoz,
      caixaMarcar('Mostrar também as vozes online',
        'Vozes online (como as "Natural" do Edge) enviam o texto ao provedor da voz e exigem internet. Deixe desligado para manter tudo neste computador.',
        cfg.vozesOnline, v => { cfg.vozesOnline = v; salvar(); preencherVozes(); })
    ]);

    /* ---------- Karaokê ---------- */
    const mudarKaraoke = (chave, v) => { cfg[chave] = v; salvar(); LPM.leitor.aplicarAparencia(); };
    const karaoke = el('div', { class: 'secao' }, [
      el('h3', { text: 'Modo karaokê (destaque durante a leitura)' }),
      caixaMarcar('Palavra atual', '', cfg.karaokePalavra, v => mudarKaraoke('karaokePalavra', v)),
      caixaMarcar('Frase atual', '', cfg.karaokeFrase, v => mudarKaraoke('karaokeFrase', v)),
      caixaMarcar('Parágrafo atual', '', cfg.karaokeParagrafo, v => mudarKaraoke('karaokeParagrafo', v))
    ]);

    /* ---------- Limpeza automática ---------- */
    const lp = cfg.limpeza;
    const mudarLimpeza = (chave, v) => { lp[chave] = v; limpezaMudou = true; salvar(); };
    const limpeza = el('div', { class: 'secao' }, [
      el('h3', { text: 'Limpeza automática do texto' }),
      caixaMarcar('Limpar o texto antes de ler', 'Remove o que um narrador não leria. Desligue para ouvir o documento exatamente como está.', lp.ativa, v => mudarLimpeza('ativa', v)),
      el('div', { class: 'colunas' }, [
        caixaMarcar('Cabeçalhos e rodapés repetidos', '', lp.cabecalhos, v => mudarLimpeza('cabecalhos', v)),
        caixaMarcar('Numeração de páginas', '', lp.numeros, v => mudarLimpeza('numeros', v)),
        caixaMarcar('URLs repetidas', '', lp.urls, v => mudarLimpeza('urls', v)),
        caixaMarcar('Copyrights repetidos', '', lp.copyrights, v => mudarLimpeza('copyrights', v)),
        caixaMarcar('ISBN', '', lp.isbn, v => mudarLimpeza('isbn', v)),
        caixaMarcar('Índices e sumários', '', lp.sumarios, v => mudarLimpeza('sumarios', v)),
        caixaMarcar('Propagandas e assinaturas', '', lp.propagandas, v => mudarLimpeza('propagandas', v)),
        caixaMarcar('Créditos e notas repetidos', '', lp.repetidos, v => mudarLimpeza('repetidos', v))
      ])
    ]);

    /* ---------- OCR ---------- */
    const selOcr = el('select', { id: 'cfgOcr', onchange: e => { cfg.idiomaOcr = e.target.value; salvar(); } }, [
      el('option', { value: 'por', text: 'Português', selected: cfg.idiomaOcr === 'por' }),
      el('option', { value: 'eng', text: 'Inglês', selected: cfg.idiomaOcr === 'eng' }),
      el('option', { value: 'por+eng', text: 'Português + Inglês (mais lento)', selected: cfg.idiomaOcr === 'por+eng' })
    ]);
    const ocr = el('div', { class: 'secao' }, [
      el('h3', { text: 'OCR (PDFs digitalizados e imagens)' }),
      el('div', { class: 'campo' }, [el('label', { for: 'cfgOcr', text: 'Idioma do documento' }), selOcr])
    ]);

    /* ---------- Bibliotecas ---------- */
    const L = LPM.config.LIBS;
    const linhaLib = (nome, funcao, verificar) => {
      const selo = el('span', { class: 'selo', text: 'verificando…' });
      verificar().then(ok => { const txt = typeof ok === 'string' ? ok : ok ? 'instalada' : 'não instalada'; selo.textContent = txt; selo.classList.add(txt === 'não instalada' ? 'falta' : 'ok'); });
      return el('div', { class: 'estado-lib' }, [el('b', { text: nome }), el('span', { text: funcao, style: { flex: '1' } }), selo]);
    };
    const servidor = LPM.util.viaServidor();
    // [Nebulosa] estado de um componente opcional: pasta libs > guardado no navegador > baixa ao usar
    const estadoOpcional = async (nome, local) => (await local()) ? 'instalada' : (await LPM.libsWeb.guardada(nome)) ? 'guardada neste navegador' : servidor ? 'baixa ao usar' : 'não instalada';
    const libs = el('div', { class: 'secao' }, [
      el('h3', { text: 'Componentes' }),
      linhaLib('PDF.js', 'abrir PDFs', () => LPM.importar.carregarPdfJs().then(() => true, () => false)),
      linhaLib('Piper', LPM.piper.motor === 'web' ? 'voz neural (baixada pela internet, uma vez)' : 'voz neural offline (Cadu)', async () => (await LPM.piper.detectar()).length > 0),
      // [Nebulosa] componentes opcionais: pasta libs, guardados neste navegador ou baixados ao usar
      linhaLib('Tesseract.js', 'OCR', () => estadoOpcional('ocr', async () => (await existe(L.tesseract)) && (!servidor || await existe(L.tesseractLang + '/por.traineddata.gz')))),
      linhaLib('lamejs', 'exportar MP3', () => estadoOpcional('mp3', () => existe(L.lame))),
      linhaLib('Mammoth.js', 'DOCX (opcional)', () => estadoOpcional('docx', () => existe(L.mammoth))),
      el('p', { class: 'nota', text: (servidor
        ? 'Aberto pelo servidor local ou por um site: todos os recursos estão disponíveis, inclusive OCR e instalação como aplicativo. ' +
          (LPM.piper.motor === 'web' ? 'A voz Piper é baixada pela internet na primeira leitura e fica guardada neste navegador. ' : '') +
          'OCR, MP3 e o leitor completo de DOCX também são baixados pela internet na primeira vez em que você os usa (com a sua permissão) e ficam guardados neste navegador. '
        : 'Aberto direto do arquivo: OCR, voz Piper e instalação como aplicativo exigem abrir por um site ou pelo "Iniciar-LePraMim". ') +
        'No computador, o "Baixar-Bibliotecas" instala tudo de uma vez na pasta libs; depois disso tudo funciona sem internet.' }),
      el('button', { class: 'bt', type: 'button', onclick: async () => {
        if (!await ui.perguntar('Esquecer componentes baixados', 'Apaga deste navegador as cópias de OCR, MP3 e DOCX baixadas pela internet. Elas são baixadas de novo quando você usar o recurso. Continuar?', 'Esquecer', 'Cancelar')) return;
        await LPM.libsWeb.apagar(); LPM.dados.cfg.libsWeb = {}; LPM.dados.salvarCfg(); ui.aviso('Componentes esquecidos.');
      } }, 'Esquecer componentes baixados')
    ]);

    /* ---------- Dados ---------- */
    const dadosSecao = el('div', { class: 'secao' }, [
      el('h3', { text: 'Seus dados' }),
      el('p', { class: 'nota', text: 'A biblioteca, o progresso, os marcadores e as estatísticas ficam guardados somente neste computador, dentro do navegador. Nada é enviado para a internet.' }),
      el('button', { class: 'bt perigo', type: 'button', onclick: async () => {
        if (!await ui.perguntar('Apagar todos os dados', 'Isso remove a biblioteca inteira, o progresso de leitura, os marcadores, as estatísticas e as configurações. Os arquivos originais no seu computador não são afetados. Continuar?', 'Apagar tudo', 'Cancelar')) return;
        LPM.leitor.fechar();
        LPM.audio.descarregar();
        await dados.apagarTudo();
        location.reload();
      } }, 'Apagar todos os dados')
    ]);

    ui.modal({
      titulo: 'Configurações', largo: true,
      corpo: el('div', null, [aparencia, voz, karaoke, limpeza, ocr, libs, dadosSecao]),
      botoes: [{ texto: 'Concluir', classe: 'primario' }],
      aoFechar: () => {
        LPM.voz.aoMudar = null;
        // Se a limpeza mudou, refaz o livro aberto com as novas regras
        if (limpezaMudou) LPM.leitor.reprocessar();
      }
    });
    LPM.voz.aoMudar = preencherVozes;
  };

  // [Nebulosa] no Workspace, "Mais opções do programa" abre estas Configurações
  if (window.NebulosaSkin) window.NebulosaSkin.openDialog = () => C.abrir();

  LPM.configuracoes = C;
})();
