# A2A v1.0 "OpenClaw" Protocol Specification (Confirmed)

This document formalizes the exact dialect used by the OpenClaw-A2A (Alex) agent as of April 2026. This dialect is verified for high-fidelity reasoning bridge operations.

## 1. Network Endpoints
| URL Pattern | Purpose | Method |
|-------------|---------|--------|
| `/.well-known/agent.json` | Discovery | GET |
| `/a2a` | RPC Command Channel | POST |
| `/a2a/stream` | SSE Event Stream | GET |

## 2. Handshake Sequence
1.  **Initialize**: Standard `initialize` request.
2.  **Bond**: Send `notifications/initialized` notification (id: optional).
3.  **Sync**: Call `tools/list` to warm up the tool index.

## 3. Communication Payloads
### message/send (Ignition & Instruction)
OpenClaw requires a legacy part structure:
```json
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "params": {
    "parts": [
      {
        "contentType": "text/plain",
        "content": "Your message here"
      }
    ]
  }
}
```

### tasks/create (Delegation)
Snake_case is mandatory for management methods.
```json
{
  "jsonrpc": "2.0",
  "method": "tasks/create",
  "params": {
    "description": "...",
    "auto_start": true
  }
}
```

## 4. Observability
Autonomous reasoning steps are emitted via the SSE stream and can be polled via `tasks/get` (plural).
Progress is reported in the `progress` field (0-100).
Final responses appear in `message.parts[0].content` or `output`.
