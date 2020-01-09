const Keyring = require('@polkadot/keyring').default;
const testingPairs = require('@plugnet/keyring/testingPairs');
let log = require('console-log-level')({ level: 'info' });
const DEFAULT_SLEEP = 5000;
const keyring = new Keyring({ type: 'sr25519' });
const defaulKeyrings = testingPairs.default({ type: 'sr25519' });


const controllersKeyring = [
    defaulKeyrings.bob,
    defaulKeyrings.charlie,
    defaulKeyrings.eve
]; 

const controllerAddrs = [
    "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty", // BOB
    "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y", // CHARLIE
    "5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw" // EVE
]

async function createStashAccounts(api) {
    stashAccount = []
    stashNames = ["BOB_STASH", "CHARLIE_STASH", "EVE_STASH"];
    aliceKeyring = defaulKeyrings.alice;

    for (i = 0; i < stashNames.length; i++) {
        name = stashNames[i];
        stashAccount.push(keyring.addFromUri(name, { name: name }));
    }

    await topUpStashAccount(api, 16000, stashAccount);
    await topUpStashAccount(api, 16001, stashAccount);
    await bondStashAccounts(api, stashAccount);
    await setSessionKey(api);
    await setNodesValidating(api);
}

function sleep(ms = DEFAULT_SLEEP){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}

async function bondStashAccounts(api, stashes){
    
    for(i=0; i< controllerAddrs.length; i++){
        let lock = true;
        let transfer = api.tx.staking.bond(controllerAddrs[i], "5_000_000", 0);
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

        while (lock){
            await sleep(200);
        }
    }
}

async function setSessionKey(api){
    sessionKeys =[
        "5Cdw3BqUmFEdnEGQi62vk6E27XsL22R1A51Xea5xqU7xTDCc", //BOB
        "5Dvtpw1vdHcqZNURRkVP6izMPP1VcpUyUXmHYnGL2pDz5Ef2", //CHARLIE
        "5DMEX3mnK2vmTX4BfGpQXVoS2ST6PhgCQ56JkGdEXSnzZ3s3" //EVE

    ];

    for(i=0; i<sessionKeys.length; i++){
        log.info(`Setting session key ${controllersKeyring[i].meta.name}`)
        let lock = true;
        try{
            const transfer = await api.tx.session.setKey(sessionKeys[i]);
            transfer.signAndSend(controllersKeyring[i], (result) => {
                
                if(result.isCompleted){
                    if (result.isFinalized) {
                        hash = result.status.asFinalized;
                        log.info(`Setting session key Status is ${result.isFinalized} with hash ${hash}`);
                    }
                    else { // error
                        log.error("Set session key failed");
                        throw [`Failed to set session key ${result.status} for ${controllersKeyring[i].meta.name}`];
                    }
                    lock = false;
                }
            })
            
        }catch(err){
            console.log(err)
        };

        while (lock){
            await sleep(200)
        }
    }
}

async function setNodesValidating(api){
    const preferences = {"unstakeThreshold":3,"validatorPayment":0};

    for(controller of controllersKeyring){
        // Sign and Send the transaction
        const transfer = api.tx.staking.validate(preferences);
        log.info(`Setting up staking validator node ${controller.meta.name}`)
        transfer.signAndSend(controller, (result) => {
            if(result.isCompleted){
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

        while (lock){
            await sleep(200);
        }
    }
}

async function topUpStashAccount(api, type, stashAccounts){   
    lock = false; 
    for (account of stashAccounts) {
        lock = true;
        log.info(`TOP UP stash balance with ${type} -------------- \n ${account.meta.name}`)
        log.info(`Transfering to ${account.meta.name}`)            
            const unsub = await api.tx.genericAsset.transfer(type, account.address, "100_000_000_000_000")
            .signAndSend(aliceKeyring, (result) => {
                if (result.isCompleted) {
                    if (result.isFinalized) {
                        hash = result.status.asFinalized;
                        log.info(`topUpStashAccount Status is ${result.isFinalized} with hash ${hash}`);
                    }
                    else { // error
                        log.error("Transaction Rejected");
                        throw [`Transaction rejected ${result.status} for ${account.meta.name}`];
                    }
                    unsub();
                    lock = false;
                }
            })
            .catch(err => transaction_error = err);    

            while(lock){
                await sleep(200);
        }           
    }
}

module.exports = {
    createStashAccounts: createStashAccounts
}