const { getDb } = require('../../lib/db');
const { getUser } = require('../../lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'DELETE only' });
  try {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: 'Login required' });

    const db = await getDb();
    await db.collection('bookmarks').deleteOne({ email: user.email, hackathonId: String(req.query.id) });
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};
