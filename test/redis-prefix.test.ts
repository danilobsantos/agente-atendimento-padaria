import { after, test, describe } from "node:test";
import assert from "node:assert/strict";
import { redisPrefix, redisKey, redisChannel, redisPub, redisSub } from "../src/lib/redis";

after(async () => {
  redisPub.disconnect();
  redisSub.disconnect();
});

describe("Redis namespace (REDIS_PREFIX)", () => {
  test("redisPrefix uses default ag_delivery if not overridden", () => {
    assert.equal(redisPrefix, process.env.REDIS_PREFIX?.replace(/:+$/, "") || "ag_delivery");
  });

  test("redisKey prefixes keys correctly", () => {
    assert.equal(
      redisKey("session", "tenant1", "customer1"),
      `${redisPrefix}:session:tenant1:customer1`
    );
    assert.equal(
      redisKey("buffer", "msgs", "tenant1", "customer1"),
      `${redisPrefix}:buffer:msgs:tenant1:customer1`
    );
    assert.equal(
      redisKey("buffer", "lock", "tenant1", "customer1"),
      `${redisPrefix}:buffer:lock:tenant1:customer1`
    );
    assert.equal(
      redisKey("cache", "products", "tenant1"),
      `${redisPrefix}:cache:products:tenant1`
    );
  });

  test("redisChannel prefixes Pub/Sub channels correctly", () => {
    assert.equal(
      redisChannel("tenant", "tenant1", "order"),
      `${redisPrefix}:tenant:tenant1:order`
    );
    assert.equal(
      redisChannel("tenant", "tenant1", "message"),
      `${redisPrefix}:tenant:tenant1:message`
    );
    assert.equal(
      redisChannel("tenant", "tenant1", "customer"),
      `${redisPrefix}:tenant:tenant1:customer`
    );
    assert.equal(
      redisChannel("tenant", "tenant1", "notification"),
      `${redisPrefix}:tenant:tenant1:notification`
    );
  });
});
