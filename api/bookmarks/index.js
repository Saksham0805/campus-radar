const { getDb } = require('../../lib/db');
const { getUser, parseDeadline } = require('../../lib/util');
const { sendIfDue } = require('../../lib/reminders');

module.exports = async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: 'Login required' });

    const db = await getDb();
    const col = db.collection('bookmarks');

    if (req.method === 'GET') {
      const list = await col.find({ email: user.email }).project({ _id: 0, hackathonId: 1, title: 1, deadline: 1, url: 1 }).toArray();
      return res.status(200).json(list);
    }

    if (req.method === 'POST') {
      const { hackathonId, title, deadline, url } = req.body || {};
      const date = parseDeadline(deadline);
      if (!hackathonId || !title || !date) return res.status(400).json({ error: 'hackathonId, title and valid deadline required' });

      const doc = {
        email: user.email, hackathonId: String(hackathonId),
        title: String(title).slice(0, 200), deadline: date,
        url: typeof url === 'string' ? url.slice(0, 500) : '',
        sent: [], createdAt: new Date(),
      };

      try {
        await col.insertOne(doc);
      } catch (e) {
        if (e.code === 11000) return res.status(200).json({ ok: true });   // already saved
        throw e;
      }

      // deadline already close? email now instead of waiting for the daily check
      try { await sendIfDue(db, doc); } catch (e) { console.error('Reminder failed:', e.message); }

      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};
