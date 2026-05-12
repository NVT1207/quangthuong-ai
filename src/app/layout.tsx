import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "QUANGTHUONG AI — Cổng API AI cho lập trình viên Việt Nam",
  description: "Truy cập GPT, Claude, Gemini và nhiều model AI khác qua 1 API duy nhất. Trả tiền theo token, nạp tiền linh hoạt.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
