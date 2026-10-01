import { withApi } from "@/lib/api/handler";
import { ListProductsQuery } from "@/lib/api/schemas";
import { validate } from "@/lib/api/validate";
import { listProducts } from "@/lib/cart/service";

export const GET = withApi(async ({ req, params }) => {
  const { query } = await validate(req, params, { query: ListProductsQuery });
  return Response.json(await listProducts(query.limit, query.offset));
});
