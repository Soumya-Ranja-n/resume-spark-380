import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Wand2, ListChecks, Target, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  detectIssues,
  applyProposals,
  type NormalizerProposal,
} from "@/lib/resume-normalizer";
import { suggestKeywordInjections } from "@/lib/advanced-enhance.functions";
import { DiffPreviewDialog, type DiffItem } from "./diff-preview-dialog";
import type { ResumeSection } from "@/lib/resume-sections";

interface Props {
  sections: ResumeSection[];
  missingKeywords: string[];
  jobDescription: string;
  onApplySections: (next: ResumeSection[]) => void;
}

/**
 * Advanced auto-fix panel: deterministic normalizer + AI keyword injector.
 * Both surface in a diff dialog so the user accepts each change individually.
 */
export function AdvancedEnhancerPanel({
  sections,
  missingKeywords,
  jobDescription,
  onApplySections,
}: Props) {
  const injectFn = useServerFn(suggestKeywordInjections);

  const [normOpen, setNormOpen] = useState(false);
  const [proposals, setProposals] = useState<NormalizerProposal[]>([]);

  const [injectOpen, setInjectOpen] = useState(false);
  const [injectItems, setInjectItems] = useState<DiffItem[]>([]);
  const [injectMap, setInjectMap] = useState<
    Map<string, { sectionKey: string; original: string; improved: string }>
  >(new Map());
  const [loadingInject, setLoadingInject] = useState(false);

  const issueCount = useMemo(() => detectIssues(sections).length, [sections]);

  function handleNormalize() {
    const detected = detectIssues(sections);
    if (detected.length === 0) {
      toast.success("Already clean — no formatting issues found.");
      return;
    }
    setProposals(detected);
    setNormOpen(true);
  }

  function applyNormalized(acceptedIds: Set<string>) {
    if (acceptedIds.size === 0) return;
    const next = applyProposals(sections, proposals, acceptedIds);
    onApplySections(next);
    toast.success(`Applied ${acceptedIds.size} formatting fix${acceptedIds.size === 1 ? "" : "es"}.`);
  }

  async function handleInject() {
    if (missingKeywords.length === 0) {
      toast.info("Run an analysis first to find missing keywords.");
      return;
    }
    setLoadingInject(true);
    try {
      const res = await injectFn({
        data: {
          missing_keywords: missingKeywords.slice(0, 30),
          sections: sections.map((s) => ({ key: s.key, label: s.label, content: s.content })),
          job_description: jobDescription.trim() || null,
        },
      });
      if (!res.suggestions || res.suggestions.length === 0) {
        toast.info("No honest keyword injections found — your existing bullets don't clearly demonstrate the missing keywords.");
        setLoadingInject(false);
        return;
      }
      const map = new Map<string, { sectionKey: string; original: string; improved: string }>();
      const items: DiffItem[] = res.suggestions.map((s, idx) => {
        const id = `kw_${idx}_${Date.now().toString(36)}`;
        map.set(id, { sectionKey: s.section_key, original: s.original, improved: s.improved });
        return {
          id,
          label: `Surface "${s.keyword}"`,
          reason: s.reasoning,
          sectionLabel: s.section_key,
          before: s.original,
          after: s.improved,
          badge: "AI",
        };
      });
      setInjectMap(map);
      setInjectItems(items);
      setInjectOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Keyword suggestion failed");
    } finally {
      setLoadingInject(false);
    }
  }

  function applyInjections(acceptedIds: Set<string>) {
    if (acceptedIds.size === 0) return;
    const updated = sections.map((s) => ({ ...s }));
    let applied = 0;
    for (const id of acceptedIds) {
      const entry = injectMap.get(id);
      if (!entry) continue;
      const sec = updated.find((s) => s.key === entry.sectionKey);
      if (!sec) continue;
      if (sec.content.includes(entry.original)) {
        sec.content = sec.content.replace(entry.original, entry.improved);
        applied++;
      }
    }
    if (applied > 0) {
      onApplySections(updated);
      toast.success(`Applied ${applied} keyword rewrite${applied === 1 ? "" : "s"}.`);
    } else {
      toast.warning("Couldn't locate the original bullets to replace.");
    }
  }

  return (
    <>
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wand2 className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Advanced enhancer</h3>
          </div>
          <Badge variant="outline" className="text-[10px]">Diff preview</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Fix common resume mistakes automatically. Every change is shown as a before/after — you accept or skip each one.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNormalize}
            className="justify-start"
          >
            <ListChecks className="size-4" />
            <span className="flex-1 text-left">Normalize formatting</span>
            {issueCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4">{issueCount}</Badge>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleInject}
            disabled={loadingInject || missingKeywords.length === 0}
            className="justify-start"
          >
            {loadingInject ? <Loader2 className="size-4 animate-spin" /> : <Target className="size-4" />}
            <span className="flex-1 text-left">Inject missing keywords</span>
            {missingKeywords.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4">{missingKeywords.length}</Badge>
            )}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground/80">
          Normalizer runs locally — no AI. Keyword injector uses AI and only rewrites bullets where your existing experience supports the keyword (no fabrication).
        </p>
      </Card>

      <DiffPreviewDialog
        open={normOpen}
        onOpenChange={setNormOpen}
        title="Normalize formatting"
        description="Deterministic fixes — spacing, dates, bullets, pronouns, weak openers. Pick which to apply."
        items={proposals.map((p) => ({
          id: p.id,
          label: p.label,
          reason: p.reason,
          sectionLabel: p.sectionKey,
          before: p.before,
          after: p.after,
        }))}
        onApply={applyNormalized}
      />

      <DiffPreviewDialog
        open={injectOpen}
        onOpenChange={setInjectOpen}
        title="Inject missing keywords"
        description="AI proposes rewriting existing bullets to surface job-description keywords your resume already implies."
        items={injectItems}
        onApply={applyInjections}
      />
    </>
  );
}
