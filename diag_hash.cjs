const nacl = require('tweetnacl');
const crypto = require('crypto');

// Generate a deterministic key for testing if possible, or just use a fixed one.
// Actually, let's just see if fbc52b81... is a common mistake hash.
// fbc52b814700d5b22a4386b44f6f427c6058b82b7f1d76747b85d06457e6c6aa

console.log('Testing hash of 32 zero bytes:');
const zero32 = new Uint8Array(32);
console.log(crypto.createHash('sha256').update(zero32).digest('hex'));

console.log('Testing hash of 64 zero bytes:');
const zero64 = new Uint8Array(64);
console.log(crypto.createHash('sha256').update(zero64).digest('hex'));
