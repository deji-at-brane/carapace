const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "RjniA3B5fgxwV4ivalhT6LT-vK-k-LARUFPuW0Sv6jk";

const keypair = nacl.sign.keyPair();
const pub = keypair.publicKey;
const urlSafeB64 = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deviceId = urlSafeB64(crypto.createHash('sha256').update(pub).digest());

console.log(`[DEBUG] Final Pairing Test V6 (SHA-256 ID: ${deviceId})`);
const ws = new WebSocket(`ws://${gatewayUrl}/`, { headers: { 'Origin': 'http://localhost:1425' } });

ws.on('message', (data) => {
    const raw = data.toString();
    const msg = JSON.parse(raw);
    
    if (msg.event === "connect.challenge") {
        const ts = msg.payload.ts;
        const nonce = msg.payload.nonce;

        const signaturePayload = [
            'v3', deviceId, 'openclaw-macos', 'cli', 'operator', '', 
            ts.toString(), bootstrapToken, nonce, 'macos', 'desktop'
        ].join('|');

        const sigArray = nacl.sign.detached(Buffer.from(signaturePayload), keypair.secretKey);
        const signature = urlSafeB64(sigArray);

        // STEP 1: MUST SEND CONNECT FIRST!
        console.log("[DEBUG] Sending mandatory first 'connect' frame...");
        ws.send(JSON.stringify({
            type: "req",
            method: "connect",
            params: {
              minProtocol: 3, maxProtocol: 3,
              auth: { token: bootstrapToken },
              client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" }
            },
            id: "step-1-connect"
        }));

        // We'll queue the pairing request for after we get any response from connect
        ws.once('message', (d2) => {
             console.log("[DEBUG] Connect response received. Proceeding to devices/pair...");
             ws.send(JSON.stringify({
                type: "req",
                method: "devices/pair",
                params: {
                    bootstrapToken: bootstrapToken,
                    deviceName: "Carapace Test Agent",
                    device: {
                        id: deviceId,
                        publicKey: urlSafeB64(pub),
                        signature: signature,
                        signedAt: ts,
                        nonce: nonce
                    },
                    client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" }
                },
                id: "step-2-pair"
            }));
        });

    } else if (msg.id === "step-2-pair") {
        console.log("\n<<< PAIRING RESPONSE:", JSON.stringify(msg, null, 2));
        if (msg.ok) {
            console.log("\n[SUCCESS!!!] Gateway paired and returned tokens.");
            process.exit(0);
        } else {
            console.error("\n[ERROR] Pairing rejected:", msg.error.message);
            process.exit(1);
        }
    }
});

ws.on('error', (err) => { console.error("[WS ERROR]", err.message); });
setTimeout(() => { console.log("[TIMEOUT]"); process.exit(1); }, 15000);
