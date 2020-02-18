const log = require('console-log-level')({ level: 'info' });
const { makeTransaction } = require('../src/transaction')

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

/// Funds an array of Steve keypairs an adequate amount from a funder keypair
/// The Steves are funded enough that they should now be registered on the chain
async function fundTheSteves(steves, api, transaction, alice_and_friends, timeout_ms) {
  console.log(`Steve Factory - Funding All Steves.`)
  let len = alice_and_friends.length
  let busy = new Array(len).fill(false)
  let index = 0
  let steve;
  let tx_count = 0
  for (steve of steves) {
    let donor_index = index
    let donor = alice_and_friends[donor_index]

    index += 1
    if (index >= len) {
      index = 0
    }

    while (busy[donor_index]) {
      await sleep(10)
    }
    busy[donor_index] = true
    new Promise(async function(resolve, reject){
      await makeTransaction(api, transaction, donor, steve, '100_000_000_000_000', timeout_ms, `funded ${tx_count}`).catch(err => reject(err));
      resolve();
    })
    .then((_) => {
      busy[donor_index] = false;
    })
    .catch((err) => {
      console.log(err)
    });

    tx_count++;
  }
}

module.exports = {
    createTheSteves,
    fundTheSteves,
}