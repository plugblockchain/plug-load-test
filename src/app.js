/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-var-requires */
// Required imports
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
  const config = await setup(settings);
  const result = await run(config);
  return result; 
}

async function setup(settings) {
  // Command line delay used to wait for nodes to come up
  await sleep(settings.startup_delay_ms);  

  // Initialise the provider to connect to the local node
  console.log(`Connecting to ${settings.address}`);
  
  // Create the API and wait until ready
  const api = await Api.create({ 
    provider: settings.address
  });
  
  // Retrieve the chain & node information information via rpc calls
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version(),
  ]);
  
  console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);

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
      [keyring.alice, keyring.bob, keyring.charlie, keyring.ferdie, keyring.dave, keyring.eve], 
      settings.transaction.timeout_ms
      );
  }
      
      const keypair_selector = new selector.KeypairSelector(
        [keyring.alice, keyring.bob, keyring.charlie, keyring.ferdie, keyring.dave, keyring.eve]
        .concat(steves)
        );
        
  const funds = 5;

  const config = {
    api: api,
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

  const poll_period_ms = 10;

  // Loop exits once app_complete or app_error change
  while (true){
    // triggers a new transaction if needed
    if (pending_transaction > 0) {
      pending_transaction--;
      
      let thrown_error = null;
      
      var transaction = new Promise(async function(resolve, reject){
        const [sender, receiver] = config.keypair_selector.next();
        const transaction_hash = await makeTransaction(config.api, sender, receiver, config.funds, config.timeout_ms)
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
  
async function makeTransaction(api, sender, receiver, funds, timeout_ms)  {
  const sleep_ms = 50;
  let timed_out = false;
  let transaction_error = null;
  let hash = null;
  // Verbose transaction information -- could be removed in the future
  let nonce = await api.query.system.accountNonce(sender.address);
  let sender_balance = await api.query.genericAsset.freeBalance(16001, sender.address);
  let receiver_balance = await api.query.genericAsset.freeBalance(16001, receiver.address);
  console.log(
    `${sender.meta.name} [${sender_balance}] =>`, 
    `${receiver.meta.name} [${receiver_balance}]`,
    `: Nonce - ${nonce.words}`
    );

  // Sign and send a balance transfer
  const unsub = await api.tx.genericAsset.transfer(16001, receiver.address, funds)
  .signAndSend(sender, {nonce: nonce}, (result) => {
    console.log(`Current status is ${result.status}`);
    
    if (result.isCompleted) {
      if (result.isFinalized) {
        hash = result.status.asFinalized;
      }
      else { // error
        console.log("Transaction Rejected");
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
async function fundTheSteves(steves, api, alice_and_friends, timeout_ms) {
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





