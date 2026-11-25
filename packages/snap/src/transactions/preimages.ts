import type { KeyringAccount } from '@metamask/keyring-api';
import { extractPqcPublicKey, formatAccessListForRlp, computeTransactionPreimage } from './rlpBuilder';

export { extractPqcPublicKey, formatAccessListForRlp, computeTransactionPreimage };

export function computeFlexibleEIP1559Preimage(tx: any, account: KeyringAccount): Uint8Array {
  return computeTransactionPreimage({ ...tx, type: 0x42 }, account);
}

export function computeFlexibleAccessListPreimage(tx: any, account: KeyringAccount): Uint8Array {
  return computeTransactionPreimage({ ...tx, type: 0x41 }, account);
}

export function computeFlexibleDelegationPreimage(tx: any, account: KeyringAccount): Uint8Array {
  return computeTransactionPreimage({ ...tx, type: 0x44 }, account);
}
