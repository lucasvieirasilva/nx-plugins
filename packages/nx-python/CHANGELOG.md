# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## [15.1.0] - 2023-01-11

### Changed

- Update readme docs to include unit test code coverage badge.

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
