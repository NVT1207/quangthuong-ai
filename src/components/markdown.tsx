// Mini markdown renderer — đủ dùng cho blog/docs/changelog nội bộ.
// Hỗ trợ: # H1/H2/H3, paragraph, ``` code fence, inline `code`, **bold**, *italic*,
// danh sách - item / * item, link [text](url).
// Không gọi dangerouslySetInnerHTML; toàn bộ render qua React node.

import { ReactNode } from "react";

function renderInline(s: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < s.length) {
    if (s[i] === "`") {
      const end = s.indexOf("`", i + 1);
      if (end > 0) {
        nodes.push(<code key={key++} className="bg-white/10 px-1 py-0.5 rounded text-xs font-mono">{s.slice(i + 1, end)}</code>);
        i = end + 1;
        continue;
      }
    }
    if (s[i] === "*" && s[i + 1] === "*") {
      const end = s.indexOf("**", i + 2);
      if (end > 0) {
        nodes.push(<strong key={key++} className="font-semibold text-ink-100">{s.slice(i + 2, end)}</strong>);
        i = end + 2;
        continue;
      }
    }
    if (s[i] === "*") {
      const end = s.indexOf("*", i + 1);
      if (end > 0 && end - i > 1) {
        nodes.push(<em key={key++}>{s.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }
    if (s[i] === "[") {
      const close = s.indexOf("](", i + 1);
      if (close > 0) {
        const endParen = s.indexOf(")", close + 2);
        if (endParen > 0) {
          const txt = s.slice(i + 1, close);
          const url = s.slice(close + 2, endParen);
          nodes.push(<a key={key++} href={url} className="text-honey-300 hover:underline" target="_blank" rel="noreferrer">{txt}</a>);
          i = endParen + 1;
          continue;
        }
      }
    }
    let j = i;
    while (j < s.length && s[j] !== "`" && s[j] !== "*" && s[j] !== "[") j++;
    nodes.push(<span key={key++}>{s.slice(i, j)}</span>);
    i = j;
  }
  return nodes;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        body.push(lines[i]);
        i++;
      }
      i++;
      out.push(
        <pre key={k++} className="bg-ink-950/80 border border-white/10 rounded-lg p-3 overflow-x-auto text-xs font-mono leading-relaxed">
          {lang && <div className="text-[10px] text-ink-200/40 mb-2 uppercase">{lang}</div>}
          <code>{body.join("\n")}</code>
        </pre>
      );
      continue;
    }
    if (line.startsWith("### ")) {
      out.push(<h3 key={k++} className="text-base font-semibold mt-5 mb-2">{renderInline(line.slice(4))}</h3>);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      out.push(<h2 key={k++} className="text-lg font-bold mt-6 mb-2">{renderInline(line.slice(3))}</h2>);
      i++; continue;
    }
    if (line.startsWith("# ")) {
      out.push(<h1 key={k++} className="text-xl font-bold mt-6 mb-3">{renderInline(line.slice(2))}</h1>);
      i++; continue;
    }
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      out.push(
        <ul key={k++} className="list-disc list-inside space-y-1 my-2 text-ink-200/80">
          {items.map((it, idx) => <li key={idx}>{renderInline(it)}</li>)}
        </ul>
      );
      continue;
    }
    if (line.trim() === "") {
      i++; continue;
    }
    out.push(<p key={k++} className="my-2 leading-relaxed text-ink-200/80">{renderInline(line)}</p>);
    i++;
  }
  return <div>{out}</div>;
}
