import { 
  Lock, 
  ShieldCheck, 
  Activity, 
  Loader2,
  X 
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PairingStep {
  id: string;
  label: string;
  status: "waiting" | "active" | "complete" | "error";
}

interface PairingOverlayProps {
  steps: PairingStep[];
  onCancel: () => void;
  error?: string | null;
  statusMessage?: string | null;
  customClientId?: string;
  setCustomClientId?: (val: string) => void;
  showAdvanced?: boolean;
  setShowAdvanced?: (val: boolean) => void;
}

export function PairingOverlay({ 
  steps, 
  onCancel, 
  error,
  statusMessage,
  customClientId,
  setCustomClientId,
  showAdvanced,
  setShowAdvanced
}: PairingOverlayProps) {
  // Helper to generate diagnostic tips
  const getDiagnosticTip = (err: string) => {
    if (err.includes("NETWORK_ERROR")) return "The gateway might be behind a firewall. Try white-listing port 18789.";
    if (err.includes("TLS_ERROR")) return "SSL validation failed. If this is a local agent, use claw:// instead of agt://.";
    if (err.includes("AUTH_REJECTED")) return "The agent rejected your Setup Token. It might be expired or already used.";
    if (err.includes("TIMEOUT")) return "The connection timed out. Check if the agent's PTY is still running.";
    if (err.includes("PROTOCOL_ERROR")) return "The target is not responding as a valid OpenClaw v3 node.";
    return "Check your network connection and ensure the Alex agent is reachable.";
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-transparent backdrop-blur-md animate-in fade-in duration-500">
      <div className="relative w-full max-w-md max-h-[90vh] p-8 bg-[#0f0f0d] border border-[#2a2a24] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-y-auto custom-scrollbar">
        {/* Progress Glow */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
        
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="relative">
            <div className="p-5 bg-primary/10 rounded-full border border-primary/20 text-primary">
              {error ? (
                <Activity size={32} className="text-red-500" />
              ) : (
                <Lock size={32} className="animate-pulse" />
              )}
            </div>
            {!error && (
              <div className="absolute -inset-2 rounded-full border border-primary/20 animate-ping opacity-20"></div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight text-white">Direct Gateway Pairing</h3>
            <p className="text-sm text-[#7a7a6a]">Establishing secure bond with OpenClaw Axle Gateway.</p>
          </div>

          <div className="w-full space-y-4 py-2">
            {steps.map((step, idx) => (
              <div 
                key={step.id}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-xl border transition-all duration-300",
                  step.status === "active" ? "bg-primary/5 border-primary/20" : "bg-transparent border-transparent",
                  step.status === "complete" ? "opacity-100" : "opacity-40",
                  step.status === "error" ? "bg-red-500/5 border-red-500/20 opacity-100" : ""
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold",
                  step.status === "complete" ? "bg-primary text-primary-foreground" : 
                  step.status === "error" ? "bg-red-500 text-white" : "bg-[#1a1a17] text-[#4a4a40]"
                )}>
                  {step.status === "complete" ? (
                    <ShieldCheck size={14} />
                  ) : step.status === "active" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : step.status === "error" ? (
                    <X size={14} />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span className={cn(
                  "text-xs font-bold uppercase tracking-wider text-left flex-1",
                  step.status === "active" ? "text-primary" : 
                  step.status === "error" ? "text-red-400" : "text-[#7a7a6a]"
                )}>
                  {step.label}
                  {step.status === "active" && statusMessage && (
                    <span className="block text-[9px] font-mono text-[#4a4a40] normal-case truncate">{statusMessage}</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {error && (
            <div className="w-full space-y-3">
              <div className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-100 text-[10px] text-left leading-relaxed font-mono overflow-x-auto">
                <strong className="text-red-400 block mb-1">Pairing Failed:</strong> {error}
              </div>
              
              <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl text-[10px] text-left">
                <strong className="text-primary block mb-1 uppercase tracking-widest font-bold">Troubleshoot:</strong>
                <p className="text-[#a1a19a] leading-relaxed">
                  {getDiagnosticTip(error)}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center w-full gap-6">
            <button 
              onClick={onCancel}
              className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-[#7a7a6a] hover:text-white transition-colors flex items-center gap-2"
            >
              <X size={14} /> Close & Cancel
            </button>

            {/* Advanced Identity Override (Manual Sync) */}
            <div className="w-full pt-6 border-t border-white/5">
              <button 
                onClick={() => setShowAdvanced?.(!showAdvanced)}
                className="text-[10px] text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest flex items-center gap-2 w-full justify-center"
              >
                {showAdvanced ? '[-] Hide Advanced' : '[+] Custom Identity (Manual)'}
              </button>
              
              {showAdvanced && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-[9px] text-[#7a7a6a] mb-2 text-center italic">
                    Specify a specific Client ID for custom gateway whitelists.
                  </p>
                  <input 
                    type="text"
                    placeholder="e.g. openclaw-axle-official"
                    className="w-full bg-[#1a1a17] border border-[#2a2a24] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/10 focus:outline-none focus:border-primary/50 transition-all font-mono"
                    value={customClientId}
                    onChange={(e) => setCustomClientId?.(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
