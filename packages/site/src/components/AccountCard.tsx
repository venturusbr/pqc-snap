import styled from 'styled-components';

const Card = styled.div`
  background: rgba(26, 32, 44, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(10px);
  margin-bottom: 24px;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
`;

const CardTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #edf2f7;
`;

const SelectSender = styled.select`
  background: #2d3748;
  color: #edf2f7;
  border: 1px solid #4a5568;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  cursor: pointer;
`;

const AddressRow = styled.div`
  background: rgba(0, 0, 0, 0.3);
  padding: 12px 16px;
  border-radius: 10px;
  font-family: monospace;
  font-size: 14px;
  color: #68d391;
  word-break: break-all;
  margin-bottom: 14px;
  border: 1px solid rgba(104, 211, 145, 0.2);
`;

const BadgesRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
`;

const CryptoBadge = styled.span`
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(104, 211, 145, 0.15);
  border: 1px solid rgba(104, 211, 145, 0.35);
  color: #9ae6b4;
`;

const BalanceBox = styled.div`
  background: rgba(45, 55, 72, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
`;

const BalanceLabel = styled.div`
  font-size: 12px;
  color: #a0aec0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
`;

const BalanceValue = styled.div`
  font-size: 22px;
  font-weight: 700;
  color: #f7fafc;
`;

const EmptyBox = styled.div`
  padding: 16px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  color: #cbd5e0;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 16px;
`;

const RefreshButton = styled.button`
  background: transparent;
  color: #63b3ed;
  border: 1px solid #63b3ed;
  padding: 8px 14px;
  min-height: auto;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgba(99, 179, 237, 0.12);
    color: #90cdf4;
    border-color: #90cdf4;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

function getAccountLabel(acc: any): { label: string; shortLabel: string } {
  const opts = acc?.options || {};
  const isFalcon = opts.pqcAlgorithm === 'FALCON512';

  if (opts.isEcdsa) {
    return { label: 'ECDSA Clássica (BIP-44)', shortLabel: 'ECDSA Clássica' };
  }
  if (opts.isHybrid) {
    return isFalcon
      ? { label: 'Híbrida (ECDSA + Falcon-512)', shortLabel: 'Híbrida Falcon-512' }
      : { label: 'Híbrida (ECDSA + ML-DSA-44)', shortLabel: 'Híbrida ML-DSA-44' };
  }
  if (opts.isPQC) {
    return isFalcon
      ? { label: 'Falcon-512 Pura', shortLabel: 'Falcon-512' }
      : { label: 'ML-DSA-44 Pura', shortLabel: 'ML-DSA-44' };
  }
  return { label: 'ECDSA Simulada (legada)', shortLabel: 'Legada' };
}

export interface AccountCardProps {
  accounts: any[];
  selectedAddress: string;
  onSelectAddress: (addr: string) => void;
  ethBalance: string;
  isLoading: boolean;
  onRefresh: () => void;
}

export const AccountCard = ({
  accounts = [],
  selectedAddress = '',
  onSelectAddress,
  ethBalance,
  isLoading,
  onRefresh,
}: AccountCardProps) => {
  const activeAccount =
    accounts.find((a) => (a.address || '').toLowerCase() === (selectedAddress || '').toLowerCase()) ||
    accounts[0];
  const profile = activeAccount ? getAccountLabel(activeAccount) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>👤 Conta PQC Ativa</CardTitle>
        {accounts.length > 1 ? (
          <SelectSender value={selectedAddress} onChange={(e) => onSelectAddress(e.target.value)}>
            {accounts.map((acc) => {
              const p = getAccountLabel(acc);
              return (
                <option key={acc.address} value={acc.address}>
                  {`${(acc.address || '').slice(0, 10)}...${(acc.address || '').slice(-6)} (${p.shortLabel})`}
                </option>
              );
            })}
          </SelectSender>
        ) : null}
      </CardHeader>

      {accounts.length === 0 ? (
        <EmptyBox>
          Nenhuma conta criada ainda. Abra o <strong>PQC Account</strong> dentro do MetaMask Flask
          (menu <strong>Snaps</strong> → aba <strong>2. Gerar / Backup / Adicionar Contas</strong>)
          para inicializar sua frase e derivar uma conta, depois clique em <strong>Atualizar</strong>.
        </EmptyBox>
      ) : (
        <>
          <AddressRow>{selectedAddress}</AddressRow>

          {profile ? (
            <BadgesRow>
              <CryptoBadge>{profile.label}</CryptoBadge>
            </BadgesRow>
          ) : null}

          <BalanceBox>
            <BalanceLabel>Saldo Nativo (ETH)</BalanceLabel>
            <BalanceValue>{isLoading ? '...' : `${ethBalance} ETH`}</BalanceValue>
          </BalanceBox>
        </>
      )}

      <RefreshButton type="button" onClick={onRefresh} disabled={isLoading}>
        🔄 {isLoading ? 'Atualizando...' : 'Atualizar'}
      </RefreshButton>
    </Card>
  );
};

export default AccountCard;
