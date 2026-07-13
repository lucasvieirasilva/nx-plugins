import { createTestWorkspace, TestWorkspace } from './utils/workspace';

describe('nx-python (install smoke test)', () => {
  let workspace: TestWorkspace;

  beforeAll(() => {
    workspace = createTestWorkspace('smoke-test');
  });

  afterAll(() => {
    workspace?.cleanup();
  });

  it('should be installed', () => {
    // `pnpm ls` fails if the package is not installed properly.
    expect(() =>
      workspace.run('pnpm ls --depth 100 @nxlv/python'),
    ).not.toThrow();
  });

  it('should expose the plugin generators and executors', () => {
    const output = workspace.run('pnpm nx list @nxlv/python');
    expect(output).toContain('poetry-project');
    expect(output).toContain('uv-project');
    expect(output).toContain('build');
  });
});
