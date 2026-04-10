import React, { useState, useEffect, useRef, useMemo } from "react";
import { Braces, X, Info, MessageSquare, Zap, AlertCircle, Search, Trash2 } from "lucide-react";
import { LogEntry } from "../lib/mcp";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "../lib/utils";

interface SmartLogViewerProps {
  logs: LogEntry[];
  className?: string;
  onClear?: () => void;
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
      case 'task': return <Zap size={10} className="text-cyan-400" />;
      case 'message': return <MessageSquare size={10} className="text-purple-400" />;
      case 'error': return <AlertCircle size={10} className="text-red-400" />;
      case 'success': return <Zap size={10} className="text-green-400" />;
      default: return <Info size={10} className="text-gray-500" />;
    }
  };

  const getLabel = () => {
    switch (entry.type) {
      case 'task': return 'TASK';
      case 'message': return 'MSG';
      case 'error': return 'ERR';
      case 'success': return 'OK';
      default: return 'INFO';
    }
  };

  const labelColor = {
    task: 'text-cyan-400 border-cyan-900/50 bg-cyan-950/30',
    message: 'text-purple-400 border-purple-900/50 bg-purple-950/30',
    error: 'text-red-400 border-red-900/50 bg-red-950/30',
    success: 'text-green-400 border-green-900/50 bg-green-950/30',
    info: 'text-gray-400 border-gray-800 bg-gray-900/30'
  }[entry.type];

  return (
    <div className="group border-b border-white/[0.03] py-2 px-4 hover:bg-white/[0.01] transition-colors font-mono text-[11px]">
      <div className="flex items-start gap-3">
        {/* Timestamp */}
        <span className="text-gray-600 mt-0.5 shrink-0 tabular-nums text-[9px]">
          {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>

        {/* Label */}
        <div className={cn("px-1.5 py-0.5 rounded border text-[8px] font-bold shrink-0 flex items-center gap-1 min-w-[42px] justify-center", labelColor)}>
          {getIcon()}
          {getLabel()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <span className="text-gray-300 break-words leading-relaxed">
              {formatText(entry.text)}
            </span>
            
            {entry.raw && (
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={cn(
                    "p-1 hover:bg-white/10 rounded transition-colors text-gray-500",
                    isExpanded ? "text-cyan-400 bg-cyan-500/10" : "hover:text-cyan-400"
                  )}
                  title={isExpanded ? "Collapse" : "View Raw JSON"}
                >
                  {isExpanded ? <X size={12} /> : <Braces size={12} />}
                </button>
              </div>
            )}
          </div>

          {/* Expanded JSON Content */}
          {isExpanded && entry.raw && (
            <div className="mt-3 bg-black/60 border border-white/5 rounded-md p-3 max-h-80 overflow-auto relative animate-in fade-in slide-in-from-top-2 duration-200">
               <div className="absolute top-2 right-2 flex gap-1">
                 <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">JSON-RPC</span>
               </div>
               <pre className="text-cyan-500/80 text-[10px] leading-tight font-mono">
                 {JSON.stringify(entry.raw, null, 2)}
               </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const SmartLogViewer: React.FC<SmartLogViewerProps> = ({ logs, className, onClear }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['task', 'message', 'error', 'success', 'info']));

  const toggleFilter = (type: string) => {
    const next = new Set(activeFilters);
    if (next.has(type)) {
      if (next.size > 1) next.delete(type);
    } else {
      next.add(type);
    }
    setActiveFilters(next);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const typeMatch = activeFilters.has(log.type);
      const searchMatch = !searchQuery || 
        log.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.raw && JSON.stringify(log.raw).toLowerCase().includes(searchQuery.toLowerCase()));
      return typeMatch && searchMatch;
    });
  }, [logs, activeFilters, searchQuery]);

  // Auto-scroll to bottom using hard anchor
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [filteredLogs.length]);

  return (
    <div className={cn("flex flex-col h-full bg-[#050505] rounded-l-lg border-l border-y border-white/5 shadow-2xl relative overflow-hidden", className)}>
      <div className="flex flex-col border-b border-white/5 bg-white/[0.02]">
        {/* Header Title */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-green-500/30" />
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] ml-2">Protocol Activity</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-gray-600 font-mono uppercase">
              {filteredLogs.length} OF {logs.length} EVENTS
            </span>
            {onClear && (
               <button 
                 onClick={onClear}
                 className="p-1.5 hover:bg-red-500/10 text-gray-600 hover:text-red-400 rounded-md transition-all"
                 title="Clear History"
               >
                 <Trash2 size={12} />
               </button>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-4 pb-3 flex items-center gap-3">
          <div className="flex-1 relative group">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-cyan-500 transition-colors" size={12} />
            <input 
              type="text"
              placeholder="Search logic stream..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/5 rounded-md pl-8 pr-3 py-1.5 text-[10px] text-gray-300 placeholder:text-gray-700 outline-none focus:border-cyan-500/50 focus:bg-black/60 transition-all font-mono"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white"
              >
                <X size={10} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 rounded-md p-1">
            {['task', 'message', 'error', 'info'].map((type) => (
              <button
                key={type}
                onClick={() => toggleFilter(type)}
                className={cn(
                  "px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all",
                  activeFilters.has(type) 
                    ? {
                        task: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
                        message: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
                        error: 'bg-red-500/20 text-red-400 border border-red-500/30',
                        info: 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                      }[type as 'task'|'message'|'error'|'info']
                    : "text-gray-600 hover:text-gray-400 border border-transparent"
                )}
              >
                {type === 'message' ? 'MSG' : type === 'error' ? 'ERR' : type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 opacity-20 grayscale scale-90 pointer-events-none">
              <Zap size={40} className="mb-4 text-cyan-500" />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
                {searchQuery ? "No matching signals found" : "Neural link synchronized"}
              </p>
            </div>
          ) : (
            <>
              {filteredLogs.map((log) => (
                <LogItem key={log.id} entry={log} />
              ))}
              <div ref={bottomRef} className="h-8" />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
