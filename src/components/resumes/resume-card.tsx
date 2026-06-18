import { Link } from "@tanstack/react-router";
import { FileText, Loader2, MoreVertical, Trash2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScoreGauge } from "./score-gauge";
import { deleteResume, analyzeResume } from "@/lib/resumes.functions";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Resume = Tables<"resumes">;

const statusStyles: Record<Resume["status"], string> = {
  uploaded: "bg-muted text-muted-foreground",
  analyzing: "bg-info/15 text-info border-info/20",
  analyzed: "bg-success/15 text-success border-success/20",
  failed: "bg-destructive/15 text-destructive border-destructive/20",
};

export function ResumeCard({ resume, onChanged }: { resume: Resume; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false);
  const del = useServerFn(deleteResume);
  const analyze = useServerFn(analyzeResume);

  async function handleDelete() {
    if (!confirm("Delete this resume?")) return;
    setBusy(true);
    try {
      await del({ data: { resume_id: resume.id } });
      toast.success("Resume deleted");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  async function handleReanalyze() {
    setBusy(true);
    try {
      await analyze({ data: { resume_id: resume.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  const isAnalyzing = resume.status === "analyzing";

  return (
    <Card className="p-5 hover:shadow-elegant transition-shadow group">
      <div className="flex items-start justify-between gap-3">
        <Link to="/resumes/$id" params={{ id: resume.id }} className="flex items-start gap-3 min-w-0 flex-1">
          <div className="size-10 rounded-lg bg-primary-soft text-primary-soft-foreground flex items-center justify-center shrink-0">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate group-hover:text-primary transition-colors">{resume.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{resume.file_name}</p>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0"><MoreVertical className="size-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={handleReanalyze} disabled={busy || isAnalyzing}>
              <RefreshCw className="size-4" /> Re-analyze
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleDelete} disabled={busy} className="text-destructive focus:text-destructive">
              <Trash2 className="size-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <Badge variant="outline" className={cn("capitalize border", statusStyles[resume.status])}>
            {isAnalyzing && <Loader2 className="size-3 animate-spin" />}
            {resume.status}
          </Badge>
          <p className="text-[11px] text-muted-foreground mt-2">
            {formatDistanceToNow(new Date(resume.created_at), { addSuffix: true })}
          </p>
        </div>
        {resume.ai_score !== null && resume.status === "analyzed" && (
          <ScoreGauge score={resume.ai_score} size={56} />
        )}
      </div>
    </Card>
  );
}
