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
  const haiku = sp.get("haiku") ?? "";
  const sonnet = sp.get("sonnet") ?? "";
  const opus = sp.get("opus") ?? "";

  if (!key || !haiku || !sonnet || !opus) {
    return plain("# Thiếu tham số: cần key, haiku, sonnet, opus\nexit 1", 400);
  }

  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;
  const anthropicBaseUrl = `${baseUrl}/api`;

  const settings = JSON.stringify(
    {
      env: {
        ANTHROPIC_BASE_URL: anthropicBaseUrl,
        ANTHROPIC_AUTH_TOKEN: key,
        ANTHROPIC_MODEL: sonnet,
        ANTHROPIC_SMALL_FAST_MODEL: haiku,
        ANTHROPIC_OPUS_MODEL: opus,
      },
    },
    null,
    2,
  );

  if (os === "windows") {
    const ps = [
      `# QUANGTHUONG AI — cấu hình Claude Code (Windows)`,
      `$dir = "$env:USERPROFILE\\.claude"`,
      `New-Item -ItemType Directory -Force -Path $dir | Out-Null`,
      `@'`,
      settings,
      `'@ | Set-Content -Encoding UTF8 -Path (Join-Path $dir 'settings.json')`,
      `Write-Host "Claude Code da duoc cau hinh cho QUANGTHUONG AI" -ForegroundColor Green`,
      `Write-Host "Mo terminal moi va chay: claude"`,
    ].join("\n");
    return plain(ps);
  }

  const sh = [
    `#!/bin/sh`,
    `# QUANGTHUONG AI — cấu hình Claude Code (macOS / Linux)`,
    `set -e`,
    `mkdir -p "$HOME/.claude"`,
    `cat > "$HOME/.claude/settings.json" <<'JSON'`,
    settings,
    `JSON`,
    `printf "\\033[32m✓\\033[0m Claude Code đã được cấu hình cho QUANGTHUONG AI\\n"`,
    `printf "  Base URL : ${anthropicBaseUrl}\\n"`,
    `printf "  Mô hình  : sonnet=${sonnet} · haiku=${haiku} · opus=${opus}\\n"`,
    `printf "Mở terminal mới và chạy: claude\\n"`,
  ].join("\n");
  return plain(sh);
}
