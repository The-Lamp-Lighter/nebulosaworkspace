/* ==========================================================================
   Fluxo › Ondas — modelos.js (1.1)
   Modelos prontos: cada um monta uma cena inteira (fundo, camadas e efeitos).
   Para criar um modelo novo, copie um dos abaixo e mude as cores e números.
   ========================================================================== */
(function () {
  'use strict';
  var FO = window.FluxoOndas = window.FluxoOndas || {};
  var M = FO.motor;
  function C(tipo, o) { return M.novaCamada(tipo, o); }
  function base(fundo, fx) {
    var c = M.cenaVazia();
    Object.assign(c.fundo, fundo || {});
    for (var k in (fx || {})) c.fx[k] = (typeof fx[k] === 'object') ? Object.assign({}, c.fx[k], fx[k]) : fx[k];
    return c;
  }
  var SANS = 'Inter, "Segoe UI", Arial, sans-serif';

  FO.MODELOS = [
    {
      id: 'barras', nome: 'Barras clássicas', desc: 'Barras que sobem com a música, sobre um degradê roxo.',
      cena: function () {
        var c = base({ cor1: '#14102a', cor2: '#2b1d57', angulo: 165 }, { vinheta: { on: true, forca: 0.4 } });
        c.camadas.push(C('barras', { nome: 'Barras', y: 0.76, n: 56, largTotal: 0.78, altMax: 420, larg: 0.72 }));
        c.camadas.push(C('texto', { nome: 'Título', y: 0.14, texto: 'Minha música', tamanho: 92 }));
        c.camadas.push(C('progresso', { nome: 'Progresso', y: 0.93, estilo: 'ambos' }));
        return c;
      }
    },
    {
      id: 'circulo', nome: 'Círculo neon', desc: 'Anel de barras girando, com ondas a cada batida e brilho.',
      cena: function () {
        var c = base({ tipo: 'radial', cor1: '#241552', cor2: '#07091a' }, { brilho: { on: true, forca: 0.7, raio: 26 }, vinheta: { on: true, forca: 0.5 } });
        c.camadas.push(C('aneis', { nome: 'Ondas de batida', raio: 250, cor1: '#7dd3fc', cor2: '#a778ff', grad: true }));
        c.camadas.push(C('circulo', { nome: 'Círculo', raio: 250, altMax: 190, n: 120, cor1: '#38bdf8', cor2: '#f472b6', grad: true, espessura: 6 }));
        c.camadas.push(C('circulo', { nome: 'Círculo interno', raio: 150, altMax: 60, n: 60, estilo: 'linha', giro: -20, espessura: 4, cor1: '#feff36', cor2: '#ff9c54', grad: true, preencher: false }));
        c.camadas.push(C('texto', { nome: 'Título', y: 0.9, texto: 'Minha música', tamanho: 64, pulsa: 0.03 }));
        return c;
      }
    },
    {
      id: 'suave', nome: 'Onda suave', desc: 'Uma linha de onda espelhada, calma e elegante, em tons pastel.',
      cena: function () {
        var c = base({ cor1: '#ffd9e8', cor2: '#c9b6ff', angulo: 150 }, { vinheta: { on: true, forca: 0.25 } });
        c.camadas.push(C('linha', { nome: 'Onda', y: 0.5, modo: 'onda', altMax: 360, espessura: 7, espelho: true, preencher: true, cor1: '#7c3aed', cor2: '#ff4f9a', grad: true, brilho: 12, largTotal: 0.86, ganho: 1.4 }));
        c.camadas.push(C('linha', { nome: 'Onda de fundo', y: 0.5, modo: 'espectro', altMax: 220, espessura: 3, espelho: true, opacidade: 0.6, cor1: '#7c3aed', cor2: '#7c3aed', largTotal: 0.86 }));
        c.camadas.push(C('texto', { nome: 'Título', y: 0.17, texto: 'Minha música', tamanho: 88, cor1: '#4c1d95', brilho: 0, pulsa: 0.04 }));
        c.camadas.push(C('progresso', { nome: 'Progresso', y: 0.9, estilo: 'barra', largTotal: 0.5, cor1: '#4c1d95', cor2: '#4c1d95' }));
        return c;
      }
    },
    {
      id: 'cosmos', nome: 'Cosmos de partículas', desc: 'Poeira de estrelas que explode nos graves, com um anel de luz.',
      cena: function () {
        var c = base({ tipo: 'radial', cor1: '#0f1f4a', cor2: '#02030a' }, { brilho: { on: true, forca: 0.8, raio: 22 }, vinheta: { on: true, forca: 0.5 } });
        c.camadas.push(C('particulas', { nome: 'Estrelas', emissor: 'tela', taxa: 45, rajada: 0, tamanho: 3, velocidade: 60, vida: 5, gravidade: 0, forma: 'estrela', cor1: '#ffffff', cor2: '#7dd3fc', reage: 'agudos', reagente: 1.2 }));
        c.camadas.push(C('circulo', { nome: 'Anel', raio: 220, altMax: 120, n: 128, estilo: 'linha', giro: 8, espessura: 4, cor1: '#a5b4fc', cor2: '#f0abfc', grad: true, preencher: false, brilho: 20 }));
        c.camadas.push(C('particulas', { nome: 'Explosão de graves', emissor: 'anel', raio: 230, taxa: 30, rajada: 50, tamanho: 6, velocidade: 220, vida: 2.6, gravidade: 0, cor1: '#feff36', cor2: '#ff9c54', grad: true }));
        c.camadas.push(C('texto', { nome: 'Título', y: 0.5, texto: 'Minha música', tamanho: 70, pulsa: 0.12, letra: 10 }));
        return c;
      }
    },
    {
      id: 'glitch', nome: 'Vibração glitch', desc: 'Tela que treme, divide as cores e quebra em faixas no ritmo.',
      cena: function () {
        var c = base({ cor1: '#050507', cor2: '#050507' }, { vibracao: { on: true, forca: 14, rot: 0.8 }, rgb: { on: true, forca: 10, reage: 'batida' }, glitch: { on: true, forca: 0.8 }, granulado: { on: true, forca: 0.22 }, flash: { on: true, forca: 0.14 }, vinheta: { on: true, forca: 0.5 } });
        c.camadas.push(C('barras', { nome: 'Barras', y: 0.5, direcao: 'centro', simetria: true, n: 64, altMax: 520, largTotal: 0.86, cor1: '#00ffd5', cor2: '#ff2bd6', grad: true, brilho: 18 }));
        c.camadas.push(C('texto', { nome: 'Título', y: 0.5, texto: 'MINHA MÚSICA', tamanho: 120, peso: 900, vibra: 1.4, pulsa: 0.1, letra: 6, contorno: 0, mistura: 'difference' }));
        return c;
      }
    },
    {
      id: 'pontos', nome: 'Equalizador de pontos', desc: 'Colunas de pontinhos acendendo, no estilo dos aparelhos de som.',
      cena: function () {
        var c = base({ cor1: '#0f172a', cor2: '#1e1b4b', angulo: 180 }, { vinheta: { on: true, forca: 0.35 } });
        c.camadas.push(C('pontos', { nome: 'Equalizador', y: 0.72, n: 44, linhas: 14, altMax: 420, largTotal: 0.8 }));
        c.camadas.push(C('texto', { nome: 'Título', y: 0.16, texto: 'Minha música', tamanho: 84 }));
        c.camadas.push(C('progresso', { nome: 'Tempo', y: 0.92, estilo: 'tempo', tamanho: 36 }));
        return c;
      }
    },
    {
      id: 'lofi', nome: 'Lo-fi aconchegante', desc: 'Tons quentes, uma linha fininha e granulado de filme antigo.',
      cena: function () {
        var c = base({ cor1: '#f6e7d0', cor2: '#e5b98c', angulo: 170 }, { granulado: { on: true, forca: 0.28 }, vinheta: { on: true, forca: 0.35 } });
        c.camadas.push(C('linha', { nome: 'Linha', y: 0.58, modo: 'espectro', altMax: 260, espessura: 4, espelho: true, largTotal: 0.6, cor1: '#5b3a29', cor2: '#5b3a29', brilho: 0, suavizacao: 0.55 }));
        c.camadas.push(C('texto', { nome: 'Título', y: 0.3, texto: 'lo-fi beats', tamanho: 100, peso: 600, cor1: '#5b3a29', pulsa: 0.02, letra: 8, fonte: 'Georgia, "Times New Roman", serif' }));
        c.camadas.push(C('progresso', { nome: 'Progresso', y: 0.9, estilo: 'barra', largTotal: 0.4, cor1: '#5b3a29', cor2: '#5b3a29', espessura: 5 }));
        return c;
      }
    },
    {
      id: 'graves', nome: 'Pulso de graves', desc: 'A tela inteira dá um soco a cada batida: zoom, flash e anéis.',
      cena: function () {
        var c = base({ tipo: 'radial', cor1: '#5a1250', cor2: '#12041f' }, { zoom: { on: true, forca: 0.09, reage: 'graves' }, flash: { on: true, forca: 0.22 }, brilho: { on: true, forca: 0.6, raio: 30 }, vinheta: { on: true, forca: 0.5 } });
        c.camadas.push(C('aneis', { nome: 'Anéis', raio: 120, velocidade: 760, vida: 1.2, espessura: 10, cor1: '#ffffff', cor2: '#ff9c54', grad: true }));
        c.camadas.push(C('texto', { nome: 'Título', y: 0.5, texto: 'DROP', tamanho: 220, peso: 900, pulsa: 0.22, vibra: 1, letra: 10 }));
        c.camadas.push(C('barras', { nome: 'Barras', y: 1, n: 80, altMax: 300, largTotal: 1, larg: 0.8, arred: 0, cor1: '#ff9c54', cor2: '#ff2bd6', grad: true, brilho: 10 }));
        return c;
      }
    }
  ];
})();
