import { keccak_256 } from '@noble/hashes/sha3';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import * as bip39 from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import { wordlist } from '@scure/bip39/wordlists/english';
import { hmac } from '@noble/hashes/hmac';
import { sha256, sha512 } from '@noble/hashes/sha2';
import { ml_dsa44 } from '@noble/post-quantum/ml-dsa.js';
import { falcon512 } from '@noble/post-quantum/falcon.js';
import { bytesToHex, concatBytes } from './utils';

/**
 * Deriva deterministicamente uma semente de conta (child seed) de 32 bytes a partir de uma semente master
 * usando HMAC-SHA256, correspondente a um caminho de derivação BIP-44 customizado: m/44'/60'/0'/0/${index}.
 */
export const deriveChildSeed = (masterSeed: Uint8Array, index: number): Uint8Array => {
  const encoder = new TextEncoder();
  const path = `m/44'/60'/0'/0/${index}`;
  return hmac(sha256, masterSeed, encoder.encode(path));
};

/**
 * Gera uma nova frase mnemônica de 24 palavras (256 bits de entropia) no padrão BIP-39.
 */
export function generateMnemonic(): string {
  const entropy = crypto.getRandomValues(new Uint8Array(32));
  return bip39.entropyToMnemonic(entropy, wordlist);
}

/**
 * Valida se uma string é uma frase mnemônica BIP-39 válida em inglês com 24 palavras.
 */
export function validateMnemonic(mnemonicStr: string): boolean {
  const cleaned = (mnemonicStr || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const words = cleaned.split(' ');
  if (words.length !== 24) {
    return false;
  }
  return bip39.validateMnemonic(cleaned, wordlist);
}

/**
 * Converte a frase mnemônica em semente master de 32 bytes (entropy).
 */
export function legacyMnemonicToMasterSeed(mnemonicStr: string): Uint8Array {
  const cleaned = mnemonicStr.trim().toLowerCase().replace(/\s+/g, ' ');
  return bip39.mnemonicToEntropy(cleaned, wordlist);
}

/**
 * Versão atual do esquema de derivação. Contas sem `options.derivationVersion` usam a versão 1 (legada):
 * - v1: masterSeed = entropia crua (32 bytes); semente da conta = HMAC-SHA256(masterSeed, caminho).
 * - v2: masterSeed = semente BIP-39 padrão (PBKDF2-HMAC-SHA512, 2048 iterações, 64 bytes);
 *   contas ECDSA seguem BIP-32/BIP-44 (m/44'/60'/0'/0/i), compatíveis com MetaMask/Ledger;
 *   contas PQC/híbridas usam uma semente própria (HMAC com domínio) que NUNCA depende da chave ECDSA BIP-44.
 */
export const CURRENT_DERIVATION_VERSION = 2;

/** Converte a mnemônica BIP-39 na semente padrão de 64 bytes (PBKDF2, passphrase vazia). */
export function mnemonicToMasterSeed(mnemonicStr: string): Uint8Array {
  const cleaned = mnemonicStr.trim().toLowerCase().replace(/\s+/g, ' ');
  return bip39.mnemonicToSeedSync(cleaned, '');
}

/** Semente de 32 bytes de uma conta PQC/híbrida (v2), isolada da árvore BIP-44 por separação de domínio. */
export const deriveChildSeedV2 = (masterSeed: Uint8Array, index: number): Uint8Array => {
  if (!Number.isInteger(index) || index < 0 || index >= 0x80000000) {
    throw new Error('Índice de derivação inválido.');
  }
  return hmac(sha256, masterSeed, new TextEncoder().encode(`PQC-SNAP/v2/account/${index}`));
};

/** Caminho BIP-44 de uma conta ECDSA Ethereum. */
export const bip44Path = (index: number): string => `m/44'/60'/0'/0/${index}`;

/** Chave privada secp256k1 (32 bytes) em m/44'/60'/0'/0/index, via BIP-32. */
export function deriveBip44EcdsaKey(masterSeed: Uint8Array, index: number): Uint8Array {
  if (!Number.isInteger(index) || index < 0 || index >= 0x80000000) {
    throw new Error('Índice de derivação inválido.');
  }
  const root = HDKey.fromMasterSeed(masterSeed);
  const child = root.derive(bip44Path(index));
  const key = child.privateKey;
  if (!key) throw new Error('Falha ao derivar a chave BIP-44.');
  const copy = new Uint8Array(key);
  root.wipePrivateData();
  child.wipePrivateData();
  return copy;
}

/** Endereço Ethereum padrão: últimos 20 bytes do keccak-256 da chave pública não comprimida (sem 0x04). */
export function ethAddressFromEcdsaKey(privateKey: Uint8Array): { address: string; publicKey: Uint8Array } {
  const publicKey = secp256k1.getPublicKey(privateKey, false).subarray(1);
  const address = ('0x' + bytesToHex(keccak_256(publicKey).slice(-20))).toLowerCase();
  return { address, publicKey };
}

/** Zera um buffer secreto (melhor esforço em JS) após o uso. */
export function wipeBytes(...buffers: Array<Uint8Array | undefined>): void {
  for (const b of buffers) b?.fill(0);
}

/**
 * Deriva deterministicamente uma sub-semente de 32 bytes para ECDSA (secp256k1)
 * usando separação de domínio via HMAC-SHA256.
 */
export const deriveEcdsaSeed = (seedBytes: Uint8Array): Uint8Array => {
  const encoder = new TextEncoder();
  return hmac(sha256, seedBytes, encoder.encode('ECDSA_SECP256K1'));
};

/**
 * Deriva deterministicamente uma sub-semente de 32 bytes para ML-DSA-44
 * usando separação de domínio via HMAC-SHA256.
 */
export const deriveMldsaSeed = (seedBytes: Uint8Array): Uint8Array => {
  const encoder = new TextEncoder();
  return hmac(sha256, seedBytes, encoder.encode('ML_DSA_44'));
};

/** Algoritmo pós-quântico de uma conta. Contas sem o campo `pqcAlgorithm` usam ML-DSA-44. */
export type PqcAlgorithm = 'MLDSA44' | 'FALCON512';

export function accountPqcAlgorithm(options: Record<string, any> | undefined): PqcAlgorithm {
  return options?.pqcAlgorithm === 'FALCON512' ? 'FALCON512' : 'MLDSA44';
}

/** Nome legível do tipo da conta, ex.: "Híbrida (ECDSA + Falcon-512)". */
export function accountTypeLabel(options: Record<string, any> | undefined): string {
  const pqcName = accountPqcAlgorithm(options) === 'FALCON512' ? 'Falcon-512' : 'ML-DSA-44';
  if (options?.isHybrid) {
    return `Híbrida (ECDSA + ${pqcName})`;
  }
  if (options?.isEcdsa) {
    return 'ECDSA (secp256k1, BIP-44)';
  }
  return options?.isPQC ? `${pqcName} Pura` : 'ECDSA Simulada (legada, sem chave)';
}

/**
 * Deriva deterministicamente uma sub-semente de 48 bytes para Falcon-512 (o keygen do Falcon
 * consome 48 bytes) usando separação de domínio via HMAC-SHA512 truncado.
 */
export const deriveFalconSeed = (seedBytes: Uint8Array): Uint8Array => {
  const encoder = new TextEncoder();
  return hmac(sha512, seedBytes, encoder.encode('FALCON_512')).slice(0, 48);
};

/**
 * Par de chaves ML-DSA-44 (FIPS 204) da conta:
 * - publicKey: 1312 bytes
 * - secretKey: 2560 bytes
 */
export function deriveMldsaKeyPair(seedBytes: Uint8Array): { secretKey: Uint8Array; publicKey: Uint8Array } {
  return ml_dsa44.keygen(deriveMldsaSeed(seedBytes));
}

/**
 * Par de chaves Falcon-512 da conta. A biblioteca devolve a chave pública com o byte de
 * cabeçalho 0x09 (897 bytes); o Besu (BouncyCastle) espera apenas os 896 bytes de h, então o
 * cabeçalho é removido aqui e esta é a forma usada no endereço e nas transações.
 */
export function deriveFalconKeyPair(seedBytes: Uint8Array): { secretKey: Uint8Array; publicKey: Uint8Array } {
  const { secretKey, publicKey } = falcon512.keygen(deriveFalconSeed(seedBytes));
  return { secretKey, publicKey: publicKey.subarray(1) };
}

/**
 * Deriva o par de chaves pós-quânticas (ML-DSA-44 ou Falcon-512) a partir da semente da conta.
 */
export function derivePqcKeyPair(
  seedBytes: Uint8Array,
  algorithm: PqcAlgorithm = 'MLDSA44',
): { secretKey: Uint8Array; publicKey: Uint8Array } {
  return algorithm === 'FALCON512' ? deriveFalconKeyPair(seedBytes) : deriveMldsaKeyPair(seedBytes);
}

/** Chave pública pós-quântica da conta, no formato esperado pelo Besu. */
export async function derivePqcPublicKey(
  seedBytes: Uint8Array,
  algorithm: PqcAlgorithm = 'MLDSA44',
): Promise<Uint8Array> {
  return derivePqcKeyPair(seedBytes, algorithm).publicKey;
}

/**
 * Deriva as chaves e endereço para uma Conta Híbrida (ECDSA secp256k1 + ML-DSA-44 ou Falcon-512)
 * com Separação Criptográfica de Domínio.
 *
 * Regra do Esquema Híbrido:
 * 1. Deriva a chave pública PQC a partir da sub-semente do algoritmo
 *    (ML-DSA-44: 1312 bytes; Falcon-512: 896 bytes).
 * 2. Deriva sub-semente ECDSA (HMAC com domínio 'ECDSA_SECP256K1') -> chave pública uncompressed de 64 bytes (sem 0x04).
 * 3. Concatena: ECDSA (64 bytes) + PQC = Chave Composta (1376 bytes com ML-DSA-44, 960 com Falcon-512).
 * 4. Endereço Ethereum: últimos 20 bytes do Keccak-256 da chave composta.
 */
export async function deriveHybridKeysAndAddress(
  seedBytes: Uint8Array,
  algorithm: PqcAlgorithm = 'MLDSA44',
): Promise<{
  derivedAddress: string;
  compositePublicKeyHex: string;
  ecdsaPubKeyBytes: Uint8Array;
  pqcPubKeyBytes: Uint8Array;
}> {
  const pqcPubKeyBytes = await derivePqcPublicKey(seedBytes, algorithm);
  const ecdsaPubKeyBytes = secp256k1.getPublicKey(deriveEcdsaSeed(seedBytes), false).subarray(1);
  const combinedPubKeyBytes = concatBytes(ecdsaPubKeyBytes, pqcPubKeyBytes);

  const hash = keccak_256(combinedPubKeyBytes);
  const derivedAddress = ('0x' + bytesToHex(hash.slice(-20))).toLowerCase();

  return {
    derivedAddress,
    compositePublicKeyHex: bytesToHex(combinedPubKeyBytes),
    ecdsaPubKeyBytes,
    pqcPubKeyBytes,
  };
}

/**
 * Deriva as chaves e endereço para uma Conta PQC Pura (ML-DSA-44 ou Falcon-512) com Separação de Domínio.
 */
export async function derivePurePqcKeysAndAddress(
  seedBytes: Uint8Array,
  algorithm: PqcAlgorithm = 'MLDSA44',
): Promise<{
  derivedAddress: string;
  pqcPublicKeyHex: string;
  pqcPubKeyBytes: Uint8Array;
}> {
  const pqcPubKeyBytes = await derivePqcPublicKey(seedBytes, algorithm);
  const hash = keccak_256(pqcPubKeyBytes);
  const derivedAddress = ('0x' + bytesToHex(hash.slice(-20))).toLowerCase();

  return {
    derivedAddress,
    pqcPublicKeyHex: bytesToHex(pqcPubKeyBytes),
    pqcPubKeyBytes,
  };
}
