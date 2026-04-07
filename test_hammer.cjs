const WebSocket = require('ws');

const gateway = 'ws://148.230.87.184:18789';
const token = '0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4';

const variations = [
  {
    name: 'VAR 1: Flattened token',
    payload: {
      jsonrpc: "2.0",
      method: "connect",
      params: { token: token },
      id: 1
    }
  },
  {
    name: 'VAR 2: bootstrapToken name',
    payload: {
      jsonrpc: "2.0",
      method: "connect",
      params: { bootstrapToken: token },
      id: 2
    }
  },
  {
    name: 'VAR 3: Simple auth string',
    payload: {
      jsonrpc: "2.0",
      method: "connect",
      params: { auth: token },
      id: 3
    }
  },
  {
    name: 'VAR 4: Direct token in params',
    payload: {
      jsonrpc: "2.0",
      method: "connect",
      params: token,
      id: 4
    }
  }
];

function tryVariation(index) {
  if (index >= variations.length) {
    console.log('[FINISH] All variations attempted.');
    process.exit(0);
  }

  const v = variations[index];
  console.log(`\n--- TESTING ${v.name} ---`);
  const ws = new WebSocket(gateway);

  ws.on('open', () => {
    const str = JSON.stringify(v.payload);
    console.log('[SEND]:', str);
    ws.send(str);
  });

  ws.on('message', (data) => {
    const raw = data.toString();
    console.log('[RECV]:', raw);
    
    const parsed = JSON.parse(raw);
    if (parsed.result) {
        console.log(`[SUCCESS] ${v.name} matched!`);
        process.exit(0);
    }
    ws.close();
  });

  ws.on('error', (err) => {
    console.error('[ERR]:', err.message);
    ws.close();
  });

  ws.on('close', () => {
    setTimeout(() => tryVariation(index + 1), 500);
  });

  setTimeout(() => {
    console.log(`[TIMEOUT] ${v.name} timed out.`);
    ws.close();
  }, 2000);
}

tryVariation(0);
