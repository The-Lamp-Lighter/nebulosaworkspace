/* ============================================================
   LêPraMim — piper-worker.js
   Roda em segundo plano (Web Worker) para não travar a tela.
   Transforma texto em áudio com as vozes neurais do Piper:
     1) piper_phonemize (espeak-ng em WebAssembly): texto -> fonemas
     2) ONNX Runtime Web: fonemas -> onda sonora (modelo .onnx da voz)
   Tudo é carregado da pasta libs/piper deste computador.

   Mensagens recebidas:
     { tipo:'sintetizar', id, voz, texto, escala }   escala = duração (1 = normal; 0,5 = 2× mais rápido)
     { tipo:'descartar', ids:[…] }                   cancela pedidos que ainda estão na fila
   Mensagens enviadas:
     { tipo:'audio', id, pcm (Float32Array), taxa }  |  { tipo:'erro', id, mensagem }
   ============================================================ */
'use strict';

const BASE = new URL('../libs/piper/', self.location.href).href;
const fila = [];
let ocupado = false;

let criarFonemizador = null;   // fábrica do módulo piper_phonemize
let moduloWasm = null;         // WebAssembly já compilado (reutilizado a cada frase)
let dadosEspeak = null;        // dicionários do espeak-ng
let sessao = null, configVoz = null, vozCarregada = '';

async function baixar(caminho, comoJson) {
  const r = await fetch(BASE + caminho);
  if (!r.ok) throw new Error('Arquivo não encontrado: libs/piper/' + caminho + '. Execute o Baixar-Bibliotecas.');
  return comoJson ? r.json() : r.arrayBuffer();
}

/** Carrega o ONNX Runtime e o fonemizador (uma única vez). */
async function garantirMotor() {
  if (criarFonemizador) return;
  importScripts(BASE + 'ort/ort.wasm.min.js');
  self.ort.env.wasm.wasmPaths = BASE + 'ort/';
  self.ort.env.wasm.numThreads = 1;

  const url = BASE + 'phonemize/piper_phonemize.js';
  let fabrica = null;
  try { importScripts(url); fabrica = self.createPiperPhonemize; } catch (e) { /* pode ser um módulo ES: tenta abaixo */ }
  if (typeof fabrica !== 'function') {
    const m = await import(url);
    fabrica = m.createPiperPhonemize || m.default;
  }
  if (typeof fabrica !== 'function') throw new Error('O fonemizador do Piper (piper_phonemize.js) não pôde ser carregado.');

  const [wasm, dados] = await Promise.all([baixar('phonemize/piper_phonemize.wasm'), baixar('phonemize/piper_phonemize.data')]);
  moduloWasm = await WebAssembly.compile(wasm);
  dadosEspeak = dados;
  criarFonemizador = fabrica;
}

/** Carrega o modelo da voz escolhida. */
async function garantirVoz(id) {
  if (sessao && vozCarregada === id) return;
  if (sessao) { try { await sessao.release(); } catch (e) { /* ignora */ } sessao = null; }
  configVoz = await baixar('vozes/' + id + '.onnx.json', true);
  const modelo = await baixar('vozes/' + id + '.onnx');
  sessao = await self.ort.InferenceSession.create(new Uint8Array(modelo), { executionProviders: ['wasm'] });
  vozCarregada = id;
}

/** Texto -> lista de identificadores de fonemas. */
async function fonemizar(texto) {
  const linhas = [], erros = [];
  const modulo = await criarFonemizador({
    print: l => linhas.push(l),
    printErr: l => erros.push(l),
    locateFile: nome => BASE + 'phonemize/' + nome,
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
      await garantirMotor();
      await garantirVoz(pedido.voz);
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
  if (m.tipo === 'sintetizar') { fila.push(m); processar(); }
  else if (m.tipo === 'descartar') {
    for (let i = fila.length - 1; i >= 0; i--) {
      if (m.ids.indexOf(fila[i].id) >= 0) {
        self.postMessage({ tipo: 'erro', id: fila[i].id, mensagem: 'descartado' });
        fila.splice(i, 1);
      }
    }
  }
};
