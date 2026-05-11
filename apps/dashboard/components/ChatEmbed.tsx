"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatEmbed() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", content: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: input, action: "query" }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.text || "No response" }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Error connecting to agent" }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent-primary text-2xl text-white shadow-lg glow-purple"
      >
        {open ? "\u2715" : "\uD83E\uDD9E"}
      </button>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-40 flex h-96 w-80 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
          >
            <div className="border-b border-border bg-card px-4 py-3">
              <span className="font-semibold">ClawForge Agent</span>
              <span className="ml-2 text-xs text-text-muted">via OpenClaw</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`text-sm ${msg.role === "user" ? "text-right" : ""}`}>
                  <span
                    className={`inline-block rounded-lg px-3 py-2 ${
                      msg.role === "user"
                        ? "bg-accent-primary/20 text-accent-primary"
                        : "bg-card text-text-primary"
                    }`}
                  >
                    {msg.content}
                  </span>
                </div>
              ))}
              {loading && (
                <div className="text-sm text-text-muted animate-pulse">Thinking...</div>
              )}
            </div>

            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary outline-none"
                  placeholder="Ask your agent..."
                />
                <button onClick={send} className="rounded-lg bg-accent-primary px-3 py-2 text-sm text-white">
                  Send
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
