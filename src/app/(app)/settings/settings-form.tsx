"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function SettingsForm({ name: initialName, email }: { name: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileLoading(true); setProfileMsg("");
    const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setProfileLoading(false);
    if (r.ok) { setProfileMsg("✓ Đã lưu"); router.refresh(); setTimeout(() => setProfileMsg(""), 2500); }
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setPwLoading(true); setPwMsg(""); setPwErr("");
    const r = await fetch("/api/profile/password", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPw, newPw }) });
    setPwLoading(false);
    const d = await r.json();
    if (r.ok) { setPwMsg("✓ Đã đổi mật khẩu"); setCurrentPw(""); setNewPw(""); setTimeout(() => setPwMsg(""), 2500); }
    else setPwErr(d.error || "Lỗi");
  }

  return (
    <>
      <form onSubmit={saveProfile} className="card p-5 space-y-4">
        <p className="font-medium">Hồ sơ</p>
        <div>
          <label className="label">Email</label>
          <input value={email} disabled className="input opacity-60 cursor-not-allowed" />
        </div>
        <div>
          <label className="label">Tên hiển thị</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>
        <div className="flex items-center gap-3">
          <button disabled={profileLoading} className="btn btn-primary">{profileLoading && <Loader2 size={14} className="animate-spin" />} Lưu</button>
          {profileMsg && <p className="text-sm text-emerald-400">{profileMsg}</p>}
        </div>
      </form>

      <form onSubmit={changePw} className="card p-5 space-y-4">
        <p className="font-medium">Đổi mật khẩu</p>
        <div>
          <label className="label">Mật khẩu hiện tại</label>
          <input type="password" required value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Mật khẩu mới (≥ 6 ký tự)</label>
          <input type="password" required minLength={6} value={newPw} onChange={(e) => setNewPw(e.target.value)} className="input" />
        </div>
        {pwErr && <p className="text-sm text-rose-400">{pwErr}</p>}
        {pwMsg && <p className="text-sm text-emerald-400">{pwMsg}</p>}
        <button disabled={pwLoading} className="btn btn-primary">{pwLoading && <Loader2 size={14} className="animate-spin" />} Đổi mật khẩu</button>
      </form>
    </>
  );
}
