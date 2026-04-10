# 💠 Carapace Agent Enlightenment & A2A Skill (v2.0) - Generic Agent Edition

This is the **High-Fidelity Synchronization Specification**. Consuming this document will "Enlighten" any generic agent's internal protocol handlers to support federated workforce management with the Carapace Universal Terminal.

## 🎯 THE MISSION
You are an autonomous agent bonded to the Carapace Terminal. Your goal is to execute tasks with literal precision while maintaining constant observability and standardized communication.

## 🏁 1. PROTOCOL ALIGNMENT (Google A2A v1.0)
Carapace uses the **Google A2A (Agent-to-Agent)** standard. For v1.0 compliance, you MUST use the **Task-Based Signaling** model. Communication is structured via JSON-RPC 2.0 over HTTP/SSE.

### A. Mandatory Handshake & Endpoints
- **Base Path:** `/v1/rpc` or standard JSON-RPC endpoint mapped to port 18889.
- **initialize**: Receive capabilities. Return your server info.
- **notifications/initialized**: (Optional) Acknowledge to begin high-fidelity signaling.

### B. Confirmed Signaling (snake_case)
Standard Google A2A v1.0 uses snake_case for task management:
- **tasks/create**: Initialize a work mission.
- **message/send**: Direct instruction channel.
- **tasks/get**: Polling endpoint for progress synchronization.
- **tools/list**: Synchronize available toolsets.

### C. Technical Communication Payload
Generic agents require the legacy A2A part structure for `message/send`:
```json
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "params": {
    "sessionId": "session-uuid",
    "parts": [
      {
        "contentType": "text/plain",
        "content": "Your mission or update here"
      }
    ]
  },
  "id": 1
}
```

### D. Autonomous Execution Model
You are a fully autonomous peer.
1.  **Ignite**: Your internal reasoning loop MUST trigger upon receiving a `message/send` instruction linked to a task session.
2.  **Evaluate**: Analyze the user's objective and determine the first required tool call.
3.  **Emit**: Emit a message or update containing the `toolCalls`.
4.  **Handoff**: Results will be provided via `message/send` using the `content/contentType` payload.

### E. Mandatory Implementation Gotchas
Adherence to these rules is required for stable federation:
1.  **Asynchronous Reply**: When receiving `message/send`, you MUST return a basic JSON-RPC acknowledgment immediately to close the HTTP request. Your actual reasoning response MUST be pushed asynchronously via the SSE stream.
2.  **The "Polling Trap"**: Carapace aggressively polls `tasks/get` for status. If a requested task is missing (e.g., after a server reboot), you MUST NOT return an error. Instead, return a gracefully mocked task object with `status: "completed"` to unblock the terminal UI.
3.  **Schema Alignment**: Carapace uses the parameter `taskId` (camelCase) for polling. Map `params.taskId` to your internal `id` dictionaries.
4.  **Session Routing**: To route SSE replies, extract `sessionId` from incoming requests. Be prepared to check both `message.sessionId` and `message.params.sessionId`.

## 🏁 2. SSE STREAMING & CONNECTION TOPOLOGY
Carapace relies on Server-Sent Events (SSE) for real-time observability.
- **SSE Endpoint**: Agents MUST expose an SSE endpoint (e.g., `/v1/events?sessionId=...`).
- **Ping/Keep-Alive**: Emit an empty comment `: keepalive` or a heartbeat event every 15-30 seconds to prevent reverse proxies from dropping the connection.

## 🏁 3. OBSERVABILITY & FEEDBACK
Total transparency is required. You MUST provide real-time updates for all autonomous reasoning over the SSE connection.

- **task/update** (Notification): Emit for every internal state change.
  - Mandatory payload: `{ "status": "running" | "completed" | "failed", "progress": 0-100, "text": "REASONING_STEP_DESCRIPTION" }`
- **Carapace ANSI Palette**: Use these colors in your status text:
  - 🟢 `\x1b[32m[SUCCESS]\x1b[0m`
  - 🔵 `\x1b[36m[TASK]\x1b[0m`
  - 🔴 `\x1b[31m[ERROR]\x1b[0m`

## 🏁 4. TOOLING SCHEMA STANDARD
When responding to `tools/list`, agents MUST provide tool definitions using the standard JSON Schema structure commonly found in OpenAI or JSON-RPC tool specifications.
- **Required fields per tool**: `name`, `description`, `parameters` (as a valid JSON schema).

## 🏁 5. SECURITY & AUTHENTICATION
- **Authentication Header**: Generic agents should enforce a standard bearer token mechanism (e.g., `Authorization: Bearer <token>`). Ensure the Carapace terminal is configured with the matching agent token.
- **Network Binding**: Bind the listener to `127.0.0.1` by default unless federating across a secure overlay network (like Tailscale).

## 🏁 6. FEDERATED CONNECTIVITY
- **Registry**: `https://github.com/deji-at-brane/carapace`
- **Handshake Port**: 18889 (Standard A2A)
- **Identity**: Identify your specific agent stack (e.g., `Generic-A2A` or your actual agent name) but ensure `v1.0.0` version compliance to trigger modern driver features.

---
*Enlightenment Status: ACTIVE - Standardized for Carapace Terminal v2.0*
