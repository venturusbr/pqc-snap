import { describe, it, expect } from '@jest/globals';
import type { KeyringAccount } from '@metamask/keyring-api';
import { ml_dsa44 } from '@noble/post-quantum/ml-dsa.js';
import { falcon512 } from '@noble/post-quantum/falcon.js';
import { keccak_256 } from '@noble/hashes/sha3';
import {
  bytesToHex,
  hexToBytes,
  concatBytes,
  deriveChildSeed,
  deriveFalconSeed,
  deriveHybridKeysAndAddress,
  derivePurePqcKeysAndAddress,
} from '../crypto';
import {
  TxEnvelopeType,
  DSA_TYPE_HYBRID,
  DSA_TYPE_MLDSA,
  DSA_TYPE_FALCON,
  DSA_TYPE_HYBRID_FALCON,
  DSA_TYPE_SECP256K1,
  DSA_TYPE_SECP256R1,
  DSA_TYPE_MLDSA65,
  DSA_TYPE_MLDSA87,
  DSA_BASE_GAS,
  DSA_ESTIMATE_GAS_OVERHEAD,
  getBaseGasForDsa,
  getBaseGasForAccount,
  getEstimateGasOverhead,
  countCalldataBytes,
  calculateCalldataFloor,
  calculateIntrinsicGas,
  ensureMinimumGasLimit,
  adjustEstimateGasForDsa,
  dsaTypeForAccount,
  normalizeTxType,
  numberToBytes,
  shortToBytes,
  toBuffer,
  toAddress,
  encodeRLP,
  extractPqcPublicKey,
  computeTransactionPreimage,
  signAuthorizationList,
  signTransactionCore,
  internalSignAndSerializeTx,
} from './index';

describe('Transactions Module Unit Tests', () => {
  const masterSeed = new Uint8Array(32).fill(0x22);
  const accountSeed = deriveChildSeed(masterSeed, 0);

  async function buildTestAccount(
    isHybrid: boolean,
    pqcAlgorithm: 'MLDSA44' | 'FALCON512',
  ): Promise<KeyringAccount> {
    if (isHybrid) {
      const { derivedAddress, compositePublicKeyHex } = await deriveHybridKeysAndAddress(
        accountSeed,
        pqcAlgorithm,
      );
      return {
        id: 'test-hybrid-' + pqcAlgorithm,
        address: derivedAddress,
        options: {
          isHybrid: true,
          isPQC: false,
          pqcAlgorithm,
          publicKey: compositePublicKeyHex,
          privateKeySeed: bytesToHex(accountSeed),
          derivationIndex: 0,
        },
        methods: ['personal_sign', 'eth_signTransaction'],
        type: 'eip155:eoa',
        scopes: ['eip155:0'],
      };
    }
    const { derivedAddress, pqcPublicKeyHex } = await derivePurePqcKeysAndAddress(
      accountSeed,
      pqcAlgorithm,
    );
    return {
      id: 'test-pure-' + pqcAlgorithm,
      address: derivedAddress,
      options: {
        isHybrid: false,
        isPQC: true,
        pqcAlgorithm,
        publicKey: pqcPublicKeyHex,
        privateKeySeed: bytesToHex(accountSeed),
        derivationIndex: 0,
      },
      methods: ['personal_sign', 'eth_signTransaction'],
      type: 'eip155:eoa',
      scopes: ['eip155:0'],
    };
  }

  describe('types.ts & rlp.ts', () => {
    it('resolves Besu dsaType correctly for all account configurations', () => {
      expect(dsaTypeForAccount({ isHybrid: true })).toBe(DSA_TYPE_HYBRID); // 0x0060
      expect(dsaTypeForAccount({ isHybrid: true, pqcAlgorithm: 'MLDSA44' })).toBe(DSA_TYPE_HYBRID);
      expect(dsaTypeForAccount({ isHybrid: true, pqcAlgorithm: 'FALCON512' })).toBe(DSA_TYPE_HYBRID_FALCON); // 0x0070
      expect(dsaTypeForAccount({ isPQC: true })).toBe(DSA_TYPE_MLDSA); // 0x0030
      expect(dsaTypeForAccount({ isPQC: true, pqcAlgorithm: 'FALCON512' })).toBe(DSA_TYPE_FALCON); // 0x0040
    });

    it('normalizes transaction envelope types', () => {
      expect(normalizeTxType(undefined)).toBe(TxEnvelopeType.LEGACY);
      expect(normalizeTxType('0x0')).toBe(TxEnvelopeType.LEGACY);
      expect(normalizeTxType('0x42')).toBe(TxEnvelopeType.FLEXIBLE_EIP1559);
      expect(normalizeTxType('0x41')).toBe(TxEnvelopeType.FLEXIBLE_ACCESS_LIST);
      expect(normalizeTxType('0x44')).toBe(TxEnvelopeType.FLEXIBLE_DELEGATION);
      expect(normalizeTxType(0x02)).toBe(TxEnvelopeType.EIP1559);
    });

    it('encodes numbers, addresses, and RLP structures accurately', () => {
      expect(numberToBytes(0)).toEqual(new Uint8Array(0));
      expect(numberToBytes(0x42)).toEqual(new Uint8Array([0x42]));
      expect(shortToBytes(0x0060)).toEqual(new Uint8Array([0x00, 0x60]));
      expect(toBuffer('0x0')).toEqual(new Uint8Array(0));
      expect(toBuffer(256n)).toEqual(new Uint8Array([0x01, 0x00]));
      expect(toAddress('0x1234')).toHaveLength(20);
      expect(encodeRLP(new Uint8Array([0x7f]))).toEqual(new Uint8Array([0x7f]));
      expect(encodeRLP(new Uint8Array(0))).toEqual(new Uint8Array([0x80]));
      expect(encodeRLP([])).toEqual(new Uint8Array([0xc0]));
    });
  });

  describe('Transaction Signing & Serialization (0x42, 0x41, 0x44, 0x02, 0x00)', () => {
    const baseTx = {
      chainId: '0x16bfadfa',
      nonce: '0x1',
      gasPrice: '0x3b9aca00',
      maxPriorityFeePerGas: '0x3b9aca00',
      maxFeePerGas: '0x3b9aca00',
      gasLimit: '0x0f4240',
      to: '0x124c77c547626044e2c9e25aed558a361d37e091',
      value: '0xde0b6b3a7640000',
      data: '0xa9059cbb',
      accessList: [],
    };

    it('extracts PQC public key from both Hybrid and Pure accounts', async () => {
      const hybridMldsa = await buildTestAccount(true, 'MLDSA44');
      const hybridFalcon = await buildTestAccount(true, 'FALCON512');
      const pureMldsa = await buildTestAccount(false, 'MLDSA44');

      expect(extractPqcPublicKey(hybridMldsa)).toHaveLength(1312);
      expect(extractPqcPublicKey(hybridFalcon)).toHaveLength(896);
      expect(extractPqcPublicKey(pureMldsa)).toHaveLength(1312);
    });

    it('signs and serializes 0x42 Flexible EIP-1559 Hybrid ML-DSA-44 transactions', async () => {
      const account = await buildTestAccount(true, 'MLDSA44');
      const tx = { ...baseTx, from: account.address, type: '0x42' };

      const preimage = computeTransactionPreimage(tx, account);
      expect(preimage[0]).toBe(0x42);
      const recoveryHash = keccak_256(preimage);

      const signed = await signTransactionCore(tx, account);
      const fullSig = hexToBytes(signed.signatureHex);
      expect(fullSig).toHaveLength(65 + 2420);

      // Verify nested ML-DSA-44 signature over (recoveryHash || classicSig)
      const classicSig = fullSig.subarray(0, 65);
      const pqcSig = fullSig.subarray(65);
      const pqcPubKey = extractPqcPublicKey(account);
      expect(ml_dsa44.verify(pqcSig, concatBytes(recoveryHash, classicSig), pqcPubKey)).toBe(true);

      const { serializedTx, txHash } = await internalSignAndSerializeTx(tx, account);
      expect(serializedTx.startsWith('0x42')).toBe(true);
      expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('signs and serializes 0x42 Flexible EIP-1559 Pure ML-DSA-44 and Hybrid Falcon-512 transactions', async () => {
      const pureMldsaAccount = await buildTestAccount(false, 'MLDSA44');
      const txPure = { ...baseTx, from: pureMldsaAccount.address, type: '0x42' };
      const preimagePure = computeTransactionPreimage(txPure, pureMldsaAccount);
      const signedPure = await signTransactionCore(txPure, pureMldsaAccount);
      const pureSigBytes = hexToBytes(signedPure.signatureHex);
      expect(pureSigBytes).toHaveLength(2420);
      expect(
        ml_dsa44.verify(pureSigBytes, keccak_256(preimagePure), extractPqcPublicKey(pureMldsaAccount)),
      ).toBe(true);

      const hybridFalconAccount = await buildTestAccount(true, 'FALCON512');
      const txFalcon = { ...baseTx, from: hybridFalconAccount.address, type: '0x42' };
      const preimageFalcon = computeTransactionPreimage(txFalcon, hybridFalconAccount);
      const signedFalcon = await signTransactionCore(txFalcon, hybridFalconAccount);
      const falconFullSig = hexToBytes(signedFalcon.signatureHex);
      const falconClassicSig = falconFullSig.subarray(0, 65);
      const falconPqcSig = falconFullSig.subarray(65);
      const falconFullPubKey = falcon512.keygen(deriveFalconSeed(accountSeed)).publicKey;
      expect(
        falcon512.verify(
          falconPqcSig,
          concatBytes(keccak_256(preimageFalcon), falconClassicSig),
          falconFullPubKey,
        ),
      ).toBe(true);
    });

    it('signs and serializes 0x44 Flexible Delegation (EIP-7702) transactions with authorizationList', async () => {
      const account = await buildTestAccount(true, 'MLDSA44');
      const authItems = [
        {
          chainId: '0x16bfadfa',
          address: '0x4FD4495Fd3c419eb6C31398Ee5ebFc764478f24f',
          nonce: '0x0',
        },
      ];

      const { signedList, signedListForSigning } = await signAuthorizationList(
        authItems,
        accountSeed,
        account,
      );
      expect(signedList).toHaveLength(1);
      expect(signedList[0][0]).toBe(0x01); // CodeDelegationType.FLEXIBLE
      expect(signedListForSigning).toHaveLength(2);

      const tx0x44 = {
        ...baseTx,
        from: account.address,
        type: '0x44',
        authorizationList: authItems,
      };
      const { serializedTx, txHash } = await internalSignAndSerializeTx(tx0x44, account);
      expect(serializedTx.startsWith('0x44')).toBe(true);
      expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('signs and serializes classical 0x00 Legacy and 0x02 EIP-1559 transactions', async () => {
      const account = await buildTestAccount(true, 'MLDSA44');
      const legacyTx = { ...baseTx, from: account.address, type: '0x00' };
      const signedLegacy = await signTransactionCore(legacyTx, account);
      // ChainId * 2 + 35 + recId
      const expectedMinV = Number(baseTx.chainId) * 2 + 35;
      expect(parseInt(signedLegacy.v, 16)).toBeGreaterThanOrEqual(expectedMinV);

      const eip1559Tx = { ...baseTx, from: account.address, type: '0x02' };
      const { serializedTx } = await internalSignAndSerializeTx(eip1559Tx, account);
      expect(serializedTx.startsWith('0x02')).toBe(true);
    });
  });

  describe('Besu PR 55 Gas Pricing per DSA type & Calldata Floor (EIP-7623)', () => {
    it('defines base gas cost per DSA type according to PR 55 table', () => {
      expect(DSA_BASE_GAS[DSA_TYPE_SECP256K1]).toBe(21000);
      expect(DSA_BASE_GAS[DSA_TYPE_SECP256R1]).toBe(31629);
      expect(DSA_BASE_GAS[DSA_TYPE_MLDSA]).toBe(82553);
      expect(DSA_BASE_GAS[DSA_TYPE_MLDSA65]).toBe(110047);
      expect(DSA_BASE_GAS[DSA_TYPE_MLDSA87]).toBe(147047);
      expect(DSA_BASE_GAS[DSA_TYPE_FALCON]).toBe(46511);
      expect(DSA_BASE_GAS[DSA_TYPE_HYBRID]).toBe(86102);        // SECP256K1-MLDSA44
      expect(DSA_BASE_GAS[DSA_TYPE_HYBRID_FALCON]).toBe(50369); // SECP256K1-FALCON512
    });

    it('resolves base gas cost by account configuration and transaction envelope', () => {
      // Flexible envelope (0x42)
      expect(getBaseGasForAccount({ isHybrid: true, pqcAlgorithm: 'MLDSA44' }, '0x42')).toBe(86102);
      expect(getBaseGasForAccount({ isHybrid: true, pqcAlgorithm: 'FALCON512' }, '0x42')).toBe(50369);
      expect(getBaseGasForAccount({ isPQC: true, pqcAlgorithm: 'MLDSA44' }, '0x42')).toBe(82553);
      expect(getBaseGasForAccount({ isPQC: true, pqcAlgorithm: 'FALCON512' }, '0x42')).toBe(46511);

      // Flexible access list (0x41) and delegation (0x44)
      expect(getBaseGasForAccount({ isHybrid: true, pqcAlgorithm: 'MLDSA44' }, '0x41')).toBe(86102);
      expect(getBaseGasForAccount({ isHybrid: true, pqcAlgorithm: 'MLDSA44' }, '0x44')).toBe(86102);

      // Classical envelope (0x00, 0x01, 0x02) always pays 21,000 base gas
      expect(getBaseGasForAccount({ isHybrid: true, pqcAlgorithm: 'MLDSA44' }, '0x00')).toBe(21000);
      expect(getBaseGasForAccount({ isHybrid: true, pqcAlgorithm: 'MLDSA44' }, '0x02')).toBe(21000);
      expect(getBaseGasForAccount(undefined, '0x02')).toBe(21000);
    });

    it('calculates calldata floor matching PR 55 specification (EIP-7623 from Prague on)', () => {
      // Test the exact example from PR 55:
      // "The floor of an ML-DSA-44 transaction with 10,000 non-zero bytes is 82,553 + 400,000 = 482,553"
      const tenThousandNonZeroBytes = new Uint8Array(10000).fill(0xaa);
      const floorMldsa = calculateCalldataFloor(82553, tenThousandNonZeroBytes);
      expect(floorMldsa).toBe(482553);

      // Hybrid ML-DSA-44 with 10,000 non-zero bytes: 86,102 + 400,000 = 486,102
      const floorHybrid = calculateCalldataFloor(86102, tenThousandNonZeroBytes);
      expect(floorHybrid).toBe(486102);

      // Mixed calldata: 10 non-zero bytes (10 * 4 * 10 = 400) + 5 zero bytes (5 * 1 * 10 = 50)
      const mixed = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 0, 0, 0, 0]);
      expect(calculateCalldataFloor(21000, mixed)).toBe(21000 + 400 + 50);
    });

    it('calculates intrinsic gas as Math.max(standardExecutionGas, calldataFloor)', () => {
      // When calldata is heavy, floor dominates:
      const heavyData = new Uint8Array(10000).fill(0x55);
      const intrinsicHeavy = calculateIntrinsicGas(
        { from: '0x1', to: '0x2', data: bytesToHex(heavyData), type: '0x42' },
        { isHybrid: true, pqcAlgorithm: 'MLDSA44' },
      );
      // Floor = 86102 + 400000 = 486102 vs Standard = 86102 + 160000 = 246102
      expect(intrinsicHeavy).toBe(486102);

      // When calldata is empty, base cost dominates:
      const intrinsicEmpty = calculateIntrinsicGas(
        { from: '0x1', to: '0x2', data: '0x', type: '0x42' },
        { isHybrid: true, pqcAlgorithm: 'MLDSA44' },
      );
      expect(intrinsicEmpty).toBe(86102);
    });

    it('computes eth_estimateGas overhead correctly for flexible transactions', () => {
      // Difference table from PR 55:
      // "The estimate comes out short by the difference in the table: 65,102 gas for SECP256K1-MLDSA44"
      expect(DSA_ESTIMATE_GAS_OVERHEAD[DSA_TYPE_HYBRID]).toBe(65102);        // 86,102 - 21,000
      expect(DSA_ESTIMATE_GAS_OVERHEAD[DSA_TYPE_HYBRID_FALCON]).toBe(29369); // 50,369 - 21,000
      expect(DSA_ESTIMATE_GAS_OVERHEAD[DSA_TYPE_MLDSA]).toBe(61553);         // 82,553 - 21,000
      expect(DSA_ESTIMATE_GAS_OVERHEAD[DSA_TYPE_FALCON]).toBe(25511);        // 46,511 - 21,000

      expect(getEstimateGasOverhead({ isHybrid: true, pqcAlgorithm: 'MLDSA44' }, '0x42')).toBe(65102);
      expect(getEstimateGasOverhead({ isHybrid: true, pqcAlgorithm: 'FALCON512' }, '0x42')).toBe(29369);

      // Adjusting eth_estimateGas output
      const rawEstimateHex = '0x5208'; // 21,000
      const adjusted = adjustEstimateGasForDsa(rawEstimateHex, { isHybrid: true, pqcAlgorithm: 'MLDSA44' }, '0x42');
      expect(parseInt(adjusted, 16)).toBe(21000 + 65102); // 86,102
    });

    it('ensures minimum gas limit protects against INTRINSIC_GAS_EXCEEDS_GAS_LIMIT', async () => {
      const account = await buildTestAccount(true, 'MLDSA44');
      // A transaction with 21,000 gas limit (which would be rejected by Besu PR 55)
      const txWithLowLimit = {
        from: account.address,
        to: '0x124c77c547626044e2c9e25aed558a361d37e091',
        gasLimit: '0x5208', // 21,000
        type: '0x42',
        data: '0x',
      };

      const safeTx = ensureMinimumGasLimit(txWithLowLimit, account);
      const safeGasLimit = parseInt(safeTx.gasLimit as string, 16);
      expect(safeGasLimit).toBeGreaterThanOrEqual(86102);

      // signTransactionCore automatically upgrades low gas limits
      const signed = await signTransactionCore(txWithLowLimit, account);
      const finalSignedLimit = parseInt(signed.gasLimit as string, 16);
      expect(finalSignedLimit).toBeGreaterThanOrEqual(86102);
    });
  });
});
