import { bandFor } from "@/lib/ats-rubric";

export function ScoreRadial({ score, size = 180 }: { score: number; size?: number }) {
  const band = bandFor(score);
  const radius = (size - 16) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--muted))"
            strokeWidth={10}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={band.hex}
            strokeWidth={10}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 800ms ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-bold tabular-nums" style={{ color: band.hex }}>
            {score}
          </div>
          <div className="text-xs text-muted-foreground">/ 100</div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold" style={{ color: band.hex }}>
          {band.label}
        </div>
        <div className="text-xs text-muted-foreground italic">Estimated ATS Compatibility</div>
      </div>
    </div>
  );
}
