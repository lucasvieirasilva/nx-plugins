export const execSyncMock = jest.fn()
export const spawnSyncMock = jest.fn()

jest.mock('child_process', () => {
  return {
    execSync: execSyncMock,
    spawnSync: spawnSyncMock,
  };
});
