const WebSocket = require('ws');
const nacl = require('tweetnacl');

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "RjniA3B5fgxwV4ivalhT6LT-vK-k-LARUFPuW0Sv6jk";

// -------------------------------------------------------------
// VITAL FIX: The bootstrapToken is ACTUALLY the 32-byte Ed25519 
// cryptographic seed assigned to this specific device by the 
// Gateway admin during URI generation! We must derive the exact
// deterministic keypair assigned to this token, NOT a random one!
// -------------------------------------------------------------
const seedBytes = Buffer.from(bootstrapToken.replace(/-/g, '+').replace(/_/g, '/') + '===', 'base64').slice(0, 32);
const keypair = nacl.sign.keyPair.fromSeed(seedBytes);
const publicKeyBase64 = Buffer.from(keypair.publicKey).toString('base64');
const deviceId = publicKeyBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const ws = new WebSocket(`ws://${gatewayUrl}/`, { headers: { 'Origin': 'http://localhost:1425' } });

ws.on('open', () => console.log(`Connected. Using Deterministic DeviceID: ${deviceId}`));
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.event === "connect.challenge") {
    
    // Using standard schema components
    const signaturePayload = [
      'v3', deviceId, 'openclaw-macos', 'cli', 'operator', '', msg.payload.ts.toString(), bootstrapToken, msg.payload.nonce, 'macos', 'desktop'
    ].join('|');
    
    console.log('[SIGNING PAYLOAD]', signaturePayload);
    const signatureB64 = Buffer.from(nacl.sign.detached(Buffer.from(signaturePayload), keypair.secretKey)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    ws.send(JSON.stringify({
      type: "req", method: "connect",
      params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" },
        auth: { token: bootstrapToken },
        device: { id: deviceId, publicKey: deviceId, signature: signatureB64, signedAt: msg.payload.ts, nonce: msg.payload.nonce }
      },
      id: "c1"
    }));
  } else if (msg.id === "c1") {
    console.log(JSON.stringify(msg, null, 2));
    process.exit(0);
  }
});
