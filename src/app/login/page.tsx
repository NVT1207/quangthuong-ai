"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false, callbackUrl });
    setLoading(false);
    if (res?.error) {
      setError("Email hoặc mật khẩu không đúng");
    } else if (res?.ok) {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-honey-500/15 blur-[120px] rounded-full -z-10" />
      <div className="w-full max-w-md">
        <div className="text-center mb-6"><Logo size={32} /></div>
        <div className="card p-7">
          <h1 className="text-2xl font-bold mb-1">Đăng nhập</h1>
          <p className="text-sm text-ink-200/60 mb-6">Tiếp tục dùng API của bạn</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="ban@example.com" />
            </div>
            <div>
              <label className="label">Mật khẩu</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button disabled={loading} className="btn btn-primary w-full py-2.5">
              {loading && <Loader2 size={14} className="animate-spin" />}
              Đăng nhập
            </button>
          </form>
          <p className="text-sm text-ink-200/60 mt-5 text-center">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="text-honey-400 hover:underline">Đăng ký</Link>
          </p>
          <div className="mt-5 pt-5 border-t border-white/5 text-xs text-ink-200/50 space-y-1">
            <p>Tài khoản demo:</p>
            <p>• User: <code className="text-honey-300">demo@beeknoee.local</code> / <code className="text-honey-300">demo123</code></p>
            <p>• Admin: <code className="text-honey-300">admin@beeknoee.local</code> / <code className="text-honey-300">admin123</code></p>
          </div>
        </div>
        <p className="text-center text-xs text-ink-200/50 mt-4">
          <Link href="/">← Về trang chủ</Link>
        </p>
      </div>
    </div>
  );
}
