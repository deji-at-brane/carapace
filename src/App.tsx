import { useState, useEffect, useRef } from "react";
import { 
  LayoutGrid, 
  Settings, 
  Search, 
  MessageSquare,
  ShieldCheck,
  Zap,
  Activity,
  BookOpen
} from "lucide-react";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { DiscoveryGrid } from "@/components/DiscoveryGrid";
import { AgentSidebarList } from "@/components/AgentSidebarList";
import { Agent } from "@/lib/types";
import { ToolDrawer } from "@/components/ToolDrawer";
import { PairingOverlay, PairingStep } from "@/components/PairingOverlay";
import { TerminalCanvas, TerminalHandle } from "@/components/TerminalCanvas";
import { SettingsPane } from "@/components/SettingsPane";
import { MCPClient, createTransport, MCPTool, parseAgentUri, LogEntry, ClawPairingManager } from "@/lib/mcp";
import { A2AManager, AgentCard } from "@/lib/a2a";
import { CarapaceDB } from "@/lib/db";
import { cn } from "@/lib/utils";
import "./App.css";

const INITIAL_PAIRING_STEPS: PairingStep[] = [
  { id: "handshake", label: "Protocol Negotiation", status: "waiting" },
  { id: "approval", label: "Host Approval", status: "waiting" },
  { id: "finalize", label: "Credential Sync", status: "waiting" }
];

function App() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [currentClient, setCurrentClient] = useState<MCPClient | null>(null);
  const [pairingSteps, setPairingSteps] = useState<PairingStep[]>(INITIAL_PAIRING_STEPS);
  const [pairingTask, setPairingTask] = useState<{ active: boolean; error: string | null } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<AgentCard | null>(null);
  const [customClientId, setCustomClientId] = useState<string>('');
  const [a2aMessage, setA2AMessage] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentPulse, setCurrentPulse] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'activity' | 'security' | 'session' | 'guidance' | undefined>(undefined);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const terminalRef = useRef<TerminalHandle>(null);
  const discoveryLock = useRef(false);
  const isRestored = useRef(false);

  // 🏛️ PERSISTENCE: Restore previous session context on startup
  useEffect(() => {
    if (isRestored.current) return;
    
    const restoreSession = async () => {
      try {
        const db = await CarapaceDB.getInstance();
        const lastSession = await db.getLastSession();
        
        if (lastSession) {
          const agent = await db.getAgentByUri(lastSession.agent_uri);
          if (agent) {
             console.log(`[PERSISTENCE] Resuming context for ${agent.name}...`);
             setSelectedAgent(agent);
             setCurrentSessionId(lastSession.id);
             
             const messages = await db.getMessages(lastSession.id);
             const restoredLogs: LogEntry[] = messages.map(m => ({
               id: m.id,
               type: m.role as any,
               text: m.content,
               timestamp: m.timestamp,
               raw: m.metadata ? JSON.parse(m.metadata) : undefined
             }));
             
             setLogs(restoredLogs);
             
             // Wait for terminal layout to stabilize
             setTimeout(() => {
               if (terminalRef.current) {
                 terminalRef.current.clear();
                 terminalRef.current.writeln(`\x1b[90m[PERSISTENCE] Restored session context: ${agent.name}\x1b[0m`);
                 
                 // Show historical Elite messages
                 restoredLogs.forEach(entry => {
                   const isElite = 
                     entry.type === 'message' || 
                     entry.type === 'success' || 
                     entry.type === 'error' ||
                     entry.text.includes("[SUCCESS]") ||
                     entry.text.includes("Handshake complete");
                   
                   if (isElite) {
                     terminalRef.current?.writeln(entry.text);
                   }
                 });
                 
                 terminalRef.current.writeln(`\r\n\x1b[1;33m[OFFLINE]\x1b[0m History reloaded. Click \x1b[1;32mConnect\x1b[0m to initiate new pairing.`);
               }
             }, 300);
          }
        }
        isRestored.current = true;
      } catch (e) {
        console.warn("[App] Restoration failed:", e);
      }
    };
    
    restoreSession();
  }, []);

  const addLog = async (entry: LogEntry, forceShowInTerminal = false) => {
     // ELITE FILTER: Only write high-value messages to the terminal
     const isElite = 
       forceShowInTerminal ||
       entry.type === 'message' || 
       entry.type === 'success' || 
       entry.type === 'error' ||
       entry.text.includes("[SUCCESS]") ||
       entry.text.includes("[A2A SHADOW PIVOT]") ||
       entry.text.includes("Handshake complete") ||
       entry.text.includes("Discovered:");

     if (isElite) {
       terminalRef.current?.writeln(entry.text);
     }
     
     // Always preserve everything for the forensic Activity Log (in Settings)
     setLogs(prev => [...prev, entry]);

     // 💾 PERSISTENCE: Save message to DB if session is active
     if (currentSessionId) {
       try {
         const db = await CarapaceDB.getInstance();
         await db.addMessage(currentSessionId, entry.type, entry.text, entry.raw);
       } catch (e) {
         console.warn("[DB] Failed to persist log entry:", e);
       }
     }
  };

  const handleConnect = async (agent: Agent) => {
    // 🩺 Diagnostic Trace: Track the selection event
    console.trace(`[UI] Selecting Node: ${agent.name} (${agent.id}) -> ${agent.uri}`);

    // ☢️ Force Disconnect: Shut down any active client before switching
    if (currentClient) {
      console.log(`[UI] Disconnecting active session for ${selectedAgent?.name}...`);
      // Most transport/clients use a private close, we at least null it out
      setCurrentClient(null);
    }

    // 🧹 Total Wipe: Ensure no leakage between sessions
    setPairingTask(null);
    setAvailableTools([]);
    setLogs([]);
    setActiveCard(null);
    setConnectionError(null);
    setCurrentPulse(null);
    setIsConnecting(true); // 🛡️ PREVENT FLICKER: Suppress modals until discovery is complete
    setSelectedAgent(agent);
    
    // Wait for terminal mount
    setTimeout(async () => {
      if (!terminalRef.current) return;
      
      terminalRef.current.clear();
      terminalRef.current.writeln(`\x1b[1;36m[CONNECTING]\x1b[0m Establishing federated A2A channel to ${agent.name}...`);
      terminalRef.current.writeln(`\x1b[90mTARGET URI: ${agent.uri}\x1b[0m\r\n`);
      setConnectionError(null);

      // Check if we already have a pairing for this host
      const db = await CarapaceDB.getInstance();
      const parsed = parseAgentUri(agent.uri);
      const hostKey = parsed?.normalizedHost || agent.uri;
      
      // Load most recent session for this agent to restore logs
      const sessions = await db.select<any[]>("SELECT id FROM sessions WHERE agent_uri = ? ORDER BY created_at DESC LIMIT 1", [agent.uri]);
      if (sessions.length > 0) {
        const lastSessionId = sessions[0].id;
        setCurrentSessionId(lastSessionId);
        const historicalMessages = await db.getMessages(lastSessionId);
        const mappedLogs: LogEntry[] = historicalMessages.map(m => ({
          id: m.id,
          type: m.role as any,
          text: m.content,
          timestamp: m.timestamp,
          raw: m.metadata ? JSON.parse(m.metadata) : undefined
        }));
        setLogs(mappedLogs);
        terminalRef.current?.writeln(`\x1b[90m[HISTORY] Restored ${mappedLogs.length} events from session ${lastSessionId.substring(0,8)}...\x1b[0m`);
      } else {
        setLogs([]);
        setCurrentSessionId(null);
      }

      // Fuzzy search: Match by hostname/IP even if protocol or port varies
      const savedCreds = await db.select<any[]>("SELECT secret_blob FROM credentials WHERE agent_host LIKE ?", [`%${hostKey}%`]);
      let savedToken = savedCreds.length > 0 ? savedCreds[0].secret_blob : null;

      console.log(`[AUTH] Vault Search for ${hostKey}:`, savedToken ? "FOUND" : "NOT FOUND");
      terminalRef.current?.writeln(`\x1b[90m[AUTH] Identity: ${hostKey} [Vault: ${savedToken ? 'OK' : 'EMPTY'}]\x1b[0m`);

      // 🌐 NEW: Google A2A Discovery Step
      terminalRef.current?.writeln(`\x1b[90m[A2A] Probing for Agent Card...\x1b[0m`);
      const card = await A2AManager.discover(agent.uri);
      
      if (card) {
        setActiveCard(card);
        addLog({
           text: `\x1b[1;32m[A2A] Discovered: ${card.name} (v${card.version})\x1b[0m`,
           type: 'success',
           id: crypto.randomUUID(),
           timestamp: new Date().toISOString()
        });
      }

      // Automation: If already paired OR we have an A2A token in the URI, connect immediately
      const uriToken = parsed?.token || null;
      const isAlreadyPaired = !!savedToken || !!uriToken;

      if (isAlreadyPaired) {
        console.log(`[AUTO] Using ${uriToken ? 'URI token' : 'vault credentials'} for ${hostKey}`);
        const sessionMsg = card ? `[A2A] Synchronizing federated session to ${card.name}...` : `[SESSION] Restoring trusted connection to ${agent.name}...`;
        terminalRef.current?.writeln(`\x1b[32m${sessionMsg}\x1b[0m`);
        setIsConnecting(true);
      } else if (card) {
        // A2A First Contact: We found a card but no token. Show A2A Auth prompt.
        terminalRef.current?.writeln(`\x1b[1;33m[A2A] Authentication Required.\x1b[0m Please provide a Bearer token for ${card.name}.`);
        setIsConnecting(false);
        return; // UI will handle the rest
      } else {
        // Legacy OpenClaw v3 Flow: Start the unified pairing process
        startClawPairing(agent.uri, agent);
        return;
      }

      try {
        // Priority 1: Use token from the URI (One-Click Pairing)
        const uriToken = parsed?.token || null;
        
        // Priority 2: Use token from the Database (Saved Session)
        const credentials = await db.select<any[]>("SELECT secret_blob FROM credentials WHERE agent_host = ?", [hostKey]);
        const dbToken = credentials[0]?.secret_blob || null;
        
        savedToken = uriToken || dbToken;
        console.log(`[AUTH] Protocol state for ${hostKey}:`, 
          uriToken ? "TOKEN FROM URI" : dbToken ? "TOKEN FROM VAULT" : "NO TOKEN FOUND"
        );

        // 🎯 Endpoint Sync: Prioritize the A2A endpoint from the Agent Card if available
        const connectionTarget = card?.endpoints?.a2a || agent.uri;
        console.log(`[A2A] Initializing transport to target: ${connectionTarget}`);
        
        const transport = createTransport(connectionTarget, savedToken || undefined, {
          streamUrl: card?.endpoints?.sse
        }); 
        const client = new MCPClient(
          transport,
          (entry) => addLog(entry),
          savedToken || undefined,
          card // Pass the full card for capability sensing
        );

        // Bridge the signal pulse to the forensic activity log only
        client.onHandshakePulse = (msg) => {
          addLog({
            text: `\x1b[36m[PULSE]\x1b[0m ${msg}`,
            id: crypto.randomUUID(),
            type: 'info',
            timestamp: new Date().toISOString()
          });
        };

        await client.initialize();
        setCurrentClient(client);
        setIsConnecting(false);
        
        // AUTO-SAVE: If this token was from the URI, save it for next time
        if (uriToken && !dbToken) {
          console.log(`[AUTH] Auto-saving new token to vault for ${hostKey}`);
          await db.saveCredential(hostKey, uriToken);
        }

        const tools = await client.listTools();
        setAvailableTools(tools);
        
        terminalRef.current.writeln(`\x1b[90m[DISCOVERY]\x1b[0m Identified \x1b[1m${tools.length}\x1b[0m autonomous tools.`);
        
        const sessionId = await db.createSession(agent.name, agent.uri);
        setCurrentSessionId(sessionId);
        
        terminalRef.current.writeln(`\r\n\x1b[1;32m[SUCCESS]\x1b[0m Handshake complete. Session active.`);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Handshake timed out or failed.";
        setConnectionError(errorMsg);
        
        const isPairingId = errorMsg.startsWith("PAIRING_REQUIRED:");

        // AUTO-INVALIDATION: If the token is dead, purge it so the user can re-pair easily
        if (errorMsg.toLowerCase().includes("expired") || errorMsg.toLowerCase().includes("unauthorized") || errorMsg.toLowerCase().includes("invalid token")) {
          terminalRef.current?.writeln(`\r\n\x1b[1;33m[CLEANUP]\x1b[0m Expired token detected. Removing from local vault...`);
          await db.deleteCredential(agent.uri);
          
          if (selectedAgent && selectedAgent.id === agent.id) {
            setSelectedAgent({ ...agent, is_paired: 0 } as any);
          }
        }
        
        // We set isConnecting to false only after a delay so the user can see the red error bar
        // BUT: If it's a PAIRING_REQUIRED ID, we keep it active indefinitely so the user can provide the ID to Alex.
        if (!isPairingId) {
          setTimeout(() => {
            setIsConnecting(false);
          }, 5000);
        }

        terminalRef.current?.writeln(`\r\n\x1b[1;31m[ERROR]\x1b[0m ${errorMsg}`);
        
        if (isPairingId) {
           terminalRef.current?.writeln(`\x1b[1;33m[ACTION REQUIRED]\x1b[0m Gateway requires manual approval.`);
           terminalRef.current?.writeln(`\x1b[1;36mGive this ID to Alex:\x1b[0m ${errorMsg.split(':')[1]}`);
        } else if (errorMsg.includes("No session token found") || !savedToken) {
           terminalRef.current?.writeln(`\x1b[1;33m[ACTION REQUIRED]\x1b[0m This agent requires a valid authentication token.`);
           terminalRef.current?.writeln(`\x1b[90mSuggestion: Paste the full claw://... URI (with ?token=) into the search bar to re-pair.\x1b[0m`);
        } else {
           terminalRef.current?.writeln(`\x1b[90m[DIAGNOSTIC] Protocol version mismatch or gateway timeout.\x1b[0m`);
        }
        terminalRef.current?.write("\r\n\x1b[1;35m$\x1b[0m ");
      }
    }, 100);
  };

  const handleDirectConnect = () => {
    if (!searchTerm.trim()) return;
    
    // Handle Base64 Setup Code (v3)
    if (searchTerm.startsWith("ey")) {
      try {
        const decoded = JSON.parse(atob(searchTerm.trim()));
        if (decoded.url && decoded.bootstrapToken) {
          const fakeUri = `claw://${decoded.url.replace(/^wss?:\/\//, '')}?token=${decoded.bootstrapToken}`;
          startClawPairing(fakeUri);
          setSearchTerm("");
          return;
        }
      } catch (e) {
        console.warn("Input looks like Base64 but failed to decode as OpenClaw Setup Code:", e);
      }
    }

    if (searchTerm.startsWith("claw://")) {
      startClawPairing(searchTerm.trim());
      setSearchTerm("");
      return;
    }

    if (searchTerm.includes("://") || searchTerm.startsWith("http")) {
      handleConnect({
        id: "direct-node",
        name: "Remote Node",
        description: "Direct connection via URI override.",
        uri: searchTerm.trim(),
        category: "Production",
        icon_name: "Activity"
      });
      setSearchTerm("");
    }
  };

  const startClawPairing = async (uri: string, existingAgent?: Agent) => {
    if (discoveryLock.current) {
      console.warn("[AUTH] Discovery already in progress. Ignoring duplicate trigger.");
      return;
    }

    let targetUri = uri.trim();
    
    // AUTO-DECODE: Handle raw Base64 Setup Codes (starting with {)
    if (targetUri.startsWith("eyJ")) {
      try {
        const decoded = JSON.parse(atob(targetUri));
        if (decoded.url && decoded.bootstrapToken) {
          targetUri = `claw://${decoded.url.replace(/^wss?:\/\//, "")}?token=${decoded.bootstrapToken}`;
          console.log("[AUTH] Decoded Base64 Setup Code to:", targetUri);
        }
      } catch (e) {
        console.warn("[AUTH] Input looks like Base64 but failed to decode:", e);
      }
    }

    const parsed = parseAgentUri(targetUri);
    if (!parsed || !parsed.token) {
      terminalRef.current?.writeln(`\r\n\x1b[1;31m[ERROR]\x1b[0m Cannot initiate pairing: No setup token found in URI.`);
      terminalRef.current?.writeln(`Suggestion: Paste a fresh claw://... URI (e.g. from Alex) that includes the ?token= parameter.`);
      return;
    }

    setPairingTask({ active: true, error: null });
    setPairingSteps(INITIAL_PAIRING_STEPS.map((s, i) => i === 0 ? { ...s, status: "active" } : s));

    try {
      // Hook into the Discovery Loop to show real-time progress
      (ClawPairingManager as any).setHandshakePulse((msg: string) => {
        terminalRef.current?.writeln(`\x1b[90m${msg}\x1b[0m`);
        setCurrentPulse(msg);
        
        // FATAL INTERRUPT: If mcp.ts reports a stop, we update the UI modal immediately
        if (msg.includes("[STOP] Fatal")) {
           setPairingTask({ active: true, error: msg.split('] ')[1] });
           setIsConnecting(false);
        }

        // Dynamic step advancement based on logs
        if (msg.includes("[SUCCESS]")) {
           setPairingSteps(prev => prev.map(s => s.id === "handshake" ? { ...s, status: "complete" } : s.id === "approval" ? { ...s, status: "active" } : s));
        } else if (msg.includes("[AUTH] Identity proof submitted")) {
           setPairingSteps(prev => prev.map(s => s.id === "approval" ? { ...s, status: "complete" } : s.id === "finalize" ? { ...s, status: "active" } : s));
        }
      });

      terminalRef.current?.writeln(`\x1b[90m[HANDSHAKE] PROBE TARGET: ${parsed.host}\x1b[0m`);
      discoveryLock.current = true;
      const result = await ClawPairingManager.initiate(parsed.host, parsed.token, (customClientId || "") as string);
      
      const data = typeof result === 'string' ? JSON.parse(result) : result;
      const { statusUrl, api_token, gatewayUrl, requestId } = data;
      const successData = data.result || {};
      const agentName = successData.agentName || "OpenClaw Agent";

      if (statusUrl === "manual_approval" && requestId) {
         terminalRef.current?.writeln(`\x1b[1;33m[WAITING]\x1b[0m Discovery Succeeded. Gateway is awaiting Manual Approval.`);
         terminalRef.current?.writeln(`\x1b[90mOperator (Alex) must approve Request ID: ${requestId}\x1b[0m`);
         
         // Auto-Register the agent in the sidebar even during pending approval
         const db = await CarapaceDB.getInstance();
         await db.upsertAgent({
           id: existingAgent?.id || crypto.randomUUID(),
           name: agentName || existingAgent?.name || "OpenClaw Agent",
           description: existingAgent?.description || `Awaiting approval at ${parsed.host}`,
           uri: uri,
           category: "Production",
           icon_name: "Timer"
         });

         setPairingTask({ 
            active: true, 
            error: `PENDING: Handshake sequence accepted.\n\nOperator identity (Alex) has approved this device's Request ID: (${requestId}).\n\nFINAL STEP: Please PASTE THE SETUP CODE ONE MORE TIME into the search bar to finalize the session and receive your persistent token!`
         });
         return;
      }

      if (api_token || successData.token) {
        terminalRef.current?.writeln(`\x1b[1;32m[SUCCESS]\x1b[0m Protocol established. Handshake confirmed.`);
        const final_token = api_token || successData.token;
        const normalized_gateway = parsed.normalizedHost || gatewayUrl || parsed.host;

        setPairingSteps(prev => prev.map(s => s.id === "approval" ? { ...s, status: "complete" } : s.id === "finalize" ? { ...s, status: "active" } : s));
        const db = await CarapaceDB.getInstance();
        await db.saveCredential(normalized_gateway, final_token);
        terminalRef.current?.writeln(`\x1b[90m[AUTH] Credentials bonded for: ${normalized_gateway}\x1b[0m`);
        
        // Auto-Register the new agent in the sidebar
        const newAgent = {
          id: existingAgent?.id || crypto.randomUUID(),
          name: agentName || existingAgent?.name || "OpenClaw Agent",
          description: existingAgent?.description || `Paired session at ${normalized_gateway}`,
          uri: existingAgent?.uri || uri, 
          category: existingAgent?.category || "Production",
          icon_name: existingAgent?.icon_name || "ShieldCheck"
        };
        await db.upsertAgent(newAgent);

        setPairingSteps(prev => prev.map(s => ({ ...s, status: "complete" })));
        setTimeout(() => {
          setPairingTask(null);
          // Auto-Connect now that we are paired (use newAgent if existing was null)
          handleConnect(newAgent as Agent);
        }, 1500);
        return;
      }

      let attempts = 0;
      const checkAndPoll = async () => {
        if (!statusUrl) throw new Error("No status URL provided by gateway.");
        if (attempts > 60) throw new Error("Pairing timed out after 3 minutes. Please check your agent's logs.");
        attempts++;
        
        const pollResult = await ClawPairingManager.pollStatus(statusUrl);
        if (pollResult.status === "APPROVED" && pollResult.api_token) {
          setPairingSteps(prev => prev.map(s => s.id === "approval" ? { ...s, status: "complete" } : s.id === "finalize" ? { ...s, status: "active" } : s));
          
          const db = await CarapaceDB.getInstance();
          await db.saveCredential(gatewayUrl || parsed.host, pollResult.api_token);
          
          await db.upsertAgent({
            id: existingAgent?.id || crypto.randomUUID(),
            name: agentName || existingAgent?.name || "OpenClaw Agent",
            description: existingAgent?.description || `Paired session at ${gatewayUrl || parsed.host}`,
            uri: existingAgent?.uri || uri,
            category: existingAgent?.category || "Production",
            icon_name: existingAgent?.icon_name || "ShieldCheck"
          });

          setPairingSteps(prev => prev.map(s => ({ ...s, status: "complete" })));
          setTimeout(() => {
            setPairingTask(null);
            // Auto-Connect now that we are paired
            if (existingAgent) handleConnect(existingAgent);
          }, 1500);
        } else {
          setTimeout(checkAndPoll, 3000);
        }
      };

      await checkAndPoll();
    } catch (error: any) {
      setPairingTask({ active: true, error: error.message });
      setIsConnecting(false);
    } finally {
      discoveryLock.current = false;
      // SILENCE: Kill the listener so ghost logs don't vibrate the UI
      (ClawPairingManager as any).setHandshakePulse(() => {});
    }
  };

  const handleInvokeTool = async (tool: MCPTool) => {
    if (!terminalRef.current || !currentClient) return;

    terminalRef.current.writeln(`\r\n\x1b[1;36m[INVOKE]\x1b[0m \x1b[1m${tool.name}\x1b[0m ...`);
    
    try {
      const result = await currentClient.callTool(tool.name, {});
      terminalRef.current.writeln(`\x1b[1;32m[RESULT]\x1b[0m Execution complete.`);
      
      result.content.forEach((c: any) => {
        if (c.text) terminalRef.current?.writeln(c.text);
      });
      terminalRef.current.write("\r\n\x1b[1;35m$\x1b[0m ");
    } catch (e: any) {
      terminalRef.current?.writeln(`\x1b[31m[ERROR] Handshake Failed: ${e.message || e}\x1b[0m`);
      terminalRef.current?.writeln(`\x1b[33m[ACTION REQUIRED] This agent requires a valid authentication token.\x1b[0m`);
      terminalRef.current?.writeln(`Suggestion: Paste the full claw://... URI (with ?token=) into the search bar to re-pair.`);
      setPairingTask(null);
      setCurrentClient(null);
    }
  };

  const handleCreateA2ATask = async () => {
    if (!currentClient || !activeCard) return;
    
    terminalRef.current?.writeln(`\r\n\x1b[1;36m[A2A ACTION]\x1b[0m Creating Federated Task...`);
    try {
      const task = await currentClient.createTask("Run 'whoami' and 'ls' to verify your current environment.");
      setLogs(prev => [...prev, {
        text: `\x1b[1;32m[A2A TASK CREATED]\x1b[0m ID: ${task.id}`,
        id: crypto.randomUUID(),
        type: 'task',
        timestamp: new Date().toISOString(),
        raw: task
      }]);
    } catch (e: any) {
      terminalRef.current?.writeln(`\x1b[31m[A2A ERROR]\x1b[0m Task creation failed: ${e.message || e}`);
    }
  };


  const handleSendA2AMessage = async (overrideText?: string) => {
    if (!currentClient || !activeCard) return;

    const messageToSend = overrideText || a2aMessage.trim() || "Hello from Carapace! This is an A2A federated signal.";
    terminalRef.current?.writeln(`\r\n\x1b[1;36m[A2A ACTION]\x1b[0m Sending Peer Message...`);
    try {
      await currentClient.sendMessage(messageToSend);
      setLogs(prev => [...prev, {
        text: `\x1b[1;32m[A2A MSG SENT]\x1b[0m Content: "${messageToSend.substring(0, 30)}${messageToSend.length > 30 ? '...' : ''}"`,
        id: crypto.randomUUID(),
        type: 'message',
        timestamp: new Date().toISOString()
      }]);
      setA2AMessage("");
    } catch (e: any) {
      terminalRef.current?.writeln(`\x1b[31m[A2A ERROR]\x1b[0m Message failed: ${e.message || e}`);
      if (e.message?.includes("Method not found") || e.code === -32601) {
        setConnectionError("Method not found: Protocol mismatch detected.");
      }
    }
  };

  // 🎯 UI-Tiered Ignition: Watch for new tasks and jumpstart them
  useEffect(() => {
    const lastLog = logs[logs.length - 1];
    if (lastLog?.type === 'task' && (lastLog.text.includes('delegating') || lastLog.text.includes('[A2A TASK CREATED]'))) {
      const taskId = (lastLog.raw as any)?.id || (lastLog.raw as any)?.taskId;
      const sessionId = (lastLog.raw as any)?.sessionId;
      
      if (taskId && currentClient) {
        console.log(`[UI IGNITION] Detected mission ${taskId}. Firing wake-up pulse...`);
        // Small delay to ensure the OS/Network is ready
        setTimeout(() => {
          currentClient.callTool("shell_execute", { command: "whoami" }, taskId, sessionId).catch(() => {});
        }, 2000);
      }
    }
  }, [logs, currentClient]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupDeepLink = async () => {
      try {
        await CarapaceDB.getInstance();
        console.log("[STORAGE] Database initialized. Local A2A Mocking enabled.");
      } catch (e) {
        console.warn("[STORAGE] DB Init failed:", e);
      }

      try {
        unlisten = await onOpenUrl((urls) => {
          console.log("Deep link received:", urls);
          const urlStr = Array.isArray(urls) ? urls[0] : urls;
          if (urlStr && typeof urlStr === 'string' && urlStr.includes("agent/")) {
            const rawTarget = urlStr.split("agent/")[1];
            if (rawTarget) {
              // Normalize deep link to standard a2a/claw URI
              const finalUri = rawTarget.includes("://") ? rawTarget : `a2a://${rawTarget}`;
              setSearchTerm(finalUri);
              // Small delay to ensure UI transitions before probing
              setTimeout(() => {
                handleConnect({
                  id: "deep-link-discovery",
                  name: "Deep Link Agent",
                  description: "Discovered via carapace:// protocol.",
                  uri: finalUri,
                  category: "Discovery",
                  icon_name: "Zap"
                });
              }, 500);
            }
          }
        });
      } catch (error) {
        console.error("Failed to initialize deep link listener:", error);
      }
    };

    setupDeepLink();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const [modalToken, setModalToken] = useState("");

  const handleClearLogs = async () => {
    if (!currentSessionId) {
      setLogs([]);
      return;
    }
    try {
      const db = await CarapaceDB.getInstance();
      await db.clearMessages(currentSessionId);
      setLogs([]);
    } catch (e) {
      console.warn("[DB] Failed to clear logs:", e);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0a09] text-[#e0e0d0] overflow-hidden font-sans antialiased selection:bg-primary/30">
      {/* Sidebar: Navigation */}
      <aside className="w-16 flex flex-col items-center py-6 border-r border-[#2a2a24]/50 bg-[#0f0f0d] z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        <div 
          onClick={() => setSelectedAgent(null)}
          className="p-3 mb-10 bg-primary/15 rounded-2xl text-primary border border-primary/25 shadow-[0_0_20px_rgba(var(--primary),0.1)] cursor-pointer hover:bg-primary/25 transition-all"
        >
          <LayoutGrid size={24} strokeWidth={2.5} />
        </div>
        
        <nav className="flex-1 flex flex-col gap-5">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-3.5 hover:bg-[#1a1a17] rounded-2xl transition-all duration-300 text-[#7a7a6a] hover:text-[#e0e0d0] group"
          >
            <Activity size={22} className="group-hover:scale-110 transition-transform" />
          </button>
        </nav>

        <div className="flex flex-col gap-5">
           <button 
            onClick={() => {
              setSettingsTab('guidance');
              setShowSettings(true);
            }}
            className="p-3.5 hover:bg-[#1a1a17] rounded-2xl transition-all duration-300 text-[#7a7a6a] hover:text-[#e0e0d0] group"
          >
            <BookOpen size={22} className="group-hover:scale-110 transition-transform" />
          </button>
          <button 
            onClick={() => {
              setSettingsTab(undefined);
              setShowSettings(!showSettings);
            }}
            className={cn(
               "p-3.5 rounded-2xl transition-all duration-300",
               showSettings ? "bg-primary text-white shadow-lg" : "hover:bg-[#1a1a17] text-[#7a7a6a] hover:text-[#e0e0d0]"
            )}
          >
            <Settings size={22} className={showSettings ? "animate-spin-slow" : ""} />
          </button>
        </div>
      </aside>

      {/* Agent Selection Sidebar (Telegram Style) */}
      <AgentSidebarList 
        searchTerm={searchTerm}
        selectedAgentId={selectedAgent?.id}
        onSelect={handleConnect}
        onDelete={(id) => {
          if (selectedAgent?.id === id) {
            setSelectedAgent(null);
            setCurrentClient(null);
            setAvailableTools([]);
          }
        }}
      />

      {/* Main Multi-Stage Hub */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a09] relative shadow-2xl">
        <header className="h-16 border-b border-[#2a2a24]/50 flex items-center px-6 justify-between bg-[#0f0f0d]/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex bg-[#1a1a17] rounded-xl p-1 shadow-inner">
              <button className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#2a2a24] text-white shadow-xl transition-all">
                {selectedAgent ? selectedAgent.name : "Discovery Hub"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Global Identity Proxy Toggle */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  "p-2 rounded-xl border transition-all duration-300 group relative",
                  showAdvanced ? "bg-primary/20 border-primary/40 text-primary shadow-[0_0_15px_rgba(var(--primary),0.2)]" : "bg-[#1a1a17] border-[#2a2a24] text-[#4a4a40] hover:text-[#7a7a6a]"
                )}
                title="Proxy Identity Override"
              >
                <ShieldCheck size={18} />
                {customClientId && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-[#0f0f0d] shadow-sm animate-pulse"></div>}
              </button>

              {showAdvanced && (
                <div className="w-48 animate-in slide-in-from-right-4 fade-in duration-500">
                  <input 
                    type="text" 
                    placeholder="Client ID Mask..." 
                    value={customClientId}
                    onChange={(e) => setCustomClientId(e.target.value)}
                    className="w-full bg-[#1a1a17] border border-primary/20 rounded-xl px-3 py-1.5 text-[10px] text-white placeholder:text-white/10 outline-none focus:border-primary font-mono transition-all"
                  />
                </div>
              )}
            </div>

            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a6a] group-focus-within:text-primary transition-colors" size={16} />
              <input 
                placeholder="Search or agent:// ..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDirectConnect()}
                className="bg-[#1a1a17] border border-[#2a2a24] rounded-xl pl-10 pr-4 py-2 text-sm w-72 focus:w-80 transition-all duration-500 focus:bg-black focus:ring-1 focus:ring-primary/50 outline-none text-[#e0e0d0] placeholder-[#4a4a40]"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex relative">
          {pairingTask?.active && (
            <PairingOverlay 
              steps={pairingSteps} 
              onCancel={() => setPairingTask(null)} 
              error={pairingTask.error}
              statusMessage={currentPulse}
              customClientId={customClientId}
              setCustomClientId={setCustomClientId}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
            />
          )}

          {!selectedAgent ? (
            <DiscoveryGrid 
              searchTerm={searchTerm} 
              onConnect={handleConnect} 
            />
          ) : (
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div className="terminal-header">
                <div className="agent-info">
                  <span className="agent-name">{selectedAgent.name}</span>
                  <span className={`status-dot ${currentClient ? 'online' : 'offline'}`}></span>
                </div>
                <div className="terminal-actions">
                  {/* Action buttons could go here */}
                </div>
              </div>
              
                {/* PAIRING BANNER */}
                {selectedAgent && !currentClient && (isConnecting || connectionError?.startsWith("PAIRING_REQUIRED:")) && (
                  <div className={cn(
                    "absolute inset-x-0 top-0 z-10 p-2 flex items-center justify-center gap-3 border-b transition-colors duration-500",
                    connectionError?.startsWith("PAIRING_REQUIRED:")
                      ? "bg-orange-900/60 border-orange-500/50"
                      : "bg-blue-900/40 border-blue-500/50"
                  )}>
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      connectionError?.startsWith("PAIRING_REQUIRED:") ? "bg-orange-500 animate-pulse" : "bg-blue-500 animate-pulse"
                    )} />
                    <span className={cn(
                      "text-xs font-mono uppercase tracking-widest",
                      connectionError?.startsWith("PAIRING_REQUIRED:") ? "text-orange-300" : "text-blue-400"
                    )}>
                      {connectionError?.startsWith("PAIRING_REQUIRED:") 
                        ? `APPROVAL PENDING: GIVE ID [ ${connectionError.split(':')[1]} ] TO ALEX`
                          : "Verifying Identity & Synchronizing Protocol..."
                      }
                    </span>
                  </div>
                )}

                {selectedAgent && !currentClient && !isConnecting && !pairingTask?.active && !connectionError?.startsWith("PAIRING_REQUIRED:") && (
                  <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-[#1a1a1a] border border-orange-900/30 rounded-lg p-6 shadow-2xl animate-in fade-in zoom-in duration-300">
                      <div className="flex items-center gap-4 mb-4">
                        <div className={cn("p-3 rounded-full", activeCard ? "bg-primary/20" : "bg-orange-900/20")}>
                          {activeCard ? <Zap className="w-8 h-8 text-primary" /> : <ShieldCheck className="w-8 h-8 text-orange-500" />}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{activeCard ? "Federated Authentication" : "Authentication Required"}</h2>
                          <p className="text-gray-400 text-sm">
                            {activeCard 
                              ? `Enter a Bearer token to synchronize with ${activeCard.name}.` 
                              : `To establish a secure channel to ${selectedAgent.name}, you must first pair your terminal.`}
                          </p>
                        </div>
                      </div>
                      
                      {((selectedAgent as any).is_paired > 0 || (selectedAgent as any).is_known) && !activeCard ? (
                        <div className="space-y-4">
                          <button 
                            onClick={() => handleConnect(selectedAgent)}
                            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-md transition-all shadow-lg flex items-center justify-center gap-2"
                          >
                            <Zap className="w-5 h-5" />
                            Connect Trusted Session
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-black/40 p-3 rounded-md border border-white/5">
                            <label className="text-[10px] uppercase font-bold text-gray-500 mb-2 block">
                              {activeCard ? "Bearer Token / Service Key" : "Paste Setup Code / URI"}
                            </label>
                            <input 
                              type="text"
                              value={modalToken}
                              onChange={(e) => {
                                setModalToken(e.target.value);
                                if (connectionError) setConnectionError(null);
                              }}
                              placeholder={activeCard ? "Enter A2A token..." : "claw://127.0.0.1:18889?token=..."}
                              className="w-full bg-[#0a0a09] border border-[#2a2a24] rounded px-3 py-2 text-xs font-mono focus:border-primary/50 outline-none transition-colors"
                            />
                          </div>
                          <button 
                            onClick={async () => {
                              const target = modalToken.trim() || selectedAgent.uri;
                              if (activeCard) {
                                // A2A Direct Auth flow: Save token and connect
                                const db = await CarapaceDB.getInstance();
                                const parsed = parseAgentUri(selectedAgent.uri);
                                const hostKey = parsed?.normalizedHost || selectedAgent.uri;
                                await db.saveCredential(hostKey, modalToken.trim());
                                handleConnect(selectedAgent);
                              } else {
                                startClawPairing(target, selectedAgent);
                              }
                              setModalToken("");
                            }}
                            className={cn(
                              "w-full text-white font-bold py-3 rounded-md transition-all shadow-lg flex items-center justify-center gap-2",
                              activeCard ? "bg-primary hover:bg-primary/80" : "bg-orange-600 hover:bg-orange-500"
                            )}
                          >
                            <Zap className="w-5 h-5" />
                            {activeCard ? "Synchronize Agent" : "Pair New Agent"}
                          </button>
                          <p className="text-[10px] text-center text-gray-600">
                            {activeCard 
                              ? "A2A uses standard bearer authentication for federation." 
                              : "You can get this code from Alex by asking for a 'Setup Code'."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              <div className="terminal-container flex-1 overflow-hidden relative flex flex-col bg-black">
                {/* 
                   THE UNIVERSAL TERMINAL
                   Always visible as the primary human-agent boundary
                */}
                <TerminalCanvas ref={terminalRef} />
                
                {activeCard && currentClient && (
                  <div className="h-14 border-t border-[#2a2a24]/50 bg-black/60 flex items-center px-6 gap-4 z-10">
                    <div className="flex-1 flex bg-white/5 border border-white/10 rounded-lg px-4 py-2 items-center gap-3 group focus-within:border-primary/40 transition-all">
                      <MessageSquare size={16} className="text-gray-500 group-focus-within:text-primary transition-colors" />
                      <input 
                        type="text"
                        value={a2aMessage}
                        onChange={(e) => setA2AMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendA2AMessage()}
                        placeholder="Enter federated message or command..."
                        className="bg-transparent border-none outline-none text-xs flex-1 font-mono text-gray-200 placeholder:text-gray-600 transition-all"
                      />
                      <button 
                         onClick={() => handleSendA2AMessage()}
                         disabled={!a2aMessage.trim()}
                         className="bg-primary/20 hover:bg-primary/30 text-primary text-[10px] uppercase font-bold px-4 py-1.5 rounded-md border border-primary/30 transition-all disabled:opacity-30"
                      >
                         Send Signal
                      </button>
                    </div>

                    <button 
                       onClick={handleCreateA2ATask}
                       className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-[10px] font-bold px-4 py-2 rounded-md border border-blue-500/30 transition-all flex items-center gap-1.5"
                    >
                       <Zap size={14} /> CREATE TASK
                    </button>
                  </div>
                )}
              </div>
              
              <aside className="w-full border-t border-[#2a2a24]/50 bg-[#0f0f0d]/50 h-48 flex-shrink-0 relative">
                 <ToolDrawer 
                  tools={availableTools} 
                  onInvoke={handleInvokeTool} 
                  isConnected={currentClient !== null} 
                />
              </aside>
            </div>
          )}
        </div>

        <footer className="h-12 border-t border-[#2a2a24]/50 bg-[#0f0f0d]/90 backdrop-blur-md flex items-center px-6 justify-between text-[10px] font-bold font-mono text-[#4a4a40] z-20">
          <div className="flex gap-6">
            <span className="flex items-center gap-2">
              <span className={cn("h-1.5 w-1.5 rounded-full shadow-[0_0_10px_rgba(var(--primary),1)]", currentClient ? "bg-primary animate-pulse" : "bg-[#2a2a24]")}></span> 
              STATUS: {currentClient ? (activeCard ? "A2A FEDERATED" : "ENCRYPTED") : "LISTENING"}
            </span>
            {selectedAgent && <span className="opacity-40 uppercase truncate max-w-40">TARGET: {selectedAgent.uri}</span>}
          </div>
          <div className="flex gap-6">
            <span className="hover:text-[#7a7a6a] cursor-default transition-colors uppercase">Network: v0.1.0-alpha</span>
          </div>
        </footer>
      </main>

      {/* SYSTEM FORENSICS OVERLAY */}
      <SettingsPane 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        logs={logs}
        onClearLogs={handleClearLogs}
        initialTab={settingsTab}
      />
    </div>
  );
}

export default App;
