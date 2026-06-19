/**
 * Heuristic section splitter for resume plain text.
 * Detects common headings and groups content under canonical section keys.
 */
export type SectionKey =
  | "contact"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "other";

export interface ResumeSection {
  key: SectionKey;
  label: string;
  content: string;
}

export const SECTION_ORDER: SectionKey[] = [
  "contact",
  "summary",
  "experience",
  "education",
  "skills",
  "other",
];

export const SECTION_LABEL: Record<SectionKey, string> = {
  contact: "Contact",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  other: "Other",
};

const HEADING_MAP: Array<{ pattern: RegExp; key: SectionKey }> = [
  { pattern: /^(summary|profile|objective|about)\b/i, key: "summary" },
  { pattern: /^(experience|work experience|professional experience|employment( history)?|work history)\b/i, key: "experience" },
  { pattern: /^(education|academic background|qualifications)\b/i, key: "education" },
  { pattern: /^(skills|technical skills|core competencies|tech stack|technologies)\b/i, key: "skills" },
  { pattern: /^(projects|certifications|awards|publications|volunteer|languages|interests|references)\b/i, key: "other" },
];

function detectHeading(line: string): SectionKey | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 60) return null;
  // Heading-ish: short line, mostly letters, no terminal period
  if (/[.!?]$/.test(trimmed)) return null;
  for (const { pattern, key } of HEADING_MAP) {
    if (pattern.test(trimmed)) return key;
  }
  return null;
}

export function splitIntoSections(rawText: string): ResumeSection[] {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const buckets: Record<SectionKey, string[]> = {
    contact: [],
    summary: [],
    experience: [],
    education: [],
    skills: [],
    other: [],
  };

  // First non-empty lines until a recognized heading -> contact
  let current: SectionKey = "contact";
  let seenHeading = false;

  for (const line of lines) {
    const heading = detectHeading(line);
    if (heading) {
      current = heading;
      seenHeading = true;
      continue; // skip the heading line itself; we re-display label in UI
    }
    if (!seenHeading) {
      buckets.contact.push(line);
    } else {
      buckets[current].push(line);
    }
  }

  const sections: ResumeSection[] = SECTION_ORDER.map((key) => ({
    key,
    label: SECTION_LABEL[key],
    content: buckets[key].join("\n").trim(),
  }));

  // Drop empty trailing sections, but always keep contact + experience even if empty
  return sections.filter(
    (s) => s.content.length > 0 || s.key === "contact" || s.key === "experience" || s.key === "summary" || s.key === "skills",
  );
}

export function joinSections(sections: ResumeSection[]): string {
  return sections
    .filter((s) => s.content.trim())
    .map((s) => `${s.label.toUpperCase()}\n${s.content.trim()}`)
    .join("\n\n");
}
