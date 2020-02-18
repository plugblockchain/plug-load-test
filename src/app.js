/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-var-requires */
// Required imports
const { Keyring, ApiPromise, WsProvider } = require('@polkadot/api');
const PlugRuntimeTypes = require('@plugnet/plug-api-types');
const { Api } = require('@cennznet/api');
const cli = require('../src/cli.js');
const addStaking = require('../src/stakingSetup');
const selector = require('../src/selector.js');
const { runLoad } = require('../src/loadRunner')
const { sleep, getFinalizedBlockNumber } = require('../src/utils')
const { createTheSteves, fundTheSteves } = require('../src/steves')
require('console-stamp')(console, 'HH:MM:ss.l');



async function main (settings) {
  let result = -1;
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
    api.tx.genericAsset.transfer(16001, receiver, funds),
  balance: (api, sender_address) =>
    api.query.genericAsset.freeBalance(16001, sender_address)
}

const plug_transaction = {
  transfer: (api, receiver, funds) =>
    api.tx.balances.transfer(receiver, funds),
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
  const testKey = new Keyring({ type: 'sr25519'});

  const required_users = 2 * settings.transaction.timeout_ms / settings.transaction.period_ms;
  const required_steves = Math.max(1, Math.floor(required_users));

  const steve_keyring = new Keyring({type: 'sr25519'});
  const steves = createTheSteves(required_steves, steve_keyring);
  const aliceKeyring = testKey.addFromUri('//Alice', {name: 'Alice'});
  const bobKeyring = testKey.addFromUri('//Bob', {name: 'Bob'});
  const charlieKeyring = testKey.addFromUri('//Charlie', {name: 'Charlie'});
  const ferdieKeyring = testKey.addFromUri('//Ferdie', {name: 'Ferdie'});
  const daveKeyring = testKey.addFromUri('//Dave', {name: 'Dave'});
  const eveKeyring = testKey.addFromUri('//Eve', {name: 'Eve'});

  if(settings.staking_validators > 0){
    await addStaking.createStashAccounts(api, transaction);
  }

  if (settings.fund) {
    await fundTheSteves(
      steves,
      api,
      transaction,
      [aliceKeyring, bobKeyring, charlieKeyring, ferdieKeyring, daveKeyring, eveKeyring],
      settings.transaction.timeout_ms
      );
  }

  const keypair_selector = new selector.KeypairSelector(
    steves
  );

  const funds = 20000000;

  const config = {
    api,
    addresses: settings.address,
    funds,
    transaction,
    timeout_ms: settings.transaction.timeout_ms,
    request_period_ms: settings.transaction.period_ms,
    keypair_selector: keypair_selector,
    start_block_number: start_block_number,
    required_block_delta: settings.exit.block_delta,
    add_staking_validator: settings.add_staking_validators,
    mode: settings.mode
  }

  return config;
}

async function run(config) {
  console.log(`Mode: ${config.mode}`)
  if (config.mode === "load") {
    return runLoad(config);
  }
}

if (require.main === module) {
  settings = cli.parseCliArguments();

  main(settings)
    .then(result => process.exit(result))
    .catch(fail => {
    console.error(`Error:`, fail);
    process.exit(fail[0]);
  });
}