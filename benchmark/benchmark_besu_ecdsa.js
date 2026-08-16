/**
 * ============================================================================
 * BESU BENCHMARK - ECDSA TRANSACTIONS (TYPE 0x02)
 * ============================================================================
 * 
 * Executes exclusively conventional EIP-1559 transactions (ECDSA 65B).
 * Saves results into `besu_ecdsa_results.json`.
 * 
 * USAGE EXAMPLES:
 * 1) Via Named Flag:
 *    node benchmark_besu_ecdsa.js --txCount=50
 * 
 * 2) Via Positional Arguments:
 *    node benchmark_besu_ecdsa.js http://localhost:8545 0102... 0x124c... 50 0
 */

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

const currentDirNodeModules = path.resolve(__dirname, 'node_modules');
const projectRootNodeModules = path.resolve(__dirname, '../node_modules');
const snapNodeModules = path.resolve(__dirname, '../packages/snap/node_modules');
module.paths.push(currentDirNodeModules, projectRootNodeModules, snapNodeModules);

/**
 * Universally loads native and WebAssembly cryptographic libraries (@noble/curves, @noble/hashes, and mldsa-wasm) across node_modules environments.
 * @returns {{ secp256k1: object, keccak_256: function, mldsa: object }}
 */
function loadCryptoLibs() {
  let secp256k1Obj = null;
  let keccakObj = null;
  let mldsaObj = null;

  const secpCandidates = [
    () => require('@noble/curves/secp256k1'),
    () => require('@noble/curves/secp256k1.js'),
    () => require('@noble/curves'),
    () => require(path.join(currentDirNodeModules, '@noble/curves/secp256k1.js')),
    () => require(path.join(projectRootNodeModules, '@noble/curves/secp256k1.js')),
    () => require(path.join(snapNodeModules, '@noble/curves/secp256k1.js'))
  ];

  for (const fn of secpCandidates) {
    try {
      const res = fn();
      if (res) {
        secp256k1Obj = res.secp256k1 || res;
        if (secp256k1Obj && typeof secp256k1Obj.getPublicKey === 'function') break;
      }
    } catch (e) {}
  }

  const keccakCandidates = [
    () => require('@noble/hashes/sha3'),
    () => require('@noble/hashes/sha3.js'),
    () => require('@noble/hashes'),
    () => require(path.join(currentDirNodeModules, '@noble/hashes/sha3.js')),
    () => require(path.join(projectRootNodeModules, '@noble/hashes/sha3.js')),
    () => require(path.join(snapNodeModules, '@noble/hashes/sha3.js'))
  ];

  for (const fn of keccakCandidates) {
    try {
      const res = fn();
      if (res) {
        keccakObj = res.keccak_256 || res;
        if (typeof keccakObj === 'function') break;
      }
    } catch (e) {}
  }

  const mldsaCandidates = [
    () => require('mldsa-wasm'),
    () => require(path.join(currentDirNodeModules, 'mldsa-wasm')),
    () => require(path.join(projectRootNodeModules, 'mldsa-wasm')),
    () => require(path.join(snapNodeModules, 'mldsa-wasm'))
  ];

  for (const fn of mldsaCandidates) {
    try {
      const res = fn();
      if (res) {
        mldsaObj = res.default || res;
        if (mldsaObj) break;
      }
    } catch (e) {}
  }

  if (!secp256k1Obj || !keccakObj) {
    throw new Error(
      "DEPENDENCY ERROR: Cryptographic libraries (@noble/curves, @noble/hashes) were not found.\n" +
      "Please run the command below in your terminal before running the test:\n\n" +
      "   npm install @noble/curves @noble/hashes mldsa-wasm\n"
    );
  }

  return {
    secp256k1: secp256k1Obj,
    keccak_256: keccakObj,
    mldsa: mldsaObj
  };
}

const { secp256k1, keccak_256, mldsa } = loadCryptoLibs();

/**
 * Converts a non-negative number into a Uint8Array byte buffer using big-endian encoding.
 * @param {number} num - The number to convert.
 * @returns {Uint8Array|Buffer} The converted byte array.
 */
function numberToBytes(num) {
  if (num === 0) return new Uint8Array(0);
  const hexStr = num.toString(16);
  const padded = hexStr.length % 2 === 0 ? hexStr : '0' + hexStr;
  return Buffer.from(padded, 'hex');
}

/**
 * Converts a 16-bit short integer into a 2-byte Buffer in big-endian order.
 * @param {number} val - The short integer to convert.
 * @returns {Buffer} 2-byte buffer.
 */
function shortToBytes(val) {
  const buf = Buffer.alloc(2);
  buf[0] = (val >> 8) & 0xff;
  buf[1] = val & 0xff;
  return buf;
}

/**
 * Trims leading zeroes from a byte buffer (useful for standard RLP integer encoding).
 * @param {Uint8Array|Buffer} buf - The buffer to trim.
 * @returns {Uint8Array|Buffer} The trimmed buffer.
 */
function trimLeadingZeroes(buf) {
  if (!buf || buf.length === 0) return new Uint8Array(0);
  let start = 0;
  while (start < buf.length - 1 && buf[start] === 0) {
    start++;
  }
  if (start === buf.length - 1 && buf[start] === 0) {
    return new Uint8Array(0);
  }
  return buf.subarray(start);
}

/**
 * Normalizes input value (hex string, number, bigint, Uint8Array) into a trimmed byte buffer.
 * @param {string|number|bigint|Uint8Array|Buffer|null|undefined} val - The input value.
 * @returns {Uint8Array|Buffer} The normalized byte array.
 */
function toBuffer(val) {
  if (val === undefined || val === null) {
    return new Uint8Array(0);
  }
  if (val instanceof Uint8Array || Buffer.isBuffer(val)) {
    return trimLeadingZeroes(val);
  }
  if (typeof val === 'string') {
    if (val.startsWith('-') || val.startsWith('0x-')) return new Uint8Array(0);
    let clean = val.startsWith('0x') ? val.slice(2) : val;
    if (clean.startsWith('-')) return new Uint8Array(0);
    if (clean.length % 2 !== 0) clean = '0' + clean;
    if (clean === '00' || clean === '') return new Uint8Array(0);
    return trimLeadingZeroes(Buffer.from(clean, 'hex'));
  }
  if (typeof val === 'number') {
    return trimLeadingZeroes(numberToBytes(val));
  }
  if (typeof val === 'bigint') {
    let hex = val.toString(16);
    if (hex.length % 2 !== 0) hex = '0' + hex;
    return trimLeadingZeroes(Buffer.from(hex, 'hex'));
  }
  return new Uint8Array(0);
}

/**
 * Encodes an item or nested array using Recursive Length Prefix (RLP) encoding for Ethereum transactions.
 * @param {Uint8Array|Buffer|Array|null|undefined} item - The item or array to encode.
 * @returns {Buffer|Uint8Array} RLP encoded buffer.
 */
function encodeRLP(item) {
  if (item === undefined || item === null) {
    return new Uint8Array([0x80]);
  }
  if (item instanceof Uint8Array || Buffer.isBuffer(item)) {
    if (item.length === 1 && item[0] < 0x80) {
      return item;
    }
    if (item.length < 56) {
      const header = Buffer.alloc(1);
      header[0] = 0x80 + item.length;
      return Buffer.concat([header, item]);
    }
    const lenBytes = numberToBytes(item.length);
    const header = Buffer.alloc(1 + lenBytes.length);
    header[0] = 0xb7 + lenBytes.length;
    header.set(lenBytes, 1);
    return Buffer.concat([header, item]);
  }
  if (Array.isArray(item)) {
    let payload = Buffer.alloc(0);
    for (const subItem of item) {
      payload = Buffer.concat([payload, encodeRLP(subItem)]);
    }
    if (payload.length < 56) {
      const header = Buffer.alloc(1);
      header[0] = 0xc0 + payload.length;
      return Buffer.concat([header, payload]);
    }
    const lenBytes = numberToBytes(payload.length);
    const header = Buffer.alloc(1 + lenBytes.length);
    header[0] = 0xf7 + lenBytes.length;
    header.set(lenBytes, 1);
    return Buffer.concat([header, payload]);
  }
  return new Uint8Array([0x80]);
}

/**
 * Generates a 65-byte ECDSA signature (r, s, recoveryId) for a given message hash using secp256k1.
 * @param {Uint8Array} hash - 32-byte message hash to sign.
 * @param {Uint8Array} seedBytes - 32-byte private key seed.
 * @param {boolean} [addV27=false] - Whether to add 27 to the recovery ID byte.
 * @returns {Uint8Array} 65-byte raw ECDSA signature buffer.
 */
function createClassicSignature(hash, seedBytes, addV27 = false) {
  const sigObj = secp256k1.sign(hash, seedBytes, { format: 'recovered', prehash: false });
  const classicSig = new Uint8Array(65);
  const recId = sigObj[0];
  classicSig.set(sigObj.subarray(1, 65), 0);
  classicSig[64] = addV27 ? recId + 27 : recId;
  return classicSig;
}

/**
 * Computes the raw signing preimage buffer for flexible PQC EIP-1559 transactions (type 0x42).
 * @param {object} tx - Transaction parameters object.
 * @param {Uint8Array} mldsaPubKeyBytes - ML-DSA-44 public key byte array.
 * @returns {Buffer} Raw EIP-1559 type 0x42 preimage buffer.
 */
function computeFlexibleEIP1559Preimage(tx, mldsaPubKeyBytes) {
  const dsaType = 0x0060;
  const accessList = (tx.accessList || []).map((item) => [
    toBuffer(item.address),
    (item.storageKeys || []).map((k) => toBuffer(k))
  ]);

  const rlpInput = [
    shortToBytes(dsaType),
    toBuffer(tx.chainId),
    toBuffer(tx.nonce),
    toBuffer(tx.maxPriorityFeePerGas || tx.gasPrice),
    toBuffer(tx.maxFeePerGas || tx.gasPrice),
    toBuffer(tx.gasLimit || tx.gas),
    toBuffer(tx.to),
    toBuffer(tx.value),
    toBuffer(tx.data),
    accessList,
    toBuffer(mldsaPubKeyBytes)
  ];

  return Buffer.concat([Buffer.from([0x42]), encodeRLP(rlpInput)]);
}

/**
 * Computes the raw signing preimage buffer for standard EIP-1559 transactions (type 0x02).
 * @param {object} tx - Transaction parameters object.
 * @returns {Buffer} Raw EIP-1559 type 0x02 preimage buffer.
 */
function computeStandardEIP1559Preimage(tx) {
  const accessList = (tx.accessList || []).map((item) => [
    toBuffer(item.address),
    (item.storageKeys || []).map((k) => toBuffer(k))
  ]);

  const rlpInput = [
    toBuffer(tx.chainId),
    toBuffer(tx.nonce),
    toBuffer(tx.maxPriorityFeePerGas || tx.gasPrice),
    toBuffer(tx.maxFeePerGas || tx.gasPrice),
    toBuffer(tx.gasLimit || tx.gas),
    toBuffer(tx.to),
    toBuffer(tx.value),
    toBuffer(tx.data),
    accessList
  ];

  return Buffer.concat([Buffer.from([0x02]), encodeRLP(rlpInput)]);
}

/**
 * Executes a JSON-RPC HTTP/HTTPS request to the Besu node endpoint.
 * @param {string} rpcUrl - RPC URL of the Besu node.
 * @param {string} method - JSON-RPC method name (e.g., 'eth_sendRawTransaction').
 * @param {Array} [params=[]] - Parameters array for the JSON-RPC call.
 * @returns {Promise<any>} The result payload from the RPC response.
 */
function rpcCall(rpcUrl, method, params = []) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params });
    const urlObj = new URL(rpcUrl);
    const lib = urlObj.protocol === 'https:' ? https : http;

    const req = lib.request(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message || JSON.stringify(json.error)));
          resolve(json.result);
        } catch (e) {
          reject(new Error("Invalid response from Besu RPC: " + data));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Polls the Besu RPC node until a transaction receipt is generated (block inclusion confirmation).
 * @param {string} rpcUrl - RPC URL of the Besu node.
 * @param {string} txHash - Hex transaction hash.
 * @param {number} [maxWaitMs=120000] - Maximum timeout in milliseconds to wait.
 * @param {number} [pollIntervalMs=500] - Polling frequency interval in milliseconds.
 * @returns {Promise<{ receipt: object, confirmTime: number }>} Receipt object and confirmation duration in ms.
 */
async function waitForReceipt(rpcUrl, txHash, maxWaitMs = 120000, pollIntervalMs = 500) {
  const start = performance.now();
  let lastLogSec = 0;

  while (performance.now() - start < maxWaitMs) {
    const elapsedSec = Math.floor((performance.now() - start) / 1000);
    if (elapsedSec > 0 && elapsedSec % 5 === 0 && elapsedSec !== lastLogSec) {
      lastLogSec = elapsedSec;
      try {
        const currentBlockHex = await rpcCall(rpcUrl, 'eth_blockNumber');
        const currentBlock = parseInt(currentBlockHex, 16);
        const txObj = await rpcCall(rpcUrl, 'eth_getTransactionByHash', [txHash]);
        const statusStr = txObj ? (txObj.blockNumber ? "Mined in Block #" + parseInt(txObj.blockNumber, 16) : "Pending in Mempool") : "Not Found in Mempool";
        console.log("   ⌛ Waiting... (" + elapsedSec + "s elapsed | Block #" + currentBlock + " | Tx Status: " + statusStr + ")");
      } catch (e) {
        console.log("   ⌛ Waiting for block mining on Besu... (" + elapsedSec + "s elapsed)");
      }
    }

    try {
      const receipt = await rpcCall(rpcUrl, 'eth_getTransactionReceipt', [txHash]);
      if (receipt && receipt.blockNumber) {
        const confirmTime = performance.now() - start;
        return { receipt, confirmTime };
      }
    } catch (e) {}
    await new Promise(res => setTimeout(res, pollIntervalMs));
  }
  throw new Error("Timeout (" + (maxWaitMs / 1000) + "s) waiting for inclusion in Besu block.");
}

/**
 * Automatically transfers funds (gas Ether) from the funded Hybrid PQC account to the standard ECDSA account if needed.
 * @param {string} rpcUrl - Besu node RPC endpoint URL.
 * @param {string} hybridAddress - Funded sender Hybrid account address.
 * @param {string} ecdsaAddress - Recipient standard ECDSA account address.
 * @param {Uint8Array} seedBytes - Private key seed bytes.
 * @param {object} mldsaPrivKeyObj - Imported ML-DSA-44 private key object.
 * @param {Uint8Array} mldsaPubKeyBytes - ML-DSA-44 public key byte array.
 * @param {string} chainIdHex - Chain ID hex string.
 */
async function ensureEcdsaFunding(rpcUrl, hybridAddress, ecdsaAddress, seedBytes, mldsaPrivKeyObj, mldsaPubKeyBytes, chainIdHex) {
  const balanceEcdsaHex = await rpcCall(rpcUrl, 'eth_getBalance', [ecdsaAddress, 'latest']);
  const balanceEcdsaWei = BigInt(balanceEcdsaHex || '0x0');
  const minRequiredWei = BigInt('5000000000000000'); // 0.005 Ether in Wei

  if (balanceEcdsaWei < minRequiredWei) {
    console.log("[AUTO-FUNDING] Funding ECDSA account " + ecdsaAddress + " with gas Ether...");

    const nonceAutoFundHex = await rpcCall(rpcUrl, 'eth_getTransactionCount', [hybridAddress, 'pending']);
    const nonceAutoFund = parseInt(nonceAutoFundHex || '0x0', 16);
    
    let gpAutoFundHex = await rpcCall(rpcUrl, 'eth_gasPrice');
    if (!gpAutoFundHex || gpAutoFundHex === '0x0' || gpAutoFundHex === '0x') {
      gpAutoFundHex = '0x3b9aca00'; // 1 Gwei in Hex
    }

    const dsaType = 0x0060;
    const fundValueHex = '0x' + minRequiredWei.toString(16);

    const txFund = {
      chainId: chainIdHex,
      nonce: '0x' + nonceAutoFund.toString(16),
      maxPriorityFeePerGas: gpAutoFundHex,
      maxFeePerGas: gpAutoFundHex,
      gasLimit: '0x0f4240',
      to: ecdsaAddress,
      value: fundValueHex,
      data: '0x',
      accessList: []
    };

    const preimage = computeFlexibleEIP1559Preimage(txFund, mldsaPubKeyBytes);
    const recoveryHash = keccak_256(preimage);

    const sigClassic = createClassicSignature(recoveryHash, seedBytes, false);
    const payloadForPqc = Buffer.concat([recoveryHash, sigClassic]);
    const pqcSigBuf = await mldsa.sign("ML-DSA-44", mldsaPrivKeyObj, payloadForPqc);
    const hybridSig = Buffer.concat([sigClassic, new Uint8Array(pqcSigBuf)]);

    const rlpFinalInput = [
      shortToBytes(dsaType),
      toBuffer(txFund.chainId),
      toBuffer(txFund.nonce),
      toBuffer(txFund.maxPriorityFeePerGas),
      toBuffer(txFund.maxFeePerGas),
      toBuffer(txFund.gasLimit),
      toBuffer(txFund.to),
      toBuffer(txFund.value),
      toBuffer(txFund.data),
      [],
      toBuffer(mldsaPubKeyBytes),
      hybridSig
    ];

    const rawTxBytes = Buffer.concat([Buffer.from([0x42]), encodeRLP(rlpFinalInput)]);
    const txHashAutoFund = await rpcCall(rpcUrl, 'eth_sendRawTransaction', ['0x' + rawTxBytes.toString('hex')]);
    console.log("Transfer sent (Nonce " + nonceAutoFund + ")! TxHash: " + txHashAutoFund);
    await waitForReceipt(rpcUrl, txHashAutoFund, 60000);
    console.log("ECDSA account successfully funded!\n");
  }
}

/**
 * Runs end-to-end benchmark for standard ECDSA (type 0x02) transactions on the Besu network.
 * @param {object} [config] - Benchmark configuration options (rpcUrl, senderSeedHex, receiverAddr, txCount, transferValueEth).
 * @returns {Promise<void>}
 */
async function runEcdsaBenchmark(config) {
  const {
    rpcUrl = process.env.BESU_RPC_URL || 'http://localhost:8545',
    senderSeedHex = '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20',
    receiverAddr = '0x124c77c547626044e2c9e25aed558a361d37e091',
    txCount = 5,
    transferValueEth = '0'
  } = config || {};

  console.log("==========================================================================");
  console.log(" BESU BENCHMARK - ECDSA PHASE (CONVENTIONAL TYPE 0x02)");
  console.log("==========================================================================");
  console.log("RPC Besu Node: " + rpcUrl);
  console.log("Recipient: " + receiverAddr);
  console.log("Value per Transaction: " + transferValueEth + " Ether / Drex");
  console.log("Transactions to Send (txCount): " + txCount + "\n");

  let cleanSeed = (senderSeedHex || '').trim();
  if (cleanSeed.startsWith('0x') || cleanSeed.startsWith('0X')) cleanSeed = cleanSeed.slice(2);
  if (cleanSeed.length !== 64) {
    console.error("ERROR: Provided seed has " + cleanSeed.length + " characters, but must be exactly 64 hexadecimal characters.");
    return;
  }

  const seedBytes = Buffer.from(cleanSeed, 'hex');

  const ecdsaPubKeyUncompressed = secp256k1.getPublicKey(seedBytes, false).subarray(1);
  const ecdsaAddress = '0x' + Buffer.from(keccak_256(ecdsaPubKeyUncompressed).slice(-20)).toString('hex');

  let mldsaPrivKeyObj = null;
  let mldsaPubKeyBytes = new Uint8Array(0);

  if (mldsa) {
    try {
      mldsaPrivKeyObj = await mldsa.importKey("raw-seed", seedBytes, "ML-DSA-44", false, ["sign"]);
      const mldsaPubKeyObj = await mldsa.getPublicKey(mldsaPrivKeyObj, ["verify"]);
      const mldsaPubKeyBuffer = await mldsa.exportKey("raw-public", mldsaPubKeyObj);
      mldsaPubKeyBytes = new Uint8Array(mldsaPubKeyBuffer);
    } catch (e) {}
  }

  const hybridPubKeyBytes = Buffer.concat([ecdsaPubKeyUncompressed, mldsaPubKeyBytes]);
  const hybridAddress = '0x' + Buffer.from(keccak_256(hybridPubKeyBytes).slice(-20)).toString('hex');

  let chainIdHex;
  try {
    chainIdHex = await rpcCall(rpcUrl, 'eth_chainId');
    const balanceEcdsaHex = await rpcCall(rpcUrl, 'eth_getBalance', [ecdsaAddress, 'latest']);
    const balanceEcdsaEth = (Number(BigInt(balanceEcdsaHex || '0x0')) / 1e18).toFixed(6);

    console.log("Chain ID Besu:       " + parseInt(chainIdHex, 16) + " (" + chainIdHex + ")");
    console.log("Classic ECDSA Account: " + ecdsaAddress + " | Balance: " + balanceEcdsaEth + " Ether\n");

    if (mldsaPrivKeyObj) {
      await ensureEcdsaFunding(rpcUrl, hybridAddress, ecdsaAddress, seedBytes, mldsaPrivKeyObj, mldsaPubKeyBytes, chainIdHex);
    }
  } catch (err) {
    console.error("RPC connection or Auto-Funding failure:", err.message);
    return;
  }

  const initialNonceHex = await rpcCall(rpcUrl, 'eth_getTransactionCount', [ecdsaAddress, 'pending']);
  let currentNonce = parseInt(initialNonceHex || '0x0', 16);
  let gasPriceHex = await rpcCall(rpcUrl, 'eth_gasPrice');
  if (!gasPriceHex || gasPriceHex === '0x0' || gasPriceHex === '0x') {
    gasPriceHex = '0x3b9aca00'; // 1 Gwei
  }

  const ecdsaResults = [];
  const valWeiHex = transferValueEth === '0' ? '0x0' : '0x' + BigInt(Math.floor(parseFloat(transferValueEth) * 1e18)).toString(16);

  console.log("Sending " + txCount + " ECDSA Transactions (0x02) sequentially...\n");

  for (let i = 0; i < txCount; i++) {
    const nonce = currentNonce + i;
    console.log(`[${i + 1}/${txCount}] Sending ECDSA Transaction (0x02) - Nonce ${nonce}...`);

    const tx = {
      chainId: chainIdHex,
      nonce: '0x' + nonce.toString(16),
      maxPriorityFeePerGas: gasPriceHex,
      maxFeePerGas: gasPriceHex,
      gasLimit: '0x5208',
      to: receiverAddr,
      value: valWeiHex,
      data: '0x',
      accessList: []
    };

    const tStartTotal = performance.now();
    const preimage = computeStandardEIP1559Preimage(tx);
    const signingHash = keccak_256(preimage);

    const t0Sign = performance.now();
    const sigClassic = createClassicSignature(signingHash, seedBytes, false);
    const tSignMs = performance.now() - t0Sign;

    const rlpFinalInput = [
      toBuffer(tx.chainId),
      toBuffer(tx.nonce),
      toBuffer(tx.maxPriorityFeePerGas),
      toBuffer(tx.maxFeePerGas),
      toBuffer(tx.gasLimit),
      toBuffer(tx.to),
      toBuffer(tx.value),
      toBuffer(tx.data),
      [],
      toBuffer(sigClassic[64]),
      toBuffer(sigClassic.subarray(0, 32)),
      toBuffer(sigClassic.subarray(32, 64))
    ];

    const rawTxBytes = Buffer.concat([Buffer.from([0x02]), encodeRLP(rlpFinalInput)]);
    const rawTxHex = '0x' + rawTxBytes.toString('hex');

    const tStartBroadcast = performance.now();
    let txHash;
    try {
      txHash = await rpcCall(rpcUrl, 'eth_sendRawTransaction', [rawTxHex]);
    } catch (e) {
      console.error("ECDSA (0x02) broadcast error [Nonce " + nonce + "]: " + e.message);
      continue;
    }
    const tBroadcastMs = performance.now() - tStartBroadcast;

    try {
      const { receipt, confirmTime: tMiningMs } = await waitForReceipt(rpcUrl, txHash, 120000);
      const tTotalE2EMs = performance.now() - tStartTotal;
      const blockNum = parseInt(receipt.blockNumber, 16);
      const gasUsed = parseInt(receipt.gasUsed, 16);

      console.log("Block #" + blockNum + " | Gas Used: " + gasUsed + " | TxHash: " + txHash.slice(0, 14) + "...");
      console.log("Sign: " + tSignMs.toFixed(2) + " ms | Broadcast: " + tBroadcastMs.toFixed(2) + " ms | Mining: " + tMiningMs.toFixed(2) + " ms | E2E: " + tTotalE2EMs.toFixed(2) + " ms\n");

      ecdsaResults.push({ nonce, txHash, blockNumber: blockNum, gasUsed, signMs: tSignMs, broadcastMs: tBroadcastMs, miningMs: tMiningMs, totalE2EMs: tTotalE2EMs, rawTxBytes: rawTxBytes.length });
    } catch (errWait) {
      console.warn("Timeout waiting for ECDSA 0x02 Tx mining:", errWait.message);
    }
  }

  const outputPath = path.join(__dirname, 'besu_ecdsa_results.json');
  fs.writeFileSync(outputPath, JSON.stringify({ rpcUrl, ecdsaAddress, count: txCount, transactions: ecdsaResults }, null, 2));

  console.log("==========================================================================");
  console.log("ECDSA PHASE COMPLETED SUCCESSFULLY!");
  console.log("Results saved to: " + outputPath);
  console.log("==========================================================================\n");
}

/**
 * Parses command-line positional arguments and flags for Besu benchmark scripts.
 * @returns {{ rpcUrl: string, senderSeedHex: string, receiverAddr: string, txCount: number, transferValueEth: string }}
 */
function parseBesuArgs() {
  const args = process.argv.slice(2);
  let rpcUrl = process.env.BESU_RPC_URL || 'http://localhost:8545';
  let senderSeedHex = '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20';
  let receiverAddr = '0x124c77c547626044e2c9e25aed558a361d37e091';
  let txCount = 5;
  let transferValueEth = '0';

  if (args[0] && !args[0].startsWith('--')) rpcUrl = args[0];
  if (args[1] && !args[1].startsWith('--')) senderSeedHex = args[1];
  if (args[2] && !args[2].startsWith('--')) receiverAddr = args[2];
  if (args[3] && !args[3].startsWith('--')) txCount = parseInt(args[3], 10);
  if (args[4] && !args[4].startsWith('--')) transferValueEth = args[4];

  for (const arg of args) {
    if (arg.startsWith('--txCount=') || arg.startsWith('--count=') || arg.startsWith('--tx=')) {
      txCount = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--rpc=')) {
      rpcUrl = arg.split('=')[1];
    } else if (arg.startsWith('--seed=')) {
      senderSeedHex = arg.split('=')[1];
    } else if (arg.startsWith('--to=')) {
      receiverAddr = arg.split('=')[1];
    } else if (arg.startsWith('--value=')) {
      transferValueEth = arg.split('=')[1];
    }
  }

  return { rpcUrl, senderSeedHex, receiverAddr, txCount, transferValueEth };
}

if (require.main === module) {
  const config = parseBesuArgs();
  runEcdsaBenchmark(config).catch(err => {
    console.error("Error in ECDSA benchmark:", err.message);
  });
}

module.exports = { runEcdsaBenchmark };
