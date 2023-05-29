export const scanMock = jest.fn();
export const createMock = jest.fn();
export const getMock = jest.fn();
export const updateMock = jest.fn();
export const deleteMock = jest.fn();
export const batchGetMock = jest.fn();
export const batchDeleteMock = jest.fn();
export const batchPutMock = jest.fn();
export const queryMock = jest.fn();
export const defaultsMock = {
  set: jest.fn(),
};

export const modelMock = {
  batchDelete: batchDeleteMock,
  batchGet: batchGetMock,
  batchPut: batchPutMock,
  create: createMock,
  delete: deleteMock,
  get: getMock,
  query: queryMock,
  update: updateMock,
  scan: scanMock,
};

export const model = jest.fn(() => ({ ...modelMock }));

jest.mock('dynamoose', () => ({
  ...jest.requireActual('dynamoose'),
  model,
  Table: {
    defaults: defaultsMock,
  },
}));
