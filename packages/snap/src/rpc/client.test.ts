import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  sanitizeRpcUrl,
  jsonRpcCall,
  fetchNonce,
  fetchGasPrice,
  fetchChainId,
  fetchEthBalance,
  fetchSupportedDSAs,
} from './client';
import { DEFAULT_RPC_URL } from '../constants';

describe('RPC Client Unit Tests', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sanitizes RPC URLs properly', () => {
    expect(sanitizeRpcUrl('')).toBe(DEFAULT_RPC_URL);
    expect(sanitizeRpcUrl(undefined)).toBe(DEFAULT_RPC_URL);
    expect(sanitizeRpcUrl('localhost:8545/')).toBe('http://localhost:8545');
    expect(sanitizeRpcUrl('https://node.example.com///')).toBe('https://node.example.com');
  });

  it('rejects unsafe RPC URLs', () => {
    expect(() => sanitizeRpcUrl('http://node.example.com:8545')).toThrow('HTTPS');
    expect(() => sanitizeRpcUrl('ftp://node.example.com')).toThrow();
    expect(() => sanitizeRpcUrl('https://user:pass@node.example.com')).toThrow('credenciais');
    expect(() => sanitizeRpcUrl('http://')).toThrow();
  });

  it('does not fall back on nonce/chainId failures', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as any;
    await expect(fetchNonce('http://localhost:8545', '0x1234')).rejects.toThrow('offline');
    await expect(fetchChainId('http://localhost:8545')).rejects.toThrow('offline');
  });

  it('handles JSON-RPC success and fallback helpers', async () => {
    globalThis.fetch = jest.fn(async (_url: any, opts: any) => {
      const body = JSON.parse(opts.body);
      const responses: Record<string, any> = {
        eth_getTransactionCount: '0x5',
        eth_gasPrice: '0x0',
        eth_chainId: '0x539',
        eth_getBalance: '0xde0b6b3a7640000', // 1 ETH
        vnt_getAccountsSupportedDSAs: ['ML-DSA-44', 'FALCON-512'],
      };
      return {
        json: async () => ({ jsonrpc: '2.0', id: body.id, result: responses[body.method] }),
      } as any;
    });

    expect(await fetchNonce('http://localhost:8545', '0x1234')).toBe('0x5');
    // 0x0 falls back to 1 Gwei (0x3b9aca00)
    expect(await fetchGasPrice('http://localhost:8545')).toBe('0x3b9aca00');
    expect(await fetchChainId('http://localhost:8545')).toBe('0x539');

    const bal = await fetchEthBalance('http://localhost:8545', '0x1234');
    expect(bal.eth).toBe('1.0000');
    expect(bal.wei).toBe(1000000000000000000n);

    expect(await fetchSupportedDSAs('http://localhost:8545')).toEqual(['ML-DSA-44', 'FALCON-512']);
  });

  it('throws on JSON-RPC error objects', async () => {
    globalThis.fetch = jest.fn(async () => ({
      json: async () => ({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'Invalid signature' } }),
    })) as any;

    await expect(jsonRpcCall('http://localhost:8545', 'eth_sendRawTransaction', ['0x00'])).rejects.toThrow(
      'Invalid signature',
    );
  });
});
