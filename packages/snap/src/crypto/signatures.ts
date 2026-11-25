import { secp256k1 } from '@noble/curves/secp256k1.js';
import { ml_dsa44 } from '@noble/post-quantum/ml-dsa.js';
import { falcon512 } from '@noble/post-quantum/falcon.js';
import { concatBytes, bytesToHex } from './utils';
import { deriveEcdsaSeed, derivePqcKeyPair, type PqcAlgorithm } from './keys';

/**
 * Cria uma assinatura SECP256K1 clássica de 65 bytes (32 bytes r + 32 bytes s + 1 byte recoveryId/v).
 *
 * NOTA CRÍTICA:
 * - Para transações Besu PQC (eth_signTransaction), addV27 DEVE ser false (recId bruto 0 ou 1).
 * - Para personal_sign, addV27 DEVE ser true (recId + 27 = 27 ou 28).
 */
export function createClassicSignature(hash: Uint8Array, ecdsaKeyBytes: Uint8Array, addV27: boolean = false): Uint8Array {
  const sigObj = secp256k1.sign(hash, ecdsaKeyBytes, { format: 'recovered', prehash: false });
  const classicSig = new Uint8Array(65);

  const recId = sigObj[0]; // 0 ou 1
  classicSig.set(sigObj.subarray(1, 65), 0);
  classicSig[64] = addV27 ? recId + 27 : recId;

  return classicSig;
}

/**
 * Assina `payload` com o algoritmo pós-quântico da conta, usando a sub-semente do algoritmo
 * (ou uma `preDerivedSecretKey` já derivada na mesma transação para evitar keygen repetido).
 * - ML-DSA-44: assinatura determinística FIPS 204 de 2420 bytes (`extraEntropy: false` reduz a latência em ~2x).
 * - Falcon-512: assinatura comprimida de tamanho variável (cabeçalho 0x39), o formato aceito
 *   pelo FalconSigner do BouncyCastle usado no Besu.
 */
export async function pqcSign(
  payload: Uint8Array,
  seedBytes: Uint8Array,
  algorithm: PqcAlgorithm = 'MLDSA44',
  preDerivedSecretKey?: Uint8Array,
): Promise<Uint8Array> {
  const secretKey = preDerivedSecretKey ?? derivePqcKeyPair(seedBytes, algorithm).secretKey;
  if (algorithm === 'FALCON512') {
    return falcon512.sign(payload, secretKey);
  }
  return ml_dsa44.sign(payload, secretKey, { extraEntropy: false });
}

/**
 * Executa a assinatura híbrida (Strong Nesting) de uma mensagem ou preimage de transação com separação de domínio:
 * 1. Deriva sub-semente ECDSA e assina o hash com ECDSA secp256k1 (gerando assinatura clássica de 65 bytes).
 * 2. Concatena os bytes de entrada (ou hash) com a assinatura clássica.
 * 3. Assina a concatenação com o algoritmo PQC da conta (ML-DSA-44 ou Falcon-512).
 * 4. Retorna a junção final (65 bytes clássicos + assinatura PQC).
 */
export async function signHybridPayload(
  signingHash: Uint8Array,
  payloadForPqc: Uint8Array,
  seedBytes: Uint8Array,
  addV27: boolean = false,
  algorithm: PqcAlgorithm = 'MLDSA44',
): Promise<{
  classicSignature: Uint8Array;
  pqcSignature: Uint8Array;
  combinedSignatureBytes: Uint8Array;
  signatureHex: string;
}> {
  const classicSignature = createClassicSignature(signingHash, deriveEcdsaSeed(seedBytes), addV27);
  const pqcSignature = await pqcSign(concatBytes(payloadForPqc, classicSignature), seedBytes, algorithm);

  const combinedSignatureBytes = concatBytes(classicSignature, pqcSignature);
  const signatureHex = '0x' + bytesToHex(combinedSignatureBytes);

  return {
    classicSignature,
    pqcSignature,
    combinedSignatureBytes,
    signatureHex,
  };
}

/**
 * Executa a assinatura PQC pura (ML-DSA-44 ou Falcon-512) com separação de domínio.
 */
export async function signPqcPayload(
  payload: Uint8Array,
  seedBytes: Uint8Array,
  algorithm: PqcAlgorithm = 'MLDSA44',
): Promise<{
  pqcSignature: Uint8Array;
  signatureHex: string;
}> {
  const pqcSignature = await pqcSign(payload, seedBytes, algorithm);
  return {
    pqcSignature,
    signatureHex: '0x' + bytesToHex(pqcSignature),
  };
}

