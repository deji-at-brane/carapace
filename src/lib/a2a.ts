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
  status: "pending" | "running" | "completed" | "failed";
  progress?: number;
  artifact?: any;
}

export class A2AManager {
  /**
   * Attempts to discover an Agent Card at the given host.
   * Path: /.well-known/agent.json
   */
  static async discover(baseUrl: string): Promise<AgentCard | null> {
    const cleanBase = baseUrl.replace(/\/$/, "");
    const wellKnownUrl = `${cleanBase}/.well-known/agent.json`;
    
    console.log(`[A2A] Probing for Agent Card at ${wellKnownUrl}...`);
    
    try {
      const response = await fetch(wellKnownUrl, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });
      
      if (!response.ok) {
        console.warn(`[A2A] Discovery failed at ${wellKnownUrl}: ${response.statusText}`);
        return null;
      }
      
      const card = await response.json() as AgentCard;
      
      // Basic validation
      if (!card.name || !card.endpoints?.a2a) {
        throw new Error("Invalid Agent Card: Missing name or A2A endpoint.");
      }
      
      console.log(`[A2A] Discovered Agent: ${card.name} (v${card.version})`);
      return card;
    } catch (e) {
      console.error(`[A2A] Discovery error:`, e);
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
