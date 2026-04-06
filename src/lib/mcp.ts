/**
 * Carapace MCP Protocol Implementation
 * Following MCP v1.0.0 (JSON-RPC 2.0)
 */
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

/**
 * OpenClaw Gateway Pairing Manager
 */
export class ClawPairingManager {
  static async initiate(gatewayUrl: string, bootstrapToken: string) {
    // 1. Try REST Handshake (as per PRD)
    try {
      const restUrl = gatewayUrl.startsWith("http") ? gatewayUrl : `http://${gatewayUrl}`;
      const response = await fetch(`${restUrl}/api/v1/devices/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: bootstrapToken }),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn("REST pairing failed, falling back to WebSocket...", e);
    }

    // 2. Fallback to WebSocket Handshake (Unified Protocol)
    return new Promise((resolve, reject) => {
      const wsUrl = gatewayUrl.replace(/^http/, 'ws').replace(/^claw/, 'ws');
      const socket = new WebSocket(wsUrl.includes("://") ? wsUrl : `ws://${wsUrl}`);
      
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error("Pairing handshake timed out."));
      }, 10000);

      socket.onopen = () => {
        // Send Triple-Match handshake for maximum compatibility
        const payload = { token: bootstrapToken };
        
        // 1. Standard MCP/JSON-RPC (PRD)
        socket.send(JSON.stringify({ method: "devices/pair", params: payload }));
        
        // 2. Legacy OpenClaw "Action" 
        socket.send(JSON.stringify({ action: "pair", payload }));
        
        // 3. Modern "Event-Type" 
        socket.send(JSON.stringify({ type: "pairing_request", ...payload }));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Detect any valid approved signal
          if (data.statusUrl || data.api_token || data.deviceId || data.result?.api_token) {
            clearTimeout(timeout);
            const token = data.api_token || data.result?.api_token;
            resolve({ ...data, api_token: token, gatewayUrl: gatewayUrl });
            socket.close();
          }
        } catch (e) {
          console.warn("Received non-JSON message during pairing:", event.data);
        }
      };

      socket.onerror = (err) => {
        clearTimeout(timeout);
        reject(new Error("WebSocket pairing failed (Connection Refused)."));
      };

      socket.onclose = () => {
        clearTimeout(timeout);
      };
    });
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
      host: url.hostname,
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
