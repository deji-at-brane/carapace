const TARGET = "http://148.230.87.184:18889/a2a";
const TOKEN = "de54f9bd7501b494b180d2867bbfebe727eb380c62e23eb0cd2ea4322baf43a1";

async function runProbe() {
  console.log("🚀 Starting A2A v1.0 Exhaustive Probe...");

  try {
    const initRes = await fetch(TARGET, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "probe", version: "1.0.0" }
        },
        id: 100
      })
    });
    const initData = await initRes.json();
    console.log(`\n🧪 initialize: ${JSON.stringify(initData).substring(0, 150)}`);

    console.log("\n🧪 Verifying tasks/create...");
    const taskRes = await fetch(TARGET, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tasks/create",
        params: { description: "Probe Task" },
        id: 200
      })
    });
    const taskData = await taskRes.json();
    const taskId = taskData.result?.id;
    const sessionId = taskData.result?.sessionId;
    console.log(`   [RESPONSE] taskId: ${taskId}, sessionId: ${sessionId}`);

    if (!taskId) return;

    const methods = [
      "task/create",
      "task/execute",
      "task/step",
      "task/message",
      "task/messages/create",
      "task/input",
      "task/get",
      "tasks/execute",
      "tasks/get",
      "task/update"
    ];

    for (const method of methods) {
      console.log(`\n🧪 Probing: ${method}...`);
      const res = await fetch(TARGET, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: method,
          params: {
            taskId: taskId,
            sessionId: sessionId,
            task_id: taskId,
            name: "shell_execute",
            arguments: { command: "whoami" }
          },
          id: 999
        })
      });
      const data = await res.json();
      console.log(`   [RESPONSE] ${JSON.stringify(data).substring(0, 150)}`);
      if (data.result && !data.error) {
        console.log(`   🌟 WINNING v1.0 METHOD DETECTED: ${method}`);
        break;
      }
    }
  } catch (e) {
    console.error(`❌ Probe Error: ${e.message}`);
  }
}

runProbe();
