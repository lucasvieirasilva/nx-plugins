import { vi } from 'vitest';

vi.mock('cross-spawn', async (importOriginal) => {
  const actual = await importOriginal<typeof import('cross-spawn')>();
  return {
    ...actual,
    default: {
      sync: vi.fn(),
    },
  };
});
