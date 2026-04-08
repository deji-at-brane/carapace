const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const HOST = "148.230.87.184:18789";
const RAW_TOKEN = "8B7C-4D2E-9F1A";

const urlSafe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function runTest(tokenPrefix, clientId) {
  const token = `${tokenPrefix}${RAW_TOKEN}`;
  console.log(`\n[TESTING] Prefix: "${tokenPrefix}", Client: "${clientId}"`);
  
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${HOST}/`);
    let solved = false;

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: "req",
        method: "connect",
        id: "v3-test",
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: { id: clientId, mode: "cli", platform: "macos", deviceFamily: "desktop" },
          auth: { bootstrapToken: token },
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
          'v3', deviceId, clientId, 'cli', 'operator', '', ts.toString(), token, nonce, 'macos', 'desktop'
        ].join('|');
        
        const signature = urlSafe(Buffer.from(nacl.sign.detached(Buffer.from(payload), kp.secretKey)).toString('base64'));
        
        console.log(`[CHALLENGE] ts: ${ts}, Signing...`);
        ws.send(JSON.stringify({
          type: "req",
          method: "connect.proof",
          id: "v3-proof",
          params: {
            auth: { bootstrapToken: token },
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
        const ok = msg.payload && msg.payload.ok;
        console.log(`RESULT: ${ok ? "PASS" : "FAIL"} | Prefix: ${tokenPrefix} | Client: ${clientId}`);
        ws.close();
        resolve(ok);
      }
    });

    ws.on('error', (err) => {
      console.log(`[ERROR] WS Error: ${err.message}`);
      resolve(false);
    });

    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        console.log("[TIMEOUT] Gateway did not respond in 5s");
        ws.close();
        resolve(false);
      }
    }, 5000);
  });
}

async function main() {
  const prefixes = ["axle-", "axle_"];
  const clients = ["openclaw-macos", "carapace"];
  const results = [];
  
  for (const p of prefixes) {
    for (const c of clients) {
      const ok = await runTest(p, c);
      results.push(`Prefix: ${p} | Client: ${c} | Status: ${ok ? "PASS" : "FAIL"}`);
    }
  }
  
  console.log("\n=== FINAL MATRIX RESULTS ===");
  results.forEach(r => console.log(r));
}

main();
