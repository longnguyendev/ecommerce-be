import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/common/constants';

@InputType()
export class PaginationArgs {
  @Field(() => Int, { nullable: true, defaultValue: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  take?: number = DEFAULT_PAGE_SIZE;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number = 0;
}
