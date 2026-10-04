const IORedis = require('ioredis');

let redis = null;

if (process.env.REDIS_URL) {
  redis = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  redis.on('error', (err) => {
    console.error('Redis error:', err.message);
  });

  console.log('✅ Redis connected');
} else {
  console.log('⚠️ Redis not configured, running without background jobs');
}

module.exports = redis;