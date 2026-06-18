import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Run {
  id: string;
  created_at: string;
  overall_score: number | null;
  mode: string;
}

export function HistoryChart({ runs, currentId }: { runs: Run[]; currentId?: string }) {
  const completed = runs.filter((r) => r.overall_score !== null);
  if (completed.length < 2) {
    return (
      <Card className="p-8 text-center">
        <TrendingUp className="size-10 mx-auto text-muted-foreground" />
        <h3 className="font-semibold mt-2">No progress history yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Run another analysis after editing your resume to track your score over time.
        </p>
      </Card>
    );
  }

  const data = [...completed].reverse().map((r, i) => ({
    idx: i + 1,
    score: r.overall_score!,
    date: new Date(r.created_at).toLocaleDateString(),
    mode: r.mode,
  }));

  const first = data[0].score;
  const last = data[data.length - 1].score;
  const delta = last - first;
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h3 className="font-semibold">Score over time</h3>
            <p className="text-xs text-muted-foreground">{completed.length} analyses</p>
          </div>
          <div className={`inline-flex items-center gap-1.5 text-sm font-semibold ${trendColor}`}>
            <TrendIcon className="size-4" />
            {delta > 0 ? "+" : ""}{delta} points
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis domain={[0, 100]} className="text-xs" />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number) => [`${value}/100`, "Score"]}
              />
              <ReferenceLine y={85} stroke="#10b981" strokeDasharray="3 3" />
              <ReferenceLine y={65} stroke="#f59e0b" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">All runs</h3>
        <div className="space-y-2">
          {completed.map((r) => (
            <div
              key={r.id}
              className={`flex items-center justify-between p-2.5 rounded-md border ${currentId === r.id ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <div className="flex items-center gap-3">
                <div className="text-lg font-bold tabular-nums w-12 text-center">{r.overall_score}</div>
                <div>
                  <div className="text-sm font-medium">{new Date(r.created_at).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground capitalize">{r.mode} mode</div>
                </div>
              </div>
              {currentId === r.id && <span className="text-xs text-primary font-medium">Viewing</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
