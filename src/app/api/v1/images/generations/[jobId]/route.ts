// Image job polling endpoint — async upstream (beeknoee/gpt-image-2) trả job_id, client poll qua đây.
// Dùng cho cả /images/generations và /images/edits (upstream chỉ có 1 namespace job_id).
// Auth bằng sk-bee key, resolve provider của model (kèm trong query ?model=), forward GET tới upstream.
// Không trừ tiền lần nữa — tiền đã trừ ở POST khởi tạo job.

import { NextResponse } from "next/server";
import { authHeaders, buildEndpointUrl, resolveUpstream, UpstreamError } from "@/lib/provider-routing";
import { authenticate, err } from "@/lib/modality-route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  if (!jobId || !/^[A-Za-z0-9_-]{8,128}$/.test(jobId)) {
    return err(400, "Invalid jobId");
  }

  const key = await authenticate(req);
  if (!key) return err(401, "Invalid API key", "authentication_error");
  if (key.user.status === "BANNED") return err(403, "Account banned", "permission_error");

  // Model phải truyền qua query để resolve đúng provider đã tạo job
  const url = new URL(req.url);
  const modelSlug = url.searchParams.get("model");
  if (!modelSlug) return err(400, "Missing 'model' query param (model dùng khi tạo job)");

  let upstream;
  try {
    upstream = await resolveUpstream(modelSlug);
  } catch (e: any) {
    const status = e instanceof UpstreamError ? e.status : 502;
    return err(status, e?.message || "Cannot resolve upstream", "upstream_error");
  }

  // Build polling URL: {base}/image/generations/{jobId} (beeknoee quirk, số ít)
  // hoặc {base}/images/generations/{jobId} (chuẩn proxy mình)
  // Tận dụng buildEndpointUrl với kind=images để lấy đúng host quirk.
  const imagesEndpoint = buildEndpointUrl(
    upstream.providerType,
    upstream.imagesBaseUrl ?? upstream.baseUrl,
    "images",
  );
  const pollUrl = `${imagesEndpoint.replace(/\/+$/, "")}/${encodeURIComponent(jobId)}`;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(pollUrl, {
      method: "GET",
      headers: authHeaders(upstream.providerType, upstream.apiKey),
    });
  } catch (e: any) {
    return err(502, `Upstream poll failed: ${e?.message || e}`, "upstream_error");
  }

  if (!upstreamRes.ok) {
    const body = await upstreamRes.text().catch(() => "");
    return err(upstreamRes.status, `Upstream poll lỗi ${upstreamRes.status}. ${body.slice(0, 200)}`, "upstream_error");
  }

  const data = await upstreamRes.json().catch(() => null);
  return NextResponse.json(data ?? { job_id: jobId, status: "UNKNOWN" });
}
