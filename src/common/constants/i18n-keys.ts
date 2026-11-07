export const I18N_KEYS = {
  ERRORS: {
    SYSTEM: {
      DEFAULT: 'errors.system.default',
      BAD_REQUEST: 'errors.system.badRequest',
      UNAUTHORIZED: 'errors.system.unauthorized',
      FORBIDDEN: 'errors.system.forbidden',
      NOT_FOUND: 'errors.system.notFound',
      CONFLICT: 'errors.system.conflict',
      TOO_MANY_REQUESTS: 'errors.system.tooManyRequests',
      INTERNAL_SERVER_ERROR: 'errors.system.internalServerError',
      SERVICE_UNAVAILABLE: 'errors.system.serviceUnavailable',
    },
    BUSINESS: {
      CATEGORY: {
        INVALID_PARENT: 'errors.business.category.invalidParent',
      },
      VARIANT: {
        ATTRIBUTE_MISMATCH: 'errors.business.variant.attributeMismatch',
        DUPLICATE_ATTRIBUTE: 'errors.business.variant.duplicateAttribute',
        PRODUCT_INACTIVE: 'errors.business.variant.productInactive',
      },
      CUSTOMER: {
        ADDRESS_NOT_FOUND: 'errors.business.customer.addressNotFound',
      },
      COUPON: {
        INVALID: 'errors.business.coupon.invalid',
        EXPIRED: 'errors.business.coupon.expired',
        USAGE_LIMIT: 'errors.business.coupon.usageLimitReached',
        MIN_ORDER_VALUE: 'errors.business.coupon.minOrderValue',
      },
      ORDER: {
        EMPTY_ITEMS: 'errors.business.order.emptyItems',
        VARIANT_NOT_FOUND: 'errors.business.order.variantNotFound',
        INSUFFICIENT_STOCK: 'errors.business.order.insufficientStock',
        INVALID_STATUS_TRANSITION:
          'errors.business.order.invalidStatusTransition',
        ORDER_NOT_FOUND: 'errors.business.order.notFound',
      },
      PAYMENT: {
        ORDER_NOT_FOUND: 'errors.business.payment.orderNotFound',
        AMOUNT_MISMATCH: 'errors.business.payment.amountMismatch',
      },
    },
  },
};
