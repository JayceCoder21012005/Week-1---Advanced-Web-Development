import pino from "pino";

// Log JSON ra stdout và file logs/app.log để tra cứu theo request_id.
const globalForLog = globalThis as unknown as { logger?: pino.Logger };

export const logger =
  globalForLog.logger ??
  pino(
    {
      level: process.env.LOG_LEVEL ?? "info",
      base: { service: "cart-api" },
      timestamp: pino.stdTimeFunctions.isoTime,
      // Không bao giờ ghi password, token, header Authorization.
      redact: {
        paths: ["password", "token", "*.password", "*.token", "headers.authorization", "headers.cookie"],
        censor: "[REDACTED]",
      },
    },
    pino.multistream([
      { stream: process.stdout },
      { stream: pino.destination({ dest: "logs/app.log", mkdir: true, sync: false }) },
    ]),
  );

if (process.env.NODE_ENV !== "production") globalForLog.logger = logger;
