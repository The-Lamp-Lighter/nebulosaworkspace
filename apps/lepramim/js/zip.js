/* ============================================================
   LêPraMim — zip.js
   Leitor de arquivos ZIP escrito em JavaScript puro.
   EPUB e DOCX são, por dentro, arquivos ZIP. Em vez de depender
   de bibliotecas externas, usamos o descompactador que já vem no
   navegador (DecompressionStream), mantendo o app 100% offline.
   ============================================================ */
(function () {
  'use strict';

  /** Descompacta dados "deflate" usando o recurso nativo do navegador. */
  async function inflar(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Este navegador é antigo demais para abrir EPUB/DOCX. Atualize o Edge ou o Chrome.');
    }
    const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(fluxo).arrayBuffer());
  }

  /**
   * Abre um ZIP a partir de um ArrayBuffer.
   * Retorna { nomes, tem(nome), ler(nome) -> Uint8Array, lerTexto(nome) -> string }
   */
  async function abrir(buffer) {
    const u8 = new Uint8Array(buffer);
    const dv = new DataView(buffer);
    const utf8 = new TextDecoder('utf-8');

    // 1) Localiza o "fim do diretório central", que fica no final do arquivo
    let fim = -1;
    const limite = Math.max(0, u8.length - 65557);
    for (let i = u8.length - 22; i >= limite; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
    }
    if (fim < 0) throw new Error('Arquivo corrompido ou não é um ZIP válido.');

    const total = dv.getUint16(fim + 10, true);
    let pos = dv.getUint32(fim + 16, true);

    // 2) Lê a lista de arquivos (diretório central)
    const entradas = new Map();
    for (let n = 0; n < total; n++) {
      if (pos + 46 > u8.length || dv.getUint32(pos, true) !== 0x02014b50) break;
      const metodo = dv.getUint16(pos + 10, true);
      const tamComp = dv.getUint32(pos + 20, true);
      const tamNome = dv.getUint16(pos + 28, true);
      const tamExtra = dv.getUint16(pos + 30, true);
      const tamComent = dv.getUint16(pos + 32, true);
      const local = dv.getUint32(pos + 42, true);
      const nome = utf8.decode(u8.subarray(pos + 46, pos + 46 + tamNome));
      entradas.set(nome, { metodo, tamComp, local });
      pos += 46 + tamNome + tamExtra + tamComent;
    }

    /** Encontra a entrada mesmo com diferenças de maiúsculas ou de codificação de URL. */
    function achar(nome) {
      if (entradas.has(nome)) return entradas.get(nome);
      let alt = nome;
      try { alt = decodeURIComponent(nome); } catch (e) { /* mantém */ }
      if (entradas.has(alt)) return entradas.get(alt);
      const baixo = alt.toLowerCase();
      for (const [k, v] of entradas) if (k.toLowerCase() === baixo) return v;
      return null;
    }

    async function ler(nome) {
      const e = achar(nome);
      if (!e) throw new Error('Arquivo interno não encontrado: ' + nome);
      // Cabeçalho local: o tamanho do nome/extra pode diferir do diretório central
      const tamNome = dv.getUint16(e.local + 26, true);
      const tamExtra = dv.getUint16(e.local + 28, true);
      const inicio = e.local + 30 + tamNome + tamExtra;
      const bruto = u8.subarray(inicio, inicio + e.tamComp);
      if (e.metodo === 0) return bruto.slice();       // armazenado sem compressão
      if (e.metodo === 8) return inflar(bruto);        // deflate
      throw new Error('Método de compressão não suportado no arquivo.');
    }

    return {
      nomes: Array.from(entradas.keys()),
      tem: nome => !!achar(nome),
      ler,
      lerTexto: async nome => LPM.util.decodificarTexto(await ler(nome))
    };
  }

  LPM.zip = { abrir };
})();
