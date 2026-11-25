import type { Keyring, KeyringAccount, KeyringRequest, KeyringResponse } from '@metamask/keyring-api';
import { v4 as uuid } from 'uuid';
import { keccak_256 } from '@noble/hashes/sha3';
import {
  hexToBytes,
  bytesToHex,
  concatBytes,
  deriveChildSeedV2,
  deriveBip44EcdsaKey,
  ethAddressFromEcdsaKey,
  wipeBytes,
  CURRENT_DERIVATION_VERSION,
  createClassicSignature,
  mnemonicToMasterSeed,
  deriveHybridKeysAndAddress,
  derivePurePqcKeysAndAddress,
  signHybridPayload,
  signPqcPayload,
  accountPqcAlgorithm,
  type PqcAlgorithm,
} from '../crypto';
import { signTransactionCore } from '../transactions';
import { resolveAccountSecrets } from '../transactions/seed';
import { getState, updateState, showPrompt, showConfirm, renderTxDetails } from '../ui/helpers';
import { Box, Text, Bold } from '@metamask/snaps-sdk/jsx';

/** Remove material secreto das opções da conta antes de expô-la/persisti-la. */
function stripSecrets(account: KeyringAccount): KeyringAccount {
  if (!account.options || !('privateKeySeed' in account.options)) return account;
  const { privateKeySeed, ...safeOptions } = account.options as Record<string, any>;
  return { ...account, options: safeOptions };
}

export class PqcKeyring implements Keyring {
  async listAccounts(): Promise<KeyringAccount[]> {
    const state = await getState();
    const accounts = state.accounts || [];
    if (!accounts.some((a) => a.options && 'privateKeySeed' in a.options)) {
      return accounts;
    }
    // Migração: remove sementes legadas do objeto da conta (são re-derivadas da mnemônica sob demanda).
    const stripped = accounts.map(stripSecrets);
    if (state.mnemonic) {
      await updateState({ accounts: stripped });
    }
    return stripped;
  }

  async createAccount(options: Record<string, any> = {}): Promise<KeyringAccount> {
    const state = await getState();
    const mnemonic = state.mnemonic;
    if (!mnemonic) {
      throw new Error('Nenhuma carteira configurada. Inicialize a carteira primeiro.');
    }

    let choice = options?.choice ? String(options.choice) : options?.type ? String(options.type) : null;
    if (!choice) {
      choice = await showPrompt(
        'Derivar Nova Conta',
        'Digite 1 para ECDSA, 2 para ML-DSA-44 (PQC), 3 para Híbrida ECDSA + ML-DSA-44, 4 para Híbrida ECDSA + Falcon-512 ou 5 para Falcon-512 (PQC):',
        '3',
      );
    }

    if (!choice || !['1', '2', '3', '4', '5'].includes(choice)) {
      throw new Error('Criação cancelada.');
    }

    const accounts = state.accounts || [];
    const indices = accounts
      .map((a) => a.options?.derivationIndex)
      .filter((idx) => typeof idx === 'number') as number[];
    const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 0;

    const masterSeed = mnemonicToMasterSeed(mnemonic);
    let seedBytes: Uint8Array | undefined;
    let newAccount: KeyringAccount;

    const pqcAlgorithm: PqcAlgorithm = choice === '4' || choice === '5' ? 'FALCON512' : 'MLDSA44';
    const derivationVersion = CURRENT_DERIVATION_VERSION;

    try {
      if (choice === '1') {
        // ECDSA real: BIP-39 -> BIP-32 -> m/44'/60'/0'/0/i (mesmo endereço do MetaMask/Ledger para a mesma frase).
        const ecdsaKey = deriveBip44EcdsaKey(masterSeed, nextIndex);
        try {
          const { address, publicKey } = ethAddressFromEcdsaKey(ecdsaKey);
          newAccount = {
            id: uuid(),
            options: {
              isPQC: false,
              isHybrid: false,
              isEcdsa: true,
              publicKey: bytesToHex(publicKey),
              derivationIndex: nextIndex,
              derivationVersion,
            },
            address,
            methods: ['personal_sign', 'eth_signTransaction'],
            type: 'eip155:eoa',
            scopes: ['eip155:0'],
          };
        } finally {
          wipeBytes(ecdsaKey);
        }
      } else if (choice === '2' || choice === '5') {
        seedBytes = deriveChildSeedV2(masterSeed, nextIndex);
        const { derivedAddress, pqcPublicKeyHex } = await derivePurePqcKeysAndAddress(seedBytes, pqcAlgorithm);
        newAccount = {
          id: uuid(),
          options: { isPQC: true, isHybrid: false, pqcAlgorithm, publicKey: pqcPublicKeyHex, derivationIndex: nextIndex, derivationVersion },
          address: derivedAddress,
          methods: ['personal_sign', 'eth_signTransaction'],
          type: 'eip155:eoa',
          scopes: ['eip155:0'],
        };
      } else {
        seedBytes = deriveChildSeedV2(masterSeed, nextIndex);
        const { derivedAddress, compositePublicKeyHex } = await deriveHybridKeysAndAddress(seedBytes, pqcAlgorithm);
        newAccount = {
          id: uuid(),
          options: { isPQC: false, isHybrid: true, pqcAlgorithm, publicKey: compositePublicKeyHex, derivationIndex: nextIndex, derivationVersion },
          address: derivedAddress,
          methods: ['personal_sign', 'eth_signTransaction'],
          type: 'eip155:eoa',
          scopes: ['eip155:0'],
        };
      }
    } finally {
      wipeBytes(masterSeed, seedBytes);
    }

    const finalAccounts = [...accounts, newAccount];
    await updateState({ accounts: finalAccounts, selectedAccountAddress: newAccount.address });

    try {
      await snap.request({
        method: 'snap_manageAccounts',
        params: { method: 'notify:accountCreated', params: { account: newAccount } },
      });
    } catch (error: any) {
      const errMessage = typeof error === 'string' ? error : error?.message || JSON.stringify(error) || '';
      if (!/duplicate|already exists|keyringcontroller/i.test(errMessage)) {
        console.error('Erro no notify:accountCreated:', error);
      }
    }

    return newAccount;
  }

  async getAccount(id: string): Promise<KeyringAccount | undefined> {
    const accounts = await this.listAccounts();
    return accounts.find((a) => a.id === id);
  }

  async filterAccountChains(id: string, chains: string[]): Promise<string[]> {
    return chains;
  }
  async updateAccount(account: KeyringAccount): Promise<void> {}
  async deleteAccount(id: string): Promise<void> {}
  async listRequests(): Promise<any[]> { return []; }
  async getRequest(id: string): Promise<any> { return null; }

  async submitRequest(request: KeyringRequest): Promise<KeyringResponse> {
    const method = request.request.method;
    const params = request.request.params;

    if (method === 'personal_sign') {
      const message = params?.[0] as string;
      const address = params?.[1] as string;
      if (!message || !address) throw new Error('Parâmetros inválidos para personal_sign.');

      const accounts = await this.listAccounts();
      const account = accounts.find((a) => a.address.toLowerCase() === address.toLowerCase());
      if (!account) throw new Error(`Conta não encontrada: ${address}`);

      const messageBytes = message.startsWith('0x') ? hexToBytes(message) : new TextEncoder().encode(message);

      const approved = await showConfirm(
        'Assinar Mensagem PQC',
        <Box>
          <Text><Bold>Conta:</Bold> {account.address}</Text>
          <Text><Bold>Mensagem ({String(messageBytes.length)} bytes):</Bold> {message.length > 300 ? `${message.slice(0, 300)}…` : message}</Text>
        </Box>,
      );
      if (!approved) throw new Error('Assinatura rejeitada pelo usuário.');

      const secrets = await resolveAccountSecrets(account);
      let signatureHex: string;
      const pqcAlgorithm = accountPqcAlgorithm(account.options);

      try {
        if (account.options?.isEcdsa) {
          // EIP-191 personal_sign padrão: keccak256("\x19Ethereum Signed Message:\n" + len + msg), v = 27/28.
          const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${messageBytes.length}`);
          const digest = keccak_256(concatBytes(prefix, messageBytes));
          signatureHex = '0x' + bytesToHex(createClassicSignature(digest, secrets.ecdsaKey, true));
        } else if (account.options?.isHybrid) {
          const messageHash = keccak_256(messageBytes);
          const res = await signHybridPayload(messageHash, messageBytes, secrets.seedBytes, true, pqcAlgorithm);
          signatureHex = res.signatureHex;
        } else {
          const res = await signPqcPayload(messageBytes, secrets.seedBytes, pqcAlgorithm);
          signatureHex = res.signatureHex;
        }
      } finally {
        secrets.dispose();
      }

      return { pending: false, result: signatureHex };
    }

    if (method === 'eth_signTransaction') {
      const tx = params?.[0] as any;
      if (!tx?.from) throw new Error('Parâmetros inválidos para eth_signTransaction.');

      const accounts = await this.listAccounts();
      const account = accounts.find((a) => a.address.toLowerCase() === (tx.from as string).toLowerCase());
      if (!account) throw new Error(`Conta de origem não encontrada: ${tx.from}`);

      const approved = await showConfirm('Assinar Transação PQC', renderTxDetails(tx, undefined, account));
      if (!approved) throw new Error('Transação rejeitada pelo usuário.');

      const txData = await signTransactionCore(tx, account);
      return { pending: false, result: txData };
    }

    throw new Error(`Método Keyring submitRequest não suportado: ${method}`);
  }

  async approveRequest(id: string, data?: any): Promise<void> {}
  async rejectRequest(id: string): Promise<void> {}
}

export const pqcKeyring = new PqcKeyring();
