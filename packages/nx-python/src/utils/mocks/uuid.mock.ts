import { Mock, vi } from 'vitest';

export const uuidMock: Mock = vi.fn();

vi.mock('uuid', () => {
  return {
    v4: uuidMock,
  };
});
