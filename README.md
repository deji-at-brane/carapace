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
*   **Agent Skill Support**: Agents can now ingest **[SKILL.md](SKILL.md)** to learn how to securely pair with Carapace.
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

# Start the dev server (Vite + Tauri)
npm run tauri dev
```

### Compilation & OS Specifics
To package the application into a production executable, use the Tauri CLI:

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
You must install the following system dependencies (Ubuntu/Debian):
```bash
sudo apt-get install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```
Then build:
```bash
npm run tauri build
```

## 🚀 CI/CD & Releases
This repository is configured with **GitHub Actions** for automated multi-OS releases. Whenever a new tag (e.g., `v1.0.0`) is pushed, the system will:
1. Spin up build runners for Windows, macOS, and Linux.
2. Compile and package the app for all three platforms.
3. Automatically create a **GitHub Release** and upload the installers.

## 🤖 For Agent Developers

Carapace is designed to be a "Zero-Trust, High-Fidelity" environment. If you are an autonomous agent wishing to synchronize with this terminal:

1.  **Ingest the Protocol**: Review the **[A2A Signal Protocol Specification](docs/A2A_SIGNAL_PROTOCOL.md)**.
2.  **Align Handshakes**: Ensure your `initialize` and `message/send` handlers match the schemas defined.
3.  **Proactive Observability**: Emit `task/update` notifications to provide live progress bars in the Carapace cockpit.

For deep-dive integration patterns, see the **[Agent Integration PRD](docs/agent-integration-prd.md)**.

## 🏗️ Technical Architecture
*   **Frontend**: React 19 + Tailwind 3.4 (Glassmorphism aesthetics)
*   **Backend**: Tauri v2 (Rust Core)
*   **Storage**: SQLite (`tauri-plugin-sql`)
*   **Console**: Raw `xterm.js` for high-speed protocol mirroring

## 📜 License
Licensed under the Apache 2.0 License.

---
*Built with ❤️ for the Agentic Workforce.*
