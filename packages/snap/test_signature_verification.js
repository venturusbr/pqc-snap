const { secp256k1 } = require("@noble/curves/secp256k1.js");
const { keccak_256 } = require("@noble/hashes/sha3");

function numberToBytes(num) {
  if (num === 0) return new Uint8Array(0);
  const hexStr = num.toString(16);
  const padded = hexStr.length % 2 === 0 ? hexStr : '0' + hexStr;
  return Buffer.from(padded, "hex");
}

function shortToBytes(val) {
  const buf = Buffer.alloc(2);
  buf[0] = (val >> 8) & 0xff;
  buf[1] = val & 0xff;
  return buf;
}

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

function encodeRLP(item) {
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
    let pay = Buffer.alloc(0);
    for (const subItem of item) {
      pay = Buffer.concat([pay, encodeRLP(subItem)]);
    }
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

console.log("==================================================");
console.log("TESTE DE VERIFICAÇÃO E RECUPERAÇÃO DE ASSINATURA HÍBRIDA 0x44");
console.log("==================================================");

// 1. Gera um par de chaves SECP256K1 determinístico de teste (seed 32 bytes)
const testPrivateKeySeed = Buffer.alloc(32, 0x01); // Seed de teste constante
const uncompressedSecpKey = secp256k1.getPublicKey(testPrivateKeySeed, false).subarray(1); // 64 bytes sem 0x04
const mockMldsaPubKey = Buffer.alloc(1312, 0xaa);
const compositePublicKey = Buffer.concat([uncompressedSecpKey, mockMldsaPubKey]);

// Deriva o endereço Ethereum derivado da chave composta (últimos 20 bytes do keccak256)
const derivedAddress = "0x" + Buffer.from(keccak_256(compositePublicKey).slice(-20)).toString("hex");
console.log("Endereço esperado da conta:", derivedAddress);

// 2. Parâmetros da Transação 0x44
const dsaType = 0x0060;
const chainId = '0x16bfadfa';
const nonce = '0x0';
const gasPrice = '0x0';
const gasLimit = '0x0f4240';
const to = '0x124c77c547626044e2c9e25aed558a361d37e091';
const value = '0x0';
const data = '0x';
const accessList = [];
const delegationAddress = '0x0000000000000000000000000000000000005555';

// 3. Monta a autorização CodeDelegation
const preimageRlp = encodeRLP([
  shortToBytes(dsaType),
  toBuffer(chainId),
  toBuffer(delegationAddress),
  toBuffer(nonce),
  toBuffer(mockMldsaPubKey)
]);
const authPreimage = Buffer.concat([Buffer.from([0x05]), preimageRlp]);
const authHash = keccak_256(authPreimage);

// Assina a autorização
const authSig = secp256k1.sign(authHash, testPrivateKeySeed, { format: 'recovered', prehash: false });
const authClassicSig = Buffer.alloc(65);
authClassicSig.set(authSig.subarray(1, 65), 0);
authClassicSig[64] = authSig[0]; // recId 0 ou 1
const mockPqcAuthSig = Buffer.alloc(2420, 0xbb);
const authSignatureBytes = Buffer.concat([authClassicSig, mockPqcAuthSig]);

const finalItemBytes = Buffer.concat([
  Buffer.from([0x01]),
  encodeRLP([
    shortToBytes(dsaType),
    toBuffer(chainId),
    toBuffer(delegationAddress),
    toBuffer(nonce),
    toBuffer(mockMldsaPubKey),
    authSignatureBytes
  ])
]);

// 4. Preimage da Transação Pai (0x44)
const rlpPreimage = encodeRLP([
  shortToBytes(dsaType),
  toBuffer(chainId),
  toBuffer(nonce),
  toBuffer(gasPrice),
  toBuffer(gasPrice),
  toBuffer(gasLimit),
  toBuffer(to),
  toBuffer(value),
  toBuffer(data),
  accessList,
  [finalItemBytes],
  toBuffer(mockMldsaPubKey)
]);

const fullTxPreimage = Buffer.concat([Buffer.from([0x44]), rlpPreimage]);
const signingHash = keccak_256(fullTxPreimage);
console.log("Calculated outer signingHash (hex):", Buffer.from(signingHash).toString("hex"));

// 5. Assina o signingHash com a chave clássica
const ecdsaSig = secp256k1.sign(signingHash, testPrivateKeySeed, { format: 'recovered', prehash: false });
const classicSig = Buffer.alloc(65);
classicSig.set(ecdsaSig.subarray(1, 65), 0);
classicSig[64] = ecdsaSig[0]; // recId 0 ou 1

// 6. Teste de Recuperação ecrecover da Chave Pública Clássica no Node.js
const rBytes = classicSig.subarray(0, 32);
const sBytes = classicSig.subarray(32, 64);
const recId = classicSig[64];

const rBigInt = BigInt("0x" + Buffer.from(rBytes).toString("hex"));
const sBigInt = BigInt("0x" + Buffer.from(sBytes).toString("hex"));

const sigObj = new secp256k1.Signature(rBigInt, sBigInt, recId);
const recoveredKeyObj = sigObj.recoverPublicKey(signingHash);
const recoveredHex = recoveredKeyObj.toHex(false);

const recoveredUncompressedSecp = Buffer.from(recoveredHex.slice(2), "hex"); // 64 bytes sem 0x04

// Recombina com a chave ML-DSA
const testCompositePublicKey = Buffer.concat([recoveredUncompressedSecp, mockMldsaPubKey]);
const recoveredAddress = "0x" + Buffer.from(keccak_256(testCompositePublicKey).slice(-20)).toString("hex");

console.log("Recovered Sender Address:", recoveredAddress);

if (derivedAddress.toLowerCase() === recoveredAddress.toLowerCase()) {
  console.log("==================================================");
  console.log("✅ SUCESSO ABSOLUTO! O ENDEREÇO RECUPERADO É 100% IDÊNTICO AO DA CONTA!");
  console.log("==================================================");
} else {
  console.log("❌ DESALINHAMENTO DE ENDEREÇO!");
}
