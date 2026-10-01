/**
 * Rule nghiệp vụ — phần schema không kiểm tra được (cần đọc DB).
 * Mọi thao tác ghi chạy trong transaction và khóa dòng cart (FOR UPDATE)
 * để hai request đồng thời không phá rule.
 * Giá luôn đọc từ DB, không bao giờ nhận từ client.
 */
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db/pool";
import { Errors } from "../api/errors";
import type { CartDto, ProductDto } from "../api/schemas";

export async function listProducts(limit: number, offset: number) {
  const [items, count] = await Promise.all([
    pool.query<ProductDto>(
      `SELECT id, sku, name, price_cents, stock FROM products
       WHERE is_active ORDER BY sku LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query<{ total: number }>("SELECT count(*)::int AS total FROM products WHERE is_active"),
  ]);
  return { items: items.rows, limit, offset, total: count.rows[0].total };
}

export async function createCart(): Promise<CartDto> {
  const id = randomUUID();
  await pool.query("INSERT INTO carts (id) VALUES ($1)", [id]);
  return { id, status: "open", items: [], subtotal_cents: 0 };
}

export async function getCart(cartId: string, db: Pick<PoolClient, "query"> = pool): Promise<CartDto> {
  const cart = await db.query<{ id: string; status: "open" | "checked_out" }>(
    "SELECT id, status FROM carts WHERE id = $1",
    [cartId],
  );
  if (!cart.rowCount) throw Errors.cartNotFound();

  const items = await db.query<CartDto["items"][number]>(
    `SELECT ci.product_id, p.sku, p.name, p.price_cents AS unit_price_cents, ci.quantity,
            (p.price_cents * ci.quantity) AS line_total_cents
     FROM cart_items ci JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = $1 ORDER BY p.sku`,
    [cartId],
  );
  const subtotal = items.rows.reduce((sum, i) => sum + i.line_total_cents, 0);
  return { ...cart.rows[0], items: items.rows, subtotal_cents: subtotal };
}

export async function addItem(cartId: string, productId: string, quantity: number) {
  return inOpenCart(cartId, async (db) => {
    const product = await loadSellableProduct(db, productId);
    const existing = await db.query("SELECT 1 FROM cart_items WHERE cart_id = $1 AND product_id = $2", [
      cartId,
      productId,
    ]);
    if (existing.rowCount) throw Errors.itemAlreadyInCart();
    if (quantity > product.stock) throw Errors.insufficientStock(product.stock);

    await db.query("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)", [
      cartId,
      productId,
      quantity,
    ]);
  });
}

export async function updateItem(cartId: string, productId: string, quantity: number) {
  return inOpenCart(cartId, async (db) => {
    const existing = await db.query("SELECT 1 FROM cart_items WHERE cart_id = $1 AND product_id = $2", [
      cartId,
      productId,
    ]);
    if (!existing.rowCount) throw Errors.itemNotFound();
    const product = await loadSellableProduct(db, productId);
    if (quantity > product.stock) throw Errors.insufficientStock(product.stock);

    await db.query("UPDATE cart_items SET quantity = $3 WHERE cart_id = $1 AND product_id = $2", [
      cartId,
      productId,
      quantity,
    ]);
  });
}

export async function removeItem(cartId: string, productId: string) {
  await inOpenCart(cartId, async (db) => {
    const res = await db.query("DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2", [cartId, productId]);
    if (!res.rowCount) throw Errors.itemNotFound();
  });
}

// ---------- helpers ----------

async function loadSellableProduct(db: PoolClient, productId: string) {
  const res = await db.query<{ stock: number; is_active: boolean }>(
    "SELECT stock, is_active FROM products WHERE id = $1",
    [productId],
  );
  const product = res.rows[0];
  if (!product || !product.is_active) throw Errors.productUnavailable();
  return product;
}

/** Mở transaction, khóa cart, kiểm tra 404/409 CART_CLOSED, chạy `work`, trả cart mới. */
async function inOpenCart(cartId: string, work: (db: PoolClient) => Promise<void>): Promise<CartDto> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const cart = await db.query<{ status: string }>("SELECT status FROM carts WHERE id = $1 FOR UPDATE", [cartId]);
    if (!cart.rowCount) throw Errors.cartNotFound();
    if (cart.rows[0].status !== "open") throw Errors.cartClosed();

    await work(db);
    const result = await getCart(cartId, db);
    await db.query("COMMIT");
    return result;
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    db.release();
  }
}
