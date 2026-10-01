"use client";

import { useEffect, useState } from "react";

type Product = { id: string; sku: string; name: string; price_cents: number; stock: number };
type CartItem = { product_id: string; name: string; unit_price_cents: number; quantity: number; line_total_cents: number };
type Cart = { id: string; status: string; items: CartItem[]; subtotal_cents: number };
type ApiError = { code: string; message: string; details: { field: string; issue: string }[]; request_id: string };

const vnd = (cents: number) => (cents / 100).toLocaleString("vi-VN") + " ₫";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});

  async function api<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) {
      setError(data);
      return null;
    }
    setError(null);
    return data;
  }

  useEffect(() => {
    fetch("/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.items));
  }, []);

  const refresh = async (id: string) => setCart(await api<Cart>("GET", `/carts/${id}`));

  async function createCart() {
    setCart(await api<Cart>("POST", "/carts"));
  }

  async function add(productId: string) {
    if (!cart) return;
    const c = await api<Cart>("POST", `/carts/${cart.id}/items`, { product_id: productId, quantity: qty[productId] ?? 1 });
    if (c) setCart(c);
  }

  async function update(productId: string, quantity: number) {
    if (!cart) return;
    const c = await api<Cart>("PATCH", `/carts/${cart.id}/items/${productId}`, { quantity });
    if (c) setCart(c);
  }

  async function remove(productId: string) {
    if (!cart) return;
    await api("DELETE", `/carts/${cart.id}/items/${productId}`);
    await refresh(cart.id);
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-6 font-sans">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cart API — demo client</h1>
          <p className="text-sm text-zinc-500">UI chỉ gọi API công khai; tài liệu đầy đủ ở /docs.</p>
        </div>
        <div className="flex gap-2">
          {/* /docs là route handler trả HTML, không phải page nên không dùng <Link> */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="rounded border px-3 py-1.5 text-sm" href="/docs">
            /docs
          </a>
          <a className="rounded border px-3 py-1.5 text-sm" href="/openapi.json">
            /openapi.json
          </a>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
          <div className="font-mono font-semibold">{error.code}</div>
          <div>{error.message}</div>
          {error.details.map((d) => (
            <div key={d.field} className="font-mono">
              {d.field}: {d.issue}
            </div>
          ))}
          <div className="mt-1 font-mono text-xs opacity-70">request_id: {error.request_id}</div>
        </div>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 font-semibold">Sản phẩm đang bán</h2>
          <ul className="space-y-2">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded border p-3">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-zinc-500">
                    {p.sku} · {vnd(p.price_cents)} · kho {p.stock}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    className="w-14 rounded border px-1 py-1 text-sm"
                    value={qty[p.id] ?? 1}
                    onChange={(e) => setQty({ ...qty, [p.id]: Number(e.target.value) })}
                  />
                  <button
                    className="rounded bg-black px-2 py-1 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
                    disabled={!cart}
                    onClick={() => add(p.id)}
                  >
                    Thêm
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Giỏ hàng</h2>
            <button className="rounded border px-2 py-1 text-sm" onClick={createCart}>
              Tạo cart mới
            </button>
          </div>
          {!cart ? (
            <p className="text-sm text-zinc-500">Chưa có cart — bấm “Tạo cart mới”.</p>
          ) : (
            <div className="rounded border p-3">
              <div className="mb-2 font-mono text-xs text-zinc-500">
                {cart.id} · {cart.status}
              </div>
              {cart.items.length === 0 && <p className="text-sm text-zinc-500">Cart rỗng.</p>}
              <ul className="space-y-2">
                {cart.items.map((i) => (
                  <li key={i.product_id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{i.name}</span>
                    <span className="flex items-center gap-1">
                      <button className="rounded border px-2" onClick={() => update(i.product_id, i.quantity - 1)}>
                        −
                      </button>
                      <span className="w-6 text-center">{i.quantity}</span>
                      <button className="rounded border px-2" onClick={() => update(i.product_id, i.quantity + 1)}>
                        +
                      </button>
                      <span className="w-28 text-right">{vnd(i.line_total_cents)}</span>
                      <button className="text-red-600" onClick={() => remove(i.product_id)}>
                        ✕
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t pt-2 font-semibold">
                <span>Tạm tính</span>
                <span>{vnd(cart.subtotal_cents)}</span>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
