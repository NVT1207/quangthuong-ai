// Builds 1-line "curl | sh" / "irm | iex" install commands for Claude Code & OpenClaw.
// The actual config-writing script is served by /api/v1/llm/setup-*.

export type OsTarget = "unix" | "windows";

export const CLAUDE_INSTALL = {
  unix: "curl -fsSL https://claude.ai/install.sh | bash",
  windows: 'powershell -c "irm https://claude.ai/install.ps1 | iex"',
};

export const OPENCLAW_INSTALL = {
  unix: "curl -fsSL https://openclaw.ai/install.sh | bash",
  windows: 'powershell -c "irm https://openclaw.ai/install.ps1 | iex"',
};

function osParam(os: OsTarget) {
  // POSIX script tự detect macOS/Linux qua `uname -s` → server không cần phân biệt.
  return os === "unix" ? "unix" : "windows";
}

function wrap(baseUrl: string, path: string, params: Record<string, string>, os: OsTarget): string {
  const qs = new URLSearchParams({ ...params, os: osParam(os) }).toString();
  const url = `${baseUrl}${path}?${qs}`;
  return os === "unix" ? `curl -sL "${url}" | sh` : `irm "${url}" | iex`;
}

export function buildClaudeOneLiner(opts: {
  baseUrl: string; os: OsTarget; apiKey: string;
  haiku: string; sonnet: string; opus: string;
}): string {
  return wrap(opts.baseUrl, "/api/v1/llm/setup-claudecode", {
    key: opts.apiKey,
    haiku: opts.haiku,
    sonnet: opts.sonnet,
    opus: opts.opus,
  }, opts.os);
}

export function buildOpenclawOneLiner(opts: {
  baseUrl: string; os: OsTarget; apiKey: string;
  small: string; medium: string; high: string;
  botToken?: string; userId?: string;
}): string {
  const params: Record<string, string> = {
    key: opts.apiKey,
    small: opts.small,
    medium: opts.medium,
    high: opts.high,
  };
  if (opts.botToken) params.bot_token = opts.botToken;
  if (opts.userId) params.user_id = opts.userId;
  return wrap(opts.baseUrl, "/api/v1/llm/setup-openclaw", params, opts.os);
}

export function buildClaudeUninstall(os: OsTarget): string {
  if (os === "unix") return "rm -f ~/.claude/settings.json";
  return 'Remove-Item -Force "$env:USERPROFILE\\.claude\\settings.json"';
}

export function buildOpenclawUninstall(os: OsTarget): string {
  if (os === "unix") return "rm -f ~/.openclaw/config.json";
  return 'Remove-Item -Force "$env:USERPROFILE\\.openclaw\\config.json"';
}
