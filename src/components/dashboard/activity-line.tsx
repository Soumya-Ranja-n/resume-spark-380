import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Card } from "@/components/ui/card";

export function ActivityLine({ data }: { data: { week: string; count: number }[] }) {
  return (
    <Card className="p-5">
      <h3 className="font-semibold">Application activity</h3>
      <p className="text-xs text-muted-foreground mb-4">Last 8 weeks</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            />
            <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--primary)" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
