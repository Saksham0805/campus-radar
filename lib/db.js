const { MongoClient } = require('mongodb');

// Reuse the connection between requests (serverless functions stay warm for a while)
const cache = global._crMongo || (global._crMongo = { promise: null });

async function getDb() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing');
  if (!cache.promise) {
    const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
    cache.promise = client.connect().then(async (c) => {
      const db = c.db(process.env.MONGODB_DB || 'campusradar');
      await Promise.all([
        db.collection('otps').createIndex({ email: 1 }, { unique: true }),
        db.collection('otps').createIndex({ expires: 1 }, { expireAfterSeconds: 0 }), // auto-delete expired OTPs
        db.collection('users').createIndex({ email: 1 }, { unique: true }),
        db.collection('bookmarks').createIndex({ email: 1, hackathonId: 1 }, { unique: true }),
      ]);
      return db;
    }).catch((e) => { cache.promise = null; throw e; });
  }
  return cache.promise;
}

module.exports = { getDb };
