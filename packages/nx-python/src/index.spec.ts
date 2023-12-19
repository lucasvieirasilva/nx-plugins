import * as nxPython from './index';

describe('nx-python index', () => {
  it('should have createDependencies', async () => {
    expect(nxPython.createDependencies).toBeTruthy();
    expect(nxPython.createDependencies instanceof Function).toBeTruthy();
  });
});
