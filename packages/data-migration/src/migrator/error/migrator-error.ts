export class ManagedMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManagedMigrationError';
  }
}
