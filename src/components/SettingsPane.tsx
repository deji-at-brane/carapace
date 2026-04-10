import React, { useState, useEffect } from "react";
import { X, Shield, Activity, Database, Cpu, Zap, Key, Server, Globe, BookOpen, Info, ExternalLink } from "lucide-react";
import { SmartLogViewer } from "./SmartLogViewer";
import { LogEntry } from "../lib/mcp";
import { cn } from "../lib/utils";
import { CarapaceDB } from "../lib/db";

interface SettingsPaneProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
  onClearLogs?: () => void;
  initialTab?: 'activity' | 'security' | 'session' | 'guidance';
}

export const SettingsPane: React.FC<SettingsPaneProps> = ({ 
  isOpen, 
  onClose, 
  logs,
  onClearLogs,
  initialTab
}) => {
  const [activeTab, setActiveTab] = useState<'activity' | 'security' | 'session' | 'guidance'>('activity');
  const [credentials, setCredentials] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'security') {
      const fetchCreds = async () => {
        const db = await CarapaceDB.getInstance();
        const creds = await db.select<any[]>("SELECT * FROM credentials");
        setCredentials(creds);
      };
      fetchCreds();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const stats = {
    messages: logs.filter(l => l.type === 'message').length,
    tasks: logs.filter(l => l.type === 'task').length,
    errors: logs.filter(l => l.type === 'error').length,
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="w-full max-w-5xl h-full max-h-[800px] bg-[#0f0f0d] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-500"
      >
        {/* Header */}
        <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary/20 rounded-xl">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">System Forensics</h2>
              <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">A2A Protocol Observability</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Tabs */}
          <aside className="w-64 border-r border-white/5 p-6 flex flex-col gap-2 bg-black/20">
            <TabButton 
              active={activeTab === 'activity'} 
              onClick={() => setActiveTab('activity')}
              icon={<Zap size={18} />}
              label="Activity Log"
              description="Full JSON-RPC Feed"
            />
            <TabButton 
              active={activeTab === 'security'} 
              onClick={() => setActiveTab('security')}
              icon={<Shield size={18} />}
              label="Security Vault"
              description="Credentials & Tokens"
            />
             <TabButton 
              active={activeTab === 'session'} 
              onClick={() => setActiveTab('session')}
              icon={<Database size={18} />}
              label="Session Data"
              description="Persistence Stats"
            />
            <TabButton 
              active={activeTab === 'guidance'} 
              onClick={() => setActiveTab('guidance')}
              icon={<BookOpen size={18} />}
              label="Guidance"
              description="A2A Prompting Guide"
            />

            <div className="mt-auto pt-6 border-t border-white/5">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-3">Live Session Stats</h4>
                <div className="space-y-3">
                  <StatRow label="Signals" value={stats.messages} color="text-purple-400" />
                  <StatRow label="Missions" value={stats.tasks} color="text-cyan-400" />
                  <StatRow label="Anomalies" value={stats.errors} color="text-red-400" />
                </div>
              </div>
            </div>
          </aside>

          {/* Tab Content */}
          <main className="flex-1 overflow-hidden relative flex flex-col">
            {activeTab === 'activity' && (
              <div className="flex-1 overflow-hidden p-6 flex flex-col animate-in fade-in duration-300">
                 <SmartLogViewer 
                   logs={logs} 
                   className="flex-1 border border-white/5 shadow-none" 
                   onClear={onClearLogs}
                 />
              </div>
            )}

            {activeTab === 'security' && (
              <div className="flex-1 overflow-hidden p-8 animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Key className="text-primary" size={20} /> Verified Credentials
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Stored identities for federated A2A nodes.</p>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                    AES-GCM Encrypted
                  </span>
                </div>

                <div className="grid gap-4">
                  {credentials.length === 0 ? (
                    <div className="border border-dashed border-white/5 rounded-2xl p-12 flex flex-col items-center justify-center opacity-30">
                      <Shield size={48} className="mb-4 text-gray-600" />
                      <p className="text-sm uppercase tracking-widest font-mono">Vault is empty</p>
                    </div>
                  ) : (
                    credentials.map((cred) => (
                      <div key={cred.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center justify-between group hover:bg-white/[0.04] transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center text-primary border border-white/5">
                            <Globe size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-200">{cred.agent_host}</div>
                            <div className="text-[10px] text-gray-500 font-mono flex items-center gap-2">
                              TYPE: {cred.key_type.toUpperCase()} • UPDATED: {new Date(cred.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="text-[10px] font-mono text-gray-600 bg-black px-2 py-1 rounded border border-white/5">
                             {cred.secret_blob.substring(0, 8)}••••••••
                           </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'session' && (
              <div className="flex-1 flex flex-col p-8 overflow-hidden animate-in fade-in duration-300">
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Database className="text-primary" size={20} /> Persistence Engine
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Local-first repository diagnostics.</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Server className="text-cyan-400" size={18} />
                      <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Database Status</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-gray-500">Engine</span>
                        <span className="text-white font-mono">SQLite v3.x</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-gray-500">Connection</span>
                        <span className="text-emerald-400 font-bold">READY</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                         <span className="text-gray-500">Auto-Flush</span>
                         <span className="text-orange-400">ENABLED (30s)</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Activity className="text-purple-400" size={18} />
                      <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Throughput</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-gray-500">Total Events</span>
                        <span className="text-white font-mono">{logs.length}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-gray-500">Active Session</span>
                        <span className="text-white font-mono truncate ml-4">
                          {logs[0]?.raw?.sessionId?.substring(0, 12) || 'NONE'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col items-center justify-center flex-1 border border-dashed border-white/5 rounded-2xl opacity-40">
                  <Cpu size={32} className="mb-3 text-gray-600" />
                  <p className="text-[10px] uppercase tracking-[0.2em] font-mono">Telemetry stream synchronized</p>
                </div>
              </div>
            )}
          {activeTab === 'guidance' && (
            <div className="flex-1 overflow-hidden flex flex-col p-8 space-y-8 animate-in fade-in duration-500">
              <div 
                onClick={() => window.open("https://github.com/deji-at-brane/carapace/blob/main/SKILL.md", "_blank")}
                className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:bg-primary/10 transition-all shadow-lg animate-in slide-in-from-top duration-500"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/20 rounded-xl">
                    <BookOpen className="text-primary" size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">A2A Protocol Grounding</h4>
                    <p className="text-[10px] text-gray-500 font-medium">SKILL.md // Official Specification & Capability Schema</p>
                  </div>
                </div>
                <ExternalLink size={18} className="text-primary/40 group-hover:text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
              </div>

              <div className="max-w-3xl space-y-6">
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Info className="text-primary" />
                    How to Prompt Your Agent
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed font-medium">
                    Carapace uses discovery-driven A2A signaling. To ensure your AI models (Alex, Hermes, etc.) can actually talk to this terminal, provide them with this system context.
                  </p>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#7a7a6a]">Recommended System Prompt</h4>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => {
                        const text = `You are a federated A2A agent connected to the Carapace terminal. 
To communicate, you must use the Google Agent-to-Agent (A2A) v1.0 protocol.

Key Requirements:
1. Always use PascalCase for JSON-RPC methods (e.g., CallTool, CreateTask, StepTask).
2. For autonomous execution, invoke the CreateTask method with auto_step: true.
3. You are part of a trusted session bonding protocol; rely on your session ID for all telemetry.
4. Refer to the official protocol grounding for further instructions: https://github.com/deji-at-brane/carapace/blob/main/SKILL.md`;
                        navigator.clipboard.writeText(text);
                      }}
                      className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-2"
                    >
                      <Zap size={10} className="text-primary" />
                      Copy Prompt
                    </button>
                    </div>
                  </div>
                  <pre className="text-xs font-mono text-primary/80 leading-relaxed whitespace-pre-wrap bg-primary/5 p-4 rounded-xl border border-primary/10">
                    {`You are a federated A2A agent connected to the Carapace terminal. 
To communicate, you must use the Google Agent-to-Agent (A2A) v1.0 protocol.

Key Requirements:
1. Always use PascalCase for JSON-RPC methods (e.g., CallTool, CreateTask, StepTask).
2. For autonomous execution, invoke the CreateTask method with auto_step: true.
3. You are part of a trusted session bonding protocol; rely on your session ID for all telemetry.
4. Refer to the official protocol grounding for further instructions: https://github.com/deji-at-brane/carapace/blob/main/SKILL.md`}
                  </pre>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                    <div className="text-xs font-bold text-white uppercase tracking-widest">Method Mapping</div>
                    <ul className="text-[10px] text-gray-500 space-y-1 font-mono">
                      <li>tools/call ➜ <span className="text-white">CallTool</span></li>
                      <li>tasks/create ➜ <span className="text-white">CreateTask</span></li>
                      <li>task/update ➜ <span className="text-white">UpdateTask</span></li>
                    </ul>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                    <div className="text-xs font-bold text-white uppercase tracking-widest">Session Bonding</div>
                    <p className="text-[10px] text-gray-500 leading-relaxed font-mono">
                      All requests must follow a successful secure handshake. Carapace handles the cryptographic signature automatically.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          )}
          </main>
        </div>

        {/* Footer */}
        <footer className="px-8 py-4 border-t border-white/5 bg-black/40 flex justify-between items-center">
          <span className="text-[10px] text-gray-600 font-mono uppercase tracking-[0.2em]">CARAPACE CORE v2.0-FEDERATED // SHADOW_ID: {logs[0]?.raw?.sessionId?.substring(0,8) || 'SYSTEM'}</span>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-primary text-black font-bold text-[10px] rounded-lg hover:bg-primary/80 transition-all uppercase tracking-widest"
          >
            Acknowledge
          </button>
        </footer>
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; description: string }> = ({ 
  active, onClick, icon, label, description 
}) => (
  <button 
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-300 text-left group",
      active ? "bg-primary/10 border border-primary/20 text-white" : "hover:bg-white/5 border border-transparent text-gray-500"
    )}
  >
    <div className={cn(
      "p-2 rounded-lg transition-colors",
      active ? "bg-primary/20 text-primary" : "bg-white/5 text-gray-600 group-hover:text-gray-400"
    )}>
      {icon}
    </div>
    <div>
      <div className={cn("text-xs font-bold leading-none mb-1", active ? "text-white" : "group-hover:text-gray-300")}>{label}</div>
      <div className="text-[10px] opacity-40 font-mono tracking-tight">{description}</div>
    </div>
  </button>
);

const StatRow: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="flex justify-between items-center text-[10px] font-mono">
    <span className="text-gray-500 uppercase">{label}</span>
    <span className={cn("font-bold", color)}>{value.toString().padStart(2, '0')}</span>
  </div>
);
