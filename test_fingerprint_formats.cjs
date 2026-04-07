const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "RjniA3B5fgxwV4ivalhT6LT-vK-k-LARUFPuW0Sv6jk";

// We'll use one FIXED keypair for all tests so we can compare
const keypair = nacl.sign.keyPair();
const pub = keypair.publicKey;
const pubB64 = Buffer.from(pub).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const pubHex = Buffer.from(pub).toString('hex');
const sha256PubB64 = crypto.createHash('sha256').update(pub).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha256PubHex = crypto.createHash('sha256').update(pub).digest('hex');

const variations = [
    { name: "RAW_URLSAFE_B64", id: pubB64 },
    { name: "RAW_HEX", id: pubHex },
    { name: "SHA256_B64", id: sha256PubB64 },
    { name: "SHA256_HEX", id: sha256PubHex }
];

let index = 0;

function runNext() {
    if (index >= variations.length) {
        console.log("\n[FINISH] All fingerprint formats tested.");
        process.exit(0);
    }

    const v = variations[index];
    console.log(`\n--- TESTING FORMAT: ${v.name} (ID: ${v.id.substring(0, 10)}...) ---`);
    
    const ws = new WebSocket(`ws://${gatewayUrl}/`, { headers: { 'Origin': 'http://localhost:1425' } });

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.event === "connect.challenge") {
            const signaturePayload = [
                'v3', v.id, 'openclaw-macos', 'cli', 'operator', '', 
                msg.payload.ts.toString(), bootstrapToken, msg.payload.nonce, 'macos', 'desktop'
            ].join('|');

            const sig = nacl.sign.detached(Buffer.from(signaturePayload), keypair.secretKey);
            const sigB64 = Buffer.from(sig).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

            ws.send(JSON.stringify({
                type: "req", method: "connect",
                params: {
                    minProtocol: 3, maxProtocol: 3,
                    client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" },
                    auth: { token: bootstrapToken },
                    device: { id: v.id, publicKey: pubB64, signature: sigB64, signedAt: msg.payload.ts, nonce: msg.payload.nonce }
                },
                id: "test"
            }));
        } else if (msg.id === "test") {
            if (msg.ok) {
                console.log(`[WINNER!!] Format ${v.name} worked! Received response:`, JSON.stringify(msg.payload));
                process.exit(0);
            } else {
                console.log(`[FAIL] ${v.name}: ${msg.error.reason || msg.error.message}`);
                ws.close();
            }
        }
    });

    ws.on('close', () => {
        index++;
        setTimeout(runNext, 1000);
    });

    setTimeout(() => { ws.close(); }, 5000);
}

runNext();
