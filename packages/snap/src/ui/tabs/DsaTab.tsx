import {
  Box,
  Heading,
  Text,
  Bold,
  Divider,
  Button,
  Section,
} from '@metamask/snaps-sdk/jsx';
import type { SnapState } from '../../types';

export function DsaTab({ state }: { state: SnapState | null }) {
  const dsaRpcUrlStr = state?.dsaRpcUrl || 'http://localhost:8545';
  const supportedDSAs = state?.supportedDSAs;
  const supportedDSAsList = Array.isArray(supportedDSAs) ? supportedDSAs : [];
  const dsaError = state?.dsaError;
  const dsaStatusStr = dsaError
    ? `Erro: ${dsaError}`
    : supportedDSAs !== undefined
    ? `${supportedDSAsList.length} DSA(s) suportado(s)`
    : 'Ainda não consultado';

  return (
    <Box>
      <Heading>🌐 DSAs Suportados na Rede (Besu)</Heading>
      <Section>
        <Text>
          <Bold>Endpoint RPC da Rede:</Bold> {dsaRpcUrlStr}
        </Text>
        <Button name="btn_fetch_dsa">🔍 Consultar DSAs Suportados</Button>
        <Divider />
        <Text>
          <Bold>Diagnóstico:</Bold> {dsaStatusStr}
        </Text>
        {supportedDSAsList.length > 0 ? (
          <Box>
            <Text>
              <Bold>Algoritmos Retornados pelo Nó:</Bold>
            </Text>
            {supportedDSAsList.map((dsa: any, index: number) => {
              const dsaStr = typeof dsa === 'object' ? JSON.stringify(dsa) : String(dsa);
              return <Text key={String(index)}>{`• ${dsaStr}`}</Text>;
            })}
          </Box>
        ) : (
          <Text>
            {supportedDSAs !== undefined
              ? 'Nenhum algoritmo DSA retornado para este endpoint.'
              : 'Clique em "Consultar DSAs Suportados" para verificar os algoritmos aceitos pelo nó Besu.'}
          </Text>
        )}
      </Section>
    </Box>
  );
}
