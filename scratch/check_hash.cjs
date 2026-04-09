const crypto = require('crypto');
const pub = "-RNhjBKZKn-LBemgOrHelWYDa0y8_6eCO6IMmrSpoOE";
const buf = Buffer.from(pub.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const hash = crypto.createHash('sha256').update(buf).digest();
const b64 = hash.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
console.log(`Pub: ${pub}`);
console.log(`Hash (B64-URL): ${b64}`);
