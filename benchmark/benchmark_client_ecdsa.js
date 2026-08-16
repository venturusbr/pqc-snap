/**
 * ============================================================================
 * ISOLATED CLIENT-SIDE BENCHMARK: ECDSA (0x02)
 * ============================================================================
 * 
 * DESCRIPTION:
 * Executes performance measurements for the classical ECDSA algorithm (secp256k1 curve).
 * 
 * SUPPORTED COMMAND-LINE PARAMETERS:
 * --iterations=<N>   : Total number of iterations (e.g. --iterations=10000) [Default: 10000]
 * --block-size=<N>   : Grouping block size (e.g. --block-size=10 for blocks of 10) [Default: 10]
 * --filter-gc        : Enables strict V8 Garbage Collection filter via PerformanceObserver
 * 
 * USAGE EXAMPLE:
 * node --expose-gc --max-old-space-size=4096 benchmark_client_ecdsa.js --iterations=10000 --block-size=10 --filter-gc
 */

const { performance, PerformanceObserver } = require('perf_hooks');
const path = require('path');
const fs = require('fs');

/**
 * Utility function to parse command-line arguments.
 * @returns {{ iterations: number, blockSize: number, sampleRate: number, targetPoints: number, filterGc: boolean }}
 */
function parseCliArgs() {
  const args = process.argv.slice(2);
  let iterations = 10000;
  let blockSize = 10;
  let filterGc = false;

  for (const arg of args) {
    if (arg.startsWith('--iterations=') || arg.startsWith('--iter=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (!isNaN(val) && val > 0) iterations = val;
    } else if (arg.startsWith('--block-size=') || arg.startsWith('--group-by=') || arg.startsWith('--step=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (!isNaN(val) && val > 0) blockSize = val;
    } else if (arg === '--filter-gc') {
      filterGc = true;
    }
  }

  const sampleRate = Math.max(1, blockSize);
  const targetPoints = Math.ceil(iterations / sampleRate);

  return { iterations, blockSize: sampleRate, sampleRate, targetPoints, filterGc };
}

const { iterations: CLI_ITERATIONS, sampleRate: CLI_SAMPLE_RATE, targetPoints: CLI_TARGET_POINTS, filterGc: CLI_FILTER_GC } = parseCliArgs();

// Native V8 Garbage Collector event observer (perf_hooks)
let gcEventOccurredInIteration = false;
let gcObserver = null;

if (CLI_FILTER_GC) {
  try {
    gcObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length > 0) {
        gcEventOccurredInIteration = true;
      }
    });
    gcObserver.observe({ entryTypes: ['gc'] });
  } catch (e) {
    console.warn("⚠️ Warning: Could not register PerformanceObserver for 'gc'.");
  }
}

// Support for node_modules paths (Standalone or Monorepo)
const currentDirNodeModules = path.resolve(__dirname, 'node_modules');
const projectRootNodeModules = path.resolve(__dirname, '../node_modules');
const snapNodeModules = path.resolve(__dirname, '../packages/snap/node_modules');
module.paths.push(currentDirNodeModules, projectRootNodeModules, snapNodeModules);

/**
 * Loads cryptographic libraries (@noble/curves and @noble/hashes) across environments.
 * @returns {{ secp256k1: object, keccak_256: function }}
 */
function loadCryptoLibs() {
  let secp256k1Module, keccakModule;

  const secpPaths = [
    '@noble/curves/secp256k1',
    '@noble/curves/secp256k1.js',
    path.join(currentDirNodeModules, '@noble/curves/secp256k1.js'),
    path.join(projectRootNodeModules, '@noble/curves/secp256k1.js'),
    path.join(snapNodeModules, '@noble/curves/secp256k1.js')
  ];

  for (const p of secpPaths) {
    try {
      secp256k1Module = require(p);
      if (secp256k1Module) break;
    } catch (e) {}
  }

  const keccakPaths = [
    '@noble/hashes/sha3',
    '@noble/hashes/sha3.js',
    path.join(currentDirNodeModules, '@noble/hashes/sha3.js'),
    path.join(projectRootNodeModules, '@noble/hashes/sha3.js'),
    path.join(snapNodeModules, '@noble/hashes/sha3.js')
  ];

  for (const p of keccakPaths) {
    try {
      keccakModule = require(p);
      if (keccakModule) break;
    } catch (e) {}
  }

  if (!secp256k1Module || !keccakModule) {
    throw new Error("❌ Could not load @noble/curves or @noble/hashes libraries. Run 'npm install @noble/curves @noble/hashes' in the directory.");
  }

  return {
    secp256k1: secp256k1Module.secp256k1 || secp256k1Module,
    keccak_256: keccakModule.keccak_256 || keccakModule
  };
}

const { secp256k1, keccak_256 } = loadCryptoLibs();

/**
 * Converts a non-negative number to a Uint8Array byte buffer (big-endian encoding).
 * @param {number} num - The number to convert.
 * @returns {Uint8Array|Buffer} The resulting byte array.
 */
function numberToBytes(num) {
  if (num === 0) return new Uint8Array(0);
  const hexStr = num.toString(16);
  const padded = hexStr.length % 2 === 0 ? hexStr : '0' + hexStr;
  return Buffer.from(padded, 'hex');
}

/**
 * Normalizes input value (hex string, number, bigint, Uint8Array) into a Buffer/Uint8Array.
 * @param {string|number|bigint|Uint8Array|Buffer|null|undefined} val - The input value.
 * @returns {Uint8Array|Buffer} The normalized byte array.
 */
function toBuffer(val) {
  if (val === undefined || val === null) return new Uint8Array(0);
  if (val instanceof Uint8Array || Buffer.isBuffer(val)) return val;
  if (typeof val === 'string') {
    let clean = val.startsWith('0x') ? val.slice(2) : val;
    if (clean.length % 2 !== 0) clean = '0' + clean;
    if (clean === '00' || clean === '') return new Uint8Array(0);
    return Buffer.from(clean, 'hex');
  }
  if (typeof val === 'number' || typeof val === 'bigint') {
    let hex = val.toString(16);
    if (hex.length % 2 !== 0) hex = '0' + hex;
    if (hex === '00') return new Uint8Array(0);
    return Buffer.from(hex, 'hex');
  }
  return new Uint8Array(0);
}

/**
 * Encodes an item or array of items using Recursive Length Prefix (RLP) encoding for Ethereum transactions.
 * @param {Uint8Array|Buffer|Array} item - The item or array to encode.
 * @returns {Buffer} RLP encoded buffer.
 */
function encodeRLP(item) {
  if (item instanceof Uint8Array || Buffer.isBuffer(item)) {
    if (item.length === 1 && item[0] < 0x80) return item;
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
    let pay = Buffer.alloc(0);
    for (const subItem of item) pay = Buffer.concat([pay, encodeRLP(subItem)]);
    if (pay.length < 56) {
      const header = Buffer.alloc(1);
      header[0] = 0xc0 + pay.length;
      return Buffer.concat([header, pay]);
    }
    const lenBytes = numberToBytes(pay.length);
    const header = Buffer.alloc(1 + lenBytes.length);
    header[0] = 0xf7 + lenBytes.length;
    header.set(lenBytes, 1);
    return Buffer.concat([header, pay]);
  }
}

/**
 * Triggers V8 Garbage Collection if `--expose-gc` flag is enabled.
 */
function forceGC() {
  if (global.gc) global.gc();
}

/**
 * Returns the currently used V8 heap memory in kilobytes (KB).
 * @returns {number} Heap memory used in KB.
 */
function getHeapMemoryKB() {
  return parseFloat((process.memoryUsage().heapUsed / 1024).toFixed(2));
}

/**
 * Calculates CPU user + system time consumed in milliseconds since startCpu.
 * @param {object} startCpu - Object returned by process.cpuUsage().
 * @returns {number} CPU time consumed in milliseconds.
 */
function getCpuTimeMs(startCpu) {
  const diff = process.cpuUsage(startCpu);
  return parseFloat(((diff.user + diff.system) / 1000).toFixed(4));
}

/**
 * Calculates the arithmetic mean of values in a TypedArray within a specified index range.
 * @param {Float64Array|TypedArray} typedArray - Array containing numeric samples.
 * @param {number} startIndex - Inclusive start index.
 * @param {number} endIndex - Exclusive end index.
 * @returns {number} Mean value rounded to 4 decimal places.
 */
function calculateMean(typedArray, startIndex, endIndex) {
  let sum = 0;
  const count = endIndex - startIndex;
  for (let k = startIndex; k < endIndex; k++) sum += typedArray[k];
  return parseFloat((sum / count).toFixed(4));
}

/**
 * Computes descriptive statistics (mean, p50, p95, min, max, stdDev) for execution or CPU time metrics.
 * @param {Float64Array|Array} typedArr - Array of numeric measurements in milliseconds.
 * @returns {object} Calculated statistical summary.
 */
function calculateStats(typedArr) {
  if (!typedArr || typedArr.length === 0) return {};
  const sorted = Array.from(typedArr).sort((a, b) => a - b);
  const len = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / len;
  const min = sorted[0];
  const max = sorted[len - 1];
  const p50 = sorted[Math.floor(len * 0.5)];
  const p95 = sorted[Math.floor(len * 0.95)];
  const variance = sorted.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / len;
  const stdDev = Math.sqrt(variance);

  return {
    meanMs: mean.toFixed(4),
    p50Ms: p50.toFixed(4),
    p95Ms: p95.toFixed(4),
    minMs: min.toFixed(4),
    maxMs: max.toFixed(4),
    stdDevMs: stdDev.toFixed(4)
  };
}

/**
 * Computes descriptive statistics (mean, p50, p95, min, max, stdDev) for heap memory usage metrics (in KB).
 * @param {Float64Array|Array} typedArr - Array of RAM usage measurements in KB.
 * @returns {object} Calculated statistical summary.
 */
function calculateRamStats(typedArr) {
  if (!typedArr || typedArr.length === 0) return {};
  const sorted = Array.from(typedArr).sort((a, b) => a - b);
  const len = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / len;
  const min = sorted[0];
  const max = sorted[len - 1];
  const p50 = sorted[Math.floor(len * 0.5)];
  const p95 = sorted[Math.floor(len * 0.95)];
  const variance = sorted.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / len;
  const stdDev = Math.sqrt(variance);

  return {
    meanKb: mean.toFixed(2),
    p50Kb: p50.toFixed(2),
    p95Kb: p95.toFixed(2),
    minKb: min.toFixed(2),
    maxKb: max.toFixed(2),
    stdDevKb: stdDev.toFixed(2)
  };
}

/**
 * Runs a warm-up phase to trigger V8 JIT compilation and optimize execution hot paths for ECDSA operations.
 * @param {Uint8Array} seedBytes - 32-byte private key seed.
 * @param {Uint8Array} eip1559SigningHash - Pre-computed hash of an EIP-1559 transaction.
 * @param {number} [iterations=300] - Number of warm-up iterations.
 */
async function warmup(seedBytes, eip1559SigningHash, iterations = 300) {
  console.log(`Running V8 ECDSA warm-up (${iterations} iterations ignored)...`);
  forceGC();
  for (let i = 0; i < iterations; i++) {
    const ecdsaPk = secp256k1.getPublicKey(seedBytes, false).subarray(1);
    const ecdsaSig = secp256k1.sign(eip1559SigningHash, seedBytes, { format: 'recovered', prehash: false });
    secp256k1.recoverPublicKey(ecdsaSig, eip1559SigningHash);
  }
  forceGC();
  console.log("ECDSA warm-up completed and memory successfully purged!\n");
}

/**
 * Executes full client-side isolated benchmarks for standard ECDSA (secp256k1) across KeyGen, Signing, and Verification.
 * @param {number} [iterations=CLI_ITERATIONS] - Total number of iterations to execute.
 * @param {number} [sampleRate=CLI_SAMPLE_RATE] - Sampling rate / block size for aggregating metrics.
 * @returns {Promise<{ results: object, timeSeriesEcdsa: Array }>} The benchmark metrics and time-series data.
 */
async function runEcdsaBenchmarks(iterations = CLI_ITERATIONS, sampleRate = CLI_SAMPLE_RATE) {
  console.log("==========================================================================");
  console.log(` ISOLATED CLIENT-SIDE BENCHMARK: STANDARD ECDSA - ${iterations} ITERATIONS`);
  console.log(` GROUPING BLOCK SIZE: Every ${sampleRate} (${Math.ceil(iterations / sampleRate)} points)`);
  console.log(` GARBAGE COLLECTOR STATUS: ${global.gc ? 'ENABLED (--expose-gc)' : 'DEFAULT'}`);
  console.log(` ACTIVE GC FILTER: ${CLI_FILTER_GC ? 'YES (--filter-gc)' : 'NO'}`);
  console.log("==========================================================================");

  const seedBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) seedBytes[i] = i + 1;

  const txEip1559 = {
    chainId: 0x16bfadfa,
    nonce: 0,
    maxPriorityFeePerGas: '0x77359400',
    maxFeePerGas: '0x2540be400',
    gasLimit: '0x5208',
    to: '0x124c77c547626044e2c9e25aed558a361d37e091',
    value: '0x0',
    data: '0x',
    accessList: []
  };

  const eip1559PreimageRlp = encodeRLP([
    toBuffer(txEip1559.chainId),
    toBuffer(txEip1559.nonce),
    toBuffer(txEip1559.maxPriorityFeePerGas),
    toBuffer(txEip1559.maxFeePerGas),
    toBuffer(txEip1559.gasLimit),
    toBuffer(txEip1559.to),
    toBuffer(txEip1559.value),
    toBuffer(txEip1559.data),
    txEip1559.accessList
  ]);
  const eip1559SigningHash = keccak_256(Buffer.concat([Buffer.from([0x02]), eip1559PreimageRlp]));

  await warmup(seedBytes, eip1559SigningHash, 300);

  const ecdsaPrivKey = seedBytes;
  const ecdsaPubKeyFull = secp256k1.getPublicKey(ecdsaPrivKey, false);
  const ecdsaPubKeyUncompressed = ecdsaPubKeyFull.subarray(1);

  const timeSeriesEcdsa = [];

  const keyGenTimes = new Float64Array(iterations);
  const keyGenCpuTimes = new Float64Array(iterations);
  const keyGenRamKb = new Float64Array(iterations);

  const signTimes = new Float64Array(iterations);
  const signCpuTimes = new Float64Array(iterations);
  const signRamKb = new Float64Array(iterations);

  const verifyTimes = new Float64Array(iterations);
  const verifyCpuTimes = new Float64Array(iterations);
  const verifyRamKb = new Float64Array(iterations);

  // --------------------------------------------------------------------------
  // TEST 1: KEY GEN ECDSA
  // --------------------------------------------------------------------------
  console.log(`[1/3] Executing KeyGen ECDSA (${iterations}x)...`);
  forceGC();
  let i = 0;
  let discardedKeyGenGc = 0;
  const keyGenBlockStart = performance.now();

  while (i < iterations) {
    gcEventOccurredInIteration = false;

    const cpu0 = process.cpuUsage();
    const t0 = performance.now();
    secp256k1.getPublicKey(seedBytes, false).subarray(1);
    const dt = performance.now() - t0;
    const cpu = getCpuTimeMs(cpu0);
    const ram = getHeapMemoryKB();

    if (CLI_FILTER_GC && gcEventOccurredInIteration) {
      discardedKeyGenGc++;
      continue;
    }

    keyGenTimes[i] = dt;
    keyGenCpuTimes[i] = cpu;
    keyGenRamKb[i] = ram;

    if ((i + 1) % sampleRate === 0) {
      const startIdx = i + 1 - sampleRate;
      const endIdx = i + 1;
      timeSeriesEcdsa.push({
        iteration: i + 1,
        keyGenEcdsaMs: calculateMean(keyGenTimes, startIdx, endIdx),
        keyGenEcdsaCpuMs: calculateMean(keyGenCpuTimes, startIdx, endIdx),
        keyGenEcdsaRamKb: calculateMean(keyGenRamKb, startIdx, endIdx)
      });
    }
    i++;
  }
  const keyGenTotalMs = parseFloat((performance.now() - keyGenBlockStart).toFixed(2));
  console.log(`   Total Accumulated Time in KeyGen ECDSA (${iterations}x): ${keyGenTotalMs} ms (${(keyGenTotalMs / 1000).toFixed(3)} sec)`);
  if (CLI_FILTER_GC) console.log(`   KeyGen ECDSA: ${discardedKeyGenGc} iterations discarded due to GC events.`);

  // --------------------------------------------------------------------------
  // TEST 2: SIGNING ECDSA
  // --------------------------------------------------------------------------
  console.log(`[2/3] Executing Signing ECDSA (${iterations}x)...`);
  forceGC();
  i = 0;
  let discardedSignGc = 0;
  const signBlockStart = performance.now();

  while (i < iterations) {
    gcEventOccurredInIteration = false;

    const cpu0 = process.cpuUsage();
    const t0 = performance.now();
    secp256k1.sign(eip1559SigningHash, ecdsaPrivKey, { format: 'recovered', prehash: false });
    const dt = performance.now() - t0;
    const cpu = getCpuTimeMs(cpu0);
    const ram = getHeapMemoryKB();

    if (CLI_FILTER_GC && gcEventOccurredInIteration) {
      discardedSignGc++;
      continue;
    }

    signTimes[i] = dt;
    signCpuTimes[i] = cpu;
    signRamKb[i] = ram;

    if ((i + 1) % sampleRate === 0) {
      const sampleIndex = Math.floor(i / sampleRate);
      const startIdx = i + 1 - sampleRate;
      const endIdx = i + 1;
      if (timeSeriesEcdsa[sampleIndex]) {
        timeSeriesEcdsa[sampleIndex].signEcdsaMs = calculateMean(signTimes, startIdx, endIdx);
        timeSeriesEcdsa[sampleIndex].signEcdsaCpuMs = calculateMean(signCpuTimes, startIdx, endIdx);
        timeSeriesEcdsa[sampleIndex].signEcdsaRamKb = calculateMean(signRamKb, startIdx, endIdx);
      }
    }
    i++;
  }
  const signTotalMs = parseFloat((performance.now() - signBlockStart).toFixed(2));
  console.log(`   Total Accumulated Time in Signing ECDSA (${iterations}x): ${signTotalMs} ms (${(signTotalMs / 1000).toFixed(3)} sec)`);
  if (CLI_FILTER_GC) console.log(`   Signing ECDSA: ${discardedSignGc} iterations discarded due to GC events.`);

  // --------------------------------------------------------------------------
  // TEST 3: VERIFY ECDSA
  // --------------------------------------------------------------------------
  console.log(`[3/3] Executing Verification ECDSA (${iterations}x)...`);
  forceGC();
  const ecdsaSigObj = secp256k1.sign(eip1559SigningHash, ecdsaPrivKey, { format: 'recovered', prehash: false });
  i = 0;
  let discardedVerifyGc = 0;
  const verifyBlockStart = performance.now();

  while (i < iterations) {
    gcEventOccurredInIteration = false;

    const cpu0 = process.cpuUsage();
    const t0 = performance.now();
    secp256k1.recoverPublicKey(ecdsaSigObj, eip1559SigningHash);
    const dt = performance.now() - t0;
    const cpu = getCpuTimeMs(cpu0);
    const ram = getHeapMemoryKB();

    if (CLI_FILTER_GC && gcEventOccurredInIteration) {
      discardedVerifyGc++;
      continue;
    }

    verifyTimes[i] = dt;
    verifyCpuTimes[i] = cpu;
    verifyRamKb[i] = ram;

    if ((i + 1) % sampleRate === 0) {
      const sampleIndex = Math.floor(i / sampleRate);
      const startIdx = i + 1 - sampleRate;
      const endIdx = i + 1;
      if (timeSeriesEcdsa[sampleIndex]) {
        timeSeriesEcdsa[sampleIndex].verifyEcdsaMs = calculateMean(verifyTimes, startIdx, endIdx);
        timeSeriesEcdsa[sampleIndex].verifyEcdsaCpuMs = calculateMean(verifyCpuTimes, startIdx, endIdx);
        timeSeriesEcdsa[sampleIndex].verifyEcdsaRamKb = calculateMean(verifyRamKb, startIdx, endIdx);
      }
    }
    i++;
  }
  const verifyTotalMs = parseFloat((performance.now() - verifyBlockStart).toFixed(2));
  console.log(`   Total Accumulated Time in Verification ECDSA (${iterations}x): ${verifyTotalMs} ms (${(verifyTotalMs / 1000).toFixed(3)} sec)`);
  if (CLI_FILTER_GC) console.log(`   Verification ECDSA: ${discardedVerifyGc} iterations discarded due to GC events.`);

  const grandTotalMs = parseFloat((keyGenTotalMs + signTotalMs + verifyTotalMs).toFixed(2));

  const results = {
    metadata: {
      iterations,
      timestamp: new Date().toISOString(),
      type: 'ecdsa',
      sampleRate,
      targetPoints: Math.ceil(iterations / sampleRate),
      filterGcActive: CLI_FILTER_GC,
      gcDiscarded: { keyGen: discardedKeyGenGc, signing: discardedSignGc, verification: discardedVerifyGc }
    },
    payloadSizes: {
      ecdsaPubKeyBytes: ecdsaPubKeyUncompressed.length,
      ecdsaSigBytes: 65,
      ecdsaEip1559TxBytes: eip1559PreimageRlp.length + 65 + 1
    },
    totalDurations: {
      keyGenTotalMs: keyGenTotalMs,
      keyGenTotalSec: parseFloat((keyGenTotalMs / 1000).toFixed(3)),
      signingTotalMs: signTotalMs,
      signingTotalSec: parseFloat((signTotalMs / 1000).toFixed(3)),
      verificationTotalMs: verifyTotalMs,
      verificationTotalSec: parseFloat((verifyTotalMs / 1000).toFixed(3)),
      grandTotalMs: grandTotalMs,
      grandTotalSec: parseFloat((grandTotalMs / 1000).toFixed(3))
    },
    metrics: {
      keyGen: calculateStats(keyGenTimes),
      signing: calculateStats(signTimes),
      verification: calculateStats(verifyTimes)
    },
    cpuMetrics: {
      keyGen: calculateStats(keyGenCpuTimes),
      signing: calculateStats(signCpuTimes),
      verification: calculateStats(verifyCpuTimes)
    },
    ramMetrics: {
      keyGen: calculateRamStats(keyGenRamKb),
      signing: calculateRamStats(signRamKb),
      verification: calculateRamStats(verifyRamKb)
    }
  };

  const jsonSummaryPath = path.join(__dirname, 'results_client_ecdsa.json');
  const jsonTimeSeriesPath = path.join(__dirname, 'timeseries_client_ecdsa.json');

  fs.writeFileSync(jsonSummaryPath, JSON.stringify(results, null, 2));
  fs.writeFileSync(jsonTimeSeriesPath, JSON.stringify(timeSeriesEcdsa, null, 2));

  console.log("\n==========================================================================");
  console.log(` SUMMARY OF TOTAL ACCUMULATED TIMES IN ECDSA (${iterations} ITERATIONS)`);
  console.log("==========================================================================");
  console.table({
    [`${iterations} KeyGen ECDSA`]: { "Total (ms)": keyGenTotalMs, "Total (Seconds)": (keyGenTotalMs / 1000).toFixed(3) },
    [`${iterations} Signing ECDSA`]: { "Total (ms)": signTotalMs, "Total (Seconds)": (signTotalMs / 1000).toFixed(3) },
    [`${iterations} Verification ECDSA`]: { "Total (ms)": verifyTotalMs, "Total (Seconds)": (verifyTotalMs / 1000).toFixed(3) },
    [`${iterations * 3} TOTAL Operations`]: { "Total (ms)": grandTotalMs, "Total (Seconds)": (grandTotalMs / 1000).toFixed(3) }
  });

  console.log(`\n ECDSA results saved successfully to:`);
  console.log(` - Summary: ${jsonSummaryPath}`);
  console.log(` - TimeSeries (${Math.ceil(iterations / sampleRate)} points, every ${sampleRate}): ${jsonTimeSeriesPath}\n`);

  return { results, timeSeriesEcdsa };
}

if (require.main === module) {
  runEcdsaBenchmarks(CLI_ITERATIONS, CLI_SAMPLE_RATE).catch(err => console.error("Error in ECDSA benchmark:", err));
}

module.exports = { runEcdsaBenchmarks };