import { useState } from "react";
import type { RewriteSuggestion } from "@/lib/ats-rubric";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function RewritesDiff({ rewrites }: { rewrites: RewriteSuggestion[] }) {
  if (!rewrites?.length) {
    return (
      <Card className="p-8 text-center">
        <Sparkles className="size-10 mx-auto text-muted-foreground" />
        <h3 className="font-semibold mt-2">No rewrite suggestions</h3>
        <p className="text-sm text-muted-foreground mt-1">Your bullets are already strong.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {rewrites.map((r, i) => (
        <RewriteCard key={i} rewrite={r} index={i} />
      ))}
    </div>
  );
}

function RewriteCard({ rewrite, index }: { rewrite: RewriteSuggestion; index: number }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(rewrite.improved);
      setCopied(true);
      toast.success("Copied improved bullet");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy");
    }
  }
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/50 border-b text-xs font-medium flex items-center justify-between">
        <span>Suggestion {index + 1}</span>
        <Button size="sm" variant="ghost" onClick={copy} className="h-7 text-xs">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy improved"}
        </Button>
      </div>
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-3 p-4 items-stretch">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Original</div>
          <div className="text-sm rounded-md bg-red-500/5 border border-red-500/20 p-3 leading-relaxed">
            {rewrite.original}
          </div>
        </div>
        <div className="hidden md:flex items-center justify-center text-muted-foreground">
          <ArrowRight className="size-4" />
        </div>
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Improved</div>
          <div className="text-sm rounded-md bg-emerald-500/5 border border-emerald-500/30 p-3 leading-relaxed">
            {rewrite.improved}
          </div>
        </div>
      </div>
      {rewrite.reasoning && (
        <div className="px-4 pb-3 text-xs text-muted-foreground border-t bg-muted/20 pt-2">
          <span className="font-semibold text-foreground">Why: </span>{rewrite.reasoning}
        </div>
      )}
    </Card>
  );
}
