const { secp256k1 } = require("@noble/curves/secp256k1.js");
const { keccak_256 } = require("@noble/hashes/sha3");
const fs = require('fs');

const rawHex = "0x44f91e058200608416bfadfa808080830f424094124c77c547626044e2c9e25aed558a361d37e0918080c0f90f00b90efd01f90ef98200608416bfadfa94000000000000000000000000000000000000555580b9052090513d90fbb88b95fc0afb2aaa7f5829540095a3e0ca21e5342a1c7e475dc09bc5b83014f8e417a0e5f549c88f1906aa3765827aa0fdb4c91fd366cd06870a111998542503dcfb622da9c148e606513eb10be9f6b452fdb47204c1872f250344472ffc8058a8764045e4c114252c29d1e8436b242087957f823e3c4958d5da6305f992748edcd1408543b3ef6c959904129ae1d1201571cd06267afec56547b518be5d1cf0c4b38951fcdd15eaa17bbd1ed9b33815fd8ed65b890d736ec81921adeef6a5163c8a708d52e38594171f2465ceaaaef18c6f0ddcd2baf3880dad4c476ca2b60e6b433053984379f178d18ff6f9659d3aed171c9a0ffc888451308c55825ac88a9122b1041ec3e66d4e1e7fdf487acd53ed67d08133fd2bfe7ccc7123afc55008c9ad5f40345689dc242315ae0555d83b3acac3408d3dfc2e5c5beb899c21918b5daade572f1902e1e5db2f30d9b9a5dba0351a67d5a5bd675e25bb20d6420efe5eb8f3684f8110de3870d720d8f26e4153d949a3346dedd5cb1281717489674b2490913d243fb41f247d5a9c0751c1bb4059d58990a113bb4d0728e1bd660e4c9c6a058ef3d75170bfa61de3e8d4695abaaf70ad564e68d96ebcfdb6cb3bc327dfd673b406cbe02b6b08e9e7f859eeaf591d20604adbcf60b869734c08fdc8b7d424c2e473e3f10aeb40557e5ac9d234d8fe149c92fae94d6150239bf42d84926f812e4c0966a70ee9776e70e3dcfbd32dba3acc3bec1c939aa8751c24fa74ba965f4b9af8be576872c7a7d3ed0c3762e55706c834b4cce043572528bef37ed237c4c948dae4af265db142916bae9d1681aacf9c540e9e32a06a7c41719ce571b7a77b90af2e8f96e7bd1cbcfac1f8a8ae46adb0a5edc799f42d4bab2e8c8d31cd487db445683e7871f2c25a845ac7a81b47c7ca0b73ec762f2215af7be33ddd8317fb648a1d1f9f18fe8e505ec941bd0e5b602434d836dfac5fb2325376307a28df627bfb3409741cda5bc49f9ac38284c2fbf4c819238c149b0cbb6ef739ecc36a26e6f959515f64f0298ba71a46e7f8cc6b403677c1f50532387b2832f2962b560212f94921c11347dfd640896705ec3f941400bb0d0ea36039e36aea0f5710066aa213759fb41aa8463b397a3cf9f6810f7e12254c4bc453f851d11589fdc0aff15f48d2a728d12cf781e0b8d7dde3ec226bbb701a2ac14d4e8618e1069769d6d4297357c92c95c4ae27fa1a3526dff4a64e6e64cf511271e51fc795e80cf6730c3294966b11487ad8c10f966fa8aed5b18ed971cd87513cb14adb1e3d6c34b5a253eb70995f34a2e657f2b34d22342a0e986c5e618da5587966f602be1ae9fc0b71766d8eed52b517e73f7c812d6e3dfc8a959412019805e7056e2c4e2fa4788c10c6dabb69fde5dc31b5727cad59c87c55680f92b543fbf86830ef7cd6de1af9198c5059b36ac1195ed0d08ad971099615f588c0f15f4e7895bb75fe503ae26575f55eb08c318a29b7fe56b241f1c43f1e7620c119e0cffc3e2c4b7911a44433e0bd2c5ea3304426d868f9d45fb2f21ec9d2a83f2b5f80a785da2bb1f56d8ccdc722aff53320cff9e9d997066bcef99db900d87a7870b2fcc816c515fa318f26f15e48d0f934019f5016868138e768131a42525150d06bba085307d7d1baa43b1bd0c9b817617ce3b001a5fb8d11a44d61f68c0ab97dc682fd7e3a876eb32f017632f4a2722d3db34f0dacb3c2d5aabe12fbbd35f32ddc0bb774719169b3114df0e90a1c19128cd28a2d48f528188dc5ef5671b22cc420361ca5338b7f76dafa9d34abf323a8d1e2ca349b94c5313df713b1f087b081751db909b55395a9554cd582511e4f5cbcc188dfd9b807a4142108b9e63ef965588eb6ebe81a0cf2a136aec0b641e6d5831840e34330279eb6b7376c0af0e02dc47effb02b00812b9293c96c14c06f45ece018a37e95665b2f3067794d450c09d838337cd0d66c9af2017f51cbc5326090be7f2d986706e9b2f916cd5b68339ad3e0e65ba2104d6cf811715afb95ea3711e804a3a126541ab8023daf605567d4db8f4b677a4540364967d51ade6e3f603992bcef953f12e2af9e32318287e7787ff87801649825b899febc661af61b2a3a10431d03dee650cd5f9e65cd2f50337e45e2474cd7afdb85663473f45eb57907943fbd1b2cfae6a54088e785bd875b3df8b7d3ecef496cbde273ef9d61a782996a868fb858ea5d5eda3f4c3fe7e4a7ad3ce36cf574075beadf634b41703e3c8a1b572618e76e6f0a14d82060260596d890db4676a3a8dacc6d2a8c718861333516f0870a11b8c6623eadcdd652fc8eaa2ca1a0b72b693c5fc14f7d11d5ad8ef0f34299b0d18834d5635fa2662a5e72aaf5724c331c58ab81e079a01efdf046c010869ccd4797e681fe54d91eb0d565c9b4f543de913940f59c4e91c6f19acc43f6eccc29c041e25525156ea59d10b82bd18c4b962ba0a8aca1f65902575f6ae568646240994dbbf1966eae2cb219304e62fdc965c059e73e513c2369380e28ddf81a293cf063a1450d190f8e1001866f75a1159c44171565f721f82c24299bb60afba6a46f632f06e692f70d639c795168acf21896d7a9a24c0aae9d645c635727b14cdd2b28110a976305feb0726b3a67615f4b8cb4e6b3b0ad41018dd34d44df9809142e940e50963a6cc3c8bc1d03a78900704271b7fd652de0cd27ccebd271e366fb48ca333e498b984a8b84e96a027cdac00e6d0f62616675f16531eeb89939b2a910caeb7fded7518ba7061ad1c35a14c1e8c7e8f4e461854f4dd92e1cb501529a4e34d353e52b503c13485ba88de90ad8ff77fedc4485987eaf4184a2a77dc71ba3505c00f08a96cb3a2bdb6222ce3e3adfe067d9308366936acf074cc651546f9aef47851e0a2f2a070818e1ae7df7367a94e8fe829948e47ec53e719404abfe4cdf18eba4984c27f792325f202f0c1d1a804adf53853682ff254229c8e5e7cabb06e07dc6fcd4942148875515590a42fb04ac6bbc3abee0796202307c90122b0104ac2b031340a1d9d9615f3c79b12c0bbefa7c1e2c1c1e0b2e9c4b31ab278080542baf93fe93d0d83fbf8f11bd8d19151933749f075c98158a4bf00512b4a21cf072b3a621d17a214405ab67d8c4152fb4aa48c55db46fbb13ca893313fde77561ed75cdbfac56a471b4b8665bf4c50901b73037c3305016c2a51495ae914b682ca26852c01ab91155306575f7b06fe186add27578b9d200b82d53da0de37a8e0d265c8a104ab92fedd53fb84c9f11f591e5f982152d0217b52f3bfbbc5e39b4f2465470bc7a059555ed77c7d1f494d422a514fa4ec184bd2e67271008c2f76c90a1dc76d20ca26d03474107a5ef4d288d8831f2c4808080909068946c5c5d6c47f87582f64dbeea5f37cd0e65785ccc1d7e99a3d40be84f6e2f0d4173ee5261f700098bbc1fedb0070ab3c60c580f66b767c4ce4558c3a14e92ed4dabd91cbdfe5c318227425fce31cc795f31031af335b69f91bcbabe5d4530b0409dc30f1e05e7971c408b34d2a72e7a00bcf4f2c628cce07988d20eae6688b2b60c53a5f74fed8c23c09eec478795544aeab705314b1af8c46dd576412c4ba9c4e60f7e076a2bad668d17e05e19eb7f3f494508d1f3d4ef00f7545b3bae6e5079f1884081efc2ec25110dee11199071cc3078aa14c56835faa622a999f568d69f2376e06ab83edf8454859ab61341b430ea5aca980dea606499f3d83b9d32b0942910fc144b39e027865230ed08301a846c9b6cf87186e20f43cb4725b659d124c26422762807dd4e663ff58fb9bbab567ea825974b0090cbeee14f100d65f4e566b976f33d3c06f5123e892ad713e39d05562960f94393150a203f0ab8d5ccae9600b6d71df2f07fe413d0317cf563aa7ae7dc8b71f19660fab3367e663de7246a1d83ae209d94d3bc5aa634806212a5ff81f0cd54d97f2edfca4a0e58153b4bda979c30e5cfe287261f2460d4a9f546eaca06a97c4a327933590b95cc8bb28fdde4631a6ec50f552c7402034caf2514715b40d9466f7543da8eca60af5e0b22f58d86b9114209805c4f74d773fc9d23af70759238024d1f3bd44628afda1031f565cbc7438233202d7555a93930ef181a54e5982ce3d616597f81439a0deafc99c2a26281347960db1ccc5dc5ffec694f1a16cc049326142b93e28633303d60209d91a9487b9d7fb32cdb46e37104b1be5dc88a7c57e3ef22b61f456f63017c849829487ba864787476cd50b64752145c60af3fe305eaf861531da6d93b6530821d79e0b8ce83a8ebcb37c077375e85223e611d0515fe53526871f2cb0cc93d2935e8d9655330602dbee37f49722cb3b1a90dbba0ea575cbddcc71ed973a03e8e154b986ecd82d16ceb971cd1be40101eba414714bcb95735b580219b4002a65aefbb799256dc98230d173af263faa12825b9ebdf34afd98e61f4c73fecf79ca0ae15be0d09de32de104eb18a8793365b787e7f5a165f7a4111d5d282b2db046c9cc3bbe5391a7dfbb6a6518bdd6b9f4a9e61d09ddfd5b56353d41c31fafc04cbbffd71cf94cae15e565b8b7bc38c86380a20ef303ddc28a74b906d44e76d9bd2ca207ba571cf93ebf14279fa8a9a43a72eb26502f27e09d27fda24c7d6b32fdfb4652f31da15bca1ecccb1dae0412909b56809f477b4c965af4ff6dd8015ef8586acc4a29ec170bbf86d28c43c01cbcccb147d37ae0e2dbfe00c8714ebcb3e77b2e7a13a358d05afd16bef7130d02bcba349eee0d65ab47154cca1cb2c3d64763b309f2dc23b5413e762315427e9a4aedb33c9355a01e341c120ce7aae191689734c2463bbcc43786d9770b16b94e56e6bb1e98e8e0845aed3883233441ab5a4bffcec367a64e0e3148620b5828fa4eb728ad86fa22312e273151da1af4deae60ccc3bac21cdb25d237bf966c343416d972ee7f106737ccf079529d1879422f1f8f1228221487f760aa5eb4eec43ce0c663719a7c3a6dfcda9e81bb50bd4bfb7d05eb96ccd7f47db9689c80b0adc07ae0ceb7b74c07756787815a4eac8bb1cebf814b87bfb80f8aec96a71ebd22a51d2cec3d0409a49a596b812323ec595b7a869d0448b1e4210b996a3cd26f2faea18422f5423cf3691ef0efd72a275e974f182fec3cbfba6d53f9a8b1dfbd40da90ea9b3553436575a187d92ae1ef783b36bafeea90d6ee0af4e20319c9af51e87ffbbe322586d92b0b2d3ebf9122025272b2f3e52556065686a72969eaebdc3c4cbff101516313244516b86b1bfc2dbde2c3e42535d8eb3b7cbd30000000000000000000000000000000000000000000000000000081e2c36";

const bytes = Buffer.from(rawHex.startsWith("0x") ? rawHex.slice(2) : rawHex, "hex");

let out = "";
function log(...args) {
  out += args.join(" ") + "\n";
}

log("==================================================");
log("ANALISANDO TRANSAÇÃO REAL (Tamanho Total: " + bytes.length + " bytes)");
log("==================================================");

let offset = 0;
const prefixType = bytes[offset++];
log("Prefix Byte (Type):", "0x" + prefixType.toString(16));

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

function parseRLPList(buf) {
  let off = 0;
  const items = [];
  while (off < buf.length) {
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
    } else if (prefix <= 0xf7) {
      len = prefix - 0xc0;
      start = off;
    } else if (prefix <= 0xff) {
      const lenCount = prefix - 0xf7;
      for (let k = 0; k < lenCount; k++) {
        len = (len << 8) + buf[off++];
      }
      start = off;
    }
    items.push(buf.slice(start, start + len));
    off = start + len;
  }
  return items;
}

// O primeiro item do RLP (após o byte 0x44) é a lista inteira da transação
let listPayload = bytes.slice(1);
const prefix = listPayload[0];
if (prefix >= 0xc0 && prefix <= 0xf7) {
  listPayload = listPayload.slice(1);
} else if (prefix >= 0xf8) {
  const lenCount = prefix - 0xf7;
  listPayload = listPayload.slice(1 + lenCount);
}

const fields = parseRLPList(listPayload);

log("Total de campos na lista principal:", fields.length);
fields.forEach((f, idx) => {
  log(`Campo ${idx}: ${f ? f.length : 0} bytes`);
});
fs.writeFileSync("packages/snap/result.log", out);

const mldsaPubKey = fields[11];
const fullSignature = fields[12];
const classicSig = fullSignature.slice(0, 65);
const r = classicSig.slice(0, 32);
const s = classicSig.slice(32, 64);
const v = classicSig[64];
const recId = v >= 27 ? v - 27 : v;

log("\nAssinatura SECP256K1:");
log("R:", r.toString("hex"));
log("S:", s.toString("hex"));
log("V:", v, "(recId:", recId + ")");

const rawField10 = fields[10];

const innerAuthPayload = rawField10.slice(1);
const innerItems = parseRLPList(innerAuthPayload);
const signingAuthRlp = encodeRLP([ Buffer.from([0x01]), ...innerItems ]);
const signingAuthBytes = Buffer.concat([ Buffer.from([0x01]), signingAuthRlp ]);

const p1_fields = fields.slice(0, 12);
p1_fields[10] = [ signingAuthBytes ];

const preimage1 = Buffer.concat([Buffer.from([0x44]), encodeRLP(p1_fields)]);
const hash1 = keccak_256(preimage1);
log("\nHASH DE ASSINATURA GERADO DA TRANSAÇÃO REAL (0x44):", Buffer.from(hash1).toString("hex"));

for (const testV of [0, 1]) {
  try {
    const rBig = BigInt("0x" + r.toString("hex"));
    const sBig = BigInt("0x" + s.toString("hex"));
    const sigObj = new secp256k1.Signature(rBig, sBig, testV);
    const recoveredKey = sigObj.recoverPublicKey(hash1);
    const recoveredHex = recoveredKey.toHex(false).slice(2);
    
    // Endereço ECDSA puro (sem ML-DSA)
    const ecdsaOnlyAddr = "0x" + Buffer.from(keccak_256(Buffer.from(recoveredHex, "hex")).slice(-20)).toString("hex");
    log(`[recId=${testV}] Endereço ECDSA puro:`, ecdsaOnlyAddr);

    // Endereço Híbrido (ECDSA + ML-DSA)
    const combined = Buffer.concat([Buffer.from(recoveredHex, "hex"), mldsaPubKey]);
    const addr = "0x" + Buffer.from(keccak_256(combined).slice(-20)).toString("hex");
    log(`[recId=${testV}] Endereço Híbrido recuperado:`, addr);
  } catch (e) {
    log(`[recId=${testV}] Erro:`, e.message);
  }
}

fs.writeFileSync("packages/snap/result.log", out);
