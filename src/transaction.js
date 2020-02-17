const { sleep } = require('../src/utils')
const cli = require('../src/cli');

const APP_FAIL_TRANSACTION_REJECTED = 1;
let settings = cli.parseCliArguments();

function id_to_string(id) {
  const zeropads = 4;
  const id_string = ("0".repeat(zeropads) + id.toString(16)).substr(-zeropads);
  return `<TX ${id_string}>     `;
}

async function makeTransaction(api, transaction, sender, receiver, funds, timeout_ms = settings.transaction.timeout_ms, tx_id)  {
    const sleep_ms = 50;
    const id_string = id_to_string(tx_id);
    let timed_out = false;
    let transaction_error = null;
    let hash = null;
    // Verbose transaction information -- could be removed in the future
    let nonce = await api.query.system.accountNonce(sender.address);
    let sender_balance = await transaction.balance(api, sender.address).catch((err) => {reject(err);}) ;
    let receiver_balance = await transaction.balance(api, receiver.address).catch((err) => {reject(err);});
  
    if (sender_balance == 1){
      throw (`Sender ${sender.meta.name} balance is 0`);
    }
  
    console.log(
      id_string +
      `${sender.meta.name} [${sender_balance}] =>`,
      `${receiver.meta.name} [${receiver_balance}]`,
      `${sender.address}`,
      `${receiver.address}`,
      `: Nonce - ${nonce.words}`,
      `Amount: ${funds}`
      );
  
  
  
    // if (chain == CHAIN_CENNZNET)
  
    // Sign and send a balance transfer
    new Promise(async function(resolve, reject){
      const unsub = await transaction.transfer(api, receiver.address, funds)
        .signAndSend(sender, { nonce: nonce }, (result) => {
          console.log(id_string + `Current status is ${result.status}`);

          if (result.isCompleted) {
            unsub();
            resolve();
            if (result.isFinalized) {
              hash = result.status.asFinalized;
            }
            else { // error
              console.log(id_string + "Transaction Rejected");
              reject([APP_FAIL_TRANSACTION_REJECTED, id_string + `Transaction rejected: ${result.status}`]);
            }
          }
        })
        .catch((err) => {
          reject(err);
        });
    })
    
  
    const timer = setTimeout(() => timed_out = true, timeout_ms);
  
    // periodically checks whether we have timed out
    // avoided sleeping here so that we can report a successful transation at the time
    // it occurs.
    while(timed_out == false) {
      if (hash != null) {
        clearTimeout(timer);
        break;
      }
      if (transaction_error != null) {
        throw [APP_FAIL_TRANSACTION_REJECTED, id_string + `Transaction rejected: ${transaction_error}`];
      }
      await sleep(sleep_ms);
    }

    return hash;
  }

  module.exports = {
    makeTransaction: makeTransaction
  }