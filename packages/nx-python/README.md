# @nxlv/python

![Coverage Badge](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/lucasvieirasilva/64d6f926915811aa067f60e6a70735c8/raw/coverage-packages-nx-python.json)

`@nxlv/python` plugin is designed to extend the Nx features to work with Python projects based on [Uv](https://docs.astral.sh/uv/) or [Poetry](https://python-poetry.org/).

Check this article for a step by step tutorial with Poetry: <https://lucasvieirasilva.medium.com/poetry-python-nx-monorepo-5750d8627024>

## What is @nxlv/python

🔎 An Nx Plugin to generate and manage Python projects in the Nx workspace.

### Main Features

- Generate Python projects using Uv or Poetry.
- Manage local and external dependencies.
- Build and publish Python packages.
- Bundle local dependencies, like ESBuild for JavaScript.
- Linting and Unit Testing.
- Nx Dependency graph integration.

### Motivation

Nx is a powerful tool to manage monorepos, however, it doesn't have built-in support for Python projects, this plugin aims to fill this gap by providing a set of executors to manage Python projects in the Nx workspace, and levearge the Nx features like dependency graph, affected commands, local cache, remote cache, releases, and more to Python projects.

### Why Bundle Local Dependencies

When working with monorepos, it's common to have local dependencies, like shared libraries, that are used across multiple projects and don't necessarily need to be published to a package repository, the `@nxlv/python` plugin provides a way to bundle these local dependencies in the same wheel file.

This approach helps to deploy the projects to Cloud services like AWS Lambda, Google Cloud Functions, Azure Functions, and others, where the deployment package needs to be a single file.

### News

- We now support [Uv](https://docs.astral.sh/uv/) package manager.

## Getting Started

### Add to an existing Nx Workspace

Install the npm dependency

```shell
npm install @nxlv/python --save-dev
```

### Usage

1. Update `nx.json` to add the property `plugins` with `@nxlv/python` value.

Example:

```json
{
  ...
  "plugins": [
    "@nxlv/python"
  ]
  ...
}
```

for Nx 20.x or higher, use the following pattern:

```json
{
  ...
  "plugins": [
    ...
    {
      "plugin": "@nxlv/python"
    }
  ]
  ...
}
```

> **IMPORTANT**: To use `uv` package manager without workspaces, set the `packageManager` option to `uv` in the `nx.json` file, as shown below:

```json
{
  ...
  "plugins": [
    ...
    {
      "plugin": "@nxlv/python",
      "options": {
        "packageManager": "uv"
      }
    }
  ]
  ...
}
```

**NOTE**: The default package manager is `poetry`, but it's automatically detected if the repository is configured to use `uv` workspaces since the `uv.lock` filw will be present in the root directory.

### Poetry

#### Add a new Python Project

```shell
nx generate @nxlv/python:poetry-project myproject
```

**NOTE**: On Nx **v16.8.0** or higher, the generators are prompting the user to choose how Nx will calculate where the project should be located, by using the `--projectNameAndRootFormat` with `as-provided` or `derived`.

The `as-provided` option uses the `--directory` option to calculate the project root, so, if the `--directory` option is not provided, the project root will be the same as the project name, and the project name will be the same as provided in the `--name` option.

Example 1: `nx generate @nxlv/python:poetry-project myproject` will generate the project in the `myproject` folder with the name `myproject`.
Example 2: `nx generate @nxlv/python:poetry-project myproject --directory=api` will generate the project in the `api` folder with the name `myproject`.

The `derived` option uses the combination of the workspace layout, `--directory` option, and `--name` to calculate the name and root of the project.

Example 1: `nx generate @nxlv/python:poetry-project myproject` will generate the project in the `apps/myproject` folder with the name `myproject`.
Example 2: `nx generate @nxlv/python:poetry-project myproject --directory=api` will generate the project in the `apps/api/myproject` folder with the name `api-myproject`.

Nx documentation reference: <https://nx.dev/deprecated/as-provided-vs-derived#project-generators>

##### Options

| Option                           |   Type    | Description                                                                                                                                                                            | Required | Default                                  |
| -------------------------------- | :-------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| `--directory`                    | `string`  | A directory where the project is placed                                                                                                                                                | `false`  | N/A                                      |
| `--tags`                         | `string`  | Add tags to the project                                                                                                                                                                | `false`  | N/A                                      |
| `--projectType`                  | `string`  | Project type `application` or `library`                                                                                                                                                | `true`   | `application`                            |
| `--packageName`                  | `string`  | Poetry Package name                                                                                                                                                                    | `false`  | `name` property (provided in the CLI)    |
| `--moduleName`                   | `string`  | Project Source Module                                                                                                                                                                  | `false`  | `name` property using `_` instead of `-` |
| `--description`                  | `string`  | Project description                                                                                                                                                                    | `false`  | N/A                                      |
| `--pyprojectPythonDependency`    | `string`  | Python version range used in the `pyproject.toml`                                                                                                                                      | `false`  | `>=3.9,<3.11` (Poetry syntax)            |
| `--pyenvPythonVersion`           | `string`  | `.python-version` pyenv file content                                                                                                                                                   | `false`  | `3.9.5`                                  |
| `--publishable`                  | `boolean` | Specifies if the project is publishable or not                                                                                                                                         | `false`  | `true`                                   |
| `--buildLockedVersions`          | `boolean` | Use locked versions for build dependencies                                                                                                                                             | `false`  | `true`                                   |
| `--buildBundleLocalDependencies` | `boolean` | Bundle local dependencies                                                                                                                                                              | `false`  | `true`                                   |
| `--linter`                       | `string`  | Linter framework (`flake8`, `ruff` or `none`)                                                                                                                                          | `false`  | `flake8`                                 |
| `--unitTestRunner`               | `string`  | Unit Test Runner (`pytest` or `none`)                                                                                                                                                  | `false`  | `pytest`                                 |
| `--unitTestHtmlReport`           | `boolean` | Enable HTML Pytest Reports                                                                                                                                                             | `false`  | `true`                                   |
| `--unitTestJUnitReport`          | `boolean` | Enable JUnit Pytest Reports                                                                                                                                                            | `false`  | `true`                                   |
| `--codeCoverage`                 | `boolean` | Enable Code Coverage Reports                                                                                                                                                           | `false`  | `true`                                   |
| `--codeCoverageHtmlReport`       | `boolean` | Enable Code Coverage HTML Reports                                                                                                                                                      | `false`  | `true`                                   |
| `--codeCoverageXmlReport`        | `boolean` | Enable Code Coverage XML Reports                                                                                                                                                       | `false`  | `true`                                   |
| `--codeCoverageThreshold`        | `number`  | Minimum Code Coverage Threshold                                                                                                                                                        | `false`  | N/A                                      |
| `--projectNameAndRootFormat`     | `string`  | Whether to generate the project name and root directory as provided (`as-provided`) or generate them composing their values and taking the configured layout into account (`derived`). | `false`  | `as-provided`                            |

##### rootPyprojectDependencyGroup

When the workspace is configured to use a shared virtual environment (see below), the `rootPyprojectDependencyGroup` option specifies the dependency group to be used in the root `pyproject.toml` file, by default, the main dependency group is used.

##### devDependenciesProject

This approach consists of moving all the dev dependencies from the projects to separate projects, this project is referenced in the root `pyproject.toml` and all the local projects as a dev dependency.

**Benefits**:

- Centralize the dev dependencies in a single project

##### templateDir

The `templateDir` option specifies a custom directory to be used as a template for the project, by default, the `@nxlv/python` has a built-in template folder that is used to generate the project.

However, there are some cases where the developer wants to use different files or customize the way the project is generated without the need to create a custom generator based on the `@nxlv/python` generator.

The files in the `templateDir` needs to follow the Nx generator convention by using [EJS](https://ejs.co/#docs) to customize the files based on the options provided by the `@nxlv/python`.

###### Template variables

All the options listed above are available as variables in the template files, for example, to use the `packageName` option in the template file, use `<%= packageName %>`.

Additional variables are available in the template files:

- `offsetFromRoot`: This variable contains the relative path from the project to the root directory. (e.g. for the project folder `apps/my-project` the `offsetFromRoot` value will be `../../`)
- `projectRoot`: This variable contains the relative path of the project.
- `individualPackage`: This variable is a boolean that indicates if the workspace is using a shared virtual environment or not.
- `dot`: This variable is a string that contains a dot (`.`), it is used to create files that start with a dot (e.g. `__dot__gitignore.template`).
- `template`: This variable is an empty string, this variable is usually combined with the `dot` variable, because the Nx generator file function only generates files with extensions, however, there are some cases where the file doesn't have an extension (e.g. `.gitignore`), so, the `template` variable is used to create files without an extension (e.g. `__dot__gitignore.template`).

###### Global Default Options

By default, `@nxlv/python:poetry-project` generator defines linter and unit test runner with all reports enabled by default, however, those default options can be globally changed by using the following configuration in the `nx.json` config file.

```json
{
  ...
  "generators": {
    "@nxlv/python:poetry-project": {
      "unitTestHtmlReport": false,
      "codeCoverageThreshold": 100,
      "devDependenciesProject": "shared-development"
    }
  }
  ...
}
```

> The property names are the same as the options listed in the table above.

#### Add a new dependency to a project

```shell
nx run {project}:add --name {projectName} --local
```

#### Add an external dependency to the project

To add a new dependency to the project use the `nx run {project}:add` command detailed below. This ensures that any dependent projects are updated.

```shell
nx run {project}:add --name {dependencyName}
```

### Uv

```shell
nx generate @nxlv/python:uv-project myproject
```

##### Options

| Option                           |   Type    | Description                                                                                                                                                                            | Required | Default                                  |
| -------------------------------- | :-------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| `--directory`                    | `string`  | A directory where the project is placed                                                                                                                                                | `false`  | N/A                                      |
| `--tags`                         | `string`  | Add tags to the project                                                                                                                                                                | `false`  | N/A                                      |
| `--projectType`                  | `string`  | Project type `application` or `library`                                                                                                                                                | `true`   | `application`                            |
| `--packageName`                  | `string`  | Package name                                                                                                                                                                           | `false`  | `name` property (provided in the CLI)    |
| `--moduleName`                   | `string`  | Project Source Module                                                                                                                                                                  | `false`  | `name` property using `_` instead of `-` |
| `--description`                  | `string`  | Project description                                                                                                                                                                    | `false`  | N/A                                      |
| `--pyprojectPythonDependency`    | `string`  | Python version range used in the `pyproject.toml`                                                                                                                                      | `false`  | `>=3.9,<3.11` (Poetry syntax)            |
| `--pyenvPythonVersion`           | `string`  | `.python-version` pyenv file content                                                                                                                                                   | `false`  | `3.9.5`                                  |
| `--publishable`                  | `boolean` | Specifies if the project is publishable or not                                                                                                                                         | `false`  | `true`                                   |
| `--buildLockedVersions`          | `boolean` | Use locked versions for build dependencies                                                                                                                                             | `false`  | `true`                                   |
| `--buildBundleLocalDependencies` | `boolean` | Bundle local dependencies                                                                                                                                                              | `false`  | `true`                                   |
| `--linter`                       | `string`  | Linter framework (`flake8`, `ruff` or `none`)                                                                                                                                          | `false`  | `ruff`                                   |
| `--unitTestRunner`               | `string`  | Unit Test Runner (`pytest` or `none`)                                                                                                                                                  | `false`  | `pytest`                                 |
| `--unitTestHtmlReport`           | `boolean` | Enable HTML Pytest Reports                                                                                                                                                             | `false`  | `true`                                   |
| `--unitTestJUnitReport`          | `boolean` | Enable JUnit Pytest Reports                                                                                                                                                            | `false`  | `true`                                   |
| `--codeCoverage`                 | `boolean` | Enable Code Coverage Reports                                                                                                                                                           | `false`  | `true`                                   |
| `--codeCoverageHtmlReport`       | `boolean` | Enable Code Coverage HTML Reports                                                                                                                                                      | `false`  | `true`                                   |
| `--codeCoverageXmlReport`        | `boolean` | Enable Code Coverage XML Reports                                                                                                                                                       | `false`  | `true`                                   |
| `--codeCoverageThreshold`        | `number`  | Minimum Code Coverage Threshold                                                                                                                                                        | `false`  | N/A                                      |
| `--projectNameAndRootFormat`     | `string`  | Whether to generate the project name and root directory as provided (`as-provided`) or generate them composing their values and taking the configured layout into account (`derived`). | `false`  | `as-provided`                            |

### Shared Virtual Environment

By default, the `@nxlv/python` manages the projects individually, so, all the projects have their one set of dependencies and virtual environments.

However, In some cases, we want to use a shared virtual environment for the entire workspace to save some installation time in your local environment and CI tool, we use this mode when the workspace contains many projects with the same dependencies and versions that don't conflict in the workspace level.

To migrate to this mode, run the following command:

```bash
npx nx generate @nxlv/python:migrate-to-shared-venv
```

**Options**:

| Option                  |   Type    | Description                                                                                                                                           | Required | Default  |
| ----------------------- | :-------: | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| `--moveDevDependencies` | `boolean` | Specifies if migration moves the dev dependencies from the projects to the root `pyproject.toml`                                                      | `true`   | `true`   |
| `--autoActivate`        | `boolean` | Adds the `autoActivate` config in the root `pyproject.toml`, this flag is used to auto-activate the venv when the `@nxlv/python` executors are called | `true`   | `true`   |
| `--packageManager`      | `string`  | Specifies the package manager to be used in the root `pyproject.toml` (`poetry` or `uv`)                                                              | `true`   | `poetry` |

After the migration is completed, the workspace now has a `pyproject.toml` in the root directory, and all the local projects are referencing the root `pyproject.toml` file.

> The projects still have their own `pyproject.toml` file to manage each project's dependencies, however, the package versions cannot conflict because the root `pyproject.toml` file is referencing all the dependencies.

**Benefits**:

- Save time in the local environment and CI tool
- Reduce the size of the workspace
- Reduce the number of dependencies installed in the local environment and CI tool
- Single-version policy (recommended by Nx)
- Better VSCode integration (currently, the VSCode Python extension doesn't support multiple virtual environments in the same workspace, it needs to switch between them manually)

**Cons**:

- Package versions cannot conflict at the workspace level
- Local packages with the same module name don't work properly in the VSCode, because when the VSCode Python extension is activated, it uses the root `pyproject.toml` file to resolve the packages, so, it will use the first module found in the `pyproject.toml` file.

### Executors

#### add

The `@nxlv/python:add` executor handles `add` command to provide a level of abstraction and control in the monorepo projects.

- `poetry`: `poetry add {args}`
- `uv`: `uv add {args}`

##### Features

- Add new external dependencies
- Add local dependencies

> Both features updates the local workspace dependency tree to keep the lock/venv updated.

##### Options

| Option    |   Type    | Description                                                   | Required                                             | Default |
| --------- | :-------: | ------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| `--name`  | `string`  | Dependency name (if local dependency use the Nx project name) | `true`                                               |         |
| `--args`  | `string`  | Custom args to be used in the `add` command                   | `false`                                              |         |
| `--local` | `boolean` | Specifies if the dependency is local                          | `false` (only if the `--name` is a local dependency) |         |

#### update

The `@nxlv/python:update` executor handles `update` command to provide a level of abstraction and control in the monorepo projects.

- `poetry`: `poetry update {args}`
- `uv`: Uv doesn't have a native update command, so, the executor runs the following commands:
  - `uv lock --upgrade-package {name}`
  - `uv sync`

##### Features

- Update external dependencies
- Update local dependencies

> Both features updates the local workspace dependency tree to keep the lock/venv updated.

##### Options

| Option    |   Type    | Description                                                   | Required                                             | Default |
| --------- | :-------: | ------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| `--name`  | `string`  | Dependency name (if local dependency use the Nx project name) | `false`                                              |         |
| `--args`  | `string`  | Custom args to be used in the `update` command                | `false`                                              |         |
| `--local` | `boolean` | Specifies if the dependency is local                          | `false` (only if the `--name` is a local dependency) |         |

#### remove

The `@nxlv/python:remove` executor handles `remove` command to provide a level of abstraction and control in the monorepo projects.

- `poetry`: `poetry remove {args}`
- `uv`: `uv remove {args}`

##### Features

- Remove external dependencies
- Remove local dependencies

> Both features updates the local workspace dependency tree to keep the lock/venv updated.

##### Options

| Option    |   Type    | Description                                                   | Required                                             | Default |
| --------- | :-------: | ------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| `--name`  | `string`  | Dependency name (if local dependency use the Nx project name) | `true`                                               |         |
| `--args`  | `string`  | Custom args to be used in the `remove` command                | `false`                                              |         |
| `--local` | `boolean` | Specifies if the dependency is local                          | `false` (only if the `--name` is a local dependency) |         |

#### build

The `@nxlv/python:build` command handles the `sdist` and `wheel` build generation. When the project has local dependencies the executor copies the package/dependencies recursively.

##### Options

| Option                      |   Type    | Description                                      | Required | Default                      |
| --------------------------- | :-------: | ------------------------------------------------ | -------- | ---------------------------- |
| `--silent`                  | `boolean` | Hide output text                                 | `false`  | `false`                      |
| `--outputPath`              | `string`  | Output path for the python tar/whl files         | `true`   |                              |
| `--keepBuildFolder`         | `boolean` | Keep build folder                                | `false`  | `false`                      |
| `--lockedVersions`          | `boolean` | Build with locked versions                       | `false`  | `true`                       |
| `--bundleLocalDependencies` | `boolean` | Bundle local dependencies                        | `false`  | `true`                       |
| `--ignorePaths`             |  `array`  | Ignore folder/files on build process             | `false`  | `[".venv", ".tox", "tests"]` |
| `--format`                  | `string`  | Build format (allowed values `sdist` or `wheel`) | `false`  | `wheel`                      |

##### Locked Versions Build

Using the default (`lockedVersions` and `bundleLocalDependencies`) options, the executor uses the locked versions across all the dependencies and bundles the local dependencies in the same wheel file.

###### Poetry Example

`packages/proj1/pyproject.toml`

```toml
[tool.poetry]
name = "pymonorepo-proj1"

  [[tool.poetry.packages]]
  include = "pymonorepo_proj1"

  [tool.poetry.dependencies]
  python = ">=3.8,<3.10"
  pendulum = "^2.1.2"

    [tool.poetry.dependencies.pymonorepo-lib1]
    path = "../lib1"
    develop = true
```

`packages/lib1/pyproject.toml`

```toml
[tool.poetry]
name = "pymonorepo-lib1"
version = "1.0.0"

  [[tool.poetry.packages]]
  include = "pymonorepo_lib1"

  [tool.poetry.dependencies]
  python = ">=3.8,<3.10"
  numpy = "^1.24.1"
```

When the `build` is executed in the `proj1` package, the dist tar/whl file will contain the `lib1` package and all dependencies in the `poetry.lock` file.

`packages/proj1/dist/pymonorepo-proj1-1.0.0.tar.gz/pyproject.toml`

```toml
[tool.poetry]
name = "pymonorepo-proj1"
version = "1.0.0"

  [[tool.poetry.packages]]
  include = "pymonorepo_proj1"

  [[tool.poetry.packages]]
  include = "pymonorepo_lib1"

  [tool.poetry.dependencies]
  python = ">=3.8,<3.10"

    [tool.poetry.dependencies.numpy]
    version = "1.24.1 "
    markers = 'python_version >= "3.8" and python_version < "3.10"'
    optional = false

    [tool.poetry.dependencies.pendulum]
    version = "2.1.2 "
    markers = 'python_version >= "3.8" and python_version < "3.10"'
    optional = false

    [tool.poetry.dependencies.python-dateutil]
    version = "2.8.2 "
    markers = 'python_version >= "3.8" and python_version < "3.10"'
    optional = false

    [tool.poetry.dependencies.pytzdata]
    version = "2020.1 "
    markers = 'python_version >= "3.8" and python_version < "3.10"'
    optional = false

    [tool.poetry.dependencies.six]
    version = "1.16.0 "
    markers = 'python_version >= "3.8" and python_version < "3.10"'
    optional = false
```

Note, that `python-dateutil` is a dependency of `pendulum`, and the `pymonorepo_lib1` is now part of the project instead of a dependency.

##### Non-Locked Versions Build

Using the `--lockedVersions=false` option, the executor uses the versions from the `pyproject.toml` file across all the dependencies and bundles the local dependencies in the same wheel file.

###### Poetry Example

`packages/proj1/dist/pymonorepo-proj1-1.0.0.tar.gz/pyproject.toml`

```toml
[tool.poetry]
name = "pymonorepo-proj1"
version = "1.0.0"

  [[tool.poetry.packages]]
  include = "pymonorepo_proj1"

  [[tool.poetry.packages]]
  include = "pymonorepo_lib1"

  [tool.poetry.dependencies]
  python = ">=3.8,<3.10"
  numpy = "^1.24.1"
  pendulum = "^2.1.2"
```

Note, the `pymonorepo_lib1` still bundled in the project but the dependencies are listed in the same way it is on the pyproject (using `^`).

##### Non-Bundled Local Dependencies Build

Using the `--bundleLocalDependencies=false` and `--lockedVersions=false` options, the executor checks if the local dependency is publishable and uses the version from the `pyproject.toml` file, instead of bundling the package.

`packages/proj1/dist/pymonorepo-proj1-1.0.0.tar.gz/pyproject.toml`

```toml
[tool.poetry]
name = "pymonorepo-proj1"
version = "1.0.0"

  [[tool.poetry.packages]]
  include = "pymonorepo_proj1"

  [tool.poetry.dependencies]
  python = ">=3.8,<3.10"
  pendulum = "^2.1.2"
  pymonorepo-lib1 = "1.0.0"
```

To identify if the package is publishable, the executor checks `project.json` file, property `targets.build.options.publish`.

If the `publish` option is set to `false` and the `--bundleLocalDependencies=false` option is used, the executor will bundle the package.

###### Custom source specification

In addition when adding dependencies in this way its also possible to configure a custom source for a package. This works similar to the `publish` option in that its specified on the target dependencies build options. To use this set the `customSourceName` and `customSourceUrl` to valid values for the source to retrieve the package from for each package stored on a custom Pypi.

`project.json` example:

```json
{
  ...
  "targets": {
    ...
    "build": {
      "executor": "@nxlv/python:build",
      "outputs": ["apps/myapp/dist"],
      "options": {
        "outputPath": "apps/myapp/dist",
        "publish": false,
        "customSourceName": "example",
        "customSourceUrl": "http://example.com/"
      }
    },
  }
}
```

Alternatively its also possible to configured it within the `nx.json` as `targetDefaults` across the whole repository.

#### flake8

The `@nxlv/python:flake8` handles the `flake8` linting tasks and reporting generator.

##### Options

| Option         |   Type    | Description             | Required | Default |
| -------------- | :-------: | ----------------------- | -------- | ------- |
| `--silent`     | `boolean` | Hide output text        | `false`  | `false` |
| `--outputFile` | `string`  | Output pylint file path | `true`   |         |

#### install

The `@nxlv/python:install` handles the `install` command for a project.

- `poetry`: `poetry install {args}`
- `uv`: `uv install {args}`

##### Options

| Option       |   Type    | Description                                          | Required | Default |
| ------------ | :-------: | ---------------------------------------------------- | -------- | ------- |
| `--silent`   | `boolean` | Hide output text                                     | `false`  | `false` |
| `--args`     | `string`  | Custom arguments (e.g `--group dev`)                 | `false`  |         |
| `--cacheDir` | `string`  | Custom poetry install cache directory                | `false`  |         |
| `--verbose`  | `boolean` | Use verbose mode in the install `poetry install -vv` | `false`  | `false` |
| `--debug`    | `boolean` | Use debug mode in the install `poetry install -vvv`  | `false`  | `false` |

#### sync

The `@nxlv/python:sync` executor handles sync the locked dependencies with the python virtual environment.

- `poetry`:
  - v1: `poetry install --sync`
  - v2: `poetry sync`
- `uv`: `uv sync`

##### Options

| Option       |   Type    | Description                                                 | Required | Default |
| ------------ | :-------: | ----------------------------------------------------------- | -------- | ------- |
| `--silent`   | `boolean` | Hide output text                                            | `false`  | `false` |
| `--args`     | `string`  | Custom arguments (e.g `--check dev`)                        | `false`  |         |
| `--cacheDir` | `string`  | Custom poetry install cache directory                       | `false`  |         |
| `--verbose`  | `boolean` | Use verbose mode in the install (e.g. `poetry install -vv`) | `false`  | `false` |
| `--debug`    | `boolean` | Use debug mode in the install (e.g. `poetry install -vvv`)  | `false`  | `false` |

#### lock

The `@nxlv/python:lock` executor handles the `lock` command for a project.

- `poetry`:
  - With default options:
    - v1: `poetry lock --no-update`
    - v2: `poetry lock`
  - With update option:
    - v1: `poetry lock`
    - v2: `poetry lock --regenerate`
- `uv`:
  - With default options:
    - `uv lock`
  - With update option:
    - `uv lock --upgrade`

##### Options

| Option       |   Type    | Description                                              | Required | Default |
| ------------ | :-------: | -------------------------------------------------------- | -------- | ------- |
| `--silent`   | `boolean` | Hide output text                                         | `false`  | `false` |
| `--args`     | `string`  | Custom arguments (e.g `--check dev`)                     | `false`  |         |
| `--cacheDir` | `string`  | Custom poetry install cache directory                    | `false`  |         |
| `--verbose`  | `boolean` | Use verbose mode in the install (e.g. `poetry lock -vv`) | `false`  | `false` |
| `--debug`    | `boolean` | Use debug mode in the install (e.g. `poetry lock -vvv`)  | `false`  | `false` |
| `--update`   | `boolean` | Update dependencies versions                             | `false`  | `false` |

#### publish

The `@nxlv/python:publish` executor handles the `publish` command for a project.

- `poetry`: `poetry publish {args}`
- `uv`: `uv publish {args}`

##### Options

| Option          |   Type    | Description                                                                         | Required | Default |
| --------------- | :-------: | ----------------------------------------------------------------------------------- | -------- | ------- |
| `--silent`      | `boolean` | Hide output text                                                                    | `false`  | `false` |
| `--buildTarget` | `string`  | Build Nx target (it needs to a target that uses the `@nxlv/python:build` execution) | `false`  | `build` |
| `--repository`  | `string`  | The repository to publish to (Poetry only)                                          | `false`  |         |

This executor first executes the `build` target to generate the tar/whl files and uses the `--keepBuildFolder` flag to keep the build folder after the build process.

For must scenarios, running the `poetry/uv publish` with `@nxlv/python:run-commands` executor is enough,
however, when the project has local dependencies and the `--bundleLocalDependencies=false` option is used, the default `poetry/uv publish` command doesn't work properly, because the `poetry/uv publish` command uses the current `pyproject.toml` file, which doesn't have the local dependencies resolved, the `@nxlv/python:publish` executor solves this issue by running the `poetry publish` command inside the temporary build folder generated by the `@nxlv/python:build` executor, so, the `pyproject.toml` file has all the dependencies resolved.

#### run-commands (same as `nx:run-commands`)

The `@nxlv/python:run-commands` wraps the `nx:run-commands` default Nx executor and activates the virtual environment before running the command.

> POETRY NOTE: This executor only changes the default `nx:run-commands` if the workspace is configured to use the Shared virtual environment mode and the `autoActivate` option is set to `true` in the root `pyproject.toml` file.
> POETRY NOTE: The `autoActivate` option is set to `false` by default.

**POETRY ONLY:**

root `pyproject.toml`

```toml
...
[tool.nx]
autoActivate = true

...
```

The options and behavior are the same as the `nx:run-commands` executor.

[See the Nx documentation for more information](https://nx.dev/packages/nx/executors/run-commands)

#### sls-deploy

The `@nxlv/python:sls-deploy` executor handles `npx sls deploy` command for serverless framework projects.

This executor uses the `@nxlv/python:build` artifacts to generate a `requirements.txt` and to be used with `serverless-python-requirements` plugin.

Serverless YAML example:

```yaml
service: myservice

plugins:
  - serverless-python-requirements

custom:
  pythonRequirements:
    usePoetry: false
```

The property `usePoetry` must be `false`, so, the `serverless-python-requirements` uses the `requirements.txt` file generated by this executor, this is required when the project has more than 2 levels of local dependencies.

Example:

```text
- root:
  - sls-app
   - local-lib1
    - local-lib2
```

Using the native `serverless-python-requirements` plugin with `poetry` the 2 levels of local dependencies are not supported.

`project.json` example:

```json
{
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "apps/myapp/lambda_functions",
  "targets": {
    "deploy": {
      "executor": "@nxlv/python:sls-deploy",
      "dependsOn": ["build"],
      "options": {}
    },
    "package": {
      "executor": "@nxlv/python:sls-package",
      "dependsOn": ["build"],
      "options": {}
    },
    ...
    "build": {
      "executor": "@nxlv/python:build",
      "outputs": ["apps/myapp/dist"],
      "options": {
        "outputPath": "apps/myapp/dist",
        "publish": false
      }
    },
  }
}
```

##### Options

| Option      |   Type    | Description                           | Required | Default |
| ----------- | :-------: | ------------------------------------- | -------- | ------- |
| `--stage`   | `string`  | Serverless Framework stahe name       | `true`   |         |
| `--verbose` | `boolean` | Serverless Framework CLI verbose flag | `false`  | `true`  |
| `--force`   | `boolean` | Serverless Framework CLI force flag   | `false`  | `false` |

#### Releases

This plugin supports the [Nx releases](https://nx.dev/features/manage-releases) feature.

If you are already using the `@nxlv/python` plugin and want to enable the releases feature, please run the following command:

```bash
nx generate @nxlv/python:enable-releases
```

##### Release Lock arguments

The `@nxlv/python:release-version` generator has a `lockArgs` option that allows you to pass additional arguments to the `lock` command.

To use it, you need to update the `nx.json` file to add the `lockArgs` option in the `release.version.generatorOptions` object.

Example:

```json
{
  ...
  "release": {
    ...
    "version": {
      "generatorOptions": {
        ...
        "lockArgs": "--index-strategy unsafe-best-match"
      }
    }
  }
}
```
