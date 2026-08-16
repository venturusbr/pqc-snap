const { keccak_256 } = require("@noble/hashes/sha3");
const { secp256k1 } = require("@noble/curves/secp256k1.js");

// O hexadecimal completo da transação que você enviou
const txHex = "0x42f90f0a8200608416bfadfa808080830f424094ad6cf28b14540912629f74d2d06cfb00772bbd6e8829a2241af62c000080c0b9052092182d71bfc5fa51a25732bf56e020beb4ddcbb1965585c8fb1747dfcfb8e460b0112c9e9d29b78ec14e67f90d0553050ac8d76172d656be40745a7b8e4e79e42cb78c07192247007082f1517c879a45ee86a540e3eb14906287b9714e7ed18509599d6b91f2f843817a06db8739af3b9a54437584f9d7e688d1f3d3a5f7650773f61734557862e51b4fb02628528331cf96681a644d1afbed272e63a5c4dbb69707ee36be68e38ebfc734b1a4781fd5d563e35bbb18ea7321e09aa1107c24b753d9952145871ba5c1125cc0b02960d5ce8d688df28186612a4d9208743bfadc0f69054317fd601ef12f859c9f9e93ec40c8f5f8077022de1c1abce1a7bfe524934eaf23beb3bbca4129bdb0eef54301b47bb7701bb77dcff80cb9c30e0e484532adafc3a405067529d6640241591da2509a306ca038a25ecb8456bf1956dc8e8bb6e1e9461441a821cb595a262ff850cef2c8a946d91868de97cf96940ea718228d09439933bdf0a74078ee26d63f9e794ef4e10f1b2649c3622a2d4a006fbc9c3b9203c7ac2eda084f58d9f9e5ee94552e30caae61a28e711d584b41cde1b406dd1811942e6ad940c2c7fd574ea1c2d3990b3a6cb688a5e2640973d0425d1f08249ce2b41bd420020afd88148bb5649c4704800c9e225d7656b8226f6d05be1614b65c0ddbd0dee658fea1b9140929c01aca1c6687a08b7dd68319fe8ee58efe5e7f337441edfe64ccf29749636f2034454bec9e775bd3fd16d889c8725ea14d72b369ad662128201617442f4d7bbba788329183c8ba3844abbc41305d940a7d0c20af51ca9a000de39f276cb23d72457e6c6ae9c2556d505b56d28f612a109e68cc060d642f79a3a517e3cc6a544a27b580d1c7b54c1194372e869597749c376c2b49d4475395aeef2cff7cfee66561df9b5e4fb3e8963daca75d90f81165822780dd74b204478788e98aad39568396aaf15db23ed6ec767479f862809cacbd293fcd503fbedbcd8a056340e1eea295236760821aaf83281e2dd59b86f716106ce3bda75983865d14333bb8d00dc5a07b95cf97806f42adb394075caa2a663670128ff38f5ca1de5bf828dcf5c242397a16f3a5e18efc0b2ef43e575399dbdfc32d29f5ce799324894d537ffa7053db09c0e4549f5bb5fb586e55d08c02c17065b6c9a15f2eb6c3ee3fe521ffcd3e75b89dee8fd4c528065003d5a77e644b78508dc7f9a336229c1b3326c1b48496b8e3e179f55e1f04e981fdf07b261cb927c1d634568c686878ad8f7ab3c24d94eb3044176e924559756886e1241b0c57a2f17067344bab247278a5a4976bd5491592ad2b6b2e7e21514537c72b566081caf353eed02d5bae44fd139d3b4492094bdcd80d35797e5155b59408a3664280e379a77ece808b21f73e54fadd4957d53c2b5046be0914167cc2c1d35394f8b006aadd31e29948988c58bfc268fc1db3c1aba04bb4aac98b0a1e14769a24f091a2ca2d049cd20374e06c412bb381c7e6b0965dd57fc9633ab497ca509cc32cc74a726c9047eed0099601f32db644a79e5cd31870a730b95942affb7d0dd7c930a6ac733ea2b4f403de1a885c09a30100901f72d9768cddd6eb8f48f0306a00cba6445886bf520ac98b4f2f5f226d2fa78e52ccf5cdab198228a835a886410b1e0e2710a7646c22b9bc63a077061c1365403ddbd0e02b4fdff019844f2ec9ef439295ee4b776e974349a718705ac95af037a9b7580c1a3a747fc0942802bfb80b77159f6b8f1747317dc3760d918e4bbb7074d51713b98fa9696cb10d2278a839bf7202428a943298bfc3ea197cad0a658d759dba1480eb19ea5bb820ac7fb36bb909b52af69ba1e38d9b1f92820e3601cb1e4ab54abd3033cadf82c71f1447af31e7ba55b48a8f4077108e1a860b337b4d52338937a1913ae83b1c556f487af7e952b40086f8ccaddf6632f1f2a2983796022f544989e58f7ec347f0f52f122ed3ff276da73d6991ed867a482e940b7db06bf9f9af7f74bfbf5f2d75feb46a56db840f2918957a8a240c2bcfbd32c116935c3e75e621ef6b97df3121195c648e53623ef30a1346e9ef19e0d689a8bb335b65a1d470bddccc9473af95b521e068f70614f41a7c26453464a7a76ce2a6c26e268b70e7966e31aae3da5df2d4079535d68059ebf9ab940d6486a78f2e82d1ee31b5547842f5a28468b2296c7dea8fbd1d9ea058daa3e6fb6eee61904700bf1691711f9c31e5680f2d540ec86b71a95d654e539af6927f30be3693a895568fc0d47c4bac7769c21cc873f616d46be2f2c3998584d624abcf520aeaeccb43d12737f63558cda47aa818174a4c44e141215a61724998f3dd2259a6dae49647a7c56c4cdeb1cb5bc9ce72cf2f2b2a1ce24b640e9da774cf08eca8a517d97b8d380e5c0d58203b3395f56b55e4e7a31cb360a4f03e759cd2df4f672b2cf4216bd24a48a94e9876dd538d51e84e9e0b249f0a20f946fd85283509c879529eb063a0f9a01d31db2f18f386cdfe399e03f8de7a8245c9cc3c8871f393d67b860ae88219195e3ee91af3757a78b65d928c59ec386c7acd50f22e2ee8862a8fa3142151be69d625774a24df515550e2c1a9887d5bafecf19b9a58a9887a2646dc79c39dc4a657fdfe6796b0b1c7ffac8ac48144707ed50622fcb5db14fbe4fd8d9d2661a0cd7761017aedecdfd2f971b919534c5e9f74cb0aeb1ddcdebc5aae9cbabf4addd61e644817dcae65b079f5b9fa720736cb15de2742d20ed2073c142396563b36cfc351dd3e7c4c8de25c9cd98ed1a9c18f81a405c6068eb1d576cea918de440d5232893619021f3c6c08d3fd1da161cb8c04e57e5aa2215ab455dbb1eadc5ca655dd51bf6b8d38ce3215ca43217200353627990cac85cc1b8e5ab35006d0934b18f9ebedeb4091292d01b7be887f851196da5abb900bd7f82f094bb742179b900d93ad1c027da65d6be4d1e43912f991bf39ae9cc6ce3cbc7f5ba70e9f2958acd7857c55195bc10131302c899fe8259d719fc896d31e91d90fc17d9ff383ce717d59f848d11eb0971a3534703eeabfcebf1d8c71b709fa4827bceb0eec2ad32a1b32a98291b0b086a65d058fc069a76cf0c31e48e769bf623b0d8bc44b4457648b42871785b70e9152bc9d7a2781dc5c081379ebeda3af8083b635a94ad8ae98eca566b89f1471ab6fb7f48e7bcd71491291310e2ec1325f58c333c529dbf167a21e693503e201499b156ea75408c18058ed45d0a8286a1c88a62fd5f9a920a77011beaf5ec5ab057bb8d479a44d3aaf6ef261881f73256ff26f3fd91fb69c46770de04ccab4c904dbe6e5b188c33234fd3507283ae896025ce7440260d9e4009297ecf4cfd7b09c2e31346669b7fc80cf1aa892e8251b6aecb1366e5d6acc30712ec9ffd64a1a37810de6764ffc06f1cc7219c9d1530b1697c2c980fe8838fd1f4a69c0d4205a8148393d9e95660804cdbd76a1a33b1a01e1a3b0bc94fd9c7d97feec2e3a3a594f5ec2c057cb8e04fc90c0c995e02203e00f577dcb69e1bfed386affc654e0cec7b84692d1b327f3be0759d7d5449d02d4909f401158b12bc15a69ec0d19d79063841bdb0a17c2b6db1d49b27e7c6ae1c59a963a74937f35b7c0b84d6821fa39260e6a99c0f75f8188bfb12a3488e9c9afbb7d9cc7e5d4942defc823d32a7b926a935dbac78116961ce0826ce94cc7fc4325ac33e7f0d349482094b41d02444edf4fdb33fb7a55138f7f53a837b3e55c288f3ada6339e320e82b7bb85d6dee18688af0899e4eeb5e3ea6da1408977f04d5460d8b8d76e99a3d1441a8632c107a7014cd0248df745377d6e9ee90fbceadb5c0e8722e73b3c9f479e259f2298d841f1f1687aefab75f1367908d365f4bdf6c8201dc469f91b1c69b4ded5765197568dd18b2e6de71d28c26cd19b6baecf2462d5cbfd6d2ce0012cd4421e8cee4963ae84ac12d09211fe23a335f300a1e20148e8a37a50e9505118373f13213ceac52d607cd2c91455e9f1ca115d4771bbccf7a784f12c2b154321c2052a7de1e870775f70b99e982193b51042ba6adc832f859a9d3851a1b5ef229b8251c494212cf5e75264e4eb5656da4231c2b2b765a2e64701c58de4636f1f7e780e10f9199801726a5a72db3facb7a6c1e0634e4be16fb0b318114f75f8320a632f56f986cc09e7653f570b2880313df74801529e434bac36af4b06bbedd06be084bb4f521c7d0139b4e9a3e313f57427278df23d2e854a1502584b3faaaded389ddd52a4b3d771aa1226f2adc0bf2d313dfd3184812c856367d3ee1d0c7c031a3351c33b3ab596383657bccad6031ddb4d7280680a9896728f05156f45b6896fad3fbcdb09ff8a4960ae2b9b7535690fa5d641e7797fe71b65f794152abe41ed5b104de9e78c80735b05896623b8f6cecf825344b414800f67bb02d1fb8d3817dbf0faf83a41edd8a195097c89e83e979171d5833bb6eb106abbd937eebddc47be95d1fc90e8af6070994c37e63b6006195baa0b5278296584bd4245384f63e161c361c1e7b1a625be4c759c9a6e36db8a093fb1cb35a7ddb9ca9bd96fc3188b72d370a05ac52305c3d516a2610e80fe5a9e7b2d3d6670e19b0f19a9053c49a0caf8a31347c71b011224a10e469cef16d4ea59d45746bf29881760122b81fea0d3169dba9dcd84dde0ea79bb8ab17c11b039f87d7240674a3166aae4836f9c774c1c53d8b8ebede507df4cd26e56b673d9d92f2c59b9a24ade291074e1a347d1dd2cd28c36511fbcc73c325c7f220520a349dcae4ba45f3e17c670782f4f2be9dbbb1980477eeaf20494391573930d5407d2d638c588e7923e232e2f1b7b006b0c1b4ba21f1816134006611ab2bed20c3bbfb7078ffad3287fa107e713f189cd3c985c81d86c7e409ff75278ed355a8ebd8ed9dd4a935e928f982bdb74f8bb0e228701bda55cd409acc78029d86a7f969522bd8c7a6c0981b01ff4bcd1bfaabe1ee9328e7e9f8555dd7b4232c8dfbcddbf11dcc2a3bda14d392a74d3055c2be193b3604ef91ac0be0b68dadf44bfc85740b2b45da4ddc154d80c61e5322fbc55498f9705bd2459497313d7532720def8217226ca9f4b3f0317e9248c4c6b2cadb7334e694756a95e050d16a718514309ef0c576c80a146c878aac5b618676716c689e2840beab314d527d29196e9ced0b88bf95d79a2ab2f62604cff83e5b8a2a204c0a8ea28c17567be522265c150bb2202b3b3e5660696c888e9a9cb1d3f5f60a1f24495160848a94a7aaadb7fafe020c184d54576b7581828387979db5c4c7ccdbf0f811227b909ea9aeafc1c7c9e6e8eb0000000000000000000000000000101f3442";

const expectedSender = "0x90c63ac51f266aeb579be629aac93dcb8b01d329".toLowerCase();
const besuRecovered = "0x99f15eda330156c9b6ed46516d77110058d5e659".toLowerCase();

function hexToBytes(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

const bytesToHex = (bytes) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const concatBytes = (a, b) => {
  const result = new Uint8Array(a.length + b.length);
  result.set(a);
  result.set(b, a.length);
  return result;
};

function numberToBytes(num) {
  if (num === 0) return new Uint8Array(0);
  const hex = num.toString(16);
  const padded = hex.length % 2 === 0 ? hex : '0' + hex;
  return hexToBytes(padded);
}

// RLP decoder
function decodeRLP(bytes) {
  let pos = 0;
  
  function decodeItem() {
    if (pos >= bytes.length) return null;
    const prefix = bytes[pos];
    
    if (prefix < 0x80) {
      pos++;
      return new Uint8Array([prefix]);
    }
    if (prefix < 0xb8) {
      const len = prefix - 0x80;
      pos++;
      const res = bytes.slice(pos, pos + len);
      pos += len;
      return res;
    }
    if (prefix < 0xc0) {
      const lenLen = prefix - 0xb7;
      pos++;
      let len = 0;
      for (let i = 0; i < lenLen; i++) {
        len = (len << 8) + bytes[pos + i];
      }
      pos += lenLen;
      const res = bytes.slice(pos, pos + len);
      pos += len;
      return res;
    }
    if (prefix < 0xf8) {
      const len = prefix - 0xc0;
      pos++;
      const end = pos + len;
      const list = [];
      while (pos < end) {
        list.push(decodeItem());
      }
      return list;
    }
    const lenLen = prefix - 0xf7;
    pos++;
    let len = 0;
    for (let i = 0; i < lenLen; i++) {
      len = (len << 8) + bytes[pos + i];
    }
    pos += lenLen;
    const end = pos + len;
    const list = [];
    while (pos < end) {
      list.push(decodeItem());
    }
    return list;
  }
  
  return decodeItem();
}

function encodeRLP(item) {
  if (item instanceof Uint8Array) {
    if (item.length === 1 && item[0] < 0x80) {
      return item;
    }
    if (item.length < 56) {
      const header = new Uint8Array(1);
      header[0] = 0x80 + item.length;
      return concatBytes(header, item);
    }
    const lenBytes = numberToBytes(item.length);
    const header = new Uint8Array(1 + lenBytes.length);
    header[0] = 0xb7 + lenBytes.length;
    header.set(lenBytes, 1);
    return concatBytes(header, item);
  }
  if (Array.isArray(item)) {
    let payload = new Uint8Array(0);
    for (const subItem of item) {
      payload = concatBytes(payload, encodeRLP(subItem));
    }
    if (payload.length < 56) {
      const header = new Uint8Array(1);
      header[0] = 0xc0 + payload.length;
      return concatBytes(header, payload);
    }
    const lenBytes = numberToBytes(payload.length);
    const header = new Uint8Array(1 + lenBytes.length);
    header[0] = 0xf7 + lenBytes.length;
    header.set(lenBytes, 1);
    return concatBytes(header, payload);
  }
  throw new Error('Unsupported RLP item');
}

console.log("=== INICIANDO DEBUG DA TRANSAÇÃO ===");
const txBytes = hexToBytes(txHex);
if (txBytes[0] !== 0x42) {
  console.error("Erro: Transação não começa com o prefixo 0x42!");
  process.exit(1);
}

const innerRLPBytes = txBytes.slice(1);
const parsedList = decodeRLP(innerRLPBytes);

if (!Array.isArray(parsedList) || parsedList.length < 12) {
  console.error("Erro: RLP não decodificou como uma lista de pelo menos 12 campos!");
  console.log("Comprimento retornado:", parsedList ? parsedList.length : "null");
  process.exit(1);
}

const dsaType = parsedList[0];
const chainId = parsedList[1];
const nonce = parsedList[2];
const maxPriorityFeePerGas = parsedList[3];
const maxFeePerGas = parsedList[4];
const gasLimit = parsedList[5];
const to = parsedList[6];
const value = parsedList[7];
const payload = parsedList[8];
const accessList = parsedList[9];
const mldsaPubKey = parsedList[10];
const signature = parsedList[11];

console.log("\n--- Campos Decodificados do RLP ---");
console.log("dsaType (hex):", bytesToHex(dsaType));
console.log("chainId (hex):", bytesToHex(chainId));
console.log("nonce (hex):", bytesToHex(nonce));
console.log("gasLimit (hex):", bytesToHex(gasLimit));
console.log("to (hex):", bytesToHex(to));
console.log("value (hex):", bytesToHex(value));
console.log("Tamanho da chave pública ML-DSA:", mldsaPubKey.length, "bytes");
console.log("Tamanho da assinatura completa:", signature.length, "bytes");

// Separar assinatura
const secpSignature = signature.slice(0, 65);
const mldsaSignature = signature.slice(65);

console.log("\n--- Assinaturas Separadas ---");
console.log("Assinatura SECP256K1 (65 bytes):", bytesToHex(secpSignature));
console.log("Assinatura ML-DSA-44 (" + mldsaSignature.length + " bytes)");

// Recriar o Preimage no formato exato que o Snap calcula
const preimageFields = [
  dsaType,
  chainId,
  nonce,
  maxPriorityFeePerGas,
  maxFeePerGas,
  gasLimit,
  to,
  value,
  payload,
  accessList,
  mldsaPubKey
];

const snapPreimage = concatBytes(new Uint8Array([0x42]), encodeRLP(preimageFields));
const signingHash = keccak_256(snapPreimage);

console.log("\n--- Hashes e Preimages ---");
console.log("Preimage do Snap (hex):", bytesToHex(snapPreimage).slice(0, 100) + "...");
console.log("Preimage Hash (signingHash):", bytesToHex(signingHash));

// Tentar recuperar chave pública SECP
const r = secpSignature.slice(0, 32);
const s = secpSignature.slice(32, 64);
const rawRecId = secpSignature[64];

console.log("\nAssinatura R:", bytesToHex(r));
console.log("Assinatura S:", bytesToHex(s));
console.log("Assinatura recId no RLP:", rawRecId);

for (let tryRecId = 0; tryRecId < 4; tryRecId++) {
  try {
    // Tentar recuperar a chave pública instanciando o Signature diretamente
    const sig = new secp256k1.Signature(
      BigInt("0x" + bytesToHex(r)),
      BigInt("0x" + bytesToHex(s)),
      tryRecId
    );
    const recoveredPubKeyPoint = sig.recoverPublicKey(signingHash);
    
    console.log(`\nrecId = ${tryRecId}:`);
    console.log("  recoveredPubKeyPoint type:", typeof recoveredPubKeyPoint);
    if (recoveredPubKeyPoint) {
      console.log("  constructor name:", recoveredPubKeyPoint.constructor.name);
      console.log("  keys:", Object.keys(recoveredPubKeyPoint));
      if (recoveredPubKeyPoint.toHex) {
        console.log("  toHex function exists!");
      }
    }
    
    // Obter em formato sem compressão (64 bytes, sem prefixo 0x04)
    const hexStr = recoveredPubKeyPoint.toHex(false);
    const recoveredEcdsaPubKeyBytes = hexToBytes(hexStr).subarray(1);
    
    // Concatenar com ML-DSA-44 public key
    const combinedPubKeyBytes = concatBytes(recoveredEcdsaPubKeyBytes, mldsaPubKey);
    const hash = keccak_256(combinedPubKeyBytes);
    const recoveredAddress = "0x" + bytesToHex(hash.slice(-20));
    
    const isExpected = recoveredAddress === expectedSender;
    const isBesu = recoveredAddress === besuRecovered;
    
    console.log(`\nTestando recId = ${tryRecId}:`);
    console.log("  -> Endereço recuperado:", recoveredAddress);
    if (isExpected) console.log("  🌟 ENCONTROU O ENDEREÇO ESPERADO (METAMASK)!");
    if (isBesu) console.log("  ⚠️  ENCONTROU O ENDEREÇO RECUPERADO PELO BESU!");
    
  } catch (e) {
    console.log(`Erro ao testar recId = ${tryRecId}:`, e.message);
  }
}
