/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-var-requires */
// Required imports
const { ApiPromise, WsProvider } = require('@polkadot/api');
const PlugRuntimeTypes = require('@plugnet/plug-api-types');
const { Api } = require('@cennznet/api');
const Keyring = require('@plugnet/keyring');
const testingPairs = require('@plugnet/keyring/testingPairs');
const cli = require('../src/cli.js');
const selector = require('../src/selector.js');
require('console-stamp')(console, 'HH:MM:ss.l');

const APP_SUCCESS = 0;
const APP_FAIL_TRANSACTION_REJECTED = 1;
const APP_FAIL_TRANSACTION_TIMEOUT = 2;

async function main (settings) {
  let result = APP_SUCCESS;
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

async function getCennznetApi(address) {
  // Initialise the provider to connect to the local node
  console.log(`Connecting to ${address}`);

  // Create the API and wait until ready
  const api = await Api.create({
    provider: address
  });

 // Retrieve the chain & node information information via rpc calls
 const [chain, nodeName, nodeVersion] = await Promise.all([
   api.rpc.system.chain(),
   api.rpc.system.name(),
   api.rpc.system.version(),
 ]);

 console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);

 return api;
}

async function getPlugApi(address) {
  // Initialise the provider to connect to the local node
  console.log(`Connecting to ${address}`);
  const provider = new WsProvider(address);

  // Create the API and wait until ready
  const api = await ApiPromise.create({
    provider,
    types: PlugRuntimeTypes.default
  });

  // Retrieve the chain & node information information via rpc calls
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version(),
  ]);

  console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);

  return api;
}

const cennznet_transaction = {
  transfer: (api, receiver, funds) =>
    api.tx.genericAsset.transfer(16001, receiver.address, funds),
  balance: (api, sender_address) =>
    api.query.genericAsset.freeBalance(16001, sender_address)
}

const plug_transaction = {
  transfer: (api, receiver, funds) =>
    api.tx.balances.transfer(receiver.address, funds),
  balance: (api, sender_address) =>
    api.query.balances.freeBalance(sender_address)
}

async function setup(settings) {
  // Command line delay used to wait for nodes to come up
  await sleep(settings.startup_delay_ms);

  let api;
  let transaction;

  if (settings.api ===  "plug") {
    api = await getPlugApi(settings.address);
    transaction = plug_transaction;
  }
  else {
    api = await getCennznetApi(settings.address);
    transaction = cennznet_transaction;
  }

  // The test ends when the final block number = start + delta
  const start_block_number = await getFinalizedBlockNumber(api)

  // Gather all required users
  const keyring = testingPairs.default({ type: 'sr25519'});

  const required_users = 2*settings.transaction.timeout_ms/settings.transaction.period_ms;
  const required_steves = Math.max(1, Math.floor(required_users-6));

  const steve_keyring = new Keyring.Keyring({type: 'sr25519'});
  const steves = createTheSteves(required_steves, steve_keyring);
  if (settings.fund) {
    await fundTheSteves(
      steves,
      api,
      transaction,
      [keyring.alice, keyring.bob, keyring.charlie, keyring.ferdie, keyring.dave, keyring.eve],
      settings.transaction.timeout_ms
      );
  }

  const keypair_selector = new selector.KeypairSelector(
    [
      keyring.alice, keyring.alice, keyring.alice, keyring.alice, keyring.alice, keyring.alice, keyring.alice, keyring.alice, keyring.alice, keyring.alice,
      keyring.bob
    ]
  );

  const funds = 5;

  const config = {
    api,
    funds,
    transaction,
    timeout_ms: settings.transaction.timeout_ms,
    request_period_ms: settings.transaction.period_ms,
    keypair_selector: keypair_selector,
    start_block_number: start_block_number,
    required_block_delta: settings.exit.block_delta,
  }

  return config;
}

async function run(config) {

  let tx_count = 0;

  // SetInterval is used to ensure precise transaction rates
  let pending_transaction = 0;
  let interval = setInterval(function() {
    pending_transaction++;
  }, config.request_period_ms);

  // These varaibles allow asynchronous functions to recommend script termination
  let app_complete = false;
  let app_error = null;

  const poll_period_ms = 10;

  let count = 0;

  // Loop exits once app_complete or app_error change
  while (true){
    // triggers a new transaction if needed
    if (pending_transaction > 0) {
      count++;
      pending_transaction--;

      if (count == 10000) {
        clearInterval(interval)
        interval = setInterval(function() {
          pending_transaction++;
        }, 10000);
      }

      let thrown_error = null;

      var transaction = new Promise(async function(resolve, reject){
        const [sender, receiver] = config.keypair_selector.next();
        const transaction_hash = await makeTransaction(config.api, config.transaction, sender, receiver, config.funds, config.timeout_ms, tx_count)
        .catch(err => thrown_error = err);

        if (thrown_error != null) {
          reject(thrown_error);
        } else if (transaction_hash == null) {
          reject([APP_FAIL_TRANSACTION_TIMEOUT, "Transaction Timeout"])
        } else {
          const header = await config.api.rpc.chain.getHeader(transaction_hash);
          console.log(`Transaction included on block ${header.number} with blockHash ${transaction_hash}`);
          resolve()
        }
      });

      transaction.then(
        async function() {
          // Check if we have completed the test
          const block_delta = await getFinalizedBlockNumber(config.api) - config.start_block_number;

          console.log(`At block: ${block_delta} of ${config.required_block_delta}`)

          if (block_delta >= config.required_block_delta) {
            clearInterval(interval);
            app_complete = true;
          }
        },
        (err) => app_error = err
        );

      tx_count++;

    } else if (app_complete) {
      return APP_SUCCESS;
    } else if (app_error != null) {
      console.log(app_error);
      app_error = null
      await sleep(poll_period_ms);
    } else {
      await sleep(poll_period_ms);
    }
  }
}

async function getFinalizedBlockNumber(api) {
  const hash = await api.rpc.chain.getFinalizedHead();
  const header = await api.rpc.chain.getHeader(hash);
  return header.number;
}

function id_to_string(id) {
  const zeropads = 4;
  const id_string = ("0".repeat(zeropads) + id.toString(16)).substr(-zeropads);
  return `<TX ${id_string}>     `;
}

async function makeTransaction(api, transaction, sender, receiver, funds, timeout_ms, tx_id)  {
  const sleep_ms = 50;
  const id_string = id_to_string(tx_id);
  let timed_out = false;
  let transaction_error = null;
  let hash = null;
  // Verbose transaction information -- could be removed in the future
  let nonce = await api.query.system.accountNonce(sender.address);
  let sender_balance = await transaction.balance(api, sender.address);
  let receiver_balance = await transaction.balance(api, receiver.address);
  console.log(
    id_string +
    `${sender.meta.name} [${sender_balance}] =>`,
    `${receiver.meta.name} [${receiver_balance}]`,
    `: Nonce - ${nonce.words}`
    );

  // if (chain == CHAIN_CENNZNET)

  // Sign and send a balance transfer
  const unsub = await transaction.transfer(api, receiver.address, funds)
  .signAndSend(sender, {nonce: nonce}, (result) => {
    console.log(id_string + `Current status is ${result.status}`);

    if (result.isCompleted) {
      unsub();
      if (result.isFinalized) {
        hash = result.status.asFinalized;
      }
      else { // error
        console.log(id_string + "Transaction Rejected");
        throw [APP_FAIL_TRANSACTION_REJECTED, id_string + `Transaction rejected ${result.status}`];
      }
    }
  })
  .catch(err => transaction_error = err);

  const timer = setTimeout(() => timed_out = true, timeout_ms);

  // periodically checks whether we have timed out
  // avoided sleeping here so that we can report a successful transation at the time
  // it occurs.
  while(timed_out == false) {
    if (hash != null) {
      clearTimeout(timer);
      break;
    }
    if (transaction_error != null) {
      throw [APP_FAIL_TRANSACTION_REJECTED, id_string + `Transaction rejected`];
    }
    await sleep(sleep_ms);
  }

  return hash;
}

/// Generates a number of steve keypairs
function createTheSteves(number, steve_keyring) {
  console.log(`Steve Factory Initializing - Creating [${number}] Steves.`)
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
    await sleep(100)
    busy[donor_index] = true
    let p = new Promise(async function(resolve, reject) {
      await makeTransaction(api, transaction, donor, steve, '100_000_000_000_000', timeout_ms)
      .catch( (err) => {throw err;});
      resolve(true);
    })
    p.then((_) => busy[donor_index] = false )
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


if (require.main === module) {
  settings = cli.parseCliArguments();

  main(settings)
    .then(result => process.exit(result))
    .catch(fail => {
    console.error(`Error:`, fail);
    process.exit(fail[0]);
  });
} else {
  // Export modules for testing
  module.exports = {
    createTheSteves,
  }
}





