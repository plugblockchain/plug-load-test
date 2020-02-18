const { makeTransaction } = require('../src/transaction')
const { sleep, getFinalizedBlockNumber } = require('../src/utils')

const APP_SUCCESS = 0;
const APP_FAIL_TRANSACTION_INVALID = 1;
const APP_FAIL_TRANSACTION_TIMEOUT = 2;

async function runLoad(config) {

  let tx_count = 0;

  // SetInterval is used to ensure precise transaction rates
  let pending_transaction = 0;
  let interval = setInterval(function() {
    pending_transaction++;
  }, config.request_period_ms);

  // These varaibles allow asynchronous functions to recommend script termination
  let app_complete = false;
  let app_error = null;

  // Round robin api selection
  let api_idx = 0;

  const poll_period_ms = 10;

  let count = 0;

  // Loop exits once app_complete or app_error change
  while (true){
    // triggers a new transaction if needed
    if (pending_transaction > 0) {
      count++;
      pending_transaction--;

      if (count == 10000) {
        clearInterval(interval)
        interval = setInterval(function() {
          pending_transaction++;
        }, 10000);
      }

      let thrown_error = null;

      var transaction = new Promise(async function(resolve, reject){
        const addr = config.addresses[api_idx];
        const [sender, receiver] = config.keypair_selector.next();
        const transaction_hash = await makeTransaction(config.api, config.transaction, sender, receiver, config.funds, config.timeout_ms, tx_count)
        .catch(err => thrown_error = err);

        if (thrown_error != null) {
          reject([[APP_FAIL_TRANSACTION_INVALID, thrown_error], addr]);
        } else if (transaction_hash == null) {
          reject([[APP_FAIL_TRANSACTION_TIMEOUT, "Transaction Timeout"], addr])
        } else {
          const header = await config.api.rpc.chain.getHeader(transaction_hash);
          console.log(`Transaction included on block ${header.number} with blockHash ${transaction_hash}`);
          resolve()
        }
      })

      transaction.then(
        async function() {
          // Check if we have completed the test
          const block_delta = await getFinalizedBlockNumber(config.api) - config.start_block_number;

          console.log(`At block: ${block_delta} of ${config.required_block_delta}`)

          if (block_delta >= config.required_block_delta) {
            clearInterval(interval);
            app_complete = true;
          }
        },
        (err) => app_error = err
        )
        .catch(function (e) {
          console.log(e);
        })

      tx_count++;

    } else if (app_complete) {
      return APP_SUCCESS;
    } else if (app_error != null) {
      console.log("Error thrown:", app_error);
      app_error = null
      await sleep(poll_period_ms);
    } else {
      await sleep(poll_period_ms);
    }
  }
}

module.exports = {
  runLoad: runLoad
}