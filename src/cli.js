// Required imports
const ArgParse = require('argparse')

function forceInt(value, default_value) {
  value = parseInt(value, 10);
  if (isNaN(value)) {
    value = default_value
  }
  return value;
}

function parseCliArguments() {
  const default_ip_address = '127.0.0.1';
  const default_port = 9944;
  const default_timeout_ms = 5000;
  const default_period_ms = 5000;
  const default_block_delta = 10000;


  let parser = ArgParse.ArgumentParser()
  parser.addArgument(
    ['--address'],
    {
      help: 'IP address of the node for sending transactions',
      defaultValue: [default_ip_address, default_port],
      metavar: ['ip-addr', 'port-num'],
      nargs: '+',
      dest: 'address'
    }
  );
  parser.addArgument(
    ['--timeout'],
    {
      help: 'Transaction timeout in ms',
      defaultValue: default_timeout_ms,
      metavar: 'ms',
      nargs: '1',
      dest: 'timeout_ms'
    }
  );
  parser.addArgument(
    ['--period'],
    {
      help: 'Time between transactions in ms',
      defaultValue: default_period_ms,
      metavar: 'ms',
      nargs: '1',
      dest: 'period_ms'
    }
  );
  parser.addArgument(
    ['--blocks'],
    {
      help: 'The change in block height required to conclude testing.',
      defaultValue: default_block_delta,
      metavar: 'height',
      nargs: '1',
      dest: 'block_delta'
    }
  );

  let args = parser.parseArgs()
  if (args.address.length == 1) {
    args.address.push(default_port);
  }
  else if (args.address.length >= 2) {
    args.address[1] = forceInt(args.address[1], default_port);
  }

  args.timeout_ms = forceInt(args.timeout_ms, default_timeout_ms);
  args.period_ms = forceInt(args.period_ms, default_period_ms);
  args.block_delta = forceInt(args.block_delta, default_block_delta);

  let settings = {
    address: `ws://${args.address[0]}:${args.address[1]}`,
    transaction: {
      timeout_ms: args.timeout_ms,
      period_ms: args.period_ms
    },
    exit: {
      block_delta: args.block_delta
    }
  }
  return settings;
}

if (require.main === module) {
  settings = parseCliArguments()
  
  console.log(settings)
} else {
  // Export modules for testing
  module.exports = {
    parseCliArguments: parseCliArguments
  }
}

