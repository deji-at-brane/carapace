import { useState, useEffect, useRef } from "react";
import { 
  LayoutGrid, 
  Settings, 
  Search, 
  Plus, 
  Terminal as TerminalIcon,
  MessageSquare,
  Compass
} from "lucide-react";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { DiscoveryGrid } from "@/components/DiscoveryGrid";
import { Agent } from "@/components/AgentCard";
import { ToolDrawer } from "@/components/ToolDrawer";
import { PairingOverlay, PairingStep } from "@/components/PairingOverlay";
import { TerminalCanvas, TerminalHandle } from "@/components/TerminalCanvas";
import { MCPClient, createTransport, MCPTool, parseAgentUri, ClawPairingManager } from "@/lib/mcp";
import { CarapaceDB } from "@/lib/db";
import { cn } from "@/lib/utils";
import "./App.css";

const INITIAL_PAIRING_STEPS: PairingStep[] = [
  { id: "handshake", label: "Protocol Negotiation", status: "waiting" },
  { id: "approval", label: "Host Approval", status: "waiting" },
  { id: "finalize", label: "Credential Sync", status: "waiting" }
];

function App() {
  const [showTerminal, setShowTerminal] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [currentClient, setCurrentClient] = useState<MCPClient | null>(null);
  const [pairingTask, setPairingTask] = useState<{ active: boolean; error: string | null } | null>(null);
  const [pairingSteps, setPairingSteps] = useState<PairingStep[]>(INITIAL_PAIRING_STEPS);
  const terminalRef = useRef<TerminalHandle>(null);

  const handleConnect = async (agent: Agent) => {
    if (!terminalRef.current) return;
    
    setShowTerminal(true);
    terminalRef.current.clear();
    terminalRef.current.writeln(`\x1b[1;36m[CONNECTING]\x1b[0m Establishing secure channel to ${agent.name}...`);
    terminalRef.current.writeln(`\x1b[90mTARGET URI: ${agent.uri}\x1b[0m\r\n`);

    try {
      // 1. Initialize Protocol
      const transport = createTransport(agent.uri); 
      const client = new MCPClient(transport, (msg) => {
        terminalRef.current?.writeln(`\x1b[33m${msg}\x1b[0m`);
      });

      await client.initialize();
      setCurrentClient(client);

      // 2. Automated Tool Discovery
      const tools = await client.listTools();
      setAvailableTools(tools);
      
      // 3. Persist Session
      const db = await CarapaceDB.getInstance();
      const sessionId = await db.createSession(agent.name, agent.uri);
      
      terminalRef.current.writeln(`\r\n\x1b[1;32m[SUCCESS]\x1b[0m Handshake complete. Session \x1b[36m${sessionId.substring(0,8)}\x1b[0m active.`);
      terminalRef.current.write("\r\n\x1b[1;35m$\x1b[0m ");

    } catch (error) {
      terminalRef.current.writeln(`\r\n\x1b[1;31m[ERROR]\x1b[0m Handshake failed: ${error}`);
      terminalRef.current.write("\r\n\x1b[1;35m$\x1b[0m ");
    }
  };

  const handleDirectConnect = () => {
    if (!searchTerm.trim()) return;
    
    if (searchTerm.startsWith("claw://")) {
      startClawPairing(searchTerm.trim());
      setSearchTerm("");
      return;
    }

    if (searchTerm.includes("://") || searchTerm.startsWith("http")) {
      handleConnect({
        id: "direct-node",
        name: "Remote Node",
        description: "Direct connection via URI override.",
        uri: searchTerm.trim(),
        category: "Production",
        icon_name: "Activity"
      });
      setSearchTerm("");
    }
  };

  const startClawPairing = async (uri: string) => {
    const parsed = parseAgentUri(uri);
    if (!parsed || !parsed.token) return;

    setPairingTask({ active: true, error: null });
    setPairingSteps(INITIAL_PAIRING_STEPS.map((s, i) => i === 0 ? { ...s, status: "active" } : s));

    try {
      // Step 1: Initiate Handshake
      const result = await ClawPairingManager.initiate(parsed.host, parsed.token);
      const { statusUrl, api_token, gatewayUrl } = result;
      
      setPairingSteps(prev => prev.map(s => s.id === "handshake" ? { ...s, status: "complete" } : s.id === "approval" ? { ...s, status: "active" } : s));

      // Handle immediate approval (WebSocket flow)
      if (api_token) {
        setPairingSteps(prev => prev.map(s => s.id === "approval" ? { ...s, status: "complete" } : s.id === "finalize" ? { ...s, status: "active" } : s));
        const db = await CarapaceDB.getInstance();
        await db.saveCredential(gatewayUrl || parsed.host, api_token);
        setPairingSteps(prev => prev.map(s => ({ ...s, status: "complete" })));
        setTimeout(() => setPairingTask(null), 1500);
        return;
      }

      // Step 2: Poll for Approval (REST flow)
      let attempts = 0;
      const checkAndPoll = async () => {
        if (!statusUrl) throw new Error("No status URL provided by gateway.");
        if (attempts > 40) throw new Error("Pairing timed out. Please try again.");
        attempts++;
        
        const pollResult = await ClawPairingManager.pollStatus(statusUrl);
        if (pollResult.status === "APPROVED" && pollResult.api_token) {
          setPairingSteps(prev => prev.map(s => s.id === "approval" ? { ...s, status: "complete" } : s.id === "finalize" ? { ...s, status: "active" } : s));
          
          const db = await CarapaceDB.getInstance();
          await db.saveCredential(gatewayUrl || parsed.host, pollResult.api_token);
          
          setPairingSteps(prev => prev.map(s => ({ ...s, status: "complete" })));
          setTimeout(() => setPairingTask(null), 1500);
        } else {
          setTimeout(checkAndPoll, 3000);
        }
      };

      await checkAndPoll();
    } catch (error: any) {
      setPairingTask({ active: true, error: error.message });
    }
  };

  const handleInvokeTool = async (tool: MCPTool) => {
    if (!terminalRef.current || !currentClient) return;

    terminalRef.current.writeln(`\r\n\x1b[1;36m[INVOKE]\x1b[0m \x1b[1m${tool.name}\x1b[0m ...`);
    
    try {
      const result = await currentClient.callTool(tool.name, {});
      terminalRef.current.writeln(`\x1b[1;32m[RESULT]\x1b[0m Execution complete.`);
      
      result.content.forEach((c: any) => {
        if (c.text) terminalRef.current?.writeln(c.text);
      });
      terminalRef.current.write("\r\n\x1b[1;35m$\x1b[0m ");
    } catch (error) {
      terminalRef.current.writeln(`\x1b[1;31m[ERROR]\x1b[0m Tool execution failed: ${error}`);
      terminalRef.current.write("\r\n\x1b[1;35m$\x1b[0m ");
    }
  };

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupDeepLink = async () => {
      try {
        unlisten = await onOpenUrl((urls) => {
          console.log("Deep link received:", urls);
          // TODO: Implement actual session routing
        });
      } catch (error) {
        console.error("Failed to initialize deep link listener:", error);
      }
    };

    setupDeepLink();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <div className="flex h-screen w-full bg-[#0a0a09] text-[#e0e0d0] overflow-hidden font-sans antialiased selection:bg-primary/30">
      {/* Sidebar: Pro Navigation */}
      <aside className="w-16 flex flex-col items-center py-6 border-r border-[#2a2a24]/50 bg-[#0f0f0d] z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-3 mb-10 bg-primary/15 rounded-2xl text-primary border border-primary/25 shadow-[0_0_20px_rgba(var(--primary),0.1)]">
          <LayoutGrid size={24} strokeWidth={2.5} />
        </div>
        
        <nav className="flex-1 flex flex-col gap-5">
          <button className="p-3.5 hover:bg-[#1a1a17] rounded-2xl transition-all duration-300 text-[#7a7a6a] hover:text-[#e0e0d0] group">
            <Compass size={22} className="group-hover:scale-110 transition-transform" />
          </button>
          <button className="p-3.5 hover:bg-[#1a1a17] rounded-2xl transition-all duration-300 text-[#7a7a6a] hover:text-[#e0e0d0] group">
            <MessageSquare size={22} className="group-hover:scale-110 transition-transform" />
          </button>
          <button 
            onClick={() => setShowTerminal(!showTerminal)}
            className={cn(
              "p-3.5 rounded-2xl transition-all duration-500 relative",
              showTerminal 
                ? "bg-primary text-primary-foreground shadow-[0_0_25px_rgba(var(--primary),0.3)]" 
                : "hover:bg-[#1a1a17] text-[#7a7a6a] hover:text-[#e0e0d0]"
            )}
          >
            <TerminalIcon size={22} />
            {showTerminal && <span className="absolute -right-1 -top-1 w-2.5 h-2.5 bg-white rounded-full animate-pulse blur-[1px]"></span>}
          </button>
        </nav>

        <div className="flex flex-col gap-5">
          <button className="p-3.5 hover:bg-[#1a1a17] rounded-2xl transition-all duration-300 text-[#7a7a6a] hover:text-[#e0e0d0]">
            <Settings size={22} />
          </button>
        </div>
      </aside>

      {/* Main Orchestration Canvas */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a09] relative shadow-2xl">
        <header className="h-16 border-b border-[#2a2a24]/50 flex items-center px-6 justify-between bg-[#0f0f0d]/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex bg-[#1a1a17] rounded-xl p-1 shadow-inner">
              <button className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#2a2a24] text-white shadow-xl transition-all">Main</button>
              <button className="p-2 text-[#7a7a6a] hover:text-white transition-colors"><Plus size={14} /></button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a6a] group-focus-within:text-primary transition-colors" size={16} />
              <input 
                placeholder="agent://discover or https://..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDirectConnect()}
                className="bg-[#1a1a17] border border-[#2a2a24] rounded-xl pl-10 pr-4 py-2 text-sm w-72 focus:w-96 transition-all duration-500 focus:bg-black focus:ring-1 focus:ring-primary/50 outline-none text-[#e0e0d0] placeholder-[#4a4a40]"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex relative">
          {pairingTask?.active && (
            <PairingOverlay 
              steps={pairingSteps} 
              onCancel={() => setPairingTask(null)} 
              error={pairingTask.error}
            />
          )}

          <DiscoveryGrid 
            searchTerm={searchTerm} 
            onConnect={handleConnect} 
          />

          {/* Persistent Terminal Interface */}
          <div 
            className={cn(
              "absolute bottom-0 left-0 right-0 h-64 border-t border-[#2a2a24] bg-black/95 backdrop-blur-2xl transition-all duration-700 ease-in-out z-10 shadow-2xl",
              showTerminal ? "translate-y-0" : "translate-y-full opacity-0"
            )}
          >
            <div className="h-10 border-b border-[#2a2a24]/50 flex items-center px-5 justify-between text-[10px] font-bold text-[#4a4a40] uppercase tracking-[0.2em]">
              <span className="flex items-center gap-2 underline decoration-primary underline-offset-4 decoration-2">Agent Console Output</span>
              <button onClick={() => setShowTerminal(false)} className="hover:text-white transition-colors">[ TERMINATE ]</button>
            </div>
            <div className="p-3 h-[calc(100%-2.5rem)]">
              <TerminalCanvas ref={terminalRef} />
            </div>
          </div>

          <aside className="w-80 border-l border-[#2a2a24]/50 bg-[#0f0f0d]/50 backdrop-blur-sm hidden lg:flex flex-col">
            <ToolDrawer 
              tools={availableTools} 
              onInvoke={handleInvokeTool} 
              isConnected={currentClient !== null} 
            />
          </aside>
        </div>

        <footer className="h-12 border-t border-[#2a2a24]/50 bg-[#0f0f0d]/90 backdrop-blur-md flex items-center px-6 justify-between text-[10px] font-bold font-mono text-[#4a4a40] z-20">
          <div className="flex gap-6">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),1)]"></span> NODE STATUS: ACTIVE</span>
            <span className="opacity-40">ENV: v0.1.0-alpha</span>
          </div>
          <div className="flex gap-6">
            <span className="hover:text-[#7a7a6a] cursor-default transition-colors">VOL: 12.4 MB</span>
            <span className="hover:text-[#7a7a6a] cursor-default transition-colors">RRT: 14ms</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
