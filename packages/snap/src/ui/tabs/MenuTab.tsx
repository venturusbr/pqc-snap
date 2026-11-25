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
} from '@metamask/snaps-sdk/jsx';
import type { SnapState } from '../../types';

export function MenuTab({ state }: { state: SnapState | null }) {
  const accounts = state?.accounts || [];
  const mnemonic = state?.mnemonic;
  const isInitialized = Boolean(mnemonic);
  const statusStr = isInitialized ? '✅ Ativa (24 palavras configuradas)' : '⚠️ Não Inicializada';
  const accountsCountStr = `${accounts.length} conta(s) registrada(s)`;
  const dsaRpcUrlStr = state?.dsaRpcUrl || 'http://localhost:8545';

  return (
    <Box>
      <Section>
        <Text>
          <Bold>Status da Carteira:</Bold> {statusStr}
        </Text>
        <Text>
          <Bold>Total de Contas PQC:</Bold> {accountsCountStr}
        </Text>
        <Text>
          <Bold>Rede e Compatibilidade:</Bold> Hyperledger Besu (0x41 / 0x42 / EIP-7702)
        </Text>
        <Text>
          <Bold>Endpoint RPC do Besu:</Bold> {dsaRpcUrlStr}
        </Text>
      </Section>

      <Divider />

      {/* Configuração Central de IP / RPC do Besu */}
      <Section>
        <Heading>🌐 Configurar IP</Heading>
        <Text>Defina o IP e a porta do nó Besu (ex: localhost, IP da AWS ou rede local):</Text>
        <Form name="form_configure_global_rpc">
          <Field label="IP / URL do Nó Besu">
            <Input name="input_global_rpc" placeholder={dsaRpcUrlStr} value={dsaRpcUrlStr} />
          </Field>
          <Button type="submit">💾 Salvar IP da Rede</Button>
        </Form>
      </Section>

      <Divider />
      <Heading>Menu de Navegação:</Heading>
      <Section>
        <Button name="nav_go_accounts">📋 1. Informações da Conta & Saldos</Button>
        <Button name="nav_go_manage">➕ 2. Gerar / Backup / Adicionar Contas</Button>
        <Button name="nav_go_dsa">🌐 3. DSAs Suportados na Rede (Besu)</Button>
        <Button name="nav_go_tx">⚡ 4. Fazer Transações PQC</Button>
        <Button name="nav_go_contracts">📑 5. Contratos, Delegação e Blob (0x41 / 0x44 / 4844)</Button>
        <Button name="nav_go_logs">🕵️ 6. Logs e Inspetor de Transações</Button>
      </Section>
    </Box>
  );
}
