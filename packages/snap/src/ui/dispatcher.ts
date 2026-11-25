import type { UserInputEvent } from '@metamask/snaps-sdk';
import { renderHomePage } from './homePage';
import {
  handleNavigation,
  handleWalletEvents,
  handleTxEvents,
  handleContractsEvents,
  handleRpcEvents,
} from './handlers';
import { getState } from './helpers';

/**
 * Roteador central de eventos disparados pela UI do Snap (cliques, submits e inputs).
 */
export async function handleUserInputEvent(id: string, event: UserInputEvent): Promise<void> {
  console.log('--- [SNAP PQC] User Input Event:', event.name, event.type);

  // 1. Navegação entre abas
  const isNav = await handleNavigation(id, event.name);
  if (isNav) return;

  // 2. Módulos de Ação
  await handleWalletEvents(event.name);
  await handleTxEvents(id, event as any);
  await handleContractsEvents(event.name, (event as any).value);
  await handleRpcEvents(event.name, (event as any).value);

  // 3. Atualiza a interface da Home Page com o estado final persistido
  const updatedState = await getState();
  await snap.request({
    method: 'snap_updateInterface',
    params: {
      id,
      ui: renderHomePage(updatedState),
    },
  });
}
