import {
  Box,
  Heading,
  Text,
  Bold,
  Italic,
  Divider,
  Button,
  Section,
  Copyable,
} from '@metamask/snaps-sdk/jsx';
import type { SnapState } from '../../types';
import { accountTypeLabel } from '../../crypto';

export function AccountsTab({ state }: { state: SnapState | null }) {
  const accounts = state?.accounts || [];
  const mnemonic = state?.mnemonic;
  const isInitialized = Boolean(mnemonic);
  const statusStr = isInitialized ? '✅ Ativa (24 palavras configuradas)' : '⚠️ Não Inicializada';
  const accountsCountStr = `${accounts.length} conta(s) registrada(s)`;
  const derivedTitleStr = `Contas Derivadas (${accounts.length})`;
  const ethBalanceDisplayStr = state?.ethBalanceDisplay || 'Não consultado.';

  return (
    <Box>
      <Heading>📋 Informações da Conta & Saldos</Heading>
      <Section>
        <Text>
          <Bold>Status da Carteira:</Bold> {statusStr}
        </Text>
        <Text>
          <Bold>Total de Contas PQC:</Bold> {accountsCountStr}
        </Text>
        <Text>
          <Bold>Saldo ETH (Conta Ativa):</Bold> {ethBalanceDisplayStr}
        </Text>
        <Button name="btn_check_account_balances">🔄 Consultar / Atualizar Saldos</Button>
      </Section>

      <Divider />
      <Heading>{derivedTitleStr}</Heading>
      {accounts.length === 0 ? (
        <Section>
          <Text>
            {isInitialized
              ? 'Nenhuma conta PQC derivada ainda. Acesse a aba "➕ Adicionar Conta" para derivar sua primeira conta híbrida ou standalone (PQC pura).'
              : 'Sua carteira ainda não foi inicializada. Acesse a aba "➕ Adicionar Conta" para gerar ou importar sua frase de 24 palavras.'}
          </Text>
          <Button name="nav_go_manage">➕ Ir para Gerar / Adicionar Conta</Button>
        </Section>
      ) : (
        accounts.map((acc, idx) => {
          const isHybrid = Boolean(acc.options?.isHybrid);
          const isPqc = Boolean(acc.options?.isPQC);
          const icon = isHybrid ? '🔐' : isPqc ? '🛡️' : '⚙️';
          const label = `${icon} ${accountTypeLabel(acc.options)}`;
          const derivationIndex = acc.options?.derivationIndex ?? idx;
          const accountTitle = `Conta #${idx + 1}:`;
          const pathStr = acc.options?.isEcdsa
            ? `Caminho de Derivação (BIP-44): m/44'/60'/0'/0/${derivationIndex}`
            : `Derivação PQC (índice ${derivationIndex}, v${acc.options?.derivationVersion ?? 1})`;
          const pubKeyLen = `${Math.floor(String(acc.options?.publicKey || '').replace(/^0x/, '').length / 2)} bytes`;
          const pubKeyLabel = `Chave Pública (${pubKeyLen}):`;
          const pubKeyVal = String(acc.options?.publicKey || acc.address);

          return (
            <Section key={acc.id}>
              <Text>
                <Bold>{accountTitle}</Bold> {label}
              </Text>
              <Text>
                <Italic>{pathStr}</Italic>
              </Text>
              <Text>
                <Bold>Endereço Ethereum:</Bold>
              </Text>
              <Copyable value={acc.address} />
              <Text>
                <Bold>{pubKeyLabel}</Bold>
              </Text>
              <Copyable value={pubKeyVal} />
            </Section>
          );
        })
      )}
    </Box>
  );
}
