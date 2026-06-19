import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wand2, FileText, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/resume-enhancer/")({
  head: () => ({ meta: [{ title: "Resume Enhancer — ResumeTracker AI" }] }),
  component: ResumeEnhancerIndex,
});

interface ResumeRow {
  id: string;
  title: string;
  file_name: string;
  created_at: string;
}

function ResumeEnhancerIndex() {
  const { user } = useAuth();
  const [resumes, setResumes] = useState<ResumeRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("resumes")
        .select("id, title, file_name, created_at")
        .order("created_at", { ascending: false });
      if (active) setResumes((data ?? []) as ResumeRow[]);
    })();
    return () => { active = false; };
  }, [user]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto w-full space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <Wand2 className="size-3.5" /> AI-powered
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-3">Resume Enhancer</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Edit your resume directly in the browser and get a live <strong>Estimated ATS Compatibility Score</strong>.
          We'll guide you toward <strong>80+ estimated compatibility</strong> with specific, no-fabrication suggestions.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pick a resume to enhance</h2>
        {resumes === null ? (
          <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
        ) : resumes.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">No resumes yet — upload one first.</p>
            <Button asChild><Link to="/resumes">Go to resumes</Link></Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {resumes.map((r) => (
              <Link
                key={r.id}
                to="/resume-enhancer/$resumeId"
                params={{ resumeId: r.id }}
                className="block"
              >
                <Card className="p-4 flex items-center gap-3 hover:border-primary/50 transition-colors">
                  <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center">
                    <FileText className="size-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.file_name}</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
