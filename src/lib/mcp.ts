/**
 * Carapace MCP Protocol Implementation
 * Following MCP v1.0.0 (JSON-RPC 2.0)
 */
import { invoke } from "@tauri-apps/api/core";
import { A2ATask } from "./a2a";
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
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Enhanced Error for A2A Interaction
 */
export class ProtocolError extends Error {
  constructor(message: string, public suggestion?: string) {
    super(message);
    this.name = "ProtocolError";
  }
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
  private socket: WebSocket | null = null;
  private messageCallback?: (msg: any) => void;
  private queue: any[] = [];

  constructor(public url: string) {
    this.connect();
  }

  private connect() {
    console.log(`[WS] Connecting to ${this.url}...`);
    this.socket = new WebSocket(this.url);
    
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        

        if (data.type === "connected") {
          console.log("[WS] Ignition Poke: Connection established.");
        }

        if (this.messageCallback) this.messageCallback(data);
      } catch (e) {
        console.error("[WS] Failed to parse message:", event.data);
      }
    };

    this.socket.onopen = () => {
      console.log(`[WS] Connected to ${this.url}`);
      while (this.queue.length > 0) {
        const msg = this.queue.shift();
        this.socket?.send(JSON.stringify(msg));
      }
    };

    this.socket.onerror = (err) => {
      console.error(`[WS] Connection error at ${this.url}:`, err);
    };

    this.socket.onclose = () => {
      console.log(`[WS] Connection closed for ${this.url}`);
    };
  }

  async send(message: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log("[WS] Queueing message (waiting for connection)...");
      this.queue.push(message);
      return;
    }
    console.log(`[WIRE SEND] 🛰️ WS -> ${this.url}`);
    this.socket.send(JSON.stringify(message));
  }

  onMessage(callback: (message: any) => void) {
    this.messageCallback = callback;
  }

  close() {
    this.socket?.close();
  }
}

/**
 * Mock Transport for local verification
 */
class MockTransport implements Transport {
  private messageCallback?: (msg: any) => void;

  constructor(public url: string) {
    console.log(`[MOCK] Initialized for ${url}`);
  }

  async send(message: any) {
    console.log(`[MOCK SEND]`, message);
    
    // Simulate a successful MCP/A2A initialization response
    if (message.method === "initialize") {
      setTimeout(() => {
        this.messageCallback?.({
          jsonrpc: "2.0",
          id: message.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              logging: {},
              prompts: { listChanged: true },
              resources: { subscribe: true, listChanged: true },
              tools: { listChanged: true }
            },
            serverInfo: { name: "A2A-Mock-Server", version: "1.0.0" }
          }
        });
      }, 500);
    }

    // Simulate tool listing
    if (message.method === "tools/list") {
      setTimeout(() => {
        this.messageCallback?.({
          jsonrpc: "2.0",
          id: message.id,
          result: {
            tools: [
              {
                name: "echo_signal",
                description: "Verifies the multimodal relay by echoing back a signal.",
                inputSchema: { type: "object", properties: { signal: { type: "string" } } }
              },
              {
                name: "check_health",
                description: "Performs a deep diagnostic of the local node registry.",
                inputSchema: { type: "object" }
              }
            ]
          }
        });
      }, 300);
    }

    // Simulate tool invocation
    if (message.method === "tools/call") {
      setTimeout(() => {
        this.messageCallback?.({
          jsonrpc: "2.0",
          id: message.id,
          result: {
            content: [{ type: "text", text: `[MOCK] Tool '${message.params.name}' executed successfully.` }],
            isError: false
          }
        });
      }, 500);
    }

    // Simulate peer messaging
    if (message.method === "message/send") {
      setTimeout(() => {
        this.messageCallback?.({
          jsonrpc: "2.0",
          id: message.id,
          result: { ok: true }
        });

        // Simulate an immediate peer response
        setTimeout(() => {
          this.messageCallback?.({
            jsonrpc: "2.0",
            method: "message/receive",
            params: {
              parts: [{ contentType: "text/plain", content: "Signal received, Carapace. Federated channel is clear." }]
            }
          });
        }, 1000);
      }, 200);
    }

    // Simulate task creation
    if (message.method === "task/create") {
      const taskId = `task-${Math.random().toString(36).substring(2, 8)}`;
      setTimeout(() => {
        this.messageCallback?.({
          jsonrpc: "2.0",
          id: message.id,
          result: { id: taskId, status: "pending" }
        });

        // Trigger a fake A2A task update sequence
        setTimeout(() => {
          this.messageCallback?.({
            jsonrpc: "2.0",
            method: "task/update",
            params: { id: taskId, status: "running", progress: 45 }
          });
        }, 2000);

        setTimeout(() => {
          this.messageCallback?.({
            jsonrpc: "2.0",
            method: "task/update",
            params: { id: taskId, status: "completed", progress: 100, artifact: { type: "text", content: "Diagnostic successful. A2A logic expansion verified." } }
          });
        }, 4000);
      }, 500);
    }

  }

  onMessage(callback: (msg: any) => void) {
    this.messageCallback = callback;
  }

  close() {}
}

/**
 * SSE (Server-Sent Events) Transport (Fetch-Stream Powered)
 */
class SSETransport implements Transport {
  private abortController: AbortController | null = null;
  private endpoint: string | null = null;
  private messageCallback?: (msg: any) => void;
  private isConnected = false;
  private sessionId = `carapace-${Math.random().toString(36).substring(2, 10)}`;

  constructor(
    private url: string, 
    private headers: Record<string, string> = {}, 
    private options: { streamUrl?: string } = {}
  ) {}

  async send(message: any) {
    const targetUrl = new URL(this.endpoint || this.url);
    targetUrl.searchParams.set("sessionId", this.sessionId);
    const target = targetUrl.toString();

    console.log(`[WIRE SEND] 📤 POST -> ${target}`);
    
    const response = await fetch(target, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...this.headers 
      },
      body: JSON.stringify(message),
    });

    if (response.ok) {
      const bodyText = await response.text();
      if (bodyText.trim().startsWith("{")) {
        try {
          const json = JSON.parse(bodyText);
          if (this.messageCallback) {
            console.log(`[SSE] Handled Synchronous Response: ${json.id || 'Notification'}`);
            this.messageCallback(json);
          }
        } catch (e) {
          // Response body was not JSON, normal for some SSE implementations
        }
      }
    } else {
      const errorText = await response.text();
      throw new Error(`SSE Post to ${target} failed: ${response.status} ${errorText}`);
    }

    // X-SSE-Endpoint discovery
    if (response.headers.get("X-SSE-Endpoint")) {
      const sseUrl = response.headers.get("X-SSE-Endpoint")!;
      if (!this.isConnected) this.connect(sseUrl);
    }
  }

  private async connect(sseUrl: string) {
    if (this.isConnected) return;
    this.isConnected = true;
    this.abortController = new AbortController();

    const authHeader = this.headers["Authorization"];
    let finalSseUrl = sseUrl;
    
    // ALEX DIALECT: Force /stream suffix if not present
    if (!finalSseUrl.includes("/stream")) {
      finalSseUrl = finalSseUrl.replace(/\/a2a\/?$/, "/a2a/stream");
    }
    try {
      const urlObj = new URL(finalSseUrl);
      urlObj.searchParams.set("sessionId", this.sessionId);
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        urlObj.searchParams.set("token", token);
        urlObj.searchParams.set("access_token", token);
      }
      finalSseUrl = urlObj.toString();
    } catch (e) {
      console.warn("[SSE] URL parameterization failed:", e);
    }

    console.log(`[SSE] Initializing Session-Linked Stream: ${this.sessionId}...`);

    try {
      const response = await fetch(finalSseUrl, {
        headers: {
          ...this.headers,
        },
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`SSE Stream failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("SSE Stream Body is empty");

      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // SSE lines are separated by double newlines or single if it's a sequence
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n");
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.substring(7).trim();
            } else if (line.startsWith("data: ")) {
              try {
                const rawData = line.substring(6);
                const data = JSON.parse(rawData);
                
                // If it's a JSON object and we have a preceding 'event' label,
                // enrich the data with the event as the method for A2A compatibility.
                if (typeof data === "object" && data !== null && currentEvent) {
                  if (!data.method) data.method = currentEvent;
                }

                if (this.messageCallback) this.messageCallback(data);
                
                // Reset event after consumption
                currentEvent = null; 
              } catch (e) {
                console.error("[SSE] Failed to parse stream data:", line);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("[SSE] Stream terminal error:", err);
      this.isConnected = false;
      // Reconnect logic
      setTimeout(() => this.connect(sseUrl), 3000);
    }
  }

  onMessage(callback: (message: any) => void) {
    this.messageCallback = callback;
    if (!this.isConnected) {
      const sseUrl = this.options.streamUrl || this.url;
      // Alex Spec: Always follow /a2a with /stream for high-fidelity reasoning
      const finalSseUrl = sseUrl.endsWith("/a2a") 
        ? `${sseUrl}/stream` 
        : sseUrl;
      
      this.connect(finalSseUrl).catch(err => console.error("[SSE] Auto-connect failed:", err));
    }
  }

  close() {
    this.abortController?.abort();
    this.isConnected = false;
  }
}

/**
 * Universal MCP Client
 * Handles protocol communication for both Legacy V3 (OpenClaw) and modern A2A Federated sessions.
 */
export interface LogEntry {
  text: string;
  id: string;
  type: 'info' | 'error' | 'success' | 'task' | 'message';
  timestamp: string;
  raw?: any;
}

export class MCPClient {
  private messageId: number = 0;
  private handlers: Map<number | string, (res: MCPResponse) => void> = new Map();
  private authToken: string | null = null;
  private onLog?: (entry: LogEntry) => void;
  public handshakePromise: Promise<void>;
  private resolveHandshake!: () => void;
  private rejectHandshake!: (err: any) => void;
  private signalMethod: string = "message/send";
  private baseUrl: string = "";
  private isPascalCase: boolean = false;
  
  // 🩺 Stability Flags
  private handshakeConfirmed: boolean = false;
  public onHandshakePulse?: (msg: string) => void;
  public sessionId?: string;

  private methodMap: Record<string, string> = {
    "tools/call": "CallTool",
    "tasks/create": "CreateTask",
    "tasks/step": "StepTask",
    "tasks/get": "GetTask",
    "message/send": "SendMessage",
    "initialize": "Initialize"
  };

  constructor(
    private transport: Transport, 
    onLog?: (entry: LogEntry) => void, 
    authToken?: string, 
    private card?: any,
    onHandshakePulse?: (msg: string) => void
  ) {
    this.onLog = onLog;
    this.authToken = authToken || null;
    this.onHandshakePulse = onHandshakePulse;
    this.baseUrl = this.card?.endpoints?.a2a || "";

    this.handshakePromise = new Promise((resolve, reject) => {
      this.resolveHandshake = resolve;
      this.rejectHandshake = reject;
    });

    // Auto-detect A2A PascalCase dialect
    if (this.card || (transport as any).url?.includes("/a2a")) {
      this.isPascalCase = true;
    }

    // CRITICAL: Register message callback before ANY early returns
    this.transport.onMessage((msg) => this.handleIncoming(msg));

    // A2A Mode Logic: sensing capabilities
    if (this.isPascalCase) {
      this.signalMethod = "SendMessage";
      console.log(`[A2A] Universal Client synchronized for ${this.card?.name || 'Remote Agent'}.`);
      this.resolveHandshake();
      return;
    }

    // If no token is provided, we might still be able to connect if the gateway allows anonymous
    // or if the session is already restored. We'll resolve after a short buffer if no challenge appears.
    if (!this.authToken) {
      setTimeout(() => {
        if (!this.handshakeConfirmed) {
          console.log("[TRANSPORT] No token provided and no challenge received. Assuming open session.");
          this.resolveHandshake();
        }
      }, 1000);
    }
  }

  private mapMethod(method: string): string {
    if (!this.isPascalCase) return method;
    return this.methodMap[method] || method;
  }


  private async handleIncoming(message: any) {
    // Debug Logging for Handshake Troubleshooting
    console.log("[TRANSPORT] Incoming Raw Message:", JSON.stringify(message));

    // OpenClaw v3 Protocol: Handle connect.challenge
    if (message.type === "event" && message.event === "connect.challenge") {
      const challengeToken = this.authToken || "";
      this.onHandshakePulse?.(`[AUTH] Solving challenge with token: ${challengeToken ? "PRESENT" : "MISSING"}`);
      
      try {
        // When authenticating an existing session, we use the 'official-cli' preset as the standard
        // VERIFIED: openclaw-macos is the exact constant required by the Alex production gateway.
        const officialClient = { id: "openclaw-macos", mode: "cli", platform: "macos", role: "operator" };
        const proof = await IdentityManager.signChallenge(
          message.payload.nonce, 
          message.payload.ts, 
          challengeToken,
          officialClient
        );
        
        // Add a safety timeout for the secure handshake itself
        setTimeout(() => {
          if (!this.handshakeConfirmed) {
            this.rejectHandshake(new Error("Secure Handshake timed out. Gateway did not confirm identity."));
          }
        }, 20000);

        // Send connect frame (Note: Not JSON-RPC)
        // CRITICAL: Step 2 requires 'minProtocol', 'maxProtocol', and 'client' to be repeated.
        // HOWEVER, it strictly forbids 'role' in the JSON. This is the 'Perfect Echo' strategy.
        const { role, ...wireClient } = officialClient;

        await this.transport.send({
          type: "req",
          method: "connect",
          id: "handshake-auth",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              ...wireClient,
              version: "1.0.0",
              deviceFamily: "desktop"
            },
            auth: { bootstrapToken: challengeToken },
            device: proof
          }
        });
        
        this.onLog?.({
          text: "[AUTH] Identity proof submitted.",
          type: 'info',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        this.rejectHandshake(err);
      }
      return;
    }

    // HYBRID FALLBACK: Only print raw if it's not a known JSON-RPC pattern or protocol message
    const isProtocolPattern = message.method || message.id === "handshake-auth" || message.event;
    if (!isProtocolPattern && (typeof message === "string" || !message.id)) {
      const text = typeof message === "string" ? message : JSON.stringify(message);
      this.onLog?.({
        text,
        raw: typeof message === "object" ? message : null,
        type: 'info',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      });
    }

    // JSON-RPC Response Dispatcher (Handle Handshake Confirmation)
    if (message.id === "handshake-auth") {
      if (message.ok) {
        this.onLog?.({
          text: "[AUTH] Handshake Confirmed. Session Secure.",
          type: 'info',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        });
        this.handshakeConfirmed = true;
        this.resolveHandshake();
      } else {
        const error = message.error?.message || "Authentication failed";
        const details = message.error ? JSON.stringify(message.error) : "No detail";
        
        // Handle Manual Pairing (Bonding) Request
        if (message.error?.code === "NOT_PAIRED" || error.includes("pairing required")) {
          const reqId = message.error?.details?.requestId;
          if (reqId) {
            this.onLog?.({
              text: `\x1b[1;33m[ACTION REQUIRED]\x1b[0m Pairing ID: ${reqId}`,
              type: 'info',
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString()
            });
            this.rejectHandshake(new Error(`PAIRING_REQUIRED:${reqId}`));
            return;
          }
        }

        this.onLog?.({
          text: `\x1b[1;31m[AUTH ERROR]\x1b[0m ${error} (${details})`,
          type: 'error',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        });
        this.rejectHandshake(new Error(error));
      }
      return;
    }

    // A2A Specific Notifications: The Reasoning Watchdog
    if (message.method === "task/update" || message.method === "tasks/update") {
      const task = (message.params || message.result || message) as any;
      const taskId = task.id || task.taskId;
      
      // REASONING FEED: Extract the "thought" or status text
      const reasoning = task.text || task.reasoning || task.description || "";
      const statusText = `\x1b[36m[A2A REASONING: ${taskId?.substring(0,6)}]\x1b[0m ${task.status?.toUpperCase() || 'RUNNING'} ${task.progress ? `(${task.progress}%)` : ""}`;
      
      this.onLog?.({
        text: `${statusText}${reasoning ? `\n\x1b[90m>> ${reasoning}\x1b[0m` : ""}`,
        raw: message,
        type: 'task',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      });

      // TOOL CALLS: Specifically detect if the agent is about to use a tool
      if (task.tool_calls || task.toolCalls) {
        const calls = task.tool_calls || task.toolCalls;
        calls.forEach((call: any) => {
          this.onLog?.({
            text: `\x1b[33m[TOOL CALL]\x1b[0m ${call.name || call.method}(${JSON.stringify(call.arguments || call.params || {})})`,
            type: 'info',
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString()
          });
        });
      }

      if (task.artifact) {
        this.onLog?.({
          text: `\x1b[32m[A2A ARTIFACT]\x1b[0m Result available.`,
          raw: task.artifact,
          type: 'task',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        });
      }
      return;
    }

    if (message.method === "message/receive" || message.method === "message/send") {
      const payload = message.params || message.result || {};
      const parts = payload.parts || (payload.content ? [{ content: payload.content, contentType: payload.contentType || "text/plain" }] : []);
      
      parts.forEach((p: any) => {
        const content = p.content || p.text;
        if (!content) return;

        this.onLog?.({
          text: `\x1b[35m[A2A MSG]\x1b[0m ${content}`,
          raw: message,
          type: 'message',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        });

        // MISSION WATCHDOG: If the agent emits a terminal ANSI signal, clear all shadow polls
        if (content.includes("[SUCCESS]") || content.includes("[ERROR]") || content.includes("success") || content.includes("failed")) {
          console.log("[A2A] Terminal signal received via stream. Flushing observation loops.");
          this.activePolls.clear();
        }
      });
      return;
    }

    // CATCH-ALL: Log any unrecognized signals from the agent
    this.onLog?.({
      text: `\x1b[33m[RAW SIGNAL]\x1b[0m Method: ${message.method || 'Unknown'}`,
      raw: message,
      type: 'info',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    });

    // JSON-RPC Response Dispatcher
    if (message.id !== undefined && this.handlers.has(message.id)) {
      const handler = this.handlers.get(message.id);
      
      if (handler) {
        handler(message as MCPResponse);
        this.handlers.delete(message.id);
      }
    }
  }

  private request(method: string, params: any = {}): Promise<any> {
    const id = ++this.messageId;
    
    return new Promise(async (resolve, reject) => {
      // WAIT for the secure gateway handshake to finish before sending ANY MCP requests
      try {
        await this.handshakePromise;
      } catch (e) {
        return reject(e);
      }

      // Set a 30-second timeout for the response (Increased for cloud stability)
      const timeout = setTimeout(() => {
        if (this.handlers.has(id)) {
          this.handlers.delete(id);
          reject(new Error(`MCP Request timed out after 30s: ${method}`));
        }
      }, 30000);

      this.handlers.set(id, (res) => {
        clearTimeout(timeout);
        if (res.error) reject(res.error);
        else resolve(res.result);
      });
      
      const finalMethod = this.mapMethod(method);
      this.transport.send({ jsonrpc: "2.0", id, method: finalMethod, params });
    });
  }


  private getHeaders() {
    return {
      "Content-Type": "application/json",
      ...(this.authToken ? { "Authorization": `Bearer ${this.authToken}` } : {})
    };
  }

  /**
   * MCP Initialize Handshake: Federated Identity Sync
   */
  async initialize(): Promise<any> {
    this.onHandshakePulse?.("[PROTOCOL] Negotiating MCP v1.0.0...");
    
    try {
      const result = await this.request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: { 
          streaming: true,
          sampling: true,
          logging: true
        },
        clientInfo: { 
          name: "carapace-terminal", 
          version: "2.0.0",
          protocolUrl: "https://raw.githubusercontent.com/deji-at-brane/carapace/main/SKILL.md" 
        }
      });

      if (result) {
        this.handshakeConfirmed = true;
        
        // Auto-negotiate messaging method and dialect based on server info
        const serverCapabilities = result.capabilities || {};
        const serverInfo = result.serverInfo || {};
        
        /* 
         * Acknowledge A2A v1.0 but maintain snake_case management for Alex.
         * The driver now prioritizes message/send for task ignition.
         */
        if (serverInfo.name === "OpenClaw-A2A" || serverInfo.version === "1.0.0") {
          this.isPascalCase = false; 
          console.log("[MCP] Dialect Sync: Standard Signaling (A2A v1.0 Legacy Compatibility)");
        }

        if (serverCapabilities.tasks || serverCapabilities["google:a2a"]) {
          this.signalMethod = "tasks/create";
          console.log("[A2A] Capability check: Using TASK-BASED signaling.");
          
          // BONDING: Send as a notification (no ID) as specified by Alex v1.0
          this.transport.send({
            jsonrpc: "2.0",
            method: "notifications/initialized"
          }).catch(() => {});
        }
        this.onHandshakePulse?.("\x1b[32m[SUCCESS]\x1b[0m Protocol synchronized.");
        console.log(`
          %c 🚀 A2A ENGINE INITIALIZED %c
          %c Carapace Federated Protocol v1.0.0 %c
        `, 
        "background: #8b5cf6; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;", "",
        "color: #8b5cf6; font-weight: bold;", "");
          console.log("[MCP] Handshake complete via A2A.");
          return result;
        }
      } catch (e: any) {
      if (e.message?.includes("Method not found") || e.code === -32601) {
        console.warn("[PROTOCOL] 'initialize' method not supported by peer. Assuming pre-synchronized state.");
        this.onHandshakePulse?.("\x1b[32m[SUCCESS]\x1b[0m Direct Peer Connection Active.");
        this.handshakeConfirmed = true;
        return { protocolVersion: "legacy", capabilities: {} };
      }
      this.onHandshakePulse?.(`\x1b[31m[ERROR]\x1b[0m Handshake Failed: ${e}`);
      throw e;
    }
  }

  /**
   * List available tools from the server
   */
  /**
   * Status Polling Loop: Actively pulls updates for silent agents
   */
  private activePolls: Set<string> = new Set();
  
  async observeTask(taskId: string, sessionId?: string) {
    const key = `${taskId}:${sessionId || 'main'}`;
    
    // Immediate Visual Feedback
    this.onLog?.({
      text: `\x1b[94m[POLLING INITIALIZED]\x1b[0m Task: ${taskId.substring(0,8)}`,
      type: 'info',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    });
    
    if (this.activePolls.has(key)) return;
    this.activePolls.add(key);
    
    const targetSessionId = sessionId || this.sessionId;
    const poll = async () => {
      if (!this.activePolls.has(key)) return;
      
      try {
        // Construct session-linked URL with protocol safety
        let absoluteBase = this.baseUrl;
        if (!absoluteBase.includes("://")) absoluteBase = `http://${absoluteBase}`;
        
        const urlObj = new URL(absoluteBase);
        urlObj.searchParams.set("sessionId", targetSessionId || "");
        const url = urlObj.toString();
        
        // HEARTBEAT: Log to both terminal and activity log
        const heartbeat = `[A2A] Polling task ${taskId.substring(0,8)}...`;
        this.onHandshakePulse?.(heartbeat);
        this.onLog?.({
          text: `\x1b[90m${heartbeat}\x1b[0m`,
          type: 'info',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        });

        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 10000);

        const res = await fetch(url, {
          method: "POST",
          headers: this.getHeaders(),
          signal: abortController.signal,
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "tasks/get", // Default plural
            params: { 
              taskId,
              id: taskId, // Legacy support for Alex
              sessionId: targetSessionId // Security validation
            },
            id: `p-poll-${Math.random().toString(36).substring(7)}`
          })
        });
        
        clearTimeout(timeout);
        const data = await res.json();
        
        // Handle Method not found (fallback to singular task/get)
        if (data.error && data.error.code === -32601) {
          const fallbackRes = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "task/get",
              params: { 
                taskId,
                id: taskId,
                sessionId: targetSessionId
              },
              id: `p-fallback-${Math.random().toString(36).substring(7)}`
            })
          });
          const fallbackData = await fallbackRes.json();
          if (fallbackData.result) {
            this.handleTaskUpdate(fallbackData.result, taskId, key);
          }
          return;
        }

        if (data.result) {
          this.onLog?.({
            text: `\x1b[36m[HEARTBEAT]\x1b[0m Monitoring Task ${taskId.substring(0,8)}: ${data.result.status} (${data.result.progress}%).`,
            type: 'info',
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString()
          });
          this.handleTaskUpdate(data.result, taskId, key);
        } else if (data.error) {
          // GHOST SLAYER: If agent says task doesn't exist, stop polling immediately
          if (data.error.message?.toLowerCase().includes("not found") || data.error.code === -32602) {
             console.warn(`[A2A] Task ${taskId} not found on peer. Terminating ghost poll.`);
             this.activePolls.delete(key);
             return; 
          }
        }
      } catch (e) {
        this.onLog?.({
          text: `\x1b[33m[POLL RETRY]\x1b[0m Waiting for task index...`,
          type: 'info',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        });
      }
      
      // Re-schedule
      setTimeout(poll, 3000);
    };
    
    poll();
  }

  private handleTaskUpdate(update: A2ATask, taskId: string, key: string) {
    // LOUD LOGGING: Reveal exactly what Alex is thinking
    this.onLog?.({
      text: `\x1b[94m[SYNC]\x1b[0m ID: ${taskId.substring(0,6)} | Status: ${update.status} | Progress: ${update.progress ?? '?'}%`,
      raw: update,
      type: 'info',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    });
    
    this.onHandshakePulse?.(`[A2A] Status: ${update.status} (${update.progress !== undefined ? update.progress : '?' }%)`);
    
    // Check for "Hidden" content fields (Common in some OpenClaw forks)
    const hiddenText = (update as any).output || (update as any).content || (update as any).result;
    if (hiddenText && typeof hiddenText === 'string' && !this.activePolls.has(`${key}:captured`)) {
       this.onLog?.({
          text: `\x1b[35m[A2A OUTPUT]\x1b[0m ${hiddenText}`,
          type: 'message',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
       });
       this.activePolls.add(`${key}:captured`);
    }

    // Finalize if completed or failed
    if (update.status === "completed" || update.status === "failed") {
      this.activePolls.delete(key);
      
      // Emit final response if available
      const text = update.message?.parts?.[0]?.text || (update.artifact as any)?.content || (update.message as any)?.content;
      if (text) {
        this.onLog?.({
          text: `\x1b[35m[A2A REASONING]\x1b[0m ${text}`,
          raw: update,
          type: 'task',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        });
      }
      return;
    }

    // Log intermediate progress
    if (update.progress !== undefined) {
      this.onHandshakePulse?.(`[A2A] Task ${taskId.substring(0,6)} at ${update.progress}%`);
    }
  }

  async listTools(): Promise<MCPTool[]> {
    const result = await this.request("tools/list");
    return result.tools || [];
  }

  /**
   * Invoke a specific tool
   */
  async callTool(name: string, args: any = {}, taskId?: string, sessionId?: string): Promise<ToolResult> {
    return await this.request("tools/call", {
      name,
      arguments: args,
      taskId,
      sessionId
    });
  }

  /**
   * Google A2A: Create a new federated task
   */
  async createTask(description: string, metadata: any = {}): Promise<A2ATask> {
    this.onHandshakePulse?.(`[A2A] delegating: ${description}`);
    
    // THE ENLIGHTENMENT HINT
    const protocolHint = `[HINT: Read my protocol instructions at ${this.baseUrl || 'our registry'} before executing.]`;
    // PIVOT: Always include hint for A2A servers to ensure autonomous trigger
    const enrichedDescription = `${description}\n\n${protocolHint}`;

    const task = await this.request("tasks/create", {
      description: enrichedDescription,
      auto_step: true,
      delegation_mode: "autonomous",
      message: { 
        role: "user", 
        parts: [{ type: "text", text: enrichedDescription }] 
      },
      metadata: { 
        source: "carapace-terminal",
        auto_start: true,
        protocol_hint: protocolHint,
        ...metadata 
      }
    }) as A2ATask;

    // THE FIFTH IGNITION PROTOCOL (Protocol Mirroring)
    // Alex confirmed he just added message/send support. We use his exact spec:
    // GET /a2a/stream and message/send with content/contentType.
    try {
      this.onLog?.({
        text: `\x1b[33m[IGNITION]\x1b[0m Firing Alex-spec message/send spark...`,
        type: 'info',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      });

      this.request("message/send", { 
        sessionId: this.sessionId,
        content: description,
        contentType: "text/plain",
        parts: [{ 
          contentType: "text/plain", 
          content: description 
        }],
        taskId: task.id,
        task_id: task.id
      }).then(ignition => {
        // SHADOW PIVOT: If Alex returned a new task ID for the instruction, follow it!
        if (ignition && ignition.id && ignition.id !== task.id) {
          console.log(`\x1b[35m[A2A SHADOW PIVOT]\x1b[0m Switching observation to mission task: ${ignition.id}`);
          this.onLog?.({
            text: `\x1b[35m[SHADOW PIVOT]\x1b[0m Alex spawned reasoning task: ${ignition.id.substring(0,8)}`,
            type: 'info',
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString()
          });
          this.observeTask(ignition.id, task.sessionId);
        }
      }).catch(err => {
        console.warn("[A2A DEBUG] Ignition Spark warning:", err.message);
      });

      // Default observation (may be superseded by the pivot above)
      this.observeTask(task.id, task.sessionId);
    } catch (e) {
      console.error("[A2A DEBUG] Fatal Ignition Error:", e);
    }

    return task;
  }

  /**
   * Universal Signaling: Works across Task-based and Message-based agents
   */
  async sendMessage(content: string, contentType: string = "text/plain"): Promise<any> {
    if (this.signalMethod === "tasks/create") {
      // PIVOT: Send as a concrete federated task to trigger autonomous engine
      return await this.createTask(content);
    }

    return await this.request("message/send", {
      parts: [
        {
          contentType,
          content: contentType === "application/json" ? JSON.parse(content) : content
        }
      ]
    });
  }

  /**
   * Google A2A: Get task status
   */
  async getTaskStatus(taskId: string): Promise<A2ATask> {
    return await this.request("task/status", { taskId });
  }

  close() {
    this.transport.close();
  }
}

import { IdentityManager } from './crypto';

interface HandshakePreset {
  id: string;
  clientId: string;
  name: string;
  mode: string;
  platform: string;
  version: string;
}

const HANDSHAKE_PRESETS: HandshakePreset[] = [
  { id: "native-macos", clientId: "openclaw-macos", name: "Official macOS", mode: "cli", platform: "macos", version: "1.0.0" }
];

/**
 * Hermes / OpenClaw Gateway Pairing Manager
 * USES WINDOW-LEVEL SINGLETON TO PREVENT HMR GHOST LOOPS
 */
const GLOBAL_LOCK_KEY = "__OPENCLAW_DISCOVERY_LOCK__";
const getLock = () => (window as any)[GLOBAL_LOCK_KEY] || { active: false, aborted: false };
const setLock = (val: { active: boolean, aborted: boolean }) => (window as any)[GLOBAL_LOCK_KEY] = val;

export class ClawPairingManager {
  private static onHandshakePulse: ((msg: string) => void) | null = null;
  private static lastPulse: string | null = null;

  static setHandshakePulse(handler: (msg: string) => void) {
    this.onHandshakePulse = (msg: string) => {
      if (getLock().aborted) return; 
      if (msg === this.lastPulse) return; 
      this.lastPulse = msg;
      handler(msg);
    };
  }

  /**
   * Orchestrates the multi-stage handshake with automatic protocol discovery.
   */
  private static async runDiscovery(host: string, bootstrapToken: string, customClientId?: string): Promise<string | null> {
    let lastError: Error | null = null;
    const identity = IdentityManager.getIdentity();
    const deviceId = await IdentityManager.sha256Fingerprint(identity.rawPublicKey);
    this.onHandshakePulse?.(`[LOOP] v6 Unified: Fingerprint accepted as ${deviceId.substring(0,8)}...`);

    const probeList: HandshakePreset[] = customClientId 
      ? [{ id: "manual-override", clientId: customClientId, name: "Manual Override", mode: "cli", platform: "macos", version: "1.4.2" }, ...HANDSHAKE_PRESETS]
      : HANDSHAKE_PRESETS;

    for (const preset of probeList) {
      if (getLock().aborted) return null;
      let activeHost = host;

      for (const role of ["operator", "client"]) {
        if (getLock().aborted) return null;
        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts) {
          if (getLock().aborted) return null;
          try {
            this.onHandshakePulse?.(`[HANDSHAKE] Probing ${activeHost} (as ${preset.id}, role: ${role})...`);

            // Step 1: Initiating fresh session with UNIFIED ID
            const challenge: any = await invoke("mcp_start_pairing", {
              gatewayUrl: activeHost,
              token: bootstrapToken,
              deviceId: deviceId, // <--- UNIFIED
              deviceName: "Carapace Terminal"
            });

            const { nonce, ts } = challenge;
            if (!nonce || !ts) throw new Error("Gateway challenge invalid.");
            this.onHandshakePulse?.(`[AUTH] Gateway challenge solved (Nonce: ${nonce.substring(0,6)}...)`);

            // Strictly Minimalist Client Identity (Matches Success Script)
            const client_identity = {
              id: preset.clientId,
              version: preset.version,
              mode: preset.mode,
              platform: preset.platform,
              deviceFamily: "desktop"
            };

            const identityProof = await IdentityManager.signChallenge(nonce, ts, bootstrapToken, {
              ...client_identity,
              role: role // Pass role ONLY to signer, not to the transmitted object
            });

            this.onHandshakePulse?.(`[AUTH] Identity proof submitted. Synchronizing protocol...`);

            // Step 3: Completing handshake with current identity telemetry
            const resultJson: string = await invoke("mcp_finish_pairing", {
              deviceIdentity: identityProof,
              clientIdentity: client_identity,
              bootstrapToken: bootstrapToken
            });

            const parsed = JSON.parse(resultJson);
            if (parsed.ok) {
              this.onHandshakePulse?.(`[SUCCESS] Gateway accepted identity: ${preset.id}`);
              return resultJson;
            } else {
              const err = parsed.error || {};
              throw new Error(err.message || "Handshake rejected");
            }

          } catch (e: any) {
            attempts++;
            const errorMsg = e.toString();
            this.onHandshakePulse?.(`[RAW ERROR] ${errorMsg}`);
            
            // FATAL: If unauthorized/expired, STOP retrying immediately and LOCK everything.
            if (errorMsg.includes("unauthorized") || errorMsg.includes("expired") || errorMsg.includes("token")) {
              const fatalMsg = "Fatal: Bootstrap Token expired. Generate a fresh code in Alex.";
              setLock({ ...getLock(), aborted: true });
              this.onHandshakePulse?.(`[STOP] ${fatalMsg}`);
              return null; // Break the Discovery loop entirely
            }

            // If the server explicitly rejected the ID or schema, we skip this preset/role combo immediately.
            if (errorMsg.includes("must be equal to constant") || errorMsg.includes("unexpected property")) {
              this.onHandshakePulse?.(`[ID Rejected] ${preset.clientId}:${role} invalid for this gateway.`);
              break; // Move to next role/preset
            }

            // Fatal errors that shouldn't be retried (e.g. truly Invalid Token)
            // We only throw here if the error doesn't look like an identity mismatch.
            if ((errorMsg.includes("unauthorized") || errorMsg.includes("token")) && !errorMsg.includes("constant")) {
               throw new Error(errorMsg);
            }

            if (attempts < maxAttempts) {
              const delay = Math.pow(2, attempts) * 500; // 1s, 2s...
              this.onHandshakePulse?.(`[WARN] Probe ${preset.id}:${role} failed (${errorMsg}). Retrying in ${delay}ms...`);
              await new Promise(r => setTimeout(r, delay));
            } else {
              this.onHandshakePulse?.(`[ERROR] Discovery failed for ${preset.id}:${role} after ${maxAttempts} attempts.`);
              lastError = new Error(`Discovery failed: ${errorMsg}`);
            }
          }
        }
      }
    }
    throw lastError || new Error("No compatible protocol found.");
  }

  /**
   * Initiates the native multi-stage handshake with discovery.
   */
  static async initiate(wsUrl: string, bootstrapToken: string, customClientId?: string): Promise<any> {
    const lock = getLock();
    if (lock.active) throw new Error("A discovery session is already in progress.");
    
    setLock({ active: true, aborted: false });
    this.lastPulse = null; 
    
    try {
      const resultJson = await this.runDiscovery(wsUrl, bootstrapToken, customClientId);
      if (!resultJson) throw new Error("Discovery session was aborted or failed without identity match.");
    
      // Determine base URL for credential storage
      let finalGateway = wsUrl;
      if (wsUrl.startsWith('ws://')) finalGateway = wsUrl.replace('ws://', 'http://');
      if (wsUrl.startsWith('wss://')) finalGateway = wsUrl.replace('wss://', 'https://');
      if (!finalGateway.includes('://')) finalGateway = `http://${finalGateway}`;
      finalGateway = finalGateway.replace(/\/$/, '');

      if (wsUrl.includes("/vss/ws")) {
        this.onHandshakePulse?.("[INFO] Using VSS/WS proxy route...");
      }
      
      const authResult = JSON.parse(resultJson);
      const successData = authResult.result || {};
      const sessionToken = successData.token || authResult.api_token || bootstrapToken;

      return {
        ...authResult,
        gatewayUrl: finalGateway,
        api_token: sessionToken,
        result: successData
      };
    } finally {
      setLock({ active: false, aborted: false });
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
export function createTransport(uri: string, token?: string, options: { streamUrl?: string } = {}): Transport {
  let finalUri = uri;
  
  // Defensive: Handle raw IP or port-only URIs by assuming claw://
  if (!uri.includes("://")) {
    finalUri = `claw://${uri}`;
  }

  try {
    const url = new URL(finalUri);
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // INTERCEPT: Local A2A Mock gets the MockTransport
    if (url.host === "localhost:1425" && !finalUri.includes("claw://")) {
      return new MockTransport(finalUri);
    }

    if (url.protocol === "ws:" || url.protocol === "wss:") {
      return new WebSocketTransport(finalUri);
    }
    if (url.protocol === "http:" || url.protocol === "https:") {
      // For HTTP/HTTPS, we use SSE transport with optional auth headers
      return new SSETransport(finalUri, headers, options);
    }
    if (url.protocol === "a2a:") {
      // 🌐 NEW: Federated A2A usually runs over SSE/HTTP for broad compatibility
      const tokenFromUri = url.searchParams.get("token");
      if (tokenFromUri && !headers["Authorization"]) {
        headers["Authorization"] = `Bearer ${tokenFromUri}`;
      }
      const httpUri = finalUri.replace(/^a2a:/, "http:");
      const sseOptions = { ...options, streamUrl: httpUri + (httpUri.endsWith("/") ? "stream" : "/stream") };
      return new SSETransport(httpUri, headers, sseOptions);
    }

    if (url.protocol === "claw:" || url.protocol === "agent:") {
      // Legacy Protocol normalization for WebSocket transport
      const wsUri = finalUri.replace(/^(claw|agent):/, "ws:");
      return new WebSocketTransport(wsUri);
    }
    // Fallback for custom schemes: Treat as WebSocket
    return new WebSocketTransport(finalUri.replace(url.protocol, "ws:"));
  } catch (e) {
    // Ultimate Fallback: Assume it's a websocket host
    const fallback = finalUri.startsWith("ws") ? finalUri : `ws://${uri}`;
    return new WebSocketTransport(fallback);
  }
}

/**
 * URI Parser for agent:// and claw://
 */
export function parseAgentUri(uri: string) {
  try {
    // Basic normalization: if it's just an IP or host, prefix it
    let normalized = uri.trim();
    if (!normalized.includes("://") && normalized.length > 0) {
      normalized = `a2a://${normalized}`;
    }
    
    const url = new URL(normalized);
    const normalizedHost = url.host.toLowerCase().replace(/\/$/, "");
    
    return {
      host: url.host,
      normalizedHost,
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
