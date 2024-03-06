import { vi } from 'vitest';

export const uuidMock = vi.fn();

vi.mock('uuid', () => {
  return {
    v4: uuidMock,
  };
});
