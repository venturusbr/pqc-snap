import {
  Box,
  Heading,
  Text,
  Bold,
  Italic,
  Divider,
  Button,
  Section,
} from '@metamask/snaps-sdk/jsx';
import type { SnapState } from '../types';
import {
  MenuTab,
  AccountsTab,
  ManageTab,
  DsaTab,
  TxTab,
  ContractsTab,
  LogsTab,
} from './tabs';

/**
 * Renderiza os componentes JSX da Home Page do Snap dentro da extensão do MetaMask.
 */
export function renderHomePage(state: SnapState | null) {
  const activeTab = state?.activeTab || 'menu';

  const breadcrumbName =
    activeTab === 'accounts'
      ? 'Informações da Conta'
      : activeTab === 'manage'
      ? 'Gerar / Adicionar Contas'
      : activeTab === 'dsa'
      ? 'DSAs Suportados'
      : activeTab === 'contracts'
      ? 'Contratos, Delegação e Blob'
      : activeTab === 'logs'
      ? 'Logs e Inspetor de Transações'
      : 'Fazer Transações';

  return (
    <Box>
      <Heading>🛡️ PQC Account Hub</Heading>
      <Text>
        Identidade Pós-Quântica nativa no MetaMask (<Bold>FIPS 204 ML-DSA-44</Bold>, <Bold>Falcon-512</Bold> e Esquema Híbrido).
      </Text>
      <Divider />

      {/* --- NAVEGAÇÃO: BOTÃO DE VOLTAR E CAMINHO HIERÁRQUICO --- */}
      {activeTab !== 'menu' && (
        <Section>
          <Button name="nav_go_menu">⬅️ Voltar ao Menu Principal</Button>
          <Text>
            <Italic>{`Configurações > Snaps > PQC Account > ${breadcrumbName}`}</Italic>
          </Text>
          <Divider />
        </Section>
      )}

      {/* --- RENDERIZAÇÃO DA ABA ATIVA --- */}
      {activeTab === 'menu' && <MenuTab state={state} />}
      {activeTab === 'accounts' && <AccountsTab state={state} />}
      {activeTab === 'manage' && <ManageTab state={state} />}
      {activeTab === 'dsa' && <DsaTab state={state} />}
      {activeTab === 'tx' && <TxTab state={state} />}
      {activeTab === 'contracts' && <ContractsTab state={state} />}
      {activeTab === 'logs' && <LogsTab state={state} />}
    </Box>
  );
}
