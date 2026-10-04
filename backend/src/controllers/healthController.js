const db = require('../config/db');
const redis = require('../config/redis');

const getHealthStatus = async (_req, res) => {
  let database = 'down';
  try {
    await db.query('SELECT 1');
    database = 'up';
  } catch (_error) {
    // keep response useful even when DB is offline
  }

  const redisStatus = redis ? (redis.status === 'ready' ? 'up' : redis.status) : 'not-configured';
  const healthy = database === 'up';

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'OK' : 'DEGRADED',
    service: 'StayOps AI Backend',
    timestamp: new Date().toISOString(),
    dependencies: { database, redis: redisStatus },
    ai: {
      configured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    },
  });
};

module.exports = { getHealthStatus };
