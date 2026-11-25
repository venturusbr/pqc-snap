import type { KeyringAccount } from '@metamask/keyring-api';
import type { TxTelemetry } from './transaction';

export type TabType = 'menu' | 'accounts' | 'manage' | 'dsa' | 'tx' | 'contracts' | 'logs';

/**
 * Estrutura do estado persistido internamente no Snap.
 */
export type SnapState = {
  accounts: KeyringAccount[];
  mnemonic?: string;
  dsaRpcUrl?: string;
  supportedDSAs?: any[];
  dsaError?: string;
  selectedAccountAddress?: string;
  selectedTxType?: string;
  txRecipient?: string;
  txAmountEth?: string;
  txData?: string;
  lastTxHash?: string;
  lastTxAccessList?: string;
  lastTxStatus?: string;
  lastTxTelemetry?: TxTelemetry;
  activeTab?: TabType;
  generalContractAddress?: string;
  generalCalldata?: string;
  lastGeneralTxHash?: string;
  lastGeneralTxStatus?: string;
  lastGeneralAccessList?: string;
  lastGeneralTxTelemetry?: TxTelemetry;
  txHistory?: TxTelemetry[];
  selectedLogId?: string;
  txRecipientPreset?: string;
  txCalldataPreset?: string;
  delegatedBytecodeDisplay?: string;
  contractCounterDisplay?: string;
  ethBalanceDisplay?: string;
  blobRelayerUrl?: string;
  blobRecipient?: string;
  blobAmountEth?: string;
  lastBlobVersionedHash?: string;
};
