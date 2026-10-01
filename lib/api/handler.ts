import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Logger } from "pino";
import { ApiError, type ErrorDetail } from "./errors";
import { logger } from "./logger";

type Ctx<P> = { req: NextRequest; params: P; requestId: string; log: Logger };

/**
 * Bọc mọi route handler:
 *  - sinh request_id, trả trong header X-Request-Id
 *  - log 1 dòng mỗi request (method, path, status, duration, error code)
 *  - đổi mọi lỗi (kể cả lỗi không lường trước) sang error contract; 500 không lộ stack/SQL
 */
export function withApi<P extends Record<string, string>>(handler: (ctx: Ctx<P>) => Promise<Response>) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    const requestId = randomUUID();
    const start = performance.now();
    const log = logger.child({ request_id: requestId });
    let res: Response;
    let errInfo: Record<string, unknown> | undefined;

    try {
      res = await handler({ req, params: await context.params, requestId, log });
    } catch (err) {
      if (err instanceof ApiError) {
        errInfo = { code: err.code, details: err.details };
        res = errorResponse(err.status, err.code, err.message, err.details, requestId);
      } else {
        // Stack trace chỉ nằm trong log, không bao giờ trong response.
        errInfo = { code: "INTERNAL_ERROR", err };
        res = errorResponse(500, "INTERNAL_ERROR", "Lỗi hệ thống, vui lòng thử lại sau", [], requestId);
      }
    }

    res.headers.set("X-Request-Id", requestId);
    const entry = {
      method: req.method,
      path: req.nextUrl.pathname + req.nextUrl.search,
      status: res.status,
      duration_ms: Math.round(performance.now() - start),
      ...errInfo,
    };
    if (res.status >= 500) log.error(entry, "request failed");
    else if (res.status >= 400) log.warn(entry, "request rejected");
    else log.info(entry, "request completed");
    return res;
  };
}

function errorResponse(status: number, code: string, message: string, details: ErrorDetail[], requestId: string) {
  return Response.json({ code, message, details, request_id: requestId }, { status });
}
