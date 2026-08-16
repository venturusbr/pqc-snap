const { secp256k1 } = require("@noble/curves/secp256k1.js");
const { keccak_256 } = require("@noble/hashes/sha3");

const hash1Hex = "57b6077e228c74d501559d15443c6e573547dd2b879a6e0de13090b42ba4544f";
const hash1 = Buffer.from(hash1Hex, "hex");
const seedBytes = new Uint8Array(32).fill(1);

// Testar 1:
const sig1 = secp256k1.sign(hash1, seedBytes, { prehash: false });
console.log("sig1:", sig1, "recovery:", sig1.recovery);

// Testar 2:
const sig2 = secp256k1.sign(hash1, seedBytes);
console.log("sig2:", sig2, "recovery:", sig2.recovery);

// Testar 3: Sign com opts
const sig3 = secp256k1.sign(hash1, seedBytes, { prehash: false, extraEntropy: false });
console.log("sig3 recovery:", sig3.recovery);

// Testar como recuperar public key de seedBytes e testar recId
const ecdsaPubKey = secp256k1.getPublicKey(seedBytes, false).subarray(1);
const expectedAddr = "0x" + Buffer.from(keccak_256(ecdsaPubKey).slice(-20)).toString("hex");
console.log("Expected ECDSA Addr:", expectedAddr);

for (let rId of [0, 1]) {
  const recoveredKey = secp256k1.Signature.fromCompact(sig1).addRecoveryBit(rId).recoverPublicKey(hash1);
  const recAddr = "0x" + Buffer.from(keccak_256(recoveredKey.toHex(false).slice(2)).slice(-20)).toString("hex");
  console.log(`[rId=${rId}] recAddr:`, recAddr);
  if (recAddr === expectedAddr) {
    console.log(`>>> MATCH ENCONTRADO PARA recId = ${rId}! <<<`);
  }
}
