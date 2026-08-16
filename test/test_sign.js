const { secp256k1 } = require('@noble/curves/secp256k1.js');
const { keccak_256 } = require('@noble/hashes/sha3');

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

try {
  console.log("=== TESTANDO CONVERSÃO COMPRESSED -> UNCOMPRESSED ===");

  const privKey = new Uint8Array(32);
  privKey[31] = 1; // private key = 1

  const pubKeyFull = secp256k1.getPublicKey(privKey, false);
  const pubKey64 = pubKeyFull.subarray(1); // 64 bytes sem o prefixo 0x04
  console.log("Chave pública esperada (64 bytes):", bytesToHex(pubKey64));

  const msgHash = keccak_256(new TextEncoder().encode("teste"));
  const ecdsaSig = secp256k1.sign(msgHash, privKey, { format: 'recovered' });

  // Recuperar chave pública compactada
  const recoveredCompressed = secp256k1.recoverPublicKey(ecdsaSig, msgHash);
  console.log("Recuperado compactado (33 bytes):", bytesToHex(recoveredCompressed));

  // Converter para descompactada usando secp256k1.Point
  const point = secp256k1.Point.fromHex(bytesToHex(recoveredCompressed));
  const recoveredUncompressedHex = point.toHex(false);
  console.log("Recuperado descompactado (com prefixo 04):", recoveredUncompressedHex);

  const recovered64 = hexToBytes(recoveredUncompressedHex).subarray(1);
  console.log("Recuperado descompactado (64 bytes):", bytesToHex(recovered64));

  console.log("Coincide?", bytesToHex(recovered64) === bytesToHex(pubKey64) ? "✅ SIM!" : "❌ NÃO!");

} catch (e) {
  console.error("Erro:", e.stack);
}
