const WebSocket = require('ws');

const HOST = "srv1538195.hstgr.cloud";
const PATH = "/vss/ws/";

async function testUri(uri) {
    console.log(`[TESTING] ${uri} ...`);
    return new Promise((resolve) => {
        const ws = new WebSocket(uri);
        ws.on('open', () => {
            console.log(`[SUCCESS] Connected to ${uri}`);
            ws.close();
            resolve(true);
        });
        ws.on('error', (err) => {
            console.log(`[FAILED] ${uri}: ${err.message}`);
            resolve(false);
        });
        setTimeout(() => { ws.close(); resolve(false); }, 5000);
    });
}

async function main() {
    await testUri(`ws://${HOST}${PATH}`);
    await testUri(`wss://${HOST}${PATH}`);
}

main();
