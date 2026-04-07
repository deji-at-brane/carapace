const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const gatewayUrl = "148.230.87.184:18789";
const token = "RjniA3B5fgxwV4ivalhT6LT-vK-k-LARUFPuW0Sv6jk";

const kp = nacl.sign.keyPair();
const P = kp.publicKey;
const urlSafe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deviceId = crypto.createHash('sha256').update(P).digest('hex');

const variations = [
    { name: "PARAM_ROOT", payload: { bootstrapToken: token } },
    { name: "AUTH_OBJECT", payload: { auth: { bootstrapToken: token } } },
    { name: "INVITE_TOKEN", payload: { auth: { inviteToken: token } } },
    { name: "TOKEN_DIRECT", payload: { token: token } }
];

async function test(v) {
    return new Promise((resolve) => {
        console.log(`\n>>> TESTING PLACEMENT: ${v.name}`);
        const ws = new WebSocket(`ws://${gatewayUrl}/`, { headers: { 'Origin': 'http://localhost:1425' } });
        
        ws.on('message', (data) => {
            const m = JSON.parse(data.toString());
            if (m.event === "connect.challenge") {
                const ts = m.payload.ts;
                const nonce = m.payload.nonce;
                const sigStr = ['v3', deviceId, 'openclaw-macos', 'cli', 'operator', '', ts.toString(), token, nonce, 'macos', 'desktop'].join('|');
                const sig = urlSafe(Buffer.from(nacl.sign.detached(Buffer.from(sigStr), kp.secretKey)).toString('base64'));

                const baseParams = {
                    minProtocol: 3, maxProtocol: 3,
                    client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" },
                    device: { id: deviceId, publicKey: urlSafe(Buffer.from(P).toString('base64')), signature: sig, signedAt: ts, nonce: nonce }
                };

                const finalParams = { ...baseParams, ...v.payload };

                ws.send(JSON.stringify({ type: "req", method: "connect", id: "t", params: finalParams }));
            } else if (m.id === "t") {
                console.log(`[RESULT] ${v.name}: ${m.ok ? 'SUCCESS!' : m.error.message}`);
                if (m.ok) console.log("[PAYLOAD]", JSON.stringify(m.payload));
                ws.close();
                resolve();
            }
        });

        ws.on('error', (e) => { console.log(`[ERROR] ${v.name}: ${e.message}`); resolve(); });
        ws.on('close', (c,r) => { if(r) console.log(`[CLOSED] ${c}: ${r}`); resolve(); });
        setTimeout(() => { ws.close(); resolve(); }, 4000);
    });
}

(async () => {
    for (const v of variations) { await test(v); }
    console.log("\n[DONE]");
})();
