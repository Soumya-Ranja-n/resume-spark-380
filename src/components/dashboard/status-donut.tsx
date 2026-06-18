import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";

const COLORS = ["var(--muted-foreground)", "var(--info)", "var(--primary)", "var(--success)", "var(--destructive)", "var(--accent)"];
const LABELS = ["Saved", "Applied", "Interviewing", "Offer", "Rejected", "Withdrawn"];
const KEYS = ["saved", "applied", "interviewing", "offer", "rejected", "withdrawn"] as const;

export function StatusDonut({ counts }: { counts: Record<string, number> }) {
  const data = KEYS.map((k, i) => ({ name: LABELS[i], value: counts[k] ?? 0, color: COLORS[i] })).filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="p-5">
      <h3 className="font-semibold">Applications by status</h3>
      <p className="text-xs text-muted-foreground mb-4">Current pipeline</p>
      {total === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">No applications yet</div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5 mt-3">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="ml-auto font-medium tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
