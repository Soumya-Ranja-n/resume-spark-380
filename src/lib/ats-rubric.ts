export type CategoryKey =
  | "parseability"
  | "keyword_match"
  | "content_quality"
  | "structure"
  | "length";

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  max: number;
  description: string;
}

export const CATEGORY_META: Record<CategoryKey, CategoryMeta> = {
  parseability: {
    key: "parseability",
    label: "Parseability",
    max: 30,
    description:
      "Whether ATS software can actually read the resume — file format, single-column layout, standard section headings, fonts, no graphics-only skill bars, contact info in the body (not header/footer).",
  },
  keyword_match: {
    key: "keyword_match",
    label: "Keyword Match",
    max: 30,
    description:
      "Hard-skill overlap with the target role, job-title alignment, natural keyword density (no stuffing), and acronym + full-form pairing. Most accurate when a job description is provided.",
  },
  content_quality: {
    key: "content_quality",
    label: "Content Quality",
    max: 20,
    description:
      "Quantified achievements, action-verb-led bullets, appropriate bullet length (15-25 words), and no first-person pronouns.",
  },
  structure: {
    key: "structure",
    label: "Structure",
    max: 15,
    description:
      "All required sections present, reverse chronological order, consistent date formatting, and complete contact info including LinkedIn.",
  },
  length: {
    key: "length",
    label: "Length",
    max: 5,
    description:
      "1 page if under 5 years experience, max 2 pages beyond that. Penalty for 3+ pages or a half-empty single page.",
  },
};

export const CATEGORY_ORDER: CategoryKey[] = [
  "parseability",
  "keyword_match",
  "content_quality",
  "structure",
  "length",
];

export interface ScoreBand {
  min: number;
  label: string;
  tone: "green" | "amber" | "orange" | "red";
  hex: string;
  blurb: string;
}

export const SCORE_BANDS: ScoreBand[] = [
  { min: 85, label: "Strong ATS compatibility", tone: "green", hex: "#10b981", blurb: "Your resume parses cleanly and matches the role well. Final polish only." },
  { min: 65, label: "Good, with room to improve", tone: "amber", hex: "#f59e0b", blurb: "Solid foundation. Apply the high-severity fixes below for a real boost." },
  { min: 40, label: "Needs significant revision", tone: "orange", hex: "#f97316", blurb: "Several parsing or content gaps are likely hurting your callbacks." },
  { min: 0, label: "High risk of being filtered out", tone: "red", hex: "#ef4444", blurb: "An ATS may struggle to extract your experience. Start with the high-severity issues." },
];

export function bandFor(score: number): ScoreBand {
  return SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}

export const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
export type Severity = keyof typeof SEVERITY_ORDER;

export interface EnhancementIssue {
  category: CategoryKey | string;
  severity: Severity;
  issue: string;
  fix: string;
  section: string;
}

export interface RewriteSuggestion {
  original: string;
  improved: string;
  reasoning: string;
}

export interface CategoryScores {
  parseability: number;
  keyword_match: number;
  content_quality: number;
  structure: number;
  length: number;
}
