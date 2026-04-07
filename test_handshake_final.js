const WebSocket = require('ws');
const nacl = require('tweetnacl');

// Connection constants
const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4";

console.log(`[DEBUG] Attempting connection to ws://${gatewayUrl}/`);

const ws = new WebSocket(`ws://${gatewayUrl}/`, {
  headers: {
    'Origin': 'http://localhost:1425' // Standard mock origin 
  }
});

// Random Device Keys for this test session
const keypair = nacl.sign.keyPair();
const publicKeyBase64 = Buffer.from(keypair.publicKey).toString('base64');

// URL-Safe Base64 (Matches crypto.ts 'toUrlSafe')
const deviceId = publicKeyBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

ws.on('open', function open() {
  console.log('[DEBUG] TCP WebSocket Open. Waiting for Gateway connect.challenge...');
});

ws.on('message', function message(data) {
  const rawMsg = data.toString();
  console.log('<<< RECEIVED RAW:', rawMsg);
  
  try {
    const msg = JSON.parse(rawMsg);
    
    // Stage 1: Intercept automatic challenge
    if (msg.event === "connect.challenge") {
      const nonce = msg.payload.nonce;
      const ts = msg.payload.ts;
      
      console.log(`\n[DEBUG] Challenge intercepted. Expected TS: ${ts}, Nonce: ${nonce}`);
      
      // Stage 2: Build exact cryptographic payload matching the Rust + crypto.ts adjustments
      // Schema: v3 | deviceId | clientId | clientMode | role | scopes | signedAt | token | nonce | platform | deviceFamily
      const signaturePayload = [
        'v3',
        deviceId,
        'openclaw-macos',
        'cli',
        'operator',
        '', // default empty scope
        ts.toString(),
        bootstrapToken,
        nonce,
        'macos',
        'desktop'
      ].join('|');
      
      console.log(`[DEBUG] Signing Exact Payload: ${signaturePayload}`);
      
      const signatureArray = nacl.sign.detached(Buffer.from(signaturePayload), keypair.secretKey);
      const signatureB64 = Buffer.from(signatureArray).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      const payloadObj = {
        jsonrpc: "2.0",
        type: "req", 
        method: "connect",
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: { 
            id: "openclaw-macos", 
            version: "1.0.0", 
            platform: "macos", 
            mode: "cli",
            deviceFamily: "desktop" // Crucial fix for signature matching!
          },
          auth: { 
            token: bootstrapToken 
          },
          device: {
            id: deviceId, // For standard match
            deviceId: deviceId, // For OpenClaw strict V3 JSON-RPC match!
            publicKey: deviceId,
            signature: signatureB64,
            signedAt: ts,
            nonce: nonce
          }
        },
        id: "c1"
      };

      console.log('\n[DEBUG] Dispatched final connect payload:');
      console.log(JSON.stringify(payloadObj, null, 2));
      
      ws.send(JSON.stringify(payloadObj));
      
    } else if (msg.id === "c1") {
      // Stage 3: Analyze the result of the connect payload
      if (msg.ok === false) {
        console.error(`\n[ERROR] GATEWAY REJECTION:\n`, JSON.stringify(msg.error, null, 2));
      } else {
        console.log(`\n[SUCCESS] PAIRING COMPLETE!!! APITOKEN GRANTED!`);
        console.log(JSON.stringify(msg.result, null, 2));
      }
      setTimeout(() => process.exit(0), 500);
    }
  } catch (e) {
    console.error('JSON Error:', e.message);
  }
});

ws.on('error', function error(err) {
  console.error('!!! WebSocket Error:', err.message);
});

ws.on('close', function close(code, reason) {
  console.log(`\nConnection closed: code=${code} reason=${reason.toString()}`);
});

setTimeout(() => {
  console.log('Test manually timed out after 5s.');
  process.exit(1);
}, 5000);
