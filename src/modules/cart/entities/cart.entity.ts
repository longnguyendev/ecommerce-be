import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum CartLineIssue {
  /** Biến thể / sản phẩm đã ngừng bán hoặc bị xoá. */
  UNAVAILABLE = 'UNAVAILABLE',
  /** Hết hàng hoàn toàn. */
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  /** Còn hàng nhưng ít hơn số lượng trong giỏ. */
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
}

registerEnumType(CartLineIssue, {
  name: 'CartLineIssue',
  description: 'Vấn đề của một dòng giỏ hàng khiến chưa thể checkout',
});

@ObjectType()
export class CartLine {
  @Field(() => ID)
  variantId!: string;

  @Field(() => ID)
  productId!: string;

  @Field()
  productName!: string;

  @Field()
  productSlug!: string;

  @Field()
  sku!: string;

  @Field(() => String, { nullable: true })
  color?: string | null;

  @Field(() => String, { nullable: true })
  size?: string | null;

  @Field(() => String, { nullable: true })
  image?: string | null;

  @Field(() => Int)
  unitPrice!: number;

  @Field(() => Int, { nullable: true })
  compareAtPrice?: number | null;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Int, {
    description: 'Số lượng tối đa có thể đặt (min tồn kho, giới hạn mỗi dòng)',
  })
  maxQuantity!: number;

  @Field(() => Int)
  lineTotal!: number;

  @Field(() => CartLineIssue, { nullable: true })
  issue?: CartLineIssue | null;
}

@ObjectType()
export class Cart {
  @Field({ description: 'Token định danh giỏ — client lưu lại để gọi tiếp' })
  token!: string;

  @Field(() => [CartLine])
  items!: CartLine[];

  @Field(() => Int)
  itemCount!: number;

  @Field(() => Int)
  subtotal!: number;

  @Field(() => String, { nullable: true })
  couponCode?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'i18n key nếu coupon đang áp không còn hợp lệ',
  })
  couponError?: string | null;

  @Field(() => Int)
  discountAmount!: number;

  @Field(() => Int)
  shippingFee!: number;

  @Field(() => Int)
  total!: number;

  @Field(() => Int, {
    description: 'Tạm tính sau giảm giá từ mức này được miễn phí giao hàng',
  })
  freeShippingThreshold!: number;

  @Field()
  canCheckout!: boolean;
}
