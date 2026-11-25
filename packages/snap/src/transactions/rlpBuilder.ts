import type { KeyringAccount } from '@metamask/keyring-api';
import { hexToBytes, bytesToHex, concatBytes } from '../crypto/utils';
import { toBuffer, toAddress, shortToBytes, encodeRLP } from './rlp';
import { TxEnvelopeType, normalizeTxType, dsaTypeForAccount } from './types';

/**
 * Extrai a chave pública quântica (1312 bytes de ML-DSA-44) da conta.
 */
export function extractPqcPublicKey(account: KeyringAccount): Uint8Array {
  const compositePkHex = (account.options?.publicKey as string) || '';
  const compositePkBytes = hexToBytes(compositePkHex);
  if (account.options?.isHybrid) {
    return compositePkBytes.length === 1377 ? compositePkBytes.subarray(65) : compositePkBytes.subarray(64);
  }
  return compositePkBytes;
}

/**
 * Formata a AccessList para o padrão de listas RLP.
 */
export function formatAccessListForRlp(accessList: any[] = []): any[] {
  return accessList.map((item: any) => [
    toAddress(item.address),
    (item.storageKeys || []).map((k: any) => toBuffer(k)),
  ]);
}

export interface BuildRlpOptions {
  isPreimage?: boolean;
  v?: any;
  r?: any;
  s?: any;
  account?: KeyringAccount;
  signatureBytes?: Uint8Array;
}

/**
 * Constrói de forma unificada o payload RLP para todos os 7 tipos de transações EVM / Besu PQC:
 * - 0x00 (Legacy)
 * - 0x01 (EIP-2930 Access List)
 * - 0x02 (EIP-1559 Fee Market)
 * - 0x04 (EIP-7702 Delegation)
 * - 0x41 (Besu Flexible Access List PQC)
 * - 0x42 (Besu Flexible EIP-1559 PQC)
 * - 0x44 (Besu Flexible Delegation PQC)
 */
export function buildTxRlp(tx: any, opts: BuildRlpOptions = {}): Uint8Array {
  const type = normalizeTxType(tx.type);
  const isPqc =
    type === TxEnvelopeType.FLEXIBLE_ACCESS_LIST ||
    type === TxEnvelopeType.FLEXIBLE_EIP1559 ||
    type === TxEnvelopeType.FLEXIBLE_DELEGATION;

  const accessList = formatAccessListForRlp(tx.accessList || []);
  // The signing preimage and the wire encoding use different authorization-list layouts
  // (see transactions/authorization.ts); only the preimage may use the "ForSigning" form.
  const authList = opts.isPreimage
    ? tx.authorizationListForSigning || tx.authorizationList || []
    : tx.authorizationList || [];

  let rlpItems: any[] = [];

  if (isPqc) {
    const account = opts.account;
    if (!account) {
      throw new Error(`A conta é obrigatória para montar transações PQC (${type}).`);
    }
    const dsaType = dsaTypeForAccount(account.options);
    const pqcPublicKey = extractPqcPublicKey(account);

    rlpItems = [
      shortToBytes(dsaType),
      toBuffer(tx.chainId),
      toBuffer(tx.nonce),
    ];

    if (type === TxEnvelopeType.FLEXIBLE_ACCESS_LIST) {
      rlpItems.push(toBuffer(tx.gasPrice));
    } else {
      rlpItems.push(
        toBuffer(tx.maxPriorityFeePerGas || tx.gasPrice),
        toBuffer(tx.maxFeePerGas || tx.gasPrice),
      );
    }

    rlpItems.push(
      toBuffer(tx.gasLimit || tx.gas),
      toAddress(tx.to),
      toBuffer(tx.value),
      toBuffer(tx.data),
      accessList,
    );

    if (type === TxEnvelopeType.FLEXIBLE_DELEGATION) {
      rlpItems.push(authList);
    }

    rlpItems.push(toBuffer(pqcPublicKey));

    if (!opts.isPreimage) {
      rlpItems.push(toBuffer(opts.signatureBytes || new Uint8Array(0)));
    }

    const encoded = encodeRLP(rlpItems);
    return concatBytes(new Uint8Array([type]), encoded);
  }

  // --- Transações Clássicas / EIPs Padrão ---
  if (type === TxEnvelopeType.LEGACY) {
    rlpItems = [
      toBuffer(tx.nonce),
      toBuffer(tx.gasPrice),
      toBuffer(tx.gasLimit || tx.gas),
      toAddress(tx.to),
      toBuffer(tx.value),
      toBuffer(tx.data),
    ];

    if (opts.isPreimage) {
      rlpItems.push(toBuffer(tx.chainId || 1), toBuffer(0), toBuffer(0));
    } else {
      rlpItems.push(toBuffer(opts.v), toBuffer(opts.r), toBuffer(opts.s));
    }

    return encodeRLP(rlpItems);
  }

  // EIP-2930 (0x01), EIP-1559 (0x02), EIP-7702 (0x04)
  rlpItems = [
    toBuffer(tx.chainId),
    toBuffer(tx.nonce),
  ];

  if (type === TxEnvelopeType.ACCESS_LIST) {
    rlpItems.push(toBuffer(tx.gasPrice));
  } else {
    rlpItems.push(
      toBuffer(tx.maxPriorityFeePerGas || tx.gasPrice),
      toBuffer(tx.maxFeePerGas || tx.gasPrice),
    );
  }

  rlpItems.push(
    toBuffer(tx.gasLimit || tx.gas),
    toAddress(tx.to),
    toBuffer(tx.value),
    toBuffer(tx.data),
    accessList,
  );

  if (type === TxEnvelopeType.EIP7702) {
    rlpItems.push(authList);
  }

  if (!opts.isPreimage) {
    rlpItems.push(toBuffer(opts.v), toBuffer(opts.r), toBuffer(opts.s));
  }

  const encoded = encodeRLP(rlpItems);
  return concatBytes(new Uint8Array([type]), encoded);
}

/**
 * Calcula a preimage de assinatura RLP para qualquer um dos 7 tipos de transações.
 */
export function computeTransactionPreimage(tx: any, account?: KeyringAccount): Uint8Array {
  return buildTxRlp(tx, { isPreimage: true, account });
}

/**
 * Serializa qualquer transação final assinada para string hexadecimal RLP (0x...).
 */
export function serializeTransaction(
  tx: any,
  v: any,
  r: any,
  s: any,
  account?: KeyringAccount,
  signatureBytes?: Uint8Array,
): string {
  const rawBytes = buildTxRlp(tx, {
    isPreimage: false,
    v,
    r,
    s,
    account,
    signatureBytes,
  });
  return '0x' + bytesToHex(rawBytes);
}
