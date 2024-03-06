import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  scan: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  batchGet: vi.fn(),
  batchDelete: vi.fn(),
  batchPut: vi.fn(),
  query: vi.fn(),
  defaults: {
    set: vi.fn(),
  },
}));

vi.mock('dynamoose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('dynamoose')>();
  return {
    ...actual,
    model: vi.fn(() => ({ ...mocks })),
    Table: {
      defaults: mocks.defaults,
    },
  };
});

export const modelMock = {
  ...mocks,
};
