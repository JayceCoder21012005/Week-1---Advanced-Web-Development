export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "CART_NOT_FOUND",
  "ITEM_NOT_FOUND",
  "PRODUCT_UNAVAILABLE",
  "INSUFFICIENT_STOCK",
  "ITEM_ALREADY_IN_CART",
  "CART_CLOSED",
  "NOT_FOUND",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ErrorDetail = { field: string; issue: string };

/** Lỗi có chủ đích: wrapper chuyển thành response theo error contract. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details: ErrorDetail[] = [],
  ) {
    super(message);
  }
}

export const Errors = {
  validation: (details: ErrorDetail[]) =>
    new ApiError(400, "VALIDATION_ERROR", "Request không hợp lệ", details),
  cartNotFound: () => new ApiError(404, "CART_NOT_FOUND", "Không tìm thấy cart"),
  itemNotFound: () => new ApiError(404, "ITEM_NOT_FOUND", "Product không có trong cart"),
  productUnavailable: () =>
    new ApiError(422, "PRODUCT_UNAVAILABLE", "Product không tồn tại hoặc đã ngừng bán"),
  insufficientStock: (stock: number) =>
    new ApiError(409, "INSUFFICIENT_STOCK", `Số lượng vượt tồn kho (còn ${stock})`),
  itemAlreadyInCart: () =>
    new ApiError(409, "ITEM_ALREADY_IN_CART", "Product đã có trong cart, hãy dùng PATCH để đổi số lượng"),
  cartClosed: () => new ApiError(409, "CART_CLOSED", "Cart đã checkout, không thể thay đổi"),
};
