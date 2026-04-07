const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "RjniA3B5fgxwV4ivalhT6LT-vK-k-LARUFPuW0Sv6jk";

const keypair = nacl.sign.keyPair();
const pub = keypair.publicKey;
const urlSafeB64 = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ID = SHA256 Fingerprint
const deviceId = urlSafeB64(crypto.createHash('sha256').update(pub).digest());

console.log(`[DEBUG] Final Pairing Test (Fingerprint: ${deviceId})`);
const ws = new WebSocket(`ws://${gatewayUrl}/`, { headers: { 'Origin': 'http://localhost:1425' } });

ws.on('message', (data) => {
    const raw = data.toString();
    const msg = JSON.parse(raw);
    
    if (msg.event === "connect.challenge") {
        const ts = msg.payload.ts;
        const nonce = msg.payload.nonce;

        // SIG PAYLOAD: v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily
        const signaturePayload = [
            'v3', deviceId, 'openclaw-macos', 'cli', 'operator', '', ts.toString(), bootstrapToken, nonce, 'macos', 'desktop'
        ].join('|');

        console.log("[DEBUG] Signing V3 Payload:", signaturePayload);
        const signature = urlSafeB64(nacl.sign.detached(Buffer.from(signaturePayload), keypair.secretKey));

        // TRYING A HYBRID CONNECT FRAME
        ws.send(JSON.stringify({
            type: "req", method: "connect", id: "pair-attempt",
            params: {
              minProtocol: 3, maxProtocol: 3,
              auth: { token: bootstrapToken },
              client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" },
              device: {
                  id: deviceId,
                  publicKey: urlSafeB64(pub),
                  signature: signature,
                  signedAt: ts,
                  nonce: nonce
              }
            }
        }));

    } else if (msg.id === "pair-attempt") {
        console.log("\n<<< RESPONSE:", JSON.stringify(msg, null, 2));
        if (msg.ok) {
            console.log("\n[SUCCESS!!!] Gateway accepted the pairing.");
        } else {
            console.error("\n[ERROR] Rejected:", msg.error.message);
        }
        process.exit(0);
    }
});

ws.on('error', (err) => { console.error("[WS ERROR]", err.message); });
setTimeout(() => { console.log("[TIMEOUT]"); process.exit(1); }, 15000);
