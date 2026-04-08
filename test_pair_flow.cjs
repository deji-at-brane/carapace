const fs = require('fs');
const crypto = require('crypto');
const nacl = require('./node_modules/tweetnacl/nacl.js');
const WebSocket = require('ws');

const socket = new WebSocket('ws://148.230.87.184:18789/');
socket.on('open', () => {});
let deviceId, b64Sig, ts, keypair;

socket.on('message', (msg) => {
  const data = JSON.parse(msg);
  if(data.event === 'connect.challenge') {
    keypair = nacl.sign.keyPair();
    deviceId = crypto.createHash('sha256').update(keypair.publicKey).digest('hex');
    ts = Date.now();
    const payload = 'v3|' + deviceId + '|node-host|cli|operator||' + ts + '|8CaAdK7eWz9XqrORO4iUXj_hkPW3xIa-O5fTTvbxkJk|' + data.payload.nonce + '|macos|desktop';
    const sig = nacl.sign.detached(Buffer.from(payload), keypair.secretKey);
    b64Sig = Buffer.from(sig).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    socket.send(JSON.stringify({
      type: 'req', method: 'connect', id: 'pairing-final',
      params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: 'node-host', version: '1.4.2', mode: 'cli', platform: 'macos', deviceFamily: 'desktop' },
        auth: { bootstrapToken: '8CaAdK7eWz9XqrORO4iUXj_hkPW3xIa-O5fTTvbxkJk' },
        device: { id: deviceId, publicKey: Buffer.from(keypair.publicKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), signature: b64Sig, signedAt: ts, nonce: data.payload.nonce }
      }
    }));
  } else if (data.ok === false) {
    console.log('CONNECT RESP:', JSON.stringify(data));
    socket.send(JSON.stringify({
      type: 'req', method: 'pair', id: 'pairing-real',
      params: {
        auth: { bootstrapToken: '8CaAdK7eWz9XqrORO4iUXj_hkPW3xIa-O5fTTvbxkJk' },
        device: { id: deviceId, publicKey: Buffer.from(keypair.publicKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), signature: b64Sig, signedAt: ts }
      }
    }));
  } else {
    console.log('FINAL RESP:', JSON.stringify(data));
    process.exit(0);
  }
});
socket.on('error', () => process.exit(1));
