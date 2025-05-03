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

async function main() {

    console.log("checking for backfillable delegations");

    const url =  `${process.env.CSPR_CLOUD_REST_URL}/validators/${process.env.MY_VALIDATOR}/delegations?page_size=250`;
    const headers = {
        'Content-Type': 'application/json',
        'authorization': process.env.CSPR_CLOUD_API_KEY
    };

    fetch(url, { headers: headers }).then(res => res.json())
        .then(data => {
            data.data.forEach(delegation => {
                // checking if delegator owns NFT
                const nft_url = `${process.env.CSPR_CLOUD_REST_URL}/accounts/${delegation.public_key}/nft-token-ownership?contract_package_hash=${process.env.NFT_CONTRACT_PACKAGE_HASH.slice(5)}&includes=owner_public_key`;
                fetch(nft_url, { headers: headers }).then(res => res.json())
                .then(data => {
                    if(data.data.length === 0) {
                        console.log("Backfilling NFT to: " + delegation.public_key);
                        delegationReceived(delegation.public_key, (BigInt(delegation.stake) / BigInt(1000000000)).toLocaleString('en-US', {}))
                    }
                });
            });
        });
}

async function delegationReceived(delegator, cspr) {

    console.log("Preparing NFT for delegator: " + delegator + " with CSPR stake of: " + cspr);

    const image = await openai.images.edit({
        image: await toFile(
            fs.createReadStream(process.env.NFT_IMAGE_PATH),
            null,
            { type: 'image/png' },
        ),
        prompt: process.env.NFT_IMAGE_PROMPT,
        n: 1,
        response_format: "b64_json"
    }).catch(async(err) => {
        console.log("OpenAI error");
    });

    if (!image) { return }

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
        "1600000000",
        KEYS.publicKey,
        [KEYS]
    );

    const mintDeployHash = await client.putDeploy(mintDeploy);

    console.log("Mint Deploy: " + mintDeployHash);
}
main();