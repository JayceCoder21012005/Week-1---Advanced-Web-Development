# Kết quả nghiệm thu

Chạy lúc 2026-10-01T03:33:05.396Z bằng `npm run test:acceptance`. Mỗi response đã được đối chiếu với `/openapi.json` (Ajv) và kiểm tra `X-Request-Id`.

| Nhóm | Kịch bản | Mong đợi | Thực tế | |
|---|---|---|---|---|
| Request sai | quantity = 0 | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | ✅ |
| Request sai | quantity = 11 | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | ✅ |
| Request sai | quantity = "2" | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | ✅ |
| Request sai | Thiếu product_id (DB không đổi) | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | ✅ |
| Request sai | Body có field lạ `price` (DB không đổi) | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | ✅ |
| Request sai | Body không phải JSON | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | ✅ |
| Request sai | cartId không phải uuid | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | ✅ |
| Request sai | cartId hợp lệ nhưng không tồn tại | 404 CART_NOT_FOUND | 404 CART_NOT_FOUND | ✅ |
| Request sai | GET /products?limit=51 | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | ✅ |
| Nghiệp vụ & server | GET /products: chỉ product đang bán, limit mặc định 20 | 200 | 200 | ✅ |
| Nghiệp vụ & server | POST /carts có header Location | 201 | 201 | ✅ |
| Nghiệp vụ & server | Thêm keyboard x2 | 201 | 201 | ✅ |
| Nghiệp vụ & server | Thêm hub x3 | 201 | 201 | ✅ |
| Nghiệp vụ & server | GET cart: subtotal_cents = 330000 (tính tay) | 200 | 200 | ✅ |
| Nghiệp vụ & server | Thêm lại keyboard | 409 ITEM_ALREADY_IN_CART | 409 ITEM_ALREADY_IN_CART | ✅ |
| Nghiệp vụ & server | PATCH hub quantity = 5 | 200 | 200 | ✅ |
| Nghiệp vụ & server | PATCH item không có trong cart | 404 ITEM_NOT_FOUND | 404 ITEM_NOT_FOUND | ✅ |
| Nghiệp vụ & server | DELETE hub | 204 | 204 | ✅ |
| Nghiệp vụ & server | DELETE hub lần 2 | 404 ITEM_NOT_FOUND | 404 ITEM_NOT_FOUND | ✅ |
| Nghiệp vụ & server | Product ngừng bán | 422 PRODUCT_UNAVAILABLE | 422 PRODUCT_UNAVAILABLE | ✅ |
| Nghiệp vụ & server | Product không tồn tại | 422 PRODUCT_UNAVAILABLE | 422 PRODUCT_UNAVAILABLE | ✅ |
| Nghiệp vụ & server | Vượt stock (mouse x6, stock 5) | 409 INSUFFICIENT_STOCK | 409 INSUFFICIENT_STOCK | ✅ |
| Nghiệp vụ & server | Product hết hàng (stock 0) | 409 INSUFFICIENT_STOCK | 409 INSUFFICIENT_STOCK | ✅ |
| Nghiệp vụ & server | Ghi vào cart đã checkout | 409 CART_CLOSED | 409 CART_CLOSED | ✅ |
| Nghiệp vụ & server | request_id lỗi có dòng log tương ứng | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | ✅ |
| Nghiệp vụ & server | Tắt PostgreSQL rồi GET /products | 500 INTERNAL_ERROR | 500 INTERNAL_ERROR | ✅ |

**26/26 PASS**
