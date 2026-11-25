import type { KeyringAccount } from '@metamask/keyring-api';
import {
  DSA_BASE_GAS,
  DSA_ESTIMATE_GAS_OVERHEAD,
  dsaTypeForAccount,
  isFlexibleTxType,
} from './types';
import type { TxParams } from '../types';

export const STANDARD_BASE_GAS = 21000;
export const ACCESS_LIST_ADDRESS_GAS = 2400;
export const ACCESS_LIST_STORAGE_KEY_GAS = 1900;
export const CONTRACT_CREATION_GAS = 32000;
export const EIP7702_AUTHORIZATION_GAS = 25000;

/**
 * Retorna o custo de gas base para um determinado dsaType conforme PR 55 do Besu.
 */
export function getBaseGasForDsa(dsaType: number): number {
  return DSA_BASE_GAS[dsaType] ?? STANDARD_BASE_GAS;
}

/**
 * Retorna o custo de gas base de uma transação considerando a conta (PQC pura, híbrida, clássica) e o tipo do envelope.
 * Transações flexíveis (0x41, 0x42, 0x44) pagam o custo base do seu dsaType.
 * Transações clássicas (0x00, 0x01, 0x02, 0x04) pagam 21.000.
 */
export function getBaseGasForAccount(
  accountOptions: Record<string, any> | undefined,
  txType?: string | number,
): number {
  if (isFlexibleTxType(txType)) {
    const dsaType = dsaTypeForAccount(accountOptions);
    return getBaseGasForDsa(dsaType);
  }
  return STANDARD_BASE_GAS;
}

/**
 * Retorna o overhead em relação a 21.000 a ser somado no resultado do eth_estimateGas.
 * Conforme nota do PR 55: como eth_estimateGas não conhece dsaType, o nó simula
 * como transação padrão (base 21.000), ficando a estimativa defasada em (baseCost - 21.000).
 */
export function getEstimateGasOverhead(
  accountOptions: Record<string, any> | undefined,
  txType?: string | number,
): number {
  if (isFlexibleTxType(txType)) {
    const dsaType = dsaTypeForAccount(accountOptions);
    return DSA_ESTIMATE_GAS_OVERHEAD[dsaType] ?? (getBaseGasForDsa(dsaType) - STANDARD_BASE_GAS);
  }
  return 0;
}

/**
 * Converte calldata hex ou Uint8Array em contagem de bytes zero e não-zero.
 */
export function countCalldataBytes(data?: Uint8Array | string): { zeroBytes: number; nonZeroBytes: number } {
  if (!data) return { zeroBytes: 0, nonZeroBytes: 0 };
  let bytes: Uint8Array;
  if (typeof data === 'string') {
    const clean = data.startsWith('0x') ? data.slice(2) : data;
    if (clean.length === 0) return { zeroBytes: 0, nonZeroBytes: 0 };
    const padded = clean.length % 2 !== 0 ? '0' + clean : clean;
    const len = padded.length / 2;
    bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
    }
  } else {
    bytes = data;
  }

  let zeroBytes = 0;
  let nonZeroBytes = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      zeroBytes++;
    } else {
      nonZeroBytes++;
    }
  }
  return { zeroBytes, nonZeroBytes };
}

/**
 * Calcula o calldata floor (EIP-7623 modificado a partir de Prague para transações flexíveis no Besu PR 55):
 * floor = base cost + 10 x tokens, onde byte não-zero = 4 tokens (40 gas) e byte zero = 1 token (10 gas).
 * Apenas os dados de calldata contam como tokens.
 */
export function calculateCalldataFloor(baseCost: number, data?: Uint8Array | string): number {
  const { zeroBytes, nonZeroBytes } = countCalldataBytes(data);
  const tokens = nonZeroBytes * 4 + zeroBytes * 1;
  return baseCost + 10 * tokens;
}

/**
 * Calcula o custo intrínseco de execução padrão (base cost + calldata + accessList + creation + authList).
 */
export function calculateStandardExecutionGas(
  baseCost: number,
  data?: Uint8Array | string,
  accessList?: any[],
  isContractCreation?: boolean,
  authorizationList?: any[],
): number {
  const { zeroBytes, nonZeroBytes } = countCalldataBytes(data);
  let gas = baseCost + nonZeroBytes * 16 + zeroBytes * 4;

  if (isContractCreation) {
    gas += CONTRACT_CREATION_GAS;
  }

  if (Array.isArray(accessList)) {
    for (const item of accessList) {
      gas += ACCESS_LIST_ADDRESS_GAS;
      if (Array.isArray(item.storageKeys)) {
        gas += item.storageKeys.length * ACCESS_LIST_STORAGE_KEY_GAS;
      }
    }
  }

  if (Array.isArray(authorizationList)) {
    gas += authorizationList.length * EIP7702_AUTHORIZATION_GAS;
  }

  return gas;
}

/**
 * Calcula o gas intrínseco mínimo obrigatório de uma transação EVM / Besu PQC:
 * Math.max(standardExecutionGas, calldataFloor)
 */
export function calculateIntrinsicGas(
  tx: TxParams,
  accountOptions?: Record<string, any>,
): number {
  const baseCost = getBaseGasForAccount(accountOptions, tx.type);
  const isContractCreation = !tx.to || tx.to === '0x' || tx.to === '';
  const standardGas = calculateStandardExecutionGas(
    baseCost,
    tx.data,
    tx.accessList,
    isContractCreation,
    tx.authorizationList,
  );
  const floorGas = calculateCalldataFloor(baseCost, tx.data);

  return Math.max(standardGas, floorGas);
}

/**
 * Garante que o gasLimit da transação cubra pelo menos o gas intrínseco mínimo exigido
 * pelo nó Besu após o PR 55, evitando rejeição por INTRINSIC_GAS_EXCEEDS_GAS_LIMIT.
 */
export function ensureMinimumGasLimit(
  tx: TxParams,
  account?: KeyringAccount,
  executionBuffer = 50000,
): TxParams {
  const minRequired = calculateIntrinsicGas(tx, account?.options);

  let currentGasLimit: number | undefined;
  if (tx.gasLimit) {
    currentGasLimit = typeof tx.gasLimit === 'string' ? parseInt(tx.gasLimit, 16) : Number(tx.gasLimit);
  } else if (tx.gas) {
    currentGasLimit = typeof tx.gas === 'string' ? parseInt(tx.gas, 16) : Number(tx.gas);
  }

  // Se nenhum gasLimit foi definido, ou se o fornecido for inferior ao custo intrínseco mínimo:
  if (!currentGasLimit || currentGasLimit < minRequired) {
    const recommendedLimit = Math.max(minRequired + executionBuffer, currentGasLimit || 0, minRequired);
    return {
      ...tx,
      gasLimit: '0x' + recommendedLimit.toString(16),
      gas: '0x' + recommendedLimit.toString(16),
    };
  }

  return tx;
}

/**
 * Ajusta a estimativa de gas retornada pelo método JSON-RPC `eth_estimateGas`
 * para adicionar o overhead do dsaType em transações flexíveis.
 */
export function adjustEstimateGasForDsa(
  estimatedGasHexOrNumber: string | number | bigint,
  accountOptions?: Record<string, any>,
  txType?: string | number,
): string {
  const rawEst =
    typeof estimatedGasHexOrNumber === 'string'
      ? BigInt(estimatedGasHexOrNumber)
      : BigInt(estimatedGasHexOrNumber);
  const overhead = BigInt(getEstimateGasOverhead(accountOptions, txType));
  const total = rawEst + overhead;
  return '0x' + total.toString(16);
}
