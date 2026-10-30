/* ============================================================
   LêPraMim — sw.js (service worker)
   Guarda os arquivos do aplicativo no computador para que o
   LêPraMim instalado abra mesmo com o servidor local desligado
   e sem internet. Só atende arquivos da própria pasta do app;
   nenhum dado do usuário passa por aqui.
   ============================================================ */
const CACHE = 'lepramim-v7'; // [Nebulosa] v5: js/bibliotecas-web.js · v6: js/nebulosa-vozes.js · v7: nebulosa-idiomas.js
const ESSENCIAIS = [
  './', 'index.html', 'nebulosa-idiomas.js', 'manifest.webmanifest', 'favicon.ico', 'css/estilo.css', 'css/aparencia-nebulosa.css',
  'assets/icone-96.png', 'assets/icone-192.png', 'assets/icone-512.png', 'assets/favicon.png', 'assets/logo-vertical.png',
  'js/config.js', 'js/util.js', 'js/armazenamento.js', 'js/zip.js', 'js/capitulos.js', 'js/limpeza.js', 'js/livro.js',
  'js/metadados-audio.js', 'js/bibliotecas-web.js', 'js/importadores.js', 'js/voz.js', 'js/piper.js', 'js/piper-worker.js', 'js/interface.js', 'js/estatisticas.js', 'js/temporizador.js',
  'js/marcadores.js', 'js/busca.js', 'js/leitor.js', 'js/audiobook.js', 'js/hibrido.js', 'js/gerador.js', 'js/biblioteca.js',
  'js/configuracoes.js', 'js/ajuda.js', 'js/nebulosa-vozes.js', 'js/app.js',
  'libs/pdfjs/pdf.js', 'libs/pdfjs/pdf.worker.js'
];
// Bibliotecas opcionais: entram no cache se já tiverem sido baixadas
const OPCIONAIS = [
  // ponte do Nebulosa Workspace (só existe quando o LêPraMim está dentro do Workspace)
  '../../shared/nebulosa-bridge.js',
  'libs/tesseract/tesseract.min.js', 'libs/tesseract/worker.min.js',
  'libs/tesseract/core/tesseract-core.wasm.js', 'libs/tesseract/core/tesseract-core-simd.wasm.js',
  'libs/tesseract/core/tesseract-core-lstm.wasm.js', 'libs/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  'libs/tesseract/lang/por.traineddata.gz', 'libs/tesseract/lang/eng.traineddata.gz',
  'libs/mammoth/mammoth.browser.min.js', 'libs/lamejs/lame.min.js',
  // voz neural Piper (motor + voz Cadu)
  'libs/piper/vozes/vozes.json', 'libs/piper/ort/ort.wasm.min.js', 'libs/piper/ort/ort-wasm-simd.wasm', 'libs/piper/ort/ort-wasm.wasm',
  'libs/piper/phonemize/piper_phonemize.js', 'libs/piper/phonemize/piper_phonemize.wasm', 'libs/piper/phonemize/piper_phonemize.data',
  'libs/piper/vozes/pt_BR-cadu-medium.onnx.json', 'libs/piper/vozes/pt_BR-cadu-medium.onnx'
];

self.addEventListener('install', evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cada arquivo é guardado separadamente: a falta de um opcional não impede a instalação
    await Promise.all(ESSENCIAIS.concat(OPCIONAIS).map(async url => {
      try {
        const r = await fetch(url, { cache: 'no-cache' });
        if (r.ok) await cache.put(url, r);
      } catch (e) { /* arquivo ausente */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Rede local primeiro (para pegar atualizações); sem servidor, usa a cópia guardada
self.addEventListener('fetch', evento => {
  const req = evento.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  evento.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const r = await fetch(req);
      if (r.ok && r.status === 200) cache.put(req, r.clone()).catch(() => {});
      return r;
    } catch (e) {
      const guardado = await cache.match(req, { ignoreSearch: true }) || await cache.match('index.html');
      if (guardado) return guardado;
      throw e;
    }
  })());
});
