/**
 * Sinh OpenAPI 3.1 từ CHÍNH các schema zod dùng để validate (lib/api/schemas.ts).
 * Đổi schema ở một chỗ => validation và tài liệu /docs đổi theo.
 */
import { OpenAPIRegistry, OpenApiGeneratorV31, type ResponseConfig } from "@asteasolutions/zod-to-openapi";
import {
  AddItemRequest,
  Cart,
  CartItemParams,
  CartParams,
  ErrorResponse,
  ListProductsQuery,
  ProductList,
  UpdateItemRequest,
} from "./schemas";
import { SEED } from "../db/seed-ids";

const registry = new OpenAPIRegistry();
registry.register("Error", ErrorResponse);

const RID = "7f3c2a9e-1b4d-4c8a-9e21-5d6f0a3b8c10";
const requestIdHeader = {
  description: "Mã request, trùng với request_id trong body lỗi và log",
  schema: { type: "string" as const, format: "uuid" },
};

const err = (code: string, message: string, details: { field: string; issue: string }[] = []) => ({
  value: { code, message, details, request_id: RID },
});

function errorResponse(description: string, examples: Record<string, { value: unknown }>): ResponseConfig {
  return {
    description,
    headers: { "X-Request-Id": requestIdHeader },
    content: { "application/json": { schema: ErrorResponse, examples } },
  };
}

function cartResponse(description: string): ResponseConfig {
  return { description, headers: { "X-Request-Id": requestIdHeader }, content: { "application/json": { schema: Cart } } };
}

const E400 = errorResponse("Request sai schema (path, query hoặc body)", {
  quantityTooBig: err("VALIDATION_ERROR", "Request không hợp lệ", [{ field: "quantity", issue: "must be <= 10" }]),
  unknownField: err("VALIDATION_ERROR", "Request không hợp lệ", [{ field: "price", issue: "is not allowed" }]),
  badCartId: err("VALIDATION_ERROR", "Request không hợp lệ", [{ field: "cartId", issue: "must be a valid uuid" }]),
});
const E404Cart = errorResponse("cartId không tồn tại", {
  cartNotFound: err("CART_NOT_FOUND", "Không tìm thấy cart"),
});
const E404CartOrItem = errorResponse("Cart hoặc item không tồn tại", {
  cartNotFound: err("CART_NOT_FOUND", "Không tìm thấy cart"),
  itemNotFound: err("ITEM_NOT_FOUND", "Product không có trong cart"),
});
const E409 = (keys: ("closed" | "stock" | "already")[]) => {
  const all = {
    closed: err("CART_CLOSED", "Cart đã checkout, không thể thay đổi"),
    stock: err("INSUFFICIENT_STOCK", "Số lượng vượt tồn kho (còn 5)"),
    already: err("ITEM_ALREADY_IN_CART", "Product đã có trong cart, hãy dùng PATCH để đổi số lượng"),
  };
  return errorResponse(
    "Xung đột với trạng thái hiện tại",
    Object.fromEntries(keys.map((k) => [k, all[k]])),
  );
};
const E422 = errorResponse("Body đúng schema nhưng product không tồn tại hoặc ngừng bán", {
  productUnavailable: err("PRODUCT_UNAVAILABLE", "Product không tồn tại hoặc đã ngừng bán"),
});
const E500 = errorResponse("Lỗi hệ thống (vd: DB không kết nối được) — không chứa stack trace", {
  internal: err("INTERNAL_ERROR", "Lỗi hệ thống, vui lòng thử lại sau"),
});

registry.registerPath({
  method: "get",
  path: "/products",
  operationId: "listProducts",
  tags: ["Products"],
  summary: "Danh sách product đang bán",
  request: { query: ListProductsQuery },
  responses: {
    200: {
      description: "Trang product",
      headers: { "X-Request-Id": requestIdHeader },
      content: { "application/json": { schema: ProductList } },
    },
    400: E400,
    500: E500,
  },
});

registry.registerPath({
  method: "post",
  path: "/carts",
  operationId: "createCart",
  tags: ["Carts"],
  summary: "Tạo cart rỗng",
  responses: {
    201: {
      ...cartResponse("Cart vừa tạo"),
      headers: {
        "X-Request-Id": requestIdHeader,
        Location: { description: "URL của cart mới", schema: { type: "string" as const, example: "/carts/{cartId}" } },
      },
    },
    500: E500,
  },
});

registry.registerPath({
  method: "get",
  path: "/carts/{cartId}",
  operationId: "getCart",
  tags: ["Carts"],
  summary: "Xem cart, items và subtotal_cents",
  request: { params: CartParams },
  responses: { 200: cartResponse("Cart"), 400: E400, 404: E404Cart, 500: E500 },
});

registry.registerPath({
  method: "post",
  path: "/carts/{cartId}/items",
  operationId: "addCartItem",
  tags: ["Cart items"],
  summary: "Thêm product vào cart",
  request: {
    params: CartParams,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: AddItemRequest,
          examples: {
            valid: { value: { product_id: SEED.keyboard, quantity: 2 } },
            quantityZero: { summary: "Sai: quantity = 0 → 400", value: { product_id: SEED.keyboard, quantity: 0 } },
            quantityString: { summary: 'Sai: quantity = "2" → 400', value: { product_id: SEED.keyboard, quantity: "2" } },
            inactiveProduct: { summary: "Product ngừng bán → 422", value: { product_id: SEED.inactive, quantity: 1 } },
            overStock: { summary: "Vượt tồn kho → 409", value: { product_id: SEED.mouse, quantity: 6 } },
          },
        },
      },
    },
  },
  responses: {
    201: cartResponse("Cart sau khi thêm"),
    400: E400,
    404: E404Cart,
    409: E409(["closed", "stock", "already"]),
    422: E422,
    500: E500,
  },
});

registry.registerPath({
  method: "patch",
  path: "/carts/{cartId}/items/{productId}",
  operationId: "updateCartItem",
  tags: ["Cart items"],
  summary: "Đổi số lượng của product trong cart",
  request: {
    params: CartItemParams,
    body: { required: true, content: { "application/json": { schema: UpdateItemRequest, example: { quantity: 3 } } } },
  },
  responses: {
    200: cartResponse("Cart sau khi cập nhật"),
    400: E400,
    404: E404CartOrItem,
    409: E409(["closed", "stock"]),
    422: E422,
    500: E500,
  },
});

registry.registerPath({
  method: "delete",
  path: "/carts/{cartId}/items/{productId}",
  operationId: "removeCartItem",
  tags: ["Cart items"],
  summary: "Xóa product khỏi cart",
  request: { params: CartItemParams },
  responses: {
    204: { description: "Đã xóa, không có body", headers: { "X-Request-Id": requestIdHeader } },
    400: E400,
    404: E404CartOrItem,
    409: E409(["closed"]),
    500: E500,
  },
});

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Cart API",
      version: "1.0.0",
      description:
        "RESTful Cart API. Mọi lỗi theo error contract `{ code, message, details, request_id }`; " +
        "`request_id` trùng header `X-Request-Id` và dòng log trên server.",
    },
    servers: [{ url: "/" }],
  });
}
