# Cart API — Thuyết trình (5–7 phút)

> Cấu trúc theo slide "Presentation": **Problem → Solution → Demo → Evidence & Trade-off**.
> Thời lượng gợi ý ghi ở mỗi phần.

---

## 1. Problem (~1 phút)

**Câu hỏi:** Cart API cần gì để nhóm khác dùng được **mà không phải đọc source**?

1. **Contract rõ ràng:** biết mọi path, method, body, status trả về, kể cả lỗi → **OpenAPI 3.1 + trang `/docs`**.
2. **Request sai bị chặn ở cửa:** sai kiểu, vượt giới hạn, field lạ → 400 ngay, **không chạm DB**.
3. **Lỗi đoán được:** mọi lỗi (kể cả 500) cùng một dạng JSON, có `code` cố định để client rẽ nhánh.
4. **Truy vết được:** mỗi request có `request_id` → nối response lỗi với dòng log trên server.

Phạm vi tuần này: 6 endpoint (products, carts, cart items). Chưa làm đăng nhập/checkout/thanh toán.

---

## 2. Solution (~1.5 phút)

### Chọn **code-first**: `zod` + `@asteasolutions/zod-to-openapi`

```
lib/api/schemas.ts  ──►  validate()  (chặn request ở route handler)
        │
        └──────────►  OpenAPI 3.1  ──►  /openapi.json  ──►  /docs (Scalar)
```

**Lý do:**
- **Một nguồn schema** → tránh lỗi "spec viết một kiểu, code validate một kiểu" (lỗi thường gặp #1).
- TypeScript suy ra kiểu từ schema → handler/service có type an toàn, không viết type 2 lần.
- Next.js không có middleware kiểu `express-openapi-validator`, nên contract-first sẽ phải tự nối validator với route — code-first gọn hơn.

### Các mảnh còn lại

| Vấn đề | Cách làm |
|---|---|
| Field lạ | `z.strictObject` → `additionalProperties: false` |
| Lỗi thư viện lọt ra | `validate.ts` đổi issue của zod → `{ field, issue }` của mình |
| Error contract + 500 | `withApi()` bọc mọi handler, bắt **mọi** exception; 500 chỉ trả `INTERNAL_ERROR`, stack chỉ nằm trong log |
| Logging | `pino` (JSON), mỗi request 1 dòng: `request_id, method, path, status, duration_ms, code`; `redact` password/token/Authorization |
| Rule nghiệp vụ | `service.ts`: transaction + `SELECT … FOR UPDATE` trên cart; **giá đọc từ DB**, không nhận từ client |
| Status | 400 schema · 404 không có resource · 409 xung đột trạng thái · 422 tham chiếu sai |

---

## 3. Demo (~2 phút)

Chuẩn bị: `npm run db:reset && npm run dev`, mở 2 cửa sổ: trình duyệt `/docs` và terminal.

1. Mở **`http://localhost:3000/docs`** → chỉ nhanh: 6 endpoint, mỗi endpoint liệt kê đủ status, có example.
2. Tạo cart: `POST /carts` → **201**, chỉ header `Location`, copy `id`.
3. Gửi **request sai** ở `POST /carts/{cartId}/items`, chọn example *quantity = 0* (hoặc gõ `"quantity": 11`):
   ```json
   {
     "code": "VALIDATION_ERROR",
     "message": "Request không hợp lệ",
     "details": [{ "field": "quantity", "issue": "must be >= 1" }],
     "request_id": "4f02…"
   }
   ```
   Chỉ: header `X-Request-Id` **trùng** `request_id` trong body.
4. Sang terminal, tìm dòng log có cùng `request_id`:
   ```bash
   grep 4f02 logs/app.log
   ```
   ```json
   {"level":40,"request_id":"4f02…","method":"POST","path":"/carts/…/items","status":400,
    "duration_ms":2,"code":"VALIDATION_ERROR","details":[{"field":"quantity","issue":"must be >= 1"}],
    "msg":"request rejected"}
   ```
5. (Nếu còn thời gian) chọn example *Product ngừng bán* → **422 PRODUCT_UNAVAILABLE**: đúng schema nhưng sai tham chiếu.

---

## 4. Evidence & Trade-off (~1.5 phút)

### Evidence: `npm run test:acceptance` → **26/26 PASS**

Script chạy lại được: reset DB → chạy từng dòng ma trận → **đối chiếu mọi response với `/openapi.json` bằng Ajv** (validator độc lập với zod) → ghi `docs/acceptance-report.md`.

| Ma trận | Kết quả |
|---|---|
| `quantity` = 0 / 11 / `"2"` | 400, `details` chỉ có `quantity` ✅ |
| Thiếu `product_id`; field lạ | 400, đếm `cart_items` trước/sau → **DB không đổi** ✅ |
| `cartId` không phải uuid / không tồn tại | 400 / 404 `CART_NOT_FOUND` ✅ |
| Thêm 2 product rồi GET | `subtotal_cents = 120000×2 + 30000×3 = 330000` ✅ |
| Ngừng bán; vượt stock | 422 `PRODUCT_UNAVAILABLE`; 409 `INSUFFICIENT_STOCK` ✅ |
| Ghi vào cart đã checkout | 409 `CART_CLOSED` ✅ |
| **Tắt PostgreSQL** rồi gọi API | 500 `INTERNAL_ERROR`, không stack trace; bật lại DB thì API tự hồi phục ✅ |
| So response thật với spec | Mọi response khớp schema + đúng status đã khai báo ✅ |

Thêm: `ITEM_ALREADY_IN_CART`, PATCH/DELETE thành công, `ITEM_NOT_FOUND`, `limit=51`, JSON hỏng, `request_id` có trong log.

### Trade-off & chưa kiểm tra

- **Code-first:** spec phụ thuộc thư viện sinh; muốn chỉnh chi tiết OpenAPI phải qua metadata `.openapi()`. Bù lại không bao giờ lệch giữa spec và validation.
- **Tồn kho chỉ được kiểm tra, không giữ chỗ:** 2 cart có thể cùng thêm 5/5 sản phẩm; giữ hàng là việc của checkout (tuần sau).
- **Chưa kiểm tra:** tải đồng thời nhiều request vào cùng cart (đã khóa `FOR UPDATE` nhưng chưa có test), route không tồn tại / sai method vẫn trả trang mặc định của Next.js chứ chưa theo error contract, log chưa xoay vòng file, `/docs` cần internet (Scalar tải từ CDN).
- **Phát hiện khi đọc đề:** slide ghi `CHECK (stock <= 0)` — đã sửa thành `stock >= 0` vì ngược lại seed "3 product còn hàng" không chèn được.
