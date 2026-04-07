const WebSocket = require('ws');

const gateway = 'ws://148.230.87.184:18789';
const token = '0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4';

const variations = [
    {
        name: 'VAR 1: Connect (Nonce at Params Root)',
        payload: (nonce, ts) => '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '"},"nonce":"' + nonce + '","ts":' + ts + '},"id":2}'
    },
    {
        name: 'VAR 2: Authenticate Method',
        payload: (nonce, ts) => '{"jsonrpc":"2.0","method":"authenticate","params":{"token":"' + token + '","nonce":"' + nonce + '","ts":' + ts + '},"id":2}'
    },
    {
        name: 'VAR 3: Direct Pairing with Nonce',
        payload: (nonce, ts) => '{"jsonrpc":"2.0","method":"devices/pair","params":{"bootstrapToken":"' + token + '","deviceName":"Node Final","nonce":"' + nonce + '","ts":' + ts + '},"id":2}'
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
    
    let stage2Sent = false;
    ws.on('open', () => {
        // Canonical Frame 1 (Nested Auth)
        const stage1 = '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '"}},"id":1}';
        ws.send(stage1);
    });

    ws.on('message', (data) => {
        const raw = data.toString();
        const msg = JSON.parse(raw);

        if (msg.type === "event" && msg.event === "connect.challenge") {
            const { nonce, ts } = msg.payload;
            console.log(`[RECV] Challenge Received (ts=${ts}). Sending ${v.name}...`);
            stage2Sent = true;
            ws.send(v.payload(nonce, ts));
        } else if (stage2Sent) {
            console.log(`[RECV] Response for ${v.name}:`, raw);
            if (msg.result || msg.api_token || msg.statusUrl) {
                console.log(`[SUCCESS] ${v.name} triggered a positive response!`);
                process.exit(0);
            }
            ws.close();
        }
    });

    ws.on('close', () => {
        setTimeout(() => tryVariation(index + 1), 1000);
    });

    setTimeout(() => {
        if (stage2Sent) {
            console.log(`[TIMEOUT] ${v.name} gave no response.`);
            ws.close();
        }
    }, 5000);
}

tryVariation(0);
