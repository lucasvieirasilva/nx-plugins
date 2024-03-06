const { globSync } = require('glob');
const fs = require('fs');
const path = require('path');

const getLcovFiles = function (src) {
  return globSync(`${src}/**/lcov.info`);
};

(async function () {
  const files = getLcovFiles('coverage');
  const mergedReport = files.reduce(
    (mergedReport, currFile) => (mergedReport += fs.readFileSync(currFile)),
    '',
  );
  await fs.writeFile(
    path.resolve('./coverage/lcov.info'),
    mergedReport,
    (err) => {
      if (err) throw err;
      console.log('The file has been saved!');
    },
  );
})();
