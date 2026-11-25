export enum TxEnvelopeType {
  LEGACY = 0x00,
  ACCESS_LIST = 0x01,
  EIP1559 = 0x02,
  EIP7702 = 0x04,
  FLEXIBLE_ACCESS_LIST = 0x41, // Besu Flexible Access List (65)
  FLEXIBLE_EIP1559 = 0x42,     // Besu Flexible EIP-1559 (66)
  FLEXIBLE_DELEGATION = 0x44,  // Besu Flexible EIP-7702 (68)
}

export const DSA_TYPE_SECP256K1 = 0x0010;
export const DSA_TYPE_SECP256R1 = 0x0020;
export const DSA_TYPE_MLDSA = 0x0030;         // MLDSA44
export const DSA_TYPE_MLDSA65 = 0x0031;
export const DSA_TYPE_MLDSA87 = 0x0032;
export const DSA_TYPE_FALCON = 0x0040;        // FALCON512
export const DSA_TYPE_HYBRID = 0x0060;        // SECP256K1-MLDSA44
export const DSA_TYPE_HYBRID_FALCON = 0x0070; // SECP256K1-FALCON512

/**
 * Custos de gas base por tipo de DSA no Hyperledger Besu (a partir do hardfork Prague).
 * Conforme pull/55 (feat: charge flexible transactions a base gas cost per DSA type).
 * Substitui o valor fixo tradicional de 21.000 para transações flexíveis.
 */
export const DSA_BASE_GAS: Record<number, number> = {
  [DSA_TYPE_SECP256K1]: 21000,
  [DSA_TYPE_SECP256R1]: 31629,
  [DSA_TYPE_MLDSA]: 82553,
  [DSA_TYPE_MLDSA65]: 110047,
  [DSA_TYPE_MLDSA87]: 147047,
  [DSA_TYPE_FALCON]: 46511,
  [DSA_TYPE_HYBRID]: 86102,        // SECP256K1-MLDSA44
  [DSA_TYPE_HYBRID_FALCON]: 50369, // SECP256K1-FALCON512
};

/**
 * Diferença de gas (overhead) de cada algoritmo em relação ao gas base padrão (21.000).
 * Usado para ajustar a estimativa retornada por eth_estimateGas (já que a chamada nativa simula transação comum).
 */
export const DSA_ESTIMATE_GAS_OVERHEAD: Record<number, number> = {
  [DSA_TYPE_SECP256K1]: 0,
  [DSA_TYPE_SECP256R1]: 10629,
  [DSA_TYPE_MLDSA]: 61553,
  [DSA_TYPE_MLDSA65]: 89047,
  [DSA_TYPE_MLDSA87]: 126047,
  [DSA_TYPE_FALCON]: 25511,
  [DSA_TYPE_HYBRID]: 65102,        // SECP256K1-MLDSA44 (+65.102)
  [DSA_TYPE_HYBRID_FALCON]: 29369, // SECP256K1-FALCON512 (+29.369)
};

/**
 * Resolve o dsaType (DSAParametersSet do Besu) a partir do tipo da conta e do algoritmo PQC.
 * Contas sem `pqcAlgorithm` são anteriores ao suporte a Falcon e usam ML-DSA-44.
 */
export function dsaTypeForAccount(options: Record<string, any> | undefined): number {
  const isFalcon = options?.pqcAlgorithm === 'FALCON512';
  if (options?.isEcdsa) {
    return DSA_TYPE_SECP256K1;
  }
  if (options?.isHybrid) {
    return isFalcon ? DSA_TYPE_HYBRID_FALCON : DSA_TYPE_HYBRID;
  }
  return isFalcon ? DSA_TYPE_FALCON : DSA_TYPE_MLDSA;
}

export function normalizeTxType(type?: string | number): number {
  if (type === undefined || type === null || type === '0x' || type === '0x0') {
    return TxEnvelopeType.LEGACY;
  }
  if (typeof type === 'string') {
    return parseInt(type, 16);
  }
  return type;
}

export function isFlexibleTxType(type?: string | number): boolean {
  const norm = normalizeTxType(type);
  return (
    norm === TxEnvelopeType.FLEXIBLE_ACCESS_LIST ||
    norm === TxEnvelopeType.FLEXIBLE_EIP1559 ||
    norm === TxEnvelopeType.FLEXIBLE_DELEGATION
  );
}

/**
 * Retorna o nome legível e código hex do DSA utilizado pelo Besu.
 */
export function dsaNameForCode(dsaType: number): string {
  switch (dsaType) {
    case DSA_TYPE_SECP256K1:
      return 'SECP256K1 (0x0010)';
    case DSA_TYPE_SECP256R1:
      return 'SECP256R1 (0x0020)';
    case DSA_TYPE_MLDSA:
      return 'ML-DSA-44 (0x0030)';
    case DSA_TYPE_MLDSA65:
      return 'ML-DSA-65 (0x0031)';
    case DSA_TYPE_MLDSA87:
      return 'ML-DSA-87 (0x0032)';
    case DSA_TYPE_FALCON:
      return 'FALCON-512 (0x0040)';
    case DSA_TYPE_HYBRID:
      return 'SECP256K1 + ML-DSA-44 (0x0060)';
    case DSA_TYPE_HYBRID_FALCON:
      return 'SECP256K1 + FALCON-512 (0x0070)';
    default:
      return '0x' + dsaType.toString(16).padStart(4, '0');
  }
}

/**
 * Retorna o rótulo legível de um tipo de envelope de transação.
 */
export function envelopeTypeLabel(type?: string | number): string {
  const norm = normalizeTxType(type);
  switch (norm) {
    case TxEnvelopeType.LEGACY:
      return 'Legacy (0x00)';
    case TxEnvelopeType.ACCESS_LIST:
      return 'EIP-2930 Access List (0x01)';
    case TxEnvelopeType.EIP1559:
      return 'EIP-1559 Dynamic Fee (0x02)';
    case TxEnvelopeType.EIP7702:
      return 'EIP-7702 Code Delegation (0x04)';
    case TxEnvelopeType.FLEXIBLE_ACCESS_LIST:
      return 'Flexible Access List PQC (0x41)';
    case TxEnvelopeType.FLEXIBLE_EIP1559:
      return 'Flexible EIP-1559 PQC (0x42)';
    case TxEnvelopeType.FLEXIBLE_DELEGATION:
      return 'Flexible Code Delegation PQC (0x44)';
    default:
      return `Envelope (${formatEnvelopeHex(type)})`;
  }
}

/**
 * Normaliza o tipo de envelope para string hexadecimal de 2 dígitos (ex: 0x42).
 */
export function formatEnvelopeHex(type?: string | number): string {
  const norm = normalizeTxType(type);
  return '0x' + norm.toString(16).padStart(2, '0');
}

/**
 * Estima o tamanho esperado da assinatura (em bytes) para pré-visualização antes da assinatura.
 */
export function estimateExpectedSignatureBytes(
  options?: Record<string, any>,
  txType?: string | number,
): number {
  if (options?.isEcdsa || (!isFlexibleTxType(txType) && !options?.isHybrid && !options?.isPQC)) {
    return 65;
  }
  if (options?.isHybrid) {
    return options?.pqcAlgorithm === 'FALCON512' ? 731 : 2485;
  }
  return options?.pqcAlgorithm === 'FALCON512' ? 666 : 2420;
}
