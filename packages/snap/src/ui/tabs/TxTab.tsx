import {
  Box,
  Heading,
  Text,
  Bold,
  Divider,
  Button,
  Section,
  Form,
  Field,
  Input,
  Dropdown,
  Option,
} from '@metamask/snaps-sdk/jsx';
import type { SnapState } from '../../types';
import { accountTypeLabel } from '../../crypto';
import { dsaTypeForAccount, dsaNameForCode, getBaseGasForAccount } from '../../transactions';
import { TxStatusBox } from '../components';

export function TxTab({ state }: { state: SnapState | null }) {
  const accounts = state?.accounts || [];
  const selectedAddress = state?.selectedAccountAddress;
  const activeAccount =
    accounts.find(
      (a) =>
        a.address.toLowerCase() === (selectedAddress || '').toLowerCase(),
    ) || accounts[0];

  const txStatusDisplayStr = state?.lastTxStatus || 'Pronta para envio';
  const lastTxHashStr = state?.lastTxHash ? String(state.lastTxHash) : '';
  const selectedTxType = state?.selectedTxType || '0x42';
  const lastTxAccessListStr = state?.lastTxAccessList ? String(state.lastTxAccessList) : '';
  const isEcdsa = Boolean(activeAccount?.options?.isEcdsa);

  // Lista de tipos de transação suportados (PQC e Clássicas)
  const allTxTypes = [
    { value: '0x42', label: 'Flexible EIP-1559 (0x42) - PQC Híbrida / Pura' },
    { value: '0x41', label: 'Flexible Access List (0x41) - PQC Híbrida / Pura' },
    { value: '0x44', label: 'Flexible Delegation (0x44) - PQC EIP-7702' },
    { value: '0x02', label: 'EIP-1559 Dynamic Fee (0x02) - Clássica' },
    { value: '0x01', label: 'EIP-2930 Access List (0x01) - Clássica' },
    { value: '0x00', label: 'Legacy / Original (0x00) - Clássica' },
  ];

  // Filtra envelopes incompatíveis para contas ECDSA puras
  const compatibleTxTypes = isEcdsa
    ? allTxTypes.filter((t) => ['0x02', '0x01', '0x00'].includes(t.value))
    : allTxTypes;

  const effectiveTxType = compatibleTxTypes.some(
    (t) => t.value.toLowerCase() === selectedTxType.toLowerCase(),
  )
    ? selectedTxType
    : compatibleTxTypes[0].value;

  // Ordena para que o tipo selecionado seja a primeira opção do Dropdown
  const orderedTxTypes = [
    ...compatibleTxTypes.filter((t) => t.value.toLowerCase() === effectiveTxType.toLowerCase()),
    ...compatibleTxTypes.filter((t) => t.value.toLowerCase() !== effectiveTxType.toLowerCase()),
  ];

  // Ordena contas para que a selecionada apareça primeiro no Dropdown
  const otherAccounts = activeAccount
    ? accounts.filter((a) => a.address.toLowerCase() !== activeAccount.address.toLowerCase())
    : [];

  const formatAccountLabel = (acc: typeof accounts[0]) => {
    const typeLabel = accountTypeLabel(acc.options);
    const shortAddr = `${acc.address.slice(0, 8)}...${acc.address.slice(-6)}`;
    return `${shortAddr} (${typeLabel})`;
  };

  const recipientPresets = [
    { value: 'manual', label: 'Digitar manualmente ou Auto-envio' },
    ...(activeAccount
      ? [
          {
            value: activeAccount.address,
            label: `Auto-envio (${activeAccount.address.slice(0, 8)}...${activeAccount.address.slice(-6)})`,
          },
        ]
      : []),
    ...otherAccounts.map((acc) => ({
      value: acc.address,
      label: `Outra Conta: ${formatAccountLabel(acc)}`,
    })),
  ];
  const currentRecipientPreset = state?.txRecipientPreset || 'manual';
  const orderedRecipientPresets = [
    ...recipientPresets.filter((p) => p.value.toLowerCase() === currentRecipientPreset.toLowerCase()),
    ...recipientPresets.filter((p) => p.value.toLowerCase() !== currentRecipientPreset.toLowerCase()),
  ];

  const calldataPresets = [
    { value: '0x', label: '0x — Transferência Simples (Sem Calldata)' },
    { value: '0xd09de08a', label: '0xd09de08a — increment()' },
    { value: '0x61bc221a', label: '0x61bc221a — counter()' },
  ];
  const currentCalldataPreset = state?.txCalldataPreset || '0x';
  const orderedCalldataPresets = [
    ...calldataPresets.filter((p) => p.value.toLowerCase() === currentCalldataPreset.toLowerCase()),
    ...calldataPresets.filter((p) => p.value.toLowerCase() !== currentCalldataPreset.toLowerCase()),
  ];

  const activeDsaCode = activeAccount ? dsaTypeForAccount(activeAccount.options) : 0;
  const activeBaseGas = activeAccount ? getBaseGasForAccount(activeAccount.options, effectiveTxType) : 21000;

  return (
    <Box>
      <Heading>⚡ Enviar Transações (PQC & Clássicas)</Heading>
      <Section>
        <Text>
          Transacione no nó Besu usando envelopes pós-quânticos (<Bold>0x42, 0x41, 0x44</Bold>) ou tradicionais (<Bold>0x00, 0x01, 0x02</Bold>).
        </Text>
        {accounts.length === 0 ? (
          <Box>
            <Text>
              ⚠️ Nenhuma conta derivada ainda. Acesse a aba "➕ Adicionar Conta" para criar sua conta antes de enviar transações.
            </Text>
            <Button name="nav_tab_manage">➕ Ir para Adicionar Conta</Button>
          </Box>
        ) : (
          <Box>
            <Divider />
            <Text>
              <Bold>Perfil Criptográfico Ativo:</Bold>{' '}
              {`${accountTypeLabel(activeAccount.options)} | DSA: ${dsaNameForCode(activeDsaCode)} | Gas Base PR 55: ${activeBaseGas.toLocaleString('pt-BR')} gas`}
            </Text>
            {isEcdsa ? (
              <Text>
                ℹ️ Conta ECDSA pura selecionada: envelopes PQC (0x41/0x42/0x44) foram ocultados automaticamente. Selecione uma conta Híbrida ou PQC Pura para testar envelopes flexíveis.
              </Text>
            ) : null}

            <Field label="Conta Remetente">
              <Dropdown name="input_sender">
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

            <Field label="Tipo de Transação">
              <Dropdown name="input_tx_type">
                {orderedTxTypes.map((t) => (
                  <Option value={t.value}>{t.label}</Option>
                ))}
              </Dropdown>
            </Field>

            <Field label="Atalho de Destinatário (Opcional)">
              <Dropdown name="input_recipient_preset">
                {orderedRecipientPresets.map((p) => (
                  <Option value={p.value}>{p.label}</Option>
                ))}
              </Dropdown>
            </Field>

            <Field label="Preset de Calldata (Opcional)">
              <Dropdown name="input_calldata_preset">
                {orderedCalldataPresets.map((p) => (
                  <Option value={p.value}>{p.label}</Option>
                ))}
              </Dropdown>
            </Field>

            <Form name="form_send_tx_0x42">
              <Field label="Endereço de Destino (0x...)">
                <Input
                  name="input_recipient"
                  placeholder="0x... (deixe em branco para auto-envio de teste)"
                  value={currentRecipientPreset !== 'manual' ? currentRecipientPreset : ''}
                />
              </Field>

              <Field label="Valor a Enviar (ETH)">
                <Input name="input_amount" placeholder="0.0 (ou ex: 0.001)" />
              </Field>

              <Field label="Dados / Calldata Hex (Opcional)">
                <Input
                  name="input_data"
                  placeholder="0x... (ex: 0xa9059cbb...)"
                  value={currentCalldataPreset !== '0x' ? currentCalldataPreset : ''}
                />
              </Field>

              <Button type="submit">
                {`🚀 Assinar e Transmitir (${effectiveTxType})`}
              </Button>
            </Form>

            <Divider />

            <TxStatusBox
              title="Status & Telemetria da Transação"
              status={txStatusDisplayStr}
              txHash={lastTxHashStr}
              accessList={lastTxAccessListStr}
              telemetry={state?.lastTxTelemetry}
            />

            <Button name="nav_go_logs">🕵️ Abrir Inspetor Completo de Logs & Histórico</Button>
          </Box>
        )}
      </Section>
    </Box>
  );
}
