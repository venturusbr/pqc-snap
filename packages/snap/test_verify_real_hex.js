const { secp256k1 } = require("@noble/curves/secp256k1.js");
const { keccak_256 } = require("@noble/hashes/sha3");

const hex = process.argv[2] || "";
if (!hex) {
  console.log("Uso: node test_verify_real_hex.js <hex>");
  process.exit(0);
}

const bytes = Buffer.from(hex.startsWith("0x") ? hex.slice(2) : hex, "hex");
let offset = 0;
const type = bytes[offset++];

function decodeRLPItem(buf, off) {
  const prefix = buf[off++];
  let len = 0;
  let start = off;
  if (prefix < 0x80) {
    len = 1;
    start = off - 1;
  } else if (prefix <= 0xb7) {
    len = prefix - 0x80;
    start = off;
  } else if (prefix <= 0xbf) {
    const lenCount = prefix - 0xb7;
    for (let k = 0; k < lenCount; k++) {
      len = (len << 8) + buf[off++];
    }
    start = off;
  } else if (prefix >= 0xc0 && prefix <= 0xf7) {
    len = prefix - 0xc0;
    start = off;
  } else if (prefix >= 0xf8) {
    const lenCount = prefix - 0xf7;
    for (let k = 0; k < lenCount; k++) {
      len = (len << 8) + buf[off++];
    }
    start = off;
  }
  const content = buf.slice(start, start + len);
  return { content, nextOffset: start + len };
}

// Decode list header
const listHeader = decodeRLPItem(bytes, offset);
offset = listHeader.nextOffset - listHeader.content.length;

const fields = [];
for (let i = 0; i < 13; i++) {
  const item = decodeRLPItem(bytes, offset);
  fields.push(item.content);
  offset = item.nextOffset;
}

function numberToBytes(num) {
  if (num === 0) return new Uint8Array(0);
  const hexStr = num.toString(16);
  const padded = hexStr.length % 2 === 0 ? hexStr : '0' + hexStr;
  return Buffer.from(padded, "hex");
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

const mldsaPubKey = fields[11];
const signature = fields[12];
const classicSig = signature.slice(0, 65);
const r = classicSig.slice(0, 32);
const s = classicSig.slice(32, 64);
const v = classicSig[64];
const recId = v >= 27 ? v - 27 : v;

const rBig = BigInt("0x" + r.toString("hex"));
const sBig = BigInt("0x" + s.toString("hex"));
const sigObj = new secp256k1.Signature(rBig, sBig, recId);

console.log("==================================================");
console.log("TESTANDO RECONSTRUÇÃO DA PREIMAGE DO HEX");
console.log("==================================================");

// Preimage 1: Campos brutos diretos (Field 10 como elemento de lista)
const fields1 = fields.slice(0, 12);
fields1[10] = [ fields1[10] ];
const hash1 = keccak_256(Buffer.concat([Buffer.from([0x44]), encodeRLP(fields1)]));
const pub1 = sigObj.recoverPublicKey(hash1).toHex(false).slice(2);
const addr1 = "0x" + Buffer.from(keccak_256(Buffer.concat([Buffer.from(pub1, "hex"), mldsaPubKey])).slice(-20)).toString("hex");
console.log("Opção 1 (RLP padrão):", addr1);

// Preimage 2: Injetando 0x01 interno no Field 10
const fields2 = fields.slice(0, 12);
fields2[10] = [ Buffer.concat([ Buffer.from([0x01]), encodeRLP([ Buffer.from([0x01]), fields2[10].slice(1) ]) ]) ];
const hash2 = keccak_256(Buffer.concat([Buffer.from([0x44]), encodeRLP(fields2)]));
const pub2 = sigObj.recoverPublicKey(hash2).toHex(false).slice(2);
const addr2 = "0x" + Buffer.from(keccak_256(Buffer.concat([Buffer.from(pub2, "hex"), mldsaPubKey])).slice(-20)).toString("hex");
console.log("Opção 2 (RLP com 0x01 interno):", addr2);

console.log("==================================================");
