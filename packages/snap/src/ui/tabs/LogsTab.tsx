import {
  Box,
  Heading,
  Text,
  Bold,
  Italic,
  Divider,
  Button,
  Section,
  Field,
  Dropdown,
  Option,
} from '@metamask/snaps-sdk/jsx';
import type { SnapState } from '../../types';
import { TxStatusBox } from '../components';

export function LogsTab({ state }: { state: SnapState | null }) {
  const history = Array.isArray(state?.txHistory) ? state.txHistory : [];
  const selectedId = state?.selectedLogId;
  const indexedHistory = history.map((item, idx) => ({ item, num: idx + 1 }));
  const selectedEntry =
    indexedHistory.find((entry) => entry.item.id === selectedId) || indexedHistory[0];
  const selectedLog = selectedEntry?.item;

  const orderedLogs = selectedEntry
    ? [
        selectedEntry,
        ...indexedHistory.filter((entry) => entry.item.id !== selectedEntry.item.id),
      ]
    : [];

  return (
    <Box>
      <Heading>🕵️ Logs e Inspetor de Transações</Heading>
      <Text>
        Histórico das últimas transações assinadas/enviadas (até 15 entradas) para comparar tamanhos em bytes, gas PR 55 e trilha passo a passo.
      </Text>

      <Section>
        <Text>
          <Bold>Total Registrado na Sessão:</Bold> {`${String(history.length)} transação(ões)`}
        </Text>
        {history.length > 0 ? (
          <Button name="btn_clear_tx_logs">🗑️ Limpar Histórico de Logs</Button>
        ) : null}
      </Section>

      {history.length === 0 ? (
        <Section>
          <Text>
            Nenhuma transação registrada ainda. Envie ou assine uma transação nas abas de Transações, Contratos ou via Web dApp para inspecionar os logs aqui.
          </Text>
          <Button name="nav_go_tx">⚡ Ir para Fazer Transações</Button>
        </Section>
      ) : (
        <Box>
          <Divider />
          <Section>
            <Heading>📈 Comparativo Rápido de Envelopes</Heading>
            {history.map((item, idx) => {
              const statusIcon =
                item.receiptStatus === 'success'
                  ? '✅'
                  : item.receiptStatus === 'reverted'
                  ? '❌'
                  : item.receiptStatus === 'error'
                  ? '⚠️'
                  : '⏳';
              const blockPart =
                item.blockNumberDec !== undefined
                  ? `Bloco #${String(item.blockNumberDec)}`
                  : 'Off-chain/Pendente';
              const gasPart =
                item.gasUsedDec !== undefined
                  ? `Gas Base: ${item.dsaBaseGas.toLocaleString('pt-BR')} (Usado: ${item.gasUsedDec.toLocaleString('pt-BR')})`
                  : `Gas Base: ${item.dsaBaseGas.toLocaleString('pt-BR')}`;
              return (
                <Text key={item.id}>
                  {`#${String(idx + 1)} [${item.envelopeType} | DSA ${item.dsaTypeHex}] Sig: ${String(item.totalSigBytes)} B | RLP: ${String(item.serializedTxBytes)} B | ${gasPart} | ${blockPart} | ${statusIcon}`}
                </Text>
              );
            })}
          </Section>

          <Divider />
          <Section>
            <Heading>🔍 Selecionar Transação para Inspeção Profunda</Heading>
            <Field label="Entrada do Histórico">
              <Dropdown name="select_log_entry">
                {orderedLogs.map(({ item, num }) => {
                  const statusIcon =
                    item.receiptStatus === 'success'
                      ? '✅'
                      : item.receiptStatus === 'reverted'
                      ? '❌'
                      : '⏳';
                  const label = `#${String(num)} [${item.envelopeType} | ${item.dsaName}] Sig: ${String(item.totalSigBytes)} B | ${item.timestamp} ${statusIcon}`;
                  return (
                    <Option key={item.id} value={item.id}>
                      {label}
                    </Option>
                  );
                })}
              </Dropdown>
            </Field>
          </Section>

          {selectedLog ? (
            <Box>
              <Text>
                <Italic>{`Registrada em ${selectedLog.timestamp} | Conta: ${selectedLog.accountAddress} -> Para: ${selectedLog.to} | Valor: ${selectedLog.valueEth} ETH | Nonce: ${String(selectedLog.nonceDec)}`}</Italic>
              </Text>
              <TxStatusBox
                title="Inspeção Detalhada da Transação"
                status={
                  selectedLog.receiptStatus === 'success'
                    ? `✅ Confirmada no bloco #${String(selectedLog.blockNumberDec ?? '-')}`
                    : selectedLog.receiptStatus === 'reverted'
                    ? `❌ Revertida no bloco #${String(selectedLog.blockNumberDec ?? '-')}`
                    : selectedLog.receiptStatus === 'error'
                    ? '⚠️ Transmitida (recibo pendente)'
                    : '📝 Assinada e registrada'
                }
                txHash={selectedLog.txHash}
                accessList={selectedLog.accessListJson}
                telemetry={selectedLog}
              />
            </Box>
          ) : null}
        </Box>
      )}
    </Box>
  );
}
