import { useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CATEGORY_META, type EnhancementIssue, SEVERITY_ORDER } from "@/lib/ats-rubric";
import { cn } from "@/lib/utils";

interface Props {
  score: number;
  issues: EnhancementIssue[];
  resolved: Set<string>;
  onToggleResolved: (key: string) => void;
}

const SEV_COLOR = {
  high: "text-red-600 dark:text-red-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-blue-600 dark:text-blue-400",
} as const;
const SEV_ICON = { high: AlertCircle, medium: AlertTriangle, low: Info } as const;

export function PathToTarget({ score, issues, resolved, onToggleResolved }: Props) {
  const targetReached = score >= 80;

  const { toTarget, further } = useMemo(() => {
    const sorted = [...issues].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
    );
    if (targetReached) return { toTarget: [], further: sorted };
    // Greedy: pull highs first then mediums until estimated lift would cross 80
    const highs = sorted.filter((i) => i.severity === "high");
    const meds = sorted.filter((i) => i.severity === "medium");
    return { toTarget: [...highs, ...meds], further: sorted.filter((i) => i.severity === "low") };
  }, [issues, targetReached]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        {targetReached ? (
          <CheckCircle2 className="size-5 text-emerald-500" />
        ) : (
          <AlertCircle className="size-5 text-amber-500" />
        )}
        <h3 className="font-semibold">
          {targetReached ? "80+ target reached" : "What to fix to reach 80+"}
        </h3>
      </div>

      {!targetReached && toTarget.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No remaining high or medium issues detected. Run a new analysis after editing.
        </p>
      )}

      <ul className="space-y-3">
        {toTarget.map((issue, idx) => {
          const key = `${issue.severity}-${issue.category}-${idx}`;
          const done = resolved.has(key);
          const Icon = SEV_ICON[issue.severity] ?? Info;
          return (
            <li
              key={key}
              className={cn(
                "rounded-lg border p-3 flex gap-3 transition-opacity",
                done && "opacity-50",
              )}
            >
              <Checkbox
                checked={done}
                onCheckedChange={() => onToggleResolved(key)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Icon className={cn("size-3.5", SEV_COLOR[issue.severity])} />
                  <Badge variant="outline" className="text-[10px] uppercase">{issue.severity}</Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {CATEGORY_META[issue.category as keyof typeof CATEGORY_META]?.label ?? issue.category}
                  </Badge>
                  {issue.section && (
                    <span className="text-[10px] text-muted-foreground capitalize">in {issue.section}</span>
                  )}
                </div>
                <p className={cn("text-sm font-medium", done && "line-through")}>{issue.issue}</p>
                <p className="text-sm text-muted-foreground mt-1">{issue.fix}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {further.length > 0 && (
        <details className="pt-2 border-t">
          <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
            Further improvements ({further.length})
          </summary>
          <ul className="space-y-2 mt-3">
            {further.map((issue, idx) => (
              <li key={`f-${idx}`} className="text-sm">
                <span className="font-medium">{issue.issue}</span>
                <span className="text-muted-foreground"> — {issue.fix}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

export function CeilingNote({ note }: { note: string }) {
  return (
    <Card className="p-4 border-blue-500/30 bg-blue-500/5 flex gap-3">
      <Info className="size-5 text-blue-500 shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-sm">Honest assessment</p>
        <p className="text-sm text-muted-foreground mt-1">{note}</p>
      </div>
    </Card>
  );
}
