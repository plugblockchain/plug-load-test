/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-var-requires */
// Required imports
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { stringToU8a, u8aToHex } = require('@polkadot/util');
const PlugRuntimeTypes = require('@plugnet/plug-sdk-types');
const testingPairs = require('@polkadot/keyring/testingPairs');
//const ArgumentParser = require('argparse')

const APP_SUCCESS = 0;
const APP_FAIL_TRANSACTION_REJECTED = 1;
const APP_FAIL_TRANSACTION_TIMEOUT = 2;

async function main () {
  

  let addr = 'ws://127.0.0.1:9944'
  if (process.argv.length > 2) {
      addr = "ws://"+process.argv[2];
      if (process.argv.length > 3) {
          addr += ":" + process.argv[3];
      }
      else {
          addr += ":9944"
      }
  }
  console.log(`Connecting to ${addr}`);

  // Initialise the provider to connect to the local node
  const provider = new WsProvider(addr);

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

  const keyring = testingPairs.default({ type: 'sr25519'});
  const keypairs = [keyring.alice, keyring.bob, keyring.charlie];

  const request_ms = 9000;
  const timeout_ms = 5000;

  // let request_timer = setInterval(function() {

  // }, request_ms);

  const number_of_blocks = 10;

  while (true){

    const transaction_hash = await makeRandomTransaction(api, keypairs, timeout_ms);
    if (transaction_hash != null) {
      const header = await api.rpc.chain.getHeader(transaction_hash);
      console.log(`Transaction included at block ${header.number} with blockHash ${transaction_hash}`);
    } else {
      throw [APP_FAIL_TRANSACTION_TIMEOUT, "Transaction Timeout"]
    }   

    const hash = await api.rpc.chain.getFinalizedHead();
    const header = await api.rpc.chain.getHeader(hash);
    
    if (header.number >= number_of_blocks) {
      return APP_SUCCESS;
    }
  }
}

async function makeRandomTransaction(api, keypairs, timeout_ms)  {
  [sender, receiver] = selectSendReceiveKeypairs(keypairs.slice(0));

    let hash = null;

    const unsub = await api.tx.balances
    .transfer(receiver.address, 12345)
    .signAndSend(sender, (result) => {
      console.log(`Current status is ${result.status}`);

      if (result.isCompleted) {
        if (result.isFinalized) {
          hash = result.status.asFinalized;
        }
        else { // error
          throw [APP_FAIL_TRANSACTION_REJECTED, `Transaction failed ${result.status}`];
        }
        
        unsub();
      }
    });

    await sleep(timeout_ms);

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

if (require.main === module) {
  main()
    .then(result => process.exit(result))
    .catch(fail => { 
    console.error(fail);
    process.exit(fail[0]);
  });
} else {
  // Export modules for testing
  module.exports = {
    selectSendReceiveKeypairs: selectSendReceiveKeypairs
  }
}