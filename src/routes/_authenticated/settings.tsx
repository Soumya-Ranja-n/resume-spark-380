import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useTheme } from "@/lib/use-theme";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { updateProfile } from "@/lib/profile.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ResumeTracker AI" },
      { name: "description", content: "Manage your profile, appearance preferences, and account settings." },
      { property: "og:title", content: "Settings — ResumeTracker AI" },
      { property: "og:description", content: "Manage your profile, appearance preferences, and account settings." },
      { property: "og:url", content: "https://resume-spark-380.lovable.app/settings" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const update = useServerFn(updateProfile);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) { setProfile(data); setFullName(data.full_name ?? ""); }
    })();
  }, [user]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await update({ data: { full_name: fullName } });
      toast.success("Profile saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error("At least 6 characters"); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPwSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); setPassword(""); }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account and preferences.</p>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold">Profile</h2>
        <form onSubmit={saveProfile} className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Plan</h2>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <Badge variant="secondary" className="capitalize">{profile?.subscription_plan ?? "free"} plan</Badge>
            <p className="text-sm text-muted-foreground mt-2">Upgrades and billing are coming soon.</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Appearance</h2>
        <div className="flex items-center justify-between mt-4">
          <div>
            <p className="font-medium text-sm">Dark mode</p>
            <p className="text-xs text-muted-foreground">Easier on the eyes at night.</p>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Password</h2>
        <form onSubmit={changePassword} className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>
          <Button type="submit" disabled={pwSaving || !password}>
            {pwSaving && <Loader2 className="size-4 animate-spin" />} Change password
          </Button>
        </form>
      </Card>

      <Card className="p-6 border-destructive/30">
        <h2 className="font-semibold">Session</h2>
        <p className="text-sm text-muted-foreground mt-1">Sign out from this device.</p>
        <Button variant="outline" className="mt-4 text-destructive" onClick={signOut}>
          <LogOut className="size-4" /> Sign out
        </Button>
      </Card>
    </div>
  );
}
