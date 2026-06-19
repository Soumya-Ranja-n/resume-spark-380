import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StartInput = z.object({
  resume_id: z.string().uuid(),
  job_description: z.string().max(20000).optional().nullable(),
  edited_text: z.string().max(40000).optional().nullable(),
});

const ListInput = z.object({ resume_id: z.string().uuid() });
const GetInput = z.object({ id: z.string().uuid() });
const SaveDraftInput = z.object({
  resume_id: z.string().uuid(),
  edited_text: z.string().max(40000),
});
const GetTextInput = z.object({ resume_id: z.string().uuid() });
const AutoEnhanceInput = z.object({
  resume_id: z.string().uuid(),
  current_text: z.string().min(20).max(40000),
  job_description: z.string().max(20000).optional().nullable(),
});

const SYSTEM_PROMPT = `You are an ATS resume scoring assistant. Score the following resume text against the provided rubric. Your output MUST be valid JSON with no markdown formatting, no code fences, no preamble, and no explanation outside the JSON object.

ABSOLUTE RULE — NO FABRICATION: You must NEVER suggest the user add skills, certifications, tools, metrics, job titles, or experience they have not demonstrated in the resume text provided. Every suggested fix must either: (a) rephrase existing content into stronger language, (b) add a metric that is plausible from context and marked with a note like 'if you have this data, add it here', or (c) be phrased conditionally as 'if you have experience with X, consider adding it here.' Violating this rule undermines the user's integrity and your usefulness.

Score using this weighted rubric:
PARSEABILITY (30 pts): single-column layout readable without special parsers (6), standard section headings not creative/abstract ones (6), no tables or text boxes for layout (5), no graphics/icons as the sole representation of info (5), standard fonts implied by clean formatting (4), contact info not hidden in headers/footers (4).
KEYWORD MATCH (30 pts): if job_description provided — hard skill overlap with JD required/preferred skills (12), job title relevance to target role (6), natural keyword density 2-4 mentions in context without stuffing (6), acronym and full-form pairing for technical terms (6). If no job_description — score generically against common skills for the resume's apparent field, label as lower-confidence.
CONTENT QUALITY (20 pts): % of experience bullets with quantified metrics (8), action-verb-led bullets not passive openers like 'responsible for' (6), bullet length 15-25 words (3), no first-person pronouns (3).
STRUCTURE (15 pts): all required sections present (6), reverse chronological order (3), consistent date formatting (3), complete contact info including LinkedIn (3).
LENGTH (5 pts): 1 page under 5 years experience, max 2 pages otherwise (5).

For every issue, "section" MUST be one of: "contact", "summary", "experience", "education", "skills", "other".

Return ONLY this JSON object, nothing else:
{
  "overall_score": number,
  "category_scores": { "parseability": number, "keyword_match": number, "content_quality": number, "structure": number, "length": number },
  "issues": [{ "category": "parseability"|"keyword_match"|"content_quality"|"structure"|"length", "severity": "high"|"medium"|"low", "issue": string, "fix": string, "section": "contact"|"summary"|"experience"|"education"|"skills"|"other" }],
  "rewrite_suggestions": [{ "original": string, "improved": string, "reasoning": string }],
  "missing_keywords": [string],
  "keyword_stuffing_warnings": [string],
  "score_ceiling_note": string | null
}

score_ceiling_note: if the resume content is genuinely thin (very short, very few accomplishments) such that no editing-without-fabrication can realistically reach 80, set this to a plain honest explanation like 'With limited experience listed, the realistic honest ceiling for this resume is around 65-70. Focus on adding genuine accomplishments and context before targeting 80+.' Otherwise set it to null.`;

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
  score_ceiling_note: string | null;
}

export const startEnhancement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: resume, error: rErr } = await supabase
      .from("resumes")
      .select("id, title, file_url, file_name, user_id, edited_text")
      .eq("id", data.resume_id)
      .single();
    if (rErr || !resume) throw new Error("Resume not found");

    const jobDescription = (data.job_description ?? "").trim() || null;
    const mode = jobDescription ? "targeted" : "general";
    const editedText = (data.edited_text ?? "").trim() || null;
    const source = editedText ? "edited" : "file";

    const { data: row, error: insErr } = await supabase
      .from("resume_enhancements")
      .insert({
        resume_id: resume.id,
        user_id: userId,
        job_description: jobDescription,
        mode,
        status: "processing",
        source,
      })
      .select("id")
      .single();
    if (insErr || !row) throw new Error(insErr?.message ?? "Failed to create enhancement");

    const enhancementId = row.id;

    try {
      let text: string;
      if (editedText) {
        text = editedText.slice(0, 18000);
      } else {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: file, error: dlErr } = await supabaseAdmin.storage
          .from("resumes")
          .download(resume.file_url);
        if (dlErr || !file) throw new Error(dlErr?.message ?? "Failed to download resume");
        const buffer = await file.arrayBuffer();
        const { extractText } = await import("./pdf-extract.server");
        text = (await extractText(buffer, resume.file_name)).slice(0, 18000);
      }
      if (!text.trim()) throw new Error("No resume text to score.");

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
          score_ceiling_note: result.score_ceiling_note ?? null,
        })
        .eq("id", enhancementId);
      if (updErr) throw new Error(updErr.message);

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "resume_analyzed",
        title: "ATS analysis ready",
        message: `"${resume.title}" scored ${overall}/100`,
        link_path: `/resume-enhancer/${resume.id}`,
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

/** Save the user's edited resume text as a draft. */
export const saveEditedResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveDraftInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("resumes")
      .update({
        edited_text: data.edited_text,
        edited_text_updated_at: new Date().toISOString(),
      })
      .eq("id", data.resume_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Get the source text to load into the editor: edited draft if present, else extracted from file. */
export const getResumeText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetTextInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: resume, error } = await supabase
      .from("resumes")
      .select("id, title, file_url, file_name, edited_text, edited_text_updated_at")
      .eq("id", data.resume_id)
      .single();
    if (error || !resume) throw new Error("Resume not found");

    if (resume.edited_text && resume.edited_text.trim()) {
      return {
        text: resume.edited_text,
        source: "edited" as const,
        edited_text_updated_at: resume.edited_text_updated_at,
        title: resume.title,
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("resumes")
      .download(resume.file_url);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "Failed to download resume");
    const buffer = await file.arrayBuffer();
    const { extractText } = await import("./pdf-extract.server");
    const text = await extractText(buffer, resume.file_name);
    return {
      text,
      source: "file" as const,
      edited_text_updated_at: null,
      title: resume.title,
    };
  });
