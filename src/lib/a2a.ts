/**
 * Google Agent2Agent (A2A) Protocol Implementation
 * Spec: https://google.github.io/A2A (Draft)
 */

export interface AgentCard {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  endpoints: {
    a2a: string;
    mcp?: string;
    sse?: string;
  };
  auth?: {
    type: "bearer" | "oauth2" | "none";
    instructions?: string;
  };
}

export interface A2ATask {
  id: string;
  sessionId?: string; // High-Fidelity Session Pairing
  status: "pending" | "running" | "completed" | "failed";
  progress?: number;
  message?: any;
  artifact?: any;
}

export class A2AManager {
  /**
   * Attempts to discover an Agent Card at the given host.
   * Path: /.well-known/agent.json
   */
  static async discover(baseUrl: string): Promise<AgentCard | null> {
    let finalUrl = baseUrl.trim();
    
    // Normalize protocol: A2A cards are always fetched over HTTP(S)
    if (finalUrl.startsWith("claw://")) finalUrl = finalUrl.replace("claw://", "http://");
    if (finalUrl.startsWith("agent://")) finalUrl = finalUrl.replace("agent://", "http://");
    if (finalUrl.startsWith("a2a://")) finalUrl = finalUrl.replace("a2a://", "http://");
    if (!finalUrl.includes("://")) finalUrl = `http://${finalUrl}`;
    
    // Safety: Strip query parameters and trailing slashes before path construction
    const urlObj = new URL(finalUrl);
    const cleanBase = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.replace(/\/$/, "");
    const wellKnownUrl = `${cleanBase}/.well-known/agent.json`;
    
    console.log(`[A2A] Probing for Agent Card at ${wellKnownUrl}...`);
    
    try {
      const response = await fetch(wellKnownUrl, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });
      
      if (!response.ok) {
        console.warn(`[A2A] Discovery failed at ${wellKnownUrl}: ${response.status} ${response.statusText}`);
        return null;
      }
      
      const card = await response.json() as any;
      
      // Fuzzy Validation: LLMs often flatten the schema or use synonymous keys
      const name = card.name || card.agentName || "Discovered Agent";
      const a2aEndpoint = card.endpoints?.a2a || card.endpoint || card.a2a_url || card.url || null;
      
      let capabilities = card.capabilities || [];
      if (typeof capabilities === "string") {
        capabilities = capabilities.split(",").map((s: string) => s.trim());
      }

      if (!a2aEndpoint) {
        throw new Error("Invalid Agent Card: No A2A endpoint found in registry response.");
      }

      // Re-normalize to the strict internal type
      const validatedCard: AgentCard = {
        name: name,
        description: card.description || "No description provided.",
        version: card.version || "1.0.0",
        capabilities: Array.isArray(capabilities) ? capabilities : [capabilities],
        endpoints: {
          a2a: a2aEndpoint,
          sse: card.endpoints?.sse || card.sse_url
        }
      };
      
      console.log(`[A2A] Discovered Agent (Fuzzy Match): ${validatedCard.name}`);
      return validatedCard;
    } catch (e) {
      console.warn(`[A2A] Discovery failed at ${wellKnownUrl}. Checking protocol fallback...`);
      
      // 🛡️ PROTOCOL FALLBACK: If discovery fails but we are using a2a://, synthesize a basic card
      // This ensures that pre-seeded or private a2a agents always use the Federated Auth UI path.
      if (baseUrl.startsWith("a2a://")) {
        return {
          name: "A2A Federated Agent",
          description: "Agent synchronized via protocol scheme.",
          version: "1.0.0",
          capabilities: ["mcp", "federation"],
          endpoints: { a2a: baseUrl }
        };
      }
      return null;
    }
  }

  /**
   * Helper to normalize A2A service URLs
   */
  static getServiceUrl(card: AgentCard, type: keyof AgentCard["endpoints"] = "a2a"): string {
    const url = card.endpoints[type] || card.endpoints.a2a;
    return url;
  }
}
