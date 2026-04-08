const nacl = require('tweetnacl');
const crypto = require('crypto');

const kp = nacl.sign.keyPair();
console.log('SecretKey buffer length:', kp.secretKey.buffer.byteLength);
console.log('PublicKey buffer length:', kp.publicKey.buffer.byteLength);
console.log('PublicKey matches SecretKey tail:', kp.publicKey.buffer === kp.secretKey.buffer);

const hashedFull = crypto.createHash('sha256').update(Buffer.from(kp.publicKey.buffer)).digest('hex');
const hashedSlice = crypto.createHash('sha256').update(Buffer.from(kp.publicKey)).digest('hex');

console.log('Hashed Full Buffer:', hashedFull);
console.log('Hashed Slice (Proper):', hashedSlice);
console.log('Equal?', hashedFull === hashedSlice);
