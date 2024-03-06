#!/usr/bin/env node

const fs = require('fs');

const version = process.argv[2];
const packageJsonPath = process.argv[3];
if (!version) {
  console.error('No version provided!');
  process.exit(1);
}

if (!packageJsonPath) {
  console.error('No package.json path provided!');
  process.exit(1);
}

const packageJson = JSON.parse(
  fs.readFileSync(packageJsonPath).toString('utf-8'),
);
packageJson.version = version;

fs.writeFileSync(
  packageJsonPath,
  JSON.stringify(packageJson, null, 2) + '\n',
  'utf8',
);

console.log(`Updated version to ${version}`);
