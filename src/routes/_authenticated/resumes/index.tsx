import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Info } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { ResumeCard } from "@/components/resumes/resume-card";
import { ResumeUpload } from "@/components/resumes/resume-upload";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/resumes/")({
  head: () => ({
    meta: [
      { title: "Resumes — ResumeTracker AI" },
      { name: "description", content: "Upload and manage your resumes — get an AI score and tailored feedback in under a minute." },
      { property: "og:title", content: "Resumes — ResumeTracker AI" },
      { property: "og:description", content: "Upload and manage your resumes — get an AI score and tailored feedback in under a minute." },
      { property: "og:url", content: "https://resume-spark-380.lovable.app/resumes" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResumesPage,
});

function ResumesPage() {
  const { user } = useAuth();
  const [resumes, setResumes] = useState<Tables<"resumes">[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("resumes").select("*").order("created_at", { ascending: false });
      if (active) { setResumes(data ?? []); setLoading(false); }
    })();
    const ch = supabase
      .channel(`resumes:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "resumes", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") setResumes((p) => [payload.new as Tables<"resumes">, ...p]);
          else if (payload.eventType === "UPDATE") setResumes((p) => p.map((r) => r.id === (payload.new as Tables<"resumes">).id ? payload.new as Tables<"resumes"> : r));
          else if (payload.eventType === "DELETE") setResumes((p) => p.filter((r) => r.id !== (payload.old as Tables<"resumes">).id));
        })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user, tick]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Resumes</h1>
          <p className="text-muted-foreground text-sm mt-1">Upload and analyze your resumes.</p>
        </div>
      </div>

      <ResumeUpload />

      {resumes.length >= 2 && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            Free plan keeps your latest resumes; upgrade later to keep an unlimited history with version comparison.
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : resumes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No resumes yet"
          description="Upload your first resume above to get an AI score and tailored feedback in under a minute."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((r) => <ResumeCard key={r.id} resume={r} onChanged={() => setTick((t) => t + 1)} />)}
        </div>
      )}
    </div>
  );
}
