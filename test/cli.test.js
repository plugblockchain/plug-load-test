const assert = require('assert');
const cli = require('../src/cli.js');

describe('Command Line Interface - IP Address', function() {
  it('Default Address', function() {
    process.argv = ['node','cli.test.js'];
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
  
  it('Port must be a number', function() {
    process.argv = 'node cli.test.js --address 0.0.0.0 five'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.address, "ws://0.0.0.0:9944");
  });
});

describe('Command Line Interface - Transaction Params', function() {
  it('Default Timing', function() {
    process.argv = ['node','cli.test.js'];
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
    process.argv = ['node','cli.test.js'];
    result = cli.parseCliArguments();
    assert.equal(result.exit.block_delta, 10000);
  });
  
  it('Set block delta', function() {
    process.argv = 'node cli.test.js --blocks 1234'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.exit.block_delta, 1234);
  });
    
  it('Set bad block delta', function() {
    process.argv = 'node cli.test.js --blocks five'.split(' ');
    result = cli.parseCliArguments();
    assert.equal(result.exit.block_delta, 10000);
  });
});
