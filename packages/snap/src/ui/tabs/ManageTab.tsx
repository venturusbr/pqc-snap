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
import type { SnapState } from '../../types';

export function ManageTab({ state }: { state: SnapState | null }) {
  const accounts = state?.accounts || [];
  const mnemonic = state?.mnemonic;
  const isInitialized = Boolean(mnemonic);
  const statusStr = isInitialized ? '✅ Ativa (24 palavras configuradas)' : '⚠️ Não Inicializada';
  const accountsCountStr = `${accounts.length} conta(s) registrada(s)`;

  return (
    <Box>
      <Heading>➕ Gerenciar, Backup e Contas PQC</Heading>
      <Section>
        <Text>
          <Bold>Status da Carteira:</Bold> {statusStr}
        </Text>
        <Text>
          <Bold>Total de Contas Existentes:</Bold> {accountsCountStr}
        </Text>
      </Section>
      <Divider />

      {!isInitialized ? (
        <Section>
          <Text>
            Para habilitar a derivação de contas com chaves pós-quânticas (FIPS 204 ML-DSA-44 e Falcon-512), inicialize a carteira com uma frase mnemônica master:
          </Text>
          <Button name="btn_init_generate">🔑 Gerar Nova Frase (24 palavras)</Button>
          <Button name="btn_init_import">📥 Importar Frase Existente</Button>
        </Section>
      ) : (
        <Section>
          <Text>
            Derive determinísticamente novas contas pós-quânticas a partir da semente da carteira:
          </Text>
          <Button name="btn_create_hybrid">➕ Derivar Conta Híbrida (ECDSA + ML-DSA)</Button>
          <Button name="btn_create_hybrid_falcon">➕ Derivar Conta Híbrida (ECDSA + Falcon-512)</Button>
          <Button name="btn_create_pure_mldsa">🛡️ Derivar Conta PQC Pura (ML-DSA-44)</Button>
          <Button name="btn_create_pure_falcon">🦅 Derivar Conta PQC Pura (Falcon-512)</Button>
          <Button name="btn_create_ecdsa">⚙️ Derivar Conta Clássica Padrão (ECDSA BIP-44)</Button>
          <Button name="btn_refresh">🔄 Atualizar Lista de Contas</Button>
          <Button name="btn_view_mnemonic">👁️ Visualizar Frase de Recuperação (Backup)</Button>
          <Divider />
          <Text>
            <Italic>
              Cada derivação gera um par de chaves ECDSA secp256k1 e um par de chaves pós-quânticas (ML-DSA-44 ou Falcon-512), ambos derivados da semente da conta por HMAC com separação de domínio.
            </Italic>
          </Text>
        </Section>
      )}
    </Box>
  );
}
