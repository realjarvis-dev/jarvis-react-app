import { Alchemy, Network } from "alchemy-sdk";

const config = {
  apiKey: process.env.ALCHEMY_API_KEY!,
  network: process.env.TEST_NET_ENV === 'development' ? Network.ETH_SEPOLIA : Network.ETH_MAINNET,
  connectionInfoOverrides: {
    // <-- disable the internal referrer setup that Next.js 14’s undici fetch chokes on
    skipFetchSetup: true,
  },
};
const alchemy = new Alchemy(config);

export { alchemy };