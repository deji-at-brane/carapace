import WebSocket from 'ws';
import nacl from 'tweetnacl';
import { createHash } from 'crypto';

/**
 * OpenClaw v3 Handshake Test Harness (Fresh Identity Mode)
 */

const uri = process.argv[2];
if (!uri) process.exit(1);

const seed = new Uint8Array(32).fill(0x42); 
const keyPair = nacl.sign.keyPair.fromSeed(seed);
const deviceId = createHash('sha256').update(keyPair.publicKey).digest('hex').toLowerCase(); // STRICT LOWERCASE

const ws = new WebSocket(`ws://${new URL(uri.replace('claw://', 'ws://')).host}`);

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.event === "connect.challenge") {
    const { nonce } = msg.payload;
    const now = Date.now(); // FRESH TIMESTAMP TEST

    const payload = [
      'v3',
      deviceId, 
      'openclaw-macos', 
      'cli',
      'operator', 
      '',          
      now.toString(),
      new URL(uri).searchParams.get("token"),
      nonce,
      'macos',
      'desktop'
    ].join('|');

    console.log("\x1b[1;35m[SIGNING]\x1b[0m Payload:", payload);
    const signatureRaw = nacl.sign.detached(new TextEncoder().encode(payload), keyPair.secretKey);

    ws.send(JSON.stringify({
      type: "req", method: "connect", id: "test",
      params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: "openclaw-macos", version: "1.0.0", platform: "macos", mode: "cli", deviceFamily: "desktop" },
        auth: { bootstrapToken: new URL(uri).searchParams.get("token") },
        device: {
          id: deviceId, // Lowercase
          publicKey: Buffer.from(keyPair.publicKey).toString('base64'),
          signature: Buffer.from(signatureRaw).toString('base64'),
          signedAt: now, // Milliseconds in JSON
          nonce: nonce
        }
      }
    }));
  } else if (msg.type === "res") {
    console.log("\x1b[1;90m[RESULT]\x1b[0m", JSON.stringify(msg, null, 2));
    ws.close();
  }
});
