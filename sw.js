/* ==========================================================================
   Nebulosa Workspace — sw.js  (0.8, revisto na 0.9)
   Cópia local do site para ele continuar funcionando quando a internet cai.

   Como funciona
   -------------
   - Com internet, tudo vem do site, como sempre (rede primeiro): cada arquivo
     que chega é guardado numa cópia ("nebulosa-site-<versão>") no navegador.
   - Sem internet, o que já foi aberto antes vem dessa cópia. A página inicial,
     os arquivos da casca, os manuais gerais e as páginas legais são guardados
     logo na primeira visita.
   - (0.9) Quando um programa é aberto, os arquivos que ele só carrega na hora de
     usar (leitor de PDF, componente .zip, exportador de PowerPoint, ajuda interna)
     e o manual dele também são guardados, em segundo plano: assim abrir um PDF
     no Typee ou juntar PDFs nas Utilidades funciona sem internet. A lista fica em
     EXTRAS, abaixo. O OCR do EmCanto (~9 MB) não entra: ele é baixado na primeira
     vez que a letra de uma partitura é lida.
   - (0.9) Com a rede muito lenta, depois de alguns segundos a cópia guardada é
     usada (a rede continua e atualiza a cópia).
   - (0.9) Página nunca aberta, sem internet: aparece o aviso de "sem internet"
     (404.html com a marca nebulosa-sem-internet), e não "página não existe".
   - (0.9) Sempre confere com o site se o arquivo mudou (cache: 'no-cache'; o
     GitHub Pages responde "não mudou" rapidinho). Sem isso, nos 10 minutos depois
     de uma atualização o navegador podia misturar arquivos novos com cópias
     antigas da memória dele, e a página inicial ficava vazia.
   - As fontes do Google também são guardadas, para as letras não mudarem.
   - O contador de acessos e os componentes que os programas baixam de outros
     sites (vozes do LêPraMim etc.) não passam por aqui.

   Isto NÃO torna o site instalável: não há manifest nem botão de instalar.
   Ao mudar a versão (ferramentas/versao.py), a cópia antiga é apagada sozinha.
   ========================================================================== */
const VERSAO = '1.1';
const CACHE = 'nebulosa-site-' + VERSAO;
const FONTES = 'nebulosa-fontes';
const BASICO = [
  './', 'index.html', '404.html', 'css/workspace.css',
  'js/theme.js', 'js/idiomas.js', 'js/icons.js', 'js/apps.js', 'js/doacao.js', 'js/tarefas.js', 'js/dicas.js', 'js/novidades.js',
  'js/qrcode.js', 'js/notificacoes.js', 'js/acessos.js', 'js/recentes.js', 'js/backup.js', 'js/workspace.js',
  'shared/nebulosa-bridge.js', 'shared/libs/jszip.min.js',
  'assets/img/logo-112.png', 'assets/img/logo-320.png', 'assets/img/favicon-64.png',
  'assets/img/nebulosa-workspace-logo-720.png', 'assets/img/nebulosa-workspace-logo-escuro-720.png',
  'manuais/manual.css', 'manuais/', 'manuais/index.html', 'manuais/index.en.html', 'manuais/index.es.html',
  'legal/termos.html', 'legal/termos.en.html', 'legal/termos.es.html',
  'legal/privacidade.html', 'legal/privacidade.en.html', 'legal/privacidade.es.html',
  'legal/creditos.html', 'legal/creditos.en.html', 'legal/creditos.es.html'
];
/* (0.9) arquivos que cada programa só carrega na hora de usar (caminhos dentro de apps/<id>/) */
const EXTRAS = {
  typee: ['libs/pdfjs/pdf.js', 'libs/pdfjs/pdf.worker.js'],
  flyde: ['libs/pptxgen.bundle.js'],
  fluxo: ['ondas/ondas.css', 'ondas/motor.js', 'ondas/exportar.js', 'ondas/modelos.js', 'ondas/ui.js', 'ondas/ondas-idiomas.js'],   // (1.1) estúdio de ondas
  imaginarium: ['help/manual.html', 'help/credits.html', 'libs/pdfjs/pdf.js', 'libs/pdfjs/pdf.worker.js'],   // (1.0) + PDF.js: abrir PDF só de imagens
  utilidades: [
    'libs/pdf-lib.min.js',
    'libs/pdfjs/pdf.js',
    'libs/pdfjs/pdf.worker.js',
    'libs/jszip.min.js',
    'libs/sheetjs/xlsx.full.min.js',
    'libs/mammoth/mammoth.browser.min.js',
    'libs/docx/docx.min.js',
    'libs/marked/marked.min.js',
    'libs/turndown/turndown.min.js',
    'libs/fontkit/fontkit.umd.min.js',
    'libs/fontes/dejavu-mono/DejaVuSansMono-Bold.js',
    'libs/fontes/dejavu-mono/DejaVuSansMono.js',
    'libs/fontes/noto-sans/NotoSans_400Regular.js',
    'libs/fontes/noto-sans/NotoSans_400Regular_Italic.js',
    'libs/fontes/noto-sans/NotoSans_700Bold.js',
    'libs/fontes/noto-sans/NotoSans_700Bold_Italic.js',
    'libs/fontes/noto-serif/NotoSerif_400Regular.js',
    'libs/fontes/noto-serif/NotoSerif_400Regular_Italic.js',
    'libs/fontes/noto-serif/NotoSerif_700Bold.js',
    'libs/fontes/noto-serif/NotoSerif_700Bold_Italic.js'
  ]   // (1.0) + Conversor de arquivos (FFmpeg e ImageMagick ficam à parte, no cache do próprio Conversor)
};
const ESPERA_PAGINA = 3000, ESPERA_ARQUIVO = 3000; // ms até usar a cópia quando a rede está lenta

const guardavel = r => r && r.ok && r.status === 200 && r.type !== 'opaqueredirect';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // um por um: se algum faltar, os outros continuam guardados
    await Promise.all(BASICO.map(async u => {
      try { const r = await fetch(u, { cache: 'no-cache' }); if (guardavel(r)) await c.put(u, r); } catch (x) { /* sem rede */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // só as cópias antigas DESTE arquivo; as dos programas (lepramim-…) ficam
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n.startsWith('nebulosa-site-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* (0.9) guarda os extras e o manual de um programa (pedido pela casca ou pela ponte, quando o programa abre) */
const extrasFeitos = new Set();
async function guardarExtras(id) {
  if (!/^[a-z0-9-]+$/.test(id || '') || extrasFeitos.has(id)) return;
  extrasFeitos.add(id);
  const c = await caches.open(CACHE);
  const raiz = new URL('./', self.location).href;
  const lista = (EXTRAS[id] || []).map(u => 'apps/' + id + '/' + u).concat(['', '.en', '.es'].map(s => 'manuais/' + id + s + '.html'));
  for (const u of lista) {
    const url = new URL(u, raiz).href;
    try {
      if (await c.match(url)) continue;
      const r = await fetch(url, { cache: 'no-cache' });
      if (guardavel(r)) await c.put(url, r);
    } catch (x) { extrasFeitos.delete(id); /* sem rede: tenta de novo na próxima vez */ }
  }
}
self.addEventListener('message', e => {
  const d = e.data;
  if (d && d.nebulosa === 'guardar-extras') e.waitUntil(guardarExtras(String(d.app || '')));
});

/* (0.9) página nunca aberta, sem internet: a 404.html com a marca de "sem internet" */
async function paginaSemInternet() {
  const c = await caches.open(CACHE);
  const p = await c.match('404.html');
  if (!p) return null;
  const html = (await p.text()).replace('<head>', '<head>\n<meta name="nebulosa-sem-internet" content="1">');
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

/* (0.9) pedido que sempre confere com o site se o arquivo mudou (em vez de aceitar a cópia da memória do
   navegador). Páginas (navigate) não aceitam opções no pedido original, então vão como um pedido novo;
   com redirect 'manual' o redirecionamento (ex.: /manuais → /manuais/) continua com o navegador. */
function conferindo(req) {
  try {
    if (req.mode === 'navigate') return new Request(req.url, { cache: 'no-cache', credentials: 'same-origin', redirect: 'manual' });
    return new Request(req, { cache: 'no-cache' });
  } catch (x) { return req; }
}

function redePrimeiro(req) {
  const cacheP = caches.open(CACHE);
  // a cópia para guardar é feita antes de a resposta seguir para a página
  const rede = fetch(conferindo(req)).then(r => [r, guardavel(r) && !req.headers.get('range') ? r.clone() : null]);
  const fim = rede.then(async x => { if (x[1]) await (await cacheP).put(req, x[1]); }).catch(() => {});
  const guardado = () => cacheP.then(c => c.match(req).then(g => g || c.match(req, { ignoreSearch: true })));
  const resposta = (async () => {
    const espera = new Promise(res => setTimeout(() => res('tempo'), req.mode === 'navigate' ? ESPERA_PAGINA : ESPERA_ARQUIVO));
    try {
      const x = await Promise.race([rede, espera]);
      if (x !== 'tempo') return x[0];
      const g = await guardado();
      if (g) return g;                 // rede lenta: usa a cópia; a rede continua e atualiza a cópia
      return (await rede)[0];
    } catch (erro) {
      const g = await guardado();
      if (g) return g;
      if (req.mode === 'navigate') { const p = await paginaSemInternet(); if (p) return p; }
      throw erro;
    }
  })();
  return { resposta, fim };
}

async function fontes(req) {
  const c = await caches.open(FONTES);
  const g = await c.match(req);
  const rede = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()).catch(() => {}); return r; });
  if (g) { rede.catch(() => {}); return g; }
  return rede;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (u.pathname.endsWith('/sw.js')) return;
    const t = redePrimeiro(req);
    e.respondWith(t.resposta);
    e.waitUntil(t.fim);
  } else if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(fontes(req));
  }
});
