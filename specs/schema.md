### Ví dụ: schema của request body
components:
  schemas:
    AddItemRequest:
      type: object
      additionalProperties: false
      required: [product_id, quantity]
      properties:
        product_id: { type: string, format: uuid }
        quantity: { type: integer, minimum: 1, maximum: 10 }
    
* Validator đọc schema này: quantity: 0, quantity: "2" hoặc field lạ đều bị trả 400.

### Contract-first và code-first
#### Contract-first
- Thứ tự: viết openapi.yaml trước, code sau.
Validation: middleware đọc spec, ví dụ express-openapi-validator.
#### Code-first
- Thứ tự: viết schema trong code, sinh spec từ code.
Ví dụ: zod kết hợp @asteasolutions/zod-to-openapi

### What: validation ở boundary
#### Schema kiểm tra được
- Kiểu và định dạng: quantity là integer, cartId là uuid.
- iới hạn: quantity từ 1 đến 10, không có field lạ.
#### Cần code nghiệp vụ
- Dữ liệu trong DB: product có tồn tại và đang bán.
- Trạng thái: đủ tồn kho, cart chưa checkout.