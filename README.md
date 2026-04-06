# Carapace (Placeholder Name)
*The Universal Agent Terminal*

## The Problem
Agents like OpenClaw and NemoClaw are currently tethered to legacy human-to-human communication channels (Telegram, Signal, Discord). These platforms enforce strict rate limits, poor markdown rendering, zero support for complex custom UI components, and linear single-thread paradigms.

## The Solution
A purpose-built, open-source terminal that looks less like a social media app and more like a next-generation browser. It supports high-density information delivery, parallel execution (tabs), and specialized rendering for AI-generated artifacts.

## Core Features (MVP)
1. **Browser-Tab Paradigm:** Run multiple agents simultaneously in isolated contexts.
2. **The Agent URI Scheme:** Standardized routing via `agent://[credentials]@[host]:[port]/[agent-id]`.
3. **Rich Chat Canvas:** Native parsing for markdown, JSON, syntax-highlighted code blocks, and live PTY execution streams.
4. **Zero-Trust Handshake:** Cryptographic node-pairing and local credential vaults. No central server reads the chat history.
5. **Discovery Hub:** An open registry to find and connect to public agents.

## Technical Architecture (Proposed)
- **Application Framework:** Tauri (Rust core for performance and local system access, React/TypeScript for the UI). This allows for a lightweight desktop client that feels native and handles secure local networking better than pure Electron.
- **Transport:** WebSocket over TLS (wss://) for remote agents; local WebSockets or IPC for local subnets.
- **Storage:** Local-first architecture (e.g., IndexedDB or SQLite via Tauri) ensuring all history remains securely on the user's machine.

## Next Steps
- [ ] Define the exact WebSocket payload schema for the `agent://` protocol.
- [ ] Set up the Tauri + React boilerplate.
- [ ] Implement the Discovery Hub mock UI.
- [ ] Build the initial chat canvas component with markdown/PTY support.
