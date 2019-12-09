/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-var-requires */
// Required imports
const { ApiPromise, WsProvider } = require('@polkadot/api');
const PlugRuntimeTypes = require('@plugnet/plug-api-types');
const Keyring = require('@polkadot/keyring');
const testingPairs = require('@polkadot/keyring/testingPairs');
const cli = require('../src/cli.js');
const selector = require('../src/selector.js');
require('console-stamp')(console, 'HH:MM:ss.l');

const APP_SUCCESS = 0;
const APP_FAIL_TRANSACTION_REJECTED = 1;
const APP_FAIL_TRANSACTION_TIMEOUT = 2;

let log = require('console-log-level')({ level: 'info' });

async function main (settings) {
  const config = await setup(settings);
  const result = await run(config);
  return result;
}

async function setup(settings) {
  // Command line delay used to wait for nodes to come up
  await sleep(settings.startup_delay_ms);

  // Initialise the provider to connect to the local node
  const apis = [];
  for (let i = 0; i < settings.address.length; i++) {
    console.info(`Connecting to ${settings.address[i]}`);
    const provider = new WsProvider(settings.address[i]);

    // Create the API and wait until ready
    const api = await ApiPromise.create({
      provider,
      types: PlugRuntimeTypes.default
    });
    apis.push(api);

    // Retrieve the chain & node information information via rpc calls
    const [chain, nodeName, nodeVersion] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.name(),
      api.rpc.system.version(),
    ]);
    log.info(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);
  }

  // The test ends when the final block number = start + delta
  const start_block_number = await getFinalizedBlockNumber(apis[0])

  // Gather all required users
  const keyring = testingPairs.default({ type: 'sr25519'});

  const required_users = 2 * settings.transaction.timeout_ms / settings.transaction.period_ms;
  const required_steves = Math.max(1, Math.floor(required_users - 6));

  const steve_keyring = new Keyring.Keyring({type: 'sr25519'});
  const steves = createTheSteves(required_steves, steve_keyring);

  if (settings.fund) {
    await fundTheSteves(
      steves,
      apis[0],
      [keyring.alice, keyring.bob, keyring.charlie, keyring.ferdie, keyring.dave, keyring.eve],
      settings.transaction.timeout_ms
    );
  }

  const keypair_selector = new selector.KeypairSelector(
    [keyring.ferdie].concat(steves)
  );

  const funds = 5;

  const config = {
    apis: apis,
    addresses: settings.address,
    funds: funds,
    timeout_ms: settings.transaction.timeout_ms,
    request_period_ms: settings.transaction.period_ms,
    keypair_selector: keypair_selector,
    start_block_number: start_block_number,
    required_block_delta: settings.exit.block_delta,
  }

  return config;
}

async function run(config) {

  // SetInterval is used to ensure precise transaction rates
  let pending_transaction = 0;
  let interval = setInterval(function() {
    pending_transaction++;
  }, config.request_period_ms);

  // These varaibles allow asynchronous functions to recommend script termination
  let app_complete = false;
  let app_error = null;
  let api_idx = 0;

  const poll_period_ms = 10;

  // Loop exits once app_complete or app_error change
  while (true){
    // triggers a new transaction if needed
    if (pending_transaction > 0) {
      pending_transaction--;

      let thrown_error = null;
      const api = config.apis[api_idx];

      var transaction = new Promise(async function(resolve, reject){
        const addr = config.addresses[api_idx];
        const [sender, receiver] = config.keypair_selector.next();
        const transaction_hash = await makeTransaction(api, sender, receiver, config.funds, config.timeout_ms)
          .catch(err => thrown_error = err);

        if (thrown_error != null) {
          reject(thrown_error, addr);
        } else if (transaction_hash == null) {
          reject([APP_FAIL_TRANSACTION_TIMEOUT, "Transaction Timeout"], addr);
        } else {
          const header = await api.rpc.chain.getHeader(transaction_hash);
          log.info(`[${addr}] Transaction included on block ${header.number} with blockHash ${transaction_hash}`);
          resolve(addr);
        }
      });

      transaction.then(
        async function(addr) {
          // Check if we have completed the test
          const block_delta = await getFinalizedBlockNumber(api) - config.start_block_number;

          log.info(`[${addr}] At block: ${block_delta} of ${config.required_block_delta}`);

          if (block_delta >= config.required_block_delta) {
            clearInterval(interval);
            app_complete = true;
          }
        },
        (err, addr) => {
          app_error = err;
          log.error(`[${addr}] ${app_error}`);
        }
      );

      api_idx++;
      if (api_idx == config.apis.length) {
        api_idx = 0;
      }

    } else if (app_complete) {
      return APP_SUCCESS;
    } else if (app_error != null) {
      app_error = null
      await sleep(poll_period_ms);
    }  else {
      await sleep(poll_period_ms);
    }
  }
}

async function getFinalizedBlockNumber(api) {
  const hash = await api.rpc.chain.getFinalizedHead();
  const header = await api.rpc.chain.getHeader(hash);
  return header.number;
}

async function makeTransaction(api, sender, receiver, funds, timeout_ms)  {
  const sleep_ms = 50;
  let timed_out = false;
  let transaction_error = null;
  let hash = null;
  let nonce = await api.query.system.accountNonce(sender.address);

  // Verbose transaction information -- could be removed in the future
  let sender_balance = await api.query.balances.freeBalance(sender.address);
  let receiver_balance = await api.query.balances.freeBalance(receiver.address);
  log.info(
    `${sender.meta.name} [${sender_balance}] =>`,
    `${receiver.meta.name} [${receiver_balance}]`,
    `: Nonce - ${nonce.words}`
  );

  // Sign and send a balance transfer
  const unsub = await api.tx.balances
    .transfer(receiver.address, funds)
    .signAndSend(sender, {nonce: nonce}, (result) => {
      log.info(`Current status is ${result.status}`);

      if (result.isCompleted) {
        if (result.isFinalized) {
          hash = result.status.asFinalized;
        }
        else { // error
          log.error("Transaction Rejected");
          throw [APP_FAIL_TRANSACTION_REJECTED, `Transaction rejected ${result.status}`];
        }
        unsub();
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
      throw [APP_FAIL_TRANSACTION_REJECTED, `Transaction rejected`];
    }
    await sleep(sleep_ms);
  }

  return hash;
}

/// Generates a number of steve keypairs
function createTheSteves(number, steve_keyring) {
  log.info(`Steve Factory Initializing - Creating [${number}] Steves.`)
  const steves = [];
  for (i=0;i<number; i++) {
    name = "Steve_0x" + (i).toString(16)
    log.debug(`Steve Factory - Creating`, name);
    let steve = steve_keyring.addFromUri(name, {name: name});
    steves.push(steve);
  }
  log.info(`Steve Factory - Created [${steves.length}] Steves.`)
  return steves;
}

/// Funds an array of Steve keypairs an adequate amount from a funder keypair
/// The Steves are funded enough that they should now be registered on the chain
async function fundTheSteves(steves, api, alice_and_friends, timeout_ms) {
  log.info(`Steve Factory - Funding All Steves.`)
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
      await makeTransaction(api, donor, steve, '100_000_000_000_000', timeout_ms)
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
  log = require('console-log-level')({ level: settings.log_level });

  main(settings)
    .then(result => process.exit(result))
    .catch(fail => {
    log.error(`Error:`, fail);
    process.exit(fail[0]);
  });
} else {
  // Export modules for testing
  module.exports = {
    createTheSteves,
  }
}



