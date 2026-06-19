import { useState } from "react";
import { ChevronDown, ChevronUp, Wand2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EnhancementIssue, RewriteSuggestion } from "@/lib/ats-rubric";

interface Props {
  sectionKey: string;
  issues: EnhancementIssue[];
  rewrites: RewriteSuggestion[];
  edited: boolean;
  onApplyRewrite: (original: string, improved: string) => boolean;
}

const SEV_ICON = { high: AlertCircle, medium: AlertTriangle, low: Info } as const;
const SEV_TONE = {
  high: "border-red-500/40 bg-red-500/5",
  medium: "border-amber-500/40 bg-amber-500/5",
  low: "border-blue-500/40 bg-blue-500/5",
} as const;

export function SectionHints({ issues, rewrites, edited, onApplyRewrite }: Props) {
  const [open, setOpen] = useState(true);
  const items = issues.length;

  if (edited) {
    return (
      <div className="text-xs text-muted-foreground italic mt-2 px-1">
        Re-analyse to refresh hints for this section.
      </div>
    );
  }

  if (items === 0 && rewrites.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {items} AI hint{items === 1 ? "" : "s"} for this section
      </button>

      {open && (
        <div className="space-y-2">
          {issues.map((iss, idx) => {
            const Icon = SEV_ICON[iss.severity] ?? Info;
            const matching = rewrites.find((r) => iss.issue.includes(r.original.slice(0, 20)) || r.original.length < 50);
            return (
              <div key={idx} className={cn("rounded-md border p-2.5 text-xs", SEV_TONE[iss.severity])}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="size-3" />
                  <Badge variant="outline" className="text-[9px] uppercase h-4">{iss.severity}</Badge>
                  <span className="text-muted-foreground capitalize">{iss.category.replace("_", " ")}</span>
                </div>
                <p className="font-medium">{iss.issue}</p>
                <p className="text-muted-foreground mt-1">{iss.fix}</p>
                {matching && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7"
                    onClick={() => onApplyRewrite(matching.original, matching.improved)}
                  >
                    <Wand2 className="size-3" /> Use suggested rewrite
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
