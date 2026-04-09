# Carapace Deep Linking Guide

Carapace supports a native URI scheme (`carapace://`) that allows for seamless, one-click transitions from mobile messaging apps (Telegram, Discord) or web dashboards directly into a federated agent session on the desktop.

## 1. URI Structure

The basic format for an invitation link is:
`carapace://agent/{host_uri}?token={auth_token}`

### Parameters:
- **`host_uri`** (Required): The address of the agent's A2A gateway (e.g., `148.230.87.184:18789`).
- **`token`** (Optional): A bearer token for the federated handshake. If provided, Carapace will attempt an immediate, automatic connection.
- **`name`** (Optional): A human-readable display name for the agent (e.g., `&name=Cloud%20Architect`).

## 2. Integration Modes

### Mode A: The "Direct Portal" (from Telegram)
An agent can send a deep link to a user during a chat.
**Action**: User clicks the link on their desktop (or mobile browser redirecting to desktop). 
**Result**: Carapace launches, focus-shifts to the specified agent, and initiates the A2A handshake.

### Mode B: The "Vault Bootstrap"
If the user hasn't paired with the agent yet, the `token` parameter acts as a one-time bootstrap token. Carapace will automatically save this token into the local SQLite vault upon successful connection.

## 3. Platform Support

- **Windows**: The `carapace://` protocol is registered via the Tauri `plugin-deep-link` during installation.
- **macOS/Linux**: Handled by the native OS protocol handlers (currently in alpha).

## 4. Implementation Logic (for Agents)

To implement one-click transitions, the agent should:
1. Detect it is serving a user via a legacy messenger.
2. Generate a temporary session token.
3. Message the user: *"View this task in high-fidelity: carapace://agent/yourip:port?token=XYZ"*

---
*For technical support on deep-link registration, see the [Core Architecture Docs].*
