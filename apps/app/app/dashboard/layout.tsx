import { auth } from "@/auth";
import { MobileDashboardShell } from "@/components/dashboard/mobile-dashboard-shell";
import { SignOutForm } from "./sign-out-form";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const signOutForm = session?.user?.isStaff ? <SignOutForm /> : null;

  return (
    <MobileDashboardShell signOutForm={signOutForm}>
      {children}
    </MobileDashboardShell>
  );
}
