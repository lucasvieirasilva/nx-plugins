## [20.7.1](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.7.0...nx-python-v20.7.1) (2025-03-13)

### Bug Fixes

- handle null values in dependency metadata retrieval ([a1df3fe](https://github.com/lucasvieirasilva/nx-plugins/commit/a1df3feed23649223b7e5e398e579c7bd7887e47))

# [20.7.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.6.2...nx-python-v20.7.0) (2025-03-04)

### Features

- **nx-python:** add sync and lock executors ([cf547ee](https://github.com/lucasvieirasilva/nx-plugins/commit/cf547ee995dad26e938d4fdd0fb55203d6e1df80))

## [20.6.2](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.6.1...nx-python-v20.6.2) (2025-02-28)

### Bug Fixes

- read uv sources from root pyproject.toml ([8718398](https://github.com/lucasvieirasilva/nx-plugins/commit/8718398de793cf7adb6fa8228c2860210c8125b5))

## [20.6.1](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.6.0...nx-python-v20.6.1) (2025-02-21)

### Bug Fixes

- **nx-python:** use option to skip lock file update during release ([6f1bcd0](https://github.com/lucasvieirasilva/nx-plugins/commit/6f1bcd073ce37e1ee5c59e0794f7a00ec6f3c4f6))

# [20.6.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.5.2...nx-python-v20.6.0) (2025-02-21)

### Features

- **nx-python:** add an optional fix option for the ruff-check executor ([2e20bfe](https://github.com/lucasvieirasilva/nx-plugins/commit/2e20bfe83530d997bf4d337e98f9de8a8e73cdcf))

## [20.5.2](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.5.1...nx-python-v20.5.2) (2025-02-17)

### Bug Fixes

- fix lock behavior during uv build ([b107d4b](https://github.com/lucasvieirasilva/nx-plugins/commit/b107d4be51f21e64bebf3b3679b916a1c9d6aaef))

## [20.5.1](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.5.0...nx-python-v20.5.1) (2025-01-30)

### Bug Fixes

- handle optional poetry dependencies and improve dependency resolution logic ([50eba58](https://github.com/lucasvieirasilva/nx-plugins/commit/50eba58e90d4829875790b9a659b97cd6637cbff))

# [20.5.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.4.0...nx-python-v20.5.0) (2025-01-29)

### Features

- add support for poetry 2.0.0 ([6743d9b](https://github.com/lucasvieirasilva/nx-plugins/commit/6743d9b788cf135ac24f3a7587c8e031bab9ac6b))

# [20.4.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.3.6...nx-python-v20.4.0) (2025-01-29)

### Features

- add ruff-format executor for formatting files ([ecdbb03](https://github.com/lucasvieirasilva/nx-plugins/commit/ecdbb03fff74ad6dc6e60e45cdd7f9aeaab27839))

## [20.3.6](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.3.5...nx-python-v20.3.6) (2025-01-22)

### Bug Fixes

- change uv provider to not use lock files on release-version generator ([cf17bda](https://github.com/lucasvieirasilva/nx-plugins/commit/cf17bda0bc9fd6c0f0800a633ce054934493dd03))

## [20.3.5](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.3.4...nx-python-v20.3.5) (2025-01-22)

### Bug Fixes

- change release-version to resolve package manager from plugin options ([ec0af4d](https://github.com/lucasvieirasilva/nx-plugins/commit/ec0af4dc847e9c45f47e775a8556f25c018ed0e7))
- update uv provider to resolve lock from project when root lock is not available ([9282ad9](https://github.com/lucasvieirasilva/nx-plugins/commit/9282ad96d545f5458996b946118052b7b7b8b8c9))

## [20.3.4](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.3.3...nx-python-v20.3.4) (2025-01-18)

### Bug Fixes

- formatting uv package manager instructions ([e94582d](https://github.com/lucasvieirasilva/nx-plugins/commit/e94582dd1a5532e8a19f1aa6e4e09488c3f48f0d))

## [20.3.3](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.3.2...nx-python-v20.3.3) (2025-01-18)

### Bug Fixes

- change dependency graph to detect non-workspace uv structure ([2a54308](https://github.com/lucasvieirasilva/nx-plugins/commit/2a5430898b9ccd3a470bcb6f62546edeeefa0c51))
- generate uv.lock file if it does not exist before export requirements txt ([7e6fb0e](https://github.com/lucasvieirasilva/nx-plugins/commit/7e6fb0efbe30a94e327718961e82715e3e5eb296))

## [20.3.2](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.3.1...nx-python-v20.3.2) (2025-01-09)

### Bug Fixes

- update getProvider calls to include context parameter in executors ([5ae2025](https://github.com/lucasvieirasilva/nx-plugins/commit/5ae202595e9e6646b21e7bfd6179b431759d6ee2))

## [20.3.1](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.3.0...nx-python-v20.3.1) (2024-12-31)

### Bug Fixes

- missing `}` bracket in chalk log ([#262](https://github.com/lucasvieirasilva/nx-plugins/issues/262)) ([b72109d](https://github.com/lucasvieirasilva/nx-plugins/commit/b72109d9dfa20c02e9f8b6b8ee846dbbfefebe72))

# [20.3.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.2.0...nx-python-v20.3.0) (2024-12-23)

### Features

- **nx-python:** enable caching in UV and Poetry project generators ([0e74e82](https://github.com/lucasvieirasilva/nx-plugins/commit/0e74e822a2836d8df84166c19bd76865db7bdc95))

# [20.2.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.1.0...nx-python-v20.2.0) (2024-12-18)

### Features

- **nx-python:** change `uv` to support non-workspace projects ([#260](https://github.com/lucasvieirasilva/nx-plugins/issues/260)) ([6e1a634](https://github.com/lucasvieirasilva/nx-plugins/commit/6e1a634b64b666d2bbe6fcfcc8dc6be876b011fb))

# [20.1.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.0.1...nx-python-v20.1.0) (2024-12-16)

### Features

- **nx-python:** add `uv` support ([#257](https://github.com/lucasvieirasilva/nx-plugins/issues/257)) ([816930e](https://github.com/lucasvieirasilva/nx-plugins/commit/816930ee823f424264a4d9037dcd8e51d36b6320))

## [20.0.1](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v20.0.0...nx-python-v20.0.1) (2024-11-25)

### Bug Fixes

- **nx-python:** remove direct dependency on nx ([#255](https://github.com/lucasvieirasilva/nx-plugins/issues/255)) ([762db7d](https://github.com/lucasvieirasilva/nx-plugins/commit/762db7dada764fe64eb329f934570e53ea9254ca))

# [20.0.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v19.2.1...nx-python-v20.0.0) (2024-11-20)

### Features

- add nx 20.x support ([#254](https://github.com/lucasvieirasilva/nx-plugins/issues/254)) ([c41b793](https://github.com/lucasvieirasilva/nx-plugins/commit/c41b79310565361975673f6d30014146026db5cd)), closes [#253](https://github.com/lucasvieirasilva/nx-plugins/issues/253)

### BREAKING CHANGES

- migrate nx workspace to 20.x

## [19.2.1](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v19.2.0...nx-python-v19.2.1) (2024-10-17)

### Bug Fixes

- capture stdout on the publish executor to check the error message ([#252](https://github.com/lucasvieirasilva/nx-plugins/issues/252)) ([083c671](https://github.com/lucasvieirasilva/nx-plugins/commit/083c671d988e2c05e4eb618aa5f580194f1fc216))

# [19.2.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v19.1.3...nx-python-v19.2.0) (2024-10-17)

### Features

- change publish executor to not fail if package version exists ([#251](https://github.com/lucasvieirasilva/nx-plugins/issues/251)) ([52da7e0](https://github.com/lucasvieirasilva/nx-plugins/commit/52da7e06aba67f2cecd474391ba2ab16c4dc9333))

## [19.1.3](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v19.1.2...nx-python-v19.1.3) (2024-10-07)

### Bug Fixes

- **nx-python:** remove deprecated property and replace with `context.projectsConfigurations` ([#249](https://github.com/lucasvieirasilva/nx-plugins/issues/249)) ([c920a62](https://github.com/lucasvieirasilva/nx-plugins/commit/c920a62d9167a1a6a083294a197871fd371a98cc))

## [19.1.2](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v19.1.1...nx-python-v19.1.2) (2024-09-18)

### Bug Fixes

- add dry-run option to publish target ([#248](https://github.com/lucasvieirasilva/nx-plugins/issues/248)) ([1756447](https://github.com/lucasvieirasilva/nx-plugins/commit/1756447f61d40197ef22f4bab136d28955fd6e7c))

## [19.1.1](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v19.1.0...nx-python-v19.1.1) (2024-09-18)

### Bug Fixes

- **nx-python:** use @nxlv/python:publish for nx-release-publish ([#247](https://github.com/lucasvieirasilva/nx-plugins/issues/247)) ([ae99905](https://github.com/lucasvieirasilva/nx-plugins/commit/ae999054980526b0579e8536249bdb7963039ecc))

# [19.1.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v19.0.2...nx-python-v19.1.0) (2024-09-18)

### Features

- **nx-python:** add support for nx releases ([#246](https://github.com/lucasvieirasilva/nx-plugins/issues/246)) ([9614843](https://github.com/lucasvieirasilva/nx-plugins/commit/96148431916ba8b99cd0deffd0ffcf6b7d44a193))

## [19.0.2](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v19.0.1...nx-python-v19.0.2) (2024-08-12)

### Bug Fixes

- **nx-python:** resolve poetry export local path for windows ([#244](https://github.com/lucasvieirasilva/nx-plugins/issues/244)) ([6b65b68](https://github.com/lucasvieirasilva/nx-plugins/commit/6b65b6892c37763dd11dc11471d6c816bc865044))

## [19.0.1](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v19.0.0...nx-python-v19.0.1) (2024-08-09)

### Bug Fixes

- **nx-python:** replace poetry update with poetry lock and poetry install when adding a new package ([#243](https://github.com/lucasvieirasilva/nx-plugins/issues/243)) ([b311fcb](https://github.com/lucasvieirasilva/nx-plugins/commit/b311fcbe4c4edae80a5ef4c6f6e16db241d5089f))

# [19.0.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v18.2.0...nx-python-v19.0.0) (2024-08-09)

### Features

- migrate workspace to nx 19.x ([#242](https://github.com/lucasvieirasilva/nx-plugins/issues/242)) ([8473ccd](https://github.com/lucasvieirasilva/nx-plugins/commit/8473ccdc5db39ee6ef0b9f4acdb591c6e2186778))

### BREAKING CHANGES

- migrate Nx workspace to 19.x

# [18.2.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v18.1.0...nx-python-v18.2.0) (2024-08-08)

### Features

- **nx-python:** add poetry publish executor ([#241](https://github.com/lucasvieirasilva/nx-plugins/issues/241)) ([f34b797](https://github.com/lucasvieirasilva/nx-plugins/commit/f34b797327bc2fe437936436f15b488089c270b4))

# [18.1.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v18.0.1...nx-python-v18.1.0) (2024-05-14)

### Features

- **nx-python:** add support for poetry-plugin-export@1.8.0 ([#207](https://github.com/lucasvieirasilva/nx-plugins/issues/207)) ([28d4ae3](https://github.com/lucasvieirasilva/nx-plugins/commit/28d4ae3c456f75d95d1684aa3dee505b482a7f04)), closes [#206](https://github.com/lucasvieirasilva/nx-plugins/issues/206)

## [18.0.1](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v18.0.0...nx-python-v18.0.1) (2024-03-27)

### Bug Fixes

- **nx-python:** relock root when changing deps on grouped projects ([#195](https://github.com/lucasvieirasilva/nx-plugins/issues/195)) ([3fdd0cb](https://github.com/lucasvieirasilva/nx-plugins/commit/3fdd0cbf3082ea3c86718f51bea2b06a0ec425f2))

# [18.0.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v17.0.0...nx-python-v18.0.0) (2024-03-06)

### Features

- add support for nx 18.x ([#192](https://github.com/lucasvieirasilva/nx-plugins/issues/192)) ([03b9aa0](https://github.com/lucasvieirasilva/nx-plugins/commit/03b9aa066ec8b3c755de18db6d2a11c569b921c4)), closes [#191](https://github.com/lucasvieirasilva/nx-plugins/issues/191)

### BREAKING CHANGES

- To use this version the nx workspace needs to be migrated to version 18.x

# [17.0.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v16.3.1...nx-python-v17.0.0) (2023-12-21)

### Features

- migrate to Nx 17 ([#189](https://github.com/lucasvieirasilva/nx-plugins/issues/189)) ([d38ea54](https://github.com/lucasvieirasilva/nx-plugins/commit/d38ea544aa284df6b0978d6cc76668dee30bac38)), closes [#188](https://github.com/lucasvieirasilva/nx-plugins/issues/188)

### BREAKING CHANGES

- The entire workspace needs to be migrated to Nx 17.

## [16.3.1](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v16.3.0...nx-python-v16.3.1) (2023-11-10)

### Bug Fixes

- **nx-python:** handle "from" for packages in pyproject.toml during the build process ([#184](https://github.com/lucasvieirasilva/nx-plugins/issues/184)) ([5d9a99f](https://github.com/lucasvieirasilva/nx-plugins/commit/5d9a99f5963e328038158edb299d1f0d2716f07c))

# [16.3.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v16.2.0...nx-python-v16.3.0) (2023-11-10)

### Features

- **nx-python:** add `projectNameAndRootFormat` parameter to poetry project generator ([#186](https://github.com/lucasvieirasilva/nx-plugins/issues/186)) ([e0dffbe](https://github.com/lucasvieirasilva/nx-plugins/commit/e0dffbefb98374a99da4fded9a5d1c6c6c53edc4)), closes [#182](https://github.com/lucasvieirasilva/nx-plugins/issues/182)

# [16.2.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v16.1.4...nx-python-v16.2.0) (2023-11-10)

### Features

- **nx-python:** add ruff check executor and project generator ([#185](https://github.com/lucasvieirasilva/nx-plugins/issues/185)) ([9e631a2](https://github.com/lucasvieirasilva/nx-plugins/commit/9e631a2df0525b9808bb31bf7af8b7ec73346c6e)), closes [#170](https://github.com/lucasvieirasilva/nx-plugins/issues/170)

## [16.1.4](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v16.1.3...nx-python-v16.1.4) (2023-10-19)

### Bug Fixes

- **nx-python:** fix shared virtual environment documentation ([#176](https://github.com/lucasvieirasilva/nx-plugins/issues/176)) ([8ea6a81](https://github.com/lucasvieirasilva/nx-plugins/commit/8ea6a81828a0d222db3d1d2d98ad6bb15d3ebcc9)), closes [#174](https://github.com/lucasvieirasilva/nx-plugins/issues/174)

## [16.1.3](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v16.1.2...nx-python-v16.1.3) (2023-10-19)

### Bug Fixes

- **nx-python:** add tslib explicitly to the package.json using caret ([#175](https://github.com/lucasvieirasilva/nx-plugins/issues/175)) ([90339b2](https://github.com/lucasvieirasilva/nx-plugins/commit/90339b2a40fb52e10947cb494127cbfed395da5e)), closes [#173](https://github.com/lucasvieirasilva/nx-plugins/issues/173)

## [16.1.2](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v16.1.1...nx-python-v16.1.2) (2023-07-06)

### Bug Fixes

- **nx-python:** use poetry lock and poetry install when add/update/remove a package ([#141](https://github.com/lucasvieirasilva/nx-plugins/issues/141)) ([e90a857](https://github.com/lucasvieirasilva/nx-plugins/commit/e90a857bebcea353f65cda612c07628c3528acb1))

## [16.1.1](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v16.1.0...nx-python-v16.1.1) (2023-07-05)

### Bug Fixes

- **nx-python:** `poetry-project` resolve the dev package name when `devDependenciesProject` is provided ([#140](https://github.com/lucasvieirasilva/nx-plugins/issues/140)) ([bca618d](https://github.com/lucasvieirasilva/nx-plugins/commit/bca618dfad60d11a3ccf7037d0a1bb858d973587))

# [16.1.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v16.0.0...nx-python-v16.1.0) (2023-07-03)

### Features

- **nx-python:** automatically activate shared virtual environment ([#138](https://github.com/lucasvieirasilva/nx-plugins/issues/138)) ([e275534](https://github.com/lucasvieirasilva/nx-plugins/commit/e275534a84ec14652b47ca8942a5cec55248282a)), closes [#132](https://github.com/lucasvieirasilva/nx-plugins/issues/132)

# [16.0.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.11.0...nx-python-v16.0.0) (2023-06-18)

### Features

- **workspace:** migrate to Nx 16v ([#124](https://github.com/lucasvieirasilva/nx-plugins/issues/124)) ([fa9fba9](https://github.com/lucasvieirasilva/nx-plugins/commit/fa9fba90790c274df5411d515e9c9bcf2e1d0a75)), closes [#121](https://github.com/lucasvieirasilva/nx-plugins/issues/121)

### BREAKING CHANGES

- **workspace:** Changed the Nx dependencies to 16.x, the features didn't change, however, to use
  the new version of this plugin your Nx workspace should also be in 16.x

# [15.11.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.10.0...nx-python-v15.11.0) (2023-06-18)

### Features

- **nx-python:** add a new version of the poetry project generator ([#123](https://github.com/lucasvieirasilva/nx-plugins/issues/123)) ([c793b0d](https://github.com/lucasvieirasilva/nx-plugins/commit/c793b0d058e5c05f16c7ea74776530113d88be1a)), closes [#111](https://github.com/lucasvieirasilva/nx-plugins/issues/111) [#117](https://github.com/lucasvieirasilva/nx-plugins/issues/117)

# [15.10.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.9.1...nx-python-v15.10.0) (2023-06-07)

### Features

- **nx-python:** add support for poetry remove --lock for poetry version >= 1.5.0 ([#118](https://github.com/lucasvieirasilva/nx-plugins/issues/118)) ([6d89f15](https://github.com/lucasvieirasilva/nx-plugins/commit/6d89f15394dfdff3a82e7234571faa15293c4d2d)), closes [#116](https://github.com/lucasvieirasilva/nx-plugins/issues/116)

## [15.9.1](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.9.0...nx-python-v15.9.1) (2023-05-29)

### Bug Fixes

- **nx-python:** fix the dependency graph when there are Python projects not managed by the `@nxlv/python` ([#109](https://github.com/lucasvieirasilva/nx-plugins/issues/109)) ([2249a6c](https://github.com/lucasvieirasilva/nx-plugins/commit/2249a6cc6ba2025d8cc292657b24505064c8d3e4)), closes [#101](https://github.com/lucasvieirasilva/nx-plugins/issues/101)

# [15.9.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.8.0...nx-python-v15.9.0) (2023-05-29)

### Features

- **data-migration:** add data migration tool ([cd3de5a](https://github.com/lucasvieirasilva/nx-plugins/commit/cd3de5a6a7f8d7f8c5fe4e31b8a7d08fdc0ff3e2))

# [15.8.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.7.0...nx-python-v15.8.0) (2023-05-26)

### Features

- **util:** add @nxlv/util package with some shared functions ([#105](https://github.com/lucasvieirasilva/nx-plugins/issues/105)) ([4f65c9c](https://github.com/lucasvieirasilva/nx-plugins/commit/4f65c9cc9319cba89f9650d5deebdacbbfbb1369))

# [15.8.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.7.0...nx-python-v15.8.0) (2023-05-26)

### Features

- **util:** add @nxlv/util package with some shared functions ([#105](https://github.com/lucasvieirasilva/nx-plugins/issues/105)) ([4f65c9c](https://github.com/lucasvieirasilva/nx-plugins/commit/4f65c9cc9319cba89f9650d5deebdacbbfbb1369))

# [15.7.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.6.0...nx-python-v15.7.0) (2023-03-22)

### Features

- **nx-python:** parameterize python version range, tox envlist and add .python-version file ([#74](https://github.com/lucasvieirasilva/nx-plugins/issues/74)) ([70d8a3b](https://github.com/lucasvieirasilva/nx-plugins/commit/70d8a3b56c270c65174b7916d7ea5d27f47f1700)), closes [#67](https://github.com/lucasvieirasilva/nx-plugins/issues/67)

# [15.6.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.5.1...nx-python-v15.6.0) (2023-03-15)

### Features

- **nx-python:** added nx placeholders for nx-python generator project ([#68](https://github.com/lucasvieirasilva/nx-plugins/issues/68)) ([34e0fc7](https://github.com/lucasvieirasilva/nx-plugins/commit/34e0fc7f1bbe102077c30d6f4d439602b287ec7f))

## [15.5.1](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.5.0...nx-python-v15.5.1) (2023-02-26)

### Bug Fixes

- **nx-python:** replace rmSync to fs-extra removeSync and add fs-extra as a dependency ([#54](https://github.com/lucasvieirasilva/nx-plugins/issues/54)) ([b6acba2](https://github.com/lucasvieirasilva/nx-plugins/commit/b6acba2ea1b78e90cf8fd4c3b24bdfe999c6106a))

# [15.5.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.4.0...nx-python-v15.5.0) (2023-02-09)

### Features

- **nx-python:** adds support for custom dependency sources ([#41](https://github.com/lucasvieirasilva/nx-plugins/issues/41)) ([b0e4ffa](https://github.com/lucasvieirasilva/nx-plugins/commit/b0e4ffa417795bffe5f1d40e00905f908172550d))

# [15.4.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.3.0...nx-python-v15.4.0) (2023-02-07)

### Features

- **nx-python:** added support for build with non-locked versions and non-bundle local dependencies ([#24](https://github.com/lucasvieirasilva/nx-plugins/issues/24)) ([0ff434b](https://github.com/lucasvieirasilva/nx-plugins/commit/0ff434b3cabe277de74e39879469aef2a67a37a5))

# [15.3.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.2.0...nx-python-v15.3.0) (2023-01-25)

### Features

- **nx-python:** follow all groups with dep graph ([#22](https://github.com/lucasvieirasilva/nx-plugins/issues/22)) ([f962fac](https://github.com/lucasvieirasilva/nx-plugins/commit/f962fac0da8736abd1c425ca431c3b26f1db065d))

# [15.2.0](https://github.com/lucasvieirasilva/nx-plugins/compare/nx-python-v15.1.1...nx-python-v15.2.0) (2023-01-18)

### Features

- **nx-python:** added support for git dependencies ([#21](https://github.com/lucasvieirasilva/nx-plugins/issues/21)) ([76db36a](https://github.com/lucasvieirasilva/nx-plugins/commit/76db36a6cd180d69aaf0068ab9a2905aa3299830))

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
