"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Cpu, Video, ImageIcon, Volume2, MessageSquareText,
  KeyRound, Activity, Wallet, Users2, BookOpen, Bell, FileText,
  Settings, LogOut, Shield, Boxes, ListChecks, Receipt, Tag,
} from "lucide-react";
import { Logo } from "./logo";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: any; badge?: string };
type Group = { title?: string; items: Item[] };

const userGroups: Group[] = [
  {
    items: [{ href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard }],
  },
  {
    title: "Sản phẩm",
    items: [
      { href: "/models/text-embedding", label: "Text & Embedding", icon: Cpu },
      { href: "/models/video", label: "Video Models", icon: Video },
      { href: "/models/image", label: "Image Models", icon: ImageIcon },
      { href: "/models/tts", label: "TTS Models", icon: Volume2 },
      { href: "/playground", label: "Playground", icon: MessageSquareText },
    ],
  },
  {
    title: "Quản lý",
    items: [
      { href: "/api-keys", label: "API Keys", icon: KeyRound },
      { href: "/usage", label: "Sử dụng", icon: Activity },
    ],
  },
  {
    title: "Tài chính",
    items: [
      { href: "/topup", label: "Hóa đơn — Nạp tiền", icon: Wallet },
      { href: "/affiliate", label: "Affiliate", icon: Users2, badge: "NEW" },
    ],
  },
  {
    title: "Thông tin",
    items: [
      { href: "/huong-dan", label: "Hướng dẫn", icon: FileText },
      { href: "/blog", label: "Blog", icon: BookOpen },
      { href: "/changelog", label: "Changelog", icon: Bell },
    ],
  },
];

const adminLinks: Item[] = [
  { href: "/admin", label: "Admin Overview", icon: Shield },
  { href: "/admin/users", label: "Người dùng", icon: Users2 },
  { href: "/admin/models", label: "Quản lý Model", icon: Boxes },
  { href: "/admin/topups", label: "Duyệt nạp tiền", icon: ListChecks },
  { href: "/admin/promo-codes", label: "Mã ưu đãi", icon: Tag },
  { href: "/admin/logs", label: "Logs hệ thống", icon: Receipt },
];

function isActive(path: string, href: string) {
  if (href === "/dashboard" || href === "/admin") return path === href;
  return path === href || path.startsWith(href + "/");
}

export function Sidebar({ role }: { role: string }) {
  const path = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-white/5 bg-ink-950/80 backdrop-blur-xl h-screen sticky top-0">
      <div className="px-5 py-5">
        <Link href="/dashboard">
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 px-3 space-y-3 overflow-y-auto pb-4">
        {userGroups.map((g, gi) => (
          <div key={gi} className="space-y-1">
            {g.title && (
              <div className="px-2 pt-2 pb-1 text-[10px] uppercase font-semibold text-ink-200/40 tracking-wider">
                {g.title}
              </div>
            )}
            {g.items.map((l) => {
              const active = isActive(path, l.href);
              const Icon = l.icon;
              return (
                <Link key={l.href} href={l.href} className={cn("nav-link", active && "nav-link-active")}>
                  <Icon size={16} />
                  <span className="flex-1">{l.label}</span>
                  {l.badge && (
                    <span className="rounded-full bg-honey-400 px-1.5 py-0.5 text-[9px] font-bold text-ink-950 leading-none">
                      {l.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        {role === "ADMIN" && (
          <div className="space-y-1">
            <div className="px-2 pt-2 pb-1 text-[10px] uppercase font-semibold text-ink-200/40 tracking-wider">
              Quản trị
            </div>
            {adminLinks.map((l) => {
              const active = isActive(path, l.href);
              const Icon = l.icon;
              return (
                <Link key={l.href} href={l.href} className={cn("nav-link", active && "nav-link-active")}>
                  <Icon size={16} /> {l.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-white/5 space-y-1">
        <Link href="/settings" className={cn("nav-link", isActive(path, "/settings") && "nav-link-active")}>
          <Settings size={16} /> Tài khoản
        </Link>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="nav-link w-full text-left">
          <LogOut size={16} /> Đăng xuất
        </button>
      </div>
    </aside>
  );
}
