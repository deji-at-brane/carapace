# 💠 Carapace: Universal Agent Terminal

**Carapace** is a high-performance, local-first terminal engine designed for the next generation of **Model Context Protocol (MCP)** agents. It bridges the gap between raw AI capabilities and a professional orchestration cockpit.

![Carapace System Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Protocol](https://img.shields.io/badge/Protocol-MCP v1.0.0-blue)
![Stack](https://img.shields.io/badge/Stack-Tauri + React + SQLite-lightgrey)

## 🚀 Key Features

### 📡 Multi-Transport Handshake
Carapace implements the full **MCP v1.0.0** specification, enabling secure synchronization with any agent node.
*   **Stdio Transport**: Connect to local binaries using `tauri-plugin-shell`.
*   **WebSocket/SSE**: Real-time streaming with remote nodes (optimized for Hetzner and Vercel deployments).
*   **Direct Connect**: Paste any `agent://` or `https://` URI to override local discovery.

### 🧭 Discovery Hub & Registry
A persistent **SQLite-backed registry** that tracks your expert node ecosystem.
*   **Automated Seeding**: Default community nodes (Cloud Researcher, Logic Architect) are available out-of-the-box.
*   **Agent Skill Support**: Agents can now ingest **[SKILL.md](file:///Users/deji.omisore/projects/carapace/SKILL.md)** to learn how to securely pair with Carapace.
*   **Category-Specific Icons**: High-fidelity visual mapping (Compass, CPU, Terminal) for instant recognition.

### 🛠️ Dynamic Tool Drawer
Transform your expert nodes into actionable "Quick Invoke" cards.
*   **Automated Discovery**: Tools are listed instantly upon secure synchronization.
*   **Transparent Invocation**: All tool calls are mirrored in the **Agent Console** for total execution visibility.

### 📼 Local-First Persistence
Your data stays on your machine.
*   **Session Vault**: Full history of orchestration logs and tool results stored in `carapace.db`.
*   **Credential Vault**: (In-Progress) Secure storage for API keys and `Authorization` headers.

## 🛠️ Getting Started

### Prerequisites
*   [Rust](https://www.rust-lang.org/) (for Tauri backend)
*   [Node.js](https://nodejs.org/) (Vite + React frontend)

### Development
```bash
# Install dependencies
npm install

# Start the dev server with Hot Module Replacement
npm run tauri dev
```

### Production Build
```bash
# Build the optimized binary
npm run build
```

## 🏗️ Technical Architecture
*   **Frontend**: React 19 + Tailwind 3.4 (Glassmorphism aesthetics)
*   **Backend**: Tauri v2 (Rust Core)
*   **Storage**: SQLite (`tauri-plugin-sql`)
*   **Console**: Raw `xterm.js` for high-speed protocol mirroring

## 📜 License
Licensed under the Apache 2.0 License.

---
*Built with ❤️ for the Agentic Workforce.*
