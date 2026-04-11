import { useState, useEffect } from "react";
import { CarapaceDB } from "@/lib/db";
import { Agent } from "@/lib/types";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { ShieldCheck, Activity, Compass, Terminal, Zap, LayoutGrid, Trash2, ShieldAlert, X } from "lucide-react";

const iconMap: Record<string, any> = {
  LayoutGrid,
  Terminal,
  Compass,
  Zap,
  Activity,
  ShieldCheck
};

interface AgentSidebarListProps {
  searchTerm: string;
  selectedAgentId?: string;
  onSelect: (agent: Agent) => void;
  onDelete?: (agentId: string) => void;
}

export function AgentSidebarList({ searchTerm, selectedAgentId, onSelect, onDelete }: AgentSidebarListProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);

  const fetchAgents = async () => {
    try {
      const db = await CarapaceDB.getInstance();
      const results = await db.getAgentsWithStatus();
      setAgents(results);
    } catch (error) {
      console.error("Failed to fetch agents for Sidebar:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    
    // Refresh interval for live status updates
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async () => {
    if (!agentToDelete) return;

    try {
      const db = await CarapaceDB.getInstance();
      await db.deleteAgent(agentToDelete.id, agentToDelete.uri);
      
      // Notify parent to reset selection if needed
      onDelete?.(agentToDelete.id);
      
      // Local state update
      await fetchAgents();
      setAgentToDelete(null);
    } catch (error) {
      console.error("Failed to delete agent:", error);
      alert("Nuclear purge failed. See console for details.");
    }
  };

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#0f0f0d]/50 backdrop-blur-xl border-r border-[#2a2a24]/50 w-80 shrink-0 relative">
      <div className="p-6 border-b border-[#2a2a24]/30">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#4a4a40]">Active Agents</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {loading && agents.length === 0 ? (
            <div className="p-4 flex justify-center"><div className="animate-spin h-5 w-5 border-t-2 border-primary rounded-full" /></div>
            ) : filteredAgents.map((agent: any) => {
            const Icon = iconMap[agent.icon_name] || LayoutGrid;
            const isActive = agent.id === selectedAgentId;
            const isPaired = agent.is_paired > 0;

            return (
              <div key={agent.id} className="group relative">
                <button
                  onClick={() => onSelect(agent)}
                  className={cn(
                    "w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-300",
                    isActive 
                      ? "bg-primary/15 border border-primary/25 shadow-[0_0_20px_rgba(var(--primary),0.05)]" 
                      : "hover:bg-[#1a1a17] border border-transparent"
                  )}
                >
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:scale-110 relative",
                    isActive ? "bg-primary text-primary-foreground" : "bg-[#1a1a17] text-[#7a7a6a]"
                  )}>
                    <Icon size={18} />
                    {isPaired && !isActive && (
                      <div className="absolute -top-1 -right-1 bg-[#0f0f0d] rounded-full p-0.5">
                        <ShieldCheck className="text-emerald-500" size={12} fill="currentColor" fillOpacity={0.2} />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 text-left min-w-0 pr-6">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "text-sm font-bold truncate flex items-center gap-1.5",
                        isActive ? "text-white" : "text-[#7a7a6a] group-hover:text-[#e0e0d0]"
                      )}>
                        {agent.name}
                        {isPaired && isActive && <ShieldCheck size={12} className="text-emerald-500" />}
                      </span>
                      <span className="text-[8px] uppercase font-bold tracking-widest text-[#3a3a30]">{agent.category}</span>
                    </div>
                    <p className="text-[10px] text-[#4a4a40] truncate mt-0.5 font-mono">
                      {isPaired ? "TRUSTED SESSION" : agent.uri.replace(/^(claw|agent):\/\//, "")}
                    </p>
                  </div>
                </button>

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setAgentToDelete(agent);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* HARD WARNING OVERLAY */}
      {agentToDelete && (
        <div className="absolute inset-0 z-50 bg-[#0a0a09]/90 backdrop-blur-md p-6 flex flex-col justify-center items-center text-center animate-in fade-in zoom-in duration-300">
          <div className="p-4 bg-red-500/10 rounded-full mb-4 border border-red-500/20">
            <ShieldAlert className="text-red-500" size={48} />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Nuclear Purge</h3>
          <p className="text-xs text-[#7a7a6a] leading-relaxed mb-6">
            Are you sure you want to delete <span className="text-white font-bold">{agentToDelete.name}</span>?
            <br /><br />
            This will permanently destroy all <span className="text-red-400 font-bold uppercase">Trusted Session Tokens</span> in your vault. You will need a new Setup Code from Alex to reconnect.
          </p>
          
          <div className="w-full flex flex-col gap-3">
            <button 
              onClick={handleDelete}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] text-xs uppercase tracking-widest"
            >
              Confirm Permanent Deletion
            </button>
            <button 
              onClick={() => setAgentToDelete(null)}
              className="w-full bg-[#1a1a17] hover:bg-[#2a2a24] text-[#7a7a6a] font-bold py-3 rounded-xl transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
