import {
  Box,
  Heading,
  Text,
  Bold,
  Divider,
  Button,
  Section,
  Copyable,
  Form,
  Field,
  Input,
  Dropdown,
  Option,
} from '@metamask/snaps-sdk/jsx';
import type { SnapState } from '../../types';
import { DEFAULT_BLOB_RELAYER_URL, SELECTORS } from '../../constants';
import { accountTypeLabel } from '../../crypto';
import { AccountHeader, TxStatusBox } from '../components';

export function ContractsTab({ state }: { state: SnapState | null }) {
  const accounts = state?.accounts || [];
  const selectedAddress = state?.selectedAccountAddress;
  const activeAccount =
    accounts.find(
      (a) =>
        a.address.toLowerCase() === (selectedAddress || '').toLowerCase(),
    ) || accounts[0];

  const otherAccounts = activeAccount
    ? accounts.filter((a) => a.address.toLowerCase() !== activeAccount.address.toLowerCase())
    : [];

  const formatAccountLabel = (acc: typeof accounts[0]) => {
    const typeLabel = accountTypeLabel(acc.options);
    const shortAddr = `${acc.address.slice(0, 8)}...${acc.address.slice(-6)}`;
    return `${shortAddr} (${typeLabel})`;
  };

  const generalContractStr = state?.generalContractAddress || '';
  const generalCalldataStr = state?.generalCalldata || SELECTORS.SAMPLE_INCREMENT;
  const lastGeneralTxHashStr = state?.lastGeneralTxHash ? String(state.lastGeneralTxHash) : '';
  const lastGeneralTxStatusStr = state?.lastGeneralTxStatus || 'Pronto para executar transações.';
  const lastGeneralAccessListStr = state?.lastGeneralAccessList ? String(state.lastGeneralAccessList) : '';
  const delegatedBytecodeDisplayStr = state?.delegatedBytecodeDisplay || '';
  const contractCounterDisplayStr = state?.contractCounterDisplay || '';
  const blobRelayerUrlStr = state?.blobRelayerUrl || DEFAULT_BLOB_RELAYER_URL;
  const blobRecipientStr = state?.blobRecipient || generalContractStr;
  const blobAmountStr = state?.blobAmountEth || '0.01';
  const lastBlobVersionedHashStr = state?.lastBlobVersionedHash ? String(state.lastBlobVersionedHash) : '';

  return (
    <Box>
      <Heading>📑 Contratos, Delegação e Blob (0x41 / 0x44 / EIP-4844)</Heading>
      <Text>
        Execute transações com Flexible Access List (<Bold>Tipo 0x41</Bold>) ou Flexible Code Delegation (<Bold>EIP-7702 / Tipo 0x44</Bold>) em qualquer contrato da rede Besu.
      </Text>

      <AccountHeader account={activeAccount} />

      {accounts.length > 1 && (
        <Section>
          <Field label="Trocar Conta Ativa">
            <Dropdown name="input_contracts_sender">
              <Option value={activeAccount.address}>
                {formatAccountLabel(activeAccount)}
              </Option>
              {otherAccounts.map((acc) => (
                <Option value={acc.address}>
                  {formatAccountLabel(acc)}
                </Option>
              ))}
            </Dropdown>
          </Field>
        </Section>
      )}

      <Divider />

      {/* Endereço do Contrato Alvo */}
      <Section>
        <Heading>🎯 Contrato Alvo</Heading>
        <Text>
          <Bold>Endereço Atual:</Bold> {generalContractStr || 'Nenhum contrato definido'}
        </Text>
        <Form name="form_configure_general_contract">
          <Field label="Endereço do Contrato (0x...)">
            <Input
              name="input_general_contract"
              placeholder="0x..."
              value={generalContractStr}
            />
          </Field>
          <Button type="submit">💾 Definir Contrato</Button>
        </Form>
        <Button name="btn_check_contract_counter">🔢 Consultar Contador (counter())</Button>
        {contractCounterDisplayStr.length > 0 ? (
          <Box>
            <Text>
              <Bold>Resultado do Contador:</Bold> {contractCounterDisplayStr}
            </Text>
          </Box>
        ) : null}
      </Section>

      <Divider />

      {/* Transação 0x41: Flexible Access List */}
      <Section>
        <Heading>🚀 Transação 0x41 (Flexible Access List)</Heading>
        <Text>
          Envia transação direta ao contrato com lista de acessos flexível pré-aquecida via RPC (<Bold>eth_createAccessList</Bold>).
        </Text>
        <Form name="form_send_general_0x41">
          <Field label="Calldata Hex (ex: 0xd09de08a para increment())">
            <Input
              name="input_calldata_0x41"
              placeholder="0xd09de08a"
              value={generalCalldataStr}
            />
          </Field>
          <Button type="submit">🚀 Transmitir Transação 0x41</Button>
        </Form>
      </Section>

      <Divider />

      {/* Transação 0x44: Flexible Code Delegation (EIP-7702) */}
      <Section>
        <Heading>🧬 Transação 0x44 (Flexible Code Delegation / EIP-7702)</Heading>
        <Text>
          Delega o código da sua conta ativa (EOA) para o contrato alvo usando autorização assinada e executa uma chamada.
        </Text>
        <Form name="form_send_general_0x44">
          <Field label="Nota / Mensagem para pingDelegation(string)">
            <Input
              name="input_ping_note"
              placeholder="Ex: Executado via MetaMask PQC Snap"
            />
          </Field>
          <Button type="submit">🧬 Delegar Código & Executar (0x44)</Button>
        </Form>
      </Section>

      <Divider />

      {/* Verificação e Revogação EIP-7702 */}
      <Section>
        <Heading>🛡️ Gerenciar Delegação de Conta</Heading>
        <Text>Verifique o bytecode da sua conta ou revogue a autorização delegada:</Text>
        <Button name="btn_check_general_delegation_code">🔍 Verificar Bytecode Delegado da Conta</Button>
        {delegatedBytecodeDisplayStr.length > 0 ? (
          <Box>
            <Text>
              <Bold>Bytecode Atual no Besu:</Bold>
            </Text>
            <Copyable value={delegatedBytecodeDisplayStr} />
          </Box>
        ) : null}
        <Button name="btn_revoke_delegation">❌ Revogar Delegação (Voltar para EOA 0x)</Button>
      </Section>

      <Divider />

      {/* Transação com Blob (EIP-4844 via Relayer) */}
      <Section>
        <Heading>📦 Transação com Blob (EIP-4844)</Heading>
        <Text>
          Assina com a conta PQC ativa e envia a assinatura ao Relayer EIP-4844 (<Bold>Tipo 0x03</Bold>).
        </Text>
        <Form name="form_send_blob">
          <Field label="URL do Relayer EIP-4844">
            <Input
              name="input_blob_relayer_url"
              placeholder={DEFAULT_BLOB_RELAYER_URL}
              value={blobRelayerUrlStr}
            />
          </Field>
          <Field label="Endereço de Destino (0x...)">
            <Input
              name="input_blob_recipient"
              placeholder="0x..."
              value={blobRecipientStr}
            />
          </Field>
          <Field label="Valor (ETH)">
            <Input
              name="input_blob_amount"
              placeholder="0.01"
              value={blobAmountStr}
            />
          </Field>
          <Button type="submit">📦 Enviar via Blob (EIP-4844)</Button>
        </Form>
        {lastBlobVersionedHashStr.length > 0 ? (
          <Box>
            <Text>
              <Bold>Último Blob Versioned Hash:</Bold>
            </Text>
            <Copyable value={lastBlobVersionedHashStr} />
          </Box>
        ) : null}
      </Section>

      <Divider />

      <TxStatusBox
        title="Status da Operação de Contrato"
        status={lastGeneralTxStatusStr}
        txHash={lastGeneralTxHashStr}
        accessList={lastGeneralAccessListStr}
        telemetry={state?.lastGeneralTxTelemetry}
      />

      <Button name="nav_go_logs">🕵️ Ver Histórico Completo de Logs</Button>
    </Box>
  );
}
