import { cn } from "@/lib/utils";

export function ScoreGauge({ score, size = 96, label }: { score: number; size?: number; label?: string }) {
  const stroke = Math.max(4, size / 12);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const color = score >= 80 ? "text-success" : score >= 60 ? "text-primary" : score >= 40 ? "text-accent" : "text-destructive";

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-muted" />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="currentColor" strokeWidth={stroke} fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(color, "transition-[stroke-dashoffset] duration-700 ease-out")}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold tabular-nums leading-none", color)} style={{ fontSize: size * 0.3 }}>
            {score}
          </span>
          {size >= 80 && <span className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">/ 100</span>}
        </div>
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}
