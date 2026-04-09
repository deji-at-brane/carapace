# A2A Signal Protocol Specification (v1.0.0)

This document defines the official **Carapace A2A (Agent-to-Agent)** signaling interface. It is the authoritative standard for any autonomous agent that wishes to synchronize with the Carapace Universal Terminal.

## 1. Transport Layer
Carapace uses a **Synchronous Signaling / Asynchronous Response** model:
- **Signaling**: HTTP POST requests with JSON-RPC 2.0 payloads.
- **Streaming**: Server-Sent Events (SSE) for real-time result streaming.

## 2. The Identity Handshake
Before signaling begins, the client and agent MUST synchronize state.

### Initial Handshake
- **Method**: `initialize`
- **Params**:
  ```json
  {
    "protocolVersion": "2024-11-05",
    "capabilities": { "streaming": true },
    "clientInfo": { "name": "carapace-terminal", "version": "2.0.0" }
  }
  ```

### Handshake Completion
Upon successful response, the client will send the following notification:
- **Method**: `notifications/initialized`

## 3. High-Fidelity Signaling (Messaging)
Direct human-to-agent communication is performed via the namespaced `message/` channel.

- **Method**: `message/send`
- **Params**:
  ```json
  {
    "parts": [
      {
        "contentType": "text/plain",
        "content": "USER_INPUT_TEXT"
      }
    ]
  }
  ```

## 4. Observability Standard
Agents MUST provide granular feedback for all internal operations.

- **Method**: `task/update` (Notification)
- **Params**:
  ```json
  {
    "status": "running" | "completed" | "failed",
    "progress": 0-100,
    "text": "Human-readable status update"
  }
  ```

## 5. Session Bonding
All JSON-RPC requests MUST include the `sessionId` provided during the initial stream connection (usually via query parameter) to ensure correct routing of asynchronous results.

---
*Status: FINALIZED - Adopted by Carapace Terminal v2.0*
