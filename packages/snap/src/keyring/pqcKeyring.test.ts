import { describe, it, expect, beforeEach } from '@jest/globals';
import { ml_dsa44 } from '@noble/post-quantum/ml-dsa.js';
import { PqcKeyring } from './pqcKeyring';
import { generateMnemonic, hexToBytes, concatBytes } from '../crypto';
import type { SnapState } from '../types';

describe('PqcKeyring Unit Tests', () => {
  let mockState: SnapState;
  let keyring: PqcKeyring;

  beforeEach(() => {
    mockState = {
      mnemonic: generateMnemonic(),
      accounts: [],
    };
    keyring = new PqcKeyring();

    (globalThis as any).snap = {
      request: async ({ method, params }: { method: string; params?: any }) => {
        if (method === 'snap_manageState') {
          if (params?.operation === 'get') {
            return mockState;
          }
          if (params?.operation === 'update') {
            mockState = params.newState;
            return mockState;
          }
        }
        if (method === 'snap_manageAccounts') {
          return null;
        }
        if (method === 'snap_dialog') {
          return true;
        }
        return null;
      },
    };
  });

  it('creates a real BIP-44 ECDSA account (choice 1) without exposing secrets', async () => {
    mockState.mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const acc = await keyring.createAccount({ choice: '1' });
    expect(acc.options?.isEcdsa).toBe(true);
    expect(acc.options?.derivationVersion).toBe(2);
    expect(acc.address).toBe('0x9858effd232b4033e47d90003d41ec34ecaeda94');
    expect(JSON.stringify(mockState)).not.toContain('privateKeySeed');
  });

  it('creates Hybrid ML-DSA-44 (choice 3), Pure ML-DSA-44 (choice 2), Hybrid Falcon-512 (choice 4), and Pure Falcon-512 (choice 5) accounts', async () => {
    const accHybridMldsa = await keyring.createAccount({ choice: '3' });
    expect(accHybridMldsa.options?.isHybrid).toBe(true);
    expect(accHybridMldsa.options?.pqcAlgorithm).toBe('MLDSA44');
    expect(accHybridMldsa.options?.derivationIndex).toBe(0);

    const accPureMldsa = await keyring.createAccount({ choice: '2' });
    expect(accPureMldsa.options?.isPQC).toBe(true);
    expect(accPureMldsa.options?.isHybrid).toBe(false);
    expect(accPureMldsa.options?.pqcAlgorithm).toBe('MLDSA44');
    expect(accPureMldsa.options?.derivationIndex).toBe(1);

    const accHybridFalcon = await keyring.createAccount({ choice: '4' });
    expect(accHybridFalcon.options?.isHybrid).toBe(true);
    expect(accHybridFalcon.options?.pqcAlgorithm).toBe('FALCON512');
    expect(accHybridFalcon.options?.derivationIndex).toBe(2);

    const accPureFalcon = await keyring.createAccount({ choice: '5' });
    expect(accPureFalcon.options?.isPQC).toBe(true);
    expect(accPureFalcon.options?.pqcAlgorithm).toBe('FALCON512');
    expect(accPureFalcon.options?.derivationIndex).toBe(3);

    const list = await keyring.listAccounts();
    expect(list).toHaveLength(4);
    expect((await keyring.getAccount(accHybridMldsa.id))?.address).toBe(accHybridMldsa.address);
  });

  it('executes personal_sign and eth_signTransaction via submitRequest', async () => {
    const acc = await keyring.createAccount({ choice: '3' });
    const msgHex = '0x48656c6c6f'; // "Hello"

    const signResp = await keyring.submitRequest({
      id: 'req-1',
      origin: 'http://localhost:8000',
      scope: 'eip155:0',
      account: acc.id,
      request: {
        method: 'personal_sign',
        params: [msgHex, acc.address],
      },
    });

    expect(signResp.pending).toBe(false);
    const sigBytes = hexToBytes((signResp as any).result);
    expect(sigBytes).toHaveLength(65 + 2420);

    const classicSig = sigBytes.subarray(0, 65);
    const pqcSig = sigBytes.subarray(65);
    const compositePubKey = hexToBytes(acc.options?.publicKey as string);
    const pqcPubKey = compositePubKey.subarray(64);
    expect(ml_dsa44.verify(pqcSig, concatBytes(hexToBytes(msgHex), classicSig), pqcPubKey)).toBe(true);

    const txResp = await keyring.submitRequest({
      id: 'req-2',
      origin: 'http://localhost:8000',
      scope: 'eip155:0',
      account: acc.id,
      request: {
        method: 'eth_signTransaction',
        params: [
          {
            from: acc.address,
            to: acc.address,
            value: '0x0',
            nonce: '0x0',
            chainId: '0x16bfadfa',
            gasLimit: '0x5208',
            gasPrice: '0x3b9aca00',
            type: '0x42',
          },
        ],
      },
    });

    expect(txResp.pending).toBe(false);
    expect((txResp as any).result.signatureHex).toMatch(/^0x[0-9a-f]+$/);
  });
});
