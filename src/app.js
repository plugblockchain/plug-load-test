/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-var-requires */
// Required imports
const cli = require('../src/cli.js');
const { makeTransaction } = require('../src/transaction')
const selector = require('../src/selector.js');
const { runLoad } = require('../src/loadRunner')
const { setup } = require('./setup');
require('console-stamp')(console, 'HH:MM:ss.l');


async function main (settings) {
  let result = -1;
  const config = await setup(settings);
  while(true) {
    try {
      result = await run(config);
      break;
    }
    catch(err) {
      console.log(err)
    }
  }
  return result;
}

async function run(config) {
  console.log(`Mode: ${config.mode}`)
  if (config.mode === "load") {
    return runLoad(config);
  }
}

if (require.main === module) {
  settings = cli.parseCliArguments();

  main(settings)
    .then(result => process.exit(result))
    .catch(fail => {
    console.error(`Error:`, fail);
    process.exit(fail[0]);
  });
}