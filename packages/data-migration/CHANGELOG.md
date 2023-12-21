# [3.0.0](https://github.com/lucasvieirasilva/nx-plugins/compare/data-migration-v2.1.0...data-migration-v3.0.0) (2023-12-21)

### Features

- migrate to Nx 17 ([#189](https://github.com/lucasvieirasilva/nx-plugins/issues/189)) ([d38ea54](https://github.com/lucasvieirasilva/nx-plugins/commit/d38ea544aa284df6b0978d6cc76668dee30bac38)), closes [#188](https://github.com/lucasvieirasilva/nx-plugins/issues/188)

### BREAKING CHANGES

- The entire workspace needs to be migrated to Nx 17.

# [2.1.0](https://github.com/lucasvieirasilva/nx-plugins/compare/data-migration-v2.0.2...data-migration-v2.1.0) (2023-11-03)

### Features

- **data-migration:** remove destination table from stream migration ([c72f945](https://github.com/lucasvieirasilva/nx-plugins/commit/c72f945298426c432ecf0ab6419df8d0f71b6b37))

## [2.0.2](https://github.com/lucasvieirasilva/nx-plugins/compare/data-migration-v2.0.1...data-migration-v2.0.2) (2023-11-03)

### Bug Fixes

- **data-migration:** remove mocks from build package and move peer dependencies to dependencies ([ac755f2](https://github.com/lucasvieirasilva/nx-plugins/commit/ac755f2f40efa7ae13551eb7ccf8b03d2842316a))

## [2.0.1](https://github.com/lucasvieirasilva/nx-plugins/compare/data-migration-v2.0.0...data-migration-v2.0.1) (2023-11-03)

### Bug Fixes

- **data-migration:** add tslib explicitly to package dependencies using caret ([f667df0](https://github.com/lucasvieirasilva/nx-plugins/commit/f667df0a4b0568b20f301e9ee48b40cda939c390))

# [2.0.0](https://github.com/lucasvieirasilva/nx-plugins/compare/data-migration-v1.0.0...data-migration-v2.0.0) (2023-06-18)

### Features

- **workspace:** migrate to Nx 16v ([#124](https://github.com/lucasvieirasilva/nx-plugins/issues/124)) ([fa9fba9](https://github.com/lucasvieirasilva/nx-plugins/commit/fa9fba90790c274df5411d515e9c9bcf2e1d0a75)), closes [#121](https://github.com/lucasvieirasilva/nx-plugins/issues/121)

### BREAKING CHANGES

- **workspace:** Changed the Nx dependencies to 16.x, the features didn't change, however, to use
  the new version of this plugin your Nx workspace should also be in 16.x

# 1.0.0 (2023-05-29)

### Features

- **data-migration:** add data migration tool ([cd3de5a](https://github.com/lucasvieirasilva/nx-plugins/commit/cd3de5a6a7f8d7f8c5fe4e31b8a7d08fdc0ff3e2))
