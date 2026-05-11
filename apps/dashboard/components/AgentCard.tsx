"use client";

interface AgentCardProps {
  tokenId: number;
  name: string;
  personality: string;
  modelType: string;
  taskCount: number;
  memorySize: number;
  capabilities?: string[];
  isListed?: boolean;
  price?: string;
}

export function AgentCard({
  tokenId, name, personality, modelType, taskCount, memorySize, capabilities = [], isListed, price,
}: AgentCardProps) {
  const hue = (tokenId * 137) % 360;

  return (
    <div className="gradient-border overflow-hidden">
      <div
        className="h-24 w-full"
        style={{ background: `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${(hue + 60) % 360}, 70%, 40%))` }}
      />
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{name}</h3>
          <span className="font-mono text-xs text-text-muted">#{tokenId}</span>
        </div>
        <p className="text-sm text-text-muted line-clamp-2">{personality}</p>
        <div className="flex flex-wrap gap-1">
          {capabilities.map((c) => (
            <span key={c} className="rounded-full bg-accent-primary/20 px-2 py-0.5 text-xs text-accent-primary">{c}</span>
          ))}
        </div>
        <div className="flex justify-between text-xs text-text-muted">
          <span>{taskCount} tasks</span>
          <span>{modelType}</span>
          <span>{memorySize}B memory</span>
        </div>
        {isListed && price && (
          <div className="border-t border-border pt-2 text-right">
            <span className="text-lg font-bold text-accent-secondary">{price} OG</span>
          </div>
        )}
      </div>
    </div>
  );
}
