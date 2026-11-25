import type { TabType } from '../../types';
import { renderHomePage } from '../homePage';
import { updateState } from '../helpers';

const tabMap: Record<string, TabType> = {
  nav_go_menu: 'menu',
  nav_go_accounts: 'accounts',
  nav_go_manage: 'manage',
  nav_go_dsa: 'dsa',
  nav_go_tx: 'tx',
  nav_go_contracts: 'contracts',
  nav_go_logs: 'logs',
  nav_tab_accounts: 'accounts',
  nav_tab_manage: 'manage',
  nav_tab_dsa: 'dsa',
  nav_tab_tx: 'tx',
  nav_tab_contracts: 'contracts',
  nav_tab_logs: 'logs',
};

export async function handleNavigation(id: string, eventName: string): Promise<boolean> {
  const nextTab = tabMap[eventName];
  if (!nextTab) return false;

  const newState = await updateState({ activeTab: nextTab });

  await snap.request({
    method: 'snap_updateInterface',
    params: {
      id,
      ui: renderHomePage(newState),
    },
  });

  return true;
}
