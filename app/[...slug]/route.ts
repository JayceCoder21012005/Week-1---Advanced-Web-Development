import { withApi } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";

// Mọi đường dẫn không khớp route nào: trả 404 theo error contract thay vì trang HTML mặc định.
const notFound = withApi<{ slug: string[] }>(async () => {
  throw Errors.notFound();
});

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
