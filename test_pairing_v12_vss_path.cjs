const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Bypass same CN error for this test

const host = "31.220.73.189";
const port = 443;
const path = "/vss/"; // The discovered path!
const token = "axle-8B7C-4D2E-9F1A";

const kp = nacl.sign.keyPair();
const deviceId = crypto.createHash('sha256').update(kp.publicKey).digest('hex');
const urlSafe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const wsUrl = `wss://${host}:${port}${path}`;
console.log(`[DEBUG] Final Endpoint Test: ${wsUrl}`);

const ws = new WebSocket(wsUrl);

ws.on('open', () => { console.log("[SUCCESS!] Connection Established at /vss/"); });

ws.on('message', (data) => {
    const m = JSON.parse(data.toString());
    console.log("[EVENT]", m.event);
    if (m.event === "connect.challenge") {
        console.log("[WIN!] Server responded with challenge. Identity logic is now compatible.");
        process.exit(0);
    }
});

ws.on('error', (e) => { console.error("[FAIL]", e.message); process.exit(1); });
setTimeout(() => { console.log("[TIMEOUT]"); process.exit(1); }, 10000);
