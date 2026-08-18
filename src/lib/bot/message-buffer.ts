import { redisKey, redisPub as redis } from "@/lib/redis";

export class MessageBuffer {
  // Add a message to the buffer and return true if this is the first message triggering processing
  static async pushMessage(tenantId: string, customerId: string, message: string, lockTtlSeconds = 3): Promise<boolean> {
    const listKey = redisKey("buffer", "msgs", tenantId, customerId);
    const lockKey = redisKey("buffer", "lock", tenantId, customerId);

    // Push the new message to the list
    await redis.rpush(listKey, message);
    
    // Set expiry to ensure it doesn't leak
    await redis.expire(listKey, 60);

    // Try to acquire the processing lock (1 for true, 0 if it already exists)
    const acquired = await redis.setnx(lockKey, "1");
    if (acquired) {
      // Lock acquired, set a short timeout as debounce window
      // ponytail: TTL must outlive the debounce wait + processing; releaseLock clears it on normal exit
      await redis.expire(lockKey, lockTtlSeconds);
      return true;
    }
    
    return false;
  }

  // Get all accumulated messages and clear the buffer
  static async consumeMessages(tenantId: string, customerId: string): Promise<string[]> {
    const listKey = redisKey("buffer", "msgs", tenantId, customerId);
    
    // Get all elements
    const messages = await redis.lrange(listKey, 0, -1);
    
    // Delete the list
    await redis.del(listKey);
    
    return messages;
  }

  static async releaseLock(tenantId: string, customerId: string): Promise<void> {
    const lockKey = redisKey("buffer", "lock", tenantId, customerId);
    await redis.del(lockKey);
  }
}

