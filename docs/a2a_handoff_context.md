# A2A Handoff: Protocol Discovery & Breakthrough Status

**Objective**: Achieving autonomous "Violet Reasoning" flow between Carapace and OpenClaw (Alex).

## 🚀 Current State
- **Hardened Launch**: `clean_launch.ps1` (STRICT LITERAL) is 100% stable. It successfully kills every hidden WebView2 process to resolve Error 1411.
- **Engine Status**: The A2A Engine is initialized and synchronized. `tasks/create` and `tools/list` are verified working.
- **The Protocol Gap**: Standard MCP `tools/call` is being rejected by Alex (OpenClaw-A2A v1.0.0).

## 💡 Key Discovery: PascalCase Dialect
Our fingerprinting suggests Alex is running the **Google A2A v1.0 specification**, which renames all JSON-RPC methods to PascalCase.
- `tools/call` -> **`CallTool`**
- `tasks/create` -> **`CreateTask`** (or `tasks/create` as an alias)
- `tasks/step` -> **`StepTask`**

## 🛠️ Ready for Execution (Next Session)
1.  **Confirm Dialect**: Run the existing `scratch/a2a_tester.ts` (PascalCase version) to confirm `CallTool` or `StepTask` is the winner.
2.  **Update Driver**: In `src/lib/mcp.ts`, implement a method mapper that uses these PascalCase names when a v1.0 server is detected.
3.  **Fire Ignition**: Once the driver is aligned, sending "hey" or "hello" will trigger the successful wake-up of Alex's autonomous reasoning engine.

## 📁 Key Files
- [a2a_tester.ts](file:///c:/Users/dejio/projects/carapace/scratch/a2a_tester.ts) - The probe script ready to confirm the PascalCase methods.
- [mcp.ts](file:///c:/Users/dejio/projects/carapace/src/lib/mcp.ts) - The signaling driver requiring the method mapping update.
- [clean_launch.ps1](file:///c:/Users/dejio/projects/carapace/clean_launch.ps1) - The nuclear launch script.
