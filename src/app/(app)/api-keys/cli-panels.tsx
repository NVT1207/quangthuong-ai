"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Copy, Check, Terminal, Bot, Zap, Bell, AlertTriangle, GitBranch, Trash2, CheckCircle2, Loader2 } from "lucide-react";
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

type Props = { keys: KeyItem[]; models: ModelOpt[]; baseUrl: string; revealed?: Record<string, string> };

export function CliPanels({ keys, models, baseUrl, revealed }: Props) {
  return (
    <div className="space-y-4">
      <Card title="Cài đặt Claude Code" subtitle="Cài đặt 1 lệnh" icon={<Terminal size={18} className="text-orange-300" />}>
        <ClaudeSetup keys={keys} models={models} baseUrl={baseUrl} revealed={revealed} />
      </Card>
      <Card title="Cài đặt OpenClaw" subtitle="Cài đặt 1 lệnh" icon={<Bot size={18} className="text-rose-300" />}>
        <OpenclawSetup keys={keys} models={models} baseUrl={baseUrl} revealed={revealed} />
      </Card>
    </div>
  );
}

// Wrapper không collapsible — dùng trong tab riêng. Render trực tiếp nội dung setup.
export function ClaudeSetupCard(props: Props) {
  return <div className="space-y-5"><ClaudeSetup {...props} /></div>;
}

export function OpenclawSetupCard(props: Props) {
  return <div className="space-y-5"><OpenclawSetup {...props} /></div>;
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

// Lấy danh sách model ĐÃ THÊM vào key này (subscribe) — dùng cho dropdown mapping.
function useKeyModels(keyId: string): { models: ModelOpt[]; loading: boolean } {
  const [models, setModels] = useState<ModelOpt[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!keyId) { setModels([]); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    fetch(`/api/keys/${keyId}/models`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const items: ModelOpt[] = (d.items ?? [])
          .filter((it: any) => it?.model)
          .map((it: any) => ({ slug: it.model.slug, displayName: it.model.displayName, provider: it.model.provider }));
        setModels(items);
      })
      .catch(() => { if (alive) setModels([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [keyId]);
  return { models, loading };
}

function ClaudeSetup({ keys, baseUrl, revealed }: Props) {
  // Modal luôn truyền đúng 1 key (đang xem chi tiết) → không cần chọn key nữa.
  const keyItem = keys[0];
  const keyId = keyItem?.id ?? "";
  const { models: keyModels, loading: loadingModels } = useKeyModels(keyId);

  const [os, setOs] = useState<OsTarget>("unix");
  const [haiku, setHaiku] = useState("");
  const [sonnet, setSonnet] = useState("");
  const [opus, setOpus] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [shown, setShown] = useState(false);

  // Ưu tiên: (1) key user paste tay, (2) key đã reveal ở list. Fallback prefix...suffix chỉ để hiển thị.
  const autoFullKey = revealed?.[keyId] ?? "";
  const effectiveKey = revealedKey || autoFullKey;
  const keyDisplay = effectiveKey || (keyItem ? `${keyItem.prefix}...${keyItem.suffix}` : "");
  // Claude Code BẮT BUỘC key đầy đủ — nếu không, script sẽ ghi `sk-bee-...XXXX` vào
  // ~/.claude/settings.json và mọi request đều 401.
  const hasFullKey = effectiveKey.startsWith("sk-bee-") && !effectiveKey.includes("...");
  const ready = Boolean(haiku && sonnet && opus && keyItem && hasFullKey);

  // hide command output when any input changes — force re-click
  useEffect(() => { setShown(false); }, [os, revealedKey, haiku, sonnet, opus]);

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
        <ModelMapping loading={loadingModels} models={keyModels}>
          <SelectRow label="Haiku (Fast)" value={haiku} onChange={setHaiku} models={keyModels} />
          <SelectRow label="Sonnet (Default)" value={sonnet} onChange={setSonnet} models={keyModels} />
          <SelectRow label="Opus (Powerful)" value={opus} onChange={setOpus} models={keyModels} />
        </ModelMapping>

        <FullKeyField hasFullKey={hasFullKey} setRevealedKey={setRevealedKey} target="settings.json" />

        <GenerateBlock
          ready={ready}
          shown={shown}
          onClick={() => setShown(true)}
          cmd={cmd}
          warningWhenNotReady={
            keyModels.length === 0
              ? "Key này chưa thêm model nào — vào tab Models để thêm trước"
              : !haiku || !sonnet || !opus
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

function OpenclawSetup({ keys, baseUrl, revealed }: Props) {
  // Modal luôn truyền đúng 1 key (đang xem chi tiết) → không cần chọn key nữa.
  const keyItem = keys[0];
  const keyId = keyItem?.id ?? "";
  const { models: keyModels, loading: loadingModels } = useKeyModels(keyId);

  const [os, setOs] = useState<OsTarget>("unix");
  const [small, setSmall] = useState("");
  const [medium, setMedium] = useState("");
  const [high, setHigh] = useState("");
  const [botToken, setBotToken] = useState("");
  const [userId, setUserId] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [shown, setShown] = useState(false);

  const autoFullKey = revealed?.[keyId] ?? "";
  const effectiveKey = revealedKey || autoFullKey;
  const keyDisplay = effectiveKey || (keyItem ? `${keyItem.prefix}...${keyItem.suffix}` : "");
  // OpenClaw cũng BẮT BUỘC key đầy đủ — script ghi vào ~/.openclaw/openclaw.json,
  // nếu là dạng "sk-bee-XXXX...YYYY" thì mọi request đều 401.
  const hasFullKey = effectiveKey.startsWith("sk-bee-") && !effectiveKey.includes("...");
  const ready = Boolean(small && medium && high && keyItem && hasFullKey);

  useEffect(() => { setShown(false); }, [os, revealedKey, small, medium, high, botToken, userId]);

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
        <ModelMapping loading={loadingModels} models={keyModels}>
          <SelectRow label="Small (Fast)" value={small} onChange={setSmall} models={keyModels} />
          <SelectRow label="Medium (Default)" value={medium} onChange={setMedium} models={keyModels} />
          <SelectRow label="High (Powerful)" value={high} onChange={setHigh} models={keyModels} />
        </ModelMapping>

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

        <FullKeyField hasFullKey={hasFullKey} setRevealedKey={setRevealedKey} target="openclaw.json" />

        <GenerateBlock
          ready={ready}
          shown={shown}
          onClick={() => setShown(true)}
          cmd={cmd}
          warningWhenNotReady={
            keyModels.length === 0
              ? "Key này chưa thêm model nào — vào tab Models để thêm trước"
              : !small || !medium || !high
                ? "Chọn đầy đủ Small / Medium / High"
                : !hasFullKey
                  ? "Bắt buộc dán key ĐẦY ĐỦ (sk-bee-...) — script sẽ ghi vào openclaw.json"
                  : "Vui lòng chọn đầy đủ cả 3 model để tạo lệnh cài đặt"
          }
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

// Bọc các dropdown mapping model. Hiển thị loading / cảnh báo nếu key chưa thêm
// model nào — chỉ render dropdown khi đã có ≥1 model đăng ký cho key này.
function ModelMapping({ loading, models, children }: { loading: boolean; models: ModelOpt[]; children: React.ReactNode }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-ink-200/55 py-3">
        <Loader2 size={13} className="animate-spin" /> Đang tải model của key...
      </div>
    );
  }
  if (models.length === 0) {
    return (
      <div className="rounded-xl border border-honey-500/30 bg-honey-500/5 px-4 py-3 flex items-start gap-2 text-xs text-ink-100/85">
        <AlertTriangle size={13} className="text-honey-400 mt-0.5 shrink-0" />
        <span>Key này chưa thêm model nào. Mở tab <b>Models</b> ở trên và thêm model, rồi quay lại đây để tạo lệnh.</span>
      </div>
    );
  }
  return <>{children}</>;
}

// Trường key đầy đủ. Key đầy đủ là BẮT BUỘC vì script ghi thẳng vào file cấu hình
// ({target}); nếu chỉ có dạng rút gọn thì mọi request đều 401.
function FullKeyField({ hasFullKey, setRevealedKey, target }: { hasFullKey: boolean; setRevealedKey: (v: string) => void; target: string }) {
  if (hasFullKey) {
    return (
      <div className="mt-4 flex items-center gap-1.5 text-[11px] text-emerald-300">
        <CheckCircle2 size={12} className="shrink-0" /> Đã có API key đầy đủ — lệnh sẽ hoạt động ngay.
      </div>
    );
  }
  return (
    <div className="mt-4">
      <Label>DÁN API KEY ĐẦY ĐỦ</Label>
      <div className="flex items-start gap-1.5 text-[11px] text-honey-300 mb-1.5">
        <AlertTriangle size={11} className="mt-0.5 shrink-0" />
        <span>Bắt buộc — script sẽ ghi key này vào <code className="font-mono">{target}</code>. Key rút gọn (sk-bee-...XXXX) sẽ khiến mọi request 401.</span>
      </div>
      <input
        placeholder="sk-bee-..."
        onChange={(e) => setRevealedKey(e.target.value.trim())}
        className="input text-xs font-mono w-full"
      />
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
