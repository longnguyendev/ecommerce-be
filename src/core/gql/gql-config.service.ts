import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GqlOptionsFactory } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import depthLimit from 'graphql-depth-limit';

import { AppConfig } from '@/common/config/app.config';

import { formatGraphQLError } from './gql-error-format';

@Injectable()
export class GqlConfigService implements GqlOptionsFactory {
  constructor(private readonly configService: ConfigService<AppConfig>) {}

  createGqlOptions(): ApolloDriverConfig {
    const graphqlConfig = this.configService.get('graphql', { infer: true })!;
    const mode = this.configService.get('server.mode', { infer: true })!;

    return {
      autoSchemaFile: graphqlConfig.autoSchemaFile,
      sortSchema: graphqlConfig.sortSchema,
      buildSchemaOptions: { numberScalarMode: 'integer' },
      playground: graphqlConfig.playgroundEnabled,
      validationRules: [depthLimit(graphqlConfig.depthLimit)],
      includeStacktraceInErrorResponses: false,
      plugins: [
        mode === 'production'
          ? ApolloServerPluginLandingPageProductionDefault()
          : ApolloServerPluginLandingPageLocalDefault(),
      ],
      context: ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res,
      }),
      formatError: formatGraphQLError,
    };
  }
}
