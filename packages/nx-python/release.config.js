import { defineConfig } from '../../release.base.config';

const name = 'nx-python';
const srcRoot = `packages/${name}`;

module.exports = defineConfig(name, srcRoot);
