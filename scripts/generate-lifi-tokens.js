// import json
// new_data = {}

// with open("lifi_token.json", "r") as f:
//     data = json.load(f)
//     for chain in data["tokens"]:
//         chain = int(chain)
//         new_data[chain] = []
//         for token in data["tokens"][str(chain)]:
//             new_data[chain].append({
//                 "chainId": token["chainId"],
//                 "address": token["address"],
//                 "symbol": token["symbol"],
//                 "name": token["name"],
//                 "decimals": token["decimals"],
//             })


// print(new_data)
// # save new data
// with open("clean_token.json", "w") as f:
//     json.dump(new_data, f, indent=2)

const fs = require('fs');
const path = require('path');

async function clean_token_data() {
    const data = await fetch(`https://li.quest/v1/tokens`)
    const json = await data.json()
    const new_data = {}
    // loop over json.tokens which are dictionary items
    for (const chain in json.tokens) {
        new_data[chain] = []
        // loop over json.tokens[chain] which are array items
        for (const token of json.tokens[chain]) {
            new_data[chain].push({
                "chainId": token.chainId,
                "address": token.address,
                "symbol": token.symbol,
                "name": token.name,
                "decimals": token.decimals,
            })
        }
    }
    const outputPath = path.join(__dirname, '../lib/token-matcher/config/lifi/tokens.ts')
    fs.writeFileSync(outputPath, `export const tokensByChain = ${JSON.stringify(new_data, null, 2)}`)
}

clean_token_data()