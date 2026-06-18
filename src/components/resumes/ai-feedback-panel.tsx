import { CheckCircle2, AlertTriangle, Lightbulb, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Feedback {
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
  missing_keywords?: string[];
}

export function AiFeedbackPanel({ feedback }: { feedback: Feedback }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FeedbackList
        icon={<CheckCircle2 className="size-4" />}
        title="Strengths"
        tone="success"
        items={feedback.strengths}
      />
      <FeedbackList
        icon={<AlertTriangle className="size-4" />}
        title="Weaknesses"
        tone="warning"
        items={feedback.weaknesses}
      />
      <FeedbackList
        icon={<Lightbulb className="size-4" />}
        title="Suggestions"
        tone="primary"
        items={feedback.suggestions}
      />
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-7 rounded-lg bg-accent-soft text-accent-foreground flex items-center justify-center">
            <Search className="size-4" />
          </div>
          <h3 className="font-semibold">Missing keywords</h3>
        </div>
        {feedback.missing_keywords?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {feedback.missing_keywords.map((k, i) => (
              <Badge key={i} variant="outline">{k}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No obvious gaps found.</p>
        )}
      </Card>
    </div>
  );
}

const toneStyles = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  primary: "bg-primary-soft text-primary-soft-foreground",
} as const;

function FeedbackList({
  icon, title, items, tone,
}: { icon: React.ReactNode; title: string; items?: string[]; tone: keyof typeof toneStyles }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`size-7 rounded-lg flex items-center justify-center ${toneStyles[tone]}`}>{icon}</div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      {items?.length ? (
        <ul className="space-y-2 text-sm">
          {items.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground mt-1">•</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No items.</p>
      )}
    </Card>
  );
}
