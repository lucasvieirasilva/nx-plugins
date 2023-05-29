export const defineConfig = (name, srcRoot) => ({
  branches: ['main'],
  pkgRoot: `dist/${srcRoot}`,
  tagFormat: `${name}-v\${version}`,
  commitPaths: [srcRoot],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        changelogFile: `${srcRoot}/CHANGELOG.md`,
      },
    ],
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'npx nx format:write --uncommitted',
      },
    ],
    [
      '@semantic-release/exec',
      {
        prepareCmd: `node ./tools/scripts/update-version.js \${nextRelease.version} ./${srcRoot}/package.json`,
      },
    ],
    '@semantic-release/npm',
    [
      '@semantic-release/git',
      {
        assets: [`${srcRoot}/CHANGELOG.md`, `${srcRoot}/package.json`],
        message: `chore(${name}): release v\${nextRelease.version} [skip ci]\n\n\${nextRelease.notes}`,
      },
    ],
    [
      '@semantic-release/github',
      {
        addReleases: 'bottom',
      },
    ],
  ],
});
