const WebSocket = require('ws');
const nacl = require('tweetnacl');

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4";

console.log(`[DEBUG] Attempting connection to ws://${gatewayUrl}/`);

const ws = new WebSocket(`ws://${gatewayUrl}/`, {
  headers: { 'Origin': 'http://localhost:1425' }
});

const keypair = nacl.sign.keyPair();
const publicKeyBase64 = Buffer.from(keypair.publicKey).toString('base64');
const deviceId = publicKeyBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

ws.on('open', function open() {
  console.log('[DEBUG] Connected. Dispatching minimal pure jsonrpc:2.0 connect frame...');
  // Send bare minimum connect frame just to trigger the challenge and fulfill internal State Machine
  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    method: "connect",
    id: 1
  }));
});

ws.on('message', function message(data) {
  const rawMsg = data.toString();
  console.log('<<< RECEIVED RAW:', rawMsg);
  
  try {
    const msg = JSON.parse(rawMsg);
    
    // Stage 1: Wait for Challenge explicitly
    if (msg.event === "connect.challenge") {
      const nonce = msg.payload.nonce;
      const ts = msg.payload.ts;
      
      console.log(`\n[DEBUG] Challenge intercepted. Expected TS: ${ts}, Nonce: ${nonce}`);
      
      // Stage 2: Final 'devices/pair'
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
        jsonrpc: "2.0",
        type: "req", 
        method: "devices/pair",
        params: {
          bootstrapToken: bootstrapToken,
          deviceName: "Node Testing Terminal",
          device: {
            id: deviceId,
            publicKey: deviceId,
            signature: signatureB64,
            signedAt: ts,
            nonce: nonce
          }
        },
        id: "c2"
      };

      console.log('\n[DEBUG] Dispatched dual-framed pairing payload:');
      ws.send(JSON.stringify(payloadObj));
      
    } else if (msg.id === "c2") {
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
  console.log('Test automatically timed out after 5 seconds.');
  process.exit(1);
}, 5000);
