/* ============================================================
   LêPraMim — piper-worker.js
   Roda em segundo plano (Web Worker) para não travar a tela.
   Transforma texto em áudio com as vozes neurais do Piper:
     1) piper_phonemize (espeak-ng em WebAssembly): texto -> fonemas
     2) ONNX Runtime Web: fonemas -> onda sonora (modelo .onnx da voz)

   De onde vêm os arquivos (decidido pelo piper.js):
     - da pasta libs/piper deste computador ou do site (Baixar-Bibliotecas), ou
     - da internet (jsDelivr e Hugging Face), quando a pasta não os tem — por
       exemplo, no GitHub Pages. Nesse caso cada arquivo é baixado UMA vez e
       guardado no Cache do navegador (as próximas leituras começam na hora).
   Em nenhum caso o texto sai do computador: a síntese acontece aqui.

   Mensagens recebidas:
     { tipo:'config', ort, fonemizador, cache }      endereços do motor e nome do cache
     { tipo:'sintetizar', id, voz, texto, escala }   voz = { id, json, onnx }; escala = duração (1 = normal)
     { tipo:'baixar', id, voz }                      só baixa e guarda o motor e a voz
     { tipo:'descartar', ids:[…] }                   cancela pedidos que ainda estão na fila
   Mensagens enviadas:
     { tipo:'audio', id, pcm (Float32Array), taxa } | { tipo:'pronto', id } | { tipo:'erro', id, mensagem }
     { tipo:'progresso', id, rotulo, carregado, total }   durante downloads da internet
   ============================================================ */
'use strict';

let MOTOR = {
  ort: new URL('../libs/piper/ort/', self.location.href).href,
  fonemizador: new URL('../libs/piper/phonemize/', self.location.href).href,
  cache: 'lepramim-piper-v1'
};
const fila = [];
let ocupado = false;

let criarFonemizador = null;   // fábrica do módulo piper_phonemize
let moduloWasm = null;         // WebAssembly já compilado (reutilizado a cada frase)
let dadosEspeak = null;        // dicionários do espeak-ng
let sessao = null, configVoz = null, vozCarregada = '';

const externo = url => new URL(url, self.location.href).origin !== self.location.origin;
const nomeArquivo = url => decodeURIComponent(new URL(url, self.location.href).pathname.split('/').pop());

async function abrirCache() {
  if (!self.caches) return null; // só existe em https e localhost
  try { return await caches.open(MOTOR.cache); } catch (e) { return null; }
}

/**
 * Baixa um arquivo. Os da internet são guardados no Cache do navegador
 * (e lidos de lá nas próximas vezes); durante o download, avisa o progresso.
 */
async function baixar(url, comoJson, pedido, rotulo) {
  const web = externo(url);
  const cache = web ? await abrirCache() : null;
  let r = cache ? await cache.match(url) : null;
  if (r) return comoJson ? r.json() : r.arrayBuffer();

  try { r = await fetch(url, web ? { mode: 'cors', credentials: 'omit' } : undefined); }
  catch (e) {
    throw new Error(web ? 'Sem conexão para baixar ' + nomeArquivo(url) + '. Verifique a internet e tente de novo.'
      : 'Não foi possível ler ' + nomeArquivo(url) + '.');
  }
  if (!r.ok) {
    throw new Error(web ? 'O arquivo ' + nomeArquivo(url) + ' não pôde ser baixado (erro ' + r.status + ').'
      : 'Arquivo não encontrado: ' + url.replace(/^.*\/libs\//, 'libs/') + '. Execute o Baixar-Bibliotecas.');
  }
  if (!web) return comoJson ? r.json() : r.arrayBuffer();

  // Arquivo da internet: lê aos pedaços para mostrar o progresso e guarda no cache
  const total = +r.headers.get('content-length') || 0;
  const partes = [];
  let carregado = 0, ultimoAviso = 0;
  if (r.body && r.body.getReader) {
    const leitor = r.body.getReader();
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      partes.push(value);
      carregado += value.length;
      if (pedido && carregado > 262144 && Date.now() - ultimoAviso > 150) { // arquivos pequenos não precisam de aviso
        ultimoAviso = Date.now();
        self.postMessage({ tipo: 'progresso', id: pedido, rotulo, carregado, total });
      }
    }
  } else {
    partes.push(new Uint8Array(await r.arrayBuffer()));
  }
  const blob = new Blob(partes, { type: r.headers.get('content-type') || 'application/octet-stream' });
  if (pedido && blob.size > 262144) self.postMessage({ tipo: 'progresso', id: pedido, rotulo, carregado: blob.size, total: blob.size });
  if (cache) {
    try { await cache.put(url, new Response(blob, { headers: { 'Content-Type': blob.type, 'Content-Length': String(blob.size) } })); }
    catch (e) { /* sem espaço no navegador: funciona, só não fica guardado */ }
  }
  return comoJson ? JSON.parse(await blob.text()) : blob.arrayBuffer();
}

/** Carrega o ONNX Runtime e o fonemizador (uma única vez). */
async function garantirMotor(pedido) {
  if (criarFonemizador) return;
  importScripts(MOTOR.ort + 'ort.wasm.min.js');
  self.ort.env.wasm.wasmPaths = MOTOR.ort;
  self.ort.env.wasm.numThreads = 1;

  const url = MOTOR.fonemizador + 'piper_phonemize.js';
  let fabrica = null;
  try { importScripts(url); fabrica = self.createPiperPhonemize; } catch (e) { /* pode ser um módulo ES: tenta abaixo */ }
  if (typeof fabrica !== 'function') {
    const m = await import(url);
    fabrica = m.createPiperPhonemize || m.default;
  }
  if (typeof fabrica !== 'function') throw new Error('O fonemizador do Piper (piper_phonemize.js) não pôde ser carregado.');

  const wasm = await baixar(MOTOR.fonemizador + 'piper_phonemize.wasm', false, pedido, 'motor');
  const dados = await baixar(MOTOR.fonemizador + 'piper_phonemize.data', false, pedido, 'motor');
  moduloWasm = await WebAssembly.compile(wasm);
  dadosEspeak = dados;
  criarFonemizador = fabrica;
}

/** Carrega o modelo da voz escolhida. */
async function garantirVoz(voz, pedido) {
  if (sessao && vozCarregada === voz.id) return;
  if (sessao) { try { await sessao.release(); } catch (e) { /* ignora */ } sessao = null; vozCarregada = ''; }
  configVoz = await baixar(voz.json, true, pedido, 'voz');
  const modelo = await baixar(voz.onnx, false, pedido, 'voz');
  sessao = await self.ort.InferenceSession.create(new Uint8Array(modelo), { executionProviders: ['wasm'] });
  vozCarregada = voz.id;
}

/** Texto -> lista de identificadores de fonemas. */
async function fonemizar(texto) {
  const linhas = [], erros = [];
  const modulo = await criarFonemizador({
    print: l => linhas.push(l),
    printErr: l => erros.push(l),
    locateFile: nome => MOTOR.fonemizador + nome,
    // usa o WebAssembly já compilado e os dados já baixados (nada de rede a cada frase)
    instantiateWasm: (importacoes, pronto) => {
      WebAssembly.instantiate(moduloWasm, importacoes).then(instancia => pronto(instancia, moduloWasm));
      return {};
    },
    getPreloadedPackage: () => dadosEspeak.slice(0)
  });
  try {
    modulo.callMain(['-l', (configVoz.espeak && configVoz.espeak.voice) || 'pt-br',
      '--input', JSON.stringify([{ text: texto }]), '--espeak_data', '/espeak-ng-data']);
  } catch (e) { /* o programa "termina" por exceção; a saída já foi capturada */ }

  let ids = [];
  for (const l of linhas) {
    try { const o = JSON.parse(l); if (o && Array.isArray(o.phoneme_ids)) ids = ids.concat(o.phoneme_ids); } catch (e) { /* linha que não é JSON */ }
  }
  if (!ids.length && erros.length) throw new Error('Falha ao converter o texto em fonemas: ' + erros.join(' ').slice(0, 200));
  return ids;
}

/** Fonemas -> áudio (Float32Array, mono). */
async function inferir(ids, escala) {
  const ort = self.ort;
  const inf = configVoz.inference || {};
  const num = (v, padrao) => (typeof v === 'number' ? v : padrao);
  const entradas = {
    input: new ort.Tensor('int64', BigInt64Array.from(ids, x => BigInt(x)), [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor('float32', Float32Array.from([num(inf.noise_scale, 0.667), num(inf.length_scale, 1) * escala, num(inf.noise_w, 0.8)]), [3])
  };
  // vozes com vários locutores pedem o número do locutor
  if ((configVoz.num_speakers || 1) > 1 || (configVoz.speaker_id_map && Object.keys(configVoz.speaker_id_map).length)) {
    entradas.sid = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
  }
  const saida = await sessao.run(entradas);
  const tensor = saida.output || saida[Object.keys(saida)[0]];
  return new Float32Array(tensor.data);
}

async function processar() {
  if (ocupado) return;
  ocupado = true;
  while (fila.length) {
    const pedido = fila.shift();
    try {
      await garantirMotor(pedido.id);
      await garantirVoz(pedido.voz, pedido.id);
      if (pedido.tipo === 'baixar') { self.postMessage({ tipo: 'pronto', id: pedido.id }); continue; }
      const taxa = (configVoz.audio && configVoz.audio.sample_rate) || 22050;
      const ids = await fonemizar(pedido.texto);
      const pcm = ids.length ? await inferir(ids, pedido.escala) : new Float32Array(Math.round(taxa * 0.15));
      self.postMessage({ tipo: 'audio', id: pedido.id, pcm, taxa }, [pcm.buffer]);
    } catch (e) {
      self.postMessage({ tipo: 'erro', id: pedido.id, mensagem: (e && e.message) || String(e) });
    }
  }
  ocupado = false;
}

self.onmessage = ev => {
  const m = ev.data || {};
  if (m.tipo === 'config') {
    MOTOR = { ort: m.ort || MOTOR.ort, fonemizador: m.fonemizador || MOTOR.fonemizador, cache: m.cache || MOTOR.cache };
  } else if (m.tipo === 'sintetizar' || m.tipo === 'baixar') {
    fila.push(m); processar();
  } else if (m.tipo === 'descartar') {
    for (let i = fila.length - 1; i >= 0; i--) {
      if (m.ids.indexOf(fila[i].id) >= 0) {
        self.postMessage({ tipo: 'erro', id: fila[i].id, mensagem: 'descartado' });
        fila.splice(i, 1);
      }
    }
  }
};
