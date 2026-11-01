# -*- coding: utf-8 -*-
"""[Nebulosa] Fluxo 0.4.2 — aplica as batidas editáveis no Fluxo COMPILADO (apps/fluxo/index.html).

Uso (na raiz do projeto):  python3 ferramentas/fluxo-batidas/aplicar.py [apps/fluxo/index.html]

Só serve para o mesmo build do Fluxo em que foi feito (os nomes curtos do código compilado
mudam a cada build). Num build novo, o recurso precisa estar no código-fonte do Fluxo — veja o
LEIA-ME.md desta pasta. Se algum trecho não for encontrado, o script para sem mudar nada.
"""
import os, sys, json

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
ARQ = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'apps', 'fluxo', 'index.html')
t = open(ARQ, encoding='utf-8').read()
if 'nbBatSetUIOrig' in t:
    sys.exit('As batidas editáveis já estão neste arquivo.')
codigo = open(os.path.join(AQUI, 'nb-batidas.js'), encoding='utf-8').read()

def troca(a, b, n=1):
    global t
    c = t.count(a)
    assert c == n, (c, a[:80])
    t = t.replace(a, b)

UP = 'function up(t){f.commit("Marcar batida",e=>{let a=e.markers.find(r=>Math.abs(r.t-t)<.03);a?e.markers=e.markers.filter(r=>r!==a):(e.markers.push({id:Bt("mk"),t,kind:"beat",strength:1}),e.markers.sort((r,o)=>r.t-o.t))})}'
# 1) o módulo das batidas, logo depois de up() (marcar/desmarcar na agulha)
troca(UP, UP + '\n' + codigo + '\n')
# 2) linha do tempo: lê a seleção de batidas
troca('let t=kt("zoom"),e=kt("selected")', 'let t=kt("zoom"),nbS=kt("beatSel")||[],e=kt("selected")')
# 3) as batidas da régua viram NbBatida (clicar, arrastar, dois cliques, botão direito)
troca('l.markers.map(w=>(0,O.jsx)("div",{className:w.kind==="user"?"marker-pin user":"marker-pin",style:{left:w.t*t,opacity:.45+(w.strength??1)*.55}},w.id))',
      'l.markers.map(w=>(0,O.jsx)(NbBatida,{m:w,z:t,sel:nbS.includes(w.id)},w.id))')
# 4) a linha vertical da batida selecionada fica destacada
troca('l.markers.length<600&&l.markers.map(w=>(0,O.jsx)("div",{className:"marker",style:{left:w.t*t}},w.id))',
      'l.markers.length<600&&l.markers.map(w=>(0,O.jsx)("div",{className:nbS.includes(w.id)?"marker nb-sel":"marker",style:{left:w.t*t}},w.id))')
# 5) dois cliques e botão direito na régua
troca('{className:"tl-scroll",ref:c,onPointerDown:N,',
      '{className:"tl-scroll",ref:c,onPointerDown:N,onDoubleClick:nbE=>nbBatDuplo(nbE,c.current),onContextMenu:nbE=>nbBatMenuRegua(nbE,c.current),')
# 6) teclado: Delete e setas agem nas batidas selecionadas
troca('else if(u==="Delete"||u==="Backspace")h.length?',
      'else if((u==="Delete"||u==="Backspace")&&nbBatSel().length)s.preventDefault(),nbBatApagar();else if(u==="Delete"||u==="Backspace")h.length?')
troca('else if(u==="ArrowLeft")s.preventDefault(),',
      'else if((u==="ArrowLeft"||u==="ArrowRight")&&nbBatSel().length)s.preventDefault(),nbBatMover(nbBatSel(),(u==="ArrowLeft"?-1:1)*(s.shiftKey?10:1)/g);else if(u==="ArrowLeft")s.preventDefault(),')
# 7) painel Projeto: seção "Batidas" (tempo, força, apagar…)
troca('children:[(0,q.jsxs)(wt,{title:"Formato do v\\xEDdeo",id:"proj-format",',
      'children:[(0,q.jsx)(NbBatidasPainel,{}),(0,q.jsxs)(wt,{title:"Formato do v\\xEDdeo",id:"proj-format",')
# 8) atalhos de teclado
troca('["M","Marcar batida na agulha"],',
      '["M","Marcar batida na agulha"],["Clique numa batida (r\\xE9gua)","Seleciona (Shift ou Ctrl: v\\xE1rias)"],["Arrastar uma batida","Move as batidas selecionadas"],["Dois cliques na r\\xE9gua","P\\xF5e ou tira uma batida"],["Delete (batidas selecionadas)","Apaga as batidas"],["\\u2190 / \\u2192 (batidas selecionadas)","Move um quadro (Shift = 10)"],["Bot\\xE3o direito na r\\xE9gua","For\\xE7a, apagar e mais op\\xE7\\xF5es"],')
# 9) janela Batidas: avisa que dá para ajustar depois
troca('x&&(0,Mt.jsx)(nM,{res:x}),',
      'x&&(0,Mt.jsx)(nM,{res:x}),x&&(0,Mt.jsx)("p",{className:"hint",style:{margin:0},children:"Depois de marcar, cada batida pode ser ajustada na r\\xE9gua da linha do tempo: arraste para mover, dois cliques p\\xF5em ou tiram uma batida e o bot\\xE3o direito mostra mais op\\xE7\\xF5es."}),')

# 10) visual
CSS = ('/* [Nebulosa] Fluxo 0.4.2: batidas editáveis */'
       '.marker-pin.nb-pin{pointer-events:auto;cursor:grab;touch-action:none;transition:transform .08s}'
       '.marker-pin.nb-pin:before{content:"";position:absolute;left:-5px;right:-5px;top:-10px;bottom:-8px}'
       '.marker-pin.nb-pin:hover{transform:scale(1.4)}'
       '.marker-pin.nb-pin:active{cursor:grabbing}'
       '.marker-pin.nb-pin.is-sel{transform:scale(1.35);box-shadow:0 0 0 1.5px var(--panel),0 0 0 3px var(--text);z-index:6}'
       '.marker.nb-sel{border-left:1px solid var(--beat);z-index:2}'
       '.nb-pin-t{position:absolute;left:12px;top:-6px;padding:1px 5px;border-radius:4px;background:var(--beat);color:#14121c;'
       'font-size:10px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none}')
i = t.index('.marker-pin.user{background:#7fd3ff;border-radius:1px}')
fim = t.index('</style>', i)
t = t[:fim] + CSS + t[fim:]

# 11) traduções (dicionário do Fluxo)
DIC = {
    'Batida em {1} · força {2}% — arraste para mover; dois cliques apaga; botão direito: mais opções':
        ['Beat at {1} · strength {2}% — drag to move; double-click deletes; right-click: more options',
         'Golpe en {1} · fuerza {2}% — arrastra para mover; doble clic lo borra; clic derecho: más opciones'],
    'Adicionar batida': ['Add beat', 'Añadir golpe'],
    'Apagar batida': ['Delete beat', 'Borrar golpe'],
    'Apagar batidas': ['Delete beats', 'Borrar golpes'],
    'Apagar {1} batidas': ['Delete {1} beats', 'Borrar {1} golpes'],
    'Mover batida': ['Move beat', 'Mover golpe'],
    'Mover batidas': ['Move beats', 'Mover golpes'],
    'Força da batida': ['Beat strength', 'Fuerza del golpe'],
    'Tempo da batida': ['Beat time', 'Tiempo del golpe'],
    'Batida apagada (Ctrl+Z desfaz)': ['Beat deleted (Ctrl+Z undoes)', 'Golpe borrado (Ctrl+Z deshace)'],
    '{1} batidas apagadas (Ctrl+Z desfaz)': ['{1} beats deleted (Ctrl+Z undoes)', '{1} golpes borrados (Ctrl+Z deshace)'],
    'Levar a agulha até a batida': ['Move the playhead to the beat', 'Llevar el cabezal hasta el golpe'],
    'Força: forte (100%)': ['Strength: strong (100%)', 'Fuerza: fuerte (100%)'],
    'Força: média (70%)': ['Strength: medium (70%)', 'Fuerza: media (70%)'],
    'Força: fraca (40%)': ['Strength: weak (40%)', 'Fuerza: débil (40%)'],
    'Selecionar todas as batidas': ['Select all beats', 'Seleccionar todos los golpes'],
    'Adicionar batida aqui': ['Add beat here', 'Añadir golpe aquí'],
    'Adicionar batida na agulha': ['Add beat at playhead', 'Añadir golpe en el cabezal'],
    'Clique numa batida na régua da linha do tempo para escolher (Shift ou Ctrl: várias). Arraste para mover; dois cliques na régua põem ou tiram uma batida; Delete apaga.':
        ['Click a beat on the timeline ruler to pick it (Shift or Ctrl: several). Drag to move; double-click the ruler to add or remove a beat; Delete removes it.',
         'Haz clic en un golpe en la regla de la línea de tiempo para elegirlo (Shift o Ctrl: varios). Arrastra para moverlo; doble clic en la regla pone o quita un golpe; Supr lo borra.'],
    'Selecionar todas': ['Select all', 'Seleccionar todos'],
    '1 batida selecionada': ['1 beat selected', '1 golpe seleccionado'],
    '{1} batidas selecionadas': ['{1} beats selected', '{1} golpes seleccionados'],
    'Arraste a batida na régua ou mude os valores acima. As setas ← → movem um quadro (Shift = 10); Delete apaga.':
        ['Drag the beat on the ruler or change the values above. The ← → arrows move it one frame (Shift = 10); Delete removes it.',
         'Arrastra el golpe en la regla o cambia los valores de arriba. Las flechas ← → lo mueven un fotograma (Shift = 10); Supr lo borra.'],
    'Ir até a batida': ['Go to the beat', 'Ir al golpe'],
    'Desmarcar': ['Deselect', 'Deseleccionar'],
    'Clique numa batida (régua)': ['Click a beat (ruler)', 'Clic en un golpe (regla)'],
    'Seleciona (Shift ou Ctrl: várias)': ['Selects it (Shift or Ctrl: several)', 'Lo selecciona (Shift o Ctrl: varios)'],
    'Arrastar uma batida': ['Drag a beat', 'Arrastrar un golpe'],
    'Move as batidas selecionadas': ['Moves the selected beats', 'Mueve los golpes seleccionados'],
    'Dois cliques na régua': ['Double-click the ruler', 'Doble clic en la regla'],
    'Põe ou tira uma batida': ['Adds or removes a beat', 'Pone o quita un golpe'],
    'Delete (batidas selecionadas)': ['Delete (selected beats)', 'Supr (golpes seleccionados)'],
    'Apaga as batidas': ['Deletes the beats', 'Borra los golpes'],
    '← / → (batidas selecionadas)': ['← / → (selected beats)', '← / → (golpes seleccionados)'],
    'Move um quadro (Shift = 10)': ['Moves one frame (Shift = 10)', 'Mueve un fotograma (Shift = 10)'],
    'Botão direito na régua': ['Right-click the ruler', 'Clic derecho en la regla'],
    'Força, apagar e mais opções': ['Strength, delete and more options', 'Fuerza, borrar y más opciones'],
    'Depois de marcar, cada batida pode ser ajustada na régua da linha do tempo: arraste para mover, dois cliques põem ou tiram uma batida e o botão direito mostra mais opções.':
        ['After marking, each beat can be adjusted on the timeline ruler: drag to move, double-click to add or remove a beat, and right-click for more options.',
         'Después de marcar, cada golpe se puede ajustar en la regla de la línea de tiempo: arrastra para moverlo, doble clic pone o quita un golpe y el clic derecho muestra más opciones.'],
}
fimdic = "  }, { ignorar: '.clip-label, .rf-title, canvas' });"
assert t.count(fimdic) == 1
linhas = ''.join('    %s: %s,\n' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False)) for k, v in DIC.items())
j = t.index(fimdic)
# a entrada anterior termina sem vírgula: acrescenta a vírgula e as novas
antes = t[:j].rstrip()
assert antes.endswith(']'), antes[-40:]
t = antes + ',\n    /* [Nebulosa] Fluxo 0.4.2: batidas editáveis */\n' + linhas.rstrip(',\n') + '\n' + t[j:]
open(ARQ, 'w', encoding='utf-8').write(t)
print('ok', len(t))
