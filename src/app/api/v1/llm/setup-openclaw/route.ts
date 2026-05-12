import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function plain(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = sp.get("key") ?? "";
  const os = (sp.get("os") ?? "linux").toLowerCase();
  const small = sp.get("small") ?? "";
  const medium = sp.get("medium") ?? "";
  const high = sp.get("high") ?? "";
  const botToken = sp.get("bot_token") ?? "";
  const userId = sp.get("user_id") ?? "";

  if (!key || !small || !medium || !high) {
    return plain("# Thiếu tham số: cần key, small, medium, high\nexit 1", 400);
  }

  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const cfg: Record<string, unknown> = {
    base_url: baseUrl,
    api_key: key,
    models: { small, medium, high },
  };
  if (botToken) cfg.telegram_bot_token = botToken;
  if (userId) cfg.telegram_user_id = userId;
  const config = JSON.stringify(cfg, null, 2);

  if (os === "windows") {
    const ps = [
      `# QUANGTHUONG AI — cấu hình OpenClaw (Windows)`,
      `$dir = "$env:USERPROFILE\\.openclaw"`,
      `New-Item -ItemType Directory -Force -Path $dir | Out-Null`,
      `@'`,
      config,
      `'@ | Set-Content -Encoding UTF8 -Path (Join-Path $dir 'config.json')`,
      `Write-Host "OpenClaw da duoc cau hinh cho QUANGTHUONG AI" -ForegroundColor Green`,
      `Write-Host "Khoi dong bot: openclaw start"`,
    ].join("\n");
    return plain(ps);
  }

  const sh = [
    `#!/bin/sh`,
    `# QUANGTHUONG AI — cấu hình OpenClaw (macOS / Linux)`,
    `set -e`,
    `mkdir -p "$HOME/.openclaw"`,
    `cat > "$HOME/.openclaw/config.json" <<'JSON'`,
    config,
    `JSON`,
    `printf "\\033[32m✓\\033[0m OpenClaw đã được cấu hình cho QUANGTHUONG AI\\n"`,
    `printf "  Base URL : ${baseUrl}\\n"`,
    `printf "  Mô hình  : small=${small} · medium=${medium} · high=${high}\\n"`,
    `printf "Khởi động bot: openclaw start\\n"`,
  ].join("\n");
  return plain(sh);
}
