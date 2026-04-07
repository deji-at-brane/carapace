import WebSocket from 'ws';

const gatewayUrl = "148.230.87.184:18789";
const bootstrapToken = "0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4";

const ws = new WebSocket(`ws://${gatewayUrl}/`, {
  headers: {
    'Origin': 'http://localhost:1425'
  }
});

ws.on('open', function open() {
  console.log('Connected to Gateway');
  
  // Wait 500ms to see if any challenge arrives
  setTimeout(() => {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      type: "req", // Added based on OpenClaw protocol documentation
      method: "devices/pair",
      params: {
        bootstrapToken: bootstrapToken,
        deviceName: "Carapace Terminal"
      },
      id: "pair-req-1"
    });

    console.log('Sending payload (with type:req):', payload);
    ws.send(payload);
  }, 500);
});

ws.on('message', function message(data) {
  console.log('<<< RECEIVED:', data.toString());
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
