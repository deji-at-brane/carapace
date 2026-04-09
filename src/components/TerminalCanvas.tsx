import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export interface TerminalHandle {
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
}

/**
 * TerminalCanvas (Raw XTerm Implementation)
 * Optimized for React 19 and Tauri v2.
 */
export const TerminalCanvas = forwardRef<TerminalHandle>((_, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useImperativeHandle(ref, () => ({
    write: (data: string) => xtermRef.current?.write(data),
    writeln: (data: string) => xtermRef.current?.writeln(data),
    clear: () => xtermRef.current?.clear(),
  }));

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js instance
    const xterm = new Terminal({
      cursorBlink: false,
      theme: {
        background: "#000000", // Total black
        foreground: "#d1d1d1", // Soft white
        selectionBackground: "#44475a",
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 12,
      letterSpacing: 0.5,
      lineHeight: 1.2,
      scrollback: 1000,
    });

    // Initialize Fit Addon
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    // Open terminal in the container
    xterm.open(terminalRef.current);
    fitAddon.fit();

    // Store references
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Welcome message (Clean Log Format)
    xterm.writeln("\x1b[1;32mCARAPACE PROTOCOL ENGINE v0.1.0-alpha\x1b[0m");
    xterm.writeln("\x1b[90m--------------------------------------------------\x1b[0m");
    xterm.writeln("\x1b[36mSTATUS:\x1b[0m Ready for agentic session...");
    xterm.writeln("");

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      xterm.dispose();
      resizeObserver.disconnect();
    };
  }, []);



  return (
    <div 
      ref={terminalRef} 
      className="w-full h-full bg-black rounded-lg overflow-hidden border border-[#2a2a24]/30 shadow-2xl"
      style={{ minHeight: "100px" }}
    />
  );
});
