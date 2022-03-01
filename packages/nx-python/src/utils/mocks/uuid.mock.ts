export const uuidMock = jest.fn()

jest.mock("uuid", () => {
  return {
    v4: uuidMock
  };
});
