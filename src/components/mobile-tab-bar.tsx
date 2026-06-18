import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Briefcase, Bell, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard },
  { title: "Resumes", url: "/resumes", icon: FileText },
  { title: "Jobs", url: "/applications", icon: Briefcase },
  { title: "Inbox", url: "/notifications", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = pathname === item.url || pathname.startsWith(item.url + "/");
          return (
            <li key={item.title}>
              <Link
                to={item.url}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="size-5" />
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
