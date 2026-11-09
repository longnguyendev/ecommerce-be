import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Tỉnh / thành phố (danh mục 2 cấp từ 01/07/2025)' })
export class Province {
  @Field(() => ID, { description: 'Mã chính thức, 2 chữ số' })
  code!: string;

  @Field({ description: 'Tên đầy đủ, vd "Thành phố Hồ Chí Minh"' })
  name!: string;

  @Field({ description: '"tỉnh" | "thành phố trung ương"' })
  type!: string;
}

@ObjectType({ description: 'Xã / phường / đặc khu' })
export class Ward {
  @Field(() => ID, { description: 'Mã chính thức, 5 chữ số' })
  code!: string;

  @Field({ description: 'Tên đầy đủ, vd "Phường Bến Thành"' })
  name!: string;

  @Field({ description: '"phường" | "xã" | "đặc khu"' })
  type!: string;

  @Field(() => ID)
  provinceCode!: string;
}
