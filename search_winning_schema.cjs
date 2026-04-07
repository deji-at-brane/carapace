const WebSocket = require('ws');
const fs = require('fs');

const gateway = 'ws://148.230.87.184:18789';
const token = '0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4';

const variations = [
    // 1. Literal Order (Expert suggestion - String id)
    { name: 'VAR_1_EXP_STR_ID', literal: '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '"}},"id":"1"}' },
    // 2. Literal Order (Expert suggestion - Num id)
    { name: 'VAR_2_EXP_NUM_ID', literal: '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '"}},"id":1}' },
    // 3. ID First (Common with some parsers)
    { name: 'VAR_3_ID_FIRST', literal: '{"id":1,"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '"}}}' },
    // 4. Flattened params (Bootstrap token directly)
    { name: 'VAR_4_FLAT_TOKEN', literal: '{"jsonrpc":"2.0","method":"connect","params":{"token":"' + token + '"},"id":1}' },
    // 5. Explicit bootstrapToken name
    { name: 'VAR_5_BOOTSTRAP_NAME', literal: '{"jsonrpc":"2.0","method":"connect","params":{"bootstrapToken":"' + token + '"},"id":1}' },
    // 6. Simple auth string
    { name: 'VAR_6_SIMPLE_AUTH', literal: '{"jsonrpc":"2.0","method":"connect","params":{"auth":"' + token + '"},"id":1}' },
    // 7. No internal spaces (Extreme minification)
    { name: 'VAR_7_ULTRA_MIN', literal: '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"'+token+'"}},"id":1}' },
    // 8. Trailing newline
    { name: 'VAR_8_NEWLINE', literal: '{"jsonrpc":"2.0","method":"connect","params":{"auth":{"token":"' + token + '"}},"id":1}\n' },
    // 9. Standard JSON-RPC 2.0 (No params, just to check frame acceptance)
    { name: 'VAR_9_MINIMAL_FRAME', literal: '{"jsonrpc":"2.0","method":"connect","id":1}' }
];

let finalResults = [];

function tryVar(i) {
    if (i >= variations.length) {
        fs.writeFileSync('brute_force_results.json', JSON.stringify(finalResults, null, 2));
        console.log('[FINISH] SEARCH COMPLETE.');
        process.exit(0);
    }

    const v = variations[i];
    console.log(`[TESTING] ${v.name}`);
    const ws = new WebSocket(gateway);
    
    let received = false;
    ws.on('open', () => {
        ws.send(v.literal);
    });

    ws.on('message', (data) => {
        received = true;
        const resp = data.toString();
        finalResults.push({ name: v.name, payload: v.literal, response: resp });
        console.log(`[RECV] ${v.name}: ${resp}`);
        ws.close();
    });

    ws.on('error', (err) => {
        finalResults.push({ name: v.name, payload: v.literal, error: err.message });
        console.log(`[ERR] ${v.name}: ${err.message}`);
        ws.close();
    });

    setTimeout(() => {
        if (!received) {
            finalResults.push({ name: v.name, payload: v.literal, timeout: true });
            console.log(`[TIMEOUT] ${v.name}`);
            ws.close();
        }
        setTimeout(() => tryVar(i + 1), 500);
    }, 2000);
}

tryVar(0);
