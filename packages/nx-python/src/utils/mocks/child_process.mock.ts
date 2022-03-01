export const execSyncMock = jest.fn()

jest.mock("child_process", () => {
  return {
    execSync: execSyncMock
  };
});
