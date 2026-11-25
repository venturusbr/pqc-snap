export type AccessListItem = {
  address: string;
  storageKeys: string[];
};

export type AccessList = AccessListItem[];

export type AuthorizationListItem = {
  chainId: string | number;
  address: string;
  nonce: string | number;
  yParity?: number;
  r?: string;
  s?: string;
};

export type TxParams = {
  from: string;
  to?: string;
  value?: string;
  nonce?: string;
  gasLimit?: string;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  chainId?: string | number;
  data?: string;
  type?: string | number;
  accessList?: AccessList;
  authorizationList?: AuthorizationListItem[];
  authorizationListForSigning?: any[];
  [key: string]: any;
};

export type TxStepLog = {
  step: number;
  label: string;
  detail: string;
  durationMs?: number;
  status: 'ok' | 'warn' | 'error';
};

export type TxTelemetry = {
  id: string;
  timestamp: string;
  envelopeType: string;
  envelopeLabel: string;
  accountAddress: string;
  accountTypeLabel: string;
  dsaTypeHex: string;
  dsaName: string;
  to: string;
  valueEth: string;
  valueHex: string;
  nonceDec: number;
  chainIdDec: number;
  // Tamanhos em Bytes
  publicKeyBytes: number;
  classicSigBytes: number;
  pqcSigBytes: number;
  totalSigBytes: number;
  preimageBytes: number;
  serializedTxBytes: number;
  calldataBytes: { zero: number; nonZero: number; total: number };
  // Gas (Besu PR 55)
  dsaBaseGas: number;
  calldataFloorGas: number;
  intrinsicGasMin: number;
  gasLimitDec: number;
  gasUsedDec?: number;
  blockNumberDec?: number;
  receiptStatus?: 'pending' | 'success' | 'reverted' | 'error';
  // Tempos (ms)
  signDurationMs: number;
  totalDurationMs?: number;
  // Artefatos Hex Copyable
  signingHashHex: string;
  preimageHex: string;
  classicSignatureHex?: string;
  pqcSignatureHex?: string;
  serializedTxHex: string;
  txHash: string;
  accessListJson?: string;
  authorizationListJson?: string;
  steps: TxStepLog[];
};

export type SignedTxData = {
  nonce?: string;
  gasLimit?: string;
  to?: string;
  value?: string;
  data?: string;
  chainId?: string | number;
  type?: string | number;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  accessList?: AccessList;
  authorizationList?: AuthorizationListItem[];
  r: string;
  s: string;
  v: string;
  pqcSignature: string;
  signatureHex: string;
  classicSignatureHex?: string;
  signingHashHex?: string;
  preimageHex?: string;
  preimageBytes?: number;
  classicSigBytes?: number;
  pqcSigBytes?: number;
  totalSigBytes?: number;
  publicKeyBytes?: number;
  signDurationMs?: number;
};

export type SerializedTxResult = {
  serializedTx: string;
  txHash: string;
  signatureHex?: string;
  telemetry?: TxTelemetry;
};
