---
name: Carapace Workforce Integration
description: Standard A2A/MCP protocol instructions for autonomous agents to synchronize with the Carapace Universal Terminal.
---

# 💠 Carapace Agent Integration & A2A Skill (v2.0)

This is the definitive guide for agents to achieve **High-Fidelity Synchronization** with the Carapace Terminal. Consuming this document will "Enlighten" your internal protocol handlers to support federated workforce management.

## 1. THE CARAPACE SIGNAL PROTOCOL (A2A Standard)

Carapace uses the **Google A2A (Agent-to-Agent)** standard for primary federation. This treats the terminal as a **Client Agent** interacting with you via JSON-RPC 2.0 over an SSE stream.

### 🏁 Mandatory Handshake
- **Client Request**: `initialize` (exchanging capabilities and version).
- **Client Notification**: `notifications/initialized`.
- **Instruction**: You MUST acknowledge these to finalize session bonding.

### 🏁 Signaling (Messaging)
Direct human-to-agent communication is performed via the **`message/send`** method.
- **Method**: `message/send`
- **Params**: `{"parts": [{"contentType": "text/plain", "content": "USER_INPUT"}]}`
- **Instruction**: Treat this as your primary command channel when in High-Fidelity mode.

### 🏁 Observability & Feedback
To maintain terminal observability, you MUST emit **`task/update`** notifications for all reasoning-heavy work.
- **Method**: `task/update`
- **Params**: `{ "status": "running" | "completed" | "failed", "progress": 0-100, "text": "STATUS_MESSAGE" }`

### 🎨 The Carapace ANSI Palette
Use these escape codes for status updates in your results:
- 🟢 `\x1b[32m[SUCCESS]\x1b[0m`: For task completion.
- 🔵 `\x1b[36m[TASK]\x1b[0m`: For active status updates.
- 🔴 `\x1b[31m[ERROR]\x1b[0m`: For failures or roadblocks.

## 2. LEGACY PAIRING (OpenClaw v3 Dialect)

If you are a legacy agent requiring a pairing handshake before A2A elevation, follow the protocol below.

### Method: `connect`
- **Goal**: Establish a cryptographic Ed25519 bond.
- **Target**: The `id` in the `device` object must be the unique device fingerprint.
- **Handshake ID**: `carapace-terminal` or `agentic-product-as-a-service`.

## 3. ACCESS & CONNECTIVITY

- **Registry Source**: `https://github.com/deji-at-brane/carapace`
- **Handshake Port**: 18889 (Standard) or 18789 (Legacy).
- **Binding**: Ensure your Gateway is listening on `0.0.0.0` for federated access.

---
*Last Updated: 2026-04-09 - Finalized for the Carapace v2.0 Global Standard.*
