const WebSocket = require('ws');
const nacl = require('tweetnacl');

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4";

const keypair = nacl.sign.keyPair();
const publicKeyBase64 = Buffer.from(keypair.publicKey).toString('base64');
const D = publicKeyBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const B = bootstrapToken;

let currentVar = 0;

function runVar() {
  const ws = new WebSocket(`ws://${gatewayUrl}/`, { headers: { 'Origin': 'http://localhost:1425' } });
  
  ws.on('open', () => console.log(`Testing VAR ${currentVar}...`));
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.event === "connect.challenge") {
      const N = msg.payload.nonce;
      const T = msg.payload.ts.toString();
      
      const vars = [
        // 0: Original exact match from crypto.ts (with operator role)
        [ 'v3', D, 'openclaw-macos', 'cli', 'operator', '', T, B, N, 'macos', 'desktop' ].join('|'),
        // 1: Empty role
        [ 'v3', D, 'openclaw-macos', 'cli', '', '', T, B, N, 'macos', 'desktop' ].join('|'),
        // 2: Empty token
        [ 'v3', D, 'openclaw-macos', 'cli', 'operator', '', T, '', N, 'macos', 'desktop' ].join('|'),
        // 3: Empty token and role
        [ 'v3', D, 'openclaw-macos', 'cli', '', '', T, '', N, 'macos', 'desktop' ].join('|'),
        // 4: Token at end?
        [ 'v3', D, 'openclaw-macos', 'cli', '', '', T, N, 'macos', 'desktop', B ].join('|'),
        // 5: Role is "user"
        [ 'v3', D, 'openclaw-macos', 'cli', 'user', '', T, B, N, 'macos', 'desktop' ].join('|'),
        // 6: No deviceFamily or platform
        [ 'v3', D, 'openclaw-macos', 'cli', '', '', T, B, N ].join('|')
      ];
      
      if (currentVar >= vars.length) {
        console.log('Finished bruteforce');
        process.exit(0);
      }
      
      const sigString = vars[currentVar];
      const signatureArray = nacl.sign.detached(Buffer.from(sigString), keypair.secretKey);
      const signatureB64 = Buffer.from(signatureArray).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      ws.send(JSON.stringify({
        type: "req", method: "connect",
        params: {
          minProtocol: 3, maxProtocol: 3,
          client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" },
          auth: { token: B },
          device: { id: D, publicKey: D, signature: signatureB64, signedAt: msg.payload.ts, nonce: N }
        },
        id: "c1"
      }));
    } else if (msg.id === "c1") {
      console.log(`VAR ${currentVar} Result:`, msg.error ? msg.error.message : 'SUCCESS!');
      ws.close();
    }
  });

  ws.on('close', () => {
    currentVar++;
    setTimeout(runVar, 500);
  });
}

runVar();
