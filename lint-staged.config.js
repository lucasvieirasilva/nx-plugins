module.exports = {
  '{packages,tools}/**/*.{ts,js,json,md,html,css,scss}': [
    'npx nx affected --target lint --uncommitted --fix true',
    'npx nx affected --target test --uncommitted',
    'npx nx format:write --uncommitted',
  ],
};
