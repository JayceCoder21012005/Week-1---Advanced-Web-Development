import { rejectOtherMethods, withApi } from "@/lib/api/handler";
import { CartItemParams, UpdateItemRequest } from "@/lib/api/schemas";
import { validate } from "@/lib/api/validate";
import { removeItem, updateItem } from "@/lib/cart/service";

type Params = { cartId: string; productId: string };

export const PATCH = withApi<Params>(async ({ req, params }) => {
  const { params: p, body } = await validate(req, params, { params: CartItemParams, body: UpdateItemRequest });
  return Response.json(await updateItem(p.cartId, p.productId, body.quantity));
});

export const DELETE = withApi<Params>(async ({ req, params }) => {
  const { params: p } = await validate(req, params, { params: CartItemParams });
  await removeItem(p.cartId, p.productId);
  return new Response(null, { status: 204 });
});

export const { GET, POST, PUT } = rejectOtherMethods(["PATCH", "DELETE"]);
