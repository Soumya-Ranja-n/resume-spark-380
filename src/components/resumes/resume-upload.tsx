import { useRef, useState } from "react";
import { Upload, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { analyzeResume } from "@/lib/resumes.functions";
import { cn } from "@/lib/utils";

const ACCEPTED = ".pdf,.docx,.txt";
const MAX_BYTES = 10 * 1024 * 1024;

export function ResumeUpload({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeResume);

  async function handleFile(file: File) {
    if (!user) return;
    if (file.size > MAX_BYTES) { toast.error("File too large (max 10 MB)"); return; }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["pdf", "docx", "txt"].includes(ext)) {
      toast.error("Use PDF, DOCX, or TXT");
      return;
    }
    setUploading(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("resumes").upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await supabase
        .from("resumes")
        .insert({
          user_id: user.id,
          title: file.name.replace(/\.[^.]+$/, ""),
          file_url: path,
          file_name: file.name,
          status: "uploaded",
        })
        .select()
        .single();
      if (insErr || !row) throw insErr;

      toast.success("Resume uploaded — analyzing…");
      navigate({ to: "/resumes/$id", params: { id: row.id } });

      // Fire-and-forget analysis (live status comes via realtime)
      analyze({ data: { resume_id: row.id } }).catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Analysis failed";
        toast.error(msg);
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  function onChoose(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  if (compact) {
    return (
      <>
        <input ref={inputRef} type="file" accept={ACCEPTED} onChange={onChoose} className="hidden" />
        <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Upload resume
        </Button>
      </>
    );
  }

  return (
    <>
      <input ref={inputRef} type="file" accept={ACCEPTED} onChange={onChoose} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        disabled={uploading}
        className={cn(
          "w-full rounded-2xl border-2 border-dashed p-10 text-center transition-all",
          dragging ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50 hover:bg-muted/40",
          uploading && "opacity-60 cursor-wait"
        )}
      >
        <div className="mx-auto size-12 rounded-xl bg-primary-soft text-primary-soft-foreground flex items-center justify-center mb-3">
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />}
        </div>
        <p className="font-medium">
          {uploading ? "Uploading…" : "Drop your resume or click to browse"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">PDF, DOCX, or TXT · up to 10&nbsp;MB</p>
      </button>
    </>
  );
}
