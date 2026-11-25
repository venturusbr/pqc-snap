import { Box, Heading, Text, Copyable } from '@metamask/snaps-sdk/jsx';
import type { KeyringAccount } from '@metamask/keyring-api';
import type { SnapState, TxTelemetry } from '../../types';

const MAX_TX_HISTORY = 15;

/**
 * Lê o estado atual persistido do Snap.
 */
export async function getState(): Promise<SnapState> {
  const state = (await snap.request({
    method: 'snap_manageState',
    params: { operation: 'get' },
  })) as SnapState | null;

  return state || { accounts: [] };
}

/**
 * Atualiza o estado persistido do Snap de forma atômica.
 */
export async function updateState(partial: Partial<SnapState>): Promise<SnapState> {
  const current = await getState();
  const newState: SnapState = { ...current, ...partial };

  await snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'update',
      newState,
    },
  });

  return newState;
}

/**
 * Obtém a conta atualmente selecionada (ou a primeira conta disponível).
 */
export function getActiveAccount(state: SnapState): KeyringAccount | undefined {
  const accounts = state.accounts || [];
  if (accounts.length === 0) return undefined;
  if (!state.selectedAccountAddress) return accounts[0];

  const found = accounts.find(
    (a) => a.address.toLowerCase() === state.selectedAccountAddress?.toLowerCase(),
  );
  return found || accounts[0];
}

/**
 * Exibe uma caixa de diálogo informativa (Alerta) de forma concisa.
 */
export async function showAlert(
  title: string,
  message: string,
  copyableVal?: string,
): Promise<void> {
  await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'alert',
      content: (
        <Box>
          <Heading>{title}</Heading>
          <Text>{message}</Text>
          {copyableVal ? <Copyable value={copyableVal} /> : null}
        </Box>
      ),
    },
  });
}

/**
 * Exibe uma caixa de diálogo de confirmação (Sim/Não).
 */
export async function showConfirm(
  title: string,
  content: any,
): Promise<boolean> {
  const result = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: (
        <Box>
          <Heading>{title}</Heading>
          {content}
        </Box>
      ),
    },
  });
  return Boolean(result);
}

/**
 * Exibe uma caixa de diálogo de entrada de texto (Prompt).
 */
export async function showPrompt(
  title: string,
  message: string,
  placeholder?: string,
): Promise<string | null> {
  const result = (await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'prompt',
      content: (
        <Box>
          <Heading>{title}</Heading>
          <Text>{message}</Text>
        </Box>
      ),
      placeholder,
    },
  })) as string | null;

  return result;
}

/**
 * Proteção contra substituição acidental da carteira: oferece o backup da frase atual e exige
 * que o usuário digite uma palavra de confirmação. Retorna true se pode prosseguir.
 */
export async function confirmWalletOverwrite(state: SnapState): Promise<boolean> {
  if (!state.mnemonic) return true;

  const count = (state.accounts || []).length;
  const proceed = await showConfirm(
    'Aviso de Substituição',
    <Text>
      Já existe uma carteira configurada ({String(count)} conta(s)). Substituir a frase APAGA todas as contas atuais e
      os fundos nelas ficam inacessíveis sem o backup da frase atual. Deseja ver a frase atual para backup e continuar?
    </Text>,
  );
  if (!proceed) return false;

  await showAlert('Backup da Frase Atual', 'Guarde estas 24 palavras antes de continuar:', state.mnemonic);

  const typed = await showPrompt('Confirmação Final', 'Digite SUBSTITUIR (em maiúsculas) para apagar a carteira atual:');
  return typed === 'SUBSTITUIR';
}

/**
 * Adiciona uma entrada de telemetria ao histórico limitado (máx. 15 transações) no estado do Snap.
 */
export async function appendTxTelemetryToHistory(
  telemetry: TxTelemetry,
  extraState: Partial<SnapState> = {},
): Promise<SnapState> {
  const current = await getState();
  const prevHistory = Array.isArray(current.txHistory) ? current.txHistory : [];
  const filtered = prevHistory.filter(
    (item) => item.id !== telemetry.id && item.txHash !== telemetry.txHash,
  );
  const nextHistory = [telemetry, ...filtered].slice(0, MAX_TX_HISTORY);

  return await updateState({
    lastTxTelemetry: telemetry,
    selectedLogId: telemetry.id,
    txHistory: nextHistory,
    ...extraState,
  });
}