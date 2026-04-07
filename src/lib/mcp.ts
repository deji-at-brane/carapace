/**
 * Carapace MCP Protocol Implementation
 * Following MCP v1.0.0 (JSON-RPC 2.0)
 */
import { invoke } from "@tauri-apps/api/core";
// import { Child, Command } from "@tauri-apps/plugin-shell";

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface ToolResult {
  content: Array<{ type: string; text?: string; [key: string]: any }>;
  isError?: boolean;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: any;
  error?: any;
}

export interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: any;
}

export interface Transport {
  send(message: any): Promise<void>;
  onMessage(callback: (message: any) => void): void;
  close(): void;
}

/**
 * WebSocket Transport
 */
class WebSocketTransport implements Transport {
  private socket: WebSocket;
  private messageCallback?: (msg: any) => void;

  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (this.messageCallback) this.messageCallback(data);
    };
  }

  async send(message: any) {
    if (this.socket.readyState !== WebSocket.OPEN) {
      await new Promise((resolve) => this.socket.onopen = resolve);
    }
    this.socket.send(JSON.stringify(message));
  }

  onMessage(callback: (message: any) => void) {
    this.messageCallback = callback;
  }

  close() {
    this.socket.close();
  }
}

/**
 * SSE (Server-Sent Events) Transport
 */
class SSETransport implements Transport {
  private eventSource: EventSource | null = null;
  private endpoint: string | null = null;
  private messageCallback?: (msg: any) => void;

  constructor(private url: string) {}

  async send(message: any) {
    if (!this.endpoint) {
      await this.connect();
    }

    const response = await fetch(this.endpoint!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`SSE Post failed: ${response.statusText}`);
    }
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(this.url);
      
      this.eventSource.addEventListener("endpoint", (event: any) => {
        this.endpoint = event.data;
        resolve();
      });

      this.eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (this.messageCallback) this.messageCallback(data);
      };

      this.eventSource.onerror = (err) => {
        reject(err);
      };
    });
  }

  onMessage(callback: (message: any) => void) {
    this.messageCallback = callback;
  }

  close() {
    this.eventSource?.close();
  }
}

/**
 * Main MCP Client
 */
export class MCPClient {
  private transport: Transport;
  private messageId = 0;
  private handlers = new Map<string | number, (res: MCPResponse) => void>();
  private onHandshakePulse?: (msg: string) => void;

  constructor(transport: Transport, onPulse?: (msg: string) => void) {
    this.transport = transport;
    this.onHandshakePulse = onPulse;
    this.transport.onMessage((msg) => this.handleIncoming(msg));
  }

  private handleIncoming(message: any) {
    if (message.id !== undefined) {
      const handler = this.handlers.get(message.id);
      if (handler) {
        handler(message as MCPResponse);
        this.handlers.delete(message.id);
      }
    }
  }

  private request(method: string, params: any = {}): Promise<any> {
    const id = ++this.messageId;
    return new Promise((resolve, reject) => {
      this.handlers.set(id, (res) => {
        if (res.error) reject(res.error);
        else resolve(res.result);
      });
      this.transport.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  private notify(method: string, params: any = {}) {
    this.transport.send({ jsonrpc: "2.0", method, params });
  }

  /**
   * MCP Initialize Handshake
   */
  async initialize(): Promise<any> {
    this.onHandshakePulse?.("[PROTOCOL] Negotiating MCP v1.0.0...");
    
    const result = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "Carapace",
        version: "0.1.0"
      }
    });

    this.onHandshakePulse?.("[PROTOCOL] Server capabilities received.");
    
    // Confirm initialization
    this.notify("notifications/initialized");
    this.onHandshakePulse?.("[SUCCESS] Node Synchronized.");
    
    return result;
  }

  /**
   * List available tools from the server
   */
  async listTools(): Promise<MCPTool[]> {
    const result = await this.request("tools/list");
    return result.tools || [];
  }

  /**
   * Invoke a specific tool
   */
  async callTool(name: string, args: any = {}): Promise<ToolResult> {
    return await this.request("tools/call", {
      name,
      arguments: args
    });
  }

  close() {
    this.transport.close();
  }
}

import { IdentityManager } from './crypto';

/**
 * Hermes / OpenClaw Gateway Pairing Manager
 */
export class ClawPairingManager {
  /**
   * Initiates the native multi-stage handshake via the Rust backend.
   * This bypasses the browser's forced Origin header.
   */
  static async initiate(wsUrl: string, bootstrapToken: string): Promise<any> {
    console.log("[PROTOCOL] Starting Native Handshake (CORS-free)...");
    
    // Determine base URL for credential storage with HTTPS awareness
    let gatewayBase = wsUrl.replace(/^ws/, 'http').replace(/^claw/, 'http').replace(/^agent/, 'http').replace(/\/$/, '');
    
    // Intelligent upgrade to HTTPS for Cloud/Secure Gateways
    if (gatewayBase.includes(':443') || (gatewayBase.includes('[') && !gatewayBase.includes(':'))) {
      gatewayBase = gatewayBase.replace('http:', 'https:');
    }
    
    const finalGateway = gatewayBase.startsWith('http') ? gatewayBase : `https://${gatewayBase}`;

    try {
      const identity = IdentityManager.getIdentity();
      
      // Phase 1 + 2: Native Handshake (Now includes HTTP registration in Rust)
      console.log("[NATIVE] Initiating secure pairing via Rust backend...");
      const challenge: { nonce: string; ts: number } = await invoke("mcp_start_pairing", {
        url: wsUrl,
        bootstrapToken: bootstrapToken,
        deviceId: identity.deviceId,
        deviceName: "Carapace Terminal"
      });

      console.log("[TRANSPORT] Challenge received via Rust. Stage 2: Generating proof.");
      
      // Sign the challenge using the persistent Device Identity (Now ASYNC)
      const identityProof = await IdentityManager.signChallenge(challenge.nonce, challenge.ts, bootstrapToken);

      // Stage 2: Send identity proof, auth token, and complete pairing
      console.log("[NATIVE] Completing handshake with signed identity Proof.");
      const resultJson: string = await invoke("mcp_finish_pairing", {
        deviceIdentity: identityProof,
        bootstrapToken: bootstrapToken
      });

      console.log("[NATIVE] Final Pairing Result: " + resultJson);
      
      // Parse the final result to extract the permanent session token
      const authResult = JSON.parse(resultJson);
      if (!authResult.ok) {
        throw new Error(authResult.error?.message || "Pairing failed");
      }

      const sessionToken = authResult.payload?.api_token || authResult.payload?.token || bootstrapToken;
      
      return {
        api_token: sessionToken,
        gatewayUrl: finalGateway
      }; 
    } catch (error) {
      console.error("[PROTOCOL ERROR] Handshake failed:", error);
      throw error;
    }
  }

  static async pollStatus(statusUrl: string): Promise<{ status: string; api_token?: string }> {
    const response = await fetch(statusUrl);
    if (!response.ok) throw new Error("Status check failed");
    return await response.json();
  }
}

/**
 * Transport Factory Helper
 */
export function createTransport(uri: string): Transport {
  const url = new URL(uri);
  if (url.protocol === "ws:" || url.protocol === "wss:") {
    return new WebSocketTransport(uri);
  }
  if (url.protocol === "http:" || url.protocol === "https:") {
    return new SSETransport(uri);
  }
  if (url.protocol === "claw:" || url.protocol === "agent:") {
    // Protocol normalization for WebSocket transport
    const wsUri = uri.replace(/^(claw|agent):/, "ws:");
    return new WebSocketTransport(wsUri);
  }
  // Default to WS for MVP, add Stdio/SSE as needed
  throw new Error(`Unsupported transport protocol: ${url.protocol}`);
}

/**
 * URI Parser for agent:// and claw://
 */
export function parseAgentUri(uri: string) {
  try {
    const url = new URL(uri);
    return {
      host: url.host, // Using url.host to include the port automatically
      port: url.port,
      path: url.pathname,
      protocol: url.protocol,
      token: url.searchParams.get("token"),
      url: url.toString()
    };
  } catch (e) {
    return null;
  }
}
