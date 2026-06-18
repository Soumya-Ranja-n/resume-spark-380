import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Target, Loader2 } from "lucide-react";

export function EnhanceLauncher({
  onRun,
  running,
}: {
  onRun: (jd: string) => void;
  running: boolean;
}) {
  const [jd, setJd] = useState("");
  return (
    <Card className="p-5 md:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Sparkles className="size-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold">Run a new analysis</h2>
          <p className="text-sm text-muted-foreground">
            Paste a job description for a precise <span className="font-medium">Targeted</span> score. Leave it blank for a <span className="font-medium">General</span> review.
          </p>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
          <Target className="size-3.5" />
          Job description (optional, recommended)
        </label>
        <Textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the job posting here for keyword matching against the specific role…"
          rows={6}
          className="resize-y"
          disabled={running}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{jd.length ? `${jd.length} chars` : "No JD = general mode"}</span>
          <span className="italic">Estimated ATS score — not a guaranteed score from any specific ATS</span>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={() => onRun(jd.trim())} disabled={running} size="lg">
          {running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {running ? "Analyzing…" : jd.trim() ? "Run targeted analysis" : "Run general analysis"}
        </Button>
      </div>
    </Card>
  );
}
