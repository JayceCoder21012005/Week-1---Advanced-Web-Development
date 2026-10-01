import { rejectOtherMethods, withApi } from "@/lib/api/handler";
import { createCart } from "@/lib/cart/service";

export const POST = withApi(async () => {
  const cart = await createCart();
  return Response.json(cart, { status: 201, headers: { Location: `/carts/${cart.id}` } });
});

export const { GET, PUT, PATCH, DELETE } = rejectOtherMethods(["POST"]);
