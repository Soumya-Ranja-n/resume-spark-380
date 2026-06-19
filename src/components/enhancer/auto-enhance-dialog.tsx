import { useState } from "react";
import { Sparkles, Loader2, Check, X, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { autoEnhanceResume } from "@/lib/enhance-resume.functions";

interface Props {
  resumeId: string;
  currentText: string;
  jobDescription: string;
  onAccept: (enhancedText: string) => void;
}

export function AutoEnhanceDialog({ resumeId, currentText, jobDescription, onAccept }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enhanced, setEnhanced] = useState<string | null>(null);
  const [changes, setChanges] = useState<string[]>([]);
  const autoFn = useServerFn(autoEnhanceResume);

  async function run() {
    if (!currentText.trim() || currentText.trim().length < 20) {
      toast.error("Add more resume content before auto-enhancing.");
      return;
    }
    setLoading(true);
    setEnhanced(null);
    setChanges([]);
    try {
      const res = await autoFn({
        data: {
          resume_id: resumeId,
          current_text: currentText,
          job_description: jobDescription.trim() || null,
        },
      });
      setEnhanced(res.enhanced_text);
      setChanges(res.change_summary ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auto-enhance failed");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      void run();
    } else {
      setEnhanced(null);
      setChanges([]);
    }
  }

  function accept() {
    if (!enhanced) return;
    onAccept(enhanced);
    setOpen(false);
    setEnhanced(null);
    setChanges([]);
    toast.success("Enhanced resume loaded into editor. Re-analysing…");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Sparkles className="size-4" /> Auto-Enhance
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> AI Auto-Enhance
          </DialogTitle>
          <DialogDescription>
            Identity-preserving rewrite. No fabricated skills, employers, dates, or metrics — only
            tightened wording, stronger verbs, and ATS-friendly structure based on your existing content.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p>Rewriting your resume…</p>
            <p className="text-xs">This usually takes 10–20 seconds.</p>
          </div>
        )}

        {!loading && enhanced && (
          <div className="space-y-3">
            <Card className="p-3 border-emerald-500/30 bg-emerald-500/5">
              <div className="flex gap-2 text-sm">
                <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  No-fabrication guardrail enforced. Review the preview before accepting — you can
                  still edit afterwards.
                </p>
              </div>
            </Card>

            {changes.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  What changed ({changes.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {changes.map((c, i) => (
                    <Badge key={i} variant="secondary" className="font-normal text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Enhanced resume preview
              </p>
              <ScrollArea className="h-[340px] rounded-md border bg-muted/30 p-3">
                <pre className="text-xs whitespace-pre-wrap font-mono">{enhanced}</pre>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            <X className="size-4" /> Discard
          </Button>
          <Button onClick={accept} disabled={loading || !enhanced}>
            <Check className="size-4" /> Apply to editor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
