require("dotenv").config();
const {OpenAI, toFile} = require("openai");
const fs = require("node:fs");
const {ObjectManager} = require("@filebase/sdk");
const openai = new OpenAI();
const {WebSocket} = require("ws");
const {CEP78Client} = require("casper-cep78-js-client");
const {Keys, CLPublicKey, CasperClient } = require("casper-js-sdk");

const KEYS = Keys.Ed25519.parseKeyFiles(
    `${process.env.KEY_PATH}/public_key.pem`,
    `${process.env.KEY_PATH}/secret_key.pem`
);

this.pingTimeout = 13000;

function heartbeat() {
    console.log("Heartbeat at " + new Date().toTimeString());
    clearTimeout(this.pingTimeout);
    this.pingTimeout = setTimeout(() => {
        console.log("Heartbeat timeout occured, terminating...");
        process.exit(1);
    }, 13000);
}

async function init() {

    console.log("init");

    console.log("Connecting to: " + `${process.env.CSPR_CLOUD_URL}deploys?contract_package_hash=${process.env.AUCTION_CONTRACT_PACKAGE}&contract_hash=${process.env.AUCTION_CONTRACT}`);

    const ws = new WebSocket(
        `${process.env.CSPR_CLOUD_URL}deploys?contract_package_hash=${process.env.AUCTION_CONTRACT_PACKAGE}&contract_hash=${process.env.AUCTION_CONTRACT}`,
        {
            headers: {
                authorization: process.env.CSPR_CLOUD_API_KEY,
            },
        },
    );

    ws.on('message',
        async (data) => {
            const rawData = data.toString();
            if (rawData === 'Ping') {
                heartbeat();
                return;
            }

            try {
                const event = JSON.parse(rawData);
                if (event.extra.entry_point_name === "delegate" || event.extra.entry_point_name === "redelegate") {
                    const validator = event.extra.entry_point_name === "delegate" ? event.data.args.validator.parsed : event.data.args.new_validator.parsed;
                    const delegator = event.data.args.delegator.parsed;
                    const motes = BigInt(event.data.args.amount.parsed);
                    const cspr = (motes / BigInt(1000000000)).toLocaleString('en-US', {});
                    if (validator === process.env.MY_VALIDATOR) {
                        console.log ("User delegated to my validator node");
                        await delegationReceived(delegator, cspr);
                    }
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

    ws.on('error', () => {
        console.log('Error in websocket connection. Terminating.');
        clearTimeout(this.pingTimeout);
        process.exit(1);
    })
    ws.on('close', () => {
        console.log('Disconnected from Streaming API');
        clearTimeout(this.pingTimeout);
        process.exit(1);
    });

}

async function delegationReceived(delegator, cspr) {

    console.log("Preparing NFT for delegator: " + delegator);

    const image = await openai.images.edit({
        image: await toFile(
            fs.createReadStream(process.env.NFT_IMAGE_PATH),
            null,
            { type: 'image/png' },
        ),
        prompt: process.env.NFT_IMAGE_PROMPT,
        n: 1,
        response_format: "b64_json"
    });

    console.log("Retrieved Image from OpenAI...");

    const objectManager = new ObjectManager(process.env.FILEBASE_API_KEY, process.env.FILEBASE_API_SECRET, {
        bucket: process.env.FILEBASE_BUCKET_NAME,
    });

    const uploadedObject = await objectManager.upload(
        "steuer-nft-" + Date.now(),
        Buffer.from(image.data[0].b64_json, "base64")
    );

    console.log("Uploaded image to FileBase IPFS: " + process.env.FILEBASE_GATEWAY + uploadedObject.cid);

    const cc = new CEP78Client(process.env.NODE_URL, process.env.NETWORK_NAME);
    const client = new CasperClient(process.env.NODE_URL);

    // NFT CEP-78 Contract
    cc.setContractHash(
        process.env.NFT_CONTRACT_HASH,
        process.env.NFT_CONTRACT_PACKAGE_HASH
    );

    const mintDeploy = cc.mint({
            owner: CLPublicKey.fromHex(delegator),
            meta: {
                name: `I Stake With Steuer`,
                description: `I delegated ${cspr} $CSPR to the SteuerNode, and all I got to show for it is this artsy NFT`,
                asset: process.env.FILEBASE_GATEWAY + uploadedObject.cid
            },
            collectionName: process.env.NFT_COLLECTION_NAME
        },
        { useSessionCode: false },
        "1500000000",
        KEYS.publicKey,
        [KEYS]
    );

    const mintDeployHash = await client.putDeploy(mintDeploy);

    console.log("Mint Deploy: " + mintDeployHash);
}
init();