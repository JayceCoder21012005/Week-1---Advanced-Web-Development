# Cart API — RESTful API có contract (OpenAPI, validation, logging)

Next.js 16 (Route Handlers) + TypeScript + PostgreSQL. Code-first: schema `zod` là nguồn duy nhất cho cả validation lẫn OpenAPI 3.1.

## Yêu cầu

- Node.js 20+
- Docker Desktop (chạy PostgreSQL 17)

## Setup

```bash
npm install
cp .env.example .env          # DATABASE_URL=postgres://cart:cart@localhost:5433/cart_api

npm run db:up                 # tạo DB: docker compose up postgres (port 5433)
npm run db:migrate            # chạy db/migrations/*.sql
npm run db:seed               # nạp db/seed.sql (5 product, 1 cart đã checkout)
npm run dev                   # server http://localhost:3000
```

| Lệnh | Việc làm |
|---|---|
| `npm run db:reset` | Xóa sạch schema, migrate lại, seed lại |
| `npm run db:down` | Tắt container PostgreSQL |
| `npm run openapi` | Xuất spec ra `docs/openapi.json` |
| `npm run test:acceptance` | Chạy ma trận nghiệm thu (cần server đang chạy) |

## Địa chỉ

| URL | Nội dung |
|---|---|
| `/docs` | Tài liệu API (Scalar), gửi được request thật |
| `/openapi.json` | OpenAPI 3.1 sinh từ schema zod |
| `/` | UI demo nhỏ gọi API |

## Endpoint

| Method | Path | Thành công |
|---|---|---|
| GET | `/products?limit=&offset=` | 200, product đang bán, `limit` 1-50 (mặc định 20) |
| POST | `/carts` | 201, header `Location` |
| GET | `/carts/{cartId}` | 200, cart + items + `subtotal_cents` |
| POST | `/carts/{cartId}/items` | 201, trả cart |
| PATCH | `/carts/{cartId}/items/{productId}` | 200, trả cart |
| DELETE | `/carts/{cartId}/items/{productId}` | 204 |

Lỗi luôn có dạng `{ code, message, details[], request_id }`; `request_id` trùng header `X-Request-Id` và dòng log.

## Cấu trúc

```
app/                    route handlers (mỗi file chỉ: validate → gọi service → trả JSON)
lib/api/schemas.ts      NGUỒN SCHEMA DUY NHẤT (zod + metadata OpenAPI)
lib/api/openapi.ts      đăng ký path/response → OpenAPI 3.1
lib/api/validate.ts     validate path/query/body, đổi lỗi zod → error contract
lib/api/handler.ts      withApi(): request_id, log, bắt mọi lỗi → error contract
lib/api/logger.ts       pino → stdout + logs/app.log, redact secret
lib/cart/service.ts     rule nghiệp vụ trong transaction
db/                     migration + seed
scripts/                db.ts (migrate/seed/reset), acceptance.ts, export-openapi.ts
docs/                   tài liệu thuyết trình + kết quả nghiệm thu
```

## Xem log theo request_id

```bash
grep <request_id> logs/app.log
```
