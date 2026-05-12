"use client";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Loader2, Gift } from "lucide-react";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = (searchParams.get("ref") || "").trim().toUpperCase().slice(0, 16);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const r = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, ref: ref || undefined }),
    });
    const data = await r.json();
    if (!r.ok) {
      setError(data.error || "Đăng ký thất bại");
      setLoading(false);
      return;
    }
    await signIn("credentials", { email, password, redirect: false });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-honey-500/15 blur-[120px] rounded-full -z-10" />
      <div className="w-full max-w-md">
        <div className="text-center mb-6"><Logo size={32} /></div>
        <div className="card p-7">
          <h1 className="text-2xl font-bold mb-1">Đăng ký</h1>
          <p className="text-sm text-ink-200/60 mb-6">Tạo tài khoản miễn phí, nhận 10.000₫ dùng thử</p>
          {ref && (
            <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-lg bg-honey-500/10 border border-honey-500/20 text-sm text-honey-200">
              <Gift size={14} className="text-honey-300 shrink-0" />
              <span>Bạn được giới thiệu bởi mã <strong className="font-mono tracking-widest">{ref}</strong></span>
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Tên hiển thị</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Nguyễn Văn A" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Mật khẩu (tối thiểu 6 ký tự)</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button disabled={loading} className="btn btn-primary w-full py-2.5">
              {loading && <Loader2 size={14} className="animate-spin" />}
              Đăng ký
            </button>
          </form>
          <p className="text-sm text-ink-200/60 mt-5 text-center">
            Đã có tài khoản?{" "}
            <Link href="/login" className="text-honey-400 hover:underline">Đăng nhập</Link>
          </p>
        </div>
        <p className="text-center text-xs text-ink-200/50 mt-4">
          <Link href="/">← Về trang chủ</Link>
        </p>
      </div>
    </div>
  );
}
