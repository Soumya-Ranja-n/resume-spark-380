import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SectionInput = z.object({
  section_label: z.string().min(1).max(60),
  content: z.string().min(10).max(8000),
  job_description: z.string().max(20000).optional().nullable(),
});

const KeywordInjectInput = z.object({
  missing_keywords: z.array(z.string().min(1).max(80)).min(1).max(30),
  sections: z
    .array(z.object({ key: z.string(), label: z.string(), content: z.string() }))
    .min(1)
    .max(10),
  job_description: z.string().max(20000).optional().nullable(),
});

const SECTION_PROMPT = `You rewrite a single resume section for ATS readability WITHOUT fabricating any content. You receive the section label, the section text, and (optionally) a target job description.

ABSOLUTE RULES:
- Do NOT invent skills, tools, employers, titles, dates, degrees, metrics, or accomplishments.
- You MAY: tighten wording, lead bullets with strong action verbs, drop first-person pronouns, normalize dates to 'MMM YYYY', standardize bullets to '- ', remove filler ('Responsible for', 'Tasked with', 'Duties included'), split run-on bullets, and ensure bullets are 15-25 words when source content allows.
- Preserve identity: same employers, same dates, same titles, same projects, same metrics. ONLY the wording changes.
- If the job description is provided, prefer existing phrasing that aligns with it — do NOT add skills the source does not mention.

OUTPUT: return ONLY valid JSON, no markdown:
{
  "rewritten": "the full rewritten section text, plain text with '- ' bullets when appropriate",
  "changes": ["short bullet describing each meaningful change, max 6 items"]
}`;

const KEYWORD_PROMPT = `You help integrate missing job-description keywords into a resume WITHOUT fabricating experience. You receive a list of missing keywords, the resume sections, and (optionally) the target job description.

ABSOLUTE RULES — READ CAREFULLY:
- For each missing keyword, decide if the user's EXISTING resume already describes related work that could legitimately mention that keyword. If yes, propose a rewrite of ONE specific existing bullet that naturally incorporates the keyword.
- If the resume contains NO evidence the user has experience with the keyword, do NOT propose an injection for that keyword. Skip it entirely. Returning fewer suggestions is correct.
- Never invent new bullets, new responsibilities, or new technologies. You only REWRITE existing bullets.
- The 'original' field MUST be a substring that appears in the section content verbatim (so the UI can locate and replace it). Copy whole-bullet text including the leading '- ' if present.

OUTPUT: return ONLY valid JSON, no markdown:
{
  "suggestions": [
    {
      "keyword": "the missing keyword",
      "section_key": "experience"|"summary"|"skills"|"projects"|"other",
      "original": "exact existing bullet text from the resume",
      "improved": "rewritten bullet that naturally incorporates the keyword",
      "reasoning": "1-sentence why this user's existing work legitimately involves this keyword"
    }
  ]
}`;

/** Per-section AI rewrite. No fabrication, identity-preserving. */
export const autoFixSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SectionInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const jd = (data.job_description ?? "").trim();
    const userContent = [
      `SECTION: ${data.section_label.toUpperCase()}`,
      jd ? `\nTARGET JOB DESCRIPTION:\n${jd}` : "",
      `\nCURRENT SECTION CONTENT:\n${data.content}`,
    ].join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SECTION_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      if (resp.status === 429) throw new Error("AI rate limit reached. Try again in a minute.");
      if (resp.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      throw new Error(`AI error ${resp.status}: ${err.slice(0, 200)}`);
    }

    const json = await resp.json();
    const raw: string = json.choices?.[0]?.message?.content ?? "";
    let parsed: { rewritten?: string; changes?: string[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI returned non-JSON response");
    }
    const rewritten = (parsed.rewritten ?? "").trim();
    if (!rewritten) throw new Error("AI returned empty rewrite");
    return {
      rewritten,
      changes: Array.isArray(parsed.changes) ? parsed.changes.slice(0, 6) : [],
    };
  });

/** Targeted keyword injection — proposes rewriting EXISTING bullets to surface missing JD keywords the user already has experience with. */
export const suggestKeywordInjections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => KeywordInjectInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const jd = (data.job_description ?? "").trim();
    const sectionsText = data.sections
      .filter((s) => s.content.trim().length > 0)
      .map((s) => `[${s.key.toUpperCase()}]\n${s.content}`)
      .join("\n\n");

    const userContent = [
      `MISSING KEYWORDS:\n${data.missing_keywords.map((k) => `- ${k}`).join("\n")}`,
      jd ? `\nTARGET JOB DESCRIPTION:\n${jd}` : "",
      `\nRESUME SECTIONS:\n${sectionsText}`,
    ].join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: KEYWORD_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      if (resp.status === 429) throw new Error("AI rate limit reached. Try again in a minute.");
      if (resp.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      throw new Error(`AI error ${resp.status}: ${err.slice(0, 200)}`);
    }

    const json = await resp.json();
    const raw: string = json.choices?.[0]?.message?.content ?? "";
    let parsed: {
      suggestions?: Array<{
        keyword: string;
        section_key: string;
        original: string;
        improved: string;
        reasoning: string;
      }>;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI returned non-JSON response");
    }
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 20) : [];
    // Filter to suggestions whose `original` actually appears verbatim in a section.
    const validated = suggestions.filter((s) => {
      const sec = data.sections.find((x) => x.key === s.section_key);
      return sec && s.original && sec.content.includes(s.original) && s.improved && s.improved !== s.original;
    });
    return { suggestions: validated };
  });
