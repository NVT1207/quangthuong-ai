"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopySlug({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(slug); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="btn btn-ghost w-full justify-between text-xs font-mono"
    >
      <span>{slug}</span>
      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
    </button>
  );
}
