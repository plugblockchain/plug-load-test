/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-var-requires */
// Required imports
const { ApiPromise, WsProvider } = require('@polkadot/api');
const PlugRuntimeTypes = require('@plugnet/plug-sdk-types');
const testingPairs = require('@polkadot/keyring/testingPairs');
const cli = require('../src/cli.js');
const selector = require('../src/selector.js');
require('console-stamp')(console, '[HH:MM:ss.l]');

const APP_SUCCESS = 0;
const APP_FAIL_TRANSACTION_REJECTED = 1;
const APP_FAIL_TRANSACTION_TIMEOUT = 2;

async function main (settings) {
  const poll_period_ms = 10;
  const request_period_ms = settings.transaction.period_ms;
  const timeout_ms = settings.transaction.timeout_ms;
  const required_block_delta = settings.exit.block_delta;

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

  const start_block_number = await getFinalizedBlockNumber(api)

  const keyring = testingPairs.default({ type: 'sr25519'});
  const keypair_selector = new selector.KeypairSelector([keyring.alice, keyring.bob, keyring.charlie]);

  let pending_transaction = 0;
  let interval = setInterval(function() {
    pending_transaction++;
  }, request_period_ms);

  let app_complete = false;
  let app_error = null;



  while (true){
    if (pending_transaction > 0) {
      pending_transaction--;
      
      let thrown_error = null;

      var transaction = new Promise(async function(resolve, reject){
        const [sender, receiver] = keypair_selector.next();
        const transaction_hash = await makeTransaction(api, sender, receiver, timeout_ms)
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

async function makeTransaction(api, sender, receiver, timeout_ms)  {
  const sleep_ms = 50;
  let timed_out = false;
  let transaction_error = null;
  let hash = null;
  let nonce = await api.query.system.accountNonce(sender.address);
  console.log(sender.meta.name, "=>", receiver.meta.name,": Nonce -", nonce.words);
  
  const unsub = await api.tx.balances.transfer(receiver.address, 12345)
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (require.main === module) {
  settings = cli.parseCliArguments()
  
  main(settings)
    .then(result => process.exit(result))
    .catch(fail => { 
    console.error(`Error:`, fail);
    process.exit(fail[0]);
  });
} else {
  // Export modules for testing
  module.exports = {
  }
}



