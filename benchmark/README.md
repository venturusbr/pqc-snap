# Post-Quantum Cryptography (PQC) Benchmark Suite

This directory contains the complete performance benchmark suite evaluating classical **ECDSA (secp256k1)** versus the **Post-Quantum Hybrid Cryptographic Scheme (ECDSA + ML-DSA-44 WebAssembly)**.

The benchmarks measure latency, CPU consumption, RAM heap usage, transaction payload sizes, and block mining times across two main evaluation environments:
1. **Client-Side Isolated Micro-benchmarks** (Pure Node.js environment).
2. **End-to-End Besu Blockchain Network Benchmarks** (Live Hyperledger Besu EVM private network).

---

## Directory Structure & Overview

| File | Type | Description |
| :--- | :--- | :--- |
| `benchmark_client_ecdsa.js` | Micro-benchmark | Measures isolated execution time, CPU time, and RAM usage for classical ECDSA (KeyGen, Signing, Verification). |
| `benchmark_client_hybrid.js` | Micro-benchmark | Measures isolated execution time, CPU time, and RAM usage for PQC Hybrid (ECDSA + ML-DSA-44 WASM). |
| `benchmark_client_compare.js` | Data Processor | Unifies isolated client micro-benchmark time-series data and summary metrics into consolidated outputs. |
| `benchmark_besu_ecdsa.js` | Network Test | Broadcasts standard EIP-1559 (`0x02`) transactions to a Besu RPC node, measuring E2E latency and gas used. |
| `benchmark_besu_hybrid.js` | Network Test | Broadcasts Flexible PQC EIP-1559 (`0x42`) transactions to Besu node with auto-funding, measuring E2E latency and gas used. |
| `benchmark_besu_compare.js` | Data Processor | Consolidates Besu network results into comparison tables and dashboard dataset files. |
| `plot.py` | Visualization | Python script that generates publication-quality line charts (`.eps` format) comparing metrics and E2E latency. |

---

## Detailed Test Descriptions

### 1. Client-Side Isolated Micro-Benchmarks

These tests execute inside a clean, dedicated Node.js process using native `perf_hooks` and V8 Garbage Collection observers (`PerformanceObserver`).

* **`benchmark_client_ecdsa.js`**:
  * **KeyGen**: Generates secp256k1 public keys from private seed bytes.
  * **Signing**: Computes standard EIP-1559 transaction RLP hashes and generates 65-byte ECDSA signatures (`r`, `s`, `v`).
  * **Verification**: Recovers the public key from signature + hash using `recoverPublicKey` (simulating Ethereum `ecrecover`).
  * **Command-line flags**: `--iterations=<N>`, `--block-size=<N>`, `--filter-gc`.

* **`benchmark_client_hybrid.js`**:
  * **KeyGen**: Derives composite public keys combining secp256k1 (64B) and ML-DSA-44 WASM (1312B).
  * **Signing**: Signs EIP-1559 transaction preimages with both ECDSA and ML-DSA-44 WASM, generating dual signatures.
  * **Verification**: Verifies both the classic ECDSA recovery and the ML-DSA-44 post-quantum WASM signature.
  * **Command-line flags**: `--iterations=<N>`, `--block-size=<N>`, `--filter-gc`.

* **`benchmark_client_compare.js`**:
  * Merges `results_client_ecdsa.json` & `results_client_hybrid.json`.
  * Merges `timeseries_client_ecdsa.json` & `timeseries_client_hybrid.json`.
  * Produces `results_data.json` and `timeseries_data.json`.

---

### 2. Hyperledger Besu Network Benchmarks

These tests broadcast live transactions to an active Besu RPC endpoint to evaluate network impact and smart contract/EVM verification costs.

* **`benchmark_besu_ecdsa.js`**:
  * Submits $N$ sequential standard EIP-1559 (`0x02`) transactions to the Besu node via `eth_sendRawTransaction`.
  * Measures Client-Side Signing time, HTTP RPC Broadcast latency, Block Mining confirmation time, Gas Used, and total End-to-End (E2E) latency.
  * Saves results to `besu_ecdsa_results.json`.

* **`benchmark_besu_hybrid.js`**:
  * Submits $N$ sequential Flexible PQC EIP-1559 (`0x42`) transactions carrying ML-DSA-44 public keys and hybrid signatures.
  * Includes auto-funding logic to ensure sender accounts have sufficient gas balance before broadcasting.
  * Saves results to `besu_hybrid_results.json`.

* **`benchmark_besu_compare.js`**:
  * Reads `besu_ecdsa_results.json` and `besu_hybrid_results.json`.
  * Computes average latencies (Signing, RPC Broadcast, Mining, E2E) in seconds and milliseconds.
  * Generates `besu_latency_results.json` and `besu_data.js`.

---

## Plotting and Visualization (`plot.py`)

### Purpose
`plot.py` processes time-series micro-benchmark metrics (`timeseries_data.json`) and network transaction latency results (`besu_ecdsa_results.json` & `besu_hybrid_results.json`) using `pandas`, `matplotlib`, and `seaborn`.

It generates high-resolution vector graphs (`.eps` format) suited for scientific paper publications:
1. **`KeyGen: Execution Time.eps`**: Compares ECDSA vs. Hybrid key generation latency over time series.
2. **`KeyGen: RAM Usage.eps`**: Compares V8 heap RAM consumption during key generation.
3. **`Signing: Execution Time.eps`**: Compares signing latency per transaction iteration.
4. **`Signing: RAM Usage.eps`**: Compares V8 heap RAM consumption during signing.
5. **`Verification: Execution Time.eps`**: Compares signature verification times.
6. **`Verification: RAM Usage.eps`**: Compares memory footprint during verification.
7. **`e2e.eps`**: Displays end-to-end transaction latency trends on the Besu network for ECDSA vs. Hybrid PQC transactions.

---

## 🚀 How to Run

### Prerequisites

1. **Node.js & Cryptographic Dependencies**:
   ```bash
   cd benchmark
   npm install @noble/curves @noble/hashes mldsa-wasm
   ```

2. **Python Environment (for plotting)**:
   ```bash
   pip install pandas matplotlib seaborn
   ```

---

### Step 1: Run Client-Side Micro-Benchmarks

Run both isolated benchmarks with 10,000 iterations, a block size of 20, and strict GC filtering:

```bash
# 1. Run ECDSA Micro-Benchmark
node --expose-gc --max-old-space-size=4096 benchmark_client_ecdsa.js --iterations=10000 --block-size=20 --filter-gc

# 2. Run Hybrid PQC Micro-Benchmark
node --expose-gc --max-old-space-size=4096 benchmark_client_hybrid.js --iterations=10000 --block-size=20 --filter-gc

# 3. Consolidate Micro-Benchmark Data
node benchmark_client_compare.js
```

---

### Step 2: Run Besu Network Benchmarks

Make sure your Besu private node is running (e.g., at `http://localhost:8545`).

```bash
# 1. Run Besu ECDSA (0x02) Benchmark (50 transactions)
node benchmark_besu_ecdsa.js --rpc=http://localhost:8545 --txCount=50

# 2. Run Besu Hybrid PQC (0x42) Benchmark (50 transactions)
node benchmark_besu_hybrid.js --rpc=http://localhost:8545 --txCount=50

# 3. Consolidate Besu Network Results
node benchmark_besu_compare.js
```

---

### Step 3: Generate Plots (`plot.py`)

Execute `plot.py` to generate `.eps` chart files:

```bash
python plot.py
```
