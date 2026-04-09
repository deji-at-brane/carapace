import { useState, useEffect } from "react";
import { AgentCard, Agent } from "./AgentCard";
import { CarapaceDB } from "@/lib/db";
import { ScrollArea } from "./ui/scroll-area";
import { Search } from "lucide-react";

interface DiscoveryGridProps {
  searchTerm: string;
  onConnect?: (agent: Agent) => void;
}

export function DiscoveryGrid({ searchTerm, onConnect }: DiscoveryGridProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const db = await CarapaceDB.getInstance();
        const results = await db.select<Agent[]>("SELECT * FROM agents ORDER BY category, name");
        setAgents(results);
      } catch (error) {
        console.error("Failed to fetch agents for Discovery Hub:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, []);

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
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
          <button 
            onClick={async () => {
              const db = await CarapaceDB.getInstance();
              await db.seedAgents();
              window.location.reload();
            }}
            className="px-4 py-2 bg-[#1a1a17] hover:bg-primary/20 hover:text-primary border border-[#2a2a24] rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95"
          >
            Sync Registry
          </button>
        </div>

        {filteredAgents.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-50 bg-[#0f0f0d] rounded-3xl border border-dashed border-[#2a2a24]">
            <Search size={48} className="text-[#3a3a30]" />
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-2">No agents found</h3>
              <p className="text-sm text-[#7a7a6a]">The registry appears to be empty. Click 'Sync Registry' to restore default nodes.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => (
              <AgentCard 
                key={agent.id} 
                agent={agent} 
                onConnect={onConnect} 
              />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
