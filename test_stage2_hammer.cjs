const WebSocket = require('ws');

const gateway = 'ws://148.230.87.184:18789';
const token = '0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4';

const variations = [
    {
        name: 'VAR 1: Nonce inside auth',
        payload: (nonce) => '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '","nonce":"' + nonce + '"}},"id":2}'
    },
    {
        name: 'VAR 2: Nonce at params root',
        payload: (nonce) => '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '"},"nonce":"' + nonce + '"},"id":2}'
    },
    {
        name: 'VAR 3: Flattened params (token + nonce)',
        payload: (nonce) => '{"jsonrpc":"2.0","method":"connect","params":{"token":"' + token + '","nonce":"' + nonce + '"},"id":2}'
    }
];

function tryVariation(index) {
    if (index >= variations.length) {
        console.log('[FINISH] Search complete.');
        process.exit(0);
    }

    const v = variations[index];
    console.log(`\n--- TESTING ${v.name} ---`);
    const ws = new WebSocket(gateway);

    ws.on('open', () => {
        // Step 1: Trigger Challenge
        const stage1 = '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '"}},"id":1}';
        ws.send(stage1);
    });

    ws.on('message', (data) => {
        const raw = data.toString();
        const msg = JSON.parse(raw);

        if (msg.type === "event" && msg.event === "connect.challenge") {
            const nonce = msg.payload.nonce;
            console.log(`[RECV] Challenge Received (nonce=${nonce.substring(0,8)}...). Sending ${v.name}...`);
            ws.send(v.payload(nonce));
        } else if (msg.id === 2) {
            console.log(`[RECV] Response for ${v.name}:`, raw);
            if (msg.result) {
                console.log(`[SUCCESS] ${v.name} matched! Result:`, JSON.stringify(msg.result));
                process.exit(0);
            }
            ws.close();
        } else if (msg.error) {
            console.log(`[ERR] Server Error:`, JSON.stringify(msg.error));
            ws.close();
        }
    });

    ws.on('close', () => {
        setTimeout(() => tryVariation(index + 1), 1000);
    });

    setTimeout(() => {
        console.log(`[TIMEOUT] ${v.name} gave no response.`);
        ws.close();
    }, 5000);
}

tryVariation(0);
