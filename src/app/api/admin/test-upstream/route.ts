// Admin debug endpoint: test thẳng key của 1 model lên upstream, không qua transform.
// GET /api/admin/test-upstream?slug=gpt-5-5
// Trả về: status + raw body từ upstream → biết chính xác họ complain gì.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptKey } from "@/lib/key-cipher";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing ?slug=" }, { status: 400 });

  const model = await prisma.model.findUnique({ where: { slug } });
  if (!model) return NextResponse.json({ error: "Model not found" }, { status: 404 });

  const info: any = {
    slug: model.slug,
    apiType: model.apiType,
    apiBaseUrl: model.apiBaseUrl,
    upstreamSlug: model.upstreamSlug,
    hasApiKeyEnc: !!model.apiKeyEnc,
  };

  if (!model.apiKeyEnc) {
    return NextResponse.json({ ...info, error: "Model không có apiKeyEnc — dùng env fallback" });
  }
  if (!model.apiBaseUrl) {
    return NextResponse.json({ ...info, error: "Model không có apiBaseUrl" });
  }

  let plaintextKey: string;
  try {
    plaintextKey = decryptKey(model.apiKeyEnc);
  } catch (e: any) {
    return NextResponse.json({ ...info, error: `decryptKey fail: ${e?.message || e}` });
  }

  info.keyPrefix = plaintextKey.slice(0, 12) + "...";
  info.keyLength = plaintextKey.length;

  const upstreamModel = model.upstreamSlug || model.slug;
  const baseUrl = model.apiBaseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/chat/completions`;

  const payload = {
    model: upstreamModel,
    messages: [{ role: "user", content: "hi" }],
    max_tokens: 10,
    stream: false,
  };

  info.requestUrl = url;
  info.requestPayload = payload;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${plaintextKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* keep text */ }
    return NextResponse.json({
      ...info,
      upstreamStatus: res.status,
      upstreamOk: res.ok,
      upstreamBody: parsed ?? text.slice(0, 800),
    });
  } catch (e: any) {
    return NextResponse.json({ ...info, fetchError: e?.message || String(e) });
  }
}
