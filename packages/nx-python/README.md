# @nxlv/python

This library was generated with [Nx](https://nx.dev).

## What is Nx

🔎 Extensible Dev Tools for Monorepos.

## What is @nxlv/python

🔎 An Nx Custom Plugin to generate Python projects using Poetry, Tox and a custom dependency tree plugin

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
  "affected": {
    "defaultBase": "main"
  },
  "plugins": [
    "@nxlv/python"
  ],
  "cli": {
    "defaultCollection": "@nrwl/workspace"
  },
  ...
}
```

#### Add a new Python Project

```shell
nx generate @nxlv/python:project myproject
```

#### Options

| Option              |   Type    | Description                                        | Required                               | Default       |
| ------------------- | :-------: | -------------------------------------------------- | -------------------------------------- | ------------- |
| `--type`            | `string`  | Project type `application` or `library`            | `true`                                 | `application` |
| `--description`     | `string`  | Project description                                | `false`                                |               |
| `--directory`       | `string`  | A directory where the project is placed            | `false`                                |               |
| `--packageName`     | `string`  | Package name                                       | `true`                                 |               |
| `--publishable`     | `boolean` | Speficies if the project is publishable or not     | `false`                                | `true`        |
| `--customSource`    | `boolean` | Speficies if the project uses custom PyPi registry | `false`                                | `false`       |
| `--sourceName`      | `string`  | Custom PyPi registry name                          | only if the `--customSource` is `true` |               |
| `--sourceUrl`       | `string`  | Custom PyPi registry url                           | only if the `--customSource` is `true` |               |
| `--sourceSecondary` | `boolean` | Custom PyPi registry secondary flag                | only if the `--customSource` is `true` | `true`        |
| `--tags`            | `string`  | Add tags to the project                            | `false`                                |               |

#### Add a new dependency to a project

```shell
nx run {project}:add --name {projectName} --local
```

#### Add an external dependency to the project

To add a new dependency to the project use the `nx run {project}:add` command detailed below. This ensures that any dependent projects are updated.

```shell
nx run {project}:add --name {dependencyName}
```

### Executors

#### add

The `@nxlv/python:add` executor handles `poetry add` command to provide a level of abstraction and control in the monorepo projects.

##### Features

- Add new external dependencies
- Add local dependencies

> Both features updates the local workspace dependency tree to keep the lock/venv updated.

##### Options

| Option    |   Type    | Description                                                   | Required                                             | Default |
| --------- | :-------: | ------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| `--name`  | `string`  | Dependency name (if local dependency use the Nx project name) | `true`                                               |         |
| `--args`  | `string`  | Custom args to be used in the `poetry add` command            | `false`                                              |         |
| `--local` | `boolean` | Specifies if the dependency is local                          | `false` (only if the `--name` is a local dependency) |         |

#### update

The `@nxlv/python:update` executor handles `poetry update` command to provide a level of abstraction and control in the monorepo projects.

##### Features

- Update external dependencies
- Update local dependencies

> Both features updates the local workspace dependency tree to keep the lock/venv updated.

##### Options

| Option    |   Type    | Description                                                   | Required                                             | Default |
| --------- | :-------: | ------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| `--name`  | `string`  | Dependency name (if local dependency use the Nx project name) | `false`                                              |         |
| `--args`  | `string`  | Custom args to be used in the `poetry update` command         | `false`                                              |         |
| `--local` | `boolean` | Specifies if the dependency is local                          | `false` (only if the `--name` is a local dependency) |         |

#### remove

The `@nxlv/python:remove` executor handles `poetry remove` command to provide a level of abstraction and control in the monorepo projects.

##### Features

- Remove external dependencies
- Remove local dependencies

> Both features updates the local workspace dependency tree to keep the lock/venv updated.

##### Options

| Option    |   Type    | Description                                                   | Required                                             | Default |
| --------- | :-------: | ------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| `--name`  | `string`  | Dependency name (if local dependency use the Nx project name) | `true`                                               |         |
| `--args`  | `string`  | Custom args to be used in the `poetry remove` command         | `false`                                              |         |
| `--local` | `boolean` | Specifies if the dependency is local                          | `false` (only if the `--name` is a local dependency) |         |

#### build

The `@nxlv/python:build` command handles the `sdist` and `wheel` build generation. When the project has local dependencies the executor copies the package/dependencies recursively.

##### Options

| Option              |   Type    | Description                              | Required | Default                      |
| ------------------- | :-------: | ---------------------------------------- | -------- | ---------------------------- |
| `--silent`          | `boolean` | Hide output text                         | `false`  | `false`                      |
| `--outputPath`      | `string`  | Output path for the python tar/whl files | `true`   |                              |
| `--keepBuildFolder` | `boolean` | Keep build folder                        | `false`  | `false`                      |
| `--ignorePaths`     |  `array`  | Ignore folder/files on build process     | `false`  | `[".venv", ".tox", "tests"]` |

#### flake8

The `@nxlv/python:flake8` handles the `flake8` linting tasks and reporting generator.

##### Options

| Option         |   Type    | Description             | Required | Default |
| -------------- | :-------: | ----------------------- | -------- | ------- |
| `--silent`     | `boolean` | Hide output text        | `false`  | `false` |
| `--outputFile` | `string`  | Output pylint file path | `true`   |         |

#### install

The `@nxlv/python:install` handles the `poetry install` command for a project.

#### Options

| Option       |   Type    | Description                                          | Required | Default |
| ------------ | :-------: | ---------------------------------------------------- | -------- | ------- |
| `--silent`   | `boolean` | Hide output text                                     | `false`  | `false` |
| `--args`     | `string`  | Custom arguments (e.g `--group dev`)                 | `false`  |         |
| `--cacheDir` | `string`  | Custom poetry install cache directory                | `false`  |         |
| `--verbose`  | `boolean` | Use verbose mode in the install `poetry install -vv` | `false`  | `false` |
| `--debug`    | `boolean` | Use debug mode in the install `poetry install -vvv`  | `false`  | `false` |

#### tox

The `@nxlv/python:tox` handles tox executions for a project.

#### Options

| Option     |   Type    | Description                      | Required | Default |
| ---------- | :-------: | -------------------------------- | -------- | ------- |
| `--silent` | `boolean` | Hide output text                 | `false`  | `false` |
| `--args`   | `string`  | Custom arguments (e.g `-e py38`) | `false`  |         |
