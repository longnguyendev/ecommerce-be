import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Type } from '@nestjs/common';

export interface IPaginatedType<T> {
  edges: { cursor: string; node: T }[];
  nodes: T[];
  totalCount: number;
  hasNextPage: boolean;
}

export function Paginated<T>(classRef: Type<T>): Type<IPaginatedType<T>> {
  @ObjectType(`${classRef.name}Edge`)
  abstract class EdgeType {
    @Field()
    cursor!: string;

    @Field(() => classRef)
    node!: T;
  }

  @ObjectType(`${classRef.name}Connection`)
  abstract class PaginatedType implements IPaginatedType<T> {
    @Field(() => [EdgeType])
    edges!: EdgeType[];

    @Field(() => [classRef])
    nodes!: T[];

    @Field(() => Int)
    totalCount!: number;

    @Field()
    hasNextPage!: boolean;
  }

  return PaginatedType as Type<IPaginatedType<T>>;
}
