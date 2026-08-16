const http = require('http');

const url = 'http://32.194.87.157:8545';
const txHash = '0x998356adffa50e827fa17d44737aee22c0330b43fdc99384b50d5e07756f5043';
const metamaskAddr = '0x90c63ac51f266aeb579be629aac93dcb8b01d329';
const recoveredAddr = '0x99f15eda330156c9b6ed46516d77110058d5e659';

function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    });

    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error("Erro ao parsear resposta: " + body));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log("=== VERIFICANDO ESTADO NO BESU ===");
  try {
    // 1. Obter informações da transação
    const txInfo = await rpc('eth_getTransactionByHash', [txHash]);
    console.log("\n1. Transação por Hash:");
    console.log(JSON.stringify(txInfo, null, 2));

    // 2. Obter recibo da transação
    const txReceipt = await rpc('eth_getTransactionReceipt', [txHash]);
    console.log("\n2. Recibo da Transação:");
    console.log(JSON.stringify(txReceipt, null, 2));

    // 3. Obter saldo da conta MetaMask
    const balMetaMask = await rpc('eth_getBalance', [metamaskAddr, 'latest']);
    console.log(`\n3. Saldo da conta MetaMask (${metamaskAddr}):`);
    console.log(`   Hex: ${balMetaMask.result}`);
    if (balMetaMask.result) {
      console.log(`   Wei: ${BigInt(balMetaMask.result).toString()}`);
      console.log(`   ETH: ${Number(BigInt(balMetaMask.result)) / 1e18}`);
    }

    // 4. Obter saldo da conta recuperada
    const balRecovered = await rpc('eth_getBalance', [recoveredAddr, 'latest']);
    console.log(`\n4. Saldo da conta recuperada (${recoveredAddr}):`);
    console.log(`   Hex: ${balRecovered.result}`);
    if (balRecovered.result) {
      console.log(`   Wei: ${BigInt(balRecovered.result).toString()}`);
      console.log(`   ETH: ${Number(BigInt(balRecovered.result)) / 1e18}`);
    }

    // 5. Obter o nonce de ambas as contas
    const nonceMetaMask = await rpc('eth_getTransactionCount', [metamaskAddr, 'latest']);
    const nonceRecovered = await rpc('eth_getTransactionCount', [recoveredAddr, 'latest']);
    console.log("\n5. Nonces atuais no Besu:");
    console.log(`   MetaMask (${metamaskAddr}): Nonce = ${parseInt(nonceMetaMask.result || '0x0', 16)}`);
    console.log(`   Recovered (${recoveredAddr}): Nonce = ${parseInt(nonceRecovered.result || '0x0', 16)}`);

  } catch (e) {
    console.error("Erro na comunicação com o Besu:", e.message);
  }
}

run();
