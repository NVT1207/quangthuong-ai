// Multi-provider routing + auto-failover.
// resolveUpstream pick provider key cho model; callWithFailover retry sang key kế nếu fail.

import { prisma } from "@/lib/prisma";
import { decryptKey } from "@/lib/key-cipher";

export type ProviderType =
  | "OPENAI"
  | "ANTHROPIC"
  | "GEMINI"
  | "OLLAMA"
  | "OPENAI_COMPATIBLE";

export type RoutingStrategy =
  | "ROUND_ROBIN"
  | "FAILOVER"
  | "RANDOM"
  | "LEAST_USED";

export const ERROR_THRESHOLD = 3; // 3 lỗi liên tiếp → tạm skip key
export const ERROR_COOLDOWN_MS = 5 * 60_000; // sau 5 phút tự cho thử lại

export class UpstreamError extends Error {
  status: number;
  body: any;
  /**
   * adminSide=true: lỗi từ phía admin (key sai, hết quota, provider down).
   * User không thể tự fix → gateway sẽ báo "API key admin đang lỗi".
   */
  adminSide: boolean;
  constructor(status: number, message: string, body?: any, adminSide = false) {
    super(message);
    this.status = status;
    this.body = body;
    this.adminSide = adminSide;
  }
}

// Diễn dịch HTTP status từ upstream sang message user-friendly khi key admin lỗi
export function describeAdminKeyError(status: number): string {
  if (status === 401) return "API key của admin bị từ chối (401 — key sai hoặc đã hết hạn)";
  if (status === 403) return "API key của admin không có quyền truy cập (403 — bị block hoặc thiếu permission)";
  if (status === 402) return "Tài khoản provider của admin hết tiền/quota (402)";
  if (status === 429) return "API key của admin đang bị rate-limit (429 — gọi quá nhanh hoặc hết quota tạm thời)";
  if (status >= 500) return `Provider upstream gặp lỗi (${status} — server provider down)`;
  return `Provider upstream từ chối yêu cầu (${status})`;
}

export type ResolvedUpstream = {
  source: "PROVIDER" | "ENV_FALLBACK";
  providerId?: string;
  keyId?: string;
  baseUrl: string; // không trailing slash
  imagesBaseUrl?: string; // override base URL cho image endpoint (vd ChiaSeGPU tách `llm-2.chiasegpu.vn/v1`)
  apiKey: string; // plaintext
  providerType: ProviderType;
  upstreamModelSlug: string;
};

const DEFAULT_BASE: Partial<Record<ProviderType, string>> = {
  OPENAI: "https://api.openai.com/v1",
  ANTHROPIC: "https://api.anthropic.com/v1",
  GEMINI: "https://generativelanguage.googleapis.com/v1beta",
};

function stripTrailing(u: string) {
  return u.replace(/\/+$/, "");
}

// Detect: nếu apiType là ANTHROPIC/GEMINI nhưng baseUrl không trỏ API chính chủ → gateway OpenAI-compat
function normalizeProviderType(declared: ProviderType, baseUrl: string): ProviderType {
  const host = (() => {
    try {
      return new URL(baseUrl).hostname.toLowerCase();
    } catch {
      return baseUrl.toLowerCase();
    }
  })();
  if (declared === "ANTHROPIC" && !host.endsWith("anthropic.com")) {
    return "OPENAI_COMPATIBLE";
  }
  if (declared === "GEMINI" && !host.endsWith("googleapis.com") && !host.endsWith("google.com")) {
    return "OPENAI_COMPATIBLE";
  }
  return declared;
}

function envFallback(modelSlug: string): ResolvedUpstream {
  const baseUrl = stripTrailing(process.env.BEEKNOEE_BASE_URL || "");
  const apiKey = process.env.BEEKNOEE_API_KEY || "";
  if (!baseUrl || !apiKey) {
    throw new UpstreamError(
      503,
      "Upstream chưa cấu hình — model chưa gán Provider và BEEKNOEE_BASE_URL/API_KEY env trống."
    );
  }
  // Một số gateway (ChiaSeGPU) tách host cho image/video. Cho phép env override.
  const imagesBaseUrl = process.env.BEEKNOEE_IMAGES_BASE_URL
    ? stripTrailing(process.env.BEEKNOEE_IMAGES_BASE_URL)
    : undefined;
  return {
    source: "ENV_FALLBACK",
    baseUrl,
    imagesBaseUrl,
    apiKey,
    providerType: "OPENAI_COMPATIBLE",
    upstreamModelSlug: modelSlug,
  };
}

type RawKey = {
  id: string;
  encryptedKey: string;
  enabled: boolean;
  errorCount: number;
  lastErrorAt: Date | null;
  lastUsedAt: Date | null;
  totalRequests: number;
};

function isKeyHealthy(k: RawKey): boolean {
  if (!k.enabled) return false;
  if (k.errorCount < ERROR_THRESHOLD) return true;
  if (!k.lastErrorAt) return true;
  return Date.now() - k.lastErrorAt.getTime() >= ERROR_COOLDOWN_MS;
}

async function pickKeyByStrategy(
  providerId: string,
  routing: string,
  rrCursor: number,
  keys: RawKey[]
): Promise<RawKey | null> {
  const healthy = keys.filter(isKeyHealthy);
  if (healthy.length === 0) return null;

  switch (routing) {
    case "FAILOVER": {
      // Luôn lấy key đầu tiên còn khoẻ (ưu tiên theo createdAt asc đã sort sẵn)
      return healthy[0];
    }
    case "RANDOM": {
      return healthy[Math.floor(Math.random() * healthy.length)];
    }
    case "LEAST_USED": {
      return [...healthy].sort((a, b) => {
        const at = a.lastUsedAt?.getTime() ?? 0;
        const bt = b.lastUsedAt?.getTime() ?? 0;
        return at - bt;
      })[0];
    }
    case "ROUND_ROBIN":
    default: {
      const idx = rrCursor % healthy.length;
      const picked = healthy[idx];
      // Advance cursor (best-effort; race condition không nghiêm trọng)
      await prisma.provider
        .update({
          where: { id: providerId },
          data: { rrCursor: { increment: 1 } },
        })
        .catch(() => undefined);
      return picked;
    }
  }
}

export async function resolveUpstream(
  modelSlug: string
): Promise<ResolvedUpstream> {
  const model = await prisma.model.findUnique({
    where: { slug: modelSlug },
    include: {
      providerRef: {
        include: {
          keys: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!model) {
    throw new UpstreamError(404, `Model '${modelSlug}' not found`);
  }

  // === ƯU TIÊN 1: Key gắn trực tiếp vào Model (flow mới, 1 model = 1 key) ===
  if (model.apiKeyEnc) {
    let plaintext: string;
    try {
      plaintext = decryptKey(model.apiKeyEnc);
    } catch (e: any) {
      throw new UpstreamError(
        500,
        `Không decrypt được API key của model '${modelSlug}': ${e?.message || e}`
      );
    }
    const declaredType = (model.apiType || "OPENAI_COMPATIBLE") as ProviderType;
    const baseUrl = stripTrailing(model.apiBaseUrl || DEFAULT_BASE[declaredType] || "");
    if (!baseUrl) {
      throw new UpstreamError(
        503,
        `Model '${modelSlug}' thiếu Base URL cho type ${declaredType}.`
      );
    }
    // Heuristic quan trọng: admin có thể chọn apiType=ANTHROPIC/GEMINI cho mục đích branding/logo,
    // nhưng baseUrl thực tế trỏ tới gateway OpenAI-compat (vd ChiaSeGPU, OpenRouter, LiteLLM proxy...).
    // Khi đó gateway không hiểu /messages + x-api-key của Anthropic → trả 400/403.
    // → Nếu baseUrl KHÔNG phải API chính chủ thì luôn coi như OPENAI_COMPATIBLE.
    const type = normalizeProviderType(declaredType, baseUrl);
    return {
      source: "PROVIDER",
      baseUrl,
      imagesBaseUrl: model.apiBaseUrlImages ? stripTrailing(model.apiBaseUrlImages) : undefined,
      apiKey: plaintext,
      providerType: type,
      upstreamModelSlug: model.upstreamSlug ?? model.slug,
    };
  }

  // === ƯU TIÊN 2: Provider relation cũ (backward-compat cho data cũ) ===
  if (model.providerRef) {
    const provider = model.providerRef;
    if (!provider.enabled) {
      throw new UpstreamError(
        503,
        `Provider '${provider.name}' đang tắt — liên hệ admin.`
      );
    }
    if (provider.keys.length === 0) {
      throw new UpstreamError(
        503,
        `Provider '${provider.name}' chưa có API key — liên hệ admin.`
      );
    }

    const picked = await pickKeyByStrategy(
      provider.id,
      provider.routing,
      provider.rrCursor,
      provider.keys
    );
    if (!picked) {
      throw new UpstreamError(
        503,
        `Hết key khả dụng cho provider '${provider.name}'. Tất cả key đang trong cooldown.`
      );
    }

    let plaintext: string;
    try {
      plaintext = decryptKey(picked.encryptedKey);
    } catch (e: any) {
      await markKeyError(picked.id).catch(() => undefined);
      throw new UpstreamError(
        500,
        `Không decrypt được API key (${picked.id}): ${e?.message || e}`
      );
    }

    const declaredType = provider.type as ProviderType;
    const baseUrl = stripTrailing(provider.baseUrl || DEFAULT_BASE[declaredType] || "");
    if (!baseUrl) {
      throw new UpstreamError(
        503,
        `Provider '${provider.name}' thiếu baseUrl cho type ${declaredType}.`
      );
    }
    const type = normalizeProviderType(declaredType, baseUrl);

    return {
      source: "PROVIDER",
      providerId: provider.id,
      keyId: picked.id,
      baseUrl,
      apiKey: plaintext,
      providerType: type,
      upstreamModelSlug: model.upstreamSlug ?? model.slug,
    };
  }

  // === ƯU TIÊN 3: Env fallback ===
  return envFallback(model.upstreamSlug ?? modelSlug);
}

export async function markKeySuccess(keyId: string): Promise<void> {
  await prisma.providerKey
    .update({
      where: { id: keyId },
      data: {
        errorCount: 0,
        lastUsedAt: new Date(),
        totalRequests: { increment: 1 },
      },
    })
    .catch(() => undefined);
}

export async function markKeyError(keyId: string): Promise<void> {
  await prisma.providerKey
    .update({
      where: { id: keyId },
      data: {
        errorCount: { increment: 1 },
        lastErrorAt: new Date(),
        totalErrors: { increment: 1 },
      },
    })
    .catch(() => undefined);
}

export type EndpointKind =
  | "chat"
  | "messages"
  | "images"
  | "videos"
  | "audio_speech"
  | "audio_transcriptions";

// Một số upstream gateway dùng path khác chuẩn OpenAI.
// Map host → path quirk. Cứ thêm vào đây khi gặp provider mới có path lạ.
//   - beeknoee: /image/generations (số ít), KHÔNG phải /images/generations
//   - beeknoee: /video/generations (số ít), KHÔNG phải /videos
const HOST_PATH_QUIRKS: Record<string, Partial<Record<EndpointKind, string>>> = {
  "platform.beeknoee.com": {
    images: "/image/generations",
    videos: "/video/generations",
  },
};

function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

// Nếu baseUrl đã chứa sẵn path endpoint (vd admin điền full URL tới /image/generations)
// thì dùng nguyên xi, không append nữa. Detect bằng việc URL có path segment cuối khớp pattern endpoint.
function baseUrlIsFullEndpoint(baseUrl: string, kind: EndpointKind): boolean {
  try {
    const u = new URL(baseUrl);
    const path = u.pathname.toLowerCase();
    // Heuristic: nếu path kết thúc bằng /generations | /messages | /completions | /speech | /transcriptions
    // → admin đã điền full endpoint, không append nữa.
    if (kind === "images" || kind === "videos") return /\/generations\/?$/.test(path) || /\/videos?\/?$/.test(path);
    if (kind === "audio_speech") return /\/speech\/?$/.test(path);
    if (kind === "audio_transcriptions") return /\/transcriptions\/?$/.test(path);
    if (kind === "chat") return /\/(chat\/)?completions\/?$/.test(path);
    if (kind === "messages") return /\/messages\/?$/.test(path);
    return false;
  } catch {
    return false;
  }
}

// Endpoint URL theo provider type
export function buildEndpointUrl(
  type: ProviderType,
  baseUrl: string,
  kind: EndpointKind
): string {
  // Escape hatch: admin điền sẵn full endpoint URL → dùng nguyên xi.
  if (baseUrlIsFullEndpoint(baseUrl, kind)) {
    return stripTrailing(baseUrl);
  }

  // Apply host quirk nếu có (vd beeknoee dùng /image/generations).
  const quirk = HOST_PATH_QUIRKS[hostOf(baseUrl)]?.[kind];

  // Image / Video / Audio endpoint — chỉ OPENAI / OPENAI_COMPATIBLE chạy được.
  // GEMINI/ANTHROPIC/OLLAMA chưa có endpoint chuẩn → throw để admin tạo provider OPENAI_COMPATIBLE
  // trỏ về OpenAI gateway / OpenRouter / Replicate.
  if (kind === "images") {
    if (type === "OPENAI" || type === "OPENAI_COMPATIBLE") return `${baseUrl}${quirk ?? "/images/generations"}`;
    throw new UpstreamError(400, `Provider type ${type} chưa hỗ trợ image generation. Tạo provider OPENAI_COMPATIBLE.`);
  }
  if (kind === "videos") {
    if (type === "OPENAI" || type === "OPENAI_COMPATIBLE") return `${baseUrl}${quirk ?? "/videos"}`;
    throw new UpstreamError(400, `Provider type ${type} chưa hỗ trợ video generation. Tạo provider OPENAI_COMPATIBLE.`);
  }
  if (kind === "audio_speech") {
    if (type === "OPENAI" || type === "OPENAI_COMPATIBLE") return `${baseUrl}${quirk ?? "/audio/speech"}`;
    throw new UpstreamError(400, `Provider type ${type} chưa hỗ trợ TTS. Tạo provider OPENAI_COMPATIBLE.`);
  }
  if (kind === "audio_transcriptions") {
    if (type === "OPENAI" || type === "OPENAI_COMPATIBLE") return `${baseUrl}${quirk ?? "/audio/transcriptions"}`;
    throw new UpstreamError(400, `Provider type ${type} chưa hỗ trợ STT. Tạo provider OPENAI_COMPATIBLE.`);
  }

  switch (type) {
    case "ANTHROPIC":
      return `${baseUrl}/messages`;
    case "OLLAMA":
      return kind === "messages" ? `${baseUrl}/api/chat` : `${baseUrl}/api/chat`;
    case "GEMINI":
      // OpenAI-compat endpoint (Google cung cấp /openai/chat/completions)
      return `${baseUrl}/openai/chat/completions`;
    case "OPENAI":
    case "OPENAI_COMPATIBLE":
    default:
      return `${baseUrl}/chat/completions`;
  }
}

// Auth header theo provider type
export function authHeaders(
  type: ProviderType,
  apiKey: string
): Record<string, string> {
  switch (type) {
    case "ANTHROPIC":
      return {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      };
    case "GEMINI":
    case "OPENAI":
    case "OPENAI_COMPATIBLE":
      return { Authorization: `Bearer ${apiKey}` };
    case "OLLAMA":
      // Ollama mặc định không cần auth, nhưng nếu có key (vd reverse-proxy)
      return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    default:
      return { Authorization: `Bearer ${apiKey}` };
  }
}

export type CallWithFailoverResult = {
  res: Response;
  used: ResolvedUpstream;
};

// Wrapper: retry tối đa maxAttempts qua các key khác nhau khi status fail.
// buildRequest sẽ được gọi mỗi attempt với upstream mới resolve.
export async function callWithFailover(
  modelSlug: string,
  _kind: EndpointKind,
  buildRequest: (u: ResolvedUpstream) => Promise<Response>,
  maxAttempts = 3
): Promise<CallWithFailoverResult> {
  let lastErr: any = null;
  let lastRes: Response | null = null;
  let lastUsed: ResolvedUpstream | null = null;

  let lastStatus = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let u: ResolvedUpstream;
    try {
      u = await resolveUpstream(modelSlug);
    } catch (e) {
      // Hết key / chưa cấu hình → ném luôn, không retry
      throw e;
    }

    try {
      const res = await buildRequest(u);
      const status = res.status;
      // Lỗi key-level → failover
      if (status === 401 || status === 402 || status === 403 || status === 429 || status >= 500) {
        if (u.keyId) await markKeyError(u.keyId);
        lastRes = res;
        lastUsed = u;
        lastStatus = status;
        lastErr = new UpstreamError(status, `Key fail ${status}`, null, u.source === "PROVIDER");
        // Nếu env fallback, không có key kế → break
        if (u.source === "ENV_FALLBACK") break;
        continue;
      }
      if (u.keyId) await markKeySuccess(u.keyId);
      return { res, used: u };
    } catch (e) {
      // Network error / timeout
      if (u.keyId) await markKeyError(u.keyId);
      lastErr = e;
      lastUsed = u;
      if (u.source === "ENV_FALLBACK") break;
    }
  }

  // Hết retry — phía admin (provider) thì throw rõ ràng để gateway báo lỗi đúng
  if (lastUsed?.source === "PROVIDER" && lastStatus > 0) {
    throw new UpstreamError(
      502,
      `API key của admin đang lỗi — ${describeAdminKeyError(lastStatus)}. Đã thử ${maxAttempts} key vẫn fail. Vui lòng thử lại sau hoặc báo admin kiểm tra Provider.`,
      lastRes ? await lastRes.text().catch(() => null) : null,
      true,
    );
  }
  // Env fallback / network — vẫn trả response cuối nếu có cho caller tự xử
  if (lastRes && lastUsed) {
    return { res: lastRes, used: lastUsed };
  }
  throw lastErr ?? new UpstreamError(502, "Hết key khả dụng sau retry", null, true);
}

// Health check: có ít nhất 1 cách kết nối upstream
export async function isUpstreamConfigured(): Promise<boolean> {
  if (process.env.BEEKNOEE_BASE_URL && process.env.BEEKNOEE_API_KEY) {
    return true;
  }
  // Model có apiKeyEnc trực tiếp
  const modelCount = await prisma.model
    .count({ where: { active: true, apiKeyEnc: { not: null } } })
    .catch(() => 0);
  if (modelCount > 0) return true;
  // Hoặc legacy provider
  const provCount = await prisma.provider
    .count({ where: { enabled: true, keys: { some: { enabled: true } } } })
    .catch(() => 0);
  return provCount > 0;
}
