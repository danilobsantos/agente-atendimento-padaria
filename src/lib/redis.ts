import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const globalForRedis = globalThis as unknown as {
  redisPub: Redis | undefined;
  redisSub: Redis | undefined;
};

export const redisPub = globalForRedis.redisPub ?? new Redis(redisUrl);
export const redisSub = globalForRedis.redisSub ?? new Redis(redisUrl);

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redisPub = redisPub;
  globalForRedis.redisSub = redisSub;
}
export { Redis };
