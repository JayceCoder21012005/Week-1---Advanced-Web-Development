/** Xuất spec ra file tĩnh docs/openapi.json (để nộp bài / dùng với công cụ khác). */
import { mkdirSync, writeFileSync } from "node:fs";
import { buildOpenApiDocument } from "../lib/api/openapi";

mkdirSync("docs", { recursive: true });
writeFileSync("docs/openapi.json", JSON.stringify(buildOpenApiDocument(), null, 2) + "\n");
console.log("wrote docs/openapi.json");
