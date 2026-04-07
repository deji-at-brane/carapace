const WebSocket = require('ws');

const gateway = 'ws://148.230.87.184:18789';
const token = '0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4';

const variations = [
    {
        name: 'VAR_1_REUSE_ID_1',
        payload: (nonce, ts) => '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '","nonce":"' + nonce + '","ts":' + ts + '}},"id":1}'
    },
    {
        name: 'VAR_2_NONCE_PARAMS_ROOT',
        payload: (nonce, ts) => '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '"},"nonce":"' + nonce + '","ts":' + ts + '},"id":2}'
    },
    {
        name: 'VAR_3_NONCE_FRAME_ROOT',
        payload: (nonce, ts) => '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '"}},"nonce":"' + nonce + '","ts":' + ts + ',"id":2}'
    },
    {
        name: 'VAR_4_STR_TS',
        payload: (nonce, ts) => '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '","nonce":"' + nonce + '","ts":"' + ts + '"}},"id":2}'
    },
    {
        name: 'VAR_5_DIRECT_PAIR_WITH_NONCE',
        payload: (nonce, ts) => '{"jsonrpc":"2.0","method":"devices/pair","params":{"bootstrapToken":"' + token + '","deviceName":"Node Search","nonce":"' + nonce + '"},"id":2}'
    }
];

function tryVar(i) {
    if (i >= variations.length) {
        console.log('[FINISH] SEARCH COMPLETE.');
        process.exit(0);
    }

    const v = variations[i];
    console.log(`\n--- TESTING ${v.name} ---`);
    const ws = new WebSocket(gateway);
    
    let stage2Sent = false;
    ws.on('open', () => {
        // Pixel-Perfect Initial Frame
        const stage1 = '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '"}},"id":1}';
        ws.send(stage1);
    });

    ws.on('message', (data) => {
        const raw = data.toString();
        const msg = JSON.parse(raw);

        if (msg.type === "event" && msg.event === "connect.challenge") {
            const { nonce, ts } = msg.payload;
            console.log(`[RECV] Challenge Received (nonce=${nonce.substring(0,8)}). Sending ${v.name}...`);
            stage2Sent = true;
            ws.send(v.payload(nonce, ts));
        } else if (stage2Sent) {
            console.log(`[RECV] Final Response for ${v.name}:`, raw);
            if (msg.result || msg.api_token || msg.statusUrl) {
                console.log(`[SUCCESS] ${v.name} triggered a positive response!`);
                process.exit(0);
            }
            ws.close();
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`[CLOSE] ${v.name}: code=${code} reason=${reason.toString()}`);
        setTimeout(() => tryVar(i + 1), 1000);
    });

    setTimeout(() => {
        if (stage2Sent) {
            console.log(`[TIMEOUT] ${v.name} gave no response.`);
            ws.close();
        }
    }, 5000);
}

tryVar(0);
