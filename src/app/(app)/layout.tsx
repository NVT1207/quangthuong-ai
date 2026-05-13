import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar name={user.name ?? user.email} balance={user.balance} role={user.role} tier={user.tier} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
