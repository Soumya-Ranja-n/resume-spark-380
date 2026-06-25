import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { autoFixSection } from "@/lib/advanced-enhance.functions";
import { DiffPreviewDialog } from "./diff-preview-dialog";

interface Props {
  sectionKey: string;
  sectionLabel: string;
  content: string;
  jobDescription: string;
  onAccept: (rewritten: string) => void;
}

/**
 * Per-section "Fix with AI" button. Opens a diff preview with the
 * AI-rewritten version of just this section so the user can accept or skip.
 */
export function SectionFixButton({
  sectionKey,
  sectionLabel,
  content,
  jobDescription,
  onAccept,
}: Props) {
  const fixFn = useServerFn(autoFixSection);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [rewritten, setRewritten] = useState<string>("");
  const [changes, setChanges] = useState<string[]>([]);

  async function handleClick() {
    if (!content || content.trim().length < 10) {
      toast.info("Add at least a few lines to this section first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fixFn({
        data: {
          section_label: sectionLabel,
          content,
          job_description: jobDescription.trim() || null,
        },
      });
      if (res.rewritten === content.trim()) {
        toast.success("Section is already clean — no rewrite needed.");
        setLoading(false);
        return;
      }
      setRewritten(res.rewritten);
      setChanges(res.changes ?? []);
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Section rewrite failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        className="h-6 text-[11px] px-2"
        title={`Rewrite the ${sectionLabel} section with AI`}
      >
        {loading ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3" />}
        Fix section
      </Button>

      <DiffPreviewDialog
        open={open}
        onOpenChange={setOpen}
        title={`Fix ${sectionLabel}`}
        description={
          changes.length > 0
            ? `AI changes: ${changes.join(" · ")}`
            : "Review the AI rewrite and accept if you're happy with it."
        }
        items={[
          {
            id: `sec_${sectionKey}`,
            label: `Rewrite full ${sectionLabel} section`,
            reason: "Identity-preserving — same employers, dates, and metrics; only the wording changes.",
            sectionLabel,
            before: content,
            after: rewritten,
            badge: "AI",
          },
        ]}
        onApply={(ids) => {
          if (ids.size > 0) {
            onAccept(rewritten);
            toast.success(`Applied AI rewrite to ${sectionLabel}.`);
          }
        }}
        applyLabel="Accept rewrite"
      />
    </>
  );
}
