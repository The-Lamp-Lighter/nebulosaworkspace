/* ============================================================
   LêPraMim — biblioteca.js
   A estante virtual: capa, nome, autor, formato, data da última
   leitura e percentual concluído de cada livro ou audiobook.
   Também cuida de adicionar arquivos, abrir, vincular audiobook
   (modo híbrido), mostrar informações e remover.
   ============================================================ */
(function () {
  'use strict';
  const { $, el, icone, formatarData, formatarDuracao, formatarTamanho, normalizar } = LPM.util;
  const dados = LPM.dados;
  const ui = LPM.ui;
  const B = { lista: [], filtro: '' };

  /* ============================================================
     Estante
     ============================================================ */

  /** Capa gerada (para arquivos sem capa): cor estável + emoji do formato + título. */
  function capaGerada(meta) {
    const cor = LPM.util.corDoTexto(meta.titulo + meta.formato);
    const emoji = meta.tipo === 'audio' ? LPM.config.EMOJI.audio : (LPM.config.EMOJI[meta.formato] || '📄');
    return el('div', { class: 'capa-gerada', style: { background: `linear-gradient(160deg, hsl(${cor} 48% 42%), hsl(${(cor + 40) % 360} 55% 26%))` } }, [
      el('span', { class: 'emoji', text: emoji }),
      el('span', { class: 't', text: meta.titulo })
    ]);
  }

  function cartao(meta) {
    const prog = dados.progresso(meta.id);
    const pct = Math.round((prog.pct || 0) * 100);
    const leitura = prog.data ? `${pct}% · ${formatarData(prog.data)}` : 'Ainda não aberto';
    return el('div', { class: 'livro' }, [
      el('button', { class: 'livro-abrir', title: `Abrir "${meta.titulo}"`, onclick: () => B.abrir(meta.id) }, [
        el('div', { class: 'livro-capa' }, [
          meta.capa ? el('img', { src: meta.capa, alt: '', loading: 'lazy' }) : capaGerada(meta),
          el('span', { class: 'livro-formato', text: meta.formato.toUpperCase() }),
          el('span', { class: 'livro-barra' }, el('i', { style: { width: pct + '%' } }))
        ]),
        el('span', { class: 'livro-nome', text: meta.titulo }),
        el('span', { class: 'livro-autor', text: meta.autor || (meta.tipo === 'audio' ? 'Audiobook' : 'Autor desconhecido') }),
        el('span', { class: 'livro-info', text: leitura })
      ]),
      el('button', { class: 'bt-icone livro-mais', title: 'Mais opções', 'aria-label': `Opções de "${meta.titulo}"`, onclick: () => B.menu(meta) }, icone('mais'))
    ]);
  }

  function desenhar() {
    const estante = $('#estante');
    const chave = normalizar(B.filtro);
    const visiveis = chave ? B.lista.filter(m => normalizar(m.titulo + ' ' + (m.autor || '') + ' ' + m.formato).indexOf(chave) >= 0) : B.lista;
    estante.textContent = '';
    visiveis.forEach(m => estante.appendChild(cartao(m)));
    $('#vazioBiblioteca').hidden = B.lista.length > 0;
    $('.estante-topo').hidden = B.lista.length === 0;
    if (B.lista.length && !visiveis.length) estante.appendChild(el('p', { class: 'nota', text: `Nenhum livro corresponde a "${B.filtro}".` }));
  }

  /** Recarrega a lista do banco local e redesenha a estante. */
  B.atualizar = async function () {
    try { B.lista = await dados.bd.listar(); }
    catch (e) { B.lista = []; ui.aviso('Não foi possível ler a biblioteca: ' + (e.message || e), 'erro'); }
    // mais recentes primeiro (última leitura; senão, data em que foi adicionado)
    const quando = m => Math.max(dados.progresso(m.id).data || 0, m.adicionado || 0);
    B.lista.sort((a, b) => quando(b) - quando(a));
    desenhar();
  };

  B.filtrar = function (termo) { B.filtro = termo || ''; desenhar(); };

  /** Mostra a biblioteca. */
  B.mostrar = async function () {
    LPM.leitor.pausar();
    ui.mostrarVisao('biblioteca');
    if (ui.contexto !== 'audio' || !LPM.audio.meta) {
      ui.vazio($('#abaCapitulos'), 'Abra um livro para ver os capítulos.');
    }
    LPM.marcadores.render();
    await B.atualizar();
  };

  /* ============================================================
     Abrir
     ============================================================ */

  B.abrir = async function (id, op) {
    try {
      const meta = await dados.bd.meta(id);
      if (!meta) { ui.aviso('Este livro não está mais na biblioteca.', 'erro'); return; }
      if (meta.tipo === 'audio') await LPM.audio.abrir(meta, op);
      else await LPM.leitor.abrir(meta);
    } catch (e) {
      console.error(e);
      ui.aviso('Não foi possível abrir: ' + (e.message || e), 'erro');
    }
  };

  /* ============================================================
     Adicionar arquivos
     ============================================================ */

  B.importar = async function (arquivos) {
    arquivos = Array.from(arquivos || []);
    if (!arquivos.length) return;
    dados.pedirPersistencia();
    const prog = ui.progresso(arquivos.length > 1 ? `Adicionando ${arquivos.length} arquivos` : 'Adicionando à biblioteca');
    const existentes = await dados.bd.listar().catch(() => []);
    let ultimo = null, novos = 0;
    const avisos = [];

    for (let i = 0; i < arquivos.length; i++) {
      const arq = arquivos[i];
      if (prog.cancelado) break;
      const prefixo = arquivos.length > 1 ? `(${i + 1}/${arquivos.length}) ` : '';
      // Já está na biblioteca? (mesmo nome e mesmo tamanho)
      const repetido = existentes.find(m => m.arquivo === arq.name && m.tamanho === arq.size);
      if (repetido) { ultimo = repetido; continue; }
      try {
        const r = await LPM.importar.arquivo(arq, {
          progresso: (t, f) => prog.atualizar(prefixo + arq.name + ' — ' + t, f),
          perguntar: ui.perguntar,
          cancelado: () => prog.cancelado
        });
        prog.atualizar(prefixo + 'Guardando na biblioteca…', 1);
        await dados.bd.salvarLivro(r.meta, r.conteudo, r.arquivo);
        existentes.push(r.meta);
        ultimo = r.meta;
        novos++;
        if (r.aviso) avisos.push(`${arq.name}: ${r.aviso}`);
      } catch (e) {
        console.error(e);
        if (!prog.cancelado) avisos.push(`${arq.name}: ${e.message || e}`);
      }
    }
    prog.fechar();

    if (avisos.length) {
      ui.modal({ titulo: 'Atenção', corpo: el('div', null, avisos.map(a => el('p', { text: a }))), botoes: [{ texto: 'Entendi', classe: 'primario' }] });
    }
    // Um único arquivo: abre direto. Vários: mostra a estante.
    if (arquivos.length === 1 && ultimo) await B.abrir(ultimo.id);
    else { await B.mostrar(); if (novos) ui.aviso(novos === 1 ? '1 arquivo adicionado à biblioteca.' : `${novos} arquivos adicionados à biblioteca.`); }
  };

  /* ============================================================
     Menu, informações, vínculo e remoção
     ============================================================ */

  B.menu = function (meta) {
    let modal = null;
    const opcao = (nome, texto, acao, classe) => el('button', { class: 'item ' + (classe || ''), onclick: () => { modal.fechar(); acao(); } }, [icone(nome), el('span', { class: 'item-corpo', text: texto })]);
    const lista = el('div', { class: 'menu-lista' }, [
      opcao(meta.tipo === 'audio' ? 'fone' : 'pagina', meta.tipo === 'audio' ? 'Ouvir' : 'Abrir', () => B.abrir(meta.id)),
      meta.tipo === 'texto' ? opcao('fone', meta.audioVinculado ? 'Trocar o audiobook vinculado (modo híbrido)' : 'Vincular um audiobook (modo híbrido)', () => B.vincular(meta)) : null,
      opcao('info', 'Informações e edição do título', () => B.info(meta)),
      opcao('lixeira', 'Remover da biblioteca', () => B.excluir(meta), 'perigo')
    ]);
    modal = ui.modal({ titulo: meta.titulo, corpo: lista });
  };

  /** Ficha do livro, com edição de título/autor e o relatório da limpeza automática. */
  B.info = function (meta) {
    const prog = dados.progresso(meta.id);
    const L = LPM.leitor;
    const aberto = L.meta && L.meta.id === meta.id;
    const linhas = [];
    const linha = (rot, val) => { if (val) { linhas.push(el('dt', { text: rot })); linhas.push(el('dd', { text: val })); } };
    linha('Arquivo', meta.arquivo);
    linha('Formato', meta.formato.toUpperCase() + ' — ' + formatarTamanho(meta.tamanho || 0));
    linha('Narração', meta.narrador);
    linha('Gênero', meta.genero);
    if (meta.duracao) linha('Duração', formatarDuracao(meta.duracao));
    if (meta.capitulosAudio && meta.capitulosAudio.length) linha('Capítulos', String(meta.capitulosAudio.length));
    if (aberto) {
      linha('Páginas', L.dados.paginas.length.toLocaleString(window.NebulosaIdiomas ? NebulosaIdiomas.local() : 'pt-BR'));
      linha('Capítulos', L.dados.capitulos.length ? String(L.dados.capitulos.length) : 'nenhum detectado');
    }
    linha('Adicionado', formatarData(meta.adicionado));
    linha('Última leitura', prog.data ? `${formatarData(prog.data)} — ${Math.round((prog.pct || 0) * 100)}% concluído` : 'ainda não aberto');
    if (prog.ouvido > 60) linha('Tempo ouvido', formatarDuracao(prog.ouvido));

    const campoTitulo = el('input', { type: 'text', id: 'infoTitulo', value: meta.titulo });
    const campoAutor = el('input', { type: 'text', id: 'infoAutor', value: meta.autor || '' });
    const corpo = el('div', null, [
      el('div', { class: 'campo' }, [el('label', { for: 'infoTitulo', text: 'Título' }), campoTitulo]),
      el('div', { class: 'campo' }, [el('label', { for: 'infoAutor', text: 'Autor' }), campoAutor]),
      el('dl', { class: 'ficha' }, linhas)
    ]);

    if (aberto) {
      const r = L.dados.relatorio;
      const itens = [
        [r.cabecalhos, 'cabeçalhos repetidos'], [r.rodapes, 'rodapés repetidos'], [r.numeros, 'números de página'],
        [r.urls, 'URLs repetidas'], [r.copyrights, 'avisos de copyright'], [r.isbn, 'linhas de ISBN'],
        [r.propagandas, 'propagandas e assinaturas'], [r.repetidos, 'créditos e notas repetidos'], [r.sumarios, 'sumários/índices']
      ].filter(x => x[0] > 0).map(x => `${x[0].toLocaleString(window.NebulosaIdiomas ? NebulosaIdiomas.local() : 'pt-BR')} ${x[1]}`);
      corpo.appendChild(el('p', { class: 'nota destaque', text: !LPM.dados.cfg.limpeza.ativa
        ? 'Limpeza automática desligada nas Configurações: o texto é lido como está no arquivo.'
        : (itens.length ? 'Limpeza automática — removidos da leitura: ' + itens.join(', ') + '.' : 'Limpeza automática: nada precisou ser removido neste livro.') }));
    }

    ui.modal({
      titulo: 'Informações', corpo,
      botoes: [
        { texto: 'Fechar' },
        { texto: 'Salvar título e autor', classe: 'primario', acao: async () => {
          meta.titulo = campoTitulo.value.trim() || meta.titulo;
          meta.autor = campoAutor.value.trim();
          await dados.bd.atualizarMeta(meta);
          if (aberto) { L.meta.titulo = meta.titulo; L.meta.autor = meta.autor; $('#leitorTitulo').textContent = meta.titulo; }
          if (LPM.audio.meta && LPM.audio.meta.id === meta.id) { $('#audioTitulo').textContent = meta.titulo; $('#audioAutor').textContent = meta.autor; }
          if (ui.visao === 'biblioteca') B.atualizar();
          ui.aviso('Informações salvas.');
        } }
      ]
    });
  };

  /** Escolhe o audiobook correspondente a um livro de texto (modo híbrido). */
  B.vincular = async function (meta) {
    const audios = (await dados.bd.listar()).filter(m => m.tipo === 'audio');
    let modal = null;
    const definir = async id => {
      modal.fechar();
      meta.audioVinculado = id || null;
      await dados.bd.atualizarMeta(meta);
      const L = LPM.leitor;
      if (L.meta && L.meta.id === meta.id) {
        if (L.hibrido) LPM.hibrido.desativar();
        L.meta.audioVinculado = meta.audioVinculado;
        $('#btHibrido').hidden = !meta.audioVinculado;
      }
      ui.aviso(id ? 'Audiobook vinculado. Abra o livro e use o botão "Modo híbrido".' : 'Vínculo removido.', null, 6000);
    };
    const corpo = el('div', null, [
      el('p', { class: 'nota', text: 'Escolha o audiobook que corresponde a este livro. No leitor, o botão "Modo híbrido" toca o áudio e acompanha o texto.' })
    ]);
    if (!audios.length) {
      corpo.appendChild(el('p', { text: 'Ainda não há audiobooks na biblioteca. Adicione o arquivo de áudio (MP3, M4B…) e volte aqui.' }));
    } else {
      corpo.appendChild(el('div', { class: 'menu-lista' }, audios.map(a => el('button', { class: 'item' + (meta.audioVinculado === a.id ? ' atual' : ''), onclick: () => definir(a.id) }, [
        icone('fone'),
        el('span', { class: 'item-corpo' }, [el('span', { class: 'item-titulo', text: a.titulo }), el('span', { class: 'item-sub', text: [a.autor, a.duracao ? formatarDuracao(a.duracao) : ''].filter(Boolean).join(' · ') })])
      ]))));
    }
    modal = ui.modal({ titulo: 'Vincular audiobook', corpo, botoes: meta.audioVinculado ? [{ texto: 'Remover vínculo', classe: 'perigo', manter: true, acao: () => definir(null) }] : [] });
  };

  B.excluir = async function (meta) {
    const ok = await ui.perguntar('Remover da biblioteca',
      `Remover "${meta.titulo}" da biblioteca? O progresso e os marcadores deste livro também serão apagados. O arquivo original no seu computador não é afetado.`,
      'Remover', 'Cancelar');
    if (!ok) return;
    if (LPM.leitor.meta && LPM.leitor.meta.id === meta.id) LPM.leitor.fechar();
    if (LPM.audio.meta && LPM.audio.meta.id === meta.id) { LPM.audio.descarregar(); ui.definirContexto(null); }
    await dados.bd.excluir(meta.id);
    ['prog.', 'marc.', 'sinc.'].forEach(p => dados.remover(p + meta.id));
    if (dados.ler('ultimo', null) === meta.id) dados.remover('ultimo');
    LPM.estat.esquecer(meta.id);
    await B.mostrar();
    ui.aviso('Removido da biblioteca.');
  };

  LPM.biblioteca = B;
})();
