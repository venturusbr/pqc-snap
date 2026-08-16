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
console.log("TESTE DE CODIFICAÇÃO RLP (TRANSAÇÃO 0x44 E CODE DELEGATION)");
console.log("==================================================");

// Dados de Amostra
const dsaType = 0x0060; // SECP256K1MLDSA44 Híbrido
const chainId = '0x16bfadfa';
const nonce = '0x0';
const gasPrice = '0x0';
const gasLimit = '0x0f4240';
const to = '0x124c77c547626044e2c9e25aed558a361d37e091';
const value = '0x0';
const data = '0x';
const accessList = [];
const delegationAddress = '0x0000000000000000000000000000000000005555';

// Simula chave ML-DSA de 1312 bytes e assinatura de 2485 bytes
const mockPqcPublicKey = Buffer.alloc(1312, 0xaa);
const mockSignatureBytes = Buffer.alloc(2485, 0xbb);

// 1. CodeDelegation RLP para a Autorização
const preimageRlp = encodeRLP([
  shortToBytes(dsaType),
  toBuffer(chainId),
  toBuffer(delegationAddress),
  toBuffer(nonce),
  toBuffer(mockPqcPublicKey)
]);
const fullAuthPreimage = Buffer.concat([Buffer.from([0x05]), preimageRlp]);
console.log("1. Autorização Preimage MAGIC (0x05) + RLP tamanho:", fullAuthPreimage.length);
console.log("   Auth Preimage Hex (primeiros 30 bytes):", fullAuthPreimage.slice(0, 30).toString("hex"));

// 2. CodeDelegation RLP Item Final (0x01 || RLP([...]))
const itemRlpPayload = encodeRLP([
  shortToBytes(dsaType),
  toBuffer(chainId),
  toBuffer(delegationAddress),
  toBuffer(nonce),
  toBuffer(mockPqcPublicKey),
  mockSignatureBytes
]);
const finalItemBytes = Buffer.concat([Buffer.from([0x01]), itemRlpPayload]);
console.log("\n2. CodeDelegation Item Final (0x01 || RLP) tamanho:", finalItemBytes.length);
console.log("   CodeDelegation Hex (primeiros 30 bytes):", finalItemBytes.slice(0, 30).toString("hex"));

// 3. Transação Pai (Tipo 0x44)
const rlpInput = [
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
  toBuffer(mockPqcPublicKey),
  mockSignatureBytes
];

const rawBytes = Buffer.concat([Buffer.from([0x44]), encodeRLP(rlpInput)]);
console.log("\n3. Transação Pai 0x44 Completa RLP tamanho:", rawBytes.length);
console.log("   TX Hex (primeiros 40 bytes):", rawBytes.slice(0, 40).toString("hex"));
console.log("==================================================");
