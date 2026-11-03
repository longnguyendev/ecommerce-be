import { ApolloDriver } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';

import { GqlConfigService } from './gql-config.service';

@Module({
  imports: [
    GraphQLModule.forRootAsync({
      driver: ApolloDriver,
      useClass: GqlConfigService,
    }),
  ],
  exports: [GraphQLModule],
})
export class GraphqlConfigModule {}
