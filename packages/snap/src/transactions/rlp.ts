import { concatBytes, hexToBytes } from '../crypto/utils';

/**
 * Converte um número decimal em uma representação de bytes mínima (Uint8Array).
 */
export function numberToBytes(num: number): Uint8Array {
  if (num === 0) {
    return new Uint8Array(0);
  }
  const hex = num.toString(16);
  const padded = hex.length % 2 === 0 ? hex : '0' + hex;
  return hexToBytes(padded);
}

/**
 * Converte um valor curto (16 bits) para um buffer de 2 bytes (Big Endian).
 */
export function shortToBytes(val: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = (val >> 8) & 0xff;
  buf[1] = val & 0xff;
  return buf;
}

/**
 * Converte diferentes tipos de dados em um buffer de bytes (Uint8Array) para o RLP.
 */
export function toBuffer(val: any): Uint8Array {
  if (val === undefined || val === null) {
    return new Uint8Array(0);
  }
  if (val instanceof Uint8Array) {
    return val;
  }
  if (typeof val === 'string') {
    if (val.startsWith('-') || val.startsWith('0x-')) {
      return new Uint8Array(0);
    }
    let clean = val.startsWith('0x') ? val.slice(2) : val;
    if (clean.startsWith('-')) {
      return new Uint8Array(0);
    }
    // Se o tamanho da string hex for ímpar, adiciona 0 à esquerda
    if (clean.length % 2 !== 0) {
      clean = '0' + clean;
    }
    // "0x0" ou vazio são mapeados para buffer vazio no RLP
    if (clean === '00' || clean === '') {
      return new Uint8Array(0);
    }
    return hexToBytes(clean);
  }
  if (typeof val === 'number') {
    return numberToBytes(val);
  }
  if (typeof val === 'bigint') {
    let hex = val.toString(16);
    if (hex.length % 2 !== 0) {
      hex = '0' + hex;
    }
    return hexToBytes(hex);
  }
  throw new Error(`Cannot convert value to buffer: ${String(val)}`);
}

/**
 * Converte um endereço Ethereum em buffer de 20 bytes padronizado.
 */
export function toAddress(val: any): Uint8Array {
  if (val === undefined || val === null || val === '') {
    return new Uint8Array(0);
  }
  if (val instanceof Uint8Array) {
    return val;
  }
  if (typeof val === 'string') {
    let clean = val.startsWith('0x') ? val.slice(2) : val;
    if (clean.length === 0) {
      return new Uint8Array(0);
    }
    clean = clean.padStart(40, '0');
    return hexToBytes(clean);
  }
  return new Uint8Array(0);
}

/**
 * Codificador RLP (Recursive Length Prefix) universal em TypeScript.
 */
export function encodeRLP(item: any): Uint8Array {
  if (item === undefined || item === null) {
    return new Uint8Array([0x80]);
  }
  if (item instanceof Uint8Array) {
    if (item.length === 1 && item[0] < 0x80) {
      return item;
    }
    if (item.length < 56) {
      const header = new Uint8Array(1);
      header[0] = 0x80 + item.length;
      return concatBytes(header, item);
    }
    const lenBytes = numberToBytes(item.length);
    const header = new Uint8Array(1 + lenBytes.length);
    header[0] = 0xb7 + lenBytes.length;
    header.set(lenBytes, 1);
    return concatBytes(header, item);
  }
  if (Array.isArray(item)) {
    let payload = new Uint8Array(0);
    for (const subItem of item) {
      const encodedSub = encodeRLP(subItem);
      if (encodedSub instanceof Uint8Array) {
        payload = concatBytes(payload, encodedSub);
      }
    }
    if (payload.length < 56) {
      const header = new Uint8Array(1);
      header[0] = 0xc0 + payload.length;
      return concatBytes(header, payload);
    }
    const lenBytes = numberToBytes(payload.length);
    const header = new Uint8Array(1 + lenBytes.length);
    header[0] = 0xf7 + lenBytes.length;
    header.set(lenBytes, 1);
    return concatBytes(header, payload);
  }
  return new Uint8Array([0x80]);
}
