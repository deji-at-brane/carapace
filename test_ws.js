import WebSocket from 'ws';

const ws = new WebSocket('ws://148.230.87.184:18789/');

ws.on('open', () => {
  console.log('[CONNECTED]');
  // Often after connecting, the server sends a "Hello" or "Challenge"
  ws.send(JSON.stringify({ 
    method: "devices/pair", 
    params: { token: "0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4" } 
  }));
  
  // Try another format just in case
  ws.send(JSON.stringify({ 
    type: "pairing_request", 
    token: "0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4" 
  }));
});

ws.on('message', (data) => {
  console.log('[MESSAGE]', data.toString());
});

ws.on('error', (err) => {
  console.error('[ERROR]', err.message);
});

ws.on('close', (code, reason) => {
  console.log('[CLOSED]', code, reason.toString());
});

setTimeout(() => {
  console.log('[TIMEOUT] Closing...');
  ws.close();
  process.exit(0);
}, 10000);