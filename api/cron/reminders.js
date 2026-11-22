const { getDb } = require('../../lib/db');
const { sendIfDue } = require('../../lib/reminders');

// Vercel calls this once a day (see vercel.json) and sends  Authorization: Bearer <CRON_SECRET>
module.exports = async (req, res) => {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const db = await getDb();
    const now = Date.now();
    const due = await db.collection('bookmarks')
      .find({ deadline: { $gt: new Date(now), $lte: new Date(now + 72 * 3600000) } })
      .toArray();

    let sent = 0, failed = 0;
    for (const b of due) {
      try { if (await sendIfDue(db, b, now)) sent++; }
      catch (e) { failed++; console.error('Reminder failed:', b.email, e.message); }
    }
    res.status(200).json({ ok: true, checked: due.length, sent, failed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};
