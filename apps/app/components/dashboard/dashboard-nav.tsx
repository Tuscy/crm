"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@stky/ui/utils";
import { useUptimeStatus } from "@/components/dashboard/uptime-status-provider";

type NavLink = {
  type: "link";
  href: string;
  label: string;
  isActive?: (pathname: string) => boolean;
};

type NavHeading = {
  type: "heading";
  label: string;
};

type NavItem = NavLink | NavHeading;

const NAV_ITEMS: NavItem[] = [
  {
    type: "link",
    href: "/dashboard",
    label: "Dashboard",
    isActive: (pathname) => pathname === "/dashboard",
  },
  { type: "heading", label: "Funnel" },
  {
    type: "link",
    href: "/dashboard/pipeline",
    label: "Overview",
    isActive: (pathname) =>
      pathname === "/dashboard/pipeline" ||
      pathname.startsWith("/dashboard/pipeline/"),
  },
  {
    type: "link",
    href: "/dashboard/leads",
    label: "Leads",
    isActive: (pathname) =>
      pathname === "/dashboard/leads" || pathname.startsWith("/dashboard/leads/"),
  },
  {
    type: "link",
    href: "/dashboard/tasks",
    label: "Tasks",
    isActive: (pathname) =>
      pathname === "/dashboard/tasks" || pathname.startsWith("/dashboard/tasks/"),
  },
  { type: "heading", label: "Clients" },
  {
    type: "link",
    href: "/dashboard/clients",
    label: "Client list",
    isActive: (pathname) =>
      pathname === "/dashboard/clients" ||
      pathname.startsWith("/dashboard/clients/"),
  },
  {
    type: "link",
    href: "/dashboard/google-ads",
    label: "Google Ads",
    isActive: (pathname) =>
      pathname === "/dashboard/google-ads" ||
      pathname.startsWith("/dashboard/google-ads/"),
  },
  {
    type: "link",
    href: "/dashboard/business-profile",
    label: "Business Profile",
    isActive: (pathname) =>
      pathname === "/dashboard/business-profile" ||
      pathname.startsWith("/dashboard/business-profile/"),
  },
  {
    type: "link",
    href: "/dashboard/reporting",
    label: "Reporting",
    isActive: (pathname) =>
      pathname === "/dashboard/reporting" ||
      pathname.startsWith("/dashboard/reporting/"),
  },
  {
    type: "link",
    href: "/dashboard/email-flows",
    label: "Email Flows",
    isActive: (pathname) =>
      pathname === "/dashboard/email-flows" ||
      pathname.startsWith("/dashboard/email-flows/"),
  },
  { type: "heading", label: "Tools" },
  {
    type: "link",
    href: "/dashboard/contacts",
    label: "Contacts",
    isActive: (pathname) =>
      pathname === "/dashboard/contacts" ||
      pathname.startsWith("/dashboard/contacts/"),
  },
  {
    type: "link",
    href: "/dashboard/automations",
    label: "Automations",
    isActive: (pathname) =>
      pathname === "/dashboard/automations" ||
      pathname.startsWith("/dashboard/automations/"),
  },
  {
    type: "link",
    href: "/dashboard/settings",
    label: "Settings",
    isActive: (pathname) =>
      pathname === "/dashboard/settings" ||
      pathname.startsWith("/dashboard/settings/"),
  },
];

function defaultIsActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const pathname = usePathname();
  const { down } = useUptimeStatus();
  let headingIndex = 0;

  return (
    <nav className="flex flex-col gap-0.5 px-2 py-2">
      {NAV_ITEMS.map((item) => {
        if (item.type === "heading") {
          headingIndex += 1;
          return (
            <p
              key={item.label}
              className={cn(
                "px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                headingIndex === 1 ? "pt-3" : "pt-4"
              )}
            >
              {item.label}
            </p>
          );
        }

        const active = item.isActive
          ? item.isActive(pathname)
          : defaultIsActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {item.label}
            {item.href === "/dashboard" && down.length > 0 ? (
              <span
                role="img"
                aria-label={`${down.length} monitor${down.length === 1 ? "" : "s"} down`}
                className="h-2.5 w-2.5 rounded-full bg-red-500"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
