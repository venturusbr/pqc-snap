import { keccak_256 } from '@noble/hashes/sha3';

/**
 * Converte um buffer de bytes (Uint8Array) em uma string hexadecimal.
 */
export const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/**
 * Converte uma string hexadecimal em um buffer de bytes (Uint8Array).
 */
export const hexToBytes = (hex: string): Uint8Array => {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

/**
 * Concatena dois buffers de bytes.
 */
export const concatBytes = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const safeA = a instanceof Uint8Array ? a : new Uint8Array(0);
  const safeB = b instanceof Uint8Array ? b : new Uint8Array(0);
  const result = new Uint8Array(safeA.length + safeB.length);
  result.set(safeA);
  result.set(safeB, safeA.length);
  return result;
};

/**
 * Serializa com segurança qualquer objeto contendo BigInt, Uint8Array ou referências complexas.
 */
export function safeStringify(obj: any, space?: number): string {
  try {
    return JSON.stringify(
      obj,
      (_, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        if (value instanceof Uint8Array) {
          return '0x' + bytesToHex(value);
        }
        return value;
      },
      space,
    );
  } catch {
    return String(obj);
  }
}

/**
 * Converte um valor em ETH (string decimal) para representação hexadecimal de Wei.
 */
export function parseEthToWeiHex(ethStr: string): string {
  try {
    const clean = (ethStr || '0').trim().replace(',', '.');
    if (!clean || clean === '0' || clean === '0.0') {
      return '0x0';
    }
    const parts = clean.split('.');
    const whole = parts[0] || '0';
    let fraction = parts[1] || '';
    fraction = fraction.padEnd(18, '0').slice(0, 18);
    const weiStr = BigInt(whole + fraction).toString();
    return '0x' + BigInt(weiStr).toString(16);
  } catch {
    return '0x0';
  }
}

/**
 * Converte um valor em Reais (string decimal) para representação hexadecimal de centavos de uint256 (32 bytes).
 */
export function parseBrlToCentavosHex(brlStr: string): string {
  try {
    const clean = (brlStr || '0').trim().replace(',', '.');
    const num = parseFloat(clean);
    if (isNaN(num) || num <= 0) {
      return '0x0';
    }
    const centavos = BigInt(Math.round(num * 100));
    return '0x' + centavos.toString(16);
  } catch {
    return '0x0';
  }
}

/**
 * Calcula o seletor de 4 bytes de uma assinatura de função Solidity via Keccak-256.
 */
export function getSelector(signature: string): string {
  const bytes = new TextEncoder().encode(signature);
  const hash = keccak_256(bytes);
  return '0x' + Array.from(hash.slice(0, 4)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calcula o hash de 32 bytes de uma role do AccessControl via Keccak-256.
 */
export function getRoleHash(roleName: string): string {
  if (roleName === 'DEFAULT_ADMIN_ROLE') {
    return '0000000000000000000000000000000000000000000000000000000000000000';
  }
  const bytes = new TextEncoder().encode(roleName);
  const hash = keccak_256(bytes);
  return Array.from(hash).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Codifica a chamada para a função pingDelegation(string).
 */
export function encodePingDelegation(note: string): string {
  const noteBytes = new TextEncoder().encode(note);
  const sel = getSelector('pingDelegation(string)'); // 4 bytes
  const cleanSel = sel.startsWith('0x') ? sel.slice(2) : sel;
  const offset = '0000000000000000000000000000000000000000000000000000000000000020'; // offset 32
  const lenHex = noteBytes.length.toString(16).padStart(64, '0');
  let noteHex = bytesToHex(noteBytes);
  const remainder = noteHex.length % 64;
  if (remainder !== 0) {
    noteHex = noteHex.padEnd(noteHex.length + (64 - remainder), '0');
  }
  return '0x' + cleanSel + offset + lenHex + noteHex;
}

/**
 * Converte valor hexadecimal ou decimal em Wei para string legível em ETH (até 6 casas decimais).
 */
export function formatWeiHexToEth(weiHex?: string | number): string {
  if (weiHex === undefined || weiHex === null || weiHex === '' || weiHex === '0x' || weiHex === '0x0') {
    return '0';
  }
  try {
    const wei = BigInt(weiHex);
    if (wei <= 0n) return '0';
    const whole = wei / 1000000000000000000n;
    const rem = wei % 1000000000000000000n;
    if (rem === 0n) return whole.toString();
    const fracFull = rem.toString().padStart(18, '0').slice(0, 6);
    const fracTrimmed = fracFull.replace(/0+$/, '');
    return fracTrimmed ? `${whole.toString()}.${fracTrimmed}` : whole.toString();
  } catch {
    return '0';
  }
}

/**
 * Converte preço de gas em Wei para string formatada em Gwei.
 */
export function formatWeiHexToGwei(weiHex?: string | number): string {
  if (weiHex === undefined || weiHex === null || weiHex === '' || weiHex === '0x' || weiHex === '0x0') {
    return '0.00 Gwei';
  }
  try {
    const wei = BigInt(weiHex);
    const gweiWhole = wei / 1000000000n;
    const gweiRem = ((wei % 1000000000n) * 100n) / 1000000000n;
    return `${gweiWhole.toString()}.${gweiRem.toString().padStart(2, '0')} Gwei`;
  } catch {
    return '0.00 Gwei';
  }
}

/**
 * Decodifica seletores de função Solidity conhecidos (4 bytes) para melhorar a legibilidade do diálogo.
 */
export function decodeKnownSelector(dataHex?: string): string {
  const clean = (dataHex || '').trim().toLowerCase();
  if (!clean || clean === '0x') {
    return 'Sem calldata (Transferência ETH)';
  }
  const selector = clean.startsWith('0x') ? clean.slice(0, 10) : `0x${clean.slice(0, 8)}`;
  switch (selector) {
    case '0xd09de08a':
      return 'increment() [0xd09de08a]';
    case '0x61bc221a':
      return 'counter() [0x61bc221a]';
    case '0x5c36b186':
      return 'pingDelegation(string) [0x5c36b186]';
    case '0xa9059cbb':
      return 'transfer(address,uint256) [0xa9059cbb]';
    case '0x095ea7b3':
      return 'approve(address,uint256) [0x095ea7b3]';
    default:
      return `Seletor customizado [${selector}]`;
  }
}
