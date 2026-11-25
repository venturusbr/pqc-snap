/**
 * Constantes Globais e Configurações Padrão do MetaMask PQC Snap
 */

export const DEFAULT_RPC_URL = 'http://44.201.48.206:8545';
export const DEFAULT_BLOB_RELAYER_URL = 'http://127.0.0.1:3001/enviar-blob';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const SELECTORS = {
  COUNTER: '0x61bc221a',              // counter()
  SAMPLE_INCREMENT: '0xd09de08a',     // increment() / ping()
} as const;

/** Origens (dApps) autorizadas a invocar métodos RPC sensíveis (assinatura, criação/inicialização de carteira). */
export const ALLOWED_ORIGINS: readonly string[] = ['http://localhost:8000'];

export function assertAllowedOrigin(origin: string | undefined): void {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    throw new Error(`Origem não autorizada: ${origin ?? 'desconhecida'}`);
  }
}
/** Hosts para os quais RPC sem TLS (http://) é tolerado (somente loopback/desenvolvimento local). */
export const INSECURE_RPC_ALLOWED_HOSTS: readonly string[] = ['44.201.48.206', 'localhost', '127.0.0.1', '[::1]'];
