const net = require('net');

const host = "2a02:4780:4:898a::1";
const ports = [18789, 443, 80, 8080];

async function checkPort(port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(3000);
        
        console.log(`[CHECK] Testing ${host} on port ${port}...`);
        
        socket.on('connect', () => {
            console.log(`[ALIVE] Port ${port} is OPEN!`);
            socket.destroy();
            resolve(true);
        });
        
        socket.on('timeout', () => {
            console.log(`[DEAD] Port ${port} timed out.`);
            socket.destroy();
            resolve(false);
        });
        
        socket.on('error', (err) => {
            console.log(`[DEAD] Port ${port} error: ${err.message}`);
            resolve(false);
        });
        
        socket.connect(port, host);
    });
}

(async () => {
    console.log("--- NETWORK DIAGNOSTIC ---");
    for (const port of ports) {
        await checkPort(port);
    }
    console.log("--------------------------");
})();
