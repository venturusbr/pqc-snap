import { Box, Section, Text, Bold, Italic } from '@metamask/snaps-sdk/jsx';
import type { KeyringAccount } from '@metamask/keyring-api';
import { accountTypeLabel } from '../../crypto';

interface AccountHeaderProps {
  account?: KeyringAccount;
}

export function AccountHeader({ account }: AccountHeaderProps) {
  if (!account) {
    return (
      <Section>
        <Text><Bold>Conta Remetente:</Bold> Nenhuma conta derivada</Text>
      </Section>
    );
  }

  const typeLabel = accountTypeLabel(account.options);

  return (
    <Section>
      <Text><Bold>Conta Ativa:</Bold> {account.address}</Text>
      <Text><Italic>Tipo: {typeLabel}</Italic></Text>
    </Section>
  );
}
