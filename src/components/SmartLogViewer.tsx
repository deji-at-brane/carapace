import React, { useState, useEffect, useRef } from "react";
import { Braces, X, Info, MessageSquare, Zap, AlertCircle } from "lucide-react";
import { LogEntry } from "../lib/mcp";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "../lib/utils";

interface SmartLogViewerProps {
  logs: LogEntry[];
  className?: string;
}

const LogItem: React.FC<{ entry: LogEntry }> = ({ entry }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse ANSI-like colors to basic styles (simplified)
  const formatText = (text: string) => {
    // This is a naive formatter for the [A2A ...] color codes we use
    return text.split(/(\x1b\[[0-9;]*m)/).map((part, i) => {
      if (part.startsWith('\x1b[')) {
        if (part.includes('36m')) return null; // Cyan handled as structural
        if (part.includes('32m')) return null; // Green handled as structural
        if (part.includes('35m')) return null; // Magenta handled as structural
        if (part.includes('31m')) return null; // Red handled as structural
        return null;
      }
      return <span key={i}>{part}</span>;
    }).filter(Boolean);
  };

  const getIcon = () => {
    switch (entry.type) {
      case 'task': return <Zap size={12} className="text-cyan-400" />;
      case 'message': return <MessageSquare size={12} className="text-purple-400" />;
      case 'error': return <AlertCircle size={12} className="text-red-400" />;
      default: return <Info size={12} className="text-gray-500" />;
    }
  };

  const getLabel = () => {
    switch (entry.type) {
      case 'task': return 'TASK';
      case 'message': return 'MSG';
      case 'error': return 'ERR';
      default: return 'INFO';
    }
  };

  const labelColor = {
    task: 'text-cyan-400 border-cyan-900/50 bg-cyan-950/30',
    message: 'text-purple-400 border-purple-900/50 bg-purple-950/30',
    error: 'text-red-400 border-red-900/50 bg-red-950/30',
    info: 'text-gray-400 border-gray-800 bg-gray-900/30'
  }[entry.type];

  return (
    <div className="group border-b border-white/[0.03] py-2 px-4 hover:bg-white/[0.01] transition-colors font-mono text-[11px]">
      <div className="flex items-start gap-3">
        {/* Timestamp */}
        <span className="text-gray-600 mt-0.5 shrink-0 tabular-nums">
          {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>

        {/* Label */}
        <span className={cn("px-1.5 py-0.5 rounded border text-[9px] font-bold shrink-0 flex items-center gap-1", labelColor)}>
          {getIcon()}
          {getLabel()}
        </span>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-300 break-words leading-relaxed">
              {formatText(entry.text)}
            </span>
            
            {entry.raw && (
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {!isExpanded ? (
                  <button 
                    onClick={() => setIsExpanded(true)}
                    className="p-1 hover:bg-white/10 rounded transition-colors text-gray-500 hover:text-cyan-400"
                    title="View Raw JSON"
                  >
                    <Braces size={14} />
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsExpanded(false)}
                    className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white"
                    title="Collapse"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Expanded JSON Content */}
          {isExpanded && entry.raw && (
            <div className="mt-3 bg-black/40 border border-white/5 rounded-md p-3 max-h-60 overflow-auto relative">
               <div className="absolute top-2 right-2 flex gap-1">
                 <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">JSON-RPC</span>
               </div>
               <pre className="text-cyan-500/80 text-[10px] leading-tight">
                 {JSON.stringify(entry.raw, null, 2)}
               </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const SmartLogViewer: React.FC<SmartLogViewerProps> = ({ logs, className }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom using hard anchor
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs]);

  return (
    <div className={cn("flex flex-col h-full bg-[#050505] rounded-lg border border-white/5 shadow-inner relative overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500/50" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
            <div className="w-2 h-2 rounded-full bg-green-500/50" />
          </div>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-2">Protocol Engine Activity</span>
        </div>
        <div className="text-[9px] text-gray-600 font-mono">
          {logs.length} EVENTS RECORDED
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 opacity-20 grayscale scale-90 pointer-events-none">
              <Zap size={48} className="mb-4 text-primary" />
              <p className="font-mono text-xs uppercase tracking-[0.2em]">Synchronizing neural link...</p>
            </div>
          ) : (
            <>
              {logs.map((log) => (
                <LogItem key={log.id} entry={log} />
              ))}
              <div ref={bottomRef} className="h-4" />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
