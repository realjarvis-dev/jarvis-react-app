import axios from 'axios';

const HOSTED_SDK_URL = 'https://api-v2.pendle.finance/core/';
export const LIMIT_ORDER_URL = 'https://api-v2.pendle.finance/limit-order/'

//"tokenApprovals": [
    // {
    //     "token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    //     "amount": "100000000"
    //   }
    // ],
export type MethodReturnType<Data> = {
    tx: {
        data: string;
        to: string;
        value: string;
    };
    tokenApprovals?: {
        token: string;
        amount: string;
    }[];
    data: Data;
};

export async function callSDK<Data>(path: string, params: Record<string, any> = {}) {
    const response = await axios.get<MethodReturnType<Data>>(HOSTED_SDK_URL + path, {
        params
    });

    return response.data;
}
