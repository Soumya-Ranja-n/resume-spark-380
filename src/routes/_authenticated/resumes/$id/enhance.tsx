import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, AlertTriangle, History } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreRadial } from "@/components/enhancer/score-radial";
import { CategoryBars } from "@/components/enhancer/category-bars";
import { IssuesList } from "@/components/enhancer/issues-list";
import { RewritesDiff } from "@/components/enhancer/rewrites-diff";
import { KeywordsPanel } from "@/components/enhancer/keywords-panel";
import { HistoryChart } from "@/components/enhancer/history-chart";
import { EnhanceLauncher } from "@/components/enhancer/enhance-launcher";
import { DisclaimerBanner } from "@/components/enhancer/disclaimer-banner";
import { bandFor, type CategoryScores, type EnhancementIssue, type RewriteSuggestion } from "@/lib/ats-rubric";
import { startEnhancement, listEnhancements } from "@/lib/enhance-resume.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/resumes/$id/enhance")({
  head: () => ({ meta: [{ title: "Resume Enhancer — ResumeTracker AI" }] }),
  component: ResumeEnhancerPage,
});

type Enhancement = Tables<"resume_enhancements">;

function ResumeEnhancerPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const start = useServerFn(startEnhancement);
  const list = useServerFn(listEnhancements);

  const [resume, setResume] = useState<Tables<"resumes"> | null>(null);
  const [runs, setRuns] = useState<Enhancement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  // initial load
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [{ data: r }, runsData] = await Promise.all([
        supabase.from("resumes").select("*").eq("id", id).single(),
        list({ data: { resume_id: id } }).catch(() => []),
      ]);
      if (!active) return;
      setResume(r);
      setRuns(runsData as Enhancement[]);
      const newest = (runsData as Enhancement[])[0];
      if (newest) setSelectedId(newest.id);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id, user, list]);

  // realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`enhancements:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resume_enhancements", filter: `resume_id=eq.${id}` },
        (payload) => {
          setRuns((prev) => {
            const row = (payload.new ?? payload.old) as Enhancement;
            if (payload.eventType === "DELETE") return prev.filter((r) => r.id !== row.id);
            const idx = prev.findIndex((r) => r.id === row.id);
            if (idx === -1) return [row, ...prev];
            const next = [...prev];
            next[idx] = row;
            return next;
          });
          if (payload.eventType === "INSERT") setSelectedId((payload.new as Enhancement).id);
          if (payload.eventType === "UPDATE") {
            const row = payload.new as Enhancement;
            if (row.status === "completed") setRunning(false);
            if (row.status === "failed") {
              setRunning(false);
              toast.error(row.error_message ?? "Analysis failed");
            }
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, user]);

  async function handleRun(jd: string) {
    setRunning(true);
    try {
      await start({ data: { resume_id: id, job_description: jd || null } });
    } catch (e) {
      setRunning(false);
      toast.error(e instanceof Error ? e.message : "Failed to start analysis");
    }
  }

  const selected = useMemo(() => runs.find((r) => r.id === selectedId) ?? null, [runs, selectedId]);
  const processing = selected?.status === "processing" || running;

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!resume) {
    return <div className="p-6">Resume not found.</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          to="/resumes/$id"
          params={{ id }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to resume
        </Link>
        {runs.length > 1 && (
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <History className="size-3.5" /> {runs.length} runs
          </div>
        )}
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Resume Enhancer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {resume.title} · <span className="italic">Estimated ATS Compatibility</span>
        </p>
      </div>

      <DisclaimerBanner />

      <EnhanceLauncher onRun={handleRun} running={processing} />

      {processing && (
        <Card className="p-8 text-center">
          <Loader2 className="size-8 animate-spin mx-auto text-primary" />
          <h2 className="font-semibold mt-3">Analyzing your resume…</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Extracting text, scoring against the 100-point rubric, and generating fixes. Updates appear live.
          </p>
        </Card>
      )}

      {selected?.status === "failed" && (
        <Card className="p-5 border-destructive/30 bg-destructive/5">
          <div className="flex gap-3">
            <AlertTriangle className="size-5 text-destructive shrink-0" />
            <div>
              <h2 className="font-semibold text-destructive">Analysis failed</h2>
              <p className="text-sm text-muted-foreground mt-1">{selected.error_message ?? "Try running it again."}</p>
            </div>
          </div>
        </Card>
      )}

      {selected?.status === "completed" && selected.overall_score !== null && (
        <ResultsView enhancement={selected} runs={runs} onSelectRun={setSelectedId} />
      )}

      {!selected && !processing && (
        <Card className="p-10 text-center">
          <h2 className="font-semibold">No analyses yet</h2>
          <p className="text-sm text-muted-foreground mt-1">Run your first analysis above to see your estimated ATS score.</p>
        </Card>
      )}
    </div>
  );
}

function ResultsView({
  enhancement,
  runs,
  onSelectRun,
}: {
  enhancement: Enhancement;
  runs: Enhancement[];
  onSelectRun: (id: string) => void;
}) {
  const score = enhancement.overall_score ?? 0;
  const band = bandFor(score);
  const scores = (enhancement.category_scores as unknown as CategoryScores) ?? ({} as CategoryScores);
  const issues = (enhancement.issues as unknown as EnhancementIssue[]) ?? [];
  const rewrites = (enhancement.rewrite_suggestions as unknown as RewriteSuggestion[]) ?? [];
  const missing = (enhancement.missing_keywords ?? []) as string[];
  const stuffing = (enhancement.keyword_stuffing_warnings ?? []) as string[];
  const mode = (enhancement.mode as "general" | "targeted") ?? "general";

  return (
    <div className="space-y-5">
      <Card className="p-5 md:p-6">
        <div className="flex items-center gap-6 flex-wrap">
          <ScoreRadial score={score} size={180} />
          <div className="flex-1 min-w-[240px] space-y-2">
            <p className="text-base md:text-lg" style={{ color: band.hex }}>
              <span className="font-semibold">{band.label}</span>
            </p>
            <p className="text-sm text-muted-foreground">{band.blurb}</p>
            <div className="flex gap-2 flex-wrap pt-1">
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted">
                {mode === "targeted" ? "Targeted (with JD)" : "General mode"}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted">
                {new Date(enhancement.created_at).toLocaleString()}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted">
                {issues.length} issues · {rewrites.length} rewrites
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full md:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issues">Issues {issues.length > 0 && <span className="ml-1 text-xs opacity-70">({issues.length})</span>}</TabsTrigger>
          <TabsTrigger value="rewrites">Rewrites {rewrites.length > 0 && <span className="ml-1 text-xs opacity-70">({rewrites.length})</span>}</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="p-5 md:p-6">
            <h3 className="font-semibold mb-4">Category breakdown</h3>
            <CategoryBars scores={scores} />
          </Card>
        </TabsContent>

        <TabsContent value="issues"><IssuesList issues={issues} /></TabsContent>
        <TabsContent value="rewrites"><RewritesDiff rewrites={rewrites} /></TabsContent>
        <TabsContent value="keywords"><KeywordsPanel missing={missing} stuffing={stuffing} mode={mode} /></TabsContent>
        <TabsContent value="history"><HistoryChart runs={runs} currentId={enhancement.id} /></TabsContent>
      </Tabs>

      {runs.length > 1 && (
        <div className="text-xs text-muted-foreground text-center">
          Viewing latest run.{" "}
          <button
            onClick={() => {
              const prev = runs.find((r) => r.id !== enhancement.id && r.status === "completed");
              if (prev) onSelectRun(prev.id);
            }}
            className="underline hover:text-foreground"
          >
            See previous run
          </button>
        </div>
      )}
    </div>
  );
}
