const WebSocket = require('ws');
const nacl = require('tweetnacl');

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4";

const keypair = nacl.sign.keyPair();
const publicKeyBase64 = Buffer.from(keypair.publicKey).toString('base64');
const deviceId = publicKeyBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const ws = new WebSocket(`ws://${gatewayUrl}/`, { headers: { 'Origin': 'http://localhost:1425' } });

ws.on('open', () => console.log('Connected. Waiting for Challenge...'));
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.event === "connect.challenge") {
    // We explicitly omit 'operator'
    const signaturePayload = [
      'v3', deviceId, 'openclaw-macos', 'cli', '', '', msg.payload.ts.toString(), bootstrapToken, msg.payload.nonce, 'macos', 'desktop'
    ].join('|');
    console.log('[SIGNING STRING]', signaturePayload);
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
