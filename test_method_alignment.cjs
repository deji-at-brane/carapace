const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const HOST = "148.230.87.184:18789";
const TOKEN = "axle-749E25C6-2D4E-4C45";

const urlSafe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function testMethod(method) {
  console.log(`\n[TESTING] Method: "${method}"`);
  
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${HOST}/`);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: "req",
        method: "connect",
        id: "step1",
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: { id: "openclaw-macos", mode: "cli", platform: "macos", deviceFamily: "desktop" },
          auth: { bootstrapToken: TOKEN },
          device: { id: "test-device" }
        }
      }));
    });

    ws.on('message', async (data) => {
      const msg = JSON.parse(data);
      if (msg.event === "connect.challenge") {
        const { nonce, ts } = msg.payload;
        const kp = nacl.sign.keyPair();
        const pub = kp.publicKey;
        const deviceId = crypto.createHash('sha256').update(pub).digest('hex');
        
        const payload = [
          'v3', deviceId, 'openclaw-macos', 'cli', 'operator', '', ts.toString(), TOKEN, nonce, 'macos', 'desktop'
        ].join('|');
        
        const signature = urlSafe(Buffer.from(nacl.sign.detached(Buffer.from(payload), kp.secretKey)).toString('base64'));
        
        ws.send(JSON.stringify({
          type: "req",
          method: method, // Test "connect" vs "connect.proof"
          id: "step2",
          params: {
            auth: { bootstrapToken: TOKEN },
            device: {
              id: deviceId,
              publicKey: urlSafe(Buffer.from(pub).toString('base64')),
              signature: signature,
              signedAt: ts,
              nonce: nonce
            }
          }
        }));
      } else if (msg.type === "res" && msg.id === "step2") {
        console.log(`RESULT for "${method}": ${msg.payload && msg.payload.ok ? "SUCCESS" : "FAILED (" + JSON.stringify(msg.error) + ")"}`);
        ws.close();
        resolve();
      }
    });

    setTimeout(() => { ws.close(); resolve(); }, 5000);
  });
}

async function main() {
  await testMethod("connect");
  await testMethod("connect.proof");
}

main();
