import Database from "@tauri-apps/plugin-sql";
import { Agent } from "./types";

/**
 * Carapace Database Manager
 * Handles local-first storage for chat history and agent credentials.
 */
export class CarapaceDB {
  private static instance: CarapaceDB;
  private db: Database | null = null;

  private constructor() {}

  static async getInstance(): Promise<CarapaceDB> {
    if (!CarapaceDB.instance) {
      CarapaceDB.instance = new CarapaceDB();
      await CarapaceDB.instance.init();
    }
    return CarapaceDB.instance;
  }

  private async init() {
    this.db = await Database.load("sqlite:carapace.db");
    
    // Initial Schema Setup
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT,
        agent_uri TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        role TEXT,
        content TEXT,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        agent_host TEXT,
        key_type TEXT,
        secret_blob TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        uri TEXT UNIQUE NOT NULL,
        category TEXT,
        icon_name TEXT,
        is_pinned BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // One-time Purge for Alex Reset
    await this.deleteAgent("alex-1", "claw://148.230.87.184:18789");
    
    await this.seedAgents();
  }

  async seedAgents() {
    console.log("[DB] Synchronizing Discovery Hub agent registry...");
    const defaultAgents = [
      { id: "a2a-test-1", name: "A2A System Check", description: "Local federated agent for protocol verification.", uri: "http://localhost:1425", category: "Production", icon_name: "Zap" },
      { id: "researcher-1", name: "Cloud Researcher", description: "Deep web searching and document synthesis node.", uri: "agent://research.carapace.io", category: "Research", icon_name: "Compass" },
      { id: "coder-1", name: "Logic Architect", description: "High-context coding assistant with multi-file awareness.", uri: "agent://code.carapace.io", category: "Development", icon_name: "Terminal" },
      { id: "analyst-1", name: "Data Sentinel", description: "Real-time log analysis and pattern recognition engine.", uri: "agent://analysis.carapace.io", category: "Analysis", icon_name: "LayoutGrid" }
    ];

    for (const agent of defaultAgents) {
      try {
        await this.execute(
          "REPLACE INTO agents (id, name, description, uri, category, icon_name) VALUES (?, ?, ?, ?, ?, ?)",
          [agent.id, agent.name, agent.description, agent.uri, agent.category, agent.icon_name]
        );
      } catch (e) {
        console.error(`[DB] Failed to seed agent ${agent.name}:`, e);
      }
    }
    console.log("[DB] Registry sync complete. Total agents:", defaultAgents.length);
  }

  async createSession(name: string, agentUri: string): Promise<string> {
    const id = crypto.randomUUID();
    await this.execute(
      "INSERT INTO sessions (id, name, agent_uri) VALUES (?, ?, ?)",
      [id, name, agentUri]
    );
    return id;
  }

  async addMessage(sessionId: string, role: string, content: string, metadata?: any) {
    const id = crypto.randomUUID();
    await this.execute(
      "INSERT INTO messages (id, session_id, role, content, metadata) VALUES (?, ?, ?, ?, ?)",
      [id, sessionId, role, content, JSON.stringify(metadata || {})]
    );
    return id;
  }

  async saveCredential(host: string, token: string, type: string = "api_token") {
    const id = crypto.randomUUID();
    // Fixed: column names now match the CREATE TABLE schema (agent_host, key_type, secret_blob)
    await this.execute(
      "INSERT INTO credentials (id, agent_host, key_type, secret_blob) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET secret_blob = excluded.secret_blob",
      [id, host, type, token]
    );
    return id;
  }

  async deleteCredential(host: string) {
    // Normalize host to ensure we match the stored format
    const normalized = host.replace("claw://", "").replace("agent://", "").split("?")[0].split("/")[0];
    await this.execute(
      "DELETE FROM credentials WHERE agent_host LIKE ?",
      [`%${normalized}%`]
    );
  }

  async deleteAgent(id: string, uri: string) {
    console.log(`[DB] Purging all data for agent: ${id} (${uri})`);
    
    // 1. Delete associated credentials first
    await this.deleteCredential(uri);
    
    // 2. Find and delete all sessions associated with this agent_uri
    const sessions = await this.select<any[]>("SELECT id FROM sessions WHERE agent_uri = ?", [uri]);
    for (const session of sessions) {
      await this.execute("DELETE FROM messages WHERE session_id = ?", [session.id]);
    }
    await this.execute("DELETE FROM sessions WHERE agent_uri = ?", [uri]);
    
    // 3. Delete the agent record itself
    await this.execute("DELETE FROM agents WHERE id = ?", [id]);
  }

  async upsertAgent(agent: Omit<Agent, "created_at">) {
    await this.execute(
      "INSERT INTO agents (id, name, description, uri, category, icon_name) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(uri) DO UPDATE SET name = excluded.name, description = excluded.description",
      [agent.id, agent.name, agent.description, agent.uri, agent.category, agent.icon_name]
    );
  }

  async getAgentsWithStatus() {
    // We join agents with credentials based on the host part of the URI
    // This allows the UI to know which agents are already "Known" and "Paired"
    const query = `
      SELECT a.*, (SELECT COUNT(*) FROM credentials WHERE agent_host LIKE '%' || REPLACE(REPLACE(a.uri, 'claw://', ''), 'agent://', '') || '%') as is_paired
      FROM agents a
      ORDER BY a.created_at DESC
    `;
    return this.select<any[]>(query);
  }

  async execute(query: string, values?: any[]) {
    return this.db?.execute(query, values);
  }

  async select<T>(query: string, values?: any[]): Promise<T> {
    return (await this.db?.select<T>(query, values)) || ([] as any);
  }
}
