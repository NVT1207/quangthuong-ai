import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countTokens, computeCost } from "@/lib/pricing";
import { callUpstream, readNonStream, isUpstreamConfigured, UpstreamError, describeAdminKeyError } from "@/lib/upstream";
import { tierDiscountField, type Tier } from "@/lib/tier";
import { formatVND } from "@/lib/format";

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
  if (!(await isUpstreamConfigured())) {
    return NextResponse.json({ error: "Upstream chưa cấu hình. Liên hệ admin để tạo Provider hoặc đặt BEEKNOEE_BASE_URL/API_KEY env." }, { status: 503 });
  }

  const inputText = messages.map((x: any) => x.content || "").join("\n");
  const estInputTokens = countTokens(inputText);

  const discountField = tierDiscountField((user?.tier as Tier) ?? "FREE");
  const discount = discountField ? ((m as any)[discountField] as number | undefined) ?? 0 : 0;

  // Chặn cứng nếu balance <= 0 (chưa nạp / hết tiền)
  if ((user!.balance ?? 0) <= 0) {
    await prisma.usageLog.create({
      data: { userId: user!.id, apiKeyId: key.id, modelSlug: m.slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: 402 },
    });
    return NextResponse.json(
      { error: "Số dư tài khoản bằng 0. Vui lòng nạp tiền tại /topup trước khi sử dụng.", code: "insufficient_balance", topupUrl: "/topup" },
      { status: 402 },
    );
  }

  const minCost = computeCost(estInputTokens, 0, m.inputPrice, m.outputPrice, discount);
  if (user!.balance < minCost) {
    await prisma.usageLog.create({
      data: { userId: user!.id, apiKeyId: key.id, modelSlug: m.slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: 402 },
    });
    return NextResponse.json(
      { error: `Số dư không đủ (hiện có ${formatVND(user!.balance)}, cần tối thiểu ${formatVND(minCost)}). Nạp thêm tại /topup`, code: "insufficient_balance", topupUrl: "/topup" },
      { status: 402 },
    );
  }

  let upstream: Response;
  try {
    upstream = await callUpstream({ model: m.slug, messages, stream: false });
  } catch (e: any) {
    const status = e instanceof UpstreamError ? e.status : 502;
    const isAdmin = e instanceof UpstreamError && e.adminSide;
    // Trích message từ upstream body nếu có (debug — admin/owner mới thấy)
    let detail = "";
    if (e instanceof UpstreamError && e.body) {
      try {
        const b = typeof e.body === "string" ? JSON.parse(e.body) : e.body;
        detail = b?.error?.message || b?.message || JSON.stringify(b).slice(0, 200);
      } catch {
        detail = String(e.body).slice(0, 200);
      }
    }
    const isOwner = user?.role === "ADMIN";
    const msg = isAdmin
      ? `${e.message}${isOwner && detail ? ` [Upstream: ${detail}]` : ""}`
      : `API key của admin gặp sự cố — ${describeAdminKeyError(status)}. Vui lòng thử lại sau hoặc báo admin.${isOwner && detail ? ` [Upstream: ${detail}]` : ""}`;
    await prisma.usageLog.create({
      data: { userId: user!.id, apiKeyId: key.id, modelSlug: m.slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status },
    });
    return NextResponse.json({ error: msg, code: "upstream_key_error", upstreamStatus: status, upstreamDetail: isOwner ? detail : undefined }, { status: 502 });
  }

  let parsed;
  try {
    parsed = await readNonStream(upstream);
  } catch (e: any) {
    const status = e instanceof UpstreamError ? e.status : 502;
    const isAdmin = e instanceof UpstreamError && e.adminSide;
    let detail = "";
    if (e instanceof UpstreamError && e.body) {
      try {
        const b = typeof e.body === "string" ? JSON.parse(e.body) : e.body;
        detail = b?.error?.message || b?.message || JSON.stringify(b).slice(0, 200);
      } catch {
        detail = String(e.body).slice(0, 200);
      }
    }
    const isOwner = user?.role === "ADMIN";
    const msg = isAdmin
      ? `${e.message}${isOwner && detail ? ` [Upstream: ${detail}]` : ""}`
      : `API key của admin gặp sự cố — ${describeAdminKeyError(status)}. Vui lòng thử lại sau hoặc báo admin.${isOwner && detail ? ` [Upstream: ${detail}]` : ""}`;
    await prisma.usageLog.create({
      data: { userId: user!.id, apiKeyId: key.id, modelSlug: m.slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status },
    });
    return NextResponse.json({ error: msg, code: "upstream_key_error", upstreamStatus: status, upstreamDetail: isOwner ? detail : undefined }, { status: 502 });
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
    return NextResponse.json(
      { error: `Số dư không đủ sau khi tính phí (cần ${formatVND(cost)}, hiện có ${formatVND(balance)}). Nạp thêm tại /topup`, code: "insufficient_balance", topupUrl: "/topup" },
      { status: 402 },
    );
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
