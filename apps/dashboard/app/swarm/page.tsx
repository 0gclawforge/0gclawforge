"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";

type SwarmStatus = "idle" | "planning" | "working" | "synthesizing" | "complete";

interface WorkerNode {
  id: string;
  name: string;
  status: "idle" | "thinking" | "working" | "done";
  output: string;
}

export default function SwarmPage() {
  const [task, setTask] = useState("");
  const [workerCount, setWorkerCount] = useState(3);
  const [status, setStatus] = useState<SwarmStatus>("idle");
  const [supervisorPlan, setSupervisorPlan] = useState("");
  const [workers, setWorkers] = useState<WorkerNode[]>([]);
  const [synthesis, setSynthesis] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const launchSwarm = async () => {
    if (!task) return;
    setStatus("planning");
    setLogs([]);
    setSynthesis("");
    addLog("Supervisor: Decomposing task...");

    try {
      const res = await fetch("/api/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, workerCount, action: "swarm" }),
      });
      const data = await res.json();

      setSupervisorPlan(data.supervisorPlan || "");
      addLog(`Supervisor: Created ${workerCount} sub-tasks`);

      setStatus("working");
      const newWorkers: WorkerNode[] = (data.workerResults || []).map(
        (output: string, i: number) => ({
          id: `worker-${i}`,
          name: `Worker ${i + 1}`,
          status: "done" as const,
          output,
        })
      );
      setWorkers(newWorkers);
      newWorkers.forEach((w) => addLog(`${w.name}: Completed sub-task`));

      setStatus("synthesizing");
      addLog("Supervisor: Synthesizing results...");
      await new Promise((r) => setTimeout(r, 500));

      setSynthesis(data.synthesis || "");
      setStatus("complete");
      addLog("Swarm task complete!");
    } catch (err) {
      addLog(`Error: ${err}`);
      setStatus("idle");
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel: Task Control */}
      <div className="w-2/5 border-r border-border p-6 space-y-6">
        <h1 className="text-2xl font-bold">Swarm Orchestrator</h1>

        <div>
          <label className="mb-2 block text-sm text-text-muted">Task Description</label>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-primary outline-none focus:border-accent-primary"
            rows={5}
            placeholder="Research the top 5 DeFi protocols by TVL and write a summary..."
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-text-muted">
            Worker Count: {workerCount}
          </label>
          <input
            type="range"
            min={1}
            max={5}
            value={workerCount}
            onChange={(e) => setWorkerCount(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <button
          onClick={launchSwarm}
          disabled={!task || status !== "idle"}
          className="w-full rounded-lg bg-accent-primary px-6 py-3 font-semibold text-white disabled:opacity-50 glow-purple"
        >
          {status === "idle" ? "Launch Swarm" : "Running..."}
        </button>

        {/* Synthesis Output */}
        {synthesis && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="gradient-border p-4">
            <h3 className="mb-2 text-sm font-semibold text-accent-secondary">Final Synthesis</h3>
            <p className="text-sm text-text-primary whitespace-pre-wrap">{synthesis}</p>
          </motion.div>
        )}
      </div>

      {/* Right Panel: Canvas + Logs */}
      <div className="flex w-3/5 flex-col">
        {/* Swarm Canvas */}
        <div className="flex-1 p-6">
          <div className="flex flex-col items-center gap-8">
            {/* Supervisor Node */}
            <div
              className={`flex h-24 w-48 items-center justify-center rounded-xl border-2 font-semibold transition-all ${
                status === "planning" || status === "synthesizing"
                  ? "border-accent-primary bg-accent-primary/20 animate-pulse glow-purple"
                  : status === "complete"
                  ? "border-success bg-success/10"
                  : "border-border bg-card"
              }`}
            >
              <div className="text-center">
                <div className="text-xs text-text-muted">Supervisor</div>
                <div className="text-sm">
                  {status === "planning"
                    ? "Planning..."
                    : status === "synthesizing"
                    ? "Synthesizing..."
                    : status === "complete"
                    ? "Done"
                    : "Idle"}
                </div>
              </div>
            </div>

            {/* Connection Lines */}
            {status !== "idle" && (
              <div className="flex gap-4">
                {Array.from({ length: workerCount }).map((_, i) => (
                  <div key={i} className="h-8 w-px bg-border" />
                ))}
              </div>
            )}

            {/* Worker Nodes */}
            <div className="flex flex-wrap justify-center gap-4">
              {(workers.length > 0
                ? workers
                : Array.from({ length: status !== "idle" ? workerCount : 0 }, (_, i) => ({
                    id: `w-${i}`,
                    name: `Worker ${i + 1}`,
                    status: "idle" as const,
                    output: "",
                  }))
              ).map((w) => (
                <div
                  key={w.id}
                  className={`flex h-20 w-36 items-center justify-center rounded-lg border transition-all ${
                    w.status === "done"
                      ? "border-success bg-success/10"
                      : w.status === "working"
                      ? "border-accent-secondary bg-accent-secondary/10 animate-pulse glow-cyan"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="text-center">
                    <div className="text-xs text-text-muted">{w.name}</div>
                    <div className="text-xs">{w.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Log Panel */}
        <div className="h-48 border-t border-border bg-surface p-4 overflow-y-auto">
          <h3 className="mb-2 text-xs font-semibold text-text-muted">LIVE LOG</h3>
          <div className="space-y-1 font-mono text-xs">
            {logs.map((log, i) => (
              <div key={i} className="text-text-muted">
                {log}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-text-muted">Waiting for swarm launch...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
