const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "RjniA3B5fgxwV4ivalhT6LT-vK-k-LARUFPuW0Sv6jk";

const keypair = nacl.sign.keyPair();
const pub = keypair.publicKey;
const urlSafeB64 = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deviceId = urlSafeB64(crypto.createHash('sha256').update(pub).digest());

console.log(`[DEBUG] Final Pairing Test V7 (SHA-256 ID: ${deviceId})`);
const ws = new WebSocket(`ws://${gatewayUrl}/`, { headers: { 'Origin': 'http://localhost:1425' } });

ws.on('message', (data) => {
    const raw = data.toString();
    const msg = JSON.parse(raw);
    
    if (msg.event === "connect.challenge") {
        const ts = msg.payload.ts;
        const nonce = msg.payload.nonce;
        const signaturePayload = ['v3', deviceId, 'openclaw-macos', 'cli', 'operator', '', ts.toString(), bootstrapToken, nonce, 'macos', 'desktop'].join('|');
        const signature = urlSafeB64(nacl.sign.detached(Buffer.from(signaturePayload), keypair.secretKey));

        console.log("[DEBUG] Sending mandatory first 'connect' frame...");
        ws.send(JSON.stringify({
            type: "req", method: "connect", id: "stage-1",
            params: {
              minProtocol: 3, maxProtocol: 3, auth: { token: bootstrapToken },
              client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" },
              device: { id: deviceId, publicKey: urlSafeB64(pub), signature: signature, signedAt: ts, nonce: nonce }
            }
        }));

    } else if (msg.id === "stage-1") {
        console.log("<<< STAGE 1 (CONNECT) RESPONSE:", JSON.stringify(msg, null, 2));
        
        console.log("[DEBUG] Proceeding to devices/pair...");
        ws.send(JSON.stringify({
            type: "req", method: "devices/pair", id: "stage-2",
            params: {
                bootstrapToken: bootstrapToken,
                deviceName: "Carapace Test Agent",
                device: { id: deviceId, publicKey: urlSafeB64(pub) },
                client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" }
            }
        }));
    } else if (msg.id === "stage-2") {
        console.log("\n<<< STAGE 2 (PAIRING) RESPONSE:", JSON.stringify(msg, null, 2));
        process.exit(0);
    }
});

ws.on('error', (err) => { console.error("[WS ERROR]", err.message); });
ws.on('close', (c,r) => { console.log(`[WS CLOSED] ${c}: ${r}`); });
setTimeout(() => { console.log("[TIMEOUT]"); process.exit(1); }, 15000);
