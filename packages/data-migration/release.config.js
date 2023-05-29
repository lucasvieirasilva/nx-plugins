const { defineConfig } = require('../../release.base.config');

const name = 'data-migration';
const srcRoot = `packages/${name}`;

module.exports = defineConfig(name, srcRoot);
