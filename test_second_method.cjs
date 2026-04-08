const fs = require('fs');
const crypto = require('crypto');
const nacl = require('./node_modules/tweetnacl/nacl.js');
const WebSocket = require('ws');

const methods = ['pair', 'pairing', 'register', 'auth', 'submit', 'connect', 'verify', 'confirm'];
let i = 0;

function testNext() {
  if (i >= methods.length) {
    process.exit(0);
  }
  const method = methods[i++];
  const socket = new WebSocket('ws://148.230.87.184:18789/');
  let resolved = false;
  socket.on('open', () => {});
  
  let keypair, deviceId, ts;

  socket.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.event === 'connect.challenge') {
      keypair = nacl.sign.keyPair();
      deviceId = crypto.createHash('sha256').update(keypair.publicKey).digest('hex');
      ts = Date.now();
      const payload = 'v3|' + deviceId + '|node-host|cli|client||' + ts + '|IJ3BFuj-Bpi08ND46yC9DRrZTFgTfmFV4fEH9uX9Q38|' + (data.payload.nonce) + '|macos|desktop';
      const sig = nacl.sign.detached(Buffer.from(payload), keypair.secretKey);
      const b64Sig = Buffer.from(sig).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      socket.send(JSON.stringify({
        type: 'req', method: 'connect', id: 'pairing-final',
        params: {
          minProtocol: 3, maxProtocol: 3,
          client: { id: 'node-host', version: '1.4.2', mode: 'cli', platform: 'macos', deviceFamily: 'desktop' },
          auth: { bootstrapToken: 'IJ3BFuj-Bpi08ND46yC9DRrZTFgTfmFV4fEH9uX9Q38' },
          device: { id: deviceId, publicKey: Buffer.from(keypair.publicKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), signature: b64Sig, signedAt: ts, nonce: data.payload.nonce }
        }
      }));
    } else if (data.ok === false && data.id === 'pairing-final') {
      // Connect failed. Send the second method!
      socket.send(JSON.stringify({
        type: 'req', method: method, id: 'pairing-real',
        params: {
          minProtocol: 3, maxProtocol: 3,
          client: { id: 'node-host', version: '1.4.2', mode: 'cli', platform: 'macos', deviceFamily: 'desktop' },
          auth: { bootstrapToken: 'IJ3BFuj-Bpi08ND46yC9DRrZTFgTfmFV4fEH9uX9Q38' },
          device: { id: deviceId, publicKey: Buffer.from(keypair.publicKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), signature: Buffer.from(nacl.sign.detached(Buffer.from('v3|'+deviceId+'|node-host|cli|client||'+ts+'|IJ3BFuj-Bpi08ND46yC9DRrZTFgTfmFV4fEH9uX9Q38|'+data.payload?.nonce+'|macos|desktop'), keypair.secretKey)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), signedAt: ts, nonce: data.payload?.nonce || 'none' }
        }
      }));
    } else if (data.id === 'pairing-real') {
      console.log('[' + method + '] RESPONSE:', JSON.stringify(data));
      resolved = true;
      socket.close();
      testNext();
    }
  });
  
  socket.on('close', () => {
    if (!resolved) {
      console.log('[' + method + '] WEBSOCKET CLOSED BY SERVER!');
      resolved = true;
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
