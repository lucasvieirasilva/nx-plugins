var commandExists = require('command-exists');

// invoked without a callback, it returns a promise
commandExists('ls').then((command) => console.log(`OK: ${command}`)).catch((err) => console.error(`NOT OK: ${err}`));
