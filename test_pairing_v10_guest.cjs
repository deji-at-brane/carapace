const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "RjniA3B5fgxwV4ivalhT6LT-vK-k-LARUFPuW0Sv6jk";

const kp = nacl.sign.keyPair();
const P = kp.publicKey;
const urlSafe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deviceId = crypto.createHash('sha256').update(P).digest('hex');

console.log(`[DEBUG] GUEST-THEN-PAIR TEST (Fingerprint: ${deviceId})`);
const ws = new WebSocket(`ws://${gatewayUrl}/`, { headers: { 'Origin': 'http://localhost:1425' } });

ws.on('message', (data) => {
    const m = JSON.parse(data.toString());
    
    if (m.event === "connect.challenge") {
        console.log("[DEBUG] Challenge Received. Sending GUEST connect...");
        
        // GUEST CONNECT: No auth token, just identifying as a guest device
        ws.send(JSON.stringify({
            type: "req", method: "connect", id: "stage-1",
            params: {
                minProtocol: 3, maxProtocol: 3,
                client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" },
                device: { id: deviceId, publicKey: urlSafe(Buffer.from(P).toString('base64')) }
            }
        }));

        ws.once('message', (d2) => {
            const r1 = JSON.parse(d2.toString());
            console.log("<<< GUEST RESPONSE RECEIVED. Status:", r1.id === "stage-1" ? (r1.ok ? "OK" : "REJECTED (EXPECTED)") : "UNEXPECTED");
            
            // NOW PAIR WITH THE BOOTSTRAP TOKEN
            console.log("[DEBUG] Sending Pairing Request Stage 2...");
            
            // Re-sign for the actually pairing call
            const ts = m.payload.ts;
            const nonce = m.payload.nonce;
            const sigStr = ['v3', deviceId, 'openclaw-macos', 'cli', 'operator', '', ts.toString(), bootstrapToken, nonce, 'macos', 'desktop'].join('|');
            const sig = urlSafe(Buffer.from(nacl.sign.detached(Buffer.from(sigStr), kp.secretKey)).toString('base64'));

            ws.send(JSON.stringify({
                type: "req", method: "devices/pair", id: "stage-2",
                params: {
                    bootstrapToken: bootstrapToken,
                    deviceName: "Carapace Guest-Pairing",
                    device: { 
                        id: deviceId, 
                        publicKey: urlSafe(Buffer.from(P).toString('base64')),
                        signature: sig,
                        signedAt: ts,
                        nonce: nonce
                    },
                    client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" }
                }
            }));
        });

    } else if (m.id === "stage-2") {
        console.log("\n<<< PAIRING RESULT:", JSON.stringify(m, null, 2));
        if (m.ok) { console.log("\n[WIN!] Successful Pairing."); process.exit(0); }
        else { console.error("\n[FAIL] Registration rejected:", m.error.message); process.exit(1); }
    }
});

ws.on('close', (c,r) => { console.log(`[WS CLOSED] ${c}: ${r}`); });
setTimeout(() => { console.log("[TIMEOUT]"); process.exit(1); }, 15000);
