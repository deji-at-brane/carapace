import { useState, useEffect } from "react";
import { CarapaceDB } from "@/lib/db";
import { Agent } from "@/lib/types";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { ShieldCheck, Activity, Compass, Terminal, Zap, LayoutGrid } from "lucide-react";

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
}

export function AgentSidebarList({ searchTerm, selectedAgentId, onSelect }: AgentSidebarListProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    fetchAgents();
    
    // Refresh interval for live status updates
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#0f0f0d]/50 backdrop-blur-xl border-r border-[#2a2a24]/50 w-80 shrink-0">
      <div className="p-6 border-b border-[#2a2a24]/30">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#4a4a40]">Active Nodes</h2>
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
              <button
                key={agent.id}
                onClick={() => onSelect(agent)}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 group",
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
                
                <div className="flex-1 text-left min-w-0">
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

                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),1)]" />
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
