import styled from 'styled-components';

const HeaderWrapper = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 32px;
  gap: 16px;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;

const LogoIcon = styled.div`
  font-size: 28px;
  background: rgba(255, 255, 255, 0.05);
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(90deg, #68d391 0%, #4fd1c5 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const Subtitle = styled.p`
  margin: 4px 0 0 0;
  font-size: 13px;
  color: #a0aec0;
`;

const ConnectedGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const ConnectionStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(72, 187, 120, 0.1);
  border: 1px solid rgba(72, 187, 120, 0.3);
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: #48bb78;
`;

const StatusDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #48bb78;
`;

const ConnectButton = styled.button`
  background: linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%);
  color: #ffffff;
  border: none;
  padding: 10px 18px;
  min-height: auto;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    background: linear-gradient(135deg, #2b6cb0 0%, #2c5282 100%);
    color: #ffffff;
    border: none;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(49, 130, 206, 0.4);
  }
`;

const ReconnectButton = styled.button`
  background: transparent;
  color: #90cdf4;
  border: 1px solid rgba(144, 205, 244, 0.4);
  padding: 8px 12px;
  min-height: auto;
  border-radius: 10px;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(144, 205, 244, 0.12);
    color: #bee3f8;
    border-color: #90cdf4;
  }
`;

const InstallLink = styled.a`
  display: inline-block;
  background: linear-gradient(135deg, #dd6b20 0%, #c05621 100%);
  color: #ffffff;
  text-decoration: none;
  padding: 10px 18px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s ease-in-out;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(221, 107, 32, 0.35);
  }
`;

export interface DAppHeaderProps {
  isFlaskDetected: boolean;
  isConnected: boolean;
  onConnect: () => void;
}

export const DAppHeader = ({
  isFlaskDetected,
  isConnected,
  onConnect,
}: DAppHeaderProps) => {
  return (
    <HeaderWrapper>
      <TitleGroup>
        <LogoIcon>🛡️</LogoIcon>
        <div>
          <Title>PQC Snap</Title>
          <Subtitle>Carteira Pós-Quântica para MetaMask • ML-DSA-44, Falcon-512 &amp; Híbrida</Subtitle>
        </div>
      </TitleGroup>

      {!isFlaskDetected ? (
        <InstallLink
          href="https://metamask.io/flask/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Instalar MetaMask Flask
        </InstallLink>
      ) : isConnected ? (
        <ConnectedGroup>
          <ConnectionStatus>
            <StatusDot />
            Snap Conectado
          </ConnectionStatus>
          <ReconnectButton type="button" onClick={onConnect}>
            Reconectar
          </ReconnectButton>
        </ConnectedGroup>
      ) : (
        <ConnectButton type="button" onClick={onConnect}>
          Conectar MetaMask Snap
        </ConnectButton>
      )}
    </HeaderWrapper>
  );
};

export default DAppHeader;
