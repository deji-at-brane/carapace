const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "RjniA3B5fgxwV4ivalhT6LT-vK-k-LARUFPuW0Sv6jk";

const keypair = nacl.sign.keyPair();
const pub = keypair.publicKey;
const urlSafeB64 = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// THE WINNER: SHA256 HEX
const deviceId = crypto.createHash('sha256').update(pub).digest('hex');

console.log(`[DEBUG] Testing Pairing Success (ID: ${deviceId})`);
const ws = new WebSocket(`ws://${gatewayUrl}/`, { headers: { 'Origin': 'http://localhost:1425' } });

ws.on('message', (data) => {
    const raw = data.toString();
    const msg = JSON.parse(raw);
    
    if (msg.event === "connect.challenge") {
        const ts = msg.payload.ts;
        const nonce = msg.payload.nonce;

        // SIG PAYLOAD WITH HEX ID
        const signaturePayload = [
            'v3', deviceId, 'openclaw-macos', 'cli', 'operator', '', ts.toString(), bootstrapToken, nonce, 'macos', 'desktop'
        ].join('|');

        console.log("[DEBUG] Signing V3 Payload:", signaturePayload);
        const signature = urlSafeB64(nacl.sign.detached(Buffer.from(signaturePayload), keypair.secretKey));

        // MANDATORY CONNECT FIRST (Standard Protocol)
        ws.send(JSON.stringify({
            type: "req", method: "connect", id: "c",
            params: {
              minProtocol: 3, maxProtocol: 3,
              auth: { token: bootstrapToken },
              client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" },
              device: { id: deviceId, publicKey: urlSafeB64(pub), signature: signature, signedAt: ts, nonce: nonce }
            }
        }));

        ws.once('message', (d2) => {
            console.log("[DEBUG] Connect response received. Now PAIRING...");
            ws.send(JSON.stringify({
                type: "req", method: "devices/pair", id: "p",
                params: {
                    bootstrapToken: bootstrapToken,
                    deviceName: "Carapace Verified",
                    device: { id: deviceId, publicKey: urlSafeB64(pub) },
                    client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" }
                }
            }));
        });

    } else if (msg.id === "p") {
        console.log("\n<<< PAIRING SUCCESS RESPONSE:", JSON.stringify(msg, null, 2));
        process.exit(0);
    }
});

ws.on('error', (err) => { console.error("[WS ERROR]", err.message); });
setTimeout(() => { console.log("[TIMEOUT]"); process.exit(1); }, 15000);
