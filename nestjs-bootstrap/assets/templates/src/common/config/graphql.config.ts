import { registerAs } from '@nestjs/config';

export interface GraphQLConfig {
  autoSchemaFile: boolean;
  sortSchema: boolean;
  playgroundEnabled: boolean;
  depthLimit: number;
}

export default registerAs<GraphQLConfig>('graphql', () => ({
  autoSchemaFile: true,
  sortSchema: true,
  playgroundEnabled: false,
  depthLimit: 10,
}));
