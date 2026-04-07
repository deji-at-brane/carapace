const Ajv = require('ajv');
const ajv = new Ajv();

const validateRequestFrame = ajv.compile({
  type: "object",
  required: ["jsonrpc", "method", "params", "id"],
  additionalProperties: false,
  properties: {
    jsonrpc: { const: "2.0" },
    method: { type: "string" },
    params: { type: "object" },
    id: { type: ["string", "number"] }
  }
});

const token = '0lG14GMQM10nK2WXnkQ-Q0whkGgbHEohZnDwzARaGZ4';
const nonce = '7ed1396b-e2b0-432d-84fd-b3d1a95d4839';

const stage1 = '{"jsonrpc":"2.0","method":"connect","params":{"token":"' + token + '"},"id":"1"}';
const stage2 = '{"jsonrpc":"2.0","method":"devices/pair","params":{"bootstrapToken":"' + token + '","deviceName":"Carapace Terminal","nonce":"' + nonce + '"},"id":"2"}';

function test(name, literal) {
    try {
        const obj = JSON.parse(literal);
        const valid = validateRequestFrame(obj);
        console.log(`[${name}] Valid: ${valid}`);
        if (!valid) {
            console.log(`[${name}] ERRORS:`, JSON.stringify(validateRequestFrame.errors));
        }
    } catch (e) {
        console.log(`[${name}] JSON Parse Error: ${e.message}`);
    }
}

test('STAGE 1', stage1);
test('STAGE 2', stage2);
