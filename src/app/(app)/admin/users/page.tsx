import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { UsersClient } from "./users-client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const q = searchParams.q?.trim() || "";
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Người dùng</h1>
        <p className="text-sm text-ink-200/60">Quản lý {users.length} tài khoản</p>
      </div>

      <form className="card p-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Tìm theo email hoặc tên..." className="input flex-1" />
        <button className="btn btn-primary">Tìm</button>
      </form>

      <UsersClient users={users.map((u) => ({
        id: u.id, email: u.email, name: u.name, balance: u.balance, role: u.role, status: u.status,
        createdAt: u.createdAt.toISOString(),
      }))} />
    </div>
  );
}
