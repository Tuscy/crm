"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DialogPrimitive } from "@stky/ui";
import { Menu } from "lucide-react";
import { cn } from "@stky/ui/utils";
import { AppBrand } from "@/components/app-brand";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import {
  UptimeStatusProvider,
  useUptimeStatus,
} from "@/components/dashboard/uptime-status-provider";
import { UptimeBanner } from "@/components/dashboard/uptime-banner";

function MenuButtonDot() {
  const { down } = useUptimeStatus();
  if (down.length === 0) return null;
  return (
    <span
      role="img"
      aria-label="A monitor is down"
      className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-muted"
    />
  );
}

export function MobileDashboardShell(props: {
  signOutForm: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <UptimeStatusProvider>
      <ShellInner {...props} />
    </UptimeStatusProvider>
  );
}

function ShellInner({
  signOutForm,
  children,
}: {
  signOutForm: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="dashboard-shell flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="hidden h-full w-56 shrink-0 flex-col border-r bg-muted md:flex">
        <div className="shrink-0 border-b px-3 py-2.5">
          <AppBrand href="/dashboard" size="xs" className="gap-2" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DashboardNav />
        </div>
        {signOutForm ? (
          <div className="shrink-0 border-t px-4 py-3">{signOutForm}</div>
        ) : null}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-14 shrink-0 items-center justify-between border-b bg-muted px-3 md:hidden">
          <AppBrand href="/dashboard" size="xs" className="gap-2" />
          <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
            <DialogPrimitive.Trigger asChild>
              <button
                type="button"
                aria-label="Open navigation"
                aria-expanded={isOpen}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent"
              >
                <Menu className="h-5 w-5" />
                <MenuButtonDot />
              </button>
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
              <DialogPrimitive.Content
                className={cn(
                  "fixed inset-y-0 left-0 z-50 flex h-full w-[80vw] max-w-[300px] flex-col border-r bg-muted shadow-lg outline-none",
                  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-200",
                  "data-[state=closed]:slide-out-to-left-full data-[state=open]:slide-in-from-left-full"
                )}
              >
                <DialogPrimitive.Title className="sr-only">
                  Navigation
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  Dashboard navigation links
                </DialogPrimitive.Description>
                <div className="shrink-0 border-b px-3 py-2.5">
                  <AppBrand href="/dashboard" size="xs" className="gap-2" />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <DashboardNav />
                </div>
                {signOutForm ? (
                  <div className="shrink-0 border-t px-4 py-3">{signOutForm}</div>
                ) : null}
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </div>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
          <UptimeBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
