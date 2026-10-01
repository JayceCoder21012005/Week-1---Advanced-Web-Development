import { Pool } from "pg";

// Giữ một Pool duy nhất qua các lần hot-reload của `next dev`.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    // Fail nhanh khi DB tắt để trả 500 theo error contract thay vì treo request.
    connectionTimeoutMillis: 2000,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;
