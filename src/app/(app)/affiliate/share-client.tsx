"use client";
import { useState } from "react";
import { Copy, Check, Link2, Hash } from "lucide-react";

export function AffiliateShare({ code, shareUrl }: { code: string; shareUrl: string }) {
  const [copied, setCopied] = useState<"code" | "url" | null>(null);

  function copy(text: string, kind: "code" | "url") {
    navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-4">Liên kết & mã giới thiệu</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="label flex items-center gap-1.5"><Hash size={12} /> Mã của bạn</label>
          <div className="flex gap-2">
            <input readOnly value={code} className="input font-mono tracking-widest" />
            <button onClick={() => copy(code, "code")} className="btn btn-ghost">
              {copied === "code" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><Link2 size={12} /> Link đăng ký</label>
          <div className="flex gap-2">
            <input readOnly value={shareUrl} className="input text-xs" />
            <button onClick={() => copy(shareUrl, "url")} className="btn btn-primary">
              {copied === "url" ? <><Check size={14} /> Đã copy</> : <><Copy size={14} /> Copy link</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
