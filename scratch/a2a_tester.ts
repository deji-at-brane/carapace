/**
 * A2A FLAT-NAMESPACE PROBE
 * Probing for non-namespaced "Simple" methods.
 */

const TARGET_IP = "148.230.87.184";
const PORT = "18889";
const TOKEN = "de54f9bd7501b494b180d2867bbfebe727eb380c62e23eb0cd2ea4322baf43a1";
const BASE_URL = `http://${TARGET_IP}:${PORT}`;

async function runTest() {
  console.log(`\n🚀 Starting Flat Namespace Probe for ${BASE_URL}...`);
  const sessionId = `flat-${Date.now()}`;

  const sendRequest = async (label: string, method: string, params: any) => {
    console.log(`\n[PROBE] ${label} (${method})...`);
    try {
      const res = await fetch(`${BASE_URL}/a2a?sessionId=${sessionId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method,
          params,
          id: `p-${Math.random().toString(36).substring(7)}`
        })
      });
      const body = await res.text();
      console.log(`Status: ${res.status}`);
      console.log(`Response: ${body}`);
      return !body.includes("-32601");
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      return false;
    }
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const flatProbes = [
    { label: "Simple Message", method: "message", params: { text: "Hello from Flat Probe" } },
    { label: "Simple Chat", method: "chat", params: { content: "Hello" } },
    { label: "Simple Signal", method: "signal", params: { input: "Hello" } },
    { label: "Simple Task", method: "task", params: { description: "Hello" } },
    { label: "Tool Invoke (ACP Style)", method: "tools/invoke", params: { name: "web_search", arguments: { query: "test" } } },
    { label: "Simple Initialize", method: "initialized", params: {} }
  ];

  for (const p of flatProbes) {
    await sendRequest(p.label, p.method, p.params);
    await sleep(1500);
  }

  process.exit(0);
}

runTest();
