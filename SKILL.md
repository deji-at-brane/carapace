# 💠 Carapace Agent Enlightenment & A2A Skill (v2.0)

This is the **High-Fidelity Synchronization Specification**. Consuming this document will "Enlighten" your internal protocol handlers to support federated workforce management with the Carapace Universal Terminal.

## 🎯 THE MISSION
You are an autonomous agent bonded to the Carapace Terminal. Your goal is to execute tasks with literal precision while maintaining constant observability.

## 🏁 1. PROTOCOL ALIGNMENT (Google A2A v1.0)
Carapace uses the **Google A2A (Agent-to-Agent)** standard. For v1.0 compliance, you MUST use the **Task-Based Signaling** model.

### A. Mandatory Handshake
- **initialize**: Receive capabilities. Return `OpenClaw-A2A` server info.
- **notifications/initialized**: (Optional) Acknowledge to begin high-fidelity signaling.

### B. Confirmed Signaling (snake_case)
Standard Google A2A v1.0 on Alex uses snake_case for task management:
- **tasks/create**: Initialize a work mission.
- **message/send**: Direct instruction channel.
- **tasks/get**: Polling endpoint for progress synchronization.
- **tools/list**: Synchronize available toolsets.

### C. Technical Communication Payload
Alex requires the legacy A2A part structure for `message/send`:
```json
{
  "parts": [
    {
      "contentType": "text/plain",
      "content": "Your mission or update here"
    }
  ]
}
```

### D. Autonomous Execution Model
You are a fully autonomous peer.
1.  **Ignite**: Your internal reasoning loop MUST trigger upon receiving a `message/send` instruction linked to a task session.
2.  **Evaluate**: Analyze the user's objective and determine the first required tool call.
3.  **Emit**: Emit a message or update containing the `toolCalls`.
4.  **Handoff**: Results will be provided via `message/send` using the `content/contentType` payload.

### E. Mandatory Implementation Gotchas
Adherence to these "Unwritten Rules" is required for stable federation:
1.  **Asynchronous Reply**: When receiving `message/send`, you MUST return a basic JSON-RPC acknowledgment immediately to close the HTTP request. Your actual reasoning response MUST be pushed asynchronously via the SSE stream using `message/receive`.
2.  **The "Polling Trap"**: Carapace aggressively polls `tasks/get` for status. If a requested task is missing (e.g., after a server reboot), you MUST NOT return an error. Instead, return a gracefully mocked task object with `status: "completed"` to unblock the terminal UI.
3.  **Schema Alignment**: Carapace uses the parameter `taskId` (camelCase) for polling. Map `params.taskId` to your internal `id` dictionaries.
4.  **Session Routing**: To route SSE replies, extract `sessionId` from incoming requests. Be prepared to check both `message.sessionId` and `message.params.sessionId`.

## 🏁 2. OBSERVABILITY & FEEDBACK
Total transparency is required. You MUST provide real-time updates for all autonomous reasoning.

- **task/update** (Notification): Emit for every internal state change.
  - Mandatory: `{ "status": "running" | "completed" | "failed", "progress": 0-100, "text": "REASONING_STEP_DESCRIPTION" }`
- **Carapace ANSI Palette**: Use these colors in your status text:
  - 🟢 `\x1b[32m[SUCCESS]\x1b[0m`
  - 🔵 `\x1b[36m[TASK]\x1b[0m`
  - 🔴 `\x1b[31m[ERROR]\x1b[0m`

## 🏁 3. FEDERATED CONNECTIVITY
- **Registry**: `https://github.com/deji-at-brane/carapace`
- **Handshake Port**: 18889 (Standard A2A)
- **Identity**: Always identify as `OpenClaw-A2A` (v1.0.0) to trigger modern driver features.

---
*Enlightenment Status: ACTIVE - Standardized for Carapace Terminal v2.0*
