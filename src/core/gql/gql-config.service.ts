import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GqlOptionsFactory } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import depthLimit from 'graphql-depth-limit';

import { AppConfig } from '@/common/config/app.config';

import { formatGraphQLError } from './gql-error-format';
import {
  authenticateWsConnection,
  wsRequest,
  type WsConnectionContext,
} from './ws-auth';

@Injectable()
export class GqlConfigService implements GqlOptionsFactory {
  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly jwtService: JwtService,
  ) {}

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
      // graphql-ws dùng chung endpoint /graphql; chỉ admin được kết nối.
      subscriptions: {
        'graphql-ws': {
          path: '/graphql',
          onConnect: (ctx) =>
            authenticateWsConnection(
              this.jwtService,
              ctx as unknown as WsConnectionContext,
            ),
        },
      },
      // HTTP: { req, res }. WebSocket: ctx của graphql-ws -> dựng req tương đương.
      context: (ctx: { req: Request; res: Response } | WsConnectionContext) =>
        'req' in ctx ? { req: ctx.req, res: ctx.res } : { req: wsRequest(ctx) },
      formatError: formatGraphQLError,
    };
  }
}
