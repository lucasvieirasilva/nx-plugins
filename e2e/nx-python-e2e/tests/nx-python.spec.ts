import {
  ensureNxProject,
  readJson,
  runNxCommandAsync,
  updateFile,
  checkFilesExist,
} from '@nrwl/nx-plugin/testing';
describe('nx-python e2e', () => {
  it('should create nx-python project', async () => {
    const app1 = 'app1';
    const lib1 = 'lib1';
    ensureNxProject('@nxlv/python', 'dist/packages/nx-python');

    const nxJson = readJson('nx.json');
    nxJson.plugins = ['@nxlv/python'];

    updateFile('nx.json', JSON.stringify(nxJson, null, 4));

    await runNxCommandAsync(
      `generate @nxlv/python:project ${app1} --type "application" --packageName ${app1} --description ${app1}`
    );

    await runNxCommandAsync(
      `generate @nxlv/python:project ${lib1} --type "library"  --packageName ${lib1} --description ${lib1}`
    );

    await runNxCommandAsync(`run ${app1}:add --name ${lib1} --local`);

    await runNxCommandAsync(`run ${lib1}:add --name pendulum`);

    await runNxCommandAsync(`run ${app1}:lint`);

    await runNxCommandAsync(`run ${app1}:build`);

    expect(() =>
      checkFilesExist(
        `apps/${app1}/dist/${app1.replace('-', '_')}-1.0.0-py3-none-any.whl`,
        `apps/${app1}/dist/${app1}-1.0.0.tar.gz`
      )
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
      `generate @nxlv/python:project ${app1} --type "application" --packageName ${app1} --description ${app1}`
    );

    await runNxCommandAsync(
      `generate @nxlv/python:project ${lib1} --type "library"  --packageName ${lib1} --description ${lib1}`
    );

    await runNxCommandAsync(
      `generate @nxlv/python:project ${lib2} --type "library"  --packageName ${lib2} --description ${lib2}`
    );

    await runNxCommandAsync(`run ${lib1}:add --name ${lib2} --local`);

    await runNxCommandAsync(`run ${app1}:add --name ${lib1} --local`);

    await runNxCommandAsync(`run ${lib2}:add --name numpy`);

    await runNxCommandAsync(`run ${app1}:build`);

    expect(() =>
      checkFilesExist(
        `apps/${app1}/dist/${app1.replace('-', '_')}-1.0.0-py3-none-any.whl`,
        `apps/${app1}/dist/${app1}-1.0.0.tar.gz`
      )
    ).not.toThrow();
  }, 3000000);
});
