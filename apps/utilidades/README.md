# Utilidades — Nebulosa Workspace

Versão do Workspace: **1.0** · Mini-ferramentas do dia a dia, 100% no navegador (nada é enviado para a internet).

Manual para usuários: `manuais/utilidades.html` (também `.en.html` e `.es.html`).
Este arquivo é para quem mantém o código.

## Ferramentas

| id | Arquivo | O que faz |
|---|---|---|
| `qr` | `js/qr.js` | QR Code (link, texto, Wi-Fi, contato, e-mail, WhatsApp); PNG/SVG |
| `unidades` | `js/unidades.js` | Conversor de unidades (medidas, temperatura, cozinha…) |
| `imagem` | `js/imagem.js` | Comprimir e redimensionar fotos (JPEG/WebP/PNG) |
| `conversor` | `js/conversor.js` + `js/conversor/` | **Conversor de arquivos** (novo na 1.0) — ver abaixo |
| `senha` | `js/senha.js` | Gerador e testador de senhas |
| `contador` | `js/contador.js` | Palavras, caracteres, tempo de leitura |
| `cores` | `js/cores.js` | Conversões, paletas e contraste |
| `pdf` | `js/pdf.js` | Juntar, dividir, girar e assinar PDF |
| `tarefas` | `js/tarefas.js` | Quadro de tarefas e notas |
| `quadro` | `js/quadro.js` | Quadro branco |

`js/base.js` traz o que é comum (navegação por `#ferramenta/parte`, avisos, baixar/copiar, zona de soltar arquivos, carregamento
de bibliotecas sob demanda, ponte com o Workspace: "Mandar para…" e receber arquivos). Cada ferramenta se registra com
`UT.registrar('id', { montar, abrir, conteudos, aceita, receber, ocupado })`. A lista de ferramentas (nome, descrição, ícone) está em
`js/apps.js` (raiz do projeto), campo `ferramentas` da entrada `utilidades`. Textos em inglês/espanhol: `nebulosa-idiomas.js`
(`'português': ['English', 'Español']`; `{1}`, `{2}` = partes variáveis).

## Conversor de arquivos (1.0)

Tela: `js/conversor.js` (fila de arquivos, escolha do formato, opções, progresso, download/.zip).
Núcleo e motores: `js/conversor/`.

* `nucleo.js` — tabela de formatos (`CV.FMT`; id, nome, categoria, extensões, mime, se pode ser saída), detecção (`CV.detectar`), registro de
  motores (`CV.motor`, `CV.alvos`, `CV.motorDe`, `CV.opcoes`), `CV.converter(arquivo, de, para, opcoes, {progresso, cancelado})`,
  carregamento de bibliotecas leves (`CV.lib`) e dos componentes pesados (`CV.motorWeb`: pasta `libs/conversor` → cache do navegador →
  jsDelivr, **sempre com consentimento**), Workers (`CV.worker`).
* `motor-documento.js` — DOCX, ODT, RTF, EPUB, FB2, HTML, Markdown, TXT e PDF (leitura) ⇄ PDF, DOCX, ODT, RTF, EPUB, HTML, MD, TXT (gravação).
  Tudo passa por um HTML intermediário (`lerDocumento` → HTML seguro → gravadores). PDF de entrada: títulos/parágrafos/listas por tamanho de letra;
  páginas sem texto entram como imagens.
* `motor-pdf-saida.js` — gera PDF a partir do HTML intermediário (pdf-lib + fontkit + Noto/DejaVu incorporadas; quebra de linha, listas,
  tabelas que atravessam páginas, imagens, links, numeração). Se as fontes não carregarem, usa as fontes padrão do PDF (só caracteres latinos).
* `motor-planilha.js` — SheetJS: XLSX/XLSM/XLSB/XLS/ODS/FODS/CSV/TSV/DIF/SLK/PRN/Numbers(leitura)/JSON; HTML, Markdown e PDF de saída.
* `motor-imagem.js` — canvas do navegador para PNG/JPG/WebP/GIF/BMP/ICO/SVG/AVIF; ImageMagick WASM (`magick`) para TIFF, TGA, PSD, HEIC (só leitura),
  JPEG XL, JPEG 2000, DDS, PCX, PPM, QOI, EXR, HDR, GIF/AVIF de saída; imagem → PDF; PDF → imagens (PDF.js).
* `motor-midia.js` — FFmpeg WASM (`ffmpeg`, núcleo único) para áudio e vídeo. Ver "Limites do FFmpeg".
* `motor-arquivo.js` — ZIP/TAR/TAR.GZ/GZ entre si (JSZip + CompressionStream) e fontes TTF/OTF ⇄ WOFF.

Um motor novo é um arquivo que chama `UT.CV.motor({ id, rotas(de), opcoes(de, para), converter(ctx) })` (contrato no topo de `nucleo.js`),
mais uma linha `<script>` em `index.html`. Formatos novos entram na tabela `F` de `nucleo.js`. Quem exige um componente pesado declara
`pesado(de, para)` (devolve `'ffmpeg'` ou `'magick'`) para a tela avisar do download.

### Componentes pesados (não vêm no pacote)

| Componente | Versão | Tamanho | Licença |
|---|---|---|---|
| FFmpeg (`@ffmpeg/core`, UMD, um núcleo) | 0.12.10 | ~32 MB | GPL 2.0 ou posterior |
| ImageMagick (`@imagemagick/magick-wasm`, build x86) | 0.0.45 | ~16 MB | Apache 2.0 / Licença do ImageMagick |

Para usar sem internet desde o começo: `libs/conversor/Baixar-Bibliotecas.bat` ou `sh libs/conversor/baixar-bibliotecas.sh` (veja `libs/conversor/LEIA-ME.txt`).
No HTML único (`ferramentas/gerar-html-unico.py`) eles também são baixados na primeira vez.

### Limites do FFmpeg nesta versão do componente

* VP9 derruba a página → WebM usa **VP8** (+ Opus).
* libopus em estéreo com nível de compressão acima de 4 derruba o componente → o Conversor usa `-compression_level 3`.
* Sem aceleração de hardware; um só núcleo; arquivos acima de ~1,5 GB são recusados com aviso.

### O que o Conversor NÃO faz (de propósito ou por limite do navegador)

DOC/PPT/PPTX/ODP, MOBI/AZW3, RAW de câmeras, 7z/RAR, WOFF2, CAD, AI/EPS, PDF com senha, OCR, preservar o layout exato de documentos, copiar metadados.
Não é um clone do Convertio: aquele serviço converte em servidores e conhece centenas de formatos.

## Bibliotecas (`libs/`)

| Pasta/arquivo | Uso | Licença |
|---|---|---|
| `pdf-lib.min.js` | juntar/dividir/girar/assinar PDF; PDF gerado pelo Conversor | MIT |
| `pdfjs/` | abrir PDF e desenhar páginas | Apache 2.0 |
| `jszip.min.js` | .zip | MIT ou GPLv3 |
| `sheetjs/` | planilhas | Apache 2.0 |
| `mammoth/` | ler .docx | BSD 2 cláusulas |
| `docx/` (3.10.2) | gravar .docx | MIT |
| `marked/`, `turndown/` | Markdown ⇄ HTML | MIT |
| `fontkit/` | incorporar fontes TTF nos PDFs | MIT |
| `fontes/` | Noto Sans/Serif (OFL 1.1) e DejaVu Sans Mono — cada TTF dentro de um `.js` em base64, para funcionar também direto do disco | OFL 1.1 / Bitstream Vera |

Licenças completas: `legal/creditos.html`.

## Testar

Sirva a pasta raiz do projeto (`python3 -m http.server 8765`) e abra `http://localhost:8765/apps/utilidades/#conversor`.
Pelo console, `UT.CV.converter(new File([...], 'a.md'), 'md', 'pdf', {})` devolve `[{ blob, nome }]`.
Na 1.0 foram verificados, em Chromium: documentos entre si (e abertos no LibreOffice/pandoc), PDF gerado, planilhas, imagens (inclusive via
ImageMagick), áudio e vídeo (decodificados com o FFmpeg de linha de comando) e arquivos compactados. **Não verificados**: leitura de HEIC real e o
download pelo jsDelivr (o ambiente de teste não tinha acesso à internet).
