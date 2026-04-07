const WebSocket = require('ws');

const gateway = 'ws://148.230.87.184:18789';
const token = '0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4';

const variations = [
    {
        name: 'VAR 1: Token + Nonce + TS (Nested)',
        payload: (nonce, ts) => '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '","nonce":"' + nonce + '","ts":' + ts + '}},"id":2}'
    },
    {
        name: 'VAR 2: Token + Nonce + TS (Flat Params)',
        payload: (nonce, ts) => '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '"},"nonce":"' + nonce + '","ts":' + ts + '},"id":2}'
    },
    {
        name: 'VAR 3: Authenticate Method (Experimental)',
        payload: (nonce, ts) => '{"jsonrpc":"2.0","method":"authenticate","params":{"token":"' + token + '","nonce":"' + nonce + '","ts":' + ts + '},"id":2}'
    }
];

function tryVariation(index) {
    if (index >= variations.length) {
        console.log('[FINISH] SEARCH COMPLETE.');
        process.exit(0);
    }

    const v = variations[index];
    console.log(`\n--- TESTING ${v.name} ---`);
    const ws = new WebSocket(gateway);

    ws.on('open', () => {
        const stage1 = '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '"}},"id":1}';
        ws.send(stage1);
    });

    ws.on('message', (data) => {
        const raw = data.toString();
        const msg = JSON.parse(raw);

        if (msg.type === "event" && msg.event === "connect.challenge") {
            const { nonce, ts } = msg.payload;
            console.log(`[RECV] Challenge Received (ts=${ts}). Responding with ${v.name}...`);
            ws.send(v.payload(nonce, ts));
        } else if (msg.id === 2 || msg.result || (msg.error && msg.id === 2)) {
            console.log(`[RECV] Final Response:`, raw);
            if (msg.result) {
                console.log(`[SUCCESS] ${v.name} matched! Result:`, JSON.stringify(msg.result));
                process.exit(0);
            }
            ws.close();
        }
    });

    ws.on('close', () => {
        setTimeout(() => tryVariation(index + 1), 1000);
    });

    setTimeout(() => {
        console.log(`[TIMEOUT] ${v.name}`);
        ws.close();
    }, 5000);
}

tryVariation(0);
