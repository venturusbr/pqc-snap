import { describe, it, expect } from '@jest/globals';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { ml_dsa44 } from '@noble/post-quantum/ml-dsa.js';
import { falcon512 } from '@noble/post-quantum/falcon.js';
import { keccak_256 } from '@noble/hashes/sha3';
import {
  bytesToHex,
  hexToBytes,
  concatBytes,
  safeStringify,
  parseEthToWeiHex,
  parseBrlToCentavosHex,
  getSelector,
  getRoleHash,
  encodePingDelegation,
  deriveChildSeed,
  deriveChildSeedV2,
  deriveBip44EcdsaKey,
  ethAddressFromEcdsaKey,
  wipeBytes,
  generateMnemonic,
  validateMnemonic,
  mnemonicToMasterSeed,
  deriveEcdsaSeed,
  deriveMldsaSeed,
  deriveFalconSeed,
  deriveMldsaKeyPair,
  deriveFalconKeyPair,
  derivePqcKeyPair,
  derivePqcPublicKey,
  deriveHybridKeysAndAddress,
  derivePurePqcKeysAndAddress,
  accountPqcAlgorithm,
  accountTypeLabel,
  createClassicSignature,
  pqcSign,
  signHybridPayload,
  signPqcPayload,
} from './index';

describe('Crypto Module Unit Tests', () => {
  const testMasterSeed = new Uint8Array(32).fill(0x11);
  const testChildSeed = deriveChildSeed(testMasterSeed, 0);

  describe('utils.ts', () => {
    it('converts bytes to hex and back accurately', () => {
      const original = new Uint8Array([0x00, 0x01, 0x0f, 0xa5, 0xff]);
      const hex = bytesToHex(original);
      expect(hex).toBe('00010fa5ff');
      expect(hexToBytes(hex)).toEqual(original);
      expect(hexToBytes('0x' + hex)).toEqual(original);
    });

    it('concatenates Uint8Arrays safely', () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([3, 4, 5]);
      expect(concatBytes(a, b)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
      expect(concatBytes(null as any, b)).toEqual(b);
    });

    it('serializes BigInt and Uint8Array with safeStringify', () => {
      const obj = { amount: 100n, raw: new Uint8Array([0xde, 0xad]) };
      const json = JSON.parse(safeStringify(obj));
      expect(json).toEqual({ amount: '100', raw: '0xdead' });
    });

    it('parses ETH decimal strings into Wei hex', () => {
      expect(parseEthToWeiHex('0')).toBe('0x0');
      expect(parseEthToWeiHex('1')).toBe('0xde0b6b3a7640000');
      expect(parseEthToWeiHex('0,5')).toBe('0x6f05b59d3b20000');
      expect(parseEthToWeiHex('invalid')).toBe('0x0');
    });

    it('parses BRL decimal strings into centavos hex', () => {
      expect(parseBrlToCentavosHex('0')).toBe('0x0');
      expect(parseBrlToCentavosHex('10.50')).toBe('0x41a'); // 1050
      expect(parseBrlToCentavosHex('50,00')).toBe('0x1388'); // 5000
      expect(parseBrlToCentavosHex('-5')).toBe('0x0');
    });

    it('computes Solidity function selectors and role hashes', () => {
      expect(getSelector('transfer(address,uint256)')).toBe('0xa9059cbb');
      expect(getSelector('balanceOf(address)')).toBe('0x70a08231');
      expect(getRoleHash('DEFAULT_ADMIN_ROLE')).toBe('0'.repeat(64));
      expect(getRoleHash('MINTER_ROLE')).toHaveLength(64);
    });

    it('encodes pingDelegation(string) ABI calldata', () => {
      const encoded = encodePingDelegation('hello');
      expect(encoded.startsWith(getSelector('pingDelegation(string)'))).toBe(true);
      // 4B selector (8 hex) + 32B offset (64 hex) + 32B length (64 hex) + 32B padded string (64 hex)
      expect(encoded).toHaveLength(2 + 8 + 64 + 64 + 64);
    });
  });

  describe('keys.ts', () => {
    it('generates and validates 24-word BIP-39 mnemonics', () => {
      const mnemonic = generateMnemonic();
      expect(mnemonic.split(' ')).toHaveLength(24);
      expect(validateMnemonic(mnemonic)).toBe(true);
      expect(validateMnemonic('abandon abandon abandon')).toBe(false);

      const entropy = mnemonicToMasterSeed(mnemonic);
      expect(entropy).toBeInstanceOf(Uint8Array);
      expect(entropy).toHaveLength(64); // semente BIP-39 padrão (PBKDF2-HMAC-SHA512)
    });

    it('matches the official BIP-39 seed and BIP-44 Ethereum address test vectors', () => {
      const m = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const seed = mnemonicToMasterSeed(m);
      expect(bytesToHex(seed)).toBe(
        '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4',
      );
      const key = deriveBip44EcdsaKey(seed, 0);
      expect(ethAddressFromEcdsaKey(key).address).toBe('0x9858effd232b4033e47d90003d41ec34ecaeda94');
    });

    it('keeps PQC account seeds independent from the BIP-44 ECDSA key', () => {
      const seed = mnemonicToMasterSeed(generateMnemonic());
      const ecdsaKey = deriveBip44EcdsaKey(seed, 0);
      const pqcSeed = deriveChildSeedV2(seed, 0);
      expect(bytesToHex(pqcSeed)).not.toBe(bytesToHex(ecdsaKey));
      expect(bytesToHex(deriveChildSeedV2(seed, 1))).not.toBe(bytesToHex(pqcSeed));
      wipeBytes(ecdsaKey);
      expect(ecdsaKey.every((b) => b === 0)).toBe(true);
    });

    it('derives deterministic domain-separated seeds', () => {
      const child0 = deriveChildSeed(testMasterSeed, 0);
      const child1 = deriveChildSeed(testMasterSeed, 1);
      expect(child0).toHaveLength(32);
      expect(child1).toHaveLength(32);
      expect(bytesToHex(child0)).not.toBe(bytesToHex(child1));

      const ecdsaSeed = deriveEcdsaSeed(child0);
      const mldsaSeed = deriveMldsaSeed(child0);
      const falconSeed = deriveFalconSeed(child0);

      expect(ecdsaSeed).toHaveLength(32);
      expect(mldsaSeed).toHaveLength(32);
      expect(falconSeed).toHaveLength(48);
      expect(bytesToHex(ecdsaSeed)).not.toBe(bytesToHex(mldsaSeed));
    });

    it('resolves account PQC algorithm and labels with backward compatibility', () => {
      expect(accountPqcAlgorithm(undefined)).toBe('MLDSA44');
      expect(accountPqcAlgorithm({})).toBe('MLDSA44');
      expect(accountPqcAlgorithm({ pqcAlgorithm: 'MLDSA44' })).toBe('MLDSA44');
      expect(accountPqcAlgorithm({ pqcAlgorithm: 'FALCON512' })).toBe('FALCON512');

      expect(accountTypeLabel({ isHybrid: true })).toBe('Híbrida (ECDSA + ML-DSA-44)');
      expect(accountTypeLabel({ isHybrid: true, pqcAlgorithm: 'FALCON512' })).toBe('Híbrida (ECDSA + Falcon-512)');
      expect(accountTypeLabel({ isPQC: true })).toBe('ML-DSA-44 Pura');
      expect(accountTypeLabel({ isPQC: true, pqcAlgorithm: 'FALCON512' })).toBe('Falcon-512 Pura');
      expect(accountTypeLabel({ isPQC: false, isHybrid: false })).toBe('ECDSA Simulada (legada, sem chave)');
    });

    it('derives ML-DSA-44 public key matching FIPS 204 standard (1312 bytes)', async () => {
      const pubKey = await derivePqcPublicKey(testChildSeed, 'MLDSA44');
      expect(pubKey).toHaveLength(1312);

      // Must match @noble/post-quantum FIPS 204 keygen byte-for-byte
      const expectedNoblePubKey = ml_dsa44.keygen(deriveMldsaSeed(testChildSeed)).publicKey;
      expect(bytesToHex(pubKey)).toBe(bytesToHex(expectedNoblePubKey));
    });

    it('derives Falcon-512 public key without 0x09 header (896 bytes for Besu)', async () => {
      const pubKey = await derivePqcPublicKey(testChildSeed, 'FALCON512');
      expect(pubKey).toHaveLength(896);

      const rawFalcon = falcon512.keygen(deriveFalconSeed(testChildSeed)).publicKey;
      expect(rawFalcon).toHaveLength(897);
      expect(rawFalcon[0]).toBe(0x09);
      expect(bytesToHex(pubKey)).toBe(bytesToHex(rawFalcon.subarray(1)));
    });

    it('derives Hybrid and Pure PQC keys and Ethereum addresses deterministically', async () => {
      const hybridMldsa = await deriveHybridKeysAndAddress(testChildSeed, 'MLDSA44');
      expect(hybridMldsa.ecdsaPubKeyBytes).toHaveLength(64);
      expect(hybridMldsa.pqcPubKeyBytes).toHaveLength(1312);
      expect(hybridMldsa.compositePublicKeyHex).toHaveLength((64 + 1312) * 2);
      expect(hybridMldsa.derivedAddress).toMatch(/^0x[0-9a-f]{40}$/);

      const expectedHash = keccak_256(concatBytes(hybridMldsa.ecdsaPubKeyBytes, hybridMldsa.pqcPubKeyBytes));
      expect(hybridMldsa.derivedAddress).toBe('0x' + bytesToHex(expectedHash.slice(-20)));

      const hybridFalcon = await deriveHybridKeysAndAddress(testChildSeed, 'FALCON512');
      expect(hybridFalcon.pqcPubKeyBytes).toHaveLength(896);
      expect(hybridFalcon.compositePublicKeyHex).toHaveLength((64 + 896) * 2);
      expect(hybridFalcon.derivedAddress).not.toBe(hybridMldsa.derivedAddress);

      const pureMldsa = await derivePurePqcKeysAndAddress(testChildSeed, 'MLDSA44');
      expect(pureMldsa.pqcPubKeyBytes).toHaveLength(1312);
      expect(pureMldsa.derivedAddress).toBe(
        '0x' + bytesToHex(keccak_256(pureMldsa.pqcPubKeyBytes).slice(-20)),
      );

      const pureFalcon = await derivePurePqcKeysAndAddress(testChildSeed, 'FALCON512');
      expect(pureFalcon.pqcPubKeyBytes).toHaveLength(896);
      expect(pureFalcon.derivedAddress).toBe(
        '0x' + bytesToHex(keccak_256(pureFalcon.pqcPubKeyBytes).slice(-20)),
      );
    });
  });

  describe('signatures.ts', () => {
    const sampleMessage = new TextEncoder().encode('Transfer 100 ETH');
    const sampleHash = keccak_256(sampleMessage);

    it('creates valid 65-byte secp256k1 classic signatures and recovers public key', () => {
      const ecdsaSeed = deriveEcdsaSeed(testChildSeed);
      const sigRawV = createClassicSignature(sampleHash, ecdsaSeed, false);
      expect(sigRawV).toHaveLength(65);
      expect([0, 1]).toContain(sigRawV[64]);

      const sigV27 = createClassicSignature(sampleHash, ecdsaSeed, true);
      expect(sigV27).toHaveLength(65);
      const rawV = sigRawV[64] as number;
      expect(sigV27[64]).toBe(rawV + 27);

      // Verify public key recovery matches account ECDSA public key
      const recovered = new Uint8Array(65);
      recovered[0] = rawV;
      recovered.set(sigRawV.subarray(0, 64), 1);
      const recPubKey = secp256k1.recoverPublicKey(recovered, sampleHash, { prehash: false });
      const expectedPubKey = secp256k1.getPublicKey(ecdsaSeed, true);
      expect(bytesToHex(recPubKey)).toBe(bytesToHex(expectedPubKey));
    });

    it('signs and verifies Pure PQC payloads with ML-DSA-44 and Falcon-512', async () => {
      const mldsaRes = await signPqcPayload(sampleMessage, testChildSeed, 'MLDSA44');
      expect(mldsaRes.pqcSignature).toHaveLength(2420);
      expect(mldsaRes.signatureHex).toBe('0x' + bytesToHex(mldsaRes.pqcSignature));

      const mldsaPubKey = await derivePqcPublicKey(testChildSeed, 'MLDSA44');
      expect(ml_dsa44.verify(mldsaRes.pqcSignature, sampleMessage, mldsaPubKey)).toBe(true);

      const falconRes = await signPqcPayload(sampleMessage, testChildSeed, 'FALCON512');
      expect(falconRes.pqcSignature[0]).toBe(0x39); // Compressed Falcon-512 header
      const falconFullPubKey = falcon512.keygen(deriveFalconSeed(testChildSeed)).publicKey;
      expect(falcon512.verify(falconRes.pqcSignature, sampleMessage, falconFullPubKey)).toBe(true);

      // Verify pre-derived secretKey reuse produces identical deterministic ML-DSA-44 signature
      const preDerived = derivePqcKeyPair(testChildSeed, 'MLDSA44');
      const mldsaDirect = await pqcSign(sampleMessage, testChildSeed, 'MLDSA44', preDerived.secretKey);
      expect(bytesToHex(mldsaDirect)).toBe(bytesToHex(mldsaRes.pqcSignature));
      expect(deriveMldsaKeyPair(testChildSeed).secretKey).toHaveLength(2560);
    });

    it('signs and verifies Strong-Nested Hybrid payloads (ECDSA + ML-DSA-44 / Falcon-512)', async () => {
      const hybridMldsa = await signHybridPayload(sampleHash, sampleMessage, testChildSeed, true, 'MLDSA44');
      expect(hybridMldsa.classicSignature).toHaveLength(65);
      expect(hybridMldsa.pqcSignature).toHaveLength(2420);
      expect(hybridMldsa.combinedSignatureBytes).toHaveLength(65 + 2420);

      // Verify nested payload = concatBytes(sampleMessage, classicSignature)
      const nestedPayload = concatBytes(sampleMessage, hybridMldsa.classicSignature);
      const mldsaPubKey = await derivePqcPublicKey(testChildSeed, 'MLDSA44');
      expect(ml_dsa44.verify(hybridMldsa.pqcSignature, nestedPayload, mldsaPubKey)).toBe(true);

      const hybridFalcon = await signHybridPayload(sampleHash, sampleMessage, testChildSeed, false, 'FALCON512');
      expect(hybridFalcon.classicSignature).toHaveLength(65);
      expect(hybridFalcon.combinedSignatureBytes).toHaveLength(65 + hybridFalcon.pqcSignature.length);

      const nestedFalconPayload = concatBytes(sampleMessage, hybridFalcon.classicSignature);
      const falconFullPubKey = falcon512.keygen(deriveFalconSeed(testChildSeed)).publicKey;
      expect(falcon512.verify(hybridFalcon.pqcSignature, nestedFalconPayload, falconFullPubKey)).toBe(true);
    });
  });
});
