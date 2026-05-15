// QUANGTHUONG AI — Setup script cho OpenClaw (Telegram AI bot CLI).
// GET /api/v1/llm/setup-openclaw?key=sk-bee-...&os=linux|mac|windows&small=...&medium=...&high=...&bot_token=...&user_id=...
// Style: banner, in FULL API key + Bot Token + User ID, backup config cũ, merge JSON qua python3,
// Configuration Complete banner + Summary, restart LaunchAgent (macOS), Next steps + docs link.
// Key ĐẦY ĐỦ luôn được in ra console — không truncate.

import { NextRequest } from "next/server";

const BASE_URL = "https://quangthuong-ai.vercel.app/api";
const DOCS_URL = "https://quangthuong-ai.vercel.app/api-keys";

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function psQuote(value: string) {
  return `'${value.replace(/'/g, `''`)}'`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key")?.trim() ?? "";
  const os = (url.searchParams.get("os") || "mac").toLowerCase();
  const small = url.searchParams.get("small")?.trim() ?? "";
  const medium = url.searchParams.get("medium")?.trim() ?? "";
  const high = url.searchParams.get("high")?.trim() ?? "";
  const botToken = url.searchParams.get("bot_token")?.trim() ?? "";
  const userId = url.searchParams.get("user_id")?.trim() ?? "";

  if (!key || !small || !medium || !high) {
    return new Response(
      "# Thiếu tham số: cần key, small, medium, high\nexit 1\n",
      { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  // Chặn key rút gọn — script phải nhận key đầy đủ, không thì config sai => mọi request 401.
  if (key.includes("...") || !/^sk-bee-[A-Za-z0-9_-]{20,}$/.test(key)) {
    return new Response(
      "API key không hợp lệ. Hãy dán key ĐẦY ĐỦ (sk-bee-...) — không dùng dạng rút gọn.\n",
      { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const isWindows = os === "windows" || os === "win";
  const body = isWindows
    ? buildPowerShell({ key, small, medium, high, botToken, userId })
    : buildPosix({ key, os, small, medium, high, botToken, userId });

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": isWindows
        ? "text/plain; charset=utf-8"
        : "text/x-shellscript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

// ===== POSIX (macOS / Linux) =====
function buildPosix(opts: {
  key: string; os: string;
  small: string; medium: string; high: string;
  botToken: string; userId: string;
}): string {
  const isMac = opts.os !== "linux"; // mac default
  return [
    `#!/bin/sh`,
    `set -e`,
    ``,
    `BASE_URL=${shellQuote(BASE_URL)}`,
    `API_KEY=${shellQuote(opts.key)}`,
    `SMALL_MODEL=${shellQuote(opts.small)}`,
    `MEDIUM_MODEL=${shellQuote(opts.medium)}`,
    `HIGH_MODEL=${shellQuote(opts.high)}`,
    `BOT_TOKEN=${shellQuote(opts.botToken)}`,
    `TG_USER_ID=${shellQuote(opts.userId)}`,
    `DOCS_URL=${shellQuote(DOCS_URL)}`,
    `TS=$(date +%Y%m%d-%H%M%S)`,
    `CONFIG_DIR="$HOME/.openclaw"`,
    `CONFIG_FILE="$CONFIG_DIR/openclaw.json"`,
    ``,
    `CYAN=$(printf '\\033[36m')`,
    `GREEN=$(printf '\\033[32m')`,
    `YELLOW=$(printf '\\033[33m')`,
    `BOLD=$(printf '\\033[1m')`,
    `DIM=$(printf '\\033[2m')`,
    `RESET=$(printf '\\033[0m')`,
    ``,
    `printf '\\n'`,
    `printf '%s%s========================================%s\\n' "$BOLD" "$CYAN" "$RESET"`,
    `printf '%s%s   QUANGTHUONG AI OpenClaw Setup%s\\n' "$BOLD" "$CYAN" "$RESET"`,
    `printf '%s%s========================================%s\\n' "$BOLD" "$CYAN" "$RESET"`,
    `printf '\\n'`,
    `printf '%sEndpoint URL:%s %s\\n' "$BOLD" "$RESET" "$BASE_URL"`,
    `printf '%sAPI Key:%s      %s\\n' "$BOLD" "$RESET" "$API_KEY"`,
    `if [ -n "$BOT_TOKEN" ]; then`,
    `  printf '%sBot Token:%s    %s\\n' "$BOLD" "$RESET" "$BOT_TOKEN"`,
    `fi`,
    `if [ -n "$TG_USER_ID" ]; then`,
    `  printf '%sUser ID:%s      %s\\n' "$BOLD" "$RESET" "$TG_USER_ID"`,
    `fi`,
    `printf '%sModels:%s       small=%s · medium=%s · high=%s\\n' "$BOLD" "$RESET" "$SMALL_MODEL" "$MEDIUM_MODEL" "$HIGH_MODEL"`,
    `printf '\\n'`,
    ``,
    `mkdir -p "$CONFIG_DIR"`,
    ``,
    `#--- Backup ---`,
    `if [ -f "$CONFIG_FILE" ]; then`,
    `  cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$TS"`,
    `  printf '  %s✓%s Backed up existing config: %s.backup.%s\\n' "$GREEN" "$RESET" "$CONFIG_FILE" "$TS"`,
    `  printf '%sUpdating existing config (only QUANGTHUONG models & telegram)...%s\\n' "$BOLD" "$RESET"`,
    `else`,
    `  printf '%sGenerating config...%s\\n' "$BOLD" "$RESET"`,
    `fi`,
    ``,
    `#--- Merge config qua python3 (giữ lại key khác nếu có), fallback ghi đè bằng heredoc ---`,
    `if command -v python3 >/dev/null 2>&1; then`,
    `BASE_URL="$BASE_URL" API_KEY="$API_KEY" SMALL_MODEL="$SMALL_MODEL" MEDIUM_MODEL="$MEDIUM_MODEL" HIGH_MODEL="$HIGH_MODEL" BOT_TOKEN="$BOT_TOKEN" TG_USER_ID="$TG_USER_ID" CONFIG_FILE="$CONFIG_FILE" python3 - <<'PY'`,
    `import json, os`,
    `from pathlib import Path`,
    `p = Path(os.environ['CONFIG_FILE'])`,
    `try:`,
    `    data = json.loads(p.read_text()) if p.exists() else {}`,
    `except Exception:`,
    `    data = {}`,
    `data['base_url'] = os.environ['BASE_URL']`,
    `data['api_key']  = os.environ['API_KEY']`,
    `data['models']   = {`,
    `    'small':  os.environ['SMALL_MODEL'],`,
    `    'medium': os.environ['MEDIUM_MODEL'],`,
    `    'high':   os.environ['HIGH_MODEL'],`,
    `}`,
    `bt = os.environ.get('BOT_TOKEN', '').strip()`,
    `uid = os.environ.get('TG_USER_ID', '').strip()`,
    `if bt or uid:`,
    `    data.setdefault('telegram', {})`,
    `    if bt:  data['telegram']['bot_token'] = bt`,
    `    if uid: data['telegram']['user_id']   = uid`,
    `p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\\n')`,
    `PY`,
    `else`,
    `# Fallback: không có python3 -> ghi đè full config`,
    `{`,
    `  printf '{\\n'`,
    `  printf '  "base_url": "%s",\\n' "$BASE_URL"`,
    `  printf '  "api_key": "%s",\\n' "$API_KEY"`,
    `  printf '  "models": {\\n'`,
    `  printf '    "small": "%s",\\n'  "$SMALL_MODEL"`,
    `  printf '    "medium": "%s",\\n' "$MEDIUM_MODEL"`,
    `  printf '    "high": "%s"\\n'    "$HIGH_MODEL"`,
    `  if [ -n "$BOT_TOKEN" ] || [ -n "$TG_USER_ID" ]; then`,
    `    printf '  },\\n'`,
    `    printf '  "telegram": {\\n'`,
    `    if [ -n "$BOT_TOKEN" ] && [ -n "$TG_USER_ID" ]; then`,
    `      printf '    "bot_token": "%s",\\n' "$BOT_TOKEN"`,
    `      printf '    "user_id": "%s"\\n'    "$TG_USER_ID"`,
    `    elif [ -n "$BOT_TOKEN" ]; then`,
    `      printf '    "bot_token": "%s"\\n'  "$BOT_TOKEN"`,
    `    else`,
    `      printf '    "user_id": "%s"\\n'    "$TG_USER_ID"`,
    `    fi`,
    `    printf '  }\\n'`,
    `  else`,
    `    printf '  }\\n'`,
    `  fi`,
    `  printf '}\\n'`,
    `} > "$CONFIG_FILE"`,
    `fi`,
    `printf '  %s✓%s Created %s\\n\\n' "$GREEN" "$RESET" "$CONFIG_FILE"`,
    ``,
    `#--- Done banner ---`,
    `printf '%s%s========================================%s\\n' "$BOLD" "$GREEN" "$RESET"`,
    `printf '%s%s   Configuration Complete!%s\\n' "$BOLD" "$GREEN" "$RESET"`,
    `printf '%s%s========================================%s\\n' "$BOLD" "$GREEN" "$RESET"`,
    `printf '\\n'`,
    `printf '%sSummary:%s\\n' "$BOLD" "$RESET"`,
    `printf '  Config     : %s\\n' "$CONFIG_FILE"`,
    `printf '  Endpoint   : %s\\n' "$BASE_URL"`,
    `printf '  API Key    : %s\\n' "$API_KEY"`,
    `if [ -n "$BOT_TOKEN" ]; then`,
    `  printf '  Bot Token  : %s\\n' "$BOT_TOKEN"`,
    `fi`,
    `if [ -n "$TG_USER_ID" ]; then`,
    `  printf '  User ID    : %s\\n' "$TG_USER_ID"`,
    `fi`,
    `printf '  Small      : %s\\n' "$SMALL_MODEL"`,
    `printf '  Medium     : %s\\n' "$MEDIUM_MODEL"`,
    `printf '  High       : %s\\n' "$HIGH_MODEL"`,
    `printf '\\n'`,
    ``,
    isMac
      ? [
          `#--- Restart gateway (macOS LaunchAgent) ---`,
          `printf '%sRestarting gateway...%s\\n' "$BOLD" "$RESET"`,
          `UID_NUM=$(id -u)`,
          `if launchctl print "gui/$UID_NUM/ai.openclaw.gateway" >/dev/null 2>&1; then`,
          `  if launchctl kickstart -k "gui/$UID_NUM/ai.openclaw.gateway" >/dev/null 2>&1; then`,
          `    printf '  %s✓%s Restarted LaunchAgent: gui/%s/ai.openclaw.gateway\\n' "$GREEN" "$RESET" "$UID_NUM"`,
          `    printf '  %s✓%s Gateway restarted successfully\\n\\n' "$GREEN" "$RESET"`,
          `  else`,
          `    printf '  %s!%s Không restart được LaunchAgent — chạy: %sopenclaw start%s\\n\\n' "$YELLOW" "$RESET" "$YELLOW" "$RESET"`,
          `  fi`,
          `else`,
          `  printf '  %s-%s LaunchAgent chưa cài — chạy: %sopenclaw start%s\\n\\n' "$DIM" "$RESET" "$YELLOW" "$RESET"`,
          `fi`,
        ].join("\n")
      : [
          `#--- Linux: không có LaunchAgent ---`,
          `printf '%sKhởi động gateway:%s %sopenclaw start%s\\n\\n' "$BOLD" "$RESET" "$YELLOW" "$RESET"`,
        ].join("\n"),
    ``,
    `printf '%sNext steps:%s\\n' "$BOLD" "$RESET"`,
    `if [ -n "$BOT_TOKEN" ] && [ -n "$TG_USER_ID" ]; then`,
    `  printf '  1. Mở Telegram và nhắn cho bot của bạn\\n'`,
    `  printf '  2. Nếu chưa chạy: %sopenclaw start%s\\n' "$YELLOW" "$RESET"`,
    `else`,
    `  printf '  1. Bổ sung Bot Token & User ID trong %s nếu chưa có\\n' "$CONFIG_FILE"`,
    `  printf '  2. Chạy: %sopenclaw start%s\\n' "$YELLOW" "$RESET"`,
    `fi`,
    `printf '\\n'`,
    `printf '%sDocumentation:%s %s\\n' "$DIM" "$RESET" "$DOCS_URL"`,
    `printf '\\n'`,
    ``,
  ].join("\n");
}

// ===== Windows PowerShell =====
function buildPowerShell(opts: {
  key: string;
  small: string; medium: string; high: string;
  botToken: string; userId: string;
}): string {
  return [
    `# QUANGTHUONG AI - OpenClaw Setup (Windows PowerShell)`,
    `$ErrorActionPreference = 'Stop'`,
    ``,
    `$BaseUrl    = ${psQuote(BASE_URL)}`,
    `$ApiKey     = ${psQuote(opts.key)}`,
    `$Small      = ${psQuote(opts.small)}`,
    `$Medium     = ${psQuote(opts.medium)}`,
    `$High       = ${psQuote(opts.high)}`,
    `$BotToken   = ${psQuote(opts.botToken)}`,
    `$TgUserId   = ${psQuote(opts.userId)}`,
    `$DocsUrl    = ${psQuote(DOCS_URL)}`,
    `$ts         = Get-Date -Format 'yyyyMMdd-HHmmss'`,
    `$configDir  = Join-Path $HOME '.openclaw'`,
    `$configFile = Join-Path $configDir 'openclaw.json'`,
    `if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir | Out-Null }`,
    ``,
    `Write-Host ""`,
    `Write-Host "========================================" -ForegroundColor Cyan`,
    `Write-Host "   QUANGTHUONG AI OpenClaw Setup"        -ForegroundColor Cyan`,
    `Write-Host "========================================" -ForegroundColor Cyan`,
    `Write-Host ""`,
    `Write-Host "Endpoint URL: $BaseUrl"`,
    `Write-Host "API Key:      $ApiKey"`,
    `if ($BotToken) { Write-Host "Bot Token:    $BotToken" }`,
    `if ($TgUserId) { Write-Host "User ID:      $TgUserId" }`,
    `Write-Host "Models:       small=$Small | medium=$Medium | high=$High"`,
    `Write-Host ""`,
    ``,
    `if (Test-Path $configFile) {`,
    `  Copy-Item $configFile "$configFile.backup.$ts" -Force`,
    `  Write-Host "  [OK] Backed up existing config: $configFile.backup.$ts" -ForegroundColor Green`,
    `  Write-Host "Updating existing config (only QUANGTHUONG models & telegram)..."`,
    `} else {`,
    `  Write-Host "Generating config..."`,
    `}`,
    ``,
    `if (Test-Path $configFile) {`,
    `  try { $data = Get-Content $configFile -Raw | ConvertFrom-Json -AsHashtable } catch { $data = @{} }`,
    `} else { $data = @{} }`,
    `if (-not $data) { $data = @{} }`,
    `$data.base_url = $BaseUrl`,
    `$data.api_key  = $ApiKey`,
    `$data.models   = @{ small = $Small; medium = $Medium; high = $High }`,
    `if ($BotToken -or $TgUserId) {`,
    `  if (-not $data.telegram) { $data.telegram = @{} }`,
    `  if ($BotToken) { $data.telegram.bot_token = $BotToken }`,
    `  if ($TgUserId) { $data.telegram.user_id   = $TgUserId }`,
    `}`,
    `$data | ConvertTo-Json -Depth 10 | Set-Content -Path $configFile -Encoding UTF8`,
    `Write-Host "  [OK] Created $configFile" -ForegroundColor Green`,
    `Write-Host ""`,
    ``,
    `Write-Host "========================================" -ForegroundColor Green`,
    `Write-Host "   Configuration Complete!"               -ForegroundColor Green`,
    `Write-Host "========================================" -ForegroundColor Green`,
    `Write-Host ""`,
    `Write-Host "Summary:"`,
    `Write-Host "  Config     : $configFile"`,
    `Write-Host "  Endpoint   : $BaseUrl"`,
    `Write-Host "  API Key    : $ApiKey"`,
    `if ($BotToken) { Write-Host "  Bot Token  : $BotToken" }`,
    `if ($TgUserId) { Write-Host "  User ID    : $TgUserId" }`,
    `Write-Host "  Small      : $Small"`,
    `Write-Host "  Medium     : $Medium"`,
    `Write-Host "  High       : $High"`,
    `Write-Host ""`,
    `Write-Host "Khởi động gateway: openclaw start" -ForegroundColor Yellow`,
    `Write-Host ""`,
    `Write-Host "Next steps:"`,
    `if ($BotToken -and $TgUserId) {`,
    `  Write-Host "  1. Mở Telegram và nhắn cho bot của bạn"`,
    `  Write-Host "  2. Nếu chưa chạy: openclaw start"`,
    `} else {`,
    `  Write-Host "  1. Bổ sung Bot Token & User ID trong $configFile nếu chưa có"`,
    `  Write-Host "  2. Chạy: openclaw start"`,
    `}`,
    `Write-Host ""`,
    `Write-Host "Documentation: $DocsUrl" -ForegroundColor DarkGray`,
    `Write-Host ""`,
  ].join("\r\n");
}
