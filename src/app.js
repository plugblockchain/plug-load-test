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


async function main (settings) {
  const poll_period_ms = 10;
  const request_period_ms = settings.transaction.period_ms;
  const timeout_ms = settings.transaction.timeout_ms;
  const required_block_delta = settings.exit.block_delta;

  // Command line delay used to wait for nodes to come up
  await sleep(settings.startup_delay_ms);  

  // Initialise the provider to connect to the local node
  console.log(`Connecting to ${settings.address}`);
  const provider = new WsProvider(settings.address);
  
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


  // The test ends when the final block number = start + delta
  const start_block_number = await getFinalizedBlockNumber(api)
  
  // Gather all required users
  const keyring = testingPairs.default({ type: 'sr25519'});

  const required_users = 2*timeout_ms/request_period_ms;
  const required_steves = Math.max(1, Math.floor(required_users-6))

  const steves = createTheSteves(required_steves);
  await fundTheSteves(steves, api, keyring.alice, timeout_ms);
  
  const keypair_selector = new selector.KeypairSelector(
    [keyring.alice, keyring.bob, keyring.charlie, keyring.ferdie, keyring.dave, keyring.eve]
    .concat(steves)
    );
  
  // SetInterval is used to ensure precise transaction rates
  let pending_transaction = 0;
  let interval = setInterval(function() {
    pending_transaction++;
  }, request_period_ms);
  
  // These varaibles allow asynchronous functions to recommend script termination
  let app_complete = false;
  let app_error = null;

  // How many funds to transfer in a transaction - a little bit arbitrary
  const funds = 5;
  
  // Loop exits once app_complete or app_error change
  while (true){
    // triggers a new transaction if needed
    if (pending_transaction > 0) {
      pending_transaction--;
      
      let thrown_error = null;
      
      var transaction = new Promise(async function(resolve, reject){
        const [sender, receiver] = keypair_selector.next();
        const transaction_hash = await makeTransaction(api, sender, receiver, funds, timeout_ms)
        .catch(err => thrown_error = err);
        
        if (thrown_error != null) {
          reject(thrown_error);
        } else if (transaction_hash == null) {
          reject([APP_FAIL_TRANSACTION_TIMEOUT, "Transaction Timeout"])
        } else {
          const header = await api.rpc.chain.getHeader(transaction_hash);
          console.log(`Transaction included on block ${header.number} with blockHash ${transaction_hash}`);
          resolve()
        } 
      });
      
      transaction.then(
        async function() {
          // Check if we have completed the test
          const block_delta = await getFinalizedBlockNumber(api) - start_block_number;
          
          console.log(`At block: ${block_delta} of ${required_block_delta}`)
          
          if (block_delta >= required_block_delta) {
            clearInterval(interval);
            app_complete = true;
          }    
        },
        (err) => app_error = err
        );
        
    } else if (app_complete) {
      return APP_SUCCESS;
    } else if (app_error != null) {
      throw app_error;
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
  let sender_balance = await api.query.balances.freeBalance(sender.address);
  let receiver_balance = await api.query.balances.freeBalance(receiver.address);
  console.log(
    `${sender.meta.name} [${sender_balance}] =>`, 
    `${receiver.meta.name} [${receiver_balance}]`,
    `: Nonce - ${nonce.words}`
    );

  // Sign and send a balance transfer
  const unsub = await api.tx.balances.transfer(receiver.address, funds)
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
function createTheSteves(number) {
  console.log(`Steve Factory Initializing - Creating [${number}] Steves.`)
  const steve_keyring = new Keyring.Keyring({type: 'sr25519'});
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
async function fundTheSteves(steves, api, alice, timeout_ms) {
  console.log(`Steve Factory - Funding All Steves.`)
  let steve;
  for (steve of steves) {
    await makeTransaction(api, alice, steve, '100_000_000_000_000', timeout_ms)
    .catch( (err) => {throw err;});
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



