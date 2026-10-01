What: OpenAPI
Là gì: file YAML hoặc JSON mô tả path, method, parameter, body, response và lỗi.
Tài liệu: Swagger UI, Redoc hoặc Scalar sinh trang /docs từ file này.
Kiểm tra: validator dùng cùng file để chặn request sai và đối chiếu response.
Khác tài liệu viết tay: công cụ phát hiện được khi code lệch spec.

### Ví dụ: một operation trong spec
/carts/{cartId}/items:
  post:
    operationId: addCartItem
    parameters:
      - $ref: '#/components/parameters/CartId'
    requestBody:
      required: true
      content:
        application/json:
          schema: { $ref: '#/components/schemas/AddItemRequest' }
    responses:
      '201': { $ref: '#/components/responses/Cart' }
      '400': { $ref: '#/components/responses/Error' }