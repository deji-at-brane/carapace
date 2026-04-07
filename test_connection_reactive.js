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

  if (msg.type === "event" && msg.event === "connect.challenge") {
    console.log('Challenge received. Extracting nonce...');
    const nonce = msg.payload.nonce;

    const payload = JSON.stringify({
      jsonrpc: "2.0",
      type: "req",
      method: "devices/pair",
      params: {
        bootstrapToken: bootstrapToken,
        deviceName: "Carapace Terminal",
        nonce: nonce // Including the nonce from the challenge
      },
      id: "pair-req-1"
    });

    console.log('Sending Reactive Handshake:', payload);
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
  console.log('Timed out after 10s');
  ws.close();
  process.exit(0);
}, 10000);
