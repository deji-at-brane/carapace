const token = '0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4';
const nonce = '7ed1396b-e2b0-432d-84fd-b3d1a95d4839';

const stage1 = '{"jsonrpc":"2.0","method":"connect","params":{"token":"' + token + '"},"id":"1"}';
const stage2 = '{"jsonrpc":"2.0","method":"devices/pair","params":{"bootstrapToken":"' + token + '","deviceName":"Carapace Terminal","nonce":"' + nonce + '"},"id":"2"}';

function verifyStrict(name, literal) {
    console.log(`\n--- VERIFYING ${name} ---`);
    console.log(`LITERAL: ${literal}`);
    
    try {
        const obj = JSON.parse(literal);
        const keys = Object.keys(obj);
        const required = ["jsonrpc", "method", "params", "id"];
        
        const hasAll = required.every(k => keys.includes(k));
        const hasNoExtras = keys.length === 4;
        
        console.log(`[${name}] Has all required: ${hasAll}`);
        console.log(`[${name}] Has no extras: ${hasNoExtras}`);
        if (!hasNoExtras) {
            console.log(`[${name}] EXTRA KEYS FOUND:`, keys.filter(k => !required.includes(k)));
        }

        console.log(`[${name}] jsonrpc is "2.0": ${obj.jsonrpc === "2.0"}`);
        console.log(`[${name}] method is string: ${typeof obj.method === "string"}`);
        console.log(`[${name}] params is object: ${typeof obj.params === "object" && obj.params !== null}`);
        console.log(`[${name}] id is string/number: ${typeof obj.id === "string" || typeof obj.id === "number"}`);

    } catch (e) {
        console.log(`[${name}] JSON Parse Error: ${e.message}`);
    }
}

verifyStrict('STAGE 1', stage1);
verifyStrict('STAGE 2', stage2);
