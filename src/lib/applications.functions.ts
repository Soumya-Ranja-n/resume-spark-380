import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StatusEnum = z.enum(["saved", "applied", "interviewing", "offer", "rejected", "withdrawn"]);

const CreateInput = z.object({
  company_name: z.string().min(1),
  job_title: z.string().min(1),
  job_url: z.string().url().nullable().optional(),
  status: StatusEnum.default("saved"),
  applied_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  resume_id: z.string().uuid().nullable().optional(),
});

const UpdateInput = CreateInput.partial().extend({ id: z.string().uuid() });

const StatusInput = z.object({ id: z.string().uuid(), status: StatusEnum });

export const createApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("job_applications")
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("job_applications")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prev } = await supabase
      .from("job_applications")
      .select("status, company_name, job_title")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    const { data: row, error } = await supabase
      .from("job_applications")
      .update({
        status: data.status,
        applied_date: data.status === "applied" && !prev ? new Date().toISOString().slice(0, 10) : undefined,
      })
      .eq("id", data.id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (prev && prev.status !== data.status) {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "job_status_changed",
        title: `Moved to ${data.status}`,
        message: `${prev.job_title} @ ${prev.company_name} → ${data.status}`,
        link_path: "/applications",
      });
    }
    return row;
  });

export const deleteApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("job_applications").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
