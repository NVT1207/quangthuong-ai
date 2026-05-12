import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const user = await prisma.user.findUnique({ where: { id: session!.user.id } });
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Tài khoản</h1>
        <p className="text-sm text-ink-200/60">Quản lý thông tin và bảo mật</p>
      </div>
      <SettingsForm name={user!.name ?? ""} email={user!.email} />
    </div>
  );
}
