const fs = require('fs');
const WebSocket = require('ws');
const candidates = ['openclaw-js', 'carapace-terminal', 'openclaw-axle'];
let i = 0;
function testNext() {
  if (i >= candidates.length) { console.log('Finished'); process.exit(0); }
  const id = candidates[i++];
  const socket = new WebSocket('ws://148.230.87.184:18789/');
  let resolved = false;
  socket.on('open', () => {});
  socket.on('message', (msg) => {
    const data = JSON.parse(msg);
    if(data.event === 'connect.challenge') {
      const nonce = data.payload ? data.payload.nonce : 'unknown';
      socket.send(JSON.stringify({
        type: 'req', method: 'connect', id: 'pairing',
        params: {
          minProtocol: 3, maxProtocol: 3,
          client: { id: id, name: 'OpenClaw Terminal', role: 'client', platformName: 'Windows', version: '1.4.2', mode: 'cli', platform: 'windows', deviceFamily: 'desktop' },
          auth: { bootstrapToken: 'IJ3BFuj-Bpi08ND46yC9DRrZTFgTfmFV4fEH9uX9Q38' },
          device: { id: '0000000000000000000000000000000000000000000000000000000000000000', publicKey: '0000', signature: '0000', signedAt: 0, nonce: nonce }
        }
      }));
    } else {
      if (data.ok === false) {
        console.log('[' + id + '] ERROR:', data.error ? data.error.message : 'none');
      }
      resolved = true; socket.close(); testNext();
    }
  });
  socket.on('error', () => { if (!resolved) { resolved = true; testNext(); } });
}
testNext();
