const { secp256k1 } = require("@noble/curves/secp256k1");
const { keccak_256 } = require("@noble/hashes/sha3");

// Insira aqui o hex da transação 0x41 gerado pelo DApp/Snap
const hex = ""; 

if (!hex) {
  console.log("Por favor, forneça o hexadecimal de uma transação assinada do tipo 0x41 na variável 'hex'.");
  process.exit(0);
}

const bytes = Buffer.from(hex.startsWith("0x") ? hex.slice(2) : hex, "hex");

// Decodifica elementos manualmente
let offset = 0;
const type = bytes[offset++];
console.log("Transaction Type:", type.toString(16));

if (type !== 0x41) {
  console.error("Erro: Transação não é do tipo 0x41!");
  process.exit(1);
}

let listLength = 0;
const firstLengthByte = bytes[offset++];
if (firstLengthByte >= 0xc0 && firstLengthByte <= 0xf7) {
  listLength = firstLengthByte - 0xc0;
} else if (firstLengthByte >= 0xf8 && firstLengthByte <= 0xff) {
  const lenBytesCount = firstLengthByte - 0xf7;
  for (let i = 0; i < lenBytesCount; i++) {
    listLength = (listLength << 8) + bytes[offset++];
  }
}

console.log("RLP List Length:", listLength);

// Para tipo 0x41, temos 11 campos no total:
// 10 campos de preimage + 1 campo contendo a assinatura híbrida/PQC final.
const fields = [];
for (let i = 1; i <= 11; i++) {
  if (offset >= bytes.length) break;
  const prefix = bytes[offset++];
  let len = 0;
  let startOffset = offset;
  if (prefix < 0x80) {
    len = 1;
    startOffset = offset - 1;
  } else if (prefix <= 0xb7) {
    len = prefix - 0x80;
  } else if (prefix <= 0xbf) {
    const lenBytesCount = prefix - 0xb7;
    for (let k = 0; k < lenBytesCount; k++) {
      len = (len << 8) + bytes[offset++];
    }
    startOffset = offset;
  } else if (prefix >= 0xc0 && prefix <= 0xf7) {
    len = prefix - 0xc0;
  } else if (prefix >= 0xf8 && prefix <= 0xff) {
    const lenBytesCount = prefix - 0xf7;
    for (let k = 0; k < lenBytesCount; k++) {
      len = (len << 8) + bytes[offset++];
    }
    startOffset = offset;
  }
  const content = bytes.slice(startOffset, startOffset + len);
  offset = startOffset + len;
  fields.push(content);
}

console.log(`Campos decodificados: ${fields.length} de 11 esperados.`);

if (fields.length < 11) {
  console.error("Erro: RLP decodificou menos de 11 campos!");
  process.exit(1);
}

// Mapeamento dos campos da transação 0x41:
// 0: dsaType
// 1: chainId
// 2: nonce
// 3: gasPrice
// 4: gasLimit
// 5: to
// 6: value
// 7: payload (data)
// 8: accessList
// 9: pqcPublicKey
// 10: signature (ECDSA + ML-DSA para híbridas, ou ML-DSA pura)

const dsaType = fields[0];
const chainId = fields[1];
const nonce = fields[2];
const gasPrice = fields[3];
const gasLimit = fields[4];
const to = fields[5];
const value = fields[6];
const payload = fields[7];
const accessList = fields[8];
const mldsaPubKey = fields[9];
const signature = fields[10];

const bytesToHex = (b) => Buffer.from(b).toString("hex");

console.log("\n--- Campos Decodificados do RLP ---");
console.log("dsaType (hex):", bytesToHex(dsaType));
console.log("chainId (hex):", bytesToHex(chainId));
console.log("nonce (hex):", bytesToHex(nonce));
console.log("gasPrice (hex):", bytesToHex(gasPrice));
console.log("gasLimit (hex):", bytesToHex(gasLimit));
console.log("to (hex):", bytesToHex(to));
console.log("value (hex):", bytesToHex(value));
console.log("Tamanho da chave pública ML-DSA:", mldsaPubKey.length, "bytes");
console.log("Tamanho da assinatura completa:", signature.length, "bytes");

// Separar a assinatura clássica e pós-quântica
const isHybrid = dsaType.length === 2 && dsaType[0] === 0x00 && dsaType[1] === 0x60;
console.log("Tipo de DSA:", isHybrid ? "Híbrido (ECDSA + ML-DSA)" : "Puro (ML-DSA)");

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

// Reconstrói a preimage a partir dos primeiros 10 campos
const preimageRLP = encodeRLP(fields.slice(0, 10));
const fullPreimage = Buffer.concat([Buffer.from([0x41]), preimageRLP]);
const signingHash = keccak_256(fullPreimage);
console.log("\nCalculated signingHash:", Buffer.from(signingHash).toString("hex"));

if (isHybrid) {
  const ecdsaPart = signature.slice(0, 65);
  const r = ecdsaPart.slice(0, 32);
  const s = ecdsaPart.slice(32, 64);
  const v = ecdsaPart[64];
  
  console.log("\n--- Assinaturas Separadas ---");
  console.log("Assinatura SECP256K1 R:", r.toString("hex"));
  console.log("Assinatura SECP256K1 S:", s.toString("hex"));
  console.log("Assinatura SECP256K1 v (recId):", v);

  const recoveryId = v >= 27 ? v - 27 : v;
  console.log("recoveryId deduzido:", recoveryId);

  try {
    const recoveredKey = secp256k1.Signature.fromCompact(Buffer.concat([r, s]))
      .addRecoveryBit(recoveryId)
      .recoverPublicKey(signingHash);
    
    const recoveredHex = recoveredKey.toHex(false);
    console.log("Recovered ECDSA Public Key (without 0x04):", recoveredHex.slice(2));

    const combined = Buffer.concat([
      Buffer.from(recoveredHex.slice(2), "hex"),
      mldsaPubKey
    ]);
    const addrHash = keccak_256(combined);
    const derivedAddress = "0x" + Buffer.from(addrHash.slice(-20)).toString("hex");
    console.log("Derived Sender Address:", derivedAddress);
  } catch (err) {
    console.error("Erro ao recuperar chave pública SECP256K1:", err.message);
  }
} else {
  console.log("\nTransação pura ML-DSA. Não requer recuperação clássica.");
}
