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
});

ws.on('message', function message(data) {
  const msg = JSON.parse(data.toString());
  console.log('<<< RECEIVED:', JSON.stringify(msg, null, 2));

  // Stage 1: Connect
  if (msg.type === "event" && msg.event === "connect.challenge") {
    console.log('Responding to challenge with CONNECT...');
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      type: "req",
      method: "connect",
      params: {
        auth: { token: bootstrapToken },
        client: { name: "Carapace", version: "0.1.0" }
      },
      id: "conn-1"
    });
    ws.send(payload);
  }

  // Stage 2: Pair (if connect succeeded or if we want to try it after challenge)
  if (msg.result && msg.id === "conn-1") {
    console.log('CONNECT Successful. Sending PAIR request...');
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      type: "req",
      method: "devices/pair",
      params: {
        bootstrapToken: bootstrapToken,
        deviceName: "Carapace Terminal"
      },
      id: "pair-req-1"
    });
    ws.send(payload);
  }
});

ws.on('error', function error(err) {
  console.error('!!! WebSocket Error:', err.message);
});

ws.on('close', function close(code, reason) {
  console.log(`Connection closed: code=${code} reason=${reason.toString()}`);
});

setTimeout(() => {
  console.log('Timed out');
  ws.close();
  process.exit(0);
}, 10000);
