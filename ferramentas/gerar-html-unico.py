#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[Nebulosa] Gera os "HTML únicos" do Nebulosa Workspace (0.6).

Cada programa vira um único arquivo .html, que abre com dois cliques, sem
servidor e sem internet, com os três idiomas (português do Brasil, inglês e
espanhol). Uso (na raiz do projeto):

    python3 ferramentas/gerar-html-unico.py              # os 9 programas
    python3 ferramentas/gerar-html-unico.py flyde typee  # só alguns
    python3 ferramentas/gerar-html-unico.py --saida /pasta/de/saida

Os arquivos saem em  html-unico/<Nome>.html  (fora do site; a pasta não vai
para o repositório). Só usa a biblioteca padrão do Python 3.

Como monta:
  - <link rel="stylesheet"> locais viram <style> (imagens do CSS em data URI);
  - <script src> locais viram scripts embutidos — a ponte também, mantendo os
    atributos data-*, e o nebulosa-idiomas.js de cada programa (os idiomas);
  - imagens usadas no HTML e no código viram data URI;
  - arquivos que o programa carrega só quando precisa (PDF.js, PptxGenJS,
    páginas de ajuda do Imaginarium) vão em base64 e viram endereços blob:
    na hora do uso (window.__nbArq('caminho'));
  - manual, termos de uso, privacidade e créditos, em pt-BR, en e es, vão em
    window.__nbPaginas (chaves 'manual', 'manual.en', 'termos.es'…), e a ponte
    abre a versão do idioma escolhido na janela de Ajuda, sem internet;
  - o contador de acessos fica desligado (a ponte não tem endereço de arquivo).
"""
import base64, json, mimetypes, os, re, sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SITE = 'https://nebulosaworkspace.com.br/'
IDIOMAS = ['', '.en', '.es']
APPS = {  # id: nome do arquivo
    'typee': 'Typee', 'flyde': 'Flyde', 'stardust': 'Stardust', 'emcanto': 'EmCanto',
    'lepramim': 'LePraMim', 'paznobolso': 'PazNoBolso', 'pratododia': 'pratododia',
    'imaginarium': 'Imaginarium', 'fluxo': 'Fluxo',
}
IMG_EXT = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp')
# arquivos carregados sob demanda (viram blob: quando o programa pede)
SOB_DEMANDA = {
    'typee': ['libs/pdfjs/pdf.js', 'libs/pdfjs/pdf.worker.js'],
    'flyde': ['libs/pptxgen.bundle.js'],
    'lepramim': ['libs/pdfjs/pdf.js', 'libs/pdfjs/pdf.worker.js'],
    'imaginarium': ['help/manual.html', 'help/credits.html'],
}
# ajustes no código de cada programa (texto exato -> substituto)
TROCAS = {
    'imaginarium': [("src: 'help/credits.html'", "src: window.__nbArq('help/credits.html')"),
                    ("src: 'help/manual.html'", "src: window.__nbArq('help/manual.html')")],
}
# script extra logo depois de um script embutido (caminho -> código)
DEPOIS = {
    'typee': {},
    'lepramim': {'js/config.js': "LPM.config.LIBS.pdf=window.__nbArq('libs/pdfjs/pdf.js');"
                                 "LPM.config.LIBS.pdfWorker=window.__nbArq('libs/pdfjs/pdf.worker.js');"},
}
# variáveis globais que o programa já procura (lidas só quando usadas)
GLOBAIS = {
    'typee': {'__typeePdfLib': 'libs/pdfjs/pdf.js', '__typeePdfWorker': 'libs/pdfjs/pdf.worker.js'},
    'flyde': {'__flydePptx': 'libs/pptxgen.bundle.js'},
}


def ler(p, modo='r'):
    with open(p, modo, **({} if 'b' in modo else {'encoding': 'utf-8'})) as f:
        return f.read()


def mime(p):
    e = os.path.splitext(p)[1].lower()
    return {'.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.js': 'text/javascript',
            '.html': 'text/html;charset=utf-8', '.css': 'text/css', '.woff': 'font/woff', '.woff2': 'font/woff2',
            '.ttf': 'font/ttf', '.otf': 'font/otf'}.get(e) or mimetypes.guess_type(p)[0] or 'application/octet-stream'


def data_uri(p):
    return 'data:%s;base64,%s' % (mime(p), base64.b64encode(ler(p, 'rb')).decode())


def local(u):
    return u and not re.match(r'^(?:[a-z]+:|//|#|\$\{)', u, re.I)


def resolver(base_dir, u):
    return os.path.normpath(os.path.join(base_dir, u.split('#')[0].split('?')[0]))


def css_embutido(css, base_dir):
    def troca(m):
        u = m.group(2).strip()
        if not local(u):
            return m.group(0)
        p = resolver(base_dir, u)
        return 'url(%s)' % data_uri(p) if os.path.isfile(p) else m.group(0)
    return re.sub(r'url\(\s*([\'"]?)([^\'")]+)\1\s*\)', troca, css)


def script_seguro(js):
    return js.replace('</script', '<\\/script').replace('</SCRIPT', '<\\/SCRIPT').replace('<!--', '<\\!--')


def imagens_no_texto(txt, app_dir):
    """Troca 'caminho/da/imagem.png' (entre aspas ou parênteses) por data URI."""
    for raiz, _, arqs in os.walk(app_dir):
        for a in arqs:
            if not a.lower().endswith(IMG_EXT):
                continue
            p = os.path.join(raiz, a)
            rel = os.path.relpath(p, app_dir).replace(os.sep, '/')
            for pre in ('', './'):
                for q1, q2 in (('"', '"'), ("'", "'"), ('(', ')'), ('`', '`')):
                    alvo = q1 + pre + rel + q2
                    if alvo in txt:
                        txt = txt.replace(alvo, q1 + data_uri(p) + q2)
    return txt


def pagina_embutida(caminho, tag=''):
    """Uma página do site (manual ou legal) pronta para abrir dentro do programa."""
    d = os.path.dirname(caminho)
    h = ler(caminho)
    # estilos
    def link_css(m):
        u = re.search(r'href="([^"]+)"', m.group(0)).group(1)
        if not local(u):
            return m.group(0)
        p = resolver(d, u)
        return '<style>%s</style>' % css_embutido(ler(p), os.path.dirname(p))
    h = re.sub(r'<link[^>]*rel="stylesheet"[^>]*>', link_css, h)
    h = re.sub(r'<link[^>]*rel="(?:icon|canonical|alternate)"[^>]*>\n?', '', h)
    # imagens
    def img(m):
        u = m.group(2)
        if not local(u):
            return m.group(0)
        p = resolver(d, u)
        return m.group(1) + data_uri(p) + '"' if os.path.isfile(p) else m.group(0)
    h = re.sub(r'(<img[^>]*?\ssrc=")([^"]+)"', img, h)
    # sempre no modo "embutido" (sem a barra de cima; links para fora abrem em outra janela)
    h = h.replace('/[?&]embed=1/.test(location.search)', 'true')
    # links relativos que sobraram apontam para o site
    rel_site = os.path.relpath(d, RAIZ).replace(os.sep, '/') + '/'
    def href(m):
        u = m.group(2)
        if not local(u):
            return m.group(0)
        return m.group(1) + SITE + os.path.normpath(rel_site + u).replace(os.sep, '/').lstrip('./') + '"'
    h = re.sub(r'(<a[^>]*?\shref=")([^"]+)"', href, h)
    return base64.b64encode(h.encode('utf-8')).decode()


def bloco_inicial(app, app_dir):
    """Script que vem antes de tudo: arquivos sob demanda e páginas de ajuda."""
    arq = {}
    for rel in SOB_DEMANDA.get(app, []):
        p = os.path.join(app_dir, rel)
        if rel.endswith('.html'):
            arq[rel] = [pagina_programa(p, app_dir), mime(p)]
        else:
            arq[rel] = [base64.b64encode(ler(p, 'rb')).decode(), mime(p)]
    pags = {}
    for chave, pt in (('manual', 'manuais/%s.html' % app), ('termos', 'legal/termos.html'),
                      ('privacidade', 'legal/privacidade.html'), ('creditos', 'legal/creditos.html')):
        for suf in IDIOMAS:
            p = os.path.join(RAIZ, pt.replace('.html', suf + '.html'))
            if os.path.isfile(p):
                pags[chave + suf] = pagina_embutida(p)
    js = ['(function(){"use strict";',
          'var A=%s,P=%s,U={};' % (json.dumps(arq), json.dumps(pags)),
          'function blob(b,t){var x=atob(b),u=new Uint8Array(x.length);for(var i=0;i<x.length;i++)u[i]=x.charCodeAt(i);'
          'return URL.createObjectURL(new Blob([u],{type:t}))}',
          # arquivos sob demanda: o blob: só é criado na primeira vez
          'window.__nbArq=function(c){if(!U[c]&&A[c])U[c]=blob(A[c][0],A[c][1]);return U[c]||c};',
          # páginas de ajuda (a ponte lê window.__nbPaginas[tipo + ".en"…])
          'var N={};Object.keys(P).forEach(function(k){var v;Object.defineProperty(N,k,{enumerable:true,get:function(){'
          'if(!v)v=blob(P[k],"text/html;charset=utf-8")+(k.indexOf("creditos")===0?"#%s":"");return v}})});' % app,
          'window.__nbPaginas=N;']
    for g, rel in GLOBAIS.get(app, {}).items():
        js.append('Object.defineProperty(window,%s,{configurable:true,get:function(){return window.__nbArq(%s)}});'
                  % (json.dumps(g), json.dumps(rel)))
    js.append('})();')
    return '<script>/* [Nebulosa] HTML único 0.6: arquivos embutidos */\n' + ''.join(js) + '</script>\n'


def pagina_programa(p, app_dir):
    """Páginas de ajuda internas de um programa (ex.: Imaginarium/help), com imagens embutidas."""
    d = os.path.dirname(p)
    h = ler(p)
    def img(m):
        u = m.group(2)
        if not local(u):
            return m.group(0)
        q = resolver(d, u)
        return m.group(1) + data_uri(q) + '"' if os.path.isfile(q) else m.group(0)
    h = re.sub(r'(<(?:img|link)[^>]*?\s(?:src|href)=")([^"]+)"', img, h)
    return base64.b64encode(h.encode('utf-8')).decode()


def gerar(app, saida):
    app_dir = os.path.join(RAIZ, 'apps', app)
    h = ler(os.path.join(app_dir, 'index.html'))
    depois = DEPOIS.get(app, {})

    def troca_js(js, rel):
        for a, b in TROCAS.get(app, []):
            js = js.replace(a, b)
        return js

    # 1) estilos locais
    def link(m):
        tag = m.group(0)
        u = re.search(r'href="([^"]+)"', tag)
        u = u and u.group(1)
        if not local(u):
            return tag
        p = resolver(app_dir, u)
        if 'stylesheet' in tag:
            return '<style>%s</style>' % css_embutido(ler(p), os.path.dirname(p))
        if re.search(r'rel="(?:manifest|preload|prefetch|modulepreload)"', tag) or not u.lower().endswith(IMG_EXT):
            return ''
        return tag  # ícones: viram data URI mais abaixo
    h = re.sub(r'<link\b[^>]*>', link, h)

    # 2) scripts locais
    def script(m):
        attrs, u = m.group(1) + m.group(3), m.group(2)
        if not local(u):
            return m.group(0)
        p = resolver(app_dir, u)
        rel = os.path.relpath(p, app_dir).replace(os.sep, '/')
        js = troca_js(ler(p), rel)
        attrs = re.sub(r'\s(?:defer|async)(?=[\s>]|$)', '', attrs)
        extra = ('<script>%s</script>' % depois[rel]) if rel in depois else ''
        return '<script%s>%s</script>%s' % (attrs, script_seguro(js), extra)
    h = re.sub(r'<script\b([^>]*?)\ssrc="([^"]+)"([^>]*)>\s*</script>', script, h)
    for a, b in TROCAS.get(app, []):
        h = h.replace(a, b)

    # 3) imagens (no HTML e no código)
    h = imagens_no_texto(h, app_dir)

    # 4) LêPraMim: a política de segurança precisa aceitar os scripts embutidos
    csp = re.search(r"script-src ([^;\"]*)", h)
    if csp and "'unsafe-inline'" not in csp.group(1):
        h = h.replace(csp.group(0), csp.group(0) + " 'unsafe-inline'", 1)

    # 5) arquivos sob demanda + páginas de ajuda, antes de todos os scripts
    i = h.find('<script')
    h = h[:i] + bloco_inicial(app, app_dir) + h[i:]

    os.makedirs(saida, exist_ok=True)
    destino = os.path.join(saida, APPS[app] + '.html')
    with open(destino, 'w', encoding='utf-8') as f:
        f.write(h)
    # conferência: nada de arquivo local que tenha ficado de fora
    so_html = re.sub(r'(<script\b[^>]*>)[\s\S]*?</script>', r'\1</script>', h)
    sobra = [u for u in re.findall(r'<(?:script|link|img)\b[^>]*?\s(?:src|href)="([^"]+)"', so_html) if local(u)]
    print('%-12s %6.1f MB  %s%s' % (app, os.path.getsize(destino) / 1e6, destino,
                                    ('  (atenção: ' + ', '.join(sorted(set(sobra))) + ')') if sobra else ''))


def main():
    args = sys.argv[1:]
    saida = os.path.join(RAIZ, 'html-unico')
    if '--saida' in args:
        k = args.index('--saida'); saida = os.path.abspath(args[k + 1]); del args[k:k + 2]
    for app in (args or list(APPS)):
        if app not in APPS:
            sys.exit('Programa desconhecido: %s (use: %s)' % (app, ', '.join(APPS)))
        gerar(app, saida)


if __name__ == '__main__':
    main()
