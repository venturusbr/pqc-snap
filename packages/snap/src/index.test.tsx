import { describe, it, expect, beforeEach } from '@jest/globals';
import { onKeyringRequest, onRpcRequest } from './index';
import { generateMnemonic } from './crypto';
import type { SnapState } from './types';

describe('Snap Entrypoints (onKeyringRequest & onRpcRequest)', () => {
  let mockState: SnapState;

  beforeEach(() => {
    mockState = {
      mnemonic: generateMnemonic(),
      accounts: [],
    };
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
        return null;
      },
    };
  });

  it('handles keyring_listAccounts and keyring_getAccount via onKeyringRequest', async () => {
    const accounts = await onKeyringRequest({
      origin: 'metamask',
      request: { id: 1, jsonrpc: '2.0', method: 'keyring_listAccounts', params: [] },
    });
    expect(accounts).toEqual([]);

    await expect(
      onKeyringRequest({
        origin: 'metamask',
        request: { id: 2, jsonrpc: '2.0', method: 'unsupported_method', params: [] },
      }),
    ).rejects.toThrow('Método Keyring não suportado');
  });

  it('handles hello and eth_accounts, and throws on unknown RPC methods via onRpcRequest', async () => {
    const helloResp = await onRpcRequest({
      origin: 'http://localhost:8000',
      request: { id: 0, jsonrpc: '2.0', method: 'hello', params: [] },
    });
    expect(helloResp).toEqual({ success: true });

    const accounts = await onRpcRequest({
      origin: 'http://localhost:8000',
      request: { id: 1, jsonrpc: '2.0', method: 'eth_accounts', params: [] },
    });
    expect(accounts).toEqual([]);

    await expect(
      onRpcRequest({
        origin: 'http://localhost:8000',
        request: { id: 2, jsonrpc: '2.0', method: 'foo', params: [] },
      }),
    ).rejects.toThrow('Método RPC não encontrado: foo');
  });
});


