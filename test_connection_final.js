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
  
  // IMMEDIATELY send the pairing request as instructed by the remote agent
  const payloadObj = {
    jsonrpc: "2.0",
    type: "req", // Explicitly include type: req
    method: "devices/pair",
    params: {
      bootstrapToken: bootstrapToken,
      deviceName: "Carapace Terminal"
    },
    id: "pair-req-1"
  };

  const payloadStr = JSON.stringify(payloadObj);
  
  // VERIFY: The remote agent asked for the exact string
  console.log('[DEBUG] Sending EXACT STRING Payload:', JSON.stringify(payloadStr)); 
  
  // ws.send by default sends a UTF-8 text frame if input is a string
  ws.send(payloadStr, (err) => {
    if (err) {
      console.error('[DEBUG] ws.send error:', err);
    } else {
      console.log('[DEBUG] ws.send success');
    }
  });
});

ws.on('message', function message(data) {
  const rawMsg = data.toString();
  console.log('<<< RECEIVED RAW:', JSON.stringify(rawMsg));
  try {
    const msg = JSON.parse(rawMsg);
    console.log('<<< RECEIVED JSON:', JSON.stringify(msg, null, 2));
  } catch (e) {
    console.log('<<< RECEIVED (NON-JSON):', rawMsg);
  }
});

ws.on('error', function error(err) {
  console.error('!!! WebSocket Error:', err.message);
});

ws.on('close', function close(code, reason) {
  console.log(`Connection closed: code=${code} reason=${reason.toString()}`);
});

setTimeout(() => {
  console.log('Timed out after 10s');
  ws.close();
  process.exit(0);
}, 10000);
