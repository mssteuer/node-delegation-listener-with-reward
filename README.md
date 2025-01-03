# node-delegation-listener-with-reward

## Introduction

This simple application performs the following tasks:

1. Connect to a CSPR.cloud WebSocket stream and listen for delegations to a specific validator
2. Upon detecting such delegation, call the OpenAI DALL-E API to create a unique image
3. Call the FileBase API to upload the unique image to IPFS
4. Create and mint a CEP-78 NFT to the delegator, using the unique image as its asset

## Prerequisites

1. [OpenAI Developer Account](https://platform.openai.com/) with API access
2. [FileBase](https://filebase.com/) Free Account with API access
3. [CSPR.cloud Account](https://console.cspr.build/sign-up) (free access should suffice, but doesn't provide replay of events in case of disconnects. For that, 
and higher throughput, contact MAKE for elevated access)
4. An NFT collection owned by the account from which you'll mint. You can use [CSPR.studio](https://cspr.studio/) to create it

## Set Up
1. Clone this repo from GitHub
2. `npm install`
2. Copy `.env.example` into `.env` and configure your environment
3. Provide a base image for your NFT assets
4. Run this thing! `npm run start`

## Advanced
I've provided a `serviced` [template](steuer-node-nft.service), so you can run this through `systemctl` on your server

## Like This? ❤️
If you enjoy this little app, feel free to delegate some $CSPR to my
[Validator](https://cspr.live/validator/019c38cba1c9aa784f1648f297e13f04844611811a7127a00a5193dd4c94a63bf8), and you might end up getting a cool and certainly
unique NFT automatically seconds later!