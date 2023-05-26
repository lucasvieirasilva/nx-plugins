import { model } from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';

import { StateSchema } from './state.schema';
import { MigrationState } from '../types/state';

export const MigrationStateModel = model<Item & MigrationState>(
  process.env.MIGRATION_TABLE_NAME ??
    `migration-state-${process.env.AWS_REGION ?? 'us-east-1'}-${
      process.env.ENV
    }`,
  StateSchema,
  {
    create: true,
    throughput: 'ON_DEMAND',
    waitForActive: {
      enabled: true,
      check: {
        timeout: 1000 * 60 * 5, // 5 minutes
      },
    },
  }
);
