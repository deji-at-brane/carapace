# Carapace Agent Integration Strategy

This document outlines the two-phase approach for connecting the Carapace desktop terminal (Tauri/React) to any OpenClaw agent, whether running locally or on a remote VPS. It is designed to be ingested by a coding agent (e.g., Antigravity) to implement the Carapace client-side architecture.

## Phase 1: Direct Gateway Pairing (The "Axle")
**Goal:** Utilize the existing OpenClaw Gateway to establish a direct, secure connection between Carapace and the Agent using OpenClaw's native Device Pairing Protocol.

### The Auth Flow (Implementation Guide for Carapace)
Carapace must implement the client side of the OpenClaw device pairing handshake. 

1. **Ingest Connection String:**
   - The user provides Carapace with a setup URI: `claw://<gatewayUrl>?token=<bootstrapToken>`
   - *Task:* Implement a parser to extract the `gatewayUrl` (e.g., `100.x.y.z:8000` or `localhost:8000`) and the `bootstrapToken`.

2. **The Handshake (Bootstrap Exchange):**
   - *Task:* Carapace makes a `POST` request to `<gatewayUrl>/api/v1/devices/pair` (or equivalent OpenClaw bootstrap endpoint) passing the `bootstrapToken`.
   - *State Management:* Carapace must enter a "Waiting for host approval..." state. The response from the Gateway will indicate that the pairing is pending human approval on the agent's side.

3. **Polling / WebSocket Listen:**
   - *Task:* Carapace must maintain a connection (or poll the status endpoint provided in the pairing response) waiting for the `APPROVED` signal.

4. **Token Persistence:**
   - Once the user approves the pairing via the agent, the Gateway responds to Carapace with a long-lived, client-scoped `api_token`.
   - *Task:* Store this `api_token` securely (e.g., using Tauri's secure keystore/stronghold).
   - For all future sessions, Carapace uses this `api_token` in the `Authorization: Bearer <token>` header to connect directly via WebSockets or SSE to `<gatewayUrl>`.

## Phase 2: The drive.io Relay (The "Nervous System")
**Goal:** Eliminate network topology constraints completely (no NAT punching, no Tailscale required) by routing communications through a centralized drive.io relay.

### The Relay Flow (Implementation Guide for Carapace)
Instead of connecting directly to the agent's IP, Carapace acts as a client to a centralized drive.io WebSocket relay.

1. **Session Ingestion:**
   - The user provides Carapace with a drive.io relay URI (e.g., `relay://drive.io/room/<roomId>?auth=<clientToken>`).

2. **Outbound Connection:**
   - *Task:* Establish an outbound WebSocket connection to the drive.io relay using the provided room ID and auth token.
   - The remote agent will simultaneously connect to this same room.

3. **Artifact Handling (Core UI Task):**
   - Carapace is not just a text terminal; it is an artifact renderer.
   - *Task:* Implement a robust JSON payload parser for incoming WebSocket messages.
   - Messages will come in two primary types:
     - `type: "text"` -> Render as standard markdown.
     - `type: "artifact"` -> Look up the corresponding React UI component based on the artifact's metadata schema and render the structured data natively.