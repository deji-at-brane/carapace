const fs = require('fs');
const WebSocket = require('ws');

const clientIds = [
  'carapace-terminal', 'openclaw-js', 'test-client', 'openclaw-js-cli', 
  'axle-master', 'openclaw-axle-official', 'test', 'node-host', 'node-client', 'openclaw-axle'
];

let tasks = [];

for (const id of clientIds) {
  // Option A: Minimalist
  tasks.push({
    name: `${id} (Minimalist)`,
    client: { id: id, version: '1.4.2', mode: 'cli', platform: 'windows', deviceFamily: 'desktop' }
  });
  
  // Option B: Minimalist with Macos
  tasks.push({
    name: `${id} (Minimalist Macos)`,
    client: { id: id, version: '1.4.2', mode: 'cli', platform: 'macos', deviceFamily: 'desktop' }
  });

  // Option C: Enriched
  tasks.push({
    name: `${id} (Enriched)`,
    client: { id: id, name: 'OpenClaw Terminal', role: 'client', platformName: 'Windows', version: '1.4.2', mode: 'cli', platform: 'windows', deviceFamily: 'desktop' }
  });
}

let i = 0;

function runNext() {
  if (i >= tasks.length) {
    console.log('--- FUZZING COMPLETE ---');
    process.exit(0);
  }

  const task = tasks[i++];
  const socket = new WebSocket('ws://148.230.87.184:18789/');
  let resolved = false;

  socket.on('open', () => {});

  socket.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.event === 'connect.challenge') {
      const nonce = data.payload ? data.payload.nonce : 'unknown';
      socket.send(JSON.stringify({
        type: 'req', method: 'connect', id: 'pairing',
        params: {
          minProtocol: 3, maxProtocol: 3,
          client: task.client,
          auth: { bootstrapToken: 'IJ3BFuj-Bpi08ND46yC9DRrZTFgTfmFV4fEH9uX9Q38' },
          device: { id: '0000000000000000000000000000000000000000000000000000000000000000', publicKey: '0000', signature: '0000', signedAt: 0, nonce: nonce }
        }
      }));
    } else {
      if (data.ok === false) {
        const err = data.error ? data.error.message : 'none';
        if (!err.includes('must be equal to constant')) {
          console.log(`\n==========================================`);
          console.log(`[SUCCESS] Passed Schema Validation: ${task.name}`);
          console.log(`[RESPONSE] ${err}`);
          console.log(`==========================================\n`);
          fs.appendFileSync('fuzz-success.txt', `[${task.name}] ERROR: ${err}\n`);
        } else {
          // Schema validation failed, which is expected for wrong ids/formats
          process.stdout.write('.');
        }
      }
      resolved = true;
      socket.close();
      runNext();
    }
  });

  socket.on('error', (err) => {
    if (!resolved) {
      resolved = true;
      runNext();
    }
  });
}

console.log(`Starting fuzzer against ${tasks.length} combinations...`);
if (fs.existsSync('fuzz-success.txt')) fs.unlinkSync('fuzz-success.txt');
runNext();
