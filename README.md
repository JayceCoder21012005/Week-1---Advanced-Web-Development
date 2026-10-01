# Cart API: RESTful API có contract (OpenAPI, validation, logging)

Đồ án Block 01, môn Advanced Web Development, nhóm 07.

| MSSV | Họ và tên |
|---|---|
| 23127159 | Phạm Lê Thái Bảo |
| 23127183 | Phạm Vũ Ngọc Duy |
| 23127102 | Lê Quang Phúc |

Stack: Next.js 16 (Route Handlers), TypeScript, PostgreSQL 17 (Docker), zod, OpenAPI 3.1, pino.
Lý do chọn từng thành phần được giải thích trong `REPORT.md` (hoặc `REPORT.html`).

## 1. Yêu cầu

- Node.js 20 trở lên (đã thử với Node.js 26)
- Docker Desktop đang chạy
- Cổng 3000 (server) và 5433 (PostgreSQL) còn trống

## 2. Triển khai

### Bước 1: Cài thư viện

```bash
npm install
```

### Bước 2: Tạo file cấu hình

```bash
cp .env.example .env
```

Nội dung mặc định đã khớp với `docker-compose.yml`, không cần sửa:

```
DATABASE_URL=postgres://cart:cart@localhost:5433/cart_api
LOG_LEVEL=info
```

### Bước 3: Tạo cơ sở dữ liệu

```bash
npm run db:up        # khởi động container PostgreSQL 17 (tên cart-api-db, cổng 5433)
npm run db:migrate   # tạo bảng từ db/migrations/*.sql
npm run db:seed      # nạp dữ liệu mẫu từ db/seed.sql
```

Có thể thay hai lệnh cuối bằng `npm run db:reset` (xóa sạch schema, migrate và seed lại từ đầu).

### Bước 4: Chạy server

Chế độ phát triển:

```bash
npm run dev
```

Chế độ production:

```bash
npm run build
npm start
```

Server chạy tại `http://localhost:3000`.

### Bước 5: Kiểm tra

| Địa chỉ | Nội dung |
|---|---|
| `http://localhost:3000/docs` | Tài liệu API (Scalar), gửi được request thật. Cần internet để tải Scalar |
| `http://localhost:3000/openapi.json` | Spec OpenAPI 3.1 |
| `http://localhost:3000/products` | Thử nhanh một endpoint |
| `http://localhost:3000/` | Giao diện demo nhỏ gọi API |

Chạy toàn bộ ma trận nghiệm thu (server phải đang chạy ở một terminal khác):

```bash
npm run test:acceptance
```

Kết quả mong đợi là `28/28 PASS`, chi tiết được ghi vào `docs/acceptance-report.md`. Script sẽ reset dữ liệu, và có một kịch bản tạm tắt container PostgreSQL rồi bật lại. Thêm `-- --skip-db-down` nếu muốn bỏ kịch bản này.

## 3. Các lệnh

| Lệnh | Việc làm |
|---|---|
| `npm run db:up` | Khởi động container PostgreSQL |
| `npm run db:down` | Tắt container PostgreSQL |
| `npm run db:migrate` | Chạy các migration chưa áp dụng |
| `npm run db:seed` | Nạp dữ liệu mẫu |
| `npm run db:reset` | Xóa sạch schema, migrate và seed lại |
| `npm run dev` | Chạy server ở chế độ phát triển |
| `npm run build`, `npm start` | Build và chạy ở chế độ production |
| `npm run openapi` | Xuất spec ra `docs/openapi.json` |
| `npm run test:acceptance` | Chạy ma trận nghiệm thu |

## 4. Dữ liệu

- `db/migrations/001_init.sql`: tạo 3 bảng `products`, `carts`, `cart_items` theo đề. Ràng buộc tồn kho dùng `stock >= 0` (slide ghi `stock <= 0`, nhóm xem là lỗi đánh máy).
- `db/seed.sql`: 5 sản phẩm (3 đang bán còn hàng, 1 hết hàng, 1 ngừng bán) và 1 giỏ đã checkout.

| SKU | Tên | Giá (cents) | Tồn kho | Đang bán |
|---|---|---|---|---|
| KB-001 | Mechanical Keyboard | 120000 | 20 | có |
| MS-002 | Wireless Mouse | 45000 | 5 | có |
| HD-003 | USB-C Hub | 30000 | 50 | có |
| MN-004 | 4K Monitor | 550000 | 0 | có |
| WC-005 | Old Webcam | 25000 | 10 | không |

Giỏ đã checkout có id `cccccccc-cccc-4ccc-8ccc-cccccccccccc`.

Xem dữ liệu trực tiếp trong container:

```bash
docker exec -it cart-api-db psql -U cart -d cart_api -c "SELECT * FROM products;"
```

Hoặc kết nối bằng DBeaver, pgAdmin: host `localhost`, cổng `5433`, database `cart_api`, user và mật khẩu `cart`.

## 5. API

| Method | Đường dẫn | Thành công |
|---|---|---|
| GET | `/products?limit=&offset=` | 200, sản phẩm đang bán, `limit` từ 1 đến 50 (mặc định 20) |
| POST | `/carts` | 201, header `Location` |
| GET | `/carts/{cartId}` | 200, giỏ hàng, các món và `subtotal_cents` |
| POST | `/carts/{cartId}/items` | 201, trả về giỏ hàng |
| PATCH | `/carts/{cartId}/items/{productId}` | 200, trả về giỏ hàng |
| DELETE | `/carts/{cartId}/items/{productId}` | 204 |

Mọi lỗi có dạng:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request không hợp lệ",
  "details": [{ "field": "quantity", "issue": "must be <= 10" }],
  "request_id": "7f3c2a9e-1b4d-4c8a-9e21-5d6f0a3b8c10"
}
```

Mã lỗi: `VALIDATION_ERROR` (400), `CART_NOT_FOUND`, `ITEM_NOT_FOUND`, `NOT_FOUND` (404), `METHOD_NOT_ALLOWED` (405), `CART_CLOSED`, `INSUFFICIENT_STOCK`, `ITEM_ALREADY_IN_CART` (409), `PRODUCT_UNAVAILABLE` (422), `INTERNAL_ERROR` (500).

## 6. Log

Log dạng JSON được ghi ra console và file `logs/app.log`, mỗi request một dòng. `request_id` trong response lỗi trùng với header `X-Request-Id` và với dòng log tương ứng:

```bash
grep <request_id> logs/app.log                  # Git Bash, Linux, macOS
Select-String <request_id> logs\app.log         # PowerShell
```

## 7. Cấu trúc mã nguồn

```
app/                       route handlers: kiểm tra dữ liệu, gọi service, trả JSON
  [...slug]/route.ts       404 theo error contract cho đường dẫn không tồn tại
  docs/, openapi.json/     trang tài liệu và spec
lib/api/schemas.ts         nguồn schema duy nhất (zod + metadata OpenAPI)
lib/api/openapi.ts         đăng ký endpoint, response và sinh spec OpenAPI 3.1
lib/api/validate.ts        kiểm tra path, query, body và đổi lỗi sang error contract
lib/api/handler.ts         withApi: request_id, log, bắt lỗi; rejectOtherMethods: 405
lib/api/errors.ts          danh sách mã lỗi
lib/api/logger.ts          cấu hình pino
lib/cart/service.ts        rule nghiệp vụ, transaction
lib/db/                    kết nối PostgreSQL, UUID của dữ liệu mẫu
db/                        migration và seed
scripts/                   db.ts (migrate, seed, reset), acceptance.ts, export-openapi.ts
docs/                      kết quả nghiệm thu, spec đã xuất, tài liệu thuyết trình
REPORT.md, REPORT.html     báo cáo các lựa chọn của nhóm
```

## 8. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `failed to connect to the docker API` | Mở Docker Desktop và chờ khởi động xong rồi chạy lại `npm run db:up` |
| `port is already allocated` ở cổng 5433 | Đổi cổng trong `docker-compose.yml` và `DATABASE_URL` trong `.env` cho khớp |
| API trả 500 `INTERNAL_ERROR` cho mọi request | Container chưa chạy hoặc chưa migrate. Chạy `npm run db:up` và `npm run db:reset` |
| Trang `/docs` trắng | Máy không có internet nên không tải được Scalar. Spec vẫn xem được ở `/openapi.json` |
