import { rejectOtherMethods, withApi } from "@/lib/api/handler";
import { CartParams } from "@/lib/api/schemas";
import { validate } from "@/lib/api/validate";
import { getCart } from "@/lib/cart/service";

export const GET = withApi<{ cartId: string }>(async ({ req, params }) => {
  const { params: p } = await validate(req, params, { params: CartParams });
  return Response.json(await getCart(p.cartId));
});

export const { POST, PUT, PATCH, DELETE } = rejectOtherMethods(["GET"]);
