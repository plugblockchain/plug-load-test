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
    acliceKeyring = defaulKeyrings.alice;

    for (i = 0; i < stashNames.length; i++) {
        name = stashNames[i];
        stashAccount.push(keyring.addFromUri(name, { name: name }));
    }

    for (account of stashAccount) {
        log.info("SETTING UP FOR CENNZ -------------- \n Accout raw seed: " + account.meta.name)
        log.info("Transfering cennz to " + account.meta.name)            
            const cennz = await api.tx.genericAsset.transfer(16000, account.address, "100_000_000_000_000")
            .signAndSend(acliceKeyring, (result) => {
                log.info(`Current status is ${result.status}`);

                if (result.isCompleted) {
                    if (result.isFinalized) {
                        hash = result.status.asFinalized;
                    }
                    else { // error
                        log.info("Transaction Rejected");
                        throw [APP_FAIL_TRANSACTION_REJECTED, `Transaction rejected ${result.status} for ${account.meta.name}`];
                    }
                    cennz();
                }
            })
            .catch(err => transaction_error = err);
            await sleep();
            
    }

    for (account of stashAccount) {
        log.info("SETTING UP FOR CENTRAPAY -------------- \n Accout raw seed: " + account.meta.name)
        log.info(`Transfering centrapay to ${account.meta.name} and address ${account.address}`)
        const unsub = await api.tx.genericAsset.transfer(16001, account.address, "100_000_000_000_000")
            .signAndSend(acliceKeyring, (result) => {
                log.info(`Current status is ${result.status}`);

                if (result.isCompleted) {
                    if (result.isFinalized) {
                        hash = result.status.asFinalized;
                    }
                    else { // error
                        log.info("Transaction Rejected");
                        throw [APP_FAIL_TRANSACTION_REJECTED, `Transaction rejected ${result.status}`];
                    }
                    unsub();
                }
            })
            .catch(err => transaction_error = err);
            await sleep();
    }

    await bondStashAccounts(api, stashAccount);
    await setSessionKey(api);
    await setNodesValidating(api);
}

function sleep(){
    return new Promise(resolve=>{
        setTimeout(resolve,DEFAULT_SLEEP)
    })
}

async function bondStashAccounts(api, stashes){
    
    for(i=0; i< controllerAddrs.length; i++){
       let transfer = api.tx.staking.bond(controllerAddrs[i], "5_000_000", 0);
        // Sign and Send the transaction
        transfer.signAndSend(stashes[i], ({ events = [], status, type }) => {
            if (type === 'Finalised') {
                console.log('Successful transfer ' + ' with hash ' + status.asFinalised.toHex());
              } else {
                console.log('Status of transfer: ' + type);
              }
              events.forEach(({ phase, event: { data, method, section } }) => {
                console.log(phase.toString() + ' : ' + section + '.' + method + ' ' + data.toString());
              });
        })
        .catch(err => transaction_error = err);

        await sleep();
    }
}

async function setSessionKey(api){
    sessionKeys =[
        "5Cdw3BqUmFEdnEGQi62vk6E27XsL22R1A51Xea5xqU7xTDCc", //BOB
        "5Dvtpw1vdHcqZNURRkVP6izMPP1VcpUyUXmHYnGL2pDz5Ef2", //CHARLIE
        "5DMEX3mnK2vmTX4BfGpQXVoS2ST6PhgCQ56JkGdEXSnzZ3s3" //EVE

    ];

    for(i=0; i<sessionKeys.length; i++){
        try{
            const transfer = await api.tx.session.setKey(sessionKeys[i]);
            transfer.signAndSend(controllersKeyring[i])
            
        }catch(err){
            console.log(err)
        };

        await sleep();
    }
}

async function setNodesValidating(api){
    const preferences = {"unstakeThreshold":3,"validatorPayment":0};

    for(controller of controllersKeyring){
        // Sign and Send the transaction
        const transfer = api.tx.staking.validate(preferences);
        transfer.signAndSend(controller, ({ events = [], status, type }) => {
            if (type === 'Finalised') {
                console.log('Successful transfer ' + ' with hash ' + status.asFinalised.toHex());
            } else {
                console.log('Status of transfer: ' + type);
            }
            events.forEach(({ phase, event: { data, method, section } }) => {
                console.log(phase.toString() + ' : ' + section + '.' + method + ' ' + data.toString());
            })           
        })
        .catch(err => transaction_error = err);

        await sleep();
    }
}

module.exports = {
    createStashAccounts: createStashAccounts
}