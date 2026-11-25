/**
 * ============================================================================
 * DEPLOY DO CONTRATO DE TESTE (SimpleFlexTest) NO BESU
 * ============================================================================
 * 
 * Script utilitário para implantar o contrato SimpleFlexTest no Hyperledger Besu.
 * 
 * USO:
 *   node scripts/deploy_simple_flex.js [RPC_URL] [CHAVE_PRIVADA] [CAMINHO_JSON_OU_SOL]
 * 
 * EXEMPLOS:
 *   node scripts/deploy_simple_flex.js
 *   node scripts/deploy_simple_flex.js http://127.0.0.1:8545
 *   node scripts/deploy_simple_flex.js http://127.0.0.1:8545 ./SimpleFlexTest.json
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const rawArgs = process.argv.slice(2);

  let rpcUrl = process.env.BESU_RPC_URL || 'http://127.0.0.1:8545';
  let deployerKey = process.env.DEPLOYER_KEY || '0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20';
  let customArtifactPath = null;

  for (const arg of rawArgs) {
    if (arg.startsWith('http://') || arg.startsWith('https://')) {
      rpcUrl = arg;
    } else if (arg.startsWith('--rpc=')) {
      rpcUrl = arg.split('=')[1];
    } else if (arg.startsWith('--key=')) {
      deployerKey = arg.split('=')[1];
    } else if (arg.startsWith('--artifact=')) {
      customArtifactPath = arg.split('=')[1];
    } else if (arg.endsWith('.json') || fs.existsSync(arg)) {
      customArtifactPath = arg;
    } else if (arg.startsWith('0x') && arg.length === 66) {
      deployerKey = arg;
    }
  }

  console.log("==========================================================================");
  console.log(" 🚀 DEPLOY SIMPLE FLEX TEST NO HYPERLEDGER BESU");
  console.log("==========================================================================");
  console.log("📍 RPC Besu:     " + rpcUrl);
  console.log("🔑 Conta Deploy: " + new ethers.Wallet(deployerKey).address + "\n");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployerWallet = new ethers.Wallet(deployerKey, provider);

  const possiblePaths = [
    customArtifactPath,
    path.resolve('./SimpleFlexTest.json'),
    path.resolve('./artifacts/SimpleFlexTest.json'),
    path.resolve('./artifacts/contracts/SimpleFlexTest.sol/SimpleFlexTest.json'),
    path.resolve('../artifacts/SimpleFlexTest.json')
  ].filter(Boolean);

  let artifactPath = null;
  let artifact = null;

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (content.bytecode || content.data?.bytecode) {
          artifactPath = p;
          artifact = content;
          break;
        }
      } catch (e) {}
    }
  }

  if (!artifact) {
    console.error("❌ ERRO: Artefato compilado (SimpleFlexTest.json) não encontrado.");
    console.error("Locais pesquisados:");
    possiblePaths.forEach(p => console.error(" • " + p));
    console.error("\n👉 Para compilar:");
    console.error(" 1. Abra o arquivo SimpleFlexTest.sol no Remix (remix.ethereum.org) ou Hardhat.");
    console.error(" 2. Salve o JSON com { abi: [...], bytecode: '0x...' } em ./SimpleFlexTest.json");
    console.error(" 3. Ou execute passando o caminho do JSON:");
    console.error("    node scripts/deploy_simple_flex.js " + rpcUrl + " /caminho/SimpleFlexTest.json\n");
    process.exit(1);
  }

  console.log("📁 Lendo artefato de: " + artifactPath);
  const bytecode = artifact.bytecode?.object || artifact.bytecode || artifact.data?.bytecode?.object;
  const abi = artifact.abi;

  if (!bytecode || bytecode === '0x' || !abi) {
    console.error("❌ ERRO: O artefato encontrado não contém bytecode ou ABI válido.");
    process.exit(1);
  }

  const factory = new ethers.ContractFactory(abi, bytecode, deployerWallet);

  console.log("⏳ Enviando transação de deploy para o nó Besu...");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const deployedAddress = await contract.getAddress();

  console.log("\n==========================================================================");
  console.log(" ✅ CONTRATO IMPLANTADO COM SUCESSO!");
  console.log("==========================================================================");
  console.log("📍 Endereço do Contrato: " + deployedAddress);
  console.log("👉 Para testar Code Flex Delegation (0x44):");
  console.log("   Cole este endereço no campo 'Contrato de Implementação a Delegar' na DApp.");
  console.log("👉 Para testar Transação 0x41 (Flexible Access List):");
  console.log("   Cole este endereço no campo 'Endereço de Destino' e clique em 'Gerar Access List'.");
  console.log("==========================================================================\n");
}

main().catch((err) => {
  console.error("❌ Erro durante o deploy:", err.message);
  process.exit(1);
});
