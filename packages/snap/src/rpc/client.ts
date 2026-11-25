import { DEFAULT_RPC_URL, INSECURE_RPC_ALLOWED_HOSTS } from '../constants';
import { adjustEstimateGasForDsa } from '../transactions';

/**
 * Normaliza e valida a URL do nó RPC.
 * - Aceita apenas http/https, sem credenciais embutidas.
 * - Exige HTTPS, exceto para loopback (localhost/127.0.0.1/[::1]) usado em desenvolvimento.
 * Lança erro em URL inválida (nunca "adivinha" outro destino).
 */
export function sanitizeRpcUrl(urlStr?: string): string {
  let clean = (urlStr || '').trim();
  if (!clean) return DEFAULT_RPC_URL;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(clean)) {
    clean = `http://${clean}`;
  }

  let url: URL;
  try {
    url = new URL(clean);
  } catch {
    throw new Error('URL do nó RPC inválida.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('URL do nó RPC deve usar http ou https.');
  }
  if (url.username || url.password) {
    throw new Error('URL do nó RPC não pode conter credenciais.');
  }
  if (url.protocol === 'http:' && !INSECURE_RPC_ALLOWED_HOSTS.includes(url.hostname)) {
    throw new Error('Nó RPC remoto exige HTTPS (http:// só é permitido para localhost).');
  }

  return `${url.origin}${url.pathname}${url.search}`.replace(/\/+$/, '');
}

let rpcRequestId = 0;

/**
 * Executa uma chamada JSON-RPC com timeout e tratamento de erro centralizado.
 */
export async function jsonRpcCall<T = any>(
  rpcUrl: string,
  method: string,
  params: any[] = [],
  timeoutMs = 5000,
): Promise<T> {
  const cleanUrl = sanitizeRpcUrl(rpcUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcRequestId, method, params }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if ((response as any).ok === false) {
      throw new Error(`Nó RPC respondeu HTTP ${(response as any).status}.`);
    }

    const json = (await response.json()) as any;
    if (json.error) {
      throw new Error(json.error.message || JSON.stringify(json.error));
    }
    return json.result;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Tempo limite esgotado (${timeoutMs / 1000}s) ao conectar em ${cleanUrl}.`);
    }
    throw err;
  }
}

/** Valida uma quantidade JSON-RPC (hex 0x...) e a devolve normalizada. */
function requireQuantity(value: unknown, what: string): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error(`Resposta inválida do nó RPC para ${what}.`);
  }
  return value;
}

/**
 * Nonce da conta. NÃO possui fallback: um nonce errado gera transação inválida ou reenviável,
 * então qualquer falha do nó interrompe a assinatura.
 */
export async function fetchNonce(rpcUrl: string, address: string): Promise<string> {
  const res = await jsonRpcCall<string>(rpcUrl, 'eth_getTransactionCount', [address, 'pending'], 2500);
  return requireQuantity(res, 'o nonce');
}

export async function fetchGasPrice(rpcUrl: string): Promise<string> {
  try {
    const res = await jsonRpcCall<string>(rpcUrl, 'eth_gasPrice', [], 2500);
    return !res || res === '0x' || res === '0x0' ? '0x3b9aca00' : res;
  } catch {
    return '0x3b9aca00';
  }
}

/**
 * Chain ID da rede. NÃO possui fallback: assinar com o chainId errado permite replay entre redes.
 */
export async function fetchChainId(rpcUrl: string): Promise<string> {
  const res = requireQuantity(await jsonRpcCall<string>(rpcUrl, 'eth_chainId', [], 2500), 'o chainId');
  if (BigInt(res) === 0n) {
    throw new Error('Nó RPC retornou chainId inválido (0).');
  }
  return res;
}
export async function fetchEthBalance(rpcUrl: string, address: string): Promise<{ eth: string; wei: bigint }> {
  try {
    const rawHex = await jsonRpcCall<string>(rpcUrl, 'eth_getBalance', [address, 'latest'], 3000);
    const wei = BigInt(!rawHex || rawHex === '0x' ? '0x0' : rawHex);
    return { eth: (Number(wei) / 1e18).toFixed(4), wei };
  } catch {
    return { eth: '0.00', wei: 0n };
  }
}

export async function fetchContractCall(rpcUrl: string, to: string, data: string): Promise<string> {
  try {
    return (await jsonRpcCall<string>(rpcUrl, 'eth_call', [{ to, data }, 'latest'], 3500)) || '0x0';
  } catch {
    return '0x0';
  }
}

export async function fetchCode(rpcUrl: string, address: string): Promise<string> {
  try {
    return String((await jsonRpcCall<string>(rpcUrl, 'eth_getCode', [address, 'latest'], 3000)) || '0x');
  } catch {
    return '0x';
  }
}

export async function sendRawTransaction(rpcUrl: string, rawHex: string): Promise<string> {
  return await jsonRpcCall<string>(rpcUrl, 'eth_sendRawTransaction', [rawHex], 7000);
}

export async function fetchTransactionReceipt(rpcUrl: string, txHash: string): Promise<any> {
  return await jsonRpcCall<any>(rpcUrl, 'eth_getTransactionReceipt', [txHash], 3000);
}

/**
 * Realiza polling do recibo da transação até obter blockNumber ou atingir o número máximo de tentativas.
 */
export async function pollTransactionReceipt(
  rpcUrl: string,
  txHash: string,
  maxAttempts = 6,
  intervalMs = 1000,
): Promise<any | null> {
  if (!txHash) return null;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const receipt = await fetchTransactionReceipt(rpcUrl, txHash);
      if (receipt && receipt.blockNumber) {
        return receipt;
      }
    } catch {
      // ignora falha transitória durante polling
    }
    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return null;
}

export async function fetchSupportedDSAs(rpcUrl: string): Promise<any[]> {
  const res = await jsonRpcCall<any>(rpcUrl, 'vnt_getAccountsSupportedDSAs', [], 3000);
  return Array.isArray(res) ? res : res ? [res] : [];
}

export async function createAccessList(rpcUrl: string, txParams: any): Promise<any> {
  return await jsonRpcCall<any>(rpcUrl, 'eth_createAccessList', [txParams, 'latest'], 5000);
}

/**
 * Estima o gas da transação consultando `eth_estimateGas` e ajustando com o overhead do dsaType
 * conforme a nota do PR 55 do Besu (já que o nó simula como transação padrão de 21.000).
 */
export async function estimateGas(
  rpcUrl: string,
  txParams: any,
  accountOptions?: Record<string, any>,
  txType?: string | number,
): Promise<string> {
  try {
    const rawEst = await jsonRpcCall<string>(rpcUrl, 'eth_estimateGas', [txParams, 'latest'], 5000);
    return adjustEstimateGasForDsa(rawEst, accountOptions, txType);
  } catch {
    return '0x0';
  }
}
