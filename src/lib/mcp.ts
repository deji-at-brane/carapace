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
  private messageId: number = 0;
  private handlers: Map<number | string, (res: MCPResponse) => void> = new Map();
  private onHandshakePulse?: (msg: string) => void;
  private authToken: string | null = null;
  
  // Handshake Guard: Ensures MCP requests wait for the secure 'connect' layer
  private handshakePromise: Promise<void>;
  private resolveHandshake!: () => void;
  private rejectHandshake!: (err: any) => void;
  private handshakeConfirmed: boolean = false;

  constructor(private transport: Transport, onHandshakePulse?: (msg: string) => void, authToken?: string) {
    this.onHandshakePulse = onHandshakePulse;
    this.authToken = authToken || null;

    // Initialize the handshake guard
    this.handshakePromise = new Promise((resolve, reject) => {
      this.resolveHandshake = () => {
        this.handshakeConfirmed = true;
        resolve();
      };
      this.rejectHandshake = reject;
    });

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

    this.transport.onMessage((msg) => this.handleIncoming(msg));
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
        
        this.onHandshakePulse?.("[AUTH] Identity proof submitted.");
      } catch (err) {
        this.rejectHandshake(err);
      }
      return;
    }

    // HYBRID FALLBACK: If the message is a raw string or not matched by ID
    if (typeof message === "string" || !message.id) {
      const text = typeof message === "string" ? message : JSON.stringify(message);
      this.onHandshakePulse?.(text);
    }

    // JSON-RPC Response Dispatcher (Handle Handshake Confirmation)
    if (message.id === "handshake-auth") {
      if (message.ok) {
        this.onHandshakePulse?.("[AUTH] Handshake Confirmed. Session Secure.");
        this.handshakeConfirmed = true;
        this.resolveHandshake();
      } else {
        const error = message.error?.message || "Authentication failed";
        const details = message.error ? JSON.stringify(message.error) : "No detail";
        
        // Handle Manual Pairing (Bonding) Request
        if (message.error?.code === "NOT_PAIRED" || error.includes("pairing required")) {
          const reqId = message.error?.details?.requestId;
          if (reqId) {
            this.onHandshakePulse?.(`\x1b[1;33m[ACTION REQUIRED]\x1b[0m Pairing ID: ${reqId}`);
            this.rejectHandshake(new Error(`PAIRING_REQUIRED:${reqId}`));
            return;
          }
        }

        this.onHandshakePulse?.(`\x1b[1;31m[AUTH ERROR]\x1b[0m ${error} (${details})`);
        this.rejectHandshake(new Error(error));
      }
      return;
    }

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
    
    try {
      const result = await this.request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "openclaw-js",
          version: "1.4.2"
        }
      });

      const serverCapabilities = result.capabilities || {};
      const toolSupport = serverCapabilities.tools ? "AVAILABLE" : "NONE";
      const resourceSupport = serverCapabilities.resources ? "AVAILABLE" : "NONE";
      
      this.onHandshakePulse?.(`[PROTOCOL] Handshake OK. Tools: ${toolSupport}, Resources: ${resourceSupport}`);
      
      // Confirm initialization
      this.notify("notifications/initialized");
      this.onHandshakePulse?.("[SUCCESS] Node Synchronized.");
      
      return result;
    } catch (e) {
      this.onHandshakePulse?.(`[PROTOCOL ERROR] Handshake Failed: ${e}`);
      throw e;
    }
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
  private static async runDiscovery(host: string, bootstrapToken: string, customClientId?: string) {
    let lastError: Error | null = null;
    const identity = IdentityManager.getIdentity();
    const deviceId = await IdentityManager.sha256Fingerprint(identity.rawPublicKey);
    this.onHandshakePulse?.(`[LOOP] v6 Unified: Fingerprint accepted as ${deviceId.substring(0,8)}...`);

    const probeList: HandshakePreset[] = customClientId 
      ? [{ id: "manual-override", clientId: customClientId, name: "Manual Override", mode: "cli", platform: "macos", version: "1.4.2" }, ...HANDSHAKE_PRESETS]
      : HANDSHAKE_PRESETS;

    for (const preset of probeList) {
      if (getLock().aborted) return false;
      let activeHost = host;

      for (const role of ["operator", "client"]) {
        if (getLock().aborted) return false;
        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts) {
          if (getLock().aborted) return false;
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
              return false; // Break the Discovery loop entirely
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
export function createTransport(uri: string): Transport {
  let finalUri = uri;
  
  // Defensive: Handle raw IP or port-only URIs by assuming claw://
  if (!uri.includes("://")) {
    finalUri = `claw://${uri}`;
  }

  try {
    const url = new URL(finalUri);
    if (url.protocol === "ws:" || url.protocol === "wss:") {
      return new WebSocketTransport(finalUri);
    }
    if (url.protocol === "http:" || url.protocol === "https:") {
      return new SSETransport(finalUri);
    }
    if (url.protocol === "claw:" || url.protocol === "agent:") {
      // Protocol normalization for WebSocket transport
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
    if (!normalized.includes("://")) {
      normalized = `ws://${normalized}`;
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
