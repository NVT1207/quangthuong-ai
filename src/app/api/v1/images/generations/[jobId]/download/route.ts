// Image download endpoint — proxy forward binary từ upstream beeknoee.
// Upstream trả response poll dạng: {data: [{url: "/v1/image/generations/{jobId}/download?index=0"}]}
// URL relative đó cần proxy forward vì client không có upstream key.
// Auth bằng sk-bee key, resolve provider, fetch binary, stream về.

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

  const url = new URL(req.url);
  const modelSlug = url.searchParams.get("model");
  if (!modelSlug) return err(400, "Missing 'model' query param");
  const index = url.searchParams.get("index") || "0";

  let upstream;
  try {
    upstream = await resolveUpstream(modelSlug);
  } catch (e: any) {
    const status = e instanceof UpstreamError ? e.status : 502;
    return err(status, e?.message || "Cannot resolve upstream", "upstream_error");
  }

  // Upstream URL: {base}/image/generations/{jobId}/download?index=0 (beeknoee quirk số ít)
  // Tận dụng buildEndpointUrl kind=images để lấy đúng prefix.
  const imagesEndpoint = buildEndpointUrl(
    upstream.providerType,
    upstream.imagesBaseUrl ?? upstream.baseUrl,
    "images",
  );
  const downloadUrl = `${imagesEndpoint.replace(/\/+$/, "")}/${encodeURIComponent(jobId)}/download?index=${encodeURIComponent(index)}`;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(downloadUrl, {
      method: "GET",
      headers: authHeaders(upstream.providerType, upstream.apiKey),
    });
  } catch (e: any) {
    return err(502, `Upstream download failed: ${e?.message || e}`, "upstream_error");
  }

  if (!upstreamRes.ok) {
    const body = await upstreamRes.text().catch(() => "");
    return err(upstreamRes.status, `Upstream download lỗi ${upstreamRes.status}. ${body.slice(0, 200)}`, "upstream_error");
  }

  // Stream binary về client — giữ Content-Type và Content-Length nếu có
  const contentType = upstreamRes.headers.get("content-type") || "image/png";
  const contentLength = upstreamRes.headers.get("content-length");
  const headers: Record<string, string> = {
    "content-type": contentType,
    "cache-control": "private, max-age=3600",
  };
  if (contentLength) headers["content-length"] = contentLength;

  return new Response(upstreamRes.body, { status: 200, headers });
}
