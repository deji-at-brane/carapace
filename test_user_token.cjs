const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const HOST = "148.230.87.184:18789";
const TOKEN = "axle-749E25C6-2D4E-4C45";

const urlSafe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function runTest() {
  console.log(`[TESTING] Token: ${TOKEN}`);
  
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${HOST}/`);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: "req",
        method: "connect",
        id: "v3-test",
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
      console.log(`[GATEWAY] Incoming: ${JSON.stringify(msg)}`);
      
      if (msg.event === "connect.challenge") {
        const { nonce, ts } = msg.payload;
        const kp = nacl.sign.keyPair();
        const pub = kp.publicKey;
        // In the app we do SHA256 Hex
        const deviceId = crypto.createHash('sha256').update(pub).digest('hex');
        
        const payload = [
          'v3', deviceId, 'openclaw-macos', 'cli', 'operator', '', ts.toString(), TOKEN, nonce, 'macos', 'desktop'
        ].join('|');
        
        console.log(`[CLIENT] Signing Payload: ${payload}`);
        
        const signature = urlSafe(Buffer.from(nacl.sign.detached(Buffer.from(payload), kp.secretKey)).toString('base64'));
        
        ws.send(JSON.stringify({
          type: "req",
          method: "connect.proof",
          id: "v3-proof",
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
      } else if (msg.type === "res" && msg.id === "v3-proof") {
        if (msg.payload && msg.payload.ok) {
          console.log(`[SUCCESS] Gateway Accepted Pairing!`);
        } else {
          console.log(`[FAILED] Gateway Refused: ${JSON.stringify(msg.error)}`);
        }
        ws.close();
        resolve();
      }
    });

    ws.on('error', (err) => {
      console.log(`[ERROR] WS Error: ${err.message}`);
      resolve();
    });

    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        console.log("[TIMEOUT] Gateway did not respond");
        ws.close();
        resolve();
      }
    }, 10000);
  });
}

runTest();
