export const SALT_OR_ROUNDS = 12;
export const FIVE_MINUTES = 5 * 60 * 1_000;
export const ONE_MINUTE = 60 * 1_000;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ───────── Cart / Checkout ─────────
/** Phí giao hàng cố định (VND). */
export const SHIPPING_FLAT_FEE = 30_000;
/** Đơn có tạm tính (sau giảm giá) từ mức này được miễn phí giao hàng (VND). */
export const FREE_SHIPPING_THRESHOLD = 999_000;
/** Số lượng tối đa cho một dòng sản phẩm trong giỏ. */
export const CART_MAX_LINE_QUANTITY = 10;
/** Giỏ không thay đổi quá số ngày này sẽ bị xoá bởi job dọn dẹp. */
export const CART_TTL_DAYS = 30;
