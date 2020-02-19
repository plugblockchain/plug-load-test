const assert = require('assert');
const cli = require('../src/cli.js');

describe('Command Line Interface - IP Address', function() {
  it('Default Address', function() {
    process.argv = 'node cli.test.js'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.address, "ws://127.0.0.1:9944");
  });

  it('New Address', function() {
    process.argv = 'node cli.test.js --address 0.0.0.0 1234'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.address, "ws://0.0.0.0:1234");
  });

  it('Change ip address only', function() {
    process.argv = 'node cli.test.js --address 0.0.0.0'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.address, "ws://0.0.0.0:9944");
  });

  it('IP address can be a string', function() {
    process.argv = 'node cli.test.js --address node 1234'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.address, "ws://node:1234");
  });

  it('Secure Websocket flag', function() {
    process.argv = 'node cli.test.js --address node 1234 --wss'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.address, "wss://node:1234");
  });
});

describe('Command Line Interface - Transaction Params', function() {
  it('Default Timing', function() {
    process.argv = 'node cli.test.js'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.transaction.timeout_ms, 5000);
    assert.equal(result.transaction.period_ms, 5000);
  });

  it('Set timeout', function() {
    process.argv = 'node cli.test.js --timeout 1234'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.transaction.timeout_ms, 1234);
  });

  it('Set period', function() {
    process.argv = 'node cli.test.js --period 1234'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.transaction.period_ms, 1234);
  });

  it('Set bad timeout', function() {
    process.argv = 'node cli.test.js --timeout five'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.transaction.timeout_ms, 5000);
  });

  it('Set bad period', function() {
    process.argv = 'node cli.test.js --period five'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.transaction.period_ms, 5000);
  });
});

describe('Command Line Interface - Block Exit Condition', function() {
  it('Default block delta', function() {
    process.argv = 'node cli.test.js'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.exit.block_delta, 10000);
  });

  it('Set block delta', function() {
    process.argv = 'node cli.test.js --target-block 1234'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.exit.block_delta, 1234);
  });

  it('Set bad block delta', function() {
    process.argv = 'node cli.test.js --target-block five'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.exit.block_delta, 10000);
  });
});

describe('Command Line Interface - Fund', function() {
  it('Should not fund steves by default', function () {
    process.argv = 'node cli.test.js'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.fund, false);
  });

  it('Should fund steves with flag set', function () {
    process.argv = 'node cli.test.js --fund'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.fund, true);
  });
});

describe('Set mode', function() {
  it('Default is load', function () {
    process.argv = 'node cli.test.js'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.mode, "load");
  });

  it('invalid mode goes to load', function () {
    process.argv = 'node cli.test.js --mode invalid'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.mode, "load");
  });
});

describe('Set additional staking', function() {
  it('Default is 0', function () {
    process.argv = 'node cli.test.js'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.staking_validators, 0);
  });

  it('invalid param goes to default', function () {
    process.argv = 'node cli.test.js --stake invalid'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.staking_validators, 0);
  });
});

