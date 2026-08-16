// export default Index;
import { useState } from 'react';
import { getSnapsProvider } from '../utils';

// O ID do seu Snap local gerado pelo template
const defaultSnapOrigin = 'local:http://localhost:8080';

export default function Index() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [message, setMessage] = useState<string>('');
  
  // Novos estados para a transferência
  const [selectedFrom, setSelectedFrom] = useState<string>('');
  const [toAddress, setToAddress] = useState<string>('');
  const [amountEth, setAmountEth] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [signedTx, setSignedTx] = useState<string>('');
  const [txType, setTxType] = useState<string>('0x42');
  const [besuRpcUrl, setBesuRpcUrl] = useState<string>('http://localhost:8545');
  const [dsaRpcUrl, setDsaRpcUrl] = useState<string>('http://localhost:8545');
  const [supportedDSAs, setSupportedDSAs] = useState<any[] | null>(null);
  const [dsaError, setDsaError] = useState<string>('');
  const [isDsaLoading, setIsDsaLoading] = useState<boolean>(false);

  const getEthereumProvider = async () => {
    if (typeof window === 'undefined') {
      return null;
    }
    const provider = (await getSnapsProvider()) || (window as any).ethereum;
    return provider || null;
  };

  // Auxiliar para converter ETH para Wei
  const ethToWei = (ethVal: string): string => {
    if (!ethVal || ethVal.startsWith('-')) return '0';
    const parts = ethVal.split('.');
    let integerPart = (parts[0] || '0').replace('-', '');
    let decimalPart = parts[1] || '';
    decimalPart = decimalPart.padEnd(18, '0').slice(0, 18);
    const combined = integerPart + decimalPart;
    try {
      const cleanBigInt = BigInt(combined);
      return cleanBigInt < 0n ? '0' : cleanBigInt.toString();
    } catch {
      return '0';
    }
  };

  // Função 1: Conectar à MetaMask e instalar o Snap
  const handleConnect = async () => {
    try {
      const ethereum = await getEthereumProvider();
      if (!ethereum) {
        setMessage('MetaMask não encontrado no navegador. Por favor, verifique se a extensão MetaMask está instalada e ativa.');
        return;
      }
      await ethereum.request({
        method: 'wallet_requestSnaps',
        params: {
          [defaultSnapOrigin]: {},
        },
      });
      setMessage('Snap conectado com sucesso!');
      await handleGetAccounts();
    } catch (error: any) {
      console.error(error);
      setMessage(`Erro ao conectar o Snap: ${error?.message || 'Erro desconhecido'}`);
    }
  };



  // Função 2: Chamar o Snap para criar uma nova conta
  const handleCreateAccount = async () => {
    try {
      const ethereum = await getEthereumProvider();
      if (!ethereum) {
        setMessage('MetaMask não encontrado no navegador. Por favor, verifique se a extensão MetaMask está instalada e ativa.');
        return;
      }
      setMessage('Aguardando escolha do utilizador no pop-up da MetaMask...');
      const response = await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: defaultSnapOrigin,
          request: { method: 'keyring_createAccount' },
        },
      });
      
      console.log('Resposta da criação:', response);
      setMessage('Conta processada com sucesso!');
    } catch (error: any) {
      console.error(error);
      const isDup = /duplicate|already exists|keyringcontroller/i.test(error.message || '');
      if (isDup) {
        setMessage('A conta derivada já existia no MetaMask. Atualizando a lista de contas...');
      } else {
        setMessage(`Ação cancelada ou erro: ${error.message}`);
      }
    } finally {
      // Atualiza a lista automaticamente sempre
      await handleGetAccounts();
    }
  };

  // Função 3: Chamar o Snap para listar contas geradas
  const handleGetAccounts = async () => {
    try {
      const ethereum = await getEthereumProvider();
      if (!ethereum) {
        setMessage('MetaMask não encontrado no navegador.');
        return;
      }
      const response = await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: defaultSnapOrigin,
          request: { method: 'get_accounts' },
        },
      });
      
      console.log('Resposta de get_accounts do Snap:', response);
      let list: any[] = [];

      if (Array.isArray(response)) {
        list = response;
      } else if (response && typeof response === 'object' && Array.isArray((response as any).accounts)) {
        list = (response as any).accounts;
      }

      // Se o snap state não tiver contas salvas, tenta consultar as contas conectadas do MetaMask via eth_accounts / eth_requestAccounts
      if (list.length === 0) {
        try {
          let ethAccounts = (await ethereum.request({ method: 'eth_accounts' })) as string[];
          if (!ethAccounts || ethAccounts.length === 0) {
            ethAccounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];
          }
          if (Array.isArray(ethAccounts) && ethAccounts.length > 0) {
            list = ethAccounts.map((addr) => ({
              id: addr,
              address: addr,
              options: { isPQC: false, isHybrid: true },
            }));
          }
        } catch (e) {
          console.warn('Falha ao consultar eth_accounts/eth_requestAccounts:', e);
        }
      }
      
      setAccounts(list);
      if (list.length > 0 && !selectedFrom) {
        setSelectedFrom(list[0].address);
      }
      setMessage(`Contas carregadas com sucesso! (${list.length} conta(s) encontrada(s))`);
    } catch (error: any) {
      console.error(error);
      setMessage(`Erro ao carregar contas: ${error.message}`);
    }
  };





  // Função 4: Efetuar transferência (Assinar com Snap + Transmitir pela Dapp)
  const handleTransfer = async () => {
    try {
      setTxHash('');
      if (!selectedFrom || !toAddress || !amountEth) {
        setMessage('Erro: preencha todos os campos da transferência.');
        return;
      }

      const ethereum = await getEthereumProvider();
      if (!ethereum) {
        setMessage('MetaMask não encontrado no navegador.');
        return;
      }

      setMessage('Obtendo nonce atual da conta no Besu...');
      let nonce: string;
      try {
        const response = await fetch(besuRpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getTransactionCount',
            params: [selectedFrom, 'pending'],
          }),
        });
        const rpcResult = await response.json();
        if (rpcResult.result !== undefined) {
          nonce = rpcResult.result;
        } else {
          throw new Error('Falha ao obter nonce do Besu');
        }
      } catch (directNonceError) {
        console.warn('Erro ao obter nonce via HTTP RPC Besu, usando fallback window.ethereum:', directNonceError);
        nonce = (await ethereum.request({
          method: 'eth_getTransactionCount',
          params: [selectedFrom, 'pending'],
        })) as string;
      }

      setMessage('Obtendo preço médio do gás no Besu...');
      let gasPrice: string;
      try {
        const response = await fetch(besuRpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_gasPrice',
            params: [],
          }),
        });
        const rpcResult = await response.json();
        if (rpcResult.result !== undefined) {
          gasPrice = rpcResult.result;
        } else {
          throw new Error('Falha ao obter gasPrice do Besu');
        }
      } catch (directGasError) {
        console.warn('Erro ao obter gasPrice via HTTP RPC Besu, usando fallback window.ethereum:', directGasError);
        gasPrice = (await ethereum.request({
          method: 'eth_gasPrice',
        })) as string;
      }

      // Força o Chain ID correto do Besu (381660666 / 0x16bfadfa)
      const chainId = '0x16bfadfa';

      // Valor convertido para hexadecimal do Wei
      const valueWei = ethToWei(amountEth);
      const valueHex = '0x' + BigInt(valueWei).toString(16);

      const tx: any = {
        from: selectedFrom,
        to: toAddress,
        value: valueHex,
        nonce: nonce,
        gasLimit: '0x0f4240',
        chainId: chainId,
        data: '0x',
      };

      // Tipo EIP-1559: 0x42 (Flexible PQC/Híbrida) ou 0x02 (Standard ECDSA)
      tx.type = txType;
      tx.maxPriorityFeePerGas = gasPrice || '0x0';
      tx.maxFeePerGas = gasPrice || '0x0';
      tx.accessList = [];

      console.log('Transação a ser assinada:', tx);

      setMessage('Solicitando assinatura pós-quântica no Snap...');
      const signResult = await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: defaultSnapOrigin,
          request: {
            method: 'sign_transaction',
            params: { tx }
          },
        },
      }) as any;

      console.log('Retorno da assinatura do Snap:', signResult);
      console.log('==================================================');
      console.log('TRANS_RAW_HEX:', signResult.serializedTx);
      console.log('==================================================');
      setSignedTx(signResult.serializedTx);
      setMessage('Transação assinada recebida do Snap. Transmitindo para o Besu...');

      let hash: string;
      try {
        console.log('Tentando transmitir diretamente para o nó Besu via HTTP:', besuRpcUrl);
        const rpcResponse = await fetch(besuRpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_sendRawTransaction',
            params: [signResult.serializedTx],
          }),
        });

        const rpcResult = await rpcResponse.json();
        if (rpcResult.error) {
          const errMsg = rpcResult.error.message || JSON.stringify(rpcResult.error);
          throw { isRpcError: true, message: errMsg };
        }
        hash = rpcResult.result;
      } catch (directFetchError: any) {
        if (directFetchError.isRpcError) {
          throw new Error(`Erro do Besu: ${directFetchError.message}`);
        }
        console.warn('Erro ao enviar direto via HTTP pro Besu, tentando fallback pelo MetaMask:', directFetchError);
        hash = await ethereum.request({
          method: 'eth_sendRawTransaction',
          params: [signResult.serializedTx],
        }) as string;
      }

      console.log('Hash retornado pela rede:', hash);
      setTxHash(hash);
      setMessage(`Transferência realizada com sucesso! Transação minerando.`);
    } catch (error: any) {
      console.error('Erro na transferência:', error);
      setMessage(`Erro ao efetuar transferência: ${error.message || JSON.stringify(error)}`);
    }
  };

  // Função para buscar os DSAs suportados da rede informada
  const handleFetchSupportedDSAs = async () => {
    setIsDsaLoading(true);
    setSupportedDSAs(null);
    setDsaError('');
    try {
      const response = await fetch(dsaRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'vnt_getAccountsSupportedDSAs',
          params: [],
          id: 1,
        }),
      });

      const json = await response.json();
      if (json.error) {
        setDsaError(json.error.message || JSON.stringify(json.error));
      } else if (json.result !== undefined) {
        setSupportedDSAs(json.result);
      } else {
        setDsaError('Resposta inválida da rede (sem result nem error).');
      }
    } catch (err: any) {
      console.error(err);
      setDsaError(`Erro ao consultar rede: ${err.message || JSON.stringify(err)}`);
    } finally {
      setIsDsaLoading(false);
    }
  };

  const selectedAccountObj = accounts.find(a => a.address.toLowerCase() === selectedFrom.toLowerCase());
  const isPqcSender = Boolean(selectedAccountObj?.options?.isPQC);

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Teste do Snap Pós-Quântico (ML-DSA)</h1>
      <p>Este site comunica-se com a MetaMask para pedir a geração de chaves PQC no seu Snap.</p>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={handleConnect} style={btnStyle}>1. Conectar / Instalar Snap</button>
        <button onClick={handleCreateAccount} style={btnStyle}>2. Derivar Nova Conta</button>
        <button onClick={handleGetAccounts} style={btnStyle}>3. Listar Minhas Contas</button>
      </div>



      <div style={{ padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px', marginBottom: '20px' }}>
        <strong>Status:</strong> {message}
      </div>

      <h2>As suas Contas ({accounts.length})</h2>
      {accounts.length === 0 ? (
        <p>Nenhuma conta criada ainda. Clique no botão "Criar Nova Conta".</p>
      ) : (
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {accounts.map((acc, index) => (
            <li key={index} style={{ border: '1px solid #ccc', padding: '15px', margin: '10px 0', borderRadius: '8px', wordBreak: 'break-all' }}>
              <p><strong>Tipo:</strong> {acc.options?.isHybrid ? 'Híbrida (ECDSA + ML-DSA-44)' : acc.options?.isPQC ? 'ML-DSA-44 (Pós-Quântica)' : 'ECDSA Padrão'}</p>
              <p><strong>Endereço:</strong> {acc.address}</p>
              <p><strong>ID na MetaMask:</strong> {acc.id}</p>
            </li>
          ))}
        </ul>
      )}



      <h2>Consultar DSAs Suportados pela Rede</h2>
      <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px', backgroundColor: '#fafafa', marginTop: '20px', marginBottom: '30px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>URL da Rede (RPC):</label>
          <input 
            type="text" 
            placeholder="http://localhost:8545" 
            value={dsaRpcUrl} 
            onChange={(e) => setDsaRpcUrl(e.target.value)} 
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <button 
          onClick={handleFetchSupportedDSAs} 
          disabled={isDsaLoading || !dsaRpcUrl}
          style={{
            ...btnStyle,
            backgroundColor: (isDsaLoading || !dsaRpcUrl) ? '#ccc' : '#4CAF50',
            cursor: (isDsaLoading || !dsaRpcUrl) ? 'not-allowed' : 'pointer'
          }}
        >
          {isDsaLoading ? 'Consultando...' : 'Consultar DSAs Suportados'}
        </button>

        {dsaError && (
          <div style={{ marginTop: '15px', color: 'red', fontWeight: 'bold' }}>
            Erro: {dsaError}
          </div>
        )}

        {supportedDSAs && (
          <div style={{ marginTop: '15px' }}>
            <strong>DSAs Suportados:</strong>
            {Array.isArray(supportedDSAs) ? (
              supportedDSAs.length === 0 ? (
                <p style={{ margin: '5px 0 0 0', color: '#666' }}>Nenhum DSA retornado pela rede.</p>
              ) : (
                <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                  {supportedDSAs.map((dsa: any, index: number) => (
                    <li key={index} style={{ fontFamily: 'monospace', fontSize: '14px', margin: '4px 0' }}>
                      {typeof dsa === 'object' ? JSON.stringify(dsa) : String(dsa)}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <pre style={{ backgroundColor: '#eaeaea', padding: '10px', borderRadius: '4px', fontSize: '12px', overflowX: 'auto', marginTop: '5px' }}>
                {JSON.stringify(supportedDSAs, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      <h2>Efetuar Transferência PQC / Híbrida / ECDSA</h2>
      <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px', backgroundColor: '#fafafa', marginTop: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Conta de Origem:</label>
          <select 
            value={selectedFrom} 
            onChange={(e) => {
              const val = e.target.value;
              setSelectedFrom(val);
              const acc = accounts.find(a => a.address.toLowerCase() === val.toLowerCase());
              if (acc?.options?.isPQC || acc?.options?.isHybrid) {
                setTxType('0x42');
              } else if (val) {
                setTxType('0x02');
              }
            }} 
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="">Selecione uma conta...</option>
            {accounts.map((acc, index) => (
              <option key={index} value={acc.address}>
                {acc.address} ({acc.options?.isHybrid ? 'Híbrida' : acc.options?.isPQC ? 'PQC Pura' : 'ECDSA Padrão'})
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>URL do RPC do Besu:</label>
          <input 
            type="text" 
            placeholder="http://localhost:8545" 
            value={besuRpcUrl} 
            onChange={(e) => setBesuRpcUrl(e.target.value)} 
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Endereço de Destino:</label>
          <input 
            type="text" 
            placeholder="0x..." 
            value={toAddress} 
            onChange={(e) => setToAddress(e.target.value)} 
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Valor (ETH):</label>
          <input 
            type="number" 
            step="any"
            placeholder="Ex: 0.05" 
            value={amountEth} 
            onChange={(e) => setAmountEth(e.target.value)} 
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Tipo de Transação:</label>
          <select 
            value={txType} 
            onChange={(e) => {
              setTxType(e.target.value);
            }} 
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="0x42">Flexible EIP-1559 (0x42) - PQC/Híbrida (Recomendado para PQC)</option>
            <option value="0x02">Standard EIP-1559 (0x02) - ECDSA Padrão (Recomendado para ECDSA)</option>
          </select>
          {isPqcSender && txType === '0x02' && (
            <div style={{ marginTop: '5px', color: '#d9534f', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#fdf7f7', padding: '8px', borderRadius: '4px', border: '1px solid #d9534f' }}>
              ⚠️ Erro de Compatibilidade: Contas PQC Puras (ML-DSA-44) exigem o tipo de transação pós-quântico 0x42 (Flexible EIP-1559). Altere o tipo para 0x42 para transferir desta conta PQC para qualquer endereço (ECDSA ou PQC).
            </div>
          )}
          {isPqcSender && txType === '0x42' && (
            <div style={{ marginTop: '5px', color: '#155724', fontSize: '12px', backgroundColor: '#d4edda', padding: '6px 10px', borderRadius: '4px' }}>
              ✅ Transação PQC 0x42 válida! O valor será transferido da conta PQC para o endereço de destino informado.
            </div>
          )}
        </div>

        <button 
          onClick={handleTransfer} 
          disabled={!selectedFrom || !toAddress || !amountEth} 
          style={{
            ...btnStyle,
            backgroundColor: (!selectedFrom || !toAddress || !amountEth) ? '#ccc' : '#037DD6',
            cursor: (!selectedFrom || !toAddress || !amountEth) ? 'not-allowed' : 'pointer'
          }}
        >
          Enviar Transferência
        </button>

        {txHash && (
          <div style={{ marginTop: '15px', wordBreak: 'break-all' }}>
            <strong>Hash da Transação:</strong> <span style={{ fontFamily: 'monospace', color: 'green', fontWeight: 'bold' }}>{txHash}</span>
          </div>
        )}

        {signedTx && (
          <div style={{ marginTop: '15px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Transação Serializada (Raw Hex Completo):</label>
            <textarea 
              readOnly 
              value={signedTx} 
              style={{ width: '100%', height: '100px', fontFamily: 'monospace', fontSize: '11px', padding: '5px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
              onClick={(e) => (e.target as any).select()}
            />
            <button 
              onClick={() => {
                navigator.clipboard.writeText(signedTx);
                alert('Copiado para a área de transferência!');
              }}
              style={{ ...btnStyle, backgroundColor: '#4CAF50', marginTop: '5px', padding: '6px 12px', fontSize: '12px' }}
            >
              Copiar Hexadecimal Completo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Estilo básico para os botões ficarem bonitos
const btnStyle = {
  padding: '10px 20px',
  cursor: 'pointer',
  backgroundColor: '#037DD6',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  fontWeight: 'bold'
};