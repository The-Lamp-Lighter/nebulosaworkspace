#!/bin/sh
# Nebulosa Workspace — servidor local para Linux e macOS (somente neste computador)
cd "$(dirname "$0")" || exit 1
URL="http://localhost:8780/"
( sleep 1; (xdg-open "$URL" || open "$URL") >/dev/null 2>&1 ) &
echo "Nebulosa Workspace em $URL — pressione Ctrl+C para encerrar."
exec python3 -m http.server 8780 --bind 127.0.0.1
