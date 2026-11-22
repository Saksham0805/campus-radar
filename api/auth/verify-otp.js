const crypto = require('crypto');
const { getDb } = require('../../lib/db');
const { hashOtp, isEmail, signToken } = require('../../lib/util');

const MAX_ATTEMPTS = 5;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const otp = String((req.body || {}).otp || '').trim();
    if (!isEmail(email) || !/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Invalid email or OTP format' });

    const db = await getDb();
    const otps = db.collection('otps');

    const rec = await otps.findOne({ email });
    if (!rec || rec.expires.getTime() < Date.now()) return res.status(400).json({ error: 'OTP expired, request a new one' });
    if (rec.attempts >= MAX_ATTEMPTS) {
      await otps.deleteOne({ email });
      return res.status(429).json({ error: 'Too many wrong attempts, request a new OTP' });
    }

    const a = Buffer.from(rec.hash), b = Buffer.from(hashOtp(email, otp));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      await otps.updateOne({ email }, { $inc: { attempts: 1 } });
      return res.status(400).json({ error: `Wrong OTP (${MAX_ATTEMPTS - rec.attempts - 1} tries left)` });
    }

    await otps.deleteOne({ email });
    await db.collection('users').updateOne(
      { email },
      { $setOnInsert: { createdAt: new Date() }, $set: { lastLogin: new Date() } },
      { upsert: true }
    );

    res.status(200).json({ ok: true, token: signToken(email), email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
