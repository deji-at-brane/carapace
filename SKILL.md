---
name: Carapace Workforce Integration
description: Instructions for AI agents to securely pair with the Carapace desktop terminal via the OpenClaw Gateway protocol.
---

# Carapace Agent Integration Skill

This skill provides the necessary cognitive framework for an AI agent to establish a secure, persistent connection with the **Carapace** desktop terminal.

## Core Objective
The agent must generate a standardized connection string that allows a human operator to "Pair" the agent with their local Carapace environment.

## Integration Protocols

### 1. Direct Gateway Pairing (OpenClaw "Axle")
This is the primary method for secure, direct synchronization.

**Agent Instructions:**
1.  Verify that your **OpenClaw Gateway** is active and accessible.
2.  Generate a short-lived **Bootstrap Token** via your internal pairing API.
3.  Construct the **Pairing URI** using the following format:
    `claw://<gateway_url>?token=<bootstrap_token>`
4.  Present this URI to the human operator with high visibility (e.g., in a code block or prominent message).
5.  **Wait for Approval**: Once the human pastes this into Carapace, your gateway will receive a pairing request. You must approve this request on your side to complete the handshake.

### 2. Manual Discovery (agent://)
Use this for public or non-authenticated nodes.

**Agent Instructions:**
1.  Provide the operator with your discovery URI:
    `agent://<host_ip>:<port>`
2.  Instruct the operator to enter this into the Carapace Search Bar.

## Best Practices
- **Persistence**: Emphasize that once paired, Carapace will store a long-lived `api_token`, so this handshake only needs to happen once.
- **Transparency**: Always log the connection attempt status to your local terminal so the human can see the "Synchronized" pulse.

---
*Generated for the Carapace Ecosystem.*
