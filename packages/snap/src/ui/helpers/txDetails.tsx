import { Box, Text, Bold } from '@metamask/snaps-sdk/jsx';
import type { KeyringAccount } from '@metamask/keyring-api';
import {
  accountTypeLabel,
  decodeKnownSelector,
  formatWeiHexToEth,
  formatWeiHexToGwei,
} from '../../crypto';
import {
  dsaNameForCode,
  dsaTypeForAccount,
  envelopeTypeLabel,
  estimateExpectedSignatureBytes,
  calculateIntrinsicGas,
  getBaseGasForAccount,
} from '../../transactions';

const MAX_DATA_PREVIEW = 138; // 0x + 4 bytes de seletor + 64 bytes

function field(value: unknown, fallback = '-'): string {
  if (value === undefined || value === null || value === '') return fallback;
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function formatHexAndDecimal(value: unknown, fallback = '-'): string {
  if (value === undefined || value === null || value === '') return fallback;
  const raw = String(value).trim();
  try {
    const dec = raw.startsWith('0x') ? parseInt(raw, 16) : Number(raw);
    if (!Number.isNaN(dec) && Number.isFinite(dec)) {
      return `${dec.toLocaleString('pt-BR')} (${raw})`;
    }
  } catch {
    // fallback abaixo
  }
  return raw;
}

/**
 * Resume TODOS os campos relevantes da transação para o diálogo de confirmação,
 * para que o usuário veja exatamente o que será assinado (destino, valor, calldata, gas, chain e perfil DSA).
 */
export function renderTxDetails(
  tx: Record<string, any>,
  origin?: string,
  account?: KeyringAccount,
): any {
  const data = typeof tx?.data === 'string' ? tx.data : typeof tx?.input === 'string' ? tx.input : '';
  const cleanData = data.startsWith('0x') ? data.slice(2) : data;
  const dataLen = cleanData.length > 0 ? Math.floor(cleanData.length / 2) : 0;
  const dataPreview = data.length > MAX_DATA_PREVIEW ? `${data.slice(0, MAX_DATA_PREVIEW)}…` : data || '0x';
  const authCount = Array.isArray(tx?.authorizationList) ? tx.authorizationList.length : 0;
  const accessCount = Array.isArray(tx?.accessList) ? tx.accessList.length : 0;

  const envLabel = envelopeTypeLabel(tx?.type);
  const valueEth = formatWeiHexToEth(tx?.value);
  const valueDisplay = `${valueEth} ETH (${field(tx?.value, '0x0')})`;
  const gasPriceHex = tx?.maxFeePerGas ?? tx?.gasPrice;
  const gasPriceDisplay = gasPriceHex
    ? `${formatWeiHexToGwei(gasPriceHex)} (${String(gasPriceHex)})`
    : '-';

  const dsaCode = account ? dsaTypeForAccount(account.options) : undefined;
  const dsaLabel = dsaCode !== undefined ? dsaNameForCode(dsaCode) : undefined;
  const acctLabel = account ? accountTypeLabel(account.options) : undefined;
  const expectedSigBytes = account
    ? estimateExpectedSignatureBytes(account.options, tx?.type)
    : undefined;
  const baseGas = account
    ? getBaseGasForAccount(account.options, tx?.type)
    : undefined;
  const minGas = account
    ? calculateIntrinsicGas(tx as any, account.options)
    : undefined;

  const rawGasLimit = tx?.gasLimit ?? tx?.gas;
  const gasLimitFormatted = formatHexAndDecimal(rawGasLimit);
  const gasLimitDisplay =
    minGas !== undefined && baseGas !== undefined
      ? `${gasLimitFormatted} | Piso PR 55: ${minGas.toLocaleString('pt-BR')} (Base DSA: ${baseGas.toLocaleString('pt-BR')})`
      : gasLimitFormatted;

  return (
    <Box>
      {origin ? <Text><Bold>Origem:</Bold> {origin}</Text> : null}
      <Text><Bold>Envelope:</Bold> {envLabel}</Text>
      {acctLabel && dsaLabel ? (
        <Text><Bold>Conta / DSA:</Bold> {`${acctLabel} — ${dsaLabel}`}</Text>
      ) : null}
      {expectedSigBytes !== undefined ? (
        <Text><Bold>Tamanho Estimado da Assinatura:</Bold> {`~${expectedSigBytes.toLocaleString('pt-BR')} bytes`}</Text>
      ) : null}
      <Text><Bold>De:</Bold> {field(tx?.from)}</Text>
      <Text><Bold>Para:</Bold> {field(tx?.to, 'Criação de Contrato')}</Text>
      <Text><Bold>Valor:</Bold> {valueDisplay}</Text>
      <Text><Bold>Chain ID:</Bold> {formatHexAndDecimal(tx?.chainId)}</Text>
      <Text><Bold>Nonce:</Bold> {formatHexAndDecimal(tx?.nonce)}</Text>
      <Text><Bold>Gas Limit:</Bold> {gasLimitDisplay}</Text>
      <Text><Bold>Gas Price / Max Fee:</Bold> {gasPriceDisplay}</Text>
      <Text><Bold>Seletor / Função:</Bold> {decodeKnownSelector(data)}</Text>
      <Text><Bold>Dados ({String(dataLen)} bytes):</Bold> {dataPreview}</Text>
      {accessCount > 0 ? <Text><Bold>Access List:</Bold> {`${String(accessCount)} endereço(s)`}</Text> : null}
      {authCount > 0 ? <Text><Bold>Authorizations (EIP-7702):</Bold> {String(authCount)}</Text> : null}
    </Box>
  );
}
