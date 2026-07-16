import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        userName={session.user.name ?? "用户"}
        userEmail={session.user.email ?? ""}
      />
      <main className="min-w-0 flex-1 bg-muted/20 px-8 py-6">{children}</main>
    </div>
  );
}
