const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Smoke-test on startup — logged in index.js
async function ping() {
  const result = await redis.ping();
  return result === 'PONG';
}

module.exports = { redis, ping };
