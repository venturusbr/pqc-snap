const path = require('path');

const snapNodeModules = path.resolve(__dirname, 'packages/snap/node_modules');
const rootNodeModules = path.resolve(__dirname, 'node_modules');
module.paths.push(snapNodeModules, rootNodeModules);

const { secp256k1 } = require('@noble/curves/secp256k1');
const { keccak_256 } = require('@noble/hashes/sha3');
const mldsa = require('mldsa-wasm').default || require('mldsa-wasm');

function numberToBytes(num) {
  if (num === 0) return new Uint8Array(0);
  const hexStr = num.toString(16);
  const padded = hexStr.length % 2 === 0 ? hexStr : '0' + hexStr;
  return Buffer.from(padded, 'hex');
}

function shortToBytes(val) {
  const buf = Buffer.alloc(2);
  buf[0] = (val >> 8) & 0xff;
  buf[1] = val & 0xff;
  return buf;
}

function toScalarBuffer(val) {
  if (val === undefined || val === null) return new Uint8Array(0);
  if (val instanceof Uint8Array || Buffer.isBuffer(val)) {
    let start = 0;
    while (start < val.length - 1 && val[start] === 0) start++;
    if (start === val.length - 1 && val[start] === 0) return new Uint8Array(0);
    return val.subarray(start);
  }
  if (typeof val === 'string') {
    let clean = val.startsWith('0x') ? val.slice(2) : val;
    if (clean.length % 2 !== 0) clean = '0' + clean;
    if (clean === '00' || clean === '') return new Uint8Array(0);
    const buf = Buffer.from(clean, 'hex');
    let start = 0;
    while (start < buf.length - 1 && buf[start] === 0) start++;
    if (start === buf.length - 1 && buf[start] === 0) return new Uint8Array(0);
    return buf.subarray(start);
  }
  if (typeof val === 'number') {
    return numberToBytes(val);
  }
  if (typeof val === 'bigint') {
    let hex = val.toString(16);
    if (hex.length % 2 !== 0) hex = '0' + hex;
    return Buffer.from(hex, 'hex');
  }
  return new Uint8Array(0);
}

function toAddressBuffer(val) {
  if (!val) return new Uint8Array(0);
  let clean = typeof val === 'string' ? (val.startsWith('0x') ? val.slice(2) : val) : Buffer.from(val).toString('hex');
  clean = clean.padStart(40, '0');
  return Buffer.from(clean.slice(0, 40), 'hex');
}

function encodeRLP(item) {
  if (item === undefined || item === null) return new Uint8Array([0x80]);
  if (item instanceof Uint8Array || Buffer.isBuffer(item)) {
    if (item.length === 1 && item[0] < 0x80) return item;
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
    let payload = Buffer.alloc(0);
    for (const subItem of item) payload = Buffer.concat([payload, encodeRLP(subItem)]);
    if (payload.length < 56) {
      const header = Buffer.alloc(1);
      header[0] = 0xc0 + payload.length;
      return Buffer.concat([header, payload]);
    }
    const lenBytes = numberToBytes(payload.length);
    const header = Buffer.alloc(1 + lenBytes.length);
    header[0] = 0xf7 + lenBytes.length;
    header.set(lenBytes, 1);
    return Buffer.concat([header, payload]);
  }
  return new Uint8Array([0x80]);
}

function createClassicSignature(hash, seedBytes) {
  const sigObj = secp256k1.sign(hash, seedBytes, { format: 'recovered', prehash: false });
  const classicSig = new Uint8Array(65);
  classicSig.set(sigObj.subarray(1, 65), 0);
  classicSig[64] = sigObj[0]; // 0 ou 1
  return classicSig;
}

async function testBuild() {
  const seedBytes = Buffer.from('0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20', 'hex');
  const uncompressedSecpKey = secp256k1.getPublicKey(seedBytes, false).subarray(1); // 64 bytes
  const mldsaPrivKeyObj = await mldsa.importKey("raw-seed", seedBytes, "ML-DSA-44", false, ["sign"]);
  const mldsaPubKeyObj = await mldsa.getPublicKey(mldsaPrivKeyObj, ["verify"]);
  const mldsaPubKeyBytes = new Uint8Array(await mldsa.exportKey("raw-public", mldsaPubKeyObj)); // 1312 bytes

  const compositePublicKey = Buffer.concat([uncompressedSecpKey, mldsaPubKeyBytes]);
  const hybridAddress = "0x" + Buffer.from(keccak_256(compositePublicKey).slice(-20)).toString("hex");
  console.log("Hybrid Sender Account:", hybridAddress);

  const dsaType = 0x0060;
  const chainId = '0x16bfadfa';
  const delegationContract = '0x0000000000000000000000000000000000005555';
  const nonce = '0x0';
  const gasPrice = '0x3b9aca00';
  const gasLimit = '0x0f4240';
  const to = hybridAddress;
  const value = '0x0';
  const data = '0x';
  const accessList = [];

  // 1. Authorization Preimage (0x05)
  const authAddressBuf = toAddressBuffer(delegationContract);
  const authPreimageRlp = encodeRLP([
    shortToBytes(dsaType),
    toScalarBuffer(chainId),
    authAddressBuf,
    toScalarBuffer(nonce),
    mldsaPubKeyBytes
  ]);
  const authPreimage = Buffer.concat([Buffer.from([0x05]), authPreimageRlp]);
  const authHash = keccak_256(authPreimage);

  const authClassicSig = createClassicSignature(authHash, seedBytes);
  const authPqcPayload = Buffer.concat([authHash, authClassicSig]);
  const authPqcSigBuf = await mldsa.sign("ML-DSA-44", mldsaPrivKeyObj, authPqcPayload);
  const authSignatureBytes = Buffer.concat([authClassicSig, new Uint8Array(authPqcSigBuf)]);

  // CodeDelegation Opaque Item (0x01 || RLP([dsaType, chainId, address, nonce, pubKey, sig]))
  const cdItemRlp = encodeRLP([
    shortToBytes(dsaType),
    toScalarBuffer(chainId),
    authAddressBuf,
    toScalarBuffer(nonce),
    mldsaPubKeyBytes,
    authSignatureBytes
  ]);
  const finalCodeDelegationItem = Buffer.concat([Buffer.from([0x01]), cdItemRlp]);
  const codeDelegationsList = [ finalCodeDelegationItem ];

  // 2. Parent Tx Preimage (0x44)
  const toAddressBuf = toAddressBuffer(to);
  const rlpPreimageInput = [
    shortToBytes(dsaType),
    toScalarBuffer(chainId),
    toScalarBuffer(nonce),
    toScalarBuffer(gasPrice),
    toScalarBuffer(gasPrice),
    toScalarBuffer(gasLimit),
    toAddressBuf,
    toScalarBuffer(value),
    toScalarBuffer(data),
    accessList,
    codeDelegationsList,
    mldsaPubKeyBytes
  ];

  const fullTxPreimage = Buffer.concat([Buffer.from([0x44]), encodeRLP(rlpPreimageInput)]);
  const signingHash = keccak_256(fullTxPreimage);

  const txClassicSig = createClassicSignature(signingHash, seedBytes);
  const txPqcPayload = Buffer.concat([signingHash, txClassicSig]);
  const txPqcSigBuf = await mldsa.sign("ML-DSA-44", mldsaPrivKeyObj, txPqcPayload);
  const txSignatureBytes = Buffer.concat([txClassicSig, new Uint8Array(txPqcSigBuf)]);

  // 3. Final Raw Transaction
  const finalTxRlpInput = [
    shortToBytes(dsaType),
    toScalarBuffer(chainId),
    toScalarBuffer(nonce),
    toScalarBuffer(gasPrice),
    toScalarBuffer(gasPrice),
    toScalarBuffer(gasLimit),
    toAddressBuf,
    toScalarBuffer(value),
    toScalarBuffer(data),
    accessList,
    codeDelegationsList,
    mldsaPubKeyBytes,
    txSignatureBytes
  ];

  const rawTxBytes = Buffer.concat([Buffer.from([0x44]), encodeRLP(finalTxRlpInput)]);
  const rawTxHex = "0x" + rawTxBytes.toString("hex");
  console.log("SUCCESS! Generated Raw Tx Length:", rawTxHex.length, "chars (" + rawTxBytes.length + " bytes)");

  // Verify Besu Decoder simulation:
  console.log("\nSimulating Besu Java Decoder:");
  let offset = 0;
  const txType = rawTxBytes[offset++];
  console.log("TxType Byte:", txType.toString(16));
  console.log("RLP Slice(1) length:", rawTxBytes.slice(1).length);
}

testBuild().catch(console.error);
