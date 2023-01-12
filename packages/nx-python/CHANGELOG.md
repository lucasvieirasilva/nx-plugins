## [15.1.1](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.1.0...nx-python-v15.1.1) (2023-01-12)

### Bug Fixes

- **nx-python:** fix all poetry commands to check the exit code ([#13](https://github.com/lucasvieirasilva/nx-plugins/issues/13)) ([9e55677](https://github.com/lucasvieirasilva/nx-plugins/commit/9e55677e15a568521350cdd8dd3372529170948e))

# [15.1.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.0.2...nx-python-v15.1.0) (2023-01-11)

### Bug Fixes

- **nx-python:** fix semantic-release config format ([5061df2](https://github.com/lucasvieirasilva/nx-plugins/commit/5061df2439c9d83aa081315a0ba56a5e206cbbe0))
- **workspace:** disable body-max-lint-length and changelog ([a4106ce](https://github.com/lucasvieirasilva/nx-plugins/commit/a4106ce924e1704efb5badeb01920226c1206fac))
- **workspace:** fix lint staged and release config ([46a0343](https://github.com/lucasvieirasilva/nx-plugins/commit/46a03434ff2c286d0cd51fad4fe11c01441a4449))

### Features

- **nx-python:** added semantic-release ([cbc9d97](https://github.com/lucasvieirasilva/nx-plugins/commit/cbc9d97424266eecc66d61ecbd65427042dace35))

## [15.0.2] - 2023-01-11

### Fixed

- Fixed all executors and generators to throw an exception when the `poetry` is not installed.

## [15.0.1] - 2023-01-10

### Fixed

- Added license to `@nxlv/python` package json.

## [15.0.0] - 2023-01-09

### BREAKING CHANGES

- Update `@nxlv/python` to support `nx` version `^15.0.0`.

### Added

- Added `@nxlv/python:migrate-to-shared-venv` executor to migrate to shared venv.

## [1.10.3] - 2022-11-23

### Fixed

- Fix serverless framework executor to throw error when serverless command fails.

## [1.10.2] - 2022-09-27

### Fixed

- Fix dependency graph for Windows.

## [1.10.1] - 2022-09-09

### Fixed

- Move `file-uri-to-path` to `dependencies`.

## [1.10.0] - 2022-09-08

### Changed

- Update `poetry-core` to version `1.1.0`.

### Fixed

- Fix `build` executor when the package name is not lowercase.

## [1.9.2] - 2022-07-19

### Fixed

- Fixed update dependency tree function.

## [1.9.1] - 2022-07-19

### Fixed

- Fixed `@nxlv/python:flake8` to return error when the `pylint.txt` has more than 1 line.

## [1.9.0] - 2022-07-18

### Changed

- Modify `@nxlv/python:add` executor to add the CLI option `--extras`.

## [1.8.1] - 2022-07-15

### Fixed

- Fixed `spawnSync` for windows OS.

## [1.8.0] - 2022-07-13

### Changed

- Add Git info to `package.json`.

## [1.7.0] - 2022-07-13

### Changed

- Modify `@nxlv/python:add` executor to add the CLI option `--group`.

## [1.6.0] - 2022-07-12

### Changed

- Modify all executors to change the process directory (`cwd`) to the nx workspace directory.

## [1.5.0] - 2022-07-11

### Changed

- Modify `@nxlv/python:build` executor to pass workspace root to dependency graph functions.

## [1.4.0] - 2022-07-11

### Changed

- Modify Dependency Graph to support nx CLI execution from different directories in the workspace.

### Changed

- Modify `@nxlv/python:project` generator to add unit tests `conftest.py` file.

## [1.3.0] - 2022-07-06

### Changed

- Modify `@nxlv/python:project` generator to add unit tests `conftest.py` file.

## [1.2.0] - 2022-07-06

### Changed

- Modify `@nxlv/python:project` generator to support module name as a parameter.

## [1.1.0] - 2022-07-05

### Changed

- Modify `@nxlv/python:project` generator and all executors to support root `pyproject.toml`.

## [1.0.0] - 2022-07-05

### Added

- Added `@nxlv/python:project` project generator.
- Added `@nxlv/python:add` Poetry add wrapper executor.
- Added `@nxlv/python:build` Poetry build wrapper executor.
- Added `@nxlv/python:flake8` Flake8 wrapper executor.
- Added `@nxlv/python:install` Poetry install wrapper executor.
- Added `@nxlv/python:remove` Poetry remove wrapper executor.
- Added `@nxlv/python:sls-deploy` Serverless Framework Deploy wrapper executor.
- Added `@nxlv/python:sls-package` Serverless Framework Package wrapper executor.
- Added `@nxlv/python:tox` Tox wrapper executor.
- Added `@nxlv/python:update` Poetry update wrapper executor.
