/**
 * Deterministic resume normalizer — no AI, no network.
 *
 * Scans plain-text sections for objectively-wrong-or-noisy patterns and
 * proposes safe fixes. Each proposal references the section it came from
 * and carries before/after strings so the UI can show a per-item diff.
 */

export type ProposalKind =
  | "first_person"
  | "weak_opener"
  | "passive_voice"
  | "double_space"
  | "trailing_space"
  | "smart_quotes"
  | "em_dash"
  | "bullet_marker"
  | "bullet_capitalization"
  | "bullet_period"
  | "date_format"
  | "blank_lines"
  | "section_heading";

export interface NormalizerProposal {
  id: string;
  kind: ProposalKind;
  label: string;
  reason: string;
  sectionKey: string;
  before: string;
  after: string;
}

interface SectionLike {
  key: string;
  label: string;
  content: string;
}

const WEAK_OPENERS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^(\s*[-•*]\s*)(responsible for)\b/gim, reason: "'Responsible for' is passive filler. Lead with an action verb." },
  { pattern: /^(\s*[-•*]\s*)(tasked with)\b/gim, reason: "'Tasked with' is passive filler. Lead with the action verb." },
  { pattern: /^(\s*[-•*]\s*)(worked on)\b/gim, reason: "'Worked on' is vague. Lead with a concrete action verb." },
  { pattern: /^(\s*[-•*]\s*)(helped (?:to )?)/gim, reason: "'Helped to' weakens ownership. Lead with what you actually did." },
  { pattern: /^(\s*[-•*]\s*)(assisted (?:with |in )?)/gim, reason: "'Assisted with' weakens ownership. Lead with the action verb." },
  { pattern: /^(\s*[-•*]\s*)(duties included)\b[:,]?\s*/gim, reason: "'Duties included' is recruiter-noise filler. Drop it." },
];

const FIRST_PERSON = /\b(I|me|my|mine|we|us|our|ours)\b/g;

// e.g. "January 2020", "Sept 2019", "01/2020", "2020-01"
const DATE_LONG_MONTH = /\b(January|February|March|April|June|July|August|September|October|November|December)\s+(\d{4})\b/g;
const DATE_NUMERIC = /\b(0?[1-9]|1[0-2])[\/\-](\d{4})\b/g;
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const LONG_TO_SHORT: Record<string, string> = {
  January: "Jan", February: "Feb", March: "Mar", April: "Apr",
  June: "Jun", July: "Jul", August: "Aug", September: "Sep",
  October: "Oct", November: "Nov", December: "Dec",
};

const CANON_HEADINGS: Record<string, string> = {
  "professional summary": "SUMMARY",
  "career summary": "SUMMARY",
  "objective": "SUMMARY",
  "summary": "SUMMARY",
  "work experience": "EXPERIENCE",
  "professional experience": "EXPERIENCE",
  "employment history": "EXPERIENCE",
  "experience": "EXPERIENCE",
  "education": "EDUCATION",
  "academic background": "EDUCATION",
  "skills": "SKILLS",
  "technical skills": "SKILLS",
  "core competencies": "SKILLS",
  "projects": "PROJECTS",
  "personal projects": "PROJECTS",
  "certifications": "CERTIFICATIONS",
  "certificates": "CERTIFICATIONS",
};

let _id = 0;
const nextId = () => `p${++_id}_${Date.now().toString(36)}`;

/**
 * Run all deterministic detectors over the given sections.
 * Returns a flat array of proposals. Empty if the resume is already clean.
 */
export function detectIssues(sections: SectionLike[]): NormalizerProposal[] {
  const out: NormalizerProposal[] = [];

  for (const sec of sections) {
    const content = sec.content;
    if (!content || !content.trim()) continue;

    // --- whitespace / typography ---
    if (/  +/.test(content)) {
      out.push({
        id: nextId(),
        kind: "double_space",
        label: "Collapse double spaces",
        reason: "Multiple consecutive spaces inflate parsing noise.",
        sectionKey: sec.key,
        before: content,
        after: content.replace(/  +/g, " "),
      });
    }

    if (/[ \t]+$/m.test(content)) {
      out.push({
        id: nextId(),
        kind: "trailing_space",
        label: "Trim trailing whitespace",
        reason: "Trailing spaces can break some ATS line parsers.",
        sectionKey: sec.key,
        before: content,
        after: content.replace(/[ \t]+$/gm, ""),
      });
    }

    if (/[\u2018\u2019\u201C\u201D]/.test(content)) {
      out.push({
        id: nextId(),
        kind: "smart_quotes",
        label: "Replace smart quotes",
        reason: "Curly quotes (\u201C\u201D) sometimes encode incorrectly in ATS pipelines.",
        sectionKey: sec.key,
        before: content,
        after: content.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"'),
      });
    }

    if (/[\u2013\u2014]/.test(content)) {
      out.push({
        id: nextId(),
        kind: "em_dash",
        label: "Normalize em/en dashes",
        reason: "ASCII '-' is parsed consistently across all ATS systems.",
        sectionKey: sec.key,
        before: content,
        after: content.replace(/[\u2013\u2014]/g, "-"),
      });
    }

    if (/\n{3,}/.test(content)) {
      out.push({
        id: nextId(),
        kind: "blank_lines",
        label: "Collapse extra blank lines",
        reason: "More than one blank line in a row creates phantom sections.",
        sectionKey: sec.key,
        before: content,
        after: content.replace(/\n{3,}/g, "\n\n"),
      });
    }

    // --- bullet markers ---
    if (/^[\s]*[•*]\s+/m.test(content)) {
      out.push({
        id: nextId(),
        kind: "bullet_marker",
        label: "Standardize bullets to '-'",
        reason: "ASCII '-' bullets parse the most reliably across ATS engines.",
        sectionKey: sec.key,
        before: content,
        after: content.replace(/^([ \t]*)[•*]\s+/gm, "$1- "),
      });
    }

    // --- bullet capitalization ---
    const lowercaseBullets = content.match(/^[ \t]*[-•*]\s+[a-z]/gm);
    if (lowercaseBullets && lowercaseBullets.length > 0) {
      out.push({
        id: nextId(),
        kind: "bullet_capitalization",
        label: `Capitalize ${lowercaseBullets.length} bullet${lowercaseBullets.length === 1 ? "" : "s"}`,
        reason: "Each bullet should start with a capital letter.",
        sectionKey: sec.key,
        before: content,
        after: content.replace(
          /^([ \t]*[-•*]\s+)([a-z])/gm,
          (_m, prefix: string, ch: string) => prefix + ch.toUpperCase(),
        ),
      });
    }

    // --- bullet trailing periods (inconsistent) ---
    const bulletLines = content.match(/^[ \t]*[-•*]\s+.+$/gm) ?? [];
    if (bulletLines.length >= 3) {
      const withPeriod = bulletLines.filter((l) => /\.\s*$/.test(l)).length;
      const without = bulletLines.length - withPeriod;
      if (withPeriod > 0 && without > 0) {
        // Inconsistent. Prefer no trailing period (more common on resumes).
        out.push({
          id: nextId(),
          kind: "bullet_period",
          label: "Remove inconsistent trailing periods on bullets",
          reason: "Bullets should be either all-periods or none. Removing is more common.",
          sectionKey: sec.key,
          before: content,
          after: content.replace(/^([ \t]*[-•*]\s+.+?)\.\s*$/gm, "$1"),
        });
      }
    }

    // --- weak openers (one proposal per opener type per section) ---
    for (const { pattern, reason } of WEAK_OPENERS) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        pattern.lastIndex = 0;
        const after = content.replace(pattern, (_m, prefix: string) => prefix);
        if (after !== content) {
          out.push({
            id: nextId(),
            kind: "weak_opener",
            label: `Strip weak opener: "${pattern.source.match(/\(([^)]+)\)/g)?.[1]?.replace(/[()\\b]/g, "").replace(/\?:/g, "") ?? "filler"}"`,
            reason,
            sectionKey: sec.key,
            before: content,
            after,
          });
        }
      }
    }

    // --- first-person pronouns (only outside of contact section) ---
    if (sec.key !== "contact" && FIRST_PERSON.test(content)) {
      FIRST_PERSON.lastIndex = 0;
      const matches = content.match(FIRST_PERSON) ?? [];
      if (matches.length > 0) {
        out.push({
          id: nextId(),
          kind: "first_person",
          label: `Remove ${matches.length} first-person pronoun${matches.length === 1 ? "" : "s"}`,
          reason: "Resume convention drops 'I/me/my/we/our' — bullets are implicitly first-person.",
          sectionKey: sec.key,
          before: content,
          after: stripFirstPerson(content),
        });
      }
    }

    // --- date format normalization ---
    if (DATE_LONG_MONTH.test(content) || DATE_NUMERIC.test(content)) {
      let normalized = content.replace(
        DATE_LONG_MONTH,
        (_m, month: string, year: string) => `${LONG_TO_SHORT[month] ?? month.slice(0, 3)} ${year}`,
      );
      normalized = normalized.replace(
        DATE_NUMERIC,
        (_m, mo: string, year: string) => {
          const idx = parseInt(mo, 10) - 1;
          return `${SHORT_MONTHS[idx] ?? mo} ${year}`;
        },
      );
      // Also normalize "May 2020" (already short — no-op) but covered above.
      if (normalized !== content) {
        out.push({
          id: nextId(),
          kind: "date_format",
          label: "Standardize date format (e.g. 'Jan 2020')",
          reason: "Mixed date formats trip up ATS date-range parsers.",
          sectionKey: sec.key,
          before: content,
          after: normalized,
        });
      }
    }

    // --- non-standard section headings as first line ---
    const firstLine = content.split("\n", 1)[0]?.trim().toLowerCase() ?? "";
    if (firstLine && CANON_HEADINGS[firstLine] && firstLine !== CANON_HEADINGS[firstLine].toLowerCase()) {
      out.push({
        id: nextId(),
        kind: "section_heading",
        label: `Rename heading to '${CANON_HEADINGS[firstLine]}'`,
        reason: "Standard ATS-recognized section heading.",
        sectionKey: sec.key,
        before: content,
        after: content.replace(/^[^\n]+/, CANON_HEADINGS[firstLine]),
      });
    }
  }

  return out;
}

/**
 * Apply selected proposals to the section list in order, re-detecting
 * conflicts so later proposals operate on the already-fixed text.
 * Proposals on the same section compose by replacing the latest `content`.
 */
export function applyProposals(
  sections: SectionLike[],
  proposals: NormalizerProposal[],
  acceptedIds: Set<string>,
): SectionLike[] {
  const bySection = new Map<string, string>();
  for (const sec of sections) bySection.set(sec.key, sec.content);

  for (const p of proposals) {
    if (!acceptedIds.has(p.id)) continue;
    const current = bySection.get(p.sectionKey);
    if (current == null) continue;
    if (current === p.before) {
      bySection.set(p.sectionKey, p.after);
    } else {
      // Re-run the same transformation on the current (possibly mutated) text.
      const reapplied = reapply(p, current);
      bySection.set(p.sectionKey, reapplied);
    }
  }

  return sections.map((s) => ({ ...s, content: bySection.get(s.key) ?? s.content }));
}

function reapply(p: NormalizerProposal, current: string): string {
  switch (p.kind) {
    case "double_space":
      return current.replace(/  +/g, " ");
    case "trailing_space":
      return current.replace(/[ \t]+$/gm, "");
    case "smart_quotes":
      return current.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
    case "em_dash":
      return current.replace(/[\u2013\u2014]/g, "-");
    case "blank_lines":
      return current.replace(/\n{3,}/g, "\n\n");
    case "bullet_marker":
      return current.replace(/^([ \t]*)[•*]\s+/gm, "$1- ");
    case "bullet_capitalization":
      return current.replace(/^([ \t]*[-•*]\s+)([a-z])/gm, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
    case "bullet_period":
      return current.replace(/^([ \t]*[-•*]\s+.+?)\.\s*$/gm, "$1");
    case "first_person":
      return stripFirstPerson(current);
    case "date_format": {
      let out = current.replace(DATE_LONG_MONTH, (_m, month: string, year: string) => `${LONG_TO_SHORT[month] ?? month.slice(0, 3)} ${year}`);
      out = out.replace(DATE_NUMERIC, (_m, mo: string, year: string) => {
        const idx = parseInt(mo, 10) - 1;
        return `${SHORT_MONTHS[idx] ?? mo} ${year}`;
      });
      return out;
    }
    case "weak_opener": {
      let out = current;
      for (const { pattern } of WEAK_OPENERS) {
        pattern.lastIndex = 0;
        out = out.replace(pattern, (_m, prefix: string) => prefix);
      }
      return out;
    }
    case "section_heading": {
      const firstLine = current.split("\n", 1)[0]?.trim().toLowerCase() ?? "";
      const canon = CANON_HEADINGS[firstLine];
      return canon ? current.replace(/^[^\n]+/, canon) : current;
    }
    default:
      return p.after;
  }
}

function stripFirstPerson(text: string): string {
  // Replace pronouns while preserving sentence structure. Drop the pronoun
  // and a following single space; collapse leftover double spaces.
  return text
    .replace(/\b(I|me|my|mine|we|us|our|ours)\s+/g, "")
    .replace(/\s+\b(I|me|my|mine|we|us|our|ours)\b/g, "")
    .replace(/  +/g, " ");
}
