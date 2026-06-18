import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-16 px-6", className)}>
      <div className="size-16 rounded-2xl bg-primary-soft text-primary-soft-foreground flex items-center justify-center mb-5 shadow-elegant">
        <Icon className="size-7" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
