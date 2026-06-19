import { useEffect, useState } from "react";
import { Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { bandFor, CATEGORY_META, CATEGORY_ORDER, type CategoryScores } from "@/lib/ats-rubric";
import { cn } from "@/lib/utils";

interface Props {
  score: number | null;
  prevScore: number | null;
  categoryScores: CategoryScores | null;
  status: "idle" | "processing" | "completed" | "failed";
  highSeverityToTarget: number;
  jobDescription: string;
  onJobDescriptionChange: (v: string) => void;
  onReanalyse: () => void;
}

export function LiveScoreCard({
  score,
  prevScore,
  categoryScores,
  status,
  highSeverityToTarget,
  jobDescription,
  onJobDescriptionChange,
  onReanalyse,
}: Props) {
  const displayed = useCountUp(score ?? 0, prevScore ?? 0);
  const [jdOpen, setJdOpen] = useState(false);
  const [flash, setFlash] = useState<"none" | "up" | "down">("none");
  const band = bandFor(score ?? 0);
  const processing = status === "processing";

  useEffect(() => {
    if (score == null || prevScore == null || score === prevScore) return;
    setFlash(score > prevScore ? "up" : "down");
    const t = setTimeout(() => setFlash("none"), 1200);
    return () => clearTimeout(t);
  }, [score, prevScore]);

  const targetReached = (score ?? 0) >= 80;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Estimated ATS Compatibility Score</p>
          <p className="text-sm text-muted-foreground mt-0.5">Target: 80+ estimated compatibility</p>
        </div>
        <Badge variant={jobDescription.trim() ? "default" : "secondary"}>
          {jobDescription.trim() ? "Targeted mode" : "Generic mode"}
        </Badge>
      </div>

      <div className="flex items-center justify-center">
        <Radial
          score={score ?? 0}
          displayed={displayed}
          color={band.hex}
          flash={flash}
        />
      </div>

      <div className="text-center -mt-2">
        <p className="font-medium" style={{ color: band.hex }}>{band.label}</p>
        <p className="text-xs text-muted-foreground mt-1">{band.blurb}</p>
      </div>

      {categoryScores && (
        <div className="space-y-2">
          {CATEGORY_ORDER.map((key) => {
            const meta = CATEGORY_META[key];
            const value = categoryScores[key] ?? 0;
            const pct = (value / meta.max) * 100;
            return (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{meta.label}</span>
                  <span className="font-medium tabular-nums">{value}/{meta.max}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        className={cn(
          "text-sm text-center rounded-md px-3 py-2",
          targetReached
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        )}
      >
        {targetReached
          ? "Target reached — review remaining suggestions to maximise your score."
          : score == null
            ? "Run an analysis to see your estimated ATS score."
            : `${highSeverityToTarget} high-severity issue${highSeverityToTarget === 1 ? "" : "s"} remaining to reach 80+`}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setJdOpen((v) => !v)}
          className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground"
        >
          <span>Paste a job description for targeted scoring (recommended)</span>
          {jdOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {jdOpen && (
          <Textarea
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            placeholder="Paste the job description here for a much more accurate keyword match score…"
            className="mt-2 min-h-[120px] text-sm"
          />
        )}
        {!jdOpen && !jobDescription.trim() && (
          <p className="text-xs text-muted-foreground mt-1">
            Generic mode — paste a job description for a much more accurate keyword score.
          </p>
        )}
      </div>

      <Button onClick={onReanalyse} disabled={processing} className="w-full" size="lg">
        {processing ? (
          <><Loader2 className="size-4 animate-spin" /> Analysing your edits…</>
        ) : (
          <><RefreshCw className="size-4" /> Re-analyse my edits</>
        )}
      </Button>
    </Card>
  );
}

function Radial({ score, displayed, color, flash }: { score: number; displayed: number; color: string; flash: "none" | "up" | "down" }) {
  const size = 180;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, score)) / 100) * c;
  // 80 marker angle: 80% around circle, starting at top (12 o'clock)
  const markerAngle = (80 / 100) * 360 - 90;
  const mx = size / 2 + r * Math.cos((markerAngle * Math.PI) / 180);
  const my = size / 2 + r * Math.sin((markerAngle * Math.PI) / 180);

  return (
    <div className={cn(
      "relative transition-all",
      flash === "up" && "drop-shadow-[0_0_18px_rgba(16,185,129,0.6)]",
      flash === "down" && "drop-shadow-[0_0_18px_rgba(245,158,11,0.6)]",
    )}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 700ms ease-out, stroke 400ms" }}
        />
        <circle cx={mx} cy={my} r={5} fill="hsl(var(--background))" stroke="hsl(var(--foreground))" strokeWidth={2} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums" style={{ color }}>{displayed}</span>
        <span className="text-xs text-muted-foreground">of 100 (est.)</span>
      </div>
    </div>
  );
}

function useCountUp(target: number, from: number, durationMs = 700) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    const start = performance.now();
    const startVal = value;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(startVal + (target - startVal) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
}
