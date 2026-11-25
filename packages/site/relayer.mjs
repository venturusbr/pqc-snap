import { createServer } from 'http';
import crypto from 'crypto';
import falcon from 'falcon-crypto';
import { 
  createWalletClient, createPublicClient, http as viemHttp, 
  toBlobs, parseEther, defineChain, bytesToHex, hexToBytes 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { setupKzg } from 'viem';
import { loadKZG } from 'kzg-wasm';

// Execution Mode Options:
// 'HYBRID_FALCON' -> 65 bytes ECDSA (from Snap) + Falcon signature
// 'PURE_FALCON'   -> Falcon signature only
// 'HYBRID_MLDSA'  -> Original 2485 bytes (65B ECDSA + 2420B ML-DSA-44) from Snap
const PQC_MODE = 'HYBRID_FALCON';

const besuLocal = defineChain({
  id: 1337,
  name: 'Besu Local',
  network: 'besu-local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
});

function detectFalconProfile(publicKey, privateKey, signature) {
  const pubLen = publicKey ? publicKey.length : 0;
  const privLen = privateKey ? privateKey.length : 0;
  const logN = publicKey && publicKey.length > 0 ? (publicKey[0] & 0x0f) : 0;

  if (pubLen === 897 || privLen === 1281 || logN === 9) {
    return {
      name: 'FALCON-512',
      degreeN: 512,
      nistLevel: 'Level 1',
      nistPubBytes: 897,
      nistPrivBytes: 1281,
      nistSigRef: '~666 B (padded) / 690 B (CT)',
      expectedHeaderHex: '0x39',
    };
  }

  if (pubLen === 1793 || privLen === 2305 || logN === 10) {
    return {
      name: 'FALCON-1024',
      degreeN: 1024,
      nistLevel: 'Level 5',
      nistPubBytes: 1793,
      nistPrivBytes: 2305,
      nistSigRef: '~1280 B (padded) / 1330 B (max)',
      expectedHeaderHex: '0x3a',
    };
  }

  const inferredN = logN > 0 ? (1 << logN) : 'Unknown';
  return {
    name: `FALCON-${inferredN}`,
    degreeN: inferredN,
    nistLevel: 'Custom',
    nistPubBytes: pubLen,
    nistPrivBytes: privLen,
    nistSigRef: `${signature ? signature.length : 0} B`,
    expectedHeaderHex: signature && signature.length > 0 ? `0x${(0x30 | logN).toString(16)}` : 'N/A',
  };
}

let falconKeyPair = null;

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/enviar-blob') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    
    req.on('end', async () => {
      try {
        const { signature, toAddress, amount } = JSON.parse(body);
        const rawSnapBytes = hexToBytes(signature);
        const ecdsa65Bytes = rawSnapBytes.slice(0, 65);

        let finalPayloadBytes;
        let activeAlgorithm = '';
        let nistSecurityLevel = '';

        if (PQC_MODE === 'HYBRID_FALCON' || PQC_MODE === 'PURE_FALCON') {
          if (!falconKeyPair) {
            console.log("[PQC] Gerando par de chaves pos-quanticas Falcon...");
            falconKeyPair = await falcon.keyPair();
          }

          const msgParaAssinar = new Uint8Array([
            ...ecdsa65Bytes,
            ...Buffer.from(`${toAddress}:${amount}`, 'utf8')
          ]);

          const t0Sign = performance.now();
          const falconSigBytes = await falcon.signDetached(msgParaAssinar, falconKeyPair.privateKey);
          const t1Sign = performance.now();

          const t0Ver = performance.now();
          const isFalconValid = await falcon.verifyDetached(falconSigBytes, msgParaAssinar, falconKeyPair.publicKey);
          const t1Ver = performance.now();

          if (!isFalconValid) {
            throw new Error("Falha na verificacao matematica da assinatura Falcon!");
          }

          const profile = detectFalconProfile(falconKeyPair.publicKey, falconKeyPair.privateKey, falconSigBytes);
          nistSecurityLevel = profile.nistLevel;

          console.log(`\n[AUDITORIA CRIPTOGRAFICA ${profile.name} | NIST ${profile.nistLevel} (N=${profile.degreeN})]`);
          console.log(`   ├─ Chave Publica ${profile.name.padEnd(11)} : ${falconKeyPair.publicKey.length} bytes (Padrao NIST: ${profile.nistPubBytes} B)`);
          console.log(`   ├─ Chave Privada ${profile.name.padEnd(11)} : ${falconKeyPair.privateKey.length} bytes (Padrao NIST: ${profile.nistPrivBytes} B)`);
          console.log(`   ├─ Assinatura ${profile.name.padEnd(14)} : ${falconSigBytes.length} bytes (Ref NIST: ${profile.nistSigRef} | ML-DSA-44: 2420 B)`);
          console.log(`   ├─ Header Byte Falcon        : 0x${falconSigBytes[0].toString(16)} (Spec N=${profile.degreeN}: ${profile.expectedHeaderHex})`);
          console.log(`   ├─ Tempo de Assinatura       : ${(t1Sign - t0Sign).toFixed(2)} ms`);
          console.log(`   ├─ Tempo de Verificacao      : ${(t1Ver - t0Ver).toFixed(2)} ms`);
          console.log(`   └─ Verificacao falcon.verify : ${isFalconValid ? 'VALIDA' : 'INVALIDA'}`);

          if (PQC_MODE === 'HYBRID_FALCON') {
            finalPayloadBytes = new Uint8Array(ecdsa65Bytes.length + falconSigBytes.length);
            finalPayloadBytes.set(ecdsa65Bytes, 0);
            finalPayloadBytes.set(falconSigBytes, ecdsa65Bytes.length);
            activeAlgorithm = `HYBRID_${profile.name}_ECDSA (65B + ${falconSigBytes.length}B | NIST ${profile.nistLevel})`;
          } else {
            finalPayloadBytes = falconSigBytes;
            activeAlgorithm = `PURE_${profile.name} (${falconSigBytes.length}B | NIST ${profile.nistLevel})`;
          }
        } else {
          finalPayloadBytes = rawSnapBytes;
          nistSecurityLevel = 'Level 2';
          activeAlgorithm = `HYBRID_ML-DSA-44_ECDSA (65B + 2420B | NIST Level 2)`;
        }

        const blobSource = bytesToHex(finalPayloadBytes);

        console.log("\n[RELAYER] Carregando KZG Trusted Setup...");
        const setupReq = await fetch('https://raw.githubusercontent.com/ethereum/c-kzg-4844/main/src/trusted_setup.txt');
        const setupText = await setupReq.text();
        const kzgInstance = await loadKZG();
        
        const keys = Object.keys(kzgInstance);
        const commitKey = keys.find(k => k.toLowerCase() === 'blobtokzgcommitment');
        const proofKey = keys.find(k => k.toLowerCase() === 'computeblobkzgproof' || k.toLowerCase() === 'computekzgproof' || k.toLowerCase() === 'blobtokzgproof');

        const kzgAdapter = {
          loadTrustedSetup: (setup) => { 
            if (typeof kzgInstance.loadTrustedSetup === 'function') kzgInstance.loadTrustedSetup(setup); 
          },
          blobToKzgCommitment: (blob) => {
            const hexCommitment = kzgInstance[commitKey](bytesToHex(blob));
            return typeof hexCommitment === 'string' ? hexToBytes(hexCommitment) : hexCommitment;
          },
          computeBlobKzgProof: (blob, commitment) => {
            const hexProof = kzgInstance[proofKey](bytesToHex(blob), bytesToHex(commitment));
            return typeof hexProof === 'string' ? hexToBytes(hexProof) : hexProof;
          }
        };

        kzgAdapter.loadTrustedSetup(setupText);
        const kzgSetup = setupKzg(kzgAdapter, setupText);

        const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
        const publicClient = createPublicClient({ chain: besuLocal, transport: viemHttp('http://127.0.0.1:8545') });
        const walletClient = createWalletClient({ account, chain: besuLocal, transport: viemHttp('http://127.0.0.1:8545') });

        const blobsData = toBlobs({ data: blobSource });

        const commitmentBytes = kzgAdapter.blobToKzgCommitment(hexToBytes(blobsData[0]));
        const sha256Commitment = crypto.createHash('sha256').update(Buffer.from(commitmentBytes)).digest('hex');
        const versionedHashEsperado = '0x01' + sha256Commitment.slice(2);

        console.log("\n--- AUDITORIA DO BLOB PQC (EIP-4844) ---");
        console.log("Modo de Operacao          :", PQC_MODE);
        console.log("Algoritmo no Blob         :", activeAlgorithm);
        console.log("Nivel de Seguranca NIST   :", nistSecurityLevel);
        console.log("Tamanho total no Blob     :", finalPayloadBytes.length, "bytes");
        console.log("Primeiros 60 chars Hex    :", blobSource.substring(0, 60) + "...");
        console.log("KZG Commitment (48 bytes) :", bytesToHex(commitmentBytes));
        console.log("Versioned Hash (0x01...)  :", versionedHashEsperado);
        console.log("----------------------------------------\n");

        const manualNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
        const actualChainId = await publicClient.getChainId();

        console.log(`[RELAYER] Disparando transacao EIP-4844 (Type 3) usando Nonce: ${manualNonce}...`);
        
        const hash = await walletClient.sendTransaction({
          account,
          chain: defineChain({ ...besuLocal, id: actualChainId }),
          to: toAddress,
          value: parseEther(amount.toString()),
          blobs: blobsData,
          kzg: kzgSetup,
          nonce: manualNonce,
          gas: 3000000n,
          maxFeePerBlobGas: 0n,
          maxFeePerGas: 0n,
          maxPriorityFeePerGas: 0n,
          type: 'eip4844',
        });

        console.log(`[RELAYER] SUCESSO! Hash: ${hash}\n`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          hash,
          mode: PQC_MODE,
          algorithm: activeAlgorithm,
          nistLevel: nistSecurityLevel,
          signatureBytes: finalPayloadBytes.length,
          blobVersionedHash: versionedHashEsperado
        }));
        
      } catch (err) {
        console.error("[RELAYER] ERRO:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3001, () => {
  console.log(`Relayer PQC rodando em http://127.0.0.1:3001 (Mode: ${PQC_MODE}) ...`);
});
