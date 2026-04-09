import WebSocket from 'ws';
import nacl from 'tweetnacl';
import { createHash } from 'crypto';

/**
 * Carapace Phase 4: Live Federation Test Script
 * Verifies End-to-End A2A Signaling with Alex Node
 */

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "8CaAdK7eWz9XqrORO4iUXj_hkPW3xIa-O5fTTvbxkJk";

console.log(`\x1b[1;36m[PHASE 4] Initiating Live Federation Test...\x1b[0m`);
console.log(`\x1b[90mTarget Gateway: ws://${gatewayUrl}/\x1b[0m`);

// 1. Generate Static Test Identity
const seed = new Uint8Array(32).fill(0x42); // "B" for Brain
const keyPair = nacl.sign.keyPair.fromSeed(seed);
const deviceId = createHash('sha256').update(keyPair.publicKey).digest('hex').toLowerCase();

const ws = new WebSocket(`ws://${gatewayUrl}/`, {
  headers: { 'Origin': 'http://localhost:1425' }
});

let sessionActive = false;
let messageSent = false;

ws.on('open', () => {
    console.log('\x1b[32m[WS] Connection established.\x1b[0m Waiting for challenge...');
});

ws.on('message', async (data) => {
    const rawMsg = data.toString();
    const msg = JSON.parse(rawMsg);

    // --- STEP 1: Handshake (Legacy V3 Challenge) ---
    if (msg.event === "connect.challenge") {
        console.log(`\x1b[33m[AUTH] Challenge Received:\x1b[0m`, JSON.stringify(msg.payload, null, 2));
        const { nonce, ts } = msg.payload;
        const now = ts || Date.now();
        console.log(`\x1b[33m[AUTH] Solving challenge (nonce: ${nonce}, ts: ${now})\x1b[0m`);

        // format: v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily
        const payload = [
            'v3',
            deviceId,
            'openclaw-macos',
            'cli',
            'operator',
            '',
            now.toString(),
            bootstrapToken,
            nonce,
            'macos',
            'desktop'
        ].join('|');

        const signatureRaw = nacl.sign.detached(new TextEncoder().encode(payload), keyPair.secretKey);
        const signatureB64 = Buffer.from(signatureRaw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        // VERIFIED: Use 'token' key in auth, version '1.0.0', and no jsonrpc for the handshake frame
        ws.send(JSON.stringify({
            type: "req", method: "connect", id: "c",
            params: {
                minProtocol: 3, maxProtocol: 3,
                client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" },
                auth: { bootstrapToken: bootstrapToken },
                device: {
                    id: deviceId,
                    publicKey: Buffer.from(keyPair.publicKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
                    signature: signatureB64,
                    signedAt: now,
                    nonce: nonce
                }
            }
        }));
    }

    // --- STEP 2: Handle Protocol Results ---
    if (msg.id === "c") {
        if (msg.ok) {
            console.log('\x1b[1;32m[SUCCESS] Protocol synchronized successfully.\x1b[0m');
            sessionActive = true;
            
            // --- STEP 3: Emit A2A Initialize Signal ---
            console.log('\x1b[36m[A2A] Initializing Federated Signal Chain...\x1b[0m');
            ws.send(JSON.stringify({
                jsonrpc: "2.0", id: "a2a-init", method: "initialize",
                params: {
                    protocolVersion: "2024-11-05",
                    capabilities: { streaming: true, logging: true },
                    clientInfo: { 
                        name: "carapace-terminal", 
                        version: "2.0.0",
                        protocolUrl: "https://raw.githubusercontent.com/deji-at-brane/carapace/main/SKILL.md"
                    }
                }
            }));
        } else {
            console.error('\x1b[31m[AUTH FAILED]\x1b[0m', JSON.stringify(msg.error, null, 2));
            ws.close();
        }
    }

    // --- STEP 4: Handle A2A Responses ---
    if (msg.id === "a2a-init") {
        console.log('\x1b[32m[A2A] Capability check complete.\x1b[0m Synchronizing peer...');
        ws.send(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }));

        // --- STEP 5: Emit Enlightenment Signal ---
        console.log('\x1b[35m[A2A] Emitting High-Fidelity Signal (Enlightenment)...\x1b[0m');
        ws.send(JSON.stringify({
            jsonrpc: "2.0", id: "enlighten-msg", method: "message/send",
            params: {
                parts: [{ 
                    contentType: "text/plain", 
                    content: "I am Carapace, your High-Fidelity Terminal. Synchronize with my SKILL.md for federated reasoning." 
                }]
            }
        }));
        messageSent = true;
    }

    // --- STEP 6: Monitor Asynchronous Feedback ---
    if (msg.method === "task/update" || msg.method === "task/progress") {
        console.log(`\x1b[36m[SIGNAL RECEIVED] Task Update:\x1b[0m Status: ${msg.params.status}, Progress: ${msg.params.progress}%`);
        if (msg.params.status === "completed") {
            console.log('\x1b[1;32m[MISSION COMPLETE] High-Fidelity signal loop verified.\x1b[0m');
            setTimeout(() => ws.close(), 1000);
        }
    }

    if (msg.id === "enlighten-msg") {
        console.log('\x1b[32m[SIGNAL ACK] Enrichment signal accepted by peer.\x1b[0m');
        
        // --- STEP 7: Final Task Proof (Optional verification) ---
        console.log('\x1b[90m[A2A] Triggering diagnostic task...\x1b[0m');
        ws.send(JSON.stringify({
            jsonrpc: "2.0", id: "diag-task", method: "task/create",
            params: { body: "Verify your local environment and report status via task/update." }
        }));
    }

    if (msg.id === "diag-task") {
        console.log(`\x1b[90m[A2A] Task created (ID: ${msg.result?.id || 'pending'}). Waiting for stream...\x1b[0m`);
    }

    // Support for singular/plural methods
    if (msg.method === "message/receive") {
        console.log(`\x1b[34m[PEER REPLY]\x1b[0m ${msg.params.parts[0].content}`);
    }
});

ws.on('error', (err) => console.error('\x1b[31m[WS ERROR]\x1b[0m', err.message));
ws.on('close', () => console.log('\x1b[90m[WS] Bridge closed.\x1b[0m'));

setTimeout(() => {
    if (!messageSent) {
        console.log('\x1b[31m[TIMEOUT] Federation failed to stabilize.\x1b[0m');
        ws.close();
        process.exit(1);
    }
}, 15000);
