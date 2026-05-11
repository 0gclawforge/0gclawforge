"use client";

// MemoryGraph placeholder - implement with D3 force-directed graph
export function MemoryGraph({ entries }: { entries: any[] }) {
  return (
    <div className="gradient-border flex h-96 items-center justify-center">
      <p className="text-text-muted text-sm">
        Memory graph visualization ({entries.length} nodes)
      </p>
    </div>
  );
}
