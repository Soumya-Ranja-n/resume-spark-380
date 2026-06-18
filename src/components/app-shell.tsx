import { type ReactNode } from "react";
import { TopBar } from "./top-bar";
import { AppSidebar } from "./app-sidebar";
import { MobileTabBar } from "./mobile-tab-bar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-col min-w-0 flex-1">
          <TopBar />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0 animate-fade-in">
            {children}
          </main>
          <MobileTabBar />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
