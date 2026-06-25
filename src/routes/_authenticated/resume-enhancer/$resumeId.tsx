import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Save, FileDown, Loader2, AlertTriangle, History } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import {
  getResumeText,
  saveEditedResume,
  startEnhancement,
  listEnhancements,
} from "@/lib/enhance-resume.functions";
import { splitIntoSections, joinSections, type ResumeSection, SECTION_ORDER } from "@/lib/resume-sections";
import type { CategoryScores, EnhancementIssue, RewriteSuggestion } from "@/lib/ats-rubric";

import { SectionEditor } from "@/components/enhancer/section-editor";
import { SectionHints } from "@/components/enhancer/section-hints";
import { LiveScoreCard } from "@/components/enhancer/live-score-card";
import { PathToTarget, CeilingNote } from "@/components/enhancer/path-to-target";
import { RewriteCards } from "@/components/enhancer/rewrite-cards";
import { MissingKeywordsCloud } from "@/components/enhancer/missing-keywords-cloud";
import { AutoEnhanceDialog } from "@/components/enhancer/auto-enhance-dialog";
import { AdvancedEnhancerPanel } from "@/components/enhancer/advanced-enhancer-panel";
import { SectionFixButton } from "@/components/enhancer/section-fix-button";

export const Route = createFileRoute("/_authenticated/resume-enhancer/$resumeId")({
  head: () => ({ meta: [{ title: "Resume Enhancer — ResumeTracker AI" }] }),
  component: ResumeEnhancerPage,
});

interface EnhancementRow {
  id: string;
  resume_id: string;
  status: string;
  overall_score: number | null;
  category_scores: CategoryScores | null;
  issues: EnhancementIssue[] | null;
  rewrite_suggestions: RewriteSuggestion[] | null;
  missing_keywords: string[] | null;
  keyword_stuffing_warnings: string[] | null;
  score_ceiling_note: string | null;
  job_description: string | null;
  error_message: string | null;
  created_at: string;
}

function ResumeEnhancerPage() {
  const { resumeId } = Route.useParams();
  const { user } = useAuth();
  const getText = useServerFn(getResumeText);
  const saveDraft = useServerFn(saveEditedResume);
  const startFn = useServerFn(startEnhancement);
  const listFn = useServerFn(listEnhancements);

  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<ResumeSection[]>([]);
  const [title, setTitle] = useState("Resume");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const [history, setHistory] = useState<EnhancementRow[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [editedSinceAnalysis, setEditedSinceAnalysis] = useState<Set<string>>(new Set());

  const [jobDescription, setJobDescription] = useState("");
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [prevScore, setPrevScore] = useState<number | null>(null);
  const prevScoreRef = useRef<number | null>(null);

  // Load resume text + history
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const [textRes, hist] = await Promise.all([
          getText({ data: { resume_id: resumeId } }),
          listFn({ data: { resume_id: resumeId } }),
        ]);
        if (!active) return;
        setSections(splitIntoSections(textRes.text));
        setTitle(textRes.title);
        setSavedAt(textRes.edited_text_updated_at ?? null);
        setHistory(hist as unknown as EnhancementRow[]);
        const latest = (hist as unknown as EnhancementRow[])[0];
        if (latest) {
          setCurrentId(latest.id);
          if (latest.job_description) setJobDescription(latest.job_description);
          prevScoreRef.current = latest.overall_score ?? null;
          setPrevScore(latest.overall_score ?? null);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load resume");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [resumeId, user, getText, listFn]);

  // Realtime: subscribe to enhancement updates for this resume
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`enh:${resumeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resume_enhancements", filter: `resume_id=eq.${resumeId}` },
        (payload) => {
          const row = payload.new as EnhancementRow;
          setHistory((prev) => {
            const without = prev.filter((r) => r.id !== row.id);
            return [row, ...without].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
          });
          if (payload.eventType === "UPDATE" && row.status === "completed" && row.id === currentId) {
            if (row.overall_score != null) {
              setPrevScore(prevScoreRef.current);
              prevScoreRef.current = row.overall_score;
            }
            setEditedSinceAnalysis(new Set());
            setResolved(new Set());
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [resumeId, user, currentId]);

  const current = useMemo(() => history.find((r) => r.id === currentId) ?? history[0] ?? null, [history, currentId]);
  const processing = current?.status === "processing";
  const issues = (current?.issues ?? []) as EnhancementIssue[];
  const rewrites = (current?.rewrite_suggestions ?? []) as RewriteSuggestion[];
  const score = current?.overall_score ?? null;

  const highSeverityToTarget = useMemo(
    () => issues.filter((i) => i.severity === "high").length,
    [issues],
  );

  function updateSection(key: string, content: string) {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, content } : s)));
    setEditedSinceAnalysis((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }

  function applyRewrite(original: string, improved: string): boolean {
    let applied = false;
    setSections((prev) =>
      prev.map((s) => {
        if (applied) return s;
        if (s.content.includes(original)) {
          applied = true;
          return { ...s, content: s.content.replace(original, improved) };
        }
        return s;
      }),
    );
    if (applied) {
      // mark all sections as edited — simplest signal
      setEditedSinceAnalysis(new Set(sections.map((s) => s.key)));
    }
    return applied;
  }

  async function handleSaveDraft() {
    setSavingDraft(true);
    try {
      await saveDraft({ data: { resume_id: resumeId, edited_text: joinSections(sections) } });
      setSavedAt(new Date().toISOString());
      toast.success("Draft saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleReanalyse() {
    const text = joinSections(sections);
    if (!text.trim()) {
      toast.error("Add some resume content first.");
      return;
    }
    try {
      await saveDraft({ data: { resume_id: resumeId, edited_text: text } });
      setSavedAt(new Date().toISOString());
      const res = await startFn({
        data: {
          resume_id: resumeId,
          job_description: jobDescription.trim() || null,
          edited_text: text,
        },
      });
      setCurrentId(res.enhancement_id);
      toast.success("Analysis started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    }
  }

  async function handleAutoEnhanceAccept(enhancedText: string) {
    setSections(splitIntoSections(enhancedText));
    setEditedSinceAnalysis(new Set(SECTION_ORDER));
    try {
      await saveDraft({ data: { resume_id: resumeId, edited_text: enhancedText } });
      setSavedAt(new Date().toISOString());
      const res = await startFn({
        data: {
          resume_id: resumeId,
          job_description: jobDescription.trim() || null,
          edited_text: enhancedText,
        },
      });
      setCurrentId(res.enhancement_id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Re-analysis failed");
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-[600px]" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    );
  }

  const issuesBySection = groupIssuesBySection(issues);
  const rewritesBySection = groupRewritesBySection(rewrites, sections);

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto w-full space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link to="/resumes/$id" params={{ id: resumeId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to resume
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-2">Resume Enhancer</h1>
          <p className="text-sm text-muted-foreground mt-1">{title}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {savedAt && (
            <span className="text-xs text-muted-foreground">
              Draft saved {formatRelative(savedAt)}
            </span>
          )}
          <AutoEnhanceDialog
            resumeId={resumeId}
            currentText={joinSections(sections)}
            jobDescription={jobDescription}
            onAccept={handleAutoEnhanceAccept}
          />
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={savingDraft}>
            {savingDraft ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save draft
          </Button>
          <Button variant="outline" size="sm" disabled title="Coming soon">
            <FileDown className="size-4" /> Export as PDF (coming soon)
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* LEFT: Editor */}
        <div className="space-y-3 order-2 lg:order-1">
          <Card className="p-3 border-amber-500/30 bg-amber-500/5">
            <div className="flex gap-2 text-sm">
              <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                Formatting like tables, columns, and decorative fonts hurts ATS parseability.
                The editor is intentionally minimal to keep your resume machine-readable.
              </p>
            </div>
          </Card>

          {SECTION_ORDER.map((key) => {
            const sec = sections.find((s) => s.key === key);
            if (!sec) return null;
            const secIssues = issuesBySection[key] ?? [];
            const secRewrites = rewritesBySection[key] ?? [];
            const hasHigh = secIssues.some((i) => i.severity === "high");
            const edited = editedSinceAnalysis.has(key);
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {sec.label}
                    </h3>
                    {secIssues.length > 0 && (
                      <Badge
                        variant={hasHigh ? "destructive" : "secondary"}
                        className="text-[10px] h-4"
                      >
                        {secIssues.length} issue{secIssues.length === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                </div>
                <SectionEditor
                  value={sec.content}
                  onChange={(v) => updateSection(key, v)}
                  placeholder={`Add ${sec.label.toLowerCase()} content…`}
                />
                <SectionHints
                  sectionKey={key}
                  issues={secIssues}
                  rewrites={secRewrites}
                  edited={edited}
                  onApplyRewrite={applyRewrite}
                />
                <div className="border-b border-border/50 pt-2" />
              </div>
            );
          })}
        </div>

        {/* RIGHT: Score + Suggestions */}
        <div className="space-y-4 order-1 lg:order-2 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <LiveScoreCard
            score={score}
            prevScore={prevScore}
            categoryScores={current?.category_scores ?? null}
            status={(current?.status as "idle" | "processing" | "completed" | "failed") ?? "idle"}
            highSeverityToTarget={highSeverityToTarget}
            jobDescription={jobDescription}
            onJobDescriptionChange={setJobDescription}
            onReanalyse={handleReanalyse}
          />

          {current?.status === "failed" && current.error_message && (
            <Card className="p-4 border-destructive/30 bg-destructive/5 text-sm">
              <p className="font-medium text-destructive">Analysis failed</p>
              <p className="text-muted-foreground mt-1">{current.error_message}</p>
            </Card>
          )}

          {current?.score_ceiling_note && <CeilingNote note={current.score_ceiling_note} />}

          {score != null && (
            <Tabs defaultValue="path">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="path">Path to 80+</TabsTrigger>
                <TabsTrigger value="rewrites">Rewrites</TabsTrigger>
                <TabsTrigger value="keywords">Keywords</TabsTrigger>
                <TabsTrigger value="history"><History className="size-3.5" /></TabsTrigger>
              </TabsList>
              <TabsContent value="path" className="mt-3">
                <PathToTarget
                  score={score}
                  issues={issues}
                  resolved={resolved}
                  onToggleResolved={(k) =>
                    setResolved((prev) => {
                      const next = new Set(prev);
                      if (next.has(k)) next.delete(k); else next.add(k);
                      return next;
                    })
                  }
                />
              </TabsContent>
              <TabsContent value="rewrites" className="mt-3">
                <RewriteCards rewrites={rewrites} onApply={applyRewrite} />
              </TabsContent>
              <TabsContent value="keywords" className="mt-3">
                <MissingKeywordsCloud
                  missing={current.missing_keywords ?? []}
                  stuffingWarnings={current.keyword_stuffing_warnings ?? []}
                />
              </TabsContent>
              <TabsContent value="history" className="mt-3">
                <HistoryPanel history={history} />
              </TabsContent>
            </Tabs>
          )}

          {score == null && !processing && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No analysis yet. Click "Re-analyse my edits" to get your first estimated ATS score.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({ history }: { history: EnhancementRow[] }) {
  const completed = history.filter((h) => h.status === "completed" && h.overall_score != null);
  if (completed.length < 2) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Your score history will appear here once you have at least 2 completed analyses.
      </Card>
    );
  }
  const data = [...completed].reverse().map((h, idx) => ({
    run: `#${idx + 1}`,
    score: h.overall_score,
  }));
  return (
    <Card className="p-4">
      <p className="text-sm font-medium mb-1">Your score history for this resume</p>
      <p className="text-xs text-muted-foreground mb-3">Each point is one analysis run.</p>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
            <XAxis dataKey="run" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <RTooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                fontSize: 12,
              }}
            />
            <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function groupIssuesBySection(issues: EnhancementIssue[]): Record<string, EnhancementIssue[]> {
  const out: Record<string, EnhancementIssue[]> = {};
  for (const i of issues) {
    const k = (i.section || "other").toLowerCase();
    (out[k] ??= []).push(i);
  }
  return out;
}

function groupRewritesBySection(
  rewrites: RewriteSuggestion[],
  sections: ResumeSection[],
): Record<string, RewriteSuggestion[]> {
  const out: Record<string, RewriteSuggestion[]> = {};
  for (const r of rewrites) {
    const match = sections.find((s) => s.content.includes(r.original));
    const k = match?.key ?? "other";
    (out[k] ??= []).push(r);
  }
  return out;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
