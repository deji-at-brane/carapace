import Database from "@tauri-apps/plugin-sql";

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

    await this.seedAgents();
  }

  private async seedAgents() {
    const existing = await this.select("SELECT COUNT(*) as count FROM agents");
    // @ts-ignore
    if (existing[0]?.count > 0) return;

    console.log("Seeding discovery hub with default agents...");
    const defaultAgents = [
      { id: "researcher-1", name: "Cloud Researcher", description: "Deep web searching and document synthesis node.", uri: "agent://research.carapace.io", category: "Research", icon: "Compass" },
      { id: "coder-1", name: "Logic Architect", description: "High-context coding assistant with multi-file awareness.", uri: "agent://code.carapace.io", category: "Development", icon: "Terminal" },
      { id: "analyst-1", name: "Data Sentinel", description: "Real-time log analysis and pattern recognition engine.", uri: "agent://analysis.carapace.io", category: "Analysis", icon: "LayoutGrid" }
    ];

    for (const agent of defaultAgents) {
      await this.execute(
        "INSERT INTO agents (id, name, description, uri, category, icon_name) VALUES (?, ?, ?, ?, ?, ?)",
        [agent.id, agent.name, agent.description, agent.uri, agent.category, agent.icon]
      );
    }
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

  async execute(query: string, values?: any[]) {
    return this.db?.execute(query, values);
  }

  async select<T>(query: string, values?: any[]): Promise<T> {
    return (await this.db?.select<T>(query, values)) || ([] as any);
  }
}
