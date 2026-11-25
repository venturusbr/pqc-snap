import type { KeyringAccount } from '@metamask/keyring-api';
import { keccak_256 } from '@noble/hashes/sha3';
import { hexToBytes, concatBytes } from '../crypto/utils';
import { createClassicSignature, pqcSign } from '../crypto/signatures';
import { deriveEcdsaSeed, derivePqcKeyPair, accountPqcAlgorithm } from '../crypto/keys';
import { toBuffer, toAddress, shortToBytes, encodeRLP } from './rlp';
import { extractPqcPublicKey } from './preimages';
import { dsaTypeForAccount } from './types';

/**
 * Assina automaticamente os itens da authorizationList (EIP-7702 PQC) gerando a estrutura RLP do FlexibleCodeDelegation:
 * Conforme CodeDelegationEncoder.java e FlexibleCodeDelegationEncoder.java do Besu:
 * Preimage = 0x05 || 0x01 || RLP([ 0x01 (FLEXIBLE), dsaType, chainId, address, nonce, pqcPublicKey ])
 * Item = 0x01 || RLP([ 0x01 (FLEXIBLE), dsaType, chainId, address, nonce, pqcPublicKey, signatureBytes ])
 */
export async function signAuthorizationList(
  authorizationList: any[] = [],
  seedBytes?: Uint8Array,
  account?: KeyringAccount,
  preDerivedPqcSecretKey?: Uint8Array,
): Promise<{ signedList: any[]; signedListForSigning: any[] }> {
  if (!authorizationList || authorizationList.length === 0) {
    return { signedList: [], signedListForSigning: [] };
  }

  const effectiveSeedBytes =
    seedBytes && seedBytes.length > 0
      ? seedBytes
      : account?.options?.privateKeySeed
      ? hexToBytes(account.options.privateKeySeed as string)
      : new Uint8Array(0);

  const ecdsaSeed = deriveEcdsaSeed(effectiveSeedBytes);
  const pqcAlgorithm = accountPqcAlgorithm(account?.options);
  const pqcSecretKey =
    preDerivedPqcSecretKey ??
    (effectiveSeedBytes.length > 0 ? derivePqcKeyPair(effectiveSeedBytes, pqcAlgorithm).secretKey : undefined);

  const pqcPublicKey = account ? extractPqcPublicKey(account) : new Uint8Array(0);
  const dsaType = dsaTypeForAccount(account?.options);
  const signedList: any[] = [];
  const signedListForSigning: any[] = [];

  for (const auth of authorizationList) {
    if (auth.signatureBytes || auth.v) {
      signedList.push(auth);
      signedListForSigning.push(auth);
      continue;
    }

    const chainIdBuf = toBuffer(auth.chainId);
    const addressBuf = toAddress(auth.address);
    const nonceBuf = toBuffer(auth.nonce);
    const codeDelegationTypeByte = new Uint8Array([0x01]); // CodeDelegationType.FLEXIBLE.getSerializedType()

    // 1. Preimage para o computeAuthority() do Besu:
    // MAGIC (0x05) || 0x01 || RLP([ 0x01, dsaType, chainId, address, nonce, pqcPublicKey ])
    const preimageRlp = encodeRLP([
      codeDelegationTypeByte,
      shortToBytes(dsaType),
      chainIdBuf,
      addressBuf,
      nonceBuf,
      toBuffer(pqcPublicKey),
    ]);
    const fullAuthPreimage = concatBytes(concatBytes(new Uint8Array([0x05]), codeDelegationTypeByte), preimageRlp);
    const authHash = keccak_256(fullAuthPreimage);

    let signatureBytes: Uint8Array;
    if (account?.options?.isHybrid) {
      // Assinatura Híbrida (ECDSA 65 bytes + ML-DSA-44 ou Falcon-512) com separação de domínio
      const classicSig = createClassicSignature(authHash, ecdsaSeed, false);
      const payloadForPqc = concatBytes(authHash, classicSig);
      signatureBytes = concatBytes(
        classicSig,
        await pqcSign(payloadForPqc, effectiveSeedBytes, pqcAlgorithm, pqcSecretKey),
      );
    } else {
      // Assinatura PQC Pura (ML-DSA-44 ou Falcon-512) com separação de domínio
      signatureBytes = await pqcSign(authHash, effectiveSeedBytes, pqcAlgorithm, pqcSecretKey);
    }

    // 2. Item opaco para a transmissão da transação ao Besu (FlexibleCodeDelegationDecoder.java):
    // 0x01 || RLP([ dsaType, chainId, address, nonce, pqcPublicKey, signatureBytes ])
    const itemRlpPayload = encodeRLP([
      shortToBytes(dsaType),
      chainIdBuf,
      addressBuf,
      nonceBuf,
      toBuffer(pqcPublicKey),
      signatureBytes,
    ]);
    const finalItemBytes = concatBytes(codeDelegationTypeByte, itemRlpPayload);
    signedList.push(finalItemBytes);

    // 3. Item para o cálculo da preimage da transação pai (CodeDelegationEncoder.encodeCodeDelegationInner no Besu):
    // [ 0x01, [ 0x01, dsaType, chainId, address, nonce, pqcPublicKey, signatureBytes ] ]
    const singleAuthItemForPreimage = [
      codeDelegationTypeByte,
      shortToBytes(dsaType),
      chainIdBuf,
      addressBuf,
      nonceBuf,
      toBuffer(pqcPublicKey),
      signatureBytes,
    ];
    signedListForSigning.push(codeDelegationTypeByte);
    signedListForSigning.push(singleAuthItemForPreimage);
  }

  return { signedList, signedListForSigning };
}
