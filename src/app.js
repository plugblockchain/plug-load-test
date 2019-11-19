/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-var-requires */
// Required imports
const { ApiPromise, WsProvider } = require('@polkadot/api');
const PlugRuntimeTypes = require('@plugnet/plug-sdk-types');
const testingPairs = require('@polkadot/keyring/testingPairs');
const ArgParse = require('argparse')

const APP_SUCCESS = 0;
const APP_FAIL_TRANSACTION_REJECTED = 1;
const APP_FAIL_TRANSACTION_TIMEOUT = 2;

async function main (settings) {
  console.log(`Connecting to ${settings.address}`);

  // Initialise the provider to connect to the local node
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
  const keypairs = [keyring.alice, keyring.bob, keyring.charlie];

  const poll_period_ms = 10;
  const request_period_ms = 4000;
  const timeout_ms = 5000;

  const number_of_blocks = 10;

  let start_transaction = false;
  let interval = setInterval(function() {
    start_transaction = true;
  }, request_period_ms);

  let app_complete = false;
  let app_error = null;

  while (true){
    if (start_transaction) {
      start_transaction = false;
      
      let thrown_error = null;
      var transaction = new Promise(async function(resolve, reject){
        const transaction_hash = await makeRandomTransaction(api, keypairs, timeout_ms)
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
      
          console.log(`At block: ${block_delta} of ${number_of_blocks}`)
          
          if (block_delta >= number_of_blocks) {
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

async function makeRandomTransaction(api, keypairs, timeout_ms)  {
  [sender, receiver] = selectSendReceiveKeypairs(keypairs.slice(0));
  const sleep_ms = 50;
  let timed_out = false;
  let transaction_error = null;
  let hash = null;
  
  const unsub = await api.tx.balances.transfer(receiver.address, 12345)
    .signAndSend(sender, (result) => {
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

function selectSendReceiveKeypairs(keypairs){
  if (keypairs.length <= 1) {
    return [null, null];
  }

  const sender_index = Math.floor(Math.random() * keypairs.length);
  sender = keypairs.splice(sender_index,1)[0];
  
  receiver = keypairs[Math.floor(Math.random() * keypairs.length)];
  
  return [sender, receiver];
}

function parseCliArguments() {
  let parser = ArgParse.ArgumentParser()
  parser.addArgument(
    ['-a'],
    {
      help: 'IP address of the node for sending transactions',
      defaultValue: ['127.0.0.1', 9944],
      metavar: ['ip-addr', 'port-num'],
      nargs: '+',
      dest: 'address'
    }
  );


  let args = parser.parseArgs()
  if (args.address.length == 1) {
    args.address.push(9944);
  }
  else if (args.address.length >= 2) {
    args.address[1] = parseInt(args.address[1], 10);
    if (isNaN(args.address[1])) {
      args.address[1] = 9944;
    }
  }

  let settings = {
    address: `ws://${args.address[0]}:${args.address[1]}`
  }
  return settings;
}

if (require.main === module) {
  settings = parseCliArguments()
  
  main(settings)
    .then(result => process.exit(result))
    .catch(fail => { 
    console.error(`Error:`, fail);
    process.exit(fail[0]);
  });
} else {
  // Export modules for testing
  module.exports = {
    selectSendReceiveKeypairs: selectSendReceiveKeypairs,
    parseCliArguments: parseCliArguments
  }
}

