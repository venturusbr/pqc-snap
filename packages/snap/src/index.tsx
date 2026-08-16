/**
 * ============================================================================
 * METAMASK PQC SNAP - ARQUITETURA, FLUXOS E DOCUMENTAÇÃO DO PROJETO
 * ============================================================================
 * 
 * Este Snap estende as capacidades da MetaMask para suportar criptografia pós-quântica (PQC)
 * e esquemas de assinatura híbridos (segurança clássica + pós-quântica) em redes compatíveis,
 * como a rede Hyperledger Besu configurada para PQC.
 * 
 * ----------------------------------------------------------------------------
 * 1. ARQUITETURA DAS CONTAS E CHAVES
 * ----------------------------------------------------------------------------
 * O Snap gerencia três tipos de contas no Keyring:
 * 
 * A. ECDSA Padrão (Simulado):
 *    - Conta fictícia/mockada para testar a integração e a interface do DApp sem criptografia real.
 * 
 * B. ML-DSA-44 Pura (PQC):
 *    - Utiliza o algoritmo pós-quântico de assinaturas digitais ML-DSA-44 (FIPS 204).
 *    - A chave pública possui 1312 bytes.
 *    - O endereço Ethereum é derivado pegando os últimos 20 bytes do hash Keccak-256 da chave pública.
 * 
 * C. Híbrida (ECDSA + ML-DSA-44):
 *    - Combina segurança clássica (ECDSA / secp256k1) e pós-quântica (ML-DSA-44).
 *    - Derivada a partir de uma única semente de entropia de 32 bytes (privateKeySeed).
 *    - A chave pública ECDSA é descompactada (64 bytes, sem o prefixo 0x04).
 *    - A chave pública ML-DSA-44 possui 1312 bytes.
 *    - Ambas são concatenadas, formando uma chave pública composta de 1376 bytes.
 *    - O endereço Ethereum híbrido é derivado pegando os últimos 20 bytes do hash Keccak-256 da chave composta.
 * 
 * ----------------------------------------------------------------------------
 * 2. FLUXOS DE OPERAÇÃO
 * ----------------------------------------------------------------------------
 * 
 * FLOW A: Criação de Conta (createAccount)
 * [Escolha do Usuário] ──► [Gerar Chaves] ──► [Derivar Endereço] ──► [Salvar no Snap State] ──► [Notificar MetaMask]
 * 
 * FLOW B: Assinatura de Mensagem (personal_sign)
 * [DApp solicita personal_sign]
 *       │
 *       ├─► [Conta Híbrida]:
 *       │   1. Assina o hash da mensagem com ECDSA (recId + 27 no 65º byte).
 *       │   2. Concatena a mensagem original com essa assinatura clássica (65 bytes).
 *       │   3. Assina essa concatenação com ML-DSA-44.
 *       │   4. Concatena a assinatura ECDSA (65 bytes) com a assinatura ML-DSA-44 (2420 bytes) e retorna.
 *       │
 *       └─► [Conta ML-DSA Pura]:
 *           1. Assina a mensagem original diretamente com ML-DSA-44 (2420 bytes) e retorna.
 * 
 * FLOW C: Assinatura de Transação (eth_signTransaction) - Tipo 0x42 (Flexible EIP-1559)
 * [DApp envia Transação 0x42] ──► [Confirmação na UI da Snap] ──► [computeFlexibleEIP1559Preimage]
 *                                                                             │
 * [Retornar txData com R, S, V] ◄── [Gerar Assinatura Clássica/PQC] ◄── [Gerar recoveryHash]
 * 
 * ----------------------------------------------------------------------------
 * 3. LIÇÕES APRENDIDAS: O QUE FOI FEITO ERRADO ANTERIORMENTE (E NÃO DEVE SE REPETIR)
 * ----------------------------------------------------------------------------
 * [⚠️ CRÍTICO] ERRO DE RECUPERAÇÃO DO RECID (RECOVERY ID) EM TRANSAÇÕES HÍBRIDAS:
 * 
 * - O problema:
 *   Na primeira versão da assinatura de transação do tipo 0x42 (Flexible EIP-1559 do Besu), o 65º byte da assinatura
 *   ECDSA (o recovery ID ou recId) estava sendo codificado como "recId + 27" (27 ou 28), seguindo o padrão
 *   de assinaturas personalizadas da Ethereum (personal_sign).
 * 
 * - O impacto:
 *   O validador pós-quântico do Hyperledger Besu espera que o recovery ID no payload híbrido de transações seja
 *   estritamente o recId bruto: 0 ou 1. Como o Snap passava 27/28, a função de recuperação da chave pública ECDSA
 *   dentro do nó Besu tentava recuperar com o recId incorreto, derivando um endereço público de remetente completamente
 *   diferente do esperado (recuperava a conta errada "0x99f15eda..." ao invés da conta da MetaMask "0x90c63ac5...").
 *   Isso fazia com que as transações fossem rejeitadas por "assinatura inválida" ou "fundos insuficientes".
 * 
 * - A solução:
 *   No fluxo de assinatura de transações (eth_signTransaction), o 65º byte da assinatura clássica clássica deve
 *   ser exatamente 0 ou 1 (o recId retornado pela biblioteca criptográfica, sem somar 27). Isso garante que o nó
 *   Besu recupere a chave pública SECP256K1 original de forma correta.
 * 
 * ============================================================================
 */

// ============================================================================
// SEÇÃO DE CÓDIGOS LEGADOS / HISTÓRICOS (ARQUIVADOS APENAS PARA REFERÊNCIA)
// ============================================================================

// [ARQUIVO] Versão Inicial 1: RPC handler básico de teste simulado
// import { OnRpcRequestHandler } from '@metamask/snaps-sdk';
// type SnapState = { accounts: Array<{ address: string; type: string; publicKey: string; }>; };
// ... (comentado no código fonte original para manter histórico de desenvolvimento inicial)

// [ARQUIVO] Versão Inicial 2: Estrutura inicial do Keyring utilizando a Keyring API
// class PqcKeyring implements Keyring { ... }
// ... (comentado no código fonte original)

// ============================================================================
// SEÇÃO DE IMPLEMENTAÇÃO ATIVA E PRODUÇÃO
// ============================================================================

import './polyfills'; // Garante compatibilidade do ambiente do Snap com SES (Secure EcmaScript) da MetaMask.
import { OnRpcRequestHandler, OnKeyringRequestHandler } from '@metamask/snaps-sdk';
import { Box, Text, Bold } from '@metamask/snaps-sdk/jsx';
import type { Keyring, KeyringAccount, KeyringRequest, KeyringResponse } from '@metamask/keyring-api';
import { v4 as uuid } from 'uuid'; // Utilizado para gerar identificadores únicos para as contas.
import mldsa from 'mldsa-wasm'; // Wrapper WASM para criptografia pós-quântica ML-DSA-44.
import { keccak_256 } from '@noble/hashes/sha3'; // Implementação de hashing Keccak-256 (compatível com Ethereum).
import { secp256k1 } from '@noble/curves/secp256k1.js'; // Curva elíptica clássica do Ethereum para ECDSA.
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';

/**
 * Estrutura do estado persistido internamente no Snap.
 */
type SnapState = {
  accounts: KeyringAccount[];
  mnemonic?: string;
};

/**
 * Converte um buffer de bytes (Uint8Array) em uma string hexadecimal.
 * @param bytes Buffer de bytes de entrada.
 * @returns String hexadecimal resultante.
 */
const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/**
 * Converte uma string hexadecimal em um buffer de bytes (Uint8Array).
 * @param hex String hexadecimal de entrada (com ou sem o prefixo '0x').
 * @returns Buffer de bytes correspondente.
 */
const hexToBytes = (hex: string): Uint8Array => {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

/**
 * Concatena dois buffers de bytes.
 * @param a Primeiro buffer.
 * @param b Segundo buffer.
 * @returns Buffer unificado resultante da junção de a e b.
 */
const concatBytes = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const safeA = a instanceof Uint8Array ? a : new Uint8Array(0);
  const safeB = b instanceof Uint8Array ? b : new Uint8Array(0);
  const result = new Uint8Array(safeA.length + safeB.length);
  result.set(safeA);
  result.set(safeB, safeA.length);
  return result;
};

/**
 * Deriva deterministicamente uma semente de conta (child seed) de 32 bytes a partir de uma semente master
 * usando HMAC-SHA256, correspondente a um caminho de derivação customizado.
 * @param masterSeed Semente master de 32 bytes obtida da frase de recuperação.
 * @param index Índice da conta.
 * @returns Semente derivada de 32 bytes.
 */
const deriveChildSeed = (masterSeed: Uint8Array, index: number): Uint8Array => {
  const encoder = new TextEncoder();
  const path = `m/44'/60'/0'/0/${index}`;
  return hmac(sha256, masterSeed, encoder.encode(path));
};

/**
 * Implementação da interface Keyring da MetaMask.
 * Gerencia a criação de contas, listagem e assinatura de transações/mensagens.
 */
class PqcKeyring implements Keyring {
  
  /**
   * Obtém a lista de todas as contas cadastradas do estado persistido do Snap.
   * @returns Promessa com a lista de KeyringAccount.
   */
  async listAccounts(): Promise<KeyringAccount[]> {
    const state = await snap.request({
      method: 'snap_manageState',
      params: { operation: 'get' },
    }) as SnapState | null;

    return state?.accounts || [];
  }

  /**
   * Cria uma nova conta no Snap após interação com o usuário via diálogo.
   * Suporta três tipos: ECDSA simulada (1), ML-DSA-44 pura (2) e Híbrida (3).
   * 
   * FLOW DA CRIAÇÃO HÍBRIDA:
   * 1. Gera par de chaves ML-DSA-44 a partir do mldsa-wasm.
   * 2. Extrai a semente de entropia da chave privada (raw-seed).
   * 3. Deriva a chave pública ECDSA usando essa mesma semente clássica (garantindo vinculação determinística).
   * 4. Remove o prefixo 0x04 (deixando a chave uncompressed com 64 bytes).
   * 5. Concatena as chaves públicas: ECDSA (64 bytes) + ML-DSA-44 (1312 bytes) = 1376 bytes composto.
   * 6. Endereço é os últimos 20 bytes do Keccak256 da chave composta.
   */
  async createAccount(options: Record<string, any> = {}): Promise<KeyringAccount> {
    // 1. Obter o estado atual do Snap
    const state = await snap.request({
      method: 'snap_manageState',
      params: { operation: 'get' },
    }) as SnapState | null;

    let mnemonic = state?.mnemonic;

    // 2. Se não houver mnemônico no estado, solicitar ao usuário para gerar ou importar uma semente
    if (!mnemonic) {
      const initChoice = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'prompt',
          content: {
            type: 'panel',
            children: [
              { type: 'heading', value: 'Inicializar Carteira PQC' },
              { type: 'text', value: 'Nenhuma frase de recuperação encontrada.\n\nDigite **1** para Gerar Nova Frase\nDigite **2** para Importar Frase Existente:' },
            ],
          },
          placeholder: 'Ex: 1',
        },
      });

      if (!initChoice || (initChoice !== '1' && initChoice !== '2')) {
        throw new Error('Inicialização cancelada pelo usuário.');
      }

      if (initChoice === '1') {
        const entropy = crypto.getRandomValues(new Uint8Array(16));
        mnemonic = bip39.entropyToMnemonic(entropy, wordlist);

        await snap.request({
          method: 'snap_dialog',
          params: {
            type: 'alert',
            content: {
              type: 'panel',
              children: [
                { type: 'heading', value: 'Nova Frase de Recuperação' },
                { type: 'text', value: 'Guarde esta frase de recuperação em local seguro:' },
                { type: 'text', value: `**${mnemonic}**` },
              ],
            },
          },
        });
      } else {
        const mnemonicInput = await snap.request({
          method: 'snap_dialog',
          params: {
            type: 'prompt',
            content: {
              type: 'panel',
              children: [
                { type: 'heading', value: 'Importar Frase de Recuperação' },
                { type: 'text', value: 'Digite a sua frase de recuperação (separada por espaços):' },
              ],
            },
            placeholder: 'sua frase de recuperação...',
          },
        });

        if (!mnemonicInput) {
          throw new Error('Importação cancelada pelo usuário.');
        }

        const cleanedMnemonic = mnemonicInput.trim().replace(/\s+/g, ' ');
        if (!bip39.validateMnemonic(cleanedMnemonic, wordlist)) {
          throw new Error('Frase de recuperação inválida. Verifique a ortografia.');
        }

        mnemonic = cleanedMnemonic;
      }

      await snap.request({
        method: 'snap_manageState',
        params: {
          operation: 'update',
          newState: {
            accounts: state?.accounts || [],
            mnemonic,
          },
        },
      });
    }

    // 3. Solicita ao usuário qual tipo de conta ele deseja derivar da carteira
    const choice = await snap.request({
      method: 'snap_dialog',
      params: {
        type: 'prompt',
        content: {
          type: 'panel',
          children: [
            { type: 'heading', value: 'Derivar Nova Conta' },
            { type: 'text', value: 'Digite **1** para ECDSA Simulada, **2** para ML-DSA-44 (Pós-Quântica) ou **3** para Híbrida (ECDSA + ML-DSA-44):' },
          ],
        },
        placeholder: 'Ex: 3',
      },
    });

    if (!choice || (choice !== '1' && choice !== '2' && choice !== '3')) {
      throw new Error('Criação cancelada.');
    }

    // 4. Determinar o próximo índice de derivação
    const accounts = await this.listAccounts();
    let nextIndex = 0;
    if (accounts.length > 0) {
      const indices = accounts
        .map(a => a.options?.derivationIndex)
        .filter(idx => typeof idx === 'number') as number[];
      if (indices.length > 0) {
        nextIndex = Math.max(...indices) + 1;
      }
    }

    // 5. Converter o mnemônico para a semente master de 32 bytes (entropy)
    const masterSeed = bip39.mnemonicToEntropy(mnemonic, wordlist);

    // 6. Derivar a semente específica desta conta baseada no índice
    const seedBytes = deriveChildSeed(masterSeed, nextIndex);

    let newAccount: KeyringAccount;

    if (choice === '2') {
      // --- FLOW: CONTA ML-DSA PURA (PQC) DETERMINÍSTICA ---
      const keyPairPrivate = await mldsa.importKey("raw-seed", seedBytes, "ML-DSA-44", false, ["sign"]);
      const publicKey = await mldsa.getPublicKey(keyPairPrivate, ["verify"]);
      const pubKeyBuffer = await mldsa.exportKey("raw-public", publicKey);
      const pubKeyBytes = new Uint8Array(pubKeyBuffer);

      const hash = keccak_256(pubKeyBytes);
      const addressBytes = hash.slice(-20);
      const derivedAddress = '0x' + bytesToHex(addressBytes);

      newAccount = {
        id: uuid(),
        options: {
          isPQC: true,
          isHybrid: false,
          publicKey: bytesToHex(pubKeyBytes),
          privateKeySeed: bytesToHex(seedBytes),
          derivationIndex: nextIndex,
        },
        address: derivedAddress.toLowerCase(),
        methods: ['personal_sign', 'eth_signTransaction'],
        type: 'eip155:eoa', 
        scopes: ['eip155:0'],
      };
    } else if (choice === '3') {
      // --- FLOW: CONTA HÍBRIDA (ECDSA + ML-DSA-44) DETERMINÍSTICA ---
      // 1. Importar chave privada determinística a partir de seedBytes
      const keyPairPrivate = await mldsa.importKey("raw-seed", seedBytes, "ML-DSA-44", false, ["sign"]);

      // 2. Obter chave pública correspondente à chave privada
      const publicKey = await mldsa.getPublicKey(keyPairPrivate, ["verify"]);

      // 3. Exportar chave pública em formato bruto (raw)
      const pubKeyBuffer = await mldsa.exportKey("raw-public", publicKey);
      const mldsaPubKeyBytes = new Uint8Array(pubKeyBuffer);

      // 4. Derivar a chave pública clássica ECDSA usando a MESMA semente
      // O argumento 'false' gera a chave não compactada (65 bytes com prefixo 0x04)
      // .subarray(1) extrai do byte index 1 em diante, removendo o prefixo 0x04 e mantendo 64 bytes
      const ecdsaPubKeyBytes = secp256k1.getPublicKey(seedBytes, false).subarray(1);

      // 5. Concatenar chaves públicas (ECDSA de 64 bytes + ML-DSA-44 de 1312 bytes)
      const combinedPubKeyBytes = concatBytes(ecdsaPubKeyBytes, mldsaPubKeyBytes);

      // 6. Derivar endereço calculando hash Keccak-256 da chave composta e pegando os últimos 20 bytes
      const hash = keccak_256(combinedPubKeyBytes);
      const addressBytes = hash.slice(-20);
      const derivedAddress = '0x' + bytesToHex(addressBytes);

      newAccount = {
        id: uuid(),
        options: {
          isPQC: false,
          isHybrid: true,
          publicKey: bytesToHex(combinedPubKeyBytes),
          privateKeySeed: bytesToHex(seedBytes),
          derivationIndex: nextIndex,
        },
        address: derivedAddress.toLowerCase(),
        methods: ['personal_sign', 'eth_signTransaction'],
        type: 'eip155:eoa', 
        scopes: ['eip155:0'],
      };
    } else {
      // --- FLOW: CONTA ECDSA PADRÃO REAL DETERMINÍSTICA ---
      // 1. Derivar a chave pública clássica ECDSA a partir da semente (secp256k1)
      const ecdsaPubKeyBytes = secp256k1.getPublicKey(seedBytes, false).subarray(1); // 64 bytes sem prefixo 0x04

      // 2. Derivar o endereço Ethereum calculando o hash Keccak-256 da chave pública ECDSA (últimos 20 bytes)
      const hash = keccak_256(ecdsaPubKeyBytes);
      const addressBytes = hash.slice(-20);
      const derivedAddress = '0x' + bytesToHex(addressBytes);

      newAccount = {
        id: uuid(),
        options: { 
          isPQC: false, 
          isHybrid: false,
          publicKey: bytesToHex(ecdsaPubKeyBytes),
          privateKeySeed: bytesToHex(seedBytes),
          derivationIndex: nextIndex,
        },
        address: derivedAddress.toLowerCase(),
        methods: ['personal_sign', 'eth_signTransaction'],
        type: 'eip155:eoa', 
        scopes: ['eip155:0'],
      };
    }

    // Persiste a nova conta e o mnemônico no estado interno do Snap
    const updatedState = await snap.request({
      method: 'snap_manageState',
      params: { operation: 'get' },
    }) as SnapState | null;

    const currentAccounts = updatedState?.accounts || [];
    const existingIndex = currentAccounts.findIndex(
      (a) => a.address.toLowerCase() === newAccount.address.toLowerCase()
    );

    let finalAccounts: KeyringAccount[];
    if (existingIndex >= 0) {
      finalAccounts = [...currentAccounts];
      finalAccounts[existingIndex] = newAccount;
    } else {
      finalAccounts = [...currentAccounts, newAccount];
    }

    await snap.request({
      method: 'snap_manageState',
      params: { 
        operation: 'update', 
        newState: { 
          accounts: finalAccounts, 
          mnemonic: updatedState?.mnemonic || mnemonic 
        } 
      },
    });

    try {
      // Notifica a MetaMask de que a conta foi criada para que ela atualize a interface (UI)
      await snap.request({
        method: 'snap_manageAccounts',
        params: {
          method: 'notify:accountCreated',
          params: {
            account: newAccount,
          },
        },
      });
    } catch (error: any) {
      const errMessage = typeof error === 'string' ? error : (error?.message || JSON.stringify(error) || '');
      const isDuplicate = /duplicate|already exists|keyringcontroller/i.test(errMessage);

      if (isDuplicate) {
        console.warn('Conta já registrada no MetaMask, prosseguindo com salvamento no Snap State.');
      } else {
        console.error('Erro ao emitir o evento AccountCreated para o MetaMask:', error);
        throw new Error(`Erro ao notificar MetaMask: ${error?.message || error}`);
      }
    }

    return newAccount;
  }

  /**
   * Busca uma conta específica cadastrada no Snap com base no ID único.
   * @param id Identificador único da conta (UUID).
   */
  async getAccount(id: string): Promise<KeyringAccount | undefined> {
    const accounts = await this.listAccounts();
    return accounts.find(a => a.id === id);
  }
  
  // Métodos obrigatórios da interface Keyring que não possuem lógica customizada neste Snap
  async filterAccountChains(id: string, chains: string[]): Promise<string[]> { return chains; }
  async updateAccount(account: KeyringAccount): Promise<void> {}
  async deleteAccount(id: string): Promise<void> {}
  async listRequests(): Promise<any[]> { return []; }
  async getRequest(id: string): Promise<any> { return null; }
  
  /**
   * Ponto de entrada das solicitações de assinatura e operações da Keyring API.
   * Inclui tratamento de logs detalhados para depuração.
   */
  async submitRequest(request: KeyringRequest): Promise<KeyringResponse> {
    console.log('--- [SNAP PQC] submitRequest START ---');
    console.log('Method:', request.request.method);
    console.log('Request payload:', JSON.stringify(request));
    try {
      const response = await this.innerSubmitRequest(request);
      console.log('Response returned:', JSON.stringify(response));
      console.log('--- [SNAP PQC] submitRequest END (SUCCESS) ---');
      return response;
    } catch (error: any) {
      console.error('Error in submitRequest:', error.message || error);
      console.log('--- [SNAP PQC] submitRequest END (ERROR) ---');
      throw error;
    }
  }

  /**
   * Processa a assinatura de transações e assinaturas de mensagens (personal_sign).
   * 
   * FLUXO DE ASSINATURA HÍBRIDA (personal_sign):
   * 1. Assina a mensagem com a chave clássica ECDSA (secp256k1) gerando a assinatura clássica de 65 bytes.
   *    (Para personal_sign, o recovery ID no byte 65 recebe o offset + 27).
   * 2. Concatena a mensagem original com essa assinatura de 65 bytes.
   * 3. Importa a chave privada pós-quântica ML-DSA-44 a partir da semente de entropia.
   * 4. Assina o bloco concatenado (mensagem + assinatura clássica) com ML-DSA-44.
   * 5. Une a assinatura clássica (65 bytes) e a assinatura pós-quântica (2420 bytes) e retorna o hex.
   * 
   * FLUXO DE ASSINATURA DE TRANSAÇÃO (eth_signTransaction):
   * 1. Detecta o tipo de transação. Se for do tipo customizado do Besu 0x42 (Flexible EIP-1559):
   *    a. Calcula a preimage da transação.
   *    b. Calcula o recoveryHash correspondente (Keccak-256 da preimage).
   *    c. Se for conta Híbrida:
   *       - Assina o recoveryHash com ECDSA (SECP256K1).
   *       - [⚠️ CORREÇÃO DO BUG]: O 65º byte da assinatura clássica ECDSA (o recId) deve ser 0 ou 1.
   *         Não se deve somar 27, pois o validador pós-quântico do Besu falha na recuperação clássica se não for 0 ou 1.
   *       - Concatena o recoveryHash com a assinatura clássica (65 bytes) como payload para o ML-DSA.
   *       - Assina esse payload concatenado com a chave ML-DSA-44 para gerar a assinatura pós-quântica (pqcSignature).
   *       - Une a assinatura clássica com a assinatura pós-quântica.
   *    d. Retorna os campos r, s, e v estruturados para o MetaMask:
   *       - r = os 32 bytes de r da assinatura clássica.
   *       - s = concatenação de s da assinatura clássica (32 bytes) com a assinatura pós-quântica (2420 bytes).
   *       - v = recovery ID (0 ou 1).
   */
  async innerSubmitRequest(request: KeyringRequest): Promise<KeyringResponse> {
    const method = request.request.method;
    const params = request.request.params;

    if (method === 'personal_sign') {
      const message = params?.[0] as string;
      const address = params?.[1] as string;

      if (!message || !address) {
        throw new Error('Parâmetros inválidos para personal_sign.');
      }

      const accounts = await this.listAccounts();
      const account = accounts.find(a => a.address.toLowerCase() === address.toLowerCase());
      if (!account) {
        throw new Error(`Conta não encontrada para o endereço: ${address}`);
      }

      const seedHex = account.options.privateKeySeed as string;
      if (!seedHex) {
        throw new Error('Seed da chave privada não encontrado no estado da conta.');
      }

      const seedBytes = hexToBytes(seedHex);

      // Trata se a mensagem recebida é um hexadecimal ou string de texto simples
      let messageBytes: Uint8Array;
      if (message.startsWith('0x')) {
        messageBytes = hexToBytes(message);
      } else {
        messageBytes = new TextEncoder().encode(message);
      }

      let signatureHex: string;

      if (account.options.isHybrid) {
        // --- ASSINATURA HÍBRIDA PARA PERSONAL_SIGN ---
        const messageHash = keccak_256(messageBytes);
        const classicSignature = createClassicSignature(messageHash, seedBytes, true);

        // O payload para a assinatura pós-quântica é a concatenação dos bytes da mensagem original com a assinatura clássica
        const payloadForPqc = concatBytes(messageBytes, classicSignature);
        const privateKey = await mldsa.importKey("raw-seed", seedBytes, "ML-DSA-44", false, ["sign"]);
        const pqcSignatureBuffer = await mldsa.sign("ML-DSA-44", privateKey, payloadForPqc);
        const pqcSignature = new Uint8Array(pqcSignatureBuffer);

        // A assinatura híbrida final junta a assinatura clássica (65 bytes) com a pós-quântica (2420 bytes)
        const signatureBytes = concatBytes(classicSignature, pqcSignature);
        signatureHex = '0x' + bytesToHex(signatureBytes);
      } else if (account.options.isPQC) {
        // --- ASSINATURA ML-DSA PURA PARA PERSONAL_SIGN ---
        const privateKey = await mldsa.importKey("raw-seed", seedBytes, "ML-DSA-44", false, ["sign"]);
        const signatureBuffer = await mldsa.sign("ML-DSA-44", privateKey, messageBytes);
        signatureHex = '0x' + bytesToHex(new Uint8Array(signatureBuffer));
      } else {
        // --- ASSINATURA ECDSA PURA REAL PARA PERSONAL_SIGN ---
        const messageHash = keccak_256(messageBytes);
        const classicSignature = createClassicSignature(messageHash, seedBytes, true);
        signatureHex = '0x' + bytesToHex(classicSignature);
      }

      return {
        pending: false,
        result: signatureHex,
      };
    }

    if (method === 'eth_signTransaction') {
      const tx = params?.[0] as any;
      if (!tx || !tx.from) {
        throw new Error('Parâmetros inválidos para eth_signTransaction.');
      }

      const fromAddress = tx.from as string;
      const accounts = await this.listAccounts();
      const account = accounts.find(a => a.address.toLowerCase() === fromAddress.toLowerCase());
      if (!account) {
        throw new Error(`Conta não encontrada para o endereço de origem: ${fromAddress}`);
      }

      const seedHex = account.options.privateKeySeed as string;
      if (!seedHex) {
        throw new Error('Seed da chave privada não encontrado no estado da conta.');
      }

      const seedBytes = hexToBytes(seedHex);

      const type = tx.type === undefined ? 0x42 : typeof tx.type === 'string' ? parseInt(tx.type, 16) : tx.type;

      if (account.options.isPQC && (type === 2 || type === 0x02)) {
        throw new Error('Contas PQC Puras (ML-DSA-44) exigem o tipo de transação pós-quântico 0x42 (Flexible EIP-1559). Selecione 0x42 para realizar a transferência de PQC.');
      }

      if (type !== 0x42 && type !== 66 && type !== 2 && type !== 0x02) {
        throw new Error('Apenas o tipo de transação EIP-1559 (0x42 para PQC/Híbrida ou 0x02 para ECDSA) é suportado.');
      }

      let signatureHex: string;
      let pqcSignature: Uint8Array;
      let classicSignature: Uint8Array | undefined;

      let preimage: Uint8Array;
      if (type === 0x42 || type === 66) {
        preimage = computeFlexibleEIP1559Preimage(tx, account);
      } else {
        preimage = computeStandardEIP1559Preimage(tx);
      }

      const recoveryHash = keccak_256(preimage);

      console.log('--- [SNAP PQC LOG] eth_signTransaction ---');
      console.log('Preimage Hex:', '0x' + bytesToHex(preimage));
      console.log('RecoveryHash (signingHash):', '0x' + bytesToHex(recoveryHash));

      if (account.options.isHybrid) {
        // --- ASSINATURA HÍBRIDA PARA TRANSAÇÃO ---
        classicSignature = createClassicSignature(recoveryHash, seedBytes, false);

        // Concatena o hash de recuperação clássica com a assinatura clássica de 65 bytes
        const payloadForPqc = concatBytes(recoveryHash, classicSignature);
        const privateKey = await mldsa.importKey("raw-seed", seedBytes, "ML-DSA-44", false, ["sign"]);
        const pqcSignatureBuffer = await mldsa.sign("ML-DSA-44", privateKey, payloadForPqc);
        pqcSignature = new Uint8Array(pqcSignatureBuffer);

        // A assinatura final concatenada
        const signatureBytes = concatBytes(classicSignature, pqcSignature);
        signatureHex = '0x' + bytesToHex(signatureBytes);
      } else if (account.options.isPQC) {
        // --- ASSINATURA ML-DSA PURA PARA TRANSAÇÃO ---
        const privateKey = await mldsa.importKey("raw-seed", seedBytes, "ML-DSA-44", false, ["sign"]);
        const signatureBuffer = await mldsa.sign("ML-DSA-44", privateKey, recoveryHash);
        pqcSignature = new Uint8Array(signatureBuffer);
        signatureHex = '0x' + bytesToHex(pqcSignature);
      } else {
        // --- ASSINATURA ECDSA PURA REAL PARA TRANSAÇÃO (65 BYTES) ---
        classicSignature = createClassicSignature(recoveryHash, seedBytes, false);
        pqcSignature = new Uint8Array(0);
        signatureHex = '0x' + bytesToHex(classicSignature);
      }

      // Prepara o objeto TxData de retorno para a MetaMask.
      // O objeto precisa mapear exatamente os campos da transação original.
      const txData: any = {
        nonce: tx.nonce,
        gasLimit: tx.gasLimit || tx.gas,
        to: tx.to,
        value: tx.value,
        data: tx.data,
        chainId: tx.chainId,
        type: tx.type,
      };

      if (tx.maxFeePerGas !== undefined) {
        txData.maxFeePerGas = tx.maxFeePerGas;
      }
      if (tx.maxPriorityFeePerGas !== undefined) {
        txData.maxPriorityFeePerGas = tx.maxPriorityFeePerGas;
      }
      if (tx.accessList !== undefined) {
        txData.accessList = tx.accessList;
      }

      let rHex: string;
      let sHex: string;
      let vHex: string;

      if (classicSignature) {
        // Na transação ECDSA ou Híbrida EIP-1559:
        // - R é a assinatura R clássica (32 bytes).
        // - S é o S clássico (32 bytes) concatenado com a assinatura pós-quântica (se houver).
        // - V é o recovery ID (0 ou 1) para EIP-1559.
        rHex = '0x' + bytesToHex(classicSignature.subarray(0, 32));
        sHex = '0x' + bytesToHex(classicSignature.subarray(32, 64)) + bytesToHex(pqcSignature);
        const recoveryId = classicSignature[64]; // 0 ou 1
        vHex = '0x' + recoveryId.toString(16);
      } else {
        // Para contas ML-DSA Puras:
        // - R é preenchido com zeros (32 bytes de 0).
        // - S é a assinatura ML-DSA-44 diretamente (2420 bytes).
        // - V é 0 para EIP-1559.
        rHex = '0x' + '0'.repeat(64);
        sHex = '0x' + bytesToHex(pqcSignature);
        vHex = '0x0';
      }

      txData.r = rHex;
      txData.s = sHex;
      txData.v = vHex;

      // Adiciona metadados adicionais úteis de assinatura no retorno
      txData.pqcSignature = '0x' + bytesToHex(pqcSignature);
      txData.signatureHex = signatureHex;

      return {
        pending: false,
        result: txData,
      };
    }

    throw new Error(`Método submitRequest não suportado: ${method}`);
  }

  async approveRequest(id: string, data?: any): Promise<void> {}
  async rejectRequest(id: string): Promise<void> {}
}

// Instanciação global do controlador do Keyring
const pqcKeyring = new PqcKeyring();

/**
 * PORTA 1: Ponto de entrada oficial para as solicitações internas da MetaMask Keyring API.
 * Recebe chamadas como listing, creation e submitRequest e delega para o pqcKeyring.
 */
export const onKeyringRequest: OnKeyringRequestHandler = async ({ origin, request }) => {
  switch (request.method) {
    case 'keyring_listAccounts':
      return await pqcKeyring.listAccounts();
      
    case 'keyring_createAccount':
      return await pqcKeyring.createAccount();
      
    case 'keyring_getAccount':
      return await pqcKeyring.getAccount((request.params as any).id);

    case 'keyring_submitRequest': {
      const keyringRequest = Array.isArray(request.params) ? request.params[0] : request.params;
      return await pqcKeyring.submitRequest(keyringRequest as any);
    }
      
    default:
      throw new Error(`Método Keyring não suportado: ${request.method}`);
  }
};

/**
 * Cria uma assinatura SECP256K1 clássica de 65 bytes (32 bytes r + 32 bytes s + 1 byte recoveryId/v).
 */
function createClassicSignature(hash: Uint8Array, seedBytes: Uint8Array, addV27: boolean = false): Uint8Array {
  const sigObj = secp256k1.sign(hash, seedBytes, { format: 'recovered', prehash: false });
  const classicSig = new Uint8Array(65);

  const recId = sigObj[0];
  classicSig.set(sigObj.subarray(1, 65), 0);
  classicSig[64] = addV27 ? recId + 27 : recId;

  return classicSig;
}

// ============================================================================
// AUXILIARES DE SERIALIZAÇÃO DE TRANSAÇÃO (RLP ENCODER)
// ============================================================================

/**
 * Converte diferentes tipos de dados em um buffer de bytes (Uint8Array).
 * Necessário para o codificador RLP.
 */
function toBuffer(val: any): Uint8Array {
  if (val === undefined || val === null) {
    return new Uint8Array(0);
  }
  if (val instanceof Uint8Array) {
    return val;
  }
  if (typeof val === 'string') {
    if (val.startsWith('-') || val.startsWith('0x-')) {
      return new Uint8Array(0);
    }
    let clean = val.startsWith('0x') ? val.slice(2) : val;
    if (clean.startsWith('-')) {
      return new Uint8Array(0);
    }
    // Se o tamanho da string hex for ímpar, adiciona 0 à esquerda
    if (clean.length % 2 !== 0) {
      clean = '0' + clean;
    }
    // "0x0" ou vazio são mapeados para buffer vazio
    if (clean === '00' || clean === '') {
      return new Uint8Array(0);
    }
    return hexToBytes(clean);
  }
  if (typeof val === 'number') {
    return numberToBytes(val);
  }
  if (typeof val === 'bigint') {
    let hex = val.toString(16);
    if (hex.length % 2 !== 0) {
      hex = '0' + hex;
    }
    return hexToBytes(hex);
  }
  throw new Error('Cannot convert value to buffer');
}

/**
 * Converte um número decimal em uma representação de bytes mínima (Uint8Array).
 */
function numberToBytes(num: number): Uint8Array {
  if (num === 0) {
    return new Uint8Array(0);
  }
  const hex = num.toString(16);
  const padded = hex.length % 2 === 0 ? hex : '0' + hex;
  return hexToBytes(padded);
}

/**
 * Codificador RLP (Recursive Length Prefix) simplificado em TypeScript.
 * Utilizado para empacotar transações Ethereum em formato binário padronizado.
 * @param item O item (buffer de bytes) ou lista de itens a serem codificados.
 */
function encodeRLP(item: any): Uint8Array {
  if (item === undefined || item === null) {
    return new Uint8Array([0x80]);
  }
  if (item instanceof Uint8Array) {
    if (item.length === 1 && item[0] < 0x80) {
      return item;
    }
    if (item.length < 56) {
      const header = new Uint8Array(1);
      header[0] = 0x80 + item.length;
      return concatBytes(header, item);
    }
    const lenBytes = numberToBytes(item.length);
    const header = new Uint8Array(1 + lenBytes.length);
    header[0] = 0xb7 + lenBytes.length;
    header.set(lenBytes, 1);
    return concatBytes(header, item);
  }
  if (Array.isArray(item)) {
    let payload = new Uint8Array(0);
    for (const subItem of item) {
      const encodedSub = encodeRLP(subItem);
      if (encodedSub instanceof Uint8Array) {
        payload = concatBytes(payload, encodedSub);
      }
    }
    if (payload.length < 56) {
      const header = new Uint8Array(1);
      header[0] = 0xc0 + payload.length;
      return concatBytes(header, payload);
    }
    const lenBytes = numberToBytes(payload.length);
    const header = new Uint8Array(1 + lenBytes.length);
    header[0] = 0xf7 + lenBytes.length;
    header.set(lenBytes, 1);
    return concatBytes(header, payload);
  }
  return new Uint8Array([0x80]);
}

/**
 * Converte um valor curto (16 bits) para um buffer de 2 bytes (Big Endian).
 */
function shortToBytes(val: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = (val >> 8) & 0xff;
  buf[1] = val & 0xff;
  return buf;
}

/**
 * Calcula a preimage RLP de transações híbridas/PQC (tipo 0x42) do Hyperledger Besu.
 * O preimage serve como payload para a assinatura.
 * 
 * ESTRUTURA RLP DO PREIMAGE TIPO 0x42:
 * [
 *   dsaType (0x0060 para híbrido, 0x0030 para ML-DSA),
 *   chainId,
 *   nonce,
 *   maxPriorityFeePerGas,
 *   maxFeePerGas,
 *   gasLimit,
 *   to,
 *   value,
 *   data,
 *   accessList,
 *   pqcPublicKey (Chave pública ML-DSA extraída)
 * ]
 */
/**
 * Computa a preimage (assinatura prévia) para transações pós-quânticas / híbridas EIP-1559 (Tipo 0x42).
 * Estrutura: 0x42 || RLP([dsaType, chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList, pqcPublicKey])
 */
function computeFlexibleEIP1559Preimage(tx: any, account: any): Uint8Array {
  const compositePkHex = (account?.options?.publicKey as string) || '';
  const compositePkBytes = hexToBytes(compositePkHex);
  let pqcPublicKeyBytes: Uint8Array;

  if (account?.options?.isHybrid) {
    pqcPublicKeyBytes = compositePkBytes.length === 1377 
      ? compositePkBytes.subarray(65) 
      : compositePkBytes.subarray(64);
  } else {
    pqcPublicKeyBytes = compositePkBytes;
  }

  const dsaType = account?.options?.isHybrid ? 0x0060 : 0x0030;

  const accessList = (tx.accessList || []).map((item: any) => {
    return [
      toBuffer(item.address),
      (item.storageKeys || []).map((k: any) => toBuffer(k))
    ];
  });

  const rlpInput = [
    shortToBytes(dsaType),
    toBuffer(tx.chainId),
    toBuffer(tx.nonce),
    toBuffer(tx.maxPriorityFeePerGas || tx.gasPrice),
    toBuffer(tx.maxFeePerGas || tx.gasPrice),
    toBuffer(tx.gasLimit || tx.gas),
    toBuffer(tx.to),
    toBuffer(tx.value),
    toBuffer(tx.data),
    accessList,
    toBuffer(pqcPublicKeyBytes)
  ];

  return concatBytes(new Uint8Array([0x42]), encodeRLP(rlpInput));
}

/**
 * Computa a preimage (assinatura prévia) para transações EIP-1559 convencionais (Tipo 0x02).
 * Estrutura: 0x02 || RLP([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList])
 */
function computeStandardEIP1559Preimage(tx: any): Uint8Array {
  const accessList = (tx.accessList || []).map((item: any) => {
    return [
      toBuffer(item.address),
      (item.storageKeys || []).map((k: any) => toBuffer(k))
    ];
  });

  const rlpInput = [
    toBuffer(tx.chainId),
    toBuffer(tx.nonce),
    toBuffer(tx.maxPriorityFeePerGas || tx.gasPrice),
    toBuffer(tx.maxFeePerGas || tx.gasPrice),
    toBuffer(tx.gasLimit || tx.gas),
    toBuffer(tx.to),
    toBuffer(tx.value),
    toBuffer(tx.data),
    accessList
  ];

  return concatBytes(new Uint8Array([0x02]), encodeRLP(rlpInput));
}

/**
 * Computa a preimage (assinatura prévia) para transações EIP-2930 Access List convencionais (Tipo 0x01).
 * Estrutura: 0x01 || RLP([chainId, nonce, gasPrice, gasLimit, to, value, data, accessList])
 */
function computeStandardAccessListPreimage(tx: any): Uint8Array {
  const accessList = (tx.accessList || []).map((item: any) => {
    return [
      toBuffer(item.address),
      (item.storageKeys || []).map((k: any) => toBuffer(k))
    ];
  });

  const rlpInput = [
    toBuffer(tx.chainId),
    toBuffer(tx.nonce),
    toBuffer(tx.gasPrice),
    toBuffer(tx.gasLimit || tx.gas),
    toBuffer(tx.to),
    toBuffer(tx.value),
    toBuffer(tx.data),
    accessList
  ];

  return concatBytes(new Uint8Array([0x01]), encodeRLP(rlpInput));
}

/**
 * Converte a transação assinada e os parâmetros de assinatura na string hexadecimal serializada RLP final.
 * Esta string é a que é transmitida para a rede Ethereum.
 * Suporta apenas transações EIP-1559: 0x42 (Besu Flexible EIP-1559) e 0x02 (Standard EIP-1559).
 */
function serializeTransaction(tx: any, v: any, r: any, s: any, account?: any, signatureBytes?: Uint8Array): string {
  const type = tx.type === undefined ? 0x42 : typeof tx.type === 'string' ? parseInt(tx.type, 16) : tx.type;

  if (type === 0x42 || type === 66) {
    // --- SERIALIZAÇÃO BESU FLEXIBLE EIP-1559 (TIPO 0x42) ---
    if (!account) {
      throw new Error('A conta é necessária para serializar FLEXIBLE_EIP1559.');
    }
    const compositePkHex = account.options.publicKey;
    const compositePkBytes = hexToBytes(compositePkHex);
    let pqcPublicKey: Uint8Array;
    if (account.options.isHybrid) {
      pqcPublicKey = compositePkBytes.length === 1377 ? compositePkBytes.subarray(65) : compositePkBytes.subarray(64);
    } else {
      pqcPublicKey = compositePkBytes;
    }

    const accessList = (tx.accessList || []).map((item: any) => {
      return [
        toBuffer(item.address),
        (item.storageKeys || []).map((k: any) => toBuffer(k))
      ];
    });

    const dsaType = account.options.isHybrid ? 0x0060 : 0x0030;

    const rlpInput = [
      shortToBytes(dsaType),
      toBuffer(tx.chainId),
      toBuffer(tx.nonce),
      toBuffer(tx.maxPriorityFeePerGas || tx.gasPrice),
      toBuffer(tx.maxFeePerGas || tx.gasPrice),
      toBuffer(tx.gasLimit || tx.gas),
      toBuffer(tx.to),
      toBuffer(tx.value),
      toBuffer(tx.data),
      accessList,
      toBuffer(pqcPublicKey),
      toBuffer(signatureBytes || new Uint8Array(0)) // Assinatura híbrida final vai como o 12º elemento no RLP
    ];

    const rawBytes = concatBytes(new Uint8Array([0x42]), encodeRLP(rlpInput));
    return '0x' + bytesToHex(rawBytes);
  }

  if (type === 2 || type === 0x02) {
    // --- SERIALIZAÇÃO EIP-1559 CONVENCIONAL ---
    const accessList = (tx.accessList || []).map((item: any) => {
      return [
        toBuffer(item.address),
        (item.storageKeys || []).map((k: any) => toBuffer(k))
      ];
    });

    const rlpInput = [
      toBuffer(tx.chainId),
      toBuffer(tx.nonce),
      toBuffer(tx.maxPriorityFeePerGas),
      toBuffer(tx.maxFeePerGas),
      toBuffer(tx.gasLimit || tx.gas),
      toBuffer(tx.to),
      toBuffer(tx.value),
      toBuffer(tx.data),
      accessList,
      toBuffer(v),
      toBuffer(r),
      toBuffer(s)
    ];

    const rawBytes = concatBytes(new Uint8Array([2]), encodeRLP(rlpInput));
    return '0x' + bytesToHex(rawBytes);
  }

  throw new Error(`Tipo de transação não suportado: ${type}. Apenas EIP-1559 (0x42 ou 0x02) é permitido.`);
}

// --- FIM DOS AUXILIARES DE SERIALIZAÇÃO ---

/**
 * PORTA 2: Ponto de entrada RPC para o site/DApp de testes.
 * Processa requisições vindas do front-end que não passam pela Keyring API interna da MetaMask.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) => {
  switch (request.method) {
    case 'hello':
      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: (
            <Box>
              <Text>
                Hello, <Bold>{origin}</Bold>!
              </Text>
              <Text>This custom confirmation is just for display purposes.</Text>
              <Text>
                But you can edit the snap source code to make it do something, if
                you want to!
              </Text>
            </Box>
          ),
        },
      });
    


    case 'keyring_createAccount':
    case 'create_account':
      return await pqcKeyring.createAccount();
      
    case 'keyring_listAccounts':
    case 'get_accounts':
    case 'eth_accounts':
      return await pqcKeyring.listAccounts();

    /**
     * Método RPC principal chamado pelo site de testes para assinar transações.
     * 
     * FLOW DO SIGN_TRANSACTION (RPC):
     * 1. Exibe diálogo de confirmação (snap_dialog do tipo 'confirmation') na MetaMask.
     * 2. Se confirmado pelo usuário, executa a assinatura chamando o Keyring internamente (innerSubmitRequest).
     * 3. Obtém a resposta contendo r, s, v e a assinatura híbrida completa em hex.
     * 4. Ajusta o 65º byte da assinatura clássica para garantir que o recId esteja limpo (formato 0/1 do Besu).
     * 5. Serializa a transação em formato binário RLP (serializeTransaction).
     * 6. Calcula o Hash da transação executando o Keccak-256 dos bytes serializados.
     * 7. Retorna a transação serializada (pronta para broadcast) e o hash gerado.
     */
    case 'sign_transaction': {
      const params = request.params as any;
      const tx = (Array.isArray(params) ? params[0] : params?.tx) || params;
      if (!tx || !tx.from) {
        throw new Error('Parâmetros inválidos para sign_transaction.');
      }

      const fromAddress = tx.from as string;
      const accounts = await pqcKeyring.listAccounts();
      const account = accounts.find(a => a.address.toLowerCase() === fromAddress.toLowerCase());
      if (!account) {
        throw new Error(`Conta não encontrada para o endereço de origem: ${fromAddress}`);
      }

      // 1. Mostrar diálogo de confirmação da transação na MetaMask
      const formattedValue = tx.value 
        ? (parseFloat(BigInt(tx.value).toString()) / 1e18).toString() + ' ETH'
        : '0 ETH';

      const confirmed = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: {
            type: 'panel',
            children: [
              { type: 'heading', value: 'Assinar Transação Híbrida/PQC' },
              { type: 'text', value: `Dapp Origin: ${origin}` },
              { type: 'text', value: `De: ${fromAddress}` },
              { type: 'text', value: `Para: ${tx.to || 'Criação de Contrato'}` },
              { type: 'text', value: `Valor: ${formattedValue}` },
              { type: 'text', value: `Tipo de Assinatura: ${account.options.isHybrid ? 'Híbrida (ECDSA + ML-DSA)' : 'ML-DSA-44 Pura'}` }
            ]
          }
        }
      });

      if (!confirmed) {
        throw new Error('Transação cancelada pelo usuário.');
      }

      // 2. Chamar a assinatura interna do Keyring
      console.log('--- [SNAP PQC] sign_transaction: chamando assinatura interna ---');
      console.log('Parâmetros de entrada da transação:', JSON.stringify(tx));

      const keyringResponse = await pqcKeyring.innerSubmitRequest({
        id: uuid(),
        scope: 'eip155:0',
        request: {
          method: 'eth_signTransaction',
          params: [tx]
        }
      });

      const signedTxData = keyringResponse.result as any;
      console.log('Dados assinados retornados pelo Keyring:', JSON.stringify(signedTxData));

      // Extrai os bytes da assinatura híbrida gerada (ECDSASignature + PQCSignature)
      const fullSigBytes = hexToBytes(signedTxData.signatureHex.slice(2));
      let signatureBytes: Uint8Array;
      if (account.options.isHybrid) {
        signatureBytes = new Uint8Array(fullSigBytes.length);
        signatureBytes.set(fullSigBytes);
        // [⚠️ OBSERVACÃO DE SEGURANÇA]: O 65º byte da assinatura clássica já está no formato 0/1 (recId do SECP)
        // por conta da correção implementada na linha classicSignature[64] = ecdsaSig[0].
      } else {
        signatureBytes = fullSigBytes;
      }

      // 3. Serializar transação usando RLP local no Snap
      const serializedTx = serializeTransaction(
        tx,
        signedTxData.v,
        signedTxData.r,
        signedTxData.s,
        account,
        signatureBytes
      );
      console.log('Transação serializada (RLP):', serializedTx);

      // Calcular o hash final da transação
      const serializedBytes = hexToBytes(serializedTx.startsWith('0x') ? serializedTx.slice(2) : serializedTx);
      const txHash = '0x' + bytesToHex(keccak_256(serializedBytes));

      return {
        serializedTx,
        txHash
      };
    }
      
    default:
      throw new Error('Método RPC não encontrado.');
  }
};