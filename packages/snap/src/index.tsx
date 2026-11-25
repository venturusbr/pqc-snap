/**
 * ============================================================================
 * METAMASK PQC SNAP - ARQUITETURA MODULAR
 * ============================================================================
 */

import type {
  OnRpcRequestHandler,
  OnKeyringRequestHandler,
  OnHomePageHandler,
  OnUserInputHandler,
} from '@metamask/snaps-sdk';
import { Box, Text, Bold } from '@metamask/snaps-sdk/jsx';
import { generateMnemonic, validateMnemonic } from './crypto';
import { pqcKeyring } from './keyring';
import { internalSignAndSerializeTx } from './transactions';
import { assertAllowedOrigin } from './constants';
import {
  confirmWalletOverwrite,
  renderTxDetails,
  renderHomePage,
  handleUserInputEvent,
  getState,
  updateState,
  appendTxTelemetryToHistory,
  showAlert,
  showConfirm,
  showPrompt,
} from './ui';

/**
 * PORTA 1: MetaMask Keyring API
 */
export const onKeyringRequest: OnKeyringRequestHandler = async ({ request }) => {
  switch (request.method) {
    case 'keyring_listAccounts':
      return await pqcKeyring.listAccounts();
    case 'keyring_createAccount':
      return await pqcKeyring.createAccount();
    case 'keyring_getAccount':
      return (await pqcKeyring.getAccount((request.params as any).id)) ?? null;
    case 'keyring_submitRequest': {
      const keyringRequest = Array.isArray(request.params) ? request.params[0] : request.params;
      return await pqcKeyring.submitRequest(keyringRequest as any);
    }
    default:
      throw new Error(`Método Keyring não suportado: ${request.method}`);
  }
};

/**
 * PORTA 2: Ponto de entrada RPC externo (DApp / Scripts)
 */
export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) => {
  switch (request.method) {
    case 'hello':
      await showAlert('Olá!', `Origem da chamada: ${origin}`);
      return { success: true };

    case 'initialize_wallet': {
      assertAllowedOrigin(origin);
      const state = await getState();
      if (!(await confirmWalletOverwrite(state))) throw new Error('Inicialização cancelada.');

      const initChoice = await showPrompt(
        'Inicializar Carteira PQC',
        'Digite 1 para Gerar Nova Frase ou 2 para Importar Frase Existente:',
        '1',
      );

      if (initChoice === '1') {
        const newMnemonic = generateMnemonic();
        await showAlert('Nova Frase (24 palavras)', 'Guarde sua frase em local seguro:', newMnemonic);
        await updateState({ accounts: [], mnemonic: newMnemonic });
      } else if (initChoice === '2') {
        const mnemonicInput = await showPrompt('Importar Carteira', 'Digite as 24 palavras separadas por espaço:');
        if (!mnemonicInput) throw new Error('Importação cancelada.');
        const cleaned = mnemonicInput.trim().toLowerCase().replace(/\s+/g, ' ');
        if (!validateMnemonic(cleaned)) throw new Error('Frase inválida BIP-39.');
        await updateState({ accounts: [], mnemonic: cleaned });
      } else {
        throw new Error('Opção cancelada.');
      }

      return { success: true, message: 'Carteira inicializada com sucesso!' };
    }

    case 'keyring_createAccount':
    case 'create_account':
      assertAllowedOrigin(origin);
      return await pqcKeyring.createAccount();

    case 'keyring_listAccounts':
    case 'get_accounts':
    case 'eth_accounts':
      return await pqcKeyring.listAccounts();

    case 'sign_transaction': {
      assertAllowedOrigin(origin);
      const params = request.params as any;
      const tx = (Array.isArray(params) ? params[0] : params?.tx) || params;
      if (!tx?.from) throw new Error('Parâmetros inválidos para sign_transaction.');

      const accounts = await pqcKeyring.listAccounts();
      const account = accounts.find((a) => a.address.toLowerCase() === (tx.from as string).toLowerCase());
      if (!account) throw new Error(`Conta não encontrada: ${tx.from}`);

      const confirmed = await showConfirm(
        'Assinar Transação PQC',
        renderTxDetails(tx, origin, account),
      );
      if (!confirmed) throw new Error('Transação cancelada.');

      const res = await internalSignAndSerializeTx(tx, account);
      if (res.telemetry) {
        const externalTelemetry = {
          ...res.telemetry,
          steps: [
            {
              step: 0,
              label: `Origem Externa RPC (${origin})`,
              detail: 'Transação recebida via método sign_transaction',
              status: 'ok' as const,
            },
            ...res.telemetry.steps.map((s, idx) => ({ ...s, step: idx + 1 })),
          ],
        };
        await appendTxTelemetryToHistory(externalTelemetry);
        return { ...res, telemetry: externalTelemetry };
      }
      return res;
    }

    default:
      throw new Error(`Método RPC não encontrado: ${request.method}`);
  }
};

/**
 * PORTA 3: Home Page do Snap no MetaMask
 */
export const onHomePage: OnHomePageHandler = async () => {
  const state = await getState();
  const id = (await snap.request({
    method: 'snap_createInterface',
    params: { ui: renderHomePage(state) },
  })) as string;

  return { id };
};

/**
 * PORTA 4: Despachante de eventos da interface
 */
export const onUserInput: OnUserInputHandler = async ({ id, event }) => {
  await handleUserInputEvent(id, event);
};