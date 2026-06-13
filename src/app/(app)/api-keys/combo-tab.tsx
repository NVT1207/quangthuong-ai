"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, RefreshCw, Plus, Trash2, Pencil, X, Layers, Network,
  ListOrdered, Repeat, BadgeDollarSign, GripVertical, AlertTriangle,
} from "lucide-react";

type Strategy = "FAILOVER" | "ROUND_ROBIN" | "CHEAPEST";

type ComboMember = {
  order: number;
  slug: string;
  displayName: string;
  provider: string;
  missing: boolean;
};
type Combo = {
  id: string;
  name: string;
  strategy: Strategy;
  enabled: boolean;
  createdAt: string;
  members: ComboMember[];
};
type ModelOpt = { slug: string; displayName: string; provider: string };

const MAX_MEMBERS = 20;
const MAX_NAME = 64;
const NAME_RE = /^[A-Za-z0-9._-]{1,64}$/;

const STRATEGIES: { value: Strategy; label: string; desc: string; icon: typeof ListOrdered; accent: string }[] = [
  { value: "FAILOVER", label: "Ưu tiên theo thứ tự", desc: "Thử lần lượt từ trên xuống, model lỗi thì chuyển model kế tiếp.", icon: ListOrdered, accent: "honey" },
  { value: "ROUND_ROBIN", label: "Xoay vòng", desc: "Phân tải đều — mỗi request bắt đầu từ model kế tiếp trong danh sách.", icon: Repeat, accent: "sky" },
  { value: "CHEAPEST", label: "Rẻ nhất trước", desc: "Ưu tiên model có giá input thấp nhất, rồi mới tới các model đắt hơn.", icon: BadgeDollarSign, accent: "emerald" },
];

const STRATEGY_BADGE: Record<Strategy, { label: string; cls: string }> = {
  FAILOVER: { label: "Ưu tiên thứ tự", cls: "border-honey-500/30 bg-honey-500/10 text-honey-300" },
  ROUND_ROBIN: { label: "Xoay vòng", cls: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
  CHEAPEST: { label: "Rẻ nhất trước", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
};

function accentRing(a: string, on: boolean) {
  const map: Record<string, string> = {
    honey: on ? "border-honey-500/60 bg-honey-500/10" : "border-white/10 hover:border-honey-500/30",
    sky: on ? "border-sky-500/60 bg-sky-500/10" : "border-white/10 hover:border-sky-500/30",
    emerald: on ? "border-emerald-500/60 bg-emerald-500/10" : "border-white/10 hover:border-emerald-500/30",
  };
  return map[a] || map.honey;
}

export function ComboTab({ keyId }: { keyId: string }) {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [models, setModels] = useState<ModelOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // modal state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Combo | null>(null);
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("FAILOVER");
  const [picks, setPicks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      try {
        const [cR, mR] = await Promise.all([
          fetch(`/api/keys/${keyId}/combos`),
          fetch(`/api/keys/${keyId}/models`),
        ]);
        const cD = await cR.json().catch(() => ({}));
        const mD = await mR.json().catch(() => ({}));
        setCombos(Array.isArray(cD.items) ? cD.items : []);
        const opts: ModelOpt[] = (Array.isArray(mD.items) ? mD.items : [])
          .filter((it: any) => it.enabled && it.model?.active)
          .map((it: any) => ({ slug: it.model.slug, displayName: it.model.displayName, provider: it.model.provider }))
          .filter((o: ModelOpt, i: number, arr: ModelOpt[]) => arr.findIndex((x) => x.slug === o.slug) === i);
        setModels(opts);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [keyId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = combos.length;
    const active = combos.filter((c) => c.enabled).length;
    return { total, active };
  }, [combos]);

  function openCreate() {
    setEditing(null);
    setName("");
    setStrategy("FAILOVER");
    setPicks([]);
    setFormErr(null);
    setOpen(true);
  }
  function openEdit(c: Combo) {
    setEditing(c);
    setName(c.name);
    setStrategy(c.strategy);
    setPicks(c.members.map((m) => m.slug));
    setFormErr(null);
    setOpen(true);
  }

  const nameOk = NAME_RE.test(name.trim());
  const canSave = nameOk && picks.length >= 1 && picks.length <= MAX_MEMBERS && picks.every(Boolean) && !saving;

  // slug đã subscribe mà chưa được chọn (để hiện trong dropdown thêm thành viên)
  function availableFor(idx: number): ModelOpt[] {
    const chosenElsewhere = new Set(picks.filter((_, i) => i !== idx));
    return models.filter((m) => !chosenElsewhere.has(m.slug));
  }

  function addMember() {
    if (picks.length >= MAX_MEMBERS) return;
    const used = new Set(picks);
    const next = models.find((m) => !used.has(m.slug));
    setPicks([...picks, next ? next.slug : ""]);
  }
  function setMember(idx: number, slug: string) {
    setPicks(picks.map((p, i) => (i === idx ? slug : p)));
  }
  function removeMember(idx: number) {
    setPicks(picks.filter((_, i) => i !== idx));
  }
  function moveMember(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= picks.length) return;
    const copy = [...picks];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    setPicks(copy);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setFormErr(null);
    const memberSlugs = [...new Set(picks.filter(Boolean))];
    const body = JSON.stringify({ name: name.trim(), strategy, memberSlugs });
    try {
      const url = editing ? `/api/keys/${keyId}/combos/${editing.id}` : `/api/keys/${keyId}/combos`;
      const r = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (r.ok) {
        setOpen(false);
        await load(true);
      } else {
        const d = await r.json().catch(() => ({}));
        setFormErr(d.error || "Không lưu được combo");
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggle(c: Combo) {
    if (busyId) return;
    setBusyId(c.id);
    try {
      const r = await fetch(`/api/keys/${keyId}/combos/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !c.enabled }),
      });
      if (r.ok) setCombos((prev) => prev.map((x) => (x.id === c.id ? { ...x, enabled: !x.enabled } : x)));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: Combo) {
    if (busyId) return;
    if (!confirm(`Xoá combo "${c.name}"? Client gọi model "${c.name}" sẽ không định tuyến nữa.`)) return;
    setBusyId(c.id);
    try {
      const r = await fetch(`/api/keys/${keyId}/combos/${c.id}`, { method: "DELETE" });
      if (r.ok) setCombos((prev) => prev.filter((x) => x.id !== c.id));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="py-14 text-center text-ink-200/40 text-sm flex items-center justify-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Đang tải combo...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Network size={17} className="text-honey-300" /> Combo định tuyến
          </h3>
          <p className="text-xs text-ink-200/55 mt-1 max-w-2xl">
            Gọi <b>1 tên combo</b> thay cho model — gateway tự động chuyển sang model dự phòng khi gặp lỗi.
            Đặt tên combo rồi dùng nó làm <code className="text-honey-300/90">model</code> khi gọi API.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="btn btn-ghost px-3 py-2 text-xs"
            title="Làm mới"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Làm mới
          </button>
          <button onClick={openCreate} className="btn btn-primary px-3 py-2 text-xs">
            <Plus size={14} /> Tạo combo
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wider text-ink-200/50">Tổng combo</p>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wider text-ink-200/50">Đang hoạt động</p>
          <p className="text-2xl font-bold mt-1 text-emerald-300">{stats.active}</p>
        </div>
      </div>

      {/* List / empty */}
      {combos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-ink-950/30 py-14 text-center">
          <Layers className="mx-auto text-ink-200/30 mb-3" size={30} />
          <p className="text-sm text-ink-200/65 font-medium">Chưa có combo nào</p>
          <p className="text-xs text-ink-200/45 mt-1 max-w-md mx-auto">
            Tạo combo để gọi 1 tên duy nhất mà vẫn tự động dự phòng qua nhiều model. Cần ít nhất 1 model đã thêm vào key này.
          </p>
          <button onClick={openCreate} className="btn btn-primary px-4 py-2 text-xs mt-4 mx-auto">
            <Plus size={14} /> Tạo combo đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {combos.map((c) => {
            const sb = STRATEGY_BADGE[c.strategy];
            const isBusy = busyId === c.id;
            const hasMissing = c.members.some((m) => m.missing);
            return (
              <div key={c.id} className={`card p-4 ${c.enabled ? "" : "opacity-60"}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-semibold text-white bg-white/5 border border-white/10 rounded-lg px-2 py-0.5">
                        {c.name}
                      </code>
                      <span className={`badge border ${sb.cls}`}>{sb.label}</span>
                      <span className="text-[11px] text-ink-200/50">{c.members.length} thành viên</span>
                      {hasMissing && (
                        <span className="badge border border-red-500/30 bg-red-500/10 text-red-300">
                          <AlertTriangle size={11} /> có model đã gỡ
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {c.members.map((m, i) => (
                        <span
                          key={`${m.slug}-${i}`}
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
                            m.missing
                              ? "bg-red-500/10 border-red-500/30 text-red-300 line-through"
                              : "bg-white/5 border-white/10 text-ink-200/70"
                          }`}
                          title={m.displayName}
                        >
                          {c.strategy === "FAILOVER" && <span className="text-ink-200/40">{i + 1}.</span>}
                          {m.slug}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* toggle */}
                    <button
                      onClick={() => toggle(c)}
                      disabled={isBusy}
                      title={c.enabled ? "Đang bật — bấm để tắt" : "Đang tắt — bấm để bật"}
                      className={`relative w-10 h-5.5 rounded-full transition shrink-0 ${
                        c.enabled ? "bg-emerald-500/80" : "bg-white/10"
                      }`}
                      style={{ height: 22 }}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                          c.enabled ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </button>
                    <button onClick={() => openEdit(c)} disabled={isBusy} className="btn btn-ghost p-2" title="Sửa">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => remove(c)} disabled={isBusy} className="btn btn-danger p-2" title="Xoá">
                      {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="card w-full max-w-lg max-h-[88vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-semibold">{editing ? "Sửa combo" : "Tạo combo định tuyến"}</h4>
              <button onClick={() => !saving && setOpen(false)} className="btn btn-ghost p-1.5">
                <X size={16} />
              </button>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="label flex items-center justify-between">
                <span>Tên combo</span>
                <span className={`text-[10px] ${name.length > MAX_NAME ? "text-red-400" : "text-ink-200/40"}`}>
                  {name.length}/{MAX_NAME}
                </span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
                placeholder="vd: smart-router"
                className="input font-mono"
                autoFocus
              />
              <p className="text-[10px] text-ink-200/45 mt-1.5">
                Dùng tên này làm <code className="text-honey-300/90">model</code> khi gọi API. Chỉ chữ/số/<code>. _ -</code>.
                {name.length > 0 && !nameOk && <span className="text-red-400"> — tên không hợp lệ.</span>}
              </p>
            </div>

            {/* Strategy */}
            <div className="mb-4">
              <label className="label">Chiến lược định tuyến</label>
              <div className="space-y-2">
                {STRATEGIES.map((s) => {
                  const Icon = s.icon;
                  const on = strategy === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStrategy(s.value)}
                      className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 transition ${accentRing(s.accent, on)}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${STRATEGY_BADGE[s.value].cls}`}>
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-[11px] text-ink-200/55 mt-0.5">{s.desc}</p>
                      </div>
                      <span className={`mt-1 w-4 h-4 rounded-full border-2 shrink-0 ${on ? "border-honey-400 bg-honey-400" : "border-white/20"}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Members */}
            <div className="mb-4">
              <label className="label flex items-center justify-between">
                <span>Thành viên</span>
                <span className="text-[10px] text-ink-200/40">{picks.length}/{MAX_MEMBERS}</span>
              </label>

              {models.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-ink-950/40 p-3 text-xs text-ink-200/55">
                  Key này chưa có model nào đã bật. Thêm model ở tab “Model của key” trước đã.
                </div>
              ) : (
                <div className="space-y-2">
                  {picks.map((slug, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      {strategy === "FAILOVER" && (
                        <div className="flex flex-col">
                          <button type="button" onClick={() => moveMember(idx, -1)} disabled={idx === 0} className="text-ink-200/40 hover:text-white disabled:opacity-20 leading-none">▲</button>
                          <button type="button" onClick={() => moveMember(idx, 1)} disabled={idx === picks.length - 1} className="text-ink-200/40 hover:text-white disabled:opacity-20 leading-none">▼</button>
                        </div>
                      )}
                      {strategy !== "FAILOVER" && <GripVertical size={14} className="text-ink-200/25 shrink-0" />}
                      <select value={slug} onChange={(e) => setMember(idx, e.target.value)} className="input flex-1 font-mono text-xs">
                        <option value="">— chọn model —</option>
                        {availableFor(idx).map((m) => (
                          <option key={m.slug} value={m.slug}>
                            {m.slug} · {m.displayName}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => removeMember(idx)} className="btn btn-ghost p-2 shrink-0" title="Bỏ">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addMember}
                    disabled={picks.length >= MAX_MEMBERS || picks.length >= models.length}
                    className="btn btn-ghost w-full py-2 text-xs border-dashed"
                  >
                    <Plus size={13} /> Thêm thành viên ({picks.length}/{MAX_MEMBERS})
                  </button>
                </div>
              )}
              <p className="text-[10px] text-ink-200/45 mt-1.5">
                {strategy === "FAILOVER" && "Thứ tự từ trên xuống = thứ tự ưu tiên thử."}
                {strategy === "ROUND_ROBIN" && "Mỗi request luân phiên bắt đầu từ model kế tiếp."}
                {strategy === "CHEAPEST" && "Gateway tự sắp theo giá input, thứ tự ở đây chỉ để tham khảo."}
              </p>
            </div>

            {formErr && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 mb-3 flex items-center gap-2">
                <AlertTriangle size={13} className="shrink-0" /> {formErr}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button onClick={() => !saving && setOpen(false)} className="btn btn-ghost px-4 py-2 text-sm">
                Huỷ
              </button>
              <button onClick={save} disabled={!canSave} className="btn btn-primary px-4 py-2 text-sm">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Đang lưu...</> : editing ? "Lưu thay đổi" : "Tạo combo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
