// QUANGTHUONG AI — Setup script cho Claude Code CLI.
// GET /api/v1/llm/setup-claudecode?key=sk-bee-...&os=linux|mac|windows&haiku=...&sonnet=...&opus=...
// Trả về shell script (POSIX sh hoặc PowerShell) để pipe qua `curl ... | sh` / `irm ... | iex`.
// Style: banner, backup rc file + settings.json, install statusline, Configuration Complete + Next steps.
// API key luôn hiển thị FULL trong console output và trong settings.json đã ghi.

import { NextRequest } from "next/server";
import { POSIX_STATUSLINE_BODY } from "./_statusline";

const DEFAULT_MODEL = "claude-sonnet-4-5-20251001";
const BASE_URL = "https://quangthuong-ai.vercel.app/api";

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function psQuote(value: string) {
  return `'${value.replace(/'/g, `''`)}'`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key")?.trim();
  const os = (url.searchParams.get("os") || "mac").toLowerCase();
  const haiku = url.searchParams.get("haiku") || DEFAULT_MODEL;
  const sonnet = url.searchParams.get("sonnet") || DEFAULT_MODEL;
  const opus = url.searchParams.get("opus") || sonnet;

  if (!key || key === "API_KEY_CUA_BAN") {
    return new Response("Missing key\n", { status: 400 });
  }
  // Chặn key rút gọn (UI sinh "sk-bee-XX...XXXX" khi user chưa dán key đầy đủ).
  // Phải có key đầy đủ thì script mới ghi đúng vào settings.json + .zshrc.
  if (key.includes("...") || !/^sk-bee-[A-Za-z0-9_-]{20,}$/.test(key)) {
    return new Response(
      "API key không hợp lệ. Hãy dán key ĐẦY ĐỦ (sk-bee-...) — không dùng dạng rút gọn.\n",
      { status: 400 },
    );
  }

  const isWindows = os === "windows" || os === "win";
  const body = isWindows
    ? buildPowerShell({ key, haiku, sonnet, opus })
    : buildPosix({ key, os, haiku, sonnet, opus });

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
// Sử dụng ký tự Unicode literal (đ, ✓, ✗, ·, ↑, ↓) — Next.js/Vercel sẽ stream UTF-8.
// `/bin/sh` printf không expand \u escapes nên ta nhúng trực tiếp ký tự.
function buildPosix(opts: {
  key: string; os: string; haiku: string; sonnet: string; opus: string;
}): string {
  const shellRc = opts.os === "linux" ? "$HOME/.bashrc" : "$HOME/.zshrc";
  return [
    `#!/bin/sh`,
    `set -e`,
    ``,
    `BASE_URL=${shellQuote(BASE_URL)}`,
    `API_KEY=${shellQuote(opts.key)}`,
    `MODEL=${shellQuote(opts.sonnet)}`,
    `SMALL_MODEL=${shellQuote(opts.haiku)}`,
    `OPUS_MODEL=${shellQuote(opts.opus)}`,
    `SHELL_RC="${shellRc}"`,
    `TS=$(date +%Y%m%d-%H%M%S)`,
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
    `printf '%s%s   QUANGTHUONG AI Claude Code Setup%s\\n' "$BOLD" "$CYAN" "$RESET"`,
    `printf '%s%s========================================%s\\n' "$BOLD" "$CYAN" "$RESET"`,
    `printf '\\n'`,
    `printf '%sEndpoint URL:%s %s\\n' "$BOLD" "$RESET" "$BASE_URL"`,
    `printf '%sAPI Key:%s      %s\\n' "$BOLD" "$RESET" "$API_KEY"`,
    `printf '\\n'`,
    ``,
    `mkdir -p "$HOME/.claude"`,
    ``,
    `#--- Shell environment ---`,
    `printf '%sConfiguring shell environment...%s\\n' "$BOLD" "$RESET"`,
    `if [ -f "$SHELL_RC" ]; then`,
    `  cp "$SHELL_RC" "$SHELL_RC.bak.$TS"`,
    `  printf '  %s✓%s Backed up %s -> %s.bak.%s\\n' "$GREEN" "$RESET" "$SHELL_RC" "$SHELL_RC" "$TS"`,
    `  grep -v 'ANTHROPIC_BASE_URL\\|ANTHROPIC_AUTH_TOKEN\\|ANTHROPIC_MODEL\\|ANTHROPIC_SMALL_FAST_MODEL\\|ANTHROPIC_OPUS_MODEL\\|ANTHROPIC_DEFAULT_HAIKU_MODEL\\|ANTHROPIC_DEFAULT_SONNET_MODEL\\|ANTHROPIC_DEFAULT_OPUS_MODEL\\|CLAUDE_CODE_DISABLE_1M_CONTEXT\\|API_TIMEOUT_MS' "$SHELL_RC" > "$SHELL_RC.tmp" || true`,
    `  mv "$SHELL_RC.tmp" "$SHELL_RC"`,
    `fi`,
    `cat >> "$SHELL_RC" <<EOF`,
    ``,
    `# QUANGTHUONG AI - Claude Code env (added $TS)`,
    `export ANTHROPIC_BASE_URL="$BASE_URL"`,
    `export ANTHROPIC_AUTH_TOKEN="$API_KEY"`,
    `export ANTHROPIC_MODEL="$MODEL"`,
    `export ANTHROPIC_SMALL_FAST_MODEL="$SMALL_MODEL"`,
    `export ANTHROPIC_DEFAULT_HAIKU_MODEL="$SMALL_MODEL"`,
    `export ANTHROPIC_DEFAULT_SONNET_MODEL="$MODEL"`,
    `export ANTHROPIC_DEFAULT_OPUS_MODEL="$OPUS_MODEL"`,
    `export CLAUDE_CODE_DISABLE_1M_CONTEXT="1"`,
    `export API_TIMEOUT_MS="600000"`,
    `EOF`,
    `printf '  %s✓%s Updated %s\\n\\n' "$GREEN" "$RESET" "$SHELL_RC"`,
    ``,
  ].join("\n") + buildPosixStatusline() + buildPosixSettings() + buildPosixDone();
}

function buildPosixStatusline(): string {
  // Statusline script được ghi nguyên văn vào ~/.claude/statusline.sh.
  // Heredoc 'STATUS' (single-quoted) → shell KHÔNG expand $VAR bên trong → giữ nguyên dấu \033 v.v.
  return [
    `#--- Statusline ---`,
    `printf '%sInstalling statusline script...%s\\n' "$BOLD" "$RESET"`,
    `STATUSLINE="$HOME/.claude/statusline.sh"`,
    `if [ -f "$STATUSLINE" ]; then`,
    `  cp "$STATUSLINE" "$STATUSLINE.bak.$TS"`,
    `fi`,
    `cat > "$STATUSLINE" <<'STATUS'`,
    POSIX_STATUSLINE_BODY.replace(/\n$/, ""),
    `STATUS`,
    `chmod +x "$STATUSLINE"`,
    `printf '  %s✓%s Installed %s\\n\\n' "$GREEN" "$RESET" "$STATUSLINE"`,
    ``,
  ].join("\n");
}

function buildPosixSettings(): string {
  return [
    `#--- settings.json ---`,
    `printf '%sConfiguring Claude Code settings...%s\\n' "$BOLD" "$RESET"`,
    `SETTINGS="$HOME/.claude/settings.json"`,
    `if [ -f "$SETTINGS" ]; then`,
    `  cp "$SETTINGS" "$SETTINGS.bak.$TS"`,
    `  printf '  %s✓%s Backed up %s -> %s.bak.%s\\n' "$GREEN" "$RESET" "$SETTINGS" "$SETTINGS" "$TS"`,
    `fi`,
    ``,
    `# Merge với settings.json cũ qua python3 nếu có (giữ permissions/tools), fallback ghi đè bằng heredoc.`,
    `if command -v python3 >/dev/null 2>&1; then`,
    `BASE_URL="$BASE_URL" API_KEY="$API_KEY" MODEL="$MODEL" SMALL_MODEL="$SMALL_MODEL" OPUS_MODEL="$OPUS_MODEL" python3 - <<'PY'`,
    `import json, os`,
    `from pathlib import Path`,
    `p = Path.home() / '.claude/settings.json'`,
    `try:`,
    `    data = json.loads(p.read_text()) if p.exists() else {}`,
    `except Exception:`,
    `    data = {}`,
    `data.setdefault('env', {})`,
    `data['env']['ANTHROPIC_BASE_URL']         = os.environ['BASE_URL']`,
    `data['env']['ANTHROPIC_AUTH_TOKEN']       = os.environ['API_KEY']`,
    `data['env']['ANTHROPIC_MODEL']              = os.environ['MODEL']`,
    `data['env']['ANTHROPIC_SMALL_FAST_MODEL']   = os.environ['SMALL_MODEL']`,
    `data['env']['ANTHROPIC_DEFAULT_HAIKU_MODEL']  = os.environ['SMALL_MODEL']`,
    `data['env']['ANTHROPIC_DEFAULT_SONNET_MODEL'] = os.environ['MODEL']`,
    `data['env']['ANTHROPIC_DEFAULT_OPUS_MODEL']   = os.environ['OPUS_MODEL']`,
    `data['env']['CLAUDE_CODE_DISABLE_1M_CONTEXT'] = '1'`,
    `data['env']['API_TIMEOUT_MS'] = '600000'`,
    `data['env'].pop('ANTHROPIC_OPUS_MODEL', None)`,
    `data['disableLoginPrompt'] = True`,
    `data['statusLine'] = { 'type': 'command', 'command': str(Path.home() / '.claude/statusline.sh'), 'padding': 0 }`,
    `p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\\n')`,
    `PY`,
    `else`,
    `cat > "$SETTINGS" <<EOF`,
    `{`,
    `  "env": {`,
    `    "ANTHROPIC_BASE_URL": "$BASE_URL",`,
    `    "ANTHROPIC_AUTH_TOKEN": "$API_KEY",`,
    `    "ANTHROPIC_MODEL": "$MODEL",`,
    `    "ANTHROPIC_SMALL_FAST_MODEL": "$SMALL_MODEL",`,
    `    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "$SMALL_MODEL",`,
    `    "ANTHROPIC_DEFAULT_SONNET_MODEL": "$MODEL",`,
    `    "ANTHROPIC_DEFAULT_OPUS_MODEL": "$OPUS_MODEL",`,
    `    "CLAUDE_CODE_DISABLE_1M_CONTEXT": "1",`,
    `    "API_TIMEOUT_MS": "600000"`,
    `  },`,
    `  "disableLoginPrompt": true,`,
    `  "statusLine": {`,
    `    "type": "command",`,
    `    "command": "$HOME/.claude/statusline.sh",`,
    `    "padding": 0`,
    `  }`,
    `}`,
    `EOF`,
    `fi`,
    `printf '  %s✓%s Updated %s\\n\\n' "$GREEN" "$RESET" "$SETTINGS"`,
    ``,
  ].join("\n");
}

function buildPosixDone(): string {
  return [
    `#--- Done ---`,
    `printf '%s%s========================================%s\\n' "$BOLD" "$GREEN" "$RESET"`,
    `printf '%s%s   Configuration Complete!%s\\n' "$BOLD" "$GREEN" "$RESET"`,
    `printf '%s%s========================================%s\\n' "$BOLD" "$GREEN" "$RESET"`,
    `printf '\\n'`,
    `printf '%sSummary:%s\\n' "$BOLD" "$RESET"`,
    `printf '  Endpoint   : %s\\n' "$BASE_URL"`,
    `printf '  API Key    : %s\\n' "$API_KEY"`,
    `printf '  Sonnet     : %s\\n' "$MODEL"`,
    `printf '  Haiku      : %s\\n' "$SMALL_MODEL"`,
    `printf '  Opus       : %s\\n' "$OPUS_MODEL"`,
    `printf '  Statusline : %sEnabled%s (tier, balance, model, cost)\\n' "$GREEN" "$RESET"`,
    `printf '\\n'`,
    `printf '%sNext steps:%s\\n' "$BOLD" "$RESET"`,
    `printf '  1. Khởi động lại terminal (hoặc: %ssource %s%s)\\n' "$YELLOW" "$SHELL_RC" "$RESET"`,
    `printf '  2. Chạy: %sclaude%s\\n' "$YELLOW" "$RESET"`,
    `printf '  3. Nếu được hỏi đăng nhập, chọn API Key và dán: %s%s%s\\n' "$DIM" "$API_KEY" "$RESET"`,
    `printf '\\n'`,
    ``,
  ].join("\n");
}

// ===== Windows PowerShell =====
function buildPowerShell(opts: {
  key: string; haiku: string; sonnet: string; opus: string;
}): string {
  return [
    `# QUANGTHUONG AI - Claude Code Setup (Windows PowerShell)`,
    `$ErrorActionPreference = 'Stop'`,
    ``,
    `$BaseUrl     = ${psQuote(BASE_URL)}`,
    `$ApiKey      = ${psQuote(opts.key)}`,
    `$Model       = ${psQuote(opts.sonnet)}`,
    `$SmallModel  = ${psQuote(opts.haiku)}`,
    `$OpusModel   = ${psQuote(opts.opus)}`,
    `$ts          = Get-Date -Format 'yyyyMMdd-HHmmss'`,
    `$claudeDir   = Join-Path $HOME '.claude'`,
    `$settings    = Join-Path $claudeDir 'settings.json'`,
    `$statusline  = Join-Path $claudeDir 'statusline.ps1'`,
    `if (-not (Test-Path $claudeDir)) { New-Item -ItemType Directory -Path $claudeDir | Out-Null }`,
    ``,
    `Write-Host ""`,
    `Write-Host "========================================" -ForegroundColor Cyan`,
    `Write-Host "   QUANGTHUONG AI Claude Code Setup"     -ForegroundColor Cyan`,
    `Write-Host "========================================" -ForegroundColor Cyan`,
    `Write-Host ""`,
    `Write-Host "Endpoint URL: $BaseUrl"`,
    `Write-Host "API Key:      $ApiKey"`,
    `Write-Host ""`,
    ``,
    `Write-Host "Configuring user environment variables..." -ForegroundColor White`,
    `[Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL',         $BaseUrl,    'User')`,
    `[Environment]::SetEnvironmentVariable('ANTHROPIC_AUTH_TOKEN',       $ApiKey,     'User')`,
    `[Environment]::SetEnvironmentVariable('ANTHROPIC_MODEL',              $Model,      'User')`,
    `[Environment]::SetEnvironmentVariable('ANTHROPIC_SMALL_FAST_MODEL',   $SmallModel, 'User')`,
    `[Environment]::SetEnvironmentVariable('ANTHROPIC_DEFAULT_HAIKU_MODEL',  $SmallModel, 'User')`,
    `[Environment]::SetEnvironmentVariable('ANTHROPIC_DEFAULT_SONNET_MODEL', $Model,      'User')`,
    `[Environment]::SetEnvironmentVariable('ANTHROPIC_DEFAULT_OPUS_MODEL',   $OpusModel,  'User')`,
    `[Environment]::SetEnvironmentVariable('CLAUDE_CODE_DISABLE_1M_CONTEXT', '1',         'User')`,
    `[Environment]::SetEnvironmentVariable('API_TIMEOUT_MS',                 '600000',    'User')`,
    `[Environment]::SetEnvironmentVariable('ANTHROPIC_OPUS_MODEL',         $null,       'User')`,
    `Write-Host "  [OK] User env vars set" -ForegroundColor Green`,
    `Write-Host ""`,
    ``,
    `Write-Host "Installing statusline script..." -ForegroundColor White`,
    `if (Test-Path $statusline) { Copy-Item $statusline "$statusline.bak.$ts" -Force }`,
    `$statuslineBody = @'`,
    `# QUANGTHUONG AI - Claude Code statusline (PowerShell)`,
    `$Input = [Console]::In.ReadToEnd()`,
    `function Format-Money($n) {`,
    `  if ($null -eq $n -or $n -eq '') { return '' }`,
    `  try { $v = [double]$n } catch { return '' }`,
    `  $sign = ''; if ($v -lt 0) { $sign = '-'; $v = -$v }`,
    `  return ($sign + ('{0:N0}' -f $v).Replace(',', '.') + 'đ')`,
    `}`,
    `try {`,
    `  $h = @{ Authorization = "Bearer $env:ANTHROPIC_AUTH_TOKEN" }`,
    `  $r = Invoke-RestMethod -Uri "$env:ANTHROPIC_BASE_URL/v1/me" -Headers $h -TimeoutSec 3 -ErrorAction Stop`,
    `  $balance = Format-Money $r.balance`,
    `  $tier    = $r.tier`,
    `} catch { $balance = ''; $tier = '' }`,
    `try { $j = $Input | ConvertFrom-Json } catch { $j = $null }`,
    `$model    = if ($j.model.display_name) { $j.model.display_name } elseif ($j.model.id) { $j.model.id } else { '' }`,
    `$cost     = if ($j.cost.total_cost_usd)      { $j.cost.total_cost_usd }      else { '' }`,
    `$linesAdd = if ($j.cost.total_lines_added)   { $j.cost.total_lines_added }   else { 0 }`,
    `$linesDel = if ($j.cost.total_lines_removed) { $j.cost.total_lines_removed } else { 0 }`,
    `$parts = @()`,
    `if ($tier)    { $parts += "[$tier]" }`,
    `if ($model)   { $parts += $model }`,
    `if ($balance) { $parts += "· $balance" }`,
    `$parts += "· +$linesAdd/-$linesDel"`,
    `if ($cost)    { $parts += "· \`$$cost" }`,
    `Write-Host ($parts -join ' ') -NoNewline`,
    `'@`,
    `Set-Content -Path $statusline -Value $statuslineBody -Encoding UTF8`,
    `Write-Host "  [OK] Installed $statusline" -ForegroundColor Green`,
    `Write-Host ""`,
    ``,
    `Write-Host "Configuring Claude Code settings..." -ForegroundColor White`,
    `if (Test-Path $settings) { Copy-Item $settings "$settings.bak.$ts" -Force }`,
    `if (Test-Path $settings) {`,
    `  try { $data = Get-Content $settings -Raw | ConvertFrom-Json -AsHashtable } catch { $data = @{} }`,
    `} else { $data = @{} }`,
    `if (-not $data.env) { $data.env = @{} }`,
    `$data.env.ANTHROPIC_BASE_URL         = $BaseUrl`,
    `$data.env.ANTHROPIC_AUTH_TOKEN       = $ApiKey`,
    `$data.env.ANTHROPIC_MODEL              = $Model`,
    `$data.env.ANTHROPIC_SMALL_FAST_MODEL   = $SmallModel`,
    `$data.env.ANTHROPIC_DEFAULT_HAIKU_MODEL  = $SmallModel`,
    `$data.env.ANTHROPIC_DEFAULT_SONNET_MODEL = $Model`,
    `$data.env.ANTHROPIC_DEFAULT_OPUS_MODEL   = $OpusModel`,
    `$data.env.CLAUDE_CODE_DISABLE_1M_CONTEXT = '1'`,
    `$data.env.API_TIMEOUT_MS = '600000'`,
    `$data.env.Remove('ANTHROPIC_OPUS_MODEL')`,
    `$data.disableLoginPrompt = $true`,
    `$data.statusLine = @{`,
    `  type    = 'command'`,
    `  command = "powershell -NoProfile -ExecutionPolicy Bypass -File \`"$statusline\`""`,
    `  padding = 0`,
    `}`,
    `$data | ConvertTo-Json -Depth 10 | Set-Content -Path $settings -Encoding UTF8`,
    `Write-Host "  [OK] Updated $settings" -ForegroundColor Green`,
    `Write-Host ""`,
    ``,
    `Write-Host "========================================" -ForegroundColor Green`,
    `Write-Host "   Configuration Complete!"               -ForegroundColor Green`,
    `Write-Host "========================================" -ForegroundColor Green`,
    `Write-Host ""`,
    `Write-Host "Summary:"`,
    `Write-Host "  Endpoint   : $BaseUrl"`,
    `Write-Host "  API Key    : $ApiKey"`,
    `Write-Host "  Sonnet     : $Model"`,
    `Write-Host "  Haiku      : $SmallModel"`,
    `Write-Host "  Opus       : $OpusModel"`,
    `Write-Host "  Statusline : Enabled (tier, balance, model, cost)"`,
    `Write-Host ""`,
    `Write-Host "Next steps:"`,
    `Write-Host "  1. Mở terminal mới để env vars có hiệu lực"`,
    `Write-Host "  2. Chạy: claude"`,
    `Write-Host "  3. Nếu được hỏi đăng nhập, chọn API Key và dán: $ApiKey"`,
    `Write-Host ""`,
  ].join("\r\n");
}
