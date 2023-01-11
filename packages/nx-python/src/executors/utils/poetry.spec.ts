const commandExistsMock = jest.fn();

jest.mock('command-exists', () => {
  return {
    __esModule: true,
    default: commandExistsMock,
  };
});

import { checkPoetryExecutable } from './poetry';

describe('Poetry Utils', () => {
  it('should check if poetry exists', () => {
    commandExistsMock.mockResolvedValue(undefined);

    expect(checkPoetryExecutable()).resolves.toBeUndefined();
  });

  it('should throw an exeception when poetry is not installed', () => {
    commandExistsMock.mockRejectedValue(null);

    expect(checkPoetryExecutable()).rejects.toThrowError(
      'Poetry is not installed. Please install Poetry before running this command.'
    );
  });
});
