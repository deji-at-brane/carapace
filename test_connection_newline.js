import WebSocket from 'ws';

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4";

const ws = new WebSocket(`ws://${gatewayUrl}/`, {
  headers: {
    'Origin': 'http://localhost:1425'
  }
});

ws.on('open', function open() {
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    type: "req", // Including as it was in diagnostic
    method: "devices/pair",
    params: {
      bootstrapToken: bootstrapToken,
      deviceName: "Carapace Terminal"
    },
    id: 1 // Integer id
  });
  
  console.log('[DEBUG] Sending payload (with \\n):', payload);
  ws.send(payload + '\n');
});

ws.on('message', function message(data) {
  console.log('<<< RECEIVED RAW:', JSON.stringify(data.toString()));
});

ws.on('close', function close(code, reason) {
  console.log(`Connection closed: code=${code} reason=${reason.toString()}`);
  process.exit(0);
});

setTimeout(() => {
  ws.close();
  process.exit(0);
}, 5000);
