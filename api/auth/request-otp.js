const crypto = require('crypto');
const { getDb } = require('../../lib/db');
const { hashOtp, isEmail, sendMail, wrap } = require('../../lib/util');

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email' });

    const db = await getDb();
    const otps = db.collection('otps');

    const existing = await otps.findOne({ email });
    if (existing && Date.now() - existing.sentAt.getTime() < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.sentAt.getTime())) / 1000);
      return res.status(429).json({ error: `Wait ${wait}s before requesting another OTP` });
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    await otps.updateOne(
      { email },
      { $set: { hash: hashOtp(email, otp), attempts: 0, sentAt: new Date(), expires: new Date(Date.now() + OTP_TTL_MS) } },
      { upsert: true }
    );

    try {
      await sendMail(email, `${otp} is your Campus Radar login code`, wrap(`
        <p>Your one-time login code:</p>
        <div style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#6654e8;margin:12px 0">${otp}</div>
        <p>Valid for 5 minutes. Don't share it with anyone.</p>`));
    } catch (e) {
      console.error('Mail error:', e.message);
      await otps.deleteOne({ email });   // let the user retry right away
      return res.status(500).json({ error: 'Could not send email. Check the SMTP settings in Vercel.' });
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
