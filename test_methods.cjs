const fs = require('fs');
const crypto = require('crypto');
const nacl = require('./node_modules/tweetnacl/nacl.js');
const WebSocket = require('ws');

const methods = ['connect', 'pair', 'register', 'bootstrap', 'auth', 'init'];
let i = 0;

function testNext() {
  if (i >= methods.length) {
    process.exit(0);
  }
  const method = methods[i++];
  const socket = new WebSocket('ws://148.230.87.184:18789/');
  let resolved = false;
  socket.on('open', () => {});
  socket.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.event === 'connect.challenge') {
      const keypair = nacl.sign.keyPair();
      const deviceId = crypto.createHash('sha256').update(keypair.publicKey).digest('hex');
      const ts = Date.now();
      const payload = 'v3|' + deviceId + '|node-host|cli|client||' + ts + '|8CaAdK7eWz9XqrORO4iUXj_hkPW3xIa-O5fTTvbxkJk|' + (data.payload.nonce) + '|macos|desktop';
      const sig = nacl.sign.detached(Buffer.from(payload), keypair.secretKey);
      const b64Sig = Buffer.from(sig).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      socket.send(JSON.stringify({
        type: 'req', method: method, id: 'pairing-final',
        params: {
          minProtocol: 3, maxProtocol: 3,
          client: { id: 'node-host', version: '1.4.2', mode: 'cli', platform: 'macos', deviceFamily: 'desktop' },
          auth: { bootstrapToken: '8CaAdK7eWz9XqrORO4iUXj_hkPW3xIa-O5fTTvbxkJk' },
          device: { id: deviceId, publicKey: Buffer.from(keypair.publicKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), signature: b64Sig, signedAt: ts, nonce: data.payload.nonce }
        }
      }));
    } else {
      console.log('[' + method + '] RESPONSE:', JSON.stringify(data));
      resolved = true;
      socket.close();
      testNext();
    }
  });
  socket.on('error', () => {
    if (!resolved) {
      resolved = true;
      testNext();
    }
  });
}
testNext();
