/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-var-requires */
// Required imports
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { stringToU8a, u8aToHex } = require('@polkadot/util');
const PlugRuntimeTypes = require('@plugnet/plug-sdk-types');
const Keyring = require('@polkadot/keyring')
const testingPairs = require('@polkadot/keyring/testingPairs');



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

  const keyring = testingPairs.default({ type: 'sr25519'});


  // Retrieve the chain & node information information via rpc calls
  const [chain, nodeName, nodeVersion, result] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version(),
    api.consts.balances.creationFee.toNumber()
  ]);

  //console.log(api.query)

  console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);
  console.log(`Query result ${result}`);

  // The actual address that we will use
  const ADDR = '5DTestUPts3kjeXSTMyerHihn1uwMfLj8vU8sqF7qYrFabHE';

  // Retrieve the last timestamp
  const now = await api.query.timestamp.now();

  // Retrieve the account nonce via the system module
  const nonce = await api.query.system.accountNonce(ADDR);

  // Retrieve the account balance via the balances module
  const balance = await api.query.balances.freeBalance(ADDR);

  console.log(`${now}: balance of ${balance} and a nonce of ${nonce}`);

  const [lastHeader] = await Promise.all([
    api.rpc.chain.getHeader()
  ]);

  const lastHdr = await api.rpc.chain.getHeader();

  // Retrieve the balance at both the current and the parent hashes
  const [balanceNow, balancePrev] = await Promise.all([
    api.query.balances.freeBalance.at(lastHdr.hash, ADDR),
    api.query.balances.freeBalance.at(lastHdr.parentHash, ADDR)
  ]);

  // Display the difference
  console.log(`The delta was ${balanceNow.sub(balancePrev)}`);

  const alice = keyring.alice;

  const message = stringToU8a('this is our message');
  const signature = alice.sign(message);
  const isValid = alice.verify(message, signature);

  console.log(`The signature ${u8aToHex(signature)}, is ${isValid ? '' : 'in'}valid`);

  // Make a transfer from Alice to BOB, waiting for inclusion
  const unsub = await api.tx.balances
  .transfer(keyring.bob.address, 12345)
  .signAndSend(alice, (result) => {
    console.log(`Current status is ${result.status}`);

    if (result.status.isFinalized) {
      console.log(`Transaction included at blockHash ${result.status.asFinalized}`);
      unsub();
    }
  });

  const unsub2 = await api.tx.balances
  .transfer(keyring.alice.address, 12345)
  .signAndSend(keyring.bob, (result) => {
    console.log(`Current status is ${result.status}`);

    if (result.status.isFinalized) {
      console.log(`Transaction included at blockHash ${result.status.asFinalized}`);
      unsub2();
    }
  });

  setTimeout(() => console.log("Done"), 1000);

  
}

main().catch(console.error);