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
 * URI Parser for agent://
 */
export function parseAgentUri(uri: string) {
  try {
    const url = new URL(uri);
    return {
      host: url.hostname,
      port: url.port,
      path: url.pathname,
      protocol: url.protocol,
    };
  } catch (e) {
    return null;
  }
}
