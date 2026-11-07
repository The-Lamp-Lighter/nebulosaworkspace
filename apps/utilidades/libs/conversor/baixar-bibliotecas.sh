#!/bin/sh
# Utilidades - baixa FFmpeg e ImageMagick (WebAssembly) para esta pasta, uma unica vez.
# Uso:  sh baixar-bibliotecas.sh
cd "$(dirname "$0")" || exit 1
CDN=https://cdn.jsdelivr.net/npm
baixa() {  # url destino
  mkdir -p "$(dirname "$2")"
  echo "Baixando $2 ..."
  if command -v curl >/dev/null 2>&1; then curl -fL --retry 3 -o "$2" "$1" || { echo "FALHOU: $1"; rm -f "$2"; return 1; }
  elif command -v wget >/dev/null 2>&1; then wget -q -O "$2" "$1" || { echo "FALHOU: $1"; rm -f "$2"; return 1; }
  else echo "Precisa de curl ou wget."; exit 1; fi
}
baixa "$CDN/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js"   ffmpeg/ffmpeg-core.js
baixa "$CDN/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm" ffmpeg/ffmpeg-core.wasm
baixa "$CDN/@imagemagick/magick-wasm@0.0.45/dist/index.umd.cjs"  magick/magick.umd.js
baixa "$CDN/@imagemagick/magick-wasm@0.0.45/dist/x86/magick.wasm" magick/magick.wasm
echo "Pronto. O Conversor de arquivos passa a usar estes arquivos, sem perguntar nada."
