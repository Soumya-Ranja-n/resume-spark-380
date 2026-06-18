import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";

export function TopBar() {
  return (
    <header className="h-14 flex items-center gap-2 px-4 md:px-6 border-b bg-card/40 backdrop-blur sticky top-0 z-30">
      <SidebarTrigger className="hidden md:inline-flex" />
      <div className="md:hidden flex items-center gap-2">
        <div className="size-7 rounded-lg gradient-primary" />
        <span className="font-semibold tracking-tight">ResumeTracker</span>
      </div>
      <div className="flex-1" />
      <ThemeToggle />
      <NotificationBell />
    </header>
  );
}
