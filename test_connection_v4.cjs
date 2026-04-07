const WebSocket = require('ws');
const nacl = require('tweetnacl');

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "RjniA3B5fgxwV4ivalhT6LT-vK-k-LARUFPuW0Sv6jk";

console.log(`[DEBUG] Attempting connection to ws://${gatewayUrl}/`);

const ws = new WebSocket(`ws://${gatewayUrl}/`, {
  headers: { 'Origin': 'http://localhost:1425' }
});

const keypair = nacl.sign.keyPair();
const publicKeyBase64 = Buffer.from(keypair.publicKey).toString('base64');
const deviceId = publicKeyBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

ws.on('open', function open() {
  console.log('[DEBUG] TCP WebSocket Open. Waiting for Gateway connect.challenge...');
});

ws.on('message', function message(data) {
  const rawMsg = data.toString();
  console.log('<<< RECEIVED RAW:', rawMsg);
  
  try {
    const msg = JSON.parse(rawMsg);
    
    if (msg.event === "connect.challenge") {
      const nonce = msg.payload.nonce;
      const ts = msg.payload.ts;
      
      console.log(`\n[DEBUG] Challenge intercepted. Expected TS: ${ts}, Nonce: ${nonce}`);
      
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
      
      console.log(`[DEBUG] Signing Exact Payload: ${signaturePayload}`);
      
      const signatureArray = nacl.sign.detached(Buffer.from(signaturePayload), keypair.secretKey);
      const signatureB64 = Buffer.from(signatureArray).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      const payloadObj = {
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
            deviceFamily: "desktop" 
          },
          auth: { 
            token: bootstrapToken 
          },
          device: {
            id: deviceId, 
            publicKey: deviceId,
            signature: signatureB64,
            signedAt: ts,
            nonce: nonce
          }
        },
        id: "c1"
      };

      console.log('\n[DEBUG] Dispatched final connect payload:');
      ws.send(JSON.stringify(payloadObj));
      
    } else if (msg.id === "c1") {
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

setTimeout(() => {
  console.log('Timeout');
  process.exit(1);
}, 5000);
