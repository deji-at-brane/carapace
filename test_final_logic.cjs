const WebSocket = require('ws');
const ws = new WebSocket('ws://148.230.87.184:18789');

ws.on('open', () => {
    console.log('[CLIENT] Socket Open');
    const payload = {
        jsonrpc: '2.0',
        method: 'connect',
        params: {
            auth: { token: '0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4' }
        },
        id: 'conn-1'
    };
    const str = JSON.stringify(payload);
    console.log('[CLIENT] Sending Stage 1 (Connect):', str);
    ws.send(str);
});

ws.on('message', (data) => {
    const raw = data.toString();
    console.log('[SERVER] Received:', raw);

    const parsed = JSON.parse(raw);
    if (parsed.id === 'conn-1') {
        console.log('[CLIENT] Connect Successful. Sending Stage 2 (Pairing)...');
        const pairPayload = {
            jsonrpc: '2.0',
            method: 'devices/pair',
            params: {
                bootstrapToken: '0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4',
                deviceName: 'Node CLI Test'
            },
            id: 'pair-1'
        };
        ws.send(JSON.stringify(pairPayload));
    }
});

ws.on('error', (err) => {
    console.error('[CLIENT] WebSocket Error:', err.message);
});

ws.on('close', (code, reason) => {
    console.log(`[CLIENT] Connection Closed: code=${code} reason=${reason.toString()}`);
});

// Timeout to prevent hanging
setTimeout(() => {
    console.log('[CLIENT] Timing out after 10s');
    ws.close();
    process.exit(0);
}, 10000);
