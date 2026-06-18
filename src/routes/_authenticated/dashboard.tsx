import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Briefcase, FileText, Trophy, Sparkles } from "lucide-react";
import { format, startOfWeek, subWeeks } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusDonut } from "@/components/dashboard/status-donut";
import { ActivityLine } from "@/components/dashboard/activity-line";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResumeUpload } from "@/components/resumes/resume-upload";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ResumeTracker AI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<Tables<"job_applications">[]>([]);
  const [resumes, setResumes] = useState<Tables<"resumes">[]>([]);
  const [notifs, setNotifs] = useState<Tables<"notifications">[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [a, r, n] = await Promise.all([
        supabase.from("job_applications").select("*").order("created_at", { ascending: false }),
        supabase.from("resumes").select("*").order("created_at", { ascending: false }),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(8),
      ]);
      setApps(a.data ?? []);
      setResumes(r.data ?? []);
      setNotifs(n.data ?? []);
      setLoading(false);
    })();
  }, [user]);

  const counts = apps.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  const activeCount = (counts.applied ?? 0) + (counts.interviewing ?? 0);
  const offerCount = counts.offer ?? 0;
  const scored = resumes.filter((r) => r.ai_score !== null);
  const avgScore = scored.length ? Math.round(scored.reduce((s, r) => s + (r.ai_score ?? 0), 0) / scored.length) : null;

  const weeks = Array.from({ length: 8 }, (_, i) => startOfWeek(subWeeks(new Date(), 7 - i)));
  const activity = weeks.map((w) => {
    const next = new Date(w); next.setDate(next.getDate() + 7);
    const count = apps.filter((a) => {
      const d = new Date(a.created_at);
      return d >= w && d < next;
    }).length;
    return { week: format(w, "MMM d"), count };
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const hasNothing = apps.length === 0 && resumes.length === 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm mt-1">Here's a snapshot of your job search.</p>
      </div>

      {hasNothing ? (
        <Card className="p-8">
          <div className="max-w-md mx-auto text-center">
            <div className="size-12 rounded-xl gradient-primary text-primary-foreground inline-flex items-center justify-center mb-4 shadow-elegant">
              <Sparkles className="size-5" />
            </div>
            <h2 className="text-xl font-semibold">Get started in 30 seconds</h2>
            <p className="text-sm text-muted-foreground mt-1">Upload your resume to get an instant AI score and tailored feedback.</p>
            <div className="mt-6"><ResumeUpload /></div>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatCard label="Total applications" value={apps.length} icon={Briefcase} tone="primary" />
            <StatCard label="Active" value={activeCount} icon={Sparkles} hint="Applied + interviewing" tone="info" />
            <StatCard label="Offers" value={offerCount} icon={Trophy} tone="success" />
            <StatCard label="Avg resume score" value={avgScore ?? "—"} icon={FileText} hint={`${scored.length} analyzed`} tone="accent" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <StatusDonut counts={counts} />
            <ActivityLine data={activity} />
          </div>
          <Card className="p-5">
            <h3 className="font-semibold mb-3">Recent activity</h3>
            {notifs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet — your activity will show up here.</p>
            ) : (
              <ul className="divide-y -mx-5">
                {notifs.map((n) => (
                  <li key={n.id} className="px-5 py-2.5 text-sm">
                    <span className="font-medium">{n.title}</span>
                    <span className="text-muted-foreground"> — {n.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
