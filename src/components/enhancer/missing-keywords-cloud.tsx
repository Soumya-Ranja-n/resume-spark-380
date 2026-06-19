import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  missing: string[];
  stuffingWarnings: string[];
}

export function MissingKeywordsCloud({ missing, stuffingWarnings }: Props) {
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h4 className="font-semibold text-sm mb-2">Missing keywords</h4>
        {missing.length === 0 ? (
          <p className="text-sm text-muted-foreground">No missing keywords detected.</p>
        ) : (
          <TooltipProvider delayDuration={150}>
            <div className="flex flex-wrap gap-2">
              {missing.map((k) => (
                <Tooltip key={k}>
                  <TooltipTrigger asChild>
                    <span className="px-2.5 py-1 rounded-full text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 cursor-help">
                      {k}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    This term appeared in the job description but is missing from your resume. Add it if you genuinely have experience with it.
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        )}
      </Card>

      {stuffingWarnings.length > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex gap-2 items-start">
            <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Keyword stuffing detected</p>
              <p className="text-sm text-muted-foreground mt-1">
                Some terms appear too many times, which can trigger spam filters in some ATS platforms.
              </p>
              <ul className="text-sm mt-2 list-disc list-inside text-muted-foreground">
                {stuffingWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
