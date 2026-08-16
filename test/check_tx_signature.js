const { secp256k1 } = require('./node_modules/@noble/curves/secp256k1.js');
const { keccak_256 } = require('./node_modules/@noble/hashes/sha3.js');

const bytesToHex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
const hexToBytes = (hex) => {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

// Dados exibidos na depuração do Snap
const userSeedHex = "7c7af820587203e32f7d2e4bb3138872ad5dc763f6bac6bb545137723e9b8d06";
const txSigningHashHex = "af33295ec10eddf34b3cb50a87eb32afa652a078f9f64b27abaa35cc7b65b4b3";

const seedBytes = hexToBytes(userSeedHex);
const hashBytes = hexToBytes(txSigningHashHex);

console.log("=== COMPARANDO ASSINATURAS SECP256K1 ===");
console.log("Seed Hex:", userSeedHex);
console.log("Hash da Transação (signingHash):", txSigningHashHex);

// Derivar chave pública da seed para conferir
const derivedPub = secp256k1.getPublicKey(seedBytes, false).subarray(1);
console.log("\nChave Pública ECDSA da Seed:", bytesToHex(derivedPub));

// Gerar assinatura determinística usando noble-curves
const sig = secp256k1.sign(hashBytes, seedBytes, { format: 'recovered' });
const r = sig.subarray(1, 33);
const s = sig.subarray(33, 65);
const recId = sig[0];

console.log("\nAssinatura GERADA a partir da Seed:");
console.log("  R:", bytesToHex(r));
console.log("  S:", bytesToHex(s));
console.log("  recId:", recId);

console.log("\nAssinatura na TRANSAÇÃO enviada no RLP:");
console.log("  R: 2af69ba1e38d9b1f92820e3601cb1e4ab54abd3033cadf82c71f1447af31e7ba");
console.log("  S: 55b48a8f4077108e1a860b337b4d52338937a1913ae83b1c556f487af7e952b4");
console.log("  recId: 0");
