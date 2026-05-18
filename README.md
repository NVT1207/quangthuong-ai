# QUANGTHUONG AI — Cổng API AI cho lập trình viên Việt

Nền tảng bán quyền truy cập 50+ model AI (Claude, GPT, Gemini, Grok, DeepSeek, Sora, Veo, Imagen, FLUX, TTS-1…) qua **một endpoint duy nhất, tương thích OpenAI**. Người dùng nạp tiền VND → tạo API key → gọi API, hệ thống trừ tiền theo token.

## Tech stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** (theme honey/dark tự thiết kế)
- **Prisma + SQLite** (zero-setup, đổi sang Postgres bằng 1 dòng `provider = "postgresql"`)
- **NextAuth.js** (Credentials provider, JWT)
- **Recharts** cho biểu đồ usage
- **bcryptjs** hash mật khẩu + API key

## Cài đặt

```bash
git clone https://github.com/<your-username>/quangthuong-ai.git
cd quangthuong-ai
cp .env.example .env
# Mở .env và điền:
#   NEXTAUTH_SECRET=$(openssl rand -hex 32)
#   BEEKNOEE_API_KEY=<key upstream của bạn — bỏ trống nếu chỉ chạy thử UI>
npm install
npx prisma db push        # tạo schema SQLite
npm run seed              # tạo admin, user demo và catalog 50+ model
npm run dev               # mở http://localhost:3000
```

Tài khoản mẫu sau khi seed:

| Vai trò | Email | Mật khẩu | Số dư |
|---|---|---|---|
| Admin | `admin@quangthuong.local` | `admin123` | 1.000.000 ₫ |
| User | `demo@quangthuong.local` | `demo123` | 100.000 ₫ |

## Tính năng

### Phía người dùng
- **Trang chủ** giới thiệu + bảng giá 6 model rẻ nhất
- **Đăng ký / Đăng nhập** (tặng 10.000 ₫ khi đăng ký)
- **Tổng quan**: số dư, requests hôm nay, tokens, chi phí + biểu đồ 7 ngày + 10 request gần nhất
- **Models**: grid 13 model với giá/context/provider, copy slug 1 click
- **API Keys**: tạo / xem prefix / revoke, key đầy đủ chỉ hiện 1 lần
- **Playground**: chat UI giống ChatGPT, chọn model, system prompt, thấy ngay token/cost mỗi lần gửi
- **Lịch sử dùng**: filter theo ngày/model, export CSV
- **Nạp tiền**: form (50k/100k/500k/1M preset hoặc custom), QR ngân hàng giả lập, list yêu cầu cũ
- **Sổ giao dịch**: tất cả biến động balance (TOPUP / USAGE / ADJUST)
- **Tài khoản**: đổi tên, đổi mật khẩu

### Phía quản trị (role = ADMIN)
- **Admin Overview**: tổng user, model active, requests hôm nay, doanh thu, top 5 model
- **Quản lý người dùng**: search, đổi role/status, cộng/trừ balance kèm lý do
- **Quản lý Models**: CRUD đầy đủ — thêm/sửa/xóa model, set giá, bật/tắt
- **Duyệt nạp tiền**: queue PENDING với nút Duyệt/Từ chối (duyệt sẽ cộng balance + tạo Transaction)
- **Logs hệ thống**: 200 request gần nhất từ toàn bộ user, filter theo email/model

## API tương thích OpenAI

### Liệt kê model
```bash
curl http://localhost:3000/api/v1/models
```

### Chat completion
```bash
curl http://localhost:3000/api/v1/chat/completions \
  -H "Authorization: Bearer sk-bee-XXXXXXXX" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Xin chào!"}]
  }'
```

### Streaming
Thêm `"stream": true` vào body → server trả Server-Sent Events theo chuẩn OpenAI.

### Mã lỗi
- `401` — API key sai/không tồn tại
- `402` — Không đủ số dư
- `403` — User bị ban
- `404` — Model không tồn tại hoặc đã tắt

## Cấu trúc dự án

```
src/
├── app/
│   ├── page.tsx                    # Landing
│   ├── login/, register/           # Auth
│   ├── (app)/                      # Sidebar layout group
│   │   ├── dashboard/
│   │   ├── models/
│   │   ├── api-keys/
│   │   ├── playground/
│   │   ├── usage/
│   │   ├── topup/
│   │   ├── transactions/
│   │   ├── settings/
│   │   └── admin/
│   │       ├── page.tsx            # /admin
│   │       ├── users/
│   │       ├── models/
│   │       ├── topups/
│   │       └── logs/
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── register/
│       ├── keys/, keys/[id]/
│       ├── topup/
│       ├── profile/, profile/password/
│       ├── playground/             # nội bộ
│       ├── usage/export/           # CSV
│       ├── admin/users/[id]/...
│       ├── admin/models/[id]/
│       ├── admin/topups/[id]/{approve,reject}/
│       └── v1/                     # OpenAI-compat
│           ├── models/
│           └── chat/completions/
├── components/                     # Sidebar, Topbar, StatsCard, UsageChart, Logo, Providers
├── lib/                            # prisma, auth, api-key, pricing, mock-response, format, cn
├── middleware.ts                   # Bảo vệ /dashboard /admin, redirect /login khi đã đăng nhập
└── types/next-auth.d.ts            # Mở rộng session.user.role
```

## Đổi sang PostgreSQL

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
Rồi `DATABASE_URL="postgresql://..."` trong `.env`, chạy `npx prisma migrate dev`.

## Upstream

Mặc định request `/api/v1/chat/completions` được forward thật tới Quang Thưởng AI gateway (cấu hình qua `BEEKNOEE_BASE_URL` và `BEEKNOEE_API_KEY` trong `.env` — tên env vars giữ nguyên để backward-compat). Muốn dùng provider khác (OpenAI/Anthropic/Google trực tiếp), sửa logic trong `src/lib/upstream.ts` hoặc `src/app/api/v1/chat/completions/route.ts`.

## Lưu ý bảo mật cho production

- Đổi `NEXTAUTH_SECRET` thành chuỗi ngẫu nhiên dài
- Bật rate limit theo IP / theo API key (vd: `@upstash/ratelimit`)
- Đổi từ SQLite sang Postgres
- Thêm email verification, 2FA
- Logging request errors lên Sentry hoặc tương đương
- Tích hợp payment gateway thật (VNPay/MoMo Business)
- Đổi mật khẩu demo `admin123` / `demo123` trước khi deploy

## License

[MIT](./LICENSE)
