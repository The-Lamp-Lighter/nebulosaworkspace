# Fluxo › Ondas (estúdio de ondas de áudio) — documentação para quem mexe no código

Novo na versão **1.1**. É a aba **Ondas** do Fluxo: transforma uma música em vídeo com barras, ondas,
círculos, partículas e vibrações que reagem ao som. Manual do usuário: `manuais/fluxo.html`, seção 22
(e as versões `.en` e `.es`).

O Fluxo em si é um arquivo único já compilado (`apps/fluxo/index.html`, sem o código-fonte original).
Por isso o estúdio fica **fora** dele, nesta pasta, em JavaScript simples, e se liga ao Fluxo por
quatro pequenos pontos no `index.html` (procure por `nbIcOndas` e `nbPonte`).

## Arquivos

| Arquivo | O que tem |
|---|---|
| `motor.js` | Análise do áudio (FFT própria de 2048 pontos, 128 bandas de 30 Hz a 16 kHz, graves/médios/agudos, volume, pulso de batida, forma da onda) e o desenho das camadas e dos efeitos de tela cheia no canvas. |
| `exportar.js` | Grava o vídeo: WebCodecs (VP8/VP9 + Opus) com empacotador WebM próprio; reserva com `MediaRecorder` em tempo real e correção da duração. |
| `modelos.js` | Os 8 modelos prontos (cada um monta uma cena). Para criar outro, copie um e mude. |
| `ui.js` | A tela cheia do estúdio (camadas, abas Camada/Fundo/Efeitos/Exportar, linha do tempo da música) e o painelzinho da aba Ondas. |
| `ondas.css` | Visual, usando as cores do próprio Fluxo (`--panel`, `--text`, `--accent`…). |
| `ondas-idiomas.js` | Textos em inglês e espanhol (formato `'português': ['English', 'Español']`). |

Ordem de carregamento (em `apps/fluxo/index.html`): `motor.js`, `exportar.js`, `modelos.js`, `ui.js`, `ondas-idiomas.js`.
Tudo vive em `window.FluxoOndas`.

## Como funciona

- **Análise**: `Analise.passo(t, dt)` olha o áudio já decodificado na posição `t` e atualiza `bruto[128]`,
  `onda[512]`, `graves`, `medios`, `agudos`, `volume`, `pulso` e `pulsoNovo`. Há um ganho automático
  (músicas baixinhas também se mexem) e a escala em dB tem uma inclinação de 3 dB por oitava para os agudos
  não ficarem mortos.
- **Desenho**: `Render.desenhar(ctx, cena, analise, {W,H,t,dt,dur})` usa só esses números e o tempo.
  Por isso a prévia e o vídeo exportado ficam iguais: na exportação o tempo anda em passos de `1/fps`.
  Tudo que é "aleatório" é determinístico (partículas com semente, tremida com ruído por número de quadro).
  Unidades: 1 unidade = `min(largura, altura) / 1080` pixels, então um modelo se vê igual em 16:9 e 9:16.
- **Cena**: JSON simples (`cenaVazia()`): `larg`, `alt`, `fundo`, `fx`, `camadas[]`. Cada camada tem `tipo`
  (barras, linha, circulo, pontos, aneis, particulas, texto, imagem, progresso) e os campos de `PADRAO[tipo]`.
  Imagens ficam como data URL dentro da cena. A cena é guardada em `localStorage` (`nb.fluxo.ondas.cena`,
  sem imagens com mais de ~300 KB) e pode ser baixada como `.ondas.json`.
- **Exportação** (`exportarWebCodecs`): um quadro por vez → `VideoFrame` → `VideoEncoder`; o áudio é reamostrado
  para 48 kHz estéreo (`OfflineAudioContext`) e vai para o `AudioEncoder` (Opus). O empacotador monta
  EBML/WebM (Info com `Duration`, Tracks com `OpusHead`, Clusters por quadro-chave, Cues). Sem WebCodecs,
  `exportarGravador` grava em tempo real e `corrigirDuracaoWebm` põe a duração que o `MediaRecorder` esquece.
- **Ponte com o Fluxo** (`nbPonte`, em `index.html`): `audios()` lista as músicas do projeto, `importar(arquivos, naLinhaDoTempo)`
  importa o vídeo pronto e o coloca na linha do tempo, `aviso()` mostra a mensagem do Fluxo. Fora do Fluxo
  (`FluxoOndas.ponte` vazio) o estúdio funciona igual, só que o vídeo é apenas baixado.

## Como acrescentar um tipo de camada

1. Em `motor.js`: um desenhador `D.meutipo = function (ctx, L, st, an, e) {…}` (origem no centro da camada),
   um `PADRAO.meutipo`, um nome em `NOMES` e o tipo em `TIPOS`.
2. Em `ui.js`: os campos do inspetor em `ESPECIFICO.meutipo` e uma frase em `DESC`.
3. Em `ondas-idiomas.js`: as traduções. No manual: uma linha na tabela de camadas (3 idiomas).

## Limites conhecidos

- Saída só em WebM (VP8 ou VP9 + Opus). MP4/MOV: pelo Exportar do próprio Fluxo, depois de pôr o vídeo na linha do tempo.
- `brilho` (bloom), desfoque da imagem e giro de cores usam `ctx.filter`; navegadores sem isso ignoram.
- Músicas acima de ~30 min gastam muita memória na exportação (use o trecho).
- Não analisa microfone nem som ao vivo; só arquivos.
- Testado no Chromium (Playwright): prévia, 8 modelos, exportação por WebCodecs (lida pelo ffprobe), reserva por
  MediaRecorder, camada de imagem, formato 9:16, salvar e abrir cena, entrada na linha do tempo. Não testado
  em Safari e Firefox.

## Offline e HTML único

`sw.js` guarda estes arquivos (`EXTRAS.fluxo`). O `ferramentas/gerar-html-unico.py` embute os `<script>` e o
`<link>` locais sozinho, sem precisar de lista.
