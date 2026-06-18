import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Tag, Copy } from "lucide-react";
import { toast } from "sonner";

export function KeywordsPanel({
  missing,
  stuffing,
  mode,
}: {
  missing: string[];
  stuffing: string[];
  mode: "general" | "targeted";
}) {
  async function copyAll() {
    await navigator.clipboard.writeText(missing.join(", "));
    toast.success("Copied all missing keywords");
  }
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Tag className="size-4 text-primary" />
            <h3 className="font-semibold">Missing keywords</h3>
            <Badge variant="secondary" className="text-xs">{mode === "targeted" ? "From job description" : "Generic"}</Badge>
          </div>
          {missing.length > 0 && (
            <button onClick={copyAll} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <Copy className="size-3" /> Copy all
            </button>
          )}
        </div>
        {mode === "general" && (
          <p className="text-xs text-muted-foreground mb-3 italic">
            Lower confidence — paste a job description on your next run for a precise match.
          </p>
        )}
        {missing.length === 0 ? (
          <p className="text-sm text-muted-foreground">No missing keywords detected.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {missing.map((k) => (
              <button
                key={k}
                onClick={() => { navigator.clipboard.writeText(k); toast.success(`Copied "${k}"`); }}
                className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition"
              >
                {k}
              </button>
            ))}
          </div>
        )}
      </Card>

      {stuffing.length > 0 && (
        <Card className="p-5 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <h3 className="font-semibold">Keyword stuffing warnings</h3>
          </div>
          <ul className="space-y-2 text-sm">
            {stuffing.map((w, i) => (
              <li key={i} className="flex gap-2"><span className="text-amber-600 dark:text-amber-400">•</span>{w}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
