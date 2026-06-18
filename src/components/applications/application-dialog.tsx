import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createApplication, updateApplication, deleteApplication } from "@/lib/applications.functions";
import type { Tables } from "@/integrations/supabase/types";

type Application = Tables<"job_applications">;
type Resume = Pick<Tables<"resumes">, "id" | "title">;

const Schema = z.object({
  company_name: z.string().min(1, "Required"),
  job_title: z.string().min(1, "Required"),
  job_url: z.string().url().or(z.literal("")).optional(),
  status: z.enum(["saved", "applied", "interviewing", "offer", "rejected", "withdrawn"]),
  applied_date: z.string().optional(),
  notes: z.string().optional(),
  resume_id: z.string().optional(),
});
type FormVals = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  application?: Application | null;
  resumes: Resume[];
  defaultStatus?: Application["status"];
  onSaved?: () => void;
}

export function ApplicationDialog({ open, onOpenChange, application, resumes, defaultStatus, onSaved }: Props) {
  const create = useServerFn(createApplication);
  const update = useServerFn(updateApplication);
  const del = useServerFn(deleteApplication);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormVals>({
    resolver: zodResolver(Schema),
    values: application
      ? {
          company_name: application.company_name,
          job_title: application.job_title,
          job_url: application.job_url ?? "",
          status: application.status,
          applied_date: application.applied_date ?? "",
          notes: application.notes ?? "",
          resume_id: application.resume_id ?? "",
        }
      : {
          company_name: "", job_title: "", job_url: "",
          status: defaultStatus ?? "saved", applied_date: "", notes: "", resume_id: "",
        },
  });

  async function onSubmit(vals: FormVals) {
    setSubmitting(true);
    try {
      const payload = {
        ...vals,
        job_url: vals.job_url || null,
        applied_date: vals.applied_date || null,
        notes: vals.notes || null,
        resume_id: vals.resume_id || null,
      };
      if (application) {
        await update({ data: { id: application.id, ...payload } });
        toast.success("Application updated");
      } else {
        await create({ data: payload });
        toast.success("Application saved");
      }
      onOpenChange(false);
      onSaved?.();
      form.reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!application || !confirm("Delete this application?")) return;
    setSubmitting(true);
    try {
      await del({ data: { id: application.id } });
      toast.success("Deleted");
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{application ? "Edit application" : "Add application"}</DialogTitle>
          <DialogDescription>Track a role you're interested in or applying to.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input id="company" {...form.register("company_name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Role</Label>
              <Input id="title" {...form.register("job_title")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="url">Job link (optional)</Label>
            <Input id="url" type="url" placeholder="https://…" {...form.register("job_url")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as FormVals["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="saved">Saved</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="interviewing">Interviewing</SelectItem>
                  <SelectItem value="offer">Offer</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="applied">Applied date</Label>
              <Input id="applied" type="date" {...form.register("applied_date")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Linked resume</Label>
            <Select value={form.watch("resume_id") || "__none"} onValueChange={(v) => form.setValue("resume_id", v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None</SelectItem>
                {resumes.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} {...form.register("notes")} />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {application && (
              <Button type="button" variant="outline" onClick={handleDelete} disabled={submitting} className="mr-auto text-destructive">
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />} {application ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
