import {
  ensureNxProject,
  readJson,
  runNxCommandAsync,
  updateFile,
  checkFilesExist,
  readFile,
} from '@nx/plugin/testing';
describe('nx-python e2e', () => {
  it('should create nx-python project', async () => {
    const app1 = 'app1';
    const lib1 = 'lib1';
    ensureNxProject('@nxlv/python', 'dist/packages/nx-python');

    const nxJson = readJson('nx.json');
    nxJson.plugins = ['@nxlv/python'];

    updateFile('nx.json', JSON.stringify(nxJson, null, 4));

    await runNxCommandAsync(
      `generate @nxlv/python:poetry-project ${app1} --projectType "application" --packageName ${app1} --description ${app1}`,
    );

    await runNxCommandAsync(
      `generate @nxlv/python:poetry-project ${lib1} --projectType "library"  --packageName ${lib1} --description ${lib1}`,
    );

    await runNxCommandAsync(`run ${app1}:add --name ${lib1} --local`);

    await runNxCommandAsync(`run ${lib1}:add --name pendulum`);

    await runNxCommandAsync(`run ${app1}:lint`);

    await runNxCommandAsync(`run ${app1}:build`);

    expect(() =>
      checkFilesExist(
        `${app1}/dist/${app1.replace('-', '_')}-1.0.0-py3-none-any.whl`,
        `${app1}/dist/${app1}-1.0.0.tar.gz`,
      ),
    ).not.toThrow();
  }, 3000000);

  it('should create nx-python project with ruff', async () => {
    const app1 = 'app1';
    const lib1 = 'lib1';
    ensureNxProject('@nxlv/python', 'dist/packages/nx-python');

    const nxJson = readJson('nx.json');
    nxJson.plugins = ['@nxlv/python'];

    updateFile('nx.json', JSON.stringify(nxJson, null, 4));

    await runNxCommandAsync(
      `generate @nxlv/python:poetry-project ${app1} --projectType "application" --packageName ${app1} --description ${app1} --linter ruff`,
    );

    await runNxCommandAsync(
      `generate @nxlv/python:poetry-project ${lib1} --projectType "library"  --packageName ${lib1} --description ${lib1} --linter ruff`,
    );

    await runNxCommandAsync(`run ${app1}:add --name ${lib1} --local`);

    await runNxCommandAsync(`run ${lib1}:add --name pendulum`);

    await runNxCommandAsync(`run ${app1}:lint`);

    await runNxCommandAsync(`run ${app1}:build`);

    expect(() =>
      checkFilesExist(
        `${app1}/dist/${app1.replace('-', '_')}-1.0.0-py3-none-any.whl`,
        `${app1}/dist/${app1}-1.0.0.tar.gz`,
      ),
    ).not.toThrow();
  }, 3000000);

  it('should create nx-python project with ruff and as-provided projectNameAndRootFormat', async () => {
    const app1 = 'app1';
    const lib1 = 'lib1';
    ensureNxProject('@nxlv/python', 'dist/packages/nx-python');

    const nxJson = readJson('nx.json');
    nxJson.plugins = ['@nxlv/python'];

    updateFile('nx.json', JSON.stringify(nxJson, null, 4));

    await runNxCommandAsync(
      [
        'generate',
        '@nxlv/python:poetry-project',
        app1,
        '--projectType',
        '"application"',
        '--packageName',
        app1,
        '--description',
        app1,
        '--directory',
        'src/app1',
        '--linter',
        'ruff',
      ].join(' '),
    );

    await runNxCommandAsync(
      [
        'generate',
        '@nxlv/python:poetry-project',
        lib1,
        '--projectType',
        '"library"',
        '--packageName',
        lib1,
        '--description',
        lib1,
        '--directory',
        'src/lib1',
        '--linter',
        'ruff',
      ].join(' '),
    );

    await runNxCommandAsync(`run ${app1}:add --name ${lib1} --local`);

    await runNxCommandAsync(`run ${lib1}:add --name pendulum`);

    await runNxCommandAsync(`run ${app1}:lint`);

    await runNxCommandAsync(`run ${app1}:build`);

    expect(() =>
      checkFilesExist(
        `src/${app1}/dist/${app1.replace('-', '_')}-1.0.0-py3-none-any.whl`,
        `src/${app1}/dist/${app1}-1.0.0.tar.gz`,
      ),
    ).not.toThrow();
  }, 3000000);

  it('should create nx-python project with 3 levels', async () => {
    const app1 = 'app1';
    const lib1 = 'lib1';
    const lib2 = 'lib2';

    ensureNxProject('@nxlv/python', 'dist/packages/nx-python');

    const nxJson = readJson('nx.json');
    nxJson.plugins = ['@nxlv/python'];

    updateFile('nx.json', JSON.stringify(nxJson, null, 4));

    await runNxCommandAsync(
      `generate @nxlv/python:poetry-project ${app1} --projectType "application" --packageName ${app1} --description ${app1}`,
    );

    await runNxCommandAsync(
      `generate @nxlv/python:poetry-project ${lib1} --projectType "library"  --packageName ${lib1} --description ${lib1}`,
    );

    await runNxCommandAsync(
      `generate @nxlv/python:poetry-project ${lib2} --projectType "library"  --packageName ${lib2} --description ${lib2}`,
    );

    await runNxCommandAsync(`run ${lib1}:add --name ${lib2} --local`);

    await runNxCommandAsync(`run ${app1}:add --name ${lib1} --local`);

    await runNxCommandAsync(`run ${lib2}:add --name numpy`);

    await runNxCommandAsync(`run ${app1}:build`);

    expect(() =>
      checkFilesExist(
        `${app1}/dist/${app1.replace('-', '_')}-1.0.0-py3-none-any.whl`,
        `${app1}/dist/${app1}-1.0.0.tar.gz`,
      ),
    ).not.toThrow();
  }, 3000000);

  describe('shared virtual environment', () => {
    it('should create nx-python project with 3 levels with shared virtual environment', async () => {
      const app1 = 'app1';
      const lib1 = 'lib1';
      const lib2 = 'lib2';

      ensureNxProject('@nxlv/python', 'dist/packages/nx-python');

      const nxJson = readJson('nx.json');
      nxJson.plugins = ['@nxlv/python'];

      updateFile('nx.json', JSON.stringify(nxJson, null, 4));

      await runNxCommandAsync(
        `generate @nxlv/python:poetry-project ${app1} --projectType "application" --packageName ${app1} --description ${app1}`,
      );

      await runNxCommandAsync(
        `generate @nxlv/python:poetry-project ${lib1} --projectType "library"  --packageName ${lib1} --description ${lib1}`,
      );

      await runNxCommandAsync(
        `generate @nxlv/python:poetry-project ${lib2} --projectType "library"  --packageName ${lib2} --description ${lib2}`,
      );

      await runNxCommandAsync(`generate @nxlv/python:migrate-to-shared-venv`);

      await runNxCommandAsync(`run ${lib1}:add --name ${lib2} --local`);

      await runNxCommandAsync(`run ${app1}:add --name ${lib1} --local`);

      await runNxCommandAsync(`run ${lib2}:add --name numpy`);

      await runNxCommandAsync(`run ${app1}:build`);

      expect(() =>
        checkFilesExist(
          `${app1}/dist/${app1.replace('-', '_')}-1.0.0-py3-none-any.whl`,
          `${app1}/dist/${app1}-1.0.0.tar.gz`,
        ),
      ).not.toThrow();

      expect(() => checkFilesExist(`.venv`, 'pyproject.toml')).not.toThrow();

      expect(readFile('pyproject.toml')).toMatchSnapshot();
    }, 3000000);

    it('should create one nx-python project, migrate to shared venv and add 3 levels', async () => {
      const app1 = 'app1';
      const lib1 = 'lib1';
      const lib2 = 'lib2';

      ensureNxProject('@nxlv/python', 'dist/packages/nx-python');

      const nxJson = readJson('nx.json');
      nxJson.plugins = ['@nxlv/python'];

      updateFile('nx.json', JSON.stringify(nxJson, null, 4));

      await runNxCommandAsync(
        `generate @nxlv/python:poetry-project ${app1} --projectType "application" --packageName ${app1} --description ${app1}`,
      );

      await runNxCommandAsync(`generate @nxlv/python:migrate-to-shared-venv`);

      await runNxCommandAsync(
        `generate @nxlv/python:poetry-project ${lib1} --projectType "library"  --packageName ${lib1} --description ${lib1}`,
      );

      await runNxCommandAsync(
        `generate @nxlv/python:poetry-project ${lib2} --projectType "library"  --packageName ${lib2} --description ${lib2}`,
      );

      await runNxCommandAsync(`run ${lib1}:add --name ${lib2} --local`);

      await runNxCommandAsync(`run ${app1}:add --name ${lib1} --local`);

      await runNxCommandAsync(`run ${lib2}:add --name numpy`);

      await runNxCommandAsync(`run ${app1}:build`);

      expect(() =>
        checkFilesExist(
          `${app1}/dist/${app1.replace('-', '_')}-1.0.0-py3-none-any.whl`,
          `${app1}/dist/${app1}-1.0.0.tar.gz`,
        ),
      ).not.toThrow();

      expect(() => checkFilesExist(`.venv`, 'pyproject.toml')).not.toThrow();

      expect(readFile('pyproject.toml')).toMatchSnapshot();
    }, 3000000);
  });
});
