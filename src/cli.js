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
  const default_port = '9944';
  const default_timeout_ms = 5000;
  const default_period_ms = 5000;
  const default_block_delta = 10000;
  const default_startup_delay_ms = 0;
  const default_log_level = 'info';


  let parser = ArgParse.ArgumentParser()
  parser.addArgument(
    ['--address'],
    {
      help: 'IP address of the node for sending transactions',
      defaultValue: [default_ip_address],
      metavar: ['ip-addr'],
      nargs: '+',
      dest: 'address'
    }
  );
  parser.addArgument(
    ['--timeout'],
    {
      help: 'Transaction timeout in ms, any transaction exceeding this limit fails the test.',
      defaultValue: default_timeout_ms,
      metavar: 'ms',
      nargs: '1',
      dest: 'timeout_ms'
    }
  );
  parser.addArgument(
    ['--period'],
    {
      help: 'Time between transaction calls in ms',
      defaultValue: default_period_ms,
      metavar: 'ms',
      nargs: '1',
      dest: 'period_ms'
    }
  );
  parser.addArgument(
    ['--target-block'],
    {
      help: 'The change in block height required to conclude testing.',
      defaultValue: default_block_delta,
      metavar: 'height',
      nargs: '1',
      dest: 'block_delta'
    }
  );
  parser.addArgument(
    ['--start-delay'],
    {
      help: 'Start-up delay in ms.',
      defaultValue: default_startup_delay_ms,
      metavar: 'ms',
      nargs: '1',
      dest: 'startup_delay_ms'
    }
  );
  parser.addArgument(
    ['--fund'],
    {
      help: 'Whether to fund the Steves',
      defaultValue: false,
      action: 'storeTrue',
      nargs: '0',
      dest: 'fund'
    }
  );
  parser.addArgument(
    ['--log-level'],
    {
      help: 'Set log-level',
      defaultValue: default_log_level,
      nargs: '1',
      dest: 'log_level'
    }
  );

  let args = parser.parseArgs()

  // Force all integers to be integers
  args.timeout_ms = forceInt(args.timeout_ms, default_timeout_ms);
  args.period_ms = forceInt(args.period_ms, default_period_ms);
  args.block_delta = forceInt(args.block_delta, default_block_delta);
  args.startup_delay_ms = forceInt(args.startup_delay_ms, default_startup_delay_ms);

  // Format addresses and port correctly
  let addresses = [];
  for (let i = 0; i < args.address.length; i++) {
    // Add default port if not specified
    if (args.address[i].split(':').length == 1) {
      args.address[i] = [args.address[i], default_port].join(":")
    }
    addresses.push(`ws://${args.address[i]}`);
  }

  // Return a settings object
  let settings = {
    address: addresses,
    startup_delay_ms: args.startup_delay_ms,
    transaction: {
      timeout_ms: args.timeout_ms,
      period_ms: args.period_ms
    },
    exit: {
      block_delta: args.block_delta
    },
    fund: args.fund,
    log_level: Array.isArray(args.log_level) ? args.log_level[0] : args.log_level
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
