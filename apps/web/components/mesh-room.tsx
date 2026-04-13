"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_NODE_URL ?? "http://69.62.114.97:4100";

interface Dot {
  id: string;
  content: string;
  author: string;
  type: string;
  channel: string;
  createdAt: string;
  timestamp?: string;
  prev_hash?: string | null;
  index?: number;
}

interface NodeHealth {
  nodeId: string;
  peers: number;
  dots: number;
  iroh: string;
  status: string;
}

function truncateId(id: string, len = 12) {
  return id ? `${id.slice(0, len)}…` : "—";
}

function getTime(dot: Dot) {
  const iso = dot.createdAt || dot.timestamp || "";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--";
  }
}

export function MeshRoom() {
  const [dots, setDots] = useState<Dot[]>([]);
  const [health, setHealth] = useState<NodeHealth | null>(null);
  const [input, setInput] = useState("");
  const [author, setAuthor] = useState("anon");
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [booted, setBooted] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Boot sequence
  useEffect(() => {
    const lines = [
      "PIED PIPER PROTOCOL v0.1",
      "initializing iroh p2p node...",
      "connecting to mesh...",
      "loading DOT chain...",
    ];
    let i = 0;
    const id = setInterval(() => {
      if (i < lines.length) {
        setBootLines((prev) => [...prev, lines[i]]);
        i++;
      } else {
        clearInterval(id);
        setTimeout(() => setBooted(true), 400);
      }
    }, 280);
    return () => clearInterval(id);
  }, []);

  // Load author from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("pp-author");
    if (saved) setAuthor(saved);
  }, []);

  const saveAuthor = (v: string) => {
    setAuthor(v);
    localStorage.setItem("pp-author", v);
  };

  // Fetch health
  const fetchHealth = useCallback(async () => {
    try {
      const r = await fetch(`${API}/health`);
      const data = await r.json();
      setHealth(data);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  // Fetch existing dots — public channel only
  const fetchDots = useCallback(async () => {
    try {
      const r = await fetch(`${API}/dots?channel=public`);
      const data = await r.json();
      const raw: Dot[] = Array.isArray(data) ? data : data.dots ?? [];
      const fetched = raw
        .filter((d) => d.content?.trim())
        .sort((a, b) => {
          const ta = new Date(a.createdAt || a.timestamp || 0).getTime();
          const tb = new Date(b.createdAt || b.timestamp || 0).getTime();
          return ta - tb;
        });
      setDots(fetched);
    } catch {
      // silent
    }
  }, []);

  // SSE stream — filter public channel client-side
  useEffect(() => {
    if (!booted) return;
    fetchHealth();
    fetchDots();
    const healthInterval = setInterval(fetchHealth, 15_000);

    const es = new EventSource(`${API}/events`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const handleDot = (raw: string) => {
      try {
        const dot: Dot = JSON.parse(raw);
        if (dot.channel !== "public" || !dot.content?.trim()) return;
        setDots((prev) => {
          if (prev.find((d) => d.id === dot.id)) return prev;
          return [...prev, dot];
        });
      } catch {
        // ignore
      }
    };

    es.addEventListener("dot", (e) => handleDot(e.data));
    es.onmessage = (e) => handleDot(e.data);

    return () => {
      es.close();
      clearInterval(healthInterval);
    };
  }, [booted, fetchHealth, fetchDots]);

  // Auto-scroll
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dots, booted]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setSending(true);
    setInput("");
    try {
      await fetch(`${API}/dot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: msg,
          type: "chat",
          author: author || "anon",
          channel: isPublic ? "public" : "internal",
        }),
      });
    } catch {
      // silent fail
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!booted) {
    return (
      <div className="flex flex-col h-screen items-center justify-center px-6">
        <div className="w-full max-w-xl">
          <div className="text-[#00ff41] text-xs font-mono space-y-1">
            {bootLines.map((line, i) => (
              <div
                key={i}
                className="opacity-0 animate-[fadeIn_0.3s_ease_forwards]"
              >
                <span className="text-[#00ff41]/40">{">"}</span> {line}
              </div>
            ))}
            <div className="inline-block w-2 h-3 bg-[#00ff41] animate-pulse ml-3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto px-4 py-4">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#00ff41]/20 pb-3 mb-4">
        <div>
          <div className="text-[#00ff41] text-sm font-bold tracking-widest uppercase">
            PIED PIPER
          </div>
          <div className="text-[#00ff41]/40 text-xs mt-0.5">
            decentralized communication protocol
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#00ff41]/60">
          <span
            className={`w-2 h-2 rounded-full inline-block ${
              connected ? "bg-[#00ff41] animate-pulse" : "bg-red-500"
            }`}
          />
          {connected ? "MESH CONNECTED" : "OFFLINE"}
          {health && (
            <span className="hidden sm:inline text-[#00ff41]/40">
              {health.peers}P · {health.dots}D ·{" "}
              {truncateId(health.nodeId, 8)}
            </span>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 pb-4">
        {dots.length === 0 && (
          <div className="text-[#00ff41]/30 text-xs text-center py-12">
            no signals yet. be the first dot in the chain.
          </div>
        )}
        {dots.map((dot) => (
          <div key={dot.id} className="flex gap-3 text-sm group">
            <span className="text-[#00ff41]/40 text-xs w-10 shrink-0 pt-0.5 text-right">
              {getTime(dot)}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-[#00ff41]/60 text-xs mr-2">
                {dot.author ?? "anon"}
              </span>
              <span className="text-[#00ff41]/90 break-words">
                {dot.content}
              </span>
              {dot.prev_hash && (
                <span className="text-[#00ff41]/20 text-[10px] ml-2 hidden group-hover:inline">
                  ←{dot.prev_hash.slice(0, 8)}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={msgEndRef} />
      </div>

      {/* Footer — author + input */}
      <div className="border-t border-[#00ff41]/20 pt-3 space-y-2">
        <div className="flex gap-2 text-xs text-[#00ff41]/50 items-center">
          <span>handle:</span>
          <input
            value={author}
            onChange={(e) => saveAuthor(e.target.value)}
            maxLength={24}
            className="bg-transparent border-b border-[#00ff41]/30 text-[#00ff41] w-28 outline-none focus:border-[#00ff41]/70 placeholder:text-[#00ff41]/20 text-xs pb-0.5"
            placeholder="anon"
          />
          <button
            type="button"
            onClick={() => setIsPublic((p) => !p)}
            className={`ml-2 text-[10px] px-2 py-0.5 border transition-colors ${
              isPublic
                ? "border-[#00ff41]/50 text-[#00ff41]/70"
                : "border-[#00ff41]/20 text-[#00ff41]/30"
            }`}
            title={isPublic ? "Broadcasting publicly" : "Internal only"}
          >
            {isPublic ? "PUBLIC" : "INTERNAL"}
          </button>
          <span className="ml-auto text-[#00ff41]/20 hidden sm:inline">
            iroh · DOT chain · append-only
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-[#00ff41]/40 text-sm pt-1">{">"}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            maxLength={500}
            autoFocus
            className="flex-1 bg-transparent text-[#00ff41] outline-none placeholder:text-[#00ff41]/20 text-sm"
            placeholder="type a message. press enter to broadcast."
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !input.trim()}
            className="text-xs px-3 py-1 border border-[#00ff41]/30 text-[#00ff41]/60 hover:border-[#00ff41]/70 hover:text-[#00ff41] disabled:opacity-30 transition-colors"
          >
            {sending ? "…" : "SEND"}
          </button>
        </div>
      </div>

      {/* Protocol note */}
      <div className="text-[#00ff41]/20 text-xs text-center pt-2">
        every message is a DOT · chained · iroh p2p · no servers · no owners
      </div>
    </div>
  );
}
