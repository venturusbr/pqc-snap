import type { KeyringAccount } from '@metamask/keyring-api';
import {
  deriveChildSeed,
  deriveChildSeedV2,
  deriveBip44EcdsaKey,
  deriveEcdsaSeed,
  legacyMnemonicToMasterSeed,
  mnemonicToMasterSeed,
  hexToBytes,
  wipeBytes,
} from '../crypto';
import { getState } from '../ui/helpers/stateHelper';

export type AccountSecrets = {
  /** Semente de 32 bytes das chaves PQC/híbridas (vazia em contas ECDSA puras). */
  seedBytes: Uint8Array;
  /** Chave privada secp256k1 da conta (BIP-44 em contas ECDSA; sub-semente com domínio nas híbridas). */
  ecdsaKey: Uint8Array;
  /** Zera todos os buffers secretos. Chame em `finally` após assinar. */
  dispose: () => void;
};

/**
 * Resolve, sob demanda, o material secreto de uma conta a partir da frase mnemônica guardada no estado
 * criptografado do Snap (nunca exposto nos objetos de conta devolvidos ao MetaMask).
 *
 * Esquemas (ver CURRENT_DERIVATION_VERSION em crypto/keys.ts):
 * - Conta ECDSA real (`isEcdsa`): BIP-39 (PBKDF2) -> BIP-32 -> m/44'/60'/0'/0/i. Sem material PQC.
 * - Conta PQC/híbrida v2: HMAC com domínio sobre a semente BIP-39, independente da chave ECDSA BIP-44.
 * - Conta PQC/híbrida v1 (legada, sem `derivationVersion`): entropia crua + HMAC-SHA256 do caminho.
 * - Contas muito antigas que ainda carregam `privateKeySeed` continuam funcionando.
 */
export async function resolveAccountSecrets(account: KeyringAccount): Promise<AccountSecrets> {
  const options = (account.options ?? {}) as Record<string, any>;

  const legacySeedHex = options.privateKeySeed as string | undefined;
  if (legacySeedHex) {
    const seedBytes = hexToBytes(legacySeedHex);
    const ecdsaKey = deriveEcdsaSeed(seedBytes);
    return { seedBytes, ecdsaKey, dispose: () => wipeBytes(seedBytes, ecdsaKey) };
  }

  const index = options.derivationIndex;
  if (typeof index !== 'number') {
    throw new Error('Conta sem índice de derivação.');
  }
  if (!options.isEcdsa && !options.isPQC && !options.isHybrid) {
    throw new Error('Conta ECDSA simulada (legada) não possui chave e não pode assinar. Crie uma conta ECDSA real.');
  }

  const { mnemonic } = await getState();
  if (!mnemonic) {
    throw new Error('Frase mnemônica não encontrada no estado do Snap.');
  }

  const version = options.derivationVersion ?? 1;

  if (options.isEcdsa) {
    if (version < 2) throw new Error('Conta ECDSA com versão de derivação inválida.');
    const masterSeed = mnemonicToMasterSeed(mnemonic);
    try {
      const ecdsaKey = deriveBip44EcdsaKey(masterSeed, index);
      const seedBytes = new Uint8Array(0);
      return { seedBytes, ecdsaKey, dispose: () => wipeBytes(ecdsaKey) };
    } finally {
      wipeBytes(masterSeed);
    }
  }

  const masterSeed = version >= 2 ? mnemonicToMasterSeed(mnemonic) : legacyMnemonicToMasterSeed(mnemonic);
  try {
    const seedBytes = version >= 2 ? deriveChildSeedV2(masterSeed, index) : deriveChildSeed(masterSeed, index);
    const ecdsaKey = deriveEcdsaSeed(seedBytes);
    return { seedBytes, ecdsaKey, dispose: () => wipeBytes(seedBytes, ecdsaKey) };
  } finally {
    wipeBytes(masterSeed);
  }
}
