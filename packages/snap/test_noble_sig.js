const { secp256k1 } = require("@noble/curves/secp256k1.js");

// Criar uma assinatura e ver o que prepSig faz
const code = secp256k1.sign.toString();
console.log(code);
