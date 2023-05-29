const { defineConfig } = require('../../release.base.config');

const name = 'util';
const srcRoot = `packages/${name}`;

module.exports = defineConfig(name, srcRoot);
