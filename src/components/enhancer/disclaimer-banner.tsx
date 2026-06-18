import { Info } from "lucide-react";

export function DisclaimerBanner() {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 flex gap-2.5 text-xs text-muted-foreground">
      <Info className="size-4 shrink-0 mt-0.5" />
      <p>
        This is an <span className="font-semibold text-foreground">Estimated ATS Compatibility Score</span> based on a documented rubric (parseability, keyword match, content quality, structure, length). Real ATS platforms (Workday, Greenhouse, Taleo, iCIMS) parse resumes differently and most don't expose a numeric score — use this as a guide, not a guarantee.
      </p>
    </div>
  );
}
