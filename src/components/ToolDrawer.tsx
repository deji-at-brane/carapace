import { 
  Zap, 
  Activity,
  Cpu,
  ChevronRight,
  Info
} from "lucide-react";
import { MCPTool } from "@/lib/mcp";

interface ToolDrawerProps {
  tools: MCPTool[];
  onInvoke: (tool: MCPTool) => void;
  isConnected: boolean;
}

export function ToolDrawer({ tools, onInvoke, isConnected }: ToolDrawerProps) {
  if (!isConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 opacity-30">
        <div className="p-4 bg-[#1a1a17] rounded-full border border-[#2a2a24]">
          <Cpu size={32} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold uppercase tracking-widest">No Node Selected</p>
          <p className="text-[10px] text-[#7a7a6a]">Connect to an agent to discover its localized toolset.</p>
        </div>
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <Activity size={32} className="text-[#3a3a30] animate-pulse" />
        <p className="text-xs text-[#7a7a6a]">Discovering node capabilities...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-5 border-b border-[#2a2a24]/50 flex items-center justify-between">
        <div className="font-bold text-[10px] tracking-[0.3em] uppercase text-[#4a4a40]">Capabilities</div>
        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[8px] font-bold border border-primary/20">
          {tools.length} TOOLS
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3 custom-scrollbar">
        {tools.map((tool) => (
          <div 
            key={tool.name}
            onClick={() => onInvoke(tool)}
            className="group p-4 bg-[#1a1a17]/50 rounded-2xl border border-[#2a2a24] hover:border-primary/40 transition-all duration-300 cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="h-8 w-8 bg-[#2a2a24] rounded-lg flex items-center justify-center text-[#7a7a6a] group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                <Zap size={16} />
              </div>
              <ChevronRight size={14} className="text-[#3a3a30] group-hover:text-primary transition-colors" />
            </div>
            
            <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors mb-1 truncate">
              {tool.name}
            </h4>
            
            <p className="text-[10px] text-[#7a7a6a] leading-relaxed line-clamp-2 mb-3">
              {tool.description || "No description provided."}
            </p>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[8px] font-bold uppercase tracking-widest text-primary flex items-center gap-1">
                Invoke Command <Zap size={8} fill="currentColor" />
              </span>
            </div>
          </div>
        ))}

        <div className="pt-6 pb-4">
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex gap-3">
            <Info size={16} className="text-primary shrink-0" />
            <p className="text-[10px] text-[#7a7a6a] leading-normal italic">
              Tools are executed locally or on the remote node with strict sandboxing and session isolation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
