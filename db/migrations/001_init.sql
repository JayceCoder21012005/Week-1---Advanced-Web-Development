-- Products: chỉ product is_active = true mới được thêm vào cart.
-- Lưu ý: slide ghi CHECK (stock <= 0) — đây là lỗi đánh máy, stock phải >= 0.
CREATE TABLE products (
  id          uuid PRIMARY KEY,
  sku         text UNIQUE NOT NULL,
  name        text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents > 0),
  stock       integer NOT NULL CHECK (stock >= 0),
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE carts (
  id     uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'checked_out'))
);

CREATE TABLE cart_items (
  cart_id    uuid REFERENCES carts(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  quantity   integer NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  PRIMARY KEY (cart_id, product_id)
);
