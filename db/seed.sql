-- 5 product: 3 đang bán còn hàng, 1 hết hàng (stock = 0), 1 ngừng bán (is_active = false)
INSERT INTO products (id, sku, name, price_cents, stock, is_active) VALUES
  ('11111111-1111-4111-8111-111111111111', 'KB-001',  'Mechanical Keyboard', 120000, 20, true),
  ('22222222-2222-4222-8222-222222222222', 'MS-002',  'Wireless Mouse',       45000,  5, true),
  ('33333333-3333-4333-8333-333333333333', 'HD-003',  'USB-C Hub',            30000, 50, true),
  ('44444444-4444-4444-8444-444444444444', 'MN-004',  '4K Monitor',          550000,  0, true),
  ('55555555-5555-4555-8555-555555555555', 'WC-005',  'Old Webcam',           25000, 10, false);

-- 1 cart đã checkout để thử lỗi CART_CLOSED
INSERT INTO carts (id, status) VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'checked_out');
