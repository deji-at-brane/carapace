import { useState, useEffect } from "react";
import { AgentCard, Agent } from "./AgentCard";
import { CarapaceDB } from "@/lib/db";
import { ScrollArea } from "./ui/scroll-area";
import { Search, Globe, Zap, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { A2AManager } from "@/lib/a2a";

interface DiscoveryGridProps {
  searchTerm: string;
  onConnect?: (agent: Agent) => void;
}

export function DiscoveryGrid({ searchTerm, onConnect }: DiscoveryGridProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Direct Connect State
  const [directUri, setDirectUri] = useState("");
  const [isProbing, setIsProbing] = useState(false);
  const [discoveredCard, setDiscoveredCard] = useState<any | null>(null);
  const [customName, setCustomName] = useState("");
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const db = await CarapaceDB.getInstance();
      const results = await db.select<Agent[]>("SELECT * FROM agents ORDER BY category, name");
      setAgents(results);
    } catch (error) {
      console.error("Failed to fetch agents for Discovery Hub:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProbe = async () => {
    if (!directUri.trim()) return;
    setIsProbing(true);
    setDiscoveryError(null);
    setDiscoveredCard(null);

    try {
      const card = await A2AManager.discover(directUri);
      if (card) {
        setDiscoveredCard(card);
        setCustomName(""); // Start fresh
      } else {
        setDiscoveryError("No Agent Card found at this address. Is the agent online?");
      }
    } catch (e) {
      setDiscoveryError("Connection failed. Check the URI and network.");
    } finally {
      setIsProbing(false);
    }
  };

  const handleFinalizeDiscovery = async () => {
    if (!discoveredCard) return;
    
    const db = await CarapaceDB.getInstance();
    const finalName = customName.trim() || discoveredCard.name;
    const agentId = `discovered-${Date.now()}`;
    
    const newAgent: Agent = {
      id: agentId,
      name: finalName,
      description: discoveredCard.description || "Autonomically discovered federated agent.",
      uri: directUri,
      category: "Discovery",
      icon_name: "ShieldCheck",
      is_pinned: false
    };

    try {
      await db.upsertAgent(newAgent);
      if (onConnect) onConnect(newAgent);
      
      // Cleanup
      setDirectUri("");
      setDiscoveredCard(null);
      fetchAgents(); // Refresh list
    } catch (e) {
      setDiscoveryError("Failed to save agent to registry.");
    }
  };

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && agents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-t-2 border-primary border-r-2 border-primary/20 rounded-full" />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-8">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold tracking-tighter text-white">System Ready</h1>
            <p className="text-lg text-[#7a7a6a] font-medium">Connect to an agent or browse the central registry.</p>
          </div>
        </div>

        {/* 🛰️ DIRECT CONNECT PANEL */}
        <div className="bg-[#0f0f0d] border border-[#2a2a24] rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-tighter text-gray-400">Direct Connect Portal</h2>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input 
                type="text"
                value={directUri}
                onChange={(e) => setDirectUri(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleProbe()}
                placeholder="a2a://148.230.87.184:18889/?token=..."
                className="w-full bg-black border border-[#3a3a30] rounded-2xl px-5 py-4 text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all pr-12"
              />
              <button 
                onClick={handleProbe}
                disabled={isProbing || !directUri}
                className="absolute right-2 top-2 bottom-2 px-4 bg-primary text-black rounded-xl font-bold hover:bg-primary/80 transition-all disabled:opacity-50"
              >
                {isProbing ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {discoveryError && (
            <div className="p-4 bg-red-900/10 border border-red-900/30 rounded-xl text-red-400 text-xs flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {discoveryError}
            </div>
          )}

          {discoveredCard && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-500 p-6 bg-primary/5 border border-primary/20 rounded-2xl space-y-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-primary/20 rounded-full flex items-center justify-center">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white leading-tight">Identity Found: {discoveredCard.name}</h3>
                    <p className="text-sm text-gray-400">Protocol: {discoveredCard.version || "A2A v1.0"}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#2a2a24]">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-primary/60 tracking-widest">Name the Agent</label>
                  <input 
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Alex the Operator"
                    className="w-full bg-black border border-[#3a3a30] rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition-all"
                  />
                  <p className="text-[10px] text-gray-500 italic">Overrides the reported name in your private registry.</p>
                </div>

                <div className="flex items-end">
                  <button 
                    onClick={handleFinalizeDiscovery}
                    className="w-full py-3 bg-primary text-black rounded-xl font-extrabold uppercase tracking-widest hover:scale-[1.02] shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    Finalize & Bond
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </ScrollArea>
  );
}
