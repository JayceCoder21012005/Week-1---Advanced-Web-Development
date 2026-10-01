import { rejectOtherMethods, withApi } from "@/lib/api/handler";
import { AddItemRequest, CartParams } from "@/lib/api/schemas";
import { validate } from "@/lib/api/validate";
import { addItem } from "@/lib/cart/service";

export const POST = withApi<{ cartId: string }>(async ({ req, params }) => {
  const { params: p, body } = await validate(req, params, { params: CartParams, body: AddItemRequest });
  const cart = await addItem(p.cartId, body.product_id, body.quantity);
  return Response.json(cart, { status: 201 });
});

export const { GET, PUT, PATCH, DELETE } = rejectOtherMethods(["POST"]);
