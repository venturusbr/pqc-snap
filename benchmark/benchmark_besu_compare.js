/**
 * ============================================================================
 * BESU BENCHMARK - RESULTS COMPARISON (IN SECONDS)
 * ============================================================================
 * 
 * Reads `besu_ecdsa_results.json` and `besu_hybrid_results.json`.
 * Consolidates metrics in seconds (s) and milliseconds (ms), prints the comparative
 * table to the console, and updates `besu_latency_results.json` and `besu_data.js`.
 */

const path = require('path');
const fs = require('fs');

/**
 * Reads Besu benchmark output JSON files (ECDSA & Hybrid PQC), calculates latency averages in seconds and milliseconds, and outputs comparative JSON/JS dashboard data.
 */
function runComparison() {
  const ecdsaPath = path.join(__dirname, 'besu_ecdsa_results.json');
  const hybridPath = path.join(__dirname, 'besu_hybrid_results.json');

  if (!fs.existsSync(ecdsaPath)) {
    console.error("File " + ecdsaPath + " not found.");
    console.error("Run first: node benchmark_besu_ecdsa.js");
    return;
  }

  if (!fs.existsSync(hybridPath)) {
    console.error("File " + hybridPath + " not found.");
    console.error("Run first: node benchmark_besu_hybrid.js");
    return;
  }

  const ecdsaData = JSON.parse(fs.readFileSync(ecdsaPath, 'utf8'));
  const hybridData = JSON.parse(fs.readFileSync(hybridPath, 'utf8'));

  const ecdsaTxs = ecdsaData.transactions || [];
  const hybridTxs = hybridData.transactions || [];

  const avgMs = (arr, key) => arr.length ? (arr.reduce((a, b) => a + (b[key] || 0), 0) / arr.length).toFixed(2) : 'N/A';
  const avgSec = (arr, key) => arr.length ? ((arr.reduce((a, b) => a + (b[key] || 0), 0) / arr.length) / 1000).toFixed(3) : 'N/A';

  const summary = {
    ecdsa: {
      txType: '0x02 (Conventional EIP-1559)',
      payloadSizeBytes: ecdsaTxs[0] ? ecdsaTxs[0].rawTxBytes : 'N/A',
      avgSignMs: avgMs(ecdsaTxs, 'signMs'),
      avgSignSec: avgSec(ecdsaTxs, 'signMs'),
      avgBroadcastMs: avgMs(ecdsaTxs, 'broadcastMs'),
      avgBroadcastSec: avgSec(ecdsaTxs, 'broadcastMs'),
      avgMiningMs: avgMs(ecdsaTxs, 'miningMs'),
      avgMiningSec: avgSec(ecdsaTxs, 'miningMs'),
      avgE2EMs: avgMs(ecdsaTxs, 'totalE2EMs'),
      avgE2ESec: avgSec(ecdsaTxs, 'totalE2EMs'),
      avgGasUsed: avgMs(ecdsaTxs, 'gasUsed')
    },
    hybridPqc: {
      txType: '0x42 (Flexible EIP-1559 PQC)',
      payloadSizeBytes: hybridTxs[0] ? hybridTxs[0].rawTxBytes : 'N/A',
      avgSignMs: avgMs(hybridTxs, 'signMs'),
      avgSignSec: avgSec(hybridTxs, 'signMs'),
      avgBroadcastMs: avgMs(hybridTxs, 'broadcastMs'),
      avgBroadcastSec: avgSec(hybridTxs, 'broadcastMs'),
      avgMiningMs: avgMs(hybridTxs, 'miningMs'),
      avgMiningSec: avgSec(hybridTxs, 'miningMs'),
      avgE2EMs: avgMs(hybridTxs, 'totalE2EMs'),
      avgE2ESec: avgSec(hybridTxs, 'totalE2EMs'),
      avgGasUsed: avgMs(hybridTxs, 'gasUsed')
    }
  };

  console.log("==========================================================================");
  console.log(" FINAL COMPARATIVE TABLE ON BESU NETWORK (RESULTS IN SECONDS)");
  console.log("==========================================================================");
  console.table({
    "Tx Payload Size (Bytes)":  { ECDSA_0x02: summary.ecdsa.payloadSizeBytes, HybridPQC_0x42: summary.hybridPqc.payloadSizeBytes },
    "Client-Side Signature (s)": { ECDSA_0x02: summary.ecdsa.avgSignSec + " s", HybridPQC_0x42: summary.hybridPqc.avgSignSec + " s" },
    "HTTP RPC Broadcast (s)":    { ECDSA_0x02: summary.ecdsa.avgBroadcastSec + " s", HybridPQC_0x42: summary.hybridPqc.avgBroadcastSec + " s" },
    "Block Mining (s)":          { ECDSA_0x02: summary.ecdsa.avgMiningSec + " s", HybridPQC_0x42: summary.hybridPqc.avgMiningSec + " s" },
    "Total E2E Latency (s)":     { ECDSA_0x02: summary.ecdsa.avgE2ESec + " s", HybridPQC_0x42: summary.hybridPqc.avgE2ESec + " s" },
    "On-Chain Gas Used":        { ECDSA_0x02: summary.ecdsa.avgGasUsed, HybridPQC_0x42: summary.hybridPqc.avgGasUsed }
  });

  const outputPath = path.join(__dirname, 'besu_latency_results.json');
  const jsOutputPath = path.join(__dirname, 'besu_data.js');

  const outputPayload = {
    rpcUrl: ecdsaData.rpcUrl || hybridData.rpcUrl,
    ecdsaAddress: ecdsaData.ecdsaAddress,
    hybridAddress: hybridData.hybridAddress,
    summary,
    ecdsaTransactions: ecdsaTxs,
    hybridTransactions: hybridTxs
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputPayload, null, 2));
  fs.writeFileSync(jsOutputPath, "window.BESU_LATENCY = " + JSON.stringify(outputPayload, null, 2) + ";\n");

  console.log("\nConsolidated results successfully saved to:");
  console.log("JSON: " + outputPath);
  console.log("JS for Dashboard (graficos.html): " + jsOutputPath);
  console.log("========================================================================\n");
}

if (require.main === module) {
  runComparison();
}

module.exports = { runComparison };
