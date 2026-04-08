const fs = require('fs');
const WebSocket = require('ws');
const socket = new WebSocket('ws://148.230.87.184:18789/');
socket.on('open', () => {});
socket.on('message', (msg) => {
  const data = JSON.parse(msg);
  if (data.event === 'connect.challenge') {
    socket.send(JSON.stringify({
      type: 'req', method: 'connect', id: 'pairing-authless',
      params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: 'node-host', version: '1.4.2', mode: 'cli', platform: 'macos', deviceFamily: 'desktop' },
        device: { id: '00', publicKey: '00', signature: '00', signedAt: 0, nonce: data.payload.nonce }
      }
    }));
  } else {
    console.log(JSON.stringify(data));
    process.exit(0);
  }
});
