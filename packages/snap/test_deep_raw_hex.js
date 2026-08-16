const { secp256k1 } = require("@noble/curves/secp256k1.js");
const { keccak_256 } = require("@noble/hashes/sha3");

const rawHex = process.argv[2] || "";
const bytes = Buffer.from(rawHex.startsWith("0x") ? rawHex.slice(2) : rawHex, "hex");

console.log("==================================================");
console.log("ANALISANDO TRANSAÇÃO REAL (Tamanho Total: " + bytes.length + " bytes)");
console.log("==================================================");

let offset = 0;
const prefixType = bytes[offset++];
console.log("Prefix Byte (Type):", "0x" + prefixType.toString(16));

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

function decodeRLPItem(buf, off) {
  const prefix = buf[off++];
  let len = 0;
  let start = off;
  let isList = false;
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
    isList = true;
  } else if (prefix >= 0xf8) {
    const lenCount = prefix - 0xf7;
    for (let k = 0; k < lenCount; k++) {
      len = (len << 8) + buf[off++];
    }
    start = off;
    isList = true;
  }
  const content = buf.slice(start, start + len);
  return { content, nextOffset: start + len, isList, rawPrefix: prefix };
}

const listHeader = decodeRLPItem(bytes, offset);
offset = listHeader.nextOffset - listHeader.content.length;

const fields = [];
while (offset < bytes.length) {
  const item = decodeRLPItem(bytes, offset);
  fields.push(item);
  offset = item.nextOffset;
}

console.log("Total de campos no RLP principal:", fields.length);
fields.forEach((f, idx) => {
  console.log(`Campo ${idx}: ${f.content.length} bytes (isList: ${f.isList}, prefix: 0x${f.rawPrefix.toString(16)})`);
});

const mldsaPubKey = fields[11].content;
const fullSignature = fields[12].content;
const classicSig = fullSignature.slice(0, 65);
const r = classicSig.slice(0, 32);
const s = classicSig.slice(32, 64);
const v = classicSig[64];
const recId = v >= 27 ? v - 27 : v;

console.log("\nAssinatura SECP256K1:");
console.log("R:", r.toString("hex"));
console.log("S:", s.toString("hex"));
console.log("V:", v, "(recId:", recId + ")");

// Testar preimages
const rawField10 = fields[10].content; // 3840 bytes

// Preimage Variant 1: RLP([ f0, f1, ..., f9, [ rawField10 ], f11 ])
const p1_fields = fields.slice(0, 12).map(f => f.content);
// Unpack string header from rawField10 if needed
let authItemContent = rawField10;
if (authItemContent[0] >= 0xb8 && authItemContent[0] <= 0xbf) {
  const lCount = authItemContent[0] - 0xb7;
  authItemContent = authItemContent.slice(1 + lCount);
} else if (authItemContent[0] >= 0x80 && authItemContent[0] <= 0xb7) {
  authItemContent = authItemContent.slice(1);
}
p1_fields[10] = [ authItemContent ];

const preimage1 = Buffer.concat([Buffer.from([0x44]), encodeRLP(p1_fields)]);
const hash1 = keccak_256(preimage1);
console.log("\nHash1 (Pré-imagem 0x44 com [ authItemContent ]):", Buffer.from(hash1).toString("hex"));

for (const testV of [0, 1]) {
  try {
    const rBig = BigInt("0x" + r.toString("hex"));
    const sBig = BigInt("0x" + s.toString("hex"));
    const sigObj = new secp256k1.Signature(rBig, sBig, testV);
    const recoveredKey = sigObj.recoverPublicKey(hash1);
    const recoveredHex = recoveredKey.toHex(false).slice(2);
    const combined = Buffer.concat([Buffer.from(recoveredHex, "hex"), mldsaPubKey]);
    const addr = "0x" + Buffer.from(keccak_256(combined).slice(-20)).toString("hex");
    console.log(`[Hash1, recId=${testV}] Endereço recuperado:`, addr);
  } catch (e) {
    console.log(`[Hash1, recId=${testV}] Erro:`, e.message);
  }
}
