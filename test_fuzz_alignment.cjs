const WebSocket = require('ws');
const nacl = require('tweetnacl');
const crypto = require('crypto');

const HOST = "148.230.87.184:18789";
const TOKEN = "axle-749E25C6-2D4E-4C45";

const toUrlSafe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function tryPayload(variantName, payloadGenerator) {
    return new Promise((resolve) => {
        const ws = new WebSocket(`ws://${HOST}/`);
        let finished = false;

        ws.on('open', () => {
            ws.send(JSON.stringify({
                type: "req",
                method: "connect",
                id: "step1",
                params: {
                    minProtocol: 3,
                    maxProtocol: 3,
                    client: { id: "openclaw-macos", version: "1.0.0", mode: "cli", platform: "macos", deviceFamily: "desktop" },
                    auth: { bootstrapToken: TOKEN },
                    device: { id: "test-device" }
                }
            }));
        });

        ws.on('message', async (data) => {
            const msg = JSON.parse(data);
            if (msg.event === "connect.challenge") {
                const { nonce, ts } = msg.payload;
                const kp = nacl.sign.keyPair();
                const pub = kp.publicKey;
                const deviceId = crypto.createHash('sha256').update(pub).digest('hex');
                
                const payload = payloadGenerator(deviceId, ts, nonce, TOKEN);
                const signature = toUrlSafe(Buffer.from(nacl.sign.detached(Buffer.from(payload), kp.secretKey)).toString('base64'));
                
                ws.send(JSON.stringify({
                    type: "req",
                    method: "connect",
                    id: "step2",
                    params: {
                        auth: { bootstrapToken: TOKEN },
                        device: {
                            id: deviceId,
                            publicKey: toUrlSafe(Buffer.from(pub).toString('base64')),
                            signature: signature,
                            signedAt: ts,
                            nonce: nonce
                        }
                    }
                }));
            } else if (msg.type === "res" && msg.id === "step2") {
                if (msg.payload && msg.payload.ok) {
                    console.log(`[SUCCESS] VARIANT WORKS: ${variantName}`);
                    finished = true;
                } else {
                    // console.log(`[FAIL] ${variantName}: ${msg.error.message}`);
                }
                ws.close();
                resolve(finished);
            }
        });

        setTimeout(() => { ws.close(); resolve(false); }, 3000);
    });
}

async function main() {
    console.log("Starting Protocol Alignment Fuzzer...");
    
    const variants = {
        "Standard v3": (id, ts, nonce, tok) => `v3|${id}|openclaw-macos|cli|operator||${ts}|${tok}|${nonce}|macos|desktop`,
        "No axle- prefix in payload": (id, ts, nonce, tok) => `v3|${id}|openclaw-macos|cli|operator||${ts}|${tok.replace('axle-', '')}|${nonce}|macos|desktop`,
        "clientId carapace-desktop-v1": (id, ts, nonce, tok) => `v3|${id}|carapace-desktop-v1|cli|operator||${ts}|${tok}|${nonce}|macos|desktop`,
        "Standard v3 + Windows Platform": (id, ts, nonce, tok) => `v3|${id}|openclaw-macos|cli|operator||${ts}|${tok}|${nonce}|windows|desktop`,
        "DeviceId as Base64": (id, ts, nonce, tok) => {
            // This is a test of a different fingerprinting method
            return `v3|${id}|openclaw-macos|cli|operator||${ts}|${tok}|${nonce}|macos|desktop`;
        }
    };

    for (const [name, generator] of Object.entries(variants)) {
        const ok = await tryPayload(name, generator);
        if (ok) {
            console.log("Alignment Found!");
            process.exit(0);
        } else {
            console.log(`- ${name}: FAILED`);
        }
    }
    
    console.log("None of the variants worked. Token might be expired.");
}

main();
