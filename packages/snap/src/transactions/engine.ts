import type { KeyringAccount } from '@metamask/keyring-api';
import { keccak_256 } from '@noble/hashes/sha3';
import { hexToBytes, bytesToHex, concatBytes, formatWeiHexToEth } from '../crypto/utils';
import { createClassicSignature, pqcSign } from '../crypto/signatures';
import { derivePqcKeyPair, accountPqcAlgorithm, accountTypeLabel } from '../crypto/keys';
import {
  TxEnvelopeType,
  normalizeTxType,
  dsaTypeForAccount,
  dsaNameForCode,
  envelopeTypeLabel,
  formatEnvelopeHex,
} from './types';
import {
  ensureMinimumGasLimit,
  getBaseGasForAccount,
  calculateCalldataFloor,
  calculateIntrinsicGas,
  countCalldataBytes,
} from './gas';
import { computeTransactionPreimage, serializeTransaction, extractPqcPublicKey } from './rlpBuilder';
import { signAuthorizationList } from './authorization';
import { resolveAccountSecrets, type AccountSecrets } from './seed';
import type { SignedTxData, SerializedTxResult, TxParams, TxTelemetry, TxStepLog } from '../types';

/**
 * Motor de Assinatura Pós-Quântica de Transações com Separação de Domínio.
 * Suporta contas Híbridas (ECDSA + ML-DSA-44 / Falcon-512) e PQC Puras nos envelopes 0x42, 0x41, 0x44, 0x04, 0x02, 0x01, 0x00.
 */
export async function signTransactionCore(
  tx: TxParams,
  account: KeyringAccount,
): Promise<SignedTxData> {
  const secrets = await resolveAccountSecrets(account);
  try {
    return await signWithSecrets(tx, account, secrets);
  } finally {
    secrets.dispose();
  }
}

async function signWithSecrets(
  tx: TxParams,
  account: KeyringAccount,
  { seedBytes, ecdsaKey: ecdsaSeed }: AccountSecrets,
): Promise<SignedTxData> {
  // Garante que o gasLimit atenda ao custo intrínseco mínimo por dsaType e calldata floor (PR 55 do Besu)
  tx = ensureMinimumGasLimit(tx, account);

  const type = normalizeTxType(tx.type);

  const pqcAlgorithm = accountPqcAlgorithm(account.options);

  let signatureHex: string;
  let pqcSignature: Uint8Array;
  let classicSignature: Uint8Array | undefined;

  const isDelegation = type === TxEnvelopeType.FLEXIBLE_DELEGATION || type === TxEnvelopeType.EIP7702;
  const isPqcEnvelope =
    type === TxEnvelopeType.FLEXIBLE_EIP1559 ||
    type === TxEnvelopeType.FLEXIBLE_ACCESS_LIST ||
    type === TxEnvelopeType.FLEXIBLE_DELEGATION;

  if (account.options?.isEcdsa && (isDelegation || isPqcEnvelope)) {
    throw new Error('Contas ECDSA puras só assinam transações padrão (0x00, 0x01, 0x02); use uma conta PQC/híbrida.');
  }

  const signStart = Date.now();
  const needsPqcSigning = Boolean(account.options?.isHybrid || account.options?.isPQC || isPqcEnvelope);
  const pqcSecretKey = needsPqcSigning ? derivePqcKeyPair(seedBytes, pqcAlgorithm).secretKey : undefined;
  try {
    return await signPrepared();
  } finally {
    pqcSecretKey?.fill(0);
  }

  async function signPrepared(): Promise<SignedTxData> {
  // 1. Assina Authorization List para EIP-7702 se presente (reutilizando a chave PQC já derivada)
  if (isDelegation && Array.isArray(tx.authorizationList)) {
    const { signedList, signedListForSigning } = await signAuthorizationList(
      tx.authorizationList,
      seedBytes,
      account,
      pqcSecretKey,
    );
    tx.authorizationList = signedList;
    tx.authorizationListForSigning = signedListForSigning;
  }

  // 2. Preimage e Hashing
  const preimage = computeTransactionPreimage(tx, account);
  const recoveryHash = keccak_256(preimage);
  const preimageHex = '0x' + bytesToHex(preimage);
  const signingHashHex = '0x' + bytesToHex(recoveryHash);

  if (account.options?.isHybrid || (!isPqcEnvelope && !account.options?.isPQC)) {
    // --- ASSINATURA HÍBRIDA OU ECDSA ---
    classicSignature = createClassicSignature(recoveryHash, ecdsaSeed, false);

    if (account.options?.isHybrid || isPqcEnvelope) {
      const payloadForPqc = concatBytes(recoveryHash, classicSignature);
      pqcSignature = await pqcSign(payloadForPqc, seedBytes, pqcAlgorithm, pqcSecretKey);
      signatureHex = '0x' + bytesToHex(concatBytes(classicSignature, pqcSignature));
    } else {
      pqcSignature = new Uint8Array(0);
      signatureHex = '0x' + bytesToHex(classicSignature);
    }
  } else {
    // --- ASSINATURA PQC PURA (ML-DSA-44 ou Falcon-512) ---
    pqcSignature = await pqcSign(recoveryHash, seedBytes, pqcAlgorithm, pqcSecretKey);
    signatureHex = '0x' + bytesToHex(pqcSignature);
  }

  const signDurationMs = Math.max(1, Date.now() - signStart);
  const classicSigBytes = classicSignature ? classicSignature.length : 0;
  const pqcSigBytes = pqcSignature ? pqcSignature.length : 0;
  const totalSigBytes = classicSigBytes + pqcSigBytes;
  const publicKeyBytes = isPqcEnvelope
    ? extractPqcPublicKey(account).length
    : Math.floor(String(account.options?.publicKey || '').replace(/^0x/, '').length / 2);

  // Prepara R, S, V para retorno padronizado
  const isLegacy = type === TxEnvelopeType.LEGACY;
  const chainIdNum = tx.chainId ? Number(tx.chainId) : undefined;
  const recoveryId = classicSignature ? classicSignature[64] : 0;

  const rHex = classicSignature ? '0x' + bytesToHex(classicSignature.subarray(0, 32)) : '0x' + '0'.repeat(64);
  const sHex = classicSignature
    ? '0x' + bytesToHex(classicSignature.subarray(32, 64)) + bytesToHex(pqcSignature)
    : '0x' + bytesToHex(pqcSignature);

  let v: number;
  if (isLegacy) {
    v = chainIdNum ? chainIdNum * 2 + 35 + recoveryId : recoveryId + 27;
  } else {
    v = recoveryId;
  }

  return {
    ...tx,
    r: rHex,
    s: sHex,
    v: '0x' + v.toString(16),
    pqcSignature: '0x' + bytesToHex(pqcSignature),
    signatureHex,
    classicSignatureHex: classicSignature ? '0x' + bytesToHex(classicSignature) : undefined,
    signingHashHex,
    preimageHex,
    preimageBytes: preimage.length,
    classicSigBytes,
    pqcSigBytes,
    totalSigBytes,
    publicKeyBytes,
    signDurationMs,
  };
  }
}

function parseHexOrDec(value: unknown): number {
  if (value === undefined || value === null || value === '' || value === '0x') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const str = String(value).trim();
  const parsed = str.startsWith('0x') || str.startsWith('0X') ? parseInt(str, 16) : Number(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Assina e serializa a transação completa no formato RLP, gerando telemetria detalhada.
 */
export async function internalSignAndSerializeTx(
  tx: TxParams,
  account: KeyringAccount,
): Promise<SerializedTxResult> {
  const signedTxData = await signTransactionCore(tx, account);
  const fullSigBytes = hexToBytes(signedTxData.signatureHex.slice(2));

  const serializedTx = serializeTransaction(
    signedTxData,
    signedTxData.v,
    signedTxData.r,
    signedTxData.s,
    account,
    fullSigBytes,
  );

  const serializedBytes = hexToBytes(serializedTx.startsWith('0x') ? serializedTx.slice(2) : serializedTx);
  const txHash = '0x' + bytesToHex(keccak_256(serializedBytes));

  const effectiveType = signedTxData.type ?? tx.type;
  const envelopeType = formatEnvelopeHex(effectiveType);
  const envelopeLabel = envelopeTypeLabel(effectiveType);
  const dsaCode = dsaTypeForAccount(account.options);
  const dsaTypeHex = '0x' + dsaCode.toString(16).padStart(4, '0');
  const dsaName = dsaNameForCode(dsaCode);

  const calldataStats = countCalldataBytes(tx.data);
  const dsaBaseGas = getBaseGasForAccount(account.options, effectiveType);
  const calldataFloorGas = calculateCalldataFloor(dsaBaseGas, tx.data);
  const intrinsicGasMin = calculateIntrinsicGas(signedTxData as TxParams, account.options);
  const gasLimitDec = parseHexOrDec(signedTxData.gasLimit ?? signedTxData.gas ?? tx.gasLimit ?? tx.gas);

  const publicKeyBytes = signedTxData.publicKeyBytes ?? 0;
  const classicSigBytes = signedTxData.classicSigBytes ?? 0;
  const pqcSigBytes = signedTxData.pqcSigBytes ?? 0;
  const totalSigBytes = signedTxData.totalSigBytes ?? fullSigBytes.length;
  const preimageBytes = signedTxData.preimageBytes ?? 0;
  const signDurationMs = signedTxData.signDurationMs ?? 1;
  const signingHashHex = signedTxData.signingHashHex || '';
  const preimageHex = signedTxData.preimageHex || '';

  const steps: TxStepLog[] = [
    {
      step: 1,
      label: 'Preimage & Hash (Keccak-256)',
      detail: `Preimage RLP: ${preimageBytes} B | Hash: ${signingHashHex.slice(0, 14)}...`,
      status: 'ok',
    },
    {
      step: 2,
      label: `Assinatura Criptográfica (${dsaName})`,
      detail: `Assinatura gerada (${totalSigBytes} B: ${classicSigBytes} B ECDSA + ${pqcSigBytes} B PQC)`,
      durationMs: signDurationMs,
      status: 'ok',
    },
    {
      step: 3,
      label: `Serialização RLP (${envelopeType})`,
      detail: `Envelope final: ${serializedBytes.length} bytes (Chave pública embutida: ${publicKeyBytes} B)`,
      status: 'ok',
    },
  ];

  const telemetry: TxTelemetry = {
    id: txHash || `tx-${Date.now()}`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    envelopeType,
    envelopeLabel,
    accountAddress: account.address,
    accountTypeLabel: accountTypeLabel(account.options),
    dsaTypeHex,
    dsaName,
    to: tx.to || 'Criação de Contrato',
    valueEth: formatWeiHexToEth(tx.value),
    valueHex: tx.value || '0x0',
    nonceDec: parseHexOrDec(tx.nonce),
    chainIdDec: parseHexOrDec(tx.chainId),
    publicKeyBytes,
    classicSigBytes,
    pqcSigBytes,
    totalSigBytes,
    preimageBytes,
    serializedTxBytes: serializedBytes.length,
    calldataBytes: {
      zero: calldataStats.zeroBytes,
      nonZero: calldataStats.nonZeroBytes,
      total: calldataStats.zeroBytes + calldataStats.nonZeroBytes,
    },
    dsaBaseGas,
    calldataFloorGas,
    intrinsicGasMin,
    gasLimitDec,
    receiptStatus: 'pending',
    signDurationMs,
    signingHashHex,
    preimageHex,
    classicSignatureHex: signedTxData.classicSignatureHex,
    pqcSignatureHex:
      signedTxData.pqcSignature && signedTxData.pqcSignature !== '0x'
        ? signedTxData.pqcSignature
        : undefined,
    serializedTxHex: serializedTx,
    txHash,
    accessListJson:
      Array.isArray(tx.accessList) && tx.accessList.length > 0
        ? JSON.stringify(tx.accessList)
        : undefined,
    authorizationListJson:
      Array.isArray(signedTxData.authorizationList) && signedTxData.authorizationList.length > 0
        ? JSON.stringify(signedTxData.authorizationList)
        : undefined,
    steps,
  };

  return { serializedTx, txHash, signatureHex: signedTxData.signatureHex, telemetry };
}
