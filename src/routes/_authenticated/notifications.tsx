import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — ResumeTracker AI" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Tables<"notifications">[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
      if (active) { setItems(data ?? []); setLoading(false); }
    })();
    const ch = supabase
      .channel(`notif-page:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        async () => {
          const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
          setItems(data ?? []);
        })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  async function markAll() {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  }

  async function open(n: Tables<"notifications">) {
    if (!n.is_read) await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    if (n.link_path) navigate({ to: n.link_path });
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto w-full space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">Live updates from your resumes and applications.</p>
        </div>
        {items.some((n) => !n.is_read) && (
          <Button variant="outline" onClick={markAll}><Check className="size-4" /> Mark all read</Button>
        )}
      </div>

      {loading ? <Skeleton className="h-64" /> :
        items.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="When your resume is analyzed or an application status changes, you'll see it here." />
        ) : (
          <Card className="divide-y overflow-hidden">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={cn("w-full text-left px-5 py-4 hover:bg-muted/50 transition-colors flex gap-3", !n.is_read && "bg-primary-soft/30")}
              >
                {!n.is_read && <div className="size-2 mt-1.5 rounded-full bg-primary shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                </div>
              </button>
            ))}
          </Card>
        )
      }
    </div>
  );
}
