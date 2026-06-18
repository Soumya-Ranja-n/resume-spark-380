import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, useDroppable, useDraggable,
} from "@dnd-kit/core";
import { Plus, ExternalLink, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Application = Tables<"job_applications">;
type Status = Application["status"];

const COLUMNS: { id: Status; label: string; accent: string }[] = [
  { id: "saved", label: "Saved", accent: "bg-muted-foreground" },
  { id: "applied", label: "Applied", accent: "bg-info" },
  { id: "interviewing", label: "Interviewing", accent: "bg-primary" },
  { id: "offer", label: "Offer", accent: "bg-success" },
  { id: "rejected", label: "Rejected", accent: "bg-destructive" },
];

interface Props {
  applications: Application[];
  onCardClick: (app: Application) => void;
  onAdd: (status: Status) => void;
  onStatusChange: (id: string, status: Status) => void;
}

export function KanbanBoard({ applications, onCardClick, onAdd, onStatusChange }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const activeApp = applications.find((a) => a.id === activeId) ?? null;

  function handleDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }
  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const newStatus = String(e.over.id) as Status;
    const app = applications.find((a) => a.id === id);
    if (!app || app.status === newStatus) return;
    onStatusChange(id, newStatus);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 min-h-[60vh]">
        {COLUMNS.map((col) => {
          const items = applications.filter((a) => a.status === col.id);
          return (
            <KanbanColumn key={col.id} column={col} count={items.length} onAdd={() => onAdd(col.id)}>
              {items.map((app) => (
                <KanbanCard key={app.id} app={app} onClick={() => onCardClick(app)} />
              ))}
            </KanbanColumn>
          );
        })}
      </div>
      <DragOverlay>
        {activeApp && <KanbanCardInner app={activeApp} isOverlay />}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  column, count, children, onAdd,
}: { column: typeof COLUMNS[number]; count: number; children: React.ReactNode; onAdd: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between px-1 py-2">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", column.accent)} />
          <h3 className="font-semibold text-sm">{column.label}</h3>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{count}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="size-6" onClick={onAdd}>
          <Plus className="size-3.5" />
        </Button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-xl border-2 border-dashed p-2 space-y-2 transition-colors",
          isOver ? "border-primary bg-primary-soft/40" : "border-transparent bg-muted/40"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function KanbanCard({ app, onClick }: { app: Application; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: app.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => { if (!isDragging) onClick(); e.stopPropagation(); }}
      className={cn("touch-none", isDragging && "opacity-30")}
    >
      <KanbanCardInner app={app} />
    </div>
  );
}

function KanbanCardInner({ app, isOverlay }: { app: Application; isOverlay?: boolean }) {
  return (
    <Card className={cn("p-3 cursor-grab active:cursor-grabbing hover:shadow-elegant transition-shadow", isOverlay && "shadow-glow rotate-2")}>
      <p className="font-semibold text-sm leading-tight">{app.job_title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{app.company_name}</p>
      <div className="flex items-center gap-2 mt-2.5 text-[10px] text-muted-foreground">
        {app.resume_id && <span className="inline-flex items-center gap-1"><FileText className="size-3" /></span>}
        {app.job_url && <span className="inline-flex items-center gap-1"><ExternalLink className="size-3" /></span>}
        <span className="ml-auto">{formatDistanceToNow(new Date(app.updated_at), { addSuffix: true })}</span>
      </div>
    </Card>
  );
}
