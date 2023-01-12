module.exports = {
  '{packages,tools}/**/*.{ts,js,json,md,html,css,scss}': [
    'npx nx affected --target lint --uncommitted --fix true',
    'npx nx format:write --uncommitted',
  ],
  '*.{js,md,json}': ['npx nx format:write --uncommitted', 'git add'],
};
