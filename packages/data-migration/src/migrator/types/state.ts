export enum MigrationStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  ROLLBACK_RUNNING = 'ROLLBACK_RUNNING',
  ROLLBACK_SUCCESS = 'ROLLBACK_SUCCESS',
  ROLLBACK_ERROR = 'ROLLBACK_ERROR',
}

export type MigrationState = {
  namespace: string;
  version: number;
  name: string;
  status: MigrationStatus;
  startDate: Date;
  endDate: Date;
  errorMessage?: string;
  description?: string;
  rollbackStartDate?: Date;
  rollbackEndDate?: Date;
  migrationPath: string;
};
