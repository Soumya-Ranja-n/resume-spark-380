import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: "primary" | "accent" | "success" | "info";
}

const tones = {
  primary: "bg-primary-soft text-primary-soft-foreground",
  accent: "bg-accent-soft text-accent-foreground",
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
} as const;

export function StatCard({ label, value, icon: Icon, hint, tone = "primary" }: Props) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={cn("size-9 rounded-lg flex items-center justify-center", tones[tone])}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </Card>
  );
}
