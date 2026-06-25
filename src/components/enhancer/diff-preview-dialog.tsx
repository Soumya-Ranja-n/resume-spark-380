import { useEffect, useMemo, useState } from "react";
import { Check, X, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface DiffItem {
  id: string;
  label: string;
  reason?: string;
  sectionLabel?: string;
  before: string;
  after: string;
  badge?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description?: string;
  items: DiffItem[];
  onApply: (acceptedIds: Set<string>) => void;
  applyLabel?: string;
}

/**
 * Generic accept/reject diff preview. Each item can be individually
 * toggled; "Apply selected" calls back with the chosen IDs.
 */
export function DiffPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  items,
  onApply,
  applyLabel = "Apply selected",
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));

  useEffect(() => {
    if (open) setSelected(new Set(items.map((i) => i.id)));
  }, [open, items]);

  const count = selected.size;
  const total = items.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(count === total ? new Set() : new Set(items.map((i) => i.id)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nothing to fix here — your resume is already clean on this dimension.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {count} of {total} selected
              </span>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {count === total ? "Deselect all" : "Select all"}
              </Button>
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <ul className="space-y-3 py-2">
                {items.map((item) => {
                  const isOn = selected.has(item.id);
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "rounded-md border p-3 transition-colors",
                        isOn ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{item.label}</p>
                            {item.sectionLabel && (
                              <Badge variant="outline" className="text-[10px] h-4">
                                {item.sectionLabel}
                              </Badge>
                            )}
                            {item.badge && (
                              <Badge variant="secondary" className="text-[10px] h-4">
                                {item.badge}
                              </Badge>
                            )}
                          </div>
                          {item.reason && (
                            <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={isOn ? "default" : "outline"}
                          onClick={() => toggle(item.id)}
                          aria-pressed={isOn}
                          className="h-7 shrink-0"
                        >
                          {isOn ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                          {isOn ? "Accept" : "Skip"}
                        </Button>
                      </div>

                      <DiffPreview before={item.before} after={item.after} />
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={count === 0}
            onClick={() => {
              onApply(selected);
              onOpenChange(false);
            }}
          >
            {applyLabel} ({count})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiffPreview({ before, after }: { before: string; after: string }) {
  const { trimmedBefore, trimmedAfter } = useMemo(() => trimContext(before, after), [before, after]);
  return (
    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
      <div className="rounded border border-destructive/30 bg-destructive/5 p-2 font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-wider text-destructive/80 mb-1">Before</p>
        {trimmedBefore || <span className="italic text-muted-foreground">(empty)</span>}
      </div>
      <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2 font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">After</p>
        {trimmedAfter || <span className="italic text-muted-foreground">(empty)</span>}
      </div>
    </div>
  );
}

/**
 * Trim shared head/tail context so users see what actually changed
 * without scrolling through entire sections.
 */
function trimContext(before: string, after: string): { trimmedBefore: string; trimmedAfter: string } {
  if (before === after) return { trimmedBefore: before, trimmedAfter: after };

  let start = 0;
  const maxStart = Math.min(before.length, after.length);
  while (start < maxStart && before[start] === after[start]) start++;
  // Back up to previous line break for readability.
  while (start > 0 && before[start - 1] !== "\n") start--;

  let endB = before.length;
  let endA = after.length;
  while (endB > start && endA > start && before[endB - 1] === after[endA - 1]) {
    endB--;
    endA--;
  }
  // Advance to next line break for readability.
  while (endB < before.length && before[endB] !== "\n") endB++;
  while (endA < after.length && after[endA] !== "\n") endA++;

  const prefix = start > 0 ? "… " : "";
  const suffixB = endB < before.length ? " …" : "";
  const suffixA = endA < after.length ? " …" : "";

  const sliceB = before.slice(start, endB);
  const sliceA = after.slice(start, endA);

  // Cap each side to keep dialog manageable.
  const cap = 600;
  return {
    trimmedBefore: prefix + (sliceB.length > cap ? sliceB.slice(0, cap) + "…" : sliceB) + suffixB,
    trimmedAfter: prefix + (sliceA.length > cap ? sliceA.slice(0, cap) + "…" : sliceA) + suffixA,
  };
}
