/* ==========================================================================
   Nebulosa Workspace — sw.js  (0.8)
   Cópia local do site para ele continuar funcionando quando a internet cai.

   Como funciona
   -------------
   - Com internet, tudo vem do site, como sempre (rede primeiro): cada arquivo
     que chega é guardado numa cópia ("nebulosa-site-<versão>") no navegador.
   - Sem internet, o que já foi aberto antes vem dessa cópia. A página inicial
     e os arquivos da casca são guardados logo na primeira visita.
   - As fontes do Google também são guardadas, para as letras não mudarem.
   - O contador de acessos e os componentes que os programas baixam por conta
     própria (vozes do LêPraMim etc.) não passam por aqui.

   Isto NÃO torna o site instalável: não há manifest nem botão de instalar.
   Ao mudar a versão (ferramentas/versao.py), a cópia antiga é apagada sozinha.
   ========================================================================== */
const VERSAO = '0.8';
const CACHE = 'nebulosa-site-' + VERSAO;
const FONTES = 'nebulosa-fontes';
const BASICO = [
  './', 'index.html', '404.html', 'css/workspace.css',
  'js/theme.js', 'js/idiomas.js', 'js/icons.js', 'js/apps.js', 'js/doacao.js', 'js/tarefas.js', 'js/dicas.js', 'js/novidades.js',
  'js/qrcode.js', 'js/notificacoes.js', 'js/acessos.js', 'js/recentes.js', 'js/backup.js', 'js/workspace.js',
  'shared/nebulosa-bridge.js',
  'assets/img/logo-112.png', 'assets/img/logo-320.png', 'assets/img/favicon-64.png',
  'assets/img/nebulosa-workspace-logo-720.png', 'assets/img/nebulosa-workspace-logo-escuro-720.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // um por um: se algum faltar, os outros continuam guardados
    await Promise.all(BASICO.map(async u => {
      try { const r = await fetch(u, { cache: 'no-cache' }); if (r.ok) await c.put(u, r); } catch (x) { /* sem rede */ }
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

const guardavel = r => r && r.ok && r.status === 200 && r.type !== 'opaqueredirect';

async function redePrimeiro(req) {
  const c = await caches.open(CACHE);
  try {
    const r = await fetch(req);
    if (guardavel(r) && !req.headers.get('range')) c.put(req, r.clone()).catch(() => {});
    return r;
  } catch (erro) {
    const g = await c.match(req) || await c.match(req, { ignoreSearch: true });
    if (g) return g;
    if (req.mode === 'navigate') {
      // página nunca aberta antes: a 404 sabe mostrar o aviso de "sem internet"
      const p = await c.match('404.html');
      if (p) return p;
    }
    throw erro;
  }
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
    e.respondWith(redePrimeiro(req));
  } else if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(fontes(req));
  }
});
