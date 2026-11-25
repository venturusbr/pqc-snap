import styled from 'styled-components';

const GuideCard = styled.div`
  background: rgba(26, 32, 44, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 24px;
`;

const GuideTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #edf2f7;
  margin: 0 0 12px 0;
`;

const GuideList = styled.ol`
  margin: 0;
  padding-left: 20px;
  color: #a0aec0;
  font-size: 14px;
  line-height: 1.6;

  li {
    margin-bottom: 8px;
  }
`;

const Highlight = styled.span`
  color: #4fd1c5;
  font-weight: 600;
`;

export const SnapGuide = () => {
  return (
    <GuideCard>
      <GuideTitle>📱 Como Abrir a Carteira Completa no MetaMask</GuideTitle>
      <GuideList>
        <li>
          Abra a extensão <Highlight>MetaMask Flask</Highlight> no seu navegador.
        </li>
        <li>
          Clique no menu lateral → <Highlight>Snaps</Highlight> → <Highlight>PQC Account</Highlight>.
        </li>
        <li>
          No menu interno do Snap, crie suas contas PQC/híbridas, configure o RPC do Besu, teste
          contratos (<Highlight>0x41 Access List</Highlight> e{' '}
          <Highlight>0x44 Code Delegation</Highlight>) e acompanhe os <Highlight>Logs</Highlight> de
          cada transação.
        </li>
      </GuideList>
    </GuideCard>
  );
};

export default SnapGuide;
