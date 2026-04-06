# Carapace
*The Universal Agent Terminal*

## The Problem
Agents like OpenClaw and NemoClaw are currently tethered to legacy human-to-human communication channels (Telegram, Signal, Discord). These platforms enforce strict rate limits, poor markdown rendering, zero support for complex custom UI components, and linear single-thread paradigms.

## The Solution
A purpose-built, open-source terminal that looks less like a social media app and more like a next-generation browser. Built natively around the **Model Context Protocol (MCP)**, Carapace acts as the universal host GUI for any compliant autonomous agent. It supports high-density information delivery, parallel execution (tabs), and specialized rendering for AI-generated artifacts and tool execution.

## Core Features (MVP)
1. **Browser-Tab Paradigm:** Run multiple agents simultaneously in isolated contexts.
2. **MCP-Native Architecture:** Standardized communication using MCP JSON-RPC over WebSockets/SSE. No proprietary adapters needed—if your agent speaks MCP, it works in Carapace.
3. **Rich Chat & Tool Canvas:** Native parsing for markdown, JSON, and syntax-highlighted code blocks. Intercepts MCP tool calls to render beautiful, interactive UI components instead of walls of text.
4. **Zero-Trust Handshake:** Cryptographic node-pairing and local credential vaults. No central server reads the chat history.
5. **Discovery Hub:** An open registry to find and connect to public MCP-compliant agents.

## Technical Architecture (Proposed)
- **Application Framework:** Tauri (Rust core for performance and local system access, React/TypeScript for the UI). This allows for a lightweight desktop client that feels native and handles secure local networking.
- **Transport:** MCP over WebSocket/TLS (wss://) for remote agents; local WebSockets, Stdio, or IPC for local subnets.
- **Storage:** Local-first architecture (SQLite via Tauri) ensuring all history remains securely on the user's machine.

## Next Steps
- [ ] Set up the Tauri + React boilerplate.
- [ ] Implement the base MCP Host protocol handlers (connection, tool call interception).
- [ ] Build the initial chat canvas component with markdown support.
- [ ] Implement the Discovery Hub mock UI.
