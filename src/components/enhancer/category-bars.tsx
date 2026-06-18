import { CATEGORY_META, CATEGORY_ORDER, type CategoryScores } from "@/lib/ats-rubric";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export function CategoryBars({ scores }: { scores: CategoryScores }) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {CATEGORY_ORDER.map((key) => {
          const meta = CATEGORY_META[key];
          const earned = scores[key] ?? 0;
          const pct = meta.max ? (earned / meta.max) * 100 : 0;
          const color = pct >= 85 ? "#10b981" : pct >= 65 ? "#f59e0b" : pct >= 40 ? "#f97316" : "#ef4444";
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <div className="flex items-center gap-1.5 font-medium">
                  {meta.label}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label={`About ${meta.label}`}>
                        <Info className="size-3.5 text-muted-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">{meta.description}</TooltipContent>
                  </Tooltip>
                </div>
                <div className="tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{earned}</span> / {meta.max}
                </div>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: color, transition: "width 600ms ease-out" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
