import WebSocket from 'ws';

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4";

const ws = new WebSocket(`ws://${gatewayUrl}/`, {
  headers: {
    'Origin': 'http://localhost:1425'
  }
});

ws.on('open', function open() {
  // Manual string construction to be 100% sure about formatting
  const payload = `{"jsonrpc":"2.0","method":"devices/pair","params":{"bootstrapToken":"${bootstrapToken}","deviceName":"Carapace Terminal"},"id":"pair-req-1"}`;
  
  console.log('[DEBUG] Sending payload:', payload);
  ws.send(payload);
});

ws.on('message', function message(data) {
  console.log('<<< RECEIVED:', data.toString());
});

ws.on('close', function close(code, reason) {
  console.log(`Connection closed: code=${code} reason=${reason.toString()}`);
  process.exit(0);
});

setTimeout(() => {
  ws.close();
  process.exit(0);
}, 5000);
