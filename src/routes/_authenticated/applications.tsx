import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Briefcase, LayoutGrid, Rows } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { KanbanBoard } from "@/components/applications/kanban-board";
import { ApplicationDialog } from "@/components/applications/application-dialog";
import { updateApplicationStatus } from "@/lib/applications.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({ meta: [{ title: "Applications — ResumeTracker AI" }] }),
  component: ApplicationsPage,
});

type App = Tables<"job_applications">;

function ApplicationsPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<App[]>([]);
  const [resumes, setResumes] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<App | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<App["status"] | undefined>();
  const updateStatus = useServerFn(updateApplicationStatus);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [a, r] = await Promise.all([
        supabase.from("job_applications").select("*").order("updated_at", { ascending: false }),
        supabase.from("resumes").select("id, title").order("created_at", { ascending: false }),
      ]);
      if (active) { setApps(a.data ?? []); setResumes(r.data ?? []); setLoading(false); }
    })();
    const ch = supabase
      .channel(`apps:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_applications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") setApps((p) => [payload.new as App, ...p]);
          else if (payload.eventType === "UPDATE") setApps((p) => p.map((a) => a.id === (payload.new as App).id ? payload.new as App : a));
          else if (payload.eventType === "DELETE") setApps((p) => p.filter((a) => a.id !== (payload.old as App).id));
        })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  async function handleStatusChange(id: string, status: App["status"]) {
    setApps((p) => p.map((a) => a.id === id ? { ...a, status } : a)); // optimistic
    try { await updateStatus({ data: { id, status } }); }
    catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      const { data } = await supabase.from("job_applications").select("*").order("updated_at", { ascending: false });
      setApps(data ?? []);
    }
  }

  function openAdd(status?: App["status"]) {
    setEditing(null);
    setDefaultStatus(status);
    setDialogOpen(true);
  }
  function openEdit(app: App) { setEditing(app); setDialogOpen(true); }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Applications</h1>
          <p className="text-muted-foreground text-sm mt-1">Drag cards across columns to update their status.</p>
        </div>
        <Button onClick={() => openAdd()}><Plus className="size-4" /> Add application</Button>
      </div>

      {loading ? (
        <Skeleton className="h-96" />
      ) : apps.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No applications yet"
          description="Track every role you're interested in. Drag cards between columns as your status changes."
          action={<Button onClick={() => openAdd()}><Plus className="size-4" /> Add your first application</Button>}
        />
      ) : (
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban"><LayoutGrid className="size-3.5" /> Board</TabsTrigger>
            <TabsTrigger value="table"><Rows className="size-3.5" /> Table</TabsTrigger>
          </TabsList>
          <TabsContent value="kanban" className="mt-4">
            <KanbanBoard
              applications={apps}
              onCardClick={openEdit}
              onAdd={openAdd}
              onStatusChange={handleStatusChange}
            />
          </TabsContent>
          <TabsContent value="table" className="mt-4">
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => openEdit(a)}>
                      <TableCell className="font-medium">{a.company_name}</TableCell>
                      <TableCell>{a.job_title}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{a.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{a.applied_date ? format(new Date(a.applied_date), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">Edit</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <ApplicationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        application={editing}
        resumes={resumes}
        defaultStatus={defaultStatus}
      />
    </div>
  );
}
