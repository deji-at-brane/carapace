const fs = require('fs');
const WebSocket = require('ws');
const socket = new WebSocket('ws://148.230.87.184:18789/');
socket.on('open', () => {});
socket.on('message', (msg) => {
  const data = JSON.parse(msg);
  if (data.event === 'connect.challenge') {
    socket.send(JSON.stringify({
      type: 'req', method: 'connect', id: 'pairing',
      params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: 'node-host', version: '1.4.2', mode: 'cli', platform: 'macos', deviceFamily: 'desktop' },
        auth: { bootstrapToken: '8CaAdK7eWz9XqrORO4iUXj_hkPW3xIa-O5fTTvbxkJk' },
        device: { id: '0000000000000000000000000000000000000000000000000000000000000000', publicKey: '0000', signature: '0000', signedAt: 0, nonce: data.payload ? data.payload.nonce : 'none' }
      }
    }));
  } else {
    if (data.ok === false) {
      console.log('ERROR IS:', data.error.message);
    }
    process.exit(0);
  }
});
socket.on('error', () => process.exit(1));
