const { Keyring } = require('@polkadot/api');
const { makeTransaction } = require('../src/transaction');
let log = require('console-log-level')({ level: 'info' });
const DEFAULT_SLEEP = 5000;
const keyring = new Keyring({ type: 'sr25519' });
const { sleep } = require('../src/utils')

let transaction;
let controllersKeyring = [];

const controllerAddrs = [
    "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty", // BOB
    "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y", // CHARLIE
    "5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw" // EVE
]

async function createStashAccounts(api, transaction) {
    this.transaction = transaction
    stashAccount = []
    stashNames = ["BOB_STASH", "CHARLIE_STASH", "EVE_STASH"];
    aliceKeyring = keyring.addFromUri('//Alice');

    for (i = 0; i < stashNames.length; i++) {
        name = stashNames[i];
        stashAccount.push(keyring.addFromUri(name, { name: name }));
    }

    // await topUpStashAccount(api, transaction, 16000, stashAccount);
    // await topUpStashAccount(api, transaction, 16001, stashAccount);
    await bondStashAccounts(api, stashAccount);
    await setSessionKey(api);
    await setNodesValidating(api);
}

async function bondStashAccounts(api, stashes) {

    for (i = 0; i < controllerAddrs.length; i++) {
        let lock = true;
        let transfer = api.tx.staking.bond(controllerAddrs[i], "5_000_000_000_000", 0); 
        // Sign and Send the transaction
        transfer.signAndSend(stashes[i], (result) => {
            if (result.isCompleted) {
                if (result.isFinalized) {
                    hash = result.status.asFinalized;
                    log.info(`bondStashAccounts Status is ${result.isFinalized} with hash ${hash}`);
                }
                else { // error
                    log.error(`Account ${stashes[i]} failed to bond with Controller ${controllerAddrs[i]}`);
                    throw [`Transaction rejected ${result.status} for ${stashes[i]}`];
                }
                lock = false
            }
        })
            .catch(err => transaction_error = err);

        while (lock) {
            await sleep(200);
        }
    }
}

async function setSessionKey(api) {
    sessionKeys = [
        "QmZm1UsVeeqCrk5TbomhHyh7TWVZoaFVRJydca7FAa3ixs", //BOB
        "QmNNdgYtWUCqC9636HzWuUSNi2Y4nhsEqa4XxpEKkJV8sn", //CHARLIE
        "QmVss1rBWaPDHxUMeB3GdERMDZqh5TvP831YvjDZbjhFVA" //EVE

    ];

    controllersKeyring.push(keyring.addFromUri('//Bob'), keyring.addFromUri('//Charlie'), keyring.addFromUri('//Eve'))

    

    for (i = 0; i < sessionKeys.length; i++) {
        let keys = await api.rpc.author.rotateKeys();
        log.info(`Setting session key ${controllersKeyring[i]}`)
        let lock = true;
        new Promise(async function (resolve, reject) {
            const transfer = await api.tx.session.setKeys(keys, new Uint8Array());
            transfer.signAndSend(controllersKeyring[i], (result) => {

                if (result.isCompleted) {
                    resolve();
                    lock = false;
                    if (result.isFinalized) {
                        hash = result.status.asFinalized;
                        log.info(`Setting session key Status is ${result.isFinalized} with hash ${hash}`);
                    }
                    else { // error
                        log.error("Set session key failed");
                        throw [`Failed to set session key ${result.status} for ${controllersKeyring[i].meta.name}`];
                    }
                }
            }).catch((err) => {
                lock = false;
                reject(err);
            })
        });

        while (lock) {
            await sleep(200)
        }
    }
}

async function setNodesValidating(api) {
    const preferences = { "unstakeThreshold": 3, "validatorPayment": 0 };

    for (controller of controllersKeyring) {
        let lock = true
        // Sign and Send the transaction
        const transfer = api.tx.staking.validate(preferences);
        log.info(`Setting up staking validator node ${controller}`)
        transfer.signAndSend(controller, (result) => {
            if (result.isCompleted) {
                if (result.isFinalized) {
                    hash = result.status.asFinalized;
                    log.info(`setNodesValidating Status is ${result.isFinalized} with hash ${hash}`);
                }
                else { // error
                    log.error("Set staking validator node failed");
                    throw [`Failed to set staking account as validator ${result.status} for ${controller.meta.name}`];
                }
                lock = false;
            }
        })
            .catch(err => transaction_error = err);

        while (lock) {
            await sleep(200);
        }
    }
}

async function topUpStashAccount(api, transaction, type, stashAccounts) {
    let lock;
    for ([i, account] of stashAccounts.entries()) {
        lock = true;
        log.info(`TOP UP stash balance with ${type} -------------- \n ${account.meta.name}`)
        log.info(`Transfering to ${account.meta.name}`)  
        new Promise(async function () {
            await makeTransaction(api, transaction, aliceKeyring, account, '100_000_000_000_000', 5000, `funded ${i}`);
            lock = false;
        })
        while (lock) {
            await sleep(200);
        }
    }
}

module.exports = {
    createStashAccounts: createStashAccounts
}