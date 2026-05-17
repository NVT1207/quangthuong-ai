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
  constructor(status: number, message: string, body?: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export type ResolvedUpstream = {
  source: "PROVIDER" | "ENV_FALLBACK";
  providerId?: string;
  keyId?: string;
  baseUrl: string; // không trailing slash
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

function envFallback(modelSlug: string): ResolvedUpstream {
  const baseUrl = stripTrailing(process.env.BEEKNOEE_BASE_URL || "");
  const apiKey = process.env.BEEKNOEE_API_KEY || "";
  if (!baseUrl || !apiKey) {
    throw new UpstreamError(
      503,
      "Upstream chưa cấu hình — model chưa gán Provider và BEEKNOEE_BASE_URL/API_KEY env trống."
    );
  }
  return {
    source: "ENV_FALLBACK",
    baseUrl,
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
    const type = (model.apiType || "OPENAI_COMPATIBLE") as ProviderType;
    const baseUrl = stripTrailing(model.apiBaseUrl || DEFAULT_BASE[type] || "");
    if (!baseUrl) {
      throw new UpstreamError(
        503,
        `Model '${modelSlug}' thiếu Base URL cho type ${type}.`
      );
    }
    return {
      source: "PROVIDER",
      baseUrl,
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

    const type = provider.type as ProviderType;
    const baseUrl = stripTrailing(provider.baseUrl || DEFAULT_BASE[type] || "");
    if (!baseUrl) {
      throw new UpstreamError(
        503,
        `Provider '${provider.name}' thiếu baseUrl cho type ${type}.`
      );
    }

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

// Endpoint URL theo provider type
export function buildEndpointUrl(
  type: ProviderType,
  baseUrl: string,
  kind: "chat" | "messages"
): string {
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
  _kind: "chat" | "messages",
  buildRequest: (u: ResolvedUpstream) => Promise<Response>,
  maxAttempts = 3
): Promise<CallWithFailoverResult> {
  let lastErr: any = null;
  let lastRes: Response | null = null;
  let lastUsed: ResolvedUpstream | null = null;

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
      if (status === 401 || status === 403 || status === 429 || status >= 500) {
        if (u.keyId) await markKeyError(u.keyId);
        lastRes = res;
        lastUsed = u;
        lastErr = new UpstreamError(status, `Key fail ${status}`);
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

  // Hết retry — nếu có response cuối, trả nguyên (caller tự xử status)
  if (lastRes && lastUsed) {
    return { res: lastRes, used: lastUsed };
  }
  throw lastErr ?? new UpstreamError(502, "Hết key khả dụng sau retry");
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
