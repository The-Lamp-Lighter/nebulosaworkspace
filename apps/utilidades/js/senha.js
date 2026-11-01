/* ==========================================================================
   Utilidades — Gerador de senha (js/senha.js)
   Sorteio com crypto.getRandomValues (o gerador seguro do navegador).
   Nada é guardado: o histórico some quando a página fecha.
   ========================================================================== */
(function () {
  'use strict';
  const { $, $$, esc, T, ICO, num } = UT;
  const PAL = {
    'pt-BR': 'agenda alicate ameixa ancora andorinha apostila arara arco armadura asa atum aviao azulejo baleeiro bandeira barraca bateria bauleto beija bengala berimbau besouro bexiga biblioteca bolinha boneca bussola cabide cachoeira caixote camarao cambio canario canudo capacete caramelo carvao cascata catavento cavaco cegonha chapeu charrete chuveiro cipo cobra colmeia concha corneta cupim duende enxada esmeralda espelho farinha ferrugem fivela flamingo fogao fubá gaiola galinha gangorra garrafa gelo gengibre gorila graveto guarana harpa hortela iogurte jabuti jacare jangada janta jarra javali joaninha lagarto lanche lareira legume lontra lousa luva maca malabar maracuja marreco medalha melado mexerica miolo moinho mosaico namorado ostra paçoca palito papagaio parafuso passaro pavao pedra pepino peteca picole pijama pincel pipa pomar pudim quiabo rapadura rede remo rolha sabia sanfona sardinha sereia sorriso tamanco tapioca tatu teia tomilho trem trigo tulipa urso varal vassoura veleiro vitrola abacate abelha abrigo acampar agulha alface alegria algodao almoco amora anel antena apito aquarela areia armario arroz asfalto atleta avental azeite balde bambu banana banco barco batata baleia bicicleta bigode biscoito bolacha bolo bombom borboleta bota bule cabana cacau cachorro cadeira caderno cafe caju calendario camelo caminho canela caneta canoa capivara caracol carimbo carroça cartola casaco castelo cavalo cebola cenoura cereja chave chinelo chocolate chuva cidade cinema circo coelho cometa coruja cristal cuia dado degrau delta desenho diamante domingo dragao elefante escada escova esquilo estrela faca farol feijao feira festa figo flauta floresta foguete folha formiga fruta fumaca gaivota galho garfo gato geleia girafa girassol goiaba gravata grilo guarda horta hotel igreja ilha janela jardim joia jornal lagoa lampada lanterna lapis laranja leao leite limao livro lobo lua macaco madeira manga mapa martelo mel melancia mesa milho mochila moeda montanha morango mosquito motor museu navio neblina ninho noite nuvem oceano ovelha ovo padaria palha panela papel parque pastel pato peixe pente pera pipoca piano pimenta pinguim pirata planeta polvo ponte porta praia prato quadro queijo rabanete radio raposa regua relogio rio robo roda sabao sacola salada sapato sapo semente serra sino sofa sorvete tambor tapete tartaruga teatro telhado tesoura tigre tijolo tomate tucano uva vaca vela vento violao vulcao xadrez zebra',
    en: 'almond antler apron arcade avocado badger ballad banjo basil beaver biscuit blender bonnet bramble broccoli bubble buckle cabbage canvas caramel cargo cashew cedar chalk cheddar chestnut cinnamon clarinet cocoa compass cookie coral cradle crystal cupcake daisy denim dolphin donkey dragonfly drum dune emerald engine falafel ferret fig flamingo flannel fudge gadget galaxy garnet ginger goose grape hamster harp hazel hedgehog hiking igloo iguana jasmine jungle kayak kiwi koala lilac llama locket lotus mammoth marshmallow meteor mint moose nectar nutmeg octopus onion orchid owl panther papaya peach peanut pelican penguin pepperoni pinecone plum popcorn pumpkin quilt raccoon raisin reindeer robin rosemary sailboat sandwich sapphire scooter seashell sequoia snail sprout starfish strawberry sunflower syrup tambourine thimble toffee toucan trolley tuba turnip vanilla volcano waffle walrus willow yarn acorn anchor apple arrow autumn badge bagel bakery balloon bamboo banana barrel basket beacon beetle bicycle blanket blossom bottle bracket breeze bridge bucket buffalo butter button cabin cactus camera candle canoe canyon carpet carrot castle cattle cellar cherry chimney circus clover cobalt coffee comet copper cotton coyote crayon cricket dragon drawer eagle easel echo elbow falcon feather fiddle forest fossil fountain garden garlic giraffe glacier goblet gravel guitar hammer harbor helmet hollow honey island jacket jelly jigsaw kettle kitten ladder lagoon lantern lemon lizard lobster magnet mango maple marble meadow melon mirror mitten monkey mosaic muffin needle nickel noodle oatmeal ocean olive orbit otter oyster paddle palace panda parrot pebble pencil pepper piano pickle pigeon pillow planet pocket potato pretzel puzzle quartz rabbit radish raven ribbon rocket saddle salmon sandal saucer scarf shadow shovel silver skate sparrow spider spoon squirrel stable sugar summer sunset sweater tablet teapot thunder ticket tiger timber tomato tractor trumpet tulip tunnel turtle umbrella valley velvet violin wagon walnut whistle window winter wizard yogurt zebra zipper',
    es: 'abanico acordeon aguacate albahaca alce almohada arbusto ardilla arpa ascensor atun avellana avion azulejo bambu barril bateria baul bellota bicicleta bisonte bombilla bota brocha bruja buho cactus calcetin camaleon camion canasta caracola carbon cascada catapulta cerdo chocolate cisne cometa compas cordero corona cuervo cupcake dado dinosaurio ducha elefante escalon esponja faisan farol flamenco foca frambuesa gacela galaxia garbanzo gaviota gorila granada grillo halcon hamaca harina higo hipopotamo hoja iguana jamon jengibre koala lagarto lavanda lenteja leopardo lima loro madera maiz mapache mariposa medusa mejillon membrillo menta mostaza nectar nuez ocelote orquidea ostra palacio paleta panal pantera papaya pepino perla piña pinguino pistacho pizarra planeta platano pomelo pradera quinoa rabano rastrillo remo rinoceronte romero sardina serpiente sirena tambor tejado telescopio tiburon tomillo trineo tucan vainilla velero yate zafiro abeja abrigo aguja ajedrez alfombra almendra ancla anillo antena arena armario arroz azucar balcon ballena banco barco bastón bigote bosque botella bufanda burbuja caballo cabra cacao cadena cafe caja calabaza camello camino campana canela cangrejo canoa caracol carpeta carta casco castillo cebolla cepillo cereza chaleco chispa cigarra circo ciruela cohete conejo copa corbata cuaderno cuchara cuerda delfin diamante dragon escalera escoba espejo estrella faro flauta flecha fresa fuente galleta gallina ganso garaje gato girasol globo gorra guante guitarra helado hielo hormiga huevo isla jabon jardin jirafa lago lampara lapiz leche lechuga leon libro limon linterna lobo luna maleta mango manta manzana mapa martillo melon mesa miel mochila moneda montaña mosca naranja nido niebla noche nube oceano oso oveja pajaro pala palmera pan panda papel paraguas parque pato peine pelota pera perro pez piano pimienta pingüino pirata plato pluma puente puerta pulpo queso radio rana raton regla reloj rio robot rosa rueda salsa sandia sapo semilla silla sombrero sopa taza tambor tenedor tigre tijera tomate toro tortuga trigo trompeta tulipan uva vaca vela ventana viento violin volcan yogur zanahoria zapato zorro'
  };
  const lista = () => { const l = (UT.N && UT.N.idioma && UT.N.idioma()) || 'pt-BR'; return (PAL[l] || PAL['pt-BR']).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ç/g, 'c').split(/\s+/).filter((w, i, a) => w && a.indexOf(w) === i); };
  const CLS = { mai: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', min: 'abcdefghijklmnopqrstuvwxyz', num: '0123456789', sim: '!@#$%&*-_=+?.:;' };
  const AMB = /[Il1O0o]/g;
  const op = Object.assign({ modo: 'senha', tam: 16, mai: true, min: true, num: true, sim: true, amb: false, pal: 6, sep: '-', cap: true, numero: true }, UT.ler('senha', {}));
  let el, atualS = '', bits = 0, hist = [];

  function sorteio(n) { // inteiro uniforme em [0, n)
    const lim = Math.floor(0x100000000 / n) * n, a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= lim);
    return a[0] % n;
  }
  function gerarSenha() {
    const cls = ['mai', 'min', 'num', 'sim'].filter(k => op[k]).map(k => op.amb ? CLS[k].replace(AMB, '') : CLS[k]);
    if (!cls.length) return { s: '', b: 0 };
    const todos = cls.join('');
    let s;
    for (let t = 0; t < 200; t++) {
      s = ''; for (let i = 0; i < op.tam; i++) s += todos[sorteio(todos.length)];
      if (op.tam < cls.length || cls.every(c => [...s].some(ch => c.includes(ch)))) break;
    }
    return { s, b: op.tam * Math.log2(todos.length) };
  }
  function gerarFrase() {
    const L = lista(), p = [];
    for (let i = 0; i < op.pal; i++) { let w = L[sorteio(L.length)]; if (op.cap) w = w[0].toUpperCase() + w.slice(1); p.push(w); }
    let b = op.pal * Math.log2(L.length);
    if (op.numero) { const k = sorteio(p.length); p[k] += sorteio(100); b += Math.log2(100) + Math.log2(p.length); }
    return { s: p.join(op.sep === 'espaco' ? ' ' : op.sep), b };
  }
  function nivel(b) {
    if (b < 40) return { t: 'Fraca', c: 'var(--err)', p: Math.max(8, b / 40 * 30) };
    if (b < 60) return { t: 'Razoável', c: 'var(--warn)', p: 30 + (b - 40) / 20 * 25 };
    if (b < 80) return { t: 'Forte', c: 'var(--ok)', p: 55 + (b - 60) / 20 * 25 };
    return { t: 'Muito forte', c: 'var(--ok)', p: Math.min(100, 80 + (b - 80) / 48 * 20) };
  }
  function tempo(b) {
    // computador muito rápido tentando 10 bilhões de senhas por segundo, sem saber nada da senha
    const s = Math.pow(2, b - 1) / 1e10;
    const U = [[31557600e9, 'bilhões de anos'], [31557600e6, 'milhões de anos'], [31557600e3, 'mil anos'], [31557600, 'anos'], [86400, 'dias'], [3600, 'horas'], [60, 'minutos'], [1, 'segundos']];
    if (s < 1) return T('menos de 1 segundo');
    if (s > 31557600e12) return T('mais tempo que a idade do universo');
    for (const [k, n] of U) if (s >= k) return T('cerca de {1} {2}', num(s / k, 0), T(n));
    return T('menos de 1 segundo');
  }
  function montar(v) {
    el = v;
    v.innerHTML = `<div class="cab"><div><h1>Gerador de senha</h1><p>Senhas fortes e frases-senha fáceis de lembrar, sorteadas com o gerador seguro do navegador. Nada é guardado nem enviado.</p></div></div>
      <div class="grade2 l">
        <div>
          <div class="painel">
            <div class="seg" id="seModo" style="margin-bottom:14px"><button data-m="senha">Senha</button><button data-m="frase">Frase-senha</button></div>
            <div class="senha-saida"><output id="seSaida" aria-live="polite"></output>
              <button class="btn" id="seNova" title="Gerar outra" aria-label="Gerar outra">${ICO.renovar}</button>
              <button class="btn pri" id="seCopiar">${ICO.copiar}<span>Copiar</span></button></div>
            <div class="forca"><i id="seBarra"></i></div>
            <p class="dica" id="seForca" style="margin:0"></p>
          </div>
          <div class="painel" id="seOpSenha">
            <label class="campo"><span>Tamanho: <b id="seTamV"></b> caracteres</span><input type="range" id="seTam" min="6" max="64"></label>
            <div class="grade2">
              <label class="chk"><input type="checkbox" data-o="mai"> Letras maiúsculas (A-Z)</label>
              <label class="chk"><input type="checkbox" data-o="min"> Letras minúsculas (a-z)</label>
              <label class="chk"><input type="checkbox" data-o="num"> Números (0-9)</label>
              <label class="chk"><input type="checkbox" data-o="sim"> Símbolos (!@#$…)</label>
            </div>
            <label class="chk"><input type="checkbox" data-o="amb"> Evitar caracteres parecidos (I, l, 1, O, 0)</label>
          </div>
          <div class="painel" id="seOpFrase" hidden>
            <label class="campo"><span>Palavras: <b id="sePalV"></b></span><input type="range" id="sePal" min="3" max="10"></label>
            <label class="campo"><span>Separador</span><select class="in" id="seSep"><option value="-">Hífen (-)</option><option value=".">Ponto (.)</option><option value="_">Sublinhado (_)</option><option value="espaco">Espaço</option><option value="">Nenhum</option></select></label>
            <label class="chk"><input type="checkbox" data-o="cap"> Primeira letra maiúscula</label>
            <label class="chk"><input type="checkbox" data-o="numero"> Incluir um número</label>
            <p class="dica">Frases-senha são longas e fáceis de lembrar. Use palavras sorteadas, nunca uma frase conhecida.</p>
          </div>
        </div>
        <div>
          <div class="painel"><h2>Geradas agora</h2><ul class="hist" id="seHist"></ul><p class="dica">Só nesta tela. Ao fechar, a lista some.</p></div>
          <div class="painel"><h2>Testar uma senha</h2>
            <div class="linha" style="flex-wrap:nowrap"><input class="in mono" id="seTeste" type="password" autocomplete="off" spellcheck="false" placeholder="Digite para ver a força"><button class="btn" id="seVer" title="Mostrar" aria-label="Mostrar">${ICO.olho}</button></div>
            <div class="forca"><i id="seTBarra"></i></div><p class="dica" id="seTInfo" style="margin:0">A conta é feita aqui; a senha não sai do seu computador.</p></div>
        </div>
      </div>`;
    $('#seModo', v).addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { op.modo = b.dataset.m; salvar(); nova(); } });
    $('#seTam', v).addEventListener('input', () => { op.tam = +$('#seTam', v).value; salvar(); nova(); });
    $('#sePal', v).addEventListener('input', () => { op.pal = +$('#sePal', v).value; salvar(); nova(); });
    $('#seSep', v).addEventListener('change', () => { op.sep = $('#seSep', v).value; salvar(); nova(); });
    $$('[data-o]', v).forEach(c => c.addEventListener('change', () => {
      op[c.dataset.o] = c.checked;
      if (!['mai', 'min', 'num', 'sim'].some(k => op[k])) { op.min = true; $('[data-o="min"]', v).checked = true; UT.aviso(T('Escolha pelo menos um tipo de caractere.'), true); }
      salvar(); nova();
    }));
    $('#seNova', v).addEventListener('click', nova);
    $('#seCopiar', v).addEventListener('click', () => { if (atualS) UT.copiar(atualS, T('Senha copiada.')); });
    $('#seHist', v).addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) UT.copiar(hist[+b.dataset.i], T('Senha copiada.')); });
    $('#seTeste', v).addEventListener('input', testar);
    $('#seVer', v).addEventListener('click', () => { const i = $('#seTeste', v); const mostra = i.type === 'password'; i.type = mostra ? 'text' : 'password'; $('#seVer', v).innerHTML = mostra ? ICO.olhoX : ICO.olho; });
    $('#seTam', v).value = op.tam; $('#sePal', v).value = op.pal; $('#seSep', v).value = op.sep;
    $$('[data-o]', v).forEach(c => { c.checked = !!op[c.dataset.o]; });
    nova();
  }
  function salvar() { UT.guardar('senha', { modo: op.modo, tam: op.tam, mai: op.mai, min: op.min, num: op.num, sim: op.sim, amb: op.amb, pal: op.pal, sep: op.sep, cap: op.cap, numero: op.numero }); }
  function nova() {
    $$('#seModo [data-m]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === op.modo)));
    $('#seOpSenha', el).hidden = op.modo !== 'senha'; $('#seOpFrase', el).hidden = op.modo !== 'frase';
    $('#seTamV', el).textContent = op.tam; $('#sePalV', el).textContent = op.pal;
    const r = op.modo === 'frase' ? gerarFrase() : gerarSenha();
    atualS = r.s; bits = r.b;
    $('#seSaida', el).textContent = atualS;
    mostrarForca($('#seBarra', el), $('#seForca', el), bits);
    if (atualS) { hist = [atualS].concat(hist.filter(x => x !== atualS)).slice(0, 8); }
    $('#seHist', el).innerHTML = hist.map((s, i) => `<li><span>${esc(s)}</span><button class="btn peq so" data-i="${i}" title="Copiar" aria-label="Copiar">${ICO.copiar}</button></li>`).join('');
  }
  function mostrarForca(barra, txt, b) {
    const n = nivel(b);
    barra.style.width = n.p + '%'; barra.style.background = n.c;
    txt.textContent = T('{1} · cerca de {2} bits · para adivinhar: {3}', T(n.t), num(b, 0), tempo(b));
  }
  const COMUNS = ['123456', '12345678', '123456789', 'senha', 'password', 'qwerty', 'abc123', '111111', 'admin', 'brasil', 'amor', 'iloveyou', 'teste', '654321', 'mudar123', 'futebol', 'flamengo', 'corinthians', 'palmeiras', 'gremio', 'jesus', 'deus', 'familia'];
  function testar() {
    const s = $('#seTeste', el).value, barra = $('#seTBarra', el), inf = $('#seTInfo', el);
    if (!s) { barra.style.width = '0'; inf.textContent = T('A conta é feita aqui; a senha não sai do seu computador.'); return; }
    let pool = 0;
    if (/[a-z]/.test(s)) pool += 26; if (/[A-Z]/.test(s)) pool += 26; if (/\d/.test(s)) pool += 10; if (/[^a-zA-Z0-9]/.test(s)) pool += 20;
    // trechos repetidos e sequências valem pouco
    const efetivo = s.replace(/(.)\1{2,}/g, '$1$1').replace(/(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|wert|asdf)/gi, 'xx');
    let b = efetivo.length * Math.log2(Math.max(pool, 2));
    const baixo = s.toLowerCase();
    const comum = COMUNS.find(w => baixo.includes(w));
    if (comum) b = Math.min(b, 18 + (s.length - comum.length) * 3);
    if (/^\d+$/.test(s)) b = Math.min(b, s.length * 3.32);
    mostrarForca(barra, inf, b);
    if (comum) inf.textContent += ' · ' + T('contém uma senha muito usada ({1})', comum);
  }
  UT.registrar('senha', { montar, abrir() { if (!atualS) nova(); } });
  if (UT.N && UT.N.idiomas) UT.N.idiomas.aoMudar(() => { if (el) { nova(); testar(); } });
})();
