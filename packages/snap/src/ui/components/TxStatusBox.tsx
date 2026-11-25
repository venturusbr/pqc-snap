import { Box, Section, Heading, Text, Bold, Divider, Copyable } from '@metamask/snaps-sdk/jsx';
import type { TxTelemetry } from '../../types';

interface TxStatusBoxProps {
  title?: string;
  status?: string;
  txHash?: string;
  accessList?: string;
  telemetry?: TxTelemetry;
  showRawArtifacts?: boolean;
}

export function TxStatusBox({
  title = 'Status da Transação',
  status = 'Pronto para operações.',
  txHash,
  accessList,
  telemetry,
  showRawArtifacts = true,
}: TxStatusBoxProps) {
  const effectiveTxHash = txHash || telemetry?.txHash || '';
  const effectiveAccessList = accessList || telemetry?.accessListJson || '';

  return (
    <Section>
      <Heading>{`📊 ${title}`}</Heading>
      <Text><Bold>Status:</Bold> {status}</Text>

      {telemetry ? (
        <Box>
          <Divider />
          <Heading>🧬 Resumo Criptográfico & Tamanhos</Heading>
          <Text><Bold>Envelope:</Bold> {telemetry.envelopeLabel}</Text>
          <Text><Bold>Conta / Algoritmo:</Bold> {`${telemetry.accountTypeLabel} — DSA ${telemetry.dsaName}`}</Text>
          <Text>
            <Bold>Tamanhos (Bytes):</Bold>{' '}
            {`PubKey: ${String(telemetry.publicKeyBytes)} B | Assinatura: ${String(telemetry.totalSigBytes)} B (ECDSA: ${String(telemetry.classicSigBytes)} B + PQC: ${String(telemetry.pqcSigBytes)} B) | Preimage: ${String(telemetry.preimageBytes)} B | Tx RLP Final: ${String(telemetry.serializedTxBytes)} B`}
          </Text>
          <Text>
            <Bold>Calldata:</Bold>{' '}
            {`${String(telemetry.calldataBytes.total)} B (${String(telemetry.calldataBytes.nonZero)} não-zero, ${String(telemetry.calldataBytes.zero)} zero)`}
          </Text>
          <Text>
            <Bold>Tempo de Assinatura:</Bold>{' '}
            {`${String(telemetry.signDurationMs)} ms${telemetry.totalDurationMs !== undefined ? ` (Ciclo Total: ${String(telemetry.totalDurationMs)} ms)` : ''}`}
          </Text>

          <Divider />
          <Heading>⛽ Métricas de Gas (Besu PR 55) & Bloco</Heading>
          <Text>
            <Bold>Gas Base DSA:</Bold>{' '}
            {`${telemetry.dsaBaseGas.toLocaleString('pt-BR')} | Calldata Floor: ${telemetry.calldataFloorGas.toLocaleString('pt-BR')} | Piso Intrínseco: ${telemetry.intrinsicGasMin.toLocaleString('pt-BR')}`}
          </Text>
          <Text>
            <Bold>Gas Limit:</Bold>{' '}
            {`${telemetry.gasLimitDec.toLocaleString('pt-BR')}${telemetry.gasUsedDec !== undefined ? ` | Gas Usado: ${telemetry.gasUsedDec.toLocaleString('pt-BR')}` : ''}`}
          </Text>
          {telemetry.blockNumberDec !== undefined ? (
            <Text>
              <Bold>Bloco Confirmado:</Bold>{' '}
              {`#${String(telemetry.blockNumberDec)} (${
                telemetry.receiptStatus === 'success'
                  ? '✅ Sucesso 0x1'
                  : telemetry.receiptStatus === 'reverted'
                  ? '❌ Revertida 0x0'
                  : '⏳ Pendente'
              })`}
            </Text>
          ) : (
            <Text>
              <Bold>Recibo no Nó:</Bold>{' '}
              {telemetry.receiptStatus === 'error'
                ? '⚠️ Não confirmado no tempo limite'
                : '⏳ Aguardando confirmação ou assinatura off-chain'}
            </Text>
          )}

          {Array.isArray(telemetry.steps) && telemetry.steps.length > 0 ? (
            <Box>
              <Divider />
              <Heading>🪜 Trilha de Execução (Step-by-Step)</Heading>
              {telemetry.steps.map((s) => {
                const icon = s.status === 'error' ? '❌' : s.status === 'warn' ? '⚠️' : '✅';
                const dur = s.durationMs !== undefined ? ` (${String(s.durationMs)} ms)` : '';
                return (
                  <Text key={String(s.step)}>
                    {`${icon} [${String(s.step)}] ${s.label}: ${s.detail}${dur}`}
                  </Text>
                );
              })}
            </Box>
          ) : null}

          {showRawArtifacts !== false ? (
            <Box>
              <Divider />
              <Heading>🔎 Artefatos Hexadecimais (Copiar)</Heading>
              {effectiveTxHash ? (
                <Box>
                  <Text><Bold>Hash da Transação (txHash):</Bold></Text>
                  <Copyable value={effectiveTxHash} />
                </Box>
              ) : null}
              {telemetry.signingHashHex ? (
                <Box>
                  <Text><Bold>Signing Hash (Keccak-256 da Preimage):</Bold></Text>
                  <Copyable value={telemetry.signingHashHex} />
                </Box>
              ) : null}
              {telemetry.preimageHex ? (
                <Box>
                  <Text><Bold>{`Preimage RLP Hex (${String(telemetry.preimageBytes)} bytes):`}</Bold></Text>
                  <Copyable value={telemetry.preimageHex} />
                </Box>
              ) : null}
              {(telemetry.classicSignatureHex || telemetry.pqcSignatureHex) ? (
                <Box>
                  <Text><Bold>{`Assinatura Completa Hex (${String(telemetry.totalSigBytes)} bytes):`}</Bold></Text>
                  <Copyable
                    value={
                      telemetry.classicSignatureHex && telemetry.pqcSignatureHex
                        ? telemetry.classicSignatureHex + telemetry.pqcSignatureHex.replace(/^0x/, '')
                        : telemetry.classicSignatureHex || telemetry.pqcSignatureHex || '0x'
                    }
                  />
                </Box>
              ) : null}
              {telemetry.serializedTxHex ? (
                <Box>
                  <Text><Bold>{`Transação RLP Serializada (${String(telemetry.serializedTxBytes)} bytes):`}</Bold></Text>
                  <Copyable value={telemetry.serializedTxHex} />
                </Box>
              ) : null}
              {telemetry.authorizationListJson ? (
                <Box>
                  <Text><Bold>Authorization List (EIP-7702):</Bold></Text>
                  <Copyable value={telemetry.authorizationListJson} />
                </Box>
              ) : null}
            </Box>
          ) : null}
        </Box>
      ) : (
        <Box>
          {effectiveTxHash && effectiveTxHash.length > 0 ? (
            <Box>
              <Text><Bold>Hash da Transação no Besu:</Bold></Text>
              <Copyable value={effectiveTxHash} />
            </Box>
          ) : null}
        </Box>
      )}

      {effectiveAccessList && effectiveAccessList.length > 0 && effectiveAccessList !== '[]' ? (
        <Box>
          <Text><Bold>Access List Utilizada:</Bold></Text>
          <Copyable value={effectiveAccessList} />
        </Box>
      ) : null}
    </Section>
  );
}
