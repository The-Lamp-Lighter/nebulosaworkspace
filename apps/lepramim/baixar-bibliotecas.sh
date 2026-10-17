#!/bin/sh
# LêPraMim — baixa as bibliotecas opcionais (uma única vez) no Linux e macOS
cd "$(dirname "$0")/libs" || exit 1
T=https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.0/dist
C=https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0
L=https://tessdata.projectnaptha.com/4.0.0
mkdir -p tesseract/core tesseract/lang lamejs mammoth piper/ort piper/phonemize piper/vozes
baixar() { [ -s "$2" ] && { echo "já existe  $2"; return; }; curl -fsSL "$1" -o "$2" && echo "ok         $2" || { rm -f "$2"; echo "FALHOU     $2"; }; }
baixar $T/tesseract.min.js tesseract/tesseract.min.js
baixar $T/worker.min.js tesseract/worker.min.js
for n in tesseract-core tesseract-core-simd tesseract-core-lstm tesseract-core-simd-lstm; do baixar $C/$n.wasm.js tesseract/core/$n.wasm.js; done
baixar $L/por.traineddata.gz tesseract/lang/por.traineddata.gz
baixar $L/eng.traineddata.gz tesseract/lang/eng.traineddata.gz
baixar https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js lamejs/lame.min.js
baixar https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js mammoth/mammoth.browser.min.js
# Voz neural Piper (motor + voz "Cadu")
O=https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist
F=https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build
V=https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR
for n in ort.wasm.min.js ort-wasm-simd.wasm ort-wasm.wasm; do baixar $O/$n piper/ort/$n; done
for n in piper_phonemize.js piper_phonemize.wasm piper_phonemize.data; do baixar $F/$n piper/phonemize/$n; done
baixar $V/cadu/medium/pt_BR-cadu-medium.onnx.json piper/vozes/pt_BR-cadu-medium.onnx.json
baixar $V/cadu/medium/pt_BR-cadu-medium.onnx piper/vozes/pt_BR-cadu-medium.onnx
