import { useState, useEffect } from 'react';
import { defaultSnapOrigin } from '../config';
import { getSnapsProvider } from '../utils';

async function resolveProvider(): Promise<any> {
  const snapsProvider = await getSnapsProvider();
  if (snapsProvider) {
    return snapsProvider;
  }
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return (window as any).ethereum;
  }
  return null;
}

export const usePqcSnap = () => {
  const [isFlaskDetected, setIsFlaskDetected] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    const detectAndConnect = async () => {
      const snapsProvider = await getSnapsProvider();
      if (!snapsProvider) {
        setIsFlaskDetected(false);
        return;
      }

      setIsFlaskDetected(true);
      try {
        const installedSnaps = (await snapsProvider.request({
          method: 'wallet_getSnaps',
        })) as Record<string, any>;

        if (installedSnaps && installedSnaps[defaultSnapOrigin]) {
          setIsConnected(true);
        }
      } catch (err) {
        console.warn('Snap ainda não conectado:', err);
      }
    };

    detectAndConnect().catch(console.error);
  }, []);

  const handleConnectSnap = async () => {
    const provider = await resolveProvider();
    if (!provider) {
      setStatusMessage('❌ MetaMask Flask não detectado. Instale a extensão para continuar.');
      return;
    }

    try {
      setStatusMessage('Solicitando conexão e instalação do Snap no MetaMask Flask...');
      await provider.request({
        method: 'wallet_requestSnaps',
        params: {
          [defaultSnapOrigin]: {},
        },
      });

      setIsFlaskDetected(true);
      setIsConnected(true);
      setStatusMessage('✅ Snap conectado! Abra MetaMask Flask → Snaps → PQC Account para usar a carteira.');
    } catch (error: any) {
      console.error(error);
      setStatusMessage(`❌ Erro ao conectar o Snap: ${error?.message || error}`);
    }
  };

  return {
    isFlaskDetected,
    isConnected,
    statusMessage,
    handleConnectSnap,
  };
};

export default usePqcSnap;
