const log = require('console-log-level')({ level: 'info' });
const { makeTransaction } = require('../src/transaction')

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

/// Generates a number of steve keypairs
function createTheSteves(number, steve_keyring) {
  log.info(`Steve Factory Initializing - Creating [${number}] Steves.`)
  const steves = [];
  for (i=0;i<number; i++) {
    name = "Steve_0x" + (i).toString(16)
    console.log(`Steve Factory - Creating`, name);

    let steve = steve_keyring.addFromUri(name, {name: name});
    steves.push(steve);
  }
  return steves;
}

module.exports = {
    sleep,
    createTheSteves
}