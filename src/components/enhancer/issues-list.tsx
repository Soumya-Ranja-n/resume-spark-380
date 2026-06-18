import { useMemo, useState } from "react";
import { CATEGORY_META, type CategoryKey, type EnhancementIssue, SEVERITY_ORDER } from "@/lib/ats-rubric";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";

const SEVERITY_STYLES = {
  high: { color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: AlertTriangle },
  medium: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: AlertCircle },
  low: { color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/30", icon: Info },
} as const;

export function IssuesList({ issues }: { issues: EnhancementIssue[] }) {
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | CategoryKey>("all");

  const filtered = useMemo(() => {
    const list = [...(issues ?? [])].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
    );
    return list.filter(
      (i) =>
        (severityFilter === "all" || i.severity === severityFilter) &&
        (categoryFilter === "all" || i.category === categoryFilter),
    );
  }, [issues, severityFilter, categoryFilter]);

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const i of issues ?? []) c[i.severity] = (c[i.severity] ?? 0) + 1;
    return c;
  }, [issues]);

  if (!issues?.length) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="size-10 mx-auto text-emerald-500" />
        <h3 className="font-semibold mt-2">No issues detected</h3>
        <p className="text-sm text-muted-foreground mt-1">Your resume passed all rubric checks.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5 flex-wrap">
          <FilterChip active={severityFilter === "all"} onClick={() => setSeverityFilter("all")}>All ({issues.length})</FilterChip>
          {(["high", "medium", "low"] as const).map((s) => (
            counts[s] > 0 && (
              <FilterChip key={s} active={severityFilter === s} onClick={() => setSeverityFilter(s)} tone={s}>
                {s} ({counts[s]})
              </FilterChip>
            )
          ))}
        </div>
        <div className="h-5 w-px bg-border mx-1 hidden sm:block" />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
          className="text-xs border border-input rounded-md bg-background px-2 py-1"
        >
          <option value="all">All categories</option>
          {Object.values(CATEGORY_META).map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((issue, idx) => {
          const style = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.low;
          const Icon = style.icon;
          const catLabel = CATEGORY_META[issue.category as CategoryKey]?.label ?? issue.category;
          return (
            <Card key={idx} className={`p-4 border-l-4 ${style.border}`}>
              <div className="flex items-start gap-3">
                <div className={`shrink-0 size-9 rounded-full flex items-center justify-center ${style.bg}`}>
                  <Icon className={`size-4 ${style.color}`} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`${style.color} ${style.border}`}>
                      {issue.severity}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">{catLabel}</Badge>
                    {issue.section && (
                      <span className="text-xs text-muted-foreground">{issue.section}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium">{issue.issue}</p>
                  <div className="text-sm text-muted-foreground bg-muted/40 rounded-md p-3 border border-border/40">
                    <span className="font-semibold text-foreground">Fix: </span>{issue.fix}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "high" | "medium" | "low";
}) {
  const toneClass = tone
    ? SEVERITY_STYLES[tone].color
    : "";
  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className={`h-7 text-xs capitalize ${!active ? toneClass : ""}`}
    >
      {children}
    </Button>
  );
}
