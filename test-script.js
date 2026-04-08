const fs = require('fs');
const crypto = require('crypto');
const nacl = require('./node_modules/tweetnacl/nacl.js');
const WebSocket = require('ws');
const socket = new WebSocket('ws://148.230.87.184:18789/');
socket.on('open', () => {});
socket.on('message', (msg) => {
  const data = JSON.parse(msg);
  fs.appendFileSync('ws-test6.txt', JSON.stringify(data) + '\n');
  if(data.event === 'connect.challenge') {
    const keypair = nacl.sign.keyPair();
    const deviceId = crypto.createHash('sha256').update(keypair.publicKey).digest('hex');
    const ts = Date.now();
    const payload = 'v3|' + deviceId + '|test|cli|client||' + ts + '|IJ3BFuj-Bpi08ND46yC9DRrZTFgTfmFV4fEH9uX9Q38|' + (data.params.nonce || data.params.challenge?.nonce) + '|macos|desktop';
    const sig = nacl.sign.detached(Buffer.from(payload), keypair.secretKey);
    const b64Sig = Buffer.from(sig).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    socket.send(JSON.stringify({
      type: 'req',
      method: 'connect',
      id: 'pairing-test',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: { id: 'test', version: '1.4.2', mode: 'cli', platform: 'macos', deviceFamily: 'desktop' },
        auth: { bootstrapToken: 'IJ3BFuj-Bpi08ND46yC9DRrZTFgTfmFV4fEH9uX9Q38' },
        device: {
          id: deviceId,
          publicKey: Buffer.from(keypair.publicKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
          signature: b64Sig,
          signedAt: ts,
          nonce: data.params.nonce || data.params.challenge?.nonce
        }
      }
    }));
  } else {
    process.exit(0);
  }
});
socket.on('error', (err) => {
  process.exit(1);
});
