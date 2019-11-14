/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-var-requires */
// Required imports
const { ApiPromise, WsProvider } = require('@polkadot/api');
const PlugRuntimeTypes = require('@plugnet/plug-sdk-types');

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
    api.rpc.system.version()
  ]);

  console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);
}

main().catch(console.error).finally(() => process.exit());