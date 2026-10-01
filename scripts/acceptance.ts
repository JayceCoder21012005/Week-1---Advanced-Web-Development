/* eslint-disable @typescript-eslint/no-explicit-any -- script đọc JSON tùy ý từ response/spec */
/**
 * Script nghiệm thu — chạy lại được cho MỌI dòng của ma trận nghiệm thu (slide 19-20).
 *
 *   npm run test:acceptance                 # cần server đang chạy (npm run dev)
 *   npm run test:acceptance -- --skip-db-down   # bỏ kịch bản tắt PostgreSQL
 *
 * Mỗi response đều được đối chiếu với /openapi.json bằng Ajv (độc lập với zod),
 * và kiểm tra request_id trong body == header X-Request-Id == có dòng log trong logs/app.log.
 * Kết quả ghi ra docs/acceptance-report.md.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { Client } from "pg";
import { SEED } from "../lib/db/seed-ids";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
// Kịch bản tắt DB dùng `docker stop`, chỉ áp dụng cho PostgreSQL local (docker compose).
const LOCAL_DB = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");
const SKIP_DB_DOWN = process.argv.includes("--skip-db-down") || !LOCAL_DB;
const PRICES = { keyboard: 120000, hub: 30000 }; // giá trong db/seed.sql

type Res = { status: number; body: any; headers: Headers; method: string; template: string };
type Row = { group: string; scenario: string; expected: string; actual: string; pass: boolean };
const rows: Row[] = [];

// ---------- OpenAPI response validator ----------
let spec: any;
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

function checkAgainstSpec(r: Res): string | null {
  const op = spec.paths[r.template]?.[r.method.toLowerCase()];
  const resSpec = op?.responses?.[String(r.status)];
  if (!resSpec) return `status ${r.status} không được khai báo trong spec cho ${r.method} ${r.template}`;
  const schema = resSpec.content?.["application/json"]?.schema;
  if (!schema) return r.body === null ? null : "spec không có body nhưng response có body";
  const validateFn = ajv.compile(JSON.parse(JSON.stringify(schema).replaceAll('"#/components', '"openapi.json#/components')));
  return validateFn(r.body) ? null : ajv.errorsText(validateFn.errors);
}

// ---------- HTTP ----------
async function call(method: string, template: string, path: string, body?: unknown): Promise<Res> {
  const res = await fetch(BASE + path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers, method, template };
}

const ITEMS = "/carts/{cartId}/items";
const ITEM = "/carts/{cartId}/items/{productId}";

async function newCart() {
  return (await call("POST", "/carts", "/carts")).body.id as string;
}

async function countItems(db: Client) {
  return (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM cart_items")).rows[0].n;
}

function record(group: string, scenario: string, expected: string, r: Res, extra: (string | null)[] = []) {
  const problems: string[] = [];
  const specErr = checkAgainstSpec(r);
  if (specErr) problems.push(`spec: ${specErr}`);
  const rid = r.headers.get("x-request-id");
  if (!rid) problems.push("thiếu header X-Request-Id");
  if (r.status >= 400 && r.body?.request_id !== rid) problems.push("request_id body ≠ header");
  if (r.status >= 500 && /at\s|\.ts|SELECT|ECONN/i.test(JSON.stringify(r.body))) problems.push("lộ chi tiết nội bộ");
  for (const e of extra) if (e) problems.push(e);

  const actual = `${r.status}${r.body?.code ? " " + r.body.code : ""}`;
  const pass = actual.startsWith(expected.split(" ")[0]) && expected.split(" ").every((p) => actual.includes(p)) && !problems.length;
  rows.push({ group, scenario, expected, actual: problems.length ? `${actual} — ${problems.join("; ")}` : actual, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${scenario.padEnd(52)} → ${actual}${problems.length ? "  " + problems.join("; ") : ""}`);
}

const onlyField = (r: Res, field: string) =>
  r.body?.details?.length && r.body.details.every((d: any) => d.field === field)
    ? null
    : `details phải chỉ có '${field}', nhận ${JSON.stringify(r.body?.details)}`;

// ---------- main ----------
async function main() {
  console.log("Reset DB về seed...");
  execSync("npm run db:reset", { stdio: "ignore" });

  spec = await (await fetch(`${BASE}/openapi.json`)).json();
  ajv.addSchema({ $id: "openapi.json", components: spec.components });

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  // ===== Bảng 1: Request sai =====
  const G1 = "Request sai";
  const cart = await newCart();
  for (const q of [0, 11, "2"]) {
    const r = await call("POST", ITEMS, `/carts/${cart}/items`, { product_id: SEED.keyboard, quantity: q });
    record(G1, `quantity = ${JSON.stringify(q)}`, "400 VALIDATION_ERROR", r, [onlyField(r, "quantity")]);
  }
  {
    const before = await countItems(db);
    const r = await call("POST", ITEMS, `/carts/${cart}/items`, { quantity: 1 });
    record(G1, "Thiếu product_id (DB không đổi)", "400 VALIDATION_ERROR", r, [
      (await countItems(db)) === before ? null : "DB bị thay đổi",
    ]);
  }
  {
    const before = await countItems(db);
    const r = await call("POST", ITEMS, `/carts/${cart}/items`, { product_id: SEED.keyboard, quantity: 1, price: 1 });
    record(G1, "Body có field lạ `price` (DB không đổi)", "400 VALIDATION_ERROR", r, [
      onlyField(r, "price"),
      (await countItems(db)) === before ? null : "DB bị thay đổi",
    ]);
  }
  record(G1, "Body không phải JSON", "400 VALIDATION_ERROR", await call("POST", ITEMS, `/carts/${cart}/items`, "{oops"));
  record(G1, "cartId không phải uuid", "400 VALIDATION_ERROR", await call("GET", "/carts/{cartId}", "/carts/not-a-uuid"));
  record(
    G1,
    "cartId hợp lệ nhưng không tồn tại",
    "404 CART_NOT_FOUND",
    await call("GET", "/carts/{cartId}", "/carts/00000000-0000-4000-8000-000000000000"),
  );
  record(G1, "GET /products?limit=51", "400 VALIDATION_ERROR", await call("GET", "/products", "/products?limit=51"));

  // ===== Bảng 2: Nghiệp vụ và server =====
  const G2 = "Nghiệp vụ & server";
  {
    const r = await call("GET", "/products", "/products");
    record(G2, "GET /products: chỉ product đang bán, limit mặc định 20", "200", r, [
      r.body.limit === 20 && r.body.items.every((p: any) => p.id !== SEED.inactive) ? null : "sai limit hoặc lộ product ngừng bán",
    ]);
  }
  {
    const r = await call("POST", "/carts", "/carts");
    record(G2, "POST /carts có header Location", "201", r, [
      r.headers.get("location") === `/carts/${r.body.id}` ? null : "Location sai",
    ]);
  }
  {
    const c = await newCart();
    record(G2, "Thêm keyboard x2", "201", await call("POST", ITEMS, `/carts/${c}/items`, { product_id: SEED.keyboard, quantity: 2 }));
    record(G2, "Thêm hub x3", "201", await call("POST", ITEMS, `/carts/${c}/items`, { product_id: SEED.hub, quantity: 3 }));
    const expected = PRICES.keyboard * 2 + PRICES.hub * 3;
    const r = await call("GET", "/carts/{cartId}", `/carts/${c}`);
    record(G2, `GET cart: subtotal_cents = ${expected} (tính tay)`, "200", r, [
      r.body.subtotal_cents === expected ? null : `subtotal_cents = ${r.body.subtotal_cents}`,
    ]);
    record(G2, "Thêm lại keyboard", "409 ITEM_ALREADY_IN_CART", await call("POST", ITEMS, `/carts/${c}/items`, { product_id: SEED.keyboard, quantity: 1 }));
    record(G2, "PATCH hub quantity = 5", "200", await call("PATCH", ITEM, `/carts/${c}/items/${SEED.hub}`, { quantity: 5 }));
    record(G2, "PATCH item không có trong cart", "404 ITEM_NOT_FOUND", await call("PATCH", ITEM, `/carts/${c}/items/${SEED.mouse}`, { quantity: 1 }));
    record(G2, "DELETE hub", "204", await call("DELETE", ITEM, `/carts/${c}/items/${SEED.hub}`));
    record(G2, "DELETE hub lần 2", "404 ITEM_NOT_FOUND", await call("DELETE", ITEM, `/carts/${c}/items/${SEED.hub}`));
    record(G2, "Product ngừng bán", "422 PRODUCT_UNAVAILABLE", await call("POST", ITEMS, `/carts/${c}/items`, { product_id: SEED.inactive, quantity: 1 }));
    record(G2, "Product không tồn tại", "422 PRODUCT_UNAVAILABLE", await call("POST", ITEMS, `/carts/${c}/items`, { product_id: "99999999-9999-4999-8999-999999999999", quantity: 1 }));
    record(G2, "Vượt stock (mouse x6, stock 5)", "409 INSUFFICIENT_STOCK", await call("POST", ITEMS, `/carts/${c}/items`, { product_id: SEED.mouse, quantity: 6 }));
    record(G2, "Product hết hàng (stock 0)", "409 INSUFFICIENT_STOCK", await call("POST", ITEMS, `/carts/${c}/items`, { product_id: SEED.outOfStock, quantity: 1 }));
  }
  record(G2, "Ghi vào cart đã checkout", "409 CART_CLOSED", await call("POST", ITEMS, `/carts/${SEED.checkedOutCart}/items`, { product_id: SEED.keyboard, quantity: 1 }));

  // request_id phải tìm được trong log
  {
    const r = await call("POST", ITEMS, `/carts/${cart}/items`, { product_id: SEED.keyboard, quantity: 0 });
    await new Promise((ok) => setTimeout(ok, 300));
    const found = readFileSync("logs/app.log", "utf8").includes(r.body.request_id);
    record(G2, "request_id lỗi có dòng log tương ứng", "400 VALIDATION_ERROR", r, [found ? null : "không thấy trong logs/app.log"]);
  }

  await db.end();

  if (SKIP_DB_DOWN) {
    console.log("SKIP  Tắt PostgreSQL: DB không chạy bằng docker local (vd: Neon) — kiểm tra thủ công, xem README");
  } else {
    console.log("Tắt PostgreSQL...");
    execSync("docker stop cart-api-db", { stdio: "ignore" });
    try {
      record(G2, "Tắt PostgreSQL rồi GET /products", "500 INTERNAL_ERROR", await call("GET", "/products", "/products"));
    } finally {
      console.log("Bật lại PostgreSQL...");
      execSync("docker start cart-api-db", { stdio: "ignore" });
      execSync("docker compose up -d --wait", { stdio: "ignore" });
    }
  }

  writeReport();
  const failed = rows.filter((r) => !r.pass).length;
  console.log(`\n${rows.length - failed}/${rows.length} PASS — mọi response đã đối chiếu với /openapi.json`);
  process.exit(failed ? 1 : 0);
}

function writeReport() {
  const lines = [
    "# Kết quả nghiệm thu",
    "",
    `Chạy lúc ${new Date().toISOString()} bằng \`npm run test:acceptance\`. ` +
      "Mỗi response đã được đối chiếu với `/openapi.json` (Ajv) và kiểm tra `X-Request-Id`.",
    "",
    "| Nhóm | Kịch bản | Mong đợi | Thực tế | |",
    "|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.group} | ${r.scenario} | ${r.expected} | ${r.actual} | ${r.pass ? "✅" : "❌"} |`),
    "",
    `**${rows.filter((r) => r.pass).length}/${rows.length} PASS**`,
    "",
  ];
  writeFileSync("docs/acceptance-report.md", lines.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
