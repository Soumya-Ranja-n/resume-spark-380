import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AnalyzeInput = z.object({ resume_id: z.string().uuid() });

const SYSTEM_PROMPT = `You are an expert career coach and resume reviewer.
Analyze the resume text the user provides and return ONLY a JSON object with this exact shape:
{
  "score": number (0-100, integer; how strong this resume is for a competitive role),
  "strengths": string[] (3-6 concise bullets, each <= 18 words),
  "weaknesses": string[] (3-6 concise bullets, each <= 18 words),
  "suggestions": string[] (3-6 actionable, specific suggestions, each <= 22 words),
  "missing_keywords": string[] (5-12 keywords/skills commonly expected but missing)
}
Be honest and specific. Do not include any prose outside the JSON.`;

interface AiFeedback {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  missing_keywords: string[];
}

export const analyzeResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Mark as analyzing
    const { data: resume, error: fetchErr } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", data.resume_id)
      .eq("user_id", userId)
      .single();
    if (fetchErr || !resume) throw new Error("Resume not found");

    await supabase
      .from("resumes")
      .update({ status: "analyzing", ai_score: null, ai_feedback: null })
      .eq("id", data.resume_id);

    try {
      // Download file via service role (server-only)
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: file, error: dlErr } = await supabaseAdmin.storage
        .from("resumes")
        .download(resume.file_url);
      if (dlErr || !file) throw new Error(dlErr?.message ?? "Failed to download resume");

      const buffer = await file.arrayBuffer();
      const { extractText } = await import("./pdf-extract.server");
      const text = (await extractText(buffer, resume.file_name)).slice(0, 18000);

      if (!text.trim()) throw new Error("Could not extract any text from this file.");

      // Call Lovable AI Gateway
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Resume titled "${resume.title}":\n\n${text}` },
          ],
        }),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text().catch(() => "");
        if (aiResp.status === 429) throw new Error("AI rate limit reached. Try again in a minute.");
        if (aiResp.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
        throw new Error(`AI error ${aiResp.status}: ${errText.slice(0, 200)}`);
      }

      const json = await aiResp.json();
      const content: string = json.choices?.[0]?.message?.content ?? "";
      let feedback: AiFeedback;
      try {
        feedback = JSON.parse(content);
      } catch {
        throw new Error("AI returned non-JSON response");
      }

      const score = Math.max(0, Math.min(100, Math.round(feedback.score ?? 0)));

      await supabase
        .from("resumes")
        .update({
          status: "analyzed",
          ai_score: score,
          ai_feedback: feedback as unknown as Record<string, unknown>,
        })
        .eq("id", data.resume_id);

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "resume_analyzed",
        title: "Resume analyzed",
        message: `"${resume.title}" scored ${score}/100`,
        link_path: `/resumes/${resume.id}`,
      });

      return { ok: true, score };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      await supabase
        .from("resumes")
        .update({
          status: "failed",
          ai_feedback: { error: message } as unknown as Record<string, unknown>,
        })
        .eq("id", data.resume_id);
      throw new Error(message);
    }
  });

const DeleteInput = z.object({ resume_id: z.string().uuid() });

export const deleteResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase
      .from("resumes")
      .select("file_url")
      .eq("id", data.resume_id)
      .eq("user_id", userId)
      .single();
    if (r?.file_url) {
      await supabase.storage.from("resumes").remove([r.file_url]);
    }
    await supabase.from("resumes").delete().eq("id", data.resume_id);
    return { ok: true };
  });
