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

// Chave privada e pública de teste
const testPrivateKeySeed = Buffer.alloc(32, 0x01);
const uncompressedSecpKey = secp256k1.getPublicKey(testPrivateKeySeed, false).subarray(1); // 64 bytes
const mockMldsaPubKey = Buffer.alloc(1312, 0xaa);
const compositePublicKey = Buffer.concat([uncompressedSecpKey, mockMldsaPubKey]);
const derivedAddress = "0x" + Buffer.from(keccak_256(compositePublicKey).slice(-20)).toString("hex");

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

// 1. Autorização
const preimageRlp = encodeRLP([
  shortToBytes(dsaType),
  toBuffer(chainId),
  toBuffer(delegationAddress),
  toBuffer(nonce),
  toBuffer(mockMldsaPubKey)
]);
const authPreimage = Buffer.concat([Buffer.from([0x05]), preimageRlp]);
const authHash = keccak_256(authPreimage);
const authSig = secp256k1.sign(authHash, testPrivateKeySeed, { format: 'recovered', prehash: false });
const authClassicSig = Buffer.alloc(65);
authClassicSig.set(authSig.subarray(1, 65), 0);
authClassicSig[64] = authSig[0];
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

// 2. Preimage da Transação Pai
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

// 3. Assinatura da Transação Pai
const ecdsaSig = secp256k1.sign(signingHash, testPrivateKeySeed, { format: 'recovered', prehash: false });
const classicSig = Buffer.alloc(65);
classicSig.set(ecdsaSig.subarray(1, 65), 0);
classicSig[64] = ecdsaSig[0];
const mockPqcTxSig = Buffer.alloc(2420, 0xcc);
const txSignatureBytes = Buffer.concat([classicSig, mockPqcTxSig]);

// 4. Raw Hex Final da Transação 0x44
const finalTxRlpInput = [
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
  toBuffer(mockMldsaPubKey),
  txSignatureBytes
];

const rawTxHex = "0x" + Buffer.concat([Buffer.from([0x44]), encodeRLP(finalTxRlpInput)]).toString("hex");

console.log("==================================================");
console.log("RAW TRANSACTION HEX GERADO (PRONTO PARA BESU):");
console.log(rawTxHex);
console.log("==================================================");
console.log("Endereço do Criador da Conta:", derivedAddress);
console.log("Tamanho total da Raw Hex:", rawTxHex.length, "caracteres");
console.log("==================================================");
