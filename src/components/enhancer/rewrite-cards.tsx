import { useState } from "react";
import { Copy, Check, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { RewriteSuggestion } from "@/lib/ats-rubric";

interface Props {
  rewrites: RewriteSuggestion[];
  onApply: (original: string, improved: string) => boolean;
}

export function RewriteCards({ rewrites, onApply }: Props) {
  if (rewrites.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        No rewrite suggestions yet. Run an analysis to generate them.
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {rewrites.map((r, idx) => (
        <RewriteRow key={idx} rewrite={r} onApply={onApply} />
      ))}
    </div>
  );
}

function RewriteRow({ rewrite, onApply }: { rewrite: RewriteSuggestion; onApply: Props["onApply"] }) {
  const [copied, setCopied] = useState(false);

  const handleApply = () => {
    const ok = onApply(rewrite.original, rewrite.improved);
    if (ok) toast.success("Applied in editor");
    else toast.info("Couldn't find the exact original text in the editor — copy/paste manually.");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rewrite.improved);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className="p-3 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-md bg-red-500/5 border border-red-500/20 p-3">
          <p className="text-[10px] uppercase tracking-wider text-red-600 dark:text-red-400 mb-1">Original</p>
          <p className="text-sm whitespace-pre-wrap">{rewrite.original}</p>
        </div>
        <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-3">
          <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Improved</p>
          <p className="text-sm whitespace-pre-wrap">{rewrite.improved}</p>
        </div>
      </div>
      {rewrite.reasoning && (
        <p className="text-xs text-muted-foreground">{rewrite.reasoning}</p>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleApply}>
          <Wand2 className="size-3.5" /> Apply in editor
        </Button>
        <Button size="sm" variant="outline" onClick={handleCopy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy improved"}
        </Button>
      </div>
    </Card>
  );
}
