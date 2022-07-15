export const spawnSyncMock = jest.fn()

jest.mock('cross-spawn', () => {
  return {
    sync: spawnSyncMock,
  };
});
