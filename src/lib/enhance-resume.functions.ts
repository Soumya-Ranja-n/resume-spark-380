import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StartInput = z.object({
  resume_id: z.string().uuid(),
  job_description: z.string().max(20000).optional().nullable(),
});

const ListInput = z.object({ resume_id: z.string().uuid() });
const GetInput = z.object({ id: z.string().uuid() });

const SYSTEM_PROMPT = `You are an expert ATS (Applicant Tracking System) resume reviewer.

You will score a resume against this EXACT weighted rubric (100 points total). Do not invent your own rubric or weights.

PARSEABILITY (30 pts):
- File format compatibility (5): .docx or text-based PDF good; scanned/image PDFs bad.
- Avoid multi-column/table layouts (6): single-column linear flow.
- No critical info in headers/footers (4).
- Standard section headings (6): "Experience","Education","Skills" not "My Journey".
- No graphics-only skill representations (5): no skill bars/stars as the only signal.
- Standard readable fonts (4): Arial/Calibri/Times/Helvetica/Georgia.

KEYWORD MATCH (30 pts):
If a job description is provided, first extract its required/preferred skills, then score:
- Hard-skill overlap (12), job title alignment (6), natural keyword density (6) — reward 2-4 natural mentions in context; flag 10+ repetitions as stuffing, acronym + full-form pairing (6).
If NO job description is provided, score generically against common skills for the resume's apparent field and explicitly lower confidence on this category (mention it in an issue).

CONTENT QUALITY (20 pts):
- % bullets with quantified metrics/numbers (8).
- Bullets starting with strong action verbs, not passive phrases (6).
- Bullet length 15-25 words avoiding walls of text (3).
- Absence of first-person pronouns "I"/"my" (3).

STRUCTURE & COMPLETENESS (15 pts):
- All required sections present — contact, summary, experience, education, skills (6).
- Reverse chronological order (3).
- Consistent date formatting (3).
- Complete contact info including LinkedIn (3).

LENGTH (5 pts):
- 1 page for under 5 years experience, max 2 pages beyond that (5).

CRITICAL GUARDRAIL — NEVER invent or suggest fabricated experience, skills, or metrics the candidate did not have. If a keyword is missing, phrase the fix as "consider adding this if you have relevant experience" or suggest rephrasing EXISTING experience to surface a skill that may already be present but unstated. NEVER instruct the user to claim something false on their resume.

For every point lost there must be at least one corresponding issue with a specific fix. Sort issues high → low severity. Provide 3-8 rewrite_suggestions that take REAL bullets from the resume and improve them (stronger verb, quantified, natural keyword placement) without fabricating outcomes.

Return ONLY a JSON object matching this exact shape:
{
  "overall_score": number,
  "category_scores": { "parseability": number, "keyword_match": number, "content_quality": number, "structure": number, "length": number },
  "issues": [{ "category": "parseability"|"keyword_match"|"content_quality"|"structure"|"length", "severity": "high"|"medium"|"low", "issue": string, "fix": string, "section": string }],
  "rewrite_suggestions": [{ "original": string, "improved": string, "reasoning": string }],
  "missing_keywords": [string],
  "keyword_stuffing_warnings": [string]
}`;

interface EnhancementResult {
  overall_score: number;
  category_scores: {
    parseability: number;
    keyword_match: number;
    content_quality: number;
    structure: number;
    length: number;
  };
  issues: Array<{ category: string; severity: string; issue: string; fix: string; section: string }>;
  rewrite_suggestions: Array<{ original: string; improved: string; reasoning: string }>;
  missing_keywords: string[];
  keyword_stuffing_warnings: string[];
}

export const startEnhancement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: resume, error: rErr } = await supabase
      .from("resumes")
      .select("id, title, file_url, file_name, user_id")
      .eq("id", data.resume_id)
      .single();
    if (rErr || !resume) throw new Error("Resume not found");

    const jobDescription = (data.job_description ?? "").trim() || null;
    const mode = jobDescription ? "targeted" : "general";

    const { data: row, error: insErr } = await supabase
      .from("resume_enhancements")
      .insert({
        resume_id: resume.id,
        user_id: userId,
        job_description: jobDescription,
        mode,
        status: "processing",
      })
      .select("id")
      .single();
    if (insErr || !row) throw new Error(insErr?.message ?? "Failed to create enhancement");

    const enhancementId = row.id;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: file, error: dlErr } = await supabaseAdmin.storage
        .from("resumes")
        .download(resume.file_url);
      if (dlErr || !file) throw new Error(dlErr?.message ?? "Failed to download resume");

      const buffer = await file.arrayBuffer();
      const { extractText } = await import("./pdf-extract.server");
      const text = (await extractText(buffer, resume.file_name)).slice(0, 18000);
      if (!text.trim()) throw new Error("Could not extract any text from this file.");

      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

      const userContent = jobDescription
        ? `JOB DESCRIPTION (target role — extract required/preferred skills from this before scoring keyword_match):\n${jobDescription}\n\n---\n\nRESUME ("${resume.title}"):\n${text}`
        : `No job description provided — score in GENERAL mode (lower confidence on keyword_match, surface this as an issue suggesting the user paste a JD).\n\nRESUME ("${resume.title}"):\n${text}`;

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
            { role: "user", content: userContent },
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
      let result: EnhancementResult;
      try {
        result = JSON.parse(content);
      } catch {
        throw new Error("AI returned non-JSON response");
      }

      const cs = result.category_scores ?? ({} as EnhancementResult["category_scores"]);
      const category_scores = {
        parseability: clamp(cs.parseability, 30),
        keyword_match: clamp(cs.keyword_match, 30),
        content_quality: clamp(cs.content_quality, 20),
        structure: clamp(cs.structure, 15),
        length: clamp(cs.length, 5),
      };
      const overall =
        typeof result.overall_score === "number"
          ? Math.max(0, Math.min(100, Math.round(result.overall_score)))
          : Object.values(category_scores).reduce((a, b) => a + b, 0);

      const { error: updErr } = await supabase
        .from("resume_enhancements")
        .update({
          status: "completed",
          overall_score: overall,
          category_scores,
          issues: result.issues ?? [],
          rewrite_suggestions: result.rewrite_suggestions ?? [],
          missing_keywords: result.missing_keywords ?? [],
          keyword_stuffing_warnings: result.keyword_stuffing_warnings ?? [],
        })
        .eq("id", enhancementId);
      if (updErr) throw new Error(updErr.message);

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "resume_analyzed",
        title: "ATS analysis ready",
        message: `"${resume.title}" scored ${overall}/100`,
        link_path: `/resumes/${resume.id}/enhance`,
      });

      return { ok: true, enhancement_id: enhancementId, overall_score: overall };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Enhancement failed";
      await supabase
        .from("resume_enhancements")
        .update({ status: "failed", error_message: message })
        .eq("id", enhancementId);
      throw new Error(message);
    }
  });

function clamp(v: unknown, max: number): number {
  const n = typeof v === "number" ? v : 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

export const listEnhancements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("resume_enhancements")
      .select("*")
      .eq("resume_id", data.resume_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getEnhancement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("resume_enhancements")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
