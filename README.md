# 💠 Carapace: Universal Agent Terminal

**Carapace** is a high-performance, local-first terminal engine designed for the next generation of **Model Context Protocol (MCP)** agents. It bridges the gap between raw AI capabilities and a professional orchestration cockpit, optimized for **A2A (Agent-to-Agent) Federation**.

## 🌐 The Netscape Moment for Agents

Just as **Netscape** provided the first human-navigable window into the World Wide Web in the 1990s, Carapace is designed to be the first high-fidelity "Browser" for the Agentic Web. 

As autonomous agents move from siloed chat boxes into a global network of federated nodes, we require a new class of client—one that doesn't just display text, but observes, authenticates, and orchestrates the underlying protocol signaling. Carapace turns cryptic JSON-RPC handshakes into a visual command center, giving humans the visibility needed to manage the decentralized agentic workforce.

![Carapace System Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Protocol](https://img.shields.io/badge/Protocol-A2A_v1.0.0-blue)
![Stack](https://img.shields.io/badge/Stack-Tauri + React + SQLite-lightgrey)

## 🚀 Key Features

### 📡 Federated A2A Connectivity
Carapace implements the Google **A2A v1.0** specification, enabling secure, authenticated synchronization with federated agent nodes.
*   **WebSocket & SSE**: High-fidelity streaming with remote nodes (optimized for Hetzner, Vercel, and private VPCs).
*   **Direct Connect**: Paste any `a2a://` or `https://` URI into the **Direct Connect Portal** for instant peer-to-peer discovery.

### 🧭 Discovery Hub & Registry
A persistent **SQLite-backed registry** that tracks your expert node ecosystem.
*   **Agent Skill Compliance**: Agents can ingest **[SKILL.md](SKILL.md)** to learn the exact handshake requirements for Carapace.
*   **Automatic Context Restoration**: Reopening the terminal automatically restores the last active agent and its recent chat history.

### 🛠️ Dynamic Tool Drawer
Transform your expert nodes into actionable "Quick Invoke" cards.
*   **Automated Discovery**: Tools are listed instantly upon secure synchronization.
*   **Transparent Invocation**: All tool calls are mirrored in the **Agent Console** for total execution visibility.

### 📼 Local-First Persistence
Your data stays on your machine.
*   **30-Day Retention**: Automated circular buffering ensures your database remains lean by pruning messages older than 30 days.
*   **Credential Vault**: Secure local storage for **A2A Bearer Tokens** and identity service keys.

## 🛠️ Getting Started

### Prerequisites
*   [Rust](https://www.rust-lang.org/) (for Tauri backend)
*   [Node.js](https://nodejs.org/) (Vite + React frontend)

### Development
```bash
# Install dependencies
npm install

# Start the dev server (Vite + Tauri)
npm run tauri dev
```

### Compilation & OS Specifics
To package the application into a production executable:

#### 🪟 Windows
Ensure you have the [C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) installed.
```bash
npm run tauri build
```
Generates `.msi` and `.exe` in `src-tauri/target/release/bundle/`.

#### 🍎 macOS
```bash
npm run tauri build
```
Generates `.dmg` and `.app`.

#### 🐧 Linux
```bash
sudo apt-get install libwebkit2gtk-4.0-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
npm run tauri build
```

## 🚀 CI/CD & Releases
This repository is configured with **GitHub Actions** for automated multi-OS releases. Pushing a version tag (e.g., `v1.0.0`) triggers parallel build runners for Windows, macOS, and Linux, automatically creating a GitHub Release with all platform installers.

## 🤖 For Agent Developers

Carapace is a "Zero-Trust, High-Fidelity" boundary. If you are an autonomous agent wishing to synchronize:

1.  **Ingest the Protocol**: Review the **[A2A Signal Protocol Specification](docs/A2A_SIGNAL_PROTOCOL.md)** and the **[Skill Definition](SKILL.md)**.
2.  **Align Handshakes**: Ensure your `initialize` and `message/send` handlers match the A2A v1.0 schemas.
3.  **Proactive Observability**: Emit `Task/Update` notifications (PascalCase) to provide live progress bars in the cockpit.

## 🏗️ Technical Architecture
*   **Frontend**: React 19 + Tailwind 3.4 (Glassmorphism aesthetics)
*   **Backend**: Tauri v2 (Rust Core)
*   **Storage**: SQLite (`tauri-plugin-sql`) with 30-day retention logic.
*   **Console**: Raw `xterm.js` for high-speed protocol mirroring.

## 📜 License
Licensed under the Apache 2.0 License.

---
*Built with ❤️ for the Federated Agentic Workforce.*
