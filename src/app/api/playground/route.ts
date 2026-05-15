import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countTokens, computeCost } from "@/lib/pricing";
import { callUpstream, readNonStream, isUpstreamConfigured, UpstreamError } from "@/lib/upstream";
import { tierDiscountField, type Tier } from "@/lib/tier";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { model, messages } = await req.json();
  if (!model || !Array.isArray(messages)) return NextResponse.json({ error: "Thiếu model/messages" }, { status: 400 });

  const [user, m, key] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.model.findUnique({ where: { slug: model } }),
    prisma.apiKey.findFirst({ where: { userId: session.user.id, revokedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!m || !m.active) return NextResponse.json({ error: "Model không tồn tại hoặc đang tắt" }, { status: 404 });
  if (!key) return NextResponse.json({ error: "Bạn cần ít nhất 1 API key" }, { status: 400 });
  if (!isUpstreamConfigured()) {
    return NextResponse.json({ error: "Upstream chưa cấu hình. Đặt BEEKNOEE_BASE_URL và BEEKNOEE_API_KEY trong .env." }, { status: 503 });
  }

  const inputText = messages.map((x: any) => x.content || "").join("\n");
  const estInputTokens = countTokens(inputText);

  const discountField = tierDiscountField((user?.tier as Tier) ?? "FREE");
  const discount = discountField ? ((m as any)[discountField] as number | undefined) ?? 0 : 0;

  const minCost = computeCost(estInputTokens, 0, m.inputPrice, m.outputPrice, discount);
  if (user!.balance < minCost) {
    await prisma.usageLog.create({
      data: { userId: user!.id, apiKeyId: key.id, modelSlug: m.slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: 402 },
    });
    return NextResponse.json({ error: "Số dư không đủ. Vui lòng nạp thêm." }, { status: 402 });
  }

  let upstream: Response;
  try {
    upstream = await callUpstream({ model: m.slug, messages, stream: false });
  } catch (e: any) {
    const status = e instanceof UpstreamError ? e.status : 502;
    await prisma.usageLog.create({
      data: { userId: user!.id, apiKeyId: key.id, modelSlug: m.slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status },
    });
    return NextResponse.json({ error: e?.message || "Upstream lỗi" }, { status });
  }

  let parsed;
  try {
    parsed = await readNonStream(upstream);
  } catch (e: any) {
    const status = e instanceof UpstreamError ? e.status : 502;
    await prisma.usageLog.create({
      data: { userId: user!.id, apiKeyId: key.id, modelSlug: m.slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status },
    });
    return NextResponse.json({ error: e?.message || "Upstream lỗi" }, { status });
  }

  const inputTokens = parsed.promptTokens ?? estInputTokens;
  const outputTokens = parsed.completionTokens ?? countTokens(parsed.text);
  const cost = computeCost(inputTokens, outputTokens, m.inputPrice, m.outputPrice, discount);

  const fresh = await prisma.user.findUnique({ where: { id: user!.id } });
  const balance = fresh?.balance ?? user!.balance;
  if (balance < cost) {
    await prisma.usageLog.create({
      data: { userId: user!.id, apiKeyId: key.id, modelSlug: m.slug, inputTokens, outputTokens: 0, cost: 0, status: 402 },
    });
    return NextResponse.json({ error: "Số dư không đủ sau khi upstream trả về." }, { status: 402 });
  }

  const newBalance = balance - cost;
  await prisma.$transaction([
    prisma.user.update({ where: { id: user!.id }, data: { balance: newBalance } }),
    prisma.usageLog.create({
      data: { userId: user!.id, apiKeyId: key.id, modelSlug: m.slug, inputTokens, outputTokens, cost, status: 200 },
    }),
    prisma.transaction.create({
      data: { userId: user!.id, type: "USAGE", amount: -cost, balanceAfter: newBalance, description: `${m.displayName} — ${inputTokens + outputTokens} tokens` },
    }),
    prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }),
  ]);

  return NextResponse.json({ message: parsed.text, inputTokens, outputTokens, cost });
}
