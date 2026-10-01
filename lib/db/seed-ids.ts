// UUID cố định trong db/seed.sql — dùng cho script nghiệm thu và ví dụ trong OpenAPI.
export const SEED = {
  keyboard: "11111111-1111-4111-8111-111111111111", // 120000, stock 20
  mouse: "22222222-2222-4222-8222-222222222222", // 45000, stock 5
  hub: "33333333-3333-4333-8333-333333333333", // 30000, stock 50
  outOfStock: "44444444-4444-4444-8444-444444444444", // stock 0
  inactive: "55555555-5555-4555-8555-555555555555", // is_active = false
  checkedOutCart: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
} as const;
