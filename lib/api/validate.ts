import type { NextRequest } from "next/server";
import type { z } from "zod";
import { Errors, type ErrorDetail } from "./errors";

/** Đổi issue của zod sang `details` của error contract (không để format thư viện lọt ra). */
function toDetails(issues: z.core.$ZodIssue[]): ErrorDetail[] {
  return issues.flatMap((i): ErrorDetail[] => {
    const field = i.path.join(".") || "body";
    switch (i.code) {
      case "unrecognized_keys":
        return i.keys.map((k) => ({ field: [...i.path, k].join("."), issue: "is not allowed" }));
      case "too_big":
        return [{ field, issue: `must be <= ${i.maximum}` }];
      case "too_small":
        return [{ field, issue: `must be >= ${i.minimum}` }];
      case "invalid_type":
        return [{ field, issue: i.input === undefined ? "is required" : `must be ${i.expected}` }];
      case "invalid_format":
        return [{ field, issue: `must be a valid ${i.format}` }];
      default:
        return [{ field, issue: i.message }];
    }
  });
}

type Parts = { params?: z.ZodType; query?: z.ZodType; body?: z.ZodType };
type Parsed<T extends Parts> = { [K in keyof T]: T[K] extends z.ZodType ? z.output<T[K]> : never };

/**
 * Validate path, query và body ở boundary — chạy TRƯỚC mọi truy vấn DB.
 * Gom lỗi của cả 3 phần rồi ném một lần 400 VALIDATION_ERROR.
 */
export async function validate<T extends Parts>(
  req: NextRequest,
  rawParams: Record<string, string>,
  schemas: T,
): Promise<Parsed<T>> {
  const out: Record<string, unknown> = {};
  const details: ErrorDetail[] = [];

  const run = (key: keyof Parts, schema: z.ZodType, input: unknown) => {
    const r = schema.safeParse(input);
    if (r.success) out[key] = r.data;
    else details.push(...toDetails(r.error.issues));
  };

  if (schemas.params) run("params", schemas.params, rawParams);
  if (schemas.query) run("query", schemas.query, Object.fromEntries(req.nextUrl.searchParams));
  if (schemas.body) {
    const text = await req.text();
    let body: unknown;
    let jsonOk = true;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      jsonOk = false;
      details.push({ field: "body", issue: "must be valid JSON" });
    }
    if (jsonOk) run("body", schemas.body, body);
  }

  if (details.length) throw Errors.validation(details);
  return out as Parsed<T>;
}
