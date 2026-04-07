const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const gatewayUrl = "gateway.openclaw.ai";
const bootstrapToken = "axle-bk6z-9m2p-q8rt";

const kp = nacl.sign.keyPair();
const P = kp.publicKey;
const urlSafe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deviceId = crypto.createHash('sha256').update(P).digest('hex');

console.log(`[DEBUG] Final Aligned Handshake Test (ID: ${deviceId})`);
const ws = new WebSocket(`wss://${gatewayUrl}/`, { headers: { 'Origin': 'https://gateway.openclaw.ai' } });

ws.on('message', (data) => {
    const m = JSON.parse(data.toString());
    
    if (m.event === "connect.challenge") {
        const ts = m.payload.ts;
        const nonce = m.payload.nonce;
        const sigStr = ['v3', deviceId, 'openclaw-macos', 'cli', 'operator', '', ts.toString(), bootstrapToken, nonce, 'macos', 'desktop'].join('|');
        const sig = urlSafe(Buffer.from(nacl.sign.detached(Buffer.from(sigStr), kp.secretKey)).toString('base64'));

        // FINAL ALIGNMENT: bootstrapToken inside auth object
        ws.send(JSON.stringify({
            type: "req", method: "connect", id: "t",
            params: {
                minProtocol: 3, maxProtocol: 3,
                client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" },
                auth: { bootstrapToken: bootstrapToken },
                device: { id: deviceId, publicKey: urlSafe(Buffer.from(P).toString('base64')), signature: sig, signedAt: ts, nonce: nonce }
            }
        }));
    } else if (m.id === "t") {
        console.log("\n<<< FINAL RESPONSE:", JSON.stringify(m, null, 2));
        if (m.ok) {
            console.log("\n[SUCCESS!!!] Identity verified and tokens issued!");
            process.exit(0);
        } else {
            console.error("\n[REJECTED]", m.error.message);
            process.exit(1);
        }
    }
});

ws.on('error', (e) => { console.error("[WS ERROR]", e.reason || e.message); });
ws.on('close', (c, r) => { console.log(`[WS CLOSED] ${c}: ${r}`); });
setTimeout(() => { console.log("[TIMEOUT]"); process.exit(1); }, 15000);
