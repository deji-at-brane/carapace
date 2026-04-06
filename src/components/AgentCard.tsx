import { 
  LayoutGrid, 
  Terminal, 
  Compass, 
  Cpu, 
  Activity,
  Zap
} from "lucide-react";

export interface Agent {
  id: string;
  name: string;
  description: string;
  uri: string;
  category: string;
  icon_name: string;
  is_pinned?: boolean;
}

const iconMap: Record<string, any> = {
  LayoutGrid,
  Terminal,
  Compass,
  Cpu,
  Activity,
  Zap
};

interface AgentCardProps {
  agent: Agent;
  onConnect?: (agent: Agent) => void;
}

export function AgentCard({ agent, onConnect }: AgentCardProps) {
  const Icon = iconMap[agent.icon_name] || LayoutGrid;

  return (
    <div 
      onClick={() => onConnect?.(agent)}
      className="group bg-[#0f0f0d] p-6 rounded-3xl border border-[#2a2a24] hover:border-primary/50 transition-all duration-500 cursor-pointer hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative overflow-hidden active:scale-[0.98]"
    >
      <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner">
        <Icon size={24} />
      </div>

      <div className="absolute top-6 right-6 flex gap-2 translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[8px] font-bold uppercase tracking-wider border border-primary/20">
          {agent.category}
        </span>
      </div>

      <h3 className="text-xl font-bold mb-3 text-white group-hover:text-primary transition-colors">
        {agent.name}
      </h3>
      
      <p className="text-sm text-[#7a7a6a] leading-relaxed mb-4 line-clamp-2">
        {agent.description}
      </p>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-500">
          <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Initialize Handshake →</span>
        </div>
        <span className="text-[9px] font-mono text-[#3a3a30] group-hover:text-[#5a5a50] transition-colors uppercase">
          {agent.uri.split('://')[1]}
        </span>
      </div>

      {/* Gloss reflection overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
}
