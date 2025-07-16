import { EnsoRouteParams } from "./types"
import { getEnsoClient } from "./client"
import { max } from "lodash";


export class EnsoTokenFinder {
    private ensoClient = getEnsoClient()

    async findToken(chainId: number, tvl: number, apy: number, protocolSlug: string) {
        const protocols = await this.findProtocols(chainId, protocolSlug)
        console.log(protocols)
        const { minApy, maxApy } = this.getApyRange(apy)
        console.log(minApy, maxApy)
        const { minTvl, maxTvl } = this.getTvlRange(tvl)
        console.log(minTvl, maxTvl)
        const tokens = []
        for (const protocol of protocols) {
            const token = await this.ensoClient.getTokens({
                chainId: chainId,
                apyFrom: minApy,
                apyTo: maxApy,
                tvlFrom: minTvl,
                tvlTo: maxTvl,
                protocolSlug: protocol.slug,
                type: 'defi',
                includeMetadata: true
            })
            tokens.push(...token.data)
        }
        return tokens
    }
    getApyRange(apy: number) {
        if (apy <= 0 || !isFinite(apy)) return { minApy: 0, maxApy: 3 };
        if (apy < 10) {
            const minApy = max([apy - 2, 0])
            const maxApy = apy + 2
            return { minApy, maxApy }
        } else if (apy < 20) {
            const minApy = apy - 5
            const maxApy = apy + 5
            return { minApy, maxApy } 
        } else if (apy < 40) {
            const minApy = apy - 10
            const maxApy = apy + 10
            return { minApy, maxApy }
        } else {
            const minApy = apy - 20
            const maxApy = apy + 20
            return { minApy, maxApy }
        }
    }



    getTvlRange(tvl: number, highThresholdExp: number = 6) {
        if (tvl <= 0 || !isFinite(tvl)) return { minTvl: 0, maxTvl: 0 };

        const exp = Math.floor(Math.log10(tvl));
   
        // high TVL: > 1 Million
        const bucketExp = exp > highThresholdExp ? exp - 1 : exp;
        const bucketWidth = Math.pow(10, bucketExp);
      
        const minTvl = Math.floor(tvl - (bucketWidth / 2));
        const maxTvl = minTvl + bucketWidth;
        return { minTvl, maxTvl };
    }


    async findProtocols(chainId: number, protocolSlug: string) {
        let ensoProjects = await this.ensoClient.getProtocols({
            chainId: chainId,
            slug: protocolSlug
        })
        // if there is something, continue
        // if not, try again with the first part of the protocolSlug
        if (ensoProjects.length === 0) {
            const firstPart = protocolSlug.split("-")[0]
            ensoProjects = await this.ensoClient.getProtocols({
                chainId: chainId,
                slug: firstPart
            })
        }
        if (ensoProjects.length === 0) {
            return []
        }
        return ensoProjects
    }
}
