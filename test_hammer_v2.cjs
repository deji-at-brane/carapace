const WebSocket = require('ws');
const fs = require('fs');

const gateway = 'ws://148.230.87.184:18789';
const token = '0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4';

const variations = [
  { name: 'VAR_1', payload: { jsonrpc: "2.0", method: "connect", params: { token }, id: 1 } },
  { name: 'VAR_2', payload: { jsonrpc: "2.0", method: "connect", params: { bootstrapToken: token }, id: 2 } },
  { name: 'VAR_3', payload: { jsonrpc: "2.0", method: "connect", params: { auth: token }, id: 3 } },
  { name: 'VAR_4', payload: { jsonrpc: "2.0", method: "connect", params: token, id: 4 } }
];

let log = '';
function logger(msg) {
    console.log(msg);
    log += msg + '\n';
}

function tryVariation(index) {
  if (index >= variations.length) {
    fs.writeFileSync('hammer_final_log.txt', log);
    process.exit(0);
  }

  const v = variations[index];
  logger(`\n--- TESTING ${v.name} ---`);
  const ws = new WebSocket(gateway);

  ws.on('open', () => {
    const str = JSON.stringify(v.payload);
    logger('[SEND]: ' + str);
    ws.send(str);
  });

  ws.on('message', (data) => {
    const raw = data.toString();
    logger('[RECV]: ' + raw);
    ws.close();
  });

  ws.on('error', (err) => {
    logger('[ERR]: ' + err.message);
    ws.close();
  });

  ws.on('close', () => {
    setTimeout(() => tryVariation(index + 1), 500);
  });

  setTimeout(() => {
    logger(`[TIMEOUT] ${v.name}`);
    ws.close();
  }, 2000);
}

tryVariation(0);
