const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const gatewayUrl = "148.230.87.184:18789";
const token = "RjniA3B5fgxwV4ivalhT6LT-vK-k-LARUFPuW0Sv6jk";

const kp = nacl.sign.keyPair();
const P = kp.publicKey;
const urlSafe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const vars = [
    { name: "PUB_URLSAFE_B64", val: urlSafe(Buffer.from(P).toString('base64')) },
    { name: "PUB_HEX", val: Buffer.from(P).toString('hex') },
    { name: "SHA256_URLSAFE_B64", val: urlSafe(crypto.createHash('sha256').update(P).digest('base64')) },
    { name: "SHA256_HEX", val: crypto.createHash('sha256').update(P).digest('hex') },
    { name: "PUB_STANDARD_B64", val: Buffer.from(P).toString('base64') }
];

async function test(v) {
    return new Promise((resolve) => {
        console.log(`\n>>> TESTING: ${v.name} (${v.val.substring(0,10)}...)`);
        const ws = new WebSocket(`ws://${gatewayUrl}/`, { headers: { 'Origin': 'http://localhost:1425' } });
        
        ws.on('message', (data) => {
            const m = JSON.parse(data.toString());
            if (m.event === "connect.challenge") {
                const sigStr = ['v3', v.val, 'openclaw-macos', 'cli', 'operator', '', m.payload.ts.toString(), token, m.payload.nonce, 'macos', 'desktop'].join('|');
                const sig = urlSafe(Buffer.from(nacl.sign.detached(Buffer.from(sigStr), kp.secretKey)).toString('base64'));
                ws.send(JSON.stringify({
                    type: "req", method: "connect", id: "t", 
                    params: {
                        minProtocol: 3, maxProtocol: 3, auth: { token },
                        client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" },
                        device: { id: v.val, publicKey: urlSafe(Buffer.from(P).toString('base64')), signature: sig, signedAt: m.payload.ts, nonce: m.payload.nonce }
                    }
                }));
            } else if (m.id === "t") {
                console.log(`[RESULT] ${v.name}: ${m.error ? m.error.message : 'SUCCESS!'}`);
                if (m.error && m.error.details) console.log(`[DETAILS] ${m.error.details.reason}`);
                ws.close();
                resolve();
            }
        });

        ws.on('error', (e) => { console.log(`[ERROR] ${v.name}: ${e.message}`); resolve(); });
        setTimeout(() => { ws.close(); resolve(); }, 4000);
    });
}

(async () => {
    for (const v of vars) { await test(v); }
    console.log("\n[DONE]");
})();
