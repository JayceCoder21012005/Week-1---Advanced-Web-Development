/**
 * NGUỒN SCHEMA DUY NHẤT (code-first).
 * Các schema zod dưới đây vừa dùng để validate request trong route handler,
 * vừa được zod-to-openapi chuyển thành OpenAPI 3.1 (xem lib/api/openapi.ts).
 */
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { ERROR_CODES } from "./errors";
import { SEED } from "../db/seed-ids";

extendZodWithOpenApi(z);

// ---------- Params ----------
// Đặt tên ("CartId", "ProductId") để spec sinh ra #/components/parameters và dùng $ref.
export const CartIdParam = z.uuid().openapi("CartId", {
  param: { name: "cartId", in: "path" },
  example: "0b8f4c7e-5d2a-4f1b-9c3e-7a6d5e4f3b21",
});
export const ProductIdParam = z.uuid().openapi("ProductId", {
  param: { name: "productId", in: "path" },
  example: SEED.keyboard,
});

export const CartParams = z.object({ cartId: CartIdParam });
export const CartItemParams = z.object({ cartId: CartIdParam, productId: ProductIdParam });

export const ListProductsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20).openapi({
    param: { name: "limit", in: "query" },
    description: "Số product mỗi trang (1-50)",
    example: 20,
  }),
  offset: z.coerce.number().int().min(0).default(0).openapi({
    param: { name: "offset", in: "query" },
    description: "Bỏ qua bao nhiêu product",
    example: 0,
  }),
});

// ---------- Request bodies ----------
const Quantity = z.number().int().min(1).max(10).openapi({ example: 2 });

// z.strictObject => additionalProperties: false (field lạ bị trả 400)
export const AddItemRequest = z
  .strictObject({
    product_id: z.uuid().openapi({ example: SEED.keyboard }),
    quantity: Quantity,
  })
  .openapi("AddItemRequest");

export const UpdateItemRequest = z.strictObject({ quantity: Quantity }).openapi("UpdateItemRequest");

// ---------- Responses ----------
export const Product = z
  .object({
    id: z.uuid(),
    sku: z.string(),
    name: z.string(),
    price_cents: z.number().int().positive(),
    stock: z.number().int().min(0),
  })
  .openapi("Product", {
    example: { id: SEED.keyboard, sku: "KB-001", name: "Mechanical Keyboard", price_cents: 120000, stock: 20 },
  });

export const ProductList = z
  .object({
    items: z.array(Product),
    limit: z.number().int(),
    offset: z.number().int(),
    total: z.number().int(),
  })
  .openapi("ProductList");

export const CartItem = z
  .object({
    product_id: z.uuid(),
    sku: z.string(),
    name: z.string(),
    unit_price_cents: z.number().int(),
    quantity: z.number().int().min(1).max(10),
    line_total_cents: z.number().int(),
  })
  .openapi("CartItem");

export const Cart = z
  .object({
    id: z.uuid(),
    status: z.enum(["open", "checked_out"]),
    items: z.array(CartItem),
    subtotal_cents: z.number().int().min(0),
  })
  .openapi("Cart", {
    example: {
      id: "0b8f4c7e-5d2a-4f1b-9c3e-7a6d5e4f3b21",
      status: "open",
      items: [
        {
          product_id: SEED.keyboard,
          sku: "KB-001",
          name: "Mechanical Keyboard",
          unit_price_cents: 120000,
          quantity: 2,
          line_total_cents: 240000,
        },
      ],
      subtotal_cents: 240000,
    },
  });

export const ErrorResponse = z
  .object({
    code: z.enum(ERROR_CODES).describe("Mã cố định để client rẽ nhánh"),
    message: z.string().describe("Chỉ để hiển thị cho người dùng"),
    details: z.array(z.object({ field: z.string(), issue: z.string() })),
    request_id: z.uuid().describe("Trùng với header X-Request-Id và dòng log"),
  })
  .openapi("Error");

export type CartDto = z.infer<typeof Cart>;
export type ProductDto = z.infer<typeof Product>;
