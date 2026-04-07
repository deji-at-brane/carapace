const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "RjniA3B5fgxwV4ivalhT6LT-vK-k-LARUFPuW0Sv6jk";

// We'll use a NEW random keypair for this final clean pair test
const keypair = nacl.sign.keyPair();
const pub = keypair.publicKey;
const urlSafeB64 = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// THE KEY DISCOVERY: Device ID must be the SHA-256 fingerprint (URL-Safe Base64)
const deviceId = urlSafeB64(crypto.createHash('sha256').update(pub).digest());

console.log(`[DEBUG] Final Pairing Test (SHA-256 ID: ${deviceId})`);
const ws = new WebSocket(`ws://${gatewayUrl}/`, { headers: { 'Origin': 'http://localhost:1425' } });

ws.on('message', (data) => {
    const raw = data.toString();
    const msg = JSON.parse(raw);
    
    if (msg.event === "connect.challenge") {
        const ts = msg.payload.ts;
        const nonce = msg.payload.nonce;

        // V3 Payload: v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily
        const signaturePayload = [
            'v3', 
            deviceId, 
            'openclaw-macos', 
            'cli', 
            'operator', 
            '', 
            ts.toString(), 
            bootstrapToken, 
            nonce, 
            'macos', 
            'desktop'
        ].join('|');

        console.log("[DEBUG] Signing V3 Payload:", signaturePayload);
        const sigArray = nacl.sign.detached(Buffer.from(signaturePayload), keypair.secretKey);
        const signature = urlSafeB64(sigArray);

        // SENDING devices/pair INSTEAD OF connect
        const pairingRequest = {
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
                client: {
                    id: "openclaw-macos",
                    version: "1.0.0",
                    platform: "macos",
                    mode: "cli",
                    deviceFamily: "desktop"
                }
            },
            id: "final-pair-v5"
        };
        
        console.log("[DEBUG] Sending devices/pair request...");
        ws.send(JSON.stringify(pairingRequest));

    } else if (msg.id === "final-pair-v5") {
        console.log("\n<<< RECEIVED RESPONSE:", JSON.stringify(msg, null, 2));
        if (msg.ok) {
            console.log("\n[SUCCESS!!!] Gateway accepted the pairing request!");
            process.exit(0);
        } else {
            console.error("\n[ERROR] Request rejected:", msg.error.message);
            process.exit(1);
        }
    }
});

ws.on('error', (err) => { console.error("[WS ERROR]", err.message); });
setTimeout(() => { console.log("[TIMEOUT]"); process.exit(1); }, 10000);
