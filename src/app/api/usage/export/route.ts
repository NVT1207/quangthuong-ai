import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") || "30", 10);
  const modelSlug = url.searchParams.get("model");
  const since = new Date(); since.setDate(since.getDate() - days);

  const logs = await prisma.usageLog.findMany({
    where: { userId: session.user.id, createdAt: { gte: since }, ...(modelSlug ? { modelSlug } : {}) },
    orderBy: { createdAt: "desc" },
  });

  const header = "timestamp,model,input_tokens,output_tokens,cost_vnd,status\n";
  const rows = logs.map((l) =>
    `${l.createdAt.toISOString()},${l.modelSlug},${l.inputTokens},${l.outputTokens},${l.cost.toFixed(2)},${l.status}`,
  );
  const csv = header + rows.join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quangthuong-ai-usage-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
