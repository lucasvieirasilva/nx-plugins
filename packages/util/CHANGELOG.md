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
