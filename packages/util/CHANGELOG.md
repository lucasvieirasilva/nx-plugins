## 6.1.0 (2026-01-06)

### 🚀 Features

- add package project and dependencies executors ([eabc3c3](https://github.com/lucasvieirasilva/nx-plugins/commit/eabc3c3))

### 🩹 Fixes

- **nx-python:** update activate venv to make install optional (default false) ([6df63f7](https://github.com/lucasvieirasilva/nx-plugins/commit/6df63f7))
- handling of optional dependencies on poetry and uv ([#317](https://github.com/lucasvieirasilva/nx-plugins/pull/317))

### ❤️ Thank You

- Lucas Vieira @lucasvieirasilva

# [6.0.0](https://github.com/lucasvieirasilva/nx-plugins/compare/util-v5.0.0...util-v6.0.0) (2025-05-09)

### Features

- **nx-plugin:** add support for nx 21 ([#308](https://github.com/lucasvieirasilva/nx-plugins/issues/308)) ([e76fc8c](https://github.com/lucasvieirasilva/nx-plugins/commit/e76fc8c8a7671fb50567bd479a86bcce9e875bde)), closes [#304](https://github.com/lucasvieirasilva/nx-plugins/issues/304)

### BREAKING CHANGES

- **nx-plugin:** To use this version of the @nxlv/python plugin, you must migrate your nx workspace
  to 21.x

# [5.0.0](https://github.com/lucasvieirasilva/nx-plugins/compare/util-v4.0.0...util-v5.0.0) (2024-08-09)

### Features

- migrate workspace to nx 19.x ([#242](https://github.com/lucasvieirasilva/nx-plugins/issues/242)) ([8473ccd](https://github.com/lucasvieirasilva/nx-plugins/commit/8473ccdc5db39ee6ef0b9f4acdb591c6e2186778))

### BREAKING CHANGES

- migrate Nx workspace to 19.x

# [4.0.0](https://github.com/lucasvieirasilva/nx-plugins/compare/util-v3.0.0...util-v4.0.0) (2024-03-06)

### Features

- add support for nx 18.x ([#192](https://github.com/lucasvieirasilva/nx-plugins/issues/192)) ([03b9aa0](https://github.com/lucasvieirasilva/nx-plugins/commit/03b9aa066ec8b3c755de18db6d2a11c569b921c4)), closes [#191](https://github.com/lucasvieirasilva/nx-plugins/issues/191)

### BREAKING CHANGES

- To use this version the nx workspace needs to be migrated to version 18.x

# [3.0.0](https://github.com/lucasvieirasilva/nx-plugins/compare/util-v2.0.1...util-v3.0.0) (2023-12-21)

### Features

- migrate to Nx 17 ([#189](https://github.com/lucasvieirasilva/nx-plugins/issues/189)) ([d38ea54](https://github.com/lucasvieirasilva/nx-plugins/commit/d38ea544aa284df6b0978d6cc76668dee30bac38)), closes [#188](https://github.com/lucasvieirasilva/nx-plugins/issues/188)

### BREAKING CHANGES

- The entire workspace needs to be migrated to Nx 17.

## [2.0.1](https://github.com/lucasvieirasilva/nx-plugins/compare/util-v2.0.0...util-v2.0.1) (2023-11-03)

### Bug Fixes

- **util:** add tslib explicitly to package dependencies using caret ([218e5da](https://github.com/lucasvieirasilva/nx-plugins/commit/218e5daacb82e19b58dce5818f81bed7c06ae94c))

# [2.0.0](https://github.com/lucasvieirasilva/nx-plugins/compare/util-v1.1.0...util-v2.0.0) (2023-06-18)

### Features

- **workspace:** migrate to Nx 16v ([#124](https://github.com/lucasvieirasilva/nx-plugins/issues/124)) ([fa9fba9](https://github.com/lucasvieirasilva/nx-plugins/commit/fa9fba90790c274df5411d515e9c9bcf2e1d0a75)), closes [#121](https://github.com/lucasvieirasilva/nx-plugins/issues/121)

### BREAKING CHANGES

- **workspace:** Changed the Nx dependencies to 16.x, the features didn't change, however, to use
  the new version of this plugin your Nx workspace should also be in 16.x

# [1.1.0](https://github.com/lucasvieirasilva/nx-plugins/compare/util-v1.0.0...util-v1.1.0) (2023-05-29)

### Bug Fixes

- **util:** fix changelog ([5cfa899](https://github.com/lucasvieirasilva/nx-plugins/commit/5cfa8993c0133be625d02c96b661016277af6c9a))

### Features

- **data-migration:** add data migration tool ([cd3de5a](https://github.com/lucasvieirasilva/nx-plugins/commit/cd3de5a6a7f8d7f8c5fe4e31b8a7d08fdc0ff3e2))

# 1.0.0 (2023-05-26)

### Bug Fixes

- **util:** fix @nxlv/util package.json ([c568d50](https://github.com/lucasvieirasilva/nx-plugins/commit/c568d50013dbd2932a395e3a56a66af2bfdac99a))
- **util:** fix Nx project.json release config reference ([d1bc8d5](https://github.com/lucasvieirasilva/nx-plugins/commit/d1bc8d586bbac03f11d57728ba9caab2339379e4))

### Features

- **util:** add @nxlv/util package with some shared functions ([#105](https://github.com/lucasvieirasilva/nx-plugins/issues/105)) ([4f65c9c](https://github.com/lucasvieirasilva/nx-plugins/commit/4f65c9cc9319cba89f9650d5deebdacbbfbb1369))

### Reverts

- **util:** revert @nxlv/util release ([387c15a](https://github.com/lucasvieirasilva/nx-plugins/commit/387c15a3f2c0fd94eb3d73bb7e5ee730e1dafe06))
