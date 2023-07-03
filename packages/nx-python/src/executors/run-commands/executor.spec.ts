jest.mock('nx/src/executors/run-commands/run-commands.impl');
jest.mock('../utils/poetry');

import executor from './executor';

describe('run commands executor', () => {
  const context = {
    cwd: '',
    root: '.',
    isVerbose: false,
    projectName: 'app',
    workspace: {
      npmScope: 'nxlv',
      version: 2,
      projects: {
        app: {
          root: 'apps/app',
          targets: {},
        },
      },
    },
  };

  it('should activate the venv and call the base executor', async () => {
    const options = {
      command: 'test',
      __unparsed__: [],
    };
    await executor(options, context);

    expect((await import('../utils/poetry')).activateVenv).toHaveBeenCalledWith(
      context.root
    );
    expect(
      (await import('nx/src/executors/run-commands/run-commands.impl')).default
    ).toHaveBeenCalledWith(options, context);
  });
});
