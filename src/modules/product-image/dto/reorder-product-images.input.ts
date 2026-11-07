import { Field, ID, InputType } from '@nestjs/graphql';
import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

@InputType()
export class ReorderProductImagesInput {
  @Field(() => ID)
  @IsUUID()
  productId!: string;

  /** Thứ tự mới của ảnh sản phẩm. Ảnh đầu tiên = ảnh đại diện. */
  @Field(() => [ID])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  imageIds!: string[];
}
