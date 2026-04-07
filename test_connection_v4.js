import WebSocket from 'ws';

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4";

console.log(`[DEBUG] Attempting connection to ws://${gatewayUrl}/`);

const ws = new WebSocket(`ws://${gatewayUrl}/`, {
  headers: {
    'Origin': 'http://localhost:1425'
  }
});

ws.on('open', function open() {
  console.log('[DEBUG] WebSocket Open');
  
  // IMMEDIATELY send the pairing request
  const payloadObj = {
    jsonrpc: "2.0",
    method: "devices/pair",
    params: {
      bootstrapToken: bootstrapToken,
      deviceName: "Carapace Terminal"
    },
    id: "pair-req-1"
  };

  const payloadStr = JSON.stringify(payloadObj);
  
  console.log('[DEBUG] Sending Payload String:', payloadStr);
  
  // Convert to Buffer to check for hidden characters or BOM
  const buffer = Buffer.from(payloadStr, 'utf-8');
  console.log('[DEBUG] Payload Hex:', buffer.toString('hex'));
  
  ws.send(payloadStr, (err) => {
    if (err) console.error('[DEBUG] Send error:', err);
    else console.log('[DEBUG] Send SUCCESS');
  });
});

ws.on('message', function message(data) {
  const msgStr = data.toString();
  console.log('<<< RECEIVED:', msgStr);
  try {
    const msg = JSON.parse(msgStr);
    if (msg.result && msg.result.api_token) {
        console.log('[SUCCESS] Received API Token:', msg.result.api_token);
        process.exit(0);
    }
  } catch (e) {}
});

ws.on('error', function error(err) {
  console.error('!!! WebSocket Error:', err.message);
});

ws.on('close', function close(code, reason) {
  console.log(`Connection closed: code=${code} reason=${reason.toString()}`);
  process.exit(0);
});

setTimeout(() => {
  console.log('Timed out after 10s');
  ws.close();
  process.exit(0);
}, 10000);
