"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Copy, Check, Terminal, Bot, Zap, Bell, AlertTriangle, GitBranch, Trash2, CheckCircle2 } from "lucide-react";
import {
  CLAUDE_INSTALL,
  OPENCLAW_INSTALL,
  buildClaudeOneLiner,
  buildClaudeUninstall,
  buildOpenclawOneLiner,
  buildOpenclawUninstall,
  type OsTarget,
} from "@/lib/cli-setup";

export type KeyItem = { id: string; name: string; prefix: string; suffix: string };
export type ModelOpt = { slug: string; displayName: string; provider: string };

type Props = { keys: KeyItem[]; models: ModelOpt[]; baseUrl: string };

export function CliPanels({ keys, models, baseUrl }: Props) {
  return (
    <div className="space-y-4">
      <Card title="Cài đặt Claude Code" subtitle="Cài đặt 1 lệnh" icon={<Terminal size={18} className="text-orange-300" />}>
        <ClaudeSetup keys={keys} models={models} baseUrl={baseUrl} />
      </Card>
      <Card title="Cài đặt OpenClaw" subtitle="Cài đặt 1 lệnh" icon={<Bot size={18} className="text-rose-300" />}>
        <OpenclawSetup keys={keys} models={models} baseUrl={baseUrl} />
      </Card>
    </div>
  );
}

function Card({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition"
      >
        <div className="w-10 h-10 rounded-xl bg-honey-500/10 border border-honey-500/20 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-ink-200/55">{subtitle}</p>
        </div>
        <ChevronDown size={16} className={`text-ink-200/40 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-white/5 p-5 space-y-5">{children}</div>}
    </div>
  );
}

function ClaudeSetup({ keys, models, baseUrl }: Props) {
  const [os, setOs] = useState<OsTarget>("unix");
  const [keyId, setKeyId] = useState<string>(keys[0]?.id ?? "");
  const [haiku, setHaiku] = useState("");
  const [sonnet, setSonnet] = useState("");
  const [opus, setOpus] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [showFull, setShowFull] = useState(false);
  const [shown, setShown] = useState(false);

  const selectedKey = keys.find((k) => k.id === keyId);
  const keyDisplay = revealedKey || (selectedKey ? `${selectedKey.prefix}...${selectedKey.suffix}` : "");
  // Claude Code BẮT BUỘC key đầy đủ — nếu không, script sẽ ghi `sk-bee-...XXXX` vào
  // ~/.claude/settings.json và mọi request đều 401.
  const hasFullKey = revealedKey.startsWith("sk-bee-") && !revealedKey.includes("...");
  const ready = Boolean(haiku && sonnet && opus && selectedKey && hasFullKey);

  // hide command output when any input changes — force re-click
  useEffect(() => { setShown(false); }, [os, keyId, revealedKey, haiku, sonnet, opus]);

  const cmd = useMemo(() => {
    if (!ready) return "";
    return buildClaudeOneLiner({ baseUrl, os, apiKey: keyDisplay, haiku, sonnet, opus });
  }, [baseUrl, os, keyDisplay, haiku, sonnet, opus, ready]);

  return (
    <>
      <Hint icon={<Terminal size={14} className="text-sky-300" />} accent="sky">
        Cấu hình Claude Code (CLI) để dùng API key này chỉ với 1 lệnh. Chọn hệ điều hành và model, sau đó copy lệnh và dán vào terminal.
      </Hint>

      <Section number={1} icon={<Bell size={14} className="text-orange-300" />} title="Cài đặt Claude Code">
        <p className="text-xs text-ink-200/55 mb-2">Nếu chưa cài Claude Code, chạy lệnh sau trong terminal:</p>
        <CmdRow label="Linux/macOS" cmd={CLAUDE_INSTALL.unix} accent="emerald" />
        <CmdRow label="Windows" cmd={CLAUDE_INSTALL.windows} accent="sky" />
      </Section>

      <Section number={2} icon={<Zap size={14} className="text-honey-300" />} title="Chọn hệ điều hành và model để lấy lệnh setup">
        <Label>HỆ ĐIỀU HÀNH</Label>
        <OsToggle os={os} onChange={setOs} />

        <Label className="mt-4 flex items-center gap-1.5">
          <GitBranch size={12} /> MAPPING MODEL CHO CLAUDE CODE
        </Label>
        <SelectRow label="Haiku (Fast)" value={haiku} onChange={setHaiku} models={models} />
        <SelectRow label="Sonnet (Default)" value={sonnet} onChange={setSonnet} models={models} />
        <SelectRow label="Opus (Powerful)" value={opus} onChange={setOpus} models={models} />

        <Label className="mt-4">API KEY</Label>
        <KeySelect keys={keys} keyId={keyId} setKeyId={setKeyId} />
        <RevealKeyRow keyId={keyId} revealedKey={revealedKey} setRevealedKey={setRevealedKey} showFull={showFull} setShowFull={setShowFull} />

        <GenerateBlock
          ready={ready}
          shown={shown}
          onClick={() => setShown(true)}
          cmd={cmd}
          warningWhenNotReady={
            !haiku || !sonnet || !opus
              ? "Chọn đầy đủ Haiku / Sonnet / Opus"
              : !hasFullKey
                ? "Bắt buộc dán key ĐẦY ĐỦ (sk-bee-...) — script sẽ ghi vào settings.json"
                : "Vui lòng chọn đầy đủ cả 3 model để tạo lệnh cài đặt"
          }
          finalCommand="claude"
        />
      </Section>

      <UninstallBlock
        title="Gỡ cài đặt Claude Code"
        warning="Thao tác này sẽ xoá cấu hình QUANGTHUONG AI khỏi Claude Code. Bạn cần đăng nhập lại bằng claude login sau khi gỡ."
        unixCmd={buildClaudeUninstall("unix")}
        winCmd={buildClaudeUninstall("windows")}
        os={os}
      />
    </>
  );
}

function OpenclawSetup({ keys, models, baseUrl }: Props) {
  const [os, setOs] = useState<OsTarget>("unix");
  const [keyId, setKeyId] = useState<string>(keys[0]?.id ?? "");
  const [small, setSmall] = useState("");
  const [medium, setMedium] = useState("");
  const [high, setHigh] = useState("");
  const [botToken, setBotToken] = useState("");
  const [userId, setUserId] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [showFull, setShowFull] = useState(false);
  const [shown, setShown] = useState(false);

  const selectedKey = keys.find((k) => k.id === keyId);
  const keyDisplay = revealedKey || (selectedKey ? `${selectedKey.prefix}...${selectedKey.suffix}` : "");
  const ready = Boolean(small && medium && high && selectedKey);

  useEffect(() => { setShown(false); }, [os, keyId, revealedKey, small, medium, high, botToken, userId]);

  const cmd = useMemo(() => {
    if (!ready) return "";
    return buildOpenclawOneLiner({
      baseUrl, os, apiKey: keyDisplay, small, medium, high,
      botToken: botToken || undefined, userId: userId || undefined,
    });
  }, [baseUrl, os, keyDisplay, small, medium, high, botToken, userId, ready]);

  return (
    <>
      <Hint icon={<Bot size={14} className="text-sky-300" />} accent="sky">
        Cấu hình OpenClaw (Telegram AI bot) để dùng API key này chỉ với 1 lệnh. Chọn hệ điều hành, model mapping và nhập Telegram bot token/user ID.
      </Hint>

      <Section number={1} icon={<Bell size={14} className="text-orange-300" />} title="Cài đặt OpenClaw">
        <p className="text-xs text-ink-200/55 mb-2">Nếu chưa cài OpenClaw, chạy lệnh sau trong terminal:</p>
        <CmdRow label="Linux/macOS" cmd={OPENCLAW_INSTALL.unix} accent="emerald" />
        <CmdRow label="Windows" cmd={OPENCLAW_INSTALL.windows} accent="sky" />
      </Section>

      <Section number={2} icon={<Zap size={14} className="text-honey-300" />} title="Chọn hệ điều hành và model để lấy lệnh setup">
        <Label>HỆ ĐIỀU HÀNH</Label>
        <OsToggle os={os} onChange={setOs} />

        <Label className="mt-4 flex items-center gap-1.5">
          <GitBranch size={12} /> MAPPING MODEL CHO OPENCLAW
        </Label>
        <SelectRow label="Small (Fast)" value={small} onChange={setSmall} models={models} />
        <SelectRow label="Medium (Default)" value={medium} onChange={setMedium} models={models} />
        <SelectRow label="High (Powerful)" value={high} onChange={setHigh} models={models} />

        <div className="mt-4 flex items-center justify-between">
          <Label>TELEGRAM BOT TOKEN</Label>
          <a href="https://t.me/BotFather" target="_blank" className="text-[11px] text-sky-300 hover:underline">Mở @BotFather để tạo Bot →</a>
        </div>
        <input
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          className="input w-full text-sm font-mono"
          placeholder="123456789:ABCDefGhIjK... (tuỳ chọn)"
        />

        <div className="mt-3 flex items-center justify-between">
          <Label>TELEGRAM USER ID</Label>
          <a href="https://t.me/userinfobot" target="_blank" className="text-[11px] text-sky-300 hover:underline">Mở @userinfobot để lấy ID →</a>
        </div>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="input w-full text-sm font-mono"
          placeholder="123456789 (tuỳ chọn)"
        />

        <Label className="mt-4">API KEY</Label>
        <KeySelect keys={keys} keyId={keyId} setKeyId={setKeyId} />
        <RevealKeyRow keyId={keyId} revealedKey={revealedKey} setRevealedKey={setRevealedKey} showFull={showFull} setShowFull={setShowFull} />

        <GenerateBlock
          ready={ready}
          shown={shown}
          onClick={() => setShown(true)}
          cmd={cmd}
          warningWhenNotReady="Vui lòng chọn đầy đủ cả 3 model để tạo lệnh cài đặt"
          finalCommand="openclaw start"
        />
      </Section>

      <UninstallBlock
        title="Gỡ cài đặt OpenClaw"
        warning="Thao tác này sẽ xoá cấu hình OpenClaw. Bạn cần chạy lại lệnh cài đặt nếu muốn dùng lại."
        unixCmd={buildOpenclawUninstall("unix")}
        winCmd={buildOpenclawUninstall("windows")}
        os={os}
      />
    </>
  );
}

// ───── primitives ─────

function Hint({ icon, children, accent = "honey" }: { icon: React.ReactNode; children: React.ReactNode; accent?: "honey" | "sky" }) {
  const cls = accent === "sky" ? "border-sky-500/20 bg-sky-500/5" : "border-honey-500/20 bg-honey-500/5";
  return (
    <div className={`rounded-xl border ${cls} px-4 py-3 flex items-start gap-2 text-sm text-ink-100/85`}>
      <span className="mt-0.5">{icon}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}

function Section({ number, icon, title, children }: { number: number; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-2 font-semibold mb-3">
        {icon}
        Bước {number}: {title}
      </p>
      {children}
    </div>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[10px] tracking-wider text-ink-200/55 mb-1.5 font-mono uppercase ${className}`}>{children}</p>;
}

function CmdRow({ label, cmd, accent }: { label: string; cmd: string; accent: "emerald" | "sky" }) {
  const badge = accent === "emerald" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-sky-500/15 text-sky-300 border-sky-500/25";
  return (
    <div className="flex items-center gap-2 mb-2 last:mb-0">
      <span className={`text-[10px] font-mono px-2 py-1 rounded border ${badge} shrink-0`}>{label}</span>
      <code className="flex-1 input font-mono text-xs overflow-x-auto whitespace-nowrap">{cmd}</code>
      <CopyButton text={cmd} />
    </div>
  );
}

function OsToggle({ os, onChange }: { os: OsTarget; onChange: (v: OsTarget) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["unix", "windows"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
            os === v
              ? "bg-sky-500/15 text-sky-200 border-sky-500/40"
              : "bg-ink-950/40 text-ink-200/65 border-white/5 hover:text-white"
          }`}
        >
          {v === "unix" ? " macOS / Linux" : "⊞ Windows"}
        </button>
      ))}
    </div>
  );
}

function SelectRow({ label, value, onChange, models }: { label: string; value: string; onChange: (v: string) => void; models: ModelOpt[] }) {
  return (
    <div className="mb-2 last:mb-0 flex items-center gap-3">
      <span className="text-xs text-ink-200/70 w-32 shrink-0">{label}<span className="text-rose-300">*</span>:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input flex-1 text-sm">
        <option value="">Bắt buộc — chọn model...</option>
        {models.map((m) => (
          <option key={m.slug} value={m.slug}>{m.displayName} · {m.provider} · {m.slug}</option>
        ))}
      </select>
    </div>
  );
}

function KeySelect({ keys, keyId, setKeyId }: { keys: KeyItem[]; keyId: string; setKeyId: (v: string) => void }) {
  if (keys.length === 0) {
    return <div className="input text-sm text-ink-200/50 italic">Chưa có API key — tạo 1 key ở trên trước</div>;
  }
  return (
    <select value={keyId} onChange={(e) => setKeyId(e.target.value)} className="input w-full text-sm">
      {keys.map((k) => (
        <option key={k.id} value={k.id}>{k.name} ({k.prefix}...{k.suffix})</option>
      ))}
    </select>
  );
}

function RevealKeyRow({ keyId, revealedKey, setRevealedKey, showFull, setShowFull }: {
  keyId: string; revealedKey: string; setRevealedKey: (v: string) => void; showFull: boolean; setShowFull: (v: boolean) => void;
}) {
  if (!keyId) return null;
  return (
    <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-200/55 flex-wrap">
      {revealedKey ? (
        <span className="text-emerald-300">Đã dán key đầy đủ — lệnh sẽ hoạt động ngay.</span>
      ) : (
        <>
          <AlertTriangle size={11} className="text-honey-400" />
          <span>Lệnh dưới đây dùng key rút gọn. Dán key đầy đủ bạn đã lưu để lệnh chạy được:</span>
          <button type="button" onClick={() => setShowFull(!showFull)} className="text-sky-300 hover:underline">
            {showFull ? "Đóng" : "Dán key đầy đủ"}
          </button>
        </>
      )}
      {showFull && !revealedKey && (
        <input autoFocus placeholder="sk-bee-..." onChange={(e) => setRevealedKey(e.target.value)} className="input text-xs font-mono w-full mt-1" />
      )}
    </div>
  );
}

function GenerateBlock({ ready, shown, onClick, cmd, warningWhenNotReady, finalCommand }: {
  ready: boolean; shown: boolean; onClick: () => void; cmd: string; warningWhenNotReady: string; finalCommand: string;
}) {
  return (
    <>
      <button
        disabled={!ready}
        onClick={onClick}
        className={
          ready
            ? "mt-4 w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-violet-400"
            : "mt-4 w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 bg-ink-950/40 text-ink-200/35 border border-white/5 cursor-not-allowed"
        }
      >
        <Zap size={14} /> Lấy lệnh cài đặt
      </button>

      {!ready && (
        <p className="mt-2 text-[11px] text-honey-300 flex items-center justify-center gap-1">
          <AlertTriangle size={11} /> {warningWhenNotReady}
        </p>
      )}

      {shown && ready && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] tracking-wider text-emerald-300/90 font-mono uppercase flex items-center gap-1.5">
              <CheckCircle2 size={12} /> LỆNH CÀI ĐẶT (TERMINAL)
            </p>
            <CopyButton text={cmd} />
          </div>
          <pre className="text-xs p-4 rounded-xl border border-white/10 bg-black/40 overflow-x-auto whitespace-pre-wrap break-all"><code>{cmd}</code></pre>

          <div className="rounded-xl border border-honey-500/20 bg-honey-500/5 px-4 py-3 text-xs text-ink-100/85">
            <p className="font-semibold flex items-center gap-1.5 mb-2 text-honey-200"><Zap size={12} /> HƯỚNG DẪN</p>
            <ol className="space-y-1 list-decimal pl-5">
              <li>Copy lệnh ở trên</li>
              <li>Mở Terminal, dán lệnh và nhấn Enter</li>
              <li>Restart terminal, sau đó chạy: <code className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-honey-300">{finalCommand}</code></li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}

function UninstallBlock({ title, warning, unixCmd, winCmd, os }: { title: string; warning: string; unixCmd: string; winCmd: string; os: OsTarget }) {
  const [show, setShow] = useState(false);
  const cmd = os === "unix" ? unixCmd : winCmd;
  return (
    <div className="pt-5 border-t border-white/5">
      <p className="flex items-center gap-2 font-semibold mb-3 text-rose-200">
        <Trash2 size={14} /> {title}
      </p>
      <div className="rounded-xl border border-honey-500/20 bg-honey-500/5 px-4 py-2.5 text-xs text-ink-100/80 flex items-start gap-2">
        <AlertTriangle size={12} className="text-honey-400 mt-0.5 shrink-0" />
        <span>{warning}</span>
      </div>
      {!show ? (
        <button onClick={() => setShow(true)} className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 transition flex items-center justify-center gap-2">
          <Trash2 size={14} /> Lấy lệnh gỡ cài đặt
        </button>
      ) : (
        <div className="mt-3 relative rounded-xl border border-white/10 bg-black/40">
          <pre className="text-xs p-3 pr-12 overflow-x-auto whitespace-pre"><code>{cmd}</code></pre>
          <div className="absolute top-2 right-2"><CopyButton text={cmd} /></div>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-2 rounded-lg border border-white/10 bg-ink-950/60 text-ink-200/70 hover:text-white hover:border-white/20 transition"
      title="Copy"
    >
      {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
    </button>
  );
}
