import * as nxPython from './index';

describe('nx-python index', () => {
  it('should have processProjectGraph', async () => {
    expect(nxPython.processProjectGraph).toBeTruthy();
    expect(nxPython.processProjectGraph instanceof Function).toBeTruthy();
  });
});
