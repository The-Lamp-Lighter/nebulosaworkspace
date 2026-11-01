#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[Nebulosa] Muda a versão do Nebulosa Workspace em TODOS os lugares de uma vez (0.8).

Uso (na raiz do projeto):

    python3 ferramentas/versao.py            # mostra a versão atual e confere se está igual em tudo
    python3 ferramentas/versao.py 0.9        # muda para 0.9

O que muda:
  - js/apps.js ............ window.NEBULOSA_VERSAO (a versão "oficial")
  - shared/nebulosa-bridge.js  VERSAO (os programas leem daqui)
  - sw.js ................. VERSAO (nome da cópia para uso sem internet)
  - valores de reserva .... "|| '0.x'" na casca e nos programas
  - manuais/, legal/ e 404.html: "Versão 0.x", "Version 0.x", "Versión 0.x"
  - ferramentas/gerar-html-unico.py: rótulo dos HTML únicos
  - sitemap.xml ........... <lastmod> com a data de hoje
  - index.html ............ "?v=0.x" no endereço dos arquivos da casca (0.9), para o navegador
                            não misturar arquivos novos com cópias antigas depois da atualização

Sem número, além de conferir a versão, procura marcas de conflito do git ("<<<<<<<",
">>>>>>>") esquecidas nos arquivos: elas quebram o site (foi o que deixou a página inicial
vazia na publicação de 31/10/2026). Rode antes de enviar para o GitHub.

Não mexe nas marcas "(0.6)", "(0.7)"… dos comentários do código: elas registram em
que versão cada parte foi criada. Também não mexe na versão própria de cada programa
(EmCanto 1.2.0, LêPraMim 1.1.0…). Só usa a biblioteca padrão do Python 3.
"""
import datetime, glob, os, re, sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
VER = r'\d+\.\d+(?:\.\d+)?'


def ler(p):
    with open(os.path.join(RAIZ, p), encoding='utf-8') as f:
        return f.read()


def gravar(p, t):
    with open(os.path.join(RAIZ, p), 'w', encoding='utf-8') as f:
        f.write(t)


def atual():
    m = re.search(r"window\.NEBULOSA_VERSAO = '(" + VER + ")'", ler('js/apps.js'))
    if not m:
        sys.exit('Não encontrei window.NEBULOSA_VERSAO em js/apps.js')
    return m.group(1)


def arquivos_de_codigo():
    """HTML e JS do projeto, sem bibliotecas de terceiros."""
    for raiz, dirs, arqs in os.walk(RAIZ):
        dirs[:] = [d for d in dirs if d not in ('.git', 'libs', 'html-unico', 'node_modules')]
        for a in arqs:
            if a.endswith(('.js', '.html')) and not a.endswith('.min.js'):
                yield os.path.relpath(os.path.join(raiz, a), RAIZ)


def regras(velha, nova):
    """(arquivo ou padrão glob, expressão, substituto) — a expressão só casa com a versão velha."""
    v = re.escape(velha)
    paginas = sorted(glob.glob(os.path.join(RAIZ, 'manuais', '*.html')) + glob.glob(os.path.join(RAIZ, 'legal', '*.html'))
                     + [os.path.join(RAIZ, '404.html')])
    r = [
        ('js/apps.js', r"(window\.NEBULOSA_VERSAO = ')" + v + "'", r"\g<1>" + nova + "'"),
        ('shared/nebulosa-bridge.js', r"(var VERSAO = ')" + v + "'", r"\g<1>" + nova + "'"),
        ('sw.js', r"(const VERSAO = ')" + v + "'", r"\g<1>" + nova + "'"),
        ('ferramentas/gerar-html-unico.py', r"(HTML único )" + v + r"(: arquivos embutidos)", r"\g<1>" + nova + r"\g<2>"),
        # (0.9) "?v=" dos arquivos da casca (qualquer versão antiga)
        ('index.html', r"(\.(?:js|css)\?v=)" + VER + r'(?=")', r"\g<1>" + nova),
    ]
    for p in paginas:
        if os.path.isfile(p):
            r.append((os.path.relpath(p, RAIZ), r"(Vers(?:ão|ion|ión) )" + v + r"(?![\d.])", r"\g<1>" + nova))
    # valores de reserva: "versao) || '0.x'" e "NEBULOSA_VERSAO || '0.x'" (qualquer versão antiga)
    for p in arquivos_de_codigo():
        r.append((p, r"((?:versao\)|NEBULOSA_VERSAO) \|\| ')" + VER + "'", r"\g<1>" + nova + "'"))
    return r


def aplicar(velha, nova, mudar):
    contagem = {}
    for p, rx, sub in regras(velha, nova):
        if not os.path.isfile(os.path.join(RAIZ, p)):
            continue
        t = ler(p)
        t2, n = re.subn(rx, sub, t)
        if n and t2 != t:
            contagem[p] = contagem.get(p, 0) + n
            if mudar:
                gravar(p, t2)
    return contagem


def sitemap(hoje):
    p = 'sitemap.xml'
    if os.path.isfile(os.path.join(RAIZ, p)):
        t = ler(p)
        gravar(p, re.sub(r'<lastmod>[^<]+</lastmod>', '<lastmod>%s</lastmod>' % hoje, t))


def conflitos():
    """(0.9) Arquivos com marcas de conflito do git esquecidas (quebram o site)."""
    achados = []
    for raiz, dirs, arqs in os.walk(RAIZ):
        dirs[:] = [d for d in dirs if d not in ('.git', 'html-unico', 'node_modules')]
        for a in arqs:
            if not a.endswith(('.js', '.html', '.css', '.py', '.xml', '.json', '.md', '.txt')):
                continue
            p = os.path.join(raiz, a)
            try:
                with open(p, encoding='utf-8', errors='replace') as f:
                    for n, linha in enumerate(f, 1):
                        if linha.startswith(('<<<<<<< ', '>>>>>>> ')) or linha.rstrip('\r\n') in ('<<<<<<<', '>>>>>>>'):
                            achados.append('%s, linha %d: marca de conflito do git ("%s")' % (os.path.relpath(p, RAIZ), n, linha.strip()[:40]))
                            break
            except OSError:
                pass
    return achados


def conferir(v):
    """Lista lugares que mostram uma versão diferente da oficial."""
    problemas = conflitos()
    if not re.search(r"var VERSAO = '" + re.escape(v) + "'", ler('shared/nebulosa-bridge.js')):
        problemas.append('shared/nebulosa-bridge.js: VERSAO diferente de ' + v)
    if os.path.isfile(os.path.join(RAIZ, 'sw.js')) and not re.search(r"const VERSAO = '" + re.escape(v) + "'", ler('sw.js')):
        problemas.append('sw.js: VERSAO diferente de ' + v)
    for m in re.finditer(r'\.(?:js|css)\?v=(' + VER + ')"', ler('index.html')):
        if m.group(1) != v:
            problemas.append('index.html: arquivo com ?v=%s' % m.group(1))
            break
    for p in sorted(glob.glob(os.path.join(RAIZ, 'manuais', '*.html')) + glob.glob(os.path.join(RAIZ, 'legal', '*.html'))):
        for m in re.finditer(r'(?:Nebulosa Workspace|navegador|browser|navegador)\. Vers(?:ão|ion|ión) (' + VER + ')', ler(os.path.relpath(p, RAIZ))):
            if m.group(1) != v:
                problemas.append('%s: rodapé com a versão %s' % (os.path.relpath(p, RAIZ), m.group(1)))
    return problemas


def main():
    velha = atual()
    if len(sys.argv) < 2:
        print('Versão atual do Nebulosa Workspace: ' + velha)
        p = conferir(velha)
        if not p:
            print('Tudo certo: pode enviar para o GitHub.')
            return
        print('Corrija antes de enviar para o GitHub:\n  ' + '\n  '.join(p))
        sys.exit(1)
    nova = sys.argv[1].strip()
    if not re.fullmatch(VER, nova):
        sys.exit('Versão inválida: %s (use algo como 0.9 ou 1.0)' % nova)
    if nova == velha:
        sys.exit('O Workspace já está na versão ' + nova)
    contagem = aplicar(velha, nova, True)
    hoje = datetime.date.today().isoformat()
    sitemap(hoje)
    for p in sorted(contagem):
        print('%3d  %s' % (contagem[p], p))
    print('Versão %s -> %s em %d arquivos (e sitemap.xml com a data %s).' % (velha, nova, len(contagem), hoje))
    p = conferir(nova)
    if p:
        print('Atenção:\n  ' + '\n  '.join(p))


if __name__ == '__main__':
    main()
