import { getRedisClient, RedisWrapper } from '@/lib/redis/config';

export class SimpleRedisCache {
  private redis: RedisWrapper | null = null;
  private isAvailable: boolean = false;

  constructor() {
    this.initRedis();
  }

  private async initRedis(): Promise<void> {
    try {
      this.redis = await getRedisClient();
      this.isAvailable = true;
    } catch (error) {
      this.redis = null;
      this.isAvailable = false;
    }
  }

  private async ensureRedis(): Promise<RedisWrapper | null> {
    if (!this.redis && this.isAvailable === false) {
      await this.initRedis();
    }
    return this.redis;
  }

  // Generic get/set with TTL
  async get<T extends Record<string, any>>(key: string): Promise<T | null> {
    const redis = await this.ensureRedis();
    if (!redis) return null;

    try {
      const result = await redis.hgetall<T>(key);
      return result || null;
    } catch (error) {
      return null;
    }
  }

  async set<T extends Record<string, any>>(key: string, value: T, ttlSeconds: number = 86400): Promise<void> {
    const redis = await this.ensureRedis();
    if (!redis) return;

    try {
      await redis.hmset(key, value);
    } catch (error) {
      // Silently fail - no caching is fine
    }
  }

  // Specific cache methods
  async getAbi(address: string): Promise<any | null> {
    return this.get(`alchemy:abi:${address.toLowerCase()}`);
  }

  async setAbi(address: string, abi: any): Promise<void> {
    return this.set(`alchemy:abi:${address.toLowerCase()}`, abi, 7 * 24 * 60 * 60); // 7 days
  }

  async getContractName(address: string): Promise<string | null> {
    const result = await this.get<{value: string}>(`alchemy:name:${address.toLowerCase()}`);
    return result?.value || null;
  }

  async setContractName(address: string, name: string): Promise<void> {
    return this.set(`alchemy:name:${address.toLowerCase()}`, {value: name}, 7 * 24 * 60 * 60); // 7 days
  }

  async getFunctionSignature(selector: string): Promise<string | null> {
    const result = await this.get<{value: string}>(`alchemy:sig:${selector}`);
    return result?.value || null;
  }

  async setFunctionSignature(selector: string, signature: string): Promise<void> {
    return this.set(`alchemy:sig:${selector}`, {value: signature}, 30 * 24 * 60 * 60); // 30 days
  }

  async getAddressType(address: string): Promise<'wallet' | 'contract' | null> {
    const result = await this.get<{value: 'wallet' | 'contract'}>(`alchemy:type:${address.toLowerCase()}`);
    return result?.value || null;
  }

  async setAddressType(address: string, type: 'wallet' | 'contract'): Promise<void> {
    return this.set(`alchemy:type:${address.toLowerCase()}`, {value: type}, 24 * 60 * 60); // 1 day
  }

  isRedisAvailable(): boolean {
    return this.isAvailable;
  }
} 