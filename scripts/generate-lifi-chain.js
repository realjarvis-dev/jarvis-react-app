// import json

// def clean_chain_data(input_file='lifi_chain.json', output_file='lifi_clean_chain.json'):
//     # Read the input JSON file
//     with open(input_file, 'r') as f:
//         data = json.load(f)
    
//     # Extract only the required fields for each chain
//     cleaned_chains = []
//     for chain in data['chains']:
//         cleaned_chain = {
//             'key': chain['key'],
//             'chainType': chain['chainType'],
//             'name': chain['name'],
//             'coin': chain['coin'],
//             'id': chain['id'],
//             'mainnet': chain['mainnet']
//         }
//         cleaned_chains.append(cleaned_chain)
    
    
//     # Write the cleaned data to output file
//     with open(output_file, 'w') as f:
//         json.dump(cleaned_chains, f, indent=2)

// if __name__ == '__main__':
//     clean_chain_data()
const fs = require('fs');
const path = require('path');

async function clean_chain_data() {
    const data = await fetch(`https://li.quest/v1/chains`);
    const json = await data.json();
    const cleaned_chains = json.chains.map(chain => ({
        'key': chain['key'],
        'chainType': chain['chainType'],
        'name': chain['name'],
        'coin': chain['coin'],
        'id': chain['id'],
        'mainnet': chain['mainnet']
        }));
    const outputPath = path.join(__dirname, '../lib/token-matcher/config/lifi/chains.ts');
    fs.writeFileSync(outputPath, `export const chains = ${JSON.stringify(cleaned_chains, null, 2)}`);

}

clean_chain_data();
