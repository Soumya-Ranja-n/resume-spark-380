import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreGauge } from "@/components/resumes/score-gauge";
import { AiFeedbackPanel } from "@/components/resumes/ai-feedback-panel";
import { analyzeResume } from "@/lib/resumes.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/resumes/$id")({
  head: () => ({ meta: [{ title: "Resume — ResumeTracker AI" }] }),
  component: ResumeDetail,
});

function ResumeDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [resume, setResume] = useState<Tables<"resumes"> | null>(null);
  const [loading, setLoading] = useState(true);
  const analyze = useServerFn(analyzeResume);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("resumes").select("*").eq("id", id).single();
      if (active) { setResume(data); setLoading(false); }
    })();
    const ch = supabase
      .channel(`resume:${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "resumes", filter: `id=eq.${id}` },
        (payload) => setResume(payload.new as Tables<"resumes">))
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [id, user]);

  async function handleReanalyze() {
    try { await analyze({ data: { resume_id: id } }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-64" /></div>;
  if (!resume) return <div className="p-6">Resume not found.</div>;

  const feedback = (resume.ai_feedback ?? {}) as Record<string, unknown>;
  const isAnalyzing = resume.status === "analyzing";

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">
      <Link to="/resumes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All resumes
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{resume.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{resume.file_name}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/resumes/$id/enhance" params={{ id }}>
              <Sparkles className="size-4" /> Enhance with AI
            </Link>
          </Button>
          <Button variant="outline" onClick={handleReanalyze} disabled={isAnalyzing}>
            {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Re-analyze
          </Button>
        </div>
      </div>

      {isAnalyzing && (
        <Card className="p-8 text-center">
          <Loader2 className="size-8 animate-spin mx-auto text-primary" />
          <h2 className="font-semibold mt-3">Analyzing your resume…</h2>
          <p className="text-sm text-muted-foreground mt-1">This usually takes 10–20 seconds. Results will appear here automatically.</p>
        </Card>
      )}

      {resume.status === "failed" && (
        <Card className="p-6 border-destructive/30 bg-destructive/5">
          <div className="flex gap-3">
            <AlertTriangle className="size-5 text-destructive shrink-0" />
            <div>
              <h2 className="font-semibold text-destructive">Analysis failed</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {(feedback as { error?: string }).error ?? "Something went wrong. Try re-analyzing."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {resume.status === "analyzed" && resume.ai_score !== null && (
        <>
          <Card className="p-6 flex items-center gap-6 flex-wrap">
            <ScoreGauge score={resume.ai_score} size={140} />
            <div className="flex-1 min-w-[200px]">
              <h2 className="text-xl font-semibold">Your resume scored {resume.ai_score}/100</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {resume.ai_score >= 80 ? "Strong — minor polish only." :
                 resume.ai_score >= 60 ? "Solid base — apply the suggestions below for a real boost." :
                 "Lots of room to grow — focus on weaknesses and missing keywords first."}
              </p>
            </div>
          </Card>
          <AiFeedbackPanel feedback={feedback as Parameters<typeof AiFeedbackPanel>[0]["feedback"]} />
        </>
      )}

      {resume.status === "uploaded" && (
        <Card className="p-8 text-center">
          <h2 className="font-semibold">Ready to analyze</h2>
          <p className="text-sm text-muted-foreground mt-1">Click re-analyze to get AI feedback.</p>
          <Button className="mt-4" onClick={handleReanalyze}>Analyze now</Button>
        </Card>
      )}
    </div>
  );
}
