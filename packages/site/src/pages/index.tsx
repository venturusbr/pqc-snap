import styled from 'styled-components';
import { usePqcSnap } from '../hooks/usePqcSnap';
import { DAppHeader } from '../components/DAppHeader';
import { SnapGuide } from '../components/SnapGuide';

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 20px 24px 60px 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #edf2f7;
`;

const StatusNotice = styled.div<{ isError?: boolean }>`
  margin-bottom: 24px;
  padding: 12px 16px;
  border-radius: 10px;
  background: ${(props) =>
    props.isError ? 'rgba(229, 62, 62, 0.15)' : 'rgba(72, 187, 120, 0.15)'};
  border: 1px solid
    ${(props) => (props.isError ? 'rgba(229, 62, 62, 0.3)' : 'rgba(72, 187, 120, 0.3)')};
  color: ${(props) => (props.isError ? '#feb2b2' : '#9ae6b4')};
  font-size: 13px;
  word-break: break-word;
`;

const Index = () => {
  const {
    isFlaskDetected,
    isConnected,
    statusMessage,
    handleConnectSnap,
  } = usePqcSnap();

  const isStatusError =
    (statusMessage || '').startsWith('❌') || (statusMessage || '').startsWith('⚠️');

  return (
    <Container>
      <DAppHeader
        isFlaskDetected={isFlaskDetected}
        isConnected={isConnected}
        onConnect={handleConnectSnap}
      />

      {statusMessage ? (
        <StatusNotice isError={isStatusError}>{statusMessage}</StatusNotice>
      ) : null}

      <SnapGuide />
    </Container>
  );
};

export default Index;
